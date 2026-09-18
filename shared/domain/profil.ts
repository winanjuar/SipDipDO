/**
 * PROFIL — kontrak murni kelengkapan Profile pendaftar (Story 1.5, FR-22
 * Lampiran A #1–10; AD-6/AD-10): daftar kunci field, label Indonesia, batas
 * panjang + pola + enum (re-negotiasi owner 2026-09-18: sanitasi input,
 * dropdown Bank/Hubungan, opsi Bank "Lainnya"), serta predikat kelengkapan.
 * TANPA I/O, tanpa framework — SATU sumber untuk handler
 * `server/api/profile`, halaman `/profile-completeness`, indikator langkah
 * (UX-DR16), dan cron harian.
 *
 * Field #3 Gmail TIDAK punya kolom sendiri — selalu `owners.email` = email
 * sesi Google, tidak dapat diedit via form. Field #11 Referal di luar kontrak
 * ini (FR-22: diajukan saat Pembelian Pertama, Epic 3) — body yang membawanya
 * ditolak handler (400).
 */

/**
 * Kunci field Profil yang tersimpan sebagai kolom `owners` — urutan mengikuti
 * Lampiran A #1–10; `bankLain` menempel pada #8 (wajib hanya bila Bank =
 * "Lainnya"). Gmail (#3) absen di sini secara sengaja.
 */
export const FIELD_PROFIL_SIMPAN = [
  'namaLengkap',
  'alias',
  'nomorHp',
  'kontakDarurat',
  'nomorHpKontakDarurat',
  'hubunganDenganOwner',
  'namaBank',
  'bankLain',
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
 * by-label E2E dan teks indikator, jangan diubah tanpa menyelaraskan spec).
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
  bankLain: 'Bank Lainnya',
  pemilikRekening: 'Pemilik Rekening',
  nomorRekening: 'Nomor Rekening',
}

/* ------------------------------------------------------------------ *
 * Batas & enum (re-negotiasi owner 2026-09-18) — konstanta bernama,
 * tanpa magic number di pemanggil.
 * ------------------------------------------------------------------ */

/** Panjang maksimum field nama bebas (Nama Lengkap, Kontak Darurat,
 *  Pemilik Rekening, Bank Lainnya) — dalam KARAKTER hasil sanitasi. */
export const PANJANG_MAKS_NAMA = 25

/** Panjang maksimum Alias. */
export const PANJANG_MAKS_ALIAS = 10

/** Panjang maksimum Nomor Rekening (termasuk tanda "-"). */
export const PANJANG_MAKS_REKENING = 20

/** Jumlah digit minimum Nomor HP (setelah tanda "-" dibuang) — total dengan
 *  awalan 0 menjadi 9 digit. */
export const DIGIT_MIN_HP = 9

/** Jumlah digit maksimum Nomor HP (setelah tanda "-" dibuang). */
export const DIGIT_MAKS_HP = 15

/** Nilai enum #8 "Lainnya" — membuka field wajib `bankLain`. */
export const BANK_LAINNYA = 'Lainnya' as const

/** Daftar bank sah untuk dropdown #8 (keputusan owner 2026-09-18). */
export const DAFTAR_BANK = ['Mandiri', 'BCA', 'BNI', 'Jago', 'BSI', 'BRI', 'Jenius'] as const
export type NamaBank = (typeof DAFTAR_BANK)[number] | typeof BANK_LAINNYA

/** Daftar hubungan sah untuk dropdown #7 (keputusan owner 2026-09-18). */
export const DAFTAR_HUBUNGAN = ['Orang Tua', 'Pasangan', 'Anak', 'Saudara', 'Rekan'] as const
export type HubunganDarurat = (typeof DAFTAR_HUBUNGAN)[number]

/** Karakter sah Nomor HP / Nomor Rekening: digit dan tanda minus saja. */
const POLA_NOMOR = /^[-0-9]+$/

/** Nomor HP valid: mulai '0', total 9–15 digit (tanda "-" diabaikan). */
const POLA_DIGIT_HP = /^0\d{8,14}$/

/** Kontrol karakter non-whitespace (0x00–0x08, 0x0E–0x1F, 0x7F) — dibuang
 *  sanitasi SETELAH run whitespace dirapatkan (tab/newline jadi spasi, bukan
 *  dibuang diam-diam). Karakter kontrol di pola adalah TUJUAN sanitisasi. */
// eslint-disable-next-line no-control-regex
const POLA_KONTROL = /[\u0000-\u0008\u000E-\u001F\u007F]/g

/** Run whitespace berapa pun (spasi/tab/newline) → satu spasi. */
const POLA_SPASI_GANDA = /\s+/g

/* ------------------------------------------------------------------ *
 * Sanitasi + validasi murni.
 * ------------------------------------------------------------------ */

/**
 * Sanitasi teks bebas: buang kontrol karakter, rapatkan spasi berurutan,
 * trim. Murni — dipakai handler PUT sebelum validasi panjang (panjang dihit
 * atas hasil sanitasi, bukan input mentah).
 */
export function sanitasiTeks(nilai: string): string {
  return nilai.replaceAll(POLA_KONTROL, '').replaceAll(POLA_SPASI_GANDA, ' ').trim()
}

/** Nilai Profil yang sah — string APA ADANYA (AD-10: nomor tidak pernah
 *  number); setelah validasi handler, seluruh kunci terisi sanitasi non-kosong
 *  sesuai aturan fieldnya. */
export type ProfilValues = Record<KunciFieldProfil, string>

/**
 * Nilai longgar untuk predikat kelengkapan — kolom repo nullable, body
 * parsial, maupun baris repo uji minimal (field boleh absen).
 */
export type ProfilNilai = Partial<Record<KunciProfil, string | null | undefined>>

/** Kode kesalahan format per field (dipisah dari kelengkapan `sisa`). */
export type KodeKesalahanProfil = 'terlalu-panjang' | 'format-salah' | 'di-luar-daftar'

/** Satu kesalahan format: field + kode (dipin di wire `details.invalidFields`). */
export interface KesalahanFieldProfil {
  field: KunciFieldProfil
  kode: KodeKesalahanProfil
}

/** Hasil `validasiProfil`: nilai bersih, field wajib yang kosong, kesalahan format. */
export interface HasilValidasiProfil {
  bersih: ProfilValues
  /** Field wajib yang masih kosong (untuk envelope PROFILE_INCOMPLETE). */
  sisa: KunciFieldProfil[]
  /** Kesalahan format/enum (untuk envelope PROFILE_INVALID). */
  kesalahan: KesalahanFieldProfil[]
}

/**
 * Sisa field WAJIB yang belum terisi — PERSIS kunci field bernilai trim
 * kosong (absen/null/undefined dianggap kosong). `bankLain` hanya wajib bila
 * Bank = "Lainnya" (bila bukan, dianggap TIDAK wajib — tidak pernah muncul).
 * Gmail praktis tak pernah muncul (email sesi selalu terisi).
 */
export function sisaFieldKosong(nilai: ProfilNilai): KunciFieldProfil[] {
  return FIELD_PROFIL_SIMPAN.filter((kunci) => {
    if (kunci === 'bankLain') {
      return nilai.namaBank === BANK_LAINNYA && (nilai.bankLain ?? '').trim().length === 0
    }
    return (nilai[kunci] ?? '').trim().length === 0
  })
}

/**
 * Profil lengkap = seluruh field WAJIB terisi (termasuk `bankLain` bila Bank
 * = "Lainnya") — prasyarat verifikasi COO (FR-22). Murni; dipakai service,
 * cron, dan principal.
 */
export function profilLengkap(nilai: ProfilNilai): boolean {
  return sisaFieldKosong(nilai).length === 0
}

/**
 * Sanitasi + validasi seluruh field Profil (murni):
 * 1. Semua field disanitasi (`sanitasiTeks`); `bankLain` dinormalisasi kosong
 *    bila Bank bukan "Lainnya" (nilai asingnya diabaikan, bukan error).
 * 2. Kelengkapan via `sisaFieldKosong` (envelope PROFILE_INCOMPLETE).
 * 3. Format/enum HANYA dinilai untuk nilai non-kosong (envelope
 *    PROFILE_INVALID): panjang maksimum nama/alias/rekening, pola & jumlah
 *    digit HP, pola rekening, keanggotaan enum Bank/Hubungan.
 */
export function validasiProfil(nilai: ProfilNilai): HasilValidasiProfil {
  const bersih = Object.fromEntries(
    FIELD_PROFIL_SIMPAN.map((kunci) => [kunci, sanitasiTeks(String(nilai[kunci] ?? ''))]),
  ) as ProfilValues
  if (bersih.namaBank !== BANK_LAINNYA) {
    bersih.bankLain = ''
  }

  const kesalahan: KesalahanFieldProfil[] = []

  const cekPanjang = (field: KunciFieldProfil, maks: number): void => {
    if (bersih[field].length > maks) {
      kesalahan.push({ field, kode: 'terlalu-panjang' })
    }
  }
  const cekNomor = (field: KunciFieldProfil): void => {
    if (!POLA_NOMOR.test(bersih[field])) {
      kesalahan.push({ field, kode: 'format-salah' })
    }
  }

  cekPanjang('namaLengkap', PANJANG_MAKS_NAMA)
  cekPanjang('alias', PANJANG_MAKS_ALIAS)
  cekPanjang('kontakDarurat', PANJANG_MAKS_NAMA)

  const validasiHp = (field: KunciFieldProfil): void => {
    const nilai = bersih[field]
    if (nilai.length === 0) return
    if (!POLA_NOMOR.test(nilai) || !POLA_DIGIT_HP.test(nilai.replaceAll('-', ''))) {
      kesalahan.push({ field, kode: 'format-salah' })
    }
  }
  validasiHp('nomorHp')
  validasiHp('nomorHpKontakDarurat')

  if (bersih.hubunganDenganOwner.length > 0 && !DAFTAR_HUBUNGAN.includes(bersih.hubunganDenganOwner as HubunganDarurat)) {
    kesalahan.push({ field: 'hubunganDenganOwner', kode: 'di-luar-daftar' })
  }
  if (bersih.namaBank.length > 0 && !DAFTAR_BANK.includes(bersih.namaBank as (typeof DAFTAR_BANK)[number]) && bersih.namaBank !== BANK_LAINNYA) {
    kesalahan.push({ field: 'namaBank', kode: 'di-luar-daftar' })
  }
  if (bersih.namaBank === BANK_LAINNYA && bersih.bankLain.length > 0) {
    cekPanjang('bankLain', PANJANG_MAKS_NAMA)
  }

  cekPanjang('pemilikRekening', PANJANG_MAKS_NAMA)
  if (bersih.nomorRekening.length > 0) {
    cekNomor('nomorRekening')
    cekPanjang('nomorRekening', PANJANG_MAKS_REKENING)
  }

  return { bersih, sisa: sisaFieldKosong(bersih), kesalahan }
}
