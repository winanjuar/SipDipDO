/**
 * PRICING — mom.repo: satu-satunya tempat query Drizzle untuk `moms` (AD-5).
 * Seluruh fungsi menerima `DbClient` (db atau tx) — penulisan selalu join
 * transaksi pemanggil (AD-3). Hanya modul PRICING yang menulis tabel ini.
 */
import { desc, eq } from 'drizzle-orm'
import { moms } from '../../../drizzle/schema'
import type { DbClient } from '../../utils/db'
import type { MomWire } from '#shared/domain/mom'

/** Input buat MoM baru — dari service. */
export interface MomInsertRow {
  title: string
  heldAt: string
  contentText?: string | null
}

/** Input ubah MoM — field opsional. */
export interface MomUpdateRow {
  title?: string
  heldAt?: string
  contentText?: string | null
  updatedAt: string
}

/** Paging offset — `limit` dan `offset` dari service. */
export interface MomPaging {
  limit: number
  offset: number
}

/** Hasil baca paging: `nextPage` null berarti habis. */
export interface MomDaftarRepo {
  data: MomWire[]
  nextPage: number | null
}

/** Pemetaan baris DB → bentuk wire (AD-10: timestamptz sudah string). */
function mapToWire(row: typeof moms.$inferSelect): MomWire {
  return {
    id: row.id,
    title: row.title,
    heldAt: row.heldAt,
    status: row.status,
    contentText: row.contentText,
    pdfPath: row.pdfPath,
    finalizedAt: row.finalizedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Sisipkan MoM baru — mengembalikan baris yang dibuat. Wajib dalam transaksi
 * dengan audit entry (AD-3).
 */
export async function insertMom(tx: DbClient, row: MomInsertRow): Promise<MomWire> {
  const result = await tx.insert(moms).values({
    title: row.title,
    heldAt: row.heldAt,
    contentText: row.contentText ?? null,
  }).returning()
  const inserted = result[0]
  if (!inserted) throw new Error('insertMom: gagal menyisipkan MoM.')
  return mapToWire(inserted)
}

/**
 * Ubah MoM draft — mengembalikan baris yang diubah atau null bila tidak ada.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 */
export async function updateMom(
  tx: DbClient,
  momId: string,
  row: MomUpdateRow,
): Promise<MomWire | null> {
  const updateData: Partial<typeof moms.$inferInsert> = { updatedAt: row.updatedAt }
  if (row.title !== undefined) updateData.title = row.title
  if (row.heldAt !== undefined) updateData.heldAt = row.heldAt
  if (row.contentText !== undefined) updateData.contentText = row.contentText

  const [updated] = await tx.update(moms)
    .set(updateData)
    .where(eq(moms.id, momId))
    .returning()
  return updated ? mapToWire(updated) : null
}

/**
 * Finalkan MoM — set status ke 'final' dan finalized_at. Mengembalikan baris
 * yang diubah atau null bila tidak ada. Wajib dalam transaksi dengan audit
 * entry (AD-3).
 */
export async function finalizeMom(
  tx: DbClient,
  momId: string,
  finalizedAt: string,
): Promise<MomWire | null> {
  const [updated] = await tx.update(moms)
    .set({
      status: 'final',
      finalizedAt,
      updatedAt: finalizedAt,
    })
    .where(eq(moms.id, momId))
    .returning()
  return updated ? mapToWire(updated) : null
}

/**
 * Hapus MoM — mengembalikan true bila berhasil, false bila tidak ada.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 */
export async function deleteMom(tx: DbClient, momId: string): Promise<boolean> {
  const result = await tx.delete(moms).where(eq(moms.id, momId))
  // Drizzle postgres-js returns { count: number } on delete
  return (result as { count?: number }).count !== undefined
    ? (result as { count: number }).count > 0
    : true // fallback if count is not present
}

/**
 * Cari MoM berdasarkan ID — null bila tidak ditemukan.
 */
export async function findMomById(db: DbClient, momId: string): Promise<MomWire | null> {
  const [row] = await db.select().from(moms).where(eq(moms.id, momId))
  return row ? mapToWire(row) : null
}

/**
 * List MoM urut held_at desc dengan paging — probe hasNext via satu baris
 * ekstra. `nextPage` null bila habis.
 */
export async function listMoms(db: DbClient, paging: MomPaging): Promise<MomDaftarRepo> {
  const rows = await db.select()
    .from(moms)
    .orderBy(desc(moms.heldAt), desc(moms.createdAt))
    .limit(paging.limit + 1)
    .offset(paging.offset)

  const hasMore = rows.length > paging.limit
  const data = (hasMore ? rows.slice(0, paging.limit) : rows).map(mapToWire)

  const halaman = Math.trunc(paging.offset / paging.limit) + 1
  return { data, nextPage: hasMore ? halaman + 1 : null }
}
