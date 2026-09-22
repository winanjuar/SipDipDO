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
import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { OWNER_STATUSES } from '../shared/domain/identity'
import { MOM_STATUSES } from '../shared/domain/mom'

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
 * baris yang sama, bukan baris baru). Normalisasi owner 2026-09-18 (Epic 1,
 * struktur fix): kolom English, hanya atribut milik owner sendiri +
 * lifecycle; kontak darurat & rekening bank dipisah ke tabel anak 1:1
 * (`owner_emergency_contacts`, `owner_bank_accounts`) — tiap tabel
 * mendeskripsikan tepat satu entitas (3NF). Kolom `used_referral_code`
 * TETAP text (keputusan owner 2026-09-18 — bukan FK; dormant sampai Epic 3).
 */
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Lampiran A #1. */
  fullName: text('full_name'),
  /** Lampiran A #2. */
  alias: text('alias'),
  /** Email akun Google — kunci pencocokan sesi → owner (AD-8, migrasi);
   *  sekaligus field #3 Gmail (tanpa kolom profil terpisah). */
  email: text('email').notNull().unique(),
  /** Lampiran A #4. */
  phoneNumber: text('phone_number'),
  status: ownerStatus('status').notNull().default('diajukan'),
  /** Wajib terisi bila status 'ditolak' — tampil apa adanya kepada pendaftar. */
  rejectionReason: text('rejection_reason'),
  /** Di-set HANYA oleh event Pembelian Pertama efektif (AD-11). */
  firstEffectiveAt: timestamp('first_effective_at', { withTimezone: true, mode: 'string' }),
  /** Kode referral MILIK owner — alfanumerik 8 karakter, dibuat saat baris
   *  owner dibuat (dipakai Epic 3); UNIQUE. */
  referralCode: text('referral_code').notNull().unique(),
  /** Kode referral yang DIPAKAI pendaftar saat mendaftar — DORMANT sampai
   *  Epic 3 mengimplementasikan param link ?ref= (keputusan owner
   *  2026-09-18); null = mendaftar tanpa referral. */
  usedReferralCode: text('used_referral_code'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  /**
   * Penolakan wajib beralasan (Story 1.6, FR-22): status `ditolak` TANPA
   * `rejection_reason` non-kosong (setelah btrim) ditolak di level DB —
   * divalidasi handler/service dan ditegakkan sekali lagi di sini.
   */
  check(
    'owners_ditolak_wajib_rejection_reason',
    sql`(${t.status} <> 'ditolak' OR (${t.rejectionReason} IS NOT NULL AND btrim(${t.rejectionReason}) <> ''))`,
  ),
])

/**
 * IDENTITY — owner_emergency_contacts (normalisasi owner 2026-09-18): entitas
 * ORANG kontak darurat (Lampiran A #5–7), 1:1 dengan owner — PK `owner_id`
 * menegakkan maksimum satu baris per owner + integritas FK. Tanpa kolom
 * timestamp: perubahan selalu satu tx dengan `owners.updated_at`.
 */
export const ownerEmergencyContacts = pgTable('owner_emergency_contacts', {
  ownerId: uuid('owner_id')
    .primaryKey()
    .references(() => owners.id),
  /** Lampiran A #5 — nama orang kontak darurat. */
  name: text('name'),
  /** Lampiran A #6. */
  phoneNumber: text('phone_number'),
  /** Lampiran A #7 — enum `DAFTAR_HUBUNGAN` (nilai Indonesia, shared/domain/profil). */
  relationship: text('relationship'),
})

/**
 * IDENTITY — owner_bank_accounts (normalisasi owner 2026-09-18): entitas
 * REKENING bank pencairan (Lampiran A #8–10), 1:1 dengan owner — PK
 * `owner_id` menegakkan maksimum satu baris per owner. `bank_name` menyimpan
 * SATU nilai: nama bank dari combobox (enum 7 bank) ATAU teks bebas dari
 * input "Bank Lainnya" (derivation `namaBankKeTersimpan`/`namaBankKeWire`
 * shared/domain/profil — tanpa kolom other-bank bersyarat).
 */
export const ownerBankAccounts = pgTable('owner_bank_accounts', {
  ownerId: uuid('owner_id')
    .primaryKey()
    .references(() => owners.id),
  /** Lampiran A #8 — nilai enum bank ATAU teks bebas "Bank Lainnya". */
  bankName: text('bank_name'),
  /** Lampiran A #9 — bisa berbeda dari nama owner. */
  accountHolderName: text('account_holder_name'),
  /** Lampiran A #10 — string digit/tanda minus (AD-10), bukan number. */
  accountNumber: text('account_number'),
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
export type OwnerEmergencyContact = typeof ownerEmergencyContacts.$inferSelect
export type NewOwnerEmergencyContact = typeof ownerEmergencyContacts.$inferInsert
export type OwnerBankAccount = typeof ownerBankAccounts.$inferSelect
export type NewOwnerBankAccount = typeof ownerBankAccounts.$inferInsert
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


/**
 * Enum status MoM — dipinkan FR-7/Story 2.1 (himpunan tertutup).
 * `draft` dapat diedit/dihapus; `final` imutabel.
 */
export const momStatus = pgEnum('mom_status', MOM_STATUSES)

/**
 * PRICING — moms (AD-5/FR-7): notulen MRO/RUPS. Status `draft` dapat
 * diedit/dihapus; `final` imutabel. Tanggal `held_at` WAJIB (FR-7: "MoM
 * tersimpan dengan tanggal"). Modus tulis langsung = `content_text` terisi,
 * `pdf_path` NULL (Story 2.1); upload PDF = `pdf_path` terisi (Story 2.2).
 *
 * Hanya modul PRICING yang MENULIS tabel ini (AD-5); modul lain membaca
 * lewat API publik `server/domain/pricing/index.ts`. Entry audit ditulis
 * dalam transaksi yang sama dengan aksinya (AD-3).
 */
export const moms = pgTable(
  'moms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Tanggal meeting diadakan — WAJIB; timestamptz UTC, zona Jakarta saat tampil. */
    heldAt: timestamp('held_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: momStatus('status').notNull().default('draft'),
    /** Konten teks modus tulis langsung; NULL bila upload PDF (Story 2.2). */
    contentText: text('content_text'),
    /** Path PDF di storage; NULL untuk modus tulis langsung (Story 2.1). */
    pdfPath: text('pdf_path'),
    /** Waktu finalisasi; di-set saat status berubah draft → final. */
    finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    index('moms_held_at_idx').on(t.heldAt),
    index('moms_status_idx').on(t.status),
  ],
)

export type Mom = typeof moms.$inferSelect
export type NewMom = typeof moms.$inferInsert
