/**
 * ATDD GREEN-PHASE — Story 1.7 "Role, Matriks Keterbukaan & Navigasi"
 * (matriks keterbukaan di batas server — AD-8, FR-15 §4.8).
 *
 * Seluruh test SUDAH DIAKTIFKAN pada tugas green-phase middleware
 * `auth-guard` (gerbang role registry-driven) + Alert transparansi Halaman
 * Personal; kegagalan merah diverifikasi sebelum implementasi (asersi
 * ter-pin dari red-phase tidak berubah).
 *
 * ASUMSI KONTRAK (red-phase, dipin):
 * - Gerbang role middleware SSR (AD-8): tanpa_saham BELUM-pernah-beli
 *   (terverifikasi/keluar, firstEffectiveAt null) × /dashboard|/order-queue|
 *   /audit-trail (URL langsung) → flash-cookie → sendRedirect('/personal');
 *   keluar-PERNAH-beli (firstEffectiveAt terisi) × /dashboard → 200
 *   (aksesPenuh — middleware konsultasi predikat atas snapshot owner, BUKAN
 *   role saja: resolveRole memetakan keluar → tanpa_saham SEBELUM melihat
 *   firstEffectiveAt, server/domain/identity/access.service.ts);
 *   pemegang_saham × /order-queue|/audit-trail|/pendaftar → redirect
 *   /dashboard (registrasi /pendaftar keputusan owner 2026-09-22 — review
 *   adv#2); coo × /personal → 200 Halaman Personal (PRASYARAT_OWNER —
 *   keputusan owner 2026-09-21); calon diajukan × /dashboard|/pendaftar →
 *   TETAP gerbang calon 1.5 (/profile-completeness — precedence, gerbang role
 *   tidak tersentuh).
 * - Pesan transparansi VERBATIM
 *   `Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.`
 *   (cermin PESAN_TRANSPARANSI shared/domain/identity.ts yang ditambahkan
 *   saat green-phase — dipin lokal agar file mandiri saat red-phase), Alert
 *   aria-live="polite" via data-testid="personal-alert-transparansi", tampil
 *   SEKALI; URL dibersihkan setelah mount → /personal tanpa query; reload
 *   kedua → alert TIDAK muncul lagi.
 * - Sesi uji: mintSesiPemilik + context.addCookies (pola auth-landing.spec.ts;
 *   preset 'tanpa-saham' = {terverifikasi, punyaSaham:false}, preset 'keluar'
 *   = {keluar, punyaSaham:true}, override punyaSaham:false = keluar-belum-beli
 *   dengan firstEffectiveAt null).
 *
 * Catatan mandate playwright-utils (deviasi tercatat): redirect diputuskan
 * server-side saat request dokumen SSR — TIDAK ada panggilan API client-side
 * yang layak di-spy → interceptNetworkCall sengaja TIDAK dipakai di file ini
 * (pola auth-landing.spec.ts); asersi web-first (toHaveURL / toBeVisible /
 * toContainText) auto-retry. Tanpa page.route, tanpa waitForTimeout, tanpa
 * console.log; selector by-role/by-testid/by-text (tanpa CSS/XPath/has-text).
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Email sintetis unik per test — hindari berbagi baris owner bawaan antar
 *  worker paralel (cleanup per-worker menghapus email yang DIA mint; baris
 *  bawaan identifier dipakai bersama bisa terhapus di tengah test lain —
 *  sumber flake baca /api/personal 401). Prefix terkunci pola mint dev-only
 *  (duplikasi disengaja agar spec mandiri — pola personal.spec.ts). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Pesan transparansi VERBATIM — cermin PESAN_TRANSPARANSI shared/domain. */
const PESAN_TRANSPARANSI = 'Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.'

/** Pola URL landing Halaman Personal — redirect gerbang role TANPA query
 *  (keputusan owner 2026-09-21: pesan transparensi dikirim flash-cookie,
 *  bukan `?info=transparansi`). */
const URL_PERSONAL = /\/personal$/

/** UUID sintetis permukaan dinamis MoM (fixture — prefix /mom/, Story 2.1b). */
const MOM_ID_UJI = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

test.describe('E2E Story 1.7 — matriks keterbukaan di batas server (AD-8, FR-15 §4.8)', () => {
  test('[P0] tanpa saham belum-beli membuka /dashboard → redirect /personal polos, alert verbatim (flash-cookie) tampil SEKALI', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN dialihkan di batas server ke /personal POLOS (AD-8 — pesan via flash-cookie, bukan query)')
    await expect(page).toHaveURL(URL_PERSONAL)

    await log.step('AND alert transparansi tampil dengan pesan VERBATIM + aria-live polite')
    const alert = page.getByTestId(TEST_IDS.personal.alertTransparansi)
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(PESAN_TRANSPARANSI)
    await expect(alert).toHaveAttribute('aria-live', 'polite')

    await log.step('WHEN halaman dimuat ulang (reload kedua — cookie sudah dihapus halaman saat mount)')
    await page.reload()

    await log.step('THEN alert TIDAK muncul lagi (pin sekali-tampil)')
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toHaveCount(0)
  })

  test('[P0] tanpa saham belum-beli membuka /order-queue → redirect /personal polos', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /order-queue secara langsung')
    await page.goto('/order-queue')

    await log.step('THEN dialihkan di batas server ke /personal polos dengan alert transparansi VERBATIM (AD-8)')
    await expect(page).toHaveURL(URL_PERSONAL)
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P0] tanpa saham belum-beli membuka /pendaftar → redirect /personal polos (permukaan COO terdaftar — keputusan owner 2026-09-22)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /pendaftar secara langsung')
    await page.goto('/pendaftar')

    await log.step('THEN dialihkan di batas server ke /personal polos dengan alert transparansi VERBATIM (jalur sama /order-queue — PRASYARAT_COO)')
    await expect(page).toHaveURL(URL_PERSONAL)
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P0] tanpa saham belum-beli membuka /audit-trail → redirect /personal polos', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /audit-trail secara langsung')
    await page.goto('/audit-trail')

    await log.step('THEN dialihkan di batas server ke /personal polos + alert VERBATIM (AD-8 — middleware MENAMBAH penegakan, resolver 1.3 tetap defensif)')
    await expect(page).toHaveURL(URL_PERSONAL)

    await log.step('AND alert transparansi membawa pesan VERBATIM')
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P1] keluar belum-beli membuka /dashboard → redirect sama (cakupan AD-11 — perluReferral)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'keluar' yang BELUM pernah beli (override punyaSaham:false → firstEffectiveAt null)")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', punyaSaham: false, email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN dialihkan ke /personal polos + alert VERBATIM (resolveRole keluar → tanpa_saham sebelum firstEffectiveAt; aksesPenuh false)')
    await expect(page).toHaveURL(URL_PERSONAL)

    await log.step('AND alert transparansi membawa pesan VERBATIM')
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P0] keluar PERNAH-beli membuka /dashboard → 200 aksesPenuh (bukan role saja — kunci AD-8)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'keluar' yang PERNAH membeli (preset 'keluar' = punyaSaham:true → firstEffectiveAt terisi)")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN halaman TAMPIL 200 — role tanpa_saham tetap boleh karena aksesPenuh (matriks terbuka otomatis pasca Pembelian Pertama)')
    await expect(page).toHaveURL(/\/dashboard$/)
    // by-role heading — hindari ambigu NuxtRouteAnnouncer (pola auth-landing).
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('[P1] pemegang saham membuka /order-queue → redirect landing-nya /dashboard', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'pemegang-saham' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /order-queue (permukaan role coo) secara langsung')
    await page.goto('/order-queue')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] pemegang saham membuka /audit-trail → redirect landing-nya /dashboard', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'pemegang-saham' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /audit-trail (permukaan role coo) secara langsung')
    await page.goto('/audit-trail')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] pemegang saham membuka /pendaftar → redirect landing-nya /dashboard (permukaan COO terdaftar — keputusan owner 2026-09-22)', async ({ page, context, apiRequest }) => {
    // Registrasi /pendaftar = PRASYARAT_COO di PERMUKAAN_PERAN — penegakan
    // middleware yang selama ini absen untuk permukaan Story 1.6 (adv#2).
    await log.step("GIVEN sesi 'pemegang-saham' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /pendaftar (permukaan role coo) secara langsung')
    await page.goto('/pendaftar')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] coo membuka /personal → Halaman Personal tampil (PRASYARAT_OWNER — keputusan owner 2026-09-21)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'coo' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /personal (semua owner melihat profil dirinya — read-only)')
    await page.goto('/personal')

    await log.step('THEN Halaman Personal tampil 200 — heading Profile terlihat, TANPA redirect')
    await expect(page).toHaveURL(/\/personal$/)
    await expect(page.getByRole('heading', { name: 'Halaman Personal' })).toBeVisible()
  })

  test('[P1] calon diajukan membuka /dashboard → gerbang calon 1.5 menang (precedence atas gerbang role)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi calon owner berstatus 'diajukan' (Profil belum lengkap) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'calon-diajukan', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard secara langsung')
    await page.goto('/dashboard')

    await log.step('THEN dialihkan ke /profile-completeness — gerbang calon 1.5 dievaluasi SEBELUM gerbang role (perilaku 1.5 TIDAK tersentuh)')
    await expect(page).toHaveURL(/\/profile-completeness$/)
  })

  test('[P1] calon diajukan belum-lengkap membuka /pendaftar → gerbang calon 1.5 /profile-completeness (registrasi registry 2026-09-22)', async ({ page, context, apiRequest }) => {
    // Sejak /pendaftar = PRASYARAT_COO di registry, redirect calon pindah dari
    // resolver halaman (dulu → /registration-status) ke middleware — calon
    // diajukan belum-lengkap ditangkap gerbang calon 1.5 lebih dulu.
    await log.step("GIVEN sesi calon owner 'diajukan' (Profil belum lengkap) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'calon-diajukan', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /pendaftar secara langsung')
    await page.goto('/pendaftar')

    await log.step('THEN dialihkan ke /profile-completeness — gerbang calon 1.5 dievaluasi SEBELUM gerbang role')
    await expect(page).toHaveURL(/\/profile-completeness$/)
  })

  test('[P1] calon ditolak dan kedaluwarsa membuka /dashboard → landing calon /registration-status (review Story 1.7 #1 — jatuh ke gerbang role)', async ({ page, context, apiRequest }) => {
    // Matriks baris "calon × permukaan mana pun": `ditolak`/`kedaluwarsa`
    // diurus gerbang calon 1.5 DULU (yang tidak me-redirect mereka), lalu
    // gerbang role menutup sisanya → landing calon. Tanpa ini calon
    // berstatus tersebut melihat shell permukaan terkunci (200).
    for (const userIdentifier of ['calon-ditolak', 'calon-kedaluwarsa'] as const) {
      await log.step(`GIVEN sesi calon owner '${userIdentifier}' terinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier, email: emailSintetisUji() })
      await context.clearCookies()
      await context.addCookies(cookies)

      await log.step('WHEN membuka /dashboard secara langsung')
      await page.goto('/dashboard')

      await log.step('THEN dialihkan ke landing calon /registration-status — registry menolak calon_owner di semua permukaan')
      await expect(page).toHaveURL(/\/registration-status$/)
    }
  })

  test('[P1] trailing slash /dashboard/ juga digerbangi (review Story 1.7 #2 — normalisasi pathname)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /dashboard/ (varian trailing slash)')
    await page.goto('/dashboard/')

    await log.step('THEN tetap dialihkan ke /personal polos + alert VERBATIM — lookup gerbang tidak meleset')
    await expect(page).toHaveURL(URL_PERSONAL)
  })

  test('[P0] tanpa saham belum-beli membuka /mom → redirect /personal polos + alert VERBATIM (Story 2.1b — MoM terkunci matriks)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /mom secara langsung')
    await page.goto('/mom')

    await log.step('THEN dialihkan di batas server ke /personal polos dengan alert transparansi VERBATIM (AD-8)')
    await expect(page).toHaveURL(URL_PERSONAL)
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P1] tanpa saham belum-beli membuka /mom/<uuid> → redirect sama (Story 2.1b — aturan prefix /mom/ di middleware)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'tanpa-saham' (belum pernah beli) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka permukaan dinamis /mom/<uuid> secara langsung')
    await page.goto(`/mom/${MOM_ID_UJI}`)

    await log.step('THEN tetap dialihkan ke /personal polos + alert VERBATIM — prefix registry tergerbangi middleware')
    await expect(page).toHaveURL(URL_PERSONAL)
    await expect(page.getByTestId(TEST_IDS.personal.alertTransparansi)).toContainText(PESAN_TRANSPARANSI)
  })

  test('[P1] pemegang saham membuka /mom/baru → redirect landing-nya /dashboard (Story 2.1b — COO saja)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'pemegang-saham' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /mom/baru (permukaan CMS COO) secara langsung')
    await page.goto('/mom/baru')

    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] coo membuka /mom → 200 halaman tampil (Story 2.1b — CMS COO)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'coo' terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /mom secara langsung')
    await page.goto('/mom')

    await log.step('THEN halaman daftar MoM tampil 200 — heading terlihat, TANPA redirect')
    await expect(page).toHaveURL(/\/mom$/)
    await expect(page.getByRole('heading', { name: 'MoM MRO/RUPS' })).toBeVisible()
  })

  test('[P1] keluar PERNAH-beli membuka /mom → 200 aksesPenuh (Story 2.1b — matriks terbuka, API ikut dibuka)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi owner 'keluar' yang PERNAH membeli (preset 'keluar' = punyaSaham:true) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /mom secara langsung')
    await page.goto('/mom')

    await log.step('THEN halaman tampil 200 tanpa redirect — aksesPenuh membuka MoM (snapshot, bukan role saja)')
    await expect(page).toHaveURL(/\/mom$/)
    await expect(page.getByRole('heading', { name: 'MoM MRO/RUPS' })).toBeVisible()
    await log.step('AND daftar MoM termuat dari API (bukan state gagal — API mengizinkan aksesPenuh)')
    await expect(page.getByTestId('mom-halaman')).toBeVisible()
  })

  test('[P1] calon ditolak dan kedaluwarsa membuka /mom → landing calon /registration-status (Story 2.1b — jatuh ke gerbang role)', async ({ page, context, apiRequest }) => {
    for (const userIdentifier of ['calon-ditolak', 'calon-kedaluwarsa'] as const) {
      await log.step(`GIVEN sesi calon owner '${userIdentifier}' terinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier, email: emailSintetisUji() })
      await context.clearCookies()
      await context.addCookies(cookies)

      await log.step('WHEN membuka /mom secara langsung')
      await page.goto('/mom')

      await log.step('THEN dialihkan ke landing calon /registration-status — registry menolak calon_owner')
      await expect(page).toHaveURL(/\/registration-status$/)
    }
  })
})
