---
title: 'Audit Trail — Pencatatan & Tampilan COO'
type: 'feature'
created: '2026-09-17'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5aa1ffa53b7e4e5dce7d7a98fec809e134d92999'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum ada mekanisme pencatatan aksi yang permanen dan dapat diperiksa — padahal Story 1.4–1.9 mewajibkan setiap aksi (pendaftaran, verifikasi, pergantian COO) tercatat audit dalam transaksi yang sama (AD-3), dan COO harus bisa memeriksanya (FR-12).

**Approach:** Bangun modul AUDIT (`server/domain/audit`): tabel `audit_logs` append-only (jalur UPDATE/DELETE ditutup via DB grants), API publik modul `writeAuditEntry(tx, …)` + registry nama aksi terpusat, endpoint baca khusus COO, dan halaman `/audit-trail` berisi daftar aksi (aktor, waktu, detail) yang hanya dapat dibuka COO.

## Boundaries & Constraints

**Always:**
- Entry audit ditulis dalam transaksi DB yang sama dengan aksinya: helper audit wajib menerima `tx`, tidak pernah async/batch di luar transaksi (AD-3).
- Envelope entry: `{ actor, action, target, details jsonb }`; `actor` = `{ kind: 'user' | 'system', ownerId? }` (user = owner/COO via `owners.id`; system = cron, tanpa ownerId). Aktor audit selalu pejabat saat commit (AD-8) — penentu aktor ada di pemanggil.
- Nama `action` HANYA dari registry terpusat `shared/domain/audit.ts` (murni, tanpa I/O); kolom DB bertipe `text` + validasi registry di service — registry tumbuh tanpa migrasi.
- Modul lain menulis/membaca audit hanya lewat `server/domain/audit/index.ts` (AD-5); Drizzle hanya di `audit.repo.ts`.
- Kewenangan baca ditegakkan di server: role `coo` dari `buildPrincipal` (per-request, `coo_tenures` berlaku) — tidak pernah di klien saja (AD-8).
- Konvensi repo: ID uuid, `timestamptz` mode string, konstanta bernama tanpa magic number, error API `{ code, message, details }`.
- **Keputusan (2026-09-17):** append-only ditegakkan PENUH di DB — role non-superuser `app_runtime` + grants, dan `NUXT_DATABASE_URL` (dev & produksi) memakai `app_runtime`; runbook disiapkan.
- **Keputusan (2026-09-17):** tampilan `/audit-trail` MINIMAL — tabel + paginasi tautan tanpa filter actor/action/rentang waktu; filter menyusul di story lain saat volume data ada.

**Never:**
- Tanpa jalur UPDATE/DELETE `audit_logs` di kode (repo insert & select saja) maupun di DB (grants — keputusan penuh 2026-09-17 di atas).
- Audit TIDAK dipakai modul lain untuk keputusan bisnis (AD-3) — hanya tampilan COO.
- Bukan scope: item navigasi & matriks keterbukaan penuh (Story 1.7), pesan "pembuka akses" UX lengkap (1.7), penulisan aksi nyata 1.4–1.9, hitungan penolakan IA#16 (data ada mulai 1.6).
- Tanpa infinite scroll untuk daftar (UX melarang) — paginasi tautan.
- Jangan mengubah: modul `identity`, bentuk envelope error (hanya boleh MENAMBAH status 403), migrasi lama, halaman/testid existing, konfigurasi auth/PWA.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| COO membuka `/audit-trail` | Sesi COO valid, DB berisi entry | Daftar entry terbaru: waktu (id-ID, Asia/Jakarta), aktor (email owner / "System"), action, target, detail JSON | Kosong → empty state kerangka (pola `antrian-beli.vue`); gagal muat → pesan + Coba lagi |
| Non-COO membuka `/audit-trail` URL langsung | Sesi `pemegang_saham`/`tanpa_saham`/`calon_owner` | Redirect ke `LANDING_PATH[role]` (pola `status.get.ts`) | N/A |
| Belum login membuka `/audit-trail` | Tanpa sesi | Middleware `auth-guard` → `/login` | N/A |
| `GET /api/audit` tanpa sesi | Tanpa cookie | 401 envelope `{ code, message, details }` | N/A |
| `GET /api/audit` sesi non-COO | Role bukan `coo` | 403 envelope (status baru) | N/A |
| `GET /api/audit` sesi COO | `?page=N` (default 1) | 200 `{ data: [...], nextPage }`; urut `created_at` desc; `nextPage: null` bila habis; LIMIT konstanta bernama (100) | Query `page` tidak valid → 400 envelope |
| `writeAuditEntry` dengan action di luar registry | `action: 'x'` | Ditolak — throw sebelum INSERT | Pesan menyebut registry |
| `writeAuditEntry` tanpa `tx` | db biasa, bukan transaksi | Ditolak — throw (kontrak in-tx AD-3) | Pesan menyebut kewajiban tx |
| UPDATE/DELETE `audit_logs` via SQL sebagai role runtime | `SET ROLE app_runtime; UPDATE …` | Ditolak permission denied oleh grants | N/A |

</frozen-after-approval>

## Code Map

- `server/domain/audit/index.ts`, `audit.service.ts`, `audit.repo.ts` -- stub `export {}` dengan kontrak TODO Story 1.3 sudah tertulis di docstring (service: `writeAuditEntry(tx, { actor, action, target, details })`) — isi di sini, bentuk meniru modul identity.
- `server/domain/identity/` -- contoh bentuk matang: repo fungsi modul-level menerima `DbClient` (`owner.repo.ts:122-127` factory `createIdentityRepo`), service murni + DI (`access.service.ts`), barrel `index.ts` selektif; unit test co-located `*.test.ts`.
- `server/utils/db.ts` -- `Db`/`Tx`/`DbClient` untuk tanda tangan repo/service; `server/utils/api-error.ts` -- `HTTP_STATUS` (tambah `forbidden: 403`), `sendApiError`; `server/utils/session.ts` -- `getSessionEmail(event)`.
- `server/api/landing.get.ts:12-26`, `server/api/pendaftaran/status.get.ts:13-28` -- pola handler: sesi → `buildPrincipal(createIdentityRepo(useDb()), email)` → role salah `sendRedirect(LANDING_PATH[role])`; `server/middleware/auth-guard.ts` -- hanya cek sesi (jangan diubah).
- `drizzle/schema.ts` -- pola tabel (uuid pk `defaultRandom`, timestamptz string, jsonb, JSDoc kepemilikan modul); `owners` = target FK `actor_owner_id`; migrasi via `npm run db:generate` + `db:migrate` (`drizzle.config.ts`, fallback Supabase lokal).
- `snd-dash/snd-dash/server/domain/audit/` (proyek lama, REFERENSI jangan disalin mentah) -- registry `AUDIT_ACTIONS` as const + `isAuditAction` (`events.ts`), repo insert-only + `query` ber-filter (`audit.repo.ts`), grants append-only (`drizzle/grants.sql`, `drizzle/runtime-role.sql`: role `app_runtime` non-superuser — REVOKE tidak mengikat superuser), halaman `app/pages/audit.vue` (filter + tabel).
- `app/pages/antrian-beli.vue` -- pola halaman COO kerangka (`definePageMeta({ auth: true })`, empty state border-dashed); `app/pages/status-pendaftaran.vue:24-41` -- pola fetch SSR `useRequestFetch` + kontrak wire di `app/lib/`.
- `app/components/ui/` -- belum ada komponen Table; tambah via shadcn (`badge/` contoh struktur + cva). Token warna `app/assets/css/tailwind.css` (light-only, `tabular-nums` global).
- `tests/support/helpers/sesi-minting.ts` -- `mintSesiPemilik(apiRequest, { userIdentifier: 'coo' | 'pemegang-saham' | … })` via `/api/test/login` (triple-guard dev-only, `server/api/test/login.post.ts` pola untuk endpoint seed audit); `tests/support/helpers/test-ids.ts` -- sumber `TEST_IDS`; e2e impor `test` dari `tests/support/merged-fixtures.ts`, 3 browser.

## Tasks & Acceptance

**Execution:**
- [x] `shared/domain/audit.ts` + `shared/domain/audit.test.ts` -- registry `AUDIT_ACTIONS` (as const, aksi Epic 1 yang disebut epik: pendaftaran/verifikasi/penolakan/kedaluwarsa/kelengkapan/kelola-owner/pergantian-coo + `system` bila perlu), tipe `AuditAction`/`AuditActor`/`AuditEntryInput`, guard `isAuditAction`; unit test guard & kelengkapan union -- kontrak murni lintas lapis (AD-3).
- [x] `drizzle/schema.ts` + `npm run db:generate` -- tabel `auditLogs` (`id` uuid pk, `actor_owner_id` uuid null FK `owners.id` — null = system, `action` text notNull, `target` text, `details` jsonb notNull default '{}', `created_at` timestamptz notNull default now(), index `created_at`) -- milik modul AUDIT (AD-5); migrasi baru di-apply (`db:migrate`), jangan sentuh migrasi lama.
- [x] `drizzle/runtime-role.sql` + `drizzle/grants.sql` + `README.md` + `.env.example` -- role `app_runtime` + grants append-only (REVOKE UPDATE/DELETE/TRUNCATE; GRANT SELECT/INSERT pada tabel aplikasi) + runbook penerapan & migrasi koneksi `NUXT_DATABASE_URL` ke `app_runtime` -- keputusan penuh 2026-09-17.
- [x] `server/domain/audit/audit.repo.ts` -- `insertAuditEntry(tx, row)` INSERT-only; `listAuditEntries(db, { limit, offset })` SELECT urut `created_at` desc; Drizzle hanya di sini -- insert-only adalah separuh penegakan "tanpa jalur UPDATE/DELETE".
- [x] `server/domain/audit/audit.service.ts` + `index.ts` + `audit.service.test.ts` + `audit.repo.test.ts` -- `writeAuditEntry(tx, input)` validasi registry + kewajiban `tx` lalu insert; `listForCoo(db, page)` komposisi baca; barrel re-ekspor selektif (pintu lintas modul AD-5); unit test stub-repo (aksi di luar registry, tanpa tx, paging) -- menutup matriks I/O.
- [x] `server/utils/api-error.ts` -- tambah `forbidden: 403` pada `HTTP_STATUS` -- bentuk envelope tidak berubah.
- [x] `server/api/audit/index.get.ts` -- tipis: `getSessionEmail` → 401; `buildPrincipal` → unlinked redirect `/login?state=unlinked`; role ≠ `coo` → 403; parse `page` → `listForCoo` → `{ data, nextPage }` -- pola `status.get.ts`; penegakan AD-8 per-request.
- [x] `app/components/ui/table/` -- generate komponen Table shadcn -- dasar tabel audit.
- [x] `app/pages/audit-trail.vue` -- `definePageMeta({ auth: true })`; fetch SSR `/api/audit`; non-COO redirect `LANDING_PATH[role]`; tabel (kolom pertama sticky di mobile, angka `tabular-nums`, waktu id-ID zona Asia/Jakarta, JSON detail terpotong konstanta bernama); empty state; paginasi tautan (tanpa infinite scroll) -- AC tampilan COO (FR-12).
- [x] `tests/support/helpers/test-ids.ts` -- blok `TEST_IDS` audit (halaman, tabel, paginasi, empty state).
- [x] `server/api/test/audit-seed.post.ts` -- seed entry uji dev-only triple-guard (pola `login.post.ts`, email terbatas domain uji) menulis lewat API publik modul audit dalam satu tx -- data uji e2e tanpa menulis tabel tetangga; pembersihan menyusul kontrak 1.4.
- [x] `tests/e2e/audit-trail.spec.ts` -- COO: seed → halaman tampil daftar (aktor/waktu/detail); `pemegang-saham`: URL langsung → redirect landing; tanpa sesi → `/login` -- mencakup sisi halaman `1-API-006` + `1-E2E-002`.
- [x] `README.md` -- runbook alur audit (endpoint, halaman, penerapan grants) -- tanpa rahasia di repo.

**Acceptance Criteria:**
- Given modul AUDIT dan tabel `audit_logs` dibuat via migrasi Drizzle, when skema dan grants diterapkan, then tidak ada jalur UPDATE/DELETE pada `audit_logs` (repo INSERT/SELECT saja + REVOKE DB) dan setiap entry ditulis dalam transaksi yang sama dengan aksinya (helper menolak tanpa `tx`) — tidak pernah async.
- Given service domain melakukan aksi yang wajib diaudit, when helper audit dipanggil, then entry ber-envelope `{ actor, action, target, details }`, `action` berasal dari registry terpusat, aktor `user`/`system`; dan modul lain hanya mengakses audit lewat `index.ts` modul audit.
- Given COO membuka halaman Audit Trail, when log dimuat, then daftar aksi (aktor, waktu, detail) tampil hanya untuk COO; non-COO yang mengakses URL langsung dialihkan (FR-12).
- Given `npm test` / `typecheck` / `lint` / `build` dijalankan, then semuanya hijau dan migrasi `audit_logs` ter-apply bersih.

## Implementation Notes

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-3-audit-trail-pencatatan-tampilan-coo.md`
- API tests: `tests/e2e/audit.api.spec.ts` (6 test, red-phase)
- E2E tests: `tests/e2e/audit-trail.spec.ts` (4 test, red-phase)
- Unit tests: `shared/domain/audit.test.ts` + `server/domain/audit/audit.service.test.ts` + `server/domain/audit/audit.repo.test.ts` (12 test, red-phase — `1-UNIT-002/003/004`)
- Pendukung: blok `TEST_IDS.auditTrail.*` di `tests/support/helpers/test-ids.ts` (kontrak testid halaman `/audit-trail`)
- Semua test masih `test.skip()` (TDD RED) — lepas skip per tugas, buktikan merah, hijaukan, commit.

## Spec Change Log

## Review Triage Log

| # | Temuan (layer) | Vonis | Bukti & Rute |
|---|---|---|---|
| 1 | Unit fake membuang argumen `orderBy` — urutan newest-first bisa regress tanpa test merah; asersi desc e2e vacuous (seed 1 tx = `now()` identik) (verification-gap) | medium | Pre-terverifikasi + demonstrasi pengreview sah (ubah ke asc → semua hijau). → **patch** #1 |
| 2 | Branch `unlinked` GET /api/audit & halaman /audit-trail tanpa test (endpoint saudara punya precedent) (verification-gap) | medium | Pre-terverifikasi; redirect salah tak terdeteksi suite. → **patch** #2 |
| 3 | `idle_timeout: 5` di helper reset dapat menutup koneksi pemegang advisory lock saat body test >5s — lock lepas diam-diam, serialisasi batal (blind-hunter, edge-case) | medium | Terverifikasi: postgres.js menutup koneksi idle; sesi mati = lock lepas. → **patch** #3 |
| 4 | `parseInt('?page=')` longgar: `'2abc'`→2 (kontrak 400 dilanggar), `1e21`→integer→bind bigint gagal→500; duplikasi parser API vs halaman (blind-hunter, edge-case) | low | Terverifikasi lewat semantik `parseInt`/`Number.isInteger`; hanya COO yang kena, self-inflicted. → **patch** #4 |
| 5 | "Coba lagi" = NuxtLink ke route aktif → klik tidak me-re-run SSR fetch (no-op) (blind-hunter) | low | Terverifikasi: navigasi same-route tidak me-render ulang setup. → **patch** #5 |
| 6 | Enforcement append-only (grants/role) hanya via runbook manual; suite berjalan di koneksi admin; tanpa script/ALTER DEFAULT PRIVILEGES; `.env.example` aktif masih superuser (verification-gap defer, blind-hunter, edge-case) | low | Real, TAPI spesifikasi sendiri mem-prescribe verifikasi manual psql; absennya harness DB-assert pre-date story ini; migrasi `.env` = tugas ops terdokumentasi. → **defer** |
| 7 | State "gagal muat → Coba lagi" tak terjangkau test apa pun (verification-gap defer, blind-hunter) | low | Real; fetch SSR tak bisa dipaksa gagal dari e2e; butuh infra component-test yang belum ada; sudah dicatat sadar di Design Notes. → **defer** |
| 8 | Import `tripleGuardLolos` dari route `login.post` = kopling antar-route; sebaiknya util (blind-hunter) | low | Pakai ulang predikat = satu sumber kebenaran yang disanksi komentar diff; tak ada kerusakan konkret yang dinamai. → **reject (low)** |
| 9 | Duplikasi tipe wire `AuditEntryWire` (service) vs `AuditEntryTampil` (app/lib) (blind-hunter) | low | Mengikuti konvensi repo sejak 1.2 (`app/lib/landing.ts` mirror); drift ditambak zod schema e2e. → **reject (low)** |
| 10 | Divergensi perilaku `parseHalaman` API (400) vs halaman (fallback 1) (blind-hunter, verification-gap other) | low | Divergensi disengaja per-lapisan: kontrak API di-pin matriks; halaman UX. Yang dipatch = ketatnya parsing (baris 4), bukan penyatuan perilaku. → **reject (low)** |
| 11 | `parseInt('1.5')`→1 diterima, pesan menjanjikan "bilangan bulat" (blind-hunter) | low | Bagian akar sama baris 4 (parser longgar); dilalui patch #4. → **tercakup patch #4** |
| 12 | Grants tak terotomasi / fresh env superuser (sama akar dengan #6) (blind-hunter, edge-case) | low | Sama akar penyebab baris 6. → **defer** (gabung #6) |
| 13 | Halaman `?page=` di luar jangkauan render empty state + nav "Halaman 99" — membingungkan (blind-hunter) | low | Tak terjangkau pada skala terpin (22–40 owner, append-only tumbuh); fix menambah branch baru. → **reject (low)** |
| 14 | Join `owners` langsung dari drizzle/schema — ketegangan AD-5 (blind-hunter) | low | Join baca untuk display disanksi eksplisit spec (Code Map + komentar diff); tanpa jalur tulis. → **reject (low)** |
| 15 | Tiebreaker `created_at,id` tanpa index komposit (blind-hunter) | low | Skala 22–40 owner; sort murah; menambah index = migrasi baru di luar kebutuhan. → **reject (low)** |
| 16 | Seed `jumlah` salah tipe diam-diam jadi 1; guard rentang jumlah tanpa test (blind-hunter, edge-case, verification-gap other) | low | Endpoint dev-only; pemanggil (test) selalu kirim number; harm nyaris nol. → **reject (low)** |
| 17 | Metadata status spec vs sprint-status tidak sinkron + prosa di `last_updated` (blind-hunter) | false | State transien di tengah workflow (step-05 yang menyinkronkan — dihentikan per instruksi user); sync manual dilakukan saat halt step-04. → **reject (false)** |
| 18 | `AuditEntryWire.action` bertipe `string` padahal `AuditAction` ada (blind-hunter) | low | Kosmetik; nilai divalidasi registry saat tulis; perubahan tipe beriak ke mirror klien. → **reject (low)** |
| 19 | Tidak ada nav ke /audit-trail (blind-hunter) | false | Intent frozen eksplisit: "Bukan scope: item navigasi & matriks keterbukaan penuh (Story 1.7)". → **reject (out of scope)** |
| 20 | `listForCoo` tanpa clamp page≤0 via barrel (edge-case) | low | Tak terjangkau: satu-satunya pemanggil (handler) memvalidasi ≥1; state tak didemonstrasikan. → **reject (low)** |
| 21 | ownerId palsu → FK error me-rollback tx pemanggil (edge-case) | false | Fail-closed justru benar: audit wajib commit bersama aksi; aktor bogus = bug pemanggil yang MEMANG harus gagal keras. Tak terjangkau via jalur app (ownerId dari baris owners sesi). → **reject (false)** |
| 22 | Offset paging bergeser di bawah tulis konkuren → dup/miss (edge-case) | false | Tradeoff yang didokumentasikan spesifikasi sendiri (Design Notes: paging offset sederhana, "cursor menyusul bila perlu"); skala terpin kecil. → **reject (per spesifikasi)** |
| 23 | `upsertOwnerByEmail` di luar tx seed → rollback audit meninggalkan owner sintetis (edge-case) | low | Dev-only; owner idempoten; pembersihan menyusul kontrak 1.4 (terdokumentasi di header endpoint). → **reject (low)** |
| 24 | `DATABASE_URL` rusak → URIError mentah sebelum guard host (edge-case) | low | Helper test dev-only; gagal tetap keras dan jelas lokasinya; pesan kosmetik. → **reject (low)** |
| 25 | `createdAt` tak ter-parse → RangeError crash SSR (edge-case) | false | Kolom `timestamptz` tidak dapat menyimpan string tidak valid — input `formatWaktuAudit` selalu ISO sah dari DB sendiri; situasi tak terdemonstrasi terjangkau. → **reject (false)** |
| 26 | `runtime-role.sql` IF NOT EXISTS melewatkan role beratribut salah (edge-case) | low | Konflik role pra-eksisten hipotetis; kegagalan tetap keras saat koneksi runtime. → **reject (low)** |
| 27 | Klaim README "page invalid → 400" dilanggar `'2abc'`/`1e21` (edge-case claim) | low | Sama akar penyebab baris 4. → **tercakup patch #4** |

## Design Notes

- **Kolom `action` = `text`, bukan pgEnum:** registry terpusat tetap menutup himpunan di level service; menambah aksi (1.4+) = edit konstanta `shared/domain/audit.ts` tanpa migrasi — pola proyek lama yang terbukti.
- **`actor_owner_id` null = `system`:** satu kolom memenuhi envelope AD-3; tampilan menampilkan "System" untuk null. Penentu aktor = pemanggil (AD-8: pejabat saat commit).
- **Grants tidak mengikat superuser:** REVOKE hanya efektif bagi role non-superuser — itulah alasan role `app_runtime` dibuat; lihat proyek lama `drizzle/runtime-role.sql:39-47`.
- **Paging offset sederhana** (limit 100, `?page=`) memadai untuk skala 22–40 owner; cursor menyusul bila perlu.
- **Reset dev-only test stateful (keputusan step-03):** tabel append-only tanpa kontrak pembersihan sampai 1.4, sementara test `empty-state`, `baseline seed`, dan `paging` menuntut keadaan terukur. Solusi: `tests/support/helpers/audit-reset.ts` — TRUNCATE via koneksi ADMIN (postgres, bukan jalur aplikasi; grants `app_runtime` tetap menutup UPDATE/DELETE/TRUNCATE bagi runtime) + `pg_advisory_lock` yang digenggam sepanjang test stateful agar TRUNCATE/seed lintas project browser (fullyParallel × 3 browser) tidak saling menyela. Tanpa ini, empty-state flaky dan asersi baseline pecah bila tabel ≥ ~97 baris. Asersi ter-pin tidak diubah.
- **Gap coverage "gagal muat → Coba lagi" (baris 1 matriks, kolom error-handling):** tidak ada covering test otomatis — fetch halaman terjadi SSR (`useRequestFetch`) sehingga kegagalan `/api/audit` tidak dapat dipaksa dari e2e tanpa infra component-test (belum ada di repo). Empty state (pasangan error-handling pada baris yang sama) ter-cover. Dicatat sadar untuk ditimbang reviewer; opsi menyusul: component test atau story error-state.
- **Tiebreaker paging:** `ORDER BY created_at DESC, id DESC` — entry dalam satu transaksi berbagi `now()` yang sama; tanpa tiebreaker, paging offset tidak deterministik antar halaman.
- **Lint branch ini:** branch `feature/story-1-3` belum mewarisi merge develop (penghapusan nested `snd-dash/` ada di `feature/story-1-2`), sehingga `npm run lint` global masih menampilkan 160 problem pre-existing milik nested copy (baseline `5aa1ffa`); seluruh file yang disentuh Story 1.3 lolos eslint nol temuan — memenuhi ekspektasi spec "lint setara baseline".

## Verification

**Commands:**
- `npm run db:generate && npm run db:migrate` -- expected: migrasi `audit_logs` ter-apply bersih.
- `npm test && npm run typecheck && npm run lint && npm run build` -- expected: hijau semua (lint setara baseline 1.2).
- `psql "$NUXT_DATABASE_URL" -c "SET ROLE app_runtime; UPDATE audit_logs SET action='x';"` -- expected: ERROR permission denied.
- `curl -i http://localhost:3000/api/audit` (tanpa cookie) -- expected: 401 envelope; dengan cookie non-COO -- expected: 403.
- `npx playwright test tests/e2e/audit-trail.spec.ts` -- expected: hijau di 3 browser.

**Manual checks (if no CLI):**
- COO (mint `coo`) membuka `/audit-trail`: daftar tampil, waktu format id-ID, JSON terpotong; halaman kosong → empty state; `pemegang-saham` membuka URL langsung → kembali ke `/dashboard`.
