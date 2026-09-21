/**
 * IDENTITY (AD-5/AD-8/AD-11) — satu-satunya pintu impor lintas modul:
 * siklus hidup owner, predikat akses (`aksesPenuh`, `perluReferral`,
 * `pilihanReferral`), OTP MFA, COO & tenure.
 */
export {
  buildPrincipal,
  LANDING_PATH,
  resolveRole,
} from './access.service'
export type { IdentityRepoPort, OwnerRoleInput } from './access.service'

/**
 * Story 1.7 — predikat akses kanonik + registry permukaan/navigasi
 * (FR-15 §4.8, AD-8/AD-11, UX-DR14). Definisi MURNI di `shared/domain`
 * (AD-6); diekspor ulang di sini agar lintas modul server memakai SATU
 * pintu impor (AD-5).
 */
export {
  aksesPenuh,
  itemNavigasi,
  KATALOG_ITEM_NAVIGASI,
  KUNCI_COOKIE_INFO_TRANSPARANSI,
  layakPilihanReferral,
  MAKS_ITEM_NAV_MOBILE,
  PERMUKAAN_PERAN,
  permukaanDibolehkan,
  PESAN_TRANSPARANSI,
  perluReferral,
  prasyaratPermukaan,
  PRASYARAT_AKSES_PENUH,
  PRASYARAT_COO,
  PRASYARAT_TANPA_SAHAM,
} from '#shared/domain/identity'
export type { ItemNavigasi, PrasyaratPermukaan } from '#shared/domain/identity'
export {
  bacaReferralOwner,
  closeActiveCooTenures,
  createIdentityRepo,
  daftarOwnerByEmail,
  findActiveCooTenure,
  findOwnerByEmail,
  kedaluwarsakanCalon,
  listCalonDiajukan,
  openCooTenure,
  simpanProfilCalon,
  upsertOwnerByEmail,
} from './owner.repo'
export type { BarisCalonJob, HasilDaftarOwner, OwnerRecord, ReferralOwner } from './owner.repo'
export {
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  ajukanPendaftaran,
  registrationDeadline,
  runRegistrationDailyJob,
  simpanProfil,
} from './registration.service'
export type { HasilJobHarianPendaftaran, RegistrationDeadline } from './registration.service'
