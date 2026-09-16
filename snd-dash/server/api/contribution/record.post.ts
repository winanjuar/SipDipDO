// server/api/contribution/record.post.ts
//
// FR-9 — Pencatatan realisasi Contribution (tanggal + pencatat; tolak jika
// periode final). COO-only. Route TIPIS: parse → assertSurfaceAccess
// ('contribution') + requireCoo → pintu contribution.recordRealization(cooId, entry).
//
// KONTRAK
//   POST /api/contribution/record
//   body: { ownerId, itemId, recordedDate, periodId?, points? }
//   200: { data: ContributionEntry }
//   400: { code: 'PERIOD_FINALIZED'|'ITEM_NOT_FOUND'|… }

import { contribution } from '../../domain/contribution'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseRealizationBody } from '../../utils/contribution-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'contribution')
  requireCoo(principal)

  const entry = parseRealizationBody(await readBody(event))
  const recorded = await contribution.recordRealization(principal.ownerId, entry)
  return { data: recorded }
})
