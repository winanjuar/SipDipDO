// server/api/identity/transfer-coo.post.ts
//
// FR-17 — Pergantian mandat COO: alihkan peran COO dari COO bertugas ke Owner
// tujuan dengan referensi MoM; COO lama kembali menjadi Owner biasa. COO-only.
// Route TIPIS: parse → assertSurfaceAccess ('queue_coo') + requireCoo (fromCoo =
// principal bertugas) → buka transaksi → pintu identity.transferCoo(tx, fromCoo,
// toOwner, momRef).
//
// KONTRAK
//   POST /api/identity/transfer-coo
//   body: { toOwner, momRef }
//   200: { data: { ok: true } }
//   400: { code: 'NOT_COO'|'INVALID_INPUT'|… }

import { identity } from '../../domain/identity'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { asRecord, parseUuid } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'queue_coo')
  const fromCoo = requireCoo(principal)

  const body = asRecord(await readBody(event))
  const toOwner = parseUuid(body.toOwner, 'toOwner')
  const momRef = parseUuid(body.momRef, 'momRef')

  await withTransaction((tx) => identity.transferCoo(tx, fromCoo, toOwner, momRef))
  return { data: { ok: true } }
})
