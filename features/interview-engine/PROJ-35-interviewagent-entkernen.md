# PROJ-35: interviewAgent.ts entkernen (Conversation-Signals-Modul + server-only-Naht)

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** M (3–5d)
**Bugs:** —
**Created:** 2026-06-19
**Last Updated:** 2026-06-19
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

- [ ] `src/services/conversationSignals.ts` existiert mit `analyzeConversationSignals(ctx: InterviewContext, briefing?: AnalystBriefing | null): Signals` als einzigem öffentlichen Funktions-Export (plus `Signals`-Typ und `extractNumericTokens`); die sieben Detektoren sind **nicht** exportiert.
- [ ] `src/services/talkerPrompt.ts` existiert und enthält `buildDynamicContext` + Format-Cluster + die Talker-`STATIC_PROMPT`; es ruft `analyzeConversationSignals` und enthält **keine** Detektor-Logik mehr.
- [ ] `src/services/interviewTypes.ts` existiert mit `InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`.
- [ ] `computeMissingMandatorySlots`, `computeWalkthroughSlotTarget` und `MissingSlot` liegen in `interviewSemantic.ts`.
- [ ] `detectNumberAnchoring` und `detectFillerPhrases` liegen in `interviewTalker.ts`; `interviewTalker` importiert `buildDynamicContext` aus `talkerPrompt` und `extractNumericTokens` aus `conversationSignals`.
- [ ] `interviewAgent.ts` enthält **keinen** Re-Export-Block für `interviewSemantic`-Primitiven mehr und exportiert nur noch `buildTools`, `createInterviewStream`, `buildStaticPrompt`; `extractSentenceAroundSpan` ist privat.
- [ ] Alle ~18 Konsumenten importieren aus den echten Modulen (kein Import aus `interviewAgent` außer `buildTools` durch Analyst/Quick-Extract und `createInterviewStream` durch start/reconnect-Routes).
- [ ] Keine `'use client'`-Komponente importiert mehr aus `interviewAgent` (oder einem anderen `server-only`-Modul).
- [ ] Detektor-Logik, Regex-Tabellen und Prompt-Text sind **unverändert** (Diff zeigt nur Verschiebung + Sichtbarkeitswechsel + Signals-Bündelung, keine Logik-Edits).
- [ ] `conversationSignals.test.ts` prüft die `analyzeConversationSignals`-Oberfläche; `interviewSemantic.test.ts` deckt die Slot-Compute-Funktionen; `interviewAgent.test.ts` behält die Tool-Handler-Tests.
- [ ] **Gate:** `npm run lint` (`tsc --noEmit`) und `npm test` grün.
- [ ] **Sanity (non-gating):** `npm run eval:interview buchhalter` nach der Umstellung, Metrik-Diff gegen die letzte Baseline ohne erkennbaren Regress.

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

## QA Test Results
_To be added by /qa_

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
