// substrat platform snd-dash — pusat konfigurasi (Story 1.1)
//
// Aturan yang mengikat konfigurasi ini:
// - AD-12: PWA cangkang = aset ter-fingerprint + manifest + ikon + tepat satu
//   `/offline`; dokumen SSR & `/api/**` `Cache-Control: no-store`; TANPA
//   runtime-caching dokumen/API; `registerType: 'prompt'` tanpa skipWaiting.
// - AD-9: produksi Vercel + Supabase PG 17 via pooler; lingkungan local + production.
// - AD-8: autentikasi NuxtAuth (OAuth Google), penegakan role di batas server.
// - AD-10: nilai uang/ratio hanya string desimal berskala tetap (lihat
//   shared/domain/money.ts + aturan ESLint no-restricted-syntax).
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',
  devtools: { enabled: true },

  app: {
    head: {
      // Favicon = logo login (BrandLogo /public/logo.png) + /favicon.ico fallback.
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
      ],
    },
  },

  modules: ['@sidebase/nuxt-auth', '@vite-pwa/nuxt', 'shadcn-nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/tailwind.css'],

  typescript: {
    strict: true,
    typeCheck: false, // typecheck dijalankan eksplisit via `npm run typecheck`
  },

  // --- Autentikasi (AD-8) --------------------------------------------------
  auth: {
    provider: {
      type: 'authjs',
      // Vercel (proxy) & dev lokal sama-sama dipercaya dari header host;
      // kredensial & secret via runtimeConfig env, bukan repo.
      trustHost: true,
      defaultProvider: 'google',
      addDefaultCallbackUrl: false,
    },
    sessionRefresh: {
      enablePeriodically: true,
      enableOnWindowFocus: true,
    },
  },

  // --- PWA (AD-12) ----------------------------------------------------------
  // injectManifest + SW kustom `app/public/sw.js` — direviu terhadap AD-12.
  // generateSW TIDAK dipakai karena `navigateFallback`-nya mendaftarkan
  // NavigationRoute(createHandlerBoundToURL(...)) yang melayani shell untuk
  // SEMUA navigasi tanpa menyentuh jaringan (pola SPA) — memutus SSR pada
  // aplikasi yang datanya selalu daring. Lihat Design Notes spec 1.1.
  pwa: {
    strategies: 'injectManifest',
    srcDir: 'public',
    filename: 'sw.js', // JS murni — entry .ts di rolldown/vite-8 menghasilkan .mjs
    registerType: 'prompt', // tanpa skipWaiting otomatis (AD-12)
    registerWebManifestInRouteRules: true,
    client: {
      registerPlugin: true, // expose useRegisterSW/usePWA untuk prompt pembaruan
      periodicSyncForUpdates: 3600, // cek pembaruan tiap jam
    },
    injectManifest: {
      // Cangkang saja: aset build ter-fingerprint (js/css), TEPAT satu HTML
      // prerender — `offline/index.html` (route `/offline`; AD-12: jangan
      // `**/*.html` karena akan mem-precache HTML prerender tambahan di masa
      // depan) — ikon, dan web app manifest. cleanupOutdatedCaches() dipanggil
      // di dalam SW. TANPA runtimeCaching — dokumen SSR & /api/** tidak pernah
      // di-cache SW.
      globPatterns: ['**/*.{js,css,svg,png,ico,webmanifest}', 'offline/index.html'],
    },
    manifest: {
      name: 'Sip & Dip — Dashboard Kepemilikan Saham',
      short_name: 'Sip & Dip',
      description: 'Dashboard kepemilikan saham internal Sip & Dip (Phase 1).',
      lang: 'id',
      // display standalone TANPA orientation — konteks terpasang adalah
      // viewport, bukan postur ketiga (AD-12).
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#2D3959', // navy brand (DESIGN.md UX-DR2)
      background_color: '#ffffff',
      icons: [
        { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  },

  // --- Cache & kesegaran (AD-12) ---------------------------------------------
  routeRules: {
    // Shell offline statis — di-precache oleh SW (satu-satunya HTML yang boleh).
    '/offline': { prerender: true },
    // Aset ter-fingerprint: immutable.
    '/_nuxt/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    // Dokumen SSR & API adalah data domain: selalu no-store (tanpa swr/isr).
    '/api/**': { headers: { 'Cache-Control': 'no-store' } },
    '/**': { headers: { 'Cache-Control': 'no-store' } },
  },

  // server/jobs bukan direktori scan Nitro — endpoint cron didaftarkan eksplisit
  // agar file tetap hidup di server/jobs sesuai Structural Seed.
  nitro: {
    handlers: [{ route: '/jobs/daily', handler: './server/jobs/daily.post', method: 'post' }],
  },

  // --- Env (kredensial hanya via env — AD-9; local + production saja) --------
  runtimeConfig: {
    authSecret: '', // NUXT_AUTH_SECRET
    googleClientId: '', // NUXT_GOOGLE_CLIENT_ID
    googleClientSecret: '', // NUXT_GOOGLE_CLIENT_SECRET
    databaseUrl: '', // NUXT_DATABASE_URL (pooler Supabase)
    resendApiKey: '', // NUXT_RESEND_API_KEY
    resendFrom: '', // NUXT_RESEND_FROM
    cronSecret: '', // NUXT_CRON_SECRET
    public: {
      appName: 'Sip & Dip',
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    // shadcn-nuxt me-resolve path dari rootDir tanpa alias — pakai path riil
    // (srcDir Nuxt 4 = app/).
    componentDir: './app/components/ui',
  },
})
