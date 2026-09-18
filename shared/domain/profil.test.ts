/**
 * Unit — kontrak murni profil (Story 1.5, re-negotiasi owner 2026-09-18):
 * sanitasi teks bebas, batas panjang, pola & jumlah digit HP, pola + panjang
 * rekening, enum Bank (7 + "Lainnya") & Hubungan (5), dan kelengkapan
 * bersyarat `bankLain`. Murni tanpa I/O (AD-6).
 */
import { describe, expect, it } from 'vitest'
import {
  BANK_LAINNYA,
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  profilLengkap,
  sanitasiTeks,
  sisaFieldKosong,
  validasiProfil,
  type ProfilNilai,
} from './profil'

/** Nilai valid lengkap (Bank BCA — bankLain tidak wajib) untuk di-override. */
const nilaiLengkap = (): ProfilNilai => ({
  namaLengkap: 'Budi Santoso',
  alias: 'Budi',
  nomorHp: '0812-3456-7890',
  kontakDarurat: 'Sari Dewi',
  nomorHpKontakDarurat: '0813-9876-5432',
  hubunganDenganOwner: 'Saudara',
  namaBank: 'BCA',
  bankLain: '',
  pemilikRekening: 'Budi Santoso',
  nomorRekening: '123-456-7890',
})

describe('sanitasiTeks', () => {
  it('trim + rapatkan spasi berurutan + buang kontrol karakter', () => {
    expect(sanitasiTeks('  Budi\u0007   Santoso  ')).toBe('Budi Santoso')
    expect(sanitasiTeks('A\t\tB')).toBe('A B')
    expect(sanitasiTeks('Sea\u0000Bank')).toBe('SeaBank')
  })
})

describe('validasiProfil — happy path', () => {
  it('nilai lengkap valid → tanpa sisa, tanpa kesalahan, nilai tersanitasi', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), namaLengkap: '  Budi   Santoso ' })
    expect(hasil.sisa).toEqual([])
    expect(hasil.kesalahan).toEqual([])
    expect(hasil.bersih.namaLengkap).toBe('Budi Santoso')
  })

  it('seluruh anggota DAFTAR_BANK/DAFTAR_HUBUNGAN diterima', () => {
    for (const bank of DAFTAR_BANK) {
      expect(validasiProfil({ ...nilaiLengkap(), namaBank: bank }).kesalahan).toEqual([])
    }
    for (const hubungan of DAFTAR_HUBUNGAN) {
      expect(validasiProfil({ ...nilaiLengkap(), hubunganDenganOwner: hubungan }).kesalahan).toEqual([])
    }
  })

  it('Bank "Lainnya" + bankLain terisi → sah; bankLain ikut tersanitasi', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), namaBank: BANK_LAINNYA, bankLain: '  Sea   Bank  ' })
    expect(hasil.kesalahan).toEqual([])
    expect(hasil.bersih.bankLain).toBe('Sea Bank')
  })

  it('bankLain diabaikan (dinormalisasi kosong) bila Bank bukan "Lainnya"', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), bankLain: 'SeaBank' })
    expect(hasil.bersih.bankLain).toBe('')
    expect(hasil.kesalahan).toEqual([])
  })
})

describe('validasiProfil — panjang maksimum', () => {
  it('nama bebas > 25 karakter → terlalu-panjang (namaLengkap/kontakDarurat/pemilikRekening)', () => {
    const panjang = 'A'.repeat(PANJANG_MAKS_NAMA + 1)
    const hasil = validasiProfil({ ...nilaiLengkap(), namaLengkap: panjang, kontakDarurat: panjang, pemilikRekening: panjang })
    expect(hasil.kesalahan).toEqual([
      { field: 'namaLengkap', kode: 'terlalu-panjang' },
      { field: 'kontakDarurat', kode: 'terlalu-panjang' },
      { field: 'pemilikRekening', kode: 'terlalu-panjang' },
    ])
  })

  it('alias > 10 karakter → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), alias: 'A'.repeat(PANJANG_MAKS_ALIAS + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'alias', kode: 'terlalu-panjang' }])
  })

  it('nomor rekening > 20 karakter (termasuk "-") → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), nomorRekening: '1'.repeat(PANJANG_MAKS_REKENING + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'nomorRekening', kode: 'terlalu-panjang' }])
  })

  it('bankLain > 25 karakter (saat Bank "Lainnya") → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), namaBank: BANK_LAINNYA, bankLain: 'B'.repeat(PANJANG_MAKS_NAMA + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'bankLain', kode: 'terlalu-panjang' }])
  })
})

describe('validasiProfil — pola nomor', () => {
  it('HP bukan digit/"-" → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), nomorHp: '0812-ABCD-90' }).kesalahan)
      .toEqual([{ field: 'nomorHp', kode: 'format-salah' }])
  })

  it('HP tidak diawali 0 → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), nomorHp: '628123456789' }).kesalahan)
      .toEqual([{ field: 'nomorHp', kode: 'format-salah' }])
  })

  it('HP < 9 digit / > 15 digit → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), nomorHp: '0812' }).kesalahan)
      .toEqual([{ field: 'nomorHp', kode: 'format-salah' }])
    expect(validasiProfil({ ...nilaiLengkap(), nomorHpKontakDarurat: '0' + '1'.repeat(15) }).kesalahan)
      .toEqual([{ field: 'nomorHpKontakDarurat', kode: 'format-salah' }])
  })

  it('rekening mengandung selain digit/"-" → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), nomorRekening: '1234 ABC' }).kesalahan)
      .toEqual([{ field: 'nomorRekening', kode: 'format-salah' }])
  })
})

describe('validasiProfil — enum', () => {
  it('bank di luar daftar → di-luar-daftar', () => {
    expect(validasiProfil({ ...nilaiLengkap(), namaBank: 'Bukopin' }).kesalahan)
      .toEqual([{ field: 'namaBank', kode: 'di-luar-daftar' }])
  })

  it('hubungan di luar daftar → di-luar-daftar', () => {
    expect(validasiProfil({ ...nilaiLengkap(), hubunganDenganOwner: 'Teman' }).kesalahan)
      .toEqual([{ field: 'hubunganDenganOwner', kode: 'di-luar-daftar' }])
  })
})

describe('kelengkapan bersyarat bankLain', () => {
  it('Bank "Lainnya" + bankLain kosong → sisa memuat bankLain (profil belum lengkap)', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), namaBank: BANK_LAINNYA, bankLain: '' })
    expect(hasil.sisa).toEqual(['bankLain'])
    expect(profilLengkap(hasil.bersih)).toBe(false)
  })

  it('Bank biasa + bankLain kosong → bankLain TIDAK dihitung sisa', () => {
    expect(sisaFieldKosong(nilaiLengkap())).toEqual([])
    expect(profilLengkap(nilaiLengkap())).toBe(true)
  })
})
