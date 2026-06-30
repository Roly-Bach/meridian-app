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

// Versuchsplan Stufe 1: Bestehensgrenze für Prod-vs-Referenz-Judge-Übereinstimmung
// (Landis-Koch "substantial"). Level-Match-Quote als Begleitwert (Kappa-Paradox-Check).
const KAPPA_THRESHOLD = 0.61

type Dim = 'dialog' | 'depth' | 'grounding'
interface Paired { prod: number; ref: number }

// ─── CLI runner (Checkpoint execution; guarded against import) ───────────────────

async function main(): Promise<void> {
  const referenceJudgeModel = process.env.EVAL_REFERENCE_JUDGE_MODEL ?? 'anthropic/claude-sonnet-4-5'

  // Preflight (Regel „Judge-API-Key validieren"): Referenz-Judge muss auflösen; der Prod-Judge
  // wird je Transkript aus getJudgeModel(model) abgeleitet (für Gemini-Interviews = Haiku, also
  // Anthropic). Mini-Resolve up-front, damit ein ungültiges Modell hart scheitert, nicht erst
  // mitten im teuren Lauf.
  resolveModel(referenceJudgeModel)

  const sample = loadSample()
  console.log(`[judgeCalibration] ${sample.length} Transkripte, prod=getJudgeModel(model) ref=${referenceJudgeModel}`)

  const paired: Record<Dim, Paired[]> = { dialog: [], depth: [], grounding: [] }

  for (const item of sample) {
    const t = loadTranscript(item)
    // Prod-Pass: kein Override → Judge = getJudgeModel(item.model) (was die Produktion nutzt).
    // Referenz-Pass: Override = referenceJudgeModel. Gleiche fixierte Transkripte, nur Judge variiert.
    const [pDialog, pDepth, pGrounding, rDialog, rDepth, rGrounding] = await Promise.all([
      scoreDialogNaturalness(t.turns, item.model),
      scoreSlotDepth(t.finalStepTracker, t.turns, item.model),
      scoreTalkerFactualGrounding(t.turns, item.model),
      scoreDialogNaturalness(t.turns, item.model, false, undefined, referenceJudgeModel),
      scoreSlotDepth(t.finalStepTracker, t.turns, item.model, undefined, referenceJudgeModel),
      scoreTalkerFactualGrounding(t.turns, item.model, undefined, referenceJudgeModel),
    ])

    // Diskretisierung je Dimension für die Übereinstimmungs-Statistik:
    paired.dialog.push({ prod: pDialog.score, ref: rDialog.score }) // 0.33/0.67/1.0
    if (pDepth.depth_score != null && rDepth.depth_score != null) {
      paired.depth.push({ prod: Math.round(pDepth.depth_score), ref: Math.round(rDepth.depth_score) }) // Stufe 1/2/3
    }
    paired.grounding.push({ prod: pGrounding.violations > 0 ? 1 : 0, ref: rGrounding.violations > 0 ? 1 : 0 }) // binär
    console.log(`[judgeCalibration] ${item.persona}/${item.model}: dialog ${pDialog.score}/${rDialog.score}`)
  }

  const out: string[] = [
    '# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)',
    '',
    `prod=getJudgeModel(model) · ref=${referenceJudgeModel} · n=${sample.length} · Schwelle κ≥${KAPPA_THRESHOLD}`,
    '',
    '| Dimension | n | Level-Match | Cohen-κ | Verdikt |',
    '|---|---|---|---|---|',
  ]
  for (const dim of ['dialog', 'depth', 'grounding'] as const) {
    const a = computeAgreement(paired[dim].map(p => p.prod), paired[dim].map(p => p.ref))
    const verdict = a.kappa >= KAPPA_THRESHOLD ? 'PASS' : 'FAIL'
    out.push(`| ${dim} | ${a.n} | ${a.matchRate} | ${a.kappa} | ${verdict} |`)
    console.log(`[judgeCalibration] ${dim}: n=${a.n} match=${a.matchRate} κ=${a.kappa} → ${verdict}`)
  }

  const outDir = path.resolve(process.cwd(), 'docs', 'evals', 'instrument-validierung')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `judge-kalibrierung-${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(outFile, out.join('\n') + '\n', 'utf8')
  console.log(`[judgeCalibration] Ergebnis → ${outFile}`)
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
