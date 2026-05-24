import type { StepEntry } from '../../interviewAgent'

export interface EvalMetrics {
  stepsIdentified: number
  mandatorySlotCoverageByStep: Record<string, number>
  optionalSlotCoverageByStep: Record<string, number>
  avgMandatoryCoverage: number
  avgOptionalCoverage: number
  bottlenecksLocated: number
  useCasesGenerated: number
  passesOutputContract: boolean
}

const MANDATORY_SLOTS = ['frequency_per_month', 'duration_minutes', 'rule_based'] as const
const OPTIONAL_SLOTS = ['data_sources', 'error_rate_percent', 'media_breaks'] as const

export function computeMetrics(
  stepTracker: StepEntry[],
  bottleneckCount: number,
  useCaseCount: number,
): EvalMetrics {
  const mandatoryByStep: Record<string, number> = {}
  const optionalByStep: Record<string, number> = {}

  for (const step of stepTracker) {
    const mandatoryFilled = MANDATORY_SLOTS.filter((s) => step.slots[s] !== null).length
    const optionalFilled = OPTIONAL_SLOTS.filter((s) => step.slots[s] !== null).length
    mandatoryByStep[step.title] = mandatoryFilled / MANDATORY_SLOTS.length
    optionalByStep[step.title] = optionalFilled / OPTIONAL_SLOTS.length
  }

  const avgMandatory =
    stepTracker.length === 0
      ? 0
      : Object.values(mandatoryByStep).reduce((a, b) => a + b, 0) / stepTracker.length

  const avgOptional =
    stepTracker.length === 0
      ? 0
      : Object.values(optionalByStep).reduce((a, b) => a + b, 0) / stepTracker.length

  const passes =
    stepTracker.length >= 3 &&
    avgMandatory >= 0.8 &&
    avgOptional >= 0.5 &&
    bottleneckCount >= 1

  return {
    stepsIdentified: stepTracker.length,
    mandatorySlotCoverageByStep: mandatoryByStep,
    optionalSlotCoverageByStep: optionalByStep,
    avgMandatoryCoverage: avgMandatory,
    avgOptionalCoverage: avgOptional,
    bottlenecksLocated: bottleneckCount,
    useCasesGenerated: useCaseCount,
    passesOutputContract: passes,
  }
}
