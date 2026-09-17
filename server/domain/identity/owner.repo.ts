/**
 * IDENTITY — repo: satu-satunya tempat query Drizzle untuk tabel milik modul
 * `owners` & `coo_tenures` (AD-5). Semua fungsi menerima `DbClient` (db atau
 * tx). Status owner adalah enum AD-11 — HANYA modul ini yang menulisnya;
 * transisi SELALU compare-and-set atas status sebelumnya (penulis transisi
 * pendaftaran/verifikasi menyusul Story 1.4/1.6 lewat fungsi repo CAS ini).
 *
 * Konvensi tabel (spine): email UNIQUE (re-daftar = baris yang sama, AD-11);
 * `first_effective_at` di-set HANYA oleh event Pembelian Pertama efektif.
 */
import { and, eq, isNull, lte, or, gt, sql } from 'drizzle-orm'
import { cooTenures, owners } from '../../../drizzle/schema'
import type { OwnerStatus } from '../../../shared/domain/identity'
import type { DbClient } from '../../utils/db'
import type { IdentityRepoPort } from './access.service'

/** Baris owner yang dipakai keputusan role — bentuk minimal terkontrak. */
export interface OwnerRecord {
  id: string
  email: string
  status: OwnerStatus
  rejectionReason: string | null
  firstEffectiveAt: string | null
}

/** Cari owner berdasar email sesi Google (pencocokan email migrasi — AD-8). */
export async function findOwnerByEmail(db: DbClient, email: string): Promise<OwnerRecord | null> {
  const rows = await db
    .select({
      id: owners.id,
      email: owners.email,
      status: owners.status,
      rejectionReason: owners.rejectionReason,
      firstEffectiveAt: owners.firstEffectiveAt,
    })
    .from(owners)
    .where(eq(owners.email, email))
    .limit(1)
  return rows[0] ?? null
}

/**
 * true bila owner punya tenure COO yang BERLAKU pada `now` — started_at <= now
 * DAN (ended_at IS NULL OR ended_at > now). Sumber otoritas kewenangan COO
 * (AD-8); kewenangan in-tx untuk finalisasi memakai fungsi ini dengan tx.
 */
export async function findActiveCooTenure(db: DbClient, ownerId: string, now: Date): Promise<boolean> {
  const rows = await db
    .select({ id: cooTenures.id })
    .from(cooTenures)
    .where(
      and(
        eq(cooTenures.ownerId, ownerId),
        lte(cooTenures.startedAt, now.toISOString()),
        or(isNull(cooTenures.endedAt), gt(cooTenures.endedAt, now.toISOString())),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** Tulis-ulang baris owner berdasar email unik (re-daftar = baris sama, AD-11). */
export async function upsertOwnerByEmail(
  db: DbClient,
  input: { email: string, status: OwnerStatus, rejectionReason: string | null, firstEffectiveAt: string | null },
): Promise<OwnerRecord> {
  const rows = await db
    .insert(owners)
    .values({
      email: input.email,
      status: input.status,
      rejectionReason: input.rejectionReason,
      firstEffectiveAt: input.firstEffectiveAt,
    })
    .onConflictDoUpdate({
      target: owners.email,
      set: {
        status: input.status,
        rejectionReason: input.rejectionReason,
        firstEffectiveAt: input.firstEffectiveAt,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning({
      id: owners.id,
      email: owners.email,
      status: owners.status,
      rejectionReason: owners.rejectionReason,
      firstEffectiveAt: owners.firstEffectiveAt,
    })
  const written = rows[0]
  if (!written) throw new Error('upsertOwnerByEmail: baris owner tidak kembali dari upsert.')
  return written
}

/** Buka tenure COO baru — ATOMIK: satu statement INSERT..SELECT WHERE NOT
 *  EXISTS (tenure berlaku), sehingga mint paralel tidak pernah membuat
 *  tenure COO aktif bertumpuk untuk owner yang sama. */
export async function openCooTenure(db: DbClient, ownerId: string, now: Date): Promise<void> {
  const nowIso = now.toISOString()
  await db.execute(sql`
    INSERT INTO coo_tenures (owner_id, started_at)
    SELECT ${ownerId}::uuid, ${nowIso}::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM coo_tenures
      WHERE owner_id = ${ownerId}::uuid
        AND started_at <= ${nowIso}::timestamptz
        AND (ended_at IS NULL OR ended_at > ${nowIso}::timestamptz)
    )
  `)
}

/** Tutup seluruh tenure COO yang masih berjalan — dipakai seeding uji. */
export async function closeActiveCooTenures(db: DbClient, ownerId: string, now: Date): Promise<void> {
  await db
    .update(cooTenures)
    .set({ endedAt: now.toISOString() })
    .where(and(eq(cooTenures.ownerId, ownerId), isNull(cooTenures.endedAt)))
}

/** Dirikan port repo identity di atas Drizzle — DI untuk `buildPrincipal`. */
export function createIdentityRepo(db: DbClient, now: Date = new Date()): IdentityRepoPort {
  return {
    findOwnerByEmail: (email) => findOwnerByEmail(db, email),
    findActiveCooTenure: (ownerId) => findActiveCooTenure(db, ownerId, now),
  }
}
