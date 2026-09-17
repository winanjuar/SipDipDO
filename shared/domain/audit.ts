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
