# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)

Datum 2026-07-01 · n=29 · prod=getJudgeModel(model) · Schwelle κ≥0.61
Referenz-Judges: google/gemini-3.5-flash, google/gemini-3.1-flash-lite

> Nominal-κ ist die Bestehensgrenze (Versuchsplan). Gewichtetes κ, Versatz und Adjazenz sind
> Diagnostik für geordnete Levels: ein negativer Versatz bei hoher Adjazenz heißt systematischer
> Strenge-Offset (kein Zufallsrauschen). Volle Begründungen je Transkript im JSON-Sidecar.

## Referenz-Judge: google/gemini-3.5-flash

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 19 | 0.2105 | 0.0273 | 0.0273 | -0.7895 | 1 | FAIL |
| depth | 19 | 0.6316 | 0.0952 | 0.1635 | -0.3684 | 1 | FAIL |
| grounding | 19 | 0.4211 | 0.103 | 0.103 | 0.5789 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=19, match=0.4211, κ=0.103
- bereinigt (ohne parseFailed): n=15, match=0.5333, κ=0.186
- Artefakt-Anteil: 4/19

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 0 | 0 |
| **0.67** | 0 | 2 | 15 |
| **1.0** | 0 | 0 | 2 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 1 | 5 | 0 |
| **2** | 0 | 11 | 2 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 6 | 0 |
| **1** | 11 | 2 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-04-22-36-00-anthropic-claude-haiku-4-5-buchhalter.transcript | buchhalter | 1/1 | 1/2 ✗ | 0/0 |  |
| 2026-06-18-09-18-17-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, professionelle Sprache mit konsistenter Du-Fo… ‖ ref: Die Texte sind durchgehend natuerlich, hoeflich und professionell for… |
| 2026-06-18-10-14-09-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Die Texte zeigen überwiegend natürliche Gesprächsführung mit konsiste… ‖ ref: Die Agent-Texte sind durchgehend natürlich, höflich und professionell… |
| 2026-06-18-12-57-00-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 1/2 ✗ | 1/0 ✗ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Gute Struktu… ‖ ref: Die Texte sind durchgehend natuerlich, hoeflich und professionell for… |
| 2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref: Die Texte sind durchgehend professionell, höflich und natürlich formu… |
| 2026-06-19-10-58-07-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-22-08-58-08-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-27-21-11-22-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/1 ✗ | 2/3 ✗ | 1/0 ✗ ⚠ | prod: Die Fragen sind überwiegend natürlich und spezifisch formuliert, zeig… ‖ ref: Die Texte sind durchgehend exzellent formuliert. Es gibt keine generi… |
| 2026-06-27-21-18-04-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref: Die Texte sind durchgehend exzellent formuliert. Die Du-Form wird kon… |
| 2026-06-27-21-19-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/1 ✗ | 1/2 ✗ | 1/1 | prod: Die Texte zeigen überwiegend natürliche, gesprächsorientierte Fragen … ‖ ref: Die Texte sind durchgehend natürlich, präzise und höflich formuliert.… |
| 2026-06-27-21-21-22-google-gemini-3-1-flash-lite-it-support-run2.transcript | it-support | 0.67/1 ✗ | 1/1 | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Die… ‖ ref: Die Texte sind durchgehend natürlich, präzise und professionell formu… |
| 2026-06-27-21-23-55-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.67 | 2/3 ✗ | 1/0 ✗ ⚠ |  |
| 2026-06-27-21-26-12-google-gemini-3-1-flash-lite-it-support-run3.transcript | it-support | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-27-21-39-11-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/1 ✗ | 1/2 ✗ | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-27-21-49-39-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/1 ✗ | 2/2 | 0/0 | prod: Die Fragen sind überwiegend natürlich und zielgerichtet formuliert. D… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-28-11-10-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/0.67 | 1/2 ✗ | 1/1 |  |
| 2026-06-28-11-24-20-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 1/0 ✗ ⚠ | prod: Die Texte zeigen überwiegend natürliche Gesprächsführung mit konsiste… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |
| 2026-06-28-11-36-33-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 1/1 | 2/2 | 1/0 ✗ |  |
| 2026-06-28-11-50-21-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Die Texte sind durchgehend natürlich, höflich und professionell formu… |

## Referenz-Judge: google/gemini-3.1-flash-lite

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 10 | 0.5 | 0 | 0 | -0.5 | 1 | FAIL |
| depth | 10 | 1 | 1 | 1 | 0 | 1 | PASS |
| grounding | 10 | 0.7 | -0.1538 | -0.1538 | -0.1 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=10, match=0.7, κ=-0.1538
- bereinigt (ohne parseFailed): n=10, match=0.7, κ=-0.1538
- Artefakt-Anteil: 0/10

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 0 | 0 |
| **0.67** | 0 | 5 | 5 |
| **1.0** | 0 | 0 | 0 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 1 | 0 | 0 |
| **2** | 0 | 9 | 0 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 7 | 2 |
| **1** | 1 | 0 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-05-08-58-34-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Die Agent-Texte sind exzellent formuliert. Sie wirken sehr natürlich,… |
| 2026-06-05-11-01-53-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Die Dialogführung ist exzellent. Der Agent agiert professionell, verz… |
| 2026-06-05-14-14-38-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-05-14-31-19-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 1/0 ✗ |  |
| 2026-06-05-15-09-21-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/1 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref: Die Agent-Texte sind exzellent. Sie wirken durchgehend natürlich, pro… |
| 2026-06-05-15-19-18-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Die Dialogführung ist exzellent. Der Agent agiert professionell, verz… |
| 2026-06-08-14-41-37-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/0.67 | 2/2 | 0/1 ✗ |  |
| 2026-06-08-14-44-21-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.67 | 1/1 | 0/0 |  |
| 2026-06-08-16-40-34-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Einleitu… ‖ ref: Die Dialogführung ist exzellent. Der Agent agiert professionell, blei… |
| 2026-06-08-16-43-54-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.67 | 2/2 | 0/0 |  |

