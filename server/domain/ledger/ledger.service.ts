/**
 * LEDGER — satu-satunya penulis posisi kepemilikan (AD-1). Tabel
 * `ledger_transactions` append-only; posisi adalah proyeksi terkopling atomik
 * (AD-4) yang hanya diupdate di dalam transaksi append ledger.
 *
 * Dua pintu finalisasi (AD-2): konfirmasi COO (FR-20) & input langsung
 * (FR-21, termasuk entry kompensasi — tanpa re-validasi gerbang domain);
 * plus jalur import sekali jalan MIGRASI via API internal modul ini (FR-14).
 * Urutan lock global: buy_orders -> rkap_phases -> positions -> owners ->
 * contribution_periods -> distribution.
 *
 * TODO(Epic 3): tabel + finalisasi + event `Pembelian Pertama efektif`
 * (events.ts) yang dibaca identity.
 */
export {}
