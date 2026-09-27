# Story 2.4: Struktur RKAP — Fase dan Capital Item

> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.4 mengimplementasikan struktur dasar RKAP (Rencana Kebutuhan Alokasi Permodalan) dengan konsep Fase dan Capital Item. Owner dapat melihat tabel RKAP dengan progress per jenis modal, sedangkan COO dapat membuat fase baru dan menambah Capital Item.

---

## Requirements yang Dipenuhi

### Req-5: Struktur RKAP — Fase dan Capital Item

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Fase RKAP tersimpan dengan referensi mom_id wajib dan status "berjalan" | ✅ |
| 2 | Capital Item tersimpan dengan nama, jenis modal (Tetap/Bergerak), Initial Requirement | ✅ |
| 3 | Initial Requirement terkunci setelah fase aktif | ✅ |
| 4 | Tabel RKAP menampilkan 10 kolom verbatim (sesuai spec) | ✅ |
| 5 | Baris agregat per jenis modal (subtotal Tetap, subtotal Bergerak) | ✅ |
| 6 | Selector fase dengan default "berjalan" dan opsi arsip | ✅ |
| 7 | Mobile: kolom nama sticky di kiri dengan scroll horizontal | ✅ |
| 8 | Empty state "Belum ada fase RKAP." jika belum ada data | ✅ |
| 9 | Audit trail mencatat perubahan fase/item | ✅ |

### Req-6: Akses RKAP berdasarkan Role

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Owner tanpa saham dapat melihat RKAP (read-only) | ✅ |
| 2 | Owner pemegang saham dapat melihat RKAP (read-only) | ✅ |
| 3 | COO dapat melihat dan edit RKAP | ✅ |
| 4 | Non-COO yang coba edit via API ditolak dengan HTTP 403 | ✅ |

### Req-14: Integrasi MoM sebagai Referensi Keputusan

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Pembuatan fase RKAP wajib memilih MoM final | ✅ |
| 4 | Dropdown MoM hanya menampilkan MoM final | ✅ |
| 5 | mom_id tersimpan sebagai foreign key not nullable | ✅ |

---

## Arsitektur & Alur Data

### Pembuatan Fase Flow

```
COO Browser                  API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  POST /api/rkap/fase       │                            │                        │
    │──────────────────────────>│                            │                        │
    │   { name, momId, items }  │                            │                        │
    │                            │  buatFase()                │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  validate MoM final    │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  INSERT rkap_phases    │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  INSERT capital_items  │
    │                            │                            │  (batch)               │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  write audit           │
    │                            │                            │  'rkap-phase-created'  │
    │                            │<──────────────────────────│                        │
    │   201 Created             │                            │                        │
    │   + RkapPhaseWire         │                            │                        │
    │<──────────────────────────│                            │                        │
```

### Tampilan Tabel Flow

```
Browser                      API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  GET /api/rkap/fase/[id]   │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  getFaseWithItems()        │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  SELECT phase + items  │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │                            │                        │
    │                            │                            │  calculate derived     │
    │                            │                            │  fields (fulfillment,  │
    │                            │                            │  achievement, held)    │
    │                            │<──────────────────────────│                        │
    │   { phase, items[],       │                            │                        │
    │     summary }             │                            │                        │
    │<──────────────────────────│                            │                        │
```

---

## Database Schema

### rkap_phases Table

```sql
CREATE TYPE rkap_phase_status AS ENUM ('berjalan', 'arsip');

CREATE TABLE rkap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status rkap_phase_status NOT NULL DEFAULT 'berjalan',
  mom_id UUID NOT NULL REFERENCES moms(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rkap_phases_status_idx ON rkap_phases(status);
```

### capital_items Table

```sql
CREATE TYPE capital_type AS ENUM ('tetap', 'bergerak');

CREATE TABLE capital_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES rkap_phases(id),
  name TEXT NOT NULL,
  capital_type capital_type NOT NULL,
  initial_requirement NUMERIC(18,2) NOT NULL,
  final_requirement NUMERIC(18,2) NOT NULL,
  utilization NUMERIC(18,2) NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX capital_items_phase_idx ON capital_items(phase_id);
CREATE INDEX capital_items_capital_type_idx ON capital_items(capital_type);
```

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `shared/domain/rkap.ts` | Wire types dan calculation functions |
| `shared/domain/rkap.test.ts` | Unit tests untuk calculations |
| `server/domain/rkap/rkap.repo.ts` | Repository layer untuk RKAP tables |
| `server/domain/rkap/rkap.service.ts` | Service layer dengan buatFase, listFases, getFaseWithItems |
| `server/domain/rkap/rkap.service.test.ts` | Integration tests |
| `server/domain/rkap/index.ts` | Module exports |
| `server/api/rkap/fase/index.get.ts` | List phases |
| `server/api/rkap/fase/index.post.ts` | Create phase (COO) |
| `server/api/rkap/fase/[id].get.ts` | Get phase with items |
| `server/api/rkap/fase/[id].put.ts` | Archive phase (COO) |
| `server/api/rkap/fase/[id]/items.post.ts` | Add item (COO) |
| `app/pages/rkap/index.vue` | Halaman RKAP dengan tabel dan selector fase |
| `app/components/rkap/RkapTable.vue` | Komponen tabel dengan 10 kolom |
| `app/components/rkap/AdjustmentSummaryCard.vue` | Ringkasan batas penyesuaian |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `drizzle/schema.ts` | Tambah rkapPhaseStatus, capitalType enum, rkapPhases, capitalItems tables |
| `shared/domain/audit.ts` | Tambah events `rkap-phase-created`, `rkap-item-added` |
| `shared/domain/index.ts` | Export RKAP types |

---

## Cara Mengakses Fitur

### Melihat RKAP (Semua Owner)

1. Login sebagai owner atau COO
2. Klik menu **RKAP** di sidebar
3. Jika ada fase, tabel RKAP akan tampil dengan:
   - Selector fase (default: fase berjalan)
   - Card ringkasan batas penyesuaian (untuk COO)
   - Tabel dengan 10 kolom
4. Jika belum ada fase, tampil pesan "Belum ada fase RKAP."

### Membuat Fase Baru (COO Only)

1. Login sebagai COO
2. Navigasi ke **RKAP**
3. Klik tombol **Buat Fase Baru**
4. Isi form:
   - **Nama Fase:** contoh "Fase 1 - 2026"
   - **Referensi MoM:** pilih MoM yang sudah final
   - **Capital Items:** tambahkan minimal satu item
     - Nama item
     - Jenis modal: Tetap atau Bergerak
     - Initial Requirement (Rupiah)
5. Klik **Simpan**

### Menambah Capital Item (COO Only)

1. Di halaman RKAP, pilih fase yang ingin ditambah item
2. Klik tombol **Tambah Item**
3. Isi form:
   - **Nama Item:** contoh "Renovasi Outlet A"
   - **Jenis Modal:** Tetap atau Bergerak
   - **Final Requirement:** nilai kebutuhan (Initial akan otomatis 0)
4. Klik **Simpan**

---

## Kolom Tabel RKAP (Verbatim)

| # | Kolom | Deskripsi | Stored/Derived |
|---|-------|-----------|----------------|
| 1 | Nama | Nama Capital Item | Stored |
| 2 | Jenis Modal | Tetap atau Bergerak | Stored |
| 3 | Initial Requirement | Kebutuhan awal (terkunci) | Stored |
| 4 | Final Requirement | Kebutuhan akhir (adjustable) | Stored |
| 5 | Fulfillment | Akumulasi transaksi teralokasi | Derived |
| 6 | Fulfillment Rate | Fulfillment ÷ Final Requirement | Derived |
| 7 | Shortfall | Final Requirement − Fulfillment | Derived |
| 8 | Utilization | Realisasi penggunaan (COO input) | Stored |
| 9 | Achievement | Utilization ÷ Fulfillment | Derived |
| 10 | Held | Fulfillment − Utilization | Derived |

---

## Wire Types

```typescript
interface RkapPhaseWire {
  id: string
  name: string
  status: 'berjalan' | 'arsip'
  momId: string
  momTitle: string
  items: CapitalItemWire[]
  summary: RkapPhaseSummary
}

interface CapitalItemWire {
  id: string
  name: string
  capitalType: 'tetap' | 'bergerak'
  initialRequirement: string  // decimal string
  finalRequirement: string    // decimal string
  fulfillment: string         // decimal string
  fulfillmentRate: string     // decimal string (percentage)
  shortfall: string           // decimal string
  utilization: string         // decimal string
  achievement: string         // decimal string (percentage)
  held: string                // decimal string
}
```

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| AD-2 | SELECT FOR UPDATE untuk locking saat adjustment |
| AD-3 | Audit entries dalam transaksi sama |
| AD-5 | RKAP module owns rkap_phases, capital_items, rkap_adjustments |
| AD-6 | Calculation functions di shared/domain/rkap.ts |
| AD-8 | Role validation di server boundary |
| AD-10 | Semua nilai money sebagai numeric(18,2), string via API |

---

## Testing

### Unit Tests

- `shared/domain/rkap.test.ts` — Calculation functions
  - calculateFulfillmentRate
  - calculateAchievement
  - calculateHeld
  - calculateAdjustmentLimit (dengan data Req-10)

### Integration Tests

- `server/domain/rkap/rkap.service.test.ts`
  - Phase creation with MoM validation
  - Item creation with Initial=0
  - Locking mechanism

---

## Contoh Data (Req-10)

| Item | Jenis | Initial Req | Final Req | Fulfillment | Util | Achievement | Held |
|------|-------|-------------|-----------|-------------|------|-------------|------|
| Renovasi Outlet A | Tetap | Rp100.000.000 | Rp100.000.000 | Rp45.000.000 | Rp40.000.000 | 88,89% | Rp5.000.000 |
| Pembelian Mesin | Tetap | Rp80.000.000 | Rp82.000.000 | Rp82.000.000 | Rp80.000.000 | 97,56% | Rp2.000.000 |
| **Subtotal Tetap** | | **Rp180.000.000** | **Rp182.000.000** | **Rp127.000.000** | | | |
| Modal Kerja | Bergerak | Rp70.000.000 | Rp70.000.000 | Rp50.000.000 | Rp48.000.000 | 96,00% | Rp2.000.000 |
| **Subtotal Bergerak** | | **Rp70.000.000** | **Rp70.000.000** | **Rp50.000.000** | | | |
| **TOTAL** | | **Rp250.000.000** | **Rp252.000.000** | **Rp177.000.000** | | | |

---

*Dokumentasi Story 2.4 — Sip & Dip Ownership Dashboard*
