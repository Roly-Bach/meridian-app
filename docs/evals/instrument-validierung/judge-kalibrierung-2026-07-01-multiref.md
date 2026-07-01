# Judge-Kalibrierung — Ergebnis (PROJ-40 Stufe 1)

Datum 2026-07-01 · n=29 · prod=getJudgeModel(model) · Schwelle κ≥0.61
Referenz-Judges: anthropic/claude-sonnet-4-5, google/gemini-3.5-flash

> Nominal-κ ist die Bestehensgrenze (Versuchsplan). Gewichtetes κ, Versatz und Adjazenz sind
> Diagnostik für geordnete Levels: ein negativer Versatz bei hoher Adjazenz heißt systematischer
> Strenge-Offset (kein Zufallsrauschen). Volle Begründungen je Transkript im JSON-Sidecar.

## Referenz-Judge: anthropic/claude-sonnet-4-5

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 29 | 0.3448 | 0.0629 | 0.0291 | -0.7241 | 0.8276 | FAIL |
| depth | 29 | 0.8276 | 0.3439 | 0.3439 | -0.0345 | 1 | FAIL |
| grounding | 29 | 0.5517 | 0.0407 | 0.0407 | 0.1034 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=29, match=0.5517, κ=0.0407
- bereinigt (ohne parseFailed): n=25, match=0.6, κ=0.0876
- Artefakt-Anteil: 4/29

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 3 | 5 |
| **0.67** | 0 | 9 | 9 |
| **1.0** | 0 | 1 | 2 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 2 | 3 | 0 |
| **2** | 2 | 22 | 0 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 4 | 5 |
| **1** | 8 | 12 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-04-22-36-00-anthropic-claude-haiku-4-5-buchhalter.transcript | buchhalter | 1/1 | 2/2 | 0/1 ✗ |  |
| 2026-06-05-08-58-34-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung ohne generisc… |
| 2026-06-05-11-01-53-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 0/1 ✗ | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung ohne generisc… |
| 2026-06-05-14-14-38-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/1 ✗ | 2/2 | 1/1 | prod: Durchgehend generische Floskeln ('Das ist ein...', 'Das macht...', 'D… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung mit konsequen… |
| 2026-06-05-14-31-19-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 1/1 | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref: Durchgehend natürliche, professionelle Sprache ohne generische Floske… |
| 2026-06-05-15-09-21-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/1 ✗ | 2/2 | 1/0 ✗ | prod: Häufige generische Floskeln wie 'Das ist eine gute Frage', 'Das ist e… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung mit konsequen… |
| 2026-06-05-15-19-18-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/1 ✗ | 2/2 | 0/1 ✗ | prod: Durchgehend generische Floskeln ('Das ist ein wichtiger erster Schrit… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung ohne generisc… |
| 2026-06-08-14-41-37-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/0.67 | 2/2 | 0/0 |  |
| 2026-06-08-14-44-21-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.67 | 1/2 ✗ | 0/0 |  |
| 2026-06-08-16-40-34-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.33/1 ✗ | 2/2 | 1/1 | prod: Häufige generische Floskeln ('Ich nehme das so auf', 'Das ist so erfa… ‖ ref: Durchgehend natürliche, professionelle Sprache ohne generische Floske… |
| 2026-06-08-16-43-54-google-gemini-3-5-flash-it-support.transcript | it-support | 0.33/1 ✗ | 2/1 ✗ | 0/1 ✗ | prod: Häufige generische Floskeln ('Verstanden', 'Ok, das passt so', 'Das h… ‖ ref: Durchgehend natürliche, höfliche Sprache ohne generische Floskeln wie… |
| 2026-06-18-09-18-17-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 1/1 | 1/0 ✗ ⚠ |  |
| 2026-06-18-10-14-09-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 1/0 ✗ |  |
| 2026-06-18-12-57-00-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.33/0.67 ✗ | 2/1 ✗ | 1/1 | prod: Häufige generische Floskeln ('Das ist ein klarer Ablauf', 'Das ist ei… ‖ ref: Die Texte sind überwiegend natürlich und professionell formuliert. Di… |
| 2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | 2/2 | 1/0 ✗ | prod: Häufige generische Floskeln ('Notieren wir das als variabel', 'Das is… ‖ ref: ```json { "stufe": 2, "begruendung": "Die Sprache ist überwiegend nat… |
| 2026-06-19-10-58-07-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-22-08-58-08-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/1 ✗ | 2/2 | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen ohne generische Floskel… ‖ ref: Durchgehend natürliche, professionelle Sprache ohne generische Floske… |
| 2026-06-27-21-11-22-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 1/0.67 ✗ | 2/2 | 1/1 | prod: Durchgehend natürliche, präzise Fragen ohne generische Floskeln. Kons… ‖ ref: Die Texte verwenden durchgehend die Du-Form und sind überwiegend natü… |
| 2026-06-27-21-18-04-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-27-21-19-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/1 ✗ | 1/1 | 1/1 | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung mit konsequen… |
| 2026-06-27-21-21-22-google-gemini-3-1-flash-lite-it-support-run2.transcript | it-support | 0.67/1 ✗ | 1/2 ✗ | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref: Durchgehend natürliche, präzise Formulierungen ohne generische Floske… |
| 2026-06-27-21-23-55-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.5/0.67 ✗ | 2/2 | 0/1 ✗ ⚠ | prod:  ‖ ref: Die Texte verwenden durchgehend die Du-Form und sind überwiegend natü… |
| 2026-06-27-21-26-12-google-gemini-3-1-flash-lite-it-support-run3.transcript | it-support | 0.67/1 ✗ | 2/2 | 1/1 | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref: Durchgehend natürliche, höfliche Sprache ohne generische Floskeln. Ko… |
| 2026-06-27-21-39-11-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.67 | 1/2 ✗ | 1/1 |  |
| 2026-06-27-21-49-39-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/1 ✗ | 2/2 | 0/0 | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Die… ‖ ref: Durchgehend natürliche, professionelle Gesprächsführung ohne generisc… |
| 2026-06-28-11-10-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.33/0.67 ✗ | 2/2 | 1/1 | prod: Inkonsistente Du-Form (Text 5 nutzt plötzlich Sie-Form), abrupte Them… ‖ ref: Überwiegend natürliche Sprache mit konsequenter Du-Form in [1-4, 6-8]… |
| 2026-06-28-11-24-20-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.67 | 2/2 | 1/1 |  |
| 2026-06-28-11-36-33-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 1/1 | 2/2 | 1/0 ✗ |  |
| 2026-06-28-11-50-21-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/1 ✗ | 2/2 | 0/0 ⚠ | prod: Überwiegend natürliche, präzise Fragen mit guter Gesprächslogik. Du-F… ‖ ref: Durchgehend natürliche, präzise Formulierungen ohne generische Floske… |

## Referenz-Judge: google/gemini-3.5-flash

| Dimension | n | Level-Match | nominal-κ | gewichtetes-κ | Versatz (prod−ref) | Adjazenz | Verdikt |
|---|---|---|---|---|---|---|---|
| dialog | 29 | 0.0345 | 0 | 0 | -0.1724 | 1 | FAIL |
| depth | 3 | 0.6667 | 0 | 0 | -0.3333 | 1 | FAIL |
| grounding | 29 | 0.3103 | 0 | 0 | 0.6897 | 1 | FAIL |

**grounding roh vs. bereinigt (KI-18-Fallback-Artefakt getrennt):**
- roh: n=29, match=0.3103, κ=0
- bereinigt (ohne parseFailed): n=16, match=0.3125, κ=0
- Artefakt-Anteil: 13/29

**Konfusionsmatrizen (Zeilen prod, Spalten ref):**

_dialog_

| prod↓ / ref→ | 0.33 | 0.67 | 1.0 |
| --- | --- | --- | --- |
| **0.33** | 0 | 8 | 0 |
| **0.67** | 0 | 18 | 0 |
| **1.0** | 0 | 3 | 0 |

_depth_

| prod↓ / ref→ | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **1** | 0 | 1 | 0 |
| **2** | 0 | 2 | 0 |
| **3** | 0 | 0 | 0 |

_grounding_

| prod↓ / ref→ | 0 | 1 |
| --- | --- | --- |
| **0** | 9 | 0 |
| **1** | 20 | 0 |

**Pro-Transkript (kompakt; ✗ = Level-Mismatch, ⚠ = grounding parseFailed; volle Begründungen im JSON):**

| Transkript | Persona | dialog p/r | depth p/r | grounding p/r | Divergenz-Notiz (dialog) |
|---|---|---|---|---|---|
| 2026-06-04-22-36-00-anthropic-claude-haiku-4-5-buchhalter.transcript | buchhalter | 1/0.5 ✗ | — | 0/0 | prod: Der Agent führt das Interview äußerst professionell und strukturiert.… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind hervorragend und durchg… |
| 2026-06-05-08-58-34-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-05-11-01-53-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche, strukturierte Gesprächsführung mit konsistent… ‖ ref: *Naturalness:* Very high. It sounds like a structured, professional, … |
| 2026-06-05-14-14-38-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | — | 1/0 ✗ | prod: Durchgehend generische Floskeln ('Das ist ein...', 'Das macht...', 'D… ‖ ref: {"stufe": 2, "begruendung": "Die Du-Form wird konsequent und fehlerfr… |
| 2026-06-05-14-31-19-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref: ?* No, the transitions are smooth and refer back to previous answers … |
| 2026-06-05-15-09-21-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | — | 1/0 ✗ | prod: Häufige generische Floskeln wie 'Das ist eine gute Frage', 'Das ist e… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-05-15-19-18-google-gemini-3-5-flash-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | — | 0/0 ⚠ | prod: Durchgehend generische Floskeln ('Das ist ein wichtiger erster Schrit… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-08-14-41-37-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.67/0.5 ✗ | 2/2 | 0/0 ⚠ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref: {"stufe": 2, "begruendung": "Die Texte nutzen die Du-Form konsequent … |
| 2026-06-08-14-44-21-google-gemini-3-5-flash-it-support.transcript | it-support | 0.67/0.5 ✗ | 1/2 ✗ | 0/0 | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Text [1] ist… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-08-16-40-34-google-gemini-3-5-flash-vertriebler.transcript | vertriebler | 0.33/0.5 ✗ | — | 1/0 ✗ | prod: Häufige generische Floskeln ('Ich nehme das so auf', 'Das ist so erfa… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-08-16-43-54-google-gemini-3-5-flash-it-support.transcript | it-support | 0.33/0.5 ✗ | — | 0/0 | prod: Häufige generische Floskeln ('Verstanden', 'Ok, das passt so', 'Das h… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-18-09-18-17-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, fachlich angemessene Sprache mit konsistenter… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-18-10-14-09-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form und … ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-18-12-57-00-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | — | 1/0 ✗ | prod: Häufige generische Floskeln ('Das ist ein klarer Ablauf', 'Das ist ei… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.33/0.5 ✗ | 2/2 | 1/0 ✗ | prod: Häufige generische Floskeln ('Notieren wir das als variabel', 'Das is… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-19-10-58-07-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Gesprächsführung mit konsisten… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-22-08-58-08-google-gemini-3-1-flash-lite-buchhalter.transcript | buchhalter | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche, zielgerichtete Fragen ohne generische Floskel… ‖ ref: st — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt … |
| 2026-06-27-21-11-22-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 1/0.5 ✗ | — | 1/0 ✗ | prod: Durchgehend natürliche, präzise Fragen ohne generische Floskeln. Kons… ‖ ref: von 30 Minuten pro Angebot gesprochen, während du jetzt von 5 Anfrage… |
| 2026-06-27-21-18-04-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche Gesprächsführung mit gezielten Fragen. Text [2… ‖ ref: den vollen Umfang erfasst. Ich wünsche dir einen produktiveren Arbeit… |
| 2026-06-27-21-19-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: {"stufe": 3, "begruendung": "Die Texte sind durchgehend natürlich, pr… |
| 2026-06-27-21-21-22-google-gemini-3-1-flash-lite-it-support-run2.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Tex… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |
| 2026-06-27-21-23-55-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.5/0.5 | — | 0/0 ⚠ |  |
| 2026-06-27-21-26-12-google-gemini-3-1-flash-lite-it-support-run3.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref: {"stufe": 3, "begruendung": "Die Texte sind durchgehend natürlich, hö… |
| 2026-06-27-21-39-11-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-For… ‖ ref: {"stufe": 3, "begruendung": "Die Texte sind durchgehend natürlich, hö… |
| 2026-06-27-21-49-39-google-gemini-3-1-flash-lite-it-support.transcript | it-support | 0.67/0.5 ✗ | — | 0/0 | prod: Überwiegend natürliche Gesprächsführung mit konsistenter Du-Form. Die… ‖ ref: {"stufe": 3, "begruendung": "Die Texte sind durchgehend natürlich, pr… |
| 2026-06-28-11-10-00-google-gemini-3-1-flash-lite-it-support-run1.transcript | it-support | 0.33/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Inkonsistente Du-Form (Text 5 nutzt plötzlich Sie-Form), abrupte Them… ‖ ref: es, das wir heute noch nicht erwähnt haben?" -> "Du" form. * [8] " |
| 2026-06-28-11-24-20-google-gemini-3-1-flash-lite-vertriebler-run1.transcript | vertriebler | 0.67/0.5 ✗ | — | 1/0 ✗ ⚠ | prod: Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [… ‖ ref: [8] "Alles klar, dann wünsche ich dir einen produktiven Tag und einen… |
| 2026-06-28-11-36-33-google-gemini-3-1-flash-lite-vertriebler-run2.transcript | vertriebler | 1/0.5 ✗ | — | 1/0 ✗ | prod: Durchgehend natürliche, präzise Interviewfragen ohne generische Flosk… ‖ ref: woche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nich… |
| 2026-06-28-11-50-21-google-gemini-3-1-flash-lite-vertriebler-run3.transcript | vertriebler | 0.67/0.5 ✗ | — | 0/0 ⚠ | prod: Überwiegend natürliche, präzise Fragen mit guter Gesprächslogik. Du-F… ‖ ref: {"stufe": 3, "begruendung": "Die Dialoge sind durchgehend natürlich, … |

