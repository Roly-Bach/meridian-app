import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyStepSimilarity, generateMissingEmbeddings, HARD_THRESHOLD, SOFT_THRESHOLD } from './stepIdentity'
import type { StepEntry } from './interviewSemantic'

// We need to mock cosineSim to control scores without real embeddings
vi.mock('./processClustering', () => ({
  cosineSim: vi.fn(),
}))

// Mock generateEmbedding for generateMissingEmbeddings tests
vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn(),
}))

import { cosineSim } from './processClustering'
import { generateEmbedding } from './embeddings'
const mockCosineSim = vi.mocked(cosineSim)
const mockGenerateEmbedding = vi.mocked(generateEmbedding)

function makeStep(title: string, embedding?: number[]): StepEntry {
  return {
    title,
    status: 'exploring',
    slots: {
      frequency_per_month: null,
      duration_minutes: null,
      rule_based: null,
      data_sources: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    ...(embedding ? { embedding } : {}),
  }
}

const DUMMY_QUERY = [1, 0]
const DUMMY_EMB = [1, 0]

describe('classifyStepSimilarity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for empty tracker', () => {
    const result = classifyStepSimilarity(DUMMY_QUERY, [])
    expect(result).toBeNull()
  })

  it('skips steps without embeddings', () => {
    const tracker = [makeStep('Rechnungsprüfung')]  // no embedding
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result).toBeNull()
    expect(mockCosineSim).not.toHaveBeenCalled()
  })

  it('skips steps with empty embedding array', () => {
    const tracker = [makeStep('Rechnungsprüfung', [])]
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result).toBeNull()
  })

  it('returns null when best score is below SOFT_THRESHOLD', () => {
    const tracker = [makeStep('Mahnprozess', DUMMY_EMB)]
    mockCosineSim.mockReturnValue(SOFT_THRESHOLD - 0.01)
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result).toBeNull()
  })

  it('returns soft zone when score is between SOFT and HARD threshold', () => {
    const tracker = [makeStep('Mahnprozess', DUMMY_EMB)]
    const score = (SOFT_THRESHOLD + HARD_THRESHOLD) / 2  // midpoint
    mockCosineSim.mockReturnValue(score)
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('soft')
    expect(result!.score).toBeCloseTo(score)
    expect(result!.step.title).toBe('Mahnprozess')
  })

  it('returns hard zone when score is at or above HARD_THRESHOLD', () => {
    const tracker = [makeStep('Rechnungsprüfung', DUMMY_EMB)]
    mockCosineSim.mockReturnValue(HARD_THRESHOLD)
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('hard')
  })

  it('returns hard zone when score is above HARD_THRESHOLD', () => {
    const tracker = [makeStep('Rechnungsprüfung', DUMMY_EMB)]
    mockCosineSim.mockReturnValue(0.97)
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result!.zone).toBe('hard')
  })

  it('returns best match across multiple steps', () => {
    const tracker = [
      makeStep('Mahnprozess', [1, 0]),
      makeStep('Rechnungsprüfung', [0, 1]),
      makeStep('Monatsabschluss', [0.5, 0.5]),
    ]
    mockCosineSim
      .mockReturnValueOnce(0.78)   // Mahnprozess — soft
      .mockReturnValueOnce(0.92)   // Rechnungsprüfung — hard (best)
      .mockReturnValueOnce(0.80)   // Monatsabschluss — soft

    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result!.step.title).toBe('Rechnungsprüfung')
    expect(result!.zone).toBe('hard')
    expect(result!.score).toBeCloseTo(0.92)
  })

  it('skips steps without embedding even when others have one', () => {
    const tracker = [
      makeStep('Mahnprozess'),          // no embedding — skipped
      makeStep('Rechnungsprüfung', DUMMY_EMB),
    ]
    mockCosineSim.mockReturnValue(0.90)
    const result = classifyStepSimilarity(DUMMY_QUERY, tracker)
    expect(result!.step.title).toBe('Rechnungsprüfung')
    expect(mockCosineSim).toHaveBeenCalledTimes(1)
  })

  it('skips steps with non-numeric embedding values (L2 JSONB corruption guard)', () => {
    // Simulate corrupted JSONB: embedding field contains strings instead of numbers
    const corruptedStep = makeStep('Korrupter Schritt', ['not', 'a', 'number'] as unknown as number[])
    const validStep = makeStep('Gültiger Schritt', DUMMY_EMB)
    mockCosineSim.mockReturnValue(0.90)
    const result = classifyStepSimilarity(DUMMY_QUERY, [corruptedStep, validStep])
    expect(result!.step.title).toBe('Gültiger Schritt')
    expect(mockCosineSim).toHaveBeenCalledTimes(1)  // only called for valid step
  })
})

describe('generateMissingEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unchanged tracker when all steps already have embeddings', async () => {
    const tracker = [makeStep('Rechnungsprüfung', DUMMY_EMB)]
    const result = await generateMissingEmbeddings(tracker)
    expect(result).toEqual(tracker)
    expect(mockGenerateEmbedding).not.toHaveBeenCalled()
  })

  it('generates embedding for steps missing one', async () => {
    const generated = [0.9, 0.1]
    mockGenerateEmbedding.mockResolvedValue(generated)
    const tracker = [makeStep('Rechnungsprüfung')]  // no embedding
    const result = await generateMissingEmbeddings(tracker)
    expect(result[0].embedding).toEqual(generated)
    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Rechnungsprüfung')
  })

  it('leaves step unchanged when generateEmbedding returns null (API failure)', async () => {
    mockGenerateEmbedding.mockResolvedValue(null)
    const step = makeStep('Rechnungsprüfung')
    const result = await generateMissingEmbeddings([step])
    expect(result[0].embedding).toBeUndefined()
  })

  it('processes multiple steps in parallel, skipping already-embedded ones', async () => {
    const generated = [0.5, 0.5]
    mockGenerateEmbedding.mockResolvedValue(generated)
    const tracker = [
      makeStep('Step mit Embedding', DUMMY_EMB),
      makeStep('Step ohne Embedding'),
    ]
    const result = await generateMissingEmbeddings(tracker)
    expect(result[0].embedding).toEqual(DUMMY_EMB)   // unchanged
    expect(result[1].embedding).toEqual(generated)    // filled
    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1)
  })
})

describe('threshold constants', () => {
  it('HARD_THRESHOLD is above SOFT_THRESHOLD', () => {
    expect(HARD_THRESHOLD).toBeGreaterThan(SOFT_THRESHOLD)
  })

  it('SOFT_THRESHOLD is in sensible range (0.6..0.9)', () => {
    expect(SOFT_THRESHOLD).toBeGreaterThan(0.6)
    expect(SOFT_THRESHOLD).toBeLessThan(0.9)
  })

  it('HARD_THRESHOLD is in sensible range (0.7..0.99)', () => {
    expect(HARD_THRESHOLD).toBeGreaterThan(0.7)
    expect(HARD_THRESHOLD).toBeLessThan(0.99)
  })
})
