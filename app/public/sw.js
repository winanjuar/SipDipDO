/**
 * Service worker kustom (AD-12) — strategi `injectManifest` @vite-pwa/nuxt.
 * Lokasi: app/public/sw.js — vite-plugin-pwa membangun SW relatif root Vite
 * (= srcDir Nuxt 4 `app/`); folder ini BUKAN publicDir Nuxt sehingga sumber
 * tidak ikut tersalin ke output. (JS murni: entry .ts di vite-8/rolldown
 * menghasilkan artefak .mjs yang tidak cocok dengan URL registrasi sw.js.)
 *
 * Mengapa bukan `generateSW`: template workbox mendaftarkan
 * `NavigationRoute(createHandlerBoundToURL(navigateFallback))` yang melayani
 * shell untuk SEMUA permintaan navigasi langsung dari precache (pola SPA) —
 * jaringan tidak pernah disentuh, sehingga SSR online akan tersajikan shell
 * usang. Ini melanggar AD-12 ("data selalu daring"; "shell /offline hanya
 * untuk permintaan dokumen yang gagal"). SW kustom ini direviu terhadap AD-12:
 *
 * 1. Cangkang yang di-precache = persis manifest yang di-inject vite-plugin-pwa
 *    dari `globPatterns` di nuxt.config.ts: aset build ter-fingerprint (js/css),
 *    ikon, web app manifest, dan TEPAT SATU HTML (`/offline` hasil prerender —
 *    nitro menulisnya sebagai offline/index.html; `matchPrecache('/offline')`
 *    menerjemahkannya via directoryIndex). `precacheAndRoute` melayani aset
 *    ter-fingerprint cache-first (immutable) — tidak lebih.
 * 2. Dokumen SSR & `/api/**` TIDAK pernah di-precache maupun runtime-cache; SW
 *    tidak pernah mensintesis respons API — kegagalan fetch diteruskan apa adanya.
 *    Permintaan dokumen yang gagal (offline) dilayani shell `/offline`.
 * 3. Tanpa `skipWaiting`/`clientsClaim` otomatis — `registerType: 'prompt'`;
 *    versi baru aktif saat muat natural berikutnya setelah aksi eksplisit
 *    pengguna (prompt pembaruan di PwaUpdatePrompt.vue, tidak pernah di atas
 *    dialog transaksional — AD-12).
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Hanya permintaan dokumen (navigasi) yang punya fallback shell.
  // Permintaan API/aset tidak disentuh — kegagalannya diteruskan apa adanya
  // dan dirender oleh state pattern permukaan terkait (AD-12).
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const shell = await matchPrecache('/offline')
      if (shell) return shell
      // Shell tidak tersedia di precache — biarkan kegagalan asli.
      return Response.error()
    }),
  )
})
