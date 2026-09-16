import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutboxEmail } from '../../../drizzle/schema'
import { useDb } from '../../utils/db'
import { enqueueOutboxEmail, listDueOutboxEmails, markOutboxEmailAttemptFailed, markOutboxEmailSent } from './outbox.repo'
import { dispatchPendingOutboxEmails, enqueueEmail } from './outbox.service'
import type { MailClient, MailMessage, MailSendResult } from './resend.client'

// Repo dimock penuh — yang diuji adalah orkestrasi service (backoff, exhausted,
// guard race, kontrak enqueue). `useDb` di-import eksplisit oleh service.
// (vi.mock di-hoist ke atas import oleh Vitest.)
vi.mock('../../utils/db', () => ({ useDb: vi.fn(() => ({ __db: true })) }))
vi.mock('./outbox.repo', () => ({
  enqueueOutboxEmail: vi.fn(),
  listDueOutboxEmails: vi.fn(),
  markOutboxEmailSent: vi.fn(),
  markOutboxEmailAttemptFailed: vi.fn(),
}))

// `useRuntimeConfig` adalah auto-import global Nitro — disuntik sebagai global.
declare global {
  var useRuntimeConfig: ((overrides?: Record<string, unknown>) => Record<string, unknown>) | undefined
}

function row(overrides: Partial<OutboxEmail> = {}): OutboxEmail {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'notifikasi',
    toAddress: 'owner@example.test',
    payload: { foo: 'bar' },
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: '2026-09-16T00:00:00.000Z',
    sendAfter: '2026-09-16T00:00:00.000Z',
    sentAt: null,
    ...overrides,
  }
}

const NOW = new Date('2026-09-16T02:00:00.000Z')

function okClient(): { client: MailClient, send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async (_from: string, _message: MailMessage): Promise<MailSendResult> => ({ ok: true, messageId: 're_test' }))
  return { client: { send }, send }
}

function retryableFailClient(): { client: MailClient, send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async (_from: string, _message: MailMessage): Promise<MailSendResult> => ({ ok: false, error: 'boom', retryable: true }))
  return { client: { send }, send }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  globalThis.useRuntimeConfig = () => ({ resendApiKey: 'test-key', resendFrom: 'Sip & Dip <noreply@example.test>' })
})

afterEach(() => {
  globalThis.useRuntimeConfig = undefined
  vi.restoreAllMocks()
})

describe('dispatchPendingOutboxEmails (mesin outbox AR-6/R-009)', () => {
  it('sukses kirim → markOutboxEmailSent dipanggil dan dihitung sent', async () => {
    const due = row()
    vi.mocked(listDueOutboxEmails).mockResolvedValue([due])
    vi.mocked(markOutboxEmailSent).mockResolvedValue({ ...due, status: 'sent' })
    const { client, send } = okClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]).toContain('Sip & Dip <noreply@example.test>')
    expect(vi.mocked(markOutboxEmailSent)).toHaveBeenCalledWith(useDb(), due.id, NOW)
    expect(vi.mocked(markOutboxEmailAttemptFailed)).not.toHaveBeenCalled()
  })

  it('gagal retryable → backoff [1, 5, 30, 120] menit sesuai attempts', async () => {
    const rows = [0, 1, 2, 3].map(attempts => row({ id: `00000000-0000-4000-8000-00000000000${attempts}`, attempts }))
    vi.mocked(listDueOutboxEmails).mockResolvedValue(rows)
    vi.mocked(markOutboxEmailAttemptFailed).mockImplementation(async (_db, input) => row({ id: input.id, attempts: input.readAttempts + 1 }))
    const { client, send } = retryableFailClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 4, sent: 0, failed: 4 })
    expect(send).toHaveBeenCalledTimes(4)
    const sendAfters = vi.mocked(markOutboxEmailAttemptFailed).mock.calls.map(([, input]) => input.sendAfter.toISOString())
    expect(sendAfters).toEqual([
      new Date(NOW.getTime() + 1 * 60_000).toISOString(),
      new Date(NOW.getTime() + 5 * 60_000).toISOString(),
      new Date(NOW.getTime() + 30 * 60_000).toISOString(),
      new Date(NOW.getTime() + 120 * 60_000).toISOString(),
    ])
    for (const [, input] of vi.mocked(markOutboxEmailAttemptFailed).mock.calls) {
      expect(input.maxAttempts).toBe(5)
    }
  })

  it('attempts 4 gagal → percobaan ke-5 mencapai maxAttempts (exhausted)', async () => {
    vi.mocked(listDueOutboxEmails).mockResolvedValue([row({ attempts: 4 })])
    vi.mocked(markOutboxEmailAttemptFailed).mockResolvedValue(row({ attempts: 5 }))
    const { client } = retryableFailClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 })
    expect(vi.mocked(markOutboxEmailAttemptFailed)).toHaveBeenCalledWith(
      useDb(),
      expect.objectContaining({ readAttempts: 4, maxAttempts: 5 }),
    )
  })

  it('tanpa NUXT_RESEND_FROM → tidak mengirim, baris tetap pending (tidak ditandai gagal)', async () => {
    globalThis.useRuntimeConfig = () => ({ resendApiKey: '', resendFrom: '' })
    vi.mocked(listDueOutboxEmails).mockResolvedValue([row()])
    const { client, send } = okClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 })
    expect(send).not.toHaveBeenCalled()
    expect(vi.mocked(markOutboxEmailSent)).not.toHaveBeenCalled()
    expect(vi.mocked(markOutboxEmailAttemptFailed)).not.toHaveBeenCalled()
  })

  it('mark sent kembali undefined (race dispatcher) → tidak dihitung sent ganda', async () => {
    vi.mocked(listDueOutboxEmails).mockResolvedValue([row()])
    vi.mocked(markOutboxEmailSent).mockResolvedValue(undefined)
    const { client } = okClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 })
  })

  it('CAS failure-mark kembali undefined (penulis konkuren) → skip', async () => {
    vi.mocked(listDueOutboxEmails).mockResolvedValue([row()])
    vi.mocked(markOutboxEmailAttemptFailed).mockResolvedValue(undefined)
    const { client } = retryableFailClient()

    const result = await dispatchPendingOutboxEmails({ now: NOW, mailClient: client })

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 })
  })
})

describe('enqueueEmail (baris in-tx, AR-6)', () => {
  it('menolak kind yang tidak terdaftar', () => {
    // Validasi throw sinkron (guard sebelum menyentuh repo).
    expect(() => enqueueEmail({} as never, { kind: 'tidak_ada' as never, to: 'owner@example.test', payload: {} }))
      .toThrow(/Jenis outbox tidak terdaftar/)
    expect(vi.mocked(enqueueOutboxEmail)).not.toHaveBeenCalled()
  })

  it('meneruskan kind terdaftar ke repo dalam tx pemanggil', async () => {
    const written = row({ kind: 'otp' })
    vi.mocked(enqueueOutboxEmail).mockResolvedValue(written)
    const tx = { __tx: true } as never

    await expect(enqueueEmail(tx, { kind: 'otp', to: 'owner@example.test', payload: { kode: '123456' } })).resolves.toBe(written)
    expect(vi.mocked(enqueueOutboxEmail)).toHaveBeenCalledWith(tx, { kind: 'otp', to: 'owner@example.test', payload: { kode: '123456' } })
  })
})
