# Panduan Deployment: Supabase + Vercel

> **Proyek:** Sip & Dip Ownership Dashboard (snd-dash)  
> **Versi:** 1.0.0  
> **Tanggal:** 2026-09-23  
> **Branch:** `feature/epic-2`

---

## Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Build dan Run Lokal](#build-dan-run-lokal)
3. [Git Workflow & Branch Strategy](#git-workflow--branch-strategy)
4. [Migrasi Database ke Supabase](#migrasi-database-ke-supabase)
5. [Konfigurasi Supabase Storage](#konfigurasi-supabase-storage)
6. [Setup Environment Variables](#setup-environment-variables)
7. [Deploy ke Vercel dari Feature Branch](#deploy-ke-vercel-dari-feature-branch)
8. [Verifikasi Deployment](#verifikasi-deployment)
9. [Merge ke Main & Production Deploy](#merge-ke-main--production-deploy)
10. [Troubleshooting](#troubleshooting)

---

## Prasyarat

- [x] Akun Supabase (https://supabase.com)
- [x] Akun Vercel (https://vercel.com)
- [x] Akun GitHub dengan repository project
- [x] Node.js 18+ terinstall
- [x] Git repository sudah di-push ke GitHub

---

## Build dan Run Lokal

### Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment (copy dan edit .env)
cp .env.example .env
# Edit .env dengan kredensial Anda

# 3. Generate database schema (jika belum ada)
pnpm run db:generate

# 4. Jalankan migrasi database
pnpm run db:migrate

# 5. (Opsional) Seed data awal
pnpm run db:seed

# 6. Jalankan development server
pnpm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

---

### NPM Scripts Reference

| Script | Perintah | Deskripsi |
|--------|----------|-----------|
| `dev` | `pnpm run dev` | Jalankan development server dengan hot reload |
| `build` | `pnpm run build` | Build aplikasi untuk production |
| `preview` | `pnpm run preview` | Preview production build secara lokal |
| `test` | `pnpm run test` | Jalankan unit tests dengan Vitest |
| `test:e2e` | `pnpm run test:e2e` | Jalankan end-to-end tests dengan Playwright |
| `test:coverage` | `pnpm run test:coverage` | Jalankan tests dengan coverage report |
| `lint` | `pnpm run lint` | Cek linting dengan ESLint |
| `typecheck` | `pnpm run typecheck` | Cek TypeScript types |

#### Database Scripts

| Script | Perintah | Deskripsi |
|--------|----------|-----------|
| `db:generate` | `pnpm run db:generate` | Generate migration files dari schema |
| `db:migrate` | `pnpm run db:migrate` | Apply migrations ke database |
| `db:seed` | `pnpm run db:seed` | Seed database dengan data sintetis |
| `db:cleanup` | `pnpm run db:cleanup` | Hapus data test dari database |

---

### Development Mode vs Production Mode

#### Development Mode (`pnpm run dev`)

- Hot Module Replacement (HMR) aktif
- Source maps tersedia untuk debugging
- Error messages lebih detail
- Tidak ada minifikasi/optimisasi
- Cocok untuk pengembangan sehari-hari

```bash
pnpm run dev
# Server berjalan di http://localhost:3000
```

#### Production Build (`pnpm run build` + `pnpm run preview`)

- Kode ter-minify dan ter-optimize
- Tree shaking menghapus kode tidak terpakai
- Server Side Rendering (SSR) siap produksi
- Output di folder `.output/`

```bash
# Build untuk production
pnpm run build

# Preview hasil build secara lokal
pnpm run preview
# Server berjalan di http://localhost:3000
```

---

### Database Operations

#### Generate Migrations

Setelah mengubah schema di `server/database/schema/`:

```bash
# Generate migration dari perubahan schema
pnpm run db:generate
```

Migration files akan dibuat di `drizzle/migrations/`

#### Apply Migrations

```bash
# Apply migrations ke database
pnpm run db:migrate
```

#### Push Schema Langsung (Development)

Untuk development, bisa langsung push schema tanpa migration:

```bash
npx drizzle-kit push
```

⚠️ **Perhatian:** Gunakan `db:migrate` untuk production, `push` hanya untuk development.

#### Seed Data

```bash
# Seed dengan data sintetis untuk testing
pnpm run db:seed
```

Data seed menggunakan faker untuk generate data sintetis (sesuai AGENTS.md - tidak ada data owner nyata).

#### Cleanup

```bash
# Hapus data test
pnpm run db:cleanup
```

---

### Testing

#### Unit Tests

```bash
# Jalankan semua unit tests
pnpm run test

# Jalankan tests dalam watch mode (development)
pnpm run test -- --watch

# Jalankan tests dengan coverage
pnpm run test:coverage
```

#### End-to-End Tests

```bash
# Install Playwright browsers (pertama kali)
npx playwright install

# Jalankan E2E tests
pnpm run test:e2e

# Jalankan E2E tests dengan UI mode
pnpm run test:e2e -- --ui

# Jalankan E2E burn-in tests
pnpm run test:e2e:burn-in
```

---

### Code Quality

#### Linting

```bash
# Cek linting issues
pnpm run lint

# Auto-fix linting issues
pnpm run lint -- --fix
```

#### TypeScript Check

```bash
# Cek TypeScript errors
pnpm run typecheck
```

---

### Verifikasi Build Sebelum Deploy

Sebelum deploy ke Vercel, pastikan:

```bash
# 1. Cek TypeScript
pnpm run typecheck

# 2. Cek Linting
pnpm run lint

# 3. Jalankan Tests
pnpm run test

# 4. Build Production
pnpm run build

# 5. Preview Production Build
pnpm run preview
```

Jika semua langkah berhasil tanpa error, aplikasi siap deploy.

---

## Git Workflow & Branch Strategy

Project ini menggunakan Git Flow dengan struktur branch:

```
main (production)
  └── develop (staging)
        └── feature/epic-2 (current development)
```

### Current Branch: `feature/epic-2`

Branch ini berisi implementasi:
- Story 2.1: MoM MRO/RUPS Tulis Langsung
- Story 2.2: Upload PDF MoM & Preview Web via Signed URL
- Story 2.3: CMS Harga Saham dengan riwayat

### Push ke GitHub

```bash
# Pastikan di branch feature/epic-2
git checkout feature/epic-2

# Add dan commit perubahan
git add .
git commit -m "feat(epic-2): complete story 2.2 PDF upload & preview"

# Push ke remote
git push -u origin feature/epic-2
```

---

## Migrasi Database ke Supabase

### 1. Buat Project Supabase Baru

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Klik **"New Project"**
3. Isi:
   - **Name:** `snd-dash` (atau nama pilihan)
   - **Database Password:** Buat password kuat, simpan di tempat aman
   - **Region:** Pilih terdekat (misal: `ap-northeast-1` untuk Asia)
4. Klik **"Create new project"**
5. Tunggu hingga project selesai dibuat (~2 menit)

### 2. Dapatkan Connection String

1. Di Supabase Dashboard → **Settings** → **Database**
2. Scroll ke **Connection string** → **URI**
3. Pilih **Transaction Pooler** (port 6543) untuk aplikasi serverless
4. Copy connection string:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### 3. Update Environment Variables

Edit file `.env` di root project:

```env
# Database (gunakan Transaction Pooler untuk serverless)
NUXT_DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### 4. Jalankan Migrasi Schema

Dari root folder project:

```bash
npx drizzle-kit push
```

Output yang diharapkan:
```
[✓] Pulling schema from database...
[✓] Changes applied
```

### 5. Verifikasi Tabel

Di Supabase Dashboard → **Table Editor**, pastikan tabel berikut terbuat:
- `owners`
- `owner_bank_accounts`
- `owner_emergency_contacts`
- `coo_tenures`
- `moms`
- `price_periods`
- `rkap_phases`
- `capital_items`
- `rkap_adjustments`
- `audit_logs`
- `outbox_emails`

---

## Konfigurasi Supabase Storage

### 1. Buat Storage Bucket via Dashboard

1. Di Supabase Dashboard → **Storage**
2. Klik **"New bucket"**
3. Konfigurasi:
   - **Name:** `mom-pdfs`
   - **Public bucket:** ❌ **OFF** (PENTING!)
   - **File size limit:** `10485760` (10MB)
   - **Allowed MIME types:** `application/pdf`
4. Klik **"Create bucket"**

### 2. Alternatif: via SQL Editor

Di Supabase Dashboard → **SQL Editor** → **New query**:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mom-pdfs',
  'mom-pdfs',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
```

Klik **Run**.

### 3. Verifikasi Bucket

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'mom-pdfs';
```

Pastikan:
- `public` = `false`
- `file_size_limit` = `10485760`
- `allowed_mime_types` = `{application/pdf}`

---

## Setup Environment Variables

### 1. Dapatkan API Keys dari Supabase

Di Supabase Dashboard → **Settings** → **API**:

| Key | Deskripsi | Kegunaan |
|-----|-----------|----------|
| `Project URL` | https://[PROJECT-REF].supabase.co | NUXT_SUPABASE_URL |
| `service_role` | eyJhbGci... (panjang) | NUXT_SUPABASE_SERVICE_KEY |

⚠️ **PENTING:** `service_role` key memiliki akses penuh. JANGAN expose ke client!

### 2. Template .env Lengkap

```env
# === Authentication ===
AUTH_ORIGIN=https://your-domain.vercel.app/api/auth
NUXT_AUTH_SECRET=[GENERATE-32-CHAR-RANDOM-STRING]
NUXT_GOOGLE_CLIENT_ID=[YOUR-GOOGLE-CLIENT-ID]
NUXT_GOOGLE_CLIENT_SECRET=[YOUR-GOOGLE-CLIENT-SECRET]

# === Database (Supabase Transaction Pooler) ===
NUXT_DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# === Supabase Storage ===
NUXT_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NUXT_SUPABASE_SERVICE_KEY=[YOUR-SERVICE-ROLE-KEY]

# === Email (Resend) ===
NUXT_RESEND_API_KEY=[YOUR-RESEND-API-KEY]
NUXT_RESEND_FROM=noreply@yourdomain.com

# === Cron ===
NUXT_CRON_SECRET=[GENERATE-RANDOM-SECRET]
```

### 3. Generate Random Secrets

```bash
# NUXT_AUTH_SECRET (32 chars)
openssl rand -base64 32

# NUXT_CRON_SECRET
openssl rand -hex 16
```

---

## Deploy ke Vercel dari Feature Branch

### Metode 1: Deploy via GitHub URL (Recommended untuk Preview)

1. **Buka Vercel Dashboard**
   - Login ke [vercel.com](https://vercel.com)
   - Klik **"Add New..."** → **"Project"**

2. **Import dari GitHub**
   - Klik **"Import Git Repository"**
   - Pilih repository: `SipDipDO` (atau nama repo Anda)
   - Vercel akan auto-detect sebagai Nuxt project

3. **Configure Project**
   
   | Setting | Value |
   |---------|-------|
   | **Framework Preset** | Nuxt.js |
   | **Root Directory** | `snd-dash` |
   | **Build Command** | `pnpm run build` atau `npm run build` |
   | **Output Directory** | `.output` |
   | **Install Command** | `pnpm install` atau `npm install` |

4. **Select Branch untuk Deploy**
   - Di bagian **"Git"** → **"Production Branch"**
   - Ubah dari `main` ke `feature/epic-2`
   - Atau biarkan `main` dan gunakan Preview Deployments

5. **Set Environment Variables**
   
   Sebelum deploy, tambahkan semua environment variables (lihat [Setup Environment Variables](#setup-environment-variables))

6. **Deploy**
   - Klik **"Deploy"**
   - Tunggu build selesai (~3-5 menit)

### Metode 2: Deploy Branch Tertentu via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login ke Vercel
vercel login

# Deploy dari branch feature/epic-2
cd snd-dash
vercel --prod
```

### Metode 3: Preview Deployment (Setiap Push)

Vercel secara otomatis membuat Preview Deployment untuk setiap push ke branch non-production:

1. Push ke `feature/epic-2`:
   ```bash
   git push origin feature/epic-2
   ```

2. Vercel akan generate Preview URL:
   ```
   https://snd-dash-[hash]-[team].vercel.app
   ```

3. Cek Preview URL di:
   - GitHub PR → Vercel bot comment
   - Vercel Dashboard → Deployments tab

### Konfigurasi Branch di Vercel

1. **Settings** → **Git** → **Production Branch**
   - Set ke `main` untuk production
   - `feature/epic-2` akan otomatis jadi Preview

2. **Settings** → **Git** → **Ignored Build Step** (opsional)
   - Untuk skip build pada branch tertentu:
   ```bash
   if [ "$VERCEL_GIT_COMMIT_REF" == "develop" ]; then exit 0; fi
   ```

### Environment per Branch

Di Vercel, Anda bisa set environment berbeda per deployment type:

| Variable | Production | Preview | Development |
|----------|------------|---------|-------------|
| `AUTH_ORIGIN` | `https://snd.yourdomain.com` | `https://snd-xxx.vercel.app` | `http://localhost:3000` |
| `DATABASE_URL` | Production DB | Staging DB | Local DB |

Untuk set Preview-specific env:
1. **Settings** → **Environment Variables**
2. Pilih **"Preview"** checkbox saat menambah variable

### 2. Set Environment Variables di Vercel

Di Vercel Project → **Settings** → **Environment Variables**:

Tambahkan semua variabel dari `.env`:

| Key | Environment |
|-----|-------------|
| `AUTH_ORIGIN` | Production, Preview |
| `NUXT_AUTH_SECRET` | Production, Preview |
| `NUXT_GOOGLE_CLIENT_ID` | Production, Preview |
| `NUXT_GOOGLE_CLIENT_SECRET` | Production, Preview |
| `NUXT_DATABASE_URL` | Production, Preview |
| `DATABASE_URL` | Production, Preview |
| `NUXT_SUPABASE_URL` | Production, Preview |
| `NUXT_SUPABASE_SERVICE_KEY` | Production, Preview |
| `NUXT_RESEND_API_KEY` | Production |
| `NUXT_RESEND_FROM` | Production |
| `NUXT_CRON_SECRET` | Production |

### 3. Deploy

1. Klik **"Deploy"**
2. Tunggu build selesai (~3-5 menit)
3. Akses URL deployment untuk verifikasi

### 4. Setup Custom Domain (Opsional)

1. Di Vercel Project → **Settings** → **Domains**
2. Tambahkan domain custom
3. Update DNS records sesuai instruksi Vercel
4. Update `AUTH_ORIGIN` dengan domain baru

---

## Merge ke Main & Production Deploy

### Setelah Testing di Preview

1. **Buat Pull Request**
   ```bash
   # Di GitHub, buat PR dari feature/epic-2 ke develop (atau main)
   ```
   
   Atau via GitHub CLI:
   ```bash
   gh pr create --base develop --head feature/epic-2 \
     --title "feat(epic-2): Story 2.1-2.3 MoM, Harga, PDF Upload" \
     --body "Implements Epic 2 Stories 2.1-2.3"
   ```

2. **Review & Merge**
   - Review code changes
   - Pastikan CI/CD checks pass
   - Merge PR

3. **Production Deploy**
   - Merge dari `develop` ke `main` akan trigger production deploy
   - Atau manual promote dari Vercel Dashboard

### Rollback jika Bermasalah

```bash
# Via Vercel CLI
vercel rollback

# Atau di Dashboard: Deployments → pilih deployment sebelumnya → Promote to Production
```

---

## Verifikasi Deployment

### Checklist Post-Deployment

- [ ] Homepage dapat diakses
- [ ] Login Google OAuth berfungsi
- [ ] Halaman MoM dapat diakses (setelah login)
- [ ] Upload PDF MoM berfungsi (COO)
- [ ] Preview PDF MoM berfungsi
- [ ] Halaman Harga dapat diakses
- [ ] API endpoints merespons dengan benar

### Test Endpoints

```bash
# Health check
curl https://your-domain.vercel.app/api/health

# Landing (authenticated)
curl https://your-domain.vercel.app/api/landing \
  -H "Cookie: [session-cookie]"
```

---

## Troubleshooting

### Error: "NUXT_SUPABASE_URL dan NUXT_SUPABASE_SERVICE_KEY wajib dikonfigurasi"

**Penyebab:** Environment variables belum diset di Vercel.

**Solusi:**
1. Buka Vercel Dashboard → Project → Settings → Environment Variables
2. Pastikan `NUXT_SUPABASE_URL` dan `NUXT_SUPABASE_SERVICE_KEY` ada
3. Centang **Production** dan **Preview** environments
4. Redeploy: Deployments → Redeploy

### Error: Database Connection Failed

**Penyebab:** Connection string salah atau password belum diset.

**Solusi:**
1. Verifikasi password di Supabase Dashboard → Settings → Database
2. Pastikan menggunakan port `6543` (Transaction Pooler) untuk serverless
3. Cek region di connection string
4. Pastikan `DATABASE_URL` dan `NUXT_DATABASE_URL` keduanya diset

### Error: Storage Bucket Not Found

**Penyebab:** Bucket `mom-pdfs` belum dibuat di Supabase.

**Solusi:**
Ikuti langkah [Konfigurasi Supabase Storage](#konfigurasi-supabase-storage).

### Error: OAuth Callback Failed

**Penyebab:** `AUTH_ORIGIN` tidak sesuai dengan domain deployment.

**Solusi:**
1. Update `AUTH_ORIGIN` di Vercel environment variables
2. Untuk Preview deployments, gunakan Vercel preview URL
3. Update Authorized redirect URIs di [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Add: `https://snd-dash-xxx.vercel.app/api/auth/callback/google`
4. Redeploy

### Error: Vercel Build Failed

**Penyebab:** Dependency atau TypeScript errors.

**Solusi:**
1. Cek build logs di Vercel Dashboard → Deployments → Failed deployment
2. Jalankan build lokal untuk debug:
   ```bash
   cd snd-dash
   pnpm run build
   ```
3. Fix errors dan push ulang

### Error: Root Directory Not Found

**Penyebab:** Vercel tidak menemukan folder `snd-dash`.

**Solusi:**
1. Vercel Project → Settings → General → Root Directory
2. Set ke `snd-dash`
3. Redeploy

### Error: Preview Deploy Tidak Jalan

**Penyebab:** Branch belum di-push atau Vercel belum connected.

**Solusi:**
1. Pastikan branch sudah di-push ke GitHub:
   ```bash
   git push origin feature/epic-2
   ```
2. Cek Vercel Dashboard → Git → Connected repository
3. Pastikan GitHub App permissions sudah diberikan

### Preview URL Berbeda dengan Production

**Ini Normal!** Vercel membuat URL unik untuk setiap preview:
- Preview: `https://snd-dash-abc123-team.vercel.app`
- Production: `https://snd-dash.vercel.app` atau custom domain

Untuk OAuth, tambahkan semua callback URLs yang diperlukan di Google Console.

---

## Referensi

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Nuxt 3 Deployment](https://nuxt.com/docs/getting-started/deployment)

---

*Dokumen ini dibuat sebagai bagian dari implementasi Epic 2 Story 2.2 (Upload PDF MoM & Preview Web via Signed URL).*
