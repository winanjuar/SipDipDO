// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  // Nuxt 4 canonical layout: app/ is the srcDir, server/ and shared/ live at root.
  future: {
    compatibilityVersion: 4,
  },
  modules: [
    '@sidebase/nuxt-auth',
    '@vite-pwa/nuxt',
  ],
  devtools: { enabled: true },
  // AD-12: SSR documents and /api/** must be no-store — data domain selalu daring,
  // hanya aset statis yang boleh di-cache (PWA generateSW). Diterapkan global via
  // nitro routeRules sehingga berlaku untuk shell SSR ('/**') dan seluruh API
  // ('/api/**'); route handler tetap boleh menegakkan ulang bila perlu.
  routeRules: {
    '/**': { headers: { 'Cache-Control': 'no-store' } },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } },
  },
  // Rahasia server-only (di-back env; JANGAN hardcode). Kunci `public` terekspos
  // ke klien — hanya konfigurasi non-rahasia NuxtAuth yang boleh di sana.
  runtimeConfig: {
    // NuxtAuth (authjs/next-auth) — dibaca di server/api/auth/[...].ts.
    authSecret: '', // env: NUXT_AUTH_SECRET
    google: {
      clientId: '', // env: NUXT_GOOGLE_CLIENT_ID (fallback GOOGLE_CLIENT_ID via nitro)
      clientSecret: '', // env: NUXT_GOOGLE_CLIENT_SECRET (fallback GOOGLE_CLIENT_SECRET)
    },
    // Proteksi endpoint cron (AD-9) — dipakai server/api/cron/**.
    cronSecret: '', // env: NUXT_CRON_SECRET (fallback CRON_SECRET)
  },
  // @sidebase/nuxt-auth — Google OAuth (task 18.3). Provider `authjs` memanggil
  // catch-all handler di server/api/auth/[...].ts. `baseURL` diturunkan dari
  // AUTH_ORIGIN saat runtime (origin_required untuk callback OAuth di produksi).
  auth: {
    isEnabled: true,
    disableServerSideAuth: false,
    originEnvKey: 'AUTH_ORIGIN',
    // baseURL WAJIB menunjuk ke lokasi API auth (`/api/auth`). Tanpa ini,
    // sidebase memanggil path relatif root (`/providers`, `/session`, `/csrf`)
    // → 404. Absolut agar konsisten SSR & klien.
    baseURL: 'http://localhost:3000/api/auth',
    // JANGAN aktifkan middleware auth global: kita tidak punya halaman login
    // kustom '/session' (default sidebase). Redirect otomatis ke '/session'
    // menyebabkan "Recursion detected at /session" + 404. Halaman diproteksi
    // secara eksplisit lewat guard server (server/utils/access) + composable
    // useAuth() di halaman. Login memakai halaman bawaan /api/auth/signin.
    globalAppMiddleware: false,
    provider: {
      type: 'authjs',
      // Provider default dev = 'dev-email' (login email tanpa Google). Saat
      // Google OAuth aktif (kredensial terisi), ganti ke 'google'.
      defaultProvider: 'dev-email',
      addDefaultCallbackUrl: true,
    },
  },
  // @vite-pwa/nuxt (task 19.5) — installable PWA yang HANYA men-cache aset statis.
  // AD-12: data domain selalu daring; service worker TIDAK BOLEH men-cache dokumen
  // SSR maupun respons /api/**. Karena itu: strategy `generateSW` dengan precache
  // dibatasi pada aset build statis (globPatterns), tanpa `runtimeCaching` sama
  // sekali, dan `navigateFallback: null` agar SW tidak melayani navigasi dari cache
  // (mencegah shell basi menutupi data daring). Update model 'prompt' + installPrompt
  // memberi kontrol eksplisit ke pengguna (tidak ada auto-activate diam-diam).
  pwa: {
    registerType: 'prompt',
    strategies: 'generateSW',
    workbox: {
      // HANYA aset statis build-time. Tidak ada tipe berkas dinamis/data di sini.
      globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
      // Jangan layani navigasi (dokumen HTML) dari cache — data domain selalu daring.
      navigateFallback: null,
      // Hindari runtime caching apa pun: tanpa entri runtimeCaching → tidak ada
      // permintaan jaringan (termasuk /api/**) yang tersimpan di cache (AD-12).
      cleanupOutdatedCaches: true,
    },
    client: {
      // Model 'prompt': tampilkan kontrol update & pasang; jangan aktifkan otomatis.
      installPrompt: true,
      periodicSyncForUpdates: 0,
    },
    // Manifest minimal installable; ikon mengambil dari public/ bila tersedia.
    manifest: {
      name: 'Sip & Dip Ownership Dashboard',
      short_name: 'SnD Dashboard',
      lang: 'id',
      start_url: '/',
      display: 'standalone',
    },
  },
})
