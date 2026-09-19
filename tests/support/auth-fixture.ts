/**
 * AUTH — provider NuxtAuth untuk utilitas auth-session (playwright-utils).
 *
 * Enam member AuthProvider WAJIB ada (mandate auth-session.md — jangan
 * diringkas): getEnvironment, getUserIdentifier, extractToken, extractCookies,
 * isTokenExpired, manageAuthToken.
 *
 * Story 1.2 (green phase): `manageAuthToken` diisi dengan POST /api/test/login
 * — endpoint session-minting dev-only triple-guard (NODE_ENV ≠ production +
 * ENABLE_TEST_AUTH + TEST_AUTH_SECRET) yang men-seed owner sintetis lalu
 * menerbitkan cookie sesi NuxtAuth asli (secret NuxtAuth sama, bukan bypass).
 * Nama cookie `next-auth.session-token` terverifikasi lewat uji mint
 * (`landing.api.spec.ts`); varian `__Secure-` berlaku bila BASE_URL https —
 * dev lokal memakai http.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test as base } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { log } from '@seontechnologies/playwright-utils'
import {
  createAuthFixtures,
  setAuthProvider,
  type AuthOptions,
  type AuthProvider,
} from '@seontechnologies/playwright-utils/auth-session'
import { EMAIL_OWNER_UJI_TERDAFTAR, emailMintDefault } from './helpers/sesi-minting'

/** Nama cookie session next-auth v4 — varian `__Secure-` di https; diturunkan
 *  dari skema BASE_URL (sinkron dengan derivasi di server/api/test/login.post.ts
 *  dan landing.api.spec.ts). */
const COOKIE_AMAN = new URL(process.env.BASE_URL ?? 'http://localhost:3000').protocol === 'https:'
const NAMA_COOKIE_SESSION = COOKIE_AMAN ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

/** Secret guard endpoint dev-only — fallback wajib identik dengan env
 *  TEST_AUTH_SECRET yang dipakai server uji lokal (dan helper sesi-minting). */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

const baseUrlDefault = (): string => process.env.BASE_URL ?? 'http://localhost:3000'

/** Bentuk cookie yang diterbitkan /api/test/login (storage-state). */
interface CookieMint {
  name: string
  value: string
  path?: string
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export const authProviderNuxtAuth: AuthProvider = {
  getEnvironment: (options) => options.environment ?? process.env.TEST_ENV ?? 'local',

  /**
   * Member opsional — dipakai fixture context auth-session sebagai sumber
   * baseURL (rantai fallback authOptions → provider → opsi browser → env);
   * tanpa ini context custom kehilangan baseURL dan `page.goto` relatif gagal.
   */
  getBaseUrl: () => baseUrlDefault(),

  getUserIdentifier: (options) => options.userIdentifier ?? 'default',

  extractToken: (storageState) => {
    const cookies = Array.isArray(storageState.cookies) ? storageState.cookies as CookieMint[] : []
    return cookies.find(c => c.name === NAMA_COOKIE_SESSION)?.value ?? null
  },

  extractCookies: (tokenData) => {
    // tokenData = storage state hasil manageAuthToken (atau raw token string
    // bila caller menyuntikkan langsung — dukung keduanya).
    const cookies = Array.isArray(tokenData.cookies) ? tokenData.cookies as CookieMint[] : []
    const cookieSesi = cookies.find(c => c.name === NAMA_COOKIE_SESSION)
    const value = cookieSesi?.value ?? (typeof tokenData === 'string' ? tokenData : undefined)
    if (!value) return []

    // hostname TANPA port — domain cookie tidak boleh memuat port.
    return [{
      name: NAMA_COOKIE_SESSION,
      value,
      domain: new URL(baseUrlDefault()).hostname,
      path: cookieSesi?.path ?? '/',
      httpOnly: true,
      secure: COOKIE_AMAN,
      sameSite: 'Lax',
    }]
  },

  // Cookie sesi NuxtAuth membawa expiry sendiri (JWT 30 hari); konservatif:
  // anggap masih berlaku sehingga token cache dipakai ulang dalam satu run.
  isTokenExpired: () => false,

  /**
   * Mint cookie sesi via POST /api/test/login (request API murni — pola
   * auth-session.md § Custom Auth Provider Pattern). Respons endpoint berbentuk
   * storage-state `{ cookies: [...] }`; kembalikan apa adanya sebagai token
   * data — `extractToken`/`extractCookies` membaca cookie sesi dari situ.
   */
  manageAuthToken: async (request: APIRequestContext, options?: Partial<AuthOptions>) => {
    const baseUrl = authProviderNuxtAuth.getBaseUrl?.(options) ?? baseUrlDefault()
    const userIdentifier = authProviderNuxtAuth.getUserIdentifier(options)

    // 'default' = sentinel fixture auth-session (context tanpa test.use
    // authOptions) — konteks ANONIM: tanpa seed owner, tanpa cookie sesi.
    // Test yang butuh sesi men-declare `test.use({ authOptions: … })` dengan
    // identifier valid atau memakai helper `mintSesiPemilik` secara eksplisit.
    if (userIdentifier === 'default') {
      return { cookies: [], origins: [] }
    }

    // Daftarkan email owner sintetis (derivation cermin login.post) — baris
    // yang dibuat endpoint direset fixture cleanup pasca-test (Story 1.5:
    // laporan penumpukan baris `uji.snddash.e2e.*`).
    EMAIL_OWNER_UJI_TERDAFTAR.add(emailMintDefault(userIdentifier))

    const response = await request.post(`${baseUrl}/api/test/login`, {
      data: { userIdentifier },
      headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
    })
    if (!response.ok()) {
      const status = response.status()
      const body = await response.text().catch(() => '')
      throw new Error(
        `auth-fixture: mint sesi gagal (POST /api/test/login -> ${status}). `
        + `Pastikan dev server berjalan dengan env ENABLE_TEST_AUTH=1 dan `
        + `TEST_AUTH_SECRET sesuai. ${body}`,
      )
    }

    const minted = (await response.json()) as { cookies: CookieMint[] }
    const domain = new URL(baseUrl).hostname

    const storageState = {
      cookies: minted.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain,
        path: cookie.path ?? '/',
        expires: -1,
        httpOnly: cookie.httpOnly ?? true,
        secure: cookie.secure ?? COOKIE_AMAN,
        sameSite: cookie.sameSite ?? 'Lax',
      })),
      origins: [],
    }

    // Persist sesi ke storage-state file (konvensi auth-session:
    // .auth/<environment>/<userIdentifier>/storage-state.json) — fixture
    // `context` membaca file ini saat membangun browser context.
    try {
      const file = path.join(
        process.cwd(),
        '.auth',
        authProviderNuxtAuth.getEnvironment(options),
        userIdentifier,
        'storage-state.json',
      )
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(storageState))
    } catch (error) {
      log.warningSync(
        `auth-fixture: gagal menyimpan storage state (${error instanceof Error ? error.message : String(error)}) — `
        + 'fixture context mungkin gagal membaca sesi.',
      )
    }

    return storageState
  },
}

setAuthProvider(authProviderNuxtAuth)

export const test = base.extend(createAuthFixtures())
