import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { listForPemegangSaham, MOM_LIMIT_DEFAULT, isMomLimit, type MomLimit } from '../../domain/pricing'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/mom — daftar MoM untuk pemegang saham (FR-7, AD-8): tanpa sesi →
 * 401; unlinked → redirect; owner tanpa saham → 403 (redirect ke personal
 * di halaman). Query `page` (default 1) dan `limit` (default 10, opsi
 * 10/20/40) — tidak valid → 400 envelope. Respons `{ data, nextPage }` urut
 * held_at desc.
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
function parseLimit(nilai: unknown): MomLimit | null {
  if (typeof nilai !== 'string' || !POLA_HALAMAN.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return isMomLimit(hasil) ? hasil : null
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

  // Owner tanpa saham dan calon owner tidak boleh akses MoM (AD-8, §4.8)
  if (principal.role === 'tanpa_saham' || principal.role === 'calon_owner') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses MoM hanya untuk pemegang saham.',
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

  return listForPemegangSaham(db, halamanTerparse ?? HALAMAN_DEFAULT, limitTerparse ?? MOM_LIMIT_DEFAULT)
})
