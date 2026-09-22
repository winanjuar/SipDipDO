/**
 * ATDD — Story 1.6 "Verifikasi & Penolakan Pendaftar oleh COO" (E2E UI —
 * halaman /pendaftar):
 * - [P0] COO melihat calon lengkap & belum lengkap; tombol Verifikasi aktif
 *   HANYA untuk baris `profilLengkap` (UJ-6); Status Badge "Diajukan"
 *   berteks (peta sama dengan status-pendaftaran.vue — UX-DR2/DR4).
 * - [P0] Verifikasi dari UI → baris keluar dari daftar + server-truth via
 *   /api/landing (owner terverifikasi tanpa saham → /personal).
 * - [P0] Tolak via Dialog + textarea alasan (UX-DR20): kirim tidak aktif
 *   selama alasan kosong; dengan alasan → baris keluar + audit
 *   `pendaftaran-penolakan` memuat alasan apa adanya (server-truth).
 * - [P1] non-COO / tanpa sesi membuka /pendaftar → redirect (pola
 *   audit-trail.spec.ts).
 * - [P1] 409 STATUS_BERUBAH (stub) → pesan testid + daftar dimuat ulang.
 * - [P2] daftar kosong → empty state (prekondisi dideterministikkan helper
 *   dev-only `denganPendaftarKosong` — pola denganAuditKosong).
 *
 * Mandate playwright-utils: fetch daftar halaman ini terjadi DI SERVER
 * (useRequestFetch SSR — pola audit-trail.spec) sehingga tidak di-spy;
 * klik yang bergantung hidrasi Vue dibungkus `recurse` (pola
 * kelengkapan-profil.spec.ts); `log.step`; tanpa waitForTimeout.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Page } from '@playwright/test'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'
import { denganPendaftarKosong } from '../support/helpers/pendaftar-reset'
import {
  bacaAuditSemuaHalaman,
  emailSintetisUji,
  headerCookieDariMint,
  seedCalonLengkap,
} from '../support/helpers/pendaftar-uji'

/**
 * Tunggu hidrasi Vue selesai — penanda `data-terhidrasi="true"` pada elemen
 * halaman (pola tungguHidrasi kelengkapan-profil.spec.ts). Klik aksi HANYA
 * dilakukan setelah ini; hasilnya diasertifikan dengan expect auto-retrying
 * (toHaveCount/toBeVisible), bukan klik-berulang.
 */
async function tungguHidrasi(page: Page): Promise<void> {
  await expect(page.getByTestId(TEST_IDS.pendaftar.halaman)).toHaveAttribute('data-terhidrasi', 'true')
}

/**
 * Klik sekali dengan satu percobaan-ulang: elemen baris dapat lepas saat
 * re-render pasca-aksi (v-for diganti muatUlang) — kegagalan klem klik bukan
 * kegagalan produk.
 */
async function klikDenganUlang(tindakan: () => Promise<void>): Promise<void> {
  try {
    await tindakan()
  } catch {
    await tindakan().catch(() => {})
  }
}

/** Baris tabel milik calon dengan email tertentu (data-testid + filter teks). */
const barisCalon = (page: Page, email: string) =>
  page.getByTestId(TEST_IDS.pendaftar.baris).filter({ hasText: email })

test.describe('E2E Story 1.6 — halaman Pendaftar untuk COO', () => {
  test('[P0] COO melihat calon lengkap & belum lengkap — Verifikasi aktif hanya untuk yang lengkap (UJ-6)', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO terinjeksikan + dua calon diajukan (lengkap & belum lengkap)')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const lengkap = await seedCalonLengkap(apiRequest)
    const emailBelum = emailSintetisUji()
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailBelum,
    })

    await log.step('WHEN COO membuka /pendaftar')
    await page.goto('/pendaftar')

    await log.step('THEN kedua calon tampil sebagai baris dengan Status Badge "Diajukan" berteks')
    await expect(page.getByTestId(TEST_IDS.pendaftar.halaman)).toBeVisible()
    const barisLengkap = barisCalon(page, lengkap.email)
    const barisBelum = barisCalon(page, emailBelum)
    await expect(barisLengkap).toBeVisible()
    await expect(barisBelum).toBeVisible()
    await expect(barisLengkap.getByText('Diajukan', { exact: true })).toBeVisible()
    await expect(barisBelum.getByText('Diajukan', { exact: true })).toBeVisible()

    await log.step('AND badge Profil: "Lengkap" untuk baris lengkap, "Belum lengkap" untuk baris lain')
    await expect(barisLengkap.getByText('Lengkap', { exact: true })).toBeVisible()
    await expect(barisBelum.getByText('Belum lengkap', { exact: true })).toBeVisible()

    await log.step('AND tombol Verifikasi AKTIF hanya pada baris lengkap; Tolak aktif di keduanya')
    await expect(barisLengkap.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi)).toBeEnabled()
    await expect(barisBelum.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi)).toBeDisabled()
    await expect(barisLengkap.getByTestId(TEST_IDS.pendaftar.aksiTolak)).toBeEnabled()
    await expect(barisBelum.getByTestId(TEST_IDS.pendaftar.aksiTolak)).toBeEnabled()
  })

  test('[P0] Verifikasi dari UI → baris keluar dari daftar + server berubah (landing /personal)', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO + calon diajukan berprofil lengkap membuka /pendaftar')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email, cookies } = await seedCalonLengkap(apiRequest)
    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi pada baris itu diklik (pasca-hidrasi)')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi).click())

    await log.step('THEN baris hilang dari daftar dan pesan sukses tampil (expect auto-retrying)')
    await expect(baris).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('Pendaftar diverifikasi.')

    await log.step('AND server-truth: login berikutnya calon → landing /personal (bukan registration-status)')
    const landing = await apiRequest<{ path: string, role: string }>({
      method: 'GET',
      path: '/api/landing',
      headers: headerCookieDariMint(cookies),
    })
    expect(landing.status).toBe(200)
    expect(landing.body).toEqual({ path: '/personal', role: 'tanpa_saham' })
  })

  test('[P0] Tolak via Dialog: alasan wajib (kirim terkunci saat kosong), dengan alasan → baris keluar + audit memuat alasan apa adanya', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO + calon diajukan (profil lengkap) membuka /pendaftar')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)

    // Referensi id calon untuk asersi audit (server-truth, append-only).
    const cookieCooApi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<{ data: Array<{ id: string, email: string }> }>({
      method: 'GET',
      path: '/api/pendaftar',
      headers: headerCookieDariMint(cookieCooApi),
    })
    const target = daftar.body.data.find(baris => baris.email === email)
    expect(target).toBeDefined()

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Tolak pada baris itu diklik (pasca-hidrasi)')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiTolak).click())

    await log.step('THEN dialog tolak terbuka dan tombol kirim TIDAK aktif selama alasan kosong (UX-DR20)')
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogTolak)).toBeVisible()
    const inputAlasan = page.getByTestId(TEST_IDS.pendaftar.inputAlasan)
    await expect(inputAlasan).toHaveValue('')
    await expect(page.getByTestId(TEST_IDS.pendaftar.kirimTolak)).toBeDisabled()

    await log.step('WHEN alasan diisi lalu kirim diklik')
    const alasanCoo = `Dokumen rekening perlu diperiksa ulang (${faker.string.alphanumeric(4)}).`
    await inputAlasan.fill(alasanCoo)
    await expect(page.getByTestId(TEST_IDS.pendaftar.kirimTolak)).toBeEnabled()
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimTolak).click())

    await log.step('THEN baris hilang dari daftar dan pesan sukses tampil')
    await expect(baris).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('Pendaftar ditolak.')

    await log.step('AND server-truth: entry audit pendaftaran-penolakan memuat alasan APA ADANYA (baca lintas-halaman — DB dev bersama)')
    const audit = await bacaAuditSemuaHalaman(apiRequest)
    const entry = audit.find(e => e.action === 'pendaftaran-penolakan' && e.target === `owners:${target?.id}`)
    expect(entry).toBeDefined()
    expect(entry?.details.alasan).toBe(alasanCoo)
    expect(typeof entry?.details.hitunganPenolakan).toBe('number')
  })

  test('[P1] 409 STATUS_BERUBAH dari server → pesan testid tampil + daftar dimuat ulang (stub)', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 409 di-stub untuk memin kontrak UI race
    // (server asli sudah memin 409 di pendaftar.api.spec.ts) — bukan bug
    // jaringan.
    await log.step('GIVEN sesi COO + calon lengkap; endpoint keputusan DI-STUB 409 STATUS_BERUBAH')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
    // TIDAK di-await: promise ini baru resolve saat POST terjadi (pola
    // kelengkapan-profil.spec.ts) — await di sini = deadlock sebelum goto.
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 409,
        body: { code: 'STATUS_BERUBAH', message: 'Status pendaftar sudah berubah — muat ulang daftar.', details: {} },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi diklik (stub menjawab 409)')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi).click())

    await log.step('THEN pesan status-berubah tampil (aria-live region) dan daftar dimuat ulang — baris tetap terlihat')
    await expect(page.getByTestId(TEST_IDS.pendaftar.pesanStatusBerubah)).toContainText('Status pendaftar sudah berubah')
    await expect(baris).toBeVisible()
    await keputusanStub
  })

  test('[P0] non-COO membuka /pendaftar URL langsung → dialihkan ke landing role-nya', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi calon owner (non-COO) terinjeksikan')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailSintetisUji(),
    }))

    await log.step('WHEN membuka /pendaftar secara langsung')
    await page.goto('/pendaftar')

    await log.step('THEN dialihkan ke landing role-nya /registration-status')
    await expect(page).toHaveURL(/\/registration-status$/)
    await expect(page.getByTestId(TEST_IDS.pendaftar.halaman)).toHaveCount(0)
  })

  test('[P1] pengunjung tanpa sesi membuka /pendaftar → dialihkan ke /login', async ({ page }) => {
    await log.step('GIVEN pengunjung tanpa cookie sesi')
    await log.step('WHEN membuka /pendaftar secara langsung')
    await page.goto('/pendaftar')

    await log.step('THEN middleware auth-guard mengarahkan ke /login')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId(TEST_IDS.pendaftar.halaman)).toHaveCount(0)
  })

  test('[P2] daftar kosong menampilkan empty state', async ({ page, context, apiRequest }) => {
    // Prekondisi dideterministikkan: helper dev-only menghapus calon sintetis
    // `diajukan` (advisory lock antar project — pola denganAuditKosong;
    // catatan paralelisme di pendaftar-reset.ts). Baris non-sintetis tidak
    // pernah dihapus (kebijakan data) — bila DB dev masih memuat calon
    // `diajukan` nyata, prekondisi empty-state mustahil dicapai dan test
    // dilewati secara jujur (bukan asersi palsu).
    await denganPendaftarKosong(async ({ bersih }) => {
      test.skip(!bersih, 'DB dev memuat calon diajukan non-sintetis — empty-state tidak dapat dipin tanpa menyentuh data nyata.')

      await log.step('GIVEN sesi COO dan TIDAK ada calon `diajukan` di DB')
      await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))

      await log.step('WHEN COO membuka /pendaftar')
      await page.goto('/pendaftar')

      await log.step('THEN empty state tampil tanpa satu pun baris tabel')
      await expect(page.getByTestId(TEST_IDS.pendaftar.halaman)).toBeVisible()
      await expect(page.getByTestId(TEST_IDS.pendaftar.kosong)).toBeVisible()
      await expect(page.getByTestId(TEST_IDS.pendaftar.baris)).toHaveCount(0)
    })
  })
})
