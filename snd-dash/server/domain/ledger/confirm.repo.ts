// server/domain/ledger/confirm.repo.ts
//
// Lapisan data SISI-LEDGER minimal untuk jalur finalisasi konfirmasi (FR-20).
//
// Modul ORDERS (task 11) belum dibangun dan akan menjadi pemilik penuh
// `buy_orders`. Untuk menuntaskan jalur finalisasi (FR-20 §20.x, design.md B.4),
// file ini menyediakan pembacaan + transisi status CAS yang DIBUTUHKAN saja:
//   - lockBuyOrderForUpdate : SELECT … FOR UPDATE (LOCK PERTAMA urutan global)
//   - findBuyOrder          : baca satu baris pesanan
//   - casConfirmOrder       : CAS status → 'terkonfirmasi' (guard pending kanonik)
//   - casRejectOrder        : CAS status → 'ditolak' (guard pending kanonik)
//   - findActivePhaseId     : id fase RKAP aktif (LOCK KEDUA urutan global)
//
// Ketika ORDERS tersedia, ganti pembacaan/CAS di sini dengan pintu
// `orders.lockPendingForConfirm/setConfirmed/setRejected` TANPA mengubah
// `confirmOrder` di `ledger.service.ts`.
//
// Konvensi:
//   - Pending KANONIK (AD-2): `status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL`.
//   - CAS memuat predikat kanonik di WHERE → tepat satu penulis menang (AD-2).
//   - Lock diambil mengikuti `GLOBAL_LOCK_ORDER` (buy_orders → rkap_phases → …).

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type {
  CapitalType,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'

const { buyOrders, rkapPhases } = schema

// ---------------------------------------------------------------------------
// Tipe baca lapisan data
// ---------------------------------------------------------------------------

/**
 * Baris `buy_orders` yang relevan bagi finalisasi konfirmasi (FR-20).
 * Harga final memakai `lockedPrice`/`lockedPriceRef` (AD-7/§20.6).
 */
export interface BuyOrderRow {
  id: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  lockedPrice: MoneyString
  lockedPriceRef: Uuid
  referralOwnerId: Uuid | null
  status: (typeof buyOrders.$inferSelect)['status']
  withdrawnAt: Date | null
  submittedAt: Date
}

function toBuyOrderRow(r: typeof buyOrders.$inferSelect): BuyOrderRow {
  return {
    id: r.id as Uuid,
    ownerId: r.ownerId as Uuid,
    capitalType: r.capitalType,
    quantity: r.quantity,
    lockedPrice: r.lockedPrice as MoneyString,
    lockedPriceRef: r.lockedPriceRef as Uuid,
    referralOwnerId: (r.referralOwnerId as Uuid | null) ?? null,
    status: r.status,
    withdrawnAt: r.withdrawnAt ?? null,
    submittedAt: r.submittedAt,
  }
}

/** Predikat pending KANONIK (AD-2) sebagai fragmen SQL yang dapat dipakai ulang. */
function pendingKanonik(orderId: Uuid) {
  return and(
    eq(buyOrders.id, orderId),
    eq(buyOrders.status, 'menunggu_konfirmasi'),
    isNull(buyOrders.withdrawnAt),
  )
}

// ---------------------------------------------------------------------------
// Lock urutan global (AD-2) — buy_orders (pertama), rkap_phases (kedua)
// ---------------------------------------------------------------------------

/**
 * Mengunci baris pesanan (`SELECT … FOR UPDATE`) — LOCK PERTAMA pada urutan
 * global `GLOBAL_LOCK_ORDER` (buy_orders → …). Mengembalikan baris terkunci
 * apa pun statusnya (validasi pending kanonik dilakukan pemanggil), atau `null`
 * bila id tak ada. Dipanggil DI DALAM transaksi finalisasi (AD-2).
 */
export async function lockBuyOrderForUpdate(
  tx: Tx,
  orderId: Uuid,
): Promise<BuyOrderRow | null> {
  const rows = await tx
    .select()
    .from(buyOrders)
    .where(eq(buyOrders.id, orderId))
    .limit(1)
    .for('update')

  const row = rows[0]
  return row ? toBuyOrderRow(row) : null
}

/**
 * Ringkasan pesanan pending KANONIK milik seorang owner untuk perakitan input
 * gerbang Strength (FR-1/§20.5): hanya `capitalType` + `quantity`.
 */
export interface PendingOrderBrief {
  capitalType: CapitalType
  quantity: number
}

/**
 * Seluruh pesanan pending KANONIK milik `ownerId` KECUALI `excludeOrderId`
 * (pesanan yang sedang dikonfirmasi). Predikat pending kanonik (AD-2):
 * `status='menunggu_konfirmasi' AND withdrawn_at IS NULL` (Property 12).
 *
 * Dipakai re-validasi Strength agar proyeksi Strength gabungan memperhitungkan
 * seluruh pesanan antri LAIN + calon (§20.5). Dipanggil in-tx setelah lock.
 */
export async function findOtherPendingKanonik(
  tx: Tx,
  ownerId: Uuid,
  excludeOrderId: Uuid,
): Promise<PendingOrderBrief[]> {
  const rows = await tx
    .select({
      capitalType: buyOrders.capitalType,
      quantity: buyOrders.quantity,
    })
    .from(buyOrders)
    .where(
      and(
        eq(buyOrders.ownerId, ownerId),
        eq(buyOrders.status, 'menunggu_konfirmasi'),
        isNull(buyOrders.withdrawnAt),
        sql`${buyOrders.id} <> ${excludeOrderId}`,
      ),
    )

  return rows.map((r) => ({ capitalType: r.capitalType, quantity: r.quantity }))
}

/**
 * Seluruh pesanan pending KANONIK milik `ownerId` (tanpa pengecualian) —
 * `status='menunggu_konfirmasi' AND withdrawn_at IS NULL` (AD-2, Property 12).
 *
 * Dipakai jalur INPUT LANGSUNG (FR-21 §21.1) untuk merakit input gerbang
 * Strength persis seperti FR-1: proyeksi Strength gabungan memperhitungkan
 * SELURUH pesanan antri Owner + calon input langsung (tanpa `buy_order` sendiri
 * untuk dikecualikan). Dipanggil in-tx.
 */
export async function findPendingKanonikByOwner(
  tx: Tx,
  ownerId: Uuid,
): Promise<PendingOrderBrief[]> {
  const rows = await tx
    .select({
      capitalType: buyOrders.capitalType,
      quantity: buyOrders.quantity,
    })
    .from(buyOrders)
    .where(
      and(
        eq(buyOrders.ownerId, ownerId),
        eq(buyOrders.status, 'menunggu_konfirmasi'),
        isNull(buyOrders.withdrawnAt),
      ),
    )

  return rows.map((r) => ({ capitalType: r.capitalType, quantity: r.quantity }))
}

/** Membaca satu baris pesanan tanpa lock (pembacaan biasa). */
export async function findBuyOrder(
  tx: Tx,
  orderId: Uuid,
): Promise<BuyOrderRow | null> {
  const rows = await tx
    .select()
    .from(buyOrders)
    .where(eq(buyOrders.id, orderId))
    .limit(1)

  const row = rows[0]
  return row ? toBuyOrderRow(row) : null
}

/**
 * Id fase RKAP aktif terbaru, DENGAN lock (`FOR UPDATE`) — LOCK KEDUA pada
 * urutan global (rkap_phases). Mengembalikan `null` bila tidak ada fase aktif.
 * Mengunci baris fase agar re-validasi ruang RKAP + plotting berjalan atomik
 * terhadap fase yang sama (AD-2).
 */
export async function findActivePhaseId(tx: Tx): Promise<Uuid | null> {
  const rows = await tx
    .select({ id: rkapPhases.id })
    .from(rkapPhases)
    .where(eq(rkapPhases.isActive, true))
    .orderBy(desc(rkapPhases.createdAt))
    .limit(1)
    .for('update')

  const row = rows[0]
  return row ? (row.id as Uuid) : null
}

// ---------------------------------------------------------------------------
// Transisi status CAS (AD-2) — guard pending KANONIK
// ---------------------------------------------------------------------------

/**
 * CAS status pesanan → 'terkonfirmasi' HANYA bila masih pending kanonik
 * (`status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL`). Mengembalikan
 * `true` bila tepat baris ini yang berubah (penulis menang), `false` bila
 * kalah race / sudah ditarik / kedaluwarsa (AD-2, Property 13).
 */
export async function casConfirmOrder(
  tx: Tx,
  orderId: Uuid,
): Promise<boolean> {
  const rows = await tx
    .update(buyOrders)
    .set({ status: 'terkonfirmasi' })
    .where(pendingKanonik(orderId))
    .returning({ id: buyOrders.id })

  return rows.length === 1
}

/**
 * CAS status pesanan → 'ditolak' HANYA bila masih pending kanonik. Dipakai saat
 * re-validasi gerbang gagal (FR-20 §20.5). Mengembalikan `true` bila menang.
 *
 * CATATAN PERSISTENSI (FR-20): status penolakan HARUS bertahan meskipun jalur
 * konfirmasi melempar. Karena append ledger & OTP belum dijalankan saat titik
 * ini (re-validasi dulu, OTP belakangan — §20.2/§20.5), tidak ada yang perlu
 * di-rollback; pemanggil menulis status + audit LALU commit transaksi penolakan
 * TERPISAH sebelum melempar `REVALIDATION_FAILED` (lihat `ledger.service.ts`).
 * `reason` disimpan? `buy_orders` tak punya kolom alasan → alasan/hitungan
 * lengkap dicatat di audit (`order_rejected`, §12.5), bukan pada baris pesanan.
 */
export async function casRejectOrder(
  tx: Tx,
  orderId: Uuid,
): Promise<boolean> {
  const rows = await tx
    .update(buyOrders)
    .set({ status: 'ditolak' })
    .where(pendingKanonik(orderId))
    .returning({ id: buyOrders.id })

  return rows.length === 1
}

// Ekspor tipe status pesanan agar service dapat menganotasi tanpa menyentuh
// schema langsung.
export type OrderStatus = BuyOrderRow['status']
