/**
 * GET /api/admin/owners/:id — detail owner lengkap untuk halaman edit COO
 * (Story 1.8, Req 1, 2). Termasuk data identitas, kontak darurat, dan rekening
 * bank.
 *
 * Authorization (AD-8): hanya COO aktif (tenure berlaku pada saat request)
 * yang dapat mengakses endpoint ini — diperiksa via `findActiveCooTenure`.
 */
import { findActiveCooTenure, findOwnerByEmail, getOwnerById } from '../../../domain/identity'
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
  const sessionOwner = await findOwnerByEmail(db, email)
  if (!sessionOwner) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akun tidak terdaftar sebagai owner.',
      details: {},
    })
  }

  // Cek apakah owner adalah COO aktif (AD-8)
  const isCoo = await findActiveCooTenure(db, sessionOwner.id, new Date())
  if (!isCoo) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya COO aktif yang dapat mengakses detail owner.',
      details: {},
    })
  }

  // Ambil parameter :id dari route
  const ownerId = getRouterParam(event, 'id')
  if (!ownerId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION_ERROR',
      message: 'ID owner tidak ditemukan di URL.',
      details: {},
    })
  }

  // Ambil detail owner via domain service
  const ownerDetail = await getOwnerById(ownerId, db)
  if (!ownerDetail) {
    return sendApiError(event, HTTP_STATUS.notFound, {
      code: 'NOT_FOUND',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  return ownerDetail
})
