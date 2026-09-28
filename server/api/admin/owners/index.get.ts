/**
 * GET /api/admin/owners — daftar semua owner untuk halaman manajemen COO
 * (Story 1.8, Req 1, 4). Termasuk owner berstatus `keluar` (FR-13) sehingga
 * OwnerPicker komponen dapat menampilkan seluruh owner untuk Epic 3.
 *
 * Authorization (AD-8): hanya COO aktif (tenure berlaku pada saat request)
 * yang dapat mengakses endpoint ini — diperiksa via `findActiveCooTenure`.
 */
import { findActiveCooTenure, findOwnerByEmail, listOwners } from '../../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { getSessionEmail } from '../../../utils/session'

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

  // Ambil owner dari sesi untuk mendapatkan ownerId
  const owner = await findOwnerByEmail(db, email)
  if (!owner) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akun tidak terdaftar sebagai owner.',
      details: {},
    })
  }

  // Cek apakah owner adalah COO aktif (AD-8)
  const isCoo = await findActiveCooTenure(db, owner.id, new Date())
  if (!isCoo) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya COO aktif yang dapat mengakses daftar owner.',
      details: {},
    })
  }

  // Ambil daftar owner via domain service
  const ownerList = await listOwners(db)

  return { owners: ownerList }
})
