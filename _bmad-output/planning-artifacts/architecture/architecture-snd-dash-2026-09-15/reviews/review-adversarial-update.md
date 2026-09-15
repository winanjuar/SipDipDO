# Adversarial Review — Update Round (AD-12 PWA)

- **Lens:** Adversarial — construct two units one level down (epics/stories built by different builders) that each obey every AD to the letter yet still build incompatibly.
- **Target:** `ARCHITECTURE-SPINE.md` (2026-09-15, status final, including new AD-12), against `EXPERIENCE.md` (2026-09-15, final) as bound ground truth.
- **Trigger:** AD-12 added post-finalization (PWA installable; cache aset statis/cangkang saja; data domain selalu daring; no offline write queue; offline = "Tidak dapat terhubung").
- **Method:** Story teams imagined building in parallel, consistent with round 1 lettering:
  - **Team G — PWA & platform** (new): manifest, icons, service worker config, install/update flow, caching headers.
  - **Team D — Dashboard & SSR pages** (FR-4/FR-5/FR-18): Nuxt pages, SSR data fetching.
  - **Team B — Finalization & MFA** (FR-20/FR-21): confirm/direct-input doors, Dialog MFA OTP.
  - **Team A — Forms & islands** (FR-1): order form, preview island, fetch composables.
  - **Team E — Distribution & identity ops** (FR-16/FR-13/FR-17): rekap RUPS, owner lifecycle flips.
- **Verdict: HOLES** — 1 CRITICAL, 3 HIGH, 4 MEDIUM. Round 1's thirteen fixes hold under re-inspection; the new holes cluster exactly where AD-12 introduces a new actor (the service worker and the manifest) whose boundaries are named in prose but not defined at story-review granularity, plus three pre-existing seams round 1's fixes left adjacent-open.

---

## Findings Summary

| # | Severity | Hole | Gap in | Suggested fix |
|---|---|---|---|---|
| U1 | CRITICAL | "Cangkang aplikasi" undefined for SSR — navigation documents carry the Nuxt payload (domain data + role-gated nav); a classic app-shell SW caches them and silently serves stale numbers | AD-12 | Define cangkang = fingerprinted build assets + manifest + icons + one static `/offline` shell; HTML/JSON never precached or runtime-cached; SSR HTML & Nuxt payload declared domain data |
| U2 | HIGH | "Selalu daring" governs only the service worker — HTTP `Cache-Control` on API routes and Nitro/Vercel `swr`/`isr` route rules serve stale domain data with the letter intact | AD-12, conventions | Clause: SSR documents & `/api/**` are `Cache-Control: no-store`; no `swr`/`isr`/server cache handlers on domain routes; immutable caching only for fingerprinted assets |
| U3 | HIGH | SW update lifecycle unowned (`prompt` vs `autoUpdate` + reload-on-`controllerchange`) — becomes a third canceller of the MFA OTP dialog and confirmation flows that EXPERIENCE says only Esc may cancel | AD-12, EXPERIENCE Dialog MFA OTP | Clause: `registerType: 'prompt'`, no `skipWaiting` auto-activation; update prompt suppressed inside transactional dialogs; reload only via explicit user action outside any open dialog |
| U4 | MEDIUM | Manifest `display`/`orientation`/installed-window width create a de facto third posture the `lg` convention doesn't govern (portrait lock, standalone window <lg, no browser back/URL, no hard refresh) | AD-12, Platform conventions | Clause: installed context is a viewport, not a posture — no orientation lock, `display: standalone`, posture derives solely from width vs `lg`; no capability keys off `display-mode` |
| U5 | MEDIUM | Offline UX ownership fork: SW-served static offline page vs app-level global "Tidak dapat terhubung" vs per-surface "Gagal muat" — and SW-synthesized API error bodies can break the `{ code, message, details }` envelope | AD-12, conventions, EXPERIENCE State Patterns | Clause: SW serves the offline shell only for failed document requests, rendering exactly the EXPERIENCE global state; SW never synthesizes API responses |
| U6 | HIGH | Owner-status transitions got writers (round-1 H1 fix) but no concurrency discipline — RUPS rekap Keluar-flip on a precomputed "tanpa saham" list races input-langsung reactivation; a shareholder ends up `Keluar` | AD-11, AD-2 | Extend AD-11: CAS on expected prior status; rekap re-validates `positions.shares = 0` inside the tx under owner-row lock; owner-row lock added to AD-2 lock ordering (order → phase → owner) |
| U7 | MEDIUM | AD-2's single transaction spans five modules (LEDGER writes RKAP plots, audit, outbox, identity flip) but no convention says exported module functions must join the caller's transaction — self-transacting module APIs can't compose into the atomic tx | AD-5, AD-2, Structural Seed | Convention: functions participating in cross-module transactions accept a tx handle; only top-level service functions open transactions; add Do/Don't row |
| U8 | MEDIUM | `otp_codes` is in the ERD (`owners ||--o{ otp_codes : "MFA COO"`) but absent from AD-5's ownership list — ORDERS vs IDENTITAS vs PROOFS each have a defensible claim (round-1 H13 pattern, one table missed) | AD-5 | Assign ownership (IDENTITAS natural), declare request/verify API + single-use CAS, add to AD-5 list |

---

## U1 — CRITICAL: "Cangkang aplikasi" is undefined for an SSR app — the navigation document is both shell and domain data

**Teams:** G (PWA) vs D (dashboard pages) and A (islands/fetch composables).

**Gap:** AD-12 says the service worker "hanya cache aset statis dan cangkang aplikasi" and "seluruh data domain selalu diambil daring saat halaman dimuat — service worker tidak pernah menjadi sumber data domain". In a classic SPA the app-shell model (Google PWA guidance, most vite-plugin-pwa examples) caches the route document (`/`, `index.html`) and lets APIs fetch live — there, "shell" and "data" are separable by URL. **In Nuxt SSR they are not.** A thin, fully-AD-compliant page (`pages/` tipis: parsing + panggil API + render) that uses Nuxt-idiomatic `useAsyncData`/`useFetch` gets its domain data fetched **on the server** and serialized into the HTML as the Nuxt payload. The document is simultaneously shell and domain data — and AD-12 never says which it is.

**Two compliant-but-incompatible builds:**

- **Build G1:** Team G, following the canonical app-shell pattern, precaches the root route (or sets `navigateFallback` to it / adds a network-first-with-cache-fallback `runtimeCaching` entry for navigation requests). By their reading: HTML = cangkang, `/api/**` JSON = data domain, always network. Letter of AD-12: satisfied.
- **Build D1:** Team D builds the dashboard exactly per the spine — thin page, projection read via server route, no client-side math (AD-6), SSR with embedded payload (the framework default, and the reason SSR was chosen). Letter of every AD: satisfied.

**Divergence produced:** offline (or any SW fallback path — flaky mobile network at a cafe, exactly UJ-1's context) the SW serves last week's dashboard HTML; it hydrates from its embedded payload with **stale positions, Portion, Strength** and no error state — the precise failure AD-12's "Prevents" clause exists to block ("angka domain usang tersaji dari cache"), reached while both teams pass story review. Worse secondary effect: SSR HTML also bakes in the **role-gated navigation** rendered by server middleware (AD-8). EXPERIENCE/AD-11 promise nav opens "saat login berikutnya" after Pembelian Pertama efektif — a cached pre-transition shell (cached while logged out, or from the previous session's role) defeats that: the installed app shows a login shell after login, or stale locked-nav after opening. Every document-level cache decision becomes an identity/posture decision that no AD assigns to Team G.

**Fix (tighten AD-12):** Add a definition clause: *"Cangkall aplikasi = aset build ter-fingerprint (JS/CSS/gambar), web app manifest, ikon, dan tepat satu halaman statis `/offline` — tidak lebih. Dokumen navigasi (HTML hasil SSR) dan payload Nuxt adalah data domain: tidak boleh di-precache, tidak boleh di-cache runtime, tidak ada `navigateFallback` selain `/offline`. Service worker dibangun dengan `generateSW` (config-driven) atau SW kustom yang direviu terhadap klausa ini."* Add a Do/Don't row: "Do: cache hanya aset fingerprint + `/offline` — Don't: precache/navigateFallback route HTML, runtime-cache dokumen atau `/api/**`".

---

## U2 — HIGH: "Data selalu daring" names only the service worker — the HTTP cache and Vercel/Nitro edge caching escape the invariant

**Teams:** G (PWA/perf story) vs D/A (any page or fetch composable).

**Gap:** AD-12's prohibition is scoped to "service worker tidak pernah menjadi sumber data domain". Two other cache layers sit in front of the same data and are configured by different stories:

1. **HTTP response caching:** a performance story adds `Cache-Control: max-age=…` (or nothing, inheriting Vercel defaults) to GET API routes like `/api/positions` or `/api/harga-berjalan`.
2. **Nitro/Vercel route rules:** the same story adds `routeRules: { '/dashboard': { swr: 60 } }` (or `isr`) — a one-line, officially-blessed Nuxt perf move.

**Two compliant-but-incompatible builds:** Build G2 caches nothing in the SW (correct per U1's fix) but ships `swr: 60` on `/dashboard` and a cache header on the positions API. Build D2 caches nothing anywhere. "Selalu diambil daring saat halaman dimuat" is **literally true** in G2 — a network request occurs; stale-while-revalidate then serves last minute's (or last deployment's) HTML while refreshing in the background. A confirmation committed 30 seconds ago is absent from the COO's dashboard; the owner's refreshed page and the COO's cached page disagree — an SM-1 trust failure no AD forbids.

**Fix (extend AD-12 + conventions Platform row):** *"Seluruh respons `/api/**` dan seluruh dokumen SSR dibawakan dengan `Cache-Control: no-store` (paling banyak `private, no-cache`); route rules `swr`/`isr`/`cachedEventHandler` dilarang untuk rute domain. Cache immutable hanya untuk aset ter-fingerprint."* This turns "selalu daring" from a sentence a reviewer must interpret into a header a reviewer can check.

---

## U3 — HIGH: The SW update lifecycle is unowned — a new deployment becomes a third canceller of the MFA OTP dialog

**Teams:** G (PWA install/update flow) vs B (finalization + Dialog MFA OTP).

**Gap:** AD-12 says nothing about **how a new service worker version activates** while an old one is open. `@vite-pwa/nuxt` offers `registerType: 'prompt'` and `'autoUpdate'`; the autoUpdate path in widespread examples pairs `skipWaiting` + `clientsClaim()` with a reload-on-`controllerchange` handler. Meanwhile EXPERIENCE.md's Dialog MFA OTP carries a hard contract: *"Esc membatalkan seluruh aksi — tidak ada transaksi setengah jadi"*, OTP is single-use with ~10-minute TTL, and form state must survive failures ("Data form dipertahankan").

**Two compliant-but-incompatible builds:**

- **Build G3:** autoUpdate + reload on controllerchange — "static assets only", AD-12-clean.
- **Build B3:** the MFA dialog and confirmation form built to that contract, assuming the only state-destroying events are Esc and completed submit.

**Race:** Rani opens Form Konfirmasi, requests OTP, is typing the 6 digits; a Vercel deployment lands (deployments happen during the day), the new SW activates, the page hard-reloads. The dialog vanishes — not via Esc, not via submit — mid-transactional flow. Outcomes: (a) OTP burned or TTL ticking with the form gone; re-request → cooldown 60s friction on a <5-minute SM-4 budget flow; (b) reload lands **after** submit dispatch: the confirm POST is in flight server-side (AD-2's CAS protects the ledger — round 1's fix holds, credit where due), Rani sees the queue again with the order apparently still `menunggu_konfirmasi`, retries, and gets a CAS-0-rows outcome whose UI meaning ("sudah diproses" vs "Ditolak") no AD or state pattern defines. Server state is safe; the *contract* "tidak ada transaksi setengah jadi" is not.

**Fix (extend AD-12):** *"Pembaruan service worker memakai `registerType: 'prompt'` tanpa `skipWaiting` otomatis; versi baru aktif saat muat natural berikutnya. Prompt pembaruan tidak boleh muncul di atas dialog transaksional (MFA, konfirmasi, input langsung, cut-off, penyesuaian RKAP); reload hanya atas aksi eksplisit pengguna di luar dialog yang terbuka."* Plus one state-pattern line: post-reload/discovery of an already-processed order renders "sudah diproses" from fresh state, not a rejection.

---

## U4 — MEDIUM: The manifest creates a de facto third posture the `lg` convention does not govern

**Teams:** G (manifest/install assets) vs the posture convention (AD-12, EXPERIENCE Responsive & Platform).

**Gap:** AD-12/EXPERIENCE define exactly two postures keyed to one breakpoint (`lg`, viewport width). The web app manifest adds posture-adjacent signals no AD governs: `display: 'standalone' | 'minimal-ui' | 'browser'`, `orientation`, `display_override`, splash/theme. A standalone window on desktop (Chrome/Edge install, Safari "Add to Dock") can be **resized below 1024px**; a tablet install honors an orientation lock.

**Two compliant-but-incompatible builds:**

- **Build G4:** manifest with `display: 'standalone'`, `orientation: 'portrait-primary'` (mobile-owner mental model), mobile-framed splash/icons.
- **Build D4 (pages):** pure responsive, posture = viewport width, nothing keys off display mode.

**Divergence:** the COO installs the PWA on a desktop or tablet: a <lg standalone window renders the mobile bottom-nav posture **with no browser back button, no URL bar, and no hard-refresh affordance** — EXPERIENCE's permission-denied flow ("URL langsung → redirect ke Halaman Personal") and its recovery gestures silently assume browser chrome that no longer exists; an orientation-locked tablet forces portrait on the "alur berat COO" that must be functional everywhere. Same viewport width, different capability set depending on install state — a third posture by construction, violating the spirit of "tanpa kapabilitas yang hanya hidup di satu postur" while violating no letter. Loss of hard refresh also makes the SW update path (U3) the *only* refresh path for installed users — the two findings compound.

**Fix (extend AD-12):** *"Konteks terpasang (installed) adalah viewport, bukan postur: manifest memakai `display: 'standalone'` dan TIDAK menyetel `orientation`; seluruh perilaku postur tetap diturunkan semata dari lebar viewport terhadap `lg`; tidak ada kapabilitas yang boleh meng-key off `display-mode`/`standalone` selain affordance prompt instalasi."* Note for the UX doc: standalone context needs an in-app back affordance decision.

---

## U5 — MEDIUM: Offline UX has three uncoordinated owners — SW fallback page, the global state, and per-surface error states

**Teams:** G (offline fallback) vs D/A (page-level fetch states).

**Gap:** AD-12: "kondisi tanpa koneksi tetap menyajikan status 'Tidak dapat terhubung' (EXPERIENCE.md)". EXPERIENCE.md defines **two** different failure presentations: global "Tidak terjangkau → 'Tidak dapat terhubung.' + Coba lagi" and per-surface "Gagal muat → 'Tidak dapat muat data.' + Coba lagi". Nothing says **which layer renders which**: the SW intercepting a failed navigation can serve a static offline page; or the app can render the global state after a failed document fetch; loaded pages with failing API fetches render per-surface states.

**Two compliant-but-incompatible builds:** Build G5 ships its own `/offline.html` with its own markup and its own Coba-lagi (full reload semantics). Build D5/A5 never cache documents, so offline navigation shows the browser's native error (the "dinosaur"), while in-app fetch failures show EXPERIENCE states with envelope-shaped errors. Users see three different offline faces depending on phase of load; if G5's SW also synthesizes fetch responses for `/api/**` (a common "offline UX" hardening), the synthesized body shape forks from the `{ code, message, details }` convention and islands' error handling forks with it.

**Fix (extend AD-12):** *"Service worker menyajikan shell `/offline` hanya untuk permintaan dokumen yang gagal — dan isinya adalah persis status global 'Tidak dapat terhubung' + Coba lagi dari EXPERIENCE.md (Coba lagi = navigasi ulang penuh). Service worker tidak pernah mensintesis respons API: kegagalan fetch diteruskan apa adanya dan dirender oleh state pattern permukaan terkait."*

---

## U6 — HIGH (re-attack of the H1 fix): Owner-status transitions have writers but no concurrency discipline — the RUPS rekap can mark a shareholder `Keluar`

**Teams:** E (distribution rekap, FR-16) vs B (input langsung finalization, FR-21) vs identity ops (Manajemen Owner reaktivasi).

**Gap:** Round 1's H1 fix (now AD-11) assigned ownership — only IDENTITAS writes owner status, transitions are reactions, one function called "dari alur finalisasi (AD-2) dan rekap". But the H2 lesson (compare-and-set or lose to races) was applied to `buy_orders.status` only. Owner status has **three concurrent entry points** — finalization (reactivation), rekap (→ Keluar), COO manual reactivation — with (a) no CAS on the expected prior status, (b) no lock-order position for the owner row (AD-2's ordering stops at "baris pesanan dulu, lalu baris fase RKAP"), and (c) no freshness rule for the rekap's eligibility set ("owner tanpa saham yang bagian Insentif-nya ditunaikan").

**Two compliant-but-incompatible builds:**

- **Build E6:** rekap tx reads the eligible zero-share owners, then calls IDENTITAS's transition function **by owner id** — no re-check of `positions.shares` inside the tx.
- **Build B6:** input langsung appends the ledger row and flips reactivation inside the same AD-2 transaction, by the book.

**Race (both letter-compliant):** during RUPS (precisely when cash purchases at the cafe get recorded as input langsung), the rekap's snapshot captures owner X at shares=0; X's finalization commits (X now holds shares, reactivated); the rekap then flips X → `Keluar` by id. Result: a **shareholder whose access is revoked to Halaman Personal**, invisible to the openness matrix, repairable only by manual COO surgery — the single worst trust incident this system can have, and no AD was violated on the way in. The mirror race (manual reaktivasi vs rekap) and reactivation-vs-first-purchase double-flip follow the same shape.

**Fix (extend AD-11, one clause in AD-2):** *Every owner-status transition is a compare-and-set on the expected prior status inside one DB transaction; the rekap's → Keluar flip must re-validate `positions.shares = 0` under the owner-row lock inside the rekap transaction (eligible-set is advisory, re-validation is authoritative — mirror of AD-2's re-validate-at-commit). Lock ordering extended: baris pesanan → fase RKAP → baris owner.*

---

## U7 — MEDIUM (re-attack, H13-adjacent): The single AD-2 transaction spans five modules, but no convention makes module APIs composable into it

**Teams:** B (finalization orchestrator in LEDGER) vs the owned modules it must write through — RKAP (plotting), AUDIT (entry), PROOFS (outbox row), IDENTITAS (lifecycle flip).

**Gap:** AD-2 requires ONE database transaction containing ledger append + order CAS + payment fields + RKAP plotting + instant adjustment + audit entry (+ per AD-11, the identity flip; per conventions, the outbox row). AD-5 requires every one of those tables to be touched only via the owning module's `index.ts`. What it never says is **how a callee joins the caller's transaction**. The module seed (`*.service.ts`, `*.repo.ts` as "satu-satunya tempat query Drizzle") is silent on transaction propagation.

**Two compliant-but-incompatible builds:** Team RKAP ships `allocateCapitalItem(input)` — self-transacting (`db.transaction(...)` inside), perfectly obeying AD-5's index.ts rule and its own atomicity. Team LEDGER's orchestrator needs `allocateCapitalItem(tx, input)` to compose everything into the AD-2 transaction. The API shapes cannot compose; discovered at integration. The dangerous resolution: a builder "fixes" it by calling the sequence **outside** the transaction (each function committing its own tx) — lint-clean against every current rule, and AD-2's atomicity is silently gone: a crash between ledger append and plotting yields exactly the half-done transaction AD-2 exists to prevent.

**Fix (convention + Structural Seed note):** *Fungsi modul yang berpartisipasi dalam transaksi modul lain menerima handle transaksi (tx) sebagai parameter; fungsi repo bergabung pada tx eksternal bila diberikan; hanya service di level teratas yang boleh membuka transaksi baru.* Add a Do/Don't row: "Do: operasi lintas modul dalam satu tx via fungsi yang menerima tx — Don't: service yang membuka transaksinya sendiri di jalur finalisasi".

---

## U8 — MEDIUM (re-attack, the H13 pattern missed a table): `otp_codes` is in the ERD but owned by no module

**Teams:** B (MFA at the confirmation doors) vs D/identity (FR-17 COO change, owner-scoped security data) vs PROOFS (OTP email delivery).

**Gap:** The ERD declares `owners ||--o{ otp_codes : "MFA COO"`. AD-5's ownership enumeration — updated in round 1 to add the outbox — lists IDENTITAS (owner/profile/role/coo_tenures), LEDGER, RKAP, HARGA, CONTRIBUTION, DISTRIBUSI, AUDIT, PESANAN (buy_orders), PROOFS (outbox email). **`otp_codes` is absent.** Three defensible claimants: ORDERS (MFA gates its two doors), IDENTITAS (security state hanging off owner; FR-17 COO tenure changes must invalidate/re-target OTP issuance), PROOFS (delivery concern).

**Two compliant-but-incompatible builds:** Build B8 puts `otp_codes` under `orders/` with verify-then-confirm coupled to the confirm service; Build D8 puts it under `identity/` as a generic request/verify API with single-use CAS, TTL, and hashed storage, called by any transactional action. The hashed/single-use/TTL semantics (AD-8), the audit line "semua permintaan MFA tercatat audit trail" (whose writer?), and COO-change invalidation semantics all fork between builds — for the system's **MFA** mechanism.

**Fix (tighten AD-5):** Assign `otp_codes` to IDENTITAS (owner-scoped security state; natural home for FR-17 interactions), declare the public API (`requestOtp(actor, purpose)` / `verifyOtp` with single-use CAS on the row), and add the table to AD-5's ownership list.

---

## Checked and found adequately covered (non-holes)

- **No offline write queue** — AD-12's ban is explicit and mirrored in Do/Don't and Deferred ("PWA baca luring ditolak"); no second mutation path can be built compliantly.
- **Islands vs SW** — `shared/domain` is build-time code; the SW cannot affect preview/server parity (AD-6 unaffected by AD-12 at the formula level — the payload vector is U1, not the island).
- **Manifest/icons as static assets** — uncontentious under any reading of "aset statis".
- **Two-posture single-codebase rule itself** — clear and consistently stated (AD-12 + conventions + EXPERIENCE); U4 is about the manifest, not this rule.
- **EXPERIENCE.md consistency** — "kanal email saja", light-only, and the global unreachable state are coherent with AD-12; the gap is ownership of rendering (U5), not contradiction.
- **Round-1 fixes under re-inspection** — AD-2 CAS/lock ordering, AD-6 assembly function, AD-7 referral split, AD-9 Jakarta day-basis, AD-10 distribution rounding, payment fields on `ledger_transactions`, outbox ownership, audit actor shape: all re-read; each closes its original hole (U6/U7/U8 are *adjacent* seams those fixes left open, not regressions).

## Recommended AD changes (consolidated)

1. **Tighten AD-12 (U1):** define cangkall aplikasi (fingerprinted assets + manifest + icons + one static `/offline` page); never precache/runtime-cache documents or `/api/**`; `navigateFallback` only to `/offline`; SSR HTML & Nuxt payload = data domain; `generateSW` or reviewed custom SW.
2. **Tighten AD-12 + conventions (U2):** `Cache-Control: no-store` for all domain documents/API responses; `swr`/`isr`/server-side cache handlers forbidden on domain routes.
3. **Tighten AD-12 (U3):** `registerType: 'prompt'`, no auto-`skipWaiting` reload; update prompt suppressed over transactional dialogs; reload only by explicit user action; define post-reload "sudah diproses" rendering.
4. **Tighten AD-12 (U4):** installed context is a viewport, not a posture — no `orientation`, `display: 'standalone'`, nothing keys off `display-mode` except the install prompt.
5. **Tighten AD-12 (U5):** SW serves `/offline` shell only for failed document requests, content = EXPERIENCE global state; SW never synthesizes API responses.
6. **Extend AD-11 + one clause in AD-2 (U6):** CAS on owner-status transitions; rekap re-validates shares=0 in-tx under owner-row lock; lock order order → phase → owner.
7. **Convention + Structural Seed (U7):** tx-handle propagation across module APIs; only top-level services open transactions; Do/Don't row.
8. **Tighten AD-5 (U8):** assign `otp_codes` to IDENTITAS with request/verify API + single-use CAS; add to ownership list.
