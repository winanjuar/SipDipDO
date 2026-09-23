/**
 * MOM — kontrak murni lintas lapis (AD-6): tipe status, bentuk wire, opsi
 * limit paging, dan validator. TANPA I/O, tanpa framework — dipakai bersama
 * `server/domain/pricing/mom.service.ts`, route handler, dan halaman.
 *
 * Status MoM: `draft` | `final` — enum pgEnum di level DB; draft dapat
 * diedit/dihapus, final imutabel (FR-7, Story 2.1).
 */

// =============================================================================
// Supabase Storage Configuration (AR-13, Req-1, Req-2)
// =============================================================================

/**
 * Nama bucket Supabase Storage untuk PDF MoM — PRIVATE bucket.
 * Akses hanya melalui server-generated Signed URLs (AR-13).
 *
 * Bucket dikonfigurasi via `drizzle/storage-bucket.sql`.
 */
export const MOM_PDF_BUCKET = 'mom-pdfs'

/**
 * Batas ukuran file PDF MoM (10MB dalam bytes — Req-1 AC6).
 * Divalidasi di sisi server sebelum upload ke Storage.
 */
export const MOM_PDF_MAX_SIZE_BYTES = 10_485_760 // 10 * 1024 * 1024

/**
 * MIME type yang diizinkan untuk upload PDF MoM (Req-1 AC6).
 * Divalidasi di sisi server sebelum upload ke Storage.
 */
export const MOM_PDF_ALLOWED_MIME_TYPES = ['application/pdf'] as const

/**
 * Durasi Signed URL dalam detik (15 menit — Req-2 AC1).
 * Signed URL kedaluwarsa setelah durasi ini.
 */
export const MOM_PDF_SIGNED_URL_EXPIRY_SECONDS = 900 // 15 * 60

// =============================================================================
// MoM Status & Wire Types
// =============================================================================

/** Status MoM — himpunan tertutup; dipakai pgEnum dan validasi lapis atas. */
export const MOM_STATUSES = ['draft', 'final'] as const
export type MomStatus = (typeof MOM_STATUSES)[number]

/**
 * Opsi ukuran halaman baca MoM: `GET /api/mom?limit=` menerima anggota
 * `MOM_LIMIT_OPSI` saja; di luar itu → 400 envelope. Pola `AUDIT_LIMIT_OPSI`.
 */
// Tabel data opsi ukuran halaman — angka di sini adalah nilai kontrak bernama,
// bukan magic number (pola AUDIT_LIMIT_OPSI audit.ts).
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export const MOM_LIMIT_OPSI = [10, 20, 40] as const

/** Ukuran halaman yang sah, diturunkan dari opsi. */
export type MomLimit = (typeof MOM_LIMIT_OPSI)[number]

/** Ukuran halaman bawaan bila `?limit=` tidak hadir. */
export const MOM_LIMIT_DEFAULT: MomLimit = 10

/** Set pencarian cepat untuk validasi keanggotaan opsi limit saat runtime. */
const MOM_LIMIT_SET: ReadonlySet<number> = new Set(MOM_LIMIT_OPSI)

/** Type guard: apakah `value` anggota opsi ukuran halaman. */
export function isMomLimit(value: number): value is MomLimit {
  return MOM_LIMIT_SET.has(value)
}

/**
 * Bentuk wire MoM untuk lapis tampilan — timestamptz sebagai string ISO
 * (konvensi spine: mode string, bukan Date lokal).
 */
export interface MomWire {
  id: string
  title: string
  /** Tanggal meeting diadakan — WAJIB (FR-7: "MoM tersimpan dengan tanggal"). */
  heldAt: string
  status: MomStatus
  /** Konten teks modus tulis langsung; null bila upload PDF (Story 2.2). */
  contentText: string | null
  /** Path PDF di storage; null untuk modus tulis langsung (Story 2.1). */
  pdfPath: string | null
  /** Waktu finalisasi; null bila masih draft. */
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Input buat MoM baru — tanggal WAJIB (spec AC: tanpa tanggal → 400). */
export interface MomCreateInput {
  title: string
  heldAt: string
  contentText?: string | null
}

/** Input ubah MoM draft — semua field opsional. */
export interface MomUpdateInput {
  title?: string
  heldAt?: string
  contentText?: string | null
}

/** Respons list MoM: `nextPage` null bila habis (pola audit). */
export interface MomDaftar {
  data: MomWire[]
  nextPage: number | null
}
/**
 * Validasi input buat MoM: tanggal wajib ada, title tidak boleh kosong,
 * dan heldAt harus parseable sebagai ISO date.
 * Mengembalikan pesan error atau null bila valid.
 */
export function validateMomCreateInput(input: Partial<MomCreateInput>): string | null {
  if (!input.title || input.title.trim().length === 0) {
    return 'Judul MoM wajib diisi.'
  }
  if (!input.heldAt || input.heldAt.trim().length === 0) {
    return 'Tanggal MoM wajib diisi.'
  }
  // Validasi heldAt parseable sebagai date
  const parsed = new Date(input.heldAt)
  if (Number.isNaN(parsed.getTime())) {
    return 'Tanggal MoM tidak valid.'
  }
  return null
}

/**
 * Validasi input ubah MoM: bila ada field, harus valid.
 * Mengembalikan pesan error atau null bila valid.
 */
export function validateMomUpdateInput(input: Partial<MomUpdateInput>): string | null {
  if (input.title !== undefined && input.title.trim().length === 0) {
    return 'Judul MoM tidak boleh kosong.'
  }
  if (input.heldAt !== undefined) {
    if (input.heldAt.trim().length === 0) {
      return 'Tanggal MoM tidak boleh kosong.'
    }
    // Validasi heldAt parseable sebagai date
    const parsed = new Date(input.heldAt)
    if (Number.isNaN(parsed.getTime())) {
      return 'Tanggal MoM tidak valid.'
    }
  }
  return null
}
