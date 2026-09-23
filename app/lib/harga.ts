/**
 * Kontrak wire GET /api/harga (server/api/harga/*.ts) + helper tampilan halaman
 * Harga — keputusan kanoniknya di modul pricing (server/domain/pricing);
 * lapis ini hanya bentuk wire & format display.
 */

import type { PriceType, PriceWire, PriceDaftar, PriceResolveResult } from '#shared/domain/price'

// Re-export types for convenience
export type { PriceType, PriceWire, PriceDaftar, PriceResolveResult }

/** Kode HTTP 403 — tangkapan defensif halaman Harga (pola landing.ts). */
export const HTTP_FORBIDDEN = 403

/** Zona tampilan waktu — konvensi spine (Asia/Jakarta, AD-9). */
const ZONA_WAKTU = 'Asia/Jakarta'
/** Lokal format waktu — UI Bahasa Indonesia (konvensi spine). */
const LOKAL_WAKTU = 'id-ID'

const PEMFORMAT_TANGGAL = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_WAKTU,
})

/**
 * Format tanggal efektif harga: id-ID, zona Asia/Jakarta (mis. "17 September 2026").
 */
export function formatTanggalHarga(iso: string): string {
  return PEMFORMAT_TANGGAL.format(new Date(iso))
}

const PEMFORMAT_TANGGAL_SINGKAT = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_WAKTU,
})

/**
 * Format tanggal singkat: id-ID (mis. "17 Sep 2026").
 */
export function formatTanggalSingkat(iso: string): string {
  return PEMFORMAT_TANGGAL_SINGKAT.format(new Date(iso))
}

/**
 * Format nilai harga sebagai Rupiah dengan locale id-ID dan tabular-nums.
 * Menerima string desimal kanonik dari API (mis. "52000.00") dan mengembalikan
 * format id-ID (mis. "Rp52.000").
 *
 * Nilai pecahan nol tidak ditampilkan ("Rp52.000" bukan "Rp52.000,00").
 */
export function formatRupiah(amount: string): string {
  // Parse string decimal — handle both canonical ("52000.00") and id-ID ("52.000,00")
  const normalized = amount.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  
  if (Number.isNaN(parsed)) {
    return `Rp${amount}`
  }
  
  // Format with id-ID locale, no decimal places for whole numbers
  const formatted = new Intl.NumberFormat(LOKAL_WAKTU, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed)
  
  return `Rp${formatted}`
}

/** Peta tipe harga → label tampilan Bahasa Indonesia. */
export const PETA_LABEL_TIPE: Record<PriceType, string> = {
  beli: 'Beli',
  jual: 'Jual',
}

/** Peta tipe harga → warna badge. */
export const PETA_WARNA_TIPE: Record<PriceType, string> = {
  beli: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  jual: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}
