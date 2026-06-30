#!/usr/bin/env tsx
/**
 * PROJ-40 Batch 1, Kriterium D — stratified sample selection for the offline
 * judge-calibration harness (judgeCalibration.ts, Teil 3). Pure file analysis,
 * no LLM call: reads every existing docs/evals/interview/**\/*.transcript.json,
 * derives a quality tier from the four gate conditions available in `scores`
 * (the same four evaluateGate() checks in runner.ts), stratifies by
 * persona × model × qualityTier, and writes a deterministic sample list to
 * docs/evals/instrument-validierung/calibration-sample.json.
 *
 * Usage:
 *   npx tsx src/services/__evals__/interview/validation/selectCalibrationSample.ts
 */

import path from 'path'
import fs from 'fs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptScores {
  completionCorrectness?: boolean
  dedupSlotCoverage?: number
  stepRegistrationCoverage?: number
  dialogNaturalness?: number
  talkerGroundingViolations?: number
  depth_score?: number | null
}

interface TranscriptFile {
  persona?: string
  model?: string
  status?: string
  scores?: TranscriptScores
}

export type QualityTier = 'PASS' | 'FAIL' | 'UNKNOWN'

export interface CalibrationSampleEntry {
  path: string
  persona: string
  model: string
  status: string
  qualityTier: QualityTier
  /** PASS/FAIL flagged additionally as "weak/divergence-prone" — talker grounding
   * violations present or low dialogNaturalness stage — these are the cases where
   * judges are most likely to disagree. */
  weak: boolean
  dialogNaturalness: number | null
  talkerGroundingViolations: number | null
  depth_score: number | null
}

export interface CalibrationSampleMeta {
  totalTranscriptsFound: number
  totalEligible: number
  sampleSize: number
  targetSampleSize: string
  stratificationRule: string
  cellCounts: Record<string, { available: number; selected: number }>
  generatedAt: string
  gateNote: string
}

export interface CalibrationSampleResult {
  meta: CalibrationSampleMeta
  sample: CalibrationSampleEntry[]
}

// ─── evaluateGate() mirror (runner.ts) ────────────────────────────────────────
// Note: evaluateGate() in runner.ts has a 5th condition (trailMetrics.blockedRate
// < 0.1), but blockedRate is NOT persisted in transcript.json's `scores` block
// (it lives in a separate slot-trail JSONL file per run, not loaded here) —
// documented gap, deliberately excluded per PROJ-40 plan.
const GATE_NOTE =
  'qualityTier derived from 4 of 5 evaluateGate() conditions available in scores ' +
  '(completionCorrectness===true, dedupSlotCoverage>=0.75, stepRegistrationCoverage>=0.8, ' +
  'dialogNaturalness>=0.65). blockedRate (5th condition) is not persisted in transcript.json scores, excluded.'

function deriveQualityTier(scores: TranscriptScores | undefined): QualityTier {
  if (!scores) return 'UNKNOWN'
  const { completionCorrectness, dedupSlotCoverage, stepRegistrationCoverage, dialogNaturalness } = scores
  if (
    completionCorrectness === undefined ||
    dedupSlotCoverage === undefined ||
    stepRegistrationCoverage === undefined ||
    dialogNaturalness === undefined
  ) {
    return 'UNKNOWN'
  }
  const passed =
    completionCorrectness === true &&
    dedupSlotCoverage >= 0.75 &&
    stepRegistrationCoverage >= 0.8 &&
    dialogNaturalness >= 0.65
  return passed ? 'PASS' : 'FAIL'
}

function deriveWeak(scores: TranscriptScores | undefined): boolean {
  if (!scores) return false
  const lowNaturalness = typeof scores.dialogNaturalness === 'number' && scores.dialogNaturalness < 0.67
  const groundingViolation = typeof scores.talkerGroundingViolations === 'number' && scores.talkerGroundingViolations > 0
  return lowNaturalness || groundingViolation
}

// ─── Transcript scanner ───────────────────────────────────────────────────────

export function scanTranscripts(rootDir: string): CalibrationSampleEntry[] {
  const entries: CalibrationSampleEntry[] = []

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(fullPath); continue }
      if (!entry.name.endsWith('.transcript.json')) continue
      try {
        const raw = fs.readFileSync(fullPath, 'utf8')
        const data = JSON.parse(raw) as TranscriptFile
        if (!data.persona || !data.model) continue
        entries.push({
          path: fullPath,
          persona: data.persona,
          model: data.model,
          status: data.status ?? 'unknown',
          qualityTier: deriveQualityTier(data.scores),
          weak: deriveWeak(data.scores),
          dialogNaturalness: data.scores?.dialogNaturalness ?? null,
          talkerGroundingViolations: data.scores?.talkerGroundingViolations ?? null,
          depth_score: data.scores?.depth_score ?? null,
        })
      } catch {
        // skip unreadable/malformed transcript
      }
    }
  }

  walk(rootDir)
  // Deterministic order — sort by path before any stratification/downsampling.
  entries.sort((a, b) => a.path.localeCompare(b.path))
  return entries
}

// ─── Stratification (decided rule d) ──────────────────────────────────────────
//
// Group by persona × model. For each cell:
//   - if cell size <= 4: take all entries
//   - if cell size > 4: downsample to ~6, spreading at least 1 weak/FAIL entry
//     (if the cell has any) into the selection, rest filled deterministically
//     by sorted order (already sorted by path).
// Target overall sample size: ~20-30.

const SMALL_CELL_THRESHOLD = 4
const DOWNSAMPLE_TARGET = 6

function cellKey(persona: string, model: string): string {
  return `${persona}__${model}`
}

export function stratifySample(all: CalibrationSampleEntry[]): {
  sample: CalibrationSampleEntry[]
  cellCounts: Record<string, { available: number; selected: number }>
} {
  const cells = new Map<string, CalibrationSampleEntry[]>()
  for (const e of all) {
    const key = cellKey(e.persona, e.model)
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key)!.push(e)
  }

  const cellCounts: Record<string, { available: number; selected: number }> = {}
  const sample: CalibrationSampleEntry[] = []

  // Deterministic cell iteration order.
  const sortedKeys = [...cells.keys()].sort()

  for (const key of sortedKeys) {
    const cellEntries = cells.get(key)!
    // cellEntries already sorted by path (inherited from scanTranscripts order).
    let selected: CalibrationSampleEntry[]

    if (cellEntries.length <= SMALL_CELL_THRESHOLD) {
      selected = cellEntries
    } else {
      // Ensure at least 1 weak/FAIL entry is represented if the cell has any.
      const weakOrFail = cellEntries.filter(e => e.weak || e.qualityTier === 'FAIL')
      const rest = cellEntries.filter(e => !(e.weak || e.qualityTier === 'FAIL'))

      const picked: CalibrationSampleEntry[] = []
      if (weakOrFail.length > 0) {
        picked.push(weakOrFail[0])
      }

      // Fill remaining slots deterministically (sorted order), preferring to
      // round out the rest pool first, then any leftover weak/FAIL entries.
      const remainingPool = [...rest, ...weakOrFail.slice(1)].sort((a, b) => a.path.localeCompare(b.path))
      for (const e of remainingPool) {
        if (picked.length >= DOWNSAMPLE_TARGET) break
        if (!picked.includes(e)) picked.push(e)
      }

      selected = picked.sort((a, b) => a.path.localeCompare(b.path))
    }

    cellCounts[key] = { available: cellEntries.length, selected: selected.length }
    sample.push(...selected)
  }

  sample.sort((a, b) => a.path.localeCompare(b.path))
  return { sample, cellCounts }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function buildCalibrationSample(transcriptsRoot: string): CalibrationSampleResult {
  const all = scanTranscripts(transcriptsRoot)
  const eligible = all.filter(e => e.qualityTier !== 'UNKNOWN')
  const { sample, cellCounts } = stratifySample(eligible)

  const meta: CalibrationSampleMeta = {
    totalTranscriptsFound: all.length,
    totalEligible: eligible.length,
    sampleSize: sample.length,
    targetSampleSize: '~20-30',
    stratificationRule:
      'Group by persona x model. Cell size <=4 -> take all. Cell size >4 -> downsample to ~6, ' +
      'spreading >=1 weak/FAIL entry per dense cell when available, deterministic by path sort order.',
    cellCounts,
    generatedAt: new Date().toISOString(),
    gateNote: GATE_NOTE,
  }

  return { meta, sample }
}

function main() {
  const transcriptsRoot = path.resolve(process.cwd(), 'docs', 'evals', 'interview')
  const outDir = path.resolve(process.cwd(), 'docs', 'evals', 'instrument-validierung')
  const outFile = path.join(outDir, 'calibration-sample.json')

  const result = buildCalibrationSample(transcriptsRoot)

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')

  console.log(`[selectCalibrationSample] Scanned ${result.meta.totalTranscriptsFound} transcripts, ${result.meta.totalEligible} eligible (qualityTier !== UNKNOWN).`)
  console.log(`[selectCalibrationSample] Selected ${result.meta.sampleSize} entries across ${Object.keys(result.meta.cellCounts).length} persona x model cells.`)
  console.log(`[selectCalibrationSample] Written: ${outFile}`)
}

// Only run when executed directly (not when imported by tests). ESM equivalent of
// the CJS `require.main === module` guard — tsx runs this as an ES module, so
// `import.meta.url` is compared against the invoked script path.
const isDirectRun = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main()
}
