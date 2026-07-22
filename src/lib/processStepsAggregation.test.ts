import { describe, it, expect } from 'vitest'
import {
  groupStepsByDeptAndCluster,
  computeInterviewStepCounts,
  computeClusterAggregates,
  computeSummaryStats,
  type ProcessStep,
} from './processStepsAggregation'

function makeStep(overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id: 'step-1',
    interview_id: 'iv-1',
    workspace_id: 'ws-1',
    cluster_id: null,
    title: 'Rechnung prüfen',
    description: null,
    frequency: 10,
    duration: 15,
    data_sources: [],
    rule_based: false,
    error_rate_percent: null,
    media_breaks: 0,
    source_quote: null,
    step_type: 'action',
    condition_text: null,
    substeps: null,
    created_at: '2026-06-25T00:00:00Z',
    interviews: { department: 'Buchhaltung', employee_name: 'Anna', employee_role: null, status: 'completed' },
    process_clusters: null,
    ...overrides,
  }
}

describe('groupStepsByDeptAndCluster', () => {
  it('groups steps with cluster_id under the cluster key', () => {
    const steps = [
      makeStep({ id: 's1', cluster_id: 'c1' }),
      makeStep({ id: 's2', cluster_id: 'c1' }),
    ]
    const result = groupStepsByDeptAndCluster(steps)
    expect(result['Buchhaltung']['c1']).toHaveLength(2)
  })

  it('gives each step with null cluster_id its own solo key', () => {
    const steps = [makeStep({ id: 's1', cluster_id: null }), makeStep({ id: 's2', cluster_id: null })]
    const result = groupStepsByDeptAndCluster(steps)
    expect(Object.keys(result['Buchhaltung'])).toEqual(['solo-s1', 'solo-s2'])
  })

  it('falls back to "Unbekannt" when department is missing', () => {
    const steps = [makeStep({ interviews: null })]
    const result = groupStepsByDeptAndCluster(steps)
    expect(result['Unbekannt']).toBeDefined()
  })
})

describe('computeInterviewStepCounts', () => {
  it('counts steps per interview_id', () => {
    const steps = [makeStep({ interview_id: 'iv-1' }), makeStep({ interview_id: 'iv-1' }), makeStep({ interview_id: 'iv-2' })]
    expect(computeInterviewStepCounts(steps)).toEqual({ 'iv-1': 2, 'iv-2': 1 })
  })
})

describe('computeClusterAggregates', () => {
  it('averages mixed null and numeric values, ignoring nulls', () => {
    const steps = [
      makeStep({ frequency: 10 }),
      makeStep({ frequency: null }),
      makeStep({ frequency: 20 }),
    ]
    const result = computeClusterAggregates(steps, {})
    expect(result.mergedFrequency).toBe(15)
  })

  it('returns null when all values are null', () => {
    const steps = [makeStep({ frequency: null }), makeStep({ frequency: null })]
    const result = computeClusterAggregates(steps, {})
    expect(result.mergedFrequency).toBeNull()
  })

  it('treats an exact half rule_based split as rule-based (tie-break)', () => {
    const steps = [makeStep({ rule_based: true }), makeStep({ rule_based: false })]
    const result = computeClusterAggregates(steps, {})
    expect(result.isRuleBased).toBe(true)
  })

  it('falls back to 1 for flowStepCount when interview is missing from the count map', () => {
    const steps = [makeStep({ interview_id: 'iv-unknown' })]
    const result = computeClusterAggregates(steps, {})
    expect(result.flowStepCount).toBe(1)
  })

  it('dedupes data sources and participant names', () => {
    const steps = [
      makeStep({ data_sources: ['SAP'], interviews: { department: 'Buchhaltung', employee_name: 'Anna', employee_role: null, status: 'completed' } }),
      makeStep({ data_sources: ['SAP', 'Excel'], interviews: { department: 'Buchhaltung', employee_name: 'Anna', employee_role: null, status: 'completed' } }),
    ]
    const result = computeClusterAggregates(steps, {})
    expect(result.mergedDataSources).toEqual(['SAP', 'Excel'])
    expect(result.participantNames).toEqual(['Anna'])
  })
})

describe('computeSummaryStats', () => {
  it('returns zeroed stats for an empty array (no NaN)', () => {
    const result = computeSummaryStats([])
    expect(result).toEqual({ totalSteps: 0, totalDepts: 0, uniqueInterviews: 0, ruleBasedCount: 0, ruleBasedPct: 0 })
  })

  it('computes totals across departments and interviews', () => {
    const steps = [
      makeStep({ id: 's1', interview_id: 'iv-1', rule_based: true }),
      makeStep({ id: 's2', interview_id: 'iv-2', interviews: { department: 'Vertrieb', employee_name: 'Ben', employee_role: null, status: 'completed' } }),
    ]
    const result = computeSummaryStats(steps)
    expect(result).toEqual({ totalSteps: 2, totalDepts: 2, uniqueInterviews: 2, ruleBasedCount: 1, ruleBasedPct: 50 })
  })
})
