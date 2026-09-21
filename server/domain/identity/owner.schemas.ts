/**
 * IDENTITY — owner.schemas.ts (Story 1.8): Zod validation schemas untuk API
 * manajemen owner oleh COO. Aturan validasi:
 * - `status` field WAJIB ditolak (AD-11): status hanya berubah via domain event
 * - `email` TIDAK dapat diubah (identifier unik owner)
 * - Konstanta batas & enum diambil dari `shared/domain/profil` (AD-6)
 *
 * Schema dipakai oleh API handlers:
 * - PUT /api/admin/owners/:id → `updateOwnerSchema`
 * - POST /api/admin/owners    → `createOwnerSchema`
 */
import { z } from 'zod'
import {
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  DIGIT_MAKS_HP,
  DIGIT_MIN_HP,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  BANK_LAINNYA,
} from '#shared/domain/profil'

/** Panjang maksimum alamat email — RFC 5321 membatasi 254 karakter;
 *  dibulatkan ke 255 untuk batas kolom DB yang umum. */
const PANJANG_MAKS_EMAIL = 255

/* ------------------------------------------------------------------ *
 * Shared field schemas — dipakai update & create.
 * ------------------------------------------------------------------ */

/**
 * Pola Nomor HP: mulai dengan '0', total 9–15 digit (mengabaikan tanda "-").
 * Validasi dilakukan setelah membuang dash untuk menghitung digit.
 */
const nomorHpSchema = z
  .string()
  .refine(
    (val) => {
      if (val.length === 0) return true // optional — kosong valid
      const digitOnly = val.replaceAll('-', '')
      return /^0\d+$/.test(digitOnly) && digitOnly.length >= DIGIT_MIN_HP && digitOnly.length <= DIGIT_MAKS_HP
    },
    { message: `Nomor HP harus dimulai dengan 0 dan terdiri dari ${DIGIT_MIN_HP}–${DIGIT_MAKS_HP} digit` },
  )
  .optional()

/** Schema kontak darurat (nested object). */
const emergencyContactSchema = z
  .object({
    name: z.string().min(1).max(PANJANG_MAKS_NAMA).optional(),
    phoneNumber: nomorHpSchema,
    relationship: z.enum(DAFTAR_HUBUNGAN).optional(),
  })
  .optional()

/** Pola Nomor Rekening: hanya digit dan dash, 10–20 karakter. */
const nomorRekeningSchema = z
  .string()
  .refine(
    (val) => {
      if (val.length === 0) return true // optional — kosong valid
      return /^[-0-9]+$/.test(val) && val.length <= PANJANG_MAKS_REKENING
    },
    { message: `Nomor rekening hanya digit dan dash, maksimum ${PANJANG_MAKS_REKENING} karakter` },
  )
  .optional()

/** Daftar bank lengkap termasuk opsi "Lainnya". */
const DAFTAR_BANK_LENGKAP = [...DAFTAR_BANK, BANK_LAINNYA] as const

/** Schema rekening bank (nested object). */
const bankAccountSchema = z
  .object({
    bankName: z.enum(DAFTAR_BANK_LENGKAP).optional(),
    /** Nama bank lainnya — wajib diisi bila bankName = "Lainnya". */
    otherBankName: z.string().min(1).max(PANJANG_MAKS_NAMA).optional(),
    accountHolderName: z.string().min(1).max(PANJANG_MAKS_NAMA).optional(),
    accountNumber: nomorRekeningSchema,
  })
  .refine(
    (val) => {
      // Bila bankName = "Lainnya", otherBankName wajib diisi
      if (val.bankName === BANK_LAINNYA) {
        return val.otherBankName !== undefined && val.otherBankName.trim().length > 0
      }
      return true
    },
    { message: 'Nama bank lainnya wajib diisi bila memilih "Lainnya"' },
  )
  .optional()

/* ------------------------------------------------------------------ *
 * Update Owner Schema — PUT /api/admin/owners/:id
 * ------------------------------------------------------------------ */

/**
 * Schema untuk update data owner oleh COO (Story 1.8, Req 2).
 * - Field `status` DITOLAK EKSPLISIT (AD-11)
 * - Field `email` TIDAK ADA (identifier unik, tidak dapat diubah)
 * - Semua field opsional — partial update didukung
 */
export const updateOwnerSchema = z
  .object({
    fullName: z.string().min(1).max(PANJANG_MAKS_NAMA).optional(),
    alias: z.string().min(1).max(PANJANG_MAKS_ALIAS).optional(),
    phoneNumber: nomorHpSchema,
    emergencyContact: emergencyContactSchema,
    bankAccount: bankAccountSchema,
  })
  .strict() // Tolak field tambahan yang tidak didefinisikan

/** Tipe input update owner yang valid. */
export type UpdateOwnerInput = z.infer<typeof updateOwnerSchema>

/* ------------------------------------------------------------------ *
 * Create Owner Schema — POST /api/admin/owners
 * ------------------------------------------------------------------ */

/**
 * Schema untuk create owner baru oleh COO (Story 1.8, Req 3).
 * - Field `email` WAJIB (identifier unik owner)
 * - Status akan di-set ke `terverifikasi` oleh service (pre-approved)
 * - Field lain opsional — dapat diisi nanti via edit
 */
export const createOwnerSchema = z
  .object({
    email: z
      .string()
      .email({ message: 'Format email tidak valid' })
      .max(PANJANG_MAKS_EMAIL, { message: `Email terlalu panjang (maks ${PANJANG_MAKS_EMAIL} karakter)` }),
    fullName: z.string().min(1).max(PANJANG_MAKS_NAMA).optional(),
    alias: z.string().min(1).max(PANJANG_MAKS_ALIAS).optional(),
    phoneNumber: nomorHpSchema,
    emergencyContact: emergencyContactSchema,
    bankAccount: bankAccountSchema,
  })
  .strict() // Tolak field tambahan yang tidak didefinisikan

/** Tipe input create owner yang valid. */
export type CreateOwnerInput = z.infer<typeof createOwnerSchema>

/* ------------------------------------------------------------------ *
 * Validation helpers — dipakai API handlers untuk pesan error konsisten.
 * ------------------------------------------------------------------ */

/**
 * Error code untuk validasi owner — dipinkan ke wire envelope.
 */
export const OWNER_VALIDATION_ERRORS = {
  STATUS_CHANGE_FORBIDDEN: 'STATUS_CHANGE_FORBIDDEN',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

export type OwnerValidationError = (typeof OWNER_VALIDATION_ERRORS)[keyof typeof OWNER_VALIDATION_ERRORS]
