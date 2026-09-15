# Epic 5: Contribution & Distribusi Laba

COO mendefinisikan item Contribution, mencatat realisasi, dan memicu cut-off dengan carry-over; RUPS: input laba → tiga budget pool + rincian per owner; rekap imutabel dapat dibandingkan antar-RUPS; owner tanpa saham yang insentifnya ditunaikan berubah Keluar. Realisasi UJ-4, UJ-5.

### Story 5.1: Definisi Item Contribution

As a COO,
I want mendefinisikan item Contribution hasil keputusan MRO dengan bobot poin kuantitatif,
So that evaluasi kontribusi owner objektif dan konsisten antar periode.

**Acceptance Criteria:**

**Given** COO membuka ruang kerja Contribution
**When** item baru didefinisikan
**Then** item memiliki nama, deskripsi, poin kuantitatif (angka — bukan penilaian kualitatif bebas), dan periode berlaku; tertaut MoM penetapannya (FR-8)

**Given** pemegang saham membuka halaman Contribution
**When** daftar item dimuat
**Then** item periode aktif terlihat; owner tanpa saham/Keluar mendapat permukaan terkunci (matriks §4.8; UX-DR14)

**Given** belum ada item pada periode berjalan
**When** halaman dibuka
**Then** state kosong "Belum ada item Contribution periode ini." (UX-DR19)

**Given** item dibuat/diubah
**When** disimpan
**Then** tercatat di audit trail (FR-12)

### Story 5.2: Pencatatan Realisasi & Poin Berjalan

As a owner kontributor,
I want poin Contribution saya tercatat dan bisa saya pantau,
So that dasar insentif saya transparan sepanjang periode — angka yang saya lihat identik dengan yang dipakai MRO/RUPS.

**Acceptance Criteria:**

**Given** COO mencatat realisasi Contribution owner pada item terdefinisi
**When** pencatatan disimpan
**Then** tercatat dengan tanggal dan pencatat; masuk audit trail (FR-9)

**Given** owner login membuka halaman Contribution
**When** poin dimuat
**Then** poin Contribution berjalan periode aktif tampil, termasuk saldo carry-over sejak awal periode (FR-9; kesiapan FR-10)

**Given** COO membuka rekap
**When** realisasi dilihat
**Then** rekap per owner tersedia untuk kerja COO (FR-9)

**Given** writer entries menerima tulisan ke periode berstatus final (pasca cut-off)
**When** validasi berjalan
**Then** tulisan DITOLAK — koreksi/backdating hanya masuk periode berikut sebagai penyesuaian carry-over (AD-10)

### Story 5.3: Cut-off Period dengan Carry-over

As a COO,
I want menutup periode Contribution pada tanggal yang ditetapkan RUPS,
So that poin sah terfinalisasi sebagai dasar insentif dan sisanya jelas terbawa ke periode baru.

**Acceptance Criteria:**

**Given** COO memicu aksi "Cut-off Period"
**When** tanggal cut-off diinput
**Then** pratinjau rekap tampil: poin sah tiap owner (Contribution hingga tanggal cut-off) vs poin carry-over — sebelum confirm (FR-10; UX-DR20)

**Given** COO mengonfirmasi cut-off
**When** eksekusi berjalan
**Then** SATU transaksi DB mengikuti urutan lock global (`contribution_periods → distribution`): snapshot poin sah per owner dibekukan **imutabel**, periode berstatus final dan ditandai selesai, seluruh peristiwa masuk audit trail (FR-10; AD-10; AD-2)
**And** penandaan "selesai" (cut-off) TIDAK sama dengan "ditunaikan" — penandaan tertunaikan hanya terjadi saat rekap RUPS (5.5) (AD-10)

**Given** periode baru dimulai
**When** owner membuka Contribution
**Then** saldo carry-over tampil sejak awal (FR-10)

**Given** Contribution sudah diberi insentif pada RUPS sebelumnya
**When** periode baru berjalan
**Then** poin tersebut tidak pernah muncul lagi (FR-10)

### Story 5.4: Rumus Distribusi & Simulasi Tiga Budget Pool

As a COO,
I want mensimulasikan pembagian laba dengan parameter RUPS sebelum disahkan,
So that keputusan RUPS diambil berdasarkan angka yang bisa diperiksa sendiri.

**Acceptance Criteria:**

**Given** rumus distribusi diimplementasikan di `shared/domain`
**When** unit test dijalankan
**Then** lolos dengan contoh verifikasi PRD: laba diaudit 12.000.000 − ditahan 2.000.000 = Laba Dibagikan 10.000.000; ratio 5/41/54 → pool Charity 500.000, Dividen 4.100.000, Insentif 5.400.000; owner dengan poin 50% dan Portion 40% → Insentif 2.700.000 + Dividen 1.640.000 = total hak 4.340.000; Budget pool = ratio × Laba Dibagikan; Dividen owner = Portion × pool Dividen; Insentif owner = (poin ÷ total poin) × pool Insentif (FR-16; AD-6; AR-10)

**Given** COO membuka modul Distribusi Laba
**When** laba diaudit & laba ditahan diinput
**Then** sistem menampilkan Laba Dibagikan (FR-16)

**Given** ratio tiga komponen diatur (parameter RUPS; patokan MRO terakhir 5/41/54)
**When** simulasi dihitung
**Then** validasi ratio berjumlah 100% sebelum hitung; hasil: tiga budget pool + rincian per owner (Dividen + Insentif + total hak); Charity bukan bagian owner — pool utuh untuk amal (FR-16; EXPERIENCE Flow 5)

**Given** basis poin Insentif dihitung
**When** simulasi berjalan
**Then** basis = poin dari SEMUA periode ter-finalisasi-belum-tertunaikan (AD-10)

**Given** belum ada periode yang ter-finalkan cut-off
**When** simulasi dibuka
**Then** peringatan tampil dengan tautan ke alur cut-off (EXPERIENCE Flow 5 failure path)

### Story 5.5: Rekap RUPS, Flip Keluar & Perbandingan Antar-RUPS

As a owner,
I want rekap distribusi laba tersimpan imutabel dan bisa dibandingkan antar-RUPS,
So that pembagian laba auditable dan adil lintas waktu.

**Acceptance Criteria:**

**Given** simulasi disetujui RUPS
**When** COO menyimpan rekap
**Then** snapshot imutabel tersimpan dari seluruh angka yang dipakai (Portion, poin, ratio, pool, rincian per owner) tertaut RUPS/MoM + audit; penandaan poin "tertunaikan" terjadi atomik dalam transaksi penyimpanan rekap yang sama (FR-16; AD-10)

**Given** owner tanpa saham menerima bagian Insentif pada rekap
**When** rekap disimpan
**Then** status owner berubah `keluar`: kandidat = seluruh owner dengan `positions.shares = 0` pada transaksi rekap (dengan atau tanpa insentif ditunaikan); re-validasi `shares = 0` in-tx mengikuti urutan lock global; transisi via CAS + audit (AD-11; FR-16; FR-13)
**And** setelah flip, akses owner tersebut menyusut ke Halaman Personal pada login berikutnya (EXPERIENCE Flow 5)

**Given** pembagian pool menghasilkan sisa pembulatan per-owner
**When** rekap disusun
**Then** sisa tercatat sebagai baris penyesuaian di rekap (AD-10)

**Given** rekap dilihat owner
**When** keterbukaan dievaluasi
**Then** pemegang saham melihat; owner tanpa saham hanya selama masih memiliki poin Contribution belum ditunaikan (FR-16; §4.8)

**Given** rekap tersimpan lebih dari satu
**When** rekap terakhir dibuka
**Then** perbandingan dengan rekap RUPS sebelumnya tersedia (FR-16)
**And** rekap pertama: blok perbandingan disembunyikan + catatan "Belum ada rekap sebelumnya — perbandingan muncul setelah rekap kedua tersimpan." (UX-DR19)

