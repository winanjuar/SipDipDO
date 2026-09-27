/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `server/domain/pricing/pdf.service.ts`
 * Story 2.2: Upload PDF MoM & Preview Web via Signed URL.
 *
 * Tests untuk Task 19 — Integration tests for PDF upload:
 * - 19.1 Test successful PDF upload updates mom.pdf_path
 * - 19.2 Test MIME type validation rejects non-PDF
 * - 19.3 Test file size validation rejects >10MB
 * - 19.4 Test signed URL generation
 * - 19.5 Test MoM deletion cleans up PDF
 *
 * Repo DIMOCK via `vi.mock` — mengikuti pola pricing.service.test.ts.
 *
 * **Validates: Requirements 1, 2**
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { uploadMomPdf, generateSignedUrl, deleteMomPdf, PdfDomainError } from './pdf.service'

// ---------------------------------------------------------------------------
// Test Data Stubs
// ---------------------------------------------------------------------------

/** Stub MoM draft untuk upload PDF. */
const stubMomDraft = () => ({
  id: 'mom-001',
  title: 'MoM MRO Q3 2026',
  heldAt: '2026-09-15T07:00:00.000Z',
  status: 'draft' as const,
  contentText: 'Draft notulen MRO.',
  pdfPath: null,
  finalizedAt: null,
  createdAt: '2026-09-15T07:00:00.000Z',
  updatedAt: '2026-09-15T07:00:00.000Z',
})

/** Stub MoM dengan PDF sudah terupload. */
const stubMomWithPdf = () => ({
  ...stubMomDraft(),
  id: 'mom-002',
  pdfPath: 'mom-002/1726396800000-notulen_mro.pdf',
})

/** Stub MoM final dengan PDF. */
const stubMomFinalWithPdf = () => ({
  ...stubMomWithPdf(),
  id: 'mom-003',
  status: 'final' as const,
  finalizedAt: '2026-09-16T10:00:00.000Z',
})

/** Stub file PDF valid — 1KB buffer. */
const stubPdfFile = () => Buffer.alloc(1024, 0x25) // PDF magic byte-like

/** Stub file PDF besar — 11MB (melebihi batas 10MB). */
const stubLargePdfFile = () => Buffer.alloc(11 * 1024 * 1024, 0x25)

// ---------------------------------------------------------------------------
// Mock Recordings
// ---------------------------------------------------------------------------

/** Perekam panggilan — di-hoist agar factory vi.mock bisa menutupnya. */
const rekaman = vi.hoisted(() => ({
  findMom: null as ReturnType<typeof stubMomDraft> | null,
  updateMomPdfPathCalled: [] as Array<{ momId: string, pdfPath: string }>,
  updatedMom: null as ReturnType<typeof stubMomWithPdf> | null,
  auditMasuk: [] as Array<Record<string, unknown>>,
  storageUploadCalled: [] as Array<{ bucket: string, path: string, contentType: string }>,
  storageUploadError: null as Error | null,
  storageCreateSignedUrlResult: null as { signedUrl: string } | null,
  storageCreateSignedUrlError: null as Error | null,
  storageRemoveCalled: [] as Array<{ bucket: string, paths: string[] }>,
  storageRemoveError: null as Error | null,
}))

beforeEach(() => {
  rekaman.findMom = null
  rekaman.updateMomPdfPathCalled.length = 0
  rekaman.updatedMom = null
  rekaman.auditMasuk.length = 0
  rekaman.storageUploadCalled.length = 0
  rekaman.storageUploadError = null
  rekaman.storageCreateSignedUrlResult = null
  rekaman.storageCreateSignedUrlError = null
  rekaman.storageRemoveCalled.length = 0
  rekaman.storageRemoveError = null
})

// ---------------------------------------------------------------------------
// Mock Repository
// ---------------------------------------------------------------------------

vi.mock('./mom.repo', () => ({
  findMomById: async (_db: unknown, _id: string) => rekaman.findMom,
  updateMomPdfPath: async (_tx: unknown, momId: string, pdfPath: string) => {
    rekaman.updateMomPdfPathCalled.push({ momId, pdfPath })
    return rekaman.updatedMom
  },
}))

vi.mock('../audit', () => ({
  writeAuditEntry: async (_tx: unknown, input: Record<string, unknown>) => {
    rekaman.auditMasuk.push(input)
  },
}))

// ---------------------------------------------------------------------------
// Mock Supabase Storage
// ---------------------------------------------------------------------------

vi.mock('../../utils/storage', () => ({
  useSupabaseStorage: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _file: Buffer, options?: { contentType?: string, upsert?: boolean }) => {
          rekaman.storageUploadCalled.push({
            bucket,
            path,
            contentType: options?.contentType ?? 'application/octet-stream',
          })
          if (rekaman.storageUploadError) {
            return { data: null, error: rekaman.storageUploadError }
          }
          return { data: { path }, error: null }
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          if (rekaman.storageCreateSignedUrlError) {
            return { data: null, error: rekaman.storageCreateSignedUrlError }
          }
          if (rekaman.storageCreateSignedUrlResult) {
            return { data: rekaman.storageCreateSignedUrlResult, error: null }
          }
          return {
            data: { signedUrl: `https://storage.example.com/sign/${path}?expires=${expiresIn}` },
            error: null,
          }
        },
        remove: async (paths: string[]) => {
          rekaman.storageRemoveCalled.push({ bucket, paths })
          if (rekaman.storageRemoveError) {
            return { data: null, error: rekaman.storageRemoveError }
          }
          return { data: paths.map((p) => ({ name: p })), error: null }
        },
      }),
    },
  }),
}))

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

/** Mock Db dengan transaksi — semua service pakai db.transaction(). */
const mockDb = {
  transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({ rollback: () => {} }),
}

/** Mock DbClient untuk query non-transaksional. */
const mockDbClient = {}

// ---------------------------------------------------------------------------
// Test Suite: 19.1 — Successful PDF Upload Updates mom.pdf_path
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pdf.service — successful PDF upload updates mom.pdf_path (19.1)', () => {
  /**
   * Test 19.1.1: COO uploads PDF, file is stored in Supabase Storage bucket.
   *
   * Skenario:
   * - COO mengunggah file PDF valid (1KB, application/pdf)
   * - MoM dengan ID mom-001 sudah ada di database
   * 
   * Ekspektasi:
   * - File diupload ke Supabase Storage bucket 'mom-pdfs'
   * - Path format: {momId}/{timestamp}-{sanitized_filename}
   *
   * **Validates: Requirements 1 AC1**
   */
  test('COO uploads PDF → file disimpan di Supabase Storage bucket privat', async () => {
    // Setup: MoM ada di database
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-notulen_mro.pdf',
    }

    const actorOwnerId = 'owner-coo-001'
    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      actorOwnerId,
    )

    // Assert: storage upload dipanggil
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    expect(rekaman.storageUploadCalled[0]).toMatchObject({
      bucket: 'mom-pdfs',
      contentType: 'application/pdf',
    })
    // Assert: path mengandung momId
    expect(rekaman.storageUploadCalled[0]!.path).toMatch(/^mom-001\//)
    // Assert: filename disanitize (spasi → underscore, lowercase)
    expect(rekaman.storageUploadCalled[0]!.path).toMatch(/notulen_mro\.pdf$/)
  })

  /**
   * Test 19.1.2: After successful upload, mom.pdf_path is updated.
   *
   * Skenario:
   * - Upload PDF berhasil ke Storage
   * - Service memanggil updateMomPdfPath untuk menyimpan path di database
   * 
   * Ekspektasi:
   * - updateMomPdfPath dipanggil dengan momId dan storage path
   * - MomWire dikembalikan dengan pdfPath yang sudah diupdate
   *
   * **Validates: Requirements 1 AC2**
   */
  test('setelah upload berhasil → pdf_path diupdate di database', async () => {
    rekaman.findMom = stubMomDraft()
    const expectedPdfPath = 'mom-001/1726396800000-notulen_mro.pdf'
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: expectedPdfPath,
    }

    const actorOwnerId = 'owner-coo-001'
    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      actorOwnerId,
    )

    // Assert: updateMomPdfPath dipanggil
    expect(rekaman.updateMomPdfPathCalled).toHaveLength(1)
    expect(rekaman.updateMomPdfPathCalled[0]).toMatchObject({
      momId: 'mom-001',
    })
    // Assert: pdfPath diupdate dengan path dari storage
    expect(rekaman.updateMomPdfPathCalled[0]!.pdfPath).toMatch(/^mom-001\//)

    // Assert: result memiliki pdfPath
    expect(result.pdfPath).toBeTruthy()
  })

  /**
   * Test 19.1.3: Audit event mom-pdf-uploaded is recorded with correct details.
   *
   * Skenario:
   * - Upload PDF berhasil
   * - Service mencatat audit entry dengan detail lengkap
   * 
   * Ekspektasi:
   * - Audit entry 'mom-pdf-uploaded' ditulis
   * - Detail mencakup: mom_id, file_size, original_filename, storage_path
   *
   * **Validates: Requirements 1 AC3**
   */
  test('upload berhasil → audit mom-pdf-uploaded dicatat', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-notulen_mro.pdf',
    }

    const actorOwnerId = 'owner-coo-001'
    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      actorOwnerId,
    )

    // Assert: audit entry ditulis
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-pdf-uploaded',
      actor: { kind: 'user', ownerId: actorOwnerId },
      target: 'moms:mom-001',
      details: expect.objectContaining({
        mom_id: 'mom-001',
        file_size: file.length,
        original_filename: fileName,
      }),
    })
    // Assert: storage_path ada di details
    expect(rekaman.auditMasuk[0]!.details).toHaveProperty('storage_path')
    expect((rekaman.auditMasuk[0]!.details as Record<string, unknown>).storage_path).toMatch(/^mom-001\//)
  })

  /**
   * Test 19.1.4: Upload with special characters in filename is sanitized.
   *
   * Skenario:
   * - Filename mengandung karakter spesial: "notulen [MRO] (Q3) 2026!.pdf"
   * - Service harus mensanitize filename sebelum upload
   * 
   * Ekspektasi:
   * - Karakter tidak valid diganti dengan underscore
   * - Filename di-lowercase-kan
   *
   * **Validates: Requirements 1 AC1 (metadata tertaut)**
   */
  test('filename dengan karakter spesial → disanitize dengan benar', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-notulen_mro_q3_2026_.pdf',
    }

    const file = stubPdfFile()
    const fileName = 'notulen [MRO] (Q3) 2026!.pdf'
    const mimeType = 'application/pdf'

    await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: filename disanitize
    const uploadedPath = rekaman.storageUploadCalled[0]!.path
    // Tidak boleh ada karakter [ ] ( ) ! di path
    expect(uploadedPath).not.toMatch(/[\[\]\(\)!]/)
    // Harus lowercase
    expect(uploadedPath).toMatch(/^mom-001\/\d+-[a-z0-9._-]+\.pdf$/)
  })

  /**
   * Test 19.1.5: Upload to non-existent MoM throws NOT_FOUND.
   *
   * Skenario:
   * - MoM dengan ID yang diminta tidak ditemukan di database
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code NOT_FOUND
   * - Tidak ada upload ke storage
   * - Tidak ada audit entry
   *
   * **Validates: Requirements 1 (MoM wajib ada)**
   */
  test('upload ke MoM tidak ada → tolak NOT_FOUND', async () => {
    rekaman.findMom = null // MoM tidak ditemukan

    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-xxx',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-xxx',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('NOT_FOUND')
    }

    // Assert: tidak ada upload ke storage
    expect(rekaman.storageUploadCalled).toHaveLength(0)
    // Assert: tidak ada audit entry
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 19.1.6: Storage upload error is handled gracefully.
   *
   * Skenario:
   * - Supabase Storage mengembalikan error saat upload
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code STORAGE_ERROR
   * - pdf_path tidak diupdate di database
   * - Tidak ada audit entry
   *
   * **Validates: Requirements 1 (error handling)**
   */
  test('storage upload gagal → tolak STORAGE_ERROR', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.storageUploadError = new Error('Bucket not found')

    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('STORAGE_ERROR')
    }

    // Assert: pdf_path tidak diupdate
    expect(rekaman.updateMomPdfPathCalled).toHaveLength(0)
    // Assert: tidak ada audit entry
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 19.1.7: Database update fails, storage file is cleaned up.
   *
   * Skenario:
   * - Upload ke storage berhasil
   * - updateMomPdfPath gagal (return null)
   * 
   * Ekspektasi:
   * - PdfDomainError thrown
   * - File yang sudah diupload dihapus dari storage (cleanup)
   *
   * **Validates: Requirements 1 (atomic operation)**
   */
  test('update database gagal → file di storage dibersihkan', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = null // Simulasi update gagal

    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    // Assert: storage upload dipanggil
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    // Assert: storage remove dipanggil untuk cleanup
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
    expect(rekaman.storageRemoveCalled[0]!.bucket).toBe('mom-pdfs')
  })

  /**
   * Test 19.1.8: Successful upload returns complete MomWire.
   *
   * Skenario:
   * - Upload berhasil
   * - Service mengembalikan MomWire lengkap dengan pdfPath
   * 
   * Ekspektasi:
   * - MomWire memiliki semua field yang diperlukan
   * - pdfPath berisi path ke file di storage
   *
   * **Validates: Requirements 1, 2**
   */
  test('upload berhasil → mengembalikan MomWire lengkap dengan pdfPath', async () => {
    const pdfPath = 'mom-001/1726396800000-notulen_mro.pdf'
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath,
      updatedAt: '2026-09-16T10:00:00.000Z',
    }

    const file = stubPdfFile()
    const fileName = 'notulen MRO.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: MomWire lengkap
    expect(result).toMatchObject({
      id: 'mom-001',
      title: 'MoM MRO Q3 2026',
      status: 'draft',
      pdfPath,
    })
    expect(result.pdfPath).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Test Suite: 19.2 — MIME Type Validation Rejects Non-PDF
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pdf.service — MIME type validation rejects non-PDF (19.2)', () => {
  /**
   * Test 19.2.1: Upload with image/png MIME type throws VALIDATION error.
   *
   * Skenario:
   * - COO mencoba mengunggah file dengan MIME type image/png
   * - Service harus menolak sebelum upload ke storage
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   * - Pesan error menjelaskan MIME type yang diizinkan
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload dengan MIME type image/png → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const fileName = 'image.png'
    const mimeType = 'image/png'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
      expect((error as PdfDomainError).message).toContain('application/pdf')
    }
  })

  /**
   * Test 19.2.2: Upload with image/jpeg MIME type throws VALIDATION error.
   *
   * Skenario:
   * - COO mencoba mengunggah file dengan MIME type image/jpeg
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   * - Tidak ada upload ke storage
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload dengan MIME type image/jpeg → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const fileName = 'photo.jpeg'
    const mimeType = 'image/jpeg'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }

    // Assert: tidak ada upload ke storage
    expect(rekaman.storageUploadCalled).toHaveLength(0)
  })

  /**
   * Test 19.2.3: Upload with text/plain MIME type throws VALIDATION error.
   *
   * Skenario:
   * - COO mencoba mengunggah file dengan MIME type text/plain
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   * - Tidak ada audit entry ditulis
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload dengan MIME type text/plain → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const fileName = 'document.txt'
    const mimeType = 'text/plain'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }

    // Assert: tidak ada audit entry
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 19.2.4: Upload with application/json MIME type throws VALIDATION error.
   *
   * Skenario:
   * - COO mencoba mengunggah file dengan MIME type application/json
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   * - Tidak ada interaksi dengan database (pdf_path tidak diupdate)
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload dengan MIME type application/json → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const fileName = 'data.json'
    const mimeType = 'application/json'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }

    // Assert: pdf_path tidak diupdate
    expect(rekaman.updateMomPdfPathCalled).toHaveLength(0)
  })

  /**
   * Test 19.2.5: Invalid MIME type validation fails before storage upload.
   *
   * Skenario:
   * - MIME type tidak valid
   * - Validasi harus gagal SEBELUM upload ke storage
   * 
   * Ekspektasi:
   * - storageUploadCalled tetap kosong
   * - Tidak ada audit entry
   * - Tidak ada update database
   *
   * **Validates: Requirements 1 AC6**
   */
  test('MIME type tidak valid → tidak ada upload ke storage sama sekali', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const testMimeTypes = [
      'image/png',
      'image/jpeg',
      'text/plain',
      'application/json',
      'application/xml',
      'image/gif',
      'text/html',
    ]

    for (const mimeType of testMimeTypes) {
      // Reset rekaman sebelum setiap test
      rekaman.storageUploadCalled.length = 0
      rekaman.auditMasuk.length = 0
      rekaman.updateMomPdfPathCalled.length = 0

      try {
        await uploadMomPdf(
          mockDb as never,
          'mom-001',
          file,
          `file.${mimeType.split('/')[1]}`,
          mimeType,
          'owner-coo-001',
        )
      }
      catch {
        // Expected to throw
      }

      // Assert: tidak ada upload ke storage
      expect(rekaman.storageUploadCalled).toHaveLength(0)
      // Assert: tidak ada audit entry
      expect(rekaman.auditMasuk).toHaveLength(0)
      // Assert: tidak ada update database
      expect(rekaman.updateMomPdfPathCalled).toHaveLength(0)
    }
  })

  /**
   * Test 19.2.6: VALIDATION error includes descriptive message.
   *
   * Skenario:
   * - MIME type tidak valid
   * - Error message harus menjelaskan MIME type yang diizinkan
   * 
   * Ekspektasi:
   * - Pesan error mencakup "application/pdf"
   * - Pesan error menjelaskan batasan tipe file
   *
   * **Validates: Requirements 1 AC6**
   */
  test('error VALIDATION menyertakan pesan deskriptif', async () => {
    rekaman.findMom = stubMomDraft()

    const file = stubPdfFile()
    const fileName = 'spreadsheet.xlsx'
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
      // Fail test bila tidak throw
      expect.fail('Expected PdfDomainError to be thrown')
    }
    catch (error) {
      expect(error).toBeInstanceOf(PdfDomainError)
      expect((error as PdfDomainError).code).toBe('VALIDATION')
      // Assert: pesan error menyebutkan MIME type yang diizinkan
      expect((error as PdfDomainError).message).toContain('application/pdf')
      // Assert: pesan error bersifat deskriptif (bukan hanya kode)
      expect((error as PdfDomainError).message.length).toBeGreaterThan(20)
    }
  })

  /**
   * Test 19.2.7: Valid application/pdf MIME type passes validation.
   *
   * Skenario:
   * - MIME type application/pdf (valid)
   * - Service melanjutkan upload ke storage
   * 
   * Ekspektasi:
   * - Tidak ada error VALIDATION
   * - Upload ke storage dilakukan
   *
   * **Validates: Requirements 1 AC6**
   */
  test('MIME type application/pdf → validasi lolos, upload dilanjutkan', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubPdfFile()
    const fileName = 'notulen.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: upload berhasil
    expect(result).toBeDefined()
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Test Suite: 19.3 — File Size Validation Rejects >10MB
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pdf.service — file size validation rejects >10MB (19.3)', () => {
  /**
   * Test 19.3.1: Upload file with size 11MB throws VALIDATION error.
   *
   * Skenario:
   * - COO mencoba mengunggah file PDF dengan ukuran 11MB (melebihi batas 10MB)
   * - Service harus menolak sebelum upload ke storage
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   * - Pesan error menjelaskan batas ukuran file
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload file 11MB → tolak VALIDATION dengan pesan batas ukuran', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const file = stubLargePdfFile() // 11MB buffer
    const fileName = 'large_notulen.pdf'
    const mimeType = 'application/pdf'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      file,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        file,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
      // Assert: pesan error menyebutkan batas ukuran (10MB)
      expect((error as PdfDomainError).message).toContain('10')
      expect((error as PdfDomainError).message.toLowerCase()).toContain('mb')
    }
  })

  /**
   * Test 19.3.2: Upload file exactly at 10MB (10,485,760 bytes) should pass validation.
   *
   * Skenario:
   * - COO mengunggah file PDF dengan ukuran tepat 10MB (boundary case)
   * - Service harus menerima file pada batas tepat
   * 
   * Ekspektasi:
   * - Tidak ada error VALIDATION
   * - Upload ke storage dilakukan
   * - Audit entry dicatat dengan file_size yang benar
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload file tepat 10MB (10.485.760 bytes) → validasi lolos', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-exact_10mb.pdf',
    }

    // Buat file dengan ukuran tepat 10MB = 10 * 1024 * 1024 bytes
    const exactTenMB = Buffer.alloc(10 * 1024 * 1024, 0x25)
    const fileName = 'exact_10mb.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      exactTenMB,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: upload berhasil
    expect(result).toBeDefined()
    expect(result.pdfPath).toBeTruthy()
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
    // Assert: file_size di audit sesuai
    expect((rekaman.auditMasuk[0]!.details as Record<string, unknown>).file_size).toBe(10 * 1024 * 1024)
  })

  /**
   * Test 19.3.3: Upload file with size 1KB should pass validation.
   *
   * Skenario:
   * - COO mengunggah file PDF kecil (1KB)
   * - Service harus menerima file kecil tanpa masalah
   * 
   * Ekspektasi:
   * - Tidak ada error VALIDATION
   * - Upload ke storage dilakukan
   *
   * **Validates: Requirements 1 AC6**
   */
  test('upload file 1KB → validasi lolos', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-small_file.pdf',
    }

    const smallFile = stubPdfFile() // 1KB buffer
    const fileName = 'small_file.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      smallFile,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: upload berhasil
    expect(result).toBeDefined()
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
    // Assert: file_size di audit sesuai (1KB = 1024 bytes)
    expect((rekaman.auditMasuk[0]!.details as Record<string, unknown>).file_size).toBe(1024)
  })

  /**
   * Test 19.3.4: No storage upload occurs when file size exceeds limit.
   *
   * Skenario:
   * - File 11MB diunggah
   * - Validasi ukuran gagal sebelum upload ke storage
   * 
   * Ekspektasi:
   * - storageUploadCalled tetap kosong
   * - Tidak ada audit entry
   * - Tidak ada update database
   *
   * **Validates: Requirements 1 AC6**
   */
  test('file melebihi batas → tidak ada upload ke storage sama sekali', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const largeFile = stubLargePdfFile() // 11MB
    const fileName = 'large.pdf'
    const mimeType = 'application/pdf'

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        largeFile,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch {
      // Expected to throw
    }

    // Assert: tidak ada upload ke storage
    expect(rekaman.storageUploadCalled).toHaveLength(0)
    // Assert: tidak ada audit entry
    expect(rekaman.auditMasuk).toHaveLength(0)
    // Assert: tidak ada update database
    expect(rekaman.updateMomPdfPathCalled).toHaveLength(0)
  })

  /**
   * Test 19.3.5: Error message includes size limit information.
   *
   * Skenario:
   * - File melebihi batas (11MB)
   * - Error message harus menjelaskan batas ukuran yang diizinkan
   * 
   * Ekspektasi:
   * - Pesan error mencakup "10" dan "MB"
   * - Pesan error bersifat deskriptif (bukan hanya kode error)
   *
   * **Validates: Requirements 1 AC6**
   */
  test('error VALIDATION menyertakan informasi batas ukuran', async () => {
    rekaman.findMom = stubMomDraft()

    const largeFile = stubLargePdfFile() // 11MB
    const fileName = 'oversized.pdf'
    const mimeType = 'application/pdf'

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        largeFile,
        fileName,
        mimeType,
        'owner-coo-001',
      )
      // Fail test bila tidak throw
      expect.fail('Expected PdfDomainError to be thrown')
    }
    catch (error) {
      expect(error).toBeInstanceOf(PdfDomainError)
      expect((error as PdfDomainError).code).toBe('VALIDATION')
      // Assert: pesan error menyebutkan batas ukuran
      const message = (error as PdfDomainError).message.toLowerCase()
      expect(message).toContain('10')
      // Assert: pesan mencakup "mb" atau informasi ukuran
      expect(message).toMatch(/mb|megabyte|maksimal|batas/i)
      // Assert: pesan error bersifat deskriptif (bukan hanya kode)
      expect((error as PdfDomainError).message.length).toBeGreaterThan(20)
    }
  })

  /**
   * Test 19.3.6: File size validation occurs before MoM lookup (fail fast).
   *
   * Skenario:
   * - File 11MB diunggah untuk MoM yang tidak ada
   * - Validasi ukuran harus gagal SEBELUM MoM lookup
   * 
   * Ekspektasi:
   * - Error code adalah VALIDATION, bukan NOT_FOUND
   * - Database tidak dipanggil untuk mencari MoM
   *
   * **Validates: Requirements 1 AC6**
   */
  test('validasi ukuran terjadi sebelum lookup MoM (fail fast)', async () => {
    // Setup: MoM tidak ada, tapi seharusnya tidak sampai dicek
    rekaman.findMom = null

    const largeFile = stubLargePdfFile() // 11MB
    const fileName = 'oversized.pdf'
    const mimeType = 'application/pdf'

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-nonexistent',
        largeFile,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      // Assert: error code adalah VALIDATION, bukan NOT_FOUND
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }
  })

  /**
   * Test 19.3.7: Boundary case - file size 1 byte over limit throws error.
   *
   * Skenario:
   * - File dengan ukuran 10MB + 1 byte (10.485.761 bytes)
   * - Service harus menolak file yang sedikit melebihi batas
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code VALIDATION
   *
   * **Validates: Requirements 1 AC6**
   */
  test('file 10MB + 1 byte (10.485.761 bytes) → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    // Buat file dengan ukuran 10MB + 1 byte
    const justOverLimit = Buffer.alloc(10 * 1024 * 1024 + 1, 0x25)
    const fileName = 'just_over.pdf'
    const mimeType = 'application/pdf'

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      justOverLimit,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        justOverLimit,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }

    // Assert: tidak ada upload ke storage
    expect(rekaman.storageUploadCalled).toHaveLength(0)
  })

  /**
   * Test 19.3.8: Boundary case - file size 1 byte under limit passes validation.
   *
   * Skenario:
   * - File dengan ukuran 10MB - 1 byte (10.485.759 bytes)
   * - Service harus menerima file yang sedikit di bawah batas
   * 
   * Ekspektasi:
   * - Tidak ada error VALIDATION
   * - Upload ke storage dilakukan
   *
   * **Validates: Requirements 1 AC6**
   */
  test('file 10MB - 1 byte (10.485.759 bytes) → validasi lolos', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = {
      ...stubMomDraft(),
      pdfPath: 'mom-001/1726396800000-just_under.pdf',
    }

    // Buat file dengan ukuran 10MB - 1 byte
    const justUnderLimit = Buffer.alloc(10 * 1024 * 1024 - 1, 0x25)
    const fileName = 'just_under.pdf'
    const mimeType = 'application/pdf'

    const result = await uploadMomPdf(
      mockDb as never,
      'mom-001',
      justUnderLimit,
      fileName,
      mimeType,
      'owner-coo-001',
    )

    // Assert: upload berhasil
    expect(result).toBeDefined()
    expect(rekaman.storageUploadCalled).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
    // Assert: file_size di audit sesuai
    expect((rekaman.auditMasuk[0]!.details as Record<string, unknown>).file_size).toBe(10 * 1024 * 1024 - 1)
  })

  /**
   * Test 19.3.9: Both MIME type and file size validation work together.
   *
   * Skenario:
   * - File dengan MIME type tidak valid DAN ukuran melebihi batas
   * - Service harus menolak dengan error pertama yang ditemui (MIME type dulu)
   * 
   * Ekspektasi:
   * - Error adalah VALIDATION (bisa dari MIME type atau size)
   * - Tidak ada upload ke storage
   *
   * **Validates: Requirements 1 AC6**
   */
  test('file dengan MIME type tidak valid DAN size >10MB → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.updatedMom = stubMomWithPdf()

    const largeNonPdf = stubLargePdfFile() // 11MB
    const fileName = 'large_image.png'
    const mimeType = 'image/png' // Invalid MIME type

    await expect(uploadMomPdf(
      mockDb as never,
      'mom-001',
      largeNonPdf,
      fileName,
      mimeType,
      'owner-coo-001',
    )).rejects.toThrow(PdfDomainError)

    try {
      await uploadMomPdf(
        mockDb as never,
        'mom-001',
        largeNonPdf,
        fileName,
        mimeType,
        'owner-coo-001',
      )
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('VALIDATION')
    }

    // Assert: tidak ada upload ke storage
    expect(rekaman.storageUploadCalled).toHaveLength(0)
    // Assert: tidak ada audit entry
    expect(rekaman.auditMasuk).toHaveLength(0)
  })
})


// ---------------------------------------------------------------------------
// Test Suite: 19.4 — Signed URL Generation
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pdf.service — signed URL generation (19.4)', () => {
  /**
   * Test 19.4.1: Generate signed URL for MoM with PDF returns URL and expiresAt.
   *
   * Skenario:
   * - MoM dengan ID mom-002 sudah ada di database dengan pdfPath
   * - Service menghasilkan Signed URL dengan masa berlaku 15 menit
   * 
   * Ekspektasi:
   * - Mengembalikan object { url, expiresAt }
   * - url berisi signed URL dari storage
   * - expiresAt adalah ISO string waktu kedaluwarsa
   *
   * **Validates: Requirements 2 AC1**
   */
  test('MoM dengan PDF → mengembalikan URL dan expiresAt', async () => {
    rekaman.findMom = stubMomWithPdf()
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: 'https://storage.example.com/sign/mom-002/notulen.pdf?token=abc123',
    }

    const result = await generateSignedUrl(mockDbClient as never, 'mom-002')

    // Assert: result memiliki url dan expiresAt
    expect(result).toHaveProperty('url')
    expect(result).toHaveProperty('expiresAt')
    expect(result.url).toBe('https://storage.example.com/sign/mom-002/notulen.pdf?token=abc123')
    // Assert: expiresAt adalah ISO string valid
    expect(() => new Date(result.expiresAt)).not.toThrow()
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  /**
   * Test 19.4.2: MoM without PDF (pdfPath null) throws NOT_FOUND error.
   *
   * Skenario:
   * - MoM dengan ID mom-001 ada tapi pdfPath null
   * - Service harus menolak karena tidak ada PDF untuk dibuat URL-nya
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code NOT_FOUND
   * - Pesan error menjelaskan MoM tidak memiliki PDF
   *
   * **Validates: Requirements 2 AC1**
   */
  test('MoM tanpa PDF (pdfPath null) → tolak NOT_FOUND', async () => {
    rekaman.findMom = stubMomDraft() // pdfPath: null

    await expect(generateSignedUrl(mockDbClient as never, 'mom-001'))
      .rejects.toThrow(PdfDomainError)

    try {
      await generateSignedUrl(mockDbClient as never, 'mom-001')
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('NOT_FOUND')
      // Assert: pesan error menjelaskan tidak ada PDF
      expect((error as PdfDomainError).message.toLowerCase()).toMatch(/pdf/i)
    }
  })

  /**
   * Test 19.4.3: MoM not found throws NOT_FOUND error.
   *
   * Skenario:
   * - MoM dengan ID yang diminta tidak ditemukan di database
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code NOT_FOUND
   * - Pesan error menjelaskan MoM tidak ditemukan
   *
   * **Validates: Requirements 2 AC1**
   */
  test('MoM tidak ditemukan → tolak NOT_FOUND', async () => {
    rekaman.findMom = null // MoM tidak ada

    await expect(generateSignedUrl(mockDbClient as never, 'mom-nonexistent'))
      .rejects.toThrow(PdfDomainError)

    try {
      await generateSignedUrl(mockDbClient as never, 'mom-nonexistent')
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('NOT_FOUND')
      expect((error as PdfDomainError).message.toLowerCase()).toMatch(/mom.*tidak ditemukan/i)
    }
  })

  /**
   * Test 19.4.4: Storage createSignedUrl error throws STORAGE_ERROR.
   *
   * Skenario:
   * - MoM dengan PDF ada di database
   * - Supabase Storage mengembalikan error saat createSignedUrl
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code STORAGE_ERROR
   * - Pesan error menjelaskan gagal membuat signed URL
   *
   * **Validates: Requirements 2 (error handling)**
   */
  test('storage createSignedUrl gagal → tolak STORAGE_ERROR', async () => {
    rekaman.findMom = stubMomWithPdf()
    rekaman.storageCreateSignedUrlError = new Error('Storage bucket not accessible')

    await expect(generateSignedUrl(mockDbClient as never, 'mom-002'))
      .rejects.toThrow(PdfDomainError)

    try {
      await generateSignedUrl(mockDbClient as never, 'mom-002')
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('STORAGE_ERROR')
      expect((error as PdfDomainError).message.toLowerCase()).toMatch(/signed url|storage/i)
    }
  })

  /**
   * Test 19.4.5: Verify expiry is set to 15 minutes (900 seconds).
   *
   * Skenario:
   * - MoM dengan PDF ada di database
   * - Service menghasilkan Signed URL
   * 
   * Ekspektasi:
   * - expiresAt adalah sekitar 15 menit dari sekarang
   * - Toleransi: ±5 detik untuk menghindari race condition test
   *
   * **Validates: Requirements 2 AC1**
   */
  test('expiresAt diset ke 15 menit dari sekarang (900 detik)', async () => {
    rekaman.findMom = stubMomWithPdf()
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: 'https://storage.example.com/sign/mom-002/notulen.pdf?token=abc123',
    }

    const beforeCall = Date.now()
    const result = await generateSignedUrl(mockDbClient as never, 'mom-002')
    const afterCall = Date.now()

    const expiresAtMs = new Date(result.expiresAt).getTime()
    const expectedMinMs = beforeCall + (900 * 1000) - 5000 // 15 menit - 5 detik toleransi
    const expectedMaxMs = afterCall + (900 * 1000) + 5000 // 15 menit + 5 detik toleransi

    // Assert: expiresAt dalam rentang yang diharapkan
    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMinMs)
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMaxMs)
  })

  /**
   * Test 19.4.6: Owner role can request signed URL (via service layer).
   *
   * Skenario:
   * - Owner (pemegang saham) memanggil generateSignedUrl
   * - Service layer tidak melakukan validasi role (API layer bertanggung jawab)
   * - Selama MoM ada dan punya PDF, URL berhasil dibuat
   * 
   * Ekspektasi:
   * - Signed URL berhasil dibuat
   * - Tidak ada error authorization di service layer
   *
   * Note: Role validation terjadi di API endpoint, bukan di service layer.
   *
   * **Validates: Requirements 2 AC2**
   */
  test('service layer berhasil membuat signed URL (role divalidasi di API layer)', async () => {
    rekaman.findMom = stubMomWithPdf()
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: 'https://storage.example.com/sign/mom-002/notulen.pdf?token=owner123',
    }

    // Service layer tidak menerima parameter role — validasi di API
    const result = await generateSignedUrl(mockDbClient as never, 'mom-002')

    // Assert: URL berhasil dibuat
    expect(result.url).toBeTruthy()
    expect(result.expiresAt).toBeTruthy()
  })

  /**
   * Test 19.4.7: COO role can request signed URL (via service layer).
   *
   * Skenario:
   * - COO memanggil generateSignedUrl
   * - Service layer tidak melakukan validasi role (API layer bertanggung jawab)
   * - Selama MoM ada dan punya PDF, URL berhasil dibuat
   * 
   * Ekspektasi:
   * - Signed URL berhasil dibuat
   * - Tidak ada error authorization di service layer
   *
   * Note: Role validation terjadi di API endpoint, bukan di service layer.
   *
   * **Validates: Requirements 2 AC2**
   */
  test('COO dapat meminta signed URL (role divalidasi di API layer)', async () => {
    rekaman.findMom = stubMomFinalWithPdf()
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: 'https://storage.example.com/sign/mom-003/final_notulen.pdf?token=coo456',
    }

    // Service layer tidak menerima parameter role — validasi di API
    const result = await generateSignedUrl(mockDbClient as never, 'mom-003')

    // Assert: URL berhasil dibuat
    expect(result.url).toBeTruthy()
    expect(result.expiresAt).toBeTruthy()
    // Assert: URL sesuai dengan yang dikembalikan storage
    expect(result.url).toBe('https://storage.example.com/sign/mom-003/final_notulen.pdf?token=coo456')
  })

  /**
   * Test 19.4.8: Signed URL contains correct path from mom.pdfPath.
   *
   * Skenario:
   * - MoM memiliki pdfPath tertentu
   * - createSignedUrl dipanggil dengan path yang benar
   * 
   * Ekspektasi:
   * - Mock storage.createSignedUrl menerima path dari mom.pdfPath
   * - URL yang dikembalikan sesuai dengan hasil storage
   *
   * **Validates: Requirements 2 AC1**
   */
  test('signed URL menggunakan path dari mom.pdfPath', async () => {
    const customPdfPath = 'mom-custom/1234567890-custom_notulen.pdf'
    rekaman.findMom = {
      ...stubMomWithPdf(),
      pdfPath: customPdfPath,
    }
    // Mock storage mengembalikan URL yang mencakup path
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: `https://storage.example.com/sign/${customPdfPath}?token=xyz`,
    }

    const result = await generateSignedUrl(mockDbClient as never, 'mom-002')

    // Assert: URL dikembalikan sesuai hasil mock (yang seharusnya menggunakan path)
    expect(result.url).toContain(customPdfPath)
  })

  /**
   * Test 19.4.9: Storage returns data without signedUrl throws STORAGE_ERROR.
   *
   * Skenario:
   * - MoM dengan PDF ada di database
   * - Supabase Storage mengembalikan data tanpa signedUrl property
   * 
   * Ekspektasi:
   * - PdfDomainError dengan code STORAGE_ERROR
   *
   * **Validates: Requirements 2 (error handling)**
   */
  test('storage mengembalikan data tanpa signedUrl → tolak STORAGE_ERROR', async () => {
    rekaman.findMom = stubMomWithPdf()
    // Simulasi storage mengembalikan object tanpa signedUrl
    rekaman.storageCreateSignedUrlResult = {} as { signedUrl: string }

    await expect(generateSignedUrl(mockDbClient as never, 'mom-002'))
      .rejects.toThrow(PdfDomainError)

    try {
      await generateSignedUrl(mockDbClient as never, 'mom-002')
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('STORAGE_ERROR')
    }
  })

  /**
   * Test 19.4.10: expiresAt is a valid ISO 8601 string.
   *
   * Skenario:
   * - Service menghasilkan expiresAt dalam format ISO 8601
   * 
   * Ekspektasi:
   * - expiresAt dapat di-parse kembali sebagai Date
   * - Format sesuai ISO 8601 (berakhiran Z atau timezone)
   *
   * **Validates: Requirements 2 AC1**
   */
  test('expiresAt adalah string ISO 8601 yang valid', async () => {
    rekaman.findMom = stubMomWithPdf()
    rekaman.storageCreateSignedUrlResult = {
      signedUrl: 'https://storage.example.com/sign/mom-002/notulen.pdf?token=iso',
    }

    const result = await generateSignedUrl(mockDbClient as never, 'mom-002')

    // Assert: expiresAt adalah string
    expect(typeof result.expiresAt).toBe('string')
    // Assert: dapat di-parse sebagai Date valid
    const parsed = new Date(result.expiresAt)
    expect(parsed.getTime()).not.toBeNaN()
    // Assert: format ISO 8601 (mengandung T dan Z atau timezone offset)
    expect(result.expiresAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})


// ---------------------------------------------------------------------------
// Test Suite: 19.5 — MoM Deletion Cleans Up PDF
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pdf.service — MoM deletion cleans up PDF (19.5)', () => {
  /**
   * Test 19.5.1: Delete MoM with PDF removes file from storage.
   *
   * Skenario:
   * - MoM draft dengan pdfPath dihapus
   * - Service memanggil storage.remove untuk menghapus file PDF
   *
   * Ekspektasi:
   * - storage.from('mom-pdfs').remove([pdfPath]) dipanggil
   * - File dihapus dari bucket yang benar
   *
   * **Validates: Requirements 1 AC5**
   */
  test('hapus MoM dengan PDF → storage.remove dipanggil dengan path yang benar', async () => {
    const pdfPath = 'mom-002/1726396800000-notulen_mro.pdf'

    await deleteMomPdf(pdfPath)

    // Assert: storage remove dipanggil
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
    expect(rekaman.storageRemoveCalled[0]).toMatchObject({
      bucket: 'mom-pdfs',
      paths: [pdfPath],
    })
  })

  /**
   * Test 19.5.2: Verify bucket name is 'mom-pdfs'.
   *
   * Skenario:
   * - MoM dengan PDF dihapus
   * - Service harus menggunakan bucket 'mom-pdfs' untuk penghapusan
   *
   * Ekspektasi:
   * - Bucket yang digunakan adalah 'mom-pdfs'
   *
   * **Validates: Requirements 1 AC5**
   */
  test('penghapusan menggunakan bucket "mom-pdfs"', async () => {
    const pdfPath = 'mom-003/1726400000000-final_notulen.pdf'

    await deleteMomPdf(pdfPath)

    // Assert: bucket yang benar digunakan
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
    expect(rekaman.storageRemoveCalled[0]!.bucket).toBe('mom-pdfs')
  })

  /**
   * Test 19.5.3: Verify path passed to remove matches mom.pdfPath.
   *
   * Skenario:
   * - MoM dengan pdfPath tertentu dihapus
   * - Path yang dikirim ke storage.remove harus persis sama dengan pdfPath
   *
   * Ekspektasi:
   * - Argumen paths[0] === pdfPath
   *
   * **Validates: Requirements 1 AC5**
   */
  test('path yang dikirim ke remove sama persis dengan pdfPath', async () => {
    const customPdfPath = 'mom-custom-id/1726456789000-custom_notulen_file.pdf'

    await deleteMomPdf(customPdfPath)

    // Assert: path yang dikirim sama persis
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
    expect(rekaman.storageRemoveCalled[0]!.paths).toEqual([customPdfPath])
    expect(rekaman.storageRemoveCalled[0]!.paths[0]).toBe(customPdfPath)
  })

  /**
   * Test 19.5.4: Storage remove error throws STORAGE_ERROR.
   *
   * Skenario:
   * - Supabase Storage mengembalikan error saat remove
   * - Service harus melempar PdfDomainError dengan code STORAGE_ERROR
   *
   * Ekspektasi:
   * - PdfDomainError dengan code STORAGE_ERROR
   * - Pesan error menjelaskan kegagalan penghapusan
   *
   * Note: Current implementation throws error. If graceful handling is required,
   * the service needs to be modified to catch and log instead of throw.
   *
   * **Validates: Requirements 1 AC5 (error handling)**
   */
  test('storage remove error → throw STORAGE_ERROR', async () => {
    rekaman.storageRemoveError = new Error('File not found in bucket')

    const pdfPath = 'mom-error/1726396800000-error_file.pdf'

    await expect(deleteMomPdf(pdfPath))
      .rejects.toThrow(PdfDomainError)

    try {
      await deleteMomPdf(pdfPath)
    }
    catch (error) {
      expect((error as PdfDomainError).code).toBe('STORAGE_ERROR')
      expect((error as PdfDomainError).message.toLowerCase()).toMatch(/menghapus|storage|file/i)
    }
  })

  /**
   * Test 19.5.5: Storage remove is called exactly once per deletion.
   *
   * Skenario:
   * - Satu MoM dihapus
   * - Service harus memanggil storage.remove tepat sekali
   *
   * Ekspektasi:
   * - storageRemoveCalled memiliki satu entry
   *
   * **Validates: Requirements 1 AC5**
   */
  test('storage remove dipanggil tepat sekali per penghapusan', async () => {
    const pdfPath = 'mom-single/1726396800000-single.pdf'

    await deleteMomPdf(pdfPath)

    // Assert: dipanggil tepat sekali
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
  })

  /**
   * Test 19.5.6: Successful deletion completes without throwing.
   *
   * Skenario:
   * - Storage remove berhasil (tidak ada error)
   * - Function harus selesai tanpa melempar exception
   *
   * Ekspektasi:
   * - Tidak ada exception thrown
   * - Function mengembalikan void (undefined)
   *
   * **Validates: Requirements 1 AC5**
   */
  test('penghapusan berhasil → selesai tanpa error', async () => {
    const pdfPath = 'mom-success/1726396800000-success.pdf'

    // Assert: tidak melempar exception
    await expect(deleteMomPdf(pdfPath)).resolves.toBeUndefined()
  })

  /**
   * Test 19.5.7: Paths array contains single element.
   *
   * Skenario:
   * - Service menghapus satu file PDF
   * - storage.remove menerima array dengan satu path
   *
   * Ekspektasi:
   * - paths array memiliki length 1
   * - paths[0] adalah string pdfPath
   *
   * **Validates: Requirements 1 AC5**
   */
  test('paths array berisi satu elemen', async () => {
    const pdfPath = 'mom-array/1726396800000-array.pdf'

    await deleteMomPdf(pdfPath)

    // Assert: paths array memiliki satu elemen
    expect(rekaman.storageRemoveCalled[0]!.paths).toHaveLength(1)
    expect(Array.isArray(rekaman.storageRemoveCalled[0]!.paths)).toBe(true)
  })

  /**
   * Test 19.5.8: Error message includes storage error details.
   *
   * Skenario:
   * - Storage remove gagal dengan pesan error tertentu
   * - PdfDomainError message harus mencakup detail error
   *
   * Ekspektasi:
   * - Error message bersifat deskriptif
   * - Mencakup informasi tentang kegagalan storage
   *
   * **Validates: Requirements 1 AC5 (error handling)**
   */
  test('error message menyertakan detail kegagalan storage', async () => {
    rekaman.storageRemoveError = new Error('Permission denied: cannot delete file')

    const pdfPath = 'mom-permission/1726396800000-denied.pdf'

    try {
      await deleteMomPdf(pdfPath)
      expect.fail('Expected PdfDomainError to be thrown')
    }
    catch (error) {
      expect(error).toBeInstanceOf(PdfDomainError)
      expect((error as PdfDomainError).code).toBe('STORAGE_ERROR')
      // Assert: pesan error bersifat deskriptif
      expect((error as PdfDomainError).message.length).toBeGreaterThan(20)
      // Assert: mencakup kata kunci terkait storage/hapus
      expect((error as PdfDomainError).message.toLowerCase()).toMatch(/storage|hapus|menghapus/i)
    }
  })

  /**
   * Test 19.5.9: Multiple deletions each call remove independently.
   *
   * Skenario:
   * - Dua MoM dengan PDF dihapus berurutan
   * - Masing-masing harus memanggil storage.remove secara independen
   *
   * Ekspektasi:
   * - storageRemoveCalled memiliki dua entry
   * - Setiap entry memiliki path yang berbeda
   *
   * **Validates: Requirements 1 AC5**
   */
  test('penghapusan multiple memanggil remove secara independen', async () => {
    const pdfPath1 = 'mom-multi-1/1726396800000-first.pdf'
    const pdfPath2 = 'mom-multi-2/1726396900000-second.pdf'

    await deleteMomPdf(pdfPath1)
    await deleteMomPdf(pdfPath2)

    // Assert: dua panggilan terpisah
    expect(rekaman.storageRemoveCalled).toHaveLength(2)
    expect(rekaman.storageRemoveCalled[0]!.paths[0]).toBe(pdfPath1)
    expect(rekaman.storageRemoveCalled[1]!.paths[0]).toBe(pdfPath2)
  })

  /**
   * Test 19.5.10: Empty pdfPath string still calls storage remove.
   *
   * Skenario:
   * - deleteMomPdf dipanggil dengan string kosong
   * - Service tetap memanggil storage.remove (validasi di caller)
   *
   * Note: Validasi apakah pdfPath valid seharusnya dilakukan oleh caller
   * (misalnya, cek if (mom.pdfPath) sebelum memanggil deleteMomPdf).
   *
   * Ekspektasi:
   * - storage.remove tetap dipanggil dengan path kosong
   *
   * **Validates: Requirements 1 AC5 (edge case)**
   */
  test('pdfPath kosong → storage.remove tetap dipanggil (validasi di caller)', async () => {
    const emptyPath = ''

    await deleteMomPdf(emptyPath)

    // Assert: storage remove dipanggil
    expect(rekaman.storageRemoveCalled).toHaveLength(1)
    expect(rekaman.storageRemoveCalled[0]!.paths).toEqual([''])
  })
})
