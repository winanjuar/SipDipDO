---
title: 'Story 1.7 — Role, Matriks Keterbukaan & Navigasi'
type: 'feature'
created: '2026-09-21'
baseline_commit: '9f25c43a138b33b294bf4dc2ba57a1a7fe5f5639'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/atdd-checklist-1-7-role-matriks-keterbukaan-navigasi.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Role tiga tingkat dan matriks keterbukaan §4.8 (FR-15) belum ditegakkan di batas server — owner tanpa saham yang membuka URL permukaan terkunci (`/dashboard`, `/antrian-beli`, `/audit-trail`) tidak dialihkan dengan pesan transparansi; predikat akses kanonik (`aksesPenuh`/`perluReferral`/`pilihanReferral` — AD-8/AD-11) belum ada di IDENTITAS; navigasi role-based (bottom nav mobile maks 4 + "Lainnya", sidebar desktop — UX-DR14) belum ada sama sekali; Halaman Personal masih kerangka kosong tanpa section Profile/pintu Pesanan (UX-DR19).

**Approach:** Predikat akses MURNI di `shared/domain/identity.ts` atas status siklus hidup + `firstEffectiveAt` (TIDAK pernah dari `positions.shares` live — AD-8); registry permukaan terkunci + item navigasi per role (data-driven, murni) di `shared/domain`; `auth-guard` diperluas menegakkan registry di batas server (middleware + route handler — AD-8); endpoint baru `GET /api/personal` (profil milik-sendiri read-only untuk role `tanpa_saham`); layout aplikasi dengan sidebar desktop + bottom nav mobile + Sheet "Lainnya"; Halaman Personal ber-section (Profile, portofolio & status Pesanan state kosong, harga & RKAP tautan state kosong, pintu Pesanan Pembelian). Aktivasi test ATDD red-phase Story 1.7 per tugas.

## Boundaries & Constraints

**Always:**
- Predikat murni di `shared/domain/identity.ts` — SEMANTIK terpin (AD-8/AD-11/review-adversarial-v3 P8): `aksesPenuh(s) = s.firstEffectiveAt !== null` (Pembelian Pertama efektif membuka penuh — termasuk `keluar` yang pernah membeli); `perluReferral(s) = (status ∈ {terverifikasi, keluar}) && firstEffectiveAt === null` (keluar-belum-beli termasuk cakupan AD-11); `layakPilihanReferral(s) = firstEffectiveAt !== null || status ∈ {terverifikasi, keluar}` (pemegang saham termasuk COO, atau owner belum-pernah-beli). Fungsi set-DB `pilihanReferral(tx)` = Epic 3 (butuh query + keputusan MRO cross-referral) — TIDAK di story ini.
- Gating middleware WAJIB memakai predikat atas snapshot owner, BUKAN role saja: `resolveRole` memetakan `keluar` → `tanpa_saham` SEBELUM melihat `firstEffectiveAt` (`access.service.ts`) — `keluar`-pernah-beli (role `tanpa_saham`, `aksesPenuh=true`) TETAP boleh `/dashboard`; hanya `tanpa_saham`+`!aksesPenuh` yang dialihkan.
- Penegakan di middleware server + route handler, tidak pernah di klien saja (AD-8); endpoint baru mengikuti pola `landing.get.ts` (handler tipis, sesi → `buildPrincipal`, envelope seragam `server/utils/api-error.ts`).
- Registry murni `shared/domain`: pemetaan permukaan → prasyarat akses, dan fungsi item navigasi per role. Epic 2–4 menambah permukaan/item lewat registry — TANPA mengubah logika middleware.
- Pesan transparensi VERBATIM `PESAN_TRANSPARANSI = 'Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.'` — dikirim via query param (`/personal?info=transparansi`) karena redirect server tidak dapat menulis sessionStorage; halaman membaca query → Alert `aria-live="polite"` → URL dibersihkan.
- Navigasi: mobile (<lg) bottom nav `MAKS_ITEM_NAV_MOBILE = 4` (konstanta bernama) + "Lainnya" (Sheet shadcn) bila item > 4; desktop (≥lg) sidebar kiri (logo 32px tanpa tagline, ketuk logo → landing role); item terkunci TIDAK TAMPIL sama sekali (UX-DR14); item aktif `aria-current="page"`; modal bertumpuk maks 1 tingkat.
- Item navigasi awal (registry, dari model nav EXPERIENCE §Navigasi, permukaan Epic 1 saja): `coo` = Antrian Beli, Dashboard, Audit Trail; `pemegang_saham` = Dashboard; `tanpa_saham` = Halaman Personal (+ Dashboard bila `aksesPenuh`); `calon_owner` = TANPA nav (UX-DR14 — perilaku 1.5 tetap). Item "Pesanan Saya" dst. ditambahkan story pemilik permukaannya.
- Halaman Personal: section Profile (data read-only dari `GET /api/personal`), section Portofolio & status Pesanan Pembelian (state kosong — Epic 3), tautan Harga berjalan & RKAP (state kosong — Epic 2), pintu pembuatan Pesanan Pembelian (non-aktif + keterangan — lihat Open Questions #1).
- Layout `app/layouts/app.vue` HANYA untuk permukaan ber-nav (dashboard, personal, antrian-beli, audit-trail); halaman publik & calon (login, register, status-pendaftaran, profile-completeness, index, offline, smoke) TANPA layout.
- Un-skip scaffold ATDD per tugas; kegagalan merah diverifikasi sebelum implementasi; tanpa magic number (konstanta bernama); penamaan Indonesia; header komentar + referensi AD/FR; audit TIDAK diperlukan untuk operasi baca (FR-22 audit = aksi mutasi).

**Never:**
- TIDAK mengubah kontrak hijau eksisting: `/api/profile` (PUT/GET calon-only 403 non-calon), `/api/register*`, `/api/audit` (COO-only), `/api/landing`, `LANDING_PATH`, `resolveRole`, `PETA_BADGE`, perilaku gerbang calon 1.5 di `auth-guard` (dievaluasi SEBELUM gerbang role).
- TIDAK mengimplementasi konten Epic 2 (harga, RKAP, MoM) atau Epic 3 (pesanan, antrian) — semua state kosong/tautan non-aktif (epic-1-context: jangan diimplementasi di epic ini).
- TIDAK menulis fungsi set-DB `pilihanReferral(tx)` (Epic 3); TIDAK menyentuh alur verifikasi/penolakan COO (Story 1.6 — tim lain; CAS write path + migrasi CHECK `ditolak` milik mereka).
- TIDAK mengubah perilaku `/audit-trail` yang sudah diuji 1.3: middleware MENAMBAH penegakan server (non-COO → landing role); resolver halaman audit-trail DIPERTAHANKAN defensif — test 1.3 tetap hijau tanpa perubahan.
- TIDAK menurunkan akses dari `positions.shares` live (AD-8/AD-11 — pelanggaran bernama); TIDAK menyimpan role di JWT/session.
- Di luar lingkup: MFA/OTP, manajemen owner COO (1.8), pergantian COO (1.9), PWA manifest, dark mode.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Predikat per enum (unit) | 7 kombinasi {status × firstEffectiveAt}: diajukan/ditolak/kedaluwarsa+null → (false,false,false); terverifikasi+null → (false,true,true); terverifikasi+terisi → (true,false,true); keluar+null → (false,true,true); keluar+terisi → (true,false,true) — urutan (aksesPenuh, perluReferral, layakPilihanReferral) | fungsi murni, deterministik | — |
| Tanpa sesi × permukaan terproteksi | dokumen SSR tanpa cookie | redirect `/login` (perilaku eksisting, tak berubah) | — |
| tanpa_saham !aksesPenuh × `/dashboard` | owner `terverifikasi` belum-beli (atau `keluar` belum-beli), URL langsung | redirect server `/personal?info=transparansi` (AD-8, UX-DR14) — bukan sekadar disembunyikan di UI | — |
| tanpa_saham !aksesPenuh × `/antrian-beli` atau `/audit-trail` | sama | redirect `/personal?info=transparansi` | — |
| tanpa_saham aksesPenuh × `/dashboard` | `keluar` PERNAH membeli (`firstEffectiveAt` terisi) | 200 — halaman tampil (matriks terbuka otomatis pasca Pembelian Pertama; AD-8) | — |
| pemegang_saham × `/antrian-beli` / `/audit-trail` | URL langsung | redirect landing-nya `/dashboard` | — |
| coo × `/personal` | URL langsung | redirect `/antrian-beli` | — |
| calon × permukaan mana pun | `diajukan`/`ditolak`/`kedaluwarsa` | gerbang calon 1.5 dulu (profil-completeness / status-pendaftaran) — TIDAK tersentuh gerbang role | — |
| unlinked × permukaan terproteksi | sesi tanpa baris owner | perilaku eksisting (middleware passthrough → halaman resolver → login) | — |
| Pesan transparansi | landing `/personal?info=transparansi` | Alert verbatim `PESAN_TRANSPARANSI`, `aria-live="polite"`, SEKALI; URL dibersihkan (refresh tidak mengulang) | — |
| GET `/api/personal` tanpa sesi | tanpa cookie | 401 envelope seragam | envelope `{code,message,details}` |
| GET `/api/personal` role lain | sesi calon / `pemegang_saham` / coo | 403 envelope; TIDAK ada baca data | — |
| GET `/api/personal` tanpa_saham | sesi `terverifikasi`/`keluar` | 200 `{ email, status, ...10 field profil wire, profileComplete: true }` — read-only milik-sendiri | — |
| Nav mobile per role | login <lg | bottom nav sesuai registry; item terkunci absen; ≤4 item — "Lainnya" (Sheet) hanya bila >4; aktif `aria-current="page"` | — |
| Nav desktop per role | login ≥lg | sidebar kiri grup sesuai role; logo 32px ketuk → landing role; tanpa tagline | — |
| Halaman Personal sections | tanpa_saham buka `/personal` | Profile terisi data; Portofolio & Pesanan = state kosong; Harga & RKAP = tautan state kosong; pintu Pesanan non-aktif + keterangan | GET gagal → state kosong Profile + pesan coba lagi (pola 1.5) |

</frozen-after-approval>

## Open Questions

1. Pintu Pesanan Pembelian di Halaman Personal — **default: tombol non-aktif + keterangan singkat** ("Terbuka saat pembelian pertama dibuka") vs disembunyikan sampai Epic 3. (AC 1.7 menyebut pintu sebagai bagian kerangka → default tampil non-aktif.)
2. Tautan Harga berjalan & RKAP — **default: dirender non-aktif (aria-disabled) + keterangan** vs disembunyikan sampai Epic 2. (AC menyebut "tautan state kosong" → default tampil non-aktif.)
3. Item nav "Pesanan Saya" (model final EXPERIENCE) — **default: TIDAK di story ini**; registry-driven, ditambahkan story pemilik permukaannya (Epic 3).

## Code Map

- `shared/domain/identity.ts` -- TAMBAH (satu file, AD-8 menyatukan role+akses): konstanta `PESAN_TRANSPARANSI`, `MAKS_ITEM_NAV_MOBILE = 4`; tipe `AccessSnapshot` (reuse `OwnerAccessSnapshot`); predikat murni `aksesPenuh`, `perluReferral`, `layakPilihanReferral`; registry permukaan `PERMUKAAN_PERAN` (path → prasyarat: `coo` / `akses-penuh-atau-lebih` / `tanpa-saham`) + fungsi murni `permukaanDibolehkan(principalLike, path)` dan `itemNavigasi(role, aksesPenuh)` → array `{ label, path }`. TANPA I/O; `identity.test.ts` diperluas (un-skip scaffold 1-UNIT-001).
- `server/domain/identity/index.ts` -- ekspor fungsi baru (AD-5).
- `server/middleware/auth-guard.ts` -- perluas BERURUTAN: sesi → unlinked passthrough → gerbang calon 1.5 (eksisting, tak berubah) → gerbang role via `permukaanDibolehkan`: tanpa_saham !aksesPenuh × permukaan terkunci → `sendRedirect('/personal?info=transparansi')`; role salah × permukaan role-lain → `sendRedirect(LANDING_PATH[role])`. Registry-driven — logika umum, data di shared.
- `server/api/personal/index.get.ts` -- BARU (pola `landing.get.ts`): sesi → 401; `buildPrincipal` → role `tanpa_saham` → 200 profil read-only (field wire sama `/api/profile`, via repo `findOwnerByEmail`); role lain → 403 envelope.
- `app/layouts/app.vue` -- BARU: shell ber-nav — sidebar desktop (≥lg) + bottom nav mobile (<lg); memakai principal dari endpoint landing yang sudah ada (pola resolver halaman) atau prop halaman; TIDAK untuk halaman publik/calon.
- `app/components/AppSidebar.vue` + `app/components/AppBottomNav.vue` -- BARU: render `itemNavigasi(role, aksesPenuh)`; "Lainnya" = Sheet shadcn (komponen `ui/sheet` eksisting) memuat item overflow; item aktif `aria-current="page"`; logo ketuk → landing role (mobile bottom nav pakai BrandLogo 32px di header ringkas).
- `tests/support/helpers/test-ids.ts` -- blok `navigasi` baru (nama final ditetapkan scaffold ATDD; pola kontrak red-phase eksisting).
- `app/pages/{dashboard,personal,antrian-beli,audit-trail}.vue` -- `definePageMeta({ layout: 'app' })`; resolver eksisting TIDAK dihapus (defensif).
- `app/pages/personal.vue` -- kembangkan kerangka → 4 section matriks (Profile dari `GET /api/personal` via `useAsyncData`; Alert transparansi baca `route.query.info` → tampil sekali → `history.replaceState` URL bersih; section kosong + tautan non-aktif + pintu non-aktif).
- `tests/e2e/*` -- scaffold ATDD 1.7 (nama final oleh ATDD; kandidat: `matriks-akses.spec.ts`, `navigasi.spec.ts`, `personal.api.spec.ts`) + `shared/domain/identity.test.ts` (unit predikat).

## Tasks & Acceptance

**Execution:**
- [ ] Predikat + registry + konstanta di `shared/domain/identity.ts` + unit test (un-skip 1-UNIT-001: 7 kombinasi status × firstEffectiveAt).
- [ ] `auth-guard` gerbang role registry-driven + `GET /api/personal` (401/403/200) — un-skip API scaffold.
- [ ] Layout `app.vue` + `AppSidebar` + `AppBottomNav` + Sheet "Lainnya" + `TEST_IDS.navigasi` — un-skip E2E navigasi.
- [ ] `personal.vue` 4 section + Alert transparansi sekali + URL bersih — un-skip E2E matriks/halaman.
- [ ] Regresi penuh: suite eksisting (auth-landing, audit-trail, kelengkapan-profil, register*, landing.api, cron-harian) tetap hijau + lint + typecheck.

**Acceptance Criteria:**
- Given owner tanpa saham belum-pernah-beli, when membuka `/dashboard`|`/antrian-beli`|`/audit-trail` URL langsung, then dialihkan ke `/personal?info=transparansi` di batas server dan pesan verbatim tampil sekali.
- Given owner `keluar` yang pernah membeli, when membuka `/dashboard`, then halaman tampil (aksesPenuh — bukan role saja).
- Given role mana pun, when navigasi tampil, then item terkunci absen; mobile ≤4 item + Sheet "Lainnya" bila lebih; desktop sidebar; aktif `aria-current`.
- Given Halaman Personal dibuka, then Profile terisi, portofolio/pesanan state kosong, harga & RKAP tautan state kosong, pintu Pesanan non-aktif.
- Given seluruh tugas selesai, when scaffold ATDD 1.7 diaktifkan, then semua hijau + regresi eksisting hijau + lint/typecheck bersih.

## Design Notes

- **Keluar-pernah-beli:** `resolveRole` mengembalikan `tanpa_saham` untuk SEMUA `keluar` (sebelum cek `firstEffectiveAt` — `access.service.ts:69`). Konsekuensi: gerbang role wajib konsultasi `aksesPenuh(snapshot)`; pembukaan otomatis pasca Pembelian Pertama (matriks §4.8) terwujud tanpa mengubah `resolveRole` (kontrak hijau 1.2 beku).
- **Calon precedence:** `CALON_OWNER_STATUSES` menang atas saham (data migrasi) — gerbang calon 1.5 dievaluasi lebih dulu; predikat akses hanya ditanya untuk non-calon.
- **Pesan via query param:** redirect server (`sendRedirect`) tidak dapat menulis sessionStorage — kontrak `?info=transparansi` dibaca halaman, ditampilkan sebagai Alert, lalu URL dibersihkan (pola beda-flag dengan `?daftar=berhasil`); bekerja pula pada SSR pertama.
- **Audit-trail:** penegakan pindah ditambah di middleware (lebih kuat — AD-8); resolver halaman dipertahankan sebagai lapis kedua sehingga suite 1.3 tak tersentuh.
- **Registry data-driven:** Epic 2–4 mendaftarkan permukaan/item baru di `shared/domain` tanpa menyentuh middleware — mencegah drift antara nav (UI) dan gate (server); sumber tunggal kebenaran keterbukaan.
- **Handoff 1.6 (tim lain):** alur verifikasi/penolakan COO + CAS `diajukan → terverifikasi`/`ditolak` + migrasi CHECK `rejection_reason` milik tim 1.6 (catat sprint-status WORKFLOW NOTES 2026-09-21); race vs cron memakai pola CAS `kedaluwarsakanCalon` (spec 1.5). Story ini TIDAK menambahkan jalur tulis status mana pun.

## Verification

**Commands:**
- `npx vitest run shared/domain` -- expected: unit predikat hijau (7 kombinasi matriks).
- `npx playwright test tests/e2e/personal.api.spec.ts` -- expected: hijau setelah tugas endpoint (dev server + `ENABLE_TEST_AUTH=1`).
- `npx playwright test tests/e2e/matriks-akses.spec.ts tests/e2e/navigasi.spec.ts` -- expected: hijau setelah tugas middleware + nav (nama file final mengikuti scaffold ATDD).
- `npx playwright test` -- expected: regresi penuh hijau (suite 1.1–1.5 tak tersentuh).
- `npm run lint && npm run typecheck` -- expected: bersih.
