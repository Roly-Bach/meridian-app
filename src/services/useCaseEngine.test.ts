import { describe, it, expect } from 'vitest'
import {
  runHeuristicEngine,
  hasSearchKeywords,
  clusterPainPointsByEmbedding,
  SCORE_HIGH_THRESHOLD,
  SCORE_MEDIUM_THRESHOLD,
  type EngineProcessStep,
  type ClusterContext,
  type PainPointForP4,
} from './useCaseEngine'

const BASE_STEP: EngineProcessStep = {
  id: 'step-1',
  workspace_id: 'ws-1',
  interview_id: 'interview-1',
  title: 'Rechnungen prüfen',
  description: 'Prüft eingehende Rechnungen',
  frequency: null,
  duration: null,
  data_sources: [],
  rule_based: false,
  error_rate_percent: null,
  media_breaks: 0,
}

const HOURLY_RATE = 45

// ── hasSearchKeywords ─────────────────────────────────────────────────────────

describe('hasSearchKeywords', () => {
  it('detects "suchen" in title', () => {
    expect(hasSearchKeywords({ ...BASE_STEP, title: 'Informationen suchen', description: null })).toBe(true)
  })

  it('detects "prüfen" in description', () => {
    expect(hasSearchKeywords({ ...BASE_STEP, title: 'Task', description: 'Daten prüfen und klären' })).toBe(true)
  })

  it('returns false when no keywords', () => {
    expect(hasSearchKeywords({ ...BASE_STEP, title: 'Rechnungen bearbeiten', description: 'Zahlen eingeben' })).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(hasSearchKeywords({ ...BASE_STEP, title: 'SUCHEN und FINDEN', description: null })).toBe(true)
  })
})

// ── runHeuristicEngine ────────────────────────────────────────────────────────

describe('runHeuristicEngine', () => {
  it('returns empty array when no steps', () => {
    expect(runHeuristicEngine([], HOURLY_RATE)).toEqual([])
  })

  it('skips steps without frequency', () => {
    const step = { ...BASE_STEP, duration: 60, rule_based: true }
    expect(runHeuristicEngine([step], HOURLY_RATE)).toEqual([])
  })

  it('skips steps without duration', () => {
    const step = { ...BASE_STEP, frequency: 22, rule_based: true }
    expect(runHeuristicEngine([step], HOURLY_RATE)).toEqual([])
  })

  // R1 — Vollautomatisierung
  it('R1: generates automation use case for high-freq rule-based step', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const uc = result.find((u) => u.type === 'automation')
    expect(uc).toBeDefined()
    // ROI: 22 × 1h × 12 × 0.85 × 45 = 10,098
    expect(uc!.roi_eur_per_year).toBeCloseTo(10098, 0)
    expect(uc!.effort).toBe('low')
    expect(uc!.priority).toBe('high')
    expect(uc!.quarter).toBe('Q1')
  })

  it('R1: does NOT fire when error_rate >= 10', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 15,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    // R1 should not fire; R6 should fire instead
    const r1Uc = result.find((u) => u.type === 'automation' && u.effort === 'low')
    expect(r1Uc).toBeUndefined()
  })

  // R2 — LLM-Extraktion
  it('R2: generates llm_extraction for email data source', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 10,
      duration: 30,
      data_sources: ['E-Mail', 'PDF'],
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const uc = result.find((u) => u.type === 'llm_extraction')
    expect(uc).toBeDefined()
    expect(uc!.effort).toBe('medium')
  })

  it('R2: does NOT fire when duration < 15', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 10,
      duration: 10,
      data_sources: ['PDF'],
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'llm_extraction')).toBeUndefined()
  })

  // R3 — Entscheidungsunterstützung
  it('R3: generates decision_support for error-prone judgment process', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 8,
      duration: 45,
      rule_based: false,
      error_rate_percent: 20,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const uc = result.find((u) => u.type === 'decision_support')
    expect(uc).toBeDefined()
    expect(uc!.effort).toBe('high')
  })

  // R4 — Medienbruch
  it('R4: generates automation for high media_breaks', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 5,
      duration: 30,
      media_breaks: 4,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const uc = result.find((u) => u.type === 'automation')
    expect(uc).toBeDefined()
  })

  // R1 + R4 conflict → R1 wins (higher ROI: 85% > 60%)
  it('R1 vs R4 conflict: keeps highest ROI automation (R1 wins)', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 5,
      media_breaks: 4,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const automationUcs = result.filter((u) => u.type === 'automation')
    expect(automationUcs).toHaveLength(1)
    // R1 ROI (85%) > R4 ROI (60%) → R1 wins
    expect(automationUcs[0].roi_eur_per_year).toBeCloseTo(10098, 0)
  })

  // R5 — RAG
  it('R5: generates rag for search process', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 10,
      duration: 20,
      title: 'Informationen nachschlagen',
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'rag')).toBeDefined()
  })

  // R6 — Fehlerhafte Regelautomatisierung
  it('R6: generates automation for rule-based process with high errors', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 10,
      duration: 30,
      rule_based: true,
      error_rate_percent: 25,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const uc = result.find((u) => u.type === 'automation')
    expect(uc).toBeDefined()
    expect(uc!.effort).toBe('medium')
  })

  // R7 — KI-unterstützte Routinearbeit
  it('R7: generates llm_extraction for recurring non-rule-based task', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 15,
      duration: 25,
      rule_based: false,
      error_rate_percent: 3,
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'llm_extraction')).toBeDefined()
  })

  // R8 — Daten-Aggregation
  it('R8: generates rag for long decision process without errors', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 8,
      duration: 60,
      rule_based: false,
      error_rate_percent: null,
      title: 'Quartalsplanung erstellen',
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'rag')).toBeDefined()
  })

  it('R8: does NOT fire when step has search keywords (R5 handles it)', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 8,
      duration: 60,
      rule_based: false,
      title: 'Informationen suchen und prüfen',
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    const rags = result.filter((u) => u.type === 'rag')
    // Only R5 rag, not R8 rag (same type — highest ROI kept)
    expect(rags).toHaveLength(1)
  })

  it('sorts by score descending', () => {
    const steps: EngineProcessStep[] = [
      { ...BASE_STEP, id: 'a', frequency: 5, duration: 20, data_sources: ['PDF'] },
      { ...BASE_STEP, id: 'b', frequency: 22, duration: 60, rule_based: true, error_rate_percent: 5 },
    ]
    const result = runHeuristicEngine(steps, HOURLY_RATE)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it('assigns correct priority based on score thresholds', () => {
    // Score > 5000 → high
    const highStep: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const high = runHeuristicEngine([highStep], HOURLY_RATE).find((u) => u.type === 'automation')
    expect(high!.priority).toBe('high')
    expect(high!.quarter).toBe('Q1')
    expect(high!.score).toBeGreaterThan(SCORE_HIGH_THRESHOLD) // DB column is numeric(12,2), no cap

    // Low score → low priority
    const lowStep: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 1,
      duration: 15,
      data_sources: ['PDF'],
    }
    const low = runHeuristicEngine([lowStep], HOURLY_RATE).find((u) => u.type === 'llm_extraction')
    expect(low!.priority).toBe('low')
    expect(low!.quarter).toBe('Q3')
    expect(low!.score).toBeLessThanOrEqual(SCORE_MEDIUM_THRESHOLD)
  })

  it('uses hourly_rate from workspace', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const at45 = runHeuristicEngine([step], 45)[0].roi_eur_per_year!
    const at90 = runHeuristicEngine([step], 90)[0].roi_eur_per_year!
    expect(at90).toBeCloseTo(at45 * 2, 0)
  })
})

// ── Qualitative Rules (P1-P3) ─────────────────────────────────────────────────

const QUAL_STEP: EngineProcessStep = {
  ...BASE_STEP,
  id: 'qual-step-1',
  interview_id: 'interview-qual',
  frequency: null,
  duration: null,
}

describe('runHeuristicEngine — qualitative rules (P1-P3)', () => {
  it('P1: generates process_improvement for high-severity pain_point', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Kritischer Engpass', severity: 'high' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    const uc = results.find(u => u.type === 'process_improvement')
    expect(uc).toBeDefined()
    expect(uc!.priority).toBe('high')
    expect(uc!.roi_eur_per_year).toBeNull()
    expect(uc!.roi_hours_per_year).toBeNull()
    expect(uc!.reasoning).toContain('Kritischer Engpass')
  })

  it('P1: does NOT generate process_improvement for medium-severity pain_point', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Mittlerer Engpass', severity: 'medium' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    expect(results.find(u => u.type === 'process_improvement')).toBeUndefined()
  })

  it('P2: generates tool_consolidation for ≥3 distinct tools', () => {
    const kos = [
      { type: 'tool' as const, content: { name: 'SAP' }, interview_id: 'interview-qual' },
      { type: 'tool' as const, content: { name: 'Excel' }, interview_id: 'interview-qual' },
      { type: 'tool' as const, content: { name: 'Outlook' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    const uc = results.find(u => u.type === 'tool_consolidation')
    expect(uc).toBeDefined()
    expect(uc!.priority).toBe('medium')
    expect(uc!.roi_eur_per_year).toBeNull()
    expect(uc!.description).toContain('SAP')
  })

  it('P2: does NOT generate tool_consolidation for <3 tools', () => {
    const kos = [
      { type: 'tool' as const, content: { name: 'SAP' }, interview_id: 'interview-qual' },
      { type: 'tool' as const, content: { name: 'Excel' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    expect(results.find(u => u.type === 'tool_consolidation')).toBeUndefined()
  })

  it('P3: generates automation_candidate for pain_point with manual keyword', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Alles wird manuell eingetragen', severity: 'medium' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    const uc = results.find(u => u.type === 'automation_candidate')
    expect(uc).toBeDefined()
    expect(uc!.reasoning).toContain('manuell')
  })

  it('P3: triggers on Excel keyword in pain_point', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Daten in Excel übertragen', severity: 'low' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    expect(results.find(u => u.type === 'automation_candidate')).toBeDefined()
  })

  it('no qualitative UCs when knowledgeObjects empty', () => {
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, [])
    expect(results.filter(u => ['process_improvement', 'tool_consolidation', 'automation_candidate'].includes(u.type))).toHaveLength(0)
  })

  it('deduplicates: only one process_improvement per interview', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Engpass 1', severity: 'high' }, interview_id: 'interview-qual' },
      { type: 'pain_point' as const, content: { description: 'Engpass 2', severity: 'high' }, interview_id: 'interview-qual' },
    ]
    const results = runHeuristicEngine([QUAL_STEP], HOURLY_RATE, kos)
    expect(results.filter(u => u.type === 'process_improvement')).toHaveLength(1)
  })
})

// ── Cluster Rules (C1–C3) ─────────────────────────────────────────────────────

const CLUSTER_STEP_A: EngineProcessStep = {
  id: 'cs-a',
  workspace_id: 'ws-1',
  interview_id: 'iv-1',
  title: 'Rechnungen prüfen',
  description: null,
  frequency: 10,
  duration: 45,
  data_sources: [],
  rule_based: true,
  error_rate_percent: 5,
  media_breaks: 0,
}

const CLUSTER_STEP_B: EngineProcessStep = {
  ...CLUSTER_STEP_A,
  id: 'cs-b',
  interview_id: 'iv-2',
  frequency: 8,
  error_rate_percent: 5,
}

function makeCluster(overrides: Partial<ClusterContext> = {}): ClusterContext {
  return {
    id: 'cluster-1',
    workspace_id: 'ws-1',
    canonical_title: 'Rechnungsverarbeitung',
    canonical_description: 'Mitarbeiter prüfen monatlich Rechnungen.',
    participant_count: 2,
    participants: [
      { interview_id: 'iv-1', employee_name: 'Max', employee_role: 'Buchhalter', process_step_id: 'cs-a', step: CLUSTER_STEP_A },
      { interview_id: 'iv-2', employee_name: 'Anna', employee_role: 'Assistenz', process_step_id: 'cs-b', step: CLUSTER_STEP_B },
    ],
    ...overrides,
  }
}

describe('runHeuristicEngine — cluster rules (C1–C3)', () => {
  it('C1: generates automation_at_scale when avg_frequency ≥ 5 and participant_count ≥ 2', () => {
    const cluster = makeCluster()
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    const uc = results.find(u => u.type === 'automation_at_scale')
    expect(uc).toBeDefined()
    expect(uc!.cluster_id).toBe('cluster-1')
    expect(uc!.process_step_id).toBeNull()
    expect(uc!.roi_eur_per_year).toBeGreaterThan(0)
    expect(uc!.roi_breakdown).not.toBeNull()
    expect(uc!.roi_breakdown!.participant_count).toBe(2)
  })

  it('C1: does NOT fire when avg_frequency < 5', () => {
    const lowFreqA = { ...CLUSTER_STEP_A, frequency: 3 }
    const lowFreqB = { ...CLUSTER_STEP_B, frequency: 2 }
    const cluster = makeCluster({
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step: lowFreqA },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: lowFreqB },
      ],
    })
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.type === 'automation_at_scale')).toBeUndefined()
  })

  it('C2: generates process_standardization when avg_error_rate ≥ 10%', () => {
    const errA = { ...CLUSTER_STEP_A, frequency: 3, error_rate_percent: 15 }
    const errB = { ...CLUSTER_STEP_B, frequency: 3, error_rate_percent: 12 }
    const cluster = makeCluster({
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step: errA },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: errB },
      ],
    })
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.type === 'process_standardization')).toBeDefined()
  })

  it('C2: does NOT fire when avg_error_rate < 10%', () => {
    const cluster = makeCluster() // error_rate_percent: 5
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.type === 'process_standardization')).toBeUndefined()
  })

  it('C3: generates knowledge_rag_at_scale when participant_count ≥ 3 and canonical_description has search keywords', () => {
    const stepC: EngineProcessStep = { ...CLUSTER_STEP_A, id: 'cs-c', interview_id: 'iv-3', frequency: 3 }
    const cluster = makeCluster({
      participant_count: 3,
      canonical_description: 'Mitarbeiter müssen Informationen suchen und nachschlagen.',
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step: { ...CLUSTER_STEP_A, frequency: 3 } },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: { ...CLUSTER_STEP_B, frequency: 3 } },
        { interview_id: 'iv-3', employee_name: 'Tom', employee_role: null, process_step_id: 'cs-c', step: stepC },
      ],
    })
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.type === 'knowledge_rag_at_scale')).toBeDefined()
  })

  it('C3: does NOT fire when participant_count < 3', () => {
    const cluster = makeCluster({
      participant_count: 2,
      canonical_description: 'Mitarbeiter müssen Informationen suchen.',
    })
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.type === 'knowledge_rag_at_scale')).toBeUndefined()
  })

  it('per cluster: only highest-score rule wins when multiple C-rules fire', () => {
    const highErrA = { ...CLUSTER_STEP_A, error_rate_percent: 20 }
    const highErrB = { ...CLUSTER_STEP_B, error_rate_percent: 20 }
    const cluster = makeCluster({
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step: highErrA },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: highErrB },
      ],
    })
    // C1 and C2 both fire — only one UC per cluster
    const results = runHeuristicEngine([], HOURLY_RATE, [], [cluster])
    const clusterUCs = results.filter(u => u.cluster_id === 'cluster-1')
    expect(clusterUCs).toHaveLength(1)
  })

  it('score is boosted by log2(participant_count + 1)', () => {
    const clusterOf2 = makeCluster({ participant_count: 2 })
    const clusterOf4 = makeCluster({
      id: 'cluster-2',
      participant_count: 4,
      participants: [
        { interview_id: 'iv-1', employee_name: 'A', employee_role: null, process_step_id: 'cs-a', step: CLUSTER_STEP_A },
        { interview_id: 'iv-2', employee_name: 'B', employee_role: null, process_step_id: 'cs-b', step: CLUSTER_STEP_B },
        { interview_id: 'iv-3', employee_name: 'C', employee_role: null, process_step_id: 'cs-c', step: { ...CLUSTER_STEP_A, id: 'cs-c', interview_id: 'iv-3' } },
        { interview_id: 'iv-4', employee_name: 'D', employee_role: null, process_step_id: 'cs-d', step: { ...CLUSTER_STEP_A, id: 'cs-d', interview_id: 'iv-4' } },
      ],
    })
    const r2 = runHeuristicEngine([], HOURLY_RATE, [], [clusterOf2]).find(u => u.cluster_id === 'cluster-1')!
    const r4 = runHeuristicEngine([], HOURLY_RATE, [], [clusterOf4]).find(u => u.cluster_id === 'cluster-2')!
    expect(r4.score).toBeGreaterThan(r2.score)
  })
})

// ── Suppression Logic ─────────────────────────────────────────────────────────

describe('runHeuristicEngine — suppression logic', () => {
  it('individual R-rules suppressed for steps covered by a cluster UC', () => {
    const step: EngineProcessStep = {
      ...CLUSTER_STEP_A,
      id: 'cs-a',
      frequency: 22,
      duration: 60,
      rule_based: true,
    }
    const cluster = makeCluster({
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: CLUSTER_STEP_B },
      ],
    })
    // 'cs-a' satisfies R1 criteria — but should be suppressed by the cluster
    const results = runHeuristicEngine([step], HOURLY_RATE, [], [cluster])
    const individual = results.find(u => u.process_step_id === 'cs-a')
    expect(individual).toBeUndefined()
    // Cluster UC is still present
    expect(results.find(u => u.cluster_id === 'cluster-1')).toBeDefined()
  })

  it('R-rules still run for steps NOT in any cluster', () => {
    const uncoveredStep: EngineProcessStep = {
      ...BASE_STEP,
      id: 'uncovered',
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const cluster = makeCluster() // covers only 'cs-a' and 'cs-b'
    const results = runHeuristicEngine([uncoveredStep], HOURLY_RATE, [], [cluster])
    expect(results.find(u => u.process_step_id === 'uncovered')).toBeDefined()
  })

  it('R-rules run normally when cluster has no C-rule (no qualifying condition)', () => {
    // Low frequency cluster — no C-rule fires → no suppression
    const lowA = { ...CLUSTER_STEP_A, frequency: 2, error_rate_percent: 2 }
    const lowB = { ...CLUSTER_STEP_B, frequency: 2, error_rate_percent: 2 }
    const clusterStep: EngineProcessStep = {
      ...BASE_STEP,
      id: 'cs-a',
      frequency: 22,
      duration: 60,
      rule_based: true,
      error_rate_percent: 2,
    }
    const cluster = makeCluster({
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: null, process_step_id: 'cs-a', step: lowA },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: null, process_step_id: 'cs-b', step: lowB },
      ],
    })
    const results = runHeuristicEngine([clusterStep], HOURLY_RATE, [], [cluster])
    // No cluster UC generated (conditions not met)
    expect(results.find(u => u.cluster_id === 'cluster-1')).toBeUndefined()
    // Individual UC should exist (not suppressed)
    expect(results.find(u => u.process_step_id === 'cs-a')).toBeDefined()
  })
})

// ── clusterPainPointsByEmbedding (P4) ─────────────────────────────────────────

function vec(a: number, b: number): number[] {
  const norm = Math.sqrt(a * a + b * b)
  return [a / norm, b / norm]
}

describe('clusterPainPointsByEmbedding', () => {
  it('groups pain_points with cosine similarity ≥ 0.78 into same group', () => {
    const pp: PainPointForP4[] = [
      { interview_id: 'iv-1', description: 'Dokument suchen', severity: 'high', embedding: vec(1, 0.05) },
      { interview_id: 'iv-2', description: 'Datei finden dauert', severity: 'medium', embedding: vec(1, 0.06) },
    ]
    const groups = clusterPainPointsByEmbedding(pp)
    expect(groups).toHaveLength(1)
    expect(groups[0].points).toHaveLength(2)
  })

  it('keeps pain_points in separate groups when cosine similarity < 0.78', () => {
    const pp: PainPointForP4[] = [
      { interview_id: 'iv-1', description: 'Dokument suchen', severity: 'high', embedding: vec(1, 0) },
      { interview_id: 'iv-2', description: 'SAP too slow', severity: 'medium', embedding: vec(0, 1) },
    ]
    const groups = clusterPainPointsByEmbedding(pp)
    expect(groups).toHaveLength(2)
    expect(groups.every(g => g.points.length === 1)).toBe(true)
  })

  it('returns empty array for empty input', () => {
    expect(clusterPainPointsByEmbedding([])).toEqual([])
  })

  it('returns single group with one item for single input', () => {
    const pp: PainPointForP4[] = [
      { interview_id: 'iv-1', description: 'Engpass', severity: 'high', embedding: vec(1, 0) },
    ]
    const groups = clusterPainPointsByEmbedding(pp)
    expect(groups).toHaveLength(1)
    expect(groups[0].points).toHaveLength(1)
  })

  it('uses custom threshold', () => {
    // cosine([1,0], [0.8,0.6]) = 0.8 — above 0.50, below 0.99
    const pp: PainPointForP4[] = [
      { interview_id: 'iv-1', description: 'A', severity: 'medium', embedding: [1, 0] },
      { interview_id: 'iv-2', description: 'B', severity: 'medium', embedding: [0.8, 0.6] },
    ]
    const strictGroups = clusterPainPointsByEmbedding(pp, 0.99)
    const looseGroups = clusterPainPointsByEmbedding(pp, 0.50)
    expect(strictGroups).toHaveLength(2)
    expect(looseGroups).toHaveLength(1)
  })
})

// ── P4: Cross-Interview Pain Point Clustering ─────────────────────────────────

describe('runHeuristicEngine — P4 cross-interview pain point clustering', () => {
  const ANCHOR_STEP: EngineProcessStep = {
    ...BASE_STEP,
    id: 'anchor',
    interview_id: 'iv-1',
  }

  it('P4: generates cross_team_pain_resolution when ≥2 similar pain_points from different interviews', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Dokument suchen kostet Zeit', severity: 'high' }, interview_id: 'iv-1', embedding: vec(1, 0.05) },
      { type: 'pain_point' as const, content: { description: 'Datei finden dauert ewig', severity: 'medium' }, interview_id: 'iv-2', embedding: vec(1, 0.06) },
    ]
    const stepIv2: EngineProcessStep = { ...BASE_STEP, id: 'step-iv2', interview_id: 'iv-2' }
    const results = runHeuristicEngine([ANCHOR_STEP, stepIv2], HOURLY_RATE, kos)
    const p4 = results.find(u => u.type === 'cross_team_pain_resolution')
    expect(p4).toBeDefined()
    expect(p4!.cluster_id).toBeNull()
  })

  it('P4: does NOT fire when similar pain_points are from same interview', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Dokument A suchen', severity: 'high' }, interview_id: 'iv-1', embedding: vec(1, 0.05) },
      { type: 'pain_point' as const, content: { description: 'Dokument B suchen', severity: 'high' }, interview_id: 'iv-1', embedding: vec(1, 0.06) },
    ]
    const results = runHeuristicEngine([ANCHOR_STEP], HOURLY_RATE, kos)
    expect(results.find(u => u.type === 'cross_team_pain_resolution')).toBeUndefined()
  })

  it('P4: pain_points without embedding are ignored (no error)', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'No embedding', severity: 'high' }, interview_id: 'iv-1' }, // no embedding
      { type: 'pain_point' as const, content: { description: 'Also no embedding', severity: 'high' }, interview_id: 'iv-2' },
    ]
    const stepIv2: EngineProcessStep = { ...BASE_STEP, id: 'step-iv2', interview_id: 'iv-2' }
    expect(() => runHeuristicEngine([ANCHOR_STEP, stepIv2], HOURLY_RATE, kos)).not.toThrow()
    const results = runHeuristicEngine([ANCHOR_STEP, stepIv2], HOURLY_RATE, kos)
    expect(results.find(u => u.type === 'cross_team_pain_resolution')).toBeUndefined()
  })

  it('P4: priority matches max severity of the group', () => {
    const kos = [
      { type: 'pain_point' as const, content: { description: 'Critical bottleneck', severity: 'high' }, interview_id: 'iv-1', embedding: vec(1, 0.05) },
      { type: 'pain_point' as const, content: { description: 'Same problem', severity: 'low' }, interview_id: 'iv-2', embedding: vec(1, 0.06) },
    ]
    const stepIv2: EngineProcessStep = { ...BASE_STEP, id: 'step-iv2', interview_id: 'iv-2' }
    const results = runHeuristicEngine([ANCHOR_STEP, stepIv2], HOURLY_RATE, kos)
    const p4 = results.find(u => u.type === 'cross_team_pain_resolution')
    expect(p4?.priority).toBe('high')
  })
})
