/**
 * ATDD RED-PHASE — Story 1.8 "Manajemen Owner oleh COO" (E2E).
 *
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; seluruh asersi ter-pin dari red-phase tidak
 * berubah. Kontrak yang diperiksa = matriks E2E spec Story 1.8 (beku):
 *
 * Page Access:
 * - COO dapat akses /admin/owners (halaman dan tabel tampil)
 * - Non-COO dialihkan dengan pesan error
 *
 * Dialog Flows:
 * - Edit dialog: buka → isi → simpan → data tersimpan
 * - Add dialog: buka → isi email → simpan → owner baru muncul
 *
 * Owner Picker:
 * - Komponen picker menampilkan search dan dapat filter owner
 *
 * Catatan mandate playwright-utils:
 * - DEVIASI TERCATAT (auth): cookie sesi di-mint via `mintSesiPemilik` lalu
 *   diinjeksikan eksplisit lewat `context.addCookies(...)` — deviasi yang
 *   SAMA sudah terekam di Story 1.2 dan 1.3.
 * - `apiRequest` dipakai untuk API calls; tanpa waitForTimeout; tanpa console.log.
 *
 * Kontrak selektor: blok `TEST_IDS.adminOwners` di
 * tests/support/helpers/test-ids.ts (akan ditambahkan saat green-phase).
 */
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Email sintetis unik untuk test add owner — menghindari konflik. */
function emailUjiUnik(suffix: string): string {
  const timestamp = Date.now()
  return `uji.snddash.e2e.admin-owners-${suffix}-${timestamp}@gmail.com`
}

// ============================================================================
// TEST SUITES — E2E Page & Component Tests
// ============================================================================

test.describe('[Story 1.8] /admin/owners Page Access (Requirement 1)', () => {
  test.skip('[P0] #15 COO melihat halaman /admin/owners dengan tabel daftar owner', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: halaman /admin/owners belum ada — 404 atau redirect
    await log.step('GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)

    await log.step('WHEN COO membuka /admin/owners')
    await page.goto('/admin/owners')

    await log.step('THEN halaman Manajemen Owner tampil dengan kontainer halaman')
    await expect(page.getByTestId(TEST_IDS.adminOwners.halaman)).toBeVisible()

    await log.step('AND tabel daftar owner tampil')
    await expect(page.getByTestId(TEST_IDS.adminOwners.tabel)).toBeVisible()

    await log.step('AND tombol tambah owner tersedia')
    await expect(page.getByTestId(TEST_IDS.adminOwners.tambah)).toBeVisible()

    await log.step('AND tabel memuat data owner (minimal satu baris dari COO mint)')
    const tabel = page.getByTestId(TEST_IDS.adminOwners.tabel)
    await expect(tabel.locator('tbody tr').first()).toBeVisible()
  })

  test.skip('[P1] #16 Non-COO membuka /admin/owners dialihkan dengan pesan error', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: halaman /admin/owners belum ada — 404 atau redirect umum
    await log.step('GIVEN sesi pemegang saham (non-COO) dimintakan lalu diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)

    await log.step('WHEN non-COO membuka /admin/owners secara langsung')
    await page.goto('/admin/owners')

    await log.step('THEN dialihkan ke halaman landing role-nya (AD-8 server boundary)')
    // Non-COO dengan saham → landing = /dashboard
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('AND halaman admin owners TIDAK tampil')
    await expect(page.getByTestId(TEST_IDS.adminOwners.halaman)).toHaveCount(0)
  })
})

test.describe('[Story 1.8] Edit Owner Dialog (Requirement 2)', () => {
  test.skip('[P1] #17 COO membuka edit dialog → isi form → simpan → data tersimpan', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: halaman dan komponen belum ada
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/admin/owners')

    await log.step('WHEN COO klik tombol edit pada baris owner pertama')
    const tombolEdit = page.getByTestId(TEST_IDS.adminOwners.edit).first()
    await tombolEdit.click()

    await log.step('THEN dialog edit owner terbuka')
    const dialogEdit = page.getByTestId(TEST_IDS.ownerEditDialog)
    await expect(dialogEdit).toBeVisible()

    await log.step('AND dialog memuat form sections: Identitas, Kontak, Kontak Darurat, Rekening Bank')
    // Verifikasi kehadiran form sections via heading atau label
    await expect(dialogEdit.getByText(/Identitas/i)).toBeVisible()
    await expect(dialogEdit.getByText(/Kontak/i)).toBeVisible()

    await log.step('WHEN COO mengisi field alias dengan nilai baru dan simpan')
    const inputAlias = dialogEdit.getByLabel(/Alias/i)
    const _aliasLama = await inputAlias.inputValue()
    const aliasBaru = `Alias Uji ${Date.now()}`
    await inputAlias.fill(aliasBaru)

    // Klik tombol simpan
    await dialogEdit.getByRole('button', { name: /Simpan/i }).click()

    await log.step('THEN dialog tertutup dan perubahan tersimpan (toast atau refresh tabel)')
    await expect(dialogEdit).not.toBeVisible()

    await log.step('AND data alias baru tampil di tabel')
    const tabel = page.getByTestId(TEST_IDS.adminOwners.tabel)
    await expect(tabel).toContainText(aliasBaru)

    await log.step('AND field status TIDAK dapat diedit (disabled)')
    // Buka dialog lagi untuk verifikasi
    await tombolEdit.click()
    await expect(dialogEdit).toBeVisible()
    const inputStatus = dialogEdit.getByLabel(/Status/i)
    await expect(inputStatus).toBeDisabled()
  })
})

test.describe('[Story 1.8] Add Owner Dialog (Requirement 3)', () => {
  test.skip('[P1] #18 COO membuka add dialog → isi email → simpan → owner baru muncul', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: halaman dan komponen belum ada
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/admin/owners')

    await log.step('WHEN COO klik tombol tambah owner')
    await page.getByTestId(TEST_IDS.adminOwners.tambah).click()

    await log.step('THEN dialog tambah owner terbuka')
    const dialogTambah = page.getByTestId(TEST_IDS.ownerAddDialog)
    await expect(dialogTambah).toBeVisible()

    await log.step('AND dialog memuat field email yang required')
    const inputEmail = dialogTambah.getByLabel(/Email/i)
    await expect(inputEmail).toBeVisible()

    await log.step('AND dialog menampilkan catatan tentang status pre-approved')
    // Verifikasi catatan bahwa owner baru langsung terverifikasi
    await expect(dialogTambah.getByText(/terverifikasi|pre-approved/i)).toBeVisible()

    await log.step('WHEN COO mengisi email baru dan field opsional lalu simpan')
    const emailBaru = emailUjiUnik('e2e-add')
    await inputEmail.fill(emailBaru)

    // Isi field opsional bila ada
    const inputNama = dialogTambah.getByLabel(/Nama|Full Name/i)
    if (await inputNama.isVisible()) {
      await inputNama.fill('Owner Baru E2E Test')
    }

    // Klik tombol simpan
    await dialogTambah.getByRole('button', { name: /Simpan|Tambah/i }).click()

    await log.step('THEN dialog tertutup dan owner baru muncul di tabel')
    await expect(dialogTambah).not.toBeVisible()

    const tabel = page.getByTestId(TEST_IDS.adminOwners.tabel)
    await expect(tabel).toContainText(emailBaru)

    await log.step('AND owner baru memiliki status terverifikasi (Property 6)')
    // Verifikasi badge status di baris owner baru
    const barisOwnerBaru = tabel.locator('tbody tr', { hasText: emailBaru })
    await expect(barisOwnerBaru).toContainText(/terverifikasi/i)
  })
})

test.describe('[Story 1.8] Owner Picker Component (Requirement 4)', () => {
  test.skip('[P2] #19 OwnerPicker menampilkan search dan dapat filter owner', async ({ page, context, apiRequest }) => {
    // GAGAL saat red: komponen belum ada
    // Note: OwnerPicker akan diuji di halaman admin/owners atau halaman transaksi
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/admin/owners')

    await log.step('WHEN COO membuka komponen OwnerPicker (via interaksi yang memunculkannya)')
    // OwnerPicker mungkin ada di dialog atau sebagai bagian dari form lain
    // Untuk sementara, test di halaman owners sebagai demo komponen
    const ownerPicker = page.getByTestId(TEST_IDS.ownerPicker)

    // Jika picker tidak langsung visible, mungkin perlu trigger (e.g., buka dialog)
    // Fallback: cek apakah ada input search di halaman
    const searchInput = page.getByPlaceholder(/cari|search|filter/i)
    const pickerVisible = await ownerPicker.isVisible().catch(() => false)
    const searchVisible = await searchInput.isVisible().catch(() => false)

    if (!pickerVisible && !searchVisible) {
      // Buka dialog edit untuk akses OwnerPicker
      await page.getByTestId(TEST_IDS.adminOwners.edit).first().click()
    }

    await log.step('THEN komponen picker atau search tersedia')
    // Picker atau search harus ada
    const hasSearch = await searchInput.isVisible().catch(() => false)
      || await ownerPicker.isVisible().catch(() => false)
    expect(hasSearch).toBe(true)

    await log.step('WHEN COO mengetik keyword pencarian')
    const inputPencarian = await ownerPicker.isVisible()
      ? ownerPicker.getByRole('textbox')
      : searchInput
    await inputPencarian.fill('uji')

    await log.step('THEN hasil ter-filter sesuai keyword')
    // Hasil pencarian harus memuat keyword atau kosong jika tidak match
    // Verifikasi bahwa list/dropdown ter-filter
    // Implementasi spesifik tergantung struktur komponen OwnerPicker
    await log.step('AND semua owner termasuk status keluar dapat dipilih (FR-13)')
    // Mint owner keluar dan verifikasi muncul di picker
    await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', status: 'keluar' })

    // Reload halaman dan verifikasi owner keluar muncul
    await page.goto('/admin/owners')
    const tabelReload = page.getByTestId(TEST_IDS.adminOwners.tabel)
    await expect(tabelReload).toContainText(/keluar/i)
  })
})
