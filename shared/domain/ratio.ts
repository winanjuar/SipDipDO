/**
 * Utilitas ratio/persentase (AD-10 / Req-16)
 *
 * Modul ini menyediakan fungsi formatting ratio ke persentase untuk kasus umum
 * dimana input adalah string desimal atau Decimal langsung — tanpa perlu melalui
 * branded type FixedRatio terlebih dahulu.
 *
 * Kontrak:
 * - Input: ratio 0-1 scale (mis. 0.666667 untuk 66,67%)
 * - Output: format id-ID dengan 2 desimal half-up (mis. "66,67%")
 * - Tidak pernah menggunakan Number()/parseFloat() (AD-10)
 *
 * Untuk parsing dan round-trip yang ketat, gunakan parseRatio/serializeRatioPercent
 * dari money.ts.
 */
import type Decimal from 'decimal.js'
import { parseDecimal } from './money'

// Konstanta untuk konversi persentase
const PERCENT_MULTIPLIER = 100
const PERCENT_DECIMAL_PLACES = 2

/**
 * Format ratio (0-1 scale) ke persentase dengan format id-ID.
 *
 * @param value - Ratio sebagai string desimal atau Decimal (mis. "0.666667" atau Decimal(0.666667))
 * @returns Persentase format id-ID dengan 2 desimal half-up (mis. "66,67%")
 *
 * @example
 * formatRatioAsPercent("0.666667") // "66,67%"
 * formatRatioAsPercent("0.5")      // "50,00%"
 * formatRatioAsPercent("1")        // "100,00%"
 * formatRatioAsPercent("0")        // "0,00%"
 *
 * **Validates: Requirements 16** (Req-16: ratio dibulatkan half-up 2 desimal, tampilkan locale id-ID)
 */
export function formatRatioAsPercent(value: string | Decimal): string {
  const d = typeof value === 'string' ? parseDecimal(value) : value
  const percent = d.times(PERCENT_MULTIPLIER).toFixed(PERCENT_DECIMAL_PLACES) // half-up dari konfigurasi Decimal global
  return `${formatIdId(percent)}%`
}

/**
 * Format angka kanonik ke id-ID (koma sebagai pemisah desimal, titik sebagai ribuan).
 * Hanya untuk internal modul ini.
 *
 * @param canonical - String desimal kanonik (mis. "66.67")
 * @returns Format id-ID (mis. "66,67")
 */
function formatIdId(canonical: string): string {
  const negative = canonical.startsWith('-')
  const unsigned = negative ? canonical.slice(1) : canonical
  const [intPart = '0', decPart = ''] = unsigned.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dec = decPart.length > 0 ? `,${decPart}` : ''
  return `${negative ? '-' : ''}${grouped}${dec}`
}
