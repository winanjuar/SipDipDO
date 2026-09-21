import {
  buildPrincipal,
  createIdentityRepo,
  daftarCalonVerifikasi,
} from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/pendaftar — daftar calon `diajukan` khusus COO (Story 1.6, AD-8):
 * sesi → `buildPrincipal` (role per-request dari `coo_tenures` berlaku) →
 * non-COO 403 envelope; unlinked → redirect `/login?res=unlinked`; tanpa
 * sesi → 401 envelope. Respons `{ data: [{ id, email, nama, createdAt,
 * profilLengkap, sisaField }] }` urut `created_at` terlama dulu. Route
 * handler TIPIS — pola `server/api/audit/index.get.ts`; keputusan
 * kewenangan di server, tidak pernah di klien (AD-8).
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

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')
  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Daftar pendaftar hanya dapat dibuka oleh COO yang bertugas.',
      details: {},
    })
  }

  return { data: await daftarCalonVerifikasi(useDb()) }
})
