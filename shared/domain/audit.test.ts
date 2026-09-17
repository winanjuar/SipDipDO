/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `shared/domain/audit.ts` Story 1.3:
 * registry `AUDIT_ACTIONS` terpusat (as const), tipe `AuditAction`, dan guard
 * `isAuditAction` — kontrak murni lintas lapis tanpa I/O (AD-3/AD-6).
 *
 * Test dirancang red-phase (test.skip + dynamic import) lalu diaktifkan pada
 * tugas green-phase bersama implementasi registry; seluruh asersi ter-pin
 * dari red-phase tidak berubah — hanya impor yang kembali statis (penyempurnaan
 * yang disanksi red-phase).
 */
import { describe, expect, test } from 'vitest'
import { AUDIT_ACTIONS, isAuditAction } from './audit'

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

describe('shared/domain/audit — registry & guard (1-UNIT-002)', () => {
  test('guard menerima SETIAP anggota registry (himpunan tertutup)', () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(0)

    for (const action of AUDIT_ACTIONS) {
      expect(isAuditAction(action), `anggota registry harus lolos guard: ${action}`).toBe(true)
    }
  })

  test('guard menolak string di luar registry', () => {
    expect(isAuditAction('aksi-tak-dikenal')).toBe(false)
    expect(isAuditAction('')).toBe(false)
  })

  test('kelengkapan registry: tiap kategori Epic 1 terwakili minimal satu anggota', () => {
    for (const kategori of KATEGORI_WAJIB) {
      const terwakili = AUDIT_ACTIONS.some(action => action.includes(kategori))
      expect(terwakili, `kategori "${kategori}" wajib punya aksi di registry`).toBe(true)
    }
  })

  test('anggota registry unik dan tak ada yang kosong (as const tertutup)', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length)
    expect(AUDIT_ACTIONS.every(action => action.length > 0)).toBe(true)
  })
})
