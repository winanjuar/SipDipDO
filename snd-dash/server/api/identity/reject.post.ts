// server/api/identity/reject.post.ts
//
// FR-22 §22.2/§22.3 — Penolakan pendaftaran oleh COO: CAS 'diajukan' → 'ditolak'
// dengan alasan. COO-only. Route TIPIS: parse → assertSurfaceAccess ('queue_coo')
// + requireCoo → buka transaksi → pintu identity.rejectRegistration(tx, ownerId,
// cooId, reason).
//
// KONTRAK
//   POST /api/identity/reject
//   body: { ownerId, reason }
//   200: { data: { ok: true } }
//   400: { code: 'ILLEGAL_TRANSITION'|'INVALID_INPUT'|… }

import { identity } from '../../domain/identity'
import { assertSurfaceAccess } from '../../utils/access'
import { withTransaction } from '../../utils/db'
import { ApiError, defineApiHandler } from '../../utils/http'
import { buildPrincipal, requireCoo } from '../../utils/session'
import { asRecord, parseUuid } from '../../utils/pricing-input'

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'queue_coo')
  const cooId = requireCoo(principal)

  const body = asRecord(await readBody(event))
  const ownerId = parseUuid(body.ownerId, 'ownerId')
  const reason = body.reason
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new ApiError('INVALID_INPUT', "Parameter 'reason' wajib.", 400)
  }

  await withTransaction((tx) =>
    identity.rejectRegistration(tx, ownerId, cooId, reason),
  )
  return { data: { ok: true } }
})
