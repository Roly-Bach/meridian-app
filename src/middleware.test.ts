import { describe, it, expect } from 'vitest'
import { buildCsp } from './middleware'

describe('buildCsp', () => {
  const csp = buildCsp('test-nonce-123')

  it('includes the nonce in script-src', () => {
    expect(csp).toContain("'nonce-test-nonce-123'")
  })

  it('does not include unsafe-inline in script-src', () => {
    const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src'))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('does not include unsafe-eval', () => {
    expect(csp).not.toContain('unsafe-eval')
  })

  it('includes blob: in script-src for AudioWorklet', () => {
    const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src'))
    expect(scriptSrc).toContain('blob:')
  })

  it('produces a different CSP string per nonce', () => {
    const other = buildCsp('different-nonce')
    expect(other).not.toBe(csp)
  })
})
