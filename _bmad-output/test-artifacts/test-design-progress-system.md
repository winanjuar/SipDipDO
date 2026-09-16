---
runScope: 'system-level'
runKey: 'system'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-16'
---

# Test Design — Progress Checkpoint (system-level) — COMPLETED

## Step 1: Detect Mode — DONE
- System-Level; run_key=system; semua prasyarat (PRD, spine AD-1..AD-12, UX, epics) tersedia; tanpa checkpoint lama.

## Step 2: Load Context — DONE
- Flags: playwright_utils=true (profil API-only), pactjs_utils=true tapi tidak relevan (single deployable), pact_mcp=none, browser_automation=auto (eksplorasi di-skip — greenfield), risk_threshold=p1.
- Input: PRD, ARCHITECTURE-SPINE, epics index; fragmen: risk-governance, probability-impact, test-levels, test-priorities, test-quality, nfr-criteria, adr-quality-readiness-checklist, playwright-utils-mandate, overview, api-request, auth-session, recurse.

## Step 3: Testability & Risk — DONE
- 7 kekhawatiran actionable (waktu terinjeksi, seeding, auth-test, email observable, kontradiksi lingkungan migrasi, observability, harness konkurensi); 8 ASR (5 ACTIONABLE, 3 FYI); 8 kekuatan.
- 16 risiko: R-001 migrasi paritas (9, BLOCKER); R-002..R-010 (6); R-011..R-013 (4); R-014..R-016 (≤3).
- NFR: presisi/SM-1..4/security/a11y berthreshold; performance & coverage = UNKNOWN → klarifikasi (R-011).

## Step 4: Coverage Plan — DONE
- 53 skenario: P0 17, P1 21, P2 12, P3 3; format `{epic}-{LEVEL}-{seq}` + SYS-*; anti-duplikasi piramida.
- Eksekusi PR (<15 m) / Nightly (konkurensi+cron) / Weekly (perf+a11y+eksplorasi).
- Estimasi ~80–130 jam (2,5–4 minggu ekuivalen, tersebar per epik).

## Step 5: Generate Output — DONE
- Output (mode sequential — dipilih agar konsisten satu register risiko; subagent tersedia tapi akan menduplikasi muatan konteks):
  1. `_bmad-output/test-artifacts/test-design-architecture.md`
  2. `_bmad-output/test-artifacts/test-design-qa.md`
  3. `_bmad-output/test-artifacts/test-design/snd-dash-handoff.md`
- Validasi checklist: prasyarat ✓; risiko unik+terskor ✓; NFR UNKNOWN tidak ditebak ✓; coverage tanpa duplikasi ✓; contoh kode mengikuti playwright-utils mandate (test dari merged fixtures, expect dari @playwright/test, apiRequest, tanpa waitForTimeout/request.*) ✓; tanpa sesi browser tertinggal ✓; artefak di test-artifacts ✓; konsistensi lintas dokumen (ID risiko, tanggal, penulis) ✓.
- on_complete hook: kosong → dilewati.

## Open Items
1. ~~Lingkungan rehearsal migrasi~~ — ✅ DIPUTUSKAN 2026-09-16: dress rehearsal final di project produksi pre-go-live; loop iterasi di lokal Docker; prasyarat: prosedur reset idempoten.
2. ~~Jalur auth-test~~ — ✅ DIPUTUSKAN & DIKONFIRMASI USER 2026-09-16: Pola 1 session minting (endpoint dev-only mint sesi NuxtAuth asli utk owner sintetis + smoke Google asli di scaffold AR-3; triple-guard + assertion CI).
3. ~~Helper waktu~~ — ✅ DIPUTUSKAN 2026-09-16: helper `shared/domain` terima `now` terinjeksi; `new Date()` hanya di satu modul clock; enforcement ESLint + test boundary fixed-clock.
4. ~~Klarifikasi threshold~~ — ✅ DITETAPKAN 2026-09-16: API p95 < 500 ms / p99 < 1000 ms / error < 1%; SSR domain p95 < 1500 ms; coverage shared/domain ≥ 90% (gate PR), total ≥ 80% (gate rilis), duplikasi < 5%. Tersinkron di kedua dokumen test design.
5. ~~Approval register risiko~~ — ✅ DISETUJUI USER 2026-09-16: register 16 risiko + threshold (API p95<500ms/p99<1000ms/error<1%; SSR p95<1500ms; shared/domain ≥90%, total ≥80%, duplikasi <5%) disetujui. **Test design system-level FINAL.**

## Keputusan Lanjutan (2026-09-16) — jalur ke implementasi

- **Pilihan user: opsi B** — Story 1.1 (scaffold Nuxt 4 via jalur Build) DULU, lalu **Test Framework di context window baru** setelah aplikasi ada.
- Urutan TEA tersisa: **TF** (scaffold infra test — merged fixtures, factory, fixed-clock, harness konkurensi, endpoint auth-test Pola 1) → **CI** → per-story **ATDD** saat Build berjalan → **Automate/Trace** menjelang rilis.
- Sprint Planning (BMM) sengaja ditunda oleh user; ingat: `bmad-build` resmi memakainya sebagai gerbang.
- Pengingat git flow saat mulai scaffold: buat `develop` dari `main`, kerja di `feature/*` — jangan commit ke `main`.
- Catatan untuk sesi TF: setelah kode ada, profil loading Playwright Utils menjadi **full UI+API** (bukan lagi API-only seperti saat system-level design ini).
