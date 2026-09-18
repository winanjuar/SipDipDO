/**
 * ATDD RED-PHASE — Story 1.5 "Kelengkapan Profile 11 Field" (API, re-daftar
 * pendaftar kedaluwarsa — CAP-5, AD-11).
 *
 * Tests DIAKTIFKAN pada tugas green-phase yang mengimplementasikan transisi
 * CAS `kedaluwarsa → diajukan` di jalur POST /api/register.
 *
 * KONTRAK YANG DIPIN (epic-1.md Story 1.5 blok AC-3 + AD-11):
 * - Pendaftar berstatus `kedaluwarsa` mendaftar ulang dengan email yang sama
 *   → transisi `kedaluwarsa → diajukan` pada BARIS OWNER YANG SAMA via
 *   compare-and-set (bukan baris baru), tercatat audit.
 * - POST kedua beruntun (kini `diajukan`) → 200 idempotent baris sama
 *   (kontrak hijau Story 1.4 yang sudah terpin register.api.spec.ts).
 *
 * KONTRAK TEST-INFRA BARU (asumsi eksplisit — final saat green-phase):
 * - Mint `/api/test/login` menerima override opsional `diajukanPada`
 *   (DayKey 'YYYY-MM-DD' kalender Jakarta) untuk seeding baris backdated.
 *
 * GAGAL SAAT RED: impl POST /api/register saat ini MENGEMBALIKAN baris
 * existing apa adanya tanpa mutasi (echo `kedaluwarsa`) — test #1 mengharapkan
 * literal `diajukan` → skema zod melempar = merah jujur. Test hijau existing
 * di register.api.spec.ts TIDAK disentuh.
 *
 * Pact: gerbang relevansi TUTUP (satu aplikasi). Mandate playwright-utils:
 * `test` HANYA dari merged-fixtures; HTTP via `apiRequest`; zod
 * `.validateSchema`; `log.step`; tanpa request mentah/console.log.
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP yang dipakai file ini — tanpa magic number. */
const STATUS_OK = 200

/** Offset WIB terhadap UTC dalam menit (UTC+7) — AD-9: batas hari kalender
 *  Jakarta, bukan zona server. */
const OFFSET_MENIT_JAKARTA = 420

/** Hari seeding kedaluwarsa: 8 hari kalender lalu (sudah melewati expiresOn hari-7). */
const HARI_KEDALUWARSA_LALU = 8

const PATH_REGISTER = '/api/register'

/** Cookie[] hasil mint → header Cookie untuk apiRequest (pola register.api.spec.ts). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola register.api.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/**
 * DayKey 'YYYY-MM-DD' kalender Jakarta untuk `n` hari kalender lalu —
 * geser jam ke WIB dulu (AD-9), baru kurangi hari kalender pada komponen UTC
 * tanggal (hari kalender, bukan 24-jam; paritas `shared/domain/calendar`).
 */
const hariJakartaMinus = (nHari: number): string => {
  const kiniWib = new Date(Date.now() + OFFSET_MENIT_JAKARTA * 60_000)
  kiniWib.setUTCDate(kiniWib.getUTCDate() - nHari)
  return kiniWib.toISOString().slice(0, 10)
}

/**
 * Bentuk wire re-daftar sukses — `status` di-pin literal 'diajukan': echo
 * 'kedaluwarsa' impl lama WAJIB gagal di sini (inti CAP-5). `referral:
 * z.never().optional()` = asersi NYATA tanpa strict-mode (pola
 * register.api.spec.ts).
 */
const SkemaRedaftar = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  status: z.literal('diajukan'),
  referral: z.never().optional(),
})
type Redaftar = z.infer<typeof SkemaRedaftar>

/**
 * Bentuk wire entry audit — disalin dari register.api.spec.ts (duplikasi
 * disengaja agar spec mandiri); entry re-daftar memuat email pendaftar di
 * target/details sehingga terbaca GET /api/audit oleh COO.
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

test.describe('[P0] Re-daftar kedaluwarsa → CAS kedaluwarsa→diajukan baris SAMA (CAP-5, AD-11)', () => {
  test('[P0] POST /api/register pada kedaluwarsa → status diajukan, POST kedua idempotent baris sama', async ({ apiRequest }) => {
    // GAGAL saat red: impl saat ini echo 'kedaluwarsa' tanpa mutasi —
    // validasi SkemaRedaftar (literal 'diajukan') melempar sebelum asersi mana pun.
    await log.step('GIVEN sesi pendaftar berstatus kedaluwarsa (diajukanPada 8 hari kalender Jakarta lalu)')
    const emailPendaftar = emailSintetisUji()
    const cookieKedaluwarsa = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'kedaluwarsa',
      email: emailPendaftar,
      diajukanPada: hariJakartaMinus(HARI_KEDALUWARSA_LALU),
    })
    const headerKedaluwarsa = headerCookieDariMint(cookieKedaluwarsa)

    await log.step('WHEN POST /api/register dengan email yang sama (transisi CAS)')
    const pertama = await apiRequest<Redaftar>({
      method: 'POST',
      path: PATH_REGISTER,
      body: {},
      headers: headerKedaluwarsa,
    }).validateSchema(SkemaRedaftar)

    await log.step('AND POST kedua beruntun (kini diajukan) — idempoten Story 1.4')
    const kedua = await apiRequest<Redaftar>({
      method: 'POST',
      path: PATH_REGISTER,
      body: {},
      headers: headerKedaluwarsa,
    }).validateSchema(SkemaRedaftar)

    await log.step('THEN 200 — baris owner YANG SAMA (id identik), status diajukan')
    expect(pertama.status).toBe(STATUS_OK)
    expect(kedua.status).toBe(STATUS_OK)
    expect(pertama.body.status).toBe('diajukan')
    expect(kedua.body.id).toBe(pertama.body.id)
    expect(kedua.body.email).toBe(pertama.body.email)
  })

  test('[P1] id baris re-daftar non-kosong dan email sesi tergemakan', async ({ apiRequest }) => {
    // GAGAL saat red: skema literal 'diajukan' melempar pada echo 'kedaluwarsa'.
    await log.step('GIVEN sesi pendaftar kedaluwarsa dengan email sintetis')
    const emailPendaftar = emailSintetisUji()
    const cookieSesi = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'kedaluwarsa',
      email: emailPendaftar,
      diajukanPada: hariJakartaMinus(HARI_KEDALUWARSA_LALU),
    })

    await log.step('WHEN POST /api/register dengan cookie sesi itu')
    const { status, body } = await apiRequest<Redaftar>({
      method: 'POST',
      path: PATH_REGISTER,
      body: {},
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaRedaftar)

    await log.step('THEN 200 — id non-kosong, email tergemakan apa adanya')
    expect(status).toBe(STATUS_OK)
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.email).toBe(emailPendaftar)
  })
})

test.describe('[P1] Re-daftar kedaluwarsa tercatat audit (AD-11) — terbaca COO', () => {
  test('[P1] entry audit re-daftar memuat email pendaftar, terbaca via GET /api/audit', async ({ apiRequest }) => {
    // GAGAL saat red: POST tidak pernah mentransisi (echo) sehingga TIDAK ada
    // entry audit re-daftar; GET /api/audit hijau (audit.api.spec.ts) dipakai
    // sebagai kontrak baca.
    await log.step('GIVEN pendaftar kedaluwarsa melakukan re-daftar')
    const emailPendaftar = emailSintetisUji()
    const cookieKedaluwarsa = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'kedaluwarsa',
      email: emailPendaftar,
      diajukanPada: hariJakartaMinus(HARI_KEDALUWARSA_LALU),
    })
    const redaftar = await apiRequest<Redaftar>({
      method: 'POST',
      path: PATH_REGISTER,
      body: {},
      headers: headerCookieDariMint(cookieKedaluwarsa),
    }).validateSchema(SkemaRedaftar)
    expect(redaftar.status).toBe(STATUS_OK)

    await log.step('WHEN COO membaca GET /api/audit')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const { status, body } = await apiRequest<DaftarAudit>({
      method: 'GET',
      path: '/api/audit',
      headers: headerCookieDariMint(cookieCoo),
    }).validateSchema(SkemaDaftarAudit)

    await log.step('THEN 200 — entry audit re-daftar memuat email pendaftar')
    expect(status).toBe(STATUS_OK)
    expect(JSON.stringify(body.data)).toContain(emailPendaftar)
  })
})
