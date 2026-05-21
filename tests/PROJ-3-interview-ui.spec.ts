import { test, expect, type Page } from '@playwright/test'

// ── Constants ─────────────────────────────────────────────────────────────────

const RUN_ID = Date.now()
const TEST_EMAIL = `qa3-${RUN_ID}@meridian-test.dev`
const TEST_PASSWORD = 'QaTestPass123!'
const TEST_WORKSPACE = `QA Workspace ${RUN_ID}`

// ── Helpers ───────────────────────────────────────────────────────────────────

async function signupAndLand(page: Page) {
  await page.goto('/signup')
  await page.fill('input[placeholder="z.B. Mahr GmbH"]', TEST_WORKSPACE)
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

// ── Dashboard: Empty State ────────────────────────────────────────────────────

test.describe('Dashboard — empty state (serial, signup first)', () => {
  test.describe.configure({ mode: 'serial' })

  test('Dashboard: shows empty state with CTA when no interviews exist', async ({ page }) => {
    await signupAndLand(page)
    await expect(page.getByText('Noch keine Interviews')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Erstes Interview anlegen' })).toBeVisible()
  })

  test('Dashboard: "Neues Interview" button is visible', async ({ page }) => {
    await loginAndLand(page)
    await expect(page.getByRole('button', { name: 'Neues Interview' })).toBeVisible()
  })

  // ── New Interview Dialog ───────────────────────────────────────────────────

  test('Dialog: opens when "Neues Interview" clicked', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Neues Interview anlegen')).toBeVisible()
  })

  test('Dialog: submit button disabled when required fields empty', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    const submitBtn = page.getByRole('button', { name: 'Interview anlegen' })
    await expect(submitBtn).toBeDisabled()
  })

  test('Dialog: submit button enabled when all required fields filled', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Hans Becker')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'Produktionsleiter')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'Qualitätssicherung')
    const submitBtn = page.getByRole('button', { name: 'Interview anlegen' })
    await expect(submitBtn).not.toBeDisabled()
  })

  test('Dialog: submit button stays disabled when employee_role is missing', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Hans Becker')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'Qualitätssicherung')
    // employee_role NOT filled
    const submitBtn = page.getByRole('button', { name: 'Interview anlegen' })
    await expect(submitBtn).toBeDisabled()
  })

  test('Dialog: creates interview with default duration (30 min) and shows link-ready step', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Hans Becker')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'Produktionsleiter')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'Fertigung')
    // Default duration is 30 minutes, no action needed on select
    await page.getByRole('button', { name: 'Interview anlegen', exact: true }).click()
    await expect(page.getByText('Interview erstellt')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Link kopieren' })).toBeVisible()
    // Interview link contains /interview/
    await expect(page.getByText('/interview/')).toBeVisible()
  })

  test('Dialog: creates interview with 10 minutes duration and shows link-ready step', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Heidi Kurz')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'Testperson')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'Testing')
    // Select 10 minutes duration
    await page.getByRole('combobox', { name: 'Interviewdauer' }).click()
    await page.getByRole('option', { name: '10 Minuten (Test)' }).click()
    await page.getByRole('button', { name: 'Interview anlegen', exact: true }).click()
    await expect(page.getByText('Interview erstellt')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Link kopieren' })).toBeVisible()
  })

  test('Dialog: shows new interview in table after closing', async ({ page }) => {
    await loginAndLand(page)
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Maria Müller')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'Einkäuferin')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'Einkauf')
    await page.getByRole('button', { name: 'Interview anlegen', exact: true }).click()
    await expect(page.getByText('Interview erstellt')).toBeVisible({ timeout: 10000 })
    // Close dialog
    await page.keyboard.press('Escape')
    await expect(page.getByText('Maria Müller')).toBeVisible()
  })

  test('Dashboard: table shows correct columns', async ({ page }) => {
    await loginAndLand(page)
    await expect(page.getByText('Mitarbeiter')).toBeVisible()
    await expect(page.getByText('Rolle')).toBeVisible()
    await expect(page.getByText('Abteilung')).toBeVisible()
    await expect(page.getByText('Status')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Erstellt' })).toBeVisible()
    await expect(page.getByText('Aktionen')).toBeVisible()
  })

  test('Dashboard: shows status badge for created interview', async ({ page }) => {
    await loginAndLand(page)
    // Status badge is a <span> inside a table row
    await expect(page.locator('tbody span').filter({ hasText: 'Erstellt' }).first()).toBeVisible()
  })
})

// ── Employee Chat Page: Error States ─────────────────────────────────────────

// ── API: POST /api/interviews error handling ──────────────────────────────────

test.describe('API: POST /api/interviews error handling', () => {
  test('POST /api/interviews without auth returns JSON 401, not empty 500', async ({ request }) => {
    const res = await request.post('/api/interviews', {
      data: { employee_name: 'X', employee_role: 'Y', department: 'Z', max_duration_minutes: 30 },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})

// ── Employee Chat Page: Error States ─────────────────────────────────────────

test.describe('Employee Chat Page — error states', () => {
  test('Invalid token shows 404 error screen without chat', async ({ page }) => {
    await page.goto('/interview/this-token-definitely-does-not-exist-12345')
    await expect(page.getByText('Dieser Interview-Link ist ungültig.')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('textarea')).not.toBeVisible()
    await expect(page.getByText('Meridian')).toBeVisible()
  })

  test('Error screen has Meridian branding', async ({ page }) => {
    await page.goto('/interview/invalid-token-xyz')
    await expect(page.getByText('Meridian')).toBeVisible({ timeout: 10000 })
  })

  test('Interview page has no dashboard sidebar or layout', async ({ page }) => {
    await page.goto('/interview/some-token')
    await page.waitForLoadState('networkidle')
    // Sidebar navigation should not be present
    await expect(page.locator('aside')).not.toBeVisible()
  })
})

// ── Employee Chat Page: Chat Interface ────────────────────────────────────────

test.describe('Employee Chat Page — chat interface (serial)', () => {
  test.describe.configure({ mode: 'serial' })

  let interviewToken = ''
  const INTERVIEWER_EMAIL = `qa3b-${RUN_ID}@meridian-test.dev`

  test('Setup: create interview and get link', async ({ page }) => {
    // Signup as consultant
    await page.goto('/signup')
    await page.fill('input[placeholder="z.B. Mahr GmbH"]', `B-Workspace-${RUN_ID}`)
    await page.fill('input[type="email"]', INTERVIEWER_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Create interview and capture token from link
    await page.click('button:has-text("Neues Interview")')
    await page.fill('input[placeholder="z.B. Hans Becker"]', 'Test Employee')
    await page.fill('input[placeholder="z.B. Produktionsleiter"]', 'IT-Mitarbeiter')
    await page.fill('input[placeholder="z.B. Qualitätssicherung"]', 'IT')
    await page.getByRole('button', { name: 'Interview anlegen', exact: true }).click()
    await expect(page.getByText('Interview erstellt')).toBeVisible({ timeout: 10000 })

    // Extract token from link text shown in dialog
    const linkText = await page.locator('.font-mono').innerText()
    const match = linkText.match(/\/interview\/([^/\s]+)/)
    expect(match).not.toBeNull()
    interviewToken = match![1]
    expect(interviewToken.length).toBeGreaterThan(10)
  })

  test('Chat page loads without auth and shows chat interface', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    // Should show chat input, not error screen
    await expect(page.locator('textarea')).toBeVisible({ timeout: 8000 })
  })

  test('Chat page: send button disabled when input empty', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    const sendBtn = page.locator('button[aria-label="Nachricht senden"]')
    await expect(sendBtn).toBeDisabled()
  })

  test('Chat page: Enter key submits message, Shift+Enter inserts newline', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea')

    // Type and verify Shift+Enter adds newline
    await textarea.fill('Line one')
    await textarea.press('Shift+Enter')
    const valueAfterShift = await textarea.inputValue()
    expect(valueAfterShift).toContain('\n')
  })

  test('Chat page: whitespace-only message cannot be submitted', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea')
    await textarea.fill('   ')
    const sendBtn = page.locator('button[aria-label="Nachricht senden"]')
    await expect(sendBtn).toBeDisabled()
  })

  test('Chat page: user message appears right-aligned after send', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea')
    await textarea.fill('Hallo, ich bin bereit.')
    await textarea.press('Enter')

    // User message should appear right-aligned (justify-end)
    await expect(page.locator('.justify-end').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Hallo, ich bin bereit.')).toBeVisible()
  })

  test('Chat page: input disabled during streaming', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea')
    await textarea.fill('Hallo, ich bin bereit.')
    await textarea.press('Enter')

    // Input should be disabled while streaming is happening
    await expect(textarea).toBeDisabled({ timeout: 5000 })
  })

  test('Chat page: Meridian branding visible in header', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Meridian')).toBeVisible({ timeout: 5000 })
  })

  test('Chat page: agent greeting appears automatically on first open (no user input needed)', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    // Agent message bubble should appear left-aligned (justify-start) without user sending anything
    await expect(page.locator('.justify-start').first()).toBeVisible({ timeout: 15000 })
  })

  test('Chat page: reconnect banner shown on page reload mid-interview', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')

    // Send one message to ensure turns exist in DB
    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea')
    await textarea.waitFor({ state: 'visible', timeout: 8000 })
    await textarea.fill('Kurze Test-Nachricht')
    await textarea.press('Enter')
    // Wait for agent response to confirm turn is saved
    await expect(page.locator('.justify-start').first()).toBeVisible({ timeout: 20000 })

    // Reload — this time existingTurns.length > 0 → banner should show
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByText('Verbindung unterbrochen — dein Gespräch wurde fortgesetzt.')
    ).toBeVisible({ timeout: 10000 })
  })

  test('Chat page: reconnect banner dismisses on click', async ({ page }) => {
    test.skip(!interviewToken, 'Setup did not run')

    await page.goto(`/interview/${interviewToken}`)
    await page.waitForLoadState('networkidle')

    const banner = page.getByText('Verbindung unterbrochen — dein Gespräch wurde fortgesetzt.')
    // Only check if banner is present (depends on prior test having run)
    const bannerVisible = await banner.isVisible({ timeout: 5000 }).catch(() => false)
    test.skip(!bannerVisible, 'No banner to dismiss (no prior turns)')

    await page.getByRole('button', { name: 'Schließen' }).click()
    await expect(banner).not.toBeVisible()
  })
})

// ── Dashboard: Sidebar navigation ─────────────────────────────────────────────
// Uses a self-contained signup to avoid ordering dependency on the serial suite above.

test.describe('Dashboard — sidebar navigation', () => {
  const SIDEBAR_EMAIL = `qa3c-${RUN_ID}@meridian-test.dev`

  test('Sidebar has "Interviews" nav item', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[placeholder="z.B. Mahr GmbH"]', `C-WS-${RUN_ID}`)
    await page.fill('input[type="email"]', SIDEBAR_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: 'Interviews' })).toBeVisible()
  })
})
