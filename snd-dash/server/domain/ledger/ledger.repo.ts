// server/domain/ledger/ledger.repo.ts
//
// Lapisan data domain ledger (AD-1/AD-4). Menerjemahkan append ledger, pemeliharaan
// proyeksi `positions`, pembacaan proyeksi, dan rekomputasi penuh dari ledger ke
// query Drizzle atas tabel `ledger_transactions` (append-only, AD-1) dan
// `positions` (proyeksi per (owner, capital_type), AD-4). Tanpa aturan bisnis —
// orkestrasi (weighting, transaksi, event, rekonsiliasi) ada di
// `ledger.service.ts`.
//
// Tabel (schema.ts):
//   ledger_transactions : id, ownerId, capitalType, quantity/shares/ceil (int),
//                         finalPrice/actualAmount numeric(18,2), finalPriceRef,
//                         buyOrderId?, capitalItemId?, paymentDate (date),
//                         paymentMethod, compensationOfId?, actor, effectiveAt
//   positions           : id, ownerId, capitalType, quantity/shares/ceil (int),
//                         actualAmount numeric(18,2), updatedAt
//                         UNIQUE (owner_id, capital_type)  ← satu baris per tipe
//
// Konvensi uang (AD-10): kolom numeric dibaca/ditulis sebagai string berskala
// tetap; agregat rupiah dijumlahkan lewat pembungkus Decimal di `./decimal`,
// TIDAK pernah `Number()`/`parseFloat()`.

import { eq, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import { Decimal, toMoney } from '../../../shared/domain/decimal'
import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'
import type { LedgerTransaction, Position } from './ledger.model'

const { ledgerTransactions, positions } = schema

// ---------------------------------------------------------------------------
// Tipe baca/tulis lapisan data
// ---------------------------------------------------------------------------

/** Nilai INSERT satu baris `ledger_transactions` (append-only, AD-1). */
export interface InsertLedgerRow {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  shares: number
  ceil: number
  finalPrice: MoneyString
  finalPriceRef: Uuid
  actualAmount: MoneyString
  buyOrderId?: Uuid | null
  capitalItemId?: Uuid | null
  paymentDate: JakartaDate
  paymentMethod: string
  compensationOfId?: Uuid | null
  actor?: 'user' | 'system'
  effectiveAt?: Date
}

/** Delta yang diterapkan ke satu baris proyeksi `positions` (in-tx). */
export interface PositionDeltas {
  quantity: number
  shares: number
  ceil: number
  /** Delta dana riil (MoneyString) — boleh negatif untuk kompensasi. */
  actualAmount: MoneyString
}

/**
 * Baris agregat per (owner, capital_type) — bentuk umum yang dipakai baik oleh
 * pembacaan proyeksi `positions` maupun hasil rekomputasi dari ledger.
 */
export interface PositionRow {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  shares: number
  ceil: number
  actualAmount: MoneyString
}

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Pemeta baris → tipe domain
// ---------------------------------------------------------------------------

function toLedgerTransaction(
  r: typeof ledgerTransactions.$inferSelect,
): LedgerTransaction {
  return {
    id: r.id as Uuid,
    ownerId: r.ownerId as Uuid,
    capitalType: r.capitalType,
    quantity: r.quantity,
    shares: r.shares,
    ceil: r.ceil,
    finalPrice: r.finalPrice as MoneyString,
    finalPriceRef: r.finalPriceRef as Uuid,
    actualAmount: r.actualAmount as MoneyString,
    buyOrderId: (r.buyOrderId as Uuid | null) ?? null,
    capitalItemId: (r.capitalItemId as Uuid | null) ?? null,
    paymentDate: r.paymentDate as JakartaDate,
    paymentMethod: r.paymentMethod,
    compensationOfId: (r.compensationOfId as Uuid | null) ?? null,
    actor: r.actor,
    effectiveAt: r.effectiveAt,
  }
}

function toPositionRow(r: typeof positions.$inferSelect): PositionRow {
  return {
    ownerId: r.ownerId as Uuid,
    capitalType: r.capitalType,
    quantity: r.quantity,
    shares: r.shares,
    ceil: r.ceil,
    actualAmount: r.actualAmount as MoneyString,
  }
}

// ---------------------------------------------------------------------------
// Perakit Position dari baris per-tipe (proyeksi/rekomputasi → Record by-type)
// ---------------------------------------------------------------------------

/** Record by-type nol untuk field integer (quantity/shares/ceil). */
function zeroIntByType(): Record<CapitalType, number> {
  return {
    'Modal Tetap': 0,
    'Modal Bergerak': 0,
    'Modal Operasional': 0,
  }
}

/** Record by-type '0.00' untuk field uang (actualAmount). */
function zeroMoneyByType(): Record<CapitalType, MoneyString> {
  return {
    'Modal Tetap': toMoney(0),
    'Modal Bergerak': toMoney(0),
    'Modal Operasional': toMoney(0),
  }
}

/**
 * Merakit satu `Position` (Record by-type) dari kumpulan baris per-tipe milik
 * SATU owner. Tipe yang tidak muncul pada baris diisi nol (proyeksi AD-4 tak
 * wajib memiliki baris untuk semua tipe).
 */
export function assembleOwnerPosition(
  ownerId: Uuid,
  rows: PositionRow[],
): Position {
  const position: Position = {
    ownerId,
    quantityByType: zeroIntByType(),
    sharesByType: zeroIntByType(),
    ceilByType: zeroIntByType(),
    actualByType: zeroMoneyByType(),
  }
  for (const row of rows) {
    position.quantityByType[row.capitalType] = row.quantity
    position.sharesByType[row.capitalType] = row.shares
    position.ceilByType[row.capitalType] = row.ceil
    position.actualByType[row.capitalType] = row.actualAmount
  }
  return position
}

/**
 * Mengelompokkan sekumpulan baris per-tipe (banyak owner) menjadi daftar
 * `Position` per owner. Urutan owner mengikuti kemunculan pertama pada `rows`.
 */
export function assemblePositions(rows: PositionRow[]): Position[] {
  const byOwner = new Map<Uuid, PositionRow[]>()
  for (const row of rows) {
    const list = byOwner.get(row.ownerId)
    if (list) list.push(row)
    else byOwner.set(row.ownerId, [row])
  }
  const result: Position[] = []
  for (const [ownerId, ownerRows] of byOwner) {
    result.push(assembleOwnerPosition(ownerId, ownerRows))
  }
  return result
}

// ---------------------------------------------------------------------------
// ledger_transactions — append-only (AD-1)
// ---------------------------------------------------------------------------

/**
 * Menyisipkan satu baris ledger DI DALAM transaksi `tx` (append-only, AD-1).
 * Tidak pernah UPDATE/DELETE baris ledger — koreksi memakai entry kompensasi.
 */
export async function insertLedgerRow(
  tx: Tx,
  values: InsertLedgerRow,
): Promise<LedgerTransaction> {
  const [row] = await tx
    .insert(ledgerTransactions)
    .values({
      ownerId: values.ownerId,
      capitalType: values.capitalType,
      quantity: values.quantity,
      shares: values.shares,
      ceil: values.ceil,
      finalPrice: values.finalPrice,
      finalPriceRef: values.finalPriceRef,
      actualAmount: values.actualAmount,
      buyOrderId: values.buyOrderId ?? null,
      capitalItemId: values.capitalItemId ?? null,
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
      compensationOfId: values.compensationOfId ?? null,
      actor: values.actor ?? 'user',
      ...(values.effectiveAt ? { effectiveAt: values.effectiveAt } : {}),
    })
    .returning()

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return toLedgerTransaction(row!)
}

/**
 * Membaca satu baris `ledger_transactions` berdasarkan `id`. Dipakai jalur
 * kompensasi (FR-21 §21.4) untuk membaca baris asal dan menurunkan nilai
 * pembalik (negasi quantity/shares/ceil/actual). Mengembalikan `null` bila id
 * tak ada. Menerima `Tx` (in-tx) maupun `db` bound-schema.
 */
export async function getLedgerRowById(
  reader: Reader,
  id: Uuid,
): Promise<LedgerTransaction | null> {
  const rows = await reader
    .select()
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, id))
    .limit(1)

  const row = rows[0]
  return row ? toLedgerTransaction(row) : null
}

/**
 * Menghitung TRUE bila owner belum memiliki baris ledger efektif apa pun
 * (deteksi Pembelian Pertama, FR-1). Entry kompensasi (`compensationOfId`
 * non-null) TIDAK dihitung sebagai transaksi efektif perdana. Dijalankan in-tx.
 */
export async function hasNoEffectiveLedger(
  reader: Reader,
  ownerId: Uuid,
): Promise<boolean> {
  const rows = await reader
    .select({ id: ledgerTransactions.id })
    .from(ledgerTransactions)
    .where(
      sql`${ledgerTransactions.ownerId} = ${ownerId} AND ${ledgerTransactions.compensationOfId} IS NULL`,
    )
    .limit(1)

  return rows.length === 0
}

// ---------------------------------------------------------------------------
// positions — proyeksi read-modify-write in-tx (AD-4)
// ---------------------------------------------------------------------------

/**
 * Membaca satu baris proyeksi `positions` untuk (owner, capital_type) DI DALAM
 * transaksi `tx`. Mengembalikan `null` bila belum ada baris untuk kombinasi itu.
 */
export async function readPositionRow(
  reader: Reader,
  ownerId: Uuid,
  capitalType: CapitalType,
): Promise<PositionRow | null> {
  const rows = await reader
    .select()
    .from(positions)
    .where(
      sql`${positions.ownerId} = ${ownerId} AND ${positions.capitalType} = ${capitalType}`,
    )
    .limit(1)

  const row = rows[0]
  return row ? toPositionRow(row) : null
}

/**
 * Menerapkan `deltas` ke proyeksi `positions` untuk (owner, capital_type) DI
 * DALAM transaksi `tx` (AD-4). Read-modify-write: bila baris belum ada, INSERT
 * baris baru dari delta; bila ada, UPDATE dengan menambahkan delta ke nilai
 * tersimpan (uang dijumlahkan via Decimal — AD-10). Mengembalikan baris final.
 *
 * Delta boleh negatif (entry kompensasi/pembalik).
 */
export async function upsertPosition(
  tx: Tx,
  ownerId: Uuid,
  capitalType: CapitalType,
  deltas: PositionDeltas,
): Promise<PositionRow> {
  const existing = await readPositionRow(tx, ownerId, capitalType)

  if (!existing) {
    const [row] = await tx
      .insert(positions)
      .values({
        ownerId,
        capitalType,
        quantity: deltas.quantity,
        shares: deltas.shares,
        ceil: deltas.ceil,
        actualAmount: deltas.actualAmount,
        updatedAt: new Date(),
      })
      .returning()
    return toPositionRow(row!)
  }

  const nextActual = toMoney(
    new Decimal(existing.actualAmount).plus(new Decimal(deltas.actualAmount)),
  )

  const [row] = await tx
    .update(positions)
    .set({
      quantity: existing.quantity + deltas.quantity,
      shares: existing.shares + deltas.shares,
      ceil: existing.ceil + deltas.ceil,
      actualAmount: nextActual,
      updatedAt: new Date(),
    })
    .where(
      sql`${positions.ownerId} = ${ownerId} AND ${positions.capitalType} = ${capitalType}`,
    )
    .returning()

  return toPositionRow(row!)
}

/** Membaca seluruh baris proyeksi `positions` (semua owner, semua tipe). */
export async function readPositions(reader: Reader): Promise<PositionRow[]> {
  const rows = await reader.select().from(positions)
  return rows.map(toPositionRow)
}

/** Membaca seluruh baris proyeksi `positions` milik satu owner (per tipe). */
export async function readOwnerPositionRows(
  reader: Reader,
  ownerId: Uuid,
): Promise<PositionRow[]> {
  const rows = await reader
    .select()
    .from(positions)
    .where(eq(positions.ownerId, ownerId))
  return rows.map(toPositionRow)
}

// ---------------------------------------------------------------------------
// Rekomputasi penuh dari ledger (AD-4) — pembanding rekonsiliasi, BUKAN tulis
// ---------------------------------------------------------------------------

/**
 * Rekomputasi penuh agregat posisi dari `ledger_transactions` yang
 * dikelompokkan per (owner, capital_type): Σ quantity, Σ shares, Σ ceil, Σ
 * actual_amount. Termasuk entry kompensasi (delta negatif) sehingga hasilnya
 * adalah posisi bersih yang SEHARUSNYA tercermin pada proyeksi (AD-4).
 *
 * Ini adalah SUMBER PEMBANDING untuk `recomputeFromLedger` — TIDAK menulis
 * apa pun. Jumlah uang diagregasi di DB (numeric) lalu dinormalkan half-up.
 */
export async function recomputeAggregate(
  reader: Reader,
): Promise<PositionRow[]> {
  const rows = await reader
    .select({
      ownerId: ledgerTransactions.ownerId,
      capitalType: ledgerTransactions.capitalType,
      quantity: sql<string>`sum(${ledgerTransactions.quantity})`,
      shares: sql<string>`sum(${ledgerTransactions.shares})`,
      ceil: sql<string>`sum(${ledgerTransactions.ceil})`,
      actualAmount: sql<string>`sum(${ledgerTransactions.actualAmount})`,
    })
    .from(ledgerTransactions)
    .groupBy(ledgerTransactions.ownerId, ledgerTransactions.capitalType)

  return rows.map((r) => ({
    ownerId: r.ownerId as Uuid,
    capitalType: r.capitalType,
    // sum() atas kolom integer memberi string angka bulat; parse via Decimal.
    quantity: new Decimal(r.quantity ?? '0').toNumber(),
    shares: new Decimal(r.shares ?? '0').toNumber(),
    ceil: new Decimal(r.ceil ?? '0').toNumber(),
    actualAmount: toMoney(new Decimal(r.actualAmount ?? '0')),
  }))
}

// Instance `db` bound-schema di-reexport agar service dapat membaca di luar
// transaksi (view proyeksi/rekonsiliasi) tanpa mengimpor db lagi.
export { db }
