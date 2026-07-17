# PROJ-44: Pipeline-Simplifikation (Analyst-vor-Talker + Legacy-Pfad)

## Status: In Review
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** L (1–3 Tage)
**Bugs:** 1:3:0 (H-1 Closing→Explore-Reentry-Bug — Gate-Blocker; M-1 vorzeitiges Closing; M-2 Rollen-Guard-FP; M-3 Themen-Ping-Pong)
**Created:** 2026-07-16
**Last Updated:** 2026-07-17
**ADR:** ADR-021 (Timing-Amendment zu ADR-011 D2) — Status: Accepted

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

- [x] Pro Turn läuft der volle Analyst (`runAnalystOnline`) **synchron VOR** der Phasenentscheidung und vor dem Talker-Call. Sein Ergebnis (frisch geladener `stepTracker` + frisches `AnalystBriefing`) speist `checkLifecycle`, `decideNextPhaseWithMeta` **und** `createTalkerStream`.
- [x] Der Talker konsumiert das Briefing **dieses** Turns, nicht mehr das `next_briefing` vom Vorturn. Der Lag verschwindet damit auch für `suggested_question`/`next_focus`, nicht nur für die Phasenentscheidung.
- [x] Der separate `soft_confirm`-Zwei-Stufen-Recheck (`preCompletionAnalystResult` samt der doppelten Dedup-Guards in beiden `background()`-Closures) ist **entfernt** — der generelle synchrone Lauf subsumiert ihn. Kein Turn verarbeitet seinen `userInput` doppelt (kein zweiter Analyst-Pass).
- [x] Die drei heutigen Analyst-Einstiegspunkte (`runAnalystOnline`, `runAnalystCatchup` bei Closing-Eintritt, `runAnalystFailureRetry` bei `analyst_status='failed'`) sind zu **einem einzigen Analyst-Einstiegspunkt** konsolidiert (Deep Module): das Interface ist ein Aufruf, die drei bisherigen Verhaltensweisen werden interne, verborgene Modi (normaler Pass / Closing-Sweep / Failure-Window). Sie existierten nur, weil der Analyst in drei Timing-Kontexten lief (Recheck, Background-Online, Background-Catchup); mit dem synchronen Lauf entfällt dieser Grund. Der Turn hat danach genau **einen** synchronen Analyst-Aufrufort statt Recheck plus zwei Background-Zweige.
- [x] Quick-Extract (`interviewQuickExtract.ts`) ist **entfernt**; die Slot-Füllung des aktuellen Turns übernimmt vollständig der synchrone Analyst.
- [x] `quick` ist als Write-Source **ersatzlos entfernt** ([slotConflictResolver.ts](../../src/services/slotConflictResolver.ts), [slotWriteTrail.ts](../../src/services/slotWriteTrail.ts)), kein Read-/Ranking-Kompatibilitäts-Eintrag. Historische `quick`-Strings in gespeicherten Trails degradieren über den bestehenden `?? 0`-Fallback von `canOverwrite` genau richtig: der aktuelle Analyst (Priorität 3) darf einen alten `quick`-Slot überschreiben, was ohnehin das gewünschte Verhalten ist (frische Analyst-Daten schlagen eine alte Quick-Schätzung). Kein `quick`-Literal bleibt im Write-Pfad zurück.
- [x] Der Vertrag von `decideNextPhase`/`checkLifecycle` ist dokumentiert umgekehrt: sie lesen jetzt den Zustand **inklusive des aktuellen Turns**, nicht mehr „Ende Vorturn". Die Doc-Kommentare ([interviewOrchestrator.ts:123](../../src/services/interviewOrchestrator.ts#L123)) sind entsprechend aktualisiert. Die Orchestrator-**Logik selbst** (Signalkaskade) ist unverändert.
- [x] `next_briefing`-Persistenz bleibt erhalten, aber nur noch als (a) Fail-Safe-Quelle und (b) `usedFillerPhrases`-Cross-Turn-Bridge. Ihre Rolle als „für den nächsten Turn geplantes" Briefing entfällt.
- [x] BUG-1-Staleness und BUG-6 sind über die frische Phasenentscheidung strukturell behoben; je ein Regressionstest belegt es.

### Strom 5 — Fail-Safe + UI

- [x] Der synchrone Analyst-Call hat einen gedeckelten Retry (bestehendes `withRetry`-Muster, 1–2 Versuche + kurzer Backoff). Transiente Fehler (Netzwerk-Blip, Rate-Limit) werden aufgefangen.
- [x] Terminaler Fehler (alle Retries erschöpft, selten): der Turn läuft mit dem Vorturn-Briefing weiter (selbstheilende Degradation = heutiges Verhalten, eng begrenzt), `analyst_status='failed'` wird gesetzt, `console.error` statt Silent-Fail. Der **nächste** Turn holt via `runAnalystFailureRetry`-Catchup den verpassten Turn synchron vor dem Talker nach; der Recovery-Turn ist damit wieder voll frisch. Kein blockierter oder toter Turn.
- [x] Ein sichtbarer „Analysiere…"-Indikator erscheint im Chat-UI, solange der synchrone Analyst läuft, bis das erste Talker-Token gestreamt wird (client-seitiger Ladezustand vom Absenden bis zum ersten Token).

### Strom 6 — Legacy-Pfad vereinheitlichen

- [x] Die Start-Route nutzt `createTalkerStream({ isStart: true })` statt `createInterviewStream`. Der Cold-Start-Gruß läuft **toollos** (extrahiert nichts); der Opener wird wie heute über `onFinish` als `opener_text` gespeichert.
- [x] Die Reconnect-Route: der LLM-Pfad ist **ersatzlos gestrichen**; sie gibt immer den statischen „Willkommen zurück"-Text zurück (kein LLM-Call).
- [x] `buildTools` ist nach `interviewTools.ts` verschoben; einziger verbleibender Konsument ist `interviewAnalyst.ts`.
- [x] `interviewAgent.ts` (`createInterviewStream` + `buildStaticPrompt`) und `interviewQuickExtract.ts` sind **vollständig gelöscht**.
- [x] Der PROJ-37-Static-Prompt-Drift ist aufgelöst: `STATIC_PROMPT` ([talkerPrompt.ts](../../src/services/talkerPrompt.ts)) ist die einzige verbleibende Static-Prompt-Quelle.

### Eval-Gate + Netto-Reduktion

- [ ] Pflicht-Eval-Gate grün (general.md, Interview-Engine): mindestens 1 PASS je Persona (buchhalter, it-support), `dedup_slot_coverage ≥ 0.75`. **Measure-first:** falls nach dem Timing-Flip weiterhin rot, wird innerhalb von PROJ-44 diagnostiziert, ob es die `step_advance_ready`-Schwelle (zu großzügig), die Clarification-Cards-Zuverlässigkeit (Null-Slots erzeugen keine Card) oder beides ist, und gezielt am richtigen Knopf behoben. Kein blindes Vorab-Nachjustieren. **Offen — noch kein Live-`/eval:interview`-Lauf gefahren (braucht `/qa`, siehe Backend-Abschnitt unten).**
- [x] Netto weniger Code **und weniger Kanten zwischen Modulen**: `interviewAgent.ts` + `interviewQuickExtract.ts` entfernt, ein toter LLM-Pfad entfernt, Zwei-Stufen-Recheck kollabiert, drei Analyst-Einstiegspunkte auf einen reduziert. Der Turn kreuzt danach genau eine Analyst-Naht und eine Talker-Naht. Zeilen-/Modul-Delta plus Einstiegspunkt-Zählung sind im Backend-Abschnitt dokumentiert.

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

## Backend Implementation Notes (2026-07-17)

Gebaut wie in Tech Design B/C/D/E entschieden — keine Abweichung von ADR-021. Verifiziert direkt am Code (nicht nur an Docs), da Vorgabe des Aufrufs.

**Modul-Änderungen (Ist-Stand):**
- **Gelöscht:** `interviewAgent.ts` (741 Zeilen, `createInterviewStream`+`buildStaticPrompt`), `interviewQuickExtract.ts` (213 Zeilen) — je inkl. Test.
- **Neu:** `interviewTools.ts` (571 Zeilen — `buildTools` + `extractSentenceAroundSpan`/`normalizeStepTitleForDedup`, einziger Konsument `interviewAnalyst.ts`) + `interviewTools.test.ts` (aus `interviewAgent.test.ts` übernommen).
- **Konsolidiert:** `interviewAnalyst.ts` — `runAnalystOnline`/`runAnalystCatchup`/`runAnalystFailureRetry` → ein `runAnalyst(opts)` mit internen `runOnlinePass`/`runBackfillPass`-Sub-Pässen, die sich EINE `TurnSession` teilen (ein `commit()` statt zwei getrennter Sessions vorher). Rückgabe erweitert um `stepTracker` (ersetzt die vier `store.loadStepTracker`-Reloads, die es dafür vorher brauchte).
- **Umgebaut:** `runInterviewTurn.ts` — neue Reihenfolge Rollen-Guard → synchroner `runAnalyst` (mit 1-Retry-Backoff) → `checkLifecycle`/`decideNextPhaseWithMeta` (frisch) → Talker → `finalize()`. `background()` → `finalize(): Promise<void>`; Analyst-Ergebnis wandert nach `TurnMeta.analyst`.
- **Vertrag-Doc:** `interviewOrchestrator.ts` — nur Doc-Kommentare geändert (liest jetzt this-turn state), Signalkaskade unverändert (0 Logik-Diff, verifiziert per Test-Suite-Grün).
- **Umgestellt:** `start/route.ts` → `createTalkerStream({isStart:true})`; `reconnect/route.ts` → LLM-Pfad ersatzlos gestrichen (auch die zuvor tote `history`/State-Ladung entfernt, da sie nur den gelöschten LLM-Zweig fütterte), gibt immer den statischen Re-Engagement-Text zurück.
- **Bereinigt:** `quick` als `WriteSource` entfernt (`slotConflictResolver.ts`, `slotWriteTrail.ts`, `interviewSemantic.ts SlotValue.writeSource`); `loadStepTracker` als toter Code aus `OrchestrationStore`-Interface + beiden Backends (`supabaseTurnStore.ts`, `pgliteTurnStore.ts`) entfernt (nach der `runAnalyst`-Konsolidierung keinen Aufrufer mehr); `quick_extract` als Telemetrie-Komponente aus `_telemetry.ts`/`scorers/types.ts`/`costSummary.ts`/`pricingCheck.ts` entfernt.

**Zeilen-Delta (production code, ohne Tests):** 20 bestehende Dateien geändert (+483/−1587) + `interviewTools.ts` neu (+571) → netto **−533 Zeilen** production code, bei gleichzeitig weniger Modulen (−1: zwei gelöscht, eines neu) und weniger Analyst-Einstiegspunkten (3 exportierte Funktionen + 1 Ad-hoc-Recheck-Callsite → 1 exportierte Funktion).

**Turn-Nähte nach dem Umbau:** genau eine Analyst-Naht (`runAnalyst`, synchron) + eine Talker-Naht (`createTalkerStream`) pro Turn — verifiziert über die neuen `runInterviewTurn.test.ts`-Assertions (`runAnalyst` wird pro Turn genau einmal aufgerufen, außer beim off-topic-Kurzschluss: 0×).

**Fail-Safe (D4) — Umsetzung:** 1 Retry mit 300 ms Backoff in `runInterviewTurn.ts` (kein neuer `withRetry`-Util, gleiches Inline-Retry-Muster wie `roleGuard.ts`/`talkerGroundingGuard.ts`). Bei endgültigem Fehlschlag: `soft_confirm` wird vetoed (Turn läuft mit Vorturn-Briefing weiter), `hard_stop` schließt trotzdem ab. Getestet in `runInterviewTurn.test.ts` (`Fail-Safe`-Describe-Block).

**Closing-Mode-Sub-Pass-Reihenfolge (Design-Entscheidung, nicht in ADR explizit vorgezeichnet):** Backfill-Sub-Pass läuft VOR dem Online-Sub-Pass (umgekehrt zur alten Online-dann-Catchup-Reihenfolge), damit die Card-Generierung im Online-Pass den bereits nachgefüllten Tracker sieht — vermeidet redundante Cards für Slots, die der Backfill gerade erst gefüllt hat.

**Regressionstests (AC "je ein Regressionstest"):** zwei gezielte Tests in `runInterviewTurn.test.ts` statt eines vollen Zwei-Turn-Nachbaus des historischen Tim-Bugs — beide belegen die eigentliche Timing-Fix-Eigenschaft (Orchestrator-Funktionen erhalten dieses Turns frischen `stepTracker`/`analystBriefing`, nicht den alten Snapshot), die laut ADR-021 die gemeinsame Wurzel von BUG-1 und BUG-6 ist. Kein Anspruch, den historischen Mehrturn-Ablauf 1:1 zu reproduzieren (dafür bräuchte es Live-LLM-Verhalten, kein Unit-Test-Fall).

**Nicht in diesem Backend-Pass:** Live-`/eval:interview`-Lauf (Interview-Engine-Eval-Gate laut general.md ist erst vor `Approved` Pflicht, nicht vor `In Progress`); manueller adversarialer Durchlauf (Tim-artig); Latenz-Delta-Messung Time-to-first-Token vorher/nachher; Start/Reconnect curl-Verifikation gegen eine echte laufende Instanz. Alle vier sind Teil der Spec-„Verifikation"-Zeile unten und gehören in `/qa`.

## QA Test Results

> `/qa PROJ-44` — 2026-07-17. Status bleibt **In Review** (Eval-Gate nicht erfüllt, siehe unten). Kein PROJ-44-Regressionsbefund.

### Zusammenfassung

| Achse | Ergebnis |
|-------|----------|
| `tsc --noEmit` | ✅ pass |
| Unit-Suite | ✅ 888 passed / 1 skipped (67 Test-Dateien, 6.8s) — Skip vorbestehend |
| Code-Level-AC | ✅ alle in der Spec als `[x]` markierten ACs am Code verifiziert |
| Security | ✅ keine neue Route; Token-Format + Expiry + Rate-Limit auf allen 3 geänderten Routen intakt |
| Eval-Gate (Pflicht) | ❌ **nicht erfüllt** — 0/2 PASS; Ursache code-verifiziert (H-1, deterministisch, nicht bloß Varianz) |
| Bugs (H:M:L) | **1:3:0** (H-1 Closing→Explore-Reentry-Bug; M-1 vorzeitiges Closing; M-2 Rollen-Guard-FP; M-3 Themen-Ping-Pong) |
| Production-ready | **NEIN** — H-1 (High) + unerfülltes Eval-Gate blocken Approved |

### 1. Automatisierte Tests

- `npx tsc --noEmit` → grün.
- `npm test` → 888 passed, 1 skipped (vorbestehend). Neue/umgeschriebene Tests grün: `runInterviewTurn.test.ts` (Fail-Safe-Retry, soft_confirm-Veto, hard_stop-unconditional, Failure-Window-Recovery, BUG-1/BUG-6-Regression), `interviewTools.test.ts` (aus `interviewAgent.test.ts` übernommen), `start.test.ts` (Cold-Start → `createTalkerStream({isStart:true})`), `reconnect.test.ts` (Statiktext, kein LLM), `slotConflictResolver.test.ts`/`slotWriteTrail.test.ts` (ohne `quick`).

### 2. Acceptance-Criteria-Verifikation (Code-Level)

Alle in der Spec `[x]` markierten ACs direkt am Code geprüft, alle bestätigt:

- **Turn-Reihenfolge** ([runInterviewTurn.ts](../../src/services/runInterviewTurn.ts)): Rollen-Guard → synchroner `runAnalyst` (1 Retry, 300ms Backoff) → `checkLifecycle`/`decideNextPhaseWithMeta` mit **frischem** `stepTracker`+`briefing` → Talker → `finalize()`. Off-topic kurzschließt VOR dem Analyst (0× runAnalyst). Entspricht ADR-021 B/C 1:1.
- **Ein Analyst-Einstiegspunkt** ([interviewAnalyst.ts](../../src/services/interviewAnalyst.ts)): `runAnalyst(opts)` mit internen `runOnlinePass`/`runBackfillPass`, Modus aus `ctx.phase`; Backfill-vor-Online im Closing-Modus; Failure-Window via `previousUserInput`. Gibt `{ briefing, toolCalls, stepTracker }` zurück (ersetzt die alten `loadStepTracker`-Reloads).
- **Löschungen**: `interviewAgent.ts` + `interviewQuickExtract.ts` weg (git `D`); keine Import-Statements auf die gelöschten Module mehr (nur Doc-Kommentare referenzieren sie historisch). `quick`-Write-Source aus `WriteSource`/`PRIORITY`/Trail-Enum entfernt, kein Literal im Write-Pfad. `loadStepTracker` aus Store-Port + beiden Backends entfernt. `quick_extract`-Telemetrie-Komponente aus `_telemetry.ts`/`pricingCheck.ts`/`costSummary.ts`/`scorers/types.ts` entfernt (Pricing-Check bestätigt: keine quick_extract-Zeile mehr).
- **`interviewTools.ts`** neu, einziger Konsument = `interviewAnalyst.ts` (+ eigener Test).
- **Routen**: Start → `createTalkerStream({isStart:true})`; Reconnect → reiner Statiktext, LLM-Pfad ersatzlos weg. Chat-Route delegiert an `runInterviewTurn` + `after(() => turn.finalize())`.
- **„Analysiere…"-Indikator** ([MessageBubble.tsx](../../src/components/interview/MessageBubble.tsx#L13)): rendert bei `isStreaming && content.length===0`. [ChatInterface.tsx](../../src/components/interview/ChatInterface.tsx#L122) fügt beim Absenden sofort eine leere Streaming-Bubble ein → Indikator deckt das synchrone-Analyst-Fenster ab.
- **Runner-Migration** ([runner.ts](../../src/services/__evals__/interview/runner.ts)): liest `turnResult.meta.analyst?.toolCalls` + ruft `turnResult.finalize()` (statt `background()`).
- **Regressionstests**: BUG-1 (`decideNextPhaseWithMeta` erhält frisch registrierten Step dieses Turns, nicht den leeren Pre-Turn-Tracker) + BUG-6 (`checkLifecycle` erhält frisches Briefing dieses Turns, nicht `interview.next_briefing` von vorher) — beide echt, prüfen die von ADR-021 benannte gemeinsame Wurzel.

### 3. Security-Audit

- Keine neue Route (nur Modifikationen an bestehenden token-authentifizierten `chat`/`start`/`reconnect`). Objekt-Ownership-Regel (neue `[id]`-Route) nicht anwendbar.
- Alle 3 geänderten Routen behalten: UUID-Token-Format-Check, `token_expires_at`-Expiry-Guard, `checkTokenEndpointLimits`-Rate-Limit, `completed`-Guard.
- Reconnect gibt jetzt statischen Text ohne DB-State-Read/LLM-Call zurück → reduziert Angriffs-/Kostenfläche (kein LLM auf jedem Page-Reload). Keine Datenexposition.

### 4. Eval-Gate (Pflicht, general.md — Interview-Engine)

Konfiguration: alle Komponenten `google/gemini-3.1-flash-lite` (Demo-Baseline), Judges `anthropic/claude-haiku-4-5`, Store `supabase`, `--seed 42`. Beide API-Keys vor dem Lauf validiert (Google 200, Anthropic 200).

| Persona | interview_id | turns | status | dedup_slot_coverage (Gate ≥0.75) | dialog_naturalness | grounding_viol | hallucination | step_registration |
|---------|-------------|-------|--------|-----------------------------------|--------------------|----------------|---------------|-------------------|
| buchhalter | `a9e01aa6…` | 5 | **FAIL** | 0.56 | 1.0 | 0 | 0 | 1.0 |
| it-support | `c26ee562…` | 10 | **FAIL** | 0.33 | 0.67 | 0 | 0 | 1.0 |

**Kernbefund: Kein PROJ-44-Regressionssignal.** Alle regressions-sensiblen Qualitätsmetriken sind in BEIDEN Läufen gesund (hallucination 0, talker_grounding_violations 0, blocked_rate 0, schema_conformance 1.0, step_registration 1.0, anchoring 0). Der Grounding-Guard hat im buchhalter-Lauf live eine Fabrikation ("Monatsabschluss erwähnt") erkannt und regeneriert. Der Timing-Flip funktioniert nachweislich (synchroner Analyst vor Talker, frischer State).

**Der FAIL ist pre-existing Varianz, kein Neubruch.** Vergleich gegen die am HEAD eingecheckten Pre-PROJ-44-Baselines (PROJ-42-QA, 2026-07-16):
- buchhalter pre-44: dedup 0.47 / 0.67 / 0.63 / 0.56 / 0.52 (alle FAIL); zusätzlich PASSes am 2026-07-11 und 2026-07-14. → Unser 0.56 liegt mitten in der bestehenden Verteilung.
- it-support pre-44: dedup 0.78 (**PASS**) / 0.59 (FAIL) — 1/2. Hohe Seed-Varianz. → Unser 0.33 ist ein niedriges Sample einer notorisch streuenden Metrik.

**Ursache der Coverage-FAILs (Transkript-Diagnose, deckt sich mit dem Measure-First-Item der Spec):** Beide Interviews terminieren, während später genannte Prozesse noch unterexploriert sind. buchhalter completet in Turn 5, unmittelbar nachdem die Persona auf die Closing-Sonde einen **dritten** Prozess (Mahnwesen) offenbart — der nie registriert wird; Monatsabschluss bekommt nur 1/4 Slots. Es werden **keine** Clarification-Cards für die leeren Pflicht-Slots erzeugt (`clarification_coverage_delta: 0`). Das sind exakt die beiden in der Eval-Gate-AC genannten Knöpfe: (a) `step_advance_ready`-Schwelle zu großzügig (explore→closing nach ~3 Turns), (b) Cards-Zuverlässigkeit (leere Slots erzeugen keine Card). Der Late-Discovery-während-Closing-Pfad ist zugleich BUG-4-Territorium (bewusst nach **PROJ-46** verschoben).

**Transkript-Level-Diagnose (Nutzer-Review 2026-07-17) — der eigentliche Befund.** Die aggregierten Scores verdeckten einen konkreten, reproduzierbaren High-Severity-Bug, der erst in der Turn-für-Turn-Lektüre beider Läufe sichtbar wurde (vgl. `feedback_transcript_level_qa_verification`). Beide Personas zeigen dasselbe Muster: nach ~3–4 substanziellen Turns springt die Phase auf `closing`; die Catch-all-Sonde fragt „gibt es noch etwas Wiederkehrendes?"; die Persona offenbart daraufhin einen **neuen, wesentlichen Prozess** (buchhalter Turn 5: Mahnwesen; it-support Turn 10: Software-Installation inkl. Genehmigungs-Bottleneck) — und das Interview **verabschiedet sich trotzdem sofort**, statt zurück in `explore` zu gehen und den Prozess zu vertiefen.

**Root Cause (am Code verifiziert) — H-1: Closing→Explore-Reentry greift für inhaltsreiche Late-Discovery nicht.** Der Reentry-Guard in [interviewOrchestrator.ts:254](../../src/services/interviewOrchestrator.ts#L254) (`checkLifecycle`) und [:182](../../src/services/interviewOrchestrator.ts#L182) (`decideNextPhase`) prüft `hasStepInStatus(ctx.stepTracker, 'exploring')`. Ein in der Sonden-Antwort genannter Prozess wird vom **synchronen** Analyst (PROJ-44-Timing) im selben Pass `register_step` (Status `exploring`) **und** direkt mit `record_slot`/`update_walkthrough_data` befüllt — und genau diese Slot-Writes heben den Status via [applyIntent.ts:167/194/208](../../src/services/turnStore/applyIntent.ts#L167) `exploring → walkthrough`. Bevor `checkLifecycle` läuft, ist der frische Step also bereits `walkthrough`; der `'exploring'`-only-Guard verfehlt ihn; `closingProbeAnswerReceived` ist true; ohne Cards → `soft_confirm`-Completion. Beleg: it-supports `finalStepTracker` enthält Software-Installation als **`walkthrough`** (Daten wurden erfasst) — die Exploration endete trotzdem. Der Guard feuert nur noch bei **inhaltsleeren** Late-Mentions (register ohne Slot → bleibt `exploring`); bei den quantitativ reichen Antworten der Personas (der wertvolle Fall) versagt er systematisch. Das ist der primäre Treiber der niedrigen `dedup_slot_coverage` und damit des roten Gates.

**Verhältnis zu PROJ-44:** Kein Rückschritt gegenüber pre-44 (dort ging der Late-Prozess über den Lag ganz verloren; jetzt werden seine Slots immerhin erfasst — eine Teilverbesserung). Aber die AC „BUG-1-Staleness … strukturell behoben; je ein Regressionstest belegt es" ist **nicht vollständig eingelöst**: der BUG-1-Regressionstest prüft nur, dass `decideNextPhaseWithMeta` den frischen Tracker *erhält* (mit einem `exploring`-Step im Fixture) — er deckt den realen Pfad (Late-Step wird im selben Turn geslottet → `walkthrough` → Guard verfehlt → Completion) **nicht** ab. Testlücke, nicht nur Prompt-Kalibrierung. Der Fix ist klein und orchestrator-lokal (Guard-Prädikat auf „in diesem Turn erstmals gesehener/registrierter Step" erweitern, nicht nur `exploring`) — und liegt im measure-first-Mandat der Eval-Gate-AC von PROJ-44 („gezielt am richtigen Knopf behoben").

**Weitere Transkript-Befunde:**
- **M-1 (vorzeitiges explore→closing):** `step_advance_ready` wird zu großzügig gesetzt → `closing` nach ~3 Turns bei 2 unterexplorierten Prozessen (buchhalter Turn 4). Der zweite in der Eval-Gate-AC namentlich genannte Knopf. Durch das frische Timing feuert `step_advance_ready` ggf. einen Turn früher als pre-44.
- **M-2 (Rollen-Guard-Falschpositiv, PROJ-42-Ursprung):** it-support Turn 2 — „15 bis 20 Tickets pro Tag. Zeitaufwand? Kommt drauf an." wird als `off_topic` klassifiziert → statischer Redirect + **wortgleiche** Wiederholung der Turn-1-Frage; da off_topic den Analyst kurzschließt (PROJ-44-Reihenfolge), wird der genannte Wert „15–20/Tag" in diesem Turn **nicht** extrahiert (erst Turn 3 nachgeholt). [roleGuard.ts](../../src/services/roleGuard.ts) unverändert durch PROJ-44 — Präzisionsproblem des Prefilter/Judge.
- **M-3 (sprunghafte Themenführung / fehlende Vertiefung):** „hin und her" zwischen Prozessen ohne Drill-Down (buchhalter Turn 2 Rechnungsprüfung→Monatsabschluss, Turn 3 zurück; it-support Turn 6 abrupt zu Hardware-Tausch). Analyst-Briefing-getrieben (`next_focus`), PROJ-43-Scope (Elicitation-Reorientierung), von PROJ-44 nicht adressiert.

**Fazit Eval-Gate:** rot, aber jetzt mit klarer, code-verifizierter Ursache statt „nur Varianz". Der Gate-Blocker ist überwiegend **H-1** (ein kleiner, lokalisierter Orchestrator-Fix), sekundär **M-1**. Kein `--runs 3` nötig, um das zu erkennen — die Ursache ist deterministisch und in beiden Single-Runs identisch reproduziert. Empfehlung: H-1 (und möglichst M-1) innerhalb von PROJ-44s measure-first-Mandat fixen, dann Gate erneut fahren; M-2/M-3 sind Fremd-Feature-Scope (PROJ-42/PROJ-43).

Eval-Artefakte:
- `docs/evals/interview/2026-07-16/2026-07-16-01-20-49-google-gemini-3-1-flash-lite-buchhalter.md`
- `docs/evals/interview/2026-07-16/2026-07-16-01-29-47-google-gemini-3-1-flash-lite-it-support.md`

(Hinweis: der Runner legte die Reports wegen einer Zeitzonen-/Datums-Kante am Mitternachtsübergang im Ordner `2026-07-16` ab; Systemdatum war 2026-07-17. Kosmetisch, unabhängig von PROJ-44.)

### 5. Noch offen (gehören zur In-Review-Runde, nicht Approved-blockend über das Eval-Gate hinaus)

- **Start/Reconnect curl-Verifikation gegen laufende Instanz:** nicht gefahren. Abgedeckt durch die umgeschriebenen Unit-Tests (`start.test.ts`/`reconnect.test.ts`, alle Guards + Happy-Path) und dadurch, dass die zwei Live-Evals die Chat-Turn-Pipeline inkl. `finalize()`/Extraktion/Dedup real ausgeführt haben (`[dedup] removed N duplicates` in beiden Läufen).
- **Latenz-Delta (Time-to-first-token vorher/nachher):** keine präzise A/B-Messung (bräuchte Revert des Working-Trees). Architektonisch bekannt: der volle synchrone Analyst (budget 2048) ersetzt den leichten Quick-Extract auf dem kritischen Pfad → TTFT steigt bewusst; der „Analysiere…"-Indikator überbrückt UX-seitig.
- **Manueller adversarialer Durchlauf (Tim-artig):** nicht separat gefahren; die buchhalter-Closing-Sonde hat einen realen Late-Discovery-Fall erzeugt (Mahnwesen), der die Coverage-Kalibrierungs-Lücke sichtbar gemacht hat.

### Bug-Tally

**0 Critical · 1 High · 3 Medium · 0 Low → 1:3:0**

- **H-1 (High):** Closing→Explore-Reentry greift für inhaltsreiche Late-Discovery nicht. Ein in der Sonden-Antwort genannter neuer Prozess wird vom synchronen Analyst im selben Turn registriert **und** geslottet → Status `exploring→walkthrough` ([applyIntent.ts:167](../../src/services/turnStore/applyIntent.ts#L167)) → der `hasStepInStatus('exploring')`-Guard in [interviewOrchestrator.ts:254/182](../../src/services/interviewOrchestrator.ts#L254) verfehlt ihn → `soft_confirm`-Completion statt Reentry. Primärer Treiber der niedrigen `dedup_slot_coverage` (rotes Gate), beide Personas, jeder Lauf. Kern-Produktwert (vollständige Prozesserfassung) degradiert. Fix klein + orchestrator-lokal; BUG-1-Regressionstest deckt diesen Pfad nicht ab (Testlücke).
- **M-1 (Medium):** Vorzeitiges explore→closing — `step_advance_ready` zu großzügig; `closing` nach ~3 Turns mit unterexplorierten Prozessen. Measure-first-Knopf der Eval-Gate-AC.
- **M-2 (Medium, PROJ-42-Ursprung):** Rollen-Guard-Falschpositiv (it-support Turn 2) → Redirect + wortgleiche Fragewiederholung + Slot-Verlust dieses Turns (Analyst kurzgeschlossen).
- **M-3 (Medium, PROJ-43-Scope):** Sprunghafte Themenführung ohne Vertiefung (Prozess-Ping-Pong).

Keine Critical-Befunde. Keine harte Regression (nichts vormals Funktionierendes ist gebrochen). H-1 ist ein von PROJ-44s synchronem Timing sichtbar gemachter Completion-Bug im Scope von PROJ-44s Eval-Gate-Verantwortung; M-2/M-3 sind Fremd-Feature-Scope, aber während dieser QA real beobachtet.

### Production-Ready-Entscheidung: **NEIN**

Zwei Gründe: (1) Pflicht-Eval-Gate (≥1 PASS je Persona) nicht nachgewiesen (0/2); (2) **H-1** ist ein High-Severity-Completion-Bug, der Approved unabhängig vom Gate blockt (QA-Regel: kein Approved bei Critical/High). PROJ-44 bleibt **In Review**. Empfohlener nächster Schritt: H-1 (+ möglichst M-1) im measure-first-Mandat fixen, `runInterviewTurn`-Regressionstest um den Late-Discovery-Slot-Pfad ergänzen, dann Gate erneut fahren.

## Remediation Plan — H-1 + M-1 + M-3 gebündelt (Nutzer-Freigabe 2026-07-17)

> Ergebnis der QA-Folge-Design-Diskussion (2026-07-17, Opus). Nutzer-Entscheidung: die drei zusammenhängenden Gesprächsführungs-Befunde **hier in PROJ-44** bündeln statt M-3 in PROJ-43 erneut aufzumachen — sie hängen alle am selben deterministischen Primitiv. M-2 (Rollen-Guard-Präzision) bleibt separat (KI-26 → PROJ-42). **Scope-Hinweis:** das Bündel weitet PROJ-44 über den ursprünglichen „schmalen" Schnitt (Option 1) hinaus; Appetite steigt faktisch von L Richtung XL. Bewusster Trade-off: kohärentes Gesprächsverhalten (Tiefe-zuerst) > saubere M-1/M-3-Eval-Attribuierbarkeit.

### Gemeinsames Primitiv: Grenznutzen-Drought auf O-Slots

Ein **per-aktiver-Schritt**-Zähler aufeinanderfolgender Turns **ohne neues O-Feld** (O2–O6: entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten — die substanziellen `COVERAGE_FIELDS` ohne das auto-gefüllte O1). Im Code berechnet (Muster wie `noNewExtractionStreak`, aber O-slot-spezifisch statt „irgendeine Extraktion" — der bestehende Streak resettet auf jede Extraktion inkl. Zahlen/Governance und taugt daher nicht), in `next_briefing` persistiert, am Turn-Anfang gelesen. „Belohnung" = neues O-Feld durch gezieltes Nachhaken; „Drought" (K Turns kein neues O-Feld für den aktiven Schritt) = Schritt qualitativ erschöpft. **Selbst-kalibrierend — kein fester Schwellwert.** K env-tunbar (analog `NO_NEW_EXTRACTION_LIMIT`), Startwert measure-first. Warum das die richtige Basis ist: das Gate `dedup_slot_coverage` misst genau diese O-Felder ([slotCoverage.ts:36](../../src/services/__evals__/interview/scorers/slotCoverage.ts#L36)), und die quantitativen `potenzial`-Slots sollen mit PROJ-43 ff. an Bedeutung verlieren (Zahlen → Cards) — ein Floor auf O-Feldern zieht mit beidem, ein Floor auf freq/duration liefe dagegen.

### Drei Fixes auf diesem Primitiv

**H-1 — Closing→Explore-Reentry (High, Gate-Blocker):**
- Erkennung via **Tracker-Diff nach `id`** in [runInterviewTurn.ts](../../src/services/runInterviewTurn.ts) (Pre-Analyst-Tracker vs. `analystResult.stepTracker`) → `newStepThisTurn`. Nicht über `toolCalls` — die tragen nur Args, kein Dedup-Ergebnis ([interviewAnalyst.ts:546](../../src/services/interviewAnalyst.ts#L546)); `StepEntry.id` (S001…) ist stabil und Merges behalten die kanonische id, also keine False Positives.
- `newStepThisTurn` in `OrchestratorContext`. [checkLifecycle](../../src/services/interviewOrchestrator.ts#L253) closing: `soft_confirm` vetoen wenn `newStepThisTurn`. [decideNextPhase](../../src/services/interviewOrchestrator.ts#L182) closing: `return 'explore'` wenn `newStepThisTurn` — status-unabhängig, ergänzt den bestehenden `hasStepInStatus('exploring')`-Check (der den walkthrough-gebumpten Late-Step verfehlt).

**M-1 — vorzeitiges explore→closing (Medium), Breite tracker-basiert (Alternative B):**
- `hasUnexploredFocusTopic`/`topicsOpen` aus der Phasenentscheidung **entfernen** — einziger funktionaler Konsument, daher risikoarm; kein Prompt/Scorer liest die Werte. `topicsOpen`/`update_topics` bleiben als inerte Plumbing (Analyst schreibt weiter, niemand liest → kein Bruch; späteres Cleanup optional).
- Ersetzen durch tracker-abgeleiteten Check: nicht nach closing, solange ein registrierter Schritt qualitativ **nicht erschöpft** ist (O-Drought noch nicht gefeuert). Tiefe + Breite verschmelzen zu **einem** Kriterium: „gibt es einen registrierten Prozess, der qualitativ noch nicht erschöpft ist?"

**M-3 — Fokus-Lock / Tiefe-zuerst (Medium, aus KI-27 hierher gezogen):**
- Das Ping-Pong lebt in der **Fokus-Wahl** (`next_focus`, analyst-getrieben), nicht in der Phasenentscheidung — ein anderer Hebel als M-1.
- Am Turn-Anfang bestimmt der Orchestrator den **gesperrten aktiven Schritt** aus Tracker + Drought-State und gibt ihn als `focusStepId` **in** den synchronen `runAnalyst`-Lauf → kohärentes Briefing + `suggested_question` für genau diesen Schritt (kein nachträgliches `next_focus`-Überschreiben, das mit der Frage kollidieren würde). Timing passt: der Drought-Streak ist am Turn-Anfang aus `next_briefing` verfügbar (wie `noNewExtractionStreak` heute).
- Der Lock löst **nur**, wenn die Drought des aktiven Schritts feuert → dann nächsten unerschöpften/neuen Schritt als aktiv wählen. Fokus wechselt nie mitten im Drill → **kein Ping-Pong**, Tiefe-zuerst garantiert.
- **Extraktion bleibt opportunistisch** — nebenbei genannte Daten anderer Prozesse werden weiter erfasst (Slots füllen sich); nur die Frage-Richtung ist gesperrt.

### Grenzen (kein Endlos-Loop, keine Strafe nötig)
Drought (primärer Stopp — Belohnung fällt selbst auf 0, wenn nichts mehr zu holen ist) + Wall-Clock-Soft-Anker 80% ([:148](../../src/services/interviewOrchestrator.ts#L148)) + Hard-Stop 100% ([:132](../../src/services/interviewOrchestrator.ts#L132)) als Deckel. **Keine separate Straffunktion** — sie wäre redundant und würde vorzeitig abbrechen. Ein sturer Prozess (Persona liefert keine O-Felder) hängt nicht fest: Drought feuert nach K → weiter.

### Tests (inkl. der bei H-1 gefundenen Testlücke)
- **H-1:** Closing-Turn, Analyst registriert **und** slottet neuen Step (→walkthrough) → `checkLifecycle` completet nicht, `decideNextPhase='explore'`.
- **M-1:** `step_advance_ready=true`, ein Step unerschöpft → bleibt `explore`; alle Steps erschöpft → `closing`.
- **M-3:** aktiver Schritt unerschöpft → `focusStepId` bleibt über mehrere Turns auf ihm; Drought feuert → wechselt auf nächsten dünnen Step.
- **Grenzen:** unerschöpfter Step + Soft-Anker überschritten → trotzdem `closing` (Floor hebelt die Zeit-Netze nicht aus).
- **Drought-Berechnung:** O-spezifisch, per-Step, persistiert — eigener reiner Unit-Test analog `computeNextBriefing`.

### Nicht in diesem Bündel
- **Clarification-Cards-Zuverlässigkeit** (`clarification_coverage_delta 0` trotz leerer Pflicht-Slots) — dritter Gate-Faktor, eigene Diagnose **nach** dem Bündel-Fix (H-1+M-1 heben Coverage schon deutlich; falls das Gate danach knapp rot bleibt, ist das der nächste Verdächtige, evtl. Prompt-nah).
- **M-2** (Rollen-Guard-Präzision) → KI-26 / PROJ-42.

### Nächster Schritt
`/backend` (bzw. `/build`) für dieses Bündel; danach das Pflicht-Eval-Gate erneut (buchhalter + it-support). QA fixt nicht selbst.

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
