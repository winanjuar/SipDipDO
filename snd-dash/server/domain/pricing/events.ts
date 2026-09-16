// server/domain/pricing/events.ts
//
// Tipe input & error domain pricing (FR-6/FR-7). Ini adalah kontrak nilai yang
// dipakai lintas lapisan (route → service) dan diturunkan pula ke pintu
// `index.ts`. Aturan bisnis (validasi, audit, transaksi) ada di
// `pricing.service.ts`.
//
// Referensi: design.md A.4 PricingModule dan Requirement 6/7 (FR-6/FR-7).

import type {
  JakartaDate,
  MoneyString,
  PriceKind,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Input penetapan harga (FR-6.1)
// ---------------------------------------------------------------------------

/**
 * Input penetapan harga beli/jual baru (FR-6.1).
 *
 * - `kind`          : jenis harga ('beli' dipakai transaksi Phase 1; 'jual'
 *                     tercatat untuk Phase 2).
 * - `price`         : nilai harga berskala tetap numeric(18,2) — string (AD-10).
 * - `effectiveDate` : tanggal efektif harga ('YYYY-MM-DD', zona Jakarta, AD-9).
 *
 * Referensi MoM penetap diberikan terpisah sebagai `momRef` pada `setPrice`
 * (mengikuti tanda tangan A.4), bukan bagian dari input ini.
 */
export interface SetPriceInput {
  kind: PriceKind
  price: MoneyString
  effectiveDate: JakartaDate
}

// ---------------------------------------------------------------------------
// Input MoM (FR-7)
// ---------------------------------------------------------------------------

/**
 * Input simpan/edit MoM MRO/RUPS (FR-7).
 *
 * - `id`      : bila diisi → edit MoM yang ada (hanya boleh WHILE status 'draft',
 *               FR-7 §7.3); bila kosong → buat MoM baru berstatus 'draft'.
 * - `title`   : judul MoM (wajib saat membuat baru).
 * - `momDate` : tanggal MoM ('YYYY-MM-DD').
 * - `body`    : isi/notulen (opsional).
 * - `finalize`: bila `true`, transisikan MoM ke status 'final' (draft → final).
 *               Setelah final, MoM tidak dapat diedit lagi (FR-7 §7.3).
 */
export interface MomInput {
  id?: Uuid
  title?: string
  momDate?: JakartaDate
  body?: string | null
  finalize?: boolean
}

// ---------------------------------------------------------------------------
// Error domain pricing — kode stabil untuk pemetaan HTTP di route
// ---------------------------------------------------------------------------

/** Kode error domain pricing yang dikenal (stabil untuk konsumen API). */
export type PricingErrorCode =
  | 'PRICE_NOT_FOUND' // tak ada harga berlaku s.d. tanggal diminta (FR-6.3)
  | 'PRICE_CONFLICT' // bentrok unik (kind, effective_date) (AD-7)
  | 'MOM_NOT_FOUND' // MoM referensi/target tidak ditemukan
  | 'MOM_ALREADY_FINAL' // MoM sudah 'final' — tidak dapat diedit lagi (FR-7 §7.3)
  | 'MOM_TITLE_REQUIRED' // membuat MoM baru tanpa judul

/**
 * Error domain pricing dengan `code` stabil. Route menerjemahkan `code` menjadi
 * status HTTP yang sesuai; pesan bersifat manusiawi (Bahasa Indonesia).
 */
export class PricingError extends Error {
  readonly code: PricingErrorCode

  constructor(code: PricingErrorCode, message: string) {
    super(message)
    this.name = 'PricingError'
    this.code = code
  }
}
