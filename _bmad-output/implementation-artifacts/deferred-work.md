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
