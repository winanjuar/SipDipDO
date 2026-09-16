// server/domain/orders/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain ORDERS (FR-1/FR-18/FR-19) —
// PEMILIK penuh tabel `buy_orders` (submit/queue/siklus hidup). Modul lain HANYA
// boleh mengimpor dari sini (bukan dari service/repo internal), mengikuti
// design.md PART A A.4 `OrdersModule`.
//
// Cakupan task 11.1 (yang diekspos SEKARANG):
//   previewCalculation(input, ctx) — proyeksi MURNI (AD-6) via shared/domain.
//   submitOrder(input)             — Harga Terkunci + gerbang Strength/RKAP +
//                                    referral; tolak = tanpa baris pesanan (audit
//                                    saja); sukses = pesanan pending + notifikasi COO.
//
// Extensibility (task 11.2): `withdrawOrder`, `listQueueForCoo`, `listMyOrders`,
// `expirePendingOrders` akan ditambahkan pada interface `OrdersModule` + objek
// `orders` ini TANPA mengubah anggota yang sudah ada. Slot didokumentasikan di
// bawah agar penambahan tidak mengubah kontrak yang sudah dirilis.

import type { Tx } from '../../utils/db'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import * as service from './orders.service'
import type { BuyOrder, OrderPreview } from './orders.model'
import type {
  OrderPreviewInput,
  PreviewContext,
  QueueRow,
  SubmitOrderInput,
} from './events'

/**
 * Kontrak lintas-modul domain ORDERS (design.md A.4) — subset yang diekspos pada
 * task 11.1: pratinjau perhitungan + submit.
 *
 * CATATAN EXTENSIBILITY (task 11.2) — anggota berikut akan memperluas interface
 * ini tanpa mengubah tanda tangan yang sudah ada:
 *   withdrawOrder(ownerId: Uuid, orderId: Uuid): Promise<void>              // CAS pending kanonik → set withdrawn_at (FR-18)
 *   listQueueForCoo(): Promise<QueueRow[]>                                  // seluruh pending (COO)
 *   listMyOrders(ownerId: Uuid): Promise<BuyOrder[]>                        // hanya milik owner
 *   expirePendingOrders(tx: Tx, jakartaToday: JakartaDate): Promise<Uuid[]> // cron hari-7 (FR-19)
 */
export interface OrdersModule {
  /**
   * Pratinjau perhitungan calon pesanan (FR-1) — fungsi MURNI (tanpa I/O).
   * Memakai `shared/domain` identik dengan validasi server (AD-6). Konteks
   * (posisi terkini + pesanan pending kanonik + harga/ruang opsional) disediakan
   * pemanggil lewat `PreviewContext`.
   */
  previewCalculation(input: OrderPreviewInput, ctx: PreviewContext): OrderPreview

  /**
   * Submit Pesanan Pembelian (FR-1 §1.1–§1.15, §6.3) — SATU transaksi atomik
   * (AD-2). Resolusi Harga Terkunci pada tanggal submit; gerbang Strength &
   * ruang RKAP & referral. Penolakan TIDAK membuat baris pesanan (audit saja);
   * sukses menyimpan pesanan pending + notifikasi COO (FR-19 §19.8). Tidak
   * memerlukan MFA (FR-3 §3.3).
   */
  submitOrder(input: SubmitOrderInput): Promise<BuyOrder>

  /**
   * Menarik pesanan milik Owner (FR-19 §19.3, FR-15 §15.4) — SATU transaksi
   * atomik. CAS pending kanonik + kepemilikan → set `withdrawn_at`; audit
   * 'order_withdrawn'. Melempar `OrdersError('NOT_WITHDRAWABLE')` bila 0 baris
   * terpengaruh (bukan pending / bukan milik owner / sudah ditarik).
   */
  withdrawOrder(ownerId: Uuid, orderId: Uuid): Promise<void>

  /**
   * Antrian pesanan pending kanonik untuk tampilan COO (FR-19 §19.6), digabung
   * nama/email pemilik, terurut dari terlama. Read-only; akses COO di route.
   */
  listQueueForCoo(): Promise<QueueRow[]>

  /**
   * Seluruh pesanan milik Owner (semua status) — tampilan "Pesanan Saya"
   * (FR-19 §19.7). Read-only; Owner hanya melihat pesanan sendiri (§15.4).
   */
  listMyOrders(ownerId: Uuid): Promise<BuyOrder[]>

  /**
   * Menandai pesanan pending kanonik yang melewati hari-7 sebagai kedaluwarsa
   * (FR-19 §19.4) DI DALAM transaksi cron `tx`; audit 'order_expired' per
   * pesanan. Mengembalikan daftar id yang di-kedaluwarsa-kan.
   */
  expirePendingOrders(tx: Tx, jakartaToday: JakartaDate): Promise<Uuid[]>

  /**
   * Mengunci pesanan pending kanonik untuk finalisasi (`SELECT … FOR UPDATE`,
   * LOCK PERTAMA urutan global, AD-2). Pintu kanonik penguncian `buy_orders`
   * bagi jalur konfirmasi (FR-20). `null` bila bukan pending kanonik. In-tx.
   */
  lockPendingForConfirm(tx: Tx, orderId: Uuid): Promise<BuyOrder | null>
}

/** Implementasi pintu ORDERS — objek tunggal yang memenuhi `OrdersModule`. */
export const orders: OrdersModule = {
  previewCalculation: service.previewCalculation,
  submitOrder: service.submitOrder,
  withdrawOrder: service.withdrawOrder,
  listQueueForCoo: service.listQueueForCoo,
  listMyOrders: service.listMyOrders,
  expirePendingOrders: service.expirePendingOrders,
  lockPendingForConfirm: service.lockPendingForConfirm,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type { BuyOrder, OrderPreview } from './orders.model'
export type {
  OrderPreviewInput,
  PreviewContext,
  QueueRow,
  SubmitOrderInput,
  SubmitRejection,
  SubmitCheck,
  OrdersErrorCode,
} from './events'
export { OrdersError } from './events'

// Helper set-status CAS (rejected/confirmed/expired) diekspos untuk jalur
// finalisasi/cron (FR-20/FR-19). Bukan bagian `OrdersModule` (tanda tangan
// membawa `Tx`); dipakai internal LEDGER saat mengganti CAS sisi-ledger dengan
// pintu ORDERS. Menulis audit status change (§19.1/§19.2).
export {
  setRejected,
  setConfirmed,
  setExpired,
} from './orders.service'
