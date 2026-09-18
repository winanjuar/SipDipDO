/**
 * ATDD RED-PHASE — Story 1.5 "Kelengkapan Profile 11 Field" (API, endpoint Profil).
 *
 * Tests DIAKTIFKAN pada tugas green-phase endpoint Profil (spec:
 * _bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/SPEC.md,
 * CAP-1/CAP-2). Penambahan PASCA-REVIEW: pin audit `profil-kelengkapan`
 * pada test persistensi + kembaran GET 401/403 (paritas gerbang PUT).
 *
 * ASUMSI KONTRAK Profil (red-phase, nyatakan eksplisit):
 * - Endpoint: PUT /api/profile (simpan) + GET /api/profile (baca) — keduanya
 *   WAJIB sesi (tanpa sesi → 401 envelope seragam server/utils/api-error.ts).
 * - Body PUT = 10 field Lampiran A #1-10 (camelCase, seluruhnya string wajib
 *   non-kosong setelah trim — lihat companion profile-fields.md); Gmail
 *   TIDAK diedit via form (email sesi Google).
 * - Sukses → 200/201 { ...10 field, profileComplete: true, remainingFields: [] }
 *   TANPA field referral (FR-22 — diajukan saat Pembelian Pertama).
 * - Field kosong/kurang → 400 envelope + daftar field yang belum lengkap
 *   PERSIS (menyandikan CAP-2 indikator di kontrak wire).
 * - Non-calon (status selain `diajukan`) → 403 envelope (CAP-3 gerbang).
 * - GAGAL SAAT RED: endpoint belum ada → 404; validasi skema melempar sebelum
 *   asersi status tercapai.
 *
 * Pact: use_pactjs_utils=true TETAPI gerbang relevansi TUTUP (satu aplikasi
 * Nuxt 4, bukan microservices) → TANPA contract test (pola register.api.spec.ts).
 *
 * Mandate playwright-utils: `test` HANYA dari merged-fixtures; HTTP via
 * `apiRequest`; validasi zod via `.validateSchema`; `log.step` GIVEN/WHEN/THEN;
 * tanpa request mentah, tanpa waitForTimeout, tanpa console.log.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP yang dipakai file ini — tanpa magic number. */
const STATUS_OK = 200
const STATUS_CREATED = 201
const STATUS_BAD_REQUEST = 400
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403

/** Jumlah field Profil Lampiran A #1-10 yang diminta form (Referal = #11, non-goal). */
const JUMLAH_FIELD_PROFIL = 10

/** Panjang kode referral owner (paritas PANJANG_KODE_REFERRAL shared/domain). */
const PANJANG_KODE_REFERRAL = 8

/** Batas panjang validasi (paritas PANJANG_MAKS_* shared/domain/profil). */
const PANJANG_MAKS_NAMA_UJI = 25
const PANJANG_MAKS_ALIAS_UJI = 10

/** Nama tetap token sesi mint (server/api/test/login.post.ts) — sumber
 *  `namaDariGoogle` untuk persona mint (prefill Nama, keputusan owner). */
const NAMA_SESI_MINT = 'Pemilik Uji Sintetis'

const PATH_PROFIL = '/api/profile'

/** Cookie[] hasil mintSesiPemilik → header Cookie untuk apiRequest (pola
 *  register.api.spec.ts — apiRequest tidak berbagi cookie-jar browser). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola register.api.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Envelope error seragam — kontrak server/utils/api-error.ts (duplikasi
 *  bentuk dari register.api.spec.ts disengaja agar spec mandiri). */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/**
 * Bentuk wire Profil sukses (flat). `profileComplete` di-pin literal true dan
 * `remainingFields` array kosong — PUT dengan 10 field lengkap WAJIB diproses
 * sebagai lengkap (prasyarat verifikasi COO, FR-22). `referral:
 * z.never().optional()` = asersi NYATA tanpa strict-mode (pola
 * register.api.spec.ts): server menggemakan referral dalam bentuk apa pun →
 * validasi gagal.
 */
const SkemaProfil = z.object({
  namaLengkap: z.string().min(1),
  alias: z.string().min(1),
  gmail: z.string().email(),
  nomorHp: z.string().min(1),
  kontakDarurat: z.string().min(1),
  nomorHpKontakDarurat: z.string().min(1),
  hubunganDenganOwner: z.string().min(1),
  namaBank: z.string().min(1),
  pemilikRekening: z.string().min(1),
  nomorRekening: z.string().min(1),
  bankLain: z.string(),
  profileComplete: z.literal(true),
  remainingFields: z.tuple([]),
  referral: z.never().optional(),
})
type Profil = z.infer<typeof SkemaProfil>

/** Skema GET (baca) — nilai field boleh kosong saat belum lengkap; bentuk
 *  kelengkapan tetap dipin supaya CAP-2 teruji di level wire. Termasuk
 *  referensi referral tampilan (re-negotiasi owner 2026-09-18): kode milik
 *  owner selalu terisi; `usedReferralCode` DORMANT null sampai Epic 3. */
const SkemaProfilBaca = z.object({
  namaLengkap: z.string(),
  alias: z.string(),
  gmail: z.string().email(),
  nomorHp: z.string(),
  kontakDarurat: z.string(),
  nomorHpKontakDarurat: z.string(),
  hubunganDenganOwner: z.string(),
  namaBank: z.string(),
  pemilikRekening: z.string(),
  nomorRekening: z.string(),
  bankLain: z.string(),
  profileComplete: z.boolean(),
  remainingFields: z.array(z.string()),
  referralCode: z.string().min(1),
  usedReferralCode: z.string().nullable(),
  namaDariGoogle: z.string(),
})

/** Bentuk wire entry audit — disalin dari redaftar.api.spec.ts (duplikasi
 *  disengaja agar spec mandiri); penambahan pasca-review: pin audit
 *  `profil-kelengkapan` (baris matriks "PUT lengkap + audit in-tx"). */
const SkemaEntryAudit = z.object({
  id: z.uuid(),
  action: z.string().min(1),
  actor: z.object({
    kind: z.enum(['user', 'system']),
    ownerId: z.uuid().nullish(),
  }),
  target: z.string().nullish(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
})
const SkemaDaftarAudit = z.object({
  data: z.array(SkemaEntryAudit),
  nextPage: z.union([z.number().int().positive(), z.string().min(1), z.null()]),
})
type DaftarAudit = z.infer<typeof SkemaDaftarAudit>

/**
 * Factory 10 field Profil sintetis (data-factories: overrides menunjukkan
 * intent test). Override `{ namaBank: '' }` = mensimulasikan field kosong.
 */
const profilLengkapUji = (overrides: Partial<Record<keyof Profil, string>> = {}) => ({
  // Nilai patuh batas validasi (re-negotiasi owner 2026-09-18): nama bebas
  // <=25, alias <=10, HP 0+9-15 digit, rekening <=20 digit/"-", enum sah.
  // Gmail bukan bagian body PUT (selalu email sesi) — hanya kunci tipe Profil.
  namaLengkap: `Uji ${faker.string.alphanumeric(6)}`,
  alias: faker.string.alphanumeric({ length: 5, casing: 'lower' }),
  gmail: emailSintetisUji(),
  nomorHp: '0812' + faker.string.numeric(8),
  kontakDarurat: `Uji ${faker.string.alphanumeric(6)}`,
  nomorHpKontakDarurat: '0813' + faker.string.numeric(8),
  hubunganDenganOwner: 'Saudara',
  namaBank: 'BCA',
  bankLain: '',
  pemilikRekening: `Uji ${faker.string.alphanumeric(6)}`,
  nomorRekening: faker.string.numeric(10),
  ...overrides,
})

test.describe('[P0] PUT /api/profile sesi diajukan → profil tersimpan lengkap', () => {
  test('[P0] 10 field lengkap → 200/201 profileComplete=true remainingFields kosong tanpa referral', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — PUT /api/profile belum ada; validasi SkemaProfil
    // melempar sebelum asersi status tercapai.
    await log.step('GIVEN sesi calon owner berstatus diajukan (baris existing)')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT /api/profile dengan 10 field Lampiran A lengkap')
    const profil = profilLengkapUji()
    const { status, body } = await apiRequest<Profil>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profil,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaProfil)

    await log.step('THEN 200/201 — profil lengkap, tanpa field referral')
    expect([STATUS_OK, STATUS_CREATED]).toContain(status)
    expect(body.profileComplete).toBe(true)
    expect(body.namaLengkap).toBe(profil.namaLengkap)
  })
})

test.describe('[P0] PUT /api/profile tanpa sesi (AD-8 wajib auth)', () => {
  test('[P0] PUT tanpa cookie sesi ditolak 401 envelope seragam', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada; validasi envelope gagal lebih dulu.
    await log.step('GIVEN permintaan PUT /api/profile tanpa cookie sesi')

    await log.step('WHEN route handler wajib auth menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji(),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] PUT /api/profile validasi kelengkapan PERSIS (CAP-2 di wire)', () => {
  test('[P1] 2 field dikosongkan → 400 dan daftar field belum lengkap PERSIS dua itu', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada. Pin CAP-2: respons validasi
    // menyebut persis field yang kosong (namaBank, nomorRekening) dan TIDAK
    // menyebut field yang terisi (namaLengkap).
    await log.step('GIVEN sesi calon owner berstatus diajukan')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT /api/profile dengan namaBank & nomorRekening kosong')
    const profilKurang = profilLengkapUji({ namaBank: '', nomorRekening: '' })
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilKurang,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 dan keluhan menyebut persis dua field kosong itu')
    expect(status).toBe(STATUS_BAD_REQUEST)
    const wire = JSON.stringify(body)
    expect(wire).toContain('namaBank')
    expect(wire).toContain('nomorRekening')
    expect(wire).not.toContain('namaLengkap')
  })
})

test.describe('[P1] PUT /api/profile menolak field referral (FR-22)', () => {
  test('[P1] body berisi referral ditolak 400 envelope — referral diajukan saat Pembelian Pertama', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada. Cermin kontrak POST /api/register.
    await log.step('GIVEN sesi calon owner berstatus diajukan')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT /api/profile membawa field referral')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: { ...profilLengkapUji(), referral: 'KODE-UJI-REFERRAL' },
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 envelope — referral bukan bagian kontrak Profil')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] PUT /api/profile gerbang non-calon (CAP-3, AD-8)', () => {
  test('[P1] owner terverifikasi menulis profil → 403 envelope', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada. Endpoint Profil hanya untuk
    // calon owner `diajukan` (CAP-3); status lain ditolak di batas server.
    await log.step("GIVEN sesi owner berstatus 'terverifikasi' (bukan calon)")
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'terverifikasi',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT /api/profile')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji(),
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — akses bukan calon ditolak di server')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] PUT /api/profile validasi format & enum (PROFILE_INVALID)', () => {
  test('[P1] enam pelanggaran sekaligus → 400 PROFILE_INVALID + invalidFields field+kode', async ({ apiRequest }) => {
    // Re-negotiasi owner 2026-09-18: sanitasi/batas/enum. GAGAL bila handler
    // menerima nilai di luar kontrak tanpa PROFILE_INVALID.
    await log.step('GIVEN sesi calon owner berstatus diajukan')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT dengan 6 pelanggaran: nama>25, alias>10, HP non-digit, rekening berkarakter spasi, hubungan & bank di luar daftar')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji({
        namaLengkap: 'A'.repeat(PANJANG_MAKS_NAMA_UJI + 1),
        alias: 'B'.repeat(PANJANG_MAKS_ALIAS_UJI + 1),
        nomorHp: '0812-ABCD-90',
        nomorRekening: '12 34',
        hubunganDenganOwner: 'Teman',
        namaBank: 'Bukopin',
      }),
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 PROFILE_INVALID — invalidFields memuat keenam field + kode')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.code).toBe('PROFILE_INVALID')
    const wire = JSON.stringify(body.details)
    for (const field of ['namaLengkap', 'alias', 'nomorHp', 'nomorRekening', 'hubunganDenganOwner', 'namaBank']) {
      expect(wire).toContain(`"${field}"`)
    }
    expect(wire).toContain('terlalu-panjang')
    expect(wire).toContain('format-salah')
    expect(wire).toContain('di-luar-daftar')
  })

  test('[P1] sanitasi server: spasi ganda + kontrol karakter dirapikan sebelum disimpan', async ({ apiRequest }) => {
    await log.step('GIVEN sesi calon owner berstatus diajukan')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN PUT dengan namaLengkap ber-spasi ganda + kontrol karakter')
    const { status, body } = await apiRequest<Profil>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji({ namaLengkap: '  Budi \u0007  Santoso  ' }),
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaProfil)

    await log.step('THEN 200 dan respons membawa nilai hasil sanitasi')
    expect(status).toBe(STATUS_OK)
    expect(body.namaLengkap).toBe('Budi Santoso')
  })
})

test.describe('[P1] Bank "Lainnya" — bankLain wajib bersyarat', () => {
  test('[P1] Lainnya tanpa nama bank → 400 PROFILE_INCOMPLETE memuat bankLain; terisi → 200 + tergemakan GET', async ({ apiRequest }) => {
    await log.step('GIVEN sesi calon owner berstatus diajukan')
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN PUT Bank "Lainnya" tanpa bankLain')
    const kosong = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji({ namaBank: 'Lainnya', bankLain: '' }),
      headers: headerCookie,
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 PROFILE_INCOMPLETE dengan bankLain di remainingFields')
    expect(kosong.status).toBe(STATUS_BAD_REQUEST)
    expect(kosong.body.code).toBe('PROFILE_INCOMPLETE')
    expect(JSON.stringify(kosong.body.details)).toContain('bankLain')

    await log.step('WHEN PUT Bank "Lainnya" dengan bankLain terisi')
    const terisi = await apiRequest<Profil>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profilLengkapUji({ namaBank: 'Lainnya', bankLain: 'SeaBank' }),
      headers: headerCookie,
    }).validateSchema(SkemaProfil)

    await log.step('THEN 200 lalu GET menggemakan Lainnya + SeaBank persisten')
    expect(terisi.status).toBe(STATUS_OK)
    const { body } = await apiRequest<z.infer<typeof SkemaProfilBaca>>({
      method: 'GET',
      path: PATH_PROFIL,
      headers: headerCookie,
    }).validateSchema(SkemaProfilBaca)
    expect(body.namaBank).toBe('Lainnya')
    expect(body.bankLain).toBe('SeaBank')
  })
})

test.describe('[P1] Persistensi profil — PUT lalu GET identik (CAP-1) + audit in-tx', () => {
  test('[P1] nilai yang disimpan terbaca kembali utuh saat GET /api/profile', async ({ apiRequest }) => {
    // GAGAL saat red: PUT menjawab 404 sebelum GET mana pun dieksekusi.
    await log.step('GIVEN sesi calon owner berstatus diajukan menyimpan profil lengkap')
    const emailCalon = emailSintetisUji()
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailCalon,
    })
    const profil = profilLengkapUji()
    const simpan = await apiRequest<Profil>({
      method: 'PUT',
      path: PATH_PROFIL,
      body: profil,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaProfil)
    expect([STATUS_OK, STATUS_CREATED]).toContain(simpan.status)

    await log.step('WHEN GET /api/profile dengan sesi yang sama')
    const { status, body } = await apiRequest<z.infer<typeof SkemaProfilBaca>>({
      method: 'GET',
      path: PATH_PROFIL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaProfilBaca)

    await log.step('THEN 200 — seluruh nilai identik dan profil dinyatakan lengkap')
    expect(status).toBe(STATUS_OK)
    expect(body.namaLengkap).toBe(profil.namaLengkap)
    expect(body.nomorRekening).toBe(profil.nomorRekening)
    expect(body.profileComplete).toBe(true)
    expect(body.remainingFields).toHaveLength(0)
    // Factory memuat 10 field tersimpan + kunci tipe gmail (bukan body PUT).
    expect(Object.keys(profil).filter(kunci => kunci !== 'gmail')).toHaveLength(JUMLAH_FIELD_PROFIL)

    await log.step('AND referensi referral tampilan tersedia (kode milik owner terisi; referal-dari DORMANT null)')
    expect(body.referralCode.length).toBe(PANJANG_KODE_REFERRAL)
    expect(body.usedReferralCode).toBeNull()

    await log.step('AND namaDariGoogle = nama profil akun sesi (sumber prefill awal field Nama)')
    expect(body.namaDariGoogle).toBe(NAMA_SESI_MINT)

    // Penambahan pasca-review — pin audit in-tx (matriks: PUT lengkap +
    // audit `profil-kelengkapan`): entry terbaca COO via GET /api/audit.
    await log.step('AND COO membaca GET /api/audit — entry profil memuat email pendaftar')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const audit = await apiRequest<DaftarAudit>({
      method: 'GET',
      path: '/api/audit',
      headers: headerCookieDariMint(cookieCoo),
    }).validateSchema(SkemaDaftarAudit)
    expect(audit.status).toBe(STATUS_OK)
    expect(JSON.stringify(audit.body.data)).toContain(emailCalon)
  })
})

test.describe('[P0] GET /api/profile tanpa sesi (AD-8 wajib auth — kembaran PUT, pasca-review)', () => {
  test('[P0] GET tanpa cookie sesi ditolak 401 envelope seragam', async ({ apiRequest }) => {
    await log.step('GIVEN permintaan GET /api/profile tanpa cookie sesi')

    await log.step('WHEN route handler wajib auth menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PROFIL,
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] GET /api/profile gerbang non-calon (CAP-3, AD-8 — kembaran PUT, pasca-review)', () => {
  test('[P1] owner terverifikasi membaca profil → 403 envelope', async ({ apiRequest }) => {
    await log.step("GIVEN sesi owner berstatus 'terverifikasi' (bukan calon)")
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'terverifikasi',
      email: emailSintetisUji(),
    })

    await log.step('WHEN GET /api/profile')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PROFIL,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — akses bukan calon ditolak di server')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.message.length).toBeGreaterThan(0)
  })
})
