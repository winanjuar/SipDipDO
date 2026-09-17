---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-17'
storyId: '1.3'
storyKey: '1-3-audit-trail-pencatatan-tampilan-coo'
storyFile: '_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-3-audit-trail-pencatatan-tampilan-coo.md'
generatedTestFiles:
  - 'tests/e2e/audit.api.spec.ts'
  - 'tests/e2e/audit-trail.spec.ts'
  - 'shared/domain/audit.test.ts'
  - 'server/domain/audit/audit.service.test.ts'
  - 'server/domain/audit/audit.repo.test.ts'
  - 'tests/support/helpers/test-ids.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md'
  - '_bmad-output/implementation-artifacts/sprint-status.yaml'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/helpers/sesi-minting.ts'
  - 'tests/support/helpers/test-ids.ts'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/library-integration-mandate.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/overview.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/api-request.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/fixtures-composition.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/intercept-network-call.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/recurse.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/log.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/file-utils.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/network-error-monitor.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/fixture-architecture.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/network-first.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/playwright-cli.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/ci-burn-in.md'
---

# Daftar Periksa ATDD — Story 1.3 Audit Trail (Pencatatan & Tampilan COO)

## Hasil Langkah 01 — Pra-penerbangan & Konteks

### Deteksi Stack

- `test_stack_type` pada config = `auto` → deteksi otomatis.
- Indikator depan: `package.json` (Nuxt 4 / vue) + `playwright.config.ts` ada.
- Indikator belakang: `server/` (handler API Nuxt), `drizzle/` (ORM), `shared/domain/`.
- **`detected_stack` = `fullstack`** → profil muat: Full UI+API.

### Prasyarat (Gerbang Keras) — SEMUA LOLOS

| Prasyarat | Status | Bukti |
|-----------|--------|-------|
| Story disetujui dengan AC jelas | ✅ | spec-1-3 `status: ready-for-dev`, 4 AC eksplisit + matriks I/O 9 baris |
| Kerangka uji terkonfigurasi | ✅ | `playwright.config.ts` (3 browser: chromium/firefox/webkit, locale id-ID, tz Asia/Jakarta) + Vitest |
| Lingkungan pengembangan tersedia | ✅ | dev server + DB Supabase (dua akun uji sudah di-seed di DB) |

### Konteks Story

- **story_id:** `1.3`
- **story_key:** `1-3-audit-trail-pencatatan-tampilan-coo`
- **story_file:** `_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md`
- **Ruang lingkup:** modul AUDIT (`server/domain/audit`) — tabel `audit_logs` append-only (grants DB), registry aksi `shared/domain/audit.ts`, endpoint baca `GET /api/audit` khusus COO, halaman `/audit-trail`, endpoint seed dev-only, dan e2e `tests/e2e/audit-trail.spec.ts`.
- **AC utama yang diuji ATDD:** (1) append-only repo + penolakan tanpa `tx`; (2) envelope `{actor, action, target, details}` + action dari registry; (3) tampilan hanya untuk COO + redirect non-COO; (4) `test`/`typecheck`/`lint`/`build` hijau.
- **ID test dari spec:** `1-UNIT-*` (registry & service), `1-API-006` (endpoint), `1-E2E-002` (halaman — sisi halaman dicakup scaffold e2e di sini).

### Bendera TEA

| Bendera | Nilai | Konsekuensi |
|---------|-------|-------------|
| `tea_use_playwright_utils` | `true` | **Mandat playwright-utils mengikat** — spec wajib impor `test` dari merged-fixtures, `apiRequest`, `interceptNetworkCall`, `recurse`, `log` |
| `tea_use_pactjs_utils` | `true` | Gerbang relevansi TIDAK lolos (bukan microservices; bukan layanan terpisah yang saling memanggil) → dilewati |
| `tea_pact_mcp` | `none` | Tidak ada muatan Pact MCP |
| `tea_browser_automation` | `auto` | playwright-cli tersedia untuk verifikasi selektor bila perlu |
| `test_stack_type` | `auto` → `fullstack` | Profil Full UI+API |

### Dua Gerbang Mandat Library — TERPENUHI

1. Flag `tea_use_playwright_utils: true` di `_bmad/tea/config.yaml` ✅
2. `@seontechnologies/playwright-utils@4.4.0` terpasang di `package.json` ✅

→ Semua scaffold WAJIB mematuhi tabel substitusi playwright-utils; penyimpangan wajib berkomentar `// playwright-utils deviation: <alasan>`.

### Kerangka & Pola Existing

- `tests/support/merged-fixtures.ts` — titik impor `test`/`expect` untuk semua e2e (pola `mergeTests`).
- `tests/support/helpers/sesi-minting.ts` — `mintSesiPemilik(apiRequest, { userIdentifier })` via `/api/test/login` (triple-guard dev-only).
- `tests/support/helpers/test-ids.ts` — sumber `TEST_IDS` (blok audit akan ditambah implementasi; scaffold merah boleh merujuk konstanta baru yang direncanakan).
- Spec merujuk pemakaian `mintSesiPemilik` untuk peran `coo` dan `pemegang-saham` pada e2e audit-trail.

### Fragmen Pengetahuan Dimuat (25)

- Mandat: `playwright-utils-mandate`, `library-integration-mandate` (2)
- Inti: `data-factories`, `component-tdd`, `test-quality`, `test-healing-patterns` (4)
- UI+API: `selector-resilience`, `timing-debugging`, `fixture-architecture` (prinsip), `network-first` (prinsip) (4)
- Playwright Utils: `overview`, `api-request`, `auth-session`, `intercept-network-call`, `recurse`, `log`, `file-utils`, `network-recorder`, `network-error-monitor`, `fixtures-composition` (10)
- CLI: `playwright-cli` (1)
- Backend/fullstack: `test-levels-framework`, `test-priorities-matrix`, `ci-burn-in` (3)

### Keputusan Penting untuk Langkah Berikutnya

- Mode ATDD: **Create** (scaffold fase-merah sebelum implementasi).
- Target uji scaffold: `tests/e2e/audit-trail.spec.ts` (merah — halaman/endpoint belum ada) sesuai task Execution spec.
- Wajib network-first, tanpa hard wait, selektor via `TEST_IDS`, asersi eksplisit, self-cleaning.
- Confidence gate akan dijalankan sebelum generasi (Confidence 1-10 + Rationale berbukti berkas/kontrak; <5 = STOP).

## Rencana Pemeriksaan (diisi langkah 02+)

### Langkah 02 — Mode Generasi

- **Mode terpilih: AI Generation.**
- Alasan: (1) AC jelas dan skenario standar — API baca berperan, redirect per-role, tabel daftar; (2) mode rekam mustahil karena halaman `/audit-trail` dan endpoint `/api/audit` belum ada (scaffold fase-merah dibuat sebelum implementasi); (3) selektor bersumber dari `TEST_IDS` yang direncanakan spec, bukan DOM live.
- `tea_browser_automation=auto`: CLI browser tetap tersedia untuk verifikasi selektor bila dibutuhkan di langkah lanjutan.

### Langkah 03 — Strategi Uji

**Pemetaan AC → Skenario → Level → Prioritas**

Anti-duplikasi: predikat murni (registry, guard, validasi tx) HANYA di Unit Vitest; kontrak endpoint (envelope, status, paging) HANYA di spec API (E2E-runner `apiRequest`); orkestrasi halaman (SSR fetch, redirect browser, format waktu, empty state) HANYA di E2E UI.

| # | Skenario (sumber AC/matriks I/O) | Level | Prioritas | Test ID | Berkas target |
|---|---|---|---|---|---|
| 1 | Guard `isAuditAction`: menerima semua anggota `AUDIT_ACTIONS`, menolak string di luar registry (AC-2) | Unit (Vitest, murni) | P0 | 1-UNIT-002 (usulan) | `shared/domain/audit.test.ts` |
| 2 | Kelengkapan union: `AuditAction` = union persis `AUDIT_ACTIONS` (AC-2) | Unit | P1 | 1-UNIT-002 | `shared/domain/audit.test.ts` |
| 3 | `writeAuditEntry` tanpa `tx` → throw, pesan menyebut kewajiban transaksi, repo TIDAK terpanggil (AC-1, AD-3) | Unit (stub repo) | **P0** | 1-UNIT-003 (usulan) | `server/domain/audit/audit.service.test.ts` |
| 4 | `writeAuditEntry` action di luar registry → throw SEBELUM INSERT, pesan menyebut registry (matriks I/O baris 7) | Unit (stub repo) | **P0** | 1-UNIT-003 | `audit.service.test.ts` |
| 5 | Envelope tersimpan = `{actor:{kind,ownerId?}, action, target, details}`; `system` → ownerId null (AC-2, AD-8) | Unit (stub repo) | P1 | 1-UNIT-003 | `audit.service.test.ts` |
| 6 | `listForCoo(db, page)` komposisi paging: page valid → limit/offset benar (matriks I/O baris 6) | Unit (stub repo) | P1 | 1-UNIT-003 | `audit.service.test.ts` |
| 7 | `insertAuditEntry` INSERT baris; `listAuditEntries` SELECT urut `created_at` desc + limit/offset (AC-1) | Unit (repo vs stub db / kontrak) | P1 | 1-UNIT-004 (usulan) | `server/domain/audit/audit.repo.test.ts` |
| 8 | `GET /api/audit` tanpa sesi → **401** envelope `{code,message,details}` (matriks I/O baris 4) | API (E2E-runner) | **P0** | 1-API-006 | `tests/e2e/audit.api.spec.ts` |
| 9 | `GET /api/audit` sesi `pemegang-saham` → **403** envelope (matriks I/O baris 5, status baru) | API | **P0** | 1-API-006 | `tests/e2e/audit.api.spec.ts` |
| 10 | `GET /api/audit?page=bukan-angka` sesi COO → **400** envelope (matriks I/O baris 6) | API | P1 | 1-API-006 | `tests/e2e/audit.api.spec.ts` |
| 11 | `GET /api/audit` sesi COO → **200** `{data, nextPage}` urut desc; entry hasil seed endpoint terlihat (AC-3) | API | P1 | 1-API-006 | `tests/e2e/audit.api.spec.ts` |
| 12 | Paging: halaman habis → `nextPage: null`; `?page=2` → lanjutan daftar | API | P2 | 1-API-006 | `tests/e2e/audit.api.spec.ts` |
| 13 | Seed endpoint `/api/test/audit-seed` guard triple-guard: di luar dev / tanpa izin → ditolak | API | P1 | penegasan pola `login.post` | `tests/e2e/audit.api.spec.ts` |
| 14 | COO (sesi minted) buka `/audit-trail` → daftar tampil: aktor (email/"System"), waktu id-ID Asia/Jakarta, action, target, detail JSON terpotong (AC-3, FR-12) | E2E UI | P1 | 1-E2E-002 | `tests/e2e/audit-trail.spec.ts` |
| 15 | `pemegang-saham` buka `/audit-trail` URL langsung → redirect `LANDING_PATH[role]` = `/dashboard` (AC-3) | E2E UI | **P0** | 1-E2E-002 | `tests/e2e/audit-trail.spec.ts` |
| 16 | Belum login buka `/audit-trail` → middleware `auth-guard` → `/login` (matriks I/O baris 3) | E2E UI | P1 | 1-E2E-002 | `tests/e2e/audit-trail.spec.ts` |
| 17 | DB kosong (tanpa seed) → empty state kerangka tampil (matriks I/O baris 1) | E2E UI | P2 | 1-E2E-002 | `tests/e2e/audit-trail.spec.ts` |

**Keputusan struktur:** DUA berkas e2e mengikuti preseden 1.2 (`landing.api.spec.ts` + `auth-landing.spec.ts`): `audit.api.spec.ts` menutup sisi endpoint 1-API-006 (baris 8–13), `audit-trail.spec.ts` menutup sisi halaman 1-E2E-002 (baris 14–17) — konsisten dengan frasa spec "mencakup **sisi halaman** 1-API-006 + 1-E2E-002" (berarti sisi endpoint 1-API-006 butuh wadah sendiri) dan konvensi repo testDir `./tests/e2e`.

**Tidak masuk scope scaffold ATDD** (verifikasi manual/perintah build sesuai seksi Verification spec): grants DB via `psql SET ROLE app_runtime` → permission denied; migrasi bersih `db:generate`+`db:migrate`; `npm test/typecheck/lint/build` hijau; halaman paginasi tautan klik-berikutnya (P3 — cukup kontrak API nextPage; interaksi klik paginasi menyusul saat hijau bila perlu).

**Red Phase Requirements**

- Semua test dilahirkan `test.skip()` dengan komentar "GAGAL saat red" yang menjelaskan mode kegagalannya (pola terbukti 1.2); asersi nyata, tanpa placeholder.
- Unit: modul target belum ada (`shared/domain/audit.ts`) / masih stub (`export {}`) → **impor dinamis non-literal** (`await import(MODUL)`) agar `typecheck` tetap bersih; pelepasan skip → impor gagal = merah jujur.
- API: `/api/audit` & `/api/test/audit-seed` belum ada → 404 = merah jujur; seed dipanggil via `apiRequest` dengan error eksplisit "endpoint belum ada (Story 1.3)".
- E2E: halaman `/audit-trail` belum ada → 404/redirect salah = merah jujur; sesi via `mintSesiPemilik` existing (tidak mengubah helper).
- Tidak merusak suite lama: semua berkas baru; `test-ids.ts` hanya DITAMBAH blok `TEST_IDS.auditTrail.*`; tidak menyentuh `merged-fixtures.ts`, `sesi-minting.ts`, fixture existing.

## Langkah 04 & 04C — Generasi Red-Phase (TDD RED)

**Mode eksekusi:** `tea_execution_mode: auto` → **SUBAGENT (API + E2E)** paralel (agent-team tidak tersedia) — ~50% lebih cepat dari sekuensial. Validasi agregasi: kedua keluaran `success: true`, semua `test.skip(`, tanpa placeholder `expect(true).toBe(true)`, semua `expected_to_fail: true` → **PASS**.

### Hasil Generasi (22 test, semua `test.skip()`)

| Berkas | Test | Cakupan | Distribusi |
|---|---|---|---|
| `tests/e2e/audit.api.spec.ts` | 6 | 401 tanpa sesi; 403 pemegang-saham; 400 page tak valid; 200 `{data, nextPage}` urut desc pasca-seed; paging nextPage null/lanjutan (seed 101, iterasi maks 10 halaman); guard seed tanpa secret | P0×2, P1×3, P2×1 |
| `tests/e2e/audit-trail.spec.ts` | 4 | daftar COO (aktor email/"System", waktu id-ID Asia/Jakarta, 5 kolom, detail JSON terpotong); pemegang-saham → /dashboard; belum login → /login; empty state | P0×1, P1×2, P2×1 |
| `shared/domain/audit.test.ts` | 4 | guard menerima semua anggota registry; menolak di luar registry; kelengkapan 7 kategori Epic 1; anggota unik & tak kosong (1-UNIT-002) | P0/P1 |
| `server/domain/audit/audit.service.test.ts` | 5 | tolak tanpa tx + repo tak terpanggil; tolak aksi luar registry SEBELUM insert; envelope valid → insert 1×; aktor system → ownerId null; listForCoo limit 100 offset 0/100 (1-UNIT-003, repo dimock `vi.mock`) | P0×2, P1×2 |
| `server/domain/audit/audit.repo.test.ts` | 3 | permukaan modul tanpa kunci update/delete/remove/truncate; insert meneruskan baris ke rantai `.values()`; select meneruskan limit/offset + orderBy (1-UNIT-004, fake chain Drizzle) | P1 |

Unit = perluasan terdokumentasi di luar scope worker (preseden 1.2) menutup baris strategi 1–7.

### Aktivasi per tugas (green phase)

1. Lepas `test.skip()` pada test tugas berjalan → `npx playwright test <berkas>` / `npx vitest run <berkas>` → buktikan MERAH dulu.
2. Implementasikan tugas → hijaukan → commit.
3. Pemetaan: tugas registry `shared/domain/audit.ts` → `audit.test.ts`; tugas repo → `audit.repo.test.ts`; tugas service+barrel → `audit.service.test.ts`; tugas `api-error` 403 + endpoint `server/api/audit/index.get.ts` → `audit.api.spec.ts`; tugas seed endpoint → test seed-dependent API + E2E daftar; tugas halaman + testid → `audit-trail.spec.ts`.

### Playwright Utils deviations (roll-up dari kedua worker + agregasi)

1. **E2E — SSR tanpa `interceptNetworkCall`:** fetch `/api/audit` terjadi di server (`useRequestFetch`, pola `status-pendaftaran.vue`) sehingga tak terlihat di jaringan browser; asersi langsung ke elemen tampil di HTML awal (pola `smoke.ui.spec.ts`). Tanpa `page.route`/`waitForResponse` sama sekali.
2. **E2E — injeksi cookie eksplisit** `mintSesiPemilik` + `context.addCookies(...)` alih-alih fixture `authToken` — deviasi yang sama terekam di Story 1.2 (wiring `manageAuthToken` menyusul).
3. **API — cookie via header `Cookie:`** per permintaan (`apiRequest` tidak berbagi cookie-jar konteks browser).
4. **Koreksi agregator (7 titik panggilan di `audit.api.spec.ts`):** worker mengirim `validateSchema` sebagai opsi params — kontrak `@seontechnologies/playwright-utils@4.4.0` sebenarnya metode promise: `await apiRequest<T>(params).validateSchema(skema)` → `{ status, body }` (`ValidatedApiResponse`). Sudah diperbaiki; komentar header diselaraskan.

### Fixture needs untuk green phase (gabungan kedua worker)

- `tests/support/merged-fixtures.ts` — SUDAH ADA, tidak diubah (apiRequest, log, expect, auth, cleanup).
- `TEST_IDS.auditTrail.{halaman,tabel,baris,kosong,paginasi}` — DITAMBAHKAN agregasi ke `tests/support/helpers/test-ids.ts`; halaman `app/pages/audit-trail.vue` wajib memakai nilai data-testid ini.
- `server/api/audit/index.get.ts` — belum ada (target RED); butuh `HTTP_STATUS.forbidden = 403` di `server/utils/api-error.ts`.
- `server/api/test/audit-seed.post.ts` — belum ada; kontrak body DIASUMSI `{ jumlah: <n> }` + header `TEST_AUTH_SECRET` (triple-guard, pola `login.post.ts`) — 404 saat green = error jujur.
- Kontrak pembersihan data seed audit menyusul Story 1.4 (tabel append-only) — test empty state [P2] merah jujur bila DB bersama sudah berisi entry.

### Asumsi kontrak yang diselaraskan saat green (ditandai per test)

- Bentuk wire entry audit: `createdAt` camelCase ISO string, `actor {kind, ownerId?}`, `id` uuid, `target` nullish, `nextPage` number|string|null (perilaku null ⇔ habis yang dipinkan).
- Nama anggota registry contoh (`pendaftaran-diajukan`) dan penanda `tx` sintetis pada unit service; bentuk rantai Drizzle pada fake repo test.
- Potensi hijau dini: test belum-login (middleware `auth-guard` Story 1.2 sudah global) — dicatat jujur di komentar, tetap di-skip mengikuti siklus ATDD.

## Langkah 05 — Validasi & Kelengkapan

### Hasil Validasi (semua lolos)

| Gerbang | Hasil | Bukti |
|---|---|---|
| TDD red compliance | ✅ PASS | Validasi programatik: kedua keluaran worker `success: true`, semua `test.skip(`, tanpa `expect(true).toBe(true)`, semua `expected_to_fail: true` |
| Unit scaffold skip | ✅ | `describe.skip(...)` pola preseden 1.2 (be84437) — Vitest: shared/domain 4 skipped, server/domain/audit 8 skipped (total 12) |
| `npm run typecheck` | ✅ exit 0 | Scaffold merah (impor dinamis non-literal + `TEST_IDS.auditTrail` baru) tidak merusak typecheck |
| Koleksi Playwright | ✅ | `playwright test --list` → 30 test (10 test × 3 browser) di 2 berkas baru, terkoleksi bersih |
| Mandate playwright-utils | ✅ | `test`/`expect`/`log` dari merged-fixtures; `apiRequest` + `.validateSchema()`; tanpa page.route/waitForTimeout/console.log; 4 deviasi tercatat di Langkah 04 |
| Gerbang Pact | ✅ TUTUP | Satu aplikasi (bukan microservices) → tanpa contract test meski flag true |
| data-testid untuk DEV | ✅ | `TEST_IDS.auditTrail.{halaman,tabel,baris,kosong,paginasi}` — nilai wajib di `app/pages/audit-trail.vue` |
| Sesi CLI/browser | ✅ | Tidak ada sesi playwright-cli yang dibiarkan hidup (browser automation tidak dipakai) |
| Artefak | ✅ | Checklist + story link di `_bmad-output/` (beku dihormati); JSON worker & summary di `/tmp` sesuai kontrak langkah |

### Serah Terima ke DEV

- **Checklist:** berkas ini. **Story:** `_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md` (seksi `### ATDD Artifacts`).
- Alur green per tugas: lepas skip → buktikan MERAH → implementasi → HIJAU → commit (detail pemetaan di Langkah 04).
- Perintah: `npx vitest run <berkas>` (unit), `npx playwright test tests/e2e/audit.api.spec.ts` / `tests/e2e/audit-trail.spec.ts` (API/E2E), debug headed `npx playwright test --headed <berkas>`.
- Estimasi upaya green: mengikuti tugas spec — registry+unit (~0,5 hari), repo+migrasi+grants (~0,5 hari), service+endpoint (~0,5 hari), halaman+e2e (~1 hari).
- Langkah lanjutan yang disarankan: workflow **dev-story** (`/bmad-build` lanjut implementasi) — automate menyusul setelah implementasi bila dibutuhkan.
