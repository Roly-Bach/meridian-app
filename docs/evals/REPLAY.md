# Eval Replay-Corpus

Frozen-Transcript replay infrastructure for fast scorer regression checks. Introduced in ADR-015 (Charge 1 Robustness Refactor).

## What it does

Stores parsed eval transcripts as fixtures (`src/services/__evals__/interview/__fixtures__/<run-id>/`). On each replay, the scorer suite runs against the frozen transcript and compares scores against `baseline.json`. Replay is fully offline — no LLM calls, no API keys, no Supabase. Deterministic in seconds.

Replay catches **scorer drift** (logic changes in `src/services/__evals__/interview/scorers/*` silently shifting scores). It does **not** catch model regression — that requires `npm run eval:interview` (a live LLM run).

## Fixture layout

```
src/services/__evals__/interview/__fixtures__/
  <eval-run-id>/
    transcript.json   # immutable — parsed turns, finalStepTracker, status, model
    baseline.json     # mutable — accepted scores at scorer version X
    source.md         # provenance — copy of original docs/evals MD
```

## Commands

```bash
npm run eval:replay              # run replay, exit non-zero on drift
npm run eval:replay:update       # accept current scores → write to baseline.json
```

Tolerance:
- numeric scores: ±0.05
- boolean scores: exact match

## When to use what

| Situation | Tool |
|-----------|------|
| Changed scorer logic | `npm run eval:replay` — verify intended shift, then `:update` |
| Changed Talker/Analyst prompt | `npm run eval:interview <persona>` — needs live LLM |
| PR touches `src/services/interview*` or scorers | GitHub Action runs replay automatically |
| Investigating a single eval-run | parse its MD via `scripts/backfill-fixtures-from-md.ts`, replay |

## Baseline updates

When you intentionally change scorer logic, expect a drift. Update the baseline with a clear commit message:

```
chore(evals): baseline refresh — reason: tokenJaccard threshold raised 0.4→0.5
```

Never `:update` reflexively to silence a failing replay. The drift is the signal.

## Adding new fixtures

Live eval runs (`runner.ts`) write `transcript.json` next to the MD automatically. To backfill historical MDs:

```bash
tsx scripts/backfill-fixtures-from-md.ts
```

Old MDs may not parse cleanly — best-effort, failures are logged and skipped.

## Related

- ADR-015 — design decision (Langfuse + JSONL sinks for slot-trail, frozen-replay for corpus)
- `docs/diagnostics/slot-write-trail.md` — sister tool for slot-write debugging
