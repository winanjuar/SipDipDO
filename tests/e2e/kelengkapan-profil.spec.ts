/**
 * ATDD — Story 1.5 "Kelengkapan Profile 11 Field" (E2E UI — CAP-1/2/3/6:
 * validasi/sanitasi form — re-negotiasi owner 2026-09-18: batas panjang
 * (nama 25/alias 10/rekening 20), HP 0+9-15 digit, dropdown Bank (7+
 * "Lainnya" membuka textbox otherBankName) & Hubungan, prefill Nama dari profil
 * Google bila kosong, error format inline per-field dari 400
 * PROFILE_INVALID).
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
 * /registration-status (pintu nav tunggal), gerbang calon diajukan LENGKAP,
 * dan submit PARTIAL sukses 200 (re-negotiasi owner 2026-09-19 — field
 * kosong tidak lagi menolak simpan; zona Sistem tetap menyebut sisa,
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
const LEGEND_PRIBADI = 'Profil Pemilik'
const LEGEND_KONTAK_DARURAT = 'Info Kontak Darurat'
const LEGEND_REKENING = 'Info Rekening'
const LEGEND_REFERAL = 'Referal'

/**
 * Peta grup → field editable: pasangan [label singkat, kunci kontrak wire,
 * jenis kontrol]. Bank & Hubungan = dropdown (re-negotiasi owner); label
 * duplikat antar grup ("Nama", "No HP") aman karena locator selalu di-scope
 * ke fieldset. `otherBankName` absen — textbox kondisional hanya muncul saat Bank
 * "Lainnya" (dipin test alur khusus).
 */
const FIELD_EDITABLE: readonly { legend: string, label: string, kunci: string, jenis: 'input' | 'select' }[] = [
  { legend: LEGEND_PRIBADI, label: 'Nama Lengkap', kunci: 'fullName', jenis: 'input' },
  { legend: LEGEND_PRIBADI, label: 'Nama Panggilan atau Alias', kunci: 'alias', jenis: 'input' },
  { legend: LEGEND_PRIBADI, label: 'No HP', kunci: 'phoneNumber', jenis: 'input' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'Nama', kunci: 'emergencyContactName', jenis: 'input' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'No HP', kunci: 'emergencyContactPhoneNumber', jenis: 'input' },
  { legend: LEGEND_KONTAK_DARURAT, label: 'Hubungan', kunci: 'emergencyContactRelationship', jenis: 'select' },
  { legend: LEGEND_REKENING, label: 'Bank', kunci: 'bankName', jenis: 'select' },
  { legend: LEGEND_REKENING, label: 'Nama', kunci: 'accountHolderName', jenis: 'input' },
  { legend: LEGEND_REKENING, label: 'No. Rekening', kunci: 'accountNumber', jenis: 'input' },
]

/** Nilai sah default untuk field dropdown (enum shared/domain/profil). */
const BANK_UJI = 'BCA'
const HUBUNGAN_UJI = 'Saudara'

/** 10 kunci kontrak PUT — dipin terurut; field referral TIDAK boleh ikut. */
const KUNCI_KONTRAK_PUT = [
  'accountHolderName',
  'accountNumber',
  'alias',
  'bankName',
  'emergencyContactName',
  'emergencyContactPhoneNumber',
  'emergencyContactRelationship',
  'fullName',
  'otherBankName',
  'phoneNumber',
] as const

/** Nama tetap token sesi mint — sumber prefill Google field Nama. */
const NAMA_SESI_MINT = 'Pemilik Uji Sintetis'

/** Batas panjang client-side (paritas PANJANG_MAKS_NAMA shared/domain/profil). */
const PANJANG_MAKS_NAMA_UJI = 25

/** Pesan inline kode digit-hp (verbatim halaman — karakter sah namun jumlah
 *  digit/prefix salah; permintaan owner 2026-09-19: info validasi relevan). */
const PESAN_DIGIT_HP = 'Nomor HP harus 9-15 digit dan dimulai angka 0.'

/** Batas recurse test format-HP: cold-start compile Vite webkit pada eksekusi
 *  pertama file bisa melebihi 30s standar (flaky teramati 2026-09-18). */
const BATAS_RECURSE_FORMAT_MS = 45_000

/** Nama field Lampiran A penuh yang dipakai indikator (UX-DR16 persis). */
const NAMA_FIELD_KOSONG_CONTOH = 'Nama Bank'

/** Panjang kode referral owner (paritas PANJANG_KODE_REFERRAL shared/domain). */
const PANJANG_KODE_REFERRAL = 8

/** Toast verbatim UX-DR19. */
const TOAST_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'

/** Status HTTP yang dipakai penambahan pasca-review. */
const STATUS_OK = 200

/** Cookie[] hasil mint → header Cookie untuk apiRequest (pola
 *  profil.api.spec.ts — apiRequest tidak berbagi cookie-jar browser). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Locator input ter-scope: fieldset (role group ber-legend) → getByLabel exact.
 *  Label singkat duplikat antar grup aman karena scope grup. */
const locatorField = (page: Page, legend: string, label: string): Locator =>
  page.getByRole('group', { name: legend }).getByLabel(label, { exact: true })

/** Tanda tangan minimal fixture recurse (playwright-utils) untuk helper. */
type RecurseSesi = <T>(
  fn: () => Promise<T>,
  predikat: (nilai: T) => boolean,
  opts?: { timeout?: number, interval?: number, log?: string },
) => Promise<T>

/**
 * Tunggu hidrasi Vue selesai (tombol Simpan membawa data-terhidrasi="true")
 * sebelum interaksi apa pun — select v-model di-reset oleh hidrasi dari
 * state SSR (debug 2026-09-18), sehingga selectOption pra-hidrasi bisa
 * lenyap diam-diam; input teks kebetulan selamat.
 */
async function tungguHidrasi(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Simpan' })).toHaveAttribute('data-terhidrasi', 'true')
}

/**
 * Isi satu field ter-scope. Input teks memakai fill; SELECT kini komponen
 * shadcn (reka-ui: trigger button + listbox, re-negotiasi owner #5) — pilih
 * lewat klik trigger lalu klik opsi by-role, dibungkus recurse verifikasi
 * teks trigger (nilai pra-hidrasi bisa ter-reset oleh hidrasi; pola lama
 * selectOption tidak berlaku untuk komponen non-native).
 *
 * Field Pemilik Rekening (label "Nama" di Info Rekening) default TERKUNCI
 * oleh saklar "sama dengan pemilik" (permintaan owner 2026-09-19) — saklar
 * dimatikan dulu bila masih ON agar fill() tidak menabrak input disabled.
 */
async function isiField(recurse: RecurseSesi, page: Page, legend: string, label: string, jenis: 'input' | 'select', nilai: string): Promise<void> {
  const lokasi = locatorField(page, legend, label)
  if (jenis === 'select') {
    await recurse(
      async () => {
        try {
          await lokasi.click()
          await page.getByRole('option', { name: nilai, exact: true }).click()
        } catch {
          // Pra-hidrasi/dropdown belum terbuka — dievaluasi ulang iterasi berikutnya.
        }
        return ((await lokasi.textContent()) ?? '').trim() === nilai
      },
      menempel => menempel === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: `Menunggu pilihan ${label} menempel pasca-hidrasi` },
    )
  } else {
    if (legend === LEGEND_REKENING && label === 'Nama') {
      const saklar = page.getByTestId(TEST_IDS.kelengkapanProfil.saklarPemilik)
      if ((await saklar.getAttribute('aria-checked')) === 'true') await saklar.click()
    }
    await lokasi.fill(nilai)
  }
}

/** Factory 9 field profil tersimpan sintetis (endpoint langsung PUT
 *  /api/profile — pasca-review; pola profil.api.spec.ts). */
const profilLengkapUji = (): Record<string, string> => ({
  // Nilai patuh batas validasi (nama <=25, alias <=5, enum sah).
  fullName: `Uji ${faker.string.alphanumeric(6)}`,
  alias: faker.string.alphanumeric({ length: 5, casing: 'lower' }),
  phoneNumber: '0812' + faker.string.numeric(8),
  emergencyContactName: `Uji ${faker.string.alphanumeric(6)}`,
  emergencyContactPhoneNumber: '0813' + faker.string.numeric(8),
  emergencyContactRelationship: HUBUNGAN_UJI,
  bankName: BANK_UJI,
  otherBankName: '',
  accountHolderName: `Uji ${faker.string.alphanumeric(6)}`,
  accountNumber: faker.string.numeric(10),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola register.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/**
 * Nilai sintetis PATUH aturan field (re-negotiasi owner 2026-09-18): nomor
 * HP/rekening hanya digit (awalan 0 untuk HP), alias <=10, nama bebas <=25 —
 * supaya tidak terpotong maxlength client-side saat fill.
 */
const nilaiSintetisUntuk = (kunci: string): string => {
  if (kunci === 'phoneNumber') return '0812' + faker.string.numeric(8)
  if (kunci === 'emergencyContactPhoneNumber') return '0813' + faker.string.numeric(8)
  if (kunci === 'accountNumber') return faker.string.numeric(10)
  if (kunci === 'alias') return faker.string.alphanumeric({ length: 6, casing: 'lower' })
  return `Uji ${kunci.slice(0, 8)} ${faker.string.alphanumeric(4)}`
}

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
    await tungguHidrasi(page)

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

    await log.step('AND zona Sistem berlegend "Kelengkapan Data di Sistem" + tinta token semantik primary (UX-DR2 — bukan warna raw)')
    const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
    await expect(indikator).toContainText('Kelengkapan Data di Sistem')
    await expect(indikator).toHaveClass(/border-primary\/40/)
    await expect(indikator).toHaveClass(/bg-primary\/10/)

    await log.step('AND indikator langkah menyebut PERSIS field yang belum diisi (nama Lampiran A penuh)')
    await expect(indikator).toBeVisible()
    await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()
    await expect(indikator.getByText('Nomor Rekening')).toBeVisible()

    await log.step('AND Nama ter-prefill dari profil Google sesi (kolom masih kosong) — tetap editable')
    const namaAwal = locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap')
    await expect(namaAwal).toHaveValue(NAMA_SESI_MINT)
    await expect(namaAwal).toBeEditable()

    await log.step('AND maxlength client-side memotong isian Nama pada 25 karakter')
    await namaAwal.fill('A'.repeat(PANJANG_MAKS_NAMA_UJI + 5))
    expect((await namaAwal.inputValue()).length).toBe(PANJANG_MAKS_NAMA_UJI)

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
    await tungguHidrasi(page)

    await log.step('WHEN seluruh field editable diisi (input diisi nilai sintetis; dropdown memilih enum sah) lalu tombol simpan diklik')
    const nilaiField = new Map<string, string>()
    for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
      const nilai = kunci === 'bankName' ? BANK_UJI : kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
      nilaiField.set(kunci, nilai)
      await isiField(recurse, page, legend, label, jenis, nilai)
    }
    await recurse(
      async () => {
        try {
          await page.getByRole('button', { name: /simpan/i }).click()
        } catch {
          // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
        }
        return page.getByText(/profile lengkap/i).first().isVisible()
      },
      lengkap => lengkap === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu simpan profil + indikator lengkap' },
    )

    await log.step('THEN body PUT persis 10 kunci kontrak (termasuk otherBankName kosong; tanpa field referral/Email)')
    const { requestJson } = await simpanCall
    expect(Object.keys(requestJson as Record<string, unknown>).sort()).toEqual([...KUNCI_KONTRAK_PUT])

    await log.step('AND alert sukses "Profil tersimpan." tampil di atas halaman (auto-hilang 3 detik — pola alert atas)')
    await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.alertSukses)).toContainText('Profil tersimpan.')

    await log.step('AND indikator menyatakan Profil lengkap (prasyarat verifikasi COO terpenuhi)')
    await expect(page.getByText(/profile lengkap/i).first()).toBeVisible()

    await log.step('WHEN halaman dimuat ulang')
    await page.reload()

    await log.step('THEN nilai field pertama & terakhir tersimpan persisten (CAP-1)')
    await expect(locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap')).toHaveValue(nilaiField.get('fullName') ?? '')
    await expect(locatorField(page, LEGEND_REKENING, 'No. Rekening')).toHaveValue(nilaiField.get('accountNumber') ?? '')
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
      await tungguHidrasi(page)

      await log.step('WHEN 3 field diisi lalu tombol simpan diklik (dibungkus recurse hidrasi)')
      const isian: readonly { legend: string, label: string, nilai: string }[] = [
        { legend: LEGEND_PRIBADI, label: 'Nama Lengkap', nilai: nilaiSintetisUntuk('fullName') },
        { legend: LEGEND_PRIBADI, label: 'Nama Panggilan atau Alias', nilai: nilaiSintetisUntuk('alias') },
        { legend: LEGEND_PRIBADI, label: 'No HP', nilai: nilaiSintetisUntuk('phoneNumber') },
      ]
      for (const { legend, label, nilai } of isian) {
        await isiField(recurse, page, legend, label, 'input', nilai)
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

  test('[P1] non-calon membuka /profile-completeness → dialihkan ke landing role-nya (pola registration-status)', async ({ page, context, apiRequest }) => {
    // Penutup baris matriks I/O "Halaman kelengkapan non-calon": resolver
    // halaman mengarahkan non-calon ke LANDING_PATH role-nya (pola
    // registration-status.vue); middleware TIDAK menghalangi non-calon.
    await log.step('GIVEN sesi pemegang saham (bukan calon) terinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /profile-completeness secara langsung')
    await page.goto('/profile-completeness')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] tautan "Lengkapi Profile" di /registration-status → menuju /profile-completeness (pasca-review)', async ({ page, context, apiRequest }) => {
    // Satu-satunya pintu nav fitur (UX-DR14): calon diajukan belum lengkap
    // melihat tautan di halaman status; klik mengantar ke halaman kelengkapan.
    await log.step('GIVEN sesi calon owner diajukan dengan Profil belum lengkap')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /registration-status lalu mengeklik "Lengkapi Profile"')
    await page.goto('/registration-status')
    const tautan = page.getByRole('link', { name: 'Lengkapi Profile' })
    await expect(tautan).toBeVisible()
    await tautan.click()

    await log.step('THEN berpindah ke /profile-completeness')
    await expect(page).toHaveURL(/\/profile-completeness$/)
  })

  test('[P1] calon diajukan dengan Profil LENGKAP lolos gerbang → kembali ke landing calon /registration-status (pasca-review)', async ({ page, context, apiRequest }) => {
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
    expect(simpan.status).toBe(STATUS_OK)

    await log.step('AND sesi yang sama di-mint ulang (baris sama — profil tetap tersimpan)')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailCalon,
    }))

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN dialihkan ke /registration-status (landing calon), BUKAN /profile-completeness')
    await expect(page).toHaveURL(/\/registration-status$/)
    await expect(page).not.toHaveURL(/profile-completeness/)
  })

  test(
    '[P1] submit PARSIAL sukses (re-negotiasi owner 2026-09-19): alert sukses, zona Sistem tetap menyebut field kosong, isian persisten',
    async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
      // Simpan parsial: field kosong TIDAK lagi menolak simpan — 200 dengan
      // remainingFields; zona Sistem (server-truth) tetap menyebut sisa.
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
      await tungguHidrasi(page)

      await log.step('WHEN seluruh field diisi kecuali Bank (placeholder) — lalu simpan diklik')
      const isian: { legend: string, label: string, jenis: 'input' | 'select', nilai: string }[] = []
      for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
        if (kunci === 'bankName') continue
        const nilai = kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
        isian.push({ legend, label, jenis, nilai })
        await isiField(recurse, page, legend, label, jenis, nilai)
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

      await log.step('THEN server menjawab 200 (simpan parsial) + alert sukses, TANPA toast gagal')
      expect(statusSimpan).toBe(STATUS_OK)
      await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.alertSukses)).toContainText('Profil tersimpan.')
      await expect(page.getByText(TOAST_GAGAL_SIMPAN)).toHaveCount(0)

      await log.step('AND zona Sistem tetap menyebut field kosong PERSIS (nama Lampiran A penuh: Nama Bank)')
      const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
      await expect(indikator.getByText(NAMA_FIELD_KOSONG_CONTOH)).toBeVisible()

      await log.step('AND zona Isian form TERSEMBUNYI (form = data tersimpan, tak ada perubahan)')
      await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)).toHaveCount(0)

      await log.step('AND seluruh isian DIPERTAHANKAN')
      for (const { legend, label, jenis, nilai } of isian) {
        const lokasi = locatorField(page, legend, label)
        if (jenis === 'select') {
          await expect(lokasi).toContainText(nilai)
        } else {
          await expect(lokasi).toHaveValue(nilai)
        }
      }
    },
  )

  test(
    '[P1] HP digit kurang (400 PROFILE_INVALID kode digit-hp): error inline per-field relevan, alert generik TIDAK tampil, isian dipertahankan',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse }) => {
      // skipNetworkMonitoring: PUT 400 disengaja (cabang validasi FORMAT
      // dipin — re-negotiasi owner 2026-09-18) — bukan bug jaringan.
      await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)
      await page.goto(HALAMAN_KELENGKAPAN)
      await tungguHidrasi(page)

      await log.step('WHEN seluruh field diisi valid KECUALI No HP berisi huruf (ditolak penapis masukan → tersisa digit/"-"), lalu simpan diklik')
      const nilaiSesuai = new Map<string, string>()
      for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
        // Penapis masukan nomor: huruf di '08-ABC-9999' ditolak langsung —
        // tersisa '08--9999' (karakter sah, digit < 9 → server menjawab
        // kode digit-hp — pesan validasi relevan, bukan "hanya angka").
        const nilai = kunci === 'phoneNumber'
          ? '08--9999'
          : kunci === 'bankName' ? BANK_UJI : kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
        nilaiSesuai.set(kunci, nilai)
        await isiField(recurse, page, legend, label, jenis, kunci === 'phoneNumber' ? '08-ABC-9999' : nilai)
      }
      await recurse(
        async () => {
          try {
            await page.getByRole('button', { name: /simpan/i }).click()
          } catch {
            // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
          }
          return page.getByText(PESAN_DIGIT_HP).isVisible()
        },
        tampil => tampil === true,
        { timeout: BATAS_RECURSE_FORMAT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu error inline digit No HP' },
      )

      await log.step('THEN pesan inline digit-hp tampil DI BAWAH No HP (scoped grup Profil Pemilik)')
      await expect(page.getByRole('group', { name: LEGEND_PRIBADI }).getByText(PESAN_DIGIT_HP)).toBeVisible()

      await log.step('AND alert generik gagal-simpan TIDAK tampil (khusus non-validasi)')
      await expect(page.getByText(TOAST_GAGAL_SIMPAN)).toHaveCount(0)

      await log.step('AND seluruh isian dipertahankan')
      for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
        const lokasi = locatorField(page, legend, label)
        if (jenis === 'select') {
          await expect(lokasi).toContainText(nilaiSesuai.get(kunci) ?? '')
        } else {
          await expect(lokasi).toHaveValue(nilaiSesuai.get(kunci) ?? '')
        }
      }
    },
  )

  test(
    '[P1] alur Bank "Lainnya": textbox muncul, simpan PARSIAL tanpa nama bank sukses, terisi → lengkap & persisten',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse, interceptNetworkCall }) => {
      // skipNetworkMonitoring: PUT 200 x2 sesuai alur riil (parsial lalu
      // lengkap) — monitoring difokuskan pada kontrak UI.
      // SATU interceptor network-first (SEBELUM goto, pola spec ini) +
      // penghitung PUT: tepat satu PUT pasti per fase — pola klik-poll-
      // visible berisiko klik ganda lintas in-flight (klik ke-2 menunggu
      // tombol disabled→enabled lalu PUT ulang; respons PUT ulang itu
      // menghapus isian yang diketik di sela — race teramati 2026-09-19).
      let jumlahPut = 0
      interceptNetworkCall({ url: '**/api/profile', method: 'PUT' }).then(() => {
        jumlahPut += 1
      })
     await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)
    await page.goto(HALAMAN_KELENGKAPAN)
    await tungguHidrasi(page)

    await log.step('WHEN seluruh field diisi valid + Bank "Lainnya" dipilih — textbox Bank Lainnya muncul tapi dibiarkan kosong')
    for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
      const nilai = kunci === 'bankName' ? 'Lainnya' : kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
      await isiField(recurse, page, legend, label, jenis, nilai)
    }
    const otherBankNameInput = locatorField(page, LEGEND_REKENING, 'Bank Lainnya')
    await expect(otherBankNameInput).toBeVisible()

    await log.step('THEN simpan tanpa otherBankName → 200 PARSIAL: alert sukses + zona Sistem menyebut "Bank Lainnya" (sisa tersimpan)')
    await recurse(
      async () => {
        try {
          await page.getByRole('button', { name: /simpan/i }).click()
        } catch {
          // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
        }
        return jumlahPut >= 1
      },
      terkirim => terkirim === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu PUT parsial terkirim' },
    )
    await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.alertSukses)).toContainText('Profil tersimpan.')
    await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.indikator).getByText('Bank Lainnya')).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)).toHaveCount(0)

    await log.step('WHEN otherBankName diisi lalu simpan → profil lengkap')
    // Fase 2 aman poll visible: tidak ada perubahan isian pasca-fill, PUT
    // ulang yang mungkin terpicu membawa nilai identik (tak ada yang terhapus).
    await otherBankNameInput.fill('SeaBank')
    await recurse(
      async () => {
        try {
          await page.getByRole('button', { name: /simpan/i }).click()
        } catch {
          // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
        }
        return page.getByText(/profile lengkap/i).first().isVisible()
      },
      lengkap => lengkap === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu profil lengkap' },
    )

    await log.step('THEN reload — dropdown tetap "Lainnya" dan otherBankName persisten')
    await page.reload()
    await tungguHidrasi(page)
    await expect(locatorField(page, LEGEND_REKENING, 'Bank')).toContainText('Lainnya')
    await expect(locatorField(page, LEGEND_REKENING, 'Bank Lainnya')).toHaveValue('SeaBank')
    },
  )

  test(
    '[P1] indikator tidak mengklaim lengkap dari isian yang BELUM disimpan (anti-prematur — klaim hanya dari data tersimpan)',
    async ({ page, context, apiRequest, recurse }) => {
      await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness (profil belum tersimpan)')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)
      await page.goto(HALAMAN_KELENGKAPAN)
      await tungguHidrasi(page)

      await log.step('WHEN seluruh field diisi lengkap TANPA menekan Simpan')
      for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
        const nilai = kunci === 'bankName' ? BANK_UJI : kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
        await isiField(recurse, page, legend, label, jenis, nilai)
      }

      await log.step('THEN indikator TIDAK mengklaim profil lengkap (belum tersimpan di DB) + zona Isian TERSEMBUNYI (form tak ada field kosong)')
      const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
      await expect(indikator).not.toContainText(/profile lengkap/i)
      await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)).toHaveCount(0)
    },
  )

  test(
    '[P1] indikator mengklaim dari data TERSIMPAN — menghapus isi field tidak membalik klaim (anti-palsu-negatif)',
    async ({ page, context, apiRequest }) => {
      await log.step('GIVEN calon diajukan dengan profil lengkap TERSIMPAN via endpoint langsung')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      const simpan = await apiRequest<{ profileComplete: boolean }>({
        method: 'PUT',
        path: '/api/profile',
        body: profilLengkapUji(),
        headers: headerCookieDariMint(cookies),
      })
      expect(simpan.status).toBe(STATUS_OK)
      await context.addCookies(cookies)

      await log.step('WHEN membuka halaman tanpa mengubah apa pun')
      await page.goto(HALAMAN_KELENGKAPAN)
      await tungguHidrasi(page)

      await log.step('THEN indikator menyatakan lengkap + menunggu verifikasi, TANPA zona Isian')
      const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
      await expect(indikator).toContainText('Profile lengkap. Tunggu verifikasi COO')
      await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)).toHaveCount(0)

      await log.step('WHEN field Nama dikosongkan (perubahan belum disimpan)')
      const namaTersimpan = await locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap').inputValue()
      await locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap').fill('')

      await log.step('THEN indikator TETAP menyatakan lengkap — TIDAK membalik ke "belum lengkap" (data DB utuh)')
      await expect(indikator).toContainText('Profile lengkap. Tunggu verifikasi COO')
      await expect(indikator).not.toContainText('Profile belum lengkap')
      // Zona Isian (owner 2026-09-19): muncul hanya saat sudah edit DAN form
      // masih ada field kosong — box sendiri bertinta warn token semantik.
      const catatanForm = page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)
      await expect(catatanForm).toBeVisible()
      await expect(catatanForm).toContainText('Kelengkapan Isian di Form')
      await expect(catatanForm).toContainText('Field isian belum lengkap')
      await expect(catatanForm).toHaveClass(/border-warn\/40/)
      await expect(catatanForm).toHaveClass(/bg-warn\/10/)
      await expect(indikator).not.toContainText('Field isian belum lengkap')

      await log.step('AND nilai ASLI dipulihkan → zona Isian hilang')
      await locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap').fill(namaTersimpan)
      await expect(page.getByTestId(TEST_IDS.kelengkapanProfil.catatanForm)).toHaveCount(0)
    },
  )

  test(
    '[P1] textfield nomor menolak karakter di luar digit/"-" saat diketik/di-paste (penapis masukan)',
    async ({ page, context, apiRequest }) => {
      await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)
      await page.goto(HALAMAN_KELENGKAPAN)
      await tungguHidrasi(page)

      await log.step('WHEN mengisi No HP, No HP kontak darurat, dan No. Rekening dengan huruf/spasi diselingi')
      const noHp = locatorField(page, LEGEND_PRIBADI, 'No HP')
      await noHp.fill('0812-AB7C 90')
      const noHpKontak = locatorField(page, LEGEND_KONTAK_DARURAT, 'No HP')
      await noHpKontak.fill('08A13-987B6')
      const noRek = locatorField(page, LEGEND_REKENING, 'No. Rekening')
      await noRek.fill('7638-04XY93Z63')

      await log.step('THEN hanya digit dan "-" yang tertinggal di ketiga field')
      await expect(noHp).toHaveValue('0812-790')
      await expect(noHpKontak).toHaveValue('0813-9876')
      await expect(noRek).toHaveValue('7638-049363')
    },
  )

  test(
    '[P1] saklar "Sama dengan pemilik": default ON (Pemilik terkunci mengikuti Nama), OFF → editable & persisten',
    async ({ page, context, apiRequest, recurse }) => {
      await log.step('GIVEN sesi calon owner diajukan membuka /profile-completeness')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        status: 'diajukan',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)
      await page.goto(HALAMAN_KELENGKAPAN)
      await tungguHidrasi(page)

      await log.step('THEN saklar default ON — field Pemilik terkunci bernilai prefill Nama (profil Google)')
      const saklar = page.getByTestId(TEST_IDS.kelengkapanProfil.saklarPemilik)
      const pemilik = locatorField(page, LEGEND_REKENING, 'Nama')
      await expect(saklar).toHaveAttribute('aria-checked', 'true')
      await expect(pemilik).toBeDisabled()
      await expect(pemilik).toHaveValue(NAMA_SESI_MINT)

      await log.step('WHEN Nama diedit — nilai Pemilik mengikuti live selama saklar ON')
      const namaBaru = `Uji ${faker.string.alphanumeric(6)}`
      await locatorField(page, LEGEND_PRIBADI, 'Nama Lengkap').fill(namaBaru)
      await expect(pemilik).toHaveValue(namaBaru)

      await log.step('AND saklar dimatikan + Pemilik diisi manual + seluruh field lain diisi lalu Simpan sukses')
      await saklar.click()
      await expect(saklar).toHaveAttribute('aria-checked', 'false')
      await expect(pemilik).toBeEnabled()
      const pemilikManual = `Uji ${faker.string.alphanumeric(6)}`
      await pemilik.fill(pemilikManual)
      for (const { legend, label, kunci, jenis } of FIELD_EDITABLE) {
        if (kunci === 'accountHolderName') continue
        const nilai = kunci === 'bankName' ? BANK_UJI : kunci === 'emergencyContactRelationship' ? HUBUNGAN_UJI : nilaiSintetisUntuk(kunci)
        await isiField(recurse, page, legend, label, jenis, nilai)
      }
      await recurse(
        async () => {
          try {
            await page.getByRole('button', { name: /simpan/i }).click()
          } catch {
            // Klik pra-hidrasi tanpa handler — dievaluasi ulang iterasi berikutnya.
          }
          return page.getByTestId(TEST_IDS.kelengkapanProfil.alertSukses).isVisible()
        },
        tampil => tampil === true,
        { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu simpan profil sukses' },
      )

      await log.step('THEN nilai manual tersimpan — terkonfirmasi via GET /api/profile (kontrak server tak berubah)')
      const { status, body } = await apiRequest<{ accountHolderName: string }>({
        method: 'GET',
        path: '/api/profile',
        headers: headerCookieDariMint(cookies),
      })
      expect(status).toBe(STATUS_OK)
      expect(body.accountHolderName).toBe(pemilikManual)

      await log.step('AND reload → saklar OFF derived dari data tersimpan (Pemilik ≠ Nama), field editable bernilai manual')
      await page.reload()
      await tungguHidrasi(page)
      await expect(saklar).toHaveAttribute('aria-checked', 'false')
      await expect(pemilik).toBeEnabled()
      await expect(pemilik).toHaveValue(pemilikManual)
    },
  )
})

test.describe('[P1] calon diajukan LENGKAP melihat & memperbarui profilnya (keputusan owner 2026-09-21)', () => {
  test('[P1] halaman status menampilkan Data Profile read-only + tautan "Perbarui Profile"', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN calon owner 'diajukan' dengan profil LENGKAP tersimpan (mint + PUT endpoint langsung)")
    const emailUji = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailUji,
    })
    await context.addCookies(cookies)
    const profil = profilLengkapUji()
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: profil,
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
    })
    expect(simpan.status).toBe(200)

    await log.step('WHEN membuka /registration-status')
    await page.goto('/registration-status')

    await log.step('THEN badge Diajukan + section Data Profile read-only tampil dengan nilai isian')
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText('Diajukan')
    const dataProfil = page.getByTestId(TEST_IDS.statusPendaftaran.dataProfil)
    await expect(dataProfil).toBeVisible()
    await expect(dataProfil).toContainText(profil.fullName)
    await expect(dataProfil).toContainText(profil.accountNumber)

    await log.step('AND tautan "Perbarui Profile" tersedia (tidak lagi tersembunyi bagi calon lengkap)')
    await expect(page.getByRole('link', { name: 'Perbarui Profile' })).toBeVisible()
  })

  test('[P1] tautan "Perbarui Profile" membuka form /profile-completeness dengan nilai terisi', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN calon owner 'diajukan' dengan profil LENGKAP tersimpan")
    const emailUji = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailUji,
    })
    await context.addCookies(cookies)
    const profil = profilLengkapUji()
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: profil,
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
    })
    expect(simpan.status).toBe(200)

    await log.step('WHEN membuka /registration-status lalu mengeklik "Perbarui Profile"')
    await page.goto('/registration-status')
    await page.getByRole('link', { name: 'Perbarui Profile' }).click()

    await log.step('THEN form Kelengkapan Profil terbuka (TIDAK di-redirect) dengan isian terisi')
    await expect(page).toHaveURL(/\/profile-completeness$/)
    await expect(page.getByLabel('Nama Lengkap')).toHaveValue(profil.fullName)
    await expect(page.getByLabel('No. Rekening')).toHaveValue(profil.accountNumber)
  })
})

test.describe('[P2] polish form profile (keputusan owner 2026-09-21)', () => {
  test('[P2] input nomor dibatasi maxlength: HP 15 digit, rekening 20 karakter (paritas konstanta shared)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi calon owner diajukan membuka /profile-completeness")
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailSintetisUji(),
    })
    await context.addCookies(cookies)
    await page.goto(HALAMAN_KELENGKAPAN)
    await tungguHidrasi(page)

    await log.step('THEN atribut maxlength terpasang: No HP & No HP kontak darurat = 15, No. Rekening = 20')
    await expect(locatorField(page, LEGEND_PRIBADI, 'No HP')).toHaveAttribute('maxlength', '15')
    await expect(locatorField(page, LEGEND_KONTAK_DARURAT, 'No HP')).toHaveAttribute('maxlength', '15')
    await expect(locatorField(page, LEGEND_REKENING, 'No. Rekening')).toHaveAttribute('maxlength', '20')
  })

  test('[P1] zona "Kelengkapan Data di Sistem": copy verbatim + daftar field yang masih kosong', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi calon owner diajukan dengan profil BELUM lengkap (baru nama lengkap tersimpan)")
    const emailUji = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailUji,
    })
    await context.addCookies(cookies)
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: { ...profilLengkapUji(), alias: '', emergencyContactName: '', emergencyContactPhoneNumber: '', emergencyContactRelationship: '', bankName: '', otherBankName: '', accountHolderName: '', accountNumber: '' },
      headers: headerCookieDariMint(cookies),
    })
    expect(simpan.status).toBe(200)

    await log.step('WHEN membuka /profile-completeness')
    await page.goto(HALAMAN_KELENGKAPAN)
    await tungguHidrasi(page)

    await log.step('THEN indikator ber-copy verbatim "Profile belum lengkap. Silahkan isi:" + label field kosong')
    const indikator = page.getByTestId(TEST_IDS.kelengkapanProfil.indikator)
    await expect(indikator).toContainText('Profile belum lengkap. Silahkan isi:')
    await expect(indikator).toContainText('Alias')
    await expect(indikator).toContainText('Nama Bank')
    await expect(indikator).toContainText('Nomor Rekening')

    await log.step('AND setelah profil LENGKAP tersimpan → copy berubah verbatim "Profile lengkap. Tunggu verifikasi COO"')
    await context.addCookies(cookies)
    const lengkapi = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: profilLengkapUji(),
      headers: headerCookieDariMint(cookies),
    })
    expect(lengkapi.status).toBe(200)
    await page.reload()
    await tungguHidrasi(page)
    await expect(indikator).toContainText('Profile lengkap. Tunggu verifikasi COO')
  })
})

test('[P1] wayfinding calon: logo & "Kembali ke Status Pendaftaran" di form mengantar kembali ke halaman status', async ({ page, context, apiRequest }) => {
  await log.step("GIVEN sesi calon owner diajukan membuka /profile-completeness")
  const cookies = await mintSesiPemilik(apiRequest, {
    userIdentifier: 'tanpa-saham',
    status: 'diajukan',
    email: emailSintetisUji(),
  })
  await context.addCookies(cookies)
  await page.goto(HALAMAN_KELENGKAPAN)
  await tungguHidrasi(page)

    await log.step('THEN baris wayfinding tampil: logo + link "Kembali ke Status Pendaftaran"')
    const kembali = page.getByRole('link', { name: 'Kembali ke Status Pendaftaran' })
    await expect(kembali).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ke halaman utama' }).locator('img')).toBeVisible()

  await log.step('WHEN mengeklik link kembali')
  await kembali.click()

  await log.step('THEN kembali ke /registration-status')
  await expect(page).toHaveURL(/\/registration-status$/)
})
