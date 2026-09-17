/**
 * ATDD GREEN-PHASE — Story 1.3 "Audit Trail — Pencatatan & Tampilan COO".
 *
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; seluruh asersi ter-pin dari red-phase tidak
 * berubah. Kontrak yang diperiksa = matriks I/O spec Story 1.3 (beku) +
 * renegosiasi user 2026-09-17 (limit opsional):
 * - GET /api/audit tanpa sesi            → 401 envelope { code, message, details }
 * - GET /api/audit sesi non-COO          → 403 envelope (HTTP_STATUS.forbidden)
 * - GET /api/audit?page=bukan-angka      → 400 envelope
 * - GET /api/audit sesi COO              → 200 { data, nextPage } urut created_at desc,
 *                                          nextPage null bila habis; limit default 20,
 *                                          opsi 20/40/80, di luar opsi → 400
 * - POST /api/test/audit-seed (dev-only) → triple-guard pola login.post.ts
 *
 * Kontrak seed terwujud: body `{ jumlah: <n> }` + header TEST_AUTH_SECRET
 * (server/api/test/audit-seed.post.ts — menulis via API publik modul audit
 * dalam satu transaksi, AD-3). Test stateful menjamin prekondisinya sendiri
 * via helper dev-only `denganAuditKosong` (TRUNCATE koneksi ADMIN + advisory
 * lock antar project browser, lihat tests/support/helpers/audit-reset.ts) —
 * asersi ter-pin tidak berubah; grants role `app_runtime` tetap menutup
 * jalur tulis runtime (reset bukan jalur aplikasi).
 *
 * Pact: use_pactjs_utils=true TETAPI gerbang relevansi TUTUP (satu aplikasi,
 * bukan microservices) → TIDAK ada contract test di story ini.
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod via metode promise
 * `.validateSchema(skema)` (kontrak library — BUKAN opsi params); `log.step` untuk
 * milestone GIVEN/WHEN/THEN; tanpa console.log, tanpa waitForTimeout.
 */
import type { Cookie, Playwright } from '@playwright/test'
import { z } from 'zod'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'
import { denganAuditKosong } from '../support/helpers/audit-reset'

/** Secret guard endpoint dev-only — fallback wajib identik env TEST_AUTH_SECRET uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** Derivasi cookie sesi (pola landing.api.spec.ts) — varian __Secure- di https. */
const BASE_URL_UJI = process.env.BASE_URL ?? 'http://localhost:3000'
const DOMAIN_BASE_URL = new URL(BASE_URL_UJI).hostname
const COOKIE_AMAN = new URL(BASE_URL_UJI).protocol === 'https:'
const NAMA_COOKIE_SESSION = COOKIE_AMAN ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

/** Context request ber-cookie sesi yang ikut dikirim di SETIAP hop — dipakai
 *  test yang menyangkut redirect (Cookie manual tidak di-replay antar hop;
 *  pola /api/pendaftaran/status di landing.api.spec.ts). */
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

/** LIMIT maksimum /api/audit (opsi `?limit=` 20/40/80 — renegosiasi user 2026-09-17). */
const LIMIT_MAKS_AUDIT = 80
/** LIMIT default bila `?limit=` tidak hadir (renegosiasi user 2026-09-17). */
const LIMIT_DEFAULT_AUDIT = 20
/** Jumlah entry seed untuk test baca dasar (di atas baseline apa pun). */
const JUMLAH_SEED_DASAR = 3
/** Jumlah entry seed test paging: LIMIT MAKS + 1 agar halaman 2 (limit maks) terisi. */
const JUMLAH_SEED_PAGING = LIMIT_MAKS_AUDIT + 1
/** Jumlah entry seed test guard (nilai tak berpengaruh — guard menolak sebelum seed). */
const JUMLAH_SEED_GUARD = 1
/** Pengaman iterasi paging — DB dev dipakai bersama test lain; jangan loop tanpa batas. */
const BATAS_MAKS_HALAMAN_DILINTAS = 10

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper lokal. */
interface ParamsApiRequest {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  headers?: Record<string, string>
}
type ApiRequestUji = (params: ParamsApiRequest) => Promise<{ status: number, body: unknown }>

/** Envelope error seragam — kontrak server/utils/api-error.ts. */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/**
 * ASUMSI BENTUK WIRE ENTRY AUDIT (belum di-pin spec — selaraskan saat
 * green-phase, jangan dianggap beku):
 * - camelCase (`createdAt`) mengikuti konvensi wire repo (`rejectionReason`);
 *   kolom DB timestamptz mode string → ISO-8601, urut-leksikografis sah.
 * - `actor { kind, ownerId? }` sesuai envelope AD-3; email aktor untuk
 *   tampilan bisa di-join di server — field ekstra diabaikan zod (non-strict).
 * - `id` uuid (konvensi repo), `target` boleh null, `details` jsonb notNull.
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

/**
 * Respons GET /api/audit: `{ data, nextPage }`; nextPage null bila habis.
 * Representasi nextPage (number vs string) belum di-pin spec — skema sengaja
 * longgar; yang di-pin spec adalah PERILAKU null ⇔ tidak ada halaman lanjutan.
 */
const SkemaDaftarAudit = z.object({
  data: z.array(SkemaEntryAudit),
  nextPage: z.union([z.number().int().positive(), z.string().min(1), z.null()]),
})
type DaftarAudit = z.infer<typeof SkemaDaftarAudit>

/** Cookie[] hasil mintSesiPemilik → header Cookie untuk apiRequest (apiRequest
 *  tidak berbagi cookie-jar konteks browser — cookie dikirim eksplisit per-hop). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/**
 * ASUMSI KONTRAK SEED: POST /api/test/audit-seed body `{ jumlah }` + header
 * TEST_AUTH_SECRET (pola mintSesiPemilik). GAGAL saat red: 404 — endpoint
 * seed belum ada; asersi status di bawah menjadi kegagalan pertama yang
 * menjelaskan diri sendiri.
 */
async function seedAuditUji(apiRequest: ApiRequestUji, jumlah: number): Promise<void> {
  const jawabSeed = await apiRequest({
    method: 'POST',
    path: '/api/test/audit-seed',
    body: { jumlah },
    headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
  })
  expect(jawabSeed.status, 'endpoint seed audit dev-only merespons 200').toBe(200)
}

test.describe('[P0] GET /api/audit tanpa sesi (AD-8 wajib auth)', () => {
  test('[P0] /api/audit menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint /api/audit belum ada; validasi
    // SkemaEnvelopeError melempar sebelum asersi status tercapai.
    await log.step('GIVEN permintaan GET /api/audit tanpa cookie sesi')

    await log.step('WHEN route handler audit menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/audit',
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(401)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P0] GET /api/audit sesi non-COO (status 403 baru)', () => {
  test('[P0] /api/audit menolak pemegang-saham dengan envelope 403', async ({ apiRequest }) => {
    // GAGAL saat red: GET /api/audit menjawab 404 (endpoint belum ada) — 403
    // menuntut HTTP_STATUS.forbidden yang baru ditambahkan saat green-phase.
    await log.step('GIVEN sesi pemegang saham (role ≠ coo) dari endpoint mint dev-only')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })

    await log.step('WHEN GET /api/audit membawa cookie sesi non-COO')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/audit',
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — kewenangan baca ditegakkan di server (AD-8)')
    expect(status).toBe(403)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] GET /api/audit query page tidak valid', () => {
  test('[P1] /api/audit?page=bukan-angka ditolak dengan envelope 400', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint /api/audit belum ada; validasi envelope
    // gagal lebih dulu.
    await log.step('GIVEN sesi COO aktif')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN GET /api/audit dengan query page bukan angka')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/audit?page=bukan-angka',
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 envelope — query page tidak valid ditolak server')
    expect(status).toBe(400)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[P1] GET /api/audit sesi COO setelah seed', () => {
  test('[P1] /api/audit mengembalikan { data, nextPage } urut created_at desc setelah seed', async ({ apiRequest }) => {
    // GAGAL saat red: baseline GET /api/audit menjawab 404 (endpoint belum
    // ada) sebelum seed maupun asersi manapun. Reset dev-only menjamin
    // baseline terukur walau tabel pernah berisi (asersi tak diubah).
    await denganAuditKosong(async () => {
      await log.step('GIVEN sesi COO dan baseline daftar audit terbaca')
      const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
      const headerCookie = headerCookieDariMint(cookieSesi)

      const jawabBaseline = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit',
        headers: headerCookie,
      }).validateSchema(SkemaDaftarAudit)
      expect(jawabBaseline.status).toBe(200)
      const baseline = jawabBaseline.body.data.length

      await log.step(`WHEN endpoint seed menambah ${JUMLAH_SEED_DASAR} entry lalu COO membaca ulang (default page 1)`)
      await seedAuditUji(apiRequest, JUMLAH_SEED_DASAR)
      const { status, body } = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit',
        headers: headerCookie,
      }).validateSchema(SkemaDaftarAudit)

      await log.step('THEN 200 { data, nextPage } — entry hasil seed bertambah dan urut created_at desc (tie diizinkan: seed satu tx punya now() sama)')
      expect(status).toBe(200)
      expect(body.data.length).toBeGreaterThanOrEqual(baseline + JUMLAH_SEED_DASAR)
      for (let i = 0; i < body.data.length - 1; i += 1) {
        expect(
          body.data[i].createdAt >= body.data[i + 1].createdAt,
          `urutan desc pada indeks ${i}: ${body.data[i].createdAt} >= ${body.data[i + 1].createdAt}`,
        ).toBe(true)
      }
    })
  })
})

test.describe('[P2] Paging GET /api/audit', () => {
  test('[P2] limit default 20, opsi 40/80 dilayani, limit asing 400, nextPage null saat habis', async ({ apiRequest }) => {
    // GAGAL saat red: POST /api/test/audit-seed menjawab 404 (endpoint seed
    // belum ada) — asersi status seed menjadi kegagalan pertama. Reset
    // dev-only menjamin paging berakhir tepat (asersi tak diubah).
    // Kontrak limit = renegosiasi user 2026-09-17 (default 20, opsi 20/40/80,
    // di luar opsi → 400) — menimpa pin matriks awal "LIMIT 100".
    await denganAuditKosong(async () => {
      await log.step(`GIVEN sesi COO dan seed ${JUMLAH_SEED_PAGING} entry audit (LIMIT MAKS + 1)`)
      const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
      const headerCookie = headerCookieDariMint(cookieSesi)
      await seedAuditUji(apiRequest, JUMLAH_SEED_PAGING)

      await log.step('WHEN COO membaca halaman 1 TANPA query limit')
      const halaman1Default = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1',
        headers: headerCookie,
      }).validateSchema(SkemaDaftarAudit)
      expect(halaman1Default.status).toBe(200)
      await log.step(`THEN default = ${LIMIT_DEFAULT_AUDIT} baris dengan halaman lanjutan`)
      expect(halaman1Default.body.data.length).toBe(LIMIT_DEFAULT_AUDIT)
      expect(halaman1Default.body.nextPage, 'baris > default → harus ada halaman lanjutan').not.toBeNull()

      await log.step('AND opsi limit 40 dan 80 dilayani sesuai permintaan')
      const limit40 = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=40',
        headers: headerCookie,
      }).validateSchema(SkemaDaftarAudit)
      expect(limit40.status).toBe(200)
      expect(limit40.body.data.length).toBe(40)

      const halaman1 = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=80',
        headers: headerCookie,
      }).validateSchema(SkemaDaftarAudit)
      expect(halaman1.status).toBe(200)
      // Seed LIMIT MAKS + 1 menjamin halaman 1 (limit maks) penuh tanpa
      // bergantung jumlah baris lain di DB dev.
      expect(halaman1.body.data.length).toBe(LIMIT_MAKS_AUDIT)
      expect(halaman1.body.nextPage, 'baris > limit → harus ada halaman lanjutan').not.toBeNull()

      await log.step('AND limit di luar opsi ditolak 400 envelope')
      const limitAsing = await apiRequest<EnvelopeError>({
        method: 'GET',
        path: '/api/audit?page=1&limit=30',
        headers: headerCookie,
      }).validateSchema(SkemaEnvelopeError)
      expect(limitAsing.status).toBe(400)
      expect(limitAsing.body.message.length).toBeGreaterThan(0)

      await log.step('THEN halaman lanjutan (limit maks) memuat sisa entry tanpa duplikasi sampai nextPage null')
      const idHalaman1 = new Set(halaman1.body.data.map(entry => entry.id))
      let nextPage = halaman1.body.nextPage
      let halamanDilintasi = 1
      while (nextPage !== null && halamanDilintasi < BATAS_MAKS_HALAMAN_DILINTAS) {
        const lanjutan = await apiRequest<DaftarAudit>({
          method: 'GET',
          path: `/api/audit?page=${String(nextPage)}&limit=80`,
          headers: headerCookie,
        }).validateSchema(SkemaDaftarAudit)
        expect(lanjutan.status).toBe(200)
        expect(lanjutan.body.data.length, 'halaman lanjutan tidak kosong').toBeGreaterThan(0)
        for (const entry of lanjutan.body.data) {
          expect(idHalaman1.has(entry.id), `entry ${entry.id} tidak boleh terulang antar halaman`).toBe(false)
        }
        nextPage = lanjutan.body.nextPage
        halamanDilintasi += 1
      }
      expect(nextPage, 'paging berakhir: nextPage null bila habis').toBeNull()
    })
  })
})

test.describe('[P1] GET /api/audit sesi unlinked', () => {
  // Sesi mint TANPA baris owner — akun Google tak terhubung pendaftar mana pun.
  test.use({ authOptions: { userIdentifier: 'unlinked' } })

  test('[P1] /api/audit me-redirect unlinked ke /login?state=unlinked', async ({ playwright, authToken }) => {
    await log.step('GIVEN sesi akun Google tanpa baris owner (unlinked)')

    const ctxCookiePerHop = await contextCookiePerHop(playwright, authToken)

    await log.step('WHEN GET /api/audit membawa cookie sesi unlinked (redirect diikuti)')
    const response = await ctxCookiePerHop.get('/api/audit')
    await response.text()
    await ctxCookiePerHop.dispose()

    await log.step('THEN redirect terlayani sampai dokumen /login?state=unlinked')
    expect(response.status()).toBe(200)
    expect(response.url()).toContain('/login?state=unlinked')
  })
})

test.describe('[P1] Guard endpoint seed audit (dev-only)', () => {
  test('[P1] /api/test/audit-seed menolak tanpa header TEST_AUTH_SECRET', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint seed belum ada. Setelah green-phase,
    // triple-guard (pola server/api/test/login.post.ts) menjawab 401 envelope.
    await log.step('GIVEN POST /api/test/audit-seed TANPA header TEST_AUTH_SECRET')

    await log.step('WHEN triple guard (NODE_ENV, ENABLE_TEST_AUTH, secret) menilai permintaan')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: '/api/test/audit-seed',
      body: { jumlah: JUMLAH_SEED_GUARD },
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 envelope — seed audit ditolak tanpa secret')
    expect(status).toBe(401)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})
