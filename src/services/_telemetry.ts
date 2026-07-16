// Shared telemetry context passed to every LLM-call site.
// Services spread their own fields (interviewId, model) then merge traceCtx on top.

export type OnTokenUsage = (r: {
  component: string
  model: string
  inputTokens: number
  cacheReadTokens?: number
  outputTokens: number
}) => void

export interface TraceCtx {
  interviewId?: string
  evalRunId?: string
  persona?: string
  model?: string
  environment?: 'prod' | 'eval'
  component?: 'talker' | 'analyst' | 'analyst_online' | 'analyst_catchup' | 'orchestrator' | 'quick_extract' | 'judge_dialog_naturalness' | 'judge_talker_grounding' | 'judge_slot_depth' | 'grounding_guard' | 'role_guard' | 'tester'
}

/**
 * Builds the experimental_telemetry object for AI SDK calls.
 * fnName becomes the observation name in Langfuse (e.g. "interviewAgent.turn").
 * When LANGFUSE_ENABLED !== "true", returns { isEnabled: false } — no OTEL spans emitted.
 */
export function buildTraceMetadata(fnName: string, ctx: TraceCtx) {
  if (process.env.LANGFUSE_ENABLED !== 'true') {
    return { isEnabled: false as const }
  }

  const sessionId = ctx.interviewId ?? ctx.evalRunId
  const tags = [
    ctx.persona ? `persona:${ctx.persona}` : null,
    ctx.model ? `model:${ctx.model}` : null,
    `environment:${ctx.environment ?? 'prod'}`,
    ctx.evalRunId ? `eval_run_id:${ctx.evalRunId}` : null,
    ctx.component ? `component:${ctx.component}` : null,
  ].filter((t): t is string => t !== null)

  return {
    isEnabled: true as const,
    functionId: fnName,
    metadata: {
      ...(sessionId ? { 'session.id': sessionId } : {}),
      ...(tags.length > 0 ? { 'langfuse.trace.tags': JSON.stringify(tags) } : {}),
    } as Record<string, string>,
  }
}
