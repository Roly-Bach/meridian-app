import { createOpenAI } from '@ai-sdk/openai'
import { embed } from 'ai'
import { buildTraceMetadata, type TraceCtx } from './_telemetry'

export async function generateEmbedding(text: string, traceCtx?: TraceCtx): Promise<number[] | null> {
  if (!process.env.JINA_API_KEY) {
    console.error('[embeddings] JINA_API_KEY not set')
    return null
  }

  const embeddingModel = process.env.EMBEDDING_MODEL ?? 'jina-embeddings-v3'
  const jinaClient = createOpenAI({
    apiKey: process.env.JINA_API_KEY,
    baseURL: 'https://api.jina.ai/v1',
  })

  try {
    const { embedding } = await embed({
      model: jinaClient.embedding(embeddingModel),
      value: text,
      providerOptions: {
        openai: { dimensions: 1024 },
      },
      experimental_telemetry: buildTraceMetadata('embeddings.generateEmbedding', {
        model: embeddingModel,
        environment: 'prod',
        ...traceCtx,
      }),
    })
    return embedding
  } catch (err) {
    console.error('[embeddings] Jina embedding failed:', err)
    return null
  }
}
