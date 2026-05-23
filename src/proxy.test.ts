import { describe, it, expect, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ headers: new Headers() })),
  },
}))

import { buildCsp } from './proxy'

describe('buildCsp', () => {
  it('includes nonce in script-src', () => {
    const csp = buildCsp('testNonce123')
    expect(csp).toContain("'nonce-testNonce123'")
  })

  it('does not contain unsafe-inline in script-src', () => {
    const csp = buildCsp('abc')
    const scriptSrc = csp.split('; ').find(d => d.startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('does not contain unsafe-eval anywhere', () => {
    const csp = buildCsp('abc')
    expect(csp).not.toContain('unsafe-eval')
  })

  it('includes blob: in script-src for AudioWorklet', () => {
    const csp = buildCsp('abc')
    const scriptSrc = csp.split('; ').find(d => d.startsWith('script-src'))
    expect(scriptSrc).toContain('blob:')
  })
})
