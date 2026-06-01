# ADR-013: Pipeline-Audit — Interview bis Use-Case-Generierung

**Status:** Accepted (2026-06-01)
**Author:** lyas53
**Auslöser:** Vollständige Code-Durchsicht des gesamten Datenflusses nach Fertigstellung von PROJ-22 (Dual-Loop), PROJ-23 (Clarification Cards) und PROJ-24 (Cluster-aware Use Cases). Ziel: Qualitätsprobleme und tote Datenpfade systematisch erfassen und iterativ beheben.

---

## Context

### Vollständiger Fluss (Stand 2026-06-01)

```
Interview (Talker + Analyst)
  → step_tracker in interview_state (Analyst füllt Slots live)
  → [completion] createProcessStepsFromTracker → process_steps
  → clusterProcessSteps → process_clusters
  → [manual trigger] runHeuristicEngine → use_cases
  → [on-demand] generateUseCaseInsights → Detail View

Parallel (per Turn):
  → extractAndEmbed → knowledge_objects (process_step / pain_point / tool)
  → deduplicateKnowledgeObjects

Post-Interview:
  → Clarification UI → /clarification → process_steps UPDATE (SlotCards)
                                      → process_steps INSERT (OpenItemCards) ← ADR-013 Fix 1
```

### Was gut funktioniert

- **Dual-Loop** (ADR-011): Talker/Analyst-Trennung sauber umgesetzt. Orchestrator rein TypeScript, vollständig testbar.
- **`createProcessStepsFromTracker`**: Quantitative Slots direkt aus `step_tracker` (kein LLM), LLM nur für `description` + `source_quote`. Grounding Guard verhindert halluzinierte Werte.
- **ROI-Berechnung**: Reines Mathe, kein LLM, auditierbar.
- **Use-Case-Engine**: Komplett TypeScript (R1–R8, P1–P4, C1–C3), vollständig testbar.
- **Clarification SlotCards**: Schreiben direkt in `process_steps`-Spalten, korrekt.
- **Deduplication**: Cosine-Similarität + Levenshtein als Doppel-Guard, robust.

---

## Identified Problems

### Kritisch — Datenverlust / Tote Pfade

**K1 — OpenItemCards landen nie in `process_steps`** *(Fixed: 2026-06-01)*

`clarification/route.ts` inserierte OpenItem-Bestätigungen nur als `knowledge_objects`. `createProcessStepsFromTracker` hat Idempotency-Check (`count > 0 → return`), läuft aber erst nach der Clarification und findet bereits vorhandene Steps → neuer Schritt wurde nie angelegt. Downstream: kein Clustering, keine Use Cases für bestätigte Schritte.

**Fix:** OpenItem-Bestätigungen ("Ja"/"Manchmal") direkt als `process_step` inserieren mit Embedding-Generierung, vor dem `after()`-Call. Dedup-Check via Titel verhindert Doppeleinträge. `clusterProcessSteps` in `after()` findet diese Steps via `cluster_id IS NULL`.

---

**K2 — `extractAndEmbed` process_step KOs sind tote LLM-Calls**

Seit PROJ-20 wird `enrichProcessSteps` nirgendwo aufgerufen. Die per Turn erzeugten `knowledge_objects` vom Typ `process_step` werden dedupliziert, aber nie mit der `process_steps`-Tabelle verlinkt und nie in Use-Case-Logik konsumiert. Der Extraction-LLM-Call läuft trotzdem für jeden Turn (O(n) Transcript-Context, O(1) Nutzen).

Die einzigen KO-Typen, die downstream relevant sind:
- `pain_point` → P1–P3 (Qualitative Use Cases) + P4 (Cross-Interview Clustering)
- `tool` → P2 (Tool-Consolidation Use Cases)

**Entscheidung:** `extractAndEmbed` auf `pain_point` + `tool` beschränken. `process_step`-Extraktion überspringen. Damit entfällt auch `deduplicateKnowledgeObjects` für type=process_step (sinnlos ohne Downstream-Verwendung), aber pain_point-Dedup bleibt sinnvoll (P4 arbeitet auf KO-Embeddings).

Alternativ komplett abschalten: Analyst in Iteration 3 übernimmt Tracker-Pflege. Aber `pain_point`/`tool` KOs hat der Analyst-Pfad nicht im Scope (er ruft `link_bottleneck` für Pain Points nur wenn eindeutig verortbar). `extractAndEmbed` bleibt als separater Kanal für Pain Points und Tools erhalten.

---

### Mittel — Qualitätsprobleme

**M1 — P1–P3 Use Cases verwenden falschen Anchor-Step**

`useCaseEngine.ts`: `stepByInterview` nimmt den ersten `process_step` pro Interview als Anker für alle qualitative Use Cases. Ein Pain Point über "Mahnprozess" erzeugt Use Case mit Titel `"Rechnungsprüfung — Prozessverbesserung"`. Für Berater-Präsentationen direkt irreführend.

**Entscheidung:** Anchor-Step für P1-Use Cases soll den Pain Point semantisch am nächsten liegenden Step verwenden. Wenn `link_bottleneck`-Tool im Interview `step_ref` gesetzt hat, diesen bevorzugen. Fallback: Cosine-Ähnlichkeit zwischen Pain-Point-Embedding und Step-Embeddings. Fallback-Fallback: erster Step (Status quo).

---

**M2 — Qualitative Clarification Cards = totes Daten**

Analyst generiert `QualitativeCards` (slot_key='qualitative') für fehlenden Prozesskontext (Beteiligte, Systeme, Blockaden). Antworten werden in `clarification_answers` JSON-Blob gespeichert. Nirgendwo downstream ausgewertet.

**Entscheidung:** QualitativeCard-Antworten in Use-Case-Reasoning einbinden. Konkret: beim `runHeuristicEngine`-Call die `clarification_answers` aus den Interviews laden und als zusätzlichen Kontext in `description`/`reasoning`-Felder der generierten Use Cases einfließen lassen. Alternativ: als Input für `generateUseCaseInsights` (Detail View) nutzen.

Scope: klein. Daten sind da, nur nicht konsumiert.

---

**M3 — Cluster-Synthese läuft vor Clarification → stale**

Nach Interview-Completion: `clusterProcessSteps` → `synthesizeCluster`. Dann Clarification: fügt frequency/duration zu bestehenden Steps hinzu. Steps haben jetzt `cluster_id != null` → werden beim zweiten `clusterProcessSteps`-Call nicht mehr verarbeitet. `canonical_description` des Clusters kennt die nachgereichten Slot-Werte nicht.

**Entscheidung:** Nach Clarification-Submission `synthesizeCluster` explizit für betroffene Cluster re-triggern. Konkret: in `clarification/route.ts` nach SlotCard-Updates die Cluster-IDs der betroffenen Steps ermitteln und deren Synthese erneut anstoßen.

---

**M4 — Use-Case-Titel sind Template-generiert, nicht pitch-tauglich**

Titel-Format: `"${step.title} — ${Typ-Label}"`. Für Berater-Präsentationen schwach. `generateUseCaseInsights` generiert guten Business Case, aber nur on-demand im Detail View.

**Entscheidung:** Keine strukturelle Änderung am Engine-Output. Stattdessen: im Detail View (PROJ-24) soll `business_case` aus Insights als primärer Beschreibungstext dienen, nicht der template-generierte `description`-String. Engine-Output bleibt wie er ist (auditierbar, deterministisch), UI-Aufbereitung verbessert die Wahrnehmung.

---

### Niedrig — Architektur-Schulden

**N1 — `enrichProcessSteps` ist dead code**

`processEnrichment.ts:78` — exportiert, nie aufgerufen. Superseded by `createProcessStepsFromTracker`.
**Entscheidung:** Entfernen in einem separaten Cleanup-Commit.

---

**N2 — `extractAndEmbed` schickt O(n) Transcript für O(1) Extraktion**

`extraction.ts` baut full history, LLM soll aber nur aus letztem Turn extrahieren. Skalierungsproblem bei langen Interviews.
**Entscheidung:** Nur letzten Turn schicken (kein History-Context nötig da System-Prompt klare Anweisung hat). Entfällt sobald K2 umgesetzt ist und process_step-Extraction abgeschaltet wird — danach bleibt nur Pain-Point + Tool-Extraction, die ebenfalls keinen History-Kontext braucht.

---

**N3 — Single-Interview: C-Rules (C1–C3) feuern nie**

Clustering braucht `participant_count >= 2`. Erstes Interview im Workspace: nur R1–R8 + P1–P4. Architektonisch korrekt, aber für Solo-Onboarding ist Output-Qualität spürbar schwächer.
**Entscheidung:** Kein Fix im Heuristic Engine selbst. Stattdessen: UX-Hinweis in der Use-Cases-Übersicht wenn `participant_count < 2` für alle Cluster ("Mehr Interviews → stärkere Use Cases"). Scope: 1 UI-Zeile.

---

## Fix-Reihenfolge

| Prio | Problem | Scope | Status |
|------|---------|-------|--------|
| K1 | OpenItemCards → process_steps | `clarification/route.ts` + Tests | ✅ Verified 2026-06-01 |
| K2 | extractAndEmbed process_step abschalten | `extraction.ts` | ✅ Verified 2026-06-01 |
| M1 | P1–P3 Anchor-Step via step_ref/Embedding | `useCaseEngine.ts` + `generate/route.ts` | ✅ Verified 2026-06-01 |
| M2 | QualitativeCards downstream auswerten | `useCaseEngine.ts` + `generate/route.ts` | ✅ Verified 2026-06-01 |
| M3 | Cluster-Synthese nach Clarification | `clarification/route.ts` + `processClustering.ts` | ✅ Verified 2026-06-01 |
| M4 | Detail View: business_case als Primärtext | `UseCaseSheet.tsx` | ✅ Verified 2026-06-01 |
| N1 | `enrichProcessSteps` entfernen | `processEnrichment.ts` | ✅ Verified 2026-06-01 |
| N2 | extractAndEmbed Transcript-Context kürzen | `extraction.ts` | ✅ Verified 2026-06-01 (zusammen mit K2) |
| N3 | UX-Hinweis Single-Interview | `UseCaseBoardClient.tsx` + `use-cases/page.tsx` | ✅ Verified 2026-06-01 |

---

## Consequences

- K1: Bestätigte Prozesse aus Clarification fließen ab sofort in Clustering und Use-Case-Generierung ein.
- K2: LLM-Kosten pro Turn sinken (1 Extraction-Call weniger, kürzerer Kontext).
- M1: Use-Case-Titel stimmen semantisch mit Pain Point überein — relevanter für Berater.
- M3: Cluster-Synthese ist post-Clarification aktuell statt veraltet.
- N1: Codebase-Komplexität sinkt, kein dead code.

Kein DB-Schema-Change in dieser ADR nötig.

---

## Verification (2026-06-01)

Code-Review aller 9 Fixes gegen die tatsächlichen Dateien:

| Fix | Datei | Verifikation |
|-----|-------|-------------|
| K1 | `clarification/route.ts:179–229` | OpenItem-Filter + dedup-Check + `process_steps.insert` + `generateEmbedding` ✅ |
| K2 | `extraction.ts:10` | `ALLOWED_TYPES = ['pain_point', 'tool']` — process_step nicht in Allowlist ✅ |
| N2 | `extraction.ts:49–51` | `buildExtractionPrompt` schickt nur `lastTurn` statt full history ✅ |
| M1 | `useCaseEngine.ts:414, 622, 664` | `findBestAnchorStep()`: step_ref → cosine-sim → first-Step Fallback ✅ |
| M2 | `generate/route.ts:119–130` | `clarification_answers` geladen, `qualitativeContext` Map an Engine übergeben ✅ |
| M3 | `clarification/route.ts:160–177, 250–254` | `affectedClusterIds` aus updatedStepIds, `resynthesizeClusters(affectedClusterIds)` in `after()` ✅ |
| M4 | `UseCaseSheet.tsx:261` | `{insights?.business_case ?? useCase.description}` — business_case Priorität ✅ |
| N1 | `processEnrichment.ts` | `enrichProcessSteps` vollständig entfernt, nur `createProcessStepsFromTracker` + `applyGroundingGuard` ✅ |
| N3 | `UseCaseBoardClient.tsx:110` | UX-Tipp: "Mehr Interviews → stärkere Use Cases. Cluster-Regeln greifen ab 2 Mitarbeitern." ✅ |

**Teststand:** 349 Tests grün (30 Test-Dateien). Netto gegenüber pre-ADR: -6 enrichProcessSteps-Tests (N1), +2 Agent-Dedup-Normalisierung, +1 Orchestrator PROJ-23-Regression, +1 Extraction-K2-Test, +2 Clarification-K1-Tests. Alle ADR-Fixes haben Test-Coverage.

**Commit-Status:** Alle Änderungen liegen in uncommitted Working Tree (zusammen mit PROJ-22 B6 + Persona-Fixes). Nächster Commit fasst ADR-013 + PROJ-22 B6 Nacharbeiten zusammen.
