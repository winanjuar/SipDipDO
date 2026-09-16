/**
 * Kontrak uang & ratio (AD-10 / R-010) — SATU-sATUnya pasangan parse/serialize
 * yang diizinkan untuk nilai uang/ratio lintas API/SSR.
 *
 * Bentuk kawat (wire): string desimal berskala tetap — rupiah skala 2
 * ("52000.50"), ratio skala 6 ("0.666667"). Bentuk tampilan (display): format
 * id-ID ("52.000,50" / "0,666667" / "66,67%").
 *
 * ATURAN:
 * - Tidak pernah `Number()`/`parseFloat()` atas nilai uang/ratio (dilarang lintas
 *   lapisan — ditegakkan via ESLint no-restricted-syntax, lihat eslint.config.mjs).
 * - Seluruh aritmetika uang hanya di `shared/domain` (helper aritmetika menyusul
 *   bersama story domain yang membutuhkannya; scaffold hanya meminkan kontrak kawat).
 * - Pembulatan half-up (decimal.js ROUND_HALF_UP) — sesuai konvensi penyajian AD-10.
 * - Murni tanpa I/O: tidak ada process.env, fetch, timer, atau Date.
 *
 * Bentuk modul seragam dipertahankan: file TS kebab-case, tipe branded untuk
 * nilai yang lolos validasi (bukan `string` mentah).
 */
import Decimal from 'decimal.js'

// Presisi cukup untuk numeric(18,2) & numeric(9,6) dengan headroom; half-up
// untuk seluruh koersi skala (penyajian AD-10).
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })

/** Nilai rupiah kanonik berskala 2, mis. "52000.50". Hanya dihasilkan parseRupiah. */
export type Rupiah = string & { readonly __brand: 'Rupiah' }
/** Nilai ratio kanonik berskala 6, mis. "0.666667". Hanya dihasilkan parseRatio. */
export type Ratio = string & { readonly __brand: 'Ratio' }

/** Skala tetap yang diizinkan kontrak: 2 (rupiah), 6 (ratio). */
export type FixedScale = 2 | 6

/** Bentuk hasil parse — persis kontrak spec: { scale, value }. */
export interface FixedDecimal<S extends FixedScale = FixedScale> {
  readonly scale: S
  readonly value: S extends 2 ? Rupiah : Ratio
}

export const RUPIAH_SCALE = 2 as const
export const RATIO_SCALE = 6 as const

/**
 * Cap magnitudo = kapasitas kolom DB (AD-10): rupiah `numeric(18,2)`
 * (maks 16 digit integer + 2 desimal), ratio `numeric(9,6)` (maks 3 digit
 * integer + 6 desimal). Parse menolak lebih awal (MoneyParseError) — bukan
 * gagal jauh di DB saat insert.
 */
const MAX_RUPIAH = new Decimal('9999999999999999.99')
const MAX_RATIO = new Decimal('999.999999')

function assertWithinColumnCapacity(d: Decimal, scale: FixedScale, input: string): void {
  const max = scale === RUPIAH_SCALE ? MAX_RUPIAH : MAX_RATIO
  if (d.abs().greaterThan(max)) {
    throw new MoneyParseError(input, scale)
  }
}

/** Error parse bertipe — pemanggil route memetakannya ke envelope { code, message, details }. */
export class MoneyParseError extends Error {
  constructor(readonly input: string, readonly scale: FixedScale) {
    super(`Bukan angka desimal yang sah (skala ${scale}): "${input}"`)
    this.name = 'MoneyParseError'
  }
}

// Bentuk id-ID: "-52.000,50" | "52.000" | "1250,75" (titik ribuan opsional &
// berkelompok 3, koma desimal)
const ID_ID = /^-?\d+(\.\d{3})*(,\d+)?$/
// Bentuk kanonik kawat: "-52000.50" | "52000" | "0.666667"
const CANONICAL = /^-?(0|[1-9]\d*)(\.\d+)?$/

/**
 * Normalisasi ke Decimal kanonik. Aturan presedensi (deterministik):
 * 1. id-ID dulu ("52.000,50" / "52.000"): ada koma = pemisah desimal; titik
 *    berkelompok 3 digit = ribuan. Tanpa koma, "52.000" berarti 52000.
 * 2. Kanonik kawit ("52000.50", "0.6666664"): desimal titik bebas panjang
 *    (di-coerce half-up ke skala).
 * Kelas ambigu "titik + tepat 3 digit" ("1.234") dibaca id-ID (= 1234) —
 * produsen kawit selalu memancarkan skala penuh ("1234.00") sehingga tidak
 * pernah ambigu; "0,005" tetap desimal (koma).
 */
function toCanonicalDecimal(input: string, scale: FixedScale): Decimal {
  const s = input.trim()
  let normalized: string
  if (ID_ID.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (CANONICAL.test(s)) {
    normalized = s
  } else {
    throw new MoneyParseError(input, scale)
  }
  try {
    return new Decimal(normalized)
  } catch {
    throw new MoneyParseError(input, scale)
  }
}

function brand<S extends FixedScale>(canonical: string, _scale: S): FixedDecimal<S>['value'] {
  return canonical as FixedDecimal<S>['value']
}

/**
 * Konstruktor tervalidasi untuk nilai rupiah kanonik berskala 2 (bentuk kawit,
 * mis. "3622000.50") — throw MoneyParseError bila bukan bentuk kanonik penuh.
 */
export function asRupiah(value: string): Rupiah {
  const canonical = toCanonicalDecimal(value, RUPIAH_SCALE).toFixed(RUPIAH_SCALE)
  if (canonical !== value) throw new MoneyParseError(value, RUPIAH_SCALE)
  return canonical as Rupiah
}

/** Konstruktor tervalidasi untuk ratio kanonik berskala 6 (mis. "0.666667"). */
export function asRatio(value: string): Ratio {
  const canonical = toCanonicalDecimal(value, RATIO_SCALE).toFixed(RATIO_SCALE)
  if (canonical !== value) throw new MoneyParseError(value, RATIO_SCALE)
  return canonical as Ratio
}

/**
 * parseRupiah("52.000,50") -> { scale: 2, value: "52000.50" }
 *
 * Menerima bentuk tampilan id-ID maupun kanonik kawit; mengembalikan bentuk
 * kawit berskala 2 (koersi skala half-up). Throw MoneyParseError bila tidak sah.
 */
export function parseRupiah(input: string): FixedDecimal<2> {
  const d = toCanonicalDecimal(input, RUPIAH_SCALE)
  assertWithinColumnCapacity(d, RUPIAH_SCALE, input)
  return { scale: RUPIAH_SCALE, value: brand(d.toFixed(RUPIAH_SCALE), RUPIAH_SCALE) }
}

/**
 * serializeRupiah({ scale: 2, value: "52000.50" }) -> "52.000,50"  (format id-ID)
 * Nilai pecahan nol disajikan tanpa ",00" ("1.000") — mengikuti konvensi
 * penyajian UX (Rp52.000); parse menerima keduanya.
 */
export function serializeRupiah(parsed: FixedDecimal<2>): string {
  const canonical = toCanonicalDecimal(parsed.value, RUPIAH_SCALE).toFixed(RUPIAH_SCALE)
  return groupIdId(canonical, { omitZeroFraction: true })
}

/**
 * parseRatio("66,66665%") belum didukung — rasio masuk sebagai desimal.
 * parseRatio("0,6666665") -> { scale: 6, value: "0.666667" }  (half-up pada koersi skala)
 */
export function parseRatio(input: string): FixedDecimal<6> {
  const d = toCanonicalDecimal(input, RATIO_SCALE)
  assertWithinColumnCapacity(d, RATIO_SCALE, input)
  return { scale: RATIO_SCALE, value: brand(d.toFixed(RATIO_SCALE), RATIO_SCALE) }
}

/**
 * serializeRatio({ scale: 6, value: "0.666667" }) -> "0,666667"  (id-ID)
 */
export function serializeRatio(parsed: FixedDecimal<6>): string {
  const canonical = toCanonicalDecimal(parsed.value, RATIO_SCALE).toFixed(RATIO_SCALE)
  return groupIdId(canonical)
}

/**
 * Penyajian persentase AD-10: presisi penuh dihitung, dibulatkan half-up tepat
 * 2 desimal HANYA saat penyajian. serializeRatioPercent("0.666667") -> "66,67%".
 */
export function serializeRatioPercent(parsed: FixedDecimal<6>): string {
  const d = toCanonicalDecimal(parsed.value, RATIO_SCALE)
  const percent = d.times(100).toFixed(2) // half-up
  return `${groupIdId(percent)}%`
}

/** "52000.50" -> "52.000,50"; "-1250" -> "-1.250". Bagi internal modul ini. */
function groupIdId(canonical: string, options: { omitZeroFraction?: boolean } = {}): string {
  const negative = canonical.startsWith('-')
  const unsigned = negative ? canonical.slice(1) : canonical
  const [intPart = '0', decPart = ''] = unsigned.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const zeroFraction = decPart !== '' && /^[0]+$/.test(decPart)
  const showFraction = decPart.length > 0 && !(options.omitZeroFraction && zeroFraction)
  const dec = showFraction ? `,${decPart}` : ''
  return `${negative ? '-' : ''}${grouped}${dec}`
}
