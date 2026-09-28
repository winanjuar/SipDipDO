import type { H3Event } from 'h3'

// Re-export HTTP_STATUS from shared for backward compatibility (AD-5, AD-10)
export { HTTP_STATUS } from '#shared/domain/http'

/**
 * Envelope error API seragam (konvensi spine): `{ code, message, details }`.
 * Route handler mengembalikan envelope ini dengan status HTTP yang sesuai —
 * bentuk tunggal untuk seluruh lapisan API, dipakai story berikutnya.
 */
export interface ApiErrorEnvelope {
  code: string
  message: string
  details: Record<string, unknown>
}

export function sendApiError(
  event: H3Event,
  status: number,
  envelope: ApiErrorEnvelope,
): ApiErrorEnvelope {
  setResponseStatus(event, status)
  return envelope
}
