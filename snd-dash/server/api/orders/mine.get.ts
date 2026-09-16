// server/api/orders/mine.get.ts
//
// Route handler TIPIS "Pesanan Saya" (FR-19 §19.7, FR-15 §15.4).
//
// Pola (design.md B.7): assertSurfaceAccess('orders_own') →
// OrdersModule.listMyOrders(principal.ownerId) → render. Owner HANYA melihat
// pesanan miliknya sendiri (§15.4): ownerId diambil dari principal sesi, bukan
// dari query, sehingga tak ada Owner yang bisa melihat pesanan Owner lain.
//
// Nilai `lockedPrice` sudah MoneyString berskala tetap — dikembalikan apa adanya
// (AD-10). `defineApiHandler` menjamin Cache-Control: no-store (AD-12).

import { orders } from '../../domain/orders'
import { assertSurfaceAccess } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { defineApiHandler } from '../../utils/http'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'orders_own')

  const rows = await orders.listMyOrders(principal.ownerId)
  return { data: rows }
})
