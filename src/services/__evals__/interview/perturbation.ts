/**
 * Persona-Perturbation for multi-run eval stability (BL-E5.3).
 *
 * Two-step perturbation:
 *   1. Deterministic field-order shuffle via seeded PRNG (no LLM)
 *   2. LLM paraphrase of German text fields (Gemini Flash-Lite, fallback to original)
 */

import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm-provider'
import type { PersonaProcessKnowledge } from './personas/types'

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Fisher-Yates shuffle with seeded PRNG ───────────────────────────────────

export function shuffleArray<T>(arr: T[], random: () => number): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

// ─── LLM Paraphrase ───────────────────────────────────────────────────────────

const PARAPHRASE_MODEL = 'google/gemini-3.1-flash-lite'

async function paraphraseTexts(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return []
  try {
    const model = resolveModel(PARAPHRASE_MODEL)
    const { text } = await generateText({
      model,
      system:
        'Paraphrasiere die folgenden deutschen Texte. Ändere NICHT den faktischen Inhalt, nur die Formulierung. Antworte ausschließlich mit dem JSON-Array der paraphrasierten Strings, ohne Erklärungen.',
      prompt: JSON.stringify(texts),
      temperature: 0.7,
      maxOutputTokens: 2048,
    })
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (
      Array.isArray(parsed) &&
      parsed.length === texts.length &&
      parsed.every((s) => typeof s === 'string')
    ) {
      return parsed as string[]
    }
    console.warn('[perturbation] paraphrase result length mismatch, using original')
    return texts
  } catch (err) {
    console.warn('[perturbation] failed, using original:', err)
    return texts
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Perturbs a PersonaProcessKnowledge object deterministically for a given seed.
 *
 * Step 1 — field-order shuffle (no LLM, deterministic):
 *   processes[] and tools[] are shuffled with mulberry32(seed).
 *
 * Step 2 — LLM paraphrase (Gemini Flash-Lite, fallback to original):
 *   process.description, process.pain_points, additionalContext
 */
export async function perturbPersona(
  processKnowledge: PersonaProcessKnowledge,
  seed: number,
): Promise<PersonaProcessKnowledge> {
  const random = mulberry32(seed)

  // Step 1: Deterministic shuffle
  const shuffledProcesses = shuffleArray(processKnowledge.processes, random)
  const shuffledTools = shuffleArray(processKnowledge.tools, random)

  // Step 2: Collect texts for paraphrase
  const descriptionTexts = shuffledProcesses.map((p) => p.description)
  const painPointTexts = shuffledProcesses.flatMap((p) => p.pain_points)
  const additionalContextTexts = processKnowledge.additionalContext
    ? [processKnowledge.additionalContext]
    : []

  const allTexts = [...descriptionTexts, ...painPointTexts, ...additionalContextTexts]
  const paraphrased = await paraphraseTexts(allTexts)

  // Re-assemble paraphrased texts back into processes
  let offset = 0
  const paraphrasedProcesses = shuffledProcesses.map((p) => {
    const newDescription = paraphrased[offset] ?? p.description
    offset++
    const newPainPoints = p.pain_points.map((_, i) => paraphrased[offset + i] ?? p.pain_points[i])
    offset += p.pain_points.length
    return { ...p, description: newDescription, pain_points: newPainPoints }
  })

  const newAdditionalContext =
    processKnowledge.additionalContext
      ? (paraphrased[offset] ?? processKnowledge.additionalContext)
      : processKnowledge.additionalContext

  return {
    processes: paraphrasedProcesses,
    tools: shuffledTools,
    additionalContext: newAdditionalContext,
  }
}
