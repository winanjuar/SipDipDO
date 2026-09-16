// server/utils/distribution-input.ts
//
// Parser & validasi input route domain DISTRIBUTION (FR-16). Menjaga route TIPIS.
//
// Nilai uang & ratio dipertahankan sebagai STRING berskala tetap (AD-10) — TIDAK
// PERNAH `Number()`/`parseFloat()`. Route memilih antara:
//   - `assembleInput` (rakit owners dari ledger + poin Contribution terfinalkan), atau
//   - `owners` eksplisit (bila disuplai) untuk simulasi murni.
//
// Melempar `ApiError('INVALID_INPUT', …)` (400) pada bentuk tak valid.

import type { MoneyString, RatioString, Uuid } from '../../shared/domain/types'
import type { AssembleParams, DistributionInput, OwnerDistributionInput } from '../domain/distribution'
import { ApiError } from './http'
import { asRecord, parseMoney, parseOptionalUuid, parseUuid } from './pricing-input'

/** Pola ratio berskala tetap 0..1 (numeric(9,6)) — non-negatif. */
const RATIO_RE = /^\d+(\.\d{1,6})?$/

function bad(message: string, details?: Record<string, unknown>): never {
  throw new ApiError('INVALID_INPUT', message, 400, details)
}

/** Ratio berskala tetap SEBAGAI STRING (AD-10) — menolak angka mentah. */
export function parseRatio(raw: unknown, field: string): RatioString {
  if (typeof raw !== 'string' || !RATIO_RE.test(raw)) {
    return bad(`Parameter '${field}' harus string ratio berskala tetap (mis. '0.500000').`, {
      [field]: raw,
      type: typeof raw,
    })
  }
  return raw as RatioString
}

/** Parameter agregat rekap (dipakai baik simulate maupun saveRecap). */
export interface DistributionParams {
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  momRef: Uuid | null
}

/** Merakit parameter agregat dari body mentah. */
export function parseDistributionParams(body: unknown): DistributionParams {
  const b = asRecord(body)
  return {
    auditedProfit: parseMoney(b.auditedProfit, 'auditedProfit'),
    retainedProfit: parseMoney(b.retainedProfit, 'retainedProfit'),
    charityRatio: parseRatio(b.charityRatio, 'charityRatio'),
    dividendRatio: parseRatio(b.dividendRatio, 'dividendRatio'),
    incentiveRatio: parseRatio(b.incentiveRatio, 'incentiveRatio'),
    momRef: parseOptionalUuid(b.momRef, 'momRef') ?? null,
  }
}

/** Params → `AssembleParams` untuk `distribution.assembleInput`. */
export function toAssembleParams(p: DistributionParams): AssembleParams {
  return {
    auditedProfit: p.auditedProfit,
    retainedProfit: p.retainedProfit,
    charityRatio: p.charityRatio,
    dividendRatio: p.dividendRatio,
    incentiveRatio: p.incentiveRatio,
    momRef: p.momRef,
  }
}

/**
 * Bila body menyertakan `owners` eksplisit (untuk simulasi murni tanpa DB),
 * merakit `DistributionInput` lengkap; jika tidak, mengembalikan `null` agar
 * route memakai `assembleInput`.
 */
export function parseExplicitInput(body: unknown): DistributionInput | null {
  const b = asRecord(body)
  if (b.owners === undefined) return null
  if (!Array.isArray(b.owners)) bad("Parameter 'owners' harus array.")

  const params = parseDistributionParams(body)
  const owners: OwnerDistributionInput[] = (b.owners as unknown[]).map((o, i) => {
    const ow = asRecord(o)
    const points = ow.points
    if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) {
      bad(`Parameter 'owners[${i}].points' harus bilangan bulat non-negatif.`)
    }
    return {
      ownerId: parseUuid(ow.ownerId, `owners[${i}].ownerId`),
      portion: parseRatio(ow.portion, `owners[${i}].portion`),
      points: points as number,
    }
  })

  return {
    auditedProfit: params.auditedProfit,
    retainedProfit: params.retainedProfit,
    charityRatio: params.charityRatio,
    dividendRatio: params.dividendRatio,
    incentiveRatio: params.incentiveRatio,
    owners,
    momRef: params.momRef,
  }
}
