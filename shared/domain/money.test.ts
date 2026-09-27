import { describe, expect, it } from 'vitest'
import {
  abs,
  add,
  asRatio,
  asRupiah,
  compare,
  decimal,
  divide,
  isEqual,
  isGreaterThan,
  isGreaterThanOrEqual,
  isLessThan,
  isLessThanOrEqual,
  isNegative,
  isPositive,
  isZero,
  MoneyParseError,
  multiply,
  parseDecimal,
  parseRatio,
  parseRupiah,
  serializeDecimal,
  serializeRatio,
  serializeRatioPercent,
  serializeRupiah,
  subtract,
  sum,
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


describe('parseDecimal / serializeDecimal (generic decimal handling)', () => {
  it('parseDecimal menerima bentuk id-ID', () => {
    const d = parseDecimal('52.000,50')
    expect(d.toString()).toBe('52000.5')
  })

  it('parseDecimal menerima bentuk kanonik', () => {
    const d = parseDecimal('52000.50')
    expect(d.toString()).toBe('52000.5')
  })

  it('serializeDecimal dengan skala 2 (rupiah)', () => {
    const d = parseDecimal('52000.5')
    expect(serializeDecimal(d, 2)).toBe('52000.50')
  })

  it('serializeDecimal dengan skala 6 (ratio)', () => {
    const d = parseDecimal('0.666667')
    expect(serializeDecimal(d, 6)).toBe('0.666667')
  })

  it('serializeDecimal dengan pembulatan half-up', () => {
    const d = parseDecimal('0.6666665')
    expect(serializeDecimal(d, 6)).toBe('0.666667')
    expect(serializeDecimal(parseDecimal('0.6666664'), 6)).toBe('0.666666')
  })

  it('round-trip property: parseDecimal -> serializeDecimal = original', () => {
    const testCases = ['52000.50', '0.666667', '1000.00', '999.999999']
    for (const original of testCases) {
      const scale = original.split('.')[1]?.length ?? 0
      const d = parseDecimal(original)
      expect(serializeDecimal(d, scale)).toBe(original)
    }
  })

  it('menolak input tidak sah', () => {
    expect(() => parseDecimal('abc')).toThrow(MoneyParseError)
    expect(() => parseDecimal('')).toThrow(MoneyParseError)
  })
})

describe('Arithmetic helpers (AD-6, AD-10)', () => {
  describe('add', () => {
    it('menjumlahkan dua string desimal', () => {
      const result = add('100.00', '50.25')
      expect(serializeDecimal(result, 2)).toBe('150.25')
    })

    it('menjumlahkan string dengan Decimal', () => {
      const d = parseDecimal('100.00')
      const result = add(d, '50.25')
      expect(serializeDecimal(result, 2)).toBe('150.25')
    })

    it('menjumlahkan nilai negatif', () => {
      const result = add('100.00', '-50.25')
      expect(serializeDecimal(result, 2)).toBe('49.75')
    })

    it('presisi terjaga tanpa float error', () => {
      // Classic float error: 0.1 + 0.2 !== 0.3 in JS
      const result = add('0.1', '0.2')
      expect(serializeDecimal(result, 1)).toBe('0.3')
    })
  })

  describe('subtract', () => {
    it('mengurangi b dari a', () => {
      const result = subtract('100.00', '50.25')
      expect(serializeDecimal(result, 2)).toBe('49.75')
    })

    it('hasil negatif', () => {
      const result = subtract('50.25', '100.00')
      expect(serializeDecimal(result, 2)).toBe('-49.75')
    })
  })

  describe('multiply', () => {
    it('mengalikan dua nilai', () => {
      const result = multiply('100.00', '1.5')
      expect(serializeDecimal(result, 2)).toBe('150.00')
    })

    it('perkalian dengan nilai kecil', () => {
      const result = multiply('1000000', '0.000001')
      expect(serializeDecimal(result, 6)).toBe('1.000000')
    })
  })

  describe('divide', () => {
    it('membagi a dengan b', () => {
      const result = divide('100.00', '4')
      expect(serializeDecimal(result, 2)).toBe('25.00')
    })

    it('pembagian menghasilkan desimal', () => {
      const result = divide('100.00', '3')
      expect(serializeDecimal(result, 6)).toBe('33.333333')
    })

    it('throw error saat pembagian dengan nol', () => {
      expect(() => divide('100.00', '0')).toThrow('Division by zero')
    })
  })

  describe('comparison helpers', () => {
    it('compare mengembalikan -1, 0, atau 1', () => {
      expect(compare('100', '200')).toBe(-1)
      expect(compare('200', '200')).toBe(0)
      expect(compare('300', '200')).toBe(1)
    })

    it('isGreaterThan', () => {
      expect(isGreaterThan('100', '50')).toBe(true)
      expect(isGreaterThan('50', '100')).toBe(false)
      expect(isGreaterThan('100', '100')).toBe(false)
    })

    it('isGreaterThanOrEqual', () => {
      expect(isGreaterThanOrEqual('100', '50')).toBe(true)
      expect(isGreaterThanOrEqual('100', '100')).toBe(true)
      expect(isGreaterThanOrEqual('50', '100')).toBe(false)
    })

    it('isLessThan', () => {
      expect(isLessThan('50', '100')).toBe(true)
      expect(isLessThan('100', '50')).toBe(false)
      expect(isLessThan('100', '100')).toBe(false)
    })

    it('isLessThanOrEqual', () => {
      expect(isLessThanOrEqual('50', '100')).toBe(true)
      expect(isLessThanOrEqual('100', '100')).toBe(true)
      expect(isLessThanOrEqual('100', '50')).toBe(false)
    })

    it('isEqual', () => {
      expect(isEqual('100', '100')).toBe(true)
      expect(isEqual('100.00', '100')).toBe(true)
      expect(isEqual('100', '200')).toBe(false)
    })
  })

  describe('value check helpers', () => {
    it('isZero', () => {
      expect(isZero('0')).toBe(true)
      expect(isZero('0.00')).toBe(true)
      expect(isZero('0.001')).toBe(false)
    })

    it('isPositive', () => {
      expect(isPositive('100')).toBe(true)
      expect(isPositive('0')).toBe(false)
      expect(isPositive('-100')).toBe(false)
    })

    it('isNegative', () => {
      expect(isNegative('-100')).toBe(true)
      expect(isNegative('0')).toBe(false)
      expect(isNegative('100')).toBe(false)
    })

    it('abs mengembalikan nilai absolut', () => {
      expect(serializeDecimal(abs('-100'), 0)).toBe('100')
      expect(serializeDecimal(abs('100'), 0)).toBe('100')
    })
  })

  describe('sum', () => {
    it('menjumlahkan array nilai', () => {
      const result = sum(['100.00', '50.25', '25.75'])
      expect(serializeDecimal(result, 2)).toBe('176.00')
    })

    it('mengembalikan 0 untuk array kosong', () => {
      const result = sum([])
      expect(serializeDecimal(result, 2)).toBe('0.00')
    })
  })

  describe('decimal constructor', () => {
    it('decimal() sama dengan parseDecimal()', () => {
      const d1 = decimal('52000.50')
      const d2 = parseDecimal('52000.50')
      expect(d1.equals(d2)).toBe(true)
    })
  })
})

/**
 * Round-trip property tests for decimal handling (Property 2 from Design)
 *
 * **Validates: Requirements 15, 16**
 *
 * Property 2: Any decimal value that passes through parse → serialize must equal the original value.
 * ```
 * ∀ value: string where isValidDecimal(value):
 *   serializeDecimal(parseDecimal(value), scale) === value
 * ```
 */
describe('Round-trip property tests (Req-15, Req-16)', () => {
  describe('Req-15: Rupiah round-trip (scale 2)', () => {
    /**
     * **Validates: Requirements 15**
     *
     * FOR ALL nilai harga yang di-serialize lalu di-parse, THE System SHALL
     * menghasilkan nilai yang identik dengan aslinya (round-trip property)
     */
    it('zero values preserve identity', () => {
      const testCases = ['0.00']
      for (const value of testCases) {
        const parsed = parseRupiah(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
        expect(serialized).toBe(value)
      }
    })

    it('small values preserve identity', () => {
      // Smallest representable rupiah values (scale 2)
      const testCases = ['0.01', '0.10', '1.00', '10.00', '100.00']
      for (const value of testCases) {
        const parsed = parseRupiah(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
        expect(serialized).toBe(value)
      }
    })

    it('typical business values preserve identity', () => {
      // Realistic price values used in the application
      const testCases = ['52000.00', '52000.50', '3622000.00', '250000000.00']
      for (const value of testCases) {
        const parsed = parseRupiah(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
        expect(serialized).toBe(value)
      }
    })

    it('large values preserve identity', () => {
      // Large values approaching database capacity
      const testCases = ['1000000000.00', '999999999999.99', '9999999999999.99']
      for (const value of testCases) {
        const parsed = parseRupiah(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
        expect(serialized).toBe(value)
      }
    })

    it('max capacity values preserve identity (numeric(18,2) limit)', () => {
      // Maximum value for numeric(18,2): 16 integer digits + 2 decimal
      const maxValue = '9999999999999999.99'
      const parsed = parseRupiah(maxValue)
      const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
      expect(serialized).toBe(maxValue)
    })

    it('negative values preserve identity', () => {
      const testCases = ['-0.01', '-52000.50', '-1000000.00', '-9999999999999999.99']
      for (const value of testCases) {
        const parsed = parseRupiah(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 2)
        expect(serialized).toBe(value)
      }
    })
  })

  describe('Req-16: Ratio round-trip (scale 6)', () => {
    /**
     * **Validates: Requirements 16**
     *
     * FOR ALL nilai ratio yang di-serialize lalu di-parse, THE System SHALL
     * menghasilkan nilai yang identik dengan aslinya (round-trip property)
     */
    it('zero values preserve identity', () => {
      const testCases = ['0.000000']
      for (const value of testCases) {
        const parsed = parseRatio(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
        expect(serialized).toBe(value)
      }
    })

    it('small values preserve identity', () => {
      // Smallest representable ratio values (scale 6)
      const testCases = ['0.000001', '0.000010', '0.000100', '0.001000', '0.010000', '0.100000']
      for (const value of testCases) {
        const parsed = parseRatio(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
        expect(serialized).toBe(value)
      }
    })

    it('typical percentage values preserve identity', () => {
      // Common ratio values (Achievement, Fulfillment Rate)
      const testCases = ['0.500000', '0.666667', '0.750000', '1.000000', '1.500000']
      for (const value of testCases) {
        const parsed = parseRatio(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
        expect(serialized).toBe(value)
      }
    })

    it('large values preserve identity', () => {
      // Large ratio values (Achievement can exceed 100%)
      const testCases = ['10.000000', '100.000000', '500.000000']
      for (const value of testCases) {
        const parsed = parseRatio(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
        expect(serialized).toBe(value)
      }
    })

    it('max capacity values preserve identity (numeric(9,6) limit)', () => {
      // Maximum value for numeric(9,6): 3 integer digits + 6 decimal
      const maxValue = '999.999999'
      const parsed = parseRatio(maxValue)
      const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
      expect(serialized).toBe(maxValue)
    })

    it('negative values preserve identity', () => {
      const testCases = ['-0.000001', '-0.500000', '-1.000000', '-999.999999']
      for (const value of testCases) {
        const parsed = parseRatio(value)
        const serialized = serializeDecimal(parseDecimal(parsed.value), 6)
        expect(serialized).toBe(value)
      }
    })
  })

  describe('Generic parseDecimal → serializeDecimal round-trip', () => {
    /**
     * **Validates: Requirements 15, 16**
     *
     * Property 2: For any valid decimal string value:
     * serializeDecimal(parseDecimal(value), scale) === value
     */
    it('preserves identity for scale 2 (Rupiah)', () => {
      const testCases = [
        '0.00', // zero
        '0.01', // smallest
        '52000.50', // typical
        '9999999999999999.99', // max capacity
      ]
      for (const original of testCases) {
        const d = parseDecimal(original)
        expect(serializeDecimal(d, 2)).toBe(original)
      }
    })

    it('preserves identity for scale 6 (Ratio)', () => {
      const testCases = [
        '0.000000', // zero
        '0.000001', // smallest
        '0.666667', // typical
        '999.999999', // max capacity
      ]
      for (const original of testCases) {
        const d = parseDecimal(original)
        expect(serializeDecimal(d, 6)).toBe(original)
      }
    })

    it('scale determines output precision', () => {
      // Demonstrate that scale parameter controls decimal places
      const d = parseDecimal('123.456789')
      expect(serializeDecimal(d, 2)).toBe('123.46') // rounded half-up
      expect(serializeDecimal(d, 6)).toBe('123.456789')
    })
  })
})
