import { describe, expect, it } from 'vitest'
import { asDayKey } from '#shared/domain/calendar'
import {
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  registrationDeadline,
  runRegistrationDailyJob,
} from './registration.service'

describe('registrationDeadline (FR-22/AD-11 — hari kalender, zona Asia/Jakarta)', () => {
  it('submit 2026-09-01 -> reminder 2026-09-05 (H-3), expiry 2026-09-08 (hari ke-7)', () => {
    expect(registrationDeadline(asDayKey('2026-09-01'))).toEqual({
      submittedOn: '2026-09-01',
      reminderOn: '2026-09-05',
      expiresOn: '2026-09-08',
    })
  })

  it('konstanta batas dipinkan (7 hari expiry, pengingat H-3)', () => {
    expect(REGISTRATION_EXPIRY_DAYS).toBe(7)
    expect(REGISTRATION_REMINDER_DAYS_BEFORE).toBe(3)
  })
})

describe('runRegistrationDailyJob (kerangka cron scaffold)', () => {
  it('no-op dengan kontrak balikan tetap sampai tabel owners ada (Story 1.4/1.6)', async () => {
    await expect(runRegistrationDailyJob(asDayKey('2026-09-16'))).resolves.toEqual({ reminded: 0, expired: 0 })
  })
})
