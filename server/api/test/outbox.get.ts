import { defineEventHandler, getHeader, getQuery } from 'h3'
import { listOutboxEmailPenerima } from '../../domain/proofs'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { tripleGuardLolos } from './login.post'

/**
 * GET /api/test/outbox?email=<penerima> — inspeksi baris outbox DEV-ONLY
 * (Story 1.5, CAP-4/AR-6): test membaca baris outbox (bukan pengiriman
 * nyata Resend). Triple guard IDENTIK `/api/test/login` (predikat murni
 * `tripleGuardLolos` — NODE_ENV ≠ production + ENABLE_TEST_AUTH + header
 * TEST_AUTH_SECRET); di produksi endpoint ini mati total.
 *
 * Respons `{ data: [...] }` urut terbaru; TANPA jalur tulis (baca saja).
 */
export default defineEventHandler(async (event) => {
  const env = process.env
  if (!tripleGuardLolos({
    nodeEnv: env.NODE_ENV,
    enableFlag: env.ENABLE_TEST_AUTH,
    presentedSecret: getHeader(event, 'test_auth_secret') ?? '',
    registeredSecret: env.TEST_AUTH_SECRET ?? '',
  })) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'TEST_AUTH_DISABLED',
      message: 'Endpoint inspeksi outbox hanya untuk pengujian (triple guard tidak terpenuhi).',
      details: {},
    })
  }

  const query = getQuery(event)
  const email = typeof query.email === 'string' ? query.email.trim() : ''
  if (email.length === 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Query email wajib diisi.',
      details: {},
    })
  }

  const rows = await listOutboxEmailPenerima(useDb(), { to: email })
  return {
    data: rows.map(row => ({
      id: row.id,
      kind: row.kind,
      to: row.toAddress,
      status: row.status,
      payload: row.payload,
      attempts: row.attempts,
      createdAt: row.createdAt,
    })),
  }
})
