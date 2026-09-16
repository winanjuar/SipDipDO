// server/utils/session.ts
//
// Perakitan `Principal` server-otoritatif untuk route handler (AD-8).
//
// Ini adalah lem tipis antara sesi autentikasi dan guard
// `server/utils/access.ts`. SUMBER KEBENARAN keputusan akses tetap
// `assertSurfaceAccess`/`assertCanFinalize` (access.ts); pemetaan error →
// respons seragam `{ code, message, details }` memakai `server/utils/http.ts`
// (`sendApiError`/`defineApiHandler`). File ini HANYA membangun `Principal` dari:
//   - sesi NuxtAuth (email Google, dicocokkan email owner saat migrasi — AD-8),
//   - status + firstEffectiveAt owner (dari `owners`),
//   - peran (`roles`) + otoritas COO bertugas pada `now()` (`coo_tenures`),
//   - kelengkapan Profile (`profiles`),
//   - poin Contribution belum ditunaikan (contribution.runningPoints, §16.11).
//
// CATATAN WIRING (task 18.3): handler NuxtAuth Google OAuth belum dipasang. Route
// me-resolve sesi lewat `getServerSession` (auto-import `#auth`) bila tersedia,
// dengan fallback header `x-owner-email` HANYA di lingkungan non-produksi untuk
// pengembangan/pengetesan route sebelum OAuth aktif. Saat OAuth aktif (18.3),
// `resolveSessionEmail` cukup mengandalkan `getServerSession` tanpa perubahan
// pemanggil.

import type { H3Event } from 'h3'
import { and, eq, isNull, gt, or } from 'drizzle-orm'
import { db, schema } from './db'
import { AccessError, type Principal, type Role } from './access'
import type { Uuid } from '../../shared/domain/types'
import { contribution } from '../domain/contribution'

const { roles: rolesTable, profiles, cooTenures, owners } = schema

// ---------------------------------------------------------------------------
// Resolusi email sesi
// ---------------------------------------------------------------------------

/**
 * Membaca environment tanpa bergantung pada `@types/node` (pola sama dengan
 * `db.ts`/`cron-auth.ts`).
 */
function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[key]
}

/**
 * Me-resolve email terautentikasi dari sesi.
 *
 * Prioritas:
 *   1. Sesi NuxtAuth (`getServerSession`) — `session.user.email` (AD-8).
 *   2. Fallback pengembangan: header `x-owner-email` HANYA bila `NODE_ENV !==
 *      'production'` (memungkinkan pengetesan route sebelum OAuth di-wire, 18.3).
 *
 * Mengembalikan `null` bila tidak ada email → caller melempar `UNAUTHENTICATED`.
 */
export async function resolveSessionEmail(event: H3Event): Promise<string | null> {
  // Resolusi sesi ANDAL: panggil endpoint next-auth internal '/api/auth/session'
  // dengan meneruskan cookie request. Endpoint ini men-decode JWT dan menjalankan
  // callback `session` (yang mengekspos email), sehingga konsisten dengan sisi
  // klien. Ini menghindari kuirk getToken (decrypt JWE) yang tak reliabel di sini.
  const cookieHeader = getRequestHeader(event, 'cookie') ?? ''
  if (cookieHeader.includes('next-auth.session-token')) {
    try {
      const session = await $fetch<{ user?: { email?: string | null } } | null>(
        '/api/auth/session',
        { headers: { cookie: cookieHeader } },
      )
      const email = session?.user?.email
      if (email) return email
    } catch {
      // gagal resolve — jatuh ke fallback dev
    }
  }

  if (readEnv('NODE_ENV') !== 'production') {
    const devEmail = getRequestHeader(event, 'x-owner-email')
    if (devEmail && devEmail.length > 0) return devEmail
  }

  return null
}

// ---------------------------------------------------------------------------
// Perakitan Principal
// ---------------------------------------------------------------------------

/** Membaca peran aktif seorang owner dari tabel `roles`. */
async function readRoles(ownerId: Uuid): Promise<Role[]> {
  const rows = await db
    .select({ role: rolesTable.role })
    .from(rolesTable)
    .where(eq(rolesTable.ownerId, ownerId))
  return rows.map((r) => r.role as Role)
}

/** Kelengkapan Profile owner (read-only, cermin identity repo). */
async function readProfileComplete(ownerId: Uuid): Promise<boolean> {
  const rows = await db
    .select({ isComplete: profiles.isComplete })
    .from(profiles)
    .where(eq(profiles.ownerId, ownerId))
    .limit(1)
  return rows.length > 0 ? rows[0]!.isComplete : false
}

/** true bila owner adalah COO yang bertugas pada `at` (tenure aktif). */
async function readIsCooOnDuty(ownerId: Uuid, at: Date): Promise<boolean> {
  const rows = await db
    .select({ id: cooTenures.id })
    .from(cooTenures)
    .where(
      and(
        eq(cooTenures.ownerId, ownerId),
        or(isNull(cooTenures.endedAt), gt(cooTenures.endedAt, at)),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * Membangun `Principal` terautentikasi untuk `event` (AD-8). Melempar
 * `AccessError('UNAUTHENTICATED')` bila tidak ada sesi/email atau email tidak
 * cocok dengan Owner mana pun.
 *
 * `isCooOnDuty` dihitung dari `coo_tenures` pada `now()` sehingga guard tetap
 * bebas I/O saat mengevaluasi permukaan COO-only. `hasUnredeemedPoints` diambil
 * dari poin Contribution berjalan (totalRunning > 0) untuk gerbang §16.11.
 */
export async function buildPrincipal(event: H3Event): Promise<Principal> {
  const email = await resolveSessionEmail(event)
  if (!email) {
    throw new AccessError('UNAUTHENTICATED', 'personal_page', 'Sesi tidak ditemukan.')
  }

  const ownerByEmail = await db
    .select({
      id: owners.id,
      status: owners.status,
      firstEffectiveAt: owners.firstEffectiveAt,
    })
    .from(owners)
    .where(eq(owners.email, email))
    .limit(1)

  if (ownerByEmail.length === 0) {
    throw new AccessError(
      'UNAUTHENTICATED',
      'personal_page',
      'Email sesi tidak cocok dengan Owner mana pun.',
    )
  }

  const row = ownerByEmail[0]!
  const ownerId = row.id as Uuid
  const now = new Date()

  const [roles, profileComplete, isCooOnDuty, points] = await Promise.all([
    readRoles(ownerId),
    readProfileComplete(ownerId),
    readIsCooOnDuty(ownerId, now),
    contribution.runningPoints(ownerId).catch(() => null),
  ])

  return {
    ownerId,
    roles: roles.length > 0 ? roles : ['owner'],
    status: row.status,
    firstEffectiveAt: row.firstEffectiveAt,
    isCooOnDuty,
    hasUnredeemedPoints: (points?.totalRunning ?? 0) > 0,
    profileComplete,
  }
}

/**
 * Menegakkan bahwa `principal` adalah COO yang BERTUGAS pada `now()` (§15.2/§15.3)
 * dan mengembalikan `ownerId`-nya sebagai `cooId` untuk diteruskan ke pintu domain
 * (setPrice/saveMom/defineItem/manualAdjust/rebalance/verify/reject/transferCoo).
 *
 * Melempar `AccessError('FORBIDDEN', …)` bila principal bukan COO bertugas. Guard
 * ini melengkapi `assertSurfaceAccess`: permukaan COO-only sudah dijaga oleh guard,
 * namun beberapa permukaan (harga/RKAP/kontribusi/distribusi) TERBUKA untuk dibaca
 * Owner biasa sementara aksi TULIS-nya tetap wewenang COO — `requireCoo` menjadi
 * gerbang tulis eksplisit yang mengembalikan `cooId` aktor.
 */
export function requireCoo(principal: Principal): Uuid {
  if (!principal.isCooOnDuty || !principal.roles.includes('coo')) {
    throw new AccessError(
      'FORBIDDEN',
      'queue_coo',
      'Aksi ini hanya untuk COO yang bertugas.',
    )
  }
  return principal.ownerId
}
