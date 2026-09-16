// server/domain/rkap/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain RKAP (FR-1/FR-23).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `RkapModule`.
//
// Cakupan tugas 9.1: newPhase, getPhaseView, spaceByCapitalType.
// Anggota lain kontrak `RkapModule` (plotAllocation, applyInstantAdjustment,
// manualAdjust, rebalance) adalah tugas 9.2/9.3 dan BELUM diimplementasikan.
// `RkapModule` di bawah sengaja hanya mendeklarasikan tiga fungsi ini agar
// pintu tetap type-safe; tambahkan anggota baru saat tugas 9.2/9.3 dikerjakan
// tanpa mengubah tanda tangan yang sudah ada (extensible).

import type { Tx } from '../../utils/db'
import type {
  CapitalType,
  MoneyString,
  Uuid,
} from '../../../shared/domain/types'
import * as service from './rkap.service'
import type {
  ManualAdjustment,
  NewPhaseInput,
  PlottingPlan,
  RebalancePlan,
  RkapPhase,
  RkapPhaseView,
} from './events'

/**
 * Kontrak lintas-modul domain RKAP (design.md A.4).
 *
 * Cakupan tugas 9.1: newPhase, getPhaseView, spaceByCapitalType.
 * Cakupan tugas 9.2: applyInstantAdjustment, manualAdjust, rebalance.
 * Tugas 9.3 akan menambah: plotAllocation. Struktur ini extensible: cukup tambah
 * anggota baru di interface dan objek `rkap` di bawah tanpa mengubah tanda tangan
 * yang sudah ada.
 */
export interface RkapModule {
  /** FR-23 tabel + agregat + ringkasan batas + Quantity Left (§23.1/§23.13). */
  getPhaseView(phaseId?: Uuid, runningPrice?: MoneyString): Promise<RkapPhaseView>
  /** Σ Final Requirement − Fulfillment (efektif saja) per Capital Type (§23.2). */
  spaceByCapitalType(
    tx: Tx,
    phaseId: Uuid,
  ): Promise<Record<CapitalType, MoneyString>>
  /**
   * Plotting alokasi Fulfillment transaksi efektif ke Capital Item (§23.10/
   * §23.11/§23.12): naikkan kolom Fulfillment; FIFO default bila `plan` kosong;
   * tolak bila melebihi Final Requirement. Dipanggil in-tx dari finalisasi ledger.
   */
  plotAllocation(tx: Tx, ledgerTxId: Uuid, plan?: PlottingPlan): Promise<void>
  /**
   * Rencana plotting FIFO default (§23.12) untuk transaksi ledger: isi Capital
   * Item fase aktif tertua-lebih-dulu hingga Final Requirement. Pembantu murni
   * yang membaca fase aktif; dipanggil in-tx sebelum `plotAllocation`.
   */
  defaultFifoPlot(tx: Tx, ledgerTxId: Uuid): Promise<PlottingPlan>
  /** Tetapkan fase RKAP baru; kunci Initial Requirement (§23.3). */
  newPhase(cooId: Uuid, phase: NewPhaseInput, momRef: Uuid): Promise<RkapPhase>
  /**
   * Penyesuaian instant otomatis (§23.9): naikkan Final Requirement Capital Item
   * ter-plot sebesar overshoot & akumulasi penyesuaian fase, in-tx. Dipanggil
   * dari finalisasi ledger.
   */
  applyInstantAdjustment(
    tx: Tx,
    capitalItemId: Uuid,
    overshoot: MoneyString,
  ): Promise<void>
  /**
   * Penyesuaian manual COO (§23.5/§23.7): hanya menaikkan Final Requirement item
   * eksisting atau menambah Capital Item baru; tolak bila melewati batas fase.
   */
  manualAdjust(tx: Tx, cooId: Uuid, adjustment: ManualAdjustment): Promise<void>
  /**
   * Rebalancing MRO (§23.9): relokasi Final Requirement antar Capital Item
   * sejenis (net-zero), tertaut MoM.
   */
  rebalance(
    tx: Tx,
    cooId: Uuid,
    plan: RebalancePlan,
    momRef: Uuid,
  ): Promise<void>
}

/** Implementasi pintu RKAP — objek tunggal yang memenuhi `RkapModule`. */
export const rkap: RkapModule = {
  getPhaseView: service.getPhaseView,
  spaceByCapitalType: service.spaceByCapitalType,
  plotAllocation: service.plotAllocation,
  defaultFifoPlot: service.defaultFifoPlot,
  newPhase: service.newPhase,
  applyInstantAdjustment: service.applyInstantAdjustment,
  manualAdjust: service.manualAdjust,
  rebalance: service.rebalance,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type {
  NewPhaseInput,
  NewCapitalItemInput,
  ManualAdjustment,
  RebalancePlan,
  RebalanceMove,
  PlottingPlan,
  PlottingAllocation,
  RkapPhase,
  RkapPhaseView,
  CapitalItemView,
  RkapAggregates,
  AdjustmentLimitSummary,
  CapitalTypeSpaceView,
  RkapErrorCode,
} from './events'
export { RkapError } from './events'
