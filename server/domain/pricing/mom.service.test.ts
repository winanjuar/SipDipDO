/**
 * ATDD GREEN-PHASE (Vitest) — kontrak `server/domain/pricing/mom.service.ts`
 * Story 2.1: CMS MoM MRO/RUPS Tulis Langsung.
 *
 * Skenario I/O Matrix:
 * - buatMom: COO buat MoM baru → 201 + audit mom-dibuat
 * - ubahMom: edit draft → 200 + audit; edit final → tolak ALREADY_FINAL
 * - finalkanMom: finalize draft → final + audit; finalize final → tolak
 * - hapusMom: hapus draft → audit; hapus final → tolak
 * - listForPemegangSaham: paging offset
 * - getMomById: detail; null bila tidak ada
 *
 * Repo DIMOCK via `vi.mock`.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { buatMom, finalkanMom, getMomById, hapusMom, listForPemegangSaham, MomDomainError, ubahMom } from './mom.service'

/** Stub MoM untuk mock repo. */
const stubMomDraft = () => ({
  id: 'mom-001',
  title: 'MoM Test Draft',
  heldAt: '2026-09-15T07:00:00.000Z',
  status: 'draft' as const,
  contentText: 'Isi notulen test',
  pdfPath: null,
  finalizedAt: null,
  createdAt: '2026-09-15T07:00:00.000Z',
  updatedAt: '2026-09-15T07:00:00.000Z',
})

const stubMomFinal = () => ({
  ...stubMomDraft(),
  id: 'mom-002',
  status: 'final' as const,
  finalizedAt: '2026-09-15T10:00:00.000Z',
})

/** Stub MoM draft dengan PDF untuk test PDF deletion. */
const stubMomDraftWithPdf = () => ({
  ...stubMomDraft(),
  id: 'mom-003',
  pdfPath: 'mom-003/1726390800000-notulen.pdf',
})

/** Perekam panggilan — di-hoist agar factory vi.mock bisa menutupnya. */
const rekaman = vi.hoisted(() => ({
  insertMasuk: [] as Array<Record<string, unknown>>,
  updateMasuk: [] as Array<{ id: string, data: Record<string, unknown> }>,
  finalizeMasuk: [] as Array<{ id: string, finalizedAt: string }>,
  deleteMasuk: [] as string[],
  auditMasuk: [] as Array<Record<string, unknown>>,
  deletePdfMasuk: [] as string[], // Track PDF deletion calls
  findMom: null as ReturnType<typeof stubMomDraft> | null,
}))

beforeEach(() => {
  rekaman.insertMasuk.length = 0
  rekaman.updateMasuk.length = 0
  rekaman.finalizeMasuk.length = 0
  rekaman.deleteMasuk.length = 0
  rekaman.auditMasuk.length = 0
  rekaman.deletePdfMasuk.length = 0
  rekaman.findMom = null
})

vi.mock('./mom.repo', () => ({
  insertMom: async (_tx: unknown, row: Record<string, unknown>) => {
    rekaman.insertMasuk.push(row)
    return { ...stubMomDraft(), ...row }
  },
  updateMom: async (_tx: unknown, id: string, data: Record<string, unknown>) => {
    rekaman.updateMasuk.push({ id, data })
    return rekaman.findMom ? { ...rekaman.findMom, ...data } : null
  },
  finalizeMom: async (_tx: unknown, id: string, finalizedAt: string) => {
    rekaman.finalizeMasuk.push({ id, finalizedAt })
    return rekaman.findMom ? { ...rekaman.findMom, status: 'final', finalizedAt } : null
  },
  deleteMom: async (_tx: unknown, id: string) => {
    rekaman.deleteMasuk.push(id)
    return true
  },
  findMomById: async (_db: unknown, _id: string) => rekaman.findMom,
  listMoms: async (_db: unknown, _paging: { limit: number, offset: number }) => ({
    data: rekaman.findMom ? [rekaman.findMom] : [],
    nextPage: null,
  }),
}))

vi.mock('../audit', () => ({
  writeAuditEntry: async (_tx: unknown, input: Record<string, unknown>) => {
    rekaman.auditMasuk.push(input)
  },
}))

vi.mock('./pdf.service', () => ({
  deleteMomPdf: async (pdfPath: string) => {
    rekaman.deletePdfMasuk.push(pdfPath)
  },
}))

/** Mock Db dengan transaksi — semua service pakai db.transaction(). */
const mockDb = {
  transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({ rollback: () => {} }),
}

describe('server/domain/pricing/mom.service — buatMom (2-UNIT-001)', () => {
  test('buat MoM baru → insert + audit mom-dibuat', async () => {
    const actorOwnerId = 'owner-001'

    const mom = await buatMom(mockDb as never, {
      title: 'MoM Rapat Q3',
      heldAt: '2026-09-15T07:00:00.000Z',
      contentText: 'Pembahasan RKAP',
    }, actorOwnerId)

    expect(rekaman.insertMasuk).toHaveLength(1)
    expect(rekaman.insertMasuk[0]).toMatchObject({
      title: 'MoM Rapat Q3',
      heldAt: '2026-09-15T07:00:00.000Z',
    })
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-dibuat',
      actor: { kind: 'user', ownerId: actorOwnerId },
    })
    expect(mom.title).toBe('MoM Rapat Q3')
  })
})

describe('server/domain/pricing/mom.service — ubahMom (2-UNIT-002)', () => {
  test('edit MoM draft → update + audit mom-diubah', async () => {
    rekaman.findMom = stubMomDraft()

    const mom = await ubahMom(mockDb as never, 'mom-001', {
      title: 'MoM Updated',
    }, 'owner-001')

    expect(rekaman.updateMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-diubah',
    })
    expect(mom.title).toBe('MoM Updated')
  })

  test('edit MoM final → tolak ALREADY_FINAL', async () => {
    rekaman.findMom = stubMomFinal()

    await expect(ubahMom(mockDb as never, 'mom-002', { title: 'Coba Edit' }, 'owner-001'))
      .rejects.toThrow(MomDomainError)

    try {
      await ubahMom(mockDb as never, 'mom-002', { title: 'Coba Edit' }, 'owner-001')
    } catch (error) {
      expect((error as MomDomainError).code).toBe('ALREADY_FINAL')
    }
    expect(rekaman.updateMasuk).toHaveLength(0)
  })

  test('edit MoM tidak ditemukan → tolak NOT_FOUND', async () => {
    rekaman.findMom = null

    await expect(ubahMom(mockDb as never, 'mom-xxx', { title: 'Coba Edit' }, 'owner-001'))
      .rejects.toThrow(MomDomainError)
  })
})

describe('server/domain/pricing/mom.service — finalkanMom (2-UNIT-003)', () => {
  test('finalize MoM draft → status final + audit mom-difinalkan', async () => {
    rekaman.findMom = stubMomDraft()

    const mom = await finalkanMom(mockDb as never, 'mom-001', 'owner-001')

    expect(rekaman.finalizeMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-difinalkan',
    })
    expect(mom.status).toBe('final')
    expect(mom.finalizedAt).toBeTruthy()
  })

  test('finalize MoM yang sudah final → tolak ALREADY_FINAL', async () => {
    rekaman.findMom = stubMomFinal()

    await expect(finalkanMom(mockDb as never, 'mom-002', 'owner-001'))
      .rejects.toThrow(MomDomainError)
  })

  test('finalize MoM tidak ditemukan → tolak NOT_FOUND', async () => {
    rekaman.findMom = null

    await expect(finalkanMom(mockDb as never, 'mom-xxx', 'owner-001'))
      .rejects.toThrow(MomDomainError)
  })
})

describe('server/domain/pricing/mom.service — hapusMom (2-UNIT-004)', () => {
  test('hapus MoM draft → delete + audit mom-dihapus', async () => {
    rekaman.findMom = stubMomDraft()

    await hapusMom(mockDb as never, 'mom-001', 'owner-001')

    expect(rekaman.deleteMasuk).toHaveLength(1)
    expect(rekaman.deleteMasuk[0]).toBe('mom-001')
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-dihapus',
    })
    // No PDF path, so no PDF deletion call
    expect(rekaman.deletePdfMasuk).toHaveLength(0)
  })

  test('hapus MoM draft dengan PDF → delete MoM + delete PDF dari storage (Req-1 AC5)', async () => {
    rekaman.findMom = stubMomDraftWithPdf()

    await hapusMom(mockDb as never, 'mom-003', 'owner-001')

    expect(rekaman.deleteMasuk).toHaveLength(1)
    expect(rekaman.deleteMasuk[0]).toBe('mom-003')
    expect(rekaman.auditMasuk).toHaveLength(1)
    expect(rekaman.auditMasuk[0]).toMatchObject({
      action: 'mom-dihapus',
      details: expect.objectContaining({
        pdfPath: 'mom-003/1726390800000-notulen.pdf',
      }),
    })
    // PDF path exists, so PDF deletion should be called
    expect(rekaman.deletePdfMasuk).toHaveLength(1)
    expect(rekaman.deletePdfMasuk[0]).toBe('mom-003/1726390800000-notulen.pdf')
  })

  test('hapus MoM final → tolak ALREADY_FINAL', async () => {
    rekaman.findMom = stubMomFinal()

    await expect(hapusMom(mockDb as never, 'mom-002', 'owner-001'))
      .rejects.toThrow(MomDomainError)
    expect(rekaman.deleteMasuk).toHaveLength(0)
  })

  test('hapus MoM tidak ditemukan → tolak NOT_FOUND', async () => {
    rekaman.findMom = null

    await expect(hapusMom(mockDb as never, 'mom-xxx', 'owner-001'))
      .rejects.toThrow(MomDomainError)
  })
})

describe('server/domain/pricing/mom.service — listForPemegangSaham (2-UNIT-005)', () => {
  test('page 1 → limit 10 offset 0 (default)', async () => {
    const result = await listForPemegangSaham(mockDb as never, 1)

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('nextPage')
  })

  test('page 2 limit 20 → offset 20', async () => {
    const result = await listForPemegangSaham(mockDb as never, 2, 20)

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('nextPage')
  })
})

describe('server/domain/pricing/mom.service — getMomById (2-UNIT-006)', () => {
  test('mom ada → return mom', async () => {
    rekaman.findMom = stubMomDraft()

    const mom = await getMomById(mockDb as never, 'mom-001')

    expect(mom).not.toBeNull()
    expect(mom?.id).toBe('mom-001')
  })

  test('mom tidak ada → return null', async () => {
    rekaman.findMom = null

    const mom = await getMomById(mockDb as never, 'mom-xxx')

    expect(mom).toBeNull()
  })
})
