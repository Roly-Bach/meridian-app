export interface SubStep {
  id: string
  title: string
  step_type: 'action' | 'decision'
  condition_text?: string | null
  branch_yes?: string | null
  branch_no?: string | null
  source_text?: string | null
  order: number
}

export interface ProcessCluster {
  id: string
  canonical_title: string
  canonical_description: string | null
  participant_count: number
  participants: unknown
}

export interface ProcessStep {
  id: string
  interview_id: string
  workspace_id: string
  cluster_id: string | null
  title: string
  description: string | null
  role: string | null
  frequency_per_month: number | null
  duration_minutes: number | null
  data_sources: string[]
  rule_based: boolean
  error_rate_percent: number | null
  media_breaks: number
  source_quote: string | null
  step_type: 'action' | 'decision'
  condition_text: string | null
  substeps: unknown
  created_at: string
  interviews: {
    department: string
    employee_name: string
    employee_role: string | null
    status: string
  } | null
  process_clusters: ProcessCluster | null
}

export interface ClusterAggregates {
  mergedFrequency: number | null
  mergedDuration: number | null
  mergedErrorRate: number | null
  mergedMediaBreaks: number | null
  mergedDataSources: string[]
  isRuleBased: boolean
  flowStepCount: number
  participantNames: string[]
}

export interface SummaryStats {
  totalSteps: number
  totalDepts: number
  uniqueInterviews: number
  ruleBasedCount: number
  ruleBasedPct: number
}

function avg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v !== null)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

export function groupStepsByDeptAndCluster(steps: ProcessStep[]): Record<string, Record<string, ProcessStep[]>> {
  return steps.reduce<Record<string, Record<string, ProcessStep[]>>>((acc, step) => {
    const dept = step.interviews?.department ?? 'Unbekannt'
    const clusterKey = step.cluster_id ?? `solo-${step.id}`
    if (!acc[dept]) acc[dept] = {}
    if (!acc[dept][clusterKey]) acc[dept][clusterKey] = []
    acc[dept][clusterKey].push(step)
    return acc
  }, {})
}

export function computeInterviewStepCounts(steps: ProcessStep[]): Record<string, number> {
  return steps.reduce<Record<string, number>>((acc, s) => {
    acc[s.interview_id] = (acc[s.interview_id] ?? 0) + 1
    return acc
  }, {})
}

export function computeClusterAggregates(
  groupSteps: ProcessStep[],
  interviewStepCounts: Record<string, number>
): ClusterAggregates {
  const participantNames = [...new Set(
    groupSteps.map(s => s.interviews?.employee_name).filter((n): n is string => !!n)
  )]

  const mergedFrequency = avg(groupSteps.map(s => s.frequency_per_month))
  const mergedDuration = avg(groupSteps.map(s => s.duration_minutes))
  const mergedErrorRate = avg(groupSteps.map(s => s.error_rate_percent))
  const mergedMediaBreaks = avg(groupSteps.map(s => s.media_breaks))
  const mergedDataSources = [...new Set(groupSteps.flatMap(s => s.data_sources))]
  const isRuleBased = groupSteps.filter(s => s.rule_based).length >= groupSteps.length / 2
  const flowStepCount = Math.max(
    ...groupSteps.map(s => interviewStepCounts[s.interview_id] ?? 1)
  )

  return {
    mergedFrequency,
    mergedDuration,
    mergedErrorRate,
    mergedMediaBreaks,
    mergedDataSources,
    isRuleBased,
    flowStepCount,
    participantNames,
  }
}

export function computeSummaryStats(steps: ProcessStep[]): SummaryStats {
  const totalSteps = steps.length
  const totalDepts = new Set(steps.map(s => s.interviews?.department ?? 'Unbekannt')).size
  const uniqueInterviews = new Set(steps.map(s => s.interview_id)).size
  const ruleBasedCount = steps.filter(s => s.rule_based).length
  const ruleBasedPct = totalSteps > 0 ? Math.round((ruleBasedCount / totalSteps) * 100) : 0

  return { totalSteps, totalDepts, uniqueInterviews, ruleBasedCount, ruleBasedPct }
}
