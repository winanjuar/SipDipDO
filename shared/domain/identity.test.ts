/**
 * ATDD (Vitest) — kontrak `shared/domain/identity.ts` Story 1.2: tipe
 * `OwnerStatus` (AD-11), `Role`, dan peta konstanta `LANDING_PATH` role→route
 * (kontrak murni lintas lapis, tanpa I/O — AD-6). Story 1.4: konstanta +
 * generator kode referral (murni, sumber acak disuntikkan).
 *
 * Story 1.7 (GREEN-PHASE): blok predikat akses kanonik (`aksesPenuh`/
 * `perluReferral`/`layakPilihanReferral`), registry
 * `permukaanDibolehkan`/`itemNavigasi`, dan konstanta
 * `PESAN_TRANSPARANSI`/`MAKS_ITEM_NAV_MOBILE` — DIAKTIFKAN (un-skip) dengan
 * impor statis sesuai instruksi scaffold red-phase; asersi ter-pin dari
 * red-phase TIDAK berubah.
 */
import { describe, expect, test } from 'vitest'
import type { OwnerAccessSnapshot, OwnerStatus, Principal, Role } from './identity'
import {
  aksesPenuh,
  buatKodeReferral,
  itemNavigasi,
  LANDING_PATH,
  layakPilihanReferral,
  MAKS_ITEM_NAV_MOBILE,
  PANJANG_KODE_REFERRAL,
  permukaanDibolehkan,
  PESAN_TRANSPARANSI,
  perluReferral,
} from './identity'

/** Landing map ter-pin spec Story 1.2 (UX-DR14). */
const LANDING_PATH_TERPIN = {
  coo: '/order-queue',
  pemegang_saham: '/dashboard',
  tanpa_saham: '/personal',
  calon_owner: '/registration-status',
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
 * ═══ ATDD Story 1.7 (green-phase) ═══ Blok di bawah pin kontrak predikat
 * akses kanonik + registry (spec 1.7, AD-8/AD-11; test design 1-UNIT-001
 * subset lanjutan). Kontrak sudah diekspor `identity.ts` — impor statis,
 * asersi ter-pin dari red-phase tidak berubah.
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

describe('shared/domain/identity — predikat akses kanonik (Story 1.7, ATDD)', () => {
  test('aksesPenuh: true PERSIS saat firstEffectiveAt terisi — termasuk keluar-pernah-beli (AD-8)', () => {
    for (const baris of MATRIKS_AKSES) {
      expect(aksesPenuh({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.aksesPenuh)
    }
  })

  test('perluReferral: owner belum-pernah-beli dari status terverifikasi/keluar (cakupan AD-11)', () => {
    for (const baris of MATRIKS_AKSES) {
      expect(perluReferral({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.perluReferral)
    }
  })

  test('layakPilihanReferral: pemegang saham (termasuk COO) atau owner belum-pernah-beli', () => {
    for (const baris of MATRIKS_AKSES) {
      expect(layakPilihanReferral({ status: baris.status, firstEffectiveAt: baris.firstEffectiveAt })).toBe(baris.layakPilihanReferral)
    }
  })

  test('konstanta: PESAN_TRANSPARANSI verbatim + MAKS_ITEM_NAV_MOBILE = 4 (UX-DR14)', () => {
    expect(PESAN_TRANSPARANSI).toBe(PARITAS_PESAN_TRANSPARANSI)
    expect(MAKS_ITEM_NAV_MOBILE).toBe(PARITAS_MAKS_ITEM_NAV_MOBILE)
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
  { deskripsi: 'tanpa_saham belum-beli × /order-queue', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/order-queue', diizinkan: false },
  { deskripsi: 'tanpa_saham belum-beli × /audit-trail', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/audit-trail', diizinkan: false },
  { deskripsi: 'tanpa_saham belum-beli × /personal', principal: principalUji('tanpa_saham', snapUji('terverifikasi', false)), path: '/personal', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /dashboard (aksesPenuh — kunci AD-8)', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /personal', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/personal', diizinkan: true },
  { deskripsi: 'keluar-pernah-beli × /order-queue', principal: principalUji('tanpa_saham', snapUji('keluar', true)), path: '/order-queue', diizinkan: false },
  { deskripsi: 'pemegang_saham × /dashboard', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'pemegang_saham × /order-queue', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/order-queue', diizinkan: false },
  { deskripsi: 'pemegang_saham × /audit-trail', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/audit-trail', diizinkan: false },
  { deskripsi: 'pemegang_saham × /personal (PRASYARAT_OWNER)', principal: principalUji('pemegang_saham', snapUji('terverifikasi', true)), path: '/personal', diizinkan: true },
  { deskripsi: 'coo × /order-queue', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/order-queue', diizinkan: true },
  { deskripsi: 'coo × /audit-trail', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/audit-trail', diizinkan: true },
  { deskripsi: 'coo × /dashboard (aksesPenuh via saham)', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/dashboard', diizinkan: true },
  { deskripsi: 'coo × /personal (PRASYARAT_OWNER — keputusan owner 2026-09-21)', principal: principalUji('coo', snapUji('terverifikasi', true)), path: '/personal', diizinkan: true },
  { deskripsi: 'calon_owner × /dashboard (gerbang calon urusan middleware)', principal: principalUji('calon_owner', snapUji('diajukan', false)), path: '/dashboard', diizinkan: false },
  { deskripsi: 'unlinked × /dashboard', principal: { unlinked: true }, path: '/dashboard', diizinkan: false },
]

describe('shared/domain/identity — permukaanDibolehkan registry matriks keterbukaan (Story 1.7, ATDD)', () => {
  test('matriks 17 kasus role × path sesuai registry terpin (§4.8 — snapshot, bukan shares live)', () => {
    for (const kasus of KASUS_PERMUKAAN) {
      expect(permukaanDibolehkan(kasus.principal, kasus.path), kasus.deskripsi).toBe(kasus.diizinkan)
    }
  })
})

/** Item nav terpin — {label, path} (label paritas navigasi.spec.ts). */
const ITEM = {
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  personal: { label: 'Personal', path: '/personal' },
  order: { label: 'Order', path: '/order-queue' },
  audit: { label: 'Audit', path: '/audit-trail' },
} as const

describe('shared/domain/identity — itemNavigasi registry per role (Story 1.7, ATDD — UX-DR14)', () => {
  test('registry eksak per role — item terkunci tidak pernah masuk daftar', () => {
    expect(itemNavigasi('coo', true)).toEqual([ITEM.dashboard, ITEM.personal, ITEM.order, ITEM.audit])
    expect(itemNavigasi('pemegang_saham', true)).toEqual([ITEM.dashboard, ITEM.personal])
    expect(itemNavigasi('tanpa_saham', false)).toEqual([ITEM.personal])
    expect(itemNavigasi('tanpa_saham', true)).toEqual([ITEM.personal, ITEM.dashboard])
    expect(itemNavigasi('calon_owner', false)).toEqual([])
  })

  test('guard mobile: seluruh registry ≤ MAKS_ITEM_NAV_MOBILE (Sheet "Lainnya" tak terpicu di Epic 1)', () => {
    for (const role of ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner'] as const) {
      for (const sudahAksesPenuh of [false, true]) {
        expect(itemNavigasi(role, sudahAksesPenuh).length,
          `${role} (aksesPenuh=${String(sudahAksesPenuh)})`).toBeLessThanOrEqual(PARITAS_MAKS_ITEM_NAV_MOBILE)
      }
    }
  })
})
