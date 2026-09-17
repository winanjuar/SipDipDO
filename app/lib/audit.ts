/**
 * Kontrak wire GET /api/audit (server/api/audit/index.get.ts) + helper
 * tampilan halaman Audit Trail — keputusan kanoniknya di modul audit
 * (server/domain/audit); lapis ini hanya bentuk wire & format display.
 */

/** Aktor entry — envelope AD-3 + email owner hasil join server (display). */
export interface AuditAktorTampil {
  kind: 'user' | 'system'
  ownerId: string | null
  email: string | null
}

/** Satu baris entry audit di lapis tampilan. */
export interface AuditEntryTampil {
  id: string
  action: string
  actor: AuditAktorTampil
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

/** Respons GET /api/audit: `{ data, nextPage }` — nextPage null bila habis. */
export interface AuditRespons {
  data: AuditEntryTampil[]
  nextPage: number | null
}

/** Zona tampilan waktu audit — konvensi spine (Asia/Jakarta, AD-9). */
const ZONA_WAKTU = 'Asia/Jakarta'
/** Lokal format waktu — UI Bahasa Indonesia (konvensi spine). */
const LOKAL_WAKTU = 'id-ID'
/** Batas karakter JSON detail sebelum dipotong — konstanta bernama (spec 1.3). */
export const PANJANG_POTONG_DETAIL = 80
/** Penanda potongan JSON detail. */
const TANDA_POTONG = '…'
/** Placeholder target null — teks eksplisit, bukan sel kosong. */
export const TARGET_KOSONG = '—'

const PEMFORMAT_WAKTU = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: ZONA_WAKTU,
})

/** Format waktu entry: id-ID, zona Asia/Jakarta (mis. "17/9/2026 14.30"). */
export function formatWaktuAudit(iso: string): string {
  return PEMFORMAT_WAKTU.format(new Date(iso))
}

/** JSON detail terpotong pada batas konstanta — sel tetap tinggi konstan. */
export function ringkasDetailJson(details: Record<string, unknown>): string {
  const json = JSON.stringify(details) ?? '{}'
  return json.length > PANJANG_POTONG_DETAIL
    ? `${json.slice(0, PANJANG_POTONG_DETAIL)}${TANDA_POTONG}`
    : json
}

/** Label aktor: email owner untuk `user`, "System" untuk aktor sistem. */
export function labelAktor(actor: AuditAktorTampil): string {
  if (actor.kind === 'system') return 'System'
  return actor.email ?? actor.ownerId ?? 'Owner'
}
