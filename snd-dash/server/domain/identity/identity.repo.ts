// server/domain/identity/identity.repo.ts
//
// Lapisan data IDENTITY: query Drizzle untuk `owners`/`profiles`/`positions`.
//
// Repo ini murni menerjemahkan operasi ke query; orkestrasi, CAS, dan validasi
// in-tx berada di `identity.service.ts`. Transisi status memakai compare-and-set
// (WHERE status = expected) sehingga transisi ilegal / balapan ditolak tanpa
// mengubah baris (AD-11). Penulisan yang berpartisipasi dalam transaksi lintas
// modul menerima handle `tx: Tx` dan TIDAK membuka transaksi sendiri (AD-2).

import { and, eq, gt, isNull, lte, ne, or, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { OwnerLifecycle, Uuid } from '../../../shared/domain/types'
import type { CooTenure, Owner, ReferralChoice } from './events'

const { owners, profiles, positions, roles, cooTenures } = schema

/** Pembaca yang menerima instance `db` bound-schema maupun handle `tx`. */
type Reader = Pick<Tx, 'select'>

/** Memetakan baris `owners` ke entitas domain `Owner`. */
function toOwner(row: typeof owners.$inferSelect): Owner {
  return {
    id: row.id as Uuid,
    email: row.email,
    name: row.name,
    status: row.status as OwnerLifecycle,
    firstEffectiveAt: row.firstEffectiveAt,
    rejectionReason: row.rejectionReason,
  }
}

/** Mengambil satu Owner berdasarkan id; `null` bila tidak ada. */
export async function findById(
  reader: Reader,
  ownerId: Uuid,
): Promise<Owner | null> {
  const rows = await reader
    .select()
    .from(owners)
    .where(eq(owners.id, ownerId))
    .limit(1)
  return rows.length > 0 ? toOwner(rows[0]!) : null
}

/** Mengambil satu Owner berdasarkan email (unik, AD-7); `null` bila tidak ada. */
export async function findByEmail(
  reader: Reader,
  email: string,
): Promise<Owner | null> {
  const rows = await reader
    .select()
    .from(owners)
    .where(eq(owners.email, email))
    .limit(1)
  return rows.length > 0 ? toOwner(rows[0]!) : null
}

/** Menyisipkan Owner baru berstatus 'diajukan' (pendaftaran mandiri, FR-22). */
export async function insertOwner(
  tx: Tx,
  input: { email: string; name?: string | null },
): Promise<Owner> {
  const rows = await tx
    .insert(owners)
    .values({
      email: input.email,
      name: input.name ?? null,
      status: 'diajukan',
    })
    .returning()
  return toOwner(rows[0]!)
}

/** Membuat baris Profile kosong (belum lengkap) untuk Owner baru (FR-22 §22.4). */
export async function insertEmptyProfile(tx: Tx, ownerId: Uuid): Promise<void> {
  await tx.insert(profiles).values({ ownerId, isComplete: false })
}

/**
 * Transisi status compare-and-set (AD-11).
 *
 * Meng-update `owners.status` ke `to` HANYA bila status saat ini `from`, plus
 * patch kolom terkait (`patch`). Mengembalikan jumlah baris terpengaruh: 1 bila
 * transisi sah, 0 bila status prior tidak cocok (transisi ilegal / balapan).
 */
export async function casStatus(
  tx: Tx,
  ownerId: Uuid,
  from: OwnerLifecycle,
  to: OwnerLifecycle,
  patch: Partial<{
    firstEffectiveAt: Date | null
    rejectionReason: string | null
  }> = {},
): Promise<number> {
  const rows = await tx
    .update(owners)
    .set({ status: to, updatedAt: new Date(), ...patch })
    .where(and(eq(owners.id, ownerId), eq(owners.status, from)))
    .returning({ id: owners.id })
  return rows.length
}

/**
 * Menandai first_effective_at (event Pembelian Pertama) idempoten (FR-15 §15.8).
 *
 * Hanya menyetel bila masih NULL agar pembelian efektif berikutnya tidak
 * menggeser stempel waktu pertama. Mengembalikan 1 bila baru diset, 0 bila sudah
 * pernah efektif sebelumnya. Tidak mengubah lifecycle di sini — pembukaan akses
 * penuh dihitung dari `firstEffectiveAt` oleh `aksesPenuh`.
 */
export async function setFirstEffectiveAt(
  tx: Tx,
  ownerId: Uuid,
  at: Date,
): Promise<number> {
  const rows = await tx
    .update(owners)
    .set({ firstEffectiveAt: at, updatedAt: new Date() })
    .where(and(eq(owners.id, ownerId), isNull(owners.firstEffectiveAt)))
    .returning({ id: owners.id })
  return rows.length
}

/**
 * Pendaftar dengan Profile BELUM lengkap (basis siklus hidup pendaftar, FR-22
 * §22.5/§22.6). Mengembalikan Owner berstatus 'diajukan' yang `profiles.isComplete`
 * = false (atau tanpa baris Profile → dianggap belum lengkap via LEFT JOIN +
 * coalesce), disertai `submittedAt` (= `owners.created_at`, tanggal pengajuan)
 * dan `reminderSentAt` untuk idempotensi pengingat H-3 (§22.5, kirim tepat satu).
 *
 * Read-only; menerima `tx` cron. Pendaftar yang Profile-nya sudah lengkap tidak
 * dikembalikan (mereka menanti verifikasi COO, bukan pengingat/kedaluwarsa).
 */
export async function listIncompleteRegistrants(
  reader: Reader,
): Promise<
  Array<{
    ownerId: Uuid
    email: string
    name: string | null
    submittedAt: Date
    reminderSentAt: Date | null
  }>
> {
  const rows = await reader
    .select({
      ownerId: owners.id,
      email: owners.email,
      name: owners.name,
      submittedAt: owners.createdAt,
      reminderSentAt: owners.reminderSentAt,
      isComplete: sql<boolean>`coalesce(${profiles.isComplete}, false)`,
    })
    .from(owners)
    .leftJoin(profiles, eq(profiles.ownerId, owners.id))
    .where(eq(owners.status, 'diajukan'))

  return rows
    .filter((r) => r.isComplete !== true)
    .map((r) => ({
      ownerId: r.ownerId as Uuid,
      email: r.email,
      name: r.name,
      submittedAt: r.submittedAt,
      reminderSentAt: r.reminderSentAt,
    }))
}

/**
 * Menandai bahwa email pengingat H-3 telah dikirim untuk `ownerId` secara
 * IDEMPOTEN (hanya bila `reminder_sent_at` masih NULL). Mengembalikan 1 bila
 * baru diset (belum pernah dikirim → boleh enqueue email), 0 bila sudah pernah
 * (jangan kirim ulang, §22.5 "satu email pengingat"). In-tx cron.
 */
export async function markReminderSent(
  tx: Tx,
  ownerId: Uuid,
  at: Date,
): Promise<number> {
  const rows = await tx
    .update(owners)
    .set({ reminderSentAt: at, updatedAt: new Date() })
    .where(and(eq(owners.id, ownerId), isNull(owners.reminderSentAt)))
    .returning({ id: owners.id })
  return rows.length
}

/** Kelengkapan Profile Owner (FR-22 §22.4). `false` bila Profile tak ada. */
export async function isProfileComplete(
  reader: Reader,
  ownerId: Uuid,
): Promise<boolean> {
  const rows = await reader
    .select({ isComplete: profiles.isComplete })
    .from(profiles)
    .where(eq(profiles.ownerId, ownerId))
    .limit(1)
  return rows.length > 0 ? rows[0]!.isComplete : false
}

/**
 * Total shares terkini seorang Owner lintas seluruh Capital Type (proyeksi
 * `positions`, AD-4). Dipakai `markExit` untuk re-validasi shares = 0 in-tx.
 */
export async function sumShares(reader: Reader, ownerId: Uuid): Promise<number> {
  const rows = await reader
    .select({
      total: sql<number>`coalesce(sum(${positions.shares}), 0)::int`,
    })
    .from(positions)
    .where(eq(positions.ownerId, ownerId))
  return rows.length > 0 ? Number(rows[0]!.total) : 0
}

/**
 * Kandidat referral yang sah (FR-22 §22.8): Owner eksisting pemegang saham
 * (shares > 0, termasuk COO) ATAU Owner yang belum pernah membeli
 * (firstEffectiveAt IS NULL) dan tidak berstatus ditolak/kedaluwarsa.
 *
 * Owner berstatus 'keluar' (pernah punya saham lalu Keluar) tidak memenuhi
 * kedua kriteria dan otomatis tidak muncul.
 */
export async function listReferralChoices(
  reader: Reader,
): Promise<ReferralChoice[]> {
  const rows = await reader
    .select({
      ownerId: owners.id,
      name: owners.name,
      email: owners.email,
      status: owners.status,
      firstEffectiveAt: owners.firstEffectiveAt,
      shares: sql<number>`coalesce(sum(${positions.shares}), 0)::int`,
    })
    .from(owners)
    .leftJoin(positions, eq(positions.ownerId, owners.id))
    .where(and(ne(owners.status, 'ditolak'), ne(owners.status, 'kedaluwarsa')))
    .groupBy(owners.id, owners.name, owners.email, owners.status, owners.firstEffectiveAt)

  return rows
    .map((r) => ({
      ownerId: r.ownerId as Uuid,
      name: r.name,
      email: r.email,
      shares: Number(r.shares),
      neverPurchased: r.firstEffectiveAt === null,
    }))
    .filter((r) => r.shares > 0 || r.neverPurchased)
    .map(
      (r): ReferralChoice => ({
        ownerId: r.ownerId,
        name: r.name,
        email: r.email,
        isShareholder: r.shares > 0,
      }),
    )
}

// ---------------------------------------------------------------------------
// Otoritas COO — coo_tenures & roles (FR-17, AD-8)
// ---------------------------------------------------------------------------

/** Memetakan baris `coo_tenures` ke entitas domain `CooTenure`. */
function toCooTenure(row: typeof cooTenures.$inferSelect): CooTenure {
  return {
    id: row.id as Uuid,
    ownerId: row.ownerId as Uuid,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    momRef: (row.momRef as Uuid | null) ?? null,
  }
}

/**
 * Tenure COO milik `ownerId` yang AKTIF pada waktu `at`; `null` bila tidak ada.
 *
 * Aktif bila `startedAt <= at` DAN (`endedAt IS NULL` ATAU `endedAt > at`).
 * Dipakai `assertCooAt` untuk memverifikasi COO yang bertugas in-tx (AD-8).
 */
export async function findActiveTenure(
  reader: Reader,
  ownerId: Uuid,
  at: Date,
): Promise<CooTenure | null> {
  const rows = await reader
    .select()
    .from(cooTenures)
    .where(
      and(
        eq(cooTenures.ownerId, ownerId),
        lte(cooTenures.startedAt, at),
        or(isNull(cooTenures.endedAt), gt(cooTenures.endedAt, at)),
      ),
    )
    .limit(1)
  return rows.length > 0 ? toCooTenure(rows[0]!) : null
}

/**
 * Mengakhiri semua tenure COO aktif milik `ownerId` (set `endedAt = at`).
 * Mengembalikan jumlah baris terpengaruh (umumnya 1). Dipakai `transferCoo`.
 */
export async function endActiveTenures(
  tx: Tx,
  ownerId: Uuid,
  at: Date,
): Promise<number> {
  const rows = await tx
    .update(cooTenures)
    .set({ endedAt: at })
    .where(and(eq(cooTenures.ownerId, ownerId), isNull(cooTenures.endedAt)))
    .returning({ id: cooTenures.id })
  return rows.length
}

/**
 * Membuka tenure COO baru untuk `ownerId` (startedAt = at, momRef).
 * Mengembalikan `CooTenure` yang dibuat. Dipakai `transferCoo`.
 */
export async function openTenure(
  tx: Tx,
  ownerId: Uuid,
  at: Date,
  momRef: Uuid,
): Promise<CooTenure> {
  const rows = await tx
    .insert(cooTenures)
    .values({ ownerId, startedAt: at, momRef })
    .returning()
  return toCooTenure(rows[0]!)
}

/**
 * Menambahkan peran `role` pada `ownerId` secara idempoten (unique owner+role).
 * `ON CONFLICT DO NOTHING` menjaga operasi aman diulang tanpa error duplikat.
 */
export async function addRole(
  tx: Tx,
  ownerId: Uuid,
  role: 'calon_owner' | 'owner' | 'coo',
): Promise<void> {
  await tx
    .insert(roles)
    .values({ ownerId, role })
    .onConflictDoNothing({ target: [roles.ownerId, roles.role] })
}

/**
 * Mencabut peran `role` dari `ownerId` (hapus baris roles owner+role).
 * Dipakai `transferCoo` untuk mencabut akses transaksional COO lama (FR-17 §17.2).
 */
export async function removeRole(
  tx: Tx,
  ownerId: Uuid,
  role: 'calon_owner' | 'owner' | 'coo',
): Promise<void> {
  await tx
    .delete(roles)
    .where(and(eq(roles.ownerId, ownerId), eq(roles.role, role)))
}
