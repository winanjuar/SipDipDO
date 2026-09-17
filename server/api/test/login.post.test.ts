/**
 * Unit test kaki guard endpoint dev-only `/api/test/login` (Story 1.2 — pola 1
 * test design R-003): predikat murni diekstrak (`tripleGuardLolos`,
 * `emailUjiSah`) sehingga tiap kaki teruji tanpa Nitro — NODE_ENV production,
 * flag mati, dan secret salah/kosong WAJIB ditolak; kombinasi sah diterima.
 * Email sintetis mint: kontrak spec (akun owner = akun Google) hanya boleh
 * `uji.snddash.e2e.*@gmail.com` — bukan domain uji lain, bukan baris seed dev.
 */
import { describe, expect, test } from 'vitest'
import { emailUjiSah, tripleGuardLolos } from './login.post'

const sah = {
  nodeEnv: 'test',
  enableFlag: '1',
  presentedSecret: 'test-secret-lokal',
  registeredSecret: 'test-secret-lokal',
}

describe('tripleGuardLolos (guard endpoint dev-only /api/test/login)', () => {
  test('kombinasi sah diterima (flag "1" maupun "true")', () => {
    expect(tripleGuardLolos(sah)).toBe(true)
    expect(tripleGuardLolos({ ...sah, enableFlag: 'true' })).toBe(true)
  })

  test('kaki NODE_ENV=production ditolak', () => {
    expect(tripleGuardLolos({ ...sah, nodeEnv: 'production' })).toBe(false)
  })

  test('kaki ENABLE_TEST_AUTH mati/kosong/nilaian lain ditolak', () => {
    expect(tripleGuardLolos({ ...sah, enableFlag: undefined })).toBe(false)
    expect(tripleGuardLolos({ ...sah, enableFlag: '0' })).toBe(false)
    expect(tripleGuardLolos({ ...sah, enableFlag: 'false' })).toBe(false)
  })

  test('kaki secret salah/kosong (kirim maupun terdaftar) ditolak', () => {
    expect(tripleGuardLolos({ ...sah, presentedSecret: 'bukan-secret' })).toBe(false)
    expect(tripleGuardLolos({ ...sah, presentedSecret: '' })).toBe(false)
    expect(tripleGuardLolos({ ...sah, registeredSecret: '' })).toBe(false)
  })
})

describe('emailUjiSah (kontrak email sintetis mint — hanya @gmail.com)', () => {
  test('awalan uji E2E + @gmail.com diterima (case-insensitive)', () => {
    expect(emailUjiSah('uji.snddash.e2e.coo@gmail.com')).toBe(true)
    expect(emailUjiSah('uji.snddash.e2e.calon.ditolak@gmail.com')).toBe(true)
    expect(emailUjiSah('UJI.SNDDASH.E2E.COO@GMAIL.COM')).toBe(true)
  })

  test('tanpa awalan uji E2E ditolak — termasuk gmail polos dan baris seed dev', () => {
    expect(emailUjiSah('coo@gmail.com')).toBe(false)
    expect(emailUjiSah('uji.snddash.coo@gmail.com')).toBe(false)
    expect(emailUjiSah('owner.nyata@gmail.com')).toBe(false)
  })

  test('domain selain @gmail.com ditolak — termasuk domain uji legacy', () => {
    expect(emailUjiSah('uji.snddash.e2e.coo@uji.example.test')).toBe(false)
    expect(emailUjiSah('uji.snddash.e2e.coo@gmail.co.id')).toBe(false)
    expect(emailUjiSah('uji.snddash.e2e.coo@yahoo.com')).toBe(false)
  })
})
