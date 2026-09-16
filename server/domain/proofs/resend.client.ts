/**
 * Klien email Resend — wiring lengkap, TANPA kredensial produksi dulu
 * (keputusan pengguna spec 1.1 #3: verifikasi kirim nyata adalah gerbang
 * pra-Story 1.5; SPF/DKIM & From-domain checklist ada di README.md).
 */
import { Resend } from 'resend'

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export type MailSendResult =
  | { ok: true, messageId: string }
  | { ok: false, error: string, retryable: boolean }

export interface MailClient {
  send(from: string, message: MailMessage): Promise<MailSendResult>
}

/**
 * Nama error Resend yang jelas-permanen (input salah — retry tidak akan
 * mengubah hasil); sisanya dianggap retryable (kuota/rate-limit/jaringan).
 */
const PERMANENT_ERROR_NAMES = new Set([
  'validation_error',
  'invalid_from_address',
  'missing_required_field',
  'invalid_parameter',
])

/** Klien no-op terlihat: tanpa API key, kegagalan dikembalikan eksplisit + log — tidak pernah senyap. */
function createUnconfiguredMailClient(reason: string): MailClient {
  return {
    async send(_from, _message) {
      console.error(JSON.stringify({ alert: 'mail.unconfigured', reason } satisfies { alert: string, reason: string }))
      return { ok: false, error: `Klien email belum terkonfigurasi: ${reason}`, retryable: false }
    },
  }
}

export function createResendMailClient(apiKey: string | undefined): MailClient {
  if (!apiKey) {
    return createUnconfiguredMailClient('NUXT_RESEND_API_KEY belum diisi (lihat .env.example)')
  }
  const resend = new Resend(apiKey)
  return {
    async send(from, message) {
      try {
        const { data, error } = await resend.emails.send({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        })
        if (error) {
          // Error Resend — permanen bila input salah (tidak akan pernah lulus
          // dengan retry); selain itu retryable.
          const permanent = PERMANENT_ERROR_NAMES.has(error.name)
          return { ok: false, error: `${error.name}: ${error.message}`, retryable: !permanent }
        }
        return { ok: true, messageId: data?.id ?? 'unknown' }
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause)
        return { ok: false, error: `Jaringan/HTTP gagal: ${error}`, retryable: true }
      }
    },
  }
}
