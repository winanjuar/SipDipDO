# Epic 2: Keputusan MRO: Harga, MoM & RKAP

COO mencatat keputusan MRO dalam sistem: harga beli/jual dengan riwayat tertaut MoM, notulen MoM dua modus (tulis langsung + upload PDF dengan preview web), dan RKAP per fase; semua owner termasuk tanpa saham dapat melihat harga & RKAP. Menyiapkan gerbang pembelian untuk Epic 3.

### Story 2.1: MoM MRO/RUPS Tulis Langsung

As a COO,
I want menyimpan notulen MRO/RUPS dari draft hingga final di sistem,
So that keputusan para owner hidup dengan jejak yang jelas — bukan di "ingatan kolektif" atau chat.

**Acceptance Criteria:**

**Given** COO membuka CMS MoM
**When** notulen baru dibuat
**Then** MoM tersimpan dengan tanggal dan status draft, serta dapat diedit hingga final (FR-7)

**Given** MoM berstatus draft selesai disusun
**When** COO memfinalkan
**Then** status berubah final dan peristiwa penfinalan tercatat di audit trail; MoM final tetap terbaca dengan tanggalnya

**Given** pemegang saham membuka daftar MoM
**When** halaman dimuat
**Then** notulen dapat dibaca; owner tanpa saham/Keluar mendapat permukaan terkunci (redirect Halaman Personal + pesan pembuka akses — matriks §4.8, UX-DR14)

**Given** belum ada MoM tersimpan
**When** halaman dibuka
**Then** tampil state kosong "Belum ada MoM tersimpan." (UX-DR19)

**Given** MoM tersimpan
**When** keputusan tertaut dibuat (harga — 2.3, fase RKAP — 2.4)
**Then** relasi keputusan → MoM tersedia sebagai referensi (FR-7)

### Story 2.2: Upload PDF MoM & Preview Web

As a COO,
I want mengunggah MoM yang sudah matang sebagai PDF,
So that notulen yang disusun di text editor mana pun tetap tersimpan dan bisa dipreview owner tanpa diketik ulang.

**Acceptance Criteria:**

**Given** COO membuat atau mengedit MoM
**When** file PDF diunggah
**Then** file tersimpan di Supabase Storage bucket privat (AR-13) dengan metadata tertaut ke MoM dan peristiwa unggah tercatat audit (FR-7)

**Given** pemegang saham membuka MoM yang memiliki PDF
**When** preview dibuka
**Then** PDF tampil di web via URL bertanda tangan berumur pendek — akses hanya untuk role berwenang; akses URL langsung tanpa sesi valid ditolak (AD-8)

**Given** pengguna non-COO (termasuk pemegang saham)
**When** mencoba mengunggah PDF
**Then** ditolak di route handler — kewenangan upload hanya COO (AD-8)

**Given** materi email yang menyertakan logo
**When** varian logo dipilih
**Then** memakai `logo.jpg` (latar putih) sesuai aturan brand (UX-DR3)

### Story 2.3: CMS Harga Saham — Berjalan & Riwayat

As a COO,
I want mengelola harga beli & jual dengan tanggal efektif tertaut MoM,
So that transaksi berikutnya otomatis memakai harga resmi dan riwayat keputusan harga terjaga.

**Acceptance Criteria:**

**Given** COO menetapkan harga baru (nilai, jenis beli/jual, tanggal efektif, referensi MoM)
**When** disimpan
**Then** baris `price_periods` baru tercipta dan pesanan/transaksi berikutnya otomatis memakai harga berjalan (FR-6); penyimpanan tercatat audit

**Given** sudah ada baris untuk kombinasi (jenis harga, tanggal efektif) yang sama
**When** COO menyimpan harga untuk kombinasi itu
**Then** ditolak oleh unique constraint — koreksi harga pada tanggal efektif yang sama berarti mengubah baris berjalan + audit, bukan menambah baris kedua (AD-7)

**Given** owner — termasuk owner tanpa saham — membuka halaman Harga
**When** halaman dimuat
**Then** harga berjalan dan seluruh riwayat (nilai, tanggal efektif, referensi MRO) terlihat (FR-6; matriks §4.8 terbuka)

**Given** API resolusi harga dipanggil dengan tanggal X
**When** "harga berjalan pada tanggal X" diresolve
**Then** hasil selalu tepat SATU baris (AD-7) — kontrak yang dipakai pratinjau dan validasi submit di Epic 3

**Given** nilai harga telah tersnapshot (Harga Terkunci pesanan / harga final ledger)
**When** baris harga dikoreksi
**Then** nilai tersnapshot tidak pernah berubah — Bukti dan re-validasi selalu memakai nilai tersimpan (AD-7)

### Story 2.4: Struktur RKAP: Fase & Capital Item

As a owner,
I want melihat tabel RKAP beserta progress per jenis modal,
So that saya tahu pembelian saham saya memenuhi kebutuhan apa — termasuk saya yang belum memiliki saham.

**Acceptance Criteria:**

**Given** COO membuat fase RKAP baru
**When** disimpan
**Then** fase wajib tertaut MoM; selector fase menawarkan berjalan (default) vs arsip (UX-DR6; FR-23)

**Given** COO menambah Capital Item ke fase
**When** disimpan
**Then** item memiliki nama, jenis modal (Tetap/Bergerak — Modal Operasional tidak masuk RKAP), dan Initial Requirement; nilai Initial dikunci saat MRO menetapkan fase (FR-23)

**Given** tabel RKAP dimuat
**When** ditampilkan
**Then** kolom verbatim: nama, jenis modal, Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held — plus baris agregat per jenis modal (UX-DR6; FR-23); Final Requirement berangkat dari Initial; kolom Fulfillment/Fulfillment Rate/Shortfall bernilai awal (0/kosong) hingga transaksi efektif mengisinya di Epic 3 — kolom dan rumusnya sudah siap

**Given** viewport mobile (<lg)
**When** tabel digulir
**Then** kolom nama sticky kiri dengan scroll horizontal dalam Card (UX-DR6)

**Given** owner tanpa saham membuka RKAP
**When** halaman dimuat
**Then** TERBUKA (matriks §4.8) secara read-only; edit hanya untuk COO (AD-8)

**Given** belum ada fase RKAP
**When** halaman dibuka
**Then** state kosong "Belum ada fase RKAP." dengan COO dapat menambah (UX-DR19)

**Given** fase baru atau item ditambahkan
**When** perubahan disimpan
**Then** tercatat di audit trail (FR-12, FR-23)

### Story 2.5: Penyesuaian RKAP Manual dalam Batas Agregat

As a COO,
I want menyesuaikan Final Requirement dan menambah Capital Item baru dalam batas fase,
So that RKAP tetap hidup mengikuti kenyataan tanpa melanggar kesepakatan MRO.

**Acceptance Criteria:**

**Given** COO menaikkan Final Requirement item eksisting
**When** penyesuaian disimpan
**Then** selisih tercatat sebagai penyesuaian dengan nilai lama → baru di audit trail (FR-23)

**Given** COO menambah Capital Item baru ke fase berjalan
**When** disimpan
**Then** nilai penuh item baru dihitung sebagai penyesuaian dan membuka kembali ruang pembelian jenis modalnya (contoh riil fase 1: Peralatan Lainnya, Modal Bergerak, 0 → 1.664.000) (FR-23)

**Given** penyesuaian (manual apa pun) diajukan
**When** batas agregat divalidasi di dalam transaksi
**Then** akumulasi seluruh penyesuaian fase — otomatis + manual — tidak boleh melebihi (1% × total Initial Requirement fase) + harga beli 1 saham berjalan; pelanggaran → ditolak dengan Alert Penolakan Terhitung berisi rincian batas dan langkah lanjut (FR-23; UX-DR11; AD-2 re-validasi in-tx)

**Given** halaman RKAP tampil
**When** ringkasan dibaca
**Then** Card ringkasan menampilkan batas penyesuaian (1% + 1 saham), tambahan aktual, persentase terpakai, dan Quantity Left (UX-DR6; FR-23)

**Given** penyesuaian akan difinalkan
**When** dialog konfirmasi tampil
**Then** sisa batas penyesuaian terlihat sebelum confirm (UX-DR20) dan hasil tercatat audit

**Given** data fase 1 aktual dipakai sebagai fixture verifikasi
**When** batas dihitung
**Then** total Initial 250.000.000 → batas 2.500.000 (1%) + 52.000 (1 saham); terpakai 2.484.000; sisa Kekurangan 44.744.000 tertutup bulat oleh 861 saham = 44.772.000 dengan overshoot 28.000 tertampung sisa batas 68.000 (FR-23; AR-10)

### Story 2.6: Utilization, Achievement, Held & Rebalancing

As a COO,
I want mencatat realisasi penggunaan modal per Capital Item dan merebalancing saat MRO memutuskan,
So that owner melihat dana terkumpul vs terpakai dan kebutuhan bisa bergeser antar item sejenis dengan jejak.

**Acceptance Criteria:**

**Given** COO menginput Utilization (realisasi di lapangan) per Capital Item
**When** disimpan
**Then** tercatat dengan audit — terpisah dari Fulfillment/pembelian saham (FR-23)

**Given** Utilization dan Fulfillment tersedia
**When** Achievement dan Held ditampilkan
**Then** Achievement = Utilization ÷ Fulfillment (bisa > 100%) dan Held = Fulfillment − Utilization — keduanya derived, bukan kolom tulisan terpisah (FR-23; AD-2 Fulfillment derived dari plotting)

**Given** MRO memutuskan rebalancing
**When** COO merelokasi kebutuhan antar Capital Item
**Then** hanya antar item sejenis (Tetap→Tetap, Bergerak→Bergerak), wajib tertaut MoM, total ruang jenis modal tidak berubah, dan tercatat audit (FR-23)

**Given** relokasi antar jenis modal berbeda dicoba
**When** validasi berjalan
**Then** ditolak sebelum menyimpan

