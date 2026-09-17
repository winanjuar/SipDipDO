/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `server/domain/audit/audit.repo.ts`
 * Story 1.3: `insertAuditEntry(tx, row)` INSERT-only dan
 * `listAuditEntries(db, { limit, offset })` SELECT urut `created_at` desc —
 * Drizzle HANYA di modul ini (AD-5), tanpa jalur UPDATE/DELETE (AC-1).
 *
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; asersi perilaku ter-pin tidak berubah. Penyesuaian
 * yang disanksi catatan ASUMSI red-phase (bentuk rantai Drizzle final):
 * - rantai select memakai `.leftJoin(owners, …)` — email aktor di-join untuk
 *   tampilan (kontrak wire spec: "email aktor untuk tampilan bisa di-join di
 *   server");
 * - `.limit()` menerima `limit + 1` (baris probe hasNext) supaya `nextPage`
 *   tepat null PERSIS saat habis — perilaku beku matriks I/O spec: "nextPage
 *   null bila habis" tanpa halaman kosong; kontrak paging fungsi tetap
 *   `{ limit, offset }` dan data yang dikembalikan tak pernah melebihi limit.
 *
 * DB TIDAK disentuh — rantai Drizzle dipalsukan (fake chain thenable).
 */
import { desc } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, test } from 'vitest'
import { auditLogs } from '../../../drizzle/schema'
import { insertAuditEntry, listAuditEntries } from './audit.repo'

const MODUL_REPO = './audit.repo'

/** Render argumen SQL drizzle ke string — dua buahan desc() terbanding apa adanya. */
const DIALEK_PG = new PgDialect()
const renderSql = (argumen: unknown): string => DIALEK_PG.sqlToQuery(argumen as SQL).sql

describe('server/domain/audit/audit.repo — permukaan modul (1-UNIT-004)', () => {
  test('ekspor hanya INSERT & SELECT — tanpa kunci update/delete/truncate (AC-1 append-only)', async () => {
    const modul = (await import(MODUL_REPO)) as Record<string, unknown>
    const kunciEkspor = Object.keys(modul)

    expect(kunciEkspor).toEqual(expect.arrayContaining(['insertAuditEntry', 'listAuditEntries']))

    const polaTerlarang = /update|delete|remove|truncate/i
    for (const kunci of kunciEkspor) {
      expect(polaTerlarang.test(kunci), `ekspor terlarang di repo append-only: ${kunci}`).toBe(false)
    }
  })
})

describe('server/domain/audit/audit.repo — insertAuditEntry (1-UNIT-004)', () => {
  test('meneruskan baris apa adanya ke rantai insert .values() (INSERT-only, AC-1)', async () => {
    const barisMasuk: Array<Record<string, unknown>> = []
    const txPalsu = {
      // Rantai Drizzle standar: insert(tabel).values(baris)
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

/** Bentuk rantai select palsu — thenable, merekam limit/offset/orderBy. */
interface RantaiSelect {
  from: (tabel: unknown) => RantaiSelect
  leftJoin: (tabel: unknown, kondisi: unknown) => RantaiSelect
  orderBy: (...args: unknown[]) => RantaiSelect
  limit: (n: number) => RantaiSelect
  offset: (n: number) => RantaiSelect
  then: (resolve: (nilai: unknown[]) => void) => void
}

interface RekamanRantai {
  limit?: number
  offset?: number
  orderByDipanggil: boolean
  orderByArgs: unknown[]
}

function buatRantaiSelect(rekaman: RekamanRantai, hasil: unknown[]): RantaiSelect {
  const rantai: RantaiSelect = {
    from: () => rantai,
    leftJoin: () => rantai,
    orderBy: (...args) => {
      rekaman.orderByDipanggil = true
      rekaman.orderByArgs = args
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
    then: resolve => resolve(hasil),
  }
  return rantai
}

const buatDbPalsu = (rantai: RantaiSelect) => ({
  // Rantai Drizzle standar: select(...).from(t).leftJoin(..).orderBy(..).limit(n).offset(n)
  select: () => rantai,
})

describe('server/domain/audit/audit.repo — listAuditEntries (1-UNIT-004)', () => {
  test('meneruskan limit & offset ke rantai select + orderBy dipakai (paging, urut desc)', async () => {
    const rekaman: RekamanRantai = {
      orderByDipanggil: false,
      orderByArgs: [],
    }
    const dbPalsu = buatDbPalsu(buatRantaiSelect(rekaman, []))

    const hasil = await listAuditEntries(dbPalsu, { limit: 100, offset: 100 })

    // `.limit()` menerima limit + 1 — baris probe hasNext (lihat header):
    // kontrak paging fungsi tetap { limit, offset }, hasil tak pernah > limit.
    expect(rekaman).toMatchObject({ limit: 101, offset: 100 })
    expect(rekaman.orderByDipanggil).toBe(true)
    // Urutan terbaru-dulu: created_at desc dengan tiebreaker id desc —
    // entry satu transaksi berbagi now() yang sama, paging offset butuh
    // urutan total deterministik.
    expect(rekaman.orderByArgs.map(renderSql)).toEqual([
      renderSql(desc(auditLogs.createdAt)),
      renderSql(desc(auditLogs.id)),
    ])
    expect(hasil).toMatchObject({ data: [], nextPage: null })
  })

  test('baris > limit → data terpotong tepat limit, nextPage halaman berikutnya', async () => {
    const rekaman: RekamanRantai = {
      orderByDipanggil: false,
      orderByArgs: [],
    }
    const baris = (nomor: number) => ({
      id: `id-${nomor}`, action: 'pendaftaran-diajukan', actorOwnerId: null,
      actorEmail: null, target: null, details: {}, createdAt: '2026-09-17T00:00:00.000Z',
    })
    // limit 2 → probe mengembalikan 3 baris (ada lanjutan).
    const dbPalsu = buatDbPalsu(buatRantaiSelect(rekaman, [baris(1), baris(2), baris(3)]))

    const hasil = await listAuditEntries(dbPalsu, { limit: 2, offset: 0 })

    expect(hasil.data).toHaveLength(2)
    expect(hasil.data.map(entry => entry.id)).toEqual(['id-1', 'id-2'])
    expect(hasil.nextPage).toBe(2)
  })

  test('sisa kurang dari limit → nextPage null (habis, tanpa halaman kosong)', async () => {
    const rekaman: RekamanRantai = {
      orderByDipanggil: false,
      orderByArgs: [],
    }
    const baris = (nomor: number) => ({
      id: `id-${nomor}`, action: 'pendaftaran-kedaluwarsa', actorOwnerId: null,
      actorEmail: null, target: null, details: {}, createdAt: '2026-09-17T00:00:00.000Z',
    })
    // limit 100 → probe mengembalikan tepat 100 baris (habis).
    const sisa = Array.from({ length: 100 }, (_, i) => baris(i))
    const dbPalsu = buatDbPalsu(buatRantaiSelect(rekaman, sisa))

    const hasil = await listAuditEntries(dbPalsu, { limit: 100, offset: 100 })

    expect(hasil.data).toHaveLength(100)
    expect(hasil.nextPage).toBeNull()
  })
})
