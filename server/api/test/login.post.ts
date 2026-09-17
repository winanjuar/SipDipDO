import { timingSafeEqual } from 'node:crypto'
import { defineEventHandler, getRequestProtocol, getHeader, readBody } from 'h3'
import { encode } from 'next-auth/jwt'
import { CALON_OWNER_STATUSES, OWNER_STATUSES, type OwnerStatus } from '#shared/domain/identity'
import {
  closeActiveCooTenures,
  openCooTenure,
  upsertOwnerByEmail,
} from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'

/**
 * POST /api/test/login — session-minting DEV-ONLY untuk E2E/API test (pola 1
 * test design R-003, blocker #2, dikonfirmasi user 2026-09-16): men-seed owner
 * SINTETIS sesuai konfigurasi lalu menerbitkan cookie sesi NuxtAuth yang sah
 * memakai secret NuxtAuth yang sama — bukan bypass auth, tanpa adapter.
 *
 * Triple guard WAJIB (semua harus lolos, predikat murni `tripleGuardLolos`):
 * NODE_ENV ≠ production + env ENABLE_TEST_AUTH aktif + header TEST_AUTH_SECRET
 * cocok dengan env TEST_AUTH_SECRET. Di produksi endpoint ini mati total.
 *
 * `userIdentifier: 'unlinked'` = mint sesi TANPA baris owner — mensimulasikan
 * akun Google yang tidak terhubung ke owner/pendaftar mana pun.
 */

/** Nama cookie sesi next-auth v4 (http) — varian `__Secure-` untuk https. */
const NAMA_COOKIE_SESI_HTTP = 'next-auth.session-token'
/** Awalan cookie aman next-auth v4 (https) — di-set hanya via koneksi aman. */
const PREFIX_COOKIE_AMAN = '__Secure-'

/**
 * Kontrak email sintetis mint (spec PRD Lampiran A: akun owner = akun Google):
 * domain WAJIB @gmail.com; awalan `uji.snddash.e2e.` menandai baris uji E2E
 * sekaligus kunci anti-timpa — berbeda dari baris seed dev (`uji.snddash.*`,
 * drizzle/seed.ts) sehingga mint tidak pernah menimpa baris non-sintetis
 * maupun baris seed dev (email unik = kunci pencocokan, AD-11).
 */
const DOMAIN_EMAIL_GOOGLE = '@gmail.com'
const PREFIX_EMAIL_UJI = 'uji.snddash.e2e.'

/** Umur maksimum sesi mint — pin default next-auth v4 (30 hari). */
const HARI_UMUR_SESI = 30
const JAM_PER_HARI = 24
const MENIT_PER_JAM = 60
const DETIK_PER_MENIT = 60
const UMUR_SESI_DETIK = HARI_UMUR_SESI * JAM_PER_HARI * MENIT_PER_JAM * DETIK_PER_MENIT

/** Konfigurasi owner sintetis per identifier uji (di-override body bila ada). */
const KONFIGURASI_UJI: Record<
  string,
  { status: OwnerStatus, cooAktif?: boolean, punyaSaham?: boolean, alasanPenolakan?: string }
> = {
  'coo': { status: 'terverifikasi', cooAktif: true, punyaSaham: true },
  'pemegang-saham': { status: 'terverifikasi', punyaSaham: true },
  'tanpa-saham': { status: 'terverifikasi', punyaSaham: false },
  'keluar': { status: 'keluar', punyaSaham: true },
  'calon-diajukan': { status: 'diajukan' },
  'calon-ditolak': { status: 'ditolak', alasanPenolakan: 'Alasan penolakan sintetis untuk uji.' },
  'calon-kedaluwarsa': { status: 'kedaluwarsa' },
}

interface LoginUjiBody {
  userIdentifier?: string
  email?: string
  status?: string
  cooAktif?: boolean
  punyaSaham?: boolean
  alasanPenolakan?: string
}

/** Secret header vs env — bandingkan panjang BYTE sebelum timingSafeEqual. */
function secretCocok(presented: string, registered: string): boolean {
  return (
    registered.length > 0
    && Buffer.byteLength(presented, 'utf8') === Buffer.byteLength(registered, 'utf8')
    && timingSafeEqual(Buffer.from(presented, 'utf8'), Buffer.from(registered, 'utf8'))
  )
}

/** Input predikat triple guard — murni agar kaki guard teruji unit. */
export interface TandaTanganGuard {
  nodeEnv: string | undefined
  enableFlag: string | undefined
  presentedSecret: string
  registeredSecret: string
}

/** Predikat triple guard (murni): NODE_ENV ≠ production + flag aktif + secret cocok. */
export function tripleGuardLolos(input: TandaTanganGuard): boolean {
  return (
    input.nodeEnv !== 'production'
    && (input.enableFlag === '1' || input.enableFlag === 'true')
    && secretCocok(input.presentedSecret, input.registeredSecret)
  )
}

/** Predikat murni (murni agar teruji unit): email sintetis mint = awalan uji
 *  E2E + domain @gmail.com — case-insensitive. */
export function emailUjiSah(email: string): boolean {
  const dinormalkan = email.toLowerCase()
  return dinormalkan.startsWith(PREFIX_EMAIL_UJI) && dinormalkan.endsWith(DOMAIN_EMAIL_GOOGLE)
}

/** Identifier uji → bagian-lokal Gmail-sahih (huruf kecil, titik pemisah). */
function lokalIdentifier(identifier: string): string {
  const lokal = identifier.toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return lokal.length > 0 ? lokal : 'uji'
}

export default defineEventHandler(async (event) => {
  const env = process.env
  if (!tripleGuardLolos({
    nodeEnv: env.NODE_ENV,
    enableFlag: env.ENABLE_TEST_AUTH,
    presentedSecret: getHeader(event, 'test_auth_secret') ?? '',
    registeredSecret: env.TEST_AUTH_SECRET ?? '',
  })) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'TEST_AUTH_DISABLED',
      message: 'Endpoint session-minting hanya untuk pengujian (triple guard tidak terpenuhi).',
      details: {},
    })
  }

  const body = (await readBody<LoginUjiBody>(event).catch(() => undefined)) ?? {}
  const userIdentifier = typeof body.userIdentifier === 'string' ? body.userIdentifier : ''
  if (userIdentifier.length === 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'userIdentifier wajib diisi.',
      details: {},
    })
  }

  // Email override HARUS tetap email sintetis mint (awalan uji E2E + domain
  // @gmail.com) — tanpa ini mint bisa menimpa baris owner non-sintetis
  // (email unik = kunci pencocokan, AD-11).
  const emailDiisi = typeof body.email === 'string' ? body.email.trim() : ''
  if (emailDiisi !== '' && !emailUjiSah(emailDiisi)) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: `Email uji harus berawalan '${PREFIX_EMAIL_UJI}' dan berakhiran '${DOMAIN_EMAIL_GOOGLE}'.`,
      details: {},
    })
  }
  const email = emailDiisi !== ''
    ? emailDiisi
    : `${PREFIX_EMAIL_UJI}${lokalIdentifier(userIdentifier)}${DOMAIN_EMAIL_GOOGLE}`

  // cooAktif/punyaSaham diterima hanya sebagai boolean — string 'false' dkk.
  // tidak pernah di-coerce truthy.
  if (body.cooAktif !== undefined && typeof body.cooAktif !== 'boolean') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'cooAktif harus bertipe boolean.',
      details: {},
    })
  }
  if (body.punyaSaham !== undefined && typeof body.punyaSaham !== 'boolean') {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'punyaSaham harus bertipe boolean.',
      details: {},
    })
  }

  const db = useDb()

  if (userIdentifier !== 'unlinked') {
    const preset = KONFIGURASI_UJI[userIdentifier]
    const status = (body.status && OWNER_STATUSES.includes(body.status as OwnerStatus)
      ? body.status
      : preset?.status) as OwnerStatus | undefined
    if (!status) {
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'BAD_REQUEST',
        message: `Konfigurasi owner sintetis tidak dikenal untuk '${userIdentifier}'.`,
        details: { dikenal: Object.keys(KONFIGURASI_UJI) },
      })
    }
    const cooAktif = body.cooAktif ?? preset?.cooAktif ?? false
    const punyaSaham = body.punyaSaham ?? preset?.punyaSaham ?? false
    if (CALON_OWNER_STATUSES.includes(status) && (cooAktif || punyaSaham)) {
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'BAD_REQUEST',
        message: 'Persona konflik: status calon tidak boleh digabung dengan cooAktif/punyaSaham.',
        details: { status },
      })
    }
    const alasanPenolakan = status === 'ditolak'
      ? (body.alasanPenolakan ?? preset?.alasanPenolakan ?? 'Alasan penolakan sintetis untuk uji.')
      : null

    const now = new Date()
    const owner = await upsertOwnerByEmail(db, {
      email,
      status,
      rejectionReason: alasanPenolakan,
      firstEffectiveAt: punyaSaham ? now.toISOString() : null,
    })
    if (cooAktif) {
      await openCooTenure(db, owner.id, now)
    } else {
      await closeActiveCooTenures(db, owner.id, now)
    }
  }

  // Nama + flag secure cookie mengikuti protokol request (varian __Secure-
  // next-auth.session-token di https) — sesi mint dikenali server di dua skema.
  const cookieAman = getRequestProtocol(event, { xForwardedProto: true }) === 'https'
  const namaCookieSesi = cookieAman ? `${PREFIX_COOKIE_AMAN}${NAMA_COOKIE_SESI_HTTP}` : NAMA_COOKIE_SESI_HTTP

  const authSecret = useRuntimeConfig().authSecret
  if (!authSecret) {
    return sendApiError(event, HTTP_STATUS.serviceUnavailable, {
      code: 'AUTH_UNCONFIGURED',
      message: 'NUXT_AUTH_SECRET belum dikonfigurasi — cookie sesi tidak dapat diterbitkan.',
      details: {},
    })
  }

  const token = await encode({
    secret: authSecret,
    maxAge: UMUR_SESI_DETIK,
    token: { sub: userIdentifier, email, name: 'Pemilik Uji Sintetis' },
  })

  return {
    cookies: [{ name: namaCookieSesi, value: token, path: '/', httpOnly: true, secure: cookieAman, sameSite: 'Lax' }],
  }
})
