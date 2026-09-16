// server/api/pricing/current.get.ts
//
// FR-6.3 — Harga berjalan untuk `kind` pada tanggal Jakarta tertentu (default:
// hari ini zona Asia/Jakarta). Route TIPIS: parse → assertSurfaceAccess
// ('price_history', terbuka semua principal terautentikasi §15.6) → pintu
// pricing.currentPrice → kembalikan nilai desimal berskala tetap apa adanya (AD-10).
//
// KONTRAK
//   GET /api/pricing/current?kind=beli&on=YYYY-MM-DD
//   200: { data: PricePeriod }  (price = MoneyString apa adanya)

import { pricing } from '../../domain/pricing'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal } from '../../utils/session'
import { parseKind, parseOptionalJakartaDate, todayJakarta } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'price_history')

  const query = getQuery(event)
  const kind = parseKind(query.kind)
  const onDate = parseOptionalJakartaDate(query.on, 'on') ?? todayJakarta()

  const price = await pricing.currentPrice(kind, onDate)
  return { data: price }
})
