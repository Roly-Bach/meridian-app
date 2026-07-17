# ADR-022: Phasen- und Lifecycle-Entscheidung zusammenlegen — `resolveTurnLifecycle`

**Status:** Proposed (2026-07-17 — via `/architecture` PROJ-44; wird Accepted nach `/backend`)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** PROJ-44 QA-Runde 2 (2026-07-17), Befund **H-3** (Nutzer-Transkript-Review): `checkLifecycle` liest weiterhin den Vorturn-Phasenwert und läuft vor `decideNextPhase`. Ein Turn, der `closing` betritt, kann konstruktionsbedingt nie im selben Turn abschließen — exakt der BUG-6-Mechanismus. Damit ist die als `[x]` markierte PROJ-44-AC „BUG-6 strukturell behoben" widerlegt.
**Ergänzt / ändert:** ADR-021 (Analyst synchron vor Talker). ADR-021 machte den **Zustand** frisch (Tracker + Briefing inklusive des aktuellen Turns), ließ aber den **Phasenwert** selbst als Vorturn-Wert stehen und die Doppelung zwischen `decideNextPhase` und `checkLifecycle` bestehen. ADR-022 setzt den Vertrag dieser beiden Funktionen neu; die ADR-021-Timing-Entscheidung (D1) bleibt unverändert gültig. ADR-021 ist Accepted/immutable — ADR-022 supersediert dessen Aussage „BUG-6 strukturell behoben".
**Realisiert durch:** PROJ-44 (Remediation-Runde 2).

---

## Context

ADR-021 kehrte das Timing um: der Analyst läuft synchron vor der Phasenentscheidung, `stepTracker` und `AnalystBriefing` sind seitdem frisch. Die QA-Runde 2 zeigte am realen Transkript, dass das die Fehlerklasse **nicht vollständig** schließt.

Zwei Funktionen treffen pro Turn eine überlappende Entscheidung:

- [`decideNextPhase`](../../src/services/interviewOrchestrator.ts) — welche Phase die nächste Interviewer-Nachricht hat (`intro`/`explore`/`closing`/`clarification`, plus den unbenutzten Sonderwert `'completed'`).
- [`checkLifecycle`](../../src/services/interviewOrchestrator.ts) — ob das Interview diesen Turn abgeschlossen wird (`hard_stop` / `soft_confirm` / nein).

Der Befund ist **keine Reihenfolge-, sondern eine Doppelungs-Frage.** Beide Funktionen implementieren dieselbe Entscheidung zweimal:

1. Die **Hard-Stop-Timer-Regel** (`timerMinutes >= maxDurationMinutes`) steht am Kopf beider Funktionen.
2. Die **Closing-Konvergenz** (Sonde gestellt + beantwortet, kein `exploring`-Schritt, kein diesen Turn neuer Schritt, keine Cards) steht im `closing`-Fall von `decideNextPhase` **und** in Trigger B von `checkLifecycle`.

Die zwei Prüfer lesen zudem unterschiedliche Snapshots derselben Sache: `checkLifecycle` bindet Trigger B an `ctx.phase === 'closing'`, wobei `ctx.phase` in [runInterviewTurn.ts:193/331](../../src/services/runInterviewTurn.ts#L193) der **Vorturn-Wert** ist; `decideNextPhase` berechnet die frische Phase, aber sein `'completed'`-Ergebnis wird in [runInterviewTurn.ts:440](../../src/services/runInterviewTurn.ts#L440) sofort verworfen (`=== 'completed' ? 'closing'`). Der `return 'completed'`-Zweig ist damit toter Code, und die tatsächliche Terminierung leitet `checkLifecycle` einen Turn später aus dem inzwischen aktualisierten Phasenwert erneut her.

Belegt am buchhalter-Verlauf: Turn 16 löste die Phase korrekt zu `closing` auf, alle Abschlussbedingungen waren erfüllt (Sonde in Turn 9 gestellt, Turn 10 beantwortet, kein neuer Schritt, keine Cards), aber `checkLifecycle` sah `ctx.phase === 'explore'` und schloss nicht ab. Turn 16 wurde zum Leerlauf-Turn, in dem der Interviewer eine improvisierte dritte Verabschiedung produzierte (Mit-Ursache von H-2 Farewell-Limbo).

Bloßes Umsortieren (`checkLifecycle` nach `decideNextPhase`) würde die Doppelung konservieren. Der richtige Schnitt ist eine Zusammenlegung auf **eine** Wahrheitsquelle.

---

## Decision

### D1 — Eine Funktion `resolveTurnLifecycle(ctx, briefing) → { phase, complete, reason }`

`decideNextPhase`, `decideNextPhaseWithMeta` und `checkLifecycle` werden zu einer Funktion zusammengelegt. Sie wählt die nächste Phase **und** entscheidet die Terminierung in einem Durchlauf gegen einen frischen Snapshot. Rückgabe:

- `phase: Phase` — die Phase, die in `interview_state` geschrieben wird (`intro`/`explore`/`closing`/`clarification`).
- `complete: boolean` — ob das Interview diesen Turn abgeschlossen wird.
- `reason: 'hard_stop' | 'soft_confirm' | null` — warum.

Ablauf:

```
resolveTurnLifecycle(ctx, briefing):
  # Trigger A — Hard-Stop (unconditional, phasen-agnostisch, letzte Instanz)
  if timer ≥ max:            → { phase:'closing', complete:true, reason:'hard_stop' }

  # Phasen-Transition (ehem. decideNextPhase, OHNE den 'completed'-Rückgabewert)
  target =
     intro          → historyLength≥2 ? 'explore' : 'intro'
     explore        → (Soft-Anchor / noNewExtractionStreak / step_advance_ready
                       && !hasUnexhaustedStep) ? 'closing' : 'explore'
     closing        → (hasStepInStatus('exploring') || newStepThisTurn) ? 'explore' : 'closing'
     clarification  → 'clarification'

  # Terminale Auswertung — GENAU EINMAL, gegen die AUFGELÖSTE Phase
  if target == 'closing':
     if closingProbeAnswerReceived && keine Cards → { 'closing', complete:true,  'soft_confirm' }
     if closingProbeAnswerReceived && Cards       → { 'clarification', complete:false, null }
     # frischer Eintritt, Sonde noch offen:
     → { 'closing', complete:false, null }   # Sonde wird downstream injiziert

  → { target, complete:false, null }
```

Der Kern des H-3-Fixes: die terminale Auswertung läuft gegen `target` (die aufgelöste Phase), nicht gegen `ctx.phase` (den Vorturn-Wert). Damit schließt ein Late-Discovery-Reentry, der von `explore` nach `closing` aufgelöst wird und dessen Sonde bereits beantwortet ist, **im selben Turn** ab, statt einen Leerlauf-Turn später.

Die Signalkaskade selbst (Soft-Anchor-Ratio, Streak-Limit, `hasUnexhaustedStep`, Reentry-Guard, `closingProbeAnswerReceived`) ist **unverändert** — nur ihre Zusammenführung in einen Aufruf und ihre Auswertung gegen die frische Phase sind neu.

### D2 — Terminierungs-Invariante (Fix 4, minimal)

`complete:true` mit `reason:'soft_confirm'` ist strukturell nur erreichbar, wenn `target === 'closing'`. `intro`/`explore`/`clarification` können nie weich abschließen. Nur `hard_stop` (Trigger A) beendet phasen-agnostisch. Das ist ein Zustands-Geländer gegen einen künftigen Abschluss aus der Exploration heraus.

**Abgrenzung:** D2 verhindert **nicht**, dass der Analyst während `explore` eine Verabschiedung in `suggested_question` schreibt und der Talker sie ausführt (H-2 Schicht 1). Die volle „Analyst darf nicht terminieren"-Lösung — Terminierungs-Hoheit ausschließlich beim Orchestrator, Analyst-Briefing an die Phase gebunden — ist **PROJ-46**.

### D3 — Toter Ballast wird ersatzlos entfernt

Keine Kompatibilitäts-Wrapper. Gelöscht:

- Exports `decideNextPhase`, `decideNextPhaseWithMeta`, `checkLifecycle`.
- Typen `ExtendedPhase` (`Phase | 'completed'`), `PhaseDecisionMeta`, `LifecycleDecision`.
- Das `=== 'completed' ? 'closing'`-Mapping und die Zwei-Aufruf-Sequenz in `runInterviewTurn`.
- `PhaseDecisionMeta.phaseJustEntered` (verifiziert toter Wert — der einzige Nicht-Test-Konsument destrukturiert nur `phase`; die Catchup-Triggerung darüber ist seit ADR-021 obsolet, der Analyst-Modus kommt aus `ctx.phase`).
- `topicsOpen`/`topicsCovered` auf `OrchestratorContext` (siehe D4-Kontext unten — kein Orchestrator-Zweig liest sie mehr).

Bleiben als Bausteine, die `resolveTurnLifecycle` aufruft: `hasStepInStatus`, `closingProbeAlreadyAsked`, `closingProbeAnswerReceived`, `shouldInjectClosingProbe`, `hasUnexhaustedStep`, `computeFocusLock`, `updateODrought`, `hasNewStepThisTurn`.

---

## Consequences

**Positiv:**
- BUG-6/H-3 ist tatsächlich eingelöst: der Abschluss fällt im selben Turn, in dem die aufgelöste Phase `closing` erreicht und die Closing-Sequenz konvergiert ist. Buchhalter Turn 16 verliert seinen Leerlauf, H-2 einen seiner drei Verabschiedungs-Turns.
- Eine Wahrheitsquelle für Phase + Terminierung; die verlustbehaftete Doppelung und der tote `'completed'`-Zweig sind weg. Entspricht dem Deep-Module-Leitprinzip von PROJ-44.
- Der Regressionstest prüft jetzt die **Phasen**frische (nicht die Briefing-Frische wie der Runde-1-Test, der H-3 nicht abdeckte).

**Negativ / Trade-off:**
- Vertragsänderung: `runInterviewTurn` und die betroffenen Unit-Tests werden auf den einen Aufruf umgestellt. Der Eval-Runner ist nicht betroffen (liest `meta.phase`/`meta.completed`, nicht die Orchestrator-Signatur direkt).
- Die Reentry-Completion nutzt die bereits gestellte Sonde aus dem ersten Closing-Besuch, statt sie neu zu stellen. Das ist gewollt (vermeidet die wortgleiche Sonden-Wiederholung BUG-4) und liegt in PROJ-44s Scope; die inhaltliche Verfeinerung der Sonde nach Late Discovery bleibt PROJ-46 (BUG-4).

**Nicht Teil dieser Entscheidung:** die restlichen H-2-Schichten außer der Invariante D2 (Analyst-Terminierungs-Hoheit → PROJ-46), M-6/M-7/L-1 (Talker-Prompt/Briefing → PROJ-46), das Eval-Gate-Instrument (Nenner-Effekt, `dependency_capture`/Cards-Zugehörigkeit → PROJ-40/neu).

---

## Alternatives Considered

1. **Nur umsortieren (`checkLifecycle` nach `decideNextPhase` ziehen).** Verworfen: konserviert die Doppelung von Timer- und Abschluss-Logik in zwei Funktionen und den toten `'completed'`-Zweig. Behebt H-3 nur symptomatisch.
2. **`checkLifecycle` mit der aufgelösten Phase aufrufen (statt `ctx.phase`), Funktionen getrennt lassen.** Verworfen aus demselben Grund: die zwei Wahrheitsquellen bleiben, künftige Änderungen müssen weiter an zwei Stellen synchron gehalten werden.
3. **Freshness-Signal in `checkLifecycle` (ADR-019, Proposed).** Bereits von ADR-021 überholt; adressiert Tracker/Briefing-Staleness, nicht die Phasen-Doppelung.
