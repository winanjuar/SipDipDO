// server/domain/proofs/events.ts
//
// Tipe kontrak nilai & error domain proofs (FR-11, AD-5). Berisi:
//   - OutboundEmail : email keluar generik (notifikasi COO new-order, dsb.) yang
//                     di-enqueue in-tx via `enqueueEmail` (bukan OTP — OTP punya
//                     jalur sendiri di identity/otp.email.ts).
//   - ProofData     : model data MURNI Bukti Transaksi pada titik potong sebuah
//                     transaksi ledger — basis `renderProofPdf` (regenerate-on-
//                     demand, byte-identik untuk state yang sama → Property 11).
//   - OutboxRow     : baris `email_outbox` sebagaimana dibaca lapisan data.
//   - ProofsError   : error domain proofs dengan kode stabil.
//
// Referensi: design.md PART A A.4 ProofsModule + B.8 Bukti Transaksi, dan
// Requirement 11 (FR-11 §11.1–§11.4). Aturan bisnis (render murni, drain+retry)
// ada di `proofs.service.ts`; terjemahan query di `proofs.repo.ts`.

import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Jenis baris outbox — menandai payload agar drain memilih penanganan yang tepat
// ---------------------------------------------------------------------------

/**
 * Jenis baris `email_outbox` (disimpan pada `payload.kind`).
 *
 * - `proof`        : Bukti Transaksi (regenerate-on-demand dari `ledgerTxId`).
 * - `notification` : email notifikasi generik (mis. COO new-order, FR-19 §8).
 */
export type OutboxKind = 'proof' | 'notification'

// ---------------------------------------------------------------------------
// OutboundEmail — email keluar generik (enqueueEmail)
// ---------------------------------------------------------------------------

/**
 * Email keluar generik yang di-enqueue DI DALAM transaksi aksi (AD-5) via
 * `enqueueEmail`. Dipakai untuk notifikasi (mis. COO diberi tahu Pesanan
 * Pembelian baru masuk Antrian Beli, FR-19 §8). OTP TIDAK melewati jalur ini
 * (identity/otp.email.ts menanganinya).
 *
 * `payload` opsional membawa metadata terstruktur; `kind` default 'notification'
 * disematkan oleh service saat menulis baris outbox.
 */
export interface OutboundEmail {
  recipient: string
  subject: string
  body: string
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// ProofData — model data MURNI Bukti Transaksi pada titik potong transaksi
// ---------------------------------------------------------------------------

/**
 * Model data Bukti Transaksi pada TITIK POTONG sebuah transaksi ledger
 * (FR-11 §11.2). Dirakit dari state ledger pada saat transaksi menjadi efektif
 * (bukan posisi mutakhir) sehingga regenerasi selalu identik (Property 11).
 *
 * Memuat seluruh field wajib §11.2: identitas Owner, tanggal, Capital Type,
 * Quantity, harga, Shares, Ceil, Strength, dan Portion SETELAH transaksi.
 *
 * Semua nilai uang/rasio berupa string berskala tetap (AD-10); tak boleh
 * di-`Number()`-kan. Nilai ini adalah masukan MURNI bagi renderer template v3.
 */
export interface ProofData {
  /** Versi template dokumen (bagian kontrak byte-identik). */
  templateVersion: 'Template Konfirmasi Pembelian Saham v3'
  /** Transaksi ledger yang menjadi dasar Bukti. */
  ledgerTxId: Uuid
  // Identitas Owner (§11.2).
  ownerId: Uuid
  ownerName: string
  ownerEmail: string
  // Rincian transaksi (§11.2).
  /** Tanggal pembayaran transaksi (Jakarta). */
  transactionDate: JakartaDate
  capitalType: CapitalType
  /** Quantity transaksi (integer). */
  quantity: number
  /** Harga final ter-snapshot transaksi (AD-7). */
  price: MoneyString
  /** Shares transaksi (Quantity × bobot). */
  transactionShares: number
  /** Ceil transaksi (Quantity × plafon). */
  transactionCeil: number
  // Posisi Owner SETELAH transaksi (pada titik potong) — §11.2.
  /** Σ Shares Owner gabungan semua Capital Type setelah transaksi. */
  ownerTotalShares: number
  /** Σ Ceil Owner gabungan semua Capital Type setelah transaksi. */
  ownerTotalCeil: number
  /** Strength = Σ Shares ÷ Σ Ceil Owner (fraksi 0..1). */
  strength: RatioString
  /** Portion = Σ Shares Owner ÷ Σ Shares seluruh Owner (fraksi 0..1). */
  portion: RatioString
}

// ---------------------------------------------------------------------------
// OutboxRow — baris email_outbox sebagaimana dibaca lapisan data
// ---------------------------------------------------------------------------

/** Baris `email_outbox` yang dibaca dari DB (schema.ts). */
export interface OutboxRow {
  id: Uuid
  recipient: string
  subject: string
  body: string | null
  ledgerTxId: Uuid | null
  payload: Record<string, unknown>
  attempts: number
  sentAt: Date | null
  lastError: string | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Error domain proofs — kode stabil
// ---------------------------------------------------------------------------

/** Kode error domain proofs yang dikenal (stabil untuk konsumen API). */
export type ProofsErrorCode =
  | 'LEDGER_TX_NOT_FOUND' // renderProofPdf/enqueueProof atas ledgerTxId tak dikenal
  | 'OWNER_NOT_FOUND' // owner transaksi tak ditemukan saat merakit ProofData

/**
 * Error domain proofs dengan `code` stabil. Route menerjemahkan `code` menjadi
 * status HTTP; pesan bersifat manusiawi (Bahasa Indonesia).
 */
export class ProofsError extends Error {
  readonly code: ProofsErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: ProofsErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ProofsError'
    this.code = code
    this.details = details
  }
}
