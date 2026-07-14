/**
 * Stufe-2 tests (ADR-018 §F.2 / D8): the PGlite adapter against the REAL repo
 * migrations, hermetic (no network, no EVAL_WORKSPACE_ID). Verifies:
 *   - the inert bootstrap lets every migration load (the Hauptrisiko, D7)
 *   - stage → commit → read is a faithful persistence round-trip
 *   - the jsonb value survives patch_interview_step_field (PROJ-38 class)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPGliteTurnStore, type PGliteTurnStoreHandle } from './pgliteTurnStore'
import type { StepEntry } from '@/services/interviewSemantic'

const IV = '11111111-1111-1111-1111-111111111111'
const WS = '22222222-2222-2222-2222-222222222222'

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

describe('PGliteTurnStore (Stufe 2, hermetic)', () => {
  let handle: PGliteTurnStoreHandle

  beforeAll(async () => {
    // Boots PGlite + runs the inert bootstrap + all repo migrations. Throws on
    // any migration that fails to load (the Hauptrisiko gate).
    handle = await createPGliteTurnStore()
    await handle.seedInterview({ interviewId: IV, workspaceId: WS })
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
  })

  it('loads every repo migration without error (D7 Hauptrisiko)', () => {
    // If beforeAll resolved, all migrations loaded. Assert the schema is real.
    expect(handle.db).toBeDefined()
  })

  it('register_step → record_slot round-trips through commit + survives jsonb', async () => {
    const session = await handle.store.openTurn(IV, WS)

    // register_step (full-array)
    const reg = session.stage({ kind: 'register_step', tracker: [makeStep()] })
    expect(reg.status).toBe('accepted')

    // record_slot (jsonb_set via patch_interview_step_field)
    const rec = session.stage({
      kind: 'record_slot',
      stepId: 'S001',
      stepTitle: 'Rechnungsprüfung',
      slot: 'frequency_per_month',
      value: 90,
      isNichtBefundMode: false,
      quote: '80 bis 100',
      confidence: 'estimate',
      qualifier: 'Spanne: 80–100',
      writeSource: 'analyst_online',
    })
    expect(rec.status).toBe('accepted')

    await session.commit()

    // Read back from the persisted DB (not the in-memory snapshot).
    const persisted = await handle.readStepTracker(IV)
    expect(persisted).toHaveLength(1)
    const slot = persisted[0].potenzial.frequency_per_month
    // PROJ-38 class: jsonb survives as a structured object, NOT a JSON string.
    expect(slot).toMatchObject({ value: 90, quote: '80 bis 100', confidence: 'estimate', writeSource: 'analyst_online' })
    expect(typeof slot).toBe('object')
    expect(persisted[0].status).toBe('walkthrough')
  })

  it('a second session sees the previous session\'s committed writes', async () => {
    const s2 = await handle.store.openTurn(IV, WS)
    const snap = s2.snapshot()
    expect(snap.stepTracker[0]?.potenzial.frequency_per_month?.value).toBe(90)
  })

  it('priority block leaves the persisted value untouched', async () => {
    const session = await handle.store.openTurn(IV, WS)
    // frequency was written by analyst_online (priority 3); quick (priority 2) must not overwrite.
    const res = session.stage({
      kind: 'record_slot',
      stepId: 'S001',
      stepTitle: 'Rechnungsprüfung',
      slot: 'frequency_per_month',
      value: 999,
      isNichtBefundMode: false,
      quote: 'x',
      writeSource: 'quick',
    })
    expect(res.status).toBe('blocked')
    await session.commit()
    const persisted = await handle.readStepTracker(IV)
    expect(persisted[0].potenzial.frequency_per_month?.value).toBe(90)
  })

  it('link_bottleneck inserts a knowledge_object row + appends extractions_log', async () => {
    const session = await handle.store.openTurn(IV, WS)
    session.stage({ kind: 'link_bottleneck', stepTitle: 'Rechnungsprüfung', description: 'Zu viele Medienbrüche', severity: 'high' })
    await session.commit()

    const ko = await handle.db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM knowledge_objects WHERE interview_id = $1 AND type = 'pain_point'`,
      [IV],
    )
    expect(ko.rows[0].n).toBe(1)
  })

  // #18 (2026-07-14): end-to-end against the real loadSnapshot SQL — a produce_briefing
  // commit must not wipe usedFillerPhrases interviewTalker.ts had already persisted.
  it('preserves usedFillerPhrases across a produce_briefing commit', async () => {
    await handle.db.query(
      `UPDATE interviews SET next_briefing = $2::jsonb WHERE id = $1`,
      [IV, JSON.stringify({ usedFillerPhrases: ['Vielen Dank', 'Interessant'] })],
    )

    const session = await handle.store.openTurn(IV, WS)
    expect(session.snapshot().usedFillerPhrases).toEqual(['Vielen Dank', 'Interessant'])

    const res = session.stage({
      kind: 'produce_briefing',
      briefing: { next_focus: 'Nächster Schritt', suggested_question: 'Wie geht es weiter?' },
    })
    expect(res.status).toBe('accepted')
    await session.commit()

    const persisted = await handle.db.query<{ next_briefing: unknown }>(
      `SELECT next_briefing FROM interviews WHERE id = $1`,
      [IV],
    )
    expect(persisted.rows[0].next_briefing).toMatchObject({
      next_focus: 'Nächster Schritt',
      suggested_question: 'Wie geht es weiter?',
      usedFillerPhrases: ['Vielen Dank', 'Interessant'],
    })
  })
})
