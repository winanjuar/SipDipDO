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
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
