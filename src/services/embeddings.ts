import { createOpenAI } from '@ai-sdk/openai'
import { embed } from 'ai'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[embeddings] OPENAI_API_KEY not set')
    return null
  }

  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text,
    })
    return embedding
  } catch (err) {
    console.error('[embeddings] OpenAI embedding failed:', err)
    return null
  }
}
