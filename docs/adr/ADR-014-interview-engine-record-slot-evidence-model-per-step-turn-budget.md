# ADR-014: Interview Engine — record_slot Evidence Model + Per-Step Turn Budget

**Status:** Proposed (2026-06-03)  
**Author:** Bendewar Newroly  
**Repository:** meridian-app  
**Supersedes:** —  
**Related:** ADR-011 (Dual-Loop Architektur), PROJ-22 Eval-Befunde B6/B7/B8

---

## Context

Eval-Run 2026-06-03 (buchhalter, gemini-3.5-flash) erreichte PASS, deckte aber drei strukturelle Defekte auf, die sich durch weitere Prompt-Patches **nicht** beheben lassen:

### Defekt 1 — Analyst als Dual-Role ohne Modus (→ B6, B8)

`interviewAnalyst` erfüllt zwei semantisch unterschiedliche Aufgaben im selben Prompt:

- **Online-Extraction:** record_slot aus aktuellem User-Turn
- **Catch-up-Extraction:** Batch-Fill aus historischem Kontext (z.B. Turn 20 füllt 6 Slots aus Turns 3–12)

`tool_call_plausibility`-Scorer prüft `evidence_quote` gegen `user_input` desselben Turns. Catch-up-Quotes passen strukturell nie — Score=0.16 bei Ziel ≥0.95. Gleichzeitig nutzt Analyst `update_walkthrough_data.friction_tools` und `record_slot(data_sources)` als parallele Schreibpfade auf semantisch gleiche Information → non-deterministisches Ergebnis, `data_sources=null` trotz expliziter Nennungen in 8 Turns.

### Defekt 2 — Kein Per-Step Turn-Budget (→ B7)

Orchestrator hat kein globales Turn-Budget-Modell. Talker bohrte 17 von 25 Turns in Monatsabschluss (SAP-Transaktionscodes, SVERWEIS-Formeln — laut Methodik verboten). Rechnungsprüfung wurde erst Turn 18 gestartet, Turn 22 registered — Escape Valve feuerte Turn 21 → wrap_up vor Walkthrough-Abschluss.

Fix 3 (walkthroughHasContent threshold 1→2 Slots) verlängerte walkthrough_step-Phase weiter — Overfix gegen theoretisches Problem, verstärkte Depth-First-Starvation.

### Defekt 3 — Phase-State-Machine ohne Invarianten (→ B7 verschärfend)

farewell-escape (`hl≥40`) und walkthrough-exit-Logik teilen `hl` als Trigger ohne gegenseitige Kenntnis. Keine globale Invariante: "wenn farewell-escape bei hl=40 feuert, muss bis hl=36 mindestens (expectedSteps−1) Steps gestartet sein." Verletzungen bleiben unentdeckt bis Eval-Regression.

---

## Decision

### 1. record_slot Tool-Schema-Erweiterung

`record_slot` bekommt optionales Feld `source_turn: number` — der 1-indexed Turn aus dem die Evidence stammt.

```typescript
// Tool-Schema-Erweiterung (interviewAnalyst.ts)
{
  name: "record_slot",
  parameters: {
    step_id: z.string(),
    slot: SlotEnum,
    value: z.unknown(),
    evidence_quote: z.string(),
    source_turn: z.number().int().positive().optional(), // NEU
  }
}
```

**Scorer-Update** (`tool_call_plausibility.ts`): Wenn `source_turn` gesetzt → prüfe `evidence_quote` gegen `transcript[source_turn - 1].user_input`. Wenn nicht gesetzt → bisherige Logik (current turn), Score-Penalty optional.

**Analyst-Prompt-Ergänzung:** Bei Catch-up-Extraction aus historischem Kontext immer `source_turn` mitliefern. Online-Extraction: `source_turn` = aktueller Turn.

### 2. Parallele Schreibpfade konsolidieren

`data_sources`-Slot wird nicht mehr über `update_walkthrough_data.friction_tools` geschrieben. Einziger Pfad: `record_slot(data_sources, [...], source_turn=N)`.

`update_walkthrough_data` behält `friction_tools` als separates Feld für Talker-Kontext (kein Scorer-Overlap).

### 3. Per-Step Turn-Budget im Orchestrator

```typescript
// interviewOrchestrator.ts
function computeStepBudget(state: OrchestratorState): number {
  const expectedSteps = state.topics.length || 2;
  const reserveTurns = 5; // farewell + coverage_check buffer
  const remainingBudget = MAX_TURNS - state.historyLength - reserveTurns;
  const remainingSteps = expectedSteps - state.completedSteps;
  return Math.floor(remainingBudget / Math.max(remainingSteps, 1));
}
```

Im `phaseDecider`: wenn `currentStep.turns_used >= computeStepBudget(state)` → harter Push zu nächstem Step via `switch_topic`, **unabhängig von Slot-Completion-Status**. Slot-Backfill passiert in `slot_completion`-Phase.

**Fix 3 revertieren:** `walkthroughHasContent`-Threshold zurück zu `any slot !== null`. `process_steps?.length >= 2` als Zusatz-Bedingung bleibt (war orthogonal korrekt).

### 4. Deterministic Forbidden-Question Guard

Regex-basierter Filter im Talker-Output-Layer — kein Prompt-Patch:

```typescript
const FORBIDDEN_PATTERNS = [
  /Transaktionscode/i,
  /\b[A-Z]{2,4}\d{3,}/,   // SAP T-Codes: FBL3N, S_ALR_87012277, F150
  /SVERWEIS|VLOOKUP/i,
  /\bFormel\b.*\bExcel\b/i,
];

function hasForbiddenQuestion(agentOutput: string): boolean {
  return FORBIDDEN_PATTERNS.some(p => p.test(agentOutput));
}
// Bei match → re-prompt Talker mit injiziertem Constraint, max 1 Retry
```

### 5. Phase-Invarianten als Assertions + Property-Tests

Pre-condition Assertions bei State-Transitions im Orchestrator:

```typescript
function assertPhaseInvariants(state: OrchestratorState) {
  const hl = state.historyLength;
  if (hl >= FAREWELL_THRESHOLD - 4) {
    const startedSteps = state.steps.filter(s => s.status !== "pending").length;
    const expectedMin = Math.max(state.topics.length - 1, 1);
    if (startedSteps < expectedMin) {
      log.warn("INVARIANT_VIOLATION: farewell approaching, steps under-started", { hl, startedSteps, expectedMin });
      // force-transition: skip current depth-drill, switch_topic
    }
  }
}
```

Property-Tests (`interviewOrchestrator.test.ts`): Fast-check-style über State-Sequenzen — "für beliebige topic-Listen gilt: farewell-escape feuert nie bevor alle Topics mindestens einen walkthrough_step gestartet haben, wenn Budget ≥ 2*topics.length + reserveTurns."

---

## Consequences

**Positiv:**
- B6 (tool_call_plausibility) strukturell behoben — Scorer und Analyst teilen dasselbe Datenmodell
- B7 (Depth-First-Starvation) deterministisch verhindert, kein Prompt-Tweak nötig
- B8 (data_sources null) durch Single-Schreibpfad eliminiert
- Forbidden-Question-Guard macht Methodik-Verletzungen im CI sichtbar
- Prompt-Patches als Architektur-Pattern abgelöst — neue Bugs werden in Tests aufgedeckt, nicht in Eval-Runs

**Negativ:**
- `record_slot`-Tool-Schema-Änderung erfordert Analyst-Prompt-Update + Scorer-Update + Typ-Anpassung → koordinierter Rollout
- Per-Step Budget-Berechnung ist deterministisch aber starr — bei untypisch langen Personas (>5 Steps) kann Budget zu knapp werden; Fallback: `minTurnsPerStep = 3` als Floor
- Fix 3 revertieren trägt kurzfristiges Regressions-Risiko; Coverage via Unit-Test vor Revert sicherstellen

**Folgeentscheidungen:**
- Property-Tests für Orchestrator-State-Machine → Eval-Corpus als Ground-Truth für Regression-Erkennung (ADR-015 kandidat)
- Forbidden-Pattern-Liste als konfigurierbare Persona-spezifische Regel (falls andere Personas andere Verbote brauchen)

---

## Implementation Order

1. `record_slot.source_turn` + Scorer-Update (½ Tag) — Metrik-Integrität zuerst
2. Fix 3 revertieren + `computeStepBudget` im Orchestrator (1 Tag)
3. `data_sources` Single-Schreibpfad (2h)
4. Forbidden-Question-Guard (½ Tag)
5. Phase-Invarianten + Property-Tests (1 Tag)
