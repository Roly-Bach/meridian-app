# ADR-019: Dual-Loop Snapshot-Freshness-Vertrag — Completion-Decision ohne Reason-Branch-Wachstum

**Status:** Proposed (2026-06-29)
**Author:** Bendewar Newroly
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Dritter Bug derselben Klasse (KI-12, KI-14, KI-15) in `checkLifecycle()` / `runInterviewTurn.ts`. Jeder Fix hat einen weiteren ad-hoc Reason-Branch bzw. Guard ergänzt statt die zugrunde liegende Snapshot-Staleness strukturell zu lösen.
**Ergänzt:** ADR-011 (Dual-Loop-Architektur, D4/D12 Orchestrator-Lifecycle), ADR-016 (Turn-Seam `runInterviewTurn`), ADR-018 (TurnStore-Port). Ersetzt sie nicht.

---

## Context

`checkLifecycle()` in [interviewOrchestrator.ts:353-428](../../src/services/interviewOrchestrator.ts#L353-L428) entscheidet pro Turn, ob das Interview beendet werden darf. Sie tut das auf Basis eines `stepTracker`-Snapshots, der vom **Ende des vorherigen Turns** stammt — der Analyst (ADR-011 D2, asynchron) hat den User-Input des aktuellen Turns zu diesem Zeitpunkt noch nicht gesehen.

Drei dokumentierte Bugs sind exakt diese Staleness, an drei verschiedenen Stellen entdeckt:

- **KI-12** (2026-06-24): Trigger B (`soft_confirm`, wrap_up) komplettierte das Interview, obwohl der User im selben Turn einen neuen, nie explorierten Prozess nannte — der Snapshot kannte den neuen Schritt noch nicht.
- **KI-14** (2026-06-26): Farewell-Loop-Escape-Valve blockierte komplett, wenn `analystSuggestion === null`, weil sie keinen Fall für "Analyst hat noch nichts geliefert" kannte — Talker degenerierte zum Echo.
- **KI-15** (2026-06-27): Dieselbe Farewell-Valve vervollständigte zu früh, weil ein gerade erst registrierter, leerer `exploring`-Step (0/9 Slots) nicht von einem bereits gestarteten Walkthrough-Step unterschieden wurde.

Jeder Fix folgte demselben Muster: neuer Wert im `reason`-Union-Type ([interviewOrchestrator.ts:22](../../src/services/interviewOrchestrator.ts#L22): `'hard_stop' | 'soft_confirm' | 'farewell_pending_analyst' | null`), neuer Guard direkt im `checkLifecycle()`-Körper, und ein korrespondierender Sync-Rerun-Zweig in [runInterviewTurn.ts:218-221](../../src/services/runInterviewTurn.ts#L218-L221), der bei wachsender OR-Bedingung den Analyst synchron nachzieht und `checkLifecycle` neu aufruft.

Das funktioniert, aber es skaliert nicht:

1. **Reason-Branches sind nicht orthogonal.** Trigger A (Hard-Stop), Trigger B (Wrap-up Soft-Confirm) und die Farewell-Valve haben je eigene, teils fast identische Guards (`cards.length === 0`-Check existiert zweimal, Zeile 392 und Zeile 421) — Änderungen müssen an mehreren Stellen synchron nachgezogen werden.
2. **Der Sync-Rerun-Trigger in `runInterviewTurn.ts` ist eine wachsende OR-Bedingung.** Jeder neue Reason, der "Snapshot evtl. stale" bedeutet, muss dort händisch ergänzt werden. Vergisst man das, ist der Bug nicht im Orchestrator sichtbar, sondern produziert erst in der nächsten Eval-Stichprobe ein neues KI-Ticket.
3. **Kein Fixture-Test pro Bug-Klasse.** Die drei Fälle sind nur als Prosa-Kommentare im Code dokumentiert (z.B. Zeile 359-363, 377-388, 396-403), nicht als eigenständige, gegen `resolveCompletionDecision` laufende Testfälle. Ein vierter struktureller Fall würde wieder erst live im Eval auffallen.

**Out of Scope für diese ADR:** PROJ-32 ("Agenten-Architektur — Trennung, Preparator", aktuell *Zurückgestellt*) würde Talker/Analyst/Orchestrator weiter strukturell entkoppeln und könnte die Snapshot-Staleness an der Wurzel lösen. Das ist ein großer Schnitt (Appetite vermutlich L–XL) ohne validierte Notwendigkeit über die drei bekannten Fälle hinaus. Diese ADR entscheidet bewusst für den kleineren, sofort umsetzbaren Schnitt und hält PROJ-32 als Eskalationsstufe vor (siehe D3).

---

## Decision

### D1 — Explizites Freshness-Signal statt impliziter Reason-Branches

`checkLifecycle()` liefert nicht länger einen wachsenden `reason`-String, an dem Caller pattern-matchen müssen, um zu erkennen "hier evtl. stale". Stattdessen liefert die Funktion zwei orthogonale Signale:

```ts
interface LifecycleDecision {
  completionEligible: boolean   // Konversations-Signal: würde das Interview jetzt enden?
  snapshotFresh: boolean        // hat der Analyst den aktuellen User-Turn bereits verarbeitet?
  reason: 'hard_stop' | 'soft_confirm' | 'farewell_loop' | null  // nur noch fürs Logging/Tracing
}
```

`runInterviewTurn.ts` braucht dann keine wachsende OR-Bedingung mehr. Die Regel ist fix: **wenn `completionEligible && !snapshotFresh` → genau ein synchroner Analyst-Rerun, dann `checkLifecycle` erneut.** Neue Trigger-Arten (weitere Reasons) ändern diese Regel nicht — sie müssen nur korrekt `snapshotFresh` setzen.

`snapshotFresh` ist `false` immer dann, wenn der aktuelle `userInput` noch nicht durch einen Analyst-Pass gelaufen ist — unabhängig davon, über welchen Trigger-Pfad (Hard-Stop ausgenommen: Timer-Ablauf braucht keine Snapshot-Frische).

### D2 — `resolveCompletionDecision()` als eigenständiges, testbares Modul

Die drei Guards (Hard-Stop, Farewell-Valve, Soft-Confirm) wandern aus `checkLifecycle()` in eine neue Datei `src/services/completionDecision.ts`. Eingabe ist ausschließlich `OrchestratorContext` + `AnalystBriefing | null` — keine DB, kein LLM-Call. Die Funktion ist pure und exportiert einzeln testbare Sub-Checks (`hasUnstartedExploringStep`, `wrapUpQuestionAlreadyAsked`, Farewell-Marker-Erkennung) statt sie inline in einer 70-Zeilen-Funktion zu verschachteln.

`checkLifecycle()` bleibt als dünner Wrapper in `interviewOrchestrator.ts` erhalten (Caller-Kompatibilität), delegiert aber vollständig an `resolveCompletionDecision()`.

### D3 — Fixture-Korpus pro bekannter Bug-Klasse

Für KI-12, KI-14, KI-15 wird je ein eingefrorener `OrchestratorContext`-Fixture (Snapshot + Briefing-Zustand, der den Bug auslöste) als Regressionstest gegen `resolveCompletionDecision()` hinterlegt — nicht nur als Prosa-Kommentar im Code. Ein vierter struktureller Fall bekommt damit ab Entdeckung sofort einen Fixture statt erst beim nächsten Live-Eval erneut aufzufallen.

**Eskalationskriterium zu PROJ-32:** Taucht nach D1–D3 ein **vierter** unabhängiger Snapshot-Staleness-Bug auf, der sich nicht als weiterer Fixture-Fall in `resolveCompletionDecision()` abbilden lässt (z.B. weil die Staleness nicht mehr binär "fresh/stale" ist, sondern Teilzustände braucht), gilt das als Signal, PROJ-32 zu reaktivieren und die strukturelle Trennung (eigener Preparator-Schritt vor dem Talker) zu prüfen.

### D4 — Keine Vermischung mit KI-18 (Talker-Grounding)

Diese ADR behandelt ausschließlich Lifecycle-/Completion-Entscheidungen (Orchestrator-Ebene). Das Talker-Grounding-Problem (KI-18, `talker_grounding_violations`) ist eine andere Bug-Klasse — Konversationsebene statt Lifecycle-Ebene — und wird separat adressiert (Buffer-then-stream + `talkerGroundingGuard.ts`, bereits in Arbeit). Kein gemeinsamer Fix-Versuch, um die Verifikation beider nicht zu koppeln.

---

## Consequences

**Positiv:**
- Neue Trigger-Arten brauchen keine Änderung an der Sync-Rerun-Bedingung in `runInterviewTurn.ts` mehr — nur korrektes `snapshotFresh`.
- Drei verschachtelte Guards werden zu benannten, einzeln testbaren Funktionen. Reduziert Risiko, dass ein Guard-Fix einen anderen Guard versehentlich bricht (wie KI-15, das auf eine Lücke in KI-14s Fix reagierte).
- Fixture-Korpus macht die drei bekannten Bugs zu Dauer-Regressionsschutz statt Prosa-Dokumentation.
- Kleiner, lokal abgeschlossener Schnitt (Appetite S–M) — kein Risiko einer Mehrwochen-Restrukturierung ohne validierten Bedarf.

**Negativ:**
- Löst die Staleness nicht an der Wurzel (das wäre PROJ-32) — D1-D3 sind ein Kontroll-Refactor um ein akzeptiertes Eventual-Consistency-Modell (ADR-011 D10), nicht dessen Auflösung.
- `snapshotFresh` ist zunächst binär. Reicht für die drei bekannten Fälle; ein Folgefall mit Teilzustand würde D1 erneut erweitern müssen (siehe Eskalationskriterium D3).
- Ein weiterer Layer (`completionDecision.ts`) zusätzlich zu `interviewOrchestrator.ts` — Navigations-Overhead minimal, aber vorhanden.

---

## Umsetzung

| # | Entscheidung | Voraussetzung | Status | Aufwand |
|---|---|---|---|---|
| D1 | Freshness-Signal statt Reason-Branch-Wachstum | — | Proposed | S |
| D2 | `completionDecision.ts` extrahieren | D1 | Proposed | M |
| D3 | Fixture-Korpus KI-12/14/15 | D2 | Proposed | S |
| D4 | Abgrenzung zu KI-18 | — | Proposed | (Konzept) |

---

## Verweise

- ADR-011 (Dual-Loop-Architektur, D4/D12 Lifecycle), ADR-016 (Turn-Seam), ADR-018 (TurnStore-Port — gleiches Seam-Pattern, hier auf Completion-Decision statt Persistenz angewendet)
- `features/INDEX.md` KI-12, KI-14, KI-15, KI-18
- `features/use-case-engine/../PROJ-32` (Zurückgestellt) — Eskalationsziel laut D3
