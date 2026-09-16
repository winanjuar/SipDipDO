/**
 * Fixture cleanup otomatis — pola data-factories.md § Cleanup Strategy.
 * Test mendaftarkan disposisi (hapus data seed, tutup resource) via
 * `cleanup.track(...)`; semua disposisi dijalankan balik-urutan setelah test
 * selesai, apa pun hasilnya (pass/fail). `auto: true` membuat fixture aktif
 * tanpa perlu di-destructure.
 */
import { test as base } from '@playwright/test'

type Dispose = () => Promise<void> | void

export interface Cleanup {
  track: (dispose: Dispose) => void
}

export const test = base.extend<{ cleanup: Cleanup }>({
  cleanup: [
    async ({}, use) => {
      const disposers: Dispose[] = []
      await use({
        track: (dispose) => {
          disposers.push(dispose)
        },
      })
      for (const dispose of [...disposers].reverse()) {
        await dispose()
      }
    },
    { auto: true },
  ],
})
