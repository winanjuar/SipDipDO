import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { resolveHargaBerjalan, PricingDomainError } from '../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/harga/resolve — resolusi harga berjalan (Req-4, AD-7, AD-8).
 *
 * Akses: Semua pengguna terautentikasi (pemegang_saham, tanpa_saham, coo).
 * Calon owner (diajukan/ditolak/kedaluwarsa) tidak boleh akses harga karena
 * belum menjadi owner yang terverifikasi.
 *
 * Query params:
 * - `date`: ISO date string YYYY-MM-DD (opsional, default hari ini)
 *
 * Response: `PriceResolveResult { beli: PriceWire, jual: PriceWire }`
 *
 * Error responses:
 * - 401: Sesi tidak ditemukan
 * - 403: Akses ditolak (calon_owner)
 * - 404: Tidak ada harga yang berlaku untuk tanggal tersebut
 * - 400: Format tanggal tidak valid
 *
 * **Validates: Requirements 4**
 */

/** Pola validasi format tanggal ISO (YYYY-MM-DD). */
const POLA_TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parse `?date=` → Date object; null bila tidak valid.
 */
function parseTanggal(nilai: unknown): Date | null {
  if (typeof nilai !== 'string' || !POLA_TANGGAL_ISO.test(nilai)) return null
  const hasil = new Date(nilai)
  // Validasi tanggal valid (bukan NaN) dan format cocok
  if (Number.isNaN(hasil.getTime())) return null
  // Pastikan hasil parse cocok dengan input (hindari "2026-02-30" → "2026-03-02")
  const hasilStr = hasil.toISOString().split('T')[0]
  return hasilStr === nilai ? hasil : null
}

export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const db = useDb()
  const principal = await buildPrincipal(createIdentityRepo(db), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  // Harga terbuka untuk semua authenticated user KECUALI calon_owner
  // (AD-8, Req-4): calon owner belum menjadi owner terverifikasi
  if (principal.role === 'calon_owner') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses harga hanya untuk owner terverifikasi.',
      details: {},
    })
  }

  const query = getQuery(event)

  // Parse dan validasi query date (opsional)
  const queryDate = query.date
  let resolveDate: Date | undefined

  if (queryDate !== undefined && queryDate !== '') {
    const tanggalTerparse = parseTanggal(queryDate)
    if (tanggalTerparse === null) {
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'BAD_REQUEST',
        message: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.',
        details: { date: String(queryDate) },
      })
    }
    resolveDate = tanggalTerparse
  }

  try {
    const result = await resolveHargaBerjalan(db, resolveDate)
    return result
  } catch (error) {
    if (error instanceof PricingDomainError && error.code === 'NOT_FOUND') {
      return sendApiError(event, HTTP_STATUS.notFound, {
        code: 'NOT_FOUND',
        message: error.message,
        details: error.details ?? {},
      })
    }
    throw error
  }
})
