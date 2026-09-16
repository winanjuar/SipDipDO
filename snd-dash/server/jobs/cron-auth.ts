// server/jobs/cron-auth.ts
//
// Proteksi endpoint cron dengan `CRON_SECRET` (design.md Security Considerations
// / AD-9): "Cron endpoint terproteksi CRON_SECRET". Vercel Cron memicu endpoint
// (UTC) dengan menyertakan secret pada header; endpoint memverifikasi sebelum
// menjalankan job. Batas hari SELALU dihitung di dalam job (Asia/Jakarta), bukan
// dari jam pemicu UTC.
//
// Membaca env lewat pola `globalThis.process` yang sama dengan
// `server/utils/db.ts` agar type-check tetap lolos tanpa `@types/node` pada
// tsconfig server terisolasi.

/**
 * Membaca variabel environment tanpa bergantung pada `@types/node`.
 * Nitro/Node menyediakan `process.env` saat runtime; helper ini membacanya lewat
 * `globalThis` sehingga type-check lolos meski `@types/node` belum terpasang.
 */
export function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[key]
}

/**
 * Header yang boleh membawa `CRON_SECRET`. Vercel Cron dapat dikonfigurasi
 * mengirim `Authorization: Bearer <CRON_SECRET>`; sebagai alternatif eksplisit
 * kami juga menerima `x-cron-secret: <CRON_SECRET>`.
 */
export const CRON_SECRET_HEADERS = {
  authorization: 'authorization',
  xCronSecret: 'x-cron-secret',
} as const

/**
 * Mengekstrak secret yang dikirim pemanggil dari nilai header yang tersedia.
 * Menerima:
 *   - `Authorization: Bearer <secret>` (prefix 'Bearer ' di-strip, case-insensitive),
 *   - `Authorization: <secret>` (tanpa prefix),
 *   - `x-cron-secret: <secret>`.
 * Mengembalikan `null` bila tidak ada satu pun.
 */
export function extractProvidedSecret(headers: {
  authorization?: string | null
  xCronSecret?: string | null
}): string | null {
  const { authorization, xCronSecret } = headers
  if (xCronSecret && xCronSecret.length > 0) return xCronSecret
  if (authorization && authorization.length > 0) {
    const bearer = /^Bearer\s+(.+)$/i.exec(authorization)
    return bearer ? bearer[1]! : authorization
  }
  return null
}

/** Hasil verifikasi secret cron. */
export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'missing' | 'mismatch' }

/**
 * Memverifikasi `provided` terhadap `CRON_SECRET` dari environment (FUNGSI MURNI
 * atas input; membaca env sekali). Menolak bila:
 *   - `not_configured` : `CRON_SECRET` tidak diset di server (fail-closed),
 *   - `missing`        : pemanggil tidak menyertakan secret,
 *   - `mismatch`       : secret tidak cocok.
 * Perbandingan panjang-tetap sederhana untuk mengurangi kebocoran timing.
 */
export function verifyCronSecret(provided: string | null): CronAuthResult {
  const expected = readEnv('CRON_SECRET')
  if (!expected || expected.length === 0) return { ok: false, reason: 'not_configured' }
  if (!provided || provided.length === 0) return { ok: false, reason: 'missing' }
  if (!constantTimeEquals(provided, expected)) return { ok: false, reason: 'mismatch' }
  return { ok: true }
}

/**
 * Perbandingan string waktu-hampir-konstan (tanpa dependensi Node `crypto`):
 * selalu memindai seluruh panjang `expected`, meng-OR selisih byte. Bukan
 * pengganti sempurna kripto, namun menghindari short-circuit `===` yang bocor
 * panjang/awalan pada perbandingan naif.
 */
function constantTimeEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}
