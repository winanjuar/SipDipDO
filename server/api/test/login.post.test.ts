/**
 * Unit test kaki guard endpoint dev-only `/api/test/login` (Story 1.2 — pola 1
 * test design R-003): predikat triple guard diekstrak murni (`tripleGuardLolos`)
 * sehingga tiap kaki teruji tanpa Nitro — NODE_ENV production, flag mati, dan
 * secret salah/kosong WAJIB ditolak; kombinasi sah diterima.
 */
import { describe, expect, test } from 'vitest'
import { tripleGuardLolos } from './login.post'

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
