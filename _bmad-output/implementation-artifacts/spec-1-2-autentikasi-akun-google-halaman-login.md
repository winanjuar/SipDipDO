---
title: 'Story 1.2 — Autentikasi Akun Google & Halaman Login'
type: 'feature'
created: '2026-09-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e765b9d13a1f05c2fa7b3d39b6c09cdcf5e795c4'
story_key: '1-2-autentikasi-akun-google-halaman-login'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum ada jalur masuk aplikasi — Story 1.1 hanya menyediakan NuxtAuth OAuth Google terpasang & ter-smoke tanpa halaman Login, tanpa pencocokan email Google → owner, dan tanpa landing per-role; pengunjung tidak bisa masuk, pengguna yang masuk tidak diarahkan sesuai role (UX-DR14).

**Approach:** Bangun halaman Login publik (lockup logo 80px + tagline + satu CTA Google, UX-DR3/DR15), pencocokan email Google → baris owner via modul identity — tabel `owners` (minimal) + `coo_tenures` dibuat sekarang karena AC "akun belum terhubung" dan landing per-role menuntut data identity — resolver landing server-side (COO → Antrian Beli, pemegang saham → Dashboard, tanpa saham/Keluar → Halaman Personal, calon owner `diajukan`/`ditolak`/`kedaluwarsa` → kerangka halaman status pendaftaran; semuanya kerangka state kosong UX-DR19), proteksi sesi di middleware server + route handler (AD-8), pesan arahan verbatim untuk akun belum terhubung, dan endpoint session-minting dev-only untuk E2E (pola 1 test design).

**Keputusan pengguna (2026-09-16):**
1. Spec dipertahankan utuh meski ±3.700 token (di atas ambang 1600) — kepadatan berasal dari story lintas lapis (DB+service+API+halaman+tes), bukan multi-goal.
2. Calon owner berstatus `diajukan`/`ditolak`/`kedaluwarsa` dialandingkan ke kerangka halaman "status pendaftaran" minimal yang dibangun sekarang (Status Badge + alasan penolakan apa adanya); Story 1.4 menyempurnakannya dengan tampilan status penuh.

## Boundaries & Constraints

**Always:**
- Role & akses ditegakkan di middleware server + tiap route handler (AD-8); klien hanya untuk UX redirect. Penentuan role = fungsi kanonik modul identity: COO dari `coo_tenures` berlaku, "pemegang saham" dari `first_effective_at` terisi — TIDAK pernah dari `positions.shares` (tabel milik ledger, tidak disentuh story ini).
- Enum status lifecycle dipinkan AD-11 (`diajukan|terverifikasi|ditolak|kedaluwarsa|keluar`); hanya modul identity menulis `owners`; konvensi DB spine (uuid, snake_case jamak, timestamptz mode string, unique email).
- Halaman tipis (parsing + panggil API + render); logika di `server/domain/identity` (`*.service.ts`/`*.repo.ts`; Drizzle hanya di repo); kontrak role/landing yang dipakai lintas lapis hidup di `shared/domain` murni; error API seragam `{ code, message, details }` via `server/utils/api-error`.
- UI Bahasa Indonesia, light-only, primary navy `#2D3959`, target sentuh ≥44px, `lang="id"`; logo asli tidak di-recolor/distretch (80px terpusat di Login + tagline italic muted-foreground); tanpa magic number (konstanta bernama, mis. `LOGIN_LOGO_PX`).
- Dokumen SSR & `/api/**` tetap `no-store` (sudah di scaffold, jangan dirusak); halaman Login TIDAK boleh masuk precache SW.
- Data uji sintetis saja; kredensial hanya via env.

**Never:**
- Tidak ada MFA/OTP (Epic 3), halaman pendaftaran & status pendaftaran (Story 1.4), navigasi bottom-nav/sidebar (Story 1.7), tabel `positions`/`audit_logs`, penulisan entry audit (Story 1.3).
- Tidak menambah adapter database NuxtAuth / auto-create user — pencocokan email manual via identity; tidak menyimpan role di JWT/session (role dievaluasi per-request dari DB); tidak mengaktifkan `globalAppMiddleware`.
- Tidak mengubah pin stack; tanpa deploy produksi; tidak mengedit `_bmad/` & `_bmad-output/` (menyalin aset logo KELUAR dari artefak UX diperbolehkan).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Belum terautentikasi buka `/` | Tanpa cookie sesi | Redirect `/login`: lockup logo 80px + tagline + satu CTA Google | N/A |
| Login sukses, COO tenure berlaku | Email ada di `owners`, `coo_tenures` aktif | Landing `/antrian-beli` (kerangka state kosong) | N/A |
| Login sukses, pemegang saham | `first_effective_at` terisi, bukan COO | Landing `/dashboard` (kerangka state kosong) | N/A |
| Login sukses, tanpa saham / Keluar | Status `terverifikasi` tanpa `first_effective_at`, atau `keluar` | Landing `/personal` (kerangka state kosong) | N/A |
| Login sukses, calon owner | Status `diajukan`/`ditolak`/`kedaluwarsa` | Landing `/status-pendaftaran`: Status Badge (warn/success/destructive/muted) + alasan penolakan tampil apa adanya | Pengguna non-calon membuka URL langsung → redirect ke landing role-nya |
| Login sukses, email tidak ada di `owners` | Sesi NuxtAuth sah tanpa baris owner | Kembali ke `/login` + pesan arahan verbatim UX-DR15 | Pesan tampil apa adanya (teks; aksi pendaftaran menyusul Story 1.4) |
| Sesi berakhir/tidak ada | Akses `/dashboard`|`/personal`|`/antrian-beli`|`/status-pendaftaran` (SSR) atau `GET /api/landing` | Redirect `/login`; endpoint → 401 envelope seragam | Envelope `{ code, message, details }` |
| OAuth gagal/dibatalkan | Callback Google membawa error | Kembali ke `/login` tanpa crash | Tanpa pesan menyesatkan |

</frozen-after-approval>

## Code Map

- `nuxt.config.ts` (blok auth 27–40) -- provider authjs + `defaultProvider: 'google'` + sessionRefresh sudah ada; JANGAN set `globalAppMiddleware` (proyek referensi lama: recursion `/session`); proteksi per-halaman via `definePageMeta`.
- `server/api/auth/[...].ts` -- NuxtAuthHandler GoogleProvider (R-005 GO); biarkan tanpa adapter/callbacks tambahan.
- `server/domain/identity/` -- `owner.repo.ts` stub berisi komentar konvensi tabel `owners`/`coo_tenures` (Story 1.4+); di sinilah repo+service nyata ditulis; `index.ts` satu pintu ekspor (AD-5).
- `server/utils/api-error.ts`, `server/utils/db.ts` -- reuse `sendApiError`, `HTTP_STATUS`, `useDb`, tipe `Db`/`Tx`.
- `drizzle/schema.ts` + `drizzle/migrations/` -- saat ini hanya `outboxEmails`; tambah `owners`+`coo_tenures` (pola kolom sama: uuid pk, timestamptz string).
- `app/pages/index.vue` -- kerangka netral 1.1; diganti resolver landing. `app/pages/smoke.vue` -- pola `useAuth`/`signIn` ter-smoke; referensi, jangan rusak. `app/app.vue` -- Toaster + `lang="id"`; jangan ubah.
- `_bmad-output/planning-artifacts/ux-designs/.../imports/logo.png` -- aset logo transparan sumber (salin ke `app/public/logo.png`; `logo.jpg` untuk email, belum dipakai).
- `snd-dash/snd-dash/` (proyek referensi lama, jangan disalin mentah) -- `server/utils/access.ts`/`session.ts`: pola `buildPrincipal`/`requireCoo`; `app/pages/session.vue`: catatan signIn composable.
- `tests/support/auth-fixture.ts` + `framework-setup-progress.md` (baris 98) -- fixture menunggu endpoint minting Story 1.2; nama cookie `next-auth.session-token` belum terverifikasi.
- `_bmad-output/test-artifacts/test-design-architecture.md` (R-003, pola session minting triple-guard) + `test-design-qa.md` (`1-UNIT-001`, `1-E2E-002`) -- kontrak pengujian story ini.

## Tasks & Acceptance

**Execution:**
- [x] `drizzle/schema.ts` + `npm run db:generate` -- tabel `owners` minimal (`id`, `email` unique, `status` enum AD-11 default `diajukan`, `rejection_reason` null, `first_effective_at` null, `created_at`/`updated_at`) + `coo_tenures` (`owner_id` FK, `started_at`, `ended_at` null) -- milik identity (AD-5/AD-11); migrasi di-apply bersih ke Supabase lokal.
- [x] `shared/domain/identity.ts` + `.test.ts` -- tipe `OwnerStatus` (AD-11), `Role` (`coo|pemegang_saham|tanpa_saham|calon_owner`), map konstanta `LANDING_PATH` role→route bernama -- kontrak murni lintas lapis tanpa I/O.
- [x] `server/domain/identity/owner.repo.ts` + `access.service.ts` + `index.ts` -- repo: `findOwnerByEmail`, `findActiveCooTenure`; service: `resolveRole(owner, cooAktif)` murni (precedence COO) + `buildPrincipal(email)` dengan DI repo; unit test edge (COO precedence, first_effective, calon per status, unlinked) -- `1-UNIT-001` subset; ekspor hanya via `index.ts`.
- [x] `server/api/landing.get.ts` -- tipis: sesi → `buildPrincipal` → `{ path, role }` atau `{ unlinked: true }`; tanpa sesi → 401 envelope -- route handler wajib auth (AD-8).
- [x] `server/api/pendaftaran/status.get.ts` -- tipis: khusus calon owner → `{ status, rejectionReason }`; non-calon → redirect landing role-nya -- data badge halaman status.
- [x] `server/middleware/auth-guard.ts` -- redirect `/dashboard`|`/personal`|`/antrian-beli` tanpa sesi → `/login` (SSR) -- middleware server AD-8.
- [x] `app/components/BrandLogo.vue` + `app/public/logo.png` + `app/pages/login.vue` -- komponen logo (32/80px, konstanta bernama, tanpa recolor); halaman publik `definePageMeta({ auth: false })`: lockup 80px + tagline italic muted-foreground + satu CTA `signIn('google', { callbackUrl: '/' })`; query `state=unlinked` → pesan arahan verbatim UX-DR15 -- UX-DR3/DR15. *(Logo terpasang di `public/logo.png` — direktori statis Nuxt 4.5 resolve dari rootDir; `app/public/` hanya SW source PWA. Intent terjaga.)*
- [x] `app/pages/index.vue` -- resolver landing SSR: tanpa sesi → `/login`; dengan sesi → panggil `/api/landing` → `navigateTo(path)`; `unlinked` → `/login?state=unlinked` -- redirect murni, tanpa konten.
- [x] `app/pages/dashboard.vue` + `app/pages/personal.vue` + `app/pages/antrian-beli.vue` -- tiga kerangka `definePageMeta({ auth: true })` + nama permukaan + state kosong (UX-DR19); komentar penanda scope nyata Story 1.7 -- halaman tujuan Epic 1.
- [x] `app/pages/status-pendaftaran.vue` -- kerangka halaman status: Status Badge berteks per status + alasan penolakan apa adanya, data dari `/api/pendaftaran/status`; Story 1.4 menyempurnakan -- keputusan pengguna #2.
- [x] `server/api/test/login.post.ts` + `tests/support/auth-fixture.ts` -- session minting dev-only triple guard (`NODE_ENV`≠production + `ENABLE_TEST_AUTH` + `TEST_AUTH_SECRET`) memakai secret NuxtAuth sama, untuk owner sintetis; wire `manageAuthToken`; verifikasi nama cookie sesi -- pola 1 test design (blocker #2). *(Cookie terverifikasi: `next-auth.session-token`; domain cookie tanpa port agar sah di Firefox/WebKit.)*
- [x] `tests/e2e/auth-landing.spec.ts` -- landing per 4 role (owner sintetis via factory, termasuk calon owner → badge + alasan), belum-auth → `/login`, `unlinked` → pesan -- `1-E2E-002` subset. *(+1 test perilaku halaman `?error` OAuth gagal — audit matriks baris 8.)*
- [x] `.env.example` + `README.md` -- var dev-only baru + runbook alur login/landing/pesan unlinked -- tanpa rahasia di repo.

**Acceptance Criteria:**
- Given pengunjung belum terautentikasi membuka URL aplikasi, when halaman Login tampil, then lockup logo 80px terpusat + tagline "Sip the taste, dip the soul" + satu CTA Google (UX-DR3/DR15).
- Given akun Google belum terhubung ke owner/pendaftar mana pun, when login dicoba, then pesan arahan "Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. Owner eksisting: hubungi COO untuk pencocokan email migrasi." tampil (UX-DR15).
- Given login berhasil, when redirect landing dieksekusi, then tujuan mengikuti role — COO → Antrian Beli, pemegang saham → Dashboard, tanpa saham/Keluar → Halaman Personal, calon owner `diajukan`/`ditolak`/`kedaluwarsa` → halaman status pendaftaran — dievaluasi di middleware server + route handler, tidak pernah di klien saja (AD-8); halaman tujuan cukup kerangka + state kosong (UX-DR19).
- Given sesi berakhir, when pengguna mengakses halaman terproteksi, then dialihkan ke halaman Login.
- Given `npm test`/`typecheck`/`lint`/`build` dijalankan, then semuanya hijau; migrasi `owners`+`coo_tenures` ter-apply bersih di Supabase lokal.

## Implementation Notes

### Hasil Build (2026-09-17, pasca-patch review step-04)

- **Verifikasi pasca-patch (orchestrator, penuh):** `npm test` 50/50 (46 + 4 test predikat guard baru); `typecheck` 0 error; `lint` paritas baseline (160 temuan pre-existing seluruhnya di proyek referensi lama `snd-dash/`, 0 baru); `npm run build` sukses; curl live: `/api/landing` tanpa sesi → 401, `/dashboard` tanpa sesi → 302 `/login`; Playwright landing.api + auth-landing **60/60** lintas chromium/firefox/webkit (dijalankan subagent patch).
- **Patch diterapkan (16 grup E1–E16, lihat Review Triage Log):** hardening endpoint minting (email wajib domain `@uji.example.test`, typeof boolean, tolak persona konflik), predikat triple-guard murni + 4 unit test kaki, `openCooTenure` atomik single-statement, resolver `/` hanya 401 → `/login` (error lain dilempar), normalisasi `query.error` array, derive nama/flag cookie dari protokol (https → `__Secure-`), fallback fixture `'default'`, normalisasi trailing slash `auth-guard`, `CALON_OWNER_STATUSES` dipakai `resolveRole`, `.env.example` nilai contoh dikomentari, derive hostname test redirect, dan 5 test baru (guard ×4, unlinked status, re-mint COO→non-COO, badge diajukan/kedaluwarsa + pin varian, CTA 44px).
- **Deviasi logo:** `logo.png` di `public/` (bukan `app/public/`) — direktori statis Nuxt 4.5 resolve dari rootDir; `app/public/` hanya berisi SW source PWA. Intent (logo asli tanpa recolor, halaman login di luar precache) terjaga.
- **Sisa dev-only:** seed owner sintetis dari `/api/test/login` tertinggal di DB lokal per percobaan mint — kontrak pembersihan menyusul Story 1.4 (tercatat juga di checklist ATDD).

### Hasil Build awal (2026-09-16, step-03)

- **Verifikasi:** `npm test` 46/46; `typecheck` 0 error; `lint` 160 temuan pre-existing seluruhnya di proyek referensi lama `snd-dash/` (0 di kode story, paritas baseline red-phase); `npm run build` sukses; Playwright landing.api + auth-landing **54/54** (18 test × chromium/firefox/webkit, termasuk asersi tinggi logo 80px); migrasi `owners`+`coo_tenures` ter-apply bersih di Supabase lokal (enum `owner_status`, unique email, FK terverifikasi via psql).
- **Audit matriks I/O:** 8/8 baris tercakup test yang lulus. Baris "OAuth gagal/dibatalkan" awalnya tanpa test otomatis — ditutup dengan test `[P2] callback OAuth membawa error` (perilaku halaman `?error=…`: render utuh + pemberitahuan netral, tanpa pesan unlinked); wiring callback Google LIVE tetap smoke manual AR-3.
- **Deviasi logo:** `logo.png` di `public/` (bukan `app/public/`) — direktori statis Nuxt 4.5 resolve dari rootDir; `app/public/` hanya berisi SW source PWA. Intent (logo asli tanpa recolor, halaman login di luar precache) terjaga.
- **Sisa dev-only:** seed owner sintetis dari `/api/test/login` tertinggal di DB lokal per percobaan mint — kontrak pembersihan menyusul Story 1.4 (tercatat juga di checklist ATDD).

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-2-autentikasi-akun-google-halaman-login.md`
- API tests: `tests/e2e/landing.api.spec.ts` (8 test, red-phase)
- E2E tests: `tests/e2e/auth-landing.spec.ts` (9 test, red-phase)
- Unit tests: `shared/domain/identity.test.ts` + `server/domain/identity/access.service.test.ts` (9 test, red-phase — `1-UNIT-001` subset)
- Pendukung: `tests/support/helpers/sesi-minting.ts`, konstanta `TEST_IDS.login.*`/`TEST_IDS.statusPendaftaran.*`
- Semua test masih `test.skip()` (TDD RED) — lepas skip per tugas, buktikan merah, hijaukan, commit.

## Spec Change Log

## Review Triage Log

Review step-04 (2026-09-17) — 3 lapis: blind-hunter (17), edge-case-hunter (16, termasuk 1 claim), verification-gap (5 gap + 3 other). Verdict per temuan; pengelompokan & routing di bawah tabel.

| ID | Lokasi | Klaim ringkas | Verdict | Evidence / route |
|---|---|---|---|---|
| BH1 | `server/api/test/login.post.ts`, `.env.example` | Endpoint dev-only ter-bundle produksi; env contoh aktif membuat guard menyusut | `medium` | Setengah "ter-bundle" = `false` — guard runtime NODE_ENV adalah kontrak R-003 yang dikonfirmasi user; endpoint mati total di produksi. Setengah env contoh real: `ENABLE_TEST_AUTH=1` + secret di-set aktif tanpa komentar di `.env.example` → host non-prod yang menyalin hanya dilindungi kaki secret yang nilainya publik. **patch** (komentari nilai contoh). |
| BH2 | `login.post.ts`, `owner.repo.ts` | Seeding menimpa baris owner tanpa syarat; `body.email` bebas → bisa merusak baris non-sintetis | `medium` | Real: `body.email` diterima apa adanya (tanpa batas domain uji) + `onConflictDoUpdate` menimpa status/first_effective_at lalu menutup tenure. Sub-klaim "melanggar CAS" = `false` — konvensi CAS AD-11 mengikat transisi lifecycle (Story 1.4/1.6), bukan seeding uji. **patch** (batasi email ke domain uji). |
| BH3 | `landing.api.spec.ts` TODO | Kontrak cleanup seed (ATDD fixture-need #4) tidak di-wiring | `low` | Real tapi deferral sudah terdokumentasi eksplisit di checklist ATDD, TODO test, dan Implementation Notes — butuh API tulis identity Story 1.4. **defer**. |
| BH4 | `access.service.ts:50-56` | `resolveRole` menilai `keluar` sebelum `first_effective_at`, berlawanan urutan Design Notes | `low` | **reject** — frozen matrix (kontrak mengikat) memink tanpa syarat: `keluar` → `/personal`; kode + unit test mengikuti matrix; yang bertentangan hanya kalimat Design Notes (non-binding). Fix = edit spec → ditolak aturan triase. |
| BH5 | `access.service.ts:65-67` | `owner.id ?? ''` → Postgres 22P02 | `false` | Repo nyata (`createIdentityRepo`) selalu mengisi `id` (required di `OwnerRecord`); stub uji justru tanpa `findActiveCooTenure`. Tidak ada jalur yang bisa mencapai `''` (duplikat EC7). |
| BH6 | `server/middleware/auth-guard.ts` | Set terproteksi diturunkan dari LANDING_PATH; trailing slash lolos | `low` | Terbukti: `curl /dashboard/` tanpa sesi → 200 (skeleton tanpa data; lapis klien menangkap setelah hidrasi). Setengah "halaman 1.7 tak terlindungi" = `false` — halaman itu belum ada; Story 1.7 pemiliknya. **patch** (normalisasi pathname satu baris). |
| BH7 | 3 file (cookie) | Nama cookie varian http di-hardcode; BASE_URL https merusak sesi | `low` | Real: mint + fixture men-pin `next-auth.session-token` tanpa `__Secure-`/`secure`. Kena sehari-hari hanya bila suite diarahkan ke https — non-standar. Fix langsung (derive protokol). **patch**. |
| BH8 | `shared/domain/identity.ts` | `ROLES`/`CALON_OWNER_STATUSES` diekspor tak dipakai; enum diketik ulang | `low` | Real sebagian: `CALON_OWNER_STATUSES` tak dipakai `resolveRole`. Sub-klaim test lokal = disengaja (literal ter-pin anti-tautologi); `PETA_BADGE` bertipe `Record<OwnerStatus,…>` → kompiler memaksa lengkap; zod = pin wire test. **patch** (pakai konstanta di cabang final). |
| BH9 | `login.post.ts:73-80` | Triple guard: hanya kaki secret yang diuji | `medium` | Real — kaki `ENABLE_TEST_AUTH` & `NODE_ENV` tanpa test; R-003 menjadikannya kontrak (duplikat VG3). **patch**. |
| BH10 | `auth-fixture.ts` | `.auth/` tak di-gitignore; fallback `'pemilik-utama'` dead-end | `low` | Setengah `.auth/` = `false` (bukti VG: sudah di-gitignore). Fallback real: `'pemilik-utama'` bukan kunci `KONFIGURASI_UJI` dan inkonsisten dengan sentinel `'default'` (duplikat EC14/VG8). **patch** (jadi `'default'`). |
| BH11 | `app/pages/index.vue:23-27` | catch menelan semua kegagalan `/api/landing` sebagai belum-login | `medium` | Real: 5xx/DB-mati dialihkan ke `/login` — insiden tersamar, debugging terhambat (duplikat EC9). **patch** (bedakan 401). |
| BH12 | `app/pages/login.vue` | Tidak memantul utk sesi aktif; `signIn` tanpa try/catch; tanpa guard klik-ganda | `low` | **reject** — jarang terjadi sehari-hari dan fix menambah branch/UI state (bukan koreksi langsung); bounce sesi-aktif = ekspansi perilaku di luar intent tercatat (UX-DR3/15 memink halaman publik satu CTA). Kandidat Story 1.7. |
| BH13 | `badge/index.ts` | Token `bg-success`/`bg-warn` tak terdefinisi | `false` | Terverifikasi grep: `--success/--warn/--success-foreground/--warn-foreground` terdefinisi `app/assets/css/tailwind.css:105-109` (scaffold 1.1) dan dipetakan `:38-41`. |
| BH14 | `drizzle/schema.ts`, `owner.repo.ts` | Invariant tak ditegakkan DB; tenure race | `low` | Dua klaim beda akar: CHECK `ditolak`→alasan = real tapi **defer** (relevan saat alur tulis nyata 1.4/1.6; hari ini hanya seeding yang menulis dan ia selalu mengisi alasan). Race tenure (duplikat EC5) = **patch**. |
| BH15 | `.bmad-loop/policy.toml` | Dua flip kebijakan loop ikut diff tanpa justifikasi | `low` | Real — dibuat harness bmad-loop, bukan kode story; sudah disampaikan ke user untuk keputusan commit. **defer**. |
| BH16 | `sprint-status.yaml` | Spec `in-review` vs sprint-status `in-progress` | `low` | Real — terverifikasi grep baris 40. **patch** (sinkron ke `review`). |
| BH17 | `landing.api.spec.ts:192-204` | Test redirect hardcode domain `'localhost'` | `low` | Real tapi TIDAK diam-diam: cookie tak terkirim → 401 → asersi `toBe(200)` gagal keras. Default run tetap localhost. **patch** (derive hostname). |
| EC1 | `login.post.ts:96` | `body.email` string kosong lolos; JWT email kosong | `medium` | Real — `??` hanya nullish; kosong/whitespace lolos. **patch** (grup E2 hardening input). |
| EC2 | `login.post.ts:110-111` | `cooAktif`/`punyaSaham` tanpa type check | `medium` | Real — string `'false'` dari JSON coerce truthy → seed salah. **patch** (E2). |
| EC3 | `login.post.ts:110-121` | Persona konflik diterima diam-diam | `medium` | Real — `diajukan`+`punyaSaham` menghasilkan role lain dari persona diminta. **patch** (E2). |
| EC4 | `login.post.ts:27` | HTTPS: cookie tanpa `__Secure-`/secure | `low` | Real (duplikat BH7). **patch** (E8). |
| EC5 | `owner.repo.ts:104-109` | `openCooTenure` check-then-insert tanpa transaksi | `low` | Real; terjadi tiap run paralel browser utk identifier sama; efek = baris tenure ekstra di DB dev (role tetap benar). **patch** (E14 — statement atomik). |
| EC6 | `owner.repo.ts:70-90` | Upsert tanpa expected-state check | `low` | Clobber baris nyata tertutup oleh patch domain-email (E2); mutasi persona antar re-mint pada baris uji = mekanisme override yang disengaja; CAS expected-state utk transisi nyata sudah tercatat Story 1.4 (komentar repo). **patch** (via E2). |
| EC7 | `access.service.ts:65-67` | uuid kosong → 500 | `false` | Duplikat BH5 — jalur tak terjangkau. |
| EC8 | `drizzle/schema.ts:60-73` | `ditolak` tanpa `rejection_reason` diterima DB | `low` | Real; hanya seeding yang menulis kini dan ia selalu mengisi alasan utk `ditolak`. Constraint bermakna saat alur tulis CAS 1.4/1.6. **defer** (pasangan BH14a). |
| EC9 | `index.vue:23-27` | catch-all = belum login | `medium` | Duplikat BH11. **patch** (E7). |
| EC10 | `status-pendaftaran.vue:36-38` | Sesi expiry antar dua fetch → fallback, bukan redirect | `low` | **reject** — kedua fetch berjalan dalam satu pass SSR (jendela milidetik); fix menambah branch di dua titik. Fallback state yang tampil pun benar secara konten. |
| EC11 | `login.vue:24-26` | `signIn` reject tanpa handler | `low` | Duplikat BH12. **reject**. |
| EC12 | `login.vue:22` | `route.query.error` array → notifikasi tak tampil | `low` | Real (param berulang membuat array). Jarang, tapi fix = normalisasi satu baris. **patch** (E13). |
| EC13 | `login.vue:10-26` | Sesi aktif tak memantul dari /login | `low` | Duplikat BH12. **reject**. |
| EC14 | `auth-fixture.ts:59` | Fallback `'pemilik-utama'` mint 400 | `low` | Real (duplikat BH10). **patch** (E10). |
| EC15 | `landing.api.spec.ts:192-204` | Domain `'localhost'` hardcode | `low` | Duplikat BH17. **patch** (E12). |
| EC16 (claim) | `auth-landing.spec.ts` header | Klaim "via factory" tapi factory tak diimpor | `low` | **reject** — kata "factory" ada di baris task spec (frozen); kode justru mendokumentasikan mekanisme asli (mint preset) di header file; tidak ada pembaca kode yang keliru. Fix = edit spec → ditolak. |
| VG1 | `closeActiveCooTenures` | Efek penutupan tenure tak diverifikasi test | `medium` | Pre-verified (evidence rules VG): pencarian simbol menunjukkan tak ada test re-mint coo→non-coo. **patch** (E4 — test re-mint dua langkah). |
| VG2 | `status.get.ts:25` | Cabang unlinked endpoint status tak pernah dieksekusi test | `low` | Pre-verified: hanya 3 test di endpoint itu; cabang `sendRedirect('/login?state=unlinked')` tak tersentuh. **patch** (E15). |
| VG3 | `login.post.ts:73-80` | Kaki guard ENABLE_TEST_AUTH/NODE_ENV tak terpin | `medium` | Pre-verified (duplikat BH9). **patch** (E3). |
| VG4 | `status-pendaftaran.vue` | Badge diajukan/kedaluwarsa + varian + fallback tak diverifikasi | `medium` | Pre-verified: test P2 hanya asersi URL; key salah → fallback render tanpa test gagal. **patch** (E5). |
| VG5 | `login.vue` CTA | Target sentuh ≥44px tak diasersi | `low` | Pre-verified: hanya `toHaveCount(1)`; hapus `h-11` tak merusak test. **patch** (E6 — satu asersi CSS). |
| VG6 (other) | `.env.example` | Nilai contoh aktif tanpa komentar | `medium` | Duplikat BH1. **patch** (E1). |
| VG7 (other) | `access.service.ts` | Precedence keluar vs spec | `low` | Duplikat BH4. **reject**. |
| VG8 (other) | `auth-fixture.ts:59` | Fallback `'pemilik-utama'` | `low` | Duplikat BH10. **patch** (E10). |

**Pengelompokan & routing** (tanpa intent_gap/bad_spec → tanpa loopback; `review_loop_iteration` tetap 0):

- **patch (re-engage subagent implementasi):**
  - E1 `medium` (BH1, VG6) — komentari nilai contoh `.env.example`.
  - E2 `medium` (BH2, EC1, EC2, EC3, EC6) — hardening input endpoint minting: email wajib domain uji `@uji.example.test` + trim/fallback kosong; `typeof boolean`; tolak persona konflik (status calon + punyaSaham/cooAktif) dengan 400.
  - E3 `medium` (BH9, VG3) — ekstrak predikat triple-guard jadi fungsi murni + unit test tiga kaki.
  - E4 `medium` (VG1) — E2E re-mint identifier sama coo→non-coo, asersi landing berpindah.
  - E5 `medium` (VG4) — perluas test P2: badge teks Diajukan/Kedaluwarsa + blok alasan tak tampil utk non-ditolak + pin satu varian.
  - E6 `low` (VG5) — asersi tinggi CTA 44px.
  - E7 `medium` (BH11, EC9) — resolver `/`: hanya 401 → `/login`; error lain dilempar sebagai error.
  - E8 `low` (BH7, EC4) — derive nama cookie + `secure` dari protokol.
  - E9 `low` (BH8) — pakai `CALON_OWNER_STATUSES` di cabang final `resolveRole`.
  - E10 `low` (BH10, EC14, VG8) — fallback `'pemilik-utama'` → `'default'`.
  - E11 `low` (BH16) — sinkron sprint-status ke `review` (dikerjakan langsung orchestrator).
  - E12 `low` (BH17, EC15) — derive hostname dari BASE_URL pada test redirect.
  - E13 `low` (EC12) — normalisasi `query.error` array.
  - E14 `low` (EC5, BH14b) — `openCooTenure` atomik (single statement / transaksi).
  - E15 `low` (VG2) — test cabang unlinked endpoint status.
  - E16 `low` (BH6) — normalisasi trailing slash di `auth-guard`.
- **defer:** D1 (BH3 — cleanup seed, butuh API tulis 1.4); D2 (BH14a, EC8 — CHECK constraint saat alur tulis 1.4/1.6); D3 (BH15 — policy.toml milik harness, keputusan commit user).
- **reject/false:** BH4, BH5, BH12, BH13, EC7, EC10, EC11, EC13, EC16, VG7 (dengan alasan per baris di atas).

## Design Notes

- **Precedence landing:** unlinked → COO aktif → `first_effective_at` (pemegang saham) → `terverifikasi` tanpa pembelian / `keluar` (Halaman Personal) → `diajukan`/`ditolak`/`kedaluwarsa` (halaman status); COO aktif menang di atas pemegang saham (COO umumnya juga pemegang saham).
- **Role per-request, bukan di JWT:** sesi NuxtAuth default (JWT berisi email Google saja); `buildPrincipal` membaca DB tiap request — pergantian COO/STATUS tidak pernah basi; inilah fungsi kanonik AD-8/AD-11 di identity.
- **Tanpa adapter NuxtAuth:** adapter auto-create user akan menulis tabel di luar alur CAS identity; pencocokan email manual memakai repositori identity.
- **`owners` minimal sekarang:** kolom profile 11 field (Story 1.5), kontak (1.8), dsb. menyusul lewat migrasi baru — bukan ALTER yang sama.
- `logo.jpg` (latar putih) disiapkan untuk email, belum dipakai di story ini.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint && npm run build` -- expected: hijau semua.
- `npm run db:migrate` -- expected: migrasi `owners`+`coo_tenures` ter-apply bersih (Supabase lokal Docker).
- `curl -i http://localhost:3000/api/landing` (tanpa cookie) -- expected: 401 envelope `{ code, message, details }`.
- `curl -i http://localhost:3000/dashboard` (tanpa cookie) -- expected: 302 ke `/login`.

**Manual checks (if no CLI):**
- Login Google nyata di dev (kredensial 1.1 di `.env`): owner sintetis ber-role masing-masing → landing sesuai role; calon owner sintetis `ditolak` → badge destructive + alasan tampil; akun Google tak terdaftar → pesan arahan di `/login`; logo 80px + tagline tampil, light-only, CTA ≥44px.
