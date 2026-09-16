import { describe, expect, it } from 'vitest'
import {
  asRatio,
  asRupiah,
  MoneyParseError,
  parseRatio,
  parseRupiah,
  serializeRatio,
  serializeRatioPercent,
  serializeRupiah,
} from './money'

describe('parseRupiah (AD-10 — kontrak kawit skala 2)', () => {
  it('contoh spec: "52.000,50" -> { scale: 2, value: "52000.50" } tanpa Number()', () => {
    expect(parseRupiah('52.000,50')).toEqual({ scale: 2, value: '52000.50' })
  })

  it('menerima bentuk kanonik kawit dan mengkoersi skala half-up', () => {
    expect(parseRupiah('52000.5').value).toBe('52000.50')
    expect(parseRupiah('0,005').value).toBe('0.01') // half-up, bukan banker's
    expect(parseRupiah('0,004').value).toBe('0.00')
    expect(parseRupiah('0.005').value).toBe('5.00') // titik+3 digit = ribuan id-ID (presedensi terdokumentasi)
  })

  it('menerima bentuk id-ID tanpa desimal', () => {
    expect(parseRupiah('3.622.000').value).toBe('3622000.00')
  })

  it('mendukung nilai negatif', () => {
    expect(parseRupiah('-1.250,75').value).toBe('-1250.75')
  })

  it('presisi integer-aman pada batas numeric(18,2) — bukti tanpa float', () => {
    // numeric(18,2) maks: 16 digit integer + 2 desimal — float 64-bit akan
    // kehilangan presisi terakhir.
    expect(parseRupiah('9.999.999.999.999.999,99').value).toBe('9999999999999999.99')
    expect(parseRupiah('9999999999999999.99').value).toBe('9999999999999999.99')
  })

  it('menolak magnitudo melampaui kapasitas kolom numeric(18,2)', () => {
    expect(() => parseRupiah('10.000.000.000.000.000')).toThrow(MoneyParseError)
    expect(() => parseRupiah('10000000000000000')).toThrow(MoneyParseError)
    expect(() => parseRupiah('-10.000.000.000.000.000,00')).toThrow(MoneyParseError)
  })

  it('menolak input yang tidak sah dengan MoneyParseError', () => {
    expect(() => parseRupiah('abc')).toThrow(MoneyParseError)
    expect(() => parseRupiah('1,2,3')).toThrow(MoneyParseError)
    expect(() => parseRupiah('')).toThrow(MoneyParseError)
    expect(() => parseRupiah('52,000.50')).toThrow(MoneyParseError) // format US — bukan id-ID/kanonik
  })
})

describe('serializeRupiah (penyajian id-ID)', () => {
  it('contoh spec: serializeRupiah(parseRupiah("52.000,50")) -> "52.000,50"', () => {
    expect(serializeRupiah(parseRupiah('52.000,50'))).toBe('52.000,50')
  })

  it('round-trip pada berbagai magnitudo', () => {
    for (const display of ['0,01', '1.000', '52.000,50', '-1.250,75', '9.999.999.999.999.999,99']) {
      expect(serializeRupiah(parseRupiah(display))).toBe(display)
    }
    // Bentuk tanpa pemisah ribuan dinormalisasi ke tampilan bergrup.
    expect(serializeRupiah(parseRupiah('-1250,75'))).toBe('-1.250,75')
  })

  it('membentuk kanonik input kawit ke tampilan id-ID', () => {
    expect(serializeRupiah({ scale: 2, value: asRupiah('3622000.00') })).toBe('3.622.000')
    expect(serializeRupiah({ scale: 2, value: asRupiah('3622000.50') })).toBe('3.622.000,50')
  })
})

describe('parseRatio / serializeRatio (AD-10 — kontrak kawit skala 6)', () => {
  it('koersi skala half-up pada 6 desimal', () => {
    expect(parseRatio('0,6666665')).toEqual({ scale: 6, value: '0.666667' })
    expect(parseRatio('0.6666664').value).toBe('0.666666')
  })

  it('round-trip id-ID <-> kanonik', () => {
    expect(serializeRatio(parseRatio('0,666667'))).toBe('0,666667')
    expect(serializeRatio({ scale: 6, value: asRatio('0.666667') })).toBe('0,666667')
  })

  it('persentase dibulatkan half-up 2 desimal HANYA saat penyajian', () => {
    expect(serializeRatioPercent(parseRatio('0,666667'))).toBe('66,67%')
    expect(serializeRatioPercent(parseRatio('0,665'))).toBe('66,50%')
    expect(serializeRatioPercent({ scale: 6, value: asRatio('0.500000') })).toBe('50,00%')
  })

  it('verifikasi PRD (spine Testing): 2 saham Modal Bergerak -> Strength 66,67%', () => {
    expect(serializeRatioPercent(parseRatio('0.666667'))).toBe('66,67%')
  })

  it('menolak ratio tidak sah', () => {
    expect(() => parseRatio('abc%')).toThrow(MoneyParseError)
  })

  it('menolak magnitudo melampaui kapasitas kolom numeric(9,6)', () => {
    expect(parseRatio('999,999999').value).toBe('999.999999') // tepat di batas
    expect(() => parseRatio('1000')).toThrow(MoneyParseError)
    expect(() => parseRatio('-1.000,000001')).toThrow(MoneyParseError)
  })
})
