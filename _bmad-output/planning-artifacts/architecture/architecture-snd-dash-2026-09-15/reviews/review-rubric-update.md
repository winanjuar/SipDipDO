# Rubric Review — AD-12/PWA Update — ARCHITECTURE-SPINE.md (snd-dash, 2026-09-15)

- **Reviewer:** spine rubric reviewer (good-spine checklist), independent context
- **Input:** `ARCHITECTURE-SPINE.md` (status final, updated 2026-09-15 with AD-12 + Platform row + 2 Do/Don't rows + @vite-pwa/nuxt stack row + Deferred offline-PWA rejection) + `../../ux-designs/ux-snd-dash-2026-09-15/EXPERIENCE.md` + `DESIGN.md` + `.memlog.md`
- **Method:** full-spine rubric walk; independent re-verification of every stack row against the npm registry (2026-09-15); mermaid render validation via mermaid-cli 11.17.0; cross-check of the EXPERIENCE.md sync line and posture table against AD-12/Platform row; regression check of all findings from the pre-final `review-rubric.md`

## Verdict: **PASS-with-fixes**

No Critical findings. The update is directionally right: AD-12 decides the platform/posture dimension at the right altitude, reinforces AD-2 instead of weakening it, and the EXPERIENCE.md sync line landed correctly. Two High findings (one is a regression introduced by the update itself: the deployment diagram no longer parses; the other is the one real enforceability hole in AD-12's cache scope), two Medium, four Low. All fixes are local edits; none reopen the paradigm, the AD set, or the stack.

---

## Rubric item 1 — Fixes the real divergence points for the level below; misses none

**PASS.** AD-1..AD-11 remain the seams that would split independently-built epics/stories (verified in the pre-final review; all its fixes are still present in the text — see regression check below). The update closes the one dimension that had been left to implication: platform posture. Without AD-12, an epic-owner team could have branched a mobile variant UI while another built desktop-only, or "PWA" could have been read as offline-capable. The rule's Prevents clause names all three real divergences: per-device code branches, stale domain numbers from SW cache, offline write queues as a second mutation path.

The remaining divergence surface for the platform dimension is the cache-scope boundary itself — see F2 (High) under item 2.

## Rubric item 2 — Every AD's Rule enforceable and actually prevents its stated divergence

**PASS with one hole, in AD-12.** AD-1..AD-11 all carry Binds/Prevents/Rule and are enforceable by structure (module boundaries + `index.ts`-only imports, single-transaction finalization with CAS + lock ordering, DB grants, shared pure module, numeric typing). Spot-rechecked post-update: AD-1 compensating-entry clause present; AD-2 CAS + lock order + all RKAP writers on the same phase lock + Fulfillment derived; AD-4 "tabel biasa … bukan PG MATERIALIZED VIEW"; AD-9 backup/PITR + restore drill + Asia/Jakarta day computation; AD-10 immutable RUPS snapshot + rounding-adjustment rows; AD-11 owner lifecycle single writer. Naming is now consistently plural (`buy_orders`, `audit_logs`). No edit in the update touched these adversely.

### [F2 · High] AD-12's cache scope ("cangkang aplikasi") is operationally undefined in an SSR app — a compliant-looking implementation can still produce AD-12's own stated divergence

In a SPA, "app shell" has a precise referent (the static document + hashed assets). In a **server-rendered Nuxt app it does not**: the HTML document is rendered per-request and **embeds domain data in markup and hydration payload** (a dashboard page's SSR HTML *is* rendered ownership numbers). Two teams can both comply with the Rule as written and diverge exactly the way the Prevents clause forbids:

- Team A reads "aset statis dan cangkang aplikasi" as: precache `/_nuxt/**` hashed build assets + icons + manifest. Safe.
- Team B reads "app shell" classically and additionally runtime-caches navigation HTML (e.g., stale-while-revalidate) so the app "boots" offline-style. Once a new transaction finalizes, a revisiting owner can be served the **cached SSR HTML with stale Quantity/Shares/Strength** on first paint — precisely "service worker menyajikan angka domain … yang usang setelah transaksi baru". The mitigating sentence ("seluruh data domain selalu diambil daring saat halaman dimuat") does not close this hole for SSR pages, whose initial data arrives *in* the document, not via a client fetch.

Related unspecified corner: EXPERIENCE.md's global unreachable state ("'Tidak dapat terhubung.' + Coba lagi. Tanpa dukungan offline", EXPERIENCE.md Empty & Error states) requires the SW to serve **some** offline fallback document — otherwise the user sees the browser's native offline error, not the app's状态. The Rule neither names this fallback nor constrains what it may contain.

**Fix (one clause in AD-12, mirrored in the Platform row, the Do/Don't row, and the stack row):** define the cache boundary operationally rather than by analogy —
- Precache allowlist: hashed build assets (`/_nuxt/**`), icons, manifest, **plus one static offline-fallback route containing no domain data**.
- Navigation (HTML document) requests: always network-first / online-only; never served from cache except the static offline fallback.
- No runtime caching of HTML or API responses, ever. (Optionally pin `registerType: 'autoUpdate'` so post-deploy updates are not a per-team choice.)

### [F7 · Low, carry-over] Island data transport still unspecified

Server-passed props vs client fetch of API routes for the preview island and charts — below altitude, but theDeferred section gained entries in this update and still does not carry this one. One line closes it.

## Rubric item 3 — Nothing under Deferred could let two units diverge

**PASS with one stale entry.** The new "PWA baca luring — ditolak" entry is exemplary: a rejection *with* a revisit condition ("dipertimbangkan ulang hanya bila muncul kebutuhan nyata akses tanpa sinyal") — no team can build on it divergently. RLS, staging, i18n, module extraction, FR-2 all remain safely conditioned.

### [F3 · Medium] Deferred entry "Seluruh keputusan UX/UI — DESIGN/EXPERIENCE docs (`bmad-ux`) belum dibuat" is now false and contradicts the spine itself

The spine's own `sources:` frontmatter cites `EXPERIENCE.md`; AD-12's Binds cites "EXPERIENCE.md (Foundation & Postur)"; both UX docs exist (written today, after the spine was first finalized). Worse, the sub-item "Jangka waktu kedaluwarsa pendaftar (FR-22) ditetapkan di tahap UX" **has been decided**: EXPERIENCE.md (Empty & Error states, registration flow) sets "kedaluwarsa 7 hari tanpa Profile lengkap (keputusan UX atas TODO FR-22)". A story author who reads Deferred but not sources could treat ratified UX decisions (posture breakpoint, empty states, the 7-day registration expiry) as still open and re-derive different ones.

**Fix:** rewrite the entry to reflect reality, e.g. "Keputusan UX/UI kini diatur `EXPERIENCE.md`/`DESIGN.md` (ratifikasi platform via AD-12); asumsi terbuka yang tersisa di sana (locale id-ID, pengingat H-3) dituntaskan saat story terkait" — and delete the resolved FR-22 sub-item.

### [F5 · Low] Chart library deferral's trigger has been consumed without a decision

"pilihan … menyusul bersama desain visual di `bmad-ux`" — `bmad-ux` has now run (DESIGN.md exists, even defines the chart color palette) and picked no library. The deferral now has no trigger and no owner. Contained within FR-18 (one capability), hence Low. **Fix:** re-anchor — "ditetapkan di story FR-18 sebelum implementasi; satu keputusan untuk seluruh produk (kecenderungan ECharts belum mengikat)".

## Rubric item 4 — Named tech verified-current

**PASS.** Independently re-verified against the npm registry on 2026-09-15:

| Claim in spine | Registry (2026-09-15) | Result |
| --- | --- | --- |
| Nuxt 4.x (4.5.2) | latest 4.5.2 (2026-08-05) | ✓ exact |
| Drizzle ORM 0.45.x, "v1.0 sudah rc — pakai v1.0 bila sudah GA" | latest 0.45.2; v1.0.0-rc.4/rc.5 exist, GA not yet | ✓ "sudah rc" is true; GA-at-scaffold instruction sound |
| drizzle-kit 0.31.x | latest 0.31.10 | ✓ |
| @sidebase/nuxt-auth 1.3.1 | latest 1.3.1 | ✓ exact |
| **@vite-pwa/nuxt 1.1.1 (Feb 2026)** | latest 1.1.1 (2026-02-06) | ✓ exact |
| @react-pdf/renderer 4.9.0 | latest 4.9.0 (2026-08-27) | ✓ exact |
| PostgreSQL 17 (Supabase) | memlog documents PG 18→17 correction with cited Supabase changelog | credible, unchanged |

### [F4 · Medium] Evidence double standard: @vite-pwa/nuxt gets an unqualified "kompatibel Nuxt 4" where NuxtAuth — same metadata profile — got a mandatory smoke-test caveat

npm metadata for `@vite-pwa/nuxt@1.1.1`: dependency `@nuxt/kit ^3.9.0`, **no `compatibility` field** — exactly the situation that earned the NuxtAuth row its "wajib smoke-test OAuth Google + session di Nuxt 4 saat scaffold (modul dibangun di atas Nuxt 3; kompatibilitas 4 belum dinyatakan vendor)" caveat. The vite-pwa row instead asserts compatibility as settled fact ("terverifikasi Sep 2026" via the modules directory). The claim is probably true (Nuxt 4 maintained module compatibility), but the spine should not apply two different evidence standards to the same risk: if the assumption breaks, PWA tooling fails mid-scaffold. **Fix:** add the same one-line scaffold smoke-test requirement to the @vite-pwa/nuxt stack row (build + `sw.js` generation + install on Nuxt 4.5.2).

## Rubric item 5 — Every owned dimension decided / deferred / open

**PASS.** Pre-update coverage was complete after the backup fix in AD-9. The update adds the one dimension previously implicit: **platform/posture** — decided (AD-12), echoed in a Platform convention row, a paradigm sentence, two Do/Don't rows with AD-12 as source, and a stack row. Operational/environmental envelope remains fully decided (AD-9: deploy target, region, pooler, runtime, cron + secret, day-boundary timezone, backups + drill, `local`+`production`). The only genuinely new sub-dimension the update leaves implicit — SW cache/update semantics — is F2 above.

## AD-12 specifically — enforceability, dual readings, conflicts with AD-1..AD-11

- **Enforceable as written?** The three prohibitions (no per-device code branches, no SW-served domain data, no offline write queue) are checkable review gates, and the Deferred entry prevents offline-read scope creep. The *positive* half — what the SW MAY cache — is the unenforceable part (F2, High): "cangkang aplikasi" permits both a safe and an unsafe implementation, and the unsafe one still looks compliant.
- **Two readings?** Yes, demonstrated: (a) cache-scope reading (assets-only vs shell-includes-HTML), and (b) the paradigm sentence "di laptop tetap situs responsif biasa" — a manifest + SW is served to every browser, and desktop Chrome/Edge *will* offer install; one team reads the sentence as posture description, another as a requirement to suppress desktop installs (F6, Low). 
- **Conflicts with / weakening of AD-1..AD-11?** None found — the opposite: AD-12 explicitly reinforces AD-2 (offline write queue rejected as a second mutation path), is consistent with AD-8 (no data/auth material cached → access stays server-bound), AD-6 (asset caching doesn't touch the single formula implementation), and AD-9 (SSR deploy on Vercel unchanged; PWA is additive). Binds (§6.1, UJ-1/2/6, Non-Goals §5) are coherent — installable-by-browser is not a native app, so the Non-Goal holds.

### [F6 · Low] "di laptop tetap situs responsif biasa" is a posture statement, not an enforceable constraint

As above. **Fix:** one clarifying clause — install prompts are browser-native on all platforms; no custom logic to suppress or encourage installation on any posture.

### [F8 · Low] Install affordance UX unspecified anywhere

Neither EXPERIENCE.md nor the spine says whether any in-app install button / `beforeinstallprompt` handling exists, or whether installation is purely browser-native. Two stories could diverge (one builds an install CTA, one doesn't). **Fix:** one line in AD-12 or a Deferred entry ("tanpa UI pemasangan kustom — andalkan prompt native peramban" or the opposite, whichever is intended).

## Mermaid diagrams — **FAIL on one of three** (regression introduced by this update)

Rendered with mermaid-cli 11.17.0: AD-5 dependency graph ✓, ERD ✓, but:

### [F1 · High] Deployment topology diagram no longer parses — the update's "(PWA installable)" label breaks it

```text
HP[Browser owner/COO — HP (PWA installable) / desktop]
```

Unquoted parentheses inside a square-bracket flowchart label are a mermaid parse error (isolated and confirmed: the same label without parens, or quoted, renders). This regresses the pre-final review's F0 fix — the subgraph error was removed, and a new syntax error was introduced in the same block. **Fix** (verified to render):

```text
HP["Browser owner/COO — HP (PWA installable) / desktop"]
```

## EXPERIENCE.md sync check

Consistent. Foundation line: "Data luring tidak didukung — PWA installable di HP hanya menyimpan cache aset statis, seluruh data selalu daring (AD-12 spine arsitektur)"; Empty & Error states: "'Tidak dapat terhubung.' + Coba lagi. Tanpa dukungan offline"; posture table matches the Platform row verbatim (single `lg` breakpoint, "Semua alur tetap fungsional di kedua postur"). No contradiction found between the two documents.

## Regression check — pre-final review findings

| Prior finding | Status in updated spine |
| --- | --- |
| F0 deployment mermaid syntax | prior fix present, **new error introduced by this update** (→ F1 here) |
| F1 compensating entries (AD-1) | fixed, intact |
| F3 AD-4 plain table vs MATERIALIZED VIEW | fixed, intact |
| F8 backups/PITR in AD-9 | fixed, intact |
| F4 audit carve-out in AD-5 | addressed via diagram edge `-.->|tulis only| AUDIT` + "akses lintas modul lewat API/ekspor" — acceptable |
| F6 plural table names | fixed, intact |
| F7 NuxtAuth Nuxt 4 smoke-test caveat | fixed, intact — but see F4 (same standard not applied to @vite-pwa/nuxt) |
| F2 island data transport | **not addressed** (→ F7 here) |
| F5 decimal-lib vs integer-sen "atau" | not addressed; contained inside `shared/domain` per AD-6, no spine change required |

## Findings summary

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F1 | High | Deployment mermaid diagram fails to parse — unquoted parens in `HP[…(PWA installable)…]` label (update regression) | Quote the label: `HP["…"]` |
| F2 | High | AD-12 "cangkang aplikasi" undefined in SSR; cached-HTML reading serves stale domain data (the very divergence AD-12 prevents); offline fallback page unspecified | Precache allowlist = hashed assets + icons + manifest + one static no-data offline route; navigations online-only (fallback excepted); no runtime caching of HTML/API; pin `registerType` |
| F3 | Medium | Deferred claims UX docs "belum dibuat" while `sources`/AD-12 bind EXPERIENCE.md; FR-22 7-day expiry already decided there | Rewrite entry: UX decisions now governed by EXPERIENCE/DESIGN; list only remaining open assumptions |
| F4 | Medium | @vite-pwa/nuxt built on `@nuxt/kit ^3.9.0`, no compat field — same profile as NuxtAuth but no smoke-test caveat | Add scaffold smoke-test requirement to the stack row |
| F5 | Low | Chart-lib deferral trigger (bmad-ux) consumed, no decision, no new trigger | Re-anchor: decided in FR-18 story before implementation |
| F6 | Low | "Di laptop tetap situs responsif biasa" unenforceable; desktop browsers will offer install | State prompts are browser-native; no suppress/encourage logic |
| F7 | Low | Island data transport still unspecified (carry-over) | One Deferred line |
| F8 | Low | Install affordance UX (custom CTA vs native prompt) unspecified | One line in AD-12 or Deferred |

All fixes are local edits; none reopen the paradigm, the AD set, or the stack. Apply F1–F4 before handing the spine to epic/story authors.
