/**
 * Fixture cleanup otomatis — pola data-factories.md § Cleanup Strategy.
 * Test mendaftarkan disposisi (hapus data seed, tutup resource) via
 * `cleanup.track(...)`; semua disposisi dijalankan balik-urutan setelah test
 * selesai, apa pun hasilnya (pass/fail). `auto: true` membuat fixture aktif
 * tanpa perlu di-destructure.
 *
 * Selain disposisi eksplisit, fixture ini me-FLUSH registry email owner
 * sintetis (`EMAIL_OWNER_UJI_TERDAFTAR` — diisi `mintSesiPemilik` dan fixture
 * auth) pasca-test: baris `owners` + jejak FK-nya (audit/coo_tenures/outbox)
 * dihapus FK-safe via `hapusOwnerUji` (laporan owner 2026-09-18 — penumpukan
 * baris `uji.snddash.e2e.*` lintas run). Per-proses worker → paralel aman.
 */
import { test as base } from '@playwright/test'
import { EMAIL_OWNER_UJI_TERDAFTAR } from '../helpers/sesi-minting'
import { hapusOwnerUji } from '../helpers/owner-reset'

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
      // Reset baris uji hasil mint — best-effort (host non-lokal dilewati
      // dengan peringatan; lihat owner-reset.ts).
      if (EMAIL_OWNER_UJI_TERDAFTAR.size > 0) {
        try {
          await hapusOwnerUji([...EMAIL_OWNER_UJI_TERDAFTAR])
        } catch (error) {
          console.warn(
            `[cleanup] reset owner uji gagal (dibiarkan — best-effort): ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
        EMAIL_OWNER_UJI_TERDAFTAR.clear()
      }
    },
    { auto: true },
  ],
})

/**
 * Jaring pengaman level WORKER — flush registry sekali terakhir saat worker
 * (race upsert deterministic-persona lintas project browser yang berjalan
 * penuh 3 project).
 */
export const testWorker = base.extend<Record<string, never>>({
  flushAkhirWorker: [
    async ({}, use) => {
      await use(undefined)
      if (EMAIL_OWNER_UJI_TERDAFTAR.size > 0) {
        try {
          await hapusOwnerUji([...EMAIL_OWNER_UJI_TERDAFTAR])
        } catch (error) {
          console.warn(
            `[cleanup] flush akhir worker gagal (dibiarkan — best-effort): ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
        EMAIL_OWNER_UJI_TERDAFTAR.clear()
      }
    },
    { scope: 'worker', auto: true },
  ],
})
