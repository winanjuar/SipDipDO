---
title: 'Story 2.1: MoM MRO/RUPS Tulis Langsung'
type: 'feature'
created: '2026-09-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9f25c43a138b33b294bf4dc2ba57a1a7fe5f5639'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Keputusan MRO/RUPS saat ini hidup di "ingatan kolektif" atau chat tanpa jejak yang jelas. COO tidak memiliki tempat untuk menyimpan notulen dengan status draft/final, dan keputusan-keputusan yang disepakati (harga, RKAP, jenis Contribution) tidak bisa ditautkan ke notulennya.

**Approach:** Bangun CMS MoM di modul PRICING (AD-5) dengan tabel `moms` — COO dapat membuat, mengedit draft, dan memfinalkan notulen. MoM final dapat dibaca pemegang saham; owner tanpa saham/Keluar mendapat permukaan terkunci. Entry audit atomik untuk setiap perubahan (AD-3). Story ini HANYA modus tulis langsung — upload PDF menyusul di Story 2.2.

## Boundaries & Constraints

**Always:**
- Tabel `moms` hanya ditulis modul PRICING (AD-5); kolom `content_text` untuk modus tulis langsung, `pdf_path` NULL untuk story ini
- Entry audit ditulis dalam transaksi DB yang sama dengan aksinya (AD-3): `mom-dibuat`, `mom-diubah`, `mom-difinalkan`
- Tanggal MoM (`held_at`) disimpan `timestamptz` UTC; penyajian di zona Asia/Jakarta via helper `shared/domain/calendar`
- Tanggal WAJIB ada saat membuat MoM (sesuai Story 2.1: "MoM tersimpan dengan tanggal dan status draft")
- Status MoM: `draft` | `final` — enum pgEnum di level DB; draft dapat diedit/dihapus, final imutabel
- Keterbukaan: pemegang saham dapat membaca semua MoM; owner tanpa saham/Keluar → redirect Halaman Personal dengan pesan pembuka akses (AD-8, matriks §4.8)
- Perubahan status `draft → final` tidak dapat di-undo oleh user (COO dapat membuat MoM baru untuk koreksi)

**Never:**
- Modul lain menulis tabel `moms` langsung
- Menghapus MoM yang sudah `final` — hanya soft-delete atau koreksi via MoM baru
- Mengubah content MoM yang sudah `final`
- Audit async/batch di luar transaksi aksi
- Membuat MoM tanpa tanggal

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Buat MoM baru | COO login, POST { title, held_at, content_text } | 201 + MoM record { id, status: 'done' } + audit entry | 401 tanpa sesi; 403 non-COO; 400 tanggal kosong |
| Edit MoM draft | COO, PUT /api/mom/:id { title?, held_at?, content_text? } | 200 + updated record + audit entry | 404 id tidak ada; 400 MoM sudah final |
| Finalkan MoM | COO, POST /api/mom/:id/finalize | 200 + record { status: 'final', finalized_at } + audit | 400 sudah final; 404 tidak ada |
| List MoM | Pemegang saham, GET /api/mom?page=1 | 200 + { data: MoM[], nextPage } urut held_at desc | 403 owner tanpa saham |
| Baca detail MoM | Pemegang saham, GET /api/mom/:id | 200 + MoM record lengkap | 403 owner tanpa saham; 404 tidak ada |
| Hapus MoM draft | COO, DELETE /api/mom/:id | 204 + audit entry | 400 MoM sudah final; 404 tidak ada |
| Belum ada MoM | Pemegang saham membuka halaman | State kosong "Belum ada MoM tersimpan." | — |
| MoM tersimpan | Keputusan harga/RKAP dibuat | Relasi keputusan → MoM tersedia sebagai referensi (FK siap, implementasi Story 2.3/2.4) | — |

</frozen-after-approval>

## Code Map

- `drizzle/schema.ts` -- Tambah tabel `moms` dengan enum `mom_status`
- `drizzle/migrations/` -- Migrasi baru untuk tabel `moms`
- `shared/domain/audit.ts` -- Tambah registry aksi: `mom-dibuat`, `mom-diubah`, `mom-difinalkan`, `mom-dihapus`
- `shared/domain/mom.ts` -- (Baru) Tipe wire, opsi limit, validasi — pola `audit.ts`
- `server/utils/api-error.ts` -- Tambah `notFound: 404` ke HTTP_STATUS
- `server/domain/pricing/mom.repo.ts` -- (Baru) Query Drizzle untuk `moms`
- `server/domain/pricing/mom.service.ts` -- (Baru) Logika bisnis: create, update, finalize, delete, list
- `server/domain/pricing/index.ts` -- Export API publik MoM
- `server/api/mom/index.get.ts` -- List MoM dengan paging
- `server/api/mom/index.post.ts` -- Buat MoM baru
- `server/api/mom/[id].get.ts` -- Detail MoM
- `server/api/mom/[id].put.ts` -- Edit MoM draft
- `server/api/mom/[id].delete.ts` -- Hapus MoM draft
- `server/api/mom/[id]/finalize.post.ts` -- Finalkan MoM
- `app/pages/mom/index.vue` -- (Baru) Halaman daftar MoM
- `app/pages/mom/[id].vue` -- (Baru) Halaman detail/edit MoM
- `app/composables/useMom.ts` -- (Baru) Fetch + state management MoM

## Tasks & Acceptance

**Execution:**
- [x] `shared/domain/audit.ts` -- Tambah `mom-dibuat`, `mom-diubah`, `mom-difinalkan`, `mom-dihapus` ke registry AUDIT_ACTIONS
- [x] `shared/domain/mom.ts` -- Buat file baru: tipe `MomStatus`, `MomWire`, opsi limit paging, validator
- [x] `drizzle/schema.ts` -- Tambah pgEnum `mom_status` dan tabel `moms` (id, title, held_at NOT NULL, status, content_text, finalized_at, created_at, updated_at)
- [x] `drizzle/migrations/` -- Generate dan jalankan migrasi `drizzle-kit generate && drizzle-kit migrate`
- [x] `server/utils/api-error.ts` -- Tambah `notFound: 404` ke HTTP_STATUS
- [x] `server/domain/pricing/mom.repo.ts` -- Implementasi CRUD: insertMom, updateMom, finalizeMom, deleteMom, findMomById, listMoms
- [x] `server/domain/pricing/mom.service.ts` -- Implementasi service dengan audit atomik: buatMom, ubahMom, finalkanMom, hapusMom, listForPemegangSaham, getMomById
- [x] `server/domain/pricing/index.ts` -- Export API publik MoM
- [x] `server/api/mom/index.post.ts` -- POST buat MoM, enforce COO (AD-8), validasi held_at wajib
- [x] `server/api/mom/index.get.ts` -- GET list MoM dengan paging, enforce pemegang saham (AD-8)
- [x] `server/api/mom/[id].get.ts` -- GET detail MoM, enforce pemegang saham
- [x] `server/api/mom/[id].put.ts` -- PUT edit MoM draft, enforce COO, tolak bila final
- [x] `server/api/mom/[id].delete.ts` -- DELETE hapus MoM draft, enforce COO, tolak bila final
- [x] `server/api/mom/[id]/finalize.post.ts` -- POST finalkan MoM, enforce COO
- [x] `app/pages/mom/index.vue` -- Halaman daftar MoM dengan state kosong, Card list, Status Badge (draft=warn, final=success)
- [x] `app/pages/mom/[id].vue` -- Halaman detail/edit: form untuk COO, readonly untuk viewer; tombol Finalkan
- [x] Unit test `server/domain/pricing/mom.service.test.ts` -- Skenario I/O Matrix di atas

**Acceptance Criteria:**
- Given COO login, when membuat MoM baru dengan title, held_at, dan content, then MoM tersimpan status draft dan audit entry `mom-dibuat` tercatat dalam transaksi yang sama
- Given COO login, when membuat MoM tanpa tanggal (held_at kosong), then ditolak 400 "Tanggal MoM wajib diisi"
- Given MoM berstatus draft, when COO memfinalkan, then status berubah final, finalized_at terisi, dan audit entry `mom-difinalkan` tercatat
- Given MoM berstatus final, when COO mencoba edit/hapus, then ditolak 400 "MoM sudah difinalkan"
- Given pemegang saham login, when membuka daftar MoM, then notulen dapat dibaca urut held_at desc
- Given owner tanpa saham login, when mengakses /api/mom atau /mom, then redirect ke Halaman Personal dengan pesan pembuka akses
- Given belum ada MoM tersimpan, when halaman dibuka, then tampil state kosong "Belum ada MoM tersimpan."

## Implementation Notes

<!-- Populated during implementation -->

## Spec Change Log

<!-- Populated by step-04 during review loops -->

- **2026-09-22 — Keterbukaan baca MoM diperluas ke keluar-PERNAH-beli (Story 2.1b).** Baris I/O beku "List/Baca detail → 403 owner tanpa saham" DISEMPURNAKAN: 403 hanya untuk tanpa_saham BELUM-pernah-beli; `tanpa_saham` dengan `aksesPenuh` (keluar yang pernah membeli — matriks §4.8 "terbuka otomatis pasca Pembelian Pertama") BOLEH membaca daftar & detail MoM via `GET /api/mom` dan `GET /api/mom/:id`. Alasan: integrasi navigasi registry Story 1.7 (spec 2.1b) membolehkan permukaan `/mom` bagi aksesPenuh — API harus koheren dengan gerbang middleware (AD-8: keputusan atas snapshot, bukan role saja). Keputusan owner 2026-09-22 (sesi plan Story 2.1b). Mutasi (create/edit/finalize/delete) TETAP COO-only — tidak berubah.

## Review Triage Log

<!-- Populated by step-04 on every review pass -->

## Design Notes

### Skema Tabel `moms`

```sql
CREATE TYPE mom_status AS ENUM ('draft', 'final');

CREATE TABLE moms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  held_at TIMESTAMPTZ NOT NULL,     -- tanggal meeting diadakan, WAJIB
  status mom_status NOT NULL DEFAULT 'draft',
  content_text TEXT,                -- modus tulis langsung
  pdf_path TEXT,                    -- NULL untuk Story 2.1; diisi Story 2.2
  finalized_at TIMESTAMPTZ,         -- di-set saat finalize
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX moms_held_at_idx ON moms (held_at DESC);
CREATE INDEX moms_status_idx ON moms (status);
```

### Pattern Service (Contoh `finalkanMom`)

```typescript
export async function finalkanMom(
  db: DbClient,
  momId: string,
  actorOwnerId: string,
): Promise<MomWire> {
  return db.transaction(async (tx) => {
    const existing = await findMomById(tx, momId)
    if (!existing) throw new Error('MoM tidak ditemukan.')
    if (existing.status === 'final') throw new Error('MoM sudah difinalkan.')

    const updated = await finalizeMom(tx, momId)

    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: actorOwnerId },
      action: 'mom-difinalkan',
      target: `moms:${momId}`,
      details: { title: updated.title, heldAt: updated.heldAt },
    })

    return updated
  })
}
```

### Pattern Route Handler (Contoh POST buat MoM)

```typescript
export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')
  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya COO yang dapat membuat MoM.',
      details: {},
    })
  }

  const body = await readBody(event)
  if (!body.heldAt) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Tanggal MoM wajib diisi.',
      details: { field: 'heldAt' },
    })
  }

  const mom = await buatMom(useDb(), {
    title: body.title,
    heldAt: body.heldAt,
    contentText: body.contentText,
  }, principal.ownerId)

  setResponseStatus(event, HTTP_STATUS.created)
  return mom
})
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run test -- server/domain/pricing/mom` -- expected: all tests pass
- `npx drizzle-kit generate` -- expected: migration file created
- `npx drizzle-kit migrate` -- expected: migration applied

**Manual checks:**
- Buka `/mom` sebagai COO → dapat membuat, edit, finalkan MoM
- Buka `/mom` sebagai pemegang saham → dapat membaca MoM
- Buka `/mom` sebagai owner tanpa saham → redirect ke `/personal` dengan pesan
- Cek audit trail di `/audit-trail` → entry MoM tercatat
- Coba buat MoM tanpa tanggal → ditolak dengan pesan "Tanggal MoM wajib diisi"

| Finding | Location | Verdict | Evidence |
|---------|----------|---------|----------|
| Invalid date format not validated | shared/domain/mom.ts | medium (patched) | Fixed — added Date.parse validation in validateMomCreateInput/validateMomUpdateInput |
| Timezone lossy on edit | app/pages/mom/[id].vue, baru.vue | medium (patched) | Fixed — append T12:00:00+07:00 to date-only input |
| Empty momId not validated | API handlers | false | Drizzle UUID query returns null, service throws NOT_FOUND → 404 |
| deleteMom return not handled | mom.repo/service | false | Service checks existence before delete |
| Dynamic route not in auth-guard | auth-guard.ts | low (rejected) | API layer enforces auth; SSR guard is UX only |
| useMom.ts missing | spec Code Map | low (rejected) | Documentation only; app/lib/mom.ts serves same purpose |
| API auth tests missing | tests/e2e/ | medium (deferred) | Pre-existing pattern — project has no API auth tests |
| Owner keluar not handled | API handlers | false | buildPrincipal resolves keluar appropriately |
| Double identity lookup | API handlers | low (rejected) | Redundant but not harmful; optimization not bug |
| Calendar helper not used | app/lib/mom.ts | low (rejected) | Same result, different approach — acceptable |
