# Rubric Review v2 — Architecture Spine (Sip & Dip Ownership Dashboard, Phase 1)

**Reviewer:** rubric-walker (good-spine checklist) · **Date:** 2026-09-15 · **Target:** `ARCHITECTURE-SPINE.md` (current, post-update: AD-12, platform invariant, module-shape conventions, Do/Don't, UX two-way sync)

## Verdict

**PASS-with-fixes.** The spine is genuinely strong: the ledger-centric paradigm, AD-1..AD-12 are each enforceable with load-bearing Binds/Prevents/Rule triplets, the atomicity rules (AD-2 CAS + lock ordering, AD-11 owner-lifecycle CAS, AD-12 cache boundary) close the exact races the PRD creates, and the seed is properly marked as seed with scaffold-time pins for immature choices. The update round (PWA, platform invariant, tx-handle convention, Do/Don't) fixed the prior gate's holes cleanly — I found no regression in the mermaid blocks or conventions. Two real gaps remain for the level below. First, the one the checklist pre-flags: the UX contract is written against **shadcn/ui + Tailwind (a React ecosystem)** while the stack is **Nuxt/Vue** — the spine neither names the Vue-side substrate nor defers it; every UI story and the DESIGN.md "don't edit" component inventory currently have no implementable referent (HIGH). Second, the **pendaftaran lifecycle (FR-22)** — a state machine intersected by owner action, COO verification, and cron expiry — has no single-writer rule, status enum, or CAS discipline, the exact divergence class AD-2 prevents for orders (MEDIUM). Remaining findings are low polish. Fixes are cheap and localized; none destabilize the paradigm.

## Findings by severity

### Critical

None.

### High

**H-1 — UI component substrate: shadcn/ui (React) vs Nuxt/Vue unreconciled.**
**Location:** Stack table (missing row), Design Paradigm, Consistency Conventions › Platform, Deferred.
EXPERIENCE.md Foundation and DESIGN.md contract against shadcn/ui + Tailwind verbatim — including React-specific packages (`input-otp`, `sonner`) and a "dipakai apa adanya, jangan disunting" inventory. The stack is Nuxt 4 / Vue 3; shadcn/ui as written is not installable there. The spine never mentions the component substrate: not in Stack, not in Deferred (chart library is deferred; the component library is simply absent). Without a decision, two UI stories can legitimately pull different Vue primitives, and the UX docs' visual contract has no enforcement point — a whole-surface divergence the spine exists to prevent.
**Fix:** Add a Stack seed row deciding the reconciliation explicitly — e.g., "shadcn-vue (reka-ui primitives) + Tailwind as the Vue implementation of the shadcn contract; smoke-test parity of Dialog/Sheet/Input-OTP/Toast against DESIGN.md inventory at scaffold (same treatment as NuxtAuth/@vite-pwa)" — or, minimally, a Deferred entry naming the decision and its scaffold deadline. Add one line to the Platform convention and sync a clarifying note to DESIGN.md/EXPERIENCE.md (two-way sync already exists) so the UX contract names the Vue equivalents.

### Medium

**M-1 — Pendaftaran lifecycle (FR-22) has no single-writer rule, status enum, or CAS.**
**Location:** AD-11 (covers owner status only), Conventions › Data & format (order status enum only), AD-9 (cron touches expiry), Capability Map row FR-13/15/17/22 → identity.
Registration is a state machine raced by three writers: pendaftar completing Profile (day-7 boundary), COO verification, cron kedaluwarsa (AD-9). The spine pins order-status semantics to the letter (`menunggu_konfirmasi`/…, penarikan = audit-only, penolakan-submit = no row) but is silent on the pendaftaran analog: no status enum (`diajukan`/`terverifikasi`/`ditolak`/kedaluwarsa?), no rule whether kedaluwarsa is a stored status or computed, no CAS on verification-vs-expiry, no rule on re-registration. Independently built stories (Profile flow vs cron vs Manajemen Owner) can model it three incompatible ways — the same race class AD-2/AD-11 eliminate elsewhere.
**Fix:** Extend AD-11 (or the Data & format convention) with: pendaftaran status enum; only IDENTITAS writes it; transitions are compare-and-set in one DB tx (verification vs kedaluwarsa race); kedaluwarsa semantics per the UX decision (7 hari, re-registration allowed) recorded once; expiry events in audit.

### Low

**L-1 — AD-10 permits two money-arithmetic mechanisms ("decimal library atau operasi integer sen").**
**Location:** AD-10.
Both are safe, but "or" leaves a standing fork inside `shared/domain`; a story pair could each add helpers in a different idiom, eroding the single-implementation promise of AD-6 at the edges.
**Fix:** One clause: "satu mekanisme dipilih saat scaffold dan dicatat; campuran dilarang" (or just pick decimal-library now).

**L-2 — sources frontmatter omits DESIGN.md while the spine depends on it.**
**Location:** Frontmatter `sources`, Deferred › UX decisions.
Deferred routes the entire visual contract to DESIGN.md, but sources lists only PRD + EXPERIENCE.md. Traceability gap on the artifact that (post H-1) carries the component contract.
**Fix:** Add `../../ux-designs/ux-snd-dash-2026-09-15/DESIGN.md` to sources.

**L-3 — Ops envelope silent on error tracking / monitoring and email sender auth.**
**Location:** AD-9, Conventions › State (structured logs only).
Backup/DR and environments are properly decided, but nothing decides or defers: error tracking/alerting on a solo-dev production (failed outbox retries are the quiet failure mode — PROOFS retries exist but nobody is told), and SPF/DKIM/custom From-domain for Resend — deliverability is load-bearing because OTP email is the MFA channel and Bukti Transaksi is an owner's claim instrument.
**Fix:** Add one Deferred line each ("error tracking — defer to scaffold, solo dev"; "SPF/DKIM + From domain — task at scaffold") or a sentence in AD-9. Explicit deferral is enough; silence is not.

**L-4 — OTP attempt-limit / resend-cooldown enforcement point not bound server-side.**
**Location:** AD-8, AD-5 (otp_codes).
UX specifies the behavior (sisa percobaan, cooldown 60 detik, TTL 10 menit) but only as dialog states; the spine's AD-8 covers hashing/single-use/TTL and AD-5 covers single-use CAS, while attempt limiting and resend throttling live nowhere architectural. A story implementing `requestOtp` could ship without them and pass all spine rules.
**Fix:** One clause in AD-8 (or AD-5): attempt limit + resend cooldown enforced server-side on `otp_codes`/request path, values per UX.

## Checklist walk (evidence)

1. **Divergence coverage FR-1..FR-23 + UX contracts** — FR-1 (AD-6/7), FR-3 (AD-5/8), FR-4/5/18 (AD-1/4; chart lib deferred with UX final), FR-6/7 (AD-7, AD-5 MoM ownership), FR-8/9/10 (AD-5 + multi-table-tx convention), FR-11 (PROOFS outbox + deterministic regen), FR-12 (AD-3), FR-13/15/17 (AD-8/11, coo_tenures), FR-14 (AD-1 + Migrasi + Testing gerbang SM-1), FR-16 (AD-6/10/11), FR-19 (AD-2 CAS + AD-9 cron + status enum + penarikan/penolakan semantics), FR-20/21 (AD-2/7), FR-22 (AD-8/9 — **gap M-1**), FR-23 (AD-2 phase lock + AD-6 aggregate limit formula + derived Fulfillment). Platform contract: two-posture/PWA/light-only — AD-12 + Platform convention (**gap H-1** on the component substrate).
2. **AD quality** — all 12 ADs have Binds/Prevents/Rule; each Rule is enforceable (DB grants, lock ordering, CAS, module boundaries, cache policy) and demonstrably blocks its stated divergence. AD-2/AD-11 lock discipline has no cycle (phase→owner ordering; DISTRIBUSI takes owner lock only).
3. **Deferred safety** — chart lib, Resend/postgres.js pins, staging, RLS, offline-PWA, i18n, Phase 2: all scaffold-time or justified refusals; none permits inter-story divergence. Exception: component substrate is absent rather than deferred (H-1).
4. **Version pins, internal consistency only** — consistent: Node ≥22 (AD-9 ↔ Stack), PG 17 Supabase (memlog correction honored), Drizzle 0.45.x with GA-at-scaffold rule, NuxtAuth/@vite-pwa smoke-test flags parallel and honest, react-pdf React peer dep marked server-only. No internal contradiction found. (Currency itself = tech-currency lens.)
5. **Greenfield seed** — Stack, tree, module shape, ERD all marked seed; ERD is relations-only with invariants pushed to ADs; not over-specified as invariant. Good.
6. **Spec-driven coverage** — capabilities and UX platform contract covered except H-1/M-1.
7. **Dimension sweep** — table below; envelope decided except the L-3 silences.
8. **Parent spine** — none (initiative altitude); N/A.

## Dimension sweep

| Dimension | Status | Where |
| --- | --- | --- |
| Paradigm & deployment topology | Decided | Design Paradigm, AD-9 |
| Data model & table ownership | Decided | AD-5, ERD (seed) |
| Transactional consistency & races | Decided | AD-2, AD-4, AD-11, tx-handle convention |
| Audit | Decided | AD-3 |
| Domain-logic placement & precision | Decided | AD-6, AD-10 (L-1 duality) |
| Pricing semantics | Decided | AD-7 + Migrasi convention |
| Access, auth, MFA | Decided (attempt-limits implicit → L-4) | AD-5, AD-8 |
| Owner & pendaftaran lifecycle | Owner decided; **pendaftaran open (M-1)** | AD-11 |
| Platform (responsive/PWA/platform) | Decided | AD-12, Platform convention |
| UI component substrate | **Open (H-1)** | absent |
| Deployment & environments | Decided (local+production) | AD-9 |
| Infra/provider | Decided | AD-9, Stack |
| Operations (cron, logs) | Decided; monitoring/email-auth silent (L-3) | AD-9 |
| Backup/DR | Decided (PITR + restore drill) | AD-9 |
| Chart library | Deferred (scaffold, UX final) | Deferred |
| Email channel | Decided (outbox, Resend pin at scaffold) | AD-5, Stack |
| Migration | Decided | AD-1, Migrasi, Testing |
| Testing | Decided at spine altitude (unit + migration gate) | Conventions |
| Phase 2 sales / RLS / i18n / staging / service split | Deferred or refused, each with reason | Deferred |

**Counts:** 0 critical · 1 high · 1 medium · 4 low.
