# ADR-017: interviewAgent.ts Zerlegung entlang der server-only-Naht

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Solo dev (PROJ-35 Grilling 2026-06-19, `/grill-with-docs` + `/codebase-design`)

---

## Context

`src/services/interviewAgent.ts` (1948 LOC, ~20 Exporte) mischt fünf Verantwortungen:

1. Re-Export der `interviewSemantic`-Primitiven (Kompatibilitäts-Durchreicher).
2. Interaktions-Typen (`InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`).
3. Reine Conversation-Signals (`detect*`/`compute*`-Heuristiken, Z. 399–981).
4. Prompt-Assemblierung (`buildDynamicContext` + Format-Cluster).
5. Server-gebundene Agent-Konstruktion (`buildTools` mit Supabase-Schreib-Seiteneffekten, `createInterviewStream`).

Der Architektur-Review 2026-06-18 (`/improve-codebase-architecture`) fand dazu zwei Deepening-Befunde:

- **#2 (conversation-signals):** Neun reine Detektoren sind einzeln exportiert, einziger Prod-Konsument ist `buildDynamicContext` in derselben Datei. Sie wurden für Testbarkeit extrahiert, aber das reale Verhalten — wie die Signale sich zur adaptiven Talker-Anweisung **kombinieren** — hat keine Locality und keine einzelne Test-Oberfläche. Interface fast so breit wie die Implementierung → shallow & wide.
- **#3 (Re-Export-Hub):** `interviewAgent` agiert als Re-Export-Hub gemischt mit echter Logik.

Die einzige echte Naht im Code ist die **`server-only`-Grenze.** Die Blöcke (2), (3) und die Typen (4) sind pur; sie sitzen nur deshalb hinter der `supabase-admin`-Kette (`import 'server-only'` via `buildTools`), weil sie in der falschen Datei wohnen. `interviewSemantic.ts` ist genau für diese pure Seite gebaut (sein Header sagt das). Client-Komponenten (`'use client'`) importieren `ClarificationCard` type-only aus dem `server-only`-Modul — tragfähig allein durch Typ-Löschung zur Compile-Zeit, brüchig.

## Decision

Zerlegung von `interviewAgent.ts` **entlang der server-only-Naht**. Pure Blöcke ziehen in reine Module, Konsumenten werden migriert. Sechs Entscheidungen (Grilling 2026-06-19):

1. **conversation-signals als tiefes Modul.** Neues `conversationSignals.ts` (rein) mit `analyzeConversationSignals(ctx, briefing) → Signals` als **einzigem** öffentlichen Eintrittspunkt. Die Detektoren (`detectDrillStops`, `detectAmbiguity`, `detectException`, `wasRecentlyRecontextualized`, `detectBlockade`, `computeLadderingStreak`, `detectPersonaRefuse`) werden **privat** (interne Nähte). `extractNumericTokens` bleibt geteilte Util (Konsumenten: `analyzeConversationSignals` intern + Talker-Guard). Interface schrumpft **9 → 1**; Tests treffen die `Signals`-Oberfläche statt einzelner Detektoren.

2. **Prompt-Assemblierung als reines Modul.** Neues `talkerPrompt.ts` (rein): `buildDynamicContext` + Format-Cluster (`sanitizeForPrompt`, `formatStepTracker`, `formatExtractionsLog`, `formatFilledSlotsSnapshot`, `buildPhaseMethodology`, `WALKTHROUGH_EXAMPLES`, `SLOT_PROMPT_HINT`) + Talker-`STATIC_PROMPT`. Es ruft `analyzeConversationSignals` und **rendert** nur — Trennung Detektion/Rendering. Damit ist der Prompt-Bau ohne `supabase`-Kette testbar.

3. **Slot-Semantik heim.** `computeMissingMandatorySlots`, `computeWalkthroughSlotTarget` und der `MissingSlot`-Typ wandern nach `interviewSemantic.ts` (gleiche Domäne wie `groupSemanticSteps`/`normalizeStepEntry`, nutzen dort lebende Slot-Konstanten — ein Import-Umweg entfällt).

4. **Interaktions-Typen in reines Typ-Modul.** Neues `interviewTypes.ts` (rein) für `InterviewContext`, `TurnMessage`, `ClarificationCard`, `AnalystBriefing`. Client-Komponenten und reine Module importieren aus einem garantiert server-only-freien Ort statt via Typ-Löschung aus `interviewAgent`.

5. **Kein Re-Export-Hub (Befund #3 verworfen).** Ein reiner Durchreicher ist per Löschtest ein flaches Modul (`codebase-design` lehnt Pass-throughs ab). Statt einen Dauer-Shim zu institutionalisieren, werden die ~18 Konsumenten auf die echten Pfade migriert. `interviewAgent.ts` behält nur seinen echten server-gebundenen Kern: `buildTools` (+ Tool-Helfer `findStepFuzzy`/`findStepById`/`normalizeStepTitleForDedup`/`extractSentenceAroundSpan` — letzteres privat statt exportiert), `createInterviewStream`, `buildStaticPrompt`.

6. **Output-Guards zu ihrem Konsumenten.** `detectNumberAnchoring` und `detectFillerPhrases` operieren auf dem **generierten** Talker-Text (post-hoc im `onFinish`) und wandern nach `interviewTalker.ts`, neben ihren einzigen Aufrufer.

**Verhaltensneutral:** Das komponierte Verhalten (was `buildDynamicContext` ausgibt) bleibt byte-identisch; Detektor-Logik, Regex-Tabellen und Prompt-Text bleiben unverändert. conversation-signals ist eine **Interface-Vertiefung (9→1), keine Logikänderung**. Tests wandern mit ihren Funktionen (replace, don't layer): Signal-Tests → `analyzeConversationSignals`-Oberfläche, Slot-Compute-Tests → `interviewSemantic.test.ts`, Tool-Handler-Tests bleiben in `interviewAgent.test.ts`.

## Consequences

**Positiv:**
- Tiefe: `analyzeConversationSignals` bündelt die Signal-Komposition hinter einem Interface; Tests treffen die Oberfläche, die Aufrufer kreuzen (statt am Interface vorbei).
- Ehrlicher Abhängigkeitsgraph: Client und reine Module importieren aus server-only-freien Modulen statt via Typ-Löschung aus einem `server-only`-Modul.
- Locality: Prompt-Bau ohne `supabase`-Kette testbar; Output-Guards neben ihrem Aufrufer.
- `interviewAgent.ts` reduziert auf server-gebundene Agent-Konstruktion.

**Negativ / Trade-offs:**
- Import-Blast-Radius: ~18 Konsumenten werden geändert (bewusst, statt flachem Shim).
- ~80 Detektor-Tests werden auf die `Signals`-Oberfläche umgeschrieben (Lokalisierung bleibt pro `Signals`-Feld erhalten, aber das Test-Setup ändert sich).
- `buildTools` bleibt mit DB-Schreib-Seiteneffekten in `interviewAgent` (`server-only`); reine Testbarkeit liefert erst PROJ-34.

**Out of Scope / Folge-Kandidaten:**
- **PROJ-37** (Roadmap): Static-Prompt-Drift — `STATIC_PROMPT` (Talker) vs. `buildStaticPrompt()` (Greeting/Reconnect) sind inhaltlich auseinandergelaufen; hier nur verschoben, nicht konsolidiert.
- **PROJ-34** (Roadmap): `buildTools` Schreib-Absichten + TurnStore-Port — die DB-Schreib-Seiteneffekte und der DB-freie Eval bleiben dort.
