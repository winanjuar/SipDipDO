# Epic 3: Pembelian Saham End-to-End

Owner memesan pembelian saham secara mandiri dengan pratinjau live dan validasi; pesanan masuk Antrian Beli dengan siklus hidup lengkap; COO mengonfirmasi ber-MFA dengan re-validasi, atau memakai jalur input langsung; transaksi efektif atomik dalam SATU transaksi DB sesuai AD-2; Bukti Transaksi terkirim. Inti UJ-1.

### Story 3.1: Rumus Domain Murni + Unit Test

As a owner,
I want pratinjau di HP saya dan validasi di server memakai hitungan yang identik,
So that angka yang saya lihat selalu sama dengan keputusan sistem — tidak ada selisih (SM-1).

**Acceptance Criteria:**

**Given** modul `shared/domain` dibuat
**When** diimpor oleh server route maupun pulau pratinjau
**Then** berupa modul TypeScript murni tanpa I/O dan tanpa framework — satu-satunya implementasi rumus (AD-6)

**Given** rumus pembobotan diimplementasikan
**When** diuji
**Then** berperilaku: Shares = Quantity × bobot (Tetap 1, Bergerak 2, Operasional 3); Ceil = Quantity × plafon (5/3/1); Strength = Σ Shares ÷ Σ Ceil per owner gabungan semua jenis modal; Portion = Shares owner ÷ Σ Shares seluruh owner; RTL = Floor((Ceil − Shares) ÷ 2); Quantity maksimal Tetap/Bergerak = ceil(sisa ruang ÷ harga berjalan) selama overshoot tertampung batas penyesuaian fase, bila batas habis mengikuti Quantity Left; pembulatan half-up 2 desimal (Glossary; NFR-1)

**Given** fungsi perakitan input kanonik (assembly) dibuat
**When** dipanggil pratinjau, validasi submit, dan re-validasi konfirmasi
**Then** ketiganya memanggil fungsi yang sama: Strength = posisi terkini + seluruh pesanan-pending kanonik; ruang RKAP = Σ Final Requirement − Fulfillment dari transaksi EFEKTIF saja; sisa batas penyesuaian = Σ penyesuaian fase; "harga 1 saham berjalan" = harga berjalan pada momen evaluasi gerbang (AD-6)

**Given** nilai uang dan ratio melintasi batas modul/API
**When** diserialisasi/diparse
**Then** berupa string desimal berskala tetap melalui SATU pasangan parse/serialize di `shared/domain`; aritmetika memakai decimal library tunggal; `Number()`/`parseFloat()` atas nilai uang/ratio dilarang di semua lapisan termasuk display (AD-10)

**Given** contoh verifikasi PRD dijalankan sebagai unit test
**When** suite dikonsumsi
**Then** lolos: 2 saham Modal Bergerak → Quantity 2, Shares 4, Ceil 6, Strength 66,67%; sisa ruang 100.000 harga 52.000 → maksimal 2 saham (overshoot 4.000 tertampung); ceil(44.744.000 ÷ 52.000) = 861 saham (overshoot 28.000 tertampung sisa batas 68.000); Total Portion 99,99%/100,01% ditampilkan apa adanya (AR-10; rumus distribusi laba menyusul di Epic 5 dengan contohnya)

### Story 3.2: Form Pesanan Pembelian + Panel Pratinjau Live

As a owner,
I want memesan pembelian saham dengan pratinjau hitungan lengkap sebelum submit,
So that saya tahu pasti pesanan saya lolos mekanisme pembobotan sebelum masuk antrian.

**Acceptance Criteria:**

**Given** owner terverifikasi membuka Form Pesanan Pembelian (halaman penuh di mobile, panel pratinjau sticky bawah viewport — UX-DR10)
**When** Jenis Modal dipilih
**Then** pilihan dinamis mengikuti kondisi RKAP: selama masih ada kebutuhan Tetap/Bergerak terbuka, ketiga jenis modal ditawarkan; saat seluruh ruang RKAP terpenuhi, satu-satunya pilihan Modal Operasional (FR-1)

**Given** Quantity diisi
**When** batas maksimal ditampilkan
**Then** Tetap/Bergerak: pembulatan ke atas sisa ruang ÷ harga dengan keterangan modus (overshoot tertampung batas) atau Quantity Left bila batas fase habis; Operasional dibatasi ruang RTL (FR-1, FR-23)

**Given** Pembelian Pertama owner belum efektif
**When** form dirender
**Then** isian Referral wajib — pilihan dari fungsi kanonik `pilihanReferral` (pemegang saham termasuk COO, atau owner Terverifikasi lain yang belum pernah membeli) (FR-22, AD-8)

**Given** input Jenis Modal/Quantity/Referral berubah
**When** Panel Pratinjau Perhitungan bereaksi
**Then** berganti seketika: Harga Terkunci (harga berjalan tanggal submit) + proyeksi Ceil, Shares, Strength, RTL; hitungan menyertakan pesanan owner yang masih Menunggu Konfirmasi; belum lengkap → placeholder; proyeksi Strength > 100% → angka `destructive-foreground` + Alert Penolakan Terhitung aktif + Submit terkunci; update diumumkan `aria-live="polite"` (UX-DR10, UX-DR11)

**Given** owner submit pesanan
**When** server memvalidasi
**Then** validasi memakai fungsi assembly yang sama dengan pratinjau (AD-6); lolos → pesanan tersimpan berstatus `menunggu_konfirmasi` dengan Harga Terkunci sebagai nilai snapshot pada `buy_orders` + audit; gagal → pesanan DITOLAK tanpa baris pesanan, hanya entry audit + Alert Penolakan Terhitung berisi hitungan lengkap (konvensi Data & format)

**Given** owner punya satu pesanan antrian yang valid
**When** membuat pesanan kedua yang sendirian juga valid namun gabungan Strength > 100%
**Then** pesanan kedua ditolak dengan pesan yang menunjukkan hitungan gabungan (FR-1)

### Story 3.3: Antrian Beli, Pesanan Saya & Penarikan Pesanan

As a COO / owner,
I want melihat antrian sesuai peran saya dan menarik pesanan saya sendiri,
So that antrian jelas dan saya tidak menunggu pesanan yang sudah tidak saya inginkan.

**Acceptance Criteria:**

**Given** COO membuka Antrian Beli (landing default COO)
**When** daftar dimuat
**Then** tampil seluruh pesanan berstatus pending kanonik (`menunggu_konfirmasi` AND `withdrawn_at IS NULL`) urut terlama-dulu, dengan nama owner + Status Badge, caption umur "hari ke-N dari 7", ringkasan hitungan pesanan (jenis modal, Quantity, Harga Terkunci), dan aksi Konfirmasi (UX-DR13)

**Given** owner membuka Pesanan Saya
**When** daftar dimuat
**Then** hanya pesanan miliknya (semua status) — tidak pernah pesanan owner lain; aksi Tarik hanya tersedia saat Menunggu Konfirmasi; pesanan Ditolak menampilkan alasan + hitungan (FR-19, UX-DR13)

**Given** owner menarik pesanan (confirm ringan: "Pesanan keluar dari Antrian Beli. Pembayaran yang sudah dikirim tidak otomatis refund." — UX-DR20)
**When** penarikan dieksekusi
**Then** SATU transaksi DB: set `withdrawn_at` via CAS `WHERE status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL` + entry audit; pesanan keluar dari daftar — penarikan bukan status (AD-2)

**Given** pesanan baru lolos validasi submit
**When** masuk antrian
**Then** email notifikasi ke COO dikirim via outbox (FR-19; AR-6)

### Story 3.4: Kedaluwarsa Otomatis Hari ke-7

As a owner,
I want pesanan yang tak kunjung dikonfirmasi kedaluwarsa otomatis,
So that antrian bersih dan pesanan baru saya mengikuti harga berjalan yang segar.

**Acceptance Criteria:**

**Given** cron harian terproteksi CRON_SECRET berjalan
**When** endpoint kedaluwarsa menemukan pesanan pending kanonik berumur ≥ 7 kalender-hari
**Then** status berubah `kedaluwarsa` via compare-and-set yang menyertakan guard `AND withdrawn_at IS NULL` + entry audit (FR-19; AD-2)

**Given** batas hari dihitung
**When** umur pesanan dievaluasi
**Then** perhitungan kalender-hari memakai zona Asia/Jakarta di dalam endpoint — bukan jam trigger UTC (AD-9)

**Given** cron berjalan hampir bersamaan dengan konfirmasi COO atau penarikan owner pada baris yang sama
**When** kedua penulis berebut
**Then** hanya satu yang berhasil per baris (CAS)

**Given** pesanan kedaluwarsa dilihat owner
**When** Pesanan Saya dimuat
**Then** Badge Kedaluwarsa + keterangan "kedaluwarsa otomatis hari ke-7 sejak submit (tanggal submit tertera)" + info bisa membuat pesanan baru dengan harga berjalan (UX-DR19)

### Story 3.5: MFA OTP untuk Aksi Transaksional COO

As a COO,
I want aksi transaksional saya dilindungi OTP via email,
So that transaksi tidak bisa menjadi efektif hanya karena sesi saya bocor.

**Acceptance Criteria:**

**Given** himpunan aksi ber-MFA didefinisikan (tertutup)
**When** endpoint dan UI dibangun
**Then** Phase 1 berisi tepat: konfirmasi pesanan (3.6) dan input langsung (3.7); eksplisit BUKAN: penyesuaian RKAP, penetapan harga, cut-off, rebalancing, pergantian COO — mengubah himpunan = mengubah AD-8

**Given** COO memicu aksi transaksional
**When** dialog MFA tampil
**Then** alur: "Kirim OTP ke email COO" → kode 6 digit → verifikasi; state menunggu-kirim, menunggu-input (berlaku 10 menit), salah (sisa percobaan), kedaluwarsa, kirim ulang cooldown 60 detik; fokus otomatis ke digit pertama; Esc membatalkan seluruh aksi — tidak ada transaksi setengah jadi (UX-DR12)

**Given** baris `otp_codes` dibuat
**When** OTP diminta
**Then** kode disimpan hashed dengan `{action_type, target_ref}` — terikat tepat satu instance aksi (AD-8)

**Given** verifikasi OTP berjalan
**When** dilakukan dalam transaksi finalisasi
**Then** verifikasi DAN konsumsi terjadi DALAM tx via API IDENTITAS yang menerima `tx`; rollback re-validasi mengembalikan konsumsi — retry tanpa email baru (AD-8, AD-5)
**And** penghitung percobaan gagal ditulis dalam transaksi terpisah yang selalu commit; batas percobaan dicek sebelum verifikasi

**Given** `requestOtp` baru dipanggil untuk `(action_type, target_ref)` yang sama
**When** kode baru dibuat
**Then** semua kode hidup sebelumnya terinvalideasi — maksimum satu baris OTP hidup per aksi; resend-cooldown dienforce server-side (AD-8)

**Given** permintaan MFA terjadi
**When** dicatat
**Then** seluruhnya masuk audit trail (FR-3)

### Story 3.6: Konfirmasi COO — Finalisasi Transaksi Atomik

As a COO,
I want mengonfirmasi pesanan setelah pembayaran benar-benar diterima,
So that satu konfirmasi meng-update ledger, posisi, RKAP, dan Bukti secara atomik — tidak ada selisih.

**Acceptance Criteria:**

**Given** COO mengetuk "Konfirmasi" pada Baris Antrian Beli
**When** Form Konfirmasi tampil
**Then** satu dialog berisi: tanggal & metode transfer (tanpa upload bukti), plotting alokasi ke Capital Item (default berurutan/FIFO), MFA — kolom terisi bawaan agar seluruh konfirmasi selesai < 5 menit (SM-4; UX-DR20)

**Given** konfirmasi disubmit setelah OTP terverifikasi
**When** finalisasi dieksekusi
**Then** SATU transaksi DB berisi: cek kewenangan `coo_tenures` berlaku pada `now()` (aktor audit = pejabat saat commit) + re-validasi (Strength, ruang RKAP untuk Tetap/Bergerak, keabsahan referral mekanis pada Pembelian Pertama) + append baris `ledger_transactions` (harga final = Harga Terkunci; pembayaran tanggal+metode dicatat) + CAS status pesanan `WHERE status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL` + update tabel posisi (proyeksi) + plotting alokasi ke Capital Item + penyesuaian instant overshoot + entry audit + event Pembelian Pertama efektif (bila transaksi pertama owner: set `first_effective_at`, buka transparansi penuh) + baris outbox Bukti (AD-1, AD-2, AD-4, AD-5)

**Given** finalisasi mengambil lock
**When** transaksi penulis lain berjalan bersamaan
**Then** urutan lock global diikuti: `buy_orders → rkap_phases → positions → owners → contribution_periods → distribution` — tanpa deadlock AB-BA (AD-2)

**Given** re-validasi gagal (posisi owner atau ruang RKAP berubah sejak submit)
**When** hasil dikembalikan
**Then** pesanan berubah Ditolak dengan penjelasan hitungannya + saran: dialihkan ke Modal Operasional (pesanan baru harga berjalan) atau direfund via kanal luar; resolusi dicatat COO di audit trail (FR-20)

**Given** cross-referral hari yang sama terdeteksi pada Pembelian Pertama dua owner
**When** re-validasi berjalan
**Then** mesin tidak menolak otomatis — penilaian manusia COO, keputusan tercatat di audit (AD-7)

**Given** transaksi efektif dengan pembulatan ke atas
**When** overshoot terjadi
**Then** Final Requirement Capital Item ter-plot naik sebesar overshoot dan tercatat sebagai penyesuaian instant — contoh verifikasi: sisa kulkas 3.500.000, harga 52.000 → 68 saham = 3.536.000 (overshoot 36.000) → Final naik ke 3.536.000, Fulfillment Rate 100% (FR-23)

**Given** transaksi efektif
**When** Fulfillment tercetak
**Then** nilainya derived dari alokasi plotting di ledger — tabel RKAP (Epic 2) otomatis terisi; gerbang jenis modal menutup saat Fulfillment Rate mencapai 100% (AD-2, FR-23)

### Story 3.7: Jalur Input Langsung COO

As a COO,
I want mencatat pembelian tunai di cafe langsung efektif atas nama owner,
So that owner tidak perlu mengantre untuk pembayaran yang sudah saya terima langsung.

**Acceptance Criteria:**

**Given** COO memilih aksi "Input Langsung" di Antrian Beli
**When** form tampil
**Then** COO memilih owner (mana pun, termasuk yang belum pernah membeli), Jenis Modal + Quantity dengan pratinjau/validasi yang sama seperti FR-1, Referral bila Pembelian Pertama owner tersebut, tanggal & metode pembayaran, lalu MFA (FR-21)

**Given** input langsung disubmit
**When** harga ditetapkan
**Then** memakai harga berjalan pada tanggal input (FR-21)

**Given** finalisasi input langsung dieksekusi
**When** transaksi berjalan
**Then** SATU transaksi DB dengan isi yang sama seperti konfirmasi (3.6) namun tanpa baris pesanan — `ledger_transactions` FK pesanan NULL; tidak melewati Antrian Beli; audit mencatat sebagai "input langsung" (AD-2)

**Given** validasi gagal (mis. Strength > 100% atau ruang RKAP habis)
**When** hasil dikembalikan
**Then** Alert Penolakan Terhitung dengan hitungan lengkap; transaksi tidak terjadi; tidak ada status pesanan yang menggantung (FR-21)

### Story 3.8: Bukti Transaksi — Generate, Kirim & Unduh Ulang

As a owner,
I want menerima Bukti Transaksi via email dan bisa mengunduhnya ulang kapan pun,
So that saya punya alat klaim kepemilikan bila terjadi sesuatu.

**Acceptance Criteria:**

**Given** transaksi efektif (konfirmasi maupun input langsung)
**When** Bukti dirender
**Then** PDF dihasilkan via `@react-pdf/renderer` (server-only, font di-bundle) mengikuti Template Konfirmasi Pembelian Saham v3, berisi: identitas owner, tanggal, jenis modal, Quantity, harga, Shares, Ceil, Strength, Portion setelah transaksi (FR-11)

**Given** Bukti dihitung
**When** dibuat maupun diregenerasi
**Then** merupakan fungsi murni state ledger PADA TITIK POTONG transaksinya — regenerasi (retry outbox maupun unduh ulang) selalu menghitung pada titik potong yang sama, tidak pernah dari posisi mutakhir (konvensi State)

**Given** baris outbox tersedia pasca-commit
**When** pengiriman diproses PROOFS
**Then** kirim async dengan retry; kegagalan terlihat (log/alert), bukan kegagalan senyap; kegagalan kirim tidak membatalkan transaksi efektif (AR-6)

**Given** owner membuka Riwayat Transaksi
**When** halaman dimuat
**Then** riwayat transaksinya tampil (termasuk hasil migrasi menyusul di Epic 6) dengan unduh ulang Bukti kapan pun — regenerasi deterministik; state "Bukti Transaksi belum terkirim ke email — unduh di sini kapan pun" saat pengiriman gagal (FR-11; UX-DR19)

**Given** email Bukti dikirim
**When** template dirender
**Then** memakai From-domain resmi + varian `logo.jpg` (latar putih) (AR-6; UX-DR3)

