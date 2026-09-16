# Requirements Document

## Introduction

Sip & Dip Ownership Dashboard (Phase 1) adalah dashboard kepemilikan internal cafe Sip & Dip yang menggantikan pencatatan berbasis Google Sheets dan Google Form menjadi satu sumber kebenaran. Sistem memungkinkan Owner memesan pembelian saham secara mandiri dengan validasi otomatis terhadap mekanisme pembobotan (Ceil, Shares, Strength), COO mengonfirmasi pesanan setelah pembayaran diterima (dengan MFA), dashboard kepemilikan selalu mutakhir untuk semua Owner, Bukti Transaksi terkirim otomatis via email, dan keputusan MRO/RUPS tercatat dengan jejak yang jelas.

Dokumen ini mencakup seluruh functional requirement Phase 1 yang in-scope: FR-1 dan FR-3 hingga FR-23, ditambah NFR presisi perhitungan yang berlaku lintas-fitur. FR-2 (penjualan saham dengan harga jual berbeda) berada di luar scope Phase 1 dan ditunda ke Phase 2.

Istilah pada dokumen ini memakai Glossary PRD secara verbatim. Sumber otoritatif: `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md`.

## Cakupan (Scope)

- **In Scope (Phase 1):** FR-1, FR-3 s.d. FR-23; web app responsif untuk 22 Owner eksisting hingga pertumbuhan ~40 Owner.
- **Out of Scope (Phase 2):** FR-2 — penjualan saham dengan harga jual berbeda. Ditandai `[Phase 2]` dan tidak dirinci sebagai acceptance criteria di dokumen ini.
- **Non-Goals:** manajemen Investor, pembayaran/penyaluran otomatis dividen/insentif/Charity, akuntansi/laporan keuangan cafe, aplikasi mobile native, payment gateway, modul voting MRO terautomasi, notifikasi transaksi ke semua Owner, publikasi ke publik luas.

## Glossary

*Istilah dipakai verbatim sesuai PRD §3. Term metrik konsisten berbahasa Inggris; taksonomi jenis modal berbahasa Indonesia.*

- **Owner** — pemegang saham cafe; berhak atas Dividen sesuai Portion dan Insentif sesuai Contribution. Owner tetap menjadi pemilik selama masih memiliki saham atau masih ada poin Contribution yang belum ditunaikan.
- **Keluar** — status Owner tanpa saham yang hak poin Contribution-nya telah ditunaikan pada pembagian laba RUPS; setara Owner tanpa saham yang belum pernah membeli dan dapat aktif kembali.
- **Investor** — pihak dengan penyertaan dana via akad kerjasama di luar porsi kepemilikan saham; tidak dikelola sistem ini (v1).
- **Calon Owner** — pihak yang mendaftar menjadi Owner melalui Pendaftaran Owner; belum pemegang saham. Setelah Terverifikasi namun sebelum transaksi pembelian pertamanya (Owner tanpa saham), keterbukaan informasinya terbatas pada halaman personal.
- **Pendaftaran Owner** — proses registrasi mandiri Calon Owner dengan akun Google: registrasi → melengkapi Profile → verifikasi COO; menggantikan Google Form.
- **Referral** — Owner pengarah yang dicatat saat Pembelian Pertama (bukan saat pendaftaran).
- **Pembelian Pertama** — Pesanan Pembelian pertama seorang Owner yang mencapai transaksi efektif; pesanan yang ditolak, ditarik, atau kedaluwarsa tidak dihitung.
- **Profile** — data diri Owner/Calon Owner mengikuti field Google Form pendaftaran (daftar lengkap: Lampiran A); kelengkapan Profile adalah prasyarat verifikasi COO.
- **Modal Tetap** — jenis modal, plafon 5, bobot 1.
- **Modal Bergerak** — jenis modal, plafon 3, bobot 2.
- **Modal Operasional** — jenis modal, plafon 1, bobot 3.
- **Quantity** — jumlah saham yang dibeli pada suatu transaksi.
- **Shares** — hasil perkalian Quantity dengan bobot jenis modalnya.
- **Portion** — perbandingan total Shares seorang Owner terhadap total Shares seluruh Owner.
- **Ceil** — hasil perkalian Quantity dengan plafon jenis modalnya.
- **Strength** — perbandingan total Shares Owner (gabungan semua jenis modal) terhadap total Ceil-nya. Aturan main: Strength tidak boleh > 100%.
- **RKAP (Rencana Kerja dan Anggaran Perusahaan)** — dokumen rencana & anggaran yang menjadi ruang penyertaan saham Modal Tetap dan Modal Bergerak; dicatat per fase sebagai daftar Capital Item; gerbang pembelian cafe-level.
- **Capital Item** — item kebutuhan pemodalan dalam RKAP: nilai rupiah + tag jenis modal (Tetap/Bergerak; Modal Operasional tidak masuk RKAP).
- **Capital Type** — atribut pembeda jenis modal; nilainya: Modal Tetap, Modal Bergerak, Modal Operasional.
- **Initial Requirement** — nilai rupiah rencana awal suatu Capital Item; dikunci saat MRO menetapkan fase RKAP.
- **Final Requirement** — nilai rupiah Capital Item setelah penyesuaian instant (otomatis maupun manual COO, dalam batas agregat per fase); patokan pemenuhan.
- **Fulfillment** — akumulasi pembelian saham Owner (transaksi efektif) yang teralokasi ke RKAP; tercetak saat COO mengonfirmasi & memvalidasi.
- **Fulfillment Rate** — perbandingan Fulfillment terhadap Final Requirement; gerbang pembelian Modal Tetap/Bergerak menutup saat mencapai 100%.
- **Shortfall** — Final Requirement − Fulfillment (rupiah).
- **Utilization** — realisasi penggunaan modal per Capital Item, diinput COO.
- **Achievement** — perbandingan Utilization terhadap Fulfillment; bisa > 100%.
- **Held** — Fulfillment − Utilization: dana terkumpul yang belum terpakai di lapangan.
- **Rebalancing** — penyeimbangan ulang kebutuhan RKAP saat MRO; relokasi hanya antar Capital Item sejenis, tertaut MoM.
- **Quantity Left** — jumlah saham yang masih dapat dibeli dari sisa ruang RKAP pada harga berjalan.
- **RTL (Remain Trade Limit)** — batas pembelian saham Modal Operasional per Owner agar Strength mencapai titik optimal. Rumus: RTL = `Floor((Ceil − Shares) ÷ 2)`.
- **Actual** — total dana riil yang telah disetorkan seorang Owner untuk membeli saham (akumulasi pembayaran riil).
- **Pesanan Pembelian** — permintaan pembelian saham yang diajukan Owner secara mandiri (atau dicatat COO via jalur langsung). Status: Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa.
- **Antrian Beli** — daftar Pesanan Pembelian yang sudah lolos validasi Strength dan menunggu konfirmasi COO atas pembayaran.
- **Harga Terkunci** — harga berlaku pada tanggal submit Pesanan Pembelian; menjadi harga final transaksi meskipun harga berjalan berubah sebelum konfirmasi.
- **MRO (Meeting Reguler Owner)** — meeting reguler para Owner; forum penetapan jenis Contribution, harga beli/jual saham, dan keputusan lain. Bobot suara mengikuti Portion.
- **RUPS** — Rapat Umum Pemegang Saham; siklus Dividen & tata kelola. Tempat laba diaudit disahkan dan parameter distribusi laba ditetapkan.
- **Laba Dibagikan** — laba diaudit dikurangi laba ditahan; dibagi ke Charity, Dividen (per Portion), Insentif (per Contribution).
- **Charity** — budget pool dari Laba Dibagikan untuk amal; dihitung sistem, penyalurannya di luar sistem.
- **Budget Pool** — nominal alokasi per komponen distribusi = ratio komponen × Laba Dibagikan.
- **Dividen** — komponen Laba Dibagikan untuk Owner, pro-rata Portion: Dividen Owner = Portion × pool Dividen.
- **Insentif** — komponen Laba Dibagikan atas Contribution, pro-rata poin: Insentif Owner = (poin Owner ÷ total poin) × pool Insentif.
- **Contribution** — pengelolaan cafe oleh Owner yang dinilai dalam poin, pada item Contribution yang didefinisikan di MRO.
- **Contribution Period** — rentang antar cut-off Contribution.
- **Bukti Transaksi** — dokumen bukti kepemilikan yang dihasilkan sistem per transaksi dan dikirim ke Owner terkait via email.
- **COO** — role dengan mandat operasional cafe; mengonfirmasi Pesanan Pembelian di Antrian Beli (dengan MFA), memiliki jalur input transaksi langsung, dan mengelola data dasar serta konten.
- **MFA** — multi-factor authentication (OTP via email) yang wajib pada aksi transaksional COO: konfirmasi Pesanan Pembelian dan input transaksi langsung.
- **Sistem** — Sip & Dip Ownership Dashboard (aplikasi web) yang menjadi subjek seluruh requirement pada dokumen ini.

## Requirements

### Requirement 1: FR-1 Pesanan Pembelian mandiri dengan validasi Strength

**User Story:** Sebagai Owner, saya ingin memesan pembelian saham secara mandiri dan langsung tahu apakah pesanan saya lolos mekanisme pembobotan, sehingga saya yakin pesanan saya sah sebelum masuk antrian.

#### Acceptance Criteria

1. WHEN Owner menyusun Pesanan Pembelian dengan memilih Capital Type dan Quantity, THE Sistem SHALL menampilkan pratinjau proyeksi Ceil (= Ceil terkini + (Quantity × plafon)), proyeksi Shares (= Shares terkini + (Quantity × bobot)), proyeksi Strength, dan proyeksi RTL sebelum submit, dengan proyeksi Strength ditampilkan sebagai persentase presisi 2 angka di belakang koma dan proyeksi RTL sebagai bilangan bulat.
2. IF proyeksi Strength Owner > 100%, THEN THE Sistem SHALL menolak Pesanan Pembelian dan menampilkan nilai proyeksi Shares, proyeksi Ceil, proyeksi Strength (persentase presisi 2 angka di belakang koma), serta batas maksimum 100% sebagai dasar penolakan.
3. WHEN memvalidasi Pesanan Pembelian, THE Sistem SHALL menggabungkan posisi terkini Owner dengan seluruh Pesanan Pembelian Owner yang sama yang berstatus Menunggu Konfirmasi.
4. IF gabungan dua Pesanan Pembelian yang masing-masing valid menghasilkan Strength > 100%, THEN THE Sistem SHALL menolak Pesanan Pembelian tersebut.
5. WHILE ruang RKAP untuk Modal Tetap atau Modal Bergerak masih tersedia, THE Sistem SHALL mengizinkan pembelian Modal Tetap dan Modal Bergerak.
6. WHEN Owner memilih membeli Modal Operasional, THE Sistem SHALL mengizinkan pembelian tersebut kapan pun sepanjang validasi Strength lolos, termasuk sebelum RKAP terpenuhi.
7. IF Owner membeli Modal Operasional tanpa kepemilikan Modal Tetap atau Modal Bergerak yang membuka Ceil, THEN THE Sistem SHALL menolak Pesanan Pembelian karena proyeksi Strength > 100%.
8. WHILE masih ada ruang RKAP Modal Tetap dan Modal Bergerak yang terbuka, THE Sistem SHALL menawarkan ketiga Capital Type pada form pesanan.
9. WHEN seluruh ruang RKAP terpenuhi, THE Sistem SHALL menawarkan hanya Modal Operasional pada form pesanan.
10. WHERE Capital Type adalah Modal Tetap atau Modal Bergerak dan batas penyesuaian instant fase belum habis, THE Sistem SHALL menetapkan Quantity maksimal = `ceil(sisa ruang RKAP jenis modal ÷ harga saham berjalan)`, dan jika sisa ruang RKAP jenis modal ≤ 0 maka Quantity maksimal = 0.
11. WHERE batas penyesuaian instant fase telah habis, THE Sistem SHALL menetapkan Quantity maksimal Modal Tetap/Bergerak mengikuti Quantity Left fase (pembulatan ke bawah).
12. WHEN Owner submit Pesanan Pembelian, THE Sistem SHALL mencatat harga berlaku pada tanggal submit sebagai Harga Terkunci pada pesanan.
13. THE Sistem SHALL menghitung Strength sebagai total Shares Owner (gabungan semua Capital Type) dibagi total Ceil Owner.
14. WHEN Owner membeli 2 saham Modal Bergerak, THE Sistem SHALL menghasilkan Quantity 2, Shares 4, Ceil 6, dan Strength 66,67%.
15. IF Quantity yang dimasukkan Owner bukan bilangan bulat, kurang dari 1, atau melebihi Quantity maksimal yang berlaku, THEN THE Sistem SHALL menolak submit Pesanan Pembelian dan menampilkan pesan yang menunjukkan rentang Quantity yang diperbolehkan (minimal 1 sampai Quantity maksimal).

### Requirement 2: FR-2 Penjualan dengan harga jual berbeda `[Phase 2 — Out of Scope]`

**User Story:** Sebagai Owner, saya ingin menjual saham dengan harga jual yang berlaku, sehingga saya dapat melepas kepemilikan sesuai mekanisme pasar internal.

#### Acceptance Criteria

1. THE Sistem SHALL menunda seluruh fungsi penjualan saham ke Phase 2; requirement ini tidak diimplementasikan pada Phase 1 dan dirinci saat Phase 2 dirancang.

### Requirement 3: FR-3 MFA untuk aksi transaksional COO

**User Story:** Sebagai COO, saya ingin aksi transaksional saya dilindungi faktor kedua, sehingga finalisasi transaksi terjamin keamanannya.

#### Acceptance Criteria

1. WHEN COO mengonfirmasi Pesanan Pembelian atau melakukan input transaksi langsung, THE Sistem SHALL meminta MFA berupa OTP via email sebelum transaksi efektif.
2. IF faktor kedua MFA belum terverifikasi, THEN THE Sistem SHALL menahan transaksi agar tidak efektif.
3. WHEN Owner submit Pesanan Pembelian, THE Sistem SHALL memproses submit tanpa meminta MFA.
4. WHEN permintaan MFA terjadi, THE Sistem SHALL mencatat permintaan tersebut di audit trail.

### Requirement 4: FR-4 Tabel kepemilikan per Owner

**User Story:** Sebagai Owner, saya ingin melihat tabel kepemilikan per Owner, sehingga saya dapat memeriksa posisi kepemilikan dengan angka yang konsisten.

#### Acceptance Criteria

1. THE Sistem SHALL menampilkan tabel per Owner yang memuat Quantity, Shares, Portion, Ceil, Strength, Actual, RTL, dan baris Grand Total.
2. THE Sistem SHALL menampilkan Portion dengan presisi 2 angka di belakang koma.
3. THE Sistem SHALL menyertakan seluruh Owner aktif pada baris Grand Total.
4. WHEN transaksi pertama seorang Owner menjadi efektif, THE Sistem SHALL menampilkan Owner tersebut pada tabel secara otomatis tanpa intervensi manual.
5. WHEN Strength Owner sudah optimal (paling mendekati atau tepat 100%), THE Sistem SHALL menampilkan RTL Owner tersebut bernilai 0.

### Requirement 5: FR-5 Visualisasi komposisi kepemilikan

**User Story:** Sebagai Owner, saya ingin melihat chart komposisi kepemilikan, sehingga saya memahami proporsi Portion tiap Owner secara visual.

#### Acceptance Criteria

1. THE Sistem SHALL menampilkan chart komposisi Portion per Owner pada dashboard.
2. WHEN daftar Owner bertambah, THE Sistem SHALL menambahkan label Owner baru pada chart secara otomatis tanpa menghilangkan label Owner mana pun.
3. THE Sistem SHALL menjaga chart selalu sinkron dengan tabel kepemilikan.

### Requirement 6: FR-6 CMS harga saham — harga berjalan & riwayat

**User Story:** Sebagai COO, saya ingin mengelola harga beli & jual melalui CMS, sehingga harga berjalan dan riwayatnya tercatat dengan jejak keputusan MRO.

#### Acceptance Criteria

1. WHEN COO menetapkan harga beli & jual baru, THE Sistem SHALL menyimpan nilai harga, tanggal efektif, dan referensi MoM MRO penetapnya.
2. THE Sistem SHALL menampilkan harga berjalan dan menyimpan seluruh riwayat harga yang pernah dipakai.
3. WHEN transaksi Pesanan Pembelian di-submit, THE Sistem SHALL memakai harga berlaku pada tanggal submit sebagai Harga Terkunci.
4. WHEN COO melakukan input transaksi langsung, THE Sistem SHALL memakai harga berlaku pada tanggal input.
5. THE Sistem SHALL menampilkan harga berjalan dan seluruh riwayat harga kepada semua Owner, termasuk Owner tanpa saham.

### Requirement 7: FR-7 Pencatatan MoM MRO/RUPS

**User Story:** Sebagai COO, saya ingin menyimpan notulen MRO/RUPS di sistem, sehingga keputusan para Owner tercatat dan dapat ditautkan ke aturan yang berlaku.

#### Acceptance Criteria

1. WHEN COO menyimpan MoM MRO/RUPS, THE Sistem SHALL menyimpan MoM dengan tanggal.
2. THE Sistem SHALL mengizinkan MoM ditautkan ke keputusan harga, jenis Contribution, dan cut-off.
3. WHILE MoM berstatus draft, THE Sistem SHALL mengizinkan MoM diedit hingga final.

### Requirement 8: FR-8 Definisi item Contribution

**User Story:** Sebagai COO, saya ingin mendefinisikan item Contribution hasil keputusan MRO, sehingga penilaian Contribution memakai poin kuantitatif yang jelas.

#### Acceptance Criteria

1. WHEN COO mendefinisikan item Contribution, THE Sistem SHALL menyimpan nama, deskripsi, poin kuantitatif, periode berlaku, dan tautan MoM penetapannya.
2. THE Sistem SHALL menyimpan poin setiap item Contribution sebagai angka kuantitatif.

### Requirement 9: FR-9 Pencatatan realisasi Contribution

**User Story:** Sebagai COO, saya ingin mencatat realisasi Contribution per Owner, sehingga Owner dapat melihat poin Contribution berjalannya.

#### Acceptance Criteria

1. WHEN COO mencatat realisasi Contribution seorang Owner pada item yang telah didefinisikan, THE Sistem SHALL menyimpan tanggal pencatatan dan identitas pencatat.
2. WHILE Owner login, THE Sistem SHALL menampilkan poin Contribution berjalan Owner tersebut di dashboard.
3. THE Sistem SHALL menampilkan poin Contribution berjalan pada rekap COO.

### Requirement 10: FR-10 Cut-off Contribution Period dengan carry-over

**User Story:** Sebagai COO, saya ingin memicu cut-off Contribution Period pada tanggal yang ditetapkan, sehingga poin yang memenuhi syarat difinalkan dan sisanya terbawa ke periode berikutnya.

#### Acceptance Criteria

1. WHEN COO memicu cut-off pada tanggal yang ditetapkan, THE Sistem SHALL memfinalkan Contribution yang memenuhi syarat sebagai dasar Insentif dan menandainya selesai.
2. WHEN cut-off dilakukan, THE Sistem SHALL me-carry over Contribution yang belum diberi insentif ke periode berikutnya.
3. WHEN cut-off dilakukan, THE Sistem SHALL menghasilkan rekap yang memisahkan Contribution yang sudah diberi insentif dari yang di-carry over.
4. THE Sistem SHALL memastikan Contribution yang sudah diberi insentif tidak muncul lagi pada periode berikutnya.
5. WHEN periode Contribution baru dimulai, THE Sistem SHALL menampilkan saldo carry-over sejak awal periode.

### Requirement 11: FR-11 Generate & kirim Bukti Transaksi

**User Story:** Sebagai Owner, saya ingin menerima Bukti Transaksi setiap transaksi efektif, sehingga saya memiliki alat klaim kepemilikan yang sah.

#### Acceptance Criteria

1. WHEN sebuah transaksi pembelian menjadi efektif (via konfirmasi COO atau input langsung), THE Sistem SHALL menghasilkan Bukti Transaksi dan mengirimkannya ke Owner terkait via email.
2. THE Bukti Transaksi SHALL memuat identitas Owner, tanggal, Capital Type, Quantity, harga, Shares, Ceil, Strength, dan Portion setelah transaksi.
3. WHEN Owner meminta unduh ulang, THE Sistem SHALL menyediakan Bukti Transaksi untuk diunduh ulang kapan pun oleh Owner terkait.
4. THE Sistem SHALL memformat Bukti Transaksi mengikuti Template Konfirmasi Pembelian Saham v3 yang berlaku.

### Requirement 12: FR-12 Audit trail permanen

**User Story:** Sebagai COO, saya ingin seluruh aksi tercatat permanen, sehingga rekonsiliasi dan penelusuran keputusan selalu dapat dilakukan.

#### Acceptance Criteria

1. WHEN aksi submit, tarik, kedaluwarsa, konfirmasi, atau tolak Pesanan Pembelian terjadi, THE Sistem SHALL mencatat aktor, waktu, dan detail aksi pada audit trail.
2. WHEN transaksi input langsung, penetapan harga, cut-off, atau perubahan data dasar terjadi, THE Sistem SHALL mencatat aktor, waktu, dan detail pada audit trail.
3. THE Sistem SHALL menyimpan catatan audit trail sebagai catatan yang tidak dapat diubah dan tidak dapat dihapus.
4. THE Sistem SHALL menampilkan audit trail hanya kepada COO.
5. WHEN Pesanan Pembelian ditolak saat submit maupun saat re-validasi konfirmasi, THE Sistem SHALL mencatat alasan dan hitungan penolakan pada audit trail.

### Requirement 13: FR-13 Manajemen data Owner

**User Story:** Sebagai COO, saya ingin menambah dan mengelola data Owner, sehingga saya dapat memilih Owner mana pun saat input transaksi dan mengelola statusnya.

#### Acceptance Criteria

1. WHEN COO menambah atau mengelola data Owner, THE Sistem SHALL menyimpan identitas, kontak WA/email, dan status Owner.
2. THE Sistem SHALL mengelola akun Owner baik yang berasal dari Pendaftaran Owner mandiri maupun input COO.
3. THE Sistem SHALL mengizinkan COO memilih Owner yang telah terdaftar (termasuk sebelum transaksi pertamanya) saat input transaksi.
4. THE Sistem SHALL memakai kontak Owner untuk pengiriman Bukti Transaksi dan OTP MFA.
5. THE Sistem SHALL merepresentasikan status Owner sebagai salah satu dari: pemegang saham; tanpa saham yang belum pernah membeli (akses terbatas halaman personal); atau Keluar.
6. WHEN bagian Insentif Owner tanpa saham telah ditunaikan pada rekap RUPS, THE Sistem SHALL menandai Owner tersebut berstatus Keluar.
7. WHERE Owner berstatus Keluar membeli saham lagi hingga transaksi efektif, THE Sistem SHALL mengaktifkan kembali Owner tersebut dengan transparansi penuh.
8. THE Sistem SHALL mempertahankan seluruh jejak historis Owner berstatus Keluar pada audit trail.

### Requirement 14: FR-14 Migrasi data historis

**User Story:** Sebagai COO, saya ingin memigrasikan seluruh data historis dari Google Sheets & Google Form, sehingga dashboard dapat go-live dengan saldo dan riwayat yang utuh.

#### Acceptance Criteria

1. WHEN migrasi dijalankan, THE Sistem SHALL memigrasikan seluruh riwayat transaksi (termasuk yang tercatat di sheet Evidence) dan rekap kepemilikan dari Google Sheets.
2. WHEN migrasi dijalankan, THE Sistem SHALL memigrasikan data pendaftaran historis dari Google Form sebagai Profile Owner/Calon Owner.
3. THE Sistem SHALL menghasilkan Grand Total hasil migrasi yang cocok dengan rekap spreadsheet sumber (Quantity 3.622, Shares 5.187, Ceil 14.980 untuk 22 Owner eksisting).
4. WHEN Owner eksisting login pasca-migrasi, THE Sistem SHALL menampilkan riwayat transaksinya.

### Requirement 15: FR-15 Role dan hak akses

**User Story:** Sebagai pengelola sistem, saya ingin membedakan role Calon Owner, Owner, dan COO, sehingga hak akses sesuai dengan mandat masing-masing.

#### Acceptance Criteria

1. THE Sistem SHALL membedakan role Calon Owner, Owner, dan COO dengan hak akses masing-masing.
2. THE Sistem SHALL memastikan transaksi menjadi efektif hanya melalui konfirmasi COO atau input langsung COO.
3. IF Owner mencoba memfinalisasi transaksi, THEN THE Sistem SHALL menolak aksi tersebut.
4. THE Sistem SHALL mengizinkan Owner hanya melihat dan menarik Pesanan Pembelian miliknya sendiri.
5. WHILE Profile Calon Owner belum lengkap, THE Sistem SHALL mengizinkan Calon Owner mengakses hanya kelengkapan Profile-nya sendiri.
6. WHILE Owner berstatus tanpa saham (Terverifikasi, belum pernah membeli) atau Keluar, THE Sistem SHALL membuka akses hanya pada: Profile & Pesanan Pembelian miliknya, harga berjalan & riwayat harga, tabel RKAP beserta progress-nya, dan rekap distribusi laba selama Owner masih memiliki poin Contribution yang belum ditunaikan.
7. WHILE Owner berstatus tanpa saham atau Keluar, THE Sistem SHALL mengunci akses pada tabel/chart kepemilikan seluruh Owner, Contribution, MoM, dan audit trail.
8. WHEN transaksi pembelian pertama Owner menjadi efektif, THE Sistem SHALL membuka seluruh akses yang sebelumnya terkunci bagi Owner tersebut secara otomatis.

### Requirement 16: FR-16 Simulasi & rekap distribusi laba

**User Story:** Sebagai COO, saya ingin sistem menghitung distribusi laba RUPS ke tiga komponen, sehingga setiap Owner melihat angka bagiannya secara transparan.

#### Acceptance Criteria

1. WHEN COO menginput laba diaudit dan laba ditahan, THE Sistem SHALL menghitung Laba Dibagikan = laba diaudit − laba ditahan.
2. THE Sistem SHALL menghitung tiga budget pool: pool Charity = ratio Charity × Laba Dibagikan, pool Dividen = ratio Dividen × Laba Dibagikan, pool Insentif = ratio Insentif × Laba Dibagikan.
3. THE Sistem SHALL menerima ratio komponen (Charity, Dividen, Insentif) sebagai parameter yang ditetapkan saat RUPS.
4. THE Sistem SHALL menghitung Dividen Owner = Portion × pool Dividen.
5. THE Sistem SHALL menghitung Insentif Owner = (poin Contribution Owner ÷ total poin) × pool Insentif.
6. THE Sistem SHALL mengalokasikan pool Charity utuh untuk amal sebagai komponen di luar bagian Owner.
7. THE Sistem SHALL memakai poin periode yang telah difinalkan cut-off sebagai basis poin Insentif.
8. WHEN bagian Insentif Owner tanpa saham telah ditunaikan pada rekap RUPS, THE Sistem SHALL mengubah status Owner tersebut menjadi Keluar.
9. THE Sistem SHALL menampilkan rekap yang memuat laba diaudit, laba ditahan, Laba Dibagikan, tiga budget pool, dan rincian per Owner (Dividen + Insentif + total hak).
10. WHEN laba diaudit 12.000.000 dan laba ditahan 2.000.000 dengan ratio Charity 5%, Dividen 41%, Insentif 54%, THE Sistem SHALL menghasilkan Laba Dibagikan 10.000.000, pool Charity 500.000, pool Dividen 4.100.000, pool Insentif 5.400.000; dan untuk Owner dengan Contribution 50% dan Portion 40% menghasilkan Insentif 2.700.000 + Dividen 1.640.000 = total 4.340.000.
11. THE Sistem SHALL menampilkan rekap distribusi laba sesuai matriks keterbukaan: kepada Owner pemegang saham, dan kepada Owner tanpa saham hanya selama masih memiliki poin Contribution yang belum ditunaikan.

### Requirement 17: FR-17 Pergantian COO

**User Story:** Sebagai para Owner, kami ingin peran COO dapat dialihkan ke Owner lain, sehingga mandat operasional dapat berpindah sesuai keputusan MRO/RUPS.

#### Acceptance Criteria

1. WHEN peran COO dialihkan ke Owner lain, THE Sistem SHALL mencatat keputusan tersebut dengan referensi MoM pada audit trail.
2. WHEN pergantian COO terjadi, THE Sistem SHALL mengembalikan COO lama menjadi Owner biasa dan mencabut akses transaksionalnya.
3. THE Sistem SHALL mencatat setiap transaksi atas nama pejabat COO yang bertugas pada saat transaksi tersebut.

### Requirement 18: FR-18 Chart-chart dashboard (paritas dengan spreadsheet)

**User Story:** Sebagai Owner, saya ingin melihat chart-chart dashboard setara spreadsheet saat ini, sehingga visualisasi kepemilikan tetap familiar dan mutakhir.

#### Acceptance Criteria

1. THE Sistem SHALL menampilkan pie "Portion Kepemilikan" dengan label nama Owner dan persentase Portion.
2. THE Sistem SHALL menampilkan donut dua cincin "Distribusi Pemodalan" dengan cincin dalam per Capital Type dan cincin luar per Owner.
3. THE Sistem SHALL menampilkan stacked bar "Big Cap" yang menyandingkan Shares vs Ceil per kelompok kap, dengan kelompok agregat Medium Cap dan Small Cap menampung sisanya.
4. THE Sistem SHALL menjaga ketiga chart selalu sinkron dengan data tabel terbaru.
5. WHEN daftar Owner bertambah, THE Sistem SHALL menampilkan Owner baru pada pie dan donut, serta menghitung ulang kelompok Big/Medium/Small Cap dari Portion terkini secara otomatis.
6. THE Sistem SHALL menghitung ambang kelompok kap dari nilai berjalan (Big Cap > 5%, Medium Cap > 2%, Small Cap ≤ 2%) dan mengizinkan ambang dikonfigurasi.

### Requirement 19: FR-19 Antrian Beli & siklus hidup pesanan

**User Story:** Sebagai Owner, saya ingin memantau dan menarik Pesanan Pembelian saya di Antrian Beli, sehingga saya mengendalikan pesanan saya hingga dikonfirmasi.

#### Acceptance Criteria

1. THE Sistem SHALL menetapkan status setiap Pesanan Pembelian sebagai salah satu dari: Menunggu Konfirmasi, Terkonfirmasi, Ditolak, atau Kedaluwarsa.
2. WHEN status Pesanan Pembelian berubah, THE Sistem SHALL mencatat perubahan tersebut pada audit trail.
3. WHILE Pesanan Pembelian berstatus Menunggu Konfirmasi, THE Sistem SHALL mengizinkan Owner menarik pesanannya, mengeluarkannya dari Antrian Beli, dan mencatat peristiwa penarikan pada audit trail.
4. WHEN Pesanan Pembelian belum dikonfirmasi hingga hari ke-7 sejak submit, THE Sistem SHALL menandai pesanan tersebut Kedaluwarsa secara otomatis.
5. WHEN Pesanan Pembelian Owner Kedaluwarsa, THE Sistem SHALL mengizinkan Owner membuat pesanan baru dengan harga berjalan saat submit baru.
6. THE Sistem SHALL menampilkan seluruh Antrian Beli hanya kepada COO.
7. THE Sistem SHALL menampilkan hanya Pesanan Pembelian miliknya sendiri kepada masing-masing Owner.
8. WHEN sebuah Pesanan Pembelian baru masuk Antrian Beli, THE Sistem SHALL mengirim notifikasi email kepada COO.

### Requirement 20: FR-20 Konfirmasi COO dengan re-validasi & pencatatan pembayaran

**User Story:** Sebagai COO, saya ingin mengonfirmasi Pesanan Pembelian setelah pembayaran diterima dengan re-validasi kondisi terkini, sehingga hanya transaksi yang sah menjadi efektif.

#### Acceptance Criteria

1. WHEN COO mengonfirmasi Pesanan Pembelian, THE Sistem SHALL menuntut pencatatan tanggal pembayaran dan metode transfer serta verifikasi MFA berhasil sebelum transaksi menjadi efektif, dan SHALL menolak konfirmasi bila salah satu dari ketiga input tersebut belum lengkap disertai indikasi field yang belum terisi.
2. IF verifikasi MFA gagal, THEN THE Sistem SHALL menahan transaksi agar tidak menjadi efektif, menampilkan indikasi kegagalan verifikasi, dan SHALL memblokir konfirmasi setelah 3 percobaan MFA gagal berturut-turut dalam jendela waktu 300 detik.
3. IF tanggal pembayaran yang dicatat bernilai kosong atau melewati tanggal saat ini (tanggal masa depan), THEN THE Sistem SHALL menolak pencatatan pembayaran disertai indikasi kesalahan yang menyebutkan atribut tanggal pembayaran, dan tidak mengubah status pesanan.
4. WHEN COO mengonfirmasi Pesanan Pembelian, THE Sistem SHALL melakukan re-validasi Strength, ruang RKAP untuk Modal Tetap dan Modal Bergerak, serta keabsahan referral pada Pembelian Pertama memakai kondisi terkini.
5. IF re-validasi gagal, THEN THE Sistem SHALL mengubah status pesanan menjadi Ditolak disertai penjelasan yang menyebutkan pemeriksaan spesifik yang gagal (Strength, ruang RKAP Modal Tetap, ruang RKAP Modal Bergerak, atau keabsahan referral) beserta nilai hitungan terkait, dan tidak menjadikan transaksi efektif.
6. WHEN transaksi menjadi efektif, THE Sistem SHALL memakai Harga Terkunci saat submit sebagai harga final meskipun harga berjalan telah berubah.
7. WHEN transaksi menjadi efektif, THE Sistem SHALL menambah Fulfillment RKAP dengan nilai transaksi efektif.
8. WHERE pesanan bertipe Modal Tetap atau Modal Bergerak, WHEN transaksi menjadi efektif, THE Sistem SHALL mengizinkan COO menetapkan plotting alokasi ke Capital Item dan SHALL menerapkan urutan FIFO sebagai default bila COO tidak menetapkan plotting.
9. WHEN Pesanan Pembelian ditolak saat konfirmasi meski dana telah masuk, THE Sistem SHALL mencatat resolusi pengalihan atau refund pada audit trail.
10. WHEN transaksi menjadi efektif, THE Sistem SHALL memperbarui dashboard, rekap, dan chart, serta mengirim Bukti Transaksi kepada Owner terkait.

### Requirement 21: FR-21 Jalur input langsung COO

**User Story:** Sebagai COO, saya ingin mencatat pembelian saham langsung atas nama Owner, sehingga pembayaran tunai di cafe tetap tercatat dengan validasi yang sama.

#### Acceptance Criteria

1. WHEN COO mencatat pembelian langsung atas nama Owner, THE Sistem SHALL menerapkan validasi Strength yang sama seperti FR-1, menuntut pencatatan tanggal dan metode pembayaran, dan verifikasi MFA sebelum transaksi efektif.
2. WHEN COO melakukan input langsung, THE Sistem SHALL memakai harga berlaku pada tanggal input.
3. WHEN transaksi jalur langsung menjadi efektif, THE Sistem SHALL memproses transaksi tanpa melewati Antrian Beli dan mencatatnya pada audit trail sebagai input langsung.
4. WHERE input langsung merupakan Pembelian Pertama Owner, THE Sistem SHALL mewajibkan penyertaan referral dengan pilihan dan validasi yang sama seperti FR-22.

### Requirement 22: FR-22 Pendaftaran Owner mandiri

**User Story:** Sebagai Calon Owner, saya ingin mendaftar secara mandiri dengan akun Google, sehingga saya dapat menjadi Owner tanpa entri manual dan tahu langkah yang belum saya lengkapi.

#### Acceptance Criteria

1. WHEN Calon Owner mendaftar, THE Sistem SHALL memakai akun Google dan mengizinkan halaman pendaftaran diakses langsung tanpa link referral.
2. WHEN pendaftaran diajukan, THE Sistem SHALL menetapkan status pendaftaran sebagai Diajukan, dan hanya mengizinkan transisi berikutnya ke salah satu dari: Terverifikasi, Ditolak, atau Kedaluwarsa.
3. WHEN COO memverifikasi atau menolak pendaftaran, THE Sistem SHALL mencatat aktor, waktu, dan jenis aksi (verifikasi atau tolak) pada audit trail.
4. IF Profile Calon Owner belum lengkap (belum seluruh field wajib Profile pada Lampiran A terisi), THEN THE Sistem SHALL membuat aksi verifikasi tidak tersedia bagi COO untuk pendaftar tersebut.
5. WHEN Profile Calon Owner belum lengkap pada hari ke-3 kalender (zona waktu Asia/Jakarta) sejak tanggal pengajuan, THE Sistem SHALL mengirim satu email pengingat kepada Calon Owner tersebut.
6. WHEN Profile Calon Owner belum lengkap hingga hari ke-7 kalender (zona waktu Asia/Jakarta) sejak tanggal pengajuan, THE Sistem SHALL menandai pendaftaran berstatus Kedaluwarsa secara otomatis.
7. WHILE Owner berstatus tanpa saham (Terverifikasi, belum pernah membeli), THE Sistem SHALL menyediakan halaman personal minimal berisi Profile, portofolio & status Pesanan Pembelian miliknya, dan pembuatan Pesanan Pembelian dengan harga berjalan.
8. WHEN seluruh Pesanan Pembelian Owner diajukan sebelum Pembelian Pertamanya efektif, THE Sistem SHALL mewajibkan penyertaan referral dengan pilihan Owner eksisting pemegang saham (termasuk COO) atau Owner baru yang belum pernah membeli saham.
9. WHEN COO mengonfirmasi Pembelian Pertama, THE Sistem SHALL memvalidasi keabsahan referral, termasuk cross-referral antar dua Owner pembeli perdana pada hari kalender yang sama (zona waktu Asia/Jakarta).
10. WHEN transaksi pembelian pertama Owner menjadi efektif, THE Sistem SHALL membuka seluruh keterbukaan yang sebelumnya terkunci secara otomatis.
11. THE Sistem SHALL mengautentikasi seluruh akun (Owner eksisting & COO) memakai akun Google, dicocokkan lewat email saat migrasi.

### Requirement 23: FR-23 Pencatatan & pelacakan RKAP

**User Story:** Sebagai COO, saya ingin mencatat dan melacak RKAP per fase, sehingga gerbang pembelian Modal Tetap/Bergerak dan penyesuaian instant terkelola dengan batas yang jelas.

#### Acceptance Criteria

1. WHEN COO mencatat RKAP fase, THE Sistem SHALL menyimpan daftar Capital Item dalam bentuk tabel dengan kolom nama, Capital Type (Tetap/Bergerak), Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, dan Held.
2. THE Sistem SHALL menghitung ruang per Capital Type sebagai akumulasi Final Requirement seluruh Capital Item Capital Type tersebut.
3. WHEN MRO menetapkan fase, THE Sistem SHALL mengunci Initial Requirement setiap Capital Item sehingga nilainya tidak dapat diubah selama fase berjalan.
4. THE Sistem SHALL menggerakkan Final Requirement dari nilai Initial hanya melalui penyesuaian instant otomatis (overshoot pembulatan) atau penyesuaian manual COO, tanpa mekanisme perubahan lain.
5. WHERE COO melakukan penyesuaian manual, THE Sistem SHALL mengizinkan hanya menaikkan Final Requirement item eksisting (nilai baru ≥ nilai saat ini) dan menambahkan Capital Item baru ke fase berjalan.
6. THE Sistem SHALL membatasi akumulasi seluruh penyesuaian RKAP per fase (otomatis maupun manual) agar tidak melebihi (1% × total Initial Requirement fase) + harga beli 1 saham berjalan.
7. IF penyesuaian manual COO menyebabkan akumulasi penyesuaian fase melebihi batas pada kriteria 6, THEN THE Sistem SHALL menolak penyesuaian tersebut, mempertahankan nilai Final Requirement sebelumnya, dan menampilkan pesan yang mengindikasikan batas penyesuaian fase telah tercapai beserta sisa kuota penyesuaian.
8. WHEN sisa kuota penyesuaian fase lebih kecil dari overshoot pembulatan ke atas untuk 1 saham berikutnya, THE Sistem SHALL tidak menawarkan pembulatan ke atas dan menetapkan Quantity maksimal sejumlah Quantity Left fase.
9. WHEN transaksi dengan pembulatan ke atas menjadi efektif, THE Sistem SHALL menaikkan Final Requirement Capital Item ter-plot sebesar overshoot dan mencatatnya pada audit trail sebagai penyesuaian instant.
10. WHEN Fulfillment Rate suatu Capital Type mencapai 100%, THE Sistem SHALL menutup gerbang pembelian Capital Type tersebut sehingga tidak ada transaksi baru Capital Type tersebut yang dapat di-plot.
11. WHEN COO memvalidasi transaksi (konfirmasi FR-20 atau input langsung FR-21), THE Sistem SHALL menetapkan plotting alokasi Fulfillment ke Capital Item sesuai penetapan COO, dengan default berurutan (FIFO) bila COO tidak menetapkan plotting lain.
12. IF plotting alokasi Fulfillment menyebabkan Fulfillment suatu Capital Item melebihi Final Requirement-nya, THEN THE Sistem SHALL menolak plotting tersebut dan menampilkan pesan yang mengindikasikan alokasi melebihi Final Requirement Capital Item.
13. THE Sistem SHALL menampilkan tabel RKAP beserta progress-nya kepada semua Owner, termasuk Owner tanpa saham.

### Requirement 24: NFR-1 Presisi perhitungan (lintas-fitur, cross-cutting NFR)

**User Story:** Sebagai Owner, saya ingin seluruh perhitungan pecahan konsisten dan presisi, sehingga tidak ada selisih hitungan Portion yang memicu ketidakpercayaan.

#### Acceptance Criteria

1. THE Sistem SHALL menghitung seluruh nilai pecahan dengan presisi 2 angka di belakang koma memakai pembulatan half-up (nilai desimal ≥ 5 dibulatkan ke atas).
2. THE Sistem SHALL menampilkan total Portion apa adanya (mis. 99,99% atau 100,01%) meskipun terjadi selisih akibat pembulatan.
