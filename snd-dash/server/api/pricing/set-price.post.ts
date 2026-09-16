// server/api/pricing/set-price.post.ts
//
// FR-6.1 — Set harga beli/jual baru (unik kind+effective_date, referensi MoM).
// COO-only. Route TIPIS: parse → assertSurfaceAccess ('price_history') +
// requireCoo (tulis harga = wewenang COO) → pintu pricing.setPrice → kembalikan
// baris harga (MoneyString apa adanya, AD-10).
//
// KONTRAK
//   POST /api/pricing/set-price
//   body: { kind, price, effectiveDate, momRef }
//   200: { data: PricePeriod }
//   400: { code: 'PRICE_CONFLICT'|'INVALID_INPUT'|… }

import { pricing } from '../../domain/pricing'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseSetPriceBody } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'price_history')
  const cooId = requireCoo(principal)

  const { input, momRef } = parseSetPriceBody(await readBody(event))
  const price = await pricing.setPrice(cooId, input, momRef)
  return { data: price }
})
