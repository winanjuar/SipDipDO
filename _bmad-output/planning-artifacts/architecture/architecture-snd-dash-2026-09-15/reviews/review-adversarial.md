# Adversarial Review — Architecture Spine (Sip & Dip Phase 1)

- **Lens:** Adversarial — construct two units one level down that each obey every AD to the letter yet still build incompatibly.
- **Target:** `ARCHITECTURE-SPINE.md` (2026-09-15), against PRD `prd-snd-dash-2026-08-14/prd.md` (final r33) as ground truth.
- **Method:** Five epic teams imagined building in parallel:
  - **Team A — Order self-service** (FR-1, FR-19): `server/domain/orders`, preview island, order lifecycle.
  - **Team B — COO finalization & RKAP** (FR-20, FR-21, FR-23): `server/domain/orders` confirm door, `server/domain/ledger`, `server/domain/rkap`.
  - **Team C — Dashboard & charts** (FR-4, FR-5, FR-18): reads projections.
  - **Team D — Registration & identity** (FR-22, FR-13, FR-15, FR-17): `server/domain/identity`.
  - **Team E — Contribution & distribution** (FR-8–FR-16): `server/domain/contribution`, `server/domain/distribution`.
  - (Auxiliary: **Team F — migration/proofs/audit** where relevant.)
- **Verdict: HOLES** — 2 CRITICAL, 3 HIGH, 5 MEDIUM, 3 LOW. Every hole below names two compliant-but-divergent builds; each is a gap the AD set leaves open, not a style preference.

---

## Findings Summary

| # | Severity | Hole | Gap in | Suggested fix |
|---|---|---|---|---|
| H1 | CRITICAL | Owner lifecycle state (`pemegang saham` / `Keluar` / reactivation) has no assigned writer; AD-5 graph lacks the needed edges | AD-5, AD-8 | New AD: single owner of owner-status transitions + declared derivation of "Pembelian Pertama efektif" |
| H2 | CRITICAL | `buy_orders.status` has three concurrent writers (confirm, cron expiry, owner withdrawal); AD-2 locks only the RKAP phase row — and not at all for Modal Operasional | AD-2, AD-9 | Tighten AD-2 + new rule: CAS status transitions, order-row lock ordering |
| H3 | HIGH | Referral re-validation: automated gate vs COO human judgment; "hari yang sama" basis undefined; cross-referral race | AD-7 | Tighten AD-7: split mechanical vs human-judged checks; define day basis |
| H4 | HIGH | Day-granular semantics in UTC vs Asia/Jakarta: "hari ke-7 sejak submit" and "harga berlaku pada tanggal submit/input" resolve differently near midnight | Conventions, AD-9, AD-7 | New AD: all calendar-day business rules resolve in Asia/Jakarta |
| H5 | HIGH | `Final Requirement` / consumed adjustment budget have writers outside AD-2's phase lock (manual adjustment, item addition, rebalancing); Fulfillment stored-vs-derived undecided | AD-2, AD-4 (analog missing for RKAP) | Tighten AD-2: all RKAP-mutating paths serialize on the same per-phase lock; declare Fulfillment storage model |
| H6 | MEDIUM | Payment record (tanggal + metode) lives in two homes by door (`buy_orders` vs `ledger_transactions`); PROOFS reads LEDGER only per AD-5 graph | AD-5 | Assign payment fields to `ledger_transactions`, written by both doors |
| H7 | MEDIUM | Strength-validation *input assembly* (which orders count, incl. the order under confirmation) is not covered by AD-6's "pure formulas" | AD-6, AD-7 | Extend AD-6: canonical assembly function lives in `shared/domain` |
| H8 | MEDIUM | Distribution rounding contract: per-owner rounding, leftover sen, Portion precision basis (full vs 2dp) for stored rekap | AD-10 | Extend AD-10: rounding + remainder convention for stored distribution amounts |
| H9 | MEDIUM | Migration vs ERD: `ledger_transactions }o--|| price_periods` mandatory FK but historical prices don't exist; audit actor for system/migration actions undefined | Structural Seed, AD-3, AD-5 | New convention: backfill via HARGA API or relax FK + snapshot on ledger row — pick one; define system-actor |
| H10 | MEDIUM | AD-5 graph lacks DIST → CONTRIBUTION edge; FR-16 needs finalized cut-off points — linkage shape undefined | AD-5 | Add edge + define rekap → contribution-period snapshot reference |
| H11 | LOW | Submit-time rejected order: persisted `buy_orders` row with status `ditolak` vs audit-only ghost — status enum semantics fork | Conventions | Convention: submit-rejections are audit events only (or rows) — decide |
| H12 | LOW | Audit event taxonomy & `details` schema unconstrained; `audit_logs.aktor` FK to owners breaks for cron/system | AD-3, Structural Seed | Convention: event name registry + nullable/system actor |
| H13 | LOW | Outbox table absent from AD-5 ownership list though multiple modules write it | AD-5 | Assign outbox ownership (e.g., PROOFS or a cross-cutting infra module) |

---

## H1 — CRITICAL: Owner lifecycle has no owner; "Pembelian Pertama efektif" is everyone's assumption

**Teams:** D (identity/access) vs B (finalization) vs E (distribution).

**Gap:** AD-5 assigns `IDENTITAS: owner/profile/role` and its dependency graph grants exactly one edge into identity (`CONTRIBUTION → IDENTITAS (baca)`). There is **no edge IDENTITY → LEDGER** and **no edge DISTRIBUSI → IDENTITY (tulis)**. Yet the PRD requires three state transitions driven by other modules' events:

1. Calon Owner/Terverifikasi → pemegang saham (visibility opens) "setelah transaksi pembelian pertamanya efektif" (§4.8, FR-22, FR-15).
2. Owner tanpa saham → **Keluar** when "bagian Insentif-nya telah ditunaikan pada rekap RUPS" (FR-16 consequence, FR-13).
3. Keluar → aktif kembali (full transparency restored) after a new effective transaction (FR-13).

**Two compliant-but-incompatible builds:**

- **Build D1 (derived):** Team D treats "pemegang saham" as a live query `positions.shares > 0` against LEDGER's projection API — but this requires the IDENTITY→LEDGER read edge the graph doesn't grant; they add it silently. Build D2 (stored flag): a `role`/`status` column in the owner table that someone must flip. Who? AD-1 lists LEDGER's write surface exhaustively (ledger rows + positions, via two doors + migration). AD-2 enumerates the finalization transaction contents: ledger append + order status + RKAP plotting + instant adjustment + audit entry — **no identity write**. So a literal Team B never flips the flag, and D2's owners stay "Terverifikasi" forever; dashboards gated on the flag never open.
- **Team E, per FR-16, must turn a zero-share owner into `Keluar` after RUPS payout.** Build E1 writes owner status directly (violates AD-5's table ownership as written); Build E2 emits only a distribution rekap row and assumes identity derives `Keluar` — from what? Contribution payout data D has no edge to read (graph: only CONTRIBUTION→IDENTITAS *read*).

**Divergence produced:** §4.8 openness matrix — the gate AD-8 tells both teams to enforce "di middleware server + tiap route handler" — computes "pemegang saham" from a different source in Team D's middleware vs Team C's dashboard "Grand Total … seluruh owner aktif" (FR-4: does a `Keluar` owner with historical position rows appear? D1's `shares > 0` says yes for a Keluar owner whose Phase-2 sale hasn't happened yet — in Phase 1 every Keluar candidate still has shares>0 until Phase 2, but the *definition* still forks today for owners whose shares… actually in Phase 1 no share count ever decreases, so `Keluar` can never trigger from shares — only via the RUPS-payout rule. Two teams will discover this independently and resolve it differently.)

**Fix (new AD-11):** Owner lifecycle status is owned by IDENTITY as a *stored* state with exactly three legal writers-in-transactions: (a) IDENTITY itself (registration verify/reject), (b) LEDGER finalization doors + migration, which flip `Terverifikasi → pemegang saham` (and reactivation) inside the same AD-2 transaction via the IDENTITY internal API, (c) DISTRIBUSI finalization, which flips `→ Keluar` inside the rekap transaction, likewise via API. Add edges `IDENTITY → LEDGER (baca proyeksi)` if a derived cross-check is kept, and `DIST → IDENTITY (tulis via API)`. Define "Pembelian Pertama efektif" once: *the owner's first `ledger_transactions` row referencing that owner via a non-migration… (or including migration) door* — and say which.

---

## H2 — CRITICAL: `buy_orders.status` has three writers and no guard — cron expiry can race COO confirmation

**Teams:** B (confirmation door) vs A (withdrawal, FR-19) vs the cron job (AD-9).

**Gap:** AD-2's atomicity recipe locks "row-lock pada fase RKAP untuk jenis modal Tetap/Bergerak". It says nothing about locking the **order row**, and Modal Operasional confirmations take no RKAP lock at all. AD-9 makes expiry a daily cron endpoint mutating the same `buy_orders.status` column. FR-19 adds a third mutator: owner withdrawal (audit-event, removes from queue). Every status change is auditable (FR-12), so all three paths also write `audit_log`.

**Two compliant-but-incompatible builds:**

- **Build B1:** confirmation tx = [RKAP phase lock] → re-validate → append ledger → `UPDATE buy_orders SET status='terkonfirmasi'`. Build A1 (jobs): `UPDATE buy_orders SET status='kedaluwarsa' WHERE submit_date <= day-7 AND status='menunggu_konfirmasi'` — no lock specified, no shared ordering. **Race:** on day 7 the cron fires while COO's MFA-confirmed transaction is mid-flight. Outcomes: (a) expiry commits first, confirmation's blind UPDATE overwrites `kedaluwarsa → terkonfirmasi` — ledger row exists, audit shows both "kedaluwarsa" and "terkonfirmasi" for one order, owner got an expiry email *and* a Bukti Transaksi; (b) confirmation commits first, cron overwrites `terkonfirmasi → kedaluwarsa` — position/ledger say owner holds shares, order says expired; SM-1 dies here.
- Even without cron: **withdrawal vs confirmation** — owner withdraws (order removed from queue) while COO is confirming payment already received. Nothing in the AD set defines who wins; FR-20's refund guidance assumes the *system* rejected, not that a human race did.

**Fix (tighten AD-2, extend AD-9):** Every `buy_orders.status` mutation is a single-row compare-and-set (`UPDATE … WHERE status='menunggu_konfirmasi'`) inside a DB transaction that **row-locks the order row first**, before any RKAP-phase lock (declare lock ordering: order row → phase row). The confirmation door aborts as "sudah bukan menunggu konfirmasi" when CAS affects 0 rows; cron expiry and withdrawal use the identical CAS. Audit entry is written in the same tx (AD-3 already covers that part).

---

## H3 — HIGH: Referral re-validation — automated gate vs COO judgment, and the cross-referral race

**Teams:** B (re-validation at confirmation) vs D (identity/referral rules, FR-22).

**Gap:** AD-7 says finalization re-validates "keabsahan referral Pembelian Pertama". The PRD (FR-22) says cross-referral validity ("dua owner boleh saling merujuk bila sama-sama membeli saham perdananya — kepesertaan modal awal pada hari yang sama") is "divalidasi COO saat konfirmasi". Automated-or-human, and the data read, are unspecified.

**Two compliant-but-incompatible builds:**

- **Build B1 (strict automated):** at confirmation the system requires the referral to *currently* be a shareholder (positions query). Legitimate cross-referral — A and B, both first-timers, both pending, confirmed the same day — gets **auto-rejected** when A is confirmed first: B holds no shares yet. Build B2 (human): COO ticks "cross-referral sah" and the system only checks mechanics — two teams ship opposite acceptance behavior for the PRD's explicitly blessed case.
- Either way, "hari yang sama" is undefined: same calendar day of *submit*, of *tanggal pembayaran* (FR-20 records it), or of the effective timestamp? Build B1 compares payment dates; B2 compares confirmation timestamps. A pair confirmed 23:50 and 00:10 Jakarta time passes one build, fails the other.

**Fix (tighten AD-7):** The system's mechanical referral checks (referral exists, is not self, is Terverifikasi-or-better, referral rule scope per FR-22) are enumerated and automated; the same-day cross-referral judgment is an explicit COO input recorded with the confirmation, not an inference; "hari yang sama" is defined against the same day-basis AD as H4 (tanggal efektif transaksi, Asia/Jakarta calendar day).

---

## H4 — HIGH: Day-granular rules have no timezone semantics — "hari ke-7" and "harga berlaku pada tanggal" fork at midnight

**Teams:** A (order lifecycle + cron expiry, FR-19; Harga Terkunci snapshot, FR-1) vs F (pricing CMS effective dates, FR-6) vs B (FR-21 "harga berlaku pada tanggal input").

**Gap:** Conventions: "tanggal disimpan `timestamptz` UTC, disajikan `Asia/Jakarta`". That covers storage and display, not **business-rule day boundaries**. AD-9 says expiry and registrant reminder are "granularitas hari" with a daily cron (hour unspecified). FR-6 prices are "efektif per tanggal".

**Two compliant-but-incompatible builds:**

- **Build A1:** expiry instant = `submit_ts + 168h`; cron at 00:00 UTC. Build A2: expiry = 7th Asia/Jakarta calendar day after the Asia/Jakarta calendar day of submit; cron at 17:00 UTC (= 00:00 WIB). An order submitted 23:30 WIB Monday expires Sunday night vs Monday night — up to 24h apart, and the H2 race window widens accordingly.
- **Price resolution:** a new price is effective "15 Sep". Owner submits at 23:30 WIB 15 Sep = 16:30 UTC 15 Sep — same UTC date, fine; but 00:30 WIB 16 Sep = 17:30 UTC 15 Sep: Build A′1 (UTC-date resolution) picks the 15th's price, Build A′2 (Jakarta-date) picks the 16th's. **The Harga Terkunci differs — this is money**, and FR-21's direct input hits the same fork. The dashboard (Team C) displays "harga berjalan" per its own resolution, so the owner can see price X on screen while the order snapshots price Y.

**Fix (new AD):** All day-granular business rules (day-7 expiry, registrant expiry, price effective dates, "hari yang sama" in H3) resolve calendar days in **Asia/Jakarta** from the stored `timestamptz`; the effective price at instant *t* is the newest `price_periods` row whose Jakarta-calendar effective date ≤ Jakarta date of *t*. Cron schedule fixed at a stated UTC hour.

---

## H5 — HIGH: RKAP mutation paths outside the finalization lock — adjustment-budget overrun race; Fulfillment stored vs derived

**Teams:** B's own two halves (finalization overshoot vs RKAP CMS manual operations, FR-23) — plus F (migration replay).

**Gap:** AD-2 puts "penyesuaian instant Final Requirement (overshoot)" inside the confirmation transaction, guarded by the per-phase row lock. But FR-23 gives the **RKAP module** three more write paths to the same rows: manual Final Requirement increase, brand-new Capital Item, and MRO rebalancing — each consuming the *same* aggregate adjustment budget (`1% × Initial + 1 share price`). No AD requires these paths to take the phase lock; AD-2's lock is described only as part of the two finalization doors. Separately, FR-23 lists Fulfillment as a *column* on Capital Item, but nothing says whether it is stored (single-writer maintained in the AD-2 tx) or derived from `ledger_transactions` plotting.

**Two compliant-but-incompatible builds:**

- **Race:** remaining budget = 60.000. COO's manual adjustment (+50.000, RKAP module, no lock per AD text) commits while a confirmation with overshoot +36.000 is inside the phase-locked tx. Both "fit" against the pre-read budget; combined overshoot 86.000 exceeds the 68.000-style ceiling in the FR-23 verification example. The invariant FR-23 calls testable ("tidak boleh melebihi") is enforced by neither path against the other.
- **Fulfillment model:** Build B1 stores `fulfillment` on `capital_items` updated only inside AD-2 transactions; Build B2 derives it live from ledger plotting rows "because AD-1 says ledger is the truth". Then rebalancing (FR-23: relocation between same-type items) must decide whether Fulfillment travels with the requirement — B1 relocates stored numbers; B2's derivation breaks because old plot rows point at the old item. Same input, different cafe-level Fulfillment Rate → different gerbang open/closed decisions.

**Fix (tighten AD-2 / new AD-12):** *Every* writer of `capital_items` (Final Requirement, item addition, rebalancing, instant overshoot) and of the consumed-adjustment accumulator serializes on the same per-phase row lock inside one DB transaction that re-validates the budget ceiling at commit time. Declare Fulfillment a stored column written **only** by the two finalization doors (AD-2 tx) and by an explicit rebalancing transaction that moves plot allocations atomically — with full recompute from ledger as the reconciliation comparator (mirror of AD-4 for RKAP).

---

## H6 — MEDIUM: Payment record (tanggal + metode) has two homes; PROOFS can only read one

**Teams:** B (two finalization doors) vs proofs (Team F, FR-11).

**Gap:** FR-20 records tanggal + metode on the confirmation path (naturally columns on `buy_orders`, owned by PESANAN). FR-21's direct input has no order — the natural home is `ledger_transactions` (LEDGER). The ERD gives `ledger_transactions }o--o| buy_orders`, so payment fields could live on either side; AD-5's graph grants PROOFS exactly one edge: `PROOFS → LEDGER (react post-commit)`.

**Two compliant-but-incompatible builds:** Build B1 puts payment fields on `ledger_transactions` uniformly (both doors write them during finalization) — PROOFS works. Build B2 puts them on `buy_orders` for the confirm path and on `ledger_transactions` for the direct path — literal, satisfies both FRs — but PROOFS, per the graph reading only LEDGER, renders Bukti Transaksi for confirmed orders without payment date/method (or joins a neighbor table informally, contradicting AD-5's "akses lintas modul lewat API").

**Fix (tighten AD-5):** Payment record (tanggal pembayaran, metode) is part of the `ledger_transactions` shape, written identically by both doors in the AD-2 transaction; `buy_orders` carries it only as denormalized submit-time display data if at all. Also pick which date the Bukti shows when payment date ≠ effective date.

---

## H7 — MEDIUM: Strength validation *input assembly* is not a shared formula — the "antrian" set forks

**Teams:** A (submit-time validation, FR-1) vs B (re-validation at confirmation, AD-7) and the preview island.

**Gap:** AD-6 mandates shared *pure* formulas (weighting, Strength, RTL…). But "Validasi menggabungkan posisi terkini dan seluruh Pesanan Pembelian owner yang sama yang berstatus Menunggu Konfirmasi" (FR-1) is a **data-assembly** rule: which rows feed the formula. AD-7 repeats it as "Strength gabungan + antrian" without defining the set: does the order currently being confirmed count (it is still `menunggu_konfirmasi` at check time)? Do sibling pending orders? Do `ditolak`-at-submit rows (see H11) or `kedaluwarsa` rows?

**Two compliant-but-incompatible builds:** Build A1 assembles `position + all rows with status='menunggu_konfirmasi'`; Build B1 assembles `position + this order only` (reading "re-validasi kondisi terkini" as the position being current). Mostly equivalent while positions only grow — but build A2 counting "all non-terminal orders" plus Team A persisting submit-rejections as `ditolak` rows (H11) silently changes the queue set; and the preview island (Team A, client) must replicate whatever the server does or previews lie. The interactions are exactly where SM-1's "zero discrepancy" is lost.

**Fix (extend AD-6):** The validation input assembly — `effectivePosition(owner) = materialized position + Σ pending own orders (status 'menunggu_konfirmasi')` — is itself a `shared/domain` function taking an explicit order set; the submit path passes all pending orders plus the draft; the confirmation path passes all pending orders (the in-flight one included) — one definition, two call sites.

---

## H8 — MEDIUM: Distribution rounding contract — per-owner amounts, leftover sen, Portion precision basis

**Team:** E (and C's Portion display as the visible cross-check).

**Gap:** AD-10: ratios computed full-precision, rounded half-up 2dp "hanya saat penyajian"; money `numeric(18,2)`. FR-16 requires the rekap *disimpan* — so per-owner Dividen/Insentif are stored money. But: Dividen = Portion × pool — Portion full-precision (Shares/totalShares) or the 2dp-displayed Portion (FR-4 "Portion presisi 2 angka")? When pool × ΣPortion ≠ Σ(pool × Portion_i), where do the leftover sen go? The PRD's verification example (4.340.000) is exact, so it doesn't arbitrate.

**Two compliant-but-incompatible builds:** Build E1 uses full-precision ratios and rounds each owner's result half-up; Σ rounded amounts ≠ pool by a few sen, remainder unassigned. Build E2 distributes with the 2dp Portion — every owner with displayed Portion sees a *different* number on the rekap than the dividend computed from her true ratio; owners cross-checking with the dashboard (PRD's core trust story, SM-1) find discrepancies by design.

**Fix (extend AD-10):** Stored per-owner distribution amounts are computed from full-precision ratios, rounded half-up to sen individually; a defined remainder rule (e.g., largest-remainder allocation or explicit residual line on the rekap) guarantees Σ per-owner = budget pool exactly; 2dp Portion is presentation-only everywhere.

---

## H9 — MEDIUM: Migration vs the ERD — mandatory `price_periods` FK for historical transactions; audit actor for system actions

**Teams:** F (migration, FR-14) vs pricing (FR-6) and audit (AD-3).

**Gap:** ERD: `ledger_transactions }o--|| price_periods : "harga final"` — a mandatory FK. FR-14 imports the entire transaction history (Quantity 3.622 across years of purchases at prices that predate the CMS). AD-1 lets migration use the internal LEDGER API; AD-5 says HARGA owns `price_periods` — no AD says migration may create price periods. Likewise `audit_logs.aktor` is `owners ||--o{ audit_logs` — every audit actor is an owner — but migration and cron (expiry, reminders) must write audit entries (FR-12: kedaluwarsa tercatat).

**Two compliant-but-incompatible builds:** Build F1 backfills synthetic `price_periods` rows (invented MRO references) via the HARGA API — price history UI now shows periods no MRO ever set. Build F2 makes `price_final_id` nullable for migrated rows + stores a plain amount on the ledger row — the ERD convention forks, and any code assuming the FK (e.g., proofs, price-history reports) breaks on nulls. For audit actor: F1/A-team builds use a synthetic "system" owner row; others use NULL — the shared shape of a table three+ modules write diverges from day one.

**Fix (convention + tighten AD-3):** Decide one: either migrated transactions carry a denormalized price snapshot with nullable FK (declared in the ERD), or migration seeds historical `price_periods` explicitly labeled `sumber: migrasi` (no MRO ref). Define `aktor`: nullable + `aktor_jenis` (`owner` | `system` | `cron` | `migrasi`) so non-human writers have one canonical shape.

---

## H10 — MEDIUM: AD-5 graph omits DIST → CONTRIBUTION; FR-16's basis points have no linkage shape

**Teams:** E's distribution half vs E's contribution half (built as separate epics/stories).

**Gap:** The graph gives DISTRIBUSI exactly one edge: `DIST → LEDGER (baca proyeksi)`. FR-16 computes Insentif from "poin periode yang telah difinalkan cut-off (FR-10)" — data owned by CONTRIBUTION. The edge is missing, and nothing defines how a distribution rekap references which finalized period(s) it consumed (period id? cut-off snapshot table? inline copy of points?).

**Two compliant-but-incompatible builds:** Build E1 snapshots finalized points into the distribution rekap at computation time (rekap is self-contained, immutable); Build E2 references `contribution_period_id` live. If a late cut-off correction ever re-opens a period (FR-10 doesn't forbid corrections pre-distribution), E2's historical rekap silently changes while E1's doesn't — "Rekap terakhir selalu bisa dibandingkan dengan rekap RUPS sebelumnya" (FR-16) means different things in each build. Also: whether an owner's *carry-over* untapped points survive into the next period after a partial-payout RUPS is only implied.

**Fix (tighten AD-5 + convention):** Add `DIST → CONTRIBUTION (baca periode final)`; rekap stores an immutable snapshot of per-owner finalized points (plus the period reference for traceability), so distribution is reproducible from its own row.

---

## H11 — LOW: Submit-time rejection — `ditolak` row or audit-only ghost?

**Teams:** A vs D (personal page "portofolio & status Pesanan Pembelian miliknya", FR-22).

**Gap:** The status enum includes `ditolak`, and FR-12 requires submit-time rejections to be audited "lengkap dengan alasan dan hitungannya". Whether a rejected-at-submit attempt is persisted as a `buy_orders` row (status `ditolak`) or exists only in `audit_log` is undecided — yet `ditolak` is *also* the state a confirmed-path order enters at failed re-validation (FR-20). Same status, two lifecycle events, two possible persistence choices.

**Divergence:** The owner's order list shows rejected attempts in one build and not in the other; any consumer filtering "all orders" vs "orders that entered the queue" (FR-19's audit, H7's queue-set assembly) forks silently.

**Fix (convention):** Submit-time rejection is an audit event only — no `buy_orders` row is created (the order never entered Antrian Beli); `ditolak` as a *status* is reserved for orders that entered the queue and failed at confirmation. Or the opposite — but write it down.

## H12 — LOW: Audit event taxonomy and `details` schema are unconstrained

**Teams:** every team writes `audit_log` (AD-5 shows seven modules writing AUDIT).

**Gap:** AD-3 governs *when/how* entries are written, not the event vocabulary or `details` payload. FR-12 requires "alasan dan hitungannya" for rejections — each team invents its own field names. Divergence: COO's audit view (the only reader) can't render or filter uniformly; reconciliation tooling (AD-4's recompute comparator) can't parse heterogeneous `details`.

**Fix (convention):** Registry of event names (`order.submitted`, `order.withdrawn`, `order.expired`, `order.confirmed`, `order.rejected_at_confirmation`, `ledger.direct_input`, `rkap.adjusted`, …) + a minimal `details` envelope (e.g., `reason_code`, `computation` as structured JSON), declared in the spine's conventions table.

## H13 — LOW: Outbox table missing from AD-5's ownership list

**Teams:** A (order-notify-COO email, FR-19), D (OTP, reminders, FR-22/FR-3), proofs (Bukti, FR-11).

**Gap:** Conventions mandate "email after-commit via outbox sederhana" — a shared table written by ≥3 modules. AD-5's ownership enumeration doesn't mention it; the graph shows no outbox node. Two builds: one shared `outbox` table (who owns it?) vs three per-module tables (retry/regeneration semantics fork; "bukti dapat diregenerasi" monitoring splits).

**Fix (tighten AD-5):** Add outbox to one module's ownership (PROOFS is the natural home for a notifications/outbox concern, or an explicit infra owner) and declare all email sends go through its API.

---

## Checked and found adequately covered (non-holes)

- **Preview island vs server math** — AD-6 + shared/domain directly covers it (assembly caveat extracted as H7).
- **Float money** — AD-10 is explicit (integer-sen / decimal lib in `shared/domain`).
- **Both finalization doors atomic, incl. Fulfillment printing at confirmation** — AD-2 covers the happy-path contents (H2/H5 cover the writers it forgot).
- **Queued orders must NOT reserve RKAP space** — FR-23 states the asymmetry explicitly; spine inherits it.
- **Chart/table sync, owner-auto-appears** — AD-1/AD-4 projections cover it (modulo H1's "aktif" definition).
- **Deferred items** (chart library, registrant-expiry duration, Phase-2 sale) are declared decisions, not holes.

## Recommended AD changes (consolidated)

1. **New AD-11 (owner lifecycle):** single writer map + in-transaction flips for `pemegang saham`/`Keluar`/reactivation; define "Pembelian Pertama efektif" once; add graph edges.
2. **Tighten AD-2 (+AD-9):** order-row CAS + lock ordering (order → phase) for all three order-status writers; all RKAP mutators (manual adjust, item add, rebalancing, overshoot) serialize on the same per-phase lock with budget re-validation at commit.
3. **Tighten AD-7:** enumerate mechanical referral checks vs COO-judged cross-referral; define "hari yang sama".
4. **New AD (day semantics):** Asia/Jakarta calendar-day resolution for expiry, price effectiveness, same-day rules; fixed cron hour.
5. **Extend AD-6:** validation input assembly is a shared function (pending-set definition).
6. **Extend AD-10:** stored distribution amounts — full-precision basis, per-owner half-up rounding, remainder rule.
7. **Tighten AD-5:** payment fields on `ledger_transactions`; DIST→CONTRIBUTION edge + snapshot rekap; outbox ownership; migration/price-history FK decision.
8. **Conventions:** `ditolak`-at-submit persistence; audit event registry + system-actor shape.
