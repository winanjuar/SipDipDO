// shared/domain/decimal.ts
//
// Satu mekanisme decimal terpin untuk seluruh aritmetika uang/rasio (AD-10).
// Aturan: JANGAN pernah memakai `Number()` / `parseFloat()` atas nilai uang/rasio.
// Semua konversi keluar melewati `toMoney` / `toRatio` (produsen string berskala
// tetap) atau helper display half-up di bawah. Impor `Decimal` dari modul ini saja,
// bukan langsung dari 'decimal.js', agar konfigurasi presisi/pembulatan konsisten.

import Decimal from 'decimal.js'
import type { MoneyString, RatioString } from './types'

// Konfigurasi global terpin: presisi tinggi untuk perhitungan antara, pembulatan
// default HALF_UP (≥5 dibulatkan ke atas) sesuai NFR §4.8.
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
})

export { Decimal }

/** Skala penyimpanan (DB) berskala tetap. */
export const MONEY_SCALE = 2 // numeric(18,2)
export const RATIO_SCALE = 6 // numeric(9,6)
/** Skala tampilan half-up 2 desimal (uang & rasio). */
export const DISPLAY_SCALE = 2

/**
 * Konversi nilai ke `MoneyString` berskala tetap `numeric(18,2)` (half-up).
 * Menerima Decimal, string desimal, atau integer (Quantity/Shares/Ceil).
 */
export function toMoney(value: Decimal | string | number): MoneyString {
  return new Decimal(value)
    .toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP) as MoneyString
}

/**
 * Konversi nilai ke `RatioString` presisi penyimpanan `numeric(9,6)`.
 * Presisi penuh dipertahankan hingga skala DB; pembulatan half-up ke 2 desimal
 * hanya dilakukan saat DISPLAY via `displayRatio`.
 */
export function toRatio(value: Decimal | string | number): RatioString {
  return new Decimal(value)
    .toFixed(RATIO_SCALE, Decimal.ROUND_HALF_UP) as RatioString
}

/**
 * Representasi tampilan half-up 2 desimal untuk nilai uang.
 * Contoh: '1234.5' → '1234.50'.
 */
export function displayMoney(value: MoneyString | Decimal | string): string {
  return new Decimal(value).toFixed(DISPLAY_SCALE, Decimal.ROUND_HALF_UP)
}

/**
 * Representasi tampilan half-up 2 desimal untuk rasio (mis. Strength/Portion).
 * Nilai rasio disimpan sebagai fraksi (0..1); ditampilkan apa adanya setelah
 * half-up (boleh menghasilkan total 99,99% / 100,01% untuk Portion — Property 2).
 * Mengembalikan string fraksi ber-skala 2 (mis. '0.67'); konversi ke persen
 * dilakukan di lapisan presentasi.
 */
export function displayRatio(value: RatioString | Decimal | string): string {
  return new Decimal(value).toFixed(DISPLAY_SCALE, Decimal.ROUND_HALF_UP)
}
