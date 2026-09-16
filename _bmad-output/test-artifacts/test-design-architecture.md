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
  - _bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snd-dash-2026-09-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snd-dash-2026-09-15/EXPERIENCE.md
  - _bmad-output/planning-artifacts/epics/index.md (epic-1..6)
---

# Test Design untuk Arsitektur: Sip & Dip Ownership Dashboard (Phase 1)

**Purpose:** Kontrak antara QA (Test Architect) dan tim pengembang mengenai keprihatinan arsitektural, gap testability, dan kebutuhan NFR yang harus diselesaikan sebelum pengembangan test dimulai. Dokumen pendamping: `test-design-qa.md` (resep eksekusi test).

**Date:** 2026-09-16
**Author:** Murat — Master Test Architect (BMad TEA)
**Status:** Architecture Review Pending
**Project:** snd-dash
**PRD Reference:** `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md` (AD-1..AD-12)

---

## Executive Summary

**Scope:** Seluruh sistem Phase 1 — pembelian saham (pesanan mandiri, Antrian Beli, konfirmasi COO + MFA, input langsung), dashboard kepemilikan & chart, harga/MoM/RKAP, Contribution & distribusi laba, Bukti Transaksi & audit trail, pendaftaran & akses tiga tingkat, migrasi historis & go-live.

**Business Context (dari PRD):**

- **Impact:** Satu sumber kebenaran kepemilikan saham 22→~40 owner; **zero discrepancy (SM-1)** adalah janji produk utama — salah hitung Portion berpotensi memicu ketidakpercayaan antar owner.
- **Problem:** Pencatatan Google Sheets manual — setiap pembelian memaksa update banyak sheet + chart.
- **Go-Live:** Setelah migrasi paritas lulus (Epic 6); tidak ada tanggal kalender yang dikunci di PRD.

**Architecture (dari Spine AD-1..AD-12):**

- **AD-1/AD-2:** Ledger append-only satu-satunya penulis posisi; finalisasi atomik satu transaksi DB + compare-and-set + urutan lock global.
- **AD-6/AD-10:** Satu implementasi rumus domain murni di `shared/domain` (dipakai server & pulau klien); uang `numeric(18,2)`, kontrak kawat string desimal.
- **AD-8/AD-12:** Akses tiga tingkat dipaksa di batas server + MFA OTP terikat aksi; PWA installable dengan cache cangkang saja, data domain selalu daring.

**Expected Scale:** 22 owner eksisting → ~40; web responsif dua postur (mobile `<lg` owner, desktop `≥lg` COO); satu deployable Vercel + Supabase PG 17 (Singapore).

**Risk Summary:**

- **Total risiko:** 16
- **Tinggi (≥6):** 10 risiko — 1 blocker (skor 9), 9 mitigasi wajib
- **Upaya test:** ~53 skenario (~80–130 jam, tersebar mengikuti 6 epik — lihat `test-design-qa.md`)

---

## Quick Guide

### 🚨 BLOCKERS — Harus Diputuskan (Tidak Bisa Lanjut Tanpa Ini)

1. **Kontradiksi lingkungan migrasi — ✅ DIPUTUSKAN 2026-09-16:** dress rehearsal final dilakukan **langsung di project Supabase produksi sebelum go-live** (masih kosong, belum melayani pengguna); loop iterasi cepat di lokal Docker (Supabase CLI). Tanpa project/environment ekstra — wording "staging" pada Epic 6 dimaknai sebagai "target DB rehearsal pre-go-live" (epics beku; interpretasi direkam di sini). Prasyaratnya: **prosedur reset idempoten terdokumentasi** (drop data + re-migrasi + re-import dalam satu perintah) dan **window ketat antara rehearsal-sukses dan import final** (tidak ada operasi lain di produksi di antaranya). Tanpa ini, gerbang paritas R-001 (skor 9) tidak dapat dieksekusi. (owner: Dev/COO — keputusan final; eksekusi di Epic 6)
2. **Strategi auth-test untuk OAuth Google — ✅ DIPUTUSKAN & DIKONFIRMASI USER 2026-09-16 — Pola 1: session minting:** endpoint dev-only (mis. `/api/test/login`) **di dalam aplikasi sendiri** me-mint cookie sesi NuxtAuth yang sah untuk owner sintetis ter-seed, memakai `AUTH_SECRET` yang sama — bukan bypass. Playwright menyuntikkan cookie via playwright-utils `auth-session` (`setAuthProvider` + `createAuthFixtures` + `applyUserCookiesToBrowserContext`), multi-user per `userIdentifier` (`coo`, `owner-penuh`, `owner-tanpa-saham`, `calon-belum-lengkap`, `pendaftar`); sesi berbasis cookie → fixture juga mengekspos header `Cookie` untuk `apiRequest`. Handshake Google asli tetap ditutup smoke-test AR-3 di scaffold (akun sintetis, sekali jalan + tiap perubahan auth). Guardrail wajib: triple guard (`NODE_ENV !== 'production'` + env flag `ENABLE_TEST_AUTH` + header `TEST_AUTH_SECRET`) + assertion CI "endpoint 404 di konfigurasi produksi". *(Catatan: dipilih sebagai rekomendasi final; alternatif mock-OIDC ditolak karena provider Google hardcoded → config test ≠ produksi di AD-8; akun Google sintetis ditolak karena rapuh & berat ops. Dikonfirmasi user 2026-09-16.)*
3. **Helper waktu terinjeksi (`now` parameter) — ✅ DIPUTUSKAN 2026-09-16:** seluruh aturan kalender-hari Asia/Jakarta (expiry hari-7, pengingat H-3, tanggal efektif harga, cut-off, "hari yang sama" referral) lewat helper `shared/domain` yang menerima `now` sebagai parameter — `new Date()` dilarang di luar SATU modul clock `shared/domain`. Enforcement: ESLint (`no-restricted-syntax` untuk `new Date()` di luar modul clock) + unit test boundary fixed-clock (`3-UNIT-006`). (owner: Dev — saat scaffold `shared/domain`)

**Yang dibutuhkan dari tim:** Selesaikan 3 item ini pra-implementasi atau pengembangan test terblokir.

### ⚠️ HIGH PRIORITY — Tim Perlu Memvalidasi (Kami Beri Rekomendasi, Anda Menyetujui)

1. **Seeding & factory data test** — rekomendasi: factory Drizzle per modul + cleanup otomatis; endpoint seeding dev-only opsional. (fase implementasi, mulai Epic 1)
2. **Transport email mockable** — adapter Resend di balik interface agar local/test menulis outbox tanpa kirim nyata; OTP dibaca dari `otp_codes`/outbox di env test. (Epic 1, sebelum fitur MFA/Bukti)
3. **Smoke-test scaffold sebagai gerbang Story 1.1** — NuxtAuth di Nuxt 4 dan `@vite-pwa/nuxt` di Nuxt 4.5 tidak berjaminan vendor; jalankan spike 3 smoke-test AR-3 sebelum membangun di atasnya; fallback sudah terdefinisi di spine. (Epic 1 Story 1.1)
4. **Error tracking & visibilitas retry outbox sejak Epic 1** — spine menundanya ke scaffold; jangan sampai fitur transaksional (Epic 3) jalan tanpa alert kegagalan senyap. (Epic 1)
5. **Target coverage & threshold performa** — usulan: `shared/domain` ≥90%, keseluruhan ≥80%; p95 dashboard/API ditetapkan saat scaffold (kini UNKNOWN). (Epic 1 scaffold)

### 📋 INFO ONLY — Solusi Sudah Disediakan (Cukup Review)

1. **Strategi test:** piramida — Unit (`shared/domain`, matematika), API/INT (transaksi, konkurensi, otorisasi), E2E (perjalanan kritis + kontrak UX); ~53 skenario P0–P3.
2. **Tooling:** Vitest (unit) + Playwright + `@seontechnologies/playwright-utils` (API/E2E, `apiRequest`/`recurse`/fixtures), axe-core (a11y), k6/Lighthouse (baseline informasional).
3. **CI/CD bertingkat:** PR (semua fungsional <15 menit) / Nightly (konkurensi, burn-in, boundary cron) / Weekly (perf + a11y + eksplorasi).
4. **Coverage:** anti-duplikasi — matematika hanya di Unit; orkestrasi di API; perjalanan kritis di E2E.
5. **Quality gates:** P0 100%, P1 ≥95%, mitigasi risiko ≥6 selesai sebelum release terkait, dry-run migrasi lulus sebelum cutover.

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risiko teridentifikasi**: 16 (10 skor ≥6, 3 medium, 3 rendah)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---|---|---|---|---|---|---|---|---|
| **R-001** | **DATA** | Migrasi tidak paritas — Grand Total (3.622/5.187/14.980) atau Fulfillment Rate per jenis modal ≠ sumber Sheets → go-live saldo salah, SM-1 gagal | 3 | 3 | **9** | Dry-run rehearsal penuh + reconciliation harness (paritas Grand Total, Fulfillment Rate per jenis modal, poin per owner) sebagai gerbang cutover; sumber data via env, tanpa data nyata di repo | Dev+COO | Sebelum cutover produksi (Epic 6) |
| **R-002** | DATA | Race finalisasi menembus CAS/urutan lock (konfirmasi vs cron vs penarikan; dua owner rebutan ruang RKAP terakhir) → ledger ganda/over-alokasi | 2 | 3 | 6 | Enforce AD-2: CAS `status='menunggu_konfirmasi' AND withdrawn_at IS NULL`, urutan lock global, pending kanonik satu definisi; diverifikasi suite konkurensi | Dev | Sebelum Epic 3 selesai |
| **R-003** | SEC | Matriks keterbukaan bocor — owner tanpa saham/liar mengakses data antar-owner via API langsung | 2 | 3 | 6 | Enforcement di middleware + tiap route handler (AD-8), predikat kanonik IDENTITAS; authorization matrix test role×endpoint | Dev | Sebelum Epic 1 selesai |
| **R-004** | SEC | OTP MFA lemah — tidak single-use, tidak terikat {action_type, target_ref}, verify di luar tx, brute-force tanpa batas | 2 | 3 | 6 | Implementasi penuh AD-8: konsumsi in-tx via CAS, invalidate-on-resend, cooldown 60s, counter percobaan di tx terpisah yang selalu commit | Dev | Sebelum fitur konfirmasi (Epic 3) |
| **R-005** | TECH | Smoke-test scaffold gagal — NuxtAuth 1.3.1 di Nuxt 4 dan @vite-pwa/nuxt 1.1.1 di Nuxt 4.5 tanpa jaminan vendor | 3 | 2 | 6 | Spike Story 1.1: 3 smoke-test AR-3 (OAuth+session, PWA build+install+prompt, paritas shadcn-vue) sebelum membangun di atasnya; fallback spine (nuxt-auth-utils / vite-plugin-pwa / SW kustom) | Dev | Epic 1 Story 1.1 |
| **R-006** | DATA | PWA/cache menyajikan data domain usang (pelanggaran AD-12) → owner melihat angka lama, gerogoti kepercayaan | 2 | 3 | 6 | Cache hanya aset ter-fingerprint + `/offline`; dokumen SSR & `/api/**` `no-store`; kontrak kesegaran runtime (refetch-on-visibility / penanda "per …"); diverifikasi E2E header+SW | Dev | Sebelum Epic 4 selesai |
| **R-007** | BUS | Resolusi harga berjalan salah — dua baris `price_periods` per (jenis, tanggal efektif), atau snapshot Harga Terkunci berubah saat koreksi harga | 2 | 3 | 6 | Unique constraint (AD-7); koreksi = ubah baris + audit; snapshot pada `buy_orders`/`ledger_transactions` tak pernah dibaca ulang dari baris harga | Dev | Sebelum Epic 2 selesai |
| **R-008** | DATA | Off-by-one kalender-hari UTC vs Asia/Jakarta — pesanan/pendaftar kedaluwarsa di hari yang salah | 3 | 2 | 6 | Semua aturan hari via helper `shared/domain` zona Jakarta dengan `now` terinjeksi; unit test boundary (23.00/00.30 WIB, hari 6/7/8) fixed-clock | Dev | Saat scaffold (blocker #3) |
| **R-009** | OPS | Deliverabilitas email gagal senyap — OTP/Bukti tak terkirim (SPF/DKIM belum di-setup, retry outbox tak terlihat) | 2 | 3 | 6 | Outbox in-tx (AR-6); SPF/DKIM + From-domain saat scaffold; retry yang gagal terus → log + alert, bukan senyap | Dev | Epic 1 |
| **R-010** | TECH | `Number()`/`parseFloat` menangani uang/ratio di lapisan mana pun → error pembulatan halus ke hitungan kepemilikan | 2 | 3 | 6 | Kontrak kawat string desimal (AD-10); SATU pasangan parse/serialize di `shared/domain`; ESLint restriction + code review gate | Dev | Saat scaffold |

#### Medium-Priority Risks (Score 3–5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| R-011 | PERF | Dashboard/chart saat ~40 owner × 3 chart + tabel — baseline belum pernah diukur (threshold kini ditetapkan, lihat NFR) | 2 | 2 | 4 | Threshold ditetapkan 2026-09-16; ukur + rekam baseline k6/Lighthouse saat scaffold, tiap rilis cek regresi | Dev |
| R-012 | OPS | Cron Vercel tidak jalan / salah zona waktu → kedaluwarsa prematur atau mati | 2 | 2 | 4 | Test endpoint job fixed-clock; cek log cron pasca-deploy | Dev |
| R-013 | BUS | Paritas chart visual salah (donut dua cincin, agregat Big/Medium/Small Cap ambang konfigurabel) | 2 | 2 | 4 | Asersi data-level series + spot-check screenshot deterministik | Dev |

#### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---|---|---|---|---|---|---|
| R-014 | BUS | Konfirmasi COO > 5 menit (SM-4) karena plotting/MFA berbelit | 1 | 2 | 2 | Monitor — E2E timed + default FIFO terisi |
| R-015 | SEC | Spam pendaftaran publik (halaman terbuka tanpa referral) | 2 | 1 | 2 | Monitor — skala internal 22–40 owner |
| R-016 | DATA | Entry kompensasi (tanpa re-validasi gerbang) disalahgunakan membuka state invalid | 1 | 3 | 3 | Mitigasi struktural AD-1: MFA + pembayaran koreksi + audit referensi baris asal |

#### Risk Category Legend

- **TECH**: Teknis/arsitektur • **SEC**: Keamanan • **PERF**: Performa • **DATA**: Integritas data • **BUS**: Dampak bisnis • **OPS**: Operasional

---

### NFR Testability Requirements

**Purpose:** Apa yang harus disediakan arsitektur agar validasi NFR dapat diotomasi nanti. Rencana, bukan penilaian akhir.

| NFR Category | Threshold / Requirement | Current Design Support | Gap / Decision Needed | Planned Evidence |
|---|---|---|---|---|
| Presisi (NFR-1) | Half-up 2 desimal lintas fitur | ✅ Didukung AD-10 + contoh verifikasi PRD (AR-10) | — | Unit test `shared/domain`, lint |
| Konsistensi (SM-1) | Zero discrepancy 3 bulan pasca go-live | ✅ AD-1/2/4/6 saling mengunci | — | Paritas migrasi, reconciliation query, E2E finalisasi |
| Email (SM-3) | 100% transaksi → Bukti terkirim | ✅ Outbox in-tx (AR-6) | Transport mockable di test env | Test outbox + retry, integrasi transport mock |
| Operasional (SM-4) | Konfirmasi COO < 5 menit | ⚠️ Sebagian (default FIFO UX-DR20) | — | E2E timed + observasi manual |
| Security (AD-8) | Matriks 3 role + MFA + OTP bound | ✅ Enforcement batas server dirancang | Jalur auth-test (blocker #2) | Authorization matrix API, lifecycle OTP |
| Performance | **DITETAPKAN 2026-09-16:** `/api/**` p95 < 500 ms, p99 < 1000 ms, error rate < 1%; halaman SSR domain p95 < 1500 ms — diukur baseline k6 ringan ~10 VU (bukan load test penuh; skala 22–40 user) | ✅ Direncanakan | Ukur + rekam baseline saat scaffold; regresi antar rilis → tindak lanjut | k6 (API/SSR), Lighthouse, laporan baseline `SYS-PERF-001` |
| Maintainability | **DITETAPKAN 2026-09-16:** coverage `shared/domain` ≥ 90% (gate PR), keseluruhan ≥ 80% (gate rilis), duplikasi < 5% (jscpd) | ✅ Direncanakan | Konfigurasi coverage + duplication scan di CI saat scaffold | Coverage report CI, laporan jscpd |
| Aksesibilitas (UX-DR17) | WCAG 2.1 AA | ✅ Kontrak UX lengkap | — | axe-core otomatis + keyboard E2E |
| Tata kelola data | Tanpa data owner nyata di repo (policy) | ✅ Policy tertulis | Sumber migrasi via env saja | Factory sintetis/faker; audit konfigurasi test |

**Unknown thresholds:** tidak ada lagi — p95/p99 + error rate, target coverage, dan batas duplikasi **ditetapkan 2026-09-16** (usulan Murat, sepadan skala internal 22–40 user; dapat direvisi saat scaffold bila baseline awal menunjukkan perlu). Tooling evidence (k6, jscpd, coverage CI) disiapkan saat scaffold.

**Assessment boundary:** Status final PASS/CONCERNS/FAIL ada di `nfr-assess` setelah evidence implementasi ada.

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS — Harus Ditangani Arsitektur/Dev**

#### 1. Blockers to Fast Feedback (YANG DIBUTUHKAN DARI ARSITEKTUR)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
|---|---|---|---|---|
| **Lingkungan migrasi** (Epic 6 "staging" vs AD-9 `local`+`production`) | ~~Gerbang paritas R-001 (9) tak bisa dieksekusi~~ **DIPUTUSKAN 2026-09-16 — lihat Quick Guide #1** | Dress rehearsal final di project produksi pre-go-live + prosedur reset idempoten terdokumentasi | Dev+COO | Keputusan final; eksekusi Epic 6 |
| **OAuth Google tak ter-automasi** | Seluruh E2E terblokir | Jalur sesi test env-local (injeksi/mock provider), nonaktif di produksi | Dev | Epic 1, pra E2E |
| **Helper waktu tanpa `now` terinjeksi** | Uji boundary hari-7/H-3/efektif-harga flaky/mustahil | Helper kalender `shared/domain` menerima `now`; dilarang `new Date()` internal | Dev | Saat scaffold |
| **Tanpa seeding/factory** | Setup state kompleks (pending menumpuk, RKAP nyaris penuh) lambat & rapuh | Factory per modul + cleanup otomatis; opsional endpoint seeding dev-only | Dev | Mulai Epic 1 |
| **Email nyata di test** | Test bergantung layanan eksternal, nondeterministik, kirim email sungguhan | Adapter transport di balik interface; asersi via `outbox`/`otp_codes` di DB | Dev | Epic 1, pra MFA/Bukti |

#### 2. Architectural Improvements Needed (YANG HARUS DIUBAHI)

1. **Visibilitas kegagalan outbox sejak hari pertama**
   - **Current problem:** Error tracking & alerting ditunda "saat scaffold" tanpa epic eksplisit.
   - **Required change:** Jadikan bagian Epic 1 (log terstruktur + alert retry outbox + cron gagal) — prasyarat Epic 3.
   - **Impact if not fixed:** R-009: OTP/Bukti gagal senyap → transaksi efektif tanpa bukti (pelanggaran SM-3).
   - **Owner:** Dev • **Timeline:** Epic 1

2. **Harness konkurensi deterministik**
   - **Current problem:** Invariant AD-2 (CAS, urutan lock, first-confirm-wins) tidak terbuktikan tanpa eksekusi paralel yang bisa diulang.
   - **Required change:** Test API-level dengan request paralel + reset DB deterministik + data unik per worker.
   - **Impact if not fixed:** R-002 tak terverifikasi — risiko ledger ganda lolos ke produksi.
   - **Owner:** Dev • **Timeline:** Epic 3

---

### Testability Assessment Summary

**📊 CURRENT STATE — FYI**

#### What Works Well

- ✅ `shared/domain` murni tanpa I/O (AD-6) + contoh verifikasi bernilai di PRD (AR-10) — unit-testability kelas satu.
- ✅ Semua logika akses & transaksi di batas server (AD-8) — API-first testing tanpa UI untuk jalur kritis.
- ✅ Uang/ratio deterministik (AD-10): numeric DB, decimal library tunggal, kontrak string — tanpa nondeterminisme float.
- ✅ Audit in-tx append-only (AD-3) + outbox in-tx — hasil samping ter-verifikasi langsung di DB, email ter-dekopel.
- ✅ OTP single-live-row + cooldown server-side (AD-8) — permukaan MFA deterministik untuk test.
- ✅ Modular monolith + Supabase lokal via Docker (AD-9) — environment reproducible, tanpa kompleksitas distributed tracing.
- ✅ Batas cache PWA tegas (AD-12) — kontrak `no-store`/shell-only bisa diasersi otomatis.

#### Accepted Trade-offs (No Action Required)

- **Tanpa staging permanen** — wajar untuk solo dev; konsekuensinya blocker #1 (rehearsal migrasi) wajib diputuskan.
- **RLS PostgreSQL ditunda** — otorisasi cukup di lapisan aplikasi (AD-8) selama tak ada akses DB pihak ketiga; revisit bila berubah.
- **Threshold performa belum ada** — masuk akal untuk 22–40 user; tetapkan saat scaffold (R-011), jangan dibiarkan UNKNOWN melewati scaffold.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R-001: Migrasi Tidak Paritas (Score: 9) — BLOCKER

**Mitigation Strategy:**
1. Bangun reconciliation harness: query pembanding Grand Total (Quantity 3.622, Shares 5.187, Ceil 14.980), Fulfillment Rate per jenis modal, dan total poin Contribution per owner — sumber dibaca via env (policy tanpa data nyata di repo); raw dump sumber ke schema `source_import.*` agar pembandingan in-DB via SQL.
2. Loop iterasi di lokal Docker (Supabase CLI) sampai paritas lulus bersih.
3. **Dress rehearsal final di project Supabase produksi pre-go-live** (keputusan blocker #1, 2026-09-16): import + reconcile + reset idempoten bila gagal; gerbang cutover = laporan paritas final lulus, diikuti import final dalam window ketat tanpa operasi lain di antaranya. Import via pintu LEDGER lengkap tanpa re-validasi gerbang, tanpa outbox (AR-8).

**Owner:** Dev + COO • **Timeline:** Sebelum cutover produksi (Epic 6) • **Status:** Keputusan target final; implementasi Planned
**Verification:** `6-INT-001`, `6-INT-002` (lihat test-design-qa.md)

#### R-002: Race Finalisasi Menembus CAS/Lock (Score: 6)

**Mitigation Strategy:**
1. Enforce pending kanonik satu definisi (`status='menunggu_konfirmasi' AND withdrawn_at IS NULL`) di SEMUA guard.
2. Urutan lock global `buy_orders → rkap_phases → positions → owners → contribution_periods → distribution` di seluruh penulis.
3. Suite konkurensi: request paralel rebutan ruang RKAP terakhir & triple-writer pesanan; asersi tepat-satu-pemenang.

**Owner:** Dev • **Timeline:** Sebelum Epic 3 selesai • **Status:** Planned
**Verification:** `3-API-002`, `3-API-003`, `3-API-004`

#### R-003: Matriks Keterbukaan Bocor (Score: 6)

**Mitigation Strategy:**
1. Enforcement di middleware + tiap route handler; predikat `aksesPenuh`/`perluReferral`/`pilihanReferral` satu fungsi kanonik IDENTITAS (AD-11) — bukan dari `positions.shares` live.
2. Authorization matrix test: 3 role × seluruh endpoint, termasuk matriks §4.8 dan pembukaan otomatis pasca Pembelian Pertama.
3. E2E navigasi: item terkunci tidak tampil; URL langsung → redirect.

**Owner:** Dev • **Timeline:** Sebelum Epic 1 selesai • **Status:** Planned
**Verification:** `1-API-001`, `3-API-005`, `1-E2E-002`

#### R-004: OTP MFA Lemah (Score: 6)

**Mitigation Strategy:**
1. OTP single-use via CAS pada barisnya, terikat `{action_type, target_ref}`, konsumsi di DALAM tx finalisasi (AD-8).
2. `requestOtp` baru meng-invalideasi semua kode hidup; cooldown 60 detik server-side; counter percobaan di tx terpisah yang selalu commit.
3. Rollback re-validasi mengembalikan konsumsi (retry tanpa email baru) — diuji eksplisit.

**Owner:** Dev • **Timeline:** Sebelum fitur konfirmasi (Epic 3) • **Status:** Planned
**Verification:** `1-API-002`, `3-E2E-004`

#### R-005: Smoke-Test Scaffold Gagal (Score: 6)

**Mitigation Strategy:**
1. Story 1.1 = spike: jalankan 3 smoke-test AR-3 (NuxtAuth OAuth+session; PWA generateSW+install+prompt; paritas shadcn-vue Dialog/Sheet/Tooltip/Drawer/Input-OTP/Toast) sebelum membangun fitur.
2. Fallback spine siap: `nuxt-auth-utils`/OAuth manual (AD-8 tetap terpenuhi); `vite-plugin-pwa`/SW kustom direviu terhadap AD-12.

**Owner:** Dev • **Timeline:** Epic 1 Story 1.1 • **Status:** Planned
**Verification:** Laporan smoke-test Story 1.1 (kriteria go/no-go)

#### R-006: PWA Menyajikan Data Usang (Score: 6)

**Mitigation Strategy:**
1. Cache pembatasan: aset ter-fingerprint + manifest + ikon + `/offline` saja; `navigateFallback` hanya `/offline` (AD-12).
2. `Cache-Control: no-store` untuk dokumen SSR & `/api/**`; tanpa `swr`/`isr` rute domain; `registerType: 'prompt'` tanpa skipWaiting.
3. Kontrak kesegaran runtime: refetch penuh on visibility/focus atau penanda "per …" bersama payload.

**Owner:** Dev • **Timeline:** Sebelum Epic 4 selesai • **Status:** Planned
**Verification:** `SYS-E2E-001`, `4-API-001`

#### R-007: Resolusi Harga / Snapshot Salah (Score: 6)

**Mitigation Strategy:**
1. Unique constraint `price_periods` per (jenis harga, tanggal efektif); koreksi = ubah baris berjalan + audit (AD-7).
2. Harga Terkunci & harga final sebagai nilai tersimpan di `buy_orders`/`ledger_transactions` — koreksi harga tidak pernah mengubah nilai ter-final.
3. Unit test resolusi "harga berjalan pada tanggal X" tepat satu baris, termasuk tanggal batas efektif.

**Owner:** Dev • **Timeline:** Sebelum Epic 2 selesai • **Status:** Planned
**Verification:** `3-UNIT-004`, `2-API-001`

#### R-008: Off-by-One Kalender-Hari (Score: 6)

**Mitigation Strategy:**
1. Semua aturan hari lewat helper `shared/domain` zona Asia/Jakarta dengan `now` terinjeksi (blocker #3).
2. Unit test boundary fixed-clock: submit 23.00 vs 00.30 WIB, hari ke-6/7/8, pengingat H-3, "hari yang sama" referral.

**Owner:** Dev • **Timeline:** Saat scaffold • **Status:** Planned
**Verification:** `3-UNIT-006`, `3-API-006`

#### R-009: Email Gagal Senyap (Score: 6)

**Mitigation Strategy:**
1. Baris outbox ditulis dalam tx aksi (AR-6); pengiriman async + retry oleh PROOFS.
2. SPF/DKIM + From-domain Resend di-setup saat scaffold (OTP & Bukti = load-bearing).
3. Retry yang terus gagal → log terstruktur + alert; kegagalan kirim tidak pernah membatalkan transaksi.

**Owner:** Dev • **Timeline:** Epic 1 • **Status:** Planned
**Verification:** `3-API-009`, cek alert pasca-deploy

#### R-010: Float Menangani Uang (Score: 6)

**Mitigation Strategy:**
1. Kontrak kawat: uang/ratio lintas API/SSR sebagai string desimal berskala tetap; SATU pasangan parse/serialize di `shared/domain` (AD-10).
2. Decimal library tunggal dipin saat scaffold (AR-12); aritmetika uang hanya di `shared/domain`.
3. ESLint restriction (`no-restricted-properties` untuk `Number`/`parseFloat` pada nilai uang) + code review gate.

**Owner:** Dev • **Timeline:** Saat scaffold • **Status:** Planned
**Verification:** `3-UNIT-005`, lint CI

---

### Assumptions and Dependencies

#### Assumptions

1. Contoh verifikasi di PRD (2 Modal Bergerak → S4/C6/66,67%; ceil 861 saham; ratio 5/41/54; laba 12jt/2jt → 4.340.000) adalah oracle benar untuk unit test.
2. Angka paritas migrasi (3.622/5.187/14.980) yang tertulis di PRD/epics adalah angka resmi gerbang — detail data sumber tetap di luar repo (env/Supabase).
3. Zona Asia/Jakarta tidak memiliki DST — boundary test cukup skenario jam-tanggal biasa.
4. Skala 22–40 owner membuat load testing penuh tidak wajib; baseline informasional memadai.

#### Dependencies

1. ~~Keputusan blocker #1 (lingkungan rehearsal migrasi)~~ — ✅ selesai 2026-09-16: dress rehearsal final di project produksi pre-go-live; prasyarat eksekusi: prosedur reset idempoten (Epic 6).
2. Jalur auth-test env lokal (blocker #2) — required sebelum E2E pertama (Epic 1). **← sedang direview**
3. Pin versi library test (Vitest, Playwright, playwright-utils) — saat scaffold Epic 1 Story 1.1.

#### Risks to Plan

- **Risk:** Library chart (FR-18) dan decimal library belum dipin (AR-12, deferred ke scaffold).
  - **Impact:** Skenario chart (`4-E2E-002`) dan `3-UNIT-005` tak bisa dispesifikasikan sampai keputusan jatuh.
  - **Contingency:** Definisikan skenario pada level data/kontrak (bebas library); update saat scaffold.

---

**End of Architecture Document**

**Next Steps untuk Dev:**
1. Review Quick Guide (🚨/⚠️/📋) dan prioritaskan 3 blocker.
2. Tetapkan owner + timeline untuk risiko ≥6 (semua Dev — solo dev).
3. Validasi asumsi & dependensi di atas.

**Next Steps untuk QA/Test:**
1. Tunggu blocker pra-implementasi diselesaikan.
2. Lihat dokumen pendamping `test-design-qa.md` untuk resep skenario.
3. Siapkan infrastruktur test (factory, fixtures, environment) mulai Epic 1.
