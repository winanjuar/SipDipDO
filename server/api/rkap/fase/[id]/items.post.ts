import { buildPrincipal, createIdentityRepo } from '../../../../domain/identity'
import { tambahItem, RkapDomainError } from '../../../../domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../../utils/api-error'
import { useDb } from '../../../../utils/db'
import { enforceCOO } from '../../../../utils/role-guard'
import { getSessionEmail } from '../../../../utils/session'

/**
 * POST /api/rkap/fase/[id]/items — tambah Capital Item ke fase RKAP (Req-5, Req-8, Req-9).
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Route params:
 * - `id` - Phase UUID from URL path
 *
 * Request Body:
 * - `name: string` — Nama item
 * - `capitalType: 'tetap' | 'bergerak'` — Jenis modal
 * - `requirement: string` — Nilai kebutuhan (string desimal)
 * - `isInitialItem?: boolean` — Opsional. Jika true, Initial = Final = requirement (untuk item
 *   awal saat pembuatan fase). Jika false atau tidak ada, Initial = 0, Final = requirement
 *   dan nilai dihitung sebagai penyesuaian agregat (Req-8).
 *
 * Response:
 * - `CapitalItemWire` — Item yang dibuat (HTTP 201 Created)
 *
 * Error:
 * - 400: PHASE_NOT_ACTIVE, LIMIT_EXCEEDED, VALIDATION
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — fase tidak ditemukan
 *
 * **Validates: Requirements 5, 8, 9**
 */

/** Input body untuk menambah Capital Item. */
interface AddItemBody {
  name: string
  capitalType: 'tetap' | 'bergerak'
  requirement: string
  /** Jika true, Initial = Final = requirement (item awal saat pembuatan fase) */
  isInitialItem?: boolean
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

  // 3. Otorisasi — HANYA COO yang dapat menambah item (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat menambah Capital Item.')
  if (cooBlocked) return cooBlocked

  // 4. Parse route params
  const phaseId = getRouterParam(event, 'id')
  if (!phaseId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Phase ID wajib diisi.',
      details: {},
    })
  }

  // 5. Parse request body
  const body = await readBody<AddItemBody>(event)

  // 6. Validasi input dasar
  if (!body.name || typeof body.name !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Nama item wajib diisi.',
      details: { field: 'name' },
    })
  }
  if (!body.capitalType || (body.capitalType !== 'tetap' && body.capitalType !== 'bergerak')) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Jenis modal harus "tetap" atau "bergerak".',
      details: { field: 'capitalType' },
    })
  }
  if (!body.requirement || typeof body.requirement !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Nilai kebutuhan wajib diisi.',
      details: { field: 'requirement' },
    })
  }

  // 7. Panggil service untuk menambah item
  try {
    // isInitialItem: jika true, Initial = Final = requirement (item awal saat pembuatan fase)
    // jika false, Initial = 0, Final = requirement dan dihitung sebagai penyesuaian agregat (Req-8)
    const isInitialItem = body.isInitialItem === true

    const item = await tambahItem(
      db,
      phaseId,
      {
        name: body.name,
        capitalType: body.capitalType,
        requirement: body.requirement,
      },
      principal.owner.id,
      isInitialItem,
    )

    // 8. Return CapitalItemWire dengan HTTP 201 Created
    setResponseStatus(event, HTTP_STATUS.created)
    return item
  } catch (err) {
    // 9. Handle RkapDomainError
    if (err instanceof RkapDomainError) {
      switch (err.code) {
        case 'NOT_FOUND':
          return sendApiError(event, HTTP_STATUS.notFound, {
            code: 'NOT_FOUND',
            message: err.message,
            details: err.details ?? {},
          })
        case 'PHASE_NOT_ACTIVE':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'PHASE_NOT_ACTIVE',
            message: err.message,
            details: err.details ?? {},
          })
        case 'LIMIT_EXCEEDED':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'LIMIT_EXCEEDED',
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
