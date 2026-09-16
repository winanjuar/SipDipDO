/**
 * ORDERS — Pesanan Pembelian (FR-1, FR-19–FR-21).
 *
 * TODO(Story 1.4+/Epic 3): validasi submit memakai fungsi assembly kanonik
 * shared/domain (AD-6) + snapshot Harga Terkunci (AD-7); penarikan = kolom
 * `withdrawn_at` via CAS dengan guard kanonik `status = 'menunggu_konfirmasi'
 * AND withdrawn_at IS NULL` (AD-2). Fungsi lintas modul di jalur finalisasi
 * menerima `tx`; hanya service teratas membuka transaksi.
 */
export {}
