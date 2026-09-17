# tests/ — Lapisan E2E/API (Playwright)

Unit & integrasi modul tetap di Vitest ter-colocate (`shared/`, `server/`, `app/`
— lihat `vitest.config.ts`). Direktori ini adalah lapisan E2E/API berbasis
Playwright + [`@seontechnologies/playwright-utils`](https://github.com/seontechnologies/playwright-utils),
di-scaffold oleh workflow TEA Framework (progress:
`_bmad-output/test-artifacts/framework-setup-progress.md`).

## Setup

```bash
nvm use            # Node 24 (.nvmrc)
npm ci
npx playwright install          # browser (chromium sudah terpasang lokal)
# Supabase lokal harus hidup untuk /api/health bermakna database:
# (lihat README.md root untuk runbook supabase lokal)
```

Env testing (lihat `.env.example` seksi "Testing E2E/API"):
`TEST_ENV` (pemisahan sesi auth: local/staging/production), `BASE_URL`
(kosong secara lokal agar `webServer` menjalankan `nuxt dev` otomatis), `API_URL`.

## Menjalankan

```bash
npm run test:e2e                       # headless, semua proyek browser terpasang
npx playwright test --project=chromium # satu browser
npx playwright test --headed           # lihat browser
npx playwright test --ui               # UI mode (eksplorasi + time travel)
npx playwright test --debug            # PWDEBUG step-by-step
npx playwright show-report             # laporan HTML terakhir
npm run test:e2e:burn-in               # hanya test terdampak diff vs develop
```

## Arsitektur

```
tests/
├── e2e/                    # spec — SATU entry point impor: ../support/merged-fixtures
├── support/
│   ├── merged-fixtures.ts  # ⭐ satu-satunya sumber `test` (mergeTests) + `expect` + `log`
│   ├── auth-fixture.ts     # AuthProvider NuxtAuth (6 member + getBaseUrl) — TODO auth terdokumentasi
│   ├── global-setup.ts     # authStorageInit → configureAuthSession → setAuthProvider
│   ├── fixtures/cleanup.ts # cleanup.track(dispose) — dibalik-urutan pasca-test (auto)
│   ├── factories/          # data SINTETIS faker id_ID (owner-factory) — data nyata dilarang masuk repo
│   └── helpers/test-ids.ts # pusat konstanta data-testid
├── config/burn-in.config.ts
└── scripts/burn-in-changed.ts
```

**Aturan mutlak (mandate playwright-utils):**

- Spec mengimpor `test` HANYA dari `../support/merged-fixtures` — bukan dari
  `@playwright/test` langsung (`expect` boleh langsung).
- HTTP dari test → `apiRequest({ method, path, validateSchema? })`; dilarang
  `request.get/...` mentah dan `await response.json()`.
- Observe/stub jaringan UI → `interceptNetworkCall({ url })` DIDEKLARASIKAN
  sebelum `page.goto` lalu di-await setelahnya — bukan `page.route`.
- Menunggu kondisi async/hidrasi/eventual consistency → `recurse(fn, predicate,
  { timeout })` — bukan `page.waitForTimeout`.
- Log yang tampil di laporan → `log.step/info/success/warning` — bukan `console.log`.
- Auth via fixture `authToken` — dilarang helper login form ad-hoc.
- Badge/status di-assert by role/text (UX-DR4), selector lain via `data-testid`
  dari `helpers/test-ids.ts`.
- Isolasi: setup data via API/factory (`cleanup.track`), UI hanya untuk validasi.
- **Kontrak uang AD-10 berlaku juga di test**: tanpa `Number()`/`parseFloat()`
  (dipaksa lint repo-wide); nilai uang = string desimal berskala tetap.
- Penyimpangan yang benar-benar diperlukan: komentar
  `// playwright-utils deviation: <alasan>` + dicatat di ringkasan workflow.

## Contoh acuan

- `e2e/health.api.spec.ts` — pola API: apiRequest + validateSchema (zod) +
  log.step GIVEN/WHEN/THEN.
- `e2e/smoke.ui.spec.ts` — pola UI: intercept-before-goto, data-testid,
  interaksi keyboard, `recurse` untuk hidrasi, faker untuk input sintetis.

## Troubleshooting

| Gejala | Sebab & solusi |
|---|---|
| `Executable doesn't exist … playwright install` | Browser belum terpasang: `npx playwright install` (chromium saja: `--only-shell`). |
| Test health gagal 503 `DEPENDENCY_UNAVAILABLE` | Supabase lokal mati — hidupkan (runbook README root); tanpa `NUXT_DATABASE_URL` health menjawab `database: not-configured` (masih 200, tetap lulus). |
| `page.goto: Cannot navigate to invalid URL` | baseURL hilang — pastikan provider auth memasang `getBaseUrl` (lihat auth-fixture.ts) dan `BASE_URL` kosong/valid. |
| Dialog reka-ui tak terbuka saat klik pointer | Perilaku headless yang diketahui (lihat catatan R-005 di smoke.ui.spec.ts) — gunakan aktivasi keyboard `press('Enter')`. |
| Test UI lambat/flaky di awal interaksi | Hidrasi Vue dev-mode belum selesai — tunggu kondisi dengan `recurse` (pola di sample), bukan sleep. |
| Warning `manageAuthToken belum diimplementasikan` | Diharapkan sampai Story 1.2/1.4+ — fixture auth memakai sesi kosong untuk permukaan publik. |

## CI

- Reporter: list + HTML (`playwright-report/`) + JUnit (`test-results/junit.xml`).
- `retries: 2` di CI, `forbidOnly` aktif; sharding (`--shard=i/n`) siap dipakai
  saat suite membesar (workflow `bmad-testarch-ci`).
- Gerbang kualitas epik: skenario P0 100% hijau sebelum story dinyatakan done
  (lihat `_bmad-output/test-artifacts/test-design/snd-dash-handoff.md`).

## Hook write-time (enforcement)

`.claude/hooks/tea-enforce.cjs` (teregistrasi di `.claude/settings.json`, gate
`.tea/enforce-config.json`) memblokir tulis pada file test yang cocok glob:
**C2** test ter-focus (`.only`/`fit`), **C3** asersi tautologis
(`expect(x).toBe(x)`), **H1** hard wait (`waitForTimeout`/`sleep`), **H5** file
test >1000 baris; **C1** test disabled memberi peringatan (butuh alasan
terdokumentasi — keputusan manusiawi). Severity berasal dari criteria registry
`bmad-testarch-test-review`, bukan dari hook. Aturan dimatikan secara sadar via
`disabledRules` di `.tea/enforce-config.json` — sertakan alasannya di commit.

## Referensi pengetahuan

- Fragment TEA: `playwright-utils-mandate.md`, `fixtures-composition.md`,
  `auth-session.md`, `api-request.md`, `recurse.md`, `intercept-network-call.md`,
  `network-error-monitor.md`, `data-factories.md`, `burn-in.md` (di modul skill
  TEA terinstal).
- Test design proyek: `_bmad-output/test-artifacts/test-design-architecture.md`
  dan `test-design-qa.md`.
