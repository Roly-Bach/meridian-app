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
  buildOffTopicRedirect: vi.fn().mockReturnValue('Dazu kann ich als Interviewer leider nichts beitragen — bleiben wir beim Prozessgespräch. Wo waren wir stehengeblieben?'),
}))

import type { StepEntry } from '@/services/interviewSemantic'
import { runInterviewTurn } from './runInterviewTurn'
import { createTalkerStream } from '@/services/interviewTalker'
import {
  resolveTurnLifecycle,
  CLOSING_PROBE_TEXT,
} from '@/services/interviewOrchestrator'
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
    governance: null,
    abhaengigkeiten: null,
    potenzial: {
      frequency_per_month: null,
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
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
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

  // T2: missingSlotsForCoverageCheck computed when phase is 'closing', using the
  // ANALYST's fresh stepTracker (not the stale state-loaded one — quick-extract is gone).
  it('T2: computes missingSlotsForCoverageCheck for closing phase from the analyst result', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: false, reason: null })

    const step = makeStepEntry('Rechnungsprüfung', 'walkthrough')
    vi.mocked(runAnalyst).mockResolvedValue({ briefing: {}, toolCalls: [], stepTracker: [step] })

    // The closing probe must already be in history — otherwise shouldInjectClosingProbe
    // fires first and short-circuits the turn before it ever reaches createTalkerStream.
    const priorTurn = { turn_number: 1, user_input: 'Ich glaube das war alles.', agent_response: CLOSING_PROBE_TEXT, created_at: new Date().toISOString() }
    // phase transitions from 'intro' (stateRow default) to 'closing' — include phase update mock
    setupSupabaseMocks({
      stateRow: makeStateRow('intro', []),
      turnsData: [priorTurn],
      includePhaseUpdate: true,
    })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ein Satz.',
      timerMinutes: 20,
    })

    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          phase: 'closing',
          missingSlotsForCoverageCheck: expect.arrayContaining([
            expect.objectContaining({ step_title: 'Rechnungsprüfung' }),
          ]),
        }),
      })
    )
  })

  // T2b: missingSlotsForCoverageCheck is undefined outside closing
  it('T2b: does NOT compute missingSlotsForCoverageCheck during explore', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'explore' as never, complete: false, reason: null })

    const step = makeStepEntry('Monatsabschluss', 'walkthrough')
    vi.mocked(runAnalyst).mockResolvedValue({ briefing: {}, toolCalls: [], stepTracker: [step] })
    setupSupabaseMocks({ stateRow: makeStateRow('explore', []) })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ein Satz.',
      timerMinutes: 15,
    })

    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          phase: 'explore',
          missingSlotsForCoverageCheck: undefined,
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
    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ phase: 'closing', isCompletionFarewell: true }),
        briefing: expect.objectContaining({ next_focus: 'Verabschiedung' }),
      })
    )
  })

  // ─── Fail-Safe (ADR-021 D4) ─────────────────────────────────────────────────

  describe('Fail-Safe: synchronous analyst retry + soft_confirm veto', () => {
    it('retries once on transient failure, then uses the fresh (retry) result', async () => {
      const freshStep = makeStepEntry('Neu entdeckter Prozess', 'exploring')
      vi.mocked(runAnalyst)
        .mockRejectedValueOnce(new Error('transient network blip'))
        .mockResolvedValueOnce({ briefing: { next_focus: 'frisch' }, toolCalls: [], stepTracker: [freshStep] })
      setupSupabaseMocks({})

      const result = await runInterviewTurn({
        interviewId: INTERVIEW_ID,
        userInput: 'Ein Satz.',
        timerMinutes: 5,
      })

      expect(runAnalyst).toHaveBeenCalledTimes(2)
      expect(result.meta.analyst).toEqual({ briefing: { next_focus: 'frisch' }, toolCalls: [], stepTracker: [freshStep] })
      expect(createTalkerStream).toHaveBeenCalledWith(
        expect.objectContaining({
          briefing: expect.objectContaining({ next_focus: 'frisch' }),
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
      expect(createTalkerStream).not.toHaveBeenCalledWith(
        expect.objectContaining({
          briefing: expect.objectContaining({ next_focus: 'Verabschiedung' }),
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
      const staleBriefing = { next_focus: 'veraltet', suggested_question: 'Alte Frage?' }
      const freshBriefing = { next_focus: 'aktuell', suggested_question: 'Neue Frage?', clarification_cards: [] }
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

  // T5: Closing-probe injection → stream returns CLOSING_PROBE_TEXT, no createTalkerStream
  it('T5: closing-probe injection — stream returns CLOSING_PROBE_TEXT text', async () => {
    vi.mocked(resolveTurnLifecycle).mockReturnValue({ phase: 'closing' as never, complete: false, reason: null })

    // For shouldInjectClosingProbe to return true:
    // - orchestratedPhase === 'closing'  ✓ (from mock)
    // - no CLOSING_PROBE_TEXT in history ✓ (empty turns)
    // - last message is user ✓ (we add user_input to history)

    const turnInsert = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'turn-wq' }, error: null }),
    }
    mockAdminFrom.mockReset()
    // interview fetch
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
    })
    // state fetch
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow('explore'), error: null }),
    })
    // turns fetch — empty so history ends with user message
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    // analyst_status='processing' write (now BEFORE the phase update)
    mockAdminFrom.mockReturnValueOnce(makeProcessingWriteMock())
    // Phase update (explore → closing)
    mockAdminFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    // Turn insert for closing probe
    mockAdminFrom.mockReturnValueOnce(turnInsert)

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich glaube das war alles.',
      timerMinutes: 25,
    })

    expect(result.meta.phase).toBe('closing')
    expect(result.meta.completed).toBe(false)
    const text = await result.stream.text
    expect(text).toBe(CLOSING_PROBE_TEXT)
    expect(createTalkerStream).not.toHaveBeenCalled()
    // finalize is a no-op for this deterministic, non-Talker turn — must not throw.
    await expect(result.finalize()).resolves.toBeUndefined()
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
    it('T14: off_topic classification ends the turn — no synchronous analyst call, no Talker call', async () => {
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
      expect(createTalkerStream).not.toHaveBeenCalled()
      expect(runAnalyst).not.toHaveBeenCalled()
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
