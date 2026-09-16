// server/api/pricing/mom.post.ts
//
// FR-7 — Simpan/edit MoM MRO/RUPS (draft → final). COO-only. Route TIPIS:
// parse → assertSurfaceAccess ('mom') + requireCoo → pintu pricing.saveMom.
//
// KONTRAK
//   POST /api/pricing/mom
//   body: { id?, title?, momDate?, body?, finalize? }
//   200: { data: Mom }
//   400: { code: 'MOM_ALREADY_FINAL'|'MOM_TITLE_REQUIRED'|'MOM_NOT_FOUND'|… }

import { pricing } from '../../domain/pricing'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { parseMomBody } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'mom')
  const cooId = requireCoo(principal)

  const input = parseMomBody(await readBody(event))
  const mom = await pricing.saveMom(cooId, input)
  return { data: mom }
})
