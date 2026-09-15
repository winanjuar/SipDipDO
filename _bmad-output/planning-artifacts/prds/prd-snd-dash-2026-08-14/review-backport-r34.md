# Review — PRD backport r34 (FR-7, FR-14, §8 index)

- **Artifact:** `prd.md` — Sip & Dip Ownership Dashboard (Phase 1), status final, r34 backport (uncommitted diff vs `0ae282d`)
- **Lenses:** `structure` (Editorial Structure), `prose` (Editorial Prose, ran after structure) — LIGHT, scoped pass
- **Structure model applied:** Strategic/Context (Pyramid) — PRD: MECE scope lists, consistent FR schema, cross-reference integrity, front-loaded rules
- **Reader calibration:** humans (PM, arsitek, workflow turunan)
- **Purpose read:** dokumen ini ada agar PM, arsitek, dan workflow turunan (UX/architecture/epics) punya kontrak WHAT yang dikunci untuk Phase 1 — konsistensi istilah dan rujukan adalah kontraknya.
- **Scope reviewed (strict):** FR-7 statement + consequence baru (§4.3), FR-14 statement + consequence baru (§4.7), 2 entri §8 baru. Edit footprint ± 90 kata dari 7.485 total.
- **Content is sacrosanct:** temuan hanya soal organisasi & ekspresi; keputusan produk tidak dipersoalkan.

**Verdict: PASS-with-fixes** — tidak ada critical; 1 high (ambiguitas terminologi pada kontrak migrasi yang berdampak uang), 3 medium, sisanya low.

---

## Findings

### HIGH-1 — FR-14 consequence: istilah rakitan "ter-finalisasi-belum-tertunaikan" mencampur tiga poros istilah dan membuat set poin yang dimigrasikan ambigu
**Lens:** structure + prose | **Location:** §4.7 FR-14, bullet consequence ke-4 (`prd.md:370`)

Teks: "…sebagai basis Insentif RUPS pertama pasca go-live (FR-16 — basis poin periode ter-finalisasi-belum-tertunaikan); total poin per owner cocok dengan sumber spreadsheet."

PRD memakai dua poros istilah kanonik yang berbeda peristiwa:
- Poros finalisasi/insentif (FR-10, Glossary "Contribution Period", `prd.md:123,287-293`): poin "difinalkan" cut-off, "sudah diberi insentif" vs "belum diberi insentif (carry over)".
- Poros penunaian (Glossary Owner/Keluar, FR-13, FR-16, §4.8, `prd.md:81-82,307,312,347-348,390`): "ditunaikan" = peristiwa pembayaran di RUPS.

Bullet baru (a) memakai "belum ditunaikan" di statement — konsisten dengan poros penunaian; lalu (b) di consequence menciptakan compound "ter-finalisasi-belum-tertunaikan" yang tidak didefinisikan di mana pun, menggabungkan kedua poros dalam satu token. Akibatnya dua pembacaan sama-sama sah:
1. Semua poin historis yang belum pernah ditunaikan ikut migrasi dan otomatis menjadi "ter-finalisasi" (basis Insentif RUPS pertama) — termasuk poin yang menurut model FR-10 seharusnya berstatus carry-over karena belum pernah difinalkan cut-off.
2. Hanya poin yang ekuivalen "sudah difinalkan tapi belum dibayar" yang migrasi sebagai basis — statement ("yang belum ditunaikan") dan consequence (parenthetical) lalu tidak menyebut set yang sama.

FR-16 membatasi basis Insentif ke "poin periode yang telah difinalkan cut-off (FR-10)" (`prd.md:307`) — ambiguitas ini menyentuh nominal uang di RUPS pertama pasca go-live.

**Suggested fix (pilih satu poros dan eksplisitkan aturan finalisasinya; keputusan tetap milik penulis):** ganti parenthetical dengan klausa lugas memakai istilah kanonik, mis. "…(difinalkan sebagai saldo periode Contribution saat go-live — basis Insentif RUPS pertama pasca go-live per FR-16; poin yang telah diberi insentif tidak ikut)". Kalau maksudnya setnya lebih sempit/lebih luas, sebut eksplisit memakai poros FR-10 ("belum pernah diberi insentif") agar statement dan consequence menyebut set yang identik.

### MEDIUM-1 — §6.1 In Scope tidak ikut diperbarui: "migrasi data Sheets + Form" kini understates FR-14
**Lens:** structure (MECE scope list) | **Location:** §6.1 (`prd.md:418`) vs §4.7 FR-14 statement (`prd.md:364`)

FR-14 kini memigrasikan poin Contribution historis sebagai komponen keempat, tapi daftar In Scope masih "… migrasi data Sheets + Form, role)". Daftar scope yang tidak collectively-exhaustive terhadap FR-nya sendiri mengundang turunan workflow (epics/stories) melewatkan workstream migrasi poin.

**Suggested fix:** perbarui parenthetical §6.1, mis. "migrasi data Sheets + Form + poin Contribution historis (FR-14)". Dampak kata: +4 kata.

### MEDIUM-2 — Sumber poin Contribution historis tidak disebut di statement FR-14; consequence menyebut "sumber spreadsheet" padahal Glossary menautkan Contribution ke folder Google Drive
**Lens:** structure (QUESTION) | **Location:** §4.7 FR-14 (`prd.md:364,370`) vs Glossary "Contribution" (`prd.md:122`)

Statement menamai sumber untuk tiga komponen lain (sheet Evidence, Google Sheets, Google Form) tetapi tidak untuk poin Contribution; consequence lalu mengunci verifikasi ke "sumber spreadsheet". Glossary mengatakan Contribution hari ini hidup di "folder Kontribusi di Google Drive". Tidak konflik keras — boleh saja rekap poin memang ada di spreadsheet — tapi kontrak migrasi yang menuntut "total poin per owner cocok dengan sumber" harus menamai sumber otoritatifnya, bukan menyiratkannya.

**Suggested fix:** sebut sumbernya eksplisit di statement, mis. "…serta poin Contribution historis yang belum ditunaikan (rekap spreadsheet / folder Kontribusi di Drive — konfirmasi sumber otoritatif), dimigrasikan…". QUESTION bagi penulis: mana sumber kebenaran untuk angka tersebut?

### MEDIUM-3 — "dipreview di web" / "preview web": drift dari istilah kanonik "pratinjau"
**Lens:** prose (konsistensi istilah; dedup — dua lokasi, satu temuan) | **Location:** §4.3 FR-7 statement (`prd.md:261`) & consequence (`prd.md:266`); §8 entri indeks (`prd.md:466`)

Konvensi istilah PRD (Glossary §3) mengunci bahasa Inggris hanya untuk term metrik; kata "preview" bukan term metrik, dan PRD sudah memakai "pratinjau" untuk konsep yang sama (FR-1 "pratinjau hitungan", UJ-1 — `prd.md:36,140`). "dipreview di web" adalah code-switching informal dan bentuk pasifnya tidak alami.

**Suggested fix:** "dapat dipratinjau di web" (FR-7 statement), "dokumen dapat dipratinjau di web…" (consequence), "unggah PDF dengan pratinjau web" (§8). (Bila "preview" memang ingin dipertahankan sebagai label UI produk, tetapkan itu eksplisit — jangan campur dua-duanya.)

### LOW-1 — "termigrasi" vs "dimigrasikan": bentuk pasif campur dalam satu FR
**Lens:** prose | **Location:** §4.7 FR-14 statement ("dimigrasikan", `prd.md:364`) vs bullet baru ("ikut termigrasi", `prd.md:370`); §8 juga "dimigrasikan" (`prd.md:467`)

**Suggested fix:** satukan ke bentuk dominan dokumen: "ikut dimigrasikan".

### LOW-2 — Entri §8 untuk FR-14 menghilangkan kualifikasi "belum ditunaikan"
**Lens:** structure + prose | **Location:** §8 (`prd.md:467`): "Poin Contribution historis ikut dimigrasikan (FR-14)"

Indeks non-normatif, tapi ringkasan yang mendrop qualifier kunci melapangkan makna (semua poin historis vs hanya yang belum ditunaikan) — tepat pada poin yang sedang dirapikan di HIGH-1.

**Suggested fix:** "Poin Contribution historis yang belum ditunaikan ikut dimigrasikan (FR-14)" (+3 kata).

### LOW-3 — FR-7: aturan keterbukaan menempel hanya pada bullet unggah; MoM hasil tulis-langsung tidak diberi keterbukaan eksplisit
**Lens:** structure | **Location:** §4.3 FR-7 bullet ke-3 (`prd.md:266`)

Matriks §4.8 memang mengunci MoM untuk owner tanpa saham secara seragam, jadi tidak konflik — tetapi penempatannya menyiratkan keterbukaan adalah properti mode unggah, bukan properti MoM. Mode tulis-langsung hanya tercakup implisit.

**Suggested fix:** umumkan bullet menjadi: "Seluruh MoM — tulis langsung maupun unggahan — terlihat sesuai keterbukaan MoM (owner pemegang saham — matriks §4.8); unggah PDF hanya dapat dilakukan COO."

### LOW-4 — FR-7 statement: satu kalimat membawa dua requirement + frasa "dokumen matang dalam PDF"
**Lens:** prose | **Location:** §4.3 FR-7 statement (`prd.md:261`)

Kalimat tunggal dengan parenthetical em-dash bersarang plus klausa trailing ("…— dan MoM yang diunggah dapat dipreview di web.") memuat dua requirement berbeda (penyimpanan dua modus; pratinjau web). "dokumen matang" informal dibanding "final" yang sudah dipakai bullet consequence ("hingga final").

**Suggested fix (Consider):** pecah: "COO dapat menyimpan notulen (MoM) MRO/RUPS melalui dua modus — menulis langsung di sistem (termasuk draft untuk MRO berikutnya) atau mengunggah dokumen final dalam format PDF yang disusun di editor mana pun. MoM yang diunggah dapat dipratinjau di web."

### LOW-5 — FR-14 bullet baru mematahkan paralelisme deretan consequence
**Lens:** prose | **Location:** §4.7 FR-14 bullet ke-4 (`prd.md:370`)

Tiga bullet tetangga kalimat deklaratif pendek; bullet baru ±3× panjangnya dengan parenthetical + titik koma. Sebagian besar hilang sendiri bila HIGH-1 dijawab dengan klausa ringkas; sisanya bisa dipecah: "…; total poin per owner cocok dengan sumber spreadsheet" layak jadi bullet sendiri sejajar dengan "Grand Total hasil migrasi cocok…".

### LOW-6 — "hingga final" tetap tak terdefinisi, dan kini semakin menentukan (QUESTION, pre-existing)
**Lens:** structure | **Location:** §4.3 FR-7 bullet ke-2 (`prd.md:265`)

Dengan mode unggah PDF sebagai jalur alternatif menuju MoM final, transisi "final" (siapa/kapan/memicu apa) kini memuat lebih banyak beban, namun tetap tidak didefinisikan — melemahkan testability bullet tersebut. Pre-existing, bukan hasil backport; dicatat karena edit membuatnya load-bearing.

**Suggested fix (Consider):** satu klausa di FR-7: "MoM final ditetapkan COO dan tidak dapat diubah" — atau minimal pertahankan status quo disengaja.

---

## Clean checks (dilakukan, tanpa temuan)

- **§4.8 matriks konsisten:** FR-7 consequence "(owner pemegang saham — matriks §4.8)" cocok dengan baris Terkunci matriks ("…Contribution; MoM; audit trail…" — `prd.md:391`); owner tanpa saham tidak melihat MoM, terbuka setelah pembelian pertama.
- **Unggah COO-only konsisten** dengan FR-15 dan deskripsi §4.8 (COO "kelola konten").
- **Tidak ada kebocoran detail implementasi:** tidak ada penyebutan storage backend/file storage di teks baru; "dipreview di web" dan "di editor mana pun" adalah perilaku user-facing, sah untuk PRD.
- **§5 Non-Goals tanpa konflik:** "Modul voting MRO terautomasi — v1: MoM + hasil keputusan yang diinput" tetang koheren dengan mode unggah (FR-7 spesifik mengalahkan frasa umum); migrasi poin (FR-14) tidak menyentuh Non-Goal "Pembayaran dividen/insentif otomatis" — hanya basis hitung, eksekusi tetap luar sistem.
- **Tidak ada rujukan menggantung:** "matriks §4.8", "(FR-16)", "(FR-7)", "(FR-14)" semuanya valid.
- **Penempatan konsekuensi benar:** bullet poin FR-14 berada terakhir, mencerminkan posisi komponen keempat di statement; urutan bullet FR-7 (umum → draft → unggah) mencerminkan urutan modus di statement. Testable: klausul "total poin per owner cocok dengan sumber spreadsheet" dan "Unggah PDF MoM hanya dapat dilakukan COO" keduanya terverifikasi.
- **Terminologi "belum ditunaikan" pada FR-14 statement** sendiri sudah selaras dengan pemakaian mayoritas dokumen (Glossary Owner/Keluar, FR-13, FR-16, §4.8) — drift hanya pada parenthetical consequence (HIGH-1) dan indeks §8 (LOW-2).
- **"pasca go-live"** (bullet baru) konsisten dengan §7; inkonsistensi "pasca-migrasi" vs "pasca go-live" adalah pre-existing, di luar scope.

## Ringkasan editorial

Total 10 temuan (1 high, 3 medium, 6 low). Estimasi dampak kata bila semua fix diterima: +10–15 kata netto (perbaikan ini soal presisi, bukan pemangkasan); tidak ada rekomendasi yang mengorbankan kejelasan untuk brevity. Dua temuan (HIGH-1, MEDIUM-2) membutuhkan keputusan penulis soal isi (set poin mana, sumber mana) — sisanya murni editorial dan bisa diterima row-per-row.
