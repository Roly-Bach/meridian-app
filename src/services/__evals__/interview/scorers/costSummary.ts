/**
 * PROJ-40 (Kriterium B): cost tracking moved out of runner.ts so it's unit-testable
 * without spinning up the full eval runner. Three buckets — interview engine (the
 * agent under test: analyst/talker/quick_extract/grounding_guard), test engine (the
 * persona simulator — `tester`), eval engine (judges) — so a cheap interview model's
 * savings aren't hidden inside a fixed test/eval overhead.
 */
import type { TokenUsageRecord, CostSummary, ComponentCostSummary } from './types'

export const INTERVIEW_ENGINE_COMPONENTS = new Set([
  'analyst', 'analyst_online', 'analyst_catchup', 'talker', 'quick_extract', 'grounding_guard',
])

export const TEST_ENGINE_COMPONENTS = new Set(['tester'])

export const MODEL_PRICING: Record<string, { inputPer1M: number; cachePer1M: number; outputPer1M: number }> = {
  'google/gemini-3.1-flash-lite': { inputPer1M: 0.25,  cachePer1M: 0.025, outputPer1M: 1.50 },
  'google/gemini-3.5-flash':      { inputPer1M: 1.50,  cachePer1M: 0.150, outputPer1M: 9.00 },
  'anthropic/claude-haiku-4-5':   { inputPer1M: 1.00,  cachePer1M: 0.10,  outputPer1M: 5.00 },
  'anthropic/claude-sonnet-4-5':  { inputPer1M: 3.00,  cachePer1M: 0.30,  outputPer1M: 15.00 },
}

// PROJ-40 (a): a MODEL_PRICING miss must not silently fall back to Gemini-Lite
// pricing — that would falsify cost comparisons across models (Akzeptanzkriterium B).
// Warn once per unknown model string (not once per call — a run can make hundreds of
// calls against the same unpriced model) and contribute 0 to the cost total. No throw:
// cost computation runs at the end of an otherwise-valid run, a pricing gap shouldn't
// crash the whole eval.
const warnedUnknownModels = new Set<string>()

export function estimateTokenCost(usage: { inputTokens: number; cacheReadTokens?: number; outputTokens: number }, model: string): number {
  const p = MODEL_PRICING[model]
  if (!p) {
    if (!warnedUnknownModels.has(model)) {
      warnedUnknownModels.add(model)
      console.warn(`[costSummary] No MODEL_PRICING entry for "${model}" — cost contribution from this model is reported as 0. Add a pricing entry to MODEL_PRICING for accurate cost comparison.`)
    }
    return 0
  }
  const cached = usage.cacheReadTokens ?? 0
  const nonCached = Math.max(0, usage.inputTokens - cached)
  return (
    nonCached * p.inputPer1M / 1_000_000 +
    cached * p.cachePer1M / 1_000_000 +
    usage.outputTokens * p.outputPer1M / 1_000_000
  )
}

export function computeCostSummary(records: TokenUsageRecord[]): CostSummary {
  const byComp: Record<string, ComponentCostSummary> = {}

  for (const r of records) {
    const key = r.component
    if (!byComp[key]) {
      byComp[key] = { calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
    }
    const c = byComp[key]
    c.calls++
    c.inputTokens += r.inputTokens
    c.cacheReadTokens += r.cacheReadTokens ?? 0
    c.outputTokens += r.outputTokens
    c.estimatedCostUsd += estimateTokenCost(r, r.model)
  }

  // Round costs to 4 decimal places
  for (const c of Object.values(byComp)) {
    c.estimatedCostUsd = Math.round(c.estimatedCostUsd * 10000) / 10000
  }

  const interviewEngine: Record<string, ComponentCostSummary> = {}
  const testEngine: Record<string, ComponentCostSummary> = {}
  const evalEngine: Record<string, ComponentCostSummary> = {}

  for (const [key, val] of Object.entries(byComp)) {
    if (INTERVIEW_ENGINE_COMPONENTS.has(key)) interviewEngine[key] = val
    else if (TEST_ENGINE_COMPONENTS.has(key)) testEngine[key] = val
    else evalEngine[key] = val
  }

  let totalInputTokens = 0, totalCacheReadTokens = 0, totalOutputTokens = 0, totalEstimatedCostUsd = 0
  for (const c of Object.values(byComp)) {
    totalInputTokens += c.inputTokens
    totalCacheReadTokens += c.cacheReadTokens
    totalOutputTokens += c.outputTokens
    totalEstimatedCostUsd += c.estimatedCostUsd
  }

  return {
    interviewEngine,
    testEngine,
    evalEngine,
    totalInputTokens,
    totalCacheReadTokens,
    totalOutputTokens,
    totalEstimatedCostUsd: Math.round(totalEstimatedCostUsd * 10000) / 10000,
  }
}
