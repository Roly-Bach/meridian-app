import { describe, it, expect, vi, beforeEach } from 'vitest'

import { generateEmbedding, cosineSim } from './embeddings'

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns embedding array on success', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    }))

    const result = await generateEmbedding('some text')

    expect(result).toEqual([0.1, 0.2, 0.3])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('returns null when JINA_API_KEY is not set', async () => {
    vi.stubEnv('JINA_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn())

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when fetch throws', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
  })

  it('returns null when Jina API returns non-ok response', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }))

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
  })

  it('returns null when response data is empty', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }))

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
  })
})

// Moved from processClustering.test.ts (#21, 2026-07-14) — cosineSim now lives
// in embeddings.ts, next to the embedding API it operates on.
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
