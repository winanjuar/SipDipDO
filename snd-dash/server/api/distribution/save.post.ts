// server/api/distribution/save.post.ts
//
// FR-16 §16.7–§16.9/§13.6 — Simpan rekap distribusi laba: snapshot imutabel,
// alokasi Charity utuh, tandai Insentif tertunaikan + flip Owner tanpa saham →
// Keluar, audit. COO-only. Route TIPIS: parse → assertSurfaceAccess
// ('profit_recap') + requireCoo → rakit input → buka transaksi →
// pintu distribution.saveRecap(tx, cooId, input).
//
// KONTRAK
//   POST /api/distribution/save
//   body: { auditedProfit, retainedProfit, charityRatio, dividendRatio,
//           incentiveRatio, momRef?, owners? }
//   200: { data: ProfitDistribution }
//   400: { code: 'INVALID_RATIOS'|'INVALID_PROFIT'|… }

import { distribution } from '../../domain/distribution'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
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
  const cooId = requireCoo(principal)

  const body = await readBody(event)

  const saved = await withTransaction(async (tx) => {
    // Rakit input DI DALAM transaksi agar posisi & poin konsisten (AD-2).
    const explicit = parseExplicitInput(body)
    const input =
      explicit ??
      (await distribution.assembleInput(
        toAssembleParams(parseDistributionParams(body)),
        tx,
      ))
    return distribution.saveRecap(tx, cooId, input)
  })

  return { data: saved }
})
