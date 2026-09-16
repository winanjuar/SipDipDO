/**
 * ATDD RED-PHASE (Vitest) — kontrak `shared/domain/identity.ts` Story 1.2:
 * tipe `OwnerStatus` (AD-11), `Role`, dan peta konstanta `LANDING_PATH`
 * role→route (kontrak murni lintas lapis, tanpa I/O — AD-6).
 *
 * SEMUA test `test.skip()` — fase TDD RED: modul belum ada. Impor memakai
 * `await import(...)` DI DALAM body test agar koleksi suite tetap sehat
 * (fail-to-import saat skip tidak merusak `npm test`); saat developer
 * melepas skip, import gagal = merah jujur, lalu hijau setelah modul
 * ditulis (tugas pertama Story 1.2).
 */
import { describe, expect, test } from 'vitest'

/** Specifier non-literal (bukan string literal) agar TS2307 "module not
 *  found" tidak merusak `typecheck` selagi modul belum ada; runtime tetap
 *  impor relatif yang sama. Setelah modul ditulis, boleh diganti impor
 *  statis biasa. */
const MODUL_IDENTITY = './identity'

/** Bentuk minimal yang dikontrak modul (type-level dipinkan penuh saat green). */
interface ModulIdentity {
  LANDING_PATH: Record<string, string>
}

const muatIdentity = async (): Promise<ModulIdentity> =>
  (await import(MODUL_IDENTITY)) as ModulIdentity

/** Landing map ter-pin spec Story 1.2 (UX-DR14). */
const LANDING_PATH_TERPIN = {
  coo: '/antrian-beli',
  pemegang_saham: '/dashboard',
  tanpa_saham: '/personal',
  calon_owner: '/status-pendaftaran',
} as const

describe.skip('shared/domain/identity — LANDING_PATH (1-UNIT-001 subset)', () => {
  test('memetakan keempat role ke landing path yang ter-pin', async () => {
    const { LANDING_PATH } = await muatIdentity()

    expect(LANDING_PATH).toEqual(LANDING_PATH_TERPIN)
  })

  test('kunci peta tepat sama dengan enum Role (tanpa role liar)', async () => {
    const { LANDING_PATH } = await muatIdentity()
    const roles: readonly string[] = ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner']

    expect(Object.keys(LANDING_PATH).sort()).toEqual([...roles].sort())
  })
})
