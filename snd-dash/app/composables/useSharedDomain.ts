// app/composables/useSharedDomain.ts
//
// Pintu impor tunggal rumus domain murni untuk lapisan UI (AD-6). Composable ini
// TIDAK mengimplementasikan aritmetika apa pun — ia HANYA mengekspor ulang fungsi
// murni dari `#shared/domain` (jalur kode yang SAMA dengan validasi server) agar
// pratinjau klien dan validasi server tidak pernah berbeda hasil.
//
// Aturan (AD-10): JANGAN pernah memakai `Number()` / `parseFloat()` atas nilai
// uang/rasio. Gunakan pembungkus `Decimal` + helper display dari `#shared/domain/decimal`.

import { evalStrengthGate, evalRuangRkapGate } from '#shared/domain/gates'
import type { StrengthGateInput } from '#shared/domain/gates'
import { shares, ceilFor, strength, portion, rtl } from '#shared/domain/weighting'
import {
  Decimal,
  displayMoney,
  displayRatio,
  toMoney,
  toRatio,
} from '#shared/domain/decimal'
import { CAPITAL_RULES } from '#shared/domain/types'
import type {
  CapitalType,
  MoneyString,
  RatioString,
} from '#shared/domain/types'

export type { StrengthGateInput, CapitalType, MoneyString, RatioString }

/**
 * Persen tampilan half-up 2 desimal dari sebuah `RatioString` (fraksi 0..1).
 * Contoh: '0.666667' → '66.67'. Konversi ke persen (×100) dilakukan lewat
 * `Decimal` (bukan Number()) agar konsisten dengan aturan presisi.
 *
 * Mengembalikan STRING angka persen tanpa tanda '%' (lapisan presentasi yang
 * menambahkan simbol) — presisi 2 angka di belakang koma (§1.1/§1.2).
 */
export function displayStrengthPercent(value: RatioString | Decimal | string): string {
  return new Decimal(value).mul(100).toFixed(2, Decimal.ROUND_HALF_UP)
}

/**
 * Composable akses rumus domain bersama (AD-6). Semua yang dikembalikan adalah
 * referensi ke fungsi murni `#shared/domain` — sama persis dengan yang diimpor
 * server. Tidak ada state, tidak ada I/O.
 */
export function useSharedDomain() {
  return {
    // Gerbang kanonik — identik dengan validasi server (AD-6).
    evalStrengthGate,
    evalRuangRkapGate,
    // Rumus pembobotan murni.
    shares,
    ceilFor,
    strength,
    portion,
    rtl,
    // Aturan per jenis modal (plafon/bobot/inRkap).
    CAPITAL_RULES,
    // Pembungkus decimal + helper display (half-up 2 desimal).
    Decimal,
    toMoney,
    toRatio,
    displayMoney,
    displayRatio,
    displayStrengthPercent,
  }
}
