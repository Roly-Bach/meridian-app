/**
 * Stufe-1 tests (ADR-018 §F.1 / D8): the slot conflict resolution as a pure
 * function — no DB, no LLM. This is the mass of the PROJ-34 test suite and the
 * thing the whole feature exists to enable: canOverwrite, idempotency, the
 * done-transition and intra-pass read-after-write, all verifiable in isolation.
 */

import { describe, it, expect } from 'vitest'
import { applyIntent, findStepFuzzy, findStepById } from './applyIntent'
import type { ApplyContext, TurnSnapshot, RecordSlotIntent } from './intents'
import type {
  StepEntry,
  SlotValue,
  TaziteSlot,
  TaziteSlotArray,
} from '@/services/interviewSemantic'

const CTX: ApplyContext = { interviewId: 'iv-1', now: '2026-06-22T00:00:00.000Z', workspaceId: 'ws-1' }

function pslot(value: number, writeSource?: SlotValue['writeSource']): SlotValue {
  return { value, quote: 'q', ...(writeSource ? { writeSource } : {}) }
}
function tslot(value: string): TaziteSlot {
  return { value, quote: 'q', nicht_befund_typ: null }
}
function taslot(value: string[]): TaziteSlotArray {
  return { value, quote: 'q', nicht_befund_typ: null }
}

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    governance: null,
    abhaengigkeiten: null,
    potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null },
    status: 'exploring',
    slots: { entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null },
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

/** A step with every coverage slot filled except the ones listed in `holes`. */
function makeFullStep(holes: string[] = [], overrides: Partial<StepEntry> = {}): StepEntry {
  const step = makeStep({
    status: 'walkthrough',
    potenzial: {
      frequency_per_month: pslot(90, 'analyst_online'),
      duration_minutes: pslot(15, 'analyst_online'),
      error_rate_percent: pslot(2, 'analyst_online'),
      media_breaks: pslot(1, 'analyst_online'),
    },
    slots: {
      entscheidungslogik: tslot('nach Schema'),
      tazite_cues: taslot(['Erfahrung']),
      ausnahmen: taslot(['Sonderfall']),
      inputs: taslot(['Rechnung']),
      outputs: taslot(['Buchung']),
      hilfsmittel: taslot(['SAP']),
    },
    ...overrides,
  })
  for (const h of holes) {
    if (h in step.potenzial) (step.potenzial as Record<string, unknown>)[h] = null
    else (step.slots as Record<string, unknown>)[h] = null
  }
  return step
}

function makeSnapshot(steps: StepEntry[], overrides: Partial<TurnSnapshot> = {}): TurnSnapshot {
  return { stepTracker: steps, topicsCovered: [], topicsOpen: [], extractionsLog: [], ...overrides }
}

function recordSlot(extra: Partial<RecordSlotIntent> & Pick<RecordSlotIntent, 'slot'>): RecordSlotIntent {
  return {
    kind: 'record_slot',
    stepTitle: 'Rechnungsprüfung',
    isNichtBefundMode: false,
    quote: 'Beleg',
    writeSource: 'analyst_online',
    ...extra,
  }
}

// ─── step lookup ────────────────────────────────────────────────────────────

describe('step lookup', () => {
  it('findStepById matches stable id', () => {
    const t = [makeStep({ id: 'S001' }), makeStep({ id: 'S002', title: 'Monatsabschluss' })]
    expect(findStepById(t, 'S002')).toBe(1)
    expect(findStepById(t, 'S999')).toBe(-1)
  })
  it('findStepFuzzy: exact then jaccard ≥ 0.4', () => {
    const t = [makeStep({ title: 'Rechnungsprüfung und Kontierung' })]
    expect(findStepFuzzy(t, 'rechnungsprüfung und kontierung')).toBe(0) // exact ci
    expect(findStepFuzzy(t, 'völlig anderer Prozess XYZ')).toBe(-1)
  })
})

// ─── record_slot: accept / status transition ─────────────────────────────────

describe('record_slot — accept + status transition', () => {
  it('fills an empty potenzial slot, moves exploring → walkthrough, emits trail', () => {
    const snap = makeSnapshot([makeStep({ status: 'exploring' })])
    const out = applyIntent(snap, recordSlot({ slot: 'frequency_per_month', value: 90 }), CTX)

    expect(out.result.status).toBe('accepted')
    // snapshot mutated immutably
    expect(snap.stepTracker[0].potenzial.frequency_per_month).toBeNull()
    expect(out.snapshot.stepTracker[0].potenzial.frequency_per_month).toMatchObject({ value: 90, writeSource: 'analyst_online' })
    expect(out.snapshot.stepTracker[0].status).toBe('walkthrough')
    // patches: slot field + status transition (verbatim with today's two rpc calls)
    expect(out.patches).toEqual([
      { kind: 'step_field', stepIndex: 0, subPath: ['potenzial', 'frequency_per_month'], value: expect.objectContaining({ value: 90 }) },
      { kind: 'step_field', stepIndex: 0, subPath: ['status'], value: 'walkthrough' },
    ])
    // trail
    expect(out.trail).toHaveLength(1)
    expect(out.trail[0]).toMatchObject({ source: 'analyst_online', slot: 'frequency_per_month', value: 90, overwrite: false })
    expect(out.trail[0].blocked).toBeUndefined()
  })

  it('tazite array slot accepted; empty status transition when already walkthrough', () => {
    const snap = makeSnapshot([makeStep({ status: 'walkthrough' })])
    const out = applyIntent(snap, recordSlot({ slot: 'inputs', value: ['Rechnung', 'PO'] }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].slots.inputs).toMatchObject({ value: ['Rechnung', 'PO'], nicht_befund_typ: null })
    // no status patch (was already walkthrough)
    expect(out.patches).toEqual([
      { kind: 'step_field', stepIndex: 0, subPath: ['slots', 'inputs'], value: expect.objectContaining({ value: ['Rechnung', 'PO'] }) },
    ])
  })

  it('entscheidungslogik (single tazite) accepted', () => {
    const snap = makeSnapshot([makeStep({ status: 'walkthrough' })])
    const out = applyIntent(snap, recordSlot({ slot: 'entscheidungslogik', value: 'immer gleich' }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].slots.entscheidungslogik).toMatchObject({ value: 'immer gleich' })
  })

  it('nicht-befund mode (potenzial) stores value:null + marker', () => {
    const snap = makeSnapshot([makeStep({ status: 'walkthrough' })])
    const out = applyIntent(snap, recordSlot({ slot: 'error_rate_percent', value: undefined, isNichtBefundMode: true, nichtBefundTyp: 'unbekannt' }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].potenzial.error_rate_percent).toMatchObject({ value: null, nicht_befund_typ: 'unbekannt' })
    expect(out.trail[0].value).toBe('NICHT-BEFUND:unbekannt')
  })
})

// ─── record_slot: idempotency ────────────────────────────────────────────────

describe('record_slot — idempotency', () => {
  it('skips identical scalar value without correction', () => {
    const snap = makeSnapshot([makeStep({ status: 'walkthrough', potenzial: { ...makeStep().potenzial, frequency_per_month: pslot(90, 'analyst_online') } })])
    const out = applyIntent(snap, recordSlot({ slot: 'frequency_per_month', value: 90 }), CTX)
    expect(out.result.status).toBe('skipped')
    expect(out.result.reason).toBe('idempotent')
    expect(out.patches).toHaveLength(0)
    expect(out.trail).toHaveLength(0)
  })

  it('skips identical array value', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.slots.inputs = taslot(['A', 'B'])
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'inputs', value: ['A', 'B'] }), CTX)
    expect(out.result.status).toBe('skipped')
  })

  it('does NOT skip when is_correction=true (even if same value)', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.potenzial.frequency_per_month = pslot(90, 'analyst_online')
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'frequency_per_month', value: 90, isCorrection: true }), CTX)
    expect(out.result.status).toBe('accepted')
  })
})

// ─── record_slot: priority conflict (canOverwrite) ───────────────────────────

describe('record_slot — priority conflict', () => {
  it('blocks lower-priority overwrite of a higher-priority slot, emits blocked trail', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.potenzial.frequency_per_month = pslot(90, 'analyst_catchup') // priority 4
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'frequency_per_month', value: 120, writeSource: 'backfill' }), CTX) // priority 1
    expect(out.result.status).toBe('blocked')
    expect(out.result.reason).toBe('priority')
    expect(out.patches).toHaveLength(0)
    expect(out.trail).toHaveLength(1)
    expect(out.trail[0]).toMatchObject({ blocked: true, overwrite: true, source: 'backfill', value: 120 })
    // snapshot unchanged
    expect(out.snapshot.stepTracker[0].potenzial.frequency_per_month!.value).toBe(90)
  })

  it('allows equal-or-higher priority overwrite', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.potenzial.frequency_per_month = pslot(90, 'backfill')
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'frequency_per_month', value: 120, writeSource: 'analyst_online' }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].potenzial.frequency_per_month!.value).toBe(120)
  })

  // PROJ-44/ADR-021 D3: a historical interview whose slot trail still carries
  // writeSource='quick' (interviewQuickExtract.ts, removed) must degrade
  // correctly — canOverwrite's `?? 0` fallback treats the unrecognized string
  // as priority 0, so the current Analyst (priority 3) may overwrite it.
  it('degrades a historical "quick" writeSource to priority 0 — analyst_online may overwrite it', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.potenzial.frequency_per_month = { value: 90, quote: 'q', writeSource: 'quick' as SlotValue['writeSource'] }
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'frequency_per_month', value: 120, writeSource: 'analyst_online' }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].potenzial.frequency_per_month!.value).toBe(120)
  })

  it('does NOT apply priority gate to tazite slots (no writeSource competition)', () => {
    const step = makeStep({ status: 'walkthrough' })
    step.slots.inputs = taslot(['old'])
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'inputs', value: ['new'], writeSource: 'backfill' }), CTX)
    expect(out.result.status).toBe('accepted')
  })
})

// ─── record_slot: step not found ─────────────────────────────────────────────

describe('record_slot — step not found', () => {
  it('blocks with step_not_found + available list', () => {
    const out = applyIntent(makeSnapshot([makeStep({ title: 'Monatsabschluss', id: 'S001' })]), recordSlot({ stepTitle: 'Völlig anderer Prozess', slot: 'frequency_per_month', value: 1 }), CTX)
    expect(out.result.status).toBe('blocked')
    expect(out.result.reason).toBe('step_not_found')
    expect(out.result.detail).toMatchObject({ requested: 'Völlig anderer Prozess', available: [{ title: 'Monatsabschluss', id: 'S001' }] })
  })

  it('falls back from missing step_id to fuzzy title', () => {
    const out = applyIntent(makeSnapshot([makeStep({ id: 'S001', title: 'Rechnungsprüfung' })]), recordSlot({ stepId: 'S999', stepTitle: 'Rechnungsprüfung', slot: 'duration_minutes', value: 10 }), CTX)
    expect(out.result.status).toBe('accepted')
  })
})

// ─── record_slot: done-transition ────────────────────────────────────────────

describe('record_slot — done-transition', () => {
  it('flips status to done when the last hole is filled (extra status patch)', () => {
    const step = makeFullStep(['media_breaks']) // only media_breaks null
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'media_breaks', value: 0 }), CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].status).toBe('done')
    // last patch is the done transition
    expect(out.patches.at(-1)).toEqual({ kind: 'step_field', stepIndex: 0, subPath: ['status'], value: 'done' })
  })

  it('does NOT flip to done while a tazite hole remains', () => {
    const step = makeFullStep(['media_breaks', 'ausnahmen'])
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'media_breaks', value: 0 }), CTX)
    expect(out.snapshot.stepTracker[0].status).not.toBe('done')
    expect(out.patches.some((p) => p.kind === 'step_field' && p.subPath[0] === 'status' && p.value === 'done')).toBe(false)
  })

  it('nicht-befund counts as filled for done-transition', () => {
    const step = makeFullStep(['error_rate_percent'])
    const out = applyIntent(makeSnapshot([step]), recordSlot({ slot: 'error_rate_percent', value: undefined, isNichtBefundMode: true, nichtBefundTyp: 'nicht_zutreffend' }), CTX)
    expect(out.snapshot.stepTracker[0].status).toBe('done')
  })
})

// ─── read-after-write within a pass ──────────────────────────────────────────

describe('intra-pass read-after-write (ADR-018 Edge Case)', () => {
  it('register_step then record_slot sees the new step in the evolved snapshot', () => {
    let snap = makeSnapshot([])
    const newStep = makeStep({ id: 'S001', title: 'Rechnungsprüfung', status: 'exploring' })
    const reg = applyIntent(snap, { kind: 'register_step', tracker: [newStep] }, CTX)
    expect(reg.result.status).toBe('accepted')
    snap = reg.snapshot // session threads the evolved snapshot forward

    const rec = applyIntent(snap, recordSlot({ stepId: 'S001', slot: 'frequency_per_month', value: 90 }), CTX)
    expect(rec.result.status).toBe('accepted')
    expect(rec.snapshot.stepTracker[0].potenzial.frequency_per_month!.value).toBe(90)
  })
})

// ─── record_governance ───────────────────────────────────────────────────────

describe('record_governance', () => {
  it('partial merge keeps existing fields', () => {
    const step = makeStep({ governance: { rolle: 'Buchhalter', organisationseinheit: 'FI', systeme: null, nicht_befund_typ: null } })
    const out = applyIntent(makeSnapshot([step]), { kind: 'record_governance', stepTitle: 'Rechnungsprüfung', systeme: ['SAP'], quote: 'q' }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].governance).toEqual({ rolle: 'Buchhalter', organisationseinheit: 'FI', systeme: ['SAP'], nicht_befund_typ: null })
    expect(out.patches).toEqual([{ kind: 'step_field', stepIndex: 0, subPath: ['governance'], value: expect.objectContaining({ systeme: ['SAP'] }) }])
  })
  it('blocks when step not found', () => {
    const out = applyIntent(makeSnapshot([makeStep({ title: 'X' })]), { kind: 'record_governance', stepTitle: 'Nichtexistent', rolle: 'r', quote: null }, CTX)
    expect(out.result.status).toBe('blocked')
    expect(out.result.reason).toBe('step_not_found')
  })
})

// ─── record_dependency ───────────────────────────────────────────────────────

describe('record_dependency', () => {
  const two = () => [makeStep({ id: 'S001', title: 'A' }), makeStep({ id: 'S002', title: 'B' })]
  it('adds a depends_on edge', () => {
    const out = applyIntent(makeSnapshot(two()), { kind: 'record_dependency', mode: 'edge', sourceStepId: 'S001', targetStepId: 'S002', richtung: 'depends_on', typ: 'voraussetzung', beschreibung: null }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].abhaengigkeiten!.depends_on).toEqual([{ schritt_id: 'S002', typ: 'voraussetzung', beschreibung: null }])
  })
  it('skips a duplicate edge (idempotent)', () => {
    const steps = two()
    steps[0].abhaengigkeiten = { depends_on: [{ schritt_id: 'S002', typ: 'voraussetzung', beschreibung: null }], influences: [], nicht_befund_typ: null }
    const out = applyIntent(makeSnapshot(steps), { kind: 'record_dependency', mode: 'edge', sourceStepId: 'S001', targetStepId: 'S002', richtung: 'depends_on', typ: 'voraussetzung' }, CTX)
    expect(out.result.status).toBe('skipped')
    expect(out.result.reason).toBe('duplicate_edge')
  })
  it('blocks when target missing', () => {
    const out = applyIntent(makeSnapshot([makeStep({ id: 'S001' })]), { kind: 'record_dependency', mode: 'edge', sourceStepId: 'S001', targetStepId: 'S099', richtung: 'influences', typ: 'beeinflusst' }, CTX)
    expect(out.result.status).toBe('blocked')
    expect(out.result.reason).toBe('target_not_found')
  })
  it('sets nicht-befund marker', () => {
    const out = applyIntent(makeSnapshot([makeStep({ id: 'S001' })]), { kind: 'record_dependency', mode: 'nicht_befund', sourceStepId: 'S001', nichtBefundTyp: 'unbekannt' }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].abhaengigkeiten!.nicht_befund_typ).toBe('unbekannt')
  })
})

// ─── update_walkthrough_data ─────────────────────────────────────────────────

describe('update_walkthrough_data', () => {
  it('additive merge + full-array patch + exploring→walkthrough', () => {
    const out = applyIntent(makeSnapshot([makeStep({ status: 'exploring' })]), { kind: 'update_walkthrough_data', stepTitle: 'Rechnungsprüfung', friction_tools: ['Excel'] }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.stepTracker[0].friction_tools).toEqual(['Excel'])
    expect(out.snapshot.stepTracker[0].status).toBe('walkthrough')
    expect(out.patches).toEqual([{ kind: 'step_tracker', value: out.snapshot.stepTracker }])
  })
})

// ─── update_topics ───────────────────────────────────────────────────────────

describe('update_topics', () => {
  it('sets covered/open', () => {
    const out = applyIntent(makeSnapshot([]), { kind: 'update_topics', covered: ['a'], open: ['b'] }, CTX)
    expect(out.snapshot.topicsCovered).toEqual(['a'])
    expect(out.snapshot.topicsOpen).toEqual(['b'])
    expect(out.patches).toEqual([{ kind: 'topics', covered: ['a'], open: ['b'] }])
  })
})

// ─── link_bottleneck (two targets) ───────────────────────────────────────────

describe('link_bottleneck', () => {
  it('appends extractions_log + queues a knowledge_object insert', () => {
    const out = applyIntent(makeSnapshot([], { extractionsLog: [{ type: 'tool', content: {}, source_quote: '' }] }), { kind: 'link_bottleneck', stepTitle: 'Rechnungsprüfung', description: 'Zu viele Medienbrüche', severity: 'high' }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.snapshot.extractionsLog).toHaveLength(2)
    const kinds = out.patches.map((p) => p.kind).sort()
    expect(kinds).toEqual(['extractions_log', 'knowledge_object'])
    const ko = out.patches.find((p) => p.kind === 'knowledge_object')
    expect(ko).toMatchObject({ kind: 'knowledge_object', row: { interview_id: 'iv-1', workspace_id: 'ws-1', type: 'pain_point', source_quote: null } })
  })
})

// ─── produce_briefing (once per pass) ────────────────────────────────────────

describe('produce_briefing', () => {
  it('writes interviews patch with onlyIfNotDone guard', () => {
    const out = applyIntent(makeSnapshot([]), { kind: 'produce_briefing', briefing: { next_focus: 'X', suggested_question: 'Q?' } }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.patches).toEqual([{ kind: 'interview', fields: { next_briefing: { next_focus: 'X', suggested_question: 'Q?' }, analyst_status: 'done' }, onlyIfNotDone: true }])
    expect(out.snapshot.briefingProduced).toBe(true)
  })
  it('skips a second produce_briefing in the same pass', () => {
    const out = applyIntent(makeSnapshot([], { briefingProduced: true }), { kind: 'produce_briefing', briefing: { next_focus: 'X' } }, CTX)
    expect(out.result.status).toBe('skipped')
    expect(out.result.reason).toBe('briefing_already_produced')
    expect(out.patches).toHaveLength(0)
  })

  // #18 (2026-07-14): AnalystBriefingSchema has no usedFillerPhrases field, so the
  // LLM-produced `intent.briefing` never carries it. Before the fix, the patch below
  // wrote `intent.briefing` verbatim — silently wiping whatever interviewTalker.ts's
  // own read-merge-write had persisted into interviews.next_briefing.usedFillerPhrases.
  it('preserves usedFillerPhrases from the snapshot even though the briefing carries none', () => {
    const snapshot = makeSnapshot([], { usedFillerPhrases: ['Vielen Dank', 'Interessant'] })
    const out = applyIntent(snapshot, { kind: 'produce_briefing', briefing: { next_focus: 'X', suggested_question: 'Q?' } }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.patches).toEqual([{
      kind: 'interview',
      fields: {
        next_briefing: { next_focus: 'X', suggested_question: 'Q?', usedFillerPhrases: ['Vielen Dank', 'Interessant'] },
        analyst_status: 'done',
      },
      onlyIfNotDone: true,
    }])
  })

  it('does not add an empty usedFillerPhrases key when the snapshot has none', () => {
    const out = applyIntent(makeSnapshot([]), { kind: 'produce_briefing', briefing: { next_focus: 'X', suggested_question: 'Q?' } }, CTX)
    expect(out.patches).toEqual([{
      kind: 'interview',
      fields: { next_briefing: { next_focus: 'X', suggested_question: 'Q?' }, analyst_status: 'done' },
      onlyIfNotDone: true,
    }])
  })
})

// ─── backfill_data_sources ───────────────────────────────────────────────────

describe('backfill_data_sources', () => {
  it('full-array patch + per-step backfill trail events', () => {
    const tracker = [makeStep({ slots: { ...makeStep().slots, hilfsmittel: taslot(['SAP', 'Excel']) } })]
    const out = applyIntent(makeSnapshot([makeStep()]), { kind: 'backfill_data_sources', tracker, emits: [{ stepTitle: 'Rechnungsprüfung', value: ['SAP', 'Excel'] }] }, CTX)
    expect(out.result.status).toBe('accepted')
    expect(out.patches).toEqual([{ kind: 'step_tracker', value: tracker }])
    expect(out.trail).toHaveLength(1)
    expect(out.trail[0]).toMatchObject({ source: 'backfill', slot: 'data_sources', value: ['SAP', 'Excel'], overwrite: false })
  })
})
