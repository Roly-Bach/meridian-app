# PROJ-46: Talker-Briefing-Konsolidierung (Judgment-Signale → Analyst)

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** XL
**Bugs:** —
**Created:** 2026-07-18
**Last Updated:** 2026-07-18

## Context

PROJ-44 hat den Analyst synchron **vor** den Talker gezogen. Damit fällt die Existenzgrundlage einer ganzen Schicht weg: [conversationSignals.ts](../../src/services/conversationSignals.ts) und die daraus gerenderten PFLICHT-Blöcke im Talker-Prompt waren die **Kompensation dafür, dass der Talker vor PROJ-44 keinen frischen Analyst hatte**. Der Analyst lief danach/parallel, also brauchte der Talker eine eigene billige In-Turn-Lesung des aktuellen Turns (Ambiguität, Ausnahme, Blockade) und seiner eigenen letzten Ausgaben (Drill-Stop, Frage-Wiederholung), um überhaupt reagieren zu können. Jetzt sieht der Analyst denselben Turn zuerst. Die Schicht ist nicht umzuziehen, sie ist größtenteils **redundant**.

Der heutige Talker-Prompt trägt gleichzeitig zwei sich widersprechende Steuerungsquellen: seine eigenen code-berechneten Signal-Blöcke und ein advisory Analyst-Briefing (`suggested_question`, „anpassen wenn bereits beantwortet", [talkerPrompt.ts:389](../../src/services/talkerPrompt.ts#L389)). Beobachtbare Folgen dieser Doppelsteuerung, real in den PROJ-44-QA-Läufen gemessen:

- **M-6:** der O-Drought-Fokus-Lock steuert den **Analyst** korrekt auf O-Felder, erreicht aber den **Talker** nicht. Der Talker behandelt die Empfehlung als unverbindlich und folgt seinem eigenen Methodik-Block. Themen-Ping-Pong bleibt, O-Felder bleiben flach (PROJ-44-QA Z. 487).
- **H-2 (High):** der Analyst schreibt Abschiedstext in `suggested_question`, während der Orchestrator-State noch `explore` ist (Split-Brain). Der Analyst führt ein Schatten-Lifecycle-Modell parallel zur autoritativen deterministischen State-Machine.
- **BUG-4:** der closing-Methodik-Block fordert die Catch-all-Sonde bedingungslos erneut, wortgleicher statischer Text nach Late-Discovery-Umweg.
- **M-7:** der Completion-Farewell ist inhaltsblind und ignoriert eine substanzielle Sonden-Antwort.
- **L-1:** fehlende sprachliche Übergänge bei Lock-Wechsel und statischer Sonde.

Diese fünf sind Symptome derselben Wurzel: die Rollenteilung Analyst/Talker stimmt nicht. Die PROJ-44-„Weg nach vorn"-Analyse hat den Ziel-Vertrag empirisch skizziert (Z. 691): **Themen-Disziplin gehört an den Analyst** (hält den Lock, liefert Übergänge, Terminierung raus aus Analyst-Freitext), **Formulierung an den Talker** (die einzigen im Judge gelobten Fragen waren Talker-Erfindungen). Rollen schärfen, nicht den Talker entfernen.

### Leitprinzip: B3 (Hybrid), zwei deterministische Böden

Nicht „alles deterministisch" und nicht „alles LLM". Der Entscheidungstest pro Intention: schützt sie gegen einen **LLM-Blindspot** (→ deterministisch, ggf. Cross-Check) oder ermöglicht sie **LLM-Adaptivität** (→ sparsame Guidance im Analyst-Prompt)?

Deterministisch bleiben genau **zwei Böden**, beide bereits in PROJ-44 gebaut und getestet:
1. **Fortschritts-Boden:** der O-Drought-Fokus-Lock (`computeFocusLock`/`updateODrought`, [interviewOrchestrator.ts:103](../../src/services/interviewOrchestrator.ts#L103)). Garantiert, dass ein erschöpfter Schritt verlassen wird (verhindert Tim-Nie-Konvergenz und Ping-Pong).
2. **Terminierungs-Boden:** die Orchestrator-State-Machine (`resolveTurnLifecycle`). „Analyst darf nicht terminieren."

Alles andere (adaptive Fragen- und Themenwahl, Ausnahmen-Vertiefung, Widersprüche, Übergänge) wird sparsame Guidance im **Analyst**-Prompt. Der Talker bleibt dünner Formulierer mit direktem Blick auf den Rohverlauf.

### Warum das kein KI-18-Risiko ist, sondern ihn angreift

Die KI-18-Historie zeigt: dichte Talker-Prompts kosten `dialog_naturalness` beim lite-Modell. PROJ-46 ist überwiegend **Löschung und Ent-Dichtung** des Talker-Prompts (Signal-Blöcke, Few-Shot, Tool-Verbot, Anker-Sperre, Anker-Pflicht). Es ist damit nicht „riskante Talker-Prompt-Änderung", sondern der Eingriff, der genau das KI-18-Dichte-Problem an der Wurzel angreift. Der Analyst-Prompt wächst dabei nicht (STUFE 4 wird umgeframt statt additiv verlängert, das Ziel-O-Feld ist eine Zeile am bestehenden Lock).

## Dependencies

- **Requires: PROJ-44** (Pipeline-Simplifikation) — der synchrone Analyst-vor-Talker ist die harte Vorbedingung: nur weil das Briefing jetzt frisch **diesen** Turn beschreibt, kann es bindende Steuerungsquelle statt advisory Vorturn-Empfehlung werden. PROJ-44-Code ist auf main.
- **Requires: PROJ-22** (Dual-Loop Interview Engine) — der Talker/Analyst-Split und die `next_briefing`-Bridge sind die Grundlage des revidierten Vertrags.
- **Requires: PROJ-33** (Turn-Loop-Konsolidierung) — `runInterviewTurn.ts` ist die Naht.
- **Requires: PROJ-42** (Grenzfall-Robustheit) — Rollen-Guard, 3-Phasen-Modell, `isCompletionFarewell`-Mechanismus, `step_advance_ready` bleiben die Basis, auf der die Terminierungs- und Guard-Logik aufsetzt.
- **Löst / behebt:** BUG-4 (PROJ-42), H-2, M-6, M-7, L-1 (PROJ-44 QA); M-5 teilweise.
- **Schließt ab:** nach Bau + Eval eine gemeinsame Gate-/Status-Entscheidung über PROJ-42, PROJ-44, PROJ-46. Bis dahin bleiben PROJ-42 und PROJ-44 In Review.
- **Abgegrenzt gegen: PROJ-43** (Elicitation-Reorientierung) — siehe Out of Scope.
- **ADR erforderlich:** Rollen-Vertrag-Amendment (Briefing trägt Absicht statt Frage; Analyst terminiert nicht; Fokus-Lock bindend für den Talker). Wird in `/architecture` oder via `/adr` erstellt, nicht in dieser Spec entschieden.

## User Stories

- Als **KI-Berater** möchte ich, dass der Interviewer einem angefangenen Prozess treu bleibt, bis er qualitativ ausexploriert ist, damit die erfassten Prozesse Tiefe bekommen statt an der Oberfläche zwischen Themen zu springen.
- Als **Befragter** möchte ich, dass sich das Gespräch natürlich anfühlt und der Interviewer nicht dieselbe statische Frage erneut stellt, damit ich das Interview als echtes Gespräch und nicht als Formular erlebe.
- Als **Befragter** möchte ich, dass das Interview nach meiner Verabschiedung tatsächlich endet und nicht in wiederholten Abschieds-Turns hängen bleibt.
- Als **Befragter** möchte ich, dass der Interviewer beim Wechsel zwischen Themen einen sprachlichen Übergang setzt, damit Themenwechsel nicht abrupt wirken.
- Als **Entwickler** möchte ich eine einzige, dünne Talker-Steuerung (das frische Analyst-Briefing) statt eines Talker-eigenen Signal-Layers, der dem Briefing widerspricht, damit die Gesprächsführung ein Verhalten hat statt zweier konkurrierender, und der Talker-Prompt entdichtet wird.
- Als **KI-Berater** möchte ich, dass der Interviewer im Closing weiter aktiv nach unentdeckten Prozessen und Wissensobjekten fragt, solange Zeit ist, damit das Zeitbudget maximal für Entdeckung genutzt wird.

## Acceptance Criteria

### Strom A — Rollen-Vertrag: Briefing trägt Absicht statt Frage

- [ ] Das Analyst-Briefing trägt **keine ausformulierte Frage** mehr (`suggested_question` als „konkrete Frage für den Interviewer" entfällt) und **keine Terminierungs-/Farewell-Ausdrucksfähigkeit**. Es gibt strukturell kein Briefing-Feld, über das der Analyst „beende das Interview" oder „verabschiede dich" ausdrücken kann.
- [ ] Das Briefing trägt stattdessen strukturierte **Absicht**: Ziel-Schritt (aus dem deterministischen Lock), Ziel-O-Feld (vom Analyst innerhalb des Locks gewählt), Übergang-nötig (siehe Strom D). Die genaue Feld-Struktur entscheidet `/architecture`; die Spec fordert nur die Trennung Absicht-statt-Frage.
- [ ] `step_advance_ready` bleibt als **beschränktes** Wissenssignal erhalten, umgeframt von „du bist der PRIMÄRE Treiber für den Phasenübergang" ([interviewAnalyst.ts:255](../../src/services/interviewAnalyst.ts#L255)) zu „ist der aktive Schritt inhaltlich ausreichend gedeckt". Es ist advisory-Input zum Fortschritts-Boden, den der Boden (`hasUnexhaustedStep`) vetoen kann, keine Lifecycle-Entscheidung.
- [ ] Der Talker konsumiert die Absicht **bindend** in der Themen-/Ziel-Wahl (welcher Schritt, welches O-Feld), aber **frei im Wortlaut** (er formuliert selbst, mit Blick auf den Rohverlauf). Die advisory-Rahmung „Empfohlene Frage (anpassen wenn bereits beantwortet)" ([talkerPrompt.ts:389](../../src/services/talkerPrompt.ts#L389)) entfällt.

### Strom B — Fokus-Lock bindend + Übergänge (M-6, L-1)

- [ ] Der O-Drought-Fokus-Lock wird für den **Talker** verbindlich: die Fragerichtung des Talkers folgt dem gesperrten Schritt und dessen Ziel-O-Feld, bis der Schritt qualitativ ausgeschöpft ist (Drought feuert). Kein eigenständiger Themenwechsel des Talkers gegen den Lock. (Behebt M-6, das reale Themen-Ping-Pong aus den PROJ-44-QA-Läufen.)
- [ ] Die Ziel-O-Feld-Wahl priorisiert die substanziellen O-Felder (O2-O6: entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten) **vor** den quantitativen Slots. Der heutige potenzial-first-Walk in [computeWalkthroughSlotTarget](../../src/services/interviewSemantic.ts#L641) (der aktiv gegen den O-Drought-Lock zieht) entfällt als separater Talker-Ziel-Picker.
- [ ] Wechselt der Lock den Schritt (Drought gefeuert) oder tritt das Gespräch in die Closing-Entdeckung ein, trägt das Briefing eine **Übergang-nötig**-Facette, und der Talker formuliert einen sprachlichen Übergang statt eines abrupten Themensprungs. (Behebt L-1.)
- [ ] `abhaengigkeiten` (O6) ist Teil der Ziel-O-Feld-Menge, sodass es nicht mehr strukturell bei 0 bleibt (M-5 teilweise). Eine volle Dependency-Capture-Zuverlässigkeit ist **nicht** Teil dieser Spec.

### Strom C — Signal-Kollaps + Talker-Ent-Dichtung (Deletion-Test)

- [ ] Aus [conversationSignals.ts](../../src/services/conversationSignals.ts) und dem Talker-Prompt **ersatzlos entfernt**:
  - `exception` (zu breite Regex, hohe Falschpositiv-Rate; „Ausnahme vertiefen" leistet der Analyst weniger verrauscht).
  - der **numerische** `ambiguity`-Detektor: er vergleicht unit-blind eine rohe Turn-Zahl gegen einen normalisierten Slot-Wert (z.B. „8/Tag" gegen erfasste „~200/Monat", Ratio 25) und speist die vom Analyst umgerechnete Zahl in eine „du sagtest X"-Schablone. Das ist eine im Code eingebaute Grounding-Verletzungs-Fabrik (KI-18-„180 Rechnungen"-Muster). Widerspruchsauflösung übernimmt das Analyst-Urteil (unit-aware) plus der bestehende [talkerGroundingGuard](../../src/services/talkerGroundingGuard.ts) als Backstop. **Keine** explizite Widerspruchs-Guidance im Prompt.
  - `recentlyRecontextualized` (Re-Kontext-Sperre): obsolet, da Übergänge jetzt Analyst-getriebene Absichts-Facette sind.
  - der `drillStopSection`-Block und der `ladderiungSection`-Block als Talker-PFLICHT-Blöcke.
- [ ] Die **Intention** von Drill-Stop und Laddering bleibt erhalten, aber verlagert: „einen erfolglos gedrillten Quant-Slot / einen blockierten Thread nicht weiter verfolgen" fällt in die deterministische Ziel-/Lock-Wahl (der O-Drought-Lock verlässt einen erschöpften Schritt; der Ziel-Picker targetet keinen bereits erfolglos gedrillten Slot). Kein separater Talker-Block, keine Verschiebung ins LLM-Urteil.
- [ ] `question-stem` (Frage-Wiederholung) und `filler` (Einstiegsphrasen-Vermeidung) werden **provisorisch behalten** und zur Löschung markiert: `question-stem` ist ein Artefakt des jetzt entfernten Slot-Marschs, `filler` ist an den Forced-Choice-/Akzeptanz-Phrasen-Pool gekoppelt (PROJ-43). Beide „löschen und per Eval verifizieren", nicht in dieser Spec final entfernt.
- [ ] Aus dem **statischen** Talker-Prompt ([talkerPrompt.ts](../../src/services/talkerPrompt.ts)) ersatzlos entfernt:
  - `WALKTHROUGH_EXAMPLES` ([Z. 266-282](../../src/services/talkerPrompt.ts#L266)): lehrt `update_walkthrough_data`-Tool-Calls, die der Talker strukturell nicht machen kann (`NO TOOLS`, [interviewTalker.ts:196](../../src/services/interviewTalker.ts#L196)). Ganz gelöscht, nicht eingedampft.
  - das Tool-Syntax-Verbot (KI-20, [Z. 43](../../src/services/talkerPrompt.ts#L43)): guardet nach Wegfall des Few-Shots einen nicht mehr existierenden Auslöser. Löschen-und-verifizieren.
  - die dynamische `anchorWarning`/ANKER-SPERRE ([Z. 385](../../src/services/talkerPrompt.ts#L385)): ihre Quelle sind Zahlen aus `suggested_question`, die entfällt.
  - `coverageCheckSection` ([Z. 316](../../src/services/talkerPrompt.ts#L316)): fehlende Quant-Pflichtslots im Closing sind Card-Territorium (PROJ-43/M-4).
- [ ] Im statischen Talker-Prompt **erhalten**: Rolle, `<turn_format>`, `<verboten>`, `<no_repeat>` (Grounding gegen Re-Ask gefüllter Slots), `<kein_kommentar>`, Floskel-Verbot, die statische Anti-Zitat-Regel ([Z. 44-45](../../src/services/talkerPrompt.ts#L44), guardet Talker-Eigenberechnung).
- [ ] Netto-Reduktion im Talker-Prompt ist dokumentiert (Zeilen-/Block-Delta). Der Analyst-Prompt wächst netto nicht (STUFE 4 umgeframt statt additiv).

### Strom D — Terminierungs- und Closing-Vertrag (H-2, BUG-4, M-7)

- [ ] **H-2 (Wurzelfix):** der Analyst autort keine Fragen mehr (Strom A) und räsoniert nicht über den Lebenszyklus (STUFE-4-„Treiber"-Rahmung entfernt). Damit gibt es keinen Kanal, über den ein Abschiedstext während `explore` entsteht. Completion ist zu 100% die deterministische Orchestrator-Entscheidung; die Verabschiedungs-Formulierung ist Talker-Sache, ausgelöst einzig vom aufgelösten Completion-State (`isCompletionFarewell`). Kein Farewell-Limbo, keine Doppel-Verabschiedung.
- [ ] **BUG-4 / Closing als Entdeckungs-Fortsetzung:** die Catch-all-Sonde ist **kein** einmaliger statischer Text mehr. Im Closing stellt der Interviewer weiter natürlich anschließende, jedes Mal frisch formulierte Entdeckungsfragen mit dem Ziel, weitere Prozesse oder Wissensobjekte zu finden. Kein Frequenz-Cap. Anti-Wiederholung über Formulierung/Varianz, nicht über einen once-Marker. Der statische [CLOSING_PROBE_TEXT](../../src/services/interviewOrchestrator.ts#L161) und der closing-PFLICHT-Methodik-Block ([talkerPrompt.ts:246](../../src/services/talkerPrompt.ts#L246)) entfallen. (Die Probe-Injektions-Maschinerie `closingProbeAlreadyAsked`/`shouldInjectClosingProbe`/`closingProbeAnswerReceived` wird damit größtenteils überflüssig; die genaue Entkernung entscheidet `/architecture`.)
- [ ] Die Terminierung im Closing läuft **rein deterministisch über die zwei Böden**: No-New-Extraction-Streak (K Turns ohne angewendete Extraktion) oder harter Timer bei 100 % `maxDurationMinutes`. Damit kann die Entdeckungs-Fortsetzung nicht endlos laufen (kein Tim-Risiko).
- [ ] **M-7 (M7-b):** jede angewendete Wissens-Extraktion (`hadExtraction` auf applied writes, PROJ-44 Runde 2) auf einem Closing-/Entdeckungs-Turn vetoet die Completion und routet zurück nach `explore`. Verallgemeinert das heutige `newStepThisTurn`-Veto (nur neuer Schritt) auf „neuer Inhalt, auch auf bestehendem Schritt". Guardrail bleiben die zwei Böden.
- [ ] Der neu-entdeckte-Prozess-während-Closing-Pfad (PROJ-42-AC „erstklassig zurück nach explore") bleibt erhalten und ist mit M7-b konsistent.

### Strom E — Statische Textausgaben (Item #3)

- [ ] **Prinzip:** nutzersichtbarer statischer Text wird Talker-formuliert (kontextuell, mit Übergang); interne Kontrolle bleibt deterministisch (State-Flags/Böden statt String-Match).
- [ ] Die Closing-/Catch-all-Sonde ist Talker-formuliert (folgt aus Strom D).
- [ ] Der Off-Topic-Redirect-**Wortlaut** ([buildOffTopicRedirect](../../src/services/roleGuard.ts)) wird von festem Text auf eine formulierte Fassung umgestellt (kurzer Redirect plus Rückkehr zum offenen Thread, statt wortgleicher Wiederholung der Vorfrage, KI-26-Symptom). Die Klassifikations-**Präzision** des Rollen-Guards (KI-26, `meta` vs. `off_topic`) bleibt **PROJ-42**-Scope, nicht Teil dieser Spec.
- [ ] Der Reconnect-Statiktext („Willkommen zurück…", [reconnect/route.ts:86](../../src/app/api/interview/[token]/reconnect/route.ts#L86)) wird **ersatzlos gelöscht**. Wegen atomarer Turn-Persistenz (KI-22) ist die letzte Nachricht beim Reconnect immer die offene Interviewer-Frage, die der Mitarbeiter direkt beantworten kann. Reconnect wird validierungs-only (Token gültig, nicht abgelaufen, nicht completed, hat Turns), gibt keine Assistant-Nachricht zurück; das Frontend rendert die persistierte History. Kleiner Frontend-Touch (das Frontend feuert `/reconnect` bei jedem Mount und zeigt heute den Response-Text).

### Strom F — Anker-Pflicht relaxen (KI-18-Wurzel)

- [ ] Die Anker-Pflicht E3.3 ([talkerPrompt.ts:205](../../src/services/talkerPrompt.ts#L205), „Jede Nachfrage referenziert ein Konzept aus den letzten Turns") wird von einer **Pflicht** zu einer **Option**. Der Talker muss nicht mehr jede Nachfrage verankern; er **darf** eine echte frühere Aussage aufgreifen (letzter Turn oder mehrere Turns zurück, je nachdem was gesprächslogisch passt), wird aber nicht dazu gezwungen, wenn keine passt. Der Erfindungs-Druck fällt weg, weil die Regel keinen Anker mehr **verlangt** (nicht weil die Distanz beschränkt wird). Das war laut der 2026-07-12-Bestandsaufnahme die diffuse Wurzel der Grounding-Verletzungen: das lite-Modell erfindet einen Anker, wenn die Pflicht einen verlangt und keiner klar ist. Der Talker behält den vollen Rohverlauf, damit ein legitimer Rückgriff über mehrere Turns akkurat ist; der [talkerGroundingGuard](../../src/services/talkerGroundingGuard.ts) bleibt der Backstop gegen erfundene Rückbezüge.

### Strom G — Erfolgskriterium + Eval-Gate

- [ ] **Pflicht-Eval-Gate (general.md, Interview-Engine):** mindestens 1 erfolgreicher `/eval:interview`-Lauf je Persona (buchhalter, it-support), gleiche Config/Seed wie die PROJ-44-QA-Runden (Delta sauber PROJ-46-attribuierbar). Judge-Key-Preflight mit echtem generateText-Call.
- [ ] `dialog_naturalness` **≥ PROJ-44-Runde-3-Baseline** auf beiden Personas (gehalten oder besser). Erwartung: eher besser, weil PROJ-46 überwiegend ent-dichtet.
- [ ] O-Feld-Tiefe pro Schritt messbar über der Runde-3-Baseline (`dedup_slot_coverage`-Trend nach oben). Das **grüne** Gate (≥0.75) ist **nicht** PROJ-46-eigen: M-4 (Cards, PROJ-43), M-5 (dependency_capture) und der Instrument-Effekt (`dedup_slot_coverage`-Nenner, PROJ-40) sind separat.
- [ ] **Transkript-Level-Verifikation** (aggregierte Scores verdecken Konversationsfehler): H-2 (kein Farewell-Limbo/Doppel-Abschied), BUG-4 (keine wortgleiche Sonden-Wiederholung), M-6 (kein Ping-Pong, Lock bindend), M-7 (Abschluss würdigt substanziellen Inhalt), L-1 (Übergänge vorhanden) sind an den neuen Transkripten nicht mehr reproduzierbar.
- [ ] Keine neuen `talker_grounding_violations`. Zusätzlich wird die **Guard-Aktivität** (Regenerations-Zahl) als Leitindikator dokumentiert. Der Guard bleibt; seine Entfernbarkeit ist eine spätere, separate, evidenz-schwere Entscheidung, nicht Teil dieser Spec.

## Edge Cases

- **Analyst-Fehler auf Turn N (transient/terminal):** die PROJ-44-Fail-Safe-Logik bleibt unverändert (Retry, dann Vorturn-Briefing + `analyst_status='failed'` + Catchup nächster Turn). Ein fehlendes frisches Briefing degradiert auf die letzte gültige Absicht, nie auf einen Farewell.
- **Closing-Entdeckung, Person nennt dreimal nichts Neues:** der No-New-Extraction-Streak terminiert deterministisch. Die frisch formulierten Entdeckungsfragen können nicht endlos laufen.
- **Closing-Entdeckung, Person nennt substanziellen neuen Inhalt (kein neuer Schritt):** M7-b routet zurück nach `explore`, der Inhalt wird vertieft statt beim Abschluss ignoriert.
- **Lock-Wechsel ohne klaren thematischen Bezug zwischen altem und neuem Schritt:** der Übergang wird trotzdem formuliert (Übergang-nötig-Facette), notfalls ein neutraler Übergang, statt eines abrupten Sprungs.
- **Off-Topic-Frage:** der Rollen-Guard bleibt der früheste Gate (PROJ-42, unverändert in der Klassifikation). Nur der Redirect-**Wortlaut** wird formuliert. Klasse `off_topic` beendet den Turn wie heute, State unverändert.
- **Erster Turn / intro:** kein aktiver Schritt, kein Lock, keine Übergang-Facette. Der Talker formuliert den Opener wie bisher.
- **Historische Interviews mit alten `suggested_question`-Briefings in `next_briefing`:** kein Kompat-Code, keine Migration. Ein fortgesetztes Interview liest das Briefing neu über den frischen synchronen Analyst; alte persistierte Briefing-Felder sind inert.
- **Reconnect während einer offenen Frage:** die offene Frage ist in der gerenderten History sichtbar; der Mitarbeiter beantwortet sie. Der Antwort-Verlust beim harten Abbruch bleibt der bewusst akzeptierte KI-22-Trade-off (out of scope).
- **Voice-Input (PROJ-7):** unverändert, rein serverseitige Änderung am Text-Turn.

## Out of Scope

- **PROJ-43 (Elicitation-Reorientierung):** Forced-Choice/Anchoring-Mechanik (KI-21/L-2), Zahlen→Cards (inklusive M-4 Card-Zuverlässigkeit), der Forced-Choice-/Akzeptanz-Phrasen-Pool ([talkerPrompt.ts:47-61](../../src/services/talkerPrompt.ts#L47)), Treiber-/WHY-Fragen, M-3-Rest der Elicitation. PROJ-46 fasst den Akzeptanz-Pool nicht an; daher bleibt `filler`-Tracking provisorisch.
- **PROJ-40 (Eval-Instrument):** der `dedup_slot_coverage`-Nenner-/Dependency-Effekt (PROJ-44-QA Z. 481). PROJ-46 hebt die O-Feld-Tiefe, löst aber nicht das grüne Gate allein.
- **PROJ-42-Scope:** die Klassifikations-Präzision des Rollen-Guards (KI-26). PROJ-46 ändert nur den Redirect-Wortlaut.
- **Volle Dependency-Capture-Zuverlässigkeit** (über „abhaengigkeiten in die O-Feld-Menge" hinaus): eigenes Item, ggf. schema-nah (PROJ-26).
- **Entfernung des `talkerGroundingGuard`:** spätere, separate, evidenz-schwere Entscheidung. PROJ-46 misst nur Guard-Aktivität als Leitindikator.
- **Langfuse-Tracing der Guard-Judge-Calls** (2026-07-13-Doku-Fund, [00-vorgeschlagene-anpassungen.md](../../docs/architecture/00-vorgeschlagene-anpassungen.md) #7): adjazentes Observability-Mini-Item, nicht Teil dieser Spec.
- **History-Windowing / Migration des wörtlichen Verlaufs weg vom Talker:** der Talker behält vollen Blick auf den Rohverlauf. Token-Kosten-Optimierung bewusst separat.
- **Neue Eval-Judges/Metriken** über die genannten hinaus (PROJ-31-Scope).

## Technical Requirements

- **Kern-Dateien:** [talkerPrompt.ts](../../src/services/talkerPrompt.ts) (statischer Prompt entdichten, dynamischer Kontext auf Absicht + Rohverlauf reduzieren, Anker-Pflicht relaxen), [conversationSignals.ts](../../src/services/conversationSignals.ts) (exception, ambiguity-numerisch, recentlyRecontextualized, drill-stop-/laddering-Rendering entfernen; question-stem/filler provisorisch), [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts) (Briefing-Schema: `suggested_question` raus, Absicht/Ziel-O-Feld rein; STUFE 4 umframen; keine Lifecycle-/Farewell-Autorierung), [interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts) (Ziel-O-Feld-Wahl am Lock, O2-O6 vor Quant; Closing als Entdeckungs-Fortsetzung; M7-b-Veto via `hadExtraction`; Probe-Maschinerie/`CLOSING_PROBE_TEXT` entkernen), [interviewSemantic.ts](../../src/services/interviewSemantic.ts) (`computeWalkthroughSlotTarget` als separater Talker-Ziel-Picker entfällt), [roleGuard.ts](../../src/services/roleGuard.ts) (Redirect-Wortlaut formuliert), [reconnect/route.ts](../../src/app/api/interview/[token]/reconnect/route.ts) (Statiktext löschen, validierungs-only).
- **Frontend:** kleiner Touch am Reconnect-Handling (kein injizierter Assistant-Text; History rendern, letzte Nachricht = offene Frage).
- **Keine DB-Migration**, kein neues Feld (Absicht/Übergang laufen über die bestehende `next_briefing`-JSON-Bridge, analog `usedFillerPhrases`/`oDrought`). Keine neuen npm-Pakete.
- **Deterministische Böden unangetastet in ihrer Garantie:** `computeFocusLock`/`updateODrought`/`hasUnexhaustedStep` und `resolveTurnLifecycle` bleiben die Terminierungs-/Fortschritts-Autorität. PROJ-46 macht ihre Ergebnisse für den Talker bindend, ändert die Böden selbst nicht.
- **ADR:** Rollen-Vertrag-Amendment (Briefing trägt Absicht statt Frage; Analyst terminiert nicht; Fokus-Lock bindend). Pflicht vor Bau-Abschluss.
- **Tests:** Unit-Tests für die Ziel-O-Feld-Wahl am Lock (O2-O6-Priorität), für den M7-b-`hadExtraction`-Veto, für den Wegfall der gelöschten Signale (keine Rest-Referenzen), Regressionstests, dass kein Briefing-Feld Farewell/Terminierung ausdrücken kann (H-2). `tsc --noEmit` + volle Suite grün.
- **Verifikation (general.md, Interview-Engine-Eval-Gate):** dokumentierter `/eval:interview`-Lauf mit mind. 1 PASS je Persona, Transkript-für-Transkript-Lektüre gegen die PROJ-44-Runde-3-Baseline, Latenz unverändert (keine neue Naht), E2E grün. Ein manueller adversarialer Durchlauf (Tim-artig) für H-2/BUG-4.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: XL / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
