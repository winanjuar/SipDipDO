/**
 * PRICING — pricing.service: logika bisnis penetapan dan resolusi harga (FR-6, Story 2.3).
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts):
 *
 *   tetapkanHarga(db, input, actorOwnerId)
 *     — Upsert harga: jika sudah ada (type, effectiveDate), update (koreksi);
 *       jika tidak ada, insert baru. Audit `price-created` atau `price-corrected`
 *       dalam satu transaksi (AD-3).
 *   listHarga(db, page, limit?)
 *     — Baca daftar harga urut effectiveDate desc dengan paging.
 *   resolveHargaBerjalan(db, date?)
 *     — Resolusi harga berjalan (beli dan jual) untuk tanggal tertentu.
 *       Selalu mengembalikan tepat satu per tipe (AD-7); throw bila tidak ada.
 *
 * Invariants (Story 2.3 Boundaries, AD-7):
 * - Tepat SATU baris price_periods per (type, effectiveDate) — unique constraint.
 * - Koreksi = ubah baris berjalan + audit, bukan tambah baris kedua.
 * - Snapshot harga pada buy_orders/ledger_transactions tidak terpengaruh koreksi.
 * - MoM referensi wajib untuk setiap keputusan harga (Req-14).
 * - Entry audit ditulis dalam transaksi DB yang sama dengan aksinya (AD-3).
 *
 * **Validates: Requirements 3, 4, 14, 15**
 */
import type { Db, DbClient } from '../../utils/db'
import { writeAuditEntry } from '../audit'
import {
  findPriceByTypeAndExactDate,
  findPriceByTypeAndDate,
  findPriceById,
  insertPrice,
  listPrices,
  updatePrice,
  type PriceWire,
} from './pricing.repo'
import { findMomById } from './mom.repo'
import {
  parseRupiah,
  MoneyParseError,
  isPositive,
  PRICE_LIMIT_DEFAULT,
  type PriceCorrectInput,
  type PriceCreateInput,
  type PriceDaftar,
  type PriceLimit,
  type PriceResolveResult,
} from '#shared/domain'

/** Error domain untuk aksi harga — memudahkan handler membedakan jenis error. */
export class PricingDomainError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'MOM_NOT_FINAL' | 'VALIDATION' | 'PAST_DATE',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PricingDomainError'
  }
}

/**
 * Tetapkan harga baru atau koreksi harga existing.
 *
 * Logika upsert (Req-3):
 * - Jika sudah ada harga untuk (type, effectiveDate), update existing (koreksi)
 *   dengan audit `price-corrected`.
 * - Jika belum ada, insert baru dengan audit `price-created`.
 *
 * Validasi:
 * - MoM referensi wajib dan harus berstatus final (Req-14).
 * - Amount harus positif (Req-3).
 * - effectiveDate tidak boleh di masa lampau kecuali mode koreksi (Req-5).
 *
 * @param db - Database instance untuk membuka transaksi
 * @param input - Input penetapan harga
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns PriceWire hasil operasi
 * @throws PricingDomainError bila validasi gagal
 */
export async function tetapkanHarga(
  db: Db,
  input: PriceCreateInput,
  actorOwnerId: string,
): Promise<PriceWire> {
  // Validasi amount: parse ke rupiah dan cek positif (AD-10)
  let amountCanonical: string
  try {
    const parsed = parseRupiah(input.amount)
    if (!isPositive(parsed.value)) {
      throw new PricingDomainError('Nilai harga harus positif.', 'VALIDATION')
    }
    amountCanonical = parsed.value
  } catch (e) {
    if (e instanceof MoneyParseError) {
      throw new PricingDomainError('Nilai harga tidak valid.', 'VALIDATION', { input: input.amount })
    }
    throw e
  }

  return db.transaction(async (tx) => {
    // Validasi MoM: harus ada dan berstatus final (Req-14)
    const mom = await findMomById(tx, input.momId)
    if (!mom) {
      throw new PricingDomainError('MoM referensi tidak ditemukan.', 'NOT_FOUND')
    }
    if (mom.status !== 'final') {
      throw new PricingDomainError(
        'MoM harus berstatus final untuk digunakan sebagai referensi keputusan.',
        'MOM_NOT_FINAL',
      )
    }

    // Cek apakah sudah ada harga untuk (type, effectiveDate)
    const existing = await findPriceByTypeAndExactDate(tx, input.type, input.effectiveDate)

    if (existing) {
      // Mode koreksi: update existing row (Req-3 AC4)
      const oldAmount = existing.amount
      const now = new Date().toISOString()

      const updated = await updatePrice(tx, existing.id, {
        amount: amountCanonical,
        momId: input.momId,
        updatedAt: now,
      })

      if (!updated) {
        throw new PricingDomainError('Gagal mengubah harga.', 'NOT_FOUND')
      }

      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: actorOwnerId },
        action: 'price-corrected',
        target: `price_periods:${updated.id}`,
        details: {
          type: input.type,
          effectiveDate: input.effectiveDate,
          oldAmount,
          newAmount: amountCanonical,
          momId: input.momId,
          momTitle: mom.title,
        },
      })

      return updated
    }

    // Mode buat baru: validasi tanggal tidak di masa lampau (Req-5)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const effectiveDateObj = new Date(input.effectiveDate)
    effectiveDateObj.setHours(0, 0, 0, 0)

    if (effectiveDateObj < today) {
      throw new PricingDomainError(
        'Tanggal efektif tidak boleh di masa lampau untuk harga baru.',
        'PAST_DATE',
        { effectiveDate: input.effectiveDate, today: today.toISOString().split('T')[0] },
      )
    }

    // Insert harga baru
    const created = await insertPrice(tx, {
      type: input.type,
      effectiveDate: input.effectiveDate,
      amount: amountCanonical,
      momId: input.momId,
    })

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'price-created',
      target: `price_periods:${created.id}`,
      details: {
        type: input.type,
        effectiveDate: input.effectiveDate,
        amount: amountCanonical,
        momId: input.momId,
        momTitle: mom.title,
      },
    })

    return created
  })
}

/**
 * Baca daftar harga urut effectiveDate desc dengan paging.
 * Penegakan kewenangan ada di route handler (AD-8).
 *
 * @param db - Database client
 * @param page - Nomor halaman (1-indexed)
 * @param limit - Ukuran halaman (default PRICE_LIMIT_DEFAULT)
 * @returns PriceDaftar dengan data dan nextPage
 */
export async function listHarga(
  db: DbClient,
  page: number,
  limit: PriceLimit = PRICE_LIMIT_DEFAULT,
): Promise<PriceDaftar> {
  const offset = (page - 1) * limit
  const result = await listPrices(db, { limit, offset })
  return { data: result.data, nextPage: result.nextPage }
}

/**
 * Resolusi harga berjalan (beli dan jual) untuk tanggal tertentu (AD-7).
 *
 * Untuk setiap tipe (beli/jual), mengembalikan harga dengan effectiveDate
 * terbaru yang masih <= date yang diberikan.
 *
 * Property 1: Price Resolution Uniqueness (AD-7)
 * Untuk kombinasi (type, date) manapun, fungsi ini mengembalikan tepat SATU
 * harga — tidak pernah null dan tidak pernah lebih dari satu.
 *
 * **Validates: Requirements 4**
 *
 * @param db - Database client
 * @param date - Tanggal resolusi (ISO date string YYYY-MM-DD); default hari ini
 * @returns PriceResolveResult dengan harga beli dan jual
 * @throws PricingDomainError bila harga tidak ditemukan
 */
export async function resolveHargaBerjalan(
  db: DbClient,
  date?: Date,
): Promise<PriceResolveResult> {
  // Default ke hari ini bila tidak disediakan
  const resolveDate = date ?? new Date()
  const dateStr = resolveDate.toISOString().split('T')[0]!

  // Resolusi paralel untuk beli dan jual
  const [beli, jual] = await Promise.all([
    findPriceByTypeAndDate(db, 'beli', dateStr),
    findPriceByTypeAndDate(db, 'jual', dateStr),
  ])

  if (!beli) {
    throw new PricingDomainError(
      `Tidak ada harga beli yang berlaku untuk tanggal ${dateStr}.`,
      'NOT_FOUND',
      { type: 'beli', date: dateStr },
    )
  }

  if (!jual) {
    throw new PricingDomainError(
      `Tidak ada harga jual yang berlaku untuk tanggal ${dateStr}.`,
      'NOT_FOUND',
      { type: 'jual', date: dateStr },
    )
  }

  return { beli, jual }
}

/**
 * Koreksi harga existing berdasarkan ID.
 *
 * Berbeda dengan tetapkanHarga yang memerlukan type dan effectiveDate,
 * koreksiHarga hanya memerlukan price ID dan nilai baru (amount + momId).
 * Harga existing diambil berdasarkan ID, lalu amount dan momId diperbarui.
 *
 * Validasi:
 * - Harga dengan ID tersebut harus ada (Req-3).
 * - MoM referensi wajib dan harus berstatus final (Req-14).
 * - Amount harus positif (Req-3).
 *
 * **Validates: Requirements 3, 14**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param priceId - ID harga yang akan dikoreksi
 * @param input - Input koreksi harga (amount, momId)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns PriceWire hasil koreksi
 * @throws PricingDomainError bila harga tidak ditemukan atau validasi gagal
 */
export async function koreksiHarga(
  db: Db,
  priceId: string,
  input: PriceCorrectInput,
  actorOwnerId: string,
): Promise<PriceWire> {
  // Validasi amount: parse ke rupiah dan cek positif (AD-10)
  let amountCanonical: string
  try {
    const parsed = parseRupiah(input.amount)
    if (!isPositive(parsed.value)) {
      throw new PricingDomainError('Nilai harga harus positif.', 'VALIDATION')
    }
    amountCanonical = parsed.value
  } catch (e) {
    if (e instanceof MoneyParseError) {
      throw new PricingDomainError('Nilai harga tidak valid.', 'VALIDATION', { input: input.amount })
    }
    throw e
  }

  return db.transaction(async (tx) => {
    // Cari harga existing berdasarkan ID
    const existing = await findPriceById(tx, priceId)
    if (!existing) {
      throw new PricingDomainError('Harga tidak ditemukan.', 'NOT_FOUND', { priceId })
    }

    // Validasi MoM: harus ada dan berstatus final (Req-14)
    const mom = await findMomById(tx, input.momId)
    if (!mom) {
      throw new PricingDomainError('MoM referensi tidak ditemukan.', 'NOT_FOUND')
    }
    if (mom.status !== 'final') {
      throw new PricingDomainError(
        'MoM harus berstatus final untuk digunakan sebagai referensi keputusan.',
        'MOM_NOT_FINAL',
      )
    }

    const oldAmount = existing.amount
    const oldMomId = existing.momId
    const now = new Date().toISOString()

    const updated = await updatePrice(tx, priceId, {
      amount: amountCanonical,
      momId: input.momId,
      updatedAt: now,
    })

    if (!updated) {
      throw new PricingDomainError('Gagal mengubah harga.', 'NOT_FOUND')
    }

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'price-corrected',
      target: `price_periods:${updated.id}`,
      details: {
        type: existing.type,
        effectiveDate: existing.effectiveDate,
        oldAmount,
        newAmount: amountCanonical,
        oldMomId,
        newMomId: input.momId,
        momTitle: mom.title,
      },
    })

    return updated
  })
}
