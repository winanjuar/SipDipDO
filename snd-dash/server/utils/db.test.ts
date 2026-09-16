// server/utils/db.test.ts
//
// Unit test untuk konvensi urutan lock global (AD-2) di server/utils/db.ts.
// Tidak memerlukan koneksi DB hidup — hanya menguji konstanta & helper murni.

import { describe, expect, it } from 'vitest'
import {
  GLOBAL_LOCK_ORDER,
  lockRank,
  orderLocks,
  type LockableTable,
} from './db'

describe('GLOBAL_LOCK_ORDER (AD-2)', () => {
  it('mengikuti urutan kanonik design.md B.4', () => {
    expect([...GLOBAL_LOCK_ORDER]).toEqual([
      'buy_orders',
      'rkap_phases',
      'positions',
      'owners',
      'contribution_periods',
      'distribution',
    ])
  })

  it('tidak memuat tabel duplikat', () => {
    expect(new Set(GLOBAL_LOCK_ORDER).size).toBe(GLOBAL_LOCK_ORDER.length)
  })
})

describe('lockRank', () => {
  it('memberi peringkat naik sesuai urutan global', () => {
    expect(lockRank('buy_orders')).toBeLessThan(lockRank('rkap_phases'))
    expect(lockRank('positions')).toBeLessThan(lockRank('owners'))
    expect(lockRank('owners')).toBeLessThan(lockRank('distribution'))
  })
})

describe('orderLocks', () => {
  it('mengurutkan tabel acak ke urutan lock global', () => {
    const input: LockableTable[] = ['owners', 'buy_orders', 'positions']
    expect(orderLocks(input)).toEqual(['buy_orders', 'positions', 'owners'])
  })

  it('mendeduplikasi tabel yang berulang', () => {
    const input: LockableTable[] = ['positions', 'positions', 'buy_orders']
    expect(orderLocks(input)).toEqual(['buy_orders', 'positions'])
  })

  it('tidak pernah mengunci owners sebelum positions (cegah AB-BA)', () => {
    const ordered = orderLocks(['owners', 'positions'])
    expect(ordered.indexOf('positions')).toBeLessThan(ordered.indexOf('owners'))
  })
})
