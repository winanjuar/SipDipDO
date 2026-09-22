# Epic 1 Context: Pendaftaran Owner & Fondasi Akses

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic ini membangun fondasi platform — scaffold Nuxt 4 sesuai Structural Seed (pin stack eksak, smoke-test auth/PWA/komponen), autentikasi Google, infrastruktur email outbox, cron harian, dan PWA installable — lalu menaikkan seluruh alur pendaftaran owner mandiri di atasnya: calon owner mendaftar dengan akun Google dari halaman publik, melengkapi Profile 11 field, dan diverifikasi COO hingga halaman personal terbuka tanpa satu pun entri manual dari COO. Epic ini juga menegakkan model akses tiga tingkat dan matriks keterbukaan di batas server, serta memberi COO alat manajemen owner, pergantian COO berreferensi MoM, dan audit trail permanen. Ini gerbang masuk seluruh epic berikutnya: tanpa fondasi auth, audit, email, cron, dan role yang ditegakkan di sini, tidak ada story lain yang bisa diandalkan. (Catatan: dokumen product brief tidak tersedia di folder planning artifacts; konteks disusun dari PRD, architecture spine, dan kontrak UX.)

## Stories

- Story 1.1: Scaffold Platform Nuxt 4
- Story 1.2: Autentikasi Akun Google & Halaman Login
- Story 1.3: Audit Trail — Pencatatan & Tampilan COO
- Story 1.4: Pendaftaran Owner Mandiri & Status
- Story 1.5: Kelengkapan Profile 11 Field
- Story 1.6: Verifikasi & Penolakan Pendaftar oleh COO
- Story 1.7: Role, Matriks Keterbukaan & Navigasi
- Story 1.8: Manajemen Owner oleh COO
- Story 1.9: Pergantian COO

## Requirements & Constraints

- **Pendaftaran mandiri**: halaman pendaftaran dijangkau link publik tanpa syarat referral; pendaftaran dengan akun Google membuat baris owner berstatus `diajukan` dan tercatat di audit trail. Email bersifat unik — pendaftaran ulang dengan email yang sudah terdaftar tidak pernah membuat baris duplikat. Field referral TIDAK diminta saat pendaftaran — referral diajukan saat Pembelian Pertama (Epic 3).
- **Profile**: 11 field — Nama Lengkap, Alias, Gmail, Nomor HP, Kontak Darurat, Nomor HP Kontak Darurat, Hubungan dengan Owner, Nama Bank, Pemilik Rekening, Nomor Rekening (referral dikecualikan). Kelengkapan Profile adalah prasyarat mutlak verifikasi: COO tidak dapat memverifikasi pendaftar yang belum lengkap (aksi verifikasi tidak tersedia).
- **Status pendaftaran**: Diajukan / Terverifikasi / Ditolak (+ alasan) tampil ke pendaftar; penolakan wajib mengisi alasan dan alasan tampil apa adanya.
- **Kedaluwarsa pendaftar**: batas 7 hari kalender-hari zona Asia/Jakarta sejak pendaftaran; email pengingat terkirim H-3 via outbox; pada hari ke-7 status berubah `kedaluwarsa` via compare-and-set + audit. Pendaftar kedaluwarsa mendaftar ulang sebagai transisi `kedaluwarsa → diajukan` pada baris owner yang sama (bukan baris baru).
- **Audit trail**: permanen dan append-only — tanpa jalur UPDATE/DELETE (dienforce lewat DB grants); setiap entry ditulis dalam transaksi DB yang sama dengan aksinya (tidak pernah async); berbentuk envelope `{ actor, action, target, details jsonb }`; nama action dari registry enum terpusat; aktor `user` (owner/COO) atau `system` (cron). Hanya COO dapat melihat; modul lain menulis audit hanya lewat API publik modul audit.
- **Role & keterbukaan**: tiga tingkat (owner pemegang saham / owner tanpa saham termasuk Keluar / COO). Owner tanpa saham hanya mendapat Halaman Personal; terbuka baginya: Profile & Pesanan Pembelian miliknya, harga berjalan & riwayat, tabel RKAP + progress. Terkunci: tabel/chart kepemilikan, Contribution, MoM, audit trail. Pengecekan role dan keterbukaan dilakukan di middleware server + tiap route handler — tidak pernah di klien saja.
- **Manajemen owner oleh COO**: identitas dan kontak (WA/email) dapat diedit dan tercatat audit; kontak email adalah kanal Bukti Transaksi & OTP MFA (kesiapan Epic 3); seluruh owner dapat dipilih untuk input transaksi, termasuk yang belum pernah membeli. Perubahan status siklus hidup lewat edit langsung ditolak — hanya transisi sah bersistem compare-and-set + event domain; reaktivasi penuh terjadi lewat transaksi efektif.
- **Pergantian COO**: wajib referensi MoM (divalidasi sebelum simpan); tenure baru aktif dan tenure lama berakhir; COO lama kembali menjadi Owner biasa — kehilangan akses transaksional & menu COO. Kewenangan COO dievaluasi terhadap tenure berlaku pada saat commit transaksi; aktor audit selalu pejabat saat itu.
- **Autentikasi**: seluruh akun memakai Google; owner eksisting dicocokkan lewat email saat migrasi (Epic 6). Sesi berakhir → redirect ke halaman Login.

## Technical Decisions

- **Struktur Structural Seed**: `app/` (pages tipis, components, islands, composables), `server/api` (route handler tipis), `server/domain/` 10 modul seragam — identity, orders, ledger, rkap, pricing, contribution, distribution, proofs, audit, migration — masing-masing berbentuk `index.ts` (satu pintu impor lintas modul), `*.service.ts`, `*.repo.ts` (satu-satunya tempat query Drizzle), `events.ts` opsional; plus `server/jobs` (endpoint cron) dan `shared/domain` murni tanpa I/O.
- **Pin stack eksak**: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `postgres.js` 3.4.9, Node 24 LTS (engines `>=22.19.0`), NuxtAuth 1.3.1, `@vite-pwa/nuxt` 1.1.1; cek dist-tag Drizzle 1.0 saat scaffold — bila GA, ambil dan ulangi smoke migrasi. Smoke-test wajib: OAuth Google + session, PWA BUILD (generateSW) + install + prompt pembaruan, dan paritas komponen kontrak shadcn-vue (Dialog, Sheet, Tooltip, Drawer, Input-OTP, Toast). Fallback diizinkan dengan keputusan tercatat: auth → `nuxt-auth-utils`/OAuth manual; PWA → `vite-plugin-pwa`/SW kustom dengan reviu terhadap batas cache. Library chart (condong ECharts) dan decimal library dipin saat scaffold dengan alasan tercatat.
- **Siklus hidup owner**: enum dipinkan `diajukan`/`terverifikasi`/`ditolak`/`kedaluwarsa`/`keluar`; owners unik per email (unique constraint). Hanya modul identity yang menulis status owner; setiap transisi = compare-and-set atas status sebelumnya dalam satu transaksi DB + entry audit. Predikat akses (`aksesPenuh`, `perluReferral`, `pilihanReferral`) adalah fungsi kanonik tunggal di identity atas status siklus hidup — tidak pernah diturunkan dari posisi saham live.
- **Kepemilikan tabel mutlak per modul**: identity memiliki owners & coo_tenures; audit memiliki audit_logs; akses lintas modul hanya lewat `index.ts` modul — jangan menulis tabel tetangga.
- **Email via outbox**: baris outbox ditulis di dalam transaksi aksi terkait (tidak ada email hilang saat crash); pengiriman async + retry oleh modul proofs; Resend dengan SPF/DKIM & From-domain disiapkan saat scaffold; retry yang terus gagal wajib terlihat (log + alert).
- **Cron harian** (Vercel Cron, terproteksi CRON_SECRET): batas hari dihitung di dalam endpoint memakai helper kalender-hari zona Asia/Jakarta dari `shared/domain` — jangan `new Date()` mentah.
- **PWA**: cache hanya aset build ter-fingerprint + manifest + ikon + tepat satu halaman `/offline`; dokumen SSR dan `/api/**` wajib `Cache-Control: no-store`; tanpa route rules `swr`/`isr` untuk rute domain; `registerType: 'prompt'` tanpa skipWaiting; konteks terpasang = viewport, bukan postur ketiga.
- **Lingkungan**: `local` (Supabase CLI/Docker) + `production` (Vercel + Supabase PostgreSQL 17 region ap-southeast-1 via connection pooler) saja.
- **Kontrak data**: ID `uuid`; waktu `timestamptz` UTC; uang `numeric(18,2)`; ratio `numeric(9,6)`; bentuk error API seragam `{ code, message, details }`; tabel snake_case jamak. Seminimal mungkin `any` — nilai yang melewati validasi dibungkus branded type dengan pasangan parse/serialize di `shared/domain`. Tanpa magic number — angka dalam logika = konstanta bernama; ambang yang dapat berubah = data konfigurasi, bukan konstanta kode.

## UX & Interaction Patterns

- **Halaman publik (Login & Pendaftaran)**: lockup logo 80px terpusat + tagline italic *"Sip the taste, dip the soul"*; di dalam app logo 32px di header/sidebar tanpa tagline, ketuk → landing sesuai role. Brand navy `#2D3959`, light-only tanpa dark mode; warisi default shadcn-vue, hanya delta brand yang di-override.
- **Login**: satu CTA Google. Akun Google belum terhubung ke siapa pun → pesan arahan (pendaftar: lanjutkan pendaftaran; owner eksisting: hubungi COO untuk pencocokan email migrasi). Redirect landing per role — pemegang saham → Dashboard, tanpa saham/Keluar → Halaman Personal, COO → Antrian Beli; untuk Epic 1 halaman tujuan cukup kerangka + state kosong.
- **Status Badge** selalu berteks (warna bukan satu-satunya pembawa makna): Diajukan `warn`, Terverifikasi `success`, Ditolak `destructive`; perubahan status diumumkan `aria-live="polite"`.
- **Kelengkapan Profile**: 11 field dengan indikator yang menunjukkan persis langkah yang belum lengkap; Calon Owner yang belum lengkap hanya melihat Kelengkapan Profile + statusnya — tanpa navigasi lain.
- **Navigasi**: mobile (<lg) bottom nav maksimal 4 item + "Lainnya" (Sheet); desktop (≥lg) sidebar kiri dengan grup sesuai role; item nav terkunci tidak tampil sama sekali (bukan disorot merah); modal bertumpuk maksimal 1 tingkat. Akses URL langsung ke permukaan terkunci ditolak di server dan dialihkan ke Halaman Personal dengan pesan "Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif."
- **Halaman Personal** (owner tanpa saham): kerangka berisi Profile, portofolio & status Pesanan Pembelian miliknya, harga berjalan & RKAP (tautan, state kosong hingga Epic 2), dan pintu pembuatan Pesanan Pembelian (state kosong hingga Epic 3).
- **Microcopy & state**: nada tenang-transparan-edukatif, tanpa emoji/FOMO/eufemisme; form submit gagal non-validasi → isian dipertahankan + toast "Tidak dapat menyimpan — coba lagi."; state kosong dan gagal muat mengikuti pola state (Skeleton, "Tidak dapat memuat data." + Coba lagi — angka basi tidak pernah tampil diam-diam).
- **Bahasa & aksesibilitas**: UI Bahasa Indonesia; istilah metrik English verbatim (Quantity, Shares, Ceil, Strength, Portion, RTL); locale `id-ID`; angka `tabular-nums`, hitungan `font-mono`; WCAG 2.1 AA — target sentuh ≥44×44px, `lang="id"`, fokus terlihat dan terkelola.

## Cross-Story Dependencies

- **Story 1.1 adalah prasyarat seluruh story lain** di epic ini: struktur modul domain, pin stack, substrate komponen, infrastruktur outbox, cron, dan PWA.
- Story 1.2 (auth) menopang semua story yang membutuhkan login; story 1.3 menyediakan API audit publik yang dipakai story 1.4, 1.5, 1.6, 1.8, dan 1.9.
- Alur pendaftaran berantai: 1.4 (daftar → `diajukan`) → 1.5 (kelengkapan Profile + pengingat/kedaluwarsa via cron) → 1.6 (verifikasi/penolakan COO → `terverifikasi`). Story 1.5 bergantung pada infrastruktur outbox + cron + helper kalender-hari dari 1.1.
- Story 1.7 mengonsumsi status `terverifikasi` dari 1.6 dan fungsi predikat/enum siklus hidup di identity; story 1.8 dan 1.9 memakai modul identity yang sama (owners, coo_tenures).
- **Dengan epic lain**: Halaman Personal menampilkan tautan harga & RKAP (Epic 2) dan pintu Pesanan Pembelian (Epic 3) sebagai state kosong; kontak email yang dikelola story 1.8 adalah kanal OTP MFA & Bukti Transaksi untuk Epic 3; pencocokan email owner eksisting terjadi saat migrasi (Epic 6); dashboard kepemilikan, Contribution, dan MoM tetap terkunci hingga Epic 4/5 dan pembukaannya otomatis setelah Pembelian Pertama efektif.
