import type { H3Event } from 'h3'

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

/** Status HTTP yang dipakai envelope error — satu sumber untuk seluruh route. */
export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  serviceUnavailable: 503,
} as const

export function sendApiError(
  event: H3Event,
  status: number,
  envelope: ApiErrorEnvelope,
): ApiErrorEnvelope {
  setResponseStatus(event, status)
  return envelope
}
