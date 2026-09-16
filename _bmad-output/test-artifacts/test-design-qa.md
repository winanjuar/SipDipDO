---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-16'
workflowType: 'testarch-test-design'
runScope: 'system-level'
runKey: 'system'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics/index.md
---

# Test Design untuk QA: Sip & Dip Ownership Dashboard (Phase 1)

**Purpose:** Resep eksekusi test — apa yang diuji, bagaimana mengujinya, dan apa yang dibutuhkan QA dari tim lain.

**Date:** 2026-09-16
**Author:** Murat — Master Test Architect (BMad TEA)
**Status:** Draft
**Project:** snd-dash

**Related:** Lihat `test-design-architecture.md` untuk keprihatinan testability, blocker arsitektural, dan rencana mitigasi produksi.

---

## Executive Summary

**Scope:** Seluruh sistem Phase 1 (6 epik): fondasi akses & pendaftaran, harga/MoM/RKAP, pembelian saham end-to-end, dashboard & chart, contribution & distribusi laba, migrasi & go-live.

**Risk Summary:**

- Total Risks: 16 (10 high ≥6, 3 medium, 3 low)
- Kategori dominan: DATA (6), lalu SEC (3) — konsisten dengan janji produk "zero discrepancy" (SM-1)

**Coverage Summary:**

- P0 tests: 17 (jalur kritis, keamanan, integritas ledger, migrasi)
- P1 tests: 21 (alur utama, integrasi, boundary waktu)
- P2 tests: 12 (alur sekunder, regresi, kontrak UX)
- P3 tests: 3 (eksplorasi, baseline performa)
- **Total**: 53 skenario (~80–130 jam; tersebar mengikuti epik, ~2,5–4 minggu ekuivalen solo dev)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|---|---|---|
| FR-2 penjualan saham (Phase 2) | Di luar scope Phase 1 (PRD §6.2) | Spine menyiapkan ruang ledger; didesain ulang saat Phase 2 |
| Deliverabilitas SMTP penyedia (inbox placement Resend) | Di luar kontrol aplikasi | Assert baris outbox + retry; setup SPF/DKIM sebagai tugas scaffold (R-009) |
| Load/stress testing penuh | Skala 22–40 owner; threshold UNKNOWN | Baseline k6/Lighthouse informasional (P3, R-011) |
| Pengujian mekanisme voting MRO | Non-goal PRD §5 — voting tetap di ruang meeting | MoM + hasil keputusan diinput; diuji sebagai data |
| Manajemen investor | Non-goal PRD §5 | — |

---

## Dependencies & Test Blockers

**CRITICAL:** QA/test tidak bisa mulai tanpa item ini.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** Detail di `test-design-architecture.md` — Quick Guide 🚨

1. **~~Lingkungan rehearsal migrasi~~ ✅ DIPUTUSKAN 2026-09-16** — dress rehearsal final di project produksi pre-go-live + reset idempoten; eksekusi tetap prasyarat Epic 6.
   - Dry-run paritas R-001 (skor 9) memakai keputusan ini.
2. **~~Jalur auth-test~~ ✅ DIPUTUSKAN & DIKONFIRMASI 2026-09-16 — Pola 1 session minting** — endpoint dev-only mint sesi NuxtAuth asli untuk owner sintetis; implementasinya tetap prasyarat Epic 1 pra-E2E.
   - Seluruh E2E bergantung pada endpoint + fixtures `auth-session` ini.
3. **Helper waktu `shared/domain` dengan `now` terinjeksi** ✅ DIPUTUSKAN 2026-09-16 (konvensi + ESLint) — implementasinya prasyarat scaffold.
   - Semua uji boundary hari-7/H-3/efektif-harga bergantung padanya.
4. **Adapter email mockable + asersi via outbox/otp_codes** — Dev — Epic 1 pra-MFA/Bukti
5. **Smoke-test AR-3 lulus di Story 1.1** (NuxtAuth / PWA / shadcn-vue) — Dev — gerbang go/no-go scaffold

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** — factory per modul domain (owners, buy_orders, rkap, price_periods, contribution, ledger) dengan faker + override + auto-cleanup; dataset sintetis 22-owner untuk rehearsal migrasi.
2. **Test Environments** — local: Supabase CLI (Docker) per AD-9; CI: Postgres ephemeral + Nuxt dev server; tanpa staging permanen (keputusan blocker #1 untuk migrasi).
3. **Fixed-clock helper** — kontrol `now` untuk boundary kalender-hari (R-008).
4. **Concurrency harness** — request paralel + reset DB deterministik + data unik per worker (R-002).

**Contoh pola test (menuruti `playwright-utils` — `test_dir` & merged fixtures ditetapkan saat scaffold):**

```typescript
// {test_dir}/support/merged-fixtures.ts — SATU per proyek (di-scaffold oleh workflow framework)
// Contoh pemakaian di spec:
import { test, expect } from '../support/merged-fixtures';

test('@P0 @API matrix terkunci untuk owner tanpa saham', async ({ apiRequest, authToken }) => {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/dashboard/kepemilikan',
    headers: { Authorization: `Bearer ${authToken}` }, // sesi owner-tanpa-saham (test env)
  });

  expect(status).toBe(403);
  expect(body.code).toBe('AKSES_DITOLAK');
});
```

---

## Risk Assessment

**Note:** Detail lengkap di Architecture doc. Ringkasan relevan bagi perencanaan test.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---|---|---|---|---|
| R-001 | DATA | Migrasi tidak paritas (Grand Total / Fulfillment Rate) | **9** | `6-INT-001`, `6-INT-002` — reconciliation + dry-run rehearsal |
| R-002 | DATA | Race finalisasi menembus CAS/lock order | 6 | `3-API-002..004` — suite konkurensi paralel |
| R-003 | SEC | Matriks keterbukaan bocor via API | 6 | `1-API-001`, `3-API-005`, `1-E2E-002` — matrix role×endpoint |
| R-004 | SEC | OTP MFA lemah (single-use, binding, cooldown) | 6 | `1-API-002`, `3-E2E-004` — lifecycle OTP |
| R-005 | TECH | Smoke-test scaffold gagal (kompatibilitas Nuxt 4) | 6 | Laporan smoke Story 1.1 (kriteria go/no-go, bukan suite otomatis) |
| R-006 | DATA | PWA/cache menyajikan data usang | 6 | `SYS-E2E-001` — header no-store + perilaku SW |
| R-007 | BUS | Resolusi harga / snapshot Harga Terkunci salah | 6 | `3-UNIT-004`, `2-API-001` — unique constraint + snapshot |
| R-008 | DATA | Off-by-one kalender-hari UTC vs Jakarta | 6 | `3-UNIT-006`, `3-API-006` — boundary fixed-clock |
| R-009 | OPS | Email gagal senyap (OTP/Bukti) | 6 | `3-API-009` — outbox in-tx + retry terlihat |
| R-010 | TECH | Float menangani uang (pelanggaran AD-10) | 6 | `3-UNIT-005` + lint CI |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---|---|---|---|---|
| R-011 | PERF | Dashboard lambat; threshold UNKNOWN | 4 | `SYS-PERF-001` — baseline informasional |
| R-012 | OPS | Cron tidak jalan / salah zona waktu | 4 | `3-API-006` + cek log cron pasca-deploy |
| R-013 | BUS | Paritas chart visual salah | 4 | `4-E2E-002` — asersi data-level series |
| R-014 | BUS | Konfirmasi COO > 5 menit (SM-4) | 2 | `3-E2E-001` (timed) |
| R-015 | SEC | Spam pendaftaran publik | 2 | `SYS-EXP-002` |
| R-016 | DATA | Entry kompensasi disalahgunakan | 3 | Dicakup `1-API-002` (MFA) + audit; eksplorasi `SYS-EXP-001` |

---

## NFR Test Coverage Plan

**Purpose:** Memetakan NFR ke validasi yang direncanakan; menentukan evidence yang dibuat/dikumpulkan. Status final PASS/CONCERNS/FAIL ditetapkan `nfr-assess` nanti.

| NFR Category | Requirement / Threshold | Planned Validation | Tool / Level | Evidence Artifact | Priority |
|---|---|---|---|---|---|
| Presisi (NFR-1) | Half-up 2 desimal | Unit test contoh verifikasi PRD | Vitest / Unit | Laporan unit `shared/domain` | P0 |
| Konsistensi (SM-1) | Zero discrepancy | Paritas migrasi + reconciliation proyeksi vs rekomputasi ledger | Vitest/Playwright / INT | Laporan `6-INT-001`, `4-INT-001` | P0 |
| Email (SM-3) | 100% Bukti terkirim | Outbox in-tx + retry + transport mock | Playwright / API | Hasil `3-API-009` | P1 |
| Operasional (SM-4) | Konfirmasi < 5 menit | E2E timed alur konfirmasi | Playwright / E2E | Durasi `3-E2E-001` | P1 |
| Security (AD-8) | Matriks 3 role + MFA | Authorization matrix + lifecycle OTP | Playwright / API | Hasil `1-API-001`, `1-API-002` | P0 |
| Performance | `/api/**` p95 < 500 ms & p99 < 1000 ms, error < 1%; SSR domain p95 < 1500 ms (ditetapkan 2026-09-16) | Baseline k6 ringan (~10 VU) + Lighthouse | k6 + Lighthouse | Laporan baseline `SYS-PERF-001`; cek regresi tiap rilis | P3 (naik bila baseline langgar threshold) |
| Maintainability | `shared/domain` ≥ 90% (gate PR), keseluruhan ≥ 80% (gate rilis), duplikasi < 5% (ditetapkan 2026-09-16) | Coverage + duplication scan | CI (vitest coverage, jscpd) | Coverage report CI, laporan jscpd | P1 |
| Aksesibilitas (UX-DR17) | WCAG 2.1 AA | axe-core per halaman + keyboard COO | Playwright + axe / E2E | Hasil `SYS-E2E-002` | P1 |
| Tata kelola data | Tanpa data owner nyata di repo | Audit konfigurasi test (faker, env-only sumber migrasi) | Review + CI grep | Checklist review infra test | P1 |

**Missing thresholds or evidence sources:** tidak ada lagi — threshold performa, coverage, dan duplikasi ditetapkan 2026-09-16 (lihat NFR di atas); tooling evidence (k6, jscpd, coverage CI) disiapkan saat scaffold.

---

## Entry Criteria

**Testing tidak dimulai sebelum SEMUA terpenuhi:**

- [ ] Smoke-test AR-3 lulus (Story 1.1) — gerbang scaffold
- [ ] Keputusan blocker #1–#3 terekam (✅ 2026-09-16); artefak implementasinya (prosedur reset idempoten, endpoint auth-test Pola 1, modul clock + factory) tersedia sebelum suite terkait aktif
- [ ] Factory data + fixed-clock helper + concurrency harness siap
- [ ] Adapter email mockable; asersi via outbox/otp_codes di env test
- [ ] Environment lokal (Supabase Docker) + CI terprovision
- [ ] Fitur under-test terdeploy di environment test

## Exit Criteria

- [ ] Seluruh P0 lulus (pass rate 100%)
- [ ] P1 pass rate ≥ 95%, kegagalan ter-triage
- [ ] Tidak ada bug tingkat kritis/tinggi terbuka
- [ ] Mitigasi seluruh risiko skor ≥6 selesai atau di-waive resmi
- [ ] `6-INT-002` dry-run paritas lulus **sebelum** cutover produksi (gerbang R-001)
- [ ] Evidence NFR teridentifikasi per kategori (status final ditunda ke `nfr-assess`)

---

## Test Coverage Plan

**PENTING:** P0/P1/P2/P3 = **prioritas** (fokus bila waktu terbatas), BUKAN waktu eksekusi. Waktu eksekusi ada di "Execution Strategy".

### P0 (Critical)

**Criteria:** Melindungi jalur inti otorisasi/integritas ledger/perhitungan uang, tanpa workaround aman; kegagalan = blok rilis.

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| 3-UNIT-001 | Rumus pembobotan contoh PRD: 2 Modal Bergerak → Q2/S4/C6/Strength 66,67%; RTL = floor((Ceil−Shares)/2) | Unit | SM-1 | Oracle AR-10 |
| 3-UNIT-002 | Validasi Strength gabungan posisi + seluruh pesanan pending kanonik; dua pesanan masing-masing valid tapi gabungan >100% → ditolak | Unit | R-002 | Definisi pending AD-2 |
| 3-UNIT-003 | Quantity maks = ceil(sisa ruang ÷ harga); jatuh ke Quantity Left saat batas fase habis; contoh 861 saham (overshoot 28.000) & kulkas 68 saham | Unit | R-002 | Contoh verifikasi FR-1/FR-23 |
| 5-UNIT-001 | Distribusi laba 12jt/2jt → pool 500rb/4,1jt/5,4jt; owner 50%/40% → total hak 4.340.000; half-up 2 desimal | Unit | SM-1 | Contoh verifikasi FR-16 |
| 3-UNIT-004 | Resolusi "harga berjalan pada tanggal X" tepat satu baris; snapshot Harga Terkunci tak berubah saat koreksi harga | Unit | R-007 | AD-7 |
| 3-UNIT-005 | Pasangan parse/serialize string desimal tunggal; menolak input float; round-trip presisi | Unit | R-010 | AD-10 |
| 1-API-001 | Authorization matrix 3 role × seluruh endpoint (matriks §4.8; rekap terbuka saat punya poin belum ditunaikan) | API | R-003 | Penguatan batas server |
| 1-API-002 | Lifecycle OTP: single-use CAS, binding {action_type, target_ref}, konsumsi in-tx, invalidate-on-resend, cooldown 60s, counter tx terpisah, restore saat rollback | API | R-004, R-016 | AD-8 |
| 3-API-001 | Submit lolos → menunggu_konfirmasi; penolakan Strength saat submit = tanpa baris pesanan (audit saja) + pesan berisi hitungan | API | R-002 | FR-1/FR-19 |
| 3-API-002 | Finalisasi atomik satu tx: ledger + CAS status + pembayaran + plotting FIFO + penyesuaian instant + audit + outbox; kegagalan parsial → rollback penuh | API | R-002 | AD-2 |
| 3-API-003 | Konkurensi: dua owner merebut ruang RKAP terakhir → first-confirm-wins; yang kalah Ditolak + penjelasan; tanpa over-alokasi | API | R-002 | Request paralel |
| 3-API-004 | Konkurensi 3 penulis: konfirmasi vs cron kedaluwarsa vs penarikan pada pesanan sama → tepat satu menang (guard withdrawn_at) | API | R-002 | CAS assertion |
| 3-API-005 | Owner hanya lihat/tarik pesanan miliknya (IDOR); Antrian Beli penuh hanya COO | API | R-003 | FR-19 |
| 6-INT-001 | Reconciliation migrasi: Grand Total 3.622/5.187/14.980 + Fulfillment Rate per jenis modal + poin per owner vs sumber (via env); import via pintu LEDGER tanpa re-validasi & tanpa outbox | INT | R-001 | AR-8 |
| 6-INT-002 | Dry-run rehearsal penuh di environment migrasi → laporan paritas lulus sebagai gerbang cutover | INT | R-001 | Blocker #1 |
| 1-E2E-001 | UJ-6: pendaftaran mandiri → lengkapi Profile → verifikasi COO → halaman personal terbuka | E2E | R-003 | Butuh auth-test (#2) |
| 3-E2E-001 | UJ-1 happy path: pratinjau live → submit → Antrian → COO konfirmasi (MFA) → dashboard terupdate + bukti di outbox; durasi < 5 menit (SM-4) | E2E | R-002, R-014 | Timed |

**Total P0:** 17 skenario — proporsi tinggi disengaja: janji produk adalah kebenaran hitungan (SM-1), sehingga jalur uang/otoritas/ledger layak gerbang P0.

### P1 (High)

**Criteria:** Alur utama & integrasi penting, boundary berisiko tinggi, error path berdampak dengan recovery terbatas.

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| 3-UNIT-006 | Helper kalender-hari Jakarta: expiry hari-7 boundary (submit 23.00 vs 00.30 WIB; hari 6/7/8), pengingat H-3, "hari yang sama" referral — fixed clock | Unit | R-008 | Blocker #3 |
| 1-UNIT-001 | Predikat siklus hidup owner: aksesPenuh/perluReferral/pilihanReferral per enum status (incl. keluar belum-pernah-beli) | Unit | R-003 | AD-11 |
| 2-UNIT-001 | Derivasi RKAP: Fulfillment Rate, Shortfall, Utilization, Achievement (>100% sah), Held | Unit | — | FR-23 |
| 5-UNIT-002 | Semantik cut-off: snapshot poin sah beku imutabel; "final" ≠ "tertunaikan"; koreksi pasca-cut-off → periode berikut | Unit | R-001 | AD-10 |
| 3-API-006 | Cron kedaluwarsa: hanya kanonik-pending hari ke-7 (Jakarta) yang kedaluwarsa; owner bisa pesan ulang dengan harga berjalan baru | API | R-008, R-012 | Endpoint terproteksi CRON_SECRET |
| 3-API-007 | Re-validasi konfirmasi gagal (posisi/ruang/referral berubah) → Ditolak + hitungan; harga final tetap Harga Terkunci | API | R-007 | FR-20 |
| 3-API-008 | Input langsung COO: validasi sama, harga tanggal input, tanpa antrian, audit "input langsung", referral wajib pembelian pertama | API | R-004 | FR-21 |
| 3-API-009 | Outbox: baris ditulis in-tx; kegagalan kirim tak membatalkan transaksi; retry terlihat (log/alert) | API | R-009 | AR-6 |
| 3-API-010 | Regenerasi Bukti pada titik potong transaksi yang sama = nilai snapshot, bukan posisi mutakhir | API | — | Konvensi State |
| 1-API-003 | Pendaftaran: profil lengkap prasyarat verifikasi; kedaluwarsa 7 hari + pengingat; re-daftar CAS `kedaluwarsa→diajukan` baris sama (email unik) | API | R-008 | FR-22/AD-11 |
| 1-API-004 | Pembelian Pertama efektif → flip akses penuh otomatis; owner baru muncul di dashboard | API | R-003 | AD-11 |
| 5-API-001 | Cut-off API: freeze snapshot; penulis menolak menulis periode final; saldo carry-over tampil periode baru | API | R-001 | FR-10 |
| 5-API-002 | Rekap: snapshot imutabel; penandaan tertunaikan atomik dengan penyimpanan rekap; flip Keluar re-validasi shares=0 in-tx (urutan lock) | API | R-002 | FR-16/AD-11 |
| 1-API-005 | Pergantian COO: wajib MoM; tenure dicek in-tx; COO lama kehilangan akses transaksional; aktor audit = pejabat saat commit | API | R-004 | FR-17/AD-8 |
| 2-API-001 | price_periods: unique (jenis, tanggal efektif); koreksi = ubah baris + audit, bukan baris kedua | API | R-007 | AD-7 |
| 4-INT-001 | Rekomputasi penuh posisi dari ledger = proyeksi tersimpan (alat rekonsiliasi AD-4) | INT | R-001 | Pembanding audit |
| 4-API-001 | Dashboard payload: tabel + chart satu payload bersama; Portion 2 desimal; Grand Total seluruh owner aktif; owner baru otomatis | API | R-006 | FR-4/AD-12 |
| 1-E2E-002 | Navigasi per role: landing sesuai role; item terkunci tidak tampil; URL langsung → redirect + pesan | E2E | R-003 | UX-DR14 |
| SYS-E2E-001 | Kontrak PWA: install; dokumen & /api/** no-store; SW hanya aset ter-fingerprint + /offline; prompt pembaruan tak di atas dialog transaksional | E2E | R-006 | AD-12/AR-5 |
| 3-COMP-001 | Island pratinjau: live update mengikuti input; menyertakan pending; >100% → angka destructive + Submit terkunci | Component | R-002 | UX-DR10 — wiring, bukan matematika ulang |
| SYS-E2E-002 | Aksesibilitas: axe-core per halaman utama; alur COO keyboard-operable; aria-live status/pratinjau | E2E | — | UX-DR17 |

**Total P1:** 21 skenario

### P2 (Medium)

**Criteria:** Alur sekunder, edge case terbatas, kontrak UX penting namun ber-workaround, regresi.

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| 2-API-002 | Penyesuaian manual RKAP (naikkan Final / item baru) dalam batas agregat 1%+1 saham; melebihi → ditolak; tercatat audit | API | — | FR-23 |
| 2-API-003 | Utilization diinput COO; Achievement bisa >100%; Held = Fulfillment − Utilization konsisten | API | — | FR-23 |
| 1-API-006 | Audit append-only: UPDATE/DELETE ditolak (DB grants); hanya COO yang dapat membaca | API | — | FR-12/AD-3 |
| 1-INT-001 | Backup harian/PITR aktif + satu drill restore terdokumentasi sebelum go-live | Manual/OPS | — | AD-9/AR-11 |
| 3-E2E-002 | Penolakan terhitung di UI saat submit: Alert berisi alasan + rincian hitungan + langkah lanjut; Submit terkunci | E2E | — | UX-DR11 |
| 3-E2E-003 | Tarik pesanan saat Menunggu Konfirmasi → keluar antrian → jejak audit | E2E | R-002 | FR-19 |
| 3-E2E-004 | Dialog MFA: state salah (sisa percobaan), kedaluwarsa, cooldown kirim ulang, Esc membatalkan seluruh aksi | E2E | R-004 | UX-DR12 |
| 4-E2E-001 | Dashboard dua postur: tabel ↔ chart sinkron; ketuk wedge ↔ sorot baris; mobile scroll horizontal Owner sticky | E2E | — | UX-DR5/7 |
| 4-E2E-002 | Paritas chart data: pie label semua owner (25→40), donut dua cincin, Big/Medium/Small Cap ambang konfigurasi | E2E | R-013 | Asersi data-level |
| 2-E2E-001 | MoM: tulis draft→final + upload PDF → preview web sesuai keterbukaan (pemegang saham saja) | E2E | R-003 | FR-7/AR-13 |
| SYS-E2E-003 | Kesegaran runtime: refetch on visibility / penanda "per …" pada permukaan domain | E2E | R-006 | AD-12 |
| 5-E2E-001 | Alur COO cut-off → pratinjau rekap (poin sah vs carry-over) → rekap RUPS + pembanding antar-RUPS | E2E | — | UJ-4/UJ-5 |

**Total P2:** 12 skenario

### P3 (Low)

**Criteria:** Eksplorasi, benchmark informasional, validasi dokumentasi.

| Test ID | Requirement | Test Level | Notes |
|---|---|---|---|
| SYS-PERF-001 | Baseline k6/Lighthouse dashboard + API (informasional sampai threshold ditetapkan) | Performance | R-011 |
| SYS-EXP-001 | Sesi eksplorasi: keyboard-only + responsif dua postur + kasus entry kompensasi (R-016) | Exploratory | UX-DR17 |
| SYS-EXP-002 | Eksplorasi anti-spam pendaftaran publik | Exploratory | R-015 |

**Total P3:** 3 skenario

---

## Execution Strategy

**Philosophy:** Jalankan semua di PR bila totalnya < 15 menit; tunda ke Nightly/Weekly hanya yang mahal/berdurasi panjang.

### Every PR: Playwright + Vitest (~10–15 menit)

- Seluruh test fungsional (Unit, API, INT, Component, E2E) dari semua prioritas
- Playwright paralel lintas shard; data unik per worker; auto-cleanup

### Nightly: Suite Konkurensi & Burn-In (~30–45 menit)

- Suite konkurensi R-002 (`3-API-003/004`) dengan iterasi berulang (burn-in 10×) untuk menangkap race intermittent
- Boundary cron (`3-API-006`) dengan fixed-clock variasi tanggal

### Weekly: Baseline & Eksplorasi (~1–2 jam)

- `SYS-PERF-001` baseline k6/Lighthouse; `SYS-EXP-001/002` sesi eksplorasi
- `1-INT-001` verifikasi backup/restore drill (checklist OPS terjadwal)

**Manual (di luar otomasi):** review konfigurasi policy data (tanpa data nyata di repo); cek log/alert cron & outbox pasca-deploy produksi.

---

## QA Effort Estimate

**Upaya pengembangan test saja** (termasuk desain, implementasi, debugging, integrasi CI; di sini "QA" = dev dengan topi test, konteks solo dev):

| Priority | Count | Effort Range | Notes |
|---|---|---|---|
| P0 | 17 | ~35–50 jam | Harness konkurensi, authorization matrix, reconciliation migrasi |
| P1 | 21 | ~30–50 jam | Boundary waktu, outbox, siklus hidup owner, kontrak PWA |
| P2 | 12 | ~12–24 jam | Kontrak UX, state dialog, paritas chart |
| P3 | 3 | ~3–9 jam | Baseline + eksplorasi |
| **Total** | 53 | **~80–130 jam** | Tersebar mengikuti epik (bukan fase terpisah); ekuivalen ~2,5–4 minggu solo |

**Assumptions:**

- Infrastruktur test (factory, fixtures, harness) dibangun di awal Epic 1 dan dihitung dalam P0/P1
- Maintenance berjalan ~10% setelah suite matang
- Estimasi melebar karena greenfield: tiap skenario sekaligus memvalidasi infrastruktur testnya

---

## Implementation Planning Handoff

| Work Item | Owner | Target Milestone | Dependencies/Notes |
|---|---|---|---|
| Merged fixtures + factory + fixed-clock + concurrency harness | Dev | Epic 1 | Prasyarat seluruh suite |
| Jalur auth-test env lokal | Dev | Epic 1 (pra-E2E) | Blocker #2 |
| Reconciliation harness migrasi + dataset sintetis 22-owner | Dev | Epic 6 awal | Blocker #1; sumber via env |
| Keputusan threshold p95 + target coverage | Dev | Epic 1 scaffold | R-011; item klarifikasi NFR |
| Suite konkurensi R-002 | Dev | Epic 3 | Nightly burn-in |

---

## Tooling & Access

| Tool or Service | Purpose | Access Required | Status |
|---|---|---|---|
| Vitest | Unit `shared/domain` + domain service | — | Pending (scaffold) |
| Playwright + @seontechnologies/playwright-utils | API/INT/E2E | — | Pending (scaffold) |
| Supabase CLI (Docker) | DB lokal per AD-9 | Docker | Pending (scaffold) |
| axe-core | Scan aksesibilitas | — | Pending (Epic 1) |
| k6 + Lighthouse | Baseline performa | — | Pending (Epic 4) |
| Dataset migrasi sintetis + sumber paritas via env | `6-INT-001/002` | Env secret (COO) | Pending (Epic 6) |

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope | Validation Steps |
|---|---|---|---|
| `shared/domain` | Sumber semua rumus | Seluruh unit test contoh PRD (AR-10) wajib lulus di tiap PR | Vitest watch di CI |
| LEDGER + posisi (AD-1/4) | Satu-satunya penulis posisi | `4-INT-001` rekomputasi = proyeksi; `3-API-002` atomik | Nightly |
| PESANAN + cron | Siklus hidup pesanan | `3-API-004/006` CAS & kedaluwarsa | Nightly |
| PROOFS outbox | Email transaksional | `3-API-009/010` | PR |
| PWA/SW | Cache boundary | `SYS-E2E-001/003` | PR |
| Migrasi (Epic 6) | Paritas data | `6-INT-001/002` gerbang cutover | Sebelum go-live |

**Regression strategy:** Unit `shared/domain` + authorization matrix + konkurensi inti = wajib-hijau di tiap PR (mereka menjaga invariant AD); sisanya nightly. Setiap perubahan pada AD-1/2/6/8/10/12 mewajiban re-run penuh kelompok terkait.

---

## Appendix A: Code Examples & Tagging

```typescript
// {test_dir}/support/merged-fixtures.ts — SATU per proyek (di-scaffold oleh workflow framework):
// mergeTests(apiRequest, interceptNetworkCall, networkErrorMonitor, recurse, authFixture)
// + re-export expect dari '@playwright/test' + log.

// P0 — API test dengan tag prioritas
import { test, expect, log } from '../support/merged-fixtures';

test('@P0 @API finalisasi atomik — rollback penuh saat plotting gagal', async ({ apiRequest, authToken }) => {
  await log.step('Konfirmasi pesanan dengan plotting yang memicu kegagalan parsial');

  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/api/pesanan/{id}/konfirmasi',
    body: { tanggalPembayaran: '2026-09-16', metodeTransfer: 'transfer', plotting: 'FIFO' },
    headers: { Authorization: `Bearer ${authToken}` }, // sesi COO test-env
  });

  expect(status).toBe(409);
  expect(body.code).toBe('PLOTTING_GAGAL');
  // Asersi DB: tidak ada baris ledger baru, status pesanan tetap menunggu_konfirmasi
});

// P1 — rekursi untuk konsistensi eventual (outbox retry)
test('@P1 @API outbox terkirim setelah retry', async ({ apiRequest, recurse, authToken }) => {
  const orderId = '...'; // dari setup
  await recurse(
    () => apiRequest({ method: 'GET', path: `/api/test/outbox?order=${orderId}`, headers: { Authorization: `Bearer ${authToken}` } }),
    (res) => res.body.status === 'terkirim',
    { timeout: 30000, interval: 2000 },
  );
});
```

**Run specific tags:**

```bash
npx playwright test --grep @P0        # gerbang P0
npx playwright test --grep "@P0|@P1"  # inti
npx playwright test --grep @API @Security
```

**Playwright Utils deviations:** belum ada — `tea_use_pactjs_utils` aktif namun relevansi kontrak = tidak ada (single deployable), sehingga tidak ada contoh Pact; pola `page.route`/`waitForResponse`/`request.*`/`waitForTimeout` dilarang pada endpoint aplikasi sesuai mandate.

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` — metodologi skor risiko
- **Probability & Impact**: `probability-impact.md` — skala P×I dan klasifikasi aksi
- **Test Levels**: `test-levels-framework.md` — pemilihan Unit/INT/E2E
- **Test Priorities**: `test-priorities-matrix.md` — kriteria P0–P3
- **Test Quality**: `test-quality.md` — DoD test (tanpa hard wait, ≤1000 baris, <1,5 menit)
- **NFR Criteria**: `nfr-criteria.md` — kriteria validasi NFR
- **Playwright Utils Mandate**: `playwright-utils-mandate.md` — substitusi wajib saat flag aktif

---

**Generated by:** BMad TEA Agent (Murat)
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
