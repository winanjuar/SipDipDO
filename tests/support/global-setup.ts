/**
 * globalSetup Playwright — inisialisasi auth-session SEBELUM test berjalan.
 * Urutan mengikat (auth-session.md): authStorageInit → configureAuthSession →
 * setAuthProvider. `authGlobalInit` sengaja tidak dipanggil karena
 * `manageAuthToken` masih TODO (lihat auth-fixture.ts) — prefetch token akan
 * melempar; fixture authToken mengambil token secara lazy saat dibutuhkan.
 *
 * Catatan API: playwright-utils v4 memakai opsi `storageDir` (default
 * `process.cwd()/.auth`) — nama `authStoragePath` pada dokumentasi lama sudah
 * tidak berlaku.
 */
import {
  authStorageInit,
  configureAuthSession,
  setAuthProvider,
} from '@seontechnologies/playwright-utils/auth-session'
import { authProviderNuxtAuth } from './auth-fixture'

export default function globalSetup(): void {
  authStorageInit()

  configureAuthSession({
    storageDir: new URL('./auth-sessions/', import.meta.url).pathname,
    debug: !!process.env.CI,
  })

  setAuthProvider(authProviderNuxtAuth)
}
