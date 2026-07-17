import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emitSlotWrite, type SlotWriteEvent } from './slotWriteTrail'

const baseEvent: SlotWriteEvent = {
  ts: '2026-06-03T12:00:00.000Z',
  interviewId: 'test-interview-id',
  source: 'analyst',
  stepTitle: 'Rechnungsprüfung',
  slot: 'frequency_per_month',
  value: 100,
  overwrite: false,
  sourceTurn: 3,
  evidence: '100 Rechnungen pro Monat',
}

describe('SlotWriteEvent shape', () => {
  it('accepts all required fields', () => {
    const e: SlotWriteEvent = { ...baseEvent }
    expect(e.source).toBe('analyst')
    expect(e.overwrite).toBe(false)
    expect(e.slot).toBe('frequency_per_month')
  })

  it('allows optional fields to be omitted', () => {
    const minimal: SlotWriteEvent = {
      ts: new Date().toISOString(),
      interviewId: 'x',
      source: 'backfill',
      stepTitle: 'Step',
      slot: 'data_sources',
      value: ['SAP'],
      overwrite: false,
    }
    expect(minimal.sourceTurn).toBeUndefined()
    expect(minimal.evidence).toBeUndefined()
  })

  it('overwrite flag is boolean', () => {
    const withOverwrite: SlotWriteEvent = { ...baseEvent, overwrite: true }
    expect(withOverwrite.overwrite).toBe(true)
  })
})

describe('emitSlotWrite', () => {
  beforeEach(() => {
    // Ensure sinks are off by default
    delete process.env.LANGFUSE_ENABLED
    delete process.env.SLOT_TRAIL_FILE
    delete process.env.DEBUG
    delete process.env.LANGFUSE_PUBLIC_KEY
    delete process.env.LANGFUSE_SECRET_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw when all sinks are off', async () => {
    await expect(emitSlotWrite(baseEvent)).resolves.toBeUndefined()
  })

  it('does not throw when JSONL sink fails (bad path)', async () => {
    process.env.SLOT_TRAIL_FILE = '/nonexistent_dir_xyz/trail.jsonl'
    await expect(emitSlotWrite(baseEvent)).resolves.toBeUndefined()
  })

  it('writes to JSONL file when SLOT_TRAIL_FILE is set', async () => {
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs')
    const tmpFile = path.join(os.tmpdir(), `slot-trail-test-${Date.now()}.jsonl`)
    process.env.SLOT_TRAIL_FILE = tmpFile

    await emitSlotWrite(baseEvent)
    await emitSlotWrite({ ...baseEvent, source: 'analyst_online', overwrite: true })

    const lines = fs.readFileSync(tmpFile, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    const first = JSON.parse(lines[0]) as SlotWriteEvent
    expect(first.source).toBe('analyst')
    expect(first.overwrite).toBe(false)
    const second = JSON.parse(lines[1]) as SlotWriteEvent
    expect(second.source).toBe('analyst_online')
    expect(second.overwrite).toBe(true)

    fs.unlinkSync(tmpFile)
    delete process.env.SLOT_TRAIL_FILE
  })

  it('does not throw when Langfuse sink fails (missing keys)', async () => {
    process.env.LANGFUSE_ENABLED = 'true'
    // No PUBLIC_KEY / SECRET_KEY set → sink should no-op silently
    await expect(emitSlotWrite(baseEvent)).resolves.toBeUndefined()
  })

  it('logs to console when DEBUG includes slot_trail', async () => {
    process.env.DEBUG = 'slot_trail'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await emitSlotWrite(baseEvent)
    expect(spy).toHaveBeenCalledOnce()
    const msg = spy.mock.calls[0][0] as string
    expect(msg).toContain('[slot_trail]')
    expect(msg).toContain('analyst')
    expect(msg).toContain('frequency_per_month')
    delete process.env.DEBUG
  })

  it('shows OVERWRITE marker in console log when overwrite=true', async () => {
    process.env.DEBUG = 'slot_trail'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await emitSlotWrite({ ...baseEvent, overwrite: true })
    const msg = spy.mock.calls[0][0] as string
    expect(msg).toContain('[OVERWRITE]')
    delete process.env.DEBUG
  })
})
