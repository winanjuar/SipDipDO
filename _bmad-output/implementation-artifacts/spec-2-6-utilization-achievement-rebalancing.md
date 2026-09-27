# Story 2.6: Utilization, Achievement & Rebalancing

> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.6 mengimplementasikan fitur pencatatan Utilization (realisasi penggunaan modal), kalkulasi Achievement dan Held, serta kemampuan rebalancing antar Capital Item sejenis. Fitur-fitur ini memungkinkan tracking efektivitas penggunaan modal yang sudah terkumpul.

---

## Requirements yang Dipenuhi

### Req-11: Input Utilization per Capital Item

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | COO dapat menginput Utilization untuk Capital Item | ✅ |
| 2 | Audit event `rkap-utilization-recorded` tercatat | ✅ |
| 3 | Validasi numeric non-negatif | ✅ |
| 4 | Utilization tersimpan terpisah dari Fulfillment | ✅ |

### Req-12: Kalkulasi Achievement dan Held

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Achievement = Utilization ÷ Fulfillment (bisa > 100%) | ✅ |
| 2 | Held = Fulfillment − Utilization (derived) | ✅ |
| 3 | Achievement "—" atau 0% jika Fulfillment = 0 | ✅ |
| 4 | Achievement ditampilkan sebagai persentase 2 desimal, half-up | ✅ |

### Req-13: Rebalancing RKAP antar Capital Item Sejenis

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Validasi kedua item memiliki jenis modal sama | ✅ |
| 2 | Relokasi antar jenis berbeda ditolak | ✅ |
| 3 | Rebalancing wajib tertaut MoM | ✅ |
| 4 | Audit event `rkap-rebalanced` tercatat | ✅ |
| 5 | Zero-sum transfer (total ruang jenis modal tidak berubah) | ✅ |

---

## Arsitektur & Alur Data

### Utilization Input Flow

```
COO Browser                  API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  PUT /api/rkap/fase/[id]/  │                            │                        │
    │       utilization          │                            │                        │
    │  { itemId, value }         │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  recordUtilization()       │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  validate >= 0         │
    │                            │                            │  UPDATE item.utilization│
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  write audit           │
    │                            │                            │  'rkap-utilization-    │
    │                            │                            │   recorded'            │
    │                            │<──────────────────────────│                        │
    │   200 OK + CapitalItemWire│                            │                        │
    │<──────────────────────────│                            │                        │
```

### Rebalancing Flow

```
COO Browser                  API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  POST /api/rkap/fase/[id]/ │                            │                        │
    │       rebalance            │                            │                        │
    │  { fromItemId, toItemId,   │                            │                        │
    │    amount, momId }         │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  rebalance()               │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  BEGIN TRANSACTION     │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  validate same type    │
    │                            │                            │  validate MoM final    │
    │                            │                            │                        │
    │                            │                            │  UPDATE from.finalReq  │
    │                            │                            │     -= amount          │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  UPDATE to.finalReq    │
    │                            │                            │     += amount          │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  INSERT adjustments    │
    │                            │                            │  (rebalance_out, in)   │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  write audit           │
    │                            │                            │  'rkap-rebalanced'     │
    │                            │                            │                        │
    │                            │                            │  COMMIT                │
    │                            │<──────────────────────────│                        │
    │   200 OK + { from, to }   │                            │                        │
    │<──────────────────────────│                            │                        │
```

---

## Kalkulasi Functions

### Achievement

```typescript
// shared/domain/rkap.ts
function calculateAchievement(utilization: Decimal, fulfillment: Decimal): string {
  if (fulfillment.isZero()) {
    return '0.00' // or "—" for display
  }
  // Achievement bisa > 100%
  return utilization.dividedBy(fulfillment).times(100).toFixed(2, Decimal.ROUND_HALF_UP)
}

// Contoh:
// Utilization: Rp40.000.000, Fulfillment: Rp45.000.000
// Achievement: 40.000.000 / 45.000.000 × 100 = 88,89%
```

### Held

```typescript
// shared/domain/rkap.ts
function calculateHeld(fulfillment: Decimal, utilization: Decimal): string {
  // Held = dana terkumpul yang belum terpakai
  return fulfillment.minus(utilization).toString()
}

// Contoh:
// Fulfillment: Rp45.000.000, Utilization: Rp40.000.000
// Held: Rp45.000.000 - Rp40.000.000 = Rp5.000.000
```

### Rebalancing Zero-Sum Property

```typescript
// Property: ∀ rebalance(from, to, amount):
//   ΣFinalRequirement(capitalType, before) = ΣFinalRequirement(capitalType, after)

// Sebelum rebalance:
// Item A (Tetap): Final = 100.000.000
// Item B (Tetap): Final = 80.000.000
// Total Tetap = 180.000.000

// Rebalance: A → B, amount = 20.000.000

// Setelah rebalance:
// Item A (Tetap): Final = 80.000.000
// Item B (Tetap): Final = 100.000.000
// Total Tetap = 180.000.000 ✓ (tidak berubah)
```

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `server/api/rkap/fase/[id]/utilization.put.ts` | Input utilization endpoint (COO) |
| `server/api/rkap/fase/[id]/rebalance.post.ts` | Rebalancing endpoint (COO) |
| `app/components/rkap/UtilizationInput.vue` | Inline input untuk utilization |
| `app/components/rkap/RebalanceDialog.vue` | Dialog rebalancing dengan validasi |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `shared/domain/rkap.ts` | Tambah calculateAchievement, calculateHeld |
| `server/domain/rkap/rkap.service.ts` | Implement recordUtilization, rebalance |
| `server/domain/rkap/rkap.repo.ts` | Implement transferRequirement |
| `shared/domain/audit.ts` | Tambah events `rkap-utilization-recorded`, `rkap-rebalanced` |
| `app/pages/rkap/index.vue` | Integrasi utilization input dan rebalance button |
| `app/components/rkap/RkapTable.vue` | Display Achievement dan Held columns |

---

## Cara Mengakses Fitur

### Input Utilization (COO Only)

1. Login sebagai COO
2. Navigasi ke **RKAP**
3. Di tabel RKAP, temukan item yang ingin diupdate
4. Klik pada kolom **Utilization** (inline editable)
5. Masukkan nilai realisasi penggunaan
6. Tekan Enter atau klik di luar untuk menyimpan
7. Kolom **Achievement** dan **Held** akan terupdate otomatis

### Melihat Achievement dan Held (Semua Owner)

1. Di tabel RKAP, lihat kolom:
   - **Achievement:** persentase efektivitas penggunaan modal
   - **Held:** dana terkumpul yang belum terpakai

### Rebalancing (COO Only)

1. Klik tombol **Rebalance** di halaman RKAP
2. Dialog akan muncul dengan form:
   - **Dari Item:** pilih item sumber (dropdown filtered by type)
   - **Ke Item:** pilih item tujuan (otomatis filtered same type)
   - **Jumlah:** nilai yang akan dipindahkan
   - **Referensi MoM:** pilih MoM final sebagai bukti keputusan
3. Klik **Simpan**
4. Sistem memvalidasi:
   - Kedua item sejenis (Tetap-Tetap atau Bergerak-Bergerak)
   - MoM sudah final
   - Total tidak berubah (zero-sum)

---

## API Endpoints

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| PUT | `/api/rkap/fase/[id]/utilization` | Record utilization | COO |
| POST | `/api/rkap/fase/[id]/rebalance` | Rebalance items | COO |

### Request/Response Format

```typescript
// PUT /api/rkap/fase/[id]/utilization
// Request
{
  "itemId": "uuid",
  "value": "40000000.00"
}

// Response
{
  "item": CapitalItemWire  // includes updated achievement, held
}

// POST /api/rkap/fase/[id]/rebalance
// Request
{
  "fromItemId": "uuid",
  "toItemId": "uuid",
  "amount": "20000000.00",
  "momId": "uuid"
}

// Response
{
  "from": CapitalItemWire,
  "to": CapitalItemWire
}

// Error - different capital type
{
  "code": "TYPE_MISMATCH",
  "message": "Rebalancing harus antar item dengan jenis modal yang sama."
}
```

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| AD-2 | Rebalancing dalam transaksi atomik |
| AD-3 | Audit entries dalam transaksi sama |
| AD-6 | Calculation functions di shared/domain/rkap.ts |
| AD-8 | Role validation di server boundary |
| AD-10 | Semua nilai money sebagai numeric(18,2), string via API |

---

## Testing

### Unit Tests

- `shared/domain/rkap.test.ts`
  - calculateAchievement with normal values
  - calculateAchievement returns 0 when Fulfillment = 0
  - calculateAchievement > 100% when Utilization > Fulfillment
  - calculateHeld

### Integration Tests

- `server/domain/rkap/rkap.service.test.ts`
  - Utilization recorded successfully
  - Utilization rejects negative values
  - Rebalancing same type succeeds
  - Rebalancing different type fails
  - Rebalancing requires final MoM
  - Rebalancing is zero-sum

---

## Contoh Data

### Capital Item dengan Achievement

| Item | Fulfillment | Utilization | Achievement | Held |
|------|-------------|-------------|-------------|------|
| Renovasi Outlet A | Rp45.000.000 | Rp40.000.000 | 88,89% | Rp5.000.000 |
| Pembelian Mesin | Rp82.000.000 | Rp80.000.000 | 97,56% | Rp2.000.000 |
| Modal Kerja | Rp50.000.000 | Rp48.000.000 | 96,00% | Rp2.000.000 |

### Achievement > 100% (Over-utilized)

| Item | Fulfillment | Utilization | Achievement | Held |
|------|-------------|-------------|-------------|------|
| Renovasi Outlet B | Rp30.000.000 | Rp35.000.000 | 116,67% | -Rp5.000.000 |

*Held negatif menunjukkan item ini menggunakan dana lebih dari yang terkumpul*

### Rebalancing Example

```
Sebelum Rebalancing:
┌─────────────────────┬──────────┬────────────────────┐
│ Item                │ Jenis    │ Final Requirement  │
├─────────────────────┼──────────┼────────────────────┤
│ Renovasi Outlet A   │ Tetap    │ Rp100.000.000     │
│ Pembelian Mesin     │ Tetap    │ Rp80.000.000      │
└─────────────────────┴──────────┴────────────────────┘
Total Tetap: Rp180.000.000

Rebalance: Outlet A → Mesin, Rp20.000.000

Setelah Rebalancing:
┌─────────────────────┬──────────┬────────────────────┐
│ Item                │ Jenis    │ Final Requirement  │
├─────────────────────┼──────────┼────────────────────┤
│ Renovasi Outlet A   │ Tetap    │ Rp80.000.000      │
│ Pembelian Mesin     │ Tetap    │ Rp100.000.000     │
└─────────────────────┴──────────┴────────────────────┘
Total Tetap: Rp180.000.000 ✓ (tidak berubah)
```

---

## Validasi dan Error Handling

### Rebalancing Validasi

| Validasi | Error Code | Pesan |
|----------|------------|-------|
| Item berbeda jenis | `TYPE_MISMATCH` | Rebalancing harus antar item dengan jenis modal yang sama |
| MoM belum final | `MOM_NOT_FINAL` | MoM harus final untuk referensi keputusan |
| Amount > from.finalReq | `VALIDATION` | Jumlah melebihi kebutuhan item sumber |

### Utilization Validasi

| Validasi | Error Code | Pesan |
|----------|------------|-------|
| Nilai negatif | `VALIDATION` | Utilization harus non-negatif |
| Bukan numeric | `VALIDATION` | Nilai harus berupa angka |

---

## Audit Trail

### rkap-utilization-recorded

```json
{
  "event": "rkap-utilization-recorded",
  "actorOwnerId": "uuid",
  "details": {
    "itemId": "uuid",
    "itemName": "Renovasi Outlet A",
    "oldValue": "35000000.00",
    "newValue": "40000000.00"
  }
}
```

### rkap-rebalanced

```json
{
  "event": "rkap-rebalanced",
  "actorOwnerId": "uuid",
  "details": {
    "fromItemId": "uuid",
    "fromItemName": "Renovasi Outlet A",
    "toItemId": "uuid",
    "toItemName": "Pembelian Mesin",
    "amount": "20000000.00",
    "momId": "uuid",
    "momTitle": "MRO Q3 2026"
  }
}
```

---

*Dokumentasi Story 2.6 — Sip & Dip Ownership Dashboard*
