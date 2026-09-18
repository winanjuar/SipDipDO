import { buildPrincipal, createIdentityRepo, LANDING_PATH } from '../domain/identity'
import { getSessionEmail } from '../utils/session'
import { useDb } from '../utils/db'

/**
 * Proteksi sesi SSR (AD-8): permintaan dokumen/payload ke halaman terproteksi
 * tanpa sesi sah dialihkan ke `/login` sebelum render. Himpunan halaman
 * terproteksi = nilai `LANDING_PATH` + halaman Kelengkapan Profile (Story 1.5).
 *
 * Gerbang calon belum lengkap (Story 1.5, UX-DR14/AD-8): calon `diajukan`
 * dengan Profil belum lengkap yang membuka permukaan lain di luar
 * `/profile-completeness` dan `/status-pendaftaran` dialihkan ke
 * `/profile-completeness` DI BATAS SERVER. Calon `lengkap`/`ditolak`/
 * `kedaluwarsa` dan non-calon TIDAK berubah (landing 1.2 tetap).
 * Route handler tetap wajib auth sendiri (AD-8: middleware + route handler).
 */
const PATH_KELENGKAPAN_PROFIL = '/profile-completeness'

const HALAMAN_TERPROTEKSI: ReadonlySet<string> = new Set([
  ...Object.values(LANDING_PATH),
  PATH_KELENGKAPAN_PROFIL,
])

/** Permukaan yang tetap terjangkau calon `diajukan` belum lengkap (UX-DR14). */
const PENGECUALIAN_CALON_BELUM_LENGKAP: ReadonlySet<string> = new Set([
  PATH_KELENGKAPAN_PROFIL,
  LANDING_PATH.calon_owner,
])

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!HALAMAN_TERPROTEKSI.has(path)) return

  const email = await getSessionEmail(event)
  if (!email) return sendRedirect(event, '/login')

  if (PENGECUALIAN_CALON_BELUM_LENGKAP.has(path)) return

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return
  if (principal.role !== 'calon_owner') return
  if (principal.owner.status !== 'diajukan') return
  // Calon `diajukan` Lengkap lolos gerbang kelengkapan — kembali ke landing
  // calonnya (UX-DR14: calon tetap di /status-pendaftaran), bukan ke
  // /profile-completeness.
  if (principal.owner.profilLengkap) return sendRedirect(event, LANDING_PATH.calon_owner)
  return sendRedirect(event, PATH_KELENGKAPAN_PROFIL)
})
