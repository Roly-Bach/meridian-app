#!/usr/bin/env tsx
/**
 * Judge-Kalibrierung (PROJ-40, Acceptance D — Instrument-Validierung Stufe 2).
 *
 * SCAFFOLD — NOT executed in Batch 1. Execution is a Checkpoint step (LLM cost / key
 * preflight). Batch 1 delivers the runnable structure plus the pure agreement statistic
 * (`computeAgreement`), which is the only LLM-free, unit-testable piece here.
 *
 * Idea: re-score a fixed, stratified sample of existing transcripts (calibration-sample.json,
 * produced offline by selectCalibrationSample.ts) with the production judge PLUS one or more
 * reference judges (EVAL_REFERENCE_JUDGE_MODELS, default: Anthropic frontier for the strength check
 * + a cross-vendor Gemini for the independence check), then measure how often they assign the same
 * discrete level (Level-Match-Quote) and the chance-corrected agreement (Cohen's Kappa). Using fixed
 * transcripts isolates the judge from interview-model variance: the same frozen inputs are graded by
 * every judge (ADR-020; Tech Design C).
 *
 * At least one reference judge should be a different vendor than the production judge to preserve
 * cross-vendor integrity (ADR-020 D1 — Test/Eval are EU-free, frontier models allowed). gemini-3.1-
 * flash-lite is deliberately excluded as a reference: it is the interviewer model, so grading its own
 * transcripts would be self-serving (ADR-020).
 *
 * Observability (PROJ-40): the harness persists, per transcript and per reference judge, both judges'
 * discrete level AND their rationale for all three dimensions, plus a confusion matrix and ordinal
 * diagnostics (linear-weighted κ, signed offset, adjacency) — so a FAIL verdict is diagnosable
 * (systematic strictness offset vs. real dissent vs. the KI-18 grounding parser-fallback artifact,
 * which is tracked via TalkerFactualGroundingResult.parseFailed and reported raw + cleaned).
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
import { normalizeStepEntry } from '@/services/interviewSemantic'
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

// ─── Ordinal agreement diagnostics (LLM-free, unit-tested) ──────────────────────
// The judge levels are ORDERED (dialog 0.33<0.67<1.0; depth 1<2<3), so nominal Cohen-κ — which
// treats "one level off" like "two levels off" — understates real agreement and hides systematic
// strictness offsets. These helpers operate on ordinal indices (0..k-1); the caller converts levels
// to indices via toOrdinal.

/**
 * k×k confusion matrix over two raters' ordinal indices. matrix[i][j] = count of items where rater A
 * (prod, rows) assigned index i and rater B (ref, cols) assigned index j.
 */
export function confusionMatrix(a: number[], b: number[], k: number): number[][] {
  if (a.length !== b.length) throw new Error(`rater arrays differ in length: ${a.length} vs ${b.length}`)
  const m = Array.from({ length: k }, () => new Array<number>(k).fill(0))
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i]
    if (ai < 0 || ai >= k || bi < 0 || bi >= k) throw new Error(`ordinal index out of range for k=${k}: ${ai},${bi}`)
    m[ai][bi]++
  }
  return m
}

export interface WeightedAgreementStats {
  n: number
  weightedKappa: number
}

/**
 * Linear-weighted Cohen's Kappa over ordinal indices (0..k-1), weight w_ij = 1 − |i−j|/(k−1).
 * Adjacent disagreements are penalized less than distant ones — the honest statistic for ordered
 * levels. k=2 (grounding) reduces exactly to nominal kappa. Convention: P_e===1 → 1 if perfectly
 * (weighted) matched, else 0.
 */
export function computeWeightedAgreement(a: number[], b: number[], k: number): WeightedAgreementStats {
  if (a.length !== b.length) throw new Error(`rater arrays differ in length: ${a.length} vs ${b.length}`)
  const n = a.length
  if (n === 0) return { n: 0, weightedKappa: 0 }
  if (k < 2) return { n, weightedKappa: 1 } // single category — nothing to weight

  const w = (i: number, j: number) => 1 - Math.abs(i - j) / (k - 1)

  let po = 0
  for (let x = 0; x < n; x++) po += w(a[x], b[x])
  po /= n

  const pa = new Array<number>(k).fill(0)
  const pb = new Array<number>(k).fill(0)
  for (let x = 0; x < n; x++) { pa[a[x]]++; pb[b[x]]++ }
  for (let i = 0; i < k; i++) { pa[i] /= n; pb[i] /= n }

  let pe = 0
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) pe += w(i, j) * pa[i] * pb[j]

  const weightedKappa = (1 - pe) === 0 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe)
  return { n, weightedKappa: round4(weightedKappa) }
}

export interface OrdinalOffsetStats {
  n: number
  /** mean(idxProd − idxRef); sign = bias direction (negative ⇒ prod systematically stricter/lower). */
  meanSignedDiff: number
  /** fraction of items within one ordinal level (|idxProd − idxRef| ≤ 1). */
  adjacencyRate: number
}

/** Signed ordinal offset (bias direction) + adjacency rate over ordinal indices. */
export function ordinalOffset(a: number[], b: number[]): OrdinalOffsetStats {
  if (a.length !== b.length) throw new Error(`rater arrays differ in length: ${a.length} vs ${b.length}`)
  const n = a.length
  if (n === 0) return { n: 0, meanSignedDiff: 0, adjacencyRate: 0 }
  let sum = 0, adjacent = 0
  for (let i = 0; i < n; i++) {
    sum += a[i] - b[i]
    if (Math.abs(a[i] - b[i]) <= 1) adjacent++
  }
  return { n, meanSignedDiff: round4(sum / n), adjacencyRate: round4(adjacent / n) }
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
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as FrozenTranscript
  // Frozen transcripts can predate PROJ-25 (step.potenzial absent) — normalize to the current
  // schema exactly like the production load path, sonst crasht slotDepth/potenzial-Zugriff auf
  // Altdaten. (Bug aus dem ersten Stufe-1-Lauf 2026-07-01.)
  return {
    turns: raw.turns,
    finalStepTracker: (raw.finalStepTracker ?? []).map((s, i) => normalizeStepEntry(s, i + 1)),
  }
}

// Versuchsplan Stufe 1: Bestehensgrenze für Prod-vs-Referenz-Judge-Übereinstimmung
// (Landis-Koch "substantial"). Level-Match-Quote + gewichtetes κ als Begleitwerte.
const KAPPA_THRESHOLD = 0.61

type Dim = 'dialog' | 'depth' | 'grounding'
const DIMS: Dim[] = ['dialog', 'depth', 'grounding']
const ORDINAL_K: Record<Dim, number> = { dialog: 3, depth: 3, grounding: 2 }

/** Map a discrete judge level to its ordinal index (0..k-1) for the ordered-agreement diagnostics. */
export function toOrdinal(dim: Dim, level: number): number {
  if (dim === 'dialog') return level < 0.5 ? 0 : level < 0.85 ? 1 : 2 // 0.33→0, 0.5/0.67→1, 1.0→2
  if (dim === 'depth') return Math.max(0, Math.min(2, Math.round(level) - 1)) // 1→0, 2→1, 3→2
  return level > 0 ? 1 : 0 // grounding binär
}

/** One judge pair's discretized verdict on one dimension of one transcript, with both rationales. */
export interface DimObservation {
  prodLevel: number
  refLevel: number
  match: boolean
  prodRationale: string
  refRationale: string
  prodParseFailed?: boolean // grounding only
  refParseFailed?: boolean
}

export interface PerTranscriptRecord {
  id: string
  persona: string
  model: string
  qualityTier: string
  /** keyed by reference-judge model; depth is null when the transcript has no scorable slots. */
  byReference: Record<string, { dialog: DimObservation; depth: DimObservation | null; grounding: DimObservation }>
}

export interface DimAggregate {
  n: number
  matchRate: number
  kappa: number
  weightedKappa: number
  meanSignedDiff: number
  adjacencyRate: number
  confusion: number[][]
}

export interface RefAggregate {
  dialog: DimAggregate
  depth: DimAggregate
  grounding: DimAggregate
  /** grounding recomputed with parseFailed rows dropped (KI-18-Artefakt entfernt). */
  groundingClean: DimAggregate
  /** number of grounding rows dropped as parser/judge-call fallbacks. */
  groundingArtifacts: number
}

function transcriptId(item: CalibrationSampleItem): string {
  return path.basename(item.path).replace(/\.(json|md)$/i, '')
}

function truncate(s: string, n = 120): string {
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > n ? oneLine.slice(0, n - 1) + '…' : oneLine
}

function aggregateDim(dim: Dim, pairs: Array<{ prod: number; ref: number }>): DimAggregate {
  const nominal = computeAgreement(pairs.map(p => p.prod), pairs.map(p => p.ref))
  const idxA = pairs.map(p => toOrdinal(dim, p.prod))
  const idxB = pairs.map(p => toOrdinal(dim, p.ref))
  const k = ORDINAL_K[dim]
  const weighted = computeWeightedAgreement(idxA, idxB, k)
  const offset = ordinalOffset(idxA, idxB)
  return {
    n: nominal.n,
    matchRate: nominal.matchRate,
    kappa: nominal.kappa,
    weightedKappa: weighted.weightedKappa,
    meanSignedDiff: offset.meanSignedDiff,
    adjacencyRate: offset.adjacencyRate,
    confusion: confusionMatrix(idxA, idxB, k),
  }
}

/**
 * Aggregate the per-transcript records into a per-reference-judge summary. Pure and LLM-free so the
 * whole aggregation (depth-null filtering, grounding raw-vs-clean split, KI-18-artifact count) is
 * unit-testable without a judge call.
 */
export function computeAggregates(records: PerTranscriptRecord[], refs: string[]): Record<string, RefAggregate> {
  const aggregates: Record<string, RefAggregate> = {}
  for (const refModel of refs) {
    const dialogPairs = records.map(r => ({ prod: r.byReference[refModel].dialog.prodLevel, ref: r.byReference[refModel].dialog.refLevel }))
    const depthPairs = records
      .map(r => r.byReference[refModel].depth)
      .filter((d): d is DimObservation => d !== null)
      .map(d => ({ prod: d.prodLevel, ref: d.refLevel }))
    const groundingObs = records.map(r => r.byReference[refModel].grounding)
    const groundingPairs = groundingObs.map(g => ({ prod: g.prodLevel, ref: g.refLevel }))
    const cleanObs = groundingObs.filter(g => !g.prodParseFailed && !g.refParseFailed)
    const groundingCleanPairs = cleanObs.map(g => ({ prod: g.prodLevel, ref: g.refLevel }))

    aggregates[refModel] = {
      dialog: aggregateDim('dialog', dialogPairs),
      depth: aggregateDim('depth', depthPairs),
      grounding: aggregateDim('grounding', groundingPairs),
      groundingClean: aggregateDim('grounding', groundingCleanPairs),
      groundingArtifacts: groundingObs.length - cleanObs.length,
    }
  }
  return aggregates
}

// ─── Markdown rendering ──────────────────────────────────────────────────────────

function fmtMatrix(dim: Dim, m: number[][]): string {
  const labels = dim === 'grounding' ? ['0', '1'] : dim === 'depth' ? ['1', '2', '3'] : ['0.33', '0.67', '1.0']
  const header = `| prod↓ / ref→ | ${labels.join(' | ')} |`
  const sep = `|${' --- |'.repeat(labels.length + 1)}`
  const rows = m.map((row, i) => `| **${labels[i]}** | ${row.join(' | ')} |`)
  return [header, sep, ...rows].join('\n')
}

export function buildMarkdown(
  date: string,
  records: PerTranscriptRecord[],
  refs: string[],
  aggregates: Record<string, RefAggregate>,
): string {
  const out: string[] = [
    '# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)',
    '',
    `Datum ${date} · n=${records.length} · prod=getJudgeModel(model) · Schwelle κ≥${KAPPA_THRESHOLD}`,
    `Referenz-Judges: ${refs.join(', ')}`,
    '',
    '> Nominal-κ ist die Bestehensgrenze (Versuchsplan). Gewichtetes κ, Versatz und Adjazenz sind',
    '> Diagnostik für geordnete Levels: ein negativer Versatz bei hoher Adjazenz heißt systematischer',
    '> Strenge-Offset (kein Zufallsrauschen). Volle Begründungen je Transkript im JSON-Sidecar.',
    '',
  ]
  for (const refModel of refs) {
    const agg = aggregates[refModel]
    out.push(`## Referenz-Judge: ${refModel}`, '')
    out.push('| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |')
    out.push('|---|---|---|---|---|---|---|---|')
    for (const dim of DIMS) {
      const a = agg[dim]
      const verdict = a.kappa >= KAPPA_THRESHOLD ? 'PASS' : 'FAIL'
      out.push(`| ${dim} | ${a.n} | ${a.matchRate} | ${a.kappa} | ${a.weightedKappa} | ${a.meanSignedDiff} | ${a.adjacencyRate} | ${verdict} |`)
    }
    out.push('')
    out.push('**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**')
    out.push(`- roh: n=${agg.grounding.n}, match=${agg.grounding.matchRate}, κ=${agg.grounding.kappa}`)
    out.push(`- bereinigt (ohne parseFailed): n=${agg.groundingClean.n}, match=${agg.groundingClean.matchRate}, κ=${agg.groundingClean.kappa}`)
    out.push(`- Artefakt-Anteil: ${agg.groundingArtifacts}/${agg.grounding.n}`)
    out.push('')
    out.push('**Konfusionsmatrizen (Zeilen prod, Spalten ref):**', '')
    for (const dim of DIMS) {
      out.push(`_${dim}_`, '', fmtMatrix(dim, agg[dim].confusion), '')
    }
    out.push('**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**', '')
    out.push('| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |')
    out.push('|---|---|---|---|---|---|')
    for (const r of records) {
      const o = r.byReference[refModel]
      const dCell = `${o.dialog.prodLevel}/${o.dialog.refLevel}${o.dialog.match ? '' : ' ✗'}`
      const deCell = o.depth ? `${o.depth.prodLevel}/${o.depth.refLevel}${o.depth.match ? '' : ' ✗'}` : '—'
      const gWarn = o.grounding.prodParseFailed || o.grounding.refParseFailed ? ' ⚠' : ''
      const gCell = `${o.grounding.prodLevel}/${o.grounding.refLevel}${o.grounding.match ? '' : ' ✗'}${gWarn}`
      const note = o.dialog.match ? '' : `prod: ${truncate(o.dialog.prodRationale, 70)} ‖ ref: ${truncate(o.dialog.refRationale, 70)}`
      out.push(`| ${r.id} | ${r.persona} | ${dCell} | ${deCell} | ${gCell} | ${note} |`)
    }
    out.push('')
  }
  return out.join('\n') + '\n'
}

// ─── CLI runner (Checkpoint execution; guarded against import) ───────────────────

async function main(): Promise<void> {
  // Multi-Referenz (PROJ-40 D, Cross-Vendor): Liste statt Einzel-Modell. Rückwärtskompatibel zum
  // alten Einzel-Env EVAL_REFERENCE_JUDGE_MODEL. Default: Anthropic-Frontier (Stärke-Check) PLUS
  // echter Cross-Vendor (Unabhängigkeits-Check). gemini-3.1-flash-lite bewusst NICHT dabei — das ist
  // das Interviewer-Modell, seine eigenen Transkripte zu benoten wäre Selbst-Bewertung (ADR-020).
  const referenceJudgeModels = (
    process.env.EVAL_REFERENCE_JUDGE_MODELS ??
    process.env.EVAL_REFERENCE_JUDGE_MODEL ??
    'anthropic/claude-sonnet-4-5,google/gemini-3.5-flash'
  ).split(',').map(s => s.trim()).filter(Boolean)

  // Preflight (Regel „Judge-API-Key validieren"): jeder Referenz-Judge muss auflösen, sonst hart
  // scheitern statt still Fallback-Scores mitten im teuren Lauf. Prod-Judge = getJudgeModel(model).
  for (const m of referenceJudgeModels) resolveModel(m)

  const sample = loadSample()
  console.log(`[judgeCalibration] ${sample.length} Transkripte, prod=getJudgeModel(model), refs=[${referenceJudgeModels.join(', ')}]`)

  const records: PerTranscriptRecord[] = []

  for (const item of sample) {
    const t = loadTranscript(item)
    // Prod-Pass EINMAL je Transkript (kein Override → Judge = getJudgeModel(model)), über alle
    // Referenzen geteilt. Referenz-Pässe je Modell auf demselben fixierten Transkript.
    const [pDialog, pDepth, pGrounding] = await Promise.all([
      scoreDialogNaturalness(t.turns, item.model),
      scoreSlotDepth(t.finalStepTracker, t.turns, item.model),
      scoreTalkerFactualGrounding(t.turns, item.model),
    ])

    const byReference: PerTranscriptRecord['byReference'] = {}
    for (const refModel of referenceJudgeModels) {
      const [rDialog, rDepth, rGrounding] = await Promise.all([
        scoreDialogNaturalness(t.turns, item.model, false, undefined, refModel),
        scoreSlotDepth(t.finalStepTracker, t.turns, item.model, undefined, refModel),
        scoreTalkerFactualGrounding(t.turns, item.model, undefined, refModel),
      ])

      const dialog: DimObservation = {
        prodLevel: pDialog.score,
        refLevel: rDialog.score,
        match: pDialog.score === rDialog.score,
        prodRationale: pDialog.rationale,
        refRationale: rDialog.rationale,
      }
      let depth: DimObservation | null = null
      if (pDepth.depth_score != null && rDepth.depth_score != null) {
        const pl = Math.round(pDepth.depth_score)
        const rl = Math.round(rDepth.depth_score)
        depth = {
          prodLevel: pl,
          refLevel: rl,
          match: pl === rl,
          prodRationale: pDepth.rationale ?? '',
          refRationale: rDepth.rationale ?? '',
        }
      }
      const pg = pGrounding.violations > 0 ? 1 : 0
      const rg = rGrounding.violations > 0 ? 1 : 0
      const grounding: DimObservation = {
        prodLevel: pg,
        refLevel: rg,
        match: pg === rg,
        prodRationale: pGrounding.rationale,
        refRationale: rGrounding.rationale,
        prodParseFailed: pGrounding.parseFailed,
        refParseFailed: rGrounding.parseFailed,
      }
      byReference[refModel] = { dialog, depth, grounding }
    }

    records.push({
      id: transcriptId(item),
      persona: item.persona,
      model: item.model,
      qualityTier: item.qualityTier,
      byReference,
    })
    console.log(`[judgeCalibration] ${transcriptId(item)} (${item.persona}/${item.model}) → ${referenceJudgeModels.length} Referenz(en)`)
  }

  // ─── Aggregation je Referenz-Judge ───
  const aggregates = computeAggregates(records, referenceJudgeModels)

  // ─── Persistenz: JSON-Sidecar (vollständig) + MD (Panels je Referenz) ───
  const date = new Date().toISOString().slice(0, 10)
  const outDir = path.resolve(process.cwd(), 'docs', 'evals', 'instrument-validierung')
  fs.mkdirSync(outDir, { recursive: true })

  const jsonFile = path.join(outDir, `judge-kalibrierung-${date}.json`)
  fs.writeFileSync(jsonFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    n: records.length,
    prodJudge: 'getJudgeModel(model) je Transkript',
    referenceJudges: referenceJudgeModels,
    kappaThreshold: KAPPA_THRESHOLD,
    aggregates,
    records,
  }, null, 2) + '\n', 'utf8')

  const mdFile = path.join(outDir, `judge-kalibrierung-${date}.md`)
  fs.writeFileSync(mdFile, buildMarkdown(date, records, referenceJudgeModels, aggregates), 'utf8')

  console.log(`[judgeCalibration] JSON → ${jsonFile}`)
  console.log(`[judgeCalibration] MD   → ${mdFile}`)
  for (const refModel of referenceJudgeModels) {
    for (const dim of DIMS) {
      const a = aggregates[refModel][dim]
      const verdict = a.kappa >= KAPPA_THRESHOLD ? 'PASS' : 'FAIL'
      console.log(`[judgeCalibration] ${refModel} ${dim}: n=${a.n} match=${a.matchRate} κ=${a.kappa} wκ=${a.weightedKappa} Versatz=${a.meanSignedDiff} → ${verdict}`)
    }
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
