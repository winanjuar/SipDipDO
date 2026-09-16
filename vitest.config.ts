import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit test — scope scaffold: `shared/domain` murni tanpa I/O (AD-6/AD-9/AD-10,
 * R-008/R-010) + modul server yang diuji via mock/dependency-injection.
 * Alias `#shared` disamakan dengan Nuxt agar modul server yang mengimpor
 * `#shared/domain/...` dapat diuji tanpa menjalankan Nuxt.
 *
 * Coverage (`npm run test:coverage`): provider v8, pin eksak = vitest.
 * Scope pengukuran = kode domain (shared + server) — bukan config/bootstrap;
 * file stub `export {}` modul lain sengaja tampil 0% sebagai peta tes yang
 * belum ada (terisi menyusul di story pemiliknya). Threshold ketat dipinkan
 * per-glob untuk kontrak murni yang wajib tidak pernah regress.
 */
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared/', import.meta.url)),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['shared/**/*.ts', 'server/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test-d.ts'],
      thresholds: {
        // Kontrak murni shared/domain: bar tinggi per-file (perFile — tiap
        // berkas berdiri sendiri; kontrak AD-9/AD-10 tidak boleh bocor).
        // Statements 90 memberi ruang kode defensif yang tidak terjangkau
        // by-construction (mis. catch setelah validasi regex di money.ts).
        'shared/domain/*.ts': {
          statements: 90,
          branches: 90,
          functions: 95,
          lines: 95,
          perFile: true,
        },
      },
    },
  },
})
