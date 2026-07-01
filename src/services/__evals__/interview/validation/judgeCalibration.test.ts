import { describe, it, expect } from 'vitest'
import {
  computeAgreement,
  computeWeightedAgreement,
  confusionMatrix,
  ordinalOffset,
  toOrdinal,
  computeAggregates,
  buildMarkdown,
  type DimObservation,
  type PerTranscriptRecord,
} from './judgeCalibration'

describe('computeAgreement (Cohen Kappa + match rate)', () => {
  it('perfect agreement over 3 categories → matchRate 1, kappa 1', () => {
    // p_o = 1; p_e = 3 × (1/3 × 1/3) = 1/3; kappa = (1 − 1/3)/(1 − 1/3) = 1
    const r = computeAgreement([1, 2, 3], [1, 2, 3])
    expect(r.n).toBe(3)
    expect(r.matchRate).toBe(1)
    expect(r.kappa).toBe(1)
  })

  it('chance-level agreement → kappa 0', () => {
    // A=[1,1,2,2] B=[1,2,1,2]: matches at idx 0 and 3 → p_o = 0.5.
    // Marginals both {1:2, 2:2} → p_e = (0.5×0.5)+(0.5×0.5) = 0.5.
    // kappa = (0.5 − 0.5)/(1 − 0.5) = 0.
    const r = computeAgreement([1, 1, 2, 2], [1, 2, 1, 2])
    expect(r.matchRate).toBe(0.5)
    expect(r.kappa).toBe(0)
  })

  it('single category used by both → matchRate 1, kappa 1 (undefined-case convention)', () => {
    // p_e = 1 (only one category). Convention: full match → kappa 1.
    const r = computeAgreement([1, 1, 1], [1, 1, 1])
    expect(r.matchRate).toBe(1)
    expect(r.kappa).toBe(1)
  })

  it('total disagreement on a single shared category set → kappa negative', () => {
    // A=[1,2] B=[2,1]: 0 matches → p_o = 0. Marginals both {1:1,2:1} → p_e = 0.5.
    // kappa = (0 − 0.5)/(1 − 0.5) = −1.
    const r = computeAgreement([1, 2], [2, 1])
    expect(r.matchRate).toBe(0)
    expect(r.kappa).toBe(-1)
  })

  it('partial agreement on discrete judge levels (0.33/0.67/1.0)', () => {
    // A=[0.33,0.67,1,0.67] B=[0.33,0.67,0.67,1]: matches idx 0,1 → p_o = 0.5.
    // A marginals {0.33:1, 0.67:2, 1:1}, B marginals {0.33:1, 0.67:2, 1:1}.
    // p_e = (1/4×1/4)+(2/4×2/4)+(1/4×1/4) = 0.0625+0.25+0.0625 = 0.375.
    // kappa = (0.5 − 0.375)/(1 − 0.375) = 0.125/0.625 = 0.2.
    const r = computeAgreement([0.33, 0.67, 1, 0.67], [0.33, 0.67, 0.67, 1])
    expect(r.matchRate).toBe(0.5)
    expect(r.kappa).toBe(0.2)
  })

  it('throws on length mismatch', () => {
    expect(() => computeAgreement([1, 2], [1])).toThrow(/differ in length/)
  })

  it('empty input → zeroed stats', () => {
    expect(computeAgreement([], [])).toEqual({ n: 0, matchRate: 0, kappa: 0 })
  })
})

describe('toOrdinal (level → ordinal index)', () => {
  it('dialog 0.33/0.5/0.67/1.0 → 0/1/1/2', () => {
    expect(toOrdinal('dialog', 0.33)).toBe(0)
    expect(toOrdinal('dialog', 0.5)).toBe(1)
    expect(toOrdinal('dialog', 0.67)).toBe(1)
    expect(toOrdinal('dialog', 1.0)).toBe(2)
  })
  it('depth 1/2/3 → 0/1/2', () => {
    expect(toOrdinal('depth', 1)).toBe(0)
    expect(toOrdinal('depth', 2)).toBe(1)
    expect(toOrdinal('depth', 3)).toBe(2)
  })
  it('grounding binary → 0/1', () => {
    expect(toOrdinal('grounding', 0)).toBe(0)
    expect(toOrdinal('grounding', 1)).toBe(1)
  })
})

describe('confusionMatrix (ordinal indices)', () => {
  it('builds a k×k count matrix, rows=prod cols=ref', () => {
    // a(prod)=[0,1,2,1] b(ref)=[0,1,1,2]
    const m = confusionMatrix([0, 1, 2, 1], [0, 1, 1, 2], 3)
    expect(m).toEqual([
      [1, 0, 0],
      [0, 1, 1],
      [0, 1, 0],
    ])
  })
  it('throws on out-of-range index', () => {
    expect(() => confusionMatrix([0, 3], [0, 0], 3)).toThrow(/out of range/)
  })
  it('throws on length mismatch', () => {
    expect(() => confusionMatrix([0, 1], [0], 3)).toThrow(/differ in length/)
  })
})

describe('computeWeightedAgreement (linear-weighted Kappa, ordered levels)', () => {
  it('perfect agreement → weightedKappa 1', () => {
    expect(computeWeightedAgreement([0, 1, 2], [0, 1, 2], 3)).toEqual({ n: 3, weightedKappa: 1 })
  })

  it('k=2 reduces exactly to nominal kappa (chance-level → 0)', () => {
    // Same data as the nominal chance-level case → both must yield kappa 0.
    expect(computeWeightedAgreement([0, 0, 1, 1], [0, 1, 0, 1], 2).weightedKappa).toBe(0)
    expect(computeAgreement([0, 0, 1, 1], [0, 1, 0, 1]).kappa).toBe(0)
  })

  it('adjacent-only disagreement: weighted κ exceeds the (negative) nominal κ', () => {
    // a(prod)=[0,1] b(ref)=[1,2] — both disagreements are one level apart.
    // Nominal punishes them fully (κ = −0.3333); linear-weighted forgives adjacency (κ = 0).
    expect(computeAgreement([0, 1], [1, 2]).kappa).toBe(-0.3333)
    expect(computeWeightedAgreement([0, 1], [1, 2], 3).weightedKappa).toBe(0)
  })

  it('empty input → zeroed', () => {
    expect(computeWeightedAgreement([], [], 3)).toEqual({ n: 0, weightedKappa: 0 })
  })
})

describe('ordinalOffset (signed bias direction + adjacency)', () => {
  it('prod systematically below ref → negative mean, full adjacency', () => {
    // a(prod)=[0,1,2] b(ref)=[1,2,2] → diffs −1,−1,0
    expect(ordinalOffset([0, 1, 2], [1, 2, 2])).toEqual({ n: 3, meanSignedDiff: -0.6667, adjacencyRate: 1 })
  })
  it('two-level gaps → zero adjacency', () => {
    expect(ordinalOffset([2, 2], [0, 0])).toEqual({ n: 2, meanSignedDiff: 2, adjacencyRate: 0 })
  })
  it('empty input → zeroed', () => {
    expect(ordinalOffset([], [])).toEqual({ n: 0, meanSignedDiff: 0, adjacencyRate: 0 })
  })
  it('throws on length mismatch', () => {
    expect(() => ordinalOffset([0, 1], [0])).toThrow(/differ in length/)
  })
})

// ─── Aggregation + rendering (offline, no judge call, no filesystem) ─────────────

function dim(prod: number, ref: number, extra: Partial<DimObservation> = {}): DimObservation {
  return { prodLevel: prod, refLevel: ref, match: prod === ref, prodRationale: 'p', refRationale: 'r', ...extra }
}

// 4 synthetic transcripts exercising: exact match, adjacent dialog mismatch, null depth,
// grounding parseFailed on prod (T3) and on ref (T4). Two reference judges (identical here) to
// prove the per-reference sectioning.
const REFS = ['ref-A', 'ref-B']
function mkRecords(): PerTranscriptRecord[] {
  const rec = (id: string, dialog: DimObservation, depth: DimObservation | null, grounding: DimObservation): PerTranscriptRecord => {
    const byReference: PerTranscriptRecord['byReference'] = {}
    for (const r of REFS) byReference[r] = { dialog, depth, grounding }
    return { id, persona: 'buchhalter', model: 'google/gemini-3.1-flash-lite', qualityTier: 'mid', byReference }
  }
  return [
    rec('T1', dim(0.67, 0.67), dim(2, 2), dim(0, 0)),
    rec('T2', dim(0.67, 1.0), null, dim(1, 0)),
    rec('T3', dim(0.33, 0.33), dim(1, 2), dim(0, 0, { prodParseFailed: true })),
    rec('T4', dim(1.0, 0.33), dim(3, 3), dim(0, 0, { refParseFailed: true })),
  ]
}

describe('computeAggregates', () => {
  const agg = computeAggregates(mkRecords(), REFS)['ref-A']

  it('dialog: n, ordinal offset and adjacency over ordered levels', () => {
    // ordinal prod−ref: T1 1−1=0, T2 1−2=−1, T3 0−0=0, T4 2−0=+2 → mean 0.25, adjacency 3/4
    expect(agg.dialog.n).toBe(4)
    expect(agg.dialog.meanSignedDiff).toBe(0.25)
    expect(agg.dialog.adjacencyRate).toBe(0.75)
    expect(agg.dialog.confusion).toEqual([
      [1, 0, 0],
      [0, 1, 1],
      [1, 0, 0],
    ])
  })

  it('depth: null observations are excluded from n', () => {
    expect(agg.depth.n).toBe(3) // T2 depth null dropped
  })

  it('grounding: raw keeps all, clean drops parseFailed rows, artifact count is exposed', () => {
    expect(agg.grounding.n).toBe(4)
    expect(agg.groundingClean.n).toBe(2) // T3 (prod) + T4 (ref) dropped
    expect(agg.groundingArtifacts).toBe(2)
  })
})

describe('computeAggregates — Exclude-Self (Record ohne Referenz)', () => {
  it('ein Judge, der ein Transkript nicht bewertet hat, zählt dort nicht mit', () => {
    const recs = mkRecords() // 4 Records, alle mit ref-A und ref-B
    delete recs[0].byReference['ref-B'] // simuliert Exclude-Self für ref-B auf T1
    const agg = computeAggregates(recs, REFS)
    expect(agg['ref-A'].dialog.n).toBe(4) // ref-A unverändert
    expect(agg['ref-B'].dialog.n).toBe(3) // ref-B: T1 ausgeschlossen
    // buildMarkdown darf mit fehlender Referenz nicht crashen und die Zeile überspringen
    const md = buildMarkdown('2026-07-01', recs, REFS, agg)
    expect(md).toContain('## Referenz-Judge: ref-B')
  })
})

describe('buildMarkdown', () => {
  const md = buildMarkdown('2026-07-01', mkRecords(), REFS, computeAggregates(mkRecords(), REFS))

  it('renders one panel per reference judge', () => {
    expect(md).toContain('## Referenz-Judge: ref-A')
    expect(md).toContain('## Referenz-Judge: ref-B')
  })
  it('includes ordinal diagnostics + confusion matrix + raw-vs-clean grounding', () => {
    expect(md).toContain('gewichtetes-κ')
    expect(md).toContain('Adjazenz')
    expect(md).toContain('prod↓ / ref→')
    expect(md).toContain('roh vs. bereinigt')
    expect(md).toContain('Artefakt-Anteil: 2/4')
  })
  it('marks mismatches (✗) and grounding parseFailed (⚠) in the per-transcript table', () => {
    expect(md).toContain('✗')
    expect(md).toContain('⚠')
  })
})
