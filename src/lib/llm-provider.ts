import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Agent } from 'undici'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite'

// PROJ-9: Nebius (primary, EU data residency) and Fireworks (manual fallback) both expose an
// OpenAI Chat-Completions-compatible endpoint. Must use .chat(modelId) — calling the provider
// function directly (provider(modelId)) targets OpenAI's own Responses API, which third-party
// compatible endpoints don't implement.
const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1'
const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1'
// PROJ-41: OpenRouter is an eval-only aggregator for Stage-1 model screening — one key reaches all
// candidate OSS models regardless of who hosts them. OpenAI-compatible, same .chat() rule as above.
// Never configured in production (opaque routing → data-residency risk, ADR-020 D1); the prod
// interview model runs on a dedicated EU provider chosen in Stage 1.5. Model string form is
// `openrouter/<vendor>/<model>`, so the id after the first slash is OpenRouter's own `<vendor>/<model>`
// slug (e.g. openrouter/z-ai/glm-5.2 → z-ai/glm-5.2).
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

// PROJ-41 Pass A: OpenRouter's HTTP/2 transport intermittently stalls (undici "stream timeout
// after 300000") or resets (ECONNRESET) mid-response for heavy OSS-reasoning-model turns — 4 of 7
// screening candidates crashed this way. Forcing HTTP/1.1 (allowH2:false) avoids the H2
// stream-multiplexing timeout/reset behavior. Eval-only path; lazily built so prod providers
// (anthropic/google/nebius/fireworks) never allocate it. Node's global fetch (undici) honors a
// per-request `dispatcher`, so we only need the Agent, not a full fetch replacement.
let openrouterAgent: Agent | undefined
function openrouterFetch(): typeof fetch {
  openrouterAgent ??= new Agent({ allowH2: false, connect: { timeout: 30_000 } })
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    // A custom undici dispatcher bypasses fetch's automatic response decompression, so a
    // compressed (br/zstd) body reaches the AI SDK as raw bytes → "Invalid JSON response".
    // Force identity encoding so the response is plain JSON; transfer size is irrelevant for eval.
    const headers = new Headers(init?.headers)
    headers.set('accept-encoding', 'identity')
    return fetch(input, { ...init, headers, dispatcher: openrouterAgent } as RequestInit)
  }) as typeof fetch
}

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

  if (provider === 'openrouter') {
    // eval-only (PROJ-41 Stage-1 screening). modelId keeps OpenRouter's own vendor/model slug.
    // Custom fetch forces HTTP/1.1 (see openrouterFetch) to dodge OpenRouter's H2 stalls/resets.
    return createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      fetch: openrouterFetch(),
    }).chat(modelId)
  }

  throw new Error(
    `Unsupported model provider: "${provider}". Use "anthropic/<model-id>", "google/<model-id>", "nebius/<model-id>", "fireworks/<model-id>", or "openrouter/<vendor>/<model-id>" (eval-only).`
  )
}
