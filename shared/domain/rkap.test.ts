/**
 * Unit tests for RKAP calculation functions (shared/domain/rkap.ts)
 *
 * Tests calculation functions using data from Req-10:
 * - Total Initial Requirement: 250.000.000 (250 juta)
 * - Current Buy Price: 52.000
 * - Expected Adjustment Limit: 2.552.000 (2.500.000 + 52.000)
 * - Example: terpakai 2.484.000; sisa 68.000
 *
 * **Validates: Requirements 9, 10, 12**
 */
import { describe, expect, it } from 'vitest'
import {
  calculateAdjustmentLimit,
  calculateFulfillmentRate,
  calculateAchievement,
  calculateHeld,
  calculateShortfall,
  calculateQuantityLeft,
  calculateAdjustmentRemaining,
  calculateAdjustmentUsedRatio,
} from './rkap'

// ---------------------------------------------------------------------------
// Test Data from Req-10
// ---------------------------------------------------------------------------

/**
 * Req-10 specifies:
 * - Total Initial Requirement: 250.000.000 (250 juta)
 * - Current Buy Price: 52.000
 * - Batas = 1% × 250.000.000 + 52.000 = 2.500.000 + 52.000 = 2.552.000
 * - Terpakai: 2.484.000
 * - Sisa: 68.000
 */
const REQ10_TOTAL_INITIAL = '250000000.00'
const REQ10_BUY_PRICE = '52000.00'
const REQ10_EXPECTED_LIMIT = '2552000.00'
const REQ10_ADJUSTMENT_USED = '2484000.00'
const REQ10_EXPECTED_REMAINING = '68000.00'

// ---------------------------------------------------------------------------
// calculateAdjustmentLimit (Req-9, Req-10)
// ---------------------------------------------------------------------------

describe('calculateAdjustmentLimit (Req-9, Req-10)', () => {
  /**
   * **Validates: Requirements 9, 10**
   *
   * Formula: Adjustment_Limit = (1% × total Initial_Requirement fase) + harga beli 1 saham berjalan
   */
  describe('Req-10 data: 250jt → batas 2.552.000', () => {
    it('calculates correct limit: 1% of 250.000.000 + 52.000 = 2.552.000', () => {
      const result = calculateAdjustmentLimit(REQ10_TOTAL_INITIAL, REQ10_BUY_PRICE)
      expect(result).toBe(REQ10_EXPECTED_LIMIT)
    })

    it('breakdown: 1% of 250.000.000 = 2.500.000', () => {
      // Verify the 1% calculation step
      const onePercent = '2500000.00' // 1% of 250 million
      const result = calculateAdjustmentLimit(REQ10_TOTAL_INITIAL, REQ10_BUY_PRICE)
      // Result should be onePercent + buyPrice = 2500000 + 52000 = 2552000
      expect(result).toBe('2552000.00')
    })
  })

  describe('edge cases', () => {
    it('returns buy price when total initial is zero', () => {
      const result = calculateAdjustmentLimit('0.00', '52000.00')
      // 1% of 0 + 52000 = 52000
      expect(result).toBe('52000.00')
    })

    it('returns 1% of total when buy price is zero', () => {
      const result = calculateAdjustmentLimit('100000000.00', '0.00')
      // 1% of 100 million + 0 = 1000000
      expect(result).toBe('1000000.00')
    })

    it('handles small total initial requirement', () => {
      // 1% of 1.000.000 = 10.000; + 52.000 = 62.000
      const result = calculateAdjustmentLimit('1000000.00', '52000.00')
      expect(result).toBe('62000.00')
    })

    it('handles large total initial requirement', () => {
      // 1% of 1 billion = 10 million; + 52.000 = 10.052.000
      const result = calculateAdjustmentLimit('1000000000.00', '52000.00')
      expect(result).toBe('10052000.00')
    })

    it('preserves precision with decimal values', () => {
      // 1% of 100000.50 = 1000.005 (rounded to 1000.01); + 52000.00 = 53000.01
      const result = calculateAdjustmentLimit('100000.50', '52000.00')
      expect(result).toBe('53000.01')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateFulfillmentRate (Req-5)
// ---------------------------------------------------------------------------

describe('calculateFulfillmentRate (Req-5)', () => {
  /**
   * **Validates: Requirements 5**
   *
   * Formula: Fulfillment_Rate = Fulfillment ÷ Final_Requirement
   */
  describe('basic calculations', () => {
    it('calculates 50% fulfillment rate', () => {
      const result = calculateFulfillmentRate('100000000.00', '200000000.00')
      expect(result).toBe('0.500000')
    })

    it('calculates 75% fulfillment rate', () => {
      const result = calculateFulfillmentRate('150000000.00', '200000000.00')
      expect(result).toBe('0.750000')
    })

    it('calculates 100% fulfillment rate', () => {
      const result = calculateFulfillmentRate('200000000.00', '200000000.00')
      expect(result).toBe('1.000000')
    })

    it('calculates > 100% fulfillment rate (over-fulfilled)', () => {
      const result = calculateFulfillmentRate('250000000.00', '200000000.00')
      expect(result).toBe('1.250000')
    })
  })

  describe('division by zero handling', () => {
    it('returns "0.000000" when final requirement is zero', () => {
      const result = calculateFulfillmentRate('100000000.00', '0.00')
      expect(result).toBe('0.000000')
    })

    it('returns "0.000000" when both are zero', () => {
      const result = calculateFulfillmentRate('0.00', '0.00')
      expect(result).toBe('0.000000')
    })
  })

  describe('precision', () => {
    it('handles recurring decimals with half-up rounding', () => {
      // 2/3 = 0.666666... → 0.666667 (half-up at 6 decimals)
      const result = calculateFulfillmentRate('200000000.00', '300000000.00')
      expect(result).toBe('0.666667')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateAchievement (Req-12)
// ---------------------------------------------------------------------------

describe('calculateAchievement (Req-12)', () => {
  /**
   * **Validates: Requirements 12**
   *
   * Formula: Achievement = Utilization ÷ Fulfillment (bisa > 100%)
   * IF Fulfillment = 0, return null (ditampilkan sebagai "—")
   */
  describe('basic calculations', () => {
    it('calculates 80% achievement', () => {
      const result = calculateAchievement('80000000.00', '100000000.00')
      expect(result).toBe('0.800000')
    })

    it('calculates 100% achievement', () => {
      const result = calculateAchievement('100000000.00', '100000000.00')
      expect(result).toBe('1.000000')
    })

    it('calculates > 100% achievement (over-utilized)', () => {
      // Req-12 specifies: Achievement bisa > 100%
      const result = calculateAchievement('120000000.00', '100000000.00')
      expect(result).toBe('1.200000')
    })

    it('calculates 150% achievement', () => {
      const result = calculateAchievement('150000000.00', '100000000.00')
      expect(result).toBe('1.500000')
    })
  })

  describe('null case when fulfillment is zero (Req-12)', () => {
    it('returns null when fulfillment is zero', () => {
      // Req-12: IF Fulfillment = 0, ditampilkan sebagai "—" atau 0%
      const result = calculateAchievement('50000000.00', '0.00')
      expect(result).toBeNull()
    })

    it('returns null when both are zero', () => {
      const result = calculateAchievement('0.00', '0.00')
      expect(result).toBeNull()
    })
  })

  describe('precision', () => {
    it('handles recurring decimals with half-up rounding', () => {
      // 2/3 = 0.666666... → 0.666667 (half-up at 6 decimals)
      const result = calculateAchievement('200000000.00', '300000000.00')
      expect(result).toBe('0.666667')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateHeld (Req-12)
// ---------------------------------------------------------------------------

describe('calculateHeld (Req-12)', () => {
  /**
   * **Validates: Requirements 12**
   *
   * Formula: Held = Fulfillment − Utilization (derived, bukan kolom tersimpan)
   */
  describe('basic calculations', () => {
    it('calculates held amount (fulfillment > utilization)', () => {
      // Fulfillment 100jt, Utilization 80jt → Held 20jt
      const result = calculateHeld('100000000.00', '80000000.00')
      expect(result).toBe('20000000.00')
    })

    it('returns zero when fully utilized', () => {
      const result = calculateHeld('100000000.00', '100000000.00')
      expect(result).toBe('0.00')
    })
  })

  describe('negative held (over-utilized)', () => {
    it('returns negative when over-utilized', () => {
      // Fulfillment 80jt, Utilization 100jt → Held -20jt (over-utilized)
      const result = calculateHeld('80000000.00', '100000000.00')
      expect(result).toBe('-20000000.00')
    })
  })

  describe('edge cases', () => {
    it('handles zero fulfillment', () => {
      const result = calculateHeld('0.00', '0.00')
      expect(result).toBe('0.00')
    })

    it('preserves precision with decimal values', () => {
      const result = calculateHeld('100000.50', '80000.25')
      expect(result).toBe('20000.25')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateShortfall (Req-5)
// ---------------------------------------------------------------------------

describe('calculateShortfall (Req-5)', () => {
  /**
   * **Validates: Requirements 5**
   *
   * Formula: Shortfall = Final_Requirement − Fulfillment
   */
  describe('basic calculations', () => {
    it('calculates shortfall (requirement > fulfillment)', () => {
      // Final 200jt, Fulfillment 150jt → Shortfall 50jt
      const result = calculateShortfall('200000000.00', '150000000.00')
      expect(result).toBe('50000000.00')
    })

    it('returns zero when fully fulfilled', () => {
      const result = calculateShortfall('200000000.00', '200000000.00')
      expect(result).toBe('0.00')
    })
  })

  describe('negative shortfall (over-fulfilled)', () => {
    it('returns negative when over-fulfilled', () => {
      // Final 100jt, Fulfillment 120jt → Shortfall -20jt (over-fulfilled)
      const result = calculateShortfall('100000000.00', '120000000.00')
      expect(result).toBe('-20000000.00')
    })
  })

  describe('edge cases', () => {
    it('handles zero final requirement', () => {
      const result = calculateShortfall('0.00', '0.00')
      expect(result).toBe('0.00')
    })

    it('preserves precision with decimal values', () => {
      const result = calculateShortfall('200000.50', '150000.25')
      expect(result).toBe('50000.25')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateQuantityLeft (Req-10)
// ---------------------------------------------------------------------------

describe('calculateQuantityLeft (Req-10)', () => {
  /**
   * **Validates: Requirements 10**
   *
   * Formula: Quantity_Left = floor(Shortfall ÷ currentBuyPrice)
   */
  describe('basic calculations', () => {
    it('calculates quantity left with exact division', () => {
      // Shortfall 5.200.000 / price 52.000 = 100 saham
      const result = calculateQuantityLeft('5200000.00', '52000.00')
      expect(result).toBe(100)
    })

    it('floors result for inexact division', () => {
      // Shortfall 5.250.000 / price 52.000 = 100.96... → 100 saham (floor)
      const result = calculateQuantityLeft('5250000.00', '52000.00')
      expect(result).toBe(100)
    })

    it('returns 0 when shortfall less than price', () => {
      // Shortfall 51.000 / price 52.000 = 0.98... → 0 saham (tidak cukup)
      const result = calculateQuantityLeft('51000.00', '52000.00')
      expect(result).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('returns 0 when shortfall is zero', () => {
      const result = calculateQuantityLeft('0.00', '52000.00')
      expect(result).toBe(0)
    })

    it('returns 0 when shortfall is negative', () => {
      // Negative shortfall means over-fulfilled
      const result = calculateQuantityLeft('-1000000.00', '52000.00')
      expect(result).toBe(0)
    })

    it('returns 0 when buy price is zero', () => {
      // Cannot calculate quantity with zero price
      const result = calculateQuantityLeft('5200000.00', '0.00')
      expect(result).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// calculateAdjustmentRemaining (Req-9, Req-10)
// ---------------------------------------------------------------------------

describe('calculateAdjustmentRemaining (Req-9, Req-10)', () => {
  /**
   * **Validates: Requirements 9, 10**
   *
   * Formula: Adjustment_Remaining = Adjustment_Limit − Adjustment_Used
   *
   * Req-10 example: batas 2.552.000; terpakai 2.484.000; sisa 68.000
   */
  describe('Req-10 data: batas 2.552.000, terpakai 2.484.000 → sisa 68.000', () => {
    it('calculates correct remaining: 2.552.000 - 2.484.000 = 68.000', () => {
      const result = calculateAdjustmentRemaining(REQ10_EXPECTED_LIMIT, REQ10_ADJUSTMENT_USED)
      expect(result).toBe(REQ10_EXPECTED_REMAINING)
    })
  })

  describe('edge cases', () => {
    it('returns full limit when nothing used', () => {
      const result = calculateAdjustmentRemaining('2552000.00', '0.00')
      expect(result).toBe('2552000.00')
    })

    it('returns zero when fully used', () => {
      const result = calculateAdjustmentRemaining('2552000.00', '2552000.00')
      expect(result).toBe('0.00')
    })

    it('returns negative when exceeded', () => {
      // Over limit: used 2.600.000 > limit 2.552.000
      const result = calculateAdjustmentRemaining('2552000.00', '2600000.00')
      expect(result).toBe('-48000.00')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateAdjustmentUsedRatio (Req-10)
// ---------------------------------------------------------------------------

describe('calculateAdjustmentUsedRatio (Req-10)', () => {
  /**
   * **Validates: Requirements 10**
   *
   * Formula: Adjustment_Used_Percent = (Adjustment_Used ÷ Adjustment_Limit)
   *
   * Req-10 example: terpakai 2.484.000 / batas 2.552.000 ≈ 97.34%
   */
  describe('Req-10 data: terpakai/batas ratio', () => {
    it('calculates ratio for Req-10 example: ~97.34%', () => {
      // 2484000 / 2552000 = 0.973354...
      const result = calculateAdjustmentUsedRatio(REQ10_ADJUSTMENT_USED, REQ10_EXPECTED_LIMIT)
      expect(result).toBe('0.973354')
    })
  })

  describe('basic calculations', () => {
    it('calculates 50% usage', () => {
      const result = calculateAdjustmentUsedRatio('1276000.00', '2552000.00')
      expect(result).toBe('0.500000')
    })

    it('calculates 100% usage', () => {
      const result = calculateAdjustmentUsedRatio('2552000.00', '2552000.00')
      expect(result).toBe('1.000000')
    })

    it('calculates > 100% usage (over limit)', () => {
      // Used 2.800.000 / limit 2.552.000 = 1.0971786833... → 1.097179 (half-up at 6 decimals)
      const result = calculateAdjustmentUsedRatio('2800000.00', '2552000.00')
      expect(result).toBe('1.097179')
    })
  })

  describe('edge cases', () => {
    it('returns "0.000000" when limit is zero', () => {
      // Avoid division by zero
      const result = calculateAdjustmentUsedRatio('1000000.00', '0.00')
      expect(result).toBe('0.000000')
    })

    it('returns "0.000000" when both are zero', () => {
      const result = calculateAdjustmentUsedRatio('0.00', '0.00')
      expect(result).toBe('0.000000')
    })

    it('returns "0.000000" when nothing used', () => {
      const result = calculateAdjustmentUsedRatio('0.00', '2552000.00')
      expect(result).toBe('0.000000')
    })
  })
})

// ---------------------------------------------------------------------------
// Integration: Full Req-10 Scenario
// ---------------------------------------------------------------------------

describe('Integration: Full Req-10 Scenario', () => {
  /**
   * **Validates: Requirements 9, 10**
   *
   * Complete test of Req-10 scenario:
   * - Total Initial: 250.000.000
   * - Harga Beli: 52.000
   * - Batas: 2.552.000 (2.500.000 + 52.000)
   * - Terpakai: 2.484.000
   * - Sisa: 68.000
   * - Overshoot: 28.000 dari 861 saham tertampung
   */
  it('complete Req-10 calculation flow', () => {
    // Step 1: Calculate adjustment limit
    const limit = calculateAdjustmentLimit(REQ10_TOTAL_INITIAL, REQ10_BUY_PRICE)
    expect(limit).toBe('2552000.00')

    // Step 2: Calculate remaining after usage
    const remaining = calculateAdjustmentRemaining(limit, REQ10_ADJUSTMENT_USED)
    expect(remaining).toBe('68000.00')

    // Step 3: Calculate usage ratio
    const ratio = calculateAdjustmentUsedRatio(REQ10_ADJUSTMENT_USED, limit)
    expect(ratio).toBe('0.973354') // ~97.34%

    // Step 4: Calculate quantity left from remaining
    const quantityLeft = calculateQuantityLeft(remaining, REQ10_BUY_PRICE)
    expect(quantityLeft).toBe(1) // 68000 / 52000 = 1.3... → 1 saham
  })

  it('verifies Req-10 calculation breakdown', () => {
    // Verify: 1% of 250.000.000 = 2.500.000
    // Plus 52.000 = 2.552.000 (batas)
    const limit = calculateAdjustmentLimit('250000000.00', '52000.00')
    expect(limit).toBe('2552000.00')

    // Verify: 2.552.000 - 2.484.000 = 68.000 (sisa)
    const sisa = calculateAdjustmentRemaining('2552000.00', '2484000.00')
    expect(sisa).toBe('68000.00')
  })
})
