// server/api/identity/verify.post.ts
//
// FR-22 §22.2/§22.3/§22.4 — Verifikasi pendaftaran oleh COO: CAS 'diajukan' →
// 'terverifikasi' (prasyarat Profile lengkap, re-validasi in-tx). COO-only.
// Route TIPIS: parse → assertSurfaceAccess ('queue_coo') + requireCoo →
// buka transaksi → pintu identity.verifyRegistration(tx, ownerId, cooId).
//
// KONTRAK
//   POST /api/identity/verify
//   body: { ownerId }
//   200: { data: { ok: true } }
//   400: { code: 'PROFILE_INCOMPLETE'|'ILLEGAL_TRANSITION'|… }

import { identity } from '../../domain/identity'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { asRecord, parseUuid } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'queue_coo')
  const cooId = requireCoo(principal)

  const body = asRecord(await readBody(event))
  const ownerId = parseUuid(body.ownerId, 'ownerId')

  await withTransaction((tx) => identity.verifyRegistration(tx, ownerId, cooId))
  return { data: { ok: true } }
})
