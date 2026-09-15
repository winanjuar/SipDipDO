# Tech-Currency Review — v3 (re-gate after fixes)

- **Reviewer role:** tech-currency reviewer
- **Date:** 2026-09-15
- **Target:** `../ARCHITECTURE-SPINE.md` (Stack table as amended: Node 24 LTS / engines floor; new shadcn-vue + Tailwind row; Drizzle exact pins + re-check rule; postgres.js 3.4.9; NuxtAuth fallback; @vite-pwa/nuxt reworded claim)
- **Directive:** verify every committed decision was web-researched/reality-checked, not asserted from training data. Re-verify amended claims via live web sources; flag remaining unverified tech.

## Verdict

**MINOR-DISCREPANCIES** — all amended claims verified CURRENT against live sources; no OUTDATED decisions; one wording imprecision (Drizzle "di rc.5") and two advisory notes. Nothing blocking. The amended Stack table is reality-checked, not training-data-asserted.

**Counts:** 13 CURRENT · 1 MINOR-DISCREPANCY (wording, decision-neutral) · 2 ADVISORY notes · 0 OUTDATED · 0 UNVERIFIED (load-bearing) · 3 honest deferrals (services/deferred rows, unchanged)

## Method

Live webfetch on 2026-09-15 of: endoflife.date, npm registry dist-tags + per-version manifests (registry.npmjs.org), GitHub Repos API (pushed_at/archival/status), shadcn-vue.com docs, supabase.com/changelog. Registry publish dates derived from `_npmOperationalInternal` timestamps where noted.

## Findings — amended claims (directive items 1–2)

| # | Spine claim | Status | Evidence | Source |
|---|---|---|---|---|
| 1 | **shadcn-vue row (NEW):** exists, maintained, reka-ui primitives, pin-at-scaffold + smoke-test parity of Dialog/Sheet/Tooltip/Drawer/Input-OTP/Toast | **CURRENT — treatment honest** | Repo `unovue/shadcn-vue`: 10,587 stars, 680 forks, MIT, **pushed 2026-09-15 (today)** — actively maintained. Docs live with changelog + "Legacy Docs" split (active evolution). Repo topics include `reka-ui` and `radix-vue`; reka-ui npm `latest` = 2.10.4 (active). Dedicated **Nuxt installation docs** (`shadcn-nuxt` module + `shadcn-vue` CLI). All six named contract components present in current docs component list. "Pin at scaffold" is the *correct* treatment: shadcn-vue is a CLI/copy-in registry system, not a versioned runtime dependency — code lives in your repo. The mandatory Nuxt-4 parity smoke-test is warranted because vendor docs do not specifically guarantee Nuxt 4 (generic Nuxt instructions). | shadcn-vue.com/docs/installation/nuxt; api.github.com/repos/unovue/shadcn-vue; registry.npmjs.org/-/package/reka-ui/dist-tags |
| 2 | **Node 24 LTS (24.21.x), active; Node 22 security-only** | **CURRENT** | endoflife.date (updated 2026-09-10): Node 24 LTS latest **24.21.0** (2026-09-08), active support to 2026-10-20, security to 2028-04-30. Node 22 LTS: active ended 2025-10-21, **security-only** to 2027-04-30, latest 22.23.2. | endoflife.date/nodejs |
| 3 | **Nuxt 4.5.2; engines floor `>=22.19.0`** | **CURRENT** | npm dist-tag `latest` = **4.5.2**. Manifest engines: `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0` — floor 22.19.0 accurate (24.21.0 satisfies ^24.11.0). Side claim "Nuxt 4.5 kini Vite 8/Rolldown" also confirmed: devDeps `vite ^8.2.0`, peer `rolldown ~1.2.1`, `@nuxt/vite-builder` 4.5.2. | registry.npmjs.org/-/package/nuxt/dist-tags; registry.npmjs.org/nuxt/latest |
| 4 | **drizzle-orm pin `0.45.2` = latest stable; v1.0 not GA; re-check dist-tag at scaffold** | **CURRENT, with wording note (see D-1)** | npm dist-tag `latest` = **0.45.2**. No 1.0.0 stable; `rc` tag = 1.0.0-rc.4; rc.5 exists only as commit-suffixed prerelease under separate `rc5` tag (`1.0.0-rc.5-5935859`). Decision (pin 0.45.2 + GA re-check rule) unaffected. | registry.npmjs.org/-/package/drizzle-orm/dist-tags |
| 5 | **drizzle-kit pin `0.31.10`** | **CURRENT** | npm dist-tag `latest` = **0.31.10**. | registry.npmjs.org/-/package/drizzle-kit/dist-tags |
| 6 | **postgres.js 3.4.9** | **CURRENT** | npm dist-tag `latest` = **3.4.9**. | registry.npmjs.org/-/package/postgres/dist-tags |
| 7 | **@vite-pwa/nuxt 1.1.1 — vendor states Nuxt 3 only; go/no-go smoke-test + fallback** | **CURRENT — reworded claim verified** | npm `latest` = **1.1.1**. Manifest: dependency `@nuxt/kit ^3.9.0` (exactly as spine states), description "**Zero-config PWA for Nuxt 3**", devDeps `nuxt ^3.10.1`. Registry publish timestamp of 1.1.1 ≈ **2026-02-06** ("rilis terakhir Feb 2026" ✓). GitHub repo `vite-pwa/nuxt`: not archived, last push 2026-05-07, 78 open issues — dormant-ish but alive. Nuxt-4 compatibility indeed **not stated by vendor**; the go/no-go build smoke-test + `vite-plugin-pwa`-direct/custom-SW fallback is the honest, reality-matched treatment. | registry.npmjs.org/@vite-pwa/nuxt/1.1.1; api.github.com/repos/vite-pwa/nuxt |
| 8 | **NuxtAuth fallback `nuxt-auth-utils`** | **CURRENT — valid fallback** | npm `latest` = **0.5.30** (actively versioned). Repo `atinux/nuxt-auth-utils`: not archived, **pushed 2026-08-04**, updated 2026-09-12, 1,598 stars, MIT. Sealed-cookie sessions model fits AD-8 (server-enforced). Note: pre-1.0 and single primary maintainer — acceptable as *named fallback*, not primary. | registry.npmjs.org/-/package/nuxt-auth-utils/dist-tags; api.github.com/repos/Atinux/nuxt-auth-utils |
| 9 | **Supabase PostgreSQL 17 default** | **CURRENT** | Changelog: "New projects on Postgres **17.6.1.016** and later ship pgmq 1.5.1" (2025-10-08) — new projects are PG 17; self-hosted default image moved PG 15 → **17** on 2026-06-17; PG 14 support ended 2026-07-01 with auto-upgrades. No PG 18 offering visible in changelog through 2026-08. Spine's hedge ("konfirmasi major saat pembuatan project") is appropriate. | supabase.com/changelog |

## Findings — other named technology (directive item 3)

| Tech | Status | Evidence | Source |
|---|---|---|---|
| NuxtAuth (sidebase) 1.3.1 | **CURRENT** | npm `latest` = **1.3.1**; manifest peerDeps `next-auth ~4.21.1` ("menunggangi next-auth v4" ✓), dep `@nuxt/kit ^3.20.2` + description "Authentication built for Nuxt 3!" ("modul Nuxt 3" ✓). Publish ≈ 2025-06-30 — 14+ months old, consistent with the spine's mandatory smoke-test + fallback framing. | registry.npmjs.org/-/package/@sidebase%2Fnuxt-auth/dist-tags; registry.npmjs.org/@sidebase/nuxt-auth/1.3.1 |
| @react-pdf/renderer 4.9.0 | **CURRENT** | npm `latest` = **4.9.0**; `react` is a peerDependency (^16–^19), server usage supported ("browser and server"); built on pdfkit 0.20.1. | registry.npmjs.org/-/package/@react-pdf%2Frenderer/dist-tags; registry.npmjs.org/@react-pdf/renderer/4.9.0 |
| Nitro "bawaan Nuxt 4" | **CURRENT** | nuxt 4.5.2 depends on `@nuxt/nitro-server@4.5.2` — bundled, versioned with Nuxt. | registry.npmjs.org/nuxt/latest |
| reka-ui | **CURRENT** | npm `latest` = 2.10.4; relationship to shadcn-vue confirmed (row 1). | registry.npmjs.org/-/package/reka-ui/dist-tags |
| Tailwind (in new UI row) | **ADVISORY (see A-2)** | Row pins "versi saat scaffold" but no major stated. Current shadcn-vue Nuxt install path uses `tailwindcss` + `@tailwindcss/vite` → Tailwind **v4** idiom. Record major at scaffold. | shadcn-vue.com/docs/installation/nuxt |
| Resend/SMTP, Vercel + Vercel Cron | **Honest deferral** | Services, "pin saat scaffold"; no version assertion made. Cron-UTC behavior handled by AD-9's Asia/Jakarta in-endpoint rule. Not re-verified this run — acceptable. | — |
| Chart lib (Chart.js vs ECharts), decimal library | **Honest deferral** | Explicitly deferred/deferred-to-scaffold in spine; no version claims to verify. | — |

## Discrepancies & advisory notes

- **D-1 (MINOR, decision-neutral):** Drizzle row says "v1.0 di rc.5 per Sep 2026". Live dist-tags: promoted `rc` tag = **1.0.0-rc.4**; rc.5 exists only as a commit-suffixed canary (`rc5` → `1.0.0-rc.5-5935859`), not a clean release. The load-bearing assertions — 0.45.2 = latest stable, 1.0 **not GA**, re-check dist-tag at scaffold — are all correct. Suggest wording: "v1.0 di RC (rc.4 di tag `rc`; rc.5 hanya canary)".
- **A-1 (advisory):** Node 24 **active** support ends 2026-10-20 (≈5 weeks); it then enters maintenance LTS (security to 2028-04-30). Choice remains sound for Phase 1; note at scaffold in case a Node 26 LTS timeline matters later (26 is "Upcoming LTS", LTS designation Oct 2027; Nuxt engines already allow >=26).
- **A-2 (advisory):** Tailwind major unstated in the new UI row; current shadcn-vue Nuxt docs target Tailwind v4 (`@tailwindcss/vite`). The existing "pin versi saat scaffold" covers it, but record the major explicitly when pinning, since Tailwind v3↔v4 are not drop-in interchangeable.

## Assessment of the amended rows' honesty

1. **shadcn-vue row:** honest and correct. Copy-in registry systems cannot carry a meaningful dependency pin; "pin at scaffold" + contractual parity smoke-test (six named components, all confirmed to exist in current docs) in Nuxt 4 is exactly the right treatment given vendor docs don't specifically guarantee Nuxt 4.
2. **@vite-pwa/nuxt reworded claim:** honest. Every factual element verified verbatim against the manifest (`@nuxt/kit ^3.9.0`, "Zero-config PWA for Nuxt 3", last release Feb 2026) and the spine no longer overstates vendor support; go/no-go gate + fallback is properly framed.
3. **NuxtAuth fallback naming:** `nuxt-auth-utils` is real, maintained, and a credible fallback; "OAuth manual via route handler" remains a sound second fallback under AD-8.

**Gate recommendation: PASS.** Apply D-1 wording tweak opportunistically (not blocking); record Tailwind major at scaffold (A-2).
