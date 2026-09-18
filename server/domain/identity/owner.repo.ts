/**
 * IDENTITY — repo: satu-satunya tempat query Drizzle untuk tabel milik modul
 * `owners`, `owner_emergency_contacts`, `owner_bank_accounts` &
 * `coo_tenures` (AD-5). Semua fungsi menerima `DbClient` (db atau
 * tx). Status owner adalah enum AD-11 — HANYA modul ini yang menulisnya;
 * transisi SELALU compare-and-set atas status sebelumnya.
 *
 * Normalisasi owner 2026-09-18: profil terbagi 3 tabel — atribut owner
 * sendiri (`full_name`/`alias`/`phone_number`) di `owners`; kontak darurat &
 * rekening bank di tabel anak 1:1 (PK `owner_id`). `OwnerRecord` berbentuk
 * WIRE (kunci English `shared/domain/profil`): nilai bank tunggal
 * `bank_name` dipetakan dua arah via `namaBankKeTersimpan`/`namaBankKeWire`.
 */
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import {
  cooTenures,
  ownerBankAccounts,
  ownerEmergencyContacts,
  owners,
} from '../../../drizzle/schema'
import { buatKodeReferral, type OwnerStatus } from '../../../shared/domain/identity'
import { namaBankKeTersimpan, namaBankKeWire, type ProfilValues } from '../../../shared/domain/profil'
import type { DbClient } from '../../utils/db'
import type { IdentityRepoPort } from './access.service'

/**
 * Baris owner bentuk WIRE yang dipakai keputusan role/kelengkapan (Story
 * 1.5) — kunci English kontrak `shared/domain/profil`; `bankName` bernilai
 * enum ATAU 'Lainnya' (+ `otherBankName` teks bebasnya), persis bentuk wire.
 */
export interface OwnerRecord {
  id: string
  email: string
  status: OwnerStatus
  rejectionReason: string | null
  firstEffectiveAt: string | null
  fullName: string | null
  alias: string | null
  phoneNumber: string | null
  emergencyContactName: string | null
  emergencyContactPhoneNumber: string | null
  emergencyContactRelationship: string | null
  bankName: string | null
  otherBankName: string | null
  accountHolderName: string | null
  accountNumber: string | null
}

/** Baris kandidat job harian pendaftaran (Story 1.5): tambah waktu submit. */
export interface BarisCalonJob extends OwnerRecord {
  createdAt: string
}

/** Kolom mentah join 3 tabel (LEFT JOIN — anak belum ada = NULL). */
interface BarisJoinOwner {
  id: string
  email: string
  status: OwnerStatus
  rejectionReason: string | null
  firstEffectiveAt: string | null
  fullName: string | null
  alias: string | null
  phoneNumber: string | null
  emergencyContactName: string | null
  emergencyContactPhoneNumber: string | null
  emergencyContactRelationship: string | null
  storedBankName: string | null
  accountHolderName: string | null
  accountNumber: string | null
}

/** Pilihan kolom join 3 tabel — dipakai semua baca OwnerRecord. */
const PILIHAN_JOIN_OWNER = {
  id: owners.id,
  email: owners.email,
  status: owners.status,
  rejectionReason: owners.rejectionReason,
  firstEffectiveAt: owners.firstEffectiveAt,
  fullName: owners.fullName,
  alias: owners.alias,
  phoneNumber: owners.phoneNumber,
  emergencyContactName: ownerEmergencyContacts.name,
  emergencyContactPhoneNumber: ownerEmergencyContacts.phoneNumber,
  emergencyContactRelationship: ownerEmergencyContacts.relationship,
  storedBankName: ownerBankAccounts.bankName,
  accountHolderName: ownerBankAccounts.accountHolderName,
  accountNumber: ownerBankAccounts.accountNumber,
} as const

/** Mapping baris join → bentuk wire: bank tunggal diurai ke dua field bank. */
function barisKeOwnerRecord(r: BarisJoinOwner): OwnerRecord {
  const bank = r.storedBankName === null ? { bankName: null, otherBankName: null } : namaBankKeWire(r.storedBankName)
  return {
    id: r.id,
    email: r.email,
    status: r.status,
    rejectionReason: r.rejectionReason,
    firstEffectiveAt: r.firstEffectiveAt,
    fullName: r.fullName,
    alias: r.alias,
    phoneNumber: r.phoneNumber,
    emergencyContactName: r.emergencyContactName,
    emergencyContactPhoneNumber: r.emergencyContactPhoneNumber,
    emergencyContactRelationship: r.emergencyContactRelationship,
    bankName: bank.bankName,
    otherBankName: bank.otherBankName,
    accountHolderName: r.accountHolderName,
    accountNumber: r.accountNumber,
  }
}

/** Query dasar join 3 tabel (owner + 2 anak 1:1). */
function queryOwner(db: DbClient) {
  return db
    .select(PILIHAN_JOIN_OWNER)
    .from(owners)
    .leftJoin(ownerEmergencyContacts, eq(ownerEmergencyContacts.ownerId, owners.id))
    .leftJoin(ownerBankAccounts, eq(ownerBankAccounts.ownerId, owners.id))
}

/** Cari owner berdasar email sesi Google (pencocokan email migrasi — AD-8). */
export async function findOwnerByEmail(db: DbClient, email: string): Promise<OwnerRecord | null> {
  const rows = await queryOwner(db).where(eq(owners.email, email)).limit(1)
  return rows[0] ? barisKeOwnerRecord(rows[0]) : null
}

/** Baca ulang owner berdasar id — jalur pasca-insert/update (bentuk wire). */
async function findOwnerById(db: DbClient, id: string): Promise<OwnerRecord | null> {
  const rows = await queryOwner(db).where(eq(owners.id, id)).limit(1)
  return rows[0] ? barisKeOwnerRecord(rows[0]) : null
}

/** Referensi referral owner — tampilan Kelengkapan Profile (Story 1.5,
 *  permintaan owner 2026-09-18); `usedReferralCode` DORMANT sampai Epic 3. */
export interface ReferralOwner {
  referralCode: string
  usedReferralCode: string | null
}

/** Baca referensi referral owner berdasar email — dipakai GET /api/profile. */
export async function bacaReferralOwner(db: DbClient, email: string): Promise<ReferralOwner | null> {
  const rows = await db
    .select({ referralCode: owners.referralCode, usedReferralCode: owners.usedReferralCode })
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
 * diulang hingga `BATAS_COBA_KODE_REFERRAL`. Rekaman bentuk wire dibaca
 * ulang via join 3 tabel (pendaftar baru belum punya baris anak — profil
 * NULL). `baru` membedakan 201 vs 200 di lapis handler.
 */
export async function daftarOwnerByEmail(db: DbClient, input: { email: string }): Promise<HasilDaftarOwner> {
  for (let percobaan = 1; ; percobaan++) {
    try {
      const disisipkan = await db
        .insert(owners)
        .values({ email: input.email, referralCode: buatKodeReferral() })
        .onConflictDoNothing({ target: owners.email })
        .returning({ id: owners.id })

      if (disisipkan[0]) {
        const baru = await findOwnerById(db, disisipkan[0].id)
        if (!baru) {
          throw new Error('daftarOwnerByEmail: baris owner baru tidak terbaca setelah insert.')
        }
        return { rekaman: baru, baru: true }
      }

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
 *  ulang). Opsi `createdAt` (ISO): backdate waktu pendaftaran untuk seeding uji
 *  `diajukanPada` (Story 1.5) — diterapkan pada insert MAUPUN update agar
 *  mint ulang idempoten terhadap baris yang sudah ada. Hanya menyentuh kolom
 *  `owners` — baris anak profil TIDAK dimutasi (upsert jalur dev tidak
 *  menghapus profil tersimpan). */
export async function upsertOwnerByEmail(
  db: DbClient,
  input: { email: string, status: OwnerStatus, rejectionReason: string | null, firstEffectiveAt: string | null, createdAt?: string },
): Promise<OwnerRecord> {
  const nilaiBaris = {
    email: input.email,
    status: input.status,
    rejectionReason: input.rejectionReason,
    firstEffectiveAt: input.firstEffectiveAt,
    referralCode: buatKodeReferral(),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
  }
  const rows = await db
    .insert(owners)
    .values(nilaiBaris)
    .onConflictDoUpdate({
      target: owners.email,
      set: {
        status: input.status,
        rejectionReason: input.rejectionReason,
        firstEffectiveAt: input.firstEffectiveAt,
        ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
        updatedAt: new Date().toISOString(),
      },
    })
    .returning({ id: owners.id })
  const written = rows[0]
  if (!written) throw new Error('upsertOwnerByEmail: baris owner tidak kembali dari upsert.')
  const rekaman = await findOwnerById(db, written.id)
  if (!rekaman) throw new Error('upsertOwnerByEmail: baris owner tidak terbaca ulang setelah upsert.')
  return rekaman
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

/**
 * Kandidat job harian pendaftaran (Story 1.5, CAP-4): seluruh baris
 * `diajukan` — penyaringan jendela waktu (H-3/hari-7) dan kelengkapan Profil
 * dievaluasi service (jam `today` injectable). Kolom profil ikut di-join
 * agar predikat `profilLengkap` dievaluasi dari baris yang sama.
 */
export async function listCalonDiajukan(db: DbClient): Promise<BarisCalonJob[]> {
  const rows = await db
    .select({ ...PILIHAN_JOIN_OWNER, createdAt: owners.createdAt })
    .from(owners)
    .leftJoin(ownerEmergencyContacts, eq(ownerEmergencyContacts.ownerId, owners.id))
    .leftJoin(ownerBankAccounts, eq(ownerBankAccounts.ownerId, owners.id))
    .where(eq(owners.status, 'diajukan'))
  return rows.map((r) => ({ ...barisKeOwnerRecord(r), createdAt: r.createdAt }))
}

/**
 * Simpan nilai Profil calon (Story 1.5, CAP-1; normalisasi owner
 * 2026-09-18) — SATU tx pemanggil berisi: UPDATE kolom profil owner sendiri
 * (guard CAS `status = 'diajukan'`, RETURNING id — kalah race = throw) +
 * upsert `ON CONFLICT (owner_id) DO UPDATE` dua tabel anak 1:1. Bank
 * tersimpan sebagai SATU nilai (`namaBankKeTersimpan`) — tanpa kolom
 * other-bank. Nilai string apa adana (AD-10); baris kembali terbaca untuk
 * audit + respons handler. Pemanggil bertanggung jawab validasi
 * kelengkapan & status calon (handler + service).
 */
export async function simpanProfilCalon(db: DbClient, email: string, nilai: ProfilValues): Promise<OwnerRecord> {
  const nowIso = new Date().toISOString()
  const bankTersimpan = namaBankKeTersimpan(nilai.bankName, nilai.otherBankName)

  const dijaga = await db
    .update(owners)
    .set({
      fullName: nilai.fullName,
      alias: nilai.alias,
      phoneNumber: nilai.phoneNumber,
      updatedAt: nowIso,
    })
    // CAS status (pasca-review): TOCTOU vs cron kedaluwarsa — profil tidak
    // pernah tertulis ke baris yang sudah bukan `diajukan`; lock baris owners
    // tertahan hingga tx commit, tabel anak hanya pernah ditulis di baliknya.
    .where(and(eq(owners.email, email), eq(owners.status, 'diajukan')))
    .returning({ id: owners.id })
  const idBaris = dijaga[0]?.id
  if (!idBaris) {
    throw new Error('simpanProfilCalon: baris owner tidak ditemukan atau tidak berstatus diajukan.')
  }

  await db
    .insert(ownerEmergencyContacts)
    .values({
      ownerId: idBaris,
      name: nilai.emergencyContactName,
      phoneNumber: nilai.emergencyContactPhoneNumber,
      relationship: nilai.emergencyContactRelationship,
    })
    .onConflictDoUpdate({
      target: ownerEmergencyContacts.ownerId,
      set: {
        name: nilai.emergencyContactName,
        phoneNumber: nilai.emergencyContactPhoneNumber,
        relationship: nilai.emergencyContactRelationship,
      },
    })

  await db
    .insert(ownerBankAccounts)
    .values({
      ownerId: idBaris,
      bankName: bankTersimpan,
      accountHolderName: nilai.accountHolderName,
      accountNumber: nilai.accountNumber,
    })
    .onConflictDoUpdate({
      target: ownerBankAccounts.ownerId,
      set: {
        bankName: bankTersimpan,
        accountHolderName: nilai.accountHolderName,
        accountNumber: nilai.accountNumber,
      },
    })

  const sesudah = await findOwnerById(db, idBaris)
  if (!sesudah) {
    throw new Error('simpanProfilCalon: baris owner tidak terbaca ulang setelah menyimpan profil.')
  }
  return sesudah
}

/**
 * CAS kedaluwarsa (Story 1.5, CAP-4, AD-11): `diajukan → kedaluwarsa` HANYA
 * bila status masih `diajukan` — race vs simpan profil/verifikasi COO
 * dijaga guard yang sama (satu penulis menang). Null = kalah race (baris
 * sudah bukan `diajukan`).
 */
export async function kedaluwarsakanCalon(db: DbClient, id: string): Promise<{ id: string, email: string } | null> {
  const rows = await db
    .update(owners)
    .set({ status: 'kedaluwarsa', updatedAt: new Date().toISOString() })
    .where(and(eq(owners.id, id), eq(owners.status, 'diajukan')))
    .returning({ id: owners.id, email: owners.email })
  return rows[0] ?? null
}

/**
 * CAS re-daftar (Story 1.5, CAP-5, AD-11): `kedaluwarsa → diajukan` pada
 * baris YANG SAMA (id tetap) HANYA bila status masih `kedaluwarsa` — status
 * lain tidak pernah tersentuh (kontrak hijau Story 1.4). `createdAt` ikut
 * di-reset (pasca-review): re-daftar = pendaftaran baru pada baris yang sama
 * — satu sumber waktu pendaftaran yang dipakai `runRegistrationDailyJob`
 * menurunkan `registrationDeadline` (jendela H-3/hari-7 mulai dari nol).
 * Baris anak profil tidak tersentuh — profil tersimpan bertahan lintas
 * re-daftar. Null = kalah race.
 */
export async function aktifkanKembaliCalon(db: DbClient, id: string): Promise<OwnerRecord | null> {
  const rows = await db
    .update(owners)
    .set({
      status: 'diajukan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(owners.id, id), eq(owners.status, 'kedaluwarsa')))
    .returning({ id: owners.id })
  const idAktif = rows[0]?.id
  if (!idAktif) return null
  const rekaman = await findOwnerById(db, idAktif)
  return rekaman ?? null
}

/** Dirikan port repo identity di atas Drizzle — DI untuk `buildPrincipal`. */
export function createIdentityRepo(db: DbClient, now: Date = new Date()): IdentityRepoPort {
  return {
    findOwnerByEmail: (email) => findOwnerByEmail(db, email),
    findActiveCooTenure: (ownerId) => findActiveCooTenure(db, ownerId, now),
  }
}
