# ADR-021: Analyst synchron vor Talker — Timing-Amendment zu ADR-011 D2

**Status:** Accepted (2026-07-17 — implementiert via PROJ-44 `/backend`)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Realer Interview-Durchlauf („Tim", 2026-07-14) + die daraus abgeleiteten PROJ-42-Befunde BUG-1-Staleness und BUG-6 (doppelte Verabschiedung). Beide teilen dieselbe Wurzel wie KI-12/KI-14/KI-15: die Ein-Turn-Zustandsverzögerung der Dual-Loop-Pipeline.
**Ergänzt / ändert:** ADR-011 (Dual-Loop-Architektur) — **kehrt dessen D2-Timing um**. Überholt das in ADR-019 vorgeschlagene (nie akzeptierte) Freshness-Signal. Baut auf ADR-016 (`runInterviewTurn`-Naht) und ADR-018 (TurnStore-Port) auf, ersetzt sie nicht.
**Realisiert durch:** PROJ-44 (Pipeline-Simplifikation).

---

## Context

ADR-011 D2 realisierte die Dual-Loop-Architektur als „Pipelined V1 mit Briefing-Cache": der Analyst plant das Briefing für den **nächsten** Talker-Turn und läuft asynchron (`after()`) nach/parallel zum Talker. Der Talker konsumiert ein vom vorherigen Analyst-Lauf vorbereitetes Briefing.

Diese Ein-Turn-Zustandsverzögerung ist eine Architektur-Eigenschaft, kein Bug in einer Zeile. Sie ist aber die gemeinsame Wurzel einer wiederkehrenden Fehlerklasse:

- **KI-12/KI-14/KI-15** (2026-06): `checkLifecycle()` entschied auf einem Snapshot vom Ende des Vorturns. Jeder Fix ergänzte einen weiteren ad-hoc Reason-Branch bzw. einen synchronen Recheck-Zweig in `runInterviewTurn.ts`.
- **BUG-1-Staleness / BUG-6** (PROJ-42, 2026-07): die `explore→closing`-Transition bzw. der `closing`-Trigger nutzten Pre-Turn-Zustand; ein Turn, der gerade einen Prozess offenbart oder eine Verabschiedung auslöst, wurde auf verstaltetem Zustand fehlentschieden.

Die bisherigen Gegenmaßnahmen waren punktuell:

1. Der **`soft_confirm`-Recheck** ([runInterviewTurn.ts:265-307](../../src/services/runInterviewTurn.ts#L265)): der einzige Ort, der den Analyst bereits synchron **vor** einer Entscheidung laufen ließ — aber nur für die Completion-Entscheidung, mit doppelten Dedup-Guards in beiden `background()`-Closures.
2. Der **Quick-Extract** ([interviewQuickExtract.ts](../../src/services/interviewQuickExtract.ts)): ein zweiter, schneller LLM-Pass vor dem Talker, der die 1-Turn-Race für Slot-Werte punktuell entschärfte, aber ein eigenes enges Extraktions-Substrat mit eigener `quick`-Write-Priorität einführte.

ADR-019 (Status: Proposed, nie akzeptiert) schlug vor, die Staleness über ein **orthogonales Freshness-Signal** in `checkLifecycle()` zu lösen, ohne das Grund-Timing anzutasten — bewusst der kleinere Schnitt, mit PROJ-32 („Agenten-Architektur", Zurückgestellt) als Eskalationsstufe für die Wurzel-Lösung.

Die realen Befunde von 2026-07 (Tim-Durchlauf) zeigen: die Fehlerklasse tritt weiter auf, und jeder weitere Punkt-Fix erhöht die Komplexität (drei Analyst-Einstiegspunkte, ein synchroner Recheck, ein Quick-Extract-Substrat, ein toter Legacy-Stream-Pfad). Der größere Schnitt ist jetzt gerechtfertigt.

---

## Decision

### D1 — Analyst läuft synchron VOR der Phasenentscheidung und VOR dem Talker

Kehrt ADR-011 D2 um. Der Analyst plant nicht länger das Briefing für den *nächsten* Turn. Pro Turn läuft der volle Analyst (`runAnalyst`) synchron, nachdem der Rollen-Guard passiert wurde und bevor `checkLifecycle`/`decideNextPhase` und der Talker laufen. Sein frisches Ergebnis (aktueller `stepTracker` + aktuelles `AnalystBriefing`) speist alle drei.

Neue Turn-Reihenfolge:

```
Rollen-Guard → runAnalyst (synchron) → checkLifecycle → decideNextPhase
             → shouldInjectClosingProbe → Talker → after(finalize)
```

Konsequenz: `checkLifecycle`/`decideNextPhase`/`shouldInjectClosingProbe` lesen den Zustand **inklusive des aktuellen Turns**. Die Orchestrator-Logik (Signalkaskade) ist unverändert; nur ihre Eingabe ist frisch. Der Talker konsumiert das Briefing **dieses** Turns, nicht mehr `next_briefing` vom Vorturn.

### D2 — Ein Analyst-Einstiegspunkt (Deep Module) mit internen Modi

`runAnalystOnline`, `runAnalystCatchup`, `runAnalystFailureRetry` und der separate `soft_confirm`-Recheck kollabieren zu einem `runAnalyst(opts)`. Der Modus wird am Turn-Anfang aus dem geladenen Zustand bestimmt (`ctx.phase` + `analyst_status`), nicht aus der Phasenentscheidung:

- **online** (`phase` ≠ closing): ein Pass, nur aktuelles Statement, register + Briefing + Cards.
- **closing** (`phase` = closing): ein Aufruf, intern zwei schlanke Sub-Pässe — Backfill (Voll-Historie, nur `record_slot`, kein register, Priorität `analyst_catchup`=4) dann Online (register + Briefing + Cards auf dem nachgefüllten Tracker, Priorität 3).
- **failure-window** (`analyst_status` = failed): der verpasste Vorturn wird vorangestellt (heutiges `runAnalystFailureRetry`-Verhalten), zusätzlich zum obigen Modus.

Der `closing`-Backfill feuert strukturell ~1× pro Closing-Episode (es gibt genau einen Turn mit Start-`phase=closing`), ohne Marker. Die zwei internen Sub-Pässe bleiben getrennte, fokussierte LLM-Calls (nicht ein verschmolzener Prompt), um die dokumentierte KI-18-Prompt-Dichte-Regression und die Register-Fragmentierung aus der Historie zu vermeiden. `runAnalyst` gibt `{ briefing, toolCalls, stepTracker }` zurück; der frische Tracker ersetzt einen separaten DB-Re-Read.

### D3 — Quick-Extract entfällt; `quick`-Write-Source ersatzlos entfernt

Der synchrone Analyst übernimmt die Slot-Füllung des aktuellen Turns vollständig. `interviewQuickExtract.ts` wird gelöscht. `quick` fällt aus `WriteSource`/`PRIORITY` (`slotConflictResolver.ts`), dem Trail-Enum (`slotWriteTrail.ts`) und `SlotValue.writeSource` (`interviewSemantic.ts`) — kein Read-Kompat-Eintrag. Historische `quick`-Strings degradieren über den `?? 0`-Fallback von `canOverwrite` korrekt (der aktuelle Analyst darf sie überschreiben).

### D4 — Fail-Safe: bounded Retry, `soft_confirm` vetoen, `hard_stop` zulassen

Der synchrone Analyst-Call hat einen gedeckelten Retry (bestehendes `withRetry`-Muster). Bei terminalem Fehler läuft der Turn mit dem Vorturn-Briefing weiter (selbstheilende Degradation, auf genau diesen Turn begrenzt), `analyst_status='failed'` wird gesetzt, `console.error` statt Silent-Fail. **Auf einem gescheiterten Turn wird `soft_confirm` vetoet** (nicht auf veraltetem Zustand abschließen — erhält den KI-12-Schutz und garantiert, dass es einen Recovery-Turn gibt); **`hard_stop` schließt trotzdem ab** (Zeit-Aus ist unbedingt und braucht den Analysten nicht). Der nächste Turn holt via Failure-Window synchron nach.

### D5 — `background()` wird zu `after(finalize)`; Analyst-Ergebnis über `meta`

Da der Analyst nach vorn wandert, enthält der Post-Response-Pfad nur noch `extractAndEmbed` + `onCompleted` (Wissens-Extraktion/Embeddings + Ableitungs-Pipeline). Diese laufen künftig garantiert unter `after()` (schließt die heutige fire-and-forget-Lücke im Talker-`onFinish`) statt losgelöst. Der `AnalystRunResult` erreicht den Eval-Runner über `TurnResult.meta.analyst`; `finalize()` gibt void zurück. `after()` bleibt ausschließlich Concern des Route-Adapters.

### D6 — Toter Legacy-Pfad entfernt

`interviewAgent.ts` (`createInterviewStream` + `buildStaticPrompt`) wird gelöscht. `buildTools` wandert nach `interviewTools.ts` (einziger Konsument: `interviewAnalyst.ts`). Die Start-Route nutzt `createTalkerStream({isStart:true})` (toollos; Grounding-Guard bei leerer History übersprungen). Die Reconnect-Route gibt immer den statischen „Willkommen zurück"-Text zurück (LLM-Pfad gestrichen, war durch atomare Turn-Persistenz ohnehin unerreichbar — KI-22). Damit ist `STATIC_PROMPT` die einzige Static-Prompt-Quelle → PROJ-37-Drift aufgelöst.

---

## Consequences

**Positiv:**
- Die Staleness-Fehlerklasse (KI-12/14/15, BUG-1/BUG-6) ist an der Wurzel beseitigt statt pro Symptom geflickt. `checkLifecycle`/`decideNextPhase` entscheiden immer auf frischem Zustand.
- Weniger Kanten zwischen Modulen: der Turn kreuzt genau eine Analyst-Naht und eine Talker-Naht. Drei Analyst-Einstiegspunkte + Recheck → einer. Zwei-Stufen-Recheck-Konstruktion + doppelte Dedup-Guards + Quick-Extract-Substrat + toter Legacy-Stream entfallen.
- Die #18-Filler-Race verschwindet strukturell (Analyst schreibt `next_briefing` synchron vor dem Talker).
- Die fire-and-forget-Reliability-Lücke von `extractAndEmbed` wird geschlossen.

**Negativ / Trade-offs:**
- **Time-to-first-token steigt** bewusst: der volle Analyst (flash-3.5, thinkingBudget 2048) ersetzt auf dem kritischen Pfad den leichten Quick-Extract. Bewusst freigegeben (Korrektheit vor Geschwindigkeit); ein client-seitiger „Analysiere…"-Indikator überbrückt die Wartezeit; das Delta wird gemessen.
- Der `closing`-Konvergenz-Turn läuft zwei Analyst-Sub-Pässe synchron (hat aber keinen Talker, außer bei Late Discovery).

**Offen / abgegrenzt (nicht Teil dieser ADR):**
- **BUG-4** (Methodik-Block-Gedächtnisverlust) ist kein Lag-Artefakt und bleibt für **PROJ-46**. PROJ-42 bleibt bis dahin In Review.
- Migration der code-berechneten Judgment-Signale ins Analyst-Briefing → **PROJ-46**.
- Verlagerung von `extractAndEmbed` nach Interview-Completion → eigener Wissensbank-naher Kandidat (orthogonal zum Timing-Flip, würde die Eval-Attribution verwässern).

**Beziehung zu ADR-019:** ADR-019 (Proposed) wählte bewusst den kleineren Schnitt (Freshness-Signal ohne Timing-Umkehr) und hielt PROJ-32 als Eskalationsstufe für die Wurzel-Lösung vor. ADR-021 zieht diese Eskalationsstufe (in schlankerer Form als das volle PROJ-32) und macht ADR-019s vorgeschlagenes Signal gegenstandslos.
