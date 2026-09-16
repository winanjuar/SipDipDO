/**
 * AUTH — provider NuxtAuth untuk utilitas auth-session (playwright-utils).
 *
 * Enam member AuthProvider WAJIB ada (mandate auth-session.md — jangan
 * diringkas): getEnvironment, getUserIdentifier, extractToken, extractCookies,
 * isTokenExpired, manageAuthToken.
 *
 * Status scaffold (2026-09-16): endpoint akuisisi token belum ada — login
 * produksi memakai OAuth Google (tidak bisa didorong headless tanpa kredensial)
 * dan OTP masih Story 1.4+. `manageAuthToken` dan nama cookie session ditandai
 * TODO di bawah; fixture `authToken` akan melempar error eksplisit sampai TODO
 * tersebut diisi. JANGAN mengganti ini dengan fixture login via form.
 */
import { test as base } from '@playwright/test'
import { log } from '@seontechnologies/playwright-utils'
import {
  createAuthFixtures,
  setAuthProvider,
  type AuthProvider,
} from '@seontechnologies/playwright-utils/auth-session'

/** TODO(verifikasi): nama cookie session next-auth v4 (sidebase/nuxt-auth 1.3.1)
 *  — `next-auth.session-token` (http) / `__Secure-next-auth.session-token`
 *  (https). Konfirmasi saat uji session nyata (Story 1.2+). */
const NAMA_COOKIE_SESSION = 'next-auth.session-token'

export const authProviderNuxtAuth: AuthProvider = {
  getEnvironment: (options) => options.environment ?? process.env.TEST_ENV ?? 'local',

  /**
   * Member opsional — dipakai fixture context auth-session sebagai sumber
   * baseURL (rantai fallback authOptions → provider → opsi browser → env);
   * tanpa ini context custom kehilangan baseURL dan `page.goto` relatif gagal.
   */
  getBaseUrl: () => process.env.BASE_URL ?? 'http://localhost:3000',

  getUserIdentifier: (options) => options.userIdentifier ?? 'pemilik-utama',

  extractToken: (storageState) =>
    storageState.cookies.find((c) => c.name === NAMA_COOKIE_SESSION)?.value,

  // TODO(auth): konversi token -> cookie context browser; lengkapi bersama
  // verifikasi NAMA_COOKIE_SESSION saat session nyata bisa dibuat di uji.
  extractCookies: (tokenData) => [
    {
      name: NAMA_COOKIE_SESSION,
      value: tokenData,
      domain: new URL(process.env.BASE_URL ?? 'http://localhost:3000').host,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ],

  // Tanpa cookie expiry dari next-auth; konservatif: anggap masih berlaku
  // sehingga token cache dipakai ulang. TODO(auth): deteksi expiry sesi nyata.
  isTokenExpired: () => false,

  // TODO(auth): endpoint akuisisi token belum ada (OAuth Google + OTP = Story
  // 1.2/1.4+). Saat endpoint registrasi/login programatik tersedia, isi dengan
  // request API murni (pola auth-session.md § Custom Auth Provider Pattern).
  // Sementara: kembalikan sesi KOSONG (tidak terautentikasi) agar fixture
  // auth yang bersifat auto tidak mematikan test permukaan publik; test yang
  // benar-benar butuh sesi akan gagal di asersinya sendiri.
  manageAuthToken: async () => {
    log.warningSync(
      'auth-fixture: manageAuthToken belum diimplementasikan — sesi kosong (tidak terautentikasi) dipakai. Lengkapi TODO auth di tests/support/auth-fixture.ts.',
    )
    return { cookies: [], origins: [] }
  },
}

setAuthProvider(authProviderNuxtAuth)

export const test = base.extend(createAuthFixtures())
