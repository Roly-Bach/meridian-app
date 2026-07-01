# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)

Datum 2026-07-01 · n=29 · prod=getJudgeModel(model) · Schwelle κ≥0.61
Referenz-Judges: anthropic/claude-sonnet-4-5, google/gemini-3.5-flash

> Nominal-κ ist die Bestehensgrenze (Versuchsplan). Gewichtetes κ, Versatz und Adjazenz sind
> Diagnostik für geordnete Levels: ein negativer Versatz bei hoher Adjazenz heißt systematischer
> Strenge-Offset (kein Zufallsrauschen). Volle Begründungen je Transkript im JSON-Sidecar.

## Referenz-Judge: anthropic/claude-sonnet-4-5

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 29 | 0.6897 | 0.0842 | 0.1008 | -0.2069 | 1 | FAIL |
| depth | 29 | 0.7931 | 0.2984 | 0.2984 | -0.1379 | 1 | FAIL |
| grounding | 29 | 0.7241 | 0.4554 | 0.4554 | 0.2069 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=29, match=0.7241, κ=0.4554
- bereinigt (ohne parseFailed): n=29, match=0.7241, κ=0.4554
- Artefakt-Anteil: 0/29

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 0 | 0 |
| **0.67** | 0 | 20 | 7 |
| **1.0** | 0 | 1 | 1 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 2 | 5 | 0 |
| **2** | 1 | 21 | 0 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 13 | 1 |
| **1** | 7 | 8 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-04-22-36-00-anthropic-claude-haiku-4-5-buchhalter.transcript | buchhalter | 1/1 | 1/2 ✗ | 0/0 |  |
| 2026-06-05-08-58-34-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-05-11-01-53-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Die Agent-Texte sind durchgehend natürlich, höflich und professionell… |
| 2026-06-05-14-14-38-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Durchgehend natürliche, professionelle Sprache ohne generische Floske… |
| 2026-06-05-14-31-19-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung ohne generisc… |
| 2026-06-05-15-09-21-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 1/0 ✗ |  |
| 2026-06-05-15-19-18-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Die Agent-Texte sind durchgehend natürlich, höflich und professionell… |
| 2026-06-08-14-41-37-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-08-14-44-21-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.67 | 1/1 | 0/0 |  |
| 2026-06-08-16-40-34-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref: Die Agent-Texte sind durchgehend natürlich und professionell formulie… |
| 2026-06-08-16-43-54-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-18-09-18-17-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/1 ✗ | 0/0 |  |
| 2026-06-18-10-14-09-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 0/1 ✗ |  |
| 2026-06-18-12-57-00-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 1/2 ✗ | 1/0 ✗ |  |
| 2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-19-10-58-07-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-22-08-58-08-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-27-21-11-22-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-27-21-18-04-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/0 ✗ |  |
| 2026-06-27-21-19-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/1 ✗ | 2/2 | 1/1 | prod: Die Texte zeigen überwiegend natürliche, gesprächsorientierte Fragen … ‖ ref: Alle Agent-Texte sind durchgehend natürlich formuliert, verwenden kon… |
| 2026-06-27-21-21-22-google-gemini-3-1-flash-lite-it-support-run2.transcript | it-support | 0.67/0.67 | 1/1 | 1/0 ✗ |  |
| 2026-06-27-21-23-55-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-27-21-26-12-google-gemini-3-1-flash-lite-it-support-run3.transcript | it-support | 0.67/1 ✗ | 2/2 | 1/1 | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref: Durchgehend natürliche, höfliche Sprache ohne generische Floskeln. Di… |
| 2026-06-27-21-39-11-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-27-21-49-39-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.67 | 1/2 ✗ | 0/0 |  |
| 2026-06-28-11-10-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/0.5 ✗ | 1/2 ✗ | 1/1 | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref:  |
| 2026-06-28-11-24-20-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-28-11-36-33-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 1/0.67 ✗ | 1/2 ✗ | 1/0 ✗ | prod: Die Agent-Texte zeigen durchgehend natürliche, präzise Gesprächsführu… ‖ ref: Die Agent-Texte sind überwiegend natürlich und professionell formulie… |
| 2026-06-28-11-50-21-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/0 ✗ |  |

## Referenz-Judge: google/gemini-3.5-flash

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 29 | 0.0345 | 0.0252 | 0.2658 | -0.069 | 1 | FAIL |
| depth | 8 | 0.75 | -0.0667 | 0 | -0.25 | 1 | FAIL |
| grounding | 29 | 0.4828 | 0 | 0 | 0.5172 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=29, match=0.4828, κ=0
- bereinigt (ohne parseFailed): n=23, match=0.5652, κ=0
- Artefakt-Anteil: 6/29

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 0 | 0 |
| **0.67** | 0 | 24 | 3 |
| **1.0** | 0 | 1 | 1 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 0 | 1 | 0 |
| **2** | 0 | 6 | 1 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 14 | 0 |
| **1** | 15 | 0 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-04-22-36-00-anthropic-claude-haiku-4-5-buchhalter.transcript | buchhalter | 1/1 | — | 0/0 |  |
| 2026-06-05-08-58-34-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref:  |
| 2026-06-05-11-01-53-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref:  |
| 2026-06-05-14-14-38-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/3 ✗ | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref:  |
| 2026-06-05-14-31-19-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref:  |
| 2026-06-05-15-09-21-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref:  |
| 2026-06-05-15-19-18-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref:  |
| 2026-06-08-14-41-37-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/0.5 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref:  |
| 2026-06-08-14-44-21-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.5 ✗ | 1/2 ✗ | 0/0 | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Text [1] zei… ‖ ref:  |
| 2026-06-08-16-40-34-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/1 ✗ | — | 0/0 ⚠ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref: Die Dialoge sind durchgehend natürlich, höflich und professionell ges… |
| 2026-06-08-16-43-54-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche Sprache und konsistente Du-Form. Text [1] ist … ‖ ref:  |
| 2026-06-18-09-18-17-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche, professionelle Sprache mit konsistenter Du-Fo… ‖ ref:  |
| 2026-06-18-10-14-09-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Die Texte zeigen überwiegend natürliche Gesprächsführung mit konsiste… ‖ ref:  |
| 2026-06-18-12-57-00-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Gute Struktu… ‖ ref: Die Texte sind durchgehend natuerlich, hoeflich und professionell for… |
| 2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref:  |
| 2026-06-19-10-58-07-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref:  |
| 2026-06-22-08-58-08-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | 2/2 | 0/0 | prod: Die Texte zeigen überwiegend natürliche, zielgerichtete Gesprächsführ… ‖ ref:  |
| 2026-06-27-21-11-22-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Die Fragen sind überwiegend natürlich und spezifisch formuliert, zeig… ‖ ref:  |
| 2026-06-27-21-18-04-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Die Texte zeigen überwiegend natürliche Gesprächsführung mit gezielte… ‖ ref:  |
| 2026-06-27-21-19-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/1 ✗ | — | 1/0 ✗ ⚠ | prod: Die Texte zeigen überwiegend natürliche, gesprächsorientierte Fragen … ‖ ref: Die Texte sind durchgehend natürlich, präzise und höflich formuliert.… |
| 2026-06-27-21-21-22-google-gemini-3-1-flash-lite-it-support-run2.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Die… ‖ ref:  |
| 2026-06-27-21-23-55-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Die Fragen sind überwiegend natürlich und spezifisch formuliert, mit … ‖ ref:  |
| 2026-06-27-21-26-12-google-gemini-3-1-flash-lite-it-support-run3.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref:  |
| 2026-06-27-21-39-11-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref:  |
| 2026-06-27-21-49-39-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.5 ✗ | — | 0/0 | prod: Die Fragen sind überwiegend natürlich und zielgerichtet formuliert. D… ‖ ref:  |
| 2026-06-28-11-10-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref:  |
| 2026-06-28-11-24-20-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Die Texte zeigen überwiegend natürliche Gesprächsführung mit konsiste… ‖ ref:  |
| 2026-06-28-11-36-33-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 1/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Die Agent-Texte zeigen durchgehend natürliche, präzise Gesprächsführu… ‖ ref:  |
| 2026-06-28-11-50-21-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref:  |

