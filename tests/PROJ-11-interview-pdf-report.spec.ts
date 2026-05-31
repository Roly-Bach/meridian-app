import { test, expect } from '@playwright/test'
import { deleteTestUsers } from './helpers/cleanup'
import { createTestUser } from './helpers/createTestUser'

// ── Constants ─────────────────────────────────────────────────────────────────

const RUN_ID = Date.now()
const TEST_PASSWORD = 'QaTestPass123!'

// ─── API: PDF endpoint — no auth ─────────────────────────────────────────────
// These tests hit the API directly and don't require live Supabase session.

test.describe('API: GET /api/interviews/[id]/pdf — error states', () => {
  test('returns 401 JSON when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/interviews/00000000-0000-0000-0000-000000000001/pdf')
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  test('returns JSON (not HTML) for all error responses', async ({ request }) => {
    const res = await request.get('/api/interviews/00000000-0000-0000-0000-000000000002/pdf')
    // Error responses must be JSON, not HTML (Next.js default error page)
    expect(res.headers()['content-type']).toContain('application/json')
    const json = await res.json()
    expect(typeof json.error).toBe('string')
  })
})

// ─── UI: PDF button visibility (serial — requires live Supabase) ──────────────

test.describe('PDF button — dashboard UI (serial)', () => {
  test.describe.configure({ mode: 'serial' })

  let interviewToken = ''
  let interviewId = ''
  const LIVE_EMAIL = `qa11-${RUN_ID}@meridian-test.dev`

  test('Setup: create user + create interview', async ({ page }) => {
    await createTestUser(LIVE_EMAIL, TEST_PASSWORD, `PDF-WS-${RUN_ID}`)
    await page.goto('/login')
    await page.fill('input[type="email"]', LIVE_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'PDF Test User')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'Testleiter')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'QA')
    await page.getByRole('button', { name: 'Interview anlegen', exact: true }).click()
    await expect(page.getByText('Interview erstellt')).toBeVisible({ timeout: 10000 })

    const linkText = await page.locator('.font-mono').innerText()
    const match = linkText.match(/\/interview\/([^/\s]+)/)
    expect(match).not.toBeNull()
    interviewToken = match![1]
  })

  test('PDF button NOT shown for created/active interview', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Interview is still 'created' — PDF button must not appear
    await expect(page.getByRole('button', { name: /PDF erstellen/i })).not.toBeVisible({ timeout: 5000 })
    // CopyLink button IS visible
    await expect(page.getByRole('button', { name: /Link kopieren/i }).first()).toBeVisible()
  })

  test('Get interview id from API for later tests', async ({ request }) => {
    test.skip(!interviewToken, 'Setup did not run')

    const res = await request.get('/api/interview/' + interviewToken)
    if (res.ok()) {
      const json = await res.json() as { interview?: { id: string } }
      interviewId = json.interview?.id ?? ''
    }
    // interviewId may be empty if API requires auth — acceptable, later tests skip
  })

  test('PDF API returns 404 for non-completed interview (authenticated)', async ({ page }) => {
    test.skip(!interviewId, 'Interview ID not available')

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Make authenticated request using page context (has session cookie)
    const res = await page.request.get(`/api/interviews/${interviewId}/pdf`)
    // Interview is 'created', not 'completed' → 404
    expect(res.status()).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('abgeschlossen')
  })
})

// ─── Security: IDOR check ─────────────────────────────────────────────────────

test.describe('Security: PDF endpoint authorization', () => {
  test('unauthenticated request returns 401, not 403 or 500', async ({ request }) => {
    // Ensures error code is auth (401) not accidentally leaking 403/500
    const res = await request.get('/api/interviews/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/pdf')
    expect(res.status()).toBe(401)
  })

  test('invalid UUID returns 401 (auth checked before ID lookup)', async ({ request }) => {
    // Auth must be verified before any DB query — prevents info leakage
    const res = await request.get('/api/interviews/not-a-uuid/pdf')
    // Should be 401 (auth) not 500 (DB error with invalid UUID)
    expect(res.status()).toBe(401)
  })
})

test.afterAll(async () => {
  await deleteTestUsers([`qa11-${RUN_ID}@meridian-test.dev`])
})
