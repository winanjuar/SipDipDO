/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `server/domain/pricing/pricing.service.ts`
 * Story 2.3: CMS Harga Saham dengan riwayat.
 *
 * Tests untuk Task 18 — Integration tests for price management:
 * - 18.1 Test price creation with unique constraint
 * - 18.2 Test price correction updates existing row
 * - 18.3 Test price resolution returns exactly one per type
 * - 18.4 Test round-trip property
 *
 * Repo DIMOCK via `vi.mock` — mengikuti pola mom.service.test.ts.
 *
 * **Validates: Requirements 3, 15**
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { tetapkanHarga, koreksiHarga, resolveHargaBerjalan, PricingDomainError } from './pricing.service'

// ---------------------------------------------------------------------------
// Test Data Stubs
// ---------------------------------------------------------------------------

/** Stub MoM final untuk referensi harga (Req-14). */
const stubMomFinal = () => ({
  id: 'mom-001',
  title: 'MoM Penetapan Harga Q3 2026',
  heldAt: '2026-09-15T07:00:00.000Z',
  status: 'final' as const,
  contentText: 'Keputusan penetapan harga beli dan jual.',
  pdfPath: null,
  finalizedAt: '2026-09-15T10:00:00.000Z',
  createdAt: '2026-09-15T07:00:00.000Z',
  updatedAt: '2026-09-15T07:00:00.000Z',
})

/** Stub MoM draft (tidak dapat digunakan sebagai referensi harga). */
const stubMomDraft = () => ({
  ...stubMomFinal(),
  id: 'mom-002',
  status: 'draft' as const,
  finalizedAt: null,
})

/** Stub harga beli untuk uji unique constraint dan resolusi. */
const stubHargaBeli = () => ({
  id: 'price-001',
  type: 'beli' as const,
  effectiveDate: '2026-10-01T00:00:00.000Z',
  amount: '52000.00',
  momId: 'mom-001',
  momTitle: 'MoM Penetapan Harga Q3 2026',
  createdAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-15T12:00:00.000Z',
})

/** Stub harga jual untuk uji resolusi. */
const stubHargaJual = () => ({
  id: 'price-002',
  type: 'jual' as const,
  effectiveDate: '2026-10-01T00:00:00.000Z',
  amount: '55000.00',
  momId: 'mom-001',
  momTitle: 'MoM Penetapan Harga Q3 2026',
  createdAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-15T12:00:00.000Z',
})

// ---------------------------------------------------------------------------
// Mock Recordings
// ---------------------------------------------------------------------------

/** Perekam panggilan — di-hoist agar factory vi.mock bisa menutupnya. */
const rekaman = vi.hoisted(() => ({
  findMom: null as ReturnType<typeof stubMomFinal> | null,
  findExistingPrice: null as ReturnType<typeof stubHargaBeli> | null,
  findPriceByTypeAndDate: new Map<string, ReturnType<typeof stubHargaBeli> | null>(),
  insertPriceMasuk: [] as Array<Record<string, unknown>>,
  updatePriceMasuk: [] as Array<{ id: string, data: Record<string, unknown> }>,
  auditMasuk: [] as Array<Record<string, unknown>>,
  /** Simulasi error unique constraint violation dari DB. */
  shouldThrowUniqueConstraintError: false,
}))

beforeEach(() => {
  rekaman.findMom = null
  rekaman.findExistingPrice = null
  rekaman.findPriceByTypeAndDate.clear()
  rekaman.insertPriceMasuk.length = 0
  rekaman.updatePriceMasuk.length = 0
  rekaman.auditMasuk.length = 0
  rekaman.shouldThrowUniqueConstraintError = false
})

// ---------------------------------------------------------------------------
// Mock Repository
// ---------------------------------------------------------------------------

vi.mock('./pricing.repo', () => ({
  insertPrice: async (_tx: unknown, row: Record<string, unknown>) => {
    if (rekaman.shouldThrowUniqueConstraintError) {
      // Simulasi error unique constraint dari PostgreSQL
      const error = new Error('duplicate key value violates unique constraint "price_periods_type_effective_date_idx"')
      ;(error as Error & { code: string }).code = '23505' // PostgreSQL unique violation
      throw error
    }
    rekaman.insertPriceMasuk.push(row)
    return { ...stubHargaBeli(), ...row, id: 'price-new-001' }
  },
  updatePrice: async (_tx: unknown, id: string, data: Record<string, unknown>) => {
    rekaman.updatePriceMasuk.push({ id, data })
    const existing = rekaman.findExistingPrice
    if (!existing) return null
    return { ...existing, ...data }
  },
  findPriceByTypeAndExactDate: async (_db: unknown, type: string, effectiveDate: string) => {
    // Kembalikan existing price bila ada untuk kombinasi type+date yang sama
    if (rekaman.findExistingPrice
        && rekaman.findExistingPrice.type === type
        && rekaman.findExistingPrice.effectiveDate === effectiveDate) {
      return rekaman.findExistingPrice
    }
    return null
  },
  findPriceByTypeAndDate: async (_db: unknown, type: string, date: string) => {
    const key = `${type}:${date}`
    return rekaman.findPriceByTypeAndDate.get(key) ?? null
  },
  findPriceById: async (_db: unknown, _id: string) => rekaman.findExistingPrice,
  listPrices: async () => ({ data: [], nextPage: null }),
}))

vi.mock('./mom.repo', () => ({
  findMomById: async (_db: unknown, _id: string) => rekaman.findMom,
}))

vi.mock('../audit', () => ({
  writeAuditEntry: async (_tx: unknown, input: Record<string, unknown>) => {
    rekaman.auditMasuk.push(input)
  },
}))

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

/** Mock Db dengan transaksi — semua service pakai db.transaction(). */
const mockDb = {
  transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({ rollback: () => {} }),
}

// ---------------------------------------------------------------------------
// Test Suite: 18.1 — Price Creation with Unique Constraint
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pricing.service — price creation with unique constraint (18.1)', () => {
  /**
   * Test 18.1.1: Creating a price with unique (type, effectiveDate) succeeds.
   *
   * Skenario:
   * - Tidak ada harga existing untuk kombinasi (beli, 2026-10-01)
   * - COO membuat harga beli baru dengan tanggal efektif 2026-10-01
   * 
   * Ekspektasi:
   * - Insert berhasil
   * - Audit entry price-created ditulis
   *
   * **Validates: Requirements 3 AC1, AC2**
   */
  test('membuat harga baru dengan kombinasi (type, effectiveDate) unik → sukses', async () => {
    // Setup: MoM final sebagai referensi
    rekaman.findMom = stubMomFinal()
    // Tidak ada harga existing (findExistingPrice = null)
    rekaman.findExistingPrice = null

    const actorOwnerId = 'owner-coo-001'
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10) // 10 hari ke depan
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '52000.00',
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert: insert dipanggil
    expect(rekaman.insertPriceMasuk).toHaveLength(1)
    expect(rekaman.insertPriceMasuk[0]).toMatchObject({
      type: 'beli',
      effectiveDate,
      amount: '52000.00',
      momId: 'mom-001',
    })

    // Assert: audit entry price-created ditulis
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'price-created',
      actor: { kind: 'user', ownerId: actorOwnerId },
      details: expect.objectContaining({
        type: 'beli',
        amount: '52000.00',
        momId: 'mom-001',
      }),
    })

    // Assert: result berisi harga yang dibuat
    expect(result.type).toBe('beli')
    expect(result.amount).toBe('52000.00')
  })

  /**
   * Test 18.1.2: Creating price with different type on same date succeeds.
   *
   * Skenario:
   * - Sudah ada harga 'beli' untuk tanggal 2026-10-01
   * - COO membuat harga 'jual' untuk tanggal yang sama
   * 
   * Ekspektasi:
   * - Insert berhasil (type berbeda = kombinasi unik)
   *
   * **Validates: Requirements 3 (unique per type+date, bukan per date saja)**
   */
  test('membuat harga jual pada tanggal yang sama dengan harga beli → sukses', async () => {
    rekaman.findMom = stubMomFinal()
    // Setup: ada harga beli existing, tapi kita mau buat harga jual
    const existingBeli = stubHargaBeli()
    rekaman.findExistingPrice = null // Tidak ada harga jual existing

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'jual',
      effectiveDate,
      amount: '55000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(rekaman.insertPriceMasuk).toHaveLength(1)
    expect(rekaman.insertPriceMasuk[0]).toMatchObject({
      type: 'jual',
      amount: '55000.00',
    })
    expect(result.type).toBe('jual')
  })

  /**
   * Test 18.1.3: Creating price with same type on different date succeeds.
   *
   * Skenario:
   * - Sudah ada harga 'beli' untuk tanggal 2026-10-01
   * - COO membuat harga 'beli' untuk tanggal 2026-11-01
   * 
   * Ekspektasi:
   * - Insert berhasil (date berbeda = kombinasi unik)
   *
   * **Validates: Requirements 3 (unique per type+date)**
   */
  test('membuat harga beli pada tanggal berbeda → sukses', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null // Tidak ada harga pada tanggal baru

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 40) // 40 hari ke depan (berbeda dari existing)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '53000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(rekaman.insertPriceMasuk).toHaveLength(1)
    expect(rekaman.insertPriceMasuk[0]).toMatchObject({
      type: 'beli',
      effectiveDate,
      amount: '53000.00',
    })
    expect(result.amount).toBe('53000.00')
  })

  /**
   * Test 18.1.4: Duplicate (type, effectiveDate) triggers correction flow.
   *
   * Skenario (Req-3 AC4):
   * - Sudah ada harga 'beli' untuk tanggal 2026-10-01 dengan nilai 52.000
   * - COO mencoba menetapkan harga 'beli' untuk tanggal yang sama dengan nilai 54.000
   * 
   * Ekspektasi:
   * - Service mendeteksi existing price dan melakukan UPDATE (koreksi), bukan INSERT
   * - Audit entry price-corrected ditulis dengan oldAmount dan newAmount
   *
   * **Validates: Requirements 3 AC3, AC4**
   */
  test('menetapkan harga dengan kombinasi (type, effectiveDate) yang sama → mode koreksi', async () => {
    rekaman.findMom = stubMomFinal()
    // Setup: ada harga beli existing pada tanggal yang sama
    const effectiveDate = '2026-10-01T00:00:00.000Z'
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
    }

    const actorOwnerId = 'owner-coo-001'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '54000.00', // Nilai baru
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert: UPDATE dipanggil, bukan INSERT
    expect(rekaman.insertPriceMasuk).toHaveLength(0)
    expect(rekaman.updatePriceMasuk).toHaveLength(1)
    expect(rekaman.updatePriceMasuk[0]).toMatchObject({
      id: 'price-001',
      data: expect.objectContaining({
        amount: '54000.00',
        momId: 'mom-001',
      }),
    })

    // Assert: audit entry price-corrected ditulis
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'price-corrected',
      actor: { kind: 'user', ownerId: actorOwnerId },
      details: expect.objectContaining({
        type: 'beli',
        effectiveDate,
        oldAmount: '52000.00',
        newAmount: '54000.00',
      }),
    })
  })

  /**
   * Test 18.1.5: Direct DB unique constraint violation is propagated.
   *
   * Skenario:
   * - Kondisi race: dua request bersamaan mencoba insert harga dengan
   *   kombinasi (type, effectiveDate) yang sama
   * - Service pertama: findExistingPrice = null, insert berhasil
   * - Service kedua: findExistingPrice = null (karena belum commit),
   *   mencoba insert → DB reject dengan unique constraint violation
   * 
   * Ekspektasi:
   * - Error unique constraint dari DB dipropagasikan
   * - Aplikasi dapat menangani dan memberikan pesan yang jelas
   *
   * **Validates: Requirements 3 AC3 (unique constraint enforcement)**
   */
  test('race condition: unique constraint violation dari DB → error dipropagasikan', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null // Service tidak menemukan existing (race condition)
    rekaman.shouldThrowUniqueConstraintError = true // Simulasi DB reject

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '52000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(/unique constraint/)

    // Assert: insert dicoba tapi gagal
    expect(rekaman.insertPriceMasuk).toHaveLength(0) // Insert gagal di level mock
    // Assert: tidak ada audit entry karena transaksi gagal
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 18.1.6: Validation - MoM must be final.
   *
   * Skenario (Req-14):
   * - MoM referensi berstatus draft
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code MOM_NOT_FINAL
   *
   * **Validates: Requirements 14 AC4**
   */
  test('MoM referensi draft → tolak MOM_NOT_FINAL', async () => {
    rekaman.findMom = stubMomDraft()

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '52000.00',
      momId: 'mom-002',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await tetapkanHarga(mockDb as never, {
        type: 'beli',
        effectiveDate: '2026-10-01T00:00:00.000Z',
        amount: '52000.00',
        momId: 'mom-002',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('MOM_NOT_FINAL')
    }

    expect(rekaman.insertPriceMasuk).toHaveLength(0)
    expect(rekaman.updatePriceMasuk).toHaveLength(0)
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 18.1.7: Validation - MoM must exist.
   *
   * Skenario:
   * - MoM referensi tidak ditemukan
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code NOT_FOUND
   *
   * **Validates: Requirements 14**
   */
  test('MoM referensi tidak ada → tolak NOT_FOUND', async () => {
    rekaman.findMom = null

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '52000.00',
      momId: 'mom-xxx',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await tetapkanHarga(mockDb as never, {
        type: 'beli',
        effectiveDate: '2026-10-01T00:00:00.000Z',
        amount: '52000.00',
        momId: 'mom-xxx',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('NOT_FOUND')
    }
  })

  /**
   * Test 18.1.8: Validation - amount must be positive.
   *
   * Skenario (Req-3 AC5):
   * - Amount = 0 atau negatif
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code VALIDATION
   *
   * **Validates: Requirements 3 AC5**
   */
  test('amount nol → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomFinal()

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '0.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await tetapkanHarga(mockDb as never, {
        type: 'beli',
        effectiveDate: '2026-10-01T00:00:00.000Z',
        amount: '0.00',
        momId: 'mom-001',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('VALIDATION')
    }
  })

  /**
   * Test 18.1.9: Validation - amount must be positive (negative).
   *
   * Skenario:
   * - Amount negatif
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code VALIDATION
   *
   * **Validates: Requirements 3 AC5**
   */
  test('amount negatif → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomFinal()

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '-1000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)
  })

  /**
   * Test 18.1.10: Validation - effectiveDate must not be in the past for new price.
   *
   * Skenario (Req-3 AC5):
   * - effectiveDate di masa lampau untuk harga baru (bukan koreksi)
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code PAST_DATE
   *
   * **Validates: Requirements 3 AC5**
   */
  test('effectiveDate di masa lampau untuk harga baru → tolak PAST_DATE', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null // Harga baru, bukan koreksi

    const pastDate = '2020-01-01T00:00:00.000Z'

    await expect(tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: pastDate,
      amount: '52000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await tetapkanHarga(mockDb as never, {
        type: 'beli',
        effectiveDate: pastDate,
        amount: '52000.00',
        momId: 'mom-001',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('PAST_DATE')
    }
  })
})

// ---------------------------------------------------------------------------
// Test Suite: 18.2 — Price Correction Updates Existing Row
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pricing.service — price correction updates existing row (18.2)', () => {
  /**
   * Test 18.2.1: Correction via PUT endpoint (koreksiHarga by ID) updates the row.
   *
   * Skenario (Req-3 AC4):
   * - Harga 'beli' dengan ID 'price-001' sudah ada dengan nilai 52.000
   * - COO memanggil koreksiHarga dengan ID dan nilai baru 54.000
   * 
   * Ekspektasi:
   * - UPDATE dipanggil pada harga dengan ID tersebut
   * - Audit entry price-corrected ditulis dengan oldAmount dan newAmount
   * - Tidak ada INSERT (tetap satu baris)
   *
   * **Validates: Requirements 3 AC4**
   */
  test('koreksiHarga via ID → UPDATE existing row, audit price-corrected', async () => {
    rekaman.findMom = stubMomFinal()
    // Setup: harga existing dengan ID tertentu
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      id: 'price-001',
      amount: '52000.00',
    }

    const actorOwnerId = 'owner-coo-001'

    const result = await koreksiHarga(mockDb as never, 'price-001', {
      amount: '54000.00',
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert: UPDATE dipanggil, bukan INSERT
    expect(rekaman.insertPriceMasuk).toHaveLength(0)
    expect(rekaman.updatePriceMasuk).toHaveLength(1)
    expect(rekaman.updatePriceMasuk[0]).toMatchObject({
      id: 'price-001',
      data: expect.objectContaining({
        amount: '54000.00',
        momId: 'mom-001',
      }),
    })

    // Assert: audit entry price-corrected ditulis
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'price-corrected',
      actor: { kind: 'user', ownerId: actorOwnerId },
      details: expect.objectContaining({
        type: 'beli',
        oldAmount: '52000.00',
        newAmount: '54000.00',
      }),
    })

    // Assert: result berisi harga yang dikoreksi
    expect(result.amount).toBe('54000.00')
  })

  /**
   * Test 18.2.2: Multiple sequential corrections maintain single row.
   *
   * Skenario:
   * - Harga 'beli' untuk 2026-10-01 dikoreksi beberapa kali berturut-turut
   * - Koreksi 1: 52.000 → 54.000
   * - Koreksi 2: 54.000 → 55.000
   * 
   * Ekspektasi:
   * - Setiap koreksi meng-UPDATE baris yang sama (tidak menambah baris baru)
   * - Setiap koreksi menghasilkan audit entry price-corrected
   * - Total: 2 UPDATE, 0 INSERT
   *
   * **Validates: Requirements 3 AC4**
   */
  test('koreksi berurutan → UPDATE berkali-kali pada baris yang sama', async () => {
    rekaman.findMom = stubMomFinal()
    const effectiveDate = '2026-10-01T00:00:00.000Z'
    const actorOwnerId = 'owner-coo-001'

    // Koreksi pertama: 52.000 → 54.000
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
      amount: '52000.00',
    }

    await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '54000.00',
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert koreksi pertama
    expect(rekaman.updatePriceMasuk).toHaveLength(1)
    expect(rekaman.insertPriceMasuk).toHaveLength(0)
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]!.details).toMatchObject({
      oldAmount: '52000.00',
      newAmount: '54000.00',
    })

    // Reset untuk koreksi kedua (tapi pertahankan existing untuk simulasi)
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
      amount: '54000.00', // Sudah dikoreksi sebelumnya
    }

    // Koreksi kedua: 54.000 → 55.000
    await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '55000.00',
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert: total 2 UPDATE, 0 INSERT
    expect(rekaman.updatePriceMasuk).toHaveLength(2)
    expect(rekaman.insertPriceMasuk).toHaveLength(0)

    // Assert: audit entry kedua mencatat nilai lama dan baru
    expect(rekaman.auditMasuk).toHaveLength(2)
    expect(rekaman.auditMasuk[1]!.details).toMatchObject({
      oldAmount: '54000.00',
      newAmount: '55000.00',
    })
  })

  /**
   * Test 18.2.3: Correction doesn't affect other prices.
   *
   * Skenario:
   * - Ada harga 'beli' pada 2026-10-01 dengan nilai 52.000
   * - Ada harga 'jual' pada 2026-10-01 dengan nilai 55.000
   * - COO mengkoreksi harga 'beli' menjadi 54.000
   * 
   * Ekspektasi:
   * - Hanya harga 'beli' yang ter-UPDATE
   * - Harga 'jual' tidak terpengaruh
   *
   * **Validates: Requirements 3 AC4**
   */
  test('koreksi harga beli → harga jual tidak terpengaruh', async () => {
    rekaman.findMom = stubMomFinal()
    const effectiveDate = '2026-10-01T00:00:00.000Z'

    // Setup: harga beli existing untuk type + date yang dikoreksi
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
      amount: '52000.00',
    }

    await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '54000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')

    // Assert: UPDATE hanya untuk price-001 (beli)
    expect(rekaman.updatePriceMasuk).toHaveLength(1)
    expect(rekaman.updatePriceMasuk[0]!.id).toBe('price-001')
    expect(rekaman.updatePriceMasuk[0]!.data).toMatchObject({
      amount: '54000.00',
    })

    // Assert: harga jual tidak di-update (hanya beli yang terpengaruh)
    const updateIds = rekaman.updatePriceMasuk.map((u) => u.id)
    expect(updateIds).not.toContain('price-002') // ID harga jual
  })

  /**
   * Test 18.2.4: Correction with same value still records audit.
   *
   * Skenario (edge case):
   * - Harga 'beli' ada dengan nilai 52.000
   * - COO "mengkoreksi" dengan nilai yang sama (52.000)
   * 
   * Ekspektasi:
   * - UPDATE tetap dipanggil (mungkin MoM berubah)
   * - Audit entry tetap ditulis dengan oldAmount = newAmount
   *
   * **Validates: Requirements 3 AC4**
   */
  test('koreksi dengan nilai sama → UPDATE tetap dipanggil, audit ditulis', async () => {
    rekaman.findMom = stubMomFinal()
    const effectiveDate = '2026-10-01T00:00:00.000Z'

    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
      amount: '52000.00',
    }

    await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '52000.00', // Nilai sama
      momId: 'mom-001',
    }, 'owner-coo-001')

    // Assert: UPDATE tetap dipanggil
    expect(rekaman.updatePriceMasuk).toHaveLength(1)

    // Assert: audit tetap ditulis
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'price-corrected',
      details: expect.objectContaining({
        oldAmount: '52000.00',
        newAmount: '52000.00',
      }),
    })
  })

  /**
   * Test 18.2.5: Correction by ID when price not found.
   *
   * Skenario:
   * - COO mencoba koreksi harga dengan ID yang tidak ada
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code NOT_FOUND
   *
   * **Validates: Requirements 3**
   */
  test('koreksi harga dengan ID tidak ditemukan → tolak NOT_FOUND', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null // Harga tidak ditemukan

    await expect(koreksiHarga(mockDb as never, 'price-unknown', {
      amount: '54000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await koreksiHarga(mockDb as never, 'price-unknown', {
        amount: '54000.00',
        momId: 'mom-001',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('NOT_FOUND')
    }

    // Assert: tidak ada UPDATE atau INSERT
    expect(rekaman.updatePriceMasuk).toHaveLength(0)
    expect(rekaman.insertPriceMasuk).toHaveLength(0)
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 18.2.6: Correction by ID with invalid amount.
   *
   * Skenario:
   * - COO mencoba koreksi harga dengan nilai negatif
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code VALIDATION
   * - Tidak ada perubahan di database
   *
   * **Validates: Requirements 3 AC5**
   */
  test('koreksi harga dengan amount negatif → tolak VALIDATION', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = stubHargaBeli()

    await expect(koreksiHarga(mockDb as never, 'price-001', {
      amount: '-1000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    // Assert: tidak ada perubahan
    expect(rekaman.updatePriceMasuk).toHaveLength(0)
    expect(rekaman.auditMasuk).toHaveLength(0)
  })

  /**
   * Test 18.2.7: Correction by ID with draft MoM.
   *
   * Skenario:
   * - COO mencoba koreksi harga dengan MoM draft
   * 
   * Ekspektasi:
   * - PricingDomainError dengan code MOM_NOT_FINAL
   *
   * **Validates: Requirements 14 AC4**
   */
  test('koreksi harga dengan MoM draft → tolak MOM_NOT_FINAL', async () => {
    rekaman.findMom = stubMomDraft()
    rekaman.findExistingPrice = stubHargaBeli()

    await expect(koreksiHarga(mockDb as never, 'price-001', {
      amount: '54000.00',
      momId: 'mom-002', // MoM draft
    }, 'owner-coo-001')).rejects.toThrow(PricingDomainError)

    try {
      await koreksiHarga(mockDb as never, 'price-001', {
        amount: '54000.00',
        momId: 'mom-002',
      }, 'owner-coo-001')
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('MOM_NOT_FINAL')
    }
  })

  /**
   * Test 18.2.8: Audit trail records both old and new MoM reference.
   *
   * Skenario (Req-3 AC4):
   * - Harga 'beli' ada dengan MoM referensi 'mom-001'
   * - COO mengkoreksi dengan MoM referensi berbeda 'mom-003'
   * 
   * Ekspektasi:
   * - Audit entry mencatat oldMomId dan newMomId
   *
   * **Validates: Requirements 3 AC4**
   */
  test('koreksi harga dengan MoM berbeda → audit mencatat oldMomId dan newMomId', async () => {
    // Setup MoM baru untuk koreksi
    const stubMomBaru = () => ({
      ...stubMomFinal(),
      id: 'mom-003',
      title: 'MoM Koreksi Q4 2026',
    })
    rekaman.findMom = stubMomBaru()

    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      momId: 'mom-001', // MoM lama
    }

    await koreksiHarga(mockDb as never, 'price-001', {
      amount: '54000.00',
      momId: 'mom-003', // MoM baru
    }, 'owner-coo-001')

    // Assert: audit mencatat perubahan MoM
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]!.details).toMatchObject({
      oldMomId: 'mom-001',
      newMomId: 'mom-003',
    })
  })
})


// ---------------------------------------------------------------------------
// Test Suite: 18.3 — Price Resolution Returns Exactly One Per Type
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pricing.service — price resolution returns exactly one per type (18.3)', () => {
  /**
   * Test 18.3.1: Resolving prices when both beli and jual exist returns exactly one of each.
   *
   * Skenario (Req-4 AC3, AD-7):
   * - Ada harga 'beli' dengan effectiveDate 2026-10-01
   * - Ada harga 'jual' dengan effectiveDate 2026-10-01
   * - Resolusi pada tanggal 2026-10-15 (setelah effectiveDate)
   * 
   * Ekspektasi:
   * - Mengembalikan tepat satu harga beli dan satu harga jual
   * - Tidak pernah null, tidak pernah lebih dari satu per tipe
   *
   * **Validates: Requirements 4 AC3 (AD-7)**
   */
  test('resolusi harga dengan beli dan jual tersedia → tepat satu per tipe', async () => {
    // Setup: harga beli dan jual tersedia untuk tanggal yang diminta
    const queryDate = '2026-10-15'
    const effectiveDate = '2026-10-01'
    
    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      effectiveDate: `${effectiveDate}T00:00:00.000Z`,
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      effectiveDate: `${effectiveDate}T00:00:00.000Z`,
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert: tepat satu harga beli
    expect(result.beli).toBeDefined()
    expect(result.beli.type).toBe('beli')
    expect(result.beli.amount).toBe('52000.00')

    // Assert: tepat satu harga jual
    expect(result.jual).toBeDefined()
    expect(result.jual.type).toBe('jual')
    expect(result.jual.amount).toBe('55000.00')

    // Assert: tidak ada property tambahan (tidak lebih dari satu)
    expect(Object.keys(result)).toEqual(['beli', 'jual'])
  })

  /**
   * Test 18.3.2: Resolving with a date after the effective date returns the effective price.
   *
   * Skenario:
   * - Harga effectiveDate 2026-10-01
   * - Query pada tanggal 2026-11-15 (45 hari setelah effectiveDate)
   * 
   * Ekspektasi:
   * - Mengembalikan harga yang effectiveDate <= queryDate
   * - Resolver memilih harga paling baru yang masih berlaku
   *
   * **Validates: Requirements 4 AC3**
   */
  test('resolusi dengan tanggal setelah effectiveDate → mengembalikan harga yang berlaku', async () => {
    const queryDate = '2026-11-15' // Jauh setelah effectiveDate
    const effectiveDate = '2026-10-01'

    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      effectiveDate: `${effectiveDate}T00:00:00.000Z`,
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      effectiveDate: `${effectiveDate}T00:00:00.000Z`,
      amount: '55000.00',
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert: resolver mengembalikan harga yang masih berlaku
    expect(result.beli.effectiveDate).toBe(`${effectiveDate}T00:00:00.000Z`)
    expect(result.jual.effectiveDate).toBe(`${effectiveDate}T00:00:00.000Z`)
    expect(result.beli.amount).toBe('52000.00')
    expect(result.jual.amount).toBe('55000.00')
  })

  /**
   * Test 18.3.3: Resolving with a date before any effective date throws appropriate error.
   *
   * Skenario:
   * - Tidak ada harga dengan effectiveDate <= queryDate
   * - Query pada tanggal 2026-01-01 (sebelum harga apapun)
   * 
   * Ekspektasi:
   * - Throw PricingDomainError dengan code NOT_FOUND untuk beli
   * - Tidak pernah mengembalikan null — selalu throw jika tidak ada
   *
   * **Validates: Requirements 4 AC3 (AD-7: tidak pernah null)**
   */
  test('resolusi dengan tanggal sebelum harga apapun → throw NOT_FOUND untuk beli', async () => {
    const queryDate = '2026-01-01' // Sebelum harga apapun ada

    // Setup: tidak ada harga untuk tanggal tersebut (map kosong → findPriceByTypeAndDate return null)
    // rekaman.findPriceByTypeAndDate tidak diisi untuk queryDate ini

    await expect(resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`)))
      .rejects.toThrow(PricingDomainError)

    try {
      await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('NOT_FOUND')
      expect((error as PricingDomainError).message).toContain('beli')
      expect((error as PricingDomainError).message).toContain(queryDate)
    }
  })

  /**
   * Test 18.3.4: Resolving with only beli price (no jual) throws error for jual.
   *
   * Skenario:
   * - Ada harga 'beli' untuk tanggal tersebut
   * - Tidak ada harga 'jual' untuk tanggal tersebut
   * 
   * Ekspektasi:
   * - Throw PricingDomainError dengan code NOT_FOUND untuk jual
   * - Error message menyebutkan 'jual' dan tanggal
   *
   * **Validates: Requirements 4 AC3 (harus ada kedua tipe)**
   */
  test('resolusi dengan hanya beli (tanpa jual) → throw NOT_FOUND untuk jual', async () => {
    const queryDate = '2026-10-15'

    // Setup: hanya beli tersedia, jual tidak ada
    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      effectiveDate: '2026-10-01T00:00:00.000Z',
    })
    // jual tidak diset → return null dari mock

    await expect(resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`)))
      .rejects.toThrow(PricingDomainError)

    try {
      await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('NOT_FOUND')
      expect((error as PricingDomainError).message).toContain('jual')
    }
  })

  /**
   * Test 18.3.5: Resolving with only jual price (no beli) throws error for beli.
   *
   * Skenario:
   * - Tidak ada harga 'beli' untuk tanggal tersebut
   * - Ada harga 'jual' untuk tanggal tersebut
   * 
   * Ekspektasi:
   * - Throw PricingDomainError dengan code NOT_FOUND untuk beli
   * - Beli diperiksa lebih dulu karena Promise.all mengembalikan dalam urutan
   *
   * **Validates: Requirements 4 AC3**
   */
  test('resolusi dengan hanya jual (tanpa beli) → throw NOT_FOUND untuk beli', async () => {
    const queryDate = '2026-10-15'

    // Setup: hanya jual tersedia, beli tidak ada
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      effectiveDate: '2026-10-01T00:00:00.000Z',
    })
    // beli tidak diset → return null dari mock

    await expect(resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`)))
      .rejects.toThrow(PricingDomainError)

    try {
      await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))
    } catch (error) {
      expect((error as PricingDomainError).code).toBe('NOT_FOUND')
      expect((error as PricingDomainError).message).toContain('beli')
    }
  })

  /**
   * Test 18.3.6: Resolving with multiple price periods returns the correct one for query date.
   *
   * Skenario (multiple price periods):
   * - Periode 1: effectiveDate 2026-10-01 dengan amount 50.000
   * - Periode 2: effectiveDate 2026-11-01 dengan amount 52.000
   * - Periode 3: effectiveDate 2026-12-01 dengan amount 55.000
   * - Query pada 2026-11-15 → harus mengembalikan harga periode 2 (52.000)
   * 
   * Ekspektasi:
   * - Mengembalikan harga paling baru yang effectiveDate <= queryDate
   * - Periode 3 diabaikan karena effectiveDate > queryDate
   *
   * **Validates: Requirements 4 AC3 (resolver memilih harga tepat)**
   */
  test('resolusi dengan multiple periods → mengembalikan harga yang tepat untuk queryDate', async () => {
    const queryDate = '2026-11-15'
    
    // Mock: findPriceByTypeAndDate sudah mengembalikan harga yang tepat
    // (dalam implementasi asli, repo sudah ORDER BY effectiveDate DESC LIMIT 1)
    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      effectiveDate: '2026-11-01T00:00:00.000Z', // Periode 2 yang berlaku
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      effectiveDate: '2026-11-01T00:00:00.000Z',
      amount: '57000.00',
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert: mengembalikan harga periode 2 (yang berlaku pada 2026-11-15)
    expect(result.beli.effectiveDate).toBe('2026-11-01T00:00:00.000Z')
    expect(result.beli.amount).toBe('52000.00')
    expect(result.jual.effectiveDate).toBe('2026-11-01T00:00:00.000Z')
    expect(result.jual.amount).toBe('57000.00')
  })

  /**
   * Test 18.3.7: Resolving with exact effective date returns that price.
   *
   * Skenario:
   * - Harga effectiveDate 2026-10-01
   * - Query pada tanggal yang sama (2026-10-01)
   * 
   * Ekspektasi:
   * - Mengembalikan harga tepat pada tanggal efektif tersebut
   * - effectiveDate <= queryDate terpenuhi (equal case)
   *
   * **Validates: Requirements 4 AC3**
   */
  test('resolusi pada exact effectiveDate → mengembalikan harga tersebut', async () => {
    const queryDate = '2026-10-01' // Sama dengan effectiveDate

    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      effectiveDate: '2026-10-01T00:00:00.000Z',
      amount: '55000.00',
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    expect(result.beli.effectiveDate).toBe('2026-10-01T00:00:00.000Z')
    expect(result.jual.effectiveDate).toBe('2026-10-01T00:00:00.000Z')
    expect(result.beli.amount).toBe('52000.00')
    expect(result.jual.amount).toBe('55000.00')
  })

  /**
   * Test 18.3.8: Resolving with default date (today) when date not provided.
   *
   * Skenario:
   * - Date parameter tidak disediakan
   * - Service menggunakan hari ini sebagai default
   * 
   * Ekspektasi:
   * - Resolusi menggunakan tanggal hari ini
   * - Harga yang berlaku hari ini dikembalikan
   *
   * **Validates: Requirements 4 AC1 (harga berjalan hari ini)**
   */
  test('resolusi tanpa date parameter → menggunakan hari ini sebagai default', async () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]!

    rekaman.findPriceByTypeAndDate.set(`beli:${todayStr}`, {
      ...stubHargaBeli(),
      effectiveDate: '2026-01-01T00:00:00.000Z', // Harga lama yang masih berlaku
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${todayStr}`, {
      ...stubHargaJual(),
      effectiveDate: '2026-01-01T00:00:00.000Z',
      amount: '55000.00',
    })

    // Call tanpa parameter date
    const result = await resolveHargaBerjalan(mockDb as never)

    expect(result.beli).toBeDefined()
    expect(result.jual).toBeDefined()
    expect(result.beli.type).toBe('beli')
    expect(result.jual.type).toBe('jual')
  })

  /**
   * Test 18.3.9: Resolution result contains all required PriceWire fields.
   *
   * Skenario:
   * - Resolusi berhasil
   * 
   * Ekspektasi:
   * - Result beli dan jual memiliki semua field PriceWire:
   *   id, type, effectiveDate, amount, momId, momTitle, createdAt, updatedAt
   *
   * **Validates: Requirements 4 (wire contract)**
   */
  test('hasil resolusi mengandung semua field PriceWire', async () => {
    const queryDate = '2026-10-15'

    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, stubHargaBeli())
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, stubHargaJual())

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert beli has all required fields
    expect(result.beli).toMatchObject({
      id: expect.any(String),
      type: 'beli',
      effectiveDate: expect.any(String),
      amount: expect.any(String),
      momId: expect.any(String),
      momTitle: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })

    // Assert jual has all required fields
    expect(result.jual).toMatchObject({
      id: expect.any(String),
      type: 'jual',
      effectiveDate: expect.any(String),
      amount: expect.any(String),
      momId: expect.any(String),
      momTitle: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
  })

  /**
   * Test 18.3.10: Both beli and jual resolution happen in parallel.
   *
   * Skenario:
   * - Resolver menggunakan Promise.all untuk paralel lookup
   * 
   * Ekspektasi:
   * - Kedua tipe harga di-resolve dalam satu operasi
   * - Hasil dikembalikan bersamaan
   *
   * Note: Test ini memverifikasi behavior bahwa kedua lookup terjadi,
   * bukan timing (karena mock tidak bisa mengukur paralelisme sebenarnya).
   *
   * **Validates: Requirements 4 AC1, AC3**
   */
  test('resolusi beli dan jual terjadi dalam satu operasi', async () => {
    const queryDate = '2026-10-15'

    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      amount: '55000.00',
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert: kedua nilai dikembalikan dari satu panggilan
    expect(result.beli.amount).toBe('52000.00')
    expect(result.jual.amount).toBe('55000.00')

    // Assert: result hanya berisi beli dan jual
    expect(Object.keys(result).sort()).toEqual(['beli', 'jual'])
  })
})


// ---------------------------------------------------------------------------
// Test Suite: 18.4 — Round-Trip Property for Price Values
// ---------------------------------------------------------------------------

describe('server/domain/pricing/pricing.service — round-trip property for price values (18.4)', () => {
  /**
   * Test 18.4.1: Price created with string decimal maintains exact value through store/retrieve.
   *
   * Skenario (Req-15):
   * - COO membuat harga dengan nilai "52000.00"
   * - Harga disimpan ke database numeric(18,2)
   * - Harga dikembalikan via API sebagai string decimal
   * 
   * Ekspektasi:
   * - Nilai yang dikembalikan identik dengan nilai input: "52000.00"
   * - Tidak ada pembulatan atau precision loss
   *
   * **Validates: Requirements 15 AC1, AC2, AC3**
   */
  test('harga "52000.00" → disimpan → dikembalikan tetap "52000.00" (round-trip)', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    const actorOwnerId = 'owner-coo-001'
    const originalAmount = '52000.00'
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: originalAmount,
      momId: 'mom-001',
    }, actorOwnerId)

    // Assert: round-trip property — nilai identik
    expect(result.amount).toBe(originalAmount)
    expect(typeof result.amount).toBe('string')
  })

  /**
   * Test 18.4.2: Very small decimal value (0.01) maintains precision.
   *
   * Skenario (Req-15 edge case):
   * - Nilai desimal kecil "0.01" (edge: nilai positif terkecil dengan scale 2)
   * 
   * Ekspektasi:
   * - Nilai "0.01" tidak hilang atau terbulatkan ke 0
   * - String decimal tetap "0.01"
   *
   * **Validates: Requirements 15 AC3 (no floating-point errors)**
   */
  test('nilai desimal kecil "0.01" → round-trip presisi terjaga', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    const originalAmount = '0.01'
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: originalAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result.amount).toBe(originalAmount)
  })

  /**
   * Test 18.4.3: Large value near DB limit maintains precision.
   *
   * Skenario (Req-15 edge case):
   * - Nilai besar "999999999999999.99" (mendekati limit numeric(18,2))
   * - 15 digit integer + 2 desimal = 17 digit total (di bawah limit 18)
   * 
   * Ekspektasi:
   * - Tidak ada overflow atau truncation
   * - String decimal identik setelah round-trip
   *
   * **Validates: Requirements 15 AC1 (numeric(18,2) capacity)**
   */
  test('nilai besar "999999999999999.99" → round-trip presisi terjaga', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    const originalAmount = '999999999999999.99'
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: originalAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result.amount).toBe(originalAmount)
  })

  /**
   * Test 18.4.4: Value with trailing zeros maintains exact format.
   *
   * Skenario (Req-15):
   * - Nilai dengan trailing zeros "100.00"
   * 
   * Ekspektasi:
   * - Trailing zeros dipertahankan (scale 2)
   * - Tidak disederhanakan menjadi "100" atau "100.0"
   *
   * **Validates: Requirements 15 AC3**
   */
  test('nilai "100.00" dengan trailing zeros → format terjaga', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    const originalAmount = '100.00'
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: originalAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result.amount).toBe(originalAmount)
  })

  /**
   * Test 18.4.5: Corrected price maintains round-trip property.
   *
   * Skenario (Req-15 + Req-3):
   * - Harga existing "52000.00" dikoreksi ke "54000.50"
   * - Koreksi melalui UPDATE, bukan INSERT baru
   * 
   * Ekspektasi:
   * - Nilai koreksi dikembalikan identik dengan input
   * - Nilai lama dicatat dalam audit tanpa modifikasi
   *
   * **Validates: Requirements 15 AC3, Requirements 3 AC4**
   */
  test('koreksi harga → nilai baru dan lama round-trip', async () => {
    rekaman.findMom = stubMomFinal()
    const effectiveDate = '2026-10-01T00:00:00.000Z'
    const oldAmount = '52000.00'
    const newAmount = '54000.50'

    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate,
      amount: oldAmount,
    }

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: newAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    // Assert: nilai baru round-trip
    expect(result.amount).toBe(newAmount)

    // Assert: audit mencatat nilai lama dan baru dengan presisi
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]!.details).toMatchObject({
      oldAmount: oldAmount,
      newAmount: newAmount,
    })
  })

  /**
   * Test 18.4.6: Price resolution returns exact stored value.
   *
   * Skenario (Req-15 + Req-4):
   * - Harga "52000.00" disimpan
   * - Resolusi harga berjalan dilakukan
   * 
   * Ekspektasi:
   * - Nilai yang di-resolve identik dengan yang disimpan
   * - Tidak ada modifikasi selama query/retrieval
   *
   * **Validates: Requirements 15 AC3, Requirements 4 AC3**
   */
  test('resolusi harga → nilai dikembalikan identik dengan stored', async () => {
    const queryDate = '2026-10-15'
    const storedAmountBeli = '52000.00'
    const storedAmountJual = '55000.50'

    rekaman.findPriceByTypeAndDate.set(`beli:${queryDate}`, {
      ...stubHargaBeli(),
      amount: storedAmountBeli,
    })
    rekaman.findPriceByTypeAndDate.set(`jual:${queryDate}`, {
      ...stubHargaJual(),
      amount: storedAmountJual,
    })

    const result = await resolveHargaBerjalan(mockDb as never, new Date(`${queryDate}T00:00:00.000Z`))

    // Assert: nilai identik dengan yang disimpan
    expect(result.beli.amount).toBe(storedAmountBeli)
    expect(result.jual.amount).toBe(storedAmountJual)
  })

  /**
   * Test 18.4.7: Values that could cause floating-point errors remain exact.
   *
   * Skenario (Req-15 AC4):
   * - Nilai yang terkenal bermasalah di floating-point: "0.10", "0.30"
   * - Di JavaScript: 0.1 + 0.2 !== 0.3 karena floating-point representation
   * 
   * Ekspektasi:
   * - String decimal "0.10" tetap "0.10" (bukan 0.1)
   * - String decimal "0.30" tetap "0.30" (bukan hasil 0.1+0.2)
   * - Tidak ada konversi ke Number() atau parseFloat()
   *
   * **Validates: Requirements 15 AC4 (no parseFloat)**
   */
  test('nilai rawan floating-point "0.10" dan "0.30" → presisi terjaga', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    // Test dengan 0.10
    const amount010 = '0.10'
    const futureDate1 = new Date()
    futureDate1.setDate(futureDate1.getDate() + 10)
    const effectiveDate1 = futureDate1.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result1 = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: effectiveDate1,
      amount: amount010,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result1.amount).toBe(amount010)

    // Reset untuk test berikutnya
    rekaman.insertPriceMasuk.length = 0
    rekaman.auditMasuk.length = 0

    // Test dengan 0.30
    const amount030 = '0.30'
    const futureDate2 = new Date()
    futureDate2.setDate(futureDate2.getDate() + 20)
    const effectiveDate2 = futureDate2.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result2 = await tetapkanHarga(mockDb as never, {
      type: 'jual',
      effectiveDate: effectiveDate2,
      amount: amount030,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result2.amount).toBe(amount030)
  })

  /**
   * Test 18.4.8: Value with many decimal places is rounded to scale 2.
   *
   * Skenario (AD-10):
   * - Input "52000.9999" (4 desimal) harus dibulatkan ke scale 2
   * - Pembulatan half-up → "52001.00"
   * - Note: 3 digit decimal ("52000.999") akan dibaca sebagai id-ID format
   *   (titik sebagai ribuan) sehingga menggunakan 4 digit untuk canonical.
   * 
   * Ekspektasi:
   * - Nilai dibulatkan half-up ke 2 desimal
   * - Round-trip dari nilai yang sudah dibulatkan terjaga
   *
   * **Validates: Requirements 15 AC1 (numeric(18,2))**
   */
  test('nilai dengan presisi lebih → dibulatkan half-up ke scale 2', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = null

    const inputAmount = '52000.9999' // 4 desimal (canonical format)
    const expectedAmount = '52001.00' // Rounded half-up ke 2 desimal
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: inputAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result.amount).toBe(expectedAmount)
  })

  /**
   * Test 18.4.9: koreksiHarga by ID maintains round-trip property.
   *
   * Skenario (Req-3 + Req-15):
   * - Koreksi via ID dengan nilai baru "54321.99"
   * 
   * Ekspektasi:
   * - Nilai dikembalikan identik dengan input
   *
   * **Validates: Requirements 15, Requirements 3**
   */
  test('koreksiHarga via ID → round-trip presisi terjaga', async () => {
    rekaman.findMom = stubMomFinal()
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      id: 'price-001',
      amount: '52000.00',
    }

    const newAmount = '54321.99'

    const result = await koreksiHarga(mockDb as never, 'price-001', {
      amount: newAmount,
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(result.amount).toBe(newAmount)
  })

  /**
   * Test 18.4.10: Sequential operations maintain precision.
   *
   * Skenario (Req-15 stability):
   * - Harga dibuat dengan "52000.00"
   * - Dikoreksi ke "53000.50"
   * - Dikoreksi lagi ke "54000.99"
   * 
   * Ekspektasi:
   * - Setiap operasi mempertahankan presisi
   * - Tidak ada accumulation error dari operasi berurutan
   *
   * **Validates: Requirements 15 AC3**
   */
  test('operasi berurutan → presisi terjaga tanpa accumulation error', async () => {
    rekaman.findMom = stubMomFinal()
    const effectiveDate = '2026-10-01T00:00:00.000Z'

    // Operasi 1: Create
    const amount1 = '52000.00'
    rekaman.findExistingPrice = null

    // Simulate future date for creation (mock bypasses date validation)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const createDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const result1 = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: createDate,
      amount: amount1,
      momId: 'mom-001',
    }, 'owner-coo-001')
    expect(result1.amount).toBe(amount1)

    // Operasi 2: Koreksi pertama
    const amount2 = '53000.50'
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate: createDate,
      amount: amount1,
    }

    const result2 = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: createDate,
      amount: amount2,
      momId: 'mom-001',
    }, 'owner-coo-001')
    expect(result2.amount).toBe(amount2)

    // Operasi 3: Koreksi kedua
    const amount3 = '54000.99'
    rekaman.findExistingPrice = {
      ...stubHargaBeli(),
      effectiveDate: createDate,
      amount: amount2,
    }

    const result3 = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate: createDate,
      amount: amount3,
      momId: 'mom-001',
    }, 'owner-coo-001')
    expect(result3.amount).toBe(amount3)
  })

  /**
   * Test 18.4.11: Type coercion does not occur — amount stays string.
   *
   * Skenario (Req-15 AC4):
   * - Verifikasi bahwa amount tidak pernah di-coerce ke number
   * 
   * Ekspektasi:
   * - typeof amount === 'string' untuk semua nilai dalam result
   * - Audit details juga menyimpan string, bukan number
   *
   * **Validates: Requirements 15 AC4**
   */
  test('amount selalu tipe string — tidak pernah di-coerce ke number', async () => {
    rekaman.findMom = stubMomFinal()

    // Test pada create
    rekaman.findExistingPrice = null
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const effectiveDate = futureDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    const createResult = await tetapkanHarga(mockDb as never, {
      type: 'beli',
      effectiveDate,
      amount: '52000.00',
      momId: 'mom-001',
    }, 'owner-coo-001')

    expect(typeof createResult.amount).toBe('string')

    // Verify audit also stores as string
    expect(typeof rekaman.auditMasuk[0]!.details?.amount).toBe('string')

    // Test pada resolve
    rekaman.findPriceByTypeAndDate.set('beli:2026-10-15', {
      ...stubHargaBeli(),
      amount: '52000.00',
    })
    rekaman.findPriceByTypeAndDate.set('jual:2026-10-15', {
      ...stubHargaJual(),
      amount: '55000.00',
    })

    const resolveResult = await resolveHargaBerjalan(mockDb as never, new Date('2026-10-15T00:00:00.000Z'))

    expect(typeof resolveResult.beli.amount).toBe('string')
    expect(typeof resolveResult.jual.amount).toBe('string')
  })
})
