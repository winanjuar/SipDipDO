/**
 * Skema Drizzle (drizzle/ — Structural Seed).
 *
 * Konvensi (spine — Consistency Conventions):
 * - ID `uuid`; tabel snake_case jamak; tanggal `timestamptz` (disimpan UTC,
 *   dibaca sebagai string ISO — bukan Date lokal).
 * - Uang `numeric(18,2)` dan ratio `numeric(9,6)` SELALU sebagai string
 *   desimal berskala tetap (AD-10) — tidak pernah number/float.
 * - Kepemilikan tabel mutlak per modul (AD-5): setiap tabel di bawah
 *   diberi label modul pemiliknya; modul tetangga menulis hanya lewat API
 *   publik modul pemilik (index.ts).
 */
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { OWNER_STATUSES } from '../shared/domain/identity'

/**
 * PROOFS — outbox email (AD-5, AR-6): baris ditulis DI DALAM transaksi aksi
 * terkait (menjamin tidak ada email hilang saat crash); pengiriman async
 * dengan retry oleh modul proofs (`server/domain/proofs/outbox.service.ts`).
 *
 * Tabel ini adalah migrasi awal scaffold — smoke `drizzle-kit migrate`.
 */
export const outboxEmails = pgTable(
  'outbox_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Jenis template — registry tervalidasi di proofs service ('otp' | 'bukti_transaksi' | 'notifikasi'). */
    kind: text('kind').notNull(),
    toAddress: text('to_address').notNull(),
    /** Snapshot data template — imutabel sejak ditulis. */
    payload: jsonb('payload').notNull(),
    /** 'pending' | 'sent' | 'exhausted' (retry habis — harus terlihat, R-009). */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    /** Jadwal kirim berikutnya (backoff retry). */
    sendAfter: timestamp('send_after', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('outbox_emails_status_send_after_idx').on(t.status, t.sendAfter)],
)

export type OutboxEmail = typeof outboxEmails.$inferSelect
export type NewOutboxEmail = typeof outboxEmails.$inferInsert

/**
 * Enum siklus hidup owner/pendaftaran — dipinkan AD-11 (himpunan tertutup).
 * Hanya modul identity yang MENULIS kolom ini; setiap transisi = compare-and-set
 * atas status sebelumnya dalam satu transaksi (AD-11) — implementasi menyusul
 * Story 1.4/1.6.
 */
export const ownerStatus = pgEnum('owner_status', OWNER_STATUSES)

/**
 * IDENTITY — owners (AD-5/AD-11): satu baris per email (UNIQUE — re-daftar =
 * baris yang sama, bukan baris baru). Kolom minimal Story 1.2 + kode referral
 * (Story 1.4, keputusan owner 2026-09-18); profile 11 field (Story 1.5) dan
 * kontak (1.8) menyusul lewat migrasi BARU — bukan ALTER ini.
 */
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Email akun Google — kunci pencocokan sesi → owner (AD-8, migrasi). */
  email: text('email').notNull().unique(),
  status: ownerStatus('status').notNull().default('diajukan'),
  /** Wajib terisi bila status 'ditolak' — tampil apa adanya kepada pendaftar. */
  rejectionReason: text('rejection_reason'),
  /** Di-set HANYA oleh event Pembelian Pertama efektif (AD-11). */
  firstEffectiveAt: timestamp('first_effective_at', { withTimezone: true, mode: 'string' }),
  /** Kode referral MILIK owner — alfanumerik 8 karakter, dibuat saat baris
   *  owner dibuat (dipakai Epic 3); UNIQUE, backfill migrasi dari md5(id). */
  referralCode: text('referral_code').notNull().unique(),
  /** Kode referral yang DIPAKAI pendaftar saat mendaftar — DORMANT sampai
   *  Epic 3 mengimplementasikan param link ?ref= (keputusan owner
   *  2026-09-18); null = mendaftar tanpa referral. */
  usedReferralCode: text('used_referral_code'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

/**
 * IDENTITY — coo_tenures (AD-5): riwayat jabatan COO (FR-17). Tenure berlaku =
 * started_at <= now() AND (ended_at IS NULL OR ended_at > now()) — kewenangan
 * COO diautoritaskan dari sini, per-request (AD-8).
 */
export const cooTenures = pgTable(
  'coo_tenures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    /** Null = tenure masih berjalan. */
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('coo_tenures_owner_started_idx').on(t.ownerId, t.startedAt)],
)

export type Owner = typeof owners.$inferSelect
export type NewOwner = typeof owners.$inferInsert
export type CooTenure = typeof cooTenures.$inferSelect

/**
 * AUDIT — audit_logs (AD-3/AD-5): trail aksi append-only ber-envelope
 * `{ actor, action, target, details }`. Aktor `user` = owner/COO via
 * `owner_id`; null = `system` (cron/migrasi) — penentu aktor ada di pemanggil
 * (AD-8: aktor audit pejabat saat commit). Kolom `action` bertipe `text`:
 * keanggotaan registry divalidasi service (`shared/domain/audit.ts`) sehingga
 * registry tumbuh tanpa migrasi enum DB.
 *
 * TANPA jalur UPDATE/DELETE — repo hanya INSERT/SELECT, diperkuat DB grants
 * role `app_runtime` (drizzle/runtime-role.sql + drizzle/grants.sql, keputusan
 * spec 1.3 2026-09-17). Modul lain menulis/membaca HANYA lewat
 * `server/domain/audit/index.ts` (AD-5).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null = aktor system — envelope AD-3 dipenuhi satu kolom. */
    actorOwnerId: uuid('actor_owner_id').references(() => owners.id),
    /** Nama aksi dari registry terpusat `shared/domain/audit.ts` (text, bukan enum). */
    action: text('action').notNull(),
    /** Referensi target berformat `<tabel>:<id>`; null bila aksi tanpa target. */
    target: text('target'),
    /** Payload jsonb — imutabel sejak ditulis dalam transaksi aksinya. */
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_at_idx').on(t.createdAt)],
)

export type AuditLogRow = typeof auditLogs.$inferSelect
export type NewAuditLogRow = typeof auditLogs.$inferInsert
