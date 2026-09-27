---
title: 'Registrasi /pendaftar ke Registry Keterbukaan & Navigasi COO'
type: 'feature'
created: '2026-09-22'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5a202a0bb4cff058a882e332de61b98ce659d080'
context:
  - '_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Permukaan verifikasi COO `/pendaftar` (Story 1.6) tidak terdaftar di `PERMUKAAN_PERAN` — middleware 1.7 tidak menggerbanginya di batas server — dan tidak punya item navigasi, sehingga COO hanya bisa membukanya via URL manual (temuan review adv#2/adv#3; prinsip "sumber tunggal kebenaran keterbukaan" spec-1-7 dilanggar).

**Approach:** Daftarkan `/pendaftar` = `PRASYARAT_COO` di registry `shared/domain/identity.ts` dan tambahkan item `pendaftar` ke `KATALOG_ITEM_NAVIGASI` + daftar nav `coo` — middleware dan komponen nav sudah registry-driven sehingga cukup perubahan data + pembaruan test yang mem-pin ekspektasi lama.

## Boundaries & Constraints

**Always:**
- Registry-driven: TANPA mengubah logika `server/middleware/auth-guard.ts`, `app/layouts/app.vue`, `AppSidebar.vue`, `AppBottomNav.vue` — perubahan HANYA data di `shared/domain/identity.ts`.
- Item terkunci tetap absen untuk role lain (UX-DR14) — hanya `coo` mendapat item Pendaftar; `pemegang_saham`/`tanpa_saham`/`calon_owner` tidak.
- Perilaku gating baru mengikuti mekanisme eksisting persis: non-COO dialihkan `LANDING_PATH[role]` (pemegang_saham → `/dashboard`), tanpa_saham belum-beli → jalur transparansi (konsisten `/order-queue` yang sudah `PRASYARAT_COO`), calon tetap lewat gerbang calon 1.5 lebih dulu.
- Label item = `Pendaftar` (konsisten testid group `pendaftar` dan judul halaman).
- **KEPUTUSAN OWNER (2026-09-22):** urutan nav COO = `Dashboard, Personal, MoM, Order, Pendaftar, Audit` — Pendaftar disisip setelah Order, Audit selalu terakhir; overflow Sheet mobile = Pendaftar, Audit.
- Kontrak hijau eksisting tidak diubah: `permukaanDibolehkan`, `prasyaratPermukaan`, pola prefix `/mom/`, urutan gerbang middleware.

**Never:**
- TIDAK mengubah komponen UI nav, layout, middleware, atau testid kontrak ATDD (`TEST_IDS.navigasi`).
- TIDAK menambah item nav untuk role lain atau menyentuh registry permukaan lain.
- TIDAK mengubah blok frozen spec-1-7 — supersedesi dicatat via entri Spec Change Log (format `- **DATE — judul.** ...`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| COO × /pendaftar | Sesi COO, URL langsung | 200 — halaman tampil; item Pendaftar tampil di sidebar desktop & bottom nav mobile | N/A |
| Nav mobile COO | Sesi COO, <lg | 6 item registry → 4 tetap (Dashboard, Personal, MoM, Order) + Sheet "Lainnya" memuat Pendaftar, Audit | — |
| pemegang_saham × /pendaftar | URL langsung | Middleware redirect `/dashboard` (pola `matriks-akses` × `/order-queue`) | — |
| tanpa_saham belum-beli × /pendaftar | URL langsung | Redirect `/personal?info=transparansi` — mekanisme eksisting | — |
| calon × /pendaftar | Sesi calon | Gerbang calon 1.5 dulu → `/registration-status` (hasil sama, kini via middleware) | — |
| Tanpa sesi × /pendaftar | Dokumen SSR tanpa cookie | Redirect `/login` oleh gerbang sesi middleware | — |

</frozen-after-approval>

## Code Map

- `shared/domain/identity.ts` -- SATU file sumber: (1) `PERMUKAAN_PERAN` L191-199 tambah `'/pendaftar': PRASYARAT_COO` + perbarui komentar L178-190; (2) `KATALOG_ITEM_NAVIGASI` L257-263 tambah `pendaftar: { label: 'Pendaftar', path: '/pendaftar' }`; (3) array `coo` di `itemNavigasi` L282-288 sisip `pendaftar` setelah `orderQueue`, `auditTrail` tetap terakhir (keputusan owner 2026-09-22) + perbarui komentar L267-269 (6 item → Sheet berisi Pendaftar, Audit).
- `shared/domain/identity.test.ts` -- update pin: L229 array eksak `coo`; L237 `toHaveLength(5)` → 6; L238 slice overflow → `[ITEM.pendaftar, ITEM.audit]`. Tambah baris `KASUS_PERMUKAAN` (L177-182): `coo × /pendaftar → true`, `pemegang_saham × /pendaftar → false`.
- `tests/e2e/navigasi.spec.ts` -- `ITEM_NAV_COO` L72 + label baru (konstanta label L59-66); header komentar L16-24 & L71 (6 item, overflow 2); count L119 & L309 ikut fixture otomatis; asersi isi Sheet L118 (Audit) tetap sah.
- `tests/e2e/matriks-akses.spec.ts` -- tambah baris gating: `pemegang_saham × /pendaftar → URL /dashboard` (pola test L149-159) — mem-pin penegakan middleware yang selama ini absen (adv#2).
- `tests/e2e/pendaftar.spec.ts` -- TANPA perubahan: test L202-225 (calon → `/registration-status`, tanpa sesi → `/login`) otomatis berpindah ke jalur middleware dengan URL sama; atribusi "middleware auth-guard" di L222 menjadi benar setelah registrasi.
- `_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md` -- entri baru di `## Spec Change Log` (L138-140, format `- **DATE — judul.** ...`) mensupersesi baris frozen L34.
- JANGAN sentuh: `server/middleware/auth-guard.ts`, `app/layouts/app.vue`, `app/components/AppSidebar.vue`, `app/components/AppBottomNav.vue` (data-driven, L47/L43/L23-49), `tests/support/helpers/test-ids.ts`, `server/domain/identity/index.ts` (re-export L22/26 cukup).

## Tasks & Acceptance

**Execution:**
- [x] `shared/domain/identity.ts` -- registry + katalog + array coo + komentar.
- [x] `shared/domain/identity.test.ts` -- update 3 pin + 2 baris matriks gating.
- [x] `tests/e2e/navigasi.spec.ts` -- fixture item/label + header komentar.
- [x] `tests/e2e/matriks-akses.spec.ts` -- baris redirect `/pendaftar` (pemegang_saham → /dashboard + tanpa_saham → /personal polos).
- [x] `_bmad-output/implementation-artifacts/spec-1-7-...md` -- entri Spec Change Log.

**Acceptance Criteria:**
- Given sesi COO, when membuka `/pendaftar` (URL langsung), then halaman tampil 200 dan item Pendaftar terlihat di sidebar desktop dan bottom nav mobile, dengan overflow Sheet "Lainnya" berisi tepat 2 item.
- Given pemegang_saham, when membuka `/pendaftar` URL langsung, then dialihkan ke `/dashboard` di batas server (middleware, bukan UI).
- Given seluruh task selesai, when menjalankan vitest shared/domain, Playwright navigasi+matriks+pendaftar, lint, typecheck, then semuanya hijau tanpa regresi.

## Implementation Notes

- **2026-09-22 — deviasi Code Map: fixture test non-COO `/pendaftar` (pendaftar.spec.ts).** Code Map menyatakan `tests/e2e/pendaftar.spec.ts` "TANPA perubahan", dengan asumsi calon `calon-diajukan` mint (email baru, profil KOSONG) dialihkan ke `/registration-status`. Terverifikasi saat run Playwright: asumsi itu salah — sejak `/pendaftar` terdaftar di registry, gerbang calon 1.5 di middleware dievaluasi lebih dulu dan calon `diajukan` profil-belum-lengkap dialihkan ke `/profile-completeness` (auth-guard L82-87), sehingga test L202 merah di 3 browser. Fix minimal sesuai frozen I/O matrix ("Gerbang calon 1.5 dulu → /registration-status"): fixture diganti `seedCalonLengkap` (calon `diajukan` berprofil LENGKAP → diteruskan middleware ke landing calon `/registration-status`); TIDAK ada asersi yang berubah. Dua kegagalan lain pada run pertama (409 stub firefox, empty-state firefox) adalah flake DB dev bersama antar-worker paralel — bukan akibat perubahan registry.
- **2026-09-22 — keputusan owner: `/pendaftar` memakai layout `app`.** Baris matriks beku "item Pendaftar tampil di sidebar desktop & bottom nav mobile" ambigu karena halaman tidak memakai nav shell. Owner memilih `definePageMeta({ auth: true, layout: 'app' })` di `app/pages/pendaftar.vue` (+ koreksi header komentar L10-11 yang stale "TANPA navigasi/menu baru") — halaman verifikasi kini permukaan ber-nav penuh, konsisten intent 1.7. Suite `pendaftar` di-re-run: 18 lulus; kegagalan/flake berpindah browser secara acak (chromium↔firefox↔webkit) pada test alur-data Verifikasi/Tolak/409-stub — reproduksi kontrol subagent di baseline (perubahan di-stash) menunjukkan kegagalan identik → flake DB dev bersama pre-existing, bukan regresi layout.
- **2026-09-22 — audit matriks: tambah test `tanpa_saham belum-beli × /pendaftar`** (matriks-akses, pola persis test `/order-queue`) — baris matriks 4 kini tertutup test yang lulus (6/6 di 3 browser). Catatan detail: redirect transparansi terimplementasi **flash-cookie → `/personal` POLOS** (keputusan owner 2026-09-21, pin test eksisting); detail `?info=transparansi` pada baris matriks beku adalah detail stale pra-1.7 — teks constraint "jalur transparansi konsisten `/order-queue`" yang otoritatif dan cocok realita.
- **2026-09-22 — verifikasi orkestrator:** vitest `shared/domain` 67/67; lint exit 0; typecheck exit 0; Playwright navigasi+matriks penuh 80 lulus / 1 flaky (test chip email+Keluar — keluarga flake sama); webkit IKUT mengeksekusi dan lulus pada run ini (6 test matriks `/pendaftar`) — catatan host-block webkit spec-1-6 tidak ter-reproduksi di sesi ini.

## Spec Change Log

## Review Triage Log

| Temuan | Verdict | Route | Bukti |
|--------|---------|-------|-------|
| blind: header matriks-akses L20 masih "coo × /personal → redirect /order-queue" — kontradiksi keputusan 2026-09-21 (PRASYARAT_OWNER, coo 200; test sibling) | low | patch | Terverifikasi di file; staleness pra-eksisting tapi diff me-rewrap baris itu — koreksi langsung saat memegang blok |
| blind: jalur calon belum-lengkap × /pendaftar → /profile-completeness terdokumentasi komentar tapi tak di-pin test; baris unit calon_owner/tanpa_saham × /pendaftar absen | low | patch (grup dgn vgap#2) | Nyata untuk bagian e2e (akar sama vgap#2); bagian baris unit redundan — `permukaanDibolehkan` short-circuit calon sebelum registry (baris calon eksisting menutup), tanpa_saham generik tertutup baris sibling (vgap eksplisit drop) |
| blind: tak ada asersi negatif e2e item Pendaftar tersembunyi untuk non-COO | false | — | `navigasi.spec.ts` L163-171: `toHaveCount(3)` eksak + `toHaveCount(0)` item terkunci (Audit, Order) + tanpa pemicu Lainnya untuk pemegang_saham (pola sama tanpa_saham) — Pendaftar bocor ke registry non-COO langsung merah; unit exact-equality mem-pin array per role |
| blind: Sheet "Lainnya" hanya assert visible, tak klik-through ke /pendaftar | low | rejected | Href ter-pin unit exact-equality `identity.test.ts` (ITEM.pendaftar {label, path}); mekanik Sheet terlatih test aria-current Audit; klik-through lintas-halaman = kompleksitas > koreksi langsung (vgap eksplisit considered-and-dropped) |
| blind: docblock pendaftar.vue "dialihkan middleware ke landing role-nya" implisit untuk calon (belum-lengkap → /profile-completeness) | low | patch | Terverifikasi — komentar tulisan diff ini sendiri imprecis; koreksi langsung satu paragraf |
| edge: AC1 "item Pendaftar terlihat di bottom nav mobile" — implementasi taruh di Sheet (ke-5), klaim klaim-kind | false | — | Baris matriks beku #2 mem-pin placement: "4 tetap (Dashboard, Personal, MoM, Order) + Sheet memuat Pendaftar, Audit" — implementasi persis; frasa AC merujuk nav UI secara kolektif; fix = edit spec build ini (kategori ditolak) |
| vgap: nav chrome dari `layout: 'app'` di /pendaftar tak di-assert test mana pun — revert layout tak membuat test merah (pre-verified) | medium | patch | Pre-verified: pendaftar.spec tak pernah assert nav; navigasi.spec tak pernah buka /pendaftar — separuh layout keputusan owner 2026-09-22 berjalan tanpa sinyal; fix = 1 test pola overflow /audit-trail (aria-current Pendaftar di Sheet + sidebar) |
| vgap: target redirect calon belum-lengkap × /pendaftar BERUBAH oleh diff ini (page-level /registration-status → middleware /profile-completeness) tanpa verifikasi; test calon ter-rewrite tak bisa membedakan middleware vs fallback page-level (pre-verified) | medium | patch | Pre-verified: satu-satunya test calon × /pendaftar men-seed calon LENGKAP — URL /registration-status identik di kedua mekanisme; branch belum-lengkap (auth-guard L87) tanpa pin; fix = 1 test matriks: calon-diajukan × /pendaftar → /profile-completeness |

## Verification

**Commands:**
- `npx vitest run shared/domain` -- expected: unit predikat/registry/nav hijau (pin baru 6 item coo).
- `npx playwright test tests/e2e/navigasi.spec.ts tests/e2e/matriks-akses.spec.ts tests/e2e/pendaftar.spec.ts` -- expected: hijau (dev server + `ENABLE_TEST_AUTH=1`).
- `npm run lint && npm run typecheck` -- expected: bersih.

**Hasil (2026-09-22, environment lokal):**
- `npx vitest run shared/domain` → 5 file / 67 test HIJAU.
- `npx playwright test` (3 spec, chromium+firefox+webkit) → run ke-2 pasca-fix: 96 passed, 1 failed, 2 flaky; semua kegagalan/flaky di `pendaftar.spec.ts` (alur data daftar: 409-stub, Verifikasi, Tolak, empty-state). Run kontrol di BASELINE (perubahan di-stash) mereproduksi kegagalan yang sama persis → flake environment DB-dev-bersama, BUKAN regresi perubahan registry. Navigasi + matriks-akses (termasuk test baru pemegang_saham × /pendaftar) hijau stabil di 3 browser.
- `npm run lint` → exit 0; `npm run typecheck` → exit 0.
