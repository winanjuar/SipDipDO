// server/utils/pricing-input.ts
//
// Parser & validasi input route domain PRICING (FR-6/FR-7). Menjaga route tetap
// TIPIS: mengubah query/body mentah menjadi tipe kontrak (`SetPriceInput`,
// `MomInput`) dengan validasi bentuk minimal, TANPA `Number()`/`parseFloat()`
// atas nilai uang (AD-10) — `price` dipertahankan sebagai STRING berskala tetap.
//
// Melempar `ApiError('INVALID_INPUT', …)` (400) pada bentuk tak valid; route
// membungkusnya menjadi `{ code, message, details }` seragam via defineApiHandler.

import type {
  JakartaDate,
  MoneyString,
  PriceKind,
  Uuid,
} from '../../shared/domain/types'
import { toJakartaDate } from '../../shared/domain/calendar'
import type { MomInput, SetPriceInput } from '../domain/pricing'
import { ApiError } from './http'

/** Tanggal hari ini zona Asia/Jakarta (AD-9). */
export function todayJakarta(): JakartaDate {
  return toJakartaDate(new Date())
}

/** Pola tanggal 'YYYY-MM-DD' (branded JakartaDate). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** Pola nilai uang berskala tetap: digit opsional 2 desimal (mis. '1000' / '1000.50'). */
const MONEY_RE = /^-?\d+(\.\d{1,2})?$/
/** Pola UUID v4 longgar (bentuk 8-4-4-4-12). */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function bad(message: string, details?: Record<string, unknown>): never {
  throw new ApiError('INVALID_INPUT', message, 400, details)
}

/** Memvalidasi `kind` ∈ {beli, jual} (FR-6). */
export function parseKind(raw: unknown): PriceKind {
  if (raw === 'beli' || raw === 'jual') return raw
  return bad("Parameter 'kind' harus 'beli' atau 'jual'.", { kind: raw })
}

/** Memvalidasi UUID; melempar bila tidak valid. */
export function parseUuid(raw: unknown, field: string): Uuid {
  if (typeof raw === 'string' && UUID_RE.test(raw)) return raw as Uuid
  return bad(`Parameter '${field}' harus UUID yang valid.`, { [field]: raw })
}

/** Memvalidasi UUID opsional (undefined/null → undefined). */
export function parseOptionalUuid(raw: unknown, field: string): Uuid | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  return parseUuid(raw, field)
}

/** Memvalidasi JakartaDate 'YYYY-MM-DD'. */
export function parseJakartaDate(raw: unknown, field: string): JakartaDate {
  if (typeof raw === 'string' && DATE_RE.test(raw)) return raw as JakartaDate
  return bad(`Parameter '${field}' harus tanggal 'YYYY-MM-DD'.`, { [field]: raw })
}

/** Memvalidasi JakartaDate opsional. */
export function parseOptionalJakartaDate(
  raw: unknown,
  field: string,
): JakartaDate | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  return parseJakartaDate(raw, field)
}

/**
 * Memvalidasi nilai uang berskala tetap SEBAGAI STRING (AD-10). Menolak angka
 * mentah (number) untuk mencegah pelanggaran "money never float".
 */
export function parseMoney(raw: unknown, field: string): MoneyString {
  if (typeof raw !== 'string' || !MONEY_RE.test(raw)) {
    return bad(
      `Parameter '${field}' harus string uang berskala tetap (mis. '1000.00').`,
      { [field]: raw, type: typeof raw },
    )
  }
  return raw as MoneyString
}

/** Merakit `SetPriceInput` (FR-6.1) dari body mentah + `momRef` terpisah. */
export function parseSetPriceBody(body: unknown): {
  input: SetPriceInput
  momRef: Uuid
} {
  const b = asRecord(body)
  return {
    input: {
      kind: parseKind(b.kind),
      price: parseMoney(b.price, 'price'),
      effectiveDate: parseJakartaDate(b.effectiveDate, 'effectiveDate'),
    },
    momRef: parseUuid(b.momRef, 'momRef'),
  }
}

/** Merakit `MomInput` (FR-7) dari body mentah. */
export function parseMomBody(body: unknown): MomInput {
  const b = asRecord(body)
  const input: MomInput = {}
  if (b.id !== undefined) input.id = parseUuid(b.id, 'id')
  if (b.title !== undefined) {
    if (typeof b.title !== 'string') bad("Parameter 'title' harus string.")
    input.title = b.title
  }
  if (b.momDate !== undefined) input.momDate = parseJakartaDate(b.momDate, 'momDate')
  if (b.body !== undefined) {
    if (b.body !== null && typeof b.body !== 'string') {
      bad("Parameter 'body' harus string atau null.")
    }
    input.body = b.body as string | null
  }
  if (b.finalize !== undefined) {
    if (typeof b.finalize !== 'boolean') bad("Parameter 'finalize' harus boolean.")
    input.finalize = b.finalize
  }
  return input
}

/** Memastikan body adalah objek record. */
export function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return bad('Body permintaan harus berupa objek JSON.')
  }
  return body as Record<string, unknown>
}
