/**
 * ATDD RED-PHASE (Vitest) — kontrak `server/domain/audit/audit.service.ts`
 * Story 1.3: `writeAuditEntry(tx, { actor, action, target, details })`
 * (validasi registry + kewajiban transaksi, AD-3) dan `listForCoo(db, page)`
 * (komposisi baca paging offset, limit 100 terpin spec).
 *
 * SEMUA test `test.skip()` — fase TDD RED: service masih stub `export {}`;
 * `muatService()` melempar error jujur saat skip dilepas sebelum modul diisi.
 * Repo DIMOCK via `vi.mock` (modul `./audit.repo` ada sebagai stub, jalurnya
 * sah) — kontrak mock mengikuti kontrak repo terpin spec: `insertAuditEntry`
 * INSERT-only dan `listAuditEntries(db, { limit, offset })`.
 *
 * ASUMSI yang diselaraskan saat green (sudah ditandai per test): nama anggota
 * registry valid, mekanisme pembeda `tx` vs db biasa, dan bentuk baris repo —
 * perilaku yang DIPINKUN tetap dari matriks I/O spec (tolak tanpa tx; tolak
 * aksi luar registry SEBELUM insert; envelope aktor; paging limit/offset).
 */
import { describe, expect, test, vi } from 'vitest'

/** Specifier non-literal agar TS2305 "no exported member" tidak merusak
 *  `typecheck` selagi service masih stub `export {}`. */
const MODUL_SERVICE = './audit.service'

/** Kontrak repo terpin spec — bentuk baris & paging untuk perekam mock. */
interface BarisRepoAudit {
  action: string
  actorOwnerId: string | null
  target: string | null
  details: Record<string, unknown>
}

interface PagingUji {
  limit: number
  offset: number
}

/** Perekam panggilan repo — di-hoist agar factory vi.mock bisa menutupnya. */
const rekaman = vi.hoisted(() => ({
  insertMasuk: [] as Array<Record<string, unknown>>,
  listMasuk: [] as Array<{ limit: number, offset: number }>,
}))

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

/** Input envelope valid. ASUMSI: `pendaftaran-diajukan` anggota registry —
 *  bila registry final memakai nama lain, sesuaikan input ini ke anggota
 *  ASLI `AUDIT_ACTIONS` saat green (kontrak terpin: input valid → insert 1×). */
const inputValid = () => ({
  actor: { kind: 'user' as const, ownerId: '0f0e0d0c-0000-4000-8000-000000000001' },
  action: 'pendaftaran-diajukan',
  target: 'owners:0f0e0d0c-0000-4000-8000-000000000002',
  details: { sumber: 'uji-atdd' },
})

/** Objek transaksi sintetis. ASUMSI: mekanisme pembeda tx ditetapkan
 *  implementasi — sesuaikan penanda ini saat green bila mekanismenya lain;
 *  kontrak terpin: objek NON-transaksi ditolak, objek transaksi lolos. */
const txSintetis = { __tandaTransaksiUji: true }

const muatService = async () => {
  const modul = (await import(MODUL_SERVICE)) as {
    writeAuditEntry?: (tx: unknown, input: unknown) => Promise<unknown>
    listForCoo?: (db: unknown, page: number) => Promise<unknown>
  }

  if (typeof modul.writeAuditEntry !== 'function' || typeof modul.listForCoo !== 'function') {
    throw new Error('audit.service masih stub — writeAuditEntry/listForCoo belum ada (Story 1.3).')
  }

  return modul as {
    writeAuditEntry: (tx: unknown, input: unknown) => Promise<unknown>
    listForCoo: (db: unknown, page: number) => Promise<unknown>
  }
}

describe.skip('server/domain/audit/audit.service — writeAuditEntry (1-UNIT-003)', () => {
  test('TOLAK tanpa tx — db biasa ditolak, repo TIDAK terpanggil (AD-3)', async () => {
    // GAGAL saat red: service masih stub `export {}` — muatService melempar.
    const { writeAuditEntry } = await muatService()
    const dbBukanTransaksi = {}

    await expect(writeAuditEntry(dbBukanTransaksi, inputValid()))
      .rejects.toThrow(/transaksi|tx/i)
    expect(rekaman.insertMasuk).toHaveLength(0)
  })

  test('TOLAK action di luar registry — throw SEBELUM insert (matriks I/O baris 7)', async () => {
    // GAGAL saat red: service masih stub `export {}` — muatService melempar.
    const { writeAuditEntry } = await muatService()
    const inputLiar = { ...inputValid(), action: 'aksi-tak-dikenal' }

    await expect(writeAuditEntry(txSintetis, inputLiar))
      .rejects.toThrow(/registry/i)
    expect(rekaman.insertMasuk).toHaveLength(0)
  })

  test('envelope valid → insert tepat 1× dengan baris sesuai input', async () => {
    // GAGAL saat red: service masih stub `export {}` — muatService melempar.
    const { writeAuditEntry } = await muatService()
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
    // GAGAL saat red: service masih stub `export {}` — muatService melempar.
    const { writeAuditEntry } = await muatService()
    const inputSystem = { ...inputValid(), actor: { kind: 'system' as const } }

    await writeAuditEntry(txSintetis, inputSystem)

    // ASUMSI bentuk baris repo: pemetaan aktor → kolom `actor_owner_id`
    // (kolom DB terpin spec task); sesuaikan kunci bila bentuk baris lain.
    expect(rekaman.insertMasuk).toHaveLength(1)
    expect(rekaman.insertMasuk[0].actorOwnerId).toBeNull()
  })
})

describe.skip('server/domain/audit/audit.service — listForCoo (1-UNIT-003)', () => {
  test('page 1 → limit 100 offset 0; page 2 → offset 100 (paging offset, limit terpin)', async () => {
    // GAGAL saat red: service masih stub `export {}` — muatService melempar.
    const { listForCoo } = await muatService()
    const dbPalsu = {}

    await listForCoo(dbPalsu, 1)
    await listForCoo(dbPalsu, 2)

    expect(rekaman.listMasuk).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ])
  })
})
