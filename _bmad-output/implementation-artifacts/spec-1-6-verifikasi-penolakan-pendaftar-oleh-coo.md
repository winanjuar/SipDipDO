---
title: 'Verifikasi & Penolakan Pendaftar oleh COO'
type: 'feature'
created: '2026-09-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '4a101b8d31db39bd95a008fee98ce6de6abf1bb4'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pendaftar yang Profilnya sudah lengkap menumpuk selamanya di status `diajukan` — COO belum punya permukaan maupun endpoint untuk memverifikasi atau menolak; transisi `diajukan → terverifikasi/ditolak` belum ada di kode. CHECK constraint `ditolak → rejection_reason` (deferral spec-1-2) juga belum ditegakkan di DB.

**Approach:** Satu halaman COO (daftar calon `diajukan` + aksi verifikasi/tolak) di atas endpoint baru; service identity menjalankan CAS `UPDATE ... WHERE status='diajukan' RETURNING` dalam SATU transaksi + audit in-tx (aksi registry `pendaftaran-verifikasi`/`pendaftaran-penolakan` sudah terdaftar). Gerbang kelengkapan memakai `profilLengkap()` dari `shared/domain/profil.ts`. Migrasi CHECK constraint ditambahkan bersama alur tulis ini.

## Boundaries & Constraints

**Always:**
- Setiap transisi status = CAS `UPDATE owners SET status=... WHERE id=... AND status='diajukan' RETURNING` (pola `kedaluwarsakanCalon`), null/0 baris = kalah race → HTTP 409, tanpa audit baru — menjamin "hanya satu penulis yang berhasil" saat cron kedaluwarsa berjalan hampir bersamaan (AD-11).
- Verifikasi + audit dalam SATU transaksi (`db.transaction` + `writeAuditEntry(tx, ...)`) — audit tidak pernah async (AD-3); target `owners:<id>`; aktor `{kind:'user', ownerId: coo}`.
- Kewenangan COO: handler menolak 401/403 envelope seragam (pola `server/api/audit/index.get.ts`), dan `findActiveCooTenure(tx, cooId, now)` dievaluasi di dalam transaksi tulis.
- Gerbang kelengkapan di server: verifikasi calon `profilLengkap=false` → 400 `PROFILE_INCOMPLETE` — UI hanya lapisan pertama (AD-8).
- Alasan penolakan wajib non-kosong setelah trim — divalidasi handler/service DAN CHECK constraint DB.
- **KEPUTUSAN OWNER (2026-09-21):** hitungan penolakan otomatis (UX-DR20/21) hanya dicatat di audit — `details.hitunganPenolakan` (jumlah entry `pendaftaran-penolakan` untuk owner tsb saat kejadian, termasuk entry yang sedang ditulis); tanpa kolom/migrasi tambahan; pendaftar tidak melihat hitungan.

**Never:**
- Tidak mengubah registry audit, tabel selain `owners` (tulis), jalur hijau 1.4/1.5, dan file yang dipakai cron tanpa perlu.
- Tidak menambah navigasi/menu aplikasi (Story 1.7) — halaman COO dijangkau via URL langsung.
- Tidak mengirim email apa pun ke pendaftar (tidak diminta AC).
- `rejectionReason` tampil & tersimpan apa adanya — tanpa embel-embel yang mengubah teks alasan COO.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| COO buka daftar | Sesi COO, ada calon `diajukan` | `GET /api/pendaftar` → 200 `{data:[{id,email,nama,createdAt,profilLengkap,sisaField}]}` urut `created_at` terlama dulu | 401/403 envelope untuk tanpa sesi/non-COO; daftar kosong → state kosong UI |
| Verifikasi calon lengkap | POST keputusan `{id, keputusan:'terverifikasi'}` | 200; status → `terverifikasi` + audit `pendaftaran-verifikasi` in-tx; login berikutnya calon → landing `/personal` | N/A |
| Verifikasi calon belum lengkap | POST, `profilLengkap=false` | 400 `PROFILE_INCOMPLETE` — tanpa mutasi status/audit | Aksi di UI tidak aktif untuk baris ini (UJ-6) |
| Tolak tanpa alasan / kosong | POST `{id, keputusan:'ditolak', alasan:''}` | 400 `ALASAN_WAJIB` — tanpa mutasi status/audit | UI menandai input alasan wajib (UX-DR20) |
| Tolak dengan alasan | POST `{id, keputusan:'ditolak', alasan:'<teks>'}` | 200; status → `ditolak` + `rejection_reason` tersimpan + audit `pendaftaran-penolakan` (details.alasan + details.hitunganPenolakan); alasan tampil apa adanya di `/status-pendaftaran` | CHECK constraint menolak `ditolak` tanpa alasan di level DB |
| Race: cron kedaluwarsa / keputusan ganda menang lebih dulu | POST saat status sudah bukan `diajukan` | CAS 0 baris → 409 `STATUS_BERUBAH`, tanpa audit baru | UI menampilkan pesan status berubah + muat ulang daftar |
| Id target bukan calon `diajukan` / tidak ada | POST `id` tak dikenal | 404 `TIDAK_DITEMUKAN` envelope | N/A |

</frozen-after-approval>

## Code Map

- `server/domain/identity/owner.repo.ts` -- TAMBAH: `verifikasiCalon(db,id)` + `tolakCalon(db,id,alasan)` (CAS pola `kedaluwarsakanCalon` L386: `WHERE id AND status='diajukan' RETURNING`); `listCalonVerifikasi(db)` — calon `diajukan` + kolom profil (JANGAN ubah `listCalonDiajukan` L297 milik cron). Reuse: `findActiveCooTenure` L155.
- `server/domain/identity/registration.service.ts` -- TAMBAH service `keputusanCalon({emailCoo, id, keputusan, alasan}, db)`: satu `db.transaction` → `findActiveCooTenure(tx,...)` → baca calon (gerbang `profilLengkap` dari `shared/domain/profil.ts`) → CAS → `writeAuditEntry(tx,...)`. Reuse pola `runRegistrationDailyJob` L89 (tx + CAS + audit in-tx).
- `server/domain/identity/index.ts` -- ekspor fungsi baru (AD-5).
- `server/api/pendaftar/index.get.ts` + `keputusan.post.ts` -- BARU; gate COO pola `server/api/audit/index.get.ts` L47–65 (401 `UNAUTHORIZED` / redirect unlinked / 403 `FORBIDDEN`); validasi zod body `{id: uuid, keputusan: 'terverifikasi'|'ditolak', alasan?}`.
- `server/utils/api-error.ts` -- tambah `conflict:409` + `notFound:404` ke `HTTP_STATUS`.
- `drizzle/schema.ts` + `drizzle/migrations/` -- CHECK `(status <> 'ditolak' OR (rejection_reason IS NOT NULL AND btrim(rejection_reason) <> ''))`; via `check()` drizzle + `drizzle-kit generate`; migrate lokal.
- `app/pages/pendaftar.vue` -- BARU pola `audit-trail.vue` L25–33 (gate COO → redirect role lain) + komponen Table; tombol Verifikasi aktif hanya bila `profilLengkap`; tolak via Dialog + textarea alasan (UX-DR20); Status Badge peta sama dengan `status-pendaftaran.vue`.
- `tests/support/helpers/test-ids.ts` -- grup baru `pendaftar` (halaman/tabel/baris/kosong/aksi-verifikasi/aksi-tolak/dialog-tolak/input-alasan).
- `server/domain/identity/verification.service.test.ts` -- BARU unit: CAS race (repo null → 409 mapping), gerbang kelengkapan, alasan wajib, audit in-tx.
- `tests/e2e/pendaftar.api.spec.ts` + `pendaftar.spec.ts` -- BARU (matriks I/O + UI COO; persona `mintSesiPemilik` coo/calon-*; pola cleanup fixture `cleanup.track`).
- `tests/e2e/landing.api.spec.ts` -- TAMBAH asersi: owner `terverifikasi` tanpa saham → `/personal` (men-pin AC landing; resolveRole L73 sudah benar).
- `app/pages/status-pendaftaran.vue` -- TANPA perubahan (alasan penolakan sudah tampil, testid `status-alasan-penolakan`).
- `shared/domain/audit.ts` -- TANPA perubahan (`pendaftaran-verifikasi` & `pendaftaran-penolakan` sudah terdaftar L16–28).
- `server/domain/audit/audit.repo.ts` + `audit.service.ts` + `index.ts` -- TAMBAH satu fungsi baca kecil di API publik modul audit (mis. `hitungEntryAksi(tx, {action, target})`: SELECT count untuk target `<tabel>:<id>`) — dipakai service identity menghitung `details.hitunganPenolakan` dalam transaksi yang sama (AD-5: baca lintas modul lewat `index.ts`, bukan tabel tetangga).

## Tasks & Acceptance

**Execution:**
- [x] `drizzle/schema.ts` + migrasi -- CHECK constraint `ditolak → rejection_reason`; `npm run db:migrate` lokal.
- [x] `server/utils/api-error.ts` -- 409/404.
- [x] `server/domain/identity/owner.repo.ts` -- 2 CAS + list calon untuk COO.
- [x] `server/domain/identity/registration.service.ts` + `index.ts` -- `keputusanCalon` (tx + audit) + ekspor.
- [x] `server/api/pendaftar/{index.get,keputusan.post}.ts` -- endpoint list + keputusan.
- [x] `tests/support/helpers/test-ids.ts` + `app/pages/pendaftar.vue` -- UI COO.
- [x] `verification.service.test.ts` + `pendaftar.api.spec.ts` + `pendaftar.spec.ts` + asersi `landing.api.spec.ts` -- test hijau penuh.

**Acceptance Criteria:**
- Given daftar berisi calon lengkap & belum lengkap, when COO membuka halaman, then keduanya tampil dan aksi verifikasi aktif hanya untuk yang lengkap (UJ-6).
- Given calon lengkap, when COO memverifikasi, then status berubah `diajukan→terverifikasi` via CAS satu transaksi + entry audit `pendaftaran-verifikasi`; login berikutnya calon mendarat di Halaman Personal.
- Given COO menolak, then alasan wajib (400 tanpa alasan), dan dengan alasan: status `ditolak` + alasan tersimpan + audit `pendaftaran-penolakan` + alasan tampil apa adanya ke pendaftar.
- Given cron kedaluwarsa memenangkan race, when keputusan dikirim, then 409 `STATUS_BERUBAH` tanpa audit baru.
- Given akses non-COO ke endpoint/halaman, then 401/403 envelope / redirect; CHECK constraint DB menolak `ditolak` tanpa alasan.

## Implementation Notes

- 2026-09-21 (green-phase, dispatch subagent + verifikasi mandiri orkestrator): 7/7 tugas selesai; verifikasi — vitest 111/111 (14 file, termasuk 7 unit baru `verification.service.test.ts`), lint bersih, typecheck exit 0, Playwright `pendaftar.api` + `pendaftar` + `landing.api` 56 lulus / 2 skip di chromium+firefox, migrasi 0001 ter-apply + smoke constraint 23514. Matriks I/O 7/7 baris tertutup test (6 otomatis + 1 backstop CHECK level DB terverifikasi manual).
- **Keterbatasan WebKit**: browser ter-unduh tetapi host kekurangan lib sistem `libavif16` (tanpa sudo) — suite Story 1.6 hijau di chromium+firefox; webkit wajib dijalankan di mesin ter-provision/CI (pola burn-in).
- **Tambahan di luar Code Map**: `tests/support/helpers/pendaftar-reset.ts` (dev-only, pola `audit-reset.ts`, advisory lock + hapus FK-safe HANYA baris sintetis `uji.snddash.e2e.%` berstatus `diajukan`) — prasyarat deterministik test empty-state P2; test itu skip-jujur bila DB dev masih memuat calon `diajukan` non-sintetis (kebijakan data — berjalan penuh di DB bersih/CI).
- **CHECK constraint level DB** diverifikasi manual (smoke INSERT `ditolak` tanpa alasan → 23514 pasca-migrate) — belum ada harness DB-integrasi otomatis di repo; preseden verifikasi manual: runbook grants/append-only spec-1-3.
- Audit anti-masking: asersi "tanpa mutasi" dan landing memakai server-truth (keanggotaan daftar, audit append-only, cookie sesi asli calon) — re-mint persona men-upsert status sehingga TIDAK sah sebagai asersi keadaan.
- 2026-09-22 (pasca-review step-04, 7 patch via subagent implementasi yang sama): (1) constraint CHECK kini dieksekusi test ber-DB (`cobaTulisDitolakTanpaAlasan` — SQL mentah expect 23514 untuk NULL & blank, pola admin-client pendaftar-reset.ts); (2) baca audit loop antar-halaman (`bacaAuditSemuaHalaman`, cap 50 halaman yang melempar) — anti-flake halaman-1; (3) `alasan` dibatasi `PANJANG_MAKS_ALASAN_PENOLAKAN = 500` (konstanta bernama di service, dipakai zod handler) + test overlong 400; (4) `z.enum(KEPUTUSAN_COO)` satu sumber enum; (5) tooltip sisaField memakai `LABEL_FIELD_PROFIL` (Indonesia); (6) guard `sedangKirim` di awal `kirimPenolakan` (anti double-click tutup dialog); (7) helper uji diekstrak ke `tests/support/helpers/pendaftar-uji.ts`. Verifikasi ulang: vitest 111/111, lint+typecheck bersih, Playwright 3 file 58 lulus + 2 skip (chromium+firefox; webkit tetap terblokir lib host — catatan di atas). 29 temuan review tertriage di Review Triage Log: 7 grup patch, 2 defer (envelope 500 lintas endpoint → ledger spec-1-4; drift 11/10 field di epic-context), sisanya false/rejected dengan bukti.
- 2026-09-22 (hardening pasca-review — spec-hardening-1-6-temuan-review.md): **ERRATA atribusi migrasi** — CHECK `owners_ditolak_wajib_rejection_reason` terkirim sebagai migrasi `0002_new_unicorn`, BUKAN 0001 seperti tertulis di catatan green-phase di atas; 0001 bentrok dengan pricing 2.1 sehingga seluruh migrasi di-generate ulang saat merge develop (205cdfc). **Re-verifikasi penuh pasca-hardening** (reorder CAS-first + sentinel rollback + superRefine + UI envelope per-kode + honest-skip helper): vitest 99/99 (termasuk pin where-clause CAS adv#7, asimetri tolak adv#9, TOCTOU sentinel adv#1), lint + typecheck bersih, Playwright `pendaftar.api` + `pendaftar` seluruh test lulus di chromium+firefox+webkit — webkit KINI tereksekusi di host ini (catatan libavif16 di atas usang untuk host ini); kegagalan sesaat yang tersisa adalah pola flake DB-dev/dev-server bersama yang dikenal (berpindah browser secara acak, lulus saat retry maupun isolasi — dianalisis via trace: kegagalan fetch load/hidrasi GET /api/pendaftar & baca audit lintas-halaman, bukan regresi perubahan). Menutup vgap#2/#3 hardening: gerbang kelengkapan kini dievaluasi atas baris PASCA-CAS dalam tx (rollback total via sentinel — CHECK constraint dan gerbang service tidak lagi bisa dilangkahi race TOCTOU), dan verifikasinya terdokumentasi di sini.

## Spec Change Log

- **2026-09-23 (renegotiasi owner pasca-merge #1 — konfirmasi sebelum verifikasi):** aksi Verifikasi di `/pendaftar` kini dua-langkah: klik tombol membuka dialog konfirmasi ("Saya sudah memeriksa data pendaftar ini dengan seksama dan ingin melakukan verifikasi…", nama + email calon tampil), POST keputusan hanya terkirim dari dialog. Alasan: mencegah verifikasi sekali-klik tanpa kesengajaan (konsekuensi status permanen bagi pendaftar). Kontrak API TIDAK berubah (matriks I/O tetap); test UI `pendaftar.spec.ts` diadaptasi (dialog + jalur Batal). Invarian matriks #8 dijaga: membuka dialog tidak pernah mengosongkan pesan sukses.
- **2026-09-23 (renegotiasi owner pasca-merge #2 — detail data pendaftar):** baris `/pendaftar` menambah tombol **Detail** → dialog read-only seluruh isian Lampiran A calon, dimuat on-demand via endpoint BARU `GET /api/pendaftar/:id` (gate COO; hanya baris `diajukan` → selain itu 404; id tak sah → 400). Bentuk field PERSIS wire `GET /api/profile` (bank enum/Lainnya+otherBankName). Alasan: COO harus bisa MEMERIKSA isi sebelum menyatakan "sudah memeriksa dengan seksama" (pasangan fitur #1).

## Review Triage Log

| Temuan | Verdict | Bukti |
|--------|---------|-------|
| blind: epic-1-context "11 field" tapi enumerasi 10 item, kode komentar "10 field" | low | Drift dokumen nyata (Gmail = kolom email login, tidak masuk form 10 field); fix = edit artefak agent-context (`epic-1-context.md`) → rute defer |
| blind: peta badge kedaluwarsa/keluar→muted tak ada di doc, PETA_BADGE mengimplementasikan | false | UX-DR4 (epics/index.md:76) hanya mem-pin tiga status pendaftaran; peta muted untuk status lain adalah konvensi implementasi pre-existing `status-pendaftaran.vue` (tidak dikubah diff ini) — tidak ada kontradiksi kontrak |
| blind: migrasi ADD CONSTRAINT tanpa guard data kotor → migrate bisa abort | false | Constraint sudah sukses ter-apply di satu-satunya DB dev yang hidup (subagent + orkestrator); seluruh penulis `ditolak` sejak 0000 mengisi alasan (login.post.ts:200-202); DB baru me-replay migrasi pada skema kosong — skenario abort tak reachable |
| blind: GET /api/pendaftar tanpa paginasi | low | Antrian calon `diajukan` pada skala org (belasan–puluhan owner) tak akan menumbuhkan tak-terbatas; bentuk wire `{data:[...]}` dipin matriks frozen — fix (paginasi) mengubah kontrak frozen → rejected |
| blind: tooltip `title` menampilkan kunci wire Inggris (sisaField) + hover-only | low | Nyata: `baris.sisaField.join(', ')` di title — label Indonesia tersedia di `LABEL_FIELD_PROFIL`; fix = pemetaan langsung → patch |
| blind: textarea native, bukan komponen shadcn Textarea | false | Tidak ada komponen `ui/textarea` di repo (inventaris: alert, badge, button, dialog, drawer, input-otp, select, sheet, sonner, switch, table, tooltip); menambah komponen baru = side-effect registry yang DITOLAK preseden Spec Change Log 1.5 |
| blind: enum keputusan terduplikasi 3× (KEPUTUSAN_COO, z.enum, union halaman) | low | Nyata; fix = `z.enum(KEPUTUSAN_COO)` di handler — koreksi langsung satu sumber → patch |
| blind: PETA_BADGE mostly dead (hanya diajukan pernah render) | false | Entry `diajukan` terpakai; entry lain paritas disengaja dengan `status-pendaftaran.vue` (komentar PERSIS) — tidak ada bad outcome |
| blind: unlinked → sendRedirect di POST, tak teruji, fetch ikut redirect | low | Pola identik endpoint sibling `audit/index.get.ts` (diterima review 1.3); halaman mengecek landing saat muat; skenario butuh baris owner terhapus di tengah sesi — jarang; fix melintang lintas endpoint → rejected |
| blind: alasan tanpa batas panjang (zod max absen; kolom text) | low | Nyata — payload tak terbatas tersimpan verbatim + masuk audit jsonb; fix = `max(2000)` konstanta bernama → patch (grup dengan edge #8) |
| blind: alert sukses + section gagal-muat tampil bersamaan bila muatUlang gagal pasca-keputusan | false | Kedua pesan sama-sama benar (keputusan TERSIMPAN; muat ulang GAGAL) + "Coba lagi" actionable — tidak ada pernyataan palsu yang ditampilkan |
| blind: matriks frozen tak punya baris kewenangan-berakhir (403) / alasan non-string | low | Perilaku terimplementasi + teruji (unit tenure-expired); fix = edit matriks frozen → rejected (fix mengubah spec build ini) |
| blind: helper uji terduplikasi verbatim di dua spec baru | low | Drift antar-suite nyata; fix = ekstraksi mekanis ke tests/support/helpers → patch |
| blind: klikDenganUlang menelan error → breakage lewat diam-diam | false | Setiap pemakaian diikuti asersi auto-retrying keras (toHaveCount/toBeVisible/pesan) — aksi yang tak pernah terjadi tetap menggagalkan test; helper hanya menoleransi detach elemen |
| blind: asersi audit baca halaman 1 saja → flake di DB append-only paralel | medium | Nyata: `bacaAudit` + baca audit inline UI hanya page-1 limit 20, suite fullyParallel 2 browser menambah entry — target bisa jatuh ke halaman berikut; fix = loop antar-halaman → patch |
| blind: "race" E2E sequential; AD-11 tanpa test konkurensi DB nyata | low | Kontrak observable (status sudah bukan diajukan → 409 + tepat 1 audit) sudah dipin; test konkurensi tx paralel butuh harness DB yang absen repo-wide → rejected (fix > koreksi langsung) |
| blind: SkemaStatusPendaftaran omit terverifikasi/keluar | false | Endpoint `/api/register/status` me-redirect non-calon sebelum body (CALON_OWNER_STATUSES = diajukan/ditolak/kedaluwarsa) — enum skema test tepat |
| blind: Code Map testid 8 vs implementasi 11 | low | Observasi benar; fix = edit Code Map spec build ini → rejected |
| blind: sedangKirim global, tanpa feedback per-baris | low | Jendela disable = durasi request (sub-detik); fix per-row state menambah kompleksitas > koreksi langsung → rejected |
| blind: file migrasi/journal tanpa newline akhir | false | Output generator drizzle-kit memang tanpa newline — 0000_plain_boomer.sql dan _journal.json LAMA juga begitu (konteks diff); konsisten format generator |
| edge: migrasi tanpa guard data kotor (NOT VALID/backfill) | false | Sama dengan blind #3 — sudah ter-apply bersih; skenario tak reachable |
| edge: TOCTOU kelengkapan (simpanProfil commit antara baca dan CAS) | false | Kelengkapan monoton naik untuk calon `diajukan`: PUT /api/profile menolak simpan yang membuat profil tak lengkap (PROFILE_INCOMPLETE, spec-1-5) — arah bahaya "verifikasi profil yang benar-benar belum lengkap" tak reachable; FOR('update') = kompleksitas untuk kasus mustahil |
| edge: verifikasiCalon meninggalkan rejection_reason basi | false | Tidak ada transisi aplikasi `ditolak → diajukan` hari ini (re-daftar hanya kedaluwarsa→diajukan; pendaftaran ulang email ditolak = idempotent tanpa mutasi); reaktivasi adalah transisi Story 1.8/1.9 yang wajib mereset alasan di alurnya |
| edge: keputusan.post.ts throw infra → 500 mentah tanpa envelope | medium | Nyata, tapi pola sibling repo sama (audit/register/profile tanpa catch-all); hardening envelope 500 lintas endpoint sudah entri deferred-work spec-1-4 — bukan masalah story ini → defer |
| edge: index.get.ts throw infra → 500 mentah tanpa envelope | medium | Sama dengan di atas (satu akar: konvensi repo tanpa catch-all) → defer |
| edge: COO tak diarahkan ke /login saat 401 di kirimKeputusan | false | Kontrak UX frozen: submit gagal non-validasi → toast + isian tetap; pola sibling 1.5; halaman mengecek ulang landing pada muat berikutnya |
| edge: double-click dalam tick sama → dialog tertutup + alasan terhapus saat POST pertama berjalan | low | Nyata (micro-race pra-patch DOM): jalur else `kirimPenolakan` menutup dialog saat guard sedangKirim return false; fix = satu baris guard → patch |
| edge: alasan tanpa max (duplikat temuan blind) | low | Sama akar dengan blind #10 → patch |
| vgap: CHECK constraint tidak pernah dieksekusi test (bisa absen dengan suite hijau) | medium | Pre-verified: unit mem-fake tx; E2E selalu terhenti di gerbang handler/service sebelum DB; constraint backstop bebas hilang tanpa satu pun test merah — disposisi patch: satu asersi ber-DB (SQL mentah expect 23514, pola klien admin pendaftar-reset.ts) |

## Design Notes

- Urutan dalam transaksi `keputusanCalon`: otoritas COO (tenure) → baca calon + gerbang kelengkapan → CAS → hitung penolakan (bila menolak) → audit. CAS gagal (null) = kalah race dengan cron/COO lain → 409, BUKAN error — ini kontrak "hanya satu penulis berhasil".
- Halaman & endpoint dinamai `/pendaftar` (konsisten `status-pendaftaran`, `antrian-beli`); daftar HANYA calon `diajukan` — riwayat keputusan sudah terlihat di Audit Trail (1.3).
- Verifikasi tidak mengubah `firstEffectiveAt` (itu milik efektivitas Pembelian Pertama, Epic 3).
- Open Question hitungan penolakan sudah selesai (keputusan owner 2026-09-21, opsi a — lihat blok frozen).

## Verification

**Commands:**
- `npm run db:migrate` -- expected: migrasi CHECK ter-apply di DB lokal.
- `npx vitest run server/domain/identity` -- expected: unit baru + suite lama hijau.
- `npx playwright test tests/e2e/pendaftar.api.spec.ts tests/e2e/pendaftar.spec.ts tests/e2e/landing.api.spec.ts` -- expected: hijau (dev server + `ENABLE_TEST_AUTH=1`).
- `npm run lint && npm run typecheck` -- expected: bersih.
