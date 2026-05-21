import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite'

export function resolveModel(modelString = DEFAULT_MODEL) {
  const slashIdx = modelString.indexOf('/')

  if (slashIdx === -1) {
    // bare model name without provider prefix → treat as Anthropic (legacy)
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelString as never)
  }

  const provider = modelString.slice(0, slashIdx)
  const modelId = modelString.slice(slashIdx + 1)

  if (provider === 'anthropic') {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId as never)
  }

  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId as never)
  }

  throw new Error(
    `Unsupported model provider: "${provider}". Use "anthropic/<model-id>" or "google/<model-id>".`
  )
}
