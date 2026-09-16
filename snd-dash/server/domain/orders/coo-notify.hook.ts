// server/domain/orders/coo-notify.hook.ts
//
// Hook notifikasi COO saat sebuah Pesanan Pembelian di-submit (FR-19 §19.8).
//
// PROOFS/ProofsModule (task 15) BELUM ter-wire sebagai pintu `enqueueEmail`.
// Selama itu, hook ini menulis satu baris `email_outbox` bertanda
// `kind: 'coo_notify'` DI DALAM transaksi submit sebagai titik integrasi yang
// jelas — sejalan dengan pola `server/domain/ledger/proof.hook.ts`.
//
// GANTI isi fungsi ini dengan `proofs.enqueueEmail(tx, …)` saat task 15 selesai,
// TANPA mengubah pemanggil (`submitOrder`). JANGAN hard-fail bila enqueue gagal:
// pesanan sudah tersimpan sah; drain/retry adalah tanggung jawab PROOFS (AD-5).
// Kegagalan enqueue ditelan (best-effort).

import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { CapitalType, Uuid } from '../../../shared/domain/types'

const { emailOutbox } = schema

/** Ringkasan pesanan untuk isi notifikasi COO. */
export interface CooNotifyPayload {
  orderId: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
}

/**
 * Meng-enqueue notifikasi COO "pesanan baru menunggu konfirmasi" DI DALAM
 * transaksi submit (AD-5), best-effort. `recipient` (email COO) opsional — bila
 * kosong, PROOFS meresolve tujuan saat drain. Kegagalan enqueue TIDAK
 * membatalkan submit.
 *
 * TODO(task 15): ganti dengan `proofs.enqueueEmail(tx, …)`.
 */
export async function enqueueCooNotifyHook(
  tx: Tx,
  order: CooNotifyPayload,
  recipient?: string | null,
): Promise<void> {
  try {
    await tx.insert(emailOutbox).values({
      recipient: recipient ?? '',
      subject: 'Pesanan Pembelian Baru Menunggu Konfirmasi',
      body:
        `Pesanan Pembelian baru (${order.quantity} ${order.capitalType}) ` +
        `menunggu konfirmasi Anda.`,
      payload: {
        kind: 'coo_notify',
        orderId: order.orderId,
        ownerId: order.ownerId,
        capitalType: order.capitalType,
        quantity: order.quantity,
      },
    })
  } catch {
    // Best-effort: PROOFS menangani retry/alert saat drain (AD-5).
  }
}
