---
title: PRD — Sip & Dip Ownership Dashboard (Phase 1)
status: final
created: 2026-08-14
updated: 2026-09-15
---

# PRD: Sip & Dip Ownership Dashboard (Phase 1)

## 0. Tujuan Dokumen
Dokumen ini menjadi kontrak WHAT untuk pembangunan Sip & Dip Ownership Dashboard, dashboard kepemilikan internal cafe Sip & Dip — mencakup **Phase 1** (pembelian saham); penjualan saham menyusul di Phase 2 (§6.2). Ditujukan bagi PM, arsitek, dan workflow turunan (UX, architecture, epics & stories). Struktur: kosakata dikunci di Glossary (§3), fitur dikelompokkan dengan FR bernomor global stabil (FR-1…FR-N); seluruh asumsi telah dikonfirmasi — riwayatnya di §8. Menggantikan praktik pencatatan Google Sheets yang ada saat ini; tidak menduplikasi dokumen keuangan cafe (lihat §5).

## 1. Vision
Sip & Dip adalah cafe dengan konsep full public ownership: kepemilikan tersebar di banyak owner dengan aturan main lokal yang unik, yaitu segmentasi jenis modal (Modal Tetap, Modal Bergerak, Modal Operasional), pembobotan yang membentuk Ceil, Shares, dan Strength untuk membatasi penyertaan modal, serta perbedaan antara harga beli dan harga jual seperti halnya jual beli logam mulia. Hari ini seluruh pencatatan hidup di Google Sheets: setiap pembelian saham memaksa update banyak sheet sekaligus, dan owner baru menambah beban karena chart juga harus berubah. Salah hitung Portion bukan sekadar ketidaknyamanan — ini berpotensi memicu ketidakpercayaan di antara para owner.

Sip & Dip Ownership Dashboard mengubahnya menjadi satu sumber kebenaran: owner memesan pembelian saham secara mandiri dan pesanannya tervalidasi otomatis terhadap mekanisme pembobotan sebelum masuk antrian, finalisasi tetap di tangan COO begitu pembayaran diterima, dashboard kepemilikan selalu mutakhir untuk semua owner, bukti transaksi terkirim otomatis ke masing-masing owner, dan keputusan-keputusan yang disepakati para owner dalam Meeting Reguler Owner (MRO) tercatat dengan jejak yang jelas. COO (seorang owner dengan mandat khusus mengawal operasional cafe) mendapat alat kerja untuk menghilangkan pekerjaan manual; sementara para owner lainnya mendapat transparansi yang bisa dipercaya tanpa harus membuka spreadsheet. Transparansi penuh berlaku antar owner pemegang saham — owner tanpa saham (Terverifikasi, belum pernah membeli) hanya mendapat halaman personal.

## 2. Target User

### 2.1 Jobs To Be Done
- **Owner (pembeli saham)**: "Saya ingin memesan pembelian saham sendiri dan langsung tahu apakah pesanan saya lolos mekanisme pembobotan (Ceil, Shares dan Strength valid) — tanpa bergantung pada pencatatan orang lain — dan yakin pesanan saya baru final setelah pembayaran saya disetujui."
- **Owner (penonton umum)**: "Saya ingin melihat komposisi kepemilikan cafe secara transparan kapan pun, tanpa harus membuka banyak file yang statusnya terkadang masih rancu — tidak jelas apakah sudah termutakhir."
- **Calon Owner**: "Saya ingin mendaftar jadi owner sendiri dari rumah dan tahu persis langkah apa yang belum saya lengkapi, tanpa harus bertanya ke siapa-siapa."
- **COO**: "Saya ingin mengonfirmasi pesanan pembelian begitu pembayaran benar-benar diterima — sekali konfirmasi, semua rekapan-chart-bukti terupdate otomatis; sistem yang memvalidasi Strength, bukan hitungan manual saya."

### 2.2 Non-Users (v1)
- **Investor** (penyertaan dana via akad kerjasama di luar saham); manajemen investor eksplisit di luar scope.
- **Publik umum** — bukan pengguna; dashboard hanya untuk lingkungan internal owner Sip & Dip. Halaman pendaftaran dapat dijangkau siapa pun yang mengetahui alamatnya; akses penuh sistem tetap terbatas owner terverifikasi. Aturan pendaftaran dan keterbukaan: FR-22 dan §4.8.

### 2.3 Key User Journeys
*Persona dalam UJ (Bima, Dewi, Hanif, Rani) fiktif — konvensi dokumentasi, bukan nama asli.*

- **UJ-1. Owner memesan pembelian saham secara mandiri; COO mengonfirmasi setelah pembayaran diterima.**
  - **Persona + konteks:** Bima, calon owner hasil Pendaftaran mandiri UJ-6 (Terverifikasi, Profile lengkap), ingin membeli saham pertamanya dari rumah.
  - **Entry state:** login sebagai owner di browser HP, membuka menu Pesanan Pembelian.
  - **Path:** pilih Jenis Modal & Quantity + menyertakan referral (wajib pada pembelian pertama — Bima menunjuk owner eksisting yang memperkenalkannya) → sistem memvalidasi dengan mekanisme pembobotan gabungan (posisi aktual terkini + pesanan Bima yang sudah ada di antrian) → pratinjau hitungan (proyeksi Ceil, Shares, dan Strength, Harga Terkunci) → Bima Submit → pesanan berstatus Menunggu Konfirmasi di Antrian Beli → Bima transfer via kanal pembayaran luar → Rani (COO) membuka Antrian Beli, mencatat tanggal & metode transfer, mengonfirmasi dengan MFA → sistem re-validasi mekanisme pembobotan terkini → transaksi efektif.
  - **Climax:** dashboard, rekap, chart, dan bukti transaksi terupdate otomatis; Bima menerima bukti via email.
  - **Resolution:** owner baru tampil di dashboard tanpa intervensi manual; tidak ada transaksi final tanpa konfirmasi COO.
  - **Edge case:** Strength > 100% saat submit → pesanan ditolak sebelum masuk antrian dengan penjelasan hitungannya; re-validasi gagal saat konfirmasi → pesanan ditolak dengan penjelasan (dana yang sudah masuk disarankan dialihkan ke Modal Operasional atau direfund); pembayaran tak kunjung diterima → pesanan kedaluwarsa otomatis pada hari ke-7 sejak submit; Bima dapat menarik pesanannya sendiri selama Menunggu Konfirmasi (keluar dari antrian, tercatat di audit trail).
  - **Varian:** owner membayar tunai di cafe → Rani memakai jalur input langsung (FR-21) dengan validasi mekanisme pembobotan & MFA yang sama.

- **UJ-2. Owner memeriksa Portion dan poin Contribution-nya dari HP.**
  - **Persona + konteks:** Hanif, owner yang aktif berkontribusi untuk cafe, ingin cek posisi dan Contribution-nya sebelum MRO.
  - **Entry state:** login sebagai owner (viewer) dari browser HP.
  - **Path:** buka dashboard → lihat detail kepemilikan (Actual, Quantity, Shares, Portion, Ceil, Strength, RTL) → buka halaman Contribution → lihat poin Contribution berjalan periode aktif.
  - **Climax:** angka yang dilihat identik dengan yang akan dipakai dalam diskusi MRO — satu sumber kebenaran.
  - **Resolution:** Hanif datang ke MRO dengan kepercayaan penuh pada angka.

- **UJ-3. MRO menetapkan harga saham baru dan sistem mencatat keputusannya.**
  - **Persona + konteks:** Para owner di suatu MRO memutuskan kenaikan harga saham setelah melihat aspek keuangan.
  - **Entry state:** COO membuka menu harga saham di web app.
  - **Path:** input harga beli & jual baru disertai tanggal mulai berlakunya → sistem menyimpan harga dengan catatan "ditetapkan di MRO tanggal X".
  - **Climax:** transaksi berikutnya otomatis memakai harga baru; harga lama tetap terlihat historisnya.
  - **Resolution:** tidak ada lagi harga yang hidup di "ingatan kolektif" atau chat.

- **UJ-4. Cut-off Contribution: insentif yang akan dibayar, sisa terbawa.**
  - **Persona + konteks:** Rani (COO) menutup Contribution Period dengan tanggal cut-off yang ditetapkan saat RUPS (tanggal cut-off tidak harus bertepatan dengan tanggal RUPS).
  - **Entry state:** COO membuka menu Contribution di web app.
  - **Path:** Rani menginput tanggal cut-off → sistem memfinalkan poin Contribution yang memenuhi syarat (Contribution dilakukan hingga tanggal cut-off) sebagai dasar pembagian Insentif (FR-16) → poin tersebut ditandai selesai → sisanya di-carry over ke periode berikutnya.
  - **Climax:** rekap cut-off terbit — poin sah tiap owner sebagai dasar pembagian pool Insentif (FR-16), apa yang terbawa ke periode berikutnya.
  - **Resolution:** periode baru dimulai dengan saldo carry-over yang jelas.

- **UJ-5. RUPS membagikan laba dalam bentuk charity, dividen, dan insentif: sistem menghitung, manusia membayar.**
  - **Persona + konteks:** Para owner di RUPS tahunan; laba cafe telah diaudit.
  - **Entry state:** COO membuka modul distribusi laba; data Portion dan Contribution periode berjalan sudah mutakhir di sistem.
  - **Path:** input laba diaudit & laba ditahan → sistem menampilkan Laba Dibagikan → sistem menghitung nominal Charity + bagian tiap owner (Dividen sesuai Portion + Insentif sesuai Contribution) → rekap disimpan tertaut RUPS tersebut.
  - **Climax:** setiap owner melihat angka bagiannya sendiri — transparan dan bisa diverifikasi silang.
  - **Resolution:** pembayaran dilakukan lewat kanal luar; rekap tersimpan sebagai rekam jejak RUPS.

- **UJ-6. Calon owner mendaftar mandiri hingga halaman personal terbuka.**
  - **Persona + konteks:** Dewi, mengenal Sip & Dip dari owner eksisting, ingin ikut memodali cafe.
  - **Entry state:** membuka halaman pendaftaran dari browser HP (belum punya akun).
  - **Path:** daftar dengan akun Google → pendaftaran berstatus Diajukan → Dewi melengkapi Profile sesuai daftar field Lampiran A → Rani (COO) memverifikasi (Profile lengkap sebagai prasyarat) → akun aktif berstatus Terverifikasi → halaman personal terbuka: Profile, portofolio & pesanannya sendiri, dan pembuatan Pesanan Pembelian.
  - **Climax:** tanpa satu pun entri manual dari COO, Dewi sampai ke pintu Pesanan Pembelian (lanjut ke UJ-1); dashboard kepemilikan, Contribution, dan MoM tetap terkunci sampai transaksi pertamanya efektif.
  - **Resolution:** Google Form pensiun; pendaftaran hidup di sistem dengan jejak verifikasi; transparansi penuh menunggu Dewi jadi pemegang saham.
  - **Edge case:** verifikasi memerlukan Profile lengkap — COO tidak dapat memverifikasi pendaftar yang belum lengkap; pendaftaran ditolak COO → status Ditolak dengan alasan tercatat.

## 3. Glossary
*Workflow turunan wajib memakai istilah ini verbatim. Konvensi istilah: taksonomi memakai **jenis modal** (Modal Tetap, Modal Bergerak, Modal Operasional) — hindari "jenis saham"; unit transaksinya disebut saham jenis modal terkait (mis. "2 Saham Modal Bergerak"); term metrik konsisten berbahasa Inggris (Quantity, Shares, Ceil, Strength, Portion, Contribution, Actual, RTL, Initial/Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held).*

- **Owner** — pemegang saham cafe; berhak atas dividen sesuai Portion dan insentif sesuai Contribution. Berbeda dengan Investor yang berdasakan akad kerjasama. Owner tetap menjadi pemilik selama masih memiliki saham **atau** masih ada poin Contribution yang belum ditunaikan: owner yang sahamnya nol (Portion 0) tidak punya bobot suara di MRO, namun tetap owner sampai hak Contribution-nya ditunaikan pada RUPS — setelah itu dinyatakan **Keluar**.
- **Keluar** — status owner tanpa saham yang hak poin Contribution-nya telah ditunaikan pada pembagian laba RUPS; setara owner tanpa saham yang belum pernah membeli dan dapat aktif kembali (FR-13).
- **Investor** — pihak dengan penyertaan dana via akad kerjasama di luar porsi kepemilikan saham. Tidak dikelola sistem ini (v1).
- **Calon Owner** — pihak yang mendaftar menjadi owner melalui Pendaftaran Owner; belum pemegang saham. Setelah Terverifikasi namun sebelum transaksi pembelian pertamanya (owner tanpa saham), keterbukaan informasinya terbatas pada halaman personal; menjadi Owner penuh (transparansi penuh) setelah transaksi pembelian pertamanya efektif.
- **Pendaftaran Owner** — proses registrasi mandiri calon owner dengan akun Google: registrasi → melengkapi Profile → verifikasi COO; menggantikan Google Form.
- **Referral** — owner pengarah yang dicatat saat **Pembelian Pertama** (bukan saat pendaftaran); pilihan referral dan validasi cross-referral diatur di FR-22. Label field Google Form: "Referal" (Lampiran A).
- **Pembelian Pertama** — Pesanan Pembelian pertama seorang owner yang mencapai transaksi efektif; pesanan sebelumnya yang ditolak, ditarik, atau kedaluwarsa tidak dihitung. Menjadi penentu kewajiban menyertakan referral (FR-22) dan pembuka keterbukaan antar owner (§4.8).
- **Profile** — data diri owner/calon owner yang mengikuti field Google Form pendaftaran saat ini (daftar lengkap: Lampiran A); kelengkapan Profile adalah prasyarat verifikasi COO.
- **Modal Tetap** — jenis modal, plafon 5, bobot 1.
- **Modal Bergerak** — jenis modal, plafon 3, bobot 2.
- **Modal Operasional** — jenis modal, plafon 1, bobot 3.
- **Quantity** — jumlah saham yang dibeli pada suatu transaksi.
- **Shares** — hasil perkalian Quantity dengan bobot jenis modalnya.
- **Portion** — perbandingan total Shares seorang owner terhadap total Shares seluruh owner. Sebelumnya disebut "Porsi" (label kolom spreadsheet saat ini).
- **Ceil** — hasil perkalian Quantity dengan plafon jenis modalnya.
- **Strength** — perbandingan total Shares owner (gabungan semua jenis modal) terhadap total Ceil-nya; mencerminkan **kekuatan** saham owner — sahamnya tidak mungkin diminta untuk dijual kepada owner lain. Aturan main: **Strength tidak boleh > 100%** (FR-1). Sebelumnya disebut "Ratio".
- **RKAP (Rencana Kerja dan Anggaran Perusahaan)** — dokumen rencana & anggaran yang menjadi **ruang penyertaan saham Modal Tetap dan Modal Bergerak**: kesepakatan para owner, dicatat per fase sebagai daftar Capital Item; gerbang pembelian cafe-level — mekanisme lengkap di FR-23.
- **Capital Item** — item kebutuhan pemodalan dalam RKAP (mis. kulkas): nilai rupiah + tag jenis modal (Tetap/Bergerak; Modal Operasional tidak masuk RKAP). Label spreadsheet saat ini: "Item Pemodalan".
- **Capital Type** — atribut pembeda jenis modal pada suatu unit data; nilainya tetap berbahasa Indonesia: Modal Tetap, Modal Bergerak, Modal Operasional. Label spreadsheet saat ini: "Jenis Modal".
- **Initial Requirement** — nilai rupiah rencana awal suatu Capital Item; disepakati dan dikunci saat MRO menetapkan fase RKAP. Label spreadsheet: "Keb. Awal".
- **Final Requirement** — nilai rupiah Capital Item setelah penyesuaian instant — otomatis (overshoot pembulatan) maupun manual COO, dalam batas agregat per fase (FR-23); menjadi patokan pemenuhan. Label spreadsheet: "Keb. Final".
- **Fulfillment** — akumulasi pembelian saham owner (transaksi efektif) yang teralokasi ke RKAP; tercetak saat COO mengonfirmasi & memvalidasi (FR-20). Label spreadsheet: "Pemenuhan".
- **Fulfillment Rate** — perbandingan Fulfillment terhadap Final Requirement; gerbang pembelian Modal Tetap/Modal Bergerak menutup saat mencapai 100%. Label spreadsheet: "Terpenuhi".
- **Shortfall** — Final Requirement − Fulfillment (rupiah). Label spreadsheet: "Kekurangan".
- **Utilization** — realisasi di lapangan penggunaan modal per Capital Item, diinput COO (terpisah dari Fulfillment/pembelian saham). Label spreadsheet: "Pemanfaatan".
- **Achievement** — perbandingan Utilization terhadap Fulfillment; bisa > 100% — pemicu rebalancing kebutuhan RKAP saat MRO. Label spreadsheet: "Pencapaian".
- **Held** — Fulfillment − Utilization: dana terkumpul yang belum terpakai di lapangan. Label spreadsheet: "Tertahan".
- **Rebalancing** — penyeimbangan ulang kebutuhan RKAP yang dilakukan saat MRO; relokasi hanya antar Capital Item sejenis (Modal Tetap ke Modal Tetap, Modal Bergerak ke Modal Bergerak), tertaut MoM.
- **Quantity Left** — jumlah saham yang masih dapat dibeli dari sisa ruang RKAP pada harga berjalan: pembulatan ke atas selama overshoot-nya tertampung batas penyesuaian instant fase (FR-1), pembulatan ke bawah bila batas telah habis (FR-23). Label spreadsheet: "Qty Left".
- **RTL (Remain Trade Limit)** — batas pembelian saham Modal Operasional per owner agar Strength mencapai titik optimal (paling mendekati atau tepat 100%); berlaku kapan pun — ruang Operasional dibuka oleh kepemilikan Modal Tetap/Modal Bergerak owner, tidak menunggu RKAP terpenuhi. Rumus: RTL = `Floor((Ceil − Shares) ÷ 2)` (FR-1, FR-4).
- **Actual** — total dana riil yang telah disetorkan seorang owner untuk membeli saham (akumulasi pembayaran riil).
- **Pesanan Pembelian** — permintaan pembelian saham yang diajukan owner secara mandiri (atau dicatat COO via jalur langsung). Status: Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa. Pesanan yang ditarik owner keluar dari Antrian Beli dan hanya tercatat di audit trail (bukan status).
- **Antrian Beli** — daftar Pesanan Pembelian yang sudah lolos validasi Strength dan menunggu konfirmasi COO atas pembayaran (siklus hidup: FR-19).
- **Harga Terkunci** — harga berlaku pada tanggal submit Pesanan Pembelian; menjadi harga final transaksi meskipun harga berjalan berubah sebelum konfirmasi.
- **MRO (Meeting Reguler Owner)** — meeting reguler para owner; forum penetapan jenis Contribution, harga beli/jual saham, dan keputusan lain melalui suara owner. Bobot suara mengikuti Portion — Portion 0 berarti tanpa bobot suara; keputusan diambil bila didukung > 50% total bobot suara (bukan jumlah orang).
- **RUPS** — Rapat Umum Pemegang Saham; siklus dividen & tata kelola (berbeda dari siklus cut-off Contribution). Tempat laba diaudit disahkan dan parameter distribusi laba ditetapkan.
- **Laba Dibagikan** — laba diaudit dikurangi laba ditahan; dibagi ke tiga komponen — Charity, Dividen (per Portion), Insentif (per Contribution) — dengan ratio ditetapkan saat RUPS (FR-16). Perhitungan di sistem, pembayaran di luar sistem.
- **Charity** — budget pool dari Laba Dibagikan yang dialokasikan untuk amal; dihitung sistem sebagai komponen distribusi, penyalurannya di luar sistem.
- **Budget Pool** — nominal alokasi per komponen distribusi (Charity/Dividen/Insentif) = ratio komponen × Laba Dibagikan sesuai parameter RUPS.
- **Dividen** — komponen Laba Dibagikan untuk owner, dibagi pro-rata Portion: Dividen owner = Portion × pool Dividen.
- **Insentif** — komponen Laba Dibagikan atas pengelolaan cafe (Contribution), dibagi pro-rata poin: Insentif owner = (poin owner ÷ total poin) × pool Insentif.
- **Contribution** — pengelolaan cafe oleh owner yang dinilai dalam poin, pada item Contribution yang didefinisikan di MRO; dasar insentif pengelolaan. Sebelumnya disebut "Kontribusi" (folder Kontribusi di Google Drive saat ini).
- **Contribution Period** — rentang antar cut-off Contribution. Contribution yang sudah diberi insentif tidak dibawa ke periode berikutnya; yang belum diberi insentif di-carry over.
- **Bukti Transaksi** — dokumen bukti kepemilikan yang dihasilkan sistem per transaksi dan dikirim ke owner terkait via email; alat klaim owner bila terjadi sesuatu.
- **COO** — role dengan mandat operasional cafe; mengonfirmasi Pesanan Pembelian di Antrian Beli (dengan MFA) setelah pembayaran diterima, memiliki jalur input transaksi langsung, dan mengelola data dasar serta konten.
- **MFA** — multi-factor authentication (**OTP via email**) yang wajib pada aksi transaksional COO: konfirmasi Pesanan Pembelian dan input transaksi langsung. Owner tidak diminta MFA saat submit pesanan (Phase 1).

## 4. Features

### 4.1 Transaksi Saham
**Description:** Pembelian saham owner-initiated: owner membuat Pesanan Pembelian secara mandiri, sistem memvalidasi aturan main, pesanan masuk Antrian Beli, dan COO mengonfirmasi setelah pembayaran diterima (dengan MFA). COO tetap memiliki jalur input langsung. Penjualan saham ditunda ke Phase 2 (FR-2). Dua gerbang pembelian yang independen:
- **Gerbang RKAP** (cafe-level, FR-23) — Modal Tetap dan Modal Bergerak terbuka dibeli selama ruang pemenuhan di RKAP masih tersedia (dihitung dari transaksi efektif saja), tertutup setelah terpenuhi.
- **Gerbang Strength** (owner-level) — Modal Operasional dapat dibeli kapan pun, tidak menunggu RKAP terpenuhi, sepanjang owner punya ruang terbuka dari kepemilikan Modal Tetap/Bergerak-nya (Tetap/Bergerak membuka Ceil, Operasional mengisi Shares), dibatasi RTL.

Urutan validasi pembelian: buka Ceil (Quantity × plafon) → isi Shares (Quantity × bobot) → Strength gabungan owner setelah transaksi harus ≤ 100%; bila melebihi, pesanan ditolak — membeli Operasional tanpa penyeimbang Modal Tetap/Bergerak otomatis ditolak oleh aturan Strength ini. Validasi menghitung posisi terkini ditambah Pesanan Pembelian owner yang sama yang masih berstatus Menunggu Konfirmasi. Realisasi UJ-1.

**Functional Requirements:**

#### FR-1: Pesanan Pembelian mandiri dengan validasi Strength
Owner dapat membuat Pesanan Pembelian saham secara mandiri (Jenis Modal, Quantity) dengan pratinjau hitungan (proyeksi Shares, Ceil, Strength, RTL) sebelum submit; harga berlaku pada tanggal submit menjadi Harga Terkunci; sistem menolak pesanan yang membuat Strength owner > 100%. Realisasi UJ-1.

**Consequences (testable):**
- Pratinjau menampilkan hitungan lengkap (proyeksi Ceil = Ceil terkini + (Quantity × plafon), proyeksi Shares = Shares terkini + (Quantity × bobot), proyeksi Strength, proyeksi RTL) sebelum submit.
- Pesanan dengan proyeksi Strength > 100% ditolak dengan pesan yang menunjukkan hitungannya.
- Validasi menggabungkan posisi terkini dan seluruh Pesanan Pembelian owner yang sama yang berstatus Menunggu Konfirmasi (menumpuk dua pesanan yang masing-masing valid tetap ditolak bila gabungannya > 100%).
- Modal Tetap dan Modal Bergerak hanya dapat dibeli selama ruang RKAP masih tersedia (FR-23); Modal Operasional dapat dibeli kapan pun — termasuk sebelum RKAP terpenuhi — sepanjang validasi Strength lolos: owner sudah punya Modal Tetap/Bergerak yang membuka Ceil (membeli Operasional tanpa penyeimbang otomatis menghasilkan Strength > 100% dan ditolak).
- Pilihan jenis modal pada form mengikuti kondisi RKAP (owner dapat melihat RKAP, FR-23): selama masih ada kebutuhan Modal Tetap dan Modal Bergerak yang terbuka, ketiga jenis modal ditawarkan; saat seluruh ruang RKAP terpenuhi, satu-satunya pilihan adalah Modal Operasional (dengan validasi Strength/RTL).
- Untuk Modal Tetap/Bergerak, Quantity maksimal = **pembulatan ke atas** dari sisa ruang RKAP jenis modal ÷ harga saham berjalan: `ceil(sisa ruang ÷ harga)`. Contoh verifikasi: sisa ruang 100.000, harga 52.000 → maksimal 2 saham (104.000; overshoot 4.000 < harga 1 saham — tertampung toleransi +1 saham dalam batas penyesuaian instant per fase, FR-23). Bila batas fase telah habis, pembulatan ke atas tidak ditawarkan — Quantity maksimal mengikuti Quantity Left (FR-23).
- Harga pesanan adalah harga berlaku pada tanggal submit, tercatat sebagai Harga Terkunci di pesanan.
- Contoh verifikasi: pembelian 2 saham Modal Bergerak menghasilkan Quantity 2, Shares 4, Ceil 6, Strength 66,67%.
- Strength dihitung gabungan semua jenis modal per owner: total Shares owner ÷ total Ceil owner.

#### FR-2: Penjualan dengan harga jual berbeda — `[Phase 2]`
Penjualan saham memakai harga jual yang berlaku, berbeda dari harga beli. Didorong ke Phase 2; alurnya (owner-initiated atau via COO) ditentukan saat Phase 2 dirancang. Konteks dari MRO terakhir: owner yang Strength-nya belum optimal dapat dihimbau menjual sahamnya kepada owner lain yang ingin mempertinggi Ceil dan memperkuat Strength-nya.

**Consequences (testable):**
- Penjualan saham mengurangi Quantity, Shares, Ceil, dan Actual owner sesuai jenis modal transaksi.
- Nilai penjualan dihitung dari harga jual berlaku (bukan harga beli historis).

#### FR-3: MFA untuk aksi transaksional COO
Konfirmasi Pesanan Pembelian oleh COO dan input transaksi langsung COO wajib melewati MFA — OTP via email — sebelum efektif. Submit pesanan oleh owner tidak diminta MFA (Phase 1).

**Consequences (testable):**
- Transaksi tidak efektif sebelum faktor kedua terverifikasi.
- Permintaan MFA tercatat di audit trail.

#### FR-19: Antrian Beli & siklus hidup pesanan
Owner dapat melihat status Pesanan Pembelian miliknya dan menariknya dari Antrian Beli selama status Menunggu Konfirmasi; pesanan yang belum dikonfirmasi kedaluwarsa otomatis pada hari ke-7 sejak submit; COO melihat seluruh Antrian Beli.

**Consequences (testable):**
- Status pesanan selalu salah satu dari 4: Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa; setiap perubahan status tercatat di audit trail (FR-12).
- Penarikan pesanan oleh owner hanya dimungkinkan selama Menunggu Konfirmasi; pesanan keluar dari Antrian Beli dan peristiwanya tercatat di audit trail (penarikan bukan status pesanan).
- Kedaluwarsa otomatis terjadi pada hari ke-7 sejak submit tanpa konfirmasi; owner dapat membuat pesanan baru (dengan harga berjalan saat submit baru).
- Daftar Antrian Beli lengkap hanya terlihat oleh COO; owner hanya melihat pesanan miliknya sendiri (bukan milik owner lain).
- Sistem mengirim notifikasi email ke COO setiap ada pesanan baru masuk Antrian Beli.

#### FR-20: Konfirmasi COO dengan re-validasi & pencatatan pembayaran
COO dapat mengonfirmasi Pesanan Pembelian setelah pembayaran diterima: mengisi tanggal pembayaran dan metode transfer (tanpa upload bukti), lalu konfirmasi dengan MFA (FR-3); sistem melakukan re-validasi aturan pembelian memakai kondisi terkini — Strength (FR-1), ruang RKAP untuk Modal Tetap dan Modal Bergerak (FR-23), serta keabsahan referral pada Pembelian Pertama (FR-22) — transaksi hanya efektif bila lolos, dengan harga final tetap Harga Terkunci.

**Consequences (testable):**
- Konfirmasi menuntut pencatatan tanggal + metode pembayaran dan MFA sebelum transaksi efektif.
- Transaksi yang efektif otomatis menambah Fulfillment RKAP (FR-23) — konfirmasi adalah momen pencetakan Fulfillment; untuk Modal Tetap/Bergerak, COO dapat menetapkan plotting alokasi ke Capital Item saat konfirmasi (default berurutan/FIFO — FR-23).
- Re-validasi gagal → pesanan berubah Ditolak dengan penjelasan hitungannya (posisi owner atau ruang RKAP berubah sejak submit).
- Dana sudah masuk namun pesanan ditolak saat konfirmasi (mis. ruang RKAP habis): disarankan dialihkan ke pembelian Modal Operasional untuk memperkuat Strength (pesanan baru dengan harga berjalan, FR-1); bila tidak memungkinkan (mis. RTL = 0), dana direfund via kanal luar — eksekusi pengalihan/refund di luar sistem, resolusinya tercatat di audit trail (FR-12).
- Harga final tetap Harga Terkunci saat submit meskipun harga berjalan sudah berubah efektif sebelum konfirmasi.
- Setelah efektif: dashboard, rekap, chart terupdate dan Bukti Transaksi terkirim ke owner terkait (FR-11).

#### FR-21: Jalur input langsung COO
COO dapat mencatat pembelian saham langsung atas nama owner (mis. pembayaran tunai di cafe): validasi Strength sama seperti FR-1, pencatatan pembayaran (tanggal + metode), MFA, transaksi langsung efektif.

**Consequences (testable):**
- Jalur langsung memakai harga berlaku pada tanggal input.
- Transaksi jalur langsung tidak melewati Antrian Beli, tetapi tervalidasi aturan Strength yang sama dan tercatat di audit trail sebagai input langsung.
- Pembelian pertama seorang owner melalui jalur langsung juga wajib menyertakan referral (FR-22), dengan pilihan dan validasi yang sama.

#### FR-23: Pencatatan & pelacakan RKAP — daftar kebutuhan, penyesuaian instant, status terpenuhi
COO dapat mencatat RKAP per fase (saat ini RKAP fase 1, tertaut MoM MRO/deck IPO) ke dalam CMS — **berbentuk tabel tersendiri**: daftar Capital Item dalam rupiah dengan tag jenis modal (Tetap/Bergerak — Modal Operasional tidak masuk RKAP), Initial Requirement dan Final Requirement per item, plus agregat ruang/terisi/sisa per jenis modal — paritas dengan tabel RKAP di spreadsheet saat ini. Sistem mencetak Fulfillment dari transaksi efektif dan menutup gerbang pembelian Modal Tetap dan Modal Bergerak saat Fulfillment Rate suatu jenis modal mencapai 100% (model dua gerbang: §4.1).

**Consequences (testable):**
- Capital Item memiliki kolom: nama, jenis modal (Tetap/Bergerak — Operasional tidak masuk RKAP), Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held; ruang per jenis modal = akumulasi Final Requirement seluruh Capital Item jenis modal tersebut.
- Siklus nilai: Initial Requirement disepakati dan **dikunci saat MRO** menetapkan fase; Final Requirement berangkat dari nilai Initial dan hanya bergerak melalui penyesuaian instant — otomatis (overshoot pembulatan, FR-1) maupun manual oleh COO.
- Penyesuaian manual COO (kewenangan MRO terakhir) mencakup dua bentuk: menaikkan Final Requirement item eksisting, dan **menambahkan Capital Item baru** ke fase berjalan — kebutuhan yang belum terantisipasi saat RKAP disusun (contoh riil fase 1: Peralatan Lainnya, Modal Bergerak, 0 → 1.664.000); nilai penuh item baru dihitung sebagai penyesuaian dan membuka kembali ruang pembelian jenis modalnya (FR-1).
- Batas penyesuaian dihitung **agregat per fase**: akumulasi seluruh penyesuaian RKAP fase tersebut — **otomatis maupun manual** (kenaikan item, item baru, overshoot pembulatan otomatis) — tidak boleh melebihi **(1% × total Initial Requirement fase) + harga beli 1 saham berjalan**; komponen 1% menampung pembulatan kebutuhan ke kelipatan harga saham (tertutup saham bulat, dana segar yang diterima cafe lebih besar), toleransi +1 saham menjamin pembelian penutupan gerbang ("saham terakhir" fase) tetap dapat membulatkan ke atas meski jatah 1% telah habis. Bila batas penuh akan terlampaui, pembulatan ke atas tidak ditawarkan: Quantity maksimal sejumlah Quantity Left fase tersebut — tidak boleh lebih; sisa kebutuhan yang tak terisi menjadi urusan MRO berikutnya — rebalancing antar item sejenis atau penyusunan fase RKAP baru. Contoh verifikasi (data fase 1 aktual): total Initial Requirement 250.000.000 → batas 2.500.000 (1%) + 52.000 (1 saham); terpakai 2.484.000 (0,99%); sisa Kekurangan 44.744.000 tetap dapat ditutup bulat: `ceil(44.744.000 ÷ 52.000)` = 861 saham = 44.772.000, overshoot 28.000 tertampung sisa batas (68.000).
- Penyesuaian instant berjalan **otomatis** pada pesanan dengan pembulatan ke atas (FR-1): saat transaksi efektif, Final Requirement Capital Item ter-plot naik sebesar overshoot (selalu < harga 1 saham; tertampung toleransi +1 saham dalam batas fase) dan tercatat di audit trail sebagai penyesuaian instant; COO tetap dapat menyesuaikan manual untuk kasus lain (mis. harga berubah, rencana kebutuhan berubah).
- Contoh verifikasi (penutupan dengan pembulatan ke atas): sisa ruang Modal Bergerak tinggal kulkas 3.500.000; harga saham 52.000 → Quantity maksimal `ceil(3.500.000 ÷ 52.000)` = 68 saham = 3.536.000 (overshoot 36.000) → saat efektif, Final Requirement kulkas naik otomatis ke 3.536.000 → Fulfillment 3.536.000, Fulfillment Rate 100%; cafe menerima 3.536.000 alih-alih 3.484.000 (67 saham tanpa pembulatan).
- Fulfillment hanya dicetak dari **transaksi efektif** — Pesanan Pembelian di Antrian Beli tidak mengunci/memesan ruang (asimetris dengan validasi Strength di FR-1 yang menghitung pesanan yang masih mengantri).
- Utilization (realisasi di lapangan) diinput COO per Capital Item — terpisah dari Fulfillment; Achievement = Utilization ÷ Fulfillment (bisa > 100%); Held = Fulfillment − Utilization (dana terkumpul yang belum terpakai di lapangan).
- Rebalancing saat MRO: kebutuhan RKAP dapat direlokasi antar Capital Item sejenis (Modal Tetap ke Modal Tetap, Modal Bergerak ke Modal Bergerak), tertaut MoM (FR-7); dipicu antara lain Achievement yang melenceng.
- Gerbang per jenis modal: saat Fulfillment Rate suatu jenis modal mencapai 100%, pembelian baru jenis modal itu ditolak; jenis modal lain yang masih ada Shortfall-nya tetap terbuka. Modal Operasional tidak pernah digerbangi RKAP — hanya oleh Strength/RTL per owner.
- Re-validasi saat konfirmasi (FR-20) dan validasi input langsung (FR-21) mencakup ruang RKAP — bila ruang habis terisi owner lain sejak submit, pesanan berubah Ditolak dengan penjelasan.
- Perubahan status RKAP tidak otomatis membatalkan Pesanan Pembelian yang sudah ada di Antrian Beli (penolakan baru terjadi lewat re-validasi konfirmasi) dan tidak menyentuh harga.
- RKAP ditampilkan sebagai tabel tersendiri — bukan kolom di tabel kepemilikan (FR-4) — karena pemenuhan bersifat cafe-level: owner mana pun dapat mengisi; ruang, progress, dan status terpenuhi terlihat oleh semua owner — termasuk owner tanpa saham (matriks keterbukaan: §4.8). Termasuk pula ringkasan batas penyesuaian fase (batas 1%, tambahan aktual, persentase peningkatan) dan Quantity Left — paritas dengan blok ringkasan spreadsheet saat ini.
- Setiap perubahan (Final Requirement, status belum → terpenuhi, fase RKAP baru, rebalancing) tercatat di audit trail (FR-12).
- Plotting alokasi ke Capital Item ditetapkan **COO saat validasi** — konfirmasi (FR-20) maupun input langsung (FR-21) — bukan oleh owner saat memesan; owner hanya memilih jenis modal (sesuai ketersediaan ruang RKAP). Default alokasi berurutan (FIFO) bila COO tidak menetapkan plotting lain.

### 4.2 Dashboard Kepemilikan
**Description:** Tampilan mutakhir komposisi kepemilikan untuk semua owner. Menggantikan rekap sheet + chart manual; owner baru otomatis muncul. Realisasi UJ-2.

**Functional Requirements:**

#### FR-4: Tabel kepemilikan per owner
Semua owner dapat melihat tabel per owner: Quantity, Shares, Portion, Ceil, Strength, Actual, RTL dan Grand Total.

**Consequences (testable):**
- Angka konsisten dengan aturan Glossary; Portion presisi 2 angka di belakang koma.
- Grand Total baris terakhir mencakup seluruh owner aktif.
- Owner baru muncul otomatis setelah transaksi pertamanya tanpa intervensi manual.
- RTL = 0 berarti Strength sudah optimal, yakni paling mendekati atau tepat 100% — tidak ada ruang pembelian Modal Operasional lagi. Kolom RTL sudah ada di spreadsheet — paritas terjaga.

#### FR-5: Visualisasi komposisi kepemilikan
Dashboard menampilkan chart komposisi Portion per owner yang otomatis menambahkan label owner baru.

**Consequences (testable):**
- Chart selalu sinkron dengan tabel; tidak ada label owner yang hilang saat daftar owner bertambah (dari 25 saat ini hingga ~40).

#### FR-18: Chart-chart dashboard (paritas dengan spreadsheet saat ini)
Dashboard menampilkan chart-chart berikut, setara dengan yang ada di Google Sheets hari ini:
1. **Pie "Portion Kepemilikan"** — proporsi Portion tiap owner, label nama + persentase.
2. **Donut dua cincin "Distribusi Pemodalan"** — cincin dalam per jenis modal (Tetap/Bergerak/Operasional), cincin luar per owner.
3. **Stacked bar "Big Cap"** — Shares vs Ceil per kelompok kap sesuai ambang Portion berjalan; kelompok agregat `[Medium Cap]` dan `[Small Cap]` menampung sisanya.

**Consequences (testable):**
- Ketiga chart selalu sinkron dengan data tabel terbaru (satu sumber kebenaran).
- Owner baru otomatis muncul di pie & donut; kelompok Big/Medium/Small Cap dihitung ulang otomatis dari Portion terkini.
- Ambang kelompok kap mengikuti nilai berjalan — Big Cap > 5%, Medium Cap > 2%, Small Cap ≤ 2% — dan dapat dikonfigurasi (ambang pernah berubah dari 7%).

### 4.3 Harga Saham & Keputusan MRO
**Description:** Harga beli dan jual ditetapkan melalui voting owner di MRO (tidak harus di RUPS) dengan mempertimbangkan aspek keuangan cafe. Sistem menyimpan MoM MRO dan harga efektif dengan jejak keputusan. Realisasi UJ-3.

**Functional Requirements:**

#### FR-6: CMS harga saham — harga berjalan & riwayat
COO dapat mengelola harga beli & jual (nilai baru efektif per tanggal, tertaut pada MoM MRO yang menetapkannya) melalui CMS khusus: harga berjalan selalu tampil, riwayat harga yang pernah dipakai tersimpan lengkap; transaksi berikutnya otomatis memakai harga berlaku.

**Consequences (testable):**
- Setiap harga memiliki riwayat: nilai, tanggal efektif, referensi MRO.
- Transaksi memakai harga berlaku pada tanggal submit pesanan (Harga Terkunci — lihat FR-1/FR-20); jalur input langsung (FR-21) memakai harga berlaku pada tanggal input.
- Harga berjalan dan seluruh riwayat harga dapat dilihat oleh semua owner — termasuk owner tanpa saham (patokan sebelum pembelian perdana).

#### FR-7: Pencatatan MoM MRO/RUPS
COO dapat menyimpan notulen (MoM) MRO/RUPS di sistem, termasuk draft untuk MRO berikutnya.

**Consequences (testable):**
- MoM tersimpan dengan tanggal dan dapat ditautkan ke keputusan (harga, jenis Contribution, cut-off).
- Draft MoM dapat diedit hingga final.

### 4.4 Contribution & Insentif
**Description:** Jenis Contribution didefinisikan di MRO; COO mencatat dan mengevaluasi realisasi per owner sepanjang Contribution Period; cut-off terjadi pada tanggal tertentu (tidak harus saat RUPS). Realisasi UJ-2, UJ-4.

**Functional Requirements:**

#### FR-8: Definisi item Contribution
COO dapat mendefinisikan item Contribution (hasil keputusan MRO) dengan bobot poin kuantitatif.

**Consequences (testable):**
- Item Contribution memiliki nama, deskripsi, poin kuantitatif, dan periode berlaku; tertaut MoM penetapannya.
- Poin setiap item berupa angka (bukan penilaian kualitatif bebas).

#### FR-9: Pencatatan realisasi Contribution
COO dapat mencatat realisasi Contribution per owner pada item yang telah didefinisikan; owner melihat poin Contribution berjalan di dashboard.

**Consequences (testable):**
- Poin Contribution berjalan tampil untuk owner yang login dan di rekap COO.
- Setiap pencatatan memiliki tanggal dan pencatat.

#### FR-10: Cut-off Contribution Period dengan carry-over
COO dapat memicu cut-off pada tanggal yang ditetapkan: Contribution yang memenuhi syarat difinalkan sebagai dasar Insentif (nominal dihitung saat distribusi laba, FR-16) dan ditandai selesai; yang belum di-carry over ke periode berikutnya.

**Consequences (testable):**
- Rekap cut-off memisahkan: Contribution yang sudah diberi insentif (tidak dibawa ke periode berikutnya) vs belum diberi insentif (carry over).
- Contribution yang sudah diberi insentif tidak pernah muncul lagi di periode berikutnya.
- Saldo carry-over tampil di periode baru sejak awal.

### 4.5 Distribusi Laba RUPS
**Description:** Perhitungan distribusi laba dilakukan di sistem; pembayaran tetap di luar sistem. Alur: RUPS menyatakan laba diaudit → dikurangi laba ditahan → Laba Dibagikan dibagi ke tiga komponen: Charity, Dividen (per Portion), dan Insentif (per Contribution) — masing-masing membentuk budget pool; Dividen & Insentif dibagi ke owner pro-rata (Portion / poin Contribution), Charity dialokasikan untuk amal. Realisasi UJ-5.

**Functional Requirements:**

#### FR-16: Simulasi & rekap distribusi laba
COO dapat menginput laba diaudit dan laba ditahan dari RUPS; sistem menghitung pembagian Laba Dibagikan ke tiga komponen — **Charity, Dividen (per Portion), dan Insentif (per Contribution)** — dengan ratio komponen sebagai parameter yang ditetapkan saat RUPS (patokan MRO terakhir: Charity 5%, Dividen 41%, Insentif 54% — direview ulang atau ditentukan spontan saat RUPS), menghasilkan rekap yang bisa dilihat para owner sesuai matriks keterbukaan (§4.8).

**Consequences (testable):**
- Setiap komponen membentuk **budget pool**: pool Charity = ratio × Laba Dibagikan, pool Dividen = ratio × Laba Dibagikan, pool Insentif = ratio × Laba Dibagikan (ratio berjalan sesuai parameter RUPS).
- Formula per owner (pro-rata terhadap pool): **Dividen owner = Portion × pool Dividen**; **Insentif owner = (poin Contribution owner ÷ total poin) × pool Insentif**.
- Charity bukan bagian owner — pool Charity dialokasikan utuh untuk amal.
- Basis poin Insentif: poin periode yang telah difinalkan cut-off (FR-10).
- Owner tanpa saham yang bagian Insentif-nya telah ditunaikan pada rekap RUPS berubah status menjadi Keluar (FR-13).
- Rekap menampilkan: laba diaudit, laba ditahan, Laba Dibagikan, tiga budget pool, dan rincian per owner (Dividen + Insentif + total hak).
- Contoh verifikasi: laba 12.000.000, ditahan 2.000.000 → Laba Dibagikan 10.000.000 → pool Charity 500.000, Dividen 4.100.000, Insentif 5.400.000; owner dengan Contribution 50% dan Portion 40% berhak Insentif 2.700.000 + Dividen 1.640.000 = total 4.340.000.
- Rekap terakhir selalu bisa dibandingkan dengan rekap RUPS sebelumnya.
- Rekap distribusi laba terlihat sesuai matriks keterbukaan (§4.8): owner pemegang saham; owner tanpa saham hanya bila masih memiliki poin Contribution yang belum ditunaikan.

### 4.6 Bukti Transaksi & Audit Trail
**Description:** Setiap transaksi menghasilkan Bukti Transaksi yang dikirim ke owner terkait via email; semua transaksi, penolakan, dan keputusan tercatat permanen. Realisasi UJ-1, UJ-2.

**Functional Requirements:**

#### FR-11: Generate & kirim Bukti Transaksi
Sistem menghasilkan Bukti Transaksi per transaksi yang efektif (pembelian via konfirmasi atau input langsung; penjualan menyusul di Phase 2) dan mengirimkannya ke owner terkait via email.

**Consequences (testable):**
- Bukti berisi identitas owner, tanggal, jenis modal, Quantity, harga, Shares, Ceil, Strength, Portion setelah transaksi.
- Bukti dapat diunduh ulang kapan pun oleh owner terkait.
- Format bukti mengikuti Template Konfirmasi Pembelian Saham v3 yang berlaku saat ini.

#### FR-12: Audit trail permanen
Semua aksi (submit/tarik/kedaluwarsa/konfirmasi/tolak Pesanan Pembelian, transaksi input langsung, penetapan harga, cut-off, perubahan data dasar) tercatat dengan aktor, waktu, dan detail; catatan tidak dapat diubah/dihapus.

**Consequences (testable):**
- Audit trail hanya dapat dilihat oleh COO.
- Penolakan pesanan (saat submit maupun saat re-validasi konfirmasi) tercatat lengkap dengan alasan dan hitungannya.
- Rekonsiliasi dengan Bukti Transaksi milik owner selalu mungkin.

### 4.7 Data Dasar & Migrasi
**Description:** Pendaftaran mandiri oleh calon owner (verifikasi COO), pengelolaan data owner oleh COO, serta migrasi data historis dari Google Sheets & Google Form. Realisasi UJ-1, UJ-6.

**Functional Requirements:**

#### FR-13: Manajemen data owner
COO dapat menambah/mengelola data owner (identitas, kontak WA/email, status); COO dapat memilih owner mana pun saat input transaksi.

**Consequences (testable):**
- Akun owner dapat berasal dari Pendaftaran Owner mandiri (FR-22) atau input COO; keduanya dikelola di sini.
- Owner baru terdaftar sebelum transaksi pertamanya dapat dipilih pada FR-1.
- Kontak owner dipakai untuk pengiriman Bukti Transaksi (FR-11) dan MFA (FR-3).
- Status owner: (1) pemegang saham; (2) tanpa saham — (a) tidak pernah membeli: akses terbatas halaman personal (matriks keterbukaan: §4.8); (b) bekas pemegang yang telah menjual seluruh sahamnya `[Phase 2]`: tetap owner dengan akses penuh selama masih ada poin Contribution yang belum ditunaikan, tanpa bobot suara MRO karena Portion 0; (3) Keluar — tanpa saham dan hak Contribution telah ditunaikan di RUPS (lihat Glossary).
- Owner berstatus Keluar setara owner tanpa saham yang belum pernah membeli: akses terbatas halaman personal (matriks keterbukaan: §4.8); dapat membeli saham lagi — aktif kembali, transparansi penuh kembali setelah transaksi efektif — bila ruang RKAP tersedia atau fase RKAP baru dibuka. Seluruh jejak historisnya tetap tercatat di audit trail (FR-12).

#### FR-22: Pendaftaran owner mandiri
Calon owner dapat mendaftar secara mandiri dengan akun Google, melengkapi Profile sesuai daftar field Lampiran A, lalu diverifikasi COO agar akun aktif. Owner tanpa saham (Terverifikasi, belum pernah membeli) hanya mendapat halaman personal; informasi antar owner terbuka setelah transaksi pembelian pertamanya efektif. Menggantikan Google Form. Realisasi UJ-6.

**Consequences (testable):**
- Registrasi memakai akun Google; halaman pendaftaran dapat diakses langsung — link referral bukan syarat akses.
- Referral diajukan saat **Pembelian Pertama** (Glossary), bukan saat pendaftaran (keputusan MRO): seluruh Pesanan Pembelian seorang owner wajib menyertakan referral hingga Pembelian Pertamanya efektif — pilihan: owner eksisting pemegang saham (termasuk COO) atau owner baru yang belum pernah membeli saham. Dua owner boleh saling merujuk bila sama-sama membeli saham perdananya; keabsahannya (aturan MRO: kepesertaan modal awal pada hari yang sama) divalidasi COO saat konfirmasi (FR-20).
- Urutan gerbang: registrasi → Profile lengkap (prasyarat) → verifikasi COO; COO tidak dapat memverifikasi pendaftar dengan Profile belum lengkap.
- Status pendaftaran: Diajukan, Terverifikasi, Ditolak; verifikasi/penolakan oleh COO tercatat di audit trail (FR-12).
- Pendaftar yang tidak kunjung melengkapi Profile-nya mendapat email pengingat; pendaftarannya kedaluwarsa otomatis (jangka waktu final ditentukan saat tahap UX).
- Halaman personal owner tanpa saham minimal berisi: Profile, portofolio & status Pesanan Pembelian miliknya, dan pembuatan Pesanan Pembelian (dengan harga berjalan).
- Keterbukaan owner tanpa saham mengikuti matriks keterbukaan §4.8; seluruh yang terkunci terbuka otomatis setelah transaksi pembelian pertamanya efektif.
- Autentikasi seluruh akun (owner eksisting & COO) memakai akun Google; dicocokkan lewat email saat migrasi.

#### FR-14: Migrasi data historis
Seluruh riwayat transaksi dari awal (termasuk yang tercatat di sheet Evidence), rekap kepemilikan dari Google Sheets, serta data pendaftaran historis dari Google Form, dimigrasikan sehingga dashboard dapat go-live dengan saldo dan riwayat utuh 22 owner eksisting (rekap Grand Total saat ini: Quantity 3.622, Shares 5.187, Ceil 14.980).

**Consequences (testable):**
- Grand Total hasil migrasi cocok dengan rekap spreadsheet sumber.
- Data pendaftar dari Google Form ikut dimigrasikan sebagai Profile owner/calon owner.
- Setiap owner eksisting dapat melihat riwayat transaksinya pasca-migrasi.

### 4.8 Akses & Keamanan
**Description:** Tiga tingkat akses: Calon Owner (terverifikasi = owner tanpa saham; hanya halaman personal), Owner pemegang saham (lihat + membuat/menarik Pesanan Pembelian sendiri), COO (konfirmasi Antrian Beli, input langsung, kelola konten & data dasar; aksi transaksional dengan MFA). Transparansi penuh hanya antar owner pemegang saham. COO saat ini: Sugeng Winanjuar; role harus dapat berpindah antar owner.

**Functional Requirements:**

#### FR-15: Role dan hak akses
Sistem membedakan role Calon Owner (mendaftar mandiri; setelah Terverifikasi aksesnya terbatas pada halaman personal), Owner (lihat dashboard, Contribution, Bukti Transaksi sendiri; membuat & menarik Pesanan Pembelian miliknya), COO (konfirmasi Antrian Beli dan input transaksi langsung dengan MFA; kelola konten & data dasar).

**Consequences (testable):**
- Transaksi hanya menjadi efektif melalui konfirmasi COO atau input langsung COO — owner tidak dapat memfinalisasi transaksi.
- Owner hanya melihat dan menarik pesanan miliknya sendiri.
- Calon Owner dengan Profile belum lengkap hanya dapat mengakses kelengkapan Profile-nya sendiri.
- Owner tanpa saham (Terverifikasi, belum pernah membeli) hanya dapat mengakses halaman personal — cakupan lengkapnya di matriks keterbukaan di bawah.

**Matriks keterbukaan owner tanpa saham** (Terverifikasi, belum pernah membeli; berlaku pula bagi owner Keluar — FR-13):

| | Cakupan |
|---|---|
| **Terbuka** | Profile & Pesanan Pembelian miliknya; harga berjalan & riwayat harga (FR-6); tabel RKAP beserta progressnya (FR-23 — agar dapat menentukan pembelian sahamnya untuk kebutuhan apa); rekap distribusi laba selama masih memiliki poin Contribution yang belum ditunaikan (FR-16) |
| **Terkunci** | Tabel/chart kepemilikan seluruh owner (FR-4, FR-18); Contribution; MoM; audit trail (FR-12 — hanya COO) |

Seluruh yang terkunci terbuka otomatis setelah transaksi pembelian pertama efektif (owner muncul di dashboard, FR-4).

#### FR-17: Pergantian COO
Peran COO dapat dialihkan ke owner lain (keputusan MRO/RUPS); riwayat siapa menjabat kapan tercatat di audit trail; COO lama otomatis kembali menjadi Owner biasa.

**Consequences (testable):**
- Alih peran COO membutuhkan keputusan yang tercatat (referensi MoM).
- Setelah pergantian, COO lama kehilangan akses transaksional; seluruh transaksi tetap tercatat atas nama pejabat yang bertugas saat itu.

**NFR — Presisi perhitungan (lintas-fitur):**
- Presisi seluruh perhitungan pecahan: 2 angka di belakang koma, pembulatan half-up (≥5 dibulatkan ke atas); total Portion ditampilkan apa adanya meski 99,99%/100,01% karena pembulatan.

## 5. Non-Goals (Explicit)
- **Manajemen Investor** (akad penyertaan dana di luar saham) — para owner berkomitmen memodali cafe via pembelian saham; bila suatu saat dibuka kerjasama investor, itu menjadi perubahan produk tersendiri. `[NOTE FOR PM: dimuat secara emosional di visi "full public ownership" — kunjungi ulang bila komitmen pemodalan owner berubah]`
- **Pembayaran dividen/insentif & penyaluran Charity otomatis** — sistem menghitung distribusi laba & insentif (FR-16, FR-10); eksekusi pembayaran/penyaluran tetap proses luar sistem.
- **Akuntansi/laporan keuangan cafe** — laporan kuartalan signed tetap dalam proses yang ada; sistem ini bukan penggantinya.
- **Aplikasi mobile native** — web app responsif memadai untuk 22–40 owner.
- **Pembayaran online / payment gateway** — pembayaran pembelian saham terjadi di kanal luar (transfer/tunai); sistem hanya mencatat tanggal dan metode (FR-20, FR-21).
- **Modul voting MRO terautomasi** — v1: MoM + hasil keputusan yang diinput; mekanisme voting tetap di ruang meeting.
- **Notifikasi transaksi ke semua owner** — v1: bukti hanya ke owner terkait.
- **Publikasi ke publik luas** — dashboard internal Sip & Dip saja; pendaftaran terbuka tanpa link referral, namun transparansi penuh hanya antar owner pemegang saham.

## 6. MVP Scope

### 6.1 In Scope — Phase 1 (MVP)
- FR-1, FR-3 s.d. FR-23 (Pesanan Pembelian mandiri + Antrian Beli + konfirmasi COO + input langsung + MFA, Pendaftaran Owner mandiri via akun Google, dashboard + chart-chart, harga via CMS + MoM, Contribution + cut-off + carry-over, distribusi laba, Bukti Transaksi via email, audit trail, manajemen owner + pergantian COO, pelacakan RKAP, migrasi data Sheets + Form, role).
- Web app responsif; 22 owner eksisting + pertumbuhan hingga ~40.

### 6.2 Phase 2
- FR-2: penjualan saham dengan harga jual berbeda. Alur penjualan (owner-initiated atau via COO), aturan validasi, dan dampaknya ke Quantity/Shares/Ceil/Actual ditetapkan saat Phase 2 dirancang.

## 7. Success Metrics
*Internal tool — metrik sederhana, kualitatif-kuantitatif.*

**Primary**
- **SM-1**: Zero discrepancy — selama 3 bulan pasca go-live, tidak ada temuan selisih hitungan Portion antara sistem dan verifikasi manual para owner. Validates FR-1, FR-4, FR-14, FR-20.
- **SM-2**: Google Sheets berhenti dipakai untuk pencatatan saham dalam 1 bulan pasca go-live. Validates FR-4, FR-5, FR-14.

**Secondary**
- **SM-3**: 100% transaksi baru menghasilkan Bukti Transaksi terkirim ke owner terkait. Validates FR-11.
- **SM-4**: COO menyelesaikan konfirmasi satu pesanan (pencatatan pembayaran + re-validasi + MFA) < 5 menit. Validates FR-20, FR-3.

**Counter-metrics (do not optimize)**
- **SM-C1**: Jumlah transaksi — tidak untuk dioptimalkan; kenaikan transaksi bukan tujuan produk, kebenaran hitungan dan kepercayaan owner yang utama.

## 8. Asumsi Terjawab (Riwayat)
*Tidak ada asumsi aktif — seluruhnya telah dikonfirmasi. Daftar ini hanya indeks; isi aturannya hidup di FR/Glossary terkait.*

- Batas penyesuaian RKAP agregat per fase (FR-23)
- Alokasi ke Capital Item oleh COO saat validasi, default FIFO (FR-1/FR-20/FR-23)
- Autentikasi akun Google, dicocokkan via email saat migrasi (FR-22)
- Akses pendaftaran tanpa link referral (FR-22)
- Persona UJ fiktif sebagai konvensi dokumentasi (§2.3)
- Ratio distribusi laba tiga komponen, parameter per RUPS (FR-16)
- Ambang kelompok kap Big/Medium/Small Cap (FR-18)
- Harga beli/jual via CMS MRO (FR-6)
- Poin Contribution kuantitatif (FR-8)
- Pembulatan half-up 2 desimal (NFR §4.8)
- Perhitungan distribusi laba di sistem, pembayaran di luar (FR-16)
- Pergantian COO (FR-17)
- Harga terkunci saat submit (FR-1/FR-20)
- MFA hanya COO, OTP via email (FR-3)
- Jalur input langsung COO (FR-21)
- Expiry antrian 7 hari (FR-19)
- Format bukti Template Konfirmasi Pembelian Saham v3 (FR-11)
- Migrasi seluruh riwayat transaksi (FR-14)
- Visibilitas Antrian Beli privat per owner (FR-19)
- Notifikasi pesanan baru ke COO via email (FR-19)
- Pengingat + kedaluwarsa pendaftar tak lengkap (FR-22)
- Rumus insentif pro-rata pool (FR-16)
- Status owner tanpa saham, Keluar & reaktivasi (FR-13)
- Field Profile (Lampiran A) + referral saat Pembelian Pertama (FR-22)
- Matriks keterbukaan owner tanpa saham (§4.8)

## Lampiran A. Daftar Field Profile
*Transkrip field Google Form pendaftaran owner saat ini — paritas migrasi (FR-14), rujukan resmi bagi FR-22 dan Glossary "Profile".*

| # | Field | Keterangan |
|---|---|---|
| 1 | Nama Lengkap | Identitas resmi owner |
| 2 | Alias | Nama panggilan sehari-hari |
| 3 | Gmail | Akun Google untuk login; kanal email sistem (Bukti Transaksi, MFA OTP, notifikasi) |
| 4 | Nomor HP | Kontak utama |
| 5 | Kontak Darurat | Nama orang yang dapat dihubungi |
| 6 | Nomor HP Kontak Darurat | — |
| 7 | Hubungan dengan Owner | Hubungan kontak darurat dengan owner |
| 8 | Nama Bank | Rekening penyaluran dividen/insentif/refund (eksekusi pembayaran di luar sistem) |
| 9 | Pemilik Rekening | — |
| 10 | Nomor Rekening | — |
| 11 | Referal | Di Google Form diisi saat pendaftaran; di sistem diajukan saat Pembelian Pertama (FR-22) |
