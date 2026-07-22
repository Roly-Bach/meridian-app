/**
 * L4 — Slot-Write Race Condition (Trail/Tracker Desync)
 *
 * Reproduziert das in 06-07 Eval-Lauf beobachtete Phänomen:
 * Trail emittiert "monatsabschluss.duration=1200, overwrite=false, sourceTurn=5",
 * finaler Tracker zeigt aber duration=null.
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
 * FIX (PROJ-27/BL-E1.5): record_slot now uses jsonb_set via patch_interview_step_field RPC.
 * Each writer touches only its specific slot path → no full-tracker overwrite → no lost update.
 * The REPRO test below documents the OLD behaviour (currentImplWrite) and must stay failing
 * to verify the race exists in the legacy path. The production path no longer uses that pattern.
 */
import { describe, it, expect } from 'vitest'
import type { StepEntry, PotenzialSlotName } from './interviewSemantic'
import { canOverwrite } from './slotConflictResolver'

type SlotWrite = {
  slot: PotenzialSlotName
  value: unknown
  writeSource: 'analyst' | 'analyst_online' | 'backfill'
}

function makeEmptyStep(title: string): StepEntry {
  return {
    title,
    reihenfolge: 1,
    abhaengigkeiten: null,
    status: 'exploring',
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
  }
}

/**
 * Aktuelle Implementation: read-modify-write des gesamten Trackers.
 * Spiegelt record_slot potenzial-write path in interviewAgent.ts.
 */
function currentImplWrite(snapshot: StepEntry[], stepIdx: number, w: SlotWrite): StepEntry[] {
  const prevSlot = snapshot[stepIdx].potenzial[w.slot]
  const existingSource = prevSlot && typeof prevSlot === 'object' && 'writeSource' in prevSlot
    ? (prevSlot as { writeSource: string }).writeSource
    : undefined
  if (prevSlot !== null && !canOverwrite(existingSource, w.writeSource)) {
    return snapshot
  }
  const updated = [...snapshot]
  updated[stepIdx] = {
    ...updated[stepIdx],
    potenzial: {
      ...updated[stepIdx].potenzial,
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
    // Writer B (online extraction) reads — gets t=0 snapshot too (race window)
    const snapshotB = JSON.parse(JSON.stringify(dbState)) as StepEntry[]

    // Writer A modifies + writes duration
    const aResult = currentImplWrite(snapshotA, 0, {
      slot: 'duration',
      value: 1200,
      writeSource: 'analyst',
    })
    dbState = aResult

    // Writer B modifies its STALE snapshot + writes media_breaks
    const bResult = currentImplWrite(snapshotB, 0, {
      slot: 'media_breaks',
      value: 2,
      writeSource: 'analyst_online',
    })
    dbState = bResult

    // Final state: B's write wiped A's write — duration is null again
    expect(dbState[0].potenzial.media_breaks).not.toBeNull()
    expect(dbState[0].potenzial.duration).toBeNull() // 👈 LOST UPDATE — A's write gone
  })

  it('safe baseline: sequential writes (no race) preserve both slots', () => {
    let dbState: StepEntry[] = [makeEmptyStep('monatsabschluss')]
    dbState = currentImplWrite(dbState, 0, {
      slot: 'duration',
      value: 1200,
      writeSource: 'analyst',
    })
    // Writer B reads AFTER A's write — fresh snapshot
    dbState = currentImplWrite(dbState, 0, {
      slot: 'media_breaks',
      value: 2,
      writeSource: 'analyst_online',
    })
    expect(dbState[0].potenzial.duration).not.toBeNull()
    expect(dbState[0].potenzial.media_breaks).not.toBeNull()
  })

  it('PROOF: jsonb_set path-isolation — writing to one slot leaves sibling intact', () => {
    // Model: jsonb_set(['potenzial', 'duration'], v) touches ONLY that leaf.
    // sibling path ['potenzial', 'media_breaks'] is untouched — no matter when B reads.
    function jsonbSetPath(
      obj: Record<string, unknown>,
      path: string[],
      value: unknown,
    ): Record<string, unknown> {
      const [head, ...rest] = path
      const nested = ((obj[head] ?? {}) as Record<string, unknown>)
      return { ...obj, [head]: rest.length === 0 ? value : jsonbSetPath(nested, rest, value) }
    }

    const initial = { potenzial: { duration: null, media_breaks: null } }
    const aWrite = { value: 1200, writeSource: 'analyst' }
    const bWrite = { value: 2, writeSource: 'analyst_online' }

    // Order A→B: both slots filled regardless
    const ab = jsonbSetPath(
      jsonbSetPath(initial as Record<string, unknown>, ['potenzial', 'duration'], aWrite),
      ['potenzial', 'media_breaks'],
      bWrite,
    )
    // Order B→A: same result
    const ba = jsonbSetPath(
      jsonbSetPath(initial as Record<string, unknown>, ['potenzial', 'media_breaks'], bWrite),
      ['potenzial', 'duration'],
      aWrite,
    )

    const expected = { duration: aWrite, media_breaks: bWrite }
    expect((ab as { potenzial: unknown }).potenzial).toEqual(expected)
    expect((ba as { potenzial: unknown }).potenzial).toEqual(expected)
    // Contrast with REPRO test above — no lost update here
  })

  it('PROOF: same-slot concurrent jsonb_set — last write wins, no null/crash', () => {
    function jsonbSetPath(
      obj: Record<string, unknown>,
      path: string[],
      value: unknown,
    ): Record<string, unknown> {
      const [head, ...rest] = path
      const nested = ((obj[head] ?? {}) as Record<string, unknown>)
      return { ...obj, [head]: rest.length === 0 ? value : jsonbSetPath(nested, rest, value) }
    }

    const initial = { potenzial: { duration: null } }
    const afterA = jsonbSetPath(initial as Record<string, unknown>, ['potenzial', 'duration'], { value: 1200 })
    const afterB = jsonbSetPath(afterA, ['potenzial', 'duration'], { value: 600 })

    // Last writer (B) wins deterministically — no null, no corruption
    expect((afterB as { potenzial: { duration: unknown } }).potenzial.duration).toEqual({ value: 600 })
    expect((afterB as { potenzial: { duration: unknown } }).potenzial.duration).not.toBeNull()
  })

  it('canOverwrite priority resolver does NOT catch lost update on empty slot', () => {
    // ADR-016 only blocks lower-priority overwrites of FILLED slots.
    // Empty slot (undefined existingSource) → always allows write.
    expect(canOverwrite(undefined, 'analyst_online')).toBe(true)
    expect(canOverwrite(undefined, 'analyst')).toBe(true)
    // → Race-window: both writers see slot as empty → both writes allowed → last wins.
  })
})
