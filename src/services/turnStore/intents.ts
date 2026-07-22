/**
 * WriteIntent + TurnStore vocabulary (PROJ-34 / ADR-018).
 *
 * The eight knowledge tools no longer write to Supabase as a side effect. Each
 * returns a `WriteIntent` describing *what* should be written. A single place
 * (`applyIntent`, the pure conflict/apply core behind `TurnStore.stage`) decides
 * `accepted | skipped | blocked`, mutates an in-memory snapshot, and produces the
 * physical `FieldPatch`es a `commit()` replays.
 *
 * This module is pure types + must stay side-effect-free and free of any
 * server-only imports (no supabase-admin, no next/server, no ai SDK), so the
 * eval replay path (tsx) and pure tests can import it freely.
 */

import type { Json } from '@/lib/database.types'
import type {
  StepEntry,
  NichtBefundTyp,
  PotenzialSlotName,
  TaziteSlotName,
  RawExtraction,
} from '@/services/interviewSemantic'
import type { WriteSource } from '@/services/slotConflictResolver'
import type { AnalystBriefing } from '@/services/interviewTypes'
import type { SlotWriteEvent } from '@/services/slotWriteTrail'

export type { WriteSource } from '@/services/slotConflictResolver'

// ─── Snapshot ───────────────────────────────────────────────────────────────
//
// Loaded once per session at openTurn. During the pass the snapshot is the
// truth: every `stage()` applies its intent against it immediately so a second
// tool in the same pass sees the first tool's effect (Read-after-Write,
// ADR-018 D2). `commit()` persists at pass end.

export interface TurnSnapshot {
  stepTracker: StepEntry[]
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  /**
   * Transient per-pass flag — true once a produce_briefing intent has been
   * accepted in this session. Enforces the "exactly once per turn" rule
   * (ADR-018 Edge Cases): a second produce_briefing is `skipped`. Not a DB
   * column; defaults to false on load.
   */
  briefingProduced?: boolean
  /**
   * #18 (2026-07-14): interviews.next_briefing.usedFillerPhrases as it existed
   * at snapshot load time. AnalystBriefingSchema (the LLM tool-call schema) has
   * no usedFillerPhrases field, so a produce_briefing intent's `briefing` never
   * carries it — applyProduceBriefing merges this snapshot value back in so the
   * Analyst's commit doesn't silently overwrite what interviewTalker.ts's
   * separate read-merge-write persisted. Loaded once per session; not re-read
   * mid-pass (no tool mutates it), so a same-turn race with the Talker's own
   * write is only narrowed, not eliminated — acceptable per the plan (no
   * store-level merge, no DB migration).
   */
  usedFillerPhrases?: string[]
}

// ─── Knowledge-object insert (link_bottleneck second target) ──────────────────

export interface KnowledgeObjectInsert {
  interview_id: string
  workspace_id: string
  type: 'pain_point'
  content: Record<string, unknown>
  source_quote: string | null
}

// ─── Physical writes (replayed by commit) ─────────────────────────────────────
//
// Mirrors today's two step_tracker mechanics + the other three persistence
// targets exactly (ADR-018 §B table), so a `commit()` reproduces the current
// write sequence:
//   - `step_field`  → patch_interview_step_field RPC (atomic jsonb_set; the
//                     race-safe path used by record_slot/governance/dependency)
//   - `step_tracker`→ full-array `.update({ step_tracker })` (register_step,
//                     update_walkthrough_data, data_sources backfill)
//   - `topics` / `extractions_log` / `knowledge_object` / `interview`

export type FieldPatch =
  | { kind: 'step_field'; stepIndex: number; subPath: string[]; value: Json }
  | { kind: 'step_tracker'; value: StepEntry[] }
  | { kind: 'extractions_log'; value: RawExtraction[] }
  | { kind: 'knowledge_object'; row: KnowledgeObjectInsert }
  | {
      kind: 'interview'
      fields: { next_briefing?: AnalystBriefing; analyst_status?: string }
      /** When true, replay must guard with `.neq('analyst_status','done')` (PROJ-27/BL-E1.5). */
      onlyIfNotDone?: boolean
    }

// ─── Write intents (one variant per writing surface) ──────────────────────────

/**
 * register_step — append a new step. The tool keeps all read/decide logic
 * (exact/substring dedup, colon-parent guard, embedding similarity, embedding
 * hydration) and only stages the resulting full tracker array when it decides
 * to write. `tracker` already contains any hydrated embeddings + the new entry.
 */
export interface RegisterStepIntent {
  kind: 'register_step'
  tracker: StepEntry[]
}

/**
 * record_slot — the conflict core. The tool keeps evidence resolution, type
 * guards and NICHT-BEFUND parsing; `stage` owns step lookup, idempotency,
 * priority (`canOverwrite`) and the done-transition (ADR-018 D3).
 */
export interface RecordSlotIntent {
  kind: 'record_slot'
  stepId?: string
  stepTitle: string
  slot: PotenzialSlotName | TaziteSlotName | 'teilschritte'
  /** Resolved value (post NICHT-BEFUND parse). Undefined in NICHT-BEFUND mode. */
  value?: string | number | string[]
  nichtBefundTyp?: Exclude<NichtBefundTyp, null>
  isNichtBefundMode: boolean
  /** Deterministically resolved evidence (span→sentence or fallback quote). */
  quote: string
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  qualifier?: string | null
  /** PROJ-45 (ADR-025 D5): unit as stated by the employee — potenzial slots only. */
  einheit?: string | null
  sourceTurn?: number | null
  isCorrection?: boolean
  writeSource: WriteSource
}

/** record_dependency — typed edge add or nicht-befund marker on the source step. */
export interface RecordDependencyIntent {
  kind: 'record_dependency'
  mode: 'edge' | 'nicht_befund'
  sourceStepId: string
  targetStepId?: string
  richtung?: 'depends_on' | 'influences'
  typ?: string
  beschreibung?: string | null
  nichtBefundTyp?: Exclude<NichtBefundTyp, null>
}

/** link_bottleneck — two targets: a knowledge_objects insert + extractions_log append. */
export interface LinkBottleneckIntent {
  kind: 'link_bottleneck'
  stepTitle: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

/** produce_briefing — interviews.next_briefing + analyst_status='done'. */
export interface ProduceBriefingIntent {
  kind: 'produce_briefing'
  briefing: AnalystBriefing
}

/**
 * data_sources backfill — not produced by an LLM tool, but routed through the
 * same `stage` pipeline (ADR-018 §C) so the full-array write + trail emission
 * are applied uniformly. `tracker` is the post-backfill array; `emits` are the
 * per-step trail payloads.
 */
export interface BackfillDataSourcesIntent {
  kind: 'backfill_data_sources'
  tracker: StepEntry[]
  emits: Array<{ stepTitle: string; value: string[] }>
}

export type WriteIntent =
  | RegisterStepIntent
  | RecordSlotIntent
  | RecordDependencyIntent
  | LinkBottleneckIntent
  | ProduceBriefingIntent
  | BackfillDataSourcesIntent

// ─── Stage result (synchronous feedback to the tool) ──────────────────────────

export type StageStatus = 'accepted' | 'skipped' | 'blocked'

export type StageReason =
  | 'idempotent'
  | 'priority'
  | 'step_not_found'
  | 'target_not_found'
  | 'duplicate_edge'
  | 'briefing_already_produced'

export interface StageResult {
  status: StageStatus
  /** Machine reason for skipped/blocked — lets the tool format the exact LLM message. */
  reason?: StageReason
  /** Extra fields the tool needs to render its response (matched step, available steps, prev source, …). */
  detail?: Record<string, unknown>
}

// ─── Apply outcome (pure function output) ──────────────────────────────────────

export interface ApplyContext {
  interviewId: string
  /** ISO timestamp used for trail events — injected for deterministic tests. */
  now: string
  /** Workspace id — needed for the link_bottleneck knowledge_objects insert. */
  workspaceId: string
}

export interface ApplyOutcome {
  /** New snapshot (applyIntent never mutates its input). */
  snapshot: TurnSnapshot
  /** Physical writes to replay on commit — empty for skipped/blocked. */
  patches: FieldPatch[]
  /** Slot-write-trail events to emit (record_slot accepted+blocked, backfill). */
  trail: SlotWriteEvent[]
  /** Synchronous result handed back to the caller/tool. */
  result: StageResult
}
