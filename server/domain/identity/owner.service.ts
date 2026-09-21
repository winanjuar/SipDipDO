/**
 * IDENTITY — owner.service.ts (Story 1.8): service functions untuk manajemen
 * owner oleh COO. Setiap operasi mutasi (update, create) menulis audit entry
 * dalam transaksi DB yang sama (AD-3). Field `status` owner tidak diubah via
 * API ini (AD-11) — validasi sudah ditegakkan schema Zod di `owner.schemas.ts`.
 *
 * Service functions:
 * - `listOwners(db)` → GET /api/admin/owners
 * - `getOwnerById(ownerId, db)` → GET /api/admin/owners/:id
 * - `updateOwner(input, db)` → PUT /api/admin/owners/:id
 * - `createOwnerByCoo(input, cooOwnerId, db)` → POST /api/admin/owners
 */
import { eq } from 'drizzle-orm'
import {
  ownerBankAccounts,
  ownerEmergencyContacts,
  owners,
} from '../../../drizzle/schema'
import { buatKodeReferral, type OwnerStatus } from '../../../shared/domain/identity'
import { namaBankKeTersimpan, namaBankKeWire, profilLengkap } from '../../../shared/domain/profil'
import { writeAuditEntry } from '../audit/index'
import type { Db, DbClient } from '../../utils/db'
import type { CreateOwnerInput, UpdateOwnerInput } from './owner.schemas'

/* ------------------------------------------------------------------ *
 * Tipe hasil — bentuk wire untuk API response.
 * ------------------------------------------------------------------ */

/** Ringkasan owner untuk daftar (GET /api/admin/owners). */
export interface OwnerListItem {
  id: string
  fullName: string | null
  alias: string | null
  email: string
  phoneNumber: string | null
  status: OwnerStatus
  profileComplete: boolean
  createdAt: string
}

/** Detail owner lengkap (GET /api/admin/owners/:id). */
export interface OwnerDetail {
  id: string
  email: string
  status: OwnerStatus
  rejectionReason: string | null
  firstEffectiveAt: string | null
  fullName: string | null
  alias: string | null
  phoneNumber: string | null
  createdAt: string
  updatedAt: string
}

/** Kontak darurat owner (nested dalam GetOwnerResponse). */
export interface EmergencyContactDetail {
  name: string | null
  phoneNumber: string | null
  relationship: string | null
}

/** Rekening bank owner (nested dalam GetOwnerResponse). */
export interface BankAccountDetail {
  bankName: string | null
  otherBankName: string | null
  accountHolderName: string | null
  accountNumber: string | null
}

/** Response lengkap GET /api/admin/owners/:id. */
export interface GetOwnerResponse {
  owner: OwnerDetail
  emergencyContact: EmergencyContactDetail | null
  bankAccount: BankAccountDetail | null
}

/** Hasil create owner baru oleh COO. */
export interface CreateOwnerResult {
  success: true
  owner: OwnerDetail
}

/** Error email sudah terdaftar. */
export interface CreateOwnerEmailExistsError {
  success: false
  error: 'EMAIL_EXISTS'
}

export type CreateOwnerResponse = CreateOwnerResult | CreateOwnerEmailExistsError

/* ------------------------------------------------------------------ *
 * List Owners — GET /api/admin/owners
 * ------------------------------------------------------------------ */

/**
 * Ambil daftar semua owner dengan data ringkasan (Story 1.8, Req 1, 4).
 * Termasuk owner berstatus `keluar` (FR-13). Dipakai untuk halaman manajemen
 * owner COO dan komponen OwnerPicker.
 */
export async function listOwners(db: DbClient): Promise<OwnerListItem[]> {
  const rows = await db
    .select({
      id: owners.id,
      fullName: owners.fullName,
      alias: owners.alias,
      email: owners.email,
      phoneNumber: owners.phoneNumber,
      status: owners.status,
      createdAt: owners.createdAt,
      // Field untuk kelengkapan profil
      emergencyContactName: ownerEmergencyContacts.name,
      emergencyContactPhoneNumber: ownerEmergencyContacts.phoneNumber,
      emergencyContactRelationship: ownerEmergencyContacts.relationship,
      storedBankName: ownerBankAccounts.bankName,
      accountHolderName: ownerBankAccounts.accountHolderName,
      accountNumber: ownerBankAccounts.accountNumber,
    })
    .from(owners)
    .leftJoin(ownerEmergencyContacts, eq(ownerEmergencyContacts.ownerId, owners.id))
    .leftJoin(ownerBankAccounts, eq(ownerBankAccounts.ownerId, owners.id))
    .orderBy(owners.createdAt)

  return rows.map((r) => {
    const bank = r.storedBankName === null
      ? { bankName: null, otherBankName: null }
      : namaBankKeWire(r.storedBankName)
    const profilNilai = {
      fullName: r.fullName,
      alias: r.alias,
      phoneNumber: r.phoneNumber,
      emergencyContactName: r.emergencyContactName,
      emergencyContactPhoneNumber: r.emergencyContactPhoneNumber,
      emergencyContactRelationship: r.emergencyContactRelationship,
      bankName: bank.bankName,
      otherBankName: bank.otherBankName,
      accountHolderName: r.accountHolderName,
      accountNumber: r.accountNumber,
    }
    return {
      id: r.id,
      fullName: r.fullName,
      alias: r.alias,
      email: r.email,
      phoneNumber: r.phoneNumber,
      status: r.status,
      profileComplete: profilLengkap(profilNilai),
      createdAt: r.createdAt,
    }
  })
}

/* ------------------------------------------------------------------ *
 * Get Owner By ID — GET /api/admin/owners/:id
 * ------------------------------------------------------------------ */

/**
 * Ambil detail owner lengkap berdasarkan ID (Story 1.8, Req 2).
 * Termasuk kontak darurat dan rekening bank.
 */
export async function getOwnerById(ownerId: string, db: DbClient): Promise<GetOwnerResponse | null> {
  const rows = await db
    .select({
      id: owners.id,
      email: owners.email,
      status: owners.status,
      rejectionReason: owners.rejectionReason,
      firstEffectiveAt: owners.firstEffectiveAt,
      fullName: owners.fullName,
      alias: owners.alias,
      phoneNumber: owners.phoneNumber,
      createdAt: owners.createdAt,
      updatedAt: owners.updatedAt,
      emergencyContactName: ownerEmergencyContacts.name,
      emergencyContactPhoneNumber: ownerEmergencyContacts.phoneNumber,
      emergencyContactRelationship: ownerEmergencyContacts.relationship,
      storedBankName: ownerBankAccounts.bankName,
      accountHolderName: ownerBankAccounts.accountHolderName,
      accountNumber: ownerBankAccounts.accountNumber,
    })
    .from(owners)
    .leftJoin(ownerEmergencyContacts, eq(ownerEmergencyContacts.ownerId, owners.id))
    .leftJoin(ownerBankAccounts, eq(ownerBankAccounts.ownerId, owners.id))
    .where(eq(owners.id, ownerId))
    .limit(1)

  const r = rows[0]
  if (!r) return null

  const bank = r.storedBankName === null
    ? { bankName: null, otherBankName: null }
    : namaBankKeWire(r.storedBankName)

  const hasEmergencyContact = r.emergencyContactName !== null
    || r.emergencyContactPhoneNumber !== null
    || r.emergencyContactRelationship !== null

  const hasBankAccount = r.storedBankName !== null
    || r.accountHolderName !== null
    || r.accountNumber !== null

  return {
    owner: {
      id: r.id,
      email: r.email,
      status: r.status,
      rejectionReason: r.rejectionReason,
      firstEffectiveAt: r.firstEffectiveAt,
      fullName: r.fullName,
      alias: r.alias,
      phoneNumber: r.phoneNumber,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    },
    emergencyContact: hasEmergencyContact
      ? {
          name: r.emergencyContactName,
          phoneNumber: r.emergencyContactPhoneNumber,
          relationship: r.emergencyContactRelationship,
        }
      : null,
    bankAccount: hasBankAccount
      ? {
          bankName: bank.bankName,
          otherBankName: bank.otherBankName,
          accountHolderName: r.accountHolderName,
          accountNumber: r.accountNumber,
        }
      : null,
  }
}

/* ------------------------------------------------------------------ *
 * Update Owner — PUT /api/admin/owners/:id
 * ------------------------------------------------------------------ */

/** Input update owner dengan ID. */
export interface UpdateOwnerServiceInput extends UpdateOwnerInput {
  ownerId: string
}

/**
 * Update data owner oleh COO (Story 1.8, Req 2).
 * Menulis audit entry `kelola-owner-perubahan` dalam transaksi yang sama (AD-3).
 * Field `status` dan `email` tidak dapat diubah (AD-11, identifier unik).
 *
 * @param input - Data yang akan diupdate
 * @param cooOwnerId - ID owner COO yang melakukan perubahan (untuk audit)
 * @param db - Database connection
 * @returns Owner detail setelah update, atau null jika owner tidak ditemukan
 */
export async function updateOwner(
  input: UpdateOwnerServiceInput,
  cooOwnerId: string,
  db: Db,
): Promise<GetOwnerResponse | null> {
  return db.transaction(async (tx) => {
    const nowIso = new Date().toISOString()

    // Ambil data sebelum update untuk audit
    const sebelum = await getOwnerById(input.ownerId, tx)
    if (!sebelum) return null

    // Build changes untuk audit detail
    const changes: Record<string, { old: unknown, new: unknown }> = {}

    // Update owner fields
    const ownerUpdates: Record<string, string | null> = { updatedAt: nowIso }
    if (input.fullName !== undefined && input.fullName !== sebelum.owner.fullName) {
      ownerUpdates.fullName = input.fullName
      changes.fullName = { old: sebelum.owner.fullName, new: input.fullName }
    }
    if (input.alias !== undefined && input.alias !== sebelum.owner.alias) {
      ownerUpdates.alias = input.alias
      changes.alias = { old: sebelum.owner.alias, new: input.alias }
    }
    if (input.phoneNumber !== undefined && input.phoneNumber !== sebelum.owner.phoneNumber) {
      ownerUpdates.phoneNumber = input.phoneNumber
      changes.phoneNumber = { old: sebelum.owner.phoneNumber, new: input.phoneNumber }
    }

    // Update owners table
    await tx
      .update(owners)
      .set(ownerUpdates)
      .where(eq(owners.id, input.ownerId))

    // Update emergency contact jika ada
    if (input.emergencyContact !== undefined) {
      const ec = input.emergencyContact
      const ecSebelum = sebelum.emergencyContact

      if (ec.name !== undefined && ec.name !== ecSebelum?.name) {
        changes.emergencyContactName = { old: ecSebelum?.name ?? null, new: ec.name }
      }
      if (ec.phoneNumber !== undefined && ec.phoneNumber !== ecSebelum?.phoneNumber) {
        changes.emergencyContactPhoneNumber = { old: ecSebelum?.phoneNumber ?? null, new: ec.phoneNumber }
      }
      if (ec.relationship !== undefined && ec.relationship !== ecSebelum?.relationship) {
        changes.emergencyContactRelationship = { old: ecSebelum?.relationship ?? null, new: ec.relationship }
      }

      await tx
        .insert(ownerEmergencyContacts)
        .values({
          ownerId: input.ownerId,
          name: ec.name ?? ecSebelum?.name ?? null,
          phoneNumber: ec.phoneNumber ?? ecSebelum?.phoneNumber ?? null,
          relationship: ec.relationship ?? ecSebelum?.relationship ?? null,
        })
        .onConflictDoUpdate({
          target: ownerEmergencyContacts.ownerId,
          set: {
            name: ec.name ?? ecSebelum?.name ?? null,
            phoneNumber: ec.phoneNumber ?? ecSebelum?.phoneNumber ?? null,
            relationship: ec.relationship ?? ecSebelum?.relationship ?? null,
          },
        })
    }

    // Update bank account jika ada
    if (input.bankAccount !== undefined) {
      const ba = input.bankAccount
      const baSebelum = sebelum.bankAccount

      if (ba.bankName !== undefined && ba.bankName !== baSebelum?.bankName) {
        changes.bankName = { old: baSebelum?.bankName ?? null, new: ba.bankName }
      }
      if (ba.otherBankName !== undefined && ba.otherBankName !== baSebelum?.otherBankName) {
        changes.otherBankName = { old: baSebelum?.otherBankName ?? null, new: ba.otherBankName }
      }
      if (ba.accountHolderName !== undefined && ba.accountHolderName !== baSebelum?.accountHolderName) {
        changes.accountHolderName = { old: baSebelum?.accountHolderName ?? null, new: ba.accountHolderName }
      }
      if (ba.accountNumber !== undefined && ba.accountNumber !== baSebelum?.accountNumber) {
        changes.accountNumber = { old: baSebelum?.accountNumber ?? null, new: ba.accountNumber }
      }

      // Hitung nilai bank tersimpan
      const bankName = ba.bankName ?? baSebelum?.bankName ?? ''
      const otherBankName = ba.otherBankName ?? baSebelum?.otherBankName ?? ''
      const bankTersimpan = namaBankKeTersimpan(bankName, otherBankName)

      await tx
        .insert(ownerBankAccounts)
        .values({
          ownerId: input.ownerId,
          bankName: bankTersimpan || null,
          accountHolderName: ba.accountHolderName ?? baSebelum?.accountHolderName ?? null,
          accountNumber: ba.accountNumber ?? baSebelum?.accountNumber ?? null,
        })
        .onConflictDoUpdate({
          target: ownerBankAccounts.ownerId,
          set: {
            bankName: bankTersimpan || null,
            accountHolderName: ba.accountHolderName ?? baSebelum?.accountHolderName ?? null,
            accountNumber: ba.accountNumber ?? baSebelum?.accountNumber ?? null,
          },
        })
    }

    // Tulis audit entry hanya jika ada perubahan (AD-3, Req 2.5)
    if (Object.keys(changes).length > 0) {
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: cooOwnerId },
        action: 'kelola-owner-perubahan',
        target: `owners:${input.ownerId}`,
        details: { email: sebelum.owner.email, changes },
      })
    }

    // Baca ulang untuk respons
    return getOwnerById(input.ownerId, tx)
  })
}

/* ------------------------------------------------------------------ *
 * Create Owner By COO — POST /api/admin/owners
 * ------------------------------------------------------------------ */

/** Batas coba ulang pembuatan kode referral saat tabrakan UNIQUE. */
const BATAS_COBA_KODE_REFERRAL = 3

/** true bila error adalah tabrakan UNIQUE (postgres 23505). */
function tabrakanUnique(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505'
}

/** true bila error adalah tabrakan UNIQUE pada email. */
function tabrakanEmail(error: unknown): boolean {
  const err = error as { constraint?: string, code?: unknown } | null
  return err?.code === '23505' && err?.constraint === 'owners_email_unique'
}

/**
 * Buat owner baru oleh COO (Story 1.8, Req 3).
 * Owner dibuat dengan status `terverifikasi` (pre-approved).
 * Menulis audit entry `kelola-owner-penambahan` dalam transaksi yang sama (AD-3).
 *
 * @param input - Data owner baru (email wajib)
 * @param cooOwnerId - ID owner COO yang melakukan penambahan (untuk audit)
 * @param db - Database connection
 * @returns Owner detail jika berhasil, atau error EMAIL_EXISTS jika email sudah terdaftar
 */
export async function createOwnerByCoo(
  input: CreateOwnerInput,
  cooOwnerId: string,
  db: Db,
): Promise<CreateOwnerResponse> {
  for (let percobaan = 1; ; percobaan++) {
    try {
      return await db.transaction(async (tx) => {
        const nowIso = new Date().toISOString()

        // Insert owner baru dengan status terverifikasi
        const inserted = await tx
          .insert(owners)
          .values({
            email: input.email,
            fullName: input.fullName ?? null,
            alias: input.alias ?? null,
            phoneNumber: input.phoneNumber ?? null,
            status: 'terverifikasi' as OwnerStatus,
            referralCode: buatKodeReferral(),
            createdAt: nowIso,
            updatedAt: nowIso,
          })
          .returning({ id: owners.id })

        const ownerId = inserted[0]?.id
        if (!ownerId) {
          throw new Error('createOwnerByCoo: gagal membuat baris owner baru.')
        }

        // Insert emergency contact jika ada
        if (input.emergencyContact !== undefined) {
          const ec = input.emergencyContact
          await tx
            .insert(ownerEmergencyContacts)
            .values({
              ownerId,
              name: ec.name ?? null,
              phoneNumber: ec.phoneNumber ?? null,
              relationship: ec.relationship ?? null,
            })
        }

        // Insert bank account jika ada
        if (input.bankAccount !== undefined) {
          const ba = input.bankAccount
          const bankTersimpan = namaBankKeTersimpan(ba.bankName ?? '', ba.otherBankName ?? '')
          await tx
            .insert(ownerBankAccounts)
            .values({
              ownerId,
              bankName: bankTersimpan || null,
              accountHolderName: ba.accountHolderName ?? null,
              accountNumber: ba.accountNumber ?? null,
            })
        }

        // Tulis audit entry (AD-3, Req 3.3)
        await writeAuditEntry(tx, {
          actor: { kind: 'user', ownerId: cooOwnerId },
          action: 'kelola-owner-penambahan',
          target: `owners:${ownerId}`,
          details: { email: input.email, status: 'terverifikasi' },
        })

        // Baca ulang untuk respons
        const result = await getOwnerById(ownerId, tx)
        if (!result) {
          throw new Error('createOwnerByCoo: gagal membaca owner baru setelah insert.')
        }
        return { success: true as const, owner: result.owner }
      })
    } catch (error) {
      // Jika tabrakan email, kembalikan error EMAIL_EXISTS
      if (tabrakanEmail(error)) {
        return { success: false, error: 'EMAIL_EXISTS' }
      }
      // Jika tabrakan referral code (bukan email), retry
      if (tabrakanUnique(error) && percobaan < BATAS_COBA_KODE_REFERRAL) {
        continue
      }
      throw error
    }
  }
}
