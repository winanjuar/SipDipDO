// server/domain/contribution/contribution.service.ts
//
// Orkestrasi domain contribution (FR-8/FR-9). Menegakkan:
//   - defineItem        : simpan nama, deskripsi, poin kuantitatif, periode
//                         berlaku, dan tautan MoM penetap (FR-8 §8.1/§8.2);
//                         audit 'contribution_item_defined' in-tx (FR-12 §12.2).
//   - recordRealization : simpan realisasi Owner dengan tanggal + identitas
//                         pencatat (FR-9 §9.1); TOLAK bila periode target sudah
//                         final (FR-9/FR-10) → ContributionError('PERIOD_FINALIZED');
//                         audit 'contribution_recorded' in-tx.
//   - runningPoints     : poin berjalan (belum diberi insentif) Owner pada
//                         periode aktif + saldo carry-over (FR-9 §9.2/§9.3).
//
// Konvensi transaksi (AD-2): service teratas membuka transaksi via
// `withTransaction`; audit ditulis DI DALAM tx yang sama agar atomik. Pembacaan
// (runningPoints) memakai `db` bound-schema (view dashboard/rekap COO).
//
// Cut-off periode (FR-10) & basis Insentif (task 13.2):
//   - cutOff                    : finalisasi periode aktif menjadi snapshot beku
//                                 imutabel; poin memenuhi syarat difinalkan
//                                 sebagai dasar Insentif (§10.1); membuka
//                                 periode aktif baru untuk carry-over (§10.2/
//                                 §10.5); menghasilkan CutOffRecap yang MEMISAH
//                                 poin ter-insentif dari poin carry-over (§10.3);
//                                 guard imutabel (tak dapat difinalkan ulang).
//   - finalizedUnredeemedPoints : basis Insentif kanonik (AD-10) — poin periode
//                                 terfinalkan yang belum ditunaikan
//                                 (`redeemed = false`).
// cutOff & finalizedUnredeemedPoints menerima `tx` (AD-2): dipanggil sebagai
// bagian transaksi lintas modul; pemanggil teratas yang membuka transaksi.

import type { Tx } from '../../utils/db'
import { withTransaction } from '../../utils/db'
import { audit } from '../audit'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import * as repo from './contribution.repo'
import { ContributionError } from './events'
import type {
  ContributionEntry,
  ContributionItem,
  ContributionItemInput,
  CutOffRecap,
  OwnerPoints,
  PointsView,
  RealizationInput,
} from './events'

// ---------------------------------------------------------------------------
// Validasi poin — bilangan bulat non-negatif (schema: integer)
// ---------------------------------------------------------------------------

function assertValidPoints(points: number): void {
  if (!Number.isInteger(points) || points < 0) {
    throw new ContributionError(
      'INVALID_POINTS',
      `Poin Contribution harus bilangan bulat non-negatif; diterima: ${points}.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Definisi item Contribution (FR-8) — service teratas membuka transaksi
// ---------------------------------------------------------------------------

/**
 * Mendefinisikan item Contribution hasil keputusan MRO (FR-8).
 *
 * Menyimpan nama, deskripsi, poin kuantitatif, periode berlaku, dan tautan MoM
 * penetap (FR-8 §8.1/§8.2). MoM referensi divalidasi keberadaannya agar jejak
 * keputusan konsisten. Audit 'contribution_item_defined' ditulis in-tx
 * (FR-12 §12.2).
 *
 * @param cooId  Aktor COO penetap item (dicatat pada audit).
 * @param item   Nilai item baru (nama, deskripsi, poin, periode).
 * @param momRef Referensi MoM penetap (FR-8 §8.1) — wajib.
 */
export async function defineItem(
  cooId: Uuid,
  item: ContributionItemInput,
  momRef: Uuid,
): Promise<ContributionItem> {
  if (item.name === undefined || item.name.trim() === '') {
    throw new ContributionError(
      'ITEM_NAME_REQUIRED',
      'Nama item Contribution wajib diisi (FR-8 §8.1).',
    )
  }
  assertValidPoints(item.points)

  return withTransaction(async (tx) => {
    // Pastikan MoM penetap ada agar tautan keputusan konsisten (FR-8 §8.1).
    const mom = await repo.findMomById(tx, momRef)
    if (!mom) {
      throw new ContributionError(
        'MOM_NOT_FOUND',
        `MoM penetap ${momRef} tidak ditemukan; item Contribution wajib tertaut MoM (FR-8 §8.1).`,
      )
    }

    // Bila periode berlaku diberikan, pastikan periode itu ada.
    if (item.periodId != null) {
      const period = await repo.findPeriodById(tx, item.periodId)
      if (!period) {
        throw new ContributionError(
          'PERIOD_NOT_FOUND',
          `Periode berlaku ${item.periodId} tidak ditemukan.`,
        )
      }
    }

    const created = await repo.insertItem(tx, {
      name: item.name,
      description: item.description ?? null,
      points: item.points,
      periodId: item.periodId ?? null,
      momRef,
    })

    // Audit definisi item Contribution (FR-12 §12.2) — in-tx, atomik.
    await audit.write(tx, {
      actor: cooId,
      action: 'contribution_item_defined',
      target: created.id,
      details: {
        name: created.name,
        points: created.points,
        periodId: created.periodId,
        momRef,
      },
    })

    return created
  })
}

// ---------------------------------------------------------------------------
// Pencatatan realisasi Contribution (FR-9) — service teratas membuka transaksi
// ---------------------------------------------------------------------------

/**
 * Mencatat realisasi Contribution seorang Owner pada item yang telah
 * didefinisikan (FR-9 §9.1). Menyimpan tanggal pencatatan dan identitas
 * pencatat (`recordedBy = cooId`). Realisasi ke periode yang SUDAH final ditolak
 * (`PERIOD_FINALIZED`, FR-9/FR-10). Audit 'contribution_recorded' ditulis in-tx.
 *
 * Resolusi periode target:
 *   1. `entry.periodId` bila diberikan; jika periode final → tolak.
 *   2. jika tidak, periode item (bila item punya `periodId` & belum final).
 *   3. jika tidak, periode Contribution aktif (belum-final) terbaru.
 * Bila tak ada periode yang bisa dipakai → `PERIOD_NOT_FOUND`.
 *
 * @param cooId Aktor COO pencatat (identitas `recordedBy`, FR-9 §9.1).
 * @param entry Nilai realisasi (owner, item, tanggal, opsi periode/poin).
 */
export async function recordRealization(
  cooId: Uuid,
  entry: RealizationInput,
): Promise<ContributionEntry> {
  return withTransaction(async (tx) => {
    // Item wajib sudah terdefinisi (FR-9 §9.1).
    const item = await repo.findItemById(tx, entry.itemId)
    if (!item) {
      throw new ContributionError(
        'ITEM_NOT_FOUND',
        `Item Contribution ${entry.itemId} tidak ditemukan; realisasi hanya untuk item yang telah didefinisikan (FR-9 §9.1).`,
      )
    }

    // Resolusi periode target (lihat urutan di docstring).
    const period = await resolveTargetPeriod(tx, entry, item.periodId)

    // TOLAK bila periode target sudah final (FR-9/FR-10).
    if (period.isFinalized) {
      throw new ContributionError(
        'PERIOD_FINALIZED',
        `Periode ${period.id} sudah final; pencatatan realisasi Contribution tidak diizinkan (FR-10).`,
      )
    }

    // Poin realisasi: eksplisit bila diberikan, jika tidak memakai poin item.
    const points = entry.points ?? item.points
    assertValidPoints(points)

    const created = await repo.insertEntry(tx, {
      ownerId: entry.ownerId,
      itemId: entry.itemId,
      periodId: period.id,
      points,
      recordedBy: cooId, // identitas pencatat (FR-9 §9.1)
      recordedDate: entry.recordedDate,
    })

    // Audit pencatatan realisasi (FR-12 §12.2) — in-tx, atomik.
    await audit.write(tx, {
      actor: cooId,
      action: 'contribution_recorded',
      target: created.id,
      details: {
        ownerId: created.ownerId,
        itemId: created.itemId,
        periodId: created.periodId,
        points: created.points,
        recordedDate: created.recordedDate,
      },
    })

    return created
  })
}

/**
 * Menentukan periode target untuk pencatatan realisasi mengikuti prioritas:
 * periode eksplisit → periode item → periode aktif belum-final.
 */
async function resolveTargetPeriod(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  entry: RealizationInput,
  itemPeriodId: Uuid | null,
) {
  if (entry.periodId != null) {
    const period = await repo.findPeriodById(tx, entry.periodId)
    if (!period) {
      throw new ContributionError(
        'PERIOD_NOT_FOUND',
        `Periode target ${entry.periodId} tidak ditemukan.`,
      )
    }
    return period
  }

  if (itemPeriodId != null) {
    const period = await repo.findPeriodById(tx, itemPeriodId)
    if (period && !period.isFinalized) {
      return period
    }
  }

  const active = await repo.findActivePeriod(tx)
  if (!active) {
    throw new ContributionError(
      'PERIOD_NOT_FOUND',
      'Tidak ada periode Contribution aktif untuk mencatat realisasi.',
    )
  }
  return active
}

// ---------------------------------------------------------------------------
// Poin berjalan (FR-9 §9.2/§9.3) — pembacaan view dashboard/rekap COO
// ---------------------------------------------------------------------------

/**
 * Poin Contribution berjalan seorang Owner (FR-9 §9.2/§9.3): total poin
 * realisasi yang BELUM diberi insentif (`redeemed = false`), dipecah menjadi
 * poin periode aktif dan saldo carry-over dari periode lain (FR-10 §10.5).
 *
 * Cocok untuk dashboard Owner (§9.2) maupun rekap COO (§9.3).
 */
export async function runningPoints(ownerId: Uuid): Promise<PointsView> {
  const reader = repo.db

  const [byPeriod, active] = await Promise.all([
    repo.sumRunningPointsByOwner(reader, ownerId),
    repo.findActivePeriod(reader),
  ])

  let currentPeriodPoints = 0
  let carryOverPoints = 0
  for (const row of byPeriod) {
    if (active && row.periodId === active.id) {
      currentPeriodPoints += row.points
    } else {
      carryOverPoints += row.points
    }
  }

  return {
    ownerId,
    currentPeriodPoints,
    carryOverPoints,
    totalRunning: currentPeriodPoints + carryOverPoints,
  }
}

// ---------------------------------------------------------------------------
// Cut-off periode Contribution (FR-10) — snapshot beku imutabel + carry-over
// ---------------------------------------------------------------------------

/**
 * Nama default periode baru hasil roll saat cut-off (§10.2/§10.5). Memakai
 * tanggal cut-off agar mudah dilacak; COO dapat menamai ulang di kemudian hari.
 */
function nextPeriodName(cutOffDate: JakartaDate): string {
  return `Periode sejak ${cutOffDate}`
}

/**
 * Memicu cut-off Contribution Period pada `cutOffJakartaDate` (FR-10).
 * Dijalankan DI DALAM transaksi lintas modul `tx` (AD-2) — pemanggil teratas
 * yang membuka transaksi.
 *
 * Langkah (atomik):
 *   1. Resolusi periode aktif (belum-final). Bila tak ada → `NO_ACTIVE_PERIOD`.
 *   2. Finalisasi periode: `is_finalized = true`, `finalized_at = now`,
 *      `cut_off_date = cutOffJakartaDate` (§10.1). Guard imutabel: bila periode
 *      sudah final (finalisasi tak menghasilkan transisi) →
 *      `PERIOD_ALREADY_FINALIZED` (snapshot beku tak dapat difinalkan ulang).
 *   3. Rekap per Owner untuk periode terfinalkan, dipecah `redeemed`:
 *      poin `redeemed = false` = poin yang DIFINALKAN sebagai dasar Insentif
 *      (§10.1) dan yang di-CARRY OVER (belum diberi insentif, §10.2); poin
 *      `redeemed = true` = Contribution yang SUDAH diberi insentif — dipisah
 *      pada rekap (§10.3) dan tidak muncul lagi di periode berikutnya (§10.4).
 *   4. Roll periode aktif baru (§10.2/§10.5) agar realisasi berikutnya tertaut
 *      ke sana; poin carry-over tetap `redeemed = false` sehingga tampil sejak
 *      awal periode baru via `runningPoints` (§10.5).
 *   5. Audit 'cutoff' in-tx (FR-12 §12.2).
 *
 * @param tx                Handle transaksi lintas modul (AD-2).
 * @param cooId             Aktor COO pemicu cut-off (dicatat pada audit).
 * @param cutOffJakartaDate Tanggal cut-off ('YYYY-MM-DD', zona Jakarta, AD-9).
 */
export async function cutOff(
  tx: Tx,
  cooId: Uuid,
  cutOffJakartaDate: JakartaDate,
): Promise<CutOffRecap> {
  // 1. Periode aktif (belum-final) wajib ada untuk di-cut-off (FR-10 §10.1).
  const active = await repo.findActivePeriod(tx)
  if (!active) {
    throw new ContributionError(
      'NO_ACTIVE_PERIOD',
      'Tidak ada periode Contribution aktif untuk di-cut-off (FR-10).',
    )
  }

  const finalizedAt = new Date()

  // 2. Finalisasi periode aktif → snapshot beku imutabel (§10.1). Guard
  //    imutabel via CAS pada `is_finalized`: bila tak ada transisi, periode
  //    sudah final dan tidak boleh difinalkan ulang.
  const finalized = await repo.finalizePeriod(
    tx,
    active.id,
    cutOffJakartaDate,
    finalizedAt,
  )
  if (!finalized) {
    throw new ContributionError(
      'PERIOD_ALREADY_FINALIZED',
      `Periode ${active.id} sudah difinalkan; cut-off tidak dapat diulang (FR-10 imutabel).`,
    )
  }

  // 3. Rekap per Owner untuk periode terfinalkan, dipecah status penunaian.
  const split = await repo.sumByOwnerForPeriodSplitRedeemed(tx, finalized.id)

  const finalizedPoints: OwnerPoints[] = []
  const carryOverPoints: OwnerPoints[] = []
  let totalFinalized = 0
  let totalCarriedOver = 0

  for (const row of split) {
    // Poin belum-diberi-insentif = dasar Insentif yang difinalkan (§10.1) dan
    // saldo yang di-carry over ke periode baru (§10.2/§10.5).
    if (row.unredeemedPoints > 0) {
      const op: OwnerPoints = {
        ownerId: row.ownerId,
        points: row.unredeemedPoints,
      }
      finalizedPoints.push(op)
      carryOverPoints.push({ ...op })
      totalFinalized += row.unredeemedPoints
      totalCarriedOver += row.unredeemedPoints
    }
    // Poin `redeemed = true` (sudah diberi insentif) sengaja TIDAK di-carry
    // over (§10.4) — dipisah dari rekap carry-over.
  }

  // 4. Roll periode aktif baru untuk carry-over (§10.2/§10.5). Entri belum
  //    diberi insentif tetap `redeemed = false` dan tampil sejak awal periode
  //    baru lewat `runningPoints` (§10.5) sebagai saldo carry-over.
  const newPeriod = await repo.insertPeriod(tx, {
    name: nextPeriodName(cutOffJakartaDate),
    startDate: cutOffJakartaDate,
  })

  // 5. Audit cut-off (FR-12 §12.2) — in-tx, atomik.
  await audit.write(tx, {
    actor: cooId,
    action: 'cutoff',
    target: finalized.id,
    details: {
      cutOffDate: cutOffJakartaDate,
      finalizedPeriodId: finalized.id,
      newPeriodId: newPeriod.id,
      totalFinalized,
      totalCarriedOver,
      ownersFinalized: finalizedPoints.length,
    },
  })

  return {
    finalizedPeriodId: finalized.id,
    cutOffDate: cutOffJakartaDate,
    finalizedAt,
    newPeriodId: newPeriod.id,
    finalizedPoints,
    carryOverPoints,
    totalFinalized,
    totalCarriedOver,
  }
}

// ---------------------------------------------------------------------------
// Basis Insentif kanonik (AD-10) — poin periode terfinalkan belum ditunaikan
// ---------------------------------------------------------------------------

/**
 * Poin Insentif per Owner (basis distribusi, AD-10 / FR-16 §16.7): Σ poin entri
 * Contribution pada periode TERFINALKAN yang BELUM ditunaikan
 * (`redeemed = false`). Ini adalah fungsi kanonik yang mengekspos basis Insentif
 * dari domain contribution; distribusi mengonsumsinya saat menyimpan rekap
 * (task 14.1). Menerima `tx` agar konsisten dalam transaksi rekap.
 *
 * @param tx Handle transaksi lintas modul (AD-2).
 * @returns  `OwnerPoints[]` — hanya Owner dengan total poin > 0.
 */
export async function finalizedUnredeemedPoints(
  tx: Tx,
): Promise<OwnerPoints[]> {
  const rows = await repo.sumFinalizedUnredeemedByOwner(tx)
  return rows.map((r) => ({ ownerId: r.ownerId, points: r.points }))
}

// Re-ekspor tipe tanggal untuk kenyamanan pemanggil in-package (opsional).
export type { JakartaDate }
