import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { getMomById } from '../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/mom/:id — detail MoM (FR-7, AD-8): enforce pemegang saham;
 * owner tanpa saham → 403. 404 bila tidak ditemukan.
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

  const db = useDb()
  const principal = await buildPrincipal(createIdentityRepo(db), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // Owner tanpa saham dan calon owner tidak boleh akses MoM (AD-8, §4.8)
  if (principal.role === 'tanpa_saham' || principal.role === 'calon_owner') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses MoM hanya untuk pemegang saham.',
      details: {},
    })
  }

  const momId = getRouterParam(event, 'id')
  if (!momId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'ID MoM wajib diisi.',
      details: {},
    })
  }

  const mom = await getMomById(db, momId)
  if (!mom) {
    return sendApiError(event, HTTP_STATUS.notFound, {
      code: 'NOT_FOUND',
      message: 'MoM tidak ditemukan.',
      details: { id: momId },
    })
  }

  return mom
})
