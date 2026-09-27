# Story 2.2: Upload PDF MoM & Preview Web via Signed URL

> **Epic:** Epic 2 — Manajemen MoM, Harga, dan RKAP  
> **Status:** ✅ COMPLETED  
> **Tanggal Selesai:** 2026-09-23

---

## Ringkasan

Story 2.2 mengimplementasikan fitur upload PDF untuk MoM (Minutes of Meeting) dan preview via Signed URL. COO dapat mengunggah dokumen PDF ke MoM, sementara pemegang saham dapat melihat preview PDF langsung di browser.

---

## Requirements yang Dipenuhi

### Req-1: Upload PDF MoM ke Storage Privat

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | PDF tersimpan di Supabase Storage bucket privat dengan metadata mom_id | ✅ |
| 2 | Path file tercatat di kolom `pdf_path` tabel moms | ✅ |
| 3 | Audit event `mom-pdf-uploaded` tercatat | ✅ |
| 4 | Non-COO tidak dapat upload (HTTP 403) | ✅ |
| 5 | PDF terhapus dari storage saat draft MoM dihapus | ✅ |
| 6 | Validasi tipe file `application/pdf` dan ukuran maksimal 10MB | ✅ |

### Req-2: Preview PDF MoM via Signed URL

| AC | Deskripsi | Status |
|----|-----------|--------|
| 1 | Signed URL berlaku 15 menit | ✅ |
| 2 | Sesi pengguna dan role terverifikasi | ✅ |
| 3 | Akses tanpa sesi valid ditolak (HTTP 401) | ✅ |
| 4 | URL kedaluwarsa ditolak | ✅ |
| 5 | PDF tampil dalam iframe atau viewer web native | ✅ |
| 6 | Logo `logo.jpg` tersedia untuk materi email | ✅ |

---

## Arsitektur & Alur Data

### Upload Flow

```
COO Browser                  API Layer                  Service Layer              Storage
    │                            │                            │                        │
    │  POST /api/mom/[id]/upload │                            │                        │
    │──────────────────────────>│                            │                        │
    │   (multipart/form-data)   │                            │                        │
    │                            │  uploadMomPdf()            │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  upload to bucket      │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │                            │  path                  │
    │                            │                            │                        │
    │                            │                            │  update mom.pdf_path   │
    │                            │                            │  write audit           │
    │                            │<──────────────────────────│                        │
    │   200 OK + MomWire        │                            │                        │
    │<──────────────────────────│                            │                        │
```

### Preview Flow

```
User Browser                 API Layer                  Service Layer              Storage
    │                            │                            │                        │
    │  GET /api/mom/[id]/signed  │                            │                        │
    │──────────────────────────>│                            │                        │
    │                            │  generateSignedUrl()       │                        │
    │                            │──────────────────────────>│                        │
    │                            │                            │  createSignedUrl()     │
    │                            │                            │──────────────────────>│
    │                            │                            │<──────────────────────│
    │                            │<──────────────────────────│  signedUrl + expiresAt│
    │   { url, expiresAt }      │                            │                        │
    │<──────────────────────────│                            │                        │
    │                            │                            │                        │
    │  iframe src=signedUrl     │                            │                        │
    │──────────────────────────────────────────────────────────────────────────────>│
    │<──────────────────────────────────────────────────────────────────────────────│
    │   PDF content rendered    │                            │                        │
```

---

## File yang Dibuat/Dimodifikasi

### Files Created (Baru)

| File | Deskripsi |
|------|-----------|
| `drizzle/storage-bucket.sql` | SQL untuk membuat bucket mom-pdfs |
| `server/domain/pricing/pdf.service.ts` | Service layer untuk PDF upload dan signed URL |
| `server/api/mom/[id]/upload.post.ts` | API route upload PDF (COO only) |
| `server/api/mom/[id]/signed.get.ts` | API route generate signed URL |
| `app/components/mom/PdfUploadZone.vue` | Komponen upload drag-drop dengan progress |
| `app/components/mom/PdfPreview.vue` | Komponen preview iframe dengan expiry countdown |

### Files Modified (Diubah)

| File | Perubahan |
|------|-----------|
| `shared/domain/audit.ts` | Tambah event `mom-pdf-uploaded` |
| `shared/domain/mom.ts` | Tambah konstanta PDF_MIME_TYPE, PDF_MAX_SIZE, SIGNED_URL_EXPIRY |
| `server/domain/pricing/mom.service.ts` | Update hapusMom untuk delete PDF dari storage |
| `server/api/mom/[id].delete.ts` | Integrasi cleanup PDF |
| `app/pages/mom/[id].vue` | Integrasi upload zone dan preview section |
| `app/pages/mom/index.vue` | Tambah PDF indicator badge |

---

## Cara Mengakses Fitur

### Upload PDF (COO)

1. Login sebagai COO
2. Navigasi ke **MoM** → pilih MoM draft yang ingin ditambahi PDF
3. Scroll ke bagian **Dokumen PDF**
4. Drag & drop file PDF atau klik untuk browse
5. Tunggu progress upload selesai
6. PDF akan tersimpan dan siap dipreview

### Preview PDF (Semua Pengguna Berwenang)

1. Login sebagai COO atau pemegang saham
2. Navigasi ke **MoM** → pilih MoM yang memiliki PDF (ditandai ikon 📄)
3. Klik **Lihat PDF** atau section preview akan tampil otomatis
4. PDF ditampilkan dalam iframe
5. Timer menunjukkan waktu tersisa URL (15 menit)
6. Klik **Refresh URL** jika expired

### Validasi & Batasan

| Validasi | Nilai |
|----------|-------|
| Tipe file | `application/pdf` only |
| Ukuran maksimal | 10 MB |
| Durasi signed URL | 15 menit |
| Akses upload | COO only |
| Akses preview | COO + pemegang saham |

---

## Constraint Arsitektur yang Diterapkan

| Constraint | Penerapan |
|------------|-----------|
| AD-3 | Audit entries ditulis dalam transaksi sama dengan aksi |
| AD-8 | Role-based access control di server boundary |
| AD-10 | Konstanta bernama untuk magic numbers |
| AR-13 | Supabase Storage bucket privat, akses via signed URL |

---

## Testing

### Unit Tests

- `server/domain/pricing/pdf.service.test.ts` — 44 tests
  - Upload PDF updates mom.pdf_path
  - MIME validation rejects non-PDF
  - Size validation rejects >10MB
  - Signed URL generation
  - MoM deletion cleans up PDF

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

## Environment Variables

```env
NUXT_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NUXT_SUPABASE_SERVICE_KEY=[SERVICE-ROLE-KEY]
```

---

*Dokumentasi Story 2.2 — Sip & Dip Ownership Dashboard*
