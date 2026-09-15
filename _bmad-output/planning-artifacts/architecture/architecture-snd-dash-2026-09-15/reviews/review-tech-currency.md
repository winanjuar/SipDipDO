# Technology-Currency Review — Architecture Spine (snd-dash)

- **Lens:** technology-currency (architecture review gate)
- **Target:** `../ARCHITECTURE-SPINE.md` (Stack table + AD-9/AD-10, "SEED — terverifikasi web Sep 2026")
- **Review date:** 2026-09-15
- **Method:** live web verification of each load-bearing pin via npm registry manifests and dist-tags, vendor docs, changelogs, and official documentation. Publication timestamps estimated from npm registry operational metadata.
- **Verdict:** **DISCREPANCIES** — all named technologies exist and the pinned lines are current; **no blocking mismatch**. Two claims are stale or asserted-without-evidence (Drizzle v1 status, NuxtAuth × Nuxt 4 pairing) and several rows carry under-specified caveats worth recording before scaffold.

---

## 1. Pin-by-pin verification

| Spine claim | Live status (2026-09-15) | Result | Evidence |
| --- | --- | --- | --- |
| Nuxt 4.x | `latest` = **4.5.2** (published ~2026-08-05); 4.x is the current major | ✅ VERIFIED | registry.npmjs.org/nuxt/latest |
| Nitro "bawaan Nuxt 4" | Ships with Nuxt (4.5.2 bundles `@nuxt/nitro-server@4.5.2`) | ✅ VERIFIED | nuxt manifest dependencies |
| Drizzle ORM 0.45.x (v1.0 beta — jangan dipakai) | `latest` = **0.45.2** ✓ — but v1.0 is no longer "beta": `beta` tag = 1.0.0-beta.22, **`rc` tag = 1.0.0-rc.5**, roadmap shows "v1.0 release 98%" | ⚠️ STALE NOTE | registry dist-tags; orm.drizzle.team |
| drizzle-kit 0.31.x | `latest` = **0.31.10** (published ~2026-05-04) | ✅ VERIFIED | registry.npmjs.org/drizzle-kit/latest |
| PostgreSQL 17 on Supabase | PG 17 is the hosted platform's current major (Oct 2025 changelog: "new projects on Postgres 17.6.1.016 and later"; May 2026: self-hosted default image moved 15→17; PG 14 support ended 2026-07-01; **no PG 18 hosted announcement through Aug 2026**). Upstream PG current major is 18 (18.6; 19 beta 3 released 2026-08-13) — Supabase lags upstream | ✅ VERIFIED (with caveat, see §3.4) | supabase.com/changelog; postgresql.org |
| Supabase region Singapore (ap-southeast-1) | Available both as specific region `ap-southeast-1` and as the APAC *general* region ("Southeast Asia (Singapore)") | ✅ VERIFIED | supabase.com/docs/guides/platform/regions |
| NuxtAuth sidebase 1.3.1 (Google OAuth / Auth.js) | `latest` = **1.3.1** (published ~2026-06-30), docs site current at 1.3.1 — **but module is built and tested against Nuxt 3** (deps `@nuxt/kit ^3.20.2`, devDeps `nuxt ^3.20.2`; README/docs say "Nuxt 3+"). No first-party Nuxt 4 compatibility statement found | ⚠️ PARTIAL — see §3.2 | registry manifest; auth.sidebase.io; github.com/sidebase/nuxt-auth |
| @react-pdf/renderer "latest stable — pin saat scaffold" | `latest` = **4.9.0** (published ~2026-08-27); actively maintained; pure-JS (pdfkit-based, no native deps); tagline "Create PDF files on the browser and server" | ✅ VERIFIED (fitness caveats, §3.3) | registry.npmjs.org/@react-pdf/renderer/latest |
| Resend / SMTP (service, unpinned) | Not verified — explicitly deferred to scaffold by the spine | ➖ NOT CHECKED (acceptable deferral) | — |
| Vercel + Vercel Cron | Cron jobs exist, included on **all plans**, 100 jobs/project on every plan; **Hobby minimum interval = once per day** (docs updated 2026-07/08) | ✅ VERIFIED | vercel.com/docs/cron-jobs, /docs/cron-jobs/usage-and-pricing |
| postgres.js (named in review request; spine only says "via connection pooler") | `latest` = **3.4.9** — current, maintained | ✅ EXISTS (spine doesn't pin it — see §3.6) | registry.npmjs.org/postgres/latest |
| Chart.js / ECharts (deferred) | Explicitly deferred to `bmad-ux` | ➖ N/A | spine §Deferred |
| `numeric(18,2)` on PG 17 | `numeric(precision, scale)` is standard on all supported PG majors incl. 17; PG docs confirm numeric "especially recommended for storing monetary amounts"; rounds ties away from zero (= half-up), matching AD-10's half-up presentation rule | ✅ VERIFIED | postgresql.org/docs/current/datatype-numeric.html |

## 2. Fitness sanity checks

- **@react-pdf/renderer on Vercel serverless/Node:** Fits. Dependency tree is pure JS (`pdfkit` 0.20.1 + `@react-pdf/*` packages), no native addons, explicit server rendering support. No vendor "runs on Vercel" statement was located — evidence is structural (no native deps + server mode), which is strong but indirect. Two caveats to carry into scaffold: (a) it takes **React ^16–^19 as a peer dependency** — in a Nuxt app React must be a server-only dependency and kept out of the client bundle; (b) custom fonts (e.g., for the Template Konfirmasi v3 layout) must be bundled/shipped with the function, since serverless filesystems are ephemeral.
- **Vercel Cron for AD-9's daily jobs:** Fits exactly. Hobby plan's once-per-day minimum interval matches both jobs (order day-7 expiry FR-19, registrant reminders FR-22) at day granularity. Two operational truths the spine should absorb: cron expressions are **UTC-only**, and Hobby timing precision is **±59 minutes** — so day-boundary logic ("hari ke-7" in Asia/Jakarta terms) must be computed inside the endpoint against timestamptz data, never trusted to the cron clock.
- **Nuxt 4.5.2 engines:** `node ^22.19.0 || ^24.11.0 || >=26.0.0` — the Vercel functions Node runtime must be pinned to a满足 version (22.x latest or 24.x) at scaffold, or builds will warn/fail.
- **Drizzle `numeric` returns strings** by default — AD-10's "decimal library or integer-sen operations in shared/domain" rule already covers this correctly; no change needed, noted for awareness.
- **Supabase pooler:** Supavisor transaction mode (port 6543) is the right target for serverless; session mode on 6543 was deprecated Feb 2025. The spine's "via connection pooler" is correct; pair with `postgres.js` + `prepare: false` on transaction mode.

## 3. Discrepancies & findings

### 3.1 Drizzle v1.0 status note is stale — severity MEDIUM (informational risk, not a wrong pin)

The spine's parenthetical "v1.0 beta — jangan dipakai" is out of date. Live dist-tags: `beta` = 1.0.0-beta.22 and **`rc` = 1.0.0-rc.5**, with the vendor roadmap showing v1.0 at 98%. The stable recommendation (0.45.x, actual latest 0.45.2) is still correct **today** — an RC is not GA — but GA looks imminent, and v1.0 is a substantial rewrite (kit rewrite, folders-v3 migrations, RQB v2, validator packages folded into core). A greenfield project pinning 0.45.x at scaffold could face a 0.x→1.0 migration weeks after launch.

**Suggested correction:** replace the note with: "v1.0 pada tahap RC (1.0.0-rc.5), GA terhitung dekat — saat scaffold: jika v1.0 sudah GA, mulai dari v1.0; jika belum, pin 0.45.2 dan jadwalkan migrasi v1." Re-check the tag at scaffold time (one `npm dist-tag ls drizzle-orm` away).

### 3.2 NuxtAuth 1.3.1 × Nuxt 4 pairing asserted as verified but not evidenced by vendor — severity MEDIUM

Version pin is exact and current (1.3.1 is `latest`). However, every first-party artifact still targets Nuxt 3: package deps `@nuxt/kit ^3.20.2` / `nitropack ^2.13.4`, devDeps and playgrounds on `nuxt ^3.20.2`, README and docs headline "Nuxt 3+". No compatibility statement, release note, or docs page affirming Nuxt 4 support was found. It plausibly works (Nuxt deliberately keeps Nuxt-3-era module compat), but the spine's blanket "terverifikasi web Sep 2026" covers a pairing the vendor has not itself confirmed.

**Suggested correction:** add a scaffold gate to AD-8/Stack: smoke-test Google OAuth sign-in + session access + middleware on Nuxt 4.5 before committing to sidebase; record the tested (nuxt, nuxt-auth, next-auth ~4.21.1) triple in the lockfile. If it fails, the fallback decision (waiting on sidebase vs. adopting Auth.js directly) should be made at scaffold, not mid-build.

### 3.3 @react-pdf/renderer — unpinned row + docs-domain drift — severity LOW

Package verified current (4.9.0) and server-capable. Two notes: (a) the former docs domain `react-pdf.dev` now fronts an **unrelated commercial product ("React PDF Kit")** — any scaffold-time doc lookup should use `github.com/diegomura/react-pdf` as the canonical source to avoid grabbing the wrong library; (b) carry the React-peer-dep and font-bundling caveats from §2 into the scaffold checklist. The spine's "pin saat scaffold" intent is right; make sure the pin lands in `package.json` as an exact version.

### 3.4 Supabase PG 17 — verified, but evidence is inferential — severity INFO

No authoritative "current Postgres version" doc page was reachable (two candidate URLs 404). PG 17 as the hosted default is inferred from dated changelog entries (new projects on 17.6.1.016+ since Oct 2025; self-hosted default image 15→17 in May 2026; PG 14 EOL Jul 2026; zero PG 18-hosted announcements through Aug 2026). Upstream PostgreSQL's current major is 18 — expect Supabase to offer 18 at some point, but "17" matches what a new project created today actually receives. **Suggested correction:** none to the pin; add one line to the scaffold checklist to confirm the offered PG major at project creation (dashboard shows it) — if 18 is suddenly offered, the spine's AD-10 types (`numeric(18,2)`, `uuid`, `timestamptz`, row locks in AD-2) are all unaffected by the major bump, so the choice is low-risk either way.

### 3.5 Vercel Cron timezone/precision not reflected in AD-9 — severity LOW

Cron is UTC-only and Hobby precision is ±59 min. AD-9's day-granularity jobs tolerate the drift **only if** expiry/reminder decisions are recomputed inside the endpoint from `timestamptz` in Asia/Jakarta terms. **Suggested correction:** append to AD-9: "Endpoint cron menghitung batas hari dalam Asia/Jakarta dari data timestamptz — tidak bergantung pada jam trigger cron (UTC, presisi ±59 menit di Hobby)."

### 3.6 PG driver named in neither Stack table nor AD-9 — severity LOW

The spine says "via connection pooler" but never names the Node driver, while the review request names postgres.js. `postgres` (postgres.js) 3.4.9 is current and is the standard Drizzle pairing for Supabase transaction-mode pooler. **Suggested correction:** add a Stack row "postgres.js (driver Drizzle) — pin saat scaffold" so the driver choice is a committed decision rather than an implicit one.

### 3.7 Nuxt Node engines vs Vercel runtime — severity INFO

Nuxt 4.5.2 requires Node ^22.19.0 || ^24.11.0 || >=26. Add to scaffold checklist: pin the Vercel project's Node runtime (22.x/24.x) in project settings or `engines`.

### 3.8 Resend/SMTP — acceptable deferral — severity INFO

Left as a service row to pin at scaffold; no currency check performed. Resend remains a live commercial service per general knowledge; verify plan/pricing and DNS (SPF/DKIM) setup at scaffold.

## 4. What was checked and passed clean

- Nuxt 4.x current major (4.5.2) — pin range "4.x" is safe; exact pin at scaffold.
- drizzle-kit 0.31.x (0.31.10 latest) — matches.
- Drizzle ORM stable line 0.45.x (0.45.2 latest) — matches (note stale v1 comment, §3.1).
- Supabase Singapore ap-southeast-1 — exists; note the new "general region" APAC default also lands in Singapore, which satisfies the latency intent either way.
- Vercel Cron existence, daily granularity on Hobby, 100 jobs on all plans — matches AD-9 exactly.
- `numeric(18,2)` exists on PG 17 (and every supported major); PG's tie-rounding (away from zero) is consistent with the half-up presentation convention in AD-10.
- postgres.js exists and is current (3.4.9) if adopted as the driver.
- Chart.js/ECharts correctly deferred with no stale claims.

## 5. Bottom line

The stack table is substantially accurate — every named technology exists, every pinned version line is the live stable line, and the two services (Vercel Cron, Supabase SG) behave as AD-9 assumes. The "terverifikasi web Sep 2026" label overclaims in exactly two cells: the Drizzle note describes a state (beta) that has since advanced to RC with GA imminent, and the NuxtAuth row pairs a Nuxt-3-built module with Nuxt 4 without vendor confirmation. Both are cheap to fix (a rewritten note + a scaffold smoke-test gate), and neither invalidates an architecture decision.
