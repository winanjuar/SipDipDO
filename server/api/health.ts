import { sql } from 'drizzle-orm'
import { HTTP_STATUS, sendApiError } from '../utils/api-error'
import { useDb } from '../utils/db'

/**
 * Health check tipis (route = parsing + delegasi; tanpa sufiks metode agar HEAD juga terlayani — verifikasi curl -I). Memverifikasi koneksi
 * pooler postgres.js bila NUXT_DATABASE_URL dikonfigurasi.
 * Header `Cache-Control: no-store` datang dari routeRules `/api/**` (AD-12).
 */
export default defineEventHandler(async (event) => {
  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    return { status: 'ok', database: 'not-configured' }
  }
  try {
    await useDb().execute(sql`select 1`)
    return { status: 'ok', database: 'ok' }
  } catch (error) {
    return sendApiError(event, HTTP_STATUS.serviceUnavailable, {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Database tidak dapat dihubungi.',
      details: { cause: error instanceof Error ? error.message : String(error) },
    })
  }
})
