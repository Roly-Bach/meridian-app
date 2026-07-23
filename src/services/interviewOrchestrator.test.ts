import { describe, it, expect } from 'vitest'

import {
  resolveTurnLifecycle,
  computeFocusLock,
  updateODrought,
  computeTargetOFieldFallback,
  computeTransitionReason,
  type OrchestratorContext,
} from './interviewOrchestrator'
import type { StepEntry } from './interviewSemantic'
import type { ODroughtState } from './interviewTypes'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const emptyPotenzial: StepEntry['potenzial'] = {
  frequency: null,
  duration: null,
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
  reibungspunkte: null,
  ausloeser: null,
  aufgabentyp: null,
  risiko_schwere: null,
  standardisierungsgrad: null,
  informationsdichte: null,
}

const fullPotenzial: StepEntry['potenzial'] = {
  frequency: { value: 8, quote: 'zweimal pro Woche', confidence: 'estimate' as const, nicht_befund_typ: null },
  duration: { value: 30, quote: '30 Minuten', confidence: 'confirmed' as const, nicht_befund_typ: null },
  error_rate_percent: { value: 0, quote: 'keine Fehler', confidence: 'confirmed' as const, nicht_befund_typ: null },
  media_breaks: { value: 0, quote: 'keine Brüche', confidence: 'confirmed' as const, nicht_befund_typ: null },
}

// PROJ-45: O_SLOT_FIELDS grew from 6 (entscheidungslogik/ausnahmen/inputs/outputs/
// hilfsmittel/abhaengigkeiten) to 10 (+ reibungspunkte/aufgabentyp/risiko_schwere/
// ausloeser) — "full O2–O6 coverage" now requires all 10 filled, not just the
// original 6. tazite_cues stays filled too (Aspekt-i, opportunistic, not itself
// in O_SLOT_FIELDS per ADR-025 D3, but harmless to have filled).
const fullSlots: StepEntry['slots'] = {
  entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
  tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
  ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null },
  inputs: { value: ['Rechnung'], quote: 'Rechnung', nicht_befund_typ: null },
  outputs: { value: ['Buchung'], quote: 'Buchung', nicht_befund_typ: null },
  hilfsmittel: { value: ['SAP'], quote: 'in SAP', nicht_befund_typ: null },
  reibungspunkte: { value: ['Doppelerfassung'], quote: 'Doppelerfassung', nicht_befund_typ: null },
  ausloeser: { value: 'Rechnungseingang per E-Mail', quote: 'kommt per E-Mail', nicht_befund_typ: null },
  aufgabentyp: { value: ['entscheidung'], quote: 'ich entscheide', nicht_befund_typ: null },
  risiko_schwere: { value: ['leicht_korrigierbar'], quote: 'leicht korrigierbar', nicht_befund_typ: null },
  standardisierungsgrad: null,
  informationsdichte: null,
}

// PROJ-46/ADR-024 (B/C, D3 Coverage-Sanity): exactly 2 filled O_SLOT_FIELDS —
// satisfies MIN_SUBSTANTIAL_O_FIELDS so discovery_exhausted can be honored,
// without being fully covered (isolates the Coverage-Sanity guard from D3's
// separate "full coverage exhausts a step" behavior). PROJ-45 (ADR-025 D3):
// tazite_cues is filled too but does NOT count toward O_SLOT_FIELDS coverage
// (Aspekt-i, opportunistic, dropped from the Interview-Engine's own target set)
// — entscheidungslogik + ausnahmen are the 2 fields that actually count here.
const substantiallyCoveredSlots: StepEntry['slots'] = {
  entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
  tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
  ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null },
  inputs: null,
  outputs: null,
  hilfsmittel: null,
  reibungspunkte: null,
  ausloeser: null,
  aufgabentyp: null,
  risiko_schwere: null,
  standardisierungsgrad: null,
  informationsdichte: null,
}

// Full O2–O6 coverage (10 O_SLOT_FIELDS, PROJ-45) but streak still low —
// the D3 "exhaustion fires on full coverage" scenario. Potenzial is irrelevant to
// O-coverage (O2–O6 only), left empty on purpose.
const fullAbhaengigkeiten: StepEntry['abhaengigkeiten'] = {
  depends_on: [{ schritt_id: 'S000', typ: 'voraussetzung', beschreibung: null }],
  influences: [],
  nicht_befund_typ: null,
}

function makeStep(title: string, status: 'exploring' | 'walkthrough' | 'done', slots: StepEntry['slots'] = emptySlots, extra: Partial<StepEntry> = {}): StepEntry {
  return { title, reihenfolge: 1, abhaengigkeiten: null, status, potenzial: emptyPotenzial, slots, ...extra }
}

const emptyODrought: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: [] }

function baseCtx(overrides: Partial<OrchestratorContext> = {}): OrchestratorContext {
  return {
    phase: 'intro',
    stepTracker: [],
    timerMinutes: 5,
    maxDurationMinutes: 30,
    historyLength: 2,
    hadExtractionThisTurn: false,
    oDrought: emptyODrought,
    ...overrides,
  }
}

// ─── intro transitions ────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — intro', () => {
  it('stays in intro before first agent response (historyLength=1)', () => {
    expect(resolveTurnLifecycle(baseCtx({ historyLength: 1 }), null).phase).toBe('intro')
  })

  it('advances to explore after first agent response (historyLength=2)', () => {
    expect(resolveTurnLifecycle(baseCtx({ historyLength: 2 }), null).phase).toBe('explore')
  })
})

// ─── explore transitions ──────────────────────────────────────────────────────

describe('resolveTurnLifecycle — explore (content-driven, PROJ-42)', () => {
  it('stays in explore with no advance signal and no active step', () => {
    expect(resolveTurnLifecycle(baseCtx({ phase: 'explore', stepTracker: [] }), null).phase).toBe('explore')
  })

  it('stays in explore while an active step exists and no advance signal set', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    expect(resolveTurnLifecycle(baseCtx({ phase: 'explore', stepTracker: tracker }), null).phase).toBe('explore')
  })

  // PROJ-44 Remediation (M-1): the old topicsOpen-based hasUnexploredFocusTopic
  // breadth check is replaced by a tracker-derived O-Drought exhaustion check —
  // depth and breadth collapse into one criterion (see computeFocusLock/
  // updateODrought/hasUnexhaustedStep tests further below for the primitive itself).
  it('stays in explore when step_advance_ready is true but the locked step is not yet drought-exhausted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('explore')
  })

  it('advances to closing when step_advance_ready is true and the only registered step has drought-fired (hit the default limit K=3)', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  it('advances to closing when the only registered step is already done (no unexhausted step remains)', () => {
    const tracker = [makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  // PROJ-46 (ADR-023 D3): full O2–O6 coverage exhausts a step immediately,
  // independent of its drought streak — otherwise a step whose 7th field fills
  // the same turn its streak resets to 0 would stay locked with no empty
  // target for up to K more turns.
  it('advances to closing when the only registered step has full O2–O6 coverage despite a fresh (low) streak', () => {
    const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
    const oDrought: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: [fullyCovered], oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  // PROJ-46/ADR-024 (B/C, D1/D2): replaces the former no-new-extraction streak
  // safety net — the Analyst's own discovery_exhausted Readiness judgment may
  // open Closing directly, Coverage-Sanity-guarded against an empty/barely-
  // started interview.
  describe('discovery_exhausted Readiness (PROJ-46/ADR-024 B/C)', () => {
    it('stays in explore when discovery_exhausted is true but no step is substantially covered yet (Coverage-Sanity guard)', () => {
      const ctx = baseCtx({ phase: 'explore', stepTracker: [] })
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: true }).phase).toBe('explore')
    })

    it('opens closing when discovery_exhausted is true, at least one step is substantially covered, and no step is completely unexplored', () => {
      // PROJ-48 (KI-30, verengt): this branch is gated by hasUnexploredStep
      // (= some step with 0 O-fields), NOT hasUnexhaustedStep (= not fully
      // covered). A step with real O-coverage (substantiallyCoveredSlots ≥2)
      // never counts as unexplored, so this opens closing regardless of its
      // drought streak.
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
      const ctx = baseCtx({ phase: 'explore', stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: true }).phase).toBe('closing')
    })

    it('opens closing even when a registered step is only PARTIALLY covered (not full), as long as none is completely unexplored', () => {
      // Core regression fix: the old hasUnexhaustedStep gate blocked closing
      // whenever ANY step was not fully 10/10 covered — with 4–6 partially
      // covered processes it never closed (buchhalter run2/run3 farewell loop).
      // A 6/10 step must NOT block closing.
      const partiallyCovered = makeStep('Monatsabschluss', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })
      const alsoPartial = makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S002' })
      const ctx = baseCtx({ phase: 'explore', stepTracker: [partiallyCovered, alsoPartial] })
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: true }).phase).toBe('closing')
    })

    it('stays in explore when discovery_exhausted is false/omitted, even with substantial coverage', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
      const ctx = baseCtx({ phase: 'explore', stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, {}).phase).toBe('explore')
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: false }).phase).toBe('explore')
    })

    // PROJ-48 (KI-30): discovery_exhausted previously opened closing on
    // hasSubstantialCoverage alone (any ONE step with ≥2 O-fields) — a second,
    // freshly-registered, unexhausted step could be steamrolled right
    // alongside it. Real case (buchhalter 34ca9cd4): the Analyst registered
    // "Mahnlauf" (first mention) and set discovery_exhausted:true in the same
    // tool-call batch, before a single question about Mahnlauf was asked.
    it('does NOT open closing when discovery_exhausted is true and one step is substantially covered, but another registered step is still unexhausted', () => {
      const covered = makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })
      const freshlyRegistered = makeStep('Mahnlauf', 'exploring', emptySlots, { id: 'S002' })
      const ctx = baseCtx({ phase: 'explore', stepTracker: [covered, freshlyRegistered] })
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: true }).phase).toBe('explore')
    })

    it('opens closing via discovery_exhausted when multiple steps exist, each exhausted through a different mechanism (streak-fired vs. fully covered)', () => {
      const droughtFired = makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S002', abhaengigkeiten: fullAbhaengigkeiten })
      const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
      const ctx = baseCtx({ phase: 'explore', stepTracker: [droughtFired, fullyCovered], oDrought })
      expect(resolveTurnLifecycle(ctx, { discovery_exhausted: true }).phase).toBe('closing')
    })
  })

  describe('wall-clock soft anchor (~80% of budget)', () => {
    it('stays in explore below the soft anchor', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 23, maxDurationMinutes: 30 })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    it('advances to closing at the soft anchor when no step is actively being explored', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 24, maxDurationMinutes: 30, stepTracker: [] })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('grants a capped grace period to an actively-explored step at the soft anchor instead of an abrupt pivot', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      // 30-min budget: soft anchor=24min, grace=min(3, 6)=3min → grace window 24-27min
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    it('forces closing once the grace period expires, even with an active step', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 27, maxDurationMinutes: 30, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('grace window is naturally capped by the hard stop for short interviews (10-min config, Tim regression)', () => {
      // 10-min budget: soft anchor=8min, grace=min(3, 2)=2min → window ends exactly at hard stop (10min)
      const tracker = [makeStep('IT-Support-Ticket', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 9, maxDurationMinutes: 10, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    // PROJ-46 QA H-1 Fix A: hasActiveStep used to read raw status
    // (hasStepInStatus(...'exploring'|'walkthrough')), which practically never
    // leaves those statuses (applyIntent.ts's auto-'done' transition requires
    // every potenzial slot filled too — the KI-23 "praktisch nie true"
    // condition). That bought a status='walkthrough' step up to
    // MAX_GRACE_MINUTES of extra explore time at the soft anchor even once it
    // was already O-exhausted. Now coupled to the same exhaustion check the
    // Fokus-Lock uses (hasUnexhaustedStep) — an exhausted step releases the
    // phase immediately instead of waiting out the grace window.
    it('does not grant a grace period to a step whose drought already fired, even though it is still status=walkthrough', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
      const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
      // 30-min budget: soft anchor=24min, grace window would be 24-27min for an ACTIVE step
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: tracker, oDrought })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('does not grant a grace period to a step whose O2–O6 coverage is already full, even with a fresh (low) streak', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const oDrought: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: [fullyCovered], oDrought })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })
  })
})

// ─── closing transitions (PROJ-46 / ADR-023 D4: phase-bound streak, no scripted probe) ──

describe('resolveTurnLifecycle — closing (PROJ-46 discovery continuation)', () => {
  // The explore→closing ENTRY turn: ctx.phase is still 'explore' (loaded state),
  // even though resolvePhaseTransition resolves to 'closing' this turn — must
  // never soft-confirm-complete on this same turn (≥1 discovery question guarantee).
  it('never completes on the explore→closing entry turn, even with discovery_exhausted already true', () => {
    // Well under the soft anchor (timerMinutes=5 vs. 24) so the transition is
    // driven by discovery_exhausted itself, not the wall-clock branch. PROJ-48
    // (KI-30, verengt): the gate is hasUnexploredStep — the substantially
    // covered step (2 O-fields) is not unexplored, so closing opens regardless
    // of its drought streak.
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
    const ctx = baseCtx({ phase: 'explore', timerMinutes: 5, maxDurationMinutes: 30, stepTracker: tracker })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('stays in closing, not yet complete, when already in closing but discovery_exhausted is false/omitted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'closing', stepTracker: tracker, oDrought })
    const result = resolveTurnLifecycle(ctx, {})
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(false)
  })

  it('completes once already in closing AND discovery_exhausted is true, Coverage-Sanity satisfied, no cards', () => {
    // PROJ-43 (AC4): "no cards" now requires the three mandatory numeric slots
    // to actually be filled — an empty potenzial (makeStep's default) would
    // otherwise trigger the deterministic Card gate and route to clarification.
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001', potenzial: fullPotenzial })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'closing', stepTracker: tracker, oDrought })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
    expect(result.reason).toBe('soft_confirm')
  })

  it('does NOT complete when discovery_exhausted is true but no step is substantially covered (Coverage-Sanity guard, nie leer abschließen)', () => {
    const ctx = baseCtx({ phase: 'closing', stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(false)
  })

  it('advances to clarification instead of completing when the Analyst provided clarification_cards', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const analystSuggestion = {
      discovery_exhausted: true,
      clarification_cards: [{ process_step_id: 'uuid-1', step_title: 'Rechnungsprüfung', question: 'Wie oft?', options: ['Täglich', 'Wöchentlich', 'Andere'], slot_key: 'frequency' }],
    }
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: tracker, oDrought }), analystSuggestion)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })

  it('routes a newly-discovered process during closing back to explore, first-class (no clarification-only cap)', () => {
    const lateStep = makeStep('Reisekostenabrechnung', 'exploring')
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: [lateStep] }), null)
    expect(result.phase).toBe('explore')
    expect(result.complete).toBe(false)
  })

  // PROJ-48 (KI-30): hasStepInStatus('exploring') only catches a freshly-
  // registered step in the exact turn it's created — a single filled slot
  // (even a potenzial-only field, applyIntent.ts) already flips status to
  // 'walkthrough', and hadExtractionThisTurn only counts O2–O6 growth, not
  // potenzial writes. Real case (buchhalter 34ca9cd4): "Mahnlauf" registered +
  // frequency-filled in the same turn, status already 'walkthrough' by the
  // time this check runs, hadExtractionThisTurn false (potenzial-only) — the
  // interview completed the same turn with 0/10 O-fields for Mahnlauf.
  it('routes an unexhausted walkthrough-status step back to explore even when it is not "exploring" and no O-field grew this turn', () => {
    const barelyStarted = makeStep('Mahnlauf', 'walkthrough', emptySlots, {
      id: 'S002',
      potenzial: { ...emptyPotenzial, frequency: { value: 1, quote: '...', confidence: 'estimate' as const, nicht_befund_typ: null } },
    })
    const ctx = baseCtx({ phase: 'closing', stepTracker: [barelyStarted], hadExtractionThisTurn: false })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('explore')
    expect(result.complete).toBe(false)
  })

  // PROJ-48 (KI-30, verengt): the core closing regression. The old
  // hasUnexhaustedStep reentry check bounced every quiet closing turn back to
  // explore whenever ANY step was not fully 10/10 covered — with several
  // partially-covered processes the interview could never hold closing and
  // never completed (buchhalter run2 reopened at turn 29, run3 dragged through
  // 4 goodbye turns). A partially-covered (non-exhausted, non-zero) step must
  // NOT bounce closing back to explore.
  it('stays in closing and completes when the only step is partially covered (not full) and no O-field grew this turn', () => {
    const partiallyCovered = makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001', potenzial: fullPotenzial })
    const ctx = baseCtx({ phase: 'closing', stepTracker: [partiallyCovered], hadExtractionThisTurn: false })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
    expect(result.reason).toBe('soft_confirm')
  })

  it('stays in closing (multiple partially-covered processes) instead of the pre-fix farewell loop', () => {
    const p1 = makeStep('Monatsabschluss', 'walkthrough', substantiallyCoveredSlots, { id: 'S001', potenzial: fullPotenzial })
    const p2 = makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S002', potenzial: fullPotenzial })
    const ctx = baseCtx({ phase: 'closing', stepTracker: [p1, p2], hadExtractionThisTurn: false })
    const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
  })

  // PROJ-46 (ADR-023 D4, M7-b): generalizes the former H-1 newStepThisTurn veto —
  // ANY applied knowledge write this turn (not just a brand-new step) routes
  // back to explore instead of letting Closing complete out from under fresh content.
  describe('M7-b: hadExtractionThisTurn veto', () => {
    it('routes back to explore when a knowledge write was applied this turn, even with no exploring step', () => {
      const doneStep = makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })
      const ctx = baseCtx({ phase: 'closing', stepTracker: [doneStep], hadExtractionThisTurn: true })
      const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
      expect(result.phase).toBe('explore')
      expect(result.complete).toBe(false)
    })

    it('stays in closing (and can complete) when no knowledge write was applied this turn', () => {
      const doneStep = makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })
      const ctx = baseCtx({ phase: 'closing', stepTracker: [doneStep], hadExtractionThisTurn: false })
      const result = resolveTurnLifecycle(ctx, { discovery_exhausted: true })
      expect(result.phase).toBe('closing')
      expect(result.complete).toBe(true)
    })
  })

  it('does not rely on text-heuristic farewell-loop detection (removed, KI-23) — repeated goodbyes alone do not complete without discovery_exhausted', () => {
    const ctx = baseCtx({ phase: 'closing', stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, {})
    expect(result.complete).toBe(false)
  })
})

// ─── clarification ────────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — clarification', () => {
  it('stays in clarification (route handler owns the exit via DB)', () => {
    const result = resolveTurnLifecycle(baseCtx({ phase: 'clarification' }), null)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })
})

// ─── Hard-Stop ────────────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — hard stop', () => {
  it('forces closing + completes when timer exceeded from any phase, no pending cards', () => {
    const a = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 30, maxDurationMinutes: 30 }), null)
    expect(a.phase).toBe('closing')
    expect(a.complete).toBe(true)
    expect(a.reason).toBe('hard_stop')

    const b = resolveTurnLifecycle(baseCtx({ phase: 'intro', timerMinutes: 31, maxDurationMinutes: 30 }), null)
    expect(b.phase).toBe('closing')
    expect(b.complete).toBe(true)
    expect(b.reason).toBe('hard_stop')
  })

  it('does not regress a hard-stopped, actively-exploring step back to explore', () => {
    // PROJ-43 (AC4): fullPotenzial so this test isolates the hard-stop/phase
    // regression concern it's actually about — an empty potenzial (makeStep's
    // default) would otherwise route to clarification via the deterministic gate.
    const tracker = [makeStep('Rechnungsprüfung', 'exploring', emptySlots, { potenzial: fullPotenzial })]
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', timerMinutes: 30, maxDurationMinutes: 30, stepTracker: tracker }), null)
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
  })

  // ADR-022 (Nutzer-Korrektur 2026-07-17): Trigger A must not discard a still-open
  // mandatory numeric slot — it carries the quantitative ROI data. PROJ-43: the
  // Card is now deterministically computed from the tracker itself rather than
  // relying on the Analyst having already proposed one.
  it('routes to clarification instead of completing when a mandatory numeric slot is still open', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
    const result = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 30, maxDurationMinutes: 30, stepTracker: tracker }), null)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })
})

// ─── D2 terminination invariant ───────────────────────────────────────────────

describe('resolveTurnLifecycle — D2 terminination invariant', () => {
  it('never returns complete:true with reason soft_confirm outside a resolved closing phase', () => {
    // explore, well under any threshold — no way to reach complete:true via soft_confirm.
    const result = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 5, maxDurationMinutes: 30 }), null)
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('does NOT complete when clarification_cards are pending, even with discovery_exhausted true', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', substantiallyCoveredSlots, { id: 'S001' })]
    const analystSuggestion = {
      discovery_exhausted: true,
      clarification_cards: [{ process_step_id: 'x', step_title: 'Test', question: 'Wie oft?', options: ['A', 'B'], slot_key: 'frequency' }],
    }
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: tracker }), analystSuggestion)
    expect(result.complete).toBe(false)
  })

  it('does NOT complete when a newly-discovered process is still exploring during closing', () => {
    const tracker = [makeStep('Reisekostenabrechnung', 'exploring')]
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: tracker }), null)
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  // PROJ-46 (ADR-023 D4, M7-b): same scenario, but via the generalized
  // hadExtractionThisTurn veto instead of a still-exploring step.
  it('does NOT complete when a knowledge write was applied this turn (M7-b), even with discovery_exhausted true', () => {
    const tracker = [makeStep('Reisekostenabrechnung', 'walkthrough', substantiallyCoveredSlots, { id: 'S002' })]
    const result = resolveTurnLifecycle(
      baseCtx({ phase: 'closing', stepTracker: tracker, hadExtractionThisTurn: true }),
      { discovery_exhausted: true },
    )
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })
})

// ─── computeFocusLock / updateODrought (PROJ-44/46 Remediation) ──────────────

describe('computeFocusLock (M-3 Fokus-Lock)', () => {
  it('locks onto the first candidate step when no previous lock exists and all candidates are equally (un)covered — deterministic tie fallback', () => {
    const tracker = [
      makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
      makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
    ]
    const lock = computeFocusLock(tracker, null)
    expect(lock.stepId).toBe('S001')
    expect(lock.streak).toBe(0)
    expect(lock.exhaustedStepIds).toEqual([])
  })

  // PROJ-48 (KI-29, revidiert): the earlier pickMostSalientCandidate heuristic
  // (prefer the candidate with the most filled O2–O6 fields) was removed — it
  // pulled toward the already-advanced step and let freshly-mentioned 0-field
  // steps wait, which is the wrong direction for breadth/closing (verified
  // against the buchhalter regression runs). When no previous lock can be
  // continued, the first still-open candidate in registration order wins.
  // Start-/relevance ordering stays deliberately out of scope here → PROJ-49.
  describe('PROJ-48 (KI-29): first-candidate (registration order) when no previous lock can be continued', () => {
    it('locks the first still-open candidate in registration order, not the one with more filled O2–O6 fields', () => {
      const firstRegistered = makeStep('HR: Event-Organisation', 'exploring', emptySlots, { id: 'S001' })
      const deeperButLater = makeStep('Recruiting', 'walkthrough', {
        ...emptySlots,
        ausloeser: { value: 'Bedarfsanmeldung durch Manager', quote: '...', nicht_befund_typ: null },
        entscheidungslogik: { value: 'Abstimmung mit Head of HR', quote: '...', nicht_befund_typ: null },
      }, { id: 'S002' })
      const lock = computeFocusLock([firstRegistered, deeperButLater], null)
      expect(lock.stepId).toBe('S001')
      expect(lock.streak).toBe(0)
    })

    it('picks the first non-exhausted candidate in array order when recovering from an exhausted previous lock', () => {
      const exhaustedPrev = makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })
      const shallowButFirst = makeStep('Mahnlauf', 'exploring', emptySlots, { id: 'S002' })
      const deeperButLater = makeStep('Monatsabschluss', 'walkthrough', {
        ...emptySlots,
        hilfsmittel: { value: ['SAP FI', 'Excel'], quote: '...', nicht_befund_typ: null },
        risiko_schwere: { value: ['teuer'], quote: '...', nicht_befund_typ: null },
      }, { id: 'S003' })
      const previous: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
      const lock = computeFocusLock([exhaustedPrev, shallowButFirst, deeperButLater], previous)
      expect(lock.stepId).toBe('S002')
      expect(lock.exhaustedStepIds).toContain('S001')
    })
  })

  it('keeps the lock on the same step across turns while it is not yet drought-exhausted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    const previous: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBe('S001')
    expect(lock.streak).toBe(1)
  })

  it('switches to the next candidate step once the drought limit fires (default K=3), marking the old step exhausted', () => {
    const tracker = [
      makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
      makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
    ]
    const previous: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBe('S002')
    expect(lock.streak).toBe(0)
    expect(lock.exhaustedStepIds).toContain('S001')
  })

  it('never re-locks a previously-exhausted step even if it is the only remaining candidate structurally reachable', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    const previous: ODroughtState = { stepId: 'S001', streak: 5, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBeNull()
    expect(lock.exhaustedStepIds).toContain('S001')
  })

  it('ignores done steps as lock candidates', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots, { id: 'S001', potenzial: fullPotenzial })]
    const lock = computeFocusLock(tracker, null)
    expect(lock.stepId).toBeNull()
  })

  it('respects O_DROUGHT_LIMIT env override', () => {
    const prev = process.env.O_DROUGHT_LIMIT
    process.env.O_DROUGHT_LIMIT = '1'
    try {
      const tracker = [
        makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
        makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
      ]
      const previous: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
      const lock = computeFocusLock(tracker, previous)
      expect(lock.stepId).toBe('S002')
    } finally {
      if (prev === undefined) delete process.env.O_DROUGHT_LIMIT
      else process.env.O_DROUGHT_LIMIT = prev
    }
  })

  // PROJ-46 (ADR-023 D3): full O2–O6 coverage exhausts a step immediately,
  // independent of streak — never re-locked, even with streak=0.
  describe('D3: exhaustion on full O2–O6 coverage', () => {
    it('never locks a non-done step whose O2–O6 coverage is already complete', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const lock = computeFocusLock([fullyCovered], null)
      expect(lock.stepId).toBeNull()
      expect(lock.exhaustedStepIds).toContain('S001')
    })

    it('advances past a fully-covered step to the next candidate, without waiting for the streak', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const other = makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' })
      const previous: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
      const lock = computeFocusLock([fullyCovered, other], previous)
      expect(lock.stepId).toBe('S002')
    })
  })
})

describe('updateODrought (M-1/M-3 shared primitive)', () => {
  it('resets the streak to 0 when the locked step gained a new O-field this turn', () => {
    // PROJ-45 (ADR-025 D3): tazite_cues was dropped from O_SLOT_FIELDS (Aspekt-i,
    // opportunistic only) — use 'ausnahmen', which still counts, so this exercises
    // the same "genuinely new O-field" behavior the test name describes.
    const before = makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })
    const after = makeStep('Rechnungsprüfung', 'walkthrough', {
      ...emptySlots,
      ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null },
    }, { id: 'S001' })
    const lock: ODroughtState = { stepId: 'S001', streak: 2, exhaustedStepIds: [] }
    const updated = updateODrought(lock, [before], [after])
    expect(updated.streak).toBe(0)
  })

  it('increments the streak when no new O-field appeared for the locked step', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })
    const lock: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const updated = updateODrought(lock, [step], [step])
    expect(updated.streak).toBe(2)
  })

  it('stays a no-op when nothing is locked and the tracker is still empty (no candidates to lock onto)', () => {
    const lock: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: ['S001'] }
    const updated = updateODrought(lock, [], [])
    expect(updated).toEqual(lock)
  })

  // PROJ-48 (KI-29): previously `if (lock.stepId == null) return lock` short-
  // circuited unconditionally, silently discarding steps the Analyst just
  // registered THIS turn (the common bootstrap case — a first substantive
  // answer naming 2+ recurring tasks at once). Real cases (buchhalter
  // 34ca9cd4, Giorgia bcecd7ba): both steps got registered in the same turn,
  // the null lock was carried forward untouched, and the NEXT turn's
  // computeFocusLock fell back to array-order candidates[0] instead of the
  // step actually being discussed.
  describe('PROJ-48 (KI-29): bootstrap recompute when stepId was null but the tracker just gained content', () => {
    it('establishes a real lock in the SAME turn multiple steps get registered (first candidate in registration order)', () => {
      const lock: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: [] }
      const eventOrg = makeStep('HR: Event-Organisation', 'exploring', emptySlots, { id: 'S001' })
      const recruiting = makeStep('Recruiting', 'walkthrough', {
        ...emptySlots,
        ausloeser: { value: 'Bedarfsanmeldung durch Manager', quote: '...', nicht_befund_typ: null },
        entscheidungslogik: { value: 'Abstimmung mit Head of HR', quote: '...', nicht_befund_typ: null },
      }, { id: 'S002' })
      // KI-29's kept benefit: a real lock IS established this turn (vs. carrying
      // null forward) so the Talker gets a Ziel-Block from turn 1. Which step it
      // picks is plain registration order (pickMostSalientCandidate removed).
      const updated = updateODrought(lock, [], [eventOrg, recruiting])
      expect(updated.stepId).toBe('S001')
      expect(updated.streak).toBe(0)
    })

    it('stays stepId=null when the tracker gained steps but all are already done/fully covered', () => {
      const lock: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: [] }
      const doneStep = makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })
      const updated = updateODrought(lock, [], [doneStep])
      expect(updated.stepId).toBeNull()
    })
  })
})

// ─── computeTargetOFieldFallback (PROJ-46 / ADR-023 D1) ──────────────────────

describe('computeTargetOFieldFallback', () => {
  it('returns null when there is no locked step', () => {
    expect(computeTargetOFieldFallback(undefined)).toBeNull()
  })

  it('returns the first empty O2–O6 field in COVERAGE_FIELDS order', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('entscheidungslogik')
  })

  it('skips already-filled fields (value or nicht_befund_typ) and returns the next open one', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', {
      entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
      tazite_cues: { value: null, quote: null, nicht_befund_typ: 'unbekannt' },
      ausnahmen: null,
      inputs: null,
      outputs: null,
      hilfsmittel: null,
      reibungspunkte: null,
      ausloeser: null,
      aufgabentyp: null,
      risiko_schwere: null,
      standardisierungsgrad: null,
      informationsdichte: null,
    }, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('ausnahmen')
  })

  it('returns abhaengigkeiten (O6) last, once all other O2–O5 fields are filled', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', fullSlots, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('abhaengigkeiten')
  })

  it('returns null when every O2–O6 field is already filled', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
    expect(computeTargetOFieldFallback(step)).toBeNull()
  })
})

// ─── computeTransitionReason (PROJ-46 / ADR-023 D1) ──────────────────────────

describe('computeTransitionReason', () => {
  it('returns closing_entry when the resolved phase enters closing from a non-closing phase', () => {
    expect(computeTransitionReason('S001', null, 'explore', 'closing')).toBe('closing_entry')
  })

  it('prioritizes closing_entry even when the locked step also changed', () => {
    expect(computeTransitionReason('S001', 'S002', 'explore', 'closing')).toBe('closing_entry')
  })

  it('returns step_switch when the locked step id changed but the phase did not newly enter closing', () => {
    expect(computeTransitionReason('S001', 'S002', 'explore', 'explore')).toBe('step_switch')
  })

  it('returns null when the same step remains locked', () => {
    expect(computeTransitionReason('S001', 'S001', 'explore', 'explore')).toBeNull()
  })

  it('returns null when nothing was locked before or after', () => {
    expect(computeTransitionReason(null, null, 'explore', 'explore')).toBeNull()
  })

  it('returns null once already in closing on both sides (no repeated closing_entry)', () => {
    expect(computeTransitionReason(null, null, 'closing', 'closing')).toBeNull()
  })
})
