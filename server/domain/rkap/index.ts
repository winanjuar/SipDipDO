/**
 * RKAP (AD-5) — satu-satunya pintu impor lintas modul untuk fase RKAP,
 * Capital Item, ruang, dan penyesuaian.
 */

// Service exports (Stories 2.4–2.6)
export {
  adjustItem,
  buatFase,
  getFaseWithItems,
  listFases,
  rebalance,
  recordUtilization,
  RkapDomainError,
  tambahItem,
} from './rkap.service'

// Service types
export type {
  AdjustItemResult,
  ListFasesFilter,
  RebalanceResult,
} from './rkap.service'

// Repository functions — phase CRUD (internal use, exposed for flexibility)
export {
  findPhaseById,
  findPhaseByIdForUpdate,
  insertPhase,
  listPhases,
  updatePhaseStatus,
} from './rkap.repo'

// Repository functions — item CRUD (internal use, exposed for flexibility)
export {
  findItemById,
  findItemByIdForUpdate,
  insertItem,
  listItemsByPhase,
  updateItemFinalRequirement,
  updateItemUtilization,
} from './rkap.repo'

// Repository functions — adjustments (internal use, exposed for flexibility)
export {
  insertAdjustment,
  listAdjustmentsByPhase,
} from './rkap.repo'

// Repository functions — aggregation (internal use, exposed for flexibility)
export {
  sumAdjustmentsByPhase,
  sumInitialRequirementsByPhase,
} from './rkap.repo'

// Repository types
export type {
  AdjustmentInsertRow,
  CapitalItemRow,
  CapitalType,
  ItemInsertRow,
  PhaseInsertRow,
  RkapAdjustmentRow,
  RkapPhaseRow,
  RkapPhaseStatus,
} from './rkap.repo'

// Re-export shared domain types and functions (AD-6)
export {
  calculateAchievement,
  calculateAdjustmentLimit,
  calculateAdjustmentRemaining,
  calculateAdjustmentUsedRatio,
  calculateFulfillmentRate,
  calculateHeld,
  calculateQuantityLeft,
  calculateShortfall,
} from '#shared/domain/rkap'

export type {
  AdjustInput,
  CapitalItemWire,
  ItemCreateInput,
  PhaseCreateInput,
  RebalanceInput,
  RkapPhaseSummary,
  RkapPhaseWire,
  UtilizationInput,
} from '#shared/domain/rkap'
