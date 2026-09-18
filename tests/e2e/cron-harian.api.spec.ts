/**
 * ATDD RED-PHase — Story 1.5 "Kelengkapan Profile 11 Field" (API, cron harian
 * pengingat H-3 & kedaluwarsa hari ke-7 — CAP-4, AD-9/AD-11, AR-6).
 *
 * SEMUA test `test.skip()` — scaffold TDD red phase; hapus skip HANYA pada
 * tugas green-phase yang mengisi `runRegistrationDailyJob`.
 *
 * KONTRAK YANG DIPIN (epic-1.md Story 1.5 blok AC-2 + AD-9 + AR-6):
 * - Cron harian `/api/jobs/daily` terproteksi CRON_SECRET (endpoint hijau
 *   sejak scaffold; guard `Authorization: Bearer` timing-safe).
 * - Batas hari dihitung DI DALAM endpoint zona Asia/Jakarta (AD-9) — test
 *   menyuntik WAKTU lewat data: seed baris owner backdated via
 *   `diajukanPada` (DayKey kalender Jakarta), BUKAN dengan memajukan jam.
 * - H-3 (3 hari kalender sebelum kedaluwarsa) → email pengingat MASUK
 *   OUTBOX (baris in-tx modul proofs, kirim async + retry terpisah); hari
 *   ke-7 → transisi `diajukan → kedaluwarsa` via CAS + entry audit.
 * - Idempoten: job yang sama pada hari yang sama tidak dobel mengirim /
 *   tidak dobel memutasi.
 *
 * KONTRAK TEST-INFRA BARU (asumsi eksplisit — final saat green-phase):
 * - Mint `/api/test/login` menerima override opsional `diajukanPada`
 *   (DayKey 'YYYY-MM-DD' kalender Jakarta).
 * - Respons `/api/jobs/daily` `details.jobs.registration` memuat BUKAN hanya
 *   counter: `{ reminded, expired, remindedEmails, expiredEmails }` — stub
 *   saat ini hanya `{ reminded: 0, expired: 0 }` sehingga skema zod gagal =
 *   merah jujur.
 * - Endpoint inspeksi dev-only BARU `GET /api/test/outbox?email=<email>`
 *   (triple-guard sama dengan /api/test/login, header TEST_AUTH_SECRET)
 *   mengembalikan `{ data: [{ id, kind, to, status, createdAt, ... }] }`.
 *
 * GAGAL SAAT RED: stub `runRegistrationDailyJob` tidak pernah menulis outbox
 * dan tidak pernah memutasi status — semua asersi muatan (emails/outbox/
 * status) gagal. Guard #14 adalah test regresi: endpoint hijau sejak scaffold.
 *
 * Pact: gerbang relevansi TUTUP (satu aplikasi). Mandate playwright-utils:
 * `test` HANYA dari merged-fixtures; HTTP via `apiRequest`; zod
 * `.validateSchema`; `log.step`; tanpa request mentah/console.log.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import type { ApiRequestFixtureParams } from '@seontechnologies/playwright-utils/api-request'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP yang dipakai file ini — tanpa magic number. */
const STATUS_OK = 200
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403

/** Offset WIB terhadap UTC dalam menit (UTC+7) — AD-9. */
const OFFSET_MENIT_JAKARTA = 420

/** Seeding relatif terhadap hari kalender Jakarta berjalan (AD-9: waktu
 *  disuntikkan lewat data, bukan jam). H-3 = reminderOn hari ini →
 *  diajukanPada = hari−4; hari kedaluwarsa = hari ini → diajukanPada = hari−7;
 *  sebelum H-3 → diajukanPada = hari−2. Konstanta 7/3/4/2 memetakan
 *  REGISTRATION_EXPIRY_DAYS=7 & REMINDER H-3 (registration.service). */
const HARI_REMINDER_H3 = 4
const HARI_EXPIRY_H7 = 7
const HARI_SEBELUM_REMINDER = 2

const PATH_CRON = '/api/jobs/daily'
const PATH_OUTBOX_UJI = '/api/test/outbox'

/** Secret cron lokal — fallback identik env NUXT_CRON_SECRET dev (.env lokal;
 *  nilai dev-only, bukan rahasia produksi; pola TEST_AUTH_SECRET di
 *  sesi-minting.ts). */
const SECRET_CRON = process.env.NUXT_CRON_SECRET ?? 'dev-cron-secret'

/** Secret guard endpoint dev-only — fallback identik TEST_AUTH_SECRET. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** Cookie[] hasil mint → header Cookie untuk apiRequest. */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Header auth cron — Vercel Cron mengirim `Authorization: Bearer <secret>`. */
const headerCron = (): Record<string, string> => ({ Authorization: `Bearer ${SECRET_CRON}` })

/** Email sintetis unik pola mint dev-only (prefix terkunci). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** DayKey 'YYYY-MM-DD' kalender Jakarta `n` hari kalender lalu (AD-9 — pola
 *  redaftar.api.spec.ts). */
const hariJakartaMinus = (nHari: number): string => {
  const kiniWib = new Date(Date.now() + OFFSET_MENIT_JAKARTA * 60_000)
  kiniWib.setUTCDate(kiniWib.getUTCDate() - nHari)
  return kiniWib.toISOString().slice(0, 10)
}

/** Bentuk wire job registrasi — counter + DAFTAR EMAIL (muatan nyata; stub
 *  lama tanpa field email gagal skema = merah jujur). */
const SkemaJobRegistrasi = z.object({
  reminded: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  remindedEmails: z.array(z.string()),
  expiredEmails: z.array(z.string()),
})

/** Bentuk wire respons /api/jobs/daily (daily.post.ts: { code, message, details }). */
const SkemaResponsCron = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.object({
    today: z.string().min(1),
    jobs: z.object({
      registration: SkemaJobRegistrasi,
      outbox: z.record(z.string(), z.unknown()),
    }),
  }),
})
type ResponsCron = z.infer<typeof SkemaResponsCron>

/** Bentuk wire inspeksi outbox dev-only — pin longgar (green-phase boleh
 *  menambah field; yang wajib: id/kind/to/status/createdAt string). */
const SkemaInspeksiOutbox = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
    to: z.string().min(1),
    status: z.string().min(1),
    createdAt: z.string().min(1),
  })),
})

/** Envelope error seragam (duplikasi bentuk register.api.spec.ts — disengaja). */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper —
 *  pola sesi-minting.ts. */
type ApiRequestSesi = <T = unknown>(
  params: ApiRequestFixtureParams,
) => Promise<{ status: number, body: T }>

/** Seed calon owner `diajukan` belum lengkap backdated, lalu kembalikan
 *  { email, cookieSesi } — sesi DIPERTAHANKAN agar verifikasi pasca-cron
 *  membaca mutasi pada baris yang sama (bukan re-seed = tautologi). */
const seedCalonBackdated = async (
  apiRequest: ApiRequestSesi,
  diajukanPada: string,
): Promise<{ email: string, headerSesi: Record<string, string> }> => {
  const email = emailSintetisUji()
  const cookieSesi = await mintSesiPemilik(apiRequest, {
    userIdentifier: 'tanpa-saham',
    status: 'diajukan',
    email,
    diajukanPada,
  })
  return { email, headerSesi: headerCookieDariMint(cookieSesi) }
}

/** Jalankan job harian dengan auth cron; kembalikan seluruh respons tervalidasi. */
const jalankanCron = async (apiRequest: ApiRequestSesi): Promise<ResponsCron> =>
  apiRequest<ResponsCron>({
    method: 'POST',
    path: PATH_CRON,
    body: {},
    headers: headerCron(),
  }).validateSchema(SkemaResponsCron)

/** Inspeksi baris outbox dev-only untuk satu email penerima. */
const inspeksiOutbox = async (
  apiRequest: ApiRequestSesi,
  email: string,
): Promise<z.infer<typeof SkemaInspeksiOutbox>> =>
  apiRequest<z.infer<typeof SkemaInspeksiOutbox>>({
    method: 'GET',
    path: `${PATH_OUTBOX_UJI}?email=${encodeURIComponent(email)}`,
    headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
  }).validateSchema(SkemaInspeksiOutbox)

test.describe('[P1] Cron H-3 → email pengingat masuk outbox (CAP-4, AR-6)', () => {
  test.skip('[P1] pendaftar diajukan belum lengkap pada hari reminderOn → reminded memuat email + baris outbox ada', async ({ apiRequest }) => {
    // GAGAL saat red: stub { reminded: 0, expired: 0 } tanpa field emails →
    // skema SkemaResponsCron melempar; inspeksi outbox pun 404 (endpoint baru).
    await log.step('GIVEN calon diajukan belum lengkap dengan reminderOn = hari Jakarta ini (diajukanPada hari-4)')
    const { email } = await seedCalonBackdated(apiRequest, hariJakartaMinus(HARI_REMINDER_H3))

    await log.step('WHEN job harian dijalankan (POST /api/jobs/daily dengan CRON_SECRET)')
    const { status, body } = await jalankanCron(apiRequest)
    expect(status).toBe(STATUS_OK)

    await log.step('THEN job melaporkan email pendaftar di remindedEmails')
    expect(body.details.jobs.registration.remindedEmails).toContain(email)

    await log.step('AND baris outbox pengingat untuk email itu ada (belum tentu terkirim — kirim async)')
    const outbox = await inspeksiOutbox(apiRequest, email)
    expect(outbox.data.length).toBeGreaterThanOrEqual(1)
  })
})

test.describe('[P1] Cron hari ke-7 → kedaluwarsa via CAS + audit (CAP-4, AD-11)', () => {
  test.skip('[P1] pendaftar pada/expired hari ke-7 → status kedaluwarsa + expiredEmails memuat email', async ({ apiRequest }) => {
    // GAGAL saat red: stub tidak pernah memutasi status — echo register tetap
    // 'diajukan' dan skema respons cron gagal lebih dulu di field emails.
    await log.step('GIVEN calon diajukan belum lengkap dengan expiresOn = hari Jakarta ini (diajukanPada hari-7)')
    const { email, headerSesi } = await seedCalonBackdated(apiRequest, hariJakartaMinus(HARI_EXPIRY_H7))

    await log.step('WHEN job harian dijalankan')
    const { status, body } = await jalankanCron(apiRequest)
    expect(status).toBe(STATUS_OK)

    await log.step('THEN job melaporkan email pendaftar di expiredEmails')
    expect(body.details.jobs.registration.expiredEmails).toContain(email)

    await log.step('AND status owner kini kedaluwarsa — POST /api/register menggemakan status baris YANG SAMA (sesi GIVEN, tanpa re-seed)')
    // Pin longgar: echo status existing (kontrak hijau Story 1.4); transisi
    // re-daftar dipin terpisah di redaftar.api.spec.ts.
    const echo = await apiRequest<{ status: string }>({
      method: 'POST',
      path: '/api/register',
      body: {},
      headers: headerSesi,
    })
    expect(echo.body.status).toBe('kedaluwarsa')
  })
})

test.describe('[P1] Cron sebelum H-3 → tanpa aksi (boundary aman)', () => {
  test.skip('[P1] pendaftar diajukanPada hari-2 → remindedEmails/expiredEmails tidak memuat email', async ({ apiRequest }) => {
    // GAGAL saat red (tetap merah jujur): skema respons cron menuntut field
    // emails yang belum ada pada stub — test ini memastikan kontrak muatan,
    // bukan sekadar counter nol.
    await log.step('GIVEN calon diajukan belum lengkap yang BELUM masuk jendela H-3 (diajukanPada hari-2)')
    const { email } = await seedCalonBackdated(apiRequest, hariJakartaMinus(HARI_SEBELUM_REMINDER))

    await log.step('WHEN job harian dijalankan')
    const { status, body } = await jalankanCron(apiRequest)
    expect(status).toBe(STATUS_OK)

    await log.step('THEN email pendaftar tidak ada di remindedEmails maupun expiredEmails')
    expect(body.details.jobs.registration.remindedEmails).not.toContain(email)
    expect(body.details.jobs.registration.expiredEmails).not.toContain(email)
  })
})

test.describe('[P1] Cron idempoten — job sama di hari sama tidak dobel (AR-6)', () => {
  test.skip('[P1] run 2x pada hari H-3 yang sama → baris outbox untuk email itu tetap tepat 1', async ({ apiRequest }) => {
    // GAGAL saat red: skema respons cron gagal lebih dulu (field emails belum ada).
    await log.step('GIVEN calon diajukan pada hari reminderOn')
    const { email } = await seedCalonBackdated(apiRequest, hariJakartaMinus(HARI_REMINDER_H3))

    await log.step('WHEN job harian dijalankan DUA KALI pada hari yang sama')
    await jalankanCron(apiRequest)
    await jalankanCron(apiRequest)

    await log.step('THEN outbox untuk email itu tetap tepat 1 baris')
    const outbox = await inspeksiOutbox(apiRequest, email)
    expect(outbox.data).toHaveLength(1)
  })
})

test.describe('[P2] Guard cron — CRON_SECRET wajib (regresi; endpoint hijau sejak scaffold)', () => {
  test.skip('[P2] POST /api/jobs/daily tanpa secret → 401 envelope seragam', async ({ apiRequest }) => {
    // Test REGRESI: endpoint /api/jobs/daily hijau sejak Story 1.1 scaffold —
    // kemungkinan langsung lulus saat diaktifkan; dipertahankan sebagai
    // penguat AD-9 (job tersembunyi tanpa guard dilarang).
    await log.step('GIVEN POST /api/jobs/daily TANPA header Authorization')

    await log.step('WHEN guard timing-safe menilai permintaan')
    const { status, body } = await apiRequest<z.infer<typeof SkemaEnvelopeError>>({
      method: 'POST',
      path: PATH_CRON,
      body: {},
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 (bukan pernah 2xx) dengan envelope seragam')
    expect([STATUS_UNAUTHORIZED, STATUS_FORBIDDEN]).toContain(status)
    expect(body.message.length).toBeGreaterThan(0)
  })
})
