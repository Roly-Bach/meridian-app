# Slot-Write-Trail Diagnostics

Introduced in ADR-015 (Charge 1 Robustness Refactor). Provides structured observability for all three slot-write paths in the Dual-Loop engine.

## Write Sources

| Source | File | When |
|--------|------|------|
| `analyst` | `interviewAnalyst.ts` → `buildTools(..., { source: 'analyst' })` | After every `record_slot` tool call from the Analyst |
| `quick` | `interviewQuickExtract.ts` → `buildTools(..., { source: 'quick' })` | After every `record_slot` tool call from Quick-Extract |
| `backfill` | `interviewAnalyst.ts` → `backfillDataSourcesFromMentions()` | Once per Analyst run, per step where `data_sources` was null |

## Sinks

### 1. JSONL file (eval runs)

Set by `runner.ts` before the interview loop:
```
docs/evals/interview/<date>/<date>-<time>-<model>-<persona>.slot-trail.jsonl
```

Each line is a JSON object with the `SlotWriteEvent` shape:
```json
{"ts":"2026-06-03T...","interviewId":"...","source":"analyst","stepTitle":"Rechnungsprüfung","slot":"frequency_per_month","value":100,"overwrite":false,"sourceTurn":3,"evidence":"100 Rechnungen pro Monat"}
```

### 2. Langfuse span (when `LANGFUSE_ENABLED=true`)

Each event is emitted as a Langfuse event named `slot_write`, tagged:
- `event:slot_write`
- `source:<analyst|quick|backfill>`
- `slot:<slot_key>`
- `overwrite:true` (only when overwriting)

#### Querying via Langfuse MCP

Show all slot writes for a session:
```
"List all events tagged event:slot_write for session <interview_id>"
```

Find overwrite events in a run:
```
"Show langfuse events with tag overwrite:true for eval_run_id <run_id>"
```

Compare write sequences between two runs:
```
"Compare slot_write event sequences for eval_run_id <id1> vs <id2>"
```

### 3. Console (debug)

Enable with `DEBUG=slot_trail` in your shell:
```bash
DEBUG=slot_trail npm run eval:interview buchhalter
```

Output format:
```
[slot_trail] analyst Rechnungsprüfung/frequency_per_month=100 turn=3
[slot_trail] quick Rechnungsprüfung/duration_minutes=30 [OVERWRITE] turn=5
```

## Checking for Overwrites

A common diagnostic question: "Did quick-extract overwrite a slot that analyst had already filled?"

In the JSONL trail, filter for `overwrite: true` entries with `source: "quick"`:
```bash
grep '"overwrite":true' *.slot-trail.jsonl | grep '"source":"quick"'
```

## Schema

```typescript
interface SlotWriteEvent {
  ts: string              // ISO timestamp
  interviewId: string
  source: 'analyst' | 'quick' | 'backfill'
  stepTitle: string
  slot: string
  value: unknown
  overwrite: boolean      // true = replaced non-null previous value
  sourceTurn?: number | null
  evidence?: string | null
}
```
