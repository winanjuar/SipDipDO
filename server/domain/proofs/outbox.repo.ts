/**
 * PROOFS — repo outbox: satu-satunya tempat query Drizzle untuk tabel
 * `outbox_emails` (AD-5). Semua fungsi menerima `DbClient` (db atau tx).
 */
import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
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
  const written = rows[0]
  if (!written) throw new Error('enqueueOutboxEmail: baris outbox tidak kembali dari insert.')
  return written
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

/**
 * true bila sudah ada baris outbox `kind` untuk penerima `to` pada `hari`
 * (payload.hari) — kunci idempotensi pengingat harian (Story 1.5, AR-6):
 * dipanggil DI DALAM transaksi job sebelum insert, dua run di hari sama
 * menghasilkan satu baris.
 */
export async function adaOutboxEmail(db: DbClient, input: { kind: string, to: string, hari: string }): Promise<boolean> {
  const rows = await db
    .select({ id: outboxEmails.id })
    .from(outboxEmails)
    .where(and(
      eq(outboxEmails.kind, input.kind),
      eq(outboxEmails.toAddress, input.to),
      sql`${outboxEmails.payload}->>'hari' = ${input.hari}`,
    ))
    .limit(1)
  return rows.length > 0
}

/** Batas baris inspeksi outbox dev-only — cukup untuk verifikasi test. */
const BATAS_INSPEKSI_OUTBOX = 20

/**
 * Baris outbox terbaru untuk satu penerima (urut createdAt desc) — inspeksi
 * dev-only `GET /api/test/outbox` (Story 1.5); email TIDAK dikirim di sini.
 */
export function listOutboxEmailPenerima(db: DbClient, input: { to: string, limit?: number }): Promise<OutboxEmail[]> {
  return db
    .select()
    .from(outboxEmails)
    .where(eq(outboxEmails.toAddress, input.to))
    .orderBy(desc(outboxEmails.createdAt))
    .limit(input.limit ?? BATAS_INSPEKSI_OUTBOX)
}
