# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)

prod=getJudgeModel(model) · ref=anthropic/claude-sonnet-4-5 · n=29 · Schwelle κ≥0.61

| Dimension | n | Level-Match | Cohen-κ | Verdikt |
|---|---|---|---|---|
| dialog | 29 | 0.4483 | 0.1564 | FAIL |
| depth | 29 | 0.9655 | 0.6506 | PASS |
| grounding | 29 | 0.6207 | 0.1799 | FAIL |
