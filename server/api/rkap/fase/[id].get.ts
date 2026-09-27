import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { getFaseWithItems, RkapDomainError } from '../../../domain/rkap'
import { resolveHargaBerjalan, PricingDomainError } from '../../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { getSessionEmail } from '../../../utils/session'

/**
 * GET /api/rkap/fase/[id] — get phase with items and summary (Req-5, Req-6, Req-10, Req-12).
 *
 * Akses: Semua pengguna terautentikasi (pemegang_saham, tanpa_saham, coo).
 * Calon owner tidak boleh akses RKAP karena belum menjadi owner terverifikasi.
 * RKAP adalah read-only untuk non-COO (Req-6).
 *
 * Route params:
 * - `id` - Phase UUID from URL path
 *
 * Response: `RkapPhaseWire` — fase dengan items dan summary
 *
 * Note: currentBuyPrice diperlukan untuk:
 * - Menghitung adjustment limit (1% dari total Initial + harga beli 1 saham)
 * - Menghitung quantityLeft (floor dari Shortfall / buyPrice)
 *
 * **Validates: Requirements 5, 6, 10, 12**
 */
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

  // 4. Parse route params
  const phaseId = getRouterParam(event, 'id')
  if (!phaseId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Phase ID wajib diisi.',
      details: {},
    })
  }

  try {
    // 5. Get current buy price via resolveHargaBerjalan
    const priceResult = await resolveHargaBerjalan(db)
    const currentBuyPrice = priceResult.beli.amount

    // 6. Get phase with items and summary
    const phase = await getFaseWithItems(db, phaseId, currentBuyPrice)

    // 7. Return RkapPhaseWire
    return phase
  } catch (error) {
    // Handle domain errors
    if (error instanceof RkapDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: error.details ?? {},
        })
      }
    }

    // Handle pricing errors (no price data)
    if (error instanceof PricingDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: error.details ?? {},
        })
      }
    }

    // Re-throw unexpected errors
    throw error
  }
})
