// shared/domain/gates.ts
//
// Perakitan input gerbang kanonik (AD-6). Fungsi murni yang diimpor identik oleh
// server route (otoritatif) DAN pulau pratinjau klien, sehingga hasil pratinjau
// selalu konsisten dengan validasi server. Tanpa I/O, tanpa framework.
//
// Momen evaluasi harga (di pemanggil): submit (pratinjau/validasi submit),
// finalisasi (re-validasi), saat aksi (penyesuaian manual).
//
// Semua aritmetika rasio melewati pembungkus `Decimal` terpin dari './decimal'
// (AD-10) — JANGAN gunakan Number()/parseFloat() atas nilai rasio.

import { Decimal } from './decimal'
import { ceilFor, shares, strength } from './weighting'
import { ruangRkap as ruangRkapLimit } from './rkap-limits'
import type { CapitalType, MoneyString } from './types'

/**
 * Input kanonik gerbang Strength (FR-1).
 * - `posisiTerkini`     : agregat Shares/Ceil efektif owner saat ini.
 * - `pesananPendingKanonik`: seluruh pesanan pending kanonik owner
 *   (status='menunggu_konfirmasi' AND withdrawn_at IS NULL) — TIDAK termasuk calon.
 * - `calon`             : pesanan yang sedang diajukan/dievaluasi.
 */
export interface StrengthGateInput {
  posisiTerkini: { totalShares: number; totalCeil: number }
  pesananPendingKanonik: Array<{ capitalType: CapitalType; quantity: number }>
  calon: { capitalType: CapitalType; quantity: number }
}

/**
 * Gerbang Strength (FR-1 §1.1–1.4, §1.7, §1.13): proyeksi Strength gabungan dari
 * posisi terkini + seluruh pesanan pending kanonik + calon harus ≤ 100% (1.0).
 *
 * `ok` benar hanya bila proyeksi Strength ≤ 1 (perbandingan presisi penuh via
 * Decimal, bukan Number()). `proyeksiStrength` adalah `RatioString` presisi
 * penyimpanan; pembulatan half-up 2 desimal hanya untuk display di lapisan UI.
 */
export function evalStrengthGate(
  input: StrengthGateInput,
): { ok: boolean; proyeksiStrength: string; proyeksiCeil: number; proyeksiShares: number } {
  let addShares = shares(input.calon.capitalType, input.calon.quantity)
  let addCeil = ceilFor(input.calon.capitalType, input.calon.quantity)
  for (const p of input.pesananPendingKanonik) {
    addShares += shares(p.capitalType, p.quantity)
    addCeil += ceilFor(p.capitalType, p.quantity)
  }
  const totalShares = input.posisiTerkini.totalShares + addShares
  const totalCeil = input.posisiTerkini.totalCeil + addCeil
  const s = strength(totalShares, totalCeil)
  return {
    ok: new Decimal(s).lte(1),
    proyeksiStrength: s,
    proyeksiCeil: totalCeil,
    proyeksiShares: totalShares,
  }
}

/**
 * Ruang RKAP (FR-23 §23.2): Σ Final Requirement − Fulfillment dari transaksi
 * EFEKTIF saja (pesanan antri tidak mereservasi ruang). Pembungkus tipis atas
 * `ruangRkap` di './rkap-limits' agar perakitan input gerbang punya satu titik
 * impor kanonik yang konsisten dengan modul batas RKAP.
 */
export function ruangRkap(
  sumFinalRequirement: MoneyString,
  fulfillmentEfektif: MoneyString,
): MoneyString {
  return ruangRkapLimit(sumFinalRequirement, fulfillmentEfektif)
}

/**
 * Helper ruang RKAP per calon: sisa ruang jenis modal masih menampung tambahan
 * Fulfillment `tambahanFulfillment` (mis. nilai pesanan calon). `ok` benar bila
 * ruang setelah tambahan tidak negatif (masih ada ruang untuk dibeli).
 */
export function evalRuangRkapGate(input: {
  sumFinalRequirement: MoneyString
  fulfillmentEfektif: MoneyString
  tambahanFulfillment: MoneyString
}): { ok: boolean; sisaRuang: MoneyString } {
  const sisaRuang = ruangRkap(input.sumFinalRequirement, input.fulfillmentEfektif)
  const ok = new Decimal(sisaRuang).gte(new Decimal(input.tambahanFulfillment))
  return { ok, sisaRuang }
}
