/**
 * Stufe-2 tests (PROJ-34 / ADR-018 §C): the PGlite EvalStore adapter — the
 * runner's persistence seam — against the REAL repo migrations, hermetic (no
 * network, no EVAL_WORKSPACE_ID, no LLM). Verifies the methods the runner calls:
 * createInterview, loadState/loadHistory/loadAnalystBriefing/loadStatus,
 * saveOpenerText, the InterviewStore handed to runInterviewTurn, and the DB-free
 * clarification completion. This is the part of the runner migration that is
 * verifiable without API keys; the Supabase path stays byte-intact and is
 * covered by the live eval.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createEvalStore, type EvalStore } from './evalStore'
import type { StepEntry } from '@/services/interviewSemantic'

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

describe('PGlite EvalStore adapter (Stufe 2, hermetic)', () => {
  let evalStore: EvalStore
  let interviewId: string
  let workspaceId: string

  beforeAll(async () => {
    evalStore = await createEvalStore('pglite')
    const created = await evalStore.createInterview({
      employeeName: 'Eval Persona',
      employeeRole: 'Buchhalter',
      department: 'Finanzen',
      focusTopics: 'Rechnungsprüfung, Monatsabschluss',
      maxDurationMinutes: 30,
    })
    interviewId = created.interviewId
    workspaceId = created.workspaceId
  }, 60_000)

  afterAll(async () => {
    await evalStore?.close()
  })

  it('createInterview seeds an active interview with intro state', async () => {
    expect(interviewId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/i)

    expect(await evalStore.loadStatus(interviewId)).toBe('active')

    const state = await evalStore.loadState(interviewId)
    expect(state.phase).toBe('intro')
    expect(state.stepTracker).toEqual([])
    expect(state.topicsCovered).toEqual([])
    expect(await evalStore.loadHistory(interviewId)).toEqual([])
    expect(await evalStore.loadAnalystBriefing(interviewId)).toBeNull()
  })

  it('exposes DB-free no-op turn ports for runInterviewTurn', async () => {
    expect(evalStore.kind).toBe('pglite')
    expect(evalStore.turnPorts).toBeDefined()
    expect(evalStore.turnPorts!.store).toBe(evalStore.store)
    // DB-free: extraction + post-completion pipeline are no-ops, not scored.
    await expect(
      evalStore.turnPorts!.extractAndEmbed({ interviewId, workspaceId, turnId: 't', transcript: [] }),
    ).resolves.toEqual([])
    await expect(
      evalStore.turnPorts!.onCompleted({ interviewId, workspaceId }),
    ).resolves.toBeUndefined()
  })

  it('saveOpenerText persists onto interview_state', async () => {
    await evalStore.saveOpenerText(interviewId, 'Hallo, schön dass du da bist.')
    const stateRow = await evalStore.store.loadState(interviewId)
    expect(stateRow?.opener_text).toBe('Hallo, schön dass du da bist.')
  })

  it('a turn staged through the injected store shows up in loadState', async () => {
    // Mirrors what runInterviewTurn does internally with evalStore.turnPorts.store.
    const session = await evalStore.store.openTurn(interviewId, workspaceId)
    expect(session.stage({ kind: 'register_step', tracker: [makeStep()] }).status).toBe('accepted')
    await session.commit()

    const state = await evalStore.loadState(interviewId)
    expect(state.stepTracker).toHaveLength(1)
    expect(state.stepTracker[0].title).toBe('Rechnungsprüfung')
  })

  it('executeClarificationCompletion completes the interview (DB-free, no pipeline)', async () => {
    await evalStore.executeClarificationCompletion(interviewId, workspaceId, [
      { process_step_id: 'Rechnungsprüfung', slot_key: 'frequency_per_month', answer: 'Wöchentlich' },
      { process_step_id: 'Rechnungsprüfung', slot_key: 'open_item', answer: 'Ja' },
    ])
    expect(await evalStore.loadStatus(interviewId)).toBe('completed')
  })
})
