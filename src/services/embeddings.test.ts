import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockEmbed } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
}))

vi.mock('ai', () => ({
  embed: mockEmbed,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue({
    embedding: vi.fn().mockReturnValue('mock-jina-model'),
  }),
}))

import { generateEmbedding } from './embeddings'

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    mockEmbed.mockReset()
  })

  it('returns embedding array on success', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })

    const result = await generateEmbedding('some text')

    expect(result).toEqual([0.1, 0.2, 0.3])
    expect(mockEmbed).toHaveBeenCalledOnce()
  })

  it('returns null when JINA_API_KEY is not set', async () => {
    vi.stubEnv('JINA_API_KEY', '')

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it('returns null when Jina API call throws', async () => {
    vi.stubEnv('JINA_API_KEY', 'test-key')
    mockEmbed.mockRejectedValue(new Error('Jina API error'))

    const result = await generateEmbedding('some text')

    expect(result).toBeNull()
  })
})
