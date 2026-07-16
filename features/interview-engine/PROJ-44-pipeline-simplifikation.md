# PROJ-44: Pipeline-Simplifikation (Analyst-vor-Talker + Legacy-Pfad)

## Status: Architected
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** L (1–3 Tage)
**Bugs:** —
**Created:** 2026-07-16
**Last Updated:** 2026-07-16
**ADR:** ADR-021 (Timing-Amendment zu ADR-011 D2)

## Context

Der Interview-Turn trifft heute seine Phasen- und Completion-Entscheidung auf veraltetem Zustand. In [runInterviewTurn.ts:252](../../src/services/runInterviewTurn.ts#L252) (`checkLifecycle`) und [:411](../../src/services/runInterviewTurn.ts#L411) (`decideNextPhaseWithMeta`) lesen `analystBriefing` und `stepTracker` den Stand vom **Ende des Vorturns**. Der volle Analyst läuft in [`background()`](../../src/services/runInterviewTurn.ts#L536), also nach/parallel zum Talker, und sein Ergebnis wird erst im nächsten Turn gelesen. Diese Ein-Turn-Zustandsverzögerung ist eine Architektur-Eigenschaft, kein Fehler in einer einzelnen Zeile. Die einzige heutige Ausnahme ist der synchrone `soft_confirm`-Recheck ([:265-307](../../src/services/runInterviewTurn.ts#L265), KI-12-Fix), der genau dieses Muster punktuell schon anwendet, aber nur für die Completion-Entscheidung.

Der Lag ist die gemeinsame Wurzel dreier bei PROJ-42 dokumentierter, real verifizierter Symptome:
- **BUG-1 (Staleness-Anteil):** die `explore→closing`-Transition nutzt Pre-Turn-Zustand; ein Turn, der gerade einen neuen Prozess offenbart, kann noch im selben Turn die Sonde auslösen.
- **BUG-4 (Kern):** siehe Abgrenzung unten — der Methodik-Block-Gedächtnisverlust ist **kein** reines Lag-Artefakt und wird von PROJ-44 bewusst **nicht** behoben (→ PROJ-46).
- **BUG-6:** doppelte Verabschiedung, weil `checkLifecycle`s `closing`-Trigger auf dem Pre-Turn-Phasenwert nicht greift.

Der zweite Teil der Pipeline-Vereinfachung ist der tote Legacy-Pfad: `createInterviewStream`/`buildStaticPrompt` in [interviewAgent.ts](../../src/services/interviewAgent.ts) werden nur noch von [start/route.ts:85](../../src/app/api/interview/[token]/start/route.ts#L85) und [reconnect/route.ts:116](../../src/app/api/interview/[token]/reconnect/route.ts#L116) genutzt (Chat läuft längst über `createTalkerStream`). Reconnects LLM-Pfad ist durch atomare Turn-Persistenz faktisch unerreichbar (KI-22). Dieser Doppel-Pfad ist die Quelle des PROJ-37-Static-Prompt-Drifts.

PROJ-44 ist bewusst als **Komplexitätsreduktion** geschnitten, nicht nur als Zeilen-Streichung. Leitprinzip (im Sinne der `/codebase-design`-Richtlinien):
- **Kanten zwischen Modulen reduzieren:** die Turn-Pipeline hat heute mehrere Analyst-Einstiegspunkte und einen parallelen Legacy-Stream-Pfad. Nach PROJ-44 kreuzt der Turn genau eine Analyst-Naht und eine Talker-Naht.
- **Deep Modules statt breiter Interfaces:** die drei Analyst-Einstiegspunkte werden zu einem einzigen, dessen interne Modi (normaler Pass, Closing-Sweep, Failure-Window) hinter der Schnittstelle verborgen sind.
- **Deletion-Test als Maßstab:** was nur existierte, weil der Analyst in drei verschiedenen Timing-Kontexten lief (synchroner Recheck, Background-Online, Background-Catchup), verschwindet mit dem synchronen Lauf statt als Ballast erhalten zu bleiben.
- **Alten Ballast ersatzlos entfernen:** Quick-Extract, der tote Legacy-LLM-Pfad, die doppelte Static-Prompt-Quelle und die `quick`-Write-Source fallen weg, nicht mit Kompatibilitäts-Schichten kaschiert.

### Abgrenzung: Was PROJ-44 bewusst NICHT tut (Scope-Grenze zu PROJ-46)

Die Entscheidung fiel nach Grilling auf **Option 1** (schmaler Kern, sauber eval-attribuierbar) statt Option 2 (alles in einem). PROJ-44 macht ausschließlich den **Timing-Flip + die Streichungen**. Es fasst den Talker-Prompt **nicht** um. Konkret bleibt außen vor und wandert in das Folge-Feature **PROJ-46 (Talker-Briefing-Konsolidierung)**:
- Migration der code-berechneten Judgment-Signale (Drill-Stop, Ambiguität, Ausnahme, Laddering, Re-Kontext-Sperre, Frage-Wiederholung) aus `talkerPrompt.ts`/`conversationSignals.ts` in das Analyst-Briefing.
- **BUG-4** (Catch-all-Sonde wird nach Late-Discovery-Umweg wortgleich erneut gestellt) — kein Lag-Artefakt, sondern fehlendes Gedächtnis im `buildPhaseMethodology('closing')`-Block. Selbst mit frischem Zustand fordert der Methodik-Block die Sonde bedingungslos erneut.
- Genereller Audit der statischen Text-Ausgaben (`CLOSING_PROBE_TEXT`, `buildOffTopicRedirect`, Reconnect-Statiktext, PFLICHT-Blöcke): Determinismus-für-Kontrolle vs. LLM-Formulierung-für-Natürlichkeit, pro Item.

Grund der Trennung: die KI-18-Historie zeigt, dass Talker-Prompt-Änderungen beim lite-Modell `dialog_naturalness`-Regressionen auslösen. Bündelt man den Timing-Flip mit einer Prompt-Umschichtung, ist eine Eval-Regression nicht mehr eindeutig dem einen oder anderen zuzuordnen.

**Konsequenz für PROJ-42:** BUG-4 bleibt bis PROJ-46 offen, PROJ-42 bleibt bis dahin In Review. Für die Demo tolerierbar (BUG-4 manifestiert sich nur im Late-Discovery-während-Closing-Pfad).

## Dependencies

- **Requires: PROJ-22** (Dual-Loop Interview Engine) — der Talker/Analyst-Split und der `next_briefing`-Bridge sind die Grundlage, deren Timing PROJ-44 umkehrt.
- **Requires: PROJ-33** (Turn-Loop-Konsolidierung) — `runInterviewTurn.ts` ist die Naht, an der die Umstellung greift.
- **Requires: PROJ-34** (TurnStore-Port) — der synchrone Analyst-Lauf nutzt denselben `store`/`session`-Mechanismus; DB-freie Evals bleiben lauffähig.
- **Löst ab / behebt Root Cause von:** PROJ-42 BUG-1-Staleness + BUG-6 (nicht BUG-4).
- **Ermöglicht:** PROJ-46 (Talker-Briefing-Konsolidierung) — der synchrone Analyst-vor-Talker ist dessen harte Vorbedingung.
- **ADR erforderlich:** ADR-011-Timing-Amendment (Analyst synchron vor Talker; Vertragsänderung von `decideNextPhase`/`checkLifecycle`). Wird in `/architecture` oder via `/adr` erstellt, nicht in dieser Spec entschieden.

## User Stories

- Als **KI-Berater** möchte ich, dass die Phasenentscheidung den gerade genannten Gesprächsinhalt bereits berücksichtigt, damit ein spät entdeckter Prozess nicht im selben Turn übergangen wird (BUG-1-Staleness) und keine doppelte Verabschiedung entsteht (BUG-6).
- Als **Befragter** möchte ich, dass der Interviewer auf meine letzte Aussage mit aktuellem Wissensstand reagiert, damit er einen gerade genannten Wert nicht erneut erfragt.
- Als **Befragter** möchte ich während der kurzen Analysepause einen sichtbaren Hinweis sehen, damit die Verzögerung als bewusster Schritt wirkt und nicht als Hänger.
- Als **Entwickler** möchte ich eine einzige, klar sequenzierte Turn-Pipeline ohne toten Legacy-Pfad und ohne Ad-hoc-Quick-Extract, damit die Codebasis weniger Fehlerquellen hat und leichter zu debuggen ist.
- Als **Entwickler** möchte ich nur eine Static-Prompt-Quelle (`STATIC_PROMPT`), damit der PROJ-37-Drift nicht wiederkehren kann.

## Acceptance Criteria

### Strom 5 — Analyst synchron vor Talker

- [ ] Pro Turn läuft der volle Analyst (`runAnalystOnline`) **synchron VOR** der Phasenentscheidung und vor dem Talker-Call. Sein Ergebnis (frisch geladener `stepTracker` + frisches `AnalystBriefing`) speist `checkLifecycle`, `decideNextPhaseWithMeta` **und** `createTalkerStream`.
- [ ] Der Talker konsumiert das Briefing **dieses** Turns, nicht mehr das `next_briefing` vom Vorturn. Der Lag verschwindet damit auch für `suggested_question`/`next_focus`, nicht nur für die Phasenentscheidung.
- [ ] Der separate `soft_confirm`-Zwei-Stufen-Recheck (`preCompletionAnalystResult` samt der doppelten Dedup-Guards in beiden `background()`-Closures) ist **entfernt** — der generelle synchrone Lauf subsumiert ihn. Kein Turn verarbeitet seinen `userInput` doppelt (kein zweiter Analyst-Pass).
- [ ] Die drei heutigen Analyst-Einstiegspunkte (`runAnalystOnline`, `runAnalystCatchup` bei Closing-Eintritt, `runAnalystFailureRetry` bei `analyst_status='failed'`) sind zu **einem einzigen Analyst-Einstiegspunkt** konsolidiert (Deep Module): das Interface ist ein Aufruf, die drei bisherigen Verhaltensweisen werden interne, verborgene Modi (normaler Pass / Closing-Sweep / Failure-Window). Sie existierten nur, weil der Analyst in drei Timing-Kontexten lief (Recheck, Background-Online, Background-Catchup); mit dem synchronen Lauf entfällt dieser Grund. Der Turn hat danach genau **einen** synchronen Analyst-Aufrufort statt Recheck plus zwei Background-Zweige.
- [ ] Quick-Extract (`interviewQuickExtract.ts`) ist **entfernt**; die Slot-Füllung des aktuellen Turns übernimmt vollständig der synchrone Analyst.
- [ ] `quick` ist als Write-Source **ersatzlos entfernt** ([slotConflictResolver.ts](../../src/services/slotConflictResolver.ts), [slotWriteTrail.ts](../../src/services/slotWriteTrail.ts)), kein Read-/Ranking-Kompatibilitäts-Eintrag. Historische `quick`-Strings in gespeicherten Trails degradieren über den bestehenden `?? 0`-Fallback von `canOverwrite` genau richtig: der aktuelle Analyst (Priorität 3) darf einen alten `quick`-Slot überschreiben, was ohnehin das gewünschte Verhalten ist (frische Analyst-Daten schlagen eine alte Quick-Schätzung). Kein `quick`-Literal bleibt im Write-Pfad zurück.
- [ ] Der Vertrag von `decideNextPhase`/`checkLifecycle` ist dokumentiert umgekehrt: sie lesen jetzt den Zustand **inklusive des aktuellen Turns**, nicht mehr „Ende Vorturn". Die Doc-Kommentare ([interviewOrchestrator.ts:123](../../src/services/interviewOrchestrator.ts#L123)) sind entsprechend aktualisiert. Die Orchestrator-**Logik selbst** (Signalkaskade) ist unverändert.
- [ ] `next_briefing`-Persistenz bleibt erhalten, aber nur noch als (a) Fail-Safe-Quelle und (b) `usedFillerPhrases`-Cross-Turn-Bridge. Ihre Rolle als „für den nächsten Turn geplantes" Briefing entfällt.
- [ ] BUG-1-Staleness und BUG-6 sind über die frische Phasenentscheidung strukturell behoben; je ein Regressionstest belegt es.

### Strom 5 — Fail-Safe + UI

- [ ] Der synchrone Analyst-Call hat einen gedeckelten Retry (bestehendes `withRetry`-Muster, 1–2 Versuche + kurzer Backoff). Transiente Fehler (Netzwerk-Blip, Rate-Limit) werden aufgefangen.
- [ ] Terminaler Fehler (alle Retries erschöpft, selten): der Turn läuft mit dem Vorturn-Briefing weiter (selbstheilende Degradation = heutiges Verhalten, eng begrenzt), `analyst_status='failed'` wird gesetzt, `console.error` statt Silent-Fail. Der **nächste** Turn holt via `runAnalystFailureRetry`-Catchup den verpassten Turn synchron vor dem Talker nach; der Recovery-Turn ist damit wieder voll frisch. Kein blockierter oder toter Turn.
- [ ] Ein sichtbarer „Analysiere…"-Indikator erscheint im Chat-UI, solange der synchrone Analyst läuft, bis das erste Talker-Token gestreamt wird (client-seitiger Ladezustand vom Absenden bis zum ersten Token).

### Strom 6 — Legacy-Pfad vereinheitlichen

- [ ] Die Start-Route nutzt `createTalkerStream({ isStart: true })` statt `createInterviewStream`. Der Cold-Start-Gruß läuft **toollos** (extrahiert nichts); der Opener wird wie heute über `onFinish` als `opener_text` gespeichert.
- [ ] Die Reconnect-Route: der LLM-Pfad ist **ersatzlos gestrichen**; sie gibt immer den statischen „Willkommen zurück"-Text zurück (kein LLM-Call).
- [ ] `buildTools` ist nach `interviewTools.ts` verschoben; einziger verbleibender Konsument ist `interviewAnalyst.ts`.
- [ ] `interviewAgent.ts` (`createInterviewStream` + `buildStaticPrompt`) und `interviewQuickExtract.ts` sind **vollständig gelöscht**.
- [ ] Der PROJ-37-Static-Prompt-Drift ist aufgelöst: `STATIC_PROMPT` ([talkerPrompt.ts](../../src/services/talkerPrompt.ts)) ist die einzige verbleibende Static-Prompt-Quelle.

### Eval-Gate + Netto-Reduktion

- [ ] Pflicht-Eval-Gate grün (general.md, Interview-Engine): mindestens 1 PASS je Persona (buchhalter, it-support), `dedup_slot_coverage ≥ 0.75`. **Measure-first:** falls nach dem Timing-Flip weiterhin rot, wird innerhalb von PROJ-44 diagnostiziert, ob es die `step_advance_ready`-Schwelle (zu großzügig), die Clarification-Cards-Zuverlässigkeit (Null-Slots erzeugen keine Card) oder beides ist, und gezielt am richtigen Knopf behoben. Kein blindes Vorab-Nachjustieren.
- [ ] Netto weniger Code **und weniger Kanten zwischen Modulen**: `interviewAgent.ts` + `interviewQuickExtract.ts` entfernt, ein toter LLM-Pfad entfernt, Zwei-Stufen-Recheck kollabiert, drei Analyst-Einstiegspunkte auf einen reduziert. Der Turn kreuzt danach genau eine Analyst-Naht und eine Talker-Naht. Zeilen-/Modul-Delta plus Einstiegspunkt-Zählung sind im Backend-Abschnitt dokumentiert.

## Edge Cases

- **Off-Topic-Frage + synchroner Analyst:** der Rollen-Guard (PROJ-42) bleibt der **früheste** Gate, VOR dem synchronen Analyst. Klasse `off_topic` beendet den Turn wie heute; der synchrone Analyst läuft für diesen Turn gar nicht, der Zustand bleibt unverändert. Neue Turn-Reihenfolge: Rollen-Guard → synchroner Analyst → Phasenentscheidung → Talker.
- **Analyst-Fehler auf Turn N (terminal):** siehe Fail-Safe-AC. Degradation ist auf genau diesen einen Turn begrenzt und selbstheilend; die Roh-Nachricht ist persistiert (Talker-Fallback schreibt die Turn-Zeile), nichts geht dauerhaft verloren.
- **Erster Turn nach dem Gruß (`intro`):** der Analyst hat noch keinen Prozess; der synchrone Lauf ist harmlos (leerer/kleiner `stepTracker`), die Phasenentscheidung bleibt `intro→explore`.
- **Hard-Stop-Turn:** der synchrone Analyst läuft vorher (fängt die Slots dieses Turns), danach der Farewell-Talker-Call (`isCompletionFarewell`, unverändert). Kein Slot-Verlust auf dem Schluss-Turn — der bisherige separate B5-Nachlauf im Completion-`background()` wird durch den generellen synchronen Lauf abgedeckt.
- **Latenz-Spike beim Analyst:** der Nutzer sieht „Analysiere…", kein stiller Hänger. Time-to-first-token steigt bewusst; das ist der freigegebene Trade-off (Korrektheit vor Geschwindigkeit).
- **Voice-Input (PROJ-7):** unverändert. Die Umstellung ist rein serverseitig auf dem Text-Turn; kein Voice-spezifischer Sonderfall.
- **Historisches Interview mit `quick`-Slots wird fortgesetzt (unwahrscheinlicher Randfall):** kein Kompat-Code, keine Löschung alter Interviews. Ein fortgesetztes Interview mit `quick`-Slot verhält sich über den `?? 0`-Fallback korrekt (der Analyst überschreibt die alte Quick-Schätzung, was erwünscht ist). Alte Interviews werden **nicht** gelöscht: die dokumentierten Läufe (Tim, 2x Michael Braun) haben Thesis-Traceability-Wert, Löschung wäre eine unnötige, approval-pflichtige destruktive Operation, und die historischen `quick`-Slots sind inerte Daten, die nur bei einer praktisch nicht vorkommenden Fortsetzung überhaupt neu bewertet würden.

## Out of Scope

- **PROJ-46 (Talker-Briefing-Konsolidierung):** Migration der Judgment-Signale ins Analyst-Briefing, BUG-4-Fix (Methodik-Block-Gedächtnis), Audit der statischen Text-Ausgaben. Eigenes Feature, Roadmap, `Requires PROJ-44`. Siehe Abgrenzung oben.
- **PROJ-43 (Elicitation-Reorientierung):** Treiber/WHY-Fragen, Zahlen→Cards. Separat, rückt hinter PROJ-44.
- **BUG-1-Kalibrierung / Cards-Zuverlässigkeit über das Eval-Gate hinaus:** wird nur so weit behoben, wie für ein grünes Gate nötig. Falls sich die Cards-Zuverlässigkeit als strukturelle (nicht Prompt-)Änderung entpuppt, wird sie als eigenes Item abgespalten, statt PROJ-44 unkontrolliert wachsen zu lassen.
- **Migration des wörtlichen Gesprächsverlaufs weg vom Talker** und **History-Windowing** (Token-Kosten-Optimierung): beides bewusst nicht Teil dieser oder der PROJ-46-Migration. Der Talker behält direkten Blick auf den wörtlichen jüngsten Verlauf.
- **Neue Eval-Judges/Metriken** über die genannten Regressionstests hinaus (PROJ-31-Scope).

## Technical Requirements

- **Kern-Datei [runInterviewTurn.ts](../../src/services/runInterviewTurn.ts):** neue Turn-Reihenfolge Rollen-Guard → synchroner Analyst (mit Retry) → `decideNextPhaseWithMeta`/`checkLifecycle` mit dem **frischen** Ergebnis → Talker. Zu entfernen: die `preCompletionAnalystResult`-Zwei-Stufen-Konstruktion ([:263-307](../../src/services/runInterviewTurn.ts#L263)), der `runQuickExtract`-Aufruf + Import ([:42](../../src/services/runInterviewTurn.ts#L42), [:440-455](../../src/services/runInterviewTurn.ts#L440)), die doppelte `preCompletionAnalystResult`-Dedup-Logik in beiden `background()`-Closures. Der Background-Pfad reduziert sich auf das, was wirklich nach dem Talker laufen muss (`extractAndEmbed` via Talker-`onFinish`, `onCompleted`-Derivation) — der Analyst-Slot-Pass wandert nach vorn.
- **[interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts):** nur Doc-Kommentar-Vertrag anpassen (liest jetzt this-turn state). Signalkaskade unverändert.
- **[interviewAnalyst.ts](../../src/services/interviewAnalyst.ts):** die drei Einstiegspunkte werden zu **einem** Deep-Module-Einstieg konsolidiert (`runAnalyst(opts)` o.ä.), dessen Interface ein Aufruf ist und der die bisherigen drei Verhaltensweisen als interne, verborgene Modi trägt (normaler Pass / Closing-Sweep mit `allowedTools`-Restriktion und Card-Erzeugung / Failure-Window über zwei User-Inputs mit Evidence-Validierung gegen historische Turns). Die genaue interne Zerlegung entscheidet `/architecture`; die Spec fordert nur das eine Interface und den einen Aufrufort in `runInterviewTurn`. `computeNextBriefing` (Streak) läuft unverändert im synchronen Pass.
- **[interviewQuickExtract.ts](../../src/services/interviewQuickExtract.ts):** gelöscht (inkl. `interviewQuickExtract.test.ts`).
- **[interviewAgent.ts](../../src/services/interviewAgent.ts):** gelöscht. `createInterviewStream` + `buildStaticPrompt` entfallen; `buildTools` → neues `interviewTools.ts` (Tool-Tests aus `interviewAgent.test.ts` ziehen nach `interviewTools.test.ts` um).
- **[start/route.ts](../../src/app/api/interview/[token]/start/route.ts) + [reconnect/route.ts](../../src/app/api/interview/[token]/reconnect/route.ts):** auf `createTalkerStream` bzw. den reinen Statiktext umstellen. `start.test.ts`/`reconnect.test.ts` entsprechend umschreiben (erwarten jetzt `createTalkerStream` bzw. keinen LLM-Call).
- **[slotConflictResolver.ts](../../src/services/slotConflictResolver.ts) + [slotWriteTrail.ts](../../src/services/slotWriteTrail.ts):** `quick` aus `WriteSource` und `PRIORITY` **ersatzlos** entfernen, kein Read-only-Kompat-Eintrag. Der `?? 0`-Fallback in `canOverwrite` behandelt historische `quick`-Strings korrekt (siehe AC). Keine Löschung oder Migration alter Interviews.
- **Frontend ([ChatInterface.tsx](../../src/components/) / Interview-Seite):** „Analysiere…"-Indikator (client-seitig, vom Absenden bis zum ersten gestreamten Token). Kein neues Server-Protokoll nötig; die längere Zeit-bis-erstes-Token entsteht natürlich durch den vorgeschalteten Analyst.
- **Keine DB-Migration.** Kein neues Feld, keine Schema-Änderung. `analyst_status`/`next_briefing` existieren bereits.
- **Keine neuen npm-Pakete.**
- **ADR:** ADR-011-Timing-Amendment dokumentiert die Timing-Umkehr und die Vertragsänderung von `decideNextPhase`/`checkLifecycle`. Pflicht vor Bau-Abschluss.
- **Tests:** `runInterviewTurn.test.ts` (neue Reihenfolge, Fail-Safe-Retry + selbstheilender Catchup, kein Quick-Extract mehr), neuer BUG-6-Regressionstest (doppelte Verabschiedung tritt nicht mehr auf), bestehender Tim-Regressionstest bleibt grün, `start.test.ts`/`reconnect.test.ts` umgeschrieben, Tool-Tests → `interviewTools.test.ts`. `tsc --noEmit` + volle Unit-Suite grün.
- **Verifikation (general.md, Interview-Engine-Eval-Gate):** dokumentierter `/eval:interview`-Lauf mit mind. 1 PASS je Persona; zusätzlich ein manueller adversarialer Durchlauf (analog Tim). Latenz-Delta (Time-to-first-token vorher/nachher) gemessen und dokumentiert. Start/Reconnect curl-verifiziert. E2E grün.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Ergebnis aus `/architecture` + `/grilling` (2026-07-16). Entscheidungen unten sind mit dem User durchgegangen. Vertrag dokumentiert in **ADR-021** (Timing-Amendment zu ADR-011 D2, überholt das „Proposed"-Freshness-Signal aus ADR-019).

### A) Die Akteure eines Turns (unverändert in Zuständigkeit, verändert in Reihenfolge)

| Akteur | Rolle | LLM? | DB? |
|--------|-------|------|-----|
| Route-Adapter (`chat/route.ts`) | HTTP, Auth, Rate-Limit, `timerMinutes`, `after()` | nein | Interview-Load |
| `runInterviewTurn` | Dirigent: Reihenfolge — hält keine Logik selbst | nein | via `ports.store` |
| Orchestrator (`interviewOrchestrator.ts`) | `checkLifecycle`, `decideNextPhase(WithMeta)`, `shouldInjectClosingProbe` — rein deterministisch | nein | nein |
| Analyst (`interviewAnalyst.ts`) | Wissens-Extraktion, Slots, Briefing | ja | via `store`-Session |
| Talker (`interviewTalker.ts`) | nutzersichtbarer Text | ja | via `onFinish` |
| Store (`turnStore/*`) | alle DB-/PGlite-Reads/Writes | — | ja |

### B) Neue Turn-Pipeline

```
[Route]  HTTP-Guards, timerMinutes            ──► runInterviewTurn(input, ports)
[Turn ]  1. store.load: interview + state + turns   ← ctx.phase (= Ende Vorturn)
[Turn ]  2. Rollen-Guard ─off_topic─► store.insertTurn(redirect) · ENDE
[Turn ]  3. runAnalyst(mode aus ctx.phase)          [SYNCHRON · LLM]
              schreibt via store, committed
              RETURNS { briefing, toolCalls, stepTracker }   ◄── ersetzt „reload"
[Orch ]  4. checkLifecycle(frisch) ─complete─► Farewell-Talker + insertTurn · →finalize
[Orch ]  5. decideNextPhase(frisch) → phase ; store.updatePhase
[Orch ]  6. shouldInjectClosingProbe? ─ja─► insertTurn(Probe-Text) · ENDE
[Talker] 7. createTalkerStream(frisches briefing dieses Turns)
              onFinish: store.insertTurn + store.updateState + turnId erfassen
[Route ] 8. after( finalize ): extractAndEmbed + onCompleted   ◄── das frühere background()
```

Vorher (heute): Rollen-Guard → (checkLifecycle auf Vorturn-State) → optionaler `soft_confirm`-Recheck → Phasenentscheidung → Quick-Extract → Talker → `after(background=Analyst)`. Der Analyst lief **nach/parallel** zum Talker; sein Ergebnis erreichte den Turn erst im nächsten Durchlauf.

### C) Das Analyst-Deep-Module (ein Einstiegspunkt, interne Modi)

Die drei heutigen exportierten Analyst-Funktionen (`runAnalystOnline`, `runAnalystCatchup`, `runAnalystFailureRetry`) **plus** der `soft_confirm`-Recheck kollabieren zu **einem** Einstiegspunkt. Der Modus wird am Turn-Anfang aus dem geladenen Zustand bestimmt, nicht aus der Phasenentscheidung (die kommt zu spät):

```
runAnalyst(opts) — Modus-Auswahl aus ctx.phase + analyst_status:

  phase === 'explore' (o.ä.)     → ONLINE-Modus:
      ein LLM-Pass, nur letztes Statement, register+Briefing+Cards

  phase === 'closing'            → CLOSING-Modus (ein Aufruf, intern zwei schlanke Pässe):
      (a) Backfill-Sub-Pass:  Voll-Historie · nur record_slot · kein register
                              · evidence_quote+source_turn · Prio analyst_catchup=4
      (b) Online-Sub-Pass:    aktuelles Statement · register+Briefing+Cards · Prio 3

  analyst_status === 'failed'    → zusätzlich FAILURE-WINDOW:
      der verpasste Vorturn wird der History vorangestellt (heutiges runAnalystFailureRetry-Verhalten)
```

**Warum der Modus aus `ctx.phase` und nicht aus der Entscheidung:** Der Closing-Eintritts-Turn schreibt `phase='closing'` in den State und wirft den statischen Probe-Text (kein Talker). Der **nächste** Turn (Nutzer beantwortet den Probe) ist der erste mit `phase==='closing'` am Turn-Anfang — und genau dort werden Cards / Abschlussentscheidung fällig. Da die Closing-Entscheidung immer aus Closing herausführt (`clarification`/`completed`/`explore`), gibt es strukturell **genau einen** Turn mit Start-`phase=closing` pro Closing-Episode. Der Backfill feuert also ~1× ohne Marker.

**Warum zwei interne Sub-Pässe statt eines verschmolzenen Prompts:** Ein einzelner Prompt müsste zwei Evidenz-Modelle (span aus aktuellem Turn vs. quote+source_turn aus Historie) und die Register-Reichweite (neuer Schritt aus aktuellem Statement ja, aus alten Turns nein) gleichzeitig jonglieren. Die KI-18-Historie zeigt: dichtere Prompts kosten bei diesen Modellen Qualität. Das `register_step`-Verbot im Backfill ist ein bewusster Anti-Fragmentierungs-Guard. Zwei fokussierte Pässe hinter einer Schnittstelle = die Deep-Module-Formulierung der Spec.

`computeNextBriefing` (Streak-Bridge) und die Card-Guard-Logik (`shouldGenerateClarificationCards`) bleiben unverändert.

### D) Datenmodell / Persistenz

- **Keine DB-Migration, kein neues Feld.** `analyst_status` und `next_briefing` existieren bereits.
- **`next_briefing` wechselt die Rolle:** nicht mehr „das für den nächsten Turn geplante Briefing", sondern (a) Fail-Safe-Quelle, (b) `usedFillerPhrases`-Cross-Turn-Bridge, (c) `previousBriefing`-Basis für den `noNewExtractionStreak`. Der Talker konsumiert jetzt das **frische** Briefing dieses Turns direkt (in-memory), nicht das persistierte. Nebeneffekt: die #18-Filler-Race verschwindet strukturell, weil der Analyst `next_briefing` jetzt synchron **vor** dem Talker schreibt statt parallel.
- **`quick` als Write-Source ersatzlos entfernt** (`slotConflictResolver.ts` `WriteSource`+`PRIORITY`, `slotWriteTrail.ts` source-Enum, `interviewSemantic.ts` `SlotValue.writeSource`, `interviewTools.ts` `buildTools`-opts). Historische `quick`-Strings in gespeicherten Trails degradieren über `PRIORITY[existingSource] ?? 0` → 0 korrekt: der aktuelle Analyst (Prio 3) darf einen alten `quick`-Slot überschreiben (erwünscht). Kein Read-Kompat-Eintrag. Keine Löschung/Migration alter Interviews.

### E) Modul-Änderungen

| Aktion | Datei |
|--------|-------|
| **Gelöscht** | `interviewAgent.ts` (`createInterviewStream` + `buildStaticPrompt`), `interviewQuickExtract.ts` (+ Tests) |
| **Neu** | `interviewTools.ts` — nimmt `buildTools` + Helfer (`extractSentenceAroundSpan`, `normalizeStepTitleForDedup`) aus `interviewAgent.ts` auf; einziger Konsument ist `interviewAnalyst.ts`. Tool-Tests wandern nach `interviewTools.test.ts` |
| **Konsolidiert** | `interviewAnalyst.ts` — drei Einstiegspunkte + Recheck → ein `runAnalyst(opts)` mit internen Modi, gibt `{ briefing, toolCalls, stepTracker }` zurück |
| **Umgebaut** | `runInterviewTurn.ts` — neue Reihenfolge; Recheck-Zwei-Stufen-Konstruktion + doppelte Dedup-Guards weg; `background()` → `finalize()` |
| **Vertrag-Doc** | `interviewOrchestrator.ts` — Doc-Kommentare: liest jetzt this-turn state. Logik unverändert |
| **Umgestellt** | `start/route.ts` → `createTalkerStream({isStart:true})` (toollos, Grounding-Guard bei `isStart` übersprungen); `reconnect/route.ts` → reiner Statiktext, LLM-Pfad gestrichen |

### F) Design-Entscheidungen (aus dem Grilling)

| # | Entscheidung | Begründung |
|---|--------------|-----------|
| 1 | Analyst-Modus aus `ctx.phase`, closing = 2 interne Sub-Pässe | eine Schnittstelle, ein Aufruf/Turn, kein Chicken-Egg, fokussierte Prompts (KI-18-Schutz) |
| 2 | Backfill-Trigger = `ctx.phase==='closing'` | feuert strukturell ~1×, kein Zusatz-State/Marker, fängt Late-Discovery-Wiedereintritt |
| 3 | „reload" via `runAnalyst`-Rückgabe (`stepTracker`) | spart DB-Round-trip, Tracker liegt nach Commit im Session-Snapshot |
| 4 | `background()` → `after(finalize)` = extractAndEmbed + onCompleted | schließt heutige fire-and-forget-Reliability-Lücke; keine Ordering-Garantie nötig (unkritischer Pfad) |
| 5 | Analyst-Ergebnis via `meta.analyst`; `finalize()` gibt void | ehrliche Benennung (kein Analyst mehr in „background"), winziger Runner-Diff |
| 6 | `extractAndEmbed` per-Turn belassen | post-Completion-Verlagerung ist orthogonal + Wissensbank-Domain + eval-verwässernd → eigener Kandidat |
| 7 | synchroner Analyst in **voller** Konfig (flash-3.5, budget 2048) | Korrektheit vor Geschwindigkeit; Abspecken riskiert Fragmentierung — genau das, was der Flip frisch machen soll |
| 8 | Fail-Safe: `soft_confirm` vetoen, `hard_stop` zulassen | erhält KI-12-Schutz + garantiert den Failure-Window-Recovery-Turn |
| 9 | Legacy-Pfad + `quick`-Source ersatzlos weg | löst PROJ-37-Drift; `STATIC_PROMPT` einzige Static-Prompt-Quelle |

### G) Latenz

Time-to-first-token steigt bewusst: auf dem kritischen Pfad ersetzt der volle Analyst (flash-3.5, budget 2048) den leichten Quick-Extract. Der Rollen-Guard bleibt auf normalen Aussage-Turns gratis (deterministischer Prefilter, Judge-Call nur bei frageartigem Input). Ein client-seitiger „Analysiere…"-Indikator (Absenden → erstes gestreamtes Token, in `ChatInterface.tsx`) überbrückt die Wartezeit. Latenz-Delta wird gemessen und im QA/Deploy dokumentiert (measure-first).

### H) Eval + Test-Schnittstelle

- Runner liest die Analyst-Tool-Calls aus `turnResult.meta.analyst?.toolCalls` statt aus `background()`. `finalize()` bleibt aufrufbar (Eval-No-op-Ports). Minimaler Runner-Diff.
- Kein neues Server-Protokoll, keine neuen npm-Pakete, keine Schema-Änderung.
- Tests: `runInterviewTurn.test.ts` (neue Reihenfolge, Fail-Safe-Retry + selbstheilender Failure-Window-Catchup, kein Quick-Extract, `soft_confirm`-Veto bei Fehler), BUG-6-Regression, Tim-Regression bleibt grün, `start.test.ts`/`reconnect.test.ts` umgeschrieben, Tool-Tests → `interviewTools.test.ts`.

### Dependencies

Keine neuen Pakete. Keine DB-Migration. ADR-021 (Timing-Amendment) ist Pflicht vor Bau-Abschluss.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
