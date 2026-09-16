---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-09-16'
projectName: 'snd-dash'
---

# TEA → BMAD Integration Handoff

## Purpose

Menjembatani output test design TEA dengan perencanaan implementasi BMAD. **Catatan konteks:** epics & stories snd-dash sudah ada (`_bmad-output/planning-artifacts/epics/`) — dokumen ini tidak lagi menggerakkan `create-epics-and-stories`, melainkan menjadi **input Sprint Planning dan referensi acceptance criteria per story** (story-level test requirements).

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
|---|---|---|
| Test Design (Architecture) | `_bmad-output/test-artifacts/test-design-architecture.md` | Gap testability pra-implementasi, blocker scaffold, kontrak NFR |
| Test Design (QA) | `_bmad-output/test-artifacts/test-design-qa.md` | Scenario P0–P3 per epik → acceptance criteria story |
| Risk Assessment | (embedded kedua dokumen) | Klasifikasi risiko epik, prioritas story |
| Coverage Strategy | (embedded test-design-qa.md) | Kebutuhan test per story |
| Progress checkpoint | `_bmad-output/test-artifacts/test-design-progress-system.md` | Resume run system-level |

## Epic-Level Integration Guidance

### Risk References

Risiko skor ≥6 yang menjadi **gerbang kualitas epik** (epik terkait tidak selesai sebelum mitigasi terverifikasi):

| Epik | Risiko yang mengikat |
|---|---|
| Epic 1 | R-003 (matriks akses), R-004 (OTP/MFA fondasi), R-005 (smoke scaffold — go/no-go Story 1.1), R-006 (PWA), R-008 (helper waktu — scaffold), R-009 (outbox/alert), R-010 (kontrak uang — scaffold) |
| Epic 2 | R-007 (price_periods unique + snapshot) |
| Epic 3 | R-002 (konkurensi finalisasi), R-004 (MFA konfirmasi), R-007 (re-validasi harga terkunci), R-014 (SM-4 monitor) |
| Epic 4 | R-006 (kesegaran data), R-011 (perf monitor), R-013 (paritas chart) |
| Epic 5 | R-001 prasyarat (freeze snapshot cut-off, AD-10), R-002 (flip Keluar in-tx) |
| Epic 6 | **R-001 (skor 9 — BLOCKER)**: dry-run paritas lulus sebelum cutover |

### Quality Gates

- Setiap epik: seluruh skenario P0 milik epiknya lulus 100% sebelum story di epik itu dinyatakan done.
- R-005: gerbang go/no-go Story 1.1 — smoke NuxtAuth + PWA + shadcn-vue lulus (atau fallback spine dipilih terdokumentasi) sebelum story lain.
- R-001: gerbang cutover Epic 6 — `6-INT-002` dry-run paritas lulus; produksi tidak diimpor sebelum itu.
- Risiko skor ≥6 tanpa mitigasi selesai → gate CONCERNS; skor 9 tanpa mitigasi → gate FAIL.

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

Skenario berikut WAJIB direfleksikan sebagai acceptance criteria story terkait (pemetaan per coverage map — lihat `test-design-qa.md` untuk tabel penuh):

- **Epic 1:** `1-API-001` (matrix akses), `1-API-002` (lifecycle OTP), `1-API-003/004` (pendaftaran + flip akses), `1-E2E-001` (UJ-6), `1-API-005` (pergantian COO), `1-API-006` (audit append-only), `SYS-E2E-001` (kontrak PWA), `3-UNIT-006` (helper waktu — scaffold), `3-UNIT-005` (parse/serialize — scaffold).
- **Epic 2:** `2-API-001` (unique price_periods), `2-UNIT-001` (derivasi RKAP), `2-API-002/003` (penyesuaian batas agregat, Utilization), `2-E2E-001` (MoM dua modus), `3-UNIT-004` (resolusi harga).
- **Epic 3:** `3-UNIT-001/002/003` (rumus + validasi Strength), `3-API-001..005` (submit, finalisasi atomik, konkurensi, IDOR), `3-API-006..010` (cron, re-validasi, input langsung, outbox, bukti), `3-E2E-001..004`, `3-COMP-001` (island pratinjau).
- **Epic 4:** `4-API-001` (satu payload), `4-INT-001` (rekomputasi = proyeksi), `4-E2E-001/002` (sinkron + paritas chart), `5-UNIT-001` dkk. bila rekap tampil di dashboard.
- **Epic 5:** `5-UNIT-001/002` (distribusi, cut-off freeze), `5-API-001/002` (cut-off, rekap + flip Keluar), `5-E2E-001` (UJ-4/UJ-5).
- **Epic 6:** `6-INT-001/002` (reconciliation + dry-run — gerbang cutover), `1-INT-001` (backup drill).

### Data-TestId Requirements

Rekomendasi atribut testability untuk komponen transaksional (UX-DR10–13): `data-testid` pada panel pratinjau (`pratinjau-hitungan`, `pratinjau-strength`, `submit-pesanan`), alert penolakan (`alert-penolakan-alasan`, `alert-penolakan-hitungan`), dialog MFA (`otp-input`, `otp-sisa-percobaan`, `otp-kirim-ulang`), baris antrian (`baris-pesanan-{id}`, `status-pesanan`), tabel kepemilikan (`sel-{owner}-{kolom}`, `baris-grand-total`), chart (`chart-pie`, `chart-donut`, `chart-bigcap`). Badge status memakai teks (UX-DR4) — asersi by role/text, bukan warna.

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
|---|---|---|---|---|
| R-001 | DATA | 9 | Epic 6 (seluruh story migrasi + cutover) | INT |
| R-002 | DATA | 6 | Epic 3 (finalisasi/konfirmasi/kron); Epic 5 (flip Keluar) | API (konkurensi) |
| R-003 | SEC | 6 | Epic 1 (identity/middleware); Epic 3 (visibilitas antrian); Epic 2 (preview MoM) | API + E2E |
| R-004 | SEC | 6 | Epic 1 (IDENTITAS otp_codes); Epic 3 (konfirmasi/input langsung) | API + E2E |
| R-005 | TECH | 6 | Epic 1 Story 1.1 (scaffold spike) | Smoke manual/otomatis |
| R-006 | DATA | 6 | Epic 1 (PWA config); Epic 4 (payload & kesegaran) | E2E |
| R-007 | BUS | 6 | Epic 2 (HARGA/price_periods); Epic 3 (Harga Terkunci) | Unit + API |
| R-008 | DATA | 6 | Epic 1 scaffold (`shared/domain` helper); Epic 1/3 (cron) | Unit + API |
| R-009 | OPS | 6 | Epic 1 (outbox + alert + SPF/DKIM); Epic 3 (Bukti) | API |
| R-010 | TECH | 6 | Epic 1 scaffold (decimal lib, lint, kontrak string) | Unit + lint CI |
| R-011 | PERF | 4 | Epic 4 (dashboard) | Perf baseline |
| R-012 | OPS | 4 | Epic 1/3 (cron endpoints) | API fixed-clock |
| R-013 | BUS | 4 | Epic 4 (chart) | E2E data-level |
| R-014 | BUS | 2 | Epic 3 (dialog konfirmasi) | E2E timed |
| R-015 | SEC | 2 | Epic 1 (halaman publik) | Exploratory |
| R-016 | DATA | 3 | Epic 3/6 (entry kompensasi — varian input langsung) | API + Exploratory |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design (TD)** — selesai; menghasilkan dokumen ini
2. **Sprint Planning (SP)** — konsumsi dokumen ini sebagai bagian validasi kesiapan implementasi
3. **TEA Framework (TF)** — scaffold infrastruktur test (merged fixtures, factory, harness) — jalankan sebelum/di awal Build
4. **TEA ATDD (AT)** — scaffolding acceptance test red-phase untuk skenario P0 per story (eksplisit, tidak auto-run)
5. **Build (BD)** — implementasi test-first per story
6. **TEA Automate (TA) → Trace (TR)** — peluasan coverage + matriks ketertelusuran + gate rilis

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
|---|---|---|
| Test Design | Sprint Planning / Build | Semua risiko P0 (skor ≥6) punya strategi mitigasi terdokumentasi ✓ |
| Scaffold | Story implementation | Smoke AR-3 lulus (R-005); keputusan blocker #1–#3 ✅ terekam (2026-09-16) |
| Story (ATDD) | Implementation | Acceptance test red-phase ada untuk skenario P0 story tsb |
| Implementation | Test Automation | Semua acceptance test story lulus; P0 epik 100% |
| Test Automation | Release | Trace matrix ≥80% coverage P0/P1; mitigasi ≥6 selesai; R-001 dry-run lulus sebelum cutover |
