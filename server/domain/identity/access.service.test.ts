/**
 * ATDD (Vitest) — kontrak `server/domain/identity/access.service.ts`
 * Story 1.2: `resolveRole(owner, cooAktif)` murni (precedence COO, design
 * notes spec) + `buildPrincipal(repo, email)` dengan DI repo.
 *
 * Kontrak test design `1-UNIT-001` (subset) — R-003/AD-11. GREEN: modul sudah
 * ada — impor statis biasa (penyempurnaan yang disanksi red-phase), asersi
 * ter-pin tidak berubah.
 *
 * Precedence landing ter-pin (design notes spec): unlinked (tanpa baris) →
 * COO aktif → first_effective_at (pemegang saham) → terverifikasi tanpa
 * pembelian / keluar (tanpa_saham) → diajukan/ditolak/kedaluwarsa
 * (calon_owner). Role TIDAK PERNAH dari positions.shares (AD-8/AD-11).
 */
import { describe, expect, test } from 'vitest'
import { buildPrincipal, resolveRole } from './access.service'

/** Bentuk owner minimal untuk resolveRole — kolom nyata menyusul di repo. */
interface OwnerUji {
  email: string
  status: 'diajukan' | 'terverifikasi' | 'ditolak' | 'kedaluwarsa' | 'keluar'
  firstEffectiveAt: string | null
}

const owner = (overrides: Partial<OwnerUji> = {}): OwnerUji => ({
  email: 'owner-sintetis@example.test',
  status: 'terverifikasi',
  firstEffectiveAt: null,
  ...overrides,
})

describe('server/domain/identity/access.service — resolveRole (1-UNIT-001 subset)', () => {
  test('COO aktif menang di atas pemegang saham (precedence)', () => {
    const pemilikCooJugaSaham = owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' })
    expect(resolveRole(pemilikCooJugaSaham, true)).toBe('coo')
  })

  test('first_effective_at terisi tanpa tenure COO → pemegang_saham', () => {
    expect(resolveRole(owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' }), false)).toBe('pemegang_saham')
  })

  test('terverifikasi tanpa first_effective_at → tanpa_saham', () => {
    expect(resolveRole(owner(), false)).toBe('tanpa_saham')
  })

  test('keluar → tanpa_saham (Halaman Personal)', () => {
    expect(resolveRole(owner({ status: 'keluar', firstEffectiveAt: '2025-08-01T00:00:00.000Z' }), false)).toBe('tanpa_saham')
  })

  test('calon owner: diajukan, ditolak, kedaluwarsa → calon_owner', () => {
    const statusCalon = ['diajukan', 'ditolak', 'kedaluwarsa'] as const

    for (const status of statusCalon) {
      expect(resolveRole(owner({ status }), false)).toBe('calon_owner')
    }
  })
})

describe('server/domain/identity/access.service — buildPrincipal (DI repo)', () => {
  test('email tanpa baris owner → principal unlinked', async () => {
    const repoKosong = { findOwnerByEmail: async () => null }

    const principal = await buildPrincipal(repoKosong, 'tak-terhubung@example.test')
    expect(principal).toEqual({ unlinked: true })
  })

  test('email dengan baris owner → principal ber-role hasil resolveRole', async () => {
    const pemilik = owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' })
    const repoSatuOwner = { findOwnerByEmail: async () => pemilik }

    const principal = await buildPrincipal(repoSatuOwner, pemilik.email)
    expect(principal).toMatchObject({ role: 'pemegang_saham', owner: { email: pemilik.email } })
  })
})
