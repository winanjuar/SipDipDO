// server/api/rkap/adjust.post.ts
//
// FR-23 §23.5/§23.7 — Penyesuaian manual RKAP (hanya menaikkan Final Requirement
// item eksisting ATAU menambah Capital Item baru; tolak bila melewati batas fase).
// COO-only. Route TIPIS: parse → assertSurfaceAccess ('rkap_view') + requireCoo →
// buka transaksi → pintu rkap.manualAdjust(tx, cooId, adjustment).
//
// KONTRAK
//   POST /api/rkap/adjust
//   body: { capitalItemId, raiseBy } | { newItem: { name, capitalType, finalRequirement } }
//   200: { data: { ok: true } }
//   400: { code: 'ADJUSTMENT_EXCEEDS_LIMIT'|'INVALID_ADJUSTMENT'|… }

import { rkap } from '../../domain/rkap'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseManualAdjustmentBody } from '../../utils/rkap-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'rkap_view')
  const cooId = requireCoo(principal)

  const adjustment = parseManualAdjustmentBody(await readBody(event))
  await withTransaction((tx) => rkap.manualAdjust(tx, cooId, adjustment))
  return { data: { ok: true } }
})
