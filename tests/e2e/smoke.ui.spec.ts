/**
 * SAMPLE UI — pola acuan untuk spec E2E berikutnya (mandate playwright-utils):
 * `interceptNetworkCall` DIDEKLARASIKAN sebelum `page.goto` lalu di-await
 * sesudahnya (network-first, bebas race); selector via data-testid dari
 * helpers/test-ids; interaksi by role/name; data input sintetis via faker.
 * Halaman smoke = kerangka dev-only Story 1.1 (dihapus saat Epic 1 selesai);
 * pola spec ini tetap jadi referensi setelah halamannya pensiun.
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'

const JUDUL_DIALOG = 'Dialog kontrak'

test.describe('[P0] E2E halaman smoke substrat — R-005 (Story 1.1)', () => {
  test('komponen kontrak merender dan berinteraksi', async ({ page, interceptNetworkCall, recurse }) => {
    await log.step('GIVEN halaman smoke dimuat')
    // Intercept dokumen navigasi: sesi NuxtAuth diambil SSAAT SSR (server-side),
    // jadi tidak ada panggilan browser ke /api/auth/session yang bisa di-spy.
    // Pola declare→goto→await tetap sama untuk panggilan API aplikasi begitu
    // ada fetch client-side (Epic 1+).
    const dokumenCall = interceptNetworkCall({ url: '**/smoke' })

    await page.goto('/smoke')

    const { status: statusDokumen } = await dokumenCall
    expect(statusDokumen).toBe(200)

    await log.step('THEN tujuh section kontrak terlihat')
    const sectionKontrak = [
      TEST_IDS.smoke.auth,
      TEST_IDS.smoke.dialog,
      TEST_IDS.smoke.sheet,
      TEST_IDS.smoke.tooltip,
      TEST_IDS.smoke.drawer,
      TEST_IDS.smoke.inputOtp,
      TEST_IDS.smoke.toast,
    ]
    for (const section of sectionKontrak) {
      await expect(page.getByTestId(section)).toBeVisible()
    }

    await log.step('WHEN dialog dibuka (keyboard) lalu ditutup (Escape)')
    // CATATAN R-005: aktivasi pointer-click DialogTrigger reka-ui tidak
    // membuka dialog di chromium headless (diverifikasi probe terpisah,
    // tanpa error konsol); keyboard Enter bekerja SETELAH hidrasi Vue
    // selesai — asersi section lolos atas HTML SSR, bukan bukti hidrasi.
    // Hidrasi = kondisi eventual-consistent → recurse (bukan sleep).
    const tombolDialog = page.getByRole('button', { name: 'Buka Dialog' })
    await recurse(
      async () => {
        await tombolDialog.press('Enter')
        return page.getByText(JUDUL_DIALOG, { exact: true }).isVisible()
      },
      terbuka => terbuka === true,
      { timeout: 15_000, interval: 500, log: 'Menunggu hidrasi Vue: dialog merespons Enter' },
    )
    await expect(page.getByText(JUDUL_DIALOG, { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText(JUDUL_DIALOG, { exact: true })).toBeHidden()

    await log.step('WHEN toast dipicu dari aksi pengguna')
    await page.getByRole('button', { name: 'Tampilkan Toast' }).click()
    await expect(page.getByText('Tersimpan.', { exact: true })).toBeVisible()

    await log.step('WHEN kode OTP sintetis diketik ke Input OTP')
    // data-testid="otp-input" menempel pada <input> vue-input-otp itu sendiri
    // (input transparan menutupi slot-slot, tanpa elemen input anak).
    const kodeOtp = faker.string.numeric(6)
    await page.getByTestId(TEST_IDS.smoke.otpInput).fill(kodeOtp)
    await expect(page.getByTestId(TEST_IDS.smoke.otpValue)).toHaveText(kodeOtp)
  })
})
