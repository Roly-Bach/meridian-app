import { test, expect } from '@playwright/test'

const RUN_ID = Date.now()
const TEST_EMAIL = `qa-${RUN_ID}@meridian-test.dev`
const TEST_PASSWORD = 'QaTestPass123!'
const TEST_WORKSPACE = `QA Workspace ${RUN_ID}`

// Helper: signs up and lands on /dashboard
async function signupNewUser(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/signup')
  await page.fill('input[placeholder="z.B. Mahr GmbH"]', TEST_WORKSPACE)
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 15000 })
}

// Helper: logs in with test credentials and lands on /dashboard
async function loginTestUser(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

// ============================================================
// Route Protection (no auth needed)
// ============================================================

test('Route protection: /dashboard redirects unauthenticated to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})

test.fixme(
  'Route protection: / redirects unauthenticated to /login',
  async ({ page }) => {
    // BUG: page.tsx returns null — Next.js serves the root as static content
    // and middleware redirect is bypassed. Fix: add server-side redirect() in page.tsx.
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  }
)

// ============================================================
// Signup Form Validation
// ============================================================

test('Signup validation: empty workspace keeps submit disabled', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/signup')
})

test('Signup validation: invalid email format shows error', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('input[placeholder="z.B. Mahr GmbH"]', 'My Workspace')
  await page.fill('input[type="email"]', 'notanemail')
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Ungültige E-Mail-Adresse')).toBeVisible()
})

test('Signup validation: password < 8 chars shows error', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('input[placeholder="z.B. Mahr GmbH"]', 'My Workspace')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'short')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Mindestens 8 Zeichen')).toBeVisible()
})

// ============================================================
// Signup Flow (serial: signup must run before login/logout tests)
// ============================================================

test.describe('Auth flows (serial — signup first)', () => {
  test.describe.configure({ mode: 'serial' })

  test('Signup: creates account and redirects to /dashboard', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1')).toHaveText('Konto erstellen')
    await page.fill('input[placeholder="z.B. Mahr GmbH"]', TEST_WORKSPACE)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL('/dashboard')
  })

  test('Signup: workspace name visible in sidebar', async ({ page }) => {
    await loginTestUser(page)
    await expect(page.locator(`text=${TEST_WORKSPACE}`)).toBeVisible()
  })

  test('Login: wrong password shows error toast', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', 'WrongPassword999!')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Ungültige Anmeldedaten')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL('/login')
  })

  test('Login: correct credentials redirect to /dashboard', async ({ page }) => {
    await loginTestUser(page)
    await expect(page).toHaveURL('/dashboard')
  })

  test('Login: authenticated user on /login redirects to /dashboard', async ({ page }) => {
    await loginTestUser(page)
    await page.goto('/login')
    await expect(page).toHaveURL('/dashboard')
  })

  test('Logout: clears session and redirects to /login', async ({ page }) => {
    await loginTestUser(page)
    await page.click('button:has-text("Abmelden")')
    await page.waitForURL('/login', { timeout: 10000 })
    await expect(page).toHaveURL('/login')
    // Dashboard is protected again
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })

  test('Signup: duplicate email shows error toast', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[placeholder="z.B. Mahr GmbH"]', 'Another Workspace')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page.locator('text=bereits registriert')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL('/signup')
  })
})

// ============================================================
// UI Design
// ============================================================

test('UI: Login page has Meridian Pink button (#E040FB)', async ({ page }) => {
  await page.goto('/login')
  const btn = page.locator('button[type="submit"]')
  await expect(btn).toBeVisible()
  const bgColor = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor)
  expect(bgColor).toBe('rgb(224, 64, 251)')
})

test('UI: Login page has link to /signup', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('a[href="/signup"]')).toBeVisible()
})

test('UI: Signup page has link to /login', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('a[href="/login"]')).toBeVisible()
})
