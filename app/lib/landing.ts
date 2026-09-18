import type { Role } from '#shared/domain/identity'

/** Kode status keputusan resolver landing: 401 = belum login (dialihkan ke
 *  /login); status lain diteruskan ke error page. */
export const HTTP_UNAUTHORIZED = 401
export const HTTP_SERVER_ERROR = 500

/**
 * Kontrak respons GET /api/landing (server/api/landing.get.ts) — bentuk wire
 * untuk lapis halaman; keputusan kanoniknya di `server/domain/identity`.
 */
export type LandingRespons = { path: string, role: Role } | { unlinked: true }

/** Kontrak respons GET /api/register/status (khusus calon owner). */
export interface StatusPendaftaranRespons {
  status: 'diajukan' | 'ditolak' | 'kedaluwarsa'
  rejectionReason: string
}
