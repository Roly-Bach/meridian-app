// Next.js instrumentation hook — runs once per server process before first request.
// Safe place for OTEL NodeSDK.start() per spec F1.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initLangfuse } = await import('./lib/langfuse')
    initLangfuse()
  }
}
