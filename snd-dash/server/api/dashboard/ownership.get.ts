// server/api/dashboard/ownership.get.ts
//
// FR-4 / FR-5 / FR-18 — Data proyeksi tabel kepemilikan + chart dashboard.
//
// Route TIPIS (task 19.2, UI-owned data door): assertSurfaceAccess
// ('dashboard_ownership', §15.7 — terkunci Owner tanpa saham) → rakit baris per
// Owner dari proyeksi `positions` (AD-4) + nama dari `owners` → hitung
// Quantity/Shares/Ceil/Strength/Actual/RTL via shared/domain (AD-6) → Grand Total.
//
// KONTRAK
//   GET /api/dashboard/ownership
//   200: { data: OwnershipDashboard }
//
// Nilai rasio (Strength/Portion) dikembalikan sebagai RatioString berskala tetap
// (fraksi 0..1); nilai uang (Actual) sebagai MoneyString. Klien meng-half-up 2
// desimal saat display (AD-10). Tabel FR-4 hanya memuat Owner dengan transaksi
// efektif (posisi > 0) — konsisten §4.4 (Owner muncul otomatis setelah transaksi
// pertama efektif).

import { db, schema } from '../../utils/db'
import { ledger } from '../../domain/ledger'
import { assertSurfaceAccess } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { defineApiHandler } from '../../utils/http'
import { portion, rtl, strength } from '../../../shared/domain/weighting'
import { Decimal, toMoney } from '../../../shared/domain/decimal'
import type {
  CapitalType,
  MoneyString,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'
import type { Position } from '../../domain/ledger'

const { owners } = schema

const CAPITAL_TYPES: CapitalType[] = [
  'Modal Tetap',
  'Modal Bergerak',
  'Modal Operasional',
]

/** Satu baris kepemilikan per Owner (FR-4 §4.1). */
export interface OwnershipRow {
  ownerId: Uuid
  ownerName: string
  /** Quantity gabungan seluruh Capital Type (integer). */
  quantity: number
  /** Shares gabungan seluruh Capital Type (integer). */
  shares: number
  /** Portion = Σ Shares owner ÷ Grand Total Shares (RatioString fraksi 0..1). */
  portion: RatioString
  /** Ceil gabungan seluruh Capital Type (integer). */
  ceil: number
  /** Strength = Σ Shares ÷ Σ Ceil (RatioString fraksi 0..1). */
  strength: RatioString
  /** Actual = total dana riil disetor (MoneyString). */
  actual: MoneyString
  /** RTL = Floor((Ceil − Shares) ÷ 2) (integer, §4.5). */
  rtl: number
  /** Rincian Shares per Capital Type (untuk donut cincin luar/dalam FR-18 §18.2). */
  sharesByType: Record<CapitalType, number>
  /** Rincian Ceil per Capital Type (untuk stacked bar Big Cap FR-18 §18.3). */
  ceilByType: Record<CapitalType, number>
}

/** Baris Grand Total (FR-4 §4.1/§4.3 — seluruh Owner aktif). */
export interface OwnershipGrandTotal {
  quantity: number
  shares: number
  /** Total Portion (ditampilkan apa adanya; boleh 99,99%/100,01% — Property 2). */
  portion: RatioString
  ceil: number
  /** Strength gabungan seluruh Owner. */
  strength: RatioString
  actual: MoneyString
  rtl: number
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
}

/** Payload dashboard kepemilikan (tabel FR-4 + basis chart FR-5/FR-18). */
export interface OwnershipDashboard {
  rows: OwnershipRow[]
  grandTotal: OwnershipGrandTotal
}

function sumByType(rec: Record<CapitalType, number>): number {
  return CAPITAL_TYPES.reduce((acc, t) => acc + (rec[t] ?? 0), 0)
}

function sumMoney(values: MoneyString[]): MoneyString {
  return toMoney(
    values.reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0)),
  )
}

function emptyByType(): Record<CapitalType, number> {
  return {
    'Modal Tetap': 0,
    'Modal Bergerak': 0,
    'Modal Operasional': 0,
  }
}

export default defineApiHandler(async (event): Promise<{ data: OwnershipDashboard }> => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'dashboard_ownership')

  const positions: Position[] = await ledger.getPositions()

  const nameRows = await db
    .select({ id: owners.id, name: owners.name })
    .from(owners)
  const nameById = new Map<string, string | null>()
  for (const r of nameRows) nameById.set(r.id, r.name)

  // Rakit agregat per Owner dan Grand Total (basis Portion) lebih dulu.
  interface Aggregate {
    ownerId: Uuid
    quantity: number
    shares: number
    ceil: number
    actual: MoneyString
    sharesByType: Record<CapitalType, number>
    ceilByType: Record<CapitalType, number>
  }

  const aggregates: Aggregate[] = []
  let grandShares = 0
  let grandCeil = 0
  let grandQuantity = 0
  const grandActuals: MoneyString[] = []
  const grandSharesByType = emptyByType()
  const grandCeilByType = emptyByType()

  for (const p of positions) {
    const totalShares = sumByType(p.sharesByType)
    const totalCeil = sumByType(p.ceilByType)
    const totalQuantity = sumByType(p.quantityByType)

    // Owner tanpa transaksi efektif tidak muncul di tabel FR-4 (§4.4).
    if (totalShares === 0 && totalCeil === 0 && totalQuantity === 0) continue

    const actual = sumMoney(CAPITAL_TYPES.map((t) => p.actualByType[t]))

    aggregates.push({
      ownerId: p.ownerId,
      quantity: totalQuantity,
      shares: totalShares,
      ceil: totalCeil,
      actual,
      sharesByType: { ...p.sharesByType },
      ceilByType: { ...p.ceilByType },
    })

    grandShares += totalShares
    grandCeil += totalCeil
    grandQuantity += totalQuantity
    grandActuals.push(actual)
    for (const t of CAPITAL_TYPES) {
      grandSharesByType[t] += p.sharesByType[t] ?? 0
      grandCeilByType[t] += p.ceilByType[t] ?? 0
    }
  }

  const rows: OwnershipRow[] = aggregates
    .map((a) => ({
      ownerId: a.ownerId,
      ownerName: nameById.get(a.ownerId) ?? '(Tanpa nama)',
      quantity: a.quantity,
      shares: a.shares,
      portion: portion(a.shares, grandShares),
      ceil: a.ceil,
      strength: strength(a.shares, a.ceil),
      actual: a.actual,
      rtl: rtl(a.ceil, a.shares),
      sharesByType: a.sharesByType,
      ceilByType: a.ceilByType,
    }))
    // Urutkan menurun berdasarkan Shares (Portion) agar chart & tabel stabil.
    .sort((x, y) => y.shares - x.shares || x.ownerName.localeCompare(y.ownerName))

  const grandTotal: OwnershipGrandTotal = {
    quantity: grandQuantity,
    shares: grandShares,
    portion: portion(grandShares, grandShares), // Σ portion (≈ 1) — Property 2
    ceil: grandCeil,
    strength: strength(grandShares, grandCeil),
    actual: sumMoney(grandActuals),
    rtl: rtl(grandCeil, grandShares),
    sharesByType: grandSharesByType,
    ceilByType: grandCeilByType,
  }

  return { data: { rows, grandTotal } }
})
