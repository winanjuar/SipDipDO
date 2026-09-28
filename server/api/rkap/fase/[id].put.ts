import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { findPhaseById, RkapDomainError, updatePhaseStatus } from '../../../domain/rkap'
import { writeAuditEntry } from '../../../domain/audit'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { enforceCOO } from '../../../utils/role-guard'
import { getSessionEmail } from '../../../utils/session'

/**
 * PUT /api/rkap/fase/:id — archive phase (Req-5).
 *
 * Akses: Hanya COO (AD-8).
 * Non-COO mendapat HTTP 403.
 *
 * Request Body:
 * - `status: 'arsip'` — Only archiving is supported via PUT
 *
 * Response:
 * - `RkapPhaseRow` — Updated phase
 *
 * Error:
 * - 400: VALIDATION — status selain 'arsip'
 * - 401: UNAUTHORIZED — sesi tidak ditemukan
 * - 403: FORBIDDEN — bukan COO
 * - 404: NOT_FOUND — fase tidak ditemukan
 *
 * **Validates: Requirements 5**
 */

/** Input body untuk archive fase RKAP. */
interface ArchivePhaseBody {
  status: 'arsip'
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

  // 3. Otorisasi — HANYA COO yang dapat archive fase RKAP (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat mengarsipkan fase RKAP.')
  if (cooBlocked) return cooBlocked

  // 4. Get phase ID from route parameter
  const phaseId = getRouterParam(event, 'id')
  if (!phaseId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'ID fase wajib diisi.',
      details: { field: 'id' },
    })
  }

  // 5. Parse request body
  const body = await readBody<ArchivePhaseBody>(event)

  // 6. Validasi input — hanya status 'arsip' yang didukung
  if (!body.status || body.status !== 'arsip') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION',
      message: 'Hanya status "arsip" yang didukung via PUT.',
      details: { field: 'status', received: body.status },
    })
  }

  // 7. Execute within transaction (AD-3: audit in same transaction)
  try {
    const result = await db.transaction(async (tx) => {
      // 7.1 Check phase exists first (outside lock, for better error message)
      const existingPhase = await findPhaseById(tx, phaseId)
      if (!existingPhase) {
        throw new RkapDomainError('Fase RKAP tidak ditemukan.', 'NOT_FOUND', { phaseId })
      }

      // 7.2 Check if already archived
      if (existingPhase.status === 'arsip') {
        throw new RkapDomainError('Fase sudah berstatus arsip.', 'VALIDATION', {
          phaseId,
          currentStatus: existingPhase.status,
        })
      }

      // 7.3 Update phase status to 'arsip'
      const updatedPhase = await updatePhaseStatus(tx, phaseId, 'arsip')
      if (!updatedPhase) {
        throw new RkapDomainError('Gagal mengarsipkan fase RKAP.', 'NOT_FOUND', { phaseId })
      }

      // 7.4 Write audit entry (AD-3)
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: principal.owner.id },
        action: 'rkap-phase-archived',
        target: `rkap_phases:${phaseId}`,
        details: {
          phaseId,
          phaseName: updatedPhase.name,
          oldStatus: existingPhase.status,
          newStatus: 'arsip',
        },
      })

      return updatedPhase
    })

    // 8. Return updated phase with HTTP 200
    return result
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
