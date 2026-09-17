# snd-dash — Dashboard Kepemilikan Saham Sip & Dip (Phase 1)

Aplikasi Nuxt 4 (Vue + TypeScript, SSR) — modular monolith ledger-centric di atas
PostgreSQL 17 (Supabase), Drizzle ORM, NuxtAuth (Google OAuth), PWA installable
(`@vite-pwa/nuxt`), shadcn-vue + Tailwind v4. Arsitektur mengikat:
`_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`
(invariant AD-1..AD-12 + Structural Seed).

## Struktur (Structural Seed)

```
app/                      # UI Vue (SSR + pulau klien)
  pages/                  #   route — TIPIS: parsing + panggil API + render
  components/             #   komponen; components/ui = shadcn-vue
  composables/            #   logika klien bersama
  lib/                    #   util UI (cn)
server/
  api/                    # route handler tipis
  domain/                 # 10 modul seragam: index.ts (satu pintu impor),
                          #   *.service.ts, *.repo.ts (Drizzle hanya di sini)
  jobs/                   # endpoint cron terproteksi (CRON_SECRET)
  utils/                  # koneksi db (postgres.js pooler), envelope error API
shared/domain/            # rumus murni tanpa I/O: parse/serialize uang (AD-10),
                          #   helper kalender-hari Asia/Jakarta (AD-9)
drizzle/                  # schema.ts + migrations/
app/public/sw.js          # service worker kustom (injectManifest, AD-12)
```

## Prasyarat

- Node `>=24.19.0` (LTS, selaras `.nvmrc` dan `engines`; masa perawatan hingga
  Apr 2028 — recek saat upgrade).
- Docker + Supabase CLI (`brew install supabase/tap/supabase`) untuk database lokal.
- Google Cloud OAuth Client (untuk smoke auth).

## Setup

```bash
npm install
cp .env.example .env      # isi nilainya (lihat tabel env di bawah)
npx nuxt prepare          # regenerasi tipe & eslint Nuxt
```

### Inventaris env

| Variabel | Lingkungan | Keterangan |
| --- | --- | --- |
| `NUXT_AUTH_SECRET` | local+prod | Secret JWT NuxtAuth. |
| `NUXT_GOOGLE_CLIENT_ID` / `NUXT_GOOGLE_CLIENT_SECRET` | local+prod | OAuth Google; redirect URI dev `http://localhost:3000/api/auth/callback/google`. |
| `AUTH_ORIGIN` | local+prod | baseURL PENUH NuxtAuth termasuk path `/api/auth`, tanpa trailing slash (`http://localhost:3000/api/auth` / `https://<domain>/api/auth`). |
| `NUXT_DATABASE_URL` | local+prod | Pooler Supabase (runtime — postgres.js/Drizzle). Local default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. |
| `DATABASE_URL` | local+prod | Sama seperti di atas, dipakai drizzle-kit (`db:generate`/`db:migrate`). |
| `NUXT_RESEND_API_KEY` | prod (opsional di local) | Resend; tanpa ini outbox no-op terlihat (log `alert: mail.unconfigured`). |
| `NUXT_RESEND_FROM` | prod | From-domain terverifikasi, mis. `Sip & Dip <noreply@domain>`. |
| `NUXT_CRON_SECRET` | prod | Proteksi `POST /jobs/daily` (`Authorization: Bearer <secret>`). |
| `ENABLE_TEST_AUTH` | local saja | Aktifkan endpoint dev-only `POST /api/test/login` (session minting uji). JANGAN pernah diset di produksi (triple guard juga menuntut `NODE_ENV !== 'production'`). |
| `TEST_AUTH_SECRET` | local saja | Secret header untuk `/api/test/login`; nilai dev-only (bukan rahasia) — wajib identik dengan fallback `test-secret-lokal` di `tests/support/*`. |

## Database lokal (Supabase CLI / Docker)

```bash
supabase start                                  # memulai stack Docker lokal
npm run db:generate                             # drizzle-kit generate (bila skema berubah)
DATABASE_URL=... npm run db:migrate             # apply migrasi (smoke AR-2)
supabase db reset                               # reset + replay migrasi (bila perlu)
```

## Menjalankan & verifikasi

```bash
npm run dev          # dev server — halaman smoke: http://localhost:3000/smoke
npm run build        # build produksi (SW di-generate di .output/public)
npm run preview      # prod-preview
npm test             # unit test shared/domain + modul server teruji (kontrak uang & hari)
npm run test:coverage  # sama, + laporan coverage (terminal, coverage/index.html, lcov.info)
npm run typecheck && npm run lint
```

Coverage mengukur kode domain (`shared/**`, `server/**`; file stub `export {}`
modul lain tampil 0% sebagai peta tes yang menyusul di story pemiliknya).
Threshold per-file dipinkan untuk kontrak murni `shared/domain` (90/90/95/95) —
regress kontrak AD-9/AD-10 menggagalkan `npm run test:coverage`.

### Checklist Google Cloud Console (OAuth — sekali di awal, gerbang R-005)

Kredensial TIDAK pernah masuk repo — hanya lewat `.env` (keputusan pengguna
spec 1.1 #2). ±5–10 menit:

1. **Buat/ pilih project** — [console.cloud.google.com](https://console.cloud.google.com)
   → project picker → New Project (mis. `snd-dash-dev`).
2. **OAuth consent screen** — menu *Google Auth Platform* (atau *APIs &
   Services → OAuth consent screen*):
   - User Type: **External** (kecuali semua user memakai Workspace yang sama).
   - App name `Sip & Dip Dashboard`, support email, developer contact email.
   - Scopes: default `openid`, `email`, `profile` — cukup (tidak ada scope
     sensitif).
   - Publishing status **Testing** → tambahkan akun Google yang dipakai smoke
     ke *Test users* (user di luar daftar akan ditolak Google).
3. **Buat OAuth Client** — *Google Auth Platform → Clients → Create Client*:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
     (path `/api/auth/callback/google` TEPAT — berasal dari `AUTH_ORIGIN`).
   - Produksi nanti: tambahkan sekalian `https://<domain-prod>/api/auth/callback/google`.
4. **Salin kredensial ke `.env`** (dari `cp .env.example .env`):
   - `NUXT_GOOGLE_CLIENT_ID` / `NUXT_GOOGLE_CLIENT_SECRET` ← dari dialog client.
   - `NUXT_AUTH_SECRET` ← `openssl rand -base64 32`.
   - `AUTH_ORIGIN=http://localhost:3000/api/auth` — baseURL PENUH termasuk
     path `/api/auth`, TANPA trailing slash (dipakai NuxtAuth 1.3.1 apa adanya).
5. **Smoke login** — `npm run dev` → `http://localhost:3000/smoke` → "Masuk
   dengan Google" → kembali dengan status `authenticated` + email tampil →
   "Keluar" mengembalikan `unauthenticated`. Hasil go/no-go R-005 dicatat di
   Design Notes spec 1.1.

> Catatan: mode Testing mengeluarkan refresh token yang kedaluwarsa ±7 hari —
> cukup untuk smoke; promote ke *In production* saat go-live (Story 1.2
> memakai kredensial yang sama). Checklist ini sudah dijalankan 2026-09-16 —
> smoke login lulus, R-005 = GO (lihat Design Notes spec 1.1).

### Runbook smoke R-005 (urut: auth → PWA → komponen)

1. **NuxtAuth**: `npm run dev` → buka `/smoke` → "Masuk dengan Google" →
   kembali dengan status sesi `authenticated` + email tampil
   (prasyarat: checklist Google Cloud Console di atas).
2. **PWA** (AD-12): `npm run build && npm run preview` →
   - DevTools > Application: manifest tervalidasi, SW aktif, precache =
     aset ter-fingerprint + manifest + ikon + `offline.html` saja.
   - Install PWA; offline (DevTools) → navigasi gagal menyajikan `/offline`
     ("Tidak dapat terhubung"); online kembali normal (SSR segar, bukan shell).
   - Prompt pembaruan: deploy ulang (ubah konten) → buka tab lama → muncul
     "Pembaruan aplikasi tersedia" → "Muat versi baru" mengaktifkan versi baru.
3. **Komponen kontrak**: `/smoke` → Dialog, Sheet, Tooltip, Drawer, Input-OTP,
   Toast semuanya interaktif.

## Alur login & landing (Story 1.2)

Jalur masuk aplikasi: halaman Login publik (`/login`) → OAuth Google →
pencocokan email sesi → baris `owners` (modul identity, AD-8/AD-11) → landing
per role. Role dievaluasi per-request di server (middleware `auth-guard` +
route handler), tidak pernah dari klien atau JWT.

| Role (fungsi kanonik identity) | Sumber kebenaran | Landing |
| --- | --- | --- |
| COO aktif | `coo_tenures` berlaku (`started_at` ≤ now < `ended_at`/NULL) | `/antrian-beli` |
| Pemegang saham | `first_effective_at` terisi | `/dashboard` |
| Tanpa saham / Keluar | `terverifikasi` tanpa `first_effective_at`, atau status `keluar` | `/personal` |
| Calon owner | `diajukan` / `ditolak` / `kedaluwarsa` | `/status-pendaftaran` (badge + alasan penolakan apa adanya) |

- Akun Google tanpa baris owner → kembali ke `/login?state=unlinked` dengan
  pesan arahan verbatim (UX-DR15); aksi pendaftaran menyusul Story 1.4.
- Sesi berakhir → akses halaman terproteksi (SSR) dialihkan ke `/login`;
  `GET /api/landing` / `GET /api/pendaftaran/status` tanpa sesi → 401
  envelope `{ code, message, details }`.

Uji cepat lokal:

```bash
curl -i http://localhost:3000/api/landing        # tanpa cookie -> 401 envelope
curl -i http://localhost:3000/dashboard          # tanpa cookie -> 302 ke /login
```

### Session minting dev-only (uji E2E/API)

`POST /api/test/login` men-seed owner **sintetis** lalu menerbitkan cookie
sesi NuxtAuth asli (secret NuxtAuth sama — bukan bypass). Triple guard:
`NODE_ENV !== 'production'` + `ENABLE_TEST_AUTH=1` + header
`TEST_AUTH_SECRET` (nilai lokal `test-secret-lokal`, lihat `.env.example`).
Identifier uji: `coo`, `pemegang-saham`, `tanpa-saham`, `keluar`,
`calon-diajukan`, `calon-ditolak`, `calon-kedaluwarsa`, `unlinked` (tanpa
baris owner). Jalankan suite:

```bash
npx playwright test tests/e2e/landing.api.spec.ts
npx playwright test tests/e2e/auth-landing.spec.ts
```

Owner sintetis hasil seed tersisa di DB lokal (dev-only); pembersihan
menyusul lewat API tulis identity di Story 1.4.

## Email keluar — From-domain & SPF/DKIM (AR-6, gerbang pra-Story 1.5)

Mekanisme outbox sudah wiring lengkap (baris in-tx, pengiriman async + retry
backoff, kegagalan terlihat di log `alert: outbox.*` dan kolom
`outbox_emails.last_error`/`status='exhausted'`). Yang menyusul sebelum
Story 1.5 — verifikasi di dashboard Resend:

1. Pilih From-domain (mis. `noreply@snd-dash` pada domain milik Sip & Dip).
2. Tambahkan domain di Resend → Domains; salin record DNS yang diminta.
3. Checklist DNS di registrar:
   - [ ] SPF: `v=spf1 include:_spf.resend.com ~all` (gabungkan bila sudah ada SPF lain).
   - [ ] DKIM: record CNAME/TXT dari Resend (verifikasi di dashboard).
   - [ ] DMARC (opsional tapi disarankan): policy `none` dulu, `rua` ke email COO.
4. Set env produksi `NUXT_RESEND_API_KEY` + `NUXT_RESEND_FROM`.
5. Kirim email uji nyata (data sintetis) — gerbang pra-Story 1.5.

## Cron harian

`POST /jobs/daily` terproteksi `Authorization: Bearer ${NUXT_CRON_SECRET}`;
Vercel Cron (UTC) memanggilnya harian — batas hari (expiry ke-7, pengingat
H-3) dihitung zona Asia/Jakarta di dalam endpoint (AD-9). Uji lokal:

```bash
curl -X POST -H 'Authorization: Bearer <secret>' http://localhost:3000/jobs/daily
# tanpa/secret salah -> 401 { code: 'UNAUTHORIZED', message, details }
```

## Kontrak pengembang (ringkas)

- Uang/ratio = string desimal berskala tetap; hanya lewat
  `shared/domain/money.ts` (`parseRupiah`/`serializeRupiah`/`parseRatio`/
  `serializeRatio`). `Number()`/`parseFloat()` dilarang — ditegakkan ESLint
  (`no-restricted-syntax`, R-010).
- Aturan kalender-hari hanya lewat `shared/domain/calendar.ts` (Asia/Jakarta).
- Import lintas modul domain hanya lewat `index.ts` modul (AD-5); fungsi di
  jalur transaksi menerima `tx`; hanya service teratas membuka transaksi.
- Error API seragam `{ code, message, details }` (`server/utils/api-error.ts`).
- UI light-only; delta brand UX-DR2 di `app/assets/css/tailwind.css`.
- Data owner nyata tidak pernah masuk repo — uji memakai data sintetis.
