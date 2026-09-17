/**
 * Helper sesi-minting uji — pasangan endpoint dev-only `/api/test/login`
 * (triple guard: NODE_ENV ≠ production + ENABLE_TEST_AUTH + TEST_AUTH_SECRET,
 * pola 1 test design R-003/blocker #2 yang dikonfirmasi user 2026-09-16).
 *
 * Kontrak: POST /api/test/login dengan konfigurasi owner SINTETIS → endpoint
 * men-seed owner sesuai konfigurasi lalu me-mint cookie sesi NuxtAuth yang
 * sah; respons berbentuk storage-state `{ cookies: [...] }` (kontrak yang
 * sama dikonsumsi `manageAuthToken` di auth-fixture.ts — sudah ter-wiring
 * sejak green phase Story 1.2). Helper ini memetakan hasilnya ke bentuk
 * cookie Playwright siap `context.addCookies(...)`.
 *
 * Identifier `'unlinked'` = mint sesi TANPA baris owner — mensimulasikan
 * akun Google yang tidak terhubung ke owner/pendaftar mana pun.
 */
import type { Cookie } from '@playwright/test'
import type { ApiRequestFixtureParams } from '@seontechnologies/playwright-utils/api-request'
import type { StatusPemegang } from '../factories/owner-factory'

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper. */
type ApiRequestSesi = <T = unknown>(
  params: ApiRequestFixtureParams,
) => Promise<{ status: number, body: T }>

/** Secret guard — fallback wajib identik dengan env TEST_AUTH_SECRET server uji lokal. */
const SECRET_TEST_AUTH = process.env.TEST_AUTH_SECRET ?? 'test-secret-lokal'

/** Fallback domain/path/httpOnly sesuai konvensi cookie NuxtAuth di auth-fixture.ts.
 *  hostname TANPA port — domain cookie tidak boleh memuat port (Firefox/WebKit
 *  menolak cookie ber-domain ber-port; Chromium memaafkannya). Flag secure +
 *  nama cookie diturunkan dari skema BASE_URL (varian __Secure- di https). */
const DOMAIN_DEFAULT = new URL(process.env.BASE_URL ?? 'http://localhost:3000').hostname
const SECURE_COOKIE = new URL(process.env.BASE_URL ?? 'http://localhost:3000').protocol === 'https:'
const PATH_COOKIE = '/'
const SAMESITE_COOKIE = 'Lax' as const

export interface KonfigurasiPemilikUji {
  /** Kunci sesi uji: 'coo' | 'pemegang-saham' | 'tanpa-saham' | 'keluar' | 'calon-*' | 'unlinked'. */
  userIdentifier: string
  /** Override email sintetis; tanpa ini endpoint yang memilih email sintetis. */
  email?: string
  status?: StatusPemegang
  /** Tenure COO aktif (precedence landing tertinggi). */
  cooAktif?: boolean
  /** first_effective_at terisi → role pemegang_saham. */
  punyaSaham?: boolean
  /** Wajib untuk status 'ditolak' — tampil apa adanya di halaman status. */
  alasanPenolakan?: string
}

/** Bentuk cookie storage-state yang dikembalikan /api/test/login. */
interface CookieSesiMint {
  name: string
  value: string
  domain?: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * Me-mint cookie sesi untuk owner sintetis via endpoint dev-only, lalu
 * mengembalikan cookie siap `context.addCookies(...)`. Melempar error
 * eksplisit bila endpoint belum tersedia — kegagalan jujur saat red phase,
 * bukan skip diam-diam.
 */
export async function mintSesiPemilik(
  apiRequest: ApiRequestSesi,
  konfigurasi: KonfigurasiPemilikUji,
): Promise<Cookie[]> {
  const { status, body } = await apiRequest<{ cookies: CookieSesiMint[] }>({
    method: 'POST',
    path: '/api/test/login',
    body: konfigurasi,
    headers: { TEST_AUTH_SECRET: SECRET_TEST_AUTH },
  })

  if (status !== 200 || !Array.isArray(body.cookies) || body.cookies.length === 0) {
    throw new Error(
      `mintSesiPemilik: /api/test/login menjawab ${status} — endpoint dev-only Story 1.2 `
      + 'belum ada atau triple guard menolak. Aktifkan setelah endpoint session-minting '
      + 'diimplementasikan (server/api/test/login.post.ts).',
    )
  }

  return body.cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? DOMAIN_DEFAULT,
    path: cookie.path ?? PATH_COOKIE,
    httpOnly: cookie.httpOnly ?? true,
    secure: cookie.secure ?? SECURE_COOKIE,
    sameSite: cookie.sameSite ?? SAMESITE_COOKIE,
  }))
}
