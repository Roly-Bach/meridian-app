import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn(), generateObject: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { generateObject } from 'ai'
import { parseJudgeResponse, scoreDialogNaturalness } from './dialogNaturalness'
import type { TurnRecord } from './types'

// generateObject-Mock-Helfer: Hauptpfad (isolatedCriteria=false) nutzt structured output (PROJ-40 D).
const asDialogObj = (stufe: number, begruendung = 'ok') =>
  ({ object: { stufe, begruendung }, usage: { inputTokens: 0, outputTokens: 0 } } as unknown as Awaited<ReturnType<typeof generateObject>>)

// ─── Parser Tests ─────────────────────────────────────────────────────────────

describe('parseJudgeResponse — Stufe mapping', () => {
  it('Stufe: 1 → 0.33', () => {
    const result = parseJudgeResponse('Die Texte wirken sehr generisch und verwenden viele Floskeln.\n\nStufe: 1')
    expect(result.score).toBe(0.33)
  })

  it('Stufe: 2 → 0.67', () => {
    const result = parseJudgeResponse('Überwiegend natürliche Sprache mit vereinzelten Mängeln.\n\nStufe: 2')
    expect(result.score).toBe(0.67)
  })

  it('Stufe: 3 → 1.00', () => {
    const result = parseJudgeResponse('Durchgehend exzellente Qualität, keine Floskeln, konsequente Du-Form.\n\nStufe: 3')
    expect(result.score).toBe(1.0)
  })

  it('unbekanntes Format → 0.5 + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseJudgeResponse('Keine Stufenangabe vorhanden.')
    expect(result.score).toBe(0.5)
    expect(warnSpy).toHaveBeenCalledWith('[dialogNaturalness] unexpected format, fallback 0.5')
    warnSpy.mockRestore()
  })

  it('leerer String → 0.5 + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseJudgeResponse('')
    expect(result.score).toBe(0.5)
    expect(warnSpy).toHaveBeenCalledWith('[dialogNaturalness] unexpected format, fallback 0.5')
    warnSpy.mockRestore()
  })
})

describe('parseJudgeResponse — JSON-Format (Primärpfad, PROJ-31)', () => {
  it('{"stufe": 2} → 0.67 (kein console.warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseJudgeResponse('{"stufe": 2, "begruendung": "Überwiegend natürliche Sprache."}')
    expect(result.score).toBe(0.67)
    expect(result.rationale).toBe('Überwiegend natürliche Sprache.')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('{"stufe": 1} → 0.33', () => {
    const result = parseJudgeResponse('{"stufe": 1, "begruendung": "Viele Floskeln."}')
    expect(result.score).toBe(0.33)
  })

  it('{"stufe": 3} → 1.0', () => {
    const result = parseJudgeResponse('{"stufe": 3, "begruendung": "Exzellent."}')
    expect(result.score).toBe(1.0)
  })

  it('JSON in Markdown-Fence wird geparst', () => {
    const result = parseJudgeResponse('```json\n{"stufe": 2, "begruendung": "Angemessen."}\n```')
    expect(result.score).toBe(0.67)
  })

  it('Stufe 4/5 (clamped) → 1.0', () => {
    const result = parseJudgeResponse('{"stufe": 5, "begruendung": "Sehr gut."}')
    expect(result.score).toBe(1.0)
  })

  it('Fallback auf Regex wenn kein JSON: "Stufe: 2" → 0.67', () => {
    const result = parseJudgeResponse('Überwiegend natürliche Sprache.\n\nStufe: 2')
    expect(result.score).toBe(0.67)
  })
})

describe('parseJudgeResponse — Markdown-toleranz', () => {
  it('bold Stufe: **Stufe: 2** → 0.67', () => {
    const result = parseJudgeResponse('Die Texte sind angemessen.\n\n**Stufe: 2**')
    expect(result.score).toBe(0.67)
  })

  it('extra Leerzeichen: "Stufe:  3" → 1.0', () => {
    const result = parseJudgeResponse('Exzellent.\nStufe:  3')
    expect(result.score).toBe(1.0)
  })

  it('Großschreibung: "STUFE: 1" → 0.33', () => {
    const result = parseJudgeResponse('Floskeln erkannt.\nSTUFE: 1')
    expect(result.score).toBe(0.33)
  })
})

describe('parseJudgeResponse — letztes Vorkommen', () => {
  it('nimmt das letzte Stufe-Vorkommen wenn mehrere vorhanden', () => {
    const text = 'Anfangs Stufe: 1 erkennbar, aber insgesamt verbessert sich die Qualität.\n\nStufe: 2'
    const result = parseJudgeResponse(text)
    // Should pick the last: Stufe 2 → 0.67
    expect(result.score).toBe(0.67)
  })
})

describe('parseJudgeResponse — Rationale-Extraktion', () => {
  it('Rationale ist alles vor dem letzten Stufe-Marker', () => {
    const begründung = 'Die Texte wirken natürlich und konsistent.'
    const text = `${begründung}\n\nStufe: 3`
    const result = parseJudgeResponse(text)
    expect(result.rationale).toBe(begründung)
  })

  it('Rationale ist leer wenn Stufe direkt am Anfang steht', () => {
    const result = parseJudgeResponse('Stufe: 2')
    expect(result.rationale).toBe('')
  })
})

// ─── Positions-Swap-Test ──────────────────────────────────────────────────────
//
// Integration-Test für echten Positions-Swap benötigt API-Keys (key-gated).
// Dieser Unit-Test verifiziert, dass die Parser-Logik symmetrisch ist:
// Egal in welcher Reihenfolge Turns im Transcript stehen, wenn der Judge
// dieselbe Stufe ausgibt, liefert der Parser dasselbe Ergebnis.

describe('parseJudgeResponse — Positions-Swap-Invarianz', () => {
  it('Parser liefert dasselbe Ergebnis unabhängig von Transcript-Reihenfolge (wenn Judge-Output gleich)', () => {
    const transcript1 = ['Hallo Andreas.', 'Erzähl mir mehr.', 'Danke, das ist hilfreich.']
    const transcript2 = [...transcript1].reverse()

    // Simulierter Judge-Output für beide Reihenfolgen (identisch weil gemockt)
    const judgeOutput = 'Durchgehend natürliche Sprache, konsistente Du-Form, keine Floskeln.\n\nStufe: 3'

    // Beide sollen identisch geparst werden
    const result1 = parseJudgeResponse(judgeOutput)
    const result2 = parseJudgeResponse(judgeOutput)

    expect(result1.score).toBe(result2.score)
    expect(result1.score).toBe(1.0)

    // Verify that both transcripts are genuinely different
    expect(transcript1[0]).not.toBe(transcript2[0])
  })
})

// ─── Prompt-Content-Tests: Sample-Auswahl (2026-06-24 audit) ────────────────────
//
// Bisherige Tests prüfen nur den geparsten RÜCKGABEWERT des (gemockten) Judges,
// nie WAS tatsächlich an ihn geschickt wird. Das hätte einen KI-9-artigen Bug in
// der Sample-Auswahl (off-by-one, Duplikat, Out-of-Bounds bei wenigen Turns) nie
// gefangen. Diese Tests prüfen den Prompt-Inhalt direkt.

function makeTurns(n: number): TurnRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    turnNumber: i + 1,
    userInput: `USERINPUT_${i + 1}`,
    agentText: `AGENTTEXT_${i + 1}`,
    phase: 'intro' as const,
    toolCalls: [],
  }))
}

async function capturePrompt(turns: TurnRecord[]): Promise<string> {
  const mockGenerateObject = vi.mocked(generateObject)
  mockGenerateObject.mockResolvedValueOnce(asDialogObj(2))
  await scoreDialogNaturalness(turns, 'google/gemini-3.5-flash', false)
  const lastCall = mockGenerateObject.mock.calls.at(-1)![0] as { prompt: string }
  return lastCall.prompt
}

describe('scoreDialogNaturalness — Sample-Auswahl-Prompt-Inhalt', () => {
  it('wenige Turns (3, unter MAX_SAMPLE_TURNS=8): alle landen unverändert im Prompt, keine Duplikate', async () => {
    const prompt = await capturePrompt(makeTurns(3))
    for (let i = 1; i <= 3; i++) {
      expect(prompt).toContain(`AGENTTEXT_${i}`)
    }
    // Kein Turn darf doppelt vorkommen, wenn turns.length <= MAX_SAMPLE_TURNS.
    expect(prompt.split('AGENTTEXT_1').length - 1).toBe(1)
  })

  it('viele Turns (12, über MAX_SAMPLE_TURNS=8): erster, zweiter, mittlerer + letzte 5 sind enthalten', async () => {
    const prompt = await capturePrompt(makeTurns(12))
    // erste, zweite (Indizes 0,1 -> Turn 1,2)
    expect(prompt).toContain('AGENTTEXT_1')
    expect(prompt).toContain('AGENTTEXT_2')
    // mittlerer (Math.floor(12/2)=6 -> Index 6 -> Turn 7)
    expect(prompt).toContain('AGENTTEXT_7')
    // letzte 5 (Turns 8-12)
    for (let i = 8; i <= 12; i++) {
      expect(prompt).toContain(`AGENTTEXT_${i}`)
    }
    // Turns dazwischen, die nicht im Sample sind, dürfen NICHT auftauchen.
    expect(prompt).not.toContain('AGENTTEXT_3')
    expect(prompt).not.toContain('AGENTTEXT_4')
  })

  it('Grenzfall genau MAX_SAMPLE_TURNS=8: keine Kürzung, alle 8 enthalten', async () => {
    const prompt = await capturePrompt(makeTurns(8))
    for (let i = 1; i <= 8; i++) {
      expect(prompt).toContain(`AGENTTEXT_${i}`)
    }
  })
})
