- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-platform-nuxt-4.md`
  summary: Rumuskan ulang scope freeze AGENTS.md untuk `_bmad-output/` agar tidak kontradiktif dengan penulisan workflow (implementation-artifacts, memlog party-mode).
  evidence: AGENTS.md menyatakan `_bmad-output/` beku "jangan diedit atau dihapus", tetapi build workflow BMAD sendiri menulis spec/sprint-status/epic-context di `_bmad-output/implementation-artifacts/` dan tooling party-mode menulis memlog — perbaikannya mengedit file agent-context sehingga tidak boleh dipatch dalam story ini.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-platform-nuxt-4.md`
  summary: Dokumentasikan provenance/perintah regenerasi untuk artefak `exports/` (xlsx tanpa sumber regenerasi, lint-ignored) atau gitignore artefak ter-generate.
  evidence: `exports/snd-dash-epic-story-breakdown.xlsx` pre-existing tanpa perintah regenerasi terdokumentasi; duplikasi artefak perencanaan akan drift senyap — bukan buatan story ini (sudah ada sebelum baseline).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-platform-nuxt-4.md`
  summary: Tes otomatis route cron `POST /jobs/daily` (401 tanpa secret / fail-closed saat secret kosong / 200 dengan secret) di level story saat job nyata diimplementasikan.
  evidence: Verifikasi kini hanya manual-curl (orchestrator menjalankan ulang 401/401/200 pada 2026-09-16, lulus); test-design memetakan verifikasi endpoint cron ke R-012 API fixed-clock level Epic 1/3 — harness route test bukan scope scaffold.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-platform-nuxt-4.md`
  summary: CI minimal (lint + test + typecheck pada push/PR) untuk repo snd-dash.
  evidence: Ketiadaan CI pre-existing (greenfield tanpa kode sebelum story ini); scaffold kini punya perintah verifikasi `build/test/lint/typecheck` yang layak diotomasi — masuk perencanaan terpisah (bmad-testarch-ci).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-autentikasi-akun-google-halaman-login.md`
  summary: Wiring cleanup owner sintetis hasil seed `/api/test/login` (fixture-need #4 ATDD) — butuh API tulis identity Story 1.4.
  evidence: Tiap run suite menambah baris owner + tenure COO (email faker) di DB lokal dev-only; deferral sudah terdokumentasi di checklist ATDD dan TODO `landing.api.spec.ts`; pembersihan programatik menuntut API tulis identity yang menjadi scope Story 1.4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-autentikasi-akun-google-halaman-login.md`
  summary: Tegakkan invariant `ditolak` → `rejection_reason` wajib lewat CHECK constraint DB.
  evidence: Saat ini hanya endpoint seeding dev-only yang menulis `owners` dan ia selalu mengisi alasan untuk `ditolak`; constraint bermakna ketika alur tulis CAS lifecycle (Story 1.4/1.6) hidup — migrasi CHECK dikerjakan bersama alur tulis tersebut.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-autentikasi-akun-google-halaman-login.md`
  summary: Putuskan nasib perubahan `.bmad-loop/policy.toml` (max_tokens_per_story 2M→3M, rollback_on_failure false→true) — pisahkan commit sendiri atau revert.
  evidence: Perubahan dibuat harness bmad-loop di luar pekerjaan story; ikut ter-stage karena `git add -A` step-03. Keputusan milik user; jangan ikut commit story tanpa justifikasi.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md`
  summary: Otomasi penegakan append-only `audit_logs` di level env/CI — script `db:grants`, ALTER DEFAULT PRIVILEGES untuk tabel baru, penerapan role `app_runtime` pada `NUXT_DATABASE_URL` lokal, dan asersi permission-denied otomatis.
  evidence: Grants/role kini hanya diverifikasi manual via runbook psql (spec mem-prescribe manual; absennya harness DB-assert pre-date story ini); REVOKE tidak mengikat superuser sehingga env yang melewatkan runbook berjalan tanpa penegakan tanpa ada test yang merah. Penyelesaiannya = infra CI/harness DB (kandidat bmad-testarch-ci atau pekerjaan ops pra-produksi).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-audit-trail-pencatatan-tampilan-coo.md`
  summary: Test state "gagal muat → Coba lagi" halaman `/audit-trail` — butuh infra component-test (fetch terjadi SSR sehingga tak bisa dipaksa gagal dari e2e).
  evidence: Dicatat sadar di Design Notes spec saat step-03; dua review layer (verification-gap, blind-hunter) mengonfirmasi gap; component-test belum ada di repo — infrastruktur itu sendiri adalah prasyarat yang di luar scope story ini.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Keluarkan `.opencode/opencode.json` (config tooling lokal) dari commit story 1.4 atau gitignore-kan.
  evidence: File pre-existing sebelum story (bukan keluaran implementasi), tanpa newline akhir; blind-hunter menandainya scope creep di diff.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Hardening app-wide — envelope error seragam untuk kegagalan infrastruktur (500) di seluruh route handler.
  evidence: Handler baru mengikuti pola sibling (`status.get.ts`, `audit/index.get.ts`) tanpa catch-all; edge-case-hunter menandai 500 mentah bila service throw — perbaikannya lintas endpoint, bukan satu story.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Otomasi inisiasi OAuth CTA anonim di `/pendaftaran` (assert redirect ke Google) bila konvensi smoke manual berubah.
  evidence: Verification-gap pre-verified — jalur akuisisi utama tak terautomasi; konvensi repo saat ini mem-pin OAuth asli ke smoke manual AR-3 (`auth-landing.spec.ts:73-78`).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Keputusan test-design (owner, 2026-09-18): e2e WAJIB menjaga DB dev tetap bersih — data sintetis tidak boleh menumpuk pasca-run.
  evidence: Pasca-suite 1.4 menumpuk 136 owner `uji.snddash.e2e.*`/re-mint + 87 audit junk; `denganAuditKosong` (TRUNCATE audit) juga menghapus entry audit riil pendaftaran manual owner. Implementasi yang harus dievaluasi: (1) `cleanup.track` untuk tiap mint `mintSesiPemilik`/POST pendaftaran di spec 1.4; (2) script dev purge `uji.snddash.e2e.%` (audit→tenure→owner, FK-aware) sebagai jaring pengaman pasca-suite; (3) pertimbangkan ulang TRUNCATE `denganAuditKosong` vs isolasi per-test agar data riil dev tak ikut terhapus. Kontraindikasi yang harus dijaga: test idempotensi (`EMAIL_IDEMPOTEN_UJI`) sengaja bergantung baris persisten antar-run — rancang cleanup agar kontrak itu tetap sah (atau ubah asersi first-call ke [200,201] dan dokumentasikan).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Input desain Epic 3 (keputusan owner 2026-09-18): referral yang DIPAKAI pendaftar direkam via param link `?ref=<kode8>` — kolom `owners.used_referral_code` sudah tersedia (dormant, migrasi 0003).
  evidence: Mekanisme disepakati: link pendaftaran publik memuat ?ref opsional (bukan syarat akses, konsisten PRD FR-22/Glossary "referral diajukan saat Pembelian Pertama" — ?ref hanya PRE-rekam pilihan, validasi eligibility tetap di Epic 3); input form referral TETAP DILARANG (asumsi kontrak 1.4: body referral → 400). Yang harus dirancang Epic 3: parsing ?ref di halaman + POST, validasi kode ada & eligibility `pilihanReferral`, relasi ke keputusan MRO cross-referral.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-pendaftaran-owner-mandiri-status.md`
  summary: Penyesuaian lanjutan alert sukses (masuk/daftar) — tampilan/posisi/durasi masih perlu dipoles oleh owner.
  evidence: Owner 2026-09-18 — "secara fungsi sudah jalan, untuk alert masih harus disesuaikan lagi nanti" (pola saat ini: Alert shadcn varian success di atas halaman, auto-hide 3 detik).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-verifikasi-penolakan-pendaftar-oleh-coo.md`
  summary: Endpoint baru `/api/pendaftar` (GET + POST keputusan) mengikuti konvensi sibling tanpa catch-all — throw infrastruktur menghasilkan 500 mentah, bukan envelope seragam.
  evidence: Review 1.6 (edge-case-hunter, verdict medium): pola identik audit/register/profile (tanpa catch-all); hardening envelope 500 lintas endpoint sudah entri deferred-work spec-1-4 — entri ini mencakup dua endpoint baru 1.6 ke permukaan yang sama; perbaikannya lintas endpoint, bukan satu story.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-verifikasi-penolakan-pendaftar-oleh-coo.md`
  summary: Dokumen konteks `epic-1-context.md` menulis "Profile: 11 field" tetapi mengenumerasi 10 item (Gmail = email login, tidak masuk form 10 field) — drift label vs enumerasi.
  evidence: Review 1.6 (blind-hunter, verdict low): jumlah 11 berasal dari Lampiran A PRD (termasuk Gmail), form menyimpan 10 (spec-1-5); perbaikannya mengedit artefak agent-context hasil kompilasi (`epic-1-context.md`, header "Edit freely / Regenerate with compile-epic-context") — bukan kode story.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-mom-mro-rups-tulis-langsung.md`
  summary: API-level authorization tests untuk MoM routes (401/403 scenarios)
  evidence: Project-wide pattern — tidak ada API auth tests untuk fitur lain juga; perlu konsistensi approach sebelum menambah
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md`
  summary: Flake full-parallel E2E — writer audit lintas-worker (register/profil/personal seeding) menulis `audit_logs` tanpa `pg_advisory_lock`, mengganggu test stateful audit (audit.api/audit-trail) yang menggenggam lock `denganAuditKosong`.
  evidence: Direproduksi 2026-09-21 — full-parallel (workers default) = 4–7 gagal acak di audit.api/audit-trail (+1 kelengkapan/register sekali lewat); test yang sama hijau 38/38 saat `--workers=2` dan hijau terisolasi; sudah muncul di run pra-rename (17 gagal) sehingga bukan sebab perubahan Story 1.7. Fix kandidat: semua jalur uji yang menulis audit wajib genggam `KUNCI_ADVISORY_RESET_AUDIT`, atau seed audit per-worker, atau pin workers=2 lokal (CI sudah 2).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-role-matriks-keterbukaan-navigasi.md`
  summary: Flake test "alur Bank Lainnya" (kelengkapan-profil.spec) — fase simpan ganda (PUT parsial → PUT lengkap) sesekali tidak memicu PUT ke-2 / indikator tidak berubah, 50/50 pada kondisi identik.
  evidence: Direproduksi 2026-09-21 — 2 run identik: 1 passed lalu 1 failed (RecurseTimeout "Menunggu profil lengkap"); sudah gagal juga di run paralel pra-perubahan (ValidationError era). Race dobel-PUT sudah dikenal (komentar test, race 2026-09-19). Fix kandidat: klik simpan via recurse yang menunggu tombol disabled→enabled per fase, atau count PUT per-fase seperti pattern jumlahPut.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-integrasi-navigasi-mom.md`
  summary: Penanganan tanggal MoM belum lewat helper kalender `shared/domain` (AD-9) — form concat `+ 'T12:00:00+07:00'` dan ekstraksi `split('T')[0]` di mom pages.
  evidence: Pola pra-eksisting Story 2.1 (sudah diadjudikasi review 2.1 sebagai patch timezone); blind-hunter 2.1b menandai ulang. Rapikan bersama helper kalender bila kontrak AD-9 diperketat ke UI form.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-integrasi-navigasi-mom.md`
  summary: Polish UX halaman MoM — alert sukses finalize tidak auto-clear (beda dengan simpan), `confirm()` native untuk aksi destruktif (inkonsisten pola modal app, sulit di-test Playwright), retry link `<a href>` full reload (bukan NuxtLink), dan `?page=` di luar jangkauan menampilkan empty state menyesatkan tanpa jalan kembali.
  evidence: Semua pra-eksisting Story 2.1, tidak disebabkan perubahan 2.1b; blind-hunter 2.1b menandai. Satu paket polish MoM berikutnya.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-integrasi-navigasi-mom.md`
  summary: Flash-cookie transparensi di auth-guard diset tanpa `secure: true` (HTTPS-only di Vercel).
  evidence: Kode pra-eksisting Story 1.7, bukan sebab perubahan 2.1b; flag tanpa biaya — hardening sekali jalan bersama hardening cookie lain.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1b-integrasi-navigasi-mom.md`
  summary: `prasyaratPermukaan` baru mendukung SATU kunci prefix per awalan (first-match, bukan longest-prefix) — wajib ganti strategi longest-prefix sebelum menambah kunci prefix kedua (mis. `/mom/arsip/`).
  evidence: Komentar asumsi sudah ditambah di `shared/domain/identity.ts` + unit test pin perilaku saat ini; revisi strategi baru perlu bila registry menambah prefix bersarang.
