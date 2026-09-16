// server/domain/audit/audit.repo.ts
//
// Satu-satunya penulis (writer) tabel `audit_logs` (append-only, AD-3).
//
// Repo ini murni lapisan data: menerjemahkan `AuditEntry`/`AuditFilter` ke query
// Drizzle. Validasi keanggotaan aksi & aturan in-tx ada di `audit.service.ts`.
// Penulisan SELALU menerima handle `tx` (AD-2/AD-3) — tidak pernah membuka
// transaksi sendiri. Kolom `audit_logs` (schema.ts): id, actor(uuid nullable),
// action(text), target(text nullable), details(jsonb), createdAt.

import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { Uuid } from '../../../shared/domain/types'
import type { AuditEntry } from './events'

const { auditLogs } = schema

/** Baris audit sebagaimana dibaca dari `audit_logs`. */
export interface AuditLog {
  id: Uuid
  actor: Uuid | null
  action: string
  target: string | null
  details: Record<string, unknown>
  createdAt: Date
}

/**
 * Filter pembacaan audit trail untuk tampilan COO (FR-12 §12.4).
 *
 * Semua field opsional; kombinasinya digabung dengan AND. Rentang tanggal
 * memakai `createdAt` (timestamptz). `limit` membatasi jumlah baris (default 100).
 */
export interface AuditFilter {
  actor?: Uuid | null
  action?: string
  from?: Date
  to?: Date
  limit?: number
}

/** Batas default jumlah baris yang dikembalikan `listForCoo`. */
const DEFAULT_LIMIT = 100

/**
 * Menyisipkan satu entri audit DI DALAM transaksi `tx` (AD-3).
 *
 * Hanya INSERT — tak pernah UPDATE/DELETE (ditegakkan pula lewat DB grants).
 */
export async function insert(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    details: entry.details ?? {},
  })
}

/**
 * Membaca audit trail sesuai `filter`, terbaru lebih dulu (FR-12 §12.4).
 *
 * Pembacaan dijalankan di luar transaksi aksi (view COO), memakai instance `db`
 * bound-schema. Enforcement akses COO dilakukan di lapisan route.
 */
export async function query(
  db: Pick<Tx, 'select'>,
  filter: AuditFilter,
): Promise<AuditLog[]> {
  const conditions: SQL[] = []

  if (filter.actor !== undefined && filter.actor !== null) {
    conditions.push(eq(auditLogs.actor, filter.actor))
  }
  if (filter.action !== undefined) {
    conditions.push(eq(auditLogs.action, filter.action))
  }
  if (filter.from !== undefined) {
    conditions.push(gte(auditLogs.createdAt, filter.from))
  }
  if (filter.to !== undefined) {
    conditions.push(lte(auditLogs.createdAt, filter.to))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const limit = filter.limit ?? DEFAULT_LIMIT

  const rows = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)

  return rows.map(
    (r): AuditLog => ({
      id: r.id as Uuid,
      actor: (r.actor as Uuid | null) ?? null,
      action: r.action,
      target: r.target,
      details: (r.details as Record<string, unknown>) ?? {},
      createdAt: r.createdAt,
    }),
  )
}
