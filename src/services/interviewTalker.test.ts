import { describe, it, expect, vi, beforeEach } from 'vitest'

// interviewTalker imports getSupabaseAdmin (used inside onFinish). Mock it so the
// module loads without a live supabase env — the guard tests below are pure.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))
vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('./talkerGroundingGuard', () => ({ checkGroundingViolation: vi.fn() }))

import { generateText } from 'ai'
import { detectFillerPhrases, createTalkerStream, createOffTopicRedirectStream } from './interviewTalker'
import { checkGroundingViolation } from './talkerGroundingGuard'

// ─── detectFillerPhrases (Pt13 / F1c, output guard) ──────────────────────────

describe('detectFillerPhrases (F1c question templates)', () => {
  it('detects "Welcher Wert wäre eine grobe Schätzung"', () => {
    const fillers = detectFillerPhrases('Welcher Wert wäre eine grobe Schätzung für die Dauer?')
    expect(fillers).toContain('Welcher Wert wäre eine grobe Schätzung')
  })
  it('detects opener + question template combined', () => {
    const text = 'Verstanden, das variiert. Welcher Wert wäre eine grobe Schätzung für die Anzahl?'
    const fillers = detectFillerPhrases(text)
    expect(fillers.length).toBeGreaterThanOrEqual(2)
    expect(fillers.some(f => f.includes('Verstanden'))).toBe(true)
    expect(fillers).toContain('Welcher Wert wäre eine grobe Schätzung')
  })
  it('does not flag non-template questions', () => {
    const fillers = detectFillerPhrases('Wie genau beginnt der Prozess für dich?')
    expect(fillers).toEqual([])
  })

  it('F1d: detects "Notiere ich als variabel"', () => {
    const fillers = detectFillerPhrases('Notiere ich als variabel. Wie geht es weiter?')
    expect(fillers).toContain('Notiere ich als variabel')
  })
  it('F1d: detects "halten wir das offen"', () => {
    const fillers = detectFillerPhrases('Verstanden, halten wir das offen — gehen wir weiter zu Schritt 2.')
    expect(fillers).toContain('halten wir das offen')
    expect(fillers).toContain('gehen wir weiter zu')
  })
  it('F1d: detects "Nächster Punkt"', () => {
    const fillers = detectFillerPhrases('Notiere ich als variabel. Nächster Punkt: Wie sieht der Abschluss aus?')
    expect(fillers).toContain('Notiere ich als variabel')
    expect(fillers).toContain('Nächster Punkt')
  })
})

// ─── createTalkerStream — KI-18 grounding repair loop ────────────────────────

function baseContext() {
  return {
    interviewId: 'interview-1',
    workspaceId: 'workspace-1',
    employeeName: 'Test Mitarbeiter',
    employeeRole: null,
    department: 'IT',
    focusTopics: null,
    phase: 'intro' as const,
    timerMinutes: 0,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 60,
    stepTracker: [],
  }
}

describe('createTalkerStream — KI-18 grounding repair loop', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset()
    vi.mocked(checkGroundingViolation).mockReset()
  })

  function mockGenerated(text: string) {
    return {
      text,
      usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
      providerMetadata: {},
    } as unknown as Awaited<ReturnType<typeof generateText>>
  }

  it('guard clean beim 1. Versuch → keine Regeneration, 1x generateText', async () => {
    vi.mocked(generateText).mockResolvedValueOnce(mockGenerated('Saubere Antwort.'))
    vi.mocked(checkGroundingViolation).mockResolvedValueOnce({ violation: false })

    const stream = await createTalkerStream({ context: baseContext(), history: [] })
    const text = await stream.text

    expect(text).toBe('Saubere Antwort.')
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(checkGroundingViolation).toHaveBeenCalledTimes(1)
  })

  it('guard verletzt 1x, clean beim Repair → 1 Regeneration, 2x generateText', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce(mockGenerated('Du hast vorhin 3 Minuten erwähnt.'))
      .mockResolvedValueOnce(mockGenerated('Reparierte Antwort.'))
    vi.mocked(checkGroundingViolation)
      .mockResolvedValueOnce({ violation: true, claim: '3 Minuten', reason: 'fabriziert' })
      .mockResolvedValueOnce({ violation: false })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stream = await createTalkerStream({ context: baseContext(), history: [] })
    const text = await stream.text

    expect(text).toBe('Reparierte Antwort.')
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalledWith(
      '[talker:grounding] violation detected, regenerating',
      expect.objectContaining({ attempt: 1 }),
    )
    warnSpy.mockRestore()

    // Repair-Anweisung verbietet explizit Wiederholung des falschen Werts und
    // fordert thematische Kontinuität statt eines themenfremden Ausweich-Bailouts
    // (2026-06-30: dialogNaturalness-Regression durch "stelle eine neue Frage
    // ohne Rückbezug" bei wiederholten Repairs).
    const repairCall = vi.mocked(generateText).mock.calls[1]![0] as { system: string }
    expect(repairCall.system).toContain('3 Minuten')
    expect(repairCall.system).toContain('Verwende auf keinen Fall erneut den fehlerhaften Wert')
    expect(repairCall.system).toContain('kein Themensprung')
  })

  it('guard verletzt bei beiden Repair-Versuchen → 3x generateText, console.error mit attempts:2', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce(mockGenerated('Erster Versuch, fabriziert.'))
      .mockResolvedValueOnce(mockGenerated('Zweiter Versuch, immer noch fabriziert.'))
      .mockResolvedValueOnce(mockGenerated('Dritter Versuch (2. Repair), immer noch fabriziert.'))
    vi.mocked(checkGroundingViolation).mockResolvedValue({ violation: true, claim: 'X', reason: 'fabriziert' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stream = await createTalkerStream({ context: baseContext(), history: [] })
    const text = await stream.text

    expect(text).toBe('Dritter Versuch (2. Repair), immer noch fabriziert.')
    expect(generateText).toHaveBeenCalledTimes(3)
    expect(errorSpy).toHaveBeenCalledWith(
      '[talker:grounding] shipping after exhausting repair attempts, still flagged',
      expect.objectContaining({ attempts: 2 }),
    )
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
})

// ─── createOffTopicRedirectStream (PROJ-46 / ADR-023 D6) ─────────────────────
// Replaces the deterministic buildOffTopicRedirect fixed-text re-anchor with a
// schlanker Talker call — no buildDynamicContext, no grounding guard, no
// filler tracking, just STATIC_PROMPT + a short addendum + history.

describe('createOffTopicRedirectStream', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset()
    vi.mocked(checkGroundingViolation).mockReset()
  })

  it('makes exactly one generateText call and returns its text — no grounding guard call', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Dazu kann ich leider nichts sagen — wie sah dein Ablauf da noch mal aus?',
      usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    const stream = await createOffTopicRedirectStream({
      interviewId: 'interview-1',
      history: [{ role: 'assistant', content: 'Wie oft passiert das ungefähr pro Woche?' }],
    })
    const text = await stream.text

    expect(text).toBe('Dazu kann ich leider nichts sagen — wie sah dein Ablauf da noch mal aus?')
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(checkGroundingViolation).not.toHaveBeenCalled()
  })

  it('the system prompt includes the off-topic redirect addendum on top of STATIC_PROMPT', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Redirect.',
      usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
    } as unknown as Awaited<ReturnType<typeof generateText>>)

    await createOffTopicRedirectStream({ interviewId: 'interview-1', history: [] })

    const call = vi.mocked(generateText).mock.calls[0]![0] as { system: string }
    expect(call.system).toContain('KI-Interviewer')
    expect(call.system).toContain('fachfremde Frage')
  })
})
