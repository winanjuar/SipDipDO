# Design Document

## Overview

Story 1.8 provides COO with a dedicated interface to manage owner data (identity, contacts, bank accounts) in one centralized location. This replaces spreadsheet-based management and ensures contact information for Bukti Transaksi and OTP MFA is always accurate.

Key constraints from Architecture Spine:
- **AD-3**: All edits must write audit entry in same DB transaction
- **AD-5**: Only IDENTITY module writes to `owners`, `owner_*` tables
- **AD-8**: Authorization enforced at server boundary, not just UI
- **AD-11**: Status changes BLOCKED; only via legitimate CAS domain events

Source references:
- Epic 1: `_bmad-output/planning-artifacts/epics/epic-1.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md`
- PRD FR-13: `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md`

## Architecture

### Layer Map

```
app/pages/admin/owners.vue          → COO-only page (server middleware)
    ↓
server/api/admin/owners/*.ts        → Route handlers (COO auth via findActiveCooTenure)
    ↓
server/domain/identity/             → owner.service.ts (business logic)
    ↓
drizzle/schema.ts                   → owners, owner_emergency_contacts, owner_bank_accounts
```

### Module Boundaries

| Module | Tables Owned | This Story Uses |
|--------|--------------|-----------------|
| `identity` | `owners`, `owner_emergency_contacts`, `owner_bank_accounts`, `coo_tenures` | Read/Write |
| `audit` | `audit_logs` | Write (in-tx) |

### Existing Infrastructure Reuse

- **Audit action**: Reuse existing `'kelola-owner-perubahan'` from `shared/domain/audit.ts`; add `'kelola-owner-penambahan'` for COO manual entry
- **COO authorization**: Use `findActiveCooTenure` from `server/domain/identity` (already exported)
- **Validation constants**: Use `DAFTAR_HUBUNGAN` from `shared/domain/profil.ts`

## Components and Interfaces

### API Endpoints

**GET /api/admin/owners** — List all owners

```typescript
interface ListOwnersResponse {
  owners: Array<{
    id: string
    fullName: string | null
    alias: string | null
    email: string
    phoneNumber: string | null
    status: OwnerStatus
    profileComplete: boolean
    createdAt: string
  }>
}
```

**GET /api/admin/owners/:id** — Get owner detail

```typescript
interface GetOwnerResponse {
  owner: Owner
  emergencyContact: OwnerEmergencyContact | null
  bankAccount: OwnerBankAccount | null
}
```

**PUT /api/admin/owners/:id** — Update owner data

```typescript
interface UpdateOwnerRequest {
  fullName?: string
  alias?: string
  phoneNumber?: string
  emergencyContact?: {
    name?: string
    phoneNumber?: string
    relationship?: string
  }
  bankAccount?: {
    bankName?: string
    accountHolderName?: string
    accountNumber?: string
  }
}
```

**POST /api/admin/owners** — Create owner (COO manual entry)

```typescript
interface CreateOwnerRequest {
  email: string
  fullName?: string
  alias?: string
  phoneNumber?: string
  emergencyContact?: { /* same as update */ }
  bankAccount?: { /* same as update */ }
}
```

### Domain Service Interface

```typescript
// server/domain/identity/index.ts — additions for Story 1.8
export {
  listOwners,
  getOwnerById,
  updateOwner,
  createOwnerByCoo,
} from './owner.service'
```

### UI Components

**app/pages/admin/owners.vue**
- COO-only page with definePageMeta middleware
- Table (desktop) / Card list (mobile) with search
- Edit and Add actions via dialogs

**app/components/admin/OwnerEditDialog.vue**
- Sheet (mobile) / Dialog (desktop)
- Sections: Identitas, Kontak, Kontak Darurat, Rekening Bank
- Status field disabled with tooltip

**app/components/admin/OwnerAddDialog.vue**
- Email required field
- Note about pre-approved status (terverifikasi)

**app/components/admin/OwnerPicker.vue**
- Reusable combobox with search
- Includes ALL owners (for Epic 3 Story 3.7)

## Data Models

### Validation Schema

```typescript
// server/domain/identity/owner.schemas.ts
import { z } from 'zod'
import { DAFTAR_HUBUNGAN } from '#shared/domain/profil'

export const updateOwnerSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  alias: z.string().min(1).max(50).optional(),
  phoneNumber: z.string().regex(/^08\d{8,12}$/).optional(),
  status: z.never().optional(), // Explicitly rejected (AD-11)
  emergencyContact: z.object({
    name: z.string().min(1).max(100).optional(),
    phoneNumber: z.string().regex(/^08\d{8,12}$/).optional(),
    relationship: z.enum(DAFTAR_HUBUNGAN).optional(),
  }).optional(),
  bankAccount: z.object({
    bankName: z.string().min(1).max(100).optional(),
    accountHolderName: z.string().min(1).max(100).optional(),
    accountNumber: z.string().regex(/^\d{10,20}$/).optional(),
  }).optional(),
})
```

### Audit Events

```typescript
// shared/domain/audit.ts — additions (kebab-case per existing convention)
export const AUDIT_ACTIONS = [
  // ... existing actions ...
  'kelola-owner-perubahan',    // Already exists — reuse for edit
  'kelola-owner-penambahan',   // NEW — COO manual entry
] as const
```

## Correctness Properties

### Property 1: Audit Atomicity (AD-3)

Every owner data change MUST write audit entry in the same DB transaction. If the audit write fails, the entire transaction rolls back.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5, 3.3**

### Property 2: Status Immutability (AD-11)

PUT endpoint MUST reject any request containing `status` field. Status changes only occur via legitimate domain events (registration flow, verification, expiry cron, effective transaction).

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 3: Email Uniqueness

POST endpoint MUST reject duplicate email with 409 conflict. Each owner is uniquely identified by email (unique constraint on `owners.email`).

**Validates: Requirements 3.2**

### Property 4: Module Ownership (AD-5)

Only identity module writes to owner tables (`owners`, `owner_emergency_contacts`, `owner_bank_accounts`). Cross-module access is read-only via exported functions.

**Validates: Requirements 2.1, 2.2, 2.3, 3.1**

### Property 5: COO Authorization (AD-8)

All endpoints MUST verify COO tenure at server boundary via `findActiveCooTenure`. Authorization is enforced in route handlers, not just UI.

**Validates: Requirements 1.2, 1.3**

### Property 6: New Owner Status

When COO creates owner via POST, status MUST be set to `terverifikasi` (pre-approved). No other initial status is allowed.

**Validates: Requirements 3.1**

## Error Handling

| Error Code | HTTP | Condition |
|------------|------|-----------|
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Not COO |
| `NOT_FOUND` | 404 | Owner not found |
| `STATUS_CHANGE_FORBIDDEN` | 400 | Attempted status change |
| `EMAIL_EXISTS` | 409 | Duplicate email on create |
| `VALIDATION_ERROR` | 400 | Invalid input fields |

## Testing Strategy

### Unit Tests

- `server/domain/identity/owner.service.test.ts`
  - `listOwners()` returns all owners with correct shape
  - `getOwnerById()` returns owner with related data
  - `updateOwner()` persists changes and writes audit
  - `updateOwner()` rejects status field
  - `createOwnerByCoo()` creates with `terverifikasi` status
  - `createOwnerByCoo()` rejects duplicate email

### API Tests (E2E)

- `tests/e2e/admin-owners.api.spec.ts`
  - GET /api/admin/owners — returns list for COO, 403 for non-COO
  - GET /api/admin/owners/:id — returns detail for COO
  - PUT /api/admin/owners/:id — updates data, 400 on status change
  - POST /api/admin/owners — creates owner, 409 on duplicate email

### E2E Tests

- `tests/e2e/admin-owners.spec.ts`
  - COO can access /admin/owners page
  - Non-COO redirected from /admin/owners
  - Edit dialog saves changes
  - Add dialog creates new owner
  - OwnerPicker shows all owners including `keluar`
