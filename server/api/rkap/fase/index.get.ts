import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { listFases, type ListFasesFilter, type RkapPhaseStatus } from '../../../domain/rkap'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { getSessionEmail } from '../../../utils/session'

/**
 * GET /api/rkap/fase — daftar fase RKAP dengan filter status opsional (Req-5, Req-6).
 *
 * Akses: Semua pengguna terautentikasi (pemegang_saham, tanpa_saham, coo).
 * Calon owner tidak boleh akses RKAP karena belum menjadi owner terverifikasi.
 * RKAP adalah read-only untuk non-COO (Req-6).
 *
 * Query params:
 * - `status?: 'berjalan' | 'arsip'` — filter berdasarkan status fase
 *
 * Response: `RkapPhaseRow[]` — array fase RKAP dengan summary
 *
 * **Validates: Requirements 5, 6**
 */

/** Opsi status fase yang valid. */
const VALID_STATUS: RkapPhaseStatus[] = ['berjalan', 'arsip']

/**
 * Cek apakah nilai adalah RkapPhaseStatus yang valid.
 */
function isValidStatus(value: unknown): value is RkapPhaseStatus {
  return typeof value === 'string' && VALID_STATUS.includes(value as RkapPhaseStatus)
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

  // 3. Otorisasi — RKAP terbuka untuk semua authenticated owner (Req-6)
  // Calon owner belum menjadi owner terverifikasi — tidak boleh akses
  if (principal.role === 'calon_owner') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses RKAP hanya untuk owner terverifikasi.',
      details: {},
    })
  }

  // 4. Parse query params
  const query = getQuery(event)

  // 5. Validasi filter status (opsional)
  const queryStatus = query.status
  let filter: ListFasesFilter | undefined

  if (queryStatus !== undefined && queryStatus !== '') {
    if (!isValidStatus(queryStatus)) {
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'BAD_REQUEST',
        message: 'Query status harus "berjalan" atau "arsip".',
        details: { status: String(queryStatus) },
      })
    }
    filter = { status: queryStatus }
  }

  // 6. Panggil service untuk mendapatkan daftar fase
  const phases = await listFases(db, filter)

  // 7. Return array of RkapPhaseRow
  return phases
})
