# Editorial Review — Structure Lens (pasca-revisi keputusan akses pendaftaran)

- **Tanggal review:** 2026-09-15
- **Berkas:** `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md` (7.289 kata; status `final`, `updated: 2026-09-15`)
- **Lensa:** struktur (editorial) — konten suci; hanya organisasi dan ekspresi yang dikritisi.
- **Fokus revisi yang diperiksa:** keputusan baru (override r21) — halaman pendaftaran dapat diakses tanpa link referral, sebutan "default COO" dihapus; r22 tetap — referral diajukan saat Pembelian Pertama, divalidasi COO saat konfirmasi.
- **Model struktur:** Strategic/Context (Pyramid) — PRD sebagai dokumen keputusan.

**Bacaan tujuan/audiens:** Dokumen ini ada untuk memberi PM, arsitek, dan workflow turunan (UX, architecture, epics & stories) kontrak WHAT yang testable bagi Phase 1 Sip & Dip Ownership Dashboard — pengganti Google Sheets sebagai satu sumber kebenaran pencatatan kepemilikan.

**Hasil sapuan menyasar revisi (grep menyeluruh):** kata "link" hanya tersisa di dua titik yang memang diedit (baris 351, 409) dan keduanya kini menegaskan akses tanpa gerbang link; "default" hanya tersisa untuk alokasi FIFO RKAP (baris 181, 212, 438) — tidak ada sisa "default COO"; semua enam kemunculan referral/referal (baris 36, 86, 351, 352, 459, 477) konsisten dengan r22 (diajukan saat Pembelian Pertama). Tidak ditemukan asumsi gerbang link yang tertinggal di §4.8, §6, §7, FR-13/FR-14/FR-15/FR-21, maupun UJ lain. Rujukan UJ-1↔UJ-6 (baris 34↔74) dan FR-22↔§4.8 (baris 348, 357↔382-389) utuh. Yang tersisa bukan sisa asumsi lama, melainkan celah rujukan silang satu arah di sekitar aturan referral — lihat temuan H-1, H-2, M-1.

---

## Temuan

### Critical (0)

Tidak ada. Dokumen konsisten dengan keputusan baru di seluruh titik yang diedit; tidak ada kontradiksi langsung terhadap akses pendaftaran tanpa link referral.

### High (2)

**H-1. Istilah "Pembelian Pertama" — konsep penentu dua saklar besar, tetapi tidak dikunci di Glossary.**
- **Lokasi:** baris 84, 86 (Glossary); 348, 352, 357 (FR-22); 389 (§4.8); 459 (§8); 477 (Lampiran A).
- **Temuan:** §0 (baris 11) menjanjikan "kosakata dikunci di Glossary (§3)", namun "Pembelian Pertama" — dikapital dan ditebalkan sebagai istilah — tidak punya entri Glossary. Istilah ini menentukan dua hal berat: (a) momen wajibnya referral (FR-22:352, Glossary "Referral":86) dan (b) saklar keterbukaan penuh (baris 84, 348, 357, 389). FR-22:352 menyebut "**Pesanan Pembelian pertama**" (level submit pesanan), sedangkan saklar keterbukaan memakai "**transaksi pembelian pertamanya efektif**" (level efektif) — dua momen berbeda yang tak pernah didamaikan. Interaksinya dengan FR-19 (baris 172: pesanan Ditolak/Kedaluwarsa → owner membuat pesanan baru) tidak dituntaskan: apakah pesanan ulang setelah pesanan pertama ditolak tetap wajib menyertakan referral? Pembaca literal bisa menyimpulkan tidak (bukan "pesanan pertama" lagi).
- **Saran:** tambah entri Glossary — "**Pembelian Pertama** — transaksi pembelian efektif pertama seorang owner (via konfirmasi FR-20 maupun input langsung FR-21); momen pengajuan referral (FR-22) dan pembuka keterbukaan penuh (§4.8)". Lalu selaraskan FR-22:352 menjadi "pesanan yang berpotensi menjadi Pembelian Pertama wajib menyertakan referral" agar kasus pesanan ulang eksplisit tercakup. Tag: QUESTION (scaffolding hilang).

**H-2. Jalur input langsung FR-21 tidak menutup aturan referral — pembelian pertama tunai bisa lolos tanpa referral.**
- **Lokasi:** baris 187-192 (FR-21); 352 (FR-22); 111 (Glossary "Pesanan Pembelian"); 40 (varian UJ-1).
- **Temuan:** FR-22:352 memvalidasi keabsahan referral "saat konfirmasi (FR-20)" — momen yang justru dilewati jalur langsung (FR-21: transaksi langsung efektif, tidak melewati Antrian Beli). Glossary baris 111 secara teknis mencakup "dicatat COO via jalur langsung" dalam definisi Pesanan Pembelian, tetapi daftar Consequences FR-21 (kontrak testable bagi workflow turunan) tidak punya satu pun item referral — padahal varian UJ-1 (baris 40) eksplisit menskenariokan pembayaran tunai di cafe via FR-21. Cerita yang diturunkan hanya dari §4.1 berisiko membangun jalur tunai tanpa field referral dan tanpa langkah validasinya.
- **Saran:** tambah satu konsekuensi di FR-21 — "input langsung atas transaksi yang menjadi Pembelian Pertama owner juga mencatat referral (FR-22), keabsahannya divalidasi COO saat input dengan MFA yang sama" — dan ubah klausul FR-22:352 menjadi "divalidasi COO saat konfirmasi (FR-20) maupun input langsung (FR-21)". Tag: MOVE (satu klausul lintas-FR).

### Medium (4)

**M-1. Rujukan satu arah FR-22→FR-20 untuk validasi referral; FR-20 tidak membalas.**
- **Lokasi:** baris 352 (FR-22) ↔ 176-185 (FR-20).
- **Temuan:** FR-20 merinci re-validasi saat konfirmasi — "Strength (FR-1) dan ruang RKAP (FR-23)" — tanpa menyebut referral. FR-22 menugaskan validasi referral ke momen FR-20, tetapi pembaca FR-20 berdiri sendiri tidak tahu tanggung jawab itu ada. Rujukan silang hanya hidup di satu arah.
- **Saran:** di FR-20 (kalimat re-validasi, baris 177), tambahkan "(termasuk keabsahan referral bila pesanan itu merupakan Pembelian Pertama — FR-22)". Tag: QUESTION.

**M-2. §8 tidak mengindeks keputusan baru (override r21) — riwayat keputusan akses pendaftaran tak tertelusur.**
- **Lokasi:** baris 434-460 (§8); entri referral hanya baris 459.
- **Temuan:** §0 (baris 11) menjanjikan riwayat seluruh keputusan di §8. Entri baris 459 ("Field Profile (Lampiran A) + referral saat Pembelian Pertama (FR-22)") hanya mengindeks r22. Keputusan r21-override — cukup material untuk memicu revisi dokumen ini — tidak punya jejak: pembaca §8 tidak tahu bahwa akses tanpa link referral pernah merupakan keputusan yang kemudian dibatalkan.
- **Saran:** tambah satu entri indeks, mis. "Akses halaman pendaftaran tanpa link referral (menggantikan keputusan gerbang link) — FR-22", atau perluas entri baris 459 menjadi "…+ akses pendaftaran tanpa gerbang link (FR-22)". Tag: QUESTION.

**M-3. "Publik umum bukan pengguna" (§2.2) vs "pendaftaran terbuka" (§5/FR-22) — batas jangkauan halaman pendaftaran tak pernah dinyatakan.**
- **Lokasi:** baris 28 (§2.2); 351 (FR-22); 409 (§5).
- **Temuan:** FR-22:351 mendefinisikan apa yang TIDAK disyaratkan ("link referral bukan syarat akses") dan §5:409 menyebut "pendaftaran terbuka tanpa gerbang link", tetapi dokumen tidak pernah menyatakan siapa yang dapat menjangkau halaman pendaftaran: apakah URL publik bagi siapa pun, atau disebar terbatas di kanal komunitas Sip & Dip. Akibatnya §2.2 ("Publik umum — bukan pengguna") dan §5 ("terbuka") tampak saling geser tanpa penengah — padahal keduanya bisa didamaikan dengan satu klausul.
- **Saran:** tambahkan klausul di FR-22 (atau §2.2): "halaman pendaftaran dapat dijangkau [siapa pun yang mengetahui URLnya / via tautan yang disebar di kanal komunitas]; publik umum tetap bukan pengguna dashboard — satu-satunya titik sentuhnya adalah halaman pendaftaran". Tag: QUESTION.

**M-4. NFR presisi perhitungan menumpang di seksi yang salah tematik.**
- **Lokasi:** baris 398-399 (ujung §4.8 "Akses & Keamanan"); baris 445 (§8 merujuk "NFR §4.8").
- **Temuan:** NFR pembulatan half-up 2 desimal tidak berhubungan dengan akses/keamanan; ia lintas-fitur dan berdiri sendiri. Penempatannya di ujung §4.8 membuatnya mudah terlewat, dan §8 mengunci rujukan ke lokasinya sehingga perpindahan harus koordinatif.
- **Saran:** MOVE ke seksi kecil sendiri (mis. "§4.9 NFR lintas-fitur") atau naikkan ke level §4 penutup; perbarui rujukan §8 (baris 445) menyusul pindah. Tag: MOVE.

### Low (5)

**L-1. Persona Dewi UJ-6: detail "mengenal dari owner eksisting" kini tak berpayoff di dalam UJ-6 sendiri.**
- **Lokasi:** baris 71 (persona UJ-6); 74 (climax → UJ-1); 36 (payoff referral ada di UJ-1, persona Bima).
- **Temuan:** Narasi UJ-6 secara keseluruhan tetap koheren: entry state baru (baris 72) konsisten dengan FR-22:351, path–climax–resolution mengalir, dan persona masih berfungsi sebagai latar motivasi. Namun detail "mengenal Sip & Dip dari owner eksisting" dahulu berujung pada langkah referral dalam UJ-6; kini payoff-nya pindah ke UJ-1 dengan persona berbeda (Bima) — jembatan antar-persona ini implisit saja.
- **Saran:** tambah setengah kalimat di Resolution UJ-6 (baris 75): "owner yang memperkenalkannya kelak tercatat sebagai referral saat Pembelian Pertamanya (UJ-1, FR-22)" — atau sederhanakan persona menjadi netral. Tag: QUESTION.

**L-2. Inkonsistensi ejaan lintas-seksi: "eksisting" vs "existing"; typo "pilihan referal"; istilah asing "cross-referral".**
- **Lokasi:** "existing" di baris 36, 200, 352; "eksisting" di baris 71, 358, 361, 366, 415; "pilihan referal" di baris 86; "cross-referral" di baris 86.
- **Temuan:** Dua ejaan untuk konsep yang sama dalam teks normatif (FR-22:352 memakai "existing", FR-22:358 memakai "eksisting" — dalam FR yang sama). Baris 86 menulis "pilihan referal" (seharusnya "referral"; label Form "Referal" yang dikunci di akhir baris itu sudah benar sebagai label) dan memakai "cross-referral" yang tak didefinisikan.
- **Saran:** seragamkan ke "eksisting" (dokumen berbahasa Indonesia; "existing" bukan istilah domain); koreksi "pilihan referral"; ganti "validasi cross-referral" menjadi "aturan saling merujuk". Tag: CONDENSE.

**L-3. Nasib data "Referal" historis 22 owner eksisting saat migrasi tak dinyatakan.**
- **Lokasi:** baris 360-366 (FR-14); 477 (Lampiran A #11).
- **Temuan:** Lampiran A #11 jujur mencatat pergeseran waktu pengisian (Form: saat pendaftaran; sistem: saat Pembelian Pertama), tetapi FR-14 tidak menyatakan ke mana nilai Referal historis dipetakan — pemiliknya sudah melewati pembelian pertamanya, jadi tidak akan pernah mengisi referral di sistem. Konsekuensi "Data pendaftar ikut dimigrasikan sebagai Profile" (baris 365) tidak menjawab ini.
- **Saran:** satu klausul di FR-14: "nilai Referal historis tercatat sebagai referral Pembelian Pertama owner terkait". Tag: QUESTION.

**L-4. §7 tidak punya metrik yang menyentuh pendaftaran mandiri.**
- **Lokasi:** baris 420-432 (§7).
- **Temuan:** FR-22 menggantikan Google Form (proses hidup yang ada), tetapi tak ada SM yang memverifikasi penggantian itu — SM-2 hanya menyentuh Google Sheets. Bukan asumsi link referral; sekadar celah cakupan indeks metrik.
- **Saran:** pertimbangkan satu metrik sekunder, mis. "pendaftaran baru 100% lewat sistem (Google Form berhenti menerima)" — atau biarkan bila memang disengaja (scope §7 memang "metrik sederhana"). Tag: QUESTION.

**L-5. Tidak ada indeks FR→seksi untuk akses acak.**
- **Lokasi:** dokumen keseluruhan; urutan tampil FR: 1, 2, 3, 19, 20, 21, 23, 4, 5, 18, 6, 7, 8, 9, 10, 16, 11, 12, 13, 22, 14, 15, 17.
- **Temuan:** Urutan tampil non-monotonik adalah konsekuensi disengaja konvensi "nomor global stabil" (§0:11) — itu sendiri benar dan dipertahankan. Namun bagi workflow turunan yang melompat langsung ke FR tertentu, tidak ada peta FR→seksi.
- **Saran:** opsional: tabel satu baris-per-FR (nomor → judul → seksi) setelah §0 atau di Lampiran. Tag: PRESERVE (konvensi penomoran) + QUESTION (indeks).

---

## Verifikasi pertanyaan kunci revisi

| Pertanyaan | Hasil | Bukti |
| --- | --- | --- |
| Apakah §4.8, §6, §7, §8, FR-13/14/21, UJ lain masih berasumsi pendaftaran via link referral? | **Tidak** — semua bersih | "link" hanya di baris 351 & 409 (dua titik teredit); matriks §4.8 (382-389), §6.1 (414), §7 (420-432), FR-13 (337-345), FR-14 (360-366) tidak menyebut link/gerbang akses sama sekali |
| Apakah narasi UJ-6 tetap koheren? | **Ya, dengan satu detail kecil menggantung** | Path–climax–resolution mengalir dan konsisten dengan FR-22; detail persona (baris 71) kehilangan payoff lokal — lihat L-1 |
| Apakah rujukan silang FR-22, §4.8, UJ-1↔UJ-6 utuh? | **Ya di dua arah yang diperiksa; satu rujukan satu arah ditemukan** | UJ-1:34 ↔ UJ-6:74 saling merujuk; FR-22:348/357 ↔ §4.8:382-389 konsisten (termasuk daftar Terkunci vs climax UJ-6:74); FR-22→FR-20 tidak dibalas (M-1); FR-21↔FR-22 tidak terhubung (H-2) |
| Apakah sebutan "default COO" benar-benar hilang? | **Ya** | "default" hanya untuk alokasi FIFO RKAP (181, 212, 438); "(termasuk COO)" di baris 352 adalah daftar pilihan referral, bukan nilai bawaan |

## Catatan PRESERVE (secara eksplisit dipertahankan)

- **Pengulangan aturan "owner tanpa saham → halaman personal" di ~8 titik** (baris 16, 84, 348, 356, 369, 374/380, 382-387, 409): tampak bisa dipangkas, tetapi ini dokumen kontrak yang dibaca acak (per-seksi) — tiap pernyataan berlabuh ke keperluan seksinya dan matriks §4.8 tetap satu-satunya detail otoritatif. Reinforcement, bukan redundansi murni. Jangan dipangkas.
- **Konvensi FR bernomor global stabil meski urutan tampil melompat** (§0:11) — kestabilan rujukan lintas-revisi lebih berharga daripada urutan baca sekuen; kompensasinya lihat L-5.
- **Enam kemunculan referral (36, 86, 351, 352, 459, 477)** masing-masing memegang fungsi berbeda (UJ, Glossary, FR, indeks, lampiran) tanpa menduplikasi aturan — satu rumah normatif (FR-22:352), lainnya perujuk. Struktur ini sehat pasca-revisi.

## Ringkasan penutup

- **Total rekomendasi:** 11 (0 critical, 2 high, 4 medium, 5 low) + 3 catatan PRESERVE.
- **Estimasi dampak kata:** +70-90 kata bersih (klausul klarifikasi H-1/H-2/M-1/M-2/M-3) — review ini tidak berorientasi pemangkasan; dokumen kontrak 7.289 kata ini padat tanpa pemborosan struktural yang tersisa dari review sebelumnya (§6.3 sudah ter-merge, §8 sudah menjadi indeks).
- **Trade-off komprehensi:** tidak ada rekomendasi yang mengorbankan keterbacaan; seluruh saran menambah kepresisian rujukan dengan biaya kata minimal.
- **Panjang:** tidak ada target panjang yang ditetapkan pemilik dokumen.
