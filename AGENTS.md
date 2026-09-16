<!-- bmad:context -->
<!-- Verified 2026-09-16 against 2526c9c. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## snd-dash

Dashboard kepemilikan saham Sip & Dip (Phase 1). Substrat Nuxt 4 ter-scaffold (Story 1.1); stack: Nuxt 4 (Vue + TypeScript, SSR), Drizzle ORM, PostgreSQL 17 (Supabase), Vercel. Perencanaan final (PRD, UX, arsitektur) hidup di `_bmad-output/planning-artifacts/`.

## Policy

- Data owner nyata (nama, email, finansial, spreadsheet migrasi) tidak boleh masuk repo — tanpa pengecualian; uji memakai data sintetis, data nyata hanya via env/Supabase.
- `_bmad/` dan `_bmad-output/` beku — jangan diedit atau dihapus; keduanya modul terinstal dan artefak perencanaan final.
- Git flow — jangan commit langsung ke `main`/`develop`; kerja di `feature/*` (dari `develop`), `release/*`, `hotfix/*` sesuai git flow.
- Test Design (`bmad-testarch-test-design`) adalah gerbang wajib: jalankan setelah epics & stories dan sebelum Build — jangan mulai scaffold/implementasi tanpa dokumen test design di `_bmad-output/test-artifacts/`.

## Where things are

- Menulis/mengubah kode domain atau migrasi? Baca dulu `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md` — invariant AD-1..AD-12 mengikat; Stack dan Do/Don't ada di dalamnya.
- Kebutuhan produk (FR, Glossary): `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md`
- Kontrak UX: `_bmad-output/planning-artifacts/ux-designs/ux-snd-dash-2026-09-15/DESIGN.md` dan `EXPERIENCE.md`

## Running and verifying

- Scaffold Story 1.1 lulus smoke R-005 (NuxtAuth OAuth Google, PWA install+prompt, paritas komponen shadcn-vue, migrasi Drizzle); kirim email Resend nyata belum terverifikasi — wajib sebelum Story 1.5 (spec 1.1).

## Conventions that differ

- Clean Architecture sesuai pemetaan spine: dependensi selalu mengarah ke domain — `pages/` dan `server/api` tipis, logika di `server/domain` (`*.service.ts`), Drizzle hanya di `*.repo.ts`, `shared/domain` murni tanpa I/O; jangan menambah lapisan atau taksonomi folder di luar Structural Seed spine.
- Seminimal mungkin tipe `any` dan tipe primitif mentah — nilai yang melewati validasi dibungkus tipe baru (branded type) alih-alih tetap `string`/`number`; lihat pola pasangan parse/serialize `shared/domain` (AD-10).
- Nilai uang/ratio tidak pernah `number`/`parseFloat` — string desimal berskala tetap; aritmetika hanya di `shared/domain` (AD-10).
- Import lintas modul domain hanya lewat `index.ts` modul; jangan menulis tabel milik modul tetangga (AD-5).
- Aturan kalender-hari (expiry hari-7, "hari yang sama") dihitung zona Asia/Jakarta via helper `shared/domain` — jangan `new Date()` mentah (AD-9).
- Tanpa magic number: angka dalam logika = konstanta bernama — lintas-modul di `shared/domain/<topik>.ts`, milik modul di `server/domain/<modul>/` (ditegakkan `@typescript-eslint/no-magic-numbers`, pengecualian di `eslint.config.mjs`); ambang yang dapat berubah (mis. kap kelompok) = data konfigurasi, bukan konstanta kode (spine, Data & format).

<!-- /bmad:context -->
