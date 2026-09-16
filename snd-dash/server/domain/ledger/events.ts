// server/domain/ledger/events.ts
//
// Tipe kontrak nilai & event domain ledger (AD-1/AD-4). Berisi:
//   - LedgerAppended       : event post-commit "baris ledger baru + proyeksi ter-update"
//                            (dipakai jalur reaktif PROOFS/dashboard via outbox, AD-5).
//   - ReconReport          : keluaran `recomputeFromLedger` — pembanding rekonsiliasi
//                            proyeksi vs agregat hasil rekomputasi (BUKAN jalur tulis, AD-4).
//   - LedgerSnapshot       : struktur snapshot imutabel state ledger pada titik potong
//                            (`cutPointSnapshot`) — dipakai proofs/distribution.
//   - LedgerError          : error domain ledger dengan kode stabil.
//
// Aturan bisnis (append-and-project, rekonsiliasi) ada di `ledger.service.ts`.
// Referensi: design.md A.4 LedgerModule + Requirement 4 (FR-4).

import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'
import type { LedgerTransaction, Position } from './ledger.model'
import type { PlottingPlan } from '../rkap'

// ---------------------------------------------------------------------------
// Event: baris ledger baru + proyeksi ter-update (AD-5, post-commit)
// ---------------------------------------------------------------------------

/**
 * Event yang diterbitkan saat sebuah transaksi ledger di-append dan proyeksi
 * `positions` ter-update dalam transaksi yang sama (AD-1/AD-4). Jalur reaktif
 * (Bukti Transaksi FR-11, penyegaran dashboard/chart FR-20 §10) bereaksi
 * post-commit via outbox (AD-5) memakai `ledgerTxId`.
 */
export interface LedgerAppended {
  ledgerTxId: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  /** Snapshot posisi owner setelah append (proyeksi ter-update). */
  position: Position
}

// ---------------------------------------------------------------------------
// Rekonsiliasi (recomputeFromLedger) — pembanding, BUKAN jalur tulis (AD-4)
// ---------------------------------------------------------------------------

/**
 * Satu ketidakcocokan antara proyeksi `positions` yang tersimpan dan agregat
 * hasil rekomputasi penuh dari `ledger_transactions`, pada granularitas
 * (owner, capital_type). Setiap field membawa nilai proyeksi vs rekomputasi.
 */
export interface ReconMismatch {
  ownerId: Uuid
  capitalType: CapitalType
  field: 'quantity' | 'shares' | 'ceil' | 'actualAmount'
  /** Nilai pada proyeksi `positions` tersimpan (string agar seragam uang/integer). */
  projected: string
  /** Nilai hasil rekomputasi dari ledger. */
  recomputed: string
}

/**
 * Laporan rekonsiliasi keluaran `recomputeFromLedger` (AD-4).
 *
 * Membandingkan proyeksi `positions` yang tersimpan dengan agregat hasil
 * rekomputasi penuh dari ledger. `balanced` true bila tak ada mismatch. Ini
 * adalah ALAT PEMBANDING — TIDAK menulis apa pun ke DB.
 */
export interface ReconReport {
  /** true bila proyeksi & rekomputasi identik pada semua (owner, capital_type). */
  balanced: boolean
  /** Waktu rekonsiliasi dijalankan (UTC). */
  checkedAt: Date
  /** Jumlah baris (owner, capital_type) yang diperiksa (union proyeksi ∪ rekomputasi). */
  comparedRows: number
  /** Daftar ketidakcocokan (kosong bila `balanced`). */
  mismatches: ReconMismatch[]
}

// ---------------------------------------------------------------------------
// Snapshot titik potong (cutPointSnapshot) — pembacaan murni imutabel
// ---------------------------------------------------------------------------

/**
 * Baris agregat per owner pada sebuah snapshot titik potong, memuat total
 * gabungan Shares/Ceil dan Strength turunannya (Σ Shares ÷ Σ Ceil).
 */
export interface LedgerSnapshotOwner {
  ownerId: Uuid
  quantityByType: Record<CapitalType, number>
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
  actualByType: Record<CapitalType, MoneyString>
  /** Σ Shares gabungan semua Capital Type. */
  totalShares: number
  /** Σ Ceil gabungan semua Capital Type. */
  totalCeil: number
  /** Strength = Σ Shares ÷ Σ Ceil (fraksi; half-up 2 desimal saat display). */
  strength: RatioString
}

/**
 * Snapshot imutabel state ledger pada suatu titik potong (cut point). Dipakai
 * oleh Bukti Transaksi (FR-11) dan distribusi laba (FR-16) sebagai basis
 * perhitungan yang stabil. Struktur murni-baca — tidak mengikat koneksi DB.
 */
export interface LedgerSnapshot {
  /** Waktu snapshot diambil (UTC). */
  takenAt: Date
  /** Posisi per owner pada titik potong. */
  owners: LedgerSnapshotOwner[]
  /** Grand total Shares seluruh owner (basis Portion). */
  grandTotalShares: number
  /** Grand total Ceil seluruh owner. */
  grandTotalCeil: number
}

// ---------------------------------------------------------------------------
// Finalisasi konfirmasi (FR-20) — input & hasil penolakan terhitung
// ---------------------------------------------------------------------------

/**
 * Penyesuaian instant overshoot pembulatan ke atas (FR-20 §20.7, FR-23 §23.9)
 * yang menyertai finalisasi. `PlottingPlan` (rkap) TIDAK membawa nilai
 * overshoot, maka jalur finalisasi menerimanya terpisah: Capital Item ter-plot
 * yang Final Requirement-nya dinaikkan (`capitalItemId`) sebesar `overshoot`.
 * Dilewati (no-op) bila `overshoot` kosong/0 atau Capital Type non-RKAP.
 */
export interface OvershootAdjustment {
  capitalItemId: Uuid
  overshoot: MoneyString
}

/**
 * Input finalisasi konfirmasi Pesanan Pembelian (FR-20) — design.md B.4.
 *
 * - `orderId`       : `buy_orders.id` pesanan pending kanonik yang dikonfirmasi.
 * - `cooId`         : COO yang mengonfirmasi; otoritas dicek in-tx (AD-8).
 * - `code`          : kode OTP aksi 'konfirmasi' terikat (`orderId`) — diverifikasi
 *                     & dikonsumsi HANYA setelah re-validasi gerbang lolos (§20.2/§20.5).
 * - `paymentDate`   : tanggal pembayaran riil (Jakarta) — dicatat pada ledger.
 * - `paymentMethod` : metode pembayaran (mis. 'transfer').
 * - `plotting`      : rencana plotting Fulfillment COO; bila kosong → FIFO default (§23.12).
 * - `overshoot`     : penyesuaian instant pembulatan ke atas (§20.7) — opsional.
 *
 * Harga final = Harga Terkunci pesanan (AD-7/§20.6); TIDAK di-resolve ulang.
 */
export interface ConfirmOrderInput {
  orderId: Uuid
  cooId: Uuid
  code: string
  paymentDate: JakartaDate
  paymentMethod: string
  plotting?: PlottingPlan
  overshoot?: OvershootAdjustment
}

/** Cek re-validasi yang gagal (FR-20 §20.5) — dipakai pada payload penolakan. */
export type RevalidationCheck = 'strength' | 'rkap_space' | 'referral'

/**
 * Hasil penolakan terhitung saat re-validasi konfirmasi gagal (FR-20 §20.5).
 *
 * Membawa ANGKA LENGKAP (bukan generik, Error Handling FR-20): proyeksi
 * Strength/Ceil/Shares saat gerbang Strength gagal, dan ruang RKAP per Capital
 * Type. `failed` menyebut gerbang mana yang gagal (bisa lebih dari satu).
 */
export interface ConfirmRejection {
  orderId: Uuid
  failed: RevalidationCheck[]
  /** Proyeksi Strength gabungan (RatioString) bila gerbang Strength dievaluasi. */
  proyeksiStrength?: RatioString
  proyeksiCeil?: number
  proyeksiShares?: number
  /** Ruang RKAP per Capital Type saat re-validasi (uang) bila relevan. */
  ruangRkap?: Record<CapitalType, MoneyString>
}

// ---------------------------------------------------------------------------
// Input langsung (FR-21) — COO mencatat pembelian atas nama Owner (tanpa buy_order)
// ---------------------------------------------------------------------------

/**
 * Input jalur input langsung (FR-21 §21.1–§21.3) — design.md A.4/B.4.
 *
 * COO mencatat sebuah pembelian LANGSUNG atas nama Owner tanpa Pesanan Pembelian
 * (tanpa Antrian Beli / `buy_order` = NULL). Validasi gerbang Strength sama
 * persis seperti FR-1 (posisi terkini + pesanan pending kanonik Owner + calon);
 * harga = harga berjalan pada TANGGAL INPUT (FR-21 §21.2 / FR-6.4); MFA wajib
 * (aksi 'input_langsung'); referral WAJIB bila Pembelian Pertama (FR-21 §21.3 /
 * FR-22).
 *
 * - `ownerId`        : Owner yang menerima pencatatan kepemilikan.
 * - `capitalType`    : jenis modal calon (Tetap/Bergerak/Operasional).
 * - `quantity`       : Quantity calon (integer > 0).
 * - `cooId`          : COO yang mencatat; otoritas dicek in-tx (AD-8).
 * - `code`           : kode OTP aksi 'input_langsung' terikat `requestId`.
 * - `requestId`      : targetRef OTP (OTP diminta terhadap targetRef yang sama).
 * - `paymentDate`    : tanggal input (Jakarta) — dasar resolusi harga & dicatat.
 * - `paymentMethod`  : metode pembayaran (mis. 'transfer').
 * - `referralOwnerId`: referral (WAJIB bila Pembelian Pertama, FR-22) — opsional
 *                      bila bukan Pembelian Pertama.
 * - `plotting`       : rencana plotting Fulfillment; kosong → FIFO default (§23.12).
 * - `overshoot`      : penyesuaian instant pembulatan ke atas (§20.7) — opsional.
 */
export interface DirectEntryInput {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  cooId: Uuid
  code: string
  /** targetRef OTP aksi 'input_langsung' (tak ada orderId pada jalur ini). */
  requestId: Uuid
  paymentDate: JakartaDate
  paymentMethod: string
  referralOwnerId?: Uuid | null
  plotting?: PlottingPlan
  overshoot?: OvershootAdjustment
}

/**
 * Hasil penolakan terhitung saat validasi input langsung gagal (FR-21 §21.1).
 *
 * Sejalan dengan `ConfirmRejection` (Error Handling FR-20/FR-21): membawa ANGKA
 * LENGKAP proyeksi Strength/Ceil/Shares saat gerbang Strength gagal, dan ruang
 * RKAP per Capital Type. Berbeda dari `ConfirmRejection`, jalur ini TIDAK
 * membuat baris ledger/pesanan pada penolakan (mirror submit FR-1 yang tidak
 * membuat pesanan) → tidak ada `orderId`; sebagai gantinya menunjuk `ownerId`.
 */
export interface DirectEntryRejection {
  ownerId: Uuid
  failed: RevalidationCheck[]
  proyeksiStrength?: RatioString
  proyeksiCeil?: number
  proyeksiShares?: number
  ruangRkap?: Record<CapitalType, MoneyString>
}

// ---------------------------------------------------------------------------
// Entry kompensasi (AD-1 / FR-21 §21.4) — koreksi pembalik menunjuk baris asal
// ---------------------------------------------------------------------------

/**
 * Input entry kompensasi/pembalik (AD-1 varian input langsung, FR-21 §21.4).
 *
 * COO mencatat baris kompensasi yang MENUNJUK baris ledger asal
 * (`compensationOfId`) untuk membalik/mengoreksi transaksi efektif. TIDAK ADA
 * re-validasi gerbang (Strength/RKAP tidak dievaluasi) — ini murni koreksi.
 * Tetap membutuhkan otoritas COO in-tx dan MFA (aksi 'kompensasi').
 *
 * Nilai proyeksi delta diturunkan dengan MEMBACA baris asal lalu MENEGASI
 * quantity/shares/ceil/actual (agar posisi net-off); harga final memakai
 * `finalPrice`/`finalPriceRef` baris asal.
 *
 * - `compensationOfId`: `ledger_transactions.id` baris asal yang dibalik.
 * - `cooId`           : COO yang mencatat; otoritas dicek in-tx (AD-8).
 * - `code`            : kode OTP aksi 'kompensasi' terikat `compensationOfId`.
 * - `paymentDate`     : tanggal pencatatan kompensasi (Jakarta).
 * - `paymentMethod`   : metode pembayaran (mis. 'transfer').
 * - `reason`          : alasan koreksi (dicatat pada audit).
 */
export interface CompensationInput {
  compensationOfId: Uuid
  cooId: Uuid
  code: string
  paymentDate: JakartaDate
  paymentMethod: string
  reason?: string
}

// ---------------------------------------------------------------------------
// Migrasi historis (FR-14) — baris import mentah (TANPA gerbang & instant adj.)
// ---------------------------------------------------------------------------

/**
 * Satu baris transaksi historis yang diimpor melalui
 * `LedgerModule.importHistorical` (FR-14 §14.1). Ini adalah import MENTAH: TIDAK
 * ada re-validasi gerbang (Strength/RKAP/referral) dan TIDAK ada penyesuaian
 * instant overshoot — data historis diterima apa adanya sebagai transaksi
 * efektif append-only (AD-1) dengan aktor 'system'.
 *
 * Nilai harga/dana di-snapshot apa adanya (AD-7). Karena `finalPriceRef` adalah
 * FK NOT NULL ke `price_periods`, baris migrasi WAJIB menyertakan
 * `finalPriceRef` yang sah (sumber migrasi diharapkan menyediakan/menyemai
 * price period historis).
 *
 * - `ownerId`       : Owner pemilik transaksi historis (sudah di-upsert oleh
 *                     modul migrasi sebelum import).
 * - `capitalType`   : jenis modal (Tetap/Bergerak/Operasional).
 * - `quantity`      : Quantity historis (integer). Shares/Ceil diturunkan via
 *                     shared/domain weighting saat append.
 * - `finalPrice`    : harga final ter-snapshot (nilai, AD-7).
 * - `finalPriceRef` : FK price_periods (WAJIB, NOT NULL di DB).
 * - `actualAmount`  : dana riil disetor historis.
 * - `paymentDate`   : tanggal pembayaran historis (Jakarta).
 * - `paymentMethod` : metode pembayaran; 'migrasi' bila historis tak diketahui
 *                     (default bila kosong).
 * - `capitalItemId` : plotting Capital Item bila diketahui — opsional.
 * - `effectiveAt`   : waktu efektif historis (UTC); bila kosong → now() DB.
 */
export interface MigrationRow {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  finalPrice: MoneyString
  finalPriceRef: Uuid
  actualAmount: MoneyString
  paymentDate: JakartaDate
  paymentMethod?: string
  capitalItemId?: Uuid | null
  effectiveAt?: Date
}

// ---------------------------------------------------------------------------
// Error domain ledger — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain ledger yang dikenal (stabil untuk konsumen API). */
export type LedgerErrorCode =
  | 'OWNER_POSITION_NOT_FOUND' // getOwnerPosition atas owner tanpa baris posisi
  | 'ORDER_NOT_PENDING' // konfirmasi atas pesanan bukan pending kanonik (race/tarik/kedaluwarsa)
  | 'REVALIDATION_FAILED' // re-validasi Strength/ruang RKAP/referral gagal saat konfirmasi (§20.5)
  | 'NO_ACTIVE_PHASE' // tidak ada fase RKAP aktif saat re-validasi ruang RKAP
  | 'DIRECT_ENTRY_REJECTED' // validasi input langsung gagal (Strength/ruang RKAP/referral) — FR-21 §21.1
  | 'REFERRAL_REQUIRED' // Pembelian Pertama tanpa referral sah pada input langsung (FR-21 §21.3/FR-22)
  | 'INVALID_QUANTITY' // Quantity input langsung ≤ 0 (harus integer positif)
  | 'LEDGER_ROW_NOT_FOUND' // baris ledger asal kompensasi tidak ditemukan (FR-21 §21.4)
  | 'INVALID_COMPENSATION_TARGET' // baris asal kompensasi tidak valid (mis. sudah baris kompensasi)

/**
 * Error domain ledger dengan `code` stabil. Route menerjemahkan `code` menjadi
 * status HTTP yang sesuai; pesan bersifat manusiawi (Bahasa Indonesia).
 *
 * `details` opsional membawa payload terstruktur (mis. `ConfirmRejection`
 * dengan hitungan lengkap untuk `Alert Penolakan Terhitung`, Error Handling FR-20).
 */
export class LedgerError extends Error {
  readonly code: LedgerErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: LedgerErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'LedgerError'
    this.code = code
    this.details = details
  }
}
