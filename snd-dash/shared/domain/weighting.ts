// shared/domain/weighting.ts
//
// Rumus murni pembobotan kepemilikan (AD-6). Tanpa I/O, tanpa framework.
// Digunakan identik oleh pratinjau klien dan validasi server.
// Semua aritmetika uang/rasio melewati pembungkus decimal terpin di './decimal'.

import { Decimal, toRatio } from './decimal'
import { CAPITAL_RULES } from './types'
import type { CapitalType, RatioString } from './types'

/** Shares = Quantity × bobot jenis modal. */
export function shares(capitalType: CapitalType, quantity: number): number {
  return quantity * CAPITAL_RULES[capitalType].bobot
}

/** Ceil = Quantity × plafon jenis modal. */
export function ceilFor(capitalType: CapitalType, quantity: number): number {
  return quantity * CAPITAL_RULES[capitalType].plafon
}

/** Strength = Σ Shares owner ÷ Σ Ceil owner (gabungan semua jenis modal). */
export function strength(totalShares: number, totalCeil: number): RatioString {
  if (totalCeil === 0) return toRatio(new Decimal(0))
  return toRatio(new Decimal(totalShares).div(totalCeil)) // presisi penuh; half-up 2 desimal saat display
}

/** Portion = Σ Shares owner ÷ Σ Shares seluruh owner. */
export function portion(ownerShares: number, grandTotalShares: number): RatioString {
  if (grandTotalShares === 0) return toRatio(new Decimal(0))
  return toRatio(new Decimal(ownerShares).div(grandTotalShares))
}

/** RTL = Floor((Ceil − Shares) ÷ 2) — batas beli Modal Operasional per owner (FR-4). */
export function rtl(totalCeil: number, totalShares: number): number {
  return Math.floor((totalCeil - totalShares) / 2)
}
