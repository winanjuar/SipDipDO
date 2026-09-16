/**
 * DISTRIBUTION — distribusi laba & rekap RUPS (FR-16).
 *
 * Rekap menjumlahkan poin dari SEMUA periode ter-finalisasi-belum-tertunaikan;
 * menyimpan snapshot imutabel angka yang dipakai (AD-10); flip status owner ->
 * `keluar` me-re-validasi `positions.shares = 0` DI DALAM transaksi rekap
 * mengikuti urutan lock global (AD-11/AD-2); event "Insentif owner tanpa saham
 * ditunaikan" dipancarkan ke identity (events.ts saat implementasi).
 *
 * TODO(Epic 5): tabel profit_distributions + rincian snapshot per owner.
 */
export {}
