// server/api/cron/expire-orders.post.ts
//
// Endpoint cron TERPROTEKSI untuk kedaluwarsa Pesanan Pembelian hari-7
// (FR-19 §19.4). Dipicu Vercel Cron (UTC); memverifikasi `CRON_SECRET` sebelum
// menjalankan job. Batas hari-7 dihitung DI DALAM job memakai zona Asia/Jakarta
// (design.md "Deployment topology"/B.6/AD-9) — invarian terhadap jam pemicu UTC.
//
// KONTRAK ENDPOINT
//   Method  : POST
//   Path    : /api/cron/expire-orders
//   Auth    : header `Authorization: Bearer <CRON_SECRET>` ATAU
//             `x-cron-secret: <CRON_SECRET>`. 401 bila tidak diset/tidak cocok.
//   Body    : (diabaikan)
//   200     : { ok: true, jakartaToday, expired: string[], count: number }
//   401     : { statusMessage: 'Unauthorized' } bila secret hilang/tidak cocok
//             atau `CRON_SECRET` tidak dikonfigurasi (fail-closed).
//
// `defineEventHandler`, `getRequestHeader`, `createError` tersedia sebagai
// auto-import Nitro/h3 (lihat .nuxt/types/nitro-imports.d.ts).

import { runExpireOrders } from '../../jobs/expire-orders'
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

  const result = await runExpireOrders()
  return { ok: true, ...result }
})
