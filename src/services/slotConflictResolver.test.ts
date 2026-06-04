import { describe, it, expect } from 'vitest'
import { canOverwrite } from './slotConflictResolver'

describe('canOverwrite — priority conflict resolver', () => {
  describe('empty slot (no existing owner)', () => {
    it('allows write when slot is empty (undefined)', () => {
      expect(canOverwrite(undefined, 'quick')).toBe(true)
    })
    it('allows write when slot is empty string (falsy)', () => {
      expect(canOverwrite('', 'analyst_online')).toBe(true)
    })
  })

  describe('backfill (priority 1) — lowest', () => {
    it('backfill can write over empty', () => {
      expect(canOverwrite(undefined, 'backfill')).toBe(true)
    })
    it('backfill cannot overwrite quick', () => {
      expect(canOverwrite('quick', 'backfill')).toBe(false)
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

  describe('quick (priority 2)', () => {
    it('quick can overwrite backfill', () => {
      expect(canOverwrite('backfill', 'quick')).toBe(true)
    })
    it('quick can overwrite itself (same priority)', () => {
      expect(canOverwrite('quick', 'quick')).toBe(true)
    })
    it('quick cannot overwrite analyst_online', () => {
      expect(canOverwrite('analyst_online', 'quick')).toBe(false)
    })
    it('quick cannot overwrite analyst_catchup', () => {
      expect(canOverwrite('analyst_catchup', 'quick')).toBe(false)
    })
  })

  describe('analyst_online (priority 3)', () => {
    it('analyst_online can overwrite backfill', () => {
      expect(canOverwrite('backfill', 'analyst_online')).toBe(true)
    })
    it('analyst_online can overwrite quick', () => {
      expect(canOverwrite('quick', 'analyst_online')).toBe(true)
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
      expect(canOverwrite('quick', 'analyst_catchup')).toBe(true)
      expect(canOverwrite('analyst_online', 'analyst_catchup')).toBe(true)
      expect(canOverwrite('analyst', 'analyst_catchup')).toBe(true)
    })
    it('analyst_catchup can overwrite itself (same priority, idempotent)', () => {
      expect(canOverwrite('analyst_catchup', 'analyst_catchup')).toBe(true)
    })
  })

  describe('legacy analyst (priority 3, same as analyst_online)', () => {
    it('analyst can overwrite quick', () => {
      expect(canOverwrite('quick', 'analyst')).toBe(true)
    })
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
      expect(canOverwrite('legacy_source_v1', 'quick')).toBe(true)
    })
  })
})
