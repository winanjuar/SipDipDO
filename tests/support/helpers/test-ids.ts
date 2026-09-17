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
  },
  statusPendaftaran: {
    badgeStatus: 'status-badge',
    alasanPenolakan: 'status-alasan-penolakan',
  },
} as const
