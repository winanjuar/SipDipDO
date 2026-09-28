import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { buatFase, RkapDomainError } from '../../../domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { enforceCOO } from '../../../utils/role-guard'
import { getSessionEmail } from '../../../utils/session'

/**
 * POST /api/rkap/fase — buat fase RKAP baru (Req-5, Req-14).
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Request Body:
 * - `name: string` — Nama fase
 * - `momId: string` — Referensi MoM (wajib final)
 *
 * Response:
 * - `RkapPhaseWire` — Fase RKAP yang dibuat
 *
 * Error:
 * - 400: MOM_NOT_FINAL, VALIDATION
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — MoM tidak ditemukan
 *
 * **Validates: Requirements 5, 14**
 */

/** Input body untuk membuat fase RKAP. */
interface CreatePhaseBody {
  name: string
  momId: string
}

export default defineEventHandler(async (event) => {
  // 1. Autentikasi — cek sesi pengguna
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  // 2. Dapatkan database client dan principal
  const db = useDb()
  const principal = await buildPrincipal(createIdentityRepo(db), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // 3. Otorisasi — HANYA COO yang dapat membuat fase RKAP (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat membuat fase RKAP.')
  if (cooBlocked) return cooBlocked

  // 4. Parse request body
  const body = await readBody<CreatePhaseBody>(event)

  // 5. Validasi input dasar
  if (!body.name || typeof body.name !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Nama fase wajib diisi.',
      details: { field: 'name' },
    })
  }
  if (!body.momId || typeof body.momId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'MoM referensi wajib diisi.',
      details: { field: 'momId' },
    })
  }

  // 6. Panggil service untuk membuat fase
  try {
    const phase = await buatFase(db, { name: body.name, momId: body.momId }, principal.owner.id)

    // 7. Return RkapPhaseWire dengan HTTP 201 Created
    setResponseStatus(event, HTTP_STATUS.created)
    return phase
  } catch (err) {
    // 8. Handle RkapDomainError
    if (err instanceof RkapDomainError) {
      switch (err.code) {
        case 'NOT_FOUND':
          return sendApiError(event, HTTP_STATUS.notFound, {
            code: 'NOT_FOUND',
            message: err.message,
            details: err.details ?? {},
          })
        case 'MOM_NOT_FINAL':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'MOM_NOT_FINAL',
            message: err.message,
            details: err.details ?? {},
          })
        case 'VALIDATION':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'VALIDATION',
            message: err.message,
            details: err.details ?? {},
          })
        default:
          // Other domain errors as bad request
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: err.code,
            message: err.message,
            details: err.details ?? {},
          })
      }
    }

    // Re-throw unexpected errors
    throw err
  }
})
