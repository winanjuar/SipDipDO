// server/jobs/registration-reminder.hook.ts
//
// Hook enqueue email PENGINGAT H-3 pendaftar Profile-tak-lengkap (FR-22 §22.5).
//
// PROOFS/ProofsModule (`enqueueEmail`) BELUM ter-wire sebagai pintu index
// (server/domain/proofs/index.ts masih kosong). Selama itu, hook ini menulis
// satu baris `email_outbox` bertanda `kind: 'registration_reminder'` DI DALAM
// transaksi cron sebagai titik integrasi yang jelas — sejalan dengan pola
// `server/domain/orders/coo-notify.hook.ts` dan `ledger/proof.hook.ts`.
//
// GANTI isi fungsi ini dengan `proofs.enqueueEmail(tx, …)` saat pintu PROOFS
// ter-wire, TANPA mengubah pemanggil (`runRegistrationReminders`). Idempotensi
// "satu email pengingat" (§22.5) dijaga di HULU oleh CAS `reminder_sent_at`
// (identity.expireRegistrations hanya mengembalikan pendaftar yang BARU ditandai),
// sehingga enqueue di sini terjadi tepat satu kali per pendaftar.

import type { Tx } from '../utils/db'
import { schema } from '../utils/db'
import type { Uuid } from '../../shared/domain/types'

const { emailOutbox } = schema

/** Data penerima pengingat H-3. */
export interface RegistrationReminderPayload {
  ownerId: Uuid
  recipient: string
  name: string | null
}

/**
 * Meng-enqueue email pengingat H-3 "lengkapi Profile Anda" DI DALAM transaksi
 * cron `tx` (AD-5). Best-effort: kegagalan enqueue TIDAK membatalkan transaksi
 * cron (penandaan `reminder_sent_at` sudah tercatat; drain/retry adalah
 * tanggung jawab PROOFS). Dipanggil sekali per pendaftar yang baru ditandai.
 *
 * TODO: ganti dengan `proofs.enqueueEmail(tx, …)` saat pintu PROOFS ter-wire.
 */
export async function enqueueRegistrationReminderHook(
  tx: Tx,
  reminder: RegistrationReminderPayload,
): Promise<void> {
  try {
    await tx.insert(emailOutbox).values({
      recipient: reminder.recipient,
      subject: 'Pengingat: Lengkapi Profile Pendaftaran Anda',
      body:
        `Halo${reminder.name ? ` ${reminder.name}` : ''}, ` +
        'Profile pendaftaran Anda belum lengkap. Mohon segera melengkapinya ' +
        'agar dapat diverifikasi. Pendaftaran akan kedaluwarsa pada hari ke-7 ' +
        'sejak tanggal pengajuan bila belum lengkap.',
      payload: {
        kind: 'registration_reminder',
        ownerId: reminder.ownerId,
      },
    })
  } catch {
    // Best-effort: PROOFS menangani retry/alert saat drain (AD-5).
  }
}
