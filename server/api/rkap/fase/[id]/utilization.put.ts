import { buildPrincipal, createIdentityRepo } from '../../../../domain/identity'
import { recordUtilization, RkapDomainError } from '../../../../domain/rkap'
import type { UtilizationInput } from '#shared/domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../../utils/api-error'
import { useDb } from '../../../../utils/db'
import { enforceCOO } from '../../../../utils/role-guard'
import { getSessionEmail } from '../../../../utils/session'

/**
 * PUT /api/rkap/fase/[id]/utilization — record Utilization per Capital Item (Req-11).
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Route params:
 * - `id` - Phase UUID from URL path (unused — item determines phase membership)
 *
 * Request Body:
 * - `itemId: string` — UUID Capital Item target
 * - `utilization: string` — Nilai realisasi penggunaan (string desimal, non-negatif)
 *
 * Response:
 * - `CapitalItemWire` — item yang diperbarui dengan kalkulasi derived fields
 *
 * Error:
 * - 400: VALIDATION — input tidak valid (misal, nilai negatif)
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — item tidak ditemukan
 *
 * Business Logic:
 * - Utilization adalah realisasi penggunaan modal di lapangan yang diinput COO
 * - Tersimpan terpisah dari Fulfillment (kedua nilai independen)
 * - Achievement dihitung dari Utilization ÷ Fulfillment
 * - Held dihitung dari Fulfillment − Utilization
 *
 * Audit Event:
 * - `rkap-utilization-recorded` dengan detail `{item_id, old_value, new_value}`
 *
 * **Validates: Requirements 11**
 */

/** Input body untuk mencatat Utilization. */
interface UtilizationBody {
  itemId: string
  utilization: string
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

  // 3. Otorisasi — HANYA COO yang dapat mencatat Utilization (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat mencatat Utilization.')
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

  // 5. Parse route params (for consistency, though not strictly needed)
  const phaseId = getRouterParam(event, 'id')
  if (!phaseId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Phase ID wajib diisi.',
      details: {},
    })
  }

  // 6. Parse request body
  const body = await readBody<UtilizationBody>(event)

  // 7. Validasi input dasar
  if (!body.itemId || typeof body.itemId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Item ID wajib diisi.',
      details: { field: 'itemId' },
    })
  }
  if (body.utilization === undefined || body.utilization === null || typeof body.utilization !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Nilai Utilization wajib diisi.',
      details: { field: 'utilization' },
    })
  }

  // 8. Build UtilizationInput
  const input: UtilizationInput = {
    itemId: body.itemId,
    utilization: body.utilization,
  }

  // 9. Panggil service untuk mencatat Utilization
  try {
    const result = await recordUtilization(db, input, actorOwnerId)

    // 10. Return CapitalItemWire dengan HTTP 200 OK
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
