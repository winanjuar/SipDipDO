import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit test — scope scaffold: `shared/domain` murni tanpa I/O (AD-6/AD-9/AD-10,
 * R-008/R-010) + modul server yang diuji via mock/dependency-injection.
 * Alias `#shared` disamakan dengan Nuxt agar modul server yang mengimpor
 * `#shared/domain/...` dapat diuji tanpa menjalankan Nuxt.
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
  },
})
