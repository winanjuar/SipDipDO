// app/composables/useSharedDomain.test.ts
//
// Unit test composable useSharedDomain (task 19.1). Fokus: composable HANYA
// mengekspor ulang rumus `#shared/domain` (jalur kode sama dengan server, AD-6)
// dan helper display persen half-up 2 desimal (§1.1/§1.2).

import { describe, it, expect } from 'vitest'
import { useSharedDomain, displayStrengthPercent } from './useSharedDomain'
import { evalStrengthGate } from '#shared/domain/gates'
import { strength, rtl } from '#shared/domain/weighting'

describe('useSharedDomain', () => {
  it('mengekspor referensi fungsi shared/domain yang IDENTIK (AD-6)', () => {
    const d = useSharedDomain()
    // Referensi harus objek yang sama dengan yang dipakai server (bukan salinan).
    expect(d.evalStrengthGate).toBe(evalStrengthGate)
    expect(d.strength).toBe(strength)
    expect(d.rtl).toBe(rtl)
  })

  it('displayStrengthPercent: fraksi → persen half-up 2 desimal (§1.1)', () => {
    // 2 saham Modal Bergerak → Strength 66,67% (Requirements 1.14).
    const s = strength(4, 6) // '0.666667'
    expect(displayStrengthPercent(s)).toBe('66.67')
  })

  it('displayStrengthPercent: pembulatan half-up (≥5 ke atas)', () => {
    expect(displayStrengthPercent('0.12345')).toBe('12.35') // 12.345 → 12.35
    expect(displayStrengthPercent('1')).toBe('100.00') // batas 100%
    expect(displayStrengthPercent('0')).toBe('0.00')
  })

  it('proyeksi gerbang lewat composable == pemanggilan langsung (jalur sama)', () => {
    const input = {
      posisiTerkini: { totalShares: 0, totalCeil: 0 },
      pesananPendingKanonik: [],
      calon: { capitalType: 'Modal Bergerak' as const, quantity: 2 },
    }
    const viaComposable = useSharedDomain().evalStrengthGate(input)
    const direct = evalStrengthGate(input)
    expect(viaComposable).toEqual(direct)
    // 2 Modal Bergerak → Shares 4, Ceil 6, Strength 0.666667 (§1.14).
    expect(viaComposable.proyeksiShares).toBe(4)
    expect(viaComposable.proyeksiCeil).toBe(6)
    expect(displayStrengthPercent(viaComposable.proyeksiStrength)).toBe('66.67')
    expect(viaComposable.ok).toBe(true)
  })
})
