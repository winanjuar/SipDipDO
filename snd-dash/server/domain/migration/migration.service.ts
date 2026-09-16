// server/domain/migration/migration.service.ts
//
// Orkestrasi domain migrasi historis (FR-14). Menegakkan:
//   - run(source) : SATU transaksi DB atomik (AD-2) yang memigrasikan seluruh
//                   riwayat transaksi (termasuk sheet Evidence) + rekap
//                   kepemilikan (FR-14 §14.1) dan Profile Owner/Calon Owner dari
//                   Google Form (§14.2), lalu mengembalikan MigrationReport
//                   dengan Grand Total (Quantity/Shares/Ceil) untuk dicocokkan
//                   dengan rekap spreadsheet (§14.3).
//
// Alur (in-tx):
//   1. Validasi bentuk sumber (ownerKey unik, transaksi merujuk Owner yang ada,
//      Quantity integer positif).
//   2. Upsert Owner (by email) sebagai pemegang saham eksisting
//      ('terverifikasi') + Profile (Google Form). `firstEffectiveAt` di-set dari
//      transaksi historis paling awal milik Owner tsb.
//   3. Petakan transaksi → MigrationRow[] (resolve ownerKey → owners.id) lalu
//      `ledger.importHistorical(tx, rows)` (aktor 'system'; TANPA gerbang &
//      TANPA penyesuaian instant, AD-1/AD-4).
//   4. Audit 'migration_import' (aktor 'system', AD-3) — in-tx.
//   5. Hitung Grand Total (Quantity/Shares/Ceil) dari posisi seluruh Owner
//      terimpor (proyeksi AD-4) untuk MigrationReport.
//
// Catatan: migrasi adalah operasi sistem BULK — Owner/Profile disisipkan
// langsung via schema in-tx (bukan `identity.submitRegistration`, yang
// diperuntukkan alur pendaftaran interaktif, bukan import historis massal).

import { eq } from 'drizzle-orm'
import { withTransaction, schema } from '../../utils/db'
import type { Tx } from '../../utils/db'
import type {
  CapitalType,
  JakartaDate,
  Uuid,
} from '../../../shared/domain/types'
import { ledger } from '../ledger'
import type { MigrationRow } from '../ledger'
import { audit } from '../audit'
import {
  MigrationError,
} from './events'
import type {
  MigrationGrandTotal,
  MigrationOwner,
  MigrationReport,
  MigrationSource,
  MigrationTransaction,
} from './events'

const { owners, profiles } = schema

// Aktor sistem untuk seluruh tulisan migrasi (FR-14).
const SYSTEM_ACTOR = 'system' as unknown as Uuid

/**
 * Menjalankan migrasi historis (FR-14) dalam SATU transaksi atomik (AD-2).
 * Mengembalikan `MigrationReport` dengan Grand Total hasil migrasi.
 */
export async function run(source: MigrationSource): Promise<MigrationReport> {
  validateSource(source)

  // Waktu efektif terawal per Owner (basis firstEffectiveAt).
  const earliestByKey = earliestEffectiveByOwnerKey(source.transactions)

  return withTransaction(async (tx) => {
    // 1) Upsert Owner + Profile; resolusi ownerKey → owners.id.
    const idByKey = new Map<string, Uuid>()
    for (const owner of source.owners) {
      const ownerId = await upsertOwner(tx, owner, earliestByKey.get(owner.ownerKey) ?? null)
      idByKey.set(owner.ownerKey, ownerId)
      await upsertProfile(tx, ownerId, owner)
    }

    // 2) Petakan transaksi → MigrationRow[] (resolve ownerKey → owners.id).
    const rows: MigrationRow[] = source.transactions.map((t) => {
      const ownerId = idByKey.get(t.ownerKey)
      if (!ownerId) {
        throw new MigrationError(
          'UNKNOWN_OWNER_KEY',
          `Transaksi historis merujuk ownerKey yang tidak ada pada daftar Owner: ${t.ownerKey}.`,
          { ownerKey: t.ownerKey },
        )
      }
      return toMigrationRow(t, ownerId)
    })

    // 3) Impor transaksi historis via primitive ledger (aktor 'system').
    await ledger.importHistorical(tx, rows)

    // 4) Audit 'migration_import' (aktor 'system', AD-3) — in-tx.
    await audit.write(tx, {
      actor: SYSTEM_ACTOR,
      action: 'migration_import',
      target: SYSTEM_ACTOR,
      details: {
        ownersImported: source.owners.length,
        transactionsImported: rows.length,
      },
    })

    // 5) Hitung Grand Total dari posisi seluruh Owner terimpor (proyeksi AD-4).
    const ownerIds = new Set<Uuid>(idByKey.values())
    const grandTotal = await computeGrandTotal(tx, ownerIds)

    return {
      ownersImported: source.owners.length,
      transactionsImported: rows.length,
      grandTotal,
    }
  })
}

// ---------------------------------------------------------------------------
// Validasi bentuk sumber
// ---------------------------------------------------------------------------

/**
 * Validasi bentuk `MigrationSource` sebelum menyentuh DB: ownerKey/email unik,
 * seluruh transaksi merujuk Owner yang ada, dan Quantity berupa integer positif.
 */
function validateSource(source: MigrationSource): void {
  const seenKeys = new Set<string>()
  const seenEmails = new Set<string>()
  for (const owner of source.owners) {
    if (seenKeys.has(owner.ownerKey)) {
      throw new MigrationError(
        'DUPLICATE_OWNER_KEY',
        `ownerKey duplikat pada sumber migrasi: ${owner.ownerKey}.`,
        { ownerKey: owner.ownerKey },
      )
    }
    if (seenEmails.has(owner.email)) {
      throw new MigrationError(
        'DUPLICATE_OWNER_KEY',
        `email Owner duplikat pada sumber migrasi: ${owner.email}.`,
        { email: owner.email },
      )
    }
    seenKeys.add(owner.ownerKey)
    seenEmails.add(owner.email)
  }

  for (const t of source.transactions) {
    if (!seenKeys.has(t.ownerKey)) {
      throw new MigrationError(
        'UNKNOWN_OWNER_KEY',
        `Transaksi historis merujuk ownerKey yang tidak ada pada daftar Owner: ${t.ownerKey}.`,
        { ownerKey: t.ownerKey },
      )
    }
    if (!Number.isInteger(t.quantity) || t.quantity <= 0) {
      throw new MigrationError(
        'INVALID_QUANTITY',
        `Quantity transaksi historis harus bilangan bulat positif (ownerKey ${t.ownerKey}).`,
        { ownerKey: t.ownerKey, quantity: t.quantity },
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Upsert Owner & Profile (bulk sistem) — direct schema in-tx
// ---------------------------------------------------------------------------

/**
 * Upsert Owner historis by email (AD-7). Owner historis adalah pemegang saham
 * eksisting → status 'terverifikasi'; `firstEffectiveAt` di-set dari transaksi
 * historis paling awal (bila ada). Mengembalikan `owners.id`.
 */
async function upsertOwner(
  tx: Tx,
  owner: MigrationOwner,
  firstEffectiveAt: Date | null,
): Promise<Uuid> {
  const existing = await tx
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.email, owner.email))
    .limit(1)

  if (existing[0]) {
    const id = existing[0].id as Uuid
    await tx
      .update(owners)
      .set({
        name: owner.name ?? null,
        status: 'terverifikasi',
        ...(firstEffectiveAt ? { firstEffectiveAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(owners.id, id))
    return id
  }

  const [row] = await tx
    .insert(owners)
    .values({
      email: owner.email,
      name: owner.name ?? null,
      status: 'terverifikasi',
      ...(firstEffectiveAt ? { firstEffectiveAt } : {}),
    })
    .returning({ id: owners.id })

  return row!.id as Uuid
}

/**
 * Upsert Profile Owner dari data pendaftaran Google Form (FR-14 §14.2). Profile
 * unik per Owner (`profiles.owner_id` UNIQUE); bila sudah ada → update payload.
 */
async function upsertProfile(
  tx: Tx,
  ownerId: Uuid,
  owner: MigrationOwner,
): Promise<void> {
  const profile = owner.profile
  const data = (profile?.data ?? {}) as Record<string, unknown>
  const isComplete = profile?.isComplete ?? false
  const waContact = profile?.waContact ?? null
  const emailContact = profile?.emailContact ?? owner.email

  const existing = await tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.ownerId, ownerId))
    .limit(1)

  if (existing[0]) {
    await tx
      .update(profiles)
      .set({
        data,
        isComplete,
        waContact,
        emailContact,
        updatedAt: new Date(),
      })
      .where(eq(profiles.ownerId, ownerId))
    return
  }

  await tx.insert(profiles).values({
    ownerId,
    data,
    isComplete,
    waContact,
    emailContact,
  })
}

// ---------------------------------------------------------------------------
// Pemetaan & agregasi
// ---------------------------------------------------------------------------

/** Petakan satu transaksi historis → `MigrationRow` (resolve owners.id). */
function toMigrationRow(t: MigrationTransaction, ownerId: Uuid): MigrationRow {
  return {
    ownerId,
    capitalType: t.capitalType,
    quantity: t.quantity,
    finalPrice: t.finalPrice,
    finalPriceRef: t.finalPriceRef,
    actualAmount: t.actualAmount,
    paymentDate: t.paymentDate,
    paymentMethod: t.paymentMethod ?? 'migrasi',
    capitalItemId: t.capitalItemId ?? null,
    effectiveAt: resolveEffectiveAt(t),
  }
}

/**
 * Waktu efektif historis satu transaksi: `effectiveAt` eksplisit bila ada, jika
 * tidak diturunkan dari `paymentDate` (JakartaDate 'YYYY-MM-DD' → tengah malam
 * UTC). Menjaga urutan kronologis untuk `firstEffectiveAt`.
 */
function resolveEffectiveAt(t: MigrationTransaction): Date {
  if (t.effectiveAt) return t.effectiveAt
  return jakartaDateToDate(t.paymentDate)
}

/** Konversi JakartaDate 'YYYY-MM-DD' → Date (tengah malam UTC, stabil urut). */
function jakartaDateToDate(d: JakartaDate): Date {
  return new Date(`${d}T00:00:00.000Z`)
}

/**
 * Menghitung waktu efektif terawal per ownerKey dari transaksi historis (basis
 * `firstEffectiveAt` Owner). Owner tanpa transaksi tidak muncul pada peta.
 */
function earliestEffectiveByOwnerKey(
  transactions: MigrationTransaction[],
): Map<string, Date> {
  const map = new Map<string, Date>()
  for (const t of transactions) {
    const at = resolveEffectiveAt(t)
    const current = map.get(t.ownerKey)
    if (!current || at.getTime() < current.getTime()) {
      map.set(t.ownerKey, at)
    }
  }
  return map
}

/**
 * Grand Total (Quantity/Shares/Ceil) dari proyeksi `positions` seluruh Owner
 * terimpor (AD-4). Quantity/Shares/Ceil adalah integer; dijumlahkan lintas
 * Capital Type. Membaca posisi via pintu ledger (in-tx) agar mencerminkan hasil
 * `importHistorical` pada transaksi yang sama.
 */
async function computeGrandTotal(
  tx: Tx,
  ownerIds: Set<Uuid>,
): Promise<MigrationGrandTotal> {
  const positions = await ledger.getPositions(tx)
  const capitalTypes: CapitalType[] = [
    'Modal Tetap',
    'Modal Bergerak',
    'Modal Operasional',
  ]

  let quantity = 0
  let shares = 0
  let ceil = 0
  for (const pos of positions) {
    if (!ownerIds.has(pos.ownerId)) continue
    for (const ct of capitalTypes) {
      quantity += pos.quantityByType[ct]
      shares += pos.sharesByType[ct]
      ceil += pos.ceilByType[ct]
    }
  }

  return { quantity, shares, ceil }
}

// Catatan: Grand Total di atas memakai proyeksi `positions` (via pintu ledger)
// sebagai sumber kebenaran (AD-4). Shares/Ceil per baris migrasi diturunkan di
// dalam `appendAndProject` (shared/domain weighting) saat `importHistorical`,
// sehingga modul migrasi TIDAK perlu mengimpor helper weighting sendiri.
