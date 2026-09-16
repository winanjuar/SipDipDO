// server/api/rkap/rebalance.post.ts
//
// FR-23 §23.9 — Rebalancing RKAP: relokasi Final Requirement antar Capital Item
// SEJENIS (net-zero), tertaut MoM. COO-only. Route TIPIS: parse →
// assertSurfaceAccess ('rkap_view') + requireCoo → buka transaksi →
// pintu rkap.rebalance(tx, cooId, plan, momRef).
//
// KONTRAK
//   POST /api/rkap/rebalance
//   body: { moves: [{ capitalItemId, delta }...], momRef }
//   200: { data: { ok: true } }
//   400: { code: 'REBALANCE_INVALID'|'ITEM_NOT_FOUND'|… }

import { rkap } from '../../domain/rkap'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseRebalanceBody } from '../../utils/rkap-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'rkap_view')
  const cooId = requireCoo(principal)

  const { plan, momRef } = parseRebalanceBody(await readBody(event))
  await withTransaction((tx) => rkap.rebalance(tx, cooId, plan, momRef))
  return { data: { ok: true } }
})
