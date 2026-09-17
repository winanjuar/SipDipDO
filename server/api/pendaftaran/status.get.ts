import { buildPrincipal, createIdentityRepo, LANDING_PATH } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/pendaftaran/status — data badge halaman status pendaftaran (AD-8):
 * khusus calon owner (`diajukan`/`ditolak`/`kedaluwarsa`) →
 * `{ status, rejectionReason }`; non-calon → redirect ke landing role-nya;
 * tanpa sesi → 401 envelope seragam. Route handler tipis — keputusan role dari
 * modul identity.
 */
export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return sendRedirect(event, '/login?state=unlinked')
  if (principal.role !== 'calon_owner') return sendRedirect(event, LANDING_PATH[principal.role])

  return { status: principal.owner.status, rejectionReason: principal.owner.rejectionReason ?? '' }
})
