# ADR-015: Slot-Write-Trail + Frozen-Transcript Replay Corpus

**Status:** Accepted
**Date:** 2026-06-03
**Deciders:** Solo dev (PROJ-22 Charge 1 Robustness Refactor)

---

## Context

The Dual-Loop Interview Engine (ADR-011) has three distinct write paths for slot data:

1. **Analyst** — primary LLM-driven extraction via `record_slot` tool in `interviewAnalyst.ts`
2. **Quick-Extract** — pre-Talker fast extraction via restricted `record_slot` call in `interviewQuickExtract.ts`
3. **Backfill** — deterministic `data_sources` backfill from `friction_tools` in `backfillDataSourcesFromMentions()` in `interviewAnalyst.ts`

Today there is no observability trail for these writes. When a slot ends up with a wrong value (e.g. anchoring from a backfill, overwrite from quick-extract), there is no log to query in Langfuse or locally to determine which path wrote it, when, and with what evidence.

This makes regression debugging expensive: we must re-run a full eval and eyeball tool-call sequences instead of querying a structured trail.

Additionally, there is no frozen-transcript replay capability. Every regression check requires a full live eval run against Supabase + AI providers, which takes 3–5 minutes per persona and incurs API costs. There is no way to run scorers offline against a known-good transcript in CI.

---

## Decision

### Slot-Write-Trail Emitter

Introduce a `SlotWriteEvent` interface and `emitSlotWrite()` function in `src/services/slotWriteTrail.ts`. The emitter writes to two sinks:

- **Langfuse Span** — appended to the active trace when `LANGFUSE_ENABLED=true`. Tagged `event:slot_write`. No-op when no active trace. Never throws.
- **JSONL file** — one JSON line per event appended to `SLOT_TRAIL_FILE` when that env var is set. Used by the eval runner to produce `slot-trail.jsonl` per run.
- **Console debug** — single-line log when `DEBUG` includes `slot_trail`.

All sinks are wrapped in `try/catch`. The emitter never throws — observability must not break the interview flow.

The emitter is called at three points:
- `record_slot` tool (in `interviewAgent.ts`) after a successful DB write, with `source: 'analyst'` or `source: 'quick'` depending on which caller invoked `buildTools`
- `backfillDataSourcesFromMentions()` in `interviewAnalyst.ts` per mutated step, with `source: 'backfill'`

`buildTools()` gains an optional second parameter `opts?: { source?: 'quick' | 'analyst' }` with default `'analyst'` for backward compatibility.

### Frozen-Transcript Replay Corpus

Introduce a replay infrastructure at `src/services/__evals__/interview/replay/` that:

1. **Parses** existing eval MD files into `TranscriptFixture` objects (best-effort, tolerates missing fields in older MDs)
2. **Runs all scorers** against the frozen transcript data without any live LLM/Supabase calls
3. **Compares** scorer outputs against a `baseline.json` stored alongside the fixture
4. **Fails** (non-zero exit) when any score deviates by more than the tolerance (numeric ±0.05, boolean exact)
5. **Updates** baselines via `--update-baseline` CLI flag

Fixtures live in `src/services/__evals__/interview/__fixtures__/<run-id>/`:
- `transcript.json` — frozen turns + final step tracker + metadata
- `baseline.json` — expected scorer outputs
- `source.md` — copy of the original eval MD (for human reference)

The replay path **never imports** `runner.ts`. It only imports scorers and types. No Supabase, no AI provider keys needed at replay runtime — CI can run it without secrets.

A backfill script (`scripts/backfill-fixtures-from-md.ts`) populates the initial fixture corpus from existing `docs/evals/interview/2026-06-03/*.md` files. Initial baselines are set to the scorer outputs computed against each frozen transcript.

---

## Consequences

**Positive:**
- Slot-write origin is now queryable: `langfuse-data` MCP `listTraces` + tag filter `event:slot_write` shows every write with source, step, slot, value, overwrite flag, and evidence.
- Regressions in scorer outputs are caught in CI on every PR touching eval or interview code — without live API calls.
- `slot-trail.jsonl` per eval run enables post-hoc analysis of write sequence (e.g. "did quick-extract overwrite analyst?").

**Negative / Trade-offs:**
- Replay only scores what the scorers can see from frozen turns + final step tracker. Scorers that require live LLM calls (e.g. `dialogNaturalness`) still need a live model key; these are skipped or mocked in replay.
- Fixtures represent a point-in-time snapshot. If persona or scorer logic changes fundamentally, baselines need a full `--update-baseline` run.
- Slight added complexity in `buildTools` signature (opt-in source marker), mitigated by default value for BC.
