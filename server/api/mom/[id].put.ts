import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { MomDomainError, ubahMom } from '../../domain/pricing'
import { validateMomUpdateInput } from '#shared/domain/mom'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { readBody } from 'h3'

/**
 * PUT /api/mom/:id — edit MoM draft (FR-7, Story 2.1). Enforce COO (AD-8).
 * Tolak bila MoM sudah final (400). 404 bila tidak ditemukan.
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
      message: 'Hanya COO yang dapat mengubah MoM.',
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

  const body = await readBody(event)
  const validationError = validateMomUpdateInput(body)
  if (validationError) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: validationError,
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
    const mom = await ubahMom(db, momId, {
      title: body.title,
      heldAt: body.heldAt,
      contentText: body.contentText,
    }, ownerResult.id)
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
