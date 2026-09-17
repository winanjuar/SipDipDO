/**
 * AUDIT — service audit trail (FR-12, AD-3).
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts):
 *
 *   writeAuditEntry(tx, { actor, action, target, details })
 *     — entry ditulis DALAM transaksi DB yang sama dengan aksinya (AD-3,
 *       tidak pernah async/batch); `action` divalidasi registry terpusat
 *       `shared/domain/audit.ts` SEBELUM INSERT; aktor `user` wajib membawa
 *       ownerId, `system` tanpa ownerId.
 *   listForCoo(db, page)
 *     — komposisi baca untuk tampilan COO (FR-12): paging offset, limit
 *       konstanta bernama (terpin spec: 100), urut `created_at` desc;
 *       `{ data, nextPage }` dengan `nextPage` null bila habis.
 *
 * Penegakan kewenangan COO ada di route handler (AD-8, per-request);
 * modul lain tidak membaca audit untuk keputusan bisnis (AD-3).
 */
import {
  isAuditAction,
  type AuditActor,
  type AuditEntryInput,
} from '#shared/domain/audit'
import type { DbClient } from '../../utils/db'
import { insertAuditEntry, listAuditEntries, type AuditEntryRecord } from './audit.repo'

/** LIMIT halaman baca audit — terpin spec (matriks I/O): konstanta bernama. */
export const AUDIT_PAGE_LIMIT = 100

/** Bentuk wire entry audit untuk lapis tampilan (envelope aktor AD-3). */
export interface AuditEntryWire {
  id: string
  action: string
  actor: { kind: 'user' | 'system', ownerId: string | null, email: string | null }
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

/** Respons baca audit: `nextPage` null bila habis. */
export interface AuditDaftar {
  data: AuditEntryWire[]
  nextPage: number | null
}

/**
 * Penanda handle transaksi Drizzle: hanya `Tx` yang memiliki `rollback`
 * (`Db` tidak) — menegakkan kontrak in-tx AD-3 pada batas service.
 */
function adalahTransaksi(client: unknown): boolean {
  return typeof client === 'object' && client !== null
    && 'rollback' in client
    && typeof (client as { rollback?: unknown }).rollback === 'function'
}

/** Validasi envelope aktor → kolom `actorOwnerId`; melempar bila envelope rusak. */
function aktorKeOwnerId(actor: AuditActor): string | null {
  if (actor.kind === 'user') {
    if (typeof actor.ownerId !== 'string' || actor.ownerId.length === 0) {
      throw new Error('writeAuditEntry: aktor kind "user" wajib membawa ownerId (envelope AD-3).')
    }
    return actor.ownerId
  }
  if ('ownerId' in actor && actor.ownerId !== undefined) {
    throw new Error('writeAuditEntry: aktor kind "system" tidak membawa ownerId (envelope AD-3).')
  }
  return null
}

/**
 * Tulis satu entry audit DI DALAM transaksi aksi (AD-3). Menolak (throw)
 * bila `tx` bukan handle transaksi, bila `action` di luar registry, atau
 * bila envelope aktor rusak — SELALU sebelum INSERT.
 */
export async function writeAuditEntry(tx: DbClient, input: AuditEntryInput): Promise<void> {
  if (!adalahTransaksi(tx)) {
    throw new Error(
      'writeAuditEntry wajib menerima handle transaksi (tx) — entry audit ditulis '
      + 'DALAM transaksi yang sama dengan aksinya (AD-3), tidak pernah async/batch di luar transaksi.',
    )
  }
  if (!isAuditAction(input.action)) {
    throw new Error(
      `writeAuditEntry menolak action di luar registry AUDIT_ACTIONS: "${String(input.action)}" `
      + '— daftarkan anggota baru di shared/domain/audit.ts (registry tumbuh tanpa migrasi DB).',
    )
  }
  const actorOwnerId = aktorKeOwnerId(input.actor)

  await insertAuditEntry(tx, {
    action: input.action,
    actorOwnerId,
    target: input.target,
    details: input.details,
  })
}

/** Pemetaan baris repo → bentuk wire: kolom aktor → envelope `{ kind, ownerId }`. */
function mapKeWire(row: AuditEntryRecord): AuditEntryWire {
  return {
    id: row.id,
    action: row.action,
    actor: {
      kind: row.actorOwnerId === null ? 'system' : 'user',
      ownerId: row.actorOwnerId,
      email: row.actorEmail,
    },
    target: row.target,
    details: row.details,
    createdAt: row.createdAt,
  }
}

/**
 * Baca audit trail untuk tampilan COO (FR-12): paging offset dengan limit
 * terpin spec, terbaru lebih dulu, `nextPage` null bila habis. Enforcement
 * kewenangan COO ada di route handler (AD-8).
 */
export async function listForCoo(db: DbClient, page: number): Promise<AuditDaftar> {
  const offset = (page - 1) * AUDIT_PAGE_LIMIT
  const hasil = await listAuditEntries(db, { limit: AUDIT_PAGE_LIMIT, offset })
  return { data: hasil.data.map(mapKeWire), nextPage: hasil.nextPage }
}
