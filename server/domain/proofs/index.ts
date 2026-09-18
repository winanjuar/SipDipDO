/**
 * PROOFS — Bukti Transaksi & notifikasi (FR-11).
 *
 * Satu-satunya pintu impor lintas modul untuk modul ini (AD-5):
 * - `enqueueEmail(tx, …)` — tulis baris outbox DI DALAM transaksi aksi.
 * - `dispatchPendingOutboxEmails()` — pengiriman async pasca-commit + retry,
 *   kegagalan terlihat (log `alert` + `status: exhausted`).
 *
 * Internal: outbox.repo.ts (Drizzle hanya di sini), outbox.service.ts,
 * resend.client.ts (wiring Resend — kredensial via env).
 */
export {
  adaOutboxEmail,
  listOutboxEmailPenerima,
} from './outbox.repo'
export {
  dispatchPendingOutboxEmails,
  enqueueEmail,
  OUTBOX_KIND_NOTIFIKASI,
} from './outbox.service'
export type { OutboxKind } from './outbox.service'
export type { MailClient, MailMessage, MailSendResult } from './resend.client'
export { createResendMailClient } from './resend.client'
