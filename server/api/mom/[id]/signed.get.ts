import { aksesPenuh, buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { generateSignedUrl, PdfDomainError } from '../../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { getSessionEmail } from '../../../utils/session'

/**
 * GET /api/mom/:id/signed — generate Signed URL untuk preview PDF MoM (Req-2, Story 2.2).
 *
 * Akses (AD-8, §4.8):
 * - COO: ✅
 * - Pemegang saham (termasuk keluar-PERNAH-beli via aksesPenuh): ✅
 * - Tanpa saham belum-pernah-beli: ❌ (403)
 * - Calon owner: ❌ (403)
 * - Tanpa sesi: ❌ (401)
 *
 * Response: { url: string, expiresAt: string } — URL valid 15 menit (Req-2 AC1).
 * Error:
 * - 401: Sesi tidak ditemukan
 * - 403: Akses ditolak (bukan pemegang saham atau COO)
 * - 404: MoM tidak ditemukan atau belum punya PDF
 * - 503: Storage error
 */
export default defineEventHandler(async (event) => {
  // 1. Autentikasi — sesi wajib ada
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  // 2. Otorisasi — bangun principal dan verifikasi akses
  const db = useDb()
  const principal = await buildPrincipal(createIdentityRepo(db), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // AD-8 matriks §4.8: COO dan pemegang saham boleh akses
  // tanpa_saham belum-pernah-beli dan calon_owner tidak boleh
  if (principal.role === 'calon_owner') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses preview PDF hanya untuk pemegang saham.',
      details: {},
    })
  }

  // tanpa_saham hanya boleh kalau aksesPenuh (pernah beli — keluar-pernah-beli)
  if (principal.role === 'tanpa_saham' && !aksesPenuh(principal.owner)) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses preview PDF hanya untuk pemegang saham.',
      details: {},
    })
  }

  // 3. Ambil ID MoM dari route parameter
  const momId = getRouterParam(event, 'id')
  if (!momId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'ID MoM wajib diisi.',
      details: {},
    })
  }

  // 4. Generate signed URL via service layer
  try {
    const result = await generateSignedUrl(db, momId)
    return result
  } catch (error) {
    if (error instanceof PdfDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: { id: momId },
        })
      }
      if (error.code === 'STORAGE_ERROR') {
        return sendApiError(event, HTTP_STATUS.serviceUnavailable, {
          code: 'STORAGE_ERROR',
          message: error.message,
          details: {},
        })
      }
    }
    throw error
  }
})
