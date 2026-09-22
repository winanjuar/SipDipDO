/**
 * ATDD GREEN-PHASE — Story 1.2 "Autentikasi Akun Google & Halaman Login".
 * Kontrak test design: `1-E2E-002` (subset) + R-003. Test dirancang red-phase
 * (test.skip) lalu diaktifkan pada tugas green-phase bersama implementasinya;
 * seluruh asersi ter-pin dari red-phase tidak berubah.
 *
 * Cakupan OTOMASI: proteksi rute SSR, redirect root→login, landing map per
 * role (coo→/order-queue, pemegang_saham→/dashboard, tanpa_saham & keluar→
 * /personal, calon_owner→/registration-status), badge status + alasan penolakan
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
 * Catatan mandate playwright-utils: navigasi mayoritas spec ini adalah
 * dokumen SSR (redirect diputuskan server-side saat request), tanpa
 * panggilan API client-side yang layak di-spy → `interceptNetworkCall`
 * tidak dipakai; asersi web-first (toHaveURL / toBeVisible / toContainText)
 * auto-retry. Pengecualian [P2] tautan pendaftaran: klik CTA "Daftar" di
 * dev server menunggu hidrasi Vue → `recurse`, dan navigasi klien anonim
 * ke /register menghasilkan 401 /api/landing yang SAH (ditangkap
 * halaman) → anotasi `skipNetworkMonitoring`; tanpa waitForTimeout.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Email sintetis unik pola mint dev-only (prefix terkunci agar tak pernah
 *  menimpa baris non-sintetis — pola pendaftaran.api.spec.ts; dipakai bila
 *  test AKAN membuat baris owner via klik CTA pendaftaran). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Tempo recurse klik CTA di dev server (milidetik) — hidrasi Vue
 *  eventual-consistent, klik dini tidak membawa handler (pola
 *  pendaftaran.spec.ts). */
const INTERVAL_RECURSE_MS = 500
const BATAS_RECURSE_DAFTAR_MS = 15_000

/** Halaman terproteksi (landing map ter-pin) — proteksi SSR diharapkan seragam. */
const HALAMAN_TERPROTEKSI = ['/dashboard', '/personal', '/order-queue', '/registration-status'] as const

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
    // Tagline + CTA "Masuk" = renegosiasi copy user 2026-09-17 (lihat Spec
    // Change Log 1.2): teks "Sip & Dip" di bawah logo dihapus, tagline
    // lowercase, CTA tidak lagi menyebut "Google".
    await expect(page.getByText('sip the taste, dip the soul')).toBeVisible()
    // CTA kehadiran + target sentuh ≥44px (UX-DR2) — JANGAN diklik (OAuth
    // asli = smoke manual AR-3). exact: true agar "Masuk" tidak tertukar
    // dengan tombol devtools.
    const cta = page.getByRole('button', { name: 'Masuk', exact: true })
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

    await log.step('AND penanda ?error= ditranslasi menjadi res=error (query param paten hanya res)')
    await expect(page).toHaveURL(/\/login\?res=error$/)
  })

  test('[P1] login COO dialandingkan ke antrian beli', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN dialandingkan ke /order-queue (UX-DR19: state kosong)')
    await expect(page).toHaveURL(/\/order-queue$/)
    // by-role heading — judul halaman kini 'Order' (keputusan owner 2026-09-21)
    // substring yang sama (racy strict-mode violation antar browser).
    await expect(page.getByRole('heading', { name: 'Order' })).toBeVisible()
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
    await log.step('THEN dialandingkan ke /registration-status dengan badge Ditolak + alasan verbatim')
    await expect(page).toHaveURL(/\/registration-status$/)
    const badge = page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)
    await expect(badge).toContainText('Ditolak')
    // Pin varian token (UX-DR2: Ditolak = destructive) — teks tetap pembawa
    // makna utama (UX-DR4: by text, bukan warna).
    await expect(badge).toHaveClass(/bg-destructive/)
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.alasanPenolakan)).toContainText(ALASAN_SINTETIS)
  })

  test('[P1] non-calon yang membuka /registration-status langsung dialihkan ke landing role-nya', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham (bukan calon) sudah diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka /registration-status secara langsung')
    await page.goto('/registration-status')
    await log.step('THEN dialihkan ke landing role-nya /dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('[P1] akun Google belum terhubung kembali ke login dengan pesan arahan', async ({ page, context, apiRequest }) => {
    await log.step("GIVEN sesi 'unlinked' (Google tanpa baris owner) sudah diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked' })
    await context.addCookies(cookies)
    await log.step('WHEN membuka root aplikasi')
    await page.goto('/')
    await log.step('THEN kembali ke /login?res=unlinked dengan pesan arahan (copy re-negotiasi owner 2026-09-18)')
    await expect(page).toHaveURL(/\/login\?res=unlinked/)
    await expect(page.getByTestId(TEST_IDS.login.pesanUnlinked)).toContainText('Akun tidak ditemukan.')
    await expect(page.getByTestId(TEST_IDS.login.pesanUnlinked).getByRole('link', { name: 'Lakukan pendaftaran' })).toBeVisible()
  })

  test(
    '[P2] tautan pendaftaran dari login — anonim "Yuk Gabung!" & unlinked "Lakukan pendaftaran"',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, recurse }) => {
      // skipNetworkMonitoring: klik tautan = navigasi klien ke /register —
      // resolver /api/landing di browser anonim menjawab 401 envelope yang
      // DITANGKAP halaman (useAsyncData catch → mode anonim); 401 ini produk
      // sah, bukan bug jaringan.
      await log.step('GIVEN pengunjung anonim membuka halaman login')
      await page.goto('/login')

      await log.step('WHEN menekan tautan "Yuk Gabung!"')
      await page.getByTestId(TEST_IDS.login.tautanDaftar).click()

      await log.step('THEN mendarat di halaman pendaftaran publik')
      await expect(page).toHaveURL(/\/register$/)

      // Email unik WAJIB: email mint deterministik persona 'unlinked' dipakai
      // bersama test lain — test ini MENGKLIK CTA "Daftar" (Story 1.4) yang
      // MEMBUAT baris owner untuk email ini; email unik mencegah polusi
      // antar-test.
      await log.step("GIVEN sesi 'unlinked' dengan email sintetis UNIK kembali ke login dengan pesan arahan")
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailSintetisUji() })
      await context.addCookies(cookies)
      await page.goto('/login?res=unlinked')

      await log.step('WHEN menekan tautan "Lakukan pendaftaran" di dalam pesan arahan')
      await page.getByRole('link', { name: 'Lakukan pendaftaran' }).click()

      await log.step('THEN mendarat di halaman pendaftaran dengan presentasi FRESH — sesi sisa login gagal dianggap belum pernah OAuth (keputusan owner 2026-09-18)')
      await expect(page).toHaveURL(/\/register\?src=fresh$/, { timeout: 15_000 })
      await expect(page.getByRole('button', { name: 'Daftar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Selesaikan Pendaftaran' })).toHaveCount(0)
      await expect(page.getByText('Akun Google Anda sudah terhubung')).toHaveCount(0)

      await log.step('AND kunjungan tetap TANPA tulisan data — cek CTA membuka modal T&C (tanpa melanjutkan)')
      // Klik tautan juga menunggu hidrasi → recurse sampai modal terbuka.
      await recurse(
        async () => {
          if (await page.getByTestId(TEST_IDS.pendaftaran.modalSyarat).isVisible()) return true
          try {
            await page.getByTestId(TEST_IDS.pendaftaran.tautanSyarat).click()
          } catch {
            // Klik kalah race hidrasi — dievaluasi ulang iterasi berikutnya.
          }
          return page.getByTestId(TEST_IDS.pendaftaran.modalSyarat).isVisible()
        },
        terbuka => terbuka === true,
        { timeout: BATAS_RECURSE_DAFTAR_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu hidrasi Vue: tautan T&C membuka modal' },
      )
      await expect(page.getByTestId(TEST_IDS.pendaftaran.tombolLanjut)).toBeDisabled()
      await page.getByTestId(TEST_IDS.pendaftaran.tombolBatal).click()

      await log.step('WHEN OAuth "selesai" — sesi unlinked di-injeksikan ulang + navigasi ke callback polos (simulasi kembali dari Google; OAuth asli = smoke manual)')
      const cookiesSelesai = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailSintetisUji() })
      await context.clearCookies()
      await context.addCookies(cookiesSelesai)
      // Target callback OAuth = '/register' TANPA penanda ?src=fresh —
      // inilah pembeda mode terhubung vs fresh.
      await page.goto('/register')

      await log.step('THEN kini mode TERHUBUNG: status + CTA "Selesaikan Pendaftaran"')
      await expect(page.getByText('Akun Google Anda sudah terhubung — tinggal satu langkah lagi.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Selesaikan Pendaftaran' })).toBeVisible()

      await log.step('WHEN menekan CTA "Selesaikan Pendaftaran" — persetujuan T&C pra-OAuth tersimpan → TANPA modal, langsung POST')
      // Flag persetujuan = hasil konfirmasi modal yang dilakukan user SEBELUM
      // OAuth di journey nyata (kunci kontrak pendaftaran.vue).
      await page.evaluate(() => sessionStorage.setItem('snd-dash.pendaftaran-syarat-setuju', '1'))
      await recurse(
        async () => {
          if (page.url().includes('/registration-status')) return true
          try {
            await page.getByRole('button', { name: 'Selesaikan Pendaftaran' }).click()
          } catch {
            // Klik kalah race hidrasi — dievaluasi ulang iterasi berikutnya.
          }
          return page.url().includes('/registration-status')
        },
        selesai => selesai === true,
        { timeout: BATAS_RECURSE_DAFTAR_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu hidrasi Vue: CTA mengirim POST lalu redirect' },
      )

      await log.step('THEN dialihkan ke status pendaftaran dengan badge Diajukan (hard navigation + flag toast)')
      await expect(page).toHaveURL(/\/registration-status(\?.*)?$/, { timeout: 15_000 })
      await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText('Diajukan')
    },
  )

  test('[P2] calon owner diajukan dan kedaluwarsa juga dialandingkan ke halaman status', async ({ page, context, apiRequest }) => {
    for (const { status, userIdentifier, labelBadge } of STATUS_CALON_KE_STATUS) {
      await log.step(`GIVEN sesi calon owner berstatus '${status}' sudah diinjeksikan`)
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier, status })
      await context.addCookies(cookies)
      await log.step('WHEN membuka root aplikasi')
      await page.goto('/')
      await log.step('THEN dialandingkan ke /registration-status dengan badge per status')
      await expect(page).toHaveURL(/\/registration-status$/)
      // Pin teks badge per status (UX-DR4: by text); status non-ditolak tidak
      // merender blok alasan penolakan.
      await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText(labelBadge)
      await expect(page.getByTestId(TEST_IDS.statusPendaftaran.alasanPenolakan)).toHaveCount(0)
    }
  })

  test('[P2] alert "Masuk berhasil." tampil SEKALI di ATAS landing pertama, auto-hilang 3 detik (permintaan owner)', async ({ page, context, apiRequest }) => {
    // Kontrak flag: kunci sessionStorage milik app/composables/useSekaliAlert.ts
    // (halaman login menandai sebelum signIn; landing pertama mengonsumsi).
    const KUNCI_FLAG_MASUK = 'snd-dash.alert-masuk-berhasil'
    await log.step("GIVEN sesi COO sudah diinjeksikan di landing /order-queue")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/order-queue')

    await log.step('AND flag alert masuk ditandai (simulasi halaman login pre-signIn)')
    await page.evaluate(kunci => sessionStorage.setItem(kunci, '1'), KUNCI_FLAG_MASUK)

    await log.step('WHEN halaman landing dimuat ulang (mount pertama dengan flag)')
    await page.reload()
    await expect(page.getByText('Masuk berhasil.')).toBeVisible()

    await log.step('WHEN reload kedua (flag sudah dikonsumsi)')
    await page.reload()

    await log.step('THEN alert TIDAK muncul lagi')
    await expect(page.getByText('Masuk berhasil.')).toHaveCount(0)
  })

  test('[P1] penutupan tenure COO memindahkan landing sesuai role baru', async ({ page, context, apiRequest }) => {
    // Verifikasi efek closeActiveCooTenures: persona 'coo' di-mint pada EMAIL
    // sewaan (gmail sintetis mint uji) sehingga baris ownernya terpisah dari persona 'coo'
    // deterministik yang dipakai suite lain (hindari race mint paralel dan
    // cache sesi .auth), lalu tenure-nya ditutup via re-mint cooAktif false.
    await log.step("GIVEN persona 'coo' dengan tenure aktif dialandingkan ke /order-queue")
    const cookiesCoo = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: 'uji.snddash.e2e.coo.sewa@gmail.com',
      cooAktif: true,
    })
    await context.addCookies(cookiesCoo)
    await page.goto('/')
    await expect(page).toHaveURL(/\/order-queue$/)

    await log.step('WHEN tenure COO ditutup (re-mint identifier sama, cooAktif false)')
    const cookiesNonCoo = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: 'uji.snddash.e2e.coo.sewa@gmail.com',
      cooAktif: false,
    })
    await context.addCookies(cookiesNonCoo)
    await page.goto('/')

    await log.step('THEN landing berpindah ke /dashboard (role pemegang saham)')
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
