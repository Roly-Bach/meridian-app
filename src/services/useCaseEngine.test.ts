import { describe, it, expect } from 'vitest'
import {
  runHeuristicEngine,
  hasSearchKeywords,
  SCORE_HIGH_THRESHOLD,
  SCORE_MEDIUM_THRESHOLD,
  type EngineProcessStep,
} from './useCaseEngine'

const BASE_STEP: EngineProcessStep = {
  id: 'step-1',
  workspace_id: 'ws-1',
  interview_id: 'interview-1',
  title: 'Rechnungen prüfen',
  description: 'Prüft eingehende Rechnungen',
  frequency_per_month: null,
  duration_minutes: null,
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

  it('skips steps without frequency_per_month', () => {
    const step = { ...BASE_STEP, duration_minutes: 60, rule_based: true }
    expect(runHeuristicEngine([step], HOURLY_RATE)).toEqual([])
  })

  it('skips steps without duration_minutes', () => {
    const step = { ...BASE_STEP, frequency_per_month: 22, rule_based: true }
    expect(runHeuristicEngine([step], HOURLY_RATE)).toEqual([])
  })

  // R1 — Vollautomatisierung
  it('R1: generates automation use case for high-freq rule-based step', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency_per_month: 22,
      duration_minutes: 60,
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
      frequency_per_month: 22,
      duration_minutes: 60,
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
      frequency_per_month: 10,
      duration_minutes: 30,
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
      frequency_per_month: 10,
      duration_minutes: 10,
      data_sources: ['PDF'],
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'llm_extraction')).toBeUndefined()
  })

  // R3 — Entscheidungsunterstützung
  it('R3: generates decision_support for error-prone judgment process', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency_per_month: 8,
      duration_minutes: 45,
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
      frequency_per_month: 5,
      duration_minutes: 30,
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
      frequency_per_month: 22,
      duration_minutes: 60,
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
      frequency_per_month: 10,
      duration_minutes: 20,
      title: 'Informationen nachschlagen',
    }
    const result = runHeuristicEngine([step], HOURLY_RATE)
    expect(result.find((u) => u.type === 'rag')).toBeDefined()
  })

  // R6 — Fehlerhafte Regelautomatisierung
  it('R6: generates automation for rule-based process with high errors', () => {
    const step: EngineProcessStep = {
      ...BASE_STEP,
      frequency_per_month: 10,
      duration_minutes: 30,
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
      frequency_per_month: 15,
      duration_minutes: 25,
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
      frequency_per_month: 8,
      duration_minutes: 60,
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
      frequency_per_month: 8,
      duration_minutes: 60,
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
      { ...BASE_STEP, id: 'a', frequency_per_month: 5, duration_minutes: 20, data_sources: ['PDF'] },
      { ...BASE_STEP, id: 'b', frequency_per_month: 22, duration_minutes: 60, rule_based: true, error_rate_percent: 5 },
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
      frequency_per_month: 22,
      duration_minutes: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const high = runHeuristicEngine([highStep], HOURLY_RATE).find((u) => u.type === 'automation')
    expect(high!.priority).toBe('high')
    expect(high!.quarter).toBe('Q1')
    expect(high!.score).toBeLessThanOrEqual(999.99) // capped for DB numeric(5,2)

    // Low score → low priority
    const lowStep: EngineProcessStep = {
      ...BASE_STEP,
      frequency_per_month: 1,
      duration_minutes: 15,
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
      frequency_per_month: 22,
      duration_minutes: 60,
      rule_based: true,
      error_rate_percent: 5,
    }
    const at45 = runHeuristicEngine([step], 45)[0].roi_eur_per_year!
    const at90 = runHeuristicEngine([step], 90)[0].roi_eur_per_year!
    expect(at90).toBeCloseTo(at45 * 2, 0)
  })
})
