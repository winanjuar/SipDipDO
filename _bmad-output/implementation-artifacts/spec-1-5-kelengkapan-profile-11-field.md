---
title: 'Story 1.5 — Kelengkapan Profile 11 Field'
type: 'feature'
created: '2026-09-18'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/specs/spec-story-1-5-kelengkapan-profile-11-field/SPEC.md'
  - '_bmad-output/test-artifacts/atdd-checklist-1-5-kelengkapan-profile-11-field.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pendaftar mandiri macet di status `diajukan` — belum ada tempat mengisi 10 field Profile Lampiran A yang menjadi prasyarat verifikasi COO (FR-22), belum ada cron pengingat H-3 & kedaluwarsa hari ke-7 (kalender Jakarta), dan pendaftar `kedaluwarsa` belum bisa mendaftar ulang pada baris yang sama. Tanpa ini UJ-6 tak pernah tuntas.

**Approach:** Migrasi tambah kolom profil `owners` + kontrak murni field di `shared/domain`; service identity menyimpan profil (audit in-tx), mengisi `runRegistrationDailyJob` (pengingat via outbox + CAS kedaluwarsa + audit), dan transisi re-daftar `kedaluwarsa → diajukan` (CAS baris sama + audit); endpoint `PUT/GET /api/profile`; halaman `/profile-completeness` (10 field by-label, Gmail readonly, indikator langkah persis, toast gagal verbatim, tanpa nav lain); gerbang server: calon `diajukan` belum lengkap yang membuka permukaan lain dialihkan. Aktivasi test ATDD red-phase (21 scaffold skip) per tugas.

## Boundaries & Constraints

**Always:**
- Handler API tipis; logika di `server/domain/identity/*.service.ts`; Drizzle hanya di `owner.repo.ts`; audit via `writeAuditEntry` in-tx (AD-3/AD-5), action dari registry `shared/domain/audit.ts` (`profil-kelengkapan`, `pendaftaran-kedaluwarsa`, `pendaftaran-diajukan` — aksi re-daftar pakai `pendaftaran-diajukan` dengan `details.reDaftar: true`, tanpa entri registry baru).
- Envelope error seragam `server/utils/api-error.ts` (`HTTP_STATUS` — perluas bila perlu); email dari sesi (`getSessionEmail`), bukan body; kontrak field Profil = `shared/domain` murni (satu sumber untuk zod handler, label halaman, dan predikat kelengkapan).
- Semua batas hari via `shared/domain/calendar` (`jakartaDayKey`, `addCalendarDays`, `registrationDeadline`): `submittedOn` diturunkan dari `owners.createdAt` (timestamptz → DayKey Jakarta) — TANPA kolom tanggal-submit baru; cron menerima `today` dari endpoint, service menerima `db` (DI) seperti `ajukanPendaftaran`.
- Pengingat via `enqueueEmail(tx, { kind: 'notifikasi', … })` (proofs) DI DALAM transaksi job; idempoten per hari: cek baris outbox (kind + penerima + payload.hari) sebelum insert; kedaluwarsa = CAS `UPDATE owners SET status='kedaluwarsa' WHERE id=? AND status='diajukan'` + audit `pendaftaran-kedaluwarsa` (aktor `system`) hanya bila baris ter-update.
- Re-daftar: `ajukanPendaftaran` bercabang — baris existing `kedaluwarsa` di-CAS ke `diajukan` (+ audit, `id` tetap); status lain tetap echo tanpa mutasi (kontrak hijau 1.4 terjaga; test `terverifikasi` di `register.api.spec.ts` tidak berubah).
- Test-infra dev-only: mint `/api/test/login` menerima `diajukanPada` (DayKey — men-set `createdAt` via opsi upsert); endpoint baru `GET /api/test/outbox?email=` dengan triple-guard identik `/api/test/login`.
- Respons job diperluas: `{ reminded, expired, remindedEmails[], expiredEmails[] }` (kontrak wire terpin `cron-harian.api.spec.ts`); daily.post.ts meneruskan apa adanya.
- Route halaman DIPIN `/profile-completeness` (keputusan owner 2026-09-18, menggantikan asumsi ATDD `/kelengkapan-profil`; scaffold E2E telah diselaraskan).
- Halaman `definePageMeta({ auth: true })`; gerbang halaman = pola resolver `status-pendaftaran.vue` (call `/api/landing` → redirect non-calon); gating tambahan di `server/middleware/auth-guard.ts` untuk permukaan lain; indikator langkah = `data-testid="kelengkapan-indikator"` (TEST_IDS sudah ditambah), menyebut PERSIS field belum lengkap per nama field; gagal simpan non-validasi = Alert `aria-live="polite"` verbatim "Tidak dapat menyimpan — coba lagi." dengan isian dipertahankan (pola `useSekaliAlert`/Alert di repo, bukan toast bawah).
- Un-skip scaffold ATDD per tugas; kegagalan merah diverifikasi sebelum implementasi; tanpa magic number (konstanta bernama); penamaan Indonesia; header komentar + referensi AD/FR.

**Never:**
- TIDAK meminta/menyimpan field Referal (#11) — diajukan saat Pembelian Pertama (Epic 3); body profil berisi `referral` → 400.
- Gmail TIDAK dapat diedit via form (selalu `owners.email` = email sesi).
- Tidak mengubah: `LANDING_PATH` (calon tetap `/status-pendaftaran`), `resolveRole`, `PETA_BADGE`, kontrak hijau `POST /api/register` untuk baris baru/non-kedaluwarsa, `auth-guard` untuk non-calon, enum status, tabel `audit_logs`/`outbox_emails`.
- Di luar lingkup: verifikasi/penolakan COO (1.6), nav matriks penuh per role (1.7), kirim email nyata Resend (verifikasi terpisah — test membaca baris outbox, bukan pengiriman), cron kedaluwarsa pesanan (Epic 3), migrasi apa pun selain penambahan kolom profil `owners`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PUT anonim | tanpa cookie sesi | 401 envelope | envelope seragam |
| PUT oleh non-calon | sesi `terverifikasi`/`keluar`/COO/unlinked | 403 envelope; tidak ada tulisan DB | — |
| PUT lengkap | sesi `diajukan`, body 10 field trim non-kosong | 200 `{ ...10 field, gmail=email sesi, profileComplete: true, remainingFields: [] }`; kolom tersimpan + audit `profil-kelengkapan` in-tx | — |
| PUT kurang N field | ada field trim kosong/absen | 400 envelope; `details.remainingFields` = PERSIS field kosong; TANPA tulisan DB | pesan Indonesia |
| PUT bawa `referral` | `{ referral: '…' }` | 400 envelope, tanpa tulisan | — |
| GET profil | sesi calon `diajukan` | 200 `{ ...field, gmail, profileComplete, remainingFields }` — nilai persisten antar-panggilan | — |
| Cron H-3 | owner `diajukan` belum lengkap, `reminderOn === today` | baris `outbox_emails` (kind `notifikasi`, penerima owner) + `remindedEmails` memuat email; run ulang hari sama → TIDAK dobel | kegagalan kirim TIDAK menggagalkan job (dispatch error-isolated) |
| Cron hari-7 | `expiresOn <= today`, masih `diajukan` | CAS → `kedaluwarsa` + audit `pendaftaran-kedaluwarsa` (aktor system) + `expiredEmails`; owner lengkap / status lain / belum jatuh tempo → tanpa aksi | race vs verifikasi COO dijaga CAS yang sama (1.6) |
| Cron sebelum H-3 | `reminderOn > today` | tanpa email, tanpa mutasi | — |
| Re-daftar kedaluwarsa | POST `/api/register`, baris `kedaluwarsa` | 200; baris SAMA (`id` tetap) kini `diajukan` + audit `pendaftaran-diajukan` (`reDaftar: true`); POST ulang beruntun → 200 idempotent tanpa audit lagi | — |
| Gerbang permukaan | calon `diajukan` belum lengkap buka `/dashboard` (URL langsung) | redirect server ke `/profile-completeness` (AD-8, UX-DR14) | — |
| Halaman kelengkapan non-calon | role bukan calon `diajukan` | redirect landing/`/status-pendaftaran` (pola status-pendaftaran.vue) | — |
| Submit gagal infra | endpoint profil 5xx/gangguan | Alert verbatim + isian form dipertahankan | — |

</frozen-after-approval>

## Open Questions

- Route halaman — options: `/profile-completeness` (Indonesia, konsisten `/status-pendaftaran`; kontrak scaffold ATDD E2E memakai ini) / `/profil` (lebih pendek tapi ambigu dengan manajemen owner COO 1.8) / `/profile-completeness` (Inggris, melawan konvensi UI Indonesia).

## Code Map

- `drizzle/schema.ts` -- tambah 10 kolom profil `owners` (text nullable; gmail TIDAK dibuat — sudah ada `email`); komentar kolom menyusul pola existing; JANGAN sentuh tabel lain.
- `drizzle/migrations/` -- migrasi baru via `drizzle-kit generate` (pola 0003); kolom nullable, tanpa backfill.
- `shared/domain/profil.ts` -- BARU: daftar 10 field kontrak (key + label Indonesia), tipe `ProfilValues`, predikat murni `profilLengkap(row)` + `sisaFieldKosong(row)`; satu sumber untuk zod handler, halaman, cron.
- `server/domain/identity/owner.repo.ts` -- `findOwnerByEmail` ikut men-select kolom profil (dipakai buildPrincipal); `upsertOwnerByEmail` + opsi `createdAt` (mint backdate); fungsi baru `simpanProfilCalon(tx-less db/tx, email, nilai)` (UPDATE by email + returning) dan `kedaluwarsakanCalon(db, id)` (CAS UPDATE ... WHERE status='diajukan' RETURNING); jangan ubah jalur 1.4 yang hijau.
- `server/domain/identity/registration.service.ts` -- isi `runRegistrationDailyJob(today, db)` (select calon `diajukan`, deadline dari `createdAt`, enqueue via `enqueueEmail` proofs in-tx, CAS kedaluwarsa + audit, balikan emails[]); fungsi baru `simpanProfil({ email, nilai }, db)` (tx: update + audit `profil-kelengkapan` bila berubah); cabang kedaluwarsa di `ajukanPendaftaran` (CAS + audit `reDaftar`).
- `server/domain/identity/index.ts` -- ekspor fungsi baru (AD-5).
- `server/domain/identity/access.service.ts` -- `OwnerRoleInput` + kolom profil; `PrincipalOwner` + `profilLengkap: boolean` (dihitung `profilLengkap()`); `resolveRole` TIDAK berubah.
- `server/api/profil/index.put.ts` + `index.get.ts` -- BARU (handler tipis; pola `register/index.post.ts`): sesi → 401; non-calon-diajukan → 403; validasi zod dari `shared/domain/profil` → 400 `remainingFields`; tolak `referral` → 400.
- `server/api/register/index.post.ts` -- TANPA perubahan (cabang di service).
- `server/api/test/login.post.ts` -- body `diajukanPada` (validasi bentuk DayKey) → diteruskan ke upsert.
- `server/api/test/outbox.get.ts` -- BARU: triple-guard copy `/api/test/login`, query `outbox_emails` by penerima (ORDER createdAt DESC, limit kecil), respons `{ data: [...] }`.
- `server/jobs/daily.post.ts` -- kontrak balikan `registration` diperluas (counter + lists) — handler tinggal meneruskan.
- `server/middleware/auth-guard.ts` -- perluas: sesi calon `diajukan` belum lengkap + path di luar `/profile-completeness` & `/status-pendaftaran` → `sendRedirect('/profile-completeness')`; non-calon TIDAK berubah.
- `shared/domain/audit.ts` -- TANPA perubahan (aksi tersedia).
- `app/pages/profile-completeness.vue` -- BARU (pola `status-pendaftaran.vue`: resolver landing → redirect; `definePageMeta({ auth: true })`): form 10 field by-label, Gmail readonly (`:disabled`), indikator `TEST_IDS.kelengkapanProfil.indikator` menyebut sisa field, submit PUT → sukses = perbarui indikator; gagal non-validasi = Alert verbatim + isian tetap; tanpa elemen nav.
- `app/pages/status-pendaftaran.vue` -- tambah tautan "Lengkapi Profile" bila `diajukan` && belum lengkap (satu-satunya pintu nav yang sah).
- `tests/e2e/{profil.api,redaftar.api,cron-harian.api,kelengkapan-profil}.spec.ts` + `server/domain/identity/registration.service.expiry.test.ts` -- un-skip per tugas (kontrak di header masing-masing).
- `registration.service.test.ts` (stub no-op hijau lama) -- perbarui saat tugas cron (kontrak balikan berubah).

## Tasks & Acceptance

**Execution:**
- [ ] `shared/domain/profil.ts` + `drizzle/schema.ts` + migrasi 0004 -- kontrak field + kolom owners; `drizzle-kit generate` + `migrate` lokal.
- [ ] `server/domain/identity/owner.repo.ts` -- select profil, upsert `createdAt`, `simpanProfilCalon`, `kedaluwarsakanCalon`.
- [ ] `server/domain/identity/registration.service.ts` + `index.ts` -- `simpanProfil`, isi `runRegistrationDailyJob(today, db)`, cabang re-daftar; unit test expiry un-skip (`it.skip` → `it`) + perbarui stub-lama.
- [ ] `server/api/test/{login.post,outbox.get}.ts` -- infra uji (diajukanPada + inspeksi outbox).
- [ ] `server/api/profil/{index.put,index.get}.ts` -- endpoint Profil; un-skip `profil.api.spec.ts`.
- [ ] `server/domain/identity/registration.service.ts` (cabang kedaluwarsa) -- un-skip `redaftar.api.spec.ts`.
- [ ] `server/jobs/daily.post.ts` (+ service cron) -- un-skip `cron-harian.api.spec.ts`.
- [ ] `access.service.ts` -- `profilLengkap` di principal (prasyarat middleware).
- [ ] `app/pages/profile-completeness.vue` + `status-pendaftaran.vue` (tautan) + `auth-guard.ts` -- un-skip `kelengkapan-profil.spec.ts`.

**Acceptance Criteria:**
- Given seluruh tugas selesai, when seluruh scaffold ATDD diaktifkan, then semua hijau (`npx playwright test tests/e2e/profil.api.spec.ts tests/e2e/redaftar.api.spec.ts tests/e2e/cron-harian.api.spec.ts tests/e2e/profile-completeness.spec.ts` dan `npx vitest run server/domain/identity`).
- Given calon `diajukan` menyimpan 10 field, when dibuka ulang, then nilai identik dan `profileComplete: true`.
- Given calon belum lengkap melewati H-3 lalu hari ke-7 (jam disuntikkan via seeding), then email pengingat 1 baris di outbox lalu status `kedaluwarsa` + audit; re-daftar tetap satu baris.
- Given calon belum lengkap membuka `/dashboard`, then dialihkan di batas server.
- Given submit gagal non-validasi, then isian dipertahankan + Alert verbatim.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Deadline dari `createdAt`:** `registrationDeadline(jakartaDayKey(new Date(owners.createdAt)))` — hari kalender Jakarta dari instant pendaftaran; TIDAK ada kolom tanggal-submit baru (keputusan desain: satu sumber waktu pendaftaran).
- **Idempoten pengingat:** cek `outbox_emails` (kind `notifikasi` + penerima + `payload.hari = today`) DI DALAM transaksi sebelum insert — dua run cron di hari sama menghasilkan satu baris.
- **Race CAS:** `kedaluwarsakanCalon` memakai `UPDATE ... WHERE status='diajukan' RETURNING id` — nol baris = kalah race (verifikasi COO 1.6 memakai guard yang sama).
- **Gating calon:** middleware hanya mengurus calon `diajukan` belum lengkap; calon `lengkap`/`ditolak`/`kedaluwarsa` tetap di `/status-pendaftaran` (landing 1.2 tidak berubah).

## Verification

**Commands:**
- `npx vitest run server/domain/identity` -- expected: unit expiry hijau + suite lama tetap hijau (setelah stub-lama diperbarui).
- `npx playwright test tests/e2e/profil.api.spec.ts tests/e2e/redaftar.api.spec.ts` -- expected: hijau setelah tugas endpoint.
- `npx playwright test tests/e2e/cron-harian.api.spec.ts` -- expected: hijau setelah tugas cron (dev server + `ENABLE_TEST_AUTH=1`).
- `npx playwright test tests/e2e/profile-completeness.spec.ts` -- expected: hijau setelah tugas UI.
- `npm run lint && npm run typecheck` -- expected: bersih.
