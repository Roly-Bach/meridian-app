#!/usr/bin/env tsx
/**
 * Frozen-transcript replay runner (ADR-015).
 *
 * Loads all fixtures from src/services/__evals__/interview/__fixtures__/
 * Runs scorers (offline — no LLM/Supabase calls) against frozen turns.
 * Compares against baseline.json, exits non-zero when delta > tolerance.
 *
 * Usage:
 *   npm run eval:replay
 *   npm run eval:replay:update   # writes new baselines
 *
 * IMPORTANT: This file MUST NOT import runner.ts.
 * Only imports: scorers/, replay/types, interviewAgent types.
 */

import path from 'path'
import fs from 'fs'
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env.local') })

import {
  scoreSlotCoverage,
  scoreDedupCoverage,
  scorePhaseAdherence,
  scorePhaseProgression,
  scoreAnchoringViolations,
  scoreToolCallPlausibility,
  scoreCompletionCorrectness,
  scoreStepRegistrationCoverage,
} from '../scorers'
import type { ScoreSet, TurnRecord } from '../scorers/types'
import type { TranscriptFixture, BaselineFile, ReplayResult } from './types'

const FIXTURES_DIR = path.resolve(process.cwd(), 'src/services/__evals__/interview/__fixtures__')
const NUMERIC_TOLERANCE = 0.05
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

// ─── Scorer runner (offline — no LLM calls) ───────────────────────────────────
// dialogNaturalness requires a live model — skipped in replay.

function runOfflineScorers(
  turns: TurnRecord[],
  finalStepTracker: TranscriptFixture['finalStepTracker'],
  interviewStatus: string,
  expectedProcessCount?: number,
): Partial<ScoreSet> {
  const completionCorrectness = scoreCompletionCorrectness(interviewStatus)
  const slotCoverage = round2(scoreSlotCoverage(finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(finalStepTracker))
  return {
    slotCoverage,
    dedupSlotCoverage,
    // L9: replay has no clarification snapshot — final == pre, delta = 0
    slotCoveragePreClarification: slotCoverage,
    dedupSlotCoveragePreClarification: dedupSlotCoverage,
    clarificationCoverageDelta: 0,
    phaseAdherence: round2(scorePhaseAdherence(turns)),
    phaseProgression: round2(scorePhaseProgression(turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(turns)),
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(finalStepTracker, expectedProcessCount)),
    // dialogNaturalness intentionally omitted (requires live LLM)
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Fixture loader ───────────────────────────────────────────────────────────

function loadFixtures(): Array<{ id: string; fixture: TranscriptFixture; baselinePath: string }> {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.log(`[replay] No fixtures directory found at ${FIXTURES_DIR}`)
    return []
  }

  const ids = fs.readdirSync(FIXTURES_DIR).filter(d => {
    const stat = fs.statSync(path.join(FIXTURES_DIR, d))
    return stat.isDirectory()
  })

  const loaded: Array<{ id: string; fixture: TranscriptFixture; baselinePath: string }> = []
  for (const id of ids) {
    const fixturePath = path.join(FIXTURES_DIR, id, 'transcript.json')
    const baselinePath = path.join(FIXTURES_DIR, id, 'baseline.json')
    if (!fs.existsSync(fixturePath)) continue

    try {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as TranscriptFixture
      loaded.push({ id, fixture, baselinePath })
    } catch {
      console.warn(`[replay] Failed to parse fixture ${id}/transcript.json — skipping`)
    }
  }
  return loaded
}

// ─── Baseline compare ─────────────────────────────────────────────────────────

function compareScores(
  actual: Partial<ScoreSet>,
  baseline: ScoreSet,
): ReplayResult['diffs'] {
  const diffs: ReplayResult['diffs'] = []
  const keys = Object.keys(actual) as (keyof ScoreSet)[]
  for (const key of keys) {
    const a = actual[key]
    const b = baseline[key]
    if (a === undefined || b === undefined) continue

    if (typeof a === 'boolean' && typeof b === 'boolean') {
      if (a !== b) {
        diffs.push({ metric: key, actual: a, baseline: b, delta: a === b ? 0 : 'mismatch' })
      }
    } else if (typeof a === 'number' && typeof b === 'number') {
      const delta = Math.abs(a - b)
      if (delta > NUMERIC_TOLERANCE) {
        diffs.push({ metric: key, actual: a, baseline: b, delta: round2(a - b) })
      }
    }
  }
  return diffs
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fixtures = loadFixtures()

  if (fixtures.length === 0) {
    console.log('[replay] No fixtures found. Run scripts/backfill-fixtures-from-md.ts first.')
    process.exit(0)
  }

  console.log(`[replay] Running ${fixtures.length} fixture(s) (update-baseline=${UPDATE_BASELINE})`)

  const results: ReplayResult[] = []
  let anyFailed = false

  for (const { id, fixture, baselinePath } of fixtures) {
    const scores = runOfflineScorers(
      fixture.turns,
      fixture.finalStepTracker,
      fixture.status,
    )

    let baseline: ScoreSet | null = null
    if (fs.existsSync(baselinePath)) {
      try {
        const b = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as BaselineFile
        baseline = b.scores
      } catch {
        console.warn(`[replay] Failed to parse baseline for ${id} — treating as no baseline`)
      }
    }

    if (UPDATE_BASELINE || baseline === null) {
      // Write/update baseline
      const newBaseline: BaselineFile = {
        evalRunId: fixture.evalRunId,
        scores: {
          slotCoverage: scores.slotCoverage ?? 0,
          dedupSlotCoverage: scores.dedupSlotCoverage ?? 0,
          slotCoveragePreClarification: scores.slotCoveragePreClarification ?? scores.slotCoverage ?? 0,
          dedupSlotCoveragePreClarification: scores.dedupSlotCoveragePreClarification ?? scores.dedupSlotCoverage ?? 0,
          clarificationCoverageDelta: scores.clarificationCoverageDelta ?? 0,
          phaseAdherence: scores.phaseAdherence ?? 0,
          phaseProgression: scores.phaseProgression ?? 0,
          anchoringViolations: scores.anchoringViolations ?? 0,
          toolCallPlausibility: scores.toolCallPlausibility ?? 0,
          dialogNaturalness: 0, // not computed in replay
          completionCorrectness: scores.completionCorrectness ?? false,
          stepRegistrationCoverage: scores.stepRegistrationCoverage ?? 0,
        },
        updatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2), 'utf8')
      console.log(`[replay] ${UPDATE_BASELINE ? 'Updated' : 'Created'} baseline for ${id}`)
      baseline = newBaseline.scores
    }

    const diffs = baseline ? compareScores(scores, baseline) : []
    const passed = diffs.length === 0

    if (!passed) anyFailed = true

    results.push({
      fixtureId: id,
      evalRunId: fixture.evalRunId,
      persona: fixture.persona,
      model: fixture.model,
      scores,
      baseline,
      passed,
      diffs,
    })
  }

  // Print results
  console.log('\n' + '─'.repeat(60))
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL'
    console.log(`[${icon}] ${r.fixtureId} (persona=${r.persona})`)
    if (!r.passed) {
      for (const d of r.diffs) {
        console.log(`  diff ${d.metric}: actual=${d.actual} baseline=${d.baseline} delta=${d.delta}`)
      }
    }
  }
  console.log('─'.repeat(60))
  console.log(`Results: ${results.filter(r => r.passed).length}/${results.length} passed`)

  if (anyFailed && !UPDATE_BASELINE) {
    console.log('\nRun with --update-baseline to update baselines.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[replay] Fatal:', err)
  process.exit(1)
})
