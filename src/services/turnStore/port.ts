/**
 * TurnStore port (PROJ-34 / ADR-018 D2, D4).
 *
 * A session per write-pass: `openTurn` loads the snapshot, `stage` applies an
 * intent against the live in-memory snapshot (Read-after-Write within the pass)
 * and returns `accepted | skipped | blocked`, `commit` persists the queued
 * patches at pass end (D5, non-transactional, in stage order).
 *
 * The snapshot/stage/commit machinery is identical across adapters; only the
 * physical persistence differs. So adapters implement the narrow
 * `TurnStoreBackend` and share `createTurnStore`. Prod = SupabaseTurnStore,
 * Eval = PGliteTurnStore — same contract, same commit semantics.
 *
 * Side-effect-free at import (no server-only, no pglite): the concrete backends
 * live in their own modules so the eval (tsx) path only pulls in PGlite.
 */

import { applyIntent } from './applyIntent'
import type {
  FieldPatch,
  TurnSnapshot,
  WriteIntent,
  StageResult,
  KnowledgeObjectInsert,
} from './intents'
import { emitSlotWrite } from '@/services/slotWriteTrail'
import type { Json } from '@/lib/database.types'
import type { StepEntry } from '@/services/interviewSemantic'
import type { RawExtraction } from '@/services/extraction'
import type { AnalystBriefing } from '@/services/interviewTypes'

export interface TurnSession {
  /** The live snapshot — truth during the pass. */
  snapshot(): TurnSnapshot
  /** Apply an intent against the snapshot; emits trail; queues patches. Synchronous. */
  stage(intent: WriteIntent): StageResult
  /** Persist the queued patches at pass end (sequential, in stage order). */
  commit(): Promise<void>
}

export interface TurnStore {
  openTurn(interviewId: string, workspaceId: string): Promise<TurnSession>
}

/**
 * Narrow persistence surface a `commit()` replays onto. The two step_tracker
 * mechanics + three other targets mirror today's writes exactly (ADR-018 §B).
 */
export interface TurnStoreBackend {
  loadSnapshot(interviewId: string): Promise<TurnSnapshot>
  /** Atomic per-field jsonb_set (patch_interview_step_field). */
  patchStepField(interviewId: string, stepIndex: number, subPath: string[], value: Json): Promise<void>
  /** Full-array step_tracker update. */
  setStepTracker(interviewId: string, tracker: StepEntry[]): Promise<void>
  setTopics(interviewId: string, covered: string[], open: string[]): Promise<void>
  setExtractionsLog(interviewId: string, log: RawExtraction[]): Promise<void>
  insertKnowledgeObject(row: KnowledgeObjectInsert): Promise<void>
  updateInterview(
    interviewId: string,
    fields: { next_briefing?: AnalystBriefing; analyst_status?: string },
    onlyIfNotDone?: boolean,
  ): Promise<void>
}

class BackendTurnSession implements TurnSession {
  private current: TurnSnapshot
  private patches: FieldPatch[] = []

  constructor(
    private readonly backend: TurnStoreBackend,
    private readonly interviewId: string,
    private readonly workspaceId: string,
    initial: TurnSnapshot,
  ) {
    this.current = initial
  }

  snapshot(): TurnSnapshot {
    return this.current
  }

  stage(intent: WriteIntent): StageResult {
    const out = applyIntent(this.current, intent, {
      interviewId: this.interviewId,
      workspaceId: this.workspaceId,
      now: new Date().toISOString(),
    })
    this.current = out.snapshot
    this.patches.push(...out.patches)
    // Fire-and-forget, exactly as today's record_slot/backfill emit (ADR-015).
    for (const ev of out.trail) emitSlotWrite(ev).catch(() => {})
    return out.result
  }

  async commit(): Promise<void> {
    for (const p of this.patches) {
      switch (p.kind) {
        case 'step_field':
          await this.backend.patchStepField(this.interviewId, p.stepIndex, p.subPath, p.value)
          break
        case 'step_tracker':
          await this.backend.setStepTracker(this.interviewId, p.value)
          break
        case 'topics':
          await this.backend.setTopics(this.interviewId, p.covered, p.open)
          break
        case 'extractions_log':
          await this.backend.setExtractionsLog(this.interviewId, p.value)
          break
        case 'knowledge_object':
          await this.backend.insertKnowledgeObject(p.row)
          break
        case 'interview':
          await this.backend.updateInterview(this.interviewId, p.fields, p.onlyIfNotDone)
          break
      }
    }
    this.patches = []
  }
}

export function createTurnStore(backend: TurnStoreBackend): TurnStore {
  return {
    async openTurn(interviewId: string, workspaceId: string): Promise<TurnSession> {
      const initial = await backend.loadSnapshot(interviewId)
      return new BackendTurnSession(backend, interviewId, workspaceId, initial)
    },
  }
}

// ─── Orchestration surface (runInterviewTurn + eval runner, ADR-018 §C) ───────
//
// The per-turn orchestration reads/writes (load interview/state/turns, insert
// turn, phase/status/timer updates) are plain store methods — no intent, no
// conflict logic. Extends the TurnStore so `runInterviewTurn` takes one store
// and never touches getSupabaseAdmin directly.

export interface InterviewRow {
  id: string
  workspace_id: string
  employee_name: string
  employee_role: string | null
  department: string
  focus_topics: string | null
  status: string
  max_duration_minutes: number | null
  analyst_status: string | null
  next_briefing: AnalystBriefing | null
}

export interface StateRow {
  phase: string | null
  timer_minutes: number | null
  topics_covered: string[] | null
  topics_open: string[] | null
  extractions_log: RawExtraction[] | null
  step_tracker: unknown[] | null
  opener_text: string | null
}

export interface TurnRow {
  turn_number: number
  user_input: string
  agent_response: string
  created_at: string
}

export interface InsertTurnInput {
  interviewId: string
  turnNumber: number
  userInput: string
  agentResponse: string
}

export interface OrchestrationStore {
  loadInterview(interviewId: string): Promise<InterviewRow | null>
  loadState(interviewId: string): Promise<StateRow | null>
  loadTurns(interviewId: string): Promise<TurnRow[]>
  /** Returns the new turn's id, or null on failure (logged, non-throwing). */
  insertTurn(row: InsertTurnInput): Promise<{ id: string } | null>
  updatePhase(interviewId: string, phase: string): Promise<void>
  /** status='completed', extractions_pending=true. */
  completeInterview(interviewId: string): Promise<void>
  setAnalystStatus(interviewId: string, status: string): Promise<void>
  updateStateAfterTurn(
    interviewId: string,
    fields: { timerMinutes?: number; extractionsLog?: RawExtraction[]; openerText?: string },
  ): Promise<void>
  /** Fresh step_tracker read (raw rows) — used by the background analyst's re-reads. */
  loadStepTracker(interviewId: string): Promise<unknown[]>
}

export interface InterviewStoreBackend extends TurnStoreBackend, OrchestrationStore {}

export interface InterviewStore extends TurnStore, OrchestrationStore {}

export function createInterviewStore(backend: InterviewStoreBackend): InterviewStore {
  const base = createTurnStore(backend)
  return {
    openTurn: base.openTurn,
    loadInterview: (id) => backend.loadInterview(id),
    loadState: (id) => backend.loadState(id),
    loadTurns: (id) => backend.loadTurns(id),
    insertTurn: (row) => backend.insertTurn(row),
    updatePhase: (id, phase) => backend.updatePhase(id, phase),
    completeInterview: (id) => backend.completeInterview(id),
    setAnalystStatus: (id, status) => backend.setAnalystStatus(id, status),
    updateStateAfterTurn: (id, fields) => backend.updateStateAfterTurn(id, fields),
    loadStepTracker: (id) => backend.loadStepTracker(id),
  }
}
