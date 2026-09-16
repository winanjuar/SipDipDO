// server/jobs/registration-reminders.ts
//
// Cron siklus hidup pendaftar (FR-22 §22.5/§22.6) — dipanggil Vercel Cron (UTC)
// melalui endpoint terproteksi `CRON_SECRET` (design.md B.6/AD-9):
//   - Pengingat H-3   : Profile masih belum lengkap pada hari kalender ke-3
//                       (Asia/Jakarta) sejak pengajuan → kirim SATU email
//                       pengingat (§22.5, idempoten).
//   - Kedaluwarsa H-7 : Profile masih belum lengkap hingga hari kalender ke-7
//                       (Asia/Jakarta) → tandai pendaftaran 'kedaluwarsa'
//                       (CAS 'diajukan' → 'kedaluwarsa' + audit, §22.6).
//
// INVARIAN ZONA WAKTU (design.md "Deployment topology"): batas hari dihitung DI
// DALAM job memakai zona Asia/Jakarta (`jakartaToday = toJakartaDate(new Date())`),
// BUKAN jam pemicu UTC. Menjalankan cron pada jam UTC berapa pun menghasilkan
// keputusan pengingat/kedaluwarsa yang sama selama tanggal kalender Jakarta sama.
//
// ATOMICITY (AD-2): evaluasi + CAS + audit + enqueue email pengingat terjadi
// dalam SATU transaksi cron (`withTransaction`). Transisi CAS 'diajukan' →
// 'kedaluwarsa', audit, dan penandaan idempoten `reminder_sent_at` dimiliki
// modul IDENTITY (`identity.expireRegistrations`, cohesion). Job ini membuka
// transaksi, menghitung tanggal Jakarta, mendelegasikan ke IDENTITY, lalu
// meng-enqueue email pengingat untuk pendaftar yang BARU ditandai (tepat satu).

import { withTransaction } from '../utils/db'
import { toJakartaDate } from '../../shared/domain/calendar'
import type { JakartaDate, Uuid } from '../../shared/domain/types'
import { identity } from '../domain/identity'
import { enqueueRegistrationReminderHook } from './registration-reminder.hook'

/** Hasil satu eksekusi cron siklus hidup pendaftar. */
export interface RegistrationRemindersResult {
  /** Tanggal kalender Asia/Jakarta yang dipakai sebagai acuan H-3/H-7. */
  jakartaToday: JakartaDate
  /** Id pendaftar yang BARU dikirimi pengingat H-3 pada eksekusi ini. */
  reminded: Uuid[]
  /** Id pendaftaran yang di-kedaluwarsa-kan (hari-7) pada eksekusi ini. */
  expired: Uuid[]
  /** Jumlah pengingat baru yang dienqueue. */
  remindedCount: number
  /** Jumlah pendaftaran yang di-kedaluwarsa-kan. */
  expiredCount: number
}

/**
 * Menjalankan siklus hidup pendaftar (FR-22 §22.5/§22.6) dalam SATU transaksi
 * atomik.
 *
 * Langkah:
 *   1. `jakartaToday = toJakartaDate(new Date())` — tanggal kalender Jakarta
 *      dihitung di dalam job (invarian terhadap jam pemicu UTC, AD-9).
 *   2. `identity.expireRegistrations(tx, jakartaToday)` — kedaluwarsa hari-7
 *      (CAS + audit) dan penandaan idempoten pengingat H-3; mengembalikan
 *      daftar pendaftar yang BARU ditandai (reminders) + id kedaluwarsa.
 *   3. Untuk tiap `reminders`, enqueue tepat satu email pengingat in-tx
 *      (hook `email_outbox`), best-effort — idempotensi dijamin di hulu.
 *
 * Mengembalikan tanggal acuan + daftar/jumlah pengingat & kedaluwarsa.
 */
export async function runRegistrationReminders(): Promise<RegistrationRemindersResult> {
  const jakartaToday = toJakartaDate(new Date())

  const { reminders, expired } = await withTransaction(async (tx) => {
    const result = await identity.expireRegistrations(tx, jakartaToday)

    // Enqueue tepat satu email pengingat per pendaftar yang baru ditandai (§22.5).
    for (const r of result.reminders) {
      await enqueueRegistrationReminderHook(tx, {
        ownerId: r.ownerId,
        recipient: r.email,
        name: r.name,
      })
    }

    return result
  })

  const reminded = reminders.map((r) => r.ownerId)

  return {
    jakartaToday,
    reminded,
    expired,
    remindedCount: reminded.length,
    expiredCount: expired.length,
  }
}
