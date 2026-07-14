import type { TraceCtx } from './_telemetry'

// cosineSim moved here from processClustering.ts (#21, 2026-07-14) — pure
// vector-math helper with no fachlicher Bezug to Prozessbasis' cluster
// aggregation; lives here next to the embedding API it operates on.
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// Jina's OpenAI-compatible API omits `prompt_tokens` from usage,
// which causes @ai-sdk/openai strict schema validation to throw.
// Direct fetch avoids the incompatibility.
export async function generateEmbedding(text: string, _traceCtx?: TraceCtx): Promise<number[] | null> {
  if (!process.env.JINA_API_KEY) {
    console.error('[embeddings] JINA_API_KEY not set')
    return null
  }

  const model = process.env.EMBEDDING_MODEL ?? 'jina-embeddings-v3'

  try {
    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: [text], dimensions: 1024 }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[embeddings] Jina API error:', res.status, body)
      return null
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch (err) {
    console.error('[embeddings] Jina embedding failed:', err)
    return null
  }
}
