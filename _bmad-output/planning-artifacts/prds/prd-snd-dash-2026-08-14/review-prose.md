# Review Prosa — PRD Sip & Dip Ownership Dashboard (Phase 1)

- **Berkas:** `/Users/sugengwin/Developer/snd-dash/_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md`
- **Lensa:** prose (saja — tanpa temuan struktur pendahulu)
- **Tanggal review:** 2026-09-15
- **Panjang dokumen:** 7.289 kata (metrik `word_metrics.py`)
- **Pembaca kalibrasi:** manusia (PM, arsitek, penyusun workflow turunan)

**Bacaan satu kalimat:** dokumen ini ada untuk membantu PM, arsitek, dan workflow turunan (UX, architecture, epics & stories) membangun dashboard kepemilikan Phase 1 sebagai kontrak WHAT yang bisa langsung diturunkan tanpa keputusan tambahan.

## Gaya dokumen yang dipertahankan

Editor mencatat pilihan stilistik disengaja yang tidak disentuh oleh temuan mana pun: kalimat pendek deklaratif; rujukan silang dalam kurung `(FR-x, §x.x)`; nama status berkaptial (`Terverifikasi`, `Diajukan`, `Ditolak`, `Keluar`, `Menunggu Konfirmasi`); istilah metrik berbahasa Inggris dipakai verbatim (Quantity, Shares, Ceil, Strength, Portion); metafora hidup yang konsisten (gerbang, antrian, pintu, "Google Form pensiun", harga yang "hidup di ingatan kolektif"); label struktur bahasa Inggris pada UJ (Entry state, Path, Climax, Resolution). Semua usulan di bawah memperkuat konsistensi pola itu, bukan menggantinya.

## Hasil pemeriksaan pertanyaan kunci revisi

| Pertanyaan | Hasil |
|---|---|
| Frasa "default COO" tertinggal? | **Bersih.** Pemindaian seluruh dokumen hanya menemukan "default berurutan/FIFO" (baris 181), "Default alokasi berurutan (FIFO)" (baris 212), dan "default FIFO" (baris 438) — semuanya soal default alokasi RKAP, bukan frasa yang dihapus. Tidak perlu disentuh. |
| "link referral" vs "link referal"? | Benar di satu-satunya titik pemakaian (baris 351). Tidak ada "link referal" di dokumen. |
| "Referal" hanya di Lampiran A? | **Hampir.** Label form "Referal" di baris 477 memang dibenarkan (dan dikecualikan oleh Glossary baris 86 sendiri), tetapi ada satu pelanggaran di Glossary — lihat temuan H-1. |
| "halaman pendaftaran" vs "web"? | Konsisten. "Halaman pendaftaran" dipakai di dua titik tepat (baris 72, 351); "web app" (baris 51, 58) konteksnya menu COO — tidak bertabrakan. |
| "mendaftar secara mandiri" (isi FR-22) vs judul "Pendaftaran owner mandiri" — redundan? | **Tepat, bukan redundan.** Pola judul-nomina → kalimat-kemampuan ("dapat + verba") dipakai semua FR (FR-13, FR-19, FR-21); kalimat isi menegaskan kemampuan aktor, judul menamai fitur. Biarkan. |
| Kalimat baru terasa alami? | Ya untuk baris 72 (sepadan pola Entry state), 348 (sejajar pola FR), dan 351 — bahkan model kejernihan (dua klausa pendek, em dash menjelaskan). Satu-satunya yang mengganjal ada di §5 Non-Goals — lihat temuan M-4. |

## Temuan

### Critical

Tidak ada. Prosa dokumen, termasuk seluruh titik yang baru diedit, tidak memuat kekeliruan yang mengaburkan makna kontrak secara keseluruhan.

### High

| # | Baris | Teks saat ini | Usulan | Alasan |
|---|---|---|---|---|
| H-1 | 86 | `pilihan referal dan validasi cross-referral diatur di FR-22` | `pilihan referral dan validasi cross-referral diatur di FR-22` | Ejaan kanonik istilah adalah **Referral** (judul entri itu sendiri) dan "referral" (baris 36, 351, 352, 459); "Referal" dibenarkan hanya sebagai label field Google Form (Lampiran A). Glossary adalah kamus yang oleh §3 "wajib dipakai verbatim" oleh workflow turunan — ejaan menyimpang di sumber akan menular ke semua artefak turunan. |

### Medium

| # | Baris | Teks saat ini | Usulan | Alasan |
|---|---|---|---|---|
| M-1 | 16, 348, 380 (dan pembanding 84, 382) | `(terverifikasi, belum membeli)` (16); `(Terverifikasi, belum bertransaksi)` (348, 380) | Seragamkan ke `(Terverifikasi, belum pernah membeli)` — bentuk yang sudah dipakai di baris 84 dan di matriks keterbukaan (382); baris 16 sekaligus berkaptial. | Frasa status ini adalah kunci matriks keterbukaan; tiga varian untuk satu konsep melemahkan sifat kontraknya. "Terverifikasi" huruf kecil di baris 16 juga tidak sejajar dengan nama status berkaptial (baris 354: "Diajukan, Terverifikasi, Ditolak"). |
| M-2 | 36, 200, 352 | `owner existing` (36, 352); `item existing` (200) | `owner eksisting`; `item eksisting` | Dokumen terbagi dua ejaan: "eksisting" (71, 358, 361, 366, 415 — bentuk baku, mayoritas) vs "existing" (36, 200, 352). Satu istilah, satu ejaan. |
| M-3 | 355 | `Pendaftaran yang tidak kunjung dilengkapi Profile-nya mendapat email pengingat dan kedaluwarsa otomatis (jangka waktu final ditentukan saat tahap UX).` | `Pendaftar yang tidak kunjung melengkapi Profile-nya menerima email pengingat; pendaftarannya kedaluwarsa otomatis (jangka waktu final ditentukan saat tahap UX).` | Aktor keliru: yang menerima email dan tidak kunjung melengkapi adalah pendaftar (orang), yang kedaluwarsa adalah pendaftarannya. Konsekuensi testable perlu subjek presisi; nomina "pendaftar" sudah mapan (baris 76, 353). |
| M-4 | 409 | `pendaftaran terbuka tanpa gerbang link, namun transparansi penuh hanya antar owner pemegang saham.` | `pendaftaran terbuka tanpa link referral, namun transparansi penuh hanya antar owner pemegang saham.` | "Gerbang link" eliptis (link apa?) dan tidak selaras dengan redaksi FR-22 (351). Di dokumen, "gerbang" menunjuk mekanisme validasi bernama (Gerbang RKAP, Gerbang Strength, §4.1) — "gerbang link" terkesan seperti fitur gerbang ketiga. Usulan alternatif bila metafora gerbang ingin dipertahankan: `tanpa gerbang link referral`. |
| M-5 | 74 (pemakaian pertama), 259 (definisi) | `MoM` dipakai 15+ kali sejak UJ-6 tanpa entri Glossary; baru didefinisikan implisit di FR-7: `notulen (MoM) MRO/RUPS` | Pertimbangkan menambah entri Glossary: `MoM — notulen meeting (Minutes of Meeting) MRO/RUPS; pencatatan di FR-7.` | §3 menyatakan kosakata dikunci di Glossary dan workflow turunan wajib verbatim; istilah yang dipakai sejak baris 74 namun baru dijelaskan di baris 259 meninggalkan celah bagi pembaca baru dan artefak turunan. |

### Low

| # | Baris | Teks saat ini | Usulan | Alasan |
|---|---|---|---|---|
| L-1 | 44, 72 (pembanding 35) | `dari browser HP` | `di browser HP` | UJ-1 memakai "di browser HP", UJ-2 dan UJ-6 "dari browser HP". "Membuka halaman di browser" lebih alami daripada "dari browser" (bandingkan: "dari HP", "dari rumah" — alami untuk sumber, bukan lokasi tindakan). Pertimbangkan; kanonisasi ke "di". |
| L-2 | 34 (pembanding 333) | `calon owner hasil Pendaftaran mandiri UJ-6` | `calon owner hasil Pendaftaran Owner mandiri (UJ-6)` | Agar verbatim terhadap entri Glossary "Pendaftaran Owner"; "UJ-6" dalam kurung agar tidak menempel pada frasa istilah. Varian di baris 333 ("Pendaftaran mandiri oleh calon owner") dapat dibiarkan — strukturnya paralel dengan klausa tetangga. |
| L-3 | 84, 348, 357, 389, 459 (pembanding 86, 352, 477) | `pembelian pertama` vs `**Pembelian Pertama**` | Pertimbangkan konsistensikan ke `Pembelian Pertama` (kaptial, tanpa perlu bolt di luar Glossary/FR-22) setiap kali merujuk momen keputusan MRO ini. | Momen yang sama ditulis dua cara. Kaptial konsisten menandainya sebagai istilah kontrak, sejajar nama status. Bolt di 86 dan 352 cukup sebagai penekanan perkenalan. |
| L-4 | 358 (pembanding 439) | `dicocokkan lewat email saat migrasi` | `dicocokkan via email saat migrasi` | Seluruh dokumen memakai "via email" (baris 37, 123, 125, 160, 312, 317, 414, 449, 455) — termasuk versi ringkas kalimat yang sama di indeks asumsi (439). Satu-satunya "lewat email" adalah baris ini. |
| L-5 | 477 | `Di Google Form diisi saat pendaftaran; di sistem diajukan saat Pembelian Pertama (FR-22)` | `Diisi saat pendaftaran di Google Form; di sistem diajukan saat Pembelian Pertama (FR-22)` | Inversi "Di Google Form diisi" kaku dan tidak sejajar dengan klausa kedua yang berpola subjek-di-depan. Usulan menyejajarkan keduanya sebagai kalimat pasif tanpa objek tergantung di depan. |
| L-6 | 386 | `agar dapat menentukan pembelian sahamnya untuk kebutuhan apa` | `agar tahu pembeliannya memenuhi kebutuhan apa` | "Menentukan ... untuk kebutuhan apa" janggal (menentukan mengarahkan pilihan, bukan pertanyaan). Pertimbangkan; makna aslinya tetap tertangkap. |

## Titik yang diperiksa dan dibiarkan

- **Baris 85 (Glossary "Pendaftaran Owner")** — pengulangan "registrasi" ("proses registrasi mandiri ... : registrasi → ...") adalah pola definisi-lalu-langkah; langkah bernama "registrasi" konsisten dengan baris 351 dan 353. Dibiarkan.
- **Baris 352** — "saham perdananya" dan baris 256 "pembelian perdana" adalah variasi wajar naratif, bukan istilah kontrak; tidak digabungkan ke L-3.
- **Baris 28 (§2.2)** — kalimat penunjuk "Aturan pendaftaran dan keterbukaan: FR-22 dan §4.8." sejalan dengan gaya penunjuk padat dokumen; rujukan FR-22 sudah menjernihkan hubungan "dashboard internal" vs halaman pendaftaran yang terbuka. Dibiarkan.
- **Baris 75** — "transparansi penuh menunggu Dewi jadi pemegang saham" personifikasi khas suara dokumen; konsisten dengan "Google Form pensiun". Dibiarkan.

## Ringkasan

12 rekomendasi: 1 high, 5 medium, 6 low; lapisan critical kosong (valid — bukan paksaan temuan). Seluruh usulan adalah penggantian frasa 1–5 kata atau penyesuaian kaptitalisasi/ejaan; dampak kata bersih mendekati nol (hanya M-3 dan M-5 menambah beberapa kata). Tidak ada rekomendasi yang memotong elemen pembantu pemahaman; tidak ada yang menyentuh konten atau pilihan stilistik dokumen.
