---
title: 'Story 1.4 — Pendaftaran Owner Mandiri & Status'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_commit: '1a5559496fd1513f9234eeaea0d2d446da8c8db8'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Calon owner masih harus masuk lewat Google Form — belum ada pendaftaran mandiri dari link publik dengan akun Google yang langsung membuat baris owner `diajukan` + tercatat di audit, dan status pendaftaran belum terumumkan `aria-live`.

**Approach:** Tambah endpoint `POST /api/pendaftaran` (tipis; logika di modul identity, insert-CAS idempotent per email + audit in-tx), halaman publik `/pendaftaran` dengan CTA Google (TANPA input referral), lengkapi badge status dengan `aria-live="polite"`, lalu aktifkan test red-phase ATDD yang sudah ada.

## Boundaries & Constraints

**Always:**
- Handler API tipis; logika di `server/domain/identity/registration.service.ts`; Drizzle hanya di `owner.repo.ts`; tulis audit hanya via `writeAuditEntry` dari `server/domain/audit/index.ts` (AD-5), in-tx (AD-3), action `'pendaftaran-diajukan'` dari registry `shared/domain/audit.ts`, actor `{ kind: 'user', ownerId }`.
- Email pendaftar diambil dari sesi Google (`getSessionEmail`), bukan dari body; tanpa sesi → 401 envelope `server/utils/api-error.ts`.
- Idempotensi = `INSERT ... ON CONFLICT (email) DO NOTHING` lalu baca baris existing — baris existing TIDAK PERNAH dimutasi (status terverifikasi/keluar tidak pernah ditimpa); 201 saat baris baru dibuat, 200 saat mengembalikan baris existing.
- Kode 201/400 via konstanta `HTTP_STATUS` (perluas bila perlu) — tanpa magic number; penamaan Indonesia; header komentar modul + referensi AD/FR.
- Halaman publik `definePageMeta({ auth: false })`, brand light-only navy, lockup logo 80px + tagline sesuai mockup `mockups/key-pendaftaran-profile.html`, target sentuh ≥44px.

**Never:**
- Tidak meminta/menyimpan field referral; body berisi `referral` → 400 envelope (referral hanya di Pembelian Pertama, Epic 3).
- Tidak ada migrasi baru dan tidak mengubah skema `owners`/`audit_logs`/`shared/domain`.
- Tidak mengubah: `auth-guard.ts`, `LANDING_PATH`, `PESAN_UNLINKED`, kontrak testid `status-badge`/`status-alasan-penolakan`, `PETA_BADGE`.
- Di luar lingkup: cron kedaluwarsa (`runRegistrationDailyJob` tetap no-op — Story 1.5), transisi `kedaluwarsa → diajukan` (1.5), verifikasi COO (1.6), Kelengkapan Profile (1.5), CTA/link pendaftaran di halaman Login (AC mem-pin akses via link publik).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| POST anonim | tanpa cookie sesi | 401 envelope `{code,message,details}` | envelope seragam |
| POST pertama kali | sesi Google unlinked, body `{}` | 201 `{ id, email, status: 'diajukan' }` tanpa field referral; baris baru + audit in-tx (details memuat email) | — |
| POST ulang email sama | baris existing `diajukan` | 200 idempotent, `id` sama, tanpa mutasi & tanpa audit baru | — |
| POST email existing non-`diajukan` | status `terverifikasi`/`keluar`/`kedaluwarsa` | 200 baris sama TANPA mutasi status | — |
| POST body bawa `referral` | `{ referral: '...' }` + sesi sah | 400 envelope, tidak ada tulisan DB | pesan validasi Indonesia |
| CTA tanpa sesi | buka `/pendaftaran` anonim | CTA tampil → `signIn('google', { callbackUrl: '/pendaftaran' })`; TANPA textbox `/referral/i` | — |
| CTA dengan sesi unlinked | klik CTA | POST terkirim (201) → redirect `/status-pendaftaran`, badge Diajukan | gagal → pesan envelope tampil di dekat CTA (region aria-live), state dipertahankan |
| Sesi calon buka `/pendaftaran` | principal calon | redirect `/status-pendaftaran` | — |
| Sesi owner/COO buka `/pendaftaran` | principal non-calon | redirect `LANDING_PATH[role]` | — |
| Badge di `/status-pendaftaran` | calon `diajukan`/`ditolak` | elemen badge bawa atribut `aria-live="polite"`; Ditolak tetap + alasan verbatim | — |

</frozen-after-approval>

## Code Map

- `server/domain/identity/owner.repo.ts` -- tambah fungsi repo CAS `daftarOwnerByEmail` (satu-satunya tempat Drizzle; header file baris 4–6 sudah menyiapkan ini). Jangan ubah `upsertOwnerByEmail` yang dipakai test-seed.
- `server/domain/identity/registration.service.ts` -- logika `ajukanPendaftaran` (tx + audit in-tx); `runRegistrationDailyJob` tetap no-op.
- `server/domain/identity/index.ts` -- pintu ekspor (AD-5); tambah ekspor fungsi baru.
- `server/domain/audit/index.ts` -- `writeAuditEntry(tx, { actor, action, target, details })`; target konvensi `owners:<id>` (contoh: `server/api/test/audit-seed.post.ts:74-84`).
- `server/api/pendaftaran/status.get.ts` -- pola acuan handler tipis (`getSessionEmail` → 401 → `buildPrincipal(createIdentityRepo(useDb()), email)` → redirect).
- `server/utils/api-error.ts` -- `HTTP_STATUS` belum punya `created: 201`; `sendApiError` untuk error. `server/utils/session.ts` -- `getSessionEmail(event)`.
- `app/pages/status-pendaftaran.vue` -- badge `status-badge` (baris 56) belum bawa `aria-live`; tambah atribut, jangan ubah PETA_BADGE.
- `app/pages/login.vue` -- pola halaman publik + `signIn('google', { callbackUrl })`; `BrandLogo size="login"` = 80px. Varian Badge `warn/success/destructive` tersedia.
- `tests/e2e/pendaftaran.api.spec.ts` (6 test) & `pendaftaran.spec.ts` (4 test) -- red-phase `test.skip()`, un-skip per tugas; kontrak wire terpin di header file.
- `tests/support/helpers/sesi-minting.ts` + `server/api/test/login.post.ts` -- persona `unlinked`/`calon-diajukan`/`coo` + opsi `status` SUDAH didukung.
- `server/domain/identity/{registration.service,owner.repo}.test.ts` -- pola unit test DI-stub/Drizzle-chain palsu.
- `shared/domain/identity.ts` -- enum status & `CALON_OWNER_STATUSES`; JANGAN diubah.

## Tasks & Acceptance

**Execution:**
- [x] `server/utils/api-error.ts` -- tambah `created: 201` (dan `ok: 200` bila perlu) ke `HTTP_STATUS` -- konstanta status tanpa magic number.
- [x] `server/domain/identity/owner.repo.ts` -- fungsi `daftarOwnerByEmail(executor, { email })`: `INSERT ... ON CONFLICT (email) DO NOTHING RETURNING` → bila kosong, `SELECT` baris existing; kembalikan `{ rekaman, baru: boolean }` -- CAS idempotent by-construction (AD-11).
- [x] `server/domain/identity/registration.service.ts` -- `ajukanPendaftaran({ email }, executor)`: satu `db.transaction` → repo di atas → bila `baru` panggil `writeAuditEntry(tx, ...)` action `'pendaftaran-diajukan'`, target `owners:<id>`, `details: { email }`; kembalikan `{ rekaman, baru }` -- logika domain + audit in-tx (AD-3, FR-22).
- [x] `server/domain/identity/index.ts` -- ekspor `ajukanPendaftaran` dan tipe wire-nya -- pintu tunggu impor lintas modul.
- [x] `server/api/pendaftaran/index.post.ts` -- handler tipis: `getSessionEmail` → 401; body mengandung kunci `referral` → 400 envelope; panggil service; respond 201/200 `{ id, email, status }` -- kontrak I/O matrix.
- [x] `app/pages/pendaftaran.vue` -- halaman publik baru: `auth: false`, lockup BrandLogo 80px + judul "Ownership Dashboard" + tagline + sub-copy + CTA "Daftar dengan Akun Google" (≥44px, navy) + footer copy mockup; state anonim = CTA signIn; state unlinked = CTA submit → POST → redirect `/status-pedaftaran`; pesan error envelope di region `aria-live="polite"`; calon/non-calon redirect via `/api/landing` -- AC1 + flow 6 EXPERIENCE.md.
- [x] `app/pages/status-pendaftaran.vue` -- tambah `aria-live="polite"` pada elemen badge `status-badge` -- AC2 tanpa mengubah kontrak testid/PETA_BADGE.
- [x] `server/domain/identity/registration.service.test.ts` dan `owner.repo.test.ts` -- unit test edge matrix: baris baru → audit tertulis in-tx; existing → tanpa audit & tanpa mutasi; ON CONFLICT jalur fallback SELECT -- uji edge I/O matrix.
- [x] `tests/e2e/pendaftaran.api.spec.ts` -- un-skip 6 test API, jalankan sampai hijau -- verifikasi kontrak endpoint.
- [x] `tests/e2e/pendaftaran.spec.ts` -- un-skip 4 test E2E; sesuaikan nama by-role CTA menjadi "Daftar dengan Akun Google" (mockup UX terpin mengalahkan asumsi red-phase — catat alasan di komentar) -- verifikasi journey UI.
- [x] (tambahan audit matriks) `tests/e2e/pendaftaran.spec.ts` -- 1 test P1 baru: mesin status halaman (calon → `/status-pendaftaran`, COO → `/antrian-beli`) menutup 2 baris matriks redirect yang belum punya test penutup.

**Acceptance Criteria:**
- Given link publik `/pendaftaran` dibuka tanpa sesi, when halaman render, then CTA Google tampil dan tidak ada input `/referral/i`.
- Given sesi Google unlinked menekan CTA, when POST diproses, then baris owner `diajukan` dibuat + entry audit `pendaftaran-diajukan` in-tx, dan pendaftar dialihkan ke `/status-pendaftaran` dengan badge Diajukan.
- Given pendaftar `ditolak`, when membuka `/status-pendaftaran`, then badge Ditolak + alasan verbatim, elemen badge bawa `aria-live="polite"`.
- Given email sudah terdaftar (status apa pun), when POST ulang, then tidak ada baris ganda dan status existing tidak berubah.

## Implementation Notes

## Spec Change Log

- **2026-09-18 (green-phase, tersanksi Design Notes):** Label CTA halaman `/pendaftaran` = "Daftar dengan Akun Google" (mockup UX terpin), menggantikan asumsi red-phase "Daftar sebagai Owner"; test E2E disesuaikan dengan komentar alasan.
- **2026-09-18 (green-phase, stabilitas rerun):** Test E2E submit (201) memakai email sintetis UNIK (`emailSintetisUji`, pola file API) alih-alih email deterministik mint — rerun terhadap DB dev persisten tidak lagi menjawab 200 idempoten dan mematahkan kontrak "201 saat baris baru dibuat".
- **2026-09-18 (green-phase, infra test):** Klik CTA pada test submit/duplikat dibungkus `recurse` (pola `smoke.ui.spec.ts` — hidrasi Vue dev server eventual-consistent, klik dini tidak membawa handler); resolver `/api/landing` di halaman dibungkus `useAsyncData` agar hasil SSR dikirim via payload — tanpa fetch ulang 401 anonim di jaringan browser dan hidrasi tanpa round-trip.
- **2026-09-18 (audit matriks):** Ditambah 1 test E2E P1 penutup 2 baris matriks redirect (calon → `/status-pendaftaran`, non-calon COO → `LANDING_PATH[role]`) yang belum punya test penutup — total 5 test E2E + 6 test API.
- **2026-09-18 (pasca-uji manual owner — re-negotiasi copy):** Halaman `/pendaftaran` diubah manual oleh owner: judul "Jadilah Pemilik" di atas lockup, tagline lowercase, sub-copy baru, CTA menjadi "Daftar", footer copy disembunyikan. Test E2E (label by-role) + header komentar halaman diselaraskan; komentar riwayat label dicatat di spec E2E.
- **2026-09-18 (pasca-laporan redirect #2 — investigasi + pengerasan):** Laporan "tidak redirect ke /status-pendaftaran" pasca-daftar manual TIDAK ter-reproduksi (e2e 15/15 + Chrome asli persistent-context: POST 201 → redirect sukses, nol page-error; baris owner pendaftar memang terbuat). Diagnosis: kelas race hidrasi/HMR dev-server. Pengerasan: POST kini berjalan OTOMATIS saat mount untuk sesi unlinked (memenuhi Flow 6 UX harfiah; klik CTA tetap berlaku, idempotent — baris matriks "klik CTA → POST → redirect" tetap sah). Test [P0] submit ditulis ulang ke asersi web-first `toHaveURL` (auto-retry) menggantikan polling URL manual `recurse` yang kalah cold-start chunk lazy di browser pertama.
- **2026-09-18 (perluasan disetujui owner — tautan login + precedence calon):** (1) Halaman login memuat tautan pendaftaran: "Mau daftar?" (anonim) + frasa "lanjutkan pendaftaran" pada pesan unlinked menaut ke /pendaftaran — teks verbatim UX-DR15 utuh, pin HTML mentah di landing.api.spec.ts dinormalisasi tag; (2) `resolveRole`: calon (diajukan/ditolak/kedaluwarsa) KINI MENANG atas keluar/first_effective_at (pendaftar data migrasi tetap ke /status-pendaftaran); `keluar` tetap tanpa_saham → /personal (kontrak epic dipertahankan). Ditemukan sekaligus: test yang meninggalkan sesi unlinked di /pendaftaran memicu auto-submit yang MEMBUAT owner — mint wajib email unik (antipolinasi antar-test).
- **2026-09-18 (perluasan disetujui owner — AMANDEM BOUNDARIES BEKU "tanpa migrasi baru"):** Migrasi 0003 menambah `owners.referral_code` (NOT NULL UNIQUE, alfanumerik 8, backfill upper(md5(id),8)) + `owners.used_referral_code` (nullable, DORMANT sampai Epic 3). Generator murni `buatKodeReferral` di shared/domain (sumber acak disuntik) di-wire ke KEDUA jalur insert repo (`daftarOwnerByEmail` dgn retry 23505 ×3, `upsertOwnerByEmail` mint/seed); kolom 2 (referral yang DIPAKAI pendaftar via param link ?ref=) menyusul Epic 3 — input desain dicatat di deferred-work.
- **2026-09-18 (keputusan owner — kunjungan TIDAK PERNAH menulis data):** Auto-submit saat mount /pendaftaran DIHAPUS — satu-satunya pemicu POST /api/pendaftaran adalah KLIK CTA "Daftar" (laporan owner: login akun unlinked lalu diarahkan ke pendaftaran membuat baris owner tanpa aksi mendaftar). Journey final: login unlinked → pesan "Akun tidak ditemukan." → klik "Lakukan pendaftaran" → halaman /pendaftaran TANPA tulisan data → klik "Daftar" → 201 + redirect /status-pendaftaran. Copy login juga di-renegotiasi owner (pesan unlinked "Akun tidak ditemukan." + tautan "Lakukan pendaftaran"; tautan anonim "Belum jadi pemilik? Yuk Gabung!") — pin lama UX-DR15 verbatim dicabut, test diselaraskan.
- **2026-09-18 (keputusan owner — kejelasan pasca-OAuth + umpan balik sukses):** (1) Redirect pasca-POST diganti HARD navigation `window.location.assign('/status-pendaftaran?daftar=berhasil')` — bukti DB retest owner: POST 201 + baris tercipta namun navigateTo SPA tak berpindah di browser riil (dua kali dilaporkan); (2) toast konfirmasi `Pendaftaran berhasil diajukan.` di halaman status (flag query dibersihkan onMounted) + pesan sukses lokal di /pendaftaran; (3) CTA dinamis: anonim = "Daftar" (→ OAuth), sesi unlinked = "Selesaikan Pendaftaran" + status "Akun Google Anda sudah terhubung — tinggal satu langkah lagi." — pasca-OAuth halaman tidak lagi tampak identik (laporan owner: klik pertama = OAuth, klik kedua = tulis data, terasa seperti bug).
- **2026-09-18 (feedback manual — toast terbaca + modal T&C wajib):** (1) Toast sukses berdurasi 8s dan tampil di halaman BERIKUTNYA — daftar: toast di /status-pendaftaran (sudah); masuk: flag sessionStorage ditandai halaman login pre-signIn, dikonsumsi composable `useSekaliToastMasuk` di 4 landing (dashboard/personal/antrian-beli/status; dilewati bila toast daftar hadir); (2) modal konfirmasi T&C (shadcn Dialog) jadi SYARAT klik CTA — anonim maupun unlinked: checkbox wajib "Saya sudah memahami aturan main owner dan risiko yang mungkin harus ditanggung.", Lanjutkan disable sebelum centang, Batal/tutup = tanpa OAuth & tanpa tulis DB; (3) tautan "Syarat & Ketentuan" di bawah CTA membuka modal yang sama (halaman T&C penuh di luar scope 1.4). Penyimpanan record persetujuan menunggu halaman T&C permanen — consent saat ini berlaku sebagai gate UX event-driven.
- **2026-09-18 (feedback manual — modal T&C hanya SEKALI per journey):** Persetujuan T&C kini TERSIMPAN di sessionStorage (`snd-dash.pendaftaran-syarat-setuju`) saat modal dikonfirmasi — pasca-kembali dari OAuth, klik "Selesaikan Pendaftaran" langsung POST tanpa modal (laporan owner: modal muncul 2x). Scoping = tab/journey; kunjungan baru tanpa consent tetap kena modal (test auth-landing [P2] tetap mem-pin jalur konsen pertama; test submit/error-path mem-pin jalur consent-pra-OAuth tanpa modal).
- **2026-09-18 (feedback manual — kedatangan dari login gagal = FRESH):** Sesi sisa percobaan login yang gagal (unlinked) membuat /pendaftaran langsung menyajikan "sudah terhubung — Selesaikan Pendaftaran" SEBELUM user mengonfirmasi apa pun (laporan owner). Fix: tautan "Lakukan pendaftaran" membawa penanda `?dari=login` → halaman pendaftaran menyajikan presentasi FRESH (CTA "Daftar", tanpa status terhubung) dan CTA menjalankan OAuth ulang; mode terhubung + "Selesaikan Pendaftaran" baru tampil pasca-Google (target callback tanpa penanda). Klik tetap satu-satunya pemicu tulis data; kunjungan ?dari=login juga tanpa tulisan.
- **2026-09-18 (patch hasil review):** (1) test API P1 baru untuk baris matriks "email existing non-`diajukan` → 200 tanpa mutasi status" (skema `SkemaPendaftaranExisting` terpisah — 7 test API); (2) test stub 409 dinamai ulang jujur sebagai simulasi jalur render pesan error envelope (bukan kontrak duplikat); klaim "pesan duplikat 'sudah terdaftar'" dikeluarkan dari daftar non-negotiable header; (3) assertion `aria-live="polite"` pada pesan error; (4) literal angka test E2E dinaikkan ke konstanta bernama (`STATUS_CREATED`, `BATAS_RECURSE_*`, `INTERVAL_RECURSE_MS`).

## Review Triage Log

| Temuan | Verdict | Bukti |
|--------|---------|-------|
| blind: test duplikat stub 409 di-framing sebagai kontrak duplikat; asumsi red #5 tak direkonsiliasi (mirror: edge-case claim, vgap Other) | low | Stub 409 memang disengaja untuk jalur UI error (header red-phase), dan idempotensi nyata sudah terpin di level API (NON-DUPLIKASI disengaja) — tapi nama test, klaim header "non-negotiable pesan duplikat", dan absennya rekonsiliasi asumsi #5 di Change Log menyesatkan pembaca; perbaikan = dokumentasi jujur |
| vgap: wire kontrak re-daftar non-`diajukan` tak teruji (pre-verified) (mirror: blind matriks non-diajukan) | medium | Demonstrasi vgap: hardcode `status: 'diajukan'` di handler lolos seluruh suite — baris matriks beku tak terlindungi di boundary wire; unit fake-chain tidak mengeksekusi pemetaan respons |
| blind: `.opencode/opencode.json` ikut diff story | low | Config tooling lokal pre-existing sebelum story; bukan keluaran implementasi — keluarkan dari commit story |
| blind: sprint-status `in-progress` saat spec `in-review` | low | Sequencing internal workflow — sinkronisasi sprint-status ke `review` saat gerbang review dibuka |
| blind: literal `201`/`30_000`/`15_000`/`500` tanpa konstanta di spec E2E | low | Lint lulus (rule tak menyentuh test), tapi file saudara `pendaftaran.api.spec.ts` di story yang sama memakai konstanta bernama — konsistensi developer-facing |
| edge: 500 mentah bila service throw (tanpa try/catch envelope) | low | Pola identik sibling handler (`status.get.ts`, `audit/index.get.ts`) — perilaku app-wide pre-existing untuk kegagalan infrastruktur; kontrak error spec mem-pin 401/400 saja |
| edge: email case/whitespace → dua baris satu identitas | false | Klaim email Google ber Variasi antar-sesi untuk akun sama tak terjangkau — email claim per akun stabil (Gmail lowercase); duplikasi butuh representasi BERVARIASI dari identitas sama |
| edge: landing 5xx transient → user ber-sesi melihat CTA OAuth | low (ditolak) | Skenario langka & self-healing — pasca-OAuth resolver menentukan mode POST; POST tetap ter-gate auth; fix menambah cabang (bukan koreksi langsung) |
| vgap: cabang CTA anonim → `signIn` tak terautomasi (pre-verified) | low | Konvensi repo terpin (`auth-landing.spec.ts:73-78` + checklist): OAuth asli = smoke manual AR-3; mekanisme `signIn` dipakai bersama login yang tercakup smoke manual |
| vgap: `aria-live="polite"` region error CTA tak di-assert (pre-verified) | low | Test error-path hanya assert teks; atribut ada di kode tapi regresi a11y tak terjaga — satu assertion langsung di locator yang sudah ada |

## Design Notes

- **Label CTA:** mockup UX terpin (`mockups/key-pendaftaran-profile.html`) mem-pin "Daftar dengan Akun Google"; asumsi red-phase "Daftar sebagai Owner" kalah otoritas — test disesuaikan saat un-skip dengan komentar alasan.
- **Idempotent bukan 409:** duplikat dikembalikan 200 pada baris yang sama; "no mutation" membuat status `terverifikasi`/`keluar` mustahil tertimpa tanpa lintasan status terpisah. Re-daftar `kedaluwarsa → diajukan` (CAS) adalah Story 1.5.
- **Mesin status halaman:** resolver `/api/landing` menentukan mode (anonim/unlinked/calon/non-calon) di SSR seperti `status-pendaftaran.vue:24-38`; klik CTA (bukan auto-submit saat mount) yang memicu POST — sesuai skenario test E2E.
- **Wire sukses:** `{ id, email, status: 'diajukan' }` flat tanpa field referral; `referral: z.never().optional()` pada test menegakkan "tidak menggemakan referral".

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: tanpa error.
- `npm run test` -- expected: seluruh vitest hijau (termasuk unit baru; coverage `shared/domain` tidak berubah).
- `npx playwright test tests/e2e/pendaftaran.api.spec.ts tests/e2e/pendaftaran.spec.ts` -- expected: 10 test hijau (butuh DB lokal + `ENABLE_TEST_AUTH`).
- `npm run test:e2e` -- expected: seluruh suite tetap hijau, tidak ada regresi auth-landing/landing/audit.
