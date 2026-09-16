// server/api/cron/registration-reminders.post.ts
//
// Endpoint cron TERPROTEKSI untuk siklus hidup pendaftar (FR-22 §22.5/§22.6):
// pengingat H-3 (Profile tak lengkap) + kedaluwarsa hari-7. Dipicu Vercel Cron
// (UTC); memverifikasi `CRON_SECRET` sebelum menjalankan job. Batas hari
// dihitung DI DALAM job memakai zona Asia/Jakarta (design.md B.6/AD-9) —
// invarian terhadap jam pemicu UTC.
//
// KONTRAK ENDPOINT
//   Method  : POST
//   Path    : /api/cron/registration-reminders
//   Auth    : header `Authorization: Bearer <CRON_SECRET>` ATAU
//             `x-cron-secret: <CRON_SECRET>`. 401 bila tidak diset/tidak cocok.
//   Body    : (diabaikan)
//   200     : { ok: true, jakartaToday, reminded: string[], expired: string[],
//               remindedCount: number, expiredCount: number }
//   401     : { statusMessage: 'Unauthorized' } bila secret hilang/tidak cocok
//             atau `CRON_SECRET` tidak dikonfigurasi (fail-closed).
//
// `defineEventHandler`, `getRequestHeader`, `createError` tersedia sebagai
// auto-import Nitro/h3 (lihat .nuxt/types/nitro-imports.d.ts).

import { runRegistrationReminders } from '../../jobs/registration-reminders'
import {
  CRON_SECRET_HEADERS,
  extractProvidedSecret,
  verifyCronSecret,
} from '../../jobs/cron-auth'

export default defineEventHandler(async (event) => {
  const provided = extractProvidedSecret({
    authorization: getRequestHeader(event, CRON_SECRET_HEADERS.authorization),
    xCronSecret: getRequestHeader(event, CRON_SECRET_HEADERS.xCronSecret),
  })

  const auth = verifyCronSecret(provided)
  if (!auth.ok) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const result = await runRegistrationReminders()
  return { ok: true, ...result }
})
