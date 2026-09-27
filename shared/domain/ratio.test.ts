import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { formatRatioAsPercent } from './ratio'

describe('formatRatioAsPercent (AD-10 / Req-16)', () => {
  describe('basic percentage formatting', () => {
    it('formats 0.666667 as "66,67%" (Req-16 contoh)', () => {
      expect(formatRatioAsPercent('0.666667')).toBe('66,67%')
    })

    it('formats 0.5 as "50,00%"', () => {
      expect(formatRatioAsPercent('0.5')).toBe('50,00%')
    })

    it('formats 1 as "100,00%"', () => {
      expect(formatRatioAsPercent('1')).toBe('100,00%')
    })

    it('formats 0 as "0,00%"', () => {
      expect(formatRatioAsPercent('0')).toBe('0,00%')
    })
  })

  describe('half-up rounding at 2 decimal places', () => {
    it('rounds 0.66665 half-up to "66,67%"', () => {
      expect(formatRatioAsPercent('0.66665')).toBe('66,67%')
    })

    it('rounds 0.66664 down to "66,66%"', () => {
      expect(formatRatioAsPercent('0.66664')).toBe('66,66%')
    })

    it('rounds 0.0050 half-up to "0,50%"', () => {
      // Note: "0.005" (dot + exactly 3 digits) is ambiguous in id-ID parsing
      // Use "0.0050" or "0,005" for clarity
      expect(formatRatioAsPercent('0.0050')).toBe('0,50%')
    })

    it('rounds 0.0040 down to "0,40%"', () => {
      expect(formatRatioAsPercent('0.0040')).toBe('0,40%')
    })

    it('accepts id-ID format for small ratios "0,005" -> "0,50%"', () => {
      expect(formatRatioAsPercent('0,005')).toBe('0,50%')
    })

    it('rounds 0.99995 half-up to "100,00%"', () => {
      expect(formatRatioAsPercent('0.99995')).toBe('100,00%')
    })
  })

  describe('accepts Decimal input', () => {
    it('formats Decimal(0.666667) as "66,67%"', () => {
      expect(formatRatioAsPercent(new Decimal('0.666667'))).toBe('66,67%')
    })

    it('formats Decimal(0.5) as "50,00%"', () => {
      expect(formatRatioAsPercent(new Decimal('0.5'))).toBe('50,00%')
    })
  })

  describe('accepts id-ID format input', () => {
    it('formats "0,666667" as "66,67%"', () => {
      expect(formatRatioAsPercent('0,666667')).toBe('66,67%')
    })

    it('formats "0,5" as "50,00%"', () => {
      expect(formatRatioAsPercent('0,5')).toBe('50,00%')
    })
  })

  describe('handles values > 1 (Achievement > 100%)', () => {
    it('formats 1.5 as "150,00%"', () => {
      expect(formatRatioAsPercent('1.5')).toBe('150,00%')
    })

    it('formats 2.333333 as "233,33%"', () => {
      expect(formatRatioAsPercent('2.333333')).toBe('233,33%')
    })
  })

  describe('handles negative values', () => {
    it('formats -0.1 as "-10,00%"', () => {
      expect(formatRatioAsPercent('-0.1')).toBe('-10,00%')
    })
  })

  describe('PRD verification (Req-12: Achievement bisa > 100%)', () => {
    it('verifikasi: 2 saham Modal Bergerak -> Strength 66,67%', () => {
      // From PRD: 2/3 = 0.666667 -> 66,67%
      expect(formatRatioAsPercent('0.666667')).toBe('66,67%')
    })

    it('verifikasi: Fulfillment Rate contoh Req-10 terpakai/batas', () => {
      // terpakai 2.484.000 / batas 2.552.000 ≈ 0.973354
      expect(formatRatioAsPercent('0.973354')).toBe('97,34%')
    })
  })
})
