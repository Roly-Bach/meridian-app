import { createOpenAI } from '@ai-sdk/openai'
import { embed } from 'ai'

const jinaClient = createOpenAI({
  apiKey: process.env.JINA_API_KEY,
  baseURL: 'https://api.jina.ai/v1',
})

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'jina-embeddings-v3'

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.JINA_API_KEY) {
    console.error('[embeddings] JINA_API_KEY not set')
    return null
  }

  try {
    const { embedding } = await embed({
      model: jinaClient.embedding(EMBEDDING_MODEL),
      value: text,
    })
    return embedding
  } catch (err) {
    console.error('[embeddings] Jina embedding failed:', err)
    return null
  }
}
