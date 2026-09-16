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
npm test             # unit test shared/domain (kontrak uang & hari)
npm run typecheck && npm run lint
```

### Runbook smoke R-005 (urut: auth → PWA → komponen)

1. **NuxtAuth**: `npm run dev` → buka `/smoke` → "Masuk dengan Google" →
   kembali dengan status sesi `authenticated` + email tampil.
2. **PWA** (AD-12): `npm run build && npm run preview` →
   - DevTools > Application: manifest tervalidasi, SW aktif, precache =
     aset ter-fingerprint + manifest + ikon + `offline.html` saja.
   - Install PWA; offline (DevTools) → navigasi gagal menyajikan `/offline`
     ("Tidak dapat terhubung"); online kembali normal (SSR segar, bukan shell).
   - Prompt pembaruan: deploy ulang (ubah konten) → buka tab lama → muncul
     "Pembaruan aplikasi tersedia" → "Muat versi baru" mengaktifkan versi baru.
3. **Komponen kontrak**: `/smoke` → Dialog, Sheet, Tooltip, Drawer, Input-OTP,
   Toast semuanya interaktif.

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
