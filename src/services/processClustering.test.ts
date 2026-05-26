import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { cosineSim } from './processClustering'

describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4]
    expect(cosineSim(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0.0)
  })

  it('returns 0 for zero vector', () => {
    expect(cosineSim([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('returns 0 for both zero vectors', () => {
    expect(cosineSim([0, 0], [0, 0])).toBe(0)
  })

  it('is commutative', () => {
    const a = [0.5, 0.3, 0.8, 0.1]
    const b = [0.2, 0.9, 0.4, 0.7]
    expect(cosineSim(a, b)).toBeCloseTo(cosineSim(b, a))
  })

  it('returns value in [-1, 1] range', () => {
    const a = [1, -1, 2, -2]
    const b = [-1, 1, -2, 2]
    const sim = cosineSim(a, b)
    expect(sim).toBeGreaterThanOrEqual(-1)
    expect(sim).toBeLessThanOrEqual(1)
  })

  it('returns ~1 for semantically similar vectors (high-dim unit vectors)', () => {
    const base = Array.from({ length: 1024 }, (_, i) => Math.sin(i))
    const noise = base.map((v) => v + 0.01 * Math.random())
    expect(cosineSim(base, noise)).toBeGreaterThan(0.99)
  })

  it('returns < threshold for dissimilar vectors', () => {
    const a = Array.from({ length: 1024 }, (_, i) => (i % 2 === 0 ? 1 : 0))
    const b = Array.from({ length: 1024 }, (_, i) => (i % 2 === 0 ? 0 : 1))
    expect(cosineSim(a, b)).toBeLessThan(0.1)
  })
})
