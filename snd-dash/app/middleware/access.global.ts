// app/middleware/access.global.ts
//
// KOSMETIK SAJA (AD-8). Middleware ini HANYA memoles UX role/keterbukaan di klien —
// menyembunyikan/mengalihkan permukaan yang belum boleh dilihat owner tanpa saham /
// Keluar. OTORITAS AKSES SEPENUHNYA DI SERVER (server/utils/access.ts +
// tiap route handler). Jangan pernah menjadikan berkas ini sebagai kontrol keamanan:
// klien dapat menonaktifkan/melewati middleware kapan pun. Server tetap satu-satunya
// penegak matriks keterbukaan §4.8 (Requirement 15.1).
//
// Perilaku: owner berstatus tanpa saham (terverifikasi, belum pernah membeli) atau
// Keluar dialihkan secara kosmetik ke '/personal' saat mencoba membuka permukaan
// yang terkunci baginya (tabel/chart kepemilikan seluruh owner, Contribution, MoM,
// audit trail). Karena kosmetik, middleware GAGAL-TERBUKA: bila status tak diketahui
// atau terjadi error, biarkan navigasi lanjut — server yang menolak bila perlu.

import type { OwnerLifecycle } from '#shared/domain/types'

/**
 * Rute-rute yang TERKUNCI bagi owner tanpa saham / Keluar (§4.8, Requirement 15.7).
 * Prefix path (tanpa trailing slash). Owner dengan akses penuh melihat semuanya.
 * Catatan: daftar ini murni untuk UX; server menegakkan yang sebenarnya per permukaan.
 */
const LOCKED_FOR_NO_SHARES_PREFIXES = [
  '/kepemilikan', // tabel/chart kepemilikan seluruh Owner
  '/contribution', // poin Contribution seluruh Owner
  '/mom', // Minutes of Meeting
  '/audit', // audit trail
] as const

/** Halaman personal — tujuan pengalihan kosmetik bagi owner akses terbatas. */
const PERSONAL_PATH = '/personal'

/**
 * Semantik kanonik `aksesPenuh` (AD-8) direplikasi kosmetik di klien: hanya owner
 * pemegang saham (lifecycle 'terverifikasi' yang efektif memiliki saham) yang
 * mendapat transparansi penuh. Untuk kosmetik kita andalkan status siklus hidup +
 * penanda kepemilikan saham yang disematkan pada sesi (bila tersedia). Bila penanda
 * tidak tersedia, kita TIDAK mengunci (gagal-terbuka) — server tetap otoritatif.
 */
function punyaAksesPenuhKosmetik(
  lifecycle: OwnerLifecycle | undefined,
  memilikiSaham: boolean | undefined,
): boolean {
  // 'keluar' selalu akses terbatas (Requirement 15.6/15.7).
  if (lifecycle === 'keluar') return false
  // Penanda kepemilikan saham eksplisit dari sesi bila ada.
  if (typeof memilikiSaham === 'boolean') return memilikiSaham
  // Tanpa informasi cukup → gagal-terbuka (kosmetik, bukan keamanan).
  return true
}

function isLockedSurface(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/'
  return LOCKED_FOR_NO_SHARES_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

export default defineNuxtRouteMiddleware((to) => {
  // Server adalah otoritas (AD-8). Middleware ini hanya memoles UX di sisi klien;
  // hindari campur tangan pada SSR agar tidak menjadi jalur "keamanan" semu.
  if (import.meta.server) return

  // Hanya relevan untuk permukaan yang memang terkunci bagi akses terbatas.
  if (!isLockedSurface(to.path)) return

  try {
    // `useAuth` dari @sidebase/nuxt-auth. Diakses via composable global auto-import.
    const auth = useAuth()
    const status = unref(auth.status)

    // Belum login / masih loading → jangan ganggu; server/route auth yang menangani.
    if (status !== 'authenticated') return

    const data = unref(auth.data) as
      | { lifecycle?: OwnerLifecycle; memilikiSaham?: boolean }
      | null
      | undefined

    const lifecycle = data?.lifecycle
    const memilikiSaham = data?.memilikiSaham

    if (!punyaAksesPenuhKosmetik(lifecycle, memilikiSaham)) {
      // Pengalihan kosmetik ke halaman personal. Hindari loop bila sudah di sana.
      if (to.path !== PERSONAL_PATH) {
        return navigateTo(PERSONAL_PATH)
      }
    }
  } catch {
    // Gagal-terbuka: apa pun yang salah di klien tidak boleh memblokir navigasi.
    // Server tetap menegakkan akses sebenarnya.
    return
  }
})
