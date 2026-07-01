import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))

import { generateText } from 'ai'
import { parseGuardResponse, checkGroundingViolation } from './talkerGroundingGuard'
import type { TurnMessage } from './interviewTypes'

// ─── Parser Tests ───────────────────────────────────────────────────────────────

describe('parseGuardResponse', () => {
  it('violation: true wird korrekt geparst', () => {
    const result = parseGuardResponse('{"violation": true, "claim": "3 Minuten", "reason": "Mitarbeiter wich aus"}')
    expect(result.violation).toBe(true)
    expect(result.claim).toBe('3 Minuten')
  })

  it('violation: false wird korrekt geparst', () => {
    const result = parseGuardResponse('{"violation": false}')
    expect(result.violation).toBe(false)
  })

  it('JSON in Markdown-Fence wird geparst', () => {
    const result = parseGuardResponse('```json\n{"violation": false}\n```')
    expect(result.violation).toBe(false)
  })

  it('unbekanntes Format → violation:false + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseGuardResponse('keine JSON-Antwort')
    expect(result.violation).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith('[talkerGroundingGuard] unexpected judge format, fallback no-violation')
    warnSpy.mockRestore()
  })

  it('abgeschnittenes JSON (maxOutputTokens-Cutoff) → violation wird per Partial-Parse gerettet', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // reason wurde mitten im Satz abgeschnitten, keine schließende Klammer.
    const truncated = '{"violation": true, "claim": "Du hast vorhin gesagt, dass es kein Problem gibt", "reason": "Mitarbeiter sagte nur eine Höflichkeitsfloskel, keine inhaltliche Aussage über Probl'
    const result = parseGuardResponse(truncated)
    expect(result.violation).toBe(true)
    expect(result.claim).toBe('Du hast vorhin gesagt, dass es kein Problem gibt')
    expect(warnSpy).toHaveBeenCalledWith(
      '[talkerGroundingGuard] truncated/malformed judge JSON, recovered violation flag via partial parse',
    )
    warnSpy.mockRestore()
  })

  it('trailing text with braces does not break extraction', () => {
    const result = parseGuardResponse('{"violation": false} Note: {irrelevant}')
    expect(result.violation).toBe(false)
  })
})

// ─── checkGroundingViolation ────────────────────────────────────────────────────

describe('checkGroundingViolation', () => {
  it('keine History → false ohne Judge-Call', async () => {
    const result = await checkGroundingViolation('Wie geht es weiter?', [], 'google/gemini-3.1-flash-lite')
    expect(result.violation).toBe(false)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('reproduziert KI-18 Run 1 Turn 7: Ausweichen wird als konkreter Wert fabriziert', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValueOnce({
      text: '{"violation": true, "claim": "3 Minuten", "reason": "Mitarbeiter wich auf Zeitfrage aus, nannte nie eine Minutenzahl"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const priorTurns: TurnMessage[] = [
      { role: 'user', content: '3 bis 5 Hardware-Tausche wöchentlich. Zeitaufwand? Kommt drauf an.' },
    ]
    const candidateText =
      'Du hast vorhin 3 bis 5 Tausche pro Woche erwähnt – jetzt klang es so, als würde der Prozess 3 Minuten dauern.'

    const result = await checkGroundingViolation(candidateText, priorTurns, 'google/gemini-3.1-flash-lite')
    expect(result.violation).toBe(true)
    expect(result.claim).toContain('3 Minuten')
  })

  it('reproduziert KI-18 Run 2 Turn 14: Mengenangabe wird zu Standard-Behauptung umgedeutet', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValueOnce({
      text: '{"violation": true, "claim": "als Standard beschrieben", "reason": "Mitarbeiter nannte nur eine Häufigkeit, keine Standardaussage"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const priorTurns: TurnMessage[] = [
      { role: 'user', content: 'Im Schnitt dreifacher Wechsel zwischen Jira, Remote Desktop und Wiki.' },
    ]
    const candidateText = 'Du hast vorhin den Wechsel zwischen Jira, Remote Desktop und Wiki als Standard beschrieben'

    const result = await checkGroundingViolation(candidateText, priorTurns, 'google/gemini-3.1-flash-lite')
    expect(result.violation).toBe(true)
    expect(result.claim).toContain('Standard')
  })

  it('reproduziert KI-18 2026-06-30 Run1: Wortwahl fälschlich als bereits gesagt zugeschrieben', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValueOnce({
      text: '{"violation": true, "claim": "Du hast vorhin gesagt, eine pauschale Zeitangabe sei unmöglich", "reason": "Mitarbeiter benutzte das Wort unmöglich erst im aktuellen Turn"}',
    } as Awaited<ReturnType<typeof generateText>>)

    const priorTurns: TurnMessage[] = [
      { role: 'user', content: 'Kommt drauf an. Kann ich keine pauschale Zeitangabe machen. Hängt vom Einzelfall ab.' },
      { role: 'user', content: 'Pauschale Dauer unmöglich.' },
    ]
    const candidateText =
      'Du hast vorhin gesagt, eine pauschale Zeitangabe sei unmöglich, und jetzt sprichst du wieder davon, dass sie nicht machbar ist.'

    const result = await checkGroundingViolation(candidateText, priorTurns, 'google/gemini-3.1-flash-lite')
    expect(result.violation).toBe(true)
    expect(result.claim).toContain('unmöglich')
  })

  it('Judge-Call schlägt fehl → false statt throw', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockRejectedValueOnce(new Error('API down'))

    const priorTurns: TurnMessage[] = [{ role: 'user', content: 'a' }]
    const result = await checkGroundingViolation('b', priorTurns, 'google/gemini-3.1-flash-lite')
    expect(result.violation).toBe(false)
  })
})

// ─── Prompt-Content-Test (KI-9-Lehre: auf Gesendetes prüfen, nicht nur Mock-Output) ──

describe('checkGroundingViolation — Prompt-Inhalt', () => {
  it('sendet History und Kandidatentext im Prompt, History vor Kandidat', async () => {
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValueOnce({ text: '{"violation": false}' } as Awaited<ReturnType<typeof generateText>>)

    const priorTurns: TurnMessage[] = [{ role: 'user', content: 'HISTORYINHALT_EINS' }]
    const candidateText = 'KANDIDATTEXT_ZWEI'

    await checkGroundingViolation(candidateText, priorTurns, 'google/gemini-3.1-flash-lite')

    const lastCall = mockGenerateText.mock.calls.at(-1)![0] as { prompt: string }
    const prompt = lastCall.prompt
    expect(prompt).toContain('HISTORYINHALT_EINS')
    expect(prompt).toContain('KANDIDATTEXT_ZWEI')
    expect(prompt.indexOf('HISTORYINHALT_EINS')).toBeLessThan(prompt.indexOf('KANDIDATTEXT_ZWEI'))
  })
})
