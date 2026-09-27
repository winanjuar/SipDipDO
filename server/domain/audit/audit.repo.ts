/**
 * AUDIT — repo: satu-satunya tempat query Drizzle untuk `audit_logs` (AD-5).
 * INSERT-only untuk tulis (separuh penegakan "tanpa jalur UPDATE/DELETE";
 * separuh lainnya DB grants — drizzle/grants.sql) dan SELECT urut
 * `created_at` desc untuk tampilan COO (FR-12). Seluruh fungsi menerima
 * `DbClient` (db atau tx) — penulisan selalu join transaksi pemanggil (AD-3).
 */
import { and, count, desc, eq } from 'drizzle-orm'
import { auditLogs, owners } from '../../../drizzle/schema'
import type { DbClient } from '../../utils/db'

/** Baris tulis entry audit — pemetaan envelope AD-3 ke kolom DB. */
export interface AuditEntryRow {
  action: string
  /** Null = aktor system (envelope AD-3: `actor_owner_id` null = system). */
  actorOwnerId: string | null
  target: string | null
  details: Record<string, unknown>
}

/** Baris baca entry audit untuk tampilan COO — email aktor di-join untuk display. */
export interface AuditEntryRecord {
  id: string
  action: string
  actorOwnerId: string | null
  actorEmail: string | null
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

/** Paging offset — `limit` konstanta bernama milik service (terpin spec: 100). */
export interface AuditPaging {
  limit: number
  offset: number
}

/** Hasil baca paging: `nextPage` null berarti habis (matriks I/O spec 1.3). */
export interface AuditDaftarRepo {
  data: AuditEntryRecord[]
  nextPage: number | null
}

/**
 * Sisipkan satu entry audit DI DALAM transaksi `tx` (AD-3) — INSERT saja;
 * tidak ada jalur UPDATE/DELETE di modul ini maupun di DB (grants).
 */
export async function insertAuditEntry(tx: DbClient, row: AuditEntryRow): Promise<void> {
  await tx.insert(auditLogs).values({
    action: row.action,
    actorOwnerId: row.actorOwnerId,
    target: row.target,
    details: row.details,
  })
}

/**
 * Baca audit trail terbaru lebih dulu (matriks I/O spec 1.3): urut
 * `created_at` desc dengan tiebreaker `id` desc — entry dalam satu transaksi
 * berbagi `now()` yang sama, dan paging offset butuh urutan total yang
 * deterministik agar tiap halaman konsisten. Satu baris ekstra di-fetch
 * sebagai probe hasNext agar `nextPage` tepat null PERSIS saat habis —
 * tanpa halaman kosong.
 */
export async function listAuditEntries(db: DbClient, paging: AuditPaging): Promise<AuditDaftarRepo> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorOwnerId: auditLogs.actorOwnerId,
      actorEmail: owners.email,
      target: auditLogs.target,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(owners, eq(auditLogs.actorOwnerId, owners.id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(paging.limit + 1)
    .offset(paging.offset)

  const hasMore = rows.length > paging.limit
  const data = (hasMore ? rows.slice(0, paging.limit) : rows).map(
    (row): AuditEntryRecord => ({
      id: row.id,
      action: row.action,
      actorOwnerId: row.actorOwnerId,
      actorEmail: row.actorEmail,
      target: row.target,
      details: row.details,
      createdAt: row.createdAt,
    }),
  )

  const halaman = Math.trunc(paging.offset / paging.limit) + 1
  return { data, nextPage: hasMore ? halaman + 1 : null }
}

/**
 * Hitung entry audit untuk satu pasangan (action, target) — Story 1.6:
 * service identity menghitung `details.hitunganPenolakan` (jumlah entry
 * `pendaftaran-penolakan` untuk owner) DI DALAM transaksi keputusan yang
 * sama (AD-5: baca lintas modul lewat API publik modul audit, bukan tabel
 * tetangga). Menerima `DbClient` (db atau tx) — pemanggil in-tx menyodokkan
 * tx agar hitungan konsisten dengan entry yang sedang ditulis.
 */
export async function hitungEntryAksi(
  db: DbClient,
  filter: { action: string, target: string },
): Promise<number> {
  const rows = await db
    .select({ jumlah: count() })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, filter.action), eq(auditLogs.target, filter.target)))
  return rows[0]?.jumlah ?? 0
}
