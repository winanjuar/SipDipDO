/**
 * PRICING — mom.service: logika bisnis MoM (FR-7, Story 2.1).
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts):
 *
 *   buatMom(db, input, actorOwnerId)
 *     — buat MoM baru dengan audit entry `mom-dibuat` dalam satu transaksi (AD-3).
 *   ubahMom(db, momId, input, actorOwnerId)
 *     — ubah MoM draft dengan audit entry `mom-diubah`; tolak bila final.
 *   finalkanMom(db, momId, actorOwnerId)
 *     — set status ke final dengan audit entry `mom-difinalkan`; tolak bila sudah final.
 *   hapusMom(db, momId, actorOwnerId)
 *     — hapus MoM draft dengan audit entry `mom-dihapus`; tolak bila final.
 *   listForPemegangSaham(db, page, limit?)
 *     — baca daftar MoM urut held_at desc dengan paging.
 *   getMomById(db, momId)
 *     — baca detail MoM; null bila tidak ditemukan.
 *
 * Invariants (Story 2.1 Boundaries):
 * - Entry audit ditulis dalam transaksi DB yang sama dengan aksinya (AD-3).
 * - MoM final imutabel — tidak dapat diedit/dihapus.
 * - Tanggal (held_at) wajib saat membuat MoM.
 */
import type { Db, DbClient } from '../../utils/db'
import { writeAuditEntry } from '../audit'
import {
  deleteMom as repoDeleteMom,
  finalizeMom as repoFinalizeMom,
  findMomById,
  insertMom,
  listMoms,
  updateMom as repoUpdateMom,
} from './mom.repo'
import {
  MOM_LIMIT_DEFAULT,
  type MomCreateInput,
  type MomDaftar,
  type MomLimit,
  type MomUpdateInput,
  type MomWire,
} from '#shared/domain/mom'

/** Error domain untuk aksi MoM — memudahkan handler membedakan jenis error. */
export class MomDomainError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'ALREADY_FINAL' | 'VALIDATION',
  ) {
    super(message)
    this.name = 'MomDomainError'
  }
}

/**
 * Buat MoM baru dengan audit entry `mom-dibuat` dalam satu transaksi (AD-3).
 */
export async function buatMom(
  db: Db,
  input: MomCreateInput,
  actorOwnerId: string,
): Promise<MomWire> {
  return db.transaction(async (tx) => {
    const mom = await insertMom(tx, {
      title: input.title.trim(),
      heldAt: input.heldAt,
      contentText: input.contentText ?? null,
    })

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-dibuat',
      target: `moms:${mom.id}`,
      details: { title: mom.title, heldAt: mom.heldAt },
    })

    return mom
  })
}

/**
 * Ubah MoM draft dengan audit entry `mom-diubah` dalam satu transaksi (AD-3).
 * Throw MomDomainError bila tidak ditemukan atau sudah final.
 */
export async function ubahMom(
  db: Db,
  momId: string,
  input: MomUpdateInput,
  actorOwnerId: string,
): Promise<MomWire> {
  return db.transaction(async (tx) => {
    const existing = await findMomById(tx, momId)
    if (!existing) {
      throw new MomDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }
    if (existing.status === 'final') {
      throw new MomDomainError('MoM sudah difinalkan — tidak dapat diubah.', 'ALREADY_FINAL')
    }

    const now = new Date().toISOString()
    const updated = await repoUpdateMom(tx, momId, {
      title: input.title?.trim(),
      heldAt: input.heldAt,
      contentText: input.contentText,
      updatedAt: now,
    })

    if (!updated) {
      throw new MomDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-diubah',
      target: `moms:${momId}`,
      details: {
        title: updated.title,
        heldAt: updated.heldAt,
        changes: input,
      },
    })

    return updated
  })
}

/**
 * Finalkan MoM — set status ke final dengan audit entry `mom-difinalkan` (AD-3).
 * Throw MomDomainError bila tidak ditemukan atau sudah final.
 */
export async function finalkanMom(
  db: Db,
  momId: string,
  actorOwnerId: string,
): Promise<MomWire> {
  return db.transaction(async (tx) => {
    const existing = await findMomById(tx, momId)
    if (!existing) {
      throw new MomDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }
    if (existing.status === 'final') {
      throw new MomDomainError('MoM sudah difinalkan.', 'ALREADY_FINAL')
    }

    const now = new Date().toISOString()
    const updated = await repoFinalizeMom(tx, momId, now)

    if (!updated) {
      throw new MomDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-difinalkan',
      target: `moms:${momId}`,
      details: { title: updated.title, heldAt: updated.heldAt },
    })

    return updated
  })
}

/**
 * Hapus MoM draft dengan audit entry `mom-dihapus` dalam satu transaksi (AD-3).
 * Throw MomDomainError bila tidak ditemukan atau sudah final.
 */
export async function hapusMom(
  db: Db,
  momId: string,
  actorOwnerId: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    const existing = await findMomById(tx, momId)
    if (!existing) {
      throw new MomDomainError('MoM tidak ditemukan.', 'NOT_FOUND')
    }
    if (existing.status === 'final') {
      throw new MomDomainError('MoM sudah difinalkan — tidak dapat dihapus.', 'ALREADY_FINAL')
    }

    await repoDeleteMom(tx, momId)

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-dihapus',
      target: `moms:${momId}`,
      details: { title: existing.title, heldAt: existing.heldAt },
    })
  })
}

/**
 * Baca daftar MoM urut held_at desc dengan paging — untuk pemegang saham.
 * Penegakan kewenangan ada di route handler (AD-8).
 */
export async function listForPemegangSaham(
  db: DbClient,
  page: number,
  limit: MomLimit = MOM_LIMIT_DEFAULT,
): Promise<MomDaftar> {
  const offset = (page - 1) * limit
  const result = await listMoms(db, { limit, offset })
  return { data: result.data, nextPage: result.nextPage }
}

/**
 * Baca detail MoM — null bila tidak ditemukan.
 * Penegakan kewenangan ada di route handler (AD-8).
 */
export async function getMomById(db: DbClient, momId: string): Promise<MomWire | null> {
  return findMomById(db, momId)
}
