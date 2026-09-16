/**
 * Helper kalender-hari zona Asia/Jakarta (AD-9 / R-008).
 *
 * SELURUH aturan kalender-hari (expiry hari ke-7, pengingat H-3, "hari yang
 * sama", tanggal efektif, cut-off) dihitung lewat modul ini — jangan
 * membandingkan `new Date()` mentah (UTC vs lokal) untuk batas hari.
 *
 * Murni tanpa I/O: instant disuntik sebagai parameter (tidak ada Date.now());
 * konversi zona memakai Intl.DateTimeFormat dengan timeZone tetap.
 */
export const JAKARTA_TZ = 'Asia/Jakarta' as const

/** Kunci hari kalender "YYYY-MM-DD" di zona Asia/Jakarta (UTC+7, tanpa DST). */
export type DayKey = string & { readonly __brand: 'DayKey' }

const dayKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: JAKARTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Kunci hari kalender Asia/Jakarta dari sebuah instant.
 * Boundary: pukul 00:00 WIB (17:00 UTC) adalah pergantian hari.
 */
export function jakartaDayKey(instant: Date): DayKey {
  const parts = dayKeyFormatter.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find(p => p.type === type)
    if (!part) throw new Error(`Formatter tidak menyediakan bagian ${type}`)
    return part.value
  }
  return `${get('year')}-${get('month')}-${get('day')}` as DayKey
}

function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

/**
 * Validasi BENTUK + SEMANTIK: bulan 1–12 dan hari valid untuk bulan/tahun
 * (kabisat) — tanpa ini, "2026-02-31" lolos regex lalu Date.UTC me-roll senyap
 * ke 3 Maret.
 */
function parseDayKey(day: DayKey): { y: number, m: number, d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Kunci hari tidak sah (harus YYYY-MM-DD): "${day}"`)
  }
  const y = Number.parseInt(match[1], 10)
  const m = Number.parseInt(match[2], 10)
  const d = Number.parseInt(match[3], 10)
  const daysInMonth = m === 2 && isLeapYear(y) ? 29 : (DAYS_IN_MONTH[m - 1] ?? 0)
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth) {
    throw new Error(`Kunci hari tidak sah (tanggal kalender tidak ada): "${day}"`)
  }
  return { y, m, d }
}

/**
 * Membungkus string menjadi DayKey tervalidasi (bentuk YYYY-MM-DD).
 * Satu-satunya jalur sah membuat DayKey dari string mentah di luar jakartaDayKey.
 */
export function asDayKey(value: string): DayKey {
  parseDayKey(value as DayKey)
  return value as DayKey
}

function epochUtc(day: DayKey): number {
  const { y, m, d } = parseDayKey(day)
  return Date.UTC(y, m - 1, d)
}

function epochToDayKey(epochDay: number): DayKey {
  // Tanggal kalender UTC dari epoch tengah hari (aman dari pinggir hari).
  const iso = new Date(epochDay).toISOString()
  return iso.slice(0, 10) as DayKey
}

const MS_PER_DAY = 86_400_000
const DAY_EPOCH_ORIGIN = Date.UTC(2001, 0, 1) // titik aman jauh dari pinggir

/** Penjumlahan hari KALENDER (bukan 24 jam): addCalendarDays("2026-01-31", 1) -> "2026-02-01". */
export function addCalendarDays(day: DayKey, days: number): DayKey {
  const base = epochUtc(day) - DAY_EPOCH_ORIGIN
  return epochToDayKey(DAY_EPOCH_ORIGIN + (base + days * MS_PER_DAY))
}

/** Selisih hari kalender b − a (positif bila b setelah a). */
export function diffCalendarDays(a: DayKey, b: DayKey): number {
  return Math.round((epochUtc(b) - epochUtc(a)) / MS_PER_DAY)
}

/** true bila a <= b secara kalender. */
export function isDayOnOrBefore(a: DayKey, b: DayKey): boolean {
  return diffCalendarDays(a, b) >= 0
}
