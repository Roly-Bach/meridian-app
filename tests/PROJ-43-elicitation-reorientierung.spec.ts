import { test, expect } from '@playwright/test'
import { createClarificationFixtureInterview, deleteClarificationFixtureInterview } from './helpers/createClarificationFixture'

// ── PROJ-43: Elicitation-Reorientierung — E2E Tests ────────────────────────────
// AC3: two-way SlotCard input (bucket buttons + free-text), direction-tailored
// buckets (AC2). Not eval-testable (the synthetic eval runner doesn't drive real
// clicks) — this is the permanent regression coverage for the manual UI walkthrough
// required by the PROJ-43 spec before Approved.
// ────────────────────────────────────────────────────────────────────────────

let token: string
let interviewId: string

test.beforeAll(async () => {
  const fixture = await createClarificationFixtureInterview()
  token = fixture.token
  interviewId = fixture.interviewId
})

test.afterAll(async () => {
  if (interviewId) await deleteClarificationFixtureInterview(interviewId)
})

test.describe('ClarificationView — two-way SlotCard UI (AC2/AC3/AC4)', () => {
  test('renders direction-tailored buckets, accepts free-text and bucket answers, gates submit, persists correctly', async ({ page }) => {
    await page.goto(`/interview/${token}`)
    await expect(page.getByText('Rechnungsprüfung').first()).toBeVisible({ timeout: 10000 })

    // AC2: frequency card captured direction='hoch' → renders the "hoch" bucket variant
    const freqCard = page.locator('.border').filter({ hasText: 'Wie oft kommt dieser Schritt vor?' }).first()
    await expect(freqCard.getByRole('button', { name: 'Mehrmals täglich' })).toBeVisible()
    await expect(freqCard.getByRole('button', { name: 'Monatlich' })).toHaveCount(0) // default/niedrig-only label

    // AC2: duration card captured direction='niedrig' → renders fine-grained low-range buckets
    const durCard = page.locator('.border').filter({ hasText: 'Wie lange dauert eine einzelne Durchführung?' }).first()
    await expect(durCard.getByRole('button', { name: '< 1 Min' })).toBeVisible()

    // no captured direction → generic bucket set
    const errCard = page.locator('.border').filter({ hasText: 'Wie häufig treten dabei Fehler oder Korrekturen auf?' }).first()
    await expect(errCard.getByRole('button', { name: 'Selten Fehler' })).toBeVisible()

    // entscheidungslogik is not a numeric slot (AC3 scope) — no free-text field
    const decCard = page.locator('.border').filter({ hasText: 'Wie ist die Entscheidungslogik?' }).first()
    await expect(decCard.getByRole('button', { name: 'Immer gleich' })).toBeVisible()
    await expect(decCard.getByPlaceholder(/Eigene Zahl/)).toHaveCount(0)

    const submitBtn = page.getByRole('button', { name: 'Weiter' })
    await expect(submitBtn).toBeDisabled()

    // AC3: bucket-button path
    await freqCard.getByRole('button', { name: 'Mehrmals täglich' }).click()

    // AC3(a): free-text path, equal-weight alternative to buckets
    await durCard.getByPlaceholder(/Eigene Zahl/).fill('7-9')
    await durCard.getByRole('button', { name: 'Übernehmen' }).click()

    // AC4: "Weiß ich nicht" still resolves the gate (not a silent no-op)
    await errCard.getByRole('button', { name: 'Weiß ich nicht' }).click()
    await expect(submitBtn).toBeDisabled() // decCard still unanswered

    await decCard.getByRole('button', { name: 'Immer gleich' }).click()
    await expect(submitBtn).toBeEnabled()

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/clarification') && r.request().method() === 'POST'),
      submitBtn.click(),
    ])
    expect(response.status()).toBe(200)
  })
})
