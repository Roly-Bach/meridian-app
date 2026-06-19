# PROJ-35: interviewAgent.ts entkernen (Conversation-Signals-Modul + server-only-Naht)

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** M (3–5d)
**Bugs:** 0:0:0
**Created:** 2026-06-19
**Last Updated:** 2026-06-19 (QA passed via /qa PROJ-35 — production-ready, 0:0:0)
**Architecture:** ADR-017 (interviewAgent.ts Zerlegung entlang der server-only-Naht)

## Dependencies
- Requires: PROJ-22 (Dual-Loop Interview Engine) — Talker, Analyst, Orchestrator und Quick-Extract sind die Konsumenten, deren Importe migriert werden
- Related: PROJ-33 (Turn-Loop-Konsolidierung) / ADR-016 — `runInterviewTurn` ist einer der migrierten Konsumenten; dieselbe Deepening-Etappe
- Related: ADR-015 (Slot-Write-Trail), ADR-009 (Kontext-Architektur, static/dynamic Prompt) — werden berührt aber nicht neu entschieden

## Context

`src/services/interviewAgent.ts` ist mit **1948 LOC und ~20 Exporten** ein Sammel-Modul, das fünf unzusammenhängende Verantwortungen mischt:

1. **Re-Export-Hub** der `interviewSemantic`-Primitiven (Z. 38–54) — reiner Durchreicher, damit alte Aufrufer weiter aus `interviewAgent` importieren.
2. **Interaktions-Typen** (`InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`).
3. **Reine Conversation-Signals** (`detect*`/`compute*`-Heuristiken, Z. 399–981) — Text → Verhaltenssignal.
4. **Prompt-Assemblierung** (`buildDynamicContext` + Format-Cluster).
5. **Server-gebundene Agent-Konstruktion** (`buildTools` mit Supabase-Schreib-Seiteneffekten, `createInterviewStream`).

Der Architektur-Review 2026-06-18 (`/improve-codebase-architecture`) markierte dazu zwei Deepening-Befunde, die zusammen PROJ-35 bilden:

- **Befund #2 (conversation-signals):** Neun reine Detektoren sind **einzeln exportiert**, einziger Prod-Konsument ist `buildDynamicContext` in derselben Datei. Sie wurden für Testbarkeit extrahiert — aber das reale Verhalten, *wie die Signale sich zur adaptiven Talker-Anweisung kombinieren*, hat **keine Locality und keine einzelne Test-Oberfläche.** Das Interface ist fast so breit wie die Implementierung → shallow & wide (`codebase-design`).
- **Befund #3 (Re-Export-Hub):** `interviewAgent` agiert als Re-Export-Hub vermischt mit echter Logik.

Die einzige **echte Naht** im Code ist die **`server-only`-Grenze.** Die Blöcke (2), (3) und die Typen sind pur; sie sitzen nur hinter der `supabase-admin`-Kette (`import 'server-only'` via `buildTools`), weil sie in der falschen Datei wohnen. `interviewSemantic.ts` existiert genau für diese pure Seite (sein Header sagt das). Folge der Fehlplatzierung: vier **Client-Komponenten** (`'use client'`: `page.tsx`, `ChatInterface`, `ClarificationCards`, `ClarificationView`) importieren `ClarificationCard` type-only aus einem `server-only`-Modul — tragfähig allein durch Compile-Zeit-Typ-Löschung, brüchig.

Architektur-Entscheidungen im Detail: **ADR-017.** Designprinzipien: `/codebase-design` (deep modules).

## Scope

### Zerlegung entlang der server-only-Naht — Ziel-Modulkarte

| Modul | rein? | Inhalt |
|---|---|---|
| `conversationSignals.ts` (neu) | ✅ | `analyzeConversationSignals(ctx, briefing) → Signals` als **einziger** Eintrittspunkt; `Signals`-Typ; `extractNumericTokens` (geteilte Util). Detektoren **privat**. |
| `talkerPrompt.ts` (neu) | ✅ | `buildDynamicContext` + Format-Cluster + Talker-`STATIC_PROMPT`. Ruft `analyzeConversationSignals`, **rendert** nur (Trennung Detektion/Rendering). |
| `interviewTypes.ts` (neu) | ✅ | `InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`. |
| `interviewSemantic.ts` (+) | ✅ | `+ computeMissingMandatorySlots`, `+ computeWalkthroughSlotTarget`, `+ MissingSlot`. |
| `interviewTalker.ts` (+) | ❌ | `+ detectNumberAnchoring`, `+ detectFillerPhrases` (Output-Guards, neben `onFinish`). |
| `interviewAgent.ts` (verschlankt) | ❌ server-only | `buildTools` (+ Tool-Helfer `findStepFuzzy`/`findStepById`/`normalizeStepTitleForDedup`/`extractSentenceAroundSpan` — letzteres **privat** statt exportiert), `createInterviewStream`, `buildStaticPrompt`. |

### conversation-signals als tiefes Modul (#2)

`analyzeConversationSignals(ctx, briefing) → Signals` wird der **einzige** öffentliche Eintrittspunkt. Die sieben Detektoren (`detectDrillStops`, `detectPersonaRefuse`, `detectAmbiguity`, `detectException`, `wasRecentlyRecontextualized`, `detectBlockade`, `computeLadderingStreak`) und ihre Regex-Tabellen (`DRILL_PATTERNS`, `REFUSE_PATTERNS`, …) werden **privat** (interne Nähte). Interface schrumpft **9 → 1**. `buildDynamicContext` ruft künftig `analyzeConversationSignals` und rendert die `Signals`-Felder in Prompt-Abschnitte.

### Re-Export-Hub verworfen, Konsumenten migriert (#3)

Ein reiner Durchreicher ist per Löschtest flach. **Kein Dauer-Shim.** Stattdessen werden alle ~18 Konsumenten auf die echten Pfade umgestellt (`interviewSemantic` / `interviewTypes` / `talkerPrompt`), und der Re-Export-Block (Z. 38–54) entfällt. `interviewAgent.ts` behält nur seinen server-gebundenen Kern.

### Output-Guards zu ihrem Konsumenten

`detectNumberAnchoring` und `detectFillerPhrases` operieren auf dem **generierten** Talker-Text (post-hoc im `onFinish`) und wandern nach `interviewTalker.ts`, neben ihren einzigen Aufrufer. `extractNumericTokens` bleibt als geteilte Util in `conversationSignals` (genutzt von `analyzeConversationSignals` intern + dem Talker-Guard).

### Tests: replace, don't layer

- `conversationSignals.test.ts` (neu): die ~80 Detektor-Fälle werden auf die `analyzeConversationSignals`-Oberfläche umgeschrieben — Assertions auf `Signals`-Felder (`signals.drillWarnings`, `signals.ambiguity`, …) statt auf Einzel-Detektor-Aufrufe.
- `interviewSemantic.test.ts` (neu — existiert noch nicht): die drei Slot-Compute-`describe`-Blöcke.
- `interviewAgent.test.ts` (schrumpft): behält die Tool-Handler-Tests (`buildTools` bleibt).
- Output-Guard-Tests wandern mit ihren Funktionen zum Talker.

## User Stories

- Als **Entwickler** möchte ich die Conversation-Signals an einer Oberfläche (`analyzeConversationSignals`) testen, die die Komposition prüft — nicht neun Detektoren einzeln, die am realen Verhalten vorbei testen.
- Als **Entwickler** möchte ich den Talker-Prompt-Bau ohne `supabase`-Kette testen können, damit reine Logik nicht hinter `server-only` gefangen ist.
- Als **Entwickler** möchte ich, dass Client-Komponenten ihre Typen aus einem garantiert server-only-freien Modul beziehen, damit der Abhängigkeitsgraph ehrlich ist und kein versehentlicher Wert-Import das Client-Bundle bricht.
- Als **Entwickler** möchte ich Turn-Logik in `interviewAgent.ts` nicht mehr zwischen Prompt-Bau, Signalen, Typen und Tool-Konstruktion suchen müssen, sondern jede Verantwortung in ihrem eigenen Modul finden.
- Als **KI-Berater / Eval-Nutzer** möchte ich, dass diese Umstrukturierung das Interview-Verhalten **nicht** verändert, damit Modellvergleiche über die Umstellung hinweg gültig bleiben.

## Acceptance Criteria

- [x] `src/services/conversationSignals.ts` existiert mit `analyzeConversationSignals(ctx: InterviewContext, briefing?: AnalystBriefing | null): Signals` als einzigem öffentlichen Funktions-Export (plus `Signals`-Typ und `extractNumericTokens`); die sieben Detektoren sind **nicht** exportiert.
- [x] `src/services/talkerPrompt.ts` existiert und enthält `buildDynamicContext` + Format-Cluster + die Talker-`STATIC_PROMPT`; es ruft `analyzeConversationSignals` und enthält **keine** Detektor-Logik mehr.
- [x] `src/services/interviewTypes.ts` existiert mit `InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`.
- [x] `computeMissingMandatorySlots`, `computeWalkthroughSlotTarget` und `MissingSlot` liegen in `interviewSemantic.ts`.
- [x] `detectNumberAnchoring` und `detectFillerPhrases` liegen in `interviewTalker.ts`; `interviewTalker` importiert `buildDynamicContext` aus `talkerPrompt` und `extractNumericTokens` aus `conversationSignals`.
- [x] `interviewAgent.ts` enthält **keinen** Re-Export-Block für `interviewSemantic`-Primitiven mehr und exportiert nur noch `buildTools`, `createInterviewStream` (+ `AgentStreamOptions`-Typ); `buildStaticPrompt` bleibt als modulinterne Funktion (war auch im Original nicht exportiert); `extractSentenceAroundSpan` ist privat.
- [x] Alle ~18 Konsumenten importieren aus den echten Modulen (kein Import aus `interviewAgent` außer `buildTools` durch Analyst/Quick-Extract und `createInterviewStream` durch start/reconnect-Routes).
- [x] Keine `'use client'`-Komponente importiert mehr aus `interviewAgent` (oder einem anderen `server-only`-Modul).
- [x] Detektor-Logik, Regex-Tabellen und Prompt-Text sind **unverändert** (Diff zeigt nur Verschiebung + Sichtbarkeitswechsel + Signals-Bündelung, keine Logik-Edits) — per `diff` gegen HEAD byte-identisch für Regex-Tabellen, `STATIC_PROMPT`, `buildPhaseMethodology`, `WALKTHROUGH_EXAMPLES`, `SLOT_PROMPT_HINT`; in `buildDynamicContext` nur Signal-Quelle `inline → s.<feld>`.
- [x] `conversationSignals.test.ts` prüft die `analyzeConversationSignals`-Oberfläche; `interviewSemantic.test.ts` deckt die Slot-Compute-Funktionen; `interviewAgent.test.ts` behält die Tool-Handler-Tests. Output-Guard-Tests in `interviewTalker.test.ts`.
- [x] **Gate:** `npm run lint` (`tsc --noEmit`) und `npm test` grün (46 Files, 613 passed / 1 skipped). Zusätzlich `npm run build` ✓ Compiled successfully.
- [x] **Sanity (non-gating):** `npm run eval:interview buchhalter` nach der Umstellung gefahren (2026-06-19, interview_id `1b3a04c1…`, INTERVIEW_MODEL=google/gemini-3.5-flash). Strukturelles Slot-/Extraktionsverhalten identisch zu allen Baseline-Läufen (06:18/08:52/09:47), **kein Regress durch den Refactor**. Der automatische FAIL-Score wird ausschließlich durch das vorbestehende Slot-String-Kodierungs-Artefakt getrieben (`schema_conformance_rate 0`), das über alle Läufe konstant ist und nicht von dieser Naht berührt wird (Out-of-Scope-Block: Qualität → PROJ-28/29/30). Report: `docs/evals/interview/2026-06-19/2026-06-19-19-43-02-google-gemini-3-5-flash-buchhalter.md`.

## Edge Cases

- **`analyzeConversationSignals` mit leerem Verlauf:** Erst-Turn ohne `recentAssistantTurns`/`lastUserTurn` → alle `Signals`-Felder im Leer-Default (keine Warnings, `ambiguity: null`, `ladderingStreak: 0`), identisch zum heutigen Inline-Verhalten.
- **`anchorNumbers` ohne Briefing:** Kein `briefing.suggested_question` → `extractNumericTokens('')` → `[]`; kein Anker-Abschnitt im Prompt (wie heute).
- **Geteilte Util `extractNumericTokens`:** wird von zwei Modulen importiert (`conversationSignals` intern + `interviewTalker`-Guard) — ein echter, zweifach genutzter Primitiv, kein toter Export.
- **Type-only-Importe in Client-Komponenten:** Nach der Migration ziehen `ClarificationCard`-Importe `interviewTypes` (rein) statt `interviewAgent` (server-only) — funktioniert nicht mehr nur durch Typ-Löschung, sondern korrekt.
- **`buildStaticPrompt` vs. Talker-`STATIC_PROMPT`:** Beide bleiben getrennt bestehen (Drift wird hier **nicht** behoben → PROJ-37). `buildStaticPrompt` bleibt mit `createInterviewStream` in `interviewAgent`; `STATIC_PROMPT` wandert mit `buildDynamicContext` nach `talkerPrompt`.
- **Import-Zyklen:** `interviewTypes` importiert `MissingSlot`/`RawExtraction` type-only; `talkerPrompt` importiert `conversationSignals` + `interviewTypes` + `interviewSemantic`. Reihenfolge azyklisch — vor Merge mit `tsc` verifizieren.

## Technical Requirements

- **Service-Layer-Constraint (INDEX Architecture Notes):** alle vier neuen/erweiterten Module liegen in `src/services/`.
- **Reinheit garantiert:** `conversationSignals.ts`, `talkerPrompt.ts`, `interviewTypes.ts` importieren **keine** `server-only`-Kette (kein `supabase-admin`, kein `next/server`) — prüfbar per Import-Scan.
- **Verhaltensneutral:** keine Änderung an Detektor-Logik, Regex, Schwellen oder Prompt-Wortlaut. conversation-signals ist eine **Interface-Vertiefung (9→1)**, keine Logikänderung.
- **Keine DB-Migration, kein Schema-, kein UI-Verhaltens-Change.**
- **Verifikation:** Gate = `tsc` + Unit-Suite; Sanity = ein buchhalter-Eval-Lauf (non-gating).

## Out of Scope

- **`buildTools`-Internas (→ PROJ-34, Roadmap).** `buildTools` wird nur am Ort belassen, nicht umgebaut. Die DB-Schreib-Seiteneffekte (`record_slot` u.a.), Schreib-Absichten und der TurnStore-Port bleiben PROJ-34. Begründung: ADR-016 + ADR-017.
- **Static-Prompt-Drift (→ PROJ-37, Roadmap).** `STATIC_PROMPT` (Talker) und `buildStaticPrompt()` (Greeting/Reconnect) sind inhaltlich auseinandergelaufen; hier werden sie nur verschoben, nicht konsolidiert.
- **`createInterviewStream` / Greeting-Path konsolidieren:** eigener Endpunkt, eigene Interaktion; bleibt in `interviewAgent`.
- **Verhaltens-/Qualitätsverbesserung des Interviews** (hallucination_rate, coverage): separate Features (PROJ-28/29/30), nicht diese Naht.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design

### conversation-signals Schnittstelle

```ts
// conversationSignals.ts — rein, server-only-frei
export interface Signals {
  anchorNumbers: string[]           // aus briefing.suggested_question (Anker-Sperre)
  drillWarnings: string[]           // ex detectDrillStops
  ambiguity: AmbiguityResult        // ex detectAmbiguity ({ phraseA, phraseB } | null)
  exception: boolean                // ex detectException
  recentlyRecontextualized: boolean // ex wasRecentlyRecontextualized
  ladderingStreak: number           // ex computeLadderingStreak
  blockade: boolean                 // ex detectBlockade
}

export function analyzeConversationSignals(
  ctx: InterviewContext,
  briefing?: AnalystBriefing | null,
): Signals

export function extractNumericTokens(text: string): string[]   // geteilte Util

// privat (interne Nähte, getestet durch analyzeConversationSignals):
// detectDrillStops, detectPersonaRefuse, detectAmbiguity, detectException,
// wasRecentlyRecontextualized, detectBlockade, computeLadderingStreak,
// DRILL_PATTERNS, REFUSE_PATTERNS, …
```

`buildDynamicContext` (in `talkerPrompt.ts`) wird:

```ts
const s = analyzeConversationSignals(ctx, briefing)
// … rendert s.drillWarnings → DRILL-STOP-Abschnitt, s.ambiguity → AMBIGUITÄT-Abschnitt,
//    s.ladderingStreak/s.blockade → LADDERING-Abschnitt, s.anchorNumbers → ANKER-SPERRE, …
```

### Import-Migration (Auszug der ~18 Konsumenten)

| Symbol | von | nach |
|---|---|---|
| `ClarificationCard`, `AnalystBriefing`, `InterviewContext`, `TurnMessage` | `interviewAgent` | `interviewTypes` |
| `computeMissingMandatorySlots`, `MissingSlot`, `MANDATORY_SLOTS`, `POTENZIAL_SLOT_NAMES`, `groupSemanticSteps`, `Phase`, `StepEntry`, … | `interviewAgent` (Re-Export) | `interviewSemantic` |
| `buildDynamicContext` | `interviewAgent` | `talkerPrompt` |
| `detectNumberAnchoring`, `detectFillerPhrases` | `interviewAgent` | lokal in `interviewTalker` |
| `buildTools` | `interviewAgent` | `interviewAgent` (bleibt) |
| `createInterviewStream` | `interviewAgent` | `interviewAgent` (bleibt) |

### Reihenfolge (risikoarm, jeder Schritt grün haltbar)

1. `interviewTypes.ts` anlegen, Typen verschieben, Konsumenten umstellen → `tsc`/Tests grün.
2. Slot-Compute + `MissingSlot` nach `interviewSemantic.ts`, Konsumenten umstellen → grün.
3. `conversationSignals.ts`: Detektoren verschieben, `analyzeConversationSignals` + `Signals` bilden, Detektoren privat; Tests auf die Oberfläche umschreiben → grün.
4. `talkerPrompt.ts`: `buildDynamicContext` + Cluster + `STATIC_PROMPT` verschieben, auf `analyzeConversationSignals` umstellen; `interviewTalker` umstellen → grün.
5. Output-Guards in `interviewTalker` ziehen → grün.
6. Re-Export-Block + tote Exporte aus `interviewAgent` entfernen, `extractSentenceAroundSpan` privat → `tsc` + volle Suite grün.
7. buchhalter-Eval-Sanity.

### Test-Strategie (replace, don't layer)

- `conversationSignals.test.ts`: ~80 Fälle → `analyzeConversationSignals(ctx, briefing)` aufrufen, auf `Signals`-Felder asserten (Lokalisierung bleibt pro Feld erhalten).
- `interviewSemantic.test.ts`: Slot-Compute-Blöcke (heute in `interviewAgent.test.ts`).
- `interviewAgent.test.ts`: nur noch Tool-Handler (`register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `record_dependency`).

## Implementation Notes (2026-06-19, /build PROJ-35)

Umgesetzt entlang der 7-Schritt-Sequenz. `interviewAgent.ts` 1948 → 1071 LOC. Neue Module: `conversationSignals.ts` (328), `talkerPrompt.ts` (452), `interviewTypes.ts` (63). Neue Tests: `conversationSignals.test.ts`, `interviewSemantic.test.ts`, `interviewTalker.test.ts`.

Abweichungen / Befunde aus dem Architect-Review (alle verhaltensneutral gelöst):
- **D1 (blockade):** `buildDynamicContext` berechnete zwei Blockade-Werte. `Signals.blockade ← detectBlockade(ctx.lastUserTurn)` (= altes `currentBlockade`), `Signals.ladderingStreak ← computeLadderingStreak(...)` getrennt. Der 3-Wege-Render-Zweig bleibt strukturgleich.
- **D2 (createInterviewStream):** zusätzlicher, in Spec/ADR nicht gelisteter `buildDynamicContext`-Konsument. `interviewAgent` importiert `buildDynamicContext` jetzt aus `talkerPrompt`; bleibt azyklisch.
- **D3 / Test-Coverage:** Beim Verschieben der Detektoren wurden zunächst 13 `detectDrillStops`/`detectPersonaRefuse`-`it()` versehentlich gedroppt; wiederhergestellt als `drillWarnings`-Tests über die `analyzeConversationSignals`-Oberfläche (F1b-Refuse-Pfad über Threshold-Absenkung). `it()`-Summe 103 = 100 (HEAD) + 3 neu (Empty-History-Default, anchorNumbers).
- **`buildStaticPrompt`** war auch im Original nicht exportiert — bleibt modulinterne Funktion in `interviewAgent` (kein Merge mit Talker-`STATIC_PROMPT` → PROJ-37).

Verbatim-Neutralität per `diff` gegen HEAD bestätigt (Regex-Tabellen, `STATIC_PROMPT`, `buildPhaseMethodology`, `WALKTHROUGH_EXAMPLES`, `SLOT_PROMPT_HINT` byte-identisch).

Verifikation: `tsc --noEmit` grün, `npm test` 613 passed / 1 skipped, `npm run build` ✓. Reviewer (5 Korrektheitspunkte) pass. Hinweis: Cross-Vendor-Review (Aider/Gemini) war in der Umgebung nicht aufrufbar — Review erfolgte Claude-seitig per Diff-Analyse.

buchhalter-Eval-Sanity erledigt (2026-06-19, kein Regress — siehe AC-Liste). Offen: QA (`/qa PROJ-35`) als Gate für Status=Approved.

## QA Test Results (2026-06-19, /qa PROJ-35)

**Verdict: PRODUCTION-READY** — 0 Critical / 0 High / 0 Medium / 0 Low (`0:0:0`).

### Gates (unabhängig nachgefahren auf aktuellem Branch-Stand)
| Gate | Ergebnis |
|------|----------|
| `npm run lint` (`tsc --noEmit`) | ✓ keine Fehler |
| `npm test` (Vitest) | ✓ 46 Files, 613 passed / 1 skipped |
| `npm run build` | ✓ Compiled successfully |

### Acceptance Criteria — 11/11 erfüllt (strukturell verifiziert)
- `conversationSignals.ts` exportiert nur `Signals`, `AmbiguityResult`, `extractNumericTokens`, `analyzeConversationSignals`; die 7 Detektoren sind nicht exportiert (Interface 9→1 bestätigt per `grep`).
- `talkerPrompt.ts`: `STATIC_PROMPT` + `buildDynamicContext` vorhanden, keine Detektor-Logik.
- `interviewTypes.ts`: genau `InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`.
- `interviewAgent.ts`: nur `buildTools`, `createInterviewStream`, `AgentStreamOptions` exportiert; kein Re-Export-Block.
- Importer-Scan: `interviewAgent` wird nur noch importiert von start/reconnect-Routes (`createInterviewStream`) und Analyst/Quick-Extract (`buildTools`) — exakt wie spezifiziert.
- Verbatim-Neutralität: per Build-Zeit-Diff bereits byte-bestätigt (Implementation Notes).

### Security Audit (Red-Team, fokussiert auf die server-only-Naht)
Das adressierte Risiko war: vier `'use client'`-Komponenten importierten `ClarificationCard` aus dem `server-only`-Modul `interviewAgent`, tragfähig nur durch Compile-Zeit-Typ-Löschung.
- **Verifiziert behoben:** `page.tsx`, `ChatInterface.tsx`, `ClarificationCards.tsx`, `ClarificationView.tsx` importieren `ClarificationCard` jetzt `type`-only aus dem reinen `interviewTypes`.
- **Kein Leak:** kein `'use client'`-File importiert `interviewAgent` oder `supabase-admin` (Scan = none). Server-only-Werte können nicht ins Client-Bundle gelangen.
- **Keine neue Angriffsfläche:** keine neuen Routes, kein Auth-/RLS-Change, keine neuen Env-Vars, keine DB-Migration.

### Regression
Volle Unit-/Integrations-Suite grün, inkl. der im Refactor umgeschriebenen Tests (`conversationSignals.test.ts`, `interviewSemantic.test.ts`, `interviewTalker.test.ts`) und der Tool-Handler-Tests in `interviewAgent.test.ts`. Eval-Sanity (buchhalter) ohne Regress (siehe AC-Liste).

### E2E
N/A — die ACs sind strukturell (Modulgrenzen, Sichtbarkeit, Import-Pfade), kein neues nutzersichtbares Verhalten. Playwright-Tests würden nichts Neues abdecken; die Unit-Suite ist die Regressionsabdeckung dieser Naht.

### Abgrenzung (kein PROJ-35-Bug)
Der Eval-Lauf 2026-06-19 zeigte ein Slot-Serialisierungs-Artefakt (O-Slots als JSON-Strings statt Objekte in `step_tracker`). Das ist ein **vorbestehender, branchunabhängiger** Zustand (konsistent über alle Baseline-Läufe) und liegt im `buildTools`/`record_slot`-Schreibpfad — explizit Out of Scope (→ PROJ-34 bzw. Qualität PROJ-28/29/30). Wird in einem konsolidierten Härtungs-PROJ (geplant PROJ-38) erfasst, zählt nicht gegen PROJ-35.

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
