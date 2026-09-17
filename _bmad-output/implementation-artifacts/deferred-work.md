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
