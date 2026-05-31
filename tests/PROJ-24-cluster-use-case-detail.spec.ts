import { test, expect, type Page } from '@playwright/test'
import { deleteTestUsers } from './helpers/cleanup'
import { createTestUser } from './helpers/createTestUser'

const RUN_ID = Date.now()
const TEST_EMAIL = `qa24-${RUN_ID}@meridian-test.dev`
const TEST_PASSWORD = 'QaTestPass123!'

async function loginAndLand(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

// ── API Auth Guards (unauthenticated) ─────────────────────────────────────────

test.describe('API: PROJ-24 new endpoints — auth guard', () => {
  const FAKE_UUID = '00000000-0000-0000-0000-000000000001'

  test('GET /api/use-cases/[id] returns 401 unauthenticated', async ({ request }) => {
    const res = await request.get(`/api/use-cases/${FAKE_UUID}`)
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(typeof json.error).toBe('string')
  })

  test('POST /api/use-cases/[id]/insights returns 401 unauthenticated', async ({ request }) => {
    const res = await request.post(`/api/use-cases/${FAKE_UUID}/insights`)
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(typeof json.error).toBe('string')
  })

  test('GET /api/use-cases/[id] with invalid UUID format returns error', async ({ request }) => {
    // Malformed ID — server should return 4xx
    const res = await request.get('/api/use-cases/not-a-real-id')
    expect([400, 401, 404]).toContain(res.status())
  })
})

// ── UI: Use Case Detail Sheet ─────────────────────────────────────────────────

test.describe('Use Case Detail Sheet — UI (serial)', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await deleteTestUsers([TEST_EMAIL])
  })

  test('Setup: create test user and reach dashboard', async ({ page }) => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'QA Test Workspace')
    await loginAndLand(page)
    expect(page.url()).toContain('/dashboard')
  })

  test('Use Cases page loads and shows generate button', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button:has-text("Use Cases generieren")')).toBeVisible()
  })

  test('Empty state: no sheet visible without selecting a UC', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases')
    await page.waitForLoadState('networkidle')
    // Sheet should not be visible by default
    await expect(page.locator('[data-state="open"][role="dialog"]')).not.toBeVisible()
  })

  test('Generate produces cards that are clickable (if workspace has data)', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases')
    await page.waitForLoadState('networkidle')

    // Click generate and wait
    await page.locator('button:has-text("Use Cases generieren")').click()
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // If use cases exist, the cards should be present
    const cards = page.locator('[data-testid="use-case-card"]')
    const cardCount = await cards.count()

    if (cardCount > 0) {
      // Click first card — sheet should open
      await cards.first().click()
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
      // Sheet header should have title text
      await expect(page.locator('[role="dialog"] h2, [role="dialog"] [data-slot="title"]')).toBeVisible()
      // Close sheet with Escape
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-state="open"][role="dialog"]')).not.toBeVisible({ timeout: 3000 })
    } else {
      // Fresh workspace — no use cases yet, acceptable skip
      test.skip()
    }
  })

  test('KI Use Cases page regression: roadmap page loads without error', async ({ page }) => {
    await loginAndLand(page)
    await page.goto('/dashboard/use-cases/roadmap')
    await page.waitForLoadState('networkidle')
    // Page must load with heading — whether empty state or roadmap columns
    await expect(page.locator('h1:has-text("Quartals-Roadmap")')).toBeVisible()
    // Q1/Q2/Q3 columns only appear when use cases exist; empty state is also valid
    const hasColumns = await page.locator('text=Q1').isVisible()
    const hasEmptyState = await page.locator('text=Noch keine Use Cases').isVisible()
    expect(hasColumns || hasEmptyState).toBe(true)
  })
})
