import { buildPrincipal, createIdentityRepo } from '../../../domain/identity'
import { PdfDomainError, uploadMomPdf } from '../../../domain/pricing'
import { MOM_PDF_ALLOWED_MIME_TYPES, MOM_PDF_MAX_SIZE_BYTES } from '#shared/domain/mom'
import { HTTP_STATUS, sendApiError } from '../../../utils/api-error'
import { useDb } from '../../../utils/db'
import { enforceCOO } from '../../../utils/role-guard'
import { getSessionEmail } from '../../../utils/session'

/**
 * POST /api/mom/:id/upload — upload PDF MoM ke storage privat (Req-1, Story 2.2).
 *
 * Enforce COO (AD-8): tanpa sesi → 401; unlinked → redirect; non-COO → 403.
 * Validasi file: MIME `application/pdf`, ukuran ≤ 10MB.
 * Service layer juga memvalidasi (defense in depth).
 *
 * Route handler TIPIS — pola finalize.post.ts.
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

  // 2. Otorisasi — bangun principal dan enforce COO
  const db = useDb()
  const principal = await buildPrincipal(createIdentityRepo(db), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')

  const blocked = enforceCOO(event, principal, 'Hanya COO yang dapat mengunggah PDF MoM.')
  if (blocked) return blocked

  // 3. Ambil ID MoM dari route parameter
  const momId = getRouterParam(event, 'id')
  if (!momId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'ID MoM wajib diisi.',
      details: {},
    })
  }

  // 4. Baca multipart form data
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION',
      message: 'File PDF wajib diunggah.',
      details: { field: 'file' },
    })
  }

  // Cari field 'file' dalam form data
  const filePart = formData.find((part) => part.name === 'file')
  if (!filePart || !filePart.data) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION',
      message: 'Field file tidak ditemukan dalam form data.',
      details: { field: 'file' },
    })
  }

  // 5. Validasi early: MIME type (sebelum masuk service — fail fast)
  const mimeType = filePart.type ?? ''
  if (!MOM_PDF_ALLOWED_MIME_TYPES.includes(mimeType as typeof MOM_PDF_ALLOWED_MIME_TYPES[number])) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION',
      message: `Tipe file tidak valid — hanya ${MOM_PDF_ALLOWED_MIME_TYPES.join(', ')} yang diizinkan.`,
      details: { field: 'file', received: mimeType },
    })
  }

  // 6. Validasi early: ukuran file (sebelum masuk service — fail fast)
  const fileBuffer = filePart.data
  if (fileBuffer.length > MOM_PDF_MAX_SIZE_BYTES) {
    const maxMB = MOM_PDF_MAX_SIZE_BYTES / (1024 * 1024)
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'VALIDATION',
      message: `Ukuran file melebihi batas maksimal ${maxMB}MB.`,
      details: { field: 'file', maxBytes: MOM_PDF_MAX_SIZE_BYTES, receivedBytes: fileBuffer.length },
    })
  }

  // 7. Dapatkan owner id untuk actor audit
  const ownerResult = await createIdentityRepo(db).findOwnerByEmail(email)
  if (!ownerResult?.id) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  // 8. Panggil service layer untuk upload
  const fileName = filePart.filename ?? 'uploaded.pdf'

  try {
    const mom = await uploadMomPdf(db, momId, fileBuffer, fileName, mimeType, ownerResult.id)
    return mom
  } catch (error) {
    if (error instanceof PdfDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: { id: momId },
        })
      }
      if (error.code === 'VALIDATION') {
        return sendApiError(event, HTTP_STATUS.badRequest, {
          code: 'VALIDATION',
          message: error.message,
          details: {},
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
