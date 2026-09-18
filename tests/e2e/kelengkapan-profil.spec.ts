/**
 * ATDD RED-PHASE — Story 1.5 "Kelengkapan Profile 11 Field" (E2E UI —
 * CAP-1/2/3/6: halaman Kelengkapan Profile, indikator langkah, gerbang
 * navigasi, toast gagal non-validasi).
 *
 * SEMUA test `test.skip()` — scaffold TDD red phase; hapus skip HANYA pada
 * tugas green-phase yang mengimplementasikan halaman + endpoint-nya.
 *
 * ASUMSI KONTRAK UI (red-phase, nyatakan eksplisit — final saat green-phase):
 * - Route halaman: `/kelengkapan-profil` (belum ditetapkan sumber mana pun;
 *   permukaan #3 EXPERIENCE.md "Kelengkapan Profile").
 * - Endpoint simpan: `/api/profile` (method POST atau PUT — intercept pakai
 *   glob url TANPA method agar tahan keduanya).
 * - 10 field memakai <label> terasosiasi (getByLabel, nama Indonesia —
 *   profile-fields.md); Gmail prefilled email sesi dan TIDAK dapat diedit.
 * - Indikator langkah (UX-DR16) hidup di region `data-testid=
 *   kelengkapan-indikator` (kontrak TEST_IDS baru — fixture_needs); dia
 *   menyebut PERSIS field yang belum lengkap per nama fieldnya.
 * - Toast gagal non-validasi verbatim: "Tidak dapat menyimpan — coba lagi."
 *   (UX-DR19); isian dipertahankan.
 *
 * GAGAL SAAT RED: halaman belum ada (404) dan endpoint belum ada — semua
 * asersi gagal sebelum fitur ada.
 *
 * Mandate playwright-utils: `test` HANYA dari merged-fixtures; observasi/
 * stub via `interceptNetworkCall` (dideklarasikan SEBELUM page.goto —
 * network-first); klik yang bergantung hidrasi Vue dibungkus `recurse`
 * (pola register.spec.ts — dev server menghidrasi belakangan); `log.step`
 * bukan console.log; tanpa waitForTimeout; tanpa page.route;
 * `skipNetworkMonitoring` hanya untuk scaffold stub 5xx.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Route halaman Kelengkapan Profile — ASUMSI red-phase (lihat header). */
const HALAMAN_KELENGKAPAN = '/kelengkapan-profil'

/** Tempo recurse hidrasi Vue di dev server (pola register.spec.ts). */
const INTERVAL_RECURSE_MS = 500
const BATAS_RECURSE_SUBMIT_MS = 30_000

/** Daftar 10 field Lampiran A #1-10 — label form Indonesia (profile-fields.md);
 *  Gmail = field #3 (prefilled sesi, readonly). */
const LABEL_FIELD_PROFIL = [
  'Nama Lengkap',
  'Alias',
  'Gmail',
  'Nomor HP',
  'Kontak Darurat',
  'Nomor HP Kontak Darurat',
  'Hubungan dengan Owner',
  'Nama Bank',
  'Pemilik Rekening',
  'Nomor Rekening',
] as const

const NAMA_FIELD_KOSONG_CONTOH = 'Nama Bank'

/** Toast verbatim UX-DR19. */
const TOAST_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola register.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Nilai sintetis untuk satu label field (Gmail ditangani khusus — sesi). */
const nilaiSintetisUntuk = (label: string): string => `Uji ${label} ${faker.string.alphanumeric(6)}`

test.describe('E2E Story 1.5 — Kelengkapan Profile (ATDD RED PHASE)', () => {
  test.skip('[P0] halaman Kelengkapan Profile: 10 field, Gmail readonly, indikator menyebut field kosong, tanpa nav lain', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: 404 — halaman belum ada.
    await log.step('GIVEN sesi calon owner berstatus diajukan terinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /kelengkapan-profil')
    await page.goto(HALAMAN_KELENGKAPAN)

    await log.step('THEN 10 field Lampiran A tampil by-label')
    for (const label of LABEL_FIELD_PROFIL) {
      await expect(page.getByLabel(label)).toBeVisible()
    }

    await log.step('AND Gmail prefilled email sesi dan tidak dapat diedit')
    const gmail = page.getByLabel('Gmail')
    await expect(gmail).not.toBeEditable()

    await log.step('AND indikator langkah menyebut PERSIS field yang belum diisi (semua masih kosong)')
    const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
    await expect(indikator).toBeVisible()
    await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()
    await expect(indikator.getByText('Nomor Rekening')).toBeVisible()

    await log.step('AND TANPA navigasi lain (UX-DR14 — hanya Kelengkapan Profile + status)')
    await expect(page.getByRole('link', { name: /dashboard/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /antrian/i })).toHaveCount(0)
  })

  test.skip('[P0] isi 10 field & simpan → indikator lengkap; reload → nilai persisten', async ({ page, context, apiRequest, recurse }) => {
    // GAGAL saat red: halaman belum ada; klik simpan pun tidak akan pernah
    // membawa handler.
    await log.step('GIVEN sesi calon owner diajukan membuka /kelengkapan-profil')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)
    await page.goto(HALAMAN_KELENGKAPAN)

    await log.step('WHEN seluruh 10 field diisi nilai sintetis dan tombol simpan diklik')
    const nilaiField = new Map<string, string>()
    for (const label of LABEL_FIELD_PROFIL) {
      const nilai = label === 'Gmail' ? await page.getByLabel('Gmail').inputValue() : nilaiSintetisUntuk(label)
      nilaiField.set(label, nilai)
      if (label !== 'Gmail') {
        await page.getByLabel(label).fill(nilai)
      }
    }
    await recurse(
      async () => {
        try {
          await page.getByRole('button', { name: /simpan/i }).click()
        } catch {
          // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
        }
        return page.getByText(/lengkap/i).first().isVisible()
      },
      lengkap => lengkap === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu simpan profil + indikator lengkap' },
    )

    await log.step('THEN indikator menyatakan Profil lengkap (prasyarat verifikasi COO terpenuhi)')
    await expect(page.getByText(/lengkap/i).first()).toBeVisible()

    await log.step('WHEN halaman dimuat ulang')
    await page.reload()

    await log.step('THEN nilai field pertama & terakhir tersimpan persisten (CAP-1)')
    await expect(page.getByLabel('Nama Lengkap')).toHaveValue(nilaiField.get('Nama Lengkap') ?? '')
    await expect(page.getByLabel('Nomor Rekening')).toHaveValue(nilaiField.get('Nomor Rekening') ?? '')
  })

  test.skip(
    '[P1] submit gagal non-validasi (5xx): isian dipertahankan + toast verbatim UX-DR19',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
      // skipNetworkMonitoring: stub 500 disengaja untuk mensimulasikan
      // gangguan non-validasi — bukan bug jaringan. GAGAL saat red: halaman
      // belum ada sehingga intercept tak pernah terpicu.
      await log.step('GIVEN sesi calon owner diajukan; endpoint profil DI-STUB 500 (gangguan non-validasi)')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)

      // Intercept dideklarasikan SEBELUM goto (network-first); glob url
      // tanpa method — tahan kontrak POST maupun PUT (asumsi header file).
      const simpanGagal = interceptNetworkCall({
        url: '**/api/profile',
        fulfillResponse: { status: 500, body: { code: 'INTERNAL', message: 'Internal Server Error', details: {} } },
      })

      await page.goto(HALAMAN_KELENGKAPAN)

      await log.step('WHEN 3 field diisi lalu tombol simpan diklik (dibungkus recurse hidrasi)')
      const isian = new Map<string, string>([
        ['Nama Lengkap', nilaiSintetisUntuk('Nama Lengkap')],
        ['Alias', nilaiSintetisUntuk('Alias')],
        ['Nomor HP', nilaiSintetisUntuk('Nomor HP')],
      ])
      for (const [label, nilai] of isian) {
        await page.getByLabel(label).fill(nilai)
      }
      await recurse(
        async () => {
          try {
            await page.getByRole('button', { name: /simpan/i }).click()
          } catch {
            // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
          }
          return page.getByText(TOAST_GAGAL_SIMPAN).isVisible()
        },
        toastTampil => toastTampil === true,
        { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu toast gagal simpan' },
      )
      await simpanGagal

      await log.step('THEN toast verbatim "Tidak dapat menyimpan — coba lagi." tampil')
      await expect(page.getByText(TOAST_GAGAL_SIMPAN)).toBeVisible()

      await log.step('AND seluruh isian DIPERTAHANKAN — tanpa pengisian ulang dari nol')
      for (const [label, nilai] of isian) {
        await expect(page.getByLabel(label)).toHaveValue(nilai)
      }
    },
  )

  test.skip('[P1] URL langsung /dashboard oleh calon belum lengkap → dialihkan di batas server (AD-8)', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: gerbang redirect calon belum lengkap belum
    // diimplementasikan — /dashboard masih terjangkau untuk sesi diajukan.
    await log.step('GIVEN sesi calon owner berstatus diajukan (Profile belum lengkap)')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN TIDAK berada di /dashboard — redirect terjadi (kontrak green-phase: ke /kelengkapan-profil atau /status-pendaftaran; pertegas URL eksplisit saat green)')
    await expect(page).not.toHaveURL(/\/dashboard/)
  })
})
