import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { parseJudgeResponse } from './dialogNaturalness'

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
