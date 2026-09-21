import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { buatMom } from '../../domain/pricing'
import { validateMomCreateInput } from '#shared/domain/mom'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { readBody, setResponseStatus } from 'h3'

/**
 * POST /api/mom — buat MoM baru (FR-7, Story 2.1). Enforce COO (AD-8):
 * tanpa sesi → 401; unlinked → redirect; non-COO → 403. Tanggal wajib
 * (spec AC: tanpa tanggal → 400). Respons 201 + MoM record baru.
 * Route handler TIPIS — pola audit/index.get.ts.
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
      message: 'Hanya COO yang dapat membuat MoM.',
      details: {},
    })
  }

  const body = await readBody(event)
  const validationError = validateMomCreateInput(body)
  if (validationError) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: validationError,
      details: { field: !body.heldAt ? 'heldAt' : 'title' },
    })
  }

  // Principal memiliki owner dengan id — dapatkan owner id untuk actor audit
  const ownerResult = await createIdentityRepo(db).findOwnerByEmail(email)
  if (!ownerResult?.id) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  const mom = await buatMom(db, {
    title: body.title,
    heldAt: body.heldAt,
    contentText: body.contentText ?? null,
  }, ownerResult.id)

  setResponseStatus(event, HTTP_STATUS.created)
  return mom
})
