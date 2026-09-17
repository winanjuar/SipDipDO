/**
 * ATDD GREEN-PHASE — Story 1.3 "Audit Trail — Pencatatan & Tampilan COO".
 * Kontrak test design: `1-E2E-002` (sisi halaman) + cerminan `1-API-006`.
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; asersi ter-pin dari red-phase tidak berubah.
 *
 * Cakupan OTOMASI (strategi langkah 03, baris 14–17):
 * - [P1] COO melihat daftar entry audit: aktor (email / "System" untuk aktor
 *   sistem), waktu id-ID zona Asia/Jakarta, action, target, detail JSON
 *   terpotong (elipsis).
 * - [P0] pemegang_saham membuka /audit-trail URL langsung → redirect ke
 *   LANDING_PATH[role] = /dashboard (penegakan AD-8 sisi halaman).
 * - [P1] belum login membuka /audit-trail → redirect /login (lapis halaman;
 *   endpoint /api/landing tanpa sesi menjawab 401 → navigateTo('/login')).
 * - [P2] DB tanpa entry → empty state (pola antrian-beli.vue).
 *
 * Catatan mandate playwright-utils:
 * - DEVIASI TERCATAT (intercept): fetch `/api/audit` terjadi DI SERVER (pola
 *   `useRequestFetch` SSR, ref app/pages/status-pendaftaran.vue) sehingga
 *   TIDAK tampak di jaringan browser → `interceptNetworkCall` tidak dipakai
 *   untuk fetch SSR halaman ini; asersi langsung ke elemen tampil di HTML
 *   awal (pola tests/e2e/smoke.ui.spec.ts).
 * - DEVIASI TERCATAT (auth): cookie sesi di-mint via `mintSesiPemilik` lalu
 *   diinjeksikan eksplisit lewat `context.addCookies(...)` — deviasi yang
 *   SAMA sudah terekam di Story 1.2 (injeksi cookie eksplisit alih-alih
 *   fixture authToken; wiring `manageAuthToken` menyusul). Pola:
 *   tests/e2e/auth-landing.spec.ts.
 * - `apiRequest` dipakai untuk setup seed (bukan fixture `request`); tanpa
 *   page.route pada endpoint aplikasi; tanpa waitForTimeout; tanpa
 *   console.log. Tidak ada test yang subjeknya error path 4xx/5xx (redirect
 *   non-COO adalah perilaku produk, bukan error tersembunyi) → anotasi
 *   `skipNetworkMonitoring` tidak dipakai.
 *
 * Kontrak selektor: blok `TEST_IDS.auditTrail` di
 * tests/support/helpers/test-ids.ts (audit-trail-halaman / -tabel / -baris /
 * -kosong / -paginasi).
 *
 * Kontrak seed terwujud: POST /api/test/audit-seed (dev-only triple-guard,
 * pola server/api/test/login.post.ts) dengan body `{ jumlah: <n> }`; seed
 * menyertakan entry aktor user (email tampil) DAN aktor system ("System"),
 * dengan details panjang (JSON terpotong → elipsis). Pembersihan entry audit
 * TIDAK lewat aplikasi (append-only, tanpa jalur delete) — test empty-state
 * menjamin prekondisinya sendiri via helper dev-only `denganAuditKosong`
 * (TRUNCATE koneksi ADMIN + advisory lock, lihat tests/support/helpers/
 * audit-reset.ts); kontrak pembersihan data uji menyusul kontrak Story 1.4.
 */
import type { ApiRequestFixtureParams } from '@seontechnologies/playwright-utils/api-request'
import { test, expect, log } from '../support/merged-fixtures'
import { TEST_IDS } from '../support/helpers/test-ids'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'
import { denganAuditKosong } from '../support/helpers/audit-reset'

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper seed. */
type ApiRequestUji = <T = unknown>(params: ApiRequestFixtureParams) => Promise<{ status: number, body: T }>

/** Jumlah entry yang di-seed per test (2–3 cukup membuktikan daftar; < LIMIT 100). */
const JUMLAH_SEED = 3

/** Aktor tampil sebagai email owner, atau "System" untuk aktor sistem (null actor). */
const POLA_AKTOR = /@|\bSystem\b/

/** Waktu id-ID zona Asia/Jakarta: tanggal numerik dd/mm/yyyy + jam menit berpemisah titik. */
const POLA_WAKTU_ID_ID = /\d{1,2}\/\d{1,2}\/\d{4}[,\s]+\d{1,2}\.\d{2}/

/** Secret guard — fallback wajib identik dengan env TEST_AUTH_SECRET server uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/**
 * Seed entry audit via endpoint dev-only POST /api/test/audit-seed.
 * ASUMSI KONTRAK (endpoint BELUM ADA saat red): body `{ jumlah: <n> }`,
 * guard header TEST_AUTH_SECRET — pola server/api/test/login.post.ts.
 * Menulis lewat API publik modul audit dalam satu tx di sisi server; spec
 * ini TIDAK menyentuh tabel tetangga dan tidak melakukan pembersihan
 * (append-only; kontrak pembersihan menyusul Story 1.4).
 */
async function seedEntryAudit(apiRequest: ApiRequestUji, jumlah: number): Promise<void> {
  const { status, body } = await apiRequest<{ jumlah?: number }>({
    method: 'POST',
    path: '/api/test/audit-seed',
    body: { jumlah },
    headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
  })

  if (status !== 200 && status !== 201) {
    throw new Error(
      `seedEntryAudit: /api/test/audit-seed menjawab ${status} — endpoint dev-only Story 1.3 `
      + 'belum ada (kontrak red) atau triple guard menolak. Aktifkan bersama '
      + 'implementasi server/api/test/audit-seed.post.ts.',
    )
  }
  log.info(`Seed audit: meminta ${jumlah} entry, respons server: ${JSON.stringify(body)}`)
}

test.describe('E2E Story 1.3 — audit trail khusus COO (1-E2E-002 sisi halaman + 1-API-006)', () => {
  // GAGAL saat red: halaman /audit-trail 404 (belum ada) dan endpoint seed
  // /api/test/audit-seed 404 — goto melempar/merender halaman error sehingga
  // seluruh aserti testid/tabel/baris merah. Kunci advisory digenggam sepanjang
  // test (lihat tests/support/helpers/audit-reset.ts) agar seed test ini dan
  // TRUNCATE test lain tidak saling menyela lintas project browser.
  test('[P1] COO melihat daftar entry audit: aktor, waktu id-ID, action, detail terpotong', async ({ page, context, apiRequest }) => {
    await denganAuditKosong(async () => {
      await log.step('GIVEN sesi COO sintetis dimintakan lalu diinjeksikan ke context')
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
      await context.addCookies(cookies)

      await log.step(`AND ${JUMLAH_SEED} entry audit di-seed via endpoint dev-only (ASUMSI kontrak body { jumlah })`)
      await seedEntryAudit(apiRequest, JUMLAH_SEED)

      await log.step('WHEN COO membuka /audit-trail (fetch SSR — data hadir di HTML awal, tanpa spy jaringan)')
      await page.goto('/audit-trail')

      await log.step('THEN halaman dan tabel audit tampil dengan baris seed')
      await expect(page.getByTestId(TEST_IDS.auditTrail.halaman)).toBeVisible()
      const tabelAudit = page.getByTestId(TEST_IDS.auditTrail.tabel)
      await expect(tabelAudit).toBeVisible()
      const barisAudit = page.getByTestId(TEST_IDS.auditTrail.baris)
      await expect(barisAudit.first()).toBeVisible()
      const jumlahBaris = await barisAudit.count()
      expect(jumlahBaris).toBeGreaterThanOrEqual(JUMLAH_SEED)

      await log.step('AND tiap baris memuat 5 kolom matriks I/O (waktu, aktor, action, target, detail)')
      for (let i = 0; i < Math.min(JUMLAH_SEED, jumlahBaris); i++) {
        const baris = barisAudit.nth(i)
        await expect(baris.getByRole('cell')).toHaveCount(5)
        await expect(baris).toContainText(POLA_AKTOR)
        await expect(baris).toContainText(POLA_WAKTU_ID_ID)
      }

      await log.step('AND aktor user tampil sebagai email dan aktor sistem tampil sebagai "System"')
      const teksTabel = (await tabelAudit.textContent()) ?? ''
      // ASUMSI seed: menyertakan entry aktor user (email) DAN aktor sistem.
      expect(teksTabel).toMatch(/@[^\s]+/)
      expect(teksTabel).toContain('System')

      await log.step('AND detail JSON terpotong oleh konstanta bernama sisi halaman (teramati: elipsis)')
      // ASUMSI seed: details jsonb ditulis panjang sehingga melewati batas potong
      // konstanta bernama di halaman; bentuk teramati di UI = karakter '…'.
      expect(teksTabel).toContain('…')

      // Catatan paginasi: dengan 3 entry (< batas default 25) nextPage null —
      // asersi audit-trail-paginasi tidak dipin di skenario ini; perilaku
      // paginasi & selector ukuran diverifikasi test khusus di bawah.
    })
  })

  // REGRESI (bug report user 2026-09-17): klik "Berikutnya" dulu diam di
  // halaman 1 — komponen dipakai ulang Nuxt untuk perubahan query saja
  // sehingga setup/fetch tidak jalan lagi. Fix: definePageMeta key fullPath.
  // Test ini memastikan klik paginasi BENAR-BENAR berpindah dan selector
  // ukuran halaman mengubah jumlah baris.
  test('[P1] paginasi Berikutnya berpindah halaman dan selector ukuran mengubah jumlah baris', async ({ page, context, apiRequest }) => {
    // 26 entry + default 20/halaman → halaman 1 penuh + sisa 6 di halaman 2.
    const JUMLAH_SEED_DUA_HALAMAN = 26

    await denganAuditKosong(async () => {
      await log.step('GIVEN sesi COO dan 26 entry audit (lebih dari batas default 20)')
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
      await context.addCookies(cookies)
      await seedEntryAudit(apiRequest, JUMLAH_SEED_DUA_HALAMAN)

      await log.step('WHEN COO membuka /audit-trail')
      await page.goto('/audit-trail')

      await log.step('THEN halaman 1 menampilkan tepat 20 baris dan paginasi tampil')
      await expect(page.getByTestId(TEST_IDS.auditTrail.paginasi)).toBeVisible()
      await expect(page.getByTestId(TEST_IDS.auditTrail.baris)).toHaveCount(20)

      await log.step('WHEN "Berikutnya" diklik')
      await page.getByRole('link', { name: /Berikutnya/ }).click()
      await expect(page).toHaveURL(/\/audit-trail\?page=2$/)

      await log.step('THEN halaman 2 dirender ulang dengan 6 baris sisa (bukan diam di halaman 1)')
      await expect(page.getByTestId(TEST_IDS.auditTrail.baris)).toHaveCount(6)
      await expect(page.getByText('Halaman 2')).toBeVisible()

      await log.step('WHEN selector ukuran "40" dipilih')
      await page.getByTestId(TEST_IDS.auditTrail.ukuran).getByRole('link', { name: '40' }).click()
      await expect(page).toHaveURL(/\/audit-trail\?limit=40$/)

      await log.step('THEN seluruh 26 entry tampil dalam satu halaman (ukuran 40)')
      await expect(page.getByTestId(TEST_IDS.auditTrail.baris)).toHaveCount(JUMLAH_SEED_DUA_HALAMAN)
    })
  })

  // GAGAL saat red: halaman /audit-trail belum ada → SSR 404 (atau auth-guard
  // global mengantar ke /login), bukan redirect produk ke /dashboard.
  test('[P0] pemegang saham membuka /audit-trail URL langsung dialihkan ke /dashboard', async ({ page, context, apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham (non-COO) sudah diinjeksikan')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })
    await context.addCookies(cookies)

    await log.step('WHEN membuka /audit-trail secara langsung')
    await page.goto('/audit-trail')

    await log.step('THEN dialihkan ke landing role-nya /dashboard, bukan melihat isi audit')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByTestId(TEST_IDS.auditTrail.halaman)).toHaveCount(0)
  })

  // GAGAL saat red: halaman /audit-trail 404. CATATAN: /audit-trail tidak
  // termasuk himpunan auth-guard server (nilai LANDING_PATH) — proteksi
  // sesi berlaku via definePageMeta({ auth: true }) + lapis halaman SSR
  // (api /api/landing tanpa sesi → 401 → navigateTo('/login')).
  test('[P1] pengunjung tanpa sesi membuka /audit-trail dialihkan ke /login', async ({ page }) => {
    await log.step('GIVEN pengunjung tanpa cookie sesi')
    await log.step('WHEN membuka /audit-trail secara langsung')
    await page.goto('/audit-trail')

    await log.step('THEN middleware auth-guard mengarahkan ke /login')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId(TEST_IDS.auditTrail.halaman)).toHaveCount(0)
  })

  // GAGAL saat red: halaman /audit-trail 404 sehingga testid kosong tidak
  // pernah tampil. CATATAN: test ini menjamin sendiri prekondisi DB kosong —
  // helper dev-only `denganAuditKosong` (TRUNCATE koneksi ADMIN + advisory
  // lock antar project browser) men-deterministikkan keadaan TANPA mengubah
  // asersi ter-pin; grants role `app_runtime` tetap menutup jalur tulis
  // runtime (reset ini bukan jalur aplikasi).
  test('[P2] audit trail tanpa entry menampilkan empty state', async ({ page, context, apiRequest }) => {
    await denganAuditKosong(async () => {
      await log.step('GIVEN sesi COO dan DB dipastikan kosong dari entry audit')
      const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
      await context.addCookies(cookies)

      await log.step('WHEN COO membuka /audit-trail')
      await page.goto('/audit-trail')

      await log.step('THEN empty state tampil (pola antrian-beli) tanpa satu pun baris tabel')
      await expect(page.getByTestId(TEST_IDS.auditTrail.halaman)).toBeVisible()
      await expect(page.getByTestId(TEST_IDS.auditTrail.kosong)).toBeVisible()
      await expect(page.getByTestId(TEST_IDS.auditTrail.baris)).toHaveCount(0)
    })
  })
})
