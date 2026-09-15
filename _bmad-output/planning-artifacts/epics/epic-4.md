# Epic 4: Dashboard Kepemilikan & Transparansi

Owner pemegang saham melihat tabel kepemilikan per owner dan tiga chart paritas spreadsheet yang selalu sinkron satu sumber kebenaran; owner baru muncul otomatis; ketuk wedge chart ↔ sorot baris tabel (UJ-2). Dibangun di atas proyeksi LEDGER yang terisi transaksi efektif Epic 3.

### Story 4.1: Tabel Kepemilikan Per Owner

As a owner pemegang saham,
I want melihat tabel kepemilikan seluruh owner dengan angka yang bisa saya periksa sendiri,
So that saya percaya pada satu sumber kebenaran tanpa membuka spreadsheet.

**Acceptance Criteria:**

**Given** owner pemegang saham membuka Dashboard (landing default role-nya)
**When** tabel dimuat
**Then** kolom verbatim: Owner, Quantity, Shares, Portion, Ceil, Strength, Actual, RTL; urut default Portion menurun; baris Grand Total di akhir mencakup seluruh owner aktif (FR-4; UX-DR5)
**And** baris owner sendiri disorot dengan penanda "Anda"; seluruh angka rata kanan `tabular-nums`; Portion 2 desimal; RTL 0 diberi keterangan "Strength optimal"

**Given** total Portion hasil pembulatan ≠ 100% (mis. 99,99% / 100,01%)
**When** Grand Total ditampilkan
**Then** ditampilkan apa adanya + catatan kaki "total pembulatan 2 desimal (half-up)" — tidak dipaksa "100%" (NFR-1; UX-DR19)

**Given** owner baru menyelesaikan transaksi pertamanya efektif (via Epic 3)
**When** dashboard dimuat ulang
**Then** baris owner baru muncul otomatis tanpa intervensi manual (FR-4)

**Given** viewport mobile (<lg)
**When** tabel ditampilkan
**Then** scroll horizontal dalam Card dengan kolom Owner sticky kiri (bukan card-stack); desktop (≥lg): 8 kolom penuh sampai `max-w-7xl` (UX-DR5; NFR-6)

**Given** dashboard merender data
**When** payload dikonsumsi
**Then** tabel dan chart memakai SATU payload bersama (SSR-embedded atau satu fetch) — tidak ada fetch domain independen per island pada render awal (AD-12)
**And** cold load: Skeleton menyerap layout lalu render serentak; gagal muat: "Tidak dapat memuat data." + Coba lagi; kosong pra-migrasi: "Belum ada data kepemilikan." (UX-DR19)

**Given** owner tanpa saham/Keluar mengakses dashboard
**When** middleware mengevaluasi
**Then** terkunci — redirect Halaman Personal + pesan pembuka akses (FR-15; UX-DR14)

### Story 4.2: Chart Pie "Portion Kepemilikan"

As a owner,
I want melihat komposisi Portion dalam pie berlabel jelas,
So that saya langsung melihat siapa memegang berapa persen.

**Acceptance Criteria:**

**Given** dashboard dimuat
**When** pie dirender
**Then** proporsi Portion tiap owner tampil dengan label nama owner + persentase di luar wedge; wedge dipisah garis 1px background (FR-18.1; UX-DR7)

**Given** wedge ber-Portion ≥ 3%
**When** label ditempatkan
**Then** berlabel langsung; wedge di bawah 3% masuk legenda berurutan + tooltip — tidak ada owner yang hilang labelnya saat pertumbuhan 25 → ~40 owner (UX-DR7)

**Given** wedge diketuk/diklik
**When** interaksi berjalan
**Then** baris owner di tabel tersorot — dan sebaliknya, sorot baris tabel menyorot wedge (dua arah) (UX-DR7)

**Given** warna owner ditetapkan
**When** chart dirender ulang atau owner bertambah
**Then** identitas warna konsisten antar chart dengan assignment deterministik mengikuti urutan tabel; di atas 10 owner palet diperluas langkah lightness tetap dari hue sama (UX-DR2, UX-DR7)

**Given** transaksi baru efektif
**When** dashboard dimuat
**Then** pie sinkron dengan tabel dan owner baru otomatis muncul — satu sumber kebenaran (FR-5)

### Story 4.3: Chart Donut "Distribusi Pemodalan"

As a owner,
I want melihat distribusi pemodalan per jenis modal dan per owner dalam satu chart,
So that struktur modal cafe terbaca dalam satu pandang.

**Acceptance Criteria:**

**Given** dashboard dimuat
**When** donut dirender
**Then** dua cincin: cincin dalam 3 segmen jenis modal (Modal Tetap/Bergerak/Operasional) monokrom slate; cincin luar per owner dengan identitas warna sama seperti pie (FR-18.2; UX-DR8)

**Given** donut ditampilkan
**When** legenda dan tooltip digunakan
**Then** legenda jenis modal selalu tampil; tooltip dua tingkat (owner → rincian per jenis modal); urutan owner sama dengan pie (UX-DR8)
**And** makna tidak pernah disandikan warna semata (WCAG 1.4.1; UX-DR17)

**Given** data kepemilikan berubah
**When** chart dimuat ulang
**Then** donut sinkron dengan tabel dan pie melalui SATU payload bersama; owner baru otomatis muncul (AD-12; FR-5)

### Story 4.4: Chart Stacked Bar "Big Cap"

As a owner,
I want melihat Shares vs Ceil per kelompok kap,
So that terlihat siapa sudah mengisi ruang Ceil-nya dan siapa masih membukanya.

**Acceptance Criteria:**

**Given** dashboard dimuat
**When** stacked bar dirender
**Then** bar bertumpuk per kelompok kap: Big Cap > 5%, agregat `[Medium Cap]` > 2%, agregat `[Small Cap]` ≤ 2%; seri Shares (isi, `chart-1`) vs Ceil (wadah, `bigcap-ceil`); pemisah segmen 1px background (FR-18.3; UX-DR9)

**Given** ambang kelompok kap dipakai
**When** kelompok dihitung
**Then** ambang = data konfigurasi COO (pernah berubah dari 7%) — bukan konstanta kode (FR-18; konvensi Data & format)

**Given** Portion owner berubah (transaksi efektif)
**When** chart dihitung ulang
**Then** kelompok Big/Medium/Small Cap dihitung ulang otomatis dari Portion terkini; nilai dibawa juga label sumbu (FR-18; UX-DR9)

**Given** chart dirender
**When** sinkronisasi dicek
**Then** memakai SATU payload bersama dengan tabel dan chart lain — selalu konsisten (AD-12)

### Story 4.5: Kesegaran Runtime & Sinkronisasi Lintas Permukaan

As a owner,
I want angka dashboard selalu mutakhir atau berpenanda jelas kapan diambil,
So that saya tidak pernah berdiskusi memakai angka basi.

**Acceptance Criteria:**

**Given** permukaan bernilai domain (dashboard)
**When** kontrak kesegaran diimplementasikan
**Then** salah satu terpenuhi: (a) refetch penuh pada `visibilitychange`/focus, atau (b) penanda waktu data ("per …") yang diperbarui bersama payload (AD-12)

**Given** halaman dashboard dirender pertama kali
**When** data dikonsumsi komponen
**Then** tabel dan seluruh island memakai SATU payload bersama (SSR-embedded atau satu fetch) — tidak ada fetch domain independen per island (AD-12)

**Given** transaksi baru menjadi efektif lewat Epic 3
**When** dashboard dibuka kembali
**Then** seluruh angka tabel + ketiga chart konsisten satu sama lain — verifikasi silang tanpa selisih (FR-4, FR-5, FR-18; SM-1)

**Given** data gagal dimuat atau usang
**When** permukaan dirender
**Then** tidak pernah menampilkan angka basi secara diam-diam — skeleton/state gagal + Coba lagi sesuai UX-DR19

**Given** dokumen SSR dan API domain disajikan
**When** header respons diperiksa
**Then** `Cache-Control: no-store` terjaga untuk dokumen dan `/api/**` (AD-12)

