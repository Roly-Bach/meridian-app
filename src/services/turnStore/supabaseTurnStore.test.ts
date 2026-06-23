import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({}),
}))

import { withRetry } from './supabaseTurnStore'

describe('withRetry (KI-11)', () => {
  it('returns data on first success, no retry', async () => {
    const fn = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null })
    const result = await withRetry(fn, 'test', 2, 1)
    expect(result).toEqual({ id: '1' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a transient fetch error and succeeds on the second attempt', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'TypeError: fetch failed' } })
      .mockResolvedValueOnce({ data: { id: '1' }, error: null })
    const result = await withRetry(fn, 'test', 2, 1)
    expect(result).toEqual({ id: '1' })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('returns null after exhausting all retries on persistent error', async () => {
    const fn = vi.fn().mockResolvedValue({ data: null, error: { message: 'fetch failed' } })
    const result = await withRetry(fn, 'test', 2, 1)
    expect(result).toBeNull()
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
