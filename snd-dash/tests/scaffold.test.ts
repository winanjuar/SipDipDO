import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import Decimal from 'decimal.js'

// Scaffold smoke test: confirms the test runner, fast-check, and the pinned
// decimal library all load and operate. Domain logic is implemented in later tasks.
describe('scaffold toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })

  it('loads the pinned decimal library and keeps money as decimal (no float)', () => {
    const sum = new Decimal('0.1').plus('0.2')
    expect(sum.toFixed(2)).toBe('0.30')
  })

  it('runs fast-check property tests', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return new Decimal(a).plus(b).equals(new Decimal(b).plus(a))
      }),
    )
  })
})
