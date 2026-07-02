# Checkpoint D Stufe 1 — Judge-Kalibrierung, Ergebnis + Verdikt

Datum 2026-07-01 · n=29 fixierte Transkripte (stratifiziert, `calibration-sample.json`)
Prod-Judge = `getJudgeModel(model)` (Haiku für 28 Gemini-Interviews, gemini-3.1-flash-lite für 1 Anthropic-Interview)
Referenz-Judges = `anthropic/claude-sonnet-4-5`, `google/gemini-3.5-flash`
Rohdaten: [judge-kalibrierung-2026-07-01-multiref.md](judge-kalibrierung-2026-07-01-multiref.md) + `.json` (volle Begründungen)

## Verdikt: NO-GO als Promotions-Gate im jetzigen Zustand

Alle Dimensionen verfehlen die κ≥0.61-Schwelle bei beiden Referenzen. Die Instrumentierung
(Pro-Transkript-Begründungen, Konfusionsmatrizen, gewichtetes κ, Versatz, Adjazenz, grounding
roh/bereinigt) macht die Ursachen aber trennscharf. Das FAIL ist diagnostizierbar, nicht diffus.

## Befund 1 (Blocker): gemini-3.5-flash ist als Judge unbrauchbar (mit den aktuellen Prompts)

Das Modell hält die „AUSSCHLIESSLICH JSON"-Vorgabe nicht ein:
- **dialog**: ~alle 29 fallen auf Fallback 0.5. Rationales sind teils englische Prosa
  (`*Naturalness:* Very high...`), teils Markdown, teils bei 600 Token abgeschnittenes JSON.
  Nominal-Match 0.0345 (1/29).
- **depth**: nur n=3 parsebar (26/29 kein valides JSON-Array).
- **grounding**: 13/29 parseFailed; in keinem Transkript wird eine Verletzung geflaggt
  (Matrix-Spalte ref=1 leer), während Prod-Haiku 20/29 flaggt.

**Konsequenz:** Der Cross-Vendor-Unabhängigkeits-Check (ADR-020-Kern) ist faktisch NICHT erfolgt.
Jede gemini-3.5-flash-Zahl ist Instrument-Rauschen, kein Judge-Signal.

**Entschiedene Richtung:** Judge-Scorer (dialog/depth/grounding) von `generateText` + JSON-Anweisung
auf erzwungenes Schema (`generateObject`/structured output) + höheres Token-Limit umstellen. Erzwingt
valides JSON modellunabhängig, behebt auch die Anthropic-Fallbacks. Danach Kalibrierung wiederholen.

## Befund 2: dialog (Anthropic-Paar) — systematischer Strenge-Offset + echter Dissens

Match 0.34, nom-κ 0.06, gew-κ 0.03, Versatz −0.72, Adjazenz 0.83. In der Konfusionsmatrix vergibt
Sonnet NIE Stufe 1 (Spalte 0.33 leer), Haiku schon. Der Versatz −0.72 bei hoher Adjazenz ist ein
konstanter Strenge-Offset, kein Zufallsrauschen. Zusätzlich echter Sachdissens auf ~6 Transkripten:
Haiku liest „durchgehend generische Floskeln" (Stufe 1), Sonnet „durchgehend natürlich" (Stufe 3) für
dasselbe Transkript. Einer ist falsch kalibriert. Handlungsbedarf: dialog-Rubrik ankern/kalibrieren,
insbesondere die Floskel-Erkennung.

## Befund 3: depth (Anthropic-Paar) — eigentlich gut, κ-FAIL ist Kappa-Paradox

Match 0.83, Adjazenz 1.0, Versatz −0.03 — die bestkalibrierte Dimension. Das κ-0.34-FAIL ist reines
Prävalenz-Artefakt (22/29 sind Stufe 2, schiefe Verteilung senkt κ trotz hoher Roh-Übereinstimmung).
Nebenbefund: kein Judge vergibt je Stufe 3 — Signal über die Extraktionstiefe selbst, nicht über
Judge-Uneinigkeit. Handlungsbedarf: für eine so schiefe 3-Stufen-Skala ist κ≥0.61 der falsche
Maßstab; Match-Quote + gewichtetes κ oder PABAK (prävalenz-adjustiert) als Gate erwägen.

## Befund 4: grounding (Anthropic-Paar) — echt schwache Übereinstimmung

Match 0.55→0.60 (nach Fallback-Bereinigung, 4 Artefakte), κ 0.04→0.09. Beide flaggen häufig
(Haiku 20/29, Sonnet 17/29), stimmen aber nur bei 16/29 überein. Die Bereinigung bewegt κ kaum —
die schwache Übereinstimmung ist echt, kein Artefakt. Die Verletzungs-Definition ist zu subjektiv.
Hängt mit KI-18 zusammen (Grounding-Judge unzuverlässig). Handlungsbedarf: Kriterien/Beispiele schärfen.

## Nächste Schritte

1. Structured-Output-Umbau der Judge-Scorer (behebt Befund 1 + die Anthropic-Fallbacks).
2. Kalibrierung wiederholen → belastbarer Cross-Vendor-Wert.
3. Downstream (Versuchsplan): Gate-Kriterium je Dimension überdenken (depth: Match/PABAK statt κ;
   dialog: Offset-Kalibrierung; grounding: Definition schärfen).

PROJ-41 bleibt hart gegated bis eine belastbare Stufe 1 (+ Stufe 2 Tester-Stabilität) besteht.

## Nachtrag: Lauf 2 — Structured Output (2026-07-01, Commit 9d04265)

Rohdaten: `judge-kalibrierung-2026-07-01-structured-output.{md,json}`. Judge-Scorer (dialog/depth/
grounding) auf `generateObject`+zod-Schema umgestellt (Schritt 1 oben umgesetzt).

**Format-Fallbacks eliminiert:** dialog 30→0, grounding 15→0. Der ursprüngliche Blocker (Prosa/
Truncation → unparsebar) ist behoben.

**Neuer Fehlermodus, fast ausschließlich gemini-3.5-flash:** `NoObjectGeneratedError` (96 gesamt).
Attribution über das JSON-Sidecar:

| Judge | dialog-Fehler | depth null | grounding-Fehler |
|---|---|---|---|
| Prod (Haiku/lite) | 0 | 0/29 | 0 |
| Ref Sonnet | 1 | 0/29 | 0 |
| Ref gemini-3.5-flash | 25/29 | 21/29 | 6 |

Die Anthropic-Judges laufen fehlerfrei durch. gemini-3.5-flash wirft bei ~86% der dialog- und ~72%
der depth-Calls `NoObjectGeneratedError` — der De-Risk-Smoke (1 kurzer Call) hat das verdeckt.
Vermutliche Ursache: gemini ist sehr geschwätzig (529 Token schon beim Mini-Sample) und läuft bei
echten 8-Turn-Samples ins Token-Limit → abgeschnittenes JSON.

**Das Anthropic-Paar (Haiku vs. Sonnet) ist jetzt sauber und deutlich besser als Lauf 1:**

| Dim | Match L1→L2 | κ L1→L2 | Versatz L1→L2 |
|---|---|---|---|
| dialog | 0.34 → 0.69 | 0.06 → 0.08 | −0.72 → −0.21 |
| depth | 0.83 → 0.79 | 0.34 → 0.30 | −0.03 → −0.14 |
| grounding | 0.55 → 0.72 | 0.04 → 0.46 | +0.10 → +0.21 |

Bestätigt: viel „Uneinigkeit" in Lauf 1 war Instrument-Rauschen (Fallbacks), nicht echter Dissens.
dialog-Match fast verdoppelt, grounding-κ ver-10-facht (jetzt „moderate"). depth bleibt Kappa-Paradox
(über zwei Läufe bestätigt). Nominal weiter alles unter κ≥0.61, aber die Anthropic-Kalibrierung ist
jetzt belastbar; der Cross-Vendor-Check hängt allein an gemini-3.5-flash.

**Offen:** (a) Token-Limit-Test für gemini-3.5-flash (dialog/depth deutlich hochsetzen, gemini allein
neu laufen lassen) — wenn die `NoObjectGeneratedError` verschwinden, ist gemini als Cross-Vendor-Judge
nutzbar; sonst anderen Cross-Vendor-Judge wählen. (b) depth-Gate auf prävalenz-adjustiert umstellen.

## Nachtrag: Lauf 3 — Cross-Vendor, self-grading-frei (2026-07-01, Commits f8fa006 + 6da9671)

Rohdaten: `judge-kalibrierung-2026-07-01-crossvendor-excludeself.{md,json}`. Zwei Änderungen:
(1) **Token-Limits angehoben** (dialog 1000→3000, depth 2048→4000, grounding 1200→2500) — Einzel-Test
am 35-Turn-Worst-Case bestätigte die Truncation-Hypothese, `NoObjectGeneratedError` 96→8.
(2) **Exclude-Self** (`EVAL_JUDGE_EXCLUDE_SELF=true`): jedes Gemini bewertet nur Transkripte, die es
NICHT selbst erzeugt hat. gemini-3.5-flash → 18 gemini-3.1-lite-Transkripte + 1 haiku (n=19);
gemini-3.1-flash-lite → 10 gemini-3.5-flash-Transkripte (n=10). Prod-Judge bleibt Haiku (cross-vendor).

Damit ist das Instrument technisch solide (Format valide, self-grading raus). Das verbleibende Signal
ist echt, kein Artefakt.

**Kernbefund dialog — gerichtete Vendor-Milde:**

| Judge | n | ref milder als Haiku | gleich | ref strenger |
|---|---|---|---|---|
| gemini-3.5-flash | 19 | 15 | 4 | 0 |
| gemini-3.1-flash-lite | 10 | 5 | 5 | 0 |

Beide Gemini-Judges sind systematisch milder als Haiku und in KEINEM Fall strenger (20/29 höher,
9 gleich, 0 niedriger). Verdikt-Zahlen: gemini-3.5-flash dialog Match 0.21 / κ 0.03 / Versatz −0.79;
gemini-3.1-flash-lite dialog Match 0.50 / κ 0 / Versatz −0.50. Beide FAIL.

**depth:** hohe Übereinstimmung, aber prävalenz-degeneriert — Werte fast konstant Stufe 2
(gemini-3.1-flash-lite 9×„2/2" + 1×„1/1" → Match 1.0 / κ 1 PASS, aber nicht aussagekräftig;
gemini-3.5-flash 12/19 Match). Kein Vendor-Konflikt, kaum Diskriminierung.

**grounding:** weiter subjektiv/verrauscht über Vendor-Grenze (gemini-3.5-flash Match 0.42 / κ 0.10 /
Versatz +0.58 = Haiku over-flaggt; gemini-3.1-flash-lite κ −0.15). 4 Rest-`NoObjectGeneratedError`.

**Verdikt Checkpoint D Stufe 1 (definitiv):** Die κ≥0.61-Cross-Vendor-Schwelle wird nicht erreicht,
aber aus einem belastbaren Grund — Anthropic- und Google-Judges kalibrieren subjektive Dialogqualität
echt unterschiedlich (Gemini milder), nicht wegen Instrument-Defekten. Genau die Vendor-Blindstelle,
die der Check aufdecken sollte.

**Konsequenzen für den Versuchsplan (separat zu entscheiden):**
1. dialog/grounding-Absolutwerte sind vendor-abhängig → mit einem festen Judge-Vendor kalibrieren
   (Haiku = der konservative/strengere). Absolute Schwellen sind judge-vendor-spezifisch.
2. depth ist über Vendor robust, aber fast konstant Stufe 2 → geringe Aussagekraft; κ-Gate hier
   bedeutungslos (Kappa-Paradox über drei Läufe bestätigt) → prävalenz-adjustiert (PABAK) oder
   Match-Quote statt κ.
3. Die κ≥0.61-Cross-Vendor-Forderung selbst für subjektive Dialogqualität überdenken — perfekte
   Vendor-Übereinstimmung ist hier womöglich unrealistisch.

### Präzisierung: Milde-Spektrum, kein Haiku-Einzelausreißer (Rückfrage 2026-07-02)

Da auch Sonnet milder als Haiku war, die Frage: reißt Haiku als einziger nach unten aus? Absolute
dialog-Mittelwerte (gepaart je Panel, Fallbacks raus):

| Judge | Ø dialog | Δ zu Haiku |
|---|---|---|
| Haiku (prod) | ~0.69 | — (strengster) |
| Sonnet | 0.76 | +0.07 |
| gemini-3.1-flash-lite | 0.84 | +0.16 |
| gemini-3.5-flash | 0.97 | +0.26 |

Es ist ein **Milde-Gradient**, kein einzelner Ausreißer: Sonnet (gleicher Vendor) liegt nur +0.07
über Haiku, die beiden Anthropic-Modelle clustern am strengen Ende; die Geminis sind progressiv
milder. Die vier Werte sind fast gleichmäßig gestaffelt (0.69/0.76/0.84/0.97). Wenn ein Modell
„ausreißt", dann gemini-3.5-flash an der Decke (Ø 0.97 = bewertet fast alles Stufe 3, kaum
Diskriminierung — der schlechtere Judge). Haiku ist nicht „falsch nach unten", sondern der
konservative, trennschärfste Anker (nutzt alle drei Stufen). Das frühere Framing „Gemini mild" war
Haiku-zentriert; korrekt ist „Anthropic streng, Google mild, gemini-3.5 nahe Decke". Caveat:
unterschiedliche Subsets (exclude-self); Haiks Eigenmittel über Subsets stabil (0.67–0.71).
Definitiv klärbar nur mit einem 4-Judge-Paarvergleich auf identischen Transkripten. Fürs Gate ändert
das nichts (Single-Vendor-Kalibrierung), aber gemini-3.5-flash scheidet wegen Deckeneffekt als Judge
ohnehin aus.
