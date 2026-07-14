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
    checkLifecycle: vi.fn().mockReturnValue({ shouldComplete: false, reason: null }),
    decideNextPhaseWithMeta: vi.fn().mockReturnValue({ phase: 'interview', phaseJustEntered: null }),
  }
})

vi.mock('@/services/interviewAnalyst', () => ({
  runAnalystOnline: vi.fn().mockResolvedValue({ briefing: {}, toolCalls: [] }),
  runAnalystCatchup: vi.fn().mockResolvedValue({ briefing: {}, toolCalls: [] }),
  runAnalystFailureRetry: vi.fn().mockResolvedValue({ briefing: {}, toolCalls: [] }),
}))

vi.mock('@/services/interviewQuickExtract', () => ({
  runQuickExtract: vi.fn().mockResolvedValue(null),
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

import { runInterviewTurn } from './runInterviewTurn'
import { createTalkerStream } from '@/services/interviewTalker'
import {
  checkLifecycle,
  decideNextPhaseWithMeta,
  WRAP_UP_QUESTION_TEXT,
} from '@/services/interviewOrchestrator'
import {
  runAnalystOnline,
  runAnalystCatchup,
  runAnalystFailureRetry,
} from '@/services/interviewAnalyst'
import { runQuickExtract } from '@/services/interviewQuickExtract'

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

function makeStepEntry(title = 'Rechnungsprüfung', status = 'exploring') {
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

// Shared non-blocking processing-write mock
function makeProcessingWriteMock() {
  const processingWriteEq = vi.fn().mockResolvedValue({ data: null, error: null })
  return { update: vi.fn().mockReturnValue({ eq: processingWriteEq }) }
}

// store.loadStepTracker() chain mock — used by the KI-12 soft_confirm recheck
function makeStepTrackerLoadMock(stepTracker: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: stepTracker }, error: null }),
  }
}

/**
 * Set up supabase mocks.
 * @param includePhaseUpdate When true (default false), adds a phase-update mock between
 *   the turns fetch and the processing-write mock. Set true when orchestratedPhase !== currentPhase.
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

  if (opts.includePhaseUpdate) {
    mocks.push(makePhaseUpdateMock())
  }

  // analyst_status='processing' non-blocking write
  mocks.push(makeProcessingWriteMock())

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
    vi.mocked(checkLifecycle).mockReturnValue({ shouldComplete: false, reason: null })
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'intro' as never, phaseJustEntered: null })
  })

  // T1: Normal turn — meta.completed === false, createTalkerStream called
  it('T1: normal turn returns meta.completed=false and calls createTalkerStream', async () => {
    setupSupabaseMocks({})

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen täglich.',
      timerMinutes: 5,
    })

    expect(result.meta.completed).toBe(false)
    expect(result.meta.reason).toBeNull()
    expect(createTalkerStream).toHaveBeenCalled()
    expect(result.stream).toBeDefined()
  })

  // T2: missingSlotsForCoverageCheck computed when phase is 'coverage_check'
  it('T2: computes missingSlotsForCoverageCheck for coverage_check phase', async () => {
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'coverage_check' as never, phaseJustEntered: 'coverage_check' as never })

    const step = makeStepEntry('Rechnungsprüfung', 'walkthrough')
    // phase transitions from 'intro' (stateRow default) to 'coverage_check' — include phase update mock
    setupSupabaseMocks({
      stateRow: makeStateRow('intro', [step]),
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
          phase: 'coverage_check',
          missingSlotsForCoverageCheck: expect.arrayContaining([
            expect.objectContaining({ step_title: 'Rechnungsprüfung' }),
          ]),
        }),
      })
    )
  })

  // T3: missingSlotsForCoverageCheck computed when phase is 'slot_completion'
  it('T3: computes missingSlotsForCoverageCheck for slot_completion phase', async () => {
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'slot_completion' as never, phaseJustEntered: null })

    const step = makeStepEntry('Monatsabschluss', 'walkthrough')
    // phase transitions from 'intro' to 'slot_completion' — include phase update mock
    setupSupabaseMocks({
      stateRow: makeStateRow('intro', [step]),
      includePhaseUpdate: true,
    })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ein Satz.',
      timerMinutes: 15,
    })

    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          phase: 'slot_completion',
          missingSlotsForCoverageCheck: expect.arrayContaining([
            expect.objectContaining({ step_title: 'Monatsabschluss' }),
          ]),
        }),
      })
    )
  })

  // T4: Lifecycle complete → meta.completed=true, farewell stream, no talkerStream
  it('T4: lifecycle complete returns meta.completed=true and farewell stream', async () => {
    // soft_confirm triggers the KI-12 pre-completion recheck: checkLifecycle is called
    // a second time after the synchronous analyst pass. No new step found here, so it
    // returns the same decision both times — completion proceeds as before.
    vi.mocked(checkLifecycle).mockReturnValue({ shouldComplete: true, reason: 'soft_confirm' })

    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    mockAdminFrom.mockReset()
    const interviewFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
    }
    const stateFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow(), error: null }),
    }
    const turnsFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    ;[interviewFetch, stateFetch, turnsFetch, makeStepTrackerLoadMock([]), updateMock]
      .forEach((m) => mockAdminFrom.mockReturnValueOnce(m))

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Das war alles.',
      timerMinutes: 30,
    })

    expect(result.meta.completed).toBe(true)
    expect(result.meta.reason).toBe('soft_confirm')
    expect(runAnalystOnline).toHaveBeenCalledTimes(1)
    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ phase: 'wrap_up', isCompletionFarewell: true }),
        briefing: expect.objectContaining({ next_focus: 'Verabschiedung' }),
      })
    )
  })

  // T11 (KI-12): soft_confirm fires on stale state, but the synchronous recheck finds a
  // brand-new step the user just mentioned — completion must be vetoed, normal turn continues.
  it('T11 (KI-12): soft_confirm is vetoed when the recheck finds a freshly-registered step', async () => {
    vi.mocked(checkLifecycle)
      .mockReturnValueOnce({ shouldComplete: true, reason: 'soft_confirm' })
      .mockReturnValueOnce({ shouldComplete: false, reason: null })
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'clarification' as never, phaseJustEntered: 'clarification' as never })

    const newlyRegisteredStep = makeStepEntry('Mahnwesen', 'exploring')

    mockAdminFrom.mockReset()
    const interviewFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
    }
    const stateFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow('wrap_up', []), error: null }),
    }
    const turnsFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const phaseUpdate = makePhaseUpdateMock()
    const processingWrite = makeProcessingWriteMock()
    ;[interviewFetch, stateFetch, turnsFetch, makeStepTrackerLoadMock([newlyRegisteredStep]), phaseUpdate, processingWrite]
      .forEach((m) => mockAdminFrom.mockReturnValueOnce(m))

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ach, der monatliche Mahnlauf — den hatten wir noch nicht erwähnt.',
      timerMinutes: 15,
    })

    expect(result.meta.completed).toBe(false)
    expect(runAnalystOnline).toHaveBeenCalledTimes(1)
    expect(createTalkerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          stepTracker: expect.arrayContaining([
            expect.objectContaining({ title: 'Mahnwesen' }),
          ]),
        }),
      })
    )
  })

  // T12: farewell-loop escape valve fired with no analystBriefing yet (eval 2026-06-25 run1 —
  // without this, the turn fell through and ran normally with nothing left to ask, and the
  // Talker degenerated into echoing the user's goodbye verbatim). The synchronous analyst pass
  // must run, and once it has, the recheck finds no pending clarification_cards → completes.
  it('T12: farewell_pending_analyst forces a synchronous analyst pass, then completes', async () => {
    vi.mocked(checkLifecycle)
      .mockReturnValueOnce({ shouldComplete: false, reason: 'farewell_pending_analyst' })
      .mockReturnValueOnce({ shouldComplete: true, reason: 'soft_confirm' })

    mockAdminFrom.mockReset()
    const interviewFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: makeInterviewRow(), error: null }),
    }
    const stateFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow(), error: null }),
    }
    const turnsFetch = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;[interviewFetch, stateFetch, turnsFetch, makeStepTrackerLoadMock([]), updateMock]
      .forEach((m) => mockAdminFrom.mockReturnValueOnce(m))

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Dir auch, bis bald.',
      timerMinutes: 20,
    })

    expect(runAnalystOnline).toHaveBeenCalledTimes(1)
    expect(result.meta.completed).toBe(true)
    expect(result.meta.reason).toBe('soft_confirm')
  })

  // T13 (#8): the synchronous pre-completion recheck itself fails (network blip, rate
  // limit) — must veto completion rather than trust the stale soft_confirm decision,
  // since that decision was made on state that never saw this turn's userInput.
  it('T13 (#8): recheck failure vetoes completion — turn proceeds normally, no farewell stream', async () => {
    vi.mocked(checkLifecycle).mockReturnValue({ shouldComplete: true, reason: 'soft_confirm' })
    vi.mocked(runAnalystOnline).mockRejectedValueOnce(new Error('Netzwerkfehler'))

    setupSupabaseMocks({})

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Das war eigentlich alles.',
      timerMinutes: 15,
    })

    expect(runAnalystOnline).toHaveBeenCalledTimes(1)
    expect(result.meta.completed).toBe(false)
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

  // T5: Wrap-up injection → stream has WRAP_UP_QUESTION_TEXT, no createTalkerStream for normal turn
  it('T5: wrap-up injection — stream returns WRAP_UP_QUESTION_TEXT text', async () => {
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'wrap_up' as never, phaseJustEntered: 'wrap_up' as never })

    // Inject shouldInjectWrapUpQuestion to return true by providing history
    // that has user as last message and wrap_up not yet asked.
    // The orchestrator mock already resolves wrap_up phase; the real
    // shouldInjectWrapUpQuestion runs from the actual import.

    // For shouldInjectWrapUpQuestion to return true:
    // - orchestratedPhase === 'wrap_up'  ✓ (from mock)
    // - no WRAP_UP_QUESTION_TEXT in history ✓ (empty turns)
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
      maybeSingle: vi.fn().mockResolvedValue({ data: makeStateRow('coverage_check'), error: null }),
    })
    // turns fetch — empty so history ends with user message
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    // Phase update (coverage_check → wrap_up)
    mockAdminFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    // Turn insert for wrap-up question
    mockAdminFrom.mockReturnValueOnce(turnInsert)

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich glaube das war alles.',
      timerMinutes: 25,
    })

    expect(result.meta.phase).toBe('wrap_up')
    expect(result.meta.completed).toBe(false)
    const text = await result.stream.text
    expect(text).toBe(WRAP_UP_QUESTION_TEXT)
    expect(createTalkerStream).not.toHaveBeenCalled()
  })

  // T6: background() calls runAnalystOnline in standard case
  it('T6: background() calls runAnalystOnline in standard case', async () => {
    setupSupabaseMocks({})

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen.',
      timerMinutes: 5,
    })

    // Need fresh step_tracker reload — mock the background DB call
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
    })

    await result.background()

    expect(runAnalystOnline).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserInput: 'Ich prüfe Rechnungen.',
      })
    )
  })

  // T7: background() calls runAnalystCatchup when phaseJustEntered === 'coverage_check'
  it('T7: background() calls runAnalystCatchup when phaseJustEntered is coverage_check', async () => {
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'coverage_check' as never, phaseJustEntered: 'coverage_check' as never })

    setupSupabaseMocks({ includePhaseUpdate: true })

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Das war der letzte Schritt.',
      timerMinutes: 20,
    })

    // Mock the two DB reloads in background (online + catchup)
    mockAdminFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
      })

    await result.background()

    expect(runAnalystOnline).toHaveBeenCalled()
    expect(runAnalystCatchup).toHaveBeenCalled()
  })

  // T8: background() calls runAnalystFailureRetry when analyst_status='failed' and existingTurns >= 2
  it('T8: background() calls runAnalystFailureRetry when analyst_status=failed and 2+ turns exist', async () => {
    // Return 'intro' to match the default stateRow phase — no phase-update DB call
    vi.mocked(decideNextPhaseWithMeta).mockReturnValue({ phase: 'intro' as never, phaseJustEntered: null })

    const turn1 = { turn_number: 1, user_input: 'Ich prüfe Rechnungen.', agent_response: 'Wie oft?', created_at: new Date().toISOString() }
    const turn2 = { turn_number: 2, user_input: 'Ungefähr 100 mal.', agent_response: 'Danke.', created_at: new Date().toISOString() }

    setupSupabaseMocks({
      interviewRow: makeInterviewRow({ analyst_status: 'failed' }),
      turnsData: [turn1, turn2],
    })

    const result = await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Und es dauert 5 Minuten.',
      timerMinutes: 10,
    })

    // Mock the DB reload in background
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
    })

    await result.background()

    expect(runAnalystFailureRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        previousUserInput: turn2.user_input,
        currentUserInput: 'Und es dauert 5 Minuten.',
      })
    )
    expect(runAnalystOnline).not.toHaveBeenCalled()
  })

  // T9: Quick-Extract only called when stepTracker is non-empty
  it('T9: runQuickExtract not called when stepTracker is empty', async () => {
    // Use 'intro' as stateRow phase so no phase-update fires (mock returns 'intro')
    setupSupabaseMocks({ stateRow: makeStateRow('intro', []) })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen.',
      timerMinutes: 3,
    })

    expect(runQuickExtract).not.toHaveBeenCalled()
  })

  it('T9b: runQuickExtract called when stepTracker has entries', async () => {
    const step = makeStepEntry()
    // Mock decideNextPhaseWithMeta to return walkthrough_step (matching state) — no phase-update
    vi.mocked(decideNextPhaseWithMeta).mockReturnValueOnce({ phase: 'walkthrough_step' as never, phaseJustEntered: null })
    setupSupabaseMocks({ stateRow: makeStateRow('walkthrough_step', [step]) })

    await runInterviewTurn({
      interviewId: INTERVIEW_ID,
      userInput: 'Ich prüfe Rechnungen täglich.',
      timerMinutes: 8,
    })

    expect(runQuickExtract).toHaveBeenCalled()
  })
})
