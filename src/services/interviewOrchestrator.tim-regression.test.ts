import { describe, it, expect } from 'vitest'
import { decideNextPhase, checkLifecycle, CLOSING_PROBE_TEXT, type OrchestratorContext } from './interviewOrchestrator'
import type { StepEntry } from './interviewSemantic'
import type { AnalystBriefing } from './interviewTypes'

/**
 * PROJ-42 regression test — reproduces the real Tim interview that surfaced KI-23
 * (Supabase interview 09c2052c-ad69-40fc-bb38-d934ece47fc6, 2026-07-14, IT/Developer,
 * `max_duration_minutes=10`, 17 turns). That interview is STILL `status='active'` in
 * production as of 2026-07-16 — the pre-PROJ-42 system never reached completion.
 *
 * Root cause (KI-23): completion required `semanticAllStepsDone` (never true here —
 * `ausnahmen`/`tazite_cues` stayed null for both steps, confirmed by the real final
 * `step_tracker` below) OR a brittle `FAREWELL_MARKERS` regex match (missed turn 14's
 * real "wünsche ich dir" — substring "wünsche dir" — a genuine near-miss, not a
 * contrived example). A secondary bug (KI-23, `computeTurnBudget`) escalated the
 * interview to the wrap-up question after just ~9 turns with only ONE process
 * registered, purely from turn count — elapsed wall-clock time never got anywhere
 * near the 10-minute budget (max ~5 minutes across all 17 turns, well under the new
 * 80% soft anchor at 8 minutes) confirmed via the real `created_at` timestamps below.
 *
 * This test reconstructs a plausible per-turn state trace using the REAL user inputs,
 * REAL timestamps and the REAL final step_tracker pulled from Supabase — it is not a
 * byte-exact replay of the historical (buggy) system's internal state, since per-turn
 * Analyst snapshots were never persisted, only the inputs/outputs and final tracker.
 * Where the new system's behavior genuinely diverges from the buggy transcript (e.g.
 * turn 10's "Meetings" reentry), the assistant text is a plausible PROJ-42-era
 * response instead of the historical one, with the divergence called out.
 */

const emptyPotenzial: StepEntry['potenzial'] = {
  frequency_per_month: null,
  duration_minutes: null,
  error_rate_percent: null,
  media_breaks: null,
}
const emptySlots: StepEntry['slots'] = {
  entscheidungslogik: null,
  tazite_cues: null,
  ausnahmen: null,
  inputs: null,
  outputs: null,
  hilfsmittel: null,
}

function makeStep(title: string, status: StepEntry['status'], extra: Partial<StepEntry> = {}): StepEntry {
  return { title, reihenfolge: 1, governance: null, abhaengigkeiten: null, status, potenzial: emptyPotenzial, slots: emptySlots, process_steps: [], friction_points: [], friction_tools: [], pain_point_primary: null, ...extra }
}

// Real final tracker shape (Supabase, abbreviated — embeddings/exact quotes omitted,
// null-ness of tazite slots preserved verbatim): NEITHER step ever reaches 'done'
// because entscheidungslogik/tazite_cues/ausnahmen/inputs/outputs stay unfilled —
// this is exactly why the old semanticAllStepsDone gate could never fire.
const REAL_FINAL_TRACKER: StepEntry[] = [
  makeStep('Softwareentwicklung', 'walkthrough', {
    id: 'S001',
    potenzial: { ...emptyPotenzial, frequency_per_month: { value: 20, quote: '1 pro tag', confidence: 'estimate' } },
    slots: {
      ...emptySlots,
      inputs: { value: ['code'], quote: 'ne spaß ist schon der code', nicht_befund_typ: null },
      outputs: { value: ['ergebnis unbekannt'], quote: 'das ergebnis kenne ich selber immer ganricht so genau', nicht_befund_typ: null },
      hilfsmittel: { value: ['visual studio code'], quote: 'visual studio code', nicht_befund_typ: null },
      entscheidungslogik: { value: 'Vorgesetzter bewertet das Ergebnis', quote: 'mein Vorgesetzter anschaut und bewertet', nicht_befund_typ: null },
      // ausnahmen, tazite_cues: still null in the real data — never resolved.
    },
  }),
  makeStep('Meetings', 'walkthrough', {
    id: 'S002',
    potenzial: { ...emptyPotenzial, frequency_per_month: { value: 20, quote: '1 pro tag 20 min', confidence: 'confirmed' }, duration_minutes: { value: 20, quote: '1 pro tag 20 min', confidence: 'confirmed' } },
    slots: {
      ...emptySlots,
      hilfsmittel: { value: ['visual studio code'], quote: '[auto-backfill aus erwähnten Tools/Systemen]', nicht_befund_typ: null },
      // inputs, outputs, entscheidungslogik, tazite_cues, ausnahmen: still null.
    },
  }),
]

const MAX_DURATION_MINUTES = 10 // real interview config

function ctxAt(overrides: Partial<OrchestratorContext>): OrchestratorContext {
  return {
    phase: 'explore',
    stepTracker: [],
    topicsOpen: [],
    topicsCovered: [],
    timerMinutes: 0,
    maxDurationMinutes: MAX_DURATION_MINUTES,
    historyLength: 0,
    history: [],
    newStepThisTurn: false,
    oDrought: { stepId: null, streak: 0, exhaustedStepIds: [] },
    ...overrides,
  }
}

describe('PROJ-42 Tim regression (Supabase 09c2052c-ad69-40fc-bb38-d934ece47fc6)', () => {
  it('turn 8 (real elapsed ~2min, 1 process registered): stays in explore — no premature escalation from turn count alone', () => {
    // Real turns 1-8 verbatim. Only "Softwareentwicklung" registered so far, no
    // advance signal yet (Analyst hasn't judged it sufficiently covered). Under the
    // OLD computeTurnBudget ladder this was already deep into the escape-valve zone
    // for a single-step tracker — the new model has no such turn-count driver at all.
    const history = [
      { role: 'user' as const, content: 'ICh arbeit eigentlich immer an unterschiedlichen PRojekten und bin dort meistens in einer ausführenden Rolle' },
      { role: 'assistant' as const, content: 'Du bist also in der operativen Umsetzung tätig. Welche dieser Aufgaben oder Prozesse wiederholen sich dabei regelmäßig in deinem Arbeitsalltag?' },
      { role: 'user' as const, content: 'Das schreiben von Code' },
      { role: 'assistant' as const, content: 'Das Schreiben von Code ist der Kern deiner Tätigkeit. Welcher Teilbereich davon nimmt bei dir die meiste Zeit in Anspruch, etwa die Implementierung neuer Features oder die Fehlerbehebung?' },
      { role: 'user' as const, content: 'der toilettengang' },
      { role: 'assistant' as const, content: 'Wie oft schreibst du Code — eher täglich oder eher einmal pro Woche?' },
      { role: 'user' as const, content: 'gar nicht' },
      { role: 'assistant' as const, content: 'Du hast vorhin das Schreiben von Code als Aufgabe genannt — welche Tätigkeiten machen stattdessen den Großteil deiner Zeit aus?' },
      { role: 'user' as const, content: 'Toilette' },
      { role: 'assistant' as const, content: 'Da wir beim Thema Code nicht weiterkommen: Welche Art von Projekten betreust du in deiner Rolle als Developer primär?' },
      { role: 'user' as const, content: 'ne spaß ist schon der code' },
      { role: 'assistant' as const, content: 'Welche Tools verwendest du beim Coden und was ist das konkrete Ergebnis, das du damit erstellst?' },
      { role: 'user' as const, content: 'visual studio code und das ergebnis kenne ich selber immer ganricht so genau, weil das mein Vorgesetzter anschaut und bewertet' },
      { role: 'assistant' as const, content: 'Wenn dein Vorgesetzter die Ergebnisse prüft, wie viele Stunden am Tag verbringst du dann durchschnittlich mit dem eigentlichen Schreiben von Code?' },
      { role: 'user' as const, content: '5' },
    ]
    const tracker = [makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' })]
    const ctx = ctxAt({ phase: 'explore', stepTracker: tracker, timerMinutes: 2, historyLength: history.length, history })

    // No advance signal, no streak exhaustion, well under the 80% soft anchor (8min) → stays explore.
    expect(decideNextPhase(ctx, { noNewExtractionStreak: 0 })).toBe('explore')
  })

  it('turn 9 (real elapsed ~3min): advances to closing once the Analyst judges the process sufficiently covered — content-driven, matches the real probe text', () => {
    const tracker = [makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' })]
    // PROJ-44 Remediation (M-1): by turn 9 the single active step has also
    // drought-fired (no new O-field across the last few of the largely
    // off-topic turns 5-8) — both signals (Analyst step_advance_ready AND the
    // tracker-derived O-Drought) agree it's time to close, not step_advance_ready alone.
    const oDrought = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = ctxAt({ phase: 'explore', stepTracker: tracker, timerMinutes: 3, topicsOpen: [], historyLength: 16, oDrought })

    const next = decideNextPhase(ctx, { step_advance_ready: true })
    expect(next).toBe('closing')
    // The real turn-9 response happens to be exactly CLOSING_PROBE_TEXT — the old
    // system asked the same words, but as a symptom of turn-count escalation, not
    // content coverage. Pinning the constant confirms the new deterministic probe
    // text is unchanged from the historical wrap-up question wording.
    expect(CLOSING_PROBE_TEXT).toBe(
      'Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?',
    )
  })

  it('turn 10 real reveal ("Meetings"): a newly-discovered process during closing routes back to explore, first-class — not the old 2-turn clarification-only cap', () => {
    // Real turn 10 user input reveals a genuinely new recurring task while the
    // closing probe is pending. Modeled here as already reflected in the tracker
    // (the pre-completion recheck, KI-12, existing/unchanged, is responsible for
    // getting it registered before a lifecycle decision is trusted — verified
    // separately in runInterviewTurn.test.ts T11).
    const historyAfterReveal = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Meetings' },
    ]
    const tracker = [
      makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' }),
      makeStep('Meetings', 'exploring', { id: 'S002' }),
    ]
    const ctx = ctxAt({ phase: 'closing', stepTracker: tracker, timerMinutes: 3, history: historyAfterReveal, historyLength: 2 })

    // Strom 1 AC: first-class Explore reentry (not 'clarification').
    expect(decideNextPhase(ctx, null)).toBe('explore')
    // And lifecycle must not complete out from under the freshly-discovered step,
    // even though the probe was technically already asked+a user reply followed.
    expect(checkLifecycle(ctx, null).shouldComplete).toBe(false)
  })

  it('reaches shouldComplete=true by the end of the reconstructed sequence — the actual KI-23 fix (prod interview remains status=active to this day)', () => {
    // Real turns 13/14 verbatim, including the EXACT string that broke the old
    // FAREWELL_MARKERS regex ("wünsche ich dir" — substring "wünsche dir" required,
    // never matched). The new mechanism does not use text heuristics at all, so this
    // string's presence is irrelevant to completion — proven by the fact that
    // checkLifecycle never inspects assistant text for farewell language anymore.
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Meetings' },
      { role: 'assistant' as const, content: 'Wie oft finden diese Meetings statt und wie lange dauern sie im Durchschnitt?' },
      { role: 'user' as const, content: '1 pro tag 20 min' },
      { role: 'assistant' as const, content: 'Gerne. Bis bald.' },
      { role: 'user' as const, content: 'danke' },
      { role: 'assistant' as const, content: 'Alles klar, dann wünsche ich dir noch einen erfolgreichen Arbeitstag.' }, // the real, regex-breaking string
      { role: 'user' as const, content: 'gerne' },
    ]
    const ctx = ctxAt({
      phase: 'closing',
      stepTracker: REAL_FINAL_TRACKER, // real final tracker — neither step is 'done'
      timerMinutes: 4,
      topicsOpen: [],
      history,
      historyLength: history.length,
    })
    const analystSuggestion: AnalystBriefing | null = null // no pending clarification cards in this scenario

    expect(decideNextPhase(ctx, analystSuggestion)).toBe('completed')
    const lifecycle = checkLifecycle(ctx, analystSuggestion)
    expect(lifecycle.shouldComplete).toBe(true)
    expect(lifecycle.reason).toBe('soft_confirm')
  })

  // Turns 15-17 (KI-24: Tim's VW-Golf-price and flight-price questions, answered by
  // the agent instead of redirected) are Strom 2 scope — tested against these exact
  // real inputs in roleGuard.test.ts, not here.
})
