// server/api/distribution/simulate.post.ts
//
// FR-16 §16.1–§16.6 — Simulasi distribusi laba (perhitungan MURNI, tanpa persist).
// Route TIPIS: parse → assertSurfaceAccess ('profit_recap') + requireCoo →
// rakit input (assembleInput dari ledger+contribution, ATAU owners eksplisit) →
// pintu distribution.simulate → kembalikan rekap (uang/ratio string, AD-10).
//
// KONTRAK
//   POST /api/distribution/simulate
//   body: { auditedProfit, retainedProfit, charityRatio, dividendRatio,
//           incentiveRatio, momRef?, owners? }
//   200: { data: DistributionRecap }
//   400: { code: 'INVALID_RATIOS'|'INVALID_PROFIT'|… }

import { distribution } from '../../domain/distribution'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import {
  parseDistributionParams,
  parseExplicitInput,
  toAssembleParams,
} from '../../utils/distribution-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'profit_recap')
  requireCoo(principal)

  const body = await readBody(event)
  const explicit = parseExplicitInput(body)
  const input =
    explicit ??
    (await distribution.assembleInput(toAssembleParams(parseDistributionParams(body))))

  const recap = distribution.simulate(input)
  return { data: recap }
})
