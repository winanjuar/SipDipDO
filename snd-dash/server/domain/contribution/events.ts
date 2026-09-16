// server/domain/contribution/events.ts
//
// Tipe input, tampilan (view), dan error domain contribution (FR-8/FR-9).
// Ini adalah kontrak nilai yang dipakai lintas lapisan (route → service) dan
// diturunkan pula ke pintu `index.ts`. Aturan bisnis (validasi, audit,
// transaksi) ada di `contribution.service.ts`.
//
// Referensi: design.md PART A A.4 ContributionModule dan Requirement 8/9
// (FR-8/FR-9).

import type { JakartaDate, Uuid } from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Definisi item Contribution (FR-8)
// ---------------------------------------------------------------------------

/**
 * Input definisi satu item Contribution (FR-8 §8.1/§8.2).
 *
 * - `name`        : nama item Contribution (wajib).
 * - `description` : deskripsi item (opsional).
 * - `points`      : poin kuantitatif — bilangan bulat (integer).
 * - `periodId`    : periode berlaku item (opsional; tautan ke
 *                   `contribution_periods`).
 *
 * Tautan MoM penetap diberikan terpisah sebagai `momRef` pada `defineItem`
 * (mengikuti tanda tangan A.4), bukan bagian dari input ini.
 */
export interface ContributionItemInput {
  name: string
  description?: string | null
  points: number
  periodId?: Uuid | null
}

// ---------------------------------------------------------------------------
// Pencatatan realisasi Contribution (FR-9)
// ---------------------------------------------------------------------------

/**
 * Input pencatatan realisasi Contribution seorang Owner (FR-9 §9.1).
 *
 * - `ownerId`      : Owner penerima realisasi Contribution.
 * - `itemId`       : item Contribution yang telah didefinisikan.
 * - `recordedDate` : tanggal pencatatan ('YYYY-MM-DD', zona Jakarta, AD-9).
 * - `periodId`     : periode target (opsional; bila kosong, dipakai periode
 *                    aktif belum-final atau periode item).
 * - `points`       : poin realisasi (opsional; bila kosong, memakai poin item).
 *
 * Identitas pencatat (`recordedBy`) diambil dari `cooId` pemanggil pada
 * `recordRealization` (FR-9 §9.1), bukan bagian dari input ini.
 */
export interface RealizationInput {
  ownerId: Uuid
  itemId: Uuid
  recordedDate: JakartaDate
  periodId?: Uuid | null
  points?: number
}

// ---------------------------------------------------------------------------
// Tipe domain baca (item & entry) — bentuk yang dikembalikan service/pintu
// ---------------------------------------------------------------------------

/** Item Contribution sebagaimana dibaca dari `contribution_items` (FR-8). */
export interface ContributionItem {
  id: Uuid
  name: string
  description: string | null
  /** Poin kuantitatif (integer). */
  points: number
  periodId: Uuid | null
  /** Tautan MoM penetapan (FR-8 §8.1). */
  momRef: Uuid | null
  createdAt: Date
}

/** Entri realisasi Contribution dari `contribution_entries` (FR-9). */
export interface ContributionEntry {
  id: Uuid
  ownerId: Uuid
  itemId: Uuid
  periodId: Uuid
  /** Poin realisasi (integer). */
  points: number
  /** Identitas pencatat (FR-9 §9.1). */
  recordedBy: Uuid
  /** Tanggal pencatatan ('YYYY-MM-DD', zona Jakarta). */
  recordedDate: JakartaDate
  /** Sudah diberi insentif pada cut-off (FR-10). */
  redeemed: boolean
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Tampilan poin berjalan (FR-9 §9.2/§9.3)
// ---------------------------------------------------------------------------

/**
 * Tampilan poin Contribution berjalan seorang Owner (FR-9 §9.2/§9.3).
 *
 * Poin berjalan = seluruh poin realisasi yang BELUM diberi insentif
 * (`redeemed = false`). Karena poin yang di-carry over dari periode sebelumnya
 * juga tetap `redeemed = false`, `totalRunning` mencakup poin periode berjalan
 * plus saldo carry-over.
 *
 * - `currentPeriodPoints` : poin belum-diberi-insentif pada periode aktif
 *                           (belum final). 0 bila tak ada periode aktif.
 * - `carryOverPoints`     : poin belum-diberi-insentif dari periode lain
 *                           (terbawa dari periode sebelumnya, FR-10 §10.5).
 * - `totalRunning`        : total poin berjalan = currentPeriodPoints +
 *                           carryOverPoints (seluruh entri `redeemed = false`).
 */
export interface PointsView {
  ownerId: Uuid
  currentPeriodPoints: number
  carryOverPoints: number
  totalRunning: number
}

// ---------------------------------------------------------------------------
// Cut-off Contribution Period (FR-10) — snapshot beku imutabel + carry-over
// ---------------------------------------------------------------------------

/**
 * Poin per Owner (basis Insentif, AD-10). Dipakai `finalizedUnredeemedPoints`
 * sebagai kontrak kanonik poin periode terfinalkan yang belum ditunaikan
 * (`redeemed = false`), yang menjadi basis distribusi Insentif (FR-16 §16.7).
 *
 * - `ownerId` : Owner pemilik poin.
 * - `points`  : Σ poin realisasi (integer) — hanya Owner dengan total > 0.
 */
export interface OwnerPoints {
  ownerId: Uuid
  points: number
}

/**
 * Rekap hasil cut-off Contribution Period (FR-10 §10.3). MEMISAHKAN dengan
 * tegas poin yang difinalkan sebagai dasar Insentif dari poin yang di-carry
 * over ke periode berikutnya.
 *
 * - `finalizedPeriodId` : periode yang baru saja difinalkan (snapshot beku).
 * - `cutOffDate`        : tanggal cut-off ('YYYY-MM-DD', zona Jakarta, AD-9).
 * - `finalizedAt`       : waktu efektif finalisasi (timestamptz).
 * - `newPeriodId`       : periode aktif baru yang dibuka untuk carry-over
 *                         (FR-10 §10.2/§10.5).
 * - `finalizedPoints`   : poin per Owner yang DIFINALKAN sebagai dasar Insentif
 *                         (§10.1) — entri memenuhi syarat pada periode ini.
 * - `carryOverPoints`   : poin per Owner yang DI-CARRY OVER (belum diberi
 *                         insentif, `redeemed = false`) ke periode baru (§10.2).
 * - `totalFinalized`    : Σ seluruh `finalizedPoints.points`.
 * - `totalCarriedOver`  : Σ seluruh `carryOverPoints.points`.
 */
export interface CutOffRecap {
  finalizedPeriodId: Uuid
  cutOffDate: JakartaDate
  finalizedAt: Date
  newPeriodId: Uuid
  finalizedPoints: OwnerPoints[]
  carryOverPoints: OwnerPoints[]
  totalFinalized: number
  totalCarriedOver: number
}

// ---------------------------------------------------------------------------
// Error domain contribution — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain contribution yang dikenal (stabil untuk konsumen API). */
export type ContributionErrorCode =
  | 'PERIOD_FINALIZED' // periode target sudah final — pencatatan ditolak (FR-9/FR-10)
  | 'PERIOD_NOT_FOUND' // periode target tidak ditemukan / tak ada periode aktif
  | 'ITEM_NOT_FOUND' // item Contribution referensi tidak ditemukan
  | 'MOM_NOT_FOUND' // MoM penetap tidak ditemukan (FR-8 §8.1)
  | 'ITEM_NAME_REQUIRED' // definisi item tanpa nama
  | 'INVALID_POINTS' // poin bukan bilangan bulat non-negatif
  | 'NO_ACTIVE_PERIOD' // tak ada periode Contribution aktif untuk di-cut-off (FR-10)
  | 'PERIOD_ALREADY_FINALIZED' // periode aktif sudah final — cut-off tak dapat diulang (FR-10 imutabel)

/**
 * Error domain contribution dengan `code` stabil. Route menerjemahkan `code`
 * menjadi status HTTP yang sesuai; pesan bersifat manusiawi (Bahasa Indonesia).
 */
export class ContributionError extends Error {
  readonly code: ContributionErrorCode

  constructor(code: ContributionErrorCode, message: string) {
    super(message)
    this.name = 'ContributionError'
    this.code = code
  }
}
