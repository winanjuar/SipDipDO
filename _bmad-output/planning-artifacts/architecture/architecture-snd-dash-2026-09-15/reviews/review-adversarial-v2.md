# Adversarial Review v2 — Architecture Spine (snd-dash, 2026-09-15)

**Verdict: HOLES-FOUND**

The AD set survives the obvious attacks it was visibly written against (dual mutation doors, duplicated formulas, PWA stale caches, atomicity loss via nested tx). But 14 constructed divergent pairs — two units that each pass every AD and every Do/Don't row, yet collide — expose gaps: **1 critical (a self-contradiction inside AD-2 itself), 7 high, 5 medium, 1 low**. Every pair below is a hole to close with a new or tightened AD; proposed rule text in the findings section.

---

## Constructed divergent pairs

### P1 — Penarikan: a non-status transition guarded by a status CAS
- **Unit A** (story: owner menarik pesanan — ORDERS) sets `buy_orders.withdrawn_at` plus an audit entry in one tx, leaving `status = 'menunggu_konfirmasi'` untouched (**compliant**: convention says "penarikan = event audit, bukan status", so it must not change status).
- **Unit B** (story: konfirmasi COO — ORDERS/LEDGER) guards confirmation with the CAS `WHERE status = 'menunggu_konfirmasi'` exactly as written (**compliant**: verbatim AD-2).
- **Collision:** the confirm guard cannot see the withdrawal flag → COO confirms an order the owner withdrew seconds earlier (payment had arrived anyway); race window is the entire confirm+MFA flow. Worse, AD-2 line "penarikan owner juga compare-and-set pada status" is **self-contradictory** — a transition that is not a status change cannot compare-and-set on status. Knock-on poison: the AD-6 canonical assembly "seluruh pesanan owner berstatus `menunggu_konfirmasi`" counts withdrawn orders → owner's next valid order rejected with a confident, wrong, hitungan; expiry cron fires on withdrawn orders.

### P2 — MFA OTP: verify-outside-tx vs consume-inside-tx
- **Unit A** (IDENTITAS, per the Dialog MFA UX) exposes a standalone `verifyOtp` endpoint that burns the code and returns a short-lived `mfa_token` the confirm endpoint later accepts (**compliant**: AD-8 specifies hashed / single-use / TTL menit — nothing binds verification to the finalization transaction or to one action).
- **Unit B** (ORDERS confirm endpoint) burns the OTP inside its own finalization tx via IDENTITAS API joining `tx` (**compliant**: Structural Seed tx-composition; AD-8 silent).
- **Collision:** (a) A's token is action-agnostic — an OTP requested for Input Langsung authorizes Konfirmasi, or a second action inside the TTL; (b) A's verify commits, B's finalize rolls back on re-validation failure → OTP burned with no transaction; retry demands a new email (SM-4 friction); (c) if the two stories ship as designed, the dialog and endpoint disagree on protocol → confirm permanently fails.

### P3 — Migration through the front door: events or storm
- **Unit A** (MIGRASI) appends all 22 owners' history via the LEDGER internal API exactly as the Migrasi convention demands (**compliant**).
- **Unit B** (LEDGER append + PROOFS) emits `Pembelian Pertama efektif` to IDENTITAS and writes a Bukti outbox row in-tx on every append, because the State convention says outbox rows are written "di dalam transaksi aksi terkait" — an append is the action (**compliant**).
- **Collision:** either a one-shot email storm of every historical Bukti at migration (SM-3 poisoned, provider throttled), or — if Unit A suppresses events/outbox to avoid the storm — §4.8 openness never opens and `Pembelian Pertama` state is never set for existing owners → go-live blocked with paying owners locked out of the dashboard. The spine never states which events/outbox rows the migration path suppresses versus propagates.

### P4 — Bukti Transaksi: "deterministic from ledger" at which point in time
- **Unit A** (PROOFS generation) builds the Bukti from the **current** projection: "Strength/Portion setelah transaksi" read from today's positions (**compliant** reading: "diregenerasi deterministik dari data ledger" — the projection is ledger-coupled per AD-4).
- **Unit B** (PROOFS retry path / unduh ulang) regenerates by replaying the ledger **up to the transaction's effective timestamp** (**equally compliant** reading).
- **Collision:** owner re-downloads March's Bukti in September (five transactions later) → A's PDF shows September's Portion under the heading "Portion setelah transaksi", differing from the original emailed PDF → owner concludes tampering. Same divergence between first send and any retry. Directly threatens SM-1/SM-3 trust.

### P5 — AD-2's lock ladder vs AD-11's rekap transaction
- **Unit A** (finalization service) locks buy_order → rkap_phase → position → owner, in that order (**compliant**: verbatim AD-2).
- **Unit B** (DISTRIBUSI rekap) locks the **owner row first** (AD-11: Keluar flip "di dalam transaksi rekap di bawah lock baris owner"), then reads positions and finalized points inside the rekap tx (**compliant**: verbatim AD-11).
- **Collision:** textbook AB-BA deadlock when a confirmation and a rekap overlap (A holds position, wants owner; B holds owner, wants position). Even without deadlock, B's positions read may be an inconsistent snapshot → Σ Portion ≠ 100% frozen into the immutable RUPS recap (AD-10). AD-2's ladder is scoped to "SELURUH penulis RKAP" only; the distribution/identity tx family sits outside every stated lock order.

### P6 — Money on the wire: string vs number
- **Unit A** (dashboard/preview API) returns Drizzle `numeric` values as JSON strings (`"52000.00"`) (**compliant**: AD-10 says nothing about the wire format).
- **Unit B** (preview island + a table component) coerces the payload with `Number()` for formatting convenience (**compliant** in its team's eyes: display, not "operasi aritmetika uang" — AD-10 bans only arithmetic).
- **Collision:** `shared/domain` functions receive `number` on one path and string on the other; `numeric(18,2)` exceeds 2^53 near the top of its range and float parsing silently degrades decimal-lib inputs → pratinjau klien ≠ validasi server on exactly the boundary inputs that matter. No wire contract, no sanctioned parse/serialize boundary, no lint hook.

### P7 — Portion computed on the server, percentages computed in the island
- **Unit A** (dashboard table, SSR) renders Portion via `shared/domain` on the server (**compliant**).
- **Unit B** (chart islands FR-18) computes wedge/donut percentages in-island from raw Shares with JS `shares/total` + `toFixed` for labels (**compliant** in its team's eyes: AD-6's enumerated formula list — Ceil, Shares, Strength, RTL, Quantity maksimal, batas penyesuaian, pembulatan, Dividen/Insentif/pool — **does not include Portion**; AD-10 covers uang, and a ratio is not uang).
- **Collision:** table shows 12,51% (decimal half-up) while the pie label shows 12,50% (float `toFixed`) on the same screen — FR-18 "ketiga chart selalu sinkron dengan tabel" and EXPERIENCE "dirender serentak" violated; a visible SM-1-class discrepancy born from an enumeration gap in AD-6.

### P8 — "Owner pemegang saham": stored lifecycle vs derived from shares
- **Unit A** (access middleware, AD-8) derives "Owner pemegang saham" as `positions.shares > 0`, live per request (**compliant** reading of §4.8 "terbuka setelah transaksi pertamanya efektif" — the two correlate today).
- **Unit B** (IDENTITAS, AD-11) stores the lifecycle status; access follows status (**compliant**: AD-11 makes IDENTITAS the sole writer of owner status).
- **Collision:** an AD-1 compensation entry (a legitimate Phase-1 correction) zeroes an owner's shares → Unit A silently revokes dashboard access, but per Glossary/FR-13 a (bekas) pemegang keeps full access while untired Contribution points remain — wrong lockout of a real owner. Mirror divergence in referral: "belum pernah membeli" via status vs via ledger-history disagree for a Keluar→reactivating never-buyer (submit offers a referral choice that confirm rejects — or the reactivated owner is wrongly forced/waived from referral). Note also: the order-status enum is pinned in the conventions table; **the owner status enum is pinned nowhere**.

### P9 — Which COO actions are MFA-gated
- **Unit A** (RKAP penyesuaian manual story) reads AD-8 "aksi transaksional COO wajib MFA" broadly → demands `otp_id` on the RKAP adjust endpoint (**compliant**: nothing contradicts it).
- **Unit B** (RKAP UI story) follows EXPERIENCE, where Dialog MFA exists only for Konfirmasi and Input Langsung → builds no MFA step (**compliant**: AD-8 binds to FR-3, which names only those two actions).
- **Collision:** RKAP adjustment becomes permanently unusable (endpoint demands an OTP the UI never collects); in the mirrored team split, price setting / cut-off / COO transfer acquire MFA in one story and not the next — governance controls drift per build agent.

### P10 — Canonical input assembly exists only for Strength
- **Unit A** (pratinjau island FR-1) assembles RKAP inputs as remaining space = Σ Final Requirement − Fulfillment(effective only), passing the raw rupiah remainder into `shared/domain`'s ceil (**compliant**: FR-23 — queued orders never reserve space).
- **Unit B** (submit validation and confirm re-validation, built as two stories) — one subtracts same-owner queued Tetap/Bergerak orders from remaining space "to be conservative", the other does not; both call the same AD-6 formulas correctly — the formula is shared, **the input assembly is not** (AD-6 canonicalizes only "posisi terkini + seluruh pesanan `menunggu_konfirmasi`" for Strength).
- **Collision:** preview advertises Quantity maksimal 861; confirm-time re-validation rejects above 800 — a "Ditolak dengan penjelasan hitungan" for an order the system itself proposed. The same ambiguity taints the pembulatan-atas/Quantity-Left toggle (depends on "sisa batas penyesuaian") and the limit formula's "harga beli 1 saham berjalan" (berjalan at phase creation? at submit? at finalization?).

### P11 — "Selalu sinkron" has no runtime contract (stale view, not stale cache)
- **Unit A** (dashboard SSR page) renders the table from the SSR payload at load time with no refetch strategy (**compliant**: AD-12 governs caches, not views; everything was online at load).
- **Unit B** (the installed-PWA tab that stays open two days while Unit C's transaction commits) still renders yesterday's Portion with zero staleness signal.
- **Collision:** not a cache — AD-12 untouched — but a stale **view**; EXPERIENCE bans "angka basi secara diam-diam" and FR-4 demands "selalu mutakhir", yet no AD forces refetch-on-focus/visibility or an as-of marker. Split-payload variant: SSR table + an island that fetches its own `/api` data on mount can render two instants mid-update on one screen.

### P12 — COO tenure checked at session time vs commit time
- **Unit A** (auth middleware) authorizes the COO role from the session at request time (**compliant**: AD-8 mandates middleware/route enforcement).
- **Unit B** (finalization tx) records the actor as the serving officer per FR-17 "saat itu" and re-validates tenure in-tx (**compliant**).
- **Collision:** tenure transfers between OTP verify and commit → a deposed COO's confirmation lands after the transfer and is recorded under the old officeholder (or the stale session role grants hours of access). Nothing pins where `coo_tenures` is authoritative.

### P13 — Two price periods sharing one effective date
- **Unit A** (pricing CMS) permits a corrected price with the same effective date as an existing period; "harga berjalan" resolves by latest created (**compliant**: FR-6 requires value + date + MoM reference, nothing more).
- **Unit B** (Harga Terkunci snapshot at submit) resolves "harga berjalan pada tanggal submit" with a different tiebreak (or none).
- **Collision:** preview locks price P1 while the stored snapshot / finalization uses P2 — same order, two prices; AD-7's "harga yang disepakati saat submit" broken by an unspecified tiebreak.

### P14 — "Ditandai selesai" vs "ditunaikan": points across multiple cut-offs
- **Unit A** (DISTRIBUSI recap) sums points from **all** finalized-but-untuned cut-off periods since the last recap (**compliant** reading of FR-16 "poin periode yang telah difinalkan cut-off", plural).
- **Unit B** (CONTRIBUTION cut-off + recap) uses only the latest finalized period; earlier periods' points were "ditandai selesai" at their cut-off and, in B's model, tuning is per cut-off (**equally compliant** reading).
- **Collision:** any RUPS cycle containing ≥2 cut-offs (explicitly allowed: "tanggal cut-off tidak harus bertepatan dengan tanggal RUPS") → the Insentif pool is divided over a different total-points denominator → owners paid wrong amounts, frozen into the immutable recap snapshot (AD-10).

---

## Findings by severity (with proposed AD text)

### Critical — 1

**F1 (P1) — Penarikan has no guard-visible representation; AD-2 self-contradiction.**
Incompatibility: withdrawal races confirmation CAS; canonical pending-order assembly and expiry cron count withdrawn orders → wrong Strength rejections on valid orders.
**Tighten AD-2 + conventions:** "Penarikan pesanan adalah transisi tersimpan sendiri: kolom `buy_orders.withdrawn_at timestamptz` (bukan status), di-set dalam SATU tx bersama entry audit via CAS `WHERE status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL`. SETIAP guard status pesanan (konfirmasi, kedaluwarsa cron) wajib memuat `AND withdrawn_at IS NULL`. Pesanan-pending didefinisikan kanonik: `status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL` — satu definisi dipakai pratinjau, validasi submit, re-validasi konfirmasi, dan cron." (Hapus kalimat "penarikan juga compare-and-set pada status" yang kontradiktif.)

### High — 7

**F2 (P2) — MFA OTP not bound to one action instance / one transaction.**
Incompatibility: cross-action token reuse; OTP burned on failed re-validation; protocol mismatch between dialog and endpoint.
**Tighten AD-8:** "OTP MFA terikat tepat satu instance aksi: baris `otp_codes` menyimpan `{action_type, target_ref}`; verifikasi DAN konsumsi terjadi di DALAM transaksi finalisasi (AD-2) melalui API IDENTITAS yang menerima `tx`. Tidak ada token MFA yang dapat dipakai lintas aksi atau lintas target; kegagalan re-validasi meng-rollback konsumsi OTP (retry tanpa email baru)."

**F3 (P3) — Migration event/outbox semantics undefined.**
Incompatibility: Bukti email storm at import, or openness/Pembelian-Pertama state never established for the 22 existing owners.
**Tighten konvensi Migrasi:** "Import migrasi memakai pintu finalisasi LEDGER lengkap (posisi, event Pembelian Pertama efektif, audit aktor `system`) NAMUN tidak menulis baris outbox email untuk transaksi berlabel migrasi; Bukti transaksi migrasi hanya regenerate-on-demand. Daftar event yang diteruskan vs disupres saat migrasi dideklarasikan eksplisit di modul MIGRASI dan diuji pada acceptance migrasi."

**F4 (P4) — Bukti regeneration temporal cutoff undefined.**
Incompatibility: retry/re-download after later transactions shows different 'setelah transaksi' numbers than the original email → tampering suspicion.
**Tighten konvensi State:** "Bukti Transaksi adalah fungsi murni dari state ledger PADA titik potong transaksi (posisi owner sesaat setelah transaksi tersebut). Regenerasi — retry outbox maupun unduh ulang — selalu menghitung pada titik potong yang sama; 'Portion/Strength setelah transaksi' tidak pernah dihitung dari posisi mutakhir."

**F5 (P5) — Lock ladder incomplete: rekap/identity tx family absent; snapshot consistency unpinned.**
Incompatibility: AB-BA deadlock between finalization and rekap; or inconsistent positions snapshot frozen into the immutable recap (ΣPortion ≠ 100%).
**Tighten AD-2/AD-11:** "Urutan lock AD-2 diperluas menjadi urutan GLOBAL seluruh keluarga transaksi penulis: `buy_orders → rkap_phases → positions → owners → contribution_periods → distribution`. Transaksi rekap DISTRIBUSI membaca posisi pada snapshot konsisten (REPEATABLE READ/SERIALIZABLE, atau lock sesuai urutan) sehingga ΣPortion snapshot internal konsisten; transisi status IDENTITAS yang digerakkan event mengikuti urutan yang sama."

**F6 (P6) — Money/ratio wire format and conversion boundary unpinned.**
Incompatibility: string-typed and number-typed money crossing into `shared/domain` on different paths → pratinjau ≠ validasi server on boundary inputs.
**Tighten AD-10:** "Kontrak kawat: seluruh nilai uang & ratio melewati batas API/SSR sebagai string desimal berskala tetap; `shared/domain` memuat SATU pasangan parse/serialize yang diizinkan; `Number()`/`parseFloat()` atas nilai uang/ratio dilarang di semua lapisan termasuk display — tambah baris Quick Reference Don't."

**F7 (P8) — Owner role/openness/referral derivation unstated; owner status enum unpinned.**
Incompatibility: shares-derived access wrongly locks out a (bekas) pemegang after a compensation entry; referral set diverges between submit and confirm for Keluar/reactivating owners.
**Tighten AD-8/AD-11:** "Enum siklus hidup owner dipinkan (mis. `diajukan/terverifikasi/ditolak/keluar` + `first_effective_at timestamptz`, di-set hanya oleh event Pembelian Pertama). Predikat akses (`aksesPenuh`), kewajiban referral (`perluReferral`), dan himpunan `pilihanReferral` adalah fungsi kanonik tunggal di IDENTITAS atas state itu — TIDAK PERNAH diturunkan dari `positions.shares` live; owner Keluar yang belum pernah membeli termasuk cakupan `perluReferral` dan `pilihanReferral`."

**F8 (P14) — Finalized-vs-tuned points accounting across cut-offs.**
Incompatibility: two compliant recap implementations divide the Insentif pool over different total-points denominators → wrong payouts, frozen into the immutable recap.
**Tighten AD-6/AD-10 (konvensi):** "Didefinisikan tegas: 'ditandai selesai' (cut-off, FR-10) ≠ 'ditunaikan' (rekap, FR-16). Rekap menjumlahkan poin dari SEMUA periode ter-finalisasi-belum-tertunaikan; penandaan tertunaikan atomik dengan penyimpanan rekap; istilah dan statusnya masuk Glossary konvensi."

### Medium — 5

**F9 (P7) — Portion absent from AD-6's formula enumeration; islands improvise ratios.**
Incompatibility: chart label (float `toFixed`) ≠ table value (decimal half-up) on one screen.
**Tighten AD-6:** "Portion dan seluruh persentase turunan chart termasuk rumus domain `shared/domain`; island chart menerima angka display siap-format dari payload atau mengimpor fungsi shared — tidak ada aritmetika rasio lokal di komponen."

**F10 (P9) — MFA-gated action set not enumerated.**
Incompatibility: endpoint/UI disagreement leaves RKAP adjustment unusable, or MFA coverage drifts per story.
**Tighten AD-8:** "Himpunan tertutup aksi ber-MFA Phase 1: konfirmasi (FR-20) dan input langsung (FR-21) — dan eksplisit BUKAN: penyesuaian RKAP, penetapan harga, cut-off, rebalancing, pergantian COO. Endpoint dan UI wajib mengacu himpunan yang sama; mengubah himpunan = mengubah AD ini."

**F11 (P10) — Canonical input assembly defined only for the Strength gate.**
Incompatibility: preview's Quantity maksimal ≠ re-validation's limit (861 vs 800) for an order the system itself proposed.
**Tighten AD-6:** "SETIAP gerbang validasi punya fungsi perakitan input kanonik: Strength (ada), ruang RKAP (= Σ Final Requirement − Fulfillment dari transaksi efektif SAJA; pesanan antrai tidak pernah mereservasi ruang, milik owner mana pun), sisa batas penyesuaian (Σ penyesuaian fase; 'harga 1 saham berjalan' = harga berjalan pada momen finalisasi). Pratinjau, validasi submit, dan re-validasi memanggil fungsi assembly yang sama."

**F12 (P11) — "Selalu sinkron / mutakhir" lacks a runtime contract.**
Incompatibility: long-lived installed tab serves two-day-old numbers with no signal; SSR table and island fetch can render different instants.
**Tighten AD-12:** "Permukaan bernilai domain wajib salah satu: (a) refetch penuh pada `visibilitychange`/focus, atau (b) penanda waktu data ('per …') yang diperbarui bersama payload. Tabel dan island pada halaman yang sama wajib mengonsumsi SATU payload bersama (SSR-embedded atau satu fetch) — tidak ada fetch domain independen per island pada render awal."

**F13 (P12) — COO tenure authority point unstated.**
Incompatibility: confirmations landing post-transfer recorded under the deposed officer; stale session grants access.
**Tighten AD-8:** "Kewenangan COO diautoritaskan di DALAM transaksi finalisasi (cek `coo_tenures` berlaku pada `now()`), bukan hanya di sesi/middleware; aktor audit = pejabat pada saat commit."

### Low — 1

**F14 (P13) — Same-effective-date price periods have no tiebreak.**
Incompatibility: preview and stored snapshot resolve different prices for one order.
**Tighten AD-7 (konvensi):** "Tepat satu baris `price_periods` per (jenis harga, tanggal efektif) — unique constraint; koreksi harga pada tanggal efektif yang sama = mengubah baris berjalan + audit, bukan baris kedua; 'harga berjalan pada tanggal X' selalu resolusi tepat satu baris."

---

## Summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 1 | F1 |
| High | 7 | F2, F3, F4, F5, F6, F7, F8 |
| Medium | 5 | F9, F10, F11, F12, F13 |
| Low | 1 | F14 |

**Verdict: HOLES-FOUND.** The spine's core paradigm (append-only ledger, single writer per table, shared formulas, CAS guards) holds under attack; the holes cluster at (1) the one transition deliberately excluded from the status enum (penarikan), (2) temporal semantics of regeneration/replay (Bukti, migration events), (3) unpinned derivation and enumeration points (owner state, MFA set, canonical assemblies), and (4) the global transaction/lock topology beyond the finalization family. All 14 are closeable with the proposed AD text above; none requires paradigm change.
