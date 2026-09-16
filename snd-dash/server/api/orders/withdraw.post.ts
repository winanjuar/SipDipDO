// server/api/orders/withdraw.post.ts
//
// Route handler TIPIS penarikan Pesanan Pembelian (FR-19 §19.3, FR-15 §15.4).
//
// Pola (design.md B.7): parse → assertSurfaceAccess('orders_own') →
// OrdersModule.withdrawOrder → render.
//
// - Owner hanya boleh menarik pesanan MILIKNYA (§15.4): kepemilikan diverifikasi
//   di jalur domain via CAS (owner + pending kanonik). Route menegaskan ownerId
//   dari principal sesi (bukan body) sehingga tak ada owner lain yang bisa menarik.
// - `NOT_WITHDRAWABLE` (bukan pending kanonik / sudah ditarik / bukan milik) →
//   respons seragam { code, message, details }.
// - `defineApiHandler` menjamin Cache-Control: no-store (AD-12) + pemetaan error.

import { orders } from '../../domain/orders'
import type { Uuid } from '../../../shared/domain/types'
import { assertSurfaceAccess } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { ApiError, defineApiHandler } from '../../utils/http'

interface WithdrawBody {
  orderId?: unknown
}

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'orders_own')

  const body = (await readBody<WithdrawBody>(event)) ?? {}
  if (typeof body.orderId !== 'string' || body.orderId.length === 0) {
    throw new ApiError('INVALID_ORDER_ID', 'orderId wajib diisi.', 400)
  }

  await orders.withdrawOrder(principal.ownerId, body.orderId as Uuid)
  return { data: { ok: true, orderId: body.orderId } }
})
