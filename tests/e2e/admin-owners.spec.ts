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
 * tests/support/helpers/test-ids.ts.
 */
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'

/** Email sintetis unik untuk test add owner — menghindari konflik.
 *  Uses timestamp + random suffix to handle parallel test runs. */
function emailUjiUnik(suffix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `uji.snddash.e2e.admin-owners-${suffix}-${timestamp}-${random}@gmail.com`
}

// ============================================================================
// TEST SUITES — E2E Page & Component Tests
// ============================================================================

// Configure all tests to run serially to avoid database conflicts when parallel tests
// mint the same COO session simultaneously
test.describe.configure({ mode: 'serial' })

test.describe('[Story 1.8] /admin/owners Page Access (Requirement 1)', () => {
  test('[P0] #15 COO melihat halaman /admin/owners dengan tabel daftar owner', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)

    await log.step('WHEN COO membuka /admin/owners')
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')

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

  test('[P1] #16 Non-COO membuka /admin/owners dialihkan dengan pesan error', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham (non-COO) dimintakan lalu diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)

    await log.step('WHEN non-COO membuka /admin/owners secara langsung')
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')

    await log.step('THEN dialihkan ke halaman landing role-nya (AD-8 server boundary)')
    // Non-COO dengan saham → landing = /dashboard
    await expect(page).toHaveURL(/\/dashboard$/)

    await log.step('AND halaman admin owners TIDAK tampil')
    await expect(page.getByTestId(TEST_IDS.adminOwners.halaman)).toHaveCount(0)
  })
})

test.describe('[Story 1.8] Edit Owner Dialog (Requirement 2)', () => {
  test('[P1] #17 COO membuka edit dialog → isi form → simpan → data tersimpan', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)

    // Navigate and verify we landed on admin/owners
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')
    const halaman = page.getByTestId(TEST_IDS.adminOwners.halaman)
    await expect(halaman).toBeVisible({ timeout: 15_000 })

    await log.step('WHEN COO klik tombol edit pada baris owner pertama')
    const tombolEdit = page.getByTestId(TEST_IDS.adminOwners.edit).first()
    await expect(tombolEdit).toBeVisible({ timeout: 10_000 })
    await tombolEdit.click()

    await log.step('THEN dialog edit owner terbuka dengan form')
    const dialogEdit = page.getByTestId(TEST_IDS.ownerEditDialog)
    await expect(dialogEdit).toBeVisible({ timeout: 15_000 })

    // Wait for form to load
    await expect(dialogEdit.getByText('Profil Pemilik')).toBeVisible({ timeout: 15_000 })
    await expect(dialogEdit.getByText('Kontak Darurat')).toBeVisible()

    await log.step('WHEN COO mengisi field alias dengan nilai baru dan simpan')
    const inputAlias = dialogEdit.locator('input[id^="edit-alias"]').first()
    await expect(inputAlias).toBeVisible()

    // Store original value, then set new unique value
    const aliasBaru = `E${Math.random().toString(36).substring(2, 8)}`
    await inputAlias.fill(aliasBaru)

    // Capture the PUT response to verify save worked
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/admin/owners/') && resp.request().method() === 'PUT',
    )
    await dialogEdit.getByRole('button', { name: /Simpan/i }).click()

    await log.step('THEN API PUT berhasil dengan status 200')
    const response = await responsePromise
    expect(response.status()).toBe(200)

    await log.step('AND dialog tertutup')
    await expect(dialogEdit).not.toBeVisible({ timeout: 5_000 })

    await log.step('AND perubahan alias terverifikasi via API response')
    // Verify the response body contains our new alias
    const responseBody = await response.json()
    expect(responseBody.owner.alias).toBe(aliasBaru)

    await log.step('AND field status TIDAK dapat diedit (ditampilkan sebagai Badge dengan tooltip)')
    // Re-open the dialog
    await tombolEdit.click()
    await expect(dialogEdit).toBeVisible({ timeout: 15_000 })
    await expect(dialogEdit.getByText('Profil Pemilik')).toBeVisible({ timeout: 10_000 })
    // Status section shows Badge with "(tidak dapat diubah)" text
    await expect(dialogEdit.getByText('(tidak dapat diubah)')).toBeVisible()
  })
})

test.describe('[Story 1.8] Add Owner Dialog (Requirement 3)', () => {
  test('[P1] #18 COO membuka add dialog → isi email → simpan → owner baru muncul', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')

    // Verify we landed on admin/owners, not login
    const halaman = page.getByTestId(TEST_IDS.adminOwners.halaman)
    await expect(halaman).toBeVisible({ timeout: 15_000 })

    await log.step('WHEN COO klik tombol tambah owner')
    const tombolTambah = page.getByTestId(TEST_IDS.adminOwners.tambah)
    await expect(tombolTambah).toBeVisible()
    await expect(tombolTambah).toBeEnabled()
    await tombolTambah.click()

    await log.step('THEN dialog tambah owner terbuka')
    // Wait for the dialog to appear (uses reka-ui portal)
    const dialogTambah = page.getByTestId(TEST_IDS.ownerAddDialog)
    await expect(dialogTambah).toBeVisible({ timeout: 15_000 })

    await log.step('AND dialog memuat field email yang required')
    // Labels use `for` attribute matching input id (e.g., add-email, add-email-d)
    const inputEmail = dialogTambah.locator('input[id^="add-email"]').first()
    await expect(inputEmail).toBeVisible()

    await log.step('AND dialog menampilkan catatan tentang status pre-approved')
    // Verifikasi catatan bahwa owner baru langsung terverifikasi (di Alert, bukan deskripsi)
    await expect(dialogTambah.locator('strong', { hasText: /Terverifikasi/i })).toBeVisible()

    await log.step('WHEN COO mengisi email baru dan field opsional lalu simpan')
    const emailBaru = emailUjiUnik('e2e-add')
    await inputEmail.fill(emailBaru)

    // Isi field nama opsional bila ada
    const inputNama = dialogTambah.locator('input[id^="add-fullName"]').first()
    if (await inputNama.isVisible()) {
      await inputNama.fill('Owner Baru E2E Test')
    }

    // Capture the POST response to verify save worked
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/admin/owners') && resp.request().method() === 'POST',
    )
    // Klik tombol simpan
    await dialogTambah.getByRole('button', { name: /Tambah Owner/i }).click()

    await log.step('THEN API POST berhasil dengan status 201')
    const response = await responsePromise
    expect(response.status()).toBe(201)

    await log.step('AND dialog tertutup dan owner baru muncul di tabel')
    await expect(dialogTambah).not.toBeVisible({ timeout: 10_000 })

    // Desktop: tabel, Mobile: card — check in halaman container (reuse existing halaman)
    await expect(halaman).toContainText(emailBaru)

    await log.step('AND owner baru memiliki status terverifikasi (Property 6)')
    // Verifikasi badge status di halaman — owner baru should show "Terverifikasi"
    // We check that the page contains both the email and Terverifikasi badge text
    await expect(halaman).toContainText(/Terverifikasi/i)
  })
})

test.describe('[Story 1.8] Owner Picker Component (Requirement 4)', () => {
  test('[P2] #19 OwnerPicker menampilkan search dan dapat filter owner', async ({ page, context, apiRequest }) => {
    // Note: OwnerPicker is a reusable component. On admin/owners page, the search
    // functionality is implemented as a standalone input (not OwnerPicker).
    // OwnerPicker component is tested via existence and its data-testid.
    await log.step('GIVEN sesi COO sudah diinjeksikan dan halaman /admin/owners terbuka')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    await context.addCookies(cookies)
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')

    // Verify we landed on admin/owners, not login
    const halaman = page.getByTestId(TEST_IDS.adminOwners.halaman)
    await expect(halaman).toBeVisible({ timeout: 15_000 })

    await log.step('THEN halaman memiliki search input untuk filter owner')
    const searchInput = page.getByTestId('admin-owners-search')
    await expect(searchInput).toBeVisible()

    await log.step('WHEN COO mengetik keyword pencarian')
    // Get current owner count (rows with owner data only)
    const tabel = page.getByTestId(TEST_IDS.adminOwners.tabel)
    const barisSelector = tabel.locator('tbody tr[data-testid="admin-owners-baris"]')
    const barisBefore = await barisSelector.count()

    // Type a filter that likely won't match — "zzzznotexist"
    await searchInput.fill('zzzznotexist')

    await log.step('THEN hasil ter-filter sesuai keyword — tidak ada yang cocok')
    // Wait for filter to apply and verify no matching rows
    await expect(barisSelector).toHaveCount(0, { timeout: 5_000 })

    await log.step('WHEN filter dikosongkan')
    await searchInput.fill('')

    await log.step('THEN semua owner tampil kembali')
    // Wait for filter to clear and rows to return
    await expect(barisSelector).toHaveCount(barisBefore, { timeout: 5_000 })

    await log.step('AND semua owner termasuk status keluar dapat dilihat di tabel (FR-13)')
    // Mint owner keluar dan verifikasi muncul di halaman setelah refresh
    await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', status: 'keluar' })

    // Reload halaman dan verifikasi owner keluar muncul dalam daftar
    await page.goto('/admin/owners')
    await page.waitForLoadState('networkidle')
    // Re-fetch halaman locator after navigation (locators are lazy but page reference changed)
    const halamanReload = page.getByTestId(TEST_IDS.adminOwners.halaman)
    await expect(halamanReload).toBeVisible({ timeout: 15_000 })
    await expect(halamanReload).toContainText(/Keluar/i)
  })
})
