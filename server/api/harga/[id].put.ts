import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { koreksiHarga, PricingDomainError } from '../../domain/pricing'
import { validatePriceCorrectInput } from '#shared/domain/price'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { enforceCOO } from '../../utils/role-guard'
import { getSessionEmail } from '../../utils/session'
import { readBody } from 'h3'

/**
 * PUT /api/harga/:id — koreksi harga existing (Req-3 AC4, Story 2.3).
 * Enforce COO only (AD-8): tanpa sesi → 401; unlinked → redirect; non-COO → 403.
 *
 * Berbeda dengan POST /api/harga yang memerlukan type dan effectiveDate,
 * PUT menerima price ID dari path dan hanya amount + momId di body.
 * Type dan effectiveDate diambil dari harga existing, tidak dapat diubah.
 *
 * Validasi (dilakukan di service):
 * - Harga dengan ID tersebut harus ada
 * - MoM referensi wajib dan harus berstatus final (Req-14)
 * - Amount harus positif (Req-3)
 *
 * Route handler TIPIS — logika bisnis di pricing.service.koreksiHarga.
 *
 * **Validates: Requirements 3, 14**
 */
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

  // Enforce COO only (AD-8)
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat mengoreksi harga.')
  if (cooBlocked) return cooBlocked

  const priceId = getRouterParam(event, 'id')
  if (!priceId) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'ID harga wajib diisi.',
      details: {},
    })
  }

  const body = await readBody(event)

  // Validasi input dasar di shared domain
  const validationError = validatePriceCorrectInput(body)
  if (validationError) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: validationError,
      details: { field: getInvalidField(body) },
    })
  }

  // Dapatkan owner id untuk actor audit
  const ownerResult = await createIdentityRepo(db).findOwnerByEmail(email)
  if (!ownerResult?.id) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Owner tidak ditemukan.',
      details: {},
    })
  }

  try {
    const price = await koreksiHarga(db, priceId, {
      amount: body.amount,
      momId: body.momId,
    }, ownerResult.id)

    return price
  } catch (error) {
    if (error instanceof PricingDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: error.details ?? { priceId },
        })
      }
      if (error.code === 'MOM_NOT_FINAL') {
        return sendApiError(event, HTTP_STATUS.badRequest, {
          code: 'MOM_NOT_FINAL',
          message: error.message,
          details: { momId: body.momId },
        })
      }
      if (error.code === 'VALIDATION') {
        return sendApiError(event, HTTP_STATUS.badRequest, {
          code: 'VALIDATION',
          message: error.message,
          details: error.details ?? {},
        })
      }
    }
    throw error
  }
})

/**
 * Mengidentifikasi field pertama yang tidak valid berdasarkan input partial.
 * Urutan sesuai validatePriceCorrectInput: amount, momId.
 */
function getInvalidField(body: Record<string, unknown>): string {
  if (!body.amount) return 'amount'
  return 'momId'
}
