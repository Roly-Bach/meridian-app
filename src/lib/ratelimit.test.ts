import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must be hoisted so vi.mock can reference them
const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    limit = mockLimit
    static slidingWindow = vi.fn().mockReturnValue({})
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {},
}))

describe('ratelimit — extractIP', () => {
  it('returns first IP from x-forwarded-for header', async () => {
    const { extractIP } = await import('./ratelimit')
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(extractIP(req)).toBe('1.2.3.4')
  })

  it('returns "unknown" when header is absent', async () => {
    const { extractIP } = await import('./ratelimit')
    const req = new Request('http://localhost')
    expect(extractIP(req)).toBe('unknown')
  })
})

describe('ratelimit — fail-open when env vars missing', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.resetModules()
  })

  it('checkTokenEndpointLimits returns null (pass through) when Upstash not configured', async () => {
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    expect(result).toBeNull()
  })

  it('checkUserLimitProcessSteps returns null when Upstash not configured', async () => {
    const { checkUserLimitProcessSteps } = await import('./ratelimit')
    const result = await checkUserLimitProcessSteps('user-123')
    expect(result).toBeNull()
  })

  it('checkUserLimitUseCases returns null when Upstash not configured', async () => {
    const { checkUserLimitUseCases } = await import('./ratelimit')
    const result = await checkUserLimitUseCases('user-123')
    expect(result).toBeNull()
  })
})

describe('ratelimit — with Upstash configured', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('checkTokenEndpointLimits returns null when limit not exceeded', async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 3600000 })
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    expect(result).toBeNull()
  })

  it('checkTokenEndpointLimits returns 429 with Retry-After when token limit exceeded', async () => {
    const resetTime = Date.now() + 60_000 // 60 seconds from now
    mockLimit
      .mockResolvedValueOnce({ success: false, reset: resetTime }) // token limit hit
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    const retryAfter = result!.headers.get('Retry-After')
    expect(retryAfter).toBeTruthy()
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it('checkTokenEndpointLimits returns 429 when IP limit exceeded (token passes)', async () => {
    const resetTime = Date.now() + 30_000
    mockLimit
      .mockResolvedValueOnce({ success: true, reset: Date.now() + 3600000 }) // token passes
      .mockResolvedValueOnce({ success: false, reset: resetTime }) // IP limit hit
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
  })

  it('checkTokenEndpointLimits 429 body contains German error message', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 })
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    const body = await result!.json()
    expect(body.error).toBe('Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.')
  })

  it('checkUserLimitProcessSteps returns 429 with English error when limit exceeded', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 })
    const { checkUserLimitProcessSteps } = await import('./ratelimit')
    const result = await checkUserLimitProcessSteps('user-123')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    const body = await result!.json()
    expect(body.error).toBe('Rate limit exceeded. Try again later.')
  })

  it('checkUserLimitUseCases returns 429 with English error when limit exceeded', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 })
    const { checkUserLimitUseCases } = await import('./ratelimit')
    const result = await checkUserLimitUseCases('user-123')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    const body = await result!.json()
    expect(body.error).toBe('Rate limit exceeded. Try again later.')
  })

  it('fail-open: checkTokenEndpointLimits returns null when Upstash throws', async () => {
    mockLimit.mockRejectedValue(new Error('Connection refused'))
    const { checkTokenEndpointLimits } = await import('./ratelimit')
    const result = await checkTokenEndpointLimits('some-token', '1.2.3.4')
    expect(result).toBeNull()
  })

  it('fail-open: checkUserLimitProcessSteps returns null when Upstash throws', async () => {
    mockLimit.mockRejectedValue(new Error('Network error'))
    const { checkUserLimitProcessSteps } = await import('./ratelimit')
    const result = await checkUserLimitProcessSteps('user-123')
    expect(result).toBeNull()
  })
})
