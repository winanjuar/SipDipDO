/**
 * ATDD RED-PHASE (TDD RED) — Story 1.3 "Audit Trail — Pencatatan & Tampilan COO".
 *
 * Scaffold FASE MERAH: SEMUA test di-skip (`test.skip`) sampai developer
 * mengaktifkannya satu per satu pada tugas green-phase Story 1.3. Kontrak
 * yang diperiksa = matriks I/O spec Story 1.3 (beku):
 * - GET /api/audit tanpa sesi            → 401 envelope { code, message, details }
 * - GET /api/audit sesi non-COO          → 403 envelope (status baru HTTP_STATUS.forbidden)
 * - GET /api/audit?page=bukan-angka      → 400 envelope
 * - GET /api/audit sesi COO              → 200 { data, nextPage } urut created_at desc,
 *                                          nextPage null bila habis, LIMIT 100
 * - POST /api/test/audit-seed (dev-only) → triple-guard pola login.post.ts
 *
 * ASUMSI KONTRAK SEED (diselaraskan saat implementasi green-phase): body
 * `{ jumlah: <n> }` + header TEST_AUTH_SECRET — spec hanya mem-pin
 * keberadaan endpoint seed dev-only triple-guard (pola
 * server/api/test/login.post.ts), bentuk body-nya belum di-pin.
 *
 * Pact: use_pactjs_utils=true TETAPI gerbang relevansi TUTUP (satu aplikasi,
 * bukan microservices) → TIDAK ada contract test di story ini.
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod via metode promise
 * `.validateSchema(skema)` (kontrak library — BUKAN opsi params); `log.step` untuk
 * milestone GIVEN/WHEN/THEN; tanpa console.log, tanpa waitForTimeout.
 * Registry AUDIT (shared/domain/audit) SENGAJA tidak diimpor — berkasnya
 * baru lahir saat green-phase sehingga impor akan mematahkan typecheck
 * fase merah.
 */
import type { Cookie } from '@playwright/test'
import { z } from 'zod'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Secret guard endpoint dev-only — fallback wajib identik env TEST_AUTH_SECRET uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** LIMIT halaman /api/audit — spec matriks I/O: "LIMIT konstanta bernama (100)". */
const BATAS_HALAMAN_AUDIT = 100
/** Jumlah entry seed untuk test baca dasar (di atas baseline apa pun). */
const JUMLAH_SEED_DASAR = 3
/** Jumlah entry seed test paging: LIMIT + 1 agar halaman 2 terisi. */
const JUMLAH_SEED_PAGING = BATAS_HALAMAN_AUDIT + 1
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
  test.skip('[P0] /api/audit menolak tanpa sesi dengan envelope 401 seragam', async ({ apiRequest }) => {
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
  test.skip('[P0] /api/audit menolak pemegang-saham dengan envelope 403', async ({ apiRequest }) => {
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
  test.skip('[P1] /api/audit?page=bukan-angka ditolak dengan envelope 400', async ({ apiRequest }) => {
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
  test.skip('[P1] /api/audit mengembalikan { data, nextPage } urut created_at desc setelah seed', async ({ apiRequest }) => {
    // GAGAL saat red: baseline GET /api/audit menjawab 404 (endpoint belum
    // ada) sebelum seed maupun asersi manapun.
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

test.describe('[P2] Paging GET /api/audit', () => {
  test.skip('[P2] nextPage non-null meneruskan halaman berikutnya dan null saat habis', async ({ apiRequest }) => {
    // GAGAL saat red: POST /api/test/audit-seed menjawab 404 (endpoint seed
    // belum ada) — asersi status seed menjadi kegagalan pertama.
    await log.step(`GIVEN sesi COO dan seed ${JUMLAH_SEED_PAGING} entry audit (LIMIT + 1)`)
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const headerCookie = headerCookieDariMint(cookieSesi)
    await seedAuditUji(apiRequest, JUMLAH_SEED_PAGING)

    await log.step('WHEN COO membaca halaman 1')
    const halaman1 = await apiRequest<DaftarAudit>({
      method: 'GET',
      path: '/api/audit?page=1',
      headers: headerCookie,
    }).validateSchema(SkemaDaftarAudit)
    expect(halaman1.status).toBe(200)
    // Spec mem-pin LIMIT konstanta bernama (100); seed LIMIT+1 menjamin
    // halaman 1 penuh tanpa bergantung jumlah baris lain di DB dev.
    expect(halaman1.body.data.length).toBe(BATAS_HALAMAN_AUDIT)
    expect(halaman1.body.nextPage, 'baris > LIMIT → harus ada halaman lanjutan').not.toBeNull()

    await log.step('THEN halaman lanjutan memuat sisa entry tanpa duplikasi halaman 1 sampai nextPage null')
    const idHalaman1 = new Set(halaman1.body.data.map(entry => entry.id))
    let nextPage = halaman1.body.nextPage
    let halamanDilintasi = 1
    while (nextPage !== null && halamanDilintasi < BATAS_MAKS_HALAMAN_DILINTAS) {
      const lanjutan = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: `/api/audit?page=${String(nextPage)}`,
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

test.describe('[P1] Guard endpoint seed audit (dev-only)', () => {
  test.skip('[P1] /api/test/audit-seed menolak tanpa header TEST_AUTH_SECRET', async ({ apiRequest }) => {
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
