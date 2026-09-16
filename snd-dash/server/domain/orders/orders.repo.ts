// server/domain/orders/orders.repo.ts
//
// Lapisan data domain ORDERS (FR-1/FR-18). Menerjemahkan tulis/baca `buy_orders`
// ke query Drizzle. Modul ORDERS adalah PEMILIK penuh tabel ini (submit/queue/
// siklus hidup). Tanpa aturan bisnis — orkestrasi (resolusi harga, gerbang
// Strength/RKAP, audit, notifikasi) ada di `orders.service.ts`.
//
// Tabel (schema.ts):
//   buy_orders : id, ownerId, capitalType, quantity (int), lockedPrice numeric(18,2),
//                lockedPriceRef (uuid → price_periods), referralOwnerId (uuid?),
//                status (order_status), withdrawnAt (timestamptz?), submittedAt (timestamptz)
//
// Predikat pending KANONIK (AD-2), konsisten dengan `confirm.repo.ts` di ledger:
//   status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL.
//
// Konvensi uang (AD-10): kolom numeric dibaca/ditulis sebagai string berskala
// tetap; JANGAN `Number()`/`parseFloat()`.

import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type {
  CapitalType,
  MoneyString,
  OrderStatus,
  Uuid,
} from '../../../shared/domain/types'
import type { BuyOrder } from './orders.model'
import type { QueueRow } from './events'

const { buyOrders, owners } = schema

// ---------------------------------------------------------------------------
// Tipe baca/tulis lapisan data
// ---------------------------------------------------------------------------

/** Nilai INSERT satu baris `buy_orders` (submit — status default pending). */
export interface InsertBuyOrder {
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  /** Harga Terkunci sebagai nilai (AD-7/§1.12). */
  lockedPrice: MoneyString
  lockedPriceRef: Uuid
  referralOwnerId?: Uuid | null
}

/** Ringkasan pesanan pending KANONIK milik owner (perakitan gerbang Strength). */
export interface PendingOrderBrief {
  capitalType: CapitalType
  quantity: number
}

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Pemeta baris → tipe domain
// ---------------------------------------------------------------------------

function toBuyOrder(r: typeof buyOrders.$inferSelect): BuyOrder {
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

// ---------------------------------------------------------------------------
// Tulis — submit (INSERT)
// ---------------------------------------------------------------------------

/**
 * Menyisipkan satu baris pesanan pembelian DI DALAM transaksi `tx` (submit).
 * Status default `menunggu_konfirmasi` & `withdrawnAt` NULL (pending kanonik),
 * `submittedAt` default `now()` (schema). Harga Terkunci disimpan sebagai nilai
 * (AD-7/§1.12).
 */
export async function insertOrder(
  tx: Tx,
  values: InsertBuyOrder,
): Promise<BuyOrder> {
  const [row] = await tx
    .insert(buyOrders)
    .values({
      ownerId: values.ownerId,
      capitalType: values.capitalType,
      quantity: values.quantity,
      lockedPrice: values.lockedPrice,
      lockedPriceRef: values.lockedPriceRef,
      referralOwnerId: values.referralOwnerId ?? null,
    })
    .returning()

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return toBuyOrder(row!)
}

// ---------------------------------------------------------------------------
// Baca — pending kanonik / milik owner / by id
// ---------------------------------------------------------------------------

/**
 * Seluruh pesanan pending KANONIK milik `ownerId` —
 * `status='menunggu_konfirmasi' AND withdrawn_at IS NULL` (AD-2, Property 12).
 *
 * Dipakai perakitan input gerbang Strength saat submit (FR-1): proyeksi Strength
 * gabungan memperhitungkan SELURUH pesanan antri Owner + calon. Hanya
 * `capitalType` + `quantity` yang dibaca. Menerima `Tx` (in-tx) maupun `db`.
 */
export async function findPendingKanonikByOwner(
  reader: Reader,
  ownerId: Uuid,
): Promise<PendingOrderBrief[]> {
  const rows = await reader
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

/**
 * Seluruh pesanan milik `ownerId`, terurut dari terbaru (`submittedAt` desc).
 * Dipakai daftar "Pesanan Saya" (FR-18 §18.x). Menerima `Tx` maupun `db`.
 */
export async function listByOwner(
  reader: Reader,
  ownerId: Uuid,
): Promise<BuyOrder[]> {
  const rows = await reader
    .select()
    .from(buyOrders)
    .where(eq(buyOrders.ownerId, ownerId))
    .orderBy(desc(buyOrders.submittedAt))

  return rows.map(toBuyOrder)
}

/**
 * Membaca satu baris pesanan berdasar `id` (pembacaan biasa, tanpa lock).
 * Mengembalikan `null` bila tak ada. Menerima `Tx` maupun `db`.
 */
export async function findById(
  reader: Reader,
  orderId: Uuid,
): Promise<BuyOrder | null> {
  const rows = await reader
    .select()
    .from(buyOrders)
    .where(eq(buyOrders.id, orderId))
    .limit(1)

  const row = rows[0]
  return row ? toBuyOrder(row) : null
}

// ---------------------------------------------------------------------------
// Predikat pending KANONIK (AD-2) — fragmen WHERE dipakai ulang oleh CAS/lock
// ---------------------------------------------------------------------------

/**
 * Fragmen WHERE pending KANONIK untuk satu pesanan (AD-2), konsisten dengan
 * `confirm.repo.ts`: `id=? AND status='menunggu_konfirmasi' AND withdrawn_at IS NULL`.
 * Dipakai seluruh CAS/lock agar tepat satu penulis menang.
 */
function pendingKanonik(orderId: Uuid) {
  return and(
    eq(buyOrders.id, orderId),
    eq(buyOrders.status, 'menunggu_konfirmasi'),
    isNull(buyOrders.withdrawnAt),
  )
}

// ---------------------------------------------------------------------------
// Lock urutan global (AD-2) — buy_orders (LOCK PERTAMA)
// ---------------------------------------------------------------------------

/**
 * Mengunci pesanan pending KANONIK (`SELECT … FOR UPDATE`) sebagai LOCK PERTAMA
 * pada urutan global (buy_orders → …). Berbeda dengan `lockBuyOrderForUpdate`
 * sisi-ledger yang mengembalikan baris apa pun statusnya, helper KANONIK ini
 * langsung menyaring pending kanonik di WHERE sehingga baris yang sudah ditarik/
 * dikonfirmasi/kedaluwarsa tidak dikunci — mengembalikan `null` dalam kasus itu
 * (kalah race / bukan pending). Modul ORDERS adalah pemilik kanonik penguncian
 * `buy_orders`; jalur finalisasi akan memakai pintu ini. Dipanggil in-tx (AD-2).
 */
export async function lockPendingForConfirm(
  tx: Tx,
  orderId: Uuid,
): Promise<BuyOrder | null> {
  const rows = await tx
    .select()
    .from(buyOrders)
    .where(pendingKanonik(orderId))
    .limit(1)
    .for('update')

  const row = rows[0]
  return row ? toBuyOrder(row) : null
}

// ---------------------------------------------------------------------------
// Baca — antrian COO (join owners)
// ---------------------------------------------------------------------------

/**
 * Seluruh pesanan pending KANONIK untuk tampilan COO (FR-19 §19.6), digabung
 * dengan nama/email pemilik (`owners`). Terurut dari terlama (`submittedAt` asc)
 * mengikuti urutan antrian. Akses COO ditegakkan di route. Menerima `Tx` maupun
 * `db`.
 */
export async function listPendingForCoo(reader: Reader): Promise<QueueRow[]> {
  const rows = await reader
    .select({
      orderId: buyOrders.id,
      ownerId: buyOrders.ownerId,
      ownerName: owners.name,
      ownerEmail: owners.email,
      capitalType: buyOrders.capitalType,
      quantity: buyOrders.quantity,
      lockedPrice: buyOrders.lockedPrice,
      submittedAt: buyOrders.submittedAt,
    })
    .from(buyOrders)
    .innerJoin(owners, eq(buyOrders.ownerId, owners.id))
    .where(
      and(
        eq(buyOrders.status, 'menunggu_konfirmasi'),
        isNull(buyOrders.withdrawnAt),
      ),
    )
    .orderBy(asc(buyOrders.submittedAt))

  return rows.map((r) => ({
    orderId: r.orderId as Uuid,
    ownerId: r.ownerId as Uuid,
    ownerName: r.ownerName ?? null,
    ownerEmail: r.ownerEmail,
    capitalType: r.capitalType,
    quantity: r.quantity,
    lockedPrice: r.lockedPrice as MoneyString,
    submittedAt: r.submittedAt,
  }))
}

// ---------------------------------------------------------------------------
// Tulis — CAS siklus hidup (guard pending KANONIK, AD-2)
// ---------------------------------------------------------------------------

/**
 * CAS penarikan pesanan (§19.3): set `withdrawn_at = now()` HANYA bila baris
 * milik `ownerId` DAN masih pending kanonik (owner hanya boleh menarik pesanan
 * SENDIRI, FR-15 §15.4). Mengembalikan `true` bila tepat baris ini berubah
 * (penulis menang), `false` bila 0 baris terpengaruh (bukan pending / bukan
 * milik owner / sudah ditarik). Dipanggil in-tx.
 */
export async function casWithdraw(
  tx: Tx,
  ownerId: Uuid,
  orderId: Uuid,
): Promise<boolean> {
  const rows = await tx
    .update(buyOrders)
    .set({ withdrawnAt: new Date() })
    .where(and(eq(buyOrders.ownerId, ownerId), pendingKanonik(orderId)))
    .returning({ id: buyOrders.id })

  return rows.length === 1
}

/**
 * CAS penetapan status akhir pesanan (`rejected`/`confirmed`/`expired`) HANYA
 * bila masih pending kanonik (AD-2, §19.1/§19.2). Mengembalikan `true` bila
 * menang. Dasar helper `setRejected`/`setConfirmed`/`setExpired`. Dipanggil in-tx.
 */
export async function casSetStatus(
  tx: Tx,
  orderId: Uuid,
  status: OrderStatus,
): Promise<boolean> {
  const rows = await tx
    .update(buyOrders)
    .set({ status })
    .where(pendingKanonik(orderId))
    .returning({ id: buyOrders.id })

  return rows.length === 1
}

/**
 * Membaca ringkasan pesanan pending KANONIK (id + tanggal submit) untuk jalur
 * cron kedaluwarsa (§19.4). `submittedAt` dipakai menghitung kedaluwarsa hari-7
 * via `calendar.isExpiredDay7`. Menerima `Tx` maupun `db`.
 */
export async function listPendingForExpiry(
  reader: Reader,
): Promise<Array<{ id: Uuid; submittedAt: Date }>> {
  const rows = await reader
    .select({ id: buyOrders.id, submittedAt: buyOrders.submittedAt })
    .from(buyOrders)
    .where(
      and(
        eq(buyOrders.status, 'menunggu_konfirmasi'),
        isNull(buyOrders.withdrawnAt),
      ),
    )

  return rows.map((r) => ({ id: r.id as Uuid, submittedAt: r.submittedAt }))
}

// Instance `db` bound-schema di-reexport agar service dapat membaca di luar
// transaksi (view/daftar) tanpa mengimpor db lagi.
export { db }
