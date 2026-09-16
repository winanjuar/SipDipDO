/**
 * MIGRATION — import sekali jalan dari spreadsheet historis (FR-14).
 *
 * Memakai pintu finalisasi LEDGER lengkap (plotting per Capital Item +
 * pencatatan pembayaran historis) TETAPI tanpa re-validasi gerbang domain dan
 * tanpa penyesuaian instant; TANPA baris outbox email untuk transaksi
 * berlabel migrasi; `price_periods` historis berlabel "migrasi" (FK harga
 * tidak pernah null); aktor tercatat `system`. Daftar event diteruskan vs
 * disupres dideklarasikan eksplisit di sini dan diuji pada acceptance (Epic 6).
 *
 * TODO(Epic 6): dry-run paritas (gerbang R-001) sebelum cutover produksi.
 */
export {}
