// server/domain/pricing/pricing.repo.ts
//
// Lapisan data domain pricing (FR-6/FR-7). Menerjemahkan permintaan resolusi
// harga & penyimpanan MoM ke query Drizzle atas tabel `price_periods` dan `moms`
// (schema.ts). Tidak ada aturan bisnis di sini — orkestrasi & audit ada di
// `pricing.service.ts`.
//
// Tabel (schema.ts):
//   price_periods : id, kind (price_kind: beli|jual), price numeric(18,2),
//                   effectiveDate (date), momRef (uuid nullable),
//                   UNIQUE (kind, effective_date)  ← resolusi tepat satu baris (AD-7)
//   moms          : id, title, momDate (date), status (mom_status: draft|final),
//                   body (text nullable), createdAt, updatedAt
//
// Konvensi tanggal: kolom `date` Postgres dibaca/ditulis sebagai string
// 'YYYY-MM-DD' oleh drizzle — selaras dengan branded `JakartaDate` (AD-9).

import { and, asc, desc, eq, lte } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type {
  JakartaDate,
  MoneyString,
  PriceKind,
  Uuid,
} from '../../../shared/domain/types'

const { pricePeriods, moms } = schema

// ---------------------------------------------------------------------------
// Tipe baca/tulis lapisan data
// ---------------------------------------------------------------------------

/** Baris harga sebagaimana dibaca dari `price_periods`. */
export interface PricePeriod {
  id: Uuid
  kind: PriceKind
  /** Nilai harga berskala tetap numeric(18,2) — selalu string (AD-10). */
  price: MoneyString
  /** Tanggal efektif harga ('YYYY-MM-DD', zona Jakarta). */
  effectiveDate: JakartaDate
  /** Referensi MoM MRO penetap harga (FR-6.1). */
  momRef: Uuid | null
  createdAt: Date
}

/** Baris MoM sebagaimana dibaca dari `moms`. */
export interface Mom {
  id: Uuid
  title: string
  /** Tanggal MoM MRO/RUPS ('YYYY-MM-DD'). */
  momDate: JakartaDate
  status: 'draft' | 'final'
  body: string | null
  createdAt: Date
  updatedAt: Date
}

/** Nilai INSERT satu baris `price_periods`. */
export interface InsertPricePeriod {
  kind: PriceKind
  price: MoneyString
  effectiveDate: JakartaDate
  momRef: Uuid
}

/** Nilai INSERT satu baris `moms` (status awal default 'draft'). */
export interface InsertMom {
  title: string
  momDate: JakartaDate
  status?: 'draft' | 'final'
  body?: string | null
}

/** Perubahan yang diizinkan pada MoM (title/tanggal/body/status). */
export interface UpdateMom {
  title?: string
  momDate?: JakartaDate
  body?: string | null
  status?: 'draft' | 'final'
}

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Pemeta baris → tipe domain
// ---------------------------------------------------------------------------

function toPricePeriod(r: typeof pricePeriods.$inferSelect): PricePeriod {
  return {
    id: r.id as Uuid,
    kind: r.kind,
    price: r.price as MoneyString,
    effectiveDate: r.effectiveDate as JakartaDate,
    momRef: (r.momRef as Uuid | null) ?? null,
    createdAt: r.createdAt,
  }
}

function toMom(r: typeof moms.$inferSelect): Mom {
  return {
    id: r.id as Uuid,
    title: r.title,
    momDate: r.momDate as JakartaDate,
    status: r.status,
    body: r.body ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// price_periods — resolusi & riwayat
// ---------------------------------------------------------------------------

/**
 * Resolusi harga berjalan untuk `kind` pada tanggal Jakarta `onDate` (AD-7):
 * baris dengan `effective_date` TERBESAR yang `<= onDate`. Karena unik per
 * (kind, effective_date), urutan menurun + limit 1 menghasilkan TEPAT satu baris
 * (atau tidak ada bila belum pernah ada harga s.d. tanggal itu).
 *
 * Mengembalikan `null` bila tak ada baris memenuhi — pemanggil (service) yang
 * memutuskan melempar error yang jelas.
 */
export async function findCurrent(
  reader: Reader,
  kind: PriceKind,
  onDate: JakartaDate,
): Promise<PricePeriod | null> {
  const rows = await reader
    .select()
    .from(pricePeriods)
    .where(
      and(
        eq(pricePeriods.kind, kind),
        lte(pricePeriods.effectiveDate, onDate),
      ),
    )
    .orderBy(desc(pricePeriods.effectiveDate))
    .limit(1)

  const row = rows[0]
  return row ? toPricePeriod(row) : null
}

/**
 * Seluruh riwayat harga untuk `kind`, terurut menaik berdasar `effective_date`
 * (FR-6.2) — dari harga tertua ke terbaru.
 */
export async function findHistory(
  reader: Reader,
  kind: PriceKind,
): Promise<PricePeriod[]> {
  const rows = await reader
    .select()
    .from(pricePeriods)
    .where(eq(pricePeriods.kind, kind))
    .orderBy(asc(pricePeriods.effectiveDate))

  return rows.map(toPricePeriod)
}

/**
 * Menyisipkan satu baris harga baru DI DALAM transaksi `tx`.
 *
 * Keunikan (kind, effective_date) ditegakkan oleh constraint DB (AD-7); bila
 * bentrok, INSERT melempar error unik yang diterjemahkan service menjadi
 * konflik yang jelas.
 */
export async function insertPrice(
  tx: Tx,
  values: InsertPricePeriod,
): Promise<PricePeriod> {
  const [row] = await tx
    .insert(pricePeriods)
    .values({
      kind: values.kind,
      price: values.price,
      effectiveDate: values.effectiveDate,
      momRef: values.momRef,
    })
    .returning()

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return toPricePeriod(row!)
}

// ---------------------------------------------------------------------------
// moms — simpan/edit + transisi draft → final
// ---------------------------------------------------------------------------

/** Membaca satu MoM berdasar id (untuk guard transisi status). */
export async function findMomById(
  reader: Reader,
  id: Uuid,
): Promise<Mom | null> {
  const rows = await reader
    .select()
    .from(moms)
    .where(eq(moms.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toMom(row) : null
}

/** Menyisipkan MoM baru DI DALAM transaksi `tx` (status default 'draft'). */
export async function insertMom(tx: Tx, values: InsertMom): Promise<Mom> {
  const [row] = await tx
    .insert(moms)
    .values({
      title: values.title,
      momDate: values.momDate,
      status: values.status ?? 'draft',
      body: values.body ?? null,
    })
    .returning()

  return toMom(row!)
}

/**
 * Memperbarui MoM DI DALAM transaksi `tx`. `updatedAt` disegarkan ke `now()`.
 * Hanya field yang disediakan yang diubah; guard status (hanya draft yang boleh
 * diedit) ditegakkan di service.
 */
export async function updateMom(
  tx: Tx,
  id: Uuid,
  patch: UpdateMom,
): Promise<Mom> {
  const set: Partial<typeof moms.$inferInsert> = { updatedAt: new Date() }
  if (patch.title !== undefined) set.title = patch.title
  if (patch.momDate !== undefined) set.momDate = patch.momDate
  if (patch.body !== undefined) set.body = patch.body
  if (patch.status !== undefined) set.status = patch.status

  const [row] = await tx
    .update(moms)
    .set(set)
    .where(eq(moms.id, id))
    .returning()

  return toMom(row!)
}

// Instance `db` bound-schema di-reexport agar service dapat memakai pembacaan
// di luar transaksi (view publik harga/riwayat) tanpa mengimpor db lagi.
export { db }
