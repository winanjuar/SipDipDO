# Requirements Document

## Introduction

This specification covers **Story 1.8 - Manajemen Owner oleh COO** from Epic 1 (Pendaftaran Owner & Fondasi Akses). The story enables COO to manage owner data (identity, contacts, status) in one place, ensuring data is always up-to-date without spreadsheets and that contact information for Bukti Transaksi & OTP is always correct.

Source references:
- Epic: `_bmad-output/planning-artifacts/epics/epic-1.md` (Story 1.8)
- Architecture: `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md`
- PRD: `_bmad-output/planning-artifacts/prds/prd-snd-dash-2026-08-14/prd.md` (FR-13)

## Glossary

- **COO** — Chief Operating Officer; single user with transactional authority over the system.
- **Owner** — A shareholder or prospective shareholder in the system.
- **Status Lifecycle** — Owner states defined in AD-11: `diajukan`, `terverifikasi`, `ditolak`, `kedaluwarsa`, `keluar`.
- **CAS** — Compare-and-Set; atomic status transition pattern ensuring only one writer succeeds.
- **Audit Trail** — Immutable log of all system actions as defined in AD-3.

## Requirements

### Requirement 1: Owner Management Page Access

**User Story:** Sebagai COO, saya ingin memiliki halaman khusus untuk melihat dan mengelola semua data owner, sehingga saya dapat mengelola data di satu tempat terpusat.

#### Acceptance Criteria

1. WHEN COO mengakses `/admin/owners`, THE Sistem SHALL menampilkan halaman Manajemen Owner dengan daftar semua owner.
2. WHEN pengguna non-COO mengakses `/admin/owners` secara langsung, THE Sistem SHALL menolak akses di batas server dan mengalihkan ke halaman yang sesuai dengan pesan kesalahan.
3. THE Sistem SHALL menegakkan otorisasi di route handler server, bukan hanya di UI (AD-8).

### Requirement 2: Edit Owner Data with Audit Trail

**User Story:** Sebagai COO, saya ingin mengedit data identitas dan kontak owner dengan jejak audit lengkap, sehingga perubahan tercatat dan kontak untuk Bukti/OTP selalu benar.

#### Acceptance Criteria

1. WHEN COO mengedit data owner (fullName, alias, phoneNumber), THE Sistem SHALL menyimpan perubahan dan mencatat entry audit dalam transaksi DB yang sama (AD-3, FR-13).
2. WHEN COO mengedit kontak darurat owner (name, phoneNumber, relationship), THE Sistem SHALL menyimpan perubahan dan mencatat entry audit.
3. WHEN COO mengedit rekening bank owner (bankName, accountHolderName, accountNumber), THE Sistem SHALL menyimpan perubahan dan mencatat entry audit.
4. THE Sistem SHALL NOT mengizinkan perubahan field email karena email adalah identifier unik owner.
5. THE Sistem SHALL mencatat detail audit berisi perubahan old → new untuk setiap field yang berubah.

### Requirement 3: Add Owner Manual Entry

**User Story:** Sebagai COO, saya ingin menambah owner baru secara manual untuk skenario migrasi atau kasus khusus, sehingga owner eksisting dapat diinput tanpa melalui alur pendaftaran.

#### Acceptance Criteria

1. WHEN COO menambah owner baru dengan email, THE Sistem SHALL membuat baris owner dengan status `terverifikasi` (pre-approved).
2. IF email yang dimasukkan sudah terdaftar, THEN THE Sistem SHALL menolak pembuatan dan menampilkan pesan "Email sudah terdaftar".
3. WHEN owner baru berhasil dibuat, THE Sistem SHALL mencatat pembuatan di audit trail dengan detail email dan status.

### Requirement 4: Owner Picker for Transaction Input

**User Story:** Sebagai COO, saya ingin memilih owner mana pun saat input transaksi, sehingga saya dapat mencatat transaksi untuk semua owner termasuk yang belum pernah membeli.

#### Acceptance Criteria

1. THE Sistem SHALL menyediakan komponen pemilih owner yang dapat digunakan ulang.
2. WHEN daftar owner dimuat untuk pemilih, THE Sistem SHALL menyertakan SEMUA owner termasuk yang berstatus `keluar` dan yang belum pernah membeli (FR-13).
3. THE Sistem SHALL mendukung pencarian/filter pada komponen pemilih owner.

### Requirement 5: Status Change Protection

**User Story:** Sebagai pengelola sistem, saya ingin mencegah perubahan status secara langsung oleh COO, sehingga integritas domain terjaga dan status hanya berubah via event domain yang sah.

#### Acceptance Criteria

1. WHEN COO mengirim request PUT dengan field `status`, THE Sistem SHALL menolak request dengan pesan "Transisi status hanya via transisi sah bersistem" (AD-11).
2. THE Sistem SHALL memastikan transisi status hanya terjadi melalui:
   - Alur pendaftaran (Story 1.4)
   - Verifikasi COO (Story 1.6)
   - Cron kedaluwarsa (Story 1.5)
   - Transaksi efektif (Epic 3)
3. IF COO mencoba mengubah status `keluar → terverifikasi` secara langsung, THEN THE Sistem SHALL menolak karena reaktivasi hanya terjadi lewat transaksi efektif (FR-13).
