/**
 * ATDD GREEN-PHASE — Story 1.4 "Pendaftaran Owner Mandiri & Status" (API only).
 *
 * Cakupan file ini = POST /api/pendaftaran. Test red-phase telah diaktifkan
 * (un-skip) pada tugas green-phase bersama implementasinya (spec Story 1.4).
 *
 * TIDAK diduplikasi di sini (sudah hijau):
 * - GET /api/pendaftaran/status + varian 401/non-calon/unlinked
 *   → tests/e2e/landing.api.spec.ts (referensi pola envelope + cookie).
 * - GET /api/audit (kontrak baca) → tests/e2e/audit.api.spec.ts.
 * - Varian badge Ditolak (UI) → tests/e2e/auth-landing.spec.ts.
 *
 * ASUMSI KONTRAK POST /api/pendaftaran (red-phase, nyatakan eksplisit):
 * - Endpoint: POST /api/pendaftaran; auth WAJIB (tanpa sesi → 401 envelope
 *   seragam server/utils/api-error.ts { code, message, details }).
 * - Body TANPA referral — minimal {} karena email diambil dari sesi Google.
 * - Sukses → 200/201 { id, email, status: 'diajukan', ... } TANPA field
 *   referral di respons.
 * - Duplikat email → IDEMPOTENT 200 pada baris yang sama (bukan 409).
 * - Body berisi referral → 400 envelope (DIPILIH; alternatif "diabaikan lalu
 *   200/201" ditolak — bila kontrak green-phase memilih abaikan, ubah test
 *   [P1] referral lebih dulu).
 * - Audit FR-22 ditulis in-tx saat pendaftaran; entry wire memuat email
 *   pendaftar (di target/details) sehingga terbaca GET /api/audit oleh COO.
 *
 * Pact: use_pactjs_utils=true TETAPI gerbang relevansi TUTUP (satu aplikasi
 * Nuxt 4, bukan microservices) → TANPA contract test di story ini, sama
 * seperti tests/e2e/audit.api.spec.ts.
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod via metode promise
 * `.validateSchema(skema)`; `log.step` untuk milestone GIVEN/WHEN/THEN;
 * tanpa console.log, tanpa waitForTimeout, tanpa request mentah.
 */
import type { Cookie } from '@playwright/test'
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP yang dipakai file ini — tanpa magic number. */
const STATUS_OK = 200
const STATUS_CREATED = 201
const STATUS_BAD_REQUEST = 400
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403
const STATUS_NOT_FOUND = 404

/** Email deterministik untuk test idempotensi — aman di-rerun: run ulang
 *  tetap melihat baris yang sama (pertama 200, bukan 201) dan asersi tetap sah. */
const EMAIL_IDEMPOTEN_UJI = 'uji.snddash.e2e.idempoten-pendaftaran@gmail.com'
/** Nilai referral sintetis untuk test penolakan field referral. */
const KODE_REFERRAL_UJI = 'KODE-UJI-REFERRAL'

/** Envelope error seragam — kontrak server/utils/api-error.ts. */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/**
 * ASUMSI bentuk wire POST /api/pendaftaran sukses (flat, bukan { data }).
 * - `status` di-pin literal 'diajukan' (enum AD-11 untuk baris baru).
 * - `id` sengaja longgar string non-kosong (konvensi repo uuid — jangan
 *   over-pin saat red; selaraskan green-phase bila handler memakai kontrak lain).
 * - `referral: z.never().optional()` = asersi NYATA tanpa strict-mode:
 *   field absen → lolos; server menggemakan referral dalam bentuk apa pun
 *   → validasi gagal (diperlukan karena zod non-strict men-strip unknown keys,
 *   sehingga `not.toHaveProperty` pada body tervalidasi akan vakum).
 */
const SkemaPendaftaran = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  status: z.literal('diajukan'),
  referral: z.never().optional(),
})
type Pendaftaran = z.infer<typeof SkemaPendaftaran>

/**
 * Skema terpisah untuk baris matriks "email existing non-diajukan": `status`
 * TIDAK boleh di-pin 'diajukan' — respons wajib menggemakan status existing
 * APA ADANYA (hardcode 'diajukan' di handler harus lolos di sini). Bentuk
 * wire identik `SkemaPendaftaran` termasuk larangan menggemakan referral.
 */
const SkemaPendaftaranExisting = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  status: z.string().min(1),
  referral: z.never().optional(),
})
type PendaftaranExisting = z.infer<typeof SkemaPendaftaranExisting>

/**
 * Bentuk wire entry audit — disalin dari tests/e2e/audit.api.spec.ts (sumber
 * kebenaran bentuk wire; duplikasi disengaja agar spec tetap mandiri).
 * ASUMSI red-phase: entry pendaftaran memuat email pendaftar di
 * target/details (diverifikasi saat green-phase).
 */
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

/** Cookie[] hasil mintSesiPemilik → header Cookie untuk apiRequest (apiRequest
 *  tidak berbagi cookie-jar konteks browser — cookie dikirim eksplisit). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci agar tak pernah
 *  menimpa baris non-sintetis — pola landing.api.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

test.describe('[P0] POST /api/pendaftaran terautentikasi → diajukan tanpa referral', () => {
  test('[P0] akun Google baru mendaftar → baris owner diajukan tanpa field referral', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — POST /api/pendaftaran belum ada; validasi
    // SkemaPendaftaran melempar sebelum asersi status tercapai.
    await log.step('GIVEN sesi akun Google tanpa baris owner (unlinked)')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailSintetisUji() })

    await log.step('WHEN POST /api/pendaftaran dengan body minimal {} (email dari sesi Google)')
    const { status, body } = await apiRequest<Pendaftaran>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaPendaftaran)

    await log.step('THEN 200/201 dengan status diajukan dan TANPA field referral')
    expect([STATUS_OK, STATUS_CREATED]).toContain(status)
    expect(body.status).toBe('diajukan')
    expect(body.email.length).toBeGreaterThan(0)
  })
})

test.describe('[P0] POST /api/pendaftaran tanpa sesi (AD-8 wajib auth)', () => {
  test('[P0] POST /api/pendaftaran tanpa sesi ditolak 401 envelope seragam', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada; validasi SkemaEnvelopeError
    // melempar sebelum asersi status tercapai.
    await log.step('GIVEN permintaan POST /api/pendaftaran tanpa cookie sesi')

    await log.step('WHEN route handler wajib auth menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P0] POST /api/pendaftaran idempotent per email (AD-11 unique)', () => {
  test('[P0] pendaftaran 2x email sama tetap satu baris — 200 idempotent, bukan 409', async ({ apiRequest }) => {
    // GAGAL saat red: POST pertama menjawab 404 (endpoint belum ada) —
    // validasi skema menjadi kegagalan pertama yang menjelaskan diri sendiri.
    await log.step('GIVEN sesi akun Google dengan email deterministik yang sama')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: EMAIL_IDEMPOTEN_UJI })
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN POST /api/pendaftaran dikirim dua kali dengan email sesi yang sama')
    const pertama = await apiRequest<Pendaftaran>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
      headers: headerCookie,
    }).validateSchema(SkemaPendaftaran)
    const kedua = await apiRequest<Pendaftaran>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
      headers: headerCookie,
    }).validateSchema(SkemaPendaftaran)

    await log.step('THEN pendaftaran pertama 200/201, pengulangan 200 idempotent pada baris yang sama')
    expect([STATUS_OK, STATUS_CREATED]).toContain(pertama.status)
    expect(kedua.status).toBe(STATUS_OK)
    expect(kedua.body.id).toBe(pertama.body.id)
    expect(kedua.body.email).toBe(pertama.body.email)
    expect(kedua.body.status).toBe('diajukan')
  })

  test('[P1] POST email existing non-diajukan → 200 baris sama TANPA mutasi status', async ({ apiRequest }) => {
    // Matriks I/O beku: status `terverifikasi`/`keluar`/`kedaluwarsa` tidak
    // pernah tertimpa 'diajukan' — respons menggemakan status existing APA
    // ADANYA. Skema terpisah (SkemaPendaftaranExisting) karena SkemaPendaftaran
    // mem-pin literal 'diajukan' dan vakum untuk baris ini. Persona 'unlinked'
    // TIDAK dipakai karena mint melewati seeding baris owner untuknya —
    // 'tanpa-saham' + override status men-seed baris existing sungguhan.
    await log.step("GIVEN sesi owner sintetis berstatus 'terverifikasi' (baris existing)")
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      email: emailSintetisUji(),
      status: 'terverifikasi',
    })

    await log.step('WHEN POST /api/pendaftaran dengan email yang sudah terdaftar non-diajukan')
    const { status, body } = await apiRequest<PendaftaranExisting>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaPendaftaranExisting)

    await log.step('THEN 200 idempotent dan status existing tergemakan apa adanya (bukan diajukan)')
    expect(status).toBe(STATUS_OK)
    expect(body.status).toBe('terverifikasi')
  })
})

test.describe('[P1] POST /api/pendaftaran menolak field referral', () => {
  test('[P1] body berisi referral ditolak 400 envelope — referral diajukan saat Pembelian Pertama', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada; validasi envelope gagal
    // lebih dulu. ASUMSI YANG DIPILIH: server MENOLAK unknown field referral
    // dengan 400 envelope. Bila green-phase memilih "diabaikan lalu 200/201",
    // ubah test ini lebih dulu (keputusan kontrak tercatat di asumsi file).
    await log.step('GIVEN sesi akun Google tanpa baris owner (unlinked)')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailSintetisUji() })

    await log.step('WHEN POST /api/pendaftaran membawa body berisi referral')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: { referral: KODE_REFERRAL_UJI },
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 envelope — field referral bukan bagian kontrak pendaftaran')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] POST /api/pendaftaran mencatat audit FR-22 in-tx', () => {
  test('[P1] pendaftaran berhasil tercatat di audit trail dan terbaca COO via GET /api/audit', async ({ apiRequest }) => {
    // GAGAL saat red: POST /api/pendaftaran menjawab 404 sebelum seed audit
    // maupun asersi baca COO mana pun. GET /api/audit sendiri sudah hijau
    // (audit.api.spec.ts) — yang merah di sini adalah sisi tulis in-tx.
    await log.step('GIVEN sesi akun Google baru yang akan mendaftar')
    const emailPendaftar = emailSintetisUji()
    const cookiePendaftar = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailPendaftar })

    await log.step('WHEN POST /api/pendaftaran berhasil (200/201 diajukan)')
    const daftar = await apiRequest<Pendaftaran>({
      method: 'POST',
      path: '/api/pendaftaran',
      body: {},
      headers: headerCookieDariMint(cookiePendaftar),
    }).validateSchema(SkemaPendaftaran)
    expect([STATUS_OK, STATUS_CREATED]).toContain(daftar.status)

    await log.step('AND sesi COO membaca GET /api/audit')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const { status, body } = await apiRequest<DaftarAudit>({
      method: 'GET',
      path: '/api/audit',
      headers: headerCookieDariMint(cookieCoo),
    }).validateSchema(SkemaDaftarAudit)

    await log.step('THEN 200 dan entry audit pendaftaran memuat email pendaftar')
    expect(status).toBe(STATUS_OK)
    expect(JSON.stringify(body.data)).toContain(emailPendaftar)
  })
})

test.describe('[P2] Guard endpoint dev-only pemakaian file ini', () => {
  test('[P2] POST /api/test/login menolak tanpa secret valid (triple guard)', async ({ apiRequest }) => {
    // Cerminan guard di landing.api.spec.ts: endpoint mint yang dipakai file
    // ini wajib menolak tanpa header TEST_AUTH_SECRET. GAGAL saat red bila
    // pola guard berubah — bukan 200 dalam keadaan apa pun.
    await log.step('GIVEN POST /api/test/login TANPA header TEST_AUTH_SECRET')

    await log.step('WHEN triple guard (NODE_ENV, ENABLE_TEST_AUTH, secret) menilai permintaan')
    const { status } = await apiRequest({
      method: 'POST',
      path: '/api/test/login',
      body: { userIdentifier: 'unlinked', email: emailSintetisUji() },
    })

    await log.step('THEN tidak pernah 200 — 401/403/404 (tanpa secret = guard menolak)')
    expect([STATUS_UNAUTHORIZED, STATUS_FORBIDDEN, STATUS_NOT_FOUND]).toContain(status)
  })
})
