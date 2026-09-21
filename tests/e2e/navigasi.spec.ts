/**
 * ATDD GREEN-PHASE — Story 1.7 "Role, Matriks Keterbukaan & Navigasi"
 * (navigasi role-based registry-driven — UX-DR14, FR-15, AD-8).
 *
 * Seluruh test SUDAH DIAKTIFKAN pada tugas green-phase layout
 * `app/layouts/app.vue` + `AppSidebar` / `AppBottomNav` (+ Sheet "Lainnya")
 * + blok TEST_IDS.navigasi; kegagalan merah diverifikasi sebelum
 * implementasi (asersi ter-pin dari red-phase tidak berubah).
 *
 * ASUMSI KONTRAK (red-phase, dipin — UX-DR14):
 * - Mobile (<lg): bottom nav data-testid="nav-batang-bawah"; Desktop (≥lg):
 *   sidebar kiri data-testid="nav-sidebar".
 * - Item = link by-role name, label terpin: 'Antrian Beli'→/order-queue,
 *   'Dashboard'→/dashboard, 'Audit Trail'→/audit-trail, 'Personal'→/personal.
 * - Registry item per role (Epic 1): coo=[Antrian Beli, Dashboard, Audit
 *   Trail]; pemegang_saham=[Dashboard]; tanpa_saham belum-beli=[Personal];
 *   tanpa_saham aksesPenuh=[Personal, Dashboard]; calon_owner=TANPA nav.
 * - Item terkunci TIDAK TAMPIL sama sekali (toHaveCount(0) — bukan
 *   disembunyikan); item aktif aria-current="page".
 * - "Lainnya" (Sheet shadcn) hanya bila item > MAKS_ITEM_NAV_MOBILE (4) —
 *   registry Epic 1 maks 3 item per role → pemicu "Lainnya" TIDAK tampil.
 * - Logo sidebar: diasumsikan BrandLogo dengan testid yang sama dengan
 *   halaman login (TEST_IDS.login.brandLogo — sumber auth-landing.spec.ts)
 *   dirender ulang di sidebar; ketuk logo → landing role (coo →
 *   /order-queue). Bila implementasi memakai testid berbeda, selaraskan
 *   saat green-phase (tersangkut testid, bukan asersi perilaku).
 * - Sesi uji: mintSesiPemilik + context.addCookies (pola auth-landing.spec.ts).
 *
 * Catatan mandate playwright-utils (deviasi tercatat): landing & redirect
 * diputuskan server-side pada dokumen SSR — TIDAK ada panggilan API
 * client-side yang layak di-spy → interceptNetworkCall sengaja TIDAK dipakai
 * di file ini (pola auth-landing.spec.ts). Tanpa page.route, tanpa
 * waitForTimeout, tanpa console.log; viewport via test.use dengan konstanta
 * bernama (tanpa magic number); selector by-role/by-testid.
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

/** Viewport uji (konstanta bernama — tanpa magic number). */
const VIEWPORT_MOBILE = { width: 375, height: 812 }
const VIEWPORT_DESKTOP = { width: 1280, height: 800 }

/** Label item navigasi terpin (registry UX-DR14 — item = link by-role name). */
const LABEL_ANTRIAN = 'Antrian Beli'
const LABEL_DASHBOARD = 'Dashboard'
const LABEL_AUDIT = 'Audit Trail'
const LABEL_PERSONAL = 'Personal'

/** Pemicu Sheet "Lainnya" — hanya bila item > MAKS_ITEM_NAV_MOBILE (4). */
const LABEL_PEMICU_LAINNYA = 'Lainnya'

/** Batas tunggu sinyal hidrasi & interaksi logout (ms). */
const BATAS_RECURSE_KELUAR_MS = 15_000

/** Registry navigasi coo (satu-satunya role Epic 1 dengan 3 item). */
const ITEM_NAV_COO = [LABEL_DASHBOARD, LABEL_ANTRIAN, LABEL_AUDIT, LABEL_PERSONAL] as const

test.describe('E2E Story 1.7 — navigasi registry-driven mobile <lg (UX-DR14)', () => {
  test.use({ viewport: VIEWPORT_MOBILE })

  test('[P1] coo mobile: bottom nav 4 item tanpa pemicu "Lainnya", item aktif aria-current="page"', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'coo' terinjeksikan di landing role-nya")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/')
    await expect(page).toHaveURL(/\/order-queue$/)

    await log.step('THEN bottom nav tampil berisi TEPAT 4 link registry coo (Personal masuk — keputusan owner 2026-09-21)')
    const batangBawah = page.getByTestId(TEST_IDS.navigasi.batangBawah)
    await expect(batangBawah).toBeVisible()
    await expect(batangBawah.getByRole('link')).toHaveCount(ITEM_NAV_COO.length)
    for (const label of ITEM_NAV_COO) {
      await expect(batangBawah.getByRole('link', { name: label })).toBeVisible()
    }

    await log.step('AND TANPA pemicu "Lainnya" (registry ≤ MAKS_ITEM_NAV_MOBILE — Sheet tidak perlu)')
    await expect(batangBawah.getByRole('button', { name: LABEL_PEMICU_LAINNYA })).toHaveCount(0)

    await log.step('AND item halaman aktif ditandai aria-current="page"')
    await expect(batangBawah.getByRole('link', { name: LABEL_ANTRIAN })).toHaveAttribute('aria-current', 'page')
  })

  test('[P0] pemegang saham mobile: hanya Dashboard — Audit Trail & Antrian Beli absen sama sekali (item terkunci TIDAK TAMPIL)', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'pemegang-saham' terinjeksikan di landing role-nya")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('THEN bottom nav tampil berisi TEPAT 2 link: Dashboard + Personal (registry pemegang_saham — keputusan owner 2026-09-21)')
    const batangBawah = page.getByTestId(TEST_IDS.navigasi.batangBawah)
    await expect(batangBawah).toBeVisible()
    await expect(batangBawah.getByRole('link')).toHaveCount(2)
    await expect(batangBawah.getByRole('link', { name: LABEL_DASHBOARD })).toBeVisible()
    await expect(batangBawah.getByRole('link', { name: LABEL_PERSONAL })).toBeVisible()
    await expect(batangBawah.getByRole('link', { name: LABEL_DASHBOARD })).toHaveAttribute('aria-current', 'page')

    await log.step('AND item terkunci TIDAK TAMPIL sama sekali — bukan disembunyikan (UX-DR14)')
    await expect(batangBawah.getByRole('link', { name: LABEL_AUDIT })).toHaveCount(0)
    await expect(batangBawah.getByRole('link', { name: LABEL_ANTRIAN })).toHaveCount(0)
  })

  test('[P1] tanpa saham belum-beli mobile: hanya Personal — Dashboard absen sama sekali', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'tanpa-saham' (terverifikasi, belum pernah beli) terinjeksikan di landing role-nya")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'tanpa-saham', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/')
    await expect(page).toHaveURL(/\/personal$/)

    await log.step('THEN bottom nav tampil berisi TEPAT 1 link: Personal (registry tanpa_saham belum aksesPenuh — tanpa Dashboard)')
    const batangBawah = page.getByTestId(TEST_IDS.navigasi.batangBawah)
    await expect(batangBawah).toBeVisible()
    await expect(batangBawah.getByRole('link')).toHaveCount(1)
    await expect(batangBawah.getByRole('link', { name: LABEL_PERSONAL })).toBeVisible()
    await expect(batangBawah.getByRole('link', { name: LABEL_PERSONAL })).toHaveAttribute('aria-current', 'page')

    await log.step('AND Dashboard TIDAK TAMPIL sama sekali (aksesPenuh false — AD-8)')
    await expect(batangBawah.getByRole('link', { name: LABEL_DASHBOARD })).toHaveCount(0)
  })

  test('[P1] keluar PERNAH-beli mobile: nav Personal + Dashboard (aksesPenuh lewat wiring layout)', async ({ page, context, apiRequest }) => {
    // Review Story 1.7 (#7): satu-satunya state role yang membuat wiring
    // `aksesPenuh` di layout mengubah nav terlihat — tanpa test ini,
    // penghapusan fetch `/api/personal` di layout tidak pernah terdeteksi.
    await log.step("GIVEN sesi owner 'keluar' yang PERNAH membeli (preset 'keluar' = punyaSaham:true) terinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/')
    await expect(page).toHaveURL(/\/personal$/)

    await log.step('THEN bottom nav berisi TEPAT 2 link registry: Personal + Dashboard')
    const batangBawah = page.getByTestId(TEST_IDS.navigasi.batangBawah)
    await expect(batangBawah).toBeVisible()
    await expect(batangBawah.getByRole('link')).toHaveCount(2)
    await expect(batangBawah.getByRole('link', { name: LABEL_PERSONAL })).toBeVisible()
    await expect(batangBawah.getByRole('link', { name: LABEL_DASHBOARD })).toBeVisible()

    await log.step('AND item aktif = Personal (landing), Dashboard TANPA aria-current')
    await expect(batangBawah.getByRole('link', { name: LABEL_PERSONAL })).toHaveAttribute('aria-current', 'page')
    await expect(batangBawah.getByRole('link', { name: LABEL_DASHBOARD })).not.toHaveAttribute('aria-current')
  })

  test('[P1] icon Keluar di header mobile → Dialog konfirmasi → sesi berakhir kembali ke /login', async ({ page, context, apiRequest }) => {
    // Dialog reka-ui headless: aktivasi keyboard lebih andal daripada klik
    // pointer (tests/README Troubleshooting). Klik/Enter dini bisa kalah race
    // hidrasi Vue → recurse sampai kondisi tercapai (pola auth-landing).
    await log.step("GIVEN sesi 'coo' terinjeksikan membuka permukaan ber-nav /dashboard")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('WHEN menunggu hidrasi Vue selesai (klik pada DOM pra-hidrasi tidak pernah membawa handler — dialog tak terbuka)')
    await page.waitForFunction(() => {
      try {
        const app = (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp
        return typeof app === 'function' && app().isHydrating === false
      } catch {
        return false
      }
    }, { timeout: BATAS_RECURSE_KELUAR_MS })

    await log.step('WHEN menekan icon Keluar di header ringkas')
    await page.getByTestId(TEST_IDS.navigasi.tombolKeluarMobile).click()

    await log.step('THEN Dialog konfirmasi tampil dengan pilihan Batal')
    const dialog = page.getByTestId(TEST_IDS.navigasi.dialogKeluar)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Batal' })).toBeVisible()

    await log.step('WHEN konfirmasi Keluar')
    await dialog.getByRole('button', { name: 'Keluar' }).click()

    await log.step('THEN kembali ke /login — sesi berakhir')
    await expect(page).toHaveURL(/\/login/)

    await log.step('AND permukaan terproteksi tak lagi terjangkau (sesi benar-benar mati)')
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('E2E Story 1.7 — navigasi registry-driven desktop ≥lg (UX-DR14)', () => {
  test.use({ viewport: VIEWPORT_DESKTOP })

  test('[P1] coo desktop: footer sidebar memuat chip email + Keluar → sesi berakhir kembali ke /login', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'coo' (email sintetis unik) terinjeksikan membuka permukaan ber-nav /dashboard")
    const emailUji = emailSintetisUji()
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailUji })
    await context.addCookies(cookies)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('AND footer sidebar memuat chip email sesi + tombol Keluar (keputusan owner 2026-09-21)')
    const sidebar = page.getByTestId(TEST_IDS.navigasi.sidebar)
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText(emailUji)).toBeVisible()
    const tombolKeluar = sidebar.getByTestId(TEST_IDS.navigasi.tombolKeluar)
    await expect(tombolKeluar).toBeVisible()

    await log.step('WHEN menunggu hidrasi Vue selesai lalu menekan tombol Keluar')
    await page.waitForFunction(() => {
      try {
        const app = (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp
        return typeof app === 'function' && app().isHydrating === false
      } catch {
        return false
      }
    }, { timeout: BATAS_RECURSE_KELUAR_MS })
    await tombolKeluar.click()

    await log.step('THEN kembali ke /login — sesi berakhir')
    await expect(page).toHaveURL(/\/login/)

    await log.step('AND permukaan terproteksi tak lagi terjangkau (sesi benar-benar mati)')
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('[P1] coo desktop: sidebar 4 item + ketuk logo → landing role /order-queue', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'coo' terinjeksikan membuka permukaan ber-nav /dashboard")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo', email: emailSintetisUji() })
    await context.addCookies(cookies)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('THEN sidebar kiri tampil berisi TEPAT 4 link registry coo (di-scope ke nav item — logo link di luar <nav>, semantik link utuh)')
    const sidebar = page.getByTestId(TEST_IDS.navigasi.sidebar)
    await expect(sidebar).toBeVisible()
    const navItem = sidebar.getByRole('navigation')
    await expect(navItem.getByRole('link')).toHaveCount(ITEM_NAV_COO.length)
    for (const label of ITEM_NAV_COO) {
      await expect(navItem.getByRole('link', { name: label })).toBeVisible()
    }

    await log.step('AND item halaman aktif di sidebar ditandai aria-current="page" (review Story 1.7 #10)')
    await expect(navItem.getByRole('link', { name: LABEL_DASHBOARD })).toHaveAttribute('aria-current', 'page')
    await log.step('AND logo sidebar memakai aset logo-app (varian app — keputusan owner 2026-09-21)')
    await expect(sidebar.locator('img')).toHaveAttribute('src', '/logo-app.png')


    await log.step('WHEN menekan logo di sidebar (link asli — ketuk → landing role)')
    await sidebar.getByTestId(TEST_IDS.login.brandLogo).click()

    await log.step('THEN kembali ke landing role coo /order-queue')
    await expect(page).toHaveURL(/\/order-queue$/)
  })
})
