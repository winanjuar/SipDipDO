---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-18'
storyId: '1.4'
storyKey: '1-4-pendaftaran-owner-mandiri-status'
storyFile: '_bmad-output/planning-artifacts/epics/epic-1.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-4-pendaftaran-owner-mandiri-status.md'
generatedTestFiles: ['tests/e2e/pendaftaran.api.spec.ts', 'tests/e2e/pendaftaran.spec.ts']
inputDocuments:
  - '_bmad-output/planning-artifacts/epics/epic-1.md'
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - 'playwright.config.ts'
  - 'package.json'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/factories/owner-factory.ts'
  - 'tests/support/helpers/sesi-minting.ts'
  - 'tests/support/helpers/test-ids.ts'
  - 'tests/e2e/auth-landing.spec.ts'
  - 'tests/e2e/landing.api.spec.ts'
  - 'tests/e2e/audit.api.spec.ts'
  - 'server/api/pendaftaran/status.get.ts'
  - 'server/domain/identity/owner.repo.ts'
  - 'server/domain/identity/index.ts'
---

# ATDD Checklist — Story 1.4 Pendaftaran Owner Mandiri & Status (in-progress)

## Step 1: Preflight & Context (selesai)

- **detected_stack:** `fullstack` (auto-detection: frontend Nuxt 4/Vue + `playwright.config.ts` + backend `server/api`, `drizzle-orm`, `postgres`; tanpa indikator mobile `.maestro/`/`app.json`/Podfile/`pubspec.yaml`)
- **Prasyarat:** story approved dengan AC jelas (epic-1.md Story 1.4, 3 blok AC); framework terkonfigurasi (`playwright.config.ts` testDir `./tests/e2e`, `@playwright/test` + `@seontechnologies/playwright-utils` + `@faker-js/faker` + `vitest` di `package.json`); env dev tersedia
- **Story:** `storyId=1.4`, `storyKey=1-4-pendaftaran-owner-mandiri-status`, sumber `_bmad-output/planning-artifacts/epics/epic-1.md` + konteks `_bmad-output/implementation-artifacts/epic-1-context.md`
- **Acceptance criteria (3 blok):**
  1. Daftar via link publik + akun Google → baris owner `diajukan` (enum AD-11) + entry audit (FR-22); TANPA field referral (referral di Pembelian Pertama, Epic 3)
  2. Login pasca-daftar → badge Diajukan (`warn`) / Terverifikasi (`success`) / Ditolak (`destructive`, + alasan) via Status Badge (UX-DR4), perubahan diumumkan `aria-live="polite"`
  3. Email sudah terdaftar → tanpa duplikat (unique constraint per email, AD-11)
- **Framework & pola existing:** `tests/support/merged-fixtures.ts` (mergeTests apiRequest+recurse+intercept+networkError+auth+cleanup; spec impor `test` hanya dari sini); `tests/support/factories/owner-factory.ts` (faker `id_ID`, status enum 5 nilai); `tests/support/helpers/sesi-minting.ts` (POST `/api/test/login` triple-guard, identifier `unlinked` tanpa baris owner); `TEST_IDS.statusPendaftaran` (`status-badge`, `status-alasan-penolakan`); acuan `auth-landing.spec.ts` / `landing.api.spec.ts` / `audit.api.spec.ts` (Given-When-Then + `log.step`, zod `validateSchema`, cookie per-hop untuk redirect)
- **Kondisi implementasi saat ini:** `POST /api/pendaftaran` BELUM ada (hanya `server/api/pendaftaran/status.get.ts`); halaman `/status-pendaftaran` sudah ada; repo `owner.repo.ts` hanya punya `upsertOwnerByEmail` non-CAS (fungsi CAS pendaftaran/verifikasi menyusul Story 1.4/1.6)
- **TEA flags:** `tea_use_playwright_utils=true` (mandate AKTIF, `@seontechnologies/playwright-utils` terinstal), `tea_use_pactjs_utils=true` TETAPI gerbang relevansi TUTUP (satu aplikasi, bukan microservices → tanpa contract test), `tea_pact_mcp=none`, `tea_browser_automation=auto`, `test_stack_type=auto`
- **Knowledge loaded:** `playwright-utils-mandate` (substitusi apiRequest/intercept/recurse/log/mergeTests, banned patterns), `data-factories` (factory + override + seed via API), `test-quality`, `fixture-architecture`/`network-first` (prinsip; mekanisme via playwright-utils), `selector-resilience`, `test-levels-framework`, `test-priorities-matrix`

## Step 2: Generation Mode (selesai)

- **Mode:** AI generation (default). AC jelas + skenario standar (pendaftaran CRUD/auth, API, navigasi + badge status).
- **Recording dilewati:** `tea_browser_automation=auto` mengizinkan CLI/MCP, tetapi halaman pendaftaran publik Story 1.4 belum diimplementasikan (`POST /api/pendaftaran` belum ada) sehingga live-browser recording tidak punya UI untuk direkam; selektor dikunci dari kontrak `TEST_IDS` + pola `auth-landing.spec.ts`.

## Step 3: Test Strategy (selesai)

- **primary_level:** API (logika bisnis + kontrak endpoint baru `POST /api/pendaftaran`); E2E untuk critical journey daftar → badge status.

### AC → skenario (tanpa duplikasi lintas level)

| AC | Skenario | Level | Prioritas | Catatan dedup |
|----|----------|-------|-----------|---------------|
| AC1 buat `diajukan` + audit, tanpa referral | POST terautentikasi (sesi unlinked/Google) → `diajukan`, respons tanpa field referral | API | P0 | Baru — endpoint belum ada (red: 404) |
| AC1 | POST tanpa sesi → 401 envelope seragam | API | P0 | Baru (pola `landing.api.spec.ts` P0) |
| AC1 | POST dua kali email sama → satu baris (idempotent, unique per email) | API | P0 | Baru — inti AC3 di level API |
| AC1 | Body membawa `referral` → ditolak/diabaikan (tanpa kolom referral tersimpan) | API | P1 | Baru — pin "TIDAK diminta" |
| AC1 | Entry audit `{ actor=user, action=pendaftaran, target, details }` tertulis in-tx, terbaca COO via GET /api/audit | API | P1 | Baru — reuse helper `denganAuditKosong` + seed; baca via kontrak `audit.api.spec.ts` |
| AC1 | Halaman pendaftaran publik render tanpa sesi: CTA daftar + TANPA input referral | E2E | P0 | Baru — halaman belum ada (red: redirect/404) |
| AC1 | Submit pendaftaran via UI → redirect `/status-pendaftaran` + badge Diajukan | E2E | P0 | Baru — critical journey; network-first via `interceptNetworkCall` |
| AC2 badge + aria-live | Badge `Diajukan` + `aria-live="polite"` di `/status-pendaftaran` | E2E | P0 | Baru untuk varian diajukan (varian ditolak + alasan sudah hijau di `auth-landing.spec.ts` — tidak diduplikasi) |
| AC2 | Badge `Ditolak` + alasan verbatim + `aria-live` | E2E/API | — | SUDAH HIJAU (`auth-landing.spec.ts` P1, `landing.api.spec.ts` P1) — reuse, tidak diregenerasi |
| AC2/AC1 | GET `/api/pendaftaran/status` 401 / non-calon redirect / unlinked redirect | API | — | SUDAH HIJAU (`landing.api.spec.ts`) — reuse, tidak diduplikasi |
| AC3 | Unique constraint DB per email (lapis integrasi) | Integration (via API) | P1 | Dicakup implisit skenario idempotent API; tanpa suite DB terpisah |
| Guard | POST `/api/test/*` tanpa secret → 401/403/404 | API | P2 | Pola guard existing; sertakan satu test guard seed bila helper seed baru ditambah |

- **Component:** tidak ada — badge diassert by-text di E2E (UX-DR4); tidak ada perilaku komponen terisolasi baru.
- **Contract (Pact):** tidak ada — gerbang relevansi tutup (satu aplikasi).
- **Red-phase:** seluruh scaffold baru dirancang GAGAL sebelum implementasi — API: `POST /api/pendaftaran` menjawab 404; E2E: halaman pendaftaran belum ada (redirect/404, `data-testid` belum render). Scaffold ditulis `test.skip()` + panduan aktivasi per tugas.

## Step 4: Aggregate — TDD Red Phase (selesai)

- **Eksekusi:** SUBAGENT (API + E2E paralel), `~50% faster than sequential`; kedua worker `success=true`.
- **Validasi TDD:** PASS — 10/10 test memakai `test.skip()`, tanpa placeholder `expect(true).toBe(true)`, semua `expected_to_fail=true`.
- **File ditulis ke disk:**
  - `tests/e2e/pendaftaran.api.spec.ts` — 6 test API red-phase (263 baris)
  - `tests/e2e/pendaftaran.spec.ts` — 4 test E2E red-phase (133 baris)
- **Fixture infrastructure:** tanpa file baru — seluruh kebutuhan sudah ada: `tests/support/merged-fixtures.ts` (mergeTests lengkap apiRequest+recurse+intercept+networkError+auth+cleanup, sudah melebihi template minimal Step 4C), `tests/support/helpers/sesi-minting.ts` (`mintSesiPemilik`), `tests/support/factories/owner-factory.ts` (faker `id_ID`), endpoint dev-only `POST /api/test/login` (hijau Story 1.2).
- **Playwright Utils deviations:** nihil — nol `page.route`/`page.waitForResponse`/`request` mentah/`waitForTimeout`/`console.log` di badan kode; impor `test` hanya dari `../support/merged-fixtures`.
- **Pact:** tanpa contract test — gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices; `@seontechnologies/pactjs-utils` tidak terinstal), konsisten dengan `audit.api.spec.ts`.
- **Summary JSON:** `/tmp/tea-atdd-summary-2026-09-18T00-18-09.json` (total 10: API 6 — P0×3/P1×2/P2×1; E2E 4 — P0×3/P1×1).

## TDD Red Phase (saat ini)

✅ Scaffold red-phase tergenerasi — JANGAN hapus `test.skip()` kecuali untuk tugas yang sedang diimplementasikan.

- API: 6 test (semua skip) di `tests/e2e/pendaftaran.api.spec.ts`
- E2E: 4 test (semua skip) di `tests/e2e/pendaftaran.spec.ts`

## Cakupan AC

- AC1 (buat `diajukan` + audit, tanpa referral): API P0×2 + P1×2, E2E P0×2
- AC2 (badge + `aria-live`): E2E P0×1 (varian Diajukan; Ditolak reuse hijau `auth-landing.spec.ts`/`landing.api.spec.ts`)
- AC3 (unique email): API P0×1 (idempotent), E2E P1×1 (pesan duplikat, tanpa over-assert DB)
- Guard dev-only: API P2×1

## Asumsi kontrak (selaraskan saat green-phase)

1. `POST /api/pendaftaran` — auth wajib (401 envelope tanpa sesi); body minimal `{}` (email dari sesi Google); sukses 200/201 `{ id, email, status:'diajukan' }` tanpa field referral.
2. Duplikat email → idempotent 200 baris sama (bukan 409).
3. Body berisi `referral` → 400 envelope (dipilih; alternatif "abaikan" terdokumentasi di header spec).
4. Audit FR-22 in-tx; entry memuat email pendaftar (terbaca `GET /api/audit` oleh COO).
5. Route halaman pendaftaran `/pendaftaran` + CTA `"Daftar sebagai Owner"` + copy duplikat `/sudah terdaftar/i` = asumsi red-phase.

## Next Steps (aktivasi per tugas)

1. Hapus `test.skip()` hanya pada file/scenario tugas berjalan.
2. Jalankan: `npx playwright test tests/e2e/pendaftaran.api.spec.ts` / `tests/e2e/pendaftaran.spec.ts` (atau `npm run test:e2e -- <file>`).
3. Verifikasi test AKTIF gagal dulu (merah jujur: API 404, E2E halaman belum ada), lalu hijau setelah implementasi.
4. Bila masih gagal: perbaiki implementasi ATAU test (dengan alasan tercatat).
5. Commit test hijau. Mode headed/debug: `npx playwright test <file> --headed`, `--debug`.

## Panduan implementasi (DEV)

- Endpoint: `server/api/pendaftaran/index.post.ts` (atau `daftar.post.ts`) — handler tipis, logika di `server/domain/identity/*.service.ts`, tulis DB hanya via `*.repo.ts` (fungsi CAS baru; AD-5/AD-11), audit in-tx via API publik modul audit (AD-3), envelope error seragam `server/utils/api-error.ts`.
- UI: halaman publik `/pendaftaran` (asumsi route) — CTA by-role, TANPA input referral, submit → `POST /api/pendaftaran` → redirect `/status-pendaftaran`; badge `TEST_IDS.statusPendaftaran` + `aria-live="polite"`.
- `data-testid` yang wajib ada: `status-badge` (`statusPendaftaran.badgeStatus`), `status-alasan-penolakan` (reuse), plus kontrak baru halaman pendaftaran bila UX mem-pin (tambahkan ke `tests/support/helpers/test-ids.ts`).
- Mock eksternal: nihil (OAuth Google asli = smoke manual, tidak diotomasi — pola `auth-landing.spec.ts`).
- Handoff story: `storyFile` = planning artifact beku (`_bmad-output/planning-artifacts/epics/epic-1.md`) — TIDAK ditaut balik otomatis; serah terima manual via checklist ini.

## Step 5: Validate & Complete (selesai)

- **Prasyarat:** story AC jelas ✓, framework (`playwright.config.ts` + deps) ✓, env dev ✓.
- **File test:** 2 file di disk, `test.skip` API 7 / E2E 5 kemunculan (≥ jumlah test 6+4, sisanya prosa header), nol placeholder, `expected_to_fail=true` semua, impor `test` hanya dari merged-fixtures ✓.
- **Kualitas:** ESLint kedua file EXIT 0; Given-When-Then + `log.step` konsisten; terminologi Bahasa Indonesia konsisten.
- **Metadata:** frontmatter lengkap (`storyId`, `storyKey`, `storyFile`, `atddChecklistPath`, `generatedTestFiles` 2 path); handoff manual (artifact beku tidak ditulis).
- **Sesi CLI:** nihil — mode AI generation tanpa sesi browser terekam, tidak ada orphan browser.
- **Artefak temp:** `/tmp/tea-atdd-{api,e2e,summary}-2026-09-18T00-18-09.json` (lokasi sesuai mandat step-file 04a/04b/04c; checklist kanonis di `_bmad-output/test-artifacts/`).
- **Risiko/asumsi kunci:** 5 asumsi kontrak di atas (terutama referral→400 vs abaikan, dan route `/pendaftaran` + label CTA) — selaraskan di awal green-phase sebelum un-skip.
- **Workflow berikut:** `dev-story` Story 1.4 (implementasi endpoint + halaman + un-skip per tugas); `automate`/burn-in setelah hijau.
