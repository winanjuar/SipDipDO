# Katalog Field Profil — Lampiran A #1–10 (form Story 1.5)

Sumber daftar: PRD Lampiran A (`prd.md` § Lampiran A) — transkrip field Google Form pendaftaran owner, rujukan resmi FR-22. Form mengambil **#1–10**; #11 (Referal) dikeluarkan dari form (FR-22: diajukan saat Pembelian Pertama).

Pengelompokan & label input (re-negotiasi owner 2026-09-18): form memakai 4 fieldset ber-legend dengan **label input singkat**; indikator kelengkapan tetap memakai **nama field Lampiran A penuh** (UX-DR16 persis).

| Grup (legend) | # | Field (Lampiran A) | Label input | Catatan kontrak |
|---|---|---|---|---|
| Pribadi | 1 | Nama Lengkap | Nama | string, wajib |
| Pribadi | 2 | Alias | Alias | string, wajib |
| Pribadi | 3 | Gmail | Email | = email sesi Google; **disabled** |
| Pribadi | 4 | Nomor HP | No HP | string (AD-10), wajib |
| Info Kontak Darurat | 5 | Kontak Darurat | Nama | string, wajib |
| Info Kontak Darurat | 6 | Nomor HP Kontak Darurat | No HP | string, wajib |
| Info Kontak Darurat | 7 | Hubungan dengan Owner | Hubungan | string, wajib |
| Info Rekening | 8 | Nama Bank | Bank | string, wajib |
| Info Rekening | 9 | Pemilik Rekening | Pemilik | string, wajib |
| Info Rekening | 10 | Nomor Rekening | No. Rekening | string (AD-10), wajib |
| Referal | — | Kode Referal Saya | Kode Referal Saya | `owners.referral_code`; **disabled** (tampilan only) |
| Referal | — | Referal Dari | Referal Dari | `owners.used_referral_code`; **disabled**, DORMANT null sampai Epic 3 |

Aturan kelengkapan (dipakai CAP-2/cron CAP-4): field dianggap terisi bila nilai trim non-kosong; Profil lengkap = 9 dari 9 field tersimpan terisi (Email selalu terisi = email sesi). Field referral TIDAK pernah menjadi bagian body `PUT /api/profile` maupun predikat kelengkapan.
