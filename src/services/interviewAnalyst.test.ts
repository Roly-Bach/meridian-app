import { describe, it, expect, vi } from 'vitest'

// interviewAnalyst.ts imports getSupabaseAdmin (server-only chain) for its DB fallback
// path — buildAnalystSystemPrompt itself is pure, but the module can't load in a test
// environment without this mock. Same technique as runInterviewTurn.test.ts.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn(),
}))

import { buildAnalystSystemPrompt, computeNextBriefing } from './interviewAnalyst'
import type { InterviewContext, AnalystBriefing } from './interviewTypes'

function baseContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    interviewId: 'interview-1',
    workspaceId: 'workspace-1',
    employeeName: 'Test Mitarbeiter',
    employeeRole: null,
    department: 'IT',
    focusTopics: null,
    phase: 'explore',
    timerMinutes: 0,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 60,
    stepTracker: [],
    ...overrides,
  }
}

function step(overrides: Record<string, unknown> = {}) {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    status: 'walkthrough',
    reihenfolge: 1,
    potenzial: {
      frequency_per_month: null,
      duration_minutes: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    slots: {
      entscheidungslogik: null,
      tazite_cues: null,
      ausnahmen: null,
      inputs: null,
      outputs: null,
      hilfsmittel: null,
    },
    governance: null,
    abhaengigkeiten: null,
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

// ─── WP5 regression: STUFE-0-4 instructional block is a stable, cache-eligible prefix ──
// Root cause (2026-07-14 design round): stepIdList/activeStepLine used to be injected
// right after the intro, before the entire STUFE-0-4 tool-priority block (~49.6% of the
// Analyst's raw input per the token measurement in curried-plotting-narwhal.md) — breaking
// Gemini's implicit-caching prefix on every single turn, since both values change whenever
// a step is registered or the active step shifts. Moved both into the existing "Aktueller
// Kontext" footer (same pattern ADR-009 D2 already established for the Talker), so the
// STUFE-0-4/tool-schema block becomes byte-identical across turns regardless of step-tracker
// state — the actual cache-hit precondition. buildCatchupSystemPrompt is unaffected (its
// dynamic values already lived in the footer) and needs no test here.

describe('interviewAnalyst — WP5 system-prompt prefix stability', () => {
  it('the STUFE-0-4 / tool-priority block is a byte-identical prefix regardless of step-tracker state', () => {
    const promptEmpty = buildAnalystSystemPrompt(baseContext({ stepTracker: [] }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promptWithSteps = buildAnalystSystemPrompt(baseContext({ stepTracker: [step()] as any }))

    let i = 0
    while (
      i < promptEmpty.length &&
      i < promptWithSteps.length &&
      promptEmpty[i] === promptWithSteps[i]
    ) {
      i++
    }

    // The Halluzinations-Guard section sits right before "## Aktueller Kontext" — if the
    // shared prefix reaches past it, the entire STUFE-0-4 block + Clarification-Cards +
    // Halluzinations-Guard sections are confirmed byte-identical.
    const marker = '## Halluzinations-Guard'
    const markerIndex = promptEmpty.indexOf(marker)
    expect(markerIndex).toBeGreaterThan(0)
    expect(i).toBeGreaterThan(markerIndex + marker.length)

    // Sanity: the prompts still differ somewhere (the footer) — this isn't a no-op change.
    expect(promptEmpty).not.toEqual(promptWithSteps)
  })

  it('stepIdList / "Schritt-IDs" only appears in the "Aktueller Kontext" footer, not earlier', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompt = buildAnalystSystemPrompt(baseContext({ stepTracker: [step()] as any }))
    const footerIndex = prompt.indexOf('## Aktueller Kontext')
    expect(footerIndex).toBeGreaterThan(0)
    const beforeFooter = prompt.slice(0, footerIndex)
    // The actual ID-list rendering (the part that changes whenever a step is registered)
    // must only appear in the footer — a forward-reference mention of the term itself
    // earlier in the prompt is fine, the rendered list content is what must not leak.
    expect(beforeFooter).not.toMatch(/S001: "Rechnungsprüfung"/)
    expect(prompt.slice(footerIndex)).toMatch(/Schritt-IDs \(nutze step_id/)
    expect(prompt.slice(footerIndex)).toMatch(/S001: "Rechnungsprüfung"/)
  })

  it('online mode prefix is still applied before the stable block (mode is constant per call-site, not per-turn)', () => {
    const prompt = buildAnalystSystemPrompt(baseContext({ stepTracker: [] }), 'online')
    expect(prompt).toMatch(/^ONLINE-MODUS/)
  })
})

// ─── PROJ-42: computeNextBriefing — deterministic No-New-Extraction-Zähler ───────
// This is the code-computed (not LLM-guessed) bridging logic behind the safety-net
// counter interviewOrchestrator.ts reads to escalate Explore → Closing when a
// conversation stalls. Extracted as a pure function so the bridging semantics are
// testable without mocking generateText/turnStore.

const emptyBriefing: AnalystBriefing = { next_focus: '', suggested_question: '' }

describe('computeNextBriefing — PROJ-42 deterministic streak', () => {
  it('resets the streak to 0 when a knowledge tool was called this pass', () => {
    const result = computeNextBriefing(
      { next_focus: 'X', suggested_question: 'Y' },
      true,
      [{ toolName: 'record_slot', args: {} }],
      { next_focus: 'old', suggested_question: 'old', noNewExtractionStreak: 2 },
    )
    expect(result.noNewExtractionStreak).toBe(0)
  })

  it('increments the streak when no knowledge tool was called this pass', () => {
    const result = computeNextBriefing(
      emptyBriefing,
      true,
      [{ toolName: 'update_topics', args: {} }], // bookkeeping only — not an extraction tool
      { next_focus: 'old', suggested_question: 'old', noNewExtractionStreak: 2 },
    )
    expect(result.noNewExtractionStreak).toBe(3)
  })

  it('starts the streak at 1 when there is no previous briefing', () => {
    const result = computeNextBriefing(emptyBriefing, true, [], null)
    expect(result.noNewExtractionStreak).toBe(1)
  })

  it('keeps the model-authored next_focus/suggested_question when produce_briefing was called', () => {
    const result = computeNextBriefing(
      { next_focus: 'neuer Fokus', suggested_question: 'Neue Frage?' },
      true,
      [{ toolName: 'record_slot', args: {} }],
      { next_focus: 'alt', suggested_question: 'Alte Frage?' },
    )
    expect(result.next_focus).toBe('neuer Fokus')
    expect(result.suggested_question).toBe('Neue Frage?')
  })

  it('carries the previous briefing forward unchanged (besides the streak) when produce_briefing was NOT called', () => {
    // The analyst prompt's own instruction: skip produce_briefing on a turn with
    // no substantial change — "das vorherige next_briefing bleibt gültig".
    const previous: AnalystBriefing = { next_focus: 'alt', suggested_question: 'Alte Frage?', clarification_cards: [] }
    const result = computeNextBriefing(emptyBriefing, false, [], previous)
    expect(result.next_focus).toBe('alt')
    expect(result.suggested_question).toBe('Alte Frage?')
    expect(result.noNewExtractionStreak).toBe(1)
  })

  it('falls back to an empty briefing (not a crash) when produce_briefing was not called and there is no previous briefing', () => {
    const result = computeNextBriefing(emptyBriefing, false, [], null)
    expect(result.next_focus).toBe('')
    expect(result.suggested_question).toBe('')
    expect(result.noNewExtractionStreak).toBe(1)
  })
})
