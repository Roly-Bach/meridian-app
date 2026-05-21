import { test, expect } from '@playwright/test'

// ── PROJ-12: Rate Limiting ─────────────────────────────────────────────────────
//
// Rate limit ACs that require a real Upstash instance to trigger actual 429s
// are covered by unit tests (src/lib/ratelimit.test.ts) and API route tests.
//
// These E2E tests use Playwright route interception to simulate 429 responses
// and verify the UI handles them correctly — no Upstash credentials needed.

const FAKE_TOKEN = 'test-token-rate-limit-e2e'

test.describe('PROJ-12 — Rate Limiting: UI behavior on 429', () => {
  test('AC-3: Chat UI shows German error message as toast when API returns 429', async ({ page }) => {
    // Intercept initial interview load — return a valid active interview
    await page.route(`**/api/interview/${FAKE_TOKEN}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          interview: {
            id: 'iv-test-1',
            employee_name: 'Test Mitarbeiter',
            status: 'active',
            token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            max_duration_minutes: 30,
          },
          turns: [],
        }),
      })
    })

    // Intercept reconnect — return a valid stream response
    await page.route(`**/api/interview/${FAKE_TOKEN}/reconnect`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Willkommen zurück!',
      })
    })

    // Intercept chat — return 429 with German error
    await page.route(`**/api/interview/${FAKE_TOKEN}/chat`, (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({
          error: 'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.',
        }),
      })
    })

    await page.goto(`/interview/${FAKE_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Wait for chat input to appear
    const chatInput = page.locator('textarea, input[type="text"]').last()
    await expect(chatInput).toBeVisible({ timeout: 10000 })

    // Type and send a message
    await chatInput.fill('Guten Morgen!')
    await chatInput.press('Enter')

    // The German rate-limit error should appear as a toast
    await expect(
      page.getByText('Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.')
    ).toBeVisible({ timeout: 5000 })
  })

  test('AC-3: Chat UI shows German error message when reconnect endpoint returns 429', async ({ page }) => {
    await page.route(`**/api/interview/${FAKE_TOKEN}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          interview: {
            id: 'iv-test-2',
            employee_name: 'Test Mitarbeiter',
            status: 'active',
            token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            max_duration_minutes: 30,
          },
          turns: [
            {
              id: 'turn-1',
              turn_number: 1,
              user_input: 'Hallo',
              agent_response: 'Willkommen',
              created_at: new Date(Date.now() - 60000).toISOString(),
            },
          ],
        }),
      })
    })

    // Reconnect returns 429
    await page.route(`**/api/interview/${FAKE_TOKEN}/reconnect`, (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({
          error: 'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.',
        }),
      })
    })

    await page.goto(`/interview/${FAKE_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Wait briefly for reconnect to be attempted
    await page.waitForTimeout(1000)

    // The German rate-limit error should appear as a toast
    await expect(
      page.getByText('Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.')
    ).toBeVisible({ timeout: 5000 })
  })

  test('API: process-steps endpoint returns 401 without auth (rate limit is downstream of auth)', async ({ request }) => {
    const res = await request.post('/api/process-steps/generate', {
      data: { interview_id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' },
    })
    expect(res.status()).toBe(401)
  })

  test('API: use-cases endpoint returns 401 without auth (rate limit is downstream of auth)', async ({ request }) => {
    const res = await request.post('/api/use-cases/generate', {
      data: { workspace_id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5' },
    })
    expect(res.status()).toBe(401)
  })

  test('API: chat endpoint returns 404 for unknown token (rate limit after token check)', async ({ request }) => {
    const res = await request.post('/api/interview/nonexistent-fake-token/chat', {
      data: { user_input: 'Hallo' },
    })
    expect(res.status()).toBe(404)
  })
})
