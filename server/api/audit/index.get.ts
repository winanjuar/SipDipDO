import { listForCoo } from '../../domain/audit'
import { AUDIT_LIMIT_DEFAULT, isAuditLimit, type AuditLimit } from '#shared/domain/audit'
import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/audit — daftar audit trail khusus COO (FR-12, AD-8): sesi →
 * `buildPrincipal` (role per-request dari `coo_tenures` berlaku) → non-COO
 * 403 envelope; unlinked → redirect `/login?res=unlinked`; tanpa sesi →
 * 401 envelope. Query `page` (default 1) dan `limit` (default 20, opsi
 * 20/40/80 — renegosiasi user 2026-09-17) — tidak valid → 400 envelope.
 * Respons `{ data, nextPage }` urut `created_at` desc. Route handler TIPIS —
 * pola `server/api/register/status.get.ts`; keputusan kewenangan di
 * server, tidak pernah di klien (AD-8).
 */

/** Nomor halaman awal — default query `?page=` sesuai matriks I/O spec 1.3. */
const HALAMAN_DEFAULT = 1
/** Pola ketat nomor halaman: hanya digit — tanpa tanda, desimal, atau ekor asing. */
const POLA_HALAMAN = /^\d+$/
/** Batas aman integer (di atasnya bigint bind gagal — 500, bukan kontrak). */
const MAKS_HALAMAN_AMAN = Number.MAX_SAFE_INTEGER

/**
 * Parse `?page=` → bilangan bulat ≥ 1; null bila tidak valid. Ketat:
 * `/^\d+$/` + batas MAX_SAFE_INTEGER — '2abc' maupun '1e21' ditolak.
 */
function parseHalaman(nilai: unknown): number | null {
  if (typeof nilai !== 'string' || !POLA_HALAMAN.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return hasil >= 1 && hasil <= MAKS_HALAMAN_AMAN ? hasil : null
}

/**
 * Parse `?limit=` → anggota opsi terkontrak (20/40/80); null bila tidak
 * valid (hadir tapi bukan digit/anggota opsi). Absen/kosong → null, artinya
 * pemanggil memakai default.
 */
function parseLimit(nilai: unknown): AuditLimit | null {
  if (typeof nilai !== 'string' || !POLA_HALAMAN.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return isAuditLimit(hasil) ? hasil : null
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

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')
  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Audit Trail hanya dapat dibuka oleh COO yang bertugas.',
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
      message: 'Query limit harus salah satu dari 20, 40, atau 80.',
      details: { limit: String(queryLimit) },
    })
  }

  return listForCoo(useDb(), halamanTerparse ?? HALAMAN_DEFAULT, limitTerparse ?? AUDIT_LIMIT_DEFAULT)
})
