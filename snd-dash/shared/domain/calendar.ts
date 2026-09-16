// shared/domain/calendar.ts
//
// Semua aturan kalender-hari zona Asia/Jakarta (AD-9). Kedaluwarsa hari-7 (FR-19)
// dan "hari yang sama" untuk cross-referral (FR-22) dihitung atas selisih HARI
// KALENDER di zona Asia/Jakarta, bukan selisih jam wall-clock. Ini menjaga
// invarian: jam pemicu cron (UTC) tidak boleh mengubah hasil kedaluwarsa —
// yang menentukan hanyalah tanggal kalender Jakarta pada saat submit vs hari-ini.

import type { JakartaDate } from './types'

/** Zona waktu kanonik untuk seluruh aturan kalender-hari. */
export const JAKARTA_TZ = 'Asia/Jakarta'

/** Ambang kedaluwarsa hari-7 (FR-19). */
const DAY7_THRESHOLD = 7

/** Formatter tetap 'YYYY-MM-DD' pada zona Asia/Jakarta (en-CA menghasilkan ISO). */
const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JAKARTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Tanggal kalender Asia/Jakarta ('YYYY-MM-DD') dari instant UTC.
 * Memakai Intl.DateTimeFormat dengan timeZone JAKARTA_TZ sehingga penggeseran
 * hari akibat offset +07:00 tertangani dengan benar.
 */
export function toJakartaDate(instant: Date): JakartaDate {
  return jakartaDateFormatter.format(instant) as JakartaDate
}

/**
 * Jumlah hari sejak epoch untuk sebuah `JakartaDate` ('YYYY-MM-DD').
 * Diinterpretasikan sebagai tengah hari UTC agar aman dari pembulatan DST/offset
 * (Jakarta tidak ber-DST, namun tengah hari menjaga stabilitas aritmetika).
 */
function toEpochDay(date: JakartaDate): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/**
 * Kedaluwarsa hari-7 (FR-19): true bila selisih hari kalender
 * (jakartaToday − submit) ≥ 7. Invarian terhadap jam pemicu (UTC): hanya
 * selisih tanggal kalender Jakarta yang menentukan.
 */
export function isExpiredDay7(submit: JakartaDate, jakartaToday: JakartaDate): boolean {
  return toEpochDay(jakartaToday) - toEpochDay(submit) >= DAY7_THRESHOLD
}

/** "Hari yang sama" untuk cross-referral (FR-22). */
export function sameJakartaDay(a: JakartaDate, b: JakartaDate): boolean {
  return a === b
}
