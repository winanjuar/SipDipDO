/**
 * IDENTITY — kontrak murni lintas lapis (AD-6): enum status siklus hidup
 * owner/pendaftar (dipinkan AD-11), role tiga-tingkat untuk landing, dan peta
 * landing role→route (UX-DR14). TANPA I/O, tanpa framework — dipakai bersama
 * `server/domain/identity`, route handler, dan halaman.
 *
 * Role TIDAK PERNAH diturunkan dari `positions.shares` (AD-8/AD-11) —
 * penentuan role kanonik = `resolveRole` di `server/domain/identity`
 * (precedence COO aktif dari `coo_tenures`, "pemegang saham" dari
 * `first_effective_at` terisi).
 */

/** Status siklus hidup owner/pendaftaran — himpunan tertutup AD-11. */
export const OWNER_STATUSES = ['diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar'] as const
export type OwnerStatus = (typeof OWNER_STATUSES)[number]

/** Role akses untuk landing (UX-DR14). */
export const ROLES = ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner'] as const
export type Role = (typeof ROLES)[number]

/** Status calon owner — dialandingkan ke halaman status pendaftaran. */
export const CALON_OWNER_STATUSES: readonly OwnerStatus[] = ['diajukan', 'ditolak', 'kedaluwarsa']

/** Panjang kode referral owner — alfanumerik (keputusan owner 2026-09-18). */
export const PANJANG_KODE_REFERRAL = 8

/** Himpunan karakter kode referral — alfanumerik lengkap: huruf besar, huruf
 *  kecil, dan digit (keputusan owner 2026-09-18: menerima lowercase juga). */
const KARAKTER_KODE_REFERRAL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Buat kode referral MILIK owner — alfanumerik `PANJANG_KODE_REFERRAL`
 * karakter. MURNI: sumber acak disuntikkan (prasyarat nilai ∈ [0,1)) agar
 * teruji deterministik. Kolom `owners.referral_code` UNIQUE — tabrakan
 * ditangani lapis repo dengan retry saat constraint melawan.
 */
export function buatKodeReferral(angkaAcak: () => number = Math.random): string {
  let kode = ''
  for (let i = 0; i < PANJANG_KODE_REFERRAL; i++) {
    kode += KARAKTER_KODE_REFERRAL.charAt(Math.floor(angkaAcak() * KARAKTER_KODE_REFERRAL.length))
  }
  return kode
}

/** Peta landing role→route — ter-pin spec Story 1.2 (UX-DR14). */
export const LANDING_PATH: Record<Role, string> = {
  coo: '/antrian-beli',
  pemegang_saham: '/dashboard',
  tanpa_saham: '/personal',
  calon_owner: '/status-pendaftaran',
}

/**
 * Snapshot owner minimal untuk keputusan role — timestamptz dibaca sebagai
 * string ISO (konvensi spine: mode string, bukan Date lokal).
 */
export interface OwnerAccessSnapshot {
  status: OwnerStatus
  /** Waktu Pembelian Pertama efektif; null bila belum pernah efektif. */
  firstEffectiveAt: string | null
}

/** Referensi owner pada principal — data yang aman diekspos ke lapis halaman. */
export interface PrincipalOwner {
  email: string
  status: OwnerStatus
  /** Alasan penolakan pendaftaran — tampil apa adanya (UX-DR15); null bila bukan ditolak. */
  rejectionReason: string | null
  firstEffectiveAt: string | null
  /** Profil Lampiran A #1–10 lengkap (Story 1.5, FR-22) — prasyarat verifikasi
   *  COO; dihitung `profilLengkap()` per-request, bukan kolom DB. */
  profilLengkap: boolean
}

/**
 * Principal hasil `buildPrincipal` (AD-8): sesi Google tanpa baris owner =
 * unlinked; selain itu memuat role kanonik + referensi owner. Role dievaluasi
 * per-request dari DB — tidak pernah disimpan di JWT/session.
 */
export type Principal =
  | { unlinked: true }
  | { unlinked: false, role: Role, owner: PrincipalOwner }
