/**
 * POST /api/admin/owners — create owner baru oleh COO (Story 1.8, Req 3).
 * Owner yang ditambahkan COO langsung berstatus `terverifikasi` (pre-approved)
 * tanpa perlu verifikasi email.
 *
 * Authorization (AD-8): hanya COO aktif yang dapat menambah owner.
 * Email Uniqueness (Property 3): email duplikat ditolak dengan 409.
 * Audit Atomicity (AD-3): pembuatan tercatat dalam transaksi yang sama.
 */
import {
  createOwnerByCoo,
  createOwnerSchema,
  findActiveCooTenure,
  findOwnerByEmail,
  OWNER_VALIDATION_ERRORS,
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
      message: 'Hanya COO aktif yang dapat menambahkan owner baru.',
      details: {},
    })
  }

  // Parse dan validasi body dengan Zod schema
  const rawBody = await readBody(event)
  const parseResult = createOwnerSchema.safeParse(rawBody)
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

  // Create owner via domain service (includes audit, AD-3)
  const result = await createOwnerByCoo(
    parseResult.data,
    sessionOwner.id,
    db,
  )

  // Handle EMAIL_EXISTS error (Property 3)
  if (!result.success) {
    return sendApiError(event, HTTP_STATUS.conflict, {
      code: OWNER_VALIDATION_ERRORS.EMAIL_EXISTS,
      message: 'Email sudah terdaftar — tidak dapat menambahkan owner dengan email yang sama.',
      details: { email: parseResult.data.email },
    })
  }

  // Success — return 201 Created
  setResponseStatus(event, HTTP_STATUS.created)
  return { owner: result.owner }
})
