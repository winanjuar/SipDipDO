// server/domain/orders/orders.service.ts
//
// Orkestrasi domain ORDERS (FR-1/FR-6.3/FR-19). Menegakkan:
//   - previewCalculation : proyeksi MURNI (AD-6) via shared/domain
//                          (gates.evalStrengthGate + weighting) — HASIL SAMA
//                          dengan validasi server saat submit. Tanpa I/O:
//                          menerima posisi + pending kanonik + calon lewat
//                          `PreviewContext` (dibaca pemanggil). Menghitung
//                          max-quantity bila konteks menyediakan harga + ruang.
//   - submitOrder        : SATU transaksi teratas (AD-2). Resolusi Harga Terkunci
//                          (FR-6.3 §1.12), validasi Quantity/Strength/ruang RKAP/
//                          referral (FR-1 §1.1–§1.15). Tolak = TANPA baris pesanan
//                          (audit 'order_rejected' phase 'submit' + hitungan);
//                          Sukses = INSERT pesanan (pending) + audit
//                          'order_submitted' + notifikasi COO (FR-19 §19.8).
//                          TIDAK memerlukan MFA (FR-3 §3.3).
//
// Pintu lintas modul yang dipakai (HANYA via index):
//   pricing.currentPrice  — resolusi Harga Terkunci pada tanggal submit (AD-7).
//   identity.getLifecycle/perluReferral/pilihanReferral — referral Pembelian Pertama.
//   ledger.getOwnerPosition/isFirstEffective — posisi terkini & deteksi pertama.
//   rkap.spaceByCapitalType/getPhaseView — ruang & fase aktif untuk gerbang RKAP.
//   audit.write — jejak submit/penolakan in-tx (AD-3).

import { withTransaction } from '../../utils/db'
import type { Tx } from '../../utils/db'
import {
  ceilFor as sharedCeilFor,
  rtl as sharedRtl,
  shares as sharedShares,
} from '../../../shared/domain/weighting'
import { evalStrengthGate } from '../../../shared/domain/gates'
import { maxQuantityRkap } from '../../../shared/domain/rkap-limits'
import { Decimal, toMoney } from '../../../shared/domain/decimal'
import { CAPITAL_RULES } from '../../../shared/domain/types'
import type {
  CapitalType,
  JakartaDate,
  MoneyString,
  OrderStatus,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'
import { isExpiredDay7, toJakartaDate } from '../../../shared/domain/calendar'
import { pricing } from '../pricing'
import { identity } from '../identity'
import { ledger } from '../ledger'
import { rkap } from '../rkap'
import { audit } from '../audit'
import * as repo from './orders.repo'
import { enqueueCooNotifyHook } from './coo-notify.hook'
import type { BuyOrder, OrderPreview } from './orders.model'
import { OrdersError } from './events'
import type {
  OrderPreviewInput,
  PreviewContext,
  QueueRow,
  SubmitCheck,
  SubmitOrderInput,
  SubmitRejection,
} from './events'

// ---------------------------------------------------------------------------
// previewCalculation — proyeksi MURNI (AD-6)
// ---------------------------------------------------------------------------

/**
 * Pratinjau perhitungan calon pesanan (FR-1) — fungsi MURNI (tanpa I/O). Memakai
 * `shared/domain` identik dengan validasi server (AD-6): gerbang Strength
 * (posisi terkini + seluruh pesanan pending kanonik owner + calon) via
 * `evalStrengthGate`, dan RTL turunan proyeksi via `weighting.rtl`.
 *
 * `maxQuantity` dihitung bila konteks menyediakan info yang cukup:
 *  - Modal Tetap/Bergerak : `maxQuantityRkap(sisaRuang, harga, sisaBatasPenyesuaian)`
 *    bila `runningPrice` + `rkapSpace` tersedia (FR-1 §1.10/§1.11, FR-23).
 *  - Modal Operasional    : dibatasi hanya oleh Strength (§1.6) — max = Quantity
 *    terbesar yang menjaga proyeksi Strength ≤ 100% (dicari dari RTL proyeksi
 *    tanpa calon). Bila tak dapat dihitung → `null`.
 *
 * `minQuantity` = 1 bila ada informasi rentang; else `null`.
 */
export function previewCalculation(
  input: OrderPreviewInput,
  ctx: PreviewContext,
): OrderPreview {
  const gate = evalStrengthGate({
    posisiTerkini: ctx.posisiTerkini,
    pesananPendingKanonik: ctx.pesananPendingKanonik,
    calon: { capitalType: input.capitalType, quantity: input.quantity },
  })

  const proyeksiRtl = sharedRtl(gate.proyeksiCeil, gate.proyeksiShares)

  const maxQuantity = computeMaxQuantity(input.capitalType, ctx)

  return {
    proyeksiStrength: gate.proyeksiStrength as RatioString,
    proyeksiCeil: gate.proyeksiCeil,
    proyeksiShares: gate.proyeksiShares,
    proyeksiRtl,
    ok: gate.ok,
    minQuantity: maxQuantity === null ? null : 1,
    maxQuantity,
  }
}

/**
 * Menghitung Quantity maksimal calon (murni) berdasar konteks pratinjau.
 * Mengembalikan `null` bila informasi tidak cukup (mis. tanpa harga berjalan
 * untuk RKAP). Dipakai `previewCalculation` dan disajikan ulang saat submit
 * ditolak (§1.15).
 *
 * - Modal Tetap/Bergerak : `maxQuantityRkap` dari sisa ruang RKAP jenis modal.
 * - Modal Operasional    : batas Strength — Quantity terbesar `q` sehingga
 *   Strength(posisi + pending + q) ≤ 1. Ekuivalen sisa kapasitas Ceil−Shares
 *   dibagi selisih bobot/plafon per unit calon. Dihitung eksak dari agregat
 *   tanpa-calon (posisi + pending).
 */
function computeMaxQuantity(
  capitalType: CapitalType,
  ctx: PreviewContext,
): number | null {
  if (CAPITAL_RULES[capitalType].inRkap) {
    if (ctx.runningPrice === undefined || ctx.rkapSpace === undefined) {
      return null
    }
    return maxQuantityRkap(
      ctx.rkapSpace,
      ctx.runningPrice,
      ctx.sisaBatasPenyesuaian ?? toMoney(0),
    )
  }
  // Modal Operasional: dibatasi hanya Strength (§1.6).
  return maxQuantityByStrength(capitalType, ctx)
}

/**
 * Quantity maksimal calon yang menjaga proyeksi Strength ≤ 100% (§1.2/§1.6).
 *
 * Basis TANPA calon: totalShares0 / totalCeil0 = posisi terkini + seluruh
 * pesanan pending kanonik. Menambah `q` unit calon menambah `q·bobot` Shares dan
 * `q·plafon` Ceil. Syarat: (S0 + q·bobot) ≤ (C0 + q·plafon), yakni
 *   q ≤ (C0 − S0) ÷ (bobot − plafon) bila bobot > plafon.
 * Bila bobot ≤ plafon, menambah calon tak pernah menaikkan Strength di atas 1
 * (selama basis ≤ 1) → tak ada batas Strength (kembalikan `null`).
 */
function maxQuantityByStrength(
  capitalType: CapitalType,
  ctx: PreviewContext,
): number | null {
  let shares0 = ctx.posisiTerkini.totalShares
  let ceil0 = ctx.posisiTerkini.totalCeil
  for (const p of ctx.pesananPendingKanonik) {
    shares0 += sharedShares(p.capitalType, p.quantity)
    ceil0 += sharedCeilFor(p.capitalType, p.quantity)
  }

  const bobot = CAPITAL_RULES[capitalType].bobot
  const plafon = CAPITAL_RULES[capitalType].plafon

  // Basis sudah melewati 100% (tanpa calon) → tak ada ruang untuk calon.
  if (shares0 > ceil0) return 0

  // Menambah calon tak menaikkan Strength (bobot ≤ plafon) → tanpa batas Strength.
  if (bobot <= plafon) return null

  const capacity = ceil0 - shares0
  return Math.floor(capacity / (bobot - plafon))
}

// ---------------------------------------------------------------------------
// submitOrder — SATU transaksi teratas (AD-2)
// ---------------------------------------------------------------------------

/**
 * Submit Pesanan Pembelian (FR-1 §1.1–§1.15, §6.3) dalam SATU transaksi atomik
 * (AD-2). TIDAK memerlukan MFA (FR-3 §3.3). Urutan:
 *
 *  1. Resolusi Harga Terkunci pada tanggal submit via
 *     `pricing.currentPrice('beli', submitDate, tx)` → simpan sebagai nilai +
 *     ref (FR-6.3 §1.12). Melempar PricingError('PRICE_NOT_FOUND') bila belum
 *     ada harga s.d. tanggal itu.
 *  2. Validasi Quantity: integer, ≥ 1, ≤ max-quantity (RKAP untuk Modal Tetap/
 *     Bergerak; Strength untuk Modal Operasional). Tolak dengan rentang (§1.15).
 *  3. Gerbang Strength (FR-1): posisi terkini + seluruh pesanan pending kanonik
 *     owner + calon harus ≤ 100% (§1.2/§1.4/§1.7).
 *  4. Ruang RKAP (Modal Tetap/Bergerak): masih ada ruang menampung nilai calon
 *     (§1.5). Modal Operasional lolos selama Strength lolos (§1.6).
 *  5. Referral WAJIB & sah bila Pembelian Pertama (owner belum punya ledger
 *     efektif) — `identity.perluReferral` + `pilihanReferral` (FR-22).
 *  6. Penolakan: TIDAK membuat baris pesanan; audit 'order_rejected' (phase
 *     'submit') dengan hitungan; lempar `OrdersError` (Alert Penolakan Terhitung).
 *  7. Sukses: INSERT pesanan (pending kanonik) + audit 'order_submitted' +
 *     notifikasi COO (hook `email_outbox`, FR-19 §19.8) — semuanya in-tx.
 */
export async function submitOrder(input: SubmitOrderInput): Promise<BuyOrder> {
  const submitDate = input.submitDate ?? jakartaToday()

  return withTransaction(async (tx) => {
    // 1. Harga Terkunci pada tanggal submit (FR-6.3 §1.12), in-tx (AD-7).
    //    `pricing.currentPrice` melempar PricingError('PRICE_NOT_FOUND') bila
    //    belum ada harga s.d. tanggal itu — dipetakan route sebagai konflik jelas.
    const price = await pricing.currentPrice('beli', submitDate, tx)
    const lockedPrice = price.price
    const actualAmount = computeActual(lockedPrice, input.quantity)

    const inRkap = CAPITAL_RULES[input.capitalType].inRkap

    // Baca kondisi terkini untuk gerbang.
    const position = await ledger.getOwnerPosition(input.ownerId, tx)
    const posisiTerkini = aggregatePosition(position)
    const pendingKanonik = await repo.findPendingKanonikByOwner(
      tx,
      input.ownerId,
    )

    // Ruang RKAP + fase aktif (Modal Tetap/Bergerak) — dibaca sekali.
    let ruangRkap: Record<CapitalType, MoneyString> | undefined
    let sisaBatasPenyesuaian: MoneyString | undefined
    if (inRkap) {
      // `rkap.getPhaseView()` melempar RkapError('PHASE_NOT_FOUND') bila tak ada
      // fase aktif — dipetakan route sebagai konflik jelas (FR-23).
      const view = await rkap.getPhaseView()
      // Ruang efektif in-tx (transaksi antri tidak mereservasi ruang, §23.2).
      ruangRkap = await rkap.spaceByCapitalType(tx, view.phase.id)
      sisaBatasPenyesuaian = view.limitSummary.remaining
    }

    const failed: SubmitCheck[] = []

    // 2. Validasi Quantity (integer, ≥ 1, ≤ max) — §1.15.
    const maxQuantity = computeMaxQuantity(input.capitalType, {
      posisiTerkini,
      pesananPendingKanonik: pendingKanonik,
      runningPrice: lockedPrice,
      rkapSpace: inRkap ? ruangRkap![input.capitalType] : undefined,
      sisaBatasPenyesuaian,
    })
    const quantityValid =
      Number.isInteger(input.quantity) &&
      input.quantity >= 1 &&
      (maxQuantity === null || input.quantity <= maxQuantity)
    if (!quantityValid) failed.push('quantity')

    // 3. Gerbang Strength (FR-1 §1.2/§1.4/§1.7).
    const gate = evalStrengthGate({
      posisiTerkini,
      pesananPendingKanonik: pendingKanonik,
      calon: { capitalType: input.capitalType, quantity: input.quantity },
    })
    if (!gate.ok) failed.push('strength')

    // 4. Ruang RKAP (Modal Tetap/Bergerak) — §1.5.
    if (inRkap && ruangRkap) {
      if (!hasRkapSpace(ruangRkap, input.capitalType, actualAmount)) {
        failed.push('rkap_space')
      }
    }

    // 5. Referral WAJIB & sah bila Pembelian Pertama (FR-22).
    const firstEffective = await ledger.isFirstEffective(tx, input.ownerId)
    if (firstEffective) {
      const owner = await identity.getLifecycle(tx, input.ownerId)
      if (identity.perluReferral(owner)) {
        const referralOk = await isValidReferralChoice(
          tx,
          input.referralOwnerId,
        )
        if (!referralOk) failed.push('referral')
      }
    }

    // 6. Penolakan: TIDAK membuat baris pesanan; audit + lempar (Alert Terhitung).
    if (failed.length > 0) {
      const rejection: SubmitRejection = {
        ownerId: input.ownerId,
        failed,
        proyeksiStrength: gate.proyeksiStrength as RatioString,
        proyeksiCeil: gate.proyeksiCeil,
        proyeksiShares: gate.proyeksiShares,
        ruangRkap,
        minQuantity: 1,
        maxQuantity: maxQuantity ?? undefined,
      }

      await audit.write(tx, {
        actor: input.ownerId,
        action: 'order_rejected',
        target: input.ownerId,
        details: {
          phase: 'submit',
          failed,
          proyeksiStrength: rejection.proyeksiStrength,
          proyeksiCeil: rejection.proyeksiCeil,
          proyeksiShares: rejection.proyeksiShares,
          ruangRkap,
          minQuantity: rejection.minQuantity,
          maxQuantity: rejection.maxQuantity,
        },
      })

      throw buildRejectionError(rejection)
    }

    // 7. Sukses: INSERT pesanan (pending) + audit 'order_submitted' + notifikasi COO.
    const order = await repo.insertOrder(tx, {
      ownerId: input.ownerId,
      capitalType: input.capitalType,
      quantity: input.quantity,
      lockedPrice,
      lockedPriceRef: price.id,
      referralOwnerId: input.referralOwnerId ?? null,
    })

    await audit.write(tx, {
      actor: input.ownerId,
      action: 'order_submitted',
      target: order.id,
      details: {
        ownerId: order.ownerId,
        capitalType: order.capitalType,
        quantity: order.quantity,
        lockedPrice: order.lockedPrice,
        actualAmount,
        referralOwnerId: order.referralOwnerId,
      },
    })

    await enqueueCooNotifyHook(tx, {
      orderId: order.id,
      ownerId: order.ownerId,
      capitalType: order.capitalType,
      quantity: order.quantity,
    })

    return order
  })
}

// ---------------------------------------------------------------------------
// Siklus hidup antrian (FR-19) — withdraw / list / expire / lock / set status
// ---------------------------------------------------------------------------

/**
 * Menarik pesanan pembelian milik Owner (FR-19 §19.3, FR-15 §15.4) dalam SATU
 * transaksi atomik (AD-2). CAS: set `withdrawn_at = now()` HANYA bila baris
 * milik `ownerId` DAN masih pending kanonik
 * (`status='menunggu_konfirmasi' AND withdrawn_at IS NULL`). Owner hanya boleh
 * menarik pesanan SENDIRI (§15.4).
 *
 * Bila CAS mempengaruhi 0 baris (bukan pending / bukan milik owner / sudah
 * ditarik) → melempar `OrdersError('NOT_WITHDRAWABLE')`. Sukses menulis audit
 * 'order_withdrawn' in-tx (§12.1/§12.2).
 */
export async function withdrawOrder(
  ownerId: Uuid,
  orderId: Uuid,
): Promise<void> {
  await withTransaction(async (tx) => {
    const won = await repo.casWithdraw(tx, ownerId, orderId)
    if (!won) {
      throw new OrdersError(
        'NOT_WITHDRAWABLE',
        'Pesanan tidak dapat ditarik: bukan pending, bukan milik Anda, atau sudah ditarik (FR-19 §19.3).',
        { ownerId, orderId },
      )
    }

    await audit.write(tx, {
      actor: ownerId,
      action: 'order_withdrawn',
      target: orderId,
      details: { ownerId },
    })
  })
}

/**
 * Daftar antrian pesanan pending KANONIK untuk tampilan COO (FR-19 §19.6),
 * digabung dengan nama/email pemilik, terurut dari terlama. Read-only (di luar
 * transaksi). Akses COO ditegakkan di route.
 */
export async function listQueueForCoo(): Promise<QueueRow[]> {
  return repo.listPendingForCoo(repo.db)
}

/**
 * Daftar seluruh pesanan milik Owner (semua status) — tampilan "Pesanan Saya"
 * (FR-19 §19.7). Read-only. Owner hanya melihat pesanan SENDIRI (§15.4); akses
 * ditegakkan di route.
 */
export async function listMyOrders(ownerId: Uuid): Promise<BuyOrder[]> {
  return repo.listByOwner(repo.db, ownerId)
}

/**
 * Mengunci pesanan pending KANONIK untuk finalisasi (`SELECT … FOR UPDATE`) —
 * LOCK PERTAMA urutan global (AD-2). Modul ORDERS adalah pemilik kanonik
 * penguncian `buy_orders`; jalur konfirmasi (FR-20) memakai pintu ini alih-alih
 * mengunci `buy_orders` langsung. Mengembalikan baris terkunci atau `null` bila
 * bukan pending kanonik (kalah race / ditarik / kedaluwarsa). Dipanggil in-tx.
 */
export async function lockPendingForConfirm(
  tx: Tx,
  orderId: Uuid,
): Promise<BuyOrder | null> {
  return repo.lockPendingForConfirm(tx, orderId)
}

/**
 * Menandai seluruh pesanan pending KANONIK yang sudah melewati hari-7 sebagai
 * kedaluwarsa (FR-19 §19.4), DI DALAM transaksi cron `tx`. Kedaluwarsa dihitung
 * per `calendar.isExpiredDay7(submitJakartaDate, jakartaToday)` dengan
 * `submitJakartaDate = toJakartaDate(submittedAt)` (AD-9). Untuk tiap pesanan
 * yang melewati ambang, CAS status → 'kedaluwarsa' (guard pending kanonik) dan
 * tulis audit 'order_expired'. Mengembalikan daftar id pesanan yang berhasil
 * di-kedaluwarsa-kan.
 *
 * §19.5 (Owner boleh membuat pesanan baru setelah kedaluwarsa) otomatis
 * terpenuhi karena pesanan kedaluwarsa bukan lagi pending kanonik.
 */
export async function expirePendingOrders(
  tx: Tx,
  jakartaToday: JakartaDate,
): Promise<Uuid[]> {
  const pending = await repo.listPendingForExpiry(tx)
  const expired: Uuid[] = []

  for (const p of pending) {
    const submitDate = toJakartaDate(p.submittedAt)
    if (!isExpiredDay7(submitDate, jakartaToday)) continue

    const won = await repo.casSetStatus(tx, p.id, 'kedaluwarsa')
    if (!won) continue // kalah race (ditarik/dikonfirmasi bersamaan) — lewati.

    await audit.write(tx, {
      actor: null, // aktor 'system' (cron).
      action: 'order_expired',
      target: p.id,
      details: { submittedAt: submitDate, jakartaToday },
    })
    expired.push(p.id)
  }

  return expired
}

/**
 * Helper penetapan status akhir via CAS pending kanonik (§19.1/§19.2) DI DALAM
 * transaksi pemanggil. Menulis audit `action` yang sesuai bila menang.
 * Mengembalikan `true` bila tepat baris ini berubah.
 */
async function setStatusWithAudit(
  tx: Tx,
  orderId: Uuid,
  status: OrderStatus,
  action: 'order_confirmed' | 'order_rejected' | 'order_expired',
  actor: Uuid | null,
): Promise<boolean> {
  const won = await repo.casSetStatus(tx, orderId, status)
  if (!won) return false
  await audit.write(tx, {
    actor,
    action,
    target: orderId,
    details: { status },
  })
  return true
}

/**
 * CAS status pesanan → 'ditolak' (guard pending kanonik) + audit 'order_rejected'
 * (§19.1/§12.5). Dipakai jalur finalisasi/konfirmasi. In-tx; `true` bila menang.
 */
export async function setRejected(
  tx: Tx,
  orderId: Uuid,
  actor: Uuid | null,
): Promise<boolean> {
  return setStatusWithAudit(tx, orderId, 'ditolak', 'order_rejected', actor)
}

/**
 * CAS status pesanan → 'terkonfirmasi' (guard pending kanonik) + audit
 * 'order_confirmed' (§19.1). Dipakai jalur finalisasi (FR-20). In-tx; `true`
 * bila menang.
 */
export async function setConfirmed(
  tx: Tx,
  orderId: Uuid,
  actor: Uuid | null,
): Promise<boolean> {
  return setStatusWithAudit(
    tx,
    orderId,
    'terkonfirmasi',
    'order_confirmed',
    actor,
  )
}

/**
 * CAS status pesanan → 'kedaluwarsa' (guard pending kanonik) + audit
 * 'order_expired' (§19.4). Varian satuan dari `expirePendingOrders` untuk jalur
 * non-cron. In-tx; `true` bila menang.
 */
export async function setExpired(
  tx: Tx,
  orderId: Uuid,
  actor: Uuid | null = null,
): Promise<boolean> {
  return setStatusWithAudit(tx, orderId, 'kedaluwarsa', 'order_expired', actor)
}

// ---------------------------------------------------------------------------
// Pembantu murni & lintas-modul
// ---------------------------------------------------------------------------

/**
 * Merakit `OrdersError` dari penolakan terhitung. Kode spesifik bila hanya satu
 * gerbang gagal (agar route memetakan pesan tepat); `SUBMIT_REJECTED` bila
 * gabungan. `details.rejection` membawa hitungan lengkap (Alert Penolakan
 * Terhitung, Error Handling FR-1).
 */
function buildRejectionError(rejection: SubmitRejection): OrdersError {
  const details = { rejection: rejection as unknown as Record<string, unknown> }
  if (rejection.failed.length === 1) {
    switch (rejection.failed[0]) {
      case 'quantity':
        return new OrdersError(
          'INVALID_QUANTITY',
          `Quantity harus bilangan bulat dalam rentang ${rejection.minQuantity ?? 1}..${rejection.maxQuantity ?? '∞'} (FR-1 §1.15).`,
          details,
        )
      case 'strength':
        return new OrdersError(
          'STRENGTH_EXCEEDED',
          'Proyeksi Strength melebihi 100% — pesanan ditolak (FR-1 §1.2).',
          details,
        )
      case 'rkap_space':
        return new OrdersError(
          'RKAP_SPACE_EXCEEDED',
          'Ruang RKAP jenis modal ini tidak mencukupi (FR-1 §1.5).',
          details,
        )
      case 'referral':
        return new OrdersError(
          'REFERRAL_REQUIRED',
          'Pembelian Pertama membutuhkan referral yang sah (FR-22).',
          details,
        )
    }
  }
  return new OrdersError(
    'SUBMIT_REJECTED',
    'Validasi submit gagal: Quantity/Strength/ruang RKAP/referral (FR-1).',
    details,
  )
}

/** Agregat Shares/Ceil gabungan seluruh Capital Type dari proyeksi posisi. */
function aggregatePosition(position: {
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
}): { totalShares: number; totalCeil: number } {
  let totalShares = 0
  let totalCeil = 0
  for (const type of Object.keys(CAPITAL_RULES) as CapitalType[]) {
    totalShares += position.sharesByType[type]
    totalCeil += position.ceilByType[type]
  }
  return { totalShares, totalCeil }
}

/**
 * TRUE bila ruang RKAP `capitalType` calon masih menampung tambahan Fulfillment
 * senilai `tambahan` (= Harga × Quantity). Modal Operasional (non-RKAP) selalu
 * dianggap punya ruang (tidak masuk RKAP). Mirror `hasRkapSpace` di ledger.
 */
function hasRkapSpace(
  ruang: Record<CapitalType, MoneyString>,
  capitalType: CapitalType,
  tambahan: MoneyString,
): boolean {
  if (!CAPITAL_RULES[capitalType].inRkap) return true
  return new Decimal(ruang[capitalType]).gte(new Decimal(tambahan))
}

/**
 * TRUE bila `referralOwnerId` menunjuk pilihan referral yang SAH (pemegang saham
 * / Owner belum pernah beli). Referral WAJIB hadir saat Pembelian Pertama:
 * `null`/tidak sah → FALSE (FR-22). Mirror `isValidReferralChoice` di ledger.
 */
async function isValidReferralChoice(
  tx: Tx,
  referralOwnerId: Uuid | null | undefined,
): Promise<boolean> {
  if (!referralOwnerId) return false
  const choices = await identity.pilihanReferral(tx)
  return choices.some((c) => c.ownerId === referralOwnerId)
}

/** Nilai Actual (dana riil) = Harga × Quantity (AD-7). */
function computeActual(price: MoneyString, quantity: number): MoneyString {
  return toMoney(new Decimal(price).times(quantity))
}

/** Tanggal hari ini zona Asia/Jakarta ('YYYY-MM-DD') — default tanggal submit. */
function jakartaToday(): JakartaDate {
  // Asia/Jakarta = UTC+7 tanpa DST. Ambil tanggal kalender pada offset itu.
  const now = new Date()
  const jakartaMs = now.getTime() + 7 * 60 * 60 * 1000
  return new Date(jakartaMs).toISOString().slice(0, 10) as JakartaDate
}
