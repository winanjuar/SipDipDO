# Reconcile — PRD prd-snd-dash-2026-08-14

Membandingkan PRD (input) dengan dua spine UX: `DESIGN.md` (D) dan `EXPERIENCE.md` (E) di `ux-snd-dash-2026-09-15`. Verifikasi dilakukan per seksi PRD: §1 Vision, §2 Target User (JTBD, non-users, UJ-1..6 + edge), §3 Glossary (verbatim), §4 FR-1..FR-23 + NFR, §5 Non-Goals, §7 Success Metrics, Lampiran A.

## Ringkasan

Kedua spine membawa hampir seluruh isi kualitatif PRD dengan setia: istilah Glossary dipakai verbatim (termasuk ejaan status, nama chart, 11 field Lampiran A), pola "penolakan edukatif dengan hitungan" hadir kuat, NFR presisi 2-desimal half-up + tampilan 99,99%/100,01% eksplisit di kedua file, SM-4 (<5 menit) dan counter-metric SM-C1 terbawa sebagai constraint desain, dan tidak ada satu pun non-goal yang bocor jadi fitur. Ditemukan 4 drift ringan (penamaan, cakupan opsi referral, nuansa Quantity maksimal, multi-fase RKAP) — semuanya mudah diperbaiki dengan edit satu kalimat; tidak ada pergeseran semantik material.

## Represented

| Item PRD | Lokasi spine |
|---|---|
| §1 Visi: satu sumber kebenaran; finalisasi tetap di COO; bukti terkirim otomatis; keputusan MRO tercatat; COO alat kerja anti-manual | E Foundation:13, Flow 1:157–159; D Brand:96 |
| §1 Visi: menggantikan Google Sheets; salah hitung Portion = krisis kepercayaan | D Brand:96; E IA 9 "paritas spreadsheet":33; E Tabel Kepemilikan "selalu sinkron…satu sumber kebenaran":78 |
| §1 Transparansi penuh antar pemegang saham; owner tanpa saham hanya halaman personal | E role-gating:45–52 (matriks verbatim); IA 4:28 |
| §2.1 JTBD owner pembeli (pesan mandiri, tahu lolos validasi, final setelah pembayaran) | Flow 1:151–161; E Voice do#2:63 |
| §2.1 JTBD owner penonton (komposisi transparan, tanpa file rancu) | Flow 2:163–171 |
| §2.1 JTBD calon owner (daftar dari rumah, tahu langkah belum lengkap) | Flow 6:202–210; E IA 3 indikator langkah:27 |
| §2.1 JTBD COO (sekali konfirmasi semua terupdate; sistem memvalidasi) | Flow 1:158, Flow 7:218; E pola konfirmasi:91 |
| §2.2 Non-user publik: pendaftaran terbuka via URL, tanpa link referral | E IA 2:26, Flow 6:204; State login:114 |
| UJ-1 penuh: referral wajib Pembelian Pertama, validasi gabungan antrian, pratinjau, Harga Terkunci, transfer kanal luar, COO catat tanggal+metode, MFA, re-validasi, climax | Flow 1:151–161; E Panel Pratinjau:83 |
| UJ-1 edge (a) Strength >100% ditolak + hitungan | Flow 1 failure (a):161; E Voice do#1:62; D Alert Penolakan:145 |
| UJ-1 edge (b) re-validasi gagal → Ditolak + saran pengalihan Modal Operasional/refund kanal luar | Flow 1 failure (c):161; E Voice do#3:64; State:107 |
| UJ-1 edge (c) kedaluwarsa hari ke-7; (d) tarik pesanan selama Menunggu Konfirmasi | Flow 1 failure (d)(e):161; E Baris Antrian:86; State Kedaluwarsa:108; pola confirm tarik:89 |
| UJ-1 varian tunai di cafe → input langsung | Flow 7:212–220 (FR-21 utuh, termasuk cross-referral) |
| UJ-2: cek Portion & Contribution dari HP; angka = angka MRO | Flow 2:163–171 |
| UJ-3: harga baru + tanggal mulai + "ditetapkan di MRO tanggal X"; riwayat tetap terlihat | Flow 3:173–180; E IA 13:37 |
| UJ-4: cut-off (tanggal RUPS, tak harus bertepatan), finalisasi poin, carry-over tampil sejak awal | Flow 4:182–190; E IA 11:35; pola confirm cut-off:92 |
| UJ-5: laba diaudit/ditahan → Laba Dibagikan → 3 pool; formula pro-rata; rekap tertaut RUPS; pembayaran kanal luar; transisi Keluar | Flow 5:192–200; E IA 12:36 |
| UJ-6: Google → Diajukan → Profile → verifikasi gerbang lengkap → Terverifikasi → halaman personal; edge Ditolak+alasan, verifikasi prematur diblokir | Flow 6:202–210; E State:109–110 |
| Glossary taksonomi: "jenis modal" (bukan "jenis saham"); unit "2 Saham Modal Bergerak" | E Foundation:15, Voice don't:68, Format Angka:134 |
| Glossary istilah metrik English verbatim: Quantity, Shares, Portion, Ceil, Strength, Actual, RTL | D Tabel Kepemilikan:139; E IA 9:33, Flow 2:166 |
| Glossary klaster RKAP: Capital Item, Initial/Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held, Rebalancing, Quantity Left | D Tabel RKAP kolom verbatim:140; E Tabel RKAP:79 |
| Glossary distribusi: Laba Dibagikan, Charity, Budget Pool, Dividen, Insentif, Contribution Period, carry-over | E IA 12:36, Flow 5:196, Flow 4:188 |
| Glossary Pesanan Pembelian / Antrian Beli / Harga Terkunci / Bukti Transaksi / MFA (OTP via email) | E IA 5–7:29–31, Panel:83, IA 15:39, Dialog MFA:85 |
| Status pesanan verbatim: Menunggu Konfirmasi, Terkonfirmasi, Ditolak, Kedaluwarsa (4-state; penarikan bukan status) | D status-badge:51–58,138; E Status Badge:77, Baris Antrian:86 |
| Status pendaftaran verbatim: Diajukan, Terverifikasi, Ditolak | E IA 2:26, Status Badge:77; D Badge:138 |
| Owner Keluar: setara tanpa saham, akses halaman personal, bisa reaktivasi | E IA 4:28, IA 17:41, Flow 5:200; role-gating:45 |
| FR-1: pratinjau hitungan live + tolak >100% dengan hitungan + validasi gabung pesanan antrian + pilihan jenis modal dinamis RKAP | E Panel Pratinjau:83; Flow 1:155–156; D Panel:144 |
| FR-1 pilihan jenis modal mengikuti kondisi RKAP (3 jenis saat terbuka; hanya Operasional saat penuh) | Flow 1 step 3:155 |
| FR-3: MFA OTP email wajib aksi transaksional COO; owner tanpa MFA; permintaan tercatat audit | E Dialog MFA:85; Flow 1:158, Flow 7:217 |
| FR-19: siklus hidup, kedaluwarsa hari ke-7, tarik hanya saat Menunggu Konfirmasi, antrian penuh COO-only, email COO per pesanan baru | E Baris Antrian Beli:86; Foundation:17; caption "hari ke-N dari 7" D:91 |
| FR-20: tanggal+metode tanpa upload bukti, MFA, re-validasi (Strength/RKAP/referral), harga final Harga Terkunci, plotting default FIFO, Fulfillment tercetak | E IA 7:31, pola konfirmasi:91, Voice do#3:64; Flow 1:158–159 |
| FR-23: tabel RKAP tersendiri (bukan kolom tabel kepemilikan), agregat per jenis modal, ringkasan batas 1% + 1 saham + Quantity Left, edit COO (Final Req, item baru, Utilization, rebalancing) via Dialog, audit trail, read-only owner, terbuka owner tanpa saham | D Tabel RKAP:64–67,140; E IA 10:34, Tabel RKAP:79, pola confirm:93; role-gating:49 |
| FR-4: kolom + Grand Total + Portion 2 desimal + RTL 0 = "Strength optimal" + owner baru otomatis | D Tabel Kepemilikan:59–63,139; E Tabel Kepemilikan:78 |
| FR-5: chart sinkron tabel, label owner tidak hilang saat tumbuh 25→~40 | E chart-pie:80 ("tidak ada owner yang hilang labelnya"); IA 9:33 |
| FR-18: Pie "Portion Kepemilikan", Donut dua cincin "Distribusi Pemodalan", Stacked bar "Big Cap" (+`[Medium Cap]`/`[Small Cap]`); ambang >5%/>2%/≤2% dikonfigurasi (pernah 7%) | D komponen 4–6:141–143 + warna:105–107; E chart patterns:80–82 |
| Paritas legacy spreadsheet sebagai konsep (chart & tabel RKAP); label legacy ("Porsi", "Ratio") dilarang di UI baru | E Voice don't:68; D Brand:96; E IA 9:33 |
| FR-6: CMS harga, riwayat (nilai, tanggal efektif, referensi MRO), terlihat semua owner termasuk tanpa saham | E IA 13:37; Flow 3:175–178 |
| FR-7: MoM MRO/RUPS draft → final, tertaut keputusan (harga, jenis Contribution, cut-off) | E IA 14:38 |
| FR-8/FR-9: item Contribution (poin kuantitatif, tertaut MoM), realisasi COO, poin berjalan owner | E IA 11:35, Flow 2:168 |
| FR-10: cut-off + finalisasi + carry-over; rekap pisah poin sah vs terbawa; saldo tampil sejak awal | Flow 4:186–188; E pola confirm:92 |
| FR-16: input 2 laba, ratio param RUPS (patokan 5/41/54), 3 Budget Pool, formula Dividen/Insentif, rekap banding, basis poin ter-final cut-off, visibility matriks | Flow 5:194–200 (failure: validasi ratio 100%, basis belum cut-off); IA 12:36 |
| FR-11: Bukti Transaksi per transaksi efektif, unduh ulang, Template Konfirmasi Pembelian Saham v3 | E IA 15:39, Riwayat kosong:104, Bukti gagal terkirim:115 |
| FR-12: audit trail permanen, COO-only, penolakan + alasan + hitungan | E IA 16:40 |
| FR-13: CRUD owner (identitas, kontak WA/email, status), reaktivasi Keluar | E IA 17:41 |
| FR-14: hasil migrasi tampil (riwayat per owner, 22 owner, dashboard tak kosong pasca go-live) | E IA 15:39, State Dashboard kosong:101 |
| FR-15 + matriks keterbukaan: tabel Terbuka/Terkunci verbatim; nav terkunci tersembunyi (bukan merah); redirect + pesan; terbuka otomatis pasca Pembelian Pertama | E role-gating:45–52, State permission-denied:111 |
| FR-17: pergantian COO wajib referensi MoM; riwayat jabatan | E IA 17:41, pola confirm:93 |
| FR-22: registrasi Google, gerbang urutan (registrasi → Profile lengkap → verifikasi), status 3-state, email pengingat + kedaluwarsa pendaftar, halaman personal minimal, pencocokan email migrasi | Flow 6:202–210; E IA 2–4:26–28, State:109,114; kedaluwarsa 7 hari = keputusan UX atas TODO FR-22 (ditandai):109 |
| Lampiran A: 11 field verbatim termasuk ejaan "Referal"; label Google Form vs sistem (referral saat Pembelian Pertama) | E IA 3:27; Flow 1:155 |
| NFR presisi: 2 desimal half-up; total Portion apa adanya 99,99%/100,01% | E Format Angka:132, State:117, Voice do#5:65; D Do's:159 |
| SM-3 (bukti selalu sampai): retry + fallback unduh | E State "Bukti gagal terkirim":115 |
| SM-4: konfirmasi COO < 5 menit — satu dialog, kolom terisi bawaan, plotting default FIFO | E pola konfirmasi:91; COO landing = Antrian Beli:43 |
| SM-C1: counter-metric, tanpa dorongan transaksi (tanpa FOMO, tanpa CTA dorong) | E Foundation:19, Voice:58,67, State antrian kosong:102 |
| Semua 8 non-goal TIDAK muncul sebagai fitur (investor, pembayaran otomatis, akuntansi, mobile native, payment gateway/upload bukti, voting otomatis, notifikasi semua owner, publikasi publik) | E Foundation:13,17 (mobile native & kanal email eksplisit non-goal); IA 7 "tanpa upload bukti":31; Flow 5 "pembayaran via kanal luar":198; tanpa UI pembayaran/voting/notifikasi-in-app di seluruh spine |

## Dropped

| Item | Alasan |
|---|---|
| FR-2 penjualan saham (harga jual berbeda) + FR-13(b) bekas pemegang `[Phase 2]` | PRD eksplisit menunda ke Phase 2; tidak boleh ada di spine v1. Legitim. |
| Manajemen Investor (non-user, non-goal) | Non-goal §5; keberadaannya di spine justru pelanggaran. Legitim. |
| Modul voting MRO terautomatis | Non-goal §5; spine hanya MoM + hasil keputusan yang diinput (IA 14). Legitim. |
| Akuntansi/laporan keuangan cafe | Non-goal §5. Legitim. |
| Kuantifikasi SM-1 (3 bulan) & SM-2 (1 bulan) | Definisi metrik go-live, bukan antarmuka; posturnya (zero discrepancy, Sheets pensiun) terbawa kualitatif via "satu sumber kebenaran" + larangan angka basi. Legitim. |
| Identitas COO saat ini (Sugeng Winanjuar) | Data personal, bukan keputusan desain; portabilitas role justru terbawa via FR-17. Legitim. |
| Provenance fase RKAP 1 (deck IPO; contoh item "Peralatan Lainnya" 1.664.000) & angka verifikasi engine (batas 2.484.000; 861 saham; laba 12M) | Data historis/kasus uji perhitungan mesin — bukan materi UX; struktur & batasnya (1% + 1 saham) tetap terbawa. Legitim. |
| Proses migrasi sebagai permukaan UX (FR-14 sebagai aktivitas) | One-off operasional; hanya hasilnya yang berefek UX (riwayat, dashboard) — sudah direpresentasikan. Legitim. |

## At-risk / drifted

| Item | Masalah | Lokasi | Saran perbaikan |
|---|---|---|---|
| Istilah Glossary "Pendaftaran Owner" | Permukaan dinamai "Pendaftaran Mandiri (publik)" — Glossary §3 mematok istilah verbatim ("Pendaftaran Owner"; FR-22: "Pendaftaran owner mandiri") | E IA 2:26 | Ganti nama permukaan/label nav ke "Pendaftaran Owner" ("mandiri" cukup sebagai deskriptor, bukan nama) |
| Osi referral di UJ-1 | Flow 1 menulis "memilih owner eksisting" — FR-22 juga mengizinkan referral ke owner baru yang belum pernah membeli (cross-referral perdana hari yang sama); Flow 7 sudah benar, Flow 1 menyempitkan | E Flow 1 step 3:155 | Selaraskan redaksi: "owner eksisting pemegang saham (termasuk COO) atau owner Terverifikasi yang belum pernah membeli" |
| Petunjuk Quantity maksimal (FR-1) | FR-1 membedakan pembulatan ke atas `ceil(sisa ÷ harga)` selama toleransi tertampung vs Quantity Left saat batas fase habis; spine hanya menulis "petunjuk Quantity maksimal" tanpa dua mode & alasannya — area "penolakan edukatif" | E Flow 1 step 3:155 | Tambah satu kalimat di Panel Pratinjau/petunjuk input: nilai maksimal + mode aktif (pembulatan ke atas vs Quantity Left) beserta alasan singkat |
| RKAP multi-fase (FR-23) | FR-23 mencatat RKAP per fase (fase berjalan, fase baru, arsip; Initial dikunci saat MRO menetapkan fase); permukaan RKAP belum menunjukkan navigasi antar fase / penambahan fase baru — hanya state kosong "Belum ada fase RKAP" | E IA 10:34, Tabel RKAP:79, State:105 | Tambah selector/tautan "fase berjalan vs riwayat fase" + aksi COO "tambah fase (tertaut MoM)" pada pola Tabel RKAP |

---

*Catatan integritas: pemeriksaan khusus terpenuhi — ejaan status (Menunggu Konfirmasi/Terkonfirmasi/Ditolak/Kedaluwarsa/Diajukan/Terverifikasi) verbatim di D+E; nama chart verbatim; 11 field Lampiran A verbatim termasuk "Referal"; pola penolakan edukatif dengan hitungan hadir (Alert Penolakan Terhitung, Voice, D komponen 8); NFR 2-desimal half-up + 99,99%/100,01% di E Format Angka/State/D Do's; SM-4 <5 menit di pola konfirmasi; SM-C1 di Foundation/Voice/State; tidak ada non-goal yang muncul sebagai fitur.*
