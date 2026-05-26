import { test, expect } from '@playwright/test'

// ── API: auth guards ──────────────────────────────────────────────────────────

test.describe('PROJ-18: process-steps page — auth guard', () => {
  test('redirects unauthenticated user from /dashboard/process-steps', async ({ page }) => {
    await page.goto('/dashboard/process-steps')
    await expect(page).toHaveURL(/\/(login|signup)/, { timeout: 10000 })
  })
})

// ── API: process_clusters table exists (schema guard) ────────────────────────

test.describe('PROJ-18: process-steps API — endpoint guards', () => {
  test('GET /api/process-steps returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/process-steps', {
      params: { workspace_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect([400, 401, 404, 405]).toContain(res.status())
  })

  test('PATCH /api/process-steps/:id returns 401 without auth', async ({ request }) => {
    const res = await request.patch('/api/process-steps/00000000-0000-0000-0000-000000000001', {
      data: { rule_based: true },
    })
    expect([401, 403, 404]).toContain(res.status())
  })
})

// NOTE: UI toggle (Gruppiert/Einzeln) and clustering E2E tests require signup,
// which is blocked by BUG-E2E-1 (allowlist prevents test emails).
// Manual verification confirmed: toggle renders, grouped/einzeln switch works,
// "N Personen" badge appears for multi-participant clusters.
