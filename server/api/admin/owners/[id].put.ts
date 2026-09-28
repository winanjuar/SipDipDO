/**
 * PUT /api/admin/owners/:id — update data owner oleh COO (Story 1.8, Req 2, 5).
 * Mendukung partial update: identitas (fullName, alias, phoneNumber),
 * kontak darurat, dan rekening bank.
 *
 * Authorization (AD-8): hanya COO aktif yang dapat update.
 * Status Protection (AD-11): field `status` DITOLAK — transisi status hanya
 * via domain event (verifikasi email, suspend, dll).
 * Audit Atomicity (AD-3): setiap perubahan tercatat dalam transaksi yang sama.
 */
import {
  findActiveCooTenure,
  findOwnerByEmail,
  OWNER_VALIDATION_ERRORS,
  updateOwner,
  updateOwnerSchema,
} from '../../../domain/identity'
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
      message: 'Hanya COO aktif yang dapat mengubah data owner.',
      details: {},
    })
  }

  // Ambil parameter :id dari route
  const ownerId = getRouterParam(event, 'id')
  if (!ownerId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: OWNER_VALIDATION_ERRORS.VALIDATION_ERROR,
      message: 'ID owner tidak ditemukan di URL.',
      details: {},
    })
  }

  // Parse body dan cek field terlarang (AD-11, email immutable)
  const rawBody = await readBody(event)

  // Cek field `status` — DITOLAK per AD-11
  if (rawBody && typeof rawBody === 'object' && 'status' in rawBody) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: OWNER_VALIDATION_ERRORS.STATUS_CHANGE_FORBIDDEN,
      message: 'Perubahan status owner tidak diizinkan via API ini — status hanya berubah via domain event.',
      details: {},
    })
  }

  // Cek field `email` — DITOLAK (identifier unik, tidak dapat diubah)
  if (rawBody && typeof rawBody === 'object' && 'email' in rawBody) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: OWNER_VALIDATION_ERRORS.VALIDATION_ERROR,
      message: 'Email owner tidak dapat diubah — email adalah identifier unik.',
      details: {},
    })
  }

  // Validasi input dengan Zod schema
  const parseResult = updateOwnerSchema.safeParse(rawBody)
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: OWNER_VALIDATION_ERRORS.VALIDATION_ERROR,
      message: 'Data tidak valid.',
      details: { issues },
    })
  }

  // Update owner via domain service (includes audit, AD-3)
  const result = await updateOwner(
    { ownerId, ...parseResult.data },
    sessionOwner.id,
    db,
  )

  if (!result) {
    return sendApiError(event, HTTP_STATUS.notFound, {
      code: 'NOT_FOUND',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  return { owner: result.owner }
})
