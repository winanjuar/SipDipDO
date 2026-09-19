/**
 * MERGED FIXTURES — SATU-SATUNYA entry point `test` untuk seluruh spec
 * (mandate playwright-utils: spec dilarang impor `test` dari
 * '@playwright/test' langsung; `expect` boleh karena playwright-utils tidak
 * mengekspor expect sendiri).
 *
 * Komposisi (stack frontend → intercept + networkError ikut serta):
 * - apiRequest        : klien HTTP tervalidasi schema (semua panggilan API test)
 * - recurse           : polling kondisi eventual-consistent
 * - intercept         : spy/stub jaringan UI (deklarasikan SEBELUM page.goto)
 * - networkError      : gagal-otomatis saat UI hijau menyembunyikan 4xx/5xx
 * - auth              : token sesi (provider NuxtAuth — lihat auth-fixture.ts)
 * - cleanup           : disposisi data seed per-test
 */
import { mergeTests } from '@playwright/test'
import { log } from '@seontechnologies/playwright-utils'
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures'
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures'
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures'
import { test as networkErrorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures'
import { test as authFixture } from './auth-fixture'
import { test as cleanupFixture, testWorker as cleanupWorkerFixture } from './fixtures/cleanup'

export const test = mergeTests(
  apiRequestFixture,
  recurseFixture,
  interceptFixture,
  networkErrorFixture,
  authFixture,
  cleanupFixture,
  cleanupWorkerFixture,
)

export { expect } from '@playwright/test'
export { log }
