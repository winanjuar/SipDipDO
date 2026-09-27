# Epic 2 Context — Keputusan MRO: Harga, MoM & RKAP

## Goal
COO mencatat keputusan MRO: harga beli/jual dengan riwayat tertaut MoM, notulen MoM dua modus (tulis langsung + upload PDF dengan preview web), dan RKAP per fase. Semua owner (termasuk tanpa saham) dapat melihat harga & RKAP. Menyiapkan gerbang pembelian untuk Epic 3.

## Stories in Scope
- 2.1: MoM MRO/RUPS Tulis Langsung
- 2.2: Upload PDF MoM & Preview Web
- 2.3: CMS Harga Saham — Berjalan & Riwayat
- 2.4: Struktur RKAP: Fase & Capital Item
- 2.5: Penyesuaian RKAP Manual dalam Batas Agregat
- 2.6: Utilization, Achievement, Held & Rebalancing

---

## Key Requirements (FR)

**FR-6 — CMS Harga Saham:** COO mengelola harga beli/jual dengan tanggal efektif tertaut MoM. Setiap harga memiliki riwayat: nilai, tanggal efektif, referensi MRO.

**FR-7 — MoM MRO/RUPS:** COO menyimpan notulen dua modus — tulis langsung (termasuk draft) atau upload PDF. MoM tersimpan dengan tanggal dan dapat ditautkan ke keputusan (harga, jenis Contribution, cut-off).

**FR-23 — RKAP:** Daftar Capital Item dalam rupiah dengan tag jenis modal (Tetap/Bergerak — Operasional tidak masuk RKAP). Kolom: nama, jenis modal, Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held. Batas penyesuaian agregat per fase: (1% × total Initial) + 1 saham berjalan.

---

## Binding Architecture Decisions

| AD | Rule untuk Epic 2 |
|---|---|
| **AD-3** | Entry audit ditulis dalam transaksi DB yang sama dengan aksinya. Seluruh perubahan MoM, harga, RKAP wajib audit atomik. |
| **AD-5** | Kepemilikan tabel mutlak: **HARGA** owns `price_periods`, `moms`; **RKAP** owns `rkap_phases`, `rkap_capital_items`. Akses lintas modul lewat API/index.ts. |
| **AD-7** | Tepat SATU baris `price_periods` per (jenis harga, tanggal efektif) — unique constraint. Koreksi harga = mengubah baris + audit, bukan menambah baris kedua. |
| **AD-8** | Role & keterbukaan dienforce middleware + route handler. Owner tanpa saham boleh lihat harga & RKAP (read-only); edit hanya COO. |
| **AD-10** | Uang `numeric(18,2)`, ratio `numeric(9,6)` — melewati API/SSR sebagai string desimal. Aritmetika hanya di `shared/domain`. |

---

## Consistency Conventions

- **Tabel DB:** snake_case jamak (`price_periods`, `moms`, `rkap_phases`, `rkap_capital_items`).
- **Istilah UI:** term metrik English verbatim — Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held.
- **Jenis Modal:** `Modal Tetap` / `Modal Bergerak` (Operasional tidak masuk RKAP).
- **Tanggal:** disimpan `timestamptz` UTC; aturan kalender-hari (tanggal efektif harga) dihitung zona Asia/Jakarta via helper `shared/domain`.
- **Audit:** `{ actor, action, target, details }` — action dari registry `shared/domain/audit.ts`.

---

## Structural Seed (Modul Terlibat)

```
server/domain/pricing/     # HARGA & MoM
  index.ts                 # API publik
  pricing.repo.ts          # Drizzle queries
  pricing.service.ts       # Business logic

server/domain/rkap/        # RKAP
  index.ts
  rkap.repo.ts
  rkap.service.ts

drizzle/schema.ts          # Tabel baru: price_periods, moms, rkap_phases, rkap_capital_items
shared/domain/             # Rumus murni — batas penyesuaian RKAP, Quantity Left, Fulfillment Rate, dll.
```

---

## UX Contracts (DESIGN.md / EXPERIENCE.md)

**MoM:**
- Status Badge: draft → `warn`, final → `success`
- State kosong: "Belum ada MoM tersimpan."
- Owner pemegang saham dapat membaca; owner tanpa saham → permukaan terkunci (redirect Halaman Personal)

**Harga:**
- Terbuka untuk semua owner (termasuk tanpa saham)
- Tampilkan harga berjalan + seluruh riwayat (nilai, tanggal efektif, referensi MRO)

**RKAP:**
- **Tabel RKAP** dalam Card; kolom verbatim per FR-23
- Card ringkasan terpisah: batas penyesuaian (1% + 1 saham), tambahan aktual, persentase terpakai, Quantity Left
- Selector fase: berjalan (default) vs arsip
- Mobile (<lg): kolom nama sticky kiri dengan scroll horizontal
- Angka `tabular-nums` rata kanan
- Terbuka untuk semua owner (termasuk tanpa saham); edit hanya COO

---

## Data Model Sketch

```
moms (HARGA):
  id, tanggal, status ('draft'|'final'), content_text?, pdf_path?,
  finalized_at?, created_at, updated_at

price_periods (HARGA):
  id, price_type ('beli'|'jual'), effective_date, amount numeric(18,2),
  mom_id FK, created_at, updated_at
  UNIQUE(price_type, effective_date) — AD-7

rkap_phases (RKAP):
  id, name, mom_id FK, is_active, total_initial numeric(18,2),
  adjustment_used numeric(18,2), created_at, updated_at

rkap_capital_items (RKAP):
  id, phase_id FK, name, capital_type ('Modal Tetap'|'Modal Bergerak'),
  initial_requirement numeric(18,2), final_requirement numeric(18,2),
  utilization numeric(18,2), created_at, updated_at

-- Fulfillment, Fulfillment Rate, Shortfall, Achievement, Held = derived dari ledger plotting (Epic 3)
```

---

## Rumus Domain (`shared/domain`)

```typescript
// Batas penyesuaian per fase
batasPenyesuaian(totalInitial: Decimal, hargaSahamBeli: Decimal): Decimal
  = (totalInitial * 0.01) + hargaSahamBeli

// Persentase terpakai
persentaseTerpakai(adjustmentUsed: Decimal, batas: Decimal): Decimal
  = adjustmentUsed / batas * 100

// Fulfillment Rate (derived — data dari ledger Epic 3)
fulfillmentRate(fulfillment: Decimal, finalRequirement: Decimal): Decimal
  = fulfillment / finalRequirement * 100

// Shortfall
shortfall(finalRequirement: Decimal, fulfillment: Decimal): Decimal
  = finalRequirement - fulfillment

// Achievement
achievement(utilization: Decimal, fulfillment: Decimal): Decimal
  = utilization / fulfillment * 100

// Held
held(fulfillment: Decimal, utilization: Decimal): Decimal
  = fulfillment - utilization

// Quantity Left — untuk Epic 3, disiapkan sekarang
quantityLeft(shortfall: Decimal, hargaSahamBeli: Decimal, sisaBatas: Decimal): number
  // ceil bila overshoot tertampung; floor bila batas habis
```

---

## Verification Fixtures (Data Fase 1 Aktual)

- Total Initial Requirement: Rp250.000.000
- Batas penyesuaian: Rp2.500.000 (1%) + Rp52.000 (1 saham) = Rp2.552.000
- Terpakai: Rp2.484.000 (0,99%)
- Sisa Kekurangan: Rp44.744.000 → ceil = 861 saham × Rp52.000 = Rp44.772.000
- Overshoot: Rp28.000 (< sisa batas Rp68.000 ✓)
- Contoh item baru: Peralatan Lainnya, Modal Bergerak, 0 → 1.664.000

---

## File Upload (Story 2.2)

- PDF MoM disimpan di **Supabase Storage bucket privat** (AR-13)
- Preview via **signed URL berumur pendek** — akses hanya role berwenang
- Akses URL langsung tanpa sesi valid → ditolak (AD-8)
- Logo email: `logo.jpg` (latar putih) per UX-DR3
