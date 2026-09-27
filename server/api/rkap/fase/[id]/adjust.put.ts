import { buildPrincipal, createIdentityRepo } from '../../../../domain/identity'
import { adjustItem, RkapDomainError } from '../../../../domain/rkap'
import type { AdjustInput } from '#shared/domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../../utils/api-error'
import { useDb } from '../../../../utils/db'
import { enforceCOO } from '../../../../utils/role-guard'
import { getSessionEmail } from '../../../../utils/session'

/**
 * PUT /api/rkap/fase/[id]/adjust — adjust Capital Item Final Requirement (Req-7, Req-9, Req-10).
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Route params:
 * - `id` - Phase UUID from URL path
 *
 * Request Body:
 * - `itemId: string` — UUID item yang akan disesuaikan
 * - `newFinalRequirement: string` — Nilai Final Requirement baru (string desimal)
 *
 * Response:
 * - `AdjustItemResult` — { item: CapitalItemWire, summary: RkapPhaseSummary }
 *
 * Error:
 * - 400: PHASE_NOT_ACTIVE, LIMIT_EXCEEDED, VALIDATION
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — fase atau item tidak ditemukan
 *
 * Business Logic:
 * - Menghitung delta (selisih) antara nilai lama dan baru
 * - Jika delta > 0, validasi terhadap batas agregat penyesuaian (Req-9)
 * - LIMIT_EXCEEDED error menyertakan Alert Penolakan Terhitung:
 *   - batas: adjustment limit
 *   - terpakai: current usage
 *   - sisa: remaining
 *   - diminta: requested amount
 *   - langkahLanjut: next step instructions
 *
 * **Validates: Requirements 7, 9, 10**
 */

/** Input body untuk menyesuaikan Capital Item. */
interface AdjustItemBody {
  itemId: string
  newFinalRequirement: string
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
  const identityRepo = createIdentityRepo(db)
  const principal = await buildPrincipal(identityRepo, email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // 3. Otorisasi — HANYA COO yang dapat menyesuaikan item (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat menyesuaikan Final Requirement item.')
  if (cooBlocked) return cooBlocked

  // 4. Dapatkan owner id untuk actor audit
  const ownerResult = await identityRepo.findOwnerByEmail(email)
  if (!ownerResult?.id) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }
  const actorOwnerId = ownerResult.id

  // 5. Parse route params
  const phaseId = getRouterParam(event, 'id')
  if (!phaseId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Phase ID wajib diisi.',
      details: {},
    })
  }

  // 6. Parse request body
  const body = await readBody<AdjustItemBody>(event)

  // 7. Validasi input dasar
  if (!body.itemId || typeof body.itemId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Item ID wajib diisi.',
      details: { field: 'itemId' },
    })
  }
  if (!body.newFinalRequirement || typeof body.newFinalRequirement !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Nilai Final Requirement baru wajib diisi.',
      details: { field: 'newFinalRequirement' },
    })
  }

  // 8. Build AdjustInput
  const input: AdjustInput = {
    itemId: body.itemId,
    newFinalRequirement: body.newFinalRequirement,
  }

  // 9. Panggil service untuk menyesuaikan item
  try {
    const result = await adjustItem(db, phaseId, input, actorOwnerId)

    // 10. Return AdjustItemResult dengan HTTP 200 OK
    return result
  } catch (err) {
    // 11. Handle RkapDomainError
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
          // Return Alert Penolakan Terhitung with full details (Req-9, Req-10)
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
