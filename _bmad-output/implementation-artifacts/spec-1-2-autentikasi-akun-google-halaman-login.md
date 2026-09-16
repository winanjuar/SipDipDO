---
title: 'Story 1.2 — Autentikasi Akun Google & Halaman Login'
type: 'feature'
created: '2026-09-16'
status: 'ready-for-dev'
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
- [ ] `drizzle/schema.ts` + `npm run db:generate` -- tabel `owners` minimal (`id`, `email` unique, `status` enum AD-11 default `diajukan`, `rejection_reason` null, `first_effective_at` null, `created_at`/`updated_at`) + `coo_tenures` (`owner_id` FK, `started_at`, `ended_at` null) -- milik identity (AD-5/AD-11); migrasi di-apply bersih ke Supabase lokal.
- [ ] `shared/domain/identity.ts` + `.test.ts` -- tipe `OwnerStatus` (AD-11), `Role` (`coo|pemegang_saham|tanpa_saham|calon_owner`), map konstanta `LANDING_PATH` role→route bernama -- kontrak murni lintas lapis tanpa I/O.
- [ ] `server/domain/identity/owner.repo.ts` + `access.service.ts` + `index.ts` -- repo: `findOwnerByEmail`, `findActiveCooTenure`; service: `resolveRole(owner, cooAktif)` murni (precedence COO) + `buildPrincipal(email)` dengan DI repo; unit test edge (COO precedence, first_effective, calon per status, unlinked) -- `1-UNIT-001` subset; ekspor hanya via `index.ts`.
- [ ] `server/api/landing.get.ts` -- tipis: sesi → `buildPrincipal` → `{ path, role }` atau `{ unlinked: true }`; tanpa sesi → 401 envelope -- route handler wajib auth (AD-8).
- [ ] `server/api/pendaftaran/status.get.ts` -- tipis: khusus calon owner → `{ status, rejectionReason }`; non-calon → redirect landing role-nya -- data badge halaman status.
- [ ] `server/middleware/auth-guard.ts` -- redirect `/dashboard`|`/personal`|`/antrian-beli` tanpa sesi → `/login` (SSR) -- middleware server AD-8.
- [ ] `app/components/BrandLogo.vue` + `app/public/logo.png` + `app/pages/login.vue` -- komponen logo (32/80px, konstanta bernama, tanpa recolor); halaman publik `definePageMeta({ auth: false })`: lockup 80px + tagline italic muted-foreground + satu CTA `signIn('google', { callbackUrl: '/' })`; query `state=unlinked` → pesan arahan verbatim UX-DR15 -- UX-DR3/DR15.
- [ ] `app/pages/index.vue` -- resolver landing SSR: tanpa sesi → `/login`; dengan sesi → panggil `/api/landing` → `navigateTo(path)`; `unlinked` → `/login?state=unlinked` -- redirect murni, tanpa konten.
- [ ] `app/pages/dashboard.vue` + `app/pages/personal.vue` + `app/pages/antrian-beli.vue` -- tiga kerangka `definePageMeta({ auth: true })` + nama permukaan + state kosong (UX-DR19); komentar penanda scope nyata Story 1.7 -- halaman tujuan Epic 1.
- [ ] `app/pages/status-pendaftaran.vue` -- kerangka halaman status: Status Badge berteks per status + alasan penolakan apa adanya, data dari `/api/pendaftaran/status`; Story 1.4 menyempurnakan -- keputusan pengguna #2.
- [ ] `server/api/test/login.post.ts` + `tests/support/auth-fixture.ts` -- session minting dev-only triple guard (`NODE_ENV`≠production + `ENABLE_TEST_AUTH` + `TEST_AUTH_SECRET`) memakai secret NuxtAuth sama, untuk owner sintetis; wire `manageAuthToken`; verifikasi nama cookie sesi -- pola 1 test design (blocker #2).
- [ ] `tests/e2e/auth-landing.spec.ts` -- landing per 4 role (owner sintetis via factory, termasuk calon owner → badge + alasan), belum-auth → `/login`, `unlinked` → pesan -- `1-E2E-002` subset.
- [ ] `.env.example` + `README.md` -- var dev-only baru + runbook alur login/landing/pesan unlinked -- tanpa rahasia di repo.

**Acceptance Criteria:**
- Given pengunjung belum terautentikasi membuka URL aplikasi, when halaman Login tampil, then lockup logo 80px terpusat + tagline "Sip the taste, dip the soul" + satu CTA Google (UX-DR3/DR15).
- Given akun Google belum terhubung ke owner/pendaftar mana pun, when login dicoba, then pesan arahan "Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. Owner eksisting: hubungi COO untuk pencocokan email migrasi." tampil (UX-DR15).
- Given login berhasil, when redirect landing dieksekusi, then tujuan mengikuti role — COO → Antrian Beli, pemegang saham → Dashboard, tanpa saham/Keluar → Halaman Personal, calon owner `diajukan`/`ditolak`/`kedaluwarsa` → halaman status pendaftaran — dievaluasi di middleware server + route handler, tidak pernah di klien saja (AD-8); halaman tujuan cukup kerangka + state kosong (UX-DR19).
- Given sesi berakhir, when pengguna mengakses halaman terproteksi, then dialihkan ke halaman Login.
- Given `npm test`/`typecheck`/`lint`/`build` dijalankan, then semuanya hijau; migrasi `owners`+`coo_tenures` ter-apply bersih di Supabase lokal.

## Implementation Notes

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-2-autentikasi-akun-google-halaman-login.md`
- API tests: `tests/e2e/landing.api.spec.ts` (8 test, red-phase)
- E2E tests: `tests/e2e/auth-landing.spec.ts` (9 test, red-phase)
- Unit tests: `shared/domain/identity.test.ts` + `server/domain/identity/access.service.test.ts` (9 test, red-phase — `1-UNIT-001` subset)
- Pendukung: `tests/support/helpers/sesi-minting.ts`, konstanta `TEST_IDS.login.*`/`TEST_IDS.statusPendaftaran.*`
- Semua test masih `test.skip()` (TDD RED) — lepas skip per tugas, buktikan merah, hijaukan, commit.

## Spec Change Log

## Review Triage Log

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
