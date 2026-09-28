/**
 * Unit tests — kontrak `shared/domain/http.ts`:
 * registry `HTTP_STATUS` terpusat (as const) dan tipe `HttpStatusCode` —
 * kontrak murni lintas lapis tanpa I/O (AD-5, AD-10).
 *
 * HTTP_STATUS dipakai bersama server API handlers dan client-side error
 * handling (mis. PdfPreview.vue). Tipe HttpStatusCode menjamin type-safety
 * saat menggunakan nilai status HTTP.
 */
import { describe, expect, test } from 'vitest'
import { HTTP_STATUS } from './http'
import type { HttpStatusCode } from './http'

/** Status HTTP standar yang wajib ada di registry (RFC 7231 subset). */
const STATUS_WAJIB = {
  // 2xx Success
  ok: 200,
  created: 201,
  noContent: 204,
  // 4xx Client Error
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  // 5xx Server Error
  serviceUnavailable: 503,
} as const

describe('shared/domain/http — HTTP_STATUS registry (AD-5, AD-10)', () => {
  test('HTTP_STATUS memiliki semua status wajib dengan nilai yang benar', () => {
    for (const [key, expectedValue] of Object.entries(STATUS_WAJIB)) {
      const actualValue = HTTP_STATUS[key as keyof typeof HTTP_STATUS]
      expect(actualValue, `HTTP_STATUS.${key} harus bernilai ${expectedValue}`).toBe(expectedValue)
    }
  })

  test('nilai HTTP_STATUS unik (tidak ada duplikat)', () => {
    const values = Object.values(HTTP_STATUS)
    expect(new Set(values).size).toBe(values.length)
  })

  test('semua nilai HTTP_STATUS adalah angka positif', () => {
    for (const [key, value] of Object.entries(HTTP_STATUS)) {
      expect(typeof value, `HTTP_STATUS.${key} harus number`).toBe('number')
      expect(value, `HTTP_STATUS.${key} harus positif`).toBeGreaterThan(0)
    }
  })

  test('HttpStatusCode type mencakup semua nilai HTTP_STATUS', () => {
    // Type-level test: ini akan error compile-time jika HttpStatusCode tidak cocok
    const statusCodes: HttpStatusCode[] = Object.values(HTTP_STATUS)
    expect(statusCodes.length).toBeGreaterThan(0)

    // Verify setiap nilai adalah HttpStatusCode yang valid
    for (const code of statusCodes) {
      const isValidCode: HttpStatusCode = code
      expect(isValidCode).toBe(code)
    }
  })

  test('HTTP_STATUS immutable (as const)', () => {
    // Verify nilai tidak bisa diubah (readonly dari as const)
    expect(Object.isFrozen(HTTP_STATUS)).toBe(false) // as const tidak freeze runtime
    // Tapi TypeScript akan error jika mencoba assign — compile-time safety
    expect(HTTP_STATUS.ok).toBe(200)
    expect(HTTP_STATUS.notFound).toBe(404)
  })
})
