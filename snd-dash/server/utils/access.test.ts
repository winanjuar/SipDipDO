// server/utils/access.test.ts
//
// Unit test untuk guard akses server-otoritatif (§4.8, FR-15/FR-22).
// Fungsi murni — tidak memerlukan koneksi DB/sesi hidup.

import { describe, expect, it } from 'vitest'
import {
  AccessError,
  assertCanFinalize,
  assertOwnsOrder,
  assertSurfaceAccess,
  type Principal,
  type Surface,
} from './access'
import type { Uuid } from '../../shared/domain/types'

const OWNER_A = 'aaaaaaaa-0000-0000-0000-000000000000' as Uuid
const OWNER_B = 'bbbbbbbb-0000-0000-0000-000000000000' as Uuid

function principal(over: Partial<Principal> = {}): Principal {
  return {
    ownerId: OWNER_A,
    roles: ['owner'],
    status: 'terverifikasi',
    firstEffectiveAt: null,
    isCooOnDuty: false,
    hasUnredeemedPoints: false,
    profileComplete: true,
    ...over,
  }
}

function expectCode(fn: () => void, code: AccessError['code'], surface: Surface) {
  try {
    fn()
    throw new Error('expected AccessError but none thrown')
  } catch (err) {
    expect(err).toBeInstanceOf(AccessError)
    const e = err as AccessError
    expect(e.code).toBe(code)
    expect(e.surface).toBe(surface)
  }
}

describe('assertSurfaceAccess (§4.8)', () => {
  it('menolak principal null → UNAUTHENTICATED', () => {
    expectCode(() => assertSurfaceAccess(null, 'personal_page'), 'UNAUTHENTICATED', 'personal_page')
  })

  it('Calon Owner Profile belum lengkap: hanya registration/personal (§15.5)', () => {
    const p = principal({ status: 'diajukan', roles: ['calon_owner'], profileComplete: false })
    expect(() => assertSurfaceAccess(p, 'registration')).not.toThrow()
    expect(() => assertSurfaceAccess(p, 'personal_page')).not.toThrow()
    expectCode(() => assertSurfaceAccess(p, 'rkap_view'), 'REDIRECT_PERSONAL', 'rkap_view')
  })

  it('Owner tanpa saham: permukaan terkunci → redirect Halaman Personal (§15.7)', () => {
    const p = principal({ firstEffectiveAt: null })
    for (const s of ['dashboard_ownership', 'contribution', 'mom'] as Surface[]) {
      expectCode(() => assertSurfaceAccess(p, s), 'REDIRECT_PERSONAL', s)
    }
  })

  it('Owner tanpa saham: permukaan terbuka diizinkan (§15.6)', () => {
    const p = principal({ firstEffectiveAt: null })
    for (const s of ['orders_own', 'rkap_view', 'price_history', 'personal_page'] as Surface[]) {
      expect(() => assertSurfaceAccess(p, s)).not.toThrow()
    }
  })

  it('profit_recap Owner tanpa saham: hanya bila masih punya poin belum ditunaikan (§15.6/§16.11)', () => {
    const withPoints = principal({ firstEffectiveAt: null, hasUnredeemedPoints: true })
    expect(() => assertSurfaceAccess(withPoints, 'profit_recap')).not.toThrow()
    const noPoints = principal({ firstEffectiveAt: null, hasUnredeemedPoints: false })
    expectCode(() => assertSurfaceAccess(noPoints, 'profit_recap'), 'REDIRECT_PERSONAL', 'profit_recap')
  })

  it('akses penuh terbuka otomatis pasca Pembelian Pertama efektif (§15.8)', () => {
    const p = principal({ firstEffectiveAt: new Date('2024-01-01T00:00:00Z') })
    for (const s of ['dashboard_ownership', 'contribution', 'mom', 'profit_recap'] as Surface[]) {
      expect(() => assertSurfaceAccess(p, s)).not.toThrow()
    }
  })

  it('Owner Keluar tidak memperoleh akses penuh meski firstEffectiveAt terisi (§15.7)', () => {
    const p = principal({ status: 'keluar', firstEffectiveAt: new Date('2024-01-01T00:00:00Z') })
    expectCode(() => assertSurfaceAccess(p, 'dashboard_ownership'), 'REDIRECT_PERSONAL', 'dashboard_ownership')
  })

  it('permukaan COO-only ditolak untuk Owner biasa → FORBIDDEN (§15.3)', () => {
    const p = principal({ roles: ['owner'], isCooOnDuty: false })
    expectCode(() => assertSurfaceAccess(p, 'queue_coo'), 'FORBIDDEN', 'queue_coo')
    expectCode(() => assertSurfaceAccess(p, 'audit_trail'), 'FORBIDDEN', 'audit_trail')
  })

  it('permukaan COO-only diizinkan untuk COO bertugas (§15.2)', () => {
    const coo = principal({ roles: ['owner', 'coo'], isCooOnDuty: true })
    expect(() => assertSurfaceAccess(coo, 'queue_coo')).not.toThrow()
    expect(() => assertSurfaceAccess(coo, 'audit_trail')).not.toThrow()
  })
})

describe('assertOwnsOrder (§15.4)', () => {
  it('mengizinkan akses pesanan milik sendiri', () => {
    expect(() => assertOwnsOrder(OWNER_A, OWNER_A)).not.toThrow()
  })
  it('menolak akses pesanan milik Owner lain → FORBIDDEN', () => {
    expectCode(() => assertOwnsOrder(OWNER_A, OWNER_B), 'FORBIDDEN', 'orders_own')
  })
})

describe('assertCanFinalize (§15.3)', () => {
  it('menolak Owner memfinalisasi transaksi → FORBIDDEN', () => {
    expectCode(
      () => assertCanFinalize({ roles: ['owner'], isCooOnDuty: false }),
      'FORBIDDEN',
      'queue_coo',
    )
  })
  it('mengizinkan COO bertugas memfinalisasi', () => {
    expect(() => assertCanFinalize({ roles: ['owner', 'coo'], isCooOnDuty: true })).not.toThrow()
  })
})
