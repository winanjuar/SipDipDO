# Implementation Plan: Sip & Dip Ownership Dashboard (Phase 1)

## Overview

Implementasi mengikuti arsitektur satu aplikasi Nuxt 4 (app/ + server/ + shared/domain + drizzle/) dengan ledger append-only sebagai satu-satunya penulis posisi. Urutan tugas dimulai dari fondasi rumus murni `shared/domain` (dipakai bersama pratinjau klien & validasi server), lalu skema DB, lalu modul domain dari yang paling fundamental (identity, ledger, pricing, rkap) menuju yang bergantung padanya (orders, contribution, distribution, proofs, migration), diakhiri wiring UI, akses, cron, dan integrasi. Setiap langkah membangun di atas langkah sebelumnya dan berakhir dengan wiring agar tidak ada kode menggantung. Bahasa implementasi: **TypeScript**.

## Tasks

- [ ] 1. Scaffold aplikasi Nuxt 4 dan fondasi shared/domain
  - [-] 1.1 Inisialisasi proyek Nuxt 4 dan struktur direktori kanonik
    - Scaffold aplikasi Nuxt 4 (Vue 3 + Nitro) dengan folder `app/`, `server/`, `shared/domain/`, `drizzle/`
    - Buat sub-folder `server/domain/{identity,orders,ledger,rkap,pricing,contribution,distribution,proofs,audit,migration}`, `server/api/`, `server/jobs/`, `server/utils/`, `app/{pages,components,middleware,composables}/`
    - Pin dependensi utama (drizzle-orm, postgres.js, NuxtAuth, @vite-pwa/nuxt, @react-pdf/renderer, decimal library, fast-check, vitest)
    - Konfigurasi engines floor Node dan skrip `test`/`build` (gunakan `--run` untuk test sekali jalan)
    - _Requirements: 15.1_

  - [x] 1.2 Implementasi tipe berskala tetap dan pembungkus decimal
    - Buat `shared/domain/types.ts`: branded `Uuid`, `MoneyString`, `RatioString`, `JakartaDate`; union `CapitalType`, `OrderStatus`, `OwnerLifecycle`, `PriceKind`, `MfaActionType`; tabel `CAPITAL_RULES`
    - Buat `shared/domain/decimal.ts`: satu mekanisme decimal terpin dengan `toMoney`, `toRatio` (half-up 2 desimal saat display), tanpa `Number()`/`parseFloat()` pada nilai uang/rasio
    - _Requirements: 24.1, 24.2_

  - [ ]* 1.3 Tulis property test Money-never-float dan half-up
    - **Property 14: Money never float** — **Validates: Requirements 24.1**
    - **Property 10: Pembulatan half-up** — **Validates: Requirements 24.1, 24.2**

- [x] 2. Rumus domain murni pembobotan, RKAP, distribusi, dan kalender
  - [x] 2.1 Implementasi rumus pembobotan
    - Buat `shared/domain/weighting.ts`: `shares`, `ceilFor`, `strength`, `portion`, `rtl`
    - _Requirements: 1.13, 1.14, 4.1, 4.5_

  - [ ]* 2.2 Tulis property test identitas pembobotan dan RTL
    - **Property 4: Weighting identities** (kasus 2 Saham Modal Bergerak → Shares 4, Ceil 6, Strength 66,67%) — **Validates: Requirements 1.14**
    - **Property 5: RTL definisi** — **Validates: Requirements 4.5, 1.1**

  - [x] 2.3 Implementasi batas & max-quantity RKAP
    - Buat `shared/domain/rkap-limits.ts`: `maxQuantityRkap` (overshoot ≤ sisa batas → ceil; else Quantity Left floor), `batasPenyesuaianFase`, `ruangRkap`
    - _Requirements: 1.10, 1.11, 23.2, 23.6, 23.8_

  - [ ]* 2.4 Tulis property test max-quantity dan batas penyesuaian RKAP
    - **Property 6: RKAP max-quantity** (kasus 861 & 68 saham) — **Validates: Requirements 1.10, 23.8**
    - **Property 7: Batas penyesuaian agregat** — **Validates: Requirements 23.6**
    - **Property 8: Ruang RKAP hanya dari efektif** — **Validates: Requirements 23.2**

  - [x] 2.5 Implementasi rumus distribusi laba
    - Buat `shared/domain/distribution.ts`: `labaDibagikan`, `budgetPool`, `dividenOwner`, `insentifOwner`
    - _Requirements: 16.1, 16.2, 16.4, 16.5_

  - [ ]* 2.6 Tulis property test dan unit test distribusi laba
    - **Property 9: Distribusi laba** (kasus 12jt/2jt → total hak owner contoh 4.340.000) — **Validates: Requirements 16.10**
    - Unit test: pool 500.000/4.100.000/5.400.000; Laba Dibagikan 10.000.000
    - _Requirements: 16.1, 16.2, 16.10_

  - [x] 2.7 Implementasi kalender-hari Asia/Jakarta
    - Buat `shared/domain/calendar.ts`: `toJakartaDate`, `isExpiredDay7`, `sameJakartaDay`, konstanta `JAKARTA_TZ`
    - _Requirements: 19.4, 22.5, 22.6, 22.9_

  - [ ]* 2.8 Tulis property test kalender Asia/Jakarta
    - **Property 15: Kalender Asia/Jakarta** (invarian terhadap jam trigger UTC) — **Validates: Requirements 19.4, 22.9, 6.1**

- [x] 3. Perakitan input gerbang kanonik (shared/domain)
  - [x] 3.1 Implementasi evaluator gerbang Strength dan ruang RKAP
    - Buat `shared/domain/gates.ts`: `StrengthGateInput`, `evalStrengthGate` (posisi terkini + seluruh pending kanonik + calon ≤ 100%), helper ruang RKAP
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.13_

  - [ ]* 3.2 Tulis property test soundness gerbang Strength
    - **Property 3: Strength gate soundness** (dua pesanan valid yang gabungannya > 100% selalu ditolak) — **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 3.3 Tulis property test konservasi Portion
    - **Property 2: Portion konservasi** (Σ portion presisi penuh == 1; display apa adanya) — **Validates: Requirements 4.2, 24.2**

- [x] 4. Skema database dan koneksi Drizzle
  - [x] 4.1 Definisikan skema Drizzle seluruh tabel domain
    - Buat skema `drizzle/` untuk `owners`, `profiles`, `roles`, `coo_tenures`, `otp_codes`, `buy_orders`, `ledger_transactions`, `positions`, `rkap_phases`, `capital_items`, `price_periods`, `moms`, `contribution_items`, `contribution_entries`, `contribution_periods`, `profit_distributions`, `profit_distribution_lines`, `email_outbox`, `audit_logs`
    - Terapkan tipe kolom: uang `numeric(18,2)`, rasio `numeric(9,6)`, Quantity/Shares/Ceil integer; unik `owners.email` dan `price_periods (kind, effective_date)`
    - Buat migrasi awal
    - _Requirements: 12.3, 13.1, 6.1, 6.2, 8.1, 23.1_

  - [x] 4.2 Konfigurasi koneksi DB dan utilitas transaksi
    - Buat `server/utils/db.ts`: postgres.js + drizzle, helper `db.transaction` dengan handle `tx`
    - Tetapkan konvensi urutan lock global dan grant append-only untuk `audit_logs` (tanpa UPDATE/DELETE)
    - _Requirements: 12.3_

- [x] 5. Modul AUDIT (append-only)
  - [x] 5.1 Implementasi audit repo, service, dan pintu index
    - Buat `server/domain/audit/{audit.repo.ts,audit.service.ts,index.ts,events.ts}`
    - `write(tx, entry)` selalu in-tx dengan registry enum action; `listForCoo(filter)` hanya tampilan COO
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 5.2 Tulis unit test append-only audit
    - Verifikasi entri tidak dapat diubah/dihapus dan selalu memuat aktor, waktu, detail
    - _Requirements: 12.3_

- [x] 6. Modul IDENTITY (siklus hidup owner, COO, MFA)
  - [x] 6.1 Implementasi status siklus hidup dan fungsi keterbukaan
    - Buat `server/domain/identity/{identity.repo.ts,identity.service.ts,index.ts,events.ts}`
    - `aksesPenuh`, `perluReferral`, `pilihanReferral`, `requireVerifiedProfile`; transisi CAS `submitRegistration`, `verifyRegistration`, `rejectRegistration`, `markFirstPurchaseEffective`, `markExit`
    - _Requirements: 13.5, 13.6, 13.7, 15.5, 15.6, 22.1, 22.2, 22.4, 22.8_

  - [x] 6.2 Implementasi otoritas COO dan pergantian COO
    - `assertCooAt(tx, userId, at)` (cek `coo_tenures` pada now), `transferCoo` dengan referensi MoM + audit; kembalikan COO lama jadi Owner biasa
    - _Requirements: 15.2, 17.1, 17.2, 17.3_

  - [x] 6.3 Implementasi MFA OTP email
    - `requestOtp` (invalidasi kode hidup, cooldown 60s), `verifyAndConsumeOtp` (single-use via CAS, konsumsi in-tx); himpunan aksi tertutup konfirmasi/input_langsung/kompensasi; catat permintaan di audit
    - _Requirements: 3.1, 3.2, 3.4, 20.2_

  - [ ]* 6.4 Tulis unit test transisi status dan MFA
    - Test CAS transisi ilegal ditolak; OTP single-use; blokir setelah 3 gagal dalam 300 detik
    - _Requirements: 22.2, 3.2, 20.2_

- [x] 7. Modul PRICING (harga & MoM)
  - [x] 7.1 Implementasi resolusi harga dan riwayat
    - Buat `server/domain/pricing/{pricing.repo.ts,pricing.service.ts,index.ts,events.ts}`
    - `currentPrice` (resolusi tepat satu baris per tanggal Jakarta), `priceHistory`, `setPrice` (unik kind+effective_date, referensi MoM), `saveMom` (draft → final)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [ ]* 7.2 Tulis unit test resolusi harga dan draft MoM
    - Test satu harga berjalan per tanggal; MoM draft dapat diedit hingga final
    - _Requirements: 6.2, 7.3_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Modul RKAP (fase, capital item, plotting, penyesuaian)
  - [x] 9.1 Implementasi fase RKAP, view, dan ruang per Capital Type
    - Buat `server/domain/rkap/{rkap.repo.ts,rkap.service.ts,index.ts,events.ts}`
    - `newPhase` (kunci Initial Requirement), `getPhaseView` (kolom tabel FR-23 + agregat + Quantity Left), `spaceByCapitalType` (Σ Final Requirement − Fulfillment efektif)
    - _Requirements: 23.1, 23.2, 23.3, 23.13_

  - [x] 9.2 Implementasi penyesuaian instant, manual, dan rebalancing
    - `applyInstantAdjustment` (overshoot pembulatan), `manualAdjust` (hanya naikkan Final Req / item baru, tolak jika lewat batas fase dengan sisa kuota), `rebalance` (antar item sejenis, tertaut MoM)
    - _Requirements: 23.4, 23.5, 23.6, 23.7, 23.9_

  - [x] 9.3 Implementasi plotting alokasi Fulfillment (FIFO default)
    - `plotAllocation` + `defaultFifoPlot`; tolak plotting bila Fulfillment item melebihi Final Requirement; tutup gerbang Capital Type saat Fulfillment Rate 100%
    - _Requirements: 23.10, 23.11, 23.12_

  - [ ]* 9.4 Tulis unit test gerbang & penyesuaian RKAP
    - Test penutupan gerbang pada 100%, penolakan plotting melebihi Final Requirement, penolakan penyesuaian melebihi batas fase
    - _Requirements: 23.7, 23.10, 23.12_

- [x] 10. Modul LEDGER (satu-satunya penulis posisi)
  - [x] 10.1 Implementasi model, repo append-and-project, dan proyeksi posisi
    - Buat `server/domain/ledger/{ledger.model.ts,ledger.repo.ts,ledger.service.ts,index.ts,events.ts}`
    - `appendAndProject` (append ledger + update `positions` in-tx), `getPositions`, `getOwnerPosition`, `isFirstEffective`, `cutPointSnapshot`, `recomputeFromLedger` (rekonsiliasi, bukan jalur tulis)
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]* 10.2 Tulis property test konsistensi ledger↔posisi
    - **Property 1: Ledger↔posisi konsisten** (in-tx projection == recomputeFromLedger) — **Validates: Requirements 4.1**

  - [x] 10.3 Implementasi jalur finalisasi konfirmasi (FR-20)
    - `confirmOrder`: satu transaksi atomik dengan urutan lock global, otoritas COO in-tx, re-validasi Strength/ruang RKAP/referral, verifikasi+konsumsi OTP, append ledger, CAS pesanan → terkonfirmasi, plotting+overshoot, event Pembelian Pertama, enqueue Bukti + audit; tolak dengan hitungan bila re-validasi gagal
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 3.1, 3.2_

  - [x] 10.4 Implementasi jalur input langsung dan kompensasi (FR-21)
    - `directEntry` (validasi Strength sama seperti FR-1, harga tanggal input, MFA, tanpa Antrian Beli, wajib referral bila Pembelian Pertama), `compensationEntry` (tanpa re-validasi gerbang, menunjuk baris asal)
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [ ]* 10.5 Tulis property test gerbang Strength saat finalisasi
    - **Property 12: Pending kanonik** (predikat status='menunggu_konfirmasi' AND withdrawn_at IS NULL) — **Validates: Requirements 20.4, 1.3**
    - _Requirements: 20.4, 20.5_

- [x] 11. Modul ORDERS (submit, antrian, siklus hidup)
  - [x] 11.1 Implementasi model order dan submit dengan validasi Strength
    - Buat `server/domain/orders/{orders.model.ts,orders.repo.ts,orders.service.ts,index.ts,events.ts}`
    - `previewCalculation` (via shared/domain), `submitOrder` (Harga Terkunci, gerbang Strength & RKAP, tolak = tanpa baris pesanan + audit, notifikasi COO)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.12, 1.15, 6.3, 19.8_

  - [x] 11.2 Implementasi lifecycle antrian: withdraw, list, expire, lock
    - `withdrawOrder` (CAS set withdrawn_at + audit), `listQueueForCoo`, `listMyOrders`, `lockPendingForConfirm`, `expirePendingOrders` (hari-7), status set helper (rejected/confirmed/expired)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 15.4_

  - [ ]* 11.3 Tulis property test single-writer CAS antrian
    - **Property 13: CAS single-writer** (race konfirmasi/kedaluwarsa/penarikan → tepat satu berhasil) — **Validates: Requirements 19.1, 20.1**

  - [ ]* 11.4 Tulis unit test validasi Quantity submit
    - Test Quantity bukan integer / <1 / > maksimal ditolak dengan pesan rentang; harga terkunci tersimpan
    - _Requirements: 1.12, 1.15_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Modul CONTRIBUTION (item, realisasi, cut-off)
  - [x] 13.1 Implementasi definisi item dan pencatatan realisasi
    - Buat `server/domain/contribution/{contribution.repo.ts,contribution.service.ts,index.ts,events.ts}`
    - `defineItem` (nama, deskripsi, poin, periode, tautan MoM), `recordRealization` (tanggal + pencatat, tolak jika periode final), `runningPoints`
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.3_

  - [x] 13.2 Implementasi cut-off dengan carry-over
    - `cutOff` (snapshot beku imutabel; finalkan poin memenuhi syarat; carry over sisa; rekap terpisah), `finalizedUnredeemedPoints` (basis Insentif)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 13.3 Tulis unit test cut-off dan carry-over
    - Test poin ber-insentif tidak muncul lagi; saldo carry-over tampil sejak awal periode baru
    - _Requirements: 10.4, 10.5_

- [x] 14. Modul DISTRIBUTION (simulasi & rekap distribusi laba)
  - [x] 14.1 Implementasi simulasi dan penyimpanan rekap
    - Buat `server/domain/distribution/{distribution.repo.ts,distribution.service.ts,index.ts,events.ts}`
    - `simulate` (via shared/domain, tanpa persist), `saveRecap` (snapshot imutabel; alokasi Charity utuh; tandai Insentif tertunaikan + flip status Keluar), `compareToPrevious`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.11, 13.6_

  - [ ]* 14.2 Tulis unit test rekap distribusi dan flip Keluar
    - Test rekap lengkap (laba diaudit/ditahan/Dibagikan/3 pool/per Owner); Owner tanpa saham → Keluar setelah Insentif tertunaikan
    - _Requirements: 16.8, 16.9_

- [x] 15. Modul PROOFS (Bukti Transaksi & outbox email)
  - [x] 15.1 Implementasi outbox, render Bukti, dan drain
    - Buat `server/domain/proofs/{proofs.repo.ts,proofs.service.ts,index.ts,events.ts}`
    - `enqueueProof`/`enqueueEmail` (in-tx), `renderProofPdf` (fungsi murni titik potong, Template Konfirmasi Pembelian Saham v3), `drainOutbox` (async + retry, log+alert saat gagal terus)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 19.8, 20.10_

  - [ ]* 15.2 Tulis property test idempotensi Bukti
    - **Property 11: Idempotensi Bukti** (render berkali-kali byte-identik) — **Validates: Requirements 11.1**

- [x] 16. Modul MIGRATION (data historis)
  - [x] 16.1 Implementasi import historis dan laporan migrasi
    - Buat `server/domain/migration/{migration.service.ts,index.ts,events.ts}`
    - `run(source)` memakai `LedgerModule.importHistorical` (tanpa gerbang & penyesuaian instant, aktor 'system'); migrasi transaksi + Evidence + Profile dari Google Form
    - _Requirements: 14.1, 14.2, 14.4_

  - [ ]* 16.2 Tulis integration test Grand Total migrasi
    - **Property 16: Migrasi Grand Total** (Quantity 3.622, Shares 5.187, Ceil 14.980; paritas Fulfillment Rate per jenis modal) — **Validates: Requirements 14.3**

- [x] 17. Enforcement akses server dan cron jobs
  - [x] 17.1 Implementasi guard akses server (matriks keterbukaan §4.8)
    - Buat `server/utils/access.ts`: `assertSurfaceAccess` (role tiga tingkat, permukaan terkunci untuk owner tanpa saham/Keluar, COO-only), redirect Halaman Personal
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 22.7, 22.10_

  - [x] 17.2 Implementasi cron expiry pesanan dan lifecycle pendaftar
    - Buat `server/jobs/expire-orders.ts` (hari-7 zona Jakarta, CAS + audit) dan `server/jobs/registration-reminders.ts` (pengingat H-3, kedaluwarsa hari-7); endpoint terproteksi CRON_SECRET
    - _Requirements: 19.4, 22.5, 22.6_

- [ ] 18. Route API tipis (wiring server)
  - [x] 18.1 Implementasi route handler orders, ledger, dan MFA
    - Buat `server/api/orders/*` (submit, withdraw, list), `server/api/ledger/*` (confirm, direct-entry), `server/api/mfa/*` (request-otp); parse → assertSurfaceAccess → domain → render string desimal
    - _Requirements: 1.1, 3.1, 19.3, 20.1, 21.1_

  - [x] 18.2 Implementasi route handler pricing, rkap, contribution, distribution, identity
    - Buat route untuk set/lihat harga & MoM, view/adjust/rebalance RKAP, item & realisasi & cut-off Contribution, simulate/save distribusi, pendaftaran & verifikasi & transfer COO
    - _Requirements: 6.1, 7.1, 8.1, 9.1, 10.1, 16.1, 17.1, 22.1, 23.1_

  - [x] 18.3 Konfigurasi NuxtAuth Google OAuth dan header no-store
    - Setup NuxtAuth (Google OAuth, cocokkan email migrasi); `Cache-Control: no-store` untuk SSR & `/api/**`
    - _Requirements: 22.11, 15.1_

- [x] 19. UI: pratinjau, dashboard, chart, dan halaman inti
  - [x] 19.1 Implementasi composable dan panel pratinjau perhitungan
    - Buat `app/composables/useSharedDomain.ts` & `useFreshness.ts`; `app/components/PanelPratinjauPerhitungan.client.vue` memakai `evalStrengthGate` yang sama dengan server; Alert Penolakan Terhitung + kunci submit saat >100%
    - _Requirements: 1.1, 1.2, 1.15_

  - [x] 19.2 Implementasi tabel kepemilikan dan chart dashboard
    - Buat komponen tabel kepemilikan (Quantity/Shares/Portion/Ceil/Strength/Actual/RTL + Grand Total) dan chart Pie Portion, Donut dua cincin, stacked bar Big/Medium/Small Cap dengan ambang konfigurabel (ECharts)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 19.3 Implementasi halaman form pesanan, antrian, dan halaman personal
    - Buat pages pesanan (form + preview), antrian beli (COO), halaman personal owner tanpa saham (Profile + portofolio + buat pesanan), dialog MFA
    - _Requirements: 1.1, 19.6, 19.7, 22.7, 3.1_

  - [x] 19.4 Implementasi halaman RKAP, harga/MoM, kontribusi, distribusi, dan audit
    - Buat pages RKAP + progress, harga berjalan & riwayat, MoM, kontribusi, rekap distribusi laba (matriks keterbukaan), audit trail (COO), pendaftaran & profil
    - _Requirements: 6.5, 7.1, 8.1, 9.2, 10.5, 12.4, 16.11, 22.1, 23.13_

  - [x] 19.5 Middleware klien kosmetik dan PWA
    - Buat `app/middleware/access.global.ts` (kosmetik, otoritas tetap server); konfigurasi `@vite-pwa/nuxt` (generateSW, cache aset statis saja, prompt pembaruan)
    - _Requirements: 15.1_

- [ ] 20. Integrasi akhir dan tes menyeluruh
  - [ ]* 20.1 Tulis integration test transaksi finalisasi atomik
    - Test append ledger + CAS status + plotting + penyesuaian instant + audit + outbox dalam satu tx; kegagalan salah satu me-rollback semua; OTP tak terkonsumsi saat rollback
    - _Requirements: 20.7, 20.8, 20.10, 3.2_

  - [ ]* 20.2 Tulis integration test race CAS lintas jalur
    - Test konfirmasi vs cron kedaluwarsa vs penarikan atas baris pesanan yang sama → tepat satu penulis berhasil
    - _Requirements: 19.1, 19.3, 20.1_

  - [ ]* 20.3 Tulis smoke test scaffold stack
    - Verifikasi shadcn-vue + Nuxt 4, NuxtAuth Google OAuth, build PWA install + prompt pembaruan
    - _Requirements: 15.1_

- [x] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements (sub-requirement clause numbers) for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–16) dari PART C design
- Unit dan integration tests memvalidasi contoh spesifik, edge case, dan invarian transaksi atomik
- FR-2 (penjualan saham) berada di luar scope Phase 1 dan tidak memiliki tugas implementasi

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.3", "2.5", "2.7", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6", "2.8", "3.1", "4.2"] },
    { "id": 4, "tasks": ["3.2", "3.3", "5.1", "6.1", "7.1"] },
    { "id": 5, "tasks": ["5.2", "6.2", "6.3", "7.2", "9.1"] },
    { "id": 6, "tasks": ["6.4", "9.2", "9.3", "10.1"] },
    { "id": 7, "tasks": ["9.4", "10.2", "10.3", "10.4"] },
    { "id": 8, "tasks": ["10.5", "11.1"] },
    { "id": 9, "tasks": ["11.2", "13.1", "14.1", "15.1", "16.1"] },
    { "id": 10, "tasks": ["11.3", "11.4", "13.2", "14.2", "15.2", "16.2"] },
    { "id": 11, "tasks": ["13.3", "17.1", "17.2"] },
    { "id": 12, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 13, "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5"] },
    { "id": 14, "tasks": ["20.1", "20.2", "20.3"] }
  ]
}
```
