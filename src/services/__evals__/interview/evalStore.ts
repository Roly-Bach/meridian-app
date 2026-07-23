/**
 * EvalStore — the runner's persistence seam (PROJ-34 / ADR-018 §C).
 *
 * The eval runner talks to the database only through this adapter. Two backends:
 *   - Supabase: the exact queries the runner has always issued, moved here
 *     verbatim. Ports into runInterviewTurn stay `undefined` so the turn uses
 *     `defaultProdPorts` (real Supabase store + real extract/embed + pipeline) —
 *     byte-for-byte today's behaviour. This is the default.
 *   - PGlite: a local in-process Postgres (WASM), no network, no
 *     EVAL_WORKSPACE_ID. Reads/writes go through the shared `InterviewStore`;
 *     no-op ports into runInterviewTurn (DB-free, extract/embed + pipeline
 *     skipped — not scored). Opt-in via `--store pglite` / `EVAL_STORE=pglite`.
 *
 * The fidelity proof (PROJ-34 Eval-Gate) compares Supabase vs PGlite scores on
 * the same persona + seed: equal scores = the adapter is behaviour-neutral.
 */

import { randomUUID } from 'crypto'
import type { Phase, StepEntry, RawExtraction } from '@/services/interviewSemantic'
import type { TurnMessage, AnalystBriefing } from '@/services/interviewTypes'
import type { InterviewStore } from '@/services/turnStore/port'
import type { RunTurnPorts } from '@/services/runInterviewTurn'
import { applyClarificationSlotAnswers } from '@/services/clarificationAnswers'
import type { Json } from '@/lib/database.types'

// ─── Public shapes ──────────────────────────────────────────────────────────

export type EvalStoreKind = 'supabase' | 'pglite'

export interface DBState {
  phase: Phase
  timerMinutes: number
  topicsCovered: string[]
  topicsOpen: string[]
  extractionsLog: RawExtraction[]
  stepTracker: StepEntry[]
}

export interface CreateInterviewInput {
  employeeName: string
  employeeRole: string | null
  department: string
  focusTopics: string | null
  maxDurationMinutes: number
}

export interface CreatedInterview {
  interviewId: string
  workspaceId: string
}

export interface ClarificationAnswer {
  process_step_id: string
  slot_key: string
  answer: string | string[]
}

export interface EvalStore {
  readonly kind: EvalStoreKind
  /** The InterviewStore handed to runInterviewTurn (only used when ports are set). */
  readonly store: InterviewStore
  /** Ports for runInterviewTurn. Supabase = undefined (prod defaults), PGlite = no-op. */
  readonly turnPorts: RunTurnPorts | undefined
  /** Create the workspace (PGlite) / use EVAL_WORKSPACE_ID (Supabase) + interview + state. */
  createInterview(input: CreateInterviewInput): Promise<CreatedInterview>
  /** Runner's state read: phase, topics, stepTracker; timerMinutes from first turn. */
  loadState(interviewId: string): Promise<DBState>
  loadHistory(interviewId: string): Promise<TurnMessage[]>
  loadAnalystBriefing(interviewId: string): Promise<AnalystBriefing | null>
  saveOpenerText(interviewId: string, text: string): Promise<void>
  loadStatus(interviewId: string): Promise<string>
  executeClarificationCompletion(
    interviewId: string,
    workspaceId: string,
    answers: ClarificationAnswer[],
  ): Promise<void>
  /** Teardown — closes the PGlite instance; no-op for Supabase. */
  close(): Promise<void>
}

// ─── Supabase backend (default — verbatim of the pre-PROJ-34 runner) ──────────

async function createSupabaseEvalStore(): Promise<EvalStore> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const { createSupabaseInterviewStore } = await import('@/services/turnStore/supabaseTurnStore')
  const { createProcessStepsFromTracker } = await import('@/services/processEnrichment')
  const { clusterProcessSteps } = await import('@/services/processClustering')
  const { deduplicateKnowledgeObjects } = await import('@/services/extraction')

  const store = createSupabaseInterviewStore()

  return {
    kind: 'supabase',
    store,
    // Undefined → runInterviewTurn builds defaultProdPorts: byte-intact prod path.
    turnPorts: undefined,

    async createInterview(input): Promise<CreatedInterview> {
      const supabase = getSupabaseAdmin()
      const workspaceId = process.env.EVAL_WORKSPACE_ID
      if (!workspaceId) throw new Error('[evalStore] EVAL_WORKSPACE_ID not set in .env.local')

      const { data: interview, error: insertError } = await supabase
        .from('interviews')
        .insert({
          workspace_id: workspaceId,
          employee_name: input.employeeName,
          employee_role: input.employeeRole,
          department: input.department,
          focus_topics: input.focusTopics,
          status: 'active',
          access_token: randomUUID(),
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          max_duration_minutes: input.maxDurationMinutes,
        })
        .select('id')
        .single()

      if (insertError || !interview) throw new Error(`[evalStore] Interview insert failed: ${insertError?.message}`)

      const interviewId: string = interview.id
      await supabase.from('interview_state').insert({
        interview_id: interviewId,
        phase: 'intro',
        timer_minutes: 0,
        topics_covered: [],
        topics_open: [],
        extractions_log: [],
        step_tracker: [],
      })
      return { interviewId, workspaceId }
    },

    async loadState(interviewId): Promise<DBState> {
      const supabase = getSupabaseAdmin()
      const [{ data: stateRow }, { data: turns }] = await Promise.all([
        supabase
          .from('interview_state')
          .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker')
          .eq('interview_id', interviewId)
          .maybeSingle(),
        supabase
          .from('turns')
          .select('created_at')
          .eq('interview_id', interviewId)
          .order('turn_number', { ascending: true })
          .limit(1),
      ])

      const firstTurnCreated = (turns as Array<{ created_at: string }> | null)?.[0]?.created_at
      const timerMinutes = firstTurnCreated
        ? Math.floor((Date.now() - new Date(firstTurnCreated).getTime()) / 60000)
        : 0

      return {
        phase: ((stateRow as Record<string, unknown> | null)?.phase ?? 'intro') as Phase,
        timerMinutes,
        topicsCovered: ((stateRow as Record<string, unknown> | null)?.topics_covered as string[]) ?? [],
        topicsOpen: ((stateRow as Record<string, unknown> | null)?.topics_open as string[]) ?? [],
        extractionsLog:
          ((stateRow as Record<string, unknown> | null)?.extractions_log as RawExtraction[]) ?? [],
        stepTracker:
          ((stateRow as Record<string, unknown> | null)?.step_tracker as StepEntry[]) ?? [],
      }
    },

    async loadHistory(interviewId): Promise<TurnMessage[]> {
      const supabase = getSupabaseAdmin()
      const { data: rows } = await supabase
        .from('turns')
        .select('user_input, agent_response')
        .eq('interview_id', interviewId)
        .order('turn_number', { ascending: true })

      return (
        (rows as Array<{ user_input: string; agent_response: string }> | null) ?? []
      ).flatMap(t => [
        { role: 'user' as const, content: t.user_input },
        { role: 'assistant' as const, content: t.agent_response },
      ])
    },

    async loadAnalystBriefing(interviewId): Promise<AnalystBriefing | null> {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase
        .from('interviews')
        .select('next_briefing')
        .eq('id', interviewId)
        .single()
      return (data?.next_briefing as AnalystBriefing | null) ?? null
    },

    async saveOpenerText(interviewId, text): Promise<void> {
      await getSupabaseAdmin()
        .from('interview_state')
        .update({ opener_text: text })
        .eq('interview_id', interviewId)
    },

    async loadStatus(interviewId): Promise<string> {
      const { data } = await getSupabaseAdmin()
        .from('interviews')
        .select('status')
        .eq('id', interviewId)
        .single()
      return (data as { status: string } | null)?.status ?? 'created'
    },

    async executeClarificationCompletion(interviewId, workspaceId, answers): Promise<void> {
      const supabase = getSupabaseAdmin()

      // Persist clarification_answers
      const clarificationRecord: Record<string, string | string[]> = {}
      for (const a of answers) clarificationRecord[`${a.process_step_id}__${a.slot_key}`] = a.answer
      await supabase
        .from('interviews')
        .update({ clarification_answers: clarificationRecord as unknown as Json })
        .eq('id', interviewId)

      // PROJ-43: SlotCard answers are read-merge-write against
      // interview_state.step_tracker via the shared TurnStore — the exact same
      // path the production route (/api/interview/[token]/clarification) uses,
      // so this stays provably code-identical (AC5's eval-verifiability claim).
      const session = await store.openTurn(interviewId, workspaceId)
      const updatedTracker = applyClarificationSlotAnswers(session.snapshot().stepTracker, answers)
      session.stage({ kind: 'register_step', tracker: updatedTracker })
      await session.commit()

      // Process OpenItemCards (Ja/Manchmal) → insert knowledge_objects
      for (const a of answers) {
        if (a.slot_key !== 'open_item' || typeof a.answer !== 'string') continue
        if (a.answer !== 'Ja' && a.answer !== 'Manchmal') continue
        await supabase.from('knowledge_objects').insert({
          interview_id: interviewId,
          workspace_id: workspaceId,
          type: 'process_step',
          content: { title: a.process_step_id, confirmed_via: 'clarification', answer: a.answer },
        })
      }

      // Complete interview + post-completion pipeline
      await supabase.from('interviews').update({ status: 'completed', extractions_pending: true }).eq('id', interviewId)
      try {
        await createProcessStepsFromTracker({ interviewId, workspaceId })
      } catch (err) {
        console.error('[evalStore] clarification createProcessStepsFromTracker failed:', err)
      }
      clusterProcessSteps(workspaceId).catch(err => console.error('[evalStore] clarification clusterProcessSteps failed:', err))
      deduplicateKnowledgeObjects(workspaceId).catch(err => console.error('[evalStore] clarification deduplicateKnowledgeObjects failed:', err))
    },

    async close(): Promise<void> {
      // No teardown — the shared remote DB persists across runs (as before).
    },
  }
}

// ─── PGlite backend (opt-in — DB-free) ────────────────────────────────────────

async function createPGliteEvalStore(): Promise<EvalStore> {
  const { createPGliteTurnStore } = await import('@/services/turnStore/pgliteTurnStore')
  const handle = await createPGliteTurnStore()
  const { store, db } = handle

  const turnPorts: RunTurnPorts = {
    store,
    // DB-free: per-turn extraction/embedding + post-completion pipeline are not
    // scored, so they are no-ops here (ADR-018 §C).
    extractAndEmbed: async () => [],
    onCompleted: async () => {},
  }

  return {
    kind: 'pglite',
    store,
    turnPorts,

    async createInterview(input): Promise<CreatedInterview> {
      const interviewId = randomUUID()
      const workspaceId = randomUUID()
      await handle.seedInterview({
        interviewId,
        workspaceId,
        employeeName: input.employeeName,
        employeeRole: input.employeeRole,
        department: input.department,
        focusTopics: input.focusTopics,
        maxDurationMinutes: input.maxDurationMinutes,
      })
      return { interviewId, workspaceId }
    },

    async loadState(interviewId): Promise<DBState> {
      const [stateRow, turns] = await Promise.all([
        store.loadState(interviewId),
        store.loadTurns(interviewId),
      ])
      const firstTurnCreated = turns[0]?.created_at
      const timerMinutes = firstTurnCreated
        ? Math.floor((Date.now() - new Date(firstTurnCreated).getTime()) / 60000)
        : 0

      return {
        phase: (stateRow?.phase ?? 'intro') as Phase,
        timerMinutes,
        topicsCovered: stateRow?.topics_covered ?? [],
        topicsOpen: stateRow?.topics_open ?? [],
        extractionsLog: stateRow?.extractions_log ?? [],
        stepTracker: (stateRow?.step_tracker as StepEntry[] | null) ?? [],
      }
    },

    async loadHistory(interviewId): Promise<TurnMessage[]> {
      const turns = await store.loadTurns(interviewId)
      return turns.flatMap(t => [
        { role: 'user' as const, content: t.user_input },
        { role: 'assistant' as const, content: t.agent_response },
      ])
    },

    async loadAnalystBriefing(interviewId): Promise<AnalystBriefing | null> {
      const iv = await store.loadInterview(interviewId)
      return iv?.next_briefing ?? null
    },

    async saveOpenerText(interviewId, text): Promise<void> {
      await db.query(
        `UPDATE interview_state SET opener_text = $2 WHERE interview_id = $1`,
        [interviewId, text],
      )
    },

    async loadStatus(interviewId): Promise<string> {
      const iv = await store.loadInterview(interviewId)
      return iv?.status ?? 'created'
    },

    async executeClarificationCompletion(interviewId, workspaceId, answers): Promise<void> {
      // DB-free path (ADR-018 §C): persist clarification_answers + mark complete.
      // process_steps / knowledge_objects / pipeline are still skipped (no
      // process_steps table in this DB-free path). PROJ-43: SlotCard answers DO
      // feed the scored step_tracker (clarificationCoverageDelta diffs
      // pre-/post-clarification step_tracker) — applied via the same shared
      // function + TurnStore path as the Supabase variant, so PGlite stays a
      // faithful fidelity-proof target instead of silently diverging.
      const clarificationRecord: Record<string, string | string[]> = {}
      for (const a of answers) clarificationRecord[`${a.process_step_id}__${a.slot_key}`] = a.answer
      await db.query(
        `UPDATE interviews SET clarification_answers = $2::jsonb WHERE id = $1`,
        [interviewId, JSON.stringify(clarificationRecord)],
      )
      const session = await store.openTurn(interviewId, workspaceId)
      const updatedTracker = applyClarificationSlotAnswers(session.snapshot().stepTracker, answers)
      session.stage({ kind: 'register_step', tracker: updatedTracker })
      await session.commit()
      await store.completeInterview(interviewId)
    },

    async close(): Promise<void> {
      await handle.close()
    },
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export async function createEvalStore(kind: EvalStoreKind): Promise<EvalStore> {
  return kind === 'pglite' ? createPGliteEvalStore() : createSupabaseEvalStore()
}
