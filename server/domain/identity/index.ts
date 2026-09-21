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
export {
  bacaReferralOwner,
  closeActiveCooTenures,
  createIdentityRepo,
  daftarOwnerByEmail,
  findActiveCooTenure,
  findOwnerByEmail,
  findOwnerById,
  kedaluwarsakanCalon,
  listCalonDiajukan,
  listCalonVerifikasi,
  openCooTenure,
  simpanProfilCalon,
  tolakCalon,
  upsertOwnerByEmail,
  verifikasiCalon,
} from './owner.repo'
export type { BarisCalonJob, HasilDaftarOwner, OwnerRecord, ReferralOwner } from './owner.repo'
export {
  KEPUTUSAN_COO,
  PANJANG_MAKS_ALASAN_PENOLAKAN,
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  ajukanPendaftaran,
  daftarCalonVerifikasi,
  keputusanCalon,
  registrationDeadline,
  runRegistrationDailyJob,
  simpanProfil,
} from './registration.service'
export type {
  AkhirKeputusanCalon,
  BarisCalonVerifikasi,
  HasilJobHarianPendaftaran,
  KeputusanCoo,
  RegistrationDeadline,
} from './registration.service'
