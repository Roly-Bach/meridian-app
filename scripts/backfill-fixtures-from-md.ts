#!/usr/bin/env tsx
/**
 * Backfill fixture corpus from existing eval MD files (ADR-015).
 *
 * Reads docs/evals/interview/2026-06-03/*.md (and any other date dirs).
 * Writes to src/services/__evals__/interview/__fixtures__/<eval_run_id>/
 *   - transcript.json   — frozen turns + metadata from MD
 *   - baseline.json     — scorer outputs computed against frozen transcript
 *   - source.md         — copy of the original MD (human reference)
 *
 * Usage:
 *   tsx scripts/backfill-fixtures-from-md.ts
 *   tsx scripts/backfill-fixtures-from-md.ts --date 2026-06-03
 *   tsx scripts/backfill-fixtures-from-md.ts --all
 */

import path from 'path'
import fs from 'fs'

// Load .env.local before any imports that read process.env
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env.local') })

import { parseEvalMd } from '../src/services/__evals__/interview/replay/parseEvalMd'
import {
  scoreSlotCoverage,
  scoreDedupCoverage,
  scorePhaseAdherence,
  scorePhaseProgression,
  scoreAnchoringViolations,
  scoreToolCallPlausibility,
  scoreCompletionCorrectness,
  scoreStepRegistrationCoverage,
} from '../src/services/__evals__/interview/scorers'
import type { BaselineFile, TranscriptFixture } from '../src/services/__evals__/interview/replay/types'

const EVALS_DIR = path.resolve(process.cwd(), 'docs/evals/interview')
const FIXTURES_DIR = path.resolve(process.cwd(), 'src/services/__evals__/interview/__fixtures__')

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeOfflineBaseline(fixture: TranscriptFixture): BaselineFile['scores'] {
  const completionCorrectness = scoreCompletionCorrectness(fixture.status)
  const slotCoverage = round2(scoreSlotCoverage(fixture.finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(fixture.finalStepTracker))
  return {
    slotCoverage,
    dedupSlotCoverage,
    // L9: no clarification snapshot in legacy fixtures → final == pre, delta = 0
    slotCoveragePreClarification: slotCoverage,
    dedupSlotCoveragePreClarification: dedupSlotCoverage,
    clarificationCoverageDelta: 0,
    phaseAdherence: round2(scorePhaseAdherence(fixture.turns)),
    phaseProgression: round2(scorePhaseProgression(fixture.turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(fixture.turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(fixture.turns)),
    dialogNaturalness: 0, // live LLM required — set to 0 in replay baselines
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(fixture.finalStepTracker, fixture.expectedProcessCount)),
    schemaConformanceRate: 0, // live LLM required — set to 0 in offline baselines
    hallucinationRate: 0,
    confidenceTriggerRate: 1,
  }
}

function collectMdFiles(targetDate?: string): string[] {
  const files: string[] = []

  if (!fs.existsSync(EVALS_DIR)) {
    console.error(`[backfill] Evals dir not found: ${EVALS_DIR}`)
    return files
  }

  const dateDirs = fs.readdirSync(EVALS_DIR).filter(d => {
    const fullPath = path.join(EVALS_DIR, d)
    if (!fs.statSync(fullPath).isDirectory()) return false
    if (targetDate && d !== targetDate) return false
    return /^\d{4}-\d{2}-\d{2}$/.test(d)
  })

  for (const dateDir of dateDirs) {
    const dirPath = path.join(EVALS_DIR, dateDir)
    const mdFiles = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(dirPath, f))
    files.push(...mdFiles)
  }

  return files
}

async function main() {
  const args = process.argv.slice(2)
  let targetDate: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      targetDate = args[++i]
    }
    // --all is the default (no filter)
  }

  // Default: backfill from 2026-06-03 (initial corpus date)
  if (!targetDate && !args.includes('--all')) {
    targetDate = '2026-06-03'
  }

  const mdFiles = collectMdFiles(targetDate)
  console.log(`[backfill] Found ${mdFiles.length} MD file(s)${targetDate ? ` in ${targetDate}` : ''}`)

  fs.mkdirSync(FIXTURES_DIR, { recursive: true })

  let created = 0
  let skipped = 0
  let failed = 0

  for (const mdFile of mdFiles) {
    const fixture = parseEvalMd(mdFile)
    if (!fixture) {
      console.warn(`[backfill] Could not parse: ${path.basename(mdFile)} — skipping`)
      failed++
      continue
    }

    if (fixture.evalRunId === 'unknown') {
      console.warn(`[backfill] No eval_run_id in: ${path.basename(mdFile)} — skipping`)
      skipped++
      continue
    }

    const fixtureDir = path.join(FIXTURES_DIR, fixture.evalRunId)

    // Skip if fixture already exists (avoid overwriting with --all)
    if (fs.existsSync(path.join(fixtureDir, 'transcript.json')) && !args.includes('--force')) {
      console.log(`[backfill] Already exists: ${fixture.evalRunId} — skip (use --force to overwrite)`)
      skipped++
      continue
    }

    fs.mkdirSync(fixtureDir, { recursive: true })

    // Write transcript.json
    const transcriptPath = path.join(fixtureDir, 'transcript.json')
    fs.writeFileSync(transcriptPath, JSON.stringify(fixture, null, 2), 'utf8')

    // Compute and write baseline.json
    const baselineScores = computeOfflineBaseline(fixture)
    const baseline: BaselineFile = {
      evalRunId: fixture.evalRunId,
      scores: baselineScores,
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(fixtureDir, 'baseline.json'), JSON.stringify(baseline, null, 2), 'utf8')

    // Copy source MD
    fs.copyFileSync(mdFile, path.join(fixtureDir, 'source.md'))

    console.log(`[backfill] Created fixture: ${fixture.evalRunId} (${fixture.persona} / ${fixture.turns.length} turns)`)
    created++
  }

  console.log(`\n[backfill] Done: ${created} created, ${skipped} skipped, ${failed} failed`)
}

main().catch(err => {
  console.error('[backfill] Fatal:', err)
  process.exit(1)
})
