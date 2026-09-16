// server/domain/ledger/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain ledger — SATU-SATUNYA penulis
// posisi kepemilikan (AD-1). Modul lain HANYA boleh mengimpor dari sini (bukan
// dari service/repo internal), mengikuti design.md PART A A.4 `LedgerModule`.
//
// Cakupan task 10.1 (yang diekspos SEKARANG):
//   appendAndProject(tx, input)     — primitive tulis internal: append ledger +
//                                     proyeksikan `positions` in-tx (AD-1/AD-4).
//   getPositions(tx?)               — baca proyeksi seluruh owner (AD-4).
//   getOwnerPosition(ownerId, tx?)  — baca proyeksi satu owner (AD-4).
//   isFirstEffective(tx, ownerId)   — deteksi Pembelian Pertama (FR-1).
//   cutPointSnapshot(tx?)           — snapshot imutabel titik potong (baca murni).
//   recomputeFromLedger()           — rekonsiliasi (pembanding, BUKAN tulis, AD-4).
//
// Extensibility: `confirmOrder` (FR-20, task 10.3), `directEntry` (FR-21) &
// `compensationEntry` (AD-1, task 10.4), serta `importHistorical` (FR-14, task 16)
// akan ditambahkan pada objek `ledger` + `LedgerModule` ini nanti; keduanya akan
// memakai `appendAndProject` sebagai primitive tulis bersama. Slot dibiarkan
// terdokumentasi di bawah agar penambahan tidak mengubah kontrak yang sudah ada.

import type { Tx } from '../../utils/db'
import type { Uuid } from '../../../shared/domain/types'
import * as service from './ledger.service'
import type { AppendInput, LedgerTransaction, Position } from './ledger.model'
import type {
  CompensationInput,
  ConfirmOrderInput,
  DirectEntryInput,
  LedgerSnapshot,
  MigrationRow,
  ReconReport,
} from './events'

/**
 * Kontrak lintas-modul domain ledger (design.md A.4) — subset yang diekspos pada
 * task 10.1: read/projection + primitive append-and-project.
 *
 * CATATAN EXTENSIBILITY: `importHistorical` (FR-14, task 16) akan memperluas
 * interface ini tanpa mengubah anggota yang sudah ada:
 *   importHistorical(tx: Tx, rows: MigrationRow[]): Promise<void>           // FR-14 (task 16)
 */
export interface LedgerModule {
  /**
   * Finalisasi konfirmasi Pesanan Pembelian (FR-20) — SATU transaksi atomik
   * (AD-2): otoritas COO, lock urutan global, re-validasi Strength/ruang RKAP/
   * referral, verifikasi+konsumsi OTP, append ledger (Harga Terkunci), CAS
   * pesanan → terkonfirmasi, plotting+overshoot, event Pembelian Pertama,
   * enqueue Bukti + audit. Tolak dengan hitungan bila re-validasi gagal.
   */
  confirmOrder(input: ConfirmOrderInput): Promise<LedgerTransaction>

  /**
   * Input langsung (FR-21) — SATU transaksi atomik (AD-2): COO mencatat pembelian
   * LANGSUNG atas nama Owner tanpa Pesanan Pembelian (buy_order NULL / tanpa
   * Antrian Beli). Validasi Strength persis FR-1, harga pada TANGGAL INPUT
   * (FR-6.4), MFA 'input_langsung', referral WAJIB bila Pembelian Pertama.
   * Tolak dengan hitungan bila validasi gagal (tanpa membuat baris ledger).
   */
  directEntry(input: DirectEntryInput): Promise<LedgerTransaction>

  /**
   * Entry kompensasi (AD-1 / FR-21 §21.4) — SATU transaksi atomik: baris pembalik
   * yang MENUNJUK baris ledger asal (`compensationOfId`). TANPA re-validasi
   * gerbang; butuh otoritas COO + MFA 'kompensasi'. Menegasi quantity/shares/
   * ceil/actual (posisi net-off); harga final disalin dari baris asal.
   */
  compensationEntry(input: CompensationInput): Promise<LedgerTransaction>

  /**
   * Primitive tulis internal (AD-1/AD-4): append baris ledger + proyeksikan ke
   * `positions` dalam transaksi yang sama. Dipakai confirmOrder/directEntry/
   * compensationEntry/importHistorical sebagai jalur tulis bersama.
   */
  appendAndProject(tx: Tx, input: AppendInput): Promise<LedgerTransaction>

  /**
   * Impor transaksi historis (FR-14 §14.1) — MENTAH: setiap baris di-append via
   * `appendAndProject` (aktor 'system', paymentMethod 'migrasi' bila tak
   * diketahui) TANPA re-validasi gerbang & TANPA penyesuaian instant. Dipanggil
   * DI DALAM transaksi migrasi teratas (`MigrationModule.run`).
   */
  importHistorical(tx: Tx, rows: MigrationRow[]): Promise<void>

  // Read-only proyeksi (dipakai lintas modul) — AD-4.
  getPositions(tx?: Tx): Promise<Position[]>
  getOwnerPosition(ownerId: Uuid, tx?: Tx): Promise<Position>

  /** Deteksi Pembelian Pertama (FR-1) — dievaluasi in-tx. */
  isFirstEffective(tx: Tx, ownerId: Uuid): Promise<boolean>

  /** Snapshot imutabel titik potong (basis Bukti Transaksi/distribusi) — baca murni. */
  cutPointSnapshot(tx?: Tx): Promise<LedgerSnapshot>

  /** Rekonsiliasi proyeksi vs rekomputasi penuh dari ledger — pembanding, BUKAN tulis (AD-4). */
  recomputeFromLedger(): Promise<ReconReport>
}

/** Implementasi pintu ledger — objek tunggal yang memenuhi `LedgerModule`. */
export const ledger: LedgerModule = {
  confirmOrder: service.confirmOrder,
  directEntry: service.directEntry,
  compensationEntry: service.compensationEntry,
  appendAndProject: service.appendAndProject,
  importHistorical: service.importHistorical,
  getPositions: service.getPositions,
  getOwnerPosition: service.getOwnerPosition,
  isFirstEffective: service.isFirstEffective,
  cutPointSnapshot: service.cutPointSnapshot,
  recomputeFromLedger: service.recomputeFromLedger,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type { LedgerTransaction, Position, AppendInput } from './ledger.model'
export type {
  LedgerAppended,
  ReconReport,
  ReconMismatch,
  LedgerSnapshot,
  LedgerSnapshotOwner,
  LedgerErrorCode,
  ConfirmOrderInput,
  ConfirmRejection,
  RevalidationCheck,
  OvershootAdjustment,
  DirectEntryInput,
  DirectEntryRejection,
  CompensationInput,
  MigrationRow,
} from './events'
export { LedgerError } from './events'
