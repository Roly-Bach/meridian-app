#!/usr/bin/env tsx
/**
 * Tester-Stabilität (PROJ-40, Acceptance D — Instrument-Validierung Stufe 2).
 *
 * SCAFFOLD — NOT executed in Batch 1. Execution is a Checkpoint step (fresh runs cost
 * LLM budget). Batch 1 delivers the runnable structure plus the pure ranking-comparison
 * (`compareRankings`), which is the only LLM-free, unit-testable piece here.
 *
 * Question: does the ranking of interview models stay stable when the persona simulator
 * (tester) gets stronger? If a weak tester ranks the interview models differently than a
 * strong tester, the tester is part of the measurement error and the benchmark can't be
 * trusted (ADR-020; PROJ-40 D). Keep the sweep small (ADR-020 / Tech Design risks): one
 * fixed seed, two tester strengths, all three personas.
 *
 * Fresh runs are produced by the existing eval runner with TESTER_MODEL swept
 * (`TESTER_MODEL=<m> npm run eval:interview -- --models <interview-models> --seed <s>`),
 * which writes transcript.json files carrying a per-run `scores` ScoreSet. This harness then
 * aggregates those per interview-model and compares the two rankings — no duplicate run logic.
 */
import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import { resolveModel } from '@/lib/llm-provider'
import { PERSONA_MAP } from '../personas/loadPersona'
import type { ScoreSet } from '../scorers'

// ─── Pure ranking comparison (LLM-free, unit-tested) ────────────────────────────

export interface RankingStability {
  /** Interview models ranked best→worst under the weak tester. */
  rankingWeak: string[]
  /** Interview models ranked best→worst under the strong tester. */
  rankingStrong: string[]
  /** Fraction of model pairs whose relative order agrees across the two testers (Kendall-style
   * concordance, range 0–1). 1 = identical ranking, 0 = fully reversed. */
  pairAgreement: number
  /** True when the single best model is the same under both testers. */
  topRankStable: boolean
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0
}

/** Rank models best→worst by score; ties broken by model name ascending for determinism. */
function rankByScore(scores: Record<string, number>): string[] {
  return Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))
}

/**
 * Compare two interview-model rankings (one per tester strength). `pairAgreement` is the
 * fraction of unordered model pairs whose relative order is concordant between the two score
 * maps — a tie in one map only counts as concordant if it's a tie in the other too.
 */
export function compareRankings(
  weakScores: Record<string, number>,
  strongScores: Record<string, number>,
): RankingStability {
  const models = Object.keys(weakScores)
  const strongModels = Object.keys(strongScores)
  if (models.length !== strongModels.length || !models.every(m => m in strongScores)) {
    throw new Error('compareRankings: weak and strong score maps must cover the same models')
  }

  let concordant = 0
  let totalPairs = 0
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const x = models[i]
      const y = models[j]
      totalPairs++
      if (sign(weakScores[x] - weakScores[y]) === sign(strongScores[x] - strongScores[y])) {
        concordant++
      }
    }
  }

  const rankingWeak = rankByScore(weakScores)
  const rankingStrong = rankByScore(strongScores)

  return {
    rankingWeak,
    rankingStrong,
    pairAgreement: totalPairs === 0 ? 1 : Math.round((concordant / totalPairs) * 10000) / 10000,
    topRankStable: rankingWeak[0] === rankingStrong[0],
  }
}

/** Median of a ScoreSet field across a model's runs — the quality summary used to rank models. */
export function aggregateQuality(scores: ScoreSet[], key: keyof ScoreSet = 'dedupSlotCoverage'): number {
  const vals = scores.map(s => s[key]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10000) / 10000
}

// ─── CLI scaffold (Checkpoint execution only — guarded against import) ───────────

async function main(): Promise<void> {
  const weakTester = process.env.TESTER_MODEL_WEAK ?? 'google/gemini-3.1-flash-lite'
  const strongTester = process.env.TESTER_MODEL_STRONG ?? 'anthropic/claude-sonnet-4-5'
  const interviewModels = (process.env.INTERVIEW_MODELS ?? 'google/gemini-3.1-flash-lite,google/gemini-3.5-flash')
    .split(',').map(s => s.trim()).filter(Boolean)

  // Fail the preflight here, not after expensive runs, if a tester model string is invalid.
  resolveModel(weakTester)
  resolveModel(strongTester)

  const personas = Object.keys(PERSONA_MAP)
  console.log(`[testerStability] interview models=${interviewModels.join(', ')} personas=${personas.join(', ')}`)
  console.log(`[testerStability] weak tester=${weakTester} strong tester=${strongTester}`)

  // TODO(Checkpoint): for each tester strength, run the existing eval runner with TESTER_MODEL
  // set across `interviewModels` × `personas` at a fixed seed, then load the produced
  // transcript.json `scores`, group by interview model, and aggregate via aggregateQuality()
  // into weakScores / strongScores. Then:
  //   const stability = compareRankings(weakScores, strongScores)
  // and bewerte stability.pairAgreement / stability.topRankStable gegen das Versuchsplan-Band.
  console.log('[testerStability] scaffold only — sweep + aggregation wired at Checkpoint (see TODO).')
}

// Only run when executed directly (not when imported by tests) — otherwise importing
// compareRankings in a unit test would trigger the scaffold. Same ESM guard pattern as
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
    console.error('[testerStability] Fatal:', err)
    process.exit(1)
  })
}
