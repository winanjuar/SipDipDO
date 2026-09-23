# Story 2.2 Completion Report

> **Story:** Upload PDF MoM & Preview Web via Signed URL  
> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.2 mengimplementasikan kemampuan COO untuk mengunggah file PDF ke MoM (Minutes of Meeting) dan memungkinkan pemegang saham untuk melihat preview PDF via Signed URL dengan expiry 15 menit.

---

## Requirements yang Dipenuhi

### Req-1: Upload PDF MoM ke Storage Privat

| AC | Deskripsi | Status |
|----|-----------|--------|
| AC1 | COO dapat upload PDF ke draft MoM | ✅ |
| AC2 | File disimpan di Supabase Storage bucket privat | ✅ |
| AC3 | Path PDF tercatat di kolom `moms.pdf_path` | ✅ |
| AC4 | Audit event `mom-pdf-uploaded` tercatat | ✅ |
| AC5 | PDF dihapus dari storage saat draft MoM dihapus | ✅ |
| AC6 | Validasi: hanya PDF, maksimal 10MB | ✅ |

### Req-2: Preview PDF via Signed URL

| AC | Deskripsi | Status |
|----|-----------|--------|
| AC1 | Signed URL berlaku 15 menit | ✅ |
| AC2 | COO dapat preview PDF | ✅ |
| AC3 | Pemegang saham dapat preview PDF | ✅ |
| AC4 | Owner tanpa saham (belum pernah beli) tidak dapat preview | ✅ |
| AC5 | Preview tampil dalam iframe | ✅ |
| AC6 | UI menampilkan countdown expiry dan tombol refresh | ✅ |

---

## Tasks yang Diselesaikan

### Task 7: Implement PDF Upload Service for MoM ✅

| Sub-task | Deskripsi | File |
|----------|-----------|------|
| 7.1 | Configure Supabase Storage bucket 'mom-pdfs' as private | `drizzle/storage-bucket.sql` |
| 7.2 | Create pdf.service.ts dengan uploadMomPdf | `server/domain/pricing/pdf.service.ts` |
| 7.3 | Implement generateSignedUrl dengan 15-minute expiry | `server/domain/pricing/pdf.service.ts` |
| 7.4 | Add audit event mom-pdf-uploaded ke registry | `shared/domain/audit.ts` |
| 7.5 | Handle PDF deletion saat draft MoM dihapus | `server/domain/pricing/mom.service.ts` |

### Task 8: Create MoM PDF API Routes ✅

| Sub-task | Deskripsi | File |
|----------|-----------|------|
| 8.1 | Create upload.post.ts (multipart, COO only) | `server/api/mom/[id]/upload.post.ts` |
| 8.2 | Create signed.get.ts (authenticated users) | `server/api/mom/[id]/signed.get.ts` |
| 8.3 | Update MoM delete route untuk cleanup PDF | `server/api/mom/[id].delete.ts` |

### Task 9: Update MoM UI for PDF Upload and Preview ✅

| Sub-task | Deskripsi | File |
|----------|-----------|------|
| 9.1 | Add PDF upload zone dengan drag-drop, validation, progress | `app/components/mom/PdfUploadZone.vue` |
| 9.2 | Add PDF preview component dengan iframe, expiry handling | `app/components/mom/PdfPreview.vue` |
| 9.3 | Show PDF indicator di MoM list page | `app/pages/mom/index.vue` |
| 9.4 | Conditionally show upload zone only for COO on draft MoMs | `app/pages/mom/[id].vue` |

---

## Arsitektur & Alur Data

### Upload Flow

```
┌──────────┐     POST /api/mom/[id]/upload     ┌──────────────┐
│  Client  │ ─────────────────────────────────▶│  API Route   │
│ (COO UI) │     multipart/form-data           │ upload.post  │
└──────────┘                                    └──────┬───────┘
                                                       │
                    ┌──────────────────────────────────┘
                    ▼
            ┌───────────────┐
            │ pdf.service   │
            │ uploadMomPdf  │
            └───────┬───────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ Supabase  │ │   moms    │ │  audit    │
│ Storage   │ │ pdf_path  │ │  logs     │
└───────────┘ └───────────┘ └───────────┘
```

### Preview Flow

```
┌──────────┐     GET /api/mom/[id]/signed      ┌──────────────┐
│  Client  │ ─────────────────────────────────▶│  API Route   │
│ (Viewer) │                                   │ signed.get   │
└──────────┘                                    └──────┬───────┘
     │                                                 │
     │                                    ┌────────────┘
     │                                    ▼
     │                            ┌───────────────┐
     │                            │ pdf.service   │
     │                            │generateSigned │
     │                            └───────┬───────┘
     │                                    │
     │                                    ▼
     │                            ┌───────────────┐
     │                            │   Supabase    │
     │                            │ createSigned  │
     │                            └───────┬───────┘
     │                                    │
     │         { url, expiresAt }         │
     │◀───────────────────────────────────┘
     │
     │  iframe src={signedUrl}
     ▼
┌──────────┐
│ Supabase │
│ Storage  │
└──────────┘
```

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `drizzle/storage-bucket.sql` | SQL untuk membuat bucket mom-pdfs |
| `server/domain/pricing/pdf.service.ts` | Service layer untuk PDF operations |
| `server/api/mom/[id]/upload.post.ts` | API route upload PDF |
| `server/api/mom/[id]/signed.get.ts` | API route generate signed URL |
| `app/components/mom/PdfUploadZone.vue` | Komponen upload drag-drop |
| `app/components/mom/PdfPreview.vue` | Komponen preview dengan iframe |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `shared/domain/audit.ts` | Tambah event `mom-pdf-uploaded` |
| `shared/domain/mom.ts` | Tambah konstanta PDF (MIME, size, expiry) |
| `server/domain/pricing/mom.service.ts` | Update hapusMom untuk delete PDF |
| `server/domain/pricing/index.ts` | Export PDF service functions |
| `app/pages/mom/[id].vue` | Integrasi upload zone dan preview |
| `app/pages/mom/index.vue` | Tambah PDF indicator badge |

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| **AD-3** | Audit entries ditulis dalam transaksi yang sama dengan aksi |
| **AD-8** | Role-based access control: upload=COO, preview=COO+pemegang_saham |
| **AD-10** | Konstanta bernama untuk magic numbers (size limit, expiry seconds) |
| **AR-13** | Supabase Storage bucket privat, akses via signed URL |

---

## Testing

### Unit Tests

- `server/domain/pricing/mom.service.test.ts` — 15 tests passing
  - Termasuk test untuk PDF deletion saat hapus MoM draft

### Manual Testing Checklist

- [x] COO dapat upload PDF ke draft MoM
- [x] Upload menampilkan progress indicator
- [x] Validasi menolak file non-PDF
- [x] Validasi menolak file > 10MB
- [x] Preview menampilkan PDF dalam iframe
- [x] Countdown expiry berfungsi
- [x] Tombol refresh URL berfungsi setelah expired
- [x] PDF indicator muncul di list MoM
- [x] Non-COO tidak melihat upload zone
- [x] PDF terhapus saat draft MoM dihapus

---

## Environment Variables yang Diperlukan

```env
# Wajib untuk fitur PDF Storage
NUXT_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NUXT_SUPABASE_SERVICE_KEY=[SERVICE-ROLE-KEY]
```

---

## Dokumentasi Terkait

- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) — Panduan migrasi ke Supabase dan deploy ke Vercel
- [design.md](../../.kiro/specs/epic-2-remaining/design.md) — Technical design Epic 2
- [tasks.md](../../.kiro/specs/epic-2-remaining/tasks.md) — Implementation tasks

---

## Next Steps (Story Selanjutnya)

Story 2.2 sudah selesai. Berikut status Epic 2:

| Story | Status | Deskripsi |
|-------|--------|-----------|
| 2.1 | ✅ Done | MoM MRO/RUPS Tulis Langsung |
| **2.2** | **✅ Done** | **Upload PDF MoM & Preview Web via Signed URL** |
| 2.3 | ✅ Done | CMS Harga Saham dengan riwayat |
| 2.4 | 🔲 Pending | Struktur RKAP dengan Fase dan Capital Item |
| 2.5 | 🔲 Pending | Penyesuaian RKAP Manual dalam batas agregat |
| 2.6 | 🔲 Pending | Utilization, Achievement & Rebalancing |

---

*Report ini dibuat otomatis sebagai bagian dari proses development Sip & Dip Ownership Dashboard.*
