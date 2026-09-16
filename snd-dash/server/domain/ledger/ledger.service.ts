// server/domain/ledger/ledger.service.ts
//
// Orkestrasi domain ledger (AD-1/AD-4). Menegakkan:
//   - appendAndProject : primitive tulis internal — INSERT baris ledger DAN
//                        update proyeksi `positions` dalam SATU transaksi (AD-1/AD-4).
//                        Shares/Ceil dihitung via shared/domain weighting bila
//                        tidak disuplai. Dipakai confirmOrder/directEntry/
//                        importHistorical (tasks 10.3/10.4/16).
//   - getPositions / getOwnerPosition : baca proyeksi (rakit Record by-type, AD-4).
//   - isFirstEffective : true bila owner belum punya transaksi ledger efektif
//                        (deteksi Pembelian Pertama, FR-1).
//   - cutPointSnapshot : pembacaan MURNI — snapshot imutabel state ledger pada
//                        titik potong (basis Bukti Transaksi FR-11 & distribusi FR-16).
//   - recomputeFromLedger : rekonsiliasi — bandingkan proyeksi vs rekomputasi
//                        penuh dari ledger; laporkan mismatch. BUKAN jalur tulis (AD-4).
//
// Konvensi transaksi (AD-2): `appendAndProject` menerima `tx` (dipanggil DI DALAM
// transaksi finalisasi teratas), TIDAK membuka transaksi sendiri. Pembacaan
// (getPositions/getOwnerPosition/isFirstEffective) menerima `tx` opsional;
// tanpa `tx` memakai `db` bound-schema.

import { withTransaction } from '../../utils/db'
import type { Tx } from '../../utils/db'
import {
  ceilFor as sharedCeilFor,
  shares as sharedShares,
  strength as sharedStrength,
} from '../../../shared/domain/weighting'
import { evalStrengthGate } from '../../../shared/domain/gates'
import { Decimal, toMoney } from '../../../shared/domain/decimal'
import { CAPITAL_RULES } from '../../../shared/domain/types'
import type { CapitalType, MoneyString, Uuid } from '../../../shared/domain/types'
import { identity } from '../identity'
import { rkap } from '../rkap'
import { pricing } from '../pricing'
import { audit } from '../audit'
import * as repo from './ledger.repo'
import * as confirmRepo from './confirm.repo'
import type { PositionRow } from './ledger.repo'
import { enqueueProofHook } from './proof.hook'
import type { AppendInput, LedgerTransaction, Position } from './ledger.model'
import { LedgerError } from './events'
import type {
  CompensationInput,
  ConfirmOrderInput,
  ConfirmRejection,
  DirectEntryInput,
  DirectEntryRejection,
  LedgerSnapshot,
  LedgerSnapshotOwner,
  MigrationRow,
  ReconMismatch,
  ReconReport,
  RevalidationCheck,
} from './events'

const CAPITAL_TYPES = Object.keys(CAPITAL_RULES) as CapitalType[]

// ---------------------------------------------------------------------------
// appendAndProject — primitive tulis internal (AD-1/AD-4)
// ---------------------------------------------------------------------------

/**
 * Menyisipkan satu baris ledger DAN memproyeksikan deltanya ke `positions`
 * dalam transaksi `tx` yang SAMA (AD-1/AD-4). Ini adalah SATU-SATUNYA jalur
 * tulis posisi; dipakai oleh confirmOrder (FR-20), directEntry (FR-21),
 * compensationEntry (AD-1), dan importHistorical (FR-14).
 *
 * Shares/Ceil dihitung dari `capitalType × quantity` via shared/domain
 * weighting bila tidak disuplai (`input.shares`/`input.ceil`). Untuk entry
 * kompensasi, pemanggil dapat menyuplai nilai negatif eksplisit.
 *
 * Karena proyeksi di-update in-tx, jalur ini WAJIB dipanggil di dalam transaksi
 * teratas yang telah mengambil lock `positions` sesuai `GLOBAL_LOCK_ORDER`.
 */
export async function appendAndProject(
  tx: Tx,
  input: AppendInput,
): Promise<LedgerTransaction> {
  const shares =
    input.shares ?? sharedShares(input.capitalType, input.quantity)
  const ceil = input.ceil ?? sharedCeilFor(input.capitalType, input.quantity)

  // 1) Append baris ledger (append-only, AD-1).
  const ledgerTx = await repo.insertLedgerRow(tx, {
    ownerId: input.ownerId,
    capitalType: input.capitalType,
    quantity: input.quantity,
    shares,
    ceil,
    finalPrice: input.finalPrice,
    finalPriceRef: input.finalPriceRef,
    actualAmount: input.actualAmount,
    buyOrderId: input.buyOrderId ?? null,
    capitalItemId: input.capitalItemId ?? null,
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    compensationOfId: input.compensationOfId ?? null,
    actor: input.actor ?? 'user',
    effectiveAt: input.effectiveAt,
  })

  // 2) Proyeksikan delta ke `positions` dalam tx yang sama (AD-4).
  await repo.upsertPosition(tx, input.ownerId, input.capitalType, {
    quantity: input.quantity,
    shares,
    ceil,
    actualAmount: input.actualAmount,
  })

  return ledgerTx
}

// ---------------------------------------------------------------------------
// importHistorical — impor transaksi historis (FR-14) — MENTAH, TANPA gerbang
// ---------------------------------------------------------------------------

/**
 * Mengimpor sekumpulan transaksi historis (FR-14 §14.1) sebagai baris ledger
 * efektif append-only (AD-1) di dalam transaksi `tx` yang diberikan. Setiap
 * baris ditulis via `appendAndProject` (primitive tulis bersama) sehingga
 * proyeksi `positions` ter-update in-tx (AD-4).
 *
 * Ini adalah import MENTAH: TIDAK ada re-validasi gerbang (Strength/ruang RKAP/
 * referral) dan TIDAK ada penyesuaian instant overshoot — berbeda dari
 * `confirmOrder`/`directEntry`. Aktor selalu 'system'; `paymentMethod` default
 * 'migrasi' bila tak diketahui. Harga/dana di-snapshot apa adanya (AD-7);
 * Shares/Ceil diturunkan dari `capitalType × quantity` via shared/domain
 * weighting.
 *
 * Dipanggil DI DALAM transaksi migrasi teratas (`MigrationModule.run`); TIDAK
 * membuka transaksi sendiri.
 */
export async function importHistorical(
  tx: Tx,
  rows: MigrationRow[],
): Promise<void> {
  for (const row of rows) {
    await appendAndProject(tx, {
      ownerId: row.ownerId,
      capitalType: row.capitalType,
      quantity: row.quantity,
      finalPrice: row.finalPrice,
      finalPriceRef: row.finalPriceRef,
      actualAmount: row.actualAmount,
      buyOrderId: null,
      capitalItemId: row.capitalItemId ?? null,
      paymentDate: row.paymentDate,
      paymentMethod: row.paymentMethod ?? 'migrasi',
      actor: 'system',
      effectiveAt: row.effectiveAt,
    })
  }
}

// ---------------------------------------------------------------------------
// confirmOrder — finalisasi konfirmasi (FR-20, AD-2) — SATU transaksi atomik
// ---------------------------------------------------------------------------

/**
 * Finalisasi konfirmasi Pesanan Pembelian (FR-20) dalam SATU transaksi DB
 * atomik (AD-2). Urutan & aturan mengikuti design.md B.4:
 *
 *  1. Otoritas COO in-tx (AD-8) — `identity.assertCooAt`.
 *  2. Ambil lock urutan global (`GLOBAL_LOCK_ORDER`): buy_orders (pesanan) →
 *     rkap_phases (fase aktif) → positions/owners (via re-validasi & append).
 *  3. Re-validasi TERKINI (§20.5): gerbang Strength (posisi + pending kanonik
 *     lain + calon), ruang RKAP (Modal Tetap/Bergerak), keabsahan referral
 *     (saat Pembelian Pertama). BILA GAGAL → CAS pesanan 'ditolak' + audit
 *     'order_rejected' dengan HITUNGAN, commit (persist), lalu lempar
 *     `REVALIDATION_FAILED`. OTP TIDAK dikonsumsi (§20.2/§20.5).
 *  4. HANYA setelah re-validasi lolos: verifikasi & konsumsi OTP in-tx (AD-8);
 *     MFA gagal → transaksi rollback (tidak efektif), OTP tetap sesuai aturan
 *     modul identity.
 *  5. Append ledger (satu-satunya penulis posisi) memakai Harga Terkunci sebagai
 *     harga final (AD-7/§20.6) + proyeksi `positions` in-tx (AD-1/AD-4).
 *  6. CAS pesanan → 'terkonfirmasi' (guard pending kanonik, AD-2).
 *  7. Plotting alokasi Capital Item (FIFO default) + penyesuaian instant
 *     overshoot untuk Modal Tetap/Bergerak (§20.7, FR-23 §23.9/§23.11/§23.12).
 *  8. Event Pembelian Pertama → `identity.markFirstPurchaseEffective` (AD-11).
 *  9. Enqueue Bukti (hook, AD-5) + audit 'order_confirmed' (AD-3) — in-tx.
 *
 * Postcondition sukses: tepat satu baris ledger, `positions` konsisten, pesanan
 * 'terkonfirmasi', plotting+overshoot tercatat, audit+outbox tertulis.
 */
export async function confirmOrder(
  input: ConfirmOrderInput,
): Promise<LedgerTransaction> {
  const now = new Date()

  // FASE A: transaksi re-validasi + (bila gagal) penolakan yang PERSIST.
  // Karena re-validasi dilakukan SEBELUM append/OTP, jalur penolakan tidak
  // perlu me-rollback apa pun — kita CAS 'ditolak' + audit LALU commit fase ini,
  // baru melempar `REVALIDATION_FAILED` di luar transaksi (persist, §20.5).
  const outcome = await withTransaction(async (tx) => {
    // 1. Otoritas COO in-tx (AD-8).
    await identity.assertCooAt(tx, input.cooId, now)

    // 2. Lock pesanan (LOCK PERTAMA urutan global) & validasi pending kanonik.
    const order = await confirmRepo.lockBuyOrderForUpdate(tx, input.orderId)
    if (!order || order.status !== 'menunggu_konfirmasi' || order.withdrawnAt) {
      throw new LedgerError(
        'ORDER_NOT_PENDING',
        'Pesanan tidak dalam status menunggu konfirmasi (mungkin ditarik, kedaluwarsa, atau sudah difinalisasi).',
      )
    }

    const inRkap = CAPITAL_RULES[order.capitalType].inRkap

    // 2b. Lock fase RKAP aktif (LOCK KEDUA urutan global) bila calon ikut RKAP.
    let activePhaseId: Uuid | null = null
    if (inRkap) {
      activePhaseId = await confirmRepo.findActivePhaseId(tx)
      if (!activePhaseId) {
        throw new LedgerError(
          'NO_ACTIVE_PHASE',
          'Tidak ada fase RKAP aktif untuk re-validasi ruang saat konfirmasi (FR-23).',
        )
      }
    }

    // 3. Re-validasi gerbang memakai kondisi TERKINI (§20.5).
    const failed: RevalidationCheck[] = []

    // 3a. Gerbang Strength (FR-1): posisi terkini + pending kanonik lain + calon.
    const otherPending = await confirmRepo.findOtherPendingKanonik(
      tx,
      order.ownerId,
      order.id,
    )
    const strengthInput = await assembleStrengthInput(tx, order.ownerId, otherPending, {
      capitalType: order.capitalType,
      quantity: order.quantity,
    })
    const strengthGate = evalStrengthGate(strengthInput)
    if (!strengthGate.ok) failed.push('strength')

    // 3b. Ruang RKAP per Capital Type (Modal Tetap/Bergerak saja).
    let ruangRkap: Record<CapitalType, MoneyString> | undefined
    if (inRkap && activePhaseId) {
      ruangRkap = await rkap.spaceByCapitalType(tx, activePhaseId)
      const tambahan = computeActual(order.lockedPrice, order.quantity)
      if (!hasRkapSpace(ruangRkap, order.capitalType, tambahan)) {
        failed.push('rkap_space')
      }
    }

    // 3c. Keabsahan referral (mekanis) — hanya saat Pembelian Pertama (FR-22).
    const firstEffective = await repo.hasNoEffectiveLedger(tx, order.ownerId)
    if (firstEffective && !(await revalidateReferral(tx, order.referralOwnerId))) {
      failed.push('referral')
    }

    if (failed.length > 0) {
      const rejection: ConfirmRejection = {
        orderId: order.id,
        failed,
        proyeksiStrength: strengthGate.proyeksiStrength as ConfirmRejection['proyeksiStrength'],
        proyeksiCeil: strengthGate.proyeksiCeil,
        proyeksiShares: strengthGate.proyeksiShares,
        ruangRkap,
      }

      // CAS pesanan → 'ditolak' (guard pending kanonik) + audit dengan hitungan.
      const rejected = await confirmRepo.casRejectOrder(tx, order.id)
      if (rejected) {
        await audit.write(tx, {
          actor: input.cooId,
          action: 'order_rejected',
          target: order.id,
          details: {
            phase: 'konfirmasi',
            failed,
            proyeksiStrength: rejection.proyeksiStrength,
            proyeksiCeil: rejection.proyeksiCeil,
            proyeksiShares: rejection.proyeksiShares,
            ruangRkap,
          },
        })
      }
      // Commit fase penolakan; sinyalkan ke luar untuk dilempar (persist).
      return { kind: 'rejected' as const, rejection }
    }

    // 4. MFA: verifikasi & konsumsi OTP HANYA setelah re-validasi lolos (§20.2).
    //    Rollback (mis. MFA gagal) mengembalikan konsumsi; re-validasi yang
    //    gagal di atas TIDAK pernah menyentuh OTP.
    await identity.verifyAndConsumeOtp(tx, 'konfirmasi', order.id, input.code)

    // 5. Append ledger (harga final = Harga Terkunci, AD-7/§20.6) + proyeksi.
    const ltx = await appendAndProject(tx, {
      ownerId: order.ownerId,
      capitalType: order.capitalType,
      quantity: order.quantity,
      finalPrice: order.lockedPrice,
      finalPriceRef: order.lockedPriceRef,
      actualAmount: computeActual(order.lockedPrice, order.quantity),
      buyOrderId: order.id,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      actor: 'user',
      effectiveAt: now,
    })

    // 6. CAS pesanan → 'terkonfirmasi' (guard pending kanonik, AD-2).
    const confirmed = await confirmRepo.casConfirmOrder(tx, order.id)
    if (!confirmed) {
      // Kalah race setelah lock (seharusnya tak terjadi karena FOR UPDATE);
      // lempar agar seluruh tx rollback (tidak ada baris setengah jadi).
      throw new LedgerError(
        'ORDER_NOT_PENDING',
        'Pesanan berubah status sebelum konfirmasi tuntas (kalah race).',
      )
    }

    // 7. Plotting alokasi Capital Item + penyesuaian instant overshoot (§20.7).
    if (inRkap) {
      await rkap.plotAllocation(tx, ltx.id, input.plotting)
      if (input.overshoot) {
        await rkap.applyInstantAdjustment(
          tx,
          input.overshoot.capitalItemId,
          input.overshoot.overshoot,
        )
      }
    }

    // 8. Event Pembelian Pertama → IDENTITAS buka transparansi (AD-11).
    if (firstEffective) {
      await identity.markFirstPurchaseEffective(tx, order.ownerId, ltx.effectiveAt)
    }

    // 9. Enqueue Bukti (hook, AD-5) + audit 'order_confirmed' (AD-3) — in-tx.
    await enqueueProofHook(tx, ltx.id)
    await audit.write(tx, {
      actor: input.cooId,
      action: 'order_confirmed',
      target: order.id,
      details: {
        ledgerTxId: ltx.id,
        ownerId: order.ownerId,
        capitalType: order.capitalType,
        quantity: order.quantity,
        finalPrice: order.lockedPrice,
        actualAmount: ltx.actualAmount,
      },
    })

    return { kind: 'confirmed' as const, ltx }
  })

  if (outcome.kind === 'rejected') {
    throw new LedgerError(
      'REVALIDATION_FAILED',
      'Re-validasi gagal saat konfirmasi: posisi/ruang RKAP/referral berubah (FR-20 §20.5).',
      { rejection: outcome.rejection as unknown as Record<string, unknown> },
    )
  }

  // PROOFS.drainOutbox() berjalan async post-commit (retry) — di luar tx.
  return outcome.ltx
}

// ---------------------------------------------------------------------------
// directEntry — jalur input langsung COO (FR-21 §21.1–§21.3) — SATU tx atomik
// ---------------------------------------------------------------------------

/**
 * Input langsung: COO mencatat sebuah pembelian LANGSUNG atas nama Owner tanpa
 * Pesanan Pembelian (tanpa Antrian Beli / `buy_order` = NULL) dalam SATU
 * transaksi atomik (AD-2). Disiplin & urutan sama seperti `confirmOrder`
 * (FR-20), dengan perbedaan kunci:
 *
 *  - Harga di-resolve pada TANGGAL INPUT (`paymentDate`) via
 *    `pricing.currentPrice('beli', paymentDate, tx)` (FR-21 §21.2 / FR-6.4),
 *    lalu di-snapshot (nilai + ref) ke baris ledger (AD-7). BUKAN Harga Terkunci.
 *  - Validasi gerbang Strength PERSIS seperti FR-1: posisi terkini + SELURUH
 *    pesanan pending kanonik Owner + calon (tanpa buy_order untuk dikecualikan).
 *  - Referral WAJIB & sah bila Pembelian Pertama (FR-21 §21.3 / FR-22).
 *  - MFA aksi 'input_langsung' (targetRef = `requestId`) — OTP diminta terhadap
 *    `requestId` yang sama; diverifikasi & dikonsumsi HANYA setelah validasi
 *    lolos (tak pernah mengonsumsi OTP saat validasi gagal).
 *
 * Urutan:
 *  1. Otoritas COO in-tx (AD-8) — `identity.assertCooAt`.
 *  2. Validasi Quantity (> 0, integer).
 *  3. Lock fase RKAP aktif (urutan global) bila Modal Tetap/Bergerak.
 *  4. Resolusi harga pada tanggal input (in-tx).
 *  5. Validasi gerbang (Strength + ruang RKAP + referral Pembelian Pertama).
 *     BILA GAGAL → TIDAK ada baris ledger dibuat; audit 'order_rejected' (phase
 *     'input_langsung') dengan HITUNGAN; lempar `DIRECT_ENTRY_REJECTED`/
 *     `REFERRAL_REQUIRED`. OTP TIDAK dikonsumsi.
 *  6. HANYA setelah validasi lolos: verifikasi & konsumsi OTP 'input_langsung'.
 *  7. Append ledger (buy_order NULL, actor 'user') + proyeksi in-tx (AD-1/AD-4).
 *  8. Plotting alokasi + penyesuaian instant overshoot (Modal Tetap/Bergerak).
 *  9. Event Pembelian Pertama → `identity.markFirstPurchaseEffective` (AD-11).
 * 10. Enqueue Bukti (hook, AD-5) + audit 'direct_entry' (AD-3) — in-tx.
 */
export async function directEntry(
  input: DirectEntryInput,
): Promise<LedgerTransaction> {
  const now = new Date()

  // Validasi bentuk dasar (di luar tx — tak menyentuh DB).
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new LedgerError(
      'INVALID_QUANTITY',
      'Quantity input langsung harus bilangan bulat positif (FR-21 §21.1).',
    )
  }

  const outcome = await withTransaction(async (tx) => {
    // 1. Otoritas COO in-tx (AD-8).
    await identity.assertCooAt(tx, input.cooId, now)

    const inRkap = CAPITAL_RULES[input.capitalType].inRkap

    // 3. Lock fase RKAP aktif (LOCK urutan global) bila calon ikut RKAP.
    let activePhaseId: Uuid | null = null
    if (inRkap) {
      activePhaseId = await confirmRepo.findActivePhaseId(tx)
      if (!activePhaseId) {
        throw new LedgerError(
          'NO_ACTIVE_PHASE',
          'Tidak ada fase RKAP aktif untuk validasi ruang saat input langsung (FR-23).',
        )
      }
    }

    // 4. Resolusi harga pada TANGGAL INPUT (FR-21 §21.2 / FR-6.4), in-tx (AD-7).
    const price = await pricing.currentPrice('beli', input.paymentDate, tx)
    const actualAmount = computeActual(price.price, input.quantity)

    // 5. Validasi gerbang memakai kondisi TERKINI (FR-1 / FR-21 §21.1).
    const failed: RevalidationCheck[] = []

    // 5a. Gerbang Strength (FR-1): posisi + SELURUH pending kanonik Owner + calon.
    const pendingKanonik = await confirmRepo.findPendingKanonikByOwner(
      tx,
      input.ownerId,
    )
    const strengthInput = await assembleStrengthInput(
      tx,
      input.ownerId,
      pendingKanonik,
      { capitalType: input.capitalType, quantity: input.quantity },
    )
    const strengthGate = evalStrengthGate(strengthInput)
    if (!strengthGate.ok) failed.push('strength')

    // 5b. Ruang RKAP per Capital Type (Modal Tetap/Bergerak saja).
    let ruangRkap: Record<CapitalType, MoneyString> | undefined
    if (inRkap && activePhaseId) {
      ruangRkap = await rkap.spaceByCapitalType(tx, activePhaseId)
      if (!hasRkapSpace(ruangRkap, input.capitalType, actualAmount)) {
        failed.push('rkap_space')
      }
    }

    // 5c. Referral WAJIB & sah bila Pembelian Pertama (FR-21 §21.3 / FR-22).
    const firstEffective = await repo.hasNoEffectiveLedger(tx, input.ownerId)
    const referralOk =
      !firstEffective ||
      (await isValidReferralChoice(tx, input.referralOwnerId))
    if (!referralOk) failed.push('referral')

    if (failed.length > 0) {
      const rejection: DirectEntryRejection = {
        ownerId: input.ownerId,
        failed,
        proyeksiStrength: strengthGate.proyeksiStrength as DirectEntryRejection['proyeksiStrength'],
        proyeksiCeil: strengthGate.proyeksiCeil,
        proyeksiShares: strengthGate.proyeksiShares,
        ruangRkap,
      }

      // Audit penolakan dengan HITUNGAN (phase 'input_langsung', §12.5).
      // Tidak ada baris ledger/pesanan dibuat pada penolakan (mirror submit FR-1).
      await audit.write(tx, {
        actor: input.cooId,
        action: 'order_rejected',
        target: input.ownerId,
        details: {
          phase: 'input_langsung',
          failed,
          proyeksiStrength: rejection.proyeksiStrength,
          proyeksiCeil: rejection.proyeksiCeil,
          proyeksiShares: rejection.proyeksiShares,
          ruangRkap,
        },
      })

      return { kind: 'rejected' as const, rejection }
    }

    // 6. MFA: verifikasi & konsumsi OTP 'input_langsung' HANYA setelah validasi
    //    lolos (targetRef = requestId). Rollback (mis. MFA gagal) mengembalikan
    //    konsumsi; validasi yang gagal di atas TIDAK menyentuh OTP.
    await identity.verifyAndConsumeOtp(
      tx,
      'input_langsung',
      input.requestId,
      input.code,
    )

    // 7. Append ledger (buy_order NULL, harga = harga tanggal input) + proyeksi.
    const ltx = await appendAndProject(tx, {
      ownerId: input.ownerId,
      capitalType: input.capitalType,
      quantity: input.quantity,
      finalPrice: price.price,
      finalPriceRef: price.id,
      actualAmount,
      buyOrderId: null,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      actor: 'user',
      effectiveAt: now,
    })

    // 8. Plotting alokasi Capital Item + penyesuaian instant overshoot (§20.7).
    if (inRkap) {
      await rkap.plotAllocation(tx, ltx.id, input.plotting)
      if (input.overshoot) {
        await rkap.applyInstantAdjustment(
          tx,
          input.overshoot.capitalItemId,
          input.overshoot.overshoot,
        )
      }
    }

    // 9. Event Pembelian Pertama → IDENTITAS buka transparansi (AD-11).
    if (firstEffective) {
      await identity.markFirstPurchaseEffective(
        tx,
        input.ownerId,
        ltx.effectiveAt,
      )
    }

    // 10. Enqueue Bukti (hook, AD-5) + audit 'direct_entry' (AD-3) — in-tx.
    await enqueueProofHook(tx, ltx.id)
    await audit.write(tx, {
      actor: input.cooId,
      action: 'direct_entry',
      target: ltx.id,
      details: {
        ledgerTxId: ltx.id,
        ownerId: input.ownerId,
        capitalType: input.capitalType,
        quantity: input.quantity,
        finalPrice: price.price,
        actualAmount: ltx.actualAmount,
        referralOwnerId: input.referralOwnerId ?? null,
        requestId: input.requestId,
      },
    })

    return { kind: 'confirmed' as const, ltx }
  })

  if (outcome.kind === 'rejected') {
    const { failed } = outcome.rejection
    // Pembelian Pertama tanpa referral sah → kode spesifik (FR-21 §21.3/FR-22).
    if (failed.length === 1 && failed[0] === 'referral') {
      throw new LedgerError(
        'REFERRAL_REQUIRED',
        'Pembelian Pertama membutuhkan referral yang sah pada input langsung (FR-21 §21.3).',
        { rejection: outcome.rejection as unknown as Record<string, unknown> },
      )
    }
    throw new LedgerError(
      'DIRECT_ENTRY_REJECTED',
      'Validasi input langsung gagal: Strength/ruang RKAP/referral (FR-21 §21.1).',
      { rejection: outcome.rejection as unknown as Record<string, unknown> },
    )
  }

  // PROOFS.drainOutbox() berjalan async post-commit (retry) — di luar tx.
  return outcome.ltx
}

// ---------------------------------------------------------------------------
// compensationEntry — koreksi pembalik (AD-1 / FR-21 §21.4) — SATU tx atomik
// ---------------------------------------------------------------------------

/**
 * Entry kompensasi/pembalik (AD-1 varian input langsung, FR-21 §21.4). COO
 * mencatat baris kompensasi yang MENUNJUK baris ledger asal (`compensationOfId`)
 * untuk membalik transaksi efektif. Berbeda dari `directEntry`/`confirmOrder`,
 * jalur ini TIDAK melakukan re-validasi gerbang (Strength/RKAP/referral tidak
 * dievaluasi) — murni koreksi. Tetap butuh otoritas COO in-tx + MFA aksi
 * 'kompensasi' (targetRef = `compensationOfId`).
 *
 * Nilai pembalik diturunkan dengan MEMBACA baris asal lalu MENEGASI
 * quantity/shares/ceil/actual (agar posisi net-off); `finalPrice`/`finalPriceRef`
 * disalin dari baris asal (AD-7). Baris asal wajib merupakan transaksi efektif
 * (bukan sendiri entry kompensasi) → jika `compensationOfId` menunjuk baris
 * kompensasi, tolak `INVALID_COMPENSATION_TARGET`.
 */
export async function compensationEntry(
  input: CompensationInput,
): Promise<LedgerTransaction> {
  const now = new Date()

  return withTransaction(async (tx) => {
    // 1. Otoritas COO in-tx (AD-8).
    await identity.assertCooAt(tx, input.cooId, now)

    // 2. Baca baris asal (in-tx) — dasar penurunan nilai pembalik.
    const original = await repo.getLedgerRowById(tx, input.compensationOfId)
    if (!original) {
      throw new LedgerError(
        'LEDGER_ROW_NOT_FOUND',
        'Baris ledger asal untuk kompensasi tidak ditemukan (FR-21 §21.4).',
      )
    }
    if (original.compensationOfId) {
      throw new LedgerError(
        'INVALID_COMPENSATION_TARGET',
        'Baris asal kompensasi tidak boleh merupakan entry kompensasi lain (FR-21 §21.4).',
      )
    }

    // 3. MFA aksi 'kompensasi' (targetRef = compensationOfId) — TANPA re-validasi
    //    gerbang. Rollback luar meninggalkan OTP tidak terkonsumsi.
    await identity.verifyAndConsumeOtp(
      tx,
      'kompensasi',
      input.compensationOfId,
      input.code,
    )

    // 4. Append baris pembalik: negasi quantity/shares/ceil/actual; harga final
    //    disalin dari baris asal (AD-7). `compensationOfId` menunjuk baris asal.
    const negActual = toMoney(new Decimal(original.actualAmount).negated())
    const ltx = await appendAndProject(tx, {
      ownerId: original.ownerId,
      capitalType: original.capitalType,
      quantity: -original.quantity,
      shares: -original.shares,
      ceil: -original.ceil,
      finalPrice: original.finalPrice,
      finalPriceRef: original.finalPriceRef,
      actualAmount: negActual,
      buyOrderId: null,
      compensationOfId: original.id,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      actor: 'user',
      effectiveAt: now,
    })

    // 5. Audit 'compensation_entry' (AD-3) — in-tx.
    await audit.write(tx, {
      actor: input.cooId,
      action: 'compensation_entry',
      target: ltx.id,
      details: {
        ledgerTxId: ltx.id,
        compensationOfId: original.id,
        ownerId: original.ownerId,
        capitalType: original.capitalType,
        quantity: -original.quantity,
        actualAmount: negActual,
        reason: input.reason ?? null,
      },
    })

    return ltx
  })
}

/**
 * Merakit input gerbang Strength TERKINI (§20.5 / FR-1 / FR-21 §21.1):
 * posisi efektif owner saat ini + kumpulan pesanan pending kanonik + calon
 * yang sedang dievaluasi. Predikat pending kanonik: `status='menunggu_konfirmasi'
 * AND withdrawn_at IS NULL` (Property 12). Pembantu murni-rakit yang dipakai
 * baik oleh `confirmOrder` (pending kanonik LAIN, mengecualikan pesanan yang
 * dikonfirmasi) maupun `directEntry` (SELURUH pending kanonik Owner, tanpa
 * buy_order sendiri untuk dikecualikan).
 */
async function assembleStrengthInput(
  tx: Tx,
  ownerId: Uuid,
  pendingKanonik: confirmRepo.PendingOrderBrief[],
  calon: { capitalType: CapitalType; quantity: number },
) {
  const rows = await repo.readOwnerPositionRows(tx, ownerId)
  let totalShares = 0
  let totalCeil = 0
  for (const r of rows) {
    totalShares += r.shares
    totalCeil += r.ceil
  }

  return {
    posisiTerkini: { totalShares, totalCeil },
    pesananPendingKanonik: pendingKanonik.map((p) => ({
      capitalType: p.capitalType,
      quantity: p.quantity,
    })),
    calon,
  }
}

/**
 * TRUE bila ruang RKAP `capitalType` calon masih menampung tambahan Fulfillment
 * senilai `tambahan` (= Harga × Quantity). Modal Operasional (non-RKAP) selalu
 * dianggap punya ruang (tidak masuk RKAP). Dipakai `confirmOrder` (FR-20 §20.5)
 * dan `directEntry` (FR-21 §21.1).
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
 * Re-validasi MEKANIS keabsahan referral saat Pembelian Pertama (FR-22 §22.8):
 * bila pesanan menyandang `referralOwnerId`, referral harus termasuk pilihan
 * sah (pemegang saham atau Owner belum pernah beli). Cross-referral hari-sama
 * adalah PENILAIAN COO (di luar cek mekanis ini). Bila tidak ada referral pada
 * pesanan, kembalikan TRUE (submit sudah menegakkan wajib-referral, FR-1/B.5).
 */
async function revalidateReferral(
  tx: Tx,
  referralOwnerId: Uuid | null,
): Promise<boolean> {
  if (!referralOwnerId) return true
  const choices = await identity.pilihanReferral(tx)
  return choices.some((c) => c.ownerId === referralOwnerId)
}

/**
 * TRUE bila `referralOwnerId` menunjuk pilihan referral yang SAH (pemegang saham
 * / Owner belum pernah beli). Berbeda dari `revalidateReferral`, referral WAJIB
 * hadir: `null`/tidak sah → FALSE. Dipakai `directEntry` saat Pembelian Pertama
 * (FR-21 §21.3 / FR-22).
 */
async function isValidReferralChoice(
  tx: Tx,
  referralOwnerId: Uuid | null | undefined,
): Promise<boolean> {
  if (!referralOwnerId) return false
  const choices = await identity.pilihanReferral(tx)
  return choices.some((c) => c.ownerId === referralOwnerId)
}

/** Nilai Actual (dana riil) = Harga × Quantity (AD-7/§20.6, FR-21 §21.2). */
function computeActual(price: MoneyString, quantity: number): MoneyString {
  return toMoney(new Decimal(price).times(quantity))
}

// ---------------------------------------------------------------------------
// Pembacaan proyeksi (AD-4) — rakit Record by-type
// ---------------------------------------------------------------------------

/**
 * Seluruh posisi kepemilikan (proyeksi AD-4), dirakit menjadi `Position`
 * per-owner dengan Record by-type. Menerima `tx` opsional (in-tx); tanpa `tx`
 * membaca lewat `db` bound-schema.
 */
export async function getPositions(tx?: Tx): Promise<Position[]> {
  const reader = tx ?? repo.db
  const rows = await repo.readPositions(reader)
  return repo.assemblePositions(rows)
}

/**
 * Posisi seorang owner (proyeksi AD-4). Bila owner belum memiliki baris posisi
 * apa pun, mengembalikan `Position` bernilai nol (owner ada namun belum
 * bertransaksi efektif) — konsisten dengan tabel FR-4 yang hanya menampilkan
 * owner setelah transaksi pertama efektif. Menerima `tx` opsional.
 */
export async function getOwnerPosition(
  ownerId: Uuid,
  tx?: Tx,
): Promise<Position> {
  const reader = tx ?? repo.db
  const rows = await repo.readOwnerPositionRows(reader, ownerId)
  return repo.assembleOwnerPosition(ownerId, rows)
}

// ---------------------------------------------------------------------------
// isFirstEffective — deteksi Pembelian Pertama (FR-1)
// ---------------------------------------------------------------------------

/**
 * TRUE bila owner belum memiliki transaksi ledger efektif apa pun (Pembelian
 * Pertama belum terjadi, FR-1). Dievaluasi DI DALAM transaksi finalisasi `tx`
 * agar konsisten dengan penulisan yang sedang berjalan (dipakai untuk memicu
 * `markFirstPurchaseEffective` & keabsahan referral). Entry kompensasi tidak
 * dihitung sebagai transaksi perdana.
 */
export async function isFirstEffective(
  tx: Tx,
  ownerId: Uuid,
): Promise<boolean> {
  return repo.hasNoEffectiveLedger(tx, ownerId)
}

// ---------------------------------------------------------------------------
// cutPointSnapshot — pembacaan murni, snapshot imutabel titik potong
// ---------------------------------------------------------------------------

/**
 * Mengambil snapshot imutabel state ledger pada titik potong dari proyeksi
 * `positions` (AD-4). Merakit posisi per owner + total gabungan Shares/Ceil dan
 * Strength turunannya, serta grand total (basis Portion). Pembacaan MURNI —
 * tidak menulis apa pun. Menerima `tx` opsional agar dapat mengunci snapshot
 * yang konsisten di dalam transaksi (mis. sebelum rekap distribusi FR-16).
 */
export async function cutPointSnapshot(tx?: Tx): Promise<LedgerSnapshot> {
  const reader = tx ?? repo.db
  const positions = repo.assemblePositions(await repo.readPositions(reader))

  const owners: LedgerSnapshotOwner[] = []
  let grandTotalShares = 0
  let grandTotalCeil = 0

  for (const p of positions) {
    const totalShares = sumByType(p.sharesByType)
    const totalCeil = sumByType(p.ceilByType)
    grandTotalShares += totalShares
    grandTotalCeil += totalCeil
    owners.push({
      ownerId: p.ownerId,
      quantityByType: { ...p.quantityByType },
      sharesByType: { ...p.sharesByType },
      ceilByType: { ...p.ceilByType },
      actualByType: { ...p.actualByType },
      totalShares,
      totalCeil,
      strength: sharedStrength(totalShares, totalCeil),
    })
  }

  return {
    takenAt: new Date(),
    owners,
    grandTotalShares,
    grandTotalCeil,
  }
}

// ---------------------------------------------------------------------------
// recomputeFromLedger — rekonsiliasi (pembanding, BUKAN jalur tulis, AD-4)
// ---------------------------------------------------------------------------

/**
 * Membandingkan proyeksi `positions` yang tersimpan dengan agregat hasil
 * rekomputasi penuh dari `ledger_transactions` (AD-4). Melaporkan setiap
 * ketidakcocokan pada granularitas (owner, capital_type, field). Ini adalah
 * ALAT PEMBANDING untuk rekonsiliasi berkala — TIDAK memperbaiki/menulis proyeksi.
 */
export async function recomputeFromLedger(): Promise<ReconReport> {
  const reader = repo.db
  const projectedRows = await repo.readPositions(reader)
  const recomputedRows = await repo.recomputeAggregate(reader)

  const projected = indexByKey(projectedRows)
  const recomputed = indexByKey(recomputedRows)

  const keys = new Set<string>([...projected.keys(), ...recomputed.keys()])
  const mismatches: ReconMismatch[] = []

  for (const key of keys) {
    const p = projected.get(key)
    const r = recomputed.get(key)
    const { ownerId, capitalType } = p ?? r! // salah satu pasti ada

    // Baris proyeksi/rekomputasi yang absen diperlakukan sebagai nol.
    const pQ = p?.quantity ?? 0
    const rQ = r?.quantity ?? 0
    const pS = p?.shares ?? 0
    const rS = r?.shares ?? 0
    const pC = p?.ceil ?? 0
    const rC = r?.ceil ?? 0
    const pA = p?.actualAmount ?? toMoney(0)
    const rA = r?.actualAmount ?? toMoney(0)

    if (pQ !== rQ) {
      mismatches.push(mismatch(ownerId, capitalType, 'quantity', pQ, rQ))
    }
    if (pS !== rS) {
      mismatches.push(mismatch(ownerId, capitalType, 'shares', pS, rS))
    }
    if (pC !== rC) {
      mismatches.push(mismatch(ownerId, capitalType, 'ceil', pC, rC))
    }
    if (!new Decimal(pA).equals(new Decimal(rA))) {
      mismatches.push(mismatch(ownerId, capitalType, 'actualAmount', pA, rA))
    }
  }

  return {
    balanced: mismatches.length === 0,
    checkedAt: new Date(),
    comparedRows: keys.size,
    mismatches,
  }
}

// ---------------------------------------------------------------------------
// Bantuan internal
// ---------------------------------------------------------------------------

/** Jumlah nilai integer gabungan semua Capital Type. */
function sumByType(byType: Record<CapitalType, number>): number {
  let total = 0
  for (const t of CAPITAL_TYPES) total += byType[t]
  return total
}

/** Kunci komposit (owner, capital_type) untuk pemetaan rekonsiliasi. */
function keyOf(ownerId: Uuid, capitalType: CapitalType): string {
  return `${ownerId}::${capitalType}`
}

/** Meng-index daftar baris agregat berdasarkan (owner, capital_type). */
function indexByKey(rows: PositionRow[]): Map<string, PositionRow> {
  const map = new Map<string, PositionRow>()
  for (const row of rows) map.set(keyOf(row.ownerId, row.capitalType), row)
  return map
}

/** Membentuk satu entri mismatch dengan nilai proyeksi vs rekomputasi. */
function mismatch(
  ownerId: Uuid,
  capitalType: CapitalType,
  field: ReconMismatch['field'],
  projected: number | MoneyString,
  recomputed: number | MoneyString,
): ReconMismatch {
  return {
    ownerId,
    capitalType,
    field,
    projected: String(projected),
    recomputed: String(recomputed),
  }
}

// Re-ekspor LedgerError agar route dapat memetakan kode error dari pintu index.
export { LedgerError }
