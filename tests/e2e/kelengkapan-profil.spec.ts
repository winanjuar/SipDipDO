/**
 * ATDD RED-PHASE — Story 1.5 "Kelengkapan Profile 11 Field" (E2E UI —
 * CAP-1/2/3/6: halaman Kelengkapan Profile, indikator langkah, gerbang
 * navigasi, toast gagal non-validasi).
 *
 * Tests DIAKTIFKAN pada tugas green-phase yang mengimplementasikan halaman +
 * endpoint-nya. Penyesuaian green-phase (alasan tercatat di Spec Change Log):
 * predikat recurse memakai /profil lengkap/i (kontrak teks indikator saat
 * LENGKAP) — /lengkap/i vakum karena juga mencocokkan H1 "Kelengkapan
 * Profile" dan teks "belum lengkap" indikator pra-simpan (recurse keluar
 * dini sebelum PUT selesai).
 *
 * Penambahan PASCA-REVIEW: tautan "Lengkapi Profile" di /status-pendaftaran
 * (pintu nav tunggal), gerbang calon diajukan LENGKAP (kembali ke landing
 * calon, bukan /profile-completeness), dan submit PARTIAL 400
 * PROFILE_INCOMPLETE (alert verbatim TIDAK tampil, isian dipertahankan).
 *
 * ASUMSI KONTRAK UI (red-phase, nyatakan eksplisit — final saat green-phase):
 * - Route halaman: `/profile-completeness` (belum ditetapkan sumber mana pun;
 *   permukaan #3 EXPERIENCE.md "Kelengkapan Profile").
 * - Endpoint simpan: `/api/profile` (method POST atau PUT — intercept pakai
 *   glob url TANPA method agar tahan keduanya).
 * - 10 field memakai <label> terasosiasi (getByLabel exact — nama Indonesia,
 *   profile-fields.md); Gmail prefilled email sesi dan TIDAK dapat diedit.
 *   Penyesuaian green-phase: matching `exact: true` — substring membuat
 *   getByLabel('Nomor HP')/'Kontak Darurat' ambigu terhadap label wajib
 *   'Nomor HP Kontak Darurat' (strict mode violation).
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
import type { Cookie } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Route halaman Kelengkapan Profile — DIPIN owner 2026-09-18 (`/profile-completeness`;
 *  menggantikan asumsi red-phase `/kelengkapan-profil`). */
const HALAMAN_KELENGKAPAN = '/profile-completeness'

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

/** Status HTTP yang dipakai penambahan pasca-review. */
const STATUS_BAD_REQUEST = 400

/** Cookie[] hasil mint → header Cookie untuk apiRequest (pola
 *  profil.api.spec.ts — apiRequest tidak berbagi cookie-jar browser). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Factory 9 field profil tersimpan sintetis (endpoint langsung PUT
 *  /api/profile — pasca-review; pola profil.api.spec.ts, duplikasi
 *  disengaja agar spec mandiri; Gmail = email sesi, bukan body). */
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

/** Nilai sintetis untuk satu label field (Gmail ditangani khusus — sesi). */
const nilaiSintetisUntuk = (label: string): string => `Uji ${label} ${faker.string.alphanumeric(6)}`

test.describe('E2E Story 1.5 — Kelengkapan Profile (ATDD RED PHASE)', () => {
  test('[P0] halaman Kelengkapan Profile: 10 field, Gmail readonly, indikator menyebut field kosong, tanpa nav lain', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: 404 — halaman belum ada.
    await log.step('GIVEN sesi calon owner berstatus diajukan terinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /profile-completeness')
    await page.goto(HALAMAN_KELENGKAPAN)

    await log.step('THEN 10 field Lampiran A tampil by-label')
    for (const label of LABEL_FIELD_PROFIL) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }

    await log.step('AND Gmail prefilled email sesi dan tidak dapat diedit')
    const gmail = page.getByLabel('Gmail', { exact: true })
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

  test('[P0] isi 10 field & simpan → indikator lengkap; reload → nilai persisten', async ({ page, context, apiRequest, recurse }) => {
    // GAGAL saat red: halaman belum ada; klik simpan pun tidak akan pernah
    // membawa handler.
    await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
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
      const nilai = label === 'Gmail' ? await page.getByLabel('Gmail', { exact: true }).inputValue() : nilaiSintetisUntuk(label)
      nilaiField.set(label, nilai)
      if (label !== 'Gmail') {
        await page.getByLabel(label, { exact: true }).fill(nilai)
      }
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

    await log.step('THEN indikator menyatakan Profil lengkap (prasyarat verifikasi COO terpenuhi)')
    await expect(page.getByText(/profil lengkap/i).first()).toBeVisible()

    await log.step('WHEN halaman dimuat ulang')
    await page.reload()

    await log.step('THEN nilai field pertama & terakhir tersimpan persisten (CAP-1)')
    await expect(page.getByLabel('Nama Lengkap', { exact: true })).toHaveValue(nilaiField.get('Nama Lengkap') ?? '')
    await expect(page.getByLabel('Nomor Rekening', { exact: true })).toHaveValue(nilaiField.get('Nomor Rekening') ?? '')
  })

  test(
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
        await page.getByLabel(label, { exact: true }).fill(nilai)
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
        await expect(page.getByLabel(label, { exact: true })).toHaveValue(nilai)
      }
    },
  )

  test('[P1] URL langsung /dashboard oleh calon belum lengkap → dialihkan di batas server (AD-8)', async ({ page, context, apiRequest }) => {
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

    await log.step('WHEN 8 dari 9 field diisi — Nama Bank sengaja dikosongkan — lalu simpan diklik')
    const isian = new Map<string, string>()
    for (const label of LABEL_FIELD_PROFIL) {
      if (label === 'Gmail' || label === NAMA_FIELD_KOSONG_CONTOH) continue
      const nilai = nilaiSintetisUntuk(label)
      isian.set(label, nilai)
      await page.getByLabel(label, { exact: true }).fill(nilai)
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

    await log.step('AND indikator menyebut field kosong PERSIS (Nama Bank)')
    const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
    await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()

    await log.step('AND seluruh isian DIPERTAHANKAN')
    for (const [label, nilai] of isian) {
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(nilai)
    }
  })
})
