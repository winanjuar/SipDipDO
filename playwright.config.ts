import { defineConfig, devices } from '@playwright/test'

/**
 * Konfigurasi Playwright — lapisan E2E/API (unit tetap di Vitest).
 *
 * - Entry point test: `tests/support/merged-fixtures.ts` (mandate playwright-utils);
 *   spec TIDAK boleh impor `test` dari '@playwright/test' langsung.
 * - Timeout standar TEA: aksi 15s, navigasi 30s, test 60s.
 * - Multi-browser: kontrak PWA (SYS-E2E-001 / R-006) diverifikasi di
 *   Chromium + Firefox + WebKit.
 * - webServer menjalankan `nuxt dev` lokal; di CI server disediakan env
 *   BASE_URL dan tidak di-reuse.
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',

  timeout: 60_000,
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  globalSetup: './tests/support/global-setup.ts',
  globalTeardown: './tests/support/global-teardown.ts',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
