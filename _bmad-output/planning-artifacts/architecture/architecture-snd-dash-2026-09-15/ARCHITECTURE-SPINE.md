---
name: Sip & Dip Ownership Dashboard (Phase 1)
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: modular monolith, ledger-centric (append-only ledger + proyeksi)
scope: Seluruh sistem Phase 1 — pembelian saham, dashboard kepemilikan, RKAP, harga, Contribution, distribusi laba, audit, migrasi; penjualan (FR-2) Phase 2
status: final
created: 2026-09-15
updated: 2026-09-15
binds: [FR-1, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23]
sources: ['../prds/prd-snd-dash-2026-08-14/prd.md', '../../ux-designs/ux-snd-dash-2026-09-15/EXPERIENCE.md']
companions: []
---

# Architecture Spine — Sip & Dip Ownership Dashboard (Phase 1)

## Design Paradigm

**Modular monolith server-rendered, ledger-centric.** Satu aplikasi Nuxt 4 (Vue + TypeScript) — satu repo, satu deployable di Vercel. Inti domain adalah **ledger**: tabel transaksi efektif append-only; seluruh tampilan (tabel kepemilikan, chart, Portion, Strength) adalah **proyeksi** turunannya. Interaktivitas berat (pratinjau pesanan FR-1, chart FR-18) hidup sebagai pulau klien Vue di atas halaman server-rendered. **PWA installable** adalah lapisan peningkatan bertahap di atas SSR — manifest + cache aset statis, seluruh data domain selalu daring (AD-12); di laptop tetap situs responsif biasa.

Pemetaan lapisan → direktori:

```text
app/ (halaman Vue SSR + pulau klien) → server/api (route handler tipis) → server/domain (modul domain) → Drizzle → PostgreSQL (Supabase)
shared/domain (rumus murni) — dipakai bersama server/domain dan pulau pratinjau
```

## Invariants & Rules

### AD-1 — Ledger adalah satu-satunya penulis posisi

- **Binds:** FR-4, FR-5, FR-18, SM-1
- **Prevents:** Dua jalur mutasi state kepemilikan yang bisa berbeda hitungan — penyebab utama selisih yang membunuh kepercayaan owner
- **Rule:** Tabel `ledger_transactions` append-only. Hanya modul LEDGER yang menulis tabel posisi kepemilikan, hanya melalui dua pintu finalisasi: konfirmasi COO (FR-20) dan input langsung COO (FR-21) — plus jalur import sekali jalan MIGRASI (FR-14) yang memakai API internal LEDGER. Modul lain membaca proyeksi, tidak pernah menulis posisi. Koreksi kesalahan tidak pernah UPDATE baris ledger — hanya **entry kompensasi** baru (bertanda referensi ke baris asal), tercatat di audit.

### AD-2 — Finalisasi transaksi atomik, satu penulis per baris status

- **Binds:** FR-20, FR-21, FR-23, FR-1, FR-19
- **Prevents:** Transaksi setengah jadi (pesanan efektif tanpa plotting RKAP, atau Fulfillment tercatat tanpa baris ledger); race dua owner memperebutkan ruang RKAP terakhir; dua jalur mengubah status pesanan yang sama bersamaan (konfirmasi vs kedaluwarsa cron vs penarikan owner)
- **Rule:** Konfirmasi dan input langsung berjalan dalam SATU transaksi DB berisi: append baris ledger + ubah status pesanan via compare-and-set `WHERE status = 'menunggu_konfirmasi'` (hanya pintu konfirmasi; input langsung tanpa pesanan) + pencatatan pembayaran (tanggal + metode — field di `ledger_transactions`, ditulis kedua pintu) + plotting alokasi ke Capital Item + penyesuaian instant Final Requirement (overshoot) + entry audit. Urutan lock: **baris pesanan dulu, lalu baris fase RKAP, kemudian baris owner** (jenis modal Tetap/Bergerak) — SELURUH penulis RKAP (konfirmasi, input langsung, penyesuaian manual COO, penambahan Capital Item, rebalancing) mengambil lock fase yang sama dan me-re-validasi batas agregat penyesuaian di dalam transaksi — first-confirm wins, yang kalah masuk re-validasi gagal (Ditolak + penjelasan hitungan). Kedaluwarsa cron (FR-19) dan penarikan owner juga compare-and-set pada status — hanya satu penulis yang berhasil per baris. **Fulfillment dihitung dari alokasi plotting di ledger (derived) — bukan kolom tulisan terpisah.**

### AD-3 — Audit trail atomik dan append-only

- **Binds:** FR-12
- **Prevents:** Catatan audit yang bisa hilang/tertunda saat aksi terjadi, atau diubah/dihapus setelahnya
- **Rule:** Entry audit ditulis dalam transaksi DB yang sama dengan aksinya — tidak pernah async. Tabel `audit_logs` tanpa jalur UPDATE/DELETE (enforced lewat DB grants); aktor berbentuk `user` (owner/COO) atau `system` (cron); nama event dari registry enum terpusat, envelope `{ actor, action, target, details jsonb }`. Pembacaan hanya untuk tampilan COO; modul lain tidak membaca audit untuk keputusan bisnis.

### AD-4 — Posisi materialized terkopling atomik dengan ledger

- **Binds:** FR-4, FR-5, FR-18, SM-1
- **Prevents:** Tabel posisi yang drift dari ledger (dua sumber kebenaran yang tidak selaras)
- **Rule:** Posisi per owner (Quantity, Shares, Ceil, Actual per jenis modal) disimpan sebagai **tabel biasa yang dipelihara sebagai proyeksi** (bukan PG MATERIALIZED VIEW — harus bisa diupdate dalam transaksi append ledger, AD-2). Update posisi HANYA boleh terjadi di dalam transaksi append ledger. Rekomputasi penuh dari ledger disediakan sebagai alat rekonsiliasi berkala — hasil rekomputasi adalah pembanding audit, bukan jalur tulis.

### AD-5 — Kepemilikan tabel mutlak per modul

- **Binds:** semua modul
- **Prevents:** Modul menimpa data milik modul lain (mis. PESANAN mengubah harga, RKAP mengubah Profile)
- **Rule:** Setiap tabel dimiliki tepat satu modul domain (IDENTITAS: owner/profile/role/coo_tenures/`otp_codes`; LEDGER: transaksi/posisi; RKAP: fase/capital item; HARGA: harga/MoM; CONTRIBUTION: item/realisasi/periode; DISTRIBUSI: rekap; AUDIT: audit_logs; PESANAN: buy_orders; PROOFS: outbox email). Permintaan & verifikasi OTP MFA (FR-3) adalah API publik IDENTITAS — `requestOtp`/`verifyOtp` — dengan pemakaian single-use via compare-and-set pada barisnya. Akses lintas modul lewat API/ekspor modul, bukan menulis tabel tetangga. Tabel outbox ditulis **di dalam transaksi aksi terkait** (menjamin tidak ada email hilang saat crash); pengiriman async dengan retry oleh PROOFS. Arah dependensi:

```mermaid
graph TD
    DASH[dashboard/chart] -->|baca proyeksi| LEDGER[(LEDGER)]
    ORD[PESANAN] -->|baca proyeksi + validasi| LEDGER
    ORD -->|baca ruang| RKAP[RKAP]
    ORD -->|baca harga berjalan| HARGA[HARGA & MoM]
    DIST[DISTRIBUSI] -->|baca proyeksi| LEDGER
    DIST -->|baca poin final| CONTRIB[CONTRIBUTION]
    DIST -->|event: insentif ditunaikan| IDENTITAS
    CONTRIB -->|baca| IDENTITAS
    ORD -->|baca owner| IDENTITAS
    LEDGER -->|event: Pembelian Pertama efektif| IDENTITAS
    LEDGER -->|plotting tulis| RKAP
    LEDGER -->|snapshot harga baca| HARGA
    PROOFS[BUKTI & NOTIFIKASI] -->|react post-commit| LEDGER
    IDENTITAS & ORD & LEDGER & RKAP & HARGA & CONTRIB & DIST -.->|tulis only| AUDIT{{AUDIT}}
```

### AD-6 — Satu implementasi rumus domain

- **Binds:** FR-1, FR-20, FR-21, FR-16, SM-1
- **Prevents:** Pratinjau klien dan validasi server berbeda hasil hitungan (rumus duplikat di dua tempat); dua tim merangkai input validasi Strength dengan cara berbeda
- **Rule:** Seluruh rumus domain murni hidup di `shared/domain` sebagai modul TS murni tanpa I/O — pembobotan (Ceil, Shares, Strength, RTL, Quantity maksimal, batas penyesuaian RKAP, pembulatan half-up 2 desimal), distribusi laba (Dividen = Portion × pool, Insentif = poin ÷ total poin × pool, pembentukan budget pool per ratio RUPS), dan **fungsi perakitan input kanonik** validasi Strength (posisi terkini + seluruh pesanan owner berstatus `menunggu_konfirmasi`) — diimpor oleh server route (validasi otoritatif) dan pulau pratinjau (FR-1). Server tetap satu-satunya otoritas keputusan.

### AD-7 — Harga Terkunci, re-validasi berlapis

- **Binds:** FR-1, FR-20, FR-21, FR-6, FR-22
- **Prevents:** Transaksi memakai harga yang berbeda dari yang disepakati saat submit; finalisasi memakai kondisi usang; referral sah ditolak mesin (atau referral palsu lolos)
- **Rule:** Pesanan menyimpan snapshot harga berlaku pada tanggal submit (Harga Terkunci). Finalisasi memakai harga terkunci namun me-re-validasi kondisi terkini sebelum commit (AD-2). Re-validasi referral pada Pembelian Pertama terbagi dua: **cek mekanis** di mesin (referral ada dalam pilihan sah: pemegang saham atau owner belum pernah beli) dan **penilaian manusia** COO untuk cross-referral hari yang sama (keputusan tercatat di audit) — mesin tidak menolak otomatis kasus itu.

### AD-8 — Akses tiga tingkat dipaksa di batas server

- **Binds:** FR-15, FR-22, FR-3, FR-13, FR-17, §4.8
- **Prevents:** Logika akses yang hanya hidup di UI (bisa dilewati dengan panggilan API langsung); keterbukaan yang bocor ke owner tanpa saham
- **Rule:** Autentikasi via NuxtAuth (Google OAuth, dicocokkan email saat migrasi). Role (Calon Owner terverifikasi / Owner pemegang saham / COO) dan matriks keterbukaan §4.8 (termasuk pembukaan otomatis pasca Pembelian Pertama efektif, pergantian COO FR-17) dienforce di middleware server + tiap route handler — tidak pernah di klien saja. Aksi transaksional COO wajib MFA: OTP email, hashed, single-use, TTL menit.

### AD-9 — Operasional: Vercel + Supabase, cron harian, backup

- **Binds:** FR-19, FR-22, envelope deployment & operations
- **Prevents:** Job tersembunyi yang tidak jalan; dua lingkungan produksi yang berbeda perilaku; kehilangan ledger tanpa pemulihan
- **Rule:** Produksi = Vercel (SSR + API routes, Node runtime ≥ 22) + Supabase PostgreSQL 17 region ap-southeast-1 (Singapore) via connection pooler. Vercel Cron (UTC) memanggil endpoint terproteksi (CRON_SECRET) tiap hari: kedaluwarsa pesanan hari-7 (FR-19) + pengingat/kedaluwarsa pendaftar (FR-22) — **batas hari dihitung di dalam endpoint memakai zona Asia/Jakarta**, bukan jam trigger UTC. Backup: Supabase backup harian/PITR aktif + satu drill restore terdokumentasi sebelum go-live (ledger adalah aset taktergantikan). Pengembangan lokal via Supabase CLI (Docker). Lingkungan: `local` + `production` saja.

### AD-10 — Uang dan metrik: numeric integer-safe

- **Binds:** NFR §4.8, FR-16, FR-23
- **Prevents:** Error pembulatan float menular ke hitungan kepemilikan/distribusi
- **Rule:** Seluruh nilai rupiah di DB bertipe `numeric(18,2)`; Quantity, Shares, Ceil, bobot, plafon bertipe integer; ratio/persentase `numeric(9,6)` dihitung presisi penuh dan dibulatkan half-up 2 desimal hanya saat penyajian. JavaScript tidak pernah menghitung uang dengan `number` — operasi aritmetika uang hanya di `shared/domain` memakai decimal library atau operasi integer sen. Distribusi laba: Portion dan poin dipakai presisi penuh saat menghitung; rekap RUPS menyimpan **snapshot imutabel** dari angka yang dipakai (pembanding antar-RUPS FR-16); sisa pembulatan per-owner terhadap pool tercatat sebagai baris penyesuaian di rekap.

### AD-11 — Siklus hidup owner punya satu penulis

- **Binds:** FR-13, FR-22, FR-16, FR-17, Glossary Owner/Keluar/Pembelian Pertama
- **Prevents:** Dua modul mengubah status owner dengan aturan berbeda; definisi "Pembelian Pertama efektif" yang dihitung beda oleh tim identitas vs tim transaksi
- **Rule:** Hanya IDENTITAS yang menulis status owner. Transisi status adalah reaksi atas event domain: `Pembelian Pertama efektif` (= transaksi ledger PERTAMA seorang owner yang mencapai efektif; pesanan ditolak/ditarik/kedaluwarsa tidak pernah menghasilkan baris ledger) → membuka transparansi penuh; `Insentif owner tanpa saham ditunaikan di rekap RUPS` (event dari DISTRIBUSI) → status Keluar; transaksi efektif baru → reaktivasi. Definisi dan transisi hidup di IDENTITAS sebagai satu fungsi, dipanggil dari alur finalisasi (AD-2) dan rekap. Setiap transisi status adalah **compare-and-set atas status sebelumnya** di dalam satu transaksi DB; flip → `Keluar` oleh rekap wajib me-re-validasi `positions.shares = 0` di dalam transaksi rekap di bawah lock baris owner — set eligibility pra-hitung bersifat indikatif, re-validasi in-tx yang otoritatif (cermin re-validasi saat-commit AD-2/AD-7).

### AD-12 — Satu basis kode dua postur; PWA installable, data selalu daring

- **Binds:** §6.1, UJ-1, UJ-2, UJ-6, Non-Goals §5, EXPERIENCE.md (Foundation & Postur)
- **Prevents:** Cabang basis kode per perangkat (varian mobile vs desktop yang drift); service worker — atau lapisan cache HTTP/edge — menyajikan angka domain (posisi, chart, pesanan) yang usang setelah transaksi baru; antrean tulis luring yang menjadi jalur mutasi kedua di luar pintu finalisasi AD-2; pembaruan service worker yang me-reload di tengah dialog transaksional; konteks terpasang yang menjadi postur ketiga tak beraturan
- **Rule:** Satu basis kode web responsif dengan dua postur — mobile `<lg` (dominan owner) dan desktop `≥lg` (alur berat COO) — tanpa kapabilitas yang hanya hidup di satu postur. **Konteks terpasang (installed) adalah viewport, bukan postur ketiga**: manifest memakai `display: standalone` **tanpa** `orientation`; postur tetap diturunkan semata dari lebar viewport terhadap `lg`; tidak ada perilaku yang meng-key off `display-mode` selain affordance prompt instalasi.

  PWA diaktifkan lewat `@vite-pwa/nuxt` (`generateSW`, atau SW kustom yang direviu terhadap AD ini) dengan batas cache yang didefinisikan tegas: **cangkang aplikasi = aset build ter-fingerprint (JS/CSS/gambar) + web app manifest + ikon + tepat satu halaman statis `/offline` — tidak lebih.** Dokumen navigasi (HTML hasil SSR) dan payload Nuxt adalah **data domain**: tidak boleh di-precache, tidak boleh di-cache runtime, `navigateFallback` hanya ke `/offline`.

  "Selalu daring" mengikat seluruh lapisan cache, bukan hanya service worker: dokumen SSR dan respons `/api/**` dibawakan `Cache-Control: no-store`; route rules `swr`/`isr`/handler cache server dilarang untuk rute domain; cache `immutable` hanya untuk aset ter-fingerprint. Service worker tidak pernah mensintesis respons API — kegagalan fetch diteruskan apa adanya dan dirender oleh state pattern permukaan terkait; shell `/offline` hanya untuk permintaan dokumen yang gagal, isinya persis status global "Tidak dapat terhubung" + Coba lagi (EXPERIENCE.md; Coba lagi = navigasi ulang penuh).

  Pembaruan service worker: `registerType: 'prompt'` tanpa `skipWaiting` otomatis — versi baru aktif saat muat natural berikutnya; prompt pembaruan tidak boleh muncul di atas dialog transaksional (MFA, konfirmasi, input langsung, cut-off, penyesuaian RKAP); reload hanya atas aksi eksplisit pengguna di luar dialog yang terbuka.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Penamaan | Istilah Glossary PRD verbatim di UI dan identifier (Quantity, Shares, Ceil, Strength, Portion, Contribution, RTL, Actual, Fulfillment, Shortfall, Utilization, Achievement, Held); nilai Capital Type selalu `Modal Tetap` / `Modal Bergerak` / `Modal Operasional`; tabel DB snake_case jamak (`buy_orders`, `ledger_transactions`, `audit_logs`); komponen Vue PascalCase; file TS kebab-case |
| Data & format | ID `uuid`; tanggal disimpan `timestamptz` UTC; **seluruh aturan kalender-hari (expiry hari-7 FR-19, tanggal efektif harga FR-6, "hari yang sama" referral FR-22, cut-off FR-10) dihitung dalam zona Asia/Jakarta**; uang `numeric(18,2)` (AD-10); bentuk error API seragam `{ code, message, details }`; status pesanan enum: `menunggu_konfirmasi` / `terkonfirmasi` / `ditolak` / `kedaluwarsa` (penarikan = event audit, bukan status; **penolakan saat submit = tanpa baris pesanan**, hanya audit); ambang kelompok kap Big/Medium/Small Cap = data konfigurasi, bukan konstanta kode |
| State & cross-cutting | Setiap tulis multi-tabel wajib satu transaksi DB; email keluar via outbox (baris ditulis dalam transaksi aksi, pengiriman async + retry oleh PROOFS); Bukti Transaksi diregenerasi deterministik dari data ledger via `@react-pdf/renderer`, format mengikuti Template Konfirmasi Pembelian Saham v3; konfigurasi via env; log terstruktur |
| Platform | Satu basis kode dua postur, breakpoint tunggal `lg` (1024px) — semua alur fungsional di keduanya; PWA installable via `@vite-pwa/nuxt` (AD-12): cache hanya aset ter-fingerprint + `/offline`, dokumen SSR & API `no-store`, tanpa `swr`/`isr` rute domain, tanpa antrean tulis luring; konteks installed = viewport, bukan postur |
| Migrasi | Import memakai API internal modul terkait (LEDGER untuk transaksi, HARGA untuk `price_periods` historis berlabel "migrasi" — FK harga tidak pernah null); aktor migrasi tercatat `system` |
| Testing | `shared/domain` wajib unit test (contoh verifikasi PRD: 2 saham Modal Bergerak → Shares 4/Ceil 6/Strength 66,67%; ceil RKAP 861 saham; ratio 5/41/54; distribusi laba 12jt/2jt → total hak owner contoh 4.340.000) + acceptance migrasi: Grand Total = Quantity 3.622, Shares 5.187, Ceil 14.980 — gerbang SM-1 |
| Bahasa | UI Bahasa Indonesia; istilah metrik tetap English per Glossary §3 |

## Quick Reference — Do / Don't

Bukan keputusan baru — penyaringan AD di atas jadi bentuk yang bisa dicek reviewer story. Setiap baris menunjuk aturan sumbernya.

| Do | Don't | Sumber |
| --- | --- | --- |
| Seluruh hitungan metrik/uang lewat `shared/domain` | Menghitung Strength/Portion/dividen di komponen Vue, route handler, atau query SQL tercecer | AD-6, AD-10 |
| Tulis multi-tabel dalam satu transaksi DB | Menulis posisi/audit/plotting di luar transaksi finalisasi | AD-1, AD-2, AD-4 |
| Import lintas modul lewat `index.ts` publik | Import file dalam folder modul lain; menulis tabel milik modul tetangga | AD-5, Structural Seed |
| `pages/` tipis — parsing + panggil API + render | Logika domain di page/komponen; SQL di komponen | Paradigma, AD-5 |
| Ubah status pesanan dengan compare-and-set | Read-then-write status (race konfirmasi vs cron vs penarikan) | AD-2 |
| Simpan snapshot harga saat submit; finalisasi pakai harga terkunci | Membaca harga berjalan ulang saat finalisasi | AD-7 |
| Kirim email via outbox (baris in-tx, kirim async + retry) | Kirim email inline dalam handler tanpa outbox | AD-5, konvensi State |
| Cek role + keterbukaan di route handler/middleware server | Berhenti di `v-if` role di komponen | AD-8 |
| Aturan kalender-hari (hari-7, "hari yang sama") via helper `shared/domain` zona Asia/Jakarta | Membandingkan `new Date()` mentah (UTC vs lokal) | AD-9, konvensi Data & format |
| Penolakan saat submit = tanpa baris pesanan (audit saja) | Membuat baris pesanan berstatus `ditolak` untuk penolakan pre-antrian | Konvensi Data & format, FR-1/FR-19 |
| Uang `numeric(18,2)` di DB; aritmetika via `shared/domain` | `number`/float JavaScript untuk nilai rupiah; `parseFloat` uang | AD-10 |
| Rancang tiap alur untuk dua postur (`<lg`/`≥lg`) | Kapabilitas yang hanya hidup di satu postur | AD-12 |
| Cache hanya aset ter-fingerprint + `/offline`; dokumen SSR & `/api/**` `no-store` | Precache/navigateFallback HTML rute; runtime-cache dokumen atau `/api/**`; route rules `swr`/`isr` rute domain; antrean tulis luring | AD-12 |
| Fungsi lintas modul di jalur finalisasi menerima `tx`; transaksi dibuka hanya di service teratas | Service yang membuka transaksinya sendiri saat dikomposisi (atomicity AD-2 hilang diam-diam) | AD-5, AD-2 |
| Transisi status owner via compare-and-set; rekap re-validasi `shares = 0` in-tx | Flip status by id dari set pra-hitung — pemegang saham bisa terbalik jadi `Keluar` | AD-11, AD-2 |

## Stack

SEED — diverifikasi web Sep 2026 (kecuali bertanda); kode memiliki versi ini begitu ada.

| Name | Version |
| --- | --- |
| Nuxt (Vue 3 + TypeScript) | 4.x (4.5.2 terverifikasi) — Node runtime ≥ 22 |
| Nitro (server engine bawaan Nuxt) | bawaan Nuxt 4 |
| Drizzle ORM | 0.45.x stabil (v1.0 sudah rc — **di scaffold: pakai v1.0 bila sudah GA**, else 0.45.2 + jadwalkan migrasi) |
| drizzle-kit | 0.31.x |
| postgres.js (driver PG) | pin saat scaffold |
| PostgreSQL (Supabase, region Singapore) | 17 — konfirmasi major saat pembuatan project |
| NuxtAuth (sidebase, Auth.js provider Google) | 1.3.1 — **wajib smoke-test OAuth Google + session di Nuxt 4 saat scaffold** (modul dibangun di atas Nuxt 3; kompatibilitas 4 belum dinyatakan vendor) |
| @vite-pwa/nuxt (PWA installable — AD-12) | 1.1.1 — kompatibel Nuxt 4 (terverifikasi Sep 2026); **wajib smoke-test install + prompt pembaruan di Nuxt 4 saat scaffold** (modul dibangun di atas `@nuxt/kit` 3.x; kompatibilitas 4 belum dinyatakan vendor); batas cache mengikuti AD-12 |
| @react-pdf/renderer (Bukti Transaksi) | latest stable (4.9.0; React = peer dep server-only, font di-bundle; sumber: github.com/diegomura/react-pdf) |
| Resend / SMTP (email keluar) | layanan — pin saat scaffold |
| Vercel + Vercel Cron | layanan (cron UTC — lihat AD-9) |
| Library chart (FR-18) | *Deferred* — lihat bawah |

## Structural Seed

```text
snd-dash/
  app/                      # UI Vue (SSR + pulau klien)
    pages/                  #   route halaman (dashboard, pesanan, admin COO) — TIPIS: parsing + panggil API
    components/             #   komponen; pulau interaktif (pratinjau pesanan, chart) di components/islands/
    composables/            #   logika klien bersama (fetch, state sesi)
  server/
    api/                    # route handler tipis — parsing, auth, delegasi ke domain
    domain/                 # modul domain — SEMUA memakai bentuk internal seragam (lihat bawah)
      identity/ orders/ ledger/ rkap/ pricing/ contribution/ distribution/ proofs/ audit/ migration/
    jobs/                   # endpoint cron terproteksi (expiry, pengingat)
  shared/
    domain/                 # rumus murni AD-6 + helper kalender-hari — tanpa I/O, tanpa framework
  drizzle/                  # skema + migrasi
```

Bentuk internal setiap modul domain (konvensi seed — kode memiliki detailnya begitu ada):

```text
server/domain/<modul>/
  index.ts        # SATU-SATUNYA pintu impor lintas modul (enforce AD-5)
  *.service.ts    # kasus penggunaan / orkestrasi transaksi
  *.repo.ts       # satu-satunya tempat query Drizzle untuk tabel milik modul
  events.ts       # deklarasi event domain yang dipancarkan (bila modul memancarkan)
```

Import dalam folder modul lain (`server/domain/rkap/internal/...`) dilarang — lintas modul hanya lewat `index.ts`-nya.

Fungsi modul yang berpartisipasi dalam transaksi lintas modul menerima handle transaksi (`tx`) sebagai parameter dan bergabung padanya — hanya service level teratas yang membuka transaksi baru, sehingga transaksi AD-2 dapat mengomposisi RKAP/AUDIT/PROOFS/IDENTITAS dalam satu tx.

Entitas inti (nama + relasi; atribut yang merupakan invariant hidup di AD):

```mermaid
erDiagram
    owners ||--o{ buy_orders : "membuat"
    owners ||--o{ ledger_transactions : "subjek"
    owners ||--o{ contribution_entries : "realisasi"
    owners ||--o{ positions : "proyeksi AD-4"
    buy_orders }o--|| price_periods : "snapshot Harga Terkunci"
    buy_orders }o--o| owners : "referral (wajib s.d. Pembelian Pertama)"
    ledger_transactions }o--o| buy_orders : "finalisasi (konfirmasi); NULL utk input langsung & migrasi"
    ledger_transactions }o--o| capital_items : "plotting (Tetap/Bergerak)"
    ledger_transactions }o--|| price_periods : "harga final"
    rkap_phases ||--o{ capital_items : "berisi"
    moms ||--o{ price_periods : "menetapkan"
    moms ||--o{ contribution_items : "menetapkan"
    contribution_items ||--o{ contribution_entries : "dihitung"
    contribution_periods ||--o{ contribution_entries : "cut-off/carry-over"
    profit_distributions ||--o| owners : "rincian per owner (snapshot imutabel AD-10)"
    owners ||--o{ audit_logs : "aktor"
    owners ||--o{ otp_codes : "MFA COO"
    owners ||--o{ coo_tenures : "riwayat COO FR-17"
```

Topologi deployment & envelope operasional:

```mermaid
graph LR
    HP["Browser owner/COO — HP (PWA installable) / desktop"] -->|HTTPS| V[Vercel — Nuxt SSR + API + Cron]
    V -->|SQL via pooler| SB[(Supabase PostgreSQL 17 — ap-southeast-1)]
    V -->|OAuth| G[Google]
    V -->|kirim email — async setelah commit| R[Resend/SMTP — OTP, Bukti, notifikasi]
```

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| FR-1, FR-19, FR-20, FR-21, FR-3 (pesanan, antrian, konfirmasi, input langsung, MFA) | `server/domain/orders` + `server/domain/ledger` + pulau pratinjau `app/components` | AD-2, AD-6, AD-7, AD-8 |
| FR-4, FR-5, FR-18 (tabel & chart kepemilikan) | `app/pages` dashboard + proyeksi LEDGER | AD-1, AD-4 |
| FR-6, FR-7 (harga CMS, MoM) | `server/domain/pricing` | AD-7, konvensi |
| FR-8, FR-9, FR-10 (Contribution, cut-off) | `server/domain/contribution` | AD-5 |
| FR-16 (distribusi laba) | `server/domain/distribution` | AD-5 (read-only), AD-6, AD-10, AD-11 |
| FR-23 (RKAP, gerbang, penyesuaian instant) | `server/domain/rkap` | AD-2, AD-6, AD-7 |
| FR-11 (Bukti Transaksi) | `server/domain/proofs` | AD-5 (react post-commit, outbox), konvensi |
| FR-12 (audit trail) | `server/domain/audit` | AD-3 |
| FR-13, FR-15, FR-17, FR-22 (owner, role, COO, pendaftaran) | `server/domain/identity` | AD-8, AD-11 |
| FR-14 (migrasi) | `server/domain/migration` | AD-1 (via API internal LEDGER), konvensi Migrasi |

## Deferred

- **Library chart (FR-18)** — perilaku & spesifikasi visual chart kini ditetapkan di EXPERIENCE.md/DESIGN.md (run UX Sep 2026, final); pilihan library (Chart.js vs ECharts — kebutuhan donut dua cincin memiringkan ke ECharts) dijatuhkan saat scaffold.
- **Keputusan UX/UI** — hidup di DESIGN.md & EXPERIENCE.md (run UX Sep 2026; termasuk dua postur platform yang diratifikasi AD-12); spine merujuk tanpa menduplikasi.
- **Alur penjualan Phase 2 (FR-2)** — dirancang saat Phase 2; arsitektur menyiapkan ruang: ledger berorientasi transaksi (bukan hanya pembelian), posisi bisa turun, koreksi via entry kompensasi (AD-1).
- **RLS PostgreSQL** — otorisasi cukup di lapisan aplikasi (AD-8) untuk v1; RLS ditambahkan hanya bila ada akses DB langsung pihak ketiga.
- **i18n multi-bahasa** — Bahasa Indonesia saja (Non-Goals PRD: publik luas bukan pengguna).
- **PWA baca luring** — ditolak untuk Phase 1 (keputusan pembaruan Sep 2026): data keuangan tidak boleh tersaji usang, dan tulis luring melanggar AD-2; dipertimbangkan ulang hanya bila muncul kebutuhan nyata akses tanpa sinyal.
- **Staging environment** — `local` + `production` memadai untuk solo dev; staging menyusul bila tim bertambah.
- **Ekstraksi modul menjadi layanan terpisah** — tidak direncanakan; skala 22–40 owner tidak menuntut. Paradigma modular monolith dipilih jangka panjang.
