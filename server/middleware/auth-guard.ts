import {
  aksesPenuh,
  buildPrincipal,
  createIdentityRepo,
  KUNCI_COOKIE_INFO_TRANSPARANSI,
  LANDING_PATH,
  permukaanDibolehkan,
  prasyaratPermukaan,
} from '../domain/identity'
import { getSessionEmail } from '../utils/session'
import { useDb } from '../utils/db'

/**
 * Proteksi sesi SSR (AD-8): permintaan dokumen/payload ke halaman terproteksi
 * tanpa sesi sah dialihkan ke `/login` sebelum render. Keanggotaan halaman
 * terproteksi DERIVED dari registry (`prasyaratPermukaan` — Story 2.1b,
 * anti-drift: permukaan baru otomatis tergerbangi begitu terdaftar di
 * `shared/domain`) + gerbang sesi `LANDING_PATH` + halaman Kelengkapan
 * Profile (Story 1.5).
 *
 * Gerbang calon belum lengkap (Story 1.5, UX-DR14/AD-8): calon `diajukan`
 * dengan Profil belum lengkap yang membuka permukaan lain di luar
 * `/profile-completeness` dan `/registration-status` dialihkan ke
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
  * `/personal` (pesan verbatim `PESAN_TRANSPARANSI` — dikirim via flash-cookie
 * `KUNCI_COOKIE_INFO_TRANSPARANSI` karena redirect server tidak dapat menulis
 * sessionStorage; cookie dihapus halaman saat mount);
 * salah permukaan role-lain → landing role-nya. Route handler tetap wajib
 * auth sendiri (AD-8: middleware + route handler).
 */
const PATH_KELENGKAPAN_PROFIL = '/profile-completeness'

/** Umur flash-cookie pesan transparensi (detik) — dihapus halaman saat
 *  mount; batas umur hanya jaga-jaga bila halaman tak pernah dibuka. */
const UMUR_COOKIE_TRANSPARANSI_DETIK = 600

/** Gerbang sesi di luar registry — landing role + Kelengkapan Profile. */
const HALAMAN_GERBANG_SESI: ReadonlySet<string> = new Set([
  ...Object.values(LANDING_PATH),
  PATH_KELENGKAPAN_PROFIL,
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
  if (!HALAMAN_GERBANG_SESI.has(path) && prasyaratPermukaan(path) === undefined) return

  const email = await getSessionEmail(event)
  if (!email) return sendRedirect(event, '/login')

  if (PENGECUALIAN_CALON_BELUM_LENGKAP.has(path)) return

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return

  // Gerbang calon 1.5 — dievaluasi SEBELUM gerbang role (precedence). Hanya
  // calon `diajukan` yang diurus gerbang ini; calon `ditolak`/`kedaluwarsa`
  // JATUH ke gerbang role di bawah (matriks baris "calon × permukaan" —
  // landing calon `/registration-status`, bukan shell permukaan terkunci).
  if (principal.role === 'calon_owner' && principal.owner.status === 'diajukan') {
    // Calon `diajukan` Lengkap lolos gerbang kelengkapan — kembali ke landing
    // calonnya (UX-DR14: calon tetap di /registration-status), bukan ke
    // /profile-completeness.
    if (principal.owner.profilLengkap) return sendRedirect(event, LANDING_PATH.calon_owner)
    return sendRedirect(event, PATH_KELENGKAPAN_PROFIL)
  }

  // Gerbang role Story 1.7 — registry-driven; permukaan di luar registry
  // tidak digerbangi di sini.
  if (!permukaanDibolehkan(principal, path)) {
    // tanpa_saham belum-pernah-beli × permukaan terkunci matriks → pesan
    // transparensi (AD-8/UX-DR14 — bukan sekadar disembunyikan di UI).
    // Flash-cookie (keputusan owner 2026-09-21, menggantikan query param):
    // server TIDAK bisa menulis sessionStorage, TAPI bisa set cookie —
    // Halaman Personal membaca (SSR ikut), menampilkan SEKALI, lalu menghapus.
    if (principal.role === 'tanpa_saham' && !aksesPenuh(principal.owner)) {
      setCookie(event, KUNCI_COOKIE_INFO_TRANSPARANSI, '1', {
        path: LANDING_PATH.tanpa_saham,
        sameSite: 'lax',
        maxAge: UMUR_COOKIE_TRANSPARANSI_DETIK,
      })
      return sendRedirect(event, LANDING_PATH.tanpa_saham)
    }
    // Salah permukaan role-lain → landing role-nya (UX-DR14).
    return sendRedirect(event, LANDING_PATH[principal.role])
  }
})
