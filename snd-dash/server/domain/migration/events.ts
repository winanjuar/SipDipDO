// server/domain/migration/events.ts
//
// Tipe kontrak nilai & error domain migrasi (FR-14). Berisi:
//   - MigrationSource : bentuk masukan migrasi — kumpulan Owner (rekap
//                       kepemilikan + Profile Google Form) + transaksi historis
//                       (termasuk sheet Evidence) dari Google Sheets/Form.
//   - MigrationReport : keluaran `MigrationModule.run` — jumlah Owner/transaksi
//                       terimpor + Grand Total (Quantity/Shares/Ceil) hasil
//                       migrasi (basis pencocokan rekap spreadsheet, §14.3).
//   - MigrationError  : error domain migrasi dengan kode stabil.
//
// Orkestrasi (upsert Owner/Profile + import ledger + audit) ada di
// `migration.service.ts`. Referensi: design.md A.4 MigrationModule + Requirement
// 14 (FR-14 §14.1/§14.2/§14.4).

import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Masukan migrasi (MigrationSource) — Owner + Profile + transaksi historis
// ---------------------------------------------------------------------------

/**
 * Data pendaftaran historis dari Google Form yang dimigrasikan sebagai Profile
 * Owner/Calon Owner (FR-14 §14.2). `data` adalah payload fleksibel (JSONB) yang
 * memuat field pendaftaran (Lampiran A); kontak WA/email dipisah untuk
 * kemudahan notifikasi.
 */
export interface MigrationProfile {
  /** Payload field pendaftaran Google Form (JSONB fleksibel). */
  data?: Record<string, unknown>
  isComplete?: boolean
  waContact?: string | null
  emailContact?: string | null
}

/**
 * Satu transaksi historis milik seorang Owner (Google Sheets, termasuk sheet
 * Evidence) — FR-14 §14.1. Owner dirujuk lewat `ownerKey` (kunci sumber, mis.
 * email) yang di-resolve ke `owners.id` saat migrasi. Nilai harga/dana
 * di-snapshot apa adanya (AD-7); `finalPriceRef` WAJIB (FK NOT NULL
 * price_periods) — sumber migrasi diharapkan menyemai price period historis.
 */
export interface MigrationTransaction {
  /** Kunci Owner sumber (mis. email) — di-resolve ke owners.id saat migrasi. */
  ownerKey: string
  capitalType: CapitalType
  /** Quantity historis (integer). Shares/Ceil diturunkan via weighting. */
  quantity: number
  finalPrice: MoneyString
  finalPriceRef: Uuid
  actualAmount: MoneyString
  paymentDate: JakartaDate
  /** Metode pembayaran; 'migrasi' bila tak diketahui. */
  paymentMethod?: string
  /** Plotting Capital Item bila diketahui — opsional. */
  capitalItemId?: Uuid | null
  /** Waktu efektif historis (UTC); bila kosong → tanggal pembayaran/now DB. */
  effectiveAt?: Date
}

/**
 * Rekam Owner historis (rekap kepemilikan Google Sheets + Profile Google Form)
 * — FR-14 §14.1/§14.2. `ownerKey` adalah kunci sumber yang menautkan Owner ini
 * dengan transaksi-transaksinya (`MigrationTransaction.ownerKey`). Owner
 * historis di-upsert sebagai pemegang saham eksisting (status 'terverifikasi'),
 * `firstEffectiveAt` di-set dari transaksi historis paling awal.
 */
export interface MigrationOwner {
  /** Kunci Owner sumber (mis. email) — penaut ke transaksi. */
  ownerKey: string
  /** Email (pencocokan Google OAuth, AD-7) — wajib & unik. */
  email: string
  name?: string | null
  profile?: MigrationProfile
}

/**
 * Bentuk masukan migrasi (FR-14). Kumpulan Owner historis + Profile-nya, dan
 * transaksi historis (termasuk sheet Evidence). Struktur ini sengaja eksplisit
 * agar mudah dibangun oleh integration test (task 16.2) maupun adaptor sumber
 * (Google Sheets/Form → MigrationSource).
 */
export interface MigrationSource {
  owners: MigrationOwner[]
  transactions: MigrationTransaction[]
}

// ---------------------------------------------------------------------------
// Laporan migrasi (MigrationReport)
// ---------------------------------------------------------------------------

/**
 * Grand Total hasil migrasi (basis pencocokan rekap spreadsheet, FR-14 §14.3).
 * Quantity/Shares/Ceil adalah integer gabungan seluruh Owner terimpor.
 */
export interface MigrationGrandTotal {
  quantity: number
  shares: number
  ceil: number
}

/**
 * Laporan hasil `MigrationModule.run` (FR-14). `grandTotal` harus cocok dengan
 * rekap spreadsheet sumber (§14.3 — mis. Quantity 3.622, Shares 5.187, Ceil
 * 14.980 untuk 22 Owner eksisting). `fulfillmentRateByCapitalType` opsional
 * (dilaporkan bila tersedia dari perhitungan Fulfillment historis).
 */
export interface MigrationReport {
  ownersImported: number
  transactionsImported: number
  grandTotal: MigrationGrandTotal
  fulfillmentRateByCapitalType?: Record<CapitalType, MoneyString>
}

// ---------------------------------------------------------------------------
// Error domain migrasi — kode stabil
// ---------------------------------------------------------------------------

/** Kode error domain migrasi yang dikenal. */
export type MigrationErrorCode =
  | 'UNKNOWN_OWNER_KEY' // transaksi merujuk ownerKey yang tak ada pada daftar Owner
  | 'DUPLICATE_OWNER_KEY' // ownerKey/email muncul lebih dari sekali pada sumber
  | 'INVALID_QUANTITY' // Quantity transaksi historis bukan integer positif

/**
 * Error domain migrasi dengan `code` stabil. `details` opsional membawa payload
 * terstruktur untuk diagnosis (mis. ownerKey yang bermasalah).
 */
export class MigrationError extends Error {
  readonly code: MigrationErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: MigrationErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'MigrationError'
    this.code = code
    this.details = details
  }
}
