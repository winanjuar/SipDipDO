// server/domain/identity/otp.email.ts
//
// Hook pengiriman email OTP (FR-3 §3.1, FR-22 §22.4).
//
// PROOFS/ProofsModule (outbox drain async post-commit, AD-5) adalah pemilik
// pengiriman email jangka panjang. Selama pintu PROOFS belum ter-wire, helper ini
// menuliskan baris `email_outbox` SECARA LANGSUNG sebagai titik integrasi yang
// jelas ditandai. Ketika ProofsModule tersedia, ganti isi `enqueueOtpEmail`
// dengan `proofs.enqueueEmail(tx, ...)` TANPA mengubah pemanggil (`requestOtp`).
//
// Prinsip:
//   - JANGAN hard-fail bila pengiriman tak dapat di-enqueue: OTP tetap dibuat &
//     tercatat di audit; kegagalan enqueue di-swallow (best-effort) agar cooldown
//     & invalidasi tetap konsisten. Kegagalan drain aktual ditangani PROOFS
//     (retry + alert, design §301).
//   - Baris outbox berpartisipasi dalam transaksi pemanggil bila `tx` transaksional.

import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { MfaActionType, Uuid } from '../../../shared/domain/types'

const { emailOutbox } = schema

/** Subjek email OTP per jenis aksi (Bahasa Indonesia, bagian kontrak tampilan). */
const OTP_SUBJECT: Record<MfaActionType, string> = {
  konfirmasi: 'Kode OTP — Konfirmasi Pesanan Pembelian',
  input_langsung: 'Kode OTP — Input Transaksi Langsung',
  kompensasi: 'Kode OTP — Entry Kompensasi',
}

/**
 * Meng-enqueue email OTP untuk COO (best-effort, tidak hard-fail).
 *
 * Menulis baris `email_outbox` (recipient, subject, body, payload) DI DALAM
 * transaksi pemanggil. `code` plaintext HANYA melintas ke email — tidak pernah
 * disimpan di `otp_codes` (di sana hanya HASH). Kegagalan enqueue tidak
 * membatalkan pembuatan OTP; error ditelan agar jalur `requestOtp` tetap sukses.
 */
export async function enqueueOtpEmail(
  tx: Tx,
  input: {
    recipient: string | null
    actionType: MfaActionType
    targetRef: Uuid
    code: string
    expiresAt: Date
  },
): Promise<void> {
  if (!input.recipient) return

  try {
    await tx.insert(emailOutbox).values({
      recipient: input.recipient,
      subject: OTP_SUBJECT[input.actionType],
      body: `Kode OTP Anda adalah ${input.code}. Kode berlaku hingga ${input.expiresAt.toISOString()} dan hanya dapat dipakai satu kali.`,
      payload: {
        kind: 'otp',
        actionType: input.actionType,
        targetRef: input.targetRef,
        expiresAt: input.expiresAt.toISOString(),
      },
    })
  } catch {
    // Best-effort: PROOFS menangani retry/alert. OTP tetap dibuat & tercatat audit.
  }
}
