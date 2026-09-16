// server/domain/rkap/rkap.service.ts
//
// Orkestrasi domain RKAP (FR-1/FR-23). Tugas 9.1 mengimplementasikan TIGA fungsi:
//   - newPhase           : tetapkan fase + Capital Item; KUNCI Initial Requirement
//                          (Final = Initial saat penetapan, FR-23 §23.3). Hitung
//                          batas penyesuaian fase via `batasPenyesuaianFase` bila
//                          harga berjalan diberi (FR-23 §23.6), else pakai budget
//                          override. Audit 'rkap_new_phase' in-tx (FR-12).
//   - getPhaseView       : tabel FR-23 (§23.1) per Capital Item + kolom turunan
//                          + agregat + ringkasan batas + ruang/Quantity Left per
//                          Capital Type (§23.13). Fase aktif bila `phaseId` kosong.
//   - spaceByCapitalType : ruang per Capital Type = Σ Final Requirement − Σ
//                          Fulfillment efektif via `ruangRkap` (FR-23 §23.2).
//                          Modal Operasional (inRkap=false) = '0.00'.
//
// Konvensi transaksi (AD-2): service teratas membuka transaksi via
// `withTransaction`; audit ditulis DI DALAM tx yang sama agar atomik.
// Aritmetika uang/rasio SELALU lewat `Decimal`/`toMoney`/`toRatio` (AD-10).
//
// Catatan cakupan: plotAllocation, applyInstantAdjustment, manualAdjust, dan
// rebalance adalah tugas 9.2/9.3 dan TIDAK diimplementasikan di sini.

import { withTransaction } from '../../utils/db'
import type { Tx } from '../../utils/db'
import { audit } from '../audit'
import { Decimal, toMoney, toRatio } from '../../../shared/domain/decimal'
import {
  batasPenyesuaianFase,
  maxQuantityRkap,
  ruangRkap,
} from '../../../shared/domain/rkap-limits'
import {
  CAPITAL_RULES,
  type CapitalType,
  type MoneyString,
  type Uuid,
} from '../../../shared/domain/types'
import * as repo from './rkap.repo'
import type { CapitalItemRow, PhaseRow } from './rkap.repo'
import { RkapError } from './events'
import type {
  AdjustmentLimitSummary,
  CapitalItemView,
  CapitalTypeSpaceView,
  ManualAdjustment,
  NewPhaseInput,
  PlottingPlan,
  RebalancePlan,
  RkapAggregates,
  RkapPhase,
  RkapPhaseView,
} from './events'

// ---------------------------------------------------------------------------
// Konstanta Capital Type
// ---------------------------------------------------------------------------

/** Seluruh Capital Type (kunci `Record<CapitalType, …>`). */
const ALL_CAPITAL_TYPES = Object.keys(CAPITAL_RULES) as CapitalType[]

/** Capital Type yang ikut RKAP (Modal Tetap/Bergerak) — CAPITAL_RULES.inRkap. */
const RKAP_CAPITAL_TYPES = ALL_CAPITAL_TYPES.filter(
  (t) => CAPITAL_RULES[t].inRkap,
)

const ZERO_MONEY = toMoney('0')

// ---------------------------------------------------------------------------
// Pemeta baris fase → tipe kontrak
// ---------------------------------------------------------------------------

function toRkapPhase(row: PhaseRow): RkapPhase {
  return {
    id: row.id,
    name: row.name,
    instantAdjustmentBudget: row.instantAdjustmentBudget,
    instantAdjustmentUsed: row.instantAdjustmentUsed,
    isActive: row.isActive,
    momRef: row.momRef,
    createdAt: row.createdAt,
  }
}

// ---------------------------------------------------------------------------
// newPhase (FR-23 §23.3/§23.6) — service teratas membuka transaksi
// ---------------------------------------------------------------------------

/**
 * Menetapkan fase RKAP baru beserta Capital Item-nya (FR-23 §23.3).
 *
 * - Mengunci Initial Requirement: `finalRequirement` disimpan sama dengan
 *   `initialRequirement` (bergerak hanya lewat penyesuaian instant/manual, §23.4).
 * - Batas penyesuaian fase (§23.6): bila `runningPrice` diberi →
 *   `batasPenyesuaianFase(Σ Initial Requirement, runningPrice)`; jika tidak,
 *   pakai `budgetOverride` (atau '0.00').
 * - Menolak Capital Type di luar Modal Tetap/Bergerak (inRkap=false) dan daftar
 *   Capital Item kosong.
 * - Audit 'rkap_new_phase' ditulis in-tx (FR-12).
 *
 * @param cooId  Aktor COO penetap fase (dicatat pada audit).
 * @param phase  Input fase (nama, Capital Item, harga berjalan/budget).
 * @param momRef Referensi MoM MRO penetap fase (FR-23 §23.3) — wajib.
 */
export async function newPhase(
  cooId: Uuid,
  phase: NewPhaseInput,
  momRef: Uuid,
): Promise<RkapPhase> {
  if (phase.items.length === 0) {
    throw new RkapError(
      'NO_ITEMS',
      'Penetapan fase RKAP wajib memuat minimal satu Capital Item (FR-23 §23.1).',
    )
  }

  // Validasi Capital Type: hanya Modal Tetap/Bergerak yang masuk RKAP.
  for (const item of phase.items) {
    const rule = CAPITAL_RULES[item.capitalType]
    if (!rule || !rule.inRkap) {
      throw new RkapError(
        'INVALID_CAPITAL_TYPE',
        `Capital Type "${item.capitalType}" tidak masuk RKAP; hanya Modal Tetap/Bergerak yang diizinkan (FR-23).`,
      )
    }
  }

  // Σ Initial Requirement fase (basis batas penyesuaian §23.6).
  const totalInitial = phase.items.reduce(
    (acc, it) => acc.plus(new Decimal(it.initialRequirement)),
    new Decimal(0),
  )

  // Batas agregat penyesuaian fase (§23.6).
  const budget: MoneyString = phase.runningPrice
    ? batasPenyesuaianFase(toMoney(totalInitial), phase.runningPrice)
    : phase.budgetOverride ?? ZERO_MONEY

  return withTransaction(async (tx) => {
    const phaseRow = await repo.insertPhase(tx, {
      name: phase.name,
      instantAdjustmentBudget: budget,
      momRef,
    })

    // Kunci Initial Requirement: Final = Initial saat penetapan (§23.3/§23.4).
    await repo.insertCapitalItems(
      tx,
      phase.items.map((it) => ({
        phaseId: phaseRow.id,
        name: it.name,
        capitalType: it.capitalType,
        initialRequirement: it.initialRequirement,
        finalRequirement: it.initialRequirement,
      })),
    )

    // Audit penetapan fase (FR-12) — in-tx, atomik dengan INSERT.
    await audit.write(tx, {
      actor: cooId,
      action: 'rkap_new_phase',
      target: phaseRow.id,
      details: {
        name: phaseRow.name,
        momRef,
        totalInitialRequirement: toMoney(totalInitial),
        instantAdjustmentBudget: budget,
        itemCount: phase.items.length,
      },
    })

    return toRkapPhase(phaseRow)
  })
}

// ---------------------------------------------------------------------------
// spaceByCapitalType (FR-23 §23.2) — pembacaan in-tx (gerbang pembelian)
// ---------------------------------------------------------------------------

/**
 * Ruang RKAP per Capital Type (FR-23 §23.2): untuk tiap Capital Type yang ikut
 * RKAP (Modal Tetap/Bergerak), `Σ Final Requirement − Σ Fulfillment efektif`
 * memakai `ruangRkap`. Modal Operasional (inRkap=false) selalu '0.00'.
 *
 * Fulfillment pada `capital_items` hanya bertambah saat transaksi menjadi
 * EFEKTIF (FR-20 §7), sehingga jumlahnya sudah "efektif saja" (pesanan antri
 * tidak mereservasi ruang).
 *
 * Dipanggil in-tx oleh finalisasi/orders sebagai gerbang pembelian (AD-2).
 */
export async function spaceByCapitalType(
  tx: Tx,
  phaseId: Uuid,
): Promise<Record<CapitalType, MoneyString>> {
  const items = await repo.findItemsByPhase(tx, phaseId)
  return computeSpaceMoney(items)
}

/**
 * Menghitung ruang uang per Capital Type dari daftar Capital Item.
 * Capital Type non-RKAP di-set '0.00' (dikecualikan dari ruang, §23.2).
 */
function computeSpaceMoney(
  items: CapitalItemRow[],
): Record<CapitalType, MoneyString> {
  const finalByType = new Map<CapitalType, Decimal>()
  const fulfillmentByType = new Map<CapitalType, Decimal>()

  for (const t of RKAP_CAPITAL_TYPES) {
    finalByType.set(t, new Decimal(0))
    fulfillmentByType.set(t, new Decimal(0))
  }

  for (const item of items) {
    if (!CAPITAL_RULES[item.capitalType]?.inRkap) continue
    finalByType.set(
      item.capitalType,
      finalByType.get(item.capitalType)!.plus(new Decimal(item.finalRequirement)),
    )
    fulfillmentByType.set(
      item.capitalType,
      fulfillmentByType
        .get(item.capitalType)!
        .plus(new Decimal(item.fulfillment)),
    )
  }

  const result = {} as Record<CapitalType, MoneyString>
  for (const t of ALL_CAPITAL_TYPES) {
    if (!CAPITAL_RULES[t].inRkap) {
      result[t] = ZERO_MONEY
      continue
    }
    result[t] = ruangRkap(
      toMoney(finalByType.get(t)!),
      toMoney(fulfillmentByType.get(t)!),
    )
  }
  return result
}

// ---------------------------------------------------------------------------
// plotAllocation / defaultFifoPlot (FR-23 §23.10/§23.11/§23.12) — in-tx dari ledger
// ---------------------------------------------------------------------------

/**
 * Menyusun rencana plotting FIFO default (FR-23 §23.12) untuk `amount`
 * Fulfillment sebuah transaksi `capitalType` pada `items` (Capital Item satu
 * fase). Item diisi berurutan tertua-lebih-dulu (`createdAt` menaik) hingga
 * Final Requirement masing-masing (sisa = Final Requirement − Fulfillment),
 * baru berpindah ke item berikutnya.
 *
 * Melempar `FULFILLMENT_EXCEEDS_FINAL` bila total sisa ruang seluruh Capital Item
 * `capitalType` tidak cukup menampung `amount` — sejalan dengan gerbang 100%
 * (§23.10): bila ruang Capital Type 0 (Fulfillment Rate 100%), tidak ada item
 * yang dapat diisi. Fungsi murni: tidak melakukan I/O.
 */
function buildFifoPlan(
  items: CapitalItemRow[],
  capitalType: CapitalType,
  amount: MoneyString,
): PlottingPlan {
  // Kandidat: Capital Item ber-Capital Type sama, tertua-lebih-dulu (FIFO).
  const candidates = items
    .filter((it) => it.capitalType === capitalType)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const allocations: PlottingPlan['allocations'] = []
  let remaining = new Decimal(amount)

  for (const item of candidates) {
    if (remaining.lte(0)) break
    // Sisa ruang item = Final Requirement − Fulfillment (tak pernah negatif).
    const room = Decimal.max(
      new Decimal(item.finalRequirement).minus(new Decimal(item.fulfillment)),
      new Decimal(0),
    )
    if (room.lte(0)) continue

    const take = Decimal.min(room, remaining)
    allocations.push({ capitalItemId: item.id, amount: toMoney(take) })
    remaining = remaining.minus(take)
  }

  // Sisa tak tertampung → gerbang tertutup / ruang tak cukup (§23.10/§23.11).
  if (remaining.gt(0)) {
    throw new RkapError(
      'FULFILLMENT_EXCEEDS_FINAL',
      `Ruang Capital Type "${capitalType}" tidak cukup untuk plotting Fulfillment sebesar ${amount}; sisa tak tertampung ${toMoney(remaining)} melebihi Final Requirement (FR-23 §23.11).`,
    )
  }

  return { allocations }
}

/**
 * Menyusun rencana plotting FIFO default (FR-23 §23.12) untuk sebuah transaksi
 * ledger `ledgerTxId`: membaca Capital Type + Actual (nilai Fulfillment) baris
 * ledger, memuat Capital Item fase aktif, lalu menyebar nilai secara FIFO
 * (tertua-lebih-dulu) hingga Final Requirement tiap item.
 *
 * Dipanggil DI DALAM transaksi finalisasi ledger (AD-2) bila COO tidak
 * menetapkan rencana. Melempar `LEDGER_TX_NOT_FOUND`/`PHASE_NOT_FOUND` bila
 * rujukan tak ada, atau `FULFILLMENT_EXCEEDS_FINAL` bila ruang tak cukup.
 */
export async function defaultFifoPlot(
  tx: Tx,
  ledgerTxId: Uuid,
): Promise<PlottingPlan> {
  const brief = await repo.findLedgerTxBrief(tx, ledgerTxId)
  if (!brief) {
    throw new RkapError(
      'LEDGER_TX_NOT_FOUND',
      `Transaksi ledger ${ledgerTxId} tidak ditemukan untuk plotting FIFO (FR-23 §23.12).`,
    )
  }

  const phase = await requireActivePhase(tx)
  const items = await repo.findItemsByPhase(tx, phase.id)
  return buildFifoPlan(items, brief.capitalType, brief.actualAmount)
}

/**
 * Menerapkan plotting alokasi Fulfillment sebuah transaksi efektif (FR-23
 * §23.10/§23.11/§23.12). Bila `plan` tidak diberi, memakai FIFO default
 * (`defaultFifoPlot`).
 *
 * Untuk tiap alokasi, menaikkan kolom `fulfillment` Capital Item sebesar
 * `amount` DI DALAM transaksi `tx`. Menolak (`FULFILLMENT_EXCEEDS_FINAL`) bila
 * Fulfillment hasil suatu item MELEBIHI Final Requirement-nya (§23.11) — ini
 * juga menegakkan gerbang 100% (§23.10): item yang Fulfillment-nya sudah = Final
 * Requirement (ruang 0) tidak dapat menerima alokasi baru. Audit
 * 'rkap_plot_allocation' ditulis in-tx (FR-12).
 *
 * @param tx         Transaksi finalisasi ledger berjalan (AD-2).
 * @param ledgerTxId Baris `ledger_transactions` sumber Fulfillment.
 * @param plan       Rencana plotting COO; bila diabaikan → FIFO default.
 */
export async function plotAllocation(
  tx: Tx,
  ledgerTxId: Uuid,
  plan?: PlottingPlan,
): Promise<void> {
  const brief = await repo.findLedgerTxBrief(tx, ledgerTxId)
  if (!brief) {
    throw new RkapError(
      'LEDGER_TX_NOT_FOUND',
      `Transaksi ledger ${ledgerTxId} tidak ditemukan untuk plotting Fulfillment (FR-23 §23.11).`,
    )
  }

  // Capital Type di luar RKAP (Modal Operasional) tidak diplot ke Capital Item.
  const rule = CAPITAL_RULES[brief.capitalType]
  if (!rule || !rule.inRkap) {
    throw new RkapError(
      'INVALID_CAPITAL_TYPE',
      `Capital Type "${brief.capitalType}" tidak masuk RKAP; tidak dapat di-plot (FR-23).`,
    )
  }

  const phase = await requireActivePhase(tx)

  // Rencana efektif: FIFO default bila COO tidak menetapkan.
  const effectivePlan: PlottingPlan =
    plan ??
    buildFifoPlan(
      await repo.findItemsByPhase(tx, phase.id),
      brief.capitalType,
      brief.actualAmount,
    )

  if (effectivePlan.allocations.length === 0) {
    throw new RkapError(
      'INVALID_PLOTTING',
      'Rencana plotting kosong; tidak ada alokasi Fulfillment (FR-23 §23.11).',
    )
  }

  // Deteksi alokasi ganda & nilai negatif; jumlahkan konsumsi.
  const seen = new Set<Uuid>()
  let planned = new Decimal(0)
  for (const alloc of effectivePlan.allocations) {
    if (new Decimal(alloc.amount).lt(0)) {
      throw new RkapError(
        'INVALID_PLOTTING',
        'Alokasi plotting tidak boleh negatif (FR-23 §23.11).',
      )
    }
    if (seen.has(alloc.capitalItemId)) {
      throw new RkapError(
        'INVALID_PLOTTING',
        `Capital Item ${alloc.capitalItemId} dirujuk lebih dari sekali pada plotting (FR-23 §23.11).`,
      )
    }
    seen.add(alloc.capitalItemId)
    planned = planned.plus(new Decimal(alloc.amount))
  }

  // Total alokasi harus sama dengan nilai Fulfillment transaksi (Actual).
  if (!planned.equals(new Decimal(brief.actualAmount))) {
    throw new RkapError(
      'INVALID_PLOTTING',
      `Total alokasi plotting (${toMoney(planned)}) tidak sama dengan nilai Fulfillment transaksi (${brief.actualAmount}) (FR-23 §23.11).`,
    )
  }

  // Terapkan tiap alokasi: validasi Capital Type & batas Final Requirement,
  // lalu naikkan kolom Fulfillment in-tx.
  for (const alloc of effectivePlan.allocations) {
    const amount = new Decimal(alloc.amount)
    if (amount.lte(0)) continue // alokasi 0 tidak mengubah apa pun

    const item = await repo.findItemById(tx, alloc.capitalItemId)
    if (!item) {
      throw new RkapError(
        'ITEM_NOT_FOUND',
        `Capital Item ${alloc.capitalItemId} tidak ditemukan untuk plotting (FR-23 §23.11).`,
      )
    }

    // Item harus se-Capital Type dengan transaksi & satu fase aktif (§23.11).
    if (item.capitalType !== brief.capitalType) {
      throw new RkapError(
        'INVALID_PLOTTING',
        `Plotting hanya ke Capital Item ber-Capital Type sama; item "${item.capitalType}" ≠ transaksi "${brief.capitalType}" (FR-23 §23.11).`,
      )
    }
    if (item.phaseId !== phase.id) {
      throw new RkapError(
        'INVALID_PLOTTING',
        'Plotting hanya ke Capital Item pada fase RKAP aktif (FR-23 §23.11).',
      )
    }

    // Tolak bila Fulfillment hasil melebihi Final Requirement (§23.11/§23.10).
    const resulting = new Decimal(item.fulfillment).plus(amount)
    if (resulting.gt(new Decimal(item.finalRequirement))) {
      throw new RkapError(
        'FULFILLMENT_EXCEEDS_FINAL',
        `Alokasi ${alloc.amount} membuat Fulfillment Capital Item ${item.id} (${toMoney(resulting)}) melebihi Final Requirement ${item.finalRequirement} (FR-23 §23.11).`,
      )
    }

    await repo.addFulfillment(tx, item.id, toMoney(amount))
  }

  // Audit plotting alokasi Fulfillment (FR-23 §23.11, FR-12) — in-tx, atomik.
  await audit.write(tx, {
    actor: null, // dipicu efektifnya transaksi (finalisasi ledger), bukan aksi manual
    action: 'rkap_plot_allocation',
    target: ledgerTxId,
    details: {
      phaseId: phase.id,
      capitalType: brief.capitalType,
      actualAmount: brief.actualAmount,
      allocations: effectivePlan.allocations.map((a) => ({
        capitalItemId: a.capitalItemId,
        amount: toMoney(new Decimal(a.amount)),
      })),
    },
  })
}

// ---------------------------------------------------------------------------
// getPhaseView (FR-23 §23.1/§23.13) — pembacaan view (di luar tx aksi)
// ---------------------------------------------------------------------------

/**
 * Tampilan fase RKAP lengkap (FR-23): tabel Capital Item + kolom turunan
 * (Fulfillment Rate, Shortfall, Achievement, Held) + agregat + ringkasan batas
 * penyesuaian + ruang/Quantity Left per Capital Type (§23.13).
 *
 * - Bila `phaseId` kosong → memakai fase aktif (`is_active = true`).
 * - Quantity Left (§23.13) butuh harga berjalan: bila `runningPrice` diberi,
 *   dihitung via `maxQuantityRkap(sisa ruang, harga, sisa batas penyesuaian)`;
 *   bila tidak, `quantityLeft = null` (hanya ruang uang yang diekspos).
 *
 * Pembacaan view memakai `db` bound-schema (di luar transaksi aksi).
 */
export async function getPhaseView(
  phaseId?: Uuid,
  runningPrice?: MoneyString,
): Promise<RkapPhaseView> {
  const reader = repo.db

  const phaseRow = phaseId
    ? await repo.findPhaseById(reader, phaseId)
    : await repo.findActivePhase(reader)

  if (!phaseRow) {
    throw new RkapError(
      'PHASE_NOT_FOUND',
      phaseId
        ? `Fase RKAP ${phaseId} tidak ditemukan.`
        : 'Tidak ada fase RKAP aktif.',
    )
  }

  const items = await repo.findItemsByPhase(reader, phaseRow.id)

  const itemViews = items.map(toCapitalItemView)
  const aggregates = computeAggregates(items)
  const limitSummary = computeLimitSummary(phaseRow)
  const spaceView = computeSpaceView(items, limitSummary.remaining, runningPrice)

  return {
    phase: toRkapPhase(phaseRow),
    items: itemViews,
    aggregates,
    limitSummary,
    spaceByCapitalType: spaceView,
  }
}

/** Kolom turunan tabel FR-23 (§23.1) untuk satu Capital Item. */
function toCapitalItemView(item: CapitalItemRow): CapitalItemView {
  const finalReq = new Decimal(item.finalRequirement)
  const fulfillment = new Decimal(item.fulfillment)
  const utilization = new Decimal(item.utilization)

  // fulfillmentRate = Fulfillment ÷ Final Requirement (0 bila Final = 0).
  const fulfillmentRate = finalReq.isZero()
    ? toRatio(0)
    : toRatio(fulfillment.div(finalReq))

  // shortfall = Final Requirement − Fulfillment.
  const shortfall = toMoney(finalReq.minus(fulfillment))

  // achievement = Utilization ÷ Fulfillment (0 bila Fulfillment = 0; bisa > 1).
  const achievement = fulfillment.isZero()
    ? toRatio(0)
    : toRatio(utilization.div(fulfillment))

  // held = Fulfillment − Utilization.
  const held = toMoney(fulfillment.minus(utilization))

  return {
    id: item.id,
    name: item.name,
    capitalType: item.capitalType,
    initialRequirement: item.initialRequirement,
    finalRequirement: item.finalRequirement,
    fulfillment: item.fulfillment,
    fulfillmentRate,
    shortfall,
    utilization: item.utilization,
    achievement,
    held,
  }
}

/** Agregat Σ seluruh Capital Item fase (kaki tabel FR-23). */
function computeAggregates(items: CapitalItemRow[]): RkapAggregates {
  let initial = new Decimal(0)
  let final = new Decimal(0)
  let fulfillment = new Decimal(0)
  let utilization = new Decimal(0)

  for (const item of items) {
    initial = initial.plus(new Decimal(item.initialRequirement))
    final = final.plus(new Decimal(item.finalRequirement))
    fulfillment = fulfillment.plus(new Decimal(item.fulfillment))
    utilization = utilization.plus(new Decimal(item.utilization))
  }

  return {
    totalInitialRequirement: toMoney(initial),
    totalFinalRequirement: toMoney(final),
    totalFulfillment: toMoney(fulfillment),
    totalShortfall: toMoney(final.minus(fulfillment)),
    totalUtilization: toMoney(utilization),
    totalHeld: toMoney(fulfillment.minus(utilization)),
  }
}

/** Ringkasan batas penyesuaian fase (§23.6/§23.7); sisa ≥ 0. */
function computeLimitSummary(phase: PhaseRow): AdjustmentLimitSummary {
  const budget = new Decimal(phase.instantAdjustmentBudget)
  const used = new Decimal(phase.instantAdjustmentUsed)
  const remaining = Decimal.max(budget.minus(used), new Decimal(0))
  return {
    budget: phase.instantAdjustmentBudget,
    used: phase.instantAdjustmentUsed,
    remaining: toMoney(remaining),
  }
}

/**
 * Ruang + Quantity Left per Capital Type untuk view (§23.2/§23.13).
 *
 * Quantity Left dihitung hanya bila `runningPrice` diberi dan valid (> 0),
 * memakai `maxQuantityRkap(sisa ruang, harga, sisa batas penyesuaian)`; bila
 * tidak, `quantityLeft = null` (Quantity Left di-omit, hanya ruang uang).
 */
function computeSpaceView(
  items: CapitalItemRow[],
  remainingAdjustment: MoneyString,
  runningPrice?: MoneyString,
): Record<CapitalType, CapitalTypeSpaceView> {
  const spaceMoney = computeSpaceMoney(items)
  const hasPrice = runningPrice !== undefined && new Decimal(runningPrice).gt(0)

  const result = {} as Record<CapitalType, CapitalTypeSpaceView>
  for (const t of ALL_CAPITAL_TYPES) {
    const ruang = spaceMoney[t]
    // Quantity Left hanya bermakna untuk Capital Type RKAP dengan harga berjalan.
    if (!CAPITAL_RULES[t].inRkap || !hasPrice) {
      result[t] = { ruang, quantityLeft: null }
      continue
    }
    result[t] = {
      ruang,
      quantityLeft: maxQuantityRkap(ruang, runningPrice!, remainingAdjustment),
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// applyInstantAdjustment (FR-23 §23.4/§23.6/§23.9) — dipanggil in-tx dari ledger
// ---------------------------------------------------------------------------

/**
 * Penyesuaian instant otomatis (FR-23 §23.9): saat transaksi dengan pembulatan
 * ke atas menjadi EFEKTIF, naikkan Final Requirement Capital Item ter-plot
 * sebesar `overshoot` DAN tambahkan `overshoot` ke akumulasi penyesuaian fase
 * (`instantAdjustmentUsed`). Keduanya dilakukan DI DALAM transaksi `tx` yang
 * sama dengan finalisasi ledger (AD-2), lalu ditulis audit 'instant_adjustment'.
 *
 * Kuota fase telah dijaga di gerbang pembelian (§23.8/`maxQuantityRkap`): sistem
 * tidak menawarkan pembulatan ke atas bila sisa kuota lebih kecil dari overshoot,
 * sehingga di sini overshoot sudah dipastikan tertampung.
 *
 * @param tx            Transaksi finalisasi ledger berjalan.
 * @param capitalItemId Capital Item ter-plot yang Final Requirement-nya dinaikkan.
 * @param overshoot     Selisih pembulatan ke atas (≥ 0). Bila 0/negatif → no-op.
 */
export async function applyInstantAdjustment(
  tx: Tx,
  capitalItemId: Uuid,
  overshoot: MoneyString,
): Promise<void> {
  const delta = new Decimal(overshoot)
  // Overshoot 0 (atau negatif — tak seharusnya terjadi) tidak mengubah apa pun.
  if (delta.lte(0)) return

  const item = await repo.findItemById(tx, capitalItemId)
  if (!item) {
    throw new RkapError(
      'ITEM_NOT_FOUND',
      `Capital Item ${capitalItemId} tidak ditemukan untuk penyesuaian instant (FR-23 §23.9).`,
    )
  }

  const overshootMoney = toMoney(delta)

  // Naikkan Final Requirement item ter-plot + akumulasi penyesuaian fase, in-tx.
  await repo.raiseFinalRequirement(tx, capitalItemId, overshootMoney)
  await repo.addUsedAdjustment(tx, item.phaseId, overshootMoney)

  // Audit penyesuaian instant (FR-23 §23.9, FR-12) — in-tx, atomik.
  await audit.write(tx, {
    actor: null, // otomatis (dipicu oleh efektifnya transaksi), bukan aksi COO
    action: 'instant_adjustment',
    target: capitalItemId,
    details: {
      phaseId: item.phaseId,
      capitalType: item.capitalType,
      overshoot: overshootMoney,
    },
  })
}

// ---------------------------------------------------------------------------
// manualAdjust (FR-23 §23.5/§23.6/§23.7) — dipanggil in-tx
// ---------------------------------------------------------------------------

/**
 * Penyesuaian manual COO (FR-23 §23.5). Hanya boleh:
 *  - MENAIKKAN Final Requirement item eksisting (`raiseBy` ≥ 0), atau
 *  - menambahkan Capital Item BARU (`newItem`) ke fase berjalan.
 *
 * Konsumsi penyesuaian (`raiseBy` atau `newItem.finalRequirement`) menambah
 * `instantAdjustmentUsed`; ditolak (`ADJUSTMENT_EXCEEDS_LIMIT`) bila akumulasi
 * melewati batas agregat fase (§23.6/§23.7), mempertahankan nilai sebelumnya,
 * dan menyertakan sisa kuota pada pesan. Audit 'rkap_manual_adjust' in-tx.
 *
 * Dipanggil DI DALAM transaksi `tx` (AD-2). Fase ditentukan dari item eksisting
 * (untuk `raiseBy`) atau dari fase aktif (untuk `newItem`).
 */
export async function manualAdjust(
  tx: Tx,
  cooId: Uuid,
  adjustment: ManualAdjustment,
): Promise<void> {
  // --- Bentuk 1: menaikkan Final Requirement item eksisting ------------------
  if ('capitalItemId' in adjustment) {
    const raiseBy = new Decimal(adjustment.raiseBy)
    if (raiseBy.lt(0)) {
      throw new RkapError(
        'INVALID_ADJUSTMENT',
        'Penyesuaian manual hanya boleh menaikkan Final Requirement (raiseBy ≥ 0, FR-23 §23.5).',
      )
    }

    const item = await repo.findItemById(tx, adjustment.capitalItemId)
    if (!item) {
      throw new RkapError(
        'ITEM_NOT_FOUND',
        `Capital Item ${adjustment.capitalItemId} tidak ditemukan (FR-23 §23.5).`,
      )
    }

    const phase = await requirePhase(tx, item.phaseId)
    const consumption = toMoney(raiseBy)
    assertWithinBudget(phase, consumption)

    if (raiseBy.gt(0)) {
      await repo.raiseFinalRequirement(tx, item.id, consumption)
      await repo.addUsedAdjustment(tx, phase.id, consumption)
    }

    await audit.write(tx, {
      actor: cooId,
      action: 'rkap_manual_adjust',
      target: item.id,
      details: {
        phaseId: phase.id,
        kind: 'raise',
        capitalType: item.capitalType,
        raiseBy: consumption,
      },
    })
    return
  }

  // --- Bentuk 2: menambahkan Capital Item baru ke fase berjalan --------------
  const { newItem } = adjustment
  const rule = CAPITAL_RULES[newItem.capitalType]
  if (!rule || !rule.inRkap) {
    throw new RkapError(
      'INVALID_CAPITAL_TYPE',
      `Capital Type "${newItem.capitalType}" tidak masuk RKAP; hanya Modal Tetap/Bergerak (FR-23).`,
    )
  }

  const finalReq = new Decimal(newItem.finalRequirement)
  if (finalReq.lt(0)) {
    throw new RkapError(
      'INVALID_ADJUSTMENT',
      'Final Requirement Capital Item baru tidak boleh negatif (FR-23 §23.5).',
    )
  }

  const phase = await requireActivePhase(tx)
  const consumption = toMoney(finalReq)
  assertWithinBudget(phase, consumption)

  const [inserted] = await repo.insertCapitalItems(tx, [
    {
      phaseId: phase.id,
      name: newItem.name,
      capitalType: newItem.capitalType,
      // Item baru: Initial dikunci 0 (bukan bagian penetapan fase); seluruh
      // Final Requirement adalah konsumsi penyesuaian manual (§23.5).
      initialRequirement: ZERO_MONEY,
      finalRequirement: consumption,
    },
  ])

  if (finalReq.gt(0)) {
    await repo.addUsedAdjustment(tx, phase.id, consumption)
  }

  await audit.write(tx, {
    actor: cooId,
    action: 'rkap_manual_adjust',
    target: inserted!.id,
    details: {
      phaseId: phase.id,
      kind: 'new_item',
      name: newItem.name,
      capitalType: newItem.capitalType,
      finalRequirement: consumption,
    },
  })
}

// ---------------------------------------------------------------------------
// rebalance (FR-23 §23.9) — dipanggil in-tx
// ---------------------------------------------------------------------------

/**
 * Rebalancing MRO (FR-23 §23.9): merelokasi Final Requirement HANYA antar
 * Capital Item ber-Capital Type SAMA, tertaut MoM (`momRef`). Rencana harus
 * net-zero (Σ delta = 0) dan seluruh item pada satu Capital Type yang sama;
 * jika tidak, ditolak (`REBALANCE_INVALID`). Karena net-zero, akumulasi
 * penyesuaian fase (`instantAdjustmentUsed`) TIDAK berubah. Audit
 * 'rkap_rebalance' ditulis dengan `momRef`, in-tx (AD-2).
 */
export async function rebalance(
  tx: Tx,
  cooId: Uuid,
  plan: RebalancePlan,
  momRef: Uuid,
): Promise<void> {
  if (plan.moves.length === 0) {
    throw new RkapError(
      'REBALANCE_INVALID',
      'Rencana rebalancing kosong (FR-23 §23.9).',
    )
  }

  // Muat seluruh item rujukan; deteksi duplikat & keberadaan.
  const seen = new Set<Uuid>()
  const items: CapitalItemRow[] = []
  for (const move of plan.moves) {
    if (seen.has(move.capitalItemId)) {
      throw new RkapError(
        'REBALANCE_INVALID',
        `Capital Item ${move.capitalItemId} dirujuk lebih dari sekali pada rebalancing (FR-23 §23.9).`,
      )
    }
    seen.add(move.capitalItemId)

    const item = await repo.findItemById(tx, move.capitalItemId)
    if (!item) {
      throw new RkapError(
        'ITEM_NOT_FOUND',
        `Capital Item ${move.capitalItemId} tidak ditemukan untuk rebalancing (FR-23 §23.9).`,
      )
    }
    items.push(item)
  }

  // Semua item wajib satu Capital Type & satu fase yang sama (§23.9).
  const capitalType = items[0]!.capitalType
  const phaseId = items[0]!.phaseId
  for (const item of items) {
    if (item.capitalType !== capitalType) {
      throw new RkapError(
        'REBALANCE_INVALID',
        `Rebalancing hanya antar Capital Item ber-Capital Type sama; ditemukan "${item.capitalType}" ≠ "${capitalType}" (FR-23 §23.9).`,
      )
    }
    if (item.phaseId !== phaseId) {
      throw new RkapError(
        'REBALANCE_INVALID',
        'Rebalancing hanya antar Capital Item pada fase yang sama (FR-23 §23.9).',
      )
    }
  }

  // Net keseluruhan harus nol (relokasi murni, §23.9).
  const net = plan.moves.reduce(
    (acc, m) => acc.plus(new Decimal(m.delta)),
    new Decimal(0),
  )
  if (!net.isZero()) {
    throw new RkapError(
      'REBALANCE_INVALID',
      `Rebalancing wajib net-zero (Σ perpindahan = 0); Σ = ${toMoney(net)} (FR-23 §23.9).`,
    )
  }

  // Terapkan target Final Requirement per item; tolak bila menghasilkan negatif.
  for (let i = 0; i < plan.moves.length; i++) {
    const move = plan.moves[i]!
    const item = items[i]!
    const target = new Decimal(item.finalRequirement).plus(new Decimal(move.delta))
    if (target.lt(0)) {
      throw new RkapError(
        'REBALANCE_INVALID',
        `Rebalancing membuat Final Requirement Capital Item ${item.id} menjadi negatif (FR-23 §23.9).`,
      )
    }
    await repo.setFinalRequirement(tx, item.id, toMoney(target))
  }

  await audit.write(tx, {
    actor: cooId,
    action: 'rkap_rebalance',
    target: phaseId,
    details: {
      momRef,
      capitalType,
      moves: plan.moves.map((m) => ({
        capitalItemId: m.capitalItemId,
        delta: toMoney(new Decimal(m.delta)),
      })),
    },
  })
}

// ---------------------------------------------------------------------------
// Pembantu penyesuaian (validasi fase & batas agregat)
// ---------------------------------------------------------------------------

/** Memuat fase berdasar id atau melempar `PHASE_NOT_FOUND`. */
async function requirePhase(tx: Tx, phaseId: Uuid): Promise<PhaseRow> {
  const phase = await repo.findPhaseById(tx, phaseId)
  if (!phase) {
    throw new RkapError('PHASE_NOT_FOUND', `Fase RKAP ${phaseId} tidak ditemukan.`)
  }
  return phase
}

/** Memuat fase aktif atau melempar `PHASE_NOT_FOUND` (untuk item baru manual). */
async function requireActivePhase(tx: Tx): Promise<PhaseRow> {
  const phase = await repo.findActivePhase(tx)
  if (!phase) {
    throw new RkapError('PHASE_NOT_FOUND', 'Tidak ada fase RKAP aktif.')
  }
  return phase
}

/**
 * Menjamin tambahan konsumsi `consumption` tidak membuat akumulasi penyesuaian
 * melewati batas agregat fase (§23.6/§23.7). Bila melewati, tolak dengan
 * `ADJUSTMENT_EXCEEDS_LIMIT` dan sertakan sisa kuota pada pesan (§23.7).
 */
function assertWithinBudget(phase: PhaseRow, consumption: MoneyString): void {
  const budget = new Decimal(phase.instantAdjustmentBudget)
  const used = new Decimal(phase.instantAdjustmentUsed)
  const remaining = Decimal.max(budget.minus(used), new Decimal(0))
  if (new Decimal(consumption).gt(remaining)) {
    throw new RkapError(
      'ADJUSTMENT_EXCEEDS_LIMIT',
      `Batas penyesuaian fase telah tercapai. Sisa kuota penyesuaian: ${toMoney(remaining)} (FR-23 §23.7).`,
    )
  }
}
