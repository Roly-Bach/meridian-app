import { describe, it, expect } from 'vitest'
import { canOverwrite } from './slotConflictResolver'

describe('canOverwrite — priority conflict resolver', () => {
  describe('empty slot (no existing owner)', () => {
    it('allows write when slot is empty (undefined)', () => {
      expect(canOverwrite(undefined, 'analyst_online')).toBe(true)
    })
    it('allows write when slot is empty string (falsy)', () => {
      expect(canOverwrite('', 'analyst_online')).toBe(true)
    })
  })

  describe('backfill (priority 1) — lowest', () => {
    it('backfill can write over empty', () => {
      expect(canOverwrite(undefined, 'backfill')).toBe(true)
    })
    it('backfill cannot overwrite analyst_online', () => {
      expect(canOverwrite('analyst_online', 'backfill')).toBe(false)
    })
    it('backfill cannot overwrite analyst_catchup', () => {
      expect(canOverwrite('analyst_catchup', 'backfill')).toBe(false)
    })
    it('backfill cannot overwrite itself (same priority — allowed)', () => {
      // Same priority is allowed (idempotent correction within path)
      expect(canOverwrite('backfill', 'backfill')).toBe(true)
    })
  })

  describe('analyst_online (priority 3)', () => {
    it('analyst_online can overwrite backfill', () => {
      expect(canOverwrite('backfill', 'analyst_online')).toBe(true)
    })
    it('analyst_online can overwrite itself (same priority)', () => {
      expect(canOverwrite('analyst_online', 'analyst_online')).toBe(true)
    })
    it('analyst_online can overwrite legacy analyst (same priority)', () => {
      expect(canOverwrite('analyst', 'analyst_online')).toBe(true)
    })
    it('analyst_online cannot overwrite analyst_catchup', () => {
      expect(canOverwrite('analyst_catchup', 'analyst_online')).toBe(false)
    })
  })

  describe('analyst_catchup (priority 4) — highest', () => {
    it('analyst_catchup can overwrite all lower sources', () => {
      expect(canOverwrite('backfill', 'analyst_catchup')).toBe(true)
      expect(canOverwrite('analyst_online', 'analyst_catchup')).toBe(true)
      expect(canOverwrite('analyst', 'analyst_catchup')).toBe(true)
    })
    it('analyst_catchup can overwrite itself (same priority, idempotent)', () => {
      expect(canOverwrite('analyst_catchup', 'analyst_catchup')).toBe(true)
    })
  })

  describe('legacy analyst (priority 3, same as analyst_online)', () => {
    it('analyst cannot overwrite analyst_catchup', () => {
      expect(canOverwrite('analyst_catchup', 'analyst')).toBe(false)
    })
    it('analyst can overwrite itself', () => {
      expect(canOverwrite('analyst', 'analyst')).toBe(true)
    })
  })

  describe('unknown / stale source strings', () => {
    it('unknown existing source is treated as priority 0 — any writer can overwrite', () => {
      expect(canOverwrite('legacy_source_v1', 'backfill')).toBe(true)
      expect(canOverwrite('legacy_source_v1', 'analyst_online')).toBe(true)
    })

    // PROJ-44/ADR-021 D3: 'quick' (interviewQuickExtract.ts) was removed as a
    // WriteSource. A historical interview whose stored slot trail still carries
    // writeSource='quick' must degrade correctly: the `?? 0` fallback treats it
    // like any other unrecognized legacy string (priority 0), so the current
    // Analyst (priority 3) is free to overwrite it — no read-compat entry needed.
    it('a historical "quick" writeSource degrades to priority 0 — analyst_online may overwrite it', () => {
      expect(canOverwrite('quick', 'analyst_online')).toBe(true)
      expect(canOverwrite('quick', 'backfill')).toBe(true)
    })
  })
})
