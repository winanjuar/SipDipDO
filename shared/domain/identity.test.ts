/**
 * ATDD (Vitest) — kontrak `shared/domain/identity.ts` Story 1.2: tipe
 * `OwnerStatus` (AD-11), `Role`, dan peta konstanta `LANDING_PATH` role→route
 * (kontrak murni lintas lapis, tanpa I/O — AD-6).
 *
 * GREEN: modul sudah ada (Story 1.2) — impor statis, asersi ter-pin dari
 * red-phase tidak berubah.
 */
import { describe, expect, test } from 'vitest'
import { LANDING_PATH } from './identity'

/** Landing map ter-pin spec Story 1.2 (UX-DR14). */
const LANDING_PATH_TERPIN = {
  coo: '/antrian-beli',
  pemegang_saham: '/dashboard',
  tanpa_saham: '/personal',
  calon_owner: '/status-pendaftaran',
} as const

describe('shared/domain/identity — LANDING_PATH (1-UNIT-001 subset)', () => {
  test('memetakan keempat role ke landing path yang ter-pin', () => {
    expect(LANDING_PATH).toEqual(LANDING_PATH_TERPIN)
  })

  test('kunci peta tepat sama dengan enum Role (tanpa role liar)', () => {
    const roles: readonly string[] = ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner']

    expect(Object.keys(LANDING_PATH).sort()).toEqual([...roles].sort())
  })
})
