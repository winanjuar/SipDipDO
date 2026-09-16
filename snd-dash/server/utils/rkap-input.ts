// server/utils/rkap-input.ts
//
// Parser & validasi input route domain RKAP (FR-23). Menjaga route tetap TIPIS:
// mengubah body mentah menjadi tipe kontrak (`ManualAdjustment`, `RebalancePlan`)
// TANPA `Number()`/`parseFloat()` atas nilai uang (AD-10) — nilai uang tetap STRING.
//
// Melempar `ApiError('INVALID_INPUT', …)` (400) pada bentuk tak valid.

import type { CapitalType, MoneyString, Uuid } from '../../shared/domain/types'
import type { ManualAdjustment, RebalancePlan } from '../domain/rkap'
import { ApiError } from './http'
import { asRecord, parseUuid } from './pricing-input'

/** Pola uang berskala tetap; boleh negatif (delta rebalance). */
const MONEY_SIGNED_RE = /^-?\d+(\.\d{1,2})?$/

function bad(message: string, details?: Record<string, unknown>): never {
  throw new ApiError('INVALID_INPUT', message, 400, details)
}

/** Capital Type valid (nilai Bahasa Indonesia — bagian kontrak data). */
export function parseCapitalType(raw: unknown): CapitalType {
  if (raw === 'Modal Tetap' || raw === 'Modal Bergerak' || raw === 'Modal Operasional') {
    return raw
  }
  return bad("Parameter 'capitalType' tidak valid.", { capitalType: raw })
}

/** Nilai uang string berskala tetap (boleh negatif). */
export function parseSignedMoney(raw: unknown, field: string): MoneyString {
  if (typeof raw !== 'string' || !MONEY_SIGNED_RE.test(raw)) {
    return bad(`Parameter '${field}' harus string uang berskala tetap.`, {
      [field]: raw,
      type: typeof raw,
    })
  }
  return raw as MoneyString
}

/**
 * Merakit `ManualAdjustment` (FR-23 §23.5). Dua bentuk saling eksklusif:
 *   { capitalItemId, raiseBy }  — naikkan Final Requirement item eksisting.
 *   { newItem: { name, capitalType, finalRequirement } } — tambah item baru.
 */
export function parseManualAdjustmentBody(body: unknown): ManualAdjustment {
  const b = asRecord(body)

  if (b.newItem !== undefined) {
    const n = asRecord(b.newItem)
    if (typeof n.name !== 'string' || n.name.trim() === '') {
      bad("Parameter 'newItem.name' wajib.")
    }
    return {
      newItem: {
        name: n.name as string,
        capitalType: parseCapitalType(n.capitalType),
        finalRequirement: parseSignedMoney(n.finalRequirement, 'newItem.finalRequirement'),
      },
    }
  }

  if (b.capitalItemId !== undefined || b.raiseBy !== undefined) {
    return {
      capitalItemId: parseUuid(b.capitalItemId, 'capitalItemId'),
      raiseBy: parseSignedMoney(b.raiseBy, 'raiseBy'),
    }
  }

  return bad(
    "Body penyesuaian harus berisi { capitalItemId, raiseBy } atau { newItem }.",
  )
}

/**
 * Merakit `{ plan, momRef }` untuk rebalancing (FR-23 §23.9): kumpulan move
 * net-zero antar Capital Item sejenis, tertaut MoM.
 */
export function parseRebalanceBody(body: unknown): {
  plan: RebalancePlan
  momRef: Uuid
} {
  const b = asRecord(body)
  if (!Array.isArray(b.moves) || b.moves.length === 0) {
    bad("Parameter 'moves' harus array tidak kosong.")
  }
  const moves = (b.moves as unknown[]).map((m, i) => {
    const mv = asRecord(m)
    return {
      capitalItemId: parseUuid(mv.capitalItemId, `moves[${i}].capitalItemId`),
      delta: parseSignedMoney(mv.delta, `moves[${i}].delta`),
    }
  })
  return { plan: { moves }, momRef: parseUuid(b.momRef, 'momRef') }
}
