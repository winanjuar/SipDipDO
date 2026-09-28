/**
 * HTTP status codes — kontrak murni lintas lapis (AD-5, AD-10).
 *
 * Konstanta bernama untuk status HTTP — dipakai bersama server API handlers
 * dan client-side error handling (mis. PdfPreview.vue).
 *
 * Import lintas modul domain HARUS lewat index.ts modul ini (AD-5).
 * Tanpa I/O, tanpa framework — hanya konstanta dan tipe murni.
 */

/** Status HTTP yang dipakai envelope error — satu sumber untuk seluruh aplikasi. */
export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  serviceUnavailable: 503,
} as const

/** Tipe HTTP status code dari HTTP_STATUS object. */
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS]
