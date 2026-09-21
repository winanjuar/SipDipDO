import {
  aksesPenuh,
  buildPrincipal,
  createIdentityRepo,
  LANDING_PATH,
  permukaanDibolehkan,
} from '../domain/identity'
import { getSessionEmail } from '../utils/session'
import { useDb } from '../utils/db'

/**
 * Proteksi sesi SSR (AD-8): permintaan dokumen/payload ke halaman terproteksi
 * tanpa sesi sah dialihkan ke `/login` sebelum render. Himpunan halaman
 * terproteksi = nilai `LANDING_PATH` + halaman Kelengkapan Profile (Story
 * 1.5) + Audit Trail (permukaan COO di luar `LANDING_PATH`).
 *
 * Gerbang calon belum lengkap (Story 1.5, UX-DR14/AD-8): calon `diajukan`
 * dengan Profil belum lengkap yang membuka permukaan lain di luar
 * `/profile-completeness` dan `/status-pendaftaran` dialihkan ke
 * `/profile-completeness` DI BATAS SERVER. Calon `lengkap`/`ditolak`/
 * `kedaluwarsa` dan non-calon TIDAK berubah (landing 1.2 tetap).
 *
 * Gerbang role matriks keterbukaan (Story 1.7, FR-15 §4.8, AD-8) —
 * BERURUTAN sesudah gerbang calon (precedence calon 1.5 tetap):
 * registry-driven via `permukaanDibolehkan` (data di `shared/domain`,
 * logika umum di sini — Epic 2–4 menambah permukaan TANPA menyentuh
 * middleware). Keputusan ATAS SNAPSHOT owner, BUKAN role saja: `resolveRole`
 * memetakan `keluar` → `tanpa_saham` SEBELUM melihat `firstEffectiveAt`,
 * sehingga keluar-PERNAH-beli (role tanpa_saham, `aksesPenuh=true`) TETAP
 * boleh `/dashboard`; hanya `tanpa_saham`+`!aksesPenuh` yang dialihkan ke
 * `/personal?info=transparansi` (pesan verbatim `PESAN_TRANSPARANSI` — via
 * query param karena redirect server tidak dapat menulis sessionStorage);
 * salah permukaan role-lain → landing role-nya. Route handler tetap wajib
 * auth sendiri (AD-8: middleware + route handler).
 */
const PATH_KELENGKAPAN_PROFIL = '/profile-completeness'

/** Permukaan COO di luar nilai `LANDING_PATH` (Story 1.3/1.7). */
const PATH_AUDIT_TRAIL = '/audit-trail'

/** Query pesan transparensi — kontrak Halaman Personal (spec Story 1.7). */
const QUERY_INFO_TRANSPARANSI = '?info=transparansi'

const HALAMAN_TERPROTEKSI: ReadonlySet<string> = new Set([
  ...Object.values(LANDING_PATH),
  PATH_KELENGKAPAN_PROFIL,
  PATH_AUDIT_TRAIL,
])

/** Permukaan yang tetap terjangkau calon `diajukan` belum lengkap (UX-DR14). */
const PENGECUALIAN_CALON_BELUM_LENGKAP: ReadonlySet<string> = new Set([
  PATH_KELENGKAPAN_PROFIL,
  LANDING_PATH.calon_owner,
])

export default defineEventHandler(async (event) => {
  // Normalisasi pathname (review Story 1.7): trailing slash (`/dashboard/`)
  // TIDAK boleh meleset dari lookup gerbang — vue-router strict:false tetap
  // merender varian ber-slash, sehingga tanpa ini permukaan terkunci lolos
  // di batas server (AD-8).
  const pathMentah = getRequestURL(event).pathname
  const path = pathMentah.length > 1 && pathMentah.endsWith('/')
    ? pathMentah.replace(/\/+$/, '')
    : pathMentah
  if (!HALAMAN_TERPROTEKSI.has(path)) return

  const email = await getSessionEmail(event)
  if (!email) return sendRedirect(event, '/login')

  if (PENGECUALIAN_CALON_BELUM_LENGKAP.has(path)) return

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return

  // Gerbang calon 1.5 — dievaluasi SEBELUM gerbang role (precedence). Hanya
  // calon `diajukan` yang diurus gerbang ini; calon `ditolak`/`kedaluwarsa`
  // JATUH ke gerbang role di bawah (matriks baris "calon × permukaan" —
  // landing calon `/status-pendaftaran`, bukan shell permukaan terkunci).
  if (principal.role === 'calon_owner' && principal.owner.status === 'diajukan') {
    // Calon `diajukan` Lengkap lolos gerbang kelengkapan — kembali ke landing
    // calonnya (UX-DR14: calon tetap di /status-pendaftaran), bukan ke
    // /profile-completeness.
    if (principal.owner.profilLengkap) return sendRedirect(event, LANDING_PATH.calon_owner)
    return sendRedirect(event, PATH_KELENGKAPAN_PROFIL)
  }

  // Gerbang role Story 1.7 — registry-driven; permukaan di luar registry
  // tidak digerbangi di sini.
  if (!permukaanDibolehkan(principal, path)) {
    // tanpa_saham belum-pernah-beli × permukaan terkunci matriks → pesan
    // transparensi (AD-8/UX-DR14 — bukan sekadar disembunyikan di UI).
    if (principal.role === 'tanpa_saham' && !aksesPenuh(principal.owner)) {
      return sendRedirect(event, `${LANDING_PATH.tanpa_saham}${QUERY_INFO_TRANSPARANSI}`)
    }
    // Salah permukaan role-lain → landing role-nya (UX-DR14).
    return sendRedirect(event, LANDING_PATH[principal.role])
  }
})
