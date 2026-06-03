import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { TranscriptFixture } from './types'
import type { TurnRecord } from '../scorers/types'

// Smoke test: parseEvalMd can round-trip a minimal MD structure
import { parseEvalMd } from './parseEvalMd'

const MINIMAL_MD = `---
interview_model: google/gemini-3.5-flash
persona: buchhalter
interview_id: test-id-123
eval_run_id: eval-id-456
status: PASS
turns_total: 2
scores:
  slot_coverage: 0.75
  dedup_slot_coverage: 0.75
  phase_adherence: 1
  phase_progression: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.8
  dialog_naturalness: 0.7
  completion_correctness: true
  step_registration_coverage: 1
---

## Quality Scores

## Gesprächsverlauf

[Turn 1] Persona: Ich arbeite hauptsächlich in der Buchhaltung.
[Turn 1] Agent: "Welchen Prozess möchtest du zuerst besprechen?"

[Turn 2] Persona: Die Rechnungsprüfung ist mein Hauptprozess.
[Turn 2] Agent: "Gut, erzähl mir mehr über die Rechnungsprüfung."

`

describe('parseEvalMd', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a minimal eval MD file', async () => {
    const tmpFile = path.join(os.tmpdir(), `replay-test-${Date.now()}.md`)
    fs.writeFileSync(tmpFile, MINIMAL_MD, 'utf8')

    const fixture = parseEvalMd(tmpFile)
    expect(fixture).not.toBeNull()
    expect(fixture!.evalRunId).toBe('eval-id-456')
    expect(fixture!.persona).toBe('buchhalter')
    expect(fixture!.model).toBe('google/gemini-3.5-flash')
    expect(fixture!.turns).toHaveLength(2)
    expect(fixture!.turns[0].userInput).toContain('Buchhaltung')
    expect(fixture!.turns[0].agentText).toContain('Prozess')

    fs.unlinkSync(tmpFile)
  })

  it('returns null for non-MD content', () => {
    const tmpFile = path.join(os.tmpdir(), `replay-test-nomd-${Date.now()}.md`)
    fs.writeFileSync(tmpFile, 'just plain text, no frontmatter', 'utf8')

    const fixture = parseEvalMd(tmpFile)
    expect(fixture).toBeNull()

    fs.unlinkSync(tmpFile)
  })

  it('returns null for nonexistent file', () => {
    const fixture = parseEvalMd('/nonexistent/path/file.md')
    expect(fixture).toBeNull()
  })

  it('parses scores from frontmatter', () => {
    const tmpFile = path.join(os.tmpdir(), `replay-scores-${Date.now()}.md`)
    fs.writeFileSync(tmpFile, MINIMAL_MD, 'utf8')

    const fixture = parseEvalMd(tmpFile)
    expect(fixture).not.toBeNull()
    expect(fixture!.scores).toBeDefined()
    expect(fixture!.scores!.slotCoverage).toBeCloseTo(0.75)
    expect(fixture!.scores!.completionCorrectness).toBe(true)

    fs.unlinkSync(tmpFile)
  })
})

describe('TranscriptFixture shape', () => {
  it('accepts a complete fixture', () => {
    const turns: TurnRecord[] = [
      { turnNumber: 1, userInput: 'hello', agentText: 'world', phase: 'intro', toolCalls: [] },
    ]
    const fixture: TranscriptFixture = {
      evalRunId: 'abc',
      interviewId: 'def',
      model: 'google/gemini-3.5-flash',
      persona: 'buchhalter',
      status: 'completed',
      turns,
      finalStepTracker: [],
    }
    expect(fixture.turns).toHaveLength(1)
    expect(fixture.finalStepTracker).toHaveLength(0)
  })
})
