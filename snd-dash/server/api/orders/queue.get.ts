// server/api/orders/queue.get.ts
//
// Route handler TIPIS Antrian Beli untuk tampilan COO (FR-19 §19.6).
//
// Pola (design.md B.7): assertSurfaceAccess('queue_coo') (COO-only, §15.2/§15.3)
// → OrdersModule.listQueueForCoo → render. Seluruh Antrian Beli hanya tampil bagi
// COO yang bertugas; Owner biasa → FORBIDDEN (dipetakan 403).
//
// Nilai `lockedPrice` sudah MoneyString berskala tetap — dikembalikan apa adanya
// (AD-10). `defineApiHandler` menjamin Cache-Control: no-store (AD-12).

import { orders } from '../../domain/orders'
import { assertSurfaceAccess } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { defineApiHandler } from '../../utils/http'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'queue_coo')

  const rows = await orders.listQueueForCoo()
  return { data: rows }
})
