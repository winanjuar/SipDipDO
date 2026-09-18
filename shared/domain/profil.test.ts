/**
 * Unit — kontrak murni profil (Story 1.5, normalisasi owner 2026-09-18):
 * sanitasi teks bebas, batas panjang, pola & jumlah digit HP, pola + panjang
 * rekening, enum Bank (7 + "Lainnya") & Hubungan (5), kelengkapan bersyarat
 * `otherBankName`, dan derivation bank tunggal (wire ↔ storage — tanpa kolom
 * other-bank di DB). Murni tanpa I/O (AD-6).
 */
import { describe, expect, it } from 'vitest'
import {
  BANK_LAINNYA,
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  namaBankKeTersimpan,
  namaBankKeWire,
  profilLengkap,
  sanitasiTeks,
  sisaFieldKosong,
  validasiProfil,
  type ProfilNilai,
} from './profil'

/** Nilai valid lengkap (Bank BCA — otherBankName tidak wajib) untuk di-override. */
const nilaiLengkap = (): ProfilNilai => ({
  fullName: 'Budi Santoso',
  alias: 'Budi',
  phoneNumber: '0812-3456-7890',
  emergencyContactName: 'Sari Dewi',
  emergencyContactPhoneNumber: '0813-9876-5432',
  emergencyContactRelationship: 'Saudara',
  bankName: 'BCA',
  otherBankName: '',
  accountHolderName: 'Budi Santoso',
  accountNumber: '123-456-7890',
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
    const hasil = validasiProfil({ ...nilaiLengkap(), fullName: '  Budi   Santoso ' })
    expect(hasil.sisa).toEqual([])
    expect(hasil.kesalahan).toEqual([])
    expect(hasil.bersih.fullName).toBe('Budi Santoso')
  })

  it('seluruh anggota DAFTAR_BANK/DAFTAR_HUBUNGAN diterima', () => {
    for (const bank of DAFTAR_BANK) {
      expect(validasiProfil({ ...nilaiLengkap(), bankName: bank }).kesalahan).toEqual([])
    }
    for (const hubungan of DAFTAR_HUBUNGAN) {
      expect(validasiProfil({ ...nilaiLengkap(), emergencyContactRelationship: hubungan }).kesalahan).toEqual([])
    }
  })

  it('Bank "Lainnya" + otherBankName terisi → sah; otherBankName ikut tersanitasi', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), bankName: BANK_LAINNYA, otherBankName: '  Sea   Bank  ' })
    expect(hasil.kesalahan).toEqual([])
    expect(hasil.bersih.otherBankName).toBe('Sea Bank')
  })

  it('otherBankName diabaikan (dinormalisasi kosong) bila Bank bukan "Lainnya"', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), otherBankName: 'SeaBank' })
    expect(hasil.bersih.otherBankName).toBe('')
    expect(hasil.kesalahan).toEqual([])
  })
})

describe('validasiProfil — panjang maksimum', () => {
  it('nama bebas > 25 karakter → terlalu-panjang (fullName/emergencyContactName/accountHolderName)', () => {
    const panjang = 'A'.repeat(PANJANG_MAKS_NAMA + 1)
    const hasil = validasiProfil({ ...nilaiLengkap(), fullName: panjang, emergencyContactName: panjang, accountHolderName: panjang })
    expect(hasil.kesalahan).toEqual([
      { field: 'fullName', kode: 'terlalu-panjang' },
      { field: 'emergencyContactName', kode: 'terlalu-panjang' },
      { field: 'accountHolderName', kode: 'terlalu-panjang' },
    ])
  })

  it('alias > 10 karakter → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), alias: 'A'.repeat(PANJANG_MAKS_ALIAS + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'alias', kode: 'terlalu-panjang' }])
  })

  it('nomor rekening > 20 karakter (termasuk "-") → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), accountNumber: '1'.repeat(PANJANG_MAKS_REKENING + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'accountNumber', kode: 'terlalu-panjang' }])
  })

  it('otherBankName > 25 karakter (saat Bank "Lainnya") → terlalu-panjang', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), bankName: BANK_LAINNYA, otherBankName: 'B'.repeat(PANJANG_MAKS_NAMA + 1) })
    expect(hasil.kesalahan).toEqual([{ field: 'otherBankName', kode: 'terlalu-panjang' }])
  })
})

describe('validasiProfil — pola nomor', () => {
  it('HP bukan digit/"-" → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), phoneNumber: '0812-ABCD-90' }).kesalahan)
      .toEqual([{ field: 'phoneNumber', kode: 'format-salah' }])
  })

  it('HP tidak diawali 0 → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), phoneNumber: '628123456789' }).kesalahan)
      .toEqual([{ field: 'phoneNumber', kode: 'format-salah' }])
  })

  it('HP < 9 digit / > 15 digit → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), phoneNumber: '0812' }).kesalahan)
      .toEqual([{ field: 'phoneNumber', kode: 'format-salah' }])
    expect(validasiProfil({ ...nilaiLengkap(), emergencyContactPhoneNumber: '0' + '1'.repeat(15) }).kesalahan)
      .toEqual([{ field: 'emergencyContactPhoneNumber', kode: 'format-salah' }])
  })

  it('rekening mengandung selain digit/"-" → format-salah', () => {
    expect(validasiProfil({ ...nilaiLengkap(), accountNumber: '1234 ABC' }).kesalahan)
      .toEqual([{ field: 'accountNumber', kode: 'format-salah' }])
  })
})

describe('validasiProfil — enum', () => {
  it('bank di luar daftar → di-luar-daftar', () => {
    expect(validasiProfil({ ...nilaiLengkap(), bankName: 'Bukopin' }).kesalahan)
      .toEqual([{ field: 'bankName', kode: 'di-luar-daftar' }])
  })

  it('hubungan di luar daftar → di-luar-daftar', () => {
    expect(validasiProfil({ ...nilaiLengkap(), emergencyContactRelationship: 'Teman' }).kesalahan)
      .toEqual([{ field: 'emergencyContactRelationship', kode: 'di-luar-daftar' }])
  })
})

describe('kelengkapan bersyarat otherBankName', () => {
  it('Bank "Lainnya" + otherBankName kosong → sisa memuat otherBankName (profil belum lengkap)', () => {
    const hasil = validasiProfil({ ...nilaiLengkap(), bankName: BANK_LAINNYA, otherBankName: '' })
    expect(hasil.sisa).toEqual(['otherBankName'])
    expect(profilLengkap(hasil.bersih)).toBe(false)
  })

  it('Bank biasa + otherBankName kosong → otherBankName TIDAK dihitung sisa', () => {
    expect(sisaFieldKosong(nilaiLengkap())).toEqual([])
    expect(profilLengkap(nilaiLengkap())).toBe(true)
  })
})

describe('derivation bank tunggal (namaBankKeTersimpan / namaBankKeWire)', () => {
  it('combobox bank enum → tersimpan apa adanya; wire balik ke enum dengan otherBankName kosong', () => {
    const tersimpan = namaBankKeTersimpan('BCA', '')
    expect(tersimpan).toBe('BCA')
    expect(namaBankKeWire(tersimpan)).toEqual({ bankName: 'BCA', otherBankName: '' })
  })

  it('"Lainnya" + otherBankName → tersimpan teks bebas; wire balik Lainnya + teks', () => {
    const tersimpan = namaBankKeTersimpan(BANK_LAINNYA, 'Sea Bank')
    expect(tersimpan).toBe('Sea Bank')
    expect(namaBankKeWire(tersimpan)).toEqual({ bankName: BANK_LAINNYA, otherBankName: 'Sea Bank' })
  })

  it('teks bebas persis nama bank enum ("BCA") → wire balik sebagai enum (setara semantik)', () => {
    const tersimpan = namaBankKeTersimpan(BANK_LAINNYA, 'BCA')
    expect(tersimpan).toBe('BCA')
    expect(namaBankKeWire(tersimpan)).toEqual({ bankName: 'BCA', otherBankName: '' })
  })

  it('kosong → tersimpan kosong; wire balik kosong dua-duanya (bukan "Lainnya")', () => {
    expect(namaBankKeTersimpan('', '')).toBe('')
    expect(namaBankKeWire('')).toEqual({ bankName: '', otherBankName: '' })
  })
})
