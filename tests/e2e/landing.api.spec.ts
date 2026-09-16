/**
 * ATDD RED-PHASE — Story 1.2 "Autentikasi Akun Google & Halaman Login".
 *
 * Scaffold test API-level untuk kontrak server sesuai test design
 * 1-E2E-002 / R-003 (spec Story 1.2 = sumber kebenaran yang beku). SEMUA
 * test masih `test.skip(...)` — fase TDD RED: developer melepas skip per
 * tugas implementasi, membuktikan test merah, lalu menghijaukan dengan
 * implementasi route handler + endpoint dev-only.
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod; `log.step` untuk
 * milestone GIVEN/WHEN/THEN; tanpa hard-wait, logging konsol, atau asersi
 * placeholder. Gaya mengikuti acuan tests/e2e/health.api.spec.ts.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'

/** TODO(verifikasi): nama cookie sesi next-auth v4 (sidebase/nuxt-auth 1.3.1)
 *  — duplikat tersinkron dari NAMA_COOKIE_SESSION di tests/support/auth-fixture.ts;
 *  konfirmasi saat sesi nyata teruji (https memakai awalan `__Secure-`). */
const NAMA_COOKIE_SESSION = 'next-auth.session-token'

/** Secret guard endpoint dev-only — fallback harus identik dengan env
 *  TEST_AUTH_SECRET yang dipakai server uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** Header Cookie sesi untuk semua test terautentikasi di file ini. */
const headerCookieSesi = (token: string): Record<string, string> => ({
  Cookie: `${NAMA_COOKIE_SESSION}=${token}`,
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

/** ASUMSI KONTRAK /api/test/login: body respons berbentuk storage-state
 *  `{ cookies: [...] }` — inilah kontrak yang akan dikonsumsi fixture auth
 *  (manageAuthToken) saat green phase; Set-Cookie tidak terekspos apiRequest. */
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
  test.skip('[P0] /api/landing menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
    // GAGAL saat red: endpoint belum ada → 404 (bukan 401 envelope).
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

  test.skip('[P0] /api/pendaftaran/status menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
    // GAGAL saat red: endpoint belum ada → 404 (bukan 401 envelope).
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

  test.skip('[P1] /api/landing mengarahkan COO aktif ke antrian beli', async ({ apiRequest, authToken }) => {
    // GAGAL saat red: manageAuthToken di tests/support/auth-fixture.ts masih
    // stub sesi-kosong (token undefined → 401, bukan 200). Green phase
    // mengisi stub itu dengan POST /api/test/login (mint cookie NuxtAuth).
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

  test.skip('[P1] /api/landing melaporkan unlinked untuk email tanpa baris owner', async ({ apiRequest, authToken }) => {
    // GAGAL saat red: alasan sama dengan test COO — sesi masih stub kosong.
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

  test.skip('[P1] /api/pendaftaran/status mengembalikan status dan alasan untuk calon owner ditolak', async ({ apiRequest, authToken }) => {
    // GAGAL saat red: endpoint belum ada (404) dan sesi masih stub kosong.
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

  test.skip('[P1] /api/pendaftaran/status me-redirect non-calon ke landing role-nya', async ({ apiRequest, authToken }) => {
    // playwright-utils deviation: apiRequest hanya mengembalikan { status, body }
    // (ApiRequestResponse) — header `location` TIDAK terekspos sehingga target
    // redirect tidak bisa diaersi di sini; tujuan `/dashboard` (pemegang_saham)
    // dikunci lewat asersi status redirect + komentar kontrak ini.
    // Deviation lanjutan: APIRequestContext Playwright mengikuti redirect
    // otomatis (maxRedirects tidak diekspos apiRequest) — saat green, 302 bisa
    // berakhir 200 halaman tujuan; sesuaikan transport saat menghijaukan.
    // GAGAL saat red: endpoint belum ada → 404 (bukan redirect).
    await log.step('GIVEN sesi pemegang saham (bukan calon owner)')

    await log.step('WHEN GET /api/pendaftaran/status membawa cookie sesi')
    const { status } = await apiRequest({
      method: 'GET',
      path: '/api/pendaftaran/status',
      headers: headerCookieSesi(authToken),
    })

    await log.step('THEN redirect (302/307) menuju landing /dashboard')
    expect([302, 307]).toContain(status)
  })
})

test.describe('[P1] API /api/test/login (dev-only)', () => {
  test.skip('[P1] /api/test/login me-mint cookie sesi untuk owner sintetis (dev-only)', async ({ apiRequest }) => {
    // GAGAL saat red: endpoint belum ada → 404.
    await log.step('GIVEN konfigurasi owner sintetis COO + secret TEST_AUTH_SECRET')
    const emailSintetis = faker.internet.email().toLowerCase() // data sintetis locale id_ID — tanpa data nyata

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
    // TODO(green): daftarkan cleanup.track() untuk menghapus owner sintetis
    // hasil seed endpoint ini begitu kontrak pembersihannya tersedia.
  })

  test.skip('[P1] /api/test/login menolak tanpa secret valid (triple guard)', async ({ apiRequest }) => {
    // Catatan RED: endpoint belum ada → 404 sehingga test ini lulus trivial;
    // dipertahankan sebagai guard regresi agar implementasi TANPA triple guard
    // (200 untuk siapa pun) terdeteksi otomatis saat green phase.
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
