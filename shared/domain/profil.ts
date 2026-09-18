/**
 * PROFIL — kontrak murni kelengkapan Profile pendaftar (Story 1.5, FR-22
 * Lampiran A #1–10; AD-6/AD-10): daftar kunci field, label Indonesia, tipe
 * nilai, dan predikat kelengkapan. TANPA I/O, tanpa framework — SATU sumber
 * untuk zod handler `server/api/profil`, label halaman
 * `/profile-completeness`, indikator langkah (UX-DR16), dan cron harian.
 *
 * Field #3 Gmail TIDAK punya kolom sendiri — selalu `owners.email` = email
 * sesi Google, tidak dapat diedit via form. Field #11 Referal di luar kontrak
 * ini (FR-22: diajukan saat Pembelian Pertama, Epic 3) — body yang membawanya
 * ditolak handler (400).
 */

/**
 * Kunci field Profil yang tersimpan sebagai kolom `owners` (9 field) — urutan
 * mengikuti Lampiran A #1–10. Gmail (#3) absen di sini secara sengaja.
 */
export const FIELD_PROFIL_SIMPAN = [
  'namaLengkap',
  'alias',
  'nomorHp',
  'kontakDarurat',
  'nomorHpKontakDarurat',
  'hubunganDenganOwner',
  'namaBank',
  'pemilikRekening',
  'nomorRekening',
] as const

/** Kunci field Profil yang tersimpan ke kolom DB. */
export type KunciFieldProfil = (typeof FIELD_PROFIL_SIMPAN)[number]

/** Kunci wire field Gmail (#3) — nilainya selalu email sesi, bukan kolom profil. */
export const KUNCI_GMAIL = 'gmail' as const

/** Seluruh kunci kontrak wire Profil (10 field Lampiran A #1–10). */
export type KunciProfil = KunciFieldProfil | typeof KUNCI_GMAIL

/**
 * Label form Indonesia per kunci field — satu sumber label halaman
 * `/profile-completeness` (profile-fields.md; teks label dipakai selector
 * by-label E2E, jangan diubah tanpa menyelaraskan spec).
 */
export const LABEL_FIELD_PROFIL: Record<KunciProfil, string> = {
  namaLengkap: 'Nama Lengkap',
  alias: 'Alias',
  gmail: 'Gmail',
  nomorHp: 'Nomor HP',
  kontakDarurat: 'Kontak Darurat',
  nomorHpKontakDarurat: 'Nomor HP Kontak Darurat',
  hubunganDenganOwner: 'Hubungan dengan Owner',
  namaBank: 'Nama Bank',
  pemilikRekening: 'Pemilik Rekening',
  nomorRekening: 'Nomor Rekening',
}

/**
 * Nilai Profil yang sah — string apa adanya (AD-10: tanpa parsing numerik;
 * nomor HP/rekening tidak pernah number). Setelah validasi handler, seluruh
 * kunci terisi trim non-kosong.
 */
export type ProfilValues = Record<KunciFieldProfil, string>

/**
 * Nilai longgar untuk predikat kelengkapan — kolom repo nullable, body
 * parsial, maupun baris repo uji minimal (field boleh absen).
 */
export type ProfilNilai = Partial<Record<KunciProfil, string | null | undefined>>

/**
 * Sisa field yang belum terisi — PERSIS kunci field bernilai trim kosong
 * (absen/null/undefined dianggap kosong). Urutan mengikuti FIELD_PROFIL_SIMPAN
 * (Lampiran A). Gmail praktis tak pernah muncul (email sesi selalu terisi).
 */
export function sisaFieldKosong(nilai: ProfilNilai): KunciFieldProfil[] {
  return FIELD_PROFIL_SIMPAN.filter((kunci) => (nilai[kunci] ?? '').trim().length === 0)
}

/**
 * Profil lengkap = seluruh field tersimpan non-kosong (trim) — prasyarat
 * verifikasi COO (FR-22). Murni; dipakai service, cron, dan principal.
 */
export function profilLengkap(nilai: ProfilNilai): boolean {
  return sisaFieldKosong(nilai).length === 0
}
