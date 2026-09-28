/**
 * RKAP — rkap.repo: satu-satunya tempat query Drizzle untuk `rkap_phases`,
 * `capital_items`, dan `rkap_adjustments` (AD-5). Nilai uang `numeric(18,2)`
 * disimpan dan dibaca sebagai string desimal (AD-10).
 *
 * Seluruh fungsi menerima `DbClient` (db atau tx) — penulisan selalu join
 * transaksi pemanggil (AD-3). Hanya modul RKAP yang menulis tabel ini.
 *
 * **Validates: Requirements 5, 7, 8, 9**
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { capitalItems, moms, rkapAdjustments, rkapPhases } from '../../../drizzle/schema'
import type { DbClient, Tx } from '../../utils/db'
import type { CapitalType, RkapPhaseStatus } from '../../../shared/domain/rkap'

// Re-export types from shared domain for consumers of this module
export type { CapitalType, RkapPhaseStatus } from '../../../shared/domain/rkap'

// ---------------------------------------------------------------------------
// Wire Types (Database Row → API Contract)
// ---------------------------------------------------------------------------

/**
 * Wire type untuk fase RKAP — dari baris database ke lapis tampilan.
 * Termasuk info MoM terkait untuk display.
 */
export interface RkapPhaseRow {
  id: string
  name: string
  status: RkapPhaseStatus
  momId: string
  momTitle: string
  createdAt: string
  updatedAt: string
}

/**
 * Wire type untuk Capital Item — dari baris database ke lapis tampilan.
 * Nilai uang sebagai string desimal (AD-10).
 */
export interface CapitalItemRow {
  id: string
  phaseId: string
  name: string
  capitalType: CapitalType
  /** Nilai rupiah rencana awal — dikunci saat MRO menetapkan fase. */
  initialRequirement: string
  /** Nilai rupiah setelah penyesuaian. */
  finalRequirement: string
  /** Realisasi penggunaan modal per Capital Item yang diinput COO. */
  utilization: string
  createdAt: string
  updatedAt: string
}

/**
 * Wire type untuk penyesuaian RKAP — dari baris database ke lapis tampilan.
 * Nilai uang sebagai string desimal (AD-10).
 */
export interface RkapAdjustmentRow {
  id: string
  phaseId: string
  itemId: string | null
  adjustmentType: string
  /** Jumlah penyesuaian — positif untuk penambahan, negatif untuk pengurangan. */
  amount: string
  momId: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Input Types (Service → Repository)
// ---------------------------------------------------------------------------

/** Input insert fase RKAP baru — dari service. */
export interface PhaseInsertRow {
  name: string
  momId: string
}

/** Input insert Capital Item baru — dari service. */
export interface ItemInsertRow {
  phaseId: string
  name: string
  capitalType: CapitalType
  /** Nilai rupiah — string desimal numeric(18,2). */
  initialRequirement: string
  /** Nilai rupiah — string desimal numeric(18,2). */
  finalRequirement: string
}

/** Input insert penyesuaian RKAP — dari service. */
export interface AdjustmentInsertRow {
  phaseId: string
  itemId?: string | null
  adjustmentType: string
  /** Jumlah penyesuaian — string desimal numeric(18,2). */
  amount: string
  momId?: string | null
}

// ---------------------------------------------------------------------------
// Mapper Functions
// ---------------------------------------------------------------------------

/** Pemetaan baris DB fase + MoM → bentuk wire. */
function mapPhaseToRow(
  row: typeof rkapPhases.$inferSelect,
  momTitle: string,
): RkapPhaseRow {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    momId: row.momId,
    momTitle,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Pemetaan baris DB Capital Item → bentuk wire. */
function mapItemToRow(row: typeof capitalItems.$inferSelect): CapitalItemRow {
  return {
    id: row.id,
    phaseId: row.phaseId,
    name: row.name,
    capitalType: row.capitalType,
    initialRequirement: row.initialRequirement,
    finalRequirement: row.finalRequirement,
    utilization: row.utilization,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Pemetaan baris DB penyesuaian → bentuk wire. */
function mapAdjustmentToRow(row: typeof rkapAdjustments.$inferSelect): RkapAdjustmentRow {
  return {
    id: row.id,
    phaseId: row.phaseId,
    itemId: row.itemId,
    adjustmentType: row.adjustmentType,
    amount: row.amount,
    momId: row.momId,
    createdAt: row.createdAt,
  }
}

// ---------------------------------------------------------------------------
// Phase CRUD Functions
// ---------------------------------------------------------------------------

/**
 * Sisipkan fase RKAP baru — mengembalikan baris yang dibuat.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * **Validates: Requirements 5**
 */
export async function insertPhase(
  tx: Tx,
  row: PhaseInsertRow,
): Promise<RkapPhaseRow> {
  const [inserted] = await tx.insert(rkapPhases).values({
    name: row.name,
    momId: row.momId,
  }).returning()

  if (!inserted) throw new Error('insertPhase: gagal menyisipkan fase RKAP.')

  // Ambil judul MoM untuk wire
  const [mom] = await tx.select({ title: moms.title }).from(moms).where(eq(moms.id, inserted.momId))
  const momTitle = mom?.title ?? ''

  return mapPhaseToRow(inserted, momTitle)
}

/**
 * Cari fase RKAP berdasarkan ID — null bila tidak ditemukan.
 *
 * **Validates: Requirements 5**
 */
export async function findPhaseById(
  db: DbClient,
  id: string,
): Promise<RkapPhaseRow | null> {
  const rows = await db.select({
    phase: rkapPhases,
    momTitle: moms.title,
  })
    .from(rkapPhases)
    .innerJoin(moms, eq(rkapPhases.momId, moms.id))
    .where(eq(rkapPhases.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return mapPhaseToRow(row.phase, row.momTitle)
}

/**
 * Cari fase RKAP berdasarkan ID dengan row lock (SELECT FOR UPDATE).
 * Untuk validasi batas penyesuaian dalam transaksi (AD-2).
 *
 * Menggunakan raw SQL dengan FOR UPDATE clause untuk pessimistic locking.
 * Ini mencegah race condition saat multiple transactions mencoba
 * menyesuaikan fase yang sama secara bersamaan.
 *
 * **Validates: Requirements 9**
 */
export async function findPhaseByIdForUpdate(
  tx: Tx,
  id: string,
): Promise<RkapPhaseRow | null> {
  // Use raw SQL to acquire row lock with FOR UPDATE
  const rows = await tx.execute<{
    id: string
    name: string
    status: RkapPhaseStatus
    mom_id: string
    mom_title: string
    created_at: string
    updated_at: string
  }>(sql`
    SELECT 
      rp.id,
      rp.name,
      rp.status,
      rp.mom_id,
      m.title AS mom_title,
      rp.created_at,
      rp.updated_at
    FROM rkap_phases rp
    INNER JOIN moms m ON rp.mom_id = m.id
    WHERE rp.id = ${id}
    FOR UPDATE OF rp
  `)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    momId: row.mom_id,
    momTitle: row.mom_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * List fase RKAP dengan filter opsional berdasarkan status.
 * Urut createdAt descending (terbaru dulu).
 *
 * **Validates: Requirements 5**
 */
export async function listPhases(
  db: DbClient,
  filter?: { status?: RkapPhaseStatus },
): Promise<RkapPhaseRow[]> {
  const conditions = []
  if (filter?.status) {
    conditions.push(eq(rkapPhases.status, filter.status))
  }

  const rows = await db.select({
    phase: rkapPhases,
    momTitle: moms.title,
  })
    .from(rkapPhases)
    .innerJoin(moms, eq(rkapPhases.momId, moms.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rkapPhases.createdAt))

  return rows.map(r => mapPhaseToRow(r.phase, r.momTitle))
}

/**
 * Update status fase RKAP — mengembalikan baris yang diubah atau null.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * **Validates: Requirements 5**
 */
export async function updatePhaseStatus(
  tx: Tx,
  id: string,
  status: RkapPhaseStatus,
): Promise<RkapPhaseRow | null> {
  const now = new Date().toISOString()

  const [updated] = await tx.update(rkapPhases)
    .set({
      status,
      updatedAt: now,
    })
    .where(eq(rkapPhases.id, id))
    .returning()

  if (!updated) return null

  // Ambil judul MoM untuk wire
  const [mom] = await tx.select({ title: moms.title }).from(moms).where(eq(moms.id, updated.momId))
  const momTitle = mom?.title ?? ''

  return mapPhaseToRow(updated, momTitle)
}

// ---------------------------------------------------------------------------
// Item CRUD Functions
// ---------------------------------------------------------------------------

/**
 * Sisipkan Capital Item baru — mengembalikan baris yang dibuat.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * **Validates: Requirements 5, 8**
 */
export async function insertItem(
  tx: Tx,
  row: ItemInsertRow,
): Promise<CapitalItemRow> {
  const [inserted] = await tx.insert(capitalItems).values({
    phaseId: row.phaseId,
    name: row.name,
    capitalType: row.capitalType,
    initialRequirement: row.initialRequirement,
    finalRequirement: row.finalRequirement,
  }).returning()

  if (!inserted) throw new Error('insertItem: gagal menyisipkan Capital Item.')

  return mapItemToRow(inserted)
}

/**
 * Cari Capital Item berdasarkan ID — null bila tidak ditemukan.
 *
 * **Validates: Requirements 5**
 */
export async function findItemById(
  db: DbClient,
  id: string,
): Promise<CapitalItemRow | null> {
  const [row] = await db.select()
    .from(capitalItems)
    .where(eq(capitalItems.id, id))
    .limit(1)

  if (!row) return null

  return mapItemToRow(row)
}

/**
 * Cari Capital Item berdasarkan ID dengan row lock (SELECT FOR UPDATE).
 * Untuk update atomik dalam transaksi (AD-2).
 *
 * Menggunakan raw SQL dengan FOR UPDATE clause untuk pessimistic locking.
 * Ini mencegah race condition saat multiple transactions mencoba
 * mengubah item yang sama secara bersamaan.
 *
 * **Validates: Requirements 7, 9**
 */
export async function findItemByIdForUpdate(
  tx: Tx,
  id: string,
): Promise<CapitalItemRow | null> {
  // Use raw SQL to acquire row lock with FOR UPDATE
  const rows = await tx.execute<{
    id: string
    phase_id: string
    name: string
    capital_type: CapitalType
    initial_requirement: string
    final_requirement: string
    utilization: string
    created_at: string
    updated_at: string
  }>(sql`
    SELECT 
      id,
      phase_id,
      name,
      capital_type,
      initial_requirement,
      final_requirement,
      utilization,
      created_at,
      updated_at
    FROM capital_items
    WHERE id = ${id}
    FOR UPDATE
  `)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    phaseId: row.phase_id,
    name: row.name,
    capitalType: row.capital_type,
    initialRequirement: row.initial_requirement,
    finalRequirement: row.final_requirement,
    utilization: row.utilization,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * List Capital Items berdasarkan fase RKAP.
 * Urut createdAt ascending (urutan penambahan).
 *
 * **Validates: Requirements 5**
 */
export async function listItemsByPhase(
  db: DbClient,
  phaseId: string,
): Promise<CapitalItemRow[]> {
  const rows = await db.select()
    .from(capitalItems)
    .where(eq(capitalItems.phaseId, phaseId))
    .orderBy(capitalItems.createdAt)

  return rows.map(mapItemToRow)
}

/**
 * Update Final Requirement Capital Item — mengembalikan baris yang diubah.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * **Validates: Requirements 7**
 */
export async function updateItemFinalRequirement(
  tx: Tx,
  id: string,
  newFinalRequirement: string,
): Promise<CapitalItemRow | null> {
  const now = new Date().toISOString()

  const [updated] = await tx.update(capitalItems)
    .set({
      finalRequirement: newFinalRequirement,
      updatedAt: now,
    })
    .where(eq(capitalItems.id, id))
    .returning()

  if (!updated) return null

  return mapItemToRow(updated)
}

/**
 * Update Utilization Capital Item — mengembalikan baris yang diubah.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * **Validates: Requirements 11**
 */
export async function updateItemUtilization(
  tx: Tx,
  id: string,
  utilization: string,
): Promise<CapitalItemRow | null> {
  const now = new Date().toISOString()

  const [updated] = await tx.update(capitalItems)
    .set({
      utilization,
      updatedAt: now,
    })
    .where(eq(capitalItems.id, id))
    .returning()

  if (!updated) return null

  return mapItemToRow(updated)
}

// ---------------------------------------------------------------------------
// Adjustments Functions
// ---------------------------------------------------------------------------

/**
 * Sisipkan penyesuaian RKAP — mengembalikan baris yang dibuat.
 * Wajib dalam transaksi dengan audit entry (AD-3).
 *
 * Jenis penyesuaian (adjustmentType):
 * - `manual_increase`: kenaikan Final Requirement item eksisting (Req-7)
 * - `new_item`: penambahan Capital Item baru ke fase berjalan (Req-8)
 * - `overshoot`: kelebihan transaksi yang melampaui kebutuhan (derived, Epic 3)
 * - `rebalance_out`: pengurangan dari item sumber saat rebalancing (Req-13)
 * - `rebalance_in`: penambahan ke item tujuan saat rebalancing (Req-13)
 *
 * **Validates: Requirements 7, 8, 9**
 */
export async function insertAdjustment(
  tx: Tx,
  row: AdjustmentInsertRow,
): Promise<RkapAdjustmentRow> {
  const [inserted] = await tx.insert(rkapAdjustments).values({
    phaseId: row.phaseId,
    itemId: row.itemId ?? null,
    adjustmentType: row.adjustmentType,
    amount: row.amount,
    momId: row.momId ?? null,
  }).returning()

  if (!inserted) throw new Error('insertAdjustment: gagal menyisipkan penyesuaian RKAP.')

  return mapAdjustmentToRow(inserted)
}

/**
 * List penyesuaian RKAP berdasarkan fase.
 * Urut createdAt ascending (urutan kronologis).
 *
 * **Validates: Requirements 9**
 */
export async function listAdjustmentsByPhase(
  db: DbClient,
  phaseId: string,
): Promise<RkapAdjustmentRow[]> {
  const rows = await db.select()
    .from(rkapAdjustments)
    .where(eq(rkapAdjustments.phaseId, phaseId))
    .orderBy(rkapAdjustments.createdAt)

  return rows.map(mapAdjustmentToRow)
}

// ---------------------------------------------------------------------------
// Aggregation Functions
// ---------------------------------------------------------------------------

/**
 * Jenis penyesuaian yang dihitung terhadap batas agregat (Req-9).
 * 
 * Termasuk:
 * - `manual_increase`: kenaikan Final Requirement item eksisting (Req-7)
 * - `new_item`: penambahan Capital Item baru ke fase berjalan (Req-8)
 * - `overshoot`: kelebihan transaksi yang melampaui kebutuhan (Epic 3)
 * 
 * Tidak termasuk (Req-13: rebalancing tidak dihitung terhadap batas):
 * - `rebalance_out`: pengurangan dari item sumber
 * - `rebalance_in`: penambahan ke item tujuan
 */
const ADJUSTMENT_TYPES_TOWARD_LIMIT = ['manual_increase', 'new_item', 'overshoot'] as const

/**
 * Jumlahkan seluruh penyesuaian fase yang dihitung terhadap batas agregat.
 * 
 * Hanya menjumlahkan tipe: manual_increase, new_item, overshoot.
 * Mengecualikan rebalance_out/rebalance_in karena rebalancing tidak
 * dihitung terhadap batas penyesuaian (Req-13).
 * 
 * Mengembalikan string desimal (AD-10). Mengembalikan "0.00" bila
 * tidak ada penyesuaian.
 *
 * **Validates: Requirements 9**
 */
export async function sumAdjustmentsByPhase(
  db: DbClient,
  phaseId: string,
): Promise<string> {
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${rkapAdjustments.amount}), 0)::numeric(18,2)`,
  })
    .from(rkapAdjustments)
    .where(
      and(
        eq(rkapAdjustments.phaseId, phaseId),
        sql`${rkapAdjustments.adjustmentType} IN ('manual_increase', 'new_item', 'overshoot')`,
      ),
    )

  const total = result[0]?.total ?? '0'
  // Ensure consistent format with 2 decimal places
  return formatDecimal(total)
}

/**
 * Jumlahkan seluruh Initial Requirement item dalam fase.
 * 
 * Digunakan untuk menghitung batas penyesuaian agregat:
 * Adjustment_Limit = (1% × total Initial_Requirement fase) + harga beli 1 saham (Req-9)
 * 
 * Mengembalikan string desimal (AD-10). Mengembalikan "0.00" bila
 * tidak ada item.
 *
 * **Validates: Requirements 9, Req-10**
 */
export async function sumInitialRequirementsByPhase(
  db: DbClient,
  phaseId: string,
): Promise<string> {
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${capitalItems.initialRequirement}), 0)::numeric(18,2)`,
  })
    .from(capitalItems)
    .where(eq(capitalItems.phaseId, phaseId))

  const total = result[0]?.total ?? '0'
  // Ensure consistent format with 2 decimal places
  return formatDecimal(total)
}

/**
 * Format string numerik ke desimal dengan 2 tempat desimal.
 * Menangani kasus edge seperti "0" → "0.00".
 */
function formatDecimal(value: string): string {
  // PostgreSQL COALESCE + ::numeric(18,2) should return proper format,
  // but we ensure consistency for edge cases
  const num = value.trim()
  if (!num || num === '0' || num === '0.0' || num === '0.00') {
    return '0.00'
  }
  // If already has decimal, ensure 2 places
  if (num.includes('.')) {
    const [intPart, decPart] = num.split('.')
    return `${intPart}.${(decPart ?? '').padEnd(2, '0').slice(0, 2)}`
  }
  // No decimal, add .00
  return `${num}.00`
}
