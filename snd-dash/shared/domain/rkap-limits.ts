// shared/domain/rkap-limits.ts
//
// Batas & max-quantity RKAP (FR-1 / FR-23). Seluruh aritmetika uang memakai
// pembungkus `Decimal` terpin dari './decimal' (AD-10) — JANGAN gunakan
// Number()/parseFloat() atas nilai uang. Nilai uang lintas batas selalu string
// berskala tetap (`MoneyString`).

import { Decimal, toMoney } from './decimal'
import type { MoneyString } from './types'

/**
 * Quantity maksimal Modal Tetap/Bergerak (FR-1 §1.10/1.11, FR-23 §23.6/23.8).
 *
 * Aturan:
 * - Bila sisa ruang RKAP jenis modal ≤ 0 → 0 (tidak ada ruang untuk dibeli).
 * - Bila overshoot pembulatan ke atas untuk 1 saham berikutnya masih tertampung
 *   sisa batas penyesuaian fase → `ceil(sisa ruang ÷ harga)` (pembulatan ke atas).
 * - Bila sisa batas penyesuaian tidak menampung overshoot → `floor(sisa ruang ÷ harga)`
 *   (Quantity Left fase, pembulatan ke bawah — batas penyesuaian habis).
 *
 * `overshoot = ceilQty × harga − sisaRuang` selalu < harga 1 saham.
 */
export function maxQuantityRkap(
  sisaRuang: MoneyString,
  harga: MoneyString,
  sisaBatasPenyesuaian: MoneyString,
): number {
  const ruang = new Decimal(sisaRuang)
  const h = new Decimal(harga)
  // §1.10: sisa ruang RKAP ≤ 0 → Quantity maksimal = 0.
  if (ruang.lte(0)) return 0
  const ceilQty = ruang.div(h).ceil() // pembulatan ke atas
  const overshoot = ceilQty.mul(h).minus(ruang) // selalu < harga 1 saham
  if (overshoot.lte(new Decimal(sisaBatasPenyesuaian))) return ceilQty.toNumber()
  return ruang.div(h).floor().toNumber() // batas habis → Quantity Left (bulat ke bawah)
}

/**
 * Batas penyesuaian agregat per fase (FR-23 §23.6):
 * (1% × total Initial Requirement fase) + harga beli 1 saham berjalan.
 */
export function batasPenyesuaianFase(
  totalInitialRequirement: MoneyString,
  harga1Saham: MoneyString,
): MoneyString {
  return toMoney(
    new Decimal(totalInitialRequirement).mul('0.01').plus(new Decimal(harga1Saham)),
  )
}

/**
 * Ruang RKAP (FR-23 §23.2): Σ Final Requirement − Fulfillment dari transaksi
 * EFEKTIF saja. Pesanan yang masih antri (menunggu konfirmasi) TIDAK mereservasi
 * ruang, sehingga `fulfillmentEfektif` hanya mencakup transaksi yang telah efektif.
 */
export function ruangRkap(
  sumFinalRequirement: MoneyString,
  fulfillmentEfektif: MoneyString,
): MoneyString {
  return toMoney(new Decimal(sumFinalRequirement).minus(new Decimal(fulfillmentEfektif)))
}
