/**
 * Slot-Write-Trail Emitter (ADR-015)
 *
 * Observability for the three slot-write paths in the Dual-Loop engine:
 *   - analyst   : record_slot called from interviewAnalyst
 *   - quick      : record_slot called from interviewQuickExtract
 *   - backfill   : deterministic data_sources backfill in interviewAnalyst
 *   - update_walkthrough : per ADR-014, no longer writes slot fields — kept
 *     in the enum for completeness in case a future writer reuses the path
 *
 * Three sinks (all optional, all try/catch — emitter never throws):
 *   1. Langfuse event — when LANGFUSE_ENABLED=true and credentials are set;
 *      uses a process-wide singleton SDK (one instance, never shut down)
 *   2. JSONL file    — when SLOT_TRAIL_FILE env var is set
 *   3. Console       — when DEBUG includes 'slot_trail'
 */

export interface SlotWriteEvent {
  /** ISO timestamp of the write */
  ts: string
  /** Interview this slot belongs to */
  interviewId: string
  /** Current turn at the time of the write (1-indexed) */
  turn?: number
  /** Which write path produced this event */
  source: 'analyst' | 'quick' | 'backfill' | 'update_walkthrough'
  /** Step identifier (slug or UUID) if known — falls back to stepTitle */
  stepId?: string | null
  /** Step title the slot was written to */
  stepTitle: string
  /** Slot key */
  slot: string
  /** Serialised slot value */
  value: unknown
  /** Previous value, if any — null/undefined when slot was empty */
  prevValue?: unknown
  /** True when this write replaced a non-null previous value */
  overwrite: boolean
  /** Source turn number if known */
  sourceTurn?: number | null
  /** Short evidence quote / span if available */
  evidence?: string | null
}

// ── Langfuse singleton ──────────────────────────────────────────────────────
// One Langfuse SDK instance per process, lazily initialised. Avoids the
// pre-hotfix pattern of "new Langfuse()" + "shutdownAsync()" per emit, which
// allocated ~4×turns SDK instances per interview and burnt API quota.

type LangfuseClient = { event: (e: { name: string; metadata?: Record<string, unknown> }) => void }
let langfuseSingleton: LangfuseClient | null | undefined
let langfuseInitPromise: Promise<LangfuseClient | null> | null = null

async function getLangfuse(): Promise<LangfuseClient | null> {
  if (langfuseSingleton !== undefined) return langfuseSingleton
  if (langfuseInitPromise) return langfuseInitPromise
  langfuseInitPromise = (async () => {
    if (process.env.LANGFUSE_ENABLED !== 'true') return null
    if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return null
    try {
      const mod = await import('langfuse')
      const Langfuse = (mod as { Langfuse: new (opts: Record<string, unknown>) => LangfuseClient }).Langfuse
      const instance = new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
      })
      langfuseSingleton = instance
      return instance
    } catch {
      langfuseSingleton = null
      return null
    }
  })()
  langfuseSingleton = await langfuseInitPromise
  return langfuseSingleton
}

/**
 * Emit a slot-write event to all configured sinks.
 * Never throws — all errors are swallowed.
 */
export async function emitSlotWrite(event: SlotWriteEvent): Promise<void> {
  // ── Langfuse sink (singleton SDK) ─────────────────────────────────────────
  try {
    const lf = await getLangfuse()
    if (lf) {
      lf.event({
        name: 'slot_write',
        metadata: {
          ...event,
          'langfuse.tags': JSON.stringify([
            'event:slot_write',
            `source:${event.source}`,
            `slot:${event.slot}`,
            ...(event.overwrite ? ['overwrite:true'] : []),
          ]),
        },
      })
    }
  } catch {
    // Langfuse sink failure is non-fatal
  }

  // ── JSONL sink ────────────────────────────────────────────────────────────
  const trailFile = process.env.SLOT_TRAIL_FILE
  if (trailFile) {
    try {
      const fs = await import('fs')
      const line = JSON.stringify(event) + '\n'
      fs.appendFileSync(trailFile, line, 'utf8')
    } catch {
      // JSONL sink failure is non-fatal
    }
  }

  // ── Console sink ──────────────────────────────────────────────────────────
  if (process.env.DEBUG?.includes('slot_trail')) {
    const overwriteFlag = event.overwrite ? ' [OVERWRITE]' : ''
    console.log(
      `[slot_trail] ${event.source} ${event.stepTitle}/${event.slot}=${JSON.stringify(event.value)}${overwriteFlag} turn=${event.sourceTurn ?? '?'}`,
    )
  }
}
