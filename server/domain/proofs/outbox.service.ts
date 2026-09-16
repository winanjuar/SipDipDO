/**
 * PROOFS — orkestrasi outbox email (AR-6 / R-009):
 * - `enqueueEmail` dipanggil DI DALAM transaksi aksi terkait (baris outbox
 *   tertulis bersama aksinya — crash di antara tidak pernah kehilangan email).
 * - `dispatchPendingOutboxEmails` adalah pengirim async pasca-commit dengan
 *   retry backoff; setiap kegagalan TERLIHAT: log terstruktur ber-prefix `alert`
 *   (bisa di-forward ke alerting saat produksi) + kolom `last_error`/`status:
 *   exhausted'` di baris outbox.
 *
 * Template email nyata (Bukti Transaksi, OTP, notifikasi) menyusul di story
 * masing-masing; scaffold meminkan mekanismenya dengan template minimal.
 */
import { jakartaDayKey } from '#shared/domain/calendar'
import type { OutboxEmail } from '../../../drizzle/schema'
import type { DbClient } from '../../utils/db'
import { useDb } from '../../utils/db'
import {
  enqueueOutboxEmail as enqueueOutboxEmailRow,
  listDueOutboxEmails,
  markOutboxEmailAttemptFailed,
  markOutboxEmailSent,
} from './outbox.repo'
import { createResendMailClient, type MailClient, type MailSendResult } from './resend.client'

/** Registry jenis email — perluasan bersama story (otp → 1.3/1.5, bukti → Epic 3). */
const OUTBOX_KINDS = ['otp', 'bukti_transaksi', 'notifikasi'] as const
export type OutboxKind = (typeof OUTBOX_KINDS)[number]

const MAX_ATTEMPTS = 5
/** Backoff retry menit: [1, 5, 30, 120] menit untuk percobaan ke-2..5. */
const BACKOFF_MINUTES = [1, 5, 30, 120] as const
const DISPATCH_BATCH_LIMIT = 10

/**
 * Tulis baris outbox dalam transaksi PEMANGGIL (AD-5: fungsi lintas modul di
 * jalur transaksi menerima `tx`; hanya service teratas membuka transaksi).
 * Modul lain (identity, orders, …) memanggil ini lewat proofs/index.ts.
 */
export function enqueueEmail(
  tx: DbClient,
  input: { kind: OutboxKind, to: string, payload: Record<string, unknown> },
): Promise<OutboxEmail> {
  if (!OUTBOX_KINDS.includes(input.kind)) {
    throw new Error(`Jenis outbox tidak terdaftar: "${input.kind}"`)
  }
  return enqueueOutboxEmailRow(tx, input)
}

/** Escape nilai yang diinterpolasi ke HTML — pola WAJIB ikut oleh template nyata (data owner tidak dipercaya). */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

/** Render konten email dari baris outbox — template minimal scaffold. */
function renderEmail(row: OutboxEmail): { subject: string, html: string, text: string } {
  // TODO(story 1.3+/Epic 3): template nyata (OTP, Bukti Transaksi, notifikasi)
  // sesuai konten payload; Bukti Transaksi dirender via @react-pdf/renderer (Epic 3).
  const subject = `[Sip & Dip] ${row.kind}`
  const text = `Email "${row.kind}" untuk ${row.toAddress}. Payload: ${JSON.stringify(row.payload)}`
  return { subject, html: `<p>${escapeHtml(text)}</p>`, text }
}

function logAlert(fields: Record<string, unknown>): void {
  // Log terstruktur — satu baris JSON mudah difilter/forward ke alerting (R-009).
  console.error(JSON.stringify({ alert: 'outbox', ...fields }))
}

function reportResult(row: OutboxEmail, result: MailSendResult): void {
  if (result.ok) return
  const exhausted = row.attempts + 1 >= MAX_ATTEMPTS
  logAlert({
    event: exhausted ? 'outbox.exhausted' : 'outbox.send_failed',
    outboxId: row.id,
    kind: row.kind,
    to: row.toAddress,
    attempts: row.attempts + 1,
    retryable: result.retryable,
    error: result.error,
    dayJakarta: jakartaDayKey(new Date()),
  })
}

/**
 * Kirim baris outbox yang jatuh tempo. Dipanggil pasca-commit (reaction), tidak
 * pernah di dalam transaksi aksi. Aman dipanggil berkala (cron/interval nitro)
 * maupun oportunistik setelah aksi yang menghasilkan email.
 */
export async function dispatchPendingOutboxEmails(options: { now?: Date, mailClient?: MailClient } = {}): Promise<{ processed: number, sent: number, failed: number }> {
  const db = useDb()
  const now = options.now ?? new Date()
  const runtimeConfig = useRuntimeConfig()
  const mailClient = options.mailClient ?? createResendMailClient(runtimeConfig.resendApiKey)
  const from = runtimeConfig.resendFrom
  if (!from) {
    logAlert({ event: 'outbox.from_unconfigured', hint: 'Isi NUXT_RESEND_FROM — lihat README (keputusan From-domain + SPF/DKIM).' })
  }
  const rows = await listDueOutboxEmails(db, now, DISPATCH_BATCH_LIMIT)

  let sent = 0
  let failed = 0
  for (const row of rows) {
    if (!from) {
      // Tanpa From sah, jangan tandai exhausted — biarkan pending & terlihat.
      reportResult(row, { ok: false, error: 'NUXT_RESEND_FROM belum dikonfigurasi', retryable: true })
      failed++
      continue
    }
    const result = await mailClient.send(from, { to: row.toAddress, ...renderEmail(row) })
    if (result.ok) {
      const marked = await markOutboxEmailSent(db, row.id, now)
      if (!marked) {
        // Guard status kalah — baris sudah ditangani dispatcher lain; jangan
        // hitung ganda (skip).
        logAlert({ event: 'outbox.sent_race_skipped', outboxId: row.id })
        continue
      }
      sent++
    } else {
      const backoffMinutes = result.retryable ? BACKOFF_MINUTES[Math.min(row.attempts, BACKOFF_MINUTES.length - 1)] : 0
      const nextSendAfter = new Date(now.getTime() + backoffMinutes * 60_000)
      const marked = await markOutboxEmailAttemptFailed(db, {
        id: row.id,
        readAttempts: row.attempts,
        lastError: result.error,
        sendAfter: nextSendAfter,
        maxAttempts: MAX_ATTEMPTS,
      })
      if (!marked) {
        // CAS kalah — penulis konkuren lebih dulu maju; baris milik dispatcher
        // lain (skip).
        logAlert({ event: 'outbox.failure_race_skipped', outboxId: row.id })
        continue
      }
      reportResult(row, result)
      failed++
    }
  }
  return { processed: rows.length, sent, failed }
}
