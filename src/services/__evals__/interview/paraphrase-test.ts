#!/usr/bin/env tsx
/**
 * Paraphrase-Robustheitstest (BL-E5.5)
 *
 * Lädt original + 3 Varianten buchhalter-Transkripte und führt offline-Scorer
 * auf allen vier aus. Toleranz: |score_variant - score_original| <= 0.05 -> Pass.
 *
 * Optionale LLM-Judges (dialogNaturalness/slotDepth) werden ausgeführt wenn
 * GOOGLE_GENERATIVE_AI_API_KEY oder ANTHROPIC_API_KEY gesetzt ist.
 * LLM-Toleranz: <= 0.10 -> Warnung, > 0.10 -> Warnung (kein Exit-Code 1).
 *
 * WICHTIG: Diese Datei importiert NIEMALS runner.ts.
 *
 * Usage:
 *   npm run eval:interview:paraphrase-test
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
  scoreDialogNaturalness,
} from './scorers'
import type { TurnRecord, ScoreSet } from './scorers/types'
import type { StepEntry } from '@/services/interviewSemantic'

const FIXTURES_DIR = path.resolve(
  process.cwd(),
  'src/services/__evals__/interview/__fixtures__/buchhalter-paraphrase',
)
const DET_TOLERANCE = 0.05
const LLM_TOLERANCE = 0.10

// ─── Fixture types ────────────────────────────────────────────────────────────

interface TranscriptFile {
  evalRunId: string
  model: string
  persona: string
  status: string
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  variant?: string
  variantDescription?: string
}

// ─── Offline scorers ──────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function runOfflineScorers(
  turns: TurnRecord[],
  status: string,
  finalStepTracker: StepEntry[],
): Partial<ScoreSet> {
  const completionCorrectness = scoreCompletionCorrectness(status)
  const slotCoverage = round2(scoreSlotCoverage(finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(finalStepTracker))
  return {
    slotCoverage,
    dedupSlotCoverage,
    slotCoveragePreClarification: slotCoverage,
    dedupSlotCoveragePreClarification: dedupSlotCoverage,
    clarificationCoverageDelta: 0,
    phaseAdherence: round2(scorePhaseAdherence(turns)),
    phaseProgression: round2(scorePhaseProgression(turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(turns)),
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(finalStepTracker, undefined)),
  }
}

// ─── LLM judges (optional) ────────────────────────────────────────────────────

function hasLlmKey(): boolean {
  return !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.ANTHROPIC_API_KEY)
}

async function runLlmScorers(
  turns: TurnRecord[],
  evalModel: string,
): Promise<{ dialogNaturalness: number }> {
  const result = await scoreDialogNaturalness(turns, evalModel, false)
  return { dialogNaturalness: result.score }
}

// ─── Comparison ───────────────────────────────────────────────────────────────

interface DiffResult {
  metric: string
  original: number | boolean
  variant: number | boolean
  delta: number | string
  pass: boolean
  isLlm: boolean
}

function compareScores(
  variantName: string,
  original: Partial<ScoreSet>,
  variant: Partial<ScoreSet>,
  isLlm: boolean,
): DiffResult[] {
  const diffs: DiffResult[] = []
  const tolerance = isLlm ? LLM_TOLERANCE : DET_TOLERANCE
  const keys = Object.keys(original) as (keyof ScoreSet)[]

  for (const key of keys) {
    const orig = original[key]
    const vari = variant[key]
    if (orig === undefined || vari === undefined) continue

    if (typeof orig === 'boolean' && typeof vari === 'boolean') {
      const pass = orig === vari
      diffs.push({ metric: key, original: orig, variant: vari, delta: pass ? 0 : 'mismatch', pass, isLlm })
    } else if (typeof orig === 'number' && typeof vari === 'number') {
      const delta = Math.abs(orig - vari)
      const pass = delta <= tolerance
      diffs.push({ metric: key, original: orig, variant: vari, delta: round2(vari - orig), pass, isLlm })
    }
  }
  return diffs
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printMarkdownTable(
  variantName: string,
  description: string,
  diffs: DiffResult[],
): void {
  console.log(`\n### Variante ${variantName}: ${description}\n`)
  console.log('| Metrik | Original | Variante | Delta | Status |')
  console.log('|--------|----------|----------|-------|--------|')
  for (const d of diffs) {
    const status = d.pass
      ? (d.isLlm ? '⚠️ warn' : '✅ pass')
      : (d.isLlm ? '⚠️ warn' : '❌ fail')
    console.log(`| ${d.metric} | ${d.original} | ${d.variant} | ${d.delta} | ${status} |`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`[paraphrase-test] Fixtures directory not found: ${FIXTURES_DIR}`)
    process.exit(1)
  }

  const loadFixture = (filename: string): TranscriptFile => {
    const filepath = path.join(FIXTURES_DIR, filename)
    if (!fs.existsSync(filepath)) {
      throw new Error(`Fixture not found: ${filepath}`)
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8')) as TranscriptFile
  }

  const original = loadFixture('original.transcript.json')
  const variantA = loadFixture('variant-a.transcript.json')
  const variantB = loadFixture('variant-b.transcript.json')
  const variantC = loadFixture('variant-c.transcript.json')

  console.log('# Paraphrase-Robustheitstest (BL-E5.5)')
  console.log(`\nFixtures geladen: original + 3 Varianten (${original.turns.length} Turns je Transkript)`)
  console.log(`Toleranz: deterministisch ≤ ${DET_TOLERANCE} → ✅ Pass; LLM-Judge ≤ ${LLM_TOLERANCE} → ⚠️ Warnung`)

  // Offline scores
  const originalScores = runOfflineScorers(original.turns, original.status, original.finalStepTracker)
  const variantAScores = runOfflineScorers(variantA.turns, variantA.status, variantA.finalStepTracker)
  const variantBScores = runOfflineScorers(variantB.turns, variantB.status, variantB.finalStepTracker)
  const variantCScores = runOfflineScorers(variantC.turns, variantC.status, variantC.finalStepTracker)

  let anyDetFail = false
  const variants = [
    { name: 'A', description: variantA.variantDescription ?? 'Synonyme', scores: variantAScores },
    { name: 'B', description: variantB.variantDescription ?? 'Aktiv/Passiv', scores: variantBScores },
    { name: 'C', description: variantC.variantDescription ?? 'Stichpunkt/Fließtext', scores: variantCScores },
  ]

  console.log('\n## Deterministische Scorer\n')
  for (const v of variants) {
    const diffs = compareScores(v.name, originalScores, v.scores, false)
    printMarkdownTable(v.name, v.description, diffs)
    const hasFail = diffs.some(d => !d.pass)
    if (hasFail) anyDetFail = true
  }

  // LLM judges (optional)
  if (hasLlmKey()) {
    console.log('\n## LLM-Judge Scorer (optional)\n')
    const evalModel = original.model
    const [origLlm, varALlm, varBLlm, varCLlm] = await Promise.all([
      runLlmScorers(original.turns, evalModel),
      runLlmScorers(variantA.turns, evalModel),
      runLlmScorers(variantB.turns, evalModel),
      runLlmScorers(variantC.turns, evalModel),
    ])

    const llmVariants = [
      { name: 'A', description: variantA.variantDescription ?? 'Synonyme', scores: varALlm },
      { name: 'B', description: variantB.variantDescription ?? 'Aktiv/Passiv', scores: varBLlm },
      { name: 'C', description: variantC.variantDescription ?? 'Stichpunkt/Fließtext', scores: varCLlm },
    ]

    for (const v of llmVariants) {
      const diffs = compareScores(v.name, origLlm, v.scores, true)
      printMarkdownTable(v.name, v.description, diffs)
    }
  } else {
    console.log('\n## LLM-Judge Scorer\n')
    console.log('_Übersprungen (kein GOOGLE_GENERATIVE_AI_API_KEY oder ANTHROPIC_API_KEY gesetzt)._')
  }

  console.log('\n---')
  if (anyDetFail) {
    console.log('Ergebnis: ❌ Mindestens ein deterministischer Scorer hat die Toleranz überschritten.')
    process.exit(1)
  } else {
    console.log('Ergebnis: ✅ Alle deterministischen Scorer innerhalb der Toleranz.')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('[paraphrase-test] Fatal:', err)
  process.exit(1)
})
