// server/domain/distribution/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain DISTRIBUTION (FR-16).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `DistributionModule`:
//   simulate(input)                  — perhitungan MURNI rekap (tanpa persist).
//   saveRecap(tx, cooId, input)      — snapshot imutabel; tandai Insentif
//                                      tertunaikan + flip Owner tanpa saham → Keluar.
//   compareToPrevious(recapId)       — perbandingan READ-ONLY dengan rekap sebelumnya.
//
// Pembantu `assembleInput` diekspos sebagai konvenensi bagi route untuk merakit
// `DistributionInput` dari posisi ledger + poin Contribution terfinalkan (§16.7)
// sebelum memanggil `simulate`; `simulate` sendiri tetap MURNI (dapat diuji tanpa DB).

import type { Tx } from '../../utils/db'
import type { Uuid } from '../../../shared/domain/types'
import * as service from './distribution.service'
import type { AssembleParams } from './distribution.service'
import type {
  DistributionInput,
  DistributionRecap,
  ProfitDistribution,
  RecapComparison,
} from './events'

/** Kontrak lintas-modul domain DISTRIBUTION (design.md A.4). */
export interface DistributionModule {
  /** FR-16 §16.1–§16.6 via shared/domain — perhitungan MURNI, tanpa persist. */
  simulate(input: DistributionInput): DistributionRecap
  /**
   * FR-16 §16.7–§16.9/§13.6 — SATU transaksi atomik: snapshot imutabel rekap,
   * tandai Insentif tertunaikan (redeemed), flip Owner tanpa saham → Keluar,
   * audit 'distribution_recap'.
   */
  saveRecap(
    tx: Tx,
    cooId: Uuid,
    input: DistributionInput,
  ): Promise<ProfitDistribution>
  /** Perbandingan READ-ONLY rekap dengan yang sebelumnya (delta per pool/Owner). */
  compareToPrevious(recapId: Uuid, tx?: Tx): Promise<RecapComparison>
  /**
   * Pembantu (baca DB) merakit `DistributionInput` dari posisi ledger (Portion)
   * & poin Contribution terfinalkan-belum-ditunaikan (§16.7). BUKAN bagian
   * kontrak murni `simulate`; disediakan untuk route.
   */
  assembleInput(params: AssembleParams, tx?: Tx): Promise<DistributionInput>
}

/** Implementasi pintu DISTRIBUTION — objek tunggal yang memenuhi kontrak. */
export const distribution: DistributionModule = {
  simulate: service.simulate,
  saveRecap: service.saveRecap,
  compareToPrevious: service.compareToPrevious,
  assembleInput: service.assembleInput,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type { AssembleParams } from './distribution.service'
export type {
  DistributionInput,
  OwnerDistributionInput,
  DistributionRecap,
  OwnerRecapLine,
  ProfitDistribution,
  RecapComparison,
  OwnerRecapDelta,
  PoolDelta,
  DistributionErrorCode,
} from './events'
export { DistributionError } from './events'
