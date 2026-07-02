import { describe, it, expect } from 'vitest'
import {
  compareRankings,
  aggregateQuality,
  aggregateCells,
  buildContrast,
  contrastPasses,
  type TranscriptRow,
} from './testerStability'
import type { ScoreSet } from '../scorers'

describe('compareRankings', () => {
  it('identical scores → pairAgreement 1, top rank stable', () => {
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 3, B: 2, C: 1 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['A', 'B', 'C'])
    expect(r.pairAgreement).toBe(1)
    expect(r.topRankStable).toBe(true)
  })

  it('fully reversed ranking → pairAgreement 0, top rank unstable', () => {
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 1, B: 2, C: 3 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['C', 'B', 'A'])
    expect(r.pairAgreement).toBe(0)
    expect(r.topRankStable).toBe(false)
  })

  it('one swapped pair out of three → pairAgreement 0.6667, top rank stable', () => {
    // weak [A,B,C]; strong [A,C,B]. pairs (A,B)✓ (A,C)✓ (B,C)✗ → 2/3.
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 3, B: 1, C: 2 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['A', 'C', 'B'])
    expect(r.pairAgreement).toBe(0.6667)
    expect(r.topRankStable).toBe(true)
  })

  it('ties broken deterministically by model name', () => {
    const r = compareRankings({ A: 2, B: 2 }, { A: 2, B: 2 })
    expect(r.rankingWeak).toEqual(['A', 'B'])
    // tie in both → concordant
    expect(r.pairAgreement).toBe(1)
  })

  it('throws when the two maps cover different models', () => {
    expect(() => compareRankings({ A: 1, B: 2 }, { A: 1, C: 2 })).toThrow(/same models/)
  })
})

describe('aggregateQuality', () => {
  const mk = (dedup: number): ScoreSet => ({ dedupSlotCoverage: dedup } as ScoreSet)

  it('median of dedupSlotCoverage across runs (odd count)', () => {
    expect(aggregateQuality([mk(0.8), mk(0.9), mk(0.7)])).toBe(0.8)
  })

  it('median across even count averages the two middle values', () => {
    expect(aggregateQuality([mk(0.8), mk(0.9), mk(0.7), mk(1.0)])).toBe(0.85)
  })

  it('empty → 0', () => {
    expect(aggregateQuality([])).toBe(0)
  })
})

// ─── Cell aggregation + contrast selection ───────────────────────────────────────

function row(model: string, tester: string, mode: string, dedup: number, persona = 'buchhalter'): TranscriptRow {
  return { model, persona, testerModel: tester, disclosureMode: mode, scores: { dedupSlotCoverage: dedup } as ScoreSet }
}

const WEAK = 'google/gemini-3.1-flash-lite'
const STRONG = 'anthropic/claude-sonnet-4-5'
const MODE_B = 'withhold_numbers_only'
const MODE_A = 'withhold_tools_and_numbers'

describe('aggregateCells', () => {
  it('groups by (tester, mode) cell and medians quality per interview model', () => {
    const rows = [
      row('m1', WEAK, MODE_B, 0.8), row('m1', WEAK, MODE_B, 0.9), // m1 median 0.85
      row('m2', WEAK, MODE_B, 0.5),
      row('m1', STRONG, MODE_B, 0.7),
    ]
    const cells = aggregateCells(rows)
    // deterministic order: STRONG (anthropic) sorts before WEAK (google)
    expect(cells.map(c => c.testerModel)).toEqual([STRONG, WEAK])
    const weakCell = cells.find(c => c.testerModel === WEAK && c.disclosureMode === MODE_B)!
    expect(weakCell.qualityByModel).toEqual({ m1: 0.85, m2: 0.5 })
    expect(weakCell.runsByModel).toEqual({ m1: 2, m2: 1 })
  })
})

describe('buildContrast', () => {
  const cells = aggregateCells([
    // reference mode B: weak ranks m1>m2, strong ranks m1>m2 (concordant)
    row('m1', WEAK, MODE_B, 0.9), row('m2', WEAK, MODE_B, 0.6),
    row('m1', STRONG, MODE_B, 0.8), row('m2', STRONG, MODE_B, 0.4),
    // mode A under weak: ranking flips (m2>m1)
    row('m1', WEAK, MODE_A, 0.3), row('m2', WEAK, MODE_A, 0.7),
  ])

  it('tester-strength contrast holds mode fixed, varies tester', () => {
    const c = buildContrast(cells, {
      dimension: 'Tester-Stärke', vary: 'testerModel', valueA: WEAK, valueB: STRONG,
      fixed: 'disclosureMode', fixedValue: MODE_B,
    })!
    expect(c.modelsCompared).toEqual(['m1', 'm2'])
    expect(c.stability.pairAgreement).toBe(1)
    expect(c.stability.topRankStable).toBe(true)
    expect(contrastPasses(c, 0.8)).toBe(true)
  })

  it('disclosure contrast catches a mode-induced ranking flip', () => {
    const c = buildContrast(cells, {
      dimension: 'Offenlegungs-Modus', vary: 'disclosureMode', valueA: MODE_A, valueB: MODE_B,
      fixed: 'testerModel', fixedValue: WEAK,
    })!
    // mode A: m2>m1; mode B: m1>m2 → fully reversed
    expect(c.stability.pairAgreement).toBe(0)
    expect(c.stability.topRankStable).toBe(false)
    expect(contrastPasses(c, 0.8)).toBe(false)
  })

  it('returns null when a required cell is absent', () => {
    const c = buildContrast(cells, {
      dimension: 'Tester-Stärke', vary: 'testerModel', valueA: WEAK, valueB: STRONG,
      fixed: 'disclosureMode', fixedValue: MODE_A, // no STRONG cell under mode A
    })
    expect(c).toBeNull()
  })

  it('returns null when fewer than two shared models remain', () => {
    const thin = aggregateCells([
      row('m1', WEAK, MODE_B, 0.9),
      row('m2', STRONG, MODE_B, 0.5), // different model → no overlap
    ])
    const c = buildContrast(thin, {
      dimension: 'Tester-Stärke', vary: 'testerModel', valueA: WEAK, valueB: STRONG,
      fixed: 'disclosureMode', fixedValue: MODE_B,
    })
    expect(c).toBeNull()
  })
})

describe('contrastPasses', () => {
  const mk = (pa: number, top: boolean) => ({
    dimension: 'x', conditionA: 'a', conditionB: 'b', modelsCompared: ['m1', 'm2'],
    stability: { rankingWeak: [], rankingStrong: [], pairAgreement: pa, topRankStable: top },
  })
  it('needs both pairAgreement ≥ band AND stable top rank', () => {
    expect(contrastPasses(mk(0.8, true), 0.8)).toBe(true)
    expect(contrastPasses(mk(0.8, false), 0.8)).toBe(false) // top rank flipped
    expect(contrastPasses(mk(0.79, true), 0.8)).toBe(false) // below band
  })
})
