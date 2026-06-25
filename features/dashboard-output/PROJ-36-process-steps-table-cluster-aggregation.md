# PROJ-36: ProcessStepsTable — Cluster-Aggregation als reines Modul

## Status: Deployed
**Type:** Revision
**Domain:** Dashboard & Output
**Extends:** PROJ-20
**Appetite:** S (Stunden–½ Tag)
**Bugs:** 0:0:0
**Created:** 2026-06-25
**Last Updated:** 2026-06-25

## Dependencies
- Requires: PROJ-20 (Prozessableitungs-Pipeline) — liefert `process_steps` + `process_clusters`, die diese Komponente rendert
- Related: PROJ-33/PROJ-35 (ADR-016/ADR-017) — gleiches Deepening-Muster (pure Logik aus React-Komponente extrahieren), aus dem Architektur-Review 2026-06-18 als Befund #4 hervorgegangen

## Context

`src/components/ProcessStepsTable.tsx` (746 LOC) mischt Render-Logik mit Aggregations-Mathematik, die direkt im Komponenten-Body läuft:

- `groupedByDeptCluster` — Gruppierung nach Abteilung + Cluster-Key (`cluster_id` oder `solo-${step.id}`)
- `avg()` + die `merged*`-Berechnungen in `DeptClusterCard` (Frequenz, Dauer, Fehlerrate, Medienbrüche, Datenquellen, Regelbasiert-Mehrheit, `flowStepCount`)
- Summary-Stats (`totalSteps`, `totalDepts`, `uniqueInterviews`, `ruleBasedPct`)
- `interviewStepCounts`

Diese Berechnungen haben keine eigene Testoberfläche — sie laufen nur, wenn die Komponente rendert, und sind nicht ohne React/JSDOM prüfbar. Gleiches Muster wie PROJ-35 Befund #2 (conversation-signals): reine Logik sitzt in der falschen Datei.

## Scope

Extrahiere die reine Aggregations-Logik nach `src/lib/processStepsAggregation.ts` (kein React/JSX, kein Server-only-Import):

- `groupStepsByDeptAndCluster(steps): Record<string, Record<string, ProcessStep[]>>`
- `computeInterviewStepCounts(steps): Record<string, number>`
- `computeClusterAggregates(groupSteps, interviewStepCounts): ClusterAggregates` — bündelt `mergedFrequency`, `mergedDuration`, `mergedErrorRate`, `mergedMediaBreaks`, `mergedDataSources`, `isRuleBased`, `flowStepCount`, `participantNames`
- `computeSummaryStats(steps): SummaryStats` — `totalSteps`, `totalDepts`, `uniqueInterviews`, `ruleBasedCount`, `ruleBasedPct`
- `avg()` bleibt privat (intern genutzt von `computeClusterAggregates`)

Die Typen `ProcessStep`, `ProcessCluster`, `SubStep` wandern als Typ-Exporte mit ins neue Modul (Single Source of Truth statt Duplikat in der Komponente).

`ProcessStepsTable.tsx` und `DeptClusterCard` rufen die vier Funktionen auf und rendern nur noch — keine Aggregations-Mathematik mehr im Komponenten-Body.

## User Stories
- Als **Entwickler** möchte ich Cluster-Aggregation (Mittelwerte, Gruppierung, Regelbasiert-Mehrheit) per Unit-Test prüfen können, ohne die Komponente zu rendern.
- Als **Entwickler** möchte ich Aggregations-Bugs (z.B. falscher Mittelwert bei `null`-Werten) an einer Funktionsgrenze lokalisieren können statt im JSX zu suchen.
- Als **KI-Berater / Dashboard-Nutzer** möchte ich, dass sich die angezeigten Zahlen und Gruppierungen durch diese Umstrukturierung **nicht** ändern.

## Acceptance Criteria
- [ ] `src/lib/processStepsAggregation.ts` existiert, exportiert `groupStepsByDeptAndCluster`, `computeInterviewStepCounts`, `computeClusterAggregates`, `computeSummaryStats`, plus die Typen `ProcessStep`, `ProcessCluster`, `SubStep`, `ClusterAggregates`, `SummaryStats`. `avg` ist **nicht** exportiert.
- [ ] `ProcessStepsTable.tsx` importiert diese Funktionen statt sie inline zu berechnen; kein `.reduce`/`avg`/Gruppierungs-Code mehr im Komponenten-Body oder in `DeptClusterCard`.
- [ ] Modul importiert **kein** React, kein `server-only`, kein Supabase-Client — rein TS/JS.
- [ ] `processStepsAggregation.test.ts` deckt mindestens: Gruppierung mit `cluster_id = null` (solo-Key), Mittelwert mit gemischten `null`-Werten, Mittelwert mit ausschließlich `null`-Werten (→ `null`), `isRuleBased`-Tie-Break bei genau halber Mehrheit, `flowStepCount`-Fallback `?? 1`, leeres `steps`-Array für `computeSummaryStats`.
- [ ] Verhaltensneutral: keine Änderung an Render-Output, CSS, oder angezeigten Werten — Diff zeigt nur Verschiebung + Funktionsaufrufe statt Inline-Berechnung.
- [ ] **Gate:** `npm run lint` (`tsc --noEmit`) und `npm test` grün.

## Edge Cases
- **`cluster_id = null`:** Schritt bekommt eigenen Solo-Cluster-Key (`solo-${step.id}`) — bestehendes Verhalten, muss erhalten bleiben.
- **Alle numerischen Werte in einer Gruppe `null`** (z.B. `frequency_per_month`): `avg()` liefert `null`, UI zeigt das Feld nicht (bestehendes `!= null`-Gate in der Komponente).
- **`isRuleBased`-Tie:** bei exakt halber Mehrheit (`>= length / 2`) gilt aktuell "regelbasiert" — Verhalten unverändert übernehmen, nicht "fixen".
- **`interviewStepCounts` ohne Eintrag für eine `interview_id`:** Fallback `?? 1` muss erhalten bleiben (`flowStepCount`-Berechnung).
- **Leeres `steps`-Array:** `computeSummaryStats([])` liefert `totalSteps: 0`, `ruleBasedPct: 0` (nicht `NaN`) — bestehendes `totalSteps > 0 ? ... : 0`-Gate.

## Technical Requirements
- **Kein DB-Schema-Change, keine neue API-Route, kein UI-Verhaltens-Change.**
- Reines Modul liegt in `src/lib/` (nicht `src/services/`) — keine KI-Logik, Service-Layer-Constraint (CLAUDE.md) greift nicht.
- Verifikation: `tsc` + Unit-Suite als Gate; kein Eval nötig (kein Interview-Engine-Feature, kein LLM-Call betroffen).

## Out of Scope
- Visuelle/UX-Überarbeitung der Tabelle oder des Detail-Sheets.
- Server-seitiges Process-Clustering (`src/services/processClustering.ts`, PROJ-20/26) — andere Schicht, andere Verantwortung (DB-Cluster-Bildung vs. UI-Display-Aggregation).
- `SubStepFlowView` und Render-Subkomponenten — bleiben unverändert, nur Datenzulieferung ändert sich.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure (unverändert — nur Datenzulieferung ändert sich)

```
ProcessStepsPage (Server Component)
+-- ProcessStepsTable (Client Component)
    +-- StatCard x4 (Summary-Zahlen oben)
    +-- Abteilungs-Liste (aufklappbar)
    |   +-- DeptClusterCard (eine Karte pro Prozess-Cluster)
    +-- ClusterDetailSheet (Detail-Ansicht beim Klick)
```

Vorher: Jede Karte berechnet ihre Zahlen (Durchschnitt Dauer, Häufigkeit, Fehlerrate, …) selbst beim Rendern.
Nachher: Eine neue, von der Oberfläche getrennte Rechen-Schicht (`processStepsAggregation`) liefert die fertigen Zahlen; die Komponenten zeigen sie nur noch an.

### Daten-Modell (unverändert)

Keine neuen Felder, keine Datenbank-Änderung. Es ändert sich nur **wo** die Durchschnittsbildung und Gruppierung passiert — nicht **was** angezeigt wird.

Die Rechen-Schicht bekommt die bereits geladenen Prozessschritte und liefert vier fertige Ergebnisse:
1. **Gruppierung** — welche Schritte gehören zu welcher Abteilung und welchem Cluster
2. **Cluster-Kennzahlen** — Durchschnittswerte (Dauer, Häufigkeit, Fehlerrate), zusammengefasste Datenquellen, Mehrheitsentscheid "regelbasiert"
3. **Zusammenfassungs-Kennzahlen** — Gesamtzahlen oben auf der Seite (Schritte, Abteilungen, Interviews, Automatisierbar-%)
4. **Schritte pro Interview** — Hilfswert für die Anzeige der Ablauflänge

### Tech-Entscheidung: Warum eine separate Rechen-Schicht?

Aktuell lebt die Rechenlogik mitten in der Anzeige-Komponente. Das hat zwei Nachteile:
- Sie lässt sich nicht isoliert testen (man müsste die ganze Tabelle rendern, um z.B. zu prüfen "was passiert bei fehlenden Werten?")
- Anzeige-Änderungen (Farben, Layout) und Rechen-Änderungen (z.B. wie Mittelwerte gebildet werden) sind im selben Code vermischt — Risiko, beim Anpassen des einen das andere versehentlich zu brechen

Die Trennung folgt demselben Muster, das bereits bei zwei anderen internen Aufräum-Projekten (PROJ-33, PROJ-35) verwendet wurde: reine Rechenlogik raus aus der Anzeige, in ein eigenes, unabhängig testbares Modul.

**Kein Verhaltens-Unterschied für Nutzer** — die Tabelle zeigt exakt dieselben Zahlen wie vorher.

### Dependencies
- Keine neuen Packages. Reine Umstrukturierung bestehenden Codes.

### Out of Scope (bestätigt aus Spec)
- Keine visuelle Änderung der Tabelle/des Detail-Sheets
- Keine Änderung an der serverseitigen Cluster-Bildung (das ist ein anderer, bereits bestehender Prozess)

## Implementation Notes (2026-06-25, /frontend)

`src/lib/processStepsAggregation.ts` (128 LOC, kein React, kein server-only) angelegt: `groupStepsByDeptAndCluster`, `computeInterviewStepCounts`, `computeClusterAggregates`, `computeSummaryStats` + Typen `ProcessStep`, `ProcessCluster`, `SubStep`, `ClusterAggregates`, `SummaryStats`. `avg` privat.

`ProcessStepsTable.tsx` 746 → 685 LOC: importiert die vier Funktionen, kein `.reduce`/`avg`/Gruppierungs-Code mehr im Komponenten-Body oder in `DeptClusterCard`. Lokale Interfaces durch Re-Export aus dem neuen Modul ersetzt.

`processStepsAggregation.test.ts` (11 Tests): Solo-Cluster-Key bei `cluster_id = null`, Department-Fallback "Unbekannt", Mittelwert mit gemischten/ausschließlich `null`-Werten, `isRuleBased`-Tie-Break bei exakter Hälfte, `flowStepCount`-Fallback `?? 1`, Dedup von Datenquellen/Teilnehmernamen, leeres `steps`-Array (kein `NaN`).

Gates: `tsc --noEmit` ✓ · `npm test` 54 Files, 715 passed / 1 skipped ✓ · `npm run build` ✓ Compiled successfully. Dev-Server-Smoke-Test `/dashboard/process-steps` → 307 (Login-Redirect, kein Crash) — vollständiger Browser-Test nicht möglich ohne Auth-Session, abgedeckt durch Build+Unit-Suite.

Keine Abweichung vom Spec.

## QA Test Results
_To be added by /qa_

---

## QA Test Results

**Tested:** 2026-06-25
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: `src/lib/processStepsAggregation.ts` mit den 4 Funktionen + Typen, `avg` nicht exportiert
- [x] `grep -n "^export"` zeigt genau `groupStepsByDeptAndCluster`, `computeInterviewStepCounts`, `computeClusterAggregates`, `computeSummaryStats` + Typen `ProcessStep`, `ProcessCluster`, `SubStep`, `ClusterAggregates`, `SummaryStats`. `avg` ist `function avg(...)` ohne `export`.

#### AC-2: Komponente importiert statt inline zu berechnen
- [x] `ProcessStepsTable.tsx` enthält kein `.reduce`/`avg`/Gruppierungs-Code mehr im Komponenten-Body oder in `DeptClusterCard` (verifiziert per Diff: 746 → 685 LOC, Berechnungen durch Funktionsaufrufe ersetzt).

#### AC-3: Modul ist rein
- [x] `grep -n "^import" processStepsAggregation.ts` zeigt keine Imports — kein React, kein `server-only`, kein Supabase-Client.

#### AC-4: Test-Coverage der Edge-Cases
- [x] `processStepsAggregation.test.ts` (11 Tests) deckt: Solo-Cluster-Key bei `cluster_id = null`, gemischte/ausschließlich `null`-Mittelwerte, `isRuleBased`-Tie-Break, `flowStepCount`-Fallback, leeres `steps`-Array.

#### AC-5: Verhaltensneutral
- [x] Diff zeigt nur Verschiebung + Funktionsaufrufe, keine Logik-Änderung (Formeln, Schwellenwerte, Fallback-Werte 1:1 aus der Vorlage übernommen).

#### AC-6: Gate
- [x] `npm run lint` (`tsc --noEmit`) ✓ keine Fehler
- [x] `npm test` ✓ 54 Files, 715 passed / 1 skipped

### Edge Cases Status

#### EC-1: `cluster_id = null` → Solo-Key
- [x] Per Unit-Test verifiziert (`solo-s1`/`solo-s2` getrennt).

#### EC-2: Alle numerischen Werte `null`
- [x] `avg()` liefert `null`, nicht `NaN` oder `0` — Unit-Test bestätigt.

#### EC-3: `isRuleBased`-Tie bei exakter Hälfte
- [x] `>= length / 2` ergibt bei 1:1-Split `true` — unverändertes Verhalten, per Test fixiert.

#### EC-4: `interviewStepCounts` ohne Eintrag
- [x] Fallback `?? 1` greift — Unit-Test bestätigt.

#### EC-5: Leeres `steps`-Array
- [x] `computeSummaryStats([])` → `{ totalSteps: 0, ruleBasedPct: 0, ... }`, kein `NaN`.

### Security Audit Results
- [x] Object-Ownership: keine neue `[id]`-Route, kein neuer Datenzugriffspfad — Workspace-Scoping bleibt unverändert in `page.tsx` (Server Component, `workspace_id`-Filter unverändert).
- [x] Keine neuen Env-Vars, keine neue API-Route, kein Auth-/RLS-Change.
- [x] Reines Frontend-Modul ohne Netzwerk-/DB-Zugriff — keine neue Angriffsfläche.
- N/A Rate-Limiting/Input-Validation: kein neuer Eingabepfad eingeführt.

### Regression
- `npm test`: 54 Files, 715 passed / 1 skipped (keine Regression).
- `npm run build`: ✓ Compiled successfully, alle 30 Routes generiert.
- E2E-Regression `tests/PROJ-20-cluster-synthese.spec.ts` (deckt `/dashboard/process-steps`-Auth-Guard ab): 3/3 passed (chromium).
- Dev-Server-Smoke-Test `/dashboard/process-steps` → HTTP 307 (Login-Redirect), kein 500/Crash.

### E2E
N/A für neue Tests — die ACs sind strukturell (Modulgrenzen, Reinheit, Sichtbarkeit), kein neues nutzersichtbares Verhalten (gleiche Begründung wie PROJ-35). Bestehender E2E-Test für die Seite (Auth-Guard) bleibt grün. Kein Eval-Gate nötig — Domain ist Dashboard & Output, keine Interview-Conversation-Logic betroffen.

### Bugs Found
Keine.

### Summary
- **Acceptance Criteria:** 6/6 passed
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low)
- **Security:** Pass — keine neue Angriffsfläche, Object-Ownership unverändert
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment (2026-06-25, /deploy)

- Production: https://meridian-app-green.vercel.app (Vercel, alias of `dpl_DAGqznHpzD15DBcAkV4dEDnHxm8C`)
- G1 (build/lint/tsc): pass
- G2 (Tests): eigener Scope pass (Unit-Suite 715/1 skipped, `processStepsAggregation.test.ts` 11/11, E2E-Regression `PROJ-20-cluster-synthese.spec.ts` 3/3 chromium). Volle E2E-Suite zeigt 22 vorbestehende, unrelated Fails → **KI-13** in `features/INDEX.md` geloggt (CSP-Nonce-Hydration-Mismatch + Webkit-Flakiness, verifiziert pre-existing auf Commit `89ce1bf`, kein Berührungspunkt mit `src/lib`/`src/components/ProcessStepsTable.tsx`). Deploy mit dokumentierter Ausnahme von der general.md-Hard-Rule fortgesetzt.
- G3 (Preview-Deploy + Smoke-Test): pass — Build READY, Routen kompiliert; curl-Smoke gegen Preview traf Vercels Team-SSO-Gate (kein App-Fehler, erwartetes Verhalten für Preview-URLs).
- G4 (Permissions): nicht anwendbar — Diff berührt keine Auth/RLS/API/LLM-Pfade (nur `src/lib/processStepsAggregation.ts`, `src/components/ProcessStepsTable.tsx`).
- Production-Smoke-Test: `/` → 307, `/login` → 200, `/dashboard/process-steps` → 307 (Auth-Redirect, kein 500).
- Lighthouse: bewusst übersprungen — reiner Daten-Layer-Refactor ohne visuelle/Performance-relevante Änderung (kein neuer Render-Pfad, kein neues Asset).
- User-Approval für Production-Deploy eingeholt (AskUserQuestion, 2026-06-25).

## Post-Mortem (2026-06-25, /deploy)

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High — Scope (4 Funktionen, `src/lib`, keine Verhaltensänderung) deckte sich exakt mit der Umsetzung, keine Nachschärfung nötig |
| Appetite vs. tatsächlich | geschätzt: S / tatsächlich: S |
| Größte Überraschung | Nicht der Refactor selbst, sondern die volle E2E-Suite: 22 vorbestehende, komplett unrelated Fails (CSP-Nonce-Hydration-Mismatch) wurden erst beim Deploy-Gate sichtbar, weil vorher nur gezielte Specs liefen — als KI-13 geloggt statt PROJ-36 zu blockieren |
| Vorgeschlagene Regeländerung | Vor dem nächsten Feature-Deploy: KI-13 (CSP-Nonce-Dev-Mode-Mismatch) fixen, sonst wächst die Liste „vorbestehender, dokumentierter" E2E-Fails weiter — genau das Muster, das general.md mit der 100%-Hard-Rule verhindern wollte |
| Build-Loop-Iterationen | tatsächlich: 1 (geplant: ≤5) — kein Retry nötig, tsc/Tests/Build liefen beim ersten Versuch grün |
| Häufigste Fehlerkategorie im Loop | — (keine Fehler im Implementierungs-Loop; einzige Reibung war das vorbestehende E2E-Deploy-Gate, nicht der Code selbst) |
