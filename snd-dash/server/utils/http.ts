// server/utils/http.ts
//
// Utilitas HTTP bersama untuk route API tipis (task 18.x).
//
// Sumber kebenaran:
//   - design.md "Error Handling": bentuk error API SERAGAM `{ code, message, details }`.
//     Penolakan terhitung membawa angka lengkap pada `details` (tidak pernah generik).
//   - design.md Security Considerations / AD-12: Dokumen SSR & `/api/**` memakai
//     `Cache-Control: no-store`.
//   - AD-10: nilai uang/rasio MELINTAS batas API sebagai STRING desimal berskala tetap —
//     TIDAK PERNAH `Number()`/`parseFloat()`. Route mengembalikan `MoneyString`/`RatioString`
//     apa adanya (sudah string), helper di sini hanya menjamin bentuk & header.
//
// Modul ini bebas I/O dan aman diimpor tanpa koneksi/pustaka runtime tambahan.
// `defineEventHandler`, `setResponseHeader`, `setResponseStatus`, `readBody`,
// `getRouterParam`, `getQuery`, `H3Event` tersedia sebagai auto-import Nitro/h3.

import { AccessError } from './access'
import type { H3Event } from 'h3'

// ---------------------------------------------------------------------------
// Bentuk error API seragam — { code, message, details } (design.md Error Handling)
// ---------------------------------------------------------------------------

/** Payload error API yang seragam dikembalikan SEMUA route (design.md Error Handling). */
export interface ApiErrorBody {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Error API bertipe dengan `code` stabil + `statusCode` HTTP + `details` opsional.
 *
 * Route melempar `ApiError` (atau error domain ber-`code`) dan handler mengubahnya
 * menjadi respons `{ code, message, details }` lewat `sendApiError`. Penolakan
 * terhitung menyimpan angka lengkap pada `details` (font-mono di UI).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Cache-Control: no-store untuk /api/** (AD-12)
// ---------------------------------------------------------------------------

/**
 * Menetapkan `Cache-Control: no-store` pada respons (AD-12). Dipanggil di awal
 * setiap route handler `/api/**` sehingga respons tidak pernah di-cache
 * (nilai kepemilikan/harga/RKAP selalu segar). Middleware global (task 18.3)
 * menegakkan hal serupa; helper ini menjadikan tiap route mandiri & aman.
 */
export function noStore(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'no-store')
}

// ---------------------------------------------------------------------------
// Pemetaan error → respons { code, message, details }
// ---------------------------------------------------------------------------

/**
 * Memetakan `AccessError` (guard §4.8) ke status HTTP:
 *   - UNAUTHENTICATED   → 401
 *   - FORBIDDEN         → 403
 *   - REDIRECT_PERSONAL → 403 dengan `details.redirect` = Halaman Personal
 *     (klien mengarahkan ke Halaman Personal; server tetap otoritatif).
 */
function fromAccessError(err: AccessError): { status: number; body: ApiErrorBody } {
  if (err.code === 'UNAUTHENTICATED') {
    return { status: 401, body: { code: err.code, message: err.message } }
  }
  const details: Record<string, unknown> = { surface: err.surface }
  if (err.code === 'REDIRECT_PERSONAL') details.redirect = '/personal'
  return { status: 403, body: { code: err.code, message: err.message, details } }
}

/**
 * Mengubah error apa pun menjadi respons `{ code, message, details }` yang
 * seragam DAN menetapkan status HTTP yang sesuai (design.md Error Handling).
 *
 * Aturan pemetaan:
 *   - `AccessError`               → 401/403 (lihat `fromAccessError`).
 *   - `ApiError`                  → `statusCode`-nya sendiri.
 *   - Error domain ber-`code`     → 400 default (pesan & `code` dipertahankan;
 *     `details` disertakan bila ada). Ini mencakup PricingError/RkapError/
 *     ContributionError/DistributionError/IdentityError yang semuanya mengekspos
 *     `code` (+ opsional `details`).
 *   - Selain itu                  → 500 `INTERNAL` (pesan generik; detail asli
 *     tidak dibocorkan ke klien).
 */
export function sendApiError(event: H3Event, err: unknown): ApiErrorBody {
  noStore(event)

  if (err instanceof AccessError) {
    const mapped = fromAccessError(err)
    setResponseStatus(event, mapped.status)
    return mapped.body
  }

  if (err instanceof ApiError) {
    setResponseStatus(event, err.statusCode)
    return { code: err.code, message: err.message, details: err.details }
  }

  // Error domain ber-`code` (PricingError/RkapError/…): pertahankan code+message.
  if (isCodedError(err)) {
    setResponseStatus(event, 400)
    const body: ApiErrorBody = { code: err.code, message: err.message }
    if (isRecord(err.details)) body.details = err.details
    return body
  }

  setResponseStatus(event, 500)
  return { code: 'INTERNAL', message: 'Terjadi kesalahan pada server.' }
}

/** Error domain yang mengekspos `code: string` (+ opsional `details`). */
interface CodedError {
  code: string
  message: string
  details?: unknown
}

function isCodedError(err: unknown): err is CodedError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ---------------------------------------------------------------------------
// Pembungkus handler — jalankan → tangkap → respons seragam
// ---------------------------------------------------------------------------

/**
 * Membungkus logika route sehingga:
 *   1. `Cache-Control: no-store` selalu diset (AD-12), dan
 *   2. error apa pun dipetakan ke bentuk seragam `{ code, message, details }`.
 *
 * Handler sukses mengembalikan datanya langsung (uang/rasio sudah string, AD-10);
 * bila melempar, `sendApiError` mengambil alih penulisan status + body.
 */
export function defineApiHandler<T>(
  handler: (event: H3Event) => Promise<T> | T,
) {
  return defineEventHandler(async (event) => {
    noStore(event)
    try {
      return await handler(event)
    } catch (err) {
      return sendApiError(event, err)
    }
  })
}

// ---------------------------------------------------------------------------
// Guard nilai desimal berskala tetap (AD-10) — jaga agar TIDAK ada Number()
// ---------------------------------------------------------------------------

/**
 * Menjamin sebuah nilai adalah STRING desimal berskala tetap (AD-10) sebelum
 * dikirim melintasi batas API. Nilai uang/rasio dari domain SUDAH berupa
 * `MoneyString`/`RatioString` (string); helper ini menolak angka mentah yang
 * tanpa sengaja lolos (mencegah pelanggaran "money never float").
 *
 * Dipakai route saat menyusun payload manual dari nilai non-branded.
 */
export function assertDecimalString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ApiError(
      'INVALID_DECIMAL',
      `Nilai '${field}' harus berupa string desimal berskala tetap.`,
      500,
      { field, receivedType: typeof value },
    )
  }
  return value
}
