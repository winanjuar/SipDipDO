// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

const configs = withNuxt(
  // Direktori bebas/buangan alat (bukan basis kode app): modul BMAD beku,
  // artefak perencanaan, tooling lokal ZCode — tidak dilint.
  {
    ignores: [
      '_bmad/**',
      '_bmad-output/**',
      '.zcode/**',
      '.agents/**',
      '.claude/**',
      '.kiro/**',
      'exports/**',
      '.output/**',
      '.nuxt/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,ts,vue}'],
    rules: {
      /**
       * Kontrak uang R-010 / AD-10: nilai uang & ratio tidak pernah dihitung
       * via float. `Number()` dan `parseFloat()` (global maupun Number.*)
       * DILARANG di seluruh lapisan — ESLint tidak bisa membedakan variabel
       * uang vs non-uang, maka larangan berlaku mutlak; parsing kanonik satu-
       * satunya lewat pasangan parse/serialize `shared/domain/money.ts`.
       * (Integer — Quantity/Shares/Ceil — tetap integer-safe: `parseInt`/
       * `Number.parseInt` diizinkan, sesuai AD-10.)
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='parseFloat']",
          message: 'AD-10/R-010: parseFloat() dilarang untuk nilai uang/ratio — pakai parseRupiah/parseRatio dari shared/domain/money.ts.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.object.type='Identifier'][callee.object.name='Number'][callee.property.type='Identifier'][callee.property.name='parseFloat']",
          message: 'AD-10/R-010: Number.parseFloat() dilarang untuk nilai uang/ratio — pakai parseRupiah/parseRatio dari shared/domain/money.ts.',
        },
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='Number']",
          message: 'AD-10/R-010: Number() dilarang untuk nilai uang/ratio — pakai pasangan parse/serialize shared/domain/money.ts (integer aman: Number.parseInt).',
        },
      ],
      /**
       * Kontrak bebas-magic-number: angka dalam logika = konstanta bernama
       * (lintas-modul `shared/domain/<topik>.ts`; milik modul
       * `server/domain/<modul>/`). Literal skala di posisi tipe memakai
       * `typeof KONSTANTA` (mis. `FixedDecimal<typeof RUPIAH_SCALE>`);
       * pengecualian deklarasi rule tidak menembus `as const` — nilai
       * kanonik (mis. RUPIAH_SCALE) dan tabel data milik konstanta bernama
       * (mis. DAYS_IN_MONTH) memakai disable berjustifikasi.
       */
      '@typescript-eslint/no-magic-numbers': ['error', {
        ignore: [0, 1, -1],
        ignoreArrayIndexes: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreTypeIndexes: true,
      }],
    },
  },
  {
    // Service worker kustom (app/public/sw.js) — wajib ter-lint dengan aturan
    // kontrak yang sama; globals Web Worker ditambahkan eksplisit.
    files: ['app/public/sw.js'],
    languageOptions: {
      globals: {
        caches: 'readonly',
        fetch: 'readonly',
        clients: 'readonly',
      },
    },
  },
  {
    // Komponen hasil-generate shadcn-vue (upstream): props tanpa default
    // adalah pola reka-ui (optional props) — bukan kode milik kita untuk
    // diulik; aturan style ini dimatikan untuk components/ui saja.
    files: ['app/components/ui/**'],
    rules: {
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  {
    // Fixture Playwright (mis. `{ auto: true }`) mewajibkan argumen pertama
    // berupa destrukturasi objek — `async ({}, use)` — sehingga pola objek
    // kosong ini idiomatik dan bukan defect di tests/**.
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      'no-empty-pattern': 'off',
      // Nilai harapan uji adalah data, bukan logika — literal idiomatik di sini.
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  {
    // Config tooling root (playwright/nuxt/vitest/eslint) = deklaratif
    // (retries, workers, port) — angka di sini nilai konfigurasi, bukan
    // logika domain.
    files: ['*.config.{js,mjs,ts}'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
)

// Preset @nuxt/eslint meng-global-ignore '**/public' pada SEMUA kedalaman,
// sehingga sumber SW kustom app/public/sw.js tak pernah ter-lint (global
// ignore tidak bisa dinegasikan objek konfigurasi lain). Persempit pola itu
// ke 'public' root saja: aset statis tetap di-ignore, SW tetap ter-lint
// (direviu terhadap AD-12 — jangan sampai file yang mengatur cache lolos
// dari pemeriksaan kontrak).
configs.onResolved((list) => list.map((config) => {
  if (Array.isArray(config.ignores) && config.ignores.includes('**/public')) {
    return { ...config, ignores: config.ignores.map(entry => (entry === '**/public' ? 'public' : entry)) }
  }
  return config
}))

export default configs
