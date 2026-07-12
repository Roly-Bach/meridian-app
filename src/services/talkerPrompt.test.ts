import { describe, it, expect } from 'vitest'
import { buildDynamicContext, STATIC_PROMPT } from './talkerPrompt'
import type { InterviewContext } from './interviewTypes'

function baseContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    interviewId: 'interview-1',
    workspaceId: 'workspace-1',
    employeeName: 'Test Mitarbeiter',
    employeeRole: null,
    department: 'IT',
    focusTopics: null,
    phase: 'walkthrough_step',
    timerMinutes: 0,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 60,
    stepTracker: [],
    ...overrides,
  }
}

// ─── KI-20 regression: tool-call syntax must never appear as literal prompt text ──
// Root cause (2026-07-11): the walkthrough_step few-shot example used to show the
// tool call as bracket/parameter pseudo-code ("AGENT: [ruft update_walkthrough_data(...)
// auf]"). Models across vendors (confirmed: google/gemini-3.1-flash-lite,
// google/gemini-3.5-flash, openrouter/minimax/minimax-m3) sometimes imitated that
// notation literally as visible output instead of making a structured tool call —
// 11 of 14 historically affected transcripts were on the demo baseline, not OSS
// models. These tests guard against reintroducing that pattern.

describe('talkerPrompt — KI-20 tool-call leakage regression', () => {
  it('walkthrough_step dynamic context contains no bracket-wrapped tool-call pseudo-code', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'walkthrough_step' }))
    expect(ctx).not.toMatch(/\[ruft\s/)
    expect(ctx).not.toMatch(/AGENT:\s*\[/)
    // no "toolName(" style call syntax anywhere in the rendered prompt
    expect(ctx).not.toMatch(/update_walkthrough_data\(/)
  })

  it('walkthrough_step example explicitly marks the tool call as silent/never-visible-text', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'walkthrough_step' }))
    expect(ctx).toMatch(/lautlos, NIEMALS als Text ausgeben/)
  })

  it('STATIC_PROMPT forbids emitting tool-call/bracket syntax in the visible answer', () => {
    expect(STATIC_PROMPT).toMatch(/eckige Klammern/)
    expect(STATIC_PROMPT).toMatch(/Tool-Aufrufe sind ausschließlich strukturierte Calls/)
  })

  it('other phases do not inject the walkthrough few-shot example at all', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'slot_completion' }))
    expect(ctx).not.toMatch(/EXAMPLE phase="walkthrough_step"/)
  })
})

// ─── KI-19 regression: scripted farewell turn must not re-ask the wrap-up probe ───
// Root cause (2026-07-11): the completion/farewell call (runInterviewTurn.ts, after
// checkLifecycle already decided shouldComplete=true) passed phase='wrap_up' into
// createTalkerStream like any normal turn, so it inherited the unconditional PFLICHT
// "ask the wrap-up question first" methodology text — which routinely beat the softer
// advisory farewellBriefing and made the model re-ask a question instead of saying
// goodbye. Confirmed on 36/82 (44%) historical gemini-3.1-flash-lite transcripts.

describe('talkerPrompt — KI-19 farewell methodology regression', () => {
  it('normal wrap_up turn (isCompletionFarewell unset) still gets the PFLICHT ask-first instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'wrap_up' }))
    expect(ctx).toMatch(/PFLICHT: Stelle als allererste Antwort/)
    expect(ctx).toMatch(/Wenn du an deine letzte Arbeitswoche denkst/)
  })

  it('scripted completion farewell (isCompletionFarewell=true) suppresses the ask-first instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'wrap_up', isCompletionFarewell: true }))
    expect(ctx).not.toMatch(/PFLICHT: Stelle als allererste Antwort/)
    expect(ctx).not.toMatch(/Wenn du an deine letzte Arbeitswoche denkst/)
    expect(ctx).toMatch(/Verabschiede dich jetzt kurz und herzlich/)
    expect(ctx).toMatch(/KEINE weitere Frage/)
  })
})
