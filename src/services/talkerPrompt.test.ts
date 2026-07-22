import { describe, it, expect } from 'vitest'
import { buildDynamicContext, STATIC_PROMPT } from './talkerPrompt'
import type { InterviewContext } from './interviewTypes'

function baseContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    interviewId: 'interview-1',
    workspaceId: 'workspace-1',
    employeeName: 'Test Mitarbeiter',
    employeeRole: null,
    department: 'IT',
    focusTopics: null,
    phase: 'explore',
    timerMinutes: 0,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 60,
    stepTracker: [],
    ...overrides,
  }
}

// PROJ-46 (ADR-023 D5): the KI-20 tool-call leakage regression tests are gone —
// WALKTHROUGH_EXAMPLES (the few-shot example that leaked bracket pseudo-code)
// and the Tool-Syntax-Verbot line in STATIC_PROMPT that guarded it were both
// removed together ("guardet nach Wegfall des Few-Shots einen nicht mehr
// existierenden Auslöser"). Nothing left to regress against.

// ─── KI-19 / PROJ-46 (ADR-023 D4): scripted farewell turn must not re-ask a question ──
// Root cause (2026-07-11): the completion/farewell call (runInterviewTurn.ts, after
// resolveTurnLifecycle already decided complete=true) passed phase='closing' into
// createTalkerStream like any normal turn, so it inherited the unconditional
// ask-a-question-first methodology text — which routinely beat the softer advisory
// farewell guidance and made the model re-ask a question instead of saying goodbye.
// Confirmed on 36/82 (44%) historical gemini-3.1-flash-lite transcripts. PROJ-46
// replaced the scripted single closing probe with a Talker-formulated discovery
// continuation — the regression guard now checks that farewell mode suppresses
// that discovery methodology instead of the old PFLICHT-probe text.

describe('talkerPrompt — KI-19 farewell methodology regression', () => {
  it('normal closing turn (isCompletionFarewell unset) still gets the discovery-continuation instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing' }))
    expect(ctx).toMatch(/Methodik: closing \(Entdeckung\)/)
    expect(ctx).toMatch(/JEDES MAL FRISCH FORMULIERTE/)
  })

  it('scripted completion farewell (isCompletionFarewell=true) suppresses the discovery-continuation instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing', isCompletionFarewell: true }))
    expect(ctx).not.toMatch(/Methodik: closing \(Entdeckung\)/)
    expect(ctx).not.toMatch(/JEDES MAL FRISCH FORMULIERTE/)
    expect(ctx).toMatch(/Verabschiede dich jetzt kurz und herzlich/)
    expect(ctx).toMatch(/KEINE weitere Frage/)
  })
})

// ─── BUG-5 regression: clarification-transition turn must include a real farewell ──
// Root cause (PROJ-42 QA, 2026-07-16): the closing→clarification transition turn
// (cards pending, no step still exploring) previously only announced the upcoming
// cards ("Danke! Ich habe noch ein paar kurze Abschlussfragen für dich.") with no
// farewell anywhere — clarification/route.ts completes the interview via a raw SQL
// write with no Talker call at all, so this transition turn is the ONLY place a
// farewell can appear before status='completed'.

describe('talkerPrompt — BUG-5 clarification-transition farewell regression', () => {
  it('clarification methodology (no exploring step) instructs a real farewell, not just a card announcement', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'clarification' }))
    expect(ctx).toMatch(/Verabschiede dich jetzt kurz und herzlich/)
    expect(ctx).toMatch(/Abschlussfragen im Interface/)
  })

  it('clarification methodology forbids further chat questions after the farewell', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'clarification' }))
    expect(ctx).toMatch(/KEINE weitere Frage/)
  })
})

// ─── WP1 regression: farewell turn suppresses the entire dynamic block ───────────
// Root cause (2026-07-14 design round, plan curried-plotting-narwhal): sending the full
// dynamic block on the scripted farewell turn cost ~1562 tokens for a turn that only says
// goodbye, and created a live contradiction — ambiguitySection could inject a PFLICHT
// follow-up question demand in the same turn the methodology said "KEINE weitere Frage"
// (measured on interview 1f5d350d turn 31, 2026-07-11 batch). Short-circuiting removes
// step tracker, briefing, filler-avoidance and all signal sections on this turn type.

describe('talkerPrompt — WP1 farewell dynamic-block short-circuit', () => {
  it('farewell turn omits step tracker, briefing, and all signal sections', () => {
    const ctx = buildDynamicContext(
      baseContext({
        phase: 'closing',
        isCompletionFarewell: true,
        stepTracker: [
          {
            id: 'S001',
            title: 'Rechnungsprüfung',
            status: 'done',
            reihenfolge: 1,
            potenzial: {
              frequency_per_month: { value: 100, confidence: 'confirmed', qualifier: null, source_turn: 1 },
              duration_minutes: { value: 5, confidence: 'confirmed', qualifier: null, source_turn: 1 },
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
            governance: null,
            abhaengigkeiten: null,
            process_steps: ['Prüfen', 'Buchen'],
            friction_points: ['Doppelerfassung'],
            friction_tools: ['SAP'],
            pain_point_primary: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
        extractionsLog: [
          { type: 'pain_point', content: { description: 'Doppelerfassung in SAP' } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        usedFillerPhrases: ['Ok, das passt so.'],
        focusStepId: 'S001',
        transitionReason: 'step_switch',
      }),
      { target_o_field: 'ausnahmen' },
    )
    expect(ctx).not.toMatch(/Schritt-Tracker/)
    expect(ctx).not.toMatch(/Rechnungsprüfung/)
    expect(ctx).not.toMatch(/Extrahierte Wissensobjekte/)
    expect(ctx).not.toMatch(/Doppelerfassung/)
    expect(ctx).not.toMatch(/## Ziel \(bindend\)/)
    expect(ctx).not.toMatch(/VARIANZ-GEBOT/)
    expect(ctx).toMatch(/## Interview-Kontext/)
    expect(ctx).toMatch(/Verabschiede dich jetzt kurz und herzlich/)
  })

  it('non-farewell closing turn still gets the full dynamic block (no regression)', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing' }))
    expect(ctx).toMatch(/Schritt-Tracker/)
  })
})

// ─── WP2 regression: "Bereits erfasste Werte" duplicate section removed ─────────
// Root cause (2026-07-14 design round): formatFilledSlotsSnapshot() rendered exactly the
// same ✓-flags the step tracker already shows in the same message (just more compact).
// STATIC_PROMPT's <no_repeat> rule already treated both sources as equivalent, so the
// duplicate carried no information the tracker didn't already have. Removed entirely —
// the tracker's ✓ marks remain the single source of truth.

describe('talkerPrompt — WP2 duplicate "Bereits erfasste Werte" removed', () => {
  it('explore turn never renders the "Bereits erfasste Werte" section', () => {
    const ctx = buildDynamicContext(
      baseContext({
        phase: 'explore',
        stepTracker: [
          {
            id: 'S001',
            title: 'Rechnungsprüfung',
            status: 'walkthrough',
            reihenfolge: 1,
            potenzial: {
              frequency_per_month: { value: 100, confidence: 'confirmed', qualifier: null, source_turn: 1 },
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
            governance: null,
            abhaengigkeiten: null,
            process_steps: [],
            friction_points: [],
            friction_tools: [],
            pain_point_primary: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
      }),
    )
    expect(ctx).not.toMatch(/Bereits erfasste Werte/)
    // ✓ mark for the filled slot still comes through via the step tracker itself.
    expect(ctx).toMatch(/frequency_per_month.*✓ erfasst/)
  })

  it('STATIC_PROMPT no_repeat rule no longer references "Bereits erfasst" as a separate source', () => {
    expect(STATIC_PROMPT).not.toMatch(/"Bereits erfasst"/)
    expect(STATIC_PROMPT).toMatch(/✓ im Schritt-Tracker/)
  })
})

// ─── WP3 regression: [done]-steps render a compact one-line summary ─────────────
// Root cause (2026-07-14 design round): the full 10-line slot checklist (all
// potenzial/tazite slots individually with ✓/fehlt, plus governance/dependencies) was
// rendered even for steps that are fully done — dead weight, since <no_repeat> already
// forbids re-asking a filled slot and governance/dependencies are captured opportunistically
// by the Analyst, never actively re-queried by the Talker. walkthrough/exploring steps keep
// the full checklist (it's the actual steering signal for open slots there).
//
// Uses phase='closing' (any non-explore phase works — the compact-rendering behavior lives
// in formatStepTracker(), used by every phase except 'explore', which has its own masked view).

function doneStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    status: 'done',
    reihenfolge: 1,
    potenzial: {
      frequency_per_month: { value: 100, confidence: 'confirmed', qualifier: null, source_turn: 1 },
      duration_minutes: { value: 5, confidence: 'confirmed', qualifier: null, source_turn: 1 },
      error_rate_percent: { value: 2, confidence: 'confirmed', qualifier: null, source_turn: 1 },
      media_breaks: { value: 1, confidence: 'confirmed', qualifier: null, source_turn: 1 },
    },
    slots: {
      entscheidungslogik: { value: 'Regelbasiert', nicht_befund_typ: null, source_turn: 1 },
      tazite_cues: { value: 'Erfahrungswissen', nicht_befund_typ: null, source_turn: 1 },
      ausnahmen: { value: 'Keine', nicht_befund_typ: null, source_turn: 1 },
      inputs: { value: 'Rechnung', nicht_befund_typ: null, source_turn: 1 },
      outputs: { value: 'Buchung', nicht_befund_typ: null, source_turn: 1 },
      hilfsmittel: { value: 'SAP', nicht_befund_typ: null, source_turn: 1 },
    },
    // PROJ-45: governance/friction_points/friction_tools/pain_point_primary were
    // removed from StepEntry entirely (no replacement); process_steps was renamed
    // to teilschritte — the only one of these still rendered by formatStepTracker.
    abhaengigkeiten: null,
    teilschritte: ['Prüfen', 'Buchen'],
    ...overrides,
  }
}

describe('talkerPrompt — WP3 done-step compact rendering', () => {
  it('a done step renders the compact one-liner, no per-slot checklist', () => {
    const ctx = buildDynamicContext(
      baseContext({
        phase: 'closing',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stepTracker: [doneStep()] as any,
      }),
    )
    expect(ctx).toMatch(/\[done\] S001 "Rechnungsprüfung" \(Schritt 1\) — alle Pflichtslots erfasst/)
    expect(ctx).not.toMatch(/frequency_per_month\s*: ✓ erfasst/)
    // tazite_cues/ausnahmen aren't mentioned by any phase methodology text, so their
    // absence here unambiguously confirms the per-slot checklist was dropped.
    expect(ctx).not.toMatch(/tazite_cues/)
    expect(ctx).not.toMatch(/ausnahmen/)
    // governance no longer exists (PROJ-45); teilschritte context is retained for
    // follow-up questions about other steps (renamed from process_steps).
    expect(ctx).not.toMatch(/governance: Buchhalter/)
    expect(ctx).toMatch(/teilschritte: Prüfen → Buchen/)
  })

  it('a walkthrough/exploring step still renders the full slot checklist (no over-truncation)', () => {
    const ctx = buildDynamicContext(
      baseContext({
        phase: 'closing',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stepTracker: [doneStep({ status: 'walkthrough' })] as any,
      }),
    )
    expect(ctx).toMatch(/frequency_per_month: ✓ erfasst/)
    // governance no longer exists (PROJ-45) — entscheidungslogik is still part of
    // the full checklist for a non-done step, confirming the checklist wasn't
    // over-truncated.
    expect(ctx).toMatch(/entscheidungslogik\s*: ✓ erfasst/)
    expect(ctx).not.toMatch(/alle Pflichtslots erfasst/)
  })
})

// ─── WP4 regression: extractionsLog live-feed removed from the Talker prompt ────
// Root cause (2026-07-14 design round): extraction.extractAndEmbed() is an independent,
// async LLM call that fed its raw pain_point/tool output straight into every Talker turn,
// uncapped over the whole interview — violating ADR-011's own premise that extraction runs
// post-hoc on the final transcript, not live. Mostly redundant with the Analyst-attributed
// friction_points/friction_tools already in the step tracker. extraction.extractAndEmbed()
// itself keeps running (feeds the Wissensbank + computeDataSourcesBackfill) — only its
// rendering into the Talker prompt is removed.

describe('talkerPrompt — WP4 extractionsLog live-feed removed', () => {
  it('never renders "Extrahierte Wissensobjekte", regardless of log content or phase', () => {
    const withEntries = buildDynamicContext(
      baseContext({
        phase: 'closing',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractionsLog: [
          { type: 'pain_point', content: { description: 'Doppelerfassung in SAP' } },
          { type: 'tool', content: { name: 'SAP FI' } },
        ] as any,
      }),
    )
    expect(withEntries).not.toMatch(/Extrahierte Wissensobjekte/)
    expect(withEntries).not.toMatch(/Doppelerfassung in SAP/)
    expect(withEntries).not.toMatch(/\[pain_point\]/)
    expect(withEntries).not.toMatch(/\[tool\]/)

    const empty = buildDynamicContext(baseContext({ phase: 'explore', extractionsLog: [] }))
    expect(empty).not.toMatch(/Extrahierte Wissensobjekte/)
    expect(empty).not.toMatch(/Noch nichts extrahiert/)
  })
})

// ─── PROJ-46 (ADR-023 D1/D3): Ziel-Block — the binding target ────────────────
// Replaces the old advisory "NÄCHSTER TURN — Analyst-Empfehlung" (next_focus/
// suggested_question). No formulated question crosses the Analyst→Talker
// bridge anymore — only a bound step + O-field, or a transition instruction.

function trackerStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    status: 'walkthrough',
    reihenfolge: 1,
    potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null },
    slots: { entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null },
    governance: null,
    abhaengigkeiten: null,
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

describe('talkerPrompt — Ziel-Block (PROJ-46 / ADR-023 D1/D3)', () => {
  it('renders no Ziel-Block when nothing is locked and there is no transition', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'explore', stepTracker: [] }))
    expect(ctx).not.toMatch(/## Ziel \(bindend\)/)
  })

  it('renders the locked step + target O-field hint as a binding target', () => {
    const ctx = buildDynamicContext(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseContext({ phase: 'explore', stepTracker: [trackerStep()] as any, focusStepId: 'S001' }),
      { target_o_field: 'ausnahmen' },
    )
    expect(ctx).toMatch(/## Ziel \(bindend\)/)
    expect(ctx).toMatch(/Rechnungsprüfung/)
    expect(ctx).toMatch(/Ausnahmen oder Sonderfälle/)
    expect(ctx).toMatch(/bindend — formuliere die Frage selbst/)
  })

  it('renders a transition note on step_switch without announcing it as a phase change', () => {
    const ctx = buildDynamicContext(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseContext({ phase: 'explore', stepTracker: [trackerStep()] as any, focusStepId: 'S001', transitionReason: 'step_switch' }),
      { target_o_field: 'inputs' },
    )
    expect(ctx).toMatch(/Fokus hat gerade gewechselt/)
    expect(ctx).toMatch(/kurzen Übergangssatz/)
  })

  it('renders closing_entry guidance instead of a bound "Aktiver Schritt" line, even when focusStepId is set', () => {
    const ctx = buildDynamicContext(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseContext({ phase: 'closing', stepTracker: [trackerStep()] as any, focusStepId: 'S001', transitionReason: 'closing_entry' }),
      { target_o_field: 'inputs' },
    )
    expect(ctx).toMatch(/Übergang in die Entdeckungsphase/)
    expect(ctx).not.toMatch(/Aktiver Schritt:/)
  })

  it('renders the abhaengigkeiten (O6) hint when it is the chosen target field', () => {
    const ctx = buildDynamicContext(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseContext({ phase: 'explore', stepTracker: [trackerStep()] as any, focusStepId: 'S001' }),
      { target_o_field: 'abhaengigkeiten' },
    )
    expect(ctx).toMatch(/andere(n)? Schritte.*voraussetzt oder beeinflusst/)
  })
})

// ─── PROJ-46 (ADR-023 D5/F): Anker-Pflicht → Option ──────────────────────────

describe('talkerPrompt — Anker-Option (PROJ-46, KI-18 root cause)', () => {
  it('explore methodology frames the anchor as optional, not mandatory', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'explore' }))
    expect(ctx).toMatch(/Anker-Option/)
    expect(ctx).toMatch(/nicht verpflichtet/)
    expect(ctx).not.toMatch(/Anker-Pflicht/)
  })
})
