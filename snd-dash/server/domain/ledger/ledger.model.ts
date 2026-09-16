// server/domain/ledger/ledger.model.ts
//
// Tipe domain modul ledger (AD-1/AD-4). `ledger_transactions` adalah SATU-SATUNYA
// penulis posisi kepemilikan (AD-1); `positions` adalah proyeksi turunannya yang
// dipelihara IN-TX saat append ledger (AD-4). File ini hanya mendefinisikan tipe
// TS (tanpa I/O): entitas ledger, proyeksi Position, dan input tulis internal.
//
// Referensi: design.md "Data Models" (LedgerTransaction, Position) dan A.4
// LedgerModule. Semua nilai uang berupa `MoneyString` berskala tetap (AD-10);
// Quantity/Shares/Ceil adalah integer.

import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Entitas ledger (append-only, AD-1)
// ---------------------------------------------------------------------------

/**
 * Satu baris `ledger_transactions` — catatan transaksi efektif append-only (AD-1).
 * Sumber kebenaran seluruh posisi/tampilan turunan (tabel FR-4, chart FR-18,
 * RKAP Fulfillment). Nilai harga/dana disimpan sebagai NILAI ter-snapshot (AD-7),
 * bukan FK-resolve.
 */
export interface LedgerTransaction {
  id: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  /** Quantity — integer. */
  quantity: number
  /** Shares = Quantity × bobot jenis modal — integer. */
  shares: number
  /** Ceil = Quantity × plafon jenis modal — integer. */
  ceil: number
  /** Harga final ter-snapshot (nilai, bukan FK-resolve) — AD-7. */
  finalPrice: MoneyString
  /** FK price_periods (baris asal saja). */
  finalPriceRef: Uuid
  /** Dana riil disetor (Actual). */
  actualAmount: MoneyString
  /** NULL untuk input langsung / migrasi. */
  buyOrderId: Uuid | null
  /** Plotting (Tetap/Bergerak); NULL Operasional. */
  capitalItemId: Uuid | null
  paymentDate: JakartaDate
  /** 'migrasi' bila historis tak diketahui. */
  paymentMethod: string
  /** Entry kompensasi menunjuk baris asal (AD-1). */
  compensationOfId: Uuid | null
  actor: 'user' | 'system'
  /** Waktu efektif (timestamptz UTC). */
  effectiveAt: Date
}

// ---------------------------------------------------------------------------
// Proyeksi Position (AD-4) — teragregasi per-tipe dalam Record
// ---------------------------------------------------------------------------

/**
 * Proyeksi posisi kepemilikan seorang owner (AD-4). Agregat per Capital Type
 * dirakit menjadi `Record<CapitalType, …>` dari baris `positions` per
 * (owner_id, capital_type). Dipelihara in-tx saat append ledger — BUKAN sumber
 * tulis; sumber kebenaran tetap `ledger_transactions` (AD-1).
 */
export interface Position {
  ownerId: Uuid
  quantityByType: Record<CapitalType, number>
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
  actualByType: Record<CapitalType, MoneyString>
}

// ---------------------------------------------------------------------------
// Input tulis internal (primitive append-and-project)
// ---------------------------------------------------------------------------

/**
 * Input primitif tulis internal `appendAndProject` (AD-1/AD-4).
 *
 * Ini adalah satu-satunya jalur tulis posisi; dipakai oleh `confirmOrder`
 * (FR-20), `directEntry` (FR-21), `compensationEntry` (AD-1), dan
 * `importHistorical` (FR-14). Nilai `shares`/`ceil` opsional — bila tidak
 * disediakan, dihitung dari `capitalType` × `quantity` via shared/domain
 * weighting.
 *
 * Catatan tanda-tangan angka: untuk entry kompensasi (pembalik), `quantity`
 * (dan turunannya) BOLEH bernilai negatif; `appendAndProject` memproyeksikan
 * delta apa adanya ke `positions`.
 */
export interface AppendInput {
  ownerId: Uuid
  capitalType: CapitalType
  /** Quantity — integer (boleh negatif untuk entry kompensasi). */
  quantity: number
  /** Opsional: Shares (integer). Bila kosong → dihitung dari capitalType×quantity. */
  shares?: number
  /** Opsional: Ceil (integer). Bila kosong → dihitung dari capitalType×quantity. */
  ceil?: number
  finalPrice: MoneyString
  finalPriceRef: Uuid
  actualAmount: MoneyString
  buyOrderId?: Uuid | null
  capitalItemId?: Uuid | null
  paymentDate: JakartaDate
  paymentMethod: string
  compensationOfId?: Uuid | null
  actor?: 'user' | 'system'
  /** Waktu efektif — bila kosong, default `now()` DB. */
  effectiveAt?: Date
}
