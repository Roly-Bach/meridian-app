# ADR-016: Interview-Turn als tiefes Modul (runInterviewTurn)

**Status:** Accepted
**Date:** 2026-06-18
**Deciders:** Solo dev (Deepening-Review 2026-06-18, /improve-codebase-architecture)

---

## Context

Die Turn-Logik der Dual-Loop Interview Engine (ADR-011) ist an zwei Stellen unabhängig implementiert:

1. **Prod** — `src/app/api/interview/[token]/chat/route.ts` (511 LOC), ein Turn pro HTTP-Request.
2. **Eval** — `src/services/__evals__/interview/runner.ts` (Turn-Loop ≈ Z. 822–1018), In-Process-`for`-Loop mit synthetischer Persona.

Beide stitchen denselben Ablauf (`decideNextPhase` → `checkLifecycle` → Wrap-up-Injektion → `runQuickExtract` → `createTalkerStream` → persistieren → Analyst) aus denselben Service-Modulen zusammen. Weil es zwei Kopien sind, sind sie bereits gedriftet:

- **Analyst-Drift (kritisch):** Prod fährt `runAnalystOnline` + bedingt `runAnalystCatchup` + `runAnalystFailureRetry` im `after()`-Hintergrund. Der Eval ruft das veraltete `runAnalyst` (kein Modus-Split, kein History-Catchup, kein Failure-Retry) inline. Der Eval misst damit ein anderes Extraktionsverhalten als das deployte System.
- Weitere Drift: Streaming vs. `await .text`, `activeStepTitle` nur in Prod, Clarification-Struktur unterschiedlich.

Das ist kein reines DRY-Problem, sondern **Mess-Validität**: getrennte Implementierungen heißt, der Eval evaluiert nicht das, was live läuft. Im Vokabular tiefer Module: die Naht für „ein Turn" fehlt; die Logik ist über zwei flache Aufrufer verteilt. Deletion-Test bestanden (Löschen der Duplikation konzentriert die Logik statt sie zu verschieben). Zwei Adapter (Prod-Route + Eval-Runner) rechtfertigen die Naht.

Ein technischer Zwang prägt das Design: `after()` stammt aus `next/server` und funktioniert nur im Request-Kontext. Der Eval-Runner ist ein `tsx`-Skript außerhalb von Next — deshalb kann er die Route heute nicht wiederverwenden. Das tiefe Modul darf `after()` nicht enthalten.

## Decision

Einführen eines tiefen Moduls `src/services/runInterviewTurn.ts`, das genau **einen** Turn hinter einer kleinen Schnittstelle kapselt. Route und Runner werden dünne Adapter darüber. Sieben Design-Entscheidungen (Grilling 2026-06-18):

1. **Scope = ein Turn.** Nicht die Session. Prod ruft pro Request, der Eval im `for`-Loop. Der Loop bleibt beim Aufrufer. Begründung: Prods Per-Request-HTTP-Modell kann keinen In-Process-Loop hosten.

2. **Analyst-Übergabe = Deferred Task.** Das Modul entscheidet **welche** Variante läuft (online / +catchup bei `phaseJustEntered` / failure-retry bei `analyst_status='failed'`) und gibt sie als aufschiebbare Aufgabe zurück. Der Aufrufer terminiert nur: `after(() => turn.background())` (Prod) bzw. `await turn.background()` (Eval). `after()` bleibt außerhalb des Moduls. Damit läuft der Eval erstmals dieselbe Analyst-Orchestrierung wie Prod.

3. **Streaming = Stream-Objekt zurückgeben.** Das AI-SDK-`streamText`-Ergebnis wird durchgereicht; es bietet `.toTextStreamResponse()` (Prod, Live-Token) und `.text` (Eval). Kein Wrapper (wäre ein flaches Modul über eine schon duale Schnittstelle).

4. **Persistenz = Supabase im Modul.** Kein TurnStore-Port in diesem Deepening. Heute nutzen beide Aufrufer die echte Supabase, ein Port wäre Indirektion ohne zweiten echten Adapter. Der DB-freie Eval ist vertagt (siehe unten + PROJ-34).

5. **Eingabe = Modul lädt selbst.** Eingabe `{ interviewId, userInput, timerMinutes }`; das Modul lädt interview-Zeile, state, history, briefing selbst und persistiert selbst. `timerMinutes` bleibt injiziert (Eval simuliert Zeit). Der Eval seedet die interview-Zeile einmal beim Start. Damit stirbt auch die Lade-Duplikation.

6. **Rückgabe = `{ stream, background, meta }`.** `background` ist **eine** gebündelte Aufgabe (Analyst + Post-Completion nur auf dem Abschluss-Turn); die „wann Post-Completion"-Regel bleibt versiegelt im Modul. `meta` (`phase`, `completed`, `reason`, `stepTracker`) ist synchron verfügbar und signalisiert Abschluss an beide Aufrufer.

7. **Tests = replace, don't layer.** Turn-Logik-Tests wandern an die `runInterviewTurn`-Schnittstelle (Mocks fast 1:1, Assertions auf die Rückgabe statt auf Mock-Aufrufe gehoben). `chat.test.ts` schrumpft auf HTTP-Belange. Orchestrator bleibt eine interne Naht mit eigener Test-Oberfläche.

Der gesamte gewollte Unterschied zwischen Prod und Eval reduziert sich auf drei injizierte Dinge: `timerMinutes`, den Stream-Zugang, `after()` vs `await`.

## Consequences

**Positiv:**
- Mess-Validität: Der Eval fährt dieselbe Analyst-Orchestrierung (online + catchup + failure-retry) wie Prod; das veraltete `runAnalyst` verschwindet aus dem Turn-Loop. Drift bei Streaming, Quick-Extract und Struktur kollabiert in ein Modul.
- Locality: Turn-Logik an einer Stelle änderbar. Route und Runner werden dünn.
- Testbarkeit: Turn-Verhalten direkt an der Schnittstelle prüfbar (`meta`-Rückgabe), schneller als durch den HTTP-Handler, überlebt interne Umbauten.
- Service-Layer-Constraint (INDEX Architecture Notes) erfüllt: Orchestrierung in `src/services/`, nicht in der Route.

**Negativ / Trade-offs:**
- Persistenz bleibt im Modul verdrahtet (Supabase); Tests brauchen weiter DB-Mocks. Die „reines Modul"-Testbarkeit liefert erst der vertagte Port.
- Clarification und Start/Greeting bleiben außerhalb des Moduls (eigene Endpunkte); die Konsolidierung ist nicht vollständig über alle Interaktionsarten.

**Vertagt (→ PROJ-34, Roadmap): Werkzeug-Schreibabsichten + TurnStore-Port.** Die Slot-Schreibvorgänge passieren heute **in den LLM-Werkzeugen** (`record_slot` u.a. in `buildTools`), nicht im sichtbaren Kontrollfluss — Seiteneffekt statt Rückgabe, keine Locality, nur mit DB + LLM testbar. Ein DB-freier Eval (zweiter Adapter, der den Port rechtfertigen würde) verlangt, dass die Werkzeuge **Schreib-Absichten zurückgeben** statt selbst zu schreiben, damit das Modul Invarianten/Konfliktauflösung an einer Stelle anwendet und persistiert. Das ist dieselbe Umbauarbeit, die den TurnStore-Port ermöglicht — ein kohärenter, separater Kandidat. Treue-Hinweis für später: PGlite/lokales Postgres statt naivem In-Memory-Fake (sonst entgehen RLS-, Constraint-, JSONB-Rundreise-Fehler), plus eine eigene Integrationstest-Schicht gegen die echte DB.