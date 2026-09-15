# Epic 1: Pendaftaran Owner & Fondasi Akses

Calon owner dapat mendaftar mandiri dengan akun Google, melengkapi Profile 11 field (Lampiran A), dan diverifikasi COO hingga halaman personal terbuka (UJ-6); COO mengelola data owner & pergantian COO, dan melihat audit trail; role tiga tingkat + matriks keterbukaan ditegakkan di batas server. Termasuk fondasi platform: scaffold, email outbox, cron, dan PWA installable.

### Story 1.1: Scaffold Platform Nuxt 4

As a developer,
I want fondasi aplikasi sesuai Structural Seed dengan pin stack terverifikasi,
So that seluruh story berikutnya dibangun di atas substrat yang sudah diuji sesuai arsitektur.

**Acceptance Criteria:**

**Given** repo belum memiliki kode aplikasi
**When** scaffold Nuxt 4 dijalankan sesuai Structural Seed
**Then** struktur direktori tercipta: `app/` (pages, components/islands, composables), `server/api`, `server/domain/` berisi 10 modul (identity, orders, ledger, rkap, pricing, contribution, distribution, proofs, audit, migration) masing-masing berbentuk seragam (`index.ts` satu pintu impor, `*.service.ts`, `*.repo.ts`, `events.ts` opsional), `server/jobs`, `shared/domain` tanpa I/O, `drizzle/`
**And** pin terpasang eksak: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `postgres.js` 3.4.9, Node 24 LTS dengan `engines >=22.19.0`; dist-tag Drizzle 1.0 dicek — bila GA, ambil dan ulangi smoke migrasi (AR-2)

**Given** NuxtAuth 1.3.1 terpasang
**When** smoke-test OAuth Google + session dijalankan di Nuxt 4
**Then** login Google dan session bekerja
**And** bila gagal, fallback (`nuxt-auth-utils` / OAuth manual) dijalankan dan keputusannya tercatat — tetap memenuhi AD-8

**Given** `@vite-pwa/nuxt` 1.1.1 terpasang
**When** smoke-test BUILD (generateSW) + install + prompt pembaruan dijalankan di Nuxt 4.5
**Then** PWA installable dengan cangkang sesuai AD-12: cache hanya aset ter-fingerprint + manifest + ikon + `/offline`; dokumen SSR & `/api/**` `no-store`
**And** bila gagal, fallback `vite-plugin-pwa` langsung / SW kustom direviu terhadap AD-12 (AR-3)

**Given** shadcn-vue (primitif reka-ui) + Tailwind dipasang
**When** smoke-test paritas komponen kontrak dijalankan
**Then** Dialog, Sheet, Tooltip, Drawer, Input-OTP, Toast berfungsi di Nuxt 4
**And** keputusan library chart (condong ECharts) dan decimal library (AR-12) dipin dan dicatat dengan alasan; delta brand tokens UX-DR2 terpasang light-only tanpa pasangan dark

**Given** lingkungan lokal via Supabase CLI (Docker) dan produksi Vercel + Supabase PG 17 via pooler
**When** konfigurasi env diselesaikan
**Then** hanya ada lingkungan `local` + `production`; infrastruktur email outbox (baris in-tx, kirim async + retry) + Resend dengan SPF/DKIM & From-domain siap dipakai story berikutnya (AR-6)

### Story 1.2: Autentikasi Akun Google & Halaman Login

As a calon owner / owner / COO,
I want masuk ke sistem dengan akun Google,
So that saya tidak perlu menghafal password baru dan identitas email tunggal terjamin.

**Acceptance Criteria:**

**Given** pengunjung belum terautentikasi membuka URL aplikasi
**When** halaman Login tampil
**Then** lockup logo 80px terpusat + tagline *"Sip the taste, dip the soul"* tampil (UX-DR3, UX-DR15) dengan satu CTA login Google

**Given** akun Google belum terhubung ke owner/pendaftar mana pun
**When** login dicoba
**Then** pesan arahan tampil: "Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. Owner eksisting: hubungi COO untuk pencocokan email migrasi." (UX-DR15)

**Given** login berhasil
**When** redirect landing dieksekusi
**Then** tujuan mengikuti role: pemegang saham → Dashboard, owner tanpa saham/Keluar → Halaman Personal, COO → Antrian Beli (UX-DR14; untuk Epic 1 halaman tujuan cukup kerangka + state kosong sesuai UX-DR19)
**And** seluruh pengecekan role dilakukan di middleware server + route handler, tidak pernah di klien saja (AD-8)

**Given** sesi berakhir
**When** pengguna mengakses halaman terproteksi
**Then** dialihkan ke halaman Login

### Story 1.3: Audit Trail — Pencatatan & Tampilan COO

As a COO,
I want semua aksi tercatat permanen dengan aktor, waktu, dan detail,
So that akuntabilitas setiap keputusan bisa diperiksa kapan pun dan tidak bisa diubah siapa pun.

**Acceptance Criteria:**

**Given** modul AUDIT dengan tabel `audit_logs` dibuat via migrasi Drizzle
**When** skema dan grants diterapkan
**Then** tidak ada jalur UPDATE/DELETE pada `audit_logs` (AD-3) dan setiap entry ditulis dalam transaksi DB yang sama dengan aksinya — tidak pernah async

**Given** service domain melakukan aksi yang wajib diaudit
**When** helper audit modul dipanggil
**Then** entry berbentuk envelope `{ actor, action, target, details jsonb }`; nama action berasal dari registry enum terpusat; aktor berupa `user` (owner/COO) atau `system` (cron) (AD-3)
**And** modul lain menulis audit hanya lewat API publik modul audit (`index.ts`), tidak pernah menulis tabel tetangga (AD-5)

**Given** COO membuka halaman Audit Trail
**When** log dimuat
**Then** daftar aksi (aktor, waktu, detail) tampil hanya untuk COO; non-COO yang mengakses URL langsung dialihkan (FR-12)

### Story 1.4: Pendaftaran Owner Mandiri & Status

As a calon owner,
I want mendaftar menjadi owner dengan akun Google dari halaman publik,
So that saya bisa memulai kepemilikan tanpa Google Form dan tanpa bergantung pada orang lain.

**Acceptance Criteria:**

**Given** halaman pendaftaran diakses via link publik
**When** calon owner mendaftar dengan akun Google
**Then** baris owner dibuat dengan status `diajukan` (enum AD-11) dan pendaftaran tercatat di audit trail (FR-22)
**And** field referral TIDAK diminta saat pendaftaran — referral diajukan saat Pembelian Pertama (FR-22; Glossary)

**Given** pendaftar login setelah mendaftar
**When** status pendaftarannya dilihat
**Then** tampil salah satu status Diajukan / Terverifikasi / Ditolak (+ alasan) memakai Status Badge (UX-DR4: Diajukan `warn`, Terverifikasi `success`, Ditolak `destructive`) dengan perubahan status diumumkan `aria-live="polite"`

**Given** email yang sudah terdaftar sebagai owner
**When** pendaftaran dengan email yang sama dicoba
**Then** tidak ada baris owner duplikat (unique constraint per email — AD-11)

### Story 1.5: Kelengkapan Profile 11 Field

As a pendaftar,
I want mengisi 11 field Profile dengan indikator langkah yang persis,
So that saya tahu persis apa yang belum lengkap dan pendaftaran saya bisa diverifikasi.

**Acceptance Criteria:**

**Given** pendaftar berstatus `diajukan` login
**When** membuka Kelengkapan Profile
**Then** 11 field Lampiran A tampil (Nama Lengkap, Alias, Gmail, Nomor HP, Kontak Darurat, Nomor HP Kontak Darurat, Hubungan dengan Owner, Nama Bank, Pemilik Rekening, Nomor Rekening) dengan indikator langkah persis yang belum lengkap (UX-DR16), tanpa navigasi lain (UX-DR14)

**Given** Profile belum lengkap mendekati hari ke-7 sejak pendaftaran (kalender-hari zona Asia/Jakarta)
**When** cron harian terproteksi CRON_SECRET berjalan
**Then** email pengingat terkirim pada H-3 via outbox (AR-6), lalu pada hari ke-7 status berubah `kedaluwarsa` via compare-and-set + entry audit (AD-11; FR-22)

**Given** pendaftar berstatus `kedaluwarsa`
**When** mendaftar ulang dengan email yang sama
**Then** transisi `kedaluwarsa → diajukan` terjadi pada baris owner yang sama via CAS (bukan baris baru) dan tercatat audit (AD-11)

**Given** submit form gagal karena gangguan non-validasi
**When** pendaftar mencoba lagi
**Then** isian dipertahankan + toast "Tidak dapat menyimpan — coba lagi." (UX-DR19)

### Story 1.6: Verifikasi & Penolakan Pendaftar oleh COO

As a COO,
I want memverifikasi pendaftar yang Profile-nya sudah lengkap,
So that akun owner aktif tanpa satu pun entri manual dari saya.

**Acceptance Criteria:**

**Given** COO membuka daftar pendaftar
**When** pendaftar dengan Profile belum lengkap dilihat
**Then** aksi verifikasi tidak tersedia (gerbang kelengkapan — edge UJ-6)

**Given** pendaftar dengan Profile lengkap
**When** COO memverifikasi
**Then** status berubah `diajukan → terverifikasi` via compare-and-set dalam SATU transaksi DB + entry audit; modul lain diaudit in-tx (AD-11, AD-3)
**And** bila cron kedaluwarsa berjalan hampir bersamaan, hanya satu penulis yang berhasil (race dijaga CAS yang sama)

**Given** COO menolak pendaftar
**When** alasan (wajib) diisi dan disimpan
**Then** status `ditolak` + alasan tampil apa adanya kepada pendaftar + tercatat audit (UX-DR20, UX-DR21)

**Given** owner baru berstatus `terverifikasi` tanpa saham
**When** login
**Then** landing di Halaman Personal (cakupan akses terbatas — FR-15)

### Story 1.7: Role, Matriks Keterbukaan & Navigasi

As a owner tanpa saham,
I want hanya melihat informasi yang menjadi hak saya,
So that transparansi antar owner terjaga sampai Pembelian Pertama saya efektif.

**Acceptance Criteria:**

**Given** owner tanpa saham (terverifikasi, belum pernah membeli; berlaku juga bagi Keluar) mengakses URL permukaan terkunci secara langsung
**When** middleware server mengevaluasi request
**Then** ditolak di batas server dan dialihkan ke Halaman Personal dengan pesan "Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif." (UX-DR14; AD-8) — bukan sekadar disembunyikan di UI

**Given** predikat akses/keterbukaan dievaluasi (aksesPenuh, perluReferral, pilihanReferral)
**When** server memanggilnya
**Then** memakai fungsi kanonik IDENTITAS atas status siklus hidup (AD-8, AD-11), tidak pernah diturunkan dari `positions.shares` live

**Given** pengguna login di mobile (<lg)
**When** navigasi tampil
**Then** bottom nav maksimal 4 item + "Lainnya" (Sheet) sesuai role; item nav terkunci tidak tampil sama sekali (UX-DR14)
**And** di desktop (≥lg): sidebar kiri dengan grup sesuai role; modal bertumpuk maksimal 1 tingkat

**Given** Halaman Personal owner tanpa saham dibuka
**When** konten dimuat
**Then** kerangka berisi Profile, portofolio & status Pesanan Pembelian miliknya (state kosong hingga Epic 3), harga berjalan & RKAP (tautan state kosong hingga Epic 2), dan pintu pembuatan Pesanan Pembelian — sesuai matriks keterbukaan §4.8 (FR-15)

### Story 1.8: Manajemen Owner oleh COO

As a COO,
I want mengelola data owner (identitas, kontak, status) di satu tempat,
So that data dasar selalu mutakhir tanpa spreadsheet dan kontak pengiriman Bukti/OTP selalu benar.

**Acceptance Criteria:**

**Given** halaman Manajemen Owner (khusus COO)
**When** COO menambah/mengedit data owner (identitas, kontak WA/email)
**Then** perubahan tersimpan dan tercatat di audit trail (FR-13)
**And** kontak email dipakai sebagai kanal Bukti Transaksi & OTP MFA (kesiapan untuk Epic 3)

**Given** daftar pemilih owner untuk keperluan input transaksi
**When** COO memilih owner
**Then** seluruh owner dapat dipilih, termasuk yang terverifikasi namun belum pernah membeli (FR-13)

**Given** COO mengedit data owner
**When** mencoba mengubah status siklus hidup (mis. `keluar → terverifikasi`) secara langsung
**Then** ditolak — transisi status hanya via transisi sah bersistem CAS + event domain (AD-11); reaktivasi penuh terjadi lewat transaksi efektif (FR-13)

### Story 1.9: Pergantian COO

As a owner,
I want pergantian COO tercatat dengan referensi MoM,
So that jelas siapa pemegang kewenangan transaksional pada setiap saat.

**Acceptance Criteria:**

**Given** COO membuka alur pergantian peran
**When** owner pengganti dipilih dan referensi MoM (wajib) dilampirkan
**Then** tenure baru aktif, tenure lama berakhir, dan seluruh peristiwa tercatat di audit trail (FR-17)

**Given** referensi MoM kosong
**When** pergantian disubmit
**Then** ditolak oleh validasi sebelum menyimpan (UX-DR20)

**Given** COO lama login setelah pergantian
**When** mengakses sistem
**Then** kembali menjadi Owner biasa — kehilangan akses transaksional & menu COO (FR-17)
**And** kewenangan COO dievaluasi in-tx terhadap `coo_tenures` berlaku pada saat commit — aktor audit selalu pejabat saat itu (AD-8)

