import { timingSafeEqual } from 'node:crypto'
import { jakartaDayKey } from '#shared/domain/calendar'
import { runRegistrationDailyJob } from '../domain/identity'
import { dispatchPendingOutboxEmails } from '../domain/proofs'
import { HTTP_STATUS, sendApiError } from '../utils/api-error'

/**
 * Cron harian terproteksi CRON_SECRET (AD-9) — dipanggil Vercel Cron (UTC);
 * BATAS HARI dihitung zona Asia/Jakarta di dalam endpoint, bukan jam trigger.
 * Vercel Cron mengirim `Authorization: Bearer ${CRON_SECRET}`.
 */
export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig(event)
  const presented = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  // Bandingkan panjang BYTE (bukan unit UTF-16 string) sebelum timingSafeEqual
  // — token multibyte dengan panjang UTF-16 sama membuat buffer beda byte dan
  // melempar RangeError (500) alih-alih envelope 401.
  const authorized =
    cronSecret.length > 0
    && Buffer.byteLength(presented, 'utf8') === Buffer.byteLength(cronSecret, 'utf8')
    && timingSafeEqual(Buffer.from(presented, 'utf8'), Buffer.from(cronSecret, 'utf8'))

  if (!authorized) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Cron secret tidak sah.',
      details: { expected: 'Authorization: Bearer <CRON_SECRET>' },
    })
  }

  const today = jakartaDayKey(new Date())

  // Job list scaffold (no-op sampai story pemiliknya) — pola: delegasi ke
  // service modul domain, route tetap tipis.
  const registration = await runRegistrationDailyJob(today)
  // Pengiriman outbox (AR-6) ikut jadwal harian; error-isolated — kegagalan
  // dispatch dicatat via log alert di modul proofs, tidak menggagalkan job lain.
  let outbox: Awaited<ReturnType<typeof dispatchPendingOutboxEmails>>
  try {
    outbox = await dispatchPendingOutboxEmails()
  } catch (error) {
    console.error(JSON.stringify({
      alert: 'jobs.daily.outbox_dispatch_failed',
      error: error instanceof Error ? error.message : String(error),
      dayJakarta: today,
    }))
    outbox = { processed: 0, sent: 0, failed: 0 }
  }
  // TODO(Story 1.4/Epic 3): kedaluwarsa pesanan hari ke-7 (orders, FR-19)
  //   via compare-and-set guard kanonik (AD-2).

  return {
    code: 'OK',
    message: 'Job harian selesai.',
    details: { today, jobs: { registration, outbox } },
  }
})
