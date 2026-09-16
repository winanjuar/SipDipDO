// server/domain/contribution/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain contribution (FR-8/FR-9/FR-10).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `ContributionModule`:
//   defineItem(cooId, item, momRef)       — FR-8 (definisi item)
//   recordRealization(cooId, entry)       — FR-9; tolak jika periode final
//   runningPoints(ownerId)                — poin berjalan + carry-over
//   cutOff(tx, cooId, cutOffJakartaDate)  — FR-10; snapshot beku (task 13.2)
//   finalizedUnredeemedPoints(tx)         — basis Insentif AD-10 (task 13.2)
//
// Task 13.1 mengimplementasi HANYA defineItem/recordRealization/runningPoints.
// `cutOff` dan `finalizedUnredeemedPoints` adalah task 13.2 — kontraknya
// dideklarasikan di sini agar pintu ekstensibel, namun BELUM dipasang pada
// objek `contribution` (menambahkannya nanti tidak mengubah tanda tangan yang
// sudah ada).

import type { Tx } from '../../utils/db'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import * as service from './contribution.service'
import type {
  ContributionEntry,
  ContributionItem,
  ContributionItemInput,
  CutOffRecap,
  OwnerPoints,
  PointsView,
  RealizationInput,
} from './events'

/**
 * Kontrak lintas-modul domain contribution (design.md A.4).
 *
 * Task 13.1: `defineItem`, `recordRealization`, `runningPoints`.
 * Task 13.2: `cutOff` (FR-10; snapshot beku imutabel + carry-over) &
 * `finalizedUnredeemedPoints` (basis Insentif AD-10). Keduanya menerima `tx`
 * karena berpartisipasi dalam transaksi lintas modul (AD-2).
 */
export interface ContributionModule {
  defineItem(
    cooId: Uuid,
    item: ContributionItemInput,
    momRef: Uuid,
  ): Promise<ContributionItem> // FR-8
  recordRealization(
    cooId: Uuid,
    entry: RealizationInput,
  ): Promise<ContributionEntry> // FR-9; tolak jika periode final
  runningPoints(ownerId: Uuid): Promise<PointsView> // poin berjalan + carry-over
  cutOff(
    tx: Tx,
    cooId: Uuid,
    cutOffJakartaDate: JakartaDate,
  ): Promise<CutOffRecap> // FR-10; snapshot beku imutabel
  finalizedUnredeemedPoints(tx: Tx): Promise<OwnerPoints[]> // basis Insentif (AD-10)
}

/** Implementasi pintu contribution — objek tunggal yang memenuhi kontrak. */
export const contribution: ContributionModule = {
  defineItem: service.defineItem,
  recordRealization: service.recordRealization,
  runningPoints: service.runningPoints,
  cutOff: service.cutOff,
  finalizedUnredeemedPoints: service.finalizedUnredeemedPoints,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type {
  ContributionItem,
  ContributionEntry,
  ContributionItemInput,
  RealizationInput,
  PointsView,
  CutOffRecap,
  OwnerPoints,
  ContributionErrorCode,
} from './events'
export { ContributionError } from './events'
