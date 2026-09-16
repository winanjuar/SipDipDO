// server/utils/contribution-input.ts
//
// Parser & validasi input route domain CONTRIBUTION (FR-8/FR-9/FR-10). Menjaga
// route TIPIS: mengubah body mentah menjadi tipe kontrak (`ContributionItemInput`,
// `RealizationInput`) dengan validasi bentuk minimal.
//
// Poin adalah bilangan bulat (integer), BUKAN nilai uang — parsing integer di sini
// aman (bukan nilai desimal berskala tetap AD-10). Melempar `ApiError('INVALID_INPUT')`.

import type { Uuid } from '../../shared/domain/types'
import type { ContributionItemInput, RealizationInput } from '../domain/contribution'
import { ApiError } from './http'
import { asRecord, parseJakartaDate, parseOptionalUuid, parseUuid } from './pricing-input'

function bad(message: string, details?: Record<string, unknown>): never {
  throw new ApiError('INVALID_INPUT', message, 400, details)
}

/** Memvalidasi integer non-negatif (poin kontribusi). */
export function parseIntegerPoints(raw: unknown, field: string): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return bad(`Parameter '${field}' harus bilangan bulat non-negatif.`, {
      [field]: raw,
    })
  }
  return raw
}

/** Memvalidasi integer non-negatif opsional. */
export function parseOptionalIntegerPoints(
  raw: unknown,
  field: string,
): number | undefined {
  if (raw === undefined || raw === null) return undefined
  return parseIntegerPoints(raw, field)
}

/** Merakit `ContributionItemInput` (FR-8) + momRef terpisah. */
export function parseDefineItemBody(body: unknown): {
  input: ContributionItemInput
  momRef: Uuid
} {
  const b = asRecord(body)
  if (typeof b.name !== 'string' || b.name.trim() === '') {
    bad("Parameter 'name' wajib.")
  }
  if (b.description !== undefined && b.description !== null && typeof b.description !== 'string') {
    bad("Parameter 'description' harus string atau null.")
  }
  return {
    input: {
      name: b.name as string,
      description: (b.description as string | null | undefined) ?? null,
      points: parseIntegerPoints(b.points, 'points'),
      periodId: parseOptionalUuid(b.periodId, 'periodId') ?? null,
    },
    momRef: parseUuid(b.momRef, 'momRef'),
  }
}

/** Merakit `RealizationInput` (FR-9). */
export function parseRealizationBody(body: unknown): RealizationInput {
  const b = asRecord(body)
  return {
    ownerId: parseUuid(b.ownerId, 'ownerId'),
    itemId: parseUuid(b.itemId, 'itemId'),
    recordedDate: parseJakartaDate(b.recordedDate, 'recordedDate'),
    periodId: parseOptionalUuid(b.periodId, 'periodId') ?? null,
    points: parseOptionalIntegerPoints(b.points, 'points'),
  }
}
