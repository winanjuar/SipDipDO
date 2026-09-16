---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-09-16'
workflowStatus: 'COMPLETE'
framework: 'Playwright'
---

# Test Framework Setup — Progress

## Step 1: Preflight Checks (2026-09-16)

### Stack Detection

- `test_stack_type` = `auto` (config `_bmad/tea/config.yaml`) → auto-detection dijalankan.
- Hasil pemindaian manifest:
  - **Mobile**: tidak ada indikator (`.maestro/`, `app.json`, `Podfile`, `pubspec.yaml`, `*.xcodeproj` — bersih).
  - **Backend**: tidak ada manifest backend terpisah (`pyproject.toml`, `pom.xml`, `go.mod`, `Gemfile`, `Cargo.toml` — bersih; `.venv` milik tooling BMAD, bukan kode aplikasi).
  - **Frontend**: `package.json` (vue, nuxt), `nuxt.config.ts`, `vitest.config.ts` ✓.
- **`{detected_stack}` = `frontend`** (Nuxt 4 monolith; server routes via Nitro bagian dari app yang sama — tidak ada manifest backend terpisah).

### Validasi Prerequisite (frontend)

| Prasyarat | Status |
|---|---|
| `package.json` ada di root | ✓ (`snd-dash` v0.1.0, `type: module`, Node >= 22.19.0) |
| Tidak ada E2E framework eksisting (`playwright.config.*`, `cypress.config.*`, `cypress.json`) | ✓ (bersih) |

### Konteks Proyek

- **Framework**: Nuxt 4.5.2 (Vue 3.5, TypeScript, SSR) — bundler **Vite** (via Nuxt).
- **Testing eksisting**: Vitest 5.0.1 (devDependencies, script `test`) — unit/integrasi saja; **belum ada framework E2E**.
- **Auth**: `@sidebase/nuxt-auth` 1.3.1 + `next-auth` 4.21.1 (OAuth Google) — relevan untuk fixture auth E2E.
- **Stack pendukung**: Drizzle ORM 0.45.2 + `postgres` 3.4.9 (Supabase PostgreSQL 17), `@vite-pwa/nuxt` 1.1.1, shadcn-vue (`shadcn-nuxt` 2.8.2, `reka-ui`), ECharts 6.1.0, `decimal.js` 10.6.0, Resend 6.28.1.
- **Dokumen konteks ditemukan**:
  - `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md` (invariant AD-1..AD-12)
  - `_bmad-output/test-artifacts/test-design-architecture.md`, `test-design-qa.md` (gerbang test design — sudah lulus)
  - `_bmad-output/test-artifacts/test-design/snd-dash-handoff.md` — menegaskan urutan: **TEA Framework (workflow ini) dijalankan sebelum/di awal Build**; smoke R-005 (NuxtAuth + PWA + shadcn-vue) lulus sebagai gerbang Story 1.1.
- **Catatan penting dari test design**: rekomendasi `data-testid` (UX-DR10–13) untuk komponen transaksional; badge status asersi by role/text (UX-DR4); uji waktu fixed-clock zona Asia/Jakarta (R-008); kontrak uji string desimal (R-010).

### Kesimpulan

Preflight **LULUS** — proyek siap untuk scaffolding framework E2E. Lanjut ke Step 2 (pemilihan framework).

## Step 2: Framework Selection (2026-09-16)

### Logika Seleksi

- `{detected_stack}` = `frontend` → browser-based testing → default **Playwright** kecuali ada alasan kuat untuk Cypress.
- `config.test_framework` = `auto` → tidak ada override eksplisit; logika seleksi berjalan.

### Keputusan: **Playwright**

Justifikasi:

1. **Multi-browser dibutuhkan** — PWA (`SYS-E2E-001`, risiko R-006) harus diverifikasi lintas browser; Playwright punya dukungan Chromium/Firefox/WebKit bawaan tanpa biaya.
2. **Heavy API + UI integration** — test design didominasi skenario `*-API-*` (matrix akses, finalisasi atomik/konkurensi, cron fixed-clock) + `*-E2E-*`; `playwright.request` menangani keduanya dalam satu framework.
3. **CI parallelism penting** — gerbang kualitas "P0 epik 100%" dan target trace ≥80% P0/P1 menuntut eksekusi paralel cepat; Playwright worker sharding bawaan.
4. **Konfigurasi TEA** sudah mengaktifkan `tea_use_playwright_utils: true`.
5. **Component testing sudah tercakup Vitest 5** — argumen utama Cypress (Component Testing, DX tim kecil) tidak relevan.
6. Kompatibel dengan Nuxt 4/Vite; `@nuxt/test-utils` E2E memakai Playwright sebagai driver.

Cypress ditolak: kebutuhan multi-browser PWA, kombinasi API+UI, dan parallelism CI melebihi nilai DX-nya; component testing tidak dibutuhkan (Vitest).

Lanjut ke Step 3 (scaffolding framework).

## Step 3: Scaffold Framework (2026-09-16)

### 0. Execution Mode

- Config `tea_execution_mode` = `auto`; probe: subagent tersedia, agent-team tidak (tidak ada primitiv orkestrasi tim di runtime ZCode).
- Unit kerja A/B/C berantai dependensi ketat (install → config → fixtures → samples impor fixtures) dan seluruh fragment pengetahuan sudah termuat di konteks orkestrator → penjadwalan serial demi fidelitas mandate; kualitas/struktur output identik.

### 1. Gate Relevansi Pact — TIDAK TERBUKA (tanpa artefak Pact)

- Tidak ada `pact/`/`tests/contract/`; tidak ada `@pact-foundation/pact`; tidak ada `PACT_BROKER_*` di env/.env.example; bukan layout microservices; user tidak meminta contract testing.
- Sinyal lemah (Resend outbound) tidak terkorroborasi sinyal kedua; frontend memanggil backend sendiri dalam satu deployable Nuxt — disqualifier eksplisit gate.
- **Tidak ada artefak Pact yang dibuat**; workflow `framework` bisa menambahkannya nanti bila boundary nyata muncul.

### Pembersihan Prasyarat (di luar sesi step, atas persetujuan user)

- Duplikat bersarang `snd-dash/` (171 file, artefak commit 9d80f31 via PR #3, hanya di lineage `main`) dihapus: branch `hotfix/remove-nested-duplicate`, commit `20b4036`, ter-push. PR dibuat via tautan compare (gh CLI tidak terpasang). Scaffold dikerjakan di `feature/test-framework-scaffold` (dari `develop` — basis bersih).

### 2-3. Instalasi + Struktur + Config + Env (Worker A)

- **devDependencies baru** (persetujuan user "Install lengkap"): `@seontechnologies/playwright-utils@4.4.0`, `@playwright/test@1.63.0` (peer ≥1.54.1 ✓), `zod@4.6.5`, `@faker-js/faker@10.6.0`.
- **Direktori** (`{test_dir}` = `tests/`): `tests/e2e/`, `tests/support/fixtures/`, `tests/support/helpers/`, `tests/support/factories/`, `tests/scripts/`, `tests/config/`.
- **`playwright.config.ts`**: timeout aksi 15s / navigasi 30s / test 60s; baseURL fallback `BASE_URL ?? http://localhost:3000`; trace `retain-on-failure` (enum valid terdekat dari "retain-on-failure-and-retries" — nilai itu bukan enum Playwright yang valid), screenshot only-on-failure, video retain-on-failure; reporter list+HTML+JUnit; fullyParallel, retries CI 2 / lokal 1; 3 proyek browser (chromium/firefox/webkit — kontrak PWA); `webServer` menjalankan `npm run dev` bila BASE_URL kosong; locale id-ID, timezone Asia/Jakarta (AD-9).
- **`.nvmrc`**: `24` (node lokal 24.19.0).
- **`.env.example`**: seksi testing baru — `TEST_ENV`, `BASE_URL`, `API_URL`.
- **`.gitignore`**: `test-results/`, `playwright-report/`, `blob-report/`, `playwright-logs/`, `tests/support/auth-sessions/`, `.auth/` (default storageDir auth-session).
- **`package.json` scripts**: `test:e2e`, `test:e2e:burn-in`.
- **ESLint**: override `tests/**/*.ts` — `no-empty-pattern` off (fixture Playwright mewajibkan `async ({}, use)`).

### 4. Fixtures & Factories (Worker B)

- `tests/support/merged-fixtures.ts` — SATU entry point `test`: merge apiRequest + recurse + intercept + networkErrorMonitor + auth + cleanup; re-export `expect`, `log`.
- `tests/support/auth-fixture.ts` — AuthProvider 6 member lengkap + `getBaseUrl` (opsional; tanpa ini context custom auth-session kehilangan baseURL). TODO auth: `manageAuthToken` mengembalikan sesi kosong + warning (endpoint akuisisi token belum ada — OAuth Google/OTP Story 1.2/1.4+), nama cookie session `next-auth.session-token` belum terverifikasi. **Bukan fixture login form** (sesuai mandate).
- `tests/support/global-setup.ts` — authStorageInit → configureAuthSession → setAuthProvider (urutan fragment). Catatan: v4.4.0 pakai opsi `storageDir`, bukan `authStoragePath` (dokumen fragment usang); dan globalSetup berjalan di proses runner terpisah dari worker sehingga sesi efektif jatuh ke default `.auth/` — keduanya sudah ter-gitignore; tinjau ulang saat token nyata ada (Story 1.2).
- `tests/support/fixtures/cleanup.ts` — fixture auto: `cleanup.track(dispose)` dibalik-urutan setelah test.
- `tests/support/factories/owner-factory.ts` — faker locale id_ID, sintetis; kontrak mengikuti konvensi terdokumentasi owner.repo.ts (email UNIQUE AD-11; enum status `diajukan|terverifikasi|ditolak|kedaluwarsa|keluar`); varian komposisi `createPemegangTerverifikasi`/`createPemegangKeluar`. Helper seeding menyusul saat endpoint ada.
- `tests/config/burn-in.config.ts` + `tests/scripts/burn-in-changed.ts` — `runBurnIn` baseBranch `develop`.

### 5. Sample Tests & Helpers (Worker C)

- `tests/e2e/health.api.spec.ts` — sample API: apiRequest + validateSchema zod + log.step GIVEN/WHEN/THEN, endpoint nyata `/api/health`.
- `tests/e2e/smoke.ui.spec.ts` — sample UI: intercept-before-goto (dokumen `**/smoke`), data-testid via helper, interaksi by-role, dialog keyboard Enter/Escape + `recurse` untuk balapan hidrasi Vue, OTP sintetis faker, toast.
- `tests/support/helpers/test-ids.ts` — pusat konstanta testid (UX-DR4: badge by role/text; UX-DR10–13 menyusul per story).

### Verifikasi

- `playwright test --list`: 6 test (2 spec × 3 browser) ✓
- `eslint .` exit 0 ✓; `nuxt typecheck` ✓
- **Run nyata `--project=chromium`: 2 passed (3.6s)** — webServer boot `nuxt dev`, Supabase lokal hidup.
- Chromium headless terpasang (94MB); firefox/webkit menyusul (`npx playwright install`).

### Temuan Aplikasi (bukan cacat scaffold) — untuk pemilik Story/R-005

1. **DialogTrigger reka-ui tidak terbuka via pointer-click di chromium headless** (probe terpisah murni, tanpa error konsol; keyboard Enter bekerja; terjadi pula sebelum/di luar framework test). Smoke manual R-005 kemungkinan memakai mouse sungguhan — perlu investigasi pemilik story bila interaksi pointer penting.
2. Hidrasi Vue di dev-mode bisa lambat: asersi section lolos atas HTML SSR tanpa bukti hidrasi — sample memakai `recurse` untuk menunggu respons keyboard (pola canonical eventual-consistency).

### Playwright Utils Deviations

- Tidak ada di level spec: semua sample impor `test` dari merged-fixtures; tidak ada `page.route`/`waitForTimeout`/`console.log`/raw `request.<method>`.
- Adaptasi terdokumentasi: sample UI meng-intercept dokumen navigasi (`**/smoke`) alih-alih panggilan API aplikasi — sesi NuxtAuth diambil saat SSR sehingga tidak ada request browser yang bisa di-spy; pola intercept-before-goto tetap utuh dan berlaku begitu ada fetch client-side (Epic 1+).

## Step 4: Documentation & Scripts (2026-09-16)

### 1. tests/README.md

Dibuat (`{test_dir}/README.md`): setup (nvm/npm ci/playwright install/Supabase lokal), cara menjalankan (headless/headed/UI/debug/burn-in/report), arsitektur (merged-fixtures sebagai satu entry point, auth-fixture + TODO, factory sintetis, cleanup, test-ids), aturan mutlak mandate (larangan `page.route`/`waitForTimeout`/`console.log`/raw request, kontrak uang AD-10 di test), contoh acuan, catatan CI (reporter, sharding, gerbang P0), dokumentasi hook, referensi fragment + test design.

### 2. Scripts

`test:e2e` dan `test:e2e:burn-in` sudah ditambahkan pada Step 3 (Worker A).

### 3. Write-Time Enforcement Hook

- `.claude/hooks/tea-enforce.cjs` — salinan byte-for-byte dari skill (sha256 `faf4a92c…2d68`).
- `.tea/enforce-config.json` — gate: testGlobs = `tests/**/*.spec.{ts,js}` (Playwright) + `shared|server|app/**/*.test.ts` (Vitest co-located, selaras include vitest.config); pactConfigGlobs kosong (tanpa Pact); excludeGlobs kosong (tanpa k6); disabledRules kosong.
- `.claude/settings.json` — dibuat baru (sebelumnya hanya settings.local.json); PreToolUse `--pre`, PostToolUse `--post` (matcher Write|Edit|MultiEdit|Bash), Stop `--stop` — ketiganya teregistrasi.
- Aturan aktif: C2 (focused test — block), C3 (asersi tautologis — block), H1 (hard wait — block), H5 (file >1000 baris — block), C1 (test disabled — warn); H6/H8 ter-scope pactconfig (inert tanpa Pact); C4 khusus Maestro (inert).
- Catatan platform: hook ini adalah mekanisme Claude Code; ZCode (agent ini) tidak membaca `.claude/settings.json`, jadi jalur enforcement saat bekerja via ZCode tetap `bmad-testarch-test-review`.

## Step 5: Validate & Summarize (2026-09-16)

### Validasi checklist — hasil

| Kelompok | Hasil | Catatan |
|---|---|---|
| Prerequisites + Step 1-2 | ✓ | frontend terdeteksi; Playwright terpilih & diumumkan |
| Struktur direktori | ✓ | `support/factories/` di level support (mengikuti layout kanonik mandate/fixtures-composition) alih-alih `fixtures/factories/` — checklist menyatakan organisasi fleksibel, pola kunci `support/` terpenuhi; `page-objects/` sengaja belum (opsional) |
| Config Playwright | ✓ | timeout 15/30/60, baseURL fallback, reporter list+HTML+JUnit, parallel, CI retries/workers; trace `retain-on-failure` (enum valid terdekat — `retain-on-failure-and-retries` bukan enum Playwright yang valid; adaptasi terdokumentasi) |
| Env | ✓ | TEST_ENV/BASE_URL/API_URL di .env.example; .nvmrc 24 |
| Fixture architecture | ✓ | `merged-fixtures.ts` = index tunggal (penamaan mandate menimpa `fixtures/index.ts` checklist); mergeTests; auto-cleanup |
| Factories | ✓ | faker id_ID sintetis; tracking cleanup via fixture `cleanup` (helper seeding API menyusul bersama endpoint — terdokumentasi) |
| Sample tests | ✓ | 2 spec (API+UI), GWT, data-testid, intercept-before-goto; pemakaian owner-factory ditunda (belum ada endpoint tulis — jujur tercatat) |
| Helpers | ✓ | test-ids; API/network/auth tercakup fixture utils |
| Dokumentasi | ✓ | README lengkap termasuk Troubleshooting (ditambahkan pada step ini) |
| Scripts | ✓ | `test:e2e`, `test:e2e:burn-in` |
| Hook enforcement | ✓ | salinan byte-for-byte (sha256 tercatat), gate config glob stack terdeteksi saja, 3 hook teregistrasi, README menjelaskan sumber severity + cara menonaktifkan |
| Output validation | ✓ | config termuat; `eslint .` exit 0; `nuxt typecheck` ✓; **sample test dieksekusi nyata: 2 passed (chromium)** |
| TODO di file | By design | hanya TODO auth yang diamanatkan step (manageAuthToken + nama cookie) — dilaporkan di ringkasan |
| Playwright Utils Scaffold | ✓ | seluruh item seksi mandate lulus |
| Pact alignment | N/A | gate relevansi tertutup (lihat Step 3) |
| Keamanan | ✓ | tanpa kredensial; data owner sintetis (kebijakan repo) |

### Ringkasan Penyelesaian

- **Framework**: Playwright 1.63 + @seontechnologies/playwright-utils 4.4.0 (+zod 4.6.5, faker 10.6.0).
- **Artefak**: `playwright.config.ts`, `tests/{e2e,support/{fixtures,factories,helpers},config,scripts}/`, `.nvmrc`, `.env.example` (seksi testing), `.gitignore`, `eslint.config.mjs` (override tests), `package.json` (2 script + 4 devDeps), `.claude/hooks/tea-enforce.cjs` + `.claude/settings.json` + `.tea/enforce-config.json`, `tests/README.md`, dokumen progress ini.
- **Fragment diterapkan**: playwright-utils-mandate, overview, fixtures-composition, auth-session, api-request, recurse, log, intercept-network-call, network-error-monitor, data-factories, burn-in, pactjs-utils-mandate (gate relevansi).
- **Langkah lanjut user**: (1) commit di `feature/test-framework-scaffold` + PR ke `develop`; (2) `npx playwright install` untuk firefox/webkit; (3) merge PR hotfix penghapusan duplikat; (4) workflow berikutnya: `bmad-testarch-ci`, lalu `bmad-testarch-atdd` per story P0.

### Sign-off

- **Completed by**: TEA Master Test Architect (via ZCode)
- **Date**: 2026-09-16
- **Framework**: Playwright
- **Notes**: Temuan aplikasi R-005 (pointer-click DialogTrigger headless) + balapan hidrasi — lihat Step 3; jadi input story pemilik smoke page.
