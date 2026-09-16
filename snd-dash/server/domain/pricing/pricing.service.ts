// server/domain/pricing/pricing.service.ts
//
// Orkestrasi domain pricing (FR-6/FR-7). Menegakkan:
//   - currentPrice : resolusi TEPAT satu baris harga berjalan (AD-7); error jelas
//                    bila belum ada harga s.d. tanggal diminta (FR-6.3).
//   - priceHistory : seluruh riwayat harga per kind (FR-6.2).
//   - setPrice     : simpan harga + referensi MoM (FR-6.1); unik (kind,
//                    effective_date) (AD-7) — konflik disurfacekan jelas; audit
//                    'price_set' in-tx (FR-12 §12.2).
//   - saveMom      : simpan/edit MoM; transisi draft → final (FR-7 §7.3); audit
//                    'mom_saved' in-tx (FR-12 §12.2).
//
// Konvensi transaksi (AD-2): service teratas membuka transaksi via
// `withTransaction`; audit ditulis DI DALAM tx yang sama agar atomik.
// Pembacaan (currentPrice/priceHistory) menerima `tx` opsional — dipakai
// in-tx oleh finalisasi/orders (Harga Terkunci), atau memakai `db` bound-schema
// untuk view publik (FR-6.5) bila tanpa tx.

import { withTransaction } from '../../utils/db'
import type { Tx } from '../../utils/db'
import { audit } from '../audit'
import { toJakartaDate } from '../../../shared/domain/calendar'
import type {
  JakartaDate,
  PriceKind,
  Uuid,
} from '../../../shared/domain/types'
import * as repo from './pricing.repo'
import type { Mom, PricePeriod } from './pricing.repo'
import { PricingError } from './events'
import type { MomInput, SetPriceInput } from './events'

// ---------------------------------------------------------------------------
// Deteksi bentrok unik Postgres (kode SQLSTATE 23505)
// ---------------------------------------------------------------------------

/**
 * Apakah `err` merupakan pelanggaran unik Postgres (SQLSTATE 23505)?
 * postgres.js meneruskan `code` SQLSTATE pada objek error.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

// ---------------------------------------------------------------------------
// Resolusi harga (FR-6.2/6.3) — pembacaan (opsional in-tx)
// ---------------------------------------------------------------------------

/**
 * Harga berjalan untuk `kind` pada tanggal Jakarta `onJakartaDate` (AD-7):
 * baris `effective_date` terbesar yang `<= onJakartaDate`, TEPAT satu.
 *
 * Dipakai in-tx oleh finalisasi/orders untuk mengunci Harga Terkunci (FR-6.3);
 * bila `tx` tak diberi, membaca lewat `db` bound-schema (view publik FR-6.5).
 *
 * @throws PricingError('PRICE_NOT_FOUND') bila belum ada harga s.d. tanggal itu.
 */
export async function currentPrice(
  kind: PriceKind,
  onJakartaDate: JakartaDate,
  tx?: Tx,
): Promise<PricePeriod> {
  const reader = tx ?? repo.db
  const found = await repo.findCurrent(reader, kind, onJakartaDate)
  if (!found) {
    throw new PricingError(
      'PRICE_NOT_FOUND',
      `Belum ada harga "${kind}" yang berlaku pada atau sebelum ${onJakartaDate}.`,
    )
  }
  return found
}

/**
 * Seluruh riwayat harga untuk `kind`, terurut menaik berdasar tanggal efektif
 * (FR-6.2). Pembacaan view publik (FR-6.5); menerima `tx` opsional bila in-tx.
 */
export async function priceHistory(
  kind: PriceKind,
  tx?: Tx,
): Promise<PricePeriod[]> {
  const reader = tx ?? repo.db
  return repo.findHistory(reader, kind)
}

// ---------------------------------------------------------------------------
// Penetapan harga (FR-6.1) — service teratas membuka transaksi
// ---------------------------------------------------------------------------

/**
 * Menetapkan harga beli/jual baru dengan referensi MoM MRO penetapnya (FR-6.1).
 * Menyimpan nilai harga, tanggal efektif, dan `momRef`. Keunikan
 * (kind, effective_date) ditegakkan DB (AD-7); bentrok disurfacekan sebagai
 * `PricingError('PRICE_CONFLICT')`. Audit 'price_set' ditulis in-tx (FR-12 §12.2).
 *
 * @param cooId  Aktor COO penetap harga (dicatat pada audit).
 * @param input  Nilai harga baru (kind, price, effectiveDate).
 * @param momRef Referensi MoM MRO penetap (FR-6.1) — wajib.
 */
export async function setPrice(
  cooId: Uuid,
  input: SetPriceInput,
  momRef: Uuid,
): Promise<PricePeriod> {
  return withTransaction(async (tx) => {
    // Pastikan MoM referensi ada agar jejak keputusan konsisten (FR-6.1).
    const mom = await repo.findMomById(tx, momRef)
    if (!mom) {
      throw new PricingError(
        'MOM_NOT_FOUND',
        `MoM referensi ${momRef} tidak ditemukan; harga wajib tertaut MoM penetap (FR-6.1).`,
      )
    }

    let created: PricePeriod
    try {
      created = await repo.insertPrice(tx, {
        kind: input.kind,
        price: input.price,
        effectiveDate: input.effectiveDate,
        momRef,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new PricingError(
          'PRICE_CONFLICT',
          `Harga "${input.kind}" untuk tanggal efektif ${input.effectiveDate} sudah ada (unik per kind + tanggal efektif, AD-7).`,
        )
      }
      throw err
    }

    // Audit penetapan harga (FR-12 §12.2) — in-tx, atomik dengan INSERT.
    await audit.write(tx, {
      actor: cooId,
      action: 'price_set',
      target: created.id,
      details: {
        kind: created.kind,
        price: created.price,
        effectiveDate: created.effectiveDate,
        momRef,
      },
    })

    return created
  })
}

// ---------------------------------------------------------------------------
// MoM (FR-7) — simpan/edit + transisi draft → final
// ---------------------------------------------------------------------------

/**
 * Menyimpan (buat/edit) MoM MRO/RUPS (FR-7).
 *
 * - Tanpa `id` → buat MoM baru berstatus 'draft' (butuh `title`).
 * - Dengan `id` → edit MoM; HANYA diizinkan WHILE status 'draft' (FR-7 §7.3).
 *   Bila MoM sudah 'final', edit ditolak (`MOM_ALREADY_FINAL`).
 * - `finalize: true` → transisi 'draft' → 'final' (finalisasi FR-7 §7.3).
 *
 * Audit 'mom_saved' ditulis in-tx (FR-12 §12.2).
 */
export async function saveMom(cooId: Uuid, mom: MomInput): Promise<Mom> {
  return withTransaction(async (tx) => {
    let saved: Mom
    let mode: 'create' | 'update'

    if (mom.id === undefined) {
      // --- Buat MoM baru (draft) ---
      if (mom.title === undefined || mom.title.trim() === '') {
        throw new PricingError(
          'MOM_TITLE_REQUIRED',
          'Judul MoM wajib diisi saat membuat MoM baru (FR-7).',
        )
      }
      saved = await repo.insertMom(tx, {
        title: mom.title,
        momDate: mom.momDate ?? todayJakarta(),
        status: mom.finalize ? 'final' : 'draft',
        body: mom.body ?? null,
      })
      mode = 'create'
    } else {
      // --- Edit MoM yang ada ---
      const existing = await repo.findMomById(tx, mom.id)
      if (!existing) {
        throw new PricingError(
          'MOM_NOT_FOUND',
          `MoM ${mom.id} tidak ditemukan.`,
        )
      }
      // WHILE draft → boleh diedit; final → terkunci (FR-7 §7.3).
      if (existing.status === 'final') {
        throw new PricingError(
          'MOM_ALREADY_FINAL',
          `MoM ${mom.id} sudah final dan tidak dapat diedit lagi (FR-7 §7.3).`,
        )
      }
      saved = await repo.updateMom(tx, mom.id, {
        title: mom.title,
        momDate: mom.momDate,
        body: mom.body,
        status: mom.finalize ? 'final' : undefined,
      })
      mode = 'update'
    }

    // Audit simpan/finalisasi MoM (FR-12 §12.2) — in-tx.
    await audit.write(tx, {
      actor: cooId,
      action: 'mom_saved',
      target: saved.id,
      details: {
        mode,
        status: saved.status,
        finalized: mom.finalize === true,
        title: saved.title,
        momDate: saved.momDate,
      },
    })

    return saved
  })
}

// ---------------------------------------------------------------------------
// Bantuan tanggal — default `momDate` bila tidak disediakan
// ---------------------------------------------------------------------------

/** Tanggal kalender Jakarta hari ini ('YYYY-MM-DD') sebagai default momDate (AD-9). */
function todayJakarta(): JakartaDate {
  return toJakartaDate(new Date())
}
