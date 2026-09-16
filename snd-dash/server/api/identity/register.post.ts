// server/api/identity/register.post.ts
//
// FR-22 §22.1/§22.2 — Pendaftaran mandiri: membuat Owner baru berstatus
// 'diajukan' (unik per email Google, AD-7). Route TIPIS: resolve email sesi
// (identitas pendaftar) → pintu identity.submitRegistration(googleEmail).
//
// Pendaftaran adalah SELF-SERVICE: identitas pendaftar = email Google
// terautentikasi (task 18.3 mencocokkan email). Karena Owner BELUM tentu ada saat
// mendaftar, route ini TIDAK memakai `buildPrincipal` (yang mensyaratkan Owner
// eksisting) — cukup email sesi via `resolveSessionEmail`. `submitRegistration`
// menegakkan keunikan email & transisi CAS (kedaluwarsa → diajukan).
//
// KONTRAK
//   POST /api/identity/register
//   200: { data: Owner }
//   401: { code: 'UNAUTHENTICATED' } bila tidak ada email sesi
//   400: { code: 'EMAIL_ALREADY_REGISTERED'|'ILLEGAL_TRANSITION'|… }

import { identity } from '../../domain/identity'
import { ApiError, defineApiHandler } from '../../utils/http'
import { resolveSessionEmail } from '../../utils/session'

export default defineApiHandler(async (event) => {
  const email = await resolveSessionEmail(event)
  if (!email) {
    throw new ApiError('UNAUTHENTICATED', 'Sesi tidak ditemukan.', 401)
  }

  const owner = await identity.submitRegistration(email)
  return { data: owner }
})
