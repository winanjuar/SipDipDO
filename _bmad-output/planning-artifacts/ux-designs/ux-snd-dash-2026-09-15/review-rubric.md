# Spine Pair Review — snd-dash

Reviewed: `DESIGN.md`, `EXPERIENCE.md` in `_bmad-output/planning-artifacts/ux-designs/ux-snd-dash-2026-09-15/` against PRD `prd-snd-dash-2026-08-14` (UJ-1..UJ-6, FR-1..FR-23; FR-2 Phase 2 out of scope). Reviewer: rubric-walker, downstream-consumer lens (architecture, story-dev).

## Overall verdict

Strong pair, usable as-is as the downstream contract. All 6 UJs have verbatim-titled flows with protagonists, climaxes, and failure paths; every in-scope FR traces to a surface/component/state; all token references resolve; component and glossary names are consistent across both spines and the PRD. One medium finding (a chart token misses the file's own stated ≥3:1 floor) and three low polish items; nothing blocks source-extraction.

## 1. Flow coverage — strong

Checked: sources frontmatter → extracted UJ-1..UJ-6 from PRD §2.3 plus all in-scope FRs (FR-1, FR-3..FR-23); verified each UJ has a Key Flow (Flows 1–6, titles verbatim from PRD including punctuation), each with named protagonist (Bima/Rani, Hanif, Dewi), numbered steps, an explicit **Climax** beat, and failure paths (Flow 1: a–e; Flow 6: a–c; others single). Flow 7 correctly covers the UJ-1 variant / FR-21 (input langsung). FR-level trace (not per-FR flows, matching example norm): FR-1→Flow 1+Panel; FR-3→Dialog MFA; FR-4/5/18→Dashboard+3 charts; FR-6→Flow 3; FR-7→IA#14; FR-8/9→IA#11; FR-10→Flow 4; FR-11→IA#15+state; FR-12→IA#16; FR-13/17→IA#17+confirm patterns; FR-14→IA#15+"hasil migrasi"; FR-15→role-gating matrix; FR-16→Flow 5; FR-19→Baris Antrian+states; FR-20→Flow 1 step 6+IA#7; FR-22→Flow 6+IA#2/#3. No misses.

### Findings

(none)

## 2. Token completeness — strong

Checked: extracted all frontmatter tokens (`colors`: success/success-foreground, warn/warn-foreground, chart-1..10, modal-tetap/bergerak/operasional, chart-bigcap-ceil — all hex ✓) and every `{path.to.token}` reference in prose/components: `{colors.*}` (all resolve), `{typography.data-numeric.note}`, `{typography.data-calculation.note}`, `{components.status-badge}` — all resolve. Typography uses `note`-only entries, legitimate per the UI-system-inheritance pattern. Contrast targets stated for load-bearing combos: badge text ≈5.0:1 (verified: #15803D and #B45309 vs white both compute to ≈5.0:1), chart tokens ≥3:1 claim (verified chart-2 ≈3.6:1, chart-5 ≈3.1:1 — hold).

### Findings

- **medium** `modal-operasional` `#94A3B8` computes ≈2.56:1 on light background, below the file's own floor ("grafis ≥3:1", Do's & Don'ts row 5). The Colors prose's legend/fixed-order redundancy (WCAG 1.4.1) mitigates but does not satisfy the stated non-text-contrast target (DESIGN.md frontmatter line ~33, Colors section, Do's & Don'ts). *Fix:* either darken the lightest monochrome step to ≥3:1 (e.g. swap the ramp so the lightest segment clears 3:1) or scope the ≥3:1 rule explicitly to the owner-palette charts and record a stated exemption for the inner ring (structure carried by legend + fixed order + tooltip).

## 3. Component coverage — strong

Checked: extracted all component names from DESIGN frontmatter (10 tokens), DESIGN Components body (10 numbered entries), and EXPERIENCE Component Patterns (10 rows). 1:1:1 mapping with identical names (`chart-big-cap` token identical in both files; display name "Chart Stacked Bar 'Big Cap'" identical). Behavioral rules are real multi-clause rules (sticky-column strategy, aria-live, two-level tooltip, cross-highlight table↔wedge), not one-word descriptions. Surfaces that are forms (Pesanan Pembelian, Konfirmasi COO, Kelengkapan Profile) carry behavior via IA + flows + state rows — acceptable, not component gaps.

### Findings

- **low** EXPERIENCE inherits `Tooltip` and uses `Sheet/Drawer` (Interaction Primitives, line ~126) but DESIGN's as-is inventory (Components, line ~134) lists neither Tooltip nor Drawer. A story-dev scaffolding shadcn dependencies from DESIGN alone would miss them. *Fix:* add `Tooltip` (and Drawer if distinct from Sheet) to DESIGN's as-is list.

## 4. State coverage — strong

Checked: walked all 17 IA surfaces against applicable states (empty, cold-load, error, focus, offline, permission-denied). Covered: cold-load skeleton (global, with the never-half-loaded-numbers rule), load-failure (with stale-data prohibition), empty states for Dashboard/Antrian/Pesanan Saya/Riwayat/RKAP/MoM/Contribution, Kedaluwarsa (pesanan + pendaftaran), Ditolak with reason, permission-denied (hidden nav + redirect copy), MFA states (waiting/wrong/expired/resend-cooldown), login email-mismatch, bukti resend-failure, unreachable, Portion 99,99%/100,01%, form-submit-failure with retention. Focus states via Interaction Primitives/Accessibility Floor. Offline correctly framed as unsupported ("Tidak terjangkau"), consistent with Foundation.

### Findings

- **low** Distribusi Laba: the absent-prior-rekap case (first RUPS — "perbandingan rekap sebelumnya" has nothing to compare) is unspecified (IA #12, Flow 5 step 5). *Fix:* one State Pattern row: hide the comparison block on first rekap (or "belum ada rekap sebelumnya" note).

## 5. Visual reference coverage — strong

Checked: directory contains only `DESIGN.md`, `EXPERIENCE.md`, `imports/` (empty), `reconcile-prd.md`. No `mockups/`, no `wireframes/`. EXPERIENCE declares this exactly once, correctly: "belum ada mockup — spine-only" (IA, line ~54) and again at Key Flows head (line ~149) as the composition reference. No orphan links, no unspecific references in either spine. Degenerate-but-clean: spine-wins-on-conflict has nothing to act on and the spine-only declaration is the correct form.

### Findings

(none)

## 6. Bloat & overspecification — strong

Checked DESIGN for pixel specs where tokens cover it (none — the only literal, `border-top 2px`, is not token-covered), source restatement, and decorative narrative (editorial voice in Brand & Style is sanctioned); checked EXPERIENCE for prose that should be tables or PRD restatement. EXPERIENCE is table-first throughout; prose blocks carry only decisions (nav model, role-gating, confirm patterns, touch/keyboard posture). The openness matrix and 11 Profile fields restate PRD §4.8/Lampiran A but are load-bearing (they are the nav-visibility and form contracts). The invented "Format Angka & Presisi" section earns its place: id-ID locale, half-up 2dp, currency/percent formats are real per-story implementation decisions, and it consolidates them into one extractable block.

### Findings

(none)

## 7. Inheritance discipline — strong

Checked: `sources` in both spines resolves to the actual PRD path (`{planning_artifacts}/prds/prd-snd-dash-2026-08-14/prd.md` ✓ exists). UJ titles verbatim (all six, word-for-word including the UJ-5 colon clause). FR citations verbatim (FR-1, FR-16..FR-23). Glossary identical across spines and PRD: jenis modal terms, metric terms (Quantity, Shares, Ceil, Strength, Portion, Actual, RTL, Fulfillment, Harga Terkunci, Quantity Left, Grand Total), status vocabularies (Menunggu Konfirmasi/Terkonfirmasi/Ditolak/Kedaluwarsa; Diajukan/Terverifikasi), banned legacy terms ("jenis saham", "porsi", "ratio") explicitly excluded in Voice & Tone. Component names identical across DESIGN frontmatter, DESIGN body, and EXPERIENCE rows (token `chart-big-cap` consistent). EXPERIENCE token references (`{colors.warn}`, `{colors.success}`) resolve to DESIGN tokens by name; "shadcn destructive/muted" referenced by name per inheritance pattern. `[ASSUMPTION]` tags present and non-blocking (hues, locale, OTP timings, sort order — all decidable later, none undecidable-blocking).

### Findings

(none)

## 8. Shape fit — strong

Checked DESIGN section order: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts — canonical order, all 8 present. EXPERIENCE required defaults all present in order: Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, (invented: Format Angka & Presisi — earns place, see §6), Accessibility Floor, Key Flows. WCAG version pinned (2.1 AA — matches behavioral split; visual contrast delegated to DESIGN). One applicable-but-distributed section noted below.

### Findings

- **low** Responsive & Platform is triggered (responsive web, two postures: mobile-browser-first owners vs desktop COO) but exists only distributed — breakpoint semantics `<lg`/`≥lg` appear in Foundation, IA nav model, and Interaction Primitives separately rather than one consolidated breakpoint table (cf. Drift example). All content is present, so impact is comprehension/omission risk, not wrongness. *Fix:* optional 3-row breakpoint table in EXPERIENCE (nav, tables/charts, dialogs→sheets) to lock the contract in one place.

## Mechanical notes

- `rounded: {}` and `spacing: {}` are empty maps with explanatory comments (DESIGN frontmatter lines ~45–47). Valid YAML and the inheritance intent is clear; omitting the keys entirely would be equally spec-conformant and slightly more resolver-safe. Cosmetic.
- DESIGN frontmatter carries extra keys beyond the design.md spec (`status`, `sources`, `updated`). Harmless extension; consistent with EXPERIENCE frontmatter conventions. No action.
- EXPERIENCE.md ends with trailing blank lines after Flow 7 (lines 221–223). Cosmetic.
- No Mermaid diagrams in either file; all tables well-formed (pipe counts consistent), backtick code spans balanced.
- IA table numbering (1–17) consistent with cross-references in State Patterns and flows.
- Both spines carry `status: draft` — flip to `final` when assumptions (hue direction from user, OTP timings, locale) are confirmed.

## Finding summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 3 |
