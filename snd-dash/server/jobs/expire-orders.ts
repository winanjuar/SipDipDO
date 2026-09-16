// server/jobs/expire-orders.ts
//
// Cron kedaluwarsa Pesanan Pembelian hari-7 (FR-19 §19.4) — dipanggil Vercel
// Cron (UTC) melalui endpoint terproteksi `CRON_SECRET` (design.md B.6/AD-9).
//
// INVARIAN ZONA WAKTU (design.md "Deployment topology"): batas hari dihitung DI
// DALAM job memakai zona Asia/Jakarta — `jakartaToday = toJakartaDate(new Date())`
// — BUKAN jam pemicu UTC. Menjalankan cron pada jam UTC berapa pun menghasilkan
// himpunan pesanan kedaluwarsa yang sama selama tanggal kalender Jakarta sama.
//
// ATOMICITY (AD-2): seluruh evaluasi + CAS + audit terjadi dalam SATU transaksi
// (`withTransaction`). Loop per pesanan, CAS + audit, dan definisi hari-7
// (isExpiredDay7) telah dimiliki modul ORDERS pada `orders.expirePendingOrders`
// (task 11.2). Job ini hanya membuka transaksi cron, menghitung tanggal Jakarta,
// dan mendelegasikan ke pintu ORDERS — menjaga single-writer & guard kanonik
// (`status='menunggu_konfirmasi' AND withdrawn_at IS NULL`) tetap di satu tempat.

import { withTransaction } from '../utils/db'
import { toJakartaDate } from '../../shared/domain/calendar'
import type { JakartaDate, Uuid } from '../../shared/domain/types'
import { orders } from '../domain/orders'

/** Hasil satu eksekusi cron kedaluwarsa pesanan. */
export interface ExpireOrdersResult {
  /** Tanggal kalender Asia/Jakarta yang dipakai sebagai acuan hari-7. */
  jakartaToday: JakartaDate
  /** Id pesanan yang berhasil di-kedaluwarsa-kan pada eksekusi ini. */
  expired: Uuid[]
  /** Jumlah pesanan yang di-kedaluwarsa-kan (= `expired.length`). */
  count: number
}

/**
 * Menjalankan kedaluwarsa hari-7 (FR-19 §19.4) dalam SATU transaksi atomik.
 *
 * Langkah:
 *   1. `jakartaToday = toJakartaDate(new Date())` — tanggal kalender Jakarta
 *      dihitung di dalam job (invarian terhadap jam pemicu UTC, AD-9).
 *   2. `orders.expirePendingOrders(tx, jakartaToday)` — untuk tiap pesanan
 *      pending kanonik yang melewati hari-7: CAS → 'kedaluwarsa' + audit
 *      'order_expired' (aktor 'system'), semua in-tx.
 *
 * Mengembalikan tanggal acuan + daftar/jumlah id yang di-kedaluwarsa-kan.
 */
export async function runExpireOrders(): Promise<ExpireOrdersResult> {
  const jakartaToday = toJakartaDate(new Date())

  const expired = await withTransaction((tx) =>
    orders.expirePendingOrders(tx, jakartaToday),
  )

  return { jakartaToday, expired, count: expired.length }
}
