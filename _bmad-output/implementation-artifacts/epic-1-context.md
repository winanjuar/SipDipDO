# Epic 1 Context: Pendaftaran Owner & Fondasi Akses

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic ini membangun seluruh fondasi akses aplikasi: calon owner mendaftar mandiri dengan akun Google, melengkapi Profile, dan diverifikasi COO hingga halaman personal terbuka — menggantikan Google Form tanpa satu pun entri manual COO. COO mendapat alat kelola data owner, pergantian COO berreferensi MoM, dan tampilan audit trail. Role tiga tingkat (Calon Owner terverifikasi / Owner pemegang saham / COO) beserta matriks keterbukaan ditegakkan di batas server. Epic ini sekaligus menyiapkan substrat platform — scaffold Nuxt 4 sesuai Structural Seed, email outbox, cron harian, PWA installable — yang dipakai seluruh epic berikutnya.

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

- Pendaftaran diakses via link publik tanpa referral; field Referal dari form lama TIDAK diminta saat pendaftaran — referral diajukan saat Pembelian Pertama (Epic 3).
- Urutan gerbang: registrasi → Profile lengkap (prasyarat) → verifikasi COO; aksi verifikasi tidak tersedia selama Profile belum lengkap.
- Status pendaftaran: Diajukan / Terverifikasi / Ditolak (+ alasan wajib, tampil apa adanya kepada pendaftar).
- Email owner unik (unique constraint); pendaftar kedaluwarsa yang mendaftar ulang memakai baris owner yang sama, bukan baris baru.
- Pendaftaran kedaluwarsa otomatis pada hari ke-7 (kalender zona Asia/Jakarta) bila Profile belum lengkap; email pengingat dikirim H-3; verifikasi COO vs cron expiry adalah race yang dijaga compare-and-set — hanya satu penulis yang berhasil.
- Matriks keterbukaan owner tanpa saham (berlaku juga bagi status Keluar): terbuka — Profile & Pesanan Pembelian miliknya, harga berjalan & riwayat, tabel RKAP; terkunci — tabel/chart kepemilikan seluruh owner, Contribution, MoM, audit trail. Yang terkunci terbuka otomatis setelah Pembelian Pertama efektif.
- Audit trail hanya dapat dilihat COO; non-COO yang membuka URL langsung dialihkan.
- Manajemen owner oleh COO: kelola identitas + kontak WA/email (kanal Bukti Transaksi & OTP MFA); seluruh owner dapat dipilih untuk input transaksi, termasuk yang belum pernah membeli; perubahan status siklus hidup secara langsung ditolak — hanya via transisi sah; reaktivasi penuh terjadi lewat transaksi efektif.
- Pergantian COO wajib melampirkan referensi MoM; tenure lama berakhir, COO lama kembali menjadi Owner biasa dan kehilangan akses transaksional & menu COO.
- Landing sesuai role: pemegang saham → Dashboard, tanpa saham/Keluar → Halaman Personal, COO → Antrian Beli. Untuk Epic 1 halaman tujuan cukup kerangka + state kosong.

## Technical Decisions

- Pin eksak saat scaffold: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `postgres.js@3.4.9`, NuxtAuth 1.3.1, `@vite-pwa/nuxt@1.1.1`; Node 24 LTS (engines floor `>=22.19.0`). NuxtAuth (OAuth Google + session) dan PWA (BUILD generateSW + install + prompt pembaruan) wajib smoke-test di Nuxt 4 dengan fallback terencana bila gagal (`nuxt-auth-utils`/OAuth manual; `vite-plugin-pwa` langsung/SW kustom). Keputusan library chart (condong ECharts) dan decimal library dipin dan dicatat alasannya saat scaffold.
- Struktur mengikuti Structural Seed: `app/` (pages tipis, components/islands, composables), `server/api` tipis, `server/domain` 10 modul bentuk seragam (`index.ts` satu pintu impor, `*.service.ts`, `*.repo.ts`, `events.ts` opsional; Drizzle hanya di repo), `server/jobs`, `shared/domain` murni tanpa I/O, `drizzle/`. Modul Epic 1: identity, audit, proofs.
- Audit: tabel `audit_logs` append-only tanpa jalur UPDATE/DELETE (enforced via DB grants); entry ditulis dalam transaksi DB yang sama dengan aksinya (tidak pernah async); envelope `{ actor, action, target, details jsonb }`; nama action dari registry enum terpusat; aktor `user` (owner/COO) atau `system` (cron); modul lain menulis audit hanya lewat API publik modul audit.
- Email keluar via outbox: baris outbox ditulis in-tx bersama aksi, pengiriman async + retry oleh modul proofs; Resend dengan SPF/DKIM & From-domain disiapkan saat scaffold.
- Cron: Vercel Cron (UTC) memanggil endpoint terproteksi CRON_SECRET; seluruh batas hari (H-3, hari ke-7) dihitung zona Asia/Jakarta via helper `shared/domain` — jangan `new Date()` mentah.
- Status siklus hidup owner dipinkan: `diajukan` / `terverifikasi` / `ditolak` / `kedaluwarsa` / `keluar`; hanya modul identity yang menulisnya; setiap transisi adalah compare-and-set atas status sebelumnya dalam satu transaksi DB. Predikat akses (`aksesPenuh`, `perluReferral`, `pilihanReferral`) adalah fungsi kanonik identity atas status siklus hidup — tidak pernah diturunkan dari `positions.shares` live.
- Role & matriks keterbukaan ditegakkan di middleware server + tiap route handler, tidak pernah di klien saja; kewenangan COO dievaluasi in-tx terhadap `coo_tenures` yang berlaku pada saat commit (aktor audit selalu pejabat saat itu).
- PWA: cache cangkang hanya aset ter-fingerprint + manifest + ikon + tepat satu `/offline`; dokumen SSR & `/api/**` `no-store`; `registerType: 'prompt'` tanpa skipWaiting otomatis; manifest `display: standalone` tanpa `orientation` (postur diturunkan dari lebar viewport terhadap `lg`, bukan display-mode).
- Lingkungan hanya `local` (Supabase CLI/Docker) + `production` (Vercel + Supabase PostgreSQL 17 via pooler).
- Konvensi: ID uuid; tabel snake_case jamak (`owners`, `audit_logs`, `coo_tenures`); tanggal `timestamptz` UTC; error API seragam `{ code, message, details }`; nilai uang/ratio tidak pernah `number`/`parseFloat` — string desimal berskala tetap lewat satu pasangan parse/serialize di `shared/domain`; UI Bahasa Indonesia dengan istilah metrik English verbatim; fungsi lintas modul dalam jalur transaksi menerima `tx`.

## UX & Interaction Patterns

- Login: lockup logo 80px terpusat + tagline "Sip the taste, dip the soul" + satu CTA Google; akun Google belum terhubung → pesan arahan (pendaftar lanjutkan pendaftaran; owner eksisting hubungi COO); sesi berakhir → dialihkan ke Login.
- Navigasi: mobile (<lg) bottom nav maks 4 item + "Lainnya" (Sheet); desktop (≥lg) sidebar kiri dengan grup sesuai role; item nav terkunci tidak tampil sama sekali; modal bertumpuk maks 1 tingkat; pendaftar belum lengkap hanya melihat Kelengkapan Profile tanpa navigasi lain.
- Halaman Personal (owner tanpa saham/Keluar): Profile, portofolio & status Pesanan Pembelian miliknya (state kosong hingga Epic 3), harga berjalan & RKAP (tautan state kosong hingga Epic 2), pintu pembuatan Pesanan Pembelian.
- Status Badge selalu berteks: Diajukan `warn`, Terverifikasi `success`, Ditolak `destructive`, Kedaluwarsa `muted`; perubahan status diumumkan `aria-live="polite"`.
- Penolakan (pendaftaran, pergantian tanpa MoM) divalidasi sebelum simpan dengan alasan wajib; submit form gagal karena gangguan non-validasi mempertahankan isian + toast "Tidak dapat menyimpan — coba lagi."
- Kelengkapan Profile: indikator langkah yang persis menunjukkan field yang belum lengkap.
- Brand: light-only tanpa dark mode; primary navy #2D3959; logo asli tidak di-recolor (80px terpusat di halaman publik, 32px di header/sidebar); seluruh angka `tabular-nums`, format id-ID (Rp52.000; 66,67%); touch-first target ≥44px; Dialog di mobile menjadi Sheet/Drawer penuh; WCAG 2.1 AA; `lang="id"`.

## Cross-Story Dependencies

- 1.1 memblokir seluruh story lain: scaffold, outbox email, dan cron adalah prasyarat semua cerita di epic ini maupun epic berikutnya.
- 1.2 (auth) dan 1.3 (audit) prasyarat 1.4–1.9; setiap aksi di 1.4–1.9 wajib menulis entry audit dalam transaksi yang sama.
- 1.4 + 1.5 prasyarat 1.6: verifikasi menuntut Profile lengkap, dan race verifikasi vs cron kedaluwarsa dijaga CAS yang sama.
- 1.7 bertumpuk pada predikat akses identity dari 1.4–1.6; Halaman Personal hanya menautkan permukaan Epic 2 (harga, RKAP) dan Epic 3 (pesanan) sebagai state kosong — jangan diimplementasi di epic ini.
- Fondasi outbox/cron/audit dari epic ini dipakai Epic 2 (harga, MoM) dan Epic 3 (pesanan, Bukti Transaksi, OTP MFA).
