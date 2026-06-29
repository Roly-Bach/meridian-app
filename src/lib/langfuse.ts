import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import type { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base'
import type { Context, Span } from '@opentelemetry/api'

// Promotes AI SDK's prefixed metadata attributes to the keys @langfuse/otel reads.
// The AI SDK wraps experimental_telemetry.metadata as ai.telemetry.metadata.<key>,
// but Langfuse's SpanProcessor reads session.id and langfuse.trace.tags directly.
class MetadataAttributeEnricher implements SpanProcessor {
  onStart(span: Span, _parentContext: Context): void {
    const attrs = (span as unknown as ReadableSpan).attributes
    const sessionId = attrs?.['ai.telemetry.metadata.session.id']
    if (typeof sessionId === 'string') span.setAttribute('session.id', sessionId)
    const tags = attrs?.['ai.telemetry.metadata.langfuse.trace.tags']
    if (typeof tags === 'string') span.setAttribute('langfuse.trace.tags', tags)
  }
  onEnd(_span: ReadableSpan): void {}
  forceFlush(): Promise<void> { return Promise.resolve() }
  shutdown(): Promise<void> { return Promise.resolve() }
}

let sdk: NodeSDK | null = null
let langfuseProcessor: LangfuseSpanProcessor | null = null

export function initLangfuse(): void {
  if (sdk) return

  // Kill-switch: must be explicitly enabled. Default-off prevents Hot-Reload-Spam
  // consuming Free Tier in local dev.
  if (process.env.LANGFUSE_ENABLED !== 'true') return

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.warn('[langfuse] LANGFUSE_ENABLED=true but keys missing — tracing disabled')
    return
  }

  langfuseProcessor = new LangfuseSpanProcessor({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  })

  sdk = new NodeSDK({
    spanProcessors: [
      new MetadataAttributeEnricher(),
      langfuseProcessor,
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(() => {})
  })
}

// forceFlush: flush pending spans without shutting down the SDK.
// Use this BETWEEN phases of a run (e.g. before scorers) so new spans are still accepted.
export function forceFlushLangfuse(): Promise<void> {
  return langfuseProcessor?.forceFlush() ?? Promise.resolve()
}

// flushLangfuse: final shutdown flush — call once at the end of the process.
export function flushLangfuse(): Promise<void> {
  return sdk?.shutdown() ?? Promise.resolve()
}
