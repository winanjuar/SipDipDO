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
import { buatKodeReferral, type OwnerStatus } from '../../../shared/domain/identity'
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

/** Hasil pendaftaran CAS: `baru` = baris baru dibuat pada panggilan ini. */
export interface HasilDaftarOwner {
  rekaman: OwnerRecord
  baru: boolean
}

/** Batas coba ulang pembuatan kode referral saat tabrakan UNIQUE (peluang
 *  per-insert ≈ n/36^8 — retry sekadar sengkang, bukan jalur normal). */
const BATAS_COBA_KODE_REFERRAL = 3

/** true bila error adalah tabrakan UNIQUE kolom referral_code (postgres 23505). */
function tabrakanKodeReferral(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505'
}

/**
 * Pendaftaran mandiri CAS idempotent per email (Story 1.4, AD-11): INSERT
 * `ON CONFLICT (email) DO NOTHING` — baris existing TIDAK PERNAH dimutasi
 * (status terverifikasi/keluar tidak pernah tertimpa). Baris baru dibuat
 * lengkap dengan kode referral miliknya (`buatKodeReferral`, keputusan owner
 * 2026-09-18 — langsung terisi meski status masih `diajukan`); tabrakan kode
 * diulang hingga `BATAS_COBA_KODE_REFERRAL`. Bila insert tidak mengembalikan
 * baris (email sudah ada), baris existing dibaca ulang via SELECT dan
 * dikembalikan apa adanya. `baru` membedakan 201 vs 200 di lapis handler.
 */
export async function daftarOwnerByEmail(db: DbClient, input: { email: string }): Promise<HasilDaftarOwner> {
  for (let percobaan = 1; ; percobaan++) {
    try {
      const disisipkan = await db
        .insert(owners)
        .values({ email: input.email, referralCode: buatKodeReferral() })
        .onConflictDoNothing({ target: owners.email })
        .returning({
          id: owners.id,
          email: owners.email,
          status: owners.status,
          rejectionReason: owners.rejectionReason,
          firstEffectiveAt: owners.firstEffectiveAt,
        })

      const barisBaru = disisipkan[0]
      if (barisBaru) return { rekaman: barisBaru, baru: true }

      const existing = await findOwnerByEmail(db, input.email)
      if (!existing) {
        throw new Error('daftarOwnerByEmail: baris owner tidak ditemukan setelah ON CONFLICT DO NOTHING.')
      }
      return { rekaman: existing, baru: false }
    } catch (error) {
      // Hanya tabrakan kode referral yang diulang — error lain (dan tabrakan
      // yang bertahan melewati batas) diteruskan apa adanya.
      if (!tabrakanKodeReferral(error) || percobaan >= BATAS_COBA_KODE_REFERRAL) throw error
    }
  }
}

/** Tulis-ulang baris owner berdasar email unik (re-daftar = baris sama, AD-11).
 *  Baris baru juga membawa kode referral (`buatKodeReferral`) — jalur mint/seed
 *  dev; tabrakan kode tidak di-retry (peluang ≈ 0, pemanggil bisa memanggil
 *  ulang). */
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
      referralCode: buatKodeReferral(),
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
