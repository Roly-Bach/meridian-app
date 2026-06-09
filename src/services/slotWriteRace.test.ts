/**
 * L4 — Slot-Write Race Condition (Trail/Tracker Desync)
 *
 * Reproduziert das in 06-07 Eval-Lauf beobachtete Phänomen:
 * Trail emittiert "monatsabschluss.duration_minutes=1200, overwrite=false, sourceTurn=5",
 * finaler Tracker zeigt aber duration_minutes=null.
 *
 * Ursache: record_slot, quick-extract und backfill teilen sich das Pattern
 * READ tracker → MODIFY in memory → WRITE tracker zurück.
 * Bei concurrent Aufrufen liest Writer B den Tracker bevor Writer A geschrieben hat.
 * Writer B schreibt dann basierend auf stale snapshot. Last-write-wins → A's Slot wird gewiped.
 *
 * ADR-016 canOverwrite schützt NICHT, weil:
 * - Beide Writer sehen den Ziel-Slot als leer (undefined) in ihren Snapshots
 * - canOverwrite(undefined, *) === true
 * - Conflict-Check ist intra-slot, nicht inter-slot
 *
 * Fix-Vektoren (für Folge-PR):
 * 1. Per-slot JSONB-Update an Supabase: jsonb_set statt vollen Tracker zu überschreiben
 * 2. Optimistic locking via updated_at compare-and-swap mit Retry
 * 3. Serialize alle Slot-Writes durch In-Memory-Queue pro interviewId
 */
import { describe, it, expect } from 'vitest'
import type { StepEntry, SlotName } from './interviewSemantic'
import { canOverwrite } from './slotConflictResolver'

type SlotWrite = {
  slot: SlotName
  value: unknown
  writeSource: 'analyst' | 'quick' | 'backfill'
}

function makeEmptyStep(title: string): StepEntry {
  return {
    title,
    role: null,
    status: 'exploring',
    slots: {
      frequency_per_month: null,
      duration_minutes: null,
      rule_based: null,
      data_sources: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
  }
}

/**
 * Aktuelle Implementation: read-modify-write des gesamten Trackers.
 * Spiegelt record_slot Lines 957–1041 in interviewAgent.ts.
 */
function currentImplWrite(snapshot: StepEntry[], stepIdx: number, w: SlotWrite): StepEntry[] {
  const prevSlot = snapshot[stepIdx].slots[w.slot]
  const existingSource = prevSlot && typeof prevSlot === 'object' && 'writeSource' in prevSlot
    ? (prevSlot as { writeSource: string }).writeSource
    : undefined
  if (prevSlot !== null && !canOverwrite(existingSource, w.writeSource)) {
    return snapshot
  }
  const updated = [...snapshot]
  updated[stepIdx] = {
    ...updated[stepIdx],
    slots: {
      ...updated[stepIdx].slots,
      [w.slot]: { value: w.value, quote: 'evidence', writeSource: w.writeSource },
    },
  }
  return updated
}

describe('L4: concurrent slot-write race condition', () => {
  it('REPRO: two concurrent writers on different slots cause lost update with current read-modify-write', () => {
    // Persistent "DB" state
    let dbState: StepEntry[] = [makeEmptyStep('monatsabschluss')]

    // Writer A (analyst) reads — gets t=0 snapshot
    const snapshotA = JSON.parse(JSON.stringify(dbState)) as StepEntry[]
    // Writer B (quick) reads — gets t=0 snapshot too (race window)
    const snapshotB = JSON.parse(JSON.stringify(dbState)) as StepEntry[]

    // Writer A modifies + writes duration_minutes
    const aResult = currentImplWrite(snapshotA, 0, {
      slot: 'duration_minutes',
      value: 1200,
      writeSource: 'analyst',
    })
    dbState = aResult

    // Writer B modifies its STALE snapshot + writes rule_based
    const bResult = currentImplWrite(snapshotB, 0, {
      slot: 'rule_based',
      value: true,
      writeSource: 'quick',
    })
    dbState = bResult

    // Final state: B's write wiped A's write — duration_minutes is null again
    expect(dbState[0].slots.rule_based).not.toBeNull()
    expect(dbState[0].slots.duration_minutes).toBeNull() // 👈 LOST UPDATE — A's write gone
  })

  it('safe baseline: sequential writes (no race) preserve both slots', () => {
    let dbState: StepEntry[] = [makeEmptyStep('monatsabschluss')]
    dbState = currentImplWrite(dbState, 0, {
      slot: 'duration_minutes',
      value: 1200,
      writeSource: 'analyst',
    })
    // Writer B reads AFTER A's write — fresh snapshot
    dbState = currentImplWrite(dbState, 0, {
      slot: 'rule_based',
      value: true,
      writeSource: 'quick',
    })
    expect(dbState[0].slots.duration_minutes).not.toBeNull()
    expect(dbState[0].slots.rule_based).not.toBeNull()
  })

  it('canOverwrite priority resolver does NOT catch lost update on empty slot', () => {
    // ADR-016 only blocks lower-priority overwrites of FILLED slots.
    // Empty slot (undefined existingSource) → always allows write.
    expect(canOverwrite(undefined, 'quick')).toBe(true)
    expect(canOverwrite(undefined, 'analyst')).toBe(true)
    // → Race-window: both writers see slot as empty → both writes allowed → last wins.
  })
})
