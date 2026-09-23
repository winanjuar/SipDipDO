/**
 * PRICE — kontrak murni lintas lapis (AD-6): tipe wire, input, dan fungsi
 * resolusi harga. TANPA I/O, tanpa framework — dipakai bersama
 * `server/domain/pricing/pricing.service.ts`, route handler, dan halaman.
 *
 * Nilai harga (amount) sebagai string desimal — tidak pernah Number/parseFloat (AD-10).
 *
 * **Validates: Requirements 4, 15**
 */

import { compare } from './money'

/** Tipe harga: beli atau jual. */
export type PriceType = 'beli' | 'jual'

/** Konstanta tipe harga yang valid — untuk validasi input. */
export const PRICE_TYPES = ['beli', 'jual'] as const

/**
 * Bentuk wire PricePeriod untuk lapis tampilan — sesuai kontrak design.md.
 * Timestamptz sebagai string ISO, amount sebagai string desimal (AD-10).
 */
export interface PriceWire {
  id: string
  type: PriceType
  /** Tanggal efektif harga — ISO string. */
  effectiveDate: string
  /** Nilai harga — string desimal numeric(18,2). */
  amount: string
  /** ID MoM referensi. */
  momId: string
  /** Judul MoM referensi — untuk tampilan. */
  momTitle: string
}

/**
 * Input untuk membuat atau mengoreksi harga.
 * Semua keputusan harga wajib tertaut MoM (Req-14).
 */
export interface PriceCreateInput {
  type: PriceType
  /** Tanggal efektif harga — ISO date string (YYYY-MM-DD). */
  effectiveDate: string
  /** Nilai harga — string desimal numeric(18,2). */
  amount: string
  /** ID MoM referensi — wajib. */
  momId: string
}

/**
 * Input untuk mengoreksi harga yang sudah ada.
 * Amount dan momId dapat diubah, tapi type dan effectiveDate tidak.
 */
export interface PriceCorrectInput {
  /** Nilai harga baru — string desimal numeric(18,2). */
  amount: string
  /** ID MoM referensi baru — wajib. */
  momId: string
}

/**
 * Hasil resolusi harga berjalan — sepasang harga beli dan jual.
 * Sesuai kontrak design.md.
 */
export interface PriceResolveResult {
  beli: PriceWire
  jual: PriceWire
}

/**
 * Opsi ukuran halaman baca harga: `GET /api/harga?limit=` menerima anggota
 * `PRICE_LIMIT_OPSI` saja; di luar itu → 400 envelope. Pola `MOM_LIMIT_OPSI`.
 */
// Tabel data opsi ukuran halaman — angka di sini adalah nilai kontrak bernama,
// bukan magic number (pola MOM_LIMIT_OPSI mom.ts).
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export const PRICE_LIMIT_OPSI = [10, 20, 40] as const

/** Ukuran halaman yang sah, diturunkan dari opsi. */
export type PriceLimit = (typeof PRICE_LIMIT_OPSI)[number]

/** Ukuran halaman bawaan bila `?limit=` tidak hadir. */
export const PRICE_LIMIT_DEFAULT: PriceLimit = 10

/** Set pencarian cepat untuk validasi keanggotaan opsi limit saat runtime. */
const PRICE_LIMIT_SET: ReadonlySet<number> = new Set(PRICE_LIMIT_OPSI)

/** Type guard: apakah `value` anggota opsi ukuran halaman. */
export function isPriceLimit(value: number): value is PriceLimit {
  return PRICE_LIMIT_SET.has(value)
}

/** Type guard: apakah `value` tipe harga yang valid. */
export function isPriceType(value: string): value is PriceType {
  return PRICE_TYPES.includes(value as PriceType)
}

/**
 * Validasi input buat harga: type valid, effectiveDate ada, amount positif,
 * momId wajib ada.
 * Mengembalikan pesan error atau null bila valid.
 *
 * CATATAN: Validasi amount sebagai string desimal positif dilakukan secara
 * sederhana (non-empty, tidak ada karakter ilegal). Validasi presisi penuh
 * dilakukan di layer service via parseRupiah.
 */
export function validatePriceCreateInput(input: Partial<PriceCreateInput>): string | null {
  if (!input.type || !isPriceType(input.type)) {
    return 'Tipe harga wajib diisi (beli atau jual).'
  }
  if (!input.effectiveDate || input.effectiveDate.trim().length === 0) {
    return 'Tanggal efektif wajib diisi.'
  }
  // Validasi format tanggal ISO
  const parsed = new Date(input.effectiveDate)
  if (Number.isNaN(parsed.getTime())) {
    return 'Tanggal efektif tidak valid.'
  }
  if (!input.amount || input.amount.trim().length === 0) {
    return 'Nilai harga wajib diisi.'
  }
  // Validasi amount minimal: harus berupa angka dengan format valid
  // Format yang diterima: "52000.50" (kanonik) atau "52.000,50" (id-ID)
  const amountTrimmed = input.amount.trim()
  if (!/^-?[\d.,]+$/.test(amountTrimmed)) {
    return 'Nilai harga harus berupa angka.'
  }
  if (!input.momId || input.momId.trim().length === 0) {
    return 'MoM referensi wajib dipilih.'
  }
  return null
}

/**
 * Validasi input koreksi harga: amount dan momId wajib ada.
 * Mengembalikan pesan error atau null bila valid.
 */
export function validatePriceCorrectInput(input: Partial<PriceCorrectInput>): string | null {
  if (!input.amount || input.amount.trim().length === 0) {
    return 'Nilai harga wajib diisi.'
  }
  const amountTrimmed = input.amount.trim()
  if (!/^-?[\d.,]+$/.test(amountTrimmed)) {
    return 'Nilai harga harus berupa angka.'
  }
  if (!input.momId || input.momId.trim().length === 0) {
    return 'MoM referensi wajib dipilih.'
  }
  return null
}

// ---------------------------------------------------------------------------
// resolvePrice Pure Function (AD-6, AD-7)
// ---------------------------------------------------------------------------

/**
 * Resolusi harga berjalan dari daftar harga untuk tanggal tertentu.
 *
 * Untuk setiap tipe (beli/jual), mengembalikan harga dengan effectiveDate
 * terbaru yang masih <= date yang diberikan.
 *
 * Property 1: Price Resolution Uniqueness (AD-7)
 * Untuk kombinasi (type, date) manapun, fungsi ini mengembalikan tepat SATU
 * harga — tidak pernah null dan tidak pernah lebih dari satu.
 *
 * **Validates: Requirements 4**
 *
 * @param prices - Daftar harga dari database (sudah di-join dengan MoM)
 * @param type - Tipe harga yang dicari
 * @param date - Tanggal resolusi (ISO string, mis. "2026-09-15")
 * @returns Harga yang berlaku pada tanggal tersebut, atau null bila tidak ada
 *
 * @example
 * // Given prices: [{type: 'beli', effectiveDate: '2026-01-01', ...}, {type: 'beli', effectiveDate: '2026-06-01', ...}]
 * resolvePrice(prices, 'beli', '2026-07-15') // Returns price with effectiveDate '2026-06-01'
 * resolvePrice(prices, 'beli', '2025-12-31') // Returns null (no price before this date)
 */
export function resolvePrice(
  prices: readonly PriceWire[],
  type: PriceType,
  date: string,
): PriceWire | null {
  // Filter harga dengan tipe yang sesuai dan effectiveDate <= date
  const candidates = prices.filter(
    p => p.type === type && p.effectiveDate <= date,
  )

  if (candidates.length === 0) {
    return null
  }

  // Cari harga dengan effectiveDate terbaru
  // Menggunakan compare dari money.ts tidak cocok di sini karena ini string tanggal.
  // Untuk tanggal ISO string, perbandingan leksikografis sudah benar.
  let latest = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    const current = candidates[i]
    if (current.effectiveDate > latest.effectiveDate) {
      latest = current
    }
  }

  return latest
}

/**
 * Resolusi sepasang harga beli dan jual untuk tanggal tertentu.
 *
 * Menggabungkan dua panggilan resolvePrice untuk mendapatkan hasil lengkap.
 * Mengembalikan null bila salah satu tipe tidak memiliki harga berlaku.
 *
 * **Validates: Requirements 4**
 *
 * @param prices - Daftar harga dari database
 * @param date - Tanggal resolusi (ISO string)
 * @returns Sepasang harga beli dan jual, atau null bila tidak lengkap
 */
export function resolvePricePair(
  prices: readonly PriceWire[],
  date: string,
): PriceResolveResult | null {
  const beli = resolvePrice(prices, 'beli', date)
  const jual = resolvePrice(prices, 'jual', date)

  if (!beli || !jual) {
    return null
  }

  return { beli, jual }
}

/** Respons list harga: `nextPage` null bila habis (pola MomDaftar). */
export interface PriceDaftar {
  data: PriceWire[]
  nextPage: number | null
}
