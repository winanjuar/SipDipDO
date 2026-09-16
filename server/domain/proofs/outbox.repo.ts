/**
 * PROOFS — repo outbox: satu-satunya tempat query Drizzle untuk tabel
 * `outbox_emails` (AD-5). Semua fungsi menerima `DbClient` (db atau tx).
 */
import { and, asc, eq, lte, sql } from 'drizzle-orm'
import { outboxEmails, type OutboxEmail } from '../../../drizzle/schema'
import type { DbClient } from '../../utils/db'

export interface EnqueueOutboxInput {
  kind: string
  to: string
  payload: Record<string, unknown>
}

/** Tulis baris outbox — SELALU dipanggil di dalam transaksi aksi terkait (AR-6). */
export async function enqueueOutboxEmail(db: DbClient, input: EnqueueOutboxInput): Promise<OutboxEmail> {
  const rows = await db
    .insert(outboxEmails)
    .values({ kind: input.kind, toAddress: input.to, payload: input.payload })
    .returning()
  return rows[0]
}

/** Baris yang jatuh tempo dikirim (pending dan sudah lewat sendAfter). */
export function listDueOutboxEmails(db: DbClient, now: Date, limit: number): Promise<OutboxEmail[]> {
  return db
    .select()
    .from(outboxEmails)
    .where(
      and(
        eq(outboxEmails.status, 'pending'),
        lte(outboxEmails.sendAfter, now.toISOString()),
      ),
    )
    .orderBy(asc(outboxEmails.createdAt))
    .limit(limit)
}

/**
 * Tandai terkirim — HANYA bila baris masih `pending` (guard status): dispatcher
 * tumpang-tindih yang kembali `undefined` tahu barisnya sudah ditangani penulis
 * lain, bukan menandai ganda.
 */
export function markOutboxEmailSent(db: DbClient, id: string, sentAt: Date): Promise<OutboxEmail | undefined> {
  return db
    .update(outboxEmails)
    .set({ status: 'sent', sentAt: sentAt.toISOString(), lastError: null })
    .where(and(eq(outboxEmails.id, id), eq(outboxEmails.status, 'pending')))
    .returning()
    .then(rows => rows[0])
}

/**
 * Catat kegagalan percobaan dengan compare-and-set atas `attempts` yang dibaca —
 * dua dispatcher konkuren tidak pernah menggandakan retry. `attempts` yang baru
 * dan `status: 'exhausted'` (retry habis) ditulis atomik.
 */
export function markOutboxEmailAttemptFailed(
  db: DbClient,
  input: { id: string, readAttempts: number, lastError: string, sendAfter: Date, maxAttempts: number },
): Promise<OutboxEmail | undefined> {
  const nextAttempts = input.readAttempts + 1
  const exhausted = nextAttempts >= input.maxAttempts
  return db
    .update(outboxEmails)
    .set({
      attempts: nextAttempts,
      status: exhausted ? 'exhausted' : 'pending',
      lastError: input.lastError,
      sendAfter: input.sendAfter.toISOString(),
    })
    .where(and(eq(outboxEmails.id, input.id), eq(outboxEmails.attempts, input.readAttempts)))
    .returning()
    .then(rows => rows[0])
}

/** Jumlah baris per status — pemantauan kesehatan outbox (kegagalan terlihat, R-009). */
export function countOutboxByEmailStatus(db: DbClient): Promise<{ status: string, count: number }[]> {
  return db
    .select({ status: outboxEmails.status, count: sql<number>`count(*)::int` })
    .from(outboxEmails)
    .groupBy(outboxEmails.status)
}
