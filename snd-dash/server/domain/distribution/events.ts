// server/domain/distribution/events.ts
//
// Tipe input/keluaran & error domain DISTRIBUTION (FR-16). Kontrak nilai yang
// dipakai lintas lapisan (route → service) dan diturunkan ke pintu `index.ts`.
// Aturan bisnis (simulasi murni, penyimpanan rekap in-tx, perbandingan) ada di
// `distribution.service.ts`.
//
// Referensi: design.md PART A A.4 DistributionModule dan Requirement 16 (FR-16):
//   §16.1  : Laba Dibagikan = laba diaudit − laba ditahan.
//   §16.2  : tiga budget pool = ratio komponen × Laba Dibagikan.
//   §16.3  : ratio komponen (Charity, Dividen, Insentif) parameter RUPS.
//   §16.4  : Dividen Owner = Portion × pool Dividen.
//   §16.5  : Insentif Owner = (poin Owner ÷ total poin) × pool Insentif.
//   §16.6  : pool Charity dialokasikan UTUH sebagai komponen di luar bagian Owner.
//   §16.7  : basis poin Insentif = poin periode yang telah difinalkan cut-off.
//   §16.8  : Owner tanpa saham yang Insentif-nya ditunaikan → status Keluar.
//   §16.9  : rekap memuat laba diaudit/ditahan/Dibagikan, 3 pool, rincian per Owner.
//   §16.11 : keterbukaan rekap (Owner pemegang saham; tanpa saham selama masih
//            punya poin belum ditunaikan) — ditegakkan di lapisan route.
//
// Semua nilai uang/rasio lintas batas adalah string berskala tetap (AD-10).

import type { MoneyString, RatioString, Uuid } from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Input rekap distribusi (FR-16 §16.1/§16.3) — dipakai simulate & saveRecap
// ---------------------------------------------------------------------------

/**
 * Satu Owner dalam input distribusi (FR-16 §16.4/§16.5).
 *
 * - `ownerId`  : identitas Owner.
 * - `portion`  : Portion Owner saat rekap (fraksi 0..1) — basis Dividen (§16.4).
 * - `points`   : poin Contribution yang telah difinalkan cut-off & belum
 *                ditunaikan — basis Insentif (§16.5/§16.7).
 */
export interface OwnerDistributionInput {
  ownerId: Uuid
  portion: RatioString
  points: number
}

/**
 * Input rekap distribusi laba RUPS (FR-16 §16.1/§16.3). Untuk `simulate` bersifat
 * MURNI (data Owner disuplai langsung agar dapat dihitung tanpa DB); `saveRecap`
 * juga menerima bentuk ini namun merakit posisi/poin dari ledger/contribution
 * bila `owners` tidak disuplai (lihat `assembleInput`).
 *
 * - `auditedProfit`  : laba diaudit (uang).
 * - `retainedProfit` : laba ditahan (uang).
 * - `charityRatio`   : ratio Charity (fraksi 0..1).
 * - `dividendRatio`  : ratio Dividen (fraksi 0..1).
 * - `incentiveRatio` : ratio Insentif (fraksi 0..1).
 * - `owners`         : rincian per Owner (Portion + poin).
 * - `momRef`         : referensi MoM RUPS (opsional).
 */
export interface DistributionInput {
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  owners: OwnerDistributionInput[]
  momRef?: Uuid | null
}

// ---------------------------------------------------------------------------
// Keluaran rekap (FR-16 §16.9) — hasil simulate & snapshot tersimpan
// ---------------------------------------------------------------------------

/**
 * Rincian hak per Owner dalam rekap (FR-16 §16.4/§16.5/§16.9).
 *
 * - `dividend`  : Dividen Owner = Portion × pool Dividen (§16.4).
 * - `incentive` : Insentif Owner = (poin ÷ total poin) × pool Insentif (§16.5).
 * - `total`     : total hak = Dividen + Insentif.
 */
export interface OwnerRecapLine {
  ownerId: Uuid
  portion: RatioString
  points: number
  dividend: MoneyString
  incentive: MoneyString
  total: MoneyString
}

/**
 * Rekap distribusi laba lengkap (FR-16 §16.9). Struktur murni-baca yang
 * dihasilkan `simulate` (tanpa persist) dan tercermin pada snapshot tersimpan
 * (`ProfitDistribution`). Memuat laba diaudit/ditahan/Dibagikan, tiga budget
 * pool, dan rincian per Owner (Dividen + Insentif + total).
 */
export interface DistributionRecap {
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  /** Laba Dibagikan = laba diaudit − laba ditahan (§16.1). */
  distributableProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  /** pool Charity = ratio Charity × Laba Dibagikan — dialokasikan UTUH (§16.6). */
  charityPool: MoneyString
  dividendPool: MoneyString
  incentivePool: MoneyString
  /** Total poin Insentif seluruh Owner (basis pro-rata §16.5). */
  totalPoints: number
  lines: OwnerRecapLine[]
}

// ---------------------------------------------------------------------------
// Entitas snapshot tersimpan (FR-16 §16.9) — profit_distributions + lines
// ---------------------------------------------------------------------------

/**
 * Snapshot imutabel rekap distribusi yang tersimpan (FR-16 §16.9). Cerminan satu
 * baris `profit_distributions` beserta `profit_distribution_lines` turunannya.
 */
export interface ProfitDistribution {
  id: Uuid
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  distributableProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  charityPool: MoneyString
  dividendPool: MoneyString
  incentivePool: MoneyString
  totalPoints: number
  lines: OwnerRecapLine[]
  momRef: Uuid | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Perbandingan rekap (compareToPrevious) — pembacaan murni
// ---------------------------------------------------------------------------

/** Delta satu pool antara rekap terkini dan sebelumnya. */
export interface PoolDelta {
  current: MoneyString
  previous: MoneyString
  delta: MoneyString
}

/**
 * Delta per Owner antara dua rekap (dividen/insentif/total). Bila Owner hanya
 * hadir di salah satu rekap, sisi yang absen dihitung sebagai 0.
 */
export interface OwnerRecapDelta {
  ownerId: Uuid
  dividend: PoolDelta
  incentive: PoolDelta
  total: PoolDelta
}

/**
 * Hasil `compareToPrevious` (read-only): membandingkan satu rekap tersimpan
 * dengan rekap SEBELUMNYA (berdasar `createdAt`). Bila tidak ada rekap
 * sebelumnya, `previousId` = null dan seluruh delta dihitung terhadap 0.
 */
export interface RecapComparison {
  currentId: Uuid
  previousId: Uuid | null
  charity: PoolDelta
  dividend: PoolDelta
  incentive: PoolDelta
  distributable: PoolDelta
  owners: OwnerRecapDelta[]
}

// ---------------------------------------------------------------------------
// Error domain DISTRIBUTION — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain distribusi yang dikenal (stabil untuk konsumen API). */
export type DistributionErrorCode =
  | 'RECAP_NOT_FOUND' // rekap rujukan (compareToPrevious) tidak ditemukan
  | 'INVALID_RATIOS' // ratio komponen di luar [0..1] atau total > 1 (§16.3)
  | 'INVALID_PROFIT' // Laba Dibagikan negatif (laba ditahan > laba diaudit)

/**
 * Error domain distribusi dengan `code` stabil. Route menerjemahkan `code`
 * menjadi status HTTP yang sesuai; pesan bersifat manusiawi (Bahasa Indonesia).
 */
export class DistributionError extends Error {
  readonly code: DistributionErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: DistributionErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DistributionError'
    this.code = code
    this.details = details
  }
}
