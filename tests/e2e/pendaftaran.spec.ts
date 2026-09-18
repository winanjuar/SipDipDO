/**
 * ATDD GREEN-PHASE — Story 1.4 "Pendaftaran Owner Mandiri & Status" (E2E only).
 *
 * Test red-phase telah diaktifkan (un-skip) pada tugas green-phase bersama
 * implementasinya (spec Story 1.4). Given-When-Then + log.step + prioritas.
 *
 * PENYESUAIAN LABEL CTA (riwayat): asumsi red-phase "Daftar sebagai Owner"
 * → mockup UX terpin "Daftar dengan Akun Google" (green-phase) → "Daftar"
 * (re-negotiasi copy manual oleh owner pasca-uji manual, 2026-09-18 —
 * judul "Jadilah Pemilik" + sub-copy baru + footer disembunyikan).
 *
 * Non-negotiable tetap dari kontrak UX: route halaman = `/pendaftaran`;
 * TANPA textbox /referral/i; sukses submit → redirect `/status-pendaftaran`
 * + badge by-text "Diajukan".
 *
 * NON-DUPLIKASI (disengaja): idempotensi duplikat nyata (200 baris sama,
 * tanpa mutasi) terpin di pendaftaran.api.spec.ts di level wire; backend
 * idempotent TIDAK pernah memproduksi 409. Test error-path di file ini
 * men-stub 409 semata untuk mensimulasikan jalur render pesan error
 * envelope di UI (matriks I/O: "gagal → pesan envelope tampil di dekat
 * CTA, region aria-live").
 *
 * Sesi uji: `mintSesiPemilik` (POST /api/test/login, triple-guard dev-only)
 * + `context.addCookies(...)` seperti auth-landing.spec.ts — deviasi tercatat
 * dari fixture authToken agar tiap test memegang sesi userIdentifier-nya
 * sendiri secara eksplisit. Mandate playwright-utils: `test` HANYA dari
 * ../support/merged-fixtures; observasi/stub via `interceptNetworkCall`
 * (dideklarasikan SEBELUM page.goto — network-first); klik yang bergantung
 * hidrasi Vue dibungkus `recurse` (pola smoke.ui.spec.ts — dev server
 * menghidrasi belakangan, klik dini tidak membawa handler); `log.step` bukan
 * console.log; asersi web-first auto-retry; tanpa waitForTimeout; tanpa
 * page.route; `skipNetworkMonitoring` hanya untuk scaffold stub 4xx/5xx.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Route halaman pendaftaran publik — terpin UX (mockup key-pendaftaran-profile). */
const HALAMAN_PENDAFTARAN = '/pendaftaran'

/** Status HTTP yang dipakai file ini — tanpa magic number (gaya pendaftaran.api.spec.ts). */
const STATUS_CREATED = 201

/** Tempo recurse hidrasi Vue di dev server (milidetik): iterasi dievaluasi
 *  ulang tiap 500ms; klik submit menunggu maksimal 30s, pesan error stub 15s. */
const INTERVAL_RECURSE_MS = 500
const BATAS_RECURSE_SUBMIT_MS = 30_000
const BATAS_RECURSE_PESAN_MS = 15_000

/** Email sintetis unik pola mint dev-only (prefix terkunci agar tak pernah
 *  menimpa baris non-sintetis — pola pendaftaran.api.spec.ts). Dipakai test
 *  yang meng-assert 201: email unik menjamin POST membuat baris BARU pada
 *  setiap run (email deterministik mint membuat rerun menjawab 200 idempoten
 *  dan mematahkan kontrak "201 saat baris baru dibuat"). */
const emailSintetisUji = (): string => {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

test.describe('E2E Story 1.4 — pendaftaran owner mandiri & status (ATDD GREEN PHASE)', () => {
  test('[P0] halaman pendaftaran publik render tanpa sesi: CTA tampil, tanpa input referral', async ({ page }) => {
    await log.step('GIVEN pengunjung tanpa sesi membuka link publik pendaftaran')
    await page.goto(HALAMAN_PENDAFTARAN)

    await log.step('WHEN halaman pendaftaran ter-render')
    await log.step('THEN CTA "Daftar" tampil (by-role; label hasil re-negotiasi copy owner 2026-09-18)')
    await expect(page.getByRole('button', { name: 'Daftar' })).toBeVisible()

    await log.step('AND form TANPA field referral (AC1: tanpa input referral)')
    await expect(page.getByRole('textbox', { name: /referral/i })).toHaveCount(0)
  })

  test('[P0] submit pendaftaran via akun Google → POST /api/pendaftaran → redirect status + badge Diajukan', async ({
    page,
    context,
    apiRequest,
    interceptNetworkCall,
    recurse,
  }) => {
    // Kontrak 201 = baris BARU dibuat → mint dengan email sintetis UNIK agar
    // rerun tidak menjawab 200 idempoten (lihat catatan emailSintetisUji).
    await log.step("GIVEN sesi akun Google 'unlinked' (belum punya baris owner) sudah diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked', email: emailSintetisUji() })
    await context.addCookies(cookies)

    await log.step('AND spy POST /api/pendaftaran dideklarasikan SEBELUM navigasi (network-first)')
    const pendaftaranCall = interceptNetworkCall({ url: '**/api/pendaftaran', method: 'POST' })
    // Redam penolakan dini spy (timeout waitForRequest saat hidrasi lambat)
    // agar tidak jadi unhandled rejection — await asli tetap melempar bila
    // POST benar-benar tidak pernah terkirim.
    pendaftaranCall.catch(() => {})

    await log.step('WHEN membuka halaman pendaftaran lalu KLIK CTA "Daftar" — satu-satunya pemicu tulis data (keputusan owner 2026-09-18: kunjungan tidak pernah menulis)')
    await page.goto(HALAMAN_PENDAFTARAN)
    // Hidrasi Vue di dev server = eventual-consistent → recurse (pola
    // smoke.ui.spec.ts): klik diulang sampai redirect terjadi — klik sebelum
    // hidrasi tidak membawa handler. Spy jangan di-await DI DALAM loop
    // (promise waitForRequest memblokir iterasi sampai timeout) — URL jadi
    // sinyal berhenti; spy di-await setelahnya.
    await recurse(
      async () => {
        if (page.url().includes('/status-pendaftaran')) return true
        try {
          await page.getByRole('button', { name: 'Selesaikan Pendaftaran' }).click()
        } catch {
          // Klik kalah race terhadap redirect — dievaluasi ulang iterasi berikutnya.
        }
        return page.url().includes('/status-pendaftaran')
      },
      selesai => selesai === true,
      { timeout: BATAS_RECURSE_SUBMIT_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu hidrasi Vue: CTA mengirim POST lalu redirect' },
    )

    await log.step('THEN panggilan pendaftaran terkirim (201)')
    const { status } = await pendaftaranCall
    expect(status).toBe(STATUS_CREATED)

    await log.step('AND dialihkan (hard navigation + flag toast ?daftar=berhasil) ke /status-pendaftaran dengan badge Diajukan')
    // Hard navigation membawa query flag toast — anchor $ diizinkan optional
    // query; flag dibersihkan onMounted (race) jadi tak di-pin.
    await expect(page).toHaveURL(/\/status-pendaftaran(\?.*)?$/, { timeout: BATAS_RECURSE_SUBMIT_MS })
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toContainText('Diajukan')
  })

  test('[P0] badge Diajukan tampil dengan aria-live polite di halaman status', async ({
    page,
    context,
    apiRequest,
  }) => {
    // Fokus: varian Diajukan + aria-live (varian Ditolak+alasan sudah hijau di
    // auth-landing.spec.ts — tidak diduplikasi di sini).
    await log.step("GIVEN sesi calon owner berstatus 'diajukan' sudah diinjeksikan")
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'calon-diajukan', status: 'diajukan' })
    await context.addCookies(cookies)

    await log.step('WHEN membuka halaman status pendaftaran')
    await page.goto('/status-pendaftaran')

    await log.step('THEN badge berteks Diajukan tampil (by text, bukan warna)')
    const badge = page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)
    await expect(badge).toContainText('Diajukan')

    await log.step('AND badge mengumumkan perubahan via aria-live polite')
    await expect(badge).toHaveAttribute('aria-live', 'polite')
  })

  test(
    '[P1] gagal submit (stub 409) → pesan error envelope tampil di dekat CTA dengan aria-live polite',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, context, apiRequest, interceptNetworkCall, recurse }) => {
      // BUKAN kontrak duplikat — backend idempotent 200 tidak pernah
      // memproduksi 409 (idempotensi terpin di pendaftaran.api.spec.ts).
      // Stub 409 di level jaringan murni mensimulasikan jalur gagal untuk
      // memverifikasi render pesan error envelope di UI (matriks I/O:
      // "gagal → pesan envelope tampil di dekat CTA, region aria-live,
      // state dipertahankan"). Opts-out network monitoring karena stub 4xx.
      await log.step("GIVEN sesi akun Google 'unlinked' sudah diinjeksikan")
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'unlinked' })
      await context.addCookies(cookies)

      await log.step('AND stub konflik duplikat dideklarasikan SEBELUM navigasi (network-first)')
      const duplikatCall = interceptNetworkCall({
        url: '**/api/pendaftaran',
        method: 'POST',
        fulfillResponse: { status: 409, body: { message: 'Email ini sudah terdaftar' } },
      })

      await log.step('WHEN membuka halaman pendaftaran lalu submit hingga halaman menampilkan kegagalan')
      await page.goto(HALAMAN_PENDAFTARAN)
      // Label CTA "Daftar" = re-negotiasi copy owner 2026-09-18 (lihat header file).
      // Hidrasi Vue di dev server = eventual-consistent → recurse (pola
      // smoke.ui.spec.ts): klik diulang sampai pesan error envelope tampil.
      await recurse(
        async () => {
          await page.getByRole('button', { name: 'Selesaikan Pendaftaran' }).click()
          return page.getByText(/sudah terdaftar/i).isVisible()
        },
        tampil => tampil === true,
        { timeout: BATAS_RECURSE_PESAN_MS, interval: INTERVAL_RECURSE_MS, log: 'Menunggu hidrasi Vue: pesan error envelope tampil' },
      )

      await log.step('THEN POST stub teramati dan pesan error envelope tampil di dekat CTA')
      await duplikatCall
      const pesanError = page.getByText(/sudah terdaftar/i)
      await expect(pesanError).toBeVisible()

      await log.step('AND region pesan error mengumumkan perubahan via aria-live polite (matriks I/O)')
      await expect(pesanError).toHaveAttribute('aria-live', 'polite')
    },
  )

  test('[P1] mesin status halaman: calon → /status-pendaftaran, non-calon → landing role-nya', async ({
    page,
    context,
    apiRequest,
  }) => {
    // Cakupan matriks I/O spec (baris redirect): "Sesi calon buka
    // /pendaftaran → redirect /status-pendaftaran" dan "Sesi owner/COO →
    // redirect LANDING_PATH[role]" — keputusan resolver /api/landing
    // dikonsumsi halaman saat SSR.
    await log.step('GIVEN sesi calon owner (diajukan) sudah diinjeksikan')
    const cookieCalon = await mintSesiPemilik(apiRequest, { userIdentifier: 'calon-diajukan', status: 'diajukan' })
    await context.addCookies(cookieCalon)

    await log.step('WHEN membuka /pendaftaran')
    await page.goto(HALAMAN_PENDAFTARAN)

    await log.step('THEN dialihkan ke /status-pendaftaran (LANDING_PATH calon)')
    await expect(page).toHaveURL(/\/status-pendaftaran$/)
    await expect(page.getByTestId(TEST_IDS.statusPendaftaran.badgeStatus)).toBeVisible()

    await log.step('GIVEN sesi COO sudah diinjeksikan (menimpa sesi calon)')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.clearCookies()
    await context.addCookies(cookieCoo)

    await log.step('WHEN membuka /pendaftaran')
    await page.goto(HALAMAN_PENDAFTARAN)

    await log.step('THEN dialihkan ke landing role COO (/antrian-beli)')
    await expect(page).toHaveURL(/\/antrian-beli$/)
  })
})
