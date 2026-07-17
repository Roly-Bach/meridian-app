/**
 * SupabaseTurnStore — the Prod adapter (PROJ-34 / ADR-018 D4).
 *
 * Writes exactly as the tools do today: `patch_interview_step_field` (RPC) for
 * jsonb fields, full-array `.update({ step_tracker })` for register_step /
 * update_walkthrough / backfill, and the same writes for topics, extractions_log,
 * knowledge_objects and interviews. Non-transactional commit (Prod parity — the
 * writes do not run in a transaction today either, D5).
 *
 * Server-only: imports the Supabase admin client. Never imported by the eval
 * (tsx) path — that uses PGliteTurnStore.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeStepEntry, type StepEntry, type RawExtraction } from '@/services/interviewSemantic'
import type { Json } from '@/lib/database.types'
import type { AnalystBriefing } from '@/services/interviewTypes'
import {
  createTurnStore,
  createInterviewStore,
  type TurnStore,
  type InterviewStore,
  type InterviewStoreBackend,
  type InterviewRow,
  type StateRow,
  type TurnRow,
  type InsertTurnInput,
} from './port'
import type { KnowledgeObjectInsert, TurnSnapshot } from './intents'

/**
 * Retries a transient Supabase fetch failure (network blip, `TypeError: fetch failed`)
 * before giving up. KI-11: `loadInterview` used to swallow the error and return null on
 * any failure, indistinguishable from a genuinely missing row — that turned a one-off
 * network blip into a hard "interview not found" crash mid-run (2026-06-23 eval).
 */
export async function withRetry<T>(
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  label: string,
  retries = 2,
  delayMs = 300,
): Promise<T | null> {
  let lastError: { message: string } | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await fn()
    if (!error) return data
    lastError = error
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
  }
  console.error(`[SupabaseTurnStore] ${label} failed after ${retries + 1} attempts:`, lastError?.message)
  return null
}

class SupabaseBackend implements InterviewStoreBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return getSupabaseAdmin()
  }

  async loadSnapshot(interviewId: string): Promise<TurnSnapshot> {
    const [{ data }, { data: interviewRow }] = await Promise.all([
      this.db
        .from('interview_state')
        .select('step_tracker, topics_covered, topics_open, extractions_log')
        .eq('interview_id', interviewId)
        .maybeSingle(),
      this.db
        .from('interviews')
        .select('next_briefing')
        .eq('id', interviewId)
        .maybeSingle(),
    ])
    const rawTracker = (data?.step_tracker as unknown[] | null) ?? []
    const nextBriefing = interviewRow?.next_briefing as { usedFillerPhrases?: string[] } | null
    return {
      stepTracker: rawTracker.map((raw, i) => normalizeStepEntry(raw, i + 1)),
      topicsCovered: (data?.topics_covered as string[] | null) ?? [],
      topicsOpen: (data?.topics_open as string[] | null) ?? [],
      extractionsLog: (data?.extractions_log as RawExtraction[] | null) ?? [],
      usedFillerPhrases: nextBriefing?.usedFillerPhrases ?? [],
    }
  }

  async patchStepField(interviewId: string, stepIndex: number, subPath: string[], value: Json): Promise<void> {
    // p_value is jsonb-typed: pass the object directly (PROJ-38).
    await this.db.rpc('patch_interview_step_field', {
      p_interview_id: interviewId,
      p_step_index: stepIndex,
      p_sub_path: subPath,
      p_value: value,
    })
  }

  async setStepTracker(interviewId: string, tracker: StepEntry[]): Promise<void> {
    await this.db
      .from('interview_state')
      .update({ step_tracker: tracker as unknown as Json, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId)
  }

  async setTopics(interviewId: string, covered: string[], open: string[]): Promise<void> {
    await this.db
      .from('interview_state')
      .update({ topics_covered: covered, topics_open: open, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId)
  }

  async setExtractionsLog(interviewId: string, log: RawExtraction[]): Promise<void> {
    await this.db
      .from('interview_state')
      .update({ extractions_log: log as unknown as Json, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId)
  }

  async insertKnowledgeObject(row: KnowledgeObjectInsert): Promise<void> {
    await this.db.from('knowledge_objects').insert(row)
  }

  async updateInterview(
    interviewId: string,
    fields: { next_briefing?: AnalystBriefing; analyst_status?: string },
    onlyIfNotDone?: boolean,
  ): Promise<void> {
    let q = this.db.from('interviews').update(fields as unknown as Json).eq('id', interviewId)
    if (onlyIfNotDone) q = q.neq('analyst_status', 'done')
    await q
  }

  // ── Orchestration (runInterviewTurn) ────────────────────────────────────────

  async loadInterview(interviewId: string): Promise<InterviewRow | null> {
    const data = await withRetry<InterviewRow>(
      () => this.db
        .from('interviews')
        .select('id, workspace_id, employee_name, employee_role, department, focus_topics, status, max_duration_minutes, analyst_status, next_briefing')
        .eq('id', interviewId)
        .single(),
      `loadInterview(${interviewId})`,
    )
    return data ?? null
  }

  async loadState(interviewId: string): Promise<StateRow | null> {
    const { data } = await this.db
      .from('interview_state')
      .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker, opener_text')
      .eq('interview_id', interviewId)
      .maybeSingle()
    return (data as StateRow | null) ?? null
  }

  async loadTurns(interviewId: string): Promise<TurnRow[]> {
    const { data } = await this.db
      .from('turns')
      .select('turn_number, user_input, agent_response, created_at')
      .eq('interview_id', interviewId)
      .order('turn_number', { ascending: true })
    return (data as TurnRow[] | null) ?? []
  }

  async insertTurn(row: InsertTurnInput): Promise<{ id: string } | null> {
    const data = await withRetry<{ id: string }>(
      () => this.db
        .from('turns')
        .insert({
          interview_id: row.interviewId,
          turn_number: row.turnNumber,
          user_input: row.userInput,
          agent_response: row.agentResponse,
        })
        .select('id')
        .single(),
      `insertTurn(${row.interviewId}, #${row.turnNumber})`,
    )
    return data ?? null
  }

  async updatePhase(interviewId: string, phase: string): Promise<void> {
    await this.db
      .from('interview_state')
      .update({ phase, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId)
  }

  async completeInterview(interviewId: string): Promise<void> {
    await withRetry(
      () => this.db
        .from('interviews')
        .update({ status: 'completed', extractions_pending: true })
        .eq('id', interviewId),
      `completeInterview(${interviewId})`,
    )
  }

  async setAnalystStatus(interviewId: string, status: string): Promise<void> {
    await this.db.from('interviews').update({ analyst_status: status }).eq('id', interviewId)
  }

  async updateStateAfterTurn(
    interviewId: string,
    fields: { timerMinutes?: number; extractionsLog?: RawExtraction[]; openerText?: string },
  ): Promise<void> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (fields.timerMinutes !== undefined) update.timer_minutes = fields.timerMinutes
    if (fields.extractionsLog !== undefined) update.extractions_log = fields.extractionsLog as unknown as Json
    if (fields.openerText !== undefined) update.opener_text = fields.openerText
    await this.db.from('interview_state').update(update).eq('interview_id', interviewId)
  }
}

/** TurnStore only (openTurn) — for the LLM-pass callers. */
export function createSupabaseTurnStore(): TurnStore {
  return createTurnStore(new SupabaseBackend())
}

/** Full InterviewStore (openTurn + orchestration) — for runInterviewTurn / the prod adapter. */
export function createSupabaseInterviewStore(): InterviewStore {
  return createInterviewStore(new SupabaseBackend())
}
