/**
 * SCAFFOLD ATDD RED-PHASE — Story 1.2 "Autentikasi Akun Google & Halaman Login".
 * Kontrak test design: `1-E2E-002` (subset) + R-003. Semua test dibungkus
 * `test.skip()` (TDD RED) dan diaktifkan satu per satu oleh tugas green-phase;
 * setiap test diberi komentar "GAGAL saat red: ..." yang menjelaskan mengapa
 * ia harus gagal sebelum implementasi ada.
 *
 * Cakupan OTOMASI: proteksi rute SSR, redirect root→login, landing map per
 * role (coo→/antrian-beli, pemegang_saham→/dashboard, tanpa_saham & keluar→
 * /personal, calon_owner→/status-pendaftaran), badge status + alasan penolakan
 * (UX-DR4: by text, bukan warna), dan jalur akun Google belum terhubung.
 * OAuth Google ASLI (klik CTA + callback, termasuk skenario error callback)
 * sengaja TIDAK diotomasi — label CTA belum dipinkan dan OAuth live tidak
 * didorong headless; tetap diverifikasi lewat smoke manual AR-3 di luar
 * suite otomatis ini.
 *
 * Sesi uji: cookie dimintakan via helper `mintSesiPemilik`
 * (POST /api/test/login, triple-guard dev-only) lalu diinjeksikan eksplisit
 * lewat `context.addCookies(...)` — deviasi tercatat dari fixture authToken
 * karena `manageAuthToken` masih stub (lihat fixture_needs workflow).
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
  { status: 'diajukan', userIdentifier: 'calon-diajukan' },
  { status: 'kedaluwarsa', userIdentifier: 'calon-kedaluwarsa' },
] as const

test.describe('E2E Story 1.2 — autentikasi Google & halaman login (1-E2E-002 subset + R-003)', () => {
  test.skip('[P0] halaman terproteksi tanpa sesi dialihkan ke halaman login', async ({ page }) => {
    // GAGAL saat red: middleware `server/middleware/auth-guard.ts` belum ada,
    // jadi goto dokumen SSR dijawab 404/kerangka 1.1, bukan redirect /login.
    await log.step('GIVEN pengunjung tanpa cookie sesi')
    await log.step('WHEN membuka langsung tiap halaman terproteksi')
    for (const halaman of HALAMAN_TERPROTEKSI) {
      await page.goto(halaman)
      await log.step(`THEN ${halaman} dialihkan ke /login (proteksi SSR seragam)`)
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test.skip('[P0] pengunjung baru di root dialihkan ke login dengan lockup lengkap', async ({ page }) => {
    // GAGAL saat red: `app/pages/index.vue` masih kerangka Story 1.1 dan
    // `app/pages/login.vue` belum ada — redirect, brand logo, tagline, dan
    // CTA Google belum dirender.
    await log.step('GIVEN pengunjung baru tanpa sesi')
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /login dengan lockup lengkap')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId(TEST_IDS.login.brandLogo)).toBeVisible()
    await expect(page.getByText('Sip the taste, dip the soul')).toBeVisible()
    // CTA kehadiran saja — JANGAN diklik (OAuth asli = smoke manual AR-3).
    const cta = page.getByRole('button', { name: /google/i })
    await expect(cta).toHaveCount(1)
  })

  test.skip('[P1] login COO dialandingkan ke antrian beli', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: endpoint minting /api/test/login dan resolver landing
    // per role belum ada — sesi tidak bisa dibentuk, root masih kerangka 1.1.
    await log.step("GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /antrian-beli (UX-DR19: state kosong)')
    await expect(page).toHaveURL(/\/antrian-beli$/)
    await expect(page.getByText('Antrian Beli')).toBeVisible()
  })

  test.skip('[P1] login pemegang saham dialandingkan ke dashboard', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: endpoint minting + resolver landing belum ada.
    await log.step("GIVEN sesi pemegang saham sintetis dimintakan lalu diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test.skip('[P1] login owner tanpa saham dan keluar dialandingkan ke halaman personal', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: endpoint minting + resolver landing (tanpa_saham &
    // keluar → /personal) belum ada.
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

  test.skip('[P1] calon owner ditolak melihat badge status dan alasan di halaman status pendaftaran', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: halaman /status-pendaftaran beserta badge status dan
    // blok alasan penolakan (UX-DR4: assert by text, bukan warna) belum ada.
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
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText('Ditolak')
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.alasanPenolakan)).toContainText(ALASAN_SINTETIS)
  })

  test.skip('[P1] non-calon yang membuka /status-pendaftaran langsung dialihkan ke landing role-nya', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: proteksi halaman status (khusus calon owner) belum ada.
    await log.step("GIVEN sesi pemegang saham (bukan calon) sudah diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka /status-pendaftaran secara langsung')
    await page.goto('/status-pendaftaran')
    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test.skip('[P1] akun Google belum terhubung kembali ke login dengan pesan arahan', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: jalur `state=unlinked` dan blok pesan arahan belum ada.
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

  test.skip('[P2] calon owner diajukan dan kedaluwarsa juga dialandingkan ke halaman status', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: resolver landing calon owner (diajukan/kedaluwarsa →
    // /status-pendaftaran) belum ada.
    for (const { status, userIdentifier } of STATUS_CALON_KE_STATUS) {
      await log.step(`GIVEN sesi calon owner berstatus '${status}' sudah diinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier, status })
      await context.addCookies(cookies)
      await log.step('WHEN membuka root aplikasi')
      await page.goto('/')
      await log.step('THEN dialandingkan ke /status-pendaftaran')
      await expect(page).toHaveURL(/\/status-pendaftaran$/)
    }
  })
})
