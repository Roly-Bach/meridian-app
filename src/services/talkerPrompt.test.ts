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

// ─── KI-20 regression: tool-call syntax must never appear as literal prompt text ──
// Root cause (2026-07-11): the explore (formerly walkthrough_step) few-shot example
// used to show the tool call as bracket/parameter pseudo-code ("AGENT: [ruft
// update_walkthrough_data(...) auf]"). Models across vendors (confirmed:
// google/gemini-3.1-flash-lite, google/gemini-3.5-flash, openrouter/minimax/minimax-m3)
// sometimes imitated that notation literally as visible output instead of making a
// structured tool call — 11 of 14 historically affected transcripts were on the demo
// baseline, not OSS models. These tests guard against reintroducing that pattern.

describe('talkerPrompt — KI-20 tool-call leakage regression', () => {
  it('explore dynamic context contains no bracket-wrapped tool-call pseudo-code', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'explore' }))
    expect(ctx).not.toMatch(/\[ruft\s/)
    expect(ctx).not.toMatch(/AGENT:\s*\[/)
    // no "toolName(" style call syntax anywhere in the rendered prompt
    expect(ctx).not.toMatch(/update_walkthrough_data\(/)
  })

  it('explore example explicitly marks the tool call as silent/never-visible-text', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'explore' }))
    expect(ctx).toMatch(/lautlos, NIEMALS als Text ausgeben/)
  })

  it('STATIC_PROMPT forbids emitting tool-call/bracket syntax in the visible answer', () => {
    expect(STATIC_PROMPT).toMatch(/eckige Klammern/)
    expect(STATIC_PROMPT).toMatch(/Tool-Aufrufe sind ausschließlich strukturierte Calls/)
  })

  it('other phases do not inject the explore few-shot example at all', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing' }))
    expect(ctx).not.toMatch(/EXAMPLE phase="explore"/)
  })
})

// ─── KI-19 regression: scripted farewell turn must not re-ask the closing probe ───
// Root cause (2026-07-11): the completion/farewell call (runInterviewTurn.ts, after
// resolveTurnLifecycle already decided complete=true) passed phase='closing' into
// createTalkerStream like any normal turn, so it inherited the unconditional PFLICHT
// "ask the closing probe first" methodology text — which routinely beat the softer
// advisory farewellBriefing and made the model re-ask a question instead of saying
// goodbye. Confirmed on 36/82 (44%) historical gemini-3.1-flash-lite transcripts.

describe('talkerPrompt — KI-19 farewell methodology regression', () => {
  it('normal closing turn (isCompletionFarewell unset) still gets the PFLICHT ask-first instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing' }))
    expect(ctx).toMatch(/PFLICHT: Stelle als allererste Antwort/)
    expect(ctx).toMatch(/Wenn du an deine letzte Arbeitswoche denkst/)
  })

  it('scripted completion farewell (isCompletionFarewell=true) suppresses the ask-first instruction', () => {
    const ctx = buildDynamicContext(baseContext({ phase: 'closing', isCompletionFarewell: true }))
    expect(ctx).not.toMatch(/PFLICHT: Stelle als allererste Antwort/)
    expect(ctx).not.toMatch(/Wenn du an deine letzte Arbeitswoche denkst/)
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
      }),
      { next_focus: 'irrelevant', suggested_question: 'irrelevant' },
    )
    expect(ctx).not.toMatch(/Schritt-Tracker/)
    expect(ctx).not.toMatch(/Rechnungsprüfung/)
    expect(ctx).not.toMatch(/Extrahierte Wissensobjekte/)
    expect(ctx).not.toMatch(/Doppelerfassung/)
    expect(ctx).not.toMatch(/NÄCHSTER TURN/)
    expect(ctx).not.toMatch(/VARIANZ-GEBOT/)
    expect(ctx).not.toMatch(/AMBIGUITÄT-KLÄRUNG/)
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
    governance: { rolle: 'Buchhalter', nicht_befund_typ: null },
    abhaengigkeiten: null,
    process_steps: ['Prüfen', 'Buchen'],
    friction_points: ['Doppelerfassung'],
    friction_tools: ['SAP'],
    pain_point_primary: null,
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
    expect(ctx).not.toMatch(/governance: Buchhalter/)
    // process_steps/friction context is retained for follow-up questions about other steps.
    expect(ctx).toMatch(/process_steps: Prüfen → Buchen/)
    expect(ctx).toMatch(/friction_points: Doppelerfassung/)
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
    expect(ctx).toMatch(/governance: Buchhalter/)
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
