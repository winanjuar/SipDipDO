/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `server/domain/audit/audit.service.ts`
 * Story 1.3: `writeAuditEntry(tx, { actor, action, target, details })`
 * (validasi registry + kewajiban transaksi, AD-3) dan `listForCoo(db, page)`
 * (komposisi baca paging offset, limit 100 terpin spec).
 *
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; seluruh asersi ter-pin dari red-phase tidak
 * berubah. Penyesuaian yang disanksi catatan ASUMSI red-phase:
 * - impor statis biasa (modul sudah ada);
 * - mekanisme pembeda `tx` vs db biasa ditetapkan implementasi: handle Tx
 *   Drizzle punya `rollback` (Db tidak) — `txSintetis` memakai penanda itu.
 *
 * Repo DIMOCK via `vi.mock` (kontrak mock mengikuti kontrak repo:
 * `insertAuditEntry` INSERT-only dan `listAuditEntries(db, { limit, offset })`
 * mengembalikan `{ data, nextPage }`).
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { listForCoo, writeAuditEntry } from './audit.service'

/** Perekam panggilan repo — di-hoist agar factory vi.mock bisa menutupnya. */
const rekaman = vi.hoisted(() => ({
  insertMasuk: [] as Array<Record<string, unknown>>,
  listMasuk: [] as Array<{ limit: number, offset: number }>,
}))

/** Isolasi antar-test: asersi terpin menghitung panggilan PER test. */
beforeEach(() => {
  rekaman.insertMasuk.length = 0
  rekaman.listMasuk.length = 0
})

vi.mock('./audit.repo', () => ({
  insertAuditEntry: async (_tx: unknown, baris: Record<string, unknown>) => {
    rekaman.insertMasuk.push(baris)
    return baris
  },
  listAuditEntries: async (_db: unknown, paging: { limit: number, offset: number }) => {
    rekaman.listMasuk.push(paging)
    return { data: [], nextPage: null }
  },
}))

/** Input envelope valid — `pendaftaran-diajukan` anggota registry final. */
const inputValid = () => ({
  actor: { kind: 'user' as const, ownerId: '0f0e0d0c-0000-4000-8000-000000000001' },
  action: 'pendaftaran-diajukan',
  target: 'owners:0f0e0d0c-0000-4000-8000-000000000002',
  details: { sumber: 'uji-atdd' },
})

/** Objek transaksi sintetis — penanda Tx Drizzle: fungsi `rollback`. */
const txSintetis = { rollback: async () => {} }

describe('server/domain/audit/audit.service — writeAuditEntry (1-UNIT-003)', () => {
  test('TOLAK tanpa tx — db biasa ditolak, repo TIDAK terpanggil (AD-3)', async () => {
    const dbBukanTransaksi = {}

    await expect(writeAuditEntry(dbBukanTransaksi, inputValid()))
      .rejects.toThrow(/transaksi|tx/i)
    expect(rekaman.insertMasuk).toHaveLength(0)
  })

  test('TOLAK action di luar registry — throw SEBELUM insert (matriks I/O baris 7)', async () => {
    const inputLiar = { ...inputValid(), action: 'aksi-tak-dikenal' }

    await expect(writeAuditEntry(txSintetis, inputLiar))
      .rejects.toThrow(/registry/i)
    expect(rekaman.insertMasuk).toHaveLength(0)
  })

  test('envelope valid → insert tepat 1× dengan baris sesuai input', async () => {
    const input = inputValid()

    await writeAuditEntry(txSintetis, input)

    expect(rekaman.insertMasuk).toHaveLength(1)
    expect(rekaman.insertMasuk[0]).toMatchObject({
      action: input.action,
      target: input.target,
      details: input.details,
    })
  })

  test('aktor system → kolom aktor owner null (actor_owner_id null = system)', async () => {
    const inputSystem = { ...inputValid(), actor: { kind: 'system' as const } }

    await writeAuditEntry(txSintetis, inputSystem)

    // Bentuk baris repo: pemetaan aktor → kolom `actor_owner_id`.
    expect(rekaman.insertMasuk).toHaveLength(1)
    expect(rekaman.insertMasuk[0].actorOwnerId).toBeNull()
  })
})

describe('server/domain/audit/audit.service — listForCoo (1-UNIT-003)', () => {
  test('page 1 → limit 20 offset 0; page 2 → offset 20 (paging offset, default renegosiasi 2026-09-17)', async () => {
    const dbPalsu = {}

    await listForCoo(dbPalsu, 1)
    await listForCoo(dbPalsu, 2)

    expect(rekaman.listMasuk).toEqual([
      { limit: 20, offset: 0 },
      { limit: 20, offset: 20 },
    ])
  })

  test('limit eksplisit anggota opsi → offset (page-1)*limit (40 → page 2 = offset 40)', async () => {
    const dbPalsu = {}

    await listForCoo(dbPalsu, 2, 40)

    expect(rekaman.listMasuk).toEqual([
      { limit: 40, offset: 40 },
    ])
  })
})
