# Epic 6: Migrasi Historis & Go-Live

Seluruh riwayat transaksi, rekap kepemilikan, data pendaftaran, dan poin Contribution historis dimigrasikan via pintu finalisasi LEDGER lengkap tanpa outbox email; rehearsal staging sampai paritas; backup drill + cutover produksi; Google Sheets pensiun.

### Story 6.1: Ekstraksi & Transformasi Data Sumber

As a COO,
I want seluruh data spreadsheet & form historis diekstraksi ke format import terstruktur,
So that migrasi bisa dijalankan berulang dan terverifikasi tanpa input manual.

**Acceptance Criteria:**

**Given** sumber data historis diidentifikasi
**When** ekstraksi dijalankan
**Then** mencakup: sheet Evidence (riwayat transaksi), rekap kepemilikan, RKAP fase 1 (Initial/Final Requirement + kolom Pemenuhan), harga historis, respons Google Form (Profile 11 field), dan poin Contribution historis yang belum ditunaikan (item + realisasi per owner) (FR-14)

**Given** data owner nyata diproses
**When** artefak ekstraksi disimpan
**Then** TIDAK ada di repo — hanya via env/Supabase storage (kebijakan AGENTS.md); script transform bisa di-commit tanpa menyertakan data

**Given** mapping ditetapkan
**When** transform dijalankan
**Then** kolom Pemenuhan direkonstruksi menjadi plotting alokasi per Capital Item; metode pembayaran historis `'migrasi'` bila tak diketahui; harga historis menjadi `price_periods` berlabel migrasi; poin Contribution menjadi snapshot periode berlabel migrasi (AR-8)

**Given** transform dijalankan dua kali pada sumber yang sama
**When** hasil dibandingkan
**Then** deterministik dan idempotent — tidak ada duplikasi saat re-run

### Story 6.2: Importer Migrasi via Pintu Finalisasi LEDGER

As a owner,
I want data historis masuk lewat pintu yang sama dengan transaksi baru,
So that ledger tetap satu sumber kebenaran yang utuh sejak baris pertama — bukan salinan paralel.

**Acceptance Criteria:**

**Given** importer modul MIGRASI dijalankan
**When** transaksi historis diimpor
**Then** lewat API internal LEDGER pintu finalisasi lengkap sesuai isi AD-2: append ledger + update posisi + plotting alokasi per Capital Item + pencatatan pembayaran historis + event Pembelian Pertama efektif (set `first_effective_at` untuk owner yang pembelian pertamanya historis — transparansi terbuka) + entry audit aktor `system` (AR-8)

**Given** baris historis diimpor
**When** gerbang domain dievaluasi
**Then** TANPA re-validasi gerbang (Strength, ruang RKAP, batas penyesuaian) dan TANPA penyesuaian instant atas baris historis — data spreadsheet otoritatif; gerbang berlaku untuk transaksi baru pasca go-live saja (AR-8)

**Given** transaksi berlabel migrasi difinalisasi
**When** outbox dievaluasi
**Then** TIDAK ada baris outbox email — Bukti migrasi hanya regenerate-on-demand; daftar event diteruskan vs disupres dideklarasikan eksplisit di modul MIGRASI dan diuji pada acceptance (AR-8)

**Given** harga historis diimpor
**When** baris harga dibuat
**Then** `price_periods` berlabel "migrasi" — FK harga pada ledger tidak pernah null (AR-8)

**Given** owner & Profile dari Google Form diimpor
**When** baris owner dibuat
**Then** unik per email dan siap dicocokkan dengan login Google (FR-22)

**Given** poin Contribution historis diimpor
**When** periode dibuat
**Then** menjadi `contribution_period` berlabel migrasi berstatus final dengan snapshot poin imutabel per owner — basis "ter-finalisasi-belum-tertunaikan" untuk RUPS pertama pasca go-live (AD-10; delta FR-14)

**Given** importer dijalankan ulang
**When** data yang sama diproses
**Then** idempotent — tidak ada duplikasi baris (guard/natural keys)

### Story 6.3: Rehearsal Staging & Acceptance Paritas

As a owner,
I want migrasi diulang penuh di staging sampai paritas sempurna,
So that go-live produksi hanya mengulang proses yang sudah terbukti bekerja.

**Acceptance Criteria:**

**Given** lingkungan staging siap (data nyata via env)
**When** dry-run migrasi penuh dijalankan
**Then** seluruh importer (6.2) selesai tanpa error dan idempotent

**Given** hasil import diverifikasi
**When** acceptance dijalankan
**Then** paritas tercapai: Grand Total Quantity 3.622, Shares 5.187, Ceil 14.980; Fulfillment Rate per jenis modal paritas dengan spreadsheet; total poin Contribution per owner paritas dengan sumber; setiap owner eksisting dapat melihat riwayat transaksinya (FR-14; AR-8; gerbang SM-1)

**Given** event yang disupres diuji
**When** import selesai
**Then** tidak ada badai email historis; Bukti migrasi dapat di-regenerate on-demand dan isinya menghitung pada titik potong transaksinya

**Given** rehearsal selesai dan paritas tercapai
**When** proses didokumentasikan
**Then** runbook cutover tersusun dari langkah yang terbukti

### Story 6.4: Kesiapan Operasional Go-Live

As a owner,
I want backup dan pemulihan terbukti sebelum sistem memegang ledger sesungguhnya,
So that ledger — aset taktergantikan — tidak mungkin hilang.

**Acceptance Criteria:**

**Given** proyek Supabase produksi aktif
**When** kesiapan diperiksa
**Then** backup harian/PITR aktif (AR-11)

**Given** drill restore dijalankan
**When** selesai
**Then** SATU drill restore terdokumentasi (prosedur, hasil, durasi) sebelum go-live (AR-11)

**Given** operasional berjalan
**When** kegagalan terjadi
**Then** log terstruktur aktif; retry outbox email yang gagal terlihat (log/alert) — bukan kegagalan senyap (AR-6)

**Given** lingkungan dievaluasi
**When** go-live didekati
**Then** hanya `local` + `production` — tidak ada lingkungan liar (AR-11)

### Story 6.5: Cutover Produksi & Verifikasi Pasca Go-Live

As a owner,
I want cutover produksi berjalan sesuai runbook dengan verifikasi menyeluruh,
So that Google Sheets pensiun dan sistem menjadi satu-satunya sumber kebenaran.

**Acceptance Criteria:**

**Given** runbook final dan semua pihak siap
**When** cutover dieksekusi
**Then** Google Sheets di-freeze (tidak ada pencatatan manual baru) → migrasi produksi dijalankan sesuai runbook → verifikasi paritas sama seperti rehearsal (Grand Total, Fulfillment Rate per jenis modal, poin Contribution, riwayat per owner)

**Given** cutover selesai
**When** operasional baru dimulai
**Then** seluruh transaksi baru dicatat lewat sistem; Google Sheets pensiun sebagai alat pencatatan (target SM-2: berhenti dipakai dalam 1 bulan)

**Given** minggu-minggu pasca go-live
**When** monitoring berjalan
**Then** SM-1 zero discrepancy diawal (3 bulan); SM-3 bukti terkirim 100%; kegagalan outbox terlihat dan di-retry

**Given** cron produksi berjalan
**When** job harian dievaluasi
**Then** kedaluwarsa pesanan hari-7 dan pengingat pendaftar berjalan dengan batas hari zona Asia/Jakarta (AD-9)
