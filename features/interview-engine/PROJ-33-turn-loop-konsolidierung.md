# PROJ-33: Turn-Loop-Konsolidierung (runInterviewTurn)

## Status: Deployed
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** M (3–5d)
**Bugs:** 0:0:0
**Created:** 2026-06-18
**Last Updated:** 2026-06-18
**Architecture:** ADR-016 (Interview-Turn-Seam)

## Dependencies
- Requires: PROJ-22 (Dual-Loop Interview Engine) — Orchestrator, Talker, Analyst, Quick-Extract sind die Komponenten, die der Turn bündelt
- Requires: PROJ-17 (Adaptive Eval-Harness) — der Eval-Runner ist der zweite Aufrufer, der durch dieselbe Naht laufen soll
- Related: ADR-011 (Dual-Loop), ADR-015 (Slot-Write-Trail) — werden realisiert, nicht neu entschieden

## Context

Die Turn-Logik des Interviews existiert **zweimal** und ist **bereits inhaltlich gedriftet**:

1. **Prod**, [`src/app/api/interview/[token]/chat/route.ts`](../../src/app/api/interview/%5Btoken%5D/chat/route.ts) (511 LOC) — ein Turn pro HTTP-Request.
2. **Eval**, [`src/services/__evals__/interview/runner.ts`](../../src/services/__evals__/interview/runner.ts) (Turn-Loop ≈ Z. 822–1018) — In-Process-`for`-Loop über bis zu 35 Turns mit synthetischer Persona.

Beide stitchen denselben Ablauf zusammen — `decideNextPhase` → `checkLifecycle` → Wrap-up-Injektion → `runQuickExtract` → `createTalkerStream` → persistieren → Analyst — aus denselben acht Service-Modulen. Da es zwei abgetippte Kopien sind, laufen sie auseinander:

- **Analyst-Drift (kritisch):** Prod fährt `runAnalystOnline` + bedingt `runAnalystCatchup` (an `phaseJustEntered` gekoppelt) + `runAnalystFailureRetry` (bei `analyst_status='failed'`), alles im `after()`-Hintergrund. Der Eval ruft das **veraltete** `runAnalyst` (Einzelmodus, kein online/catchup-Split, kein History-Nachholen, kein Failure-Retry), inline. **Der Eval misst damit ein anderes Extraktionsverhalten als das, was live läuft.**
- Weitere Drift: Streaming (`toTextStreamResponse`) vs. `await .text`, `activeStepTitle` im Quick-Extract nur in Prod, Clarification über separaten Endpunkt (Prod) vs. synthetische Antworten inline (Eval).

Das Problem ist also nicht primär Code-Menge, sondern **Mess-Validität**: Solange Route und Runner getrennte Implementierungen sind, evaluiert man nicht das System, das deployt ist. Im Vokabular der tiefen Module (siehe ADR-016): die Turn-Logik ist über zwei flache Aufrufer verteilt, die Naht für „ein Turn" fehlt. Der Deletion-Test besteht: löscht man die Duplikation, konzentriert sich die Turn-Logik an einer Stelle statt sie zu verteilen.

## Scope

### Das tiefe Modul `runInterviewTurn`

Neues Service-Modul `src/services/runInterviewTurn.ts`. Genau **ein** Turn hinter einer kleinen Schnittstelle. Der Loop bleibt beim Aufrufer (Prod: nächster HTTP-Request; Eval: `for`-Loop).

Eingabe: `{ interviewId, userInput, timerMinutes }`. Das Modul lädt selbst (interview-Zeile, state, history, briefing) und persistiert selbst (Supabase, wie heute). `timerMinutes` ist injiziert, weil der Eval die Zeit simuliert.

Rückgabe: `{ stream, background, meta }`.
- `stream` — das AI-SDK-`streamText`-Objekt unverändert; der Aufrufer wählt `.toTextStreamResponse()` (Prod) oder `.text` (Eval).
- `background` — **eine** aufschiebbare Aufgabe: das Modul entscheidet intern die Analyst-Variante (online / +catchup bei `phaseJustEntered` / failure-retry bei `analyst_status='failed'`) und, falls dieser Turn das Interview abschließt, die Post-Completion-Pipeline. Gibt das Analyst-Ergebnis zurück (für Eval-Scoring). Der Aufrufer terminiert: `after(() => turn.background())` (Prod) bzw. `await turn.background()` (Eval).
- `meta` — `{ phase, completed, reason, stepTracker }`, synchron verfügbar.

### Die zwei Aufrufer werden Adapter

`chat/route.ts` schrumpft auf HTTP-Belange (Token, Expiry, completed, Rate-Limit, Eingabe-Validierung) + `runInterviewTurn` aufrufen + `meta.completed` behandeln + `after()` + Stream zurückgeben. Der Runner-Schleifenkörper schrumpft auf: synthetische Antwort → `runInterviewTurn` → `await .text` → `await background()` → `meta` aufzeichnen → bei `completed` brechen. Der gesamte gewollte Unterschied sind drei injizierte Dinge: `timerMinutes`, der Stream-Zugang, `after()` vs `await`.

### Tests: replace, don't layer

Turn-Logik-Tests wandern an die `runInterviewTurn`-Schnittstelle (Mocks aus `chat.test.ts` fast 1:1 übernommen), Assertions auf die `meta`/`stream`/`background`-Rückgabe statt auf Mock-Aufrufe gehoben. `chat.test.ts` schrumpft auf HTTP-Smoke-Tests. Orchestrator-Tests bleiben unangetastet (interne Naht).

## User Stories

- Als **Entwickler** möchte ich die Turn-Logik an genau einer Stelle ändern, damit Prod und Eval nicht auseinanderlaufen.
- Als **KI-Berater / Eval-Nutzer** möchte ich, dass der Eval dieselbe Analyst-Orchestrierung (online + catchup + failure-retry) wie Prod fährt, damit ein gemessener Modellvergleich auf das deployte System zutrifft.
- Als **Entwickler** möchte ich die Turn-Logik direkt an ihrer Schnittstelle testen statt durch den HTTP-Handler, damit Tests schneller sind und interne Umbauten überleben.

## Acceptance Criteria

- [ ] `src/services/runInterviewTurn.ts` existiert mit Signatur `runInterviewTurn(input: { interviewId, userInput, timerMinutes }): Promise<{ stream, background, meta }>`
- [ ] `chat/route.ts` enthält **keine** Turn-Orchestrierung mehr (kein direkter Aufruf von `decideNextPhase`/`createTalkerStream`/`runAnalyst*`/`runQuickExtract`); ruft nur `runInterviewTurn` + behandelt HTTP + `after()` + `meta.completed`
- [ ] `runner.ts`-Schleifenkörper ruft `runInterviewTurn` und `await turn.background()`; kein eigener Aufruf von `decideNextPhase`/`createTalkerStream`/`runAnalyst`/`runQuickExtract` mehr
- [ ] Der Eval läuft nachweislich `runAnalystOnline` + (bei Phaseneintritt) `runAnalystCatchup`; das veraltete `runAnalyst` wird im Turn-Loop nicht mehr aufgerufen
- [ ] `background()` bündelt Analyst-Variante und (nur auf dem Abschluss-Turn) Post-Completion; die „wann Post-Completion"-Regel liegt im Modul, nicht in den Aufrufern
- [ ] `meta.completed` signalisiert Abschluss; Prod setzt `status=completed`, der Eval bricht den Loop — beide reagieren auf dieselbe Quelle
- [ ] Prod streamt weiter live (`toTextStreamResponse`), keine UX-Regression
- [ ] `runInterviewTurn.test.ts` prüft Turn-Logik an der Schnittstelle (Phase, completed, Wrap-up-Injektion, Analyst-Wahl) gegen die Rückgabe; `chat.test.ts` deckt nur noch 404/410/409/400/Rate-Limit
- [ ] `npm run lint` und `npm test` grün
- [ ] Eval-Gate: `npm run eval:interview buchhalter` ohne Regression gegen Baseline PROJ-22 (Vollständigkeit, Coverage)

## Edge Cases

- **Wrap-up-Injektion:** Der Turn schreibt die konstante `WRAP_UP_QUESTION_TEXT` ohne Talker-Aufruf; `stream` liefert genau diesen Text, `background` läuft trotzdem (Analyst). Verhalten identisch zu heute, nur an einer Stelle.
- **Abschluss-Turn (Hard-Stop / Soft-Confirm):** Modul produziert Farewell-Stream, setzt `meta.completed=true` + `reason`, `background` enthält die Post-Completion-Pipeline. Prod schreibt `status=completed`, Eval bricht.
- **Clarification:** `decideNextPhase` kann `phase='clarification'` liefern; das Modul gibt es via `meta.phase` zurück, behandelt die Phase aber **nicht** selbst (separater Prod-Endpunkt; Eval injiziert synthetische Antworten). Bleibt Aufrufer-Sache wie heute.
- **Quick-Extract-Gating:** unverändert (nur bei `stepTracker.length > 0` und nicht-trivialem Input); im Eval ohnehin redundant (inline-Analyst), bleibt aber für Verhaltensgleichheit drin.
- **`background()` im Eval awaited, in Prod fire-and-forget:** Rückgabe (Analyst-`toolCalls`) nur vom Eval konsumiert, Prod verwirft sie.
- **Greeting/Start-Turn:** nicht Teil von `runInterviewTurn` (eigener Prod-Endpunkt; Eval behält seinen Start-Aufruf).

## Technical Requirements

- **Service-Layer-Constraint (INDEX Architecture Notes):** Die Turn-Orchestrierung gehört in `src/services/`, nicht in die Route — `runInterviewTurn.ts` erfüllt das explizit.
- **Persistenz bleibt Supabase** im Modul; kein TurnStore-Port in diesem Deepening (siehe Out of Scope + ADR-016).
- **Kein `next/server`-Import im Modul:** `after()` bleibt beim Aufrufer, damit der Eval-`tsx`-Pfad das Modul laden kann.
- **Eval-Gate vor Implementierungs-Abschluss:** `npm run eval:interview buchhalter`, Vergleich gegen PROJ-22-Baseline.
- **Keine DB-Migration**, keine Schema-Änderung, kein neues UI.

## Out of Scope

- **TurnStore-Port + Werkzeug-Schreibabsichten (→ PROJ-34, Roadmap).** Ein DB-freier Eval (in-memory/PGlite-Adapter) verlangt, dass auch die Werkzeug-Ebene (`record_slot`, `update_walkthrough_data`, `register_step` in `buildTools`, dazu `slotWriteTrail`, `embeddings`, `stepIdentity`, Post-Completion) hinter einen Port wandert — eine große, separate Fläche. Heute nutzen Prod und Eval beide die echte Supabase; ein Port jetzt wäre Indirektion ohne zweiten echten Adapter (Naht-Disziplin: ein Adapter = hypothetische Naht). Erst sinnvoll, wenn DB-freie Evals ein erklärtes Ziel sind; dann mit PGlite/lokalem Postgres statt naivem Fake (Treue) plus separater Integrationstest-Schicht. Begründung im Detail: ADR-016.
- **Start/Greeting- und Clarification-Endpunkte konsolidieren:** eigene Interaktionen mit eigenen Prod-Endpunkten; nicht Teil eines Chat-Turns.
- **Aufbrechen von `interviewAgent.ts` (1948 LOC):** Conversation-Signals-Modul und Auflösung des Re-Export-Hubs sind eigene Deepening-Kandidaten (#2/#3 aus dem Architektur-Review 2026-06-18), unabhängig von dieser Naht.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design

### Schnittstelle

```ts
interface RunTurnInput {
  interviewId: string
  userInput: string
  timerMinutes: number          // Aufrufer liefert (prod: echt, eval: simuliert)
}

interface TurnResult {
  stream: StreamTextResult       // .toTextStreamResponse() (prod) | .text (eval)
  background: () => Promise<AnalystRunResult | null>
  meta: {
    phase: Phase
    completed: boolean
    reason: 'hard_stop' | 'soft_confirm' | null
    stepTracker: StepEntry[]
  }
}

async function runInterviewTurn(input: RunTurnInput): Promise<TurnResult>
```

### Interner Ablauf (heute zweifach, künftig einmal)

1. Laden: interview-Zeile, `interview_state`, `turns`, `next_briefing`.
2. `checkLifecycle` → bei Abschluss Farewell-Stream + `meta.completed` + `reason`; `background` enthält Post-Completion.
3. Sonst `decideNextPhaseWithMeta`; Phase persistieren wenn geändert.
4. `shouldInjectWrapUpQuestion` → konstanten Text als `stream` (kein LLM).
5. Sonst `runQuickExtract` (gated) → `computeMissingMandatorySlots` → `createTalkerStream` mit Persistenz im `onFinish`.
6. `background` bauen: frischen `step_tracker` nachladen → Analyst-Variante wählen → bei `completed` Post-Completion anhängen. Gibt `AnalystRunResult` zurück.

### Aufrufer-Adapter

```ts
// Prod-Route — HTTP + 3 Zeilen
const turn = await runInterviewTurn({ interviewId, userInput, timerMinutes })
if (turn.meta.completed) await markCompleted(interviewId)
after(() => turn.background())
return turn.stream.toTextStreamResponse()

// Eval-Runner — Schleifenkörper
const turn = await runInterviewTurn({ interviewId, userInput: personaResponse, timerMinutes: simuliert })
const agentText = await turn.stream.text
const analyst = await turn.background()
record(turn.meta.phase, analyst?.toolCalls)
if (turn.meta.completed) break
```

### Test-Strategie (replace, don't layer)

- Neues `src/services/runInterviewTurn.test.ts`: Mocks aus `chat.test.ts` (Supabase, Talker, Analyst, Quick-Extract, Orchestrator) übernehmen; Assertions auf `meta`/`stream`/`background`-Rückgabe (z.B. `expect(r.meta.phase).toBe('wrap_up')`, `expect(r.meta.completed).toBe(true)`), nicht auf „Funktion X aufgerufen".
- `chat.test.ts`: nur noch 404 (Token), 410 (Expiry), 409 (completed), 400 (Eingabe), Rate-Limit.
- Orchestrator-Tests: unverändert (interne Naht, eigene Test-Oberfläche).

## Implementation Notes (2026-06-18)

Umgesetzt via `/build PROJ-33` (Sonnet, Worktree `refactor/deep-modules`).

- **Neu:** `src/services/runInterviewTurn.ts` (483 LOC) mit der Schnittstelle `{ stream, background, meta }`. Das Modul entscheidet die Analyst-Variante intern (`runAnalystOnline` / `runAnalystCatchup` / `runAnalystFailureRetry`) und reicht sie als eine gebündelte `background()`-Aufgabe zurück. Kein `next/server`-Import.
- **Aufrufer geschrumpft:** `chat/route.ts` 511→125 LOC (reiner HTTP-Adapter), `runner.ts`-Turn-Loop delegiert an `runInterviewTurn` + `await background()`. Gesamt 847 Zeilen entfernt.
- **Tests:** `runInterviewTurn.test.ts` (498 LOC) prüft die Turn-Logik an der Schnittstelle; `chat.test.ts` 490→236 LOC (HTTP-Belange). Lint grün (`tsc --noEmit`), 610 Tests grün, 1 skipped.

**Bewusste Abweichung von AC:** Der Eval-Runner ruft weiterhin `decideNextPhase` einmal **vor** `runInterviewTurn` (`runner.ts` ~Z. 845), ausschließlich für die Clarification-Vorprüfung. Clarification ist out-of-scope für `runInterviewTurn` (Prod hat einen eigenen Endpunkt, der Eval injiziert synthetische Antworten und bricht). Die Turn-Orchestrierung selbst liegt vollständig im Modul; dies ist die im Grilling beschlossene aufrufer-seitige Asymmetrie, kein Drift-Rest.

**Eval-Gate (2026-06-19):** `npm run eval:interview buchhalter` (gemini-3.1-flash-lite) — **kein Regress** gegen die 2026-06-18-Baseline. Alle Metriken im oder über dem Baseline-Band (slot_coverage 0.33; tool_call_plausibility 0.70 > alle Baselines 0.51–0.68; phase_progression 1; completion_correctness true). Der Report-`status: FAIL` ist der Standing-State von flash-lite (absolute Ziele wie hallucination_rate < 0.01 werden schon vor PROJ-33 gerissen), kein durch diese Naht eingeführter Defekt. Lauf: `docs/evals/interview/2026-06-19/2026-06-19-08-23-10-google-gemini-3-1-flash-lite-buchhalter.md`.

**Nachbesserung während Eval (defensiv):** `normalizeStepEntry` (`interviewSemantic.ts`) formt `abhaengigkeiten` robust (Arrays garantiert, `nicht_befund_typ` default null); `runInterviewTurn` schickt den Quick-Extract-Tracker vor Gebrauch durch `normalizeStepEntry`. Gates bleiben grün (Lint + 610 Tests).

**Status → Approved** (kein Regress, Gates grün). `Bugs: 0:0:0` ist refactor-spezifisch; die absolute Interview-Qualität (hallucination_rate, coverage) ist ein bestehendes, separates Thema → PROJ-28/30/35, nicht diese Naht.