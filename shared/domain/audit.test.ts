/**
 * ATDD RED-PHASE (Vitest) — kontrak `shared/domain/audit.ts` Story 1.3:
 * registry `AUDIT_ACTIONS` terpusat (as const), tipe `AuditAction`, dan guard
 * `isAuditAction` — kontrak murni lintas lapis tanpa I/O (AD-3/AD-6).
 *
 * SEMUA test `test.skip()` — fase TDD RED: modul belum ada. Impor memakai
 * `await import(...)` DI DALAM body test agar koleksi suite tetap sehat;
 * pelepasan skip → import gagal = merah jujur, hijau setelah registry
 * ditulis (tugas pertama Story 1.3).
 *
 * Yang DIPINKAN spec (frozen): registry mencakup kategori aksi Epic 1 —
 * pendaftaran, verifikasi, penolakan, kedaluwarsa, kelengkapan, kelola-owner,
 * pergantian-coo (+ `system` bila perlu). Nama string persis tiap aksi
 * TIDAK dipinkan spec — yang diuji kelengkapan kategorinya, bukan ejaan.
 */
import { describe, expect, test } from 'vitest'

/** Specifier non-literal (bukan string literal) agar TS2307 "module not
 *  found" tidak merusak `typecheck` selagi modul belum ada; runtime tetap
 *  impor relatif yang sama. Setelah modul ditulis, boleh diganti impor
 *  statis biasa. */
const MODUL_AUDIT = './audit'

/** Bentuk minimal yang dikontrak modul (tanda tangan final dipinkan saat green). */
interface ModulAudit {
  AUDIT_ACTIONS: readonly string[]
  isAuditAction: (action: string) => boolean
}

const muatAudit = async (): Promise<ModulAudit> =>
  (await import(MODUL_AUDIT)) as ModulAudit

/** Kategori aksi Epic 1 yang wajib terwakili di registry (spec frozen). */
const KATEGORI_WAJIB = [
  'pendaftaran',
  'verifikasi',
  'penolakan',
  'kedaluwarsa',
  'kelengkapan',
  'kelola-owner',
  'pergantian-coo',
] as const

describe.skip('shared/domain/audit — registry & guard (1-UNIT-002)', () => {
  test('guard menerima SETIAP anggota registry (himpunan tertutup)', async () => {
    // GAGAL saat red: modul `./audit` belum ada — import gagal.
    const { AUDIT_ACTIONS, isAuditAction } = await muatAudit()

    expect(AUDIT_ACTIONS.length).toBeGreaterThan(0)

    for (const action of AUDIT_ACTIONS) {
      expect(isAuditAction(action), `anggota registry harus lolos guard: ${action}`).toBe(true)
    }
  })

  test('guard menolak string di luar registry', async () => {
    // GAGAL saat red: modul `./audit` belum ada — import gagal.
    const { isAuditAction } = await muatAudit()

    expect(isAuditAction('aksi-tak-dikenal')).toBe(false)
    expect(isAuditAction('')).toBe(false)
  })

  test('kelengkapan registry: tiap kategori Epic 1 terwakili minimal satu anggota', async () => {
    // GAGAL saat red: modul `./audit` belum ada — import gagal.
    const { AUDIT_ACTIONS } = await muatAudit()

    for (const kategori of KATEGORI_WAJIB) {
      const terwakili = AUDIT_ACTIONS.some(action => action.includes(kategori))
      expect(terwakili, `kategori "${kategori}" wajib punya aksi di registry`).toBe(true)
    }
  })

  test('anggota registry unik dan tak ada yang kosong (as const tertutup)', async () => {
    // GAGAL saat red: modul `./audit` belum ada — import gagal.
    const { AUDIT_ACTIONS } = await muatAudit()

    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length)
    expect(AUDIT_ACTIONS.every(action => action.length > 0)).toBe(true)
  })
})
