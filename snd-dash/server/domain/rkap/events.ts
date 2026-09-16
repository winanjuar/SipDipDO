// server/domain/rkap/events.ts
//
// Tipe input/keluaran & error domain RKAP (FR-1/FR-23). Ini adalah kontrak nilai
// yang dipakai lintas lapisan (route → service) dan diturunkan ke pintu
// `index.ts`. Aturan bisnis (validasi, audit, transaksi) ada di `rkap.service.ts`.
//
// Referensi: design.md PART A A.4 RkapModule dan Requirement 23 (FR-23):
//   §23.1  : tabel Capital Item — nama, Capital Type, Initial/Final Requirement,
//            Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held.
//   §23.2  : ruang per Capital Type = Σ Final Requirement Capital Item jenis itu
//            (ruang efektif = Σ Final Requirement − Fulfillment efektif).
//   §23.3  : penetapan fase mengunci Initial Requirement tiap Capital Item.
//   §23.13 : Quantity Left = jumlah saham yang masih dapat dibeli dari sisa ruang
//            RKAP pada harga berjalan.
//
// Semua nilai uang/rasio lintas batas adalah string berskala tetap (AD-10).

import type {
  CapitalType,
  MoneyString,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Input penetapan fase (FR-23 §23.3)
// ---------------------------------------------------------------------------

/**
 * Satu Capital Item saat penetapan fase (FR-23 §23.1/§23.3).
 *
 * Hanya `initialRequirement` yang diberikan — `finalRequirement` dikunci sama
 * dengan `initialRequirement` saat penetapan fase, lalu hanya bergerak melalui
 * penyesuaian instant/manual (FR-23 §23.4, tugas 9.2/9.3).
 * `capitalType` wajib Modal Tetap/Bergerak (Modal Operasional tidak masuk RKAP,
 * CAPITAL_RULES.inRkap = false) — divalidasi di service.
 */
export interface NewCapitalItemInput {
  name: string
  capitalType: CapitalType
  initialRequirement: MoneyString
}

/**
 * Input penetapan fase RKAP baru (FR-23 §23.3).
 *
 * - `name`            : nama/label fase.
 * - `items`           : daftar Capital Item awal (Initial Requirement dikunci).
 * - `runningPrice`    : harga beli 1 saham berjalan (opsional). Bila diberi,
 *                       batas penyesuaian fase dihitung via `batasPenyesuaianFase`
 *                       ((1% × Σ Initial Requirement) + harga; FR-23 §23.6).
 * - `budgetOverride`  : batas agregat penyesuaian eksplisit (dipakai bila
 *                       `runningPrice` tidak diberi). Bila keduanya kosong → '0.00'.
 */
export interface NewPhaseInput {
  name: string
  items: NewCapitalItemInput[]
  runningPrice?: MoneyString
  budgetOverride?: MoneyString
}

// ---------------------------------------------------------------------------
// Input penyesuaian (FR-23 §23.5/§23.7/§23.9) — tugas 9.2
// ---------------------------------------------------------------------------

/**
 * Penyesuaian manual COO (FR-23 §23.5). Dua bentuk yang saling eksklusif:
 *
 * - `{ capitalItemId, raiseBy }` : HANYA MENAIKKAN Final Requirement item
 *   eksisting sebesar `raiseBy` (≥ 0; nilai baru ≥ nilai saat ini, §23.5).
 * - `{ newItem }`                : menambahkan Capital Item BARU ke fase berjalan;
 *   `finalRequirement` awalnya menjadi konsumsi penyesuaian fase (§23.5/§23.6).
 *
 * Total konsumsi (`raiseBy` atau `newItem.finalRequirement`) menambah
 * `instantAdjustmentUsed` fase dan ditolak bila melewati batas (§23.6/§23.7).
 */
export type ManualAdjustment =
  | { capitalItemId: Uuid; raiseBy: MoneyString }
  | {
      newItem: {
        name: string
        capitalType: CapitalType
        finalRequirement: MoneyString
      }
    }

/**
 * Satu perpindahan rebalancing (FR-23 §23.9): mengubah Final Requirement satu
 * Capital Item sebesar `delta` (positif = naik, negatif = turun). Rebalancing
 * hanya sah ANTAR Capital Item ber-Capital Type sama dan net-zero (§23.9).
 */
export interface RebalanceMove {
  capitalItemId: Uuid
  /** Perubahan Final Requirement (boleh negatif; net keseluruhan harus nol). */
  delta: MoneyString
}

/**
 * Rencana rebalancing (FR-23 §23.9): kumpulan perpindahan yang menurunkan Final
 * Requirement sebagian item dan menaikkan item lain dengan total yang SAMA
 * (net-zero), seluruhnya dalam Capital Type yang SAMA, tertaut MoM (`momRef`).
 */
export interface RebalancePlan {
  moves: RebalanceMove[]
}

// ---------------------------------------------------------------------------
// Input plotting alokasi Fulfillment (FR-23 §23.10/§23.11/§23.12) — tugas 9.3
// ---------------------------------------------------------------------------

/**
 * Satu alokasi plotting Fulfillment ke sebuah Capital Item (FR-23 §23.11):
 * menambah kolom Fulfillment `capitalItemId` sebesar `amount` (≥ 0).
 */
export interface PlottingAllocation {
  capitalItemId: Uuid
  amount: MoneyString
}

/**
 * Rencana plotting alokasi Fulfillment sebuah transaksi efektif (FR-23 §23.11).
 *
 * Menyebar nilai Fulfillment transaksi ke satu atau lebih Capital Item BER-Capital
 * Type SAMA dengan menaikkan kolom Fulfillment tiap item. Bila COO tidak
 * menetapkan rencana, `defaultFifoPlot` menghasilkan rencana FIFO (Capital Item
 * tertua lebih dulu) yang mengisi tiap item hingga Final Requirement-nya (§23.12).
 *
 * Plotting ditolak (`FULFILLMENT_EXCEEDS_FINAL`) bila Fulfillment hasil suatu
 * Capital Item akan MELEBIHI Final Requirement-nya (§23.11). Gerbang Capital Type
 * menutup saat Fulfillment Rate mencapai 100% (§23.10) — tercermin dari ruang
 * Capital Type yang menjadi 0.
 */
export interface PlottingPlan {
  allocations: PlottingAllocation[]
}

// ---------------------------------------------------------------------------
// Keluaran — fase & tampilan (FR-23 §23.1/§23.13)
// ---------------------------------------------------------------------------

/** Baris fase RKAP sebagaimana dibaca dari `rkap_phases`. */
export interface RkapPhase {
  id: Uuid
  name: string
  /** Batas agregat penyesuaian instant per fase (FR-23 §23.6). */
  instantAdjustmentBudget: MoneyString
  /** Akumulasi penyesuaian yang telah terpakai. */
  instantAdjustmentUsed: MoneyString
  isActive: boolean
  momRef: Uuid | null
  createdAt: Date
}

/**
 * Satu baris tampilan Capital Item pada tabel FR-23 (§23.1) + kolom turunan.
 *
 * Kolom turunan (rasio sebagai fraksi 0..1, AD-10):
 *   fulfillmentRate = Fulfillment ÷ Final Requirement (0 bila Final Requirement 0)
 *   shortfall       = Final Requirement − Fulfillment
 *   achievement     = Utilization ÷ Fulfillment (0 bila Fulfillment 0; bisa > 1)
 *   held            = Fulfillment − Utilization
 */
export interface CapitalItemView {
  id: Uuid
  name: string
  capitalType: CapitalType
  initialRequirement: MoneyString
  finalRequirement: MoneyString
  fulfillment: MoneyString
  fulfillmentRate: RatioString
  shortfall: MoneyString
  utilization: MoneyString
  achievement: RatioString
  held: MoneyString
}

/** Agregat tabel FR-23 (Σ seluruh Capital Item fase). */
export interface RkapAggregates {
  totalInitialRequirement: MoneyString
  totalFinalRequirement: MoneyString
  totalFulfillment: MoneyString
  totalShortfall: MoneyString
  totalUtilization: MoneyString
  totalHeld: MoneyString
}

/** Ringkasan batas penyesuaian fase (FR-23 §23.6/§23.7). */
export interface AdjustmentLimitSummary {
  budget: MoneyString
  used: MoneyString
  /** Sisa kuota penyesuaian = budget − used (tak pernah negatif). */
  remaining: MoneyString
}

/**
 * Ruang & Quantity Left per Capital Type (FR-23 §23.2/§23.13).
 *
 * - `ruang`        : Σ Final Requirement − Fulfillment efektif (uang).
 * - `quantityLeft` : jumlah saham yang masih dapat dibeli pada harga berjalan;
 *                    `null` bila harga berjalan tidak tersedia (omit Quantity Left).
 */
export interface CapitalTypeSpaceView {
  ruang: MoneyString
  quantityLeft: number | null
}

/**
 * Tampilan fase RKAP lengkap (FR-23): tabel Capital Item + agregat + ringkasan
 * batas + ruang/Quantity Left per Capital Type (§23.13).
 */
export interface RkapPhaseView {
  phase: RkapPhase
  items: CapitalItemView[]
  aggregates: RkapAggregates
  limitSummary: AdjustmentLimitSummary
  /** Ruang + Quantity Left per Capital Type RKAP (Modal Tetap/Bergerak). */
  spaceByCapitalType: Record<CapitalType, CapitalTypeSpaceView>
}

// ---------------------------------------------------------------------------
// Error domain RKAP — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain RKAP yang dikenal (stabil untuk konsumen API). */
export type RkapErrorCode =
  | 'PHASE_NOT_FOUND' // fase diminta / fase aktif tidak ditemukan
  | 'NO_ITEMS' // penetapan fase tanpa Capital Item
  | 'INVALID_CAPITAL_TYPE' // Capital Type di luar Modal Tetap/Bergerak (inRkap=false)
  | 'ITEM_NOT_FOUND' // Capital Item rujukan tidak ada pada fase
  | 'INVALID_ADJUSTMENT' // penyesuaian tidak valid (mis. raiseBy < 0, item ganda)
  | 'ADJUSTMENT_EXCEEDS_LIMIT' // penyesuaian melewati batas agregat fase (§23.7)
  | 'REBALANCE_INVALID' // rebalance tidak net-zero / beda Capital Type (§23.9)
  | 'INVALID_PLOTTING' // rencana plotting tidak valid (mis. amount < 0, item ganda/beda tipe)
  | 'FULFILLMENT_EXCEEDS_FINAL' // plotting membuat Fulfillment melebihi Final Requirement (§23.11)
  | 'LEDGER_TX_NOT_FOUND' // baris ledger_transactions rujukan tidak ditemukan

/**
 * Error domain RKAP dengan `code` stabil. Route menerjemahkan `code` menjadi
 * status HTTP yang sesuai; pesan bersifat manusiawi (Bahasa Indonesia).
 */
export class RkapError extends Error {
  readonly code: RkapErrorCode

  constructor(code: RkapErrorCode, message: string) {
    super(message)
    this.name = 'RkapError'
    this.code = code
  }
}
