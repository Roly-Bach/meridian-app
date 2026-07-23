# PROJ-44: Pipeline-Simplifikation (Analyst-vor-Talker + Legacy-Pfad)

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** XL (>3 Tage; ursprünglich L geschätzt, faktisch XL durch das H-1/M-1/M-3-Remediation-Bündel — siehe Scope-Hinweis im Remediation Plan)
**Bugs:** 0:2:0 (H-2 Farewell-Limbo + M-4/M-6/L-1/L-2 im Joint-Gate 2026-07-24 geschlossen, siehe Joint-Gate-Note unten — vorheriger Stand nach Runde 3 nach `resolveTurnLifecycle`-Merge-Verifikation + Mess-Eval: H-3 code-verifiziert UND live über 3 Läufe bestätigt behoben — kein Repro des Ein-Turn-Phasenlag-Musters. H-2 Farewell-Limbo bleibt offen, intermittierend (0 von 3 bis 6 von 3 Läufen betroffen), Worst-Case diese Runde schwerer als Runde 2 (6 Abschieds-Turns inkl. einem wortgleichen Duplikat vs. vorher max. 4). M-2, M-4, M-5, M-6, M-7, L-1, L-2 unverändert offen (Ursachen von der Runde-2-Remediation nicht adressiert, teils in dieser Runde erneut bestätigt).)
**Created:** 2026-07-16
**Last Updated:** 2026-07-17/18
**ADR:** ADR-021 (Timing-Amendment zu ADR-011 D2) — Status: Accepted · ADR-022 (Phasen-/Lifecycle-Merge `resolveTurnLifecycle`, supersediert die BUG-6-Aussage von ADR-021) — Status: Proposed
**Joint-Gate (2026-07-24):** H-2 (Farewell-Limbo/Analyst-Split-Brain) via PROJ-46 Completion-Readiness (ADR-024) transkript-belegt geschlossen — 6 frische Läufe (3 buchhalter + 3 it-support) zeigen durchgängig genau einen sauberen Abschied, completion_correctness true, kein Reopening, Turns beschränkt (15–35). Kein offener High-Bug mehr. Pflicht-Eval-Gate: it-support run2 PASS (dedup 0.78 ≥ 0.75, dialog 0.67, blocked 0); die sub-0.75-Läufe sind per [ADR-026](../../docs/adr/ADR-026-dedup-slot-coverage-gate-schema-divergenz.md) nicht-attribuierbar (Schema-Divergenz-Waiver). Im Joint-Gate zusätzlich geschlossen: **M-4** (Cards feuern nie — it-support-Lauf zeigt 8 Cards feuern + persistieren, PROJ-43-Mechanismus), **L-2** (Forced-Choice-Fragen — PROJ-43 code-verifiziert entfernt), **L-1/M-6** (fehlende Übergänge / Themensprünge — PROJ-48 Talker-Adherence, 6 Läufe ohne abrupten Sprung). Genuin offen bleiben **M-5** (`dependency_capture` ≈0, Instrument-/Coverage-Grenze) und **M-7** (Abschluss würdigt substanziellen Sonden-Inhalt nicht immer) als KIs; **M-2** ist als KI-26 bei PROJ-42 geführt (nicht doppelt gezählt). → Approved.

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
- [x] BUG-1-Staleness und BUG-6 sind über die frische Phasenentscheidung strukturell behoben; je ein Regressionstest belegt es. **Runde 3: vollständig eingelöst.** BUG-1-Staleness war bereits seit Runde 1 live verifiziert (H-1-Fix, Late-Discovery-Reentry funktioniert in beiden Personas). BUG-6 (H-3) ist mit dem `resolveTurnLifecycle`-Merge (ADR-022, Runde 2) code-verifiziert behoben: die terminale Auswertung läuft jetzt gegen die aufgelöste Phase (`resolveTurnLifecycle`s `target`), nicht mehr gegen `ctx.phase`. **QA-Runde 3 (2026-07-17/18) bestätigt das live**: über 3 Mess-Eval-Läufe (buchhalter ×2, it-support ×1) trat das spezifische H-3-Muster — ein Turn, der `closing` betritt, kann konstruktionsbedingt erst einen Turn später abschließen, weil `ctx.phase` der Vorturn-Wert ist — kein einziges Mal auf. Der BUG-6-Regressionstest wurde in Runde 2 auf **Phasen**frische umgeschrieben (statt nur Briefing-Frische wie der Runde-1-Test) und schließt damit exakt die von Runde 1 aufgedeckte Testlücke. **Wichtige Abgrenzung:** die in Runde-3-Läufen weiterhin beobachteten mehrfachen Verabschiedungen (siehe H-2 in QA-Runde 3 unten) sind ein **anderer, eigenständiger Mechanismus** (Analyst schreibt einen Farewell-Text in `suggested_question`, während der Orchestrator-State noch `explore` ist — kein Phasenlag), der von dieser AC nicht abgedeckt wird und explizit als Out-of-Scope-Rest (→ PROJ-46) dokumentiert ist.

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

- [ ] Pflicht-Eval-Gate grün (general.md, Interview-Engine): mindestens 1 PASS je Persona (buchhalter, it-support), `dedup_slot_coverage ≥ 0.75`. **Measure-first:** falls nach dem Timing-Flip weiterhin rot, wird innerhalb von PROJ-44 diagnostiziert, ob es die `step_advance_ready`-Schwelle (zu großzügig), die Clarification-Cards-Zuverlässigkeit (Null-Slots erzeugen keine Card) oder beides ist, und gezielt am richtigen Knopf behoben. Kein blindes Vorab-Nachjustieren. **Offen nach zwei Gate-Runden (0/2 PASS, buchhalter 0.48 / it-support 0.56).** Die Measure-first-Diagnose ist damit abgeschlossen: beide in dieser AC genannten Knöpfe (`step_advance_ready`-Schwelle und Cards-Zuverlässigkeit) sind identifiziert, der erste ist über das Remediation-Bündel behoben (M-1), der zweite ist als M-4 bestätigt und weiterhin offen. Zusätzlich in Runde 2 aufgedeckt und in dieser AC nicht vorgesehen: `dependency_capture` ist strukturell 0 (M-5, deckelt die Metrik bei 0.89) und der Nenner-Effekt der Coverage-Quote bestraft die von H-1 korrekt gefundenen Zusatzprozesse. Das Gate ist mit Agenten-Kalibrierung allein nicht erreichbar; siehe QA-Runde 2, Abschnitt 3.
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

## Remediation Implementation Notes (2026-07-17, `/backend`)

Gebaut wie im Remediation Plan oben entschieden — ein gemeinsames Primitiv (O-Drought), drei Fixes darauf. Keine Abweichung vom Plan.

**Gemeinsames Primitiv:** `ODroughtState { stepId, streak, exhaustedStepIds }` neu in [interviewTypes.ts](../../src/services/interviewTypes.ts) (neben `AnalystBriefing`, dort auch `AnalystBriefing.oDrought?` + `InterviewContext.focusStepId?`). `isCoverageFieldFilled` (bisher lokal in `slotCoverage.ts`) + neu `O_SLOT_FIELDS`/`countFilledOFields` nach [interviewSemantic.ts](../../src/services/interviewSemantic.ts) verschoben — ein Ort für "was zählt als O-Feld", vom Eval-Scorer UND vom Drought-Primitiv genutzt (`slotCoverage.ts` importiert jetzt von dort, keine Logik-Duplikation).

**[interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts) — vier neue reine Funktionen:**
- `hasNewStepThisTurn(before, after)` (H-1): Tracker-Diff nach `id`, nicht nach Status.
- `computeFocusLock(stepTracker, previous)` (M-3): wählt den gesperrten aktiven Schritt vor dem Analyst-Lauf; feuert die Drought des Vorschritts (`streak >= Limit`) → markiert ihn `exhaustedStepIds`, sperrt auf den nächsten nicht-done/nicht-erschöpften Kandidaten (Streak-Reset auf 0).
- `updateODrought(lock, before, after)` (M-1/M-3): Post-Analyst — vergleicht `countFilledOFields` vor/nach für den gesperrten Schritt, resettet oder inkrementiert.
- `hasUnexhaustedStep(tracker, lock)` (M-1, intern): ersetzt `hasUnexploredFocusTopic` in `decideNextPhase`'s `explore`-Case.

`OrchestratorContext` um zwei Pflichtfelder erweitert: `newStepThisTurn: boolean`, `oDrought: ODroughtState`. `decideNextPhase`'s `closing`-Case und `checkLifecycle`'s Trigger B prüfen jetzt zusätzlich `ctx.newStepThisTurn` (H-1); `decideNextPhase`'s `explore`-Case nutzt `hasUnexhaustedStep(ctx.stepTracker, ctx.oDrought)` statt der entfernten `hasUnexploredFocusTopic(ctx.topicsOpen, ...)` (M-1). `topicsOpen`/`update_topics` bleiben unverändert (inerte Plumbing, wie im Plan vorgesehen).

**[interviewAnalyst.ts](../../src/services/interviewAnalyst.ts) (M-3):** `AnalystRunOptions`/`OnlinePassOptions` um `focusLock: ODroughtState` (+ `preTurnTracker` bei letzterem) erweitert. `runAnalyst` setzt `focusStepId` auf dem `InterviewContext` (nur für den Analyst-Aufruf, nicht auf `contextBase` — bleibt dadurch vom Talker-Kontext getrennt, PROJ-46-Scope-Grenze gewahrt). `buildAnalystSystemPrompt` rendert bei gesetztem `focusStepId` eine `FOKUS-LOCK`-Zeile im "Aktueller Kontext"-Footer (nicht im stabilen STUFE-0-4-Präfix — WP5-Cache-Test bleibt grün, da die Zeile bei fehlendem Fokus leer ist). `runOnlinePass` berechnet `updateODrought` unmittelbar vor dem `produce_briefing`-Stage-Call und hängt das Ergebnis ans Briefing — ein einziger Commit pro Pass bleibt erhalten (kein zweiter `produce_briefing`-Stage-Aufruf, der am `briefingProduced`-Guard scheitern würde).

**[runInterviewTurn.ts](../../src/services/runInterviewTurn.ts):** `preTurnTracker`-Konstante direkt nach dem Tracker-Laden (Baseline für Diff/Lock); `computeFocusLock` läuft VOR dem synchronen Analyst-Aufruf (liest `analystBriefing?.oDrought` vom Vorturn); `focusLock` wird in den `runAnalyst`-Call gereicht; `orchestratorCtx` bekommt `newStepThisTurn` (Diff pre-/post-Analyst) und `oDrought` (`analystBriefing?.oDrought` nach dem Analyst-Lauf, Fallback auf den vorab berechneten Lock bei terminalem Analyst-Fehler — ADR-021-D4-Fail-Safe bleibt intakt).

**Tests:** 17 neue/ersetzte Unit-Tests in `interviewOrchestrator.test.ts` (3× M-1 explore/closing-Fälle, 1× H-1 `decideNextPhase`, 1× H-1 `checkLifecycle`, je ein Describe-Block für `computeFocusLock`/`updateODrought`/`hasNewStepThisTurn`, inkl. `O_DROUGHT_LIMIT`-Env-Override-Test analog `NO_NEW_EXTRACTION_LIMIT`). `interviewOrchestrator.tim-regression.test.ts` Turn-9-Fixture um ein explizites `oDrought` ergänzt (der reale Tim-Verlauf hätte bis Turn 9 auch drought-technisch gefeuert — beide Signale stimmen jetzt überein, statt nur `step_advance_ready` allein reichen zu lassen). `tsc --noEmit` grün, volle Suite **902/903** (1 Skip vorbestehend, 67 Testdateien).

**Nicht in diesem Pass:** Live-`/eval:interview`-Lauf (gehört zu `/qa`, nicht `/backend`). Status bleibt **In Review** bis QA das Bündel gegen das Eval-Gate erneut verifiziert; `Bugs: 1:3:0` im Header unverändert, da nur QA nach Verifikation die Zählung aktualisiert (general.md-Konvention).

## QA Test Results — Runde 2 (Remediation-Verifikation, 2026-07-17)

> `/qa PROJ-44`, zweiter Durchlauf nach dem H-1/M-1/M-3-Remediation-Bündel. Status bleibt **In Review**. Die drei remediierten Bugs sind live verifiziert behoben; das Pflicht-Eval-Gate bleibt rot, mit jetzt vollständig aufgeklärter Ursachenstruktur, und ein neuer High-Befund (H-2) ist dazugekommen.

### Zusammenfassung

| Achse | Ergebnis |
|-------|----------|
| `tsc --noEmit` | ✅ pass |
| Unit-Suite | ✅ 902 passed / 1 skipped (67 Dateien) — Skip vorbestehend |
| Remediation-Code (Code-Level) | ✅ Plan 1:1 umgesetzt, Drought-Baseline korrekt verdrahtet |
| H-1 (Closing→Explore-Reentry) | ✅ **live behoben**, beide Personas |
| M-1 (vorzeitiges Closing) | ✅ **live behoben** (Closing ab Turn 9 bzw. 12 statt 3–4) |
| M-3 (Themen-Ping-Pong) | 🟡 **gemildert, nicht behoben** (Tiefe-zuerst greift, it-support O-Felder 3 → 9; Fokus-Lock ist aber nur advisory → Sprünge bleiben. Korrigiert nach Nutzer-Review, siehe 6.1) |
| Eval-Gate (Pflicht) | ❌ **0/2 PASS** (buchhalter 0.48, it-support 0.56; Gate ≥ 0.75) |
| Regressions-sensible Metriken | ✅ hallucination 0, grounding 0, anchoring 0, schema 1.0, step_registration 1.0, blocked 0 (beide Läufe) |
| Bugs (H:M:L) | **2:5:2** (revidiert nach Nutzer-Transkript-Review, siehe Abschnitt 6) |
| Production-ready | **NEIN** (H-2, H-3 + rotes Gate) |

Konfiguration identisch zur Runde 1 (alle Komponenten `google/gemini-3.1-flash-lite`, Judges `anthropic/claude-haiku-4-5`, `--store supabase --seed 42`), damit der Vergleich sauber attribuierbar ist. Beide API-Keys vorab validiert (Google 200 via Node-Fetch, Anthropic 200). Kosten rund $0.12 je Lauf.

### 1. Remediation live verifiziert (die eigentliche Frage dieser Runde)

**H-1 behoben, in beiden Personas reproduziert.** Genau der Pfad, an dem Runde 1 scheiterte, läuft jetzt korrekt:

| Persona | Late-Discovery | Verhalten Runde 1 | Verhalten jetzt |
|---------|----------------|-------------------|-----------------|
| buchhalter | Turn 10 „Mahnlauf" (Phase war `closing` in Turn 9) | Interview verabschiedete sich sofort (Completion Turn 5) | Rücksprung nach `explore`, Mahnlauf über Turns 11–13 exploriert, 3 O-Felder erfasst |
| it-support | Turn 13 „Softwareanfragen" (Phase war `closing` in Turn 12) | Completion trotz neuem Prozess | Rücksprung nach `explore`, Turns 14–16 vertieft |

**M-3 behoben:** kein Prozess-Ping-Pong mehr, Fokus bleibt über mehrere Turns am selben Schritt. Deutlichster Beleg it-support: die O-Feld-Tiefe stieg von 1 O-Feld pro Schritt (Runde 1: alle drei Schritte nur `hilfsmittel`) auf 4/4/1. `dedup_slot_coverage` dort 0.33 → **0.56**.

**M-1 behoben:** `closing` fällt nicht mehr nach ~3 Turns, sondern erst bei Turn 9 (buchhalter) bzw. 12 (it-support).

**Architektur-AC live bestätigt:** `analyst_online` lief exakt 17 Calls auf 17 Turns bzw. 18 auf 18. Genau eine Analyst-Naht pro Turn, wie in ADR-021 gefordert.

### 2. Neuer Befund H-2: Farewell-Limbo (High)

Der Transkript-Level-Review (nicht die Aggregat-Scores) legte einen neuen, reproduzierbaren Fehler offen. buchhalter Turns 14 bis 17, vier aufeinanderfolgende Verabschiedungen:

| Turn | Phase | Agent |
|------|-------|-------|
| 14 | `explore` | „Damit haben wir alle wesentlichen Kernaufgaben erfasst. Ich wünsche dir einen produktiven weiteren Arbeitstag." |
| 15 | `explore` | „Danke, ebenso. Einen erfolgreichen Tag noch." |
| 16 | `closing` | „Alles klar, dann belassen wir es dabei. Einen erfolgreichen Tag noch." |
| 17 | `closing` | „Vielen Dank für deine Zeit ... Einen erfolgreichen Tag noch." |

**Mechanismus (am Code und am Transkript verifiziert):** In Turn 13 bestätigt die Persona, dass es keine weiteren Prozesse gibt. Der Talker hat damit nichts mehr zu fragen und improvisiert eine Verabschiedung. Die Phasenmaschine schließt aber nicht ab, weil `decideNextPhase`s `explore`-Zweig zwei Wege nach `closing` kennt und beide blockiert sind:
1. `hasUnexhaustedStep(...)` ist noch `true` (die O-Drought hat nicht jeden Schritt erschöpft). Das ist genau der von M-1 neu eingezogene Floor.
2. Die Notbremse `noNewExtractionStreak >= 3` feuert nicht, weil der Analyst auch aus reinen Höflichkeitsfloskeln noch etwas extrahiert. Turn 15 schreibt `record_slot frequency_per_month` für S001 aus der Nachricht „Vielen Dank für das angenehme Gespräch ...", was den Streak auf 0 zurücksetzt.

Damit hält der Streak-Reset die Notbremse offen, während der M-1-Floor den regulären Weg sperrt. Das Interview läuft leer weiter, bis eine andere Bedingung greift.

**Einordnung, ehrlich abgegrenzt:** Das Symptom ist nicht neu (die KI-18-Historie dokumentiert am 2026-06-30 ein „vierfaches Auf-Wiederhören-Wiederholungsmuster", vor PROJ-44). Der Mechanismus ist auch **nicht** die Wurzel von BUG-6 (Pre-Turn-Phasenwert), die PROJ-44 tatsächlich behoben hat. Aber: das Remediation-Bündel macht diesen Zustand erst erreichbar, weil es Interviews absichtlich in die Länge zieht (buchhalter 5 → 17 Turns) und damit regelmäßig in den Zustand „Talker hat nichts mehr zu fragen, Floor lässt noch nicht schließen" führt. Vor der Remediation schloss buchhalter in Turn 5 und erreichte den Zustand nie. Kein Datenverlust, `completion_correctness` bleibt `true`; die Einstufung als High folgt daraus, dass es im Demo-Pfad unmittelbar sichtbar ist und rund ein Viertel des Turn-Budgets verbrennt.

Hinweis zur Instrument-Güte: der `dialog_naturalness`-Judge hat die vier Verabschiedungen **nicht** bemängelt (0.67, Begründung nennt nur Redundanz in zwei Texten). Der Befund war ausschließlich über die Turn-für-Turn-Lektüre sichtbar, siehe `feedback_transcript_level_qa_verification`.

### 3. Eval-Gate: warum es trotz behobener Bugs rot bleibt

| Persona | Runde 1 (pre-Remediation) | Runde 2 (post) | Gate | Turns | Schritte |
|---------|---------------------------|----------------|------|-------|----------|
| buchhalter | 0.56 FAIL | **0.48 FAIL** | ≥0.75 | 5 → 17 | 2 → 3 |
| it-support | 0.33 FAIL | **0.56 FAIL** | ≥0.75 | 10 → 18 | 3 → 3 |

**buchhalters Rückgang ist ein Artefakt der Metrik, kein Rückschritt im Inhalt.** `dedup_slot_coverage` ist ein Verhältnis: `Σ gefüllte Felder / (n_Schritte × 9)` ([slotCoverage.ts](../../src/services/__evals__/interview/scorers/slotCoverage.ts)). Der von H-1 neu gefundene dritte Prozess (Mahnlauf) hebt den Nenner um 9. Absolut erfasst der Lauf **mehr** Wissen als vorher (13 statt 10 gefüllte Felder, 3 statt 2 Prozesse), die Quote fällt trotzdem von 0.56 auf 0.48. Das Gate bestraft damit genau das, was H-1 richtig macht, solange der neu entdeckte Prozess nicht mindestens so tief exploriert wird wie der Durchschnitt der bestehenden. Das ist ein Zielkonflikt zwischen Messinstrument und Produktwert und gehört vor der nächsten Gate-Runde entschieden (Instrument-Frage, PROJ-40/ADR-020-Territorium, nicht durch weiteres Nachjustieren am Agenten lösbar).

**Zwei strukturelle Deckel, die das Gate unabhängig davon fast unerreichbar machen:**
- **M-5: `dependency_capture` ist 0 in 4 von 4 Läufen** (beide Runden, beide Personas). O6 `abhaengigkeiten` ist eines der 9 Coverage-Felder und wird nie gefüllt. Damit liegt die erreichbare Obergrenze bei 8/9 = 0.89, und rund 11 Prozentpunkte des Abstands zum Gate sind rein strukturell.
- **M-4: `clarification_coverage_delta` ist 0 in 4 von 4 Läufen.** Leere Pflicht-Slots erzeugen weiterhin keine Clarification-Card. Das ist der im Remediation-Plan bewusst zurückgestellte „dritte Gate-Faktor". Er ist damit jetzt als real bestätigt, nicht mehr als Verdacht.

Rechnerisch: für 0.75 müssten je Schritt 6.75 der 9 Felder gefüllt sein. Bei 2 automatischen (O1) und faktisch 0 für O6 müssten also fast alle 6 verbleibenden O-Felder je Schritt sitzen. Ist-Stand sind 2 bis 4. Der Agent verbringt die gewonnenen Turns überwiegend mit quantitativen Fragen (Frequenz, Dauer, Fehlerquote), die **nicht** in `dedup_slot_coverage` zählen. Genau diese Verlagerung von Zahlen zu Cards ist PROJ-43-Scope. Der Fokus-Lock steuert den Analysten korrekt auf O-Felder, aber die Fragerichtung des Talkers folgt weiterhin seinem eigenen Methodik-Block (PROJ-46-Scope).

### 4. Regression und Sicherheit

- Keine harte Regression: hallucination_rate 0, `talker_grounding_violations` 0, anchoring 0, `schema_conformance_rate` 1.0, `step_registration_coverage` 1.0, `blocked_rate` 0 in beiden Läufen. `dialog_naturalness` 0.67 in beiden, Gate ≥0.65 gehalten.
- `completion_correctness` `true` in beiden Läufen, beide Interviews terminieren sauber (`completed`).
- M-2 (Rollen-Guard-Falschpositiv) ist in dieser Runde **nicht** aufgetreten (0 Redirects in beiden Transkripten). Unverändert ungelöst, nur nicht getriggert. Bleibt KI-26 / PROJ-42.
- BUG-4 (wortgleiche Wiederholung der Catch-all-Sonde nach Late-Discovery) ist in it-support Turn 17 erwartungsgemäß erneut aufgetreten. Bekannt, bewusst nach PROJ-46 verschoben, kein neuer Befund.
- Sicherheit: keine Änderung gegenüber Runde 1, keine neue Route, keine neuen Datenpfade.

### 5. Testlücke (Restbefund, Low-Impact)

Die Einzelteile der Remediation sind sauber getestet (`hasNewStepThisTurn`, `computeFocusLock`, `updateODrought`, plus H-1 auf `decideNextPhase`/`checkLifecycle`). Nicht getestet ist die **Verdrahtung** in `runInterviewTurn.ts`, also dass `preTurnTracker` tatsächlich die Pre-Analyst-Baseline ist und der Diff `newStepThisTurn` erreicht. Am Code verifiziert (der `runAnalyst`-Aufruf in Zeile 285 liegt vor der Tracker-Neuzuweisung in Zeile 313), und der Live-Eval belegt das Verhalten in beiden Personas. Ein Integrationstest auf `runInterviewTurn`-Ebene würde die Klasse Lücke schließen, die Runde 1 bei BUG-1 aufgedeckt hat. Nicht als eigener Bug gezählt, da Verhalten doppelt belegt.

### 6. Nutzer-Transkript-Review (2026-07-17) und Befundanalyse

> Der Nutzer hat beide Transkripte Turn für Turn annotiert (17 Anmerkungen). Jede wurde gegen Code und Transkript geprüft. Ergebnis: **zwei Bewertungen aus Abschnitt 1 dieser QA-Runde waren zu großzügig und sind unten korrigiert.** Die Annotationen decken zusätzlich zwei Befunde auf, die weder Runde 1 noch der Aggregat-Blick dieser Runde gefunden hat.

#### 6.1 Korrektur: M-3 ist nur teilweise behoben, nicht behoben

Abschnitt 1 behauptete „M-3 behoben, kein Prozess-Ping-Pong mehr". Die Annotationen 1c, 1f, 2e und 2f widerlegen das mit konkreten Turns. Am Code verifizierte Ursache:

Der Fokus-Lock ist **advisory, nicht bindend**. `runAnalyst` setzt `focusStepId` ausschließlich auf dem Analyst-Kontext ([interviewAnalyst.ts](../../src/services/interviewAnalyst.ts), `mergedContext`) und rendert daraus die `FOKUS-LOCK`-Zeile im **Analyst**-Systemprompt. Der Talker sieht `focusStepId` nie (bewusste PROJ-46-Scope-Grenze, im Backend-Abschnitt sogar explizit als Feature notiert). Er erhält den Lock nur indirekt über `briefing.next_focus`/`suggested_question`, und sein eigener Prompt stuft das ausdrücklich als unverbindlich ein: `Empfohlene Frage (anpassen wenn bereits beantwortet)` ([talkerPrompt.ts:389](../../src/services/talkerPrompt.ts#L389)).

Konsequenz: der Lock steuert, **worüber der Analyst nachdenkt**, nicht **was der Interviewer fragt**. Er hebt die Tiefe statistisch (it-support 1/1/1 → 4/4/1 O-Felder), verhindert Themensprünge aber nicht. Beleg aus den Transkripten: buchhalter Turn 7 und Turn 12 springen zurück zum Monatsabschluss, obwohl dessen Drought längst gefeuert hatte und er damit gar nicht mehr lockbar ist (`computeFocusLock` nimmt erschöpfte Schritte nie erneut auf). Dasselbe it-support Turn 15 (zurück zum Hardware-Tausch) und Turn 16 (Sprung zu Softwareanfragen). Der Talker ignoriert den Lock schlicht.

Richtige Formulierung: **M-3 gemildert, nicht behoben.** Strukturell bindend wird der Lock erst mit PROJ-46 (Judgment-Signal-Migration). KI-27 ist entsprechend auf „teilweise behoben" zurückgesetzt.

#### 6.2 Neuer High-Befund H-3: `ctx.phase` ist weiterhin der Vorturn-Wert, BUG-6-Mechanismus damit unbehoben

Die Annotation 1i („der automatische Abschluss nach Turn 14 klappt nicht, warum?") führt auf einen Befund, der eine als `[x]` markierte AC widerlegt.

`runInterviewTurn.ts` liest die Phase in Zeile 193 aus dem persistierten State: `const currentPhase = (state?.phase ?? 'intro') as Phase`. Das ist der Wert vom **Ende des Vorturns**. Dieser Wert geht unverändert als `phase: currentPhase` in den `orchestratorCtx` (Zeile 331), dessen Kommentar „fresh — includes this turn" nur für `stepTracker` und `analystBriefing` zutrifft, **nicht** für die Phase. `checkLifecycle` läuft in Zeile 351, `decideNextPhaseWithMeta` erst in Zeile 439. Die Lifecycle-Prüfung kann die Phasenentscheidung dieses Turns also **konstruktionsbedingt nie sehen**.

`checkLifecycle`s Trigger B ist an `ctx.phase === 'closing'` gebunden. Ein Turn, der `closing` gerade erst betritt, kann daher niemals im selben Turn abschließen. Der Abschluss ist strukturell immer mindestens einen Turn später.

Genau das ist der in dieser Spec unter „Context" formulierte **BUG-6**: „doppelte Verabschiedung, weil `checkLifecycle`s `closing`-Trigger auf dem Pre-Turn-Phasenwert nicht greift." PROJ-44 hat die Staleness von Tracker und Briefing beseitigt, den Phasenwert selbst aber unangetastet gelassen. Die AC „BUG-1-Staleness und BUG-6 sind über die frische Phasenentscheidung strukturell behoben; je ein Regressionstest belegt es" ist für den BUG-6-Teil **nicht eingelöst**. Der zugehörige Regressionstest prüft laut Runde-1-QA, dass `checkLifecycle` das frische **Briefing** erhält, nicht dass es den frischen **Phasenwert** erhält. Gleiche Testlücken-Klasse, die Runde 1 schon bei BUG-1 gefunden hat.

Nachweis am buchhalter-Verlauf (`meta.phase` im Transkript ist die für den Turn **aufgelöste** Phase, also der Wert, den der Folgeturn als `ctx.phase` liest):

| Turn | `ctx.phase` (Turnbeginn) | aufgelöste Phase | Completion möglich? |
|------|--------------------------|------------------|---------------------|
| 15 | `explore` | `explore` | nein, Trigger B verlangt `closing` |
| 16 | `explore` | `closing` | **nein, obwohl alle Abschlussbedingungen erfüllt waren** (Sonde in Turn 9 gestellt, in Turn 10 beantwortet, kein neuer Schritt, keine Cards) |
| 17 | `closing` | `closing` | ja, `soft_confirm` |

Turn 16 ist damit ein **direkt der Phasen-Staleness zurechenbarer Leerlauf-Turn**. Die Sonde war bereits gestellt, also unterdrückt `shouldInjectClosingProbe` eine Wiederholung, und der Talker hatte in Turn 16 keine Anweisung. Er improvisierte die dritte Verabschiedung.

**Präzisierung nach Code-Review (2026-07-17): H-3 ist keine bloße Reihenfolge-Frage, sondern eine verlustbehaftete Doppelung.** `decideNextPhase` und `checkLifecycle` implementieren dieselbe Entscheidung zweimal: die Hard-Stop-Timer-Regel und die komplette Abschluss-Bedingung (`closing` + Sonde beantwortet + kein neuer Schritt + keine Cards) stehen in **beiden** Funktionen. `decideNextPhase` berechnete in Turn 16 bereits korrekt `'completed'`, und [runInterviewTurn.ts:440](../../src/services/runInterviewTurn.ts#L440) verwirft es sofort: `nextPhaseDecision === 'completed' ? 'closing' : ...`. Der `return 'completed'`-Zweig ist damit **toter Code** (verhält sich identisch zum Fallthrough `return 'closing'`); `decideNextPhaseWithMeta` hat genau einen Produktions-Aufrufer, der `'completed'` verwirft. Turn 16 *wusste* also, dass fertig ist, hat es weggeworfen; Turn 17 leitete dieselbe Schlussfolgerung über `checkLifecycle` ein zweites Mal her. **Konsequenz für den Fix: zusammenlegen, nicht umsortieren.** Bloßes Umsortieren würde die Doppelung konservieren. Eine Funktion `{phase, complete, reason}` mit einer Wahrheitsquelle löst H-3, entfernt den toten Zweig und entspricht dem Deep-Module-Leitprinzip der Spec. Der Regressionstest muss die **Phasen**frische prüfen, nicht die Briefingfrische.

#### 6.3 Damit zerfällt H-2 (Farewell-Limbo) in drei getrennte Ursachen

Die vier Verabschiedungen sind kein einzelner Bug, sondern drei Mechanismen hintereinander:

| Turn | Ursache |
|------|---------|
| 14, 15 | Der **Analyst** schreibt die Verabschiedung selbst ins Briefing, der Talker führt sie nur aus (siehe 6.6-i). Gleichzeitig sperrt der M-1-Floor (`hasUnexhaustedStep` noch `true`) den regulären Weg nach `closing`, und die Notbremse `noNewExtractionStreak` kann nicht feuern, weil **fehlgeschlagene** Extraktionsversuche sie zurücksetzen (siehe 6.6-ii). |
| 16 | **H-3**: `closing` ist entschieden, aber `ctx.phase` ist noch `explore`, Trigger B greift nicht. |
| 17 | Abschluss (`soft_confirm`). |

Bemerkenswert: der Remediation-Plan hat die Schwäche des Streaks selbst benannt („der bestehende Streak resettet auf jede Extraktion inkl. Zahlen/Governance und taugt daher nicht") und deshalb die O-Drought eingeführt, sie dann aber nur für den Floor genutzt und die Notbremse unverändert gelassen. Floor und Notbremse widersprechen sich seitdem.

#### 6.4 Neuer Medium-Befund M-7: Abschluss ignoriert eine substanzielle Sonden-Antwort

Annotation 2h trifft einen Fall, der schwerer wiegt als „Formulierung geht nicht auf die Antwort ein". it-support Turn 18:

> **Mitarbeiter:** „Ständiger Wechsel zwischen Jira, Remote-Desktop und Wiki. Drei Mal pro Ticket. Ziemlich ineffizient."
> **Agent:** „Danke für deine Zeit und die Einblicke in deine tägliche Arbeit. Damit sind wir am Ende des Gesprächs."

Das ist ein echter Medienbruch mit Frequenzangabe, also genau das KI-Potenzial-Signal, das das Produkt sucht. Zwei Ursachen:
1. **H-1s Guard ist zu eng.** `newStepThisTurn` vetoet die Completion nur bei einem neuen **Schritt**. Die Antwort fügte einem bestehenden Schritt einen Bottleneck hinzu (Turn 18 feuerte 12× `record_slot` plus `link_bottleneck`), registrierte aber keinen neuen Schritt. Also kein Veto, `soft_confirm` greift, sobald die Sonde überhaupt beantwortet ist, unabhängig **wovon** die Antwort handelt.
2. **Der Completion-Farewell ist inhaltsblind.** Der Abschluss-Talker-Call bekommt ein festes `farewellBriefing = { next_focus: 'Verabschiedung', suggested_question: 'Verabschiede dich kurz und herzlich.' }` ([runInterviewTurn.ts:395](../../src/services/runInterviewTurn.ts#L395)). Die Historie liegt zwar an, die Anweisung ist aber generisch.

Immerhin: die Extraktion lief, das Wissen ist in der Datenbank. Der Verlust ist konversationell (kein Nachhaken auf ein starkes Signal), nicht datenseitig. Daher Medium, nicht High.

#### 6.5 Bewertung der übrigen Annotationen

| # | Annotation | Prüfergebnis | Zuordnung |
|---|-----------|--------------|-----------|
| 1a | Turn 4: kein Übergang von Prozess X zu Y | **Bestätigt.** Der Drought-getriebene Lock-Wechsel (`computeFocusLock` schaltet auf den nächsten Kandidaten) hat keine Übergangs-Affordanz. Der Analyst bekommt einen neuen `next_focus`, niemand fordert eine sprachliche Brücke oder einen Mini-Wrap-up an. Nebenwirkung der Remediation. | neu, → PROJ-46 (Briefing-Signale) |
| 1b | Turn 5 „sehr stark" | Positivbefund, Medienbruch-Frage aus Systemwechsel abgeleitet. Kein Handlungsbedarf. | — |
| 1c | Turn 7: Rücksprung Monatsabschluss trotz Lock | **Bestätigt, Ursache 6.1** (Lock nur advisory). Die vom Nutzer genannte inhaltliche Plausibilität (Medienbruch-Thema quer über Prozesse) ist zutreffend, die Formulierung bleibt schwach, weil kein Übergang gefordert wird. | M-6, → PROJ-46 |
| 1d | Turn 8 „sehr gut" | Positivbefund. | — |
| 1e | Turn 9: Sonde ohne Übergang | **Bekannt und erwartet.** `CLOSING_PROBE_TEXT` ist ein statischer, deterministisch injizierter Text ohne LLM-Formulierung ([interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts)). Exakt das Item „Audit der statischen Text-Ausgaben" aus der PROJ-46-Abgrenzung dieser Spec. | bekannt, → PROJ-46 |
| 1f | Turn 12: erneut Monatsabschluss; „Ausdrucken" nie erwähnt? | **Beides bestätigt.** (a) Rücksprung wie 1c. (b) Der Mitarbeiter hat „ausdrucken" bis Turn 12 **nie** erwähnt: die einzigen Treffer auf „druck" davor sind „Zeit**druck**" (Turn 2 und 4), ein anderes Wort. Der Agent bringt das Beispiel selbst ein. **Keine** Grounding-Verletzung im Sinne des Guards (keine Zuschreibung „du hast erwähnt"), deshalb korrekt nicht geflaggt, aber eine anbietende/suggestive Frage der KI-21-Klasse. Der Mitarbeiter musste sie in Turn 13 verneinen, was einen Turn kostete. Die Medienbruch-Frage zum Monatsabschluss war in Turn 7/8 tatsächlich schon geklärt (SAP FI → Excel), die Wiederholung also redundant. | M-6 + KI-21/KI-25, → PROJ-43 |
| 1g | Turn 13 Closing „bessere Richtung" | Positivbefund: dieses Closing ist LLM-formuliert und nennt die erfassten Prozesse. Kontrast zur statischen Sonde in 1e stützt das PROJ-46-Statik-Audit. | — |
| 1h | Turn 14: Formulierung passt nicht zur Antwort | **Bestätigt**, gleiche Wurzel wie 6.3 (Talker ohne Anweisung im Leerlauf). | H-2 |
| 1i | Turn 15–17 dürfte es nicht geben | **Bestätigt, Ursache 6.2/6.3.** | H-2 + H-3 |
| 2a | Turn 3: Forced-Choice trotz „Notieren wir das als variabel" | **Bekanntes Fehlerbild**, KI-25 (Forced-Choice greift blind) plus KI-21 (Anchoring durch die Frageform). Zusätzlich verbalisiert der Agent seine interne Notiz. Von PROJ-44 nicht adressiert. | bekannt, → PROJ-43 |
| 2b | Turn 3–5 mehrfaches Nachhaken | Vom Nutzer als grenzwertig, aber überwiegend positiv bewertet. Kein Bug. | — |
| 2c | Turn 7 Übergang funktioniert | Positivbefund. Zeigt, dass die Übergangsqualität LLM-abhängig schwankt, nicht strukturell gesichert ist. Stützt 1a. | — |
| 2d | Turn 12 Sonde | Wie 1e. | bekannt, → PROJ-46 |
| 2e | Turn 15: Sprung zum Hardware-Tausch, Frage aus Turn 6 wiederholt | **Bestätigt**, Ursache 6.1. Zusätzlich: die Frage war in Turn 6/7 beantwortet und wurde mit „Du hast die manuellen Abgleiche bestätigt" abgeschlossen, statt vertieft. | M-6 |
| 2f | Turn 16: Sprung zu Softwareanfragen | **Bestätigt**, Ursache 6.1. | M-6 |
| 2g | Turn 17: Sonde erneut | **Bekannt, erwartet:** BUG-4 (wortgleiche Sonden-Wiederholung nach Late-Discovery-Umweg), bewusst nach PROJ-46 verschoben. | bekannt, → PROJ-46 |
| 2h | Turn 18: Abschluss ohne Bezug zur Antwort | **Bestätigt und schwerwiegender als beschrieben**, siehe 6.4. | M-7 (neu) |

#### 6.6 Vertiefung H-2: die zwei Mechanismen, am Trace belegt

> Nutzer-Rückfrage 2026-07-17. Meine erste H-2-Erklärung („der Talker improvisiert eine Verabschiedung, der Analyst extrahiert aus Höflichkeitsfloskeln") war eine Hypothese und ist in **beiden** Punkten mechanisch falsch. Die belegte Fassung:

**(i) Der Talker improvisiert nicht. Der Analyst befiehlt die Verabschiedung.**

Die Tool-Calls der betroffenen Turns zeigen es wörtlich. Der Analyst produziert (synchron VOR dem Talker, also genau die PROJ-44-Reihenfolge) folgendes Briefing:

| Turn | `next_focus` | `suggested_question` |
|------|--------------|----------------------|
| 14 | `Zusammenfassung / Abschluss` | „Vielen Dank, Andreas. Damit haben wir ein sehr klares Bild deiner Tätigkeiten. Gibt es aus deiner Sicht noch irgendeine Frage [...], bevor wir unser Gespräch abschließen?" |
| 15 | `Abschluss der Datenerhebung` | „Vielen Dank für das aufschlussreiche Gespräch, Herr Meier. Wir haben alle wesentlichen Punkte erfasst. **Ich wünsche Ihnen einen angenehmen Arbeitstag.**" |

Die „empfohlene Frage" ist in Turn 15 gar keine Frage mehr, sondern eine fertige Verabschiedung. Der Talker rendert sie pflichtgemäß. Er verhält sich also **korrekt**; der Fehler sitzt eine Ebene höher.

Das ist ein **Split-Brain in der Terminierungs-Hoheit**: PROJ-42 hat die Beendigung bewusst deterministisch in den Zustand gelegt („termination is now deterministic in state [...] not guessed from text heuristics (KI-23)", Doc-Kommentar in `checkLifecycle`). Der Analyst ist an diese Entscheidung aber nicht gebunden. Sein Briefing ist ein freier Textkanal direkt in den Mund des Interviewers, und niemand prüft, ob eine `suggested_question` überhaupt zur aktuellen Phase passt. Der Analyst kann das Gespräch also **verbal** beenden, während der Orchestrator es formal offen hält. Genau dieser Widerspruch erzeugt die Verabschiedungs-Schleife: der Analyst hat innerlich abgeschlossen, die Zustandsmaschine nicht.

Konsequenz für den Fix: die Notbremse ist nur die halbe Miete. Der Analyst darf eine Terminierung gar nicht erst vorschlagen dürfen. Sein legitimes Signal dafür heißt `step_advance_ready`; die Entscheidung gehört dem Orchestrator.

**(ii) Der Analyst extrahiert nichts aus der Floskel. Sein Versuch wird abgelehnt, zählt aber trotzdem.**

Der Turn-15-Call lautet `record_slot { step_id: "S001", slot: "frequency_per_month", value: 1, evidence_span: "finale Erstellung einmal pro Monat" }`. Dieser `evidence_span` stammt aus **Turn 2**, nicht aus der Floskel. Der Grund, dass der Analyst überhaupt alte Turns re-extrahieren kann: `runOnlinePass` übergibt dem Modell die **volle Historie** (`const messages = opts.history.map(...)`, [interviewAnalyst.ts:509](../../src/services/interviewAnalyst.ts#L509)) und nicht, wie das Tech Design unter C behauptet, „nur letztes Statement".

Der vorhandene Guard arbeitet dabei **korrekt**: `record_slot` prüft, ob der `evidence_span` wörtlich im aktuellen Mitarbeiter-Turn vorkommt, und lehnt sonst mit `success: false` ab ([interviewTools.ts:295–305](../../src/services/interviewTools.ts#L295)). Der Slot-Trail bestätigt die Ablehnung: `S001/frequency_per_month` steht dort **genau einmal**, mit `sourceTurn: 2`. Der Turn-15-Versuch ist nirgends im Trail. Es wurde also nichts geschrieben.

Der Fehler liegt in der Zählung: `computeNextBriefing` bildet `hadExtraction` über die **aufgerufenen** Tools, nicht über die **angewendeten** Writes:

```ts
const hadExtraction = toolCalls.some(tc => EXTRACTION_TOOL_NAMES.has(tc.toolName))
```

`capturedToolCalls` entsteht aus `genResult.steps.flatMap(step => step.toolCalls...)` und kennt die Rückgabewerte der Tools nicht. Ein vom Guard **abgelehnter** `record_slot` setzt `noNewExtractionStreak` daher genauso auf 0 wie ein erfolgreicher. Die Notbremse misst „hat das Modell es versucht", nicht „ist etwas Neues entstanden".

Wie tot die Notbremse dadurch ist, zeigt die Quote: **53 `record_slot`-Aufrufe stehen 17 tatsächlichen Writes gegenüber** (buchhalter), also rund 68 % abgelehnte Versuche. Turns ganz ohne Extraktions-**Aufruf**: buchhalter 2 von 17 (Turns 14 und 16, nie aufeinanderfolgend), it-support **0 von 18**. `noNewExtractionStreak >= 3` kann unter diesen Bedingungen praktisch nie eintreten. Die als Sicherheitsnetz gedachte Bedingung ist faktisch unerreichbar, unabhängig von PROJ-44.

Nebenbefund gleicher Wurzel: die 53:17-Quote ist auch reine Token- und Latenz-Verschwendung. Der Analyst re-extrahiert jeden Turn Werte, die er längst hat, und läuft dabei wiederholt in denselben Guard.

#### 6.7 Komplexitätsreduktion und Ballast nach der Remediation

> Nutzer-Rückfrage: wurden die Leitprinzipien der Spec („Kanten reduzieren", „Deep Modules", „Deletion-Test", „alten Ballast ersatzlos entfernen") auch **in der Remediation** eingehalten?

Der PROJ-44-Kernumbau hat sie eingehalten (netto −533 Zeilen, zwei Module gelöscht, drei Analyst-Einstiegspunkte auf einen). Das **Remediation-Bündel** hat sie an drei Stellen verletzt:

| Befund | Bewertung |
|--------|-----------|
| **`topicsOpen`/`topicsCovered`/`update_topics` als toter Ballast** | Die Remediation hat `hasUnexploredFocusTopic` entfernt, den **einzigen funktionalen Konsumenten**, und das Plumbing bewusst stehen lassen („inerte Plumbing [...] späteres Cleanup optional"). Verifiziert: kein Orchestrator-Zweig liest `ctx.topicsOpen`/`ctx.topicsCovered` mehr, **kein** Prompt rendert sie (weder `talkerPrompt.ts` noch `interviewAnalyst.ts`). Das Tool bleibt aber im Analyst-Toolset und wird real gerufen: **14 `update_topics`-Aufrufe in 17 Turns**. Es ist damit nicht „inert", sondern kostet je Turn einen Tool-Call, Prompt-Fläche und Output-Tokens für ein Ergebnis, das niemand liest. Das widerspricht dem Leitprinzip „Alten Ballast ersatzlos entfernen [...] nicht mit Kompatibilitäts-Schichten kaschiert" direkt, und angesichts der KI-18-Historie (Prompt-Dichte schadet dem lite-Modell) ist es nicht folgenlos. `OrchestratorContext.topicsOpen/topicsCovered` sind jetzt tote Pflichtfelder, die jeder Aufrufer trotzdem füllen muss. |
| **Neue Modulkante `interviewAnalyst` → `interviewOrchestrator`** | `runOnlinePass` ruft `updateODrought` und importiert dafür aus dem Orchestrator. Das dreht die Schichtung um: der Orchestrator ist die deterministische Entscheidungsebene, der Analyst die LLM-Ebene. Die Berechnung braucht nur `preTurnTracker` und den Post-Analyst-Tracker, beides liegt in `runInterviewTurn` bereits vor (dort stehen schon `computeFocusLock` und `hasNewStepThisTurn`). Die Drought-Fortschreibung gehört dorthin; dann verschwindet die Kante ersatzlos. Die Spec fordert „Kanten zwischen Modulen reduzieren"; das Bündel hat eine hinzugefügt, die vermeidbar ist. |
| **`focusStepId` auf dem geteilten `InterviewContext`** | Das Feld nutzt ausschließlich der Analyst, liegt aber auf dem Typ, den Talker und Analyst teilen. Interface-Verbreiterung auf einem gemeinsamen Typ statt eines analyst-eigenen Options-Objekts. Klein, aber gegen „Deep Modules statt breiter Interfaces". |

Zusätzlich zwei **Doku-Abweichungen vom Ist-Code**, die eigenständig irreführen:
- Tech Design C stellt „Voll-Historie" (Backfill) gegen „nur letztes Statement" (Online), als unterschiede sich der **Kontext**. Tatsächlich bekommen beide Pässe die volle Historie ([interviewAnalyst.ts:509](../../src/services/interviewAnalyst.ts#L509) vs. [:623](../../src/services/interviewAnalyst.ts#L623)); verschieden sind nur Prompt, erlaubte Tools und Evidenz-Modell. **Klarstellung nach Historien-Prüfung:** das ist **vorbestehend, kein Remediation- und kein PROJ-44-Fehler** — `git show ac06db5` (vor PROJ-44) zeigt dieselbe Zeile; PROJ-44 hat `runAnalystOnline` nur zu `runOnlinePass` umbenannt. Inhaltlich braucht der Analyst die Historie als Kontext; die Extraktions-Reichweite „nur aktueller Turn" ist über den `evidence_span`-Guard durchgesetzt, nicht über das Kontextfenster. Der Doku-Text ist irreführend, der Code konsistent. Der echte Defekt sitzt in der Zählung (6.6-ii), nicht im Kontext.
- Der Kommentar über `orchestratorCtx` in [runInterviewTurn.ts:329](../../src/services/runInterviewTurn.ts#L329) lautet „Build orchestrator context (fresh — includes this turn)". Für `phase` stimmt das nicht (H-3).

**Fazit:** der Kernumbau hat aufgeräumt, das Remediation-Bündel hat wieder Ballast angesetzt. Die drei Punkte sind klein und ohne Verhaltensrisiko zu bereinigen; `update_topics` zu streichen ist zusätzlich eine direkte Token- und Prompt-Entlastung.

#### 6.8 Was das für PROJ-44 bedeutet

Der Timing-Flip selbst (ADR-021, ein synchroner Analyst-Pass vor dem Talker) ist unverändert bestätigt und trägt: H-1 ist live behoben, die Extraktion ist frisch, `analyst_online` läuft exakt einmal pro Turn. Was der Review offenlegt, ist eine **Grenze des Schnitts**, nicht ein Fehler in seiner Umsetzung: PROJ-44 hat den Zustand frisch gemacht, aber die zwei Stellen unangetastet gelassen, an denen der Zustand den Gesprächsverlauf tatsächlich steuert, nämlich den Phasenwert selbst (H-3) und den Talker-Prompt (M-6, per Scope-Entscheidung PROJ-46). Beide Befunde landen damit an derselben Naht, die PROJ-46 ohnehin aufmacht. H-3 ist die Ausnahme: er gehört zu PROJ-44, weil er dessen eigene BUG-6-AC widerlegt, und er ist orchestrator-lokal zu beheben (`checkLifecycle` nach `decideNextPhase` ziehen oder mit der aufgelösten Phase aufrufen, statt mit `currentPhase`).

### Bug-Tally Runde 2 (nach Nutzer-Review revidiert)

**0 Critical · 2 High · 5 Medium · 2 Low → 2:5:2**

- **H-2 (High, NEU):** Farewell-Limbo, buchhalter Turns 14–17. Drei getrennte Ursachen, siehe 6.3: M-1-Floor sperrt `closing`, `noNewExtractionStreak`-Notbremse wird durch Extraktion aus Höflichkeitsfloskeln offengehalten, und H-3 kostet Turn 16.
- **H-3 (High, NEU, PROJ-44-eigen):** `ctx.phase` ist weiterhin der Vorturn-Wert ([runInterviewTurn.ts:193/331](../../src/services/runInterviewTurn.ts#L193)), und `checkLifecycle` (Zeile 351) läuft vor `decideNextPhaseWithMeta` (Zeile 439). Ein Turn, der `closing` betritt, kann konstruktionsbedingt nie im selben Turn abschließen. Das ist exakt der in „Context" beschriebene BUG-6-Mechanismus. Die AC „BUG-6 strukturell behoben" ist damit **nicht eingelöst**; der zugehörige Regressionstest prüft die Briefing-Frische, nicht die Phasen-Frische. Siehe 6.2.
- **M-2 (Medium, PROJ-42/KI-26):** Rollen-Guard-Falschpositiv. Unverändert, in dieser Runde nicht getriggert.
- **M-4 (Medium):** Clarification-Cards feuern nie (`clarification_coverage_delta` 0 in 4/4 Läufen) trotz leerer Pflicht-Slots. Mit-Blocker des Gates, im Remediation-Plan bewusst zurückgestellt, jetzt bestätigt.
- **M-5 (Medium):** `dependency_capture` 0 in 4/4 Läufen. O6 wird nie erfasst, deckelt `dedup_slot_coverage` strukturell bei 0.89.
- **M-6 (Medium, NEU, Korrektur):** Fokus-Lock ist advisory, nicht bindend. Er erreicht nur den Analyst-Prompt, nicht den Talker. Themensprünge bleiben (buchhalter Turn 7/12, it-support Turn 15/16). **M-3 ist damit gemildert, nicht behoben.** Siehe 6.1.
- **M-7 (Medium, NEU):** Abschluss ignoriert eine substanzielle Sonden-Antwort (it-support Turn 18: Medienbruch mit Frequenz „3× pro Ticket" → generischer Farewell). `newStepThisTurn` vetoet nur bei neuem **Schritt**, nicht bei neuem Inhalt auf bestehendem Schritt; der Completion-Farewell nutzt ein festes, inhaltsblindes `farewellBriefing`. Extraktion lief, Verlust ist konversationell. Siehe 6.4.
- **L-1 (Low, NEU):** Fehlende sprachliche Übergänge beim Drought-getriebenen Lock-Wechsel (buchhalter Turn 4) und bei der statischen Sonde (Turn 9). Nebenwirkung der Remediation bzw. bekanntes Statik-Audit-Item.
- **L-2 (Low):** Suggestive/anbietende Fragen (buchhalter Turn 12 „ausdrucken" ohne jede Vorerwähnung; it-support Turn 3 Forced-Choice trotz „variabel"). KI-21/KI-25-Klasse, von PROJ-44 nicht adressiert.

**Behoben und geschlossen aus Runde 1:** H-1 und M-1 (beide live in beiden Personas verifiziert). **M-3 nur teilweise** (siehe M-6).

### Production-Ready-Entscheidung: **NEIN**

Zwei High-Befunde (H-2, H-3) plus unerfülltes Pflicht-Eval-Gate (0/2). PROJ-44 bleibt **In Review**.

Priorisierungs-Empfehlung, in dieser Reihenfolge:
1. **H-3 zuerst** (klein, orchestrator-lokal, PROJ-44-eigen): `checkLifecycle` mit der aufgelösten statt der Vorturn-Phase aufrufen, also nach `decideNextPhase` ziehen oder die entschiedene Phase hineinreichen. Löst BUG-6 tatsächlich ein und nimmt H-2 einen seiner drei Turns. Der Regressionstest muss die **Phasen**-Frische prüfen, nicht die Briefing-Frische.
2. **H-2-Rest**: den Widerspruch zwischen M-1-Floor und Notbremse auflösen, indem `noNewExtractionStreak` auf O-Feld-Fortschritt umgestellt wird (dasselbe Primitiv, das die Remediation schon eingeführt hat) statt auf „irgendeine Extraktion".
3. **M-6/M-7 und die Übergänge (L-1)** hängen alle am Talker-Prompt bzw. am Briefing und gehören damit sachlich in **PROJ-46**, nicht in eine dritte PROJ-44-Runde. PROJ-44 ist mit dem Remediation-Bündel bereits von L auf faktisch XL gewachsen.
4. **Das Eval-Gate** ist mit Agenten-Tuning nicht erreichbar (M-4, M-5, plus der Nenner-Effekt aus Abschnitt 3). Das ist eine Instrument-Entscheidung, keine Kalibrierung, und sollte vor der nächsten Gate-Runde fallen. Nutzer-Entscheidung, nicht QA-Entscheidung.

## Weg nach vorn — Plan + Nutzer-Entscheidungen (2026-07-17)

> Ergebnis der QA-Nachbesprechung (Opus). Zwei Weichen wurden vom Nutzer gestellt (siehe unten). Der Timing-Flip selbst (ADR-021) bleibt bestätigt und getragen; was folgt, adressiert die Grenzen des Schnitts, die der Transkript-Review offengelegt hat.

### Entscheidung 1 — PROJ-44-Scope: **eng halten**
Nur die vier orchestrator-/turn-lokalen Fixes bleiben in PROJ-44. Die gesamte Briefing-/Talker-Überarbeitung wandert nach PROJ-46. Begründung: KI-18-Historie (Talker-Prompt-Änderungen brechen `dialog_naturalness` beim lite-Modell) plus saubere Eval-Attribuierung des Timing-Flips (kein vermischtes Delta).

### Entscheidung 2 — Eval-Gate: **erst messen, Instrument-Anpassung nach hinten**
Das Gate-Kriterium (`dedup_slot_coverage ≥ 0.75`) bleibt für die Vergleichbarkeit über die Läufe hinweg **unverändert**. Nach den vier Fixes wird erneut gemessen. Die Instrument-Frage (Nenner-Effekt bestraft vollständigere Interviews; gehören `dependency_capture`/Cards überhaupt in dieses Gate) wird **nicht** innerhalb PROJ-44 gelöst, sondern als eigenes Thema behandelt — Kandidat: neues Feature oder unter PROJ-40 (Eval-Instrument-Validierung, bereits In Review, thesis-relevant über ADR-020/metrik-audit). **Konsequenz, die vorab akzeptiert ist:** PROJ-44 erreicht `Approved` über dieses Gate wahrscheinlich **nicht** allein durch die vier Fixes (M-4/M-5 + Nenner deckeln), und das ist bewusst in Kauf genommen; die Gate-Entscheidung fällt nach dem Mess-Lauf.

### Direkt umzusetzen in PROJ-44 (nächster Schritt: `/backend` bzw. `/architecture` für den Merge)
Alle vier orchestrator-/turn-lokal, **keine** Talker-Prompt-Änderung:
1. **Merge `decideNextPhase` + `checkLifecycle`** zu einer Funktion `{phase, complete, reason}` mit einer Wahrheitsquelle. Löst **H-3**/BUG-6 (die falsch als `[x]` markierte AC), entfernt die doppelte Timer-/Abschluss-Logik und den toten `'completed'`-Zweig (6.2). Regressionstest auf **Phasen**frische.
2. **`hadExtraction` → angewendete Writes** statt Aufrufe in `computeNextBriefing` (**H-2** Schicht 3, 6.6-ii). Macht die `noNewExtractionStreak`-Notbremse wieder erreichbar.
3. **Ballast der Remediation entfernen** (6.7): `update_topics`-Tool + `topicsOpen`/`topicsCovered`-Plumbing streichen (14 Calls/17 Turns, kein Leser); `updateODrought`-Aufruf von `interviewAnalyst` nach `runInterviewTurn` ziehen (killt die neue Analyst→Orchestrator-Kante); `focusStepId` vom geteilten `InterviewContext` lösen.
4. **Minimaler Terminierungs-Guard** in der gemergten Funktion: in `explore` geht kein Abschluss/Abschied raus (**H-2** Schicht 1, minimal — die volle „Analyst darf nicht terminieren"-Lösung ist PROJ-46).

Danach: ein Mess-Eval (buchhalter + it-support, gleiche Config/Seed) — erwartet werden die vier Leerlauf-Turns weniger und eine dadurch veränderte Coverage-Zahl als Basis für die Gate-Entscheidung.

### In externe Specs gezogen
| Befund | Ziel-Feature | Kern |
|--------|-------------|------|
| M-6 (Fokus-Lock nur advisory), M-7 (inhaltsblinder Abschluss-Farewell), L-1 (Übergänge vom Talker gestrichen), Briefing-trägt-Absicht-statt-Frage, verifizierter Anker (KI-18-Wurzel), Ziel-O-Feld ins Briefing, statische Sonde → Analyst-formuliert, „Analyst darf nicht terminieren" (voll) | **PROJ-46** (Talker-Briefing-Konsolidierung, Requires PROJ-44) | Der empirische Befund: Themen-Disziplin gehört an den Analyst (hält den Lock, liefert Übergänge), Formulierung an den Talker (die einzigen gelobten Fragen waren Talker-Erfindungen). Rollen schärfen statt Talker entfernen. |
| L-2 (Forced-Choice trotz „variabel", suggestive „ausdrucken"-Frage), M-3-Rest (Elicitation-Sprünge über die Fokus-Wahl hinaus) | **PROJ-43** (Elicitation-Reorientierung) | KI-21/KI-25, Zahlen→Cards, Treiber/WHY statt Metrik-Nagging |
| **Completion-Gate: fast jedes Interview muss vor dem Abschluss durch eine Card-Runde** (Nutzer-Vorgabe 2026-07-17) | **PROJ-43** (Elicitation-Reorientierung) | Folge der Zahlen→Cards-Verlagerung: quantitative Pflicht-Slots (frequency/duration/error_rate/media_breaks) werden per Design in Cards erfasst, bleiben im Gespräch fast immer leer → für leere Pflicht-Slots MÜSSEN Cards erzeugt werden, und ein Interview darf ohne durchlaufene Card-Runde nicht als `completed` gelten. PROJ-44 respektiert nur bereits erzeugte Cards (Trigger A); die Erzeugungs-/Gate-Garantie gehört hierher. |
| M-2 (Rollen-Guard-Falschpositiv) | **PROJ-42** / KI-26 | Prefilter/Judge-Präzision, unverändert durch PROJ-44 |
| Instrument-Frage des Eval-Gates (Nenner-Effekt, dependency_capture/Cards-Zugehörigkeit) | **PROJ-40** oder neues Feature | Messvalidität, thesis-relevant; NICHT in PROJ-44 |

### Talker behalten — begründet
Der Talker produziert die einzigen im Nutzer-Review positiv markierten Fragen (buchhalter Turn 5/8), und zwar **gegen** den generischen Zahlen-Vorschlag des Analysten. Entfernen würde diese Stärke wegwerfen und die dokumentierte Prompt-Dichte-Falle (KI-18) beim Merge in den Analyst-Prompt aufmachen. Der richtige Schnitt ist Rollen-Schärfung (PROJ-46), nicht Konsolidierung auf einen Agenten.

## Tech Design — Remediation-Runde 2 (Merge + 3 Fixes)

> Ergebnis aus `/architecture` (2026-07-17, Opus). Vertrag in **ADR-022** (`resolveTurnLifecycle`, supersediert die BUG-6-Aussage von ADR-021). Status bleibt **In Review** — dies ist ein Design-Nachtrag innerhalb des laufenden Remediation-Zyklus, kein Lifecycle-Rücksprung. Zwei Nutzer-Weichen (2026-07-17, AskUserQuestion): Notbremse resettet auf **irgendeine angewendete Write**; **neuer ADR-022** für die Vertragsänderung. Scope-Grundsatz unverändert eng (kein Talker-Prompt, ADR-021-Timing bleibt getragen).

### Fix 1 — `decideNextPhase` + `checkLifecycle` → eine Funktion `resolveTurnLifecycle`

**Warum mergen, nicht umsortieren (H-3 ist eine Doppelung).** Beide Funktionen implementieren dieselbe Entscheidung zweimal: den Hard-Stop-Timer ([interviewOrchestrator.ts:225](../../src/services/interviewOrchestrator.ts#L225) und [:345](../../src/services/interviewOrchestrator.ts#L345)) und die Closing-Konvergenz (Sonde beantwortet + kein `exploring`/neuer Schritt + keine Cards, [:280-288](../../src/services/interviewOrchestrator.ts#L280) und [:351-364](../../src/services/interviewOrchestrator.ts#L351)). `decideNextPhase` berechnete in buchhalter Turn 16 bereits `'completed'`, [runInterviewTurn.ts:440](../../src/services/runInterviewTurn.ts#L440) verwirft es (`=== 'completed' ? 'closing'`), und `checkLifecycle` leitet dieselbe Schlussfolgerung einen Turn später erneut her. Bloßes Umsortieren würde die Doppelung konservieren.

**In einfachen Worten:** heute entscheiden zwei getrennte Prüfer pro Turn — einer wählt den nächsten Raum (Phase), der andere prüft, ob man das Gebäude verlassen darf (Abschluss). Der zweite schaut aber auf das Schild des Raums, in dem man **vorher** war (`ctx.phase` = Vorturn-Wert), nicht auf den, in den der erste gerade geschickt hat. Wird man endlich in die Ausgangshalle (`closing`) geschickt, sieht der zweite noch den alten Raum und sagt „noch nicht" — eine sinnlose Extrarunde (Turn 16, in der der Interviewer die dritte Verabschiedung improvisiert). Der Merge macht beides in **einem** Prüfer, der den gerade gewählten Raum sofort für die Abschlussfrage nutzt.

**Neue Naht — ein Aufruf, eine Wahrheitsquelle:**

```
resolveTurnLifecycle(ctx, briefing) → { phase: Phase, complete: boolean, reason: 'hard_stop'|'soft_confirm'|null }

  Trigger A — Hard-Stop (unconditional):
     timer ≥ max, Cards vorhanden → { 'clarification', complete:false, null }   # Cards NIE überspringen
     timer ≥ max, sonst           → { 'closing', complete:true,  'hard_stop' }

  Phasen-Transition (ehem. decideNextPhase, OHNE 'completed'-Rückgabe):
     intro                  → historyLength≥2 ? 'explore' : 'intro'
     explore                → (Soft-Anchor / Streak / advance-ready && !hasUnexhaustedStep) ? 'closing' : 'explore'
     closing (Reentry)      → hasStepInStatus('exploring') || newStepThisTurn → 'explore', sonst 'closing'
     clarification          → 'clarification'

  Terminale Auswertung — GENAU EINMAL, gegen die AUFGELÖSTE Phase 'closing':
     wenn Ziel == 'closing':
        closingProbeAnswerReceived + keine Cards  → { 'closing', complete:true,  'soft_confirm' }
        closingProbeAnswerReceived + Cards        → { 'clarification', complete:false, null }
        sonst (frischer Eintritt, Sonde offen)    → { 'closing', complete:false, null }   # Sonde downstream injiziert
     sonst:
        → { Ziel, complete:false, null }
```

Kern des H-3-Fixes: die terminale Auswertung läuft gegen die **aufgelöste** Phase, nicht gegen `ctx.phase`. Der Late-Discovery-Reentry:

| Fall | `ctx.phase` | Transition | terminale Auswertung | Ergebnis |
|------|-------------|-----------|----------------------|----------|
| Frischer Closing-Eintritt | explore | → closing | Sonde nie gestellt | `closing`, complete:false → **Sonde injiziert** (wie heute) |
| Sonde beantwortet | closing | bleibt closing | beantwortet, keine Cards | `closing`, **complete:true** (wie heute via Trigger B) |
| **Reentry, Sonde schon beantwortet (buchhalter T16)** | explore | → closing | Sonde aus T9 beantwortet, kein neuer Schritt | `closing`, **complete:true — schließt in T16 statt T17 ab** |

### Fix 4 — Terminierungs-Invariante (minimal, in `resolveTurnLifecycle`)

`complete:true` mit `reason:'soft_confirm'` ist strukturell nur erreichbar, wenn die aufgelöste Phase `closing` ist. `intro`/`explore`/`clarification` können nie weich abschließen — nur `hard_stop` (Trigger A) beendet phasen-agnostisch. Zustands-Geländer gegen einen künftigen Abschluss aus der Exploration. **Grenze:** stoppt **nicht** den vom Analyst in `suggested_question` geschriebenen Farewell-Text während `explore` (H-2 Schicht 1 voll → PROJ-46). Fix 4 ist die minimale Invariante, nicht die volle Lösung.

### Hard-Stop überspringt anstehende Cards nicht (Nutzer-Korrektur 2026-07-17)

Trigger A schließt heute unbedingt ab und verwirft dabei bereits erzeugte `clarification_cards`. Das ist ungewollt: die Cards fassen die quantitativen Pflicht-Slots (ROI-Signal). Fix in `resolveTurnLifecycle`: liegen Cards im Briefing, routet auch der Hard-Stop nach `clarification` (complete:false) statt abzuschließen. Der Talker macht über die bestehende `clarification`-Methodik ([talkerPrompt.ts:226](../../src/services/talkerPrompt.ts#L226), BUG-5) die Verabschiedung + Card-Ankündigung, die Clarification-Route schließt nach dem Ausfüllen ab (Timer blockt dort nicht). **Grenze (PROJ-44):** Trigger A erzwingt keine Card-*Erzeugung*, wenn noch keine existiert (Hard-Stop direkt aus `explore`). Die Regel „nach PROJ-43 muss fast jedes Interview vor dem Abschluss durch eine Card-Runde" ist ein Completion-Gate für **PROJ-43** (siehe Tabelle unten).

### Ballast aus `decideNextPhase`/`checkLifecycle` verschwindet vollständig (ADR-022 D3)

Keine Kompatibilitäts-Wrapper.

| Weg (gelöscht) | Bleibt (Bausteine, die `resolveTurnLifecycle` aufruft) |
|---|---|
| `decideNextPhase`, `decideNextPhaseWithMeta`, `checkLifecycle` (3 Exports) | `hasStepInStatus`, `closingProbeAnswerReceived`, `closingProbeAlreadyAsked`, `shouldInjectClosingProbe` |
| Typen `ExtendedPhase`, `PhaseDecisionMeta`, `LifecycleDecision` | `hasUnexhaustedStep`, `computeFocusLock`, `updateODrought`, `hasNewStepThisTurn` + Konstanten |
| `PhaseDecisionMeta.phaseJustEntered` (verifiziert tot — einziger Nicht-Test-Konsument destrukturiert nur `phase`; Catchup-Trigger seit ADR-021 obsolet) | — |
| in `runInterviewTurn`: `=== 'completed' ? 'closing'`-Mapping + Zwei-Aufruf-Sequenz | ersetzt durch **einen** `resolveTurnLifecycle`-Aufruf |
| `topicsOpen`/`topicsCovered` auf `OrchestratorContext` (Fix 3) | — |

Doc-Kommentare mit dem alten Namen ([talkerPrompt.ts:233/300](../../src/services/talkerPrompt.ts#L233), [interviewTypes.ts:39](../../src/services/interviewTypes.ts#L39)) auf `resolveTurnLifecycle` umschreiben.

### Fix 2 — `hadExtraction` auf angewendete Writes (Nutzer-Weiche: irgendeine Write)

[`computeNextBriefing`](../../src/services/interviewAnalyst.ts#L74) zählt heute `toolCalls.some(EXTRACTION_TOOL_NAMES)` — **Versuche**. Der `evidence_span`-Guard ([interviewTools.ts:295](../../src/services/interviewTools.ts#L295)) lehnt 68 % ab (53 `record_slot`-Aufrufe vs. 17 Writes), jeder abgelehnte Versuch resettet `noNewExtractionStreak` → Notbremse unerreichbar.

`AnalystToolCallRecord` trägt heute nur `{ toolName, args }`. Die Tools geben `{ success }` zurück, und `genResult.steps[].toolResults` tragen diesen Wert. **Design:** `AnalystToolCallRecord` um `applied: boolean` erweitern (an der [Capture-Stelle](../../src/services/interviewAnalyst.ts#L565) aus dem Tool-Result gelesen), dann `hadExtraction = toolCalls.some(tc => tc.applied && EXTRACTION_TOOL_NAMES.has(tc.toolName))`. Streak resettet bei **irgendeiner** akzeptierten Knowledge-Write (Slot/Governance/Dependency/neuer Schritt) — treu zum Zweck der Bremse (unproduktives Gespräch erkennen), nicht an den gelockten Schritt gekoppelt. `computeNextBriefing` bleibt reine Funktion.

### Fix 3 — Remediation-Ballast entfernen (Abschnitt 6.7)

| Ballast | Aktion |
|---------|--------|
| `update_topics`-Tool (14 Calls/17 Turns, kein Leser) | Tool aus [buildTools](../../src/services/interviewTools.ts#L72) + Prompt-Instruktion in `interviewAnalyst.ts` streichen; `update_topics`-Intent + `applyUpdateTopics` + Store-`updateTopics` werden producerlos → mit entfernen. **Keine DB-Migration:** `topics_open`/`topics_covered`-Spalten bleiben (bei Erstellung `[]`, nie gelesen). |
| `topicsOpen`/`topicsCovered` auf `OrchestratorContext` | Tote Pflichtfelder — aus dem Typ + allen Aufrufern entfernen (mit Fix 1). |
| `interviewAnalyst` → `interviewOrchestrator`-Kante | [`updateODrought`-Aufruf](../../src/services/interviewAnalyst.ts#L590) aus `runOnlinePass` nach `runInterviewTurn` ziehen (dort liegen `preTurnTracker` + Post-Analyst-Tracker schon vor). Kante verschwindet ersatzlos. |
| `focusStepId` auf geteiltem `InterviewContext` | Vom [gemeinsamen Typ](../../src/services/interviewTypes.ts#L51) in ein analyst-eigenes Options-Objekt verschieben (nur der Analyst liest es). |

### Neue Turn-Reihenfolge in `runInterviewTurn`

Statt `checkLifecycle` ([:351](../../src/services/runInterviewTurn.ts#L351)) → Veto → `if shouldComplete` ([:391](../../src/services/runInterviewTurn.ts#L391)) → `decideNextPhaseWithMeta` ([:439](../../src/services/runInterviewTurn.ts#L439)) → Mapping: **ein** Aufruf `resolveTurnLifecycle(ctx, briefing)` → Fail-Safe-Veto auf `complete && reason==='soft_confirm'` bei Analyst-Fehler (unverändert, ADR-021 D4) → `if complete` Farewell-Pfad, sonst `updatePhase(phase)` + `shouldInjectClosingProbe`. `updateODrought` wird in diesen Block gezogen (Fix 3).

### Tests

- **BUG-6-Regression umgeschrieben:** prüft die **Phasen**frische statt der Briefing-Frische — ein Turn, der `closing` betritt und dessen Sonde bereits beantwortet ist, liefert im selben Turn `complete:true`. (Der Runde-1-Test prüfte nur die Briefing-Frische und deckte H-3 nicht ab.)
- Fix 4: kein `soft_confirm` aus `explore`/`intro`/`clarification` (Invariante).
- Fix 2: ein vom Guard abgelehnter `record_slot` resettet `noNewExtractionStreak` nicht mehr; ein akzeptierter schon.
- Fix 3: `update_topics`-Tool + `topicsOpen`/`topicsCovered`-Plumbing entfernt, Suite grün ohne Ersatz.
- `tsc --noEmit` + volle Unit-Suite grün.

### Danach

Ein Mess-Eval (buchhalter + it-support, gleiche Config/Seed) — erwartet: die vier Leerlauf-Turns weniger und eine dadurch veränderte Coverage-Zahl als Basis für die Gate-Entscheidung (Nutzer-Entscheidung 2, nicht in PROJ-44).

## Backend Implementation Notes — Runde 2 (Merge + 3 Fixes, 2026-07-17)

Gebaut wie im Tech-Design-Nachtrag oben entschieden — keine Abweichung von ADR-022. ADR-022 auf **Accepted** gesetzt (war Proposed).

**Fix 1 + Fix 4 (Merge + Terminierungs-Invariante) — [interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts):**
`decideNextPhase`, `decideNextPhaseWithMeta`, `checkLifecycle` (3 Exports) + Typen `ExtendedPhase`/`PhaseDecisionMeta`/`LifecycleDecision` gelöscht, ersetzt durch **einen** Export `resolveTurnLifecycle(ctx, briefing) → {phase, complete, reason}` (neuer Typ `TurnLifecycle`). Intern in zwei Teile zerlegt: `resolvePhaseTransition` (private, ehem. `decideNextPhase`-Switch ohne den toten `'completed'`-Rückgabewert) + die terminale Auswertung in `resolveTurnLifecycle` selbst, die **gegen die aufgelöste Phase** läuft (nicht mehr `ctx.phase`) — das ist der H-3-Fix. Trigger A (Hard-Stop) ist jetzt Cards-aware: liegen bereits `clarification_cards` vor, routet auch der Hard-Stop nach `clarification` statt bedingungslos abzuschließen (Nutzer-Korrektur, vorher nur dokumentiert, jetzt im Code). D2-Invariante (`complete:true`+`soft_confirm` nur aus aufgelöstem `closing`) folgt strukturell aus der Kontrollfluss-Form, keine explizite Zusatzprüfung nötig.
**[runInterviewTurn.ts](../../src/services/runInterviewTurn.ts):** die Zwei-Aufruf-Sequenz (`checkLifecycle` vor `decideNextPhaseWithMeta`, plus das `=== 'completed' ? 'closing'`-Mapping) ist durch **einen** `resolveTurnLifecycle`-Aufruf ersetzt; `orchestratedPhase = lifecycle.phase` direkt (kein zweiter Orchestrator-Call mehr). `topicsOpen`/`topicsCovered` sind aus der `OrchestratorContext`-Konstruktion entfernt (Fix 3, siehe unten) — `contextBase.topicsOpen/topicsCovered` (für Analyst/Talker-`InterviewContext`) bleiben unverändert bestehen.

**Fix 2 (hadExtraction auf angewendete Writes) — [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts):**
`AnalystToolCallRecord` um `applied: boolean` erweitert. Neue Helper-Funktion `buildToolCallRecords(steps)` liest `applied` aus `genResult.steps[].toolResults[].output.success`, gematcht per `toolCallId` gegen `steps[].toolCalls` — einheitlich über alle Tools hinweg, da jedes Tool in `interviewTools.ts` `{success: boolean, ...}` zurückgibt. Ersetzt die bisherige Inline-`flatMap`-Konstruktion in **beiden** Sub-Pässen (`runOnlinePass` + `runBackfillPass`). `computeNextBriefing`s `hadExtraction`-Check ist jetzt `toolCalls.some(tc => tc.applied && EXTRACTION_TOOL_NAMES.has(tc.toolName))` — ein vom `evidence_span`-Guard abgelehnter oder idempotent übersprungener `record_slot`-Call zählt nicht mehr als Extraktion.

**Fix 3 (Remediation-Ballast) — drei Teile:**
1. **`update_topics`-Tool ersatzlos entfernt:** Tool aus [interviewTools.ts](../../src/services/interviewTools.ts) gestrichen, Prompt-Instruktionen in `interviewAnalyst.ts` entfernt (STUFE-1-Zeile + eigener Absatz). `UpdateTopicsIntent` + `applyUpdateTopics` + der `'topics'`-`FieldPatch`-Zweig sind aus [intents.ts](../../src/services/turnStore/intents.ts)/[applyIntent.ts](../../src/services/turnStore/applyIntent.ts) entfernt; `setTopics` ist aus dem `TurnStoreBackend`-Interface ([port.ts](../../src/services/turnStore/port.ts)) und allen drei Implementierungen (`supabaseTurnStore.ts`, `pgliteTurnStore.ts`, `memoryTurnStore.ts`) entfernt. **Keine DB-Migration:** `topics_covered`/`topics_open`-Spalten bleiben (werden weiterhin geladen, aber nie mehr geschrieben).
2. **`interviewAnalyst` → `interviewOrchestrator`-Kante entfernt:** `updateODrought` wird nicht mehr in `interviewAnalyst.ts` importiert. Stattdessen injiziert `runInterviewTurn.ts` (das die Funktion ohnehin schon für `computeFocusLock`/`hasNewStepThisTurn` importiert) sie als `updateODrought`-Option durch `AnalystRunOptions` → `OnlinePassOptions` → den unveränderten Call-Ort in `runOnlinePass` (`opts.updateODrought(...)` statt des direkten Imports). Identischer Aufruf-Zeitpunkt (vor dem `produce_briefing`-Stage, also vor dem Commit) — reines Dependency-Inversion, kein Verhaltensunterschied.
3. **`focusStepId` von `InterviewContext` gelöst:** Feld aus [interviewTypes.ts](../../src/services/interviewTypes.ts) entfernt. `buildAnalystSystemPrompt` bekommt es jetzt als eigenen dritten Parameter (`focusStepId?: string | null`), aufgerufen mit `opts.focusLock.stepId` direkt aus `runOnlinePass` — kein Umweg mehr über den geteilten Kontext-Typ.

**Tests:** `interviewOrchestrator.test.ts` komplett auf `resolveTurnLifecycle` umgestellt (gleiche Szenarien wie zuvor unter `decideNextPhase`/`checkLifecycle`, jetzt gegen `{phase, complete, reason}`); neuer H-3/BUG-6-Regressionstest (Late-Discovery-Reentry mit `ctx.phase='explore'`, löst zu `closing` auf, Sonde aus früherer Closing-Episode bereits beantwortet → `complete:true` **im selben Aufruf**, statt einen Leerlauf-Turn später); neuer Test für die Cards-aware Hard-Stop-Route (Trigger A). `interviewOrchestrator.tim-regression.test.ts` auf die neue API umgeschrieben (gleiche historischen Turns/Assertions). `runInterviewTurn.test.ts`: Mock von zwei unabhängigen Funktionen auf einen `resolveTurnLifecycle`-Mock reduziert; BUG-1/BUG-6-Regressionstests bleiben (BUG-6 jetzt explizit als Briefing-Frische gekennzeichnet — die Phasen-Frische ist der neue orchestrator-lokale Test). `interviewAnalyst.test.ts`: `computeNextBriefing`-Fixtures um `applied` erweitert + neuer Test (abgelehnter `record_slot` resettet die Streak nicht). `applyIntent.test.ts`: `update_topics`-Testblock entfernt. `tsc --noEmit` + volle Suite grün (902 passed, 1 vorbestehender Skip).

**Nicht in diesem Backend-Pass:** der in der Tech-Design-Sektion angekündigte Mess-Eval-Lauf (buchhalter + it-support) — gehört in `/qa`, zusammen mit der Neubewertung von H-2/H-3 gegen das echte Transkript und der Aktualisierung von Bugs/AC-Status in dieser Spec.

## QA Test Results — Runde 3 (Merge-Verifikation + Mess-Eval, 2026-07-17/18)

> `/qa PROJ-44`, dritter Durchlauf — Verifikation des `resolveTurnLifecycle`-Merge-Bündels (Fix 1–4) gegen Code, Unit-Suite und einen frischen Mess-Eval. Status bleibt **In Review**.

### Zusammenfassung

| Achse | Ergebnis |
|-------|----------|
| `tsc --noEmit` | ✅ pass |
| Unit-Suite | ✅ 902 passed / 1 skipped (67 Dateien) — deckungsgleich mit Backend-Notes |
| Code-Level-AC (Fix 1–4) | ✅ `resolveTurnLifecycle` 1:1 wie ADR-022 spezifiziert; Fix 2 (`applied`-Tracking), Fix 3 (Ballast-Entfernung) verifiziert |
| H-3 / BUG-6 | ✅ **behoben** — code-verifiziert UND über 3 Live-Läufe bestätigt (kein Repro des Ein-Turn-Phasenlag-Musters) |
| H-1 (Late-Discovery-Reentry) | ✅ weiterhin korrekt (2 von 3 Läufen mit echtem Late-Discovery-Fall, beide korrekt reentered) |
| H-2 (Farewell-Limbo) | ❌ **weiterhin offen, intermittierend** — 0/3 bis 6/3 betroffene Turns je Lauf; Worst-Case (6 Turns inkl. 1 wortgleichem Duplikat) schwerer als Runde 2 (max. 4) |
| Eval-Gate (Pflicht) | ❌ **0/2 PASS**, jetzt über 3 Läufe: buchhalter 0.56 / 0.67, it-support 0.56 (Gate ≥0.75) |
| Regressions-sensible Metriken | ✅ hallucination 0, grounding 0, anchoring 0, schema 1.0, step_registration 1.0, blocked 0 — alle 3 Läufe |
| Methodik-Vorfall | ⚠️ Anthropic-API-Guthaben lief während Lauf 1 aus (buchhalter) — `dialog_naturalness` fiel still auf 0.5 zurück; nach Guthaben-Aufstockung sauber wiederholt |
| Bugs (H:M:L) | **1:5:2** (H-3 behoben und geschlossen; H-2 bleibt einziger High) |
| Production-ready | **NEIN** (H-2 + unerfülltes Eval-Gate) |

Konfiguration identisch zu Runde 1+2 (alle Komponenten `google/gemini-3.1-flash-lite`, Judges `anthropic/claude-haiku-4-5`, `--store supabase --seed 42`), für saubere Vergleichbarkeit über die Runden.

### 1. Code-Level-Verifikation des Remediation-Bündels (Fix 1–4)

Direkt am Code geprüft (nicht nur an den Backend-Notes), da dies eine Merge-Verifikation ist:

- **[interviewOrchestrator.ts](../../src/services/interviewOrchestrator.ts):** `decideNextPhase`/`decideNextPhaseWithMeta`/`checkLifecycle` sind vollständig durch **einen** Export `resolveTurnLifecycle(ctx, briefing) → {phase, complete, reason}` ersetzt (kein Kompat-Wrapper, kein toter `'completed'`-Zweig mehr). Intern in `resolvePhaseTransition` (private) + eine terminale Auswertung zerlegt, die **gegen die aufgelöste Phase** läuft — das ist exakt der H-3-Fix. Trigger A (Hard-Stop) ist Cards-aware (liegen `clarification_cards` vor, routet auch der Hard-Stop nach `clarification` statt bedingungslos abzuschließen — Nutzer-Korrektur aus Runde 2, im Code verifiziert). D2-Invariante (`complete:true`+`soft_confirm` nur aus aufgelöstem `closing`) folgt strukturell aus der Kontrollflussform.
- **[runInterviewTurn.ts](../../src/services/runInterviewTurn.ts):** genau **ein** `resolveTurnLifecycle`-Aufruf (Zeile 351) ersetzt die alte Zwei-Aufruf-Sequenz; `orchestratedPhase = lifecycle.phase` direkt, kein zweiter Orchestrator-Call. Fail-Safe-Veto (ADR-021 D4: `soft_confirm` bei terminalem Analyst-Fehler vetoen, `hard_stop` bleibt unconditional) unverändert korrekt verdrahtet.
- **Fix 2** ([interviewAnalyst.ts](../../src/services/interviewAnalyst.ts)): `AnalystToolCallRecord.applied` wird über die neue `buildToolCallRecords()`-Helper-Funktion aus `genResult.steps[].toolResults[].output.success` gelesen (per `toolCallId` gematcht), einheitlich für beide Sub-Pässe. `computeNextBriefing`s `hadExtraction`-Check verlangt jetzt `tc.applied`, nicht nur den Aufrufversuch — ein vom `evidence_span`-Guard abgelehnter `record_slot` resettet die Notbremse nicht mehr.
- **Fix 3** (Ballast-Entfernung): `update_topics`-Tool + `UpdateTopicsIntent`/`applyUpdateTopics`/`setTopics` sind aus allen drei Backends (`supabaseTurnStore.ts`, `pgliteTurnStore.ts`, `memoryTurnStore.ts`) + `port.ts` + `intents.ts`/`applyIntent.ts` entfernt (verifiziert per `git diff` — reine Streichungen, keine Restspuren). Die `interviewAnalyst`→`interviewOrchestrator`-Kante ist aufgelöst: `updateODrought` wird jetzt per Dependency-Injection (`AnalystRunOptions.updateODrought`) von `runInterviewTurn.ts` hereingereicht statt direkt importiert. `focusStepId` ist vom geteilten `InterviewContext` gelöst und wird `buildAnalystSystemPrompt` als eigener dritter Parameter übergeben.

Keine Abweichung von ADR-022 gefunden.

### 2. H-3/BUG-6: live bestätigt behoben

Über alle 3 Mess-Eval-Läufe hinweg trat das spezifische Runde-2-Muster (ein Turn, der `closing` betritt und dessen Sonde bereits beantwortet ist, schließt erst einen Leerlauf-Turn später ab, weil `checkLifecycle` gegen den Vorturn-Phasenwert prüfte) **kein einziges Mal** auf. Die in dieser Runde weiterhin beobachteten Mehrfach-Verabschiedungen (siehe H-2 unten) haben einen nachweislich anderen Mechanismus — sie treten auf, während der State laut Orchestrator noch in `explore` ist (der Analyst schlägt über `suggested_question` einen Abschluss vor, den `resolveTurnLifecycle` aus `explore` heraus korrekt nicht als `complete:true` durchlässt, D2-Invariante Fix 4). H-3 gilt damit als **vollständig geschlossen**.

### 3. H-1: weiterhin korrekt

Zwei der drei Läufe enthielten einen echten Late-Discovery-Fall in der Antwort auf die Closing-Sonde:

| Lauf | Late-Discovery | Ergebnis |
|------|-----------------|----------|
| buchhalter Lauf 1 (33 Turns) | Turn 23: „Stammdatenpflege" (neu, nach Sonde in Turn 22) | Korrekt reentered nach `explore`, über Turns 24–26 vertieft, als `walkthrough`-Step registriert |
| it-support (13 Turns) | Turn 9: „Software-Genehmigungen" (neu, nach Sonde in Turn 8) | Korrekt reentered nach `explore`, über Turn 9–10 vertieft |
| buchhalter Lauf 2 (14 Turns) | keiner (Sonden-Antwort vertiefte nur bestehende Prozesse) | n/a — kein Reentry nötig, korrekt direkt Richtung Abschluss |

H-1 bleibt bestätigt.

### 4. H-2 (Farewell-Limbo): weiterhin offen, intermittierend, Worst-Case schwerer

Dies ist der zentrale neue Befund dieser Runde. Anders als H-1/H-3 (die deterministisch reproduzieren) ist H-2 **modell-stochastisch** — es trat in unterschiedlicher Ausprägung auf, einmal gar nicht:

| Lauf | Verhalten |
|------|-----------|
| **buchhalter Lauf 1 (33 Turns)** | **Schwerster bisher beobachteter Fall.** Turns 28–33: **sechs** aufeinanderfolgende Verabschiedungs-Turns, davon Turn 30/31 **wortgleich identisch** ("Vielen Dank für deine Zeit und die detaillierten Einblicke. Damit ist unsere Bestandsaufnahme abgeschlossen. Ich wünsche dir einen erfolgreichen Arbeitstag."). `lifecycle complete: soft_confirm` feuert erst bei Turn 33. |
| **it-support (13 Turns)** | Milderer Fall. Turns 11–13: drei Verabschiedungs-Turns (kein wortgleiches Duplikat). Completion bei Turn 13. |
| **buchhalter Lauf 2 (14 Turns)** | **Kein Auftreten.** Sonde in Turn 13, Antwort vertieft nur Bestehendes (kein neuer Prozess), Turn 14 schließt direkt/glatt ab (Übergang Richtung Clarification, kein Leerlauf). |

**Root Cause unverändert gegenüber Runde 2 (Abschnitt 6.6-i):** der Analyst schreibt einen fertigen Abschieds-Text in `suggested_question`, obwohl der Orchestrator-State noch `explore` (oder ein frisch aufgelöstes, noch nicht abgeschlossenes `closing`) ist. Fix 4 (Terminierungs-Invariante) verhindert nur, dass `resolveTurnLifecycle` daraus `complete:true` ableitet, solange die aufgelöste Phase nicht `closing` mit beantworteter Sonde ist — er verhindert **nicht**, dass der Talker den vorgeschlagenen Abschieds-Text trotzdem ausspricht (das ist explizit die für PROJ-46 vorgesehene „volle" Lösung, siehe Fix 4s Dokumentation: „stoppt NICHT den vom Analyst geschriebenen Farewell-Text während explore"). Da beide Seiten (Analyst-Vorschlag und Persona-Antwort) high-natural-language sind, kann sich daraus ein Mehrturn-Loop aus gegenseitigen Höflichkeitsfloskeln ergeben, dessen Länge vom Modellsampling abhängt — daher die Streuung von 0 bis 6 Turns.

**Einordnung:** kein Rückschritt durch das Runde-2-Bündel (Fix 1–4 haben H-2 nie vollständig adressiert, das war von Anfang an so geplant — siehe „Weg nach vorn"-Plan, Priorität 2/3). Aber der in dieser Runde beobachtete Worst-Case (6 Turns, 1 wortgleiches Duplikat) ist **schwerer** als der in Runde 2 gemessene Worst-Case (4 Turns, kein Duplikat) — ein reines Sampling-Artefakt oder ein echter (kleiner) Trend lässt sich mit `n=3` nicht unterscheiden. Da die Ursache unverändert und bereits vollständig diagnostiziert ist (Split-Brain zwischen Analyst-Freitext und State-Machine), ändert das nichts an der bereits getroffenen Scope-Entscheidung: volle Lösung („Analyst darf nicht terminieren") bleibt PROJ-46.

### 5. Eval-Gate: weiterhin rot, jetzt mit 3 Datenpunkten

| Lauf | dedup_slot_coverage | Turns | Steps |
|------|---------------------|-------|-------|
| buchhalter Lauf 1 (Anthropic-Ausfall während Judge-Call) | 0.67 | 33 | 5 |
| buchhalter Lauf 2 (sauber) | 0.56 | 14 | 3 |
| it-support | 0.56 | 13 | 3 |

Gate ≥0.75 in keinem der 3 Läufe erreicht (0/3 Einzelläufe, 0/2 Personas). Die in Runde 2 identifizierten strukturellen Deckel bestätigen sich erneut: `clarification_coverage_delta` bleibt 0 in allen 3 Läufen (M-4, Cards feuern nie), `dependency_capture` bleibt nahe 0 (0.2 / 0 / 0, M-5). Die hohe Lauf-zu-Lauf-Varianz bei gleichem Seed (buchhalter 0.56 vs. 0.67, 14 vs. 33 Turns) bestätigt die bereits in Runde 2 dokumentierte Modell-Stochastizität — konsistent mit der bereits getroffenen Nutzer-Entscheidung, das Gate-Kriterium unverändert zu lassen und die Instrument-Frage separat zu behandeln (PROJ-40/neues Feature).

### 6. Methodik-Vorfall: Anthropic-Guthaben lief während des ersten Laufs aus

Während des ersten buchhalter-Laufs ging dem Anthropic-Account während des Post-Run-`dialog_naturalness`-Judge-Calls das Guthaben aus ("Your credit balance is too low"). Der Scorer fing den Fehler ab und gab still `0.5` zurück (`[scorer:dialog_naturalness] judge call failed, returning 0.5` im Log) — **genau der in general.md dokumentierte Anti-Pattern-Fall** ("Kein stiller Fallback-Score bei ungültigem Key — Lauf muss hart fehlschlagen"). Der reguläre Preflight-Check dieser QA-Runde (ein GET auf `/v1/models`) hatte zuvor 200 zurückgegeben, da dieser Endpunkt keine Kreditprüfung auslöst — ein `generateText`-artiger Call mit tatsächlichem Guthabenverbrauch wäre der schärfere Preflight-Test gewesen. Die Interview-Turns selbst liefen zu diesem Zeitpunkt bereits vollständig durch (der `grounding_guard` wurde 33× erfolgreich abgerechnet, `talker_grounding_violations: 0` für diesen Lauf ist also verlässlich) — betroffen war ausschließlich der nachgelagerte Scorer-Call. Nutzer hat das Guthaben während der Session aufgestockt; buchhalter wurde sauber wiederholt (Lauf 2, `dialog_naturalness: 1`). **Nicht Teil der PROJ-44-Bug-Zählung** (Scorer-Infrastruktur, nicht der Analyst/Orchestrator-Code dieses Features) — als eigenständiger Befund dokumentiert, da während dieser QA real beobachtet: `scoreDialogNaturalness` (und vermutlich Geschwister-Scorer) sollten einen Judge-Call-Fehler sichtbar eskalieren (analog zum bereits gehärteten `talkerGroundingGuard.ts`-Muster: `console.error` + klar als invalide markieren) statt einen plausibel aussehenden Fallback-Wert zu liefern.

### 7. Weitere Beobachtung (nicht als eigener Bug gezählt)

it-support Turn 11: die Persona nennt zwei neue, bislang unbesprochene Aufgaben („Hardware-Einweisung der Nutzer", „Datenmigration bei Gerätetausch") direkt gefolgt von „Alles abgedeckt" — keine der beiden wird als eigener Tracker-Step registriert (finale Slot-Tabelle zeigt nur 3 Steps). Da beide ohne quantitative Angaben genannt werden (anders als der M-7-Referenzfall aus Runde 2, der eine konkrete Frequenzangabe enthielt), ist unklar, ob dies M-7 (Completion ignoriert substanzielle Antwort) oder eine eigenständige Step-Registrierungslücke ist. Einzelbeobachtung (n=1) — nicht als neuer nummerierter Bug gezählt, aber für eine künftige Runde festgehalten.

### 8. Security und Regression

- Keine neue Route, keine Änderung an den drei token-authentifizierten Routen in diesem Bündel. `git diff` auf die `turnStore/*`-Dateien zeigt ausschließlich Streichungen (Fix 3) — keine neuen Schreibpfade, kein geändertes Ownership-Modell.
- Keine harte Regression: hallucination_rate 0, `talker_grounding_violations` 0, anchoring 0, `schema_conformance_rate` 1.0, `step_registration_coverage` 1.0, `blocked_rate` 0 — durchgehend über alle 3 Läufe.
- M-2 (Rollen-Guard-Falschpositiv) in dieser Runde in keinem der 3 Läufe getriggert. Unverändert ungelöst (PROJ-42/KI-26), nur dormant.

### Bug-Tally Runde 3

**0 Critical · 1 High · 5 Medium · 2 Low → 1:5:2**

**Geschlossen in dieser Runde:**
- **H-3 (vormals High):** ✅ behoben — `resolveTurnLifecycle`-Merge, code- und live-verifiziert (Abschnitt 2).

**Weiterhin offen:**
- **H-2 (High):** Farewell-Limbo, intermittierend (0–6 betroffene Turns je Lauf), Worst-Case diese Runde schwerer als Runde 2. Root Cause unverändert (Analyst-Split-Brain), volle Lösung bleibt PROJ-46 (Nutzer-Entscheidung aus Runde 2 unverändert gültig).
- **M-2 (Medium, PROJ-42/KI-26):** Rollen-Guard-Falschpositiv. Dormant in dieser Runde.
- **M-4 (Medium):** Clarification-Cards feuern nie (`clarification_coverage_delta` 0, jetzt 4/4 Läufe über 2 Runden). Mit-Blocker des Gates.
- **M-5 (Medium):** `dependency_capture` strukturell nahe 0 (0.2/0/0 diese Runde).
- **M-6 (Medium):** Fokus-Lock bleibt advisory (nicht Teil des Runde-2-Bündels), Themensprünge weiterhin beobachtbar (z.B. buchhalter Lauf 2, Turn 9 zurück zu Rechnungsprüfung-Medienbrüchen nach Monatsabschluss-Fokus).
- **M-7 (Medium):** Abschluss kann substanzielle Antworten ignorieren. In dieser Runde nicht eindeutig reproduziert (Abschnitt 7 ist ein schwächerer, uneindeutiger Fall) — Ursache (`newStepThisTurn` vetoet nur bei neuem Schritt, nicht bei neuem Inhalt) unverändert im Code, daher als weiterhin offen gezählt.
- **L-1 (Low):** Fehlende sprachliche Übergänge bei Fokus-/Sonden-Wechseln.
- **L-2 (Low):** Suggestive/Forced-Choice-Fragen (KI-21/25) — erneut bestätigt (buchhalter Lauf 1, Turn 6: „eher 5% oder eher 20%").

### Production-Ready-Entscheidung: **NEIN**

Zwei unabhängige Gründe, wie in Runde 2: (1) H-2 ist ein offener High-Severity-Bug (QA-Regel: kein Approved bei Critical/High); (2) Pflicht-Eval-Gate weiterhin 0/2 PASS. Beide Gründe waren bereits vor diesem Mess-Eval als wahrscheinlich eingeschätzt (Nutzer-Entscheidung „Weg nach vorn", Runde 2) und bestätigen sich jetzt empirisch. PROJ-44 bleibt **In Review**.

**Empfehlung, unverändert zur Runde-2-Priorisierung:** die volle H-2-Lösung („Analyst darf nicht terminieren") sowie M-6/M-7/L-1 gehören sachlich zu **PROJ-46** (Talker-Briefing-Konsolidierung, Requires PROJ-44 — durch diese Runde weiter bestätigt als der richtige nächste Schritt, nicht eine vierte PROJ-44-Iteration). Das Eval-Gate bleibt eine Instrument-Entscheidung (PROJ-40/neues Feature), keine weitere Agenten-Kalibrierung innerhalb PROJ-44. Einziges offen bleibendes PROJ-44-eigenes Element ist die Bookkeeping-Frage, ob PROJ-44 mit `1:5:2` und unerfülltem Gate formal geschlossen (z.B. als „Done, bekannte Nachfolge-Arbeit in PROJ-46/40/43/42" statt endlos „In Review") oder weiter in Review gehalten wird, bis PROJ-46 lädt — eine Bookkeeping-Entscheidung für den Nutzer, keine technische.

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
