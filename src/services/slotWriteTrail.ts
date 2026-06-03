/**
 * Slot-Write-Trail Emitter (ADR-015)
 *
 * Observability for the three slot-write paths in the Dual-Loop engine:
 *   - analyst   : record_slot called from interviewAnalyst
 *   - quick      : record_slot called from interviewQuickExtract
 *   - backfill   : deterministic data_sources backfill in interviewAnalyst
 *
 * Two sinks (both optional, both try/catch — emitter never throws):
 *   1. Langfuse span — when LANGFUSE_ENABLED=true and an active trace exists
 *   2. JSONL file   — when SLOT_TRAIL_FILE env var is set
 *   3. Console      — when DEBUG includes 'slot_trail'
 */

export interface SlotWriteEvent {
  /** ISO timestamp of the write */
  ts: string
  /** Interview this slot belongs to */
  interviewId: string
  /** Which write path produced this event */
  source: 'analyst' | 'quick' | 'backfill'
  /** Step title the slot was written to */
  stepTitle: string
  /** Slot key */
  slot: string
  /** Serialised slot value */
  value: unknown
  /** True when this write replaced a non-null previous value */
  overwrite: boolean
  /** Source turn number if known */
  sourceTurn?: number | null
  /** Short evidence quote / span if available */
  evidence?: string | null
}

/**
 * Emit a slot-write event to all configured sinks.
 * Never throws — all errors are swallowed with a console.warn.
 */
export async function emitSlotWrite(event: SlotWriteEvent): Promise<void> {
  // ── Langfuse sink ─────────────────────────────────────────────────────────
  if (process.env.LANGFUSE_ENABLED === 'true') {
    try {
      // We piggyback on the Langfuse SDK that the eval runner already initialised.
      // If no SDK / active trace exists, the import still succeeds but the span
      // is silently dropped — acceptable no-op.
      const { Langfuse } = await import('langfuse')
      if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
        const lf = new Langfuse({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
          flushAt: 1,
          flushInterval: 0,
        })
        lf.event({
          name: 'slot_write',
          // session groups all spans for this interview
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
        // Fire-and-forget flush — if it fails we still don't throw
        lf.shutdownAsync().catch(() => {})
      }
    } catch {
      // Langfuse sink failure is non-fatal
    }
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
