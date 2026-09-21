import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { finalkanMom, MomDomainError } from '../../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { getSessionEmail } from '../../../utils/session'

/**
 * POST /api/mom/:id/finalize — finalkan MoM (FR-7, Story 2.1). Enforce COO
 * (AD-8). Tolak bila MoM sudah final (400). 404 bila tidak ditemukan.
 * Status berubah draft → final, finalized_at terisi.
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
  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya COO yang dapat memfinalkan MoM.',
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

  // Dapatkan owner id untuk actor audit
  const ownerResult = await createIdentityRepo(db).findOwnerByEmail(email)
  if (!ownerResult?.id) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  try {
    const mom = await finalkanMom(db, momId, ownerResult.id)
    return mom
  } catch (error) {
    if (error instanceof MomDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: { id: momId },
        })
      }
      if (error.code === 'ALREADY_FINAL') {
        return sendApiError(event, HTTP_STATUS.badRequest, {
          code: 'BAD_REQUEST',
          message: error.message,
          details: { id: momId, status: 'final' },
        })
      }
    }
    throw error
  }
})
