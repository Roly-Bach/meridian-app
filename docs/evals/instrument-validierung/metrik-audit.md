# Metrik-Audit (PROJ-40 Kriterium A)

> Status: **Empfehlungen, Freigabe ausstehend.** Die Umsetzung der hier entschiedenen
> Gate-Revision und neuen Scorer ist Batch 2 (autonom, nach Freigabe). Dieses Dokument
> entscheidet nur, was getan wird, nicht wie es codiert wird.
>
> Erstellt: 2026-06-30. Quelle: Code-Review aller 15 Scorer + `evaluateGate` + `computeTrailMetrics`.

## 1. Inventar — 6-Achsen-Bewertung

Achsen: **V** Validität (misst es, was es behauptet?) · **S** Schwellen-Herkunft (empirisch/aspirational/arbiträr?) · **Se** Sensitivität (kann es Modelle trennen?) · **R** Redundanz · **G** Gate-Zugehörigkeit (ist/soll) · **B** Benchmark-Eignung für PROJ-41.

| Scorer | Typ | V | S | Se | R | G (ist) | B | Entscheidung |
|--------|-----|---|---|----|----|---------|---|-------------|
| completionCorrectness | determ. bool | hoch — harte Anforderung | binär, kein Schwellenproblem | grob (0/1), aber korrekt als Floor | keine | **im Gate** (===true) | Floor, kein Diskriminator | **behalten, Gate** |
| dedupSlotCoverage | determ. 0–1 | hoch — Extraktionsbreite, fragmentierungs-robust | 0.75 empirisch (Läufe 0.89–0.96 erreichbar, KI-12/15) | gut, kontinuierlich | Twin von slotCoverage | **im Gate** (≥0.75) | stark | **behalten, Gate** |
| slotCoverage | determ. 0–1 | mittel — durch Step-Fragmentierung verzerrt | 0.75 (nicht gegatet) | **Twin von dedup** | nein | schwach allein, Gap diagnostisch | **behalten als Diagnose** (s. §2.1) |
| stepRegistrationCoverage | determ. 0–1 | hoch — wurden erwartete Prozesse gefunden | 0.8 aspirational, persona-abhängig | mittel (hängt an expectedProcessCount) | keine | **im Gate** (≥0.8) | mittel | **behalten, Gate** |
| dialogNaturalness | LLM-Judge 0.33/0.67/1.0 | mittel — subjektiv, cross-vendor entschärft | 0.65 empirisch dokumentiert (KI-5, →Stufe 2) | keine | **im Gate** (≥0.65) | mittel (3 Stufen grob) | **behalten, Gate** |
| slotDepth | LLM-Judge 1–3 + Verteilung | hoch — Tiefe (tazit/kausal) | kein Schwellwert (maximize) | keine | nein | **stark** — Kern-Diskriminator | **behalten, in Versuchsplan-Zielgrößen** |
| talkerFactualGrounding | LLM-Judge Count | hoch im Ziel, **unzuverlässig in Umsetzung** | Ziel 0 | Count, aber Fallback-0-Bug | nein (nur berichtet) | bedingt — erst nach Fix | **behalten, NICHT promoten** (s. §2.2, §4) |
| hallucinationRate | determ. 0–1 | mittel — grober 10-Zeichen-Prefix-Proxy | <0.01 sehr streng | brüchig (Einzel-False-Positive kippt) | überlappt toolCallPlausibility | nein (nur berichtet) | mittel | **behalten; Promotion mit gelockerter Schwelle prüfen** (§4) |
| blockedRate | determ. 0–1 (Trail) | mittel — Write-Pfad-Konflikte, prompt-compliance | <0.1 empirisch (KI-17) | keine | **im Gate** (<0.1) | mittel — Prozess- nicht Output-Signal | **behalten, Gate** (Inkonsistenz dokumentiert, §4) |
| overwriteChurn | determ. 0–1 (Trail) | mittel — Quick-Extract-Churn | <0.20 (KI-10-korrigiert) | keine | nein (nur berichtet) | schwach als Gate, ok als Diagnose | **behalten als Diagnose, NICHT promoten** (§4) |
| confidenceTrigger | determ. 0–1 \| null | mittel — Nachfass-Disziplin | >0.80 | oft `null` (kein Signal) | nein | schwach (häufig null) | **behalten als Diagnose** |
| anchoringViolations / -Rate | determ. Regex-Count | niedrig — brüchige DE-Pattern-Liste | Ziel 0 | keine | nein | schwach (Paraphrase entkommt) | **behalten als Diagnose, nicht gate-fähig** |
| phaseAdherence | determ. Regex 0–1 | niedrig — Regex, nur Diagnose | maximize | keine | nein (2026-06-08 entfernt) | schwach | **behalten als Diagnose** |
| phaseProgression | determ. 0–1 | mittel — bestraft kurze effiziente Interviews | maximize | keine | nein (bewusst entfernt) | irreführend als Gate | **behalten als Diagnose** |
| schemaConformanceRate | determ. 0–1 | hoch — Schema-Validierung je Schritt | 1.0 | keine | nein | mittel-stark (harte Korrektheit) | **behalten; Promotion prüfen** (§4) |
| toolCallPlausibility | determ. 0–1 | mittel — Jaccard/Span-Grounding | ≥0.70 (von 0.95 gesenkt, real 0.72–0.87) | **überlappt hallucinationRate** | nein | mittel | **behalten; Überlapp mit hallucinationRate klären** (§2.3) |

## 2. Redundanz-Auflösung

### 2.1 slotCoverage vs. dedupSlotCoverage → **behalten beide**
Gleiches Feld-Set; `dedup` gruppiert semantisch äquivalente Schritte (Schwelle 0.2) VOR der Zählung, `raw` nicht. `dedup` ist strikt die fairere Variante und gatet bereits allein. **Nicht zusammenführen, nicht entfernen:** der Abstand `dedup − raw` ist ein kostenloses Fragmentierungs-Signal (ein Modell, das denselben Prozess in mehrere Schritte zersplittert, ist schlechter). Empfehlung: `raw` bleibt Diagnose, der Gap wird im Report als expliziter Fragmentierungs-Indikator ausgewiesen. `raw` darf nie allein gaten.

### 2.2 hallucinationRate vs. talkerFactualGrounding → **behalten beide (nicht redundant)**
Verschiedene Fehlermodi, verschiedene Ebenen:
- `hallucinationRate` (determ.): prüft, ob **gespeicherte Slot-Zitate** im Transkript vorkommen → Extraktions-Fabrikation.
- `talkerFactualGrounding` (LLM): prüft, ob der **Talker im Gespräch** eine falsche Prämisse behauptet ("Du hast vorhin X erwähnt") → Konversations-Fabrikation.

Der KI-9-Kommentar sagt explizit, `hallucinationRate` sei „blind" für den Talker-Modus. Keine Redundanz. **Aber:** `talkerFactualGrounding` ist aktuell nicht benchmark-reif (s. §4, KI-18: Parser-Fallback auf 0 = stille False-Negatives; Live-Guard fängt reale Fabrikationen nicht).

### 2.3 Dritter, ungenannter Überlapp: hallucinationRate vs. toolCallPlausibility
Beide prüfen deterministisch Evidence-Grounding gegen User-Input. Unterschied: `toolCallPlausibility` bewertet je `record_slot`-Call zur Schreibzeit (Span-Vertrauen + Jaccard), `hallucinationRate` prüft finale gespeicherte Slots (10-Zeichen-Prefix). Das ist die stärkere reale Redundanz als das in der Spec genannte Paar 2. Empfehlung: **behalten beide, aber im Versuchsplan nur EINES als primäres Grounding-Signal** führen (Vorschlag: `hallucinationRate`, weil end-state-orientiert), `toolCallPlausibility` als Diagnose. Zur Freigabe (§6, Frage 2).

## 3. Coverage-Lücken — was KEINE Metrik erfasst

| Dimension | Heute erfasst? | Versteckt es einen Modellunterschied? | Vorschlag |
|-----------|----------------|---------------------------------------|-----------|
| **Konversations-Effizienz** (Turns bis Completion, Slots/Turn) | nein (phaseAdherence misst nur Re-Ask-Schleifen, grob) | **ja, stark** — 18 vs. 35 Turns für dieselben Daten = schlechter + teurer | **NEUE Metrik** `conversationalEfficiency` (§3.1) |
| **Latenz / TTFT** | nein | ja (UX + Kosten) | Im pglite-Eval nicht messbar (synthetischer Tester, Buffer-then-stream-Talker). PROJ-41 Stage-2 gegen echte API (§5) |
| Themen-/Schritt-Breite | teilweise (stepRegistrationCoverage = Anzahl, nicht Breite) | gering | keine neue Metrik |
| Tiefe vs. Breite gemeinsam | getrennt (slotDepth / slotCoverage) | gering | keine neue Metrik, ggf. im Report gegenüberstellen |
| Fortschritt pro Turn | nein | mittel | von `conversationalEfficiency` mit abgedeckt |

### 3.1 Neue-Metrik-Vorschlag: `conversationalEfficiency`
Deterministisch, LLM-frei, aus vorhandenen `TurnRecord[]` + finalem Tracker berechenbar. Kandidaten-Definition: `gefüllte Pflicht-Slots / Turns-bis-Completion` (Slots pro Turn), plus Roh-`turnsToCompletion`. Begründung: Turn-Zahl skaliert direkt mit Kosten und UX; ein Modell, das effizienter extrahiert, ist ein echter Gewinner, den heute keine Metrik sieht. **Implementierung wäre Batch 2** (Scorer + ScoreSet-Feld + Test), erst nach Freigabe. Nicht ins Gate (Diskriminator, kein Pass/Fail-Floor), aber als Versuchsplan-Zielgröße.

## 4. Gate-Revision

### Bestehende Bedingungen — Schwellen-Begründung
| # | Bedingung | Schwellen-Herkunft | Bewertung |
|---|-----------|--------------------|-----------|
| 1 | `completionCorrectness === true` | harte Anforderung | korrekt, behalten |
| 2 | `dedupSlotCoverage ≥ 0.75` | empirisch (real 0.89–0.96; 0.75 = Unterexplorations-Floor). Historisch dominanter FAIL-Grund (KI-12) | behalten |
| 3 | `stepRegistrationCoverage ≥ 0.8` | aspirational, persona-abhängig (alle-bis-auf-einen Prozess) | behalten, Herkunft als „aspirational" markiert |
| 4 | `dialogNaturalness ≥ 0.65` | empirisch dokumentiert (KI-5, 0.70→0.65 = Stufe 2) | behalten |
| 5 | `blockedRate < 0.1` | empirisch (KI-17) | behalten; **Inkonsistenz:** einziges Write-Pfad-/Prozess-Signal im sonst output-qualitäts-orientierten Gate — vertretbar, weil es reale Prompt-Compliance-Lücken aufdeckt, aber dokumentiert |

### Promotion-Entscheidungen (die drei nur-berichteten Faktentreue-Metriken)
| Metrik | Empfehlung | Begründung |
|--------|-----------|-----------|
| `hallucination_rate` | **Promoten, aber Schwelle auf < 0.05 statt < 0.01** | Deterministisch, Fabrikation ist harte Qualitätsverletzung → gehört ins Gate. Aber `<0.01` kippt bei einem einzigen False-Positive des groben 10-Zeichen-Prefix-Matchers (mit 20–40 Slots/Interview = Nulltoleranz). `<0.05` toleriert genau einen Matcher-Fehlgriff, ohne echte Fabrikation durchzulassen. Freigabe nötig (§6 Frage 3). |
| `talker_grounding_violations` | **NICHT promoten** (blockiert durch KI-18) | LLM-Judge mit `console.warn ... fallback 0` bei Parse-Fehler. `==0`-Gate würde einen Parse-Fehler als PASS werten = False Pass. Erst KI-18 fixen: Fallback darf nicht 0 sein, sondern muss als „kein Urteil" markiert/exkludiert werden. Promotion nach Fix erneut prüfen. |
| `overwrite_churn` | **NICHT promoten** (Diagnose belassen) | Misst Write-Pfad-Churn, nicht Output-Qualität. Wenn finale Slots korrekt sind (dedupSlotCoverage greift), bestraft ein Churn-Gate dieselbe Eigenschaft doppelt und kann hochwertige Läufe wegen reiner Prozess-Unruhe FAILen. Bleibt aussagekräftige Diagnose. |

### Zusätzlicher Promotions-Kandidat: `schemaConformanceRate`
Nicht in der Spec-Liste, aber deterministisch, hohe Validität, harte Korrektheit (Schema-Verstoß = strukturell kaputter Schritt). **Erwägung:** Promotion mit `== 1.0` oder `≥ 0.9`. Zur Freigabe (§6 Frage 4) — konservativ wäre, es zunächst berichtet zu lassen und nach einem Benchmarking-Lauf die reale Verteilung zu sehen.

### Gate nach Revision (Empfehlung, pending Freigabe)
```
completionCorrectness === true
dedupSlotCoverage        ≥ 0.75
stepRegistrationCoverage ≥ 0.8
dialogNaturalness        ≥ 0.65
blockedRate              < 0.1
hallucinationRate        < 0.05   ← NEU (Freigabe)
```

## 5. Latenz / TTFT
Im pglite-Eval **nicht aussagekräftig messbar:** der Tester ist synthetisch (keine echte Netz-Latenz), und der Talker läuft seit KI-18-Fix 3 als Buffer-then-stream (`generateText`), TTFT ist also nicht repräsentativ. **Entscheidung:** Latenz/TTFT NICHT im pglite-Eval erheben; als Antwortvariable in PROJ-41 Stage-2 gegen die echte Provider-API messen (deckt sich mit Spec-Edge-Case und ADR-020).

## 6. Betroffene historische Läufe (Edge Case)
Die Gate-Revision (Promotion `hallucination_rate < 0.05`) kann bestehende PASS-Läufe kippen. Stichprobe nötig vor Finalisierung: Läufe mit `hallucination_rate ≥ 0.05` würden retroaktiv FAIL. Bekannt aus KI-16: ein buchhalter-Lauf (2026-06-26 run3) hatte 0.17 (vor Fix). Nach KI-16-Fix liegen Läufe bei 0–0.04, also unter 0.05 → Revision kippt die jüngsten Läufe voraussichtlich nicht. Vor Batch-2-Umsetzung gegen den aktuellen Korpus gegenprüfen.

## 7. Offene Entscheidungen für Freigabe
1. **Redundanz-Paar 1** (slotCoverage/dedup): behalten beide, raw als Diagnose + Gap-Ausweis. → bestätigen?
2. **Grounding-Überlapp** (hallucinationRate/toolCallPlausibility): hallucinationRate als primär, toolCallPlausibility als Diagnose. → bestätigen?
3. **hallucination_rate ins Gate** bei `< 0.05`? (Alternative: nicht promoten / oder `<0.01` behalten)
4. **schemaConformanceRate ins Gate** bei `== 1.0`/`≥0.9`, oder vorerst berichtet lassen?
5. **conversationalEfficiency** als neue Batch-2-Metrik bauen? (nicht Gate, Versuchsplan-Zielgröße)
6. **talker_grounding_violations / overwrite_churn**: Empfehlung „nicht promoten" bestätigen?

## 8. Beschlossene Entscheidungen (nach Produkt-Refokus, 2026-06-30)

> Diese Entscheidungen sind mit dem Nutzer abgestimmt und **superseden** die Empfehlungen in §4/§7,
> wo sie abweichen. Auslöser: Produkt-Refokus auf KI-Potenzial-Analyse (Wissensmanagement
> zurückgestellt), festgehalten in PRD „Prototyp-Fokus" + [ADR-020 Nachtrag](../../adr/ADR-020-eval-methodik-modell-benchmarking.md).
> Umsetzung = Batch 2 (autonom).

### 8.1 Refokus-Befund
Das Gate zentriert auf `dedupSlotCoverage` = die 9 taziten/strukturellen Felder; die
**Potenzial-Facetten** (`frequency_per_month`, `duration_minutes`, `error_rate_percent`,
`media_breaks`) — die eigentlichen ROI-/Automatisierbarkeits-Eingänge — werden von keiner
Coverage-Metrik gezählt ([interviewSemantic.ts:334](../../../src/services/interviewSemantic.ts#L334)).
Die Eval optimiert damit das zurückgestellte Ziel (tazite Vollständigkeit), nicht das primäre
(KI-Potenzial). Das ist der Kern-Befund des Audits.

### 8.2 Kritische Einordnung der Coverage-/Depth-Frage (Nutzer-Einwand)
- **Coverage bleibt gate-relevant.** Die 9 Felder sind nicht uniform Wissensmanagement:
  `entscheidungslogik` (regelbasiert?), `hilfsmittel` (Systeme), `inputs`/`outputs` (Datenfluss),
  `abhaengigkeiten` sind automatisierbarkeits-relevant; nur `tazite_cues`/`ausnahmen` lehnen an
  Wissensmanagement. Coverage misst überwiegend Erkundungs-Fähigkeit → bleibt im Gate. Der Defekt ist
  der Ausschluss der Potenzial-Facetten, nicht die Aufnahme taziter Felder.
- **Depth bleibt relevant, fokussiert.** Um KI-Potenzial zu erkennen, braucht es Tiefe: Rubrik Stufe 1
  („keine Bedingung") erlaubt kein Automatisierbarkeits-Urteil; erst Stufe 2/3 (Bedingung,
  Kausalstruktur, Ausnahme) zeigt regelbasiert vs. Ermessen. `slotDepth` wird nicht degradiert,
  sondern auf automatisierbarkeits-entscheidende Felder fokussiert; Gate-Kandidat erst nach
  Persona-Anreicherung (Checkpoint C).

### 8.3 Metrik-Beschlüsse
| Metrik | Beschluss | Wann |
|--------|-----------|------|
| `potenzialCoverage` (NEU) | bauen, erst berichten, Gate-Schwelle nach erstem Benchmark (datengestützt) | Batch 2 |
| Abhängigkeits-Erfassung (NEU) | eigene Metrik (statt 1/9-Verwässerung in Coverage) | Batch 2 |
| `conversationalEfficiency` (NEU) | bauen, Versuchsplan-Zielgröße, kein Gate | Batch 2 |
| `dedupSlotCoverage` | bleibt im Gate (Erkundungs-Breite) | unverändert |
| `slotDepth` | bleibt, fokussiert auf Automatisierbarkeits-Felder; Gate erst nach Persona-Anreicherung | Batch 2 / C |
| `hallucination_rate` | **nicht** ins Gate; Prüfer von 10-Zeichen-Prefix auf semantisch/Span-Vertrauen umbauen | Batch 2 |
| `schemaConformanceRate` | Diagnose (capture-then-normalize), kein Gate | unverändert |
| `talker_grounding_violations` | nicht promoten (KI-18: Fallback-0-Bug zuerst fixen) | — |
| `overwrite_churn` | nicht promoten (Prozess-Diagnose, kein Output-Floor) | — |
| `slotCoverage` (raw) / `toolCallPlausibility` | Diagnose; Grounding-Primär = `hallucination_rate` (nach Prüfer-Fix) | unverändert |

### 8.4 Gate nach Revision (Ziel, Schwellen teils datengestützt offen)
```
completionCorrectness    === true
stepRegistrationCoverage ≥ 0.8
dedupSlotCoverage         ≥ 0.75
dialogNaturalness         ≥ 0.65
blockedRate               < 0.1
potenzialCoverage         ≥ ?      ← NEU, Schwelle nach erstem Benchmark
```
Anmerkung: `hallucination_rate` und `slotDepth` sind Gate-*Kandidaten*, aber blockiert (Prüfer-Umbau
bzw. Persona-Anreicherung). Bis dahin berichtet, nicht gegatet.

### 8.5 Persona-Anreicherung nötig (Checkpoint C, nicht Batch 2)
Heute nicht messbar mangels Ground Truth (`ProcessEntry` hat nur Freitext-`frequency`): Korrektheit
der KI-Kandidaten-Identifikation, Korrektheit der Potenzial-*Werte*, Abhängigkeits-*Korrektheit*.
Diese brauchen angereicherte Personas mit KI-Kandidaten-Labels, Soll-Potenzial-Werten und
Soll-Abhängigkeiten. Gehört in den Persona-/Tester-Design-Strang.
