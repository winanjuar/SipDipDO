// server/domain/distribution/distribution.service.ts
//
// Orkestrasi domain DISTRIBUTION (FR-16). Menegakkan:
//   - simulate          : perhitungan MURNI rekap distribusi (tanpa DB) via
//                         shared/domain (§16.1–§16.6). Menerima data Owner
//                         (Portion + poin) langsung agar dapat diuji tanpa DB.
//   - assembleInput     : pembantu (baca DB) yang merakit `DistributionInput`
//                         dari posisi ledger (Portion via cutPointSnapshot) &
//                         poin Contribution terfinalkan-belum-ditunaikan (§16.7).
//   - saveRecap         : SATU transaksi atomik (AD-2) — merakit rekap dari
//                         posisi TERKINI, menyimpan snapshot IMUTABEL
//                         (profit_distributions + lines), menandai Insentif
//                         tertunaikan (redeemed=true) & mem-flip Owner tanpa
//                         saham menjadi Keluar (§16.8/§13.6), menulis audit
//                         'distribution_recap' (§16.9).
//   - compareToPrevious : READ-ONLY — membandingkan rekap dengan yang sebelumnya
//                         (berdasar createdAt); mengembalikan delta per pool/Owner.
//
// Semua aritmetika uang/rasio melewati pembungkus decimal terpin (AD-10):
// `toMoney`/`toRatio` dan formula bersama di shared/domain/distribution.
//
// Konvensi transaksi (AD-2): `saveRecap` menerima `tx` dari route (in-tx teratas)
// — TIDAK membuka transaksi sendiri. Pembacaan (`compareToPrevious`,
// `assembleInput`) menerima `tx` opsional; tanpa `tx` memakai `db` bound-schema.

import type { Tx } from '../../utils/db'
import { Decimal, toMoney, toRatio } from '../../../shared/domain/decimal'
import {
  budgetPool,
  dividenOwner,
  insentifOwner,
  labaDibagikan,
} from '../../../shared/domain/distribution'
import { portion as sharedPortion } from '../../../shared/domain/weighting'
import type {
  MoneyString,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'
import { ledger } from '../ledger'
import { identity, IdentityError } from '../identity'
import { audit } from '../audit'
import * as repo from './distribution.repo'
import { DistributionError } from './events'
import type {
  DistributionInput,
  DistributionRecap,
  OwnerDistributionInput,
  OwnerRecapDelta,
  OwnerRecapLine,
  PoolDelta,
  ProfitDistribution,
  RecapComparison,
} from './events'

// ---------------------------------------------------------------------------
// simulate — perhitungan MURNI (tanpa DB), via shared/domain (§16.1–§16.6)
// ---------------------------------------------------------------------------

/**
 * Menghitung rekap distribusi laba secara MURNI (FR-16 §16.1–§16.6) tanpa
 * menyentuh DB. Diberi laba diaudit, laba ditahan, tiga ratio komponen, dan
 * himpunan Owner (Portion + poin), menghitung:
 *   - Laba Dibagikan = laba diaudit − laba ditahan (§16.1).
 *   - tiga budget pool = ratio × Laba Dibagikan (§16.2), pool Charity UTUH (§16.6).
 *   - Dividen Owner = Portion × pool Dividen (§16.4).
 *   - Insentif Owner = (poin Owner ÷ total poin) × pool Insentif (§16.5).
 *   - total hak Owner = Dividen + Insentif.
 *
 * Melempar `INVALID_PROFIT` bila Laba Dibagikan negatif (laba ditahan melebihi
 * laba diaudit), dan `INVALID_RATIOS` bila ada ratio < 0 atau totalnya > 1.
 */
export function simulate(input: DistributionInput): DistributionRecap {
  assertRatios(input)

  const distributableProfit = labaDibagikan(
    input.auditedProfit,
    input.retainedProfit,
  )
  if (new Decimal(distributableProfit).isNegative()) {
    throw new DistributionError(
      'INVALID_PROFIT',
      'Laba Dibagikan negatif: laba ditahan tidak boleh melebihi laba diaudit (FR-16 §16.1).',
      { distributableProfit },
    )
  }

  const charityPool = budgetPool(input.charityRatio, distributableProfit)
  const dividendPool = budgetPool(input.dividendRatio, distributableProfit)
  const incentivePool = budgetPool(input.incentiveRatio, distributableProfit)

  const totalPoints = input.owners.reduce((acc, o) => acc + o.points, 0)

  const lines: OwnerRecapLine[] = input.owners.map((o) => {
    const dividend = dividenOwner(o.portion, dividendPool)
    const incentive = insentifOwner(o.points, totalPoints, incentivePool)
    const total = toMoney(new Decimal(dividend).plus(new Decimal(incentive)))
    return {
      ownerId: o.ownerId,
      portion: o.portion,
      points: o.points,
      dividend,
      incentive,
      total,
    }
  })

  return {
    auditedProfit: input.auditedProfit,
    retainedProfit: input.retainedProfit,
    distributableProfit,
    charityRatio: input.charityRatio,
    dividendRatio: input.dividendRatio,
    incentiveRatio: input.incentiveRatio,
    charityPool,
    dividendPool,
    incentivePool,
    totalPoints,
    lines,
  }
}

// ---------------------------------------------------------------------------
// assembleInput — merakit DistributionInput dari ledger + contribution (baca DB)
// ---------------------------------------------------------------------------

/**
 * Parameter RUPS yang ditetapkan COO (di luar data posisi/poin yang dibaca DB).
 */
export interface AssembleParams {
  auditedProfit: MoneyString
  retainedProfit: MoneyString
  charityRatio: RatioString
  dividendRatio: RatioString
  incentiveRatio: RatioString
  momRef?: Uuid | null
}

/**
 * Merakit `DistributionInput` dari kondisi TERKINI: Portion tiap Owner dari
 * snapshot titik potong ledger (Portion = Σ Shares Owner ÷ grand total Shares)
 * dan poin Insentif dari periode Contribution yang telah difinalkan cut-off &
 * belum ditunaikan (§16.7). Menggabungkan himpunan Owner dari kedua sumber
 * (Owner ber-saham dan/atau ber-poin). Dipakai route sebelum memanggil
 * `simulate`/`saveRecap`; `simulate` sendiri tetap MURNI.
 */
export async function assembleInput(
  params: AssembleParams,
  tx?: Tx,
): Promise<DistributionInput> {
  const snapshot = await ledger.cutPointSnapshot(tx)
  const reader = tx ?? repo.db
  const pointsByOwner = await repo.readFinalizedUnredeemedPoints(reader)

  const owners = mergeOwners(
    snapshot.owners.map((o) => ({
      ownerId: o.ownerId,
      shares: o.totalShares,
    })),
    snapshot.grandTotalShares,
    pointsByOwner.map((p) => ({ ownerId: p.ownerId, points: p.points })),
  )

  return {
    auditedProfit: params.auditedProfit,
    retainedProfit: params.retainedProfit,
    charityRatio: params.charityRatio,
    dividendRatio: params.dividendRatio,
    incentiveRatio: params.incentiveRatio,
    owners,
    momRef: params.momRef ?? null,
  }
}

// ---------------------------------------------------------------------------
// saveRecap — snapshot imutabel + tandai tertunaikan + flip Keluar (AD-2)
// ---------------------------------------------------------------------------

/**
 * Menyimpan rekap distribusi laba sebagai snapshot IMUTABEL dalam transaksi `tx`
 * teratas (AD-2). Langkah:
 *
 *  1. Rakit himpunan Owner dari kondisi TERKINI in-tx: Portion via
 *     `ledger.cutPointSnapshot(tx)` dan poin Insentif via entri Contribution
 *     terfinalkan-belum-ditunaikan (§16.7). Bila `input.owners` telah disuplai
 *     pemanggil, gunakan apa adanya (jalur uji/route yang sudah merakit).
 *  2. Hitung rekap (murni) via `simulate` (§16.1–§16.6).
 *  3. Persist snapshot: `profit_distributions` (header) + `profit_distribution_lines`
 *     (per Owner: Portion/poin/Dividen/Insentif/total) (§16.9).
 *  4. Tandai Insentif TERTUNAIKAN: set `redeemed = true` pada entri Contribution
 *     terfinalkan yang menjadi basis poin (§16.8).
 *  5. Flip Owner tanpa saham yang Insentif-nya ditunaikan → status Keluar
 *     (§16.8/§13.6) via `identity.markExit` (idempoten: transisi ilegal/telah
 *     Keluar diabaikan; Owner ber-saham dilewati).
 *  6. Audit 'distribution_recap' (§16.9) — in-tx.
 *
 * Mengembalikan `ProfitDistribution` (snapshot tersimpan lengkap).
 */
export async function saveRecap(
  tx: Tx,
  cooId: Uuid,
  input: DistributionInput,
): Promise<ProfitDistribution> {
  assertRatios(input)

  // 1. Rakit himpunan Owner + kumpulan entri per Owner (untuk redeemed & Keluar).
  const snapshot = await ledger.cutPointSnapshot(tx)
  const sharesByOwner = new Map<string, number>()
  for (const o of snapshot.owners) sharesByOwner.set(o.ownerId, o.totalShares)

  const finalized = await repo.readFinalizedUnredeemedPoints(tx)
  const entriesByOwner = new Map<string, Uuid[]>()
  for (const f of finalized) entriesByOwner.set(f.ownerId, f.entryIds)

  // Bila pemanggil menyuplai `owners`, hormati (mis. route yang sudah merakit);
  // selain itu, rakit dari posisi TERKINI + poin terfinalkan (§16.7).
  const owners: OwnerDistributionInput[] =
    input.owners.length > 0
      ? input.owners
      : mergeOwners(
          snapshot.owners.map((o) => ({
            ownerId: o.ownerId,
            shares: o.totalShares,
          })),
          snapshot.grandTotalShares,
          finalized.map((f) => ({ ownerId: f.ownerId, points: f.points })),
        )

  const recap = simulate({ ...input, owners })

  // 3. Persist snapshot IMUTABEL (header + rincian).
  const header = await repo.insertDistribution(tx, {
    auditedProfit: recap.auditedProfit,
    retainedProfit: recap.retainedProfit,
    distributableProfit: recap.distributableProfit,
    charityRatio: recap.charityRatio,
    dividendRatio: recap.dividendRatio,
    incentiveRatio: recap.incentiveRatio,
    charityPool: recap.charityPool,
    dividendPool: recap.dividendPool,
    incentivePool: recap.incentivePool,
    momRef: input.momRef ?? null,
  })

  await repo.insertLines(
    tx,
    header.id,
    recap.lines.map((l) => ({
      ownerId: l.ownerId,
      portion: l.portion,
      contributionPoints: l.points,
      dividendAmount: l.dividend,
      incentiveAmount: l.incentive,
      totalAmount: l.total,
    })),
  )

  // 4/5. Tandai Insentif tertunaikan + flip Owner tanpa saham → Keluar.
  const exitedOwners: Uuid[] = []
  for (const line of recap.lines) {
    const entryIds = entriesByOwner.get(line.ownerId) ?? []
    const paidIncentive = new Decimal(line.incentive).greaterThan(0)

    // §16.8: tunaikan poin Insentif (redeemed=true) pada entri terfinalkan.
    if (entryIds.length > 0) {
      await repo.markEntriesRedeemed(tx, entryIds)
    }

    // §16.8/§13.6: Owner TANPA saham yang Insentif-nya ditunaikan → Keluar.
    const shares = sharesByOwner.get(line.ownerId) ?? 0
    if (shares === 0 && paidIncentive) {
      const exited = await tryMarkExit(tx, line.ownerId)
      if (exited) exitedOwners.push(line.ownerId)
    }
  }

  // 6. Audit 'distribution_recap' (§16.9) — in-tx.
  await audit.write(tx, {
    actor: cooId,
    action: 'distribution_recap',
    target: header.id,
    details: {
      distributionId: header.id,
      auditedProfit: recap.auditedProfit,
      retainedProfit: recap.retainedProfit,
      distributableProfit: recap.distributableProfit,
      charityPool: recap.charityPool,
      dividendPool: recap.dividendPool,
      incentivePool: recap.incentivePool,
      totalPoints: recap.totalPoints,
      exitedOwners,
    },
  })

  return {
    id: header.id,
    auditedProfit: recap.auditedProfit,
    retainedProfit: recap.retainedProfit,
    distributableProfit: recap.distributableProfit,
    charityRatio: recap.charityRatio,
    dividendRatio: recap.dividendRatio,
    incentiveRatio: recap.incentiveRatio,
    charityPool: recap.charityPool,
    dividendPool: recap.dividendPool,
    incentivePool: recap.incentivePool,
    totalPoints: recap.totalPoints,
    lines: recap.lines,
    momRef: input.momRef ?? null,
    createdAt: header.createdAt,
  }
}

// ---------------------------------------------------------------------------
// compareToPrevious — READ-ONLY delta per pool/Owner
// ---------------------------------------------------------------------------

/**
 * Membandingkan rekap `recapId` dengan rekap SEBELUMNYA (berdasar `createdAt`)
 * dan mengembalikan delta per pool (Charity/Dividen/Insentif/Laba Dibagikan) dan
 * per Owner (Dividen/Insentif/total). Bila tidak ada rekap sebelumnya,
 * `previousId` = null dan delta dihitung terhadap 0. READ-ONLY (tanpa tulis).
 *
 * Melempar `RECAP_NOT_FOUND` bila rekap `recapId` tidak ada.
 */
export async function compareToPrevious(
  recapId: Uuid,
  tx?: Tx,
): Promise<RecapComparison> {
  const reader = tx ?? repo.db
  const current = await repo.findById(reader, recapId)
  if (!current) {
    throw new DistributionError(
      'RECAP_NOT_FOUND',
      'Rekap distribusi tidak ditemukan (FR-16).',
      { recapId },
    )
  }
  const previous = await repo.findPrevious(reader, recapId)

  return {
    currentId: current.id,
    previousId: previous?.id ?? null,
    charity: poolDelta(current.charityPool, previous?.charityPool),
    dividend: poolDelta(current.dividendPool, previous?.dividendPool),
    incentive: poolDelta(current.incentivePool, previous?.incentivePool),
    distributable: poolDelta(
      current.distributableProfit,
      previous?.distributableProfit,
    ),
    owners: ownerDeltas(current, previous),
  }
}

// ---------------------------------------------------------------------------
// Pembantu internal
// ---------------------------------------------------------------------------

/**
 * Validasi ratio komponen (§16.3): tiap ratio ∈ [0..1] dan totalnya ≤ 1.
 * Melempar `INVALID_RATIOS` bila dilanggar.
 */
function assertRatios(input: DistributionInput): void {
  const ratios = [input.charityRatio, input.dividendRatio, input.incentiveRatio]
  for (const r of ratios) {
    const d = new Decimal(r)
    if (d.isNegative() || d.greaterThan(1)) {
      throw new DistributionError(
        'INVALID_RATIOS',
        'Setiap ratio komponen harus berada pada rentang [0..1] (FR-16 §16.3).',
        { charityRatio: input.charityRatio, dividendRatio: input.dividendRatio, incentiveRatio: input.incentiveRatio },
      )
    }
  }
  const total = new Decimal(input.charityRatio)
    .plus(new Decimal(input.dividendRatio))
    .plus(new Decimal(input.incentiveRatio))
  if (total.greaterThan(1)) {
    throw new DistributionError(
      'INVALID_RATIOS',
      'Total ratio komponen (Charity + Dividen + Insentif) tidak boleh melebihi 1 (FR-16 §16.3).',
      { total: total.toString() },
    )
  }
}

/**
 * Menggabungkan himpunan Owner ber-saham (untuk Portion) dan ber-poin (untuk
 * Insentif) menjadi daftar `OwnerDistributionInput`. Portion dihitung via
 * shared/domain weighting (Σ Shares Owner ÷ grand total Shares). Owner yang
 * hanya punya poin (tanpa saham) tetap tampil dengan Portion 0.
 */
function mergeOwners(
  shareHolders: { ownerId: Uuid; shares: number }[],
  grandTotalShares: number,
  pointHolders: { ownerId: Uuid; points: number }[],
): OwnerDistributionInput[] {
  const sharesByOwner = new Map<string, number>()
  for (const s of shareHolders) sharesByOwner.set(s.ownerId, s.shares)

  const pointsByOwner = new Map<string, number>()
  for (const p of pointHolders) pointsByOwner.set(p.ownerId, p.points)

  const ownerIds = new Set<string>([
    ...sharesByOwner.keys(),
    ...pointsByOwner.keys(),
  ])

  const owners: OwnerDistributionInput[] = []
  for (const id of ownerIds) {
    const shares = sharesByOwner.get(id) ?? 0
    owners.push({
      ownerId: id as Uuid,
      portion: sharedPortion(shares, grandTotalShares),
      points: pointsByOwner.get(id) ?? 0,
    })
  }
  return owners
}

/**
 * Memanggil `identity.markExit` secara defensif (§16.8/§13.6): mengembalikan
 * `true` bila Owner benar-benar di-flip menjadi Keluar. Transisi ilegal (mis.
 * sudah Keluar / bukan 'terverifikasi') atau posisi belum nol diabaikan agar
 * penyimpanan rekap tetap atomik & idempoten. Error tak terduga tetap dilempar.
 */
async function tryMarkExit(tx: Tx, ownerId: Uuid): Promise<boolean> {
  try {
    await identity.markExit(tx, ownerId)
    return true
  } catch (err) {
    if (
      err instanceof IdentityError &&
      (err.code === 'ILLEGAL_TRANSITION' ||
        err.code === 'POSITIONS_NOT_ZERO' ||
        err.code === 'OWNER_NOT_FOUND')
    ) {
      return false
    }
    throw err
  }
}

/** Delta satu pool = current − previous (previous absen → 0). */
function poolDelta(
  current: MoneyString,
  previous: MoneyString | undefined,
): PoolDelta {
  const prev = previous ?? toMoney(0)
  return {
    current,
    previous: prev,
    delta: toMoney(new Decimal(current).minus(new Decimal(prev))),
  }
}

/** Delta per Owner antara rekap terkini & sebelumnya (union ownerId). */
function ownerDeltas(
  current: ProfitDistribution,
  previous: ProfitDistribution | null,
): OwnerRecapDelta[] {
  const prevById = new Map<string, OwnerRecapLine>()
  if (previous) for (const l of previous.lines) prevById.set(l.ownerId, l)

  const ownerIds = new Set<string>([
    ...current.lines.map((l) => l.ownerId as string),
    ...(previous?.lines.map((l) => l.ownerId as string) ?? []),
  ])

  const curById = new Map<string, OwnerRecapLine>()
  for (const l of current.lines) curById.set(l.ownerId, l)

  const deltas: OwnerRecapDelta[] = []
  for (const id of ownerIds) {
    const c = curById.get(id)
    const p = prevById.get(id)
    deltas.push({
      ownerId: id as Uuid,
      dividend: poolDelta(c?.dividend ?? toMoney(0), p?.dividend),
      incentive: poolDelta(c?.incentive ?? toMoney(0), p?.incentive),
      total: poolDelta(c?.total ?? toMoney(0), p?.total),
    })
  }
  return deltas
}
