/**
 * ATDD (Vitest) — kontrak `shared/domain/identity.ts` Story 1.2: tipe
 * `OwnerStatus` (AD-11), `Role`, dan peta konstanta `LANDING_PATH` role→route
 * (kontrak murni lintas lapis, tanpa I/O — AD-6). Story 1.4: konstanta +
 * generator kode referral (murni, sumber acak disuntikkan).
 *
 * GREEN: modul sudah ada (Story 1.2) — impor statis, asersi ter-pin dari
 * red-phase tidak berubah.
 */
import { describe, expect, test } from 'vitest'
import { buatKodeReferral, LANDING_PATH, PANJANG_KODE_REFERRAL } from './identity'

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

describe('shared/domain/identity — buatKodeReferral (Story 1.4, keputusan owner 2026-09-18)', () => {
  test('panjang tepat PANJANG_KODE_REFERRAL dan seluruh karakter alfanumerik (besar/kecil/digit)', () => {
    const kode = buatKodeReferral()
    expect(kode).toHaveLength(PANJANG_KODE_REFERRAL)
    expect(kode).toMatch(/^[A-Za-z0-9]+$/)
  })

  test('sumber acak disuntikkan → keluaran deterministik dari indeks karakter', () => {
    // angkaAcak konstan 0 → indeks 0 → karakter pertama himpunan ('A').
    expect(buatKodeReferral(() => 0)).toBe('AAAAAAAA')
    // 0.999999 × 62 = 61.99… → indeks 61 → karakter terakhir himpunan ('9').
    expect(buatKodeReferral(() => 0.999999)).toBe('99999999')
    // 0.5 × 62 = 31 → indeks 31 → huruf kecil 'f' (zona lowercase, indeks 26-51).
    expect(buatKodeReferral(() => 0.5)).toBe('ffffffff')
  })
})
