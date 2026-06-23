import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { generateText } from 'ai'
import { parseGroundingResponse, scoreTalkerFactualGrounding } from './talkerFactualGrounding'
import type { TurnRecord } from './types'

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
})

// ─── scoreTalkerFactualGrounding ────────────────────────────────────────────────

describe('scoreTalkerFactualGrounding', () => {
  it('Turn 1 (keine Vorgeschichte) → 0 ohne Judge-Call', async () => {
    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'Ich bearbeite Rechnungen.', agentText: 'Hallo, was sind deine Aufgaben?', phase: 'intro', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(0)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('reproduziert KI-9: erfundene Zahlen-Prämisse wird als Verletzung erkannt', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValueOnce({
      text: '{"violations": [{"turn": 13, "claim": "Du hast vorhin 1200 Minuten erwähnt", "reason": "Persona nannte nur 2-3 Tage für den Monatsabschluss, nie eine Minutenzahl für die Rechnungsprüfung"}]}',
    } as Awaited<ReturnType<typeof generateText>>)

    const turns: TurnRecord[] = [
      { turnNumber: 5, userInput: 'Der Monatsabschluss dauert zwei bis drei Tage.', agentText: 'Wie lange dauert der Monatsabschluss?', phase: 'walkthrough_step', toolCalls: [] },
      { turnNumber: 13, userInput: 'Da muss ein Missverständnis vorliegen, ich habe keine Minutenzahl genannt.', agentText: 'Du hast vorhin 1200 Minuten erwähnt — jetzt sagst du 5. Was ist der Unterschied?', phase: 'walkthrough_step', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(1)
    expect(result.rationale).toContain('1200 Minuten')
  })

  it('Judge-Call schlägt fehl → 0 statt throw', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockRejectedValueOnce(new Error('API down'))

    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'a', agentText: 'b', phase: 'intro', toolCalls: [] },
      { turnNumber: 2, userInput: 'c', agentText: 'd', phase: 'intro', toolCalls: [] },
    ]
    const result = await scoreTalkerFactualGrounding(turns, 'google/gemini-3.5-flash')
    expect(result.violations).toBe(0)
  })
})
