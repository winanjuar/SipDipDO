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
  closeActiveCooTenures,
  createIdentityRepo,
  daftarOwnerByEmail,
  findActiveCooTenure,
  findOwnerByEmail,
  openCooTenure,
  upsertOwnerByEmail,
} from './owner.repo'
export type { HasilDaftarOwner, OwnerRecord } from './owner.repo'
export {
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  ajukanPendaftaran,
  registrationDeadline,
  runRegistrationDailyJob,
} from './registration.service'
export type { RegistrationDeadline } from './registration.service'
