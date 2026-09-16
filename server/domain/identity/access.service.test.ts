/**
 * ATDD RED-PHASE (Vitest) — kontrak `server/domain/identity/access.service.ts`
 * Story 1.2: `resolveRole(owner, cooAktif)` murni (precedence COO, design
 * notes spec) + `buildPrincipal(repo, email)` dengan DI repo.
 *
 * Kontrak test design `1-UNIT-001` (subset) — R-003/AD-11. SEMUA test
 * `test.skip()` — fase TDD RED: modul belum ada. Impor memakai
 * `await import(...)` DI DALAM body test agar koleksi suite tetap sehat;
 * pelepasan skip → import gagal = merah jujur, hijau setelah service
 * ditulis (tugas Story 1.2).
 *
 * Precedence landing ter-pin (design notes spec): unlinked (tanpa baris) →
 * COO aktif → first_effective_at (pemegang saham) → terverifikasi tanpa
 * pembelian / keluar (tanpa_saham) → diajukan/ditolak/kedaluwarsa
 * (calon_owner). Role TIDAK PERNAH dari positions.shares (AD-8/AD-11).
 */
import { describe, expect, test } from 'vitest'

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

/** Specifier non-literal (bukan string literal) agar TS2307 "module not
 *  found" tidak merusak `typecheck` selagi modul belum ada; runtime tetap
 *  impor relatif yang sama. Setelah modul ditulis, boleh diganti impor
 *  statis biasa. */
const MODUL_ACCESS = './access.service'

/** Bentuk minimal yang dikontrak modul (tanda tangan final dipinkan saat green). */
interface ModulAccess {
  resolveRole: (owner: OwnerUji, cooAktif: boolean) => string
  buildPrincipal: (
    repo: { findOwnerByEmail: (email: string) => Promise<OwnerUji | null> },
    email: string,
  ) => Promise<Record<string, unknown>>
}

const muatAccess = async (): Promise<ModulAccess> =>
  (await import(MODUL_ACCESS)) as ModulAccess

describe.skip('server/domain/identity/access.service — resolveRole (1-UNIT-001 subset)', () => {
  test('COO aktif menang di atas pemegang saham (precedence)', async () => {
    const { resolveRole } = await muatAccess()

    const pemilikCooJugaSaham = owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' })
    expect(resolveRole(pemilikCooJugaSaham, true)).toBe('coo')
  })

  test('first_effective_at terisi tanpa tenure COO → pemegang_saham', async () => {
    const { resolveRole } = await muatAccess()

    expect(resolveRole(owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' }), false)).toBe('pemegang_saham')
  })

  test('terverifikasi tanpa first_effective_at → tanpa_saham', async () => {
    const { resolveRole } = await muatAccess()

    expect(resolveRole(owner(), false)).toBe('tanpa_saham')
  })

  test('keluar → tanpa_saham (Halaman Personal)', async () => {
    const { resolveRole } = await muatAccess()

    expect(resolveRole(owner({ status: 'keluar', firstEffectiveAt: '2025-08-01T00:00:00.000Z' }), false)).toBe('tanpa_saham')
  })

  test('calon owner: diajukan, ditolak, kedaluwarsa → calon_owner', async () => {
    const { resolveRole } = await muatAccess()
    const statusCalon = ['diajukan', 'ditolak', 'kedaluwarsa'] as const

    for (const status of statusCalon) {
      expect(resolveRole(owner({ status }), false)).toBe('calon_owner')
    }
  })
})

describe.skip('server/domain/identity/access.service — buildPrincipal (DI repo)', () => {
  test('email tanpa baris owner → principal unlinked', async () => {
    const { buildPrincipal } = await muatAccess()
    const repoKosong = { findOwnerByEmail: async () => null }

    const principal = await buildPrincipal(repoKosong, 'tak-terhubung@example.test')
    expect(principal).toEqual({ unlinked: true })
  })

  test('email dengan baris owner → principal ber-role hasil resolveRole', async () => {
    const { buildPrincipal } = await muatAccess()
    const pemilik = owner({ firstEffectiveAt: '2026-01-05T00:00:00.000Z' })
    const repoSatuOwner = { findOwnerByEmail: async () => pemilik }

    const principal = await buildPrincipal(repoSatuOwner, pemilik.email)
    expect(principal).toMatchObject({ role: 'pemegang_saham', owner: { email: pemilik.email } })
  })
})
