import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite'

// PROJ-9: Nebius (primary, EU data residency) and Fireworks (manual fallback) both expose an
// OpenAI Chat-Completions-compatible endpoint. Must use .chat(modelId) — calling the provider
// function directly (provider(modelId)) targets OpenAI's own Responses API, which third-party
// compatible endpoints don't implement.
const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1'
const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1'

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

  if (provider === 'nebius') {
    return createOpenAI({ apiKey: process.env.NEBIUS_API_KEY, baseURL: NEBIUS_BASE_URL }).chat(modelId)
  }

  if (provider === 'fireworks') {
    return createOpenAI({ apiKey: process.env.FIREWORKS_API_KEY, baseURL: FIREWORKS_BASE_URL }).chat(modelId)
  }

  throw new Error(
    `Unsupported model provider: "${provider}". Use "anthropic/<model-id>", "google/<model-id>", "nebius/<model-id>", or "fireworks/<model-id>".`
  )
}
