/**
 * IDENTITY — siklus hidup owner/pendaftaran (AD-11), role & matriks keterbukaan
 * (AD-8), OTP MFA (AD-8), pergantian COO (FR-17).
 *
 * Kerangka cron pendaftaran (dipanggil dari server/jobs/daily.post.ts):
 * - Kedaluwarsa otomatis hari ke-7 (kalender Asia/Jakarta) bila Profile belum
 *   lengkap; pengingat H-3 (FR-22) — keduanya via outbox proofs.
 * - Race verifikasi COO vs cron expiry dijaga compare-and-set atas status
 *   sebelumnya dalam SATU transaksi (AD-11) — hanya satu penulis yang berhasil.
 * - Re-daftar pendaftar kedaluwarsa = CAS `kedaluwarsa -> diajukan` pada baris
 *   owner yang sama (email unik), bukan baris baru.
 *
 * TODO(Story 1.4–1.9): tabel owners/coo_tenures/otp_codes + implementasi.
 */
import { addCalendarDays, jakartaDayKey, type DayKey } from '#shared/domain/calendar'

/** Batas kalender pendaftaran (FR-22): hari ke-7 sejak submit, zona Asia/Jakarta. */
export const REGISTRATION_EXPIRY_DAYS = 7

/** Pengingat dikirim H-3 sebelum hari kedaluwarsa. */
export const REGISTRATION_REMINDER_DAYS_BEFORE = 3

export interface RegistrationDeadline {
  submittedOn: DayKey
  reminderOn: DayKey
  expiresOn: DayKey
}

/**
 * Batas kalender pendaftaran dari hari submit (Asia/Jakarta) — murni, diuji di
 * shared/domain/calendar.test.ts. Dipakai cron harian dan pengecekan in-app.
 */
export function registrationDeadline(submittedOn: DayKey): RegistrationDeadline {
  const expiresOn = addCalendarDays(submittedOn, REGISTRATION_EXPIRY_DAYS)
  return {
    submittedOn,
    expiresOn,
    reminderOn: addCalendarDays(expiresOn, -REGISTRATION_REMINDER_DAYS_BEFORE),
  }
}

/**
 * Kerangka job harian pendaftaran — dipanggil server/jobs/daily.post.ts
 * (terproteksi CRON_SECRET). TODO(Story 1.4/1.6): untuk tiap owner
 * `diajukan` yang belum lengkap:
 *   1. reminderOn === today -> enqueueEmail(tx, { kind: 'notifikasi', … })
 *   2. expiresOn <= today  -> CAS `diajukan -> kedaluwarsa` + entry audit
 *      (modul audit) dalam satu transaksi.
 */
export async function runRegistrationDailyJob(_today: DayKey = jakartaDayKey(new Date())): Promise<{ reminded: number, expired: number }> {
  // Belum ada tabel owners di scaffold — no-op dengan kontrak balikan tetap.
  void _today
  return { reminded: 0, expired: 0 }
}
