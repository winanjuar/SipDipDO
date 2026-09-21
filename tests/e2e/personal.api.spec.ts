/**
 * ATDD GREEN-PHASE — Story 1.7 "Role, Matriks Keterbukaan & Navigasi" (API,
 * endpoint BARU GET /api/personal).
 *
 * Tests SUDAH DIAKTIFKAN (un-skip) pada tugas green-phase endpoint Personal
 * (spec: _bmad-output/implementation-artifacts/spec-1-7-role-matriks-
 * keterbukaan-navigasi.md, matriks baris "GET /api/personal"). Seluruh test
 * dibungkus `test.skip` selama red phase — kegagalan MERAH diverifikasi dulu
 * sebelum implementasi (aturan ATDD spec 1.7); kini aktif dengan asersi
 * ter-pin tidak berubah.
 *
 * ASUMSI KONTRAK GET /api/personal (red-phase, dinyatakan eksplisit):
 * - Endpoint BARU `GET /api/personal` (server/api/personal/index.get.ts)
 *   mengikuti pola `landing.get.ts`: handler tipis, sesi → `buildPrincipal`,
 *   envelope seragam `server/utils/api-error.ts` { code, message, details }.
 * - Tanpa sesi → 401 envelope seragam (AD-8 wajib auth).
 * - Sesi role `tanpa_saham` → 200 profil MILIK-SENDIRI read-only:
 *   `{ email, status, ...10 field wire Profil camelCase, profileComplete }`.
 *   10 field wire = fullName, alias, gmail, phoneNumber,
 *   emergencyContactName, emergencyContactPhoneNumber,
 *   emergencyContactRelationship, bankName, otherBankName,
 *   accountHolderName, accountNumber (bentuk wire sama dengan /api/profile).
 *   Skema zod NON-strikt — boleh ada field tampilan lain milik wire
 *   /api/profile (mis. referralCode, remainingFields): kehadiran kunci
 *   kontrak dipin, field ekstra TIDAK ditolak.
 * - Sesi role lain (calon_owner / pemegang_saham / coo) → 403 envelope;
 *   TIDAK ada baca data (FR-15 matriks keterbukaan, AD-8 batas server).
 * - `resolveRole` memetakan `keluar` → `tanpa_saham` SEBELUM melihat
 *   `firstEffectiveAt` (server/domain/identity/access.service.ts) — owner
 *   `keluar` yang PERNAH membeli tetap dilayani endpoint ini (AD-8).
 * - GAGAL SAAT RED: endpoint belum ada → 404; validasi skema melempar
 *   sebelum asersi status tercapai.
 *
 * Pola seed "profil lengkap" (owner mint TIDAK punya field profil —
 * profileComplete=false): DUA-LANGKAH via upsert-by-email — (1) mint email
 * unik `status: 'diajukan'`, (2) PUT /api/profile (endpoint HIJAU sejak
 * Story 1.5, calon-only) dengan 10 field lengkap via factory, (3) re-mint
 * EMAIL SAMA `status: 'terverifikasi'` (baris sama ter-update; pola re-mint
 * auth-landing.spec.ts). Test 200 meliputi `profileComplete: true`.
 *
 * Pact: gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices)
 * → TANPA contract test (pola register.api.spec.ts / profil.api.spec.ts).
 *
 * Mandate playwright-utils: `test` HANYA dari merged-fixtures; HTTP via
 * `apiRequest` + validasi zod `.validateSchema`; `log.step` GIVEN/WHEN/THEN
 * Bahasa Indonesia; tanpa request mentah, tanpa waitForTimeout, tanpa
 * console.log; tanpa magic number (konstanta bernama status HTTP).
 * Duplikasi helper (headerCookieDariMint, emailSintetisUji, factory,
 * skema zod) disengaja agar spec mandiri — pola profil.api.spec.ts.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP yang dipakai file ini — tanpa magic number (paritas HTTP_STATUS server/utils/api-error.ts). */
const STATUS_OK = 200
const STATUS_CREATED = 201
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403

/** Path endpoint yang dipin kontraknya. */
const PATH_PERSONAL = '/api/personal'
const PATH_PROFIL = '/api/profile'

/** 10 field wire Profil Lampiran A #1-10 (camelCase, tanpa gmail — gmail selalu email sesi). */
const KUNCI_FIELD_PROFIL = [
  'fullName',
  'alias',
  'phoneNumber',
  'emergencyContactName',
  'emergencyContactPhoneNumber',
  'emergencyContactRelationship',
  'bankName',
  'otherBankName',
  'accountHolderName',
  'accountNumber',
] as const

/** Cookie[] hasil mintSesiPemilik → header Cookie untuk apiRequest (pola
 *  profil.api.spec.ts — apiRequest tidak berbagi cookie-jar browser;
 *  duplikasi disengaja agar spec mandiri). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci `uji.snddash.e2e.` + @gmail.com — AD-11; duplikasi disengaja). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Envelope error seragam — kontrak server/utils/api-error.ts (duplikasi disengaja agar spec mandiri). */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/**
 * Bentuk wire PUT /api/profile sukses LENGKAP (endpoint HIJAU sejak Story
 * 1.5 — dipakai test dua-langkah; duplikasi bentuk profil.api.spec.ts
 * disengaja agar spec mandiri). `profileComplete` di-pin literal true.
 */
const SkemaProfilSimpan = z.object({
  fullName: z.string().min(1),
  alias: z.string().min(1),
  gmail: z.string().email(),
  phoneNumber: z.string().min(1),
  emergencyContactName: z.string().min(1),
  emergencyContactPhoneNumber: z.string().min(1),
  emergencyContactRelationship: z.string().min(1),
  bankName: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(1),
  otherBankName: z.string(),
  profileComplete: z.literal(true),
  remainingFields: z.tuple([]),
})
type ProfilSimpan = z.infer<typeof SkemaProfilSimpan>

/**
 * Bentuk wire GET /api/personal sukses untuk owner `terverifikasi` dengan
 * profil LENGKAP. NON-strikt (tanpa `.strict()`) — field tampilan lain milik
 * wire /api/profile (mis. referralCode, remainingFields, namaDariGoogle)
 * BOLEH hadir dan tidak pernah menolak validasi; yang dipin = kehadiran
 * kunci kontrak + nilai-nilainya (FR-15 baris matriks "200 ... profil wire").
 */
const SkemaPersonalLengkap = z.object({
  email: z.string().email(),
  status: z.literal('terverifikasi'),
  fullName: z.string().min(1),
  alias: z.string().min(1),
  gmail: z.string().email(),
  phoneNumber: z.string().min(1),
  emergencyContactName: z.string().min(1),
  emergencyContactPhoneNumber: z.string().min(1),
  emergencyContactRelationship: z.string().min(1),
  bankName: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(1),
  otherBankName: z.string(),
  profileComplete: z.literal(true),
  // Datum snapshot AD-8 — input predikat kanonik `aksesPenuh()` di lapisan
  // halaman/layout (review Story 1.7 #8: dipin skema + nilai, bukan implisit).
  firstEffectiveAt: z.string().nullable(),
})
type PersonalLengkap = z.infer<typeof SkemaPersonalLengkap>

/**
 * Bentuk wire GET /api/personal sukses untuk owner `keluar` (pernah membeli):
 * field profil belum tentu terisi (owner mint tidak mengisi Profil) — nilai
 * boleh string kosong; kelengkapan dilaporkan apa adanya. Status dipin
 * literal 'keluar' — read-only milik-sendiri tetap dilayani (AD-8: resolveRole
 * keluar → tanpa_saham SEBELUM cek firstEffectiveAt).
 */
const SkemaPersonalKeluar = z.object({
  email: z.string().email(),
  status: z.literal('keluar'),
  fullName: z.string(),
  alias: z.string(),
  gmail: z.string().email(),
  phoneNumber: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhoneNumber: z.string(),
  emergencyContactRelationship: z.string(),
  bankName: z.string(),
  accountHolderName: z.string(),
  accountNumber: z.string(),
  otherBankName: z.string(),
  profileComplete: z.boolean(),
  // Datum snapshot AD-8 — keluar-pernah-beli WAJIB mengirim instant terisi
  // (review Story 1.7 #8: pin skema + nilai, bukan implisit).
  firstEffectiveAt: z.string().min(1),
})
type PersonalKeluar = z.infer<typeof SkemaPersonalKeluar>

/**
 * Factory 10 field Profil sintetis (data-factories; tiruan bentuk
 * `profilLengkapUji` profil.api.spec.ts — duplikasi disengaja agar spec
 * mandiri). Nilai patuh batas validasi: nama <=25, alias <=10, HP prefix
 * '0812'+8 digit, rekening 10 digit, bank enum 'BCA'. Gmail bukan bagian
 * body efektif PUT (selalu email sesi) — hanya kunci tipe.
 */
const profilLengkapUji = (overrides: Partial<Record<(typeof KUNCI_FIELD_PROFIL)[number] | 'gmail', string>> = {}) => ({
  fullName: `Uji ${faker.string.alphanumeric(6)}`,
  alias: faker.string.alphanumeric({ length: 5, casing: 'lower' }),
  gmail: emailSintetisUji(),
  phoneNumber: '0812' + faker.string.numeric(8),
  emergencyContactName: `Uji ${faker.string.alphanumeric(6)}`,
  emergencyContactPhoneNumber: '0813' + faker.string.numeric(8),
  emergencyContactRelationship: 'Saudara',
  bankName: 'BCA',
  otherBankName: '',
  accountHolderName: `Uji ${faker.string.alphanumeric(6)}`,
  accountNumber: faker.string.numeric(10),
  ...overrides,
})

test.describe('[P0] GET /api/personal tanpa sesi (AD-8 wajib auth)', () => {
  test('[P0] GET tanpa cookie sesi ditolak 401 envelope seragam', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — GET /api/personal belum ada; validasi
    // SkemaEnvelopeError melempar sebelum asersi status tercapai.
    await log.step('GIVEN permintaan GET /api/personal tanpa cookie sesi')

    await log.step('WHEN route handler wajib auth menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PERSONAL,
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P0] GET /api/personal role tanpa_saham — profil milik-sendiri read-only (pola dua-langkah upsert-by-email)', () => {
  test('[P0] tanpa_saham terverifikasi profil LENGKAP → 200 email sesi, status terverifikasi, 10 field tersimpan, profileComplete true', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — GET /api/personal belum ada; SkemaPersonalLengkap
    // melempar sebelum asersi status. PUT /api/profile adalah endpoint HIJAU
    // sejak Story 1.5 — langkah seed tidak gagal karena 404 Personal.
    await log.step("GIVEN owner sintetis 'diajukan' menyimpan 10 field Profil via PUT /api/profile (endpoint hijau sejak 1.5)")
    const emailSesi = emailSintetisUji()
    const cookieCalon = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSesi,
    })
    const profil = profilLengkapUji()
    const simpan = await apiRequest<ProfilSimpan>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profil,
      headers: headerCookieDariMint(cookieCalon),
    }).validateSchema(SkemaProfilSimpan)
    expect([STATUS_OK, STATUS_CREATED]).toContain(simpan.status)

    await log.step("WHEN baris yang sama di-re-mint dengan EMAIL SAMA 'terverifikasi' (upsert-by-email; punyaSaham false → role tanpa_saham)")
    const cookieOwner = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'terverifikasi',
      email: emailSesi,
    })

    await log.step('AND GET /api/personal dengan sesi tanpa_saham')
    const { status, body } = await apiRequest<PersonalLengkap>({
      method: 'GET',
      path: PATH_PERSONAL,
      headers: headerCookieDariMint(cookieOwner),
    }).validateSchema(SkemaPersonalLengkap)

    await log.step('THEN 200 — data milik-sendiri read-only: email sesi, status terverifikasi, 10 field = nilai tersimpan, profileComplete true (FR-15)')
    expect(status).toBe(STATUS_OK)
    expect(body.email).toBe(emailSesi)
    expect(body.gmail).toBe(emailSesi)
    for (const kunci of KUNCI_FIELD_PROFIL) {
      expect(body[kunci]).toBe(profil[kunci])
    }
    expect(body.profileComplete).toBe(true)
    // Snapshot belum-pernah-beli — datum predikat aksesPenuh (review #8).
    expect(body.firstEffectiveAt).toBeNull()
  })
})

test.describe('[P1] GET /api/personal gerbang role — role di luar tanpa_saham ditolak (FR-15, AD-8)', () => {
  test('[P1] sesi calon_owner (diajukan) → 403 envelope, tanpa baca data', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada; validasi envelope gagal lebih dulu.
    await log.step("GIVEN sesi owner berstatus 'diajukan' (role calon_owner)")
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN GET /api/personal')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PERSONAL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — calon_owner di luar keterbukaan endpoint, TIDAK ada baca data')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P1] sesi pemegang_saham → 403 envelope, tanpa baca data', async ({ apiRequest }) => {
    await log.step("GIVEN sesi owner 'pemegang-saham' (terverifikasi + punyaSaham)")
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })

    await log.step('WHEN GET /api/personal')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PERSONAL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — pemegang_saham di luar keterbukaan endpoint')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P1] sesi coo → 403 envelope, tanpa baca data', async ({ apiRequest }) => {
    await log.step("GIVEN sesi owner 'coo' (tenure COO aktif)")
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN GET /api/personal')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PERSONAL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — coo di luar keterbukaan endpoint')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] GET /api/personal owner keluar-pernah-beli tetap dilayani (AD-8)', () => {
  test("[P1] sesi 'keluar' (punyaSaham true) → 200 read-only dengan status keluar — resolveRole keluar → tanpa_saham SEBELUM firstEffectiveAt", async ({ apiRequest }) => {
    // AD-8: role `tanpa_saham` untuk SEMUA `keluar` — endpoint layani meski
    // Pembelian Pertama sudah efektif (keluar-pernah-beli tetap tanpa_saham).
    // GAGAL saat red: 404 — endpoint belum ada; skema melempar lebih dulu.
    await log.step("GIVEN sesi owner preset 'keluar' (status keluar + punyaSaham true — Pembelian Pertama efektif)")
    const emailSesi = emailSintetisUji()
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'keluar',
      email: emailSesi,
    })

    await log.step('WHEN GET /api/personal')
    const { status, body } = await apiRequest<PersonalKeluar>({
      method: 'GET',
      path: PATH_PERSONAL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaPersonalKeluar)

    await log.step('THEN 200 — read-only milik-sendiri dengan status keluar (bukan 403; AD-8)')
    expect(status).toBe(STATUS_OK)
    expect(body.email).toBe(emailSesi)
    expect(body.status).toBe('keluar')
    // Keluar-PERNAH-beli — instant Pembelian Pertama TERISI di wire
    // (review #8: sumber predikat aksesPenuh lapisan halaman).
    expect(typeof body.firstEffectiveAt).toBe('string')
  })
})
