import { describe, it, expect } from 'vitest'
import { analyzeConversationSignals, extractNumericTokens } from './conversationSignals'
import type { InterviewContext } from './interviewTypes'
import type { StepEntry } from './interviewSemantic'

// PROJ-35 / ADR-017: the seven conversation-signal detectors are private to
// conversationSignals.ts. They are tested through the single public surface
// `analyzeConversationSignals` — assertions target the composed `Signals`
// fields, not the individual detectors (the composition is the real behaviour).

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Rechnungseingang buchen',
    reihenfolge: 1,
    governance: null,
    abhaengigkeiten: null,
    status: 'exploring',
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
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

function makeCtx(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    interviewId: 'iv-1',
    workspaceId: 'ws-1',
    employeeName: 'Test',
    employeeRole: null,
    department: 'Test',
    focusTopics: null,
    phase: 'walkthrough_step',
    timerMinutes: 0,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 30,
    stepTracker: [],
    ...overrides,
  }
}

// ─── extractNumericTokens (Pt7, shared util) ─────────────────────────────────

describe('extractNumericTokens', () => {
  it('extracts standalone integers', () => {
    expect(extractNumericTokens('Wie oft? Etwa 20 mal pro Monat.')).toEqual(['20'])
  })

  it('extracts decimal numbers with dot', () => {
    expect(extractNumericTokens('ca. 1.5 Stunden')).toContain('1.5')
  })

  it('extracts decimal numbers with comma (German locale)', () => {
    expect(extractNumericTokens('ca. 1,5 Stunden')).toContain('1,5')
  })

  it('deduplicates repeated numbers', () => {
    const result = extractNumericTokens('20 Rechnungen oder 20 Vorgänge')
    expect(result.filter(n => n === '20').length).toBe(1)
  })

  it('returns empty array for text without numbers', () => {
    expect(extractNumericTokens('Wie oft passiert das?')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(extractNumericTokens('')).toEqual([])
  })
})

// ─── analyzeConversationSignals: composition surface ─────────────────────────

describe('analyzeConversationSignals → empty history defaults', () => {
  it('returns neutral signals for a first turn with no history', () => {
    expect(analyzeConversationSignals(makeCtx())).toEqual({
      anchorNumbers: [],
      drillWarnings: [],
      ambiguity: null,
      exception: false,
      recentlyRecontextualized: false,
      ladderingStreak: 0,
      blockade: false,
    })
  })
})

describe('analyzeConversationSignals → anchorNumbers', () => {
  it('extracts numbers from briefing.suggested_question', () => {
    const signals = analyzeConversationSignals(makeCtx(), { suggested_question: 'ca. 20 mal pro Monat' })
    expect(signals.anchorNumbers).toContain('20')
  })
  it('is empty when briefing has no numbers or is absent', () => {
    expect(analyzeConversationSignals(makeCtx(), { suggested_question: 'Wie oft?' }).anchorNumbers).toEqual([])
    expect(analyzeConversationSignals(makeCtx(), null).anchorNumbers).toEqual([])
    expect(analyzeConversationSignals(makeCtx()).anchorNumbers).toEqual([])
  })
})

describe('analyzeConversationSignals → drillWarnings (F1)', () => {
  it('returns empty when no recent assistant turns', () => {
    const step = makeStep({ status: 'walkthrough' })
    expect(analyzeConversationSignals(makeCtx({ stepTracker: [step] })).drillWarnings).toEqual([])
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: [], stepTracker: [step] })).drillWarnings).toEqual([])
  })

  it('returns empty when no active step', () => {
    const step = makeStep({ status: 'done' })
    const turns = ['Wie lange dauert das?', 'Wie viele Minuten brauchst du?']
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step] })).drillWarnings).toEqual([])
  })

  it('returns empty when slot has been filled (potenzial.duration_minutes)', () => {
    const step = makeStep({
      status: 'walkthrough',
      potenzial: {
        frequency_per_month: null,
        duration_minutes: { value: 30, quote: '30min', confidence: 'estimate', writeSource: 'analyst' },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    const turns = ['Wie lange dauert das?', 'Wie viele Minuten benötigst du?']
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step] })).drillWarnings).toEqual([])
  })

  it('warns when same duration slot is targeted twice in recent turns', () => {
    const step = makeStep({ status: 'walkthrough' })
    const turns = [
      'Wie viele Minuten dauert dieser Schritt?',
      'Welcher Wert wäre eine grobe Schätzung für die Dauer pro Rechnung?',
    ]
    const result = analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step] })).drillWarnings
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/duration_minutes/)
    expect(result[0]).toMatch(/NICHT erneut fragen/)
  })

  it('warns on repeated frequency question', () => {
    const step = makeStep({ status: 'walkthrough' })
    const turns = [
      'Wie viele Konten gleichst du ab?',
      'Welcher Wert wäre eine grobe Schätzung für die Anzahl?',
      'Wie viele Konten typischerweise pro Monat?',
    ]
    const result = analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step] })).drillWarnings
    expect(result.some(w => w.includes('frequency_per_month'))).toBe(true)
  })

  it('does not warn when only one turn matches a slot', () => {
    const step = makeStep({ status: 'walkthrough' })
    const turns = ['Wie lange dauert das?', 'Welche Systeme nutzt du dafür?']
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step] })).drillWarnings).toEqual([])
  })

  it('F1b: triggers after 1 question when persona refused', () => {
    const step = makeStep({ status: 'walkthrough' })
    const turns = ['Wie viele Minuten dauert das im Durchschnitt?']
    const refuse = 'Eine exakte Minutenzahl lässt sich nicht festlegen, da der Aufwand stark variiert.'
    const result = analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step], lastUserTurn: refuse })).drillWarnings
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/Refuse-Pattern erkannt/)
  })

  it('F1b: still requires 1 question — no warn if zero asked', () => {
    const step = makeStep({ status: 'walkthrough' })
    const turns = ['Welche Systeme nutzt du?']
    const refuse = 'Das kann ich nicht exakt sagen, variiert stark.'
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: turns, stepTracker: [step], lastUserTurn: refuse })).drillWarnings).toEqual([])
  })
})

describe('analyzeConversationSignals → drillWarnings refuse handling (F1b)', () => {
  // detectPersonaRefuse is private; its behaviour is observed through drillWarnings:
  // a refuse phrase on the last user turn lowers the drill threshold to 1, so a
  // single prior slot question is enough to emit a "Refuse-Pattern erkannt" warning.
  const step = () => makeStep({ status: 'walkthrough' })
  const oneDurationQuestion = ['Wie viele Minuten dauert dieser Schritt im Durchschnitt?']

  function refuseWarns(lastUserTurn: string): boolean {
    const warnings = analyzeConversationSignals(
      makeCtx({ recentAssistantTurns: oneDurationQuestion, stepTracker: [step()], lastUserTurn }),
    ).drillWarnings
    return warnings.length === 1 && /Refuse-Pattern erkannt/.test(warnings[0])
  }

  it('detects "lässt sich nicht beziffern"', () => {
    expect(refuseWarns('Das lässt sich nicht pauschal beziffern.')).toBe(true)
  })
  it('detects "keine exakte Zahl"', () => {
    expect(refuseWarns('Hierzu führe ich keine exakte Aufzeichnung.')).toBe(true)
  })
  it('detects "variiert stark"', () => {
    expect(refuseWarns('Der Aufwand variiert stark je nach Belegqualität.')).toBe(true)
  })
  it('does not flag normal answers (threshold stays 2 → no warn after 1 question)', () => {
    const warnings = analyzeConversationSignals(
      makeCtx({ recentAssistantTurns: oneDurationQuestion, stepTracker: [step()], lastUserTurn: 'Ich bearbeite ca. 100 Rechnungen pro Monat.' }),
    ).drillWarnings
    expect(warnings).toEqual([])
  })
  it('handles undefined last user turn (no refuse → no warn after 1 question)', () => {
    const warnings = analyzeConversationSignals(
      makeCtx({ recentAssistantTurns: oneDurationQuestion, stepTracker: [step()] }),
    ).drillWarnings
    expect(warnings).toEqual([])
  })
})

describe('analyzeConversationSignals → blockade (E3.4)', () => {
  it('triggers on short answer (< 10 words)', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Weiß ich nicht.' })).blockade).toBe(true)
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Keine Ahnung.' })).blockade).toBe(true)
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Geht so.' })).blockade).toBe(true)
  })
  it('triggers on explicit blockade phrases', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Das weiß ich nicht genau, da führe ich keine Aufzeichnung.' })).blockade).toBe(true)
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Das ist halt so, immer schon so bei uns.' })).blockade).toBe(true)
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Das kann ich so nicht sagen, es variiert zu stark.' })).blockade).toBe(true)
  })
  it('does NOT trigger on substantive short-but-precise answer', () => {
    // 10+ words, no blockade phrases
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Ich bearbeite das täglich morgens und es dauert meistens ungefähr eine Stunde.' })).blockade).toBe(false)
  })
  it('returns false for undefined last user turn', () => {
    expect(analyzeConversationSignals(makeCtx()).blockade).toBe(false)
  })
})

describe('analyzeConversationSignals → ladderingStreak (E3.4)', () => {
  it('returns 0 for empty or undefined', () => {
    expect(analyzeConversationSignals(makeCtx()).ladderingStreak).toBe(0)
    expect(analyzeConversationSignals(makeCtx({ recentUserTurns: [] })).ladderingStreak).toBe(0)
  })
  it('returns 1 for one blockade turn at end', () => {
    const recentUserTurns = [
      'Ich bearbeite täglich die Eingangsrechnungen und buche sie direkt ins SAP-System.',
      'Weiß ich nicht.',
    ]
    expect(analyzeConversationSignals(makeCtx({ recentUserTurns })).ladderingStreak).toBe(1)
  })
  it('returns 2 for two consecutive blockade turns at end', () => {
    const recentUserTurns = [
      'Der Prozess läuft täglich morgens und dauert meistens ungefähr eine Stunde für mich.',
      'Keine Ahnung.',
      'Ist halt so.',
    ]
    expect(analyzeConversationSignals(makeCtx({ recentUserTurns })).ladderingStreak).toBe(2)
  })
  it('resets streak when non-blockade turn interrupts', () => {
    const recentUserTurns = [
      'Keine Ahnung.',
      'Ich mache das täglich morgens und es dauert ungefähr eine Stunde für mich.',
      'Ist halt so.',
    ]
    expect(analyzeConversationSignals(makeCtx({ recentUserTurns })).ladderingStreak).toBe(1)
  })
})

describe('analyzeConversationSignals → exception (E3.2)', () => {
  it('detects "manchmal"', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Das mache ich manchmal per E-Mail, manchmal direkt im System.' })).exception).toBe(true)
  })
  it('detects "außer wenn"', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Normalerweise in SAP, außer wenn das System down ist.' })).exception).toBe(true)
  })
  it('detects "in bestimmten Fällen"', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'In bestimmten Fällen eskaliere ich an meinen Vorgesetzten.' })).exception).toBe(true)
  })
  it('detects "Ausnahme"', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Als Ausnahme nehme ich das mal manuell raus.' })).exception).toBe(true)
  })
  it('does NOT trigger on normal statements', () => {
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Ich bearbeite täglich die Eingangsrechnungen im SAP-System.' })).exception).toBe(false)
    expect(analyzeConversationSignals(makeCtx()).exception).toBe(false)
  })
})

describe('analyzeConversationSignals → ambiguity (E3.1)', () => {
  it('detects numeric conflict: captured duration vs much larger value in current turn', () => {
    const step = makeStep({
      status: 'walkthrough',
      potenzial: {
        frequency_per_month: null,
        duration_minutes: { value: 5, quote: 'dauert 5 Minuten', confidence: 'confirmed' },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    const result = analyzeConversationSignals(
      makeCtx({ lastUserTurn: 'Das dauert eigentlich eher 300 Minuten — fast einen halben Tag.', stepTracker: [step] }),
    ).ambiguity
    expect(result).not.toBeNull()
    expect(result?.phraseA).toContain('5 Minuten')
    expect(result?.phraseB).toContain('300')
  })
  it('detects numeric conflict: captured frequency vs much lower value', () => {
    const step = makeStep({
      status: 'exploring',
      potenzial: {
        frequency_per_month: { value: 120, quote: '120 mal im Monat', confidence: 'confirmed' },
        duration_minutes: null,
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    const result = analyzeConversationSignals(
      makeCtx({ lastUserTurn: 'Das passiert vielleicht 10 Mal im Monat, nicht mehr.', stepTracker: [step] }),
    ).ambiguity
    expect(result).not.toBeNull()
  })
  it('does NOT flag minor numeric variation (ratio < 3)', () => {
    const step = makeStep({
      status: 'walkthrough',
      potenzial: {
        frequency_per_month: null,
        duration_minutes: { value: 10, quote: '10 Minuten', confidence: 'confirmed' },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    // 15 minutes vs 10 → ratio 1.5 < 3
    const result = analyzeConversationSignals(
      makeCtx({ lastUserTurn: 'Das dauert eher 15 Minuten.', stepTracker: [step] }),
    ).ambiguity
    expect(result).toBeNull()
  })
  it('detects explicit contradiction marker "eigentlich doch"', () => {
    const result = analyzeConversationSignals(
      makeCtx({ lastUserTurn: 'Das läuft über SAP — eigentlich doch manchmal über Excel.', stepTracker: [] }),
    ).ambiguity
    expect(result).not.toBeNull()
  })
  it('returns null for undefined or no active step', () => {
    expect(analyzeConversationSignals(makeCtx({ stepTracker: [] })).ambiguity).toBeNull()
    expect(analyzeConversationSignals(makeCtx({ lastUserTurn: 'Test Aussage 100 Minuten.', stepTracker: [] })).ambiguity).toBeNull()
  })

  describe('B2 fix: negation-contradiction via priorUserTurns', () => {
    // priorUserTurns = ctx.recentUserTurns.slice(0, -1); the current turn is the last entry.
    it('detects "kein SAP" in prior turn + positive SAP mention in current turn', () => {
      const recentUserTurns = ['Wir nutzen kein SAP, alles läuft über Excel.', 'Natürlich prüfe ich kurz in SAP nach.']
      const result = analyzeConversationSignals(
        makeCtx({ lastUserTurn: 'Natürlich prüfe ich kurz in SAP nach.', stepTracker: [], recentUserTurns }),
      ).ambiguity
      expect(result).not.toBeNull()
      expect(result?.phraseA).toMatch(/kein SAP/i)
      expect(result?.phraseB).toMatch(/SAP/i)
    })
    it('detects "keine Excel" contradiction', () => {
      const recentUserTurns = ['Wir haben keine Excel-Listen dafür.', 'Ich öffne dann meine Excel-Tabelle und trage es ein.']
      const result = analyzeConversationSignals(
        makeCtx({ lastUserTurn: 'Ich öffne dann meine Excel-Tabelle und trage es ein.', stepTracker: [], recentUserTurns }),
      ).ambiguity
      expect(result).not.toBeNull()
    })
    it('returns null when current turn does NOT positively mention negated concept', () => {
      const recentUserTurns = ['Wir nutzen kein SAP.', 'Das Prozessschritt dauert etwa 10 Minuten.']
      const result = analyzeConversationSignals(
        makeCtx({ lastUserTurn: 'Das Prozessschritt dauert etwa 10 Minuten.', stepTracker: [], recentUserTurns }),
      ).ambiguity
      expect(result).toBeNull()
    })
    it('returns null when priorUserTurns is empty', () => {
      const recentUserTurns = ['Ich nutze SAP täglich.']
      const result = analyzeConversationSignals(
        makeCtx({ lastUserTurn: 'Ich nutze SAP täglich.', stepTracker: [], recentUserTurns }),
      ).ambiguity
      expect(result).toBeNull()
    })
  })
})

describe('analyzeConversationSignals → recentlyRecontextualized (E3.2 cap)', () => {
  it('detects re-contextualization in recent assistant turns', () => {
    const recentAssistantTurns = [
      'Wie lange dauert dieser Schritt?',
      'Lass uns zurück zu deiner Frage kommen.',
      'Wie oft passiert das pro Woche?',
    ]
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns })).recentlyRecontextualized).toBe(true)
  })
  it('detects "kommen wir zurück zu"', () => {
    const recentAssistantTurns = ['Kommen wir zurück zu dem was du vorhin beschrieben hast.']
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns })).recentlyRecontextualized).toBe(true)
  })
  it('returns false when no re-contextualization in recent turns', () => {
    const recentAssistantTurns = [
      'Wie lange dauert dieser Schritt für dich typischerweise?',
      'Und wie oft passiert das pro Monat?',
      'Welche Systeme nutzt du dabei?',
    ]
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns })).recentlyRecontextualized).toBe(false)
  })
  it('returns false for undefined or empty', () => {
    expect(analyzeConversationSignals(makeCtx()).recentlyRecontextualized).toBe(false)
    expect(analyzeConversationSignals(makeCtx({ recentAssistantTurns: [] })).recentlyRecontextualized).toBe(false)
  })
})
