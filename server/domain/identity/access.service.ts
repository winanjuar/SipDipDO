/**
 * IDENTITY — fungsi kanonik role & principal (AD-8/AD-11).
 *
 * - `resolveRole(owner, cooAktif)` MURNI (tanpa I/O): precedence landing
 *   ter-pin (design notes spec) — unlinked (tanpa baris owner, ditangani
 *   `buildPrincipal`) → COO aktif (`coo_tenures` berlaku) → calon
 *   (`diajukan`/`ditolak`/`kedaluwarsa`) → `keluar` → `first_effective_at`
 *   terisi (pemegang saham) → `terverifikasi` tanpa pembelian. COO aktif
 *   menang di atas pemegang saham (COO umumnya juga pemegang saham); calon
 *   menang atas saham (data migrasi). Role TIDAK PERNAH diturunkan dari
 *   `positions.shares` (AD-8/AD-11).
 * - `buildPrincipal(repo, email)` membaca DB tiap request via repo (DI) —
 *   role dievaluasi per-request, tidak pernah disimpan di JWT/session, sehingga
 *   pergantian COO/status tidak pernah basi.
 */
import { profilLengkap } from '#shared/domain/profil'
import { CALON_OWNER_STATUSES, LANDING_PATH, type OwnerAccessSnapshot, type Principal, type Role } from '#shared/domain/identity'

/** Sumber tautan landing role→route (dipakai route handler & halaman). */
export { LANDING_PATH }

/**
 * Baris owner minimal untuk keputusan role. Repo nyata (`createIdentityRepo`)
 * selalu mengisi `id`, `rejectionReason`, dan kolom Profil (Story 1.5); stub
 * repo uji boleh minimal — service hanya membaca yang tersedia (kolom Profil
 * absen dinilai kosong oleh predikat `profilLengkap`).
 */
export interface OwnerRoleInput extends OwnerAccessSnapshot {
  id?: string
  email: string
  rejectionReason?: string | null
  namaLengkap?: string | null
  alias?: string | null
  nomorHp?: string | null
  kontakDarurat?: string | null
  nomorHpKontakDarurat?: string | null
  hubunganDenganOwner?: string | null
  namaBank?: string | null
  pemilikRekening?: string | null
  nomorRekening?: string | null
}

/**
 * Port repo untuk `buildPrincipal` — DI agar service murni teruji tanpa DB.
 * `findActiveCooTenure` opsional: stub repo uji minimal hanya menyediakan
 * `findOwnerByEmail` (tanpa tenure → dianggap bukan COO); repo nyata
 * (`createIdentityRepo`) selalu menyediakan keduanya.
 */
export interface IdentityRepoPort {
  findOwnerByEmail(email: string): Promise<OwnerRoleInput | null>
  findActiveCooTenure?(ownerId: string): Promise<boolean>
}

/**
 * Resolve role dari snapshot owner + status tenure COO — murni, diuji
 * `1-UNIT-001` (subset). Urutan penilaian = precedence landing ter-pin:
 * calon (diajukan/ditolak/kedaluwarsa) MENANG atas saham/keluar — pendaftar
 * yang punya `first_effective_at` (data migrasi) tetap diarahkan ke status
 * pendaftaran hingga verifikasi berjalan (keputusan owner, 2026-09-18).
 */
export function resolveRole(
  owner: Pick<OwnerAccessSnapshot, 'status' | 'firstEffectiveAt'>,
  cooAktif: boolean,
): Role {
  if (cooAktif) return 'coo'
  if (CALON_OWNER_STATUSES.includes(owner.status)) return 'calon_owner'
  if (owner.status === 'keluar') return 'tanpa_saham'
  if (owner.firstEffectiveAt !== null) return 'pemegang_saham'
  // Cabang final eksplisit — status di luar himpunan yang sudah dinilai
  // tidak pernah jatuh diam-diam ke tanpa_saham.
  if (owner.status === 'terverifikasi') return 'tanpa_saham'
  throw new Error(`resolveRole: status owner tidak dikenal (${String(owner.status)}).`)
}

/**
 * Bangun principal dari email sesi Google (AD-8): email tanpa baris owner →
 * `{ unlinked: true }`; selain itu role hasil `resolveRole` + referensi owner.
 */
export async function buildPrincipal(repo: IdentityRepoPort, email: string): Promise<Principal> {
  const owner = await repo.findOwnerByEmail(email)
  if (!owner) return { unlinked: true }

  const cooAktif = repo.findActiveCooTenure
    ? await repo.findActiveCooTenure(owner.id ?? '')
    : false
  const role = resolveRole(owner, cooAktif)

  return {
    unlinked: false,
    role,
    owner: {
      email: owner.email,
      status: owner.status,
      rejectionReason: owner.rejectionReason ?? null,
      firstEffectiveAt: owner.firstEffectiveAt,
      profilLengkap: profilLengkap(owner),
    },
  }
}
