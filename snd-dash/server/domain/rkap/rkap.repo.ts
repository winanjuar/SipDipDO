// server/domain/rkap/rkap.repo.ts
//
// Lapisan data domain RKAP (FR-1/FR-23). Menerjemahkan permintaan penetapan
// fase, pembacaan fase & Capital Item ke query Drizzle atas tabel `rkap_phases`
// dan `capital_items` (schema.ts). Tidak ada aturan bisnis di sini — orkestrasi,
// validasi, & audit ada di `rkap.service.ts`.
//
// Tabel (schema.ts):
//   rkap_phases   : id, name, instantAdjustmentBudget numeric(18,2),
//                   instantAdjustmentUsed numeric(18,2), isActive bool,
//                   momRef (uuid nullable), createdAt
//   capital_items : id, phaseId, name, capitalType (capital_type enum),
//                   initialRequirement numeric(18,2), finalRequirement numeric(18,2),
//                   fulfillment numeric(18,2) default 0, utilization numeric(18,2)
//                   default 0, createdAt
//
// Penulisan SELALU menerima handle `tx` (AD-2) — tidak pernah membuka transaksi
// sendiri. Pembacaan menerima `Reader` (Tx maupun `db` bound-schema).

import { desc, eq, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type {
  CapitalType,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'

const { rkapPhases, capitalItems, ledgerTransactions } = schema

// ---------------------------------------------------------------------------
// Tipe baca/tulis lapisan data
// ---------------------------------------------------------------------------

/** Baris fase sebagaimana dibaca dari `rkap_phases`. */
export interface PhaseRow {
  id: Uuid
  name: string
  instantAdjustmentBudget: MoneyString
  instantAdjustmentUsed: MoneyString
  isActive: boolean
  momRef: Uuid | null
  createdAt: Date
}

/**
 * Ringkasan baris `ledger_transactions` untuk plotting (FR-23 §23.11): jenis
 * modal + dana riil (nilai Fulfillment yang akan disebar ke Capital Item).
 */
export interface LedgerTxBrief {
  capitalType: CapitalType
  actualAmount: MoneyString
}

/** Baris Capital Item sebagaimana dibaca dari `capital_items`. */
export interface CapitalItemRow {
  id: Uuid
  phaseId: Uuid
  name: string
  capitalType: CapitalType
  initialRequirement: MoneyString
  finalRequirement: MoneyString
  fulfillment: MoneyString
  utilization: MoneyString
  createdAt: Date
}

/** Nilai INSERT satu baris `rkap_phases`. */
export interface InsertPhase {
  name: string
  instantAdjustmentBudget: MoneyString
  momRef: Uuid | null
}

/** Nilai INSERT satu baris `capital_items` (Initial = Final saat penetapan). */
export interface InsertCapitalItem {
  phaseId: Uuid
  name: string
  capitalType: CapitalType
  initialRequirement: MoneyString
  finalRequirement: MoneyString
}

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Pemeta baris → tipe lapisan data
// ---------------------------------------------------------------------------

function toPhaseRow(r: typeof rkapPhases.$inferSelect): PhaseRow {
  return {
    id: r.id as Uuid,
    name: r.name,
    instantAdjustmentBudget: r.instantAdjustmentBudget as MoneyString,
    instantAdjustmentUsed: r.instantAdjustmentUsed as MoneyString,
    isActive: r.isActive,
    momRef: (r.momRef as Uuid | null) ?? null,
    createdAt: r.createdAt,
  }
}

function toCapitalItemRow(r: typeof capitalItems.$inferSelect): CapitalItemRow {
  return {
    id: r.id as Uuid,
    phaseId: r.phaseId as Uuid,
    name: r.name,
    capitalType: r.capitalType,
    initialRequirement: r.initialRequirement as MoneyString,
    finalRequirement: r.finalRequirement as MoneyString,
    fulfillment: r.fulfillment as MoneyString,
    utilization: r.utilization as MoneyString,
    createdAt: r.createdAt,
  }
}

// ---------------------------------------------------------------------------
// rkap_phases — pembacaan
// ---------------------------------------------------------------------------

/** Membaca satu fase berdasar id. */
export async function findPhaseById(
  reader: Reader,
  id: Uuid,
): Promise<PhaseRow | null> {
  const rows = await reader
    .select()
    .from(rkapPhases)
    .where(eq(rkapPhases.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toPhaseRow(row) : null
}

/**
 * Membaca fase aktif (`is_active = true`) terbaru — dipakai bila pemanggil tidak
 * menyebut `phaseId`. Bila lebih dari satu (seharusnya tidak), ambil terbaru.
 */
export async function findActivePhase(
  reader: Reader,
): Promise<PhaseRow | null> {
  const rows = await reader
    .select()
    .from(rkapPhases)
    .where(eq(rkapPhases.isActive, true))
    .orderBy(desc(rkapPhases.createdAt))
    .limit(1)

  const row = rows[0]
  return row ? toPhaseRow(row) : null
}

// ---------------------------------------------------------------------------
// capital_items — pembacaan
// ---------------------------------------------------------------------------

/** Seluruh Capital Item milik satu fase, terurut sesuai urutan pembuatan. */
export async function findItemsByPhase(
  reader: Reader,
  phaseId: Uuid,
): Promise<CapitalItemRow[]> {
  const rows = await reader
    .select()
    .from(capitalItems)
    .where(eq(capitalItems.phaseId, phaseId))
    .orderBy(capitalItems.createdAt)

  return rows.map(toCapitalItemRow)
}

// ---------------------------------------------------------------------------
// Penetapan fase — penulisan (SELALU in-tx, AD-2)
// ---------------------------------------------------------------------------

/** Menyisipkan satu baris fase DI DALAM transaksi `tx`. */
export async function insertPhase(
  tx: Tx,
  values: InsertPhase,
): Promise<PhaseRow> {
  const [row] = await tx
    .insert(rkapPhases)
    .values({
      name: values.name,
      instantAdjustmentBudget: values.instantAdjustmentBudget,
      momRef: values.momRef,
    })
    .returning()

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return toPhaseRow(row!)
}

/**
 * Menyisipkan sekumpulan Capital Item milik `phaseId` DI DALAM transaksi `tx`.
 * `finalRequirement` dikunci sama dengan `initialRequirement` saat penetapan.
 */
export async function insertCapitalItems(
  tx: Tx,
  items: InsertCapitalItem[],
): Promise<CapitalItemRow[]> {
  if (items.length === 0) return []
  const rows = await tx
    .insert(capitalItems)
    .values(
      items.map((it) => ({
        phaseId: it.phaseId,
        name: it.name,
        capitalType: it.capitalType,
        initialRequirement: it.initialRequirement,
        finalRequirement: it.finalRequirement,
      })),
    )
    .returning()

  return rows.map(toCapitalItemRow)
}

// ---------------------------------------------------------------------------
// Penyesuaian instant/manual/rebalance — pembacaan & penulisan (SELALU in-tx)
// ---------------------------------------------------------------------------

/**
 * Membaca ringkasan satu baris `ledger_transactions` (Capital Type + Actual)
 * untuk plotting alokasi Fulfillment (FR-23 §23.11). Mengembalikan `null` bila
 * baris tidak ada.
 */
export async function findLedgerTxBrief(
  reader: Reader,
  ledgerTxId: Uuid,
): Promise<LedgerTxBrief | null> {
  const rows = await reader
    .select({
      capitalType: ledgerTransactions.capitalType,
      actualAmount: ledgerTransactions.actualAmount,
    })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, ledgerTxId))
    .limit(1)

  const row = rows[0]
  return row
    ? {
        capitalType: row.capitalType,
        actualAmount: row.actualAmount as MoneyString,
      }
    : null
}

/** Membaca satu Capital Item berdasar id (untuk validasi penyesuaian). */
export async function findItemById(
  reader: Reader,
  id: Uuid,
): Promise<CapitalItemRow | null> {
  const rows = await reader
    .select()
    .from(capitalItems)
    .where(eq(capitalItems.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toCapitalItemRow(row) : null
}

/**
 * Menaikkan `finalRequirement` sebuah Capital Item sebesar `delta` DI DALAM
 * transaksi `tx`. `delta` diasumsikan non-negatif (validasi di service).
 * Mengembalikan baris terbaru.
 */
export async function raiseFinalRequirement(
  tx: Tx,
  itemId: Uuid,
  delta: MoneyString,
): Promise<CapitalItemRow> {
  const [row] = await tx
    .update(capitalItems)
    .set({
      finalRequirement: sql`${capitalItems.finalRequirement} + ${delta}`,
    })
    .where(eq(capitalItems.id, itemId))
    .returning()

  return toCapitalItemRow(row!)
}

/**
 * Menetapkan `finalRequirement` sebuah Capital Item ke nilai absolut `value`
 * DI DALAM transaksi `tx` (dipakai rebalance yang menghitung target akhir).
 */
export async function setFinalRequirement(
  tx: Tx,
  itemId: Uuid,
  value: MoneyString,
): Promise<CapitalItemRow> {
  const [row] = await tx
    .update(capitalItems)
    .set({ finalRequirement: value })
    .where(eq(capitalItems.id, itemId))
    .returning()

  return toCapitalItemRow(row!)
}

/**
 * Menaikkan kolom `fulfillment` sebuah Capital Item sebesar `delta` DI DALAM
 * transaksi `tx` (plotting alokasi Fulfillment, FR-23 §23.11). `delta`
 * diasumsikan non-negatif (validasi di service). Mengembalikan baris terbaru.
 */
export async function addFulfillment(
  tx: Tx,
  itemId: Uuid,
  delta: MoneyString,
): Promise<CapitalItemRow> {
  const [row] = await tx
    .update(capitalItems)
    .set({
      fulfillment: sql`${capitalItems.fulfillment} + ${delta}`,
    })
    .where(eq(capitalItems.id, itemId))
    .returning()

  return toCapitalItemRow(row!)
}

/**
 * Menambah akumulasi penyesuaian fase (`instant_adjustment_used`) sebesar
 * `delta` DI DALAM transaksi `tx`. `delta` non-negatif (validasi di service).
 */
export async function addUsedAdjustment(
  tx: Tx,
  phaseId: Uuid,
  delta: MoneyString,
): Promise<PhaseRow> {
  const [row] = await tx
    .update(rkapPhases)
    .set({
      instantAdjustmentUsed: sql`${rkapPhases.instantAdjustmentUsed} + ${delta}`,
    })
    .where(eq(rkapPhases.id, phaseId))
    .returning()

  return toPhaseRow(row!)
}

// Instance `db` bound-schema di-reexport agar service dapat memakai pembacaan
// di luar transaksi (view fase/tabel FR-23) tanpa mengimpor db lagi.
export { db }
