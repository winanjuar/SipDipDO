// server/domain/orders/events.ts
//
// Tipe kontrak nilai & error domain ORDERS (FR-1/FR-18/FR-19). Berisi input
// pratinjau/submit, konteks pratinjau, dan `OrdersError` (kode stabil) yang
// membawa HITUNGAN penolakan (Alert Penolakan Terhitung) saat gerbang gagal.
//
// Aturan bisnis (proyeksi murni, resolusi Harga Terkunci, gerbang Strength/RKAP,
// penolakan tanpa baris pesanan + audit, notifikasi COO) ada di
// `orders.service.ts`. Referensi: design.md PART A A.4 OrdersModule + FR-1.

import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  OrderStatus,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Pratinjau perhitungan — input & konteks (previewCalculation)
// ---------------------------------------------------------------------------

/**
 * Input pratinjau perhitungan sebuah calon pesanan (FR-1). Proyeksi dihitung
 * dari posisi terkini + pesanan pending kanonik owner (disediakan lewat
 * `PreviewContext`) + calon (`capitalType` × `quantity`).
 */
export interface OrderPreviewInput {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
}

/**
 * Konteks pratinjau MURNI (AD-6) — nilai yang telah dibaca pemanggil (route/
 * service) agar `previewCalculation` tetap fungsi murni (tanpa I/O) dan
 * menghasilkan hasil identik dengan validasi server.
 *
 * - `posisiTerkini`         : agregat Shares/Ceil efektif owner saat ini.
 * - `pesananPendingKanonik` : seluruh pesanan pending kanonik owner
 *                             (status='menunggu_konfirmasi' AND withdrawn_at IS NULL),
 *                             TIDAK termasuk calon.
 * - `runningPrice`          : harga beli 1 saham berjalan (opsional) — bila
 *                             tersedia bersama `rkapSpace`/proyeksi RTL, dipakai
 *                             menghitung `maxQuantity`.
 * - `rkapSpace`             : sisa ruang RKAP jenis modal calon (Modal Tetap/
 *                             Bergerak) — opsional.
 * - `sisaBatasPenyesuaian`  : sisa batas penyesuaian fase RKAP (untuk
 *                             `maxQuantityRkap`) — opsional (default '0.00').
 */
export interface PreviewContext {
  posisiTerkini: { totalShares: number; totalCeil: number }
  pesananPendingKanonik: Array<{ capitalType: CapitalType; quantity: number }>
  runningPrice?: MoneyString
  rkapSpace?: MoneyString
  sisaBatasPenyesuaian?: MoneyString
}

// ---------------------------------------------------------------------------
// Submit pesanan (submitOrder) — input
// ---------------------------------------------------------------------------

/**
 * Input submit Pesanan Pembelian (FR-1 §1.1–§1.15, §6.3). Submit TIDAK
 * memerlukan MFA (FR-3 §3.3).
 *
 * - `ownerId`         : Owner yang mengajukan pesanan.
 * - `capitalType`     : jenis modal calon.
 * - `quantity`        : Quantity calon (integer ≥ 1).
 * - `referralOwnerId` : referral (WAJIB s.d. Pembelian Pertama efektif, FR-22)
 *                       — opsional bila owner sudah punya ledger efektif.
 * - `submitDate`      : tanggal submit (Jakarta) — dasar resolusi Harga Terkunci
 *                       (FR-6.3 §1.12). Opsional; default hari ini (Jakarta).
 */
export interface SubmitOrderInput {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  referralOwnerId?: Uuid | null
  submitDate?: JakartaDate
}

// ---------------------------------------------------------------------------
// Penolakan terhitung (Alert Penolakan Terhitung) — FR-1 / §12.5
// ---------------------------------------------------------------------------

/** Gerbang yang gagal saat submit (FR-1). Bisa lebih dari satu. */
export type SubmitCheck = 'quantity' | 'strength' | 'rkap_space' | 'referral'

/**
 * Hasil penolakan terhitung saat validasi submit gagal (FR-1). Membawa ANGKA
 * LENGKAP (bukan generik, Error Handling FR-1): proyeksi Strength/Ceil/Shares,
 * ruang RKAP (bila relevan), serta rentang Quantity yang diizinkan (§1.15).
 *
 * Penolakan TIDAK membuat baris pesanan (audit saja) — sehingga penolakan
 * menunjuk `ownerId`, bukan `orderId`.
 */
export interface SubmitRejection {
  ownerId: Uuid
  failed: SubmitCheck[]
  proyeksiStrength?: RatioString
  proyeksiCeil?: number
  proyeksiShares?: number
  /** Ruang RKAP per Capital Type saat submit (uang) bila relevan. */
  ruangRkap?: Record<CapitalType, MoneyString>
  /** Quantity minimal yang diizinkan (selalu 1). */
  minQuantity?: number
  /** Quantity maksimal yang diizinkan (per RKAP/RTL) — bila terhitung. */
  maxQuantity?: number
}

// ---------------------------------------------------------------------------
// Antrian pesanan untuk tampilan COO (listQueueForCoo) — FR-19 §19.6
// ---------------------------------------------------------------------------

/**
 * Baris antrian pesanan pending KANONIK untuk tampilan COO (FR-19 §19.6).
 * Menggabungkan data `buy_orders` dengan nama/email pemilik (`owners`) agar COO
 * dapat mengidentifikasi Owner tanpa lookup tambahan. Akses ditegakkan di route.
 *
 * Hanya pesanan `status='menunggu_konfirmasi' AND withdrawn_at IS NULL` yang
 * disertakan (pending kanonik, AD-2), terurut dari terlama (`submittedAt` asc)
 * agar COO memproses antrian sesuai urutan masuk.
 */
export interface QueueRow {
  orderId: Uuid
  ownerId: Uuid
  /** Nama Owner (`owners.name`) — dapat `null` bila belum diisi. */
  ownerName: string | null
  /** Email Owner (`owners.email`) — selalu ada (unik, AD-7). */
  ownerEmail: string
  capitalType: CapitalType
  quantity: number
  lockedPrice: MoneyString
  submittedAt: Date
}

// ---------------------------------------------------------------------------
// Error domain ORDERS — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain ORDERS yang dikenal (stabil untuk konsumen API). */
export type OrdersErrorCode =
  | 'INVALID_QUANTITY' // Quantity bukan integer / di luar rentang izin (§1.15)
  | 'STRENGTH_EXCEEDED' // proyeksi Strength > 100% saat submit (§1.2/§1.4/§1.7)
  | 'RKAP_SPACE_EXCEEDED' // ruang RKAP Modal Tetap/Bergerak tidak cukup (§1.5)
  | 'REFERRAL_REQUIRED' // Pembelian Pertama tanpa referral sah (§1.x/FR-22)
  | 'SUBMIT_REJECTED' // gabungan lebih dari satu gerbang gagal
  | 'NO_PRICE' // tidak ada harga beli berjalan pada tanggal submit (§1.12)
  | 'NO_ACTIVE_PHASE' // tidak ada fase RKAP aktif untuk validasi ruang (FR-23)
  | 'ORDER_NOT_FOUND' // pesanan tidak ditemukan (dipakai task 11.2)
  | 'NOT_WITHDRAWABLE' // penarikan gagal: bukan pending kanonik / bukan milik owner / sudah ditarik (§19.3)

/**
 * Error domain ORDERS dengan `code` stabil. Route menerjemahkan `code` menjadi
 * status HTTP; pesan bersifat manusiawi (Bahasa Indonesia).
 *
 * `details` opsional membawa payload terstruktur (mis. `SubmitRejection` dengan
 * hitungan lengkap untuk `Alert Penolakan Terhitung`, Error Handling FR-1).
 */
export class OrdersError extends Error {
  readonly code: OrdersErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: OrdersErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'OrdersError'
    this.code = code
    this.details = details
  }
}
