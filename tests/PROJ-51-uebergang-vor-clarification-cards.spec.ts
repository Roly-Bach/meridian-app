import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'crypto'

// ── PROJ-51: Übergang vor Clarification Cards — E2E Tests ──────────────────────
// Verifies the client-side transition mechanism (TransitionPrompt + FadeIn) that
// gates the hard component swap after the farewell message. All backend calls are
// intercepted via page.route — this is pure frontend timing/UI behavior, no real
// interview data needed (mirrors PROJ-3's error-state tests, which also navigate
// to arbitrary tokens without a DB fixture).
// ────────────────────────────────────────────────────────────────────────────

const EXISTING_TURN = {
  id: 'turn-1',
  turn_number: 1,
  user_input: 'Ich prüfe Rechnungen.',
  agent_response: 'Verstanden, erzähl mir mehr davon.',
  created_at: new Date().toISOString(),
}

async function mockBaseRoutes(page: Page, token: string, secondGetResponse: Record<string, unknown>) {
  let getCallCount = 0

  await page.route(`**/api/interview/${token}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    getCallCount += 1
    if (getCallCount === 1) {
      await route.fulfill({
        json: {
          interview: {
            id: 'interview-1',
            employee_name: 'Test Employee',
            status: 'active',
            token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
            max_duration_minutes: 30,
          },
          state: { phase: 'discovery' },
          turns: [EXISTING_TURN],
          openerText: null,
          clarificationCards: null,
          clarificationAnswers: null,
        },
      })
    } else {
      await route.fulfill({ json: secondGetResponse })
    }
  })

  await page.route(`**/api/interview/${token}/reconnect`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: '' })
  })

  await page.route(`**/api/interview/${token}/chat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'Vielen Dank für das Gespräch! Zum Abschluss habe ich noch ein paar kurze Rückfragen.',
    })
  })
}

test.describe('PROJ-51 — Übergang vor Clarification Cards', () => {
  test('AC1 + AC2 (completed-path): "Weiter" button + progress appear after streaming, click advances immediately to ChatCompletedScreen', async ({ page }) => {
    const token = randomUUID()
    await mockBaseRoutes(page, token, {
      interview: { id: 'interview-1', employee_name: 'Test Employee', status: 'completed' },
      state: { phase: 'wrap_up' },
      turns: [EXISTING_TURN],
      openerText: null,
      clarificationCards: null,
      clarificationAnswers: null,
    })

    await page.goto(`/interview/${token}`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea')
    await textarea.fill('Alles klar, danke.')
    await textarea.press('Enter')

    const advanceBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(advanceBtn).toBeVisible({ timeout: 10000 })
    // Progress is aria-hidden (decorative, the button is the a11y-relevant control),
    // so it's excluded from the accessibility tree — query the raw DOM attribute instead.
    await expect(page.locator('[role="progressbar"]')).toBeVisible()

    // AC1: chat input disabled while transition is pending
    await expect(textarea).toBeDisabled()

    // AC2/AC1: click advances immediately, no need to wait for the 5s auto-delay
    await advanceBtn.click()
    await expect(page.getByText('Vielen Dank! Das Interview wurde abgeschlossen.')).toBeVisible({ timeout: 2000 })
  })

  test('AC1 + AC2 (clarification-path): auto-advances to ClarificationView after ~5s without a click', async ({ page }) => {
    const token = randomUUID()
    await mockBaseRoutes(page, token, {
      interview: { id: 'interview-1', employee_name: 'Test Employee', status: 'active' },
      state: { phase: 'clarification' },
      turns: [EXISTING_TURN],
      openerText: null,
      clarificationCards: [
        { process_step_id: 'S001', step_title: 'Rechnungsprüfung', question: 'Wie oft kommt dieser Schritt vor?', options: [], slot_key: 'frequency', answer_type: 'single', direction: null },
      ],
      clarificationAnswers: null,
    })

    await page.goto(`/interview/${token}`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea')
    await textarea.fill('Das war alles von mir.')
    await textarea.press('Enter')

    const advanceBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(advanceBtn).toBeVisible({ timeout: 10000 })

    // No click — wait past the fixed 5s delay (AC1) and confirm auto-advance to
    // the clarification screen (AC2: identical mechanism, different target).
    await expect(page.getByText('Noch ein paar kurze Bestätigungen')).toBeVisible({ timeout: 7000 })
  })

  test('Double-click on "Weiter" does not double-fire the transition', async ({ page }) => {
    const token = randomUUID()
    await mockBaseRoutes(page, token, {
      interview: { id: 'interview-1', employee_name: 'Test Employee', status: 'completed' },
      state: { phase: 'wrap_up' },
      turns: [EXISTING_TURN],
      openerText: null,
      clarificationCards: null,
      clarificationAnswers: null,
    })

    await page.goto(`/interview/${token}`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea')
    await textarea.fill('Alles klar, danke.')
    await textarea.press('Enter')

    const advanceBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(advanceBtn).toBeVisible({ timeout: 10000 })

    // Fire both clicks synchronously in one JS tick — the guard (firedRef) must
    // prevent a second trigger. (Awaiting two separate .click() calls wouldn't
    // reproduce this: the button unmounts after the first, leaving the second
    // waiting indefinitely for a detached locator.)
    await advanceBtn.evaluate((el: HTMLElement) => {
      el.click()
      el.click()
    })

    await expect(page.getByText('Vielen Dank! Das Interview wurde abgeschlossen.')).toBeVisible({ timeout: 2000 })
    // Only one completed screen instance — no duplicate render/crash.
    await expect(page.getByText('Vielen Dank! Das Interview wurde abgeschlossen.')).toHaveCount(1)
  })

  test('AC3: prefers-reduced-motion hides the countdown progress bar', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const token = randomUUID()
    await mockBaseRoutes(page, token, {
      interview: { id: 'interview-1', employee_name: 'Test Employee', status: 'completed' },
      state: { phase: 'wrap_up' },
      turns: [EXISTING_TURN],
      openerText: null,
      clarificationCards: null,
      clarificationAnswers: null,
    })

    await page.goto(`/interview/${token}`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea')
    await textarea.fill('Alles klar, danke.')
    await textarea.press('Enter')

    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[role="progressbar"]')).not.toBeVisible()

    // BUG-1 regression: the FadeIn wrapper around the target screen must not
    // carry an active opacity transition under prefers-reduced-motion — a
    // real (non-zero) transitionDuration means the swap still fades instead
    // of being instant, even if `visible` flips to true immediately.
    await page.getByRole('button', { name: 'Weiter' }).click()
    const completedHeading = page.getByText('Vielen Dank! Das Interview wurde abgeschlossen.')
    await expect(completedHeading).toBeVisible({ timeout: 2000 })
    const wrapperTransition = await completedHeading.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement
      while (node && !node.className.includes('transition-opacity')) {
        node = node.parentElement
      }
      if (!node) return null
      const cs = getComputedStyle(node)
      return { transitionDuration: cs.transitionDuration, transitionProperty: cs.transitionProperty }
    })
    expect(wrapperTransition).not.toBeNull()
    expect(wrapperTransition?.transitionDuration).toBe('0s')
  })
})
