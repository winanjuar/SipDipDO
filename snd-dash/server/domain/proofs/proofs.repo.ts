// server/domain/proofs/proofs.repo.ts
//
// Lapisan data domain proofs (FR-11, AD-5). Dua tanggung jawab:
//
//   1. email_outbox (SATU-SATUNYA penulis kolom sentAt/attempts/lastError):
//      insertOutbox / listUnsent / markSent / markFailed. Penulisan enqueue
//      SELALU menerima handle `tx` (in-tx, AD-5); pembacaan/penandaan drain
//      memakai `db` bound-schema (post-commit, di luar transaksi aksi).
//
//   2. Pembacaan MURNI state ledger pada TITIK POTONG sebuah transaksi
//      (`cutPointForTx`) — dasar `ProofData`. Bukti = fungsi murni state ledger
//      pada titik potong transaksinya (design.md B.8): agregat Shares/Ceil per
//      Owner dihitung dari baris ledger yang efektif s.d. transaksi target
//      (deterministik → byte-identik untuk state yang sama, Property 11).
//      Pembacaan lintas tabel di sini TIDAK menulis posisi (AD-1 mengatur
//      penulisan, bukan pembacaan); ledger tetap satu-satunya penulis.
//
// Kolom email_outbox (schema.ts): id, recipient, subject, body, ledgerTxId?,
// payload jsonb, attempts int, sentAt?, lastError?, createdAt.

import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'
import type { OutboundEmail, OutboxKind, OutboxRow } from './events'

const { emailOutbox, ledgerTransactions } = schema

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// email_outbox — penulisan enqueue (in-tx) & drain (post-commit)
// ---------------------------------------------------------------------------

/** Nilai INSERT satu baris `email_outbox`. */
export interface InsertOutbox {
  recipient: string
  subject: string
  body: string | null
  ledgerTxId?: Uuid | null
  payload: Record<string, unknown>
}

/**
 * Menyisipkan satu baris outbox DI DALAM transaksi `tx` (AD-5). Dipakai baik
 * oleh `enqueueProof` (kind 'proof', membawa `ledgerTxId`) maupun `enqueueEmail`
 * (kind 'notification'). Tak pernah membuka transaksi sendiri.
 */
export async function insertOutbox(tx: Tx, values: InsertOutbox): Promise<void> {
  await tx.insert(emailOutbox).values({
    recipient: values.recipient,
    subject: values.subject,
    body: values.body,
    ledgerTxId: values.ledgerTxId ?? null,
    payload: values.payload,
  })
}

/** Membangun payload outbox untuk email generik (`enqueueEmail`). */
export function notificationPayload(email: OutboundEmail): Record<string, unknown> {
  const kind: OutboxKind = 'notification'
  return { kind, ...(email.payload ?? {}) }
}

/** Membangun payload outbox untuk Bukti Transaksi (`enqueueProof`). */
export function proofPayload(ledgerTxId: Uuid): Record<string, unknown> {
  const kind: OutboxKind = 'proof'
  return { kind, ledgerTxId }
}

function toOutboxRow(r: typeof emailOutbox.$inferSelect): OutboxRow {
  return {
    id: r.id as Uuid,
    recipient: r.recipient,
    subject: r.subject,
    body: r.body,
    ledgerTxId: (r.ledgerTxId as Uuid | null) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    attempts: r.attempts,
    sentAt: r.sentAt,
    lastError: r.lastError,
    createdAt: r.createdAt,
  }
}

/**
 * Membaca baris outbox yang belum terkirim (`sentAt IS NULL`), terlama lebih
 * dulu (FIFO), dibatasi `limit`. Pembacaan drain memakai `db` bound-schema.
 */
export async function listUnsent(limit: number): Promise<OutboxRow[]> {
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(isNull(emailOutbox.sentAt))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(limit)
  return rows.map(toOutboxRow)
}

/** Menandai satu baris outbox terkirim (`sentAt = now`). Post-commit (drain). */
export async function markSent(id: Uuid): Promise<void> {
  await db
    .update(emailOutbox)
    .set({ sentAt: new Date() })
    .where(eq(emailOutbox.id, id))
}

/**
 * Menandai satu baris outbox gagal: naikkan `attempts` + set `lastError`.
 * TIDAK men-set `sentAt` (tetap layak retry pada drain berikutnya). Post-commit.
 */
export async function markFailed(id: Uuid, error: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      attempts: sql`${emailOutbox.attempts} + 1`,
      lastError: error,
    })
    .where(eq(emailOutbox.id, id))
}

/**
 * Meresolusi recipient dari baris outbox bila kosong (Bukti kadang di-enqueue
 * tanpa recipient — diresolve saat drain, catatan FR-11). Menyimpan recipient
 * yang teresolusi agar tampil pada baris. Post-commit.
 */
export async function setRecipient(id: Uuid, recipient: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({ recipient })
    .where(eq(emailOutbox.id, id))
}

// ---------------------------------------------------------------------------
// Pembacaan MURNI state ledger pada titik potong transaksi (dasar ProofData)
// ---------------------------------------------------------------------------

/** Baris `ledger_transactions` minimal yang dibutuhkan perakitan Bukti. */
export interface LedgerTxRow {
  id: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  shares: number
  ceil: number
  finalPrice: MoneyString
  paymentDate: JakartaDate
  effectiveAt: Date
}

/** Agregat titik potong: total Shares/Ceil per Owner + grand total Shares. */
export interface CutPointAggregates {
  /** Σ Shares Owner target (gabungan semua Capital Type) s.d. titik potong. */
  ownerTotalShares: number
  /** Σ Ceil Owner target (gabungan semua Capital Type) s.d. titik potong. */
  ownerTotalCeil: number
  /** Σ Shares SELURUH Owner s.d. titik potong (basis Portion). */
  grandTotalShares: number
}

/**
 * Membaca satu baris `ledger_transactions` berdasarkan `id` (pembacaan murni).
 * Mengembalikan `null` bila tak ada.
 */
export async function getLedgerTx(
  reader: Reader,
  id: Uuid,
): Promise<LedgerTxRow | null> {
  const rows = await reader
    .select({
      id: ledgerTransactions.id,
      ownerId: ledgerTransactions.ownerId,
      capitalType: ledgerTransactions.capitalType,
      quantity: ledgerTransactions.quantity,
      shares: ledgerTransactions.shares,
      ceil: ledgerTransactions.ceil,
      finalPrice: ledgerTransactions.finalPrice,
      paymentDate: ledgerTransactions.paymentDate,
      effectiveAt: ledgerTransactions.effectiveAt,
    })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, id))
    .limit(1)

  const r = rows[0]
  if (!r) return null
  return {
    id: r.id as Uuid,
    ownerId: r.ownerId as Uuid,
    capitalType: r.capitalType,
    quantity: r.quantity,
    shares: r.shares,
    ceil: r.ceil,
    finalPrice: r.finalPrice as MoneyString,
    paymentDate: r.paymentDate as JakartaDate,
    effectiveAt: r.effectiveAt,
  }
}

/**
 * Menghitung agregat state ledger pada TITIK POTONG transaksi `target`
 * (pembacaan MURNI, deterministik). "Titik potong" = himpunan baris ledger yang
 * efektif s.d. transaksi target, didefinisikan sebagai baris dengan
 * `effectiveAt < target.effectiveAt` ATAU (`effectiveAt = target.effectiveAt`
 * DAN `id <= target.id`) — pengurutan total & stabil sehingga regenerasi selalu
 * identik (Property 11), tidak terpengaruh transaksi setelahnya.
 *
 * Σ Shares/Ceil dijumlahkan langsung dari `ledger_transactions` (append-only,
 * termasuk baris kompensasi bertanda negatif → net-off benar). Grand total
 * Shares mencakup SELURUH Owner pada titik potong yang sama (basis Portion).
 */
export async function cutPointAggregates(
  reader: Reader,
  target: LedgerTxRow,
): Promise<CutPointAggregates> {
  // Predikat titik potong (pengurutan total: effectiveAt lalu id). Baris pada
  // instant yang sama namun id > target dikecualikan agar deterministik.
  const withinCut = and(
    lte(ledgerTransactions.effectiveAt, target.effectiveAt),
    or(
      sql`${ledgerTransactions.effectiveAt} < ${target.effectiveAt}`,
      sql`${ledgerTransactions.id} <= ${target.id}`,
    ),
  )

  // Grand total Shares seluruh owner pada titik potong.
  const grandRows = await reader
    .select({
      grand: sql<string>`coalesce(sum(${ledgerTransactions.shares}), 0)`,
    })
    .from(ledgerTransactions)
    .where(withinCut)
  const grandTotalShares = Number(grandRows[0]?.grand ?? 0)

  // Total Shares/Ceil owner target pada titik potong.
  const ownerRows = await reader
    .select({
      shares: sql<string>`coalesce(sum(${ledgerTransactions.shares}), 0)`,
      ceil: sql<string>`coalesce(sum(${ledgerTransactions.ceil}), 0)`,
    })
    .from(ledgerTransactions)
    .where(and(withinCut, eq(ledgerTransactions.ownerId, target.ownerId)))

  return {
    ownerTotalShares: Number(ownerRows[0]?.shares ?? 0),
    ownerTotalCeil: Number(ownerRows[0]?.ceil ?? 0),
    grandTotalShares,
  }
}
