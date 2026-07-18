import { describe, it, expect } from 'vitest'
import { analyzeConversationSignals } from './conversationSignals'

// PROJ-46 (ADR-023 D5): exception, the numeric ambiguity detector,
// recentlyRecontextualized, drill-stop, and laddering were removed ersatzlos —
// the synchronous Analyst now sees every turn before the Talker (PROJ-44), so
// these were compensating for a Talker that had no fresh Analyst read. Only
// question-stem repetition (KI-15) remains, provisionally, as the single
// entry point's sole detector.

// ─── KI-15: repeatedQuestionStem ──────────────────────────────────────────────
// dialog_naturalness judge feedback (eval 2026-06-24/25/26, buchhalter) repeatedly cited
// "repetitive Frage-Struktur ('Wie oft...', 'Wie viel Zeit...')" as a Stufe-1 signal.
describe('analyzeConversationSignals → repeatedQuestionStem (KI-15)', () => {
  it('flags "Wie oft" repeated in the last 2 assistant turns', () => {
    const recentAssistantTurns = [
      'Wie oft passiert das pro Woche?',
      'Wie oft musst du das nachträglich korrigieren?',
    ]
    expect(analyzeConversationSignals(recentAssistantTurns).repeatedQuestionStem).toBe('Wie oft')
  })

  it('flags "Wie lange" repeated in the last 2 assistant turns', () => {
    const recentAssistantTurns = [
      'Wie lange dauert die Prüfung im Schnitt?',
      'Wie lange brauchst du für den Abschluss?',
    ]
    expect(analyzeConversationSignals(recentAssistantTurns).repeatedQuestionStem).toBe('Wie lange')
  })

  it('does NOT flag when the two most recent turns use different stems', () => {
    const recentAssistantTurns = [
      'Wie oft passiert das pro Woche?',
      'Welche Systeme nutzt du dabei?',
    ]
    expect(analyzeConversationSignals(recentAssistantTurns).repeatedQuestionStem).toBeNull()
  })

  it('does NOT flag a single occurrence (needs 2 in a row)', () => {
    const recentAssistantTurns = ['Wie oft passiert das pro Woche?']
    expect(analyzeConversationSignals(recentAssistantTurns).repeatedQuestionStem).toBeNull()
  })

  it('only looks at the last 2 turns — an older repeat further back does not count', () => {
    const recentAssistantTurns = [
      'Wie oft passiert das pro Woche?',
      'Wie oft musst du das nachträglich korrigieren?',
      'Welche Systeme nutzt du dabei?',
    ]
    expect(analyzeConversationSignals(recentAssistantTurns).repeatedQuestionStem).toBeNull()
  })

  it('returns null for undefined or empty', () => {
    expect(analyzeConversationSignals(undefined).repeatedQuestionStem).toBeNull()
    expect(analyzeConversationSignals([]).repeatedQuestionStem).toBeNull()
  })
})
