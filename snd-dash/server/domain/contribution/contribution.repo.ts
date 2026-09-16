// server/domain/contribution/contribution.repo.ts
//
// Lapisan data domain contribution (FR-8/FR-9). Menerjemahkan definisi item &
// pencatatan realisasi ke query Drizzle atas tabel `contribution_items`,
// `contribution_entries`, dan `contribution_periods` (schema.ts). Tidak ada
// aturan bisnis di sini — orkestrasi, guard periode-final, dan audit ada di
// `contribution.service.ts`.
//
// Tabel (schema.ts):
//   contribution_periods : id, name, startDate (date), cutOffDate (date?),
//                          isFinalized (bool), finalizedAt (ts?), createdAt
//   contribution_items   : id, name, description(?), points (int),
//                          periodId (uuid?), momRef (uuid?), createdAt
//   contribution_entries : id, ownerId, itemId, periodId, points (int),
//                          recordedBy, recordedDate (date), redeemed (bool),
//                          createdAt
//
// Konvensi tanggal: kolom `date` Postgres dibaca/ditulis sebagai string
// 'YYYY-MM-DD' oleh drizzle — selaras dengan branded `JakartaDate` (AD-9).

import { and, desc, eq, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import type { ContributionEntry, ContributionItem } from './events'

const { contributionItems, contributionEntries, contributionPeriods, moms } =
  schema

// ---------------------------------------------------------------------------
// Tipe baca/tulis lapisan data
// ---------------------------------------------------------------------------

/** Baris periode Contribution sebagaimana dibaca dari `contribution_periods`. */
export interface ContributionPeriod {
  id: Uuid
  name: string
  startDate: JakartaDate
  cutOffDate: JakartaDate | null
  isFinalized: boolean
  finalizedAt: Date | null
  createdAt: Date
}

/** Nilai INSERT satu baris `contribution_items`. */
export interface InsertItem {
  name: string
  description?: string | null
  points: number
  periodId?: Uuid | null
  momRef: Uuid
}

/** Nilai INSERT satu baris `contribution_periods` (roll periode baru, FR-10). */
export interface InsertPeriod {
  name: string
  startDate: JakartaDate
}

/** Nilai INSERT satu baris `contribution_entries`. */
export interface InsertEntry {
  ownerId: Uuid
  itemId: Uuid
  periodId: Uuid
  points: number
  recordedBy: Uuid
  recordedDate: JakartaDate
}

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Pemeta baris → tipe domain
// ---------------------------------------------------------------------------

function toItem(r: typeof contributionItems.$inferSelect): ContributionItem {
  return {
    id: r.id as Uuid,
    name: r.name,
    description: r.description ?? null,
    points: r.points,
    periodId: (r.periodId as Uuid | null) ?? null,
    momRef: (r.momRef as Uuid | null) ?? null,
    createdAt: r.createdAt,
  }
}

function toEntry(r: typeof contributionEntries.$inferSelect): ContributionEntry {
  return {
    id: r.id as Uuid,
    ownerId: r.ownerId as Uuid,
    itemId: r.itemId as Uuid,
    periodId: r.periodId as Uuid,
    points: r.points,
    recordedBy: r.recordedBy as Uuid,
    recordedDate: r.recordedDate as JakartaDate,
    redeemed: r.redeemed,
    createdAt: r.createdAt,
  }
}

function toPeriod(
  r: typeof contributionPeriods.$inferSelect,
): ContributionPeriod {
  return {
    id: r.id as Uuid,
    name: r.name,
    startDate: r.startDate as JakartaDate,
    cutOffDate: (r.cutOffDate as JakartaDate | null) ?? null,
    isFinalized: r.isFinalized,
    finalizedAt: r.finalizedAt ?? null,
    createdAt: r.createdAt,
  }
}

// ---------------------------------------------------------------------------
// contribution_periods — resolusi periode aktif & guard finalisasi
// ---------------------------------------------------------------------------

/**
 * Periode Contribution AKTIF: baris belum-final (`is_finalized = false`)
 * terbaru berdasar `start_date` (lalu `created_at`). Mengembalikan `null` bila
 * tak ada periode aktif — pemanggil (service) memutuskan error yang jelas.
 */
export async function findActivePeriod(
  reader: Reader,
): Promise<ContributionPeriod | null> {
  const rows = await reader
    .select()
    .from(contributionPeriods)
    .where(eq(contributionPeriods.isFinalized, false))
    .orderBy(
      desc(contributionPeriods.startDate),
      desc(contributionPeriods.createdAt),
    )
    .limit(1)

  const row = rows[0]
  return row ? toPeriod(row) : null
}

/** Membaca satu periode berdasar id (untuk guard periode-final). */
export async function findPeriodById(
  reader: Reader,
  id: Uuid,
): Promise<ContributionPeriod | null> {
  const rows = await reader
    .select()
    .from(contributionPeriods)
    .where(eq(contributionPeriods.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toPeriod(row) : null
}

/**
 * Apakah periode `id` sudah difinalkan (FR-10)? Pencatatan realisasi ke periode
 * yang sudah final tidak diizinkan (FR-9). Mengembalikan `null` bila periode
 * tidak ditemukan sehingga pemanggil dapat membedakan "tidak ada" vs "final".
 */
export async function isPeriodFinalized(
  reader: Reader,
  id: Uuid,
): Promise<boolean | null> {
  const period = await findPeriodById(reader, id)
  return period ? period.isFinalized : null
}

// ---------------------------------------------------------------------------
// moms — validasi keberadaan MoM penetap item (FR-8 §8.1)
// ---------------------------------------------------------------------------

/**
 * Apakah MoM `id` ada? Definisi item Contribution wajib tertaut MoM penetap
 * (FR-8 §8.1). Mengembalikan `{ id }` minimal bila ada, `null` bila tidak.
 */
export async function findMomById(
  reader: Reader,
  id: Uuid,
): Promise<{ id: Uuid } | null> {
  const rows = await reader
    .select({ id: moms.id })
    .from(moms)
    .where(eq(moms.id, id))
    .limit(1)

  const row = rows[0]
  return row ? { id: row.id as Uuid } : null
}

// ---------------------------------------------------------------------------
// contribution_items — definisi item (FR-8)
// ---------------------------------------------------------------------------

/** Membaca satu item Contribution berdasar id (untuk validasi realisasi). */
export async function findItemById(
  reader: Reader,
  id: Uuid,
): Promise<ContributionItem | null> {
  const rows = await reader
    .select()
    .from(contributionItems)
    .where(eq(contributionItems.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toItem(row) : null
}

/** Menyisipkan satu item Contribution baru DI DALAM transaksi `tx` (FR-8). */
export async function insertItem(
  tx: Tx,
  values: InsertItem,
): Promise<ContributionItem> {
  const [row] = await tx
    .insert(contributionItems)
    .values({
      name: values.name,
      description: values.description ?? null,
      points: values.points,
      periodId: values.periodId ?? null,
      momRef: values.momRef,
    })
    .returning()

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return toItem(row!)
}

// ---------------------------------------------------------------------------
// contribution_entries — pencatatan realisasi (FR-9) & poin berjalan
// ---------------------------------------------------------------------------

/** Menyisipkan satu entri realisasi DI DALAM transaksi `tx` (FR-9). */
export async function insertEntry(
  tx: Tx,
  values: InsertEntry,
): Promise<ContributionEntry> {
  const [row] = await tx
    .insert(contributionEntries)
    .values({
      ownerId: values.ownerId,
      itemId: values.itemId,
      periodId: values.periodId,
      points: values.points,
      recordedBy: values.recordedBy,
      recordedDate: values.recordedDate,
      // `redeemed` default false — poin berjalan hingga cut-off (FR-10).
    })
    .returning()

  return toEntry(row!)
}

/**
 * Menjumlahkan poin berjalan (belum diberi insentif, `redeemed = false`) milik
 * `ownerId`, dipecah per periode. Poin di periode aktif = poin berjalan periode
 * ini; poin di periode lain yang belum diberi insentif = carry-over (FR-9
 * §9.2/§9.3, FR-10 §10.5).
 *
 * @returns array `{ periodId, points }` — hanya periode dengan total > 0.
 */
export async function sumRunningPointsByOwner(
  reader: Reader,
  ownerId: Uuid,
): Promise<Array<{ periodId: Uuid; points: number }>> {
  const rows = await reader
    .select({
      periodId: contributionEntries.periodId,
      points: sql<number>`coalesce(sum(${contributionEntries.points}), 0)::int`,
    })
    .from(contributionEntries)
    .where(
      and(
        eq(contributionEntries.ownerId, ownerId),
        eq(contributionEntries.redeemed, false),
      ),
    )
    .groupBy(contributionEntries.periodId)

  return rows.map((r) => ({
    periodId: r.periodId as Uuid,
    points: Number(r.points),
  }))
}

// ---------------------------------------------------------------------------
// Cut-off periode (FR-10) — finalisasi, roll periode baru, carry-over
// ---------------------------------------------------------------------------

/**
 * Memfinalkan periode `id` DI DALAM transaksi `tx` (FR-10 §10.1): set
 * `is_finalized = true`, `finalized_at = finalizedAt`, `cut_off_date =
 * cutOffDate`. Idempoten-guard: hanya baris yang MASIH belum-final
 * (`is_finalized = false`) yang diperbarui, sehingga finalisasi ganda tidak
 * mengubah snapshot beku (imutabel). Mengembalikan periode terfinalkan bila
 * transisi terjadi, atau `null` bila baris sudah final / tidak ditemukan.
 */
export async function finalizePeriod(
  tx: Tx,
  id: Uuid,
  cutOffDate: JakartaDate,
  finalizedAt: Date,
): Promise<ContributionPeriod | null> {
  const [row] = await tx
    .update(contributionPeriods)
    .set({
      isFinalized: true,
      finalizedAt,
      cutOffDate,
    })
    .where(
      and(
        eq(contributionPeriods.id, id),
        eq(contributionPeriods.isFinalized, false),
      ),
    )
    .returning()

  return row ? toPeriod(row) : null
}

/**
 * Menyisipkan (roll) satu periode Contribution baru yang AKTIF (belum-final)
 * DI DALAM transaksi `tx` (FR-10 §10.2/§10.5). Dipakai cut-off untuk membuka
 * periode berikutnya tempat entri carry-over ditautkan ulang.
 */
export async function insertPeriod(
  tx: Tx,
  values: InsertPeriod,
): Promise<ContributionPeriod> {
  const [row] = await tx
    .insert(contributionPeriods)
    .values({
      name: values.name,
      startDate: values.startDate,
      // isFinalized default false → periode aktif baru.
    })
    .returning()

  return toPeriod(row!)
}

/**
 * Menjumlahkan poin per Owner untuk entri pada periode `periodId`, dipecah
 * berdasar status penunaian (`redeemed`) (FR-10 §10.3). Satu lintasan agregasi:
 * poin `redeemed = true` = Contribution yang SUDAH diberi insentif; poin
 * `redeemed = false` = poin yang di-CARRY OVER (belum diberi insentif) ke
 * periode berikutnya. Hanya Owner dengan total > 0 pada masing-masing kategori
 * yang muncul di hasil.
 *
 * @returns array `{ ownerId, redeemedPoints, unredeemedPoints }`.
 */
export async function sumByOwnerForPeriodSplitRedeemed(
  reader: Reader,
  periodId: Uuid,
): Promise<
  Array<{ ownerId: Uuid; redeemedPoints: number; unredeemedPoints: number }>
> {
  const rows = await reader
    .select({
      ownerId: contributionEntries.ownerId,
      redeemedPoints: sql<number>`coalesce(sum(${contributionEntries.points}) filter (where ${contributionEntries.redeemed} = true), 0)::int`,
      unredeemedPoints: sql<number>`coalesce(sum(${contributionEntries.points}) filter (where ${contributionEntries.redeemed} = false), 0)::int`,
    })
    .from(contributionEntries)
    .where(eq(contributionEntries.periodId, periodId))
    .groupBy(contributionEntries.ownerId)

  return rows.map((r) => ({
    ownerId: r.ownerId as Uuid,
    redeemedPoints: Number(r.redeemedPoints),
    unredeemedPoints: Number(r.unredeemedPoints),
  }))
}

/**
 * Poin Insentif per Owner (basis AD-10): Σ poin entri Contribution pada periode
 * TERFINALKAN (`contribution_periods.is_finalized = true`) yang BELUM ditunaikan
 * (`redeemed = false`). Ini adalah kontrak kanonik yang dikonsumsi distribusi
 * (FR-16 §16.7). Hanya Owner dengan total > 0 yang dikembalikan.
 */
export async function sumFinalizedUnredeemedByOwner(
  reader: Reader,
): Promise<Array<{ ownerId: Uuid; points: number }>> {
  const rows = await reader
    .select({
      ownerId: contributionEntries.ownerId,
      points: sql<number>`coalesce(sum(${contributionEntries.points}), 0)::int`,
    })
    .from(contributionEntries)
    .innerJoin(
      contributionPeriods,
      eq(contributionEntries.periodId, contributionPeriods.id),
    )
    .where(
      and(
        eq(contributionEntries.redeemed, false),
        eq(contributionPeriods.isFinalized, true),
      ),
    )
    .groupBy(contributionEntries.ownerId)

  return rows.map((r) => ({
    ownerId: r.ownerId as Uuid,
    points: Number(r.points),
  }))
}

// Instance `db` bound-schema di-reexport agar service dapat memakai pembacaan
// di luar transaksi (view dashboard/rekap COO) tanpa mengimpor db lagi.
export { db }
