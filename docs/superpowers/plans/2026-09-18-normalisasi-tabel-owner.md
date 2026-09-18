# Normalisasi Tabel Owner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalisasi `owners` ke 3NF dengan dekomposisi 3 tabel + seluruh nama field English (DB kolom, properti TS, kunci wire API), reset 6 migrasi lama menjadi satu baseline baru.

**Architecture:** Dekomposisi entitas — atribut kontak darurat & rekening bank dipindah ke tabel 1:1 (`owner_emergency_contacts`, `owner_bank_accounts`, PK `owner_id` + FK). Kolom bersyarat `bank_lain` dihapus: `bank_name` menyimpan nilai tunggal (nilai combobox ATAU teks bebas "Bank Lainnya"); derivation wire↔storage via helper murni `shared/domain/profil.ts` (AD-6). Migrasi di-squash jadi baseline 0000 baru (belum ada DB produksi; DB dev sintetis).

**Tech Stack:** Nuxt 4 + Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 + PostgreSQL 17 (Supabase CLI lokal) + Vitest + Playwright.

**Spec:** Keputusan owner 2026-09-18 (sesi opencode): 3 tabel; `used_referral_code` tetap text; cakupan English = DB + TS + wire API; tanpa kolom other-bank di DB; urutan kolom `owners`: `id, full_name, alias, email, phone_number, status, referral_code, used_referral_code`.

## Global Constraints

- AGENTS.md: tabel snake_case jamak; ID uuid; uang/ratio string desimal (AD-10); enum status nilai Indonesia dipinkan AD-11; `_bmad-output/` beku; data nyata tidak masuk repo/DB dev.
- Deviasi wire spec-1-5 (kunci English) dicatat di commit message, bukan di artefak beku.
- Branch: `feature/normalize-owners` (stack dari `feature/story-1-5` — kode Story 1.5 yang direfaktor belum ada di `develop`).

## Skema Target

```
owners                          owner_emergency_contacts      owner_bank_accounts
  id (PK)                         owner_id (PK, FK→owners)      owner_id (PK, FK→owners)
  full_name                       name                          bank_name        ← nilai tunggal
  alias                           phone_number                  account_holder_name
  email (UNIQUE)                  relationship                  account_number
  phone_number
  status (enum, nilai tetap)
  rejection_reason
  first_effective_at
  referral_code (UNIQUE NOT NULL)
  used_referral_code (text)
  created_at / updated_at
```

Wire profil (English): `fullName, alias, gmail(=email sesi), phoneNumber, emergencyContactName, emergencyContactPhoneNumber, emergencyContactRelationship, bankName, otherBankName, accountHolderName, accountNumber`.

- Simpan (PUT): `bankName='Lainnya'` → simpan `otherBankName`; selain itu simpan nilai combobox.
- Baca (GET): `bank_name ∈ DAFTAR_BANK` → `{bankName: nilai, otherBankName: ''}`; else → `{bankName: 'Lainnya', otherBankName: nilai}`.
- Edge diterima: teks bebas persis nama bank enum (mis. "BCA") → GET balik sebagai pilihan combobox — setara semantik.

---

### Task 1 — Kontrak murni `shared/domain/profil.ts` (TDD)

**Files:** Modify `shared/domain/profil.test.ts`, `shared/domain/profil.ts`

- [ ] Test dulu (red): rename kunci di `profil.test.ts` → English + test baru helper murni `namaBankKeTersimpan(bankName, otherBankName)` & `namaBankKeWire(tersimpan)` (termasuk edge enum-vs-bebas)
- [ ] `FIELD_PROFIL_SIMPAN`/`LABEL_FIELD_PROFIL`/`validasiProfil`/`sisaFieldKosong` → kunci English (label tampilan & nilai enum tetap Indonesia)
- [ ] `npm test` green → commit

### Task 2 — Skema Drizzle + baseline migrasi baru

**Files:** Modify `drizzle/schema.ts`; delete `drizzle/migrations/*.sql` + `drizzle/migrations/meta/*`

- [ ] Rewrite `owners` (urutan kolom di atas) + `owner_emergency_contacts` + `owner_bank_accounts` (anak tanpa timestamp)
- [ ] Hapus 6 SQL + 6 snapshot + `_journal.json` → `npm run db:generate` → review baseline `0000` (urutan kolom, FK, unique) → commit

### Task 3 — Repo identity (join 3 tabel)

**Files:** Modify `server/domain/identity/owner.repo.ts`, `owner.repo.test.ts`

- [ ] `OwnerRecord` bentuk wire; `findOwnerByEmail` LEFT JOIN 2 tabel anak + mapping bank via helper Task 1
- [ ] `simpanProfilCalon` → satu tx: UPDATE owners guard `status='diajukan'` RETURNING id → upsert `ON CONFLICT (owner_id) DO UPDATE` 2 tabel anak
- [ ] `daftarOwnerByEmail`/`upsertOwnerByEmail` hanya menyentuh owners (anak null = konsisten LEFT JOIN); update unit test → commit

### Task 4 — Service + API handlers

**Files:** Modify `access.service.ts`(+test), `registration.service.ts`(+2 test), `server/api/profile/index.get.ts`, `index.put.ts`

- [ ] Port shape English; GET reconstruct wire; PUT derive nilai tersimpan → commit

### Task 5 — UI `/profile-completeness`

**Files:** Modify `app/pages/profile-completeness.vue`

- [ ] Kunci isian/id elemen English; label tampilan tetap Indonesia → commit

### Task 6 — Utilitas dev & test support

**Files:** Modify `drizzle/cleanup.ts`, `tests/support/helpers/owner-reset.ts`, `tests/support/fixtures/cleanup.ts`

- [ ] DELETE 2 tabel anak FK-safe sebelum owners → commit

### Task 7 — E2E specs

**Files:** Modify `tests/e2e/profil.api.spec.ts`, `tests/e2e/kelengkapan-profil.spec.ts`

- [ ] Kunci wire English; round-trip "Lainnya" → commit

### Task 8 — Reset DB dev + verifikasi penuh

- [ ] Drop schema public (cascade) + recreate → `npm run db:migrate` → re-run `drizzle/grants.sql` → `npm run db:seed`
- [ ] `npm run lint && npm run typecheck && npm test` → `npm run test:e2e` → commit fixup bila ada
