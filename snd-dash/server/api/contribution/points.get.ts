// server/api/contribution/points.get.ts
//
// FR-9 §9.2/§9.3 — Poin Contribution berjalan + carry-over seorang Owner. Route
// TIPIS: parse → buildPrincipal → assertSurfaceAccess ('contribution') →
// pintu contribution.runningPoints(ownerId).
//
// Owner hanya boleh melihat poin MILIKNYA; COO bertugas boleh melihat poin Owner
// lain via query `ownerId` (§15.2). Default: poin principal sendiri.
//
// KONTRAK
//   GET /api/contribution/points?ownerId=<uuid?>
//   200: { data: PointsView }

import { contribution } from '../../domain/contribution'
import { assertOwnsOrder, assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal } from '../../utils/session'
import { parseOptionalUuid } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'contribution')

  const requested = parseOptionalUuid(getQuery(event).ownerId, 'ownerId')
  const targetOwnerId = requested ?? principal.ownerId

  // Non-COO hanya boleh membaca poin miliknya (§15.4). COO bertugas bebas.
  if (!principal.isCooOnDuty) {
    assertOwnsOrder(principal.ownerId, targetOwnerId)
  }

  const points = await contribution.runningPoints(targetOwnerId)
  return { data: points }
})
