/**
 * ATDD RED-PHASE (Vitest) — kontrak `server/domain/audit/audit.repo.ts`
 * Story 1.3: `insertAuditEntry(tx, row)` INSERT-only dan
 * `listAuditEntries(db, { limit, offset })` SELECT urut `created_at` desc —
 * Drizzle HANYA di modul ini (AD-5), tanpa jalur UPDATE/DELETE (AC-1).
 *
 * SEMUA test `test.skip()` — fase TDD RED: repo masih stub `export {}`;
 * `muatRepo()` melempar error jujur saat skip dilepas sebelum modul diisi.
 * DB TIDAK disentuh — rantai Drizzle dipalsukan (fake chain thenable).
 * ASUMSI bentuk rantai Drizzle standar: `insert(tabel).values(baris)` dan
 * `select().from(tabel).orderBy(...).limit(n).offset(n)` — sesuaikan fake
 * saat green bila bentuknya lain; perilaku DIPINKUN tetap: INSERT meneruskan
 * baris, SELECT meneruskan limit/offset, permukaan modul tanpa kata
 * update/delete/remove/truncate.
 */
import { describe, expect, test } from 'vitest'

/** Specifier non-literal agar TS2305 "no exported member" tidak merusak
 *  `typecheck` selagi repo masih stub `export {}`. */
const MODUL_REPO = './audit.repo'

const muatRepo = async () => {
  const modul = (await import(MODUL_REPO)) as {
    insertAuditEntry?: (tx: unknown, row: unknown) => Promise<unknown>
    listAuditEntries?: (db: unknown, paging: { limit: number, offset: number }) => Promise<unknown>
  }

  if (typeof modul.insertAuditEntry !== 'function' || typeof modul.listAuditEntries !== 'function') {
    throw new Error('audit.repo masih stub — insertAuditEntry/listAuditEntries belum ada (Story 1.3).')
  }

  return modul as {
    insertAuditEntry: (tx: unknown, row: unknown) => Promise<unknown>
    listAuditEntries: (db: unknown, paging: { limit: number, offset: number }) => Promise<unknown>
  }
}

describe.skip('server/domain/audit/audit.repo — permukaan modul (1-UNIT-004)', () => {
  test('ekspor hanya INSERT & SELECT — tanpa kunci update/delete/truncate (AC-1 append-only)', async () => {
    // GAGAL saat red: repo masih stub `export {}` — daftar ekspor kosong,
    // asersi arrayContaining gagal jujur.
    const modul = (await import(MODUL_REPO)) as Record<string, unknown>
    const kunciEkspor = Object.keys(modul)

    expect(kunciEkspor).toEqual(expect.arrayContaining(['insertAuditEntry', 'listAuditEntries']))

    const polaTerlarang = /update|delete|remove|truncate/i
    for (const kunci of kunciEkspor) {
      expect(polaTerlarang.test(kunci), `ekspor terlarang di repo append-only: ${kunci}`).toBe(false)
    }
  })
})

describe.skip('server/domain/audit/audit.repo — insertAuditEntry (1-UNIT-004)', () => {
  test('meneruskan baris apa adanya ke rantai insert .values() (INSERT-only, AC-1)', async () => {
    // GAGAL saat red: repo masih stub `export {}` — muatRepo melempar.
    const { insertAuditEntry } = await muatRepo()

    const barisMasuk: Array<Record<string, unknown>> = []
    const txPalsu = {
      // ASUMSI rantai Drizzle standar: insert(tabel).values(baris)
      insert: (_tabel: unknown) => ({
        values: async (baris: Record<string, unknown>) => {
          barisMasuk.push(baris)
          return baris
        },
      }),
    }

    const baris = {
      action: 'pendaftaran-diajukan',
      actorOwnerId: null,
      target: 'owners:0f0e0d0c-0000-4000-8000-000000000002',
      details: { sumber: 'uji-atdd' },
    }

    await insertAuditEntry(txPalsu, baris)

    expect(barisMasuk).toEqual([baris])
  })
})

describe.skip('server/domain/audit/audit.repo — listAuditEntries (1-UNIT-004)', () => {
  test('meneruskan limit & offset ke rantai select + orderBy dipakai (paging, urut desc)', async () => {
    // GAGAL saat red: repo masih stub `export {}` — muatRepo melempar.
    const { listAuditEntries } = await muatRepo()

    interface RantaiSelect {
      from: (tabel: unknown) => RantaiSelect
      orderBy: (...args: unknown[]) => RantaiSelect
      limit: (n: number) => RantaiSelect
      offset: (n: number) => RantaiSelect
      then: (resolve: (nilai: unknown[]) => void) => void
    }

    const rekaman: { limit?: number, offset?: number, orderByDipanggil: boolean } = {
      orderByDipanggil: false,
    }

    const rantai: RantaiSelect = {
      from: () => rantai,
      orderBy: () => {
        rekaman.orderByDipanggil = true
        return rantai
      },
      limit: (n) => {
        rekaman.limit = n
        return rantai
      },
      offset: (n) => {
        rekaman.offset = n
        return rantai
      },
      // thenable agar `await rantai` menghasilkan baris hasil select
      then: resolve => resolve([]),
    }

    const dbPalsu = {
      // ASUMSI rantai Drizzle standar: select().from(t).orderBy(...).limit(n).offset(n)
      select: () => rantai,
    }

    await listAuditEntries(dbPalsu, { limit: 100, offset: 100 })

    expect(rekaman).toMatchObject({ limit: 100, offset: 100 })
    expect(rekaman.orderByDipanggil).toBe(true)
  })
})
