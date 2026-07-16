import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({ generateObject: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { generateObject } from 'ai'
import { parseGroundingResponse, scoreTalkerFactualGrounding } from './talkerFactualGrounding'
import type { TurnRecord } from './types'

// generateObject-Mock-Helfer: liefert { object, usage } wie das SDK (structured output, PROJ-40 D).
const asObj = (violations: Array<{ turn: number; claim: string; reason: string }>) =>
  ({ object: { violations }, usage: { inputTokens: 0, outputTokens: 0 } } as unknown as Awaited<ReturnType<typeof generateObject>>)

// ─── Parser Tests ───────────────────────────────────────────────────────────────

describe('parseGroundingResponse', () => {
  it('keine Verletzungen → 0', () => {
    const result = parseGroundingResponse('{"violations": []}')
    expect(result.violations).toBe(0)
    expect(result.rationale).toBe('')
  })

  it('eine Verletzung wird gezählt und in der Rationale aufgeführt', () => {
    const result = parseGroundingResponse(
      '{"violations": [{"turn": 13, "claim": "Du hast vorhin 1200 Minuten erwähnt", "reason": "Persona nannte nie eine Minutenzahl"}]}',
    )
    expect(result.violations).toBe(1)
    expect(result.rationale).toContain('Turn 13')
    expect(result.rationale).toContain('1200 Minuten')
  })

  it('mehrere Verletzungen werden korrekt gezählt', () => {
    const result = parseGroundingResponse(
      '{"violations": [{"turn": 3, "claim": "a", "reason": "x"}, {"turn": 7, "claim": "b", "reason": "y"}]}',
    )
    expect(result.violations).toBe(2)
  })

  it('JSON in Markdown-Fence wird geparst', () => {
    const result = parseGroundingResponse('```json\n{"violations": []}\n```')
    expect(result.violations).toBe(0)
  })

  it('unbekanntes Format → 0 + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseGroundingResponse('keine JSON-Antwort')
    expect(result.violations).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith('[talkerFactualGrounding] unexpected judge format, fallback 0')
    warnSpy.mockRestore()
  })

  it('trailing text with braces does not break extraction', () => {
    const result = parseGroundingResponse(
      '{"violations": []} Note: interview_guide {section 3} had no issues.',
    )
    expect(result.violations).toBe(0)
  })
})

// ─── scoreTalkerFactualGrounding ────────────────────────────────────────────────

describe('scoreTalkerFactualGrounding', () => {
  it('Turn 1 (keine Vorgeschichte) → 0 ohne Judge-Call', async () => {
    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'Ich bearbeite Rechnungen.', agentText: 'Hallo, was sind deine Aufgaben?', phase: 'intro', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(0)
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('reproduziert KI-9: erfundene Zahlen-Prämisse wird als Verletzung erkannt', async () => {
    const mockGenerateObject = vi.mocked(generateObject)
    mockGenerateObject.mockResolvedValueOnce(asObj([
      { turn: 13, claim: 'Du hast vorhin 1200 Minuten erwähnt', reason: 'Persona nannte nur 2-3 Tage für den Monatsabschluss, nie eine Minutenzahl für die Rechnungsprüfung' },
    ]))

    const turns: TurnRecord[] = [
      { turnNumber: 5, userInput: 'Der Monatsabschluss dauert zwei bis drei Tage.', agentText: 'Wie lange dauert der Monatsabschluss?', phase: 'explore', toolCalls: [] },
      { turnNumber: 13, userInput: 'Da muss ein Missverständnis vorliegen, ich habe keine Minutenzahl genannt.', agentText: 'Du hast vorhin 1200 Minuten erwähnt — jetzt sagst du 5. Was ist der Unterschied?', phase: 'explore', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(1)
    expect(result.rationale).toContain('1200 Minuten')
  })

  it('Judge-Call schlägt fehl → 0 statt throw, parseFailed markiert', async () => {
    const mockGenerateObject = vi.mocked(generateObject)
    mockGenerateObject.mockRejectedValueOnce(new Error('API down'))

    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'a', agentText: 'b', phase: 'intro', toolCalls: [] },
      { turnNumber: 2, userInput: 'c', agentText: 'd', phase: 'intro', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(0)
    expect(result.parseFailed).toBe(true)
  })
})

// ─── Prompt-Content-Test (2026-06-24 audit) ─────────────────────────────────────
//
// KI-9's real bug was in the transcript-ORDER built into the prompt (Agent-then-
// Mitarbeiter instead of the true causal Mitarbeiter-then-Agent), not in the parser.
// 8 mock-only tests above never caught it because they only assert on the judge's
// (mocked) RETURN value, never on what was actually SENT. This test would have
// caught it without a single live LLM call.

describe('scoreTalkerFactualGrounding — Prompt-Inhalt (würde den KI-9-Bug fangen)', () => {
  it('baut das Transkript in Mitarbeiter→Agent-Reihenfolge je Turn (Kausalreihenfolge)', async () => {
    const mockGenerateObject = vi.mocked(generateObject)
    mockGenerateObject.mockResolvedValueOnce(asObj([]))

    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'USERINPUT_EINS', agentText: 'AGENTTEXT_EINS', phase: 'intro', toolCalls: [] },
      { turnNumber: 2, userInput: 'USERINPUT_ZWEI', agentText: 'AGENTTEXT_ZWEI', phase: 'intro', toolCalls: [] },
    ]
    await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')

    const lastCall = mockGenerateObject.mock.calls.at(-1)![0] as { prompt: string }
    const prompt = lastCall.prompt

    // Innerhalb jedes Turns muss Mitarbeiter VOR Agent erscheinen — Agent (Turn N)
    // reagiert auf Mitarbeiter (Turn N), nicht umgekehrt. Verdreht sähe eine
    // legitime Same-Turn-Referenz für den Judge wie eine vorausschauende Erfindung aus.
    expect(prompt.indexOf('USERINPUT_EINS')).toBeLessThan(prompt.indexOf('AGENTTEXT_EINS'))
    expect(prompt.indexOf('USERINPUT_ZWEI')).toBeLessThan(prompt.indexOf('AGENTTEXT_ZWEI'))
    // Turn-Reihenfolge muss chronologisch bleiben (Turn 1 komplett vor Turn 2).
    expect(prompt.indexOf('AGENTTEXT_EINS')).toBeLessThan(prompt.indexOf('USERINPUT_ZWEI'))
  })
})
