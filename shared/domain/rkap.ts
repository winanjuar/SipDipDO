/**
 * RKAP — kontrak murni lintas lapis (AD-6): tipe wire, input, dan fungsi
 * kalkulasi untuk RKAP (Rencana Kebutuhan Awal Pemodalan). TANPA I/O,
 * tanpa framework — dipakai bersama `server/domain/rkap/rkap.service.ts`,
 * route handler, dan halaman.
 *
 * Nilai uang (amount) sebagai string desimal — tidak pernah Number/parseFloat (AD-10).
 *
 * **Validates: Requirements 5, 9, 10, 12**
 */

import { add, subtract, multiply, divide, isZero, serializeDecimal, parseDecimal } from './money'

// ---------------------------------------------------------------------------
// Wire Types (API Contract)
// ---------------------------------------------------------------------------

/**
 * Jenis modal untuk Capital Item.
 *
 * **Validates: Requirements 5**
 */
export type CapitalType = 'tetap' | 'bergerak'

/**
 * Status fase RKAP.
 *
 * **Validates: Requirements 5**
 */
export type RkapPhaseStatus = 'berjalan' | 'arsip'

/**
 * Wire type untuk Capital Item — item kebutuhan pemodalan dalam RKAP.
 *
 * Semua nilai uang sebagai string desimal (AD-10).
 * Kolom sesuai Req-5: nama, jenis modal, Initial Requirement, Final Requirement,
 * Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held.
 *
 * **Validates: Requirements 5, 12**
 */
export interface CapitalItemWire {
  /** UUID item */
  id: string
  /** Nama item kebutuhan pemodalan */
  name: string
  /** Jenis modal: tetap atau bergerak */
  capitalType: CapitalType
  /** Nilai rupiah rencana awal — dikunci saat MRO menetapkan fase */
  initialRequirement: string
  /** Nilai rupiah setelah penyesuaian */
  finalRequirement: string
  /** Akumulasi transaksi efektif yang teralokasi ke RKAP (derived dari plotting ledger) */
  fulfillment: string
  /** Perbandingan Fulfillment terhadap Final Requirement (ratio 0-1+) */
  fulfillmentRate: string
  /** Final Requirement − Fulfillment (rupiah) */
  shortfall: string
  /** Realisasi penggunaan modal per Capital Item yang diinput COO */
  utilization: string
  /** Utilization ÷ Fulfillment — bisa > 100%, atau "—" jika Fulfillment = 0 */
  achievement: string
  /** Fulfillment − Utilization — dana terkumpul yang belum terpakai (derived) */
  held: string
}

/**
 * Ringkasan batas penyesuaian untuk fase RKAP.
 *
 * Sesuai Req-10: Card ringkasan dengan batas penyesuaian (1% + 1 saham),
 * tambahan aktual, persentase terpakai, dan Quantity_Left.
 *
 * Semua nilai uang sebagai string desimal (AD-10).
 *
 * **Validates: Requirements 9, 10**
 */
export interface RkapPhaseSummary {
  /** Total Initial Requirement fase (rupiah) */
  totalInitialRequirement: string
  /** Batas penyesuaian = (1% × total Initial) + harga beli 1 saham */
  adjustmentLimit: string
  /** Total penyesuaian yang sudah terpakai (rupiah) */
  adjustmentUsed: string
  /** Sisa batas penyesuaian = limit − used (rupiah) */
  adjustmentRemaining: string
  /** Sisa saham yang dapat dibeli dari ruang RKAP pada harga berjalan */
  quantityLeft: number
}

/**
 * Wire type untuk Fase RKAP — lengkap dengan items dan summary.
 *
 * Sesuai Req-5: fase wajib tertaut MoM, status berjalan/arsip.
 *
 * **Validates: Requirements 5, 9, 10**
 */
export interface RkapPhaseWire {
  /** UUID fase */
  id: string
  /** Nama fase RKAP */
  name: string
  /** Status fase: berjalan atau arsip */
  status: RkapPhaseStatus
  /** UUID MoM yang menjadi referensi keputusan */
  momId: string
  /** Judul MoM untuk display */
  momTitle: string
  /** Daftar Capital Item dalam fase */
  items: CapitalItemWire[]
  /** Ringkasan batas penyesuaian */
  summary: RkapPhaseSummary
}

// ---------------------------------------------------------------------------
// Input Types (API Request)
// ---------------------------------------------------------------------------

/**
 * Input untuk membuat fase RKAP baru.
 *
 * **Validates: Requirements 5, 14**
 */
export interface PhaseCreateInput {
  /** Nama fase RKAP */
  name: string
  /** UUID MoM yang menjadi referensi keputusan (wajib final) */
  momId: string
}

/**
 * Input untuk menambah Capital Item ke fase.
 *
 * Jika item baru (Req-8): Initial = 0, Final = nilai yang diinput.
 * Jika item awal (Req-5): Initial = Final = nilai yang diinput.
 *
 * **Validates: Requirements 5, 8**
 */
export interface ItemCreateInput {
  /** Nama item kebutuhan pemodalan */
  name: string
  /** Jenis modal: tetap atau bergerak */
  capitalType: CapitalType
  /**
   * Nilai rupiah kebutuhan (string desimal).
   * Untuk item awal: menjadi Initial dan Final.
   * Untuk item baru ke fase aktif: menjadi Final saja (Initial = 0).
   */
  requirement: string
}

/**
 * Input untuk menyesuaikan Final Requirement item eksisting.
 *
 * **Validates: Requirements 7, 9**
 */
export interface AdjustInput {
  /** UUID item yang akan disesuaikan */
  itemId: string
  /** Nilai Final Requirement baru (string desimal) */
  newFinalRequirement: string
}

/**
 * Input untuk rebalancing kebutuhan antar Capital Item.
 *
 * **Validates: Requirements 13, 14**
 */
export interface RebalanceInput {
  /** UUID item sumber (dikurangi) */
  fromItemId: string
  /** UUID item tujuan (ditambah) */
  toItemId: string
  /** Jumlah yang direlokasi (string desimal) */
  amount: string
  /** UUID MoM sebagai bukti keputusan MRO (wajib) */
  momId: string
}

/**
 * Input untuk mencatat Utilization per Capital Item.
 *
 * **Validates: Requirements 11**
 */
export interface UtilizationInput {
  /** UUID item */
  itemId: string
  /** Nilai realisasi penggunaan (string desimal, non-negatif) */
  utilization: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Persentase batas penyesuaian terhadap total Initial Requirement.
 * Sesuai Req-9: Adjustment Limit = (1% × total Initial_Requirement fase) + harga beli 1 saham berjalan
 */
const ADJUSTMENT_LIMIT_PERCENT = '0.01'

/**
 * Skala untuk nilai rupiah (numeric(18,2)).
 * Sesuai AD-10.
 */
const RUPIAH_SCALE = 2

/**
 * Skala untuk ratio/persentase saat penyimpanan (numeric(9,6)).
 * Sesuai AD-10.
 */
const RATIO_SCALE = 6

// ---------------------------------------------------------------------------
// Calculation Functions (AD-6)
// ---------------------------------------------------------------------------

/**
 * Hitung Adjustment Limit untuk fase RKAP.
 *
 * Formula (Req-9):
 *   Adjustment_Limit = (1% × total Initial_Requirement fase) + harga beli 1 saham berjalan
 *
 * Contoh (Req-10):
 *   - totalInitialRequirement = "250000000.00" (250 juta)
 *   - currentBuyPrice = "52000.00"
 *   - Hasil = 2.500.000 + 52.000 = 2.552.000
 *
 * **Validates: Requirements 9, 10**
 *
 * @param totalInitialRequirement - Total Initial Requirement fase (string desimal)
 * @param currentBuyPrice - Harga beli 1 saham berjalan (string desimal)
 * @returns Adjustment Limit (string desimal dengan skala 2)
 *
 * @example
 * calculateAdjustmentLimit("250000000.00", "52000.00") // "2552000.00"
 */
export function calculateAdjustmentLimit(
  totalInitialRequirement: string,
  currentBuyPrice: string,
): string {
  // 1% dari total Initial Requirement
  const onePercent = multiply(totalInitialRequirement, ADJUSTMENT_LIMIT_PERCENT)

  // Tambah harga beli 1 saham
  const limit = add(onePercent, currentBuyPrice)

  return serializeDecimal(limit, RUPIAH_SCALE)
}

/**
 * Hitung Fulfillment Rate (persentase pemenuhan terhadap Final Requirement).
 *
 * Formula:
 *   Fulfillment_Rate = Fulfillment ÷ Final_Requirement
 *
 * **Validates: Requirements 5**
 *
 * @param fulfillment - Akumulasi transaksi efektif (string desimal)
 * @param finalRequirement - Nilai kebutuhan akhir (string desimal)
 * @returns Fulfillment Rate sebagai ratio 0-1 (string desimal dengan skala 6), atau "0.000000" jika Final Requirement = 0
 *
 * @example
 * calculateFulfillmentRate("150000000.00", "200000000.00") // "0.750000"
 * calculateFulfillmentRate("0.00", "0.00") // "0.000000"
 */
export function calculateFulfillmentRate(
  fulfillment: string,
  finalRequirement: string,
): string {
  // Jika Final Requirement = 0, return 0 untuk menghindari division by zero
  if (isZero(finalRequirement)) {
    return serializeDecimal(parseDecimal('0'), RATIO_SCALE)
  }

  const rate = divide(fulfillment, finalRequirement)
  return serializeDecimal(rate, RATIO_SCALE)
}

/**
 * Hitung Achievement (Utilization ÷ Fulfillment).
 *
 * Formula (Req-12):
 *   Achievement = Utilization ÷ Fulfillment (bisa > 100%)
 *
 * Jika Fulfillment = 0, return null untuk ditampilkan sebagai "—" atau "0%".
 *
 * **Validates: Requirements 12**
 *
 * @param utilization - Realisasi penggunaan modal (string desimal)
 * @param fulfillment - Akumulasi transaksi efektif (string desimal)
 * @returns Achievement sebagai ratio (string desimal dengan skala 6), atau null jika Fulfillment = 0
 *
 * @example
 * calculateAchievement("80000000.00", "100000000.00") // "0.800000" (80%)
 * calculateAchievement("120000000.00", "100000000.00") // "1.200000" (120%)
 * calculateAchievement("50000000.00", "0.00") // null (ditampilkan sebagai "—")
 */
export function calculateAchievement(
  utilization: string,
  fulfillment: string,
): string | null {
  // Jika Fulfillment = 0, Achievement tidak terdefinisi (Req-12)
  if (isZero(fulfillment)) {
    return null
  }

  const achievement = divide(utilization, fulfillment)
  return serializeDecimal(achievement, RATIO_SCALE)
}

/**
 * Hitung Held (dana terkumpul yang belum terpakai).
 *
 * Formula (Req-12):
 *   Held = Fulfillment − Utilization
 *
 * Nilai Held adalah derived, bukan kolom tersimpan.
 *
 * **Validates: Requirements 12**
 *
 * @param fulfillment - Akumulasi transaksi efektif (string desimal)
 * @param utilization - Realisasi penggunaan modal (string desimal)
 * @returns Held sebagai nilai rupiah (string desimal dengan skala 2)
 *
 * @example
 * calculateHeld("100000000.00", "80000000.00") // "20000000.00"
 * calculateHeld("80000000.00", "100000000.00") // "-20000000.00" (over-utilized)
 */
export function calculateHeld(
  fulfillment: string,
  utilization: string,
): string {
  const held = subtract(fulfillment, utilization)
  return serializeDecimal(held, RUPIAH_SCALE)
}

/**
 * Hitung Shortfall (kekurangan dari Final Requirement).
 *
 * Formula:
 *   Shortfall = Final_Requirement − Fulfillment
 *
 * **Validates: Requirements 5**
 *
 * @param finalRequirement - Nilai kebutuhan akhir (string desimal)
 * @param fulfillment - Akumulasi transaksi efektif (string desimal)
 * @returns Shortfall sebagai nilai rupiah (string desimal dengan skala 2)
 *
 * @example
 * calculateShortfall("200000000.00", "150000000.00") // "50000000.00"
 * calculateShortfall("100000000.00", "120000000.00") // "-20000000.00" (over-fulfilled)
 */
export function calculateShortfall(
  finalRequirement: string,
  fulfillment: string,
): string {
  const shortfall = subtract(finalRequirement, fulfillment)
  return serializeDecimal(shortfall, RUPIAH_SCALE)
}

/**
 * Hitung Quantity Left (sisa saham yang dapat dibeli dari ruang RKAP).
 *
 * Formula:
 *   Quantity_Left = floor(Shortfall ÷ currentBuyPrice)
 *
 * Jika Shortfall <= 0 atau currentBuyPrice = 0, return 0.
 *
 * **Validates: Requirements 10**
 *
 * @param shortfall - Kekurangan dari Final Requirement (string desimal)
 * @param currentBuyPrice - Harga beli 1 saham berjalan (string desimal)
 * @returns Jumlah saham yang masih bisa dibeli (bilangan bulat non-negatif)
 *
 * @example
 * calculateQuantityLeft("5200000.00", "52000.00") // 100
 * calculateQuantityLeft("51000.00", "52000.00") // 0 (tidak cukup untuk 1 saham)
 */
export function calculateQuantityLeft(
  shortfall: string,
  currentBuyPrice: string,
): number {
  // Jika harga beli = 0, tidak bisa menghitung quantity
  if (isZero(currentBuyPrice)) {
    return 0
  }

  const shortfallDecimal = parseDecimal(shortfall)

  // Jika shortfall <= 0, tidak ada ruang untuk beli
  if (shortfallDecimal.isNegative() || shortfallDecimal.isZero()) {
    return 0
  }

  const quantity = divide(shortfall, currentBuyPrice)
  // Floor untuk mendapat bilangan bulat (tidak bisa beli pecahan saham)
  return quantity.floor().toNumber()
}

/**
 * Hitung sisa batas penyesuaian.
 *
 * Formula:
 *   Adjustment_Remaining = Adjustment_Limit − Adjustment_Used
 *
 * **Validates: Requirements 9, 10**
 *
 * @param adjustmentLimit - Batas penyesuaian fase (string desimal)
 * @param adjustmentUsed - Total penyesuaian yang sudah terpakai (string desimal)
 * @returns Sisa batas penyesuaian (string desimal dengan skala 2)
 *
 * @example
 * calculateAdjustmentRemaining("2552000.00", "2484000.00") // "68000.00"
 */
export function calculateAdjustmentRemaining(
  adjustmentLimit: string,
  adjustmentUsed: string,
): string {
  const remaining = subtract(adjustmentLimit, adjustmentUsed)
  return serializeDecimal(remaining, RUPIAH_SCALE)
}

/**
 * Hitung persentase batas penyesuaian yang sudah terpakai.
 *
 * Formula:
 *   Adjustment_Used_Percent = (Adjustment_Used ÷ Adjustment_Limit) × 100
 *
 * **Validates: Requirements 10**
 *
 * @param adjustmentUsed - Total penyesuaian yang sudah terpakai (string desimal)
 * @param adjustmentLimit - Batas penyesuaian fase (string desimal)
 * @returns Persentase terpakai sebagai ratio 0-1+ (string desimal dengan skala 6), atau "0.000000" jika limit = 0
 *
 * @example
 * calculateAdjustmentUsedRatio("2484000.00", "2552000.00") // "0.973354" (~97.34%)
 */
export function calculateAdjustmentUsedRatio(
  adjustmentUsed: string,
  adjustmentLimit: string,
): string {
  if (isZero(adjustmentLimit)) {
    return serializeDecimal(parseDecimal('0'), RATIO_SCALE)
  }

  const ratio = divide(adjustmentUsed, adjustmentLimit)
  return serializeDecimal(ratio, RATIO_SCALE)
}
