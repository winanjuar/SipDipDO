/**
 * AUDIT — kontrak murni lintas lapis (AD-3/AD-6): registry terpusat nama aksi
 * audit, envelope aktor, dan tipe input entry. TANPA I/O, tanpa framework —
 * dipakai bersama `server/domain/audit` (service/repo), endpoint uji, dan
 * lapis tampilan.
 *
 * Kolom DB `audit_logs.action` bertipe `text` (bukan pgEnum) — himpunan aksi
 * ditutup DI SINI dan divalidasi service; menambah aksi (Epic 1 lanjutan,
 * Story 1.4+) = edit registry ini tanpa migrasi DB.
 */

/**
 * Himpunan tertutup nama aksi audit Epic 1 — SATU sumber kebenaran.
 * `as const` menurunkan union `AuditAction` sekaligus jadi basis guard runtime.
 */
export const AUDIT_ACTIONS = [
  // Pendaftaran (FR-22) — submit, verifikasi COO, penolakan, kedaluwarsa cron.
  'pendaftaran-diajukan',
  'pendaftaran-verifikasi',
  'pendaftaran-penolakan',
  'pendaftaran-kedaluwarsa',
  // Kelengkapan Profile membuka akses (FR-13).
  'profil-kelengkapan',
  // Kelola data owner (FR-13).
  'kelola-owner-perubahan',
  // Pergantian mandat COO (FR-17).
  'pergantian-coo',
  // MoM MRO/RUPS (FR-7, Story 2.1) — buat, ubah, finalkan, hapus.
  'mom-dibuat',
  'mom-diubah',
  'mom-difinalkan',
  'mom-dihapus',
  // MoM PDF upload (Story 2.2) — upload PDF ke storage.
  'mom-pdf-uploaded',
  // Harga (FR-6, Story 2.3) — penetapan baru, koreksi.
  'price-created',
  'price-corrected',
] as const

/** Nama aksi audit yang sah, diturunkan dari registry. */
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * Aktor entry audit (envelope AD-3): `user` = owner/COO via `owners.id`;
 * `system` = cron/migrasi, tanpa ownerId. Aktor audit selalu pejabat saat
 * commit (AD-8) — penentu aktor ada di pemanggil.
 */
export type AuditActor =
  | { kind: 'user', ownerId: string }
  | { kind: 'system' }

/**
 * Input entry audit untuk `writeAuditEntry(tx, input)` — ditulis DALAM
 * transaksi yang sama dengan aksinya (AD-3).
 */
export interface AuditEntryInput {
  actor: AuditActor
  action: AuditAction
  /** Referensi target berformat `<tabel>:<id>`; null bila aksi tanpa target. */
  target: string | null
  details: Record<string, unknown>
}

/** Set pencarian cepat untuk validasi keanggotaan aksi saat runtime. */
const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS)

/**
 * Type guard: apakah `value` anggota registry. Dipakai service untuk menolak
 * aksi di luar registry SEBELUM INSERT (matriks I/O spec 1.3).
 */
export function isAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTION_SET.has(value)
}

/**
 * Opsi ukuran halaman baca audit (renegosiasi user 2026-09-17, Spec Change Log
 * 1.3 — semula 25/50/100 lalu disetel ke 20/40/80): `GET /api/audit?limit=`
 * menerima anggota `AUDIT_LIMIT_OPSI` saja; di luar itu → 400 envelope.
 * Murni lintas lapis (AD-6) — dipakai handler, service, dan selector ukuran
 * halaman.
 */
// Tabel data opsi ukuran halaman — angka di sini adalah nilai kontrak bernama,
// bukan magic number (pola DAYS_IN_MONTH calendar.ts).
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export const AUDIT_LIMIT_OPSI = [20, 40, 80] as const

/** Ukuran halaman yang sah, diturunkan dari opsi. */
export type AuditLimit = (typeof AUDIT_LIMIT_OPSI)[number]

/** Ukuran halaman bawaan bila `?limit=` tidak hadir. */
export const AUDIT_LIMIT_DEFAULT: AuditLimit = 20

/** Set pencarian cepat untuk validasi keanggotaan opsi limit saat runtime. */
const AUDIT_LIMIT_SET: ReadonlySet<number> = new Set(AUDIT_LIMIT_OPSI)

/** Type guard: apakah `value` anggota opsi ukuran halaman. */
export function isAuditLimit(value: number): value is AuditLimit {
  return AUDIT_LIMIT_SET.has(value)
}
