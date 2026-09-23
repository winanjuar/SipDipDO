/**
 * PRICING — pdf.service: logika bisnis upload PDF MoM (Req-1, Story 2.2).
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts):
 *
 *   uploadMomPdf(db, momId, file, fileName, mimeType, actorOwnerId)
 *     — upload PDF ke Supabase Storage bucket privat, update pdf_path di MoM,
 *       dan catat audit entry `mom-pdf-uploaded` dalam satu transaksi (AD-3).
 *   generateSignedUrl(momId, userRole)
 *     — generate Signed URL dengan masa berlaku 15 menit untuk akses PDF (Req-2).
 *
 * Invariants (Story 2.2 Boundaries):
 * - File wajib bertipe application/pdf dengan ukuran maksimal 10MB (Req-1 AC6).
 * - Upload dan update pdf_path dalam satu transaksi dengan audit entry (AD-3).
 * - Akses PDF hanya melalui Signed URL dengan expiry 15 menit (Req-2 AC1).
 * - MoM harus ada untuk upload; throw error bila tidak ditemukan.
 */
import type { Db, DbClient } from '../../utils/db'
import { useSupabaseStorage } from '../../utils/storage'
import { writeAuditEntry } from '../audit'
import { findMomById, updateMomPdfPath } from './mom.repo'
import {
  MOM_PDF_ALLOWED_MIME_TYPES,
  MOM_PDF_BUCKET,
  MOM_PDF_MAX_SIZE_BYTES,
  MOM_PDF_SIGNED_URL_EXPIRY_SECONDS,
  type MomWire,
} from '#shared/domain/mom'

/** Error domain untuk aksi PDF MoM — memudahkan handler membedakan jenis error. */
export class PdfDomainError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'VALIDATION' | 'STORAGE_ERROR',
  ) {
    super(message)
    this.name = 'PdfDomainError'
  }
}

/**
 * Validasi MIME type file — harus application/pdf (Req-1 AC6).
 */
function validateMimeType(mimeType: string): void {
  if (!MOM_PDF_ALLOWED_MIME_TYPES.includes(mimeType as typeof MOM_PDF_ALLOWED_MIME_TYPES[number])) {
    throw new PdfDomainError(
      `Tipe file tidak valid — hanya ${MOM_PDF_ALLOWED_MIME_TYPES.join(', ')} yang diizinkan.`,
      'VALIDATION',
    )
  }
}

/**
 * Validasi ukuran file — maksimal 10MB (Req-1 AC6).
 */
function validateFileSize(file: Buffer): void {
  if (file.length > MOM_PDF_MAX_SIZE_BYTES) {
    const maxMB = MOM_PDF_MAX_SIZE_BYTES / (1024 * 1024)
    throw new PdfDomainError(
      `Ukuran file melebihi batas maksimal ${maxMB}MB.`,
      'VALIDATION',
    )
  }
}

/**
 * Generate path unik untuk file PDF di storage.
 * Format: {momId}/{timestamp}-{sanitizedFileName}
 */
function generateStoragePath(momId: string, fileName: string): string {
  const timestamp = Date.now()
  // Sanitize filename — hapus karakter yang tidak aman
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
  return `${momId}/${timestamp}-${sanitized}`
}

/**
 * Upload PDF MoM ke Supabase Storage bucket privat (Req-1 AC1).
 *
 * Alur:
 * 1. Validasi MIME type (application/pdf) dan ukuran (≤10MB)
 * 2. Cek MoM ada di database
 * 3. Upload file ke Supabase Storage
 * 4. Update pdf_path di MoM
 * 5. Catat audit entry `mom-pdf-uploaded`
 *
 * @param db - Database handle untuk transaksi
 * @param momId - ID MoM yang akan ditautkan PDF
 * @param file - Buffer file PDF
 * @param fileName - Nama file asli
 * @param mimeType - MIME type file
 * @param actorOwnerId - ID owner yang melakukan upload (COO)
 * @returns MomWire yang sudah diupdate dengan pdf_path
 * @throws PdfDomainError bila validasi gagal, MoM tidak ditemukan, atau storage error
 */
export async function uploadMomPdf(
  db: Db,
  momId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  actorOwnerId: string,
): Promise<MomWire> {
  // 1. Validasi input
  validateMimeType(mimeType)
  validateFileSize(file)

  // 2-5. Dalam transaksi: cek MoM, upload, update path, audit
  return db.transaction(async (tx) => {
    // 2. Cek MoM ada
    const existing = await findMomById(tx, momId)
    if (!existing) {
      throw new PdfDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }

    // 3. Upload ke Supabase Storage
    const storagePath = generateStoragePath(momId, fileName)
    const supabase = useSupabaseStorage()

    const { error: uploadError } = await supabase.storage
      .from(MOM_PDF_BUCKET)
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false, // Jangan overwrite bila path sudah ada
      })

    if (uploadError) {
      // Bila file sudah ada, coba dengan upsert
      if (uploadError.message?.includes('already exists') || uploadError.message?.includes('Duplicate')) {
        const { error: upsertError } = await supabase.storage
          .from(MOM_PDF_BUCKET)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: true,
          })
        if (upsertError) {
          throw new PdfDomainError(
            `Gagal mengunggah file ke storage: ${upsertError.message}`,
            'STORAGE_ERROR',
          )
        }
      }
      else {
        throw new PdfDomainError(
          `Gagal mengunggah file ke storage: ${uploadError.message}`,
          'STORAGE_ERROR',
        )
      }
    }

    // 4. Update pdf_path di MoM
    const updated = await updateMomPdfPath(tx, momId, storagePath)
    if (!updated) {
      // Rollback: hapus file yang sudah diupload
      await supabase.storage.from(MOM_PDF_BUCKET).remove([storagePath])
      throw new PdfDomainError('Gagal memperbarui MoM.', 'NOT_FOUND')
    }

    // 5. Catat audit entry (AD-3)
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-pdf-uploaded',
      target: `moms:${momId}`,
      details: {
        mom_id: momId,
        file_size: file.length,
        original_filename: fileName,
        storage_path: storagePath,
      },
    })

    return updated
  })
}

/**
 * Generate Signed URL untuk akses PDF MoM dengan masa berlaku 15 menit (Req-2 AC1).
 *
 * @param db - Database client untuk membaca MoM
 * @param momId - ID MoM
 * @returns Object dengan url dan expiresAt
 * @throws PdfDomainError bila MoM tidak ditemukan atau tidak punya PDF
 */
export async function generateSignedUrl(
  db: DbClient,
  momId: string,
): Promise<{ url: string, expiresAt: string }> {
  // Cek MoM ada dan punya PDF
  const mom = await findMomById(db, momId)
  if (!mom) {
    throw new PdfDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
  }
  if (!mom.pdfPath) {
    throw new PdfDomainError('MoM tidak memiliki file PDF.', 'NOT_FOUND')
  }

  const supabase = useSupabaseStorage()

  const { data, error } = await supabase.storage
    .from(MOM_PDF_BUCKET)
    .createSignedUrl(mom.pdfPath, MOM_PDF_SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    throw new PdfDomainError(
      `Gagal membuat signed URL: ${error?.message ?? 'Unknown error'}`,
      'STORAGE_ERROR',
    )
  }

  // Hitung waktu kedaluwarsa
  const expiresAt = new Date(Date.now() + MOM_PDF_SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString()

  return {
    url: data.signedUrl,
    expiresAt,
  }
}

/**
 * Hapus file PDF dari storage — dipanggil saat MoM draft dihapus (Req-1 AC5).
 *
 * @param pdfPath - Path file di storage
 * @throws PdfDomainError bila gagal menghapus
 */
export async function deleteMomPdf(pdfPath: string): Promise<void> {
  const supabase = useSupabaseStorage()

  const { error } = await supabase.storage
    .from(MOM_PDF_BUCKET)
    .remove([pdfPath])

  if (error) {
    throw new PdfDomainError(
      `Gagal menghapus file dari storage: ${error.message}`,
      'STORAGE_ERROR',
    )
  }
}
