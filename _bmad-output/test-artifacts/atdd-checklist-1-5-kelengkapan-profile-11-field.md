---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-18'
storyId: '1.5'
storyKey: '1-5-kelengkapan-profile-11-field'
storyFile: '_bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/SPEC.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-5-kelengkapan-profile-11-field.md'
generatedTestFiles: ['tests/e2e/profil.api.spec.ts', 'tests/e2e/redaftar.api.spec.ts', 'tests/e2e/cron-harian.api.spec.ts', 'tests/e2e/kelengkapan-profil.spec.ts', 'server/domain/identity/registration.service.expiry.test.ts']
inputDocuments:
  - '_bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/SPEC.md'
  - '_bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/profile-fields.md'
  - '_bmad-output/planning-artifacts/epics/epic-1.md'
  - '_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - 'playwright.config.ts'
  - 'package.json'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/factories/owner-factory.ts'
  - 'tests/support/helpers/sesi-minting.ts'
  - 'tests/support/helpers/test-ids.ts'
  - 'tests/e2e/register.api.spec.ts'
  - 'tests/e2e/register.spec.ts'
  - 'server/jobs/daily.post.ts'
  - 'server/domain/identity/registration.service.ts'
---

# ATDD Checklist — Story 1.5 Kelengkapan Profile 11 Field (in-progress)

> **STATUS: RESUMED.** Spesifikasi dibuat via bmad-spec:
> `_bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/` (SPEC.md +
> profile-fields.md; 6 CAP, verdict PASS). Sekarang menjadi `storyFile` utama.

## Step 1: Preflight & Context (selesai)

- **detected_stack:** `fullstack` (frontend Nuxt 4/Vue + backend `server/api` + Drizzle; tanpa indikator mobile)
- **Prasyarat:** story approved dengan AC jelas (epic-1.md Story 1.5, 4 blok AC); `playwright.config.ts` (testDir `./tests/e2e`, timeout 60s, 3 browser, locale `id-ID`, tz `Asia/Jakarta`); env dev tersedia
- **Story:** `storyId=1.5`, `storyKey=1-5-kelengkapan-profile-11-field`, sumber `_bmad-output/planning-artifacts/epics/epic-1.md` — **catatan: `spec-1-5-*.md` belum ada**; user memilih buat spec dulu sebelum lanjut
- **Acceptance criteria (4 blok):**
  1. Pendaftar `diajukan` login → halaman Kelengkapan Profile: field Lampiran A tampil + indikator langkah persis yang belum lengkap (UX-DR16), tanpa navigasi lain (UX-DR14). *Catatan: AC menyebut "11 field" tetapi daftar eksplisit berisi 10 (Nama Lengkap, Alias, Gmail, Nomor HP, Kontak Darurat, Nomor HP Kontak Darurat, Hubungan dengan Owner, Nama Bank, Pemilik Rekening, Nomor Rekening); field ke-11 (Referal) TIDAK diminta saat pendaftaran (FR-22 — diajukan saat Pembelian Pertama)*
  2. Profile belum lengkap mendekati hari ke-7 (kalender-hari Asia/Jakarta) → cron harian terproteksi CRON_SECRET: email pengingat H-3 via outbox (AR-6), hari ke-7 status → `kedaluwarsa` via compare-and-set + entry audit (AD-11; FR-22)
  3. Pendaftar `kedaluwarsa` mendaftar ulang email sama → transisi `kedaluwarsa → diajukan` pada baris owner yang SAMA via CAS (bukan baris baru) + tercatat audit (AD-11)
  4. Submit form gagal karena gangguan non-validasi → isian dipertahankan + toast "Tidak dapat menyimpan — coba lagi." (UX-DR19)
- **Framework & pola existing:** `tests/support/merged-fixtures.ts` (mergeTests apiRequest+recurse+intercept+networkError+auth+cleanup; spec impor `test` hanya dari sini); `tests/support/auth-fixture.ts` (provider NuxtAuth, sentinel `default` = anonim); `tests/support/helpers/sesi-minting.ts` (`mintSesiPemilik` — mint sesi via POST `/api/test/login` triple-guard, dukung override `status`); `tests/support/factories/owner-factory.ts` (faker `id_ID`, enum `StatusPemegang` 5 nilai termasuk `kedaluwarsa`); `TEST_IDS` (smoke/login/statusPendaftaran/pendaftaran/auditTrail — Story 1.5 akan menambah kontrak baru); acuan pola red-phase: `tests/e2e/register.api.spec.ts` + `tests/e2e/register.spec.ts` (Given-When-Then via `log.step`, zod `.validateSchema`, `test.skip()` + header asumsi kontrak, tanpa magic number)
- **Kondisi implementasi saat ini (red-state):**
  - `server/domain/identity/registration.service.ts` → `runRegistrationDailyJob` = **stub no-op** `{ reminded: 0, expired: 0 }` (komentar eksplisit: kedaluwarsa hari-7 + pengingat H-3 = Story 1.5); parameter `today: DayKey` sudah injectable (seam jam)
  - `server/jobs/daily.post.ts` SUDAH hijau: guard CRON_SECRET `timingSafeEqual` + delegasi ke `runRegistrationDailyJob` + `dispatchPendingOutboxEmails` (proofs, error-isolated)
  - Halaman Kelengkapan Profile BELUM ada di `app/pages/`; belum ada endpoint API profile
  - Sudah hijau & reusable: `POST /api/register` (idempotent per email), `GET /api/register/status`, audit read (COO), outbox proofs, sesi-minting dev-only
- **TEA flags:** `tea_use_playwright_utils=true` (mandate AKTIF, `@seontechnologies/playwright-utils@4.4.0` terinstal — kedua gerbang lolos), `tea_use_pactjs_utils=true` TETAPI gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices → tanpa contract test, konsisten `register.api.spec.ts`), `tea_pact_mcp=none`, `tea_browser_automation=auto`, `test_stack_type=auto`
- **Knowledge loaded (17 fragmen):** `playwright-utils-mandate` (substitusi wajib + banned patterns), `overview`, `api-request`, `auth-session`, `intercept-network-call`, `recurse`, `log`, `network-error-monitor`, `fixtures-composition`, `data-factories`, `test-quality`, `test-healing-patterns`, `component-tdd`, `selector-resilience`, `timing-debugging` (§ Fixtures Derived From the Live Clock → boundary hari-7/H-3 wajib fixed/injectable clock), `test-levels-framework`, `test-priorities-matrix`
- **Knowledge dilewati (tidak relevan story ini):** `file-utils` (tanpa unduhan), `network-recorder` (tanpa HAR offline), `ci-burn-in` (strategi CI, bukan scaffolding story), `playwright-cli` (bantuan debug dev, opsional)
- **Selaras test-design (`test-design-qa.md`):**
  - `1-API-003` (P1, R-008): pendaftaran — profil lengkap prasyarat verifikasi; kedaluwarsa 7 hari + pengingat; re-daftar CAS `kedaluwarsa→diajukan` baris sama (email unik)
  - `1-E2E-001` (P0, R-003): UJ-6 journey (tahap "lengkapi Profile" = milik story ini; verifikasi COO = Story 1.6)
  - `3-UNIT-006` (P1, R-008): helper kalender-hari Jakarta boundary hari-6/7/8 + H-3 — fixed clock (unit, `shared/domain/calendar`)
  - Boundary: cron memakai `jakartaDayKey(new Date())` — test API harus menyuntik `today` via body/kontrak job ATAU seed `submitted_at` relatif terhadap hari Jakarta berjalan (bukan fake-timer di server)
- **Playwright Utils deviations:** belum ada kode; mandate berlaku untuk scaffold red-phase

## Step 2: Generation Mode (selesai)

- **Mode:** AI generation (default). AC jelas (spec 6 CAP + 8 constraint, verdict PASS); skenario standar (form simpan, cron harian, CAS, gerbang navigasi, toast gagal).
- **Recording dilewati:** `tea_browser_automation=auto` mengizinkan CLI/MCP, tetapi halaman Kelengkapan Profile belum diimplementasikan (red-phase) — tidak ada UI untuk direkam; selektor dikunci dari kontrak `TEST_IDS` + pola spec existing.
- **Env terkonfirmasi (lokal):** `NUXT_CRON_SECRET=dev-cron-secret`, `ENABLE_TEST_AUTH=1`, `TEST_AUTH_SECRET=test-secret-lokal` — test cron memakai pola fallback env `process.env.NUXT_CRON_SECRET ?? 'dev-cron-secret'` (mengikuti pola `TEST_AUTH_SECRET` di `sesi-minting.ts`; nilai dev-only, bukan rahasia produksi).

## Step 3: Test Strategy (selesai)

- **primary_level:** API (logika cron + CAS + kontrak endpoint profil); E2E untuk halaman & gerbang navigasi; Unit (Vitest) untuk jalur eksekusi `runRegistrationDailyJob` dengan jam `today` injectable.

### CAP → skenario (tanpa duplikasi lintas level)

| # | CAP | Skenario | Level | Prioritas | Catatan dedup / red |
|---|-----|----------|-------|-----------|---------------------|
| 1 | CAP-1 | PUT `/api/profile` (asumsi kontrak) sesi `diajukan` + 10 field → 200, nilai tersimpan, `profileComplete=true` | API | P0 | Endpoint belum ada (red: 404 → schema fail) |
| 2 | CAP-1 | PUT tanpa sesi → 401 envelope seragam (AD-8) | API | P0 | Pola `register.api.spec.ts`; red 404 |
| 3 | CAP-2 | PUT kurang N field → 400 + details menyebut PERSIS field yang kurang | API | P1 | Pin indikator di kontrak wire; red |
| 4 | CAP-1 | PUT body berisi `referral` → 400 envelope | API | P1 | Mirror register (FR-22); red |
| 5 | CAP-1 | PUT oleh non-calon (`terverifikasi`) → 403 envelope | API | P1 | Hanya calon `diajukan` (red: 404) |
| 6 | CAP-1 | Persistensi: PUT lalu GET profil → nilai identik | API | P1 | Red (GET 404) |
| 7 | CAP-5 | POST `/api/register` pendaftar `kedaluwarsa` → 200, **id SAMA**, status `diajukan` (CAS) | API | P0 | Impl sekarang echo tanpa mutasi → red jujur; endpoint hijau |
| 8 | CAP-5 | POST kedua beruntun → 200 idempotent baris sama | API | P1 | AD-11 unique email; red bersama #7 |
| 9 | CAP-5 | Audit re-daftar terbaca COO via GET `/api/audit` (memuat email) | API | P1 | Baca audit hijau (reuse); sisi tulis merah |
| 10 | CAP-4 | Cron H-3: seed `diajukanPada`=hari−4 → run `/api/jobs/daily` → `reminded≥1` + `remindedEmails` memuat email + baris outbox (inspeksi `GET /api/test/outbox` dev-only baru, triple-guard) | API | P1 | Stub `{0,0}` tanpa field emails → schema fail = merah jujur |
| 11 | CAP-4 | Cron hari-7: seed hari−7 → status jadi `kedaluwarsa` + `expired≥1` + `expiredEmails` + audit | API | P1 | Red: status tetap `diajukan` |
| 12 | CAP-4 | Cron sebelum H-3 (hari−2): `remindedEmails=[]`, tanpa outbox, tanpa mutasi | API | P1 | Regression-guard; red via schema field emails |
| 13 | CAP-4 | Cron idempoten: run 2x di hari H-3 sama → outbox email itu tetap 1 baris | API | P1 | AD-11/AR-6; red |
| 14 | CAP-4 | Guard cron: tanpa/salah secret → 401 envelope | API | P2 | Endpoint hijau — regresi (hijau sejak ada) |
| 15 | CAP-1/2/3 | `/kelengkapan-profil` sesi `diajukan`: 10 field by-label, Gmail readonly prefilled, indikator menyebut field kosong persis, TANPA nav lain | E2E | P0 | Halaman belum ada (red); intercept dideklarasikan sebelum `page.goto` |
| 16 | CAP-1/2 | Isi & simpan → indikator lengkap; reload → nilai persisten | E2E | P0 | Journey kritis UJ-6 tahap profil |
| 17 | CAP-6 | Submit gagal non-validasi (stub 5xx profil): isian dipertahankan + toast verbatim "Tidak dapat menyimpan — coba lagi." | E2E | P1 | UX-DR19; `interceptNetworkCall fulfillResponse` |
| 18 | CAP-3 | URL langsung `/dashboard` oleh calon belum lengkap → dialihkan di batas server (final URL ≠ /dashboard) | E2E | P1 | AD-8/UX-DR14; redirect SSR belum ada → red |
| 19 | CAP-4 | Unit: job `today=reminderOn` → enqueue email pendaftar `diajukan` belum lengkap (repo/outbox mock) | Unit | P1 | Mock dipanggil oleh SUT — pola test-quality Ex.7 sah |
| 20 | CAP-4 | Unit: `today≥expiresOn` → CAS kedaluwarsa + audit in-tx; tidak dobel untuk sudah `kedaluwarsa` | Unit | P1 | AD-11; red |
| 21 | CAP-4 | Unit: pendaftar lengkap/status lain → tanpa aksi | Unit | P1 | Boundary kanonik; red via interaksi |

- **Component:** tidak ada — indikator diassert by-text/by-label di E2E; tidak ada perilaku komponen terisolasi baru.
- **Contract (Pact):** tidak ada — gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices).
- **Sudah hijau, TIDAK diduplikasi:** konstanta `registrationDeadline` + helper kalender (`calendar.test.ts`, `registration.service.test.ts`), idempotensi register dasar + no-referral + guard mint (`register.api.spec.ts`), baca audit (`audit.api.spec.ts`), badge status (`auth-landing.spec.ts`).
- **Kontrak test-infra baru (asumsi eksplisit):** (a) mint `/api/test/login` menerima override `diajukanPada` (DayKey ISO) untuk seeding backdated; (b) endpoint inspeksi dev-only `GET /api/test/outbox?email=` (triple-guard) untuk verifikasi baris outbox; (c) respons job `details.jobs.registration` memuat `remindedEmails`/`expiredEmails` (bukan hanya counter) — semua final saat green-phase.
- **Red-phase:** seluruh scaffold baru dirancang GAGAL sebelum implementasi (stub cron `{reminded:0,expired:0}` tanpa field emails → schema fail; endpoint/halaman 404). Scaffold ditulis `test.skip()` + panduan aktivasi.

## Step 4: Aggregate — TDD Red Phase (selesai)

- **Eksekusi:** SEQUENTIAL (fallback) — dispatch subagent gagal (`getaddrinfo ENOTFOUND api.z.ai`); fallback deterministik: orchestrator generate langsung mengikuti disiplin worker 4A/4B. Tanpa parallel speedup.
- **Validasi TDD:** PASS — 18 test Playwright memakai `test.skip()` + 3 unit memakai `it.skip()`; tanpa placeholder `expect(true).toBe(true)`; semua `expected_to_fail=true`. (Koreksi selama agregasi: 4 spec mula-mula `test(` aktif — dikonversi ke `test.skip(` sebelum selesai.)
- **Verifikasi:** `eslint` PASS (7 file); `nuxt typecheck` PASS (exit 0); `vitest run` unit = 3 skipped; `playwright test --list` = 54 collected (18 test × 3 browser), semua skip; tanpa CLI session yatim (recording dilewati).
- **File ditulis ke disk:**
  - `tests/e2e/profil.api.spec.ts` — 6 test API red-phase (endpoint Profil)
  - `tests/e2e/redaftar.api.spec.ts` — 3 test API red-phase (CAS kedaluwarsa→diajukan)
  - `tests/e2e/cron-harian.api.spec.ts` — 5 test API red-phase (cron H-3/hari-7 + guard)
  - `tests/e2e/kelengkapan-profil.spec.ts` — 4 test E2E red-phase (UI)
  - `server/domain/identity/registration.service.expiry.test.ts` — 3 unit red-phase (Vitest)
- **Fixture infrastructure:** `tests/support/helpers/test-ids.ts` DITAMBAH — `kelengkapanProfil.indikator: 'kelengkapan-indikator'` (satu-satunya kebutuhan baru; merged-fixtures/sesi-minting/owner-factory/cleanup sudah lengkap dari story sebelumnya).
- **Playwright Utils deviations:** nihil — nol `page.route`/`page.waitForResponse`/request mentah/`waitForTimeout`/`console.log` di badan kode; impor `test` hanya dari `../support/merged-fixtures`; `import type { Cookie } from '@playwright/test'` = type-only (sah, pola register.api.spec.ts).
- **Pact:** tanpa contract test — gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices).
- **Summary JSON:** `/tmp/tea-atdd-summary-2026-09-18T15-49-24.json` (total 21: API 14 — P0×3/P1×10/P2×1; E2E 4 — P0×2/P1×2; Unit 3 — P1×3).

## TDD Red Phase (saat ini)

✅ Scaffold red-phase tergenerasi — JANGAN hapus `test.skip()`/`it.skip()` kecuali untuk tugas yang sedang diimplementasikan.

- API: 14 test (semua skip) — profil.api / redaftar.api / cron-harian.api
- E2E: 4 test (semua skip) — kelengkapan-profil
- Unit: 3 test (semua skip) — registration.service.expiry.test.ts (Vitest)

## Cakupan AC (spec CAP)

- CAP-1 (simpan profil): API P0×2 + P1×1, E2E P0×1
- CAP-2 (indikator persis): API P1×1 (pin di wire), E2E P0×2
- CAP-3 (gerbang navigasi): E2E P1×1 + P0 nav-absen dalam test halaman; API P1×1 (403 non-calon)
- CAP-4 (cron H-3/hari-7): API P1×4 + P2×1 guard, Unit P1×3
- CAP-5 (re-daftar CAS): API P0×1 + P1×2
- CAP-6 (gagal non-validasi): E2E P1×1 (toast verbatim + isian dipertahankan)

## Asumsi kontrak (selaraskan saat green-phase)

1. `PUT/GET /api/profile` — auth wajib (401 envelope); sukses 200/201 `{ ...10 field, profileComplete: true, remainingFields: [] }` tanpa referral; validasi 400 menyebut persis field kosong; non-calon 403.
2. Mint `/api/test/login` menerima override `diajukanPada` (DayKey Jakarta) untuk seeding backdated.
3. Endpoint inspeksi dev-only `GET /api/test/outbox?email=` (triple-guard TEST_AUTH_SECRET).
4. Respons `/api/jobs/daily` `details.jobs.registration` = `{ reminded, expired, remindedEmails[], expiredEmails[] }` — stub lama gagal skema (red jujur).
5. Route halaman `/kelengkapan-profil`; endpoint simpan POST|PUT (intercept glob tanpa method); label form = nama field Indonesia; Gmail readonly.
6. Unit: signature `runRegistrationDailyJob(today, db)` injectable (cast eksplisit di scaffold); kelengkapan = 10 kolom profil non-null.

## Next Steps (aktivasi per tugas)

1. Hapus `test.skip()`/`it.skip()` hanya pada file/scenario tugas berjalan.
2. Jalankan: `npx playwright test tests/e2e/<file>.spec.ts` atau `npx vitest run server/domain/identity/registration.service.expiry.test.ts`.
3. Verifikasi test AKTIF gagal dulu (merah jujur: 404 profil, echo kedaluwarsa, stub cron tanpa field emails), lalu hijau setelah implementasi.
4. Saat green-phase job: perbarui juga test stub lama "no-op dengan kontrak balikan tetap" di `registration.service.test.ts`.
5. Bila masih gagal: perbaiki implementasi ATAU test (dengan alasan tercatat). Commit test hijau. Headed/debug: `npx playwright test <file> --headed` / `--debug`.

## Panduan implementasi (DEV)

- API: `server/api/profil/index.put.ts` + `index.get.ts` (handler tipis) → logika `server/domain/identity/*.service.ts`, tulis DB via `*.repo.ts` (CAS baru untuk re-daftar; AD-5/AD-11); audit in-tx via API publik modul audit (AD-3); envelope seragam `server/utils/api-error.ts`.
- Cron: isi `runRegistrationDailyJob(today, db)` — pengingat via `enqueueEmail` (proofs, in-tx, AR-6), kedaluwarsa CAS + audit; dev-only baru: override `diajukanPada` di `server/api/test/login.post.ts`, `GET /api/test/outbox` (triple-guard).
- UI: halaman `/kelengkapan-profil` — 10 field by-label, Gmail readonly, region `data-testid="kelengkapan-indikator"` (TEST_IDS.kelengkapanProfil.indikator), tanpa nav lain, toast verbatim UX-DR19; gerbang redirect SSR calon belum lengkap (AD-8).
- data-testid baru: hanya `kelengkapan-indikator`.
- Mock eksternal: nihil (Resend tidak dipanggil langsung oleh test — verifikasi via baris outbox).
