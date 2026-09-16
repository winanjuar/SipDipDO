// server/domain/distribution/distribution.repo.ts
//
// Lapisan data domain DISTRIBUTION (FR-16). Menerjemahkan penyimpanan snapshot
// rekap, pembacaan rekap + rincian, pencarian rekap sebelumnya, pembacaan poin
// Insentif (poin periode terfinalkan yang belum ditunaikan), dan penandaan
// entri Contribution sebagai tertunaikan (redeemed) ke query Drizzle atas tabel
// `profit_distributions`, `profit_distribution_lines`, `contribution_entries`,
// dan `contribution_periods` (schema.ts). Tidak ada aturan bisnis di sini —
// orkestrasi/validasi/audit ada di `distribution.service.ts`.
//
// Penulisan SELALU menerima handle `tx` (AD-2) — tidak pernah membuka transaksi
// sendiri. Pembacaan menerima `Reader` (Tx maupun `db` bound-schema).
//
// Catatan (task 14.1): poin Insentif dibaca LANGSUNG dari `contribution_entries`
// yang berpasangan dengan `contribution_periods.is_finalized = true` DAN
// `redeemed = false`, agar modul ini SWA-SANTAI (tidak bergantung pada ekspor
// `finalizedUnredeemedPoints` dari modul contribution yang mungkin belum ada,
// task 13.2).

import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { db, schema } from '../../utils/db'
import type { MoneyString, RatioString, Uuid } from '../../../shared/domain/types'
import type { OwnerRecapLine, ProfitDistribution } from './events'

const {
  profitDistributions,
  profitDistributionLines,
  contributionEntries,
  contributionPeriods,
} = schema

/** Pembaca minimal (menerima `Tx` maupun instance `db` bound-schema). */
type Reader = Pick<Tx, 'select'>

// ---------------------------------------------------------------------------
// Tipe INSERT snapshot rekap
// ---------------------------------------------------------------------------

/** Nilai INSERT satu baris `profit_distributions` (header snapshot). */
export interface InsertDistribution {
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  distributableProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  charityPool: MoneyString
  dividendPool: MoneyString
  incentivePool: MoneyString
  momRef: Uuid | null
}

/** Nilai INSERT satu baris `profit_distribution_lines` (rincian per Owner). */
export interface InsertDistributionLine {
  ownerId: Uuid
  portion: RatioString
  contributionPoints: number
  dividendAmount: MoneyString
  incentiveAmount: MoneyString
  totalAmount: MoneyString
}

/**
 * Poin Insentif seorang Owner dari periode terfinalkan yang belum ditunaikan
 * (basis §16.5/§16.7), beserta id entri yang menyumbang agar dapat ditandai
 * tertunaikan (redeemed) saat rekap disimpan (§16.8).
 */
export interface OwnerFinalizedPoints {
  ownerId: Uuid
  points: number
  entryIds: Uuid[]
}

// ---------------------------------------------------------------------------
// Pemeta baris → tipe lapisan data
// ---------------------------------------------------------------------------

function toLine(r: typeof profitDistributionLines.$inferSelect): OwnerRecapLine {
  return {
    ownerId: r.ownerId as Uuid,
    portion: r.portion as RatioString,
    points: r.contributionPoints,
    dividend: r.dividendAmount as MoneyString,
    incentive: r.incentiveAmount as MoneyString,
    total: r.totalAmount as MoneyString,
  }
}

function toDistribution(
  header: typeof profitDistributions.$inferSelect,
  lines: OwnerRecapLine[],
): ProfitDistribution {
  return {
    id: header.id as Uuid,
    auditedProfit: header.auditedProfit as MoneyString,
    retainedProfit: header.retainedProfit as MoneyString,
    distributableProfit: header.distributableProfit as MoneyString,
    charityRatio: header.charityRatio as RatioString,
    dividendRatio: header.dividendRatio as RatioString,
    incentiveRatio: header.incentiveRatio as RatioString,
    charityPool: header.charityPool as MoneyString,
    dividendPool: header.dividendPool as MoneyString,
    incentivePool: header.incentivePool as MoneyString,
    totalPoints: lines.reduce((acc, l) => acc + l.points, 0),
    lines,
    momRef: (header.momRef as Uuid | null) ?? null,
    createdAt: header.createdAt,
  }
}

// ---------------------------------------------------------------------------
// Penulisan snapshot rekap (SELALU in-tx, AD-2)
// ---------------------------------------------------------------------------

/** Menyisipkan header `profit_distributions` DI DALAM transaksi `tx`. */
export async function insertDistribution(
  tx: Tx,
  values: InsertDistribution,
): Promise<{ id: Uuid; createdAt: Date }> {
  const [row] = await tx
    .insert(profitDistributions)
    .values({
      auditedProfit: values.auditedProfit,
      retainedProfit: values.retainedProfit,
      distributableProfit: values.distributableProfit,
      charityRatio: values.charityRatio,
      dividendRatio: values.dividendRatio,
      incentiveRatio: values.incentiveRatio,
      charityPool: values.charityPool,
      dividendPool: values.dividendPool,
      incentivePool: values.incentivePool,
      momRef: values.momRef,
    })
    .returning({
      id: profitDistributions.id,
      createdAt: profitDistributions.createdAt,
    })

  // `returning()` selalu memberi satu baris pada INSERT sukses.
  return { id: row!.id as Uuid, createdAt: row!.createdAt }
}

/**
 * Menyisipkan sekumpulan rincian `profit_distribution_lines` untuk sebuah rekap
 * DI DALAM transaksi `tx`. No-op bila `lines` kosong.
 */
export async function insertLines(
  tx: Tx,
  distributionId: Uuid,
  lines: InsertDistributionLine[],
): Promise<void> {
  if (lines.length === 0) return
  await tx.insert(profitDistributionLines).values(
    lines.map((l) => ({
      distributionId,
      ownerId: l.ownerId,
      portion: l.portion,
      contributionPoints: l.contributionPoints,
      dividendAmount: l.dividendAmount,
      incentiveAmount: l.incentiveAmount,
      totalAmount: l.totalAmount,
    })),
  )
}

// ---------------------------------------------------------------------------
// Pembacaan rekap tersimpan
// ---------------------------------------------------------------------------

/** Membaca header rekap berdasar id (tanpa rincian). Null bila tidak ada. */
async function findHeaderById(
  reader: Reader,
  id: Uuid,
): Promise<typeof profitDistributions.$inferSelect | null> {
  const rows = await reader
    .select()
    .from(profitDistributions)
    .where(eq(profitDistributions.id, id))
    .limit(1)
  return rows[0] ?? null
}

/** Membaca rincian per Owner sebuah rekap, terurut pembuatan. */
async function findLinesByDistribution(
  reader: Reader,
  distributionId: Uuid,
): Promise<OwnerRecapLine[]> {
  const rows = await reader
    .select()
    .from(profitDistributionLines)
    .where(eq(profitDistributionLines.distributionId, distributionId))
    .orderBy(profitDistributionLines.createdAt)
  return rows.map(toLine)
}

/** Membaca satu rekap lengkap (header + rincian) berdasar id. */
export async function findById(
  reader: Reader,
  id: Uuid,
): Promise<ProfitDistribution | null> {
  const header = await findHeaderById(reader, id)
  if (!header) return null
  const lines = await findLinesByDistribution(reader, header.id as Uuid)
  return toDistribution(header, lines)
}

/**
 * Membaca rekap SEBELUMNYA relatif terhadap rekap `id` (berdasar `createdAt`,
 * lalu `id` sebagai pemecah seri). Null bila rekap `id` tidak ada atau tidak ada
 * rekap yang lebih lama.
 */
export async function findPrevious(
  reader: Reader,
  id: Uuid,
): Promise<ProfitDistribution | null> {
  const current = await findHeaderById(reader, id)
  if (!current) return null

  const rows = await reader
    .select()
    .from(profitDistributions)
    .where(lt(profitDistributions.createdAt, current.createdAt))
    .orderBy(sql`${profitDistributions.createdAt} DESC`)
    .limit(1)

  const prev = rows[0]
  if (!prev) return null
  const lines = await findLinesByDistribution(reader, prev.id as Uuid)
  return toDistribution(prev, lines)
}

// ---------------------------------------------------------------------------
// Poin Insentif — periode terfinalkan & belum ditunaikan (§16.7)
// ---------------------------------------------------------------------------

/**
 * Membaca poin Insentif per Owner dari `contribution_entries` yang berpasangan
 * dengan `contribution_periods.is_finalized = true` DAN `redeemed = false`
 * (basis §16.5/§16.7). Mengembalikan Σ poin + id entri penyumbang per Owner
 * (agar dapat ditandai tertunaikan pada §16.8).
 *
 * Dibaca langsung dari tabel (bukan lewat modul contribution) agar task 14.1
 * swa-santai terhadap task 13.2.
 */
export async function readFinalizedUnredeemedPoints(
  reader: Reader,
): Promise<OwnerFinalizedPoints[]> {
  const rows = await reader
    .select({
      id: contributionEntries.id,
      ownerId: contributionEntries.ownerId,
      points: contributionEntries.points,
    })
    .from(contributionEntries)
    .innerJoin(
      contributionPeriods,
      eq(contributionEntries.periodId, contributionPeriods.id),
    )
    .where(
      and(
        eq(contributionEntries.redeemed, false),
        eq(contributionPeriods.isFinalized, true),
      ),
    )

  const byOwner = new Map<string, OwnerFinalizedPoints>()
  for (const r of rows) {
    const key = r.ownerId as string
    const existing = byOwner.get(key)
    if (existing) {
      existing.points += r.points
      existing.entryIds.push(r.id as Uuid)
    } else {
      byOwner.set(key, {
        ownerId: r.ownerId as Uuid,
        points: r.points,
        entryIds: [r.id as Uuid],
      })
    }
  }
  return [...byOwner.values()]
}

/**
 * Menandai sekumpulan entri Contribution sebagai tertunaikan (`redeemed = true`)
 * DI DALAM transaksi `tx` (§16.8). No-op bila `entryIds` kosong. Mengembalikan
 * jumlah baris yang benar-benar berubah (guard idempoten: hanya yang masih
 * `redeemed = false`).
 */
export async function markEntriesRedeemed(
  tx: Tx,
  entryIds: Uuid[],
): Promise<number> {
  if (entryIds.length === 0) return 0
  const updated = await tx
    .update(contributionEntries)
    .set({ redeemed: true })
    .where(
      and(
        inArray(contributionEntries.id, entryIds),
        eq(contributionEntries.redeemed, false),
      ),
    )
    .returning({ id: contributionEntries.id })
  return updated.length
}

// Instance `db` bound-schema di-reexport agar service dapat memakai pembacaan
// di luar transaksi (compareToPrevious/simulate assemble) tanpa mengimpor db lagi.
export { db }
