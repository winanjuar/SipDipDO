// server/api/contribution/cut-off.post.ts
//
// FR-10 — Cut-off Contribution Period: snapshot beku imutabel, finalkan poin
// memenuhi syarat, carry over sisa. COO-only. Route TIPIS: parse →
// assertSurfaceAccess ('contribution') + requireCoo → buka transaksi →
// pintu contribution.cutOff(tx, cooId, cutOffJakartaDate).
//
// KONTRAK
//   POST /api/contribution/cut-off
//   body: { cutOffDate }  ('YYYY-MM-DD', zona Jakarta)
//   200: { data: CutOffRecap }
//   400: { code: 'NO_ACTIVE_PERIOD'|'PERIOD_ALREADY_FINALIZED'|… }

import { contribution } from '../../domain/contribution'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { asRecord, parseJakartaDate } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'contribution')
  const cooId = requireCoo(principal)

  const body = asRecord(await readBody(event))
  const cutOffDate = parseJakartaDate(body.cutOffDate, 'cutOffDate')

  const recap = await withTransaction((tx) =>
    contribution.cutOff(tx, cooId, cutOffDate),
  )
  return { data: recap }
})
