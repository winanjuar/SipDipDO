# Story 2.3: CMS Harga Saham dengan Riwayat

> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.3 mengimplementasikan CMS (Content Management System) untuk penetapan harga saham dengan fitur riwayat lengkap. COO dapat menetapkan harga beli dan jual baru yang tertaut MoM, sedangkan semua owner dapat melihat harga berjalan dan riwayat perubahan harga.

---

## Requirements yang Dipenuhi

### Req-3: Penetapan Harga Baru

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Harga tersimpan dengan nilai, jenis (beli/jual), tanggal efektif, dan referensi mom_id | ✅ |
| 2 | Audit event `price-created` tercatat | ✅ |
| 3 | Unique constraint pada (jenis, tanggal_efektif) mencegah duplikat | ✅ |
| 4 | Koreksi mengubah baris existing dengan audit `price-corrected` | ✅ |
| 5 | Validasi nilai positif dan tanggal tidak di masa lampau | ✅ |

### Req-4: Tampilan Harga Berjalan dan Riwayat

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Halaman menampilkan harga berjalan (beli dan jual) hari ini | ✅ |
| 2 | Riwayat lengkap dengan kolom: nilai, jenis, tanggal efektif, referensi MRO | ✅ |
| 3 | Price Resolver mengembalikan tepat SATU baris per (jenis, tanggal) | ✅ |
| 4 | Snapshot harga pada pesanan (Harga_Terkunci) tidak berubah meski dikoreksi | ✅ |
| 5 | Format angka tabular-nums dengan locale id-ID (Rp52.000) | ✅ |

---

## Arsitektur & Alur Data

### Penetapan Harga Flow

```
COO Browser                  API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  POST /api/harga           │                            │                        │
    │──────────────────────────>│                            │                        │
    │   { type, amount,         │                            │                        │
    │     effectiveDate, momId }│                            │                        │
    │                            │  tetapkanHarga()           │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  check existing        │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │                            │                        │
    │                            │                            │  INSERT/UPDATE         │
    │                            │                            │──────────────────────>│
    │                            │                            │                        │
    │                            │                            │  write audit           │
    │                            │                            │  (price-created/       │
    │                            │                            │   price-corrected)     │
    │                            │<──────────────────────────│                        │
    │   201 Created + PriceWire │                            │                        │
    │<──────────────────────────│                            │                        │
```

### Resolusi Harga Flow

```
Browser                      API Layer                  Service Layer              Database
    │                            │                            │                        │
    │  GET /api/harga/resolve    │                            │                        │
    │       ?date=2026-09-23     │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  resolveHargaBerjalan()    │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  SELECT latest price   │
    │                            │                            │  WHERE effective_date  │
    │                            │                            │       <= date          │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │<──────────────────────────│                        │
    │   { beli: PriceWire,      │                            │                        │
    │     jual: PriceWire }     │                            │                        │
    │<──────────────────────────│                            │                        │
```

---

## Database Schema

### price_periods Table

```sql
CREATE TYPE price_type AS ENUM ('beli', 'jual');

CREATE TABLE price_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type price_type NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  mom_id UUID NOT NULL REFERENCES moms(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint untuk AD-7
CREATE UNIQUE INDEX price_periods_type_effective_date_idx 
  ON price_periods(type, effective_date);

CREATE INDEX price_periods_effective_date_idx 
  ON price_periods(effective_date);
```

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `shared/domain/price.ts` | Wire types dan resolvePrice function |
| `shared/domain/price.test.ts` | Unit tests untuk resolvePrice |
| `server/domain/pricing/pricing.repo.ts` | Repository layer untuk price_periods |
| `server/domain/pricing/pricing.service.ts` | Service layer dengan tetapkanHarga, listHarga |
| `server/domain/pricing/pricing.service.test.ts` | Integration tests (39 tests) |
| `server/api/harga/index.get.ts` | List prices dengan pagination |
| `server/api/harga/index.post.ts` | Create/correct price (COO only) |
| `server/api/harga/resolve.get.ts` | Get current prices for date |
| `server/api/harga/[id].put.ts` | Correct existing price (COO only) |
| `app/pages/harga/index.vue` | CMS Harga dengan riwayat table |
| `app/pages/harga/baru.vue` | Form pembuatan harga baru |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `drizzle/schema.ts` | Tambah priceType enum dan pricePeriods table |
| `shared/domain/audit.ts` | Tambah events `price-created`, `price-corrected` |
| `shared/domain/index.ts` | Export price types |
| `server/domain/pricing/index.ts` | Export pricing service functions |

---

## Cara Mengakses Fitur

### Melihat Harga Berjalan (Semua Owner)

1. Login sebagai owner (dengan atau tanpa saham) atau COO
2. Klik menu **Harga** di sidebar
3. Section **Harga Berjalan** menampilkan:
   - Harga Beli: Rp52.000
   - Harga Jual: Rp50.000
   - Berlaku sejak: [tanggal efektif]
4. Scroll ke bawah untuk melihat **Riwayat Harga**

### Menetapkan Harga Baru (COO Only)

1. Login sebagai COO
2. Navigasi ke **Harga**
3. Klik tombol **Tetapkan Harga Baru**
4. Isi form:
   - **Jenis Harga:** Beli atau Jual
   - **Nilai:** masukkan dalam Rupiah (contoh: 52000)
   - **Tanggal Efektif:** pilih tanggal >= hari ini
   - **Referensi MoM:** pilih MoM yang sudah final
5. Klik **Simpan**
6. Harga baru akan aktif mulai tanggal efektif

### Koreksi Harga (COO Only)

1. Di halaman Harga, temukan harga yang perlu dikoreksi
2. Klik ikon **Edit** di baris riwayat
3. Ubah nilai harga
4. Klik **Simpan Koreksi**
5. Audit event `price-corrected` akan tercatat dengan nilai lama dan baru

---

## API Endpoints

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| GET | `/api/harga` | List all prices dengan pagination | All |
| GET | `/api/harga/resolve?date=YYYY-MM-DD` | Get current prices for date | All |
| POST | `/api/harga` | Create new price | COO |
| PUT | `/api/harga/[id]` | Correct existing price | COO |

### Response Format

```typescript
// GET /api/harga/resolve
{
  "beli": {
    "id": "uuid",
    "type": "beli",
    "effectiveDate": "2026-09-01T00:00:00Z",
    "amount": "52000.00",
    "momId": "uuid",
    "momTitle": "MRO Q3 2026"
  },
  "jual": {
    "id": "uuid",
    "type": "jual",
    "effectiveDate": "2026-09-01T00:00:00Z",
    "amount": "50000.00",
    "momId": "uuid",
    "momTitle": "MRO Q3 2026"
  }
}
```

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| AD-3 | Audit entries dalam transaksi sama dengan aksi |
| AD-7 | Unique index pada (type, effective_date) — satu harga per jenis per tanggal |
| AD-8 | Role validation di server boundary (COO untuk create/update) |
| AD-10 | Harga disimpan numeric(18,2), dikirim sebagai string decimal |

---

## Testing

### Unit Tests

- `shared/domain/price.test.ts` — Round-trip property test
- `shared/domain/money.test.ts` — Decimal arithmetic precision

### Integration Tests

- `server/domain/pricing/pricing.service.test.ts` — 39 tests
  - Price creation with unique constraint
  - Price correction updates existing row
  - Price resolution returns exactly one per type
  - Round-trip property for decimal values

---

## Contoh Data

### Harga Berjalan

| Jenis | Nilai | Tanggal Efektif | Referensi MRO |
|-------|-------|-----------------|---------------|
| Beli | Rp52.000 | 1 Sep 2026 | MRO Q3 2026 |
| Jual | Rp50.000 | 1 Sep 2026 | MRO Q3 2026 |

### Format Tampilan

- Angka menggunakan `font-variant-numeric: tabular-nums`
- Locale `id-ID` untuk format Rupiah
- Contoh: Rp52.000, Rp1.500.000

---

*Dokumentasi Story 2.3 — Sip & Dip Ownership Dashboard*
