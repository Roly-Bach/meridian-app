import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAnthropic, mockGoogle, mockOpenAIChat, mockCreateOpenAI } = vi.hoisted(() => ({
  mockAnthropic: vi.fn().mockReturnValue('anthropic-model'),
  mockGoogle: vi.fn().mockReturnValue('google-model'),
  mockOpenAIChat: vi.fn().mockReturnValue('openai-chat-model'),
  mockCreateOpenAI: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(mockAnthropic),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(mockGoogle),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockImplementation((opts: unknown) => {
    mockCreateOpenAI(opts)
    return { chat: mockOpenAIChat }
  }),
}))

import { resolveModel } from './llm-provider'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

describe('resolveModel', () => {
  beforeEach(() => {
    mockAnthropic.mockClear()
    mockGoogle.mockClear()
    mockOpenAIChat.mockClear()
    mockCreateOpenAI.mockClear()
    vi.mocked(createAnthropic).mockClear()
    vi.mocked(createGoogleGenerativeAI).mockClear()
  })

  it('routes anthropic/<model-id> to createAnthropic', () => {
    resolveModel('anthropic/claude-sonnet-4-6')
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: process.env.ANTHROPIC_API_KEY })
    expect(mockAnthropic).toHaveBeenCalledWith('claude-sonnet-4-6')
  })

  it('routes google/<model-id> to createGoogleGenerativeAI', () => {
    resolveModel('google/gemini-3.5-flash')
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    expect(mockGoogle).toHaveBeenCalledWith('gemini-3.5-flash')
  })

  // PROJ-9: Nebius/Fireworks must use .chat(modelId), not the bare provider call —
  // the bare call targets OpenAI's Responses API, which these compatible endpoints don't implement.
  it('routes nebius/<model-id> to createOpenAI with the Nebius base URL via .chat()', () => {
    resolveModel('nebius/kimi-k2.6-reasoning')
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: process.env.NEBIUS_API_KEY,
      baseURL: 'https://api.tokenfactory.nebius.com/v1',
    })
    expect(mockOpenAIChat).toHaveBeenCalledWith('kimi-k2.6-reasoning')
  })

  it('routes fireworks/<model-id> to createOpenAI with the Fireworks base URL via .chat()', () => {
    resolveModel('fireworks/kimi-k2.6')
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: process.env.FIREWORKS_API_KEY,
      baseURL: 'https://api.fireworks.ai/inference/v1',
    })
    expect(mockOpenAIChat).toHaveBeenCalledWith('kimi-k2.6')
  })

  // PROJ-41: OpenRouter is an eval-only aggregator. The id after the first slash keeps
  // OpenRouter's own vendor/model slug (two more segments), routed via .chat().
  it('routes openrouter/<vendor>/<model-id> to createOpenAI with the OpenRouter base URL + HTTP/1.1 fetch via .chat()', () => {
    resolveModel('openrouter/z-ai/glm-5.2')
    // PROJ-41: openrouter gets a custom fetch (forces HTTP/1.1 to dodge H2 stalls) — the
    // other providers do not, so assert the shape includes a fetch fn here specifically.
    expect(mockCreateOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        fetch: expect.any(Function),
      }),
    )
    expect(mockOpenAIChat).toHaveBeenCalledWith('z-ai/glm-5.2')
  })

  it('treats a bare model name without provider prefix as legacy Anthropic', () => {
    resolveModel('claude-haiku-4-5')
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: process.env.ANTHROPIC_API_KEY })
    expect(mockAnthropic).toHaveBeenCalledWith('claude-haiku-4-5')
  })

  it('falls back to the default model when called with no argument', () => {
    resolveModel()
    expect(mockGoogle).toHaveBeenCalledWith('gemini-3.1-flash-lite')
  })

  it('throws on an unsupported provider prefix', () => {
    expect(() => resolveModel('unknown-provider/some-model')).toThrow(
      /Unsupported model provider: "unknown-provider"/,
    )
  })
})
