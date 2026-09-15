# Rubric Review v3 — Architecture Spine (Sip & Dip Ownership Dashboard, Phase 1)

**Reviewer:** rubric-walker (good-spine checklist) · **Date:** 2026-09-15 · **Target:** `ARCHITECTURE-SPINE.md` (post-fix re-gate: AD-2 lock ladder + `withdrawn_at` canonical pending; AD-5/AD-8 OTP via tx; AD-6 per-gate assemblies; AD-7 price unique; AD-8 closed MFA set + tenure in-tx + canonical predicates; AD-10 wire contract; AD-11 pendaftaran enum + CAS; AD-12 runtime freshness; Stack/conventions/Do-Don't/extensions)

## Verdict

**PASS-with-fixes.** All six v2 findings landed and landed well: H-1 is fixed three ways (Stack row + Platform convention + two-way sync into EXPERIENCE.md Foundation and DESIGN.md Components, both now naming shadcn-vue/reka-ui as the Vue implementation of the contract); M-1 is fixed at the right altitude (pendaftaran folded into the AD-11 enum with CAS and the identical-race framing as orders); L-1..L-4 are each addressed by the suggested clause. The new material is genuinely load-bearing, not padding: the global lock ladder closes the finalization-vs-rekap AB-BA deadlock and is stated bidirectionally (AD-2 ↔ AD-11 ↔ Do/Don't), the `withdrawn_at` canonical-pending definition is repeated at every consumption point (AD-2, AD-6 assembly, Data & format, Do/Don't) with no drift, the closed MFA set matches PRD/Glossary/UX exactly, the AD-10 "all finalized-not-yet-tunaikan periods" recap rule correctly resolves the cut-off-vs-ditunaikan ambiguity in FR-10/FR-16, and the "effective-only RKAP space vs pending-counting Strength" asymmetry now has one canonical home (AD-6) matching FR-1/FR-23. I found no regression in the amended ADs, mermaid blocks, conventions, or Stack honesty (NuxtAuth/@vite-pwa caveats and fallbacks parallel; Drizzle exact pins consistent). One new medium and four lows remain — all cheap, localized clauses; none destabilizes the paradigm.

## Verification of prior findings (v2 → now)

| v2 | Status | Evidence |
| --- | --- | --- |
| H-1 UI substrate (shadcn React vs Vue) | **Fixed** | Stack row "shadcn-vue (primitif reka-ui) + Tailwind … smoke-test paritas (Dialog/Sheet/Tooltip/Drawer/Input-OTP/Toast)"; Platform convention; EXPERIENCE.md Foundation "*Implementasi Vue: shadcn-vue … nama & perilaku komponen kontrak tetap.*"; DESIGN.md Components "Implementasi: shadcn-vue (primitif reka-ui) + Tailwind … (spine arsitektur AD/Stack)". Two-way sync done. |
| M-1 pendaftaran lifecycle | **Fixed** | AD-11: pinned enum `diajukan/terverifikasi/ditolak/kedaluwarsa/keluar`, IDENTITAS single writer, every transition CAS in one tx, "race tiga penulis yang dijaga CAS yang sama dengan AD-2", kedaluwarsa = stored status set by cron, re-daftar allowed, expiry in audit; mirrored in Data & format. Residual edges → L-3. |
| L-1 dual money-arithmetic idioms | **Fixed** | AD-10: "decimal library (satu mekanisme, dipin dan dicatat saat scaffold; campuran idiom integer-sen dilarang)" — the fork is closed, not just chosen. |
| L-2 sources missing DESIGN.md | **Fixed** (new nit) | DESIGN.md now in sources — but the PRD path is off by one level → L-1 below. |
| L-3 error tracking / SPF-DKIM silence | **Fixed** | Two explicit Deferred entries with reasons ("retry outbox … wajib terlihat, bukan kegagalan senyap"; "deliverabilitas load-bearing"), echoed in Stack Resend row. |
| L-4 OTP attempt-limit placement | **Fixed, with a new gap** | AD-8 adds the clause — but its interaction with verify-inside-finalization-tx leaves attempt counting mechanically homeless → M-1 below. |

## Findings by severity

### Critical

None.

### High

None.

### Medium

**M-1 — OTP wrong-attempt accounting has no durable home under verify-inside-finalization-tx.**
**Location:** AD-8 ("verifikasi dan konsumsi terjadi di DALAM transaksi finalisasi … rollback re-validasi mengembalikan konsumsi"; "attempt-limit dan resend-cooldown (60 detik) dienforce server-side pada jalur `requestOtp`"), AD-5.
The in-tx verify+consume with rollback-restore is the right design for *re-validation* failures (retry without a new email). But a *wrong-code* attempt also rolls back the whole finalization tx — so any attempt-counter increment written inside that tx is lost. Meanwhile the only placement sentence puts attempt-limit on the `requestOtp` path, while attempts occur at verify. A story pair (OTP request/dialog story vs konfirmasi/input-langsung service story) can each assume the other counts attempts; the failure is silent and sits on the MFA channel that gates every money write. Secondary: cooldown 60s is pinned, but TTL (10 menit) and max attempts remain untagged UX `[ASSUMPTION]`s with no spine anchor.
**Fix:** One clause in AD-8: wrong-attempt counting is its own committed CAS increment on `otp_codes` (or a dedicated verify step) outside the finalization tx — rollback of finalization must never erase attempt counts; pin TTL/attempt values or declare them configuration per UX.

### Low

**L-1 — PRD source path off by one level.**
**Location:** Frontmatter `sources`.
`'../prds/prd-snd-dash-2026-08-14/prd.md'` resolves to `planning-artifacts/architecture/prds/…`, which does not exist (verified against the tree); both UX paths correctly use `'../../'`. Introduced when sources were extended for L-2/v2. **Fix:** `'../../prds/prd-snd-dash-2026-08-14/prd.md'`.

**L-2 — AD-6 pins the "harga 1 saham berjalan" assembly to "momen finalisasi" only.**
**Location:** AD-6 canonical assemblies.
The same running-price resolution is needed at submit (FR-1 Quantity maksimal ÷ harga berjalan), input langsung (FR-21, harga berjalan tanggal input), and the non-finalization RKAP writers that re-validate the aggregate adjustment limit in-tx (penyesuaian manual, Capital Item baru, rebalancing — AD-2). The parenthetical under-scopes the assembly's use sites. **Fix:** define it as "harga berjalan pada tanggal/momen evaluasi" parameterized by the calling gate (AD-7's unique constraint already makes resolution deterministic for any date).

**L-3 — Two pendaftaran edge semantics left open inside the otherwise-complete AD-11 fix.**
**Location:** AD-11.
(a) The three-writer race is "dijaga CAS yang sama dengan AD-2" — but Profile *kelengkapan* is not a status, so CAS alone cannot guard it; the rule "COO tidak dapat memverifikasi Profile belum lengkap" needs an in-tx completeness re-check at verification (same pattern as the AD-8 `coo_tenures` in-tx check), which is not stated. (b) "Re-daftar diperbolehkan" is data-model-silent: CAS transition `ditolak/kedaluwarsa → diajukan` on the same owners row, or a new row? Registration story vs Manajemen Owner/audit story can model it differently. **Fix:** one sentence each in AD-11.

**L-4 — ERD cardinality understates rekap rincian.**
**Location:** Structural Seed ERD.
`profit_distributions ||--o| owners : "rincian per owner"` reads as at-most-one owner detail per rekap; AD-10's snapshot text (rincian per owner + remainder adjustment rows) requires one-to-many. Seed-level nit (invariants correctly live in AD-10). **Fix:** junction/detail relation or `||--o{`.

## Checklist walk (evidence)

1. **Divergence coverage FR-1..FR-23 + UX platform contract** — FR-1 (AD-2 CAS, AD-6 assemblies incl. pending-counting Strength, AD-7 lock), FR-3 (AD-8 closed MFA set + OTP binding `{action_type, target_ref}`), FR-4/5/18 (AD-1/4, AD-6 chart-percentage assemblies; chart lib deferred with UX final), FR-6/7 (AD-7 unique-per-(jenis, tanggal) + in-place correction; MoM ownership HARGA per AD-5 + ERD), FR-8/9/10 (AD-5, `contribution_periods` in lock ladder; cut-off explicitly outside MFA set — matches PRD), FR-11 (outbox in-tx + Bukti at transaction cut-point, regen deterministic), FR-12 (AD-3), FR-13/15/17 (AD-8/11, `coo_tenures` in-tx authority = pejabat at commit), FR-14 (Migrasi: full finalization door, no migration outbox emails, forwarded-vs-suppressed event list tested at acceptance), FR-16 (AD-6 formulas, AD-10 snapshot + all-outstanding-periods recap + remainder rows, AD-11 flip re-validating `shares = 0` in-tx per ladder), FR-19 (canonical-pending guard on every writer incl. cron; penarikan = `withdrawn_at` transition; hari-7 Asia/Jakarta), FR-20/21 (AD-2 single tx incl. payment fields on `ledger_transactions`, plotting, overshoot, audit; first-confirm wins), FR-22 (AD-11 pendaftaran enum/CAS; referral predicates canonical; cross-referral split machine/COO), FR-23 (AD-2 ladder covers all five RKAP writer families with in-tx aggregate re-validation; Fulfillment derived from plotting, not dual-written; L-2 nit on price-assembly moment). Platform contract: AD-12 two postures + installed=viewport + cache boundary + runtime freshness; substrate shadcn-vue decided (H-1 fixed).
2. **AD quality** — all 12 ADs carry Binds/Prevents/Rule; amended rules remain enforceable (unique constraint, CAS guards, global lock ladder with no cycle — finalization: buy_orders→rkap_phases→positions→owners; rekap continues positions→owners→contribution_periods→distribution; no family takes locks out of order) and each demonstrably blocks its stated divergence. New closed-set rule ("mengubah himpunan = mengubah AD ini") is a model of enforceability. Sole rule-level gap: M-1 (attempt accounting).
3. **Deferred safety** — chart lib, error tracking, SPF/DKIM, staging, RLS, offline-PWA, i18n, Phase 2, service split: all scaffold-time or justified refusals with reasons; nothing permits inter-story divergence. NuxtAuth/@vite-pwa fallbacks are decisions-with-gates, not open forks.
4. **Version pins, internal consistency** — Node 24 LTS / floor ≥22.19.0 consistent AD-9 ↔ Stack; Drizzle exact pins with GA-check rule; postgres.js 3.4.9; NuxtAuth 1.3.1 and @vite-pwa/nuxt 1.1.1 caveats honest and parallel; react-pdf server-only peer dep marked; one inconsistency found (L-1 path). (Currency = tech-currency lens, per prior reviews.)
5. **Greenfield seed** — Stack/tree/module shape/ERD marked seed ("kode memiliki versi ini begitu ada"); ERD relations-only with invariants in ADs; L-4 is a seed nit only.
6. **Spec-driven coverage** — PRD FRs and UX platform/visual contract fully covered post-fix; sources two-way synced (bar L-1).
7. **Dimension sweep** — table below; every dimension decided or explicitly deferred; no open rows remain.
8. **Parent spine** — none (initiative altitude); N/A.

## Dimension sweep

| Dimension | Status | Where |
| --- | --- | --- |
| Paradigm & deployment topology | Decided | Design Paradigm, AD-9 |
| Data model & table ownership | Decided | AD-5, ERD (seed; L-4 nit) |
| Transactional consistency & races | Decided | AD-2 (ladder + canonical pending), AD-4, AD-11, tx-handle convention |
| Audit | Decided | AD-3 |
| Domain-logic placement & precision | Decided | AD-6 (single mechanism per assembly; L-2 nit), AD-10 (decimal-library-only + wire contract) |
| Pricing semantics | Decided | AD-7 (unique per jenis+tanggal) + Migrasi convention |
| Access, auth, MFA | Decided (attempt-accounting gap M-1) | AD-5, AD-8 (closed set, tenure in-tx, OTP binding) |
| Owner & pendaftaran lifecycle | Decided (edges L-3) | AD-11 (pinned enum + CAS + ladder) |
| Platform (responsive/PWA/platform) | Decided | AD-12 (+ runtime freshness contract) |
| UI component substrate | **Decided** (was H-1) | Stack, Platform convention, DESIGN/EXPERIENCE sync |
| Deployment & environments | Decided | AD-9 |
| Infra/provider | Decided | AD-9, Stack |
| Operations (cron, logs, monitoring, email auth) | Decided / explicitly deferred | AD-9, Deferred (error tracking; SPF/DKIM) |
| Backup/DR | Decided | AD-9 |
| Chart library | Deferred (scaffold, UX final) | Deferred |
| Email channel | Decided (outbox; Resend pin at scaffold) | AD-5, State convention, Stack |
| Migration | Decided | AD-1, Migrasi, Testing gate SM-1 |
| Testing | Decided at spine altitude | Conventions |
| Phase 2 sales / RLS / i18n / staging / service split | Deferred or refused, each with reason | Deferred |

**Counts:** 0 critical · 0 high · 1 medium · 4 low.
