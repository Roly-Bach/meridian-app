# Build Order — Historie (Etappen 1–5)

> Aus `features/INDEX.md` ausgelagert am 2026-07-24 (Joint-Gate-Cleanup), um den Index schlank zu halten. Enthält die vollständigen Etappen-Narrative inkl. In-Progress-Build-Logs (jetzt historisch — kanonischer Feature-Stand steht je Spec + ADR). Verlustfrei.

PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

> **Status-Banner (Joint-Gate 2026-07-24):** Etappe 2–5 sind abgeschlossen. PROJ-42/43/44/46/48 wurden im Joint-Gate PROJ-40/42/43/44/46/48 auf **Approved** gesetzt (PROJ-45 bereits Deployed 2026-07-22, PROJ-40 Approved). Die In-Progress-Build-Logs in Etappe 4/5 unten sind **historisch** — der kanonische Stand steht je Feature in der Spec + im jeweiligen ADR (ADR-021..026). Sie bleiben aus Thesis-Traceability-Gründen erhalten, sind aber kein aktueller Arbeitsstand mehr.

### Etappe 2 (Build-Backlog, ab 2026-06-16)
Schema zuerst (Fundament, blockt den Rest): PROJ-25 → PROJ-27 → PROJ-26.
Reihenfolge 2026-06-16 angepasst: PROJ-27 (stabile Schritt-IDs) vor PROJ-26 (getypte Kanten),
damit PROJ-26 S001-Format-Referenzen von Anfang an nutzen kann statt titel-basierter Zwischenlösung.
Darauf aufbauend: PROJ-28 (Extraktion) und PROJ-29 (Gesprächsführung).
Parallel und laufend mitmessend: PROJ-30 (Tiefe-Metrik) und PROJ-31 (Eval-Schärfung).
Vertagt (TF3): PROJ-32.

Hinweis: Die Bau-ADR zu PROJ-25 ist entschieden ([ADR-T016](../../meridian-ma/decisions/ADR-T016-prozesswissens-schema-integration.md),
2026-06-16): ein gemeinsames Schema mit getrennt getypter quantitativer `potenzial`-Facette im selben
Dokument (nicht zwei verknüpfte Ebenen); das bestehende Slot-Substrat wird behalten und erweitert
(nicht verworfen). Ziel-Schema: [`schemas/prozessschritt-schema.json`](../../meridian-ma/schemas/prozessschritt-schema.json)
+ [Spec v1.1](../../meridian-ma/knowledge-base/prozessschritt-schema-spec.md). `/write-spec PROJ-25`
realisiert dagegen, entscheidet die Architektur nicht neu. Die acht Einheiten bündeln 23 Einzel-Befunde
aus dem [Build-Backlog](../../meridian-ma/requirements/build-backlog-etappe2.md); jede Spec listet ihre
BL-E-Items und REQs (Traceability).

### Etappe 3 (Deepening, ab 2026-06-18)
Architektur-Review 2026-06-18 (`/improve-codebase-architecture`) fand vier Deepening-Kandidaten.
Gewählt und entschieden: PROJ-33 (Turn-Loop-Konsolidierung, [ADR-016](../docs/adr/ADR-016-interview-turn-seam-runinterviewturn.md)) —
`runInterviewTurn` als tiefes Modul, Prod-Route und Eval-Runner werden Adapter. Vertagt als ein
kohärenter Folge-Kandidat: PROJ-34 (Werkzeug-Schreibabsichten + TurnStore-Port für DB-freie Evals).
Weitere Kandidaten aus dem Review als Roadmap festgehalten: PROJ-35 (`interviewAgent.ts` entkernen —
#2+#3) und PROJ-36 (ProcessStepsTable Cluster-Aggregation, #4).
Specs folgen erst bei Bau-Start (je `/write-spec` mit Grilling); Begründungen in ADR-016.
PROJ-35 ist 2026-06-19 spezifiziert (Planned, [ADR-017](../docs/adr/ADR-017-interviewagent-zerlegung-server-only-naht.md)):
Zerlegung entlang der server-only-Naht, conversation-signals als tiefes Modul (`analyzeConversationSignals`,
Interface 9→1), Re-Export-Hub (#3) bewusst verworfen zugunsten Konsumenten-Migration.
PROJ-37 (Static-Prompt-Drift Talker vs. Greeting/Reconnect) wurde 2026-06-19 beim PROJ-35-Grilling
entdeckt: `STATIC_PROMPT` (interviewTalker) und `buildStaticPrompt()` (interviewAgent → createInterviewStream)
sind inhaltlich auseinandergelaufen. Out of Scope für PROJ-35 (reine Verschiebung, keine Prompt-Konsolidierung).

### Etappe 4 (Grenzfall-Robustheit, ab 2026-07-15)
PROJ-42 (Wrap-up + Rollen-Guard) und PROJ-43 (Elicitation-Reorientierung) aus der
Refactoring-Grundsatzentscheidung 2026-07-15 (realer Tim-Durchlauf). PROJ-42s BUG-2/3/5 sind
2026-07-16 gefixt und live verifiziert; dabei ein neuer Bug (BUG-6, doppelte Verabschiedung)
gefunden, der dieselbe Ein-Turn-Zustandsverzögerung wie BUG-1/BUG-4 als Root Cause hat.

**Reihenfolge 2026-07-16 umgekehrt + PROJ-44 spezifiziert:** PROJ-44 (Pipeline-Simplifikation:
Analyst synchron vor Talker, Quick-Extract raus, Legacy-Pfad weg) wird VOR PROJ-43 gebaut.
2026-07-16 nach `/write-spec` + `/grilling` spezifiziert (Planned,
[spec](interview-engine/PROJ-44-pipeline-simplifikation.md)). Schnitt-Entscheidung: **Option 1**
(schmaler Timing-Flip + Streichungen, sauber eval-attribuierbar) statt alle Änderungen in einem.
PROJ-44 behebt strukturell **BUG-1-Staleness + BUG-6** (beide Lag-Artefakte). NICHT in PROJ-44:
**BUG-4** (Methodik-Block-Gedächtnis, kein reines Lag-Artefakt) und die Judgment-Signal-Migration
ins Analyst-Briefing → neues Folge-Feature **PROJ-46** (Talker-Briefing-Konsolidierung, Requires
PROJ-44, auch: Audit der statischen Text-Ausgaben). BUG-1-Kalibrierung (`step_advance_ready` zu
großzügig) + Clarification-Cards-Zuverlässigkeit bleiben in PROJ-44s Eval-Gate-Verantwortung
(measure-first). Die drei heutigen Analyst-Einstiegspunkte werden dabei zu einem Deep-Module-Einstieg
konsolidiert. PROJ-42 bleibt bis PROJ-46 In Review (BUG-4 offen).

**PROJ-44 architektiert 2026-07-16** (`/architecture` + `/grilling`, Status Architected,
[ADR-021](../docs/adr/ADR-021-analyst-synchron-vor-talker-timing-amendment.md) Timing-Amendment zu
ADR-011 D2, überholt ADR-019s Proposed-Freshness-Signal). Kern-Entscheidungen: **ein** `runAnalyst`-
Aufruf/Turn, Modus aus `ctx.phase` (`closing`-Modus = intern zwei fokussierte Sub-Pässe Backfill+Online,
Trigger `phase==='closing'` ohne Marker); `runAnalyst` gibt `{ briefing, toolCalls, stepTracker }` zurück
(ersetzt „reload"); `background()` → `after(finalize)` = extractAndEmbed+onCompleted (schließt fire-and-
forget-Lücke), Analyst-Ergebnis via `meta.analyst`; synchroner Analyst in voller Konfig (Korrektheit vor
Latenz, „Analysiere…"-Indikator); Fail-Safe vetoet `soft_confirm`, lässt `hard_stop` zu.
`extractAndEmbed` bleibt per-Turn (post-Completion-Verlagerung = eigener Kandidat). Nächster Schritt:
`/backend` (Bau) — Reihenfolge Rollen-Guard → runAnalyst → checkLifecycle → decideNextPhase →
shouldInjectClosingProbe → Talker → after(finalize).

**PROJ-44 Backend gebaut 2026-07-17** (Status In Progress) — Design 1:1 umgesetzt, keine Abweichung.
`interviewAgent.ts`+`interviewQuickExtract.ts` gelöscht, `interviewTools.ts` neu (buildTools-Extraktion),
`interviewAnalyst.ts` auf einen `runAnalyst`-Einstiegspunkt konsolidiert (online/closing/failure-window,
Backfill-Sub-Pass läuft vor Online-Sub-Pass — teilen sich eine Session/einen Commit), `runInterviewTurn.ts`
komplett umgebaut (`background()`→`finalize()`, Analyst-Ergebnis via `meta.analyst`), Start/Reconnect-Routen
umgestellt, `quick`-WriteSource + totes `loadStepTracker` entfernt. Netto **−533 Zeilen** production code
trotz neuer Datei (Details im Backend-Abschnitt der Spec). `tsc --noEmit` + volle Suite (888/889, 1
Skip vorbestehend) grün. Zwei gezielte Regressionstests statt Tim-Nachbau (Orchestrator erhält frischen
`stepTracker`/`analystBriefing` statt Vorturn-Snapshot — die von ADR-021 benannte gemeinsame Wurzel von
BUG-1 und BUG-6). **Noch offen (gehört zu `/qa`):** Live-`/eval:interview`-Lauf (Pflicht-Gate vor
`Approved`, general.md), manueller adversarialer Durchlauf, Latenz-Delta-Messung, Start/Reconnect
curl-Verifikation. **Nächster Schritt:** `/qa PROJ-44`.

### Etappe 5 (Schema-Konsolidierung, ab 2026-07-21)

**PROJ-45 Backend gebaut 2026-07-21** (Status In Progress) — ADR-025 (D1–D6) umgesetzt. Migration angewendet
(`process_steps.schritt_daten jsonb` ersetzt 10 Legacy-Spalten, kein Backfill). `StepEntry` auf einen generischen
`SchemaSlotBase<T>`-Typ konsolidiert (ersetzt `SlotValue`/`TaziteSlot`/`TaziteSlotArray`/`GovernanceSlot`);
bewusste Abweichung vom Tech-Design-Wortlaut: bestehende Feldnamen (`value`/`quote`/`confidence`/`nicht_befund_typ`,
`title`, `frequency_per_month` etc.) beibehalten statt eines zusätzlichen Deutsch-Renames — reduziert Blast-Radius
ohne die AC-Kernanforderung (vier Slot-Typen → einer) zu verfehlen, Details + Begründung im Backend-Abschnitt der
Spec. `governance`/`friction_tools`/`pain_point_primary` entfernt, `friction_points`→`reibungspunkte` (jetzt
aktives O-Feld), `process_steps`→`teilschritte`, `record_governance`+`update_walkthrough_data`-Tools entfernt
(teilschritte jetzt regulärer `record_slot`-Slot). Neue Felder `aufgabentyp`/`risiko_schwere`/`ausloeser` (aktiv
erfragt) + `standardisierungsgrad`/`informationsdichte` (Analyst-Klassifikation, keine eigene Frage). Einheiten-
Unabhängigkeit für Häufigkeit/Dauer (`einheit`-Feld + deterministische Code-Umrechnung, adressiert KI-18s
größte dokumentierte Einzelursache strukturell). `schemaValidator.ts`+`schemaConformanceRate`-Scorer gelöscht
(maßen Konformität zu einem Schema, von dem die App laut ADR-025 D7 bewusst abweicht). Neuer
`src/lib/schrittDatenView.ts`-Adapter hält alle Downstream-Konsumenten (useCaseEngine, Aggregation, Reports, UI)
bei unveränderter eigener Logik. Zwei vorbestehende, durch die Typvereinheitlichung aufgedeckte Bugs mitgefixt
(`interviewOrchestrator.ts` falsche Coverage-Funktion, `slotDepth.ts` Quote-Nullability). Test-Fixture-Reparatur
(~19 Dateien, Subagent) + 3 selbst gefixte Tests mit echten `schritt_daten`-Assertion-Anpassungen abgeschlossen.
**Endstand: `tsc --noEmit` sauber, 66/66 Testdateien / 807 Tests grün (1 Skip vorbestehend).** Noch offen vor
`/qa PROJ-45`: Pflicht-`eval:interview`-Lauf (general.md, neue Slots noch nicht live gegen ein echtes LLM
verifiziert).

**PROJ-43 architektiert 2026-07-23** (`/architecture`, Status Architected). Kern-Entscheidung nach mehreren
Grilling-Runden mit dem Nutzer: AC3/AC4/AC5 (Häufigkeit/Dauer/Fehlerquote) werden über einen neuen,
vollständig deterministischen Card-Mechanismus gelöst statt über strengere Analyst-Prompt-Anweisungen —
die Lücken-Prüfung läuft genau einmal, am Entscheidungspunkt (Zeit-Timeout oder `discovery_exhausted`),
nicht bei jedem Turn ab Closing wie der heutige LLM-Mechanismus. Fragetext und Bucket-Optionen sind für
diese Runde fest templatiert (kein LLM-Aufruf, kein Text-zu-Zahl-Zuordnungsrisiko). Richtungssignal (AC2)
wird direkt am jeweiligen Zahlen-Feld gespeichert, analog der bestehenden `einheit`-Angabe aus PROJ-45 —
kein neues Zwischenspeicher-Feld nötig, beantwortet die in der Ausgangs-Spec offen gelassene Bridge-Frage.
AC7 (Pro-Vorgang vs. Aggregat) braucht kein neues Datenfeld, reine Gesprächsdisziplin plus eindeutigerer
Card-Wortlaut bei fortbestehender Ambiguität. Bewusst NICHT in dieser Runde: der bestehende LLM-basierte
Mechanismus für `OpenItemCards`/`QualitativeCards` (inkl. `entscheidungslogik`) bleibt unangetastet, inklusive
seiner bekannten Per-Turn-Scan-Ineffizienz und unveränderten Zuverlässigkeit — ausgegliedert als eigenes
Folge-Feature **PROJ-47** (Roadmap), damit diese Spec-Runde beherrschbar bleibt und kein Akzeptanzkriterium
diese Verbesserung ohnehin verlangt. Nächster Schritt: **`/backend PROJ-43`**.

**PROJ-43 Backend gebaut 2026-07-23** (Status In Progress) — Design 1:1 umgesetzt. Talker-Prompt (Forced-
Choice raus, Zwei-Schritt-Sequenz + Treiber-Framing + Dauer-Disambiguierung rein), neues `SchemaSlotNumber.
richtung` (dritter `record_slot`-Schreibmodus, füllt den Slot bewusst nicht), neuer deterministischer Card-
Mechanismus (`clarificationCards.ts`, ersetzt die LLM-Generierung für frequency/duration/error_rate_percent
vollständig), Zwei-Wege-Card-UI (`clarificationBuckets.ts` + `ClarificationCards.tsx`). Dabei ein
unabhängiger, in der Spec nicht vorhergesehener AC5-Root-Cause-Fund: die alte Card-Antwort-Verarbeitung
schrieb gegen `process_steps.schritt_daten`, das für ein laufendes Interview zu diesem Zeitpunkt noch gar
nicht existiert (entsteht erst danach aus `interview_state.step_tracker`) — Card-Antworten wurden dadurch
strukturell nie persistiert, unabhängig von der M-4-Generierungs-Unzuverlässigkeit. Fix (neues
`clarificationAnswers.ts`, jetzt von Prod-Route UND Eval-Runner geteilt) macht AC5s „code-identischer
Completion-Pfad"-Anspruch erstmals tatsächlich wahr. `tsc --noEmit` sauber, 853/853 Tests grün (43 neu).
Bewusst nicht umgesetzt: Komplexitätsreduktion (`usedFillerPhrases`/`conversationSignals.ts`) — braucht
laut Spec einen echten Eval-Lauf vor dem Löschen, kein Pflicht-`/eval:interview`-Lauf in dieser Runde
(folgt dem PROJ-44/45-Muster: Backend liefert + unit-testet, Live-Eval-Nachweis ist `/qa`-Gate). Details
im Backend-Abschnitt der Spec. Nächster Schritt: **`/qa PROJ-43`** (inkl. Pflicht-Eval-Lauf + manueller
UI-Durchlauf für die Zwei-Wege-Card-UI, general.md/PROJ-43-Spec).

