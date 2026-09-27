# Story 2.5: Penyesuaian RKAP Manual dalam Batas Agregat

> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.5 mengimplementasikan kemampuan COO untuk menyesuaikan Final Requirement item RKAP dan menambah Capital Item baru, dengan validasi batas agregat yang dihitung dari kesepakatan MRO. Sistem memastikan penyesuaian tidak melebihi batas yang diperbolehkan.

---

## Requirements yang Dipenuhi

### Req-7: Naikkan Final Requirement

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | COO dapat menaikkan Final Requirement item eksisting | ✅ |
| 2 | Selisih tercatat sebagai penyesuaian | ✅ |
| 3 | Audit event `rkap-item-adjusted` tercatat dengan detail | ✅ |

### Req-8: Tambah Capital Item Baru

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Item baru memiliki Initial=0, Final=nilai input | ✅ |
| 2 | Nilai penuh item dihitung sebagai penyesuaian agregat | ✅ |
| 3 | Audit event `rkap-item-added` tercatat | ✅ |
| 4 | Membuka ruang pembelian jenis modal tersebut | ✅ |

### Req-9: Validasi Batas Penyesuaian Agregat

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Adjustment Limit = (1% × total Initial Requirement) + harga beli 1 saham | ✅ |
| 2 | Penjumlahan semua penyesuaian: otomatis + manual + item baru | ✅ |
| 3 | Penolakan dengan Alert Terhitung jika melebihi batas | ✅ |
| 4 | Validasi dalam transaksi DB untuk menghindari race condition | ✅ |

### Req-10: Tampilan Ringkasan Batas Penyesuaian

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Card ringkasan: batas, terpakai, persentase, Quantity Left | ✅ |
| 2 | Dialog konfirmasi menampilkan sisa batas | ✅ |
| 3 | Format tabular-nums untuk semua angka | ✅ |
| 4 | Data Req-10: 250jt → batas 2.552.000; terpakai 2.484.000; sisa 68.000 | ✅ |

---

## Arsitektur & Alur Data

### Adjustment Flow dengan Validasi Batas

```
COO Browser                  API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  PUT /api/rkap/fase/[id]/  │                            │                        │
    │       adjust               │                            │                        │
    │  { itemId, newFinal }      │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  adjustItem()              │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │                        │
    │                            │                            │  BEGIN TRANSACTION     │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  SELECT FOR UPDATE     │
    │                            │                            │  (lock phase)          │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │                            │                        │
    │                            │                            │  calculate limit       │
    │                            │                            │  get current price     │
    │                            │                            │  sum adjustments       │
    │                            │                            │                        │
    │                            │                            │  IF exceeds limit:     │
    │                            │                            │    ROLLBACK + error    │
    │                            │                            │  ELSE:                 │
    │                            │                            │    UPDATE item         │
    │                            │                            │    INSERT adjustment   │
    │                            │                            │    write audit         │
    │                            │                            │    COMMIT              │
    │                            │                            │──────────────────────>│
    │                            │<──────────────────────────│                        │
    │   200 OK / 400 Error      │                            │                        │
    │<──────────────────────────│                            │                        │
```

### Rumus Batas Penyesuaian

```
Adjustment_Limit = (1% × Total_Initial_Requirement) + Harga_Beli_1_Saham

Contoh (Req-10):
- Total Initial Requirement = Rp250.000.000
- 1% = Rp2.500.000
- Harga Beli = Rp52.000
- Adjustment Limit = Rp2.500.000 + Rp52.000 = Rp2.552.000
```

---

## Database Schema

### rkap_adjustments Table

```sql
CREATE TABLE rkap_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES rkap_phases(id),
  item_id UUID REFERENCES capital_items(id),  -- nullable untuk new item
  adjustment_type TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  mom_id UUID REFERENCES moms(id),  -- nullable, wajib untuk rebalance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rkap_adjustments_phase_idx ON rkap_adjustments(phase_id);
```

### Adjustment Types

| Type | Deskripsi | Counts Toward Limit |
|------|-----------|---------------------|
| `manual_increase` | Kenaikan Final Requirement | ✅ Ya |
| `new_item` | Item baru (Initial=0) | ✅ Ya |
| `overshoot` | Otomatis dari transaksi | ✅ Ya |
| `rebalance_out` | Transfer keluar | ❌ Tidak |
| `rebalance_in` | Transfer masuk | ❌ Tidak |

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `server/api/rkap/fase/[id]/adjust.put.ts` | Adjust item endpoint (COO) |
| `app/components/rkap/AdjustmentDialog.vue` | Dialog adjustment dengan sisa limit |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `shared/domain/rkap.ts` | Tambah calculateAdjustmentLimit function |
| `server/domain/rkap/rkap.service.ts` | Implement adjustItem dengan validation |
| `server/domain/rkap/rkap.repo.ts` | Implement sumAdjustmentsByPhase |
| `shared/domain/audit.ts` | Tambah event `rkap-item-adjusted` |
| `app/pages/rkap/index.vue` | Integrasi adjustment flow |
| `app/components/rkap/RkapTable.vue` | Tombol adjust untuk COO |
| `app/components/rkap/AdjustmentSummaryCard.vue` | Display limit info |

---

## Cara Mengakses Fitur

### Menyesuaikan Final Requirement (COO Only)

1. Login sebagai COO
2. Navigasi ke **RKAP**
3. Di tabel RKAP, temukan item yang ingin disesuaikan
4. Klik tombol **Adjust** di baris item
5. Dialog akan menampilkan:
   - Nilai saat ini
   - Input nilai baru
   - Sisa batas penyesuaian
6. Masukkan nilai baru (harus lebih besar dari nilai saat ini)
7. Klik **Simpan**
8. Jika melebihi batas, akan muncul pesan error dengan detail perhitungan

### Melihat Ringkasan Batas (COO Only)

1. Di halaman RKAP, lihat card **Ringkasan Batas Penyesuaian**
2. Card menampilkan:
   - **Batas:** (1% × Initial) + harga 1 saham
   - **Terpakai:** total penyesuaian yang sudah dilakukan
   - **Persentase:** berapa % dari batas sudah terpakai
   - **Sisa:** ruang penyesuaian tersisa
   - **Quantity Left:** berapa saham lagi bisa dibeli dari ruang RKAP

### Menambah Item Baru (COO Only)

1. Klik tombol **Tambah Item** di halaman RKAP
2. Isi form:
   - **Nama Item**
   - **Jenis Modal:** Tetap atau Bergerak
   - **Final Requirement:** nilai kebutuhan
3. Sistem akan menghitung apakah item baru melebihi batas
4. Jika valid, item tersimpan dengan Initial=0

---

## API Endpoints

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| PUT | `/api/rkap/fase/[id]/adjust` | Adjust item Final Requirement | COO |
| POST | `/api/rkap/fase/[id]/items` | Add new item | COO |

### Request/Response Format

```typescript
// PUT /api/rkap/fase/[id]/adjust
// Request
{
  "itemId": "uuid",
  "newFinalRequirement": "85000000.00"
}

// Response (success)
{
  "item": CapitalItemWire,
  "summary": {
    "adjustmentLimit": "2552000.00",
    "adjustmentUsed": "2484000.00",
    "adjustmentRemaining": "68000.00",
    "quantityLeft": 1
  }
}

// Response (error - limit exceeded)
{
  "code": "LIMIT_EXCEEDED",
  "message": "Penyesuaian melebihi batas agregat.",
  "details": {
    "batas": "2552000.00",
    "terpakai": "2600000.00",
    "sisa": "-48000.00",
    "langkahLanjut": "Ajukan ke MRO untuk menambah batas fase."
  }
}
```

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| AD-2 | SELECT FOR UPDATE untuk pessimistic locking dalam transaksi |
| AD-3 | Audit entries dalam transaksi sama |
| AD-10 | Semua nilai money sebagai numeric(18,2), string via API |

---

## Testing

### Integration Tests

- `server/domain/rkap/rkap.service.test.ts`
  - Adjustment within limit succeeds
  - Adjustment exceeding limit is rejected
  - Concurrent adjustments handled by transaction lock
  - New item addition counts toward limit
  - Rebalancing doesn't count toward limit

### Test Cases dengan Data Req-10

```typescript
// Data Req-10
const totalInitial = 250_000_000
const buyPrice = 52_000
const expectedLimit = 2_552_000 // 2,500,000 + 52,000

// Test: adjustment dalam batas
// terpakai sebelumnya: 2,484,000
// sisa: 68,000
// adjustment: 50,000 → PASS

// Test: adjustment melebihi batas
// terpakai sebelumnya: 2,484,000
// sisa: 68,000
// adjustment: 100,000 → FAIL (exceeds by 32,000)
```

---

## Contoh Perhitungan (Req-10)

### Fase 1 Data

| Metric | Nilai |
|--------|-------|
| Total Initial Requirement | Rp250.000.000 |
| 1% dari Initial | Rp2.500.000 |
| Harga Beli 1 Saham | Rp52.000 |
| **Adjustment Limit** | **Rp2.552.000** |
| Adjustment Terpakai | Rp2.484.000 |
| Adjustment Tersisa | Rp68.000 |
| Persentase Terpakai | 97,34% |

### Skenario Adjustment

| Skenario | Delta | Total Setelah | Hasil |
|----------|-------|---------------|-------|
| Adjustment Rp50.000 | +50.000 | 2.534.000 | ✅ PASS |
| Adjustment Rp68.000 | +68.000 | 2.552.000 | ✅ PASS (tepat batas) |
| Adjustment Rp100.000 | +100.000 | 2.584.000 | ❌ FAIL (melebihi 32.000) |

---

## Error Handling

### Alert Penolakan Terhitung

Ketika adjustment melebihi batas, API mengembalikan error dengan detail perhitungan:

```json
{
  "code": "LIMIT_EXCEEDED",
  "message": "Penyesuaian melebihi batas agregat.",
  "details": {
    "batas": "2552000.00",
    "terpakai": "2584000.00",
    "sisa": "-32000.00",
    "langkahLanjut": "Ajukan ke MRO untuk menambah batas fase."
  }
}
```

UI menampilkan alert dengan format:
```
⚠️ Penyesuaian Ditolak

Batas penyesuaian: Rp2.552.000
Sudah terpakai: Rp2.584.000
Sisa: -Rp32.000

Langkah selanjutnya: Ajukan ke MRO untuk menambah batas fase.
```

---

*Dokumentasi Story 2.5 — Sip & Dip Ownership Dashboard*
