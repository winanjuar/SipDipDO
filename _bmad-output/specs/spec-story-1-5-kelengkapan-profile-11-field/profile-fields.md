# Katalog Field Profil — Lampiran A #1–10 (form Story 1.5)

Sumber daftar: PRD Lampiran A (`prd.md` § Lampiran A) — transkrip field Google Form pendaftaran owner, rujukan resmi FR-22. Form mengambil **#1–10**; #11 (Referal) dikeluarkan dari form (FR-22: diajukan saat Pembelian Pertama — lihat Non-goals SPEC.md).

| # | Field | Keterangan | Catatan kontrak |
|---|---|---|---|
| 1 | Nama Lengkap | Identitas resmi owner | string bebas, wajib |
| 2 | Alias | Nama panggilan sehari-hari | string bebas, wajib |
| 3 | Gmail | Akun Google untuk login; kanal email sistem | = email sesi Google; **tidak diedit via form** (tampil read-only/prefilled) |
| 4 | Nomor HP | Kontak utama | string (tanpa parsing numerik, AD-10), wajib |
| 5 | Kontak Darurat | Nama orang yang dapat dihubungi | string bebas, wajib |
| 6 | Nomor HP Kontak Darurat | — | string, wajib |
| 7 | Hubungan dengan Owner | Hubungan kontak darurat dengan owner | string bebas, wajib |
| 8 | Nama Bank | Rekening penyaluran dividen/insentif/refund (eksekusi pembayaran di luar sistem) | string bebas, wajib |
| 9 | Pemilik Rekening | — | string bebas, wajib |
| 10 | Nomor Rekening | — | string (tanpa parsing numerik, AD-10), wajib |
| — | ~~Referal~~ (#11 di Lampiran A) | Di Google Form diisi saat pendaftaran; di sistem **diajukan saat Pembelian Pertama** (FR-22) | **di luar cakupan story ini** |

Aturan kelengkapan (dipakai CAP-2/CRON CAP-4): field dianggap terisi bila nilai trim non-kosong; Profil lengkap = 10 dari 10 field terisi.
