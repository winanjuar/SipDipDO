import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    // Pure domain + server logic run in a Node environment (no DOM needed for shared/domain).
    environment: 'node',
    include: [
      'shared/**/*.{test,spec}.ts',
      'server/**/*.{test,spec}.ts',
      'app/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
    globals: true,
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
