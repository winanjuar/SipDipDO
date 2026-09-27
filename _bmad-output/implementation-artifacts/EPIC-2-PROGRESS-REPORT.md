# Epic 2 Progress Report

> **Epic:** Manajemen MoM, Harga, dan RKAP  
> **Status:** 🔄 IN PROGRESS (Stories 2.1-2.3 Complete)  
> **Tanggal Update:** 2026-09-23

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
| 2.4 | Struktur RKAP dengan Fase dan Capital Item | 🔲 Not Started | 0% |
| 2.5 | Penyesuaian RKAP Manual dalam batas agregat | 🔲 Not Started | 0% |
| 2.6 | Utilization, Achievement & Rebalancing | 🔲 Not Started | 0% |

**Overall Progress:** 50% (3/6 stories complete)

---

## Tasks Completion Summary

### ✅ Completed Tasks (41 of 108)

#### Foundation (Wave 0)
- [x] **Task 1:** shared/domain money and ratio utilities (5 subtasks)
- [x] **Task 2:** price_periods database schema (5 subtasks)
- [x] **Task 3:** RKAP database schema (5 subtasks)

#### Story 2.3 - CMS Harga (Wave 1-3)
- [x] **Task 4:** pricing.service.ts and pricing.repo.ts (5 subtasks)
- [x] **Task 5:** Harga API routes (5 subtasks)
- [x] **Task 6:** Harga UI pages (4 subtasks)

#### Story 2.2 - PDF Upload (Wave 1-3)
- [x] **Task 7:** PDF upload service for MoM (5 subtasks)
- [x] **Task 8:** MoM PDF API routes (3 subtasks)
- [x] **Task 9:** MoM UI for PDF upload and preview (4 subtasks)

### 🔲 Pending Tasks (67 of 108)

#### Story 2.4-2.6 - RKAP (Wave 1-6)
- [ ] **Task 10:** shared/domain/rkap.ts calculation functions (4 subtasks)
- [ ] **Task 11:** rkap.repo.ts (3 subtasks)
- [ ] **Task 12:** rkap.service.ts (8 subtasks)
- [ ] **Task 13:** RKAP API routes (9 subtasks)
- [ ] **Task 14:** RKAP UI - Tabel RKAP (4 subtasks)
- [ ] **Task 15:** RKAP UI - COO Management (5 subtasks)

#### Cross-cutting (Wave 0, 4)
- [ ] **Task 16:** Audit events to registry (1 subtask) — partially done
- [ ] **Task 17:** Integration tests for RKAP adjustment limit (5 subtasks)
- [ ] **Task 18:** Integration tests for price management (4 subtasks)
- [ ] **Task 19:** Integration tests for PDF upload (5 subtasks)

---

## Files Created/Modified

### Database Schema (`drizzle/`)
| File | Status | Description |
|------|--------|-------------|
| `schema.ts` | Modified | Added price_periods, rkap_phases, capital_items, rkap_adjustments tables |
| `storage-bucket.sql` | Created | SQL for mom-pdfs bucket setup |

### Server Domain Layer (`server/domain/`)

#### Pricing Module
| File | Status | Description |
|------|--------|-------------|
| `pricing/pdf.service.ts` | Created | PDF upload, signed URL, delete |
| `pricing/pricing.service.ts` | Created | tetapkanHarga, listHarga, resolveHargaBerjalan |
| `pricing/pricing.repo.ts` | Created | CRUD for price_periods |
| `pricing/mom.service.ts` | Modified | Added PDF deletion on MoM delete |
| `pricing/index.ts` | Modified | Export PDF and pricing functions |

### Shared Domain (`shared/domain/`)
| File | Status | Description |
|------|--------|-------------|
| `money.ts` | Created | Decimal parsing, serialization, arithmetic |
| `ratio.ts` | Created | Percentage formatting |
| `price.ts` | Created | PriceWire types, resolvePrice function |
| `mom.ts` | Modified | PDF constants (MIME, size, expiry) |
| `audit.ts` | Modified | Added audit events |

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

### Frontend Components (`app/components/`)
| File | Status | Description |
|------|--------|-------------|
| `mom/PdfUploadZone.vue` | Created | Drag-drop upload with progress |
| `mom/PdfPreview.vue` | Created | Iframe preview with expiry countdown |

### Frontend Pages (`app/pages/`)
| File | Status | Description |
|------|--------|-------------|
| `harga/index.vue` | Created | CMS Harga with history table |
| `harga/baru.vue` | Created | Price creation form |
| `mom/[id].vue` | Modified | Added PDF upload and preview sections |
| `mom/index.vue` | Modified | Added PDF indicator badge |

---

## Architecture Constraints Applied

| Constraint | Description | Applied In |
|------------|-------------|------------|
| AD-2 | Transaction locking | RKAP service (pending) |
| AD-3 | Audit in same transaction | All services |
| AD-5 | Module table ownership | PRICING, RKAP modules |
| AD-6 | Calculations in shared/domain | money.ts, ratio.ts, price.ts |
| AD-7 | Unique constraint on prices | price_periods schema |
| AD-8 | Role-based access control | All API routes |
| AD-10 | Money as numeric, no parseFloat | money.ts, pricing |
| AR-13 | Supabase Storage private | pdf.service.ts |

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| decimal.js | ^10.x | Arbitrary precision decimal arithmetic |
| @supabase/supabase-js | ^2.x | Storage client for PDF upload |

---

## Environment Variables Required

```env
# Database (Supabase)
NUXT_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://...

# Supabase Storage
NUXT_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NUXT_SUPABASE_SERVICE_KEY=[SERVICE-ROLE-KEY]
```

---

## Test Coverage

### Unit Tests
| Module | Tests | Status |
|--------|-------|--------|
| money.ts | Round-trip property | ✅ Passing |
| mom.service.ts | CRUD + PDF deletion | ✅ 15 tests passing |
| pricing.service.ts | Pending | 🔲 |

### Integration Tests
| Test Suite | Status |
|------------|--------|
| RKAP adjustment limit | 🔲 Pending (Task 17) |
| Price management | 🔲 Pending (Task 18) |
| PDF upload | 🔲 Pending (Task 19) |

---

## Next Steps

1. **Complete RKAP Implementation (Stories 2.4-2.6)**
   - Task 10: shared/domain/rkap.ts calculations
   - Task 11: rkap.repo.ts
   - Task 12: rkap.service.ts
   - Task 13: RKAP API routes
   - Task 14-15: RKAP UI

2. **Complete Integration Tests**
   - Task 17-19: Integration tests

3. **Deployment**
   - Follow [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

---

## Related Documents

- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) — Supabase & Vercel deployment
- [STORY-2.2-COMPLETION-REPORT.md](./STORY-2.2-COMPLETION-REPORT.md) — Story 2.2 details
- [tasks.md](../../.kiro/specs/epic-2-remaining/tasks.md) — Full task list
- [design.md](../../.kiro/specs/epic-2-remaining/design.md) — Technical design

---

*Report ini di-update secara berkala seiring progress implementasi Epic 2.*
