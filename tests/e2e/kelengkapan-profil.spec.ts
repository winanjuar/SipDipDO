/**
 * ATDD — Story 1.5 "Kelengkapan Profile 11 Field" (E2E UI — CAP-1/2/3/6:
 * halaman Kelengkapan Profile, indikator langkah, gerbang navigasi, toast
 * gagal non-validasi).
 *
 * RENEGOSIASI UI OWNER 2026-09-18 (pasca-review manual — alasan tercatat di
 * Spec Change Log spec 1-5): form dikelompokkan per fieldset ber-legend
 * (Pribadi / Info Kontak Darurat / Info Rekening / Referal), input dijabarkan
 * eksplisit dengan LABEL SINGKAT per grup, Email setelah Alias, plus section
 * Referal (kode milik owner readonly + "Referal Dari" disabled — DORMANT
 * sampai Epic 3). Konsekuensi selector: label singkat duplikat antar grup
 * ("Nama", "No HP") → SEMUA locator input di-scope ke fieldset
 * `getByRole('group', { name: <legend> })` sebelum `getByLabel` exact.
 * Indikator langkah TETAP memakai nama field Lampiran A PENUH (UX-DR16
 * "persis"; satu sumber shared/domain/profil) — asersi indikator tak berubah.
 *
 * Penambahan PASCA-REVIEW sebelumnya: tautan "Lengkapi Profile" di
 * /status-pendaftaran (pintu nav tunggal), gerbang calon diajukan LENGKAP,
 * dan submit PARTIAL 400 PROFILE_INCOMPLETE (alert verbatim TIDAK tampil,
 * isian dipertahankan).
 *
 * Kontrak wire: GET/PUT `/api/profile`; PUT body = PERSIS 9 kunci kontrak
 * (field referral TIDAK PERNAH ikut body — dipin via requestJson intercept).
 *
 * Mandate playwright-utils: `test` HANYA dari merged-fixtures; observasi/
 * stub via `interceptNetworkCall` (dideklarasikan SEBELUM page.goto —
 * network-first); klik yang bergantung hidrasi Vue dibungkus `recurse`
 * (pola register.spec.ts); `log.step` bukan console.log; tanpa
 * waitForTimeout; tanpa page.route; `skipNetworkMonitoring` hanya untuk
 * scaffold stub 4xx/5xx.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie, Locator, Page } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Route halaman Kelengkapan Profile — DIPIN owner 2026-09-18. */
const HALAMAN_KELENGKAPAN = '/profile-completeness'

/** Tempo recurse hidrasi Vue di dev server (pola register.spec.ts). */
const INTERVAL_RECURSE_MS = 500
const BATAS_RECURSE_SUBMIT_MS = 30_000

/** Legenda grup form (re-negotiasi owner 2026-09-18). */
const LEGEND_PRIBADI = 'Pribadi'
const LEGEND_KONTAK_DARURAT = 'Info Kontak Darurat'
const LEGEND_REKENING = 'Info Rekening'
const LEGEND_REFERAL = 'Referal'

/**
 * Peta grup → field editable: pasangan [label singkat, kunci kontrak wire].
 * Urutan mengikuti halaman; label duplikat antar grup ("Nama", "No HP")
 * aman karena locator selalu di-scope ke fieldset.
 */
const FIELD_EDITABLE: readonly { legend: string, label: string, kunci: string }[] = [
  { legend: LEGEND_PRIBADI, label: 'Nama', kunci: 'namaLengkap' },
  { legend: LEGEND_PRIBADI, label: 'Alias', kunci: 'alias' },
  { legend: LEGEND_PRIBADI, label: 'No HP', kunci: 'nomorHp' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'Nama', kunci: 'kontakDarurat' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'No HP', kunci: 'nomorHpKontakDarurat' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'Hubungan', kunci: 'hubunganDenganOwner' },
  { legend: LEGEND_REKENING, label: 'Bank', kunci: 'namaBank' },
  { legend: LEGEND_REKENING, label: 'Pemilik', kunci: 'pemilikRekening' },
  { legend: LEGEND_REKENING, label: 'No. Rekening', kunci: 'nomorRekening' },
]

/** 9 kunci kontrak PUT — dipin terurut; field referral TIDAK boleh ikut. */
const KUNCI_KONTRAK_PUT = [
  'alias',
  'hubunganDenganOwner',
  'kontakDarurat',
  'namaBank',
  'namaLengkap',
  'nomorHp',
  'nomorHpKontakDarurat',
  'nomorRekening',
  'pemilikRekening',
] as const

/** Nama field Lampiran A penuh yang dipakai indikator (UX-DR16 persis). */
const NAMA_FIELD_KOSONG_CONTOH = 'Nama Bank'

/** Panjang kode referral owner (paritas PANJANG_KODE_REFERRAL shared/domain). */
const PANJANG_KODE_REFERRAL = 8

/** Toast verbatim UX-DR19. */
const TOAST_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'

/** Status HTTP yang dipakai penambahan pasca-review. */
const STATUS_BAD_REQUEST = 400

/** Cookie[] hasil mint → header Cookie untuk apiRequest (pola
 *  profil.api.spec.ts — apiRequest tidak berbagi cookie-jar browser). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Locator input ter-scope: fieldset (role group ber-legend) → getByLabel exact.
 *  Label singkat duplikat antar grup aman karena scope grup. */
const locatorField = (page: Page, legend: string, label: string): Locator =>
  page.getByRole('group', { name: legend }).getByLabel(label, { exact: true })

/** Factory 9 field profil tersimpan sintetis (endpoint langsung PUT
 *  /api/profile — pasca-review; pola profil.api.spec.ts). */
const profilLengkapUji = (): Record<string, string> => ({
  namaLengkap: faker.person.fullName(),
  alias: faker.person.firstName(),
  nomorHp: '0812' + faker.string.numeric(8),
  kontakDarurat: faker.person.fullName(),
  nomorHpKontakDarurat: '0813' + faker.string.numeric(8),
  hubunganDenganOwner: 'Saudara',
  namaBank: 'Bank Uji Sentral',
  pemilikRekening: faker.person.fullName(),
  nomorRekening: faker.string.numeric(10),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola register.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Nilai sintetis untuk satu field (kunci kontrak — bukan label). */
const nilaiSintetisUntuk = (kunci: string): string => `Uji ${kunci} ${faker.string.alphanumeric(6)}`

test.describe('E2E Story 1.5 — Kelengkapan Profile (ATDD GREEN PHASE)', () => {
  test('[P0] halaman Kelengkapan Profile: 4 grup field, Email readonly, referal tampil, indikator menyebut field kosong, tanpa nav lain', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi calon owner berstatus diajukan terinjeksikan')
    const emailSesi = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSesi,
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /profile-completeness')
    await page.goto(HALAMAN_KELENGKAPAN)

    await log.step('THEN 4 grup fieldset ber-legend tampil (re-negotiasi owner)')
    for (const legend of [LEGEND_PRIBADI, LEGEND_KONTAK_DARURAT, LEGEND_REKENING, LEGEND_REFERAL]) {
      await expect(page.getByRole('group', { name: legend })).toBeVisible()
    }

    await log.step('AND 9 field editable tampil by-label ter-scope grup + Email di grup Pribadi')
    for (const { legend, label } of FIELD_EDITABLE) {
      await expect(locatorField(page, legend, label)).toBeVisible()
    }
    await expect(locatorField(page, LEGEND_PRIBADI, 'Email')).toBeVisible()

    await log.step('AND Email prefilled email sesi dan tidak dapat diedit')
    const emailInput = locatorField(page, LEGEND_PRIBADI, 'Email')
    await expect(emailInput).not.toBeEditable()
    await expect(emailInput).toHaveValue(emailSesi)

    await log.step('AND Kode Referal Saya tampil terisi (readonly) dan Referal Dari disabled')
    const kodeReferal = locatorField(page, LEGEND_REFERAL, 'Kode Referal Saya')
    await expect(kodeReferal).not.toBeEditable()
    expect((await kodeReferal.inputValue()).length).toBe(PANJANG_KODE_REFERRAL)
    await expect(locatorField(page, LEGEND_REFERAL, 'Referal Dari')).toBeDisabled()

    await log.step('AND indikator langkah menyebut PERSIS field yang belum diisi (nama Lampiran A penuh)')
    const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
    await expect(indikator).toBeVisible()
    await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()
    await expect(indikator.getByText('Nomor Rekening')).toBeVisible()

    await log.step('AND TANPA navigasi lain (UX-DR14 — hanya Kelengkapan Profile + status)')
    await expect(page.getByRole('link', { name: /dashboard/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /antrian/i })).toHaveCount(0)
  })

  test('[P0] isi seluruh field & simpan → body PUT persis 9 kunci, indikator lengkap; reload → nilai persisten', async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
    await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    // Observe PUT (network-first, sebelum goto) — body wajib PERSIS 9 kunci
    // kontrak; field referral tampilan tidak pernah ikut terkirim.
    const simpanCall = interceptNetworkCall({ url: '**/api/profile', method: 'PUT' })

    await page.goto(HALAMAN_KELENGKAPAN)

    await log.step('WHEN seluruh 9 field editable diisi nilai sintetis dan tombol simpan diklik')
    const nilaiField = new Map<string, string>()
    for (const { legend, label, kunci } of FIELD_EDITABLE) {
      const nilai = nilaiSintetisUntuk(kunci)
      nilaiField.set(kunci, nilai)
      await locatorField(page, legend, label).fill(nilai)
    }
    await recurse(
      async () => {
        try {
          await page.getByRole('button', { name: /simpan/i }).click()
        } catch {
          // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
        }
        return page.getByText(/profil lengkap/i).first().isVisible()
      },
      lengkap => lengkap === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu simpan profil + indikator lengkap' },
    )

    await log.step('THEN body PUT persis 9 kunci kontrak (tanpa field referral/Email)')
    const { requestJson } = await simpanCall
    expect(Object.keys(requestJson as Record<string, unknown>).sort()).toEqual([...KUNCI_KONTRAK_PUT])

    await log.step('AND indikator menyatakan Profil lengkap (prasyarat verifikasi COO terpenuhi)')
    await expect(page.getByText(/profil lengkap/i).first()).toBeVisible()

    await log.step('WHEN halaman dimuat ulang')
    await page.reload()

    await log.step('THEN nilai field pertama & terakhir tersimpan persisten (CAP-1)')
    await expect(locatorField(page, LEGEND_PRIBADI, 'Nama')).toHaveValue(nilaiField.get('namaLengkap') ?? '')
    await expect(locatorField(page, LEGEND_REKENING, 'No. Rekening')).toHaveValue(nilaiField.get('nomorRekening') ?? '')
  })

  test(
    '[P1] submit gagal non-validasi (5xx): isian dipertahankan + toast verbatim UX-DR19',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
      // skipNetworkMonitoring: stub 500 disengaja untuk mensimulasikan
      // gangguan non-validasi — bukan bug jaringan.
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
      const isian: readonly { legend: string, label: string, nilai: string }[] = [
        { legend: LEGEND_PRIBADI, label: 'Nama', nilai: nilaiSintetisUntuk('namaLengkap') },
        { legend: LEGEND_PRIBADI, label: 'Alias', nilai: nilaiSintetisUntuk('alias') },
        { legend: LEGEND_PRIBADI, label: 'No HP', nilai: nilaiSintetisUntuk('nomorHp') },
      ]
      for (const { legend, label, nilai } of isian) {
        await locatorField(page, legend, label).fill(nilai)
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
      for (const { legend, label, nilai } of isian) {
        await expect(locatorField(page, legend, label)).toHaveValue(nilai)
      }
    },
  )

  test('[P1] URL langsung /dashboard oleh calon belum lengkap → dialihkan di batas server (AD-8)', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi calon owner berstatus diajukan (Profile belum lengkap)')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN TIDAK berada di /dashboard — redirect terjadi di batas server ke /profile-completeness')
    await expect(page).toHaveURL(/\/profile-completeness$/)
  })

  test('[P1] non-calon membuka /profile-completeness → dialihkan ke landing role-nya (pola status-pendaftaran)', async ({ page, context, apiRequest }) => {
    // Penutup baris matriks I/O "Halaman kelengkapan non-calon": resolver
    // halaman mengarahkan non-calon ke LANDING_PATH role-nya (pola
    // status-pendaftaran.vue); middleware TIDAK menghalangi non-calon.
    await log.step('GIVEN sesi pemegang saham (bukan calon) terinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /profile-completeness secara langsung')
    await page.goto('/profile-completeness')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] tautan "Lengkapi Profile" di /status-pendaftaran → menuju /profile-completeness (pasca-review)', async ({ page, context, apiRequest }) => {
    // Satu-satunya pintu nav fitur (UX-DR14): calon diajukan belum lengkap
    // melihat tautan di halaman status; klik mengantar ke halaman kelengkapan.
    await log.step('GIVEN sesi calon owner diajukan dengan Profil belum lengkap')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /status-pendaftaran lalu mengeklik "Lengkapi Profile"')
    await page.goto('/status-pendaftaran')
    const tautan = page.getByRole('link', { name: 'Lengkapi Profile' })
    await expect(tautan).toBeVisible()
    await tautan.click()

    await log.step('THEN berpindah ke /profile-completeness')
    await expect(page).toHaveURL(/\/profile-completeness$/)
  })

  test('[P1] calon diajukan dengan Profil LENGKAP lolos gerbang → kembali ke landing calon /status-pendaftaran (pasca-review)', async ({ page, context, apiRequest }) => {
    // Gerbang kelengkapan HANYA untuk belum lengkap: calon lengkap dialihkan
    // ke landing calonnya (UX-DR14), BUKAN ke /profile-completeness.
    await log.step('GIVEN sesi calon owner diajukan yang menyimpan profil lengkap via endpoint langsung')
    const emailCalon = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailCalon,
    })
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: profilLengkapUji(),
      headers: headerCookieDariMint(cookies),
    })
    expect(simpan.status).toBe(200)

    await log.step('AND sesi yang sama di-mint ulang (baris sama — profil tetap tersimpan)')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailCalon,
    }))

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN dialihkan ke /status-pendaftaran (landing calon), BUKAN /profile-completeness')
    await expect(page).toHaveURL(/\/status-pendaftaran$/)
    await expect(page).not.toHaveURL(/profile-completeness/)
  })

  test(
    '[P1] submit PARTIAL (400): alert gagal TIDAK tampil, indikator menyebut field kosong, isian dipertahankan (pasca-review)',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
      // skipNetworkMonitoring: PUT 400 disengaja (cabang validasi kelengkapan
      // adalah kontrak yang sedang dipin) — bukan bug jaringan.
      // Cabang 400 PROFILE_INCOMPLETE di-pin: halaman TIDAK menampilkan alert
      // verbatim (itu khusus gagal non-validasi), indikator tetap menunjuk
      // field kosong, dan seluruh isian dipertahankan.
      await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness (tanpa stub)')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)

      await log.step('AND PUT /api/profile dipantau (observe — request tetap ke server)')
      let statusSimpan = 0
      const terpantau = interceptNetworkCall({ url: '**/api/profile' }).then(
        (hasil: { status: number }) => {
          statusSimpan = hasil.status
          return true
        },
        () => false,
      )

      await page.goto(HALAMAN_KELENGKAPAN)

      await log.step('WHEN 8 dari 9 field diisi — Bank sengaja dikosongkan — lalu simpan diklik')
      const isian: { legend: string, label: string, nilai: string }[] = []
      for (const { legend, label, kunci } of FIELD_EDITABLE) {
        if (kunci === 'namaBank') continue
        const nilai = nilaiSintetisUntuk(kunci)
        isian.push({ legend, label, nilai })
        await locatorField(page, legend, label).fill(nilai)
      }
      await recurse(
        async () => {
          try {
            await page.getByRole('button', { name: /simpan/i }).click()
          } catch {
            // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
          }
          return Promise.race([terpantau, Promise.resolve(false)])
        },
        terkirim => terkirim === true,
        { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu PUT profil terpantau' },
      )

      await log.step('THEN server menjawab 400 (validasi kelengkapan) dan alert verbatim TIDAK tampil')
      expect(statusSimpan).toBe(STATUS_BAD_REQUEST)
      await expect(page.getByText(TOAST_GAGAL_SIMPAN)).toHaveCount(0)

      await log.step('AND indikator menyebut field kosong PERSIS (nama Lampiran A penuh: Nama Bank)')
      const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
      await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()

      await log.step('AND seluruh isian DIPERTAHANKAN')
      for (const { legend, label, nilai } of isian) {
        await expect(locatorField(page, legend, label)).toHaveValue(nilai)
      }
    },
  )
})
