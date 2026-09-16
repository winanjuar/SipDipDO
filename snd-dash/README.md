# Sip & Dip Ownership Dashboard (Phase 1)

Dashboard kepemilikan internal cafe **Sip & Dip** yang menggantikan pencatatan berbasis Google Sheets/Form menjadi satu sumber kebenaran. Owner dapat memesan pembelian saham secara mandiri dengan validasi pembobotan otomatis (Ceil, Shares, Strength); COO mengonfirmasi pesanan setelah pembayaran (dengan MFA); dashboard kepemilikan, RKAP, kontribusi, dan distribusi laba selalu mutakhir; Bukti Transaksi dikirim via email.

Aplikasi ini adalah **satu aplikasi Nuxt 4** (satu repo, satu deployable) dengan inti **ledger append-only** sebagai satu-satunya penulis posisi kepemilikan.

---

## Stack

| Lapisan | Teknologi |
|---|---|
| Framework | Nuxt 4 (Vue 3 + Nitro), TypeScript |
| Database | PostgreSQL 17 (Supabase), Drizzle ORM + postgres.js |
| Auth | NuxtAuth (sidebase) — Google OAuth (produksi) / Dev Email (lokal) |
| Charts | ECharts |
| PWA | @vite-pwa/nuxt (generateSW, cache aset statis saja) |
| Uang/rasio | decimal.js (string berskala tetap, tanpa float) |
| Test | Vitest + fast-check |

Node yang dibutuhkan: **>= 22.19.0**.

---

## Struktur direktori

```text
snd-dash/
  app/            # UI Vue: pages, components (pulau klien), middleware, composables
  server/
    api/          # route handler tipis (parse -> guard -> domain -> render)
    domain/       # 10 modul domain: identity, orders, ledger, rkap, pricing,
                  #   contribution, distribution, proofs, audit, migration
    jobs/         # cron terproteksi (expiry pesanan, pengingat pendaftar)
    utils/        # db, access guard, session, http
  shared/domain/  # rumus murni (weighting, RKAP, distribusi, kalender) — tanpa I/O
  drizzle/        # skema, migrasi SQL, skrip grants/seed
```

---

## Prasyarat

- Node.js **22.19.0+**
- Akun & project **Supabase** (PostgreSQL 17)
- `psql` (opsional — bisa juga pakai Supabase SQL Editor)

---

## Setup & Menjalankan (langkah demi langkah)

### 1. Install dependency

```bash
cd snd-dash
npm install
```

### 2. Siapkan file `.env`

Salin `.env.example` menjadi `.env`, lalu isi. Untuk pengembangan lokal cukup `DATABASE_URL` + `NUXT_AUTH_SECRET`:

```dotenv
# Connection string Supabase — WAJIB pakai POOLER (bukan db.<ref>.supabase.co).
# Ambil di Supabase -> tombol "Connect" -> Session pooler (port 5432).
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Origin aplikasi (default dev).
AUTH_ORIGIN=http://localhost:3000

# Rahasia sesi NuxtAuth — string acak panjang (WAJIB agar auth berjalan).
NUXT_AUTH_SECRET=ganti-dengan-string-acak-panjang

# Google OAuth — KOSONGKAN untuk mode dev (login pakai Dev Email).
NUXT_GOOGLE_CLIENT_ID=
NUXT_GOOGLE_CLIENT_SECRET=

# Proteksi endpoint cron — string acak.
NUXT_CRON_SECRET=ganti-dengan-string-acak
```

> **Penting:**
> - Gunakan **connection string pooler** (`aws-0-<region>.pooler.supabase.com`), bukan `db.<ref>.supabase.co` — hostname direct-connection sering tidak resolve di jaringan IPv4-only (`ENOTFOUND`).
> - Bila `NUXT_GOOGLE_CLIENT_ID`/`SECRET` **kosong**, tombol login Google tidak muncul dan sistem memakai provider **Dev Email**.
> - Jangan commit `.env` (sudah diabaikan git). Jangan tempel password/secret ke tempat publik.

### 3. Jalankan migrasi database

Membuat 19 tabel domain di Supabase:

```bash
npm run db:migrate
```

Jika mengubah `drizzle/schema.ts` di kemudian hari:

```bash
npm run db:generate   # buat file SQL migrasi baru
npm run db:migrate    # terapkan ke DB
```

### 4. Seed data awal (agar dashboard tidak kosong)

Jalankan skrip di **Supabase -> SQL Editor** (tempel isi file) atau via `psql`:

| Skrip | Fungsi |
|---|---|
| `drizzle/seed-coo.sql` | Membuat COO pertama (`lerzack@gmail.com`) — Owner terverifikasi + role `coo` + tenure aktif. **Wajib** agar bisa login. |
| `drizzle/seed-data.sql` | Harga berjalan (beli 52.000 / jual 55.000), 1 MoM, 1 RKAP phase aktif + 3 Capital Item. |

```bash
psql "$DATABASE_URL" -f drizzle/seed-coo.sql
psql "$DATABASE_URL" -f drizzle/seed-data.sql
```

> Semua skrip **idempoten** — aman dijalankan berulang.
> Untuk memberi akses ke akun lain, tambahkan barisnya sendiri di `owners` (login menolak email yang belum terdaftar).

### 5. (Opsional, disarankan produksi) Role runtime append-only audit

`audit_logs` harus append-only (tanpa UPDATE/DELETE). Grant ini **tidak berlaku** untuk superuser `postgres`, jadi buat role runtime terpisah:

1. Buka `drizzle/runtime-role.sql`, ganti `'GANTI_PASSWORD_KUAT'`.
2. Jalankan sebagai `postgres` di Supabase SQL Editor.
3. Ganti `DATABASE_URL` runtime memakai user `app_runtime.<project-ref>`.

### 6. Jalankan aplikasi

```bash
npm run dev
```

Buka **http://localhost:3000**.

Untuk simulasi produksi:

```bash
npm run build
npm run preview
```

---

## Cara Login

### Mode Development (tanpa Google) — default lokal

1. Pastikan `NUXT_GOOGLE_CLIENT_ID`/`SECRET` **kosong** di `.env`.
2. Buka **http://localhost:3000/api/auth/signin**.
3. Pilih **"Dev Email (tanpa Google)"**.
4. Masukkan email yang sudah di-seed (mis. `lerzack@gmail.com`) dan submit.
5. Masuk sebagai **COO** (punya akses penuh: RKAP, harga, antrian, distribusi, audit).

> Provider Dev Email **otomatis nonaktif** saat `NODE_ENV=production`. Email tetap dicocokkan ke tabel `owners` — hanya email terdaftar yang bisa masuk.

### Mode Produksi (Google OAuth)

1. Buat OAuth Client di [Google Cloud Console](https://console.cloud.google.com):
   - **APIs & Services -> OAuth consent screen**: type External, isi data wajib, tambahkan test users bila masih mode Testing.
   - **Credentials -> Create OAuth client ID -> Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` (dan origin produksi).
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (dan versi produksi `https://<domain>/api/auth/callback/google`).
2. Isi `NUXT_GOOGLE_CLIENT_ID` dan `NUXT_GOOGLE_CLIENT_SECRET` di `.env`.
3. Set `AUTH_ORIGIN` ke origin publik aplikasi saat deploy.
4. Login memakai akun Google yang emailnya cocok dengan baris di `owners`.

---

## Peran & Hak Akses (ringkas)

- **Calon Owner** — akses terbatas: kelengkapan Profile miliknya.
- **Owner tanpa saham / Keluar** — Profile & pesanan sendiri, harga & riwayat, tabel RKAP + progress, rekap distribusi (selama masih ada poin Contribution).
- **Owner pemegang saham** — transparansi penuh (tabel/chart kepemilikan seluruh Owner, Contribution, dll.).
- **COO** — mandat operasional: konfirmasi pesanan (MFA), input transaksi langsung, kelola harga/MoM/RKAP/Contribution/distribusi, audit trail.

> Catatan: dashboard kepemilikan seluruh Owner **terkunci** hingga Owner memiliki transaksi efektif pertama. Endpoint akan membalas `REDIRECT_PERSONAL` — ini perilaku yang benar (matriks keterbukaan §4.8), bukan error.

---

## Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan dev server (http://localhost:3000) |
| `npm run build` | Build produksi |
| `npm run preview` | Preview hasil build |
| `npm test` | Jalankan test suite (vitest sekali jalan) |
| `npm run test:watch` | Test mode watch |
| `npm run db:generate` | Generate file migrasi dari perubahan skema |
| `npm run db:migrate` | Terapkan migrasi ke database |

---

## Testing

```bash
npm test
```

- **Unit test**: rumus `shared/domain` (pembobotan, RKAP, distribusi, kalender).
- **Property-based test** (fast-check): invarian ledger↔posisi, konservasi Portion, soundness gerbang Strength, idempotensi Bukti, dll.
- **Guard akses & DB**: `server/utils`.

> Catatan: `npm run typecheck` (vue-tsc) saat ini gagal karena inkompatibilitas toolchain TypeScript yang terpasang (bukan cacat kode). Verifikasi tipe dilakukan lewat build + diagnostics IDE.

---

## Catatan Operasional

- **Email (OTP MFA & Bukti Transaksi)** butuh konfigurasi Resend/SMTP. Sebelum disetup, alur konfirmasi pesanan yang memerlukan OTP belum bisa tuntas.
- **Cron** (kedaluwarsa pesanan hari-7, pengingat pendaftar) memakai zona **Asia/Jakarta** dan endpoint terproteksi `CRON_SECRET`.
- **Zona waktu**: seluruh batas hari dihitung Asia/Jakarta, bukan jam trigger UTC.
- **Uang/rasio**: selalu string berskala tetap (`numeric(18,2)` / `numeric(9,6)`). Dilarang `Number()`/`parseFloat()` atas nilai uang/rasio.

---

## Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` | Pakai **pooler** connection string (`aws-0-<region>.pooler.supabase.com`), bukan direct connection. Cek juga project tidak sedang paused. |
| `db:migrate` exit 1 tanpa pesan | Biasanya gagal koneksi — verifikasi `DATABASE_URL` (password ter-URL-encode bila ada karakter spesial). |
| Login ditolak walau email benar | Email belum ada di tabel `owners`. Jalankan `seed-coo.sql` atau tambahkan baris owner. |
| Halaman kepemilikan `REDIRECT_PERSONAL` | Perilaku benar: butuh transaksi efektif pertama untuk membuka akses penuh. |
| Tombol Google muncul tapi error | `NUXT_GOOGLE_CLIENT_ID/SECRET` terisi nilai tidak valid. Kosongkan untuk mode dev, atau isi kredensial Google yang benar. |
```
