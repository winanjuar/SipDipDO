import { buildPrincipal, createIdentityRepo, LANDING_PATH } from '../domain/identity'
import { HTTP_STATUS, sendApiError } from '../utils/api-error'
import { useDb } from '../utils/db'
import { getSessionEmail } from '../utils/session'

/**
 * GET /api/landing — resolver landing server-side (AD-8, UX-DR14): sesi →
 * `buildPrincipal` → `{ path, role }` ATAU `{ unlinked: true }`; tanpa sesi →
 * 401 envelope seragam. Route handler tipis: keputusan role dari modul
 * identity (fungsi kanonik), bukan dari klien.
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
  if (principal.unlinked) return { unlinked: true }

  return { path: LANDING_PATH[principal.role], role: principal.role }
})
