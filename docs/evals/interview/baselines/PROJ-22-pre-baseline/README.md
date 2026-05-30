# Baseline: PROJ-22-pre-baseline

> Frozen baseline snapshot before PROJ-22 (Dual-Loop Interview Engine) refactors begin.
> Used as reference for A/B regression gates in each PROJ-22 iteration.

## Metadata

| Field | Value |
|-------|-------|
| Date | 2026-05-30 |
| Git SHA | `bc7a30eea237333421e31bc42eef8fcb6289943c` |
| Prompt version | PROJ-22 pre-refactor (single-loop interviewAgent) |
| eval_run_id flash-lite | `ac82081f-9dbd-4c7a-b3f0-88cf2f99a5b4` |
| eval_run_id flash-3.5 | `bcc9f72c-6552-462d-b7a0-850efd712572` |

## Score Overview

| Model | Persona | slot_coverage | phase_adherence | anchoring_violations | tool_call_plausibility | dialog_naturalness | completion_correctness |
|-------|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| gemini-3.1-flash-lite | buchhalter | 1.0 | 1.0 | 0 | 1.0 | 0.72 | ✅ |
| gemini-3.1-flash-lite | vertriebler | 1.0 | 1.0 | 0 | 1.0 | 0.62 | ❌ |
| gemini-3.1-flash-lite | it-support | 0.38 | 1.0 | 0 | 1.0 | 0.42 | ❌ |
| gemini-3.5-flash | buchhalter | 1.0 | 1.0 | 0 | 1.0 | 0.72 | ✅ |
| gemini-3.5-flash | vertriebler | 1.0 | 1.0 | 0 | 1.0 | 0.72 | ❌ |
| gemini-3.5-flash | it-support | 0.5 | 1.0 | 0 | 1.0 | 0.78 | ❌ |

## Key Observations

- `completion_correctness: false` für 4/6 Runs — wrap_up-Loop terminiert nicht sauber (bekannter PROJ-22 Bug)
- `slot_coverage` für it-support deutlich schwächer (0.38 / 0.5) — Persona-spezifisches Problem, kein IT-Support-Schema im Agent
- `phase_adherence: 1.0` und `anchoring_violations: 0` konsistent über alle Runs — positives Baseline-Signal
- `tool_call_plausibility: 1.0` überall — record_slot Tool-Calls korrekt evidenzbasiert
- `dialog_naturalness` variiert: 0.42–0.78 — Haiku-Judge beurteilt it-support schlechter (technischere Sprache)

## A/B Compare Usage

```bash
# Nach PROJ-22 Iteration — vergleiche gegen flash-lite Baseline:
npm run eval:interview:compare ac82081f-9dbd-4c7a-b3f0-88cf2f99a5b4 <neue-eval-run-id>

# Nach PROJ-22 Iteration — vergleiche gegen flash-3.5 Baseline:
npm run eval:interview:compare bcc9f72c-6552-462d-b7a0-850efd712572 <neue-eval-run-id>
```

## Reports

| File | Model | Persona |
|------|-------|---------|
| [2026-05-30-10-23-33-google-gemini-3-1-flash-lite-buchhalter.md](2026-05-30-10-23-33-google-gemini-3-1-flash-lite-buchhalter.md) | gemini-3.1-flash-lite | buchhalter |
| [2026-05-30-10-24-44-google-gemini-3-1-flash-lite-vertriebler.md](2026-05-30-10-24-44-google-gemini-3-1-flash-lite-vertriebler.md) | gemini-3.1-flash-lite | vertriebler |
| [2026-05-30-10-25-40-google-gemini-3-1-flash-lite-it-support.md](2026-05-30-10-25-40-google-gemini-3-1-flash-lite-it-support.md) | gemini-3.1-flash-lite | it-support |
| [2026-05-30-10-44-42-google-gemini-3-5-flash-buchhalter.md](2026-05-30-10-44-42-google-gemini-3-5-flash-buchhalter.md) | gemini-3.5-flash | buchhalter |
| [2026-05-30-10-48-19-google-gemini-3-5-flash-vertriebler.md](2026-05-30-10-48-19-google-gemini-3-5-flash-vertriebler.md) | gemini-3.5-flash | vertriebler |
| [2026-05-30-10-51-09-google-gemini-3-5-flash-it-support.md](2026-05-30-10-51-09-google-gemini-3-5-flash-it-support.md) | gemini-3.5-flash | it-support |
