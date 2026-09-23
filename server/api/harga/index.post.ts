import { buildPrincipal, createIdentityRepo } from '../../domain/identity'
import { PricingDomainError, tetapkanHarga } from '../../domain/pricing'
import { validatePriceCreateInput } from '#shared/domain/price'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { enforceCOO } from '../../utils/role-guard'
import { getSessionEmail } from '../../utils/session'
import { readBody, setResponseStatus } from 'h3'

/**
 * POST /api/harga — create/correct harga (Req-3, Story 2.3). Enforce COO (AD-8):
 * tanpa sesi → 401; unlinked → redirect; non-COO → 403.
 *
 * Logika upsert dari service:
 * - Jika sudah ada harga untuk (type, effectiveDate), update existing (koreksi)
 * - Jika belum ada, insert baru
 *
 * Validasi (dilakukan di service):
 * - MoM referensi wajib dan harus berstatus final (Req-14)
 * - Amount harus positif (Req-3)
 * - effectiveDate tidak boleh di masa lampau kecuali mode koreksi (Req-3 AC5)
 *
 * Route handler TIPIS — logika bisnis di pricing.service.tetapkanHarga.
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
  const cooBlocked = enforceCOO(event, principal, 'Hanya COO yang dapat menetapkan harga.')
  if (cooBlocked) return cooBlocked

  const body = await readBody(event)

  // Validasi input dasar di shared domain
  const validationError = validatePriceCreateInput(body)
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
    const price = await tetapkanHarga(db, {
      type: body.type,
      effectiveDate: body.effectiveDate,
      amount: body.amount,
      momId: body.momId,
    }, ownerResult.id)

    setResponseStatus(event, HTTP_STATUS.created)
    return price
  } catch (error) {
    if (error instanceof PricingDomainError) {
      if (error.code === 'NOT_FOUND') {
        return sendApiError(event, HTTP_STATUS.notFound, {
          code: 'NOT_FOUND',
          message: error.message,
          details: error.details ?? {},
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
      if (error.code === 'PAST_DATE') {
        return sendApiError(event, HTTP_STATUS.badRequest, {
          code: 'PAST_DATE',
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
 * Urutan sesuai validatePriceCreateInput: type, effectiveDate, amount, momId.
 */
function getInvalidField(body: Record<string, unknown>): string {
  if (!body.type) return 'type'
  if (!body.effectiveDate) return 'effectiveDate'
  if (!body.amount) return 'amount'
  return 'momId'
}
