/**
 * ATDD — Story 1.6 "Verifikasi & Penolakan Pendaftar oleh COO" (E2E UI —
 * halaman /pendaftar) + hardening pasca-review (2026-09-22):
 * - [P0] COO melihat calon lengkap & belum lengkap; tombol Verifikasi aktif
 *   HANYA untuk baris `profilLengkap` (UJ-6); teks sisaField TERLIHAT di
 *   baris belum-lengkap (bukan hover-only); Status Badge "Diajukan" berteks
 *   (peta sama dengan registration-status.vue — UX-DR2/DR4).
 * - [P0] Verifikasi dari UI → baris keluar dari daftar + server-truth via
 *   /api/landing (owner terverifikasi tanpa saham → /personal).
 * - [P0] Tolak via Dialog + textarea alasan (UX-DR20): kirim tidak aktif
 *   selama alasan kosong; dengan alasan → baris keluar + audit
 *   `pendaftaran-penolakan` memuat alasan apa adanya (server-truth).
 * - [P1] non-COO / tanpa sesi membuka /pendaftar → redirect (pola
 *   audit-trail.spec.ts).
 * - [P1] Error envelope per kode (stub route, pola test 409): 409
 *   STATUS_BERUBAH → pesan testid + daftar dimuat ulang; 403 FORBIDDEN →
 *   pesan kewenangan permanen tanpa "coba lagi"; 404 TIDAK_DITEMUKAN →
 *   pesan + daftar dimuat ulang; 400 PROFILE_INCOMPLETE → pesan memuat
 *   field kurang berlabel Indonesia; 400 BAD_REQUEST → textarea
 *   `maxlength` PERSIS konstanta bersama + alert menampilkan
 *   details.masalah; 400 ALASAN_WAJIB → pesan alasan wajib
 *   (matriks #6, hardening 2026-09-22).
 * - [P1] guard `sedangMuatUlang` (matriks #8): klik Verifikasi kedua selama
 *   refresh berjalan (GET di-stub ber-delay) → TEPAT SATU POST terkirim dan
 *   pesan sukses bertahan.
 * - [P2] daftar kosong → empty state (prekondisi dideterministikkan helper
 *   dev-only `denganPendaftarKosong` — pola denganAuditKosong).
 *
 * Mandate playwright-utils: fetch daftar halaman ini terjadi DI SERVER
 * (useRequestFetch SSR — pola audit-trail.spec) sehingga tidak di-spy;
 * klik yang bergantung hidrasi Vue dibungkus `recurse` (pola
 * kelengkapan-profil.spec.ts); `log.step`; tanpa waitForTimeout.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Locator, Page } from '@playwright/test'
import { PANJANG_MAKS_ALASAN_PENOLAKAN } from '#shared/domain/identity'
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

/**
 * Alur verifikasi dua-langkah (renegotiasi owner 2026-09-23): klik aksi
 * Verifikasi → dialog konfirmasi terbuka → kirim dari dialog. Semua jalur
 * verifikasi UI wajib lewat sini — POST tidak pernah terkirim langsung
 * dari tombol baris.
 */
async function jalankanVerifikasi(page: Page, baris: Locator): Promise<void> {
  await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi).click())
  await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toBeVisible()
  await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimVerifikasi).click())
}

/** Jendela tahan refresh pada stub GET daftar (test guard sedangMuatUlang). */
const DELAY_MUAT_ULANG_STUB_MS = 500

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

    await log.step('AND teks sisaField TERLIHAT di baris belum-lengkap — berlabel Indonesia, bukan hover-only (hardening 2026-09-22)')
    await expect(barisBelum.getByText(/Field belum lengkap: .*Nama Lengkap/)).toBeVisible()
    await expect(barisBelum.getByText(/Nomor Rekening/)).toBeVisible()

    await log.step('AND tombol Verifikasi AKTIF hanya pada baris lengkap; Tolak aktif di keduanya')
    await expect(barisLengkap.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi)).toBeEnabled()
    await expect(barisBelum.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi)).toBeDisabled()
    await expect(barisLengkap.getByTestId(TEST_IDS.pendaftar.aksiTolak)).toBeEnabled()
    await expect(barisBelum.getByTestId(TEST_IDS.pendaftar.aksiTolak)).toBeEnabled()

    await log.step('AND urutan tombol dipin (owner 2026-09-23): Verifikasi(kiri) — Detail(link, tengah) — Tolak(merah, ujung kanan)')
    await expect(barisLengkap.getByRole('link', { name: 'Detail' })).toBeVisible()
    await expect(barisLengkap.getByRole('button')).toHaveText(['Verifikasi', 'Tolak'])
    await expect(barisLengkap.getByTestId(TEST_IDS.pendaftar.aksiTolak)).toHaveClass(/destructive/)
  })

  test('[P0] Verifikasi dari UI → baris keluar dari daftar + server berubah (landing /personal)', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO + calon diajukan berprofil lengkap membuka /pendaftar')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email, cookies } = await seedCalonLengkap(apiRequest)
    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi pada baris itu diklik → dialog konfirmasi terbuka (renegotiasi 2026-09-23)')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi).click())
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toContainText('dengan seksama')
    await expect(page.getByTestId(TEST_IDS.pendaftar.kirimVerifikasi)).toBeEnabled()

    await log.step('AND kirim diklik dari dialog konfirmasi')
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimVerifikasi).click())

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
    await jalankanVerifikasi(page, baris)

    await log.step('THEN pesan status-berubah tampil (aria-live region) dan daftar dimuat ulang — baris tetap terlihat')
    await expect(page.getByTestId(TEST_IDS.pendaftar.pesanStatusBerubah)).toContainText('Status pendaftar sudah berubah')
    await expect(baris).toBeVisible()
    await keputusanStub
  })

  test('[P1] 403 FORBIDDEN dari server (stub) → pesan kewenangan permanen TANPA "coba lagi"', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 403 di-stub untuk memin kontrak UI
    // envelope per-kode (hardening 2026-09-22) — bukan bug jaringan.
    await log.step('GIVEN sesi COO + calon lengkap; endpoint keputusan DI-STUB 403 FORBIDDEN')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 403,
        body: { code: 'FORBIDDEN', message: 'Kewenangan COO tidak berlaku pada saat keputusan disimpan.', details: {} },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi diklik (stub menjawab 403)')
    await jalankanVerifikasi(page, baris)

    await log.step('THEN pesan kewenangan tampil — PERMANEN, tanpa ajakan "coba lagi" (baris TIDAK dimuat ulang)')
    await expect(page.getByRole('alert')).toContainText('Kewenangan COO tidak berlaku')
    await expect(page.getByRole('alert')).not.toContainText('coba lagi')
    await keputusanStub
  })

  test('[P1] 404 TIDAK_DITEMUKAN dari server (stub) → pesan + daftar dimuat ulang', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 404 di-stub untuk memin kontrak UI
    // envelope per-kode (hardening 2026-09-22) — bukan bug jaringan.
    await log.step('GIVEN sesi COO + calon lengkap; endpoint keputusan DI-STUB 404 TIDAK_DITEMUKAN')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 404,
        body: { code: 'TIDAK_DITEMUKAN', message: 'Calon pendaftar tidak ditemukan.', details: {} },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi diklik (stub menjawab 404)')
    await jalankanVerifikasi(page, baris)

    await log.step('THEN pesan tidak-ditemukan tampil dan daftar DIMUAT ULANG — angka basi tidak tampil diam-diam')
    await expect(page.getByRole('alert')).toContainText('tidak ditemukan')
    await expect(baris).toBeVisible() // GET /api/pendaftar asli mengembalikan baris yang sama.
    await keputusanStub
  })

  test('[P1] 400 PROFILE_INCOMPLETE dari server (stub) → pesan memuat field kurang berlabel Indonesia', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 400 di-stub untuk memin kontrak UI
    // pesan PROFILE_INCOMPLETE menyebut field kurang (hardening 2026-09-22)
    // — bukan bug jaringan.
    await log.step('GIVEN sesi COO + calon lengkap; endpoint keputusan DI-STUB 400 PROFILE_INCOMPLETE dengan details.sisaField')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 400,
        body: {
          code: 'PROFILE_INCOMPLETE',
          message: 'Profil calon belum lengkap — verifikasi hanya dapat dilakukan untuk calon dengan Profil lengkap.',
          details: { sisaField: ['fullName', 'accountNumber'] },
        },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN tombol Verifikasi diklik (stub menjawab 400 PROFILE_INCOMPLETE)')
    await jalankanVerifikasi(page, baris)

    await log.step('THEN pesan memuat field kurang dalam LABEL Indonesia (via LABEL_FIELD_PROFIL), bukan kunci mentah')
    await expect(page.getByRole('alert')).toContainText('Profil calon belum lengkap')
    await expect(page.getByRole('alert')).toContainText('Nama Lengkap')
    await expect(page.getByRole('alert')).toContainText('Nomor Rekening')
    await expect(page.getByRole('alert')).not.toContainText('fullName')
    await keputusanStub
  })

  test('[P1] maxlength textarea = konstanta bersama + 400 BAD_REQUEST (stub) → alert menampilkan details.masalah', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 400 di-stub untuk memin kontrak UI matriks
    // #6 (hardening 2026-09-22): textarea `:maxlength` = konstanta bersama
    // dan pesan BAD_REQUEST menampilkan details.masalah — bukan bug jaringan.
    await log.step('GIVEN sesi COO (email unik — anti-yank cleanup lintas project) + calon lengkap; endpoint keputusan DI-STUB 400 BAD_REQUEST dengan details.masalah')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: emailSintetisUji(),
    }))
    const { email } = await seedCalonLengkap(apiRequest)
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 400,
        body: {
          code: 'BAD_REQUEST',
          message: 'Body keputusan harus { id: uuid, keputusan: "terverifikasi"|"ditolak", alasan? }.',
          details: { masalah: ['Alasan penolakan melebihi 500 karakter.', 'Format tidak sah.'] },
        },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('THEN-1 (pin maxlength): dialog tolak dibuka dan textarea membawa atribut maxlength PERSIS konstanta bersama')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiTolak).click())
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogTolak)).toBeVisible()
    const inputAlasan = page.getByTestId(TEST_IDS.pendaftar.inputAlasan)
    await expect(inputAlasan).toHaveAttribute('maxlength', String(PANJANG_MAKS_ALASAN_PENOLAKAN))

    await log.step('WHEN alasan valid diisi lalu kirim Tolak diklik (stub menjawab 400 BAD_REQUEST)')
    await inputAlasan.fill(`Data rekening perlu diperiksa ulang (${faker.string.alphanumeric(4)}).`)
    await expect(page.getByTestId(TEST_IDS.pendaftar.kirimTolak)).toBeEnabled()
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimTolak).click())

    await log.step('THEN-2 alert memuat teks gabungan details.masalah — jalur teksPermintaanTidakSah ter-pin')
    await expect(page.getByRole('alert')).toContainText('Permintaan tidak sah')
    await expect(page.getByRole('alert')).toContainText('melebihi 500 karakter')
    await keputusanStub
  })

  test('[P1] 400 ALASAN_WAJIB dari server (stub) → pesan alasan wajib tampil', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: POST 400 di-stub untuk menutup lengan matriks
    // per-kode terakhir (ALASAN_WAJIB — hardening 2026-09-22) — bukan bug
    // jaringan.
    await log.step('GIVEN sesi COO (email unik — anti-yank cleanup lintas project) + calon lengkap; endpoint keputusan DI-STUB 400 ALASAN_WAJIB')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: emailSintetisUji(),
    }))
    const { email } = await seedCalonLengkap(apiRequest)
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      fulfillResponse: {
        status: 400,
        body: { code: 'ALASAN_WAJIB', message: 'Alasan penolakan wajib diisi.', details: {} },
      },
    })

    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN dialog tolak dibuka, alasan diisi, kirim diklik (stub menjawab 400 ALASAN_WAJIB)')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiTolak).click())
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogTolak)).toBeVisible()
    const inputAlasan = page.getByTestId(TEST_IDS.pendaftar.inputAlasan)
    await inputAlasan.fill(`Data tidak dapat dikonfirmasi (${faker.string.alphanumeric(4)}).`)
    await expect(page.getByTestId(TEST_IDS.pendaftar.kirimTolak)).toBeEnabled()
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimTolak).click())

    await log.step('THEN alert memuat pesan alasan wajib — paritas validasi dialog dan server')
    await expect(page.getByRole('alert')).toContainText('Alasan penolakan wajib diisi.')
    await keputusanStub
  })

  test('[P1] klik Verifikasi kedua selama muatUlang berjalan → POST kedua ditolak guard sedangMuatUlang (matriks #8)', { annotation: [{ type: 'skipNetworkMonitoring' }] }, async ({ page, context, apiRequest, interceptNetworkCall }) => {
    // skipNetworkMonitoring: GET daftar + POST keputusan di-stub untuk memin
    // guard `sedangMuatUlang` (hardening 2026-09-22, matriks #8) — bukan bug
    // jaringan.
    await log.step('GIVEN sesi COO (email unik) + DUA calon lengkap; GET daftar DI-STUB ber-delay, POST keputusan DI-STUB sukses cepat + dihitung')
    await context.addCookies(await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: emailSintetisUji(),
    }))
    const calonA = await seedCalonLengkap(apiRequest)
    const calonB = await seedCalonLengkap(apiRequest)
    const daftar = await apiRequest<{ data: Array<{ id: string, email: string, createdAt: string }> }>({
      method: 'GET',
      path: '/api/pendaftar',
      headers: headerCookieDariMint(await mintSesiPemilik(apiRequest, {
        userIdentifier: 'coo',
        email: emailSintetisUji(),
      })),
    })
    const barisServerA = daftar.body.data.find(baris => baris.email === calonA.email)
    const barisServerB = daftar.body.data.find(baris => baris.email === calonB.email)
    expect(barisServerA).toBeDefined()
    expect(barisServerB).toBeDefined()

    const barisWire = (baris: { id: string, email: string, createdAt: string }, namaMarker: string) => ({
      id: baris.id,
      email: baris.email,
      nama: namaMarker,
      createdAt: baris.createdAt,
      profilLengkap: true,
      sisaField: [],
    })

    let jumlahPostKeputusan = 0
    const muatUlangStub = interceptNetworkCall({
      url: '**/api/pendaftar',
      method: 'GET',
      handler: async (route) => {
        // Tahan refresh: jendela 500ms bagi klik kedua selama muatUlang.
        await new Promise(resolve => setTimeout(resolve, DELAY_MUAT_ULANG_STUB_MS))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              barisWire(barisServerA ?? { id: '', email: calonA.email, createdAt: '' }, 'Muat-2 A'),
              barisWire(barisServerB ?? { id: '', email: calonB.email, createdAt: '' }, 'Muat-2 B'),
            ],
          }),
        })
      },
    })
    const keputusanStub = interceptNetworkCall({
      url: '**/api/pendaftar/keputusan',
      method: 'POST',
      handler: async (route) => {
        jumlahPostKeputusan += 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: barisServerA?.id, email: barisServerA?.email, status: 'terverifikasi' }),
        })
      },
    })

    await page.goto('/pendaftar')
    const lokasiA = barisCalon(page, calonA.email)
    const lokasiB = barisCalon(page, calonB.email)
    await expect(lokasiA).toBeVisible()
    await expect(lokasiB).toBeVisible()
    await tungguHidrasi(page)

    await log.step('WHEN Verifikasi baris A diklik (POST sukses cepat → memicu muatUlang yang DITAHAN stub delay)')
    await jalankanVerifikasi(page, lokasiA)
    await muatUlangStub // GET muatUlang tiba — refresh masih tertahan delay.

    await log.step('AND Verifikasi baris B diklik SELAMA refresh berjalan — guard wajib menolaknya')
    await jalankanVerifikasi(page, lokasiB)

    await log.step('THEN TEPAT SATU POST keputusan (milik baris A) — klik B tidak pernah terkirim ke jaringan')
    await expect(lokasiA.getByText('Muat-2 A')).toBeVisible() // refresh selesai + re-render dari response delay.
    expect(jumlahPostKeputusan).toBe(1)
    const postPertama = await keputusanStub
    expect(postPertama.requestJson).toMatchObject({ id: barisServerA?.id, keputusan: 'terverifikasi' })

    await log.step('AND pesan sukses baris A BERTAHAN — tidak tertimpa gagal/status-berubah')
    await expect(page.getByRole('alert')).toContainText('Pendaftar diverifikasi.')
    await expect(page.getByRole('alert')).not.toContainText('coba lagi')
    await expect(page.getByRole('alert')).not.toContainText('Status pendaftar sudah berubah')
  })

  test('[P0] non-COO membuka /pendaftar URL langsung → dialihkan ke landing role-nya', async ({ page, context, apiRequest }) => {
    // Calon DI-SEED berprofil LENGKAP: sejak /pendaftar terdaftar di registry
    // (keputusan owner 2026-09-22), middleware gerbang calon 1.5 dievaluasi
    // dulu — calon diajukan BELUM lengkap akan dialihkan ke
    // /profile-completeness, sedangkan calon lengkap diteruskan ke landing
    // calonnya /registration-status (pin perilaku redirect di sini).
    await log.step('GIVEN sesi calon owner (non-COO, profil lengkap) terinjeksikan')
    const { cookies } = await seedCalonLengkap(apiRequest)
    await context.addCookies(cookies)

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

  test('[P1] konfirmasi verifikasi — Batal menutup dialog tanpa mengubah apa pun', async ({ page, context, apiRequest }) => {
    // Renegotiasi 2026-09-23: verifikasi dua-langkah — jalur Batal wajib
    // meninggalkan daftar dan status apa adanya (tidak ada POST terkirim).
    await log.step('GIVEN sesi COO + calon lengkap; dialog konfirmasi verifikasi terbuka')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
    await page.goto('/pendaftar')
    const baris = barisCalon(page, email)
    await expect(baris).toBeVisible()
    await tungguHidrasi(page)
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiVerifikasi).click())
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toBeVisible()

    await log.step('WHEN Batal diklik')
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.batalVerifikasi).click())

    await log.step('THEN dialog tertutup, baris TETAP di daftar, tanpa pesan sukses — tidak ada keputusan terkirim')
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toHaveCount(0)
    await expect(baris).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('[P0] tombol Detail → halaman detail read-only (reuse layout kelengkapan) + verifikasi dari detail', async ({ page, context, apiRequest }) => {
    // Penyempurnaan 2026-09-23 (revisi owner): detail = HALAMAN penuh yang
    // meniru layout kelengkapan (bukan pop-up) — COO memeriksa + verifikasi
    // di satu tempat tanpa bolak-balik ke daftar.
    await log.step('GIVEN sesi COO + calon lengkap tersimpan; id diketahui dari daftar (server-truth)')
    await context.addCookies(await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' }))
    const { email } = await seedCalonLengkap(apiRequest)
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

    await log.step('WHEN tombol Detail diklik → navigasi ke /pendaftar/:id')
    await klikDenganUlang(() => baris.getByTestId(TEST_IDS.pendaftar.aksiDetail).click())

    await log.step('THEN halaman detail read-only tampil — fieldset kelengkapan + nilai isian + input readonly')
    await expect(page).toHaveURL(new RegExp(`/pendaftar/${target?.id}$`))
    await expect(page.getByTestId(TEST_IDS.pendaftar.halamanDetail)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.pendaftar.halamanDetail)).toContainText('Profil Pemilik')
    await expect(page.getByTestId(TEST_IDS.pendaftar.halamanDetail)).toContainText('Info Kontak Darurat')
    await expect(page.getByTestId(TEST_IDS.pendaftar.halamanDetail)).toContainText('Info Rekening')
    await expect(page.getByTestId(TEST_IDS.pendaftar.halamanDetail)).toContainText('BCA')
    await expect(page.locator('#detail-accountNumber')).toHaveAttribute('readonly', '')

    await log.step('AND Verifikasi tersedia di halaman detail → dialog konfirmasi → kirim → kembali ke daftar')
    await expect(page.getByTestId(TEST_IDS.pendaftar.aksiVerifikasiDetail)).toBeEnabled()
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.aksiVerifikasiDetail).click())
    await expect(page.getByTestId(TEST_IDS.pendaftar.dialogVerifikasi)).toBeVisible()
    await klikDenganUlang(() => page.getByTestId(TEST_IDS.pendaftar.kirimVerifikasi).click())
    await expect(page).toHaveURL(/\/pendaftar$/)
    await expect(baris).toHaveCount(0)
  })
})
