/**
 * Pusat konstanta data-testid (selector-resilience: satu sumber kebenaran;
 * badge status tetap di-assert by role/text — UX-DR4, bukan warna).
 *
 * ID yang sudah ada di substrat: halaman smoke Story 1.1. ID komponen
 * transaksional UX-DR10–13 (pratinjau-hitungan, alert-penolakan-alasan,
 * otp-input, baris-pesanan-{id}, sel-{owner}-{kolom}, chart-*) ditambahkan
 * di sini saat story pemiliknya diimplementasikan — lihat
 * _bmad-output/test-artifacts/test-design/snd-dash-handoff.md.
 */
export const TEST_IDS = {
  smoke: {
    auth: 'smoke-auth',
    authStatus: 'smoke-auth-status',
    authSignin: 'smoke-auth-signin',
    dialog: 'smoke-dialog',
    sheet: 'smoke-sheet',
    tooltip: 'smoke-tooltip',
    drawer: 'smoke-drawer',
    inputOtp: 'smoke-input-otp',
    otpInput: 'otp-input',
    otpValue: 'otp-value',
    toast: 'smoke-toast',
  },
  // Story 1.2 — autentikasi & halaman login (kontrak ATDD red-phase;
  // elemen dihalaman diimplementasikan dengan data-testid ini).
  login: {
    brandLogo: 'login-brand-logo',
    ctaGoogle: 'login-cta-google',
    pesanUnlinked: 'login-pesan-unlinked',
    tautanDaftar: 'login-tautan-daftar',
  },
  statusPendaftaran: {
    badgeStatus: 'status-badge',
    alasanPenolakan: 'status-alasan-penolakan',
    dataProfil: 'status-data-profil',
  },
  // Story 1.4 — halaman pendaftaran (kontrak ATDD green-phase + modal
  // konfirmasi T&C wajib sebelum aksi daftar/OAuth).
  pendaftaran: {
    modalSyarat: 'pendaftaran-modal-syarat',
    checkboxSyarat: 'pendaftaran-syarat-setuju',
    tombolLanjut: 'pendaftaran-syarat-lanjut',
    tombolBatal: 'pendaftaran-syarat-batal',
    tautanSyarat: 'pendaftaran-tautan-syarat',
  },
  // Story 1.3 — audit trail (kontrak ATDD red-phase; elemen halaman
  // /audit-trail diimplementasikan dengan data-testid ini).
  auditTrail: {
    halaman: 'audit-trail-halaman',
    tabel: 'audit-trail-tabel',
    baris: 'audit-trail-baris',
    kosong: 'audit-trail-kosong',
    paginasi: 'audit-trail-paginasi',
    ukuran: 'audit-trail-ukuran',
  },
  // Story 1.5 — kelengkapan profile (kontrak ATDD red-phase; region indikator
  // langkah UX-DR16 diimplementasikan dengan data-testid ini). Zona
  // TERPISAH (owner 2026-09-19): klaim DB (server-truth) & kelengkapan
  // isian form — simpan parsial menghapus alert gagal-lengkapi.
  kelengkapanProfil: {
    indikator: 'kelengkapan-indikator',
    alertSukses: 'kelengkapan-alert-tersimpan',
    catatanForm: 'kelengkapan-catatan-form',
    saklarPemilik: 'kelengkapan-saklar-pemilik',
  },
  // Story 1.6 — verifikasi & penolakan pendaftar oleh COO (halaman
  // /pendaftar + endpoint /api/pendaftar[-/keputusan]).
  pendaftar: {
    halaman: 'pendaftar-halaman',
    tabel: 'pendaftar-tabel',
    baris: 'pendaftar-baris',
    kosong: 'pendaftar-kosong',
    aksiVerifikasi: 'pendaftar-aksi-verifikasi',
    aksiTolak: 'pendaftar-aksi-tolak',
    dialogTolak: 'pendaftar-dialog-tolak',
    inputAlasan: 'pendaftar-input-alasan',
    kirimTolak: 'pendaftar-kirim-tolakan',
    batalTolak: 'pendaftar-batal-tolakan',
    pesanStatusBerubah: 'pendaftar-pesan-status-berubah',
    // Penyempurnaan 2026-09-23 — konfirmasi verifikasi dua-langkah + detail.
    dialogVerifikasi: 'pendaftar-dialog-verifikasi',
    kirimVerifikasi: 'pendaftar-kirim-verifikasi',
    batalVerifikasi: 'pendaftar-batal-verifikasi',
    aksiDetail: 'pendaftar-aksi-detail',
    dialogDetail: 'pendaftar-dialog-detail',
    tutupDetail: 'pendaftar-tutup-detail',
    cobaLagiDetail: 'pendaftar-coba-lagi-detail',
  },
  // Story 1.7 — navigasi registry-driven (kontrak ATDD red-phase; elemen
  // layout app.vue diimplementasikan dengan data-testid ini). Item nav
  // di-assert by-role name (label registry); "Lainnya" = Sheet bila item
  // > MAKS_ITEM_NAV_MOBILE — Epic 1 maks 3 item, pemicunya tak pernah tampil.
  navigasi: {
    batangBawah: 'nav-batang-bawah',
    sidebar: 'nav-sidebar',
    tombolKeluar: 'nav-tombol-keluar',
    tombolKeluarMobile: 'nav-tombol-keluar-mobile',
    dialogKeluar: 'nav-dialog-keluar',
  },
  // Story 1.7 — Halaman Personal (kontrak ATDD red-phase; 4 section matriks
  // §4.8 diimplementasikan dengan data-testid ini; Alert transparansi
  // aria-live="polite" tampil sekali lalu URL dibersihkan).
  personal: {
    alertTransparansi: 'personal-alert-transparansi',
    sectionProfil: 'personal-section-profil',
    sectionPortofolio: 'personal-section-portofolio',
    statusKosong: 'personal-status-kosong',
    sectionHargaRkap: 'personal-section-harga-rkap',
    pintuPesanan: 'personal-pintu-pesanan',
    pesanGagalProfil: 'personal-pesan-gagal-profil',
  },
} as const
