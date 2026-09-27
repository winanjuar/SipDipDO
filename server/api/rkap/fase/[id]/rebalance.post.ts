import { buildPrincipal, createIdentityRepo } from '../../../../domain/identity'
import { rebalance, RkapDomainError } from '../../../../domain/rkap'
import type { RebalanceInput } from '#shared/domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../../utils/api-error'
import { useDb } from '../../../../utils/db'
import { enforceCOO } from '../../../../utils/role-guard'
import { getSessionEmail } from '../../../../utils/session'

/**
 * POST /api/rkap/fase/[id]/rebalance — rebalance Capital Items (Req-13, Req-14).
 *
 * Relokasi kebutuhan antar Capital Item dengan jenis modal yang sama.
 * Wajib menyertakan MoM referensi sebagai bukti keputusan MRO.
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Route params:
 * - `id` - Phase UUID from URL path
 *
 * Request Body:
 * - `fromItemId: string` — UUID item sumber (dikurangi Final Requirement)
 * - `toItemId: string` — UUID item tujuan (ditambah Final Requirement)
 * - `amount: string` — Jumlah yang dipindahkan (string desimal, positif)
 * - `momId: string` — UUID MoM referensi keputusan MRO (wajib final)
 *
 * Response:
 * - `RebalanceResult` — { from: CapitalItemWire, to: CapitalItemWire }
 *
 * Error:
 * - 400: PHASE_NOT_ACTIVE, TYPE_MISMATCH, VALIDATION, MOM_NOT_FINAL
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — fase, item, atau MoM tidak ditemukan
 *
 * Business Logic:
 * - Validasi kedua item memiliki jenis modal yang sama (Tetap→Tetap, Bergerak→Bergerak)
 * - MoM referensi harus berstatus final
 * - Zero-sum transfer: total Final Requirement jenis modal tidak berubah
 * - Rebalancing tidak dihitung terhadap batas penyesuaian agregat
 *
 * Audit Event:
 * - `rkap-rebalanced` dengan detail `{from_item_id, to_item_id, amount, mom_id}`
 *
 * **Validates: Requirements 13, 14**
 */

/** Input body untuk rebalancing Capital Items. */
interface RebalanceBody {
  fromItemId: string
  toItemId: string
  amount: string
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
  const identityRepo = createIdentityRepo(db)
  const principal = await buildPrincipal(identityRepo, email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // 3. Otorisasi — HANYA COO yang dapat melakukan rebalancing (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat melakukan rebalancing.')
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
  const body = await readBody<RebalanceBody>(event)

  // 7. Validasi input dasar
  if (!body.fromItemId || typeof body.fromItemId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'From Item ID wajib diisi.',
      details: { field: 'fromItemId' },
    })
  }
  if (!body.toItemId || typeof body.toItemId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'To Item ID wajib diisi.',
      details: { field: 'toItemId' },
    })
  }
  if (!body.amount || typeof body.amount !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Jumlah rebalancing wajib diisi.',
      details: { field: 'amount' },
    })
  }
  if (!body.momId || typeof body.momId !== 'string') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'MoM referensi wajib diisi.',
      details: { field: 'momId' },
    })
  }

  // 8. Build RebalanceInput
  const input: RebalanceInput = {
    fromItemId: body.fromItemId,
    toItemId: body.toItemId,
    amount: body.amount,
    momId: body.momId,
  }

  // 9. Panggil service untuk melakukan rebalancing
  try {
    const result = await rebalance(db, phaseId, input, actorOwnerId)

    // 10. Return RebalanceResult dengan HTTP 200 OK
    setResponseStatus(event, HTTP_STATUS.ok)
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
        case 'MOM_NOT_FINAL':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'MOM_NOT_FINAL',
            message: err.message,
            details: err.details ?? {},
          })
        case 'PHASE_NOT_ACTIVE':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'PHASE_NOT_ACTIVE',
            message: err.message,
            details: err.details ?? {},
          })
        case 'TYPE_MISMATCH':
          return sendApiError(event, HTTP_STATUS.badRequest, {
            code: 'TYPE_MISMATCH',
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
