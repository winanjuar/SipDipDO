// server/api/rkap/view.get.ts
//
// FR-23 §23.1/§23.13 — Tampilan fase RKAP: tabel Capital Item + agregat +
// ringkasan batas + ruang/Quantity Left per Capital Type. Route TIPIS:
// parse → assertSurfaceAccess ('rkap_view', terbuka §15.6) → pintu
// rkap.getPhaseView → kembalikan nilai desimal apa adanya (AD-10).
//
// KONTRAK
//   GET /api/rkap/view?phaseId=<uuid?>&runningPrice=<money?>
//   200: { data: RkapPhaseView }

import { rkap } from '../../domain/rkap'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal } from '../../utils/session'
import { parseOptionalUuid } from '../../utils/pricing-input'
import { parseSignedMoney } from '../../utils/rkap-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'rkap_view')

  const query = getQuery(event)
  const phaseId = parseOptionalUuid(query.phaseId, 'phaseId')
  const runningPrice =
    query.runningPrice === undefined || query.runningPrice === ''
      ? undefined
      : parseSignedMoney(query.runningPrice, 'runningPrice')

  const view = await rkap.getPhaseView(phaseId, runningPrice)
  return { data: view }
})
