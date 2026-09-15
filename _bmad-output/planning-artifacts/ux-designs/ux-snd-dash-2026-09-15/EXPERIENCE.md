---
name: Sip & Dip Ownership Dashboard
status: final
sources:
  - "{planning_artifacts}/prds/prd-snd-dash-2026-08-14/prd.md"
updated: 2026-09-15
---

# Sip & Dip Ownership Dashboard — Experience Spine

## Foundation

Responsive web di atas shadcn/ui + Tailwind. **Mobile-browser-first untuk owner** (UJ-1, UJ-2, UJ-6 dibuka di browser HP); **desktop-capable untuk alur kerja berat COO** (Antrian Beli, RKAP, Distribusi Laba) — semua alur tetap fungsional di HP. Aplikasi mobile native = non-goal.

Library melakukan sebagian besar kerja; disiplin: hormati default shadcn kecuali lapisan brand di `DESIGN.md` (referensi identitas visual; status badge, palet chart, disiplin angka). **Light-only** — tanpa dark mode. Bahasa UI: **Bahasa Indonesia** dengan term metrik English verbatim per Glossary PRD (Quantity, Shares, Ceil, Strength, Portion, Actual, RTL, Fulfillment, dst.); taksonomi memakai **jenis modal** (Modal Tetap, Modal Bergerak, Modal Operasional) — hindari "jenis saham"; unit transaksi "2 Saham Modal Bergerak".

Autentikasi: **akun Google** untuk semua role, dicocokkan lewat email saat migrasi. Kanal notifikasi: **email saja** (Bukti Transaksi, OTP MFA COO, notifikasi pesanan baru ke COO, email pengingat pendaftar) — tidak ada pusat notifikasi in-app. Data luring tidak didukung — PWA installable di HP hanya menyimpan cache aset statis, seluruh data selalu daring (AD-12 spine arsitektur). Motion minimal-fungsional.

Postur produk: **alat kepercayaan, bukan alat penjualan** — jumlah transaksi adalah counter-metric (SM-C1: tidak untuk dioptimalkan). Tidak ada desain yang mendorong transaksi.

## Information Architecture

| # | Permukaan | Reached from | Purpose |
|---|---|---|---|
| 1 | Login Google | URL aplikasi (belum terautentikasi) | Autentikasi akun Google; gerbang pencocokan email migrasi |
| 2 | Pendaftaran Owner + status | Link publik (tanpa perlu referral) / CTA di Login | Daftar akun Google → status Diajukan; tampil status Diajukan / Terverifikasi / Ditolak (+alasan) |
| 3 | Kelengkapan Profile | Login pendaftar yang belum lengkap | Mengisi 11 field Lampiran A (Nama Lengkap, Alias, Gmail, Nomor HP, Kontak Darurat, Nomor HP Kontak Darurat, Hubungan dengan Owner, Nama Bank, Pemilik Rekening, Nomor Rekening, Referal) dengan indikator langkah; kedaluwarsa 7 hari |
| 4 | Halaman Personal (owner tanpa saham & Keluar) | Landing setelah login | Profile, portofolio & status Pesanan Pembelian miliknya, pembuatan Pesanan Pembelian, harga berjalan, tabel RKAP |
| 5 | Form Pesanan Pembelian | CTA dari Halaman Personal / Dashboard / Pesanan Saya | Memesan (Jenis Modal, Quantity, Referral) dengan Panel Pratinjau Perhitungan live |
| 6 | Antrian Beli / Pesanan Saya | Nav COO (seluruh antrian) / nav owner (hanya miliknya) | Siklus hidup pesanan 4-state; konfirmasi COO; tarik pesanan |
| 7 | Form Konfirmasi COO | Aksi "Konfirmasi" pada Baris Antrian Beli (COO) | Pencatatan pembayaran (tanggal + metode, tanpa upload bukti), plotting alokasi Capital Item (default FIFO), MFA, re-validasi |
| 8 | Form Input Langsung COO (FR-21) | Aksi "Input Langsung" di Antrian Beli (COO) | Catat pembelian tunai/langsung atas nama owner; validasi + MFA sama; langsung efektif |
| 9 | Dashboard Kepemilikan | Landing owner pemegang saham | Tabel per owner (Quantity, Shares, Portion, Ceil, Strength, Actual, RTL, Grand Total) + 3 chart paritas spreadsheet; selalu sinkron |
| 10 | RKAP | Nav semua owner (termasuk tanpa saham); edit COO | Tabel Capital Item + agregat per jenis modal + ringkasan batas penyesuaian (1% + 1 saham) + Quantity Left; selector fase RKAP berjalan vs arsip; COO menambah fase baru (tertaut MoM) |
| 11 | Contribution | Nav owner pemegang saham (poin sendiri); ruang kerja COO | Item definisi, realisasi, poin berjalan + saldo carry-over, rekap COO, aksi cut-off |
| 12 | Distribusi Laba | Nav owner sesuai hak; modul COO | Input laba diaudit & ditahan, simulasi 3 Budget Pool (Charity/Dividen/Insentif), rekap per owner, perbandingan rekap sebelumnya |
| 13 | Harga Saham (CMS + tampilan owner) | Nav semua owner (termasuk tanpa saham); CMS COO | Harga berjalan + riwayat (nilai, tanggal efektif, referensi MRO); penetapan harga baru |
| 14 | MoM MRO/RUPS | Nav owner pemegang saham; CMS COO | Notulen draft → final, tertaut keputusan (harga, jenis Contribution, cut-off) |
| 15 | Riwayat Transaksi & Bukti Transaksi | Nav owner | Riwayat transaksi per owner (termasuk hasil migrasi) + unduh ulang Bukti Transaksi (Template Konfirmasi Pembelian Saham v3) |
| 16 | Audit Trail | Nav COO saja | Log permanen semua aksi (aktor, waktu, detail); penolakan lengkap dengan alasan + hitungan |
| 17 | Manajemen Owner | Nav COO saja | CRUD owner (identitas, kontak WA/email, status), reaktivasi owner Keluar, pergantian COO (FR-17, wajib referensi MoM) |

**Model navigasi.** Mobile (<lg): bottom nav maksimal 4 item + "Lainnya" (Sheet). Owner pemegang saham: Dashboard · Pesanan Saya · Lainnya. Owner tanpa saham / Keluar: Halaman Personal (default) · Pesanan Saya · Lainnya. COO: Antrian Beli (landing default) · Dashboard · Lainnya. Desktop (≥lg): sidebar kiri dengan grup sesuai role. Calon Owner dengan Profile belum lengkap: hanya Kelengkapan Profile + statusnya — tanpa nav lain. Modal bertumpuk maksimal satu tingkat.

**Role-gating & matriks keterbukaan owner tanpa saham (berlaku juga bagi Keluar):**

| | Cakupan |
|---|---|
| **Terbuka** | Profile & Pesanan Pembelian miliknya; harga berjalan & riwayat harga; tabel RKAP beserta progressnya; rekap distribusi laba selama masih memiliki poin Contribution yang belum ditunaikan |
| **Terkunci** | Tabel/chart kepemilikan seluruh owner; Contribution; MoM; audit trail (COO saja) |

Item nav terkunci **tidak tampil** (bukan disorot merah). Akses URL langsung ke permukaan terkunci → dialihkan ke Halaman Personal dengan pesan pembuka akses. Seluruh yang terkunci terbuka **otomatis** setelah transaksi pembelian pertama efektif — saat login berikutnya item nav muncul. Antrian Beli lengkap & Audit Trail = COO saja; owner hanya melihat pesanan miliknya.

→ Referensi komposisi (mobile): `mockups/key-dashboard-kepemilikan.html` (#9), `mockups/key-pesanan-pembelian.html` (#5), `mockups/key-antrian-beli-coo.html` (#6 varian COO, #7, MFA), `mockups/key-pendaftaran-profile.html` (#2, #3). Varian desktop (≥lg): `mockups/key-dashboard-kepemilikan-desktop.html`, `mockups/key-pesanan-pembelian-desktop.html`, `mockups/key-pendaftaran-profile-desktop.html` — COO sudah desktop dari awal (`key-antrian-beli-coo.html`). Logo brand: `imports/logo.png`, `imports/logo.jpg`. Permukaan lain spine-only. **Spine menang atas mockup bila berkonflik.**

## Voice and Tone

Nada: **transparan, tenang, edukatif**. Penolakan selalu menyertakan hitungannya. Tanpa cheerleading, tanpa dorongan transaksi (SM-C1). Microcopy; postur brand ada di `DESIGN.md`.

| Do | Don't |
|---|---|
| "Strength proyeksi 104,35% — melebihi batas 100%. Opsi: kurangi Quantity, atau beli Modal Tetap/Modal Bergerak dulu untuk membuka Ceil." | "Ups! Ada yang salah dengan pesanan Anda." |
| "Pesanan menunggu konfirmasi COO. Transaksi baru final setelah pembayaran Anda dikonfirmasi." | "Selamat, pesanan berhasil! 🎉" |
| "Ditolak saat re-validasi: ruang RKAP Modal Bergerak telah terisi (Fulfillment Rate 100%). Dana yang sudah masuk disarankan dialihkan ke Modal Operasional (pesanan baru, harga berjalan) atau direfund via kanal luar — dicatat oleh COO." | "Transaksi gagal. Silakan coba lagi nanti." |
| "Total Portion 99,99% — ditampilkan apa adanya (pembulatan 2 desimal, half-up)." | Memaksa tampil "100%" agar rapi. |
| "Pesanan kedaluwarsa otomatis pada hari ke-7 sejak submit. Anda dapat membuat pesanan baru dengan harga berjalan Rp52.000." | "Sayang sekali! Pesanan Anda hangus." |
| Kalimat lengkap, tenang, selalu dengan angka. | Seruan, emoji, FOMA/FOMO ("sisa 2 saham lagi!", "jangan ketinggalan"). |
| Istilah Glossary verbatim: "jenis modal", "2 Saham Modal Bergerak", Quantity, Shares, Ceil, Strength, Portion, RTL. | "jenis saham", "porsi", "ratio" (label legacy spreadsheet hanya konteks migrasi, bukan UI baru). |
| Menjelaskan keadaan sistem apa adanya ("Menunggu Konfirmasi", "Ditolak dengan alasan", "Kedaluwarsa"). | Eufemisme yang mengaburkan status ("dalam proses" untuk Ditolak). |

## Component Patterns

Behavioral; spesifikasi visual di `DESIGN.md.Components` (atau default shadcn saat diwarisi).

| Component | Dipakai di | Aturan behavioral |
|---|---|---|
| Logo Sip & Dip (`brand-logo`) | Login, Pendaftaran Owner, header/sidebar app | Statis & terpusat di halaman publik (Login, Pendaftaran Owner) — tagline *"Sip the taste, dip the soul"* tampil di bawah lockup logo+nama di halaman publik saja (lihat `DESIGN.md.Components`). Di header/sidebar app: tanpa tagline; ketuk → landing sesuai role (Dashboard untuk pemegang saham, Halaman Personal untuk tanpa saham/Keluar, Antrian Beli untuk COO); target sentuh ≥44px. |
| Status Badge (`status-badge`) | Antrian Beli, Pesanan Saya, pendaftaran, Manajemen Owner | Selalu berteks — warna bukan satu-satunya pembawa makna. Mapping pesanan: Menunggu Konfirmasi `{colors.warn}`, Terkonfirmasi `{colors.success}`, Ditolak shadcn destructive, Kedaluwarsa shadcn muted; pendaftaran: Diajukan `{colors.warn}`, Terverifikasi `{colors.success}`, Ditolak destructive. Perubahan status diumumkan `aria-live="polite"`. |
| Tabel Kepemilikan (`tabel-kepemilikan`) | Dashboard Kepemilikan | **Strategi mobile: scroll horizontal dalam Card dengan kolom Owner sticky kiri** (bukan card-stack) — perbandingan antar-owner adalah inti transparansi. Desktop: 8 kolom penuh. Urutan default Portion menurun; baris owner sendiri disorot + penanda "Anda"; Grand Total baris akhir; Portion 2 desimal; RTL 0 diberi keterangan "Strength optimal"; owner baru muncul otomatis; selalu sinkron dengan 3 chart (satu sumber kebenaran). |
| Tabel RKAP (`tabel-rkap`) | RKAP | Kolom verbatim per FR-23 + agregat per jenis modal + Card ringkasan batas penyesuaian (1% × Initial + 1 saham) + Quantity Left. Selector fase: berjalan (default) vs arsip; fase baru dibuat COO, wajib tertaut MoM. Mobile: kolom nama sticky + scroll horizontal. Read-only bagi owner; edit COO (Final Requirement, Capital Item baru, Utilization, rebalancing) via Dialog + konfirmasi; setiap perubahan tercatat audit trail. |
| Chart Pie "Portion Kepemilikan" (`chart-portion-kepemilikan`) | Dashboard Kepemilikan | Label nama + persentase; wedge ≥3% `[ASSUMPTION]` berlabel langsung, di bawah itu masuk legenda berurutan + tooltip — tidak ada owner yang hilang labelnya saat tumbuh 25 → ~40. Ketuk/klik wedge → sorot baris owner di tabel (dan sebaliknya). Identitas warna owner konsisten dengan cincin luar donut. |
| Chart Donut "Distribusi Pemodalan" (`chart-distribusi-pemodalan`) | Dashboard Kepemilikan | Cincin dalam per jenis modal (Modal Tetap/Bergerak/Operasional), cincin luar per owner; legenda jenis modal selalu tampil; tooltip dua tingkat (owner → rincian per jenis modal); urutan owner sama dengan pie. |
| Chart Stacked Bar "Big Cap" (`chart-big-cap`) | Dashboard Kepemilikan | Kelompok Big Cap > 5%, `[Medium Cap]` > 2%, `[Small Cap]` ≤ 2% — ambang dikonfigurasi COO (pernah berubah dari 7%); Shares vs Ceil per kelompok; kelompok dihitung ulang otomatis dari Portion terkini; nilai dibawa label sumbu. |
| Panel Pratinjau Perhitungan (`panel-pratinjau-hitungan`) | Form Pesanan Pembelian | Live: berganti seketika saat Jenis Modal/Quantity/Referral berubah. Isi: Harga Terkunci (harga berjalan tanggal submit) + proyeksi Ceil, Shares, Strength, RTL. Hitungan menyertakan pesanan owner yang masih Menunggu Konfirmasi (dua pesanan yang masing-masing valid bisa ditolak bila gabungan > 100%). Belum lengkap → placeholder; proyeksi Strength > 100% → angka merah + Alert Penolakan Terhitung aktif + Submit terkunci. Update diumumkan `aria-live="polite"`. |
| Alert Penolakan Terhitung (`alert-penolakan-terhitung`) | Form Pesanan, Konfirmasi COO, Input Langsung, RKAP | Selalu berisi: alasan + rincian hitungan (font-mono) + langkah lanjut yang bisa dilakukan. Tidak pernah generik. Berlaku untuk penolakan submit (FR-1), re-validasi konfirmasi (FR-20), gerbang RKAP (FR-23), dan penolakan pendaftaran. |
| Dialog MFA OTP (`dialog-mfa-otp`) | Konfirmasi COO, Input Langsung | Alur: aksi transaksional → dialog "Kirim OTP ke email COO" → kode 6 digit `[ASSUMPTION]` dikirim → input → verifikasi → aksi berlanjut. State: menunggu kirim, menunggu input (berlaku 10 menit `[ASSUMPTION]`), salah (sisa percobaan), kedaluwarsa, kirim ulang (cooldown 60 detik `[ASSUMPTION]`). Semua permintaan MFA tercatat audit trail. Fokus otomatis ke digit pertama; Esc membatalkan seluruh aksi — tidak ada transaksi setengah jadi. |
| Baris Antrian Beli (`baris-antrian-beli`) | Antrian Beli (COO), Pesanan Saya (owner) | Varian COO: seluruh pesanan Menunggu Konfirmasi, urut terlama-dulu `[ASSUMPTION]`, caption umur "hari ke-N dari 7", aksi Konfirmasi. Varian owner: hanya pesanan miliknya (semua status), aksi Tarik hanya saat Menunggu Konfirmasi. Pesanan Ditolak menampilkan alasan + hitungan. Pesanan ditarik keluar dari daftar (penarikan bukan status; jejak di audit trail). Email ke COO per pesanan baru. |

**Pola konfirmasi & aksi destruktif:**
- **Tarik pesanan** (owner): confirm ringan — "Pesanan keluar dari Antrian Beli. Pembayaran yang sudah dikirim tidak otomatis refund."
- **Tolak pesanan / tolak pendaftaran** (COO): wajib mengisi alasan; sistem menyisipkan hitungan penolakan otomatis.
- **Konfirmasi pesanan** (COO): ringkasan pembayaran + hasil re-validasi + MFA; SM-4: seluruh konfirmasi selesai < 5 menit — satu dialog, kolom terisi bawaan, plotting default FIFO.
- **Cut-off Contribution** (COO): confirm dengan pratinjau rekap (poin sah vs carry-over) sebelum final.
- **Penyesuaian RKAP & pergantian COO** (COO): confirm + tampil sisa batas penyesuaian; pergantian COO wajib referensi MoM.

## State Patterns

| State | Permukaan | Treatment |
|---|---|---|
| Cold load (semua permukaan data) | Semua | shadcn Skeleton menyerap layout target. Angka tidak pernah tampil setengah-termuat — data chart & tabel dimuat bersama (satu sumber kebenaran), lalu dirender serentak. |
| Gagal muat | Dashboard, RKAP, Contribution, dll. | "Tidak dapat memuat data." + tombol Coba lagi. Menampilkan angka basi secara diam-diam dilarang (kepercayaan > ketersediaan tampilan). |
| Dashboard kosong | Dashboard | Hanya mungkin pra-migrasi: "Belum ada data kepemilikan." Pasca go-live berisi data migrasi 22 owner. |
| Antrian kosong (COO) | Antrian Beli | "Tidak ada pesanan menunggu konfirmasi." Tanpa CTA dorong-transaksi. |
| Pesanan Saya kosong (owner) | Pesanan Saya | "Belum ada Pesanan Pembelian." + satu CTA tenang "Buat Pesanan Pembelian". |
| Riwayat kosong (owner baru) | Riwayat Transaksi | "Transaksi Anda akan tercatat di sini. Bukti Transaksi dikirim ke email Anda setelah transaksi efektif." |
| RKAP kosong | RKAP | "Belum ada fase RKAP." (COO dapat menambah; owner: minta COO/MRO). |
| MoM / item Contribution kosong | MoM, Contribution | "Belum ada MoM tersimpan." / "Belum ada item Contribution periode ini." |
| Error terhitung / penolakan | Form Pesanan, Konfirmasi, Input Langsung, RKAP | Alert Penolakan Terhitung (alasan + hitungan + langkah lanjut). |
| Pesanan Kedaluwarsa | Antrian Beli, Pesanan Saya | Badge Kedaluwarsa + "kedaluwarsa otomatis hari ke-7 sejak submit (tanggal submit tertera)" + info bisa membuat pesanan baru dengan harga berjalan. |
| Pendaftaran kedaluwarsa | Pendaftaran, Kelengkapan Profile | Status kedaluwarsa setelah 7 hari tanpa Profile lengkap (keputusan UX atas TODO FR-22); email pengingat dikirim sebelumnya (H-3 `[ASSUMPTION]`); pendaftar dapat mendaftar ulang. |
| Pendaftaran Ditolak | Pendaftaran | Status Ditolak + alasan tercatat COO, ditampilkan apa adanya. |
| Permission-denied (Terkunci) | Dashboard, Contribution, MoM bagi owner tanpa saham | Item nav tersembunyi; URL langsung → redirect Halaman Personal + "Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif." Audit Trail non-COO → sama (redirect Dashboard/Antrian). |
| MFA: menunggu OTP | Dialog MFA OTP | Input aktif + "Kode dikirim ke email COO. Berlaku 10 menit." |
| MFA: OTP salah / kedaluwarsa | Dialog MFA OTP | "Kode salah — silakan periksa dan coba lagi." / "Kode kedaluwarsa — kirim ulang." Kirim ulang dengan cooldown. |
| Login: email tidak cocok | Login Google | "Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. Owner eksisting: hubungi COO untuk pencocokan email migrasi." |
| Bukti gagal terkirim | Riwayat Transaksi (owner) | "Bukti Transaksi belum terkirim ke email — unduh di sini kapan pun." Pengiriman diulang sistem. |
| Tidak terjangkau | Global | "Tidak dapat terhubung." + Coba lagi. Tanpa dukungan offline. |
| Portion total 99,99% / 100,01% | Dashboard, Grand Total | Ditampilkan apa adanya + keterangan "total pembulatan 2 desimal (half-up)" pada catatan kaki tabel. |
| Form submit gagal (non-validasi) | Semua form | Data form dipertahankan; toast "Tidak dapat menyimpan — coba lagi."; tidak ada pengisian ulang dari nol. |
| Rekap pertama (tanpa pembanding) | Distribusi Laba | Blok perbandingan "rekap sebelumnya" disembunyikan + catatan "Belum ada rekap sebelumnya — perbandingan muncul setelah rekap kedua tersimpan." |

## Interaction Primitives

**Touch-first** (owner dominan di HP): target sentuh ≥44×44px; form Pesanan Pembelian = halaman penuh dengan Panel Pratinjau Perhitungan menempel (sticky) di bawah viewport; Dialog di mobile menjadi Sheet/Drawer penuh; tabel digulir horizontal dengan kolom sticky; ketuk wedge chart ↔ sorot baris tabel.

**Desktop** (COO): seluruh alur COO dapat dioperasikan penuh via keyboard; `Tab` mengikuti urutan baca; `Esc` menutup dialog/popover teratas; tanpa shortcut bersusun (vim-style) — bukan produknya.

**Diwarisi dari shadcn:** perilaku Dialog/Sheet/Popover/DropdownMenu/Tooltip/Tabs/Select/Toast bawaan, fokus-trap, dan focus ring.

**Dilarang:** affordance hover-only di viewport <lg; modal bertumpuk >1 tingkat; infinite scroll (paginasi/berkas); drag-to-reorder; animasi perayaan/confetti; badge gamifikasi/streak; pusat notifikasi in-app.

## Responsive & Platform

Web responsif; dua postur, breakpoint tunggal `lg` (1024px):

| Aspek | Mobile (<lg) — dominan owner | Desktop (≥lg) — alur berat COO |
|---|---|---|
| Navigasi | Bottom nav maks. 4 item + "Lainnya" (Sheet) | Sidebar kiri dengan grup sesuai role |
| Tabel & chart | Dalam Card; scroll horizontal dengan kolom pertama sticky; chart satu kolom | Konten sampai `max-w-7xl`; chart dashboard berjajar; tabel kerja COO full-width |
| Dialog | Dialog/confirm menjadi Sheet/Drawer penuh | Dialog terpusat bawaan shadcn |

Semua alur tetap fungsional di kedua postur — tidak ada kapabilitas yang desktop-only.

→ Referensi visual postur desktop: `mockups/key-dashboard-kepemilikan-desktop.html` (sidebar + tabel 8 kolom penuh + chart berjajar), `mockups/key-pesanan-pembelian-desktop.html` (panel pratinjau sticky sisi kanan), `mockups/key-pendaftaran-profile-desktop.html` (kartu terpusat halaman publik).

## Format Angka & Presisi

- Presisi NFR: **2 desimal, pembulatan half-up (≥5 ke atas)**; total Portion ditampilkan apa adanya meski 99,99%/100,01%.
- Locale **id-ID** `[ASSUMPTION]` (mengikuti bahasa UI): rupiah tanpa desimal dengan pemisah ribuan titik (Rp52.000), persentase 2 desimal dengan koma (66,67%), angka saham bulat (2), Shares/Ceil bulat, Actual rupiah.
- Unit transaksi ditulis "2 Saham Modal Bergerak" — bukan "2 lembar saham".
- Semua angka `tabular-nums`; hitungan `font-mono` (lihat `DESIGN.md` Typography). Istilah metrik English verbatim per Glossary.

## Accessibility Floor

WCAG 2.1 AA (behavioral; kontras & warna di `DESIGN.md` — kombinasi muatan: badge ≈5.0:1, chart ≥3:1 + redundansi teks).

- Warna tidak pernah satu-satunya pembawa informasi: badge selalu berteks; chart punya label/legenda/tooltip; Alert Penolakan Terhitung membawa hitungan dalam teks.
- Screen reader: perubahan status pesanan & hasil pratinjau diumumkan `aria-live="polite"`; header tabel `th scope`; nama permukaan diumumkan saat navigasi; `lang="id"`.
- Keyboard: alur COO (konfirmasi + MFA, input langsung, RKAP, cut-off) sepenuhnya keyboard-operable; fokus terlihat (ring shadcn); Dialog MFA mengelola fokus (awal di digit pertama, kembali ke pemicu saat tutup).
- `prefers-reduced-motion` dihormati — motion memang minimal-fungsional; tidak ada animasi dekoratif.
- Target sentuh ≥44×44px di semua viewport; `Tab` mengikuti urutan baca.

## Key Flows

Referensi komposisi layar: `mockups/`.

### Flow 1 — UJ-1. "Owner memesan pembelian saham secara mandiri; COO mengonfirmasi setelah pembayaran diterima." (Bima, dari HP; Rani COO)

*Komposisi: `mockups/key-pesanan-pembelian.html` (langkah 2–5 + failure a), `mockups/key-antrian-beli-coo.html` (langkah 6–7).*

1. Bima login akun Google di browser HP → landing Halaman Personal (Terverifikasi, tanpa saham).
2. Buka "Pesanan Pembelian" → form halaman penuh.
3. Pilih Jenis Modal — pilihan dinamis mengikuti kondisi RKAP (ketiga jenis selama RKAP terbuka; hanya Modal Operasional saat ruang penuh); Quantity dengan petunjuk Quantity maksimal beserta modus dan alasannya (pembulatan Ceil ke atas/bawah, atau Quantity Left jenis modal — rincian di Panel Pratinjau Perhitungan); isian Referral (wajib — Pembelian Pertama) memilih owner eksisting atau owner Terverifikasi lain yang belum membeli (validasi cross-referral, sama dengan Flow 7).
4. Panel Pratinjau Perhitungan live: Harga Terkunci (hari ini) + proyeksi Ceil, Shares, Strength, RTL.
5. Submit → pesanan berstatus **Menunggu Konfirmasi** di Antrian Beli; email notifikasi ke Rani; Bima mentransfer melalui kanal luar.
6. Rani membuka Antrian Beli, mengetuk pesanan Bima → Form Konfirmasi: tanggal & metode transfer (tanpa upload bukti), plotting alokasi Capital Item (default FIFO), MFA OTP via email, sistem re-validasi kondisi terkini.
7. **Climax:** lolos re-validasi → transaksi efektif; dashboard, rekap, ketiga chart, dan Fulfillment RKAP terupdate otomatis; Bukti Transaksi terkirim ke email Bima; akses Bima terbuka penuh (transparansi antar owner) — satu sumber kebenaran tanpa satu entri manual.

Failure paths: (a) proyeksi Strength > 100% saat submit → ditolak sebelum antrian dengan Alert Penolakan Terhitung (angka lengkap + opsi); (b) menumpuk pesanan antrian yang masing-masing valid → gabungan divalidasi, ditolak bila > 100%; (c) re-validasi gagal saat konfirmasi → Ditolak + hitungan + saran pengalihan ke Modal Operasional atau refund via kanal luar (resolusi dicatat COO di audit trail); (d) pembayaran tak kunjung diterima → Kedaluwarsa otomatis hari ke-7, pesanan baru memakai harga berjalan; (e) Bima menarik pesanan selama Menunggu Konfirmasi → keluar dari antrian, tercatat audit trail.

### Flow 2 — UJ-2. "Owner memeriksa Portion dan poin Contribution-nya dari HP." (Hanif, owner kontributor, browser HP)

*Komposisi: `mockups/key-dashboard-kepemilikan.html` (langkah 1–3).*

1. Hanif login → Dashboard Kepemilikan.
2. Baris "Hanif" tersorot — detail miliknya: Actual, Quantity, Shares, Portion, Ceil, Strength, RTL.
3. Ketuk wedge "Hanif" pada pie "Portion Kepemilikan" → baris tabel tersorot (dua arah).
4. Buka Contribution → poin Contribution berjalan periode aktif + saldo carry-over.
5. **Climax:** angka yang dilihat identik dengan yang akan dipakai dalam diskusi MRO — Hanif datang ke MRO dengan kepercayaan penuh pada angka.

Failure: data gagal dimuat → "Tidak dapat memuat data" + coba lagi; angka basi tidak pernah ditampilkan diam-diam.

### Flow 3 — UJ-3. "MRO menetapkan harga saham baru dan sistem mencatat keputusannya." (Rani, COO, web app)

1. Rani membuka CMS Harga Saham; harga berjalan + riwayat tampil.
2. Input harga beli & jual baru + tanggal mulai berlaku + tertaut MoM MRO ("ditetapkan di MRO tanggal X").
3. Simpan → riwayat bertambah satu baris.
4. **Climax:** transaksi berikutnya otomatis memakai harga baru; harga lama tetap terlihat historisnya — tidak ada harga yang hidup di "ingatan kolektif" atau chat.

Failure: simpan gagal → form dipertahankan + toast coba lagi; tanggal tidak valid → validasi inline sebelum simpan.

### Flow 4 — UJ-4. "Cut-off Contribution: insentif yang akan dibayar, sisa terbawa." (Rani, COO)

1. Rani membuka Contribution → aksi "Cut-off Period".
2. Input tanggal cut-off (ditetapkan saat RUPS; tidak harus bertepatan dengan tanggal RUPS).
3. Pratinjau rekap: poin sah tiap owner (hingga tanggal cut-off) vs poin carry-over.
4. Confirm (pola destruktif) → poin sah difinalkan sebagai dasar pool Insentif (FR-16), ditandai selesai; sisanya carry-over.
5. **Climax:** rekap cut-off terbit — dasar pembagian Insentif dan apa yang terbawa; periode baru dimulai dengan saldo carry-over yang jelas (tampil sejak awal).

Failure: batal sebelum confirm → tidak ada perubahan; hasil cut-off tercatat audit trail.

### Flow 5 — UJ-5. "RUPS membagikan laba dalam bentuk charity, dividen, dan insentif: sistem menghitung, manusia membayar." (Rani, COO)

1. Rani membuka modul Distribusi Laba; data Portion & Contribution periode berjalan sudah mutakhir.
2. Input laba diaudit & laba ditahan → sistem menampilkan Laba Dibagikan.
3. Atur ratio tiga komponen (parameter RUPS; patokan MRO terakhir: Charity 5%, Dividen 41%, Insentif 54%) → sistem menghitung tiga Budget Pool + rincian per owner (Dividen = Portion × pool Dividen; Insentif = poin ÷ total poin × pool Insentif).
4. Simpan rekap tertaut RUPS tersebut.
5. **Climax:** setiap owner melihat angka bagiannya sendiri — transparan dan bisa diverifikasi silang; rekap sebelumnya tersedia untuk perbandingan. Pembayaran tetap via kanal luar.

Failure: ratio tidak berjumlah 100% → validasi sebelum hitung; basis poin belum difinalkan cut-off → peringatan tautan ke Flow 4. Owner tanpa saham yang bagian Insentif-nya ditunaikan pada rekap ini berubah status Keluar (aksesnya menyusut ke Halaman Personal pada login berikutnya).

### Flow 6 — UJ-6. "Calon owner mendaftar mandiri hingga halaman personal terbuka." (Dewi, browser HP, belum punya akun)

*Komposisi: `mockups/key-pendaftaran-profile.html` (langkah 2–3 + kedaluwarsa).*

1. Dewi membuka halaman pendaftaran (URL publik — tanpa link referral).
2. Daftar dengan akun Google → status **Diajukan**.
3. Melengkapi Profile 11 field Lampiran A; indikator menunjukkan persis langkah yang belum lengkap.
4. Rani memverifikasi (tombol verifikasi tidak tersedia sebelum Profile lengkap) → status **Terverifikasi**.
5. **Climax:** tanpa satu pun entri manual dari COO, Dewi sampai ke pintu Pesanan Pembelian (lanjut Flow 1); dashboard kepemilikan, Contribution, dan MoM tetap terkunci sampai transaksi pertamanya efektif.

Failure paths: (a) ditolak COO → status Ditolak + alasan tercatat, ditampilkan apa adanya; (b) Dewi tidak melengkapi → email pengingat, lalu pendaftaran kedaluwarsa otomatis 7 hari (keputusan UX atas TODO FR-22) — bisa mendaftar ulang; (c) Rani mencoba verifikasi prematur → aksi tidak tersedia (gerbang: Profile lengkap).

### Flow 7 — Varian UJ-1: Input langsung COO (FR-21) — "pembayaran tunai di cafe" (Rani, COO)

1. Owner membayar tunai di cafe; Rani membuka Antrian Beli → aksi "Input Langsung".
2. Pilih owner (mana pun, termasuk yang belum pernah membeli); Jenis Modal, Quantity; Referral bila Pembelian Pertama owner tersebut (pilihan & validasi sama, termasuk cross-referral hari yang sama).
3. Catat tanggal & metode pembayaran (tunai).
4. MFA OTP via email → validasi Strength/RTL, ruang RKAP, keabsahan referral memakai harga berjalan tanggal input.
5. **Climax:** transaksi langsung efektif tanpa melewati Antrian Beli — dashboard, rekap, chart, Fulfillment RKAP terupdate; Bukti Transaksi terkirim; audit trail mencatat "input langsung".

Failure: validasi gagal → Alert Penolakan Terhitung (hitungan lengkap), transaksi tidak terjadi, tidak ada status pesanan yang menggantung.
