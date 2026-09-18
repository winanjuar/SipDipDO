import { ajukanPendaftaran } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { readBody, setResponseStatus } from 'h3'

/**
 * POST /api/register — pendaftaran owner mandiri (Story 1.4, FR-22):
 * email diambil dari sesi Google (BUKAN dari body); body TIDAK menerima
 * field referral (referral hanya di Pembelian Pertama, Epic 3) → 400
 * envelope. Idempotent per email: 201 saat baris `diajukan` baru dibuat
 * (+ audit in-tx di modul identity), 200 saat mengembalikan baris existing
 * TANPA mutasi (AD-11). Route handler tipis — logika di modul identity.
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

  const body = (await readBody<Record<string, unknown>>(event).catch(() => undefined)) ?? {}
  if (typeof body === 'object' && body !== null && 'referral' in body) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Field referral tidak diterima saat pendaftaran — referral hanya diminta saat Pembelian Pertama.',
      details: {},
    })
  }

  const { rekaman, baru } = await ajukanPendaftaran({ email }, useDb())
  setResponseStatus(event, baru ? HTTP_STATUS.created : HTTP_STATUS.ok)
  return { id: rekaman.id, email: rekaman.email, status: rekaman.status }
})
