import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAdminFrom } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/services/interviewTalker', () => ({
  createTalkerStream: vi.fn().mockReturnValue({
    toTextStreamResponse: vi.fn().mockReturnValue(new Response('stream', { status: 200 })),
    text: Promise.resolve('agent response text'),
  }),
  createOffTopicRedirectStream: vi.fn().mockReturnValue({
    toTextStreamResponse: vi.fn().mockReturnValue(new Response('redirect stream', { status: 200 })),
    text: Promise.resolve('Dazu kann ich leider nichts sagen — zurück zum Thema.'),
  }),
}))

vi.mock('@/services/interviewOrchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/interviewOrchestrator')>()
  return {
    ...actual,
    // ADR-022: decideNextPhaseWithMeta + checkLifecycle merged into one call.
    resolveTurnLifecycle: vi.fn().mockReturnValue({ phase: 'intro', complete: false, reason: null }),
  }
})

// PROJ-44/ADR-021: the three analyst entrypoints (runAnalystOnline/Catchup/FailureRetry)
// collapsed into one runAnalyst — mode selection + the closing-mode two-sub-pass split
// are interviewAnalyst.ts-internal details, not observable from runInterviewTurn.ts.
// PROJ-46 QA H-1 Fix D: hadExtractionThisTurn is now computed via interviewSemantic.ts's
// hasNewOField (pure, NOT mocked here — runs for real against this file's StepEntry
// fixtures) instead of interviewAnalyst.ts's hasAppliedExtraction, so this mock no
// longer needs to stand in for it.
vi.mock('@/services/interviewAnalyst', () => ({
  runAnalyst: vi.fn().mockResolvedValue({ briefing: {}, toolCalls: [], stepTracker: [] }),
}))

vi.mock('@/services/extraction', () => ({
  extractAndEmbed: vi.fn().mockResolvedValue([]),
  deduplicateKnowledgeObjects: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/processEnrichment', () => ({
  createProcessStepsFromTracker: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/processClustering', () => ({
  clusterProcessSteps: vi.fn().mockResolvedValue(undefined),
}))

// PROJ-42: role guard fully mocked — its own behavior (prefilter/judge/redirect) is
// unit-tested in roleGuard.test.ts. Default 'checked: false' (no prefilter hit) keeps
// every pre-existing DB-call-sequence assumption below unaffected; the off-topic path
// gets its own dedicated tests further down, overriding the mock per-test.
vi.mock('@/services/roleGuard', () => ({
  checkRoleGuard: vi.fn().mockResolvedValue({ checked: false }),
}))

import type { StepEntry } from '@/services/interviewSemantic'
import { runInterviewTurn } from './runInterviewTurn'
import { createTalkerStream, createOffTopicRedirectStream } from '@/services/interviewTalker'
import { resolveTurnLifecycle } from '@/services/interviewOrchestrator'
import { runAnalyst } from '@/services/interviewAnalyst'
import { checkRoleGuard } from '@/services/roleGuard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INTERVIEW_ID = 'iv-test-001'
const WORKSPACE_ID = 'ws-test-001'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()

function makeInterviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INTERVIEW_ID,
    workspace_id: WORKSPACE_ID,
    employee_name: 'Maria',
    employee_role: 'Buchhalterin',
    department: 'Finance',
    focus_topics: null,
    status: 'active',
    token_expires_at: FUTURE_EXPIRY,
    max_duration_minutes: 30,
    created_at: new Date().toISOString(),
    analyst_status: 'idle',
    next_briefing: null,
    ...overrides,
  }
}

function makeStateRow(phase = 'intro', stepTracker: unknown[] = []) {
  return {
    phase,
    timer_minutes: 0,
    topics_covered: [],
    topics_open: [],
    extractions_log: [],
    step_tracker: stepTracker,
  }
}

function makeStepEntry(title = 'Rechnungsprüfung', status: StepEntry['status'] = 'exploring'): StepEntry {
  return {
    id: 'S001',
    title,
    reihenfolge: 1,
    status,
    abhaengigkeiten: null,
    potenzial: {
      frequency: null,
      duration: null,
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
      reibungspunkte: null,
      ausloeser: null,
      aufgabentyp: null,
      risiko_schwere: null,
      standardisierungsgrad: null,
      informationsdichte: null,
    },
    teilschritte: [],
  }
}

// Shared phase-change update mock (for tests that transition phases)
function makePhaseUpdateMock() {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

// Shared non-blocking processing-write mock (analyst_status='processing')
function makeProcessingWriteMock() {
  const processingWriteEq = vi.fn().mockResolvedValue({ data: null, error: null })
  return { update: vi.fn().mockReturnValue({ eq: processingWriteEq }) }
}

/**
 * Set up supabase mocks.
 *
 * PROJ-44/ADR-021: the synchronous Analyst call sits BEFORE the phase decision
 * now, so the analyst_status='processing' write fires BEFORE any phase-update
 * write (reversed from the pre-PROJ-44 order, where processing was written
 * right before the Talker call, after the phase decision). Order below:
 *   interview fetch → state fetch → turns fetch → processing write → [phase update]
 *
 * @param opts.includePhaseUpdate When true (default false), adds a phase-update mock
 *   after the processing-write mock. Set true when orchestratedPhase !== currentPhase.
 */
function setupSupabaseMocks(opts: {
  interviewRow?: Record<string, unknown>
  stateRow?: Record<string, unknown> | null
  turnsData?: unknown[]
  includePhaseUpdate?: boolean
  extraCalls?: unknown[]
}) {
  const interviewRow = opts.interviewRow ?? makeInterviewRow()
  const stateRow = opts.stateRow ?? makeStateRow()
  const turnsData = opts.turnsData ?? []

  // Call 1: interview fetch by id
  const interviewFetch = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: interviewRow, error: null }),
  }

  // Calls 2+3: parallel — state + turns
  const stateFetch = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: stateRow, error: null }),
  }

  const turnsFetch = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: turnsData, error: null }),
  }

  const mocks: unknown[] = [interviewFetch, stateFetch, turnsFetch]

  // analyst_status='processing' non-blocking write — now BEFORE the phase update.
  mocks.push(makeProcessingWriteMock())

  if (opts.includePhaseUpdate) {
    mocks.push(makePhaseUpdateMock())
  }

  if (opts.extraCalls) {
    mocks.push(...opts.extraCalls)
  }

  mockAdminFrom.mockReset()
  mocks.forEach((m) => mockAdminFrom.mockReturnValueOnce(m))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runInterviewTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: normal turn — return current phase 'intro' to avoid DB phase-update call
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'intro' as never, complete: false, reason: null })
    vi.mocked(checkRoleGuard).mockResolvedValue({ checked: false })
    vi.mocked(runAnalyst).mockResolvedValue({ briefing: {}, toolCalls: [], stepTracker: [] })
  })

  // T1: Normal turn — meta.completed === false, createTalkerStream called
  it('T1: normal turn returns meta.completed=false, runs the synchronous analyst, and calls createTalkerStream', async () => {
    setupSupabaseMocks({})

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen täglich.',
      timerMinutes: 5,
    })

    expect(result.meta.completed).toBe(false)
    expect(result.meta.reason).toBeNull()
    expect(runAnalyst).toHaveBeenCalledTimes(1)
    expect(runAnalyst).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ phase: 'intro', stepTracker: [] }),
        currentUserInput: 'Ich prüfe Rechnungen täglich.',
        analystStatus: 'idle',
      })
    )
    expect(createTalkerStream).toHaveBeenCalled()
    expect(result.stream).toBeDefined()
    expect(result.meta.analyst).toEqual({ briefing: {}, toolCalls: [], stepTracker: [] })
  })

  // T2: Ziel-Block threading (PROJ-46 / ADR-023 D1) — focusStepId + transitionReason
  // are derived from the analyst's fresh oDrought and threaded into the Talker context.
  it('T2: threads focusStepId and transitionReason (step_switch) from the analyst\'s oDrought into the Talker context', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'explore' as never, complete: false, reason: null })

    const step = makeStepEntry('Rechnungsprüfung', 'walkthrough')
    vi.mocked(runAnalyst).mockResolvedValue({
      briefing: { target_o_field: 'ausnahmen', oDrought: { stepId: 'S001', streak: 0, exhaustedStepIds: [] } },
      toolCalls: [],
      stepTracker: [step],
    })
    // next_briefing is null (default makeInterviewRow) → previousLockedStepId=null,
    // so the fresh lock 'S001' reads as a step_switch, not a no-op.
    setupSupabaseMocks({ stateRow: makeStateRow('explore', []) })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ein Satz.',
      timerMinutes: 5,
    })

    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          focusStepId: 'S001',
          transitionReason: 'step_switch',
        }),
      })
    )
  })

  // T2b: transitionReason is closing_entry on the turn Explore first resolves into Closing.
  it('T2b: transitionReason is closing_entry when the phase newly resolves into closing', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: false, reason: null })

    vi.mocked(runAnalyst).mockResolvedValue({
      briefing: { oDrought: { stepId: null, streak: 0, exhaustedStepIds: [] } },
      toolCalls: [],
      stepTracker: [],
    })
    setupSupabaseMocks({ stateRow: makeStateRow('explore', []), includePhaseUpdate: true })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ein Satz.',
      timerMinutes: 24,
    })

    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          phase: 'closing',
          transitionReason: 'closing_entry',
        }),
      })
    )
  })

  // T4: Lifecycle complete → meta.completed=true, farewell stream, no talkerStream
  it('T4: lifecycle complete returns meta.completed=true and farewell stream (analyst already ran synchronously)', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: true, reason: 'soft_confirm' })
    setupSupabaseMocks({ extraCalls: [
      { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) }, // completeInterview
    ] })

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Das war alles.',
      timerMinutes: 30,
    })

    expect(result.meta.completed).toBe(true)
    expect(result.meta.reason).toBe('soft_confirm')
    // Exactly one synchronous analyst call for the whole turn — no separate KI-12 recheck anymore.
    expect(runAnalyst).toHaveBeenCalledTimes(1)
    // PROJ-46 (ADR-023 D1/H-2): no briefing is passed on the farewell call — there is
    // no briefing field that could express a farewell, and buildDynamicContext
    // short-circuits on isCompletionFarewell before ever reading one.
    const farewellCall = vi.mocked(createTalkerStream).mock.calls.at(-1)![0]
    expect(farewellCall.context).toMatchObject({ phase: 'closing', isCompletionFarewell: true })
    expect(farewellCall.briefing).toBeUndefined()
  })

  // ─── Fail-Safe (ADR-021 D4) ─────────────────────────────────────────────────

  describe('Fail-Safe: synchronous analyst retry + soft_confirm veto', () => {
    it('retries once on transient failure, then uses the fresh (retry) result', async () => {
      const freshStep = makeStepEntry('Neu entdeckter Prozess', 'exploring')
      vi.mocked(runAnalyst)
        .mockRejectedValueOnce(new Error('transient network blip'))
        .mockResolvedValueOnce({ briefing: { target_o_field: 'ausnahmen' }, toolCalls: [], stepTracker: [freshStep] })
      setupSupabaseMocks({})

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Ein Satz.',
        timerMinutes: 5,
      })

      expect(runAnalyst).toHaveBeenCalledTimes(2)
      expect(result.meta.analyst).toEqual({ briefing: { target_o_field: 'ausnahmen' }, toolCalls: [], stepTracker: [freshStep] })
      expect(createTalkerStream).toHaveBeenCalledWith(
        expect.objectContaining({
          briefing: expect.objectContaining({ target_o_field: 'ausnahmen' }),
          context: expect.objectContaining({ stepTracker: [freshStep] }),
        })
      )
    })

    it('vetoes a soft_confirm completion when the analyst fails on every retry — turn proceeds normally instead', async () => {
      vi.mocked(runAnalyst).mockRejectedValue(new Error('persistent failure'))
      // phase stays 'intro' (the beforeEach default) — isolates the veto assertion
      // from phase-transition/closing-probe-injection mechanics, tested separately.
      vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'intro' as never, complete: true, reason: 'soft_confirm' })
      setupSupabaseMocks({})

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Das war eigentlich alles.',
        timerMinutes: 15,
      })

      // 1 initial attempt + 1 retry = 2 calls, both fail.
      expect(runAnalyst).toHaveBeenCalledTimes(2)
      expect(result.meta.completed).toBe(false)
      expect(result.meta.analyst).toBeNull()
      expect(createTalkerStream).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.not.objectContaining({ isCompletionFarewell: true }),
        })
      )
    })

    it('does NOT veto a hard_stop completion when the analyst fails — time-out is unconditional', async () => {
      vi.mocked(runAnalyst).mockRejectedValue(new Error('persistent failure'))
      vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: true, reason: 'hard_stop' })
      setupSupabaseMocks({ extraCalls: [
        { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) }, // completeInterview
      ] })

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Die Zeit ist um.',
        timerMinutes: 30,
      })

      expect(result.meta.completed).toBe(true)
      expect(result.meta.reason).toBe('hard_stop')
      expect(createTalkerStream).toHaveBeenCalledWith(
        expect.objectContaining({ context: expect.objectContaining({ isCompletionFarewell: true }) })
      )
    })

    it('failure-window: a previously failed analyst pass is recovered on the next turn via previousUserInput', async () => {
      const turn1 = { turn_number: 1, user_input: 'Ich prüfe Rechnungen.', agent_response: 'Wie oft?', created_at: new Date().toISOString() }
      const turn2 = { turn_number: 2, user_input: 'Ungefähr 100 mal.', agent_response: 'Danke.', created_at: new Date().toISOString() }

      setupSupabaseMocks({
        interviewRow: makeInterviewRow({ analyst_status: 'failed' }),
        turnsData: [turn1, turn2],
      })

      await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Und es dauert 5 Minuten.',
        timerMinutes: 10,
      })

      expect(runAnalyst).toHaveBeenCalledWith(
        expect.objectContaining({
          analystStatus: 'failed',
          previousUserInput: turn2.user_input,
          currentUserInput: 'Und es dauert 5 Minuten.',
        })
      )
    })

    it('does NOT set up the failure-window when fewer than 2 prior turns exist', async () => {
      const turn1 = { turn_number: 1, user_input: 'Ich prüfe Rechnungen.', agent_response: 'Wie oft?', created_at: new Date().toISOString() }

      setupSupabaseMocks({
        interviewRow: makeInterviewRow({ analyst_status: 'failed' }),
        turnsData: [turn1],
      })

      await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Ungefähr 100 mal.',
        timerMinutes: 5,
      })

      expect(runAnalyst).toHaveBeenCalledWith(
        expect.objectContaining({ previousUserInput: undefined })
      )
    })
  })

  // ─── BUG-1-Staleness / BUG-6 regression (PROJ-44/ADR-021 shared root cause) ─

  describe('BUG-1-Staleness / BUG-6 regression — orchestrator sees THIS turn, not the previous one', () => {
    it('BUG-1: resolveTurnLifecycle receives the freshly-registered step from THIS turn\'s analyst pass, not the stale (empty) pre-turn tracker', async () => {
      // Phase stays 'explore' — isolates the stepTracker-freshness assertion from
      // the (separately tested) phase-transition/DB-update mechanics.
      vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'explore' as never, complete: false, reason: null })
      const freshlyDiscoveredStep = makeStepEntry('Gerade entdeckter Prozess', 'exploring')
      vi.mocked(runAnalyst).mockResolvedValue({ briefing: {}, toolCalls: [], stepTracker: [freshlyDiscoveredStep] })
      // Pre-turn state has NO steps at all — if the orchestrator saw this stale
      // tracker instead of the analyst's fresh one, the newly-discovered step
      // would be invisible to the phase decision this turn (the original bug).
      setupSupabaseMocks({ stateRow: makeStateRow('explore', []) })

      await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Übrigens mache ich auch noch den Mahnlauf.',
        timerMinutes: 10,
      })

      expect(resolveTurnLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ stepTracker: [freshlyDiscoveredStep] }),
        expect.anything(),
      )
    })

    it('BUG-6 (briefing freshness): resolveTurnLifecycle receives THIS turn\'s fresh analyst briefing, not interview.next_briefing from before this turn ran', async () => {
      // Note: this covers briefing freshness only — the PHASE freshness half of
      // BUG-6 (ADR-022/H-3: terminal evaluation against the RESOLVED phase, not
      // ctx.phase) is unit-tested directly on resolveTurnLifecycle itself in
      // interviewOrchestrator.test.ts, since resolveTurnLifecycle is mocked here.
      const staleBriefing = { target_o_field: 'inputs' as const }
      const freshBriefing = { target_o_field: 'ausnahmen' as const, clarification_cards: [] }
      vi.mocked(runAnalyst).mockResolvedValue({ briefing: freshBriefing, toolCalls: [], stepTracker: [] })
      setupSupabaseMocks({ interviewRow: makeInterviewRow({ next_briefing: staleBriefing }) })

      await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Ein Satz.',
        timerMinutes: 5,
      })

      // resolveTurnLifecycle must have seen the FRESH briefing this turn — never
      // the stale interview.next_briefing snapshot from before the analyst ran.
      expect(resolveTurnLifecycle).toHaveBeenCalledWith(expect.anything(), freshBriefing)
      expect(resolveTurnLifecycle).not.toHaveBeenCalledWith(expect.anything(), staleBriefing)
    })
  })

  // T5 (PROJ-46 / ADR-023 D4): the scripted closing-probe injection is gone — a
  // turn resolving into 'closing' (not yet complete) always reaches createTalkerStream,
  // which formulates a fresh discovery question itself. No static text, no bypass.
  it('T5: a turn resolving into closing (not complete) still calls createTalkerStream — no scripted probe bypass', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: false, reason: null })
    setupSupabaseMocks({ stateRow: makeStateRow('explore', []), includePhaseUpdate: true })

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich glaube das war alles.',
      timerMinutes: 25,
    })

    expect(result.meta.phase).toBe('closing')
    expect(result.meta.completed).toBe(false)
    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ phase: 'closing' }) })
    )
  })

  // ─── finalize() (ADR-021 D5 — replaces background()) ───────────────────────

  it('finalize() is exposed and resolves for a normal Talker turn (extractAndEmbed/onCompleted wiring is exercised via mocked ports)', async () => {
    setupSupabaseMocks({ extraCalls: [
      // finalize()'s store.loadInterview re-read (status check for onCompleted gating)
      {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
      },
    ] })

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen.',
      timerMinutes: 5,
    })

    // onFinish is never invoked by the mocked createTalkerStream, so no turnId was
    // captured — finalize() must still resolve cleanly (no extractAndEmbed attempt).
    await expect(result.finalize()).resolves.toBeUndefined()
  })

  // ─── Role Guard (PROJ-42 / KI-24) ───────────────────────────────────────────

  describe('Role Guard early-return', () => {
    it('T14: off_topic classification ends the turn via a Talker-formulated redirect (PROJ-46/ADR-023 D6) — no synchronous analyst call, no main Talker call', async () => {
      vi.mocked(checkRoleGuard).mockResolvedValue({ checked: true, classification: 'off_topic' })

      const turnInsert = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'turn-redirect' }, error: null }),
      }
      mockAdminFrom.mockReset()
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
      })
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow('explore', [makeStepEntry()]), error: null }),
      })
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
      mockAdminFrom.mockReturnValueOnce(turnInsert)

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Was kostet eigentlich ein neuer VW Golf?',
        timerMinutes: 5,
      })

      expect(result.meta.completed).toBe(false)
      expect(result.meta.analyst).toBeNull()
      expect(createOffTopicRedirectStream).toHaveBeenCalledWith(
        expect.objectContaining({ interviewId: INTERVIEW_ID })
      )
      expect(createTalkerStream).not.toHaveBeenCalled()
      expect(runAnalyst).not.toHaveBeenCalled()
      const text = await result.stream.text
      expect(text).toBe('Dazu kann ich leider nichts sagen — zurück zum Thema.')
      await expect(result.finalize()).resolves.toBeUndefined()
    })

    it('T15: meta classification (or no prefilter hit) runs the turn normally', async () => {
      vi.mocked(checkRoleGuard).mockResolvedValue({ checked: true, classification: 'meta' })
      setupSupabaseMocks({})

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Und die wäre?',
        timerMinutes: 5,
      })

      expect(createTalkerStream).toHaveBeenCalled()
      expect(runAnalyst).toHaveBeenCalledTimes(1)
      expect(result.meta.completed).toBe(false)
    })
  })
})
