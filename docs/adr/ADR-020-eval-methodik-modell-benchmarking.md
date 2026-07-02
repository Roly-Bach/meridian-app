# ADR-020: Eval-Methodik für Modell-Benchmarking — Rollen-Trennung, geschichtete Instrument-Validierung, Kosten-Attribution, Zwei-Stufen-Provider-Strategie

**Status:** Accepted (2026-06-30)
**Author:** Lias Hemmersbach
**Repository:** meridian-app

## Context

Auslöser war die Frage, ob ein günstigeres oder besseres Open-Source-Modell das aktuelle
Interview-Modell `google/gemini-3.1-flash-lite` ablösen kann. PROJ-9 hat diese Frage im Mai 2026 per
Fremd-Benchmarks (artificialanalysis.ai) entschieden (Nebius als EU-Provider, Kimi K2.6 als
#1-Kandidat), aber nie mit einem eigenen Eval-Lauf validiert.

Beim Durcharbeiten zeigte sich der eigentliche Engpass: Bevor Modelle verglichen werden, muss das
**Messinstrument** stimmen. Im Eval wirken drei Rollen zusammen, von denen zwei nicht der Prüfling
sind, sondern das Werkzeug:

- **Interview** (System under Test): talker, analyst, quick_extract, grounding_guard.
- **Test**: der Persona-Simulator, der den befragten Mitarbeiter nachspielt.
- **Eval**: die Judges, die Qualität in Zahlen übersetzen.

Test und Eval laufen heute auf schwachen Modellen (Gemini-Lite / Claude Haiku). Solange unklar ist,
ob das ausreicht, ist jeder Interview-Modellvergleich fragwürdig.

Zwei Befunde beim Grilling schärften die Lage:

1. Der `grounding_guard` ist eine **Produktions**-Komponente
   ([interviewTalker.ts:266](../../src/services/interviewTalker.ts#L266)), kein reines Eval-Werkzeug.
   Er schickt aus Kundendaten abgeleiteten Text an einen Cross-Vendor-**US**-Judge (Claude/Gemini).
   Damit fällt er unter die EU-Frage, anders als die eval-zeitlichen Judges.
2. Die „sechs Gate-Metriken" stimmen nicht: `evaluateGate()`
   ([runner.ts:368-376](../../src/services/__evals__/interview/runner.ts#L368-L376)) prüft real fünf
   Bedingungen; `hallucination_rate`, `overwrite_churn`, `talker_grounding_violations` stehen mit
   Zielwert nur im Report, gaten aber nicht.

Scope-Schnitt (mit Nutzer entschieden): **PROJ-40** baut das Fundament (Instrument-Validierung +
Versuchsplan), **PROJ-41** wählt anschließend die Modelle aller drei Rollen aus (OSS-Screening,
EU-Prod-Route). Dieser ADR ist die Methodik-Klammer über beide und wird von beiden referenziert.

## Decision

### D1 — Rollen-Trennung und EU-Scope

Die drei Rollen haben unterschiedlichen EU-Status. Die harte EU-Hosting-Pflicht gilt für **alle
Prod-LLM-Calls auf Kundendaten**, nicht nur für das primäre Interview-Modell.

| Rolle | Komponenten | Prod? | EU-Pflicht | Optimierungsziel |
|-------|-------------|-------|-----------|------------------|
| **Interview** | talker, analyst, analyst_online/catchup, quick_extract, **grounding_guard** | ja | **ja, hart** | Qualität/Kosten unter EU-Constraint |
| **Test** | tester (Persona-Simulator) | nein | nein | Realismus, Kosten |
| **Eval** | judge_dialog_naturalness, judge_slot_depth, judge_talker_grounding | nein | nein | Mess-Genauigkeit, Bias-Freiheit, Kosten |

Begründung: Würde nur das Hauptmodell EU-gehostet, aber der `grounding_guard` schickt weiter
Kundendaten-abgeleiteten Text an einen US-Judge, leckt Kundendaten an der Seitentür. Die aktuelle
Gemini-Prod-Nutzung (talker auf Google) ist eine **dokumentierte Altlast**, die PROJ-41 schließt.

### D2 — Prod-Guard unter EU-Pflicht

Der `grounding_guard` behält seinen Cross-Judge zur Bias-Vermeidung (ein Modell darf seine eigene
Ausgabe nicht bewerten), aber beide Seiten werden EU-gehostet: Talker und Guard-Judge sind
unterschiedliche Open-Weight-**Modellfamilien** auf einer EU-Route (z.B. Nebius DeepSeek-Talker +
Nebius Kimi/GLM-Judge). „Cross-Modellfamilie auf EU-Provider" erfüllt Bias-Vermeidung und EU-Pflicht
zugleich.

Folge: zwei getrennte Judge-Selektoren mit unterschiedlichem Constraint:
- **eval-zeitlich** (dialogNaturalness, talkerFactualGrounding, slotDepth): EU-frei, Modellwahl frei.
- **Prod-Guard** (`crossVendorJudgeModel` in
  [talkerGroundingGuard.ts](../../src/services/talkerGroundingGuard.ts)): EU-gebunden, andere
  EU-Familie. Generalisierung von „Gemini-vs-Anthropic" auf „andere EU-Familie" erfolgt in PROJ-41.

### D3 — Geschichtete Instrument-Validierung (Design vor Eignung vor Messung)

Validität hat zwei Schichten, die nicht verwechselt werden dürfen: Ob ein Werkzeug **gut konstruiert**
ist, ist unabhängig davon, ob das Modell, das es ausführt, **stark genug** ist. Eine Judge-Kalibrierung
(schwacher vs. starker Judge) prüft nur die Ausführung, nicht ob die Rubrik überhaupt etwas Sinnvolles
misst: zwei Judges können sich über eine nutzlose Metrik einig sein.

Daraus folgt eine dreistufige Validierung, jede Stufe ist hartes Gate für die nächste:

1. **Werkzeug-Design-Validität** (modellunabhängig):
   - Metriken/Rubriken: Misst jede Metrik etwas Sinnvolles? Robust, nicht gameable, nicht redundant?
     Gehört sie ins Gate oder nur in den Report? (vgl. Befund `evaluateGate` oben)
   - Persona-Design: realistisch, vollständig, nicht trivial-kooperativ?
   - Tester-System-Prompt: sauber konstruiert, kein Über-Kooperieren, kein Datenleck?
2. **Modell-Eignung** (gegeben valides Werkzeug):
   - Judge-Kalibrierung: Übereinstimmung schwacher Produktions-Judge vs. starker Referenz-Judge auf
     einer Stichprobe.
   - Tester-Stabilität: bleibt die Reihenfolge der Interview-Modelle stabil über Tester-Stärke?
3. **Benchmarking** (PROJ-41): der eigentliche Modellvergleich.

Hartes Gate auf jeder Stufe. Die **konkreten Schwellen** (z.B. Übereinstimmungsquote, Stabilitätsband)
stehen im Versuchsplan (D6), nicht in diesem ADR, damit sie ohne Supersedes-ADR nachjustierbar bleiben.
Reparatur ist günstig: Test/Eval haben keine EU-Pflicht, ein schwaches Werkzeug oder Modell lässt sich
direkt ersetzen.

### D4 — Kosten-Attribution: Dreiteilung Interview / Test / Eval

Heute trennt `computeCostSummary` nur Interview/Eval; der Tester wird gar nicht erfasst (kein
`onTokenUsage` am Simulator-Call). Künftig drei Töpfe. Der `grounding_guard` ist bereits korrekt im
Interview-Bucket ([runner.ts:62](../../src/services/__evals__/interview/runner.ts#L62)), konsistent zu
D1. `MODEL_PRICING` wird pro **vollem `provider/model`-String** geführt mit realen Provider-Preisen
(dasselbe Modell kostet je Provider bis zu 10x unterschiedlich; unbekannte Modelle fallen sonst still
auf Gemini-Lite-Preise zurück und verfälschen jeden Vergleich).

Zweck: die Kosten des Modells unter Test (Interview) sauber vom konstanten Tester und vom
Judge-Overhead trennen, damit die Ersparnis eines günstigen Modells nicht im fixen Overhead untergeht.

### D5 — Zwei-Stufen-Provider-Strategie (für PROJ-41 vorentschieden)

- **Stage 1, Screening:** OpenRouter als ein-Key-Aggregator, breite Shortlist gegen die Baseline,
  synthetische Personas, EU-unkritisch. OpenRouter ist strikt eval-only.
- **Stage 2, Prod-Validierung:** der Finalist auf seiner EU-Route (Nebius/Fireworks/Novita) erneut
  evaluiert. Schließt zugleich die Eval/Prod-Lücke (gleiches Gewicht kann auf anderem Backend durch
  Quantisierung/Sampling anders performen).

Ein Modell ohne EU-Route darf gescreent werden, kann aber nie Prod-Modell der Interview-Rolle werden.

### D6 — Versuchsplan als eigenes Dokument

`docs/evals/versuchsplan-modell-benchmarking.md`, referenziert von Spec und diesem ADR. Inhalt:
Faktoren, Stufen, Zielgrößen (validierte Metriken + Latenz + Kosten je Bucket), Kontrollen (konstant
gehaltene Größen), Replikation (runs x seeds), Analyse + Entscheidungsregel, sowie die konkreten
Schwellen aus D3.

## Consequences

**Positiv:**
- Modellvergleichs-Ergebnisse werden vertrauenswürdig, weil das Messinstrument vor der Messung
  validiert ist (Design und Modell-Eignung getrennt geprüft).
- EU-Datenschutz konsistent: kein Kundendaten-Leck über den Prod-Guard als Seitentür.
- Kosten je Rolle isolierbar, fairer Modellvergleich trotz fixem Test/Eval-Overhead.
- Klare Arbeitsteilung PROJ-40 (Instrument) vor PROJ-41 (Auswahl).

**Negativ:**
- Mehr Vorlauf: das große Benchmarking startet erst nach drei bestandenen Validierungsstufen.
- Stärkere Referenz-Judges und Tester-Stabilitätsläufe erhöhen die Eval-Kosten der Fundament-Phase.
- Der Prod-Guard braucht künftig eine EU-Familie als Judge; die heutige Cross-Vendor-Logik
  (Gemini/Anthropic) muss generalisiert werden, sonst ist der Guard unter EU nicht betreibbar.

**Folgeentscheidungen / offene Punkte:**
- PROJ-40 (Revision, Extends PROJ-31, Domain Interview Engine): realisiert D3, D4, D6 plus
  Metrik-Audit. `/write-spec PROJ-40` setzt um, entscheidet nicht neu.
- PROJ-41 (Revision, Extends PROJ-9, Domain Platform): realisiert D2, D5 und die Modellauswahl aller
  drei Rollen. (Re-Mapping ggü. erster Annahme: die Provider-Revision ist PROJ-41, nicht PROJ-40.)
- EU-Status von Fireworks (Frankfurt-DC, US-Mutter, CLOUD-Act-Frage) und Novita ist offen, Recherche
  in PROJ-41.
- Latenz/TTFT als Zielgröße: Messbarkeit im DB-freien `pglite`-Eval ist offen (synthetischer Tester,
  keine echte Netz-Latenz), Klärung im Versuchsplan.
- KI-18 (Prod-Guard, zurückgestellt) ist mit D2 verknüpft: die EU-Judge-Anforderung wird zur
  Randbedingung, sobald der Guard wieder aktiv verifiziert wird.

## Nachtrag (2026-06-30): Produkt-Refokus auf KI-Potenzial

> Amendment, nicht Änderung. D1–D6 bleiben unverändert gültig. Dieser Nachtrag hält eine
> Produktentscheidung fest, die das Optimierungsziel der Eval verschiebt und im PROJ-40-Metrik-Audit
> aufkam.

Der Prototyp fokussiert auf den KI-Potenzial-Aspekt (relevante Stellen + Abhängigkeiten +
quantitative Potenzial-Facetten als ROI-Eingang); der Wissensverlust-/Wissensmanagement-Aspekt
(vollständige + tiefe Gesamterfassung) ist zurückgestellt (siehe PRD „Prototyp-Fokus").

**Konsequenz für die Eval-Metriken** (Details + 6-Achsen-Audit in
`docs/evals/instrument-validierung/metrik-audit.md`):

- Befund: das heutige Gate zentriert auf `dedupSlotCoverage`, das die 9 taziten/strukturellen Felder
  zählt und die **Potenzial-Facetten** (`frequency_per_month`, `duration_minutes`, `error_rate_percent`,
  `media_breaks`) explizit ausschließt — also die eigentlichen ROI-/Automatisierbarkeits-Signale.
- Beschluss (Batch 2): neue Metrik `potenzialCoverage` (ROI-Facetten-Erfassung) ergänzen, erst
  berichten, Gate-Schwelle nach erstem Benchmark datengestützt setzen; eigene
  Abhängigkeits-Erfassungs-Metrik; `conversationalEfficiency` (Turns/Slots) als Versuchsplan-Zielgröße.
- `dedupSlotCoverage` bleibt im Gate (Erkundungs-Breite, überwiegend automatisierbarkeits-relevante
  Felder), `slotDepth` bleibt relevant, aber auf automatisierbarkeits-entscheidende Felder fokussiert
  (Gate-Kandidat erst nach Persona-Anreicherung mit KI-Kandidaten-Ground-Truth, Checkpoint C).
- `hallucination_rate`: nicht ins Gate; der grobe 10-Zeichen-Prefix-Prüfer wird auf semantische bzw.
  Span-Vertrauens-Prüfung umgebaut (string-genaues Zitat-Matching ist im LLM-Kontext der falsche Test).
- `schemaConformanceRate`: Diagnose (capture-then-normalize), kein harter Gate-Floor.

## Nachtrag (2026-07-02): Judge-Kalibrierung Single-Vendor, Cross-Vendor-Referenz zurückgezogen

> Amendment, nicht Änderung. D1–D6 bleiben gültig. Hält das empirische Ergebnis von Checkpoint D
> Stufe 1 (Läufe 1–3) fest und dessen Folge für die Stufe-1-Kriterien. Details:
> `docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md`, Schwellen im Versuchsplan (D6 §6).

D3.2 verlangt für die Judge-Kalibrierung „schwacher Prod- vs. starker Referenz-Judge" — vendor-agnostisch
formuliert. Die praktische Umsetzung zielte zunächst auf einen **Cross-Vendor**-Referenz-Judge
(gemini-3.5-flash), um zusätzlich die Vendor-Unabhängigkeit im Sinne von D1 zu prüfen. Drei
Kalibrierungsläufe auf der fixierten Stichprobe zeigen, dass das nicht trägt:

- **Kein tauglicher Cross-Vendor-Judge verfügbar.** gemini-3.5-flash hat einen Deckeneffekt (Ø dialog
  0.97, benotet fast alles Stufe 3, kaum Diskriminierung) und ist als Judge unbrauchbar. Der einzige
  andere EU-freie Google-Kandidat, gemini-3.1-flash-lite, ist das Interviewer-Modell — es seine eigenen
  Transkripte benoten zu lassen wäre Selbst-Bewertung.
- **Die uniforme Cross-Vendor-`κ ≥ 0.61`-Forderung ist für subjektive Dialogqualität unrealistisch.**
  Gemessen wurde ein echter Vendor-Milde-Gradient (Haiku 0.69 → Sonnet 0.76 → gemini-3.1 0.84 →
  gemini-3.5 0.97), kein Instrument-Defekt. Anthropic kalibriert streng, Google mild. Perfekte
  Vendor-Übereinstimmung bei einer subjektiven Rubrik ist kein sinnvolles Validitätskriterium.

**Beschluss:** Die Stufe-1-Judge-Kalibrierung läuft **Single-Vendor** — Prod-Judge `claude-haiku-4-5`
(konservativer Anker), Referenz-Judge `claude-sonnet-4-5` (same-vendor Frontier) als reiner
Stärke-Check nach D3.2. Die Cross-Vendor-**Referenz** für die Eval-Judge-Kalibrierung ist
zurückgezogen, reaktivierbar per `EVAL_REFERENCE_JUDGE_MODELS`, sobald ein tauglicher Google/OpenAI-
Judge existiert. Das Kriterium wird pro Dimension rollen-/skalen-gerecht statt uniform-κ (dialog:
Match + Adjazenz + Versatz; depth: PABAK; grounding zu Diagnose deklassiert — Versuchsplan §6).

**Abgrenzung:** Das betrifft ausschließlich den **eval-zeitlichen Judge** (Stufe 1). Die
Cross-Vendor-Anforderung an den **Prod-Guard** (`grounding_guard`, D2 — ein Modell darf seine eigene
Ausgabe nicht bewerten, plus EU-Familie) bleibt unberührt; sie hängt an KI-18, nicht an dieser
Kalibrierung.
