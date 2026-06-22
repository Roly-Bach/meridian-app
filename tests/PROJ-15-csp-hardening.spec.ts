import { test, expect } from '@playwright/test'

test('CSP header on /login contains a nonce, no unsafe-inline/unsafe-eval in script-src', async ({ request }) => {
  const response = await request.get('/login')
  const csp = response.headers()['content-security-policy']
  expect(csp).toBeDefined()

  const scriptSrc = csp!.split(';').find(d => d.trim().startsWith('script-src'))
  expect(scriptSrc).toBeDefined()
  expect(scriptSrc).toMatch(/'nonce-[^']+'/)
  expect(scriptSrc).not.toContain('unsafe-inline')
  expect(scriptSrc).not.toContain('unsafe-eval')
  expect(scriptSrc).toContain('blob:')
})

test('x-nonce response header matches the nonce embedded in rendered HTML', async ({ request }) => {
  const response = await request.get('/login')
  const nonce = response.headers()['x-nonce']
  expect(nonce).toBeTruthy()

  const html = await response.text()
  expect(html).toContain(`nonce="${nonce}"`)
})

test('unauthenticated root redirects to /login and still carries the CSP header', async ({ request }) => {
  const response = await request.get('/', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers()['location']).toContain('/login')
  expect(response.headers()['content-security-policy']).toMatch(/'nonce-[^']+'/)
})

test('login page renders without CSP violations in the browser console', async ({ page }) => {
  const cspViolations: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().toLowerCase().includes('content security policy')) {
      cspViolations.push(msg.text())
    }
  })

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  expect(cspViolations).toEqual([])
})
