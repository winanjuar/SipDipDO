---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-16'
storyId: '1.2'
storyKey: '1-2-autentikasi-akun-google-halaman-login'
storyFile: '_bmad-output/implementation-artifacts/spec-1-2-autentikasi-akun-google-halaman-login.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-2-autentikasi-akun-google-halaman-login.md'
generatedTestFiles:
  - 'tests/e2e/landing.api.spec.ts'
  - 'tests/e2e/auth-landing.spec.ts'
  - 'shared/domain/identity.test.ts'
  - 'server/domain/identity/access.service.test.ts'
  - 'tests/support/helpers/sesi-minting.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-1-2-autentikasi-akun-google-halaman-login.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/framework-setup-progress.md'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/factories/owner-factory.ts'
  - 'tests/support/fixtures/cleanup.ts'
  - 'tests/support/helpers/test-ids.ts'
  - 'tests/e2e/health.api.spec.ts'
  - 'tests/e2e/smoke.ui.spec.ts'
  - 'server/domain/identity/owner.repo.ts'
  - 'server/domain/identity/registration.service.ts'
  - 'server/utils/api-error.ts'
  - 'resources/knowledge/playwright-utils-mandate.md'
  - 'resources/knowledge/auth-session.md'
  - 'resources/knowledge/data-factories.md'
  - 'resources/knowledge/test-quality.md'
---

# ATDD Checklist — Story 1.2 Autentikasi Akun Google & Halaman Login

## Step 1 — Preflight & Konteks

### Stack Detection

- `test_stack_type: auto` → terdeteksi **fullstack**: `package.json` Nuxt 4 (Vue + SSR) + `server/` API + `playwright.config.ts` + `vitest.config.ts`.
- Prasyarat terpenuhi: story `ready-for-dev` dengan AC jelas; Playwright config ada; dev environment tersedia (webServer `nuxt dev` + Supabase lokal Docker per framework-setup-progress).

### Story Context

- **story_id:** 1.2 · **story_key:** `1-2-autentikasi-akun-google-halaman-login`
- **Sumber AC:** seksi "Tasks & Acceptance" + "I/O & Edge-Case Matrix" spec (frozen-after-approval).
- **Kontrak test design:** `1-UNIT-001` (subset — predikat role/landing), `1-E2E-002` (subset — navigasi per role), R-003 (session minting triple-guard, blocker #2 test-design-architecture — dikonfirmasi user 2026-09-16).

### Kerangka & Pola yang Ada

- Entry point `test` = `tests/support/merged-fixtures.ts` (mandate: spec DILARANG impor `test` dari `@playwright/test`).
- `auth-fixture.ts`: AuthProvider NuxtAuth 6 member lengkap; `manageAuthToken` masih stub sesi-kosong + TODO — dipasangkan dengan endpoint `/api/test/login` Story 1.2; nama cookie `next-auth.session-token` belum terverifikasi.
- `owner-factory.ts`: faker id_ID, sintetis, enum status AD-11; helper seeding menyusul.
- `cleanup.ts`: fixture `cleanup.track()` auto balik-urutan.
- `test-ids.ts`: pusat konstanta data-testid; badge by role/text (UX-DR4).
- Spec acuan: `health.api.spec.ts` (apiRequest + zod + log.step G/W/T), `smoke.ui.spec.ts` (intercept-declare→goto→await, recurse hidrasi, by-role).
- Unit: Vitest, scope `shared/**/*.test.ts` + `server/**/*.test.ts`; threshold perFile `shared/domain` 90/90/95/95.

### TEA Config Flags

- `tea_use_playwright_utils: true` → mandate AKTIF (apiRequest/intercept/recurse/log/mergeTests wajib; deviation harus dicatat).
- `tea_use_pactjs_utils: true` → gerbang relevansi: repo satu aplikasi (bukan microservices), tidak ada contract test di test design story ini → fragmen Pact TIDAK dimuat, tidak menambah contract test.
- `tea_pact_mcp: none` → pact-mcp.md tidak dimuat.
- `tea_browser_automation: auto` → CLI/MCP hanya bila recording diperlukan (tidak — mode AI generation).

### Peta Test → AC Story 1.2 (dari spec + test design)

| # | Skenario (sumber AC) | Level | Test ID terkait | Red-phase karena |
|---|---|---|---|---|
| 1 | `resolveRole` precedence COO > pemegang saham > tanpa saham/keluar > calon per status; unlinked | Unit (Vitest) | 1-UNIT-001 subset | `shared/domain/identity.ts` + `access.service.ts` belum ada |
| 2 | 401 envelope `/api/landing` tanpa sesi | API (E2E runner) | 1-E2E-002 / R-003 | endpoint belum ada |
| 3 | Redirect SSR halaman terproteksi tanpa sesi → `/login` | E2E | AC "sesi berakhir" | middleware `auth-guard` belum ada |
| 4 | Halaman login: lockup logo 80px + tagline + satu CTA Google | E2E | AC 1 / UX-DR3/DR15 | `login.vue` belum ada |
| 5 | Landing per role via sesi minted (COO→antrian-beli, pemegang→dashboard, tanpa saham/keluar→personal) | E2E | 1-E2E-002 | `/api/test/login` + resolver landing belum ada |
| 6 | Calon owner → `/status-pendaftaran` badge + alasan; non-calon buka langsung → redirect | E2E | AC calon owner | halaman + endpoint status belum ada |
| 7 | `unlinked` → `/login?state=unlinked` + pesan arahan verbatim | E2E | AC 2 / UX-DR15 | resolver + pesan belum ada |

## Step 2 — Generation Mode

- **Mode: AI Generation.** AC jelas & terukur, skenario standar (auth, navigasi, API envelope, halaman kerangka), tidak ada interaksi UI kompleks yang butuh recording. Recording (CLI/MCP) tidak diperlukan.

## Step 3 — Test Strategy

### Pemetaan AC → Skenario → Level → Prioritas

Anti-duplikasi (test-design-qa): matematika/prediksi role HANYA di Unit; orkestrasi sesi+redirect di E2E/API; tidak ada asersi logika di dua level.

| # | Skenario (AC) | Level | Prioritas | Test ID | Alasan level |
|---|---|---|---|---|---|
| 1 | `resolveRole`: precedence COO aktif > pemegang saham (`first_effective_at`) > tanpa saham/`keluar` > calon (`diajukan`/`ditolak`/`kedaluwarsa`); email unlinked | Unit (Vitest, `shared/domain` + service murni DI) | P1 | 1-UNIT-001 subset | Predikat kanonik murni — edge case termurah & paling presisi di unit |
| 2 | `GET /api/landing` tanpa sesi → 401 envelope `{code,message,details}` | API (spec API E2E-runner) | **P0** | R-003 / verifikasi story | Kontrak otorisasi route handler (AD-8) — jalur inti otorisasi |
| 3 | `/dashboard`|`/personal`|`/antrian-beli`|`/status-pendaftaran` SSR tanpa sesi → redirect `/login` | E2E | **P0** | R-003 matriks keterbukaan — kegagalan = blok rilis |
| 4 | Halaman login publik: lockup logo 80px terpusat + tagline verbatim + SATU CTA Google | E2E | P1 | AC 1 / UX-DR3/DR15 | Kontrak visual perjalanan masuk — perjalanan kritis |
| 5 | Landing per role via sesi minted: COO→`/antrian-beli`, pemegang saham→`/dashboard`, tanpa saham & `keluar`→`/personal` | E2E | P1 | 1-E2E-002 subset | Perjalanan kritis ujung-ke-ujung (sesi cookie → SSR redirect) |
| 6 | Calon owner → `/status-pendaftaran`: badge teks per status + alasan penolakan; non-calon buka URL langsung → redirect landing role-nya | E2E | P1 | AC calon owner / keputusan pengguna #2 | Journey calon owner + proteksi silang |
| 7 | Email tak terhubung → kembali `/login?state=unlinked` + pesan arahan verbatim | E2E | P1 | AC 2 / UX-DR15 | Perjalanan negatif dengan kontrak teks verbatim |

Tidak masuk scope ATDD story ini (sesuai Never/boundary): OTP/MFA, halaman pendaftaran, audit trail, tabel `positions`, item navigasi (Story 1.7), smoke-test OAuth Google asli (tetap smoke AR-3 manual sekali jalan).

### Red Phase Requirements

- Semua test DIRANCANG GAGAL sebelum implementasi (red), lulus setelah Story 1.2 di-build (green):
  - Unit: impor `shared/domain/identity` & `server/domain/identity/access.service` yang belum ada → gagal kompilasi/asersi.
  - API/E2E: endpoint `/api/landing`, `/api/pendaftaran/status`, `/api/test/login`, middleware `auth-guard`, halaman `login/dashboard/personal/antrian-beli/status-pendaftaran` belum ada → 404/timeout/redirect salah.
- Red phase TIDAK boleh merusak suite lama: spec baru di file baru; `auth-fixture.ts` JANGAN diubah pada red-phase (pemrogram yang mengisi `manageAuthToken` saat green); nama cookie tetap TODO terverifikasi.
- Fixture session minting menunggu `/api/test/login` → spec landing per-role red-phase memakai helper `mintSession` yang melempar error eksplisit "endpoint belum ada (Story 1.2)" bila 404 — bukan skip, melainkan kegagalan jujur yang berubah hijau saat endpoint ada.

## Step 4 — Generasi Red-Phase (TDD RED)

- **Eksekusi:** mode `subagent` paralel — Worker A (API) + Worker B (E2E), keduanya sukses; agregasi + verifikasi kepatuhan RED lulus (semua `test.skip()`, tanpa asersi placeholder, tanpa banned pattern mandate).
- **Total: 26 test skipped** — API 8 (`tests/e2e/landing.api.spec.ts`), E2E 9 (`tests/e2e/auth-landing.spec.ts`), Unit Vitest 9 (`shared/domain/identity.test.ts` 2 + `server/domain/identity/access.service.test.ts` 7; unit = peluasan terdokumentasi di luar scope worker, sesuai strategi Step 3 / kontrak `1-UNIT-001`).
- **Infrastruktur pendukung dibuat:** `tests/support/helpers/sesi-minting.ts` (helper `mintSesiPemilik` → POST `/api/test/login`, error jujur saat endpoint belum ada), penambahan `TEST_IDS.login.*` & `TEST_IDS.statusPendaftaran.*` di `tests/support/helpers/test-ids.ts`.
- **Red-phase tidak merusak suite:** `npm test` → 37 lulus + 9 skipped; `npx playwright test --list` → 57 test terkoleksi; `npm run typecheck` bersih; eslint file baru 0 temuan (160 temuan eslint adalah pre-existing di proyek referensi lama `snd-dash/`, bukan dari ATDD ini).
- Unit scaffold memakai **impor dinamis non-literal** (`await import(MODUL)`) agar TS2307 "module not found" tidak merusak `typecheck` selagi modul belum ada; pelepasan skip → import gagal = merah jujur. Ganti ke impor statis setelah modul ditulis (opsional).

### Aktivasi per tugas (green phase)

1. Lepas `test.skip()` HANYA pada test milik tugas yang sedang dikerjakan.
2. Jalankan test → buktikan MERAH dulu (komentar "GAGAL saat red" di tiap test menjelaskan mode kegagalannya), lalu implementasikan tugas sampai HIJAU.
3. `npm test` (unit) untuk tugas `shared/domain` & `access.service`; `npx playwright test tests/e2e/landing.api.spec.ts` / `auth-landing.spec.ts` (butuh Supabase lokal + `nuxt dev` via webServer; env `ENABLE_TEST_AUTH` + `TEST_AUTH_SECRET` untuk endpoint minting).
4. Commit test hijau bersama implementasinya.

### Playwright Utils deviations (roll-up dari kedua worker)

| File | Lokasi | Deviasi | Alasan |
|---|---|---|---|
| `tests/e2e/auth-landing.spec.ts` | semua test bersesi | injeksi cookie eksplisit `context.addCookies(mintSesiPemilik(...))` alih-alih fixture `authToken` | `manageAuthToken` masih stub sesi-kosong (Story 1.2 yang mengisinya); wiring ke `/api/test/login` = fixture need green phase |
| `tests/e2e/landing.api.spec.ts` | test redirect non-calon | asersi status `[302,307]` saja tanpa header `location` | `apiRequest` tidak mengekspos header respons; target `/dashboard` dikunci komentar kontrak |
| `tests/e2e/landing.api.spec.ts` | test minting | kontrak body `{ cookies: [...] }` (storage-state) diasumsikan via zod schema | `Set-Cookie` tidak terekspos `apiRequest`; kontrak ini yang dikonsumsi `manageAuthToken` |
| `tests/e2e/landing.api.spec.ts` | test redirect | Playwright mengikuti redirect otomatis (maxRedirects tak diekspos) — 302 bisa terbaca 200 saat green | sesuaikan transport saat menghijaukan |

### Fixture needs untuk green phase (dari kedua worker)

1. `tests/support/auth-fixture.ts` — isi `manageAuthToken` dengan POST `/api/test/login` (mint cookie NuxtAuth per `authOptions.userIdentifier`: `coo` | `unlinked` | `calon-ditolak` | `pemegang-saham`, dst.).
2. Verifikasi nama cookie `next-auth.session-token` (varian `__Secure-` saat https) — TODO sinkron di `auth-fixture.ts` dan `landing.api.spec.ts`.
3. Env dev: `ENABLE_TEST_AUTH` + `TEST_AUTH_SECRET` (fallback `'test-secret-lokal'` harus identik dengan runtime lokal); tambahkan ke `.env.example` (tugas story).
4. Kontrak pembersihan owner sintetis hasil seed `/api/test/login` → `cleanup.track()`.

### Hal yang sengaja TIDAK diotomasi

- OAuth Google asli (klik CTA, callback sukses/error) → tetap smoke manual AR-3 (label CTA belum dipinkan; OAuth live tidak didorong headless) — tercatat di header `auth-landing.spec.ts`.

## Step 5 — Validasi & Kelengkapan

### data-testid yang wajib ditambahkan DEV (dipinkan oleh scaffold)

Konstanta sudah terdaftar di `tests/support/helpers/test-ids.ts`; halaman implementasi harus memasang atributnya:

| data-testid | Halaman/komponen | Elemen |
|---|---|---|
| `login-brand-logo` | `app/pages/login.vue` | Lockup logo `BrandLogo` varian 80px terpusat |
| `login-cta-google` | `app/pages/login.vue` | Tombol CTA Google tunggal (aseri kehadiran via role; testid sebagai penanda tambahan) |
| `login-pesan-unlinked` | `app/pages/login.vue` | Blok pesan arahan verbatim saat `?state=unlinked` |
| `status-badge` | `app/pages/status-pendaftaran.vue` | Badge status (Diajukan/Terverifikasi/Ditolak/Kedaluwarsa) — asersi by TEXT, bukan warna (UX-DR4) |
| `status-alasan-penolakan` | `app/pages/status-pendaftaran.vue` | Blok alasan penolakan apa adanya |

### Pemetaan tugas story → test untuk diaktifkan

| Tugas story (spec) | Test yang dilepas skip-nya | Perintah |
|---|---|---|
| `shared/domain/identity.ts` + test | `shared/domain/identity.test.ts` (2) | `npx vitest run shared/domain/identity.test.ts` |
| `access.service.ts` (resolveRole/buildPrincipal) | `server/domain/identity/access.service.test.ts` (7) | `npx vitest run server/domain/identity/access.service.test.ts` |
| `server/api/test/login.post.ts` (minting) | landing.api: mint sukses + guard (2) | `npx playwright test tests/e2e/landing.api.spec.ts` |
| `server/api/landing.get.ts` + `pendaftaran/status.get.ts` + `auth-guard.ts` | landing.api: 401 envelope ×2, COO, unlinked, ditolak, redirect (6) | `npx playwright test tests/e2e/landing.api.spec.ts` |
| `login.vue` + `BrandLogo` + `index.vue` resolver | auth-landing: root→login lockup, terproteksi→login (2) | `npx playwright test tests/e2e/auth-landing.spec.ts` |
| Halaman kerangka + `status-pendaftaran.vue` | auth-landing: landing per role, badge+alasan, non-calon, diajukan/kedaluwarsa, unlinked (7) | `npx playwright test tests/e2e/auth-landing.spec.ts` |

### Mock requirements

**N/A** — tidak ada layanan eksternal yang di-mock: session minting = endpoint in-app dev-only; OAuth Google asli tidak diotomasi (smoke manual AR-3); email/Resend belum tersentuh story ini.

### Catatan penyimpangan struktur & estimasi

- API spec berada di `tests/e2e/` (bukan `tests/api/`) — `playwright.config.ts` testDir `./tests/e2e`; konvensi repo mengikuti `health.api.spec.ts`.
- Estimasi upaya green phase (aktifasi + implementasi per pemetaan di atas): unit & kontrak API ≈ 0,5–1 hari; endpoint minting + middleware ≈ 0,5 hari; halaman UI + E2E hijau ≈ 1–1,5 hari — total ≈ 2–3 hari kerja (satu story lintas lapis).
- Sesi CLI/browser: tidak ada yang terbuka (mode AI generation). Artefak temp worker di `/tmp` sesuai kontrak workflow; artefak permanen seluruhnya di `_bmad-output/test-artifacts/`.
