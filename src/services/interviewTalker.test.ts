import { describe, it, expect, vi } from 'vitest'

// interviewTalker imports getSupabaseAdmin (used inside onFinish). Mock it so the
// module loads without a live supabase env — the guard tests below are pure.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { detectNumberAnchoring, detectFillerPhrases } from './interviewTalker'

// ─── detectNumberAnchoring (Pt7, output guard) ───────────────────────────────

describe('detectNumberAnchoring', () => {
  it('detects when Talker re-quotes a briefing number in a question', () => {
    const talker = 'Du hast vorhin den Prozess beschrieben. Passiert das etwa 20 mal pro Monat?'
    const briefing = 'Frage nach Häufigkeit — ca. 20 mal pro Monat'
    expect(detectNumberAnchoring(talker, briefing)).toContain('20')
  })

  it('does NOT flag number that appears only in a statement, not a question', () => {
    const talker = 'Du hast 20 Vorgänge erwähnt. Wie oft passiert das genau?'
    const briefing = 'Häufigkeit: ca. 20 mal'
    // "20" appears in a non-question sentence
    expect(detectNumberAnchoring(talker, briefing)).toEqual([])
  })

  it('returns empty array when briefing has no numbers', () => {
    const talker = 'Wie oft machst du das pro Monat?'
    expect(detectNumberAnchoring(talker, 'Frage nach Häufigkeit des Prozesses')).toEqual([])
  })

  it('returns empty array when Talker does not re-quote the number', () => {
    const talker = 'Wie oft passiert das ungefähr?'
    expect(detectNumberAnchoring(talker, 'ca. 15 mal pro Woche')).toEqual([])
  })

  it('does NOT flag when Talker asks open question without number', () => {
    const talker = 'Wie lange dauert dieser Schritt in der Regel?'
    expect(detectNumberAnchoring(talker, 'Dauer ca. 30 Minuten')).toEqual([])
  })
})

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
