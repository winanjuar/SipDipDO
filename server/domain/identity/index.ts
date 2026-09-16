/**
 * IDENTITY (AD-5/AD-8/AD-11) — satu-satunya pintu impor lintas modul:
 * siklus hidup owner, predikat akses (`aksesPenuh`, `perluReferral`,
 * `pilihanReferral`), OTP MFA, COO & tenure.
 */
export {
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  registrationDeadline,
  runRegistrationDailyJob,
} from './registration.service'
export type { RegistrationDeadline } from './registration.service'
