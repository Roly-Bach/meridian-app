import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { estimateTokenCost, computeCostSummary, MODEL_PRICING } from './costSummary'
import type { TokenUsageRecord } from './types'

describe('estimateTokenCost', () => {
  it('computes cost correctly for a known model (with cache split)', () => {
    const knownModel = 'google/gemini-3.1-flash-lite'
    const p = MODEL_PRICING[knownModel]
    const usage = { inputTokens: 1000, cacheReadTokens: 400, outputTokens: 200 }

    const cost = estimateTokenCost(usage, knownModel)

    const expected =
      (usage.inputTokens - usage.cacheReadTokens) * p.inputPer1M / 1_000_000 +
      usage.cacheReadTokens * p.cachePer1M / 1_000_000 +
      usage.outputTokens * p.outputPer1M / 1_000_000

    expect(cost).toBeCloseTo(expected, 10)
  })

  it('computes cost correctly for a known model with no cache reads', () => {
    const knownModel = 'anthropic/claude-sonnet-4-5'
    const p = MODEL_PRICING[knownModel]
    const usage = { inputTokens: 500, outputTokens: 100 }

    const cost = estimateTokenCost(usage, knownModel)

    const expected =
      usage.inputTokens * p.inputPer1M / 1_000_000 +
      usage.outputTokens * p.outputPer1M / 1_000_000

    expect(cost).toBeCloseTo(expected, 10)
  })

  describe('MODEL_PRICING miss', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns 0 and warns once for an unknown model, no silent Gemini-Lite fallback', () => {
      const unknownModel = `unknown/totally-made-up-model-${Date.now()}`
      const usage = { inputTokens: 1000, outputTokens: 500 }

      const cost = estimateTokenCost(usage, unknownModel)

      expect(cost).toBe(0)
      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(unknownModel))
    })

    it('warns only once across multiple calls for the same unknown model', () => {
      const unknownModel = `unknown/repeat-model-${Date.now()}`
      const usage = { inputTokens: 100, outputTokens: 50 }

      estimateTokenCost(usage, unknownModel)
      estimateTokenCost(usage, unknownModel)
      estimateTokenCost(usage, unknownModel)

      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('does NOT fall back to gemini-3.1-flash-lite pricing for an unknown model', () => {
      const unknownModel = `unknown/no-fallback-model-${Date.now()}`
      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 }

      const cost = estimateTokenCost(usage, unknownModel)
      const geminiLiteCost = estimateTokenCost(usage, 'google/gemini-3.1-flash-lite')

      expect(cost).toBe(0)
      expect(geminiLiteCost).toBeGreaterThan(0)
      expect(cost).not.toBe(geminiLiteCost)
    })
  })
})

describe('computeCostSummary', () => {
  it('assigns tester to testEngine bucket', () => {
    const records: TokenUsageRecord[] = [
      { component: 'tester', model: 'google/gemini-3.1-flash-lite', inputTokens: 100, outputTokens: 50 },
    ]
    const summary = computeCostSummary(records)

    expect(Object.keys(summary.testEngine)).toEqual(['tester'])
    expect(summary.testEngine.tester.calls).toBe(1)
    expect(Object.keys(summary.interviewEngine)).toEqual([])
    expect(Object.keys(summary.evalEngine)).toEqual([])
  })

  it('assigns grounding_guard to interviewEngine bucket', () => {
    const records: TokenUsageRecord[] = [
      { component: 'grounding_guard', model: 'google/gemini-3.1-flash-lite', inputTokens: 200, outputTokens: 80 },
    ]
    const summary = computeCostSummary(records)

    expect(Object.keys(summary.interviewEngine)).toEqual(['grounding_guard'])
    expect(Object.keys(summary.testEngine)).toEqual([])
    expect(Object.keys(summary.evalEngine)).toEqual([])
  })

  it('assigns judge_* components to evalEngine bucket', () => {
    const records: TokenUsageRecord[] = [
      { component: 'judge_dialog_naturalness', model: 'anthropic/claude-haiku-4-5', inputTokens: 300, outputTokens: 40 },
      { component: 'judge_slot_depth', model: 'anthropic/claude-haiku-4-5', inputTokens: 150, outputTokens: 20 },
    ]
    const summary = computeCostSummary(records)

    expect(Object.keys(summary.evalEngine).sort()).toEqual(['judge_dialog_naturalness', 'judge_slot_depth'])
    expect(Object.keys(summary.interviewEngine)).toEqual([])
    expect(Object.keys(summary.testEngine)).toEqual([])
  })

  it('assigns all three buckets correctly in one mixed run and sums totals', () => {
    const records: TokenUsageRecord[] = [
      { component: 'analyst', model: 'google/gemini-3.5-flash', inputTokens: 1000, cacheReadTokens: 200, outputTokens: 150 },
      { component: 'talker', model: 'google/gemini-3.1-flash-lite', inputTokens: 500, outputTokens: 100 },
      { component: 'tester', model: 'google/gemini-3.1-flash-lite', inputTokens: 400, outputTokens: 120 },
      { component: 'judge_talker_grounding', model: 'anthropic/claude-haiku-4-5', inputTokens: 600, outputTokens: 90 },
    ]
    const summary = computeCostSummary(records)

    expect(Object.keys(summary.interviewEngine).sort()).toEqual(['analyst', 'talker'])
    expect(Object.keys(summary.testEngine)).toEqual(['tester'])
    expect(Object.keys(summary.evalEngine)).toEqual(['judge_talker_grounding'])

    const expectedTotalInput = 1000 + 500 + 400 + 600
    const expectedTotalCache = 200
    const expectedTotalOutput = 150 + 100 + 120 + 90

    expect(summary.totalInputTokens).toBe(expectedTotalInput)
    expect(summary.totalCacheReadTokens).toBe(expectedTotalCache)
    expect(summary.totalOutputTokens).toBe(expectedTotalOutput)

    // computeCostSummary rounds each component's cost to 4 decimals before summing
    // the total, so the expectation must apply the same per-component rounding —
    // comparing against the raw unrounded sum can differ by more than float epsilon.
    const round4 = (n: number) => Math.round(n * 10000) / 10000
    const expectedTotalCost =
      round4(estimateTokenCost({ inputTokens: 1000, cacheReadTokens: 200, outputTokens: 150 }, 'google/gemini-3.5-flash')) +
      round4(estimateTokenCost({ inputTokens: 500, outputTokens: 100 }, 'google/gemini-3.1-flash-lite')) +
      round4(estimateTokenCost({ inputTokens: 400, outputTokens: 120 }, 'google/gemini-3.1-flash-lite')) +
      round4(estimateTokenCost({ inputTokens: 600, outputTokens: 90 }, 'anthropic/claude-haiku-4-5'))

    expect(summary.totalEstimatedCostUsd).toBeCloseTo(expectedTotalCost, 4)
  })

  it('sums tokens and cost correctly per component bucket across multiple calls', () => {
    const records: TokenUsageRecord[] = [
      { component: 'tester', model: 'google/gemini-3.1-flash-lite', inputTokens: 100, outputTokens: 50 },
      { component: 'tester', model: 'google/gemini-3.1-flash-lite', inputTokens: 200, outputTokens: 60 },
    ]
    const summary = computeCostSummary(records)

    expect(summary.testEngine.tester.calls).toBe(2)
    expect(summary.testEngine.tester.inputTokens).toBe(300)
    expect(summary.testEngine.tester.outputTokens).toBe(110)
  })

  it('returns 0 cost contribution for unknown-model records but still counts tokens/calls', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unknownModel = `unknown/missing-pricing-${Date.now()}`
    const records: TokenUsageRecord[] = [
      { component: 'tester', model: unknownModel, inputTokens: 1000, outputTokens: 500 },
    ]
    const summary = computeCostSummary(records)

    expect(summary.testEngine.tester.calls).toBe(1)
    expect(summary.testEngine.tester.inputTokens).toBe(1000)
    expect(summary.testEngine.tester.estimatedCostUsd).toBe(0)
    expect(summary.totalEstimatedCostUsd).toBe(0)
    vi.restoreAllMocks()
  })

  it('handles an empty record list', () => {
    const summary = computeCostSummary([])

    expect(summary.interviewEngine).toEqual({})
    expect(summary.testEngine).toEqual({})
    expect(summary.evalEngine).toEqual({})
    expect(summary.totalInputTokens).toBe(0)
    expect(summary.totalEstimatedCostUsd).toBe(0)
  })
})
