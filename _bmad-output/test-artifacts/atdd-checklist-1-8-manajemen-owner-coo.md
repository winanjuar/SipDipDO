---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-aggregate']
lastStep: 'step-04-aggregate'
lastSaved: '2026-09-20'
storyId: '1.8'
storyKey: '1-8-manajemen-owner-coo'
storyFile: '.kiro/specs/story-1-8-manajemen-owner-coo/'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-8-manajemen-owner-coo.md'
generatedTestFiles: ['tests/e2e/admin-owners.api.spec.ts', 'tests/e2e/admin-owners.spec.ts']
inputDocuments:
  - '.kiro/specs/story-1-8-manajemen-owner-coo/requirements.md'
  - '.kiro/specs/story-1-8-manajemen-owner-coo/design.md'
  - '.kiro/specs/story-1-8-manajemen-owner-coo/tasks.md'
  - '_bmad-output/planning-artifacts/epics/epic-1.md'
  - '_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/helpers/sesi-minting.ts'
  - 'tests/support/helpers/test-ids.ts'
---

# ATDD Checklist — Story 1.8 Manajemen Owner oleh COO

> **STATUS: RED-PHASE.** Checklist dibuat berdasarkan spec Kiro:
> `.kiro/specs/story-1-8-manajemen-owner-coo/` (requirements.md + design.md).
> Story menyediakan halaman khusus COO untuk mengelola data owner (identitas,
> kontak, rekening bank) dengan audit trail lengkap.

## Step 1: Preflight & Context (selesai)

- **detected_stack:** `fullstack` (frontend Nuxt 4/Vue + backend `server/api` + Drizzle; tanpa indikator mobile)
- **Prasyarat:** story approved dengan AC jelas (requirements.md 5 requirement, design.md 6 correctness properties); `playwright.config.ts` tersedia; env dev tersedia
- **Story:** `storyId=1.8`, `storyKey=1-8-manajemen-owner-coo`, sumber `.kiro/specs/story-1-8-manajemen-owner-coo/`
- **Acceptance criteria (5 requirement):**
  1. **Requirement 1: Owner Management Page Access** — COO dapat akses `/admin/owners`; non-COO ditolak di batas server (AD-8)
  2. **Requirement 2: Edit Owner Data with Audit Trail** — COO dapat edit data owner (fullName, alias, phoneNumber, emergency contact, bank account) dengan audit entry dalam transaksi DB yang sama (AD-3); email tidak boleh diubah
  3. **Requirement 3: Add Owner Manual Entry** — COO dapat tambah owner baru dengan email; status langsung `terverifikasi` (pre-approved); email duplikat ditolak 409
  4. **Requirement 4: Owner Picker for Transaction Input** — komponen pemilih owner reusable; include SEMUA owner termasuk `keluar`; mendukung search/filter
  5. **Requirement 5: Status Change Protection** — PUT dengan field `status` ditolak (AD-11); transisi status hanya via domain event yang sah
- **Correctness Properties (design.md):**
  - Property 1: Audit Atomicity (AD-3) — setiap perubahan owner tulis audit in-tx
  - Property 2: Status Immutability (AD-11) — PUT endpoint reject `status` field
  - Property 3: Email Uniqueness — POST reject duplicate email 409
  - Property 4: Module Ownership (AD-5) — hanya identity module tulis owner tables
  - Property 5: COO Authorization (AD-8) — semua endpoint verifikasi COO tenure di server
  - Property 6: New Owner Status — owner baru via COO langsung `terverifikasi`
- **Framework & pola existing:** `tests/support/merged-fixtures.ts` (mergeTests apiRequest+recurse+intercept+networkError+auth+cleanup); `tests/support/auth-fixture.ts` (provider NuxtAuth); `tests/support/helpers/sesi-minting.ts` (`mintSesiPemilik` — mint sesi via POST `/api/test/login`); acuan pola: `tests/e2e/audit.api.spec.ts` (Given-When-Then via `log.step`, zod `.validateSchema`, envelope seragam)
- **TEA flags:** `tea_use_playwright_utils=true` (mandate AKTIF), `tea_use_pactjs_utils=true` TETAPI gerbang relevansi TUTUP (satu aplikasi Nuxt 4)
- **Selaras test-design (`test-design-qa.md`):**
  - `1-API-001` (P0): Authorization matrix 3 role × seluruh endpoint — COO endpoint `/api/admin/owners`
  - `1-E2E-002` (P1): Navigasi per role — landing sesuai role; item terkunci tidak tampil
- **Playwright Utils mandate:** berlaku — impor `test` HANYA dari merged-fixtures; HTTP via `apiRequest`; validasi zod via `.validateSchema(skema)`

## Step 2: Generation Mode (selesai)

- **Mode:** AI generation (default). AC jelas (5 requirement, 6 correctness properties); skenario standar (CRUD API, form edit/add, authorization matrix).
- **Recording dilewati:** halaman `/admin/owners` belum diimplementasikan (red-phase) — tidak ada UI untuk direkam; selektor dikunci dari kontrak `TEST_IDS` yang akan ditambah.
- **Env terkonfirmasi (lokal):** `ENABLE_TEST_AUTH=1`, `TEST_AUTH_SECRET=test-secret-lokal` — test memakai pola fallback env.

## Step 3: Test Strategy (selesai)

- **primary_level:** API (CRUD endpoints + authorization + audit + status protection); E2E untuk halaman & komponen dialog.

### Requirement → Skenario (tanpa duplikasi lintas level)

| # | Requirement | Skenario | Level | Prioritas | Catatan dedup / red |
|---|-------------|----------|-------|-----------|---------------------|
| 1 | Req 1.1 | GET `/api/admin/owners` sesi COO → 200 dengan daftar owner | API | P0 | Endpoint belum ada (red: 404) |
| 2 | Req 1.2 | GET `/api/admin/owners` sesi non-COO → 403 envelope | API | P0 | AD-8; red: 404 |
| 3 | Req 1.3 | GET `/api/admin/owners` tanpa sesi → 401 envelope | API | P0 | AD-8; red: 404 |
| 4 | Req 2.1 | GET `/api/admin/owners/:id` sesi COO → 200 dengan owner + emergency contact + bank account | API | P1 | Red: 404 |
| 5 | Req 2.2 | PUT `/api/admin/owners/:id` update fullName/alias/phoneNumber → 200 + audit tercatat | API | P0 | AD-3; red: 404 |
| 6 | Req 2.3 | PUT `/api/admin/owners/:id` update emergencyContact → 200 + audit tercatat | API | P1 | AD-3; red: 404 |
| 7 | Req 2.4 | PUT `/api/admin/owners/:id` update bankAccount → 200 + audit tercatat | API | P1 | AD-3; red: 404 |
| 8 | Req 2.5 | PUT `/api/admin/owners/:id` dengan field email → 400 envelope (email immutable) | API | P1 | Red: 404 |
| 9 | Req 3.1 | POST `/api/admin/owners` dengan email valid → 201 owner dengan status `terverifikasi` | API | P0 | Property 6; red: 404 |
| 10 | Req 3.2 | POST `/api/admin/owners` dengan email duplikat → 409 envelope | API | P0 | Property 3; red: 404 |
| 11 | Req 3.3 | POST `/api/admin/owners` → audit tercatat dengan action `kelola-owner-penambahan` | API | P1 | AD-3; red: 404 |
| 12 | Req 4.1 | GET `/api/admin/owners` memuat SEMUA owner termasuk status `keluar` | API | P1 | FR-13; red: 404 |
| 13 | Req 5.1 | PUT `/api/admin/owners/:id` dengan field `status` → 400 envelope STATUS_CHANGE_FORBIDDEN | API | P0 | Property 2, AD-11; red: 404 |
| 14 | Req 5.2 | PUT `/api/admin/owners/:id` tanpa field `status` diizinkan | API | P1 | AD-11; red: 404 |
| 15 | Req 1.1 | `/admin/owners` sesi COO: halaman tampil dengan tabel/card daftar owner | E2E | P0 | Red: halaman belum ada |
| 16 | Req 1.2 | `/admin/owners` sesi non-COO: redirect dengan pesan error | E2E | P1 | AD-8; red: halaman belum ada |
| 17 | Req 2 | Edit dialog: COO klik edit → dialog terbuka → isi form → simpan → data tersimpan | E2E | P1 | Red: komponen belum ada |
| 18 | Req 3 | Add dialog: COO klik tambah → dialog terbuka → isi email → simpan → owner baru muncul | E2E | P1 | Red: komponen belum ada |
| 19 | Req 4.2 | OwnerPicker: menampilkan search, dapat filter owner by name/email | E2E | P2 | Red: komponen belum ada |

- **Component test:** tidak terpisah — perilaku komponen OwnerPicker, OwnerEditDialog, OwnerAddDialog diassert di E2E halaman `/admin/owners`.
- **Contract (Pact):** tidak ada — gerbang relevansi TUTUP.
- **Sudah hijau, TIDAK diduplikasi:** konstanta audit action (`kelola-owner-perubahan` sudah ada), `findActiveCooTenure` (sudah hijau), envelope error seragam (`server/utils/api-error.ts`).
- **data-testid baru (akan ditambah ke TEST_IDS):**
  - `admin-owners-halaman`: kontainer halaman
  - `admin-owners-tabel`: tabel daftar owner
  - `admin-owners-tambah`: tombol tambah owner
  - `admin-owners-edit`: tombol edit owner
  - `owner-picker`: komponen picker
  - `owner-edit-dialog`: dialog edit
  - `owner-add-dialog`: dialog tambah
- **Red-phase:** seluruh scaffold baru dirancang GAGAL sebelum implementasi (endpoint 404; halaman belum ada).

## Step 4: Aggregate — TDD Red Phase (selesai)

- **File yang akan ditulis:**
  - `tests/e2e/admin-owners.api.spec.ts` — 14 test API red-phase (CRUD, authorization, audit, status protection)
  - `tests/e2e/admin-owners.spec.ts` — 5 test E2E red-phase (halaman, dialog, picker)
- **Total:** 19 skenario (API 14, E2E 5)
- **Prioritas breakdown:** P0×6, P1×11, P2×2

## TDD Red Phase (saat ini)

✅ Checklist red-phase tergenerasi — test scaffold ditulis di task 1.2 dan 1.3.

### API Tests (`tests/e2e/admin-owners.api.spec.ts`)

| # | Skenario | Status | Prioritas |
|---|----------|--------|-----------|
| 1 | GET /api/admin/owners tanpa sesi → 401 | 🔴 skip | P0 |
| 2 | GET /api/admin/owners sesi non-COO → 403 | 🔴 skip | P0 |
| 3 | GET /api/admin/owners sesi COO → 200 list | 🔴 skip | P0 |
| 4 | GET /api/admin/owners/:id sesi COO → 200 detail | 🔴 skip | P1 |
| 5 | PUT /api/admin/owners/:id update identity → 200 + audit | 🔴 skip | P0 |
| 6 | PUT /api/admin/owners/:id update emergencyContact → 200 + audit | 🔴 skip | P1 |
| 7 | PUT /api/admin/owners/:id update bankAccount → 200 + audit | 🔴 skip | P1 |
| 8 | PUT /api/admin/owners/:id dengan email → 400 | 🔴 skip | P1 |
| 9 | PUT /api/admin/owners/:id dengan status → 400 STATUS_CHANGE_FORBIDDEN | 🔴 skip | P0 |
| 10 | PUT /api/admin/owners/:id tanpa status diizinkan | 🔴 skip | P1 |
| 11 | POST /api/admin/owners email valid → 201 terverifikasi | 🔴 skip | P0 |
| 12 | POST /api/admin/owners email duplikat → 409 | 🔴 skip | P0 |
| 13 | POST /api/admin/owners → audit kelola-owner-penambahan | 🔴 skip | P1 |
| 14 | GET /api/admin/owners memuat owner status keluar | 🔴 skip | P1 |

### E2E Tests (`tests/e2e/admin-owners.spec.ts`)

| # | Skenario | Status | Prioritas |
|---|----------|--------|-----------|
| 15 | /admin/owners sesi COO: halaman tampil | 🔴 skip | P0 |
| 16 | /admin/owners sesi non-COO: redirect | 🔴 skip | P1 |
| 17 | Edit dialog: buka → isi → simpan | 🔴 skip | P1 |
| 18 | Add dialog: buka → isi email → simpan | 🔴 skip | P1 |
| 19 | OwnerPicker: search dan filter | 🔴 skip | P2 |

## Cakupan Requirement

| Requirement | API Tests | E2E Tests |
|-------------|-----------|-----------|
| Req 1: Page Access | #1, #2, #3 | #15, #16 |
| Req 2: Edit with Audit | #4, #5, #6, #7, #8 | #17 |
| Req 3: Add Manual Entry | #11, #12, #13 | #18 |
| Req 4: Owner Picker | #14 | #19 |
| Req 5: Status Protection | #9, #10 | — |

## Cakupan Correctness Properties

| Property | Tests |
|----------|-------|
| Property 1: Audit Atomicity | #5, #6, #7, #13 |
| Property 2: Status Immutability | #9, #10 |
| Property 3: Email Uniqueness | #12 |
| Property 4: Module Ownership | (arsitektur, tidak ditest langsung) |
| Property 5: COO Authorization | #1, #2, #3, #16 |
| Property 6: New Owner Status | #11 |

## Asumsi Kontrak (selaraskan saat green-phase)

1. **GET /api/admin/owners** — auth wajib (401 envelope); non-COO (403 envelope); COO → 200 `{ owners: Array<OwnerSummary> }` memuat SEMUA owner termasuk `keluar`
2. **GET /api/admin/owners/:id** — 200 `{ owner, emergencyContact, bankAccount }` untuk COO; 404 bila tidak ditemukan
3. **PUT /api/admin/owners/:id** — 200 `{ owner }` untuk update valid; 400 bila ada field `status` (STATUS_CHANGE_FORBIDDEN); 400 bila ada field `email`; audit tercatat in-tx dengan action `kelola-owner-perubahan`
4. **POST /api/admin/owners** — 201 `{ owner }` dengan status `terverifikasi`; 409 bila email duplikat (EMAIL_EXISTS); audit tercatat in-tx dengan action `kelola-owner-penambahan`
5. **Mint sesi COO:** menggunakan `mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })` (pattern existing dari audit.api.spec.ts)
6. **Envelope error seragam:** `{ code, message, details }` — reuse dari `server/utils/api-error.ts`

## Panduan Implementasi (DEV)

### Domain Layer
- `shared/domain/audit.ts`: tambah `'kelola-owner-penambahan'` (kebab-case, `'kelola-owner-perubahan'` sudah ada)
- `server/domain/identity/owner.schemas.ts`: Zod schema untuk update dan create input; import `DAFTAR_HUBUNGAN` dari `#shared/domain/profil`
- `server/domain/identity/owner.service.ts`: `listOwners()`, `getOwnerById()`, `updateOwner()`, `createOwnerByCoo()` — semua dengan audit in-tx (AD-3)
- `server/domain/identity/index.ts`: export function baru

### API Layer
- `server/api/admin/owners/index.get.ts`: COO authorization via `findActiveCooTenure`, return list semua owner
- `server/api/admin/owners/[id].get.ts`: COO authorization, join emergency contact dan bank account
- `server/api/admin/owners/[id].put.ts`: validate input, reject `status` field (AD-11), reject `email` field, audit in-tx
- `server/api/admin/owners/index.post.ts`: validate email uniqueness (409), set status `terverifikasi`, audit in-tx

### UI Layer
- `app/components/admin/OwnerPicker.vue`: combobox dengan search, include semua owner
- `app/components/admin/OwnerEditDialog.vue`: sheet/dialog dengan form sections (identitas, kontak, kontak darurat, rekening bank); status disabled
- `app/components/admin/OwnerAddDialog.vue`: email required, note pre-approved status
- `app/pages/admin/owners.vue`: COO-only middleware, table/card list, integrate dialogs

### TEST_IDS (tambahkan ke `tests/support/helpers/test-ids.ts`)
```typescript
adminOwners: {
  halaman: 'admin-owners-halaman',
  tabel: 'admin-owners-tabel',
  tambah: 'admin-owners-tambah',
  edit: 'admin-owners-edit',
},
ownerPicker: 'owner-picker',
ownerEditDialog: 'owner-edit-dialog',
ownerAddDialog: 'owner-add-dialog',
```

## Next Steps (aktivasi per tugas)

1. **Task 1.2**: Buat file `tests/e2e/admin-owners.api.spec.ts` dengan 14 test `test.skip()` mengikuti pola `audit.api.spec.ts`
2. **Task 1.3**: Buat file `tests/e2e/admin-owners.spec.ts` dengan 5 test `test.skip()` untuk E2E
3. **Task 2.x - 4.x**: Implementasi domain, API, UI
4. **Task 5.x**: Hapus `test.skip()` dan jalankan test — verifikasi green

---

**Generated by:** Kiro Spec Task Executor
**Workflow:** `bmad-testarch-atdd`
**Date:** 2026-09-20
