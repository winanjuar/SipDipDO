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
 * Pendaftaran mandiri (Story 1.4, FR-22): `ajukanPendaftaran` membuka SATU
 * transaksi — INSERT-CAS idempotent per email + entry audit
 * `pendaftaran-diajukan` ditulis DALAM transaksi yang sama (AD-3), hanya saat
 * baris baru dibuat. Email pendaftar ditentukan pemanggil dari sesi Google.
 */
import { addCalendarDays, jakartaDayKey, type DayKey } from '#shared/domain/calendar'
import { writeAuditEntry } from '../audit/index'
import type { HasilDaftarOwner } from './owner.repo'
import { daftarOwnerByEmail } from './owner.repo'
import type { Db } from '../../utils/db'

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
 * (terproteksi CRON_SECRET). TODO(Story 1.5/1.6): untuk tiap owner
 * `diajukan` yang belum lengkap:
 *   1. reminderOn === today -> enqueueEmail(tx, { kind: 'notifikasi', … })
 *   2. expiresOn <= today  -> CAS `diajukan -> kedaluwarsa` + entry audit
 *      (modul audit) dalam satu transaksi.
 */
export async function runRegistrationDailyJob(_today: DayKey = jakartaDayKey(new Date())): Promise<{ reminded: number, expired: number }> {
  // Belum ada jalur cron pendaftaran — no-op dengan kontrak balikan tetap
  // (kedaluwarsa hari-7 + pengingat H-3 adalah Story 1.5).
  void _today
  return { reminded: 0, expired: 0 }
}

/**
 * Ajukan pendaftaran owner mandiri (Story 1.4, FR-22): SATU transaksi berisi
 * INSERT-CAS idempotent per email (`daftarOwnerByEmail`) + entry audit
 * `pendaftaran-diajukan` (aktor user = owner baru, target `owners:<id>`,
 * details memuat email pendaftar) — audit ditulis HANYA bila baris baru
 * dibuat; POST ulang mengembalikan baris existing tanpa mutasi dan tanpa
 * audit baru (matriks I/O spec 1.4). Email datang dari sesi Google
 * (keputusan di handler), bukan dari body.
 */
export async function ajukanPendaftaran(input: { email: string }, db: Db): Promise<HasilDaftarOwner> {
  return db.transaction(async (tx) => {
    const hasil = await daftarOwnerByEmail(tx, { email: input.email })
    if (hasil.baru) {
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: hasil.rekaman.id },
        action: 'pendaftaran-diajukan',
        target: `owners:${hasil.rekaman.id}`,
        details: { email: input.email },
      })
    }
    return hasil
  })
}
