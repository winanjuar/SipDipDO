# Rubric Walker Review — ARCHITECTURE-SPINE.md (snd-dash, 2026-09-15)

- **Reviewer:** rubric walker (good-spine checklist), independent context
- **Input:** `ARCHITECTURE-SPINE.md` (initiative altitude, build-substrate) + PRD `prd-snd-dash-2026-08-14/prd.md` (final) + `.memlog.md`
- **Method:** deterministic lint (`lint_spine.py`, 0 findings), mermaid render validation via mermaid-cli 11.17.0, independent version verification via npm registry (2026-09-15), manual rubric walk

## Verdict: **PASS-with-fixes**

No Critical findings. One High (broken diagram), three Medium (real divergence seams / one silent operational sub-dimension), several Low. All fixes are small and local; nothing undermines the paradigm or the AD set.

---

## Rubric item 1 — Fixes the real divergence points for the level below

**PASS.** The AD set covers the seams that would actually split independently-built epics/stories:

- Single writer for ownership state + exactly two finalization doors + migration path (AD-1) — the core trust invariant (SM-1).
- One-transaction finalization with explicit race policy (row-lock on RKAP phase, first-confirm-wins, loser → Ditolak with computation) (AD-2) — this is the PRD's own race case, decided.
- Audit atomic + append-only via DB grants (AD-3); positions updated only inside the ledger append transaction with recompute as comparator-only (AD-4).
- Table ownership map + dependency direction diagram (AD-5) — module seams fixed.
- One formula implementation for preview island and server validation (AD-6) — kills the classic preview-vs-authority drift.
- Price lock + revalidation semantics (AD-7); server-boundary access + MFA mechanics (AD-8); ops envelope (AD-9); money typing + no-float arithmetic (AD-10).
- Conventions close the remaining cross-cutting seams: naming (Glossary verbatim), IDs, timezone storage/display, error shape, order status enum (withdraw = audit event, not status), outbox email, test gates with PRD's verification examples.

**Findings:**

- **[F1 · Medium] Ledger append-only has no stated correction/reversal convention.** FR-21 direct input makes mistaken effective transactions a certainty eventually; AD-1 says append-only but the spine never says how a mistake is corrected. Two sessions could diverge: one attempts UPDATE (violating AD-1), another invents a compensating entry shape. *Fix: one clause in AD-1 or a convention row — "corrections are compensating ledger entries (never UPDATE/DELETE); shape defined at epic level."*
- **[F2 · Low] Client-island data transport unspecified** (server-passed props vs client fetch of API routes for the preview island and charts). Arguably below altitude (UX/story level), but naming it under Deferred would cost one line. *Fix: add to Deferred or a convention row.*

## Rubric item 2 — Every AD's Rule enforceable and actually prevents its stated divergence

**PASS with notes.** All 10 ADs carry Binds/Prevents/Rule; every Rule is enforceable by structure (module boundaries, single transaction, DB grants, shared pure module) rather than by exhortation. Binds/Prevents/Rule are coherent throughout.

- **[F3 · Medium] AD-4 "tabel materialized" is ambiguous in a load-bearing way.** In PostgreSQL, a `MATERIALIZED VIEW` cannot be updated inside the ledger transaction (`REFRESH` is the only write path), so AD-4 as written is only implementable as a **plain table maintained as a projection**. A builder session reading "materialized table" literally will create a PG MATERIALIZED VIEW and discover the contradiction late (no atomic coupling, no row-lock participation). *Fix: one word — "tabel biasa yang dipelihara sebagai proyeksi (bukan MATERIALIZED VIEW PostgreSQL), diupdate hanya di dalam transaksi append (AD-2)."*
- **[F4 · Low] AD-3 vs AD-5 wording tension on audit writes.** AD-5 forbids writing a neighbor module's table; AD-3 requires audit entries inside the acting module's transaction (which necessarily writes AUDIT's table). The consistent reading — cross-module writes go **via AUDIT's in-transaction API/export** — is implied by AD-5's "akses lintas modul lewat API/ekspor" but never stated for the audit case specifically. *Fix: add "kecuali entry audit, ditulis via API AUDIT di dalam transaksi aksi (AD-3)" to AD-5's rule.*
- **[F5 · Low] AD-10 leaves "decimal library **atau** operasi integer sen" open.** Contained inside `shared/domain` (single implementation per AD-6), so no cross-unit divergence — but pinning one at scaffold is cleaner. *Fix: pick one when scaffolding; no spine change strictly required.*
- **[F6 · Low] Internal naming drift inside the spine:** AD-5 says `PESANAN: buy_order` and AD-3 says `audit_log`, while the conventions row mandates plural (`buy_orders`) and the ERD uses `audit_logs`. The spine mildly violates its own convention. *Fix: normalize to `buy_orders` / `audit_logs` in AD-3/AD-5.*

## Rubric item 3 — Nothing under Deferred could let two units diverge

**PASS.** Every Deferred entry either (a) has a decided placeholder that binds until revisited (chart lib choice is contained in one FR; RLS deferral is safe because AD-8 already decides app-layer enforcement; staging deferral rides on AD-9's `local`+`production` decision), (b) is a parameter, not a structure (registration-expiry window → UX; email/PDF pins → "pin saat scaffold", a time-boxed trigger), or (c) is out of scope with reserved design space (FR-2 Phase 2: ledger stated as transaction-oriented, positions can go down). No two units can build incompatibly on any Deferred item.

## Rubric item 4 — Named tech verified-current

**PASS.** Independently re-verified against the npm registry on 2026-09-15:

| Claim in spine | Registry latest | Result |
| --- | --- | --- |
| Nuxt 4.x | 4.5.2 | ✓ |
| Drizzle ORM 0.45.x (avoid v1.0 beta) | 0.45.2 | ✓ |
| drizzle-kit 0.31.x | 0.31.10 | ✓ |
| @sidebase/nuxt-auth 1.3.1 | 1.3.1 | ✓ exact |
| @react-pdf/renderer "latest stable — pin saat scaffold" | 4.9.0 | acceptable deferral; could pin 4.9.0 now |
| PostgreSQL 17 (Supabase) | not independently re-checked | memlog documents the PG 18→17 correction with a cited Supabase changelog (Sep 2026) — credible |

- **[F7 · Low] nuxt-auth 1.3.1 Nuxt 4 compatibility should be confirmed at scaffold.** The published module is packaged against Nuxt 3.20 / `@nuxt/kit ^3.20.2` (peer `next-auth ~4.21.1`); the memlog claims "cocok Nuxt 3+/4" but the package metadata doesn't prove it. *Fix: verify compat (or pin the fallback path) in the scaffold story's done-criteria.*

## Rubric item 5 — Greenfield; brownfield ratification N/A

**PASS / N/A.** Repo contains only `_bmad`, `_bmad-output`, and agent config — no application code. Nothing to ratify.

## Rubric item 6 — Spec coverage: every PRD capability governed somewhere

**PASS.** The Capability → Architecture Map covers all 22 in-scope FRs (FR-1, FR-3…FR-23), each mapped to a home module and ≥1 governing AD; frontmatter `binds` matches. FR-2 (Phase 2) is explicitly held in Deferred with design space reserved. Cross-cutting PRD material lands too: precision NFR → AD-10, §4.8 openness matrix + auto-open after first effective purchase → AD-8, SM-1 → AD-1/AD-4 + migration acceptance totals (3,622/5,187/14,980) in Testing, MFA mechanics → AD-8, Template v3 + regenerable proof → conventions. No orphan capability found.

## Rubric item 7 — Parent spine inherited

**N/A.** No parent spine; initiative is the top altitude. Frontmatter carries no inheritance; nothing to check.

## Rubric item 8 — Every owned dimension decided / deferred / open

**PASS with one gap.** Decided: paradigm, boundaries & dependency direction, state mutation rules, shared-data ownership, security/access, money/precision, data-model seed (ERD), deployment target & region & pooler, environments (`local`+`production`), scheduler (Vercel Cron, daily granularity matches FR-19/FR-22), email delivery (outbox + retry), logging (structured), config (env), testing. Deferred with conditions: chart lib, UX/UI, RLS, staging, i18n, module extraction. No open questions remain (memlog shows the ORM and deployment forks resolved mid-run; PG version corrected with evidence).

- **[F8 · Medium] Backup/restore & data durability for the ledger is silent.** This system's entire value proposition is being the single source of truth for share ownership; the operational envelope (AD-9) decides deployment, environments, cron, and logging, but says nothing about database backups (Supabase automated backups / PITR tier / restore drill). It is the one sub-dimension of the ops envelope left neither decided nor deferred. *Fix: one line in AD-9 (e.g., "Supabase automated daily backups (+ PITR tier) — restore drill sekali sebelum go-live") or an explicit Deferred entry with a revisit condition.*

---

## Additional checks

### Mermaid syntax — **FAIL on one of three** (rendered with mermaid-cli 11.17.0)

- **[F0 · High] Deployment topology diagram (graph LR) does not parse.** `V -.->|commit| subgraph side effect` declares a subgraph as an inline edge target, which mermaid does not support. *Fix:* give the subgraph an id and target the id:
  ```mermaid
  subgraph SE [side effect]
      R
  end
  V -.->|commit| SE
  ```
- AD-5 dependency graph (`graph TD`, including the `&`-in-label and the `A & B & C -.->|label| X` multi-source edge): renders ✓.
- ERD (`erDiagram`, cardinalities and quoted labels): renders ✓.

### Template comments / placeholders — PASS
No template `<!-- -->` comments, no TODO/TBD/`[ASSUMPTION]` tags; deterministic lint reports 0 findings. The two "pin saat scaffold" stack entries are explicit, time-boxed deferrals rather than placeholders.

### Rationale bloat — PASS
Decisions, not essays: every AD is Binds/Prevents/Rule with no rationale padding; shape carried in diagrams and tables; conventions tabular. Matches build-substrate purpose.

---

## Findings summary

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F0 | High | Deployment mermaid diagram is a syntax error (`subgraph` as inline edge target) | Subgraph with id `SE`; edge to `SE` |
| F1 | Medium | No correction/reversal convention for an append-only ledger | One clause: corrections = compensating entries, never UPDATE |
| F3 | Medium | "tabel materialized" ambiguous — PG MATERIALIZED VIEW reading makes AD-4 unimplementable | Say "plain table maintained as projection, not PG MATERIALIZED VIEW" |
| F8 | Medium | Backup/restore for the ledger silent in the ops envelope | One line in AD-9 or a Deferred entry with revisit condition |
| F4 | Low | AD-3/AD-5 audit-write carve-out implicit | Add audit exception to AD-5's rule |
| F6 | Low | Naming drift: `buy_order`/`audit_log` vs `buy_orders`/`audit_logs` | Normalize to plural |
| F7 | Low | nuxt-auth 1.3.1 packaged against Nuxt 3.20/kit 3.x — Nuxt 4 compat unproven by metadata | Verify at scaffold; pin fallback |
| F2 | Low | Island data transport unspecified | Defer explicitly or add a convention row |
| F5 | Low | decimal-lib vs integer-sen left as "atau" | Pin one at scaffold |

All fixes are local edits; none reopen the paradigm, the AD set, or the stack.
