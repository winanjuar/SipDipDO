import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  asDayKey,
  diffCalendarDays,
  isDayOnOrBefore,
  jakartaDayKey,
} from './calendar'

describe('jakartaDayKey (AD-9 — boundary hari Asia/Jakarta, UTC+7)', () => {
  it('16:59:59Z masih hari yang sama; 17:00:00Z (00:00 WIB) sudah hari berikutnya', () => {
    expect(jakartaDayKey(new Date('2026-09-15T16:59:59.999Z'))).toBe('2026-09-15')
    expect(jakartaDayKey(new Date('2026-09-15T17:00:00.000Z'))).toBe('2026-09-16')
  })

  it('tengah hari UTC jatuh di hari yang sama WIB', () => {
    expect(jakartaDayKey(new Date('2026-01-01T04:30:00Z'))).toBe('2026-01-01') // 11:30 WIB
    expect(jakartaDayKey(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01') // 03:00 WIB tahun baru
  })
})

describe('addCalendarDays (hari KALENDER, bukan 24 jam)', () => {
  it('rollover bulan dan tahun', () => {
    expect(addCalendarDays(asDayKey('2026-01-31'), 1)).toBe('2026-02-01')
    expect(addCalendarDays(asDayKey('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addCalendarDays(asDayKey('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('tahun kabisat', () => {
    expect(addCalendarDays(asDayKey('2024-02-28'), 1)).toBe('2024-02-29')
    expect(addCalendarDays(asDayKey('2026-02-28'), 1)).toBe('2026-03-01')
  })

  it('menambah beberapa hari melewati bulan', () => {
    expect(addCalendarDays(asDayKey('2026-09-25'), 10)).toBe('2026-10-05')
  })
})

describe('diffCalendarDays & isDayOnOrBefore', () => {
  it('selisih hari kalender (expiry hari ke-7)', () => {
    expect(diffCalendarDays(asDayKey('2026-09-01'), asDayKey('2026-09-08'))).toBe(7)
    expect(diffCalendarDays(asDayKey('2026-08-31'), asDayKey('2026-09-01'))).toBe(1)
    expect(diffCalendarDays(asDayKey('2026-09-08'), asDayKey('2026-09-01'))).toBe(-7)
  })

  it('pengingat H-3: submit 09-01 -> pengingat 09-05, expiry hari ke-7 09-08', () => {
    const submitted = asDayKey('2026-09-01')
    const reminderDay = addCalendarDays(submitted, 4) // H-3 sebelum hari ke-7
    const expiryDay = addCalendarDays(submitted, 7)
    expect(reminderDay).toBe('2026-09-05')
    expect(expiryDay).toBe('2026-09-08')
    expect(diffCalendarDays(reminderDay, expiryDay)).toBe(3)
    expect(isDayOnOrBefore(reminderDay, expiryDay)).toBe(true)
  })

  it('isDayOnOrBefore: hari-sama inklusif (true) dan tanggal lebih awal (false)', () => {
    const day = asDayKey('2026-09-05')
    expect(isDayOnOrBefore(day, day)).toBe(true) // boundary inklusif
    expect(isDayOnOrBefore(asDayKey('2026-09-06'), day)).toBe(false) // a setelah b
  })

  it('menolak kunci hari yang tidak berbentuk YYYY-MM-DD', () => {
    expect(() => asDayKey('2026-9-1')).toThrow()
    expect(() => asDayKey('20260901')).toThrow()
  })

  it('menolak tanggal kalender yang tidak ada (validasi semantik, bukan hanya regex)', () => {
    expect(() => asDayKey('2026-02-31')).toThrow() // Februari non-kabisat max 28
    expect(() => asDayKey('2026-02-29')).toThrow()
    expect(() => asDayKey('2024-02-30')).toThrow() // kabisat max 29
    expect(() => asDayKey('2026-04-31')).toThrow() // April max 30
    expect(() => asDayKey('2026-13-01')).toThrow() // bulan > 12
    expect(() => asDayKey('2026-00-10')).toThrow() // bulan < 1
    expect(() => asDayKey('2026-01-00')).toThrow() // hari < 1
    // batas yang SAH tetap diterima:
    expect(asDayKey('2024-02-29')).toBe('2024-02-29')
    expect(asDayKey('2026-12-31')).toBe('2026-12-31')
  })
})
