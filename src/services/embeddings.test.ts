import { describe, it, expect, vi, beforeEach } from 'vitest'

import { generateEmbedding } from './embeddings'

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
