// server/domain/audit/events.ts
//
// Registry aksi audit trail (FR-12) + tipe entri audit.
//
// Referensi: design.md PART A A.4 AuditModule dan Requirement 12 (FR-12):
//   §12.1 : submit, tarik, kedaluwarsa, konfirmasi, tolak Pesanan Pembelian.
//   §12.2 : input langsung, penetapan harga, cut-off, perubahan data dasar.
//   §12.3 : catatan bersifat append-only (tak dapat diubah/dihapus) — ditegakkan
//           lewat DB grants (AD-3, drizzle/grants.sql), bukan di lapisan ini.
//   §12.4 : tampilan audit trail hanya untuk COO (akses ditegakkan di route).
//   §12.5 : alasan & hitungan penolakan dicatat pada `details`.
//
// Registry ini adalah SATU sumber kebenaran untuk nama aksi yang sah. Kolom
// `audit_logs.action` disimpan sebagai `text` (schema.ts) agar registry dapat
// tumbuh tanpa migrasi enum DB; validasi keanggotaan dilakukan di service.

import type { Uuid } from '../../../shared/domain/types'

/**
 * Himpunan tertutup nama aksi audit yang dikenal (FR-12 §12.1/§12.2).
 *
 * `as const` menjaga literal string agar dapat diturunkan menjadi union
 * `AuditAction` sekaligus dipakai untuk validasi keanggotaan saat runtime.
 */
export const AUDIT_ACTIONS = [
  // FR-12 §12.1 — siklus hidup Pesanan Pembelian (juga FR-18 §18.2 transisi status).
  'order_submitted', // submit Pesanan Pembelian
  'order_withdrawn', // penarikan pesanan (FR-18 §18.3)
  'order_expired', // kedaluwarsa otomatis hari ke-7 (FR-19)
  'order_confirmed', // konfirmasi COO → transaksi efektif (FR-20)
  'order_rejected', // penolakan saat submit maupun re-validasi konfirmasi (§12.5)

  // FR-12 §12.2 — jalur transaksi & data dasar.
  'direct_entry', // input langsung COO atas nama Owner (FR-21)
  'compensation_entry', // entry kompensasi ledger (AD-1)
  'price_set', // penetapan harga beli/jual (FR-6)
  'mom_saved', // penyimpanan/finalisasi MoM (FR-7)
  'cutoff', // cut-off periode Contribution (FR-10)
  'contribution_item_defined', // definisi item Contribution (FR-8)
  'contribution_recorded', // pencatatan realisasi Contribution per Owner (FR-9)
  'base_data_change', // perubahan data dasar Owner/Profile/data induk (FR-13)

  // RKAP (FR-1/FR-23) — penyesuaian yang wajib terekam (§9 instant adjustment).
  'instant_adjustment', // kenaikan Final Requirement akibat pembulatan ke atas
  'rkap_manual_adjust', // penyesuaian manual COO
  'rkap_rebalance', // rebalance antar Capital Item sejenis
  'rkap_new_phase', // penetapan fase RKAP baru
  'rkap_plot_allocation', // plotting alokasi Fulfillment ke Capital Item (§23.11)

  // Distribusi laba (FR-16).
  'distribution_recap', // rekap distribusi laba RUPS
  'refund_resolution', // resolusi pengalihan/refund saat tolak konfirmasi (FR-20 §9)

  // Identitas & tata kelola.
  'registration_verified', // verifikasi pendaftaran Calon Owner (FR-22)
  'registration_rejected', // penolakan pendaftaran Calon Owner (FR-22)
  'owner_exited', // Owner ditandai Keluar (FR-16 §8)
  'owner_reactivated', // Owner Keluar aktif kembali (FR-13 §7)
  'coo_transfer', // pergantian mandat COO dengan referensi MoM (FR-17)

  // Keamanan (MFA/OTP) — permintaan wajib tercatat (FR-3 §4).
  'otp_requested', // permintaan OTP
  'mfa_requested', // permintaan verifikasi MFA

  // Migrasi historis (FR-14) — aktor 'system'.
  'migration_import', // impor data historis
] as const

/** Union nama aksi audit yang sah, diturunkan dari registry. */
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** Set pencarian cepat untuk validasi keanggotaan aksi saat runtime. */
const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS)

/**
 * Type guard: apakah `value` merupakan `AuditAction` yang terdaftar di registry.
 * Dipakai `AuditService.write` untuk menolak aksi di luar registry (§12.1/§12.2).
 */
export function isAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTION_SET.has(value)
}

/**
 * Entri audit yang ditulis in-tx (AD-3, SELALU dalam transaksi aksi).
 *
 * - `actor`   : owner id COO/pengguna, atau `null` untuk aktor 'system' (migrasi).
 * - `action`  : salah satu nilai registry (`AuditAction`).
 * - `target`  : referensi entitas terkait (mis. buy_order.id) — opsional.
 * - `details` : payload JSONB (mis. alasan & hitungan penolakan §12.5) — opsional.
 */
export interface AuditEntry {
  actor: Uuid | null
  action: AuditAction
  target?: string | null
  details?: Record<string, unknown>
}
