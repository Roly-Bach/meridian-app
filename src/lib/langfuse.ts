import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'

let sdk: NodeSDK | null = null

export function initLangfuse(): void {
  if (sdk) return

  // Kill-switch: must be explicitly enabled. Default-off prevents Hot-Reload-Spam
  // consuming Free Tier in local dev.
  if (process.env.LANGFUSE_ENABLED !== 'true') return

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.warn('[langfuse] LANGFUSE_ENABLED=true but keys missing — tracing disabled')
    return
  }

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
      }),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(() => {})
  })
}

export function flushLangfuse(): Promise<void> {
  return sdk?.shutdown() ?? Promise.resolve()
}
