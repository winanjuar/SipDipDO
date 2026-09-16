/**
 * IDENTITY — repo: satu-satunya tempat query Drizzle untuk tabel milik modul
 * (owners, coo_tenures, otp_codes — AD-5).
 *
 * TODO(Story 1.4+): tabel & query. Konvensi yang mengikat saat tabel dibuat:
 * - owners: email UNIQUE (re-daftar = baris yang sama, AD-11); status enum
 *   `diajukan|terverifikasi|ditolak|kedaluwarsa|keluar` — hanya modul ini yang
 *   menulisnya; transisi SELALU compare-and-set atas status sebelumnya.
 * - otp_codes: terikat {action_type, target_ref}, single-use via CAS.
 */
export {}
