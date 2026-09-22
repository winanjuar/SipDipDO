---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-21'
storyId: '1.7'
storyKey: '1-7-role-matriks-keterbukaan-navigasi'
storyFile: '_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-7-role-matriks-keterbukaan-navigasi.md'
generatedTestFiles: ['tests/e2e/personal.api.spec.ts', 'tests/e2e/matriks-akses.spec.ts', 'tests/e2e/navigasi.spec.ts', 'tests/e2e/personal.spec.ts', 'shared/domain/identity.test.ts', 'tests/support/helpers/test-ids.ts']
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md'
  - '_bmad-output/planning-artifacts/epics/epic-1.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/atdd-checklist-1-5-kelengkapan-profile-11-field.md'
  - 'playwright.config.ts'
  - 'package.json'
  - 'tests/README.md'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/auth-fixture.ts'
  - 'tests/support/helpers/sesi-minting.ts'
  - 'tests/support/helpers/test-ids.ts'
  - 'tests/e2e/auth-landing.spec.ts'
  - 'tests/e2e/profil.api.spec.ts'
  - 'tests/e2e/kelengkapan-profil.spec.ts'
  - 'server/api/test/login.post.ts'
  - 'server/api/landing.get.ts'
  - 'server/domain/identity/access.service.ts'
  - 'server/middleware/auth-guard.ts'
  - 'shared/domain/identity.ts'
---

# ATDD Checklist — Story 1.7 Role, Matriks Keterbukaan & Navigasi (selesai)

## Step 1: Preflight & Context (selesai)

- **detected_stack:** `fullstack` (Nuxt 4 Vue + `server/api` + Drizzle; tanpa indikator mobile)
- **Prasyarat:** story approved — spec frozen `spec-1-7-role-matriks-keterbukaan-navigasi.md` (ready-for-dev; intent/boundary beku + matriks I/O 16 baris + code map); `playwright.config.ts` (testDir `./tests/e2e`, 3 browser, locale id-ID, tz Asia/Jakarta); env dev tersedia
- **Story:** `storyId=1.7`, `storyKey=1-7-role-matriks-keterbukaan-navigasi`, `storyFile` = spec frozen (sumber skenario utama: matriks I/O + Design Notes + Verification)
- **Red-state saat scaffold:** predikat `aksesPenuh`/`perluReferral`/`layakPilihanReferral`, registry `PERMUKAAN_PERAN`/`permukaanDibolehkan`/`itemNavigasi`, konstanta `PESAN_TRANSPARANSI`/`MAKS_ITEM_NAV_MOBILE` BELUM ada di `shared/domain/identity.ts`; `auth-guard.ts` hanya gerbang calon 1.5 (tanpa gerbang role — tanpa_saham saat ini bisa buka `/dashboard`); `GET /api/personal` belum ada; `app/layouts/` belum ada; `personal.vue` masih kerangka 1.2
- **Hijau reusable (tidak diduplikasi):** sesi-mint CUKUP tanpa asumsi test-infra baru — preset `'tanpa-saham'`={terverifikasi, tanpa saham}, preset `'keluar'`={keluar, `punyaSaham:true` → firstEffectiveAt terisi}, override `punyaSaham:false` = keluar-belum-beli; upsert-by-email memungkinkan pola **dua-langkah** (mint `diajukan` → PUT `/api/profile` hijau 1.5 → re-mint `terverifikasi` = owner profil lengkap); `resolveRole`/`buildPrincipal`/`LANDING_PATH`; auth-guard sesi→login + gerbang calon; `identity.test.ts` eksisting (LANDING_PATH + kode referral) tetap hijau
- **TEA flags:** `tea_use_playwright_utils=true` (mandate AKTIF), `tea_use_pactjs_utils=true` TETAPI gerbang relevansi TUTUP (satu aplikasi Nuxt 4, bukan microservices → tanpa contract test), `tea_pact_mcp=none`, `tea_browser_automation=auto`, `test_stack_type=auto`
- **Knowledge loaded:** `playwright-utils-mandate` (substitusi wajib + banned patterns — terwarusi `tests/README.md` "Aturan mutlak"), `api-request`, `auth-session`, `intercept-network-call`, `network-error-monitor`, `recurse`, `selector-resilience`, `data-factories`, `test-quality`, `fixtures-composition`; dilewati: `file-utils`, `network-recorder`, `ci-burn-in`, `playwright-cli`, pactjs-* (gerbang tutup)
- **Selaras test-design:** `1-UNIT-001` subset lanjutan (predikat+registry), `1-API-001` (authorization matrix — permukaan API baru `/api/personal`), `1-E2E-002` (navigasi per role + URL langsung → redirect), R-003 (matriks keterbukaan batas server — P0), R-005/R-008 tak relevan langsung

## Step 2: Generation Mode (selesai)

- **Mode:** AI generation (default). Spec frozen dengan matriks I/O eksplisit; skenario standar (gating SSR, registry, halaman section); **recording mustahil** — UI (layout, sidebar, bottom nav, personal 4 section, endpoint personal) belum ada (red-phase); selektor dikunci dari kontrak TEST_IDS baru + pola spec eksisting
- **Env terkonfirmasi:** triple-guard mint (`ENABLE_TEST_AUTH=1`, `TEST_AUTH_SECRET`) eksisting — tidak ada kontrak test-infra baru

## Step 3: Test Strategy (selesai)

- **primary_level:** Unit (matriks predikat & registry — matematika keterbukaan termurah & paling presisi); API (kontrak endpoint `/api/personal`); E2E (redirect batas server SSR, navigasi registry-driven, Halaman Personal 4 section)

### Skenario → level (tanpa duplikasi lintas level)

| # | Skenario | Level | Prioritas | File | Catatan red |
|---|----------|-------|-----------|------|-------------|
| U1 | Predikat 7 kombinasi {status × firstEffectiveAt} → (aksesPenuh, perluReferral, layakPilihanReferral) | Unit | P0 | `identity.test.ts` | Fungsi belum diekspor → dynamic import + cast; `test.skip` |
| U2 | Konstanta `PESAN_TRANSPARANSI` verbatim + `MAKS_ITEM_NAV_MOBILE`=4 | Unit | P2 | `identity.test.ts` | Idem |
| U3 | `permukaanDibolehkan` matriks 17 kasus role×path (keluar-pernah-beli lolos `/dashboard`; coo×/personal ditolak; unlinked false) | Unit | P0 | `identity.test.ts` | Registry belum ada |
| U4 | `itemNavigasi` registry eksak per role + guard ≤4 (Sheet tak terpicu Epic 1) | Unit | P1 | `identity.test.ts` | Idem |
| A1 | GET `/api/personal` tanpa sesi → 401 envelope | API | P0 | `personal.api.spec.ts` | 404 → skema gagal |
| A2 | tanpa_saham terverifikasi profil lengkap (seed dua-langkah) → 200 {email, status, 10 field, profileComplete:true} | API | P0 | `personal.api.spec.ts` | 404 |
| A3 | calon → 403; A4 pemegang_saham → 403; A5 coo → 403 | API | P1 | `personal.api.spec.ts` | 404 |
| A6 | keluar-pernah-beli → 200 status `keluar` (resolveRole sebelum firstEffectiveAt — AD-8) | API | P1 | `personal.api.spec.ts` | 404 |
| E1 | tanpa_saham belum-beli × `/dashboard` → redirect `/personal?info=transparansi` + Alert verbatim aria-live polite + URL bersih + reload tak mengulang | E2E | P0 | `matriks-akses.spec.ts` | Gerbang role belum ada → tanpa redirect |
| E2 | × `/antrian-beli`; E3 × `/audit-trail` → redirect sama | E2E | P0 | `matriks-akses.spec.ts` | Idem |
| E4 | keluar belum-beli × `/dashboard` → redirect (cakupan AD-11) | E2E | P1 | `matriks-akses.spec.ts` | Idem |
| E5 | **keluar PERNAH-beli × `/dashboard` → 200** (aksesPenuh — bukan role saja; kunci AD-8) | E2E | P0 | `matriks-akses.spec.ts` | Idem |
| E6 | pemegang_saham × `/antrian-beli`; E7 × `/audit-trail` → `/dashboard` | E2E | P1 | `matriks-akses.spec.ts` | Idem |
| E8 | coo × `/personal` → `/antrian-beli` | E2E | P1 | `matriks-akses.spec.ts` | Idem |
| E9 | calon diajukan × `/dashboard` → tetap gerbang 1.5 `/profile-completeness` (precedence) | E2E | P1 | `matriks-akses.spec.ts` | Regresi precedence |
| N1 | coo mobile bottom nav 3 item tanpa "Lainnya" + aria-current | E2E | P1 | `navigasi.spec.ts` | Nav belum ada |
| N2 | pemegang_saham mobile: hanya Dashboard; terkunci toHaveCount(0) (UX-DR14) | E2E | P0 | `navigasi.spec.ts` | Idem |
| N3 | tanpa_saham belum-beli mobile: hanya Personal; Dashboard absen | E2E | P1 | `navigasi.spec.ts` | Idem |
| N4 | coo desktop sidebar 3 item + logo → landing role | E2E | P1 | `navigasi.spec.ts` | Idem |
| P1 | Halaman Personal 4 section: Profile terisi; portofolio/pesanan kosong; Harga & RKAP aria-disabled; pintu Pesanan disabled + keterangan | E2E | P0 | `personal.spec.ts` | Halaman kerangka |
| P2 | GET `/api/personal` gagal (stub 500) → state kosong + pesan coba lagi | E2E | P1 | `personal.spec.ts` | Idem |

- **Contract (Pact):** tidak ada — gerbang relevansi TUTUP. **Component:** tidak ada — perilaku halaman diassert di E2E by-role/by-testid.
- **Keputusan cakupan:** jalur Sheet "Lainnya" (>4 item) TIDAK discaffold E2E — registry Epic 1 maks 3 item (coo) sehingga tak terpicu data nyata; digantikan guard unit (U4); E2E Sheet menyusul saat Epic 2–3 menambah item. Tanpa sesi × permukaan → `/login` TIDAK diduplikasi (sudah hijau di `auth-landing.spec.ts`).

## Step 4: Aggregate — TDD Red Phase (selesai)

- **Eksekusi:** SUBAGENT (API + E2E paralel) — Worker 4A & 4B selesai; agregasi + validasi orkestrator
- **Validasi TDD:** PASS — 21 test Playwright memakai `test.skip()` (API 6 + E2E 15) + 7 unit memakai `test.skip()`; tanpa placeholder `expect(true).toBe(true)`; semua `expected_to_fail=true`; nol pelanggaran mandate di baris kode (gate agregat menolak tulis sebelum diverifikasi — false positive pertama berasal dari komentar aturan, bukan kode)
- **Verifikasi (step-05):** `eslint` PASS (6 file); `nuxt typecheck` PASS (exit 0); `vitest run shared/domain` = 56 passed + 7 skipped (suite hijau utuh); `playwright test --list` penuh = 312 tests / 16 files terkoleksi bersih; scaffold baru = 63 collected (21 × 3 browser) semua skip; tanpa CLI session yatim
- **File ditulis ke disk:**
  - `tests/e2e/personal.api.spec.ts` — 6 test API red-phase (401/403×3/200×2)
  - `tests/e2e/matriks-akses.spec.ts` — 9 test E2E red-phase (gerbang role SSR + Alert transparansi)
  - `tests/e2e/navigasi.spec.ts` — 4 test E2E red-phase (bottom nav mobile + sidebar desktop)
  - `tests/e2e/personal.spec.ts` — 2 test E2E red-phase (4 section + gagal-muat)
  - `shared/domain/identity.test.ts` — DIPERLUAS 4 blok unit red-phase (dynamic import + cast `Record<string, unknown>` agar suite hijau & typecheck tak pecah; un-skip + impor statis saat green)
  - `tests/support/helpers/test-ids.ts` — blok `navigasi` (batangBawah, sidebar) + `personal` (alertTransparansi, sectionProfil, sectionPortofolio, statusKosong, sectionHargaRkap, pintuPesanan, pesanGagalProfil)
- **Playwright Utils deviations (tercatat, nihil pelanggaran):**
  1. `matriks-akses.spec.ts` + `navigasi.spec.ts` — `interceptNetworkCall` sengaja TIDAK dipakai: redirect/navigasi diputuskan server-side pada dokumen SSR, tak ada fetch client-side layak spy (pola `auth-landing.spec.ts`)
  2. `personal.spec.ts` — ASUMSI fetch GET `/api/personal` client-side agar stub browser diterapkan; bila SSR-side, selaraskan stub saat green-phase tanpa mengubah asersi UI

## TDD Red Phase (saat ini)

✅ Scaffold red-phase tergenerasi — JANGAN hapus `test.skip()`/`it.skip()` kecuali untuk tugas yang sedang diimplementasikan.

- API: 6 test (semua skip) — personal.api
- E2E: 15 test (semua skip) — matriks-akses (9) / navigasi (4) / personal (2)
- Unit: 7 test (semua skip) — identity.test.ts (predikat ×3, konstanta, registry permukaan, itemNavigasi ×2)

## Cakupan AC (spec 1.7)

- AC-1 (gerbang role + pesan transparansi): E2E P0×4 + P1×3 (matriks-akses)
- AC-2 (predikat kanonik, bukan shares live): Unit P0×2 + E2E P0×1 (keluar-pernah-beli) + API P1×1
- AC-3 (navigasi registry-driven): E2E P0×1 + P1×3 + Unit P1×2 (registry + guard)
- AC-4 (Halaman Personal): E2E P0×1 + P1×1 + API P0×2 + P1×4

## Asumsi kontrak (selaraskan saat green-phase)

1. `GET /api/personal` — tanpa sesi 401 envelope; role `tanpa_saham` 200 `{ email, status, ...10 field wire Profil, profileComplete, ... }` (skema zod non-strikt: field tampilan ekstra wire /api/profile boleh hadir); role lain 403 envelope; pola handler `landing.get.ts` + `buildPrincipal`.
2. Redirect gerbang role = `sendRedirect('/personal?info=transparansi')`; pesan `PESAN_TRANSPARANSI` verbatim via Alert `data-testid="personal-alert-transparansi"` `aria-live="polite"`, tampil sekali, URL dibersihkan pasca-mount (pola beda-flag `?daftar=berhasil`).
3. Registry pin: `/dashboard`→aksesPenuh; `/antrian-beli`,`/audit-trail`→coo; `/personal`→tanpa_saham (pemegang_saham × `/personal` → redirect `/dashboard` — turunan prasyarat, bukan di matriks eksplisit spec).
4. Label nav terpin: 'Antrian Beli', 'Dashboard', 'Audit Trail', 'Personal'; item = link by-role; aktif `aria-current="page"`; mobile testid `nav-batang-bawah`, desktop `nav-sidebar`; logo sidebar memakai `TEST_IDS.login.brandLogo` (bila beda, selaraskan testid green-phase — asersi perilaku tak berubah).
5. TEST_IDS.personal: `personal-section-profil`, `personal-section-portofolio` (+ `personal-status-kosong`), `personal-section-harga-rkap` (tautan aria-disabled), `personal-pintu-pesanan` (button disabled + "Terbuka saat pembelian pertama dibuka"), `personal-pesan-gagal-profil`.
6. Unit: kontrak dinamai `aksesPenuh`, `perluReferral`, `layakPilihanReferral`, `permukaanDibolehkan(principal, path)`, `itemNavigasi(role, aksesPenuh)` → `{ label, path }[]`, `PESAN_TRANSPARANSI`, `MAKS_ITEM_NAV_MOBILE` — sesuai code map spec 1.7.

## Next Steps (aktivasi per tugas — urut tugas spec 1.7)

1. Tugas 1 (predikat + registry + konstanta shared/domain): un-skip 7 unit di `identity.test.ts` — ganti dynamic import + cast dengan impor statis; jalankan `npx vitest run shared/domain/identity.test.ts`; verifikasi merah dulu bila diaktifkan sebelum implementasi.
2. Tugas 2 (auth-guard gerbang role + `GET /api/personal`): un-skip `personal.api.spec.ts` + `matriks-akses.spec.ts` → `npx playwright test tests/e2e/personal.api.spec.ts tests/e2e/matriks-akses.spec.ts`.
3. Tugas 3 (layout + sidebar + bottom nav + TEST_IDS.navigasi): un-skip `navigasi.spec.ts`.
4. Tugas 4 (personal.vue 4 section + Alert transparansi): un-skip `personal.spec.ts`.
5. Tugas 5 (regresi): `npx playwright test` penuh + `npm run lint && npm run typecheck` — suite 1.1–1.5 WAJIB tetap hijau (Never: kontrak hijau eksisting `/api/profile`, `/api/register*`, `/api/audit`, `/api/landing`, `LANDING_PATH`, `resolveRole`, gerbang calon 1.5 tidak berubah).
6. Bila masih gagal: perbaiki implementasi ATAU test (dengan alasan tercatat). Headed/debug: `npx playwright test <file> --headed` / `--debug`.

## Panduan implementasi (DEV)

- `shared/domain/identity.ts` — TAMBAH: `PESAN_TRANSPARANSI`, `MAKS_ITEM_NAV_MOBILE`, predikat murni, `PERMUKAAN_PERAN`, `permukaanDibolehkan`, `itemNavigasi`; ekspor via `server/domain/identity/index.ts` (AD-5). SEMANTIK terpin: `aksesPenuh(s)=firstEffectiveAt!==null`; `perluReferral(s)=(status∈{terverifikasi,keluar})&&firstEffectiveAt===null`; `layakPilihanReferral(s)=aksesPenuh(s)||status∈{terverifikasi,keluar}`.
- `server/middleware/auth-guard.ts` — perluas BERURUTAN: sesi → unlinked passthrough → gerbang calon 1.5 (eksisting tak berubah) → gerbang role via `permukaanDibolehkan` (tanpa_saham !aksesPenuh × terkunci → `/personal?info=transparansi`; role salah → `LANDING_PATH[role]`).
- `server/api/personal/index.get.ts` — BARU pola `landing.get.ts`; repo `findOwnerByEmail`; read-only; audit TIDAK diperlukan (operasi baca).
- `app/layouts/app.vue` + `AppSidebar.vue` + `AppBottomNav.vue` — BARU; hanya permukaan ber-nav; Sheet "Lainnya" bila item > 4 (tak terpicu Epic 1).
- `app/pages/personal.vue` — 4 section; Alert baca `route.query.info=transparansi` → sekali → `history.replaceState` URL bersih; `useAsyncData` GET `/api/personal`.
- Tanpa fungsi set-DB `pilihanReferral(tx)` (Epic 3); tanpa konten Epic 2/3; tanpa jalur tulis status (1.6 milik tim lain).

## Ringkasan

- **Checklist:** `_bmad-output/test-artifacts/atdd-checklist-1-7-role-matriks-keterbukaan-navigasi.md`
- **Story/handoff:** `_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md` (ready-for-dev) → workflow berikutnya: **bmad-build / dev-story** (aktivasi scaffold per tugas); `automate`/trace menyusul pasca-implementasi
- **Total scaffold:** 28 red (21 Playwright + 7 unit) + 2 blok TEST_IDS; eksekusi subagent paralel
- **Risiko/asumsi utama:** (1) asumsi fetch client-side di `personal.spec.ts` (stub 500) — selaraskan saat green bila SSR; (2) logo sidebar dipin testid login; (3) pin `pemegang_saham × /personal` → `/dashboard` sebagai turunan prasyarat registry; (4) Sheet "Lainnya" ditunda ke Epic 2–3 (guard unit penggantinya)
- **Summary JSON:** `/tmp/tea-atdd-summary-2026-09-21T13-09-19.json`
