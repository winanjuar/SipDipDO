---
title: 'Story 1.1 — Scaffold Platform Nuxt 4'
type: 'feature'
created: '2026-09-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '1ff7c22d1b224928680e035f57b9a307cc5a6543'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repo snd-dash belum memiliki kode aplikasi — seluruh story Epic 1–6 (mulai dari auth, audit, pendaftaran) bergantung pada substrat platform yang belum ada; risiko terbesar proyek (R-005) adalah kompatibilitas NuxtAuth/`@vite-pwa/nuxt`/shadcn-vue di Nuxt 4 yang belum pernah diverifikasi.

**Approach:** Scaffold aplikasi Nuxt 4 persis mengikuti Structural Seed spine dengan pin stack eksak, lalu luluskan tiga smoke-test gerbang (NuxtAuth OAuth Google, PWA build+install+prompt, paritas komponen kontrak shadcn-vue) dengan jalur fallback terencana; fondasi outbox email, endpoint cron terproteksi, helper kalender-hari Asia/Jakarta, dan pasangan parse/serialize uang string desimal dibangun di level scaffold. Keputusan library chart (condong ECharts) dan decimal library dipin dan dicatat alasannya (AR-12).

**Keputusan pengguna (2026-09-16):**
1. Spec dipertahankan utuh meski >1600 token — kepadatan berasal dari kendala mengikat, bukan multi-goal.
2. Kredensial Google OAuth disiapkan sekarang via `.env` — smoke NuxtAuth dijalankan penuh (R-005 dapat go).
3. Resend/outbox: wiring lengkap tanpa kredensial produksi; verifikasi kirim nyata wajib sebelum Story 1.5.

## Boundaries & Constraints

**Always:**
- Struktur direktori verbatim Structural Seed: `app/` (pages/components/islands/composables), `server/api` tipis, `server/domain/` 10 modul seragam (`index.ts` satu pintu impor, `*.service.ts`, `*.repo.ts`, `events.ts` opsional; Drizzle hanya di repo), `server/jobs`, `shared/domain` murni tanpa I/O, `drizzle/`.
- Pin eksak: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `postgres.js@3.4.9`, NuxtAuth 1.3.1, `@vite-pwa/nuxt@1.1.1`; Node 24 LTS dengan `engines >=22.19.0`; cek dist-tag Drizzle 1.0 saat scaffold — bila GA, ambil dan ulangi smoke migrasi (AR-2).
- AD-1..AD-12 mengikat; khususnya AD-12 untuk konfigurasi PWA: cangkang = aset ter-fingerprint + manifest + ikon + tepat satu `/offline`; dokumen SSR & `/api/**` `Cache-Control: no-store`; `registerType: 'prompt'` tanpa `skipWaiting`.
- Fungsi lintas modul dalam jalur transaksi menerima `tx`; hanya service teratas membuka transaksi.
- Aturan kalender-hari via helper `shared/domain` zona Asia/Jakarta; nilai uang/ratio sebagai string desimal berskala tetap — tidak pernah `number`/`parseFloat`.
- UI light-only tanpa pasangan dark; delta brand tokens UX-DR2 (primary navy `#2D3959`, success `#15803D`, warn `#B45309`, palet `chart-1..10`, bigcap-ceil `#93C5FD`).
- Data uji sintetis saja; kredensial hanya via env (`local` + `production` saja).
- Verifikasi versi & cara pakai setiap dependency yang dipasang dengan **MCP context7** (dokumentasi mutakhir per versi): cek dist-tag Drizzle 1.0, kompatibilitas NuxtAuth & `@vite-pwa/nuxt` di Nuxt 4, major Tailwind, versi shadcn-vue/resend SDK — sebelum memasang/memutuskan fallback. Bila context7 tidak tersedia di sesi implementasi, fallback ke npm registry (`npm view <pkg> version/dist-tags`) + web search resmi; sumber yang dipakai dicatat.

**Never:**
- Tidak mengimplementasi fitur domain story lain (halaman login/pendaftaran nyata, tabel audit, manajemen owner, dsb. — halaman yang dibuat hanyalah kerangka smoke dan `/offline`).
- Tidak ada deploy/Vercel project production; hanya konfigurasi env siap.
- Tidak menyimpan kredensial/secrets di repo (`.env` di-gitignore; contoh via `.env.example`).
- Tidak menambah lapisan/taksonomi folder di luar Structural Seed.
- Tidak memakai `new Date()` mentah untuk batas hari; tidak menambah `swr`/`isr` rute domain; tanpa runtime-caching dokumen/API di SW.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build produksi | `npm run build` | Build sukses; SW di-generate (generateSW); aset ter-fingerprint | Error build = blocker, diperbaiki sebelum lanjut |
| Dev server | `npm run dev` | Halaman smoke & `/offline` ter-render SSR | Pesan error dev jelas |
| Smoke NuxtAuth | Login Google di dev dengan kredensial env | Session terbentuk; user terautentikasi | Bila gagal di Nuxt 4 → jalankan fallback `nuxt-auth-utils`/OAuth manual; keputusan + alasan dicatat (tetap AD-8) |
| Smoke PWA | Build lalu buka prod-preview; install PWA; simpan offline | Ter-install; prompt pembaruan tampil (bukan di atas dialog transaksional); offline → `/offline` | Bila gagal → fallback `vite-plugin-pwa` langsung / SW kustom direviu terhadap AD-12 |
| Paritas komponen kontrak | Halaman smoke merender Dialog/Sheet/Tooltip/Drawer/Input-OTP/Toast | Keenamnya berfungsi interaktif di Nuxt 4 | Komponen gagal = blocker substrat, eskalasi keputusan |
| Smoke migrasi Drizzle | `drizzle-kit migrate` ke Supabase lokal (Docker) | Migrasi awal ter-apply bersih | Cek dist-tag dulu; gagal → jangan naik versi buta |
| Cron endpoint | `POST /jobs/daily` tanpa `CRON_SECRET` | 401 seragam `{ code, message, details }` | Dengan secret → 200 (job list scaffold: no-op) |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` — Structural Seed (baris 189–254), Stack + pin + fallback (169–188), Do/Don't (141–168), AD-12 (115–127). Sumber kebenaran struktur & versi.
- `_bmad-output/planning-artifacts/epics/epic-1.md` — Story 1.1 AC verbatim (baris 5–35); modul Epic 1: identity, audit, proofs.
- `_bmad-output/implementation-artifacts/epic-1-context.md` — konteks epic terkompilasi (keputusan teknis & pola UX).
- `_bmad-output/test-artifacts/test-design/snd-dash-handoff.md` — R-005 gerbang go/no-go story ini; R-008/R-010 ekspektasi helper waktu & kontrak uang level scaffold.
- `.gitignore` — sudah ber-seed Nuxt/Supabase (node_modules, .nuxt, .output, .env, .vercel, supabase temp).
- Root repo — greenfield: belum ada `package.json`; Node v24.19.0, npm 11, Docker 29 terpasang; **supabase CLI belum terpasang** (instal via brew saat implement).
- Catatan rujukan: **AR-x** (Additional Requirements, dari `epics/index.md`) ≠ **AD-x** (invariant spine) — AR-2/3/6/12 merujuk daftar Additional Requirements epics index; AD-1..AD-12 merujuk spine.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- init npm dengan pin eksak (AR-2) + `engines >=22.19.0` + scripts `dev/build/preview/test/lint/typecheck/db:generate/db:migrate` + konfigurasi ESLint aturan kontrak uang R-010 (no-restricted-syntax melarang `Number()`/`parseFloat()` untuk nilai uang/ratio) -- kontrak versi & perintah tunggal.
- [x] `nuxt.config.ts` -- modul NuxtAuth + `@vite-pwa/nuxt` (opsi AD-12: `registerType: 'prompt'`, manifest `display: 'standalone'` TANPA `orientation`, `navigateFallback` hanya `/offline`, tanpa runtimeCaching dokumen/API), `routeRules: { '/offline': { prerender: true } }` agar shell offline statis ter-precache, header `Cache-Control: no-store` untuk dokumen SSR & `/api/**`, `runtimeConfig` env, TypeScript strict -- pusat konfigurasi substrat.
- [x] `app/pages/smoke.vue` + `app/pages/offline.vue` + `app/app.vue` -- kerangka halaman dev-only untuk smoke paritas komponen & offline shell -- bukti R-005.
- [x] `app/components/` + `app/lib/utils.ts` + `components.json` + `tailwind.config`/CSS tokens -- init shadcn-vue + Tailwind, pasang keenam komponen kontrak, delta brand UX-DR2 light-only -- paritas kontrak DESIGN.md.
- [x] `server/domain/{identity,orders,ledger,rkap,pricing,contribution,distribution,proofs,audit,migration}/` -- tiap modul bentuk seragam `index.ts` + `*.service.ts` + `*.repo.ts` minimal (identity & proofs berisi kerangka outbox/cron-nya; lainnya stub berkomentar) -- seed 10 modul AD-5.
- [x] `server/domain/proofs/` -- kerangka outbox: baris ditulis in-tx, sender async + retry dengan kegagalan terlihat (log + alert), wiring klien Resend (kredensial via env, tanpa kredensial produksi dulu) -- fondasi AR-6.
- [x] `shared/domain/` -- pasangan parse/serialize desimal berskala tetap + helper hari Asia/Jakarta, murni tanpa I/O -- kontrak AD-9/AD-10.
- [x] `shared/domain/*.test.ts` -- unit test helper waktu & parse/serialize (contoh sintetis) -- pin kontrak AD-9/AD-10.
- [x] `server/api/health.get.ts` + `server/jobs/daily.post.ts` -- route tipis + cron terproteksi CRON_SECRET, batas hari dihitung zona Asia/Jakarta, error seragam `{ code, message, details }` -- pola route untuk story berikutnya.
- [x] `drizzle/schema.ts` + `drizzle.config.ts` + `drizzle/` migrasi awal + koneksi `postgres.js` pooler -- smoke migrasi ke Supabase lokal (Docker) lulus.
- [x] `.env.example` + `README.md` -- inventaris env (GOOGLE_*, DATABASE_URL pooler, RESEND_API_KEY, FROM, CRON_SECRET) + runbook dev/smoke + **keputusan From-domain & checklist record DNS SPF/DKIM** (verifikasi via dashboard Resend; kirim nyata tetap gerbang pra-Story 1.5) -- tanpa rahasia di repo.
- [x] Keputusan & pin library -- catat pilihan + alasan di Design Notes spec ini (AR-12): chart & decimal library, versi resend SDK, versi shadcn-vue + major Tailwind (recek jendela Node 24 berakhir Okt 2026), dan keputusan menunda pemasangan `@react-pdf/renderer@4.9.0` ke Epic 3 (peer React server-only, tak terpakai di scaffold); seluruh versi diverifikasi via MCP context7 (fallback npm registry/web) dengan sumber tercatat.

**Acceptance Criteria:**
- Given repo tanpa kode, when scaffold selesai, then struktur Structural Seed tercipta utuh dan `npm run build` + `npm test` lulus.
- Given NuxtAuth/PWA/shadcn-vue terpasang terpin, when tiga smoke-test dijalankan, then ketiganya lulus di Nuxt 4 ATAU fallback terdokumentasi dipilih dengan alasan (R-005 go/no-go tercatat).
- Given lingkungan lokal Supabase CLI berjalan, when migrasi Drizzle di-apply, then migrasi bersih dan koneksi pooler terverifikasi.
- Given hanya env `local`+`production`, when konfigurasi selesai, then outbox + Resend (keputusan From-domain + checklist SPF/DKIM terdokumentasi di runbook; kredensial kirim menyusul gerbang pra-1.5) + cron siap dipakai story berikutnya tanpa keputusan baru.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Triage 2026-09-16 (3 lapis: blind-hunter, edge-case-hunter, verification-gap; diverifikasi terhadap diff + pohon kode):

- BH-1 spec melebih-lebihkan status R-005 (semua task dicentang) — **false**: seluruh 12 task Execution memang selesai (semua adalah task pembuatan); Design Notes justru mencantumkan eksplisit "Manual tersisa (butuh browser/kredensial): login Google penuh, install PWA + prompt, interaksi keenam komponen". Sisa gerbang interaktif = kerja manual manusia (kredensial Google belum di `.env` — `NUXT_GOOGLE_CLIENT_ID` kosong, diverifikasi), diserahkan ke manusia saat presentasi; bukan defek spec.
- BH-2/E-9 blok ESLint `files: ['public/sw.ts']` menunjuk path yang tidak ada (SW asli `app/public/sw.js`, bahkan ter-ignore preset — diverifikasi empiris) — **medium**: komentar konfig menjanjikan SW ter-lint aturan kontrak R-010 tetapi tidak pernah ter-lint; konfig mati menyesatkan. → patch (grup SW-path).
- BH-3 README bagian Struktur + komentar `nuxt.config.ts` masih menulis `public/sw.ts` — **low**: dokumentasi menyesatkan; koreksi langsung. → patch (grup SW-path).
- BH-4/E-11 tabel env README mendokumentasikan `AUTH_ORIGIN` origin-only, kontradiktif dengan `.env.example`/Design Notes 7(a) (wajib baseURL penuh `/api/auth`) — **medium**: setup produksi mengikuti README akan merusak rute NuxtAuth. → patch.
- BH-5 `dispatchPendingOutboxEmails` tanpa satu pun pemanggil; TODO "bila dipilih" = keputusan baru yang justru dilarang AC-4 — **medium**: email outbox menumpuk `pending` selamanya; "wiring lengkap" belum terpenuhi. → patch (panggil di `server/jobs/daily.post.ts`).
- BH-6/E-2 `markOutboxEmailSent` tanpa guard status `pending`; dua dispatcher tumpang-tindih dapat kirim ganda (OTP/Bukti Transaksi duplikat) — **medium**. → patch (grup konkurensi dispatch).
- E-3 hasil `markOutboxEmailAttemptFailed` (CAS) yang `undefined` diabaikan — **low**: akuntasi log/counter menyesatkan pada kondisi konkuren; akar sama dengan BH-6. → patch (grup konkurensi dispatch).
- BH-7/E-5 hanya `validation_error` dianggap permanen; `invalid_from_address` dsb. di-retry 5× berjam-jam — **low**: koreksi langsung (perluas set permanen). → patch.
- BH-8/E-12 `renderEmail` interpolasi `toAddress`/payload ke HTML tanpa escape — **medium**: pola injeksi HTML akan ter-copy ke template nyata (data owner) di story berikutnya. → patch.
- BH-9 `lang="id"` kontrak UX/WCAG tidak pernah diset pada dokumen (hanya di manifest PWA); tanpa `<title>` — **medium**: pembaca layar salah melafalkan Bahasa Indonesia; cangkang scaffold adalah tempatnya diset. → patch.
- BH-10 `/smoke` tanpa guard produksi — **low, DITOLAK**: story ini tanpa deploy produksi (Never), penghapusan halaman terjadwal akhir Epic 1 (komentar kode), tanpa data sensitif.
- BH-11 `[db.seed] enabled=true` menunjuk `./seed.sql` yang tidak ada (diverifikasi di `supabase/config.toml` + disk) — **low**: `supabase db reset` (dianjurkan README) gagal; koreksi langsung (disable seed). → patch.
- BH-12 kebijakan AGENTS.md "`_bmad-output/` beku" terkontradiksi oleh penulisan workflow (`implementation-artifacts/`, memlog party-mode) — **defer**: perbaikannya mengedit file agent-context (AGENTS.md) — scope-freeze perlu dirumuskan ulang pemiliknya.
- BH-13 unary `+` lolos aturan uang ESLint — **low, DITOLAK**: selector presisi mustahil tanpa false-positive luas; aturan memang guardrail (parseInt sengaja diizinkan untuk integer), bukan jaminan mutlak.
- BH-14 `exports/snd-dash-epic-story-breakdown.xlsx` tanpa provenance/perintah regenerasi — **defer**: file pre-existing (ada sebelum baseline story ini), bukan buatan perubahan ini.
- BH-15 nama migrasi auto-generated `0000_old_doctor_spectrum` — **low, DITOLAK**: kosmetik; rename menuntut operasi journal/DB lokal (bukan koreksi langsung), lingkungan lain belum ada.
- BH-16/E-6 `asDayKey`/`parseDayKey` validasi bentuk saja: `2026-02-31` lolos lalu `Date.UTC` rollover senyap (`2026-13-01` → `2027-01-01`, diverifikasi) — **medium**: batas hari bergeser senyap pada input cacat; modul ini justru "satu-satunya jalur sah" pembuat DayKey. → patch + tes.
- BH-17/BH-18/VG-1 `vitest.config.ts` sudah menyertakan `server/**/*.test.ts` tetapi tanpa alias `#shared` → modul server yang mengimpor `#shared/domain/calendar` tidak dapat diuji; mesin outbox (paling kaya perilaku: backoff, exhausted, CAS, due-window) tanpa satu pun tes — **medium** (pre-verified oleh verification-gap: `npm test` hanya menjalankan 22 tes `shared/domain`; mutasi `>=`→`>` atau hapus CAS tidak memerahkan suite). → patch.
- VG-2 komposisi FR-22 `registrationDeadline` (hari ke-7, H-3) tidak dipinkan tes mana pun (konstanta 7/3 bebas bergeser sebelum Story 1.4) — **medium** (pre-verified). → patch (ikut alias `#shared`).
- VG-3 `isDayOnOrBefore` hanya diuji pada kasus true berjarak 3 hari; boundary hari-sama & cabang false tidak dipinkan (off-by-one expiry tak terdeteksi) — **low** (pre-verified); koreksi langsung (2 asersi). → patch.
- VG-4 proteksi CRON_SECRET `POST /jobs/daily` hanya diverifikasi manual (401/401/200 kini juga dijalankan ulang oleh orchestrator) — **defer** sesuai disposisi test-design: tes route/API level-story (R-012, ATDD) saat job nyata ada.
- BH-19 tanpa CI — **defer**: ketiadaan CI pre-existing (greenfield tanpa kode); automasi lint+test layak masuk perencanaan terpisah (bmad-testarch-ci).
- E-1 `timingSafeEqual` melempar `RangeError` bila panjang byte buffer beda — guard membandingkan `.length` UTF-16, bukan byte: token penyerang multibyte dengan panjang UTF-16 sama → 500 mentah menggantikan envelope 401 — **medium** (tanpa eskalasi privilege, tetapi merusak kontrak error seragam di endpoint yang dapat dipicu eksternal). → patch.
- E-4 `send`/`mark*` melempar di tengah loop → sisa batch terlewati + error mentah — **low, DITOLAK**: baris tetap `pending` (tidak hilang, dikirim run berikutnya); kegagalan tetap terlihat (500 cron + log); perbaikan berupa guard tambahan.
- E-7 `addCalendarDays` argumen fractional/extreme — **low, DITOLAK**: tidak tercapai (satu-satunya pemanggil memakai konstanta integer 7/−3).
- E-8 parse uang tanpa cap magnitudo `numeric(18,2)`/`numeric(9,6)` — **low**: nilai lolos parse lalu gagal jauh di DB; koreksi langsung di fungsi validasi. → patch + tes.
- E-10 `globPatterns` `**/*.html` akan mem-precache HTML prerender tambahan bila muncul di masa depan — **low**: invariant AD-12 "tepat satu `/offline`" hanya dijaga secara kebetulan hari ini. → patch (persempit glob).

Grup hasil (rute): patch — SW-path+lint (BH-2/BH-3/E-9, medium); README AUTH_ORIGIN (BH-4/E-11, medium); wiring dispatch (BH-5, medium); konkurensi dispatch (BH-6/E-2/E-3, medium); permanen Resend (BH-7/E-5, low); escape renderEmail (BH-8/E-12, medium); lang+title (BH-9, medium); validasi semantik DayKey (BH-16/E-6, medium); cap magnitudo uang (E-8, low); glob HTML (E-10, low); guard byte cron (E-1, medium); seed Supabase (BH-11, low); alias `#shared` + tes outbox + tes registrationDeadline (BH-17/BH-18/VG-1/VG-2, medium); tes boundary isDayOnOrBefore (VG-3, low). Defer — AGENTS.md scope-freeze (BH-12), provenance exports (BH-14), tes route cron (VG-4), CI (BH-19). Tidak ada intent_gap/bad_spec → tanpa loopback.

Patch diterapkan 2026-09-16 oleh subagent implementasi yang sama (14 grup selesai): seluruh verifikasi spec dijalankan ulang oleh orchestrator — `npm test` 37/37 (4 file, termasuk 2 file tes server baru); `npm run typecheck` + `npm run lint` bersih (SW `app/public/sw.js` kini benar-benar ter-lint, diverifikasi eksplisit); `npm run build` sukses dengan precache tetap tepat-satu dokumen `offline`; `drizzle-kit migrate` idempoten bersih; prod-preview: dokumen & API `no-store`, `lang="id"` + title tampil di SSR, cron 401 (termasuk probe token multibyte — envelope 401, bukan 500) dan 200 dengan `jobs.outbox` ter-wire.

## Design Notes

Bentuk modul seragam + aturan `tx`-handle adalah konvensi seed yang dipakai seluruh story — deviasi bentuk folder di sini akan menular ke semua modul berikutnya. Smoke dilakukan berurutan (auth → PWA → komponen) karena keputusan fallback masing-masing independen. Contoh pasangan parse/serialize:

```
parseRupiah("52.000,50") -> { scale: 2, value: "52000.50" }  // tanpa Number()
serializeRupiah(x)        -> "52.000,50"                     // format id-ID
```

### Catatan implementasi (2026-09-16, AR-12 — keputusan, pin, sumber)

**Versi terpasang & sumber verifikasi** (MCP context7: `/sidebase/nuxt-auth`, `/vite-pwa/docs`, `/websites/shadcn-vue`; npm registry `npm view <pkg> version/dist-tags`; inspeksi `node_modules`):

- `drizzle-orm@0.45.2` — dist-tag `latest` = 0.45.2; Drizzle 1.0 masih `rc.4` (dist-tag `rc`), **bukan GA** → per AR-2 pin 0.45.2 dipertahankan, tidak perlu ulang smoke migrasi. `drizzle-kit@0.31.10`, `postgres@3.4.9` (= latest).
- `nuxt@4.5.2` + `vue@3.5.42` + `vue-router@5.3.1` (range nuxt `^5.2.0` terpenuhi); `typescript@5.9.3` (latest 7.0.2 sengaja dihindari — belum terverifikasi dengan vue-tsc 3.3.11); `eslint@10.10.0` (peer `@nuxt/eslint@1.17.0` menerima `^9||^10`); `vitest@5.0.1` (peer vite `^6||^7||^8` — kompatibel Vite 8 bawaan Nuxt 4.5).
- NuxtAuth: `@sidebase/nuxt-auth@1.3.1` + `next-auth@4.21.1` (satu-satunya rilis dalam peer `~4.21.1`; 4.24.x TIDAK memenuhi range). Resend SDK: `resend@6.28.1` (npm registry).
- **Major Tailwind = v4** (4.3.3, CSS-first via `@tailwindcss/vite` — tanpa `tailwind.config.*`, token di `app/assets/css/tailwind.css`); shadcn-vue CLI `2.8.2` + `shadcn-nuxt@2.8.2`; runtime komponen: `reka-ui@2.10.4`, `vue-sonner@2.0.9`, `vue-input-otp@0.4.0`, `@vueuse/core@14.4.0`, `@lucide/vue@1.46.0`.
- Node 24 (jendela aktif berakhir Okt 2026): recek 2026-09-16 — v24.19.0 masih dalam jendela; `engines >=22.19.0` terpasang. TODO recek ulang saat upgrade major berikutnya.
- `@vitest/coverage-v8@5.0.1` (pasca-approval, 2026-09-16): peer `vitest@5.0.1` eksak (npm registry; docs config via context7 `/vitest-dev/vitest`) — coverage di `npm run test:coverage` (v8; reporter text+html+lcov; scope `shared/**`+`server/**` excluding `*.test.ts`; threshold per-file `shared/domain/*.ts` 90/90/95/95 — statements 90 memberi ruang kode defensif tak-terjangkau, mis. catch setelah validasi regex di money.ts).

**Keputusan AR-12:**

1. **Library chart = `echarts@6.1.0` (dipasang & dipin).** Alasan: chart "Distribusi Pemodalan" FR-18 adalah donut DUA CINCIN (cincin dalam jenis modal, cincin luar per owner) — ECharts mendukung seri pie bersarang native; Chart.js tidak mendukung donat dua cincin tanpa trik. Bonus: render SVG server-side (SSR-friendly), tree-shakeable. Wrapper Vue (`vue-echarts`) ditunda ke Epic 4 saat chart dibangun.
2. **Library decimal = `decimal.js@10.6.0`.** Alasan: presisi arbitrer; rounding default ROUND_HALF_UP persis konvensi penyajian AD-10; API string-in/string-out (nilai tidak pernah melewati `number`); murni JS tanpa native dep sehingga bisa dipakai bersama server/domain dan pulau klien via `shared/domain`. `big.js` lebih ringkas tetapi konfigurasi rounding terbatas — AD-10 menuntut SATU mekanisme, bukan campuran.
3. **`@react-pdf/renderer@4.9.0` DITUNDA ke Epic 3** (sesuai rencana spec): peer React server-only dan tidak ada pemakai di scaffold — memasang sekarang hanya menambah permukaan audit dependensi.
4. **Resend SDK 6.28.1** — wiring lengkap di `server/domain/proofs/resend.client.ts` (tanpa API key → klien "unconfigured" yang gagal TERLIHAT: log `alert: mail.unconfigured` + hasil `retryable:false` — tidak pernah senyap).

**Penyimpangan terdokumentasi (R-005 / AD-12):**

5. **PWA: `strategies: 'injectManifest'` + SW kustom `app/public/sw.js`** — jalur alternatif yang disahkan spine ("atau SW kustom yang direviu terhadap AD ini"). Bukti: template workbox-build 7.4.1 merender `navigateFallback` menjadi `NavigationRoute(createHandlerBoundToURL(...))` yang melayani shell dari precache untuk **SEMUA** navigasi tanpa menyentuh jaringan (dan `@vite-pwa/nuxt` bahkan meng-default-kan `navigateFallback='/'` untuk generateSW) — pada SSR ini memutus "data selalu daring". SW kustom: precache cangkang (diverifikasi post-build: manifest SW berisi TEPAT SATU dokumen `offline` + ikon + `manifest.webmanifest` + aset `_nuxt` ter-fingerprint + payload milik halaman offline; TANPA `runtimeCaching`), navigasi = fetch-first, shell `/offline` HANYA saat fetch gagal, `/api/**` tidak pernah disentuh SW; tanpa `skipWaiting`/`clientsClaim` (prompt). Catatan teknis: entry SW harus `.js` — entry `.ts` di Vite 8/rolldown di-embit `.mjs` sehingga URL registrasi `sw.js` tidak cocok; sumber SW disimpan di `app/public/` (root Vite = srcDir `app/`; folder itu BUKAN publicDir Nuxt sehingga sumber tidak ikut tersalin ke output).
6. **Toast → vue-sonner**: registry shadcn-vue 2.8.2 menandai komponen `toast` deprecated ("Use the sonner component instead") — kontrak "Toast" dipenuhi `<Toaster/>` + `toast()` (vue-sonner 2.0.9), perilaku toast shadcn terkini; dipasang sekali di `app/app.vue`.
7. **NuxtAuth di Nuxt 4 — setup lulus, dua catatan operasional**: (a) nilai `AUTH_ORIGIN` dipakai sebagai baseURL PENUH sehingga wajib menyertakan path `/api/auth` (mis. `http://localhost:3000/api/auth`) — tercatat di `.env.example`/README; (b) server produksi menolak boot tanpa `AUTH_ORIGIN`/`NUXT_AUTH_SECRET` (AUTH_NO_ORIGIN/AUTH_NO_SECRET). Endpoint session merespons 200 lokal; **smoke login Google penuh menunggu kredensial nyata di `.env`** (keputusan pengguna #2) — jalurnya siap di `/smoke` (`signIn('google')`).
8. **Penyesuaian path dalam seed**: `app/lib/utils.ts` (helper `cn` — alias `@` CLI shadcn-vue di Nuxt 4); `app/pages/index.vue` (kerangka netral agar verifikasi `curl -I /` bermakna; landing role = Story 1.2); endpoint `server/jobs/daily.post.ts` didaftarkan eksplisit via `nitro.handlers` (server/jobs bukan direktori scan Nitro); `supabase/config.toml` dari CLI (dirujuk `.gitignore` seed). `server/api/health.ts` tanpa sufiks metode agar HEAD (curl -I) terlayani.

**Hasil verifikasi (2026-09-16):** `npm run build` ✓ (SW + manifest + `offline/` di `.output/public`); `npm test` ✓ 22/22; `npm run typecheck` ✓; `npm run lint` ✓; `drizzle-kit migrate` ke Supabase lokal (Docker, brew supabase 2.117.0) ✓ bersih — `outbox_emails` + journal ter-apply, `GET /api/health` → `{"status":"ok","database":"ok"}`; prod-preview: dokumen `/`, `/smoke`, `/offline` & `/api/**` = `Cache-Control: no-store`, aset `_nuxt/**` = immutable, `sw.js`/manifest = `must-revalidate`; `POST /jobs/daily` tanpa secret → 401 envelope `{ code, message, details }`, dengan secret → 200 + `today` zona Asia/Jakarta. Manual tersisa (butuh browser/kredensial): login Google penuh, install PWA + prompt pembaruan, interaksi keenam komponen di `/smoke`.

**Hasil smoke browser R-005 (2026-09-16, pasca kredensial Google terisi di `.env`) — GO:** NuxtAuth OAuth Google lulus penuh: redirect ke `accounts.google.com` dengan parameter tepat (`redirect_uri=http://localhost:3000/api/auth/callback/google`, `scope=openid email profile`), consent screen menampilkan branding "Sip & Dip Dashboard", login nyata → status `authenticated` + email tampil di `/smoke`, sesi persisten antar muat halaman, "Keluar" → redirect `/` + `unauthenticated`. Paritas komponen kontrak lulus interaktif keenamnya: Dialog, Sheet, Drawer (buka-tutup), Input-OTP (isi → nilai tampil), Toast (muncul), Tooltip (focus → tampil). PWA terverifikasi di browser pada prod-preview: 1 SW `activated` scope `/`, precache `workbox-precache-v2` berisi TEPAT SATU dokumen (`/offline` + payload — AD-12), manifest tertaut, `lang="id"` aktif di dokumen. Tersisa manual (butuh UI chrome browser / siklus deploy ulang): install PWA + prompt pembaruan — jalur & artefaknya sudah terverifikasi non-interaktif. Keputusan pengguna #2 tertutup; R-005 = GO.

## Verification

**Commands:**
- `npm run build` -- expected: sukses tanpa error; artefak PWA di `.output/public/` (SW + manifest + `/offline`).
- `npm test` -- expected: unit test helper waktu & parse/serialize hijau.
- `npm run typecheck && npm run lint` -- expected: bersih.
- `drizzle-kit migrate` (Supabase lokal Docker) -- expected: migrasi awal ter-apply.
- `curl -I http://localhost:3000/` dan `curl -I http://localhost:3000/api/health` (prod-preview) -- expected: keduanya `Cache-Control: no-store`.

**Manual checks (if no CLI):**
- Dev server: halaman smoke merender keenam komponen kontrak interaktif; login Google membentuk session; prod-preview: PWA ter-install, prompt pembaruan tampil, offline menyajikan `/offline`.
