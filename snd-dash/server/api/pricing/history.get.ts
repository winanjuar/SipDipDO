// server/api/pricing/history.get.ts
//
// FR-6.2 — Seluruh riwayat harga untuk `kind` (menaik per effective_date).
// Route TIPIS: parse → assertSurfaceAccess ('price_history', §15.6) → pintu
// pricing.priceHistory → kembalikan nilai desimal apa adanya (AD-10).
//
// KONTRAK
//   GET /api/pricing/history?kind=beli
//   200: { data: PricePeriod[] }

import { pricing } from '../../domain/pricing'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal } from '../../utils/session'
import { parseKind } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'price_history')

  const kind = parseKind(getQuery(event).kind)
  const history = await pricing.priceHistory(kind)
  return { data: history }
})
