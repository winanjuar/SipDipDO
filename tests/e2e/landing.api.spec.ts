/**
 * ATDD GREEN-PHASE — Story 1.2 "Autentikasi Akun Google & Halaman Login".
 *
 * Kontrak server sesuai test design 1-E2E-002 / R-003 (spec Story 1.2 =
 * sumber kebenaran yang beku). Test red-phase diaktifkan satu per satu pada
 * tugas green-phase; implementasi route handler + endpoint dev-only ada.
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod; `log.step` untuk
 * milestone GIVEN/WHEN/THEN; tanpa hard-wait, logging konsol, atau asersi
 * placeholder. Gaya mengikuti acuan tests/e2e/health.api.spec.ts.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Playwright } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'

/** Nama cookie sesi next-auth v4 (sidebase/nuxt-auth 1.3.1) — diturunkan dari
 *  skema BASE_URL (varian `__Secure-` di https); terverifikasi lewat uji mint
 *  di file ini; sinkron dengan derivasi di server/api/test/login.post.ts dan
 *  auth-fixture.ts. */
const BASE_URL_UJI = process.env.BASE_URL ?? 'http://localhost:3000'
const DOMAIN_BASE_URL = new URL(BASE_URL_UJI).hostname
const COOKIE_AMAN = new URL(BASE_URL_UJI).protocol === 'https:'
const NAMA_COOKIE_SESSION = COOKIE_AMAN ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

/** Secret guard endpoint dev-only — fallback harus identik dengan env
 *  TEST_AUTH_SECRET yang dipakai server uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** Header Cookie sesi untuk semua test terautentikasi di file ini. */
const headerCookieSesi = (token: string): Record<string, string> => ({
  Cookie: `${NAMA_COOKIE_SESSION}=${token}`,
})

/** Context request ber-cookie sesi yang ikut di kirim di SETIAP hop —
 *  dipakai test yang menyangguti redirect (Cookie manual tidak di-replay
 *  antar hop oleh APIRequestContext; Cookie dikelola via cookie-jar). */
const contextCookiePerHop = async (
  playwright: Playwright,
  token: string,
) => playwright.request.newContext({
  baseURL: BASE_URL_UJI,
  storageState: {
    cookies: [{
      name: NAMA_COOKIE_SESSION,
      value: token,
      domain: DOMAIN_BASE_URL,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: COOKIE_AMAN,
      sameSite: 'Lax',
    }],
    origins: [],
  },
})

/** Envelope error seragam — kontrak server/utils/api-error.ts. */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/** Respons GET /api/landing dengan sesi: peta landing role ATAU unlinked. */
const SkemaLanding = z.union([
  z.object({
    path: z.string().min(1),
    role: z.enum(['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner']),
  }),
  z.object({ unlinked: z.literal(true) }),
])
type Landing = z.infer<typeof SkemaLanding>

/** Respons GET /api/pendaftaran/status khusus calon owner. */
const SkemaStatusPendaftaran = z.object({
  status: z.enum(['diajukan', 'ditolak', 'kedaluwarsa']),
  rejectionReason: z.string(),
})
type StatusPendaftaran = z.infer<typeof SkemaStatusPendaftaran>

/** ASUMSI KONTRAK /api/test/login (terkonfirmasi green): body respons
 *  berbentuk storage-state `{ cookies: [...] }` — dikonsumsi fixture auth
 *  (manageAuthToken) karena Set-Cookie tidak terekspos apiRequest. */
const SkemaSesiMint = z.object({
  cookies: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .min(1),
})
type SesiMint = z.infer<typeof SkemaSesiMint>

test.describe('[P0] API tanpa sesi (AD-8 wajib auth)', () => {
  test('[P0] /api/landing menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
    await log.step('GIVEN permintaan GET /api/landing tanpa cookie sesi')

    await log.step('WHEN route handler wajib auth menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/landing',
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(401)
    expect(typeof body.code).toBe('string')
    expect(body.code.length).toBeGreaterThan(0)
    expect(typeof body.message).toBe('string')
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P0] /api/pendaftaran/status menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
    await log.step('GIVEN permintaan GET /api/pendaftaran/status tanpa cookie sesi')

    await log.step('WHEN route handler khusus calon owner menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/pendaftaran/status',
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(401)
    expect(typeof body.code).toBe('string')
    expect(body.code.length).toBeGreaterThan(0)
    expect(typeof body.message).toBe('string')
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] API /api/landing dengan sesi COO', () => {
  // authOptions dipasang di level describe — test.use DILARANG di dalam body
  // test (Playwright melempar error) — dan terpasang SEBELUM fixture authToken
  // di-resolve.
  test.use({ authOptions: { userIdentifier: 'coo' } })

  test('[P1] /api/landing mengarahkan COO aktif ke antrian beli', async ({ apiRequest, authToken }) => {
    await log.step('GIVEN sesi COO aktif pada cookie next-auth.session-token')

    await log.step('WHEN GET /api/landing membawa cookie sesi')
    const { status, body } = await apiRequest<Landing>({
      method: 'GET',
      path: '/api/landing',
      headers: headerCookieSesi(authToken),
      validateSchema: SkemaLanding,
    })

    await log.step('THEN 200 dengan peta landing coo → /antrian-beli')
    expect(status).toBe(200)
    expect(body).toEqual({ path: '/antrian-beli', role: 'coo' })
  })
})

test.describe('[P1] API /api/landing dengan sesi email tak terhubung owner', () => {
  // `unlinked`: mint sesi TANPA seed owner — mensimulasikan akun Google yang
  // tidak punya baris di tabel owners (kontrak: mint tetap berhasil).
  test.use({ authOptions: { userIdentifier: 'unlinked' } })

  test('[P1] /api/landing melaporkan unlinked untuk email tanpa baris owner', async ({ apiRequest, authToken }) => {
    await log.step('GIVEN sesi akun Google tanpa baris owner terkait')

    await log.step('WHEN GET /api/landing membawa cookie sesi')
    const { status, body } = await apiRequest<Landing>({
      method: 'GET',
      path: '/api/landing',
      headers: headerCookieSesi(authToken),
      validateSchema: SkemaLanding,
    })

    await log.step('THEN 200 dengan penanda { unlinked: true }')
    expect(status).toBe(200)
    expect(body).toEqual({ unlinked: true })
  })
})

test.describe('[P1] API /api/pendaftaran/status calon owner ditolak', () => {
  test.use({ authOptions: { userIdentifier: 'calon-ditolak' } })

  test('[P1] /api/pendaftaran/status mengembalikan status dan alasan untuk calon owner ditolak', async ({ apiRequest, authToken }) => {
    await log.step('GIVEN sesi calon owner dengan pendaftaran berstatus ditolak')

    await log.step('WHEN GET /api/pendaftaran/status membawa cookie sesi')
    const { status, body } = await apiRequest<StatusPendaftaran>({
      method: 'GET',
      path: '/api/pendaftaran/status',
      headers: headerCookieSesi(authToken),
      validateSchema: SkemaStatusPendaftaran,
    })

    await log.step('THEN 200 dengan status ditolak dan rejectionReason non-kosong')
    expect(status).toBe(200)
    expect(body.status).toBe('ditolak')
    expect(body.rejectionReason.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] API /api/pendaftaran/status non-calon owner', () => {
  test.use({ authOptions: { userIdentifier: 'pemegang-saham' } })

  test('[P1] /api/pendaftaran/status me-redirect non-calon ke landing role-nya', async ({ playwright, authToken }) => {
    // Deviasi transport (tercatat sejak red-phase, diputuskan saat green):
    // apiRequest TIDAK mengekspos header `location` dan Cookie manual tidak
    // di-replay antar hop redirect — pakai context ber-cookie per-hop.
    // Kontrak redirect dikunci lewat asersi URL + konten dokumen tujuan
    // (heading Dashboard kerangka).
    await log.step('GIVEN sesi pemegang saham (bukan calon owner)')

    const ctxCookiePerHop = await contextCookiePerHop(playwright, authToken)

    await log.step('WHEN GET /api/pendaftaran/status membawa cookie sesi (redirect diikuti)')
    const response = await ctxCookiePerHop.get('/api/pendaftaran/status')
    const body = await response.text()
    await ctxCookiePerHop.dispose()

    await log.step('THEN redirect terlayani sampai dokumen landing /dashboard')
    expect(response.status()).toBe(200)
    expect(response.url()).toContain('/dashboard')
    expect(body).toContain('Dashboard')
  })
})

test.describe('[P1] API /api/pendaftaran/status unlinked', () => {
  test.use({ authOptions: { userIdentifier: 'unlinked' } })

  test('[P1] /api/pendaftaran/status me-redirect unlinked ke /login?state=unlinked', async ({ playwright, authToken }) => {
    await log.step('GIVEN sesi akun Google tanpa baris owner (unlinked)')

    const ctxCookiePerHop = await contextCookiePerHop(playwright, authToken)

    await log.step('WHEN GET /api/pendaftaran/status membawa cookie sesi (redirect diikuti)')
    const response = await ctxCookiePerHop.get('/api/pendaftaran/status')
    const body = await response.text()
    await ctxCookiePerHop.dispose()

    await log.step('THEN redirect ke /login?state=unlinked dengan pesan arahan verbatim')
    expect(response.status()).toBe(200)
    expect(response.url()).toContain('/login?state=unlinked')
    expect(body).toContain('Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran.')
  })
})

test.describe('[P1] API /api/test/login (dev-only)', () => {
  test('[P1] /api/test/login me-mint cookie sesi untuk owner sintetis (dev-only)', async ({ apiRequest }) => {
    await log.step('GIVEN konfigurasi owner sintetis COO + secret TEST_AUTH_SECRET')
    // Email sintetis acak @gmail.com berawalan mint uji (server menolak
    // override di luar 'uji.snddash.e2e.*@gmail.com' agar mint tak pernah
    // menimpa baris non-sintetis maupun baris seed dev 'uji.snddash.*').
    const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
    const emailSintetis = `uji.snddash.e2e.${lokalUji}@gmail.com`

    await log.step('WHEN POST /api/test/login dengan triple guard terpenuhi')
    const { status, body } = await apiRequest<SesiMint>({
      method: 'POST',
      path: '/api/test/login',
      body: {
        userIdentifier: 'coo',
        email: emailSintetis,
        status: 'terverifikasi',
        cooAktif: true,
        punyaSaham: true,
      },
      headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
      validateSchema: SkemaSesiMint,
    })

    await log.step('THEN 200 dan cookie sesi next-auth.session-token terbit')
    expect(status).toBe(200)
    expect(body.cookies.some((c) => c.name === NAMA_COOKIE_SESSION)).toBe(true)
    // TODO(cleanup): kontrak pembersihan owner sintetis hasil seed menyusul
    // Story 1.4 (API tulis identity) — email uji deterministik di-upsert,
    // email faker tersisa di DB lokal dev-only.
  })

  test('[P1] /api/test/login menolak tanpa secret valid (triple guard)', async ({ apiRequest }) => {
    await log.step('GIVEN POST /api/test/login tanpa header TEST_AUTH_SECRET')
    const emailSintetis = faker.internet.email().toLowerCase()

    await log.step('WHEN triple guard (NODE_ENV, ENABLE_TEST_AUTH, secret) menilai permintaan')
    const { status } = await apiRequest({
      method: 'POST',
      path: '/api/test/login',
      body: { userIdentifier: 'coo', email: emailSintetis },
    })

    await log.step('THEN tidak pernah 200 — 401/403/404')
    expect([401, 403, 404]).toContain(status)
  })
})
