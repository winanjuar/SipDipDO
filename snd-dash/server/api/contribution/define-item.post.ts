// server/api/contribution/define-item.post.ts
//
// FR-8 — Definisi item Contribution (nama, deskripsi, poin, periode, tautan MoM).
// COO-only. Route TIPIS: parse → assertSurfaceAccess ('contribution') + requireCoo
// → pintu contribution.defineItem(cooId, item, momRef).
//
// KONTRAK
//   POST /api/contribution/define-item
//   body: { name, description?, points, periodId?, momRef }
//   200: { data: ContributionItem }

import { contribution } from '../../domain/contribution'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseDefineItemBody } from '../../utils/contribution-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'contribution')
  const cooId = requireCoo(principal)

  const { input, momRef } = parseDefineItemBody(await readBody(event))
  const item = await contribution.defineItem(cooId, input, momRef)
  return { data: item }
})
