/**
 * Kontrak wire GET /api/mom (server/api/mom/*.ts) + helper tampilan halaman
 * MoM — keputusan kanoniknya di modul pricing (server/domain/pricing);
 * lapis ini hanya bentuk wire & format display.
 */

import type { MomStatus, MomWire } from '#shared/domain/mom'

/** Respons GET /api/mom: `{ data, nextPage }` — nextPage null bila habis. */
export interface MomRespons {
  data: MomWire[]
  nextPage: number | null
}

/** Zona tampilan waktu MoM — konvensi spine (Asia/Jakarta, AD-9). */
const ZONA_WAKTU = 'Asia/Jakarta'
/** Lokal format waktu — UI Bahasa Indonesia (konvensi spine). */
const LOKAL_WAKTU = 'id-ID'

const PEMFORMAT_TANGGAL = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_WAKTU,
})

const PEMFORMAT_WAKTU_LENGKAP = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: ZONA_WAKTU,
})

/** Format tanggal MoM held_at: id-ID, zona Asia/Jakarta (mis. "17 September 2026"). */
export function formatTanggalMom(iso: string): string {
  return PEMFORMAT_TANGGAL.format(new Date(iso))
}

/** Format waktu lengkap: id-ID, zona Asia/Jakarta (mis. "17 September 2026 14:30"). */
export function formatWaktuLengkap(iso: string): string {
  return PEMFORMAT_WAKTU_LENGKAP.format(new Date(iso))
}

/** Peta status → badge (teks + varian token semantik UX-DR2/DR4). */
export const PETA_BADGE_MOM: Record<MomStatus, { label: string, variant: 'warn' | 'success' }> = {
  draft: { label: 'Draft', variant: 'warn' },
  final: { label: 'Final', variant: 'success' },
}

/** Potong konten teks untuk preview. */
// Batas karakter preview — konstanta bernama.
const MAX_LENGTH_PREVIEW = 100

export function ringkasKonten(text: string | null, maxLength = MAX_LENGTH_PREVIEW): string {
  if (!text) return '—'
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}
