# Ekstraksi Riset PRD — Sip & Dip Ownership Dashboard (Phase 1)

Sumber: `{planning_artifacts}/prds/prd-snd-dash-2026-08-14/prd.md` (status: **final**, created 2026-08-14, updated 2026-09-15)

---

## 1. Produk & Tujuan

**Produk:** "Sip & Dip Ownership Dashboard" — dashboard kepemilikan **internal** cafe Sip & Dip, Phase 1 mencakup **pembelian saham** saja (penjualan menyusul Phase 2). "Kontrak WHAT" untuk PM, arsitek, dan workflow turunan (UX, architecture, epics & stories).

**Masalah yang diselesaikan:** Saat ini seluruh pencatatan hidup di Google Sheets — setiap pembelian saham memaksa update banyak sheet sekaligus, owner baru menambah beban karena chart juga harus berubah. "Salah hitung Portion bukan sekadar ketidaknyamanan — ini berpotensi memicu ketidakpercayaan di antara para owner." Produk mengubahnya menjadi "satu sumber kebenaran": pesanan tervalidasi otomatis terhadap mekanisme pembobotan, finalisasi oleh COO setelah pembayaran diterima, dashboard selalu mutakhir, Bukti Transaksi terkirim otomatis, keputusan MRO tercatat dengan jejak jelas. Menggantikan Google Sheets + Google Form; **bukan** dokumen keuangan cafe.

**Target users (§2):**
- **Owner (pembeli saham)** — JTBD: *"Saya ingin memesan pembelian saham sendiri dan langsung tahu apakah pesanan saya lolos mekanisme pembobotan (Ceil, Shares dan Strength valid) — tanpa bergantung pada pencatatan orang lain — dan yakin pesanan saya baru final setelah pembayaran saya disetujui."*
- **Owner (penonton umum)** — *"Saya ingin melihat komposisi kepemilikan cafe secara transparan kapan pun, tanpa harus membuka banyak file yang statusnya terkadang masih rancu — tidak jelas apakah sudah termutakhir."*
- **Calon Owner** — *"Saya ingin mendaftar jadi owner sendiri dari rumah dan tahu persis langkah apa yang belum saya lengkapi, tanpa harus bertanya ke siapa-siapa."*
- **COO** — *"Saya ingin mengonfirmasi pesanan pembelian begitu pembayaran benar-benar diterima — sekali konfirmasi, semua rekapan-chart-bukti terupdate otomatis; sistem yang memvalidasi Strength, bukan hitungan manual saya."*

**Persona UJ (fiktif, konvensi dokumentasi):** Bima (calon owner → pembeli pertama, dari HP), Dewi (calon owner via pendaftaran mandiri), Hanif (owner kontributor, cek dari HP), Rani (COO). COO saat ini: **Sugeng Winanjuar**; role harus dapat berpindah antar owner (FR-17).

**Non-users (v1):** Investor (akad kerjasama di luar saham), publik umum. Halaman pendaftaran dapat dijangkau siapa pun yang tahu alamatnya; akses penuh terbatas owner terverifikasi.

**Skala:** 22 owner eksisting + pertumbuhan hingga ~40; Grand Total migrasi Quantity 3.622, Shares 5.187, Ceil 14.980.

## 2. Form-factor & Platform

- **Web app responsif** (§6.1) — eksplisit. **Aplikasi mobile native adalah Non-Goal** (§5): "web app responsif memadai untuk 22–40 owner."
- Entry state journey menunjukkan pemakaian dominan **di browser HP** (UJ-1: "login sebagai owner di browser HP"; UJ-2: "login sebagai owner (viewer) dari browser HP"; UJ-6: "membuka halaman pendaftaran dari browser HP (belum punya akun)"); COO membuka web app (UJ-3, UJ-4: "di web app").
- **Autentikasi: akun Google** untuk seluruh akun (owner eksisting & COO), dicocokkan lewat email saat migrasi (FR-22).
- Kanal email sistem: Bukti Transaksi, MFA OTP (COO), notifikasi pesanan baru ke COO, email pengingat pendaftar.
- Browser spesifik, ukuran layar/breakpoint, UI component system (shadcn/MUI/dll.): **TIDAK DINYATAKAN**.

## 3. Fitur / Epics / User Stories

### Feature groups (§4) & Functional Requirements (nama verbatim)

**§4.1 Transaksi Saham**
- **FR-1: Pesanan Pembelian mandiri dengan validasi Strength** — form pesanan (Jenis Modal, Quantity, referral wajib pada Pembelian Pertama) + **pratinjau hitungan** (proyeksi Ceil/Shares/Strength/RTL, Harga Terkunci) sebelum submit; penolakan dengan pesan yang menunjukkan hitungannya; pilihan jenis modal mengikuti kondisi RKAP; Quantity maksimal pembulatan ke atas/bawah. → **UI: form pesanan + preview + error state terhitung**
- **FR-2: Penjualan dengan harga jual berbeda — `[Phase 2]`** (bukan Phase 1)
- **FR-3: MFA untuk aksi transaksional COO** — OTP via email untuk konfirmasi & input langsung; owner tanpa MFA (Phase 1). → **UI: alur OTP**
- **FR-19: Antrian Beli & siklus hidup pesanan** — owner melihat status pesanannya & menariknya selama Menunggu Konfirmasi; kedaluwarsa otomatis hari ke-7; COO melihat seluruh Antrian Beli; owner hanya melihat pesanan miliknya; notifikasi email ke COO per pesanan baru. → **UI: daftar antrian (2 varian role), aksi tarik, status 4-state**
- **FR-20: Konfirmasi COO dengan re-validasi & pencatatan pembayaran** — isi tanggal + metode transfer (tanpa upload bukti), MFA, re-validasi, penolakan dengan penjelasan hitungan, saran pengalihan ke Modal Operasional/refund, plotting alokasi Capital Item (default FIFO). → **UI: form konfirmasi multi-langkah**
- **FR-21: Jalur input langsung COO** — catat pembelian tunai atas nama owner; pilih owner mana pun; validasi + MFA sama. → **UI: form input COO**
- **FR-23: Pencatatan & pelacakan RKAP** — tabel tersendiri Capital Item (nama, jenis modal, Initial/Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held) + agregat per jenis modal + ringkasan batas penyesuaian (1% + 1 saham) + Quantity Left; penyesuaian manual COO; rebalancing; terlihat semua owner termasuk tanpa saham. → **UI: tabel RKAP + ringkasan + edit COO**

**§4.2 Dashboard Kepemilikan**
- **FR-4: Tabel kepemilikan per owner** — kolom Quantity, Shares, Portion, Ceil, Strength, Actual, RTL + Grand Total; Portion 2 desimal; owner baru muncul otomatis. → **UI: tabel utama**
- **FR-5: Visualisasi komposisi kepemilikan** — chart Portion per owner, label otomatis (25 → ~40 owner). → **UI: chart**
- **FR-18: Chart-chart dashboard (paritas dengan spreadsheet saat ini)** — 1) **Pie "Portion Kepemilikan"** (label nama + persentase); 2) **Donut dua cincin "Distribusi Pemodalan"** (cincin dalam per jenis modal, cincin luar per owner); 3) **Stacked bar "Big Cap"** (Shares vs Ceil per kelompok kap; ambang Big > 5%, Medium > 2%, Small ≤ 2%, dapat dikonfigurasi). → **UI: 3 chart spesifik**

**§4.3 Harga Saham & Keputusan MRO**
- **FR-6: CMS harga saham — harga berjalan & riwayat** — harga beli & jual, nilai baru efektif per tanggal, tertaut MoM MRO; riwayat lengkap; terlihat semua owner termasuk tanpa saham. → **UI: CMS + halaman harga publik-owner**
- **FR-7: Pencatatan MoM MRO/RUPS** — notulen + draft editable hingga final, tertaut keputusan. → **UI: CMS dokumen MoM**

**§4.4 Contribution & Insentif**
- **FR-8: Definisi item Contribution** — nama, deskripsi, poin kuantitatif, periode berlaku, tertaut MoM. → **UI: CMS item**
- **FR-9: Pencatatan realisasi Contribution** — per owner per item; owner melihat poin berjalan di dashboard; rekap COO. → **UI: input COO + tampilan owner**
- **FR-10: Cut-off Contribution Period dengan carry-over** — input tanggal cut-off; rekap memisahkan sudah-diberi-insentif vs carry-over; saldo carry-over tampil di periode baru. → **UI: aksi cut-off + rekap**

**§4.5 Distribusi Laba RUPS**
- **FR-16: Simulasi & rekap distribusi laba** — input laba diaudit & laba ditahan; sistem hitung Laba Dibagikan → 3 budget pool (Charity, Dividen, Insentif; ratio parameter RUPS; patokan MRO terakhir: Charity 5%, Dividen 41%, Insentif 54%); rekap per owner; perbandingan rekap sebelumnya. → **UI: modul simulasi/input + rekap**

**§4.6 Bukti Transaksi & Audit Trail**
- **FR-11: Generate & kirim Bukti Transaksi** — per transaksi efektif via email; isi: identitas owner, tanggal, jenis modal, Quantity, harga, Shares, Ceil, Strength, Portion setelah transaksi; dapat diunduh ulang kapan pun; format "Template Konfirmasi Pembelian Saham v3". → **UI: halaman/aksi unduh bukti**
- **FR-12: Audit trail permanen** — semua aksi tercatat (aktor, waktu, detail); hanya dapat dilihat COO; penolakan tercatat lengkap dengan alasan dan hitungannya. → **UI: log viewer COO-only**

**§4.7 Data Dasar & Migrasi**
- **FR-13: Manajemen data owner** — tambah/kelola owner (identitas, kontak WA/email, status); status owner 3 kategori; reaktivasi owner Keluar. → **UI: CRUD owner COO**
- **FR-22: Pendaftaran owner mandiri** — daftar dengan akun Google → status **Diajukan** → lengkapi Profile (Lampiran A; prasyarat) → verifikasi COO → **Terverifikasi**/**Ditolak** (dengan alasan); referral diajukan saat Pembelian Pertama (bukan saat pendaftaran), validasi cross-referral; email pengingat + kedaluwarsa otomatis pendaftar tak lengkap (jangka waktu final ditentukan saat tahap UX); halaman personal owner tanpa saham minimal: Profile, portofolio & status Pesanan Pembelian miliknya, pembuatan Pesanan Pembelian (dengan harga berjalan). → **UI: halaman pendaftaran publik, halaman kelengkapan Profile + status, halaman personal**
- **FR-14: Migrasi data historis** — riwayat transaksi (termasuk sheet Evidence), rekap kepemilikan, data Google Form → saldo & riwayat utuh; owner eksisting dapat melihat riwayat transaksinya pasca-migrasi. → **UI: riwayat transaksi per owner**

**§4.8 Akses & Keamanan**
- **FR-15: Role dan hak akses** — 3 tingkat: Calon Owner, Owner, COO; **matriks keterbukaan owner tanpa saham** (Terbuka: Profile & Pesanan miliknya, harga & riwayat, tabel RKAP, rekap distribusi laba selama masih punya poin belum ditunaikan; Terkunci: tabel/chart kepemilikan, Contribution, MoM, audit trail). → **mempengaruhi seluruh navigasi & visibility**
- **FR-17: Pergantian COO** — alih peran ke owner lain (keputusan MRO/RUPS, referensi MoM); COO lama kembali Owner biasa. → **UI: aksi admin**

### Key User Journeys (§2.3, judul verbatim)
- **UJ-1.** Owner memesan pembelian saham secara mandiri; COO mengonfirmasi setelah pembayaran diterima. (Edge cases: Strength > 100% ditolak dengan penjelasan hitungan; re-validasi gagal → Ditolak + saran pengalihan/refund; kedaluwarsa hari ke-7; penarikan mandiri; varian tunai via FR-21)
- **UJ-2.** Owner memeriksa Portion dan poin Contribution-nya dari HP.
- **UJ-3.** MRO menetapkan harga saham baru dan sistem mencatat keputusannya.
- **UJ-4.** Cut-off Contribution: insentif yang akan dibayar, sisa terbawa.
- **UJ-5.** RUPS membagikan laba dalam bentuk charity, dividen, dan insentif: sistem menghitung, manusia membayar.
- **UJ-6.** Calon owner mendaftar mandiri hingga halaman personal terbuka. (Edge case: verifikasi butuh Profile lengkap; Ditolak dengan alasan tercatat)

### MVP Scope (§6.1)
"FR-1, FR-3 s.d. FR-23" + "Web app responsif; 22 owner eksisting + pertumbuhan hingga ~40." Phase 2 = FR-2 saja (§6.2).

## 4. Kebutuhan UX tersirat

**Layar/permukaan UI yang tersirat [inferensi dari FR/UJ]:**
1. Login Google (semua role) + pencocokan email migrasi
2. Halaman pendaftaran mandiri (publik via URL, tanpa link referral) + status pendaftaran (Diajukan / Terverifikasi / Ditolak dengan alasan)
3. Halaman kelengkapan Profile (11 field Lampiran A, indikator "langkah apa yang belum saya lengkapi" per UJ-6/Calon Owner JTBD) + email pengingat
4. **Halaman personal** owner tanpa saham (Profile, portofolio & status pesanan, pembuatan Pesanan Pembelian, harga berjalan, tabel RKAP)
5. Form **Pesanan Pembelian**: pilih Jenis Modal (pilihan dinamis per kondisi RKAP), Quantity (dengan Quantity maksimal), referral (wajib hingga Pembelian Pertama efektif, pilihan owner eksisting/owner baru), **panel pratinjau hitungan** (proyeksi Ceil, Shares, Strength, RTL, Harga Terkunci), submit
6. **Antrian Beli**: tampilan COO (seluruh pesanan + notifikasi email per pesanan baru) vs tampilan owner (hanya miliknya) + aksi tarik pesanan
7. Form **konfirmasi COO**: tanggal & metode transfer, plotting alokasi Capital Item (default FIFO), MFA OTP, hasil re-validasi (termasuk penolakan dengan penjelasan hitungan & saran pengalihan/refund)
8. Form **input langsung COO**: pilih owner, jenis modal, quantity, referral bila pembelian pertama, pembayaran, MFA
9. **Dashboard kepemilikan**: tabel (Quantity, Shares, Portion, Ceil, Strength, Actual, RTL, Grand Total) + 3 chart (pie Portion, donut dua cincin, stacked bar Big Cap) — selalu sinkron
10. **Tabel RKAP** + ringkasan per jenis modal + batas penyesuaian + Quantity Left; edit COO (Final Requirement, Capital Item baru, Utilization, rebalancing)
11. **Halaman/section Contribution**: poin berjalan per owner (period aktif + saldo carry-over), rekap COO, definisi item, aksi cut-off
12. **Modul distribusi laba**: input laba diaudit & ditahan, simulasi 3 pool, rekap per owner, perbandingan rekap sebelumnya
13. **CMS harga saham**: harga berjalan + riwayat (nilai, tanggal efektif, referensi MRO) — tampilan owner
14. **MoM MRO/RUPS**: list/draft/final, edit hingga final, tautan ke keputusan
15. **Riwayat transaksi & unduh Bukti Transaksi** per owner (format Template Konfirmasi Pembelian Saham v3)
16. **Audit trail viewer** — COO saja
17. **Manajemen owner** (CRUD COO): identitas, kontak, status, pergantian COO

**State yang harus dirancang:**
- Status pesanan 4-state: **Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa** (penarikan = peristiwa, bukan status)
- Error/penolakan **dengan penjelasan hitungannya** (berulang di FR-1, FR-20, FR-23) — penolakan harus edukatif
- MFA OTP (COO): state menunggu OTP, gagal, sukses
- Kedaluwarsa otomatis (pesanan hari ke-7; pendaftaran tak lengkap — jangka waktu TBD UX)
- Empty state [inferensi]: dashboard, antrian, riwayat, RKAP, MoM, Contribution bagi owner baru
- Loading/sinkronisasi chart-tabel [inferensi]
- Status pendaftaran: Diajukan, Terverifikasi, Ditolak (+alasan)
- Status owner: pemegang saham / tanpa saham (belum pernah beli; bekas pemegang [Phase 2]) / Keluar (+reaktivasi)
- Keluarnya Bukti Transaksi: sukses kirim, unduh ulang

**Peran/permission yang memengaruhi UI:**
- 3 role: **Calon Owner** (verifikasi mandiri; Terverifikasi → halaman personal saja), **Owner** (dashboard, Contribution, Bukti Transaksi sendiri; buat & tarik pesanan sendiri), **COO** (konfirmasi Antrian Beli + input langsung + MFA; kelola konten & data dasar; audit trail)
- **Matriks keterbukaan owner tanpa saham** (juga untuk Keluar): Terbuka — Profile & pesanan miliknya, harga berjalan & riwayat, tabel RKAP & progress, rekap distribusi laba (selama masih ada poin belum ditunaikan); Terkunci — tabel/chart kepemilikan semua owner, Contribution, MoM, audit trail; semua terkunci terbuka **otomatis** setelah transaksi pertama efektif
- Antrian Beli privat per owner; audit trail COO-only; grand total mencakup seluruh owner aktif

**Interaksi kunci:** pratinjau hitungan live sebelum submit; pilihan jenis modal dinamis terhadap kondisi RKAP; penarikan pesanan sendiri; konfirmasi satu-klik COO yang men-trigger update dashboard+rekap+chart+bukti; cut-off dengan carry-over; input harga baru dengan tanggal efektif.

## 5. Non-fungsional yang memengaruhi UX

- **Presisi perhitungan (NFR §4.8):** "Presisi seluruh perhitungan pecahan: 2 angka di belakang koma, pembulatan half-up (≥5 dibulatkan ke atas); total Portion ditampilkan apa adanya meski 99,99%/100,01% karena pembulatan."
- **Performa/alur kerja (SM-4):** "COO menyelesaikan konfirmasi satu pesanan (pencatatan pembayaran + re-validasi + MFA) < 5 menit."
- **Akurasi/kepercayaan (SM-1, SM-2):** zero discrepancy Portion 3 bulan; Google Sheets berhenti dipakai dalam 1 bulan.
- **Skalabilitas tampilan:** chart & label owner otomatis dari 25 saat ini hingga ~40 (FR-5, FR-18); kelompok kap dihitung ulang otomatis.
- **Paritas dengan spreadsheet & template eksisting:** 3 chart "setara dengan yang ada di Google Sheets hari ini", tabel RKAP "paritas dengan tabel RKAP di spreadsheet saat ini", bukti mengikuti "Template Konfirmasi Pembelian Saham v3" — UX harus mengenali pola familiar para owner [inferensi].
- **Email sebagai kanal wajib:** Bukti Transaksi, OTP MFA COO, notifikasi pesanan baru ke COO, pengingat pendaftar.
- **Counter-metric (SM-C1):** "Jumlah transaksi — tidak untuk dioptimalkan" — jangan desain untuk mendorong transaksi.
- **Accessibility, i18n, dark mode, offline, dukungan browser spesifik: TIDAK DINYATAKAN.** (Konvensi bahasa istilah ada di Glossary — lihat §7/§9.)

## 6. Batasan & Out of scope

**Non-Goals eksplisit (§5, verbatim):**
- **Manajemen Investor** (akad penyertaan dana di luar saham) — `[NOTE FOR PM: dimuat secara emosional di visi "full public ownership" — kunjungi ulang bila komitmen pemodalan owner berubah]`
- **Pembayaran dividen/insentif & penyaluran Charity otomatis** — eksekusi pembayaran/penyaluran tetap proses luar sistem
- **Akuntansi/laporan keuangan cafe** — laporan kuartalan signed tetap dalam proses yang ada
- **Aplikasi mobile native**
- **Pembayaran online / payment gateway** — pembayaran di kanal luar (transfer/tunai); sistem hanya mencatat tanggal dan metode
- **Modul voting MRO terautomasi** — v1: MoM + hasil keputusan yang diinput
- **Notifikasi transaksi ke semua owner** — v1: bukti hanya ke owner terkait
- **Publikasi ke publik luas** — dashboard internal saja

**Lain-lain:** Penjualan saham (FR-2) = Phase 2; upload bukti pembayaran tidak ada (FR-20 "tanpa upload bukti"); link referral bukan syarat akses pendaftaran; sistem tidak menduplikasi dokumen keuangan cafe.

## 7. Nada & bahasa

Tidak ada statement voice/tone/branding eksplisit — **TIDAK DINYATAKAN** untuk nada brand. Namun ada konvensi istilah yang mengikat (§3 Glossary): "taksonomi memakai **jenis modal** (Modal Tetap, Modal Bergerak, Modal Operasional) — hindari 'jenis saham'; unit transaksinya disebut saham jenis modal terkait (mis. '2 Saham Modal Bergerak'); term metrik konsisten berbahasa Inggris (Quantity, Shares, Ceil, Strength, Portion, Contribution, Actual, RTL, Initial/Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held)." Nilai yang berulang di visi: **transparansi, kepercayaan, satu sumber kebenaran** [inferensi untuk tone].

## 8. Open Questions / TODO dalam PRD

- **Jangka waktu kedaluwarsa pendaftaran tak lengkap**: "pendaftarannya kedaluwarsa otomatis (jangka waktu final **ditentukan saat tahap UX**)" (FR-22) — satu-satunya TODO eksplisit yang dialamatkan ke UX.
- **FR-2 (Phase 2):** "alurnya (owner-initiated atau via COO) ditentukan saat Phase 2 dirancang."
- **NOTE FOR PM** pada Non-Goal Investor (kunjungi ulang bila komitmen pemodalan owner berubah).
- §8 menyatakan "Tidak ada asumsi aktif — seluruhnya telah dikonfirmasi" — tidak ada open question lain; riwayat 24 asumsi terjawat terindeks di §8.

## 9. Istilah kunci

*Istilah Glossary (§3) — "Workflow turunan wajib memakai istilah ini verbatim":*

Owner, Keluar, Investor, Calon Owner, Pendaftaran Owner, Referral, Pembelian Pertama, Profile, **Modal Tetap** (plafon 5, bobot 1), **Modal Bergerak** (plafon 3, bobot 2), **Modal Operasional** (plafon 1, bobot 3), Quantity, Shares, Portion, Ceil, Strength, **RKAP (Rencana Kerja dan Anggaran Perusahaan)**, Capital Item, Capital Type, Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held, Rebalancing, Quantity Left, **RTL (Remain Trade Limit)**, Actual, **Pesanan Pembelian**, **Antrian Beli**, **Harga Terkunci**, **MRO (Meeting Reguler Owner)**, **RUPS**, **Laba Dibagikan**, Charity, Budget Pool, Dividen, Insentif, Contribution, Contribution Period, **Bukti Transaksi**, **COO**, **MFA**.

Status/label penting lain (harus konsisten di UI): Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa, Diajukan, Terverifikasi; label field Profile per Lampiran A (Nama Lengkap, Alias, Gmail, Nomor HP, Kontak Darurat, Nomor HP Kontak Darurat, Hubungan dengan Owner, Nama Bank, Pemilik Rekening, Nomor Rekening, Referal); label chart "Portion Kepemilikan", "Distribusi Pemodalan", "Big Cap" / `[Medium Cap]` / `[Small Cap]`; label spreadsheet legacy untuk paritas: "Porsi", "Ratio", "Kontribusi", "Item Pemodalan", "Jenis Modal", "Keb. Awal", "Keb. Final", "Pemenuhan", "Terpenuhi", "Kekurangan", "Pemanfaatan", "Pencapaian", "Tertahan", "Qty Left".
