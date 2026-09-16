// server/domain/orders/orders.model.ts
//
// Model domain ORDERS (FR-1/FR-18). Modul ini adalah PEMILIK penuh tabel
// `buy_orders` — satu-satunya penulis baris pesanan pembelian (submit/queue/
// siklus hidup). Berisi bentuk entitas `BuyOrder` (kanonik design.md PART A
// Data Models) serta tipe proyeksi pratinjau perhitungan (`OrderPreview`) yang
// dihasilkan MURNI via `shared/domain` (AD-6) sehingga identik dengan validasi
// server saat submit.
//
// Konvensi (AD-10): nilai uang/rasio adalah string berskala tetap
// (`MoneyString`/`RatioString`); Quantity/Shares/Ceil integer.

import type {
  CapitalType,
  MoneyString,
  OrderStatus,
  RatioString,
  Uuid,
} from '../../../shared/domain/types'

// ---------------------------------------------------------------------------
// Entitas BuyOrder (design.md PART A Data Models)
// ---------------------------------------------------------------------------

/**
 * Pesanan Pembelian (`buy_orders`). Harga Terkunci disimpan sebagai NILAI
 * (`lockedPrice`) + referensi baris harga asal (`lockedPriceRef`) pada saat
 * submit (AD-7/FR-6.3 §1.12).
 *
 * Predikat pending KANONIK (AD-2, dipakai seluruh guard status):
 *   `status = 'menunggu_konfirmasi' AND withdrawnAt IS NULL`.
 *
 * Penarikan adalah KOLOM (`withdrawnAt`), bukan status tersendiri (AD-2).
 */
export interface BuyOrder {
  id: Uuid
  ownerId: Uuid
  capitalType: CapitalType
  quantity: number
  /** Harga Terkunci disimpan sebagai nilai (AD-7/§1.12). */
  lockedPrice: MoneyString
  lockedPriceRef: Uuid
  /** Referral wajib s.d. Pembelian Pertama efektif (FR-22). */
  referralOwnerId: Uuid | null
  status: OrderStatus
  /** Penarikan = kolom, bukan status (AD-2). */
  withdrawnAt: Date | null
  submittedAt: Date
}

// ---------------------------------------------------------------------------
// Pratinjau perhitungan (previewCalculation) — proyeksi MURNI (AD-6)
// ---------------------------------------------------------------------------

/**
 * Hasil pratinjau perhitungan sebuah calon pesanan (FR-1 §1.1/§1.8/§1.9).
 *
 * Proyeksi Strength/Ceil/Shares dihitung dari posisi terkini owner + seluruh
 * pesanan pending kanonik owner + calon, memakai `shared/domain`
 * (gates.evalStrengthGate + weighting) — HASIL SAMA dengan validasi server saat
 * submit (AD-6). `proyeksiRtl` adalah batas beli Modal Operasional turunan
 * proyeksi (weighting.rtl). `ok` benar bila proyeksi Strength ≤ 100% (1.0).
 *
 * `maxQuantity`/`minQuantity` diisi hanya bila konteks menyediakan harga
 * berjalan + ruang RKAP (untuk Modal Tetap/Bergerak) atau proyeksi RTL (untuk
 * Modal Operasional) — lihat `PreviewContext`. Bila tidak tersedia → `null`
 * (pratinjau tetap menampilkan proyeksi Strength/Ceil/Shares).
 */
export interface OrderPreview {
  /** Proyeksi Strength gabungan sebagai fraksi 0..1 (RatioString). */
  proyeksiStrength: RatioString
  /** Proyeksi total Ceil gabungan (integer). */
  proyeksiCeil: number
  /** Proyeksi total Shares gabungan (integer). */
  proyeksiShares: number
  /** Proyeksi RTL = Floor((Ceil − Shares) ÷ 2) (weighting.rtl). */
  proyeksiRtl: number
  /** true bila proyeksi Strength ≤ 100% (calon boleh diajukan). */
  ok: boolean
  /** Quantity minimal (selalu 1 bila ada informasi rentang). */
  minQuantity: number | null
  /** Quantity maksimal yang diizinkan (per RKAP/RTL) — `null` bila tak dihitung. */
  maxQuantity: number | null
}
