# Epic 2: Manajemen MoM, Harga, dan RKAP

> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23  
> **Total Tasks:** 108 sub-tasks (19 parent tasks)

---

## Ringkasan Epic

Epic 2 mengimplementasikan sistem manajemen untuk tiga domain utama dalam Sip & Dip Ownership Dashboard:

1. **Minutes of Meeting (MoM)** — Notulen keputusan MRO/RUPS dengan dukungan PDF upload
2. **Harga Saham** — CMS untuk penetapan dan riwayat harga beli/jual
3. **RKAP** — Rencana Kebutuhan Alokasi Permodalan dengan tracking penyesuaian

---

## Stories yang Diselesaikan

| Story | Nama | Status | Dokumentasi |
|-------|------|--------|-------------|
| 2.1 | MoM MRO/RUPS Tulis Langsung | ✅ | [spec-2-1-mom-mro-rups-tulis-langsung.md](./spec-2-1-mom-mro-rups-tulis-langsung.md) |
| 2.2 | Upload PDF MoM & Preview Web | ✅ | [spec-2-2-upload-pdf-mom-preview.md](./spec-2-2-upload-pdf-mom-preview.md) |
| 2.3 | CMS Harga Saham dengan Riwayat | ✅ | [spec-2-3-cms-harga-saham-riwayat.md](./spec-2-3-cms-harga-saham-riwayat.md) |
| 2.4 | Struktur RKAP — Fase dan Capital Item | ✅ | [spec-2-4-struktur-rkap-fase-capital-item.md](./spec-2-4-struktur-rkap-fase-capital-item.md) |
| 2.5 | Penyesuaian RKAP Manual dalam Batas Agregat | ✅ | [spec-2-5-penyesuaian-rkap-manual-batas-agregat.md](./spec-2-5-penyesuaian-rkap-manual-batas-agregat.md) |
| 2.6 | Utilization, Achievement & Rebalancing | ✅ | [spec-2-6-utilization-achievement-rebalancing.md](./spec-2-6-utilization-achievement-rebalancing.md) |

---

## Cara Mengakses Fitur

### 🔐 Login

1. Buka aplikasi di browser
2. Klik **Login dengan Google**
3. Pilih akun Google yang terdaftar

### 📝 MoM (Minutes of Meeting)

**Akses:** Menu **MoM** di sidebar

| Fitur | COO | Pemegang Saham | Owner Tanpa Saham |
|-------|-----|----------------|-------------------|
| Lihat daftar MoM | ✅ | ✅ | ❌ |
| Lihat detail MoM | ✅ | ✅ | ❌ |
| Buat MoM baru | ✅ | ❌ | ❌ |
| Edit MoM draft | ✅ | ❌ | ❌ |
| Finalisasi MoM | ✅ | ❌ | ❌ |
| Upload PDF | ✅ | ❌ | ❌ |
| Preview PDF | ✅ | ✅ | ❌ |

**Cara Upload PDF:**
1. Buka MoM draft
2. Scroll ke section "Dokumen PDF"
3. Drag & drop file PDF atau klik untuk browse
4. Tunggu progress upload selesai

**Cara Preview PDF:**
1. Buka MoM yang memiliki PDF (ikon 📄)
2. PDF tampil dalam iframe
3. URL berlaku 15 menit, klik refresh jika expired

---

### 💰 Harga Saham

**Akses:** Menu **Harga** di sidebar

| Fitur | COO | Pemegang Saham | Owner Tanpa Saham |
|-------|-----|----------------|-------------------|
| Lihat harga berjalan | ✅ | ✅ | ✅ |
| Lihat riwayat harga | ✅ | ✅ | ✅ |
| Tetapkan harga baru | ✅ | ❌ | ❌ |
| Koreksi harga | ✅ | ❌ | ❌ |

**Cara Melihat Harga:**
1. Klik menu **Harga**
2. Section atas menampilkan harga berjalan (beli dan jual)
3. Scroll ke bawah untuk riwayat lengkap

**Cara Tetapkan Harga Baru (COO):**
1. Klik tombol **Tetapkan Harga Baru**
2. Pilih jenis: Beli atau Jual
3. Masukkan nilai dalam Rupiah
4. Pilih tanggal efektif (≥ hari ini)
5. Pilih MoM referensi (wajib final)
6. Klik **Simpan**

---

### 📊 RKAP

**Akses:** Menu **RKAP** di sidebar

| Fitur | COO | Pemegang Saham | Owner Tanpa Saham |
|-------|-----|----------------|-------------------|
| Lihat tabel RKAP | ✅ | ✅ | ✅ |
| Lihat ringkasan batas | ✅ | ❌ | ❌ |
| Buat fase baru | ✅ | ❌ | ❌ |
| Tambah Capital Item | ✅ | ❌ | ❌ |
| Adjust Final Requirement | ✅ | ❌ | ❌ |
| Input Utilization | ✅ | ❌ | ❌ |
| Rebalancing | ✅ | ❌ | ❌ |

**Cara Melihat RKAP:**
1. Klik menu **RKAP**
2. Pilih fase dari dropdown (default: fase berjalan)
3. Lihat tabel dengan 10 kolom data
4. Scroll horizontal di mobile untuk kolom lengkap

**Kolom Tabel RKAP:**
| Kolom | Deskripsi |
|-------|-----------|
| Nama | Nama Capital Item |
| Jenis Modal | Tetap / Bergerak |
| Initial Requirement | Kebutuhan awal (terkunci) |
| Final Requirement | Kebutuhan akhir (adjustable) |
| Fulfillment | Transaksi yang sudah teralokasi |
| Fulfillment Rate | Fulfillment ÷ Final (%) |
| Shortfall | Final − Fulfillment |
| Utilization | Realisasi penggunaan |
| Achievement | Utilization ÷ Fulfillment (%) |
| Held | Fulfillment − Utilization |

**Cara Buat Fase Baru (COO):**
1. Klik tombol **Buat Fase Baru**
2. Masukkan nama fase
3. Pilih MoM referensi
4. Tambahkan Capital Items (minimal 1)
5. Klik **Simpan**

**Cara Adjust Item (COO):**
1. Klik tombol **Adjust** di baris item
2. Lihat nilai saat ini dan sisa batas
3. Masukkan nilai baru
4. Klik **Simpan**
5. Jika melebihi batas, akan muncul error dengan detail

**Cara Rebalancing (COO):**
1. Klik tombol **Rebalance**
2. Pilih item sumber dan tujuan (harus sejenis)
3. Masukkan jumlah yang dipindahkan
4. Pilih MoM referensi
5. Klik **Simpan**

---

## Constraint Arsitektur

Epic 2 mengikuti constraint arsitektur dari ARCHITECTURE-SPINE.md:

| Constraint | Penerapan |
|------------|-----------|
| AD-2 | Transaction locking untuk validasi adjustment limit |
| AD-3 | Audit entries dalam transaksi sama dengan aksi |
| AD-5 | Module table ownership (PRICING, RKAP) |
| AD-6 | Calculation functions di shared/domain |
| AD-7 | Unique constraint pada price_periods (type, effective_date) |
| AD-8 | Role-based access control di server boundary |
| AD-10 | Money sebagai numeric(18,2), string via API, tidak ada parseFloat |
| AR-13 | Supabase Storage bucket privat untuk PDF |

---

## Database Tables

Epic 2 menambahkan 4 tabel baru:

| Table | Module | Deskripsi |
|-------|--------|-----------|
| `price_periods` | PRICING | Riwayat harga beli/jual |
| `rkap_phases` | RKAP | Fase RKAP dengan status |
| `capital_items` | RKAP | Item kebutuhan per fase |
| `rkap_adjustments` | RKAP | Log penyesuaian RKAP |

### Enum Types

```sql
price_type: 'beli' | 'jual'
rkap_phase_status: 'berjalan' | 'arsip'
capital_type: 'tetap' | 'bergerak'
```

---

## API Endpoints

### MoM PDF

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| POST | `/api/mom/[id]/upload` | Upload PDF | COO |
| GET | `/api/mom/[id]/signed` | Get signed URL | COO, Pemegang Saham |

### Harga

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| GET | `/api/harga` | List prices | All |
| GET | `/api/harga/resolve` | Get current prices | All |
| POST | `/api/harga` | Create price | COO |
| PUT | `/api/harga/[id]` | Correct price | COO |

### RKAP

| Method | Path | Deskripsi | Access |
|--------|------|-----------|--------|
| GET | `/api/rkap/fase` | List phases | All |
| POST | `/api/rkap/fase` | Create phase | COO |
| GET | `/api/rkap/fase/[id]` | Get phase | All |
| PUT | `/api/rkap/fase/[id]` | Archive phase | COO |
| POST | `/api/rkap/fase/[id]/items` | Add item | COO |
| PUT | `/api/rkap/fase/[id]/adjust` | Adjust item | COO |
| PUT | `/api/rkap/fase/[id]/utilization` | Record utilization | COO |
| POST | `/api/rkap/fase/[id]/rebalance` | Rebalance | COO |

---

## Testing

### Unit Tests

| Module | File | Tests |
|--------|------|-------|
| money.ts | `shared/domain/money.test.ts` | Round-trip property |
| ratio.ts | `shared/domain/ratio.test.ts` | Percentage formatting |
| price.ts | `shared/domain/price.test.ts` | Price resolution |
| rkap.ts | `shared/domain/rkap.test.ts` | Calculations |

### Integration Tests

| Module | File | Tests |
|--------|------|-------|
| Pricing | `server/domain/pricing/pricing.service.test.ts` | 39 tests |
| PDF | `server/domain/pricing/pdf.service.test.ts` | 44 tests |
| RKAP | `server/domain/rkap/rkap.service.test.ts` | Various |

### Test Data (Req-10)

```
Total Initial Requirement: Rp250.000.000
Adjustment Limit: Rp2.552.000 (1% + harga 1 saham)
Adjustment Used: Rp2.484.000
Adjustment Remaining: Rp68.000
```

---

## Environment Variables

```env
# Database
NUXT_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://...

# Supabase Storage (untuk PDF)
NUXT_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NUXT_SUPABASE_SERVICE_KEY=[SERVICE-ROLE-KEY]
```

---

## File Structure

```
server/
├── api/
│   ├── harga/
│   │   ├── index.get.ts
│   │   ├── index.post.ts
│   │   ├── resolve.get.ts
│   │   └── [id].put.ts
│   ├── mom/
│   │   └── [id]/
│   │       ├── upload.post.ts
│   │       └── signed.get.ts
│   └── rkap/
│       └── fase/
│           ├── index.get.ts
│           ├── index.post.ts
│           ├── [id].get.ts
│           ├── [id].put.ts
│           └── [id]/
│               ├── items.post.ts
│               ├── adjust.put.ts
│               ├── utilization.put.ts
│               └── rebalance.post.ts
├── domain/
│   ├── pricing/
│   │   ├── pricing.service.ts
│   │   ├── pricing.repo.ts
│   │   ├── pdf.service.ts
│   │   └── *.test.ts
│   └── rkap/
│       ├── rkap.service.ts
│       ├── rkap.repo.ts
│       └── *.test.ts
shared/
└── domain/
    ├── money.ts
    ├── ratio.ts
    ├── price.ts
    ├── rkap.ts
    └── audit.ts
app/
└── pages/
    ├── harga/
    │   ├── index.vue
    │   └── baru.vue
    ├── mom/
    │   ├── index.vue
    │   ├── [id].vue
    │   └── baru.vue
    └── rkap/
        └── index.vue
drizzle/
├── schema.ts (updated)
└── migrations/
    ├── 0003_fuzzy_ultragirl.sql (price_periods)
    └── 0004_lyrical_dreaming_celestial.sql (RKAP tables)
```

---

## Audit Events

Epic 2 menambahkan audit events berikut:

| Event | Deskripsi |
|-------|-----------|
| `mom-pdf-uploaded` | PDF diunggah ke MoM |
| `price-created` | Harga baru ditetapkan |
| `price-corrected` | Harga dikoreksi |
| `rkap-phase-created` | Fase RKAP dibuat |
| `rkap-item-added` | Capital Item ditambahkan |
| `rkap-item-adjusted` | Final Requirement disesuaikan |
| `rkap-utilization-recorded` | Utilization dicatat |
| `rkap-rebalanced` | Rebalancing antar item |

---

## Related Documents

- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) — Panduan deployment ke Supabase & Vercel
- [design.md](../../.kiro/specs/epic-2-remaining/design.md) — Technical design Epic 2
- [requirements.md](../../.kiro/specs/epic-2-remaining/requirements.md) — Requirements specification
- [tasks.md](../../.kiro/specs/epic-2-remaining/tasks.md) — Implementation tasks

---

## Next Epic

Epic 2 menyiapkan fondasi untuk **Epic 3: Gerbang Pembelian Saham** dengan:
- MoM sebagai referensi keputusan
- Harga berjalan untuk transaksi
- RKAP untuk alokasi dan plotting

---

*Epic 2 Documentation — Sip & Dip Ownership Dashboard*  
*Generated: 2026-09-23*
