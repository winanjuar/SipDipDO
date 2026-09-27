/**
 * ATDD GREEN-PHASE — Story 1.7 "Role, Matriks Keterbukaan & Navigasi"
 * (Halaman Personal 4 section — UX-DR19 kerangka, FR-15, AC 1.7 #4).
 *
 * Seluruh test SUDAH DIAKTIFKAN pada tugas green-phase `app/pages/personal.vue`
 * (4 section + Alert transparansi + URL bersih) + endpoint GET /api/personal
 * + blok TEST_IDS.personal; kegagalan merah diverifikasi sebelum implementasi
 * (asersi ter-pin dari red-phase tidak berubah).
 *
 * ASUMSI KONTRAK (red-phase, dipin):
 * - Halaman Personal 4 section dengan data-testid: sectionProfil
 *   'personal-section-profil'; sectionPortofolio 'personal-section-portofolio'
 *   dengan state kosong 'personal-status-kosong' (Epic 3); sectionHargaRkap
 *   'personal-section-harga-rkap' dengan tautan Harga & RKAP non-aktif
 *   aria-disabled="true" (Epic 2); pintuPesanan 'personal-pintu-pesanan'
 *   berupa tombol disabled dengan keterangan
 *   "Terbuka saat pembelian pertama dibuka" (Open Questions #1 — default tampil
 *   non-aktif).
 * - Profile menampilkan data GET /api/personal (read-only milik-sendiri,
 *   role tanpa_saham — fullName dari data tersimpan).
 * - GET /api/personal gagal → state kosong Profile + pesan coba lagi
 *   'personal-pesan-gagal-profil' (pola gagal-muat 1.5).
 * - Seed profil pola DUA-LANGKAH (pola kelengkapan-profil.spec.ts): mint
 *   email unik status 'diajukan' → PUT /api/profile via apiRequest dengan
 *   10 field factory (mirror profilLengkapUji profil.api.spec.ts; patuh batas
 *   validasi nama ≤25, alias ≤10, HP '0812'+8 digit, rekening 10 digit) →
 *   re-mint email SAMA status default preset 'terverifikasi' (baris sama
 *   ter-update via upsert — profil tetap tersimpan) → addCookies.
 * - ASUMSI FETCH (nyatakan eksplisit): GET /api/personal diasumsikan
 *   dipanggil sisi klien (lazy/pasca-hidrasi) sehingga stub
 *   interceptNetworkCall diterapkan pada request browser — bila ternyata
 *   fetch terjadi SSR-side, penyelarasan stub dilakukan saat green-phase
 *   (mis. beralih ke stub server/dev-only), tanpa mengubah asersi UI.
 *
 * Mandate playwright-utils: `test` HANYA dari merged-fixtures;
 * interceptNetworkCall DIDEKLARASIKAN SEBELUM page.goto (network-first);
 * `log.step` GIVEN/WHEN/THEN bukan console.log; tanpa page.route, tanpa
 * waitForTimeout; selector by-role/by-testid/by-text (tanpa CSS/XPath).
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Status HTTP sukses — tanpa magic number. */
const STATUS_OK = 200

/** Keterangan pintu Pesanan Pembelian non-aktif (Open Questions #1). */
const KETERANGAN_PINTU_PESANAN = 'Terbuka saat pembelian pertama dibuka'

/** Nama bank isian untuk Bank "Lainnya" (data sintetis — review #3). */
const NAMA_BANK_LAINNYA_UJI = 'SeaBankUji'

/** Nilai enum sah untuk dropdown profil (shared/domain/profil). */
const BANK_UJI = 'BCA'
const HUBUNGAN_UJI = 'Saudara'

/** Cookie[] hasil mint → header Cookie untuk apiRequest (pola profil.api.spec.ts). */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

/** Email sintetis unik pola mint dev-only (prefix terkunci — pola
 *  auth-landing.spec.ts; WAJIB unik karena test ini menulis data profil). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/**
 * Factory 10 field Profil sintetis — mirror profilLengkapUji
 * (profil.api.spec.ts). Nilai patuh batas validasi (re-negotiasi owner
 * 2026-09-18): nama ≤25, alias ≤10, HP 0+9-15 digit, rekening 10 digit,
 * enum sah. Gmail bukan bagian body PUT (selalu email sesi) — hanya kunci
 * tipe Profil yang di-mirror.
 */
const profilLengkapUji = () => ({
  fullName: `Uji ${faker.string.alphanumeric(6)}`,
  alias: faker.string.alphanumeric({ length: 5, casing: 'lower' }),
  gmail: emailSintetisUji(),
  phoneNumber: '0812' + faker.string.numeric(8),
  emergencyContactName: `Uji ${faker.string.alphanumeric(6)}`,
  emergencyContactPhoneNumber: '0813' + faker.string.numeric(8),
  emergencyContactRelationship: HUBUNGAN_UJI,
  bankName: BANK_UJI,
  otherBankName: '',
  accountHolderName: `Uji ${faker.string.alphanumeric(6)}`,
  accountNumber: faker.string.numeric(10),
})

test.describe('E2E Story 1.7 — Halaman Personal 4 section (UX-DR19, FR-15)', () => {
  test('[P0] Halaman Personal menampilkan 4 section: Profile terisi, Portofolio & Pesanan state kosong, Harga & RKAP non-aktif, pintu Pesanan disabled', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN owner tanpa saham dengan profil lengkap tersimpan (seed dua-langkah via endpoint — tanpa tulis lewat UI)')
    const emailUji = emailSintetisUji()
    const cookiesCalon = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailUji,
    })
    const profil = profilLengkapUji()
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: profil,
      headers: headerCookieDariMint(cookiesCalon),
    })
    expect(simpan.status).toBe(STATUS_OK)

    await log.step("AND baris sama di-mint ulang berstatus default 'terverifikasi' (upsert — profil tetap tersimpan, role tanpa_saham)")
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      email: emailUji,
    }))

    await log.step('WHEN membuka /personal')
    await page.goto('/personal')

    await log.step('THEN 4 section matriks tampil')
    const sectionProfil = page.getByTestId(TEST_IDS.personal.sectionProfil)
    const sectionPortofolio = page.getByTestId(TEST_IDS.personal.sectionPortofolio)
    const sectionHargaRkap = page.getByTestId(TEST_IDS.personal.sectionHargaRkap)
    const pintuPesanan = page.getByTestId(TEST_IDS.personal.pintuPesanan)
    await expect(sectionProfil).toBeVisible()
    await expect(sectionPortofolio).toBeVisible()
    await expect(sectionHargaRkap).toBeVisible()
    await expect(pintuPesanan).toBeVisible()

    await log.step('AND section Profile memuat fullName yang disimpan (dari GET /api/personal)')
    await expect(sectionProfil).toContainText(profil.fullName)

    await log.step('AND SELURUH 10 baris Lampiran A tampil dengan nilai seed masing-masing (review Story 1.7 #9 — bukan hanya fullName)')
    const BARIS_PROFIL_TERPIN = [
      { label: 'Nama Lengkap', nilai: profil.fullName },
      { label: 'Nama Panggilan atau Alias', nilai: profil.alias },
      { label: 'Gmail', nilai: emailUji },
      { label: 'Nomor HP', nilai: profil.phoneNumber },
      { label: 'Kontak Darurat', nilai: profil.emergencyContactName },
      { label: 'Nomor HP Kontak Darurat', nilai: profil.emergencyContactPhoneNumber },
      { label: 'Hubungan dengan Owner', nilai: profil.emergencyContactRelationship },
      { label: 'Nama Bank', nilai: profil.bankName },
      { label: 'Pemilik Rekening', nilai: profil.accountHolderName },
      { label: 'Nomor Rekening', nilai: profil.accountNumber },
    ] as const
    for (const baris of BARIS_PROFIL_TERPIN) {
      await expect(sectionProfil).toContainText(baris.label)
      await expect(sectionProfil).toContainText(baris.nilai)
    }

    await log.step('AND Portofolio & status Pesanan jatuh ke state kosong (Epic 3 — jangan diimplementasi)')
    await expect(sectionPortofolio.getByTestId(TEST_IDS.personal.statusKosong)).toBeVisible()

    await log.step('AND tautan Harga berjalan & RKAP non-aktif aria-disabled (Epic 2 — state kosong)')
    await expect(sectionHargaRkap.getByRole('link', { name: /harga/i })).toHaveAttribute('aria-disabled', 'true')
    await expect(sectionHargaRkap.getByRole('link', { name: /rkap/i })).toHaveAttribute('aria-disabled', 'true')

    await log.step('AND pintu Pesanan Pembelian non-aktif dengan keterangan (Open Questions #1 — default tampil disabled)')
    await expect(pintuPesanan).toBeDisabled()
    await expect(pintuPesanan).toContainText(KETERANGAN_PINTU_PESANAN)
  })

  test('[P1] pemegang saham membuka /personal → pintu Pesanan TIDAK tampil (hanya relevan bagi yang belum pernah membeli)', async ({ page, context, apiRequest }) => {
    // Keputusan owner 2026-09-21: section pintu Pesanan (non-aktif + keterangan
    // "pembelian pertama") menyasar yang belum pernah membeli; pemegang saham
    // tidak melihatnya.
    await log.step("GIVEN sesi owner 'pemegang-saham' (Pembelian Pertama sudah efektif)")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /personal')
    await page.goto('/personal')

    await log.step('THEN section Profile & Portofolio tampil, TANPA pintu Pesanan')
    await expect(page.getByTestId(TEST_IDS.personal.sectionProfil)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.personal.pintuPesanan)).toHaveCount(0)
  })

  test('[P1] Bank "Lainnya" tampil sebagai nama bank isian di Profile — bukan literal enum (review Story 1.7 #3)', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN owner tanpa saham dengan profil Bank "Lainnya" + otherBankName tersimpan (seed dua-langkah)')
    const emailUji = emailSintetisUji()
    const cookiesCalon = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      status: 'diajukan',
      email: emailUji,
    })
    const profil = profilLengkapUji()
    const simpan = await apiRequest<{ profileComplete: boolean }>({
      method: 'PUT',
      path: '/api/profile',
      body: { ...profil, bankName: 'Lainnya', otherBankName: NAMA_BANK_LAINNYA_UJI },
      headers: headerCookieDariMint(cookiesCalon),
    })
    expect(simpan.status).toBe(STATUS_OK)
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'tanpa-saham',
      email: emailUji,
    }))

    await log.step('WHEN membuka /personal')
    await page.goto('/personal')

    await log.step('THEN baris Nama Bank menampilkan nama bank isian — bukan "Lainnya"')
    const sectionProfil = page.getByTestId(TEST_IDS.personal.sectionProfil)
    await expect(sectionProfil).toContainText(NAMA_BANK_LAINNYA_UJI)
  })

  test(
    '[P1] GET /api/personal gagal (500) → state kosong Profile + pesan coba lagi (pola 1.5)',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, interceptNetworkCall }) => {
      // skipNetworkMonitoring: stub 500 DESENGAJA mensimulasikan gangguan
      // baca profil — bukan bug jaringan (pola kelengkapan-profil.spec.ts).
      await log.step('GIVEN sesi owner tanpa saham (terverifikasi, belum pernah beli); endpoint personal DI-STUB 500')
      const cookies = await mintSesiPemilik(apiRequest, {
        userIdentifier: 'tanpa-saham',
        email: emailSintetisUji(),
      })
      await context.addCookies(cookies)

      // Intercept dideklarasikan SEBELUM goto (network-first — mandate).
      const personalGagal = interceptNetworkCall({
        url: '**/api/personal',
        fulfillResponse: { status: 500, body: { code: 'INTERNAL', message: 'Internal Server Error', details: {} } },
      })

      await log.step('WHEN membuka /personal')
      await page.goto('/personal')

      await log.step('AND panggilan GET ter-stub memang terjadi (asumsi fetch client-side — lihat header)')
      await personalGagal

      await log.step('THEN pesan gagal muat profil tampil (pola gagal-muat 1.5)')
      await expect(page.getByTestId(TEST_IDS.personal.pesanGagalProfil)).toBeVisible()

      await log.step('AND section Profile jatuh ke state kosong — TANPA data profil')
      await expect(page.getByTestId(TEST_IDS.personal.sectionProfil).getByTestId(TEST_IDS.personal.statusKosong)).toBeVisible()
    },
  )
})
