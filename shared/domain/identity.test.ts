/**
 * ATDD (Vitest) — kontrak `shared/domain/identity.ts` Story 1.2: tipe
 * `OwnerStatus` (AD-11), `Role`, dan peta konstanta `LANDING_PATH` role→route
 * (kontrak murni lintas lapis, tanpa I/O — AD-6). Story 1.4: konstanta +
 * generator kode referral (murni, sumber acak disuntikkan).
 *
 * Story 1.7 (ATDD RED-PHASE): blok `describe` bertanda RED-PHASE di bawah
 * memin kontrak predikat akses kanonik (`aksesPenuh`/`perluReferral`/
 * `layakPilihanReferral`), registry `permukaanDibolehkan`/`itemNavigasi`,
 * dan konstanta `PESAN_TRANSPARANSI`/`MAKS_ITEM_NAV_MOBILE` yang BELUM
 * diekspor modul. Scaffold memakai dynamic import + cast `Record<string,
 * unknown>` agar suite hijau eksisting dan typecheck TIDAK pecah selama
 * red phase — test-nya `test.skip` sehingga body tak pernah dieksekusi.
 * SAAT GREEN-PHASE: tambahkan ekspor di `identity.ts`, lalu un-skip dan
 * ganti dynamic import dengan impor statis biasa.
 *
 * GREEN: modul sudah ada (Story 1.2) — impor statis, asersi ter-pin dari
 * red-phase tidak berubah.
 */
import { describe, expect, test } from 'vitest'
import type { OwnerAccessSnapshot, OwnerStatus, Principal, Role } from './identity'
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

/**
 * ═══ ATDD RED-PHASE Story 1.7 ═══ Blok di bawah pin kontrak predikat akses
 * kanonik + registry (spec 1.7, AD-8/AD-11; test design 1-UNIT-001 subset
 * lanjutan). Scaffold merah: kontrak belum diekspor `identity.ts` — modul
 * diakses dynamic import + cast agar suite hijau eksisting & typecheck tak
 * pecah; `test.skip` = intentional (un-skip + impor statis saat green).
 */

/** Instant kanonik Pembelian Pertama efektif — tengah hari WIB (pola DayKey). */
const INSTANT_EFEKTIF = '2026-01-10T05:00:00.000Z'

/** Paritas MAKS_ITEM_NAV_MOBILE (konstanta shared/domain saat green-phase). */
const PARITAS_MAKS_ITEM_NAV_MOBILE = 4

/** Pesan transparansi VERBATIM (paritas PESAN_TRANSPARANSI + spec 1.7). */
const PARITAS_PESAN_TRANSPARANSI = 'Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.'

/** Matriks 7 kombinasi {status × firstEffectiveAt} — urutan kolom (aksesPenuh, perluReferral, layakPilihanReferral). */
const MATRIKS_AKSES: readonly {
  status: OwnerStatus
  firstEffectiveAt: string | null
  aksesPenuh: boolean
  perluReferral: boolean
  layakPilihanReferral: boolean
}[] = [
  { status: 'diajukan', firstEffectiveAt: null, aksesPenuh: false, perluReferral: false, layakPilihanReferral: false },
  { status: 'ditolak', firstEffectiveAt: null, aksesPenuh: false, perluReferral: false, layakPilihanReferral: false },
  { status: 'kedaluwarsa', firstEffectiveAt: null, aksesPenuh: false, perluReferral: false, layakPilihanReferral: false },
  { status: 'terverifikasi', firstEffectiveAt: null, aksesPenuh: false, perluReferral: true, layakPilihanReferral: true },
  { status: 'terverifikasi', firstEffectiveAt: INSTANT_EFEKTIF, aksesPenuh: true, perluReferral: false, layakPilihanReferral: true },
  { status: 'keluar', firstEffectiveAt: null, aksesPenuh: false, perluReferral: true, layakPilihanReferral: true },
  { status: 'keluar', firstEffectiveAt: INSTANT_EFEKTIF, aksesPenuh: true, perluReferral: false, layakPilihanReferral: true },
]

describe('shared/domain/identity — predikat akses kanonik (Story 1.7, ATDD RED-PHASE)', () => {
  test.skip('aksesPenuh: true PERSIS saat firstEffectiveAt terisi — termasuk keluar-pernah-beli (AD-8)', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const aksesPenuh = mod.aksesPenuh as (snapshot: OwnerAccessSnapshot) => boolean
    for (const baris of MATRIKS_AKSES) {
      expect(aksesPenuh({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.aksesPenuh)
    }
  })

  test.skip('perluReferral: owner belum-pernah-beli dari status terverifikasi/keluar (cakupan AD-11)', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const perluReferral = mod.perluReferral as (snapshot: OwnerAccessSnapshot) => boolean
    for (const baris of MATRIKS_AKSES) {
      expect(perluReferral({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.perluReferral)
    }
  })

  test.skip('layakPilihanReferral: pemegang saham (termasuk COO) atau owner belum-pernah-beli', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const layakPilihanReferral = mod.layakPilihanReferral as (snapshot: OwnerAccessSnapshot) => boolean
    for (const baris of MATRIKS_AKSES) {
      expect(layakPilihanReferral({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.layakPilihanReferral)
    }
  })

  test.skip('konstanta: PESAN_TRANSPARANSI verbatim + MAKS_ITEM_NAV_MOBILE = 4 (UX-DR14)', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    expect(mod.PESAN_TRANSPARANSI as string).toBe(PARITAS_PESAN_TRANSPARANSI)
    expect(mod.MAKS_ITEM_NAV_MOBILE as number).toBe(PARITAS_MAKS_ITEM_NAV_MOBILE)
  })
})

/** Snapshot owner uji — Pembelian Pertama efektif dikontrol eksplisit. */
const snapUji = (status: OwnerStatus, sudahBeli: boolean): OwnerAccessSnapshot => ({
  status,
  firstEffectiveAt: sudahBeli ? INSTANT_EFEKTIF : null,
})

/** Principal linked uji — bentuk eksak `Principal` (profil dianggap apa adanya). */
const principalUji = (role: Role, snapshot: OwnerAccessSnapshot): Principal => ({
  unlinked: false,
  role,
  owner: {
    email: 'contoh.unit.uji@gmail.com',
    status: snapshot.status,
    rejectionReason: null,
    firstEffectiveAt: snapshot.firstEffectiveAt,
    profilLengkap: false,
  },
})

/** Registry terpin (spec 1.7): path → keputusan per principal — matriks §4.8. */
const KASUS_PERMUKAAN: readonly { deskripsi: string, principal: Principal, path: string, diizinkan: boolean }[] = [
  { deskripsi: 'tanpa_saham belum-beli × /dashboard', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/dashboard', diizinkan: false },
  { deskripsi: 'tanpa_saham belum-beli × /antrian-beli', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/antrian-beli', diizinkan: false },
  { deskripsi: 'tanpa_saham belum-beli × /audit-trail', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/audit-trail', diizinkan: false },
  { deskripsi: 'tanpa_saham belum-beli × /personal', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/personal', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /dashboard (aksesPenuh — kunci AD-8)', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /personal', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/personal', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /antrian-beli', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/antrian-beli', diizinkan: false },
  { deskripsi: 'pemegang_saham × /dashboard', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'pemegang_saham × /antrian-beli', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/antrian-beli', diizinkan: false },
  { deskripsi: 'pemegang_saham × /audit-trail', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/audit-trail', diizinkan: false },
  { deskripsi: 'pemegang_saham × /personal', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/personal', diizinkan: false },
  { deskripsi: 'coo × /antrian-beli', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/antrian-beli', diizinkan: true },
  { deskripsi: 'coo × /audit-trail', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/audit-trail', diizinkan: true },
  { deskripsi: 'coo × /dashboard (aksesPenuh via saham)', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'coo × /personal', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/personal', diizinkan: false },
  { deskripsi: 'calon_owner × /dashboard (gerbang calon urusan middleware)', principal: principalUji('calon_owner', snapUji('diajukan', false)), path: '/dashboard', diizinkan: false },
  { deskripsi: 'unlinked × /dashboard', principal: { unlinked: true }, path: '/dashboard', diizinkan: false },
]

describe('shared/domain/identity — permukaanDibolehkan registry matriks keterbukaan (Story 1.7, ATDD RED-PHASE)', () => {
  test.skip('matriks 17 kasus role × path sesuai registry terpin (§4.8 — snapshot, bukan shares live)', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const permukaanDibolehkan = mod.permukaanDibolehkan as (principal: Principal, path: string) => boolean
    for (const kasus of KASUS_PERMUKAAN) {
      expect(permukaanDibolehkan(kasus.principal, kasus.path), kasus.deskripsi).toBe(kasus.diizinkan)
    }
  })
})

/** Item nav terpin — {label, path} (label paritas navigasi.spec.ts). */
const ITEM = {
  antrian: { label: 'Antrian Beli', path: '/antrian-beli' },
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  audit: { label: 'Audit Trail', path: '/audit-trail' },
  personal: { label: 'Personal', path: '/personal' },
} as const

describe('shared/domain/identity — itemNavigasi registry per role (Story 1.7, ATDD RED-PHASE — UX-DR14)', () => {
  test.skip('registry eksak per role — item terkunci tidak pernah masuk daftar', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const itemNavigasi = mod.itemNavigasi as (role: Role, aksesPenuh: boolean) => readonly { label: string, path: string }[]
    expect(itemNavigasi('coo', true)).toEqual([ITEM.antrian, ITEM.dashboard, ITEM.audit])
    expect(itemNavigasi('pemegang_saham', true)).toEqual([ITEM.dashboard])
    expect(itemNavigasi('tanpa_saham', false)).toEqual([ITEM.personal])
    expect(itemNavigasi('tanpa_saham', true)).toEqual([ITEM.personal, ITEM.dashboard])
    expect(itemNavigasi('calon_owner', false)).toEqual([])
  })

  test.skip('guard mobile: seluruh registry ≤ MAKS_ITEM_NAV_MOBILE (Sheet "Lainnya" tak terpicu di Epic 1)', async () => {
    const mod = (await import('./identity')) as Record<string, unknown>
    const itemNavigasi = mod.itemNavigasi as (role: Role, aksesPenuh: boolean) => readonly { label: string, path: string }[]
    for (const role of ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner'] as const) {
      for (const aksesPenuh of [false, true]) {
        expect(itemNavigasi(role, aksesPenuh).length,
          `${role} (aksesPenuh=${String(aksesPenuh)})`).toBeLessThanOrEqual(PARITAS_MAKS_ITEM_NAV_MOBILE)
      }
    }
  })
})
