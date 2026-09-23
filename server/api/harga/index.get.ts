import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { listHarga, isPriceLimit, PRICE_LIMIT_DEFAULT, type PriceLimit } from '../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/harga — daftar harga dengan pagination (Req-4, AD-8).
 *
 * Akses: Semua pengguna terautentikasi (pemegang_saham, tanpa_saham, coo).
 * Calon owner (diajukan/ditolak/kedaluwarsa) tidak boleh akses harga karena
 * belum menjadi owner yang terverifikasi.
 *
 * Query params:
 * - `page`: nomor halaman (default 1), bilangan bulat ≥ 1
 * - `limit`: ukuran halaman (default 10), opsi: 10, 20, atau 40
 *
 * Response: `{ data: PriceWire[], nextPage: number | null }`
 *
 * **Validates: Requirements 4**
 */

/** Nomor halaman awal — default query `?page=`. */
const HALAMAN_DEFAULT = 1
/** Pola ketat nomor halaman: hanya digit. */
const POLA_HALAMAN = /^\d+$/
/** Batas aman integer. */
const MAKS_HALAMAN_AMAN = Number.MAX_SAFE_INTEGER

/**
 * Parse `?page=` → bilangan bulat ≥ 1; null bila tidak valid.
 */
function parseHalaman(nilai: unknown): number | null {
  if (typeof nilai !== 'string' || !POLA_HALAMAN.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return hasil >= 1 && hasil <= MAKS_HALAMAN_AMAN ? hasil : null
}

/**
 * Parse `?limit=` → anggota opsi terkontrak (10/20/40); null bila tidak valid.
 */
function parseLimit(nilai: unknown): PriceLimit | null {
  if (typeof nilai !== 'string' || !POLA_HALAMAN.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return isPriceLimit(hasil) ? hasil : null
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

  const queryPage = query.page
  const halamanTerparse = parseHalaman(queryPage)
  if (halamanTerparse === null && queryPage !== undefined && queryPage !== '') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Query page harus bilangan bulat ≥ 1.',
      details: { page: String(queryPage) },
    })
  }

  const queryLimit = query.limit
  const limitTerparse = parseLimit(queryLimit)
  if (limitTerparse === null && queryLimit !== undefined && queryLimit !== '') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Query limit harus salah satu dari 10, 20, atau 40.',
      details: { limit: String(queryLimit) },
    })
  }

  return listHarga(db, halamanTerparse ?? HALAMAN_DEFAULT, limitTerparse ?? PRICE_LIMIT_DEFAULT)
})
