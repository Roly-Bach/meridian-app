import { test, expect, type Page } from '@playwright/test'
import { deleteTestUsers } from './helpers/cleanup'

const RUN_ID = Date.now()
const TEST_EMAIL = `qa6-${RUN_ID}@meridian-test.dev`
const TEST_PASSWORD = 'QaTestPass123!'

async function signupAndLand(page: Page) {
  await page.goto('/signup')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function loginAndLand(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

// ── API Tests (unauthenticated) ───────────────────────────────────────────────

test.describe('API: Use Case endpoints — auth guard', () => {
  test('POST /api/use-cases/generate returns 401 unauthenticated', async ({ request }) => {
    const res = await request.post('/api/use-cases/generate', {
      data: { workspace_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(typeof json.error).toBe('string')
  })

  test('GET /api/use-cases returns 401 unauthenticated', async ({ request }) => {
    const res = await request.get('/api/use-cases', { params: { workspace_id: '00000000-0000-0000-0000-000000000001' } })
    expect(res.status()).toBe(401)
  })

  test('GET /api/use-cases/roadmap returns 401 unauthenticated', async ({ request }) => {
    const res = await request.get('/api/use-cases/roadmap', { params: { workspace_id: '00000000-0000-0000-0000-000000000001' } })
    expect(res.status()).toBe(401)
  })
})

// ── UI Tests (serial — one account, login between tests) ─────────────────────

test.describe('Use Case Board — UI (serial)', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await deleteTestUsers([TEST_EMAIL])
  })

  test('Setup: signup and reach dashboard', async ({ page }) => {
    await signupAndLand(page)
    expect(page.url()).toContain('/dashboard')
  })

  test('Dashboard has KI Use Cases nav item', async ({ page }) => {
    await loginAndLand(page)
    await expect(page.locator('text=KI Use Cases')).toBeVisible()
  })

  test('Use Cases page shows generate button', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button:has-text("Use Cases generieren")')).toBeVisible()
  })

  test('Generate button shows loading state on click', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("Use Cases generieren")').click()
    await expect(page.locator('button:has-text("Generiere")')).toBeVisible({ timeout: 3000 })
  })

  test('Quartals-Roadmap has Q1 Q2 Q3 columns', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases/roadmap')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Q1')).toBeVisible()
    await expect(page.locator('text=Q2')).toBeVisible()
    await expect(page.locator('text=Q3')).toBeVisible()
  })
})
