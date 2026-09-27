/**
 * Unit tests for shared/domain/price.ts
 *
 * Tests untuk wire types, validasi input, dan fungsi resolusi harga.
 * Pure function tests — tidak ada I/O atau database.
 *
 * **Validates: Requirements 4** (Price Resolution)
 */
import { describe, expect, it } from 'vitest'
import {
  isPriceLimit,
  isPriceType,
  PRICE_LIMIT_DEFAULT,
  PRICE_LIMIT_OPSI,
  PRICE_TYPES,
  resolvePrice,
  resolvePricePair,
  validatePriceCorrectInput,
  validatePriceCreateInput,
  type PriceWire,
} from './price'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockPrice(overrides: Partial<PriceWire> = {}): PriceWire {
  return {
    id: 'price-1',
    type: 'beli',
    effectiveDate: '2026-01-01',
    amount: '52000.00',
    momId: 'mom-1',
    momTitle: 'MRO Januari 2026',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Constants Tests
// ---------------------------------------------------------------------------

describe('PRICE_TYPES constant', () => {
  it('berisi beli dan jual', () => {
    expect(PRICE_TYPES).toEqual(['beli', 'jual'])
  })
})

describe('PRICE_LIMIT_OPSI constant', () => {
  it('berisi opsi ukuran halaman yang valid', () => {
    expect(PRICE_LIMIT_OPSI).toEqual([10, 20, 40])
  })

  it('PRICE_LIMIT_DEFAULT adalah anggota opsi', () => {
    expect(PRICE_LIMIT_OPSI).toContain(PRICE_LIMIT_DEFAULT)
  })
})

// ---------------------------------------------------------------------------
// Type Guard Tests
// ---------------------------------------------------------------------------

describe('isPriceType type guard', () => {
  it('mengembalikan true untuk tipe yang valid', () => {
    expect(isPriceType('beli')).toBe(true)
    expect(isPriceType('jual')).toBe(true)
  })

  it('mengembalikan false untuk tipe tidak valid', () => {
    expect(isPriceType('buy')).toBe(false)
    expect(isPriceType('sell')).toBe(false)
    expect(isPriceType('')).toBe(false)
    expect(isPriceType('BELI')).toBe(false)
  })
})

describe('isPriceLimit type guard', () => {
  it('mengembalikan true untuk limit yang valid', () => {
    expect(isPriceLimit(10)).toBe(true)
    expect(isPriceLimit(20)).toBe(true)
    expect(isPriceLimit(40)).toBe(true)
  })

  it('mengembalikan false untuk limit tidak valid', () => {
    expect(isPriceLimit(5)).toBe(false)
    expect(isPriceLimit(15)).toBe(false)
    expect(isPriceLimit(100)).toBe(false)
    expect(isPriceLimit(0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Validation Tests
// ---------------------------------------------------------------------------

describe('validatePriceCreateInput', () => {
  it('mengembalikan null untuk input yang valid', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '2026-09-15',
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBeNull()
  })

  it('mengembalikan error untuk type kosong', () => {
    const input = {
      effectiveDate: '2026-09-15',
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Tipe harga wajib diisi (beli atau jual).')
  })

  it('mengembalikan error untuk type tidak valid', () => {
    const input = {
      type: 'buy' as any,
      effectiveDate: '2026-09-15',
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Tipe harga wajib diisi (beli atau jual).')
  })

  it('mengembalikan error untuk effectiveDate kosong', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '',
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Tanggal efektif wajib diisi.')
  })

  it('mengembalikan error untuk effectiveDate tidak valid', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: 'invalid-date',
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Tanggal efektif tidak valid.')
  })

  it('mengembalikan error untuk amount kosong', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '2026-09-15',
      amount: '',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Nilai harga wajib diisi.')
  })

  it('mengembalikan error untuk amount bukan angka', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '2026-09-15',
      amount: 'abc',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBe('Nilai harga harus berupa angka.')
  })

  it('menerima amount format id-ID', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '2026-09-15',
      amount: '52.000,50',
      momId: 'mom-1',
    }
    expect(validatePriceCreateInput(input)).toBeNull()
  })

  it('mengembalikan error untuk momId kosong', () => {
    const input = {
      type: 'beli' as const,
      effectiveDate: '2026-09-15',
      amount: '52000.00',
      momId: '',
    }
    expect(validatePriceCreateInput(input)).toBe('MoM referensi wajib dipilih.')
  })
})

describe('validatePriceCorrectInput', () => {
  it('mengembalikan null untuk input yang valid', () => {
    const input = {
      amount: '52000.00',
      momId: 'mom-1',
    }
    expect(validatePriceCorrectInput(input)).toBeNull()
  })

  it('mengembalikan error untuk amount kosong', () => {
    const input = {
      amount: '',
      momId: 'mom-1',
    }
    expect(validatePriceCorrectInput(input)).toBe('Nilai harga wajib diisi.')
  })

  it('mengembalikan error untuk amount bukan angka', () => {
    const input = {
      amount: 'not-a-number',
      momId: 'mom-1',
    }
    expect(validatePriceCorrectInput(input)).toBe('Nilai harga harus berupa angka.')
  })

  it('mengembalikan error untuk momId kosong', () => {
    const input = {
      amount: '52000.00',
      momId: '',
    }
    expect(validatePriceCorrectInput(input)).toBe('MoM referensi wajib dipilih.')
  })
})

// ---------------------------------------------------------------------------
// resolvePrice Tests (Property 1: Price Resolution Uniqueness)
// ---------------------------------------------------------------------------

/**
 * Property 1: Price Resolution Uniqueness (AD-7)
 *
 * Untuk kombinasi (type, date) manapun, resolvePrice mengembalikan tepat SATU
 * harga — tidak pernah lebih dari satu. Dapat null bila tidak ada harga berlaku.
 *
 * **Validates: Requirements 4**
 */
describe('resolvePrice (Property 1: Price Resolution Uniqueness)', () => {
  describe('basic resolution', () => {
    it('mengembalikan harga dengan effectiveDate <= date', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      // Query untuk tanggal setelah kedua effectiveDate
      const result = resolvePrice(prices, 'beli', '2026-07-15')
      expect(result).not.toBeNull()
      expect(result?.id).toBe('p2')
      expect(result?.amount).toBe('52000.00')
    })

    it('mengembalikan null bila tidak ada harga sebelum date', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-06-01' }),
      ]

      const result = resolvePrice(prices, 'beli', '2026-01-01')
      expect(result).toBeNull()
    })

    it('mengembalikan null untuk daftar harga kosong', () => {
      const result = resolvePrice([], 'beli', '2026-07-15')
      expect(result).toBeNull()
    })
  })

  describe('type filtering', () => {
    it('hanya mengembalikan harga dengan tipe yang sesuai', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
        createMockPrice({ id: 'p2', type: 'jual', effectiveDate: '2026-01-01', amount: '55000.00' }),
        createMockPrice({ id: 'p3', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      // Resolusi harga beli
      const beli = resolvePrice(prices, 'beli', '2026-07-15')
      expect(beli?.id).toBe('p3')
      expect(beli?.type).toBe('beli')

      // Resolusi harga jual
      const jual = resolvePrice(prices, 'jual', '2026-07-15')
      expect(jual?.id).toBe('p2')
      expect(jual?.type).toBe('jual')
    })

    it('mengembalikan null bila tipe tidak ditemukan', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01' }),
      ]

      const result = resolvePrice(prices, 'jual', '2026-07-15')
      expect(result).toBeNull()
    })
  })

  describe('date boundary conditions', () => {
    it('mengembalikan harga dengan effectiveDate = date (inclusive)', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      // Query tepat pada tanggal efektif
      const result = resolvePrice(prices, 'beli', '2026-06-01')
      expect(result?.id).toBe('p1')
    })

    it('mengembalikan harga paling baru untuk multiple effectiveDate <= date', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '48000.00' }),
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-03-01', amount: '50000.00' }),
        createMockPrice({ id: 'p3', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      const result = resolvePrice(prices, 'beli', '2026-07-15')
      expect(result?.id).toBe('p3')
      expect(result?.amount).toBe('52000.00')
    })

    it('mengembalikan harga sebelumnya bila date adalah hari sebelum effectiveDate baru', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      // Query hari sebelum effectiveDate baru
      const result = resolvePrice(prices, 'beli', '2026-05-31')
      expect(result?.id).toBe('p1')
      expect(result?.amount).toBe('50000.00')
    })
  })

  describe('uniqueness guarantee', () => {
    /**
     * **Validates: Requirements 4**
     *
     * THE Price_Resolver SHALL mengembalikan tepat SATU baris per (jenis harga, tanggal X)
     * — tidak pernah null (jika ada data), tidak pernah lebih dari satu.
     */
    it('selalu mengembalikan tepat satu harga (tidak pernah lebih dari satu)', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01' }),
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-03-01' }),
        createMockPrice({ id: 'p3', type: 'beli', effectiveDate: '2026-06-01' }),
        createMockPrice({ id: 'p4', type: 'beli', effectiveDate: '2026-09-01' }),
      ]

      const result = resolvePrice(prices, 'beli', '2026-12-31')
      expect(result).not.toBeNull()
      // Hanya satu hasil, bukan array
      expect(typeof result).toBe('object')
      expect(result?.id).toBe('p4')
    })

    it('mengembalikan hasil deterministik untuk input yang sama', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      ]

      // Multiple calls dengan input yang sama harus menghasilkan output yang sama
      const result1 = resolvePrice(prices, 'beli', '2026-07-15')
      const result2 = resolvePrice(prices, 'beli', '2026-07-15')
      const result3 = resolvePrice(prices, 'beli', '2026-07-15')

      expect(result1?.id).toBe(result2?.id)
      expect(result2?.id).toBe(result3?.id)
      expect(result1?.amount).toBe('52000.00')
    })
  })

  describe('edge cases', () => {
    it('menangani urutan input yang tidak terurut', () => {
      // Input tidak dalam urutan kronologis
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
        createMockPrice({ id: 'p3', type: 'beli', effectiveDate: '2026-03-01', amount: '51000.00' }),
      ]

      const result = resolvePrice(prices, 'beli', '2026-07-15')
      expect(result?.id).toBe('p2')
      expect(result?.effectiveDate).toBe('2026-06-01')
    })

    it('menangani satu harga saja dalam daftar', () => {
      const prices: PriceWire[] = [
        createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
      ]

      const result = resolvePrice(prices, 'beli', '2026-12-31')
      expect(result?.id).toBe('p1')
    })
  })
})

// ---------------------------------------------------------------------------
// resolvePricePair Tests
// ---------------------------------------------------------------------------

describe('resolvePricePair', () => {
  it('mengembalikan sepasang harga beli dan jual', () => {
    const prices: PriceWire[] = [
      createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
      createMockPrice({ id: 'p2', type: 'jual', effectiveDate: '2026-01-01', amount: '55000.00' }),
    ]

    const result = resolvePricePair(prices, '2026-07-15')
    expect(result).not.toBeNull()
    expect(result?.beli.id).toBe('p1')
    expect(result?.beli.type).toBe('beli')
    expect(result?.jual.id).toBe('p2')
    expect(result?.jual.type).toBe('jual')
  })

  it('mengembalikan null bila harga beli tidak tersedia', () => {
    const prices: PriceWire[] = [
      createMockPrice({ id: 'p1', type: 'jual', effectiveDate: '2026-01-01', amount: '55000.00' }),
    ]

    const result = resolvePricePair(prices, '2026-07-15')
    expect(result).toBeNull()
  })

  it('mengembalikan null bila harga jual tidak tersedia', () => {
    const prices: PriceWire[] = [
      createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '50000.00' }),
    ]

    const result = resolvePricePair(prices, '2026-07-15')
    expect(result).toBeNull()
  })

  it('mengembalikan null untuk daftar kosong', () => {
    const result = resolvePricePair([], '2026-07-15')
    expect(result).toBeNull()
  })

  it('memilih harga terbaru untuk masing-masing tipe', () => {
    const prices: PriceWire[] = [
      createMockPrice({ id: 'p1', type: 'beli', effectiveDate: '2026-01-01', amount: '48000.00' }),
      createMockPrice({ id: 'p2', type: 'beli', effectiveDate: '2026-06-01', amount: '52000.00' }),
      createMockPrice({ id: 'p3', type: 'jual', effectiveDate: '2026-01-01', amount: '53000.00' }),
      createMockPrice({ id: 'p4', type: 'jual', effectiveDate: '2026-06-01', amount: '57000.00' }),
    ]

    const result = resolvePricePair(prices, '2026-07-15')
    expect(result).not.toBeNull()
    expect(result?.beli.id).toBe('p2')
    expect(result?.beli.amount).toBe('52000.00')
    expect(result?.jual.id).toBe('p4')
    expect(result?.jual.amount).toBe('57000.00')
  })
})
