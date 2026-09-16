// shared/domain/types.ts
//
// Tipe berskala tetap (fixed-scale) untuk seluruh aplikasi. Semua nilai uang/rasio
// melewati batas API/SSR sebagai STRING desimal berskala tetap (AD-10).
// `MoneyString` & `RatioString` adalah branded string; `Number()`/`parseFloat()`
// atas nilai ini DILARANG di semua lapisan — gunakan pembungkus decimal di `./decimal`.

/** UUID sebagai branded string (identitas entitas). */
export type Uuid = string & { readonly __brand: 'Uuid' }

/** Nilai uang berskala tetap `numeric(18,2)` di DB. Selalu string. */
export type MoneyString = string & { readonly __brand: 'Money' }

/** Rasio berskala tetap `numeric(9,6)` di DB; half-up 2 desimal saat display. Selalu string. */
export type RatioString = string & { readonly __brand: 'Ratio' }

/** Tanggal kalender zona Asia/Jakarta dalam format 'YYYY-MM-DD'. */
export type JakartaDate = string & { readonly __brand: 'JakartaDate' }

/** Jenis modal — nilai selalu Bahasa Indonesia (menjadi bagian dari kontrak data). */
export type CapitalType = 'Modal Tetap' | 'Modal Bergerak' | 'Modal Operasional'

/** Status pesanan beli. Catatan (AD-2): penarikan adalah kolom `withdrawn_at`, bukan status. */
export type OrderStatus =
  | 'menunggu_konfirmasi'
  | 'terkonfirmasi'
  | 'ditolak'
  | 'kedaluwarsa'

/** Status siklus hidup owner (registrasi → verifikasi → keluar). */
export type OwnerLifecycle =
  | 'diajukan'
  | 'terverifikasi'
  | 'ditolak'
  | 'kedaluwarsa'
  | 'keluar'

/** Jenis harga. 'jual' tercatat untuk Phase 2, tidak dipakai transaksi Phase 1. */
export type PriceKind = 'beli' | 'jual'

/** Himpunan tertutup aksi yang wajib MFA (AD-8). */
export type MfaActionType = 'konfirmasi' | 'input_langsung' | 'kompensasi'

/**
 * Aturan per jenis modal (FR-1/FR-23):
 * - `plafon`  : Ceil = Quantity × plafon (batas atas kepemilikan).
 * - `bobot`   : Shares = Quantity × bobot (pembobotan kekuatan suara).
 * - `inRkap`  : apakah jenis modal ikut dalam batas/ruang RKAP.
 */
export const CAPITAL_RULES: Record<
  CapitalType,
  { plafon: number; bobot: number; inRkap: boolean }
> = {
  'Modal Tetap': { plafon: 5, bobot: 1, inRkap: true },
  'Modal Bergerak': { plafon: 3, bobot: 2, inRkap: true },
  'Modal Operasional': { plafon: 1, bobot: 3, inRkap: false },
}
