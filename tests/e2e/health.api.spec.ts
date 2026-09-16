/**
 * SAMPLE API — pola acuan untuk spec API berikutnya (mandate playwright-utils):
 * impor `test` HANYA dari merged-fixtures; HTTP via `apiRequest` (bukan
 * request.get mentah); validasi schema zod satu-baris; log.step untuk milestone
 * GIVEN/WHEN/THEN. Endpoint nyata substrat — bukan karangan.
 */
import { z } from 'zod'
import { test, expect, log } from '../support/merged-fixtures'

const SkemaHealth = z.object({
  status: z.literal('ok'),
  database: z.enum(['ok', 'not-configured']),
})

test.describe('[P0] API /api/health', () => {
  test('health check menjawab ok beserta status database', async ({ apiRequest }) => {
    await log.step('GIVEN substrat berjalan (webServer lokal atau BASE_URL)')

    await log.step('WHEN GET /api/health divalidasi terhadap skema respons')
    const { status, body } = await apiRequest({
      method: 'GET',
      path: '/api/health',
      validateSchema: SkemaHealth,
    })

    await log.step('THEN status 200 dan status aplikasi ok')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
  })
})
