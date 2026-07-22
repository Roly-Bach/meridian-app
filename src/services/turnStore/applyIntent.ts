/**
 * applyIntent — the pure conflict/apply core behind `TurnStore.stage` (PROJ-34 / ADR-018 D3).
 *
 * Given a snapshot + a WriteIntent, returns the new snapshot, the physical
 * FieldPatches a commit replays, the slot-write-trail events to emit, and the
 * synchronous StageResult. No DB, no LLM, no I/O — this is the module that makes
 * the slot conflict resolution (canOverwrite / idempotency / done-transition)
 * testable in isolation (Stufe 1).
 *
 * Behaviour neutrality (ADR-018 §G) is the hard requirement: the record_slot
 * logic below is transcribed verbatim from interviewAgent.ts `record_slot.execute`.
 * Conflict rules, idempotency, status- and done-transitions are unchanged.
 */

import {
  POTENZIAL_SLOT_NAMES,
  TAZITE_ARRAY_SLOT_NAMES,
  TAZITE_ENUM_ARRAY_SLOT_NAMES,
  TAZITE_SLOT_NAMES,
  tokenJaccardNorm,
  type StepEntry,
  type SchemaSlotNumber,
  type SchemaSlotString,
  type SchemaSlotStringArray,
  type SchemaSlotBase,
  type Abhaengigkeiten,
  type AbhaengigkeitsKante,
  type EinflussKante,
  type PotenzialSlotName,
  type TaziteSlotName,
  type RawExtraction,
} from '@/services/interviewSemantic'
import { canOverwrite, type WriteSource } from '@/services/slotConflictResolver'
import type { SlotWriteEvent } from '@/services/slotWriteTrail'
import type { Json } from '@/lib/database.types'
import type {
  ApplyContext,
  ApplyOutcome,
  FieldPatch,
  RecordSlotIntent,
  RecordDependencyIntent,
  LinkBottleneckIntent,
  RegisterStepIntent,
  ProduceBriefingIntent,
  BackfillDataSourcesIntent,
  TurnSnapshot,
  WriteIntent,
} from './intents'

const TAZITE_ARRAY_SLOTS: readonly string[] = [...TAZITE_ARRAY_SLOT_NAMES, ...TAZITE_ENUM_ARRAY_SLOT_NAMES]

// ─── Step lookup (pure — mirrors interviewAgent.ts) ───────────────────────────

/**
 * Fuzzy step title lookup. Exact (case-insensitive) match first, else best
 * tokenJaccardNorm ≥ 0.4. Returns index or -1. Transcribed from interviewAgent.
 */
export function findStepFuzzy(tracker: StepEntry[], stepTitle: string): number {
  const normalized = stepTitle.trim().toLowerCase()
  const exact = tracker.findIndex((s) => s.title.trim().toLowerCase() === normalized)
  if (exact !== -1) return exact
  let bestScore = 0
  let bestIdx = -1
  for (let i = 0; i < tracker.length; i++) {
    const score = tokenJaccardNorm(tracker[i].title, stepTitle)
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestScore >= 0.4 ? bestIdx : -1
}

/** Stable-ID lookup (PROJ-27/BL-E1.4). */
export function findStepById(tracker: StepEntry[], stepId: string): number {
  return tracker.findIndex((s) => s.id === stepId)
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

/** Immutable replace of one step entry. */
function withStep(snapshot: TurnSnapshot, index: number, step: StepEntry): TurnSnapshot {
  const stepTracker = snapshot.stepTracker.slice()
  stepTracker[index] = step
  return { ...snapshot, stepTracker }
}

/** No-op outcome (skipped/blocked carry no patches or snapshot change). */
function noWrite(snapshot: TurnSnapshot, status: 'skipped' | 'blocked', reason: ApplyOutcome['result']['reason'], detail?: Record<string, unknown>, trail: SlotWriteEvent[] = []): ApplyOutcome {
  return { snapshot, patches: [], trail, result: { status, reason, ...(detail ? { detail } : {}) } }
}

// ─── record_slot — the conflict core (verbatim) ──────────────────────────────

function applyRecordSlot(snapshot: TurnSnapshot, intent: RecordSlotIntent, ctx: ApplyContext): ApplyOutcome {
  const { stepId, stepTitle, slot, value, nichtBefundTyp, isNichtBefundMode, quote, confidence, qualifier, einheit, sourceTurn, isCorrection, writeSource } = intent
  const tracker = snapshot.stepTracker

  // ID-first lookup (PROJ-27/BL-E1.4): stable reference, falls back to fuzzy title.
  const stepIndex = stepId !== undefined
    ? (() => {
        const byId = findStepById(tracker, stepId)
        return byId !== -1 ? byId : findStepFuzzy(tracker, stepTitle)
      })()
    : findStepFuzzy(tracker, stepTitle)

  if (stepIndex === -1) {
    return noWrite(snapshot, 'blocked', 'step_not_found', {
      requested: stepId ?? stepTitle,
      available: tracker.map((s) => ({ title: s.title, id: s.id ?? null })),
    })
  }

  const step = tracker[stepIndex]

  // teilschritte — bare additive array, no SchemaSlot wrapper (PROJ-45/ADR-025 D4:
  // absorbed from the retired update_walkthrough_data tool into record_slot; the
  // LLM passes the full cumulative array each call, same additive contract as before).
  if (slot === 'teilschritte') {
    const newArray = value as string[]
    const prevArray = step.teilschritte ?? []
    const same = newArray.length === prevArray.length && newArray.every((v, i) => v === prevArray[i])
    if (same) {
      return noWrite(snapshot, 'skipped', 'idempotent', { slot, stepTitle: step.title })
    }
    const newStatus = step.status === 'exploring' ? 'walkthrough' : step.status
    const newStep: StepEntry = { ...step, teilschritte: newArray, status: newStatus }
    const patches: FieldPatch[] = [{ kind: 'step_field', stepIndex, subPath: ['teilschritte'], value: newArray as unknown as Json }]
    if (newStatus !== step.status) {
      patches.push({ kind: 'step_field', stepIndex, subPath: ['status'], value: newStatus })
    }
    const acceptedEvent: SlotWriteEvent = {
      ts: ctx.now,
      interviewId: ctx.interviewId,
      source: writeSource,
      stepTitle: step.title,
      slot,
      value: newArray,
      prevValue: prevArray,
      overwrite: prevArray.length > 0,
      sourceTurn: sourceTurn ?? null,
      evidence: quote,
    }
    return {
      snapshot: withStep(snapshot, stepIndex, newStep),
      patches,
      trail: [acceptedEvent],
      result: { status: 'accepted', detail: { step_id: step.id, step_title: step.title, slot, value: newArray, source_turn: sourceTurn ?? null } },
    }
  }

  const isPotenzial = (POTENZIAL_SLOT_NAMES as readonly string[]).includes(slot)
  const isTaziteArray = TAZITE_ARRAY_SLOTS.includes(slot)

  const prevSlotValue: SchemaSlotNumber | SchemaSlotString | SchemaSlotStringArray | SchemaSlotBase<unknown> | null = isPotenzial
    ? step.potenzial[slot as PotenzialSlotName]
    : step.slots[slot as TaziteSlotName]
  const isOverwrite = prevSlotValue !== null && prevSlotValue !== undefined

  // Idempotency: skip when value is identical (Pt11).
  if (isOverwrite && !isCorrection) {
    const prevVal = prevSlotValue?.value
    const same = Array.isArray(value) && Array.isArray(prevVal)
      ? value.length === (prevVal as string[]).length && (value as string[]).every((v, i) => v === (prevVal as string[])[i])
      : value === prevVal
    if (same) {
      return noWrite(snapshot, 'skipped', 'idempotent', { slot, stepTitle: step.title })
    }
  }

  // Priority conflict (ADR-016): potenzial slots only.
  if (isPotenzial) {
    const prevAsSlotValue = prevSlotValue as SchemaSlotNumber | null
    const priorityBlocked = isOverwrite && !isCorrection && !canOverwrite(prevAsSlotValue?.writeSource, writeSource as WriteSource)
    if (priorityBlocked) {
      const blockedEvent: SlotWriteEvent = {
        ts: ctx.now,
        interviewId: ctx.interviewId,
        source: writeSource,
        stepTitle: step.title,
        slot,
        value,
        prevValue: prevAsSlotValue?.value,
        overwrite: true,
        blocked: true,
        sourceTurn: sourceTurn ?? null,
        evidence: quote,
      }
      return noWrite(snapshot, 'blocked', 'priority', {
        slot,
        prevSource: prevAsSlotValue?.writeSource ?? 'unknown',
        newSource: writeSource,
      }, [blockedEvent])
    }
  }

  // Build the new slot value + patches + status transition.
  const patches: FieldPatch[] = []
  let newSlotValue: SchemaSlotNumber | SchemaSlotString | SchemaSlotStringArray | SchemaSlotBase<unknown>
  let newStep: StepEntry

  if (isPotenzial) {
    const newStatus = step.status === 'exploring' ? 'walkthrough' : step.status
    newSlotValue = isNichtBefundMode
      ? ({ value: null, quote, writeSource: writeSource as WriteSource, nicht_befund_typ: nichtBefundTyp!, ...(einheit !== undefined ? { einheit } : {}) } as SchemaSlotNumber)
      : ({
          value: value!,
          quote,
          writeSource: writeSource as WriteSource,
          nicht_befund_typ: null,
          ...(confidence !== undefined ? { confidence } : {}),
          ...(qualifier !== undefined ? { qualifier } : {}),
          ...(einheit !== undefined ? { einheit } : {}),
        } as SchemaSlotNumber)
    patches.push({ kind: 'step_field', stepIndex, subPath: ['potenzial', slot], value: newSlotValue as unknown as Json })
    if (newStatus !== step.status) {
      patches.push({ kind: 'step_field', stepIndex, subPath: ['status'], value: newStatus })
    }
    newStep = {
      ...step,
      potenzial: { ...step.potenzial, [slot]: newSlotValue },
      status: newStatus,
    }
  } else if (isTaziteArray) {
    newSlotValue = {
      value: value as string[],
      quote,
      nicht_befund_typ: null,
      ...(confidence !== undefined ? { confidence } : {}),
    } as SchemaSlotStringArray
    patches.push({ kind: 'step_field', stepIndex, subPath: ['slots', slot], value: newSlotValue as unknown as Json })
    const newStatus = step.status === 'exploring' ? 'walkthrough' : step.status
    if (step.status === 'exploring') {
      patches.push({ kind: 'step_field', stepIndex, subPath: ['status'], value: 'walkthrough' })
    }
    newStep = { ...step, slots: { ...step.slots, [slot]: newSlotValue }, status: newStatus }
  } else {
    // Single-value slots: entscheidungslogik/ausloeser (SchemaSlotString) or the
    // Analyst-classified standardisierungsgrad/informationsdichte (enum single) —
    // identical mechanics, only the value's literal-union type differs.
    newSlotValue = {
      value: value as string,
      quote,
      nicht_befund_typ: null,
      ...(confidence !== undefined ? { confidence } : {}),
    } as SchemaSlotString
    patches.push({ kind: 'step_field', stepIndex, subPath: ['slots', slot], value: newSlotValue as unknown as Json })
    const newStatus = step.status === 'exploring' ? 'walkthrough' : step.status
    if (step.status === 'exploring') {
      patches.push({ kind: 'step_field', stepIndex, subPath: ['status'], value: 'walkthrough' })
    }
    newStep = { ...step, slots: { ...step.slots, [slot]: newSlotValue }, status: newStatus }
  }

  // Auto-transition to 'done' (uses merged in-memory snapshot + new value).
  const allPotenzialFilled = POTENZIAL_SLOT_NAMES.every((s) => {
    const sv = newStep.potenzial[s]
    return sv != null && (sv.value != null || (sv.nicht_befund_typ ?? null) != null)
  })
  const allTaziteFilled = TAZITE_SLOT_NAMES.every((s) => {
    const sv = newStep.slots[s]
    return sv != null && (sv.value != null || sv.nicht_befund_typ != null)
  })
  if (allPotenzialFilled && allTaziteFilled && step.status !== 'done') {
    patches.push({ kind: 'step_field', stepIndex, subPath: ['status'], value: 'done' })
    newStep = { ...newStep, status: 'done' }
  }

  const acceptedEvent: SlotWriteEvent = {
    ts: ctx.now,
    interviewId: ctx.interviewId,
    source: writeSource,
    stepTitle: step.title,
    slot,
    value: isNichtBefundMode ? `NICHT-BEFUND:${nichtBefundTyp}` : value,
    prevValue: prevSlotValue?.value,
    overwrite: isOverwrite,
    sourceTurn: sourceTurn ?? null,
    evidence: quote,
  }

  return {
    snapshot: withStep(snapshot, stepIndex, newStep),
    patches,
    trail: [acceptedEvent],
    result: {
      status: 'accepted',
      detail: {
        step_id: step.id,
        step_title: step.title,
        slot,
        ...(isNichtBefundMode ? { nicht_befund_typ: nichtBefundTyp } : { value }),
        source_turn: sourceTurn ?? null,
      },
    },
  }
}

// ─── record_dependency (typed edge / nicht-befund, jsonb_set) ─────────────────

function applyRecordDependency(snapshot: TurnSnapshot, intent: RecordDependencyIntent): ApplyOutcome {
  const { mode, sourceStepId, targetStepId, richtung, typ, beschreibung, nichtBefundTyp } = intent
  const tracker = snapshot.stepTracker

  const sourceIndex = tracker.findIndex((s) => s.id === sourceStepId)
  if (sourceIndex === -1) {
    return noWrite(snapshot, 'blocked', 'step_not_found', {
      requested: sourceStepId,
      available: tracker.map((s) => s.id ?? s.title),
    })
  }
  if (mode === 'edge') {
    const targetExists = tracker.some((s) => s.id === targetStepId)
    if (!targetExists) {
      return noWrite(snapshot, 'blocked', 'target_not_found', {
        requested: targetStepId,
        available: tracker.map((s) => s.id ?? s.title),
      })
    }
  }

  const existing: Abhaengigkeiten = tracker[sourceIndex].abhaengigkeiten ?? {
    depends_on: [],
    influences: [],
    nicht_befund_typ: null,
  }

  let updated: Abhaengigkeiten
  if (mode === 'nicht_befund') {
    updated = { ...existing, nicht_befund_typ: nichtBefundTyp! }
  } else if (richtung === 'depends_on') {
    if (existing.depends_on.some((k) => k.schritt_id === targetStepId && k.typ === typ)) {
      return noWrite(snapshot, 'skipped', 'duplicate_edge', { message: 'Kante bereits vorhanden (idempotent)' })
    }
    const newKante: AbhaengigkeitsKante = { schritt_id: targetStepId!, typ: typ as AbhaengigkeitsKante['typ'], beschreibung: beschreibung ?? null }
    updated = { ...existing, depends_on: [...existing.depends_on, newKante] }
  } else {
    if (existing.influences.some((k) => k.schritt_id === targetStepId && k.typ === typ)) {
      return noWrite(snapshot, 'skipped', 'duplicate_edge', { message: 'Kante bereits vorhanden (idempotent)' })
    }
    const newKante: EinflussKante = { schritt_id: targetStepId!, typ: typ as EinflussKante['typ'], beschreibung: beschreibung ?? null }
    updated = { ...existing, influences: [...existing.influences, newKante] }
  }

  return {
    snapshot: withStep(snapshot, sourceIndex, { ...tracker[sourceIndex], abhaengigkeiten: updated }),
    patches: [{ kind: 'step_field', stepIndex: sourceIndex, subPath: ['abhaengigkeiten'], value: updated as unknown as Json }],
    trail: [],
    result: { status: 'accepted', detail: { source_step_id: sourceStepId, abhaengigkeiten: updated } },
  }
}

// ─── link_bottleneck (two targets) ─────────────────────────────────────────────

function applyLinkBottleneck(snapshot: TurnSnapshot, intent: LinkBottleneckIntent, ctx: ApplyContext): ApplyOutcome {
  const { stepTitle, description, severity } = intent
  const content = { description, severity, step_ref: stepTitle }
  const logEntry: RawExtraction = { type: 'pain_point', content, source_quote: '' }
  const newLog = [...snapshot.extractionsLog, logEntry]
  const patches: FieldPatch[] = [
    {
      kind: 'knowledge_object',
      row: { interview_id: ctx.interviewId, workspace_id: ctx.workspaceId, type: 'pain_point', content, source_quote: null },
    },
    { kind: 'extractions_log', value: newLog },
  ]
  return {
    snapshot: { ...snapshot, extractionsLog: newLog },
    patches,
    trail: [],
    result: { status: 'accepted', detail: { step_title: stepTitle, severity } },
  }
}

// ─── register_step (full-array set; tool owns dedup/embedding decisions) ──────

function applyRegisterStep(snapshot: TurnSnapshot, intent: RegisterStepIntent): ApplyOutcome {
  return {
    snapshot: { ...snapshot, stepTracker: intent.tracker },
    patches: [{ kind: 'step_tracker', value: intent.tracker }],
    trail: [],
    result: { status: 'accepted' },
  }
}

// ─── produce_briefing (interviews update; once per pass) ──────────────────────

function applyProduceBriefing(snapshot: TurnSnapshot, intent: ProduceBriefingIntent): ApplyOutcome {
  if (snapshot.briefingProduced) {
    return noWrite(snapshot, 'skipped', 'briefing_already_produced')
  }
  // #18: AnalystBriefingSchema (the LLM tool-call schema) has no usedFillerPhrases
  // field, so intent.briefing never carries it — merge back what the snapshot had
  // at load time so this commit doesn't wipe interviewTalker.ts's own persisted value.
  const briefing = snapshot.usedFillerPhrases?.length
    ? { ...intent.briefing, usedFillerPhrases: snapshot.usedFillerPhrases }
    : intent.briefing
  return {
    snapshot: { ...snapshot, briefingProduced: true },
    patches: [
      {
        kind: 'interview',
        fields: { next_briefing: briefing, analyst_status: 'done' },
        onlyIfNotDone: true,
      },
    ],
    trail: [],
    result: { status: 'accepted' },
  }
}

// ─── backfill_data_sources (full-array + trail emits) ─────────────────────────

function applyBackfill(snapshot: TurnSnapshot, intent: BackfillDataSourcesIntent, ctx: ApplyContext): ApplyOutcome {
  const trail: SlotWriteEvent[] = intent.emits.map(({ stepTitle, value }) => ({
    ts: ctx.now,
    interviewId: ctx.interviewId,
    source: 'backfill',
    stepTitle,
    slot: 'data_sources',
    value,
    overwrite: false,
    evidence: '[auto-backfill aus erwähnten Tools/Systemen]',
  }))
  return {
    snapshot: { ...snapshot, stepTracker: intent.tracker },
    patches: [{ kind: 'step_tracker', value: intent.tracker }],
    trail,
    result: { status: 'accepted' },
  }
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────

export function applyIntent(snapshot: TurnSnapshot, intent: WriteIntent, ctx: ApplyContext): ApplyOutcome {
  switch (intent.kind) {
    case 'record_slot':
      return applyRecordSlot(snapshot, intent, ctx)
    case 'record_dependency':
      return applyRecordDependency(snapshot, intent)
    case 'link_bottleneck':
      return applyLinkBottleneck(snapshot, intent, ctx)
    case 'register_step':
      return applyRegisterStep(snapshot, intent)
    case 'produce_briefing':
      return applyProduceBriefing(snapshot, intent)
    case 'backfill_data_sources':
      return applyBackfill(snapshot, intent, ctx)
  }
}
