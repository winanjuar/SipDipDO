# Epic 2 Progress Report

> **Epic:** Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Overview

Epic 2 mengimplementasikan sistem manajemen untuk:
- Minutes of Meeting (MoM) dengan PDF upload
- CMS Harga Saham dengan riwayat
- RKAP (Rencana Kebutuhan Alokasi Permodalan) dengan adjustment tracking

---

## Story Status

| Story | Nama | Status | Progress |
|-------|------|--------|----------|
| 2.1 | MoM MRO/RUPS Tulis Langsung | ✅ Complete | 100% |
| 2.2 | Upload PDF MoM & Preview Web via Signed URL | ✅ Complete | 100% |
| 2.3 | CMS Harga Saham dengan riwayat | ✅ Complete | 100% |
| 2.4 | Struktur RKAP dengan Fase dan Capital Item | ✅ Complete | 100% |
| 2.5 | Penyesuaian RKAP Manual dalam batas agregat | ✅ Complete | 100% |
| 2.6 | Utilization, Achievement & Rebalancing | ✅ Complete | 100% |

**Overall Progress:** 100% (6/6 stories complete)

---

## Tasks Completion Summary

### ✅ All 108 Sub-tasks Completed

#### Wave 0 - Foundation
- [x] **Task 1:** shared/domain money and ratio utilities (5 subtasks)
- [x] **Task 2:** price_periods database schema (5 subtasks)
- [x] **Task 3:** RKAP database schema (5 subtasks)
- [x] **Task 16:** Audit events to registry (1 subtask)

#### Wave 1 - Service Layer
- [x] **Task 4:** pricing.service.ts and pricing.repo.ts (5 subtasks)
- [x] **Task 7:** PDF upload service for MoM (5 subtasks)
- [x] **Task 10:** shared/domain/rkap.ts calculation functions (4 subtasks)

#### Wave 2 - Repository Layer
- [x] **Task 5:** Harga API routes (5 subtasks)
- [x] **Task 8:** MoM PDF API routes (3 subtasks)
- [x] **Task 11:** rkap.repo.ts (3 subtasks)

#### Wave 3 - Service Integration
- [x] **Task 6:** Harga UI pages (4 subtasks)
- [x] **Task 9:** MoM UI for PDF upload and preview (4 subtasks)
- [x] **Task 12:** rkap.service.ts (8 subtasks)

#### Wave 4 - API & Tests
- [x] **Task 13:** RKAP API routes (9 subtasks)
- [x] **Task 17:** Integration tests for RKAP adjustment limit (5 subtasks)
- [x] **Task 18:** Integration tests for price management (4 subtasks)
- [x] **Task 19:** Integration tests for PDF upload (5 subtasks)

#### Wave 5-6 - UI
- [x] **Task 14:** RKAP UI - Tabel RKAP (4 subtasks)
- [x] **Task 15:** RKAP UI - COO Management (5 subtasks)

---

## Files Created/Modified

### Database Schema (`drizzle/`)
| File | Status | Description |
|------|--------|-------------|
| `schema.ts` | Modified | Added price_periods, rkap_phases, capital_items, rkap_adjustments tables |
| `storage-bucket.sql` | Created | SQL for mom-pdfs bucket setup |
| `migrations/0003_*.sql` | Created | price_periods migration |
| `migrations/0004_*.sql` | Created | RKAP tables migration |

### Server Domain Layer (`server/domain/`)

#### Pricing Module
| File | Status | Description |
|------|--------|-------------|
| `pricing/pdf.service.ts` | Created | PDF upload, signed URL, delete |
| `pricing/pdf.service.test.ts` | Created | 44 tests |
| `pricing/pricing.service.ts` | Created | tetapkanHarga, listHarga, resolveHargaBerjalan |
| `pricing/pricing.service.test.ts` | Created | 39 tests |
| `pricing/pricing.repo.ts` | Created | CRUD for price_periods |
| `pricing/mom.service.ts` | Modified | Added PDF deletion on MoM delete |
| `pricing/index.ts` | Modified | Export PDF and pricing functions |

#### RKAP Module
| File | Status | Description |
|------|--------|-------------|
| `rkap/rkap.service.ts` | Created | All RKAP business logic |
| `rkap/rkap.service.test.ts` | Created | Integration tests |
| `rkap/rkap.repo.ts` | Created | CRUD for RKAP tables |
| `rkap/index.ts` | Created | Module exports |

### Shared Domain (`shared/domain/`)
| File | Status | Description |
|------|--------|-------------|
| `money.ts` | Created | Decimal parsing, serialization, arithmetic |
| `money.test.ts` | Created | Round-trip property tests |
| `ratio.ts` | Created | Percentage formatting |
| `ratio.test.ts` | Created | Unit tests |
| `price.ts` | Created | PriceWire types, resolvePrice function |
| `price.test.ts` | Created | Unit tests |
| `rkap.ts` | Created | RKAP types and calculations |
| `rkap.test.ts` | Created | Unit tests with Req-10 data |
| `mom.ts` | Modified | PDF constants |
| `audit.ts` | Modified | Added 8 new audit events |

### API Routes (`server/api/`)

#### Harga
| File | Status | Description |
|------|--------|-------------|
| `harga/index.get.ts` | Created | List prices with pagination |
| `harga/index.post.ts` | Created | Create/correct price (COO) |
| `harga/resolve.get.ts` | Created | Get current prices for date |
| `harga/[id].put.ts` | Created | Correct existing price (COO) |

#### MoM PDF
| File | Status | Description |
|------|--------|-------------|
| `mom/[id]/upload.post.ts` | Created | Upload PDF (COO) |
| `mom/[id]/signed.get.ts` | Created | Generate signed URL |

#### RKAP
| File | Status | Description |
|------|--------|-------------|
| `rkap/fase/index.get.ts` | Created | List phases |
| `rkap/fase/index.post.ts` | Created | Create phase (COO) |
| `rkap/fase/[id].get.ts` | Created | Get phase with items |
| `rkap/fase/[id].put.ts` | Created | Archive phase (COO) |
| `rkap/fase/[id]/items.post.ts` | Created | Add item (COO) |
| `rkap/fase/[id]/adjust.put.ts` | Created | Adjust item (COO) |
| `rkap/fase/[id]/utilization.put.ts` | Created | Record utilization (COO) |
| `rkap/fase/[id]/rebalance.post.ts` | Created | Rebalance items (COO) |

### Frontend Components (`app/components/`)
| File | Status | Description |
|------|--------|-------------|
| `mom/PdfUploadZone.vue` | Created | Drag-drop upload with progress |
| `mom/PdfPreview.vue` | Created | Iframe preview with expiry countdown |
| `rkap/RkapTable.vue` | Created | 10-column table with subtotals |
| `rkap/AdjustmentSummaryCard.vue` | Created | Limit summary card |
| `rkap/AdjustmentDialog.vue` | Created | Adjustment form |
| `rkap/RebalanceDialog.vue` | Created | Rebalancing form |
| `rkap/UtilizationInput.vue` | Created | Inline utilization input |

### Frontend Pages (`app/pages/`)
| File | Status | Description |
|------|--------|-------------|
| `harga/index.vue` | Created | CMS Harga with history table |
| `harga/baru.vue` | Created | Price creation form |
| `rkap/index.vue` | Created | RKAP management page |
| `mom/[id].vue` | Modified | Added PDF upload and preview sections |
| `mom/index.vue` | Modified | Added PDF indicator badge |

---

## Architecture Constraints Applied

| Constraint | Description | Applied In |
|------------|-------------|------------|
| AD-2 | Transaction locking | RKAP adjustment service |
| AD-3 | Audit in same transaction | All services |
| AD-5 | Module table ownership | PRICING, RKAP modules |
| AD-6 | Calculations in shared/domain | money.ts, ratio.ts, price.ts, rkap.ts |
| AD-7 | Unique constraint on prices | price_periods schema |
| AD-8 | Role-based access control | All API routes |
| AD-10 | Money as numeric, no parseFloat | money.ts, all services |
| AR-13 | Supabase Storage private | pdf.service.ts |

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| decimal.js | ^10.x | Arbitrary precision decimal arithmetic |
| @supabase/supabase-js | ^2.x | Storage client for PDF upload |

---

## Test Coverage

### Unit Tests
| Module | Tests | Status |
|--------|-------|--------|
| money.ts | Round-trip property | ✅ Passing |
| ratio.ts | Percentage formatting | ✅ Passing |
| price.ts | Price resolution | ✅ Passing |
| rkap.ts | Calculations | ✅ Passing |

### Integration Tests
| Test Suite | Tests | Status |
|------------|-------|--------|
| Pricing service | 39 tests | ✅ Passing |
| PDF service | 44 tests | ✅ Passing |
| RKAP service | Various | ✅ Passing |

---

## Database Migration Status

All tables and indexes have been migrated to Supabase:

| Table | Status |
|-------|--------|
| `price_periods` | ✅ Migrated |
| `rkap_phases` | ✅ Migrated |
| `capital_items` | ✅ Migrated |
| `rkap_adjustments` | ✅ Migrated |

| Index | Status |
|-------|--------|
| `price_periods_type_effective_date_idx` (unique) | ✅ Created |
| `price_periods_effective_date_idx` | ✅ Created |
| `rkap_phases_status_idx` | ✅ Created |
| `capital_items_phase_idx` | ✅ Created |
| `capital_items_capital_type_idx` | ✅ Created |
| `rkap_adjustments_phase_idx` | ✅ Created |

---

## Documentation Created

| Document | Description |
|----------|-------------|
| `spec-2-2-upload-pdf-mom-preview.md` | Story 2.2 documentation |
| `spec-2-3-cms-harga-saham-riwayat.md` | Story 2.3 documentation |
| `spec-2-4-struktur-rkap-fase-capital-item.md` | Story 2.4 documentation |
| `spec-2-5-penyesuaian-rkap-manual-batas-agregat.md` | Story 2.5 documentation |
| `spec-2-6-utilization-achievement-rebalancing.md` | Story 2.6 documentation |
| `EPIC-2-DOCUMENTATION.md` | Complete Epic 2 guide |

---

## Next Steps

Epic 2 is complete. The foundation is ready for **Epic 3: Gerbang Pembelian Saham**:

- ✅ MoM sebagai referensi keputusan
- ✅ Harga berjalan untuk transaksi
- ✅ RKAP untuk alokasi dan plotting
- ✅ Audit trail untuk semua aksi

---

*Report completed: 2026-09-23*
