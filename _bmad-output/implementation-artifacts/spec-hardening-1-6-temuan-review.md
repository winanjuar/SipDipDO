---
title: 'Hardening Alur Keputusan COO & Halaman Pendaftar (temuan review Story 1.6)'
type: 'refactor'
created: '2026-09-22'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5a202a0bb4cff058a882e332de61b98ce659d080'
context:
  - '_bmad-output/implementation-artifacts/spec-1-6-verifikasi-penolakan-pendaftar-oleh-coo.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Review pasca-merge Story 1.6 (3 lensa, 20 temuan — lihat Review Triage Log spec-1-6 dan laporan bmad-review 2026-09-22) menemukan: (1) race TOCTOU kelengkapan — PUT /api/profile kini mengizinkan simpan parsial, sehingga calon lengkap bisa mengosongkan field di antara baca dan CAS; gerbang `profilLengkap` berjalan SEBELUM CAS sehingga race cron mengembalikan 400 alih-alih 409 (adv#1+edge#1); (2) UI/error handling /pendaftar meratakan semua error jadi "coba lagi", alasan >500 tak terpantau UI (konstanta terjebak di server), tooltip hover-only tak terjangkau sentuh (adv#4,5,11 + edge#2,3); (3) test lemah: fake tx menelan `.where()` (predikat CAS AD-11 tak ter-assert), asimetri tolak-belum-lengkap tak di-pin, helper constraint tak ber-advisory-lock dan hard-throw di DB non-lokal, FIFO tanpa tie-breaker (adv#7,9,10,12 + edge#4); (4) wire meng-echo input bukan truth DB (adv#8); (5) `alasan` pada `terverifikasi` diterima lalu dibuang diam-diam (adv#6); (6) drift dokumen (adv/edge/vgap sisanya).

**Approach:** Reorder `keputusanCalon`: alasan → tenure → eksistensi (404) → CAS (nol baris = 409) → re-read joined penuh dalam tx → gerbang `profilLengkap` atas baris PASCA-CAS (gagal = throw sentinel → rollback total → 400 tanpa mutasi) → hitungan+audit → return `status` dari DB. Konstanta panjang alasan pindah ke `shared/domain`; UI /pendaftar dapat `maxlength`, branch error per kode envelope, teks sisaField terlihat, guard `muatUlang`; validasi `superRefine` tolak-alasan-saja. Test: capture where-clause, pin tolak-belum-lengkap + tie-breaker + advisory-lock + honest-skip. Artefak: restore klausa epic-context, errata rename route, entri ledger WebKit/CI.

## Boundaries & Constraints

**Always:**
- Kontrak frozen spec-1-6 tetap: 404 `TIDAK_DITEMUKAN` (id tak dikenal) vs 409 `STATUS_BERUBAH` (status sudah bukan `diajukan`) vs 400 `PROFILE_INCOMPLETE` (verifikasi calon belum lengkap) vs 400 `ALASAN_WAJIB` — hanya MEKANISME evaluasi yang berubah (CAS-first), kode respons dan urutan prioritas 409 > 400 tetap.
- Rollback total saat gerbang kelengkapan gagal pasca-CAS: TANPA mutasi status, TANPA audit (tx throw → rollback). Kelengkapan dievaluasi pada baris joined PASCA-update dalam tx yang sama (kolom profil ada di tabel anak — `.returning()` owners mentah tidak cukup; pakai `findOwnerById(tx, id)` setelah CAS).
- `PANJANG_MAKS_ALASAN_PENOLAKAN` tinggal DI `shared/domain/identity.ts` (gaya konstanta `MAKS_ITEM_NAV_MOBILE`), re-export dari barrel `server/domain/identity` agar importer eksisting tidak putus; UI + test e2e import dari `#shared/domain/identity`.
- Pesan error UI Indonesia, beda per kode envelope: 403 kewenangan (permanen, tanpa "coba lagi"), 404 → `muatUlang()`, 400 `PROFILE_INCOMPLETE` menyebut field kurang (dari `details.sisaField`), 400 `BAD_REQUEST` menyebut `details.masalah`, 409 → pesan eksisting + muatUlang, sisanya (network/5xx) → "coba lagi".
- Aksesibilitas: info `sisaField` baris belum-lengkap jadi TEKS TERLIHAT (bukan hover-only); `title` tooltip dihapus dari Badge dan tombol Verifikasi (produk touch-first).
- Honest-skip: helper DB uji non-lokal TIDAK me-throw — mengembalikan alasan skip; bermata advisory-lock `KUNCI_ADVISORY_RESET_PENDAFTAR` yang sama.

**Never:**
- TIDAK mengubah registry/kontrak hijau lain: skema DB (tanpa migrasi), endpoint shape 200, `z.enum(KEPUTUSAN_COO)`, aturan ALASAN_WAJIB tetap di handler+service (BUKAN dipindah ke zod — kode envelope `ALASAN_WAJIB` terpin matriks beku), perilaku cron `kedaluwarsakanCalon`.
- TIDAK mengubah frozen spec-1-6 — koreksi catatan lewat Implementation Notes/errata.
- Di luar lingkup: envelope 500 lintas endpoint (sudah ledger spec-1-4), paginasi, setup CI (entri ledger baru), MFA.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Race TOCTOU kelengkapan | Calon lengkap → PUT /api/profile mengosongkan field → POST verifikasi | CAS sukses (status masih `diajukan`) → re-read pasca-CAS `profilLengkap=false` → rollback total → 400 `PROFILE_INCOMPLETE` + `details.sisaField`, status tetap `diajukan`, TANPA audit | Baris tetap di daftar COO |
| Race status (urutan baru) | POST keputusan saat cron/COO lain sudah mengubah status | CAS 0 baris → 409 `STATUS_BERUBAH` — dievaluasi SEBELUM gerbang kelengkapan (bukan 400) | — |
| Verifikasi lengkap | POST terverifikasi, profil lengkap | 200; `status` respons dari DB (bukan echo input); audit `pendaftaran-verifikasi` | — |
| Tolak calon belum-lengkap | POST ditolak + alasan, profil KOSONG | 200 `ditolak` + audit `pendaftaran-penolakan` — asimetri gerbang (hanya verifikasi digerbangi) ter-pin test | — |
| Body dengan `alasan` pada `terverifikasi` | `{id, keputusan:'terverifikasi', alasan:'x'}` | 400 `BAD_REQUEST` (superRefine: alasan hanya valid untuk ditolak) — tanpa sampai service | — |
| Alasan > 500 via UI | COO paste >500 char | Textarea `:maxlength` membatasi input; 400 `BAD_REQUEST` bila lewat API menampilkan `details.masalah` | — |
| UI error 403/404 | Tenure COO habis / id terhapus | 403 → pesan kewenangan tanpa "coba lagi"; 404 → pesan + `muatUlang()` otomatis | — |
| Klik selama `muatUlang` berjalan | Keputusan kedua saat refresh pasca-sukses | Guard `sedangMuatUlang` menolak POST kedua — pesan sukses tidak tertimpa 409 | — |

</frozen-after-approval>

## Code Map

- `server/domain/identity/registration.service.ts` -- `keputusanCalon` L308-368: reorder menjadi (1) alasan gate L314, (2) tenure L319-322, (3) `findOwnerById` eksistensi → `tidak-ditemukan` L324-325 (baris dipakai untuk `details.email`), (4) CAS L335-338 → null = `status-berubah`, (5) KEPUTUSAN `terverifikasi`: `findOwnerById(tx, id)` KEDUA (row pasca-update, joined) → `profilLengkap` gagal → `throw SENTINEL_PROFIL` (catch di luar `db.transaction` → return `{akhir:'profil-belum-lengkap', sisaField}`), (6) hitungan+audit L340-364 (pakai email bacaan pertama), (7) return `{akhir:'sukses', id, email, status: calonSesudah.status}` (adv#8 — bukan `input.keputusan`). Update docblock L293-307. Hapus `PANJANG_MAKS_ALASAN_PENOLAKAN` L241 (pindah shared), KEEP `KEPUTUSAN_COO` L233.
- `shared/domain/identity.ts` -- tambah `PANJANG_MAKS_ALASAN_PENOLAKAN = 500` + docblock (gaya L114-118); komentar `PrincipalOwner.rejectionReason` L72 tetap.
- `server/domain/identity/index.ts` L55-56 -- re-export konstanta (nama sama, importer `keputusan.post.ts:8` dan `tests/e2e/pendaftar.api.spec.ts:35` tak perlu ubah path — ganti sumber e2e ke `#shared/domain/identity`).
- `server/api/pendaftar/keputusan.post.ts` -- `SkemaKeputusan` L28-32 tambah `.superRefine`: `keputusan === 'terverifikasi' && alasan !== undefined` → issue `path:['alasan']`. Handler branch ALASAN_WAJIB L67-73 TETAP.
- `server/domain/identity/owner.repo.ts` -- `listCalonVerifikasi` L321: `.orderBy(asc(owners.createdAt), asc(owners.id))` + komentar tie-breaker FIFO (adv#12). `verifikasiCalon`/`tolakCalon` L421-444 TIDAK berubah (returning {id,email} cukup — kelengkapan dinilai dari re-read service).
- `app/pages/pendaftar.vue` -- (a) import `PANJANG_MAKS_ALASAN_PENOLAKAN` dari `#shared/domain/identity` L2-3; (b) textarea L298-304 tambah `:maxlength`; (c) `pesan` type L76 + `kirimKeputusan` catch L101-108: branch envelope `data.code`/`status` — 409 (eksisting), 403 `FORBIDDEN`, 404 `TIDAK_DITEMUKAN` (+`muatUlang()`), 400 `PROFILE_INCOMPLETE` (sisaField via `LABEL_FIELD_PROFIL`), 400 `BAD_REQUEST` (`details.masalah`), 400 `ALASAN_WAJIB`, else "coba lagi"; (d) guard `sedangMuatUlang` ref baru: `muatUlang` L65-73 set/unset + `kirimKeputusan` L93 early-return saat refresh berjalan; (e) hint terlihat L246-253: teks kecil sisaField di bawah Badge (hapus `:title` Badge L250 dan tombol Verifikasi L265); (f) komentar stale L36 `status-pendaftaran.vue` → `registration-status.vue`.
- `server/domain/identity/verification.service.test.ts` -- fake tx L148-158: `where: (arg) => { klausaWhere.push(arg); return rantai }` + assert predikat CAS memuat `eq(owners.id)` & `eq(owners.status,'diajukan')` di test L260-271 (adv#7); sesuaikan antrean select untuk bacaan kedua pasca-CAS; test baru: tolak calon belum-lengkap → sukses + audit (asimetri); alasan pada terverifikasi → reject superRefine diuji di level API.
- `tests/e2e/pendaftar.api.spec.ts` -- test baru: tolak calon `diajukan` profil KOSONG (mint tanpa PUT profile, pola `seedCalonLengkap` L49-64 pendaftar-uji) → 200 + audit (adv#9); ganti import L35 → `#shared/domain/identity`; test superRefine: body `{terverifikasi, alasan}` → 400 `BAD_REQUEST`.
- `tests/e2e/pendaftar.spec.ts` -- UI: pesan 403/404/400 panjang (stub route pola test 409 L170); teks sisaField terlihat di baris belum-lengkap; header L6 rename → `registration-status.vue`.
- `tests/support/helpers/pendaftar-reset.ts` -- `cobaTulisDitolakTanpaAlasan` L134-163: bungkus dengan `pg_advisory_lock(KUNCI_ADVISORY_RESET_PENDAFTAR)` (pola `denganPendaftarKosong` L63-116) + randomisasi email `Date.now()-pid-random`; guard localhost L55-61 & L135-141 diganti helper `siaDbUjiLokal(): {ok:true}|{ok:false, alasan}` — pemanggil test memakai `test.skip` jujur, env `IZINKAN_DB_UJI_JAUH=1` menimpa (adv#10+edge#4).
- `_bmad-output/implementation-artifacts/epic-1-context.md` L29 -- pulihkan dua klausa asli (bd1cb9c L30): "seluruh owner dapat dipilih untuk input transaksi, termasuk yang belum pernah membeli" dan "reaktivasi penuh terjadi lewat transaksi efektif" ke bullet Manajemen Owner (edge#5).
- `_bmad-output/implementation-artifacts/spec-1-6-...md` -- Implementation Notes: errata atribusi migrasi (CHECK terkirim sebagai `0002_new_unicorn`, bukan 0001) + catatan re-verifikasi penuh pasca-hardening (vgap#2/#3).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- entri baru: setup CI Playwright 3-browser (WebKit belum pernah mengeksekusi suite 1.6; repo tanpa CI) — keputusan owner 2026-09-22 (vgap#1).
- JANGAN sentuh: `server/middleware/auth-guard.ts`, registry `PERMUKAAN_PERAN`, skema/migrasi, `kedaluwarsakanCalon`, alur handler 401/403, `z.enum(KEPUTUSAN_COO)`, test-ids kontrak ATDD.

## Tasks & Acceptance

**Execution:**
- [x] `shared/domain/identity.ts` + `server/domain/identity/{registration.service.ts,index.ts}` -- konstanta pindah + reorder CAS-first + sentinel rollback + status dari DB.
- [x] `server/api/pendaftar/keputusan.post.ts` + `server/domain/identity/owner.repo.ts` -- superRefine + tie-breaker.
- [x] `app/pages/pendaftar.vue` -- maxlength, branch error envelope, guard muatUlang, sisaField terlihat, komentar.
- [x] `server/domain/identity/verification.service.test.ts` + `tests/e2e/pendaftar.api.spec.ts` + `tests/e2e/pendaftar.spec.ts` + `tests/support/helpers/pendaftar-reset.ts` -- pin & helper.
- [x] Artefak: epic-context restore, errata spec-1-6, entri deferred-work.

**Acceptance Criteria:**
- Given calon `diajukan` berprofil lengkap, when field profil dikosongkan via PUT /api/profile lalu COO memverifikasi, then 400 `PROFILE_INCOMPLETE` + status TETAP `diajukan` + TANPA entry audit baru (rollback total).
- Given status calon sudah bukan `diajukan` dan profilnya kosong, when POST verifikasi, then 409 `STATUS_BERUBAH` (bukan 400) tanpa audit baru.
- Given POST `{keputusan:'terverifikasi', alasan:'...'}`, then 400 `BAD_REQUEST` dengan issue pada `alasan`.
- Given calon belum-lengkap, when POST ditolak + alasan, then 200 + audit `pendaftaran-penolakan` (pin asimetri).
- Given COO di UI menolak dengan >500 char, then textarea membatasi input dan bila 400 tetap terjadi pesan memuat `details.masalah`; error 403/404/400/409 tiap punya pesan spesifiknya.
- Given helper DB uji dijalankan pada host non-lokal, then test skip jujur dengan alasan (bukan throw); dua worker paralel tidak menghasilkan 23505 di `cobaTulisDitolakTanpaAlasan`.
- Given seluruh task selesai, when vitest server/domain + shared/domain, Playwright pendaftar.api+pendaftar, lint, typecheck, then hijau; catatan verifikasi ditulis ke spec-1-6 (menutup vgap#2).

## Implementation Notes

- 2026-09-22 (implementasi penuh, single-dispatch): seluruh task Execution selesai sesuai Code Map. Desain sentinel sesuai arahan: `SentinelProfilBelumLengkap` = objek unik khusus (bukan Error generik) yang di-THROW DI DALAM callback `db.transaction` pada gerbang kelengkapan atas baris PASCA-CAS (bacaan kedua `findOwnerById(tx, id)` — join 3 tabel) → rollback total; ditangkap DI LUAR transaksi → `{akhir:'profil-belum-lengkap', sisaField}`; error asing di-re-throw. Bacaan kedua dipakai juga sebagai sumber `status` respons untuk kedua cabang keputusan (adv#8 — wire dari DB, bukan echo input); email audit tetap dari bacaan pertama. `PANJANG_MAKS_ALASAN_PENOLAKAN` kini tinggal di `shared/domain/identity.ts`; barrel `server/domain/identity/index.ts` re-export nama sama dari `#shared/domain/identity` (importer handler tak berubah; e2e api spec ganti sumber ke `#shared`). Test unit: fake tx menyangga `.where()` UPDATE dan predikat CAS diurai via `Column`/`Param`/`SQL` drizzle-orm — pin `eq(owners.id)` & `eq(owners.status,'diajukan')` (adv#7); antrean select ditambah bacaan kedua pasca-CAS; pin asimetri tolak-belum-lengkap (adv#9) + TOCTOU sentinel. Helper `pendaftar-reset.ts`: guard diganti `siaDbUjiLokal()` (non-lokal → alasan skip, `IZINKAN_DB_UJI_JAUH=1` menimpa), `cobaTulisDitolakTanpaAlasan` digenggam `KUNCI_ADVISORY_RESET_PENDAFTAR` + email/kode `Date.now()-pid-random-acak` (adv#10+edge#4); pemanggil api-spec memakai `test.skip(true, alasan)` jujur. UI: branch error per kode (403 permanen tanpa "coba lagi", 404+muatUlang, PROFILE_INCOMPLETE berlabel Indonesia via `LABEL_FIELD_PROFIL`, BAD_REQUEST menyebut `details.masalah`, ALASAN_WAJIB, else "coba lagi"), guard `sedangMuatUlang`, teks sisaField terlihat (dua tooltip `title` dihapus), textarea `:maxlength`, komentar stale `status-pendaftaran.vue` → `registration-status.vue`.
- 2026-09-22 (lingkungan): DB dev lokal instance kini ternyata TANPA migrasi CHECK (drift lingkungan — bukan regresi); `npm run db:migrate` dijalankan, `0002_new_unicorn` ter-apply dan constraint `owners_ditolak_wajib_rejection_reason` terverifikasi ulang via pg_constraint + test 23514 hijau. WebKit KINI tereksekusi di host ini (catatan libavif16 spec-1-6 usang untuk host ini) — suite di atas lulus 3-browser; burn-in CI tetap di ledger (vgap#1).
- 2026-09-22 (step-03 matrix audit): dua pin integrasi ditambah setelah audit — (1) E2E TOCTOU interleave (seed lengkap → PUT profile mengosongkan field → POST verifikasi → 400 + baris MASIH `diajukan` + nol audit — bukti rollback nyata yang tak teramati fake tx); (2) stub UI maxlength (`toHaveAttribute('maxlength')`) + 400 BAD_REQUEST → alert `details.masalah` (baris matriks #6). Mitigasi hazard: persona COO stub memakai email unik (baris `uji.snddash.e2e.coo@gmail.com` bersama bisa di-yank cleanup worker lain di tengah test → 403 palsu).
- 2026-09-22 (step-04 review, 10 temuan → 5 patch, 4 rejected berbukti, 1 false): patch — koreksi teks evidence entri ledger CI (kontradiksi webkit), reuse `labelSisaField` di `teksProfilBelumLengkap`, honest-skip DATABASE_URL malformed, stub ALASAN_WAJIB (lengan per-kode terakhir), pin guard `sedangMuatUlang` (baris matriks #8 — POST kedua tak pernah terkirim + pesan sukses bertahan) + pin tie-breaker (dua GET, pasangan `diajukanPada` identik → id-ascending stabil). Rejected: enforcement `alasan`-pada-`terverifikasi` cukup di HTTP (caller tunggal, ter-pin), jendela TOCTOU sub-ms (penutupan penuh butuh FOR SHARE — revisi saat 1.8 bila perlu), test "status dari DB" observasional-ekuivalen (CAS selalu set status=input sebelum re-read), edit epic-context memang dimandatkan spec. Fix akar tambahan sah: `pesan.value = null` di awal `verifikasi()` dihapus (menimpa pesan sukses — melanggar matriks #8 sendiri).
- 2026-09-22 (verifikasi final orkestrator): vitest `server/domain/identity shared/domain` 99/99; Playwright `pendaftar.api` + `pendaftar` 79 lulus / 2 flaky (keluarga DB-dev lama: Tolak via Dialog + 409 stub — berpindah browser, lulus retry); lint exit 0; typecheck exit 0. Menutup 16 temuan hardening: adv#1,4,5,6,7,8,9,10,11,12 + edge#1,2,3,4,5 + vgap#1 (ledger CI),#2 (errata + re-verifikasi),#3 (rename).

## Spec Change Log

## Review Triage Log

| Temuan | Verdict | Route | Bukti |
|--------|---------|-------|-------|
| blind: kontradiksi internal — deferred-work (webkit "terblokir libavif16") vs errata spec-1-6 ("webkit KINI tereksekusi") dalam diff yang sama | low | patch | Nyata — teks entri ledger menyalin framing pra-penemuan; koreksi teks evidence (kebutuhan CI tetap: paritas 3-browser di host mana pun) |
| blind: service masih diam-diam mengabaikan `alasan` pada `terverifikasi` (superRefine hanya HTTP — mirror double-gate alasan-wajib absen) | low | rejected | Caller tunggal service adalah handler yang sudah menolak (ter-pin test API); non-HTTP caller tidak ada; menambah akhir-akhir baru = perluasan kontrak > koreksi langsung; tak reachable dalam pemakaian nyata |
| blind: branch UI `TEKS_ALASAN_WAJIB` tak terjangkau dari UI ini (tombol digerbangi `alasanSah`) dan satu-satunya kode envelope tanpa stub test | low | patch | Nyata — branch defensif paritas kontrak; lengkapi stub test agar matriks per-kode tak punya lengan mati |
| blind: duplikasi pemetaan label sisaField — `teksProfilBelumLengkap` re-implements `labelSisaField` di file yang sama | low | patch | Nyata (dua salinan kontrak label = risiko drift); fix reuse = koreksi langsung |
| blind: edit epic-1-context tak terlacak dalam fix ini; entri defer 11/10 tak tersentuh | false | — | Restore dimandatkan spec hardening sendiri (Approach + Code Map + task [x]) dan tercatat di Implementation Notes; drift 11/10 adalah isu BERBEDA yang memang masih defer (di luar lingkup — Never) |
| edge: jendela TOCTOU menyempit tapi belum tertutup — PUT profile bisa commit antara re-read pasca-CAS dan COMMIT (re-read tanpa lock) | low | rejected | Probabilitas jendela mikro-detik pada skala org belasan owner; sebelum fix jendelanya detik-menit, kini sub-ms; penutupan penuh butuh strategi lock (FOR SHARE) berisiko deadlock — kompleksitas > koreksi langsung; revisi bila Story 1.8 menyentuh alur ini |
| edge: `siaDbUjiLokal` me-throw TypeError saat DATABASE_URL malformed (bukan honest-skip) | low | patch | Nyata — `new URL()` di luar try; fix try/catch → `{ok:false, alasan}` = koreksi langsung selaras semangat honest-skip |
| vgap: guard `sedangMuatUlang` tanpa test mana pun — hapus klausa → semua suite tetap hijau (pre-verified) | medium | patch | Pre-verified — baris matriks #8 sendiri belum tertutup (terlewat audit); fix = stub delayed GET + assert POST kedua tak pernah terkirim + pesan sukses bertahan |
| vgap: tie-breaker `asc(owners.id)` tak di-pin test — test ordering eksisting pakai tanggal beda (pre-verified) | medium | patch | Pre-verified — fix = perluas test ordering dengan pasangan `diajukanPada` identik + dua GET → urutan stabil id-ascending |
| vgap: test "status respons dari baris PASCA-CAS" tak bisa membedakan echo vs DB (seed post-CAS = input) | false | — | Observasional ekuivalen di produksi: CAS selalu men-set status=input sebelum re-read — tidak ada bad outcome yang mungkin; vgap sendiri menyimpulkan bukan gap |

## Verification

**Commands:**
- `npx vitest run server/domain/identity shared/domain` -- expected: unit hijau termasuk pin where-clause CAS, asimetri tolak, sentinel rollback.
- `npx playwright test tests/e2e/pendaftar.api.spec.ts tests/e2e/pendaftar.spec.ts` -- expected: hijau (dev server + `ENABLE_TEST_AUTH=1`; flake DB-dev lama dinilai dari pola retry, bukan kegagalan keras).
- `npm run lint && npm run typecheck` -- expected: bersih.

**Hasil (2026-09-22):**
- `npx vitest run server/domain/identity shared/domain` → 99/99 lulus (10 file) — termasuk 2 test baru pin predikat CAS, TOCTOU sentinel rollback (tanpa audit), asimetri tolak-belum-lengkap.
- `ENABLE_TEST_AUTH=1 npx playwright test tests/e2e/pendaftar.api.spec.ts tests/e2e/pendaftar.spec.ts` → seluruh test lulus di chromium+firefox+webkit dalam tiga run gabungan (run terakhir: 68 passed + 1 failed + 6 flaky); satu-satunya kegagalan keras per run BERPINDAH browser secara acak (chromium tolak-alasan → webkit verifikasi-lengkap → chromium tolak-alasan) dan selalu LULUS saat retry maupun isolasi (<1s) — analisis trace: kegagalan fetch load/hidrasi GET /api/pendaftar di dev server + baca audit lintas-halaman di DB dev bersama = pola flake dikenal, BUKAN regresi perubahan; test baru superRefine/403/404/400-stub lulus konsisten setelah dua koreksi test (asersi case-sensitive 'alasan'; tanpa perubahan produk).
- `npm run lint` → bersih; `npm run typecheck` → exit 0.
