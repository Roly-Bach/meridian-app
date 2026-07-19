# PROJ-46: Talker-Briefing-Konsolidierung (Judgment-Signale → Analyst)

## Status: In Review
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** XL
**Bugs:** 0:1:1
**Created:** 2026-07-18
**Last Updated:** 2026-07-19 (QA-Runde 3: B/C Re-Eval — Non-Termination behoben; flacher Abschluss = PROJ-43-Wurzel, nächster Schritt PROJ-43)
**ADR:** [ADR-023](../../docs/adr/ADR-023-rollen-vertrag-briefing-traegt-absicht.md) (Rollen-Vertrag-Amendment), [ADR-024](../../docs/adr/ADR-024-analyst-completion-readiness-geguardetes-boolean.md) (Completion-Readiness-Amendment, Accepted)

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

> Erarbeitet via `/architecture` + `/grilling` (2026-07-18). Rollen-Vertrag festgehalten in **[ADR-023](../../docs/adr/ADR-023-rollen-vertrag-briefing-traegt-absicht.md)** (amendmentet ADR-011/021/022). Keine DB-Migration, kein neues npm-Paket. Alle Änderungen serverseitig + ein kleiner Frontend-Touch.

### Leitprinzip

Zwei deterministische Böden bleiben unangetastet, alles andere wird sparsame Analyst-Guidance oder Talker-Formulierung:
- **Fortschritts-Boden:** der O-Drought-Fokus-Lock (garantiert, dass ein erschöpfter Schritt verlassen wird).
- **Terminierungs-Boden:** die Orchestrator-State-Machine (`resolveTurnLifecycle`) — „Analyst darf nicht terminieren".

### A) Turn-Ablauf — vorher / nachher

Der Turn kreuzt dieselben Nähte wie nach PROJ-44; verändert wird, **was** über die Analyst→Talker-Brücke fließt und **wie** Closing/Off-Topic/Reconnect terminieren.

```
Rollen-Guard → computeFocusLock → runAnalyst (synchron) → resolveTurnLifecycle
             → (Closing-Sonde-Injektion ENTFÄLLT) → Talker → after(finalize)
```

| Naht | Vorher | Nachher (PROJ-46) |
|------|--------|-------------------|
| Analyst→Talker-Brücke | `next_focus` + `suggested_question` (Freitext-Frage, advisory) | strukturierte **Absicht**: Ziel-Schritt (Lock) + Ziel-O-Feld (Enum) + Übergang-Grund (code). Kein Freitext. |
| Talker-Steuerung | eigene Signal-Blöcke **und** advisory Briefing (zwei Quellen) | eine Quelle: bindender Ziel-Block + Rohverlauf. Signal-Blöcke gelöscht. |
| Closing-Sonde | statischer `CLOSING_PROBE_TEXT`, einmal injiziert | Talker formuliert jedes Mal frisch eine Entdeckungsfrage. Injektions-Maschinerie gelöscht. |
| Closing-Terminierung | „Sonde gestellt + beantwortet" | rein deterministisch: `ctx.phase=='closing' ∧ Streak≥K` **oder** Hard-Timer; M7-b routet neuen Inhalt zurück nach explore |
| Off-Topic-Redirect | fester Text, wortgleiche Frage-Wiederholung | schlanker Talker-Call (formuliert, ohne Guard) |
| Reconnect | statischer „Willkommen zurück"-Text | validierungs-only, kein Assistant-Text; Frontend rendert History |

### B) Was die Analyst→Talker-Brücke trägt (Daten-Modell, Klartext)

Das LLM-Briefing schrumpft auf drei strukturierte Felder — **kein Freitext-Feld**:

| Feld | Herkunft | Bedeutung |
|------|----------|-----------|
| `target_o_field` | **LLM** (Analyst), Fallback deterministisch | eines der 7 O2–O6-Felder (entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten) des gelockten Schritts. Geführt „O2–O6 vor Quant, wähle das gesprächslogisch salienteste". Bei Auslassung: erstes leeres O2–O6-Feld des Locks. |
| `step_advance_ready` | LLM | umgeframt zu „ist der aktive Schritt gedeckt" — advisory, der Fortschritts-Boden vetoet. |
| `clarification_cards` | LLM | unverändert (nur Closing). Freitext geht in die Clarification-UI, **nie** in den Talker-Prompt. |

Zusätzlich **code-berechnet** (nie LLM, laufen über die bestehende `next_briefing`-JSON-Bridge bzw. per-Turn ephemer):
- **Ziel-Schritt** = `oDrought.stepId` (Fokus-Lock).
- **Übergang-Grund** = `step_switch` (Lock wechselt Schritt) | `closing_entry` (Eintritt in Closing-Entdeckung) | keiner. Per-Turn frisch, nicht persistiert.
- `oDrought`, `noNewExtractionStreak`, `hadExtractionThisTurn` — Steuersignale für den Orchestrator, erreichen den Talker nicht.

**Invariante I1:** das einzige Analyst-**Freitext**, das den Talker erreicht, sind Schritt-**Titel** aus dem geteilten Tracker (sanitisiert) — die können nur einen Prozess benennen, nie das Interview beenden. Damit ist „kein Briefing-Feld drückt Farewell aus" strukturell und per Regressionstest wahr.

### C) Wichtigste Entscheidungen (PM-lesbar)

1. **Absicht statt Frage (Strom A).** Der Analyst formuliert keine Fragen mehr; er nennt nur noch *worüber* geredet werden soll (Schritt + O-Feld). *Wie* gefragt wird, erfindet allein der Talker aus dem Rohverlauf. Grund: die einzigen im Judge gelobten Fragen waren Talker-Erfindungen; und es schließt den H-2-Kanal (Analyst kann keinen Abschiedstext mehr schreiben).

2. **Fokus-Lock bindend für den Talker (Strom B, M-6).** Der Talker folgt dem gesperrten Schritt + Ziel-O-Feld, bis der Schritt qualitativ ausgeschöpft ist — kein eigenständiger Themenwechsel mehr gegen den Lock. Der alte, gegen den Lock ziehende Ziel-Picker (`computeWalkthroughSlotTarget`) entfällt; die neue Ziel-Wahl ist per Konstruktion deckungsgleich mit dem, was den Lock freigibt.
   - **Erschöpfung feuert auch bei voller O-Deckung** (ADR-023 D3, Grenzfall, den der *bindende* Lock aufdeckt): sind alle 7 O-Felder eines Schritts gefüllt (`countFilledOFields === 7`, Wert oder `nicht_befund`), gilt er **sofort** als erschöpft — auch wenn der Drought-Streak noch < K ist. Ohne das hielte der Lock einen fertigen Schritt bis zu K Turns ohne leeres Ziel (flaches Kreisen am Ende). So konvergieren Analyst-„fertig" (`step_advance_ready`) und Lock sauber: voller Schritt → Lock rückt sofort weiter oder Phase → closing. Zweite Erschöpfungs-Bedingung neben „K Turns trocken", keine neue Semantik.

3. **Closing = Entdeckungs-Fortsetzung, deterministisch terminiert (Strom D).** Statt einer einmaligen statischen Sonde fragt der Interviewer im Closing weiter aktiv nach unentdeckten Prozessen — jedes Mal frisch formuliert. Abschluss ist eine einfache Zustandsregel:
   - **Completion** nur wenn wir **schon** in Closing sind (geladene Phase `closing`) **und** K Turns in Folge nichts Neues kam. Der Eintritts-Turn stellt deshalb **immer mindestens eine** Entdeckungsfrage.
   - **M7-b:** kommt in einem Closing-Turn neuer Inhalt (angewendete Extraktion, `hadExtractionThisTurn`), geht es zurück nach explore (vertiefen) — verallgemeinert das alte „nur neuer Schritt"-Veto.
   - **Hard-Timer** bei 100 % beendet phasen-agnostisch und respektiert anstehende Cards → kann nie endlos laufen.
   - Entdeckungs-Budget = `K − Streak beim Eintritt`, selbstanpassend: engagierte Interviews bekommen das volle Budget, erschöpfte genau einen letzten Versuch. Kein zweiter Zähler.

4. **Analyst terminiert nicht (Strom D, H-2/D2).** `step_advance_ready` bleibt, aber als „Schritt gedeckt?"-Hinweis, den der Fortschritts-Boden vetoen kann — nicht als „Treiber". Completion ist zu 100 % die deterministische Orchestrator-Entscheidung; die Verabschiedung formuliert der Talker, ausgelöst einzig vom aufgelösten Completion-State.

5. **Talker-Entdichtung + Anker-Pflicht → Option (Strom C/F, greift KI-18 an).** Fünf code-berechnete Signal-Blöcke, die Few-Shot-Beispiele, das Tool-Syntax-Verbot und die Anker-Sperre fallen weg. Die Anker-**Pflicht** („jede Nachfrage muss eine frühere Aussage referenzieren") wird zur **Option** — sie war laut Bestandsaufnahme die diffuse Wurzel der Grounding-Verletzungen (das lite-Modell erfindet einen Anker, wenn die Pflicht einen verlangt und keiner klar ist). Der Grounding-Guard bleibt der Backstop. PROJ-46 ist damit überwiegend Löschung — es verkleinert das KI-18-Dichte-Problem, statt es zu vergrößern.

6. **Statische Textausgaben (Strom E).** Off-Topic-Redirect wird Talker-formuliert (schlanker Call, ohne Guard/Tracker; State unverändert — off_topic kurzschließt weiter vor dem Analyst). Reconnect-Text wird gelöscht; der Endpoint validiert nur noch, das Frontend rendert die persistierte History (die letzte Nachricht ist die offene Frage).

### D) Betroffene Bausteine (kein neues Paket, keine DB-Migration)

| Datei | Änderung |
|-------|----------|
| [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts) | Briefing-Schema: `suggested_question`+`next_focus` raus, `target_o_field` (Enum, optional) rein; STUFE 4 umframen; Halluzinations-Guard für `suggested_question` entfällt |
| [interviewTypes.ts](../../src/services/interviewTypes.ts) | `AnalystBriefing`: Felder anpassen (H-2-Invariante) |
| [talkerPrompt.ts](../../src/services/talkerPrompt.ts) | statischen Prompt entdichten; dynamischen Kontext auf bindenden Ziel-Block + Rohverlauf reduzieren; Closing-Methodik = Entdeckung; Anker-Pflicht relaxen; `abhaengigkeiten`-Hint ergänzen |
| [interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts) | Probe-Maschinerie + `CLOSING_PROBE_TEXT` löschen; Closing-Completion-Regel (phase-gebundener Streak); M7-b via `hadExtractionThisTurn`; `newStepThisTurn`/`hasNewStepThisTurn` löschen; Übergang-Grund + Ziel-O-Feld-Fallback; Erschöpfung bei voller O-Deckung (`hasUnexhaustedStep` + `computeFocusLock`) |
| [runInterviewTurn.ts](../../src/services/runInterviewTurn.ts) | `hadExtractionThisTurn` aus `analystResult.toolCalls` berechnen; Sonden-Injektions-Zweig entfernen; Übergang-Grund ableiten; Off-Topic-Redirect auf Talker-Call umstellen |
| [interviewSemantic.ts](../../src/services/interviewSemantic.ts) | `computeWalkthroughSlotTarget` ersatzlos löschen |
| [conversationSignals.ts](../../src/services/conversationSignals.ts) | auf `question-stem` eindampfen; `exception`, numerische `ambiguity`, `recentlyRecontextualized`, Drill-Stop, Laddering, `extractNumericTokens`/`anchorNumbers` löschen |
| [interviewTalker.ts](../../src/services/interviewTalker.ts) | schlanker Redirect-Pfad; `detectNumberAnchoring` + `isReconnect`-Flag löschen |
| [roleGuard.ts](../../src/services/roleGuard.ts) | Redirect erzeugt Talker-Call statt festem Text (`buildOffTopicRedirect` entfällt/wird ersetzt) |
| [reconnect/route.ts](../../src/app/api/interview/[token]/reconnect/route.ts) | Statiktext löschen, validierungs-only |
| [ChatInterface.tsx](../../src/components/interview/ChatInterface.tsx) | Reconnect-Zweig erzeugt keine Greeting-Bubble; `/reconnect` nur noch Validitäts-Ping |

### E) Löschkandidaten (Eval-gated — dokumentiert, falls nicht direkt entfernt)

Provisorisch erhalten, mit klarer Löschbedingung (Nutzer-Vorgabe: Löschkandidaten dokumentieren):

| Kandidat | Ort | Löschbedingung |
|----------|-----|----------------|
| `question-stem`-Detektor | `conversationSignals.ts` (Rest-Modul) | Eval bestätigt, dass Frage-Wiederholung ohne den Detektor nicht zurückkehrt → dann fällt das ganze Modul |
| `filler`-Tracking (`usedFillerPhrases` + `detectFillerPhrases`) | `interviewTalker.ts` + Talker-Prompt | an den Forced-Choice-/Akzeptanz-Phrasen-Pool gekoppelt (PROJ-43) — mit PROJ-43 gemeinsam prüfen |
| Rest-`conversationSignals.ts`-Modul | ganzes File | sobald `question-stem` fällt |

### F) Bau-Hinweise

- **Anchoring-Scorer-Koordination:** ohne `suggested_question` misst die Eval-Metrik `anchoringViolationRate` ([scorers/index.ts](../../src/services/__evals__/interview/scorers/index.ts)) eine jetzt unmögliche Leck-Klasse. Den Scorer sauber auf „leer/0" führen, nicht brechen lassen. (Instrument-Verfeinerung ist PROJ-40/31.)
- **Reihenfolge (Bau):** Briefing-Schema → Fokus-Lock-Rendering im Talker → Closing-Completion-Regel + M7-b → Signal-Kollaps/Entdichtung → Off-Topic-Redirect → Reconnect/Frontend.
- **Tests:** Ziel-O-Feld-Wahl am Lock (O2–O6-Priorität + Fallback), M7-b-`hadExtraction`-Veto, ≥1-Entdeckungsfrage-Garantie (Eintritts-Turn schließt nie ab), Erschöpfung bei voller O-Deckung (Lock rückt ohne K-Turn-Nachlauf, konvergiert mit `step_advance_ready`), Regressionstest „kein Briefing-Feld drückt Farewell/Terminierung aus" (H-2), Wegfall der gelöschten Symbole (keine Rest-Referenzen). `tsc --noEmit` + volle Suite grün.
- **Verifikation (Pflicht-Gate, general.md):** `/eval:interview` mit ≥1 PASS je Persona (buchhalter, it-support), gleiche Config/Seed wie PROJ-44-Runde-3, Judge-Key-Preflight mit echtem `generateText`-Call; Transkript-für-Transkript-Lektüre gegen die Runde-3-Baseline (H-2/BUG-4/M-6/M-7/L-1 nicht mehr reproduzierbar); manueller adversarialer (Tim-artiger) Durchlauf; Latenz unverändert (keine neue Naht auf dem Haupt-Pfad).

## Backend Implementation Notes

Gebaut 2026-07-18 (`/backend`), 1:1 nach Design (kein Abweichen). Alle sieben Ströme umgesetzt:

- **interviewSemantic.ts:** `OSlotField`-Typ exportiert; `computeWalkthroughSlotTarget` (Strom C/D3) und der jetzt ungenutzte `computeMissingMandatorySlots`/`MissingSlot` (Folge von Strom C's `coverageCheckSection`-Streichung) gelöscht.
- **interviewTypes.ts:** `AnalystBriefing.next_focus`/`suggested_question` raus, `target_o_field?: OSlotField` rein; `InterviewContext` um `focusStepId`/`transitionReason` (neuer `TransitionReason`-Typ) erweitert, `missingSlotsForCoverageCheck`, `lastUserTurn`, `recentUserTurns` entfernt.
- **interviewAnalyst.ts:** `AnalystBriefingSchema` trägt nur noch `target_o_field` (Enum, mit deterministischem Fallback), `step_advance_ready`, `clarification_cards` — exportiert für den H-2-Regressionstest. STUFE 4 umgeframt ("ist der Schritt gedeckt" statt "PRIMÄRER Treiber"). Neuer `computeTargetOFieldFallback`-Injection-Parameter (ballast-vermeidendes Muster wie `updateODrought`); `hasAppliedExtraction` exportiert (Basis für M7-b, geteilt mit `computeNextBriefing`).
- **interviewOrchestrator.ts:** `computeFocusLock`/`hasUnexhaustedStep` erschöpfen jetzt auch bei voller O2–O6-Deckung (D3); `computeTargetOFieldFallback` + `computeTransitionReason` neu; Probe-Maschinerie (`CLOSING_PROBE_TEXT` + Freunde) und `hasNewStepThisTurn` gelöscht; `resolveTurnLifecycle`s Closing-Zweig läuft rein über `ctx.phase==='closing' ∧ Streak≥K` statt Sonden-Antwort; `hadExtractionThisTurn` (M7-b) ersetzt `newStepThisTurn`.
- **talkerPrompt.ts:** `WALKTHROUGH_EXAMPLES`, Tool-Syntax-Verbot, `coverageCheckSection`, altes Briefing-/Anker-Sperre-Rendering entfernt; neuer `buildZielBlock` (bindender Ziel-Schritt + O-Feld-Hint, inkl. `abhaengigkeiten`); Closing-Methodik = Entdeckungs-Fortsetzung; Anker-Pflicht → Anker-Option.
- **conversationSignals.ts:** auf `repeatedQuestionStem` (question-stem) eingedampft; `exception`, numerische `ambiguity`, `recentlyRecontextualized`, Drill-Stop, Laddering, `extractNumericTokens`/`anchorNumbers` gelöscht. Signatur vereinfacht auf `analyzeConversationSignals(recentAssistantTurns)`.
- **interviewTalker.ts:** `detectNumberAnchoring` + totes `isReconnect`-Flag gelöscht; neue `createOffTopicRedirectStream` (schlanker Call, kein `buildDynamicContext`/Guard/Filler-Tracking).
- **roleGuard.ts:** `buildOffTopicRedirect` gelöscht (Redirect-Text jetzt Talker-formuliert).
- **runInterviewTurn.ts:** Off-Topic-Zweig ruft `createOffTopicRedirectStream`; Closing-Sonden-Injektionszweig entfernt; `farewellBriefing`-Konstrukt entfernt (kein Briefing-Feld kann Farewell ausdrücken, I1); `focusStepId`/`transitionReason` berechnet und in den Talker-Kontext durchgereicht.
- **reconnect/route.ts:** validierungs-only, leerer 200-Body (kein 204, da `useInterviewStream.ts`s `res.body.getReader()` bei 204 auf `null` liefe).
- **ChatInterface.tsx:** Reconnect-Zweig feuert `/reconnect` nur noch als Ping (`reconnect(() => {})`), erzeugt keine Greeting-Bubble mehr.

**Tests:** 12 Testdateien angepasst/neu, u.a. dedizierte Coverage für D1 (Ziel-O-Feld-Fallback + -Priorität), D3 (Erschöpfung bei voller O-Deckung, in `computeFocusLock` UND `hasUnexhaustedStep`), M7-b (`hadExtractionThisTurn`-Veto), die ≥1-Entdeckungsfrage-Garantie (Entry-Turn schließt nie ab) und die H-2-Strukturinvariante (`AnalystBriefingSchema.shape` hat nachweislich kein Freitext-Feld). `interviewSemantic.test.ts` komplett entfernt (deckte ausschließlich die beiden gelöschten Funktionen ab). `tsc --noEmit` grün, volle Suite 839/840 grün (1 Skip vorbestehend).

**Abweichungen vom Design:** keine.

**Noch offen (gehört zu `/qa`):** Pflicht-Eval-Gate (≥1 `/eval:interview`-PASS je Persona, Judge-Key-Preflight mit echtem `generateText`-Call), Transkript-für-Transkript-Lektüre gegen die PROJ-44-Runde-3-Baseline, manueller adversarialer (Tim-artiger) Durchlauf, Latenz-Vergleich, `anchoringViolationRate`-Scorer-Verhalten am echten Lauf verifizieren (Scorer selbst unverändert — er liest `turn.agentText`-Muster, nicht `suggested_question`, daher kein Code-Risiko, aber am Live-Transkript zu bestätigen).

## QA Test Results (2026-07-18)

**Produktionsreif: NEIN.** Pflicht-Eval-Gate (general.md, Interview-Engine) **rot**: 0 von 6 Läufen PASS; `completion_correctness` von R3-`true` auf `false` regrediert (beide Personas, alle Läufe, 35-Turn-Cap, Status bleibt `active`). Status bleibt **In Review**. Bugs: **2:0:1**.

### Automatisierte Tests
- `tsc --noEmit` grün.
- Volle Suite **839 passed / 1 skipped** (Skip vorbestehend). Deckt die neuen Ströme (D1-Ziel-O-Feld, D3-Erschöpfung, M7-b-Veto, H-2-Strukturinvariante) ab.

### Statische AC-Verifikation (bestanden)
- **Deletion-Tests (Strom C/E/F):** null Live-Referenzen auf alle gelöschten Symbole (`computeWalkthroughSlotTarget`, `CLOSING_PROBE_TEXT`, `WALKTHROUGH_EXAMPLES`, `buildOffTopicRedirect`, `detectNumberAnchoring`, `hasNewStepThisTurn`/`newStepThisTurn`, numerische `ambiguity`, `exception`, `recentlyRecontextualized`, `coverageCheckSection`); Rest-Treffer sind ausschließlich erklärende Kommentare.
- **H-2-Strukturinvariante (Strom A/D):** `AnalystBriefingSchema.shape` = exakt `{target_o_field (Enum), clarification_cards (strukturiert), step_advance_ready (boolean)}`, kein Freitext-Farewell-Kanal — direkt gegen die zod-Shape getestet.
- **M-6 (Lock bindend):** `buildZielBlock` rendert Ziel-Schritt aus `focusStepId` + `target_o_field`-Hint, Thema/O-Feld bindend, Wortlaut frei; `closing_entry`/`step_switch` tragen Übergangssatz (L-1).
- **Reconnect (Strom E):** validierungs-only, leerer 200-Body, token-authentifiziert via `access_token` + Rate-Limit, kein Cross-Workspace-Surface. ChatInterface feuert nur noch einen Ping.
- **Judge-Key-Preflight (KI-28-Lehre):** echter `generateText`-Call gegen beide Provider (Google Flash-Lite + Anthropic Haiku), beide OK — nicht nur `/v1/models`.

### Eval-Gate (Pflicht) — Konfiguration
Identisch zur PROJ-44-Runde-3-Baseline für saubere Attribuierung: alle Komponenten `google/gemini-3.1-flash-lite`, Judge `anthropic/claude-haiku-4-5`, `--store supabase --seed 42`, `--runs 3` je Persona. Artefakte: `docs/evals/interview/2026-07-18/*-{buchhalter,it-support}-{run1,run2,run3,aggregate}.md`.

| Metrik (Median) | R3-Baseline (2026-07-17) | PROJ-46 buchhalter | PROJ-46 it-support | Bewertung |
|---|---|---|---|---|
| dialog_naturalness | 0.67 / 0.67 | **0.67** | **0.67** | ✅ gehalten — Ent-Dichtung ohne KI-18-Regression (Kernrisiko) |
| dedup_slot_coverage | 0.56 / 0.56 | **0.67** | **0.69** (max 0.78) | ✅ deutlich verbessert — O-Feld-Tiefe durch bindenden Lock (M-6) |
| talker_grounding_violations | 0 / 0 | 0 (max 2) | 0 (max 1) | 🟡 Median gehalten, vereinzelt >0 (KI-18-Klasse, Guard-Backstop) |
| hallucination_rate | 0 | 0 | 0 | ✅ |
| step_registration_coverage | 1 | 1 | 1 | ✅ |
| anchoring_violation_rate | 0 | 0 | 0 | ✅ Scorer verkraftet Wegfall von `suggested_question` sauber (F-Note) |
| **completion_correctness** | **true** | **false** (3/3) | **false** (3/3) | ❌ **regrediert — Gate-Blocker** |
| turnsToCompletion | 14–33 | 35 (Cap) | 35 (Cap) | ❌ läuft in den 35-Turn-Sicherheits-Cap |

**PROJ-46-eigene Ziele erreicht:** `dialog_naturalness` gehalten (die Ent-Dichtung hat das lite-Modell nicht geschadet — das explizite KI-18-Risiko), `dedup_slot_coverage` klar über Baseline (bindender Fokus-Lock hebt O-Feld-Tiefe messbar, it-support run1 sogar 0.78 > grünes Gate). Grounding-Median 0.

### H-1 (High) — Interview terminiert nicht; `completion_correctness` true→false, 6/6 Läufe
`scoreCompletionCorrectness` = `status === 'completed'`. Alle sechs Läufe enden auf `active` im 35-Turn-Cap. **Doppelte Ursache:**

> **Korrektur nach Nutzer-Transkript-Review (2026-07-18):** die erste Fassung hier benannte das Eval-Timer-Artefakt als *primäre* Ursache. Das ist falsch — der Timer ist nur der Letzt-Boden. Die primäre Ursache ist, dass es für ein realistisches Interview **keinen erreichbaren graziösen Completion-Pfad** gibt. Beleg: run1 **t23** und run3 **t32** sagt der Agent „Damit sind alle meine Fragen beantwortet" — **bei phase=`explore` und 4 aktiven `record_slot`-Calls**. Der Agent hält sich für fertig; die State-Machine ist nicht mal in `closing`.

1. **Agent-Urteil ist kausal wirkungslos (Kern).** PROJ-46s H-2-Design verbietet Analyst/Talker jede Terminierung — Completion ist zu 100% deterministisch aus `phase` + Streak. Wenn der Agent „alle Fragen beantwortet" formuliert (run1 t23, run3 t32), gibt es **keinen Pfad**, der dieses korrekte Urteil in einen Abschluss übersetzt. Der gestrichene sonden-basierte Pfad (PROJ-42, KI-23-Fix) hatte genau das geleistet: Sonde beantwortet → complete.
2. **Die deterministische Completion ist für ein normales Interview unerreichbar.** Ein Schritt gilt erst als erschöpft/`done`, wenn **alle** O-Felder **und** die optionalen Potenzial-Slots (`error_rate_percent`, `media_breaks`) gefüllt sind (Auto-`done` in [applyIntent.ts:223](../../src/services/turnStore/applyIntent.ts#L223) + `isFullyCovered`) — die **KI-23-„praktisch-nie-true"-Bedingung**. Reale Personas liefern nicht jeden Slot (run1-Schritte: O2–O6 nur 3–4/6, Potenzial 2–3/4 — keiner vollständig). Also bleiben `hasUnexhaustedStep`/`hasActiveStep` dauerhaft true → die Phase ist in `explore` festgenagelt und erreicht nie ein stabiles `closing`. (Jenseits des Soft-Ankers, 80%≈24min, hält der Grace-Block [interviewOrchestrator.ts:205](../../src/services/interviewOrchestrator.ts#L205) `explore`, solange `hasActiveStep` — und das ist immer.)
3. **Die zwei „Böden" feuern beide nicht.** Der No-New-Extraction-Streak (K=3) erreicht 3 nie, weil jede angewendete Extraktion ihn auf 0 setzt ([interviewAnalyst.ts:97](../../src/services/interviewAnalyst.ts#L97)) und M7-b (`hadExtractionThisTurn`) closing→explore routet — und Extraktion passiert quasi jeden Turn (auch aus Floskeln + konfabulierten Schritten, s. H-2). Der Hard-Timer ist im Eval-Harness zusätzlich unerreichbar (`floor((turn/35)*30)` = max 29 < 30, [runner.ts:827](../../src/services/__evals__/interview/runner.ts#L827); in Prod würde er bei echter Wall-Clock irgendwann greifen, aber als Force-Ende bei 100%, nicht als graziöser Abschluss).

**Damit verfehlt PROJ-46 seine eigene Strom-D-AC** („Terminierung … kann nicht endlos laufen"): für ein realistisches (nicht voll-abgedecktes) Interview terminiert es faktisch nie außer per Wall-Clock-Force. Das ist die **KI-23-Completion-Regression** — PROJ-42 hatte sie via Sonden-Pfad gelöst, PROJ-46 hat den Pfad entfernt (Strom D) und durch Böden ersetzt, die für den Normalfall nicht greifen.

**Fix-Richtung (Entwickler-Entscheidung, nicht QA):** ein erreichbarer graziöser Abschluss — entweder ein Disengagement-/Agent-Urteil-Signal, das Completion auslösen darf, oder ein gelockerteres Erschöpfungs-Kriterium (Schritt „gedeckt genug" ohne jeden optionalen Slot), sodass `hasActiveStep`/`hasUnexhaustedStep` mit der O-Coverage-Erschöpfung (D3) konvergieren statt mit der KI-23-Alles-Slots-Bedingung. Der Timer-Artefakt gehört ebenfalls gefixt (damit der Eval den Boden überhaupt prüfen kann), ist aber **sekundär**.

### H-2 (High) — Extraktions-Rausch im Closing (Floskel-Slots + unbegrenzte Schritt-Registrierung)
> **Reframing nach Nutzer-Diskussion (2026-07-18):** die erste Fassung nannte das „Konfabulation" und Mit-Ursache der Non-Termination. Beides zu scharf — Prüfung gegen Persona + Transkript:
- **Mahnprozess/Mahnlauf ist korrektes Nachhaken, kein Fehler.** Die Persona hat einen versteckten 3. Prozess (`additionalContext: "Monatlicher Mahnprozess … im Interview aber noch nicht aktiv angesprochen"`). run1 und run2 haben ihn korrekt aufgedeckt — Beleg **für** die Elicitation.
- **Stammdatenpflege / sachkontenabstimmung (run2):** plausible eigenständige Buchhalter-Aufgaben, von der Tester-Persona-LLM improvisiert (die Persona-Definition hat `expectedProcessCount: 2` + nur den einen Mahnprozess-Hint). Die Ground-Truth hat für sie keine Soll-Slots → die Coverage-Metriken werden verzerrt. **Das ist primär eine Eval-Instrument-Grenze, kein Agent-Bug.** In Prod wären real herausgeholte Zusatzprozesse legitim.
- **Non-Termination ist NICHT hierdurch verursacht:** **run1 hat ausschließlich persona-gegroundete Schritte** (Rechnungsprüfung, Monatsabschluss, Mahnlauf) und terminierte trotzdem nicht. H-1 ist unabhängig.

Der reale, prod-relevante Kern von H-2: **Extraktions-Rausch** — `record_slot` aus reinen Höflichkeitsfloskeln (run1 t34: **16 `record_slot`-Calls** auf „Auf Wiedersehen und ebenso alles Gute für die weitere Dokumentation") und, im Closing, **unbegrenzte neue Schritt-Registrierung**. Beides resettet den globalen `noNewExtractionStreak` (`hasAppliedExtraction` = jeder Write) → der deterministische Abschluss-Boden feuert nicht (koppelt eng an H-1/Fix D) und die Wissensbasis bekommt Floskel-Slots. Der 9-Turn-Farewell-Loop (run1 ab t27) ist **Symptom**, nicht Ursache: der State kann nicht terminieren (H-1), also spiegelt der Talker endlos die Abschiede.

### L-1 (Low) — vereinzelte `talker_grounding_violations` > 0
Median 0 beide Personas, aber Max 2 (buchhalter run1) / 1 (it-support run1). KI-18-Klasse, dokumentiert offen, Guard bleibt Backstop; die Anker-Pflicht→Option-Relaxierung (Strom F) hat den Median nicht verschlechtert. Kein PROJ-46-Regressions-Blocker, als Leitindikator (Strom G) protokolliert.

### Nicht reproduzierbar / bestätigt behoben (Transkript-Level)
- **M-6 (Ping-Pong gegen den Lock):** kein Themen-Ping-Pong gegen den Fokus-Lock beobachtet; die Tiefe (dedup 0.56→0.67/0.69) belegt den bindenden Lock. ✅
- **BUG-4 (wortgleiche statische Sonde):** kein wiederholter statischer `CLOSING_PROBE_TEXT` — Closing-Fragen sind Talker-formuliert und variieren (run2 t30-t35: durchweg frische, spezifische Fragen). ✅
- **Off-Topic-Redirect / Reconnect:** kein Off-Topic-Fall in diesen Personas ausgelöst (Personas bleiben im Thema); Reconnect-Pfad statisch verifiziert (s.o.), kein Live-Reconnect im Eval-Harness.

### Offene Verifikation (nicht durchgeführt, blockiert durch H-1)
Der geforderte manuelle adversariale (Tim-artige) Durchlauf und die Latenz-Delta-Messung sind erst nach H-1-Fix sinnvoll — solange das Interview nicht terminiert, misst ein manueller Durchlauf dasselbe Nicht-Abschluss-Verhalten.

### Fix-Plan für `/backend` (Nutzer-Entscheidung 2026-07-18)

**Reihenfolge: A+D zuerst (rein deterministisch). Wenn der nächste Eval-Lauf zeigt, dass A+D nicht greift → B/C testen.**

Grundprinzip „gut genug" (deterministisch, kein LLM): ein Schritt ist **erschöpft**, wenn (1) alle **7** O2–O6-Felder gefüllt sind (`isFullyCovered`) ODER (2) der O-Drought feuert = **K=3** Turns in Folge kein neues O-Feld (`updateODrought`). Terminierungs-Garantie: pro Schritt gibt es 7 O-Felder, jedes geht nur leer→voll (Monotonie) → ein Schritt kann seinen Drought höchstens 7× resetten → nach ≤~10 Fokus-Turns zwingend erschöpft → bei endlich vielen Schritten terminiert das Interview. K ist env-tunbar (`O_DROUGHT_LIMIT` / `NO_NEW_EXTRACTION_LIMIT`).

Die Garantie existiert schon (`updateODrought`/`hasUnexhaustedStep`), drei Lecks umgehen sie:

- **Fix A (Konsistenz, Phasenübergang):** `hasActiveStep` ([interviewOrchestrator.ts:205](../../src/services/interviewOrchestrator.ts#L205)) liest rohen `status` (`exploring`/`walkthrough`) statt Erschöpfung → nagelt `explore` fest. An dieselbe Erschöpfungs-Logik koppeln wie der Fokus-Lock (`hasUnexhaustedStep`/`isFullyCovered`+Drought). Dann lässt ein O-erschöpfter Schritt die Phase tatsächlich los. Hält ADR-023 D2 („Analyst terminiert nicht") intakt.
- **Fix D (Rausch-Robustheit, Abschluss-Terminator):** der globale `noNewExtractionStreak` ([interviewAnalyst.ts:97](../../src/services/interviewAnalyst.ts#L97)) zählt via `hasAppliedExtraction` **jeden** angewendeten Write (Floskel-Slots, Re-Records, Potenzial). Auf „echtes neues O-Feld" umstellen — denselben O-Feld-Diff wie `updateODrought`. Schließt das run1-Floskel-Leck (t34: 16 Slots auf „Auf Wiedersehen").
- **Fix D2 (Schritt-Registrierung im Closing begrenzen):** unbegrenzte neue Top-Level-Schritte im Closing brechen die „endlich viele Schritte"-Prämisse. Begrenzen bzw. spurious Registrierung verhindern (H-2-Teil).
- **Sekundär (Eval-Instrument, KEIN Primär-Fix):** der Harness-Timer `floor((turn/35)*30)` erreicht max 29 < 30, der Hard-Stop-Boden ist im Eval nie prüfbar. Fixen (z.B. `((turn+1)/MAX_TURNS)*30`), damit der Letzt-Boden im Eval sichtbar wird — aber A+D sind der eigentliche Fix.

**Fallback B/C (nur falls A+D im Eval nicht greifen):** dem Analyst ein **strukturiertes** „Interview inhaltlich abgeschlossen"-Boolean geben, das Completion **auslösen** darf, mit den zwei deterministischen Böden (Timer + Mindest-Coverage) als Guard. Kein Freitext-Farewell (das war H-2/Split-Brain). Reskaliert ADR-023 von „Analyst darf nicht terminieren" zu „Analyst darf Completion-Readiness signalisieren, terminiert aber nicht selbst". Nutzt die im Transkript belegte Fähigkeit des Agenten, plausibel abzuschließen (run1 t23, run3 t32).

**Follow-up (nach grünem Gate, separat):** `status`-Feld ganz auf Coverage vereinheitlichen (löschen). Ist die logische Fortsetzung von A, aber ein Refactor mit Schema-/Persistenz-Folgen + einem Downstream-Konsumenten ([processEnrichment.ts:119](../../src/services/processEnrichment.ts#L119) enricht nur `status !== 'exploring'` → braucht Coverage-Ersatz für „enrichment-reif") — nicht der minimale Gate-Fix.

### Re-Verifikation (nach `/backend`, in frischem `/qa`)
- `/eval:interview` erneut, **gleiche Config** (buchhalter+it-support, flash-lite, Haiku-Judge, `--store supabase --seed 42 --runs 3`) — direkt gegen die heutigen 2026-07-18-Artefakte vergleichbar.
- **Primär-Gate:** `completion_correctness` = true (kein 35-Turn-Cap), Transkript-Lektüre: kein Farewell-Loop, sauberer Abschluss zum Zeitpunkt des Agent-„fertig"-Urteils.
- **Halten:** `dialog_naturalness` ≥ 0.67, `dedup_slot_coverage` ≥ 0.67/0.69 (nicht durch die Fixes verschlechtern), Grounding-Median 0.
- Der noch offene manuelle adversariale (Tim-artige) Durchlauf + Latenz-Delta.

Bis dahin bleiben **PROJ-42, PROJ-44, PROJ-46** gemeinsam **In Review** (gemeinsame Gate-Entscheidung laut Spec).

### Fix-Runde 1 (`/backend`, 2026-07-18) — A+D+D2 + Eval-Timer-Artefakt

Alle vier im Fix-Plan genannten Punkte umgesetzt (A, D, D2, Eval-Timer-Artefakt) — B/C-Fallback bewusst nicht angefasst (Nutzer-Reihenfolge: erst A+D im Eval prüfen).

- **Fix A** ([interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts)): `hasActiveStep` in der `explore`-Soft-Anchor-Grace-Logik liest jetzt `hasUnexhaustedStep(ctx.stepTracker, ctx.oDrought)` statt des rohen `status`-Checks (`hasStepInStatus(...'exploring'|'walkthrough')`). Ein O-erschöpfter Schritt (volle O2–O6-Deckung oder Drought gefeuert) kauft sich am Soft-Anchor (~80% Budget) keine zusätzliche `MAX_GRACE_MINUTES`-Gnadenfrist mehr.
- **Fix D** ([interviewSemantic.ts](../../src/services/interviewSemantic.ts), [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts), [runInterviewTurn.ts](../../src/services/runInterviewTurn.ts)): neue geteilte Primitive `hasNewOField(before, after)` (Summe der gefüllten O2–O6-Felder über den GESAMTEN Tracker, vorher/nachher) ersetzt `hasAppliedExtraction` (jeder angewendete Tool-Write) als Reset-Signal — sowohl für `computeNextBriefing`s `noNewExtractionStreak` als AUCH für `runInterviewTurn.ts`s `hadExtractionThisTurn` (M7-b-Veto). **Bewusste Erweiterung über den wörtlichen Fix-Plan-Wortlaut hinaus** (der nur `interviewAnalyst.ts:97` nannte): Analyse ergab, dass beide Konsumenten denselben zu breiten `hasAppliedExtraction`-Signal-Ursprung teilen (H-1-Befund Punkt 3 nennt explizit beide als gemeinsame Blockade) — mit nur dem Streak gefixt hätte M7-b weiterhin auf JEDEN Write (auch Potenzial-only/Re-Records) mit einem Bounce Closing→Explore reagiert, sodass `ctx.phase` nie zwei aufeinanderfolgende Turns in `closing` bleibt, was die `ctx.phase==='closing' && streak>=limit`-Completion-Bedingung strukturell unerreichbar hält. Eine genuine Neu-Entdeckung während Closing bleibt unverändert über `hasStepInStatus(...'exploring')` abgefangen (nicht von der Signal-Verengung betroffen). `hasAppliedExtraction`/`EXTRACTION_TOOL_NAMES` komplett gelöscht (nach der Verengung ungenutzt).
- **Fix D2** ([interviewTools.ts](../../src/services/interviewTools.ts)): der bisher nur prompt-seitig behauptete „Hard Cap: 5" ist jetzt in `register_step` selbst durchgesetzt (nach allen Dedup-Layern, vor dem Anlegen eines genuinen neuen Eintrags) — schließt die „endlich viele Schritte"-Prämisse der Terminierungs-Garantie.
- **Eval-Timer-Artefakt** ([runner.ts](../../src/services/__evals__/interview/runner.ts)): `simulatedTimerMinutes` von `Math.floor((turn/MAX_TURNS)*30)` auf `Math.floor(((turn+1)/MAX_TURNS)*30)` — erreicht jetzt exakt 30 auf dem letzten Turn, der Hard-Stop-Boden ist damit im 35-Turn-Eval-Cap überhaupt erreichbar/prüfbar.

**Tests:** neue `interviewSemantic.test.ts` (6 Tests für `hasNewOField`, inkl. Potenzial-only/Re-Record-Nichtauslösung), 2 neue Fix-A-Regressionstests (`interviewOrchestrator.test.ts`), 1 neuer Fix-D2-Test (`interviewTools.test.ts`), `computeNextBriefing`-Tests auf die neue `hadNewOField`-Boolean-Signatur umgestellt (`interviewAnalyst.test.ts`), `runInterviewTurn.test.ts`-Mock bereinigt (kein `hasAppliedExtraction`-Stand-in mehr nötig — `hasNewOField` läuft ungemockt gegen die Test-Fixtures). `tsc --noEmit` grün, volle Suite **847 passed / 1 skipped** (vorher 839/1 — 8 neue Tests, kein Regressions-Fail).

**Abweichungen vom Fix-Plan:** M7-b (`hadExtractionThisTurn`) zusätzlich zum Streak auf `hasNewOField` umgestellt (siehe Fix-D-Begründung oben) — der Fix-Plan-Text nannte wörtlich nur den Streak, die Erweiterung auf M7-b ist notwendig, damit der Fix überhaupt wirkt (sonst bleibt die vom H-1-Befund selbst benannte zweite Bounce-Quelle offen). D2 als globaler (nicht nur Closing-scoped) Cap umgesetzt — deckungsgleich mit dem bereits prompt-seitig global geltenden „Hard Cap: 5", einfacher als eine Phasen-Schranke.

**Noch offen:** Re-Eval via `/eval:interview` (gleiche Config wie Runde-3-Baseline: buchhalter+it-support, flash-lite, Haiku-Judge, `--store supabase --seed 42 --runs 3`) — gehört zu `/qa`, nicht Teil dieser Backend-Runde. Bis dahin bleibt Status **In Review**.

### QA-Runde 2 (Re-Eval, 2026-07-18/19) — A+D+D2 verifiziert, Wurzel identifiziert, B/C beschlossen

Konfiguration identisch zur Baseline (flash-lite, Haiku-Judge, `--store supabase --seed 42`). Judge-Preflight mit echtem `generateText`-Call gegen beide Provider grün (KI-28-Lehre). Alle Läufe n=1 (Smoke, kostenschonend vor 3+3), gleicher Seed 42, direkt vergleichbar.

**Primär-Gate (H-1) erholt.** Fix-Runde-1 (A+D+D2, K=3, cap=5) bringt `completion_correctness` auf **true bei beiden Personas** (Runde 1 war `false`, 6/6 im 35-Cap). `dialog_naturalness` 0.67 gehalten, `talker_grounding_violations` Median 0, `anchoring_violation_rate` 0.

| Zustand | dedup buch/it | completion | buchhalter-Abschluss | it-support-Abschluss |
|---|---|---|---|---|
| PROJ-46 R1 (ohne A/D/D2) | 0.67 / 0.69 | false | 35-Cap | 35-Cap |
| **Fix-Runde-1** (K3, cap5) | 0.56 / 0.62 | **true** | Turn 10, grazil | Turn 35, Timer-Force |
| Experiment (K5, cap8) | 0.70 / 0.64 | true | Turn 30, **6-Turn-Farewell-Loop** | Turn 35, Timer, kein Loop |

**Die „dedup-Regression" gegen 0.67/0.69 ist ein Phantom.** Diese Werte stammen aus dem **nicht-terminierenden** R1-Lauf (ein Interview, das bis 35 läuft, füllt mehr Slots). Gegen die legitime **R3-Baseline (0.56/0.56)** hält Fix-Runde-1 (0.56/0.62): buchhalter gleichauf, it-support besser. Der grüne Tiefen-Gate (≥0.75) ist laut Strom G ohnehin nicht PROJ-46-eigen (PROJ-43/PROJ-40). Fix-Runde-1 erfüllt PROJ-46s eigenes Tiefen-Kriterium („≥ R3-Baseline, Trend hoch") knapp.

**Zwei Restbefunde in Fix-Runde-1:**
- buchhalter terminiert bei Turn 10 (kürzer als R3-Baseline 14–33), möglicherweise verfrüht (dünnere Tiefe).
- it-support terminiert nur per Hard-Timer bei Turn 35, nicht grazil. Residual: 2-Turn-Doppel-Verabschiedung (Runde 1: 9-Turn-Loop, also stark verbessert).

**K-Experiment (Nutzer-Entscheidung „Cap anheben + Wurzel testen"): K ist der falsche Hebel.** K=5 holt die Tiefe zurück (dedup 0.70/0.64, `potenzial_coverage` + `dependency_capture` steigen), **reintroduziert aber den Farewell-Loop** (buchhalter Turns 25–30, sechs Verabschiedungen). Mechanisch: die Loop-Länge ist ≈ K. Läuft der Agent im Closing content-arm trocken, verabschiedet er sich K-mal, bis der Streak nachzieht. Höheres K = tiefer, aber längerer Loop; niedrigeres = kürzerer Loop, aber flacher. **Kein K-Wert gewinnt beides.** it-support zeigte den Loop nicht (content-reich genug, bleibt bis zum Timer produktiv). Der Cap=8 wurde nie geprüft: K=5 hält jeden Schritt länger, also weniger Schritte (it-support 5→4), der Cap band nie.

**Wurzel:** der content-basierte Terminator (No-New-O-Field-Streak) zählt neue O-Felder (breiten-blind gegen Tiefe) UND feuert K trockene Turns nachdem der Agent leergelaufen ist. Beide Symptome (flacher Abschluss bei K3, Farewell-Loop bei K5) sind dasselbe fehlende Stück: das „ich bin inhaltlich fertig"-Urteil des Agenten kann Completion nicht auslösen.

**Beschluss (Nutzer, 2026-07-19): Fallback B/C bauen, via `/architecture` zuerst.** Der Analyst signalisiert strukturierte Completion-Readiness, die Completion auslösen darf, geguardet durch Timer + Mindest-Coverage. Kollabiert den Farewell-Loop auf 0 (Abschluss genau wenn der Agent fertig ist) und erlaubt Tiefe (der Agent bohrt bis er wirklich fertig ist, nicht bis ein breiten-blinder Streak ihn abschneidet). Scope-Konsequenz für die zwei Böden (im /architecture zu schärfen):

| | unter B/C |
|---|---|
| Hard Cap (`MAX_REGISTERED_STEPS`) | entfernbar (Termination geht an B/C + Timer; Fragmentierung bleibt an den Dedup-Schichten, nicht am Cap) |
| `NO_NEW_EXTRACTION_LIMIT` (Completion-Streak) | entfernbar (von B/C ersetzt; optional als billiger Disengagement-Guard) |
| `O_DROUGHT_LIMIT` (Fokus-Lock) | **behalten** — orthogonaler Fortschritts-Boden (Anti-Ping-Pong M-6), B/C fasst ihn nicht an |

B/C reshaped nur den **Terminierungs**-Boden; der **Fortschritts**-Boden bleibt. Braucht ein ADR-023-Amendment („Analyst darf Completion-Readiness signalisieren, terminiert aber nicht selbst"). Working Tree nach diesem Experiment auf Fix-Runde-1 zurückgesetzt (Cap=5, K-Env entfernt), damit der B/C-Diff sauber ansetzt. Experiment-Eval-Artefakte behalten (`docs/evals/interview/2026-07-18/2026-07-18-23-{34,49}-*`) als Design-Evidenz.

**Status:** weiter **In Review**. PROJ-42, PROJ-44, PROJ-46 bleiben gemeinsam In Review bis zum grünen Re-Eval nach B/C. Bugs-Feld unverändert 2:0:1 (die H-1-Regression aus Runde 1 ist adressiert, aber erst nach B/C-Re-Eval final zu bewerten).

## Tech Design Amendment: Fallback B/C (Completion-Readiness)

> Erarbeitet via `/architecture` (2026-07-19) nach QA-Runde 2. Festgehalten in **[ADR-024](../../docs/adr/ADR-024-analyst-completion-readiness-geguardetes-boolean.md)** (Amendment zu ADR-023 D2/D4, Status Proposed). Keine DB-Migration, kein neues npm-Paket, rein serverseitig.

### Entscheidung: Design 2 (Analyst-Readiness darf Closing eröffnen UND besiegeln)

Design 1 (Readiness besiegelt nur aus Closing) wurde verworfen: es lässt die H-1-Diskrepanz offen (der Agent urteilt „fertig" während `explore`, das Signal bleibt wirkungslos, bis die Phasenmaschine mechanisch Closing erreicht, siehe H-1 run1 t23 / run3 t32). Design 2 gibt dem Agenten-Urteil einen Kausalpfad.

### Split-Brain-Auflösung (Kern der Entscheidung)

Es gibt genau **eine Autorität**: die deterministische Phasenmaschine (`resolveTurnLifecycle`). Der Analyst schreibt nie Phase oder Completion. Er liefert **ein strukturiertes Boolean** `discovery_exhausted` als **Input**. Die Maschine konsumiert es und entscheidet:

- `explore` + `discovery_exhausted` + Guard → **Closing eröffnen** (Wrap-up einleiten), Entdeckungs-Sonde stellen, noch **nicht** abschließen (die Sonde ist die „mindestens eine Frage vor dem Ende"-Garantie).
- `closing` + `discovery_exhausted` + Guard → **abschließen**.

Analyst und Maschine können sich damit nicht widersprechen: der Analyst schlägt vor, die Maschine verfügt. Der H-1-Split-Brain existierte, weil das Agenten-Urteil keinen Eingangskanal zur Maschine hatte. B/C fügt genau diesen Kanal hinzu, als geguardetes Boolean. Urteil und Maschine konvergieren.

### H-2-Invariante bleibt intakt

`discovery_exhausted` ist ein **Boolean**, kein Freitext. Es kann nur „ich beurteile die Entdeckung als erschöpft" ausdrücken, nie „verabschiede dich". Der Freitext-Farewell-Kanal, den ADR-023 strukturell ausschloss (H-2), entsteht nicht. Die Verabschiedung formuliert weiter der Talker, ausgelöst allein vom aufgelösten Completion-State (`isCompletionFarewell`, unverändert).

### Warum das den Farewell-Loop kollabiert

Der Loop entstand, weil zwischen „Agent läuft trocken" und „Streak erreicht K" K Turns lagen. Readiness feuert im selben Turn, in dem der Analyst „fertig" urteilt. Kein Warte-Fenster, keine Verabschiedungs-Wiederholung.

### Guards (leicht, measure-first)

Weil Readiness Closing eröffnen darf, braucht es eine Untergrenze gegen verfrühten/flachen Abschluss. Bewusst minimal gehalten, um zu testen, ob eine Analyst-geführte Entscheidung funktioniert:

- **Inhärent:** mindestens eine Closing-Entdeckungs-Sonde muss durchlaufen sein (aus dem Zwei-Schritt-Fluss).
- **Coverage-Sanity:** Readiness wird erst gehonoriert, wenn mindestens ein registrierter Schritt substanziell gedrillt ist (nie leer abschließen).
- **Upper-Bound:** der Hard-Timer bei 100% Budget bleibt unverändert der Letzt-Boden.
- **Kein harter Zeit-Floor** zu Beginn. Zeigt der Eval verfrühte Abschlüsse, wird der Floor angezogen.

### Fail-Safe

Analyst-Call schlägt fehl → `discovery_exhausted` = false → kein Readiness-Abschluss → Hard-Timer bleibt Backstop. Deckungsgleich mit dem bestehenden ADR-021-D4-Veto (Fail-Safe vetoet `soft_confirm`).

### Was entfällt / bleibt

| | unter B/C |
|---|---|
| `NO_NEW_EXTRACTION_LIMIT` (Completion-Streak) | **entfällt** (von Readiness ersetzt) |
| Hard Cap (`MAX_REGISTERED_STEPS`) | **entfällt** (Completion braucht keine „endlich viele Schritte" mehr; Fragmentierung bleibt an den Dedup-Schichten) |
| `O_DROUGHT_LIMIT` (Fokus-Lock) | **bleibt** bei 3 — orthogonaler Fortschritts-Boden (Anti-Ping-Pong M-6), B/C fasst ihn nicht an |
| Wall-Clock Soft-Anchor + Hard-Timer | **bleiben** unverändert (Upper-Bound) |
| M7-b Reentry (neuer Inhalt in Closing → explore) | **bleibt** unverändert |

**Disengagement-Notiz:** der Streak fing auch disengagierte Gespräche vor dem Wall-Clock ab. Unter B/C soll der Analyst Disengagement erkennen und via Readiness früh abschließen. Falls der Eval zeigt, dass disengagierte Personas zu lange laufen, kann ein leichter deterministischer Disengagement-Escalator nachgezogen werden (measure-first).

**Tiefe (O_DROUGHT):** bleibt in diesem Increment bei 3. Die Loop-Entkopplung erlaubt später ein Anheben für mehr O-Feld-Tiefe (dedup) ohne Farewell-Kosten. Separater measure-first-Schritt nach verifiziertem B/C (Nutzer-Entscheidung). Dieser Increment misst mit, ob die Analyst-geführte Completion überhaupt sauber greift.

### Betroffene Bausteine (kein neues Paket, keine DB-Migration)

| Datei | Änderung |
|-------|----------|
| [interviewTypes.ts](../../src/services/interviewTypes.ts) | `AnalystBriefing` um `discovery_exhausted: boolean` erweitern (strukturiert, H-2-invariant) |
| [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts) | Prompt: wann `discovery_exhausted` setzen (Entdeckung erschöpft, Persona bietet nichts Substanzielles mehr); Schema; Streak-Berechnung (`computeNextBriefing`/`hasNewOField`-Reset) entfällt |
| [interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts) | `resolveTurnLifecycle`: Readiness treibt `explore→closing` (mit Sonde) + `closing→complete`; Streak-Completion + `NO_NEW_EXTRACTION_LIMIT` raus; Coverage-Sanity-Guard; `O_DROUGHT`-Lock unangetastet |
| [interviewTools.ts](../../src/services/interviewTools.ts) | Hard Cap (`MAX_REGISTERED_STEPS`) entfernen |
| [runInterviewTurn.ts](../../src/services/runInterviewTurn.ts) | `discovery_exhausted` in den Orchestrator-Context durchreichen; `hadExtractionThisTurn`/M7-b bleibt |

### ADR

Festgehalten in **[ADR-024](../../docs/adr/ADR-024-analyst-completion-readiness-geguardetes-boolean.md)** (Status **Accepted**, 2026-07-19 — vor `/backend` B/C angenommen): „Der Analyst darf geguardete Completion-Readiness (strukturiertes Boolean `discovery_exhausted`) signalisieren; er terminiert und formuliert die Verabschiedung nicht selbst. Die deterministische Phasenmaschine bleibt alleinige Autorität und konsumiert das Signal als Input." Amendmentet ADR-023 D2 („Analyst terminiert nicht") + D4 (Streak-Terminierung); die Invarianten I1 (kein Freitext-Farewell) und I2 (Terminierungs-Hoheit beim Orchestrator) sowie der Fortschritts-Boden (O_DROUGHT) bleiben strukturell wahr.

### Eval-Plan (Re-Verifikation nach Bau)

Gleiche Config wie die Baseline (flash-lite, Haiku-Judge, `--store supabase --seed 42`), erst 1+1 Smoke, dann 3+3. Prüfen: `completion_correctness` = true **via Readiness** (nicht nur Timer); buchhalter **kein** Farewell-Loop UND Abschluss zum Zeitpunkt des Agenten-„fertig"-Urteils (nicht verfrüht); it-support grazil-oder-Timer; `dialog_naturalness` ≥ 0.67; `dedup_slot_coverage` ≥ 0.56/0.62; Grounding-Median 0. Transkript-Level: der H-1-Fall „Agent fertig während explore" konvergiert jetzt (Readiness → Closing → Abschluss).

## Backend Implementation Notes (B/C, 2026-07-19)

Gebaut 1:1 nach dem Tech Design Amendment oben, keine Abweichung. ADR-024 vor Baubeginn auf Accepted gesetzt.

- **interviewTypes.ts:** `AnalystBriefing.noNewExtractionStreak` entfernt, `discovery_exhausted?: boolean` neu (dokumentiert als geguardetes Completion-Readiness-Signal, kein Freitext-Kanal — I1/I2 bleiben wahr).
- **interviewAnalyst.ts:** `AnalystBriefingSchema` trägt `discovery_exhausted` (zod boolean, optional); neue STUFE 4b im System-Prompt mit expliziten Trigger-Bedingungen (Wiederholung, Ausweichen, Höflichkeits-/Abschiedsfloskeln, explizites „nichts mehr"). Die `produce_briefing`-Aufruf-Bedingung wurde erweitert: ein inhaltlich leerer/ausweichender Turn (bisher der Grund, den Call zu überspringen) ist jetzt genau der typische Auslöser für `discovery_exhausted` und MUSS den Call triggern — sonst hätte STUFE 4b nie einen Weg zum Orchestrator gehabt. `computeNextBriefing` auf pure Carry-Forward reduziert (3 statt 4 Parameter, keine Streak-Berechnung mehr); `hasNewOField`-Import entfernt (in dieser Datei nur noch für die Streak gebraucht). „Hard Cap: 5" aus dem Kontext-Footer des Prompts entfernt.
- **interviewOrchestrator.ts:** `noNewExtractionLimit()`/`DEFAULT_NO_NEW_EXTRACTION_LIMIT`/`NO_NEW_EXTRACTION_LIMIT`-Env entfernt. Neue Coverage-Sanity-Guard `hasSubstantialCoverage` (≥2 gefüllte O2–O6-Felder auf mindestens einem Schritt, `MIN_SUBSTANTIAL_O_FIELDS=2`) — verhindert ein leeres/kaum begonnenes Interview per Readiness abzuschließen. `resolvePhaseTransition`s `explore`-Fall: neuer `discovery_exhausted`-Zweig (Guard-gated) öffnet Closing, ersetzt den alten Streak-Zweig; der bestehende `step_advance_ready`-getriebene Primary-Driver-Pfad bleibt unverändert daneben bestehen (orthogonal, nicht Teil von B/C). `resolveTurnLifecycle`s Closing-Terminal-Check: `discovery_exhausted && Coverage-Sanity` statt Streak — `ctx.phase==='closing'` (die VORTURN-geladene Phase) bleibt der Mechanismus, der ein Complete im selben Turn wie die Closing-Eröffnung strukturell verhindert (Design 2 „mindestens eine Frage zuerst" fällt aus dieser bestehenden Prüfung heraus, kein zusätzlicher Code nötig). `O_DROUGHT_LIMIT`/`computeFocusLock`/`updateODrought`/`hasUnexhaustedStep` unangetastet (Fortschritts-Boden, D5).
- **interviewTools.ts:** `MAX_REGISTERED_STEPS`-Hard-Cap (PROJ-46 QA H-1 Fix D2) + die zugehörige `register_step`-Prüfung ersatzlos entfernt (ADR-024 D4 — Completion braucht die „endlich viele Schritte"-Prämisse nicht mehr; Fragmentierung bleibt an den Dedup-Schichten).
- **runInterviewTurn.ts:** keine Änderung nötig — `discovery_exhausted` erreicht `resolveTurnLifecycle` bereits strukturell über den unverändert durchgereichten `analystBriefing`-Parameter (derselbe Pfad wie zuvor `step_advance_ready`/`noNewExtractionStreak`). Der bestehende ADR-021-D4-Fail-Safe (vetoet `soft_confirm` bei einem in diesem Turn fehlgeschlagenen Analyst-Call) deckt die ADR-024-Fail-Safe-Anforderung bereits ab, ohne Änderung — der Veto-Check greift phasen-/grund-agnostisch an jedem `soft_confirm`.

**Tests:** `computeNextBriefing`-Tests auf die neue 3-Parameter-Signatur umgestellt (kein Streak mehr). `resolveTurnLifecycle`-Tests: der „no-new-extraction safety net"-Block ersetzt durch einen `discovery_exhausted`-Readiness-Block (Coverage-Sanity-Guard positiv/negativ getestet); die `closing`-Testgruppe und die D2-Terminierungs-Invariante-Gruppe auf `discovery_exhausted` umgestellt (neue Fixture `substantiallyCoveredSlots`, exakt 2 gefüllte O-Felder — isoliert die Coverage-Sanity-Guard von D3s „volle Deckung erschöpft sofort"). `interviewOrchestrator.tim-regression.test.ts`: die reale Tim-Sequenz-Assertion nutzt jetzt `discovery_exhausted: true` statt `noNewExtractionStreak: 3` (Coverage-Sanity durch den echten `REAL_FINAL_TRACKER` erfüllt, der bereits mehrere O-Felder gefüllt hat). `interviewTools.test.ts`: der Hard-Cap-Test invertiert zu einer Regression („ein 6. Schritt registriert erfolgreich"). H-2-Strukturinvariante erweitert: `discovery_exhausted` ist Boolean, keine Freitext-Terminierung möglich (zod-Shape-Test). `tsc --noEmit` grün, volle Suite **846 passed / 1 skipped** (vorher 847/848 mit Fix-Runde-1 — Netto 1 Test weniger: die `NO_NEW_EXTRACTION_LIMIT`-Env-Override-Testfall entfällt ersatzlos, da die Env-Variable selbst entfällt).

**Abweichungen vom Design:** keine. Der `step_advance_ready`-getriebene explore→closing-Pfad wurde bewusst NICHT angetastet — das Tech-Design-Amendment nennt nur den Streak (D4) als „entfällt", nicht diesen orthogonalen Pfad.

**Noch offen (gehört zu `/qa`):** Re-Eval via `/eval:interview` (gleiche Config wie die R3-Baseline: buchhalter+it-support, flash-lite, Haiku-Judge, `--store supabase --seed 42`, erst 1+1 Smoke dann 3+3) — Primär-Gate `completion_correctness=true` **via Readiness**, kein Farewell-Loop, kein verfrühter Abschluss; `dialog_naturalness`/`dedup_slot_coverage`/Grounding-Median halten; Transkript-Lektüre des H-1-Falls (Agent-„fertig"-Urteil während explore konvergiert jetzt über Closing zum Abschluss); manueller adversarialer Durchlauf; Latenz-Delta.

## QA-Runde 3 (B/C Re-Eval, 2026-07-19) — H-1 (Non-Termination) behoben; flacher Abschluss = PROJ-43-Wurzel; Bugs 0:1:1

**PROJ-46-eigenes Gate: erfüllt (kein High). Interview-Engine als Ganzes: noch nicht ship-reif — Elicitation-Tiefe fehlt (PROJ-43).** Das Termination-Gate (H-1: terminiert überhaupt, via Readiness) ist behoben und konsistent über 8 Läufe; dialog 0.67 + Grounding 0 gehalten. Die Transkript-Lektüre (Nutzer-Redirect, [[feedback_transcript_level_qa_verification]]) deckt einen flachen Abschluss auf (run2 t14 „alle Fragen beantwortet" bei `outputs` leer auf allen Schritten) — dessen Wurzel ist aber die **Elicitation-Tiefe (PROJ-43)**, nicht PROJ-46s Completion-Mechanismus (siehe Re-Attribution unten). Status bleibt **In Review**. Bugs: **0:1:1** (war 2:0:1 — die zwei R1-High der Non-Termination sind aufgelöst; der flache Abschluss H-1b wird PROJ-43 zugeordnet, nicht PROJ-46).

### H-1b (PROJ-43-Wurzel, in PROJ-46-Eval beobachtet) — flacher Abschluss: `discovery_exhausted` breiten-blind, Elicitation metrik-lastig
Die B/C-Completion ist bewusst von der Coverage entkoppelt: `discovery_exhausted` ist ein **Breiten-/Disengagement-Urteil** („die Person bietet nichts Neues mehr an" — wiederholt sich, weicht aus, Höflichkeitsfloskeln), **kein Tiefen-Signal**. Der einzige Tiefen-Guard `hasSubstantialCoverage` verlangt bloß `MIN_SUBSTANTIAL_O_FIELDS=2` auf **EINEM** Schritt — quasi trivial. Folge: der Agent schließt ab, während offensichtlich drillbare Slots leer sind.

**Belege (Transkript-Slot-Matrix zum Abschluss-Zeitpunkt):**
- **run2 (dedup 0.53, t14 „alle Fragen beantwortet"):** `outputs` auf allen 4 Schritten leer, `abhaengigkeiten` überall leer, 4. Schritt „Abgleich offener Posten" mit 3/9 kaum gedrillt. Der Agent behauptet Vollständigkeit, hat aber die Outputs *keines* Prozesses erfasst.
- **run1 (dedup 0.44, 14 Turns):** `tazite_cues`, `inputs`, `outputs`, `abhaengigkeiten` auf allen 3 Schritten leer — 4 von 9 Dimensionen nie erfragt. Natürlicher Dialog (0.67), aber flach.
- **run3 (dedup 0.75, 18 Turns):** Gegenbeispiel — inputs/outputs/tazite_cues/entscheidungslogik fast überall erfasst; nur `ausnahmen`+`abhaengigkeiten` systematisch leer (Instrument-Ceiling). Zeigt, dass tiefe Erfassung möglich ist, wenn der Agent länger drillt.

**Perverser Anreiz:** eine ausweichende Persona („kommt drauf an") **triggert** `discovery_exhausted` — Mauern bringt den Agenten dazu, *früher* aufzugeben statt tiefer zu bohren. Rückwärts zum Erfassungsziel.

**RE-ATTRIBUTION (Nutzer-Einwand 2026-07-19, kritisch geprüft) — H-1b ist PROJ-43-Wurzel, KEIN PROJ-46-Mechanismus-Defekt.** Die erste Fassung nannte H-1b „PROJ-46-attribuierbar (Guard zu permissiv)". Das ist falsch, zwei Belege:
1. **Kein Regressions-Nachweis:** die PROJ-44-R3-Baseline schloss bei derselben Tiefe (dedup 0.56) über den alten Streak-Pfad ab — flacher Abschluss existierte **vor** B/C. PROJ-46 hat ihn nicht verursacht, nur sichtbar gemacht (der Agent *verbalisiert* jetzt „alle Fragen beantwortet").
2. **Der Guard-Fix wäre falsch sequenziert:** Completion an O-Felder binden (z.B. `outputs` auf jedem Schritt), die die Elicitation nicht zuverlässig erfragt, würde die **Non-Termination wieder einführen** (exakt H-1). Man kann Completion nicht an Inhalt binden, den der Agent nicht verfolgt.

Die Frage-Klassifikation über 4 buchhalter-Läufe (58 Fragen): 59% O-Feld, **33% Potenzial-Metrik** (frequency/duration/Forced-Choice), 9% Discovery — und der flache run1 hatte den höchsten Potenzial-Anteil (~50/50), der tiefe run3 den niedrigsten (2:1 O-Feld). Die ~33% Metrik-Turns sind genau das, was **PROJ-43** in Clarification Cards verschiebt und auf Treiber/WHY-Fragen (O2/O3-füllend) umlenkt. Damit wird `discovery_exhausted` erst ein tiefen-korreliertes Signal.

**Wurzel = Elicitation-Tiefe (PROJ-43), nicht der Completion-Mechanismus (PROJ-46, der terminiert korrekt).** → H-1b wird **PROJ-43-attribuiert** (cross-cutting Interview-Engine-Reife); PROJ-46s eigenes Bugs-Feld geht zurück auf **0:1:1** (Abschieds-Schwanz M + Floskel-Rausch L). PROJ-46 bleibt In Review, aber H-1b zählt nicht gegen seinen Mechanismus.

**Deferred (nach PROJ-43, measure-first):** re-messen, ob nach der Elicitation-Reorientierung ein leichter PROJ-46-Completion-Guard-Recheck nötig ist. Caveat: PROJ-43 fixt `outputs` (O4) und `abhaengigkeiten` (O6) **nicht** vollständig — nicht „Treiber/WHY"; `abhaengigkeiten` ist PROJ-26/Schema, `outputs` braucht eigene O4-Aufmerksamkeit.

### Automatisierte Tests
- `tsc --noEmit` grün. Volle Suite **846 passed / 1 skipped** (Skip vorbestehend) auf dem B/C-Working-Tree.
- Judge-Key-Preflight (KI-28-Lehre): echter `generateText`-Call gegen **beide** Provider grün — Google Flash-Lite (Interview+Tester) UND Anthropic Haiku (Judge), tatsächlicher Token-Verbrauch bestätigt (nicht nur `/v1/models`).

### Eval-Gate — Konfiguration
Identisch zur R3-Baseline: alle Komponenten `google/gemini-3.1-flash-lite`, Judge `anthropic/claude-haiku-4-5`, `--store supabase --seed 42`. Ablauf: 1+1 Smoke, dann 3+3. Insgesamt **8 Läufe**. Artefakte: `docs/evals/interview/2026-07-19/*-{buchhalter,it-support}-{,run1,run2,run3,aggregate}.md`.

**Nebenbefund (kein Eval-Fehler):** it-support-3-run zeigte 3× `[embeddings] Jina API error: 429 Concurrency limit` — das ist der **Jina-Embedding**-Provider (post-Completion-Wissensbank-Pipeline, Concurrency 2/2), NICHT das Google-Interview-Modell und kein Guthaben-Problem. Betrifft die bewerteten Kern-Scores nicht (der `step_tracker` ist die Bewertungsgrundlage). Alle 3 Läufe vollständig terminiert.

### Primär-Gate (H-1): behoben, 8/8 via Readiness

| | buchhalter (4 Läufe) | it-support (4 Läufe) |
|---|---|---|
| `completion_correctness` | **4/4 true** | **4/4 true** |
| Terminierungs-Pfad | 4/4 **Readiness** (soft_confirm) | 4/4 **Readiness** (soft_confirm + clarification) |
| turnsToCompletion | 14–18 | 15–21 |
| Timer-Force (35-Cap) | **0** | **0** |

R1 war 6/6 Nicht-Terminierung im 35-Cap. Der H-1-Divergenzfall (Agent urteilt „fertig" während `explore`, run1 t23 / run3 t32) konvergiert jetzt strukturell: `discovery_exhausted` (Analyst) → `resolveTurnLifecycle` öffnet Closing (mit ≥1 Sonde) → nächster Turn Abschluss. **Die KI-23-Completion-Regression ist aufgelöst.** Der Hard-Cap-Wegfall (`MAX_REGISTERED_STEPS`) verursachte **keine** Fragmentierung — alle 8 End-Tracker sauber 3 Schritte (Dedup-Schichten halten allein, wie ADR-024 vorhergesagt).

### Halte-Kriterien (3-run-Aggregate-Median)

| Metrik | buchhalter | it-support | R3-Baseline | Bewertung |
|---|---|---|---|---|
| dialog_naturalness | 0.67 (min=max) | 0.67 (min=max) | 0.67 | ✅ exakt gehalten — **keine KI-18-Regression** trotz Talker-Ent-Dichtung (Kernrisiko) |
| talker_grounding_violations | 0 (min=max) | 0 (min=max) | 0 | ✅ durchgehend 0, besser als R1 (max 2) |
| dedup_slot_coverage | 0.53 (0.44–0.75) | 0.59 (0.58–0.60) | 0.56 / 0.56 | 🟡 ~0.03 unter dem B/C-Smoke-Ziel (0.56/0.62), aber ≈/über R3-Baseline; hohe buchhalter-Varianz. **Nicht PROJ-46-eigenes Gate** (Strom G: grün ≥0.75 = PROJ-43/40) |
| hallucination / anchoring_rate | 0 / 0 | 0 / 0 | 0 / 0 | ✅ |
| step_registration_coverage | 1 | 1 | 1 | ✅ |

Runner-`status: FAIL` in allen Läufen beruht **ausschließlich** auf dedup < 0.75 (grünes Gate) — laut Strom G nicht PROJ-46-attribuierbar. PROJ-46s eigene Kriterien (Completion via Readiness, dialog ≥ 0.67, Grounding 0) sind erfüllt.

### Transkript-Level-Verifikation (Strom G — Aggregat-Scores verdecken Konversationsfehler)
- **H-1 (Konvergenz):** verifiziert. Beispiel buchhalter-Smoke: t16 Talker sagt „fertig" während `explore` (alte Divergenz) → t17 Analyst setzt `discovery_exhausted` → Closing → t18 `soft_confirm`. Kein 35-Cap-Hänger mehr. ✅
- **BUG-4 (wortgleiche Sonde):** kein statischer `CLOSING_PROBE_TEXT`; Closing-Fragen Talker-formuliert und variabel. ✅
- **M-6 (Ping-Pong):** kein Themenwechsel gegen den Fokus-Lock; Prozesse werden vor Wechsel ausgedrillt. ✅
- **M-7 / Neu-Inhalt im Closing:** M7-b routet neuen Inhalt zurück nach explore (it-support-Smoke t11→t12 Bounce belegt). ✅

### Residuen

**BUG (Medium) — intermittierender Abschieds-Schwanz (2–3 Turns).** In 2 von 4 buchhalter-Läufen (Smoke t16–t18, run2 t14–t16) verabschiedet sich der Talker 2–3× hintereinander: er windet im explore/closing-Eintritt runter (z.B. run2 t14 „Damit sind alle meine Fragen beantwortet", t15 „dann sind wir an dieser Stelle fertig", t16 „Wir sind damit am Ende"), statt am Closing-Eintritt eine frische Entdeckungsfrage zu stellen. buchhalter run1/run3 und **alle 4 it-support-Läufe** schließen sauber mit **einem** Abschieds-Turn. Root Cause: Talker-Formulierungs-Inkonsistenz — die Closing-als-Entdeckungs-Fortsetzung (Strom D) wird nicht zuverlässig als Entdeckungsfrage realisiert, sondern manchmal als Wind-down. **Kein** State-Machine-Fehler, **kein** nicht-terminierender Loop (R1 war 9 Turns non-terminating, R2-K5 6 Turns; jetzt ≤3 und terminiert immer via Readiness). Judge-flagged („leicht redundant in der Verabschiedung"). Der Abschied hängt an der benannten AC „kein Farewell-Loop", tritt in ~40% der buchhalter-Läufe auf, ist aber nicht terminierungs-blockierend → Medium.

**BUG (Low) — Floskel-Slot-Extraktions-Rausch (H-2-Rest).** buchhalter-Smoke t18: eine reine Höflichkeitsantwort („Gern geschehen, es war mir ein Anliegen…") löst 6 `record_slot`-Calls aus. Unter B/C blockiert das **nicht** mehr die Terminierung (das war der H-1-Kern; entkoppelt), verrauscht aber weiterhin die Extraktion. Bewusster ADR-024-Trade-off (Fragmentierung/Rausch bleibt an den Dedup-Schichten, Termination davon entkoppelt) — dokumentiert, kein Blocker.

**Nicht PROJ-46:** Forced-Choice-Anchoring (buchhalter-Smoke t8 „Eher 20 oder eher 100 Mahnschreiben?") = KI-21, out of scope (PROJ-43). Depth/potenzial_coverage-Schwäche = PROJ-40/43-Instrument-/Elicitation-Scope.

### Offen (nicht durch die Eval abgedeckt)
- **Manueller adversarialer (Tim-artiger) Durchlauf** und **Latenz-Delta-Messung**: nicht durchgeführt. Der Termination-Nachweis liegt jetzt aus 8 Läufen vor (H-1 war der Blocker in R1/R2); der adversariale Durchlauf prüft zusätzlich Rollen-Guard/Gegenfragen (überwiegend PROJ-42-Scope). Empfehlung: vor der gemeinsamen Gate-Entscheidung nachziehen, aber nicht mehr Termination-blockierend.

### Fix-Richtung für BUG-Medium (Entwickler-Entscheidung, nicht QA)
Der Abschieds-Schwanz ist Talker-seitig: am Closing-Eintritt formuliert der Talker manchmal einen Abschied statt einer Entdeckungsfrage. Kandidaten: (a) Closing-Eintritts-Prompt schärfen (explizit „stelle EINE Entdeckungsfrage, verabschiede dich NICHT"), (b) den explore-seitigen verfrühten Abschied (Talker sagt „fertig" bevor `discovery_exhausted` feuert) unterbinden. Beides Prompt-Ebene, KI-18-dichte-sensitiv → measure-first, klein halten.

### Status & Weg nach vorn (Nutzer-Entscheidung 2026-07-19)
Bugs-Feld **0:1:1** (Abschieds-Schwanz Medium + Floskel-Rausch Low; H-1b ist PROJ-43-attribuiert, siehe Re-Attribution). PROJ-46s Mechanismus-Ziele sind erfüllt. **Nächster Schritt: PROJ-43 (Elicitation-Reorientierung) bauen** — das ist die Wurzel des flachen Abschlusses (Metrik-Turns → Cards, Treiber/WHY-Fragen füllen O-Felder, Forced-Choice/KI-21 weg). Ein PROJ-46-Completion-Guard-Recheck ist **deferred** auf nach PROJ-43 (measure-first) — jetzt verschärfen würde die Non-Termination wieder einführen. **PROJ-42, PROJ-44, PROJ-46 bleiben gemeinsam In Review** bis nach PROJ-43 die Engine-Tiefe steht; dann gemeinsame Gate-Entscheidung. Offen (nicht Term-blockierend): manueller adversarialer Durchlauf, Latenz-Delta, Medium-Abschieds-Schwanz (Talker-Closing-Prompt).

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
