/**
 * Embedding-based step identity for register_step deduplication (ADR-016, Pt4).
 *
 * Replaces the Token-Jaccard heuristic with Jina v3 cosine similarity.
 * Thresholds are intentionally conservative to prefer false-negatives (missed
 * duplicate) over false-positives (blocking a genuinely new step).
 *
 * Graceful degradation: if JINA_API_KEY is unset, all functions return null and
 * the caller falls back to Token-Jaccard.
 *
 * Embedding storage: cached in StepEntry.embedding (JSONB — no schema migration).
 * On each register_step call, missing embeddings are generated lazily for existing
 * steps so the cache converges over the first few turns of a new interview session.
 */

import { cosineSim } from './processClustering'
import { generateEmbedding } from './embeddings'
import type { StepEntry } from './interviewSemantic'

export const HARD_THRESHOLD = 0.84
export const SOFT_THRESHOLD = 0.75

export type SimilarityZone = 'hard' | 'soft' | 'none'

export interface StepMatch {
  step: StepEntry
  score: number
  zone: SimilarityZone
}

/**
 * Classify similarity between a title embedding and all existing steps.
 * Returns the best match above SOFT_THRESHOLD, or null if no significant match.
 *
 * Existing steps without a cached embedding are skipped (caller should generate
 * them lazily — see generateMissingEmbeddings).
 */
export function classifyStepSimilarity(
  titleEmbedding: number[],
  tracker: StepEntry[]
): StepMatch | null {
  let best: StepMatch | null = null

  for (const step of tracker) {
    if (!step.embedding || step.embedding.length === 0) continue
    const score = cosineSim(titleEmbedding, step.embedding)
    if (score < SOFT_THRESHOLD) continue

    const zone: SimilarityZone = score >= HARD_THRESHOLD ? 'hard' : 'soft'
    if (!best || score > best.score) {
      best = { step, score, zone }
    }
  }

  return best
}

/**
 * Lazily generate and return embeddings for any tracker entries that are missing one.
 * Returns a new tracker array with embeddings filled in. Entries that fail (null embedding)
 * are returned unchanged so we never block register_step on an API failure.
 */
export async function generateMissingEmbeddings(tracker: StepEntry[]): Promise<StepEntry[]> {
  const results = await Promise.all(
    tracker.map(async (step) => {
      if (step.embedding && step.embedding.length > 0) return step
      const emb = await generateEmbedding(step.title)
      if (!emb) return step
      return { ...step, embedding: emb }
    })
  )
  return results
}
