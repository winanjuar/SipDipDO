# Tech Currency Review v2 — Verdict: MINOR-DISCREPANCIES

- **Reviewer lens:** tech-currency (web-researched vs asserted)
- **Target:** `ARCHITECTURE-SPINE.md` (status: final, updated 2026-09-15)
- **Method:** every named technology re-verified against primary sources (npm registry, vendor docs, GitHub, endoflife.date) on **15 Sep 2026** via live web fetch. No assertions from training data.
- **Result:** every version pin in the Stack table matches current reality. One compatibility claim (`@vite-pwa/nuxt` "kompatibel Nuxt 4 — terverifikasi Sep 2026") is not backed by any vendor-verifiable source and contradicts vendor metadata. No named library is deprecated, renamed, or security-advised. Verdict: **MINOR-DISCREPANCIES** — 1 MEDIUM, 3 LOW, 2 INFO.

## Verification table

| Technology | Spine claim | Verified reality (2026-09-15) | Source URL | Status |
| --- | --- | --- | --- | --- |
| Nuxt (Vue 3 + TS) | 4.x — "4.5.2 terverifikasi"; Node ≥ 22 | `latest` = **4.5.2**. Engines: `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0`. Toolchain now Vite 8 + Rolldown (`vite ^8.2.0`, `rolldown ~1.2.1`) | https://registry.npmjs.org/nuxt/latest | **CURRENT** — but Node floor is 22.19 specifically (see L1) |
| Vue 3 | via Nuxt | Nuxt 4.5.2 pins `vue ^3.5.40` | https://registry.npmjs.org/nuxt/latest | **CURRENT** |
| Nitro | bawaan Nuxt 4 | `@nuxt/nitro-server` 4.5.2 bundled in nuxt deps | https://registry.npmjs.org/nuxt/latest | **CURRENT** |
| Drizzle ORM | 0.45.x stabil; v1.0 sudah rc; pakai v1.0 bila GA, else 0.45.2 | `latest` = **0.45.2**. dist-tags: `beta` = 1.0.0-beta.22, `rc` = **1.0.0-rc.5** — v1.0 has progressed beta→rc since March 2026 but is **NOT GA** | https://registry.npmjs.org/drizzle-orm/latest + https://registry.npmjs.org/-/package/drizzle-orm/dist-tags | **CURRENT** — spine's conditional rule resolves to 0.45.2 today (see L3) |
| drizzle-kit | 0.31.x | `latest` = **0.31.10** | https://registry.npmjs.org/drizzle-kit/latest | **CURRENT** |
| postgres.js | "pin saat scaffold" | `latest` = **3.4.9** (actively maintained) | https://registry.npmjs.org/postgres/latest | **CURRENT** — pin 3.4.9 at scaffold |
| PostgreSQL @ Supabase | 17 — "konfirmasi major saat pembuatan project" | Supabase majors in circulation: **15 & 17** (upgrading docs' newest section is "Upgrading to Postgres 17"). **PG 18 hosted has NOT arrived**: feature request open & unanswered since Feb 2026; no PG 18 section anywhere in docs | https://supabase.com/docs/guides/platform/upgrading + https://github.com/orgs/supabase/discussions/42681 | **CURRENT** — hedge appropriate (see I1) |
| NuxtAuth (sidebase) | 1.3.1 + wajib smoke-test (dibangun di atas Nuxt 3) | `latest` = **1.3.1** (published ~Jun 2026 — actively maintained). Still Nuxt-3-based: deps `@nuxt/kit ^3.20.2`, `nitropack ^2.13.4`; peer `next-auth ~4.21.1` (optional); description: "Authentication built for Nuxt 3!" | https://registry.npmjs.org/@sidebase/nuxt-auth/latest | **CURRENT** — caveat verified accurate (see L2) |
| @vite-pwa/nuxt | 1.1.1 — "**kompatibel Nuxt 4 (terverifikasi Sep 2026)**" + smoke-test | `latest` = **1.1.1** (published ~Feb 2026 — no release since). README: "Zero-config PWA Plugin for **Nuxt 3**"; package deps `@nuxt/kit ^3.9.0`, devDeps `nuxt ^3.10.1`. **Vendor declares no Nuxt 4 support anywhere.** Underlying `vite-plugin-pwa ^1.2.0` must run under Nuxt 4.5's Vite 8/Rolldown stack — unconfirmed | https://registry.npmjs.org/@vite-pwa/nuxt/latest + https://github.com/vite-pwa/nuxt (README) | **DISCREPANCY** — "terverifikasi" claim unsourced; the 1.1.1 pin itself is current (see M1) |
| @react-pdf/renderer | latest stable 4.9.0; React = peer dep server-only, font di-bundle | `latest` = **4.9.0** (published ~Aug 2026). Peers `react ^16–^19`; no deprecation/advisory | https://registry.npmjs.org/@react-pdf/renderer/latest | **CURRENT** — React-in-Vue-server context addressed in spine (see I2) |
| Resend / SMTP | layanan — pin saat scaffold | Service alive, docs current (updated 2026); SMTP interface available alongside API | https://resend.com/docs/introduction | **CURRENT** |
| Vercel + Vercel Cron | layanan; "cron UTC" (AD-9) | Docs (last_updated 2026-08-11): "**The timezone is always UTC**"; triggers are HTTP GET; no day-of-month + day-of-week combination; no named days/months; 100 crons/project on every plan | https://vercel.com/docs/cron-jobs | **CURRENT** — spine's compute-day-boundaries-in-endpoint (Asia/Jakarta) design remains the correct workaround |
| Node | ≥ 22 | Node 22 LTS: **security-only** since 21 Oct 2025 (EOL 30 Apr 2027), latest 22.23.2. Node 24 LTS: active (until Oct 2026), latest 24.21.0. Node 26: "Upcoming LTS" (released May 2026) | https://endoflife.date/nodejs (updated 2026-09-10) | **CURRENT** w/ advisory (see L1) |
| Library chart (FR-18) | *Deferred* (lean ECharts) | Not pinned — correctly deferred to scaffold | — | **N/A** (deferred) |
| Greenfield starter defaults | Structural seed `app/` + `server/` + `shared/` | Matches Nuxt 4 directory conventions (`shared/` is a Nuxt 4 feature; `nuxi init` scaffolds Nuxt 4 today). Note: Nuxt 4.5's builder is now **Vite 8 / Rolldown** — relevant to M1 | https://registry.npmjs.org/nuxt/latest | **CURRENT** — no contradiction with live starter |

## Findings by severity

### MEDIUM

**M1 — `@vite-pwa/nuxt` "kompatibel Nuxt 4 (terverifikasi Sep 2026)" is an unsourced assertion.**
Vendor metadata contradicts the declaration: the package README still brands itself "Zero-config PWA Plugin for Nuxt 3" and requires "Vite 5 and Nuxt 3.9.0+" (from v0.4.0 note); deps are `@nuxt/kit ^3.9.0`; no release since Feb 2026. Meanwhile Nuxt 4.5.2's build stack has moved to Vite 8 + Rolldown, and the module's `vite-plugin-pwa ^1.2.0` dependency resolving correctly under Vite 8 is exactly the kind of thing that breaks silently. The spine's own adjacent caveat ("kompatibilitas 4 belum dinyatakan vendor; wajib smoke-test") is correct and honest — the "terverifikasi" phrase oversells it.
**Concrete fix (Stack table row only; AD-12 unchanged):** reword to `1.1.1 — kompatibilitas Nuxt 4 TIDAK dinyatakan vendor (modul Nuxt 3; @nuxt/kit ^3.9.0); gerbang go/no-go = smoke-test BUILD (generateSW) + install + prompt pembaruan di Nuxt 4.5 (Vite 8/Rolldown); fallback: vite-plugin-pwa langsung / SW kustom direviu terhadap AD-12`. Keep the 1.1.1 pin (it is the latest).

### LOW

**L1 — Node floor understated.** Spine says "Node runtime ≥ 22"; Nuxt 4.5.2's engines floor is **22.19.0**, and the Node 22 line is security-only maintenance until Apr 2027.
**Fix:** Stack row "Node runtime ≥ 22" → "Node 24 LTS (24.21.x) untuk dev/CI/Vercel; engines floor `>=22.19.0` per Nuxt 4.5.2".

**L2 — NuxtAuth residual risk worth a named fallback.** Pin 1.3.1 is current and the spine's Nuxt-3 caveat is verified accurate. Residual: it rides the legacy `next-auth ~4.21.1` (Auth.js v4) line and `nitropack 2.x` under Nuxt 4 — the mandatory smoke test is the right gate, but the spine names no plan B.
**Fix:** append to the same Stack cell: `fallback bila smoke-test gagal: nuxt-auth-utils atau OAuth manual via route handler (tetap memenuhi AD-8)`.

**L3 — Drizzle v1.0 is at rc.5, not GA; exact pins, not ranges.** The spine's conditional ("pakai v1.0 bila sudah GA, else 0.45.2") is accurate today and resolves to 0.45.2 — but rc cadence (rc.1→rc.5) suggests GA is near, and "0.45.x"/"0.31.x" ranges can drift.
**Fix:** pin exactly `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` at scaffold, and re-check the `latest` dist-tag that day; if 1.0.0 GA exists, take it per the spine's own rule and re-run migration smoke tests.

### INFO

**I1 — PG 18 not arrived on Supabase hosted.** Unanswered feature request (Feb 2026); upgrading docs cover only 15→17. The spine's "17 — konfirmasi major saat pembuatan project" is correct as-is; no change.

**I2 — React-library-in-Vue-server context is addressed.** The spine's parenthetical (React = peer dep server-only, fonts bundled) correctly scopes React to the server runtime of the Nuxt app — no React ships to the browser. Still the right pick vs alternatives (pdf-lib is too low-level for a versioned template; pdfkit is already a transitive dep of react-pdf). No change.

---

**Summary:** 12 named technologies + starter defaults verified live; 10 CURRENT, 1 DISCREPANCY (unsourced compat claim, not a version drift), 1 N/A (correctly deferred). No deprecated/renamed/security-advised libraries. Verdict: **MINOR-DISCREPANCIES**.
