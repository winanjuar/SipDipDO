/**
 * RKAP — rkap.service: logika bisnis fase RKAP, Capital Item, penyesuaian,
 * dan rebalancing (FR-23, Stories 2.4–2.6).
 *
 * AD Constraints:
 * - AD-2: Validasi batas penyesuaian di dalam transaksi DB untuk menghindari race condition.
 * - AD-3: Entry audit ditulis dalam transaksi DB yang sama dengan aksinya.
 * - AD-5: Hanya modul RKAP yang menulis tabel rkap_phases, capital_items, rkap_adjustments.
 * - AD-6: Kalkulasi murni (adjustment limit, fulfillment rate, achievement, held) ada di shared/domain/rkap.ts.
 * - AD-10: Nilai uang sebagai string desimal numeric(18,2) — tidak pernah Number/parseFloat.
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts):
 *
 *   buatFase(db, input, actorOwnerId)
 *     — Buat fase RKAP baru dengan referensi MoM wajib; audit `rkap-phase-created`.
 *
 *   tambahItem(db, phaseId, input, actorOwnerId)
 *     — Tambah Capital Item ke fase; Initial=Final untuk fase baru, Initial=0 untuk
 *       item baru ke fase berjalan (Req-8). Audit `rkap-item-added`.
 *
 *   adjustItem(db, phaseId, input, actorOwnerId)
 *     — Naikkan Final Requirement item eksisting; validasi batas agregat (Req-9).
 *       Audit `rkap-item-adjusted`.
 *
 *   recordUtilization(db, input, actorOwnerId)
 *     — Input Utilization per Capital Item; audit `rkap-utilization-recorded`.
 *
 *   rebalance(db, phaseId, input, actorOwnerId)
 *     — Relokasi kebutuhan antar Capital Item sejenis; wajib MoM referensi (Req-13).
 *       Audit `rkap-rebalanced`.
 *
 *   listFases(db, filter?)
 *     — Baca daftar fase RKAP dengan filter status opsional.
 *
 *   getFaseWithItems(db, phaseId, currentBuyPrice)
 *     — Baca fase lengkap dengan items dan summary penyesuaian.
 *
 * Invariants (Stories 2.4–2.6 Boundaries):
 * - Fase RKAP wajib tertaut MoM final (Req-14).
 * - Initial Requirement dikunci saat fase aktif (Req-5).
 * - Akumulasi penyesuaian tidak boleh melebihi batas agregat (Req-9).
 * - Rebalancing hanya antar item sejenis dan zero-sum (Req-13).
 * - Entry audit ditulis dalam transaksi DB yang sama dengan aksinya (AD-3).
 *
 * **Validates: Requirements 5, 6, 7, 8, 9, 10, 11, 12, 13, 14**
 */
import type { Db, DbClient, Tx } from '../../utils/db'
import { writeAuditEntry } from '../audit'
import { resolveHargaBerjalan } from '../pricing'
import {
  findItemById,
  findItemByIdForUpdate,
  findPhaseById,
  findPhaseByIdForUpdate,
  insertAdjustment,
  insertItem,
  insertPhase,
  listAdjustmentsByPhase,
  listItemsByPhase,
  listPhases,
  sumAdjustmentsByPhase,
  sumInitialRequirementsByPhase,
  updateItemFinalRequirement,
  updateItemUtilization,
  type CapitalItemRow,
  type RkapPhaseRow,
} from './rkap.repo'
import { findMomById } from '../pricing/mom.repo'
import {
  calculateAchievement,
  calculateAdjustmentLimit,
  calculateAdjustmentRemaining,
  calculateFulfillmentRate,
  calculateHeld,
  calculateQuantityLeft,
  calculateShortfall,
  type AdjustInput,
  type CapitalItemWire,
  type ItemCreateInput,
  type PhaseCreateInput,
  type RebalanceInput,
  type RkapPhaseSummary,
  type RkapPhaseWire,
  type RkapPhaseStatus,
  type UtilizationInput,
} from '#shared/domain/rkap'
import { parseRupiah, MoneyParseError, isPositive, isNonNegative, subtract, add, serializeDecimal, isGreaterThan } from '#shared/domain/money'

// ---------------------------------------------------------------------------
// Domain Error
// ---------------------------------------------------------------------------

/**
 * Error domain untuk aksi RKAP — memudahkan handler membedakan jenis error.
 *
 * Kode error:
 * - NOT_FOUND: Resource tidak ditemukan (fase, item, MoM).
 * - MOM_NOT_FINAL: MoM harus final untuk referensi keputusan (Req-14).
 * - PHASE_NOT_ACTIVE: Fase harus berstatus 'berjalan' untuk operasi.
 * - LIMIT_EXCEEDED: Penyesuaian melebihi batas agregat (Req-9).
 * - TYPE_MISMATCH: Rebalancing harus antar item sejenis (Req-13).
 * - VALIDATION: Input tidak valid.
 */
export class RkapDomainError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'MOM_NOT_FINAL'
      | 'PHASE_NOT_ACTIVE'
      | 'LIMIT_EXCEEDED'
      | 'TYPE_MISMATCH'
      | 'VALIDATION',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RkapDomainError'
  }
}

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

/**
 * Filter untuk listFases.
 */
export interface ListFasesFilter {
  status?: RkapPhaseStatus
}

/**
 * Hasil adjustItem — item yang diubah beserta summary terbaru.
 */
export interface AdjustItemResult {
  item: CapitalItemWire
  summary: RkapPhaseSummary
}

/**
 * Hasil rebalance — kedua item yang terlibat.
 */
export interface RebalanceResult {
  from: CapitalItemWire
  to: CapitalItemWire
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Skala untuk nilai rupiah (numeric(18,2)).
 * Sesuai AD-10.
 */
const RUPIAH_SCALE = 2

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Transformasi CapitalItemRow ke CapitalItemWire dengan kalkulasi derived fields.
 *
 * Fulfillment saat ini = 0 (akan diisi dari plotting ledger di Epic 3).
 * Achievement = null jika Fulfillment = 0.
 *
 * @param row - Baris dari repository
 * @returns Wire type untuk API response
 */
function mapItemToWire(row: CapitalItemRow): CapitalItemWire {
  // TODO(Epic 3): Fulfillment dihitung dari plotting ledger
  const fulfillment = '0.00'

  const fulfillmentRate = calculateFulfillmentRate(fulfillment, row.finalRequirement)
  const shortfall = calculateShortfall(row.finalRequirement, fulfillment)
  const achievement = calculateAchievement(row.utilization, fulfillment)
  const held = calculateHeld(fulfillment, row.utilization)

  return {
    id: row.id,
    name: row.name,
    capitalType: row.capitalType,
    initialRequirement: row.initialRequirement,
    finalRequirement: row.finalRequirement,
    fulfillment,
    fulfillmentRate,
    shortfall,
    utilization: row.utilization,
    achievement: achievement ?? '0.000000', // Display as "0%" when undefined
    held,
  }
}

/**
 * Validasi MoM referensi: harus ada dan berstatus final (Req-14).
 *
 * @param tx - Handle transaksi
 * @param momId - UUID MoM
 * @returns MoM row jika valid
 * @throws RkapDomainError bila MoM tidak ditemukan atau tidak final
 */
async function validateMomReference(
  tx: Tx,
  momId: string,
): Promise<{ id: string; title: string }> {
  const mom = await findMomById(tx, momId)
  if (!mom) {
    throw new RkapDomainError('MoM referensi tidak ditemukan.', 'NOT_FOUND', { momId })
  }
  if (mom.status !== 'final') {
    throw new RkapDomainError(
      'MoM harus berstatus final untuk digunakan sebagai referensi keputusan.',
      'MOM_NOT_FINAL',
      { momId, status: mom.status },
    )
  }
  return { id: mom.id, title: mom.title }
}

/**
 * Validasi dan parse nilai rupiah dari input string.
 *
 * @param input - Nilai rupiah sebagai string
 * @param fieldName - Nama field untuk pesan error
 * @param options - Opsi validasi (allowNegative, requirePositive)
 * @returns Nilai canonical string desimal
 * @throws RkapDomainError bila validasi gagal
 */
function parseAndValidateRupiah(
  input: string,
  fieldName: string,
  options: { allowNegative?: boolean; requirePositive?: boolean } = {},
): string {
  try {
    const parsed = parseRupiah(input)

    if (options.requirePositive && !isPositive(parsed.value)) {
      throw new RkapDomainError(`${fieldName} harus bernilai positif.`, 'VALIDATION', { field: fieldName, value: input })
    }

    if (!options.allowNegative && !isNonNegative(parsed.value)) {
      throw new RkapDomainError(`${fieldName} tidak boleh negatif.`, 'VALIDATION', { field: fieldName, value: input })
    }

    return parsed.value
  } catch (e) {
    if (e instanceof MoneyParseError) {
      throw new RkapDomainError(`${fieldName} tidak valid.`, 'VALIDATION', { field: fieldName, value: input })
    }
    throw e
  }
}

/**
 * Hitung summary penyesuaian untuk fase.
 *
 * @param db - Database client
 * @param phaseId - UUID fase
 * @param currentBuyPrice - Harga beli berjalan (string desimal)
 * @returns RkapPhaseSummary
 */
async function calculatePhaseSummary(
  db: DbClient,
  phaseId: string,
  currentBuyPrice: string,
): Promise<RkapPhaseSummary> {
  const [totalInitial, adjustmentUsed] = await Promise.all([
    sumInitialRequirementsByPhase(db, phaseId),
    sumAdjustmentsByPhase(db, phaseId),
  ])

  const adjustmentLimit = calculateAdjustmentLimit(totalInitial, currentBuyPrice)
  const adjustmentRemaining = calculateAdjustmentRemaining(adjustmentLimit, adjustmentUsed)

  // TODO(Epic 3): Shortfall dihitung dari total kebutuhan - fulfillment
  const totalShortfall = totalInitial // Simplified: assume no fulfillment yet
  const quantityLeft = calculateQuantityLeft(totalShortfall, currentBuyPrice)

  return {
    totalInitialRequirement: totalInitial,
    adjustmentLimit,
    adjustmentUsed,
    adjustmentRemaining,
    quantityLeft,
  }
}

// ---------------------------------------------------------------------------
// Public API — Phase Operations (Task 12.2)
// ---------------------------------------------------------------------------

/**
 * Buat fase RKAP baru dengan referensi MoM wajib.
 *
 * Validasi:
 * - MoM referensi wajib dan harus berstatus final (Req-14).
 * - Nama fase tidak boleh kosong.
 *
 * **Validates: Requirements 5, 14**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param input - Input pembuatan fase (name, momId)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns RkapPhaseWire hasil operasi
 * @throws RkapDomainError bila validasi gagal
 */
export async function buatFase(
  db: Db,
  input: PhaseCreateInput,
  actorOwnerId: string,
): Promise<RkapPhaseWire> {
  // 1. Validate Input
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new RkapDomainError('Nama fase tidak boleh kosong.', 'VALIDATION', { field: 'name' })
  }
  if (!input.momId) {
    throw new RkapDomainError('MoM referensi wajib diisi.', 'VALIDATION', { field: 'momId' })
  }

  // 2. Open Transaction (AD-3: audit in same transaction)
  return await db.transaction(async (tx) => {
    // 3. Validate MoM Reference (Req-14)
    const mom = await validateMomReference(tx, input.momId)

    // 4. Insert Phase
    const phase = await insertPhase(tx, {
      name: trimmedName,
      momId: input.momId,
    })

    // 5. Write Audit Entry (AD-3)
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'rkap-phase-created',
      target: `rkap_phases:${phase.id}`,
      details: {
        phaseId: phase.id,
        phaseName: phase.name,
        momId: phase.momId,
      },
    })

    // 6. Get Current Buy Price for summary calculation
    const priceResult = await resolveHargaBerjalan(tx)
    const currentBuyPrice = priceResult.beli.amount

    // 7. Build Response with empty items and calculated summary
    const summary = await calculatePhaseSummary(tx, phase.id, currentBuyPrice)

    return {
      id: phase.id,
      name: phase.name,
      status: phase.status,
      momId: phase.momId,
      momTitle: mom.title,
      items: [], // No initial items yet
      summary,
    }
  })
}

// ---------------------------------------------------------------------------
// Public API — Item Operations (Task 12.3)
// ---------------------------------------------------------------------------

/**
 * Tambah Capital Item ke fase RKAP.
 *
 * Logika Initial/Final (Req-5, Req-8):
 * - Untuk item pertama saat buat fase: Initial = Final = requirement.
 * - Untuk item baru ke fase berjalan: Initial = 0, Final = requirement.
 *   Nilai penuh item dihitung sebagai penyesuaian agregat fase.
 *
 * Validasi:
 * - Fase harus ada dan berstatus 'berjalan'.
 * - Requirement harus positif.
 * - Jika item baru, validasi batas penyesuaian agregat (Req-9).
 *
 * **Validates: Requirements 5, 8, 9**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param phaseId - UUID fase target
 * @param input - Input pembuatan item (name, capitalType, requirement)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @param isInitialItem - true jika item pertama saat buat fase (Initial = Final)
 * @returns CapitalItemWire hasil operasi
 * @throws RkapDomainError bila validasi gagal
 */
export async function tambahItem(
  db: Db,
  phaseId: string,
  input: ItemCreateInput,
  actorOwnerId: string,
  isInitialItem: boolean = false,
): Promise<CapitalItemWire> {
  // 1. Validate Input
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new RkapDomainError('Nama item tidak boleh kosong.', 'VALIDATION', { field: 'name' })
  }
  if (input.capitalType !== 'tetap' && input.capitalType !== 'bergerak') {
    throw new RkapDomainError('Jenis modal harus "tetap" atau "bergerak".', 'VALIDATION', {
      field: 'capitalType',
      value: input.capitalType,
    })
  }
  const requirement = parseAndValidateRupiah(input.requirement, 'requirement', { requirePositive: true })

  // 2. Open Transaction (AD-3: audit in same transaction)
  return await db.transaction(async (tx) => {
    // 3. Find Phase with row lock (AD-2)
    const phase = await findPhaseByIdForUpdate(tx, phaseId)
    if (!phase) {
      throw new RkapDomainError('Fase RKAP tidak ditemukan.', 'NOT_FOUND', { phaseId })
    }
    if (phase.status !== 'berjalan') {
      throw new RkapDomainError('Fase harus berstatus "berjalan" untuk menambah item.', 'PHASE_NOT_ACTIVE', {
        phaseId,
        status: phase.status,
      })
    }

    // 4. Determine Initial/Final Values (Req-5, Req-8)
    let initialRequirement: string
    let finalRequirement: string

    if (isInitialItem) {
      // Initial item during phase creation: Initial = Final = requirement
      initialRequirement = requirement
      finalRequirement = requirement
    } else {
      // New item to active phase: Initial = 0, Final = requirement
      initialRequirement = '0.00'
      finalRequirement = requirement
    }

    // 5. If NOT initial item, Validate Adjustment Limit (Req-9)
    if (!isInitialItem) {
      // Get current buy price
      const priceResult = await resolveHargaBerjalan(tx)
      const currentBuyPrice = priceResult.beli.amount

      // Get total initial requirements
      const totalInitial = await sumInitialRequirementsByPhase(tx, phaseId)

      // Get current adjustments
      const currentAdjustments = await sumAdjustmentsByPhase(tx, phaseId)

      // Calculate adjustment limit
      const adjustmentLimit = calculateAdjustmentLimit(totalInitial, currentBuyPrice)

      // Calculate new total: currentAdjustments + requirement (new item's full value)
      const newTotal = add(currentAdjustments, requirement)
      const newTotalStr = serializeDecimal(newTotal, RUPIAH_SCALE)

      // Validate: newTotal <= adjustmentLimit
      if (isGreaterThan(newTotal, adjustmentLimit)) {
        const adjustmentRemaining = calculateAdjustmentRemaining(adjustmentLimit, currentAdjustments)
        throw new RkapDomainError(
          'Penyesuaian melebihi batas agregat.',
          'LIMIT_EXCEEDED',
          {
            batas: adjustmentLimit,
            terpakai: currentAdjustments,
            sisa: adjustmentRemaining,
            diminta: requirement,
            totalBaru: newTotalStr,
            langkahLanjut: 'Ajukan ke MRO untuk menambah batas fase.',
          },
        )
      }
    }

    // 6. Insert Item
    const item = await insertItem(tx, {
      phaseId,
      name: trimmedName,
      capitalType: input.capitalType,
      initialRequirement,
      finalRequirement,
    })

    // 7. If NOT initial item, Insert Adjustment Record
    if (!isInitialItem) {
      await insertAdjustment(tx, {
        phaseId,
        itemId: item.id,
        adjustmentType: 'new_item',
        amount: requirement,
      })
    }

    // 8. Write Audit Entry (AD-3)
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'rkap-item-added',
      target: `capital_items:${item.id}`,
      details: {
        phaseId,
        itemId: item.id,
        itemName: trimmedName,
        capitalType: input.capitalType,
        initialRequirement,
        finalRequirement,
      },
    })

    // 9. Return CapitalItemWire
    return mapItemToWire(item)
  })
}

// ---------------------------------------------------------------------------
// Public API — Adjustment Operations (Task 12.4)
// ---------------------------------------------------------------------------

/**
 * Naikkan Final Requirement item eksisting.
 *
 * Validasi batas agregat (Req-9):
 * - Hitung Adjustment_Limit = (1% × total Initial_Requirement fase) + harga beli 1 saham berjalan.
 * - Jumlahkan seluruh penyesuaian fase (otomatis + manual + item baru).
 * - Tolak jika akumulasi melebihi batas dengan Alert Penolakan Terhitung.
 *
 * Validasi dilakukan di dalam transaksi DB dengan row lock (AD-2).
 *
 * **Validates: Requirements 7, 9, 10**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param phaseId - UUID fase
 * @param input - Input penyesuaian (itemId, newFinalRequirement)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns AdjustItemResult dengan item yang diubah dan summary terbaru
 * @throws RkapDomainError bila validasi gagal atau batas terlampaui
 */
export async function adjustItem(
  db: Db,
  phaseId: string,
  input: AdjustInput,
  actorOwnerId: string,
): Promise<AdjustItemResult> {
  // 1. Validate Input
  if (!input.itemId) {
    throw new RkapDomainError('itemId wajib diisi.', 'VALIDATION', { field: 'itemId' })
  }
  const newFinalRequirement = parseAndValidateRupiah(input.newFinalRequirement, 'newFinalRequirement', { requirePositive: true })

  // 2. Open Transaction (AD-3: audit in same transaction)
  return await db.transaction(async (tx) => {
    // 3. Lock Phase (AD-2)
    const phase = await findPhaseByIdForUpdate(tx, phaseId)
    if (!phase) {
      throw new RkapDomainError('Fase RKAP tidak ditemukan.', 'NOT_FOUND', { phaseId })
    }
    if (phase.status !== 'berjalan') {
      throw new RkapDomainError('Fase harus berstatus "berjalan" untuk menyesuaikan item.', 'PHASE_NOT_ACTIVE', {
        phaseId,
        status: phase.status,
      })
    }

    // 4. Find and Lock Item (AD-2)
    const item = await findItemByIdForUpdate(tx, input.itemId)
    if (!item) {
      throw new RkapDomainError('Capital Item tidak ditemukan.', 'NOT_FOUND', { itemId: input.itemId })
    }
    if (item.phaseId !== phaseId) {
      throw new RkapDomainError('Item tidak termasuk dalam fase ini.', 'VALIDATION', {
        itemId: input.itemId,
        itemPhaseId: item.phaseId,
        requestedPhaseId: phaseId,
      })
    }

    // 5. Calculate Adjustment Delta
    const delta = subtract(newFinalRequirement, item.finalRequirement)
    const deltaStr = serializeDecimal(delta, RUPIAH_SCALE)

    // 6. If delta > 0, Validate Adjustment Limit (Req-9)
    if (isPositive(delta)) {
      // Get current buy price
      const priceResult = await resolveHargaBerjalan(tx)
      const currentBuyPrice = priceResult.beli.amount

      // Get total initial requirements
      const totalInitial = await sumInitialRequirementsByPhase(tx, phaseId)

      // Get current adjustments
      const currentAdjustments = await sumAdjustmentsByPhase(tx, phaseId)

      // Calculate adjustment limit
      const adjustmentLimit = calculateAdjustmentLimit(totalInitial, currentBuyPrice)

      // Calculate new total: currentAdjustments + delta
      const newTotal = add(currentAdjustments, delta)
      const newTotalStr = serializeDecimal(newTotal, RUPIAH_SCALE)

      // Validate: newTotal <= adjustmentLimit
      if (isGreaterThan(newTotal, adjustmentLimit)) {
        const adjustmentRemaining = calculateAdjustmentRemaining(adjustmentLimit, currentAdjustments)
        throw new RkapDomainError(
          'Penyesuaian melebihi batas agregat.',
          'LIMIT_EXCEEDED',
          {
            batas: adjustmentLimit,
            terpakai: currentAdjustments,
            sisa: adjustmentRemaining,
            diminta: deltaStr,
            totalBaru: newTotalStr,
            langkahLanjut: 'Ajukan ke MRO untuk menambah batas fase.',
          },
        )
      }

      // 7. Update Item Final Requirement
      const updatedItem = await updateItemFinalRequirement(tx, input.itemId, newFinalRequirement)
      if (!updatedItem) {
        throw new RkapDomainError('Gagal memperbarui Final Requirement item.', 'NOT_FOUND', { itemId: input.itemId })
      }

      // 8. Insert Adjustment Record (only for positive delta)
      await insertAdjustment(tx, {
        phaseId,
        itemId: input.itemId,
        adjustmentType: 'manual_increase',
        amount: deltaStr,
      })

      // 9. Write Audit Entry (AD-3)
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: actorOwnerId },
        action: 'rkap-item-adjusted',
        target: `capital_items:${input.itemId}`,
        details: {
          itemId: input.itemId,
          oldValue: item.finalRequirement,
          newValue: newFinalRequirement,
          adjustmentAmount: deltaStr,
        },
      })

      // 10. Calculate Updated Summary
      const summary = await calculatePhaseSummary(tx, phaseId, currentBuyPrice)

      // 11. Return AdjustItemResult
      return {
        item: mapItemToWire(updatedItem),
        summary,
      }
    } else {
      // Delta <= 0: No limit validation needed, just update the item
      // Note: Per task description, we only handle increases — decreasing final requirement
      // doesn't count toward limit but we still need to update the item and audit

      // Get current buy price for summary calculation
      const priceResult = await resolveHargaBerjalan(tx)
      const currentBuyPrice = priceResult.beli.amount

      // 7. Update Item Final Requirement
      const updatedItem = await updateItemFinalRequirement(tx, input.itemId, newFinalRequirement)
      if (!updatedItem) {
        throw new RkapDomainError('Gagal memperbarui Final Requirement item.', 'NOT_FOUND', { itemId: input.itemId })
      }

      // 9. Write Audit Entry (AD-3) - audit even for decreases
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: actorOwnerId },
        action: 'rkap-item-adjusted',
        target: `capital_items:${input.itemId}`,
        details: {
          itemId: input.itemId,
          oldValue: item.finalRequirement,
          newValue: newFinalRequirement,
          adjustmentAmount: deltaStr,
        },
      })

      // 10. Calculate Updated Summary
      const summary = await calculatePhaseSummary(tx, phaseId, currentBuyPrice)

      // 11. Return AdjustItemResult
      return {
        item: mapItemToWire(updatedItem),
        summary,
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Public API — Utilization Operations (Task 12.5)
// ---------------------------------------------------------------------------

/**
 * Input Utilization per Capital Item.
 *
 * Utilization adalah realisasi penggunaan modal di lapangan yang diinput COO.
 * Nilai tersimpan terpisah dari Fulfillment (Req-11).
 *
 * **Validates: Requirements 11, 12**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param input - Input utilization (itemId, utilization)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns CapitalItemWire hasil operasi
 * @throws RkapDomainError bila validasi gagal
 */
export async function recordUtilization(
  db: Db,
  input: UtilizationInput,
  actorOwnerId: string,
): Promise<CapitalItemWire> {
  // 1. Validate Input
  if (!input.itemId) {
    throw new RkapDomainError('itemId wajib diisi.', 'VALIDATION', { field: 'itemId' })
  }
  // Utilization must be non-negative (Req-11: numeric non-negatif)
  const utilization = parseAndValidateRupiah(input.utilization, 'utilization')

  // 2. Open Transaction (AD-3: audit in same transaction)
  return await db.transaction(async (tx) => {
    // 3. Find Item (no lock needed - utilization update is independent)
    const item = await findItemById(tx, input.itemId)
    if (!item) {
      throw new RkapDomainError('Capital Item tidak ditemukan.', 'NOT_FOUND', { itemId: input.itemId })
    }

    // 4. Store Old Value for Audit
    const oldValue = item.utilization

    // 5. Update Item Utilization
    const updatedItem = await updateItemUtilization(tx, input.itemId, utilization)
    if (!updatedItem) {
      throw new RkapDomainError('Gagal memperbarui Utilization item.', 'NOT_FOUND', { itemId: input.itemId })
    }

    // 6. Write Audit Entry (AD-3)
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'rkap-utilization-recorded',
      target: `capital_items:${input.itemId}`,
      details: {
        itemId: input.itemId,
        oldValue,
        newValue: utilization,
      },
    })

    // 7. Return CapitalItemWire
    return mapItemToWire(updatedItem)
  })
}

// ---------------------------------------------------------------------------
// Public API — Rebalancing Operations (Task 12.6)
// ---------------------------------------------------------------------------

/**
 * Relokasi kebutuhan antar Capital Item sejenis.
 *
 * Validasi (Req-13):
 * - Kedua item harus memiliki jenis modal yang sama (Tetap→Tetap, Bergerak→Bergerak).
 * - MoM referensi wajib sebagai bukti keputusan MRO.
 * - Total ruang jenis modal tidak berubah (zero-sum transfer).
 *
 * Rebalancing tidak dihitung terhadap batas penyesuaian agregat.
 *
 * **Validates: Requirements 13, 14**
 *
 * @param db - Database instance untuk membuka transaksi
 * @param phaseId - UUID fase
 * @param input - Input rebalancing (fromItemId, toItemId, amount, momId)
 * @param actorOwnerId - ID owner yang melakukan aksi (untuk audit)
 * @returns RebalanceResult dengan kedua item yang terlibat
 * @throws RkapDomainError bila validasi gagal
 */
export async function rebalance(
  db: Db,
  phaseId: string,
  input: RebalanceInput,
  actorOwnerId: string,
): Promise<RebalanceResult> {
  // 1. Validate Input
  if (!input.fromItemId) {
    throw new RkapDomainError('fromItemId wajib diisi.', 'VALIDATION', { field: 'fromItemId' })
  }
  if (!input.toItemId) {
    throw new RkapDomainError('toItemId wajib diisi.', 'VALIDATION', { field: 'toItemId' })
  }
  if (input.fromItemId === input.toItemId) {
    throw new RkapDomainError('Tidak dapat rebalancing ke item yang sama.', 'VALIDATION', {
      fromItemId: input.fromItemId,
      toItemId: input.toItemId,
    })
  }
  if (!input.momId) {
    throw new RkapDomainError('momId wajib diisi untuk rebalancing.', 'VALIDATION', { field: 'momId' })
  }
  const amount = parseAndValidateRupiah(input.amount, 'amount', { requirePositive: true })

  // 2. Open Transaction (AD-3: audit in same transaction)
  return await db.transaction(async (tx) => {
    // 3. Validate MoM Reference (Req-14)
    await validateMomReference(tx, input.momId)

    // 4. Lock Phase and Validate (AD-2)
    const phase = await findPhaseByIdForUpdate(tx, phaseId)
    if (!phase) {
      throw new RkapDomainError('Fase RKAP tidak ditemukan.', 'NOT_FOUND', { phaseId })
    }
    if (phase.status !== 'berjalan') {
      throw new RkapDomainError('Fase harus berstatus "berjalan" untuk rebalancing.', 'PHASE_NOT_ACTIVE', {
        phaseId,
        status: phase.status,
      })
    }

    // 5. Find and Lock Both Items (AD-2)
    const fromItem = await findItemByIdForUpdate(tx, input.fromItemId)
    if (!fromItem) {
      throw new RkapDomainError('Capital Item sumber tidak ditemukan.', 'NOT_FOUND', { itemId: input.fromItemId })
    }
    if (fromItem.phaseId !== phaseId) {
      throw new RkapDomainError('Item sumber tidak termasuk dalam fase ini.', 'VALIDATION', {
        itemId: input.fromItemId,
        itemPhaseId: fromItem.phaseId,
        requestedPhaseId: phaseId,
      })
    }

    const toItem = await findItemByIdForUpdate(tx, input.toItemId)
    if (!toItem) {
      throw new RkapDomainError('Capital Item tujuan tidak ditemukan.', 'NOT_FOUND', { itemId: input.toItemId })
    }
    if (toItem.phaseId !== phaseId) {
      throw new RkapDomainError('Item tujuan tidak termasuk dalam fase ini.', 'VALIDATION', {
        itemId: input.toItemId,
        itemPhaseId: toItem.phaseId,
        requestedPhaseId: phaseId,
      })
    }

    // 6. Validate Same Capital Type (Req-13)
    if (fromItem.capitalType !== toItem.capitalType) {
      throw new RkapDomainError(
        'Rebalancing hanya dapat dilakukan antar item dengan jenis modal yang sama.',
        'TYPE_MISMATCH',
        {
          fromItemId: input.fromItemId,
          fromCapitalType: fromItem.capitalType,
          toItemId: input.toItemId,
          toCapitalType: toItem.capitalType,
        },
      )
    }

    // 7. Validate From Item Has Enough (Zero-Sum)
    const fromFinalReq = fromItem.finalRequirement
    if (isGreaterThan(amount, fromFinalReq)) {
      throw new RkapDomainError(
        'Jumlah rebalancing melebihi Final Requirement item sumber.',
        'VALIDATION',
        {
          fromItemId: input.fromItemId,
          fromFinalRequirement: fromFinalReq,
          requestedAmount: amount,
        },
      )
    }

    // 8. Update Both Items (Zero-Sum Transfer)
    const newFromFinal = subtract(fromFinalReq, amount)
    const newFromFinalStr = serializeDecimal(newFromFinal, RUPIAH_SCALE)

    const newToFinal = add(toItem.finalRequirement, amount)
    const newToFinalStr = serializeDecimal(newToFinal, RUPIAH_SCALE)

    const updatedFromItem = await updateItemFinalRequirement(tx, input.fromItemId, newFromFinalStr)
    if (!updatedFromItem) {
      throw new RkapDomainError('Gagal memperbarui Final Requirement item sumber.', 'NOT_FOUND', { itemId: input.fromItemId })
    }

    const updatedToItem = await updateItemFinalRequirement(tx, input.toItemId, newToFinalStr)
    if (!updatedToItem) {
      throw new RkapDomainError('Gagal memperbarui Final Requirement item tujuan.', 'NOT_FOUND', { itemId: input.toItemId })
    }

    // 9. Insert Adjustment Records (for tracking, not toward limit)
    // Negate amount for rebalance_out (money leaving the item)
    const negativeAmount = serializeDecimal(subtract('0', amount), RUPIAH_SCALE)

    await insertAdjustment(tx, {
      phaseId,
      itemId: input.fromItemId,
      adjustmentType: 'rebalance_out',
      amount: negativeAmount,
      momId: input.momId,
    })

    await insertAdjustment(tx, {
      phaseId,
      itemId: input.toItemId,
      adjustmentType: 'rebalance_in',
      amount,
      momId: input.momId,
    })

    // 10. Write Audit Entry (AD-3)
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'rkap-rebalanced',
      target: `rkap_phases:${phaseId}`,
      details: {
        fromItemId: input.fromItemId,
        toItemId: input.toItemId,
        amount,
        momId: input.momId,
      },
    })

    // 11. Return RebalanceResult with both updated item wires
    return {
      from: mapItemToWire(updatedFromItem),
      to: mapItemToWire(updatedToItem),
    }
  })
}

// ---------------------------------------------------------------------------
// Public API — Read Operations (Task 12.7)
// ---------------------------------------------------------------------------

/**
 * Baca daftar fase RKAP dengan filter status opsional.
 *
 * Penegakan kewenangan ada di route handler (AD-8).
 *
 * **Validates: Requirements 5, 6**
 *
 * @param db - Database client
 * @param filter - Filter opsional berdasarkan status
 * @returns Array of RkapPhaseRow (tanpa items)
 */
export async function listFases(
  db: DbClient,
  filter?: ListFasesFilter,
): Promise<RkapPhaseRow[]> {
  // Simply delegate to repository - authorization is handled at the route level (AD-8)
  return await listPhases(db, filter)
}

/**
 * Baca fase lengkap dengan items dan summary penyesuaian.
 *
 * Memerlukan currentBuyPrice untuk kalkulasi:
 * - Adjustment Limit = (1% × total Initial) + harga beli 1 saham.
 * - Quantity Left = floor(Shortfall ÷ currentBuyPrice).
 *
 * **Validates: Requirements 5, 10, 12**
 *
 * @param db - Database client
 * @param phaseId - UUID fase
 * @param currentBuyPrice - Harga beli berjalan (string desimal)
 * @returns RkapPhaseWire dengan items dan summary
 * @throws RkapDomainError bila fase tidak ditemukan
 */
export async function getFaseWithItems(
  db: DbClient,
  phaseId: string,
  currentBuyPrice: string,
): Promise<RkapPhaseWire> {
  // 1. Find Phase
  const phase = await findPhaseById(db, phaseId)
  if (!phase) {
    throw new RkapDomainError('Fase RKAP tidak ditemukan.', 'NOT_FOUND', { phaseId })
  }

  // 2. Get Items
  const items = await listItemsByPhase(db, phaseId)

  // 3. Calculate Summary
  const summary = await calculatePhaseSummary(db, phaseId, currentBuyPrice)

  // 4. Build and Return RkapPhaseWire
  return {
    id: phase.id,
    name: phase.name,
    status: phase.status,
    momId: phase.momId,
    momTitle: phase.momTitle,
    items: items.map(mapItemToWire),
    summary,
  }
}
