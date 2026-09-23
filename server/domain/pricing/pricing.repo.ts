/**
 * PRICING — pricing.repo: satu-satunya tempat query Drizzle untuk `price_periods`
 * (AD-5). Nilai harga `numeric(18,2)` disimpan dan dibaca sebagai string desimal
 * (AD-10). Unique (type, effectiveDate) di-enforce di level tabel (AD-7).
 *
 * Seluruh fungsi menerima `DbClient` (db atau tx) — penulisan selalu join
 * transaksi pemanggil (AD-3). Hanya modul PRICING yang menulis tabel ini.
 */
import { and, desc, eq, lte, sql } from 'drizzle-orm'
import { moms, pricePeriods } from '../../../drizzle/schema'
import type { DbClient } from '../../utils/db'
import type { PriceType } from '../../../shared/domain'

// Re-export PriceType from shared domain for consumers of this module
export type { PriceType } from '../../../shared/domain'

/**
 * Bentuk wire PricePeriod untuk lapis tampilan — timestamptz sebagai string ISO,
 * amount sebagai string desimal (AD-10). Termasuk info MoM terkait.
 */
export interface PriceWire {
  id: string
  type: PriceType
  effectiveDate: string
  /** Nilai harga — string desimal numeric(18,2). */
  amount: string
  momId: string
  momTitle: string
  createdAt: string
  updatedAt: string
}

/** Input insert harga baru — dari service. */
export interface PriceInsertRow {
  type: PriceType
  effectiveDate: string
  /** Nilai harga — string desimal numeric(18,2). */
  amount: string
  momId: string
}

/** Input update harga — dari service. */
export interface PriceUpdateRow {
  /** Nilai harga — string desimal numeric(18,2). */
  amount: string
  momId: string
  updatedAt: string
}

/** Paging offset — `limit` dan `offset` dari service. */
export interface PricePaging {
  limit: number
  offset: number
}

/** Hasil baca paging: `nextPage` null berarti habis. */
export interface PriceDaftarRepo {
  data: PriceWire[]
  nextPage: number | null
}

/** Pemetaan baris DB + MoM → bentuk wire. */
function mapToWire(row: typeof pricePeriods.$inferSelect, momTitle: string): PriceWire {
  return {
    id: row.id,
    type: row.type,
    effectiveDate: row.effectiveDate,
    amount: row.amount,
    momId: row.momId,
    momTitle,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Sisipkan harga baru — mengembalikan baris yang dibuat. Wajib dalam transaksi
 * dengan audit entry (AD-3). Unique constraint (type, effectiveDate) di-enforce
 * di level tabel (AD-7) — duplikasi ditolak oleh DB.
 */
export async function insertPrice(tx: DbClient, row: PriceInsertRow): Promise<PriceWire> {
  const [inserted] = await tx.insert(pricePeriods).values({
    type: row.type,
    effectiveDate: row.effectiveDate,
    amount: row.amount,
    momId: row.momId,
  }).returning()

  if (!inserted) throw new Error('insertPrice: gagal menyisipkan harga.')

  // Ambil judul MoM untuk wire
  const [mom] = await tx.select({ title: moms.title }).from(moms).where(eq(moms.id, inserted.momId))
  const momTitle = mom?.title ?? ''

  return mapToWire(inserted, momTitle)
}

/**
 * Ubah harga existing — mengembalikan baris yang diubah atau null bila tidak ada.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 */
export async function updatePrice(
  tx: DbClient,
  priceId: string,
  row: PriceUpdateRow,
): Promise<PriceWire | null> {
  const [updated] = await tx.update(pricePeriods)
    .set({
      amount: row.amount,
      momId: row.momId,
      updatedAt: row.updatedAt,
    })
    .where(eq(pricePeriods.id, priceId))
    .returning()

  if (!updated) return null

  // Ambil judul MoM untuk wire
  const [mom] = await tx.select({ title: moms.title }).from(moms).where(eq(moms.id, updated.momId))
  const momTitle = mom?.title ?? ''

  return mapToWire(updated, momTitle)
}

/**
 * Cari harga berdasarkan type dan effectiveDate — untuk resolusi harga berjalan.
 * Mengembalikan harga dengan effectiveDate <= date, diurutkan descending,
 * ambil yang paling baru (AD-7: tepat satu per kombinasi type+effectiveDate).
 */
export async function findPriceByTypeAndDate(
  db: DbClient,
  type: PriceType,
  date: string,
): Promise<PriceWire | null> {
  // Cari harga dengan effectiveDate <= date, diurutkan DESC, ambil satu
  const rows = await db.select({
    price: pricePeriods,
    momTitle: moms.title,
  })
    .from(pricePeriods)
    .innerJoin(moms, eq(pricePeriods.momId, moms.id))
    .where(
      and(
        eq(pricePeriods.type, type),
        lte(pricePeriods.effectiveDate, date),
      ),
    )
    .orderBy(desc(pricePeriods.effectiveDate))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return mapToWire(row.price, row.momTitle)
}

/**
 * Cari harga berdasarkan type dan tanggal tepat (exact match) — untuk cek
 * apakah sudah ada harga pada tanggal tertentu.
 */
export async function findPriceByTypeAndExactDate(
  db: DbClient,
  type: PriceType,
  effectiveDate: string,
): Promise<PriceWire | null> {
  const rows = await db.select({
    price: pricePeriods,
    momTitle: moms.title,
  })
    .from(pricePeriods)
    .innerJoin(moms, eq(pricePeriods.momId, moms.id))
    .where(
      and(
        eq(pricePeriods.type, type),
        eq(pricePeriods.effectiveDate, effectiveDate),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return mapToWire(row.price, row.momTitle)
}

/**
 * Cari harga berdasarkan ID — null bila tidak ditemukan.
 */
export async function findPriceById(db: DbClient, priceId: string): Promise<PriceWire | null> {
  const rows = await db.select({
    price: pricePeriods,
    momTitle: moms.title,
  })
    .from(pricePeriods)
    .innerJoin(moms, eq(pricePeriods.momId, moms.id))
    .where(eq(pricePeriods.id, priceId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return mapToWire(row.price, row.momTitle)
}

/**
 * List harga urut effectiveDate desc dengan paging — probe hasNext via satu baris
 * ekstra. `nextPage` null bila habis.
 */
export async function listPrices(db: DbClient, paging: PricePaging): Promise<PriceDaftarRepo> {
  const rows = await db.select({
    price: pricePeriods,
    momTitle: moms.title,
  })
    .from(pricePeriods)
    .innerJoin(moms, eq(pricePeriods.momId, moms.id))
    .orderBy(desc(pricePeriods.effectiveDate), desc(pricePeriods.createdAt))
    .limit(paging.limit + 1)
    .offset(paging.offset)

  const hasMore = rows.length > paging.limit
  const data = (hasMore ? rows.slice(0, paging.limit) : rows).map(
    r => mapToWire(r.price, r.momTitle),
  )

  const halaman = Math.trunc(paging.offset / paging.limit) + 1
  return { data, nextPage: hasMore ? halaman + 1 : null }
}

/**
 * Hitung jumlah total harga — untuk info paging.
 */
export async function countPrices(db: DbClient): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(pricePeriods)
  return Number(result[0]?.count ?? 0)
}
