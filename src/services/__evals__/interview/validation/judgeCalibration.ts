#!/usr/bin/env tsx
/**
 * Judge-Kalibrierung (PROJ-40, Acceptance D — Instrument-Validierung Stufe 2).
 *
 * SCAFFOLD — NOT executed in Batch 1. Execution is a Checkpoint step (LLM cost / key
 * preflight). Batch 1 delivers the runnable structure plus the pure agreement statistic
 * (`computeAgreement`), which is the only LLM-free, unit-testable piece here.
 *
 * Idea: re-score a fixed, stratified sample of existing transcripts (calibration-sample.json,
 * produced offline by selectCalibrationSample.ts) with TWO judges — the production judge and a
 * stronger cross-vendor reference judge — then measure how often they assign the same discrete
 * level (Level-Match-Quote) and the chance-corrected agreement (Cohen's Kappa). Using fixed
 * transcripts isolates the judge from interview-model variance: the same frozen inputs are graded
 * by both judges (ADR-020; Tech Design C).
 *
 * Reference judge must be a different vendor than the production judge to preserve cross-vendor
 * integrity (ADR-020 D1 — Test/Eval are EU-free, frontier models allowed).
 */
import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import fs from 'fs'
import { resolveModel } from '@/lib/llm-provider'
import {
  scoreDialogNaturalness,
  scoreSlotDepth,
  scoreTalkerFactualGrounding,
  type TurnRecord,
} from '../scorers'
import type { StepEntry } from '@/services/interviewSemantic'

// ─── Pure agreement statistics (LLM-free, unit-tested) ──────────────────────────

export interface AgreementStats {
  /** Number of compared items. */
  n: number
  /** Observed agreement p_o = fraction of items where both judges assigned the same level. */
  matchRate: number
  /** Cohen's Kappa = (p_o − p_e) / (1 − p_e), chance-corrected agreement. */
  kappa: number
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Cohen's Kappa + raw match rate over two raters' categorical labels (the discrete judge
 * levels, e.g. 0.33 / 0.67 / 1.0). Hand-implemented, no stats package (ADR-020 D).
 *
 * Convention when chance agreement p_e === 1 (both raters used a single category): Kappa is
 * mathematically undefined (0/0); we return 1 if they fully matched, else 0.
 */
export function computeAgreement(raterA: Array<string | number>, raterB: Array<string | number>): AgreementStats {
  if (raterA.length !== raterB.length) {
    throw new Error(`rater arrays differ in length: ${raterA.length} vs ${raterB.length}`)
  }
  const n = raterA.length
  if (n === 0) return { n: 0, matchRate: 0, kappa: 0 }

  let matches = 0
  for (let i = 0; i < n; i++) {
    if (raterA[i] === raterB[i]) matches++
  }
  const po = matches / n

  const countA = new Map<string | number, number>()
  const countB = new Map<string | number, number>()
  for (const v of raterA) countA.set(v, (countA.get(v) ?? 0) + 1)
  for (const v of raterB) countB.set(v, (countB.get(v) ?? 0) + 1)

  const categories = new Set<string | number>([...countA.keys(), ...countB.keys()])
  let pe = 0
  for (const c of categories) {
    pe += ((countA.get(c) ?? 0) / n) * ((countB.get(c) ?? 0) / n)
  }

  const kappa = (1 - pe) === 0 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe)
  return { n, matchRate: round4(po), kappa: round4(kappa) }
}

// ─── Sample-file shape (written by selectCalibrationSample.ts) ──────────────────

interface CalibrationSampleItem {
  path: string
  persona: string
  model: string
  status: string
  qualityTier: string
}

interface FrozenTranscript {
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
}

const SAMPLE_FILE = path.resolve(process.cwd(), 'docs', 'evals', 'instrument-validierung', 'calibration-sample.json')

function loadSample(): CalibrationSampleItem[] {
  const raw = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')) as { sample: CalibrationSampleItem[] }
  return raw.sample
}

function loadTranscript(item: CalibrationSampleItem): FrozenTranscript {
  // calibration-sample.json stores absolute paths; fall back to cwd-relative if the
  // file was moved/checked out on another machine.
  const p = fs.existsSync(item.path) ? item.path : path.resolve(process.cwd(), item.path)
  return JSON.parse(fs.readFileSync(p, 'utf8')) as FrozenTranscript
}

// ─── CLI scaffold (Checkpoint execution only — guarded against import) ───────────

async function main(): Promise<void> {
  const prodJudgeModel = process.env.EVAL_JUDGE_MODEL ?? 'google/gemini-3.5-flash'
  const referenceJudgeModel = process.env.EVAL_REFERENCE_JUDGE_MODEL ?? 'anthropic/claude-sonnet-4-5'

  // Resolve both up-front so an unconfigured/invalid model string fails the preflight,
  // not midway through the (expensive) calibration pass.
  resolveModel(prodJudgeModel)
  resolveModel(referenceJudgeModel)

  const sample = loadSample()
  console.log(`[judgeCalibration] ${sample.length} transcripts, prod=${prodJudgeModel} ref=${referenceJudgeModel}`)

  const prodLevels: Record<'dialog' | 'depth' | 'grounding', number[]> = { dialog: [], depth: [], grounding: [] }
  const refLevels: Record<'dialog' | 'depth' | 'grounding', number[]> = { dialog: [], depth: [], grounding: [] }

  for (const item of sample) {
    const t = loadTranscript(item)

    // Production judge: the scorers derive their judge from the eval-model string (getJudgeModel),
    // so the prod pass passes the sample's own model. The reference pass needs a judge-model
    // OVERRIDE the scorers don't yet expose — wiring that override is the Checkpoint/Batch-2 step;
    // here both passes are structured identically so only the model source differs.
    const [dialog, depth, grounding] = await Promise.all([
      scoreDialogNaturalness(t.turns, item.model),
      scoreSlotDepth(t.finalStepTracker, t.turns, item.model),
      scoreTalkerFactualGrounding(t.turns, item.model),
    ])
    prodLevels.dialog.push(dialog.score)
    prodLevels.depth.push(depth.depth_score ?? -1)
    prodLevels.grounding.push(grounding.violations)

    // TODO(Checkpoint): re-run the same three scorers through `referenceJudgeModel` once the
    // scorers accept a judge-model override, and push into refLevels for the comparison below.
  }

  for (const dim of ['dialog', 'depth', 'grounding'] as const) {
    if (refLevels[dim].length === 0) {
      console.log(`[judgeCalibration] ${dim}: reference pass not wired (Checkpoint step) — prod levels collected: ${prodLevels[dim].length}`)
      continue
    }
    const agreement = computeAgreement(prodLevels[dim], refLevels[dim])
    console.log(`[judgeCalibration] ${dim}: n=${agreement.n} match=${agreement.matchRate} kappa=${agreement.kappa}`)
  }
}

// Only run when executed directly (not when imported by tests) — otherwise importing
// computeAgreement in a unit test would trigger the LLM pass. Same ESM guard pattern as
// selectCalibrationSample.ts: `import.meta.url` compared against the invoked script path.
const isDirectRun = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch(err => {
    console.error('[judgeCalibration] Fatal:', err)
    process.exit(1)
  })
}
