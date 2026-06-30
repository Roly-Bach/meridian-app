import { describe, it, expect } from 'vitest'
import { computeAgreement } from './judgeCalibration'

describe('computeAgreement (Cohen Kappa + match rate)', () => {
  it('perfect agreement over 3 categories → matchRate 1, kappa 1', () => {
    // p_o = 1; p_e = 3 × (1/3 × 1/3) = 1/3; kappa = (1 − 1/3)/(1 − 1/3) = 1
    const r = computeAgreement([1, 2, 3], [1, 2, 3])
    expect(r.n).toBe(3)
    expect(r.matchRate).toBe(1)
    expect(r.kappa).toBe(1)
  })

  it('chance-level agreement → kappa 0', () => {
    // A=[1,1,2,2] B=[1,2,1,2]: matches at idx 0 and 3 → p_o = 0.5.
    // Marginals both {1:2, 2:2} → p_e = (0.5×0.5)+(0.5×0.5) = 0.5.
    // kappa = (0.5 − 0.5)/(1 − 0.5) = 0.
    const r = computeAgreement([1, 1, 2, 2], [1, 2, 1, 2])
    expect(r.matchRate).toBe(0.5)
    expect(r.kappa).toBe(0)
  })

  it('single category used by both → matchRate 1, kappa 1 (undefined-case convention)', () => {
    // p_e = 1 (only one category). Convention: full match → kappa 1.
    const r = computeAgreement([1, 1, 1], [1, 1, 1])
    expect(r.matchRate).toBe(1)
    expect(r.kappa).toBe(1)
  })

  it('total disagreement on a single shared category set → kappa negative', () => {
    // A=[1,2] B=[2,1]: 0 matches → p_o = 0. Marginals both {1:1,2:1} → p_e = 0.5.
    // kappa = (0 − 0.5)/(1 − 0.5) = −1.
    const r = computeAgreement([1, 2], [2, 1])
    expect(r.matchRate).toBe(0)
    expect(r.kappa).toBe(-1)
  })

  it('partial agreement on discrete judge levels (0.33/0.67/1.0)', () => {
    // A=[0.33,0.67,1,0.67] B=[0.33,0.67,0.67,1]: matches idx 0,1 → p_o = 0.5.
    // A marginals {0.33:1, 0.67:2, 1:1}, B marginals {0.33:1, 0.67:2, 1:1}.
    // p_e = (1/4×1/4)+(2/4×2/4)+(1/4×1/4) = 0.0625+0.25+0.0625 = 0.375.
    // kappa = (0.5 − 0.375)/(1 − 0.375) = 0.125/0.625 = 0.2.
    const r = computeAgreement([0.33, 0.67, 1, 0.67], [0.33, 0.67, 0.67, 1])
    expect(r.matchRate).toBe(0.5)
    expect(r.kappa).toBe(0.2)
  })

  it('throws on length mismatch', () => {
    expect(() => computeAgreement([1, 2], [1])).toThrow(/differ in length/)
  })

  it('empty input → zeroed stats', () => {
    expect(computeAgreement([], [])).toEqual({ n: 0, matchRate: 0, kappa: 0 })
  })
})
