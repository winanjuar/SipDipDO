/**
 * ATDD GREEN-PHASE — Story 1.2 "Autentikasi Akun Google & Halaman Login".
 * Kontrak test design: `1-E2E-002` (subset) + R-003. Test dirancang red-phase
 * (test.skip) lalu diaktifkan pada tugas green-phase bersama implementasinya;
 * seluruh asersi ter-pin dari red-phase tidak berubah.
 *
 * Cakupan OTOMASI: proteksi rute SSR, redirect root→login, landing map per
 * role (coo→/antrian-beli, pemegang_saham→/dashboard, tanpa_saham & keluar→
 * /personal, calon_owner→/status-pendaftaran), badge status + alasan penolakan
 * (UX-DR4: by text, bukan warna), jalur akun Google belum terhubung, dan
 * perilaku halaman login saat query `?error` (callback OAuth gagal — halaman
 * tetap ter-render dengan pemberitahuan netral). OAuth Google ASLI (klik CTA +
 * wiring callback live) sengaja TIDAK diotomasi — OAuth live tidak didorong
 * headless; tetap diverifikasi lewat smoke manual AR-3 di luar suite otomatis.
 *
 * Sesi uji: cookie dimintakan via helper `mintSesiPemilik`
 * (POST /api/test/login, triple-guard dev-only) lalu diinjeksikan eksplisit
 * lewat `context.addCookies(...)` — deviasi tercatat dari fixture authToken
 * agar tiap test memegang sesi userIdentifier-nya sendiri secara eksplisit.
 *
 * Catatan mandate playwright-utils: seluruh navigasi di spec ini adalah
 * dokumen SSR (redirect diputuskan server-side saat request), tidak ada
 * panggilan API client-side yang layak di-spy → `interceptNetworkCall` tidak
 * dipakai di sini. Semua asersi memakai web-first assertion (toHaveURL /
 * toBeVisible / toContainText) yang auto-retry, sehingga `recurse` tidak
 * diperlukan; tanpa waitForTimeout. Tidak ada test yang subjeknya error path
 * (jalur unlinked adalah redirect produk, bukan 4xx/5xx tersembunyi), sehingga
 * anotasi `skipNetworkMonitoring` tidak digunakan.
 */
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Halaman terproteksi (landing map ter-pin) — proteksi SSR diharapkan seragam. */
const HALAMAN_TERPROTEKSI = ['/dashboard', '/personal', '/antrian-beli', '/status-pendaftaran'] as const

/** Owner non-calon yang landing-nya halaman personal (UX landing map). */
const IDENTIFIER_PERSONAL = ['tanpa-saham', 'keluar'] as const

/** Alasan penolakan SINTETIS (kebijakan repo: tanpa data nyata di repo/uji). */
const ALASAN_SINTETIS = 'Dokumen belum lengkap — sintetis'

/** Status calon non-ditolak yang tetap dialandingkan ke halaman status. */
const STATUS_CALON_KE_STATUS = [
  { status: 'diajukan', userIdentifier: 'calon-diajukan', labelBadge: 'Diajukan' },
  { status: 'kedaluwarsa', userIdentifier: 'calon-kedaluwarsa', labelBadge: 'Kedaluwarsa' },
] as const

test.describe('E2E Story 1.2 — autentikasi Google & halaman login (1-E2E-002 subset + R-003)', () => {
  test('[P0] halaman terproteksi tanpa sesi dialihkan ke halaman login', async ({ page }) => {
    await log.step('GIVEN pengunjung tanpa cookie sesi')
    await log.step('WHEN membuka langsung tiap halaman terproteksi')
    for (const halaman of HALAMAN_TERPROTEKSI) {
      await page.goto(halaman)
      await log.step(`THEN ${halaman} dialihkan ke /login (proteksi SSR seragam)`)
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test('[P0] pengunjung baru di root dialihkan ke login dengan lockup lengkap', async ({ page }) => {
    await log.step('GIVEN pengunjung baru tanpa sesi')
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /login dengan lockup lengkap')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId(TEST_IDS.login.brandLogo)).toBeVisible()
    // Lockup 80px terpin (UX-DR3) — tinggi render logo = 80px.
    await expect(page.getByTestId(TEST_IDS.login.brandLogo).locator('img')).toHaveCSS('height', '80px')
    await expect(page.getByText('Sip the taste, dip the soul')).toBeVisible()
    // CTA kehadiran + target sentuh ≥44px (UX-DR2) — JANGAN diklik (OAuth
    // asli = smoke manual AR-3).
    const cta = page.getByRole('button', { name: /google/i })
    await expect(cta).toHaveCount(1)
    await expect(cta).toHaveCSS('height', '44px')
  })

  test('[P2] callback OAuth membawa error: login tetap ter-render dengan pemberitahuan netral', async ({ page }) => {
    // Matriks spec "OAuth gagal/dibatalkan": callback Google membawa error →
    // kembali ke /login tanpa crash, tanpa pesan menyesatkan. Wiring callback
    // Google LIVE tetap smoke manual AR-3; yang diotomasi = perilaku halaman
    // saat param error hadir.
    await log.step('GIVEN halaman login menerima query error dari callback OAuth')
    await log.step('WHEN /login dibuka dengan ?error=access_denied')
    await page.goto('/login?error=access_denied')

    await log.step('THEN halaman login ter-render utuh (tanpa crash)')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId(TEST_IDS.login.ctaGoogle)).toBeVisible()

    await log.step('AND pemberitahuan netral tampil tanpa pesan arahan unlinked yang menyesatkan')
    await expect(page.getByText('Percobaan masuk belum selesai — silakan coba lagi.')).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.login.pesanUnlinked)).toHaveCount(0)
  })

  test('[P1] login COO dialandingkan ke antrian beli', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /antrian-beli (UX-DR19: state kosong)')
    await expect(page).toHaveURL(/\/antrian-beli$/)
    // by-role heading — getByText('Antrian Beli') ambigu: NuxtRouteAnnouncer
    // mengumumkan document.title ("Antrian Beli — Sip & Dip") yang memuat
    // substring yang sama (racy strict-mode violation antar browser).
    await expect(page.getByRole('heading', { name: 'Antrian Beli' })).toBeVisible()
  })

  test('[P1] login pemegang saham dialandingkan ke dashboard', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham sintetis dimintakan lalu diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
    // by-role heading — lihat catatan ambiguity RouteAnnouncer di atas.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('[P1] login owner tanpa saham dan keluar dialandingkan ke halaman personal', async ({ page, context, apiRequest }) => {
    for (const userIdentifier of IDENTIFIER_PERSONAL) {
      await log.step(`GIVEN sesi '${userIdentifier}' dimintakan lalu diinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier })
      await context.addCookies(cookies)
      await log.step(`WHEN '${userIdentifier}' membuka root aplikasi`)
      await page.goto('/')
      await log.step('THEN dialandingkan ke /personal')
      await expect(page).toHaveURL(/\/personal$/)
    }
  })

  test('[P1] calon owner ditolak melihat badge status dan alasan di halaman status pendaftaran', async ({ page, context, apiRequest }) => {
    // UX-DR4: badge di-assert by TEXT (Ditolak), bukan warna.
    await log.step("GIVEN sesi calon owner berstatus 'ditolak' (alasan sintetis)")
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-ditolak',
      status: 'ditolak',
      alasanPenolakan: ALASAN_SINTETIS,
    })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /status-pendaftaran dengan badge Ditolak + alasan verbatim')
    await expect(page).toHaveURL(/\/status-pendaftaran$/)
    const badge = page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)
    await expect(badge).toContainText('Ditolak')
    // Pin varian token (UX-DR2: Ditolak = destructive) — teks tetap pembawa
    // makna utama (UX-DR4: by text, bukan warna).
    await expect(badge).toHaveClass(/bg-destructive/)
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.alasanPenolakan)).toContainText(ALASAN_SINTETIS)
  })

  test('[P1] non-calon yang membuka /status-pendaftaran langsung dialihkan ke landing role-nya', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham (bukan calon) sudah diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka /status-pendaftaran secara langsung')
    await page.goto('/status-pendaftaran')
    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] akun Google belum terhubung kembali ke login dengan pesan arahan', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'unlinked' (Google tanpa baris owner) sudah diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN kembali ke /login?state=unlinked dengan pesan arahan verbatim')
    await expect(page).toHaveURL(/\/login\?state=unlinked/)
    const PESAN_UNLINKED =
      'Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. ' +
      'Owner eksisting: hubungi COO untuk pencocokan email migrasi.'
    await expect(page.getByTestId(TEST_IDS.login.pesanUnlinked)).toContainText(PESAN_UNLINKED)
  })

  test('[P2] calon owner diajukan dan kedaluwarsa juga dialandingkan ke halaman status', async ({ page, context, apiRequest }) => {
    for (const { status, userIdentifier, labelBadge } of STATUS_CALON_KE_STATUS) {
      await log.step(`GIVEN sesi calon owner berstatus '${status}' sudah diinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier, status })
      await context.addCookies(cookies)
      await log.step('WHEN membuka root aplikasi')
      await page.goto('/')
      await log.step('THEN dialandingkan ke /status-pendaftaran dengan badge per status')
      await expect(page).toHaveURL(/\/status-pendaftaran$/)
      // Pin teks badge per status (UX-DR4: by text); status non-ditolak tidak
      // merender blok alasan penolakan.
      await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText(labelBadge)
      await expect(page.getByTestId(TEST_IDS.statusPendaftaran.alasanPenolakan)).toHaveCount(0)
    }
  })

  test('[P1] penutupan tenure COO memindahkan landing sesuai role baru', async ({ page, context, apiRequest }) => {
    // Verifikasi efek closeActiveCooTenures: persona 'coo' di-mint pada EMAIL
    // sewaan (domain uji) sehingga baris ownernya terpisah dari persona 'coo'
    // deterministik yang dipakai suite lain (hindari race mint paralel dan
    // cache sesi .auth), lalu tenure-nya ditutup via re-mint cooAktif false.
    await log.step("GIVEN persona 'coo' dengan tenure aktif dialandingkan ke /antrian-beli")
    const cookiesCoo = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: 'coo-sewa@uji.example.test',
      cooAktif: true,
    })
    await context.addCookies(cookiesCoo)
    await page.goto('/')
    await expect(page).toHaveURL(/\/antrian-beli$/)

    await log.step('WHEN tenure COO ditutup (re-mint identifier sama, cooAktif false)')
    const cookiesNonCoo = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: 'coo-sewa@uji.example.test',
      cooAktif: false,
    })
    await context.addCookies(cookiesNonCoo)
    await page.goto('/')

    await log.step('THEN landing berpindah ke /dashboard (role pemegang saham)')
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
