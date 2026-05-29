# PROJ-8: Interview-Design Optimierung (Re-Architektur)

> **Superseded by PROJ-22 (2026-05-29).** Der Single-Call-Agent mit Negative Constraints, Anti-Anchoring-Block und sechs Walkthrough-Few-Shot-Beispielen aus PROJ-8 wird durch die Dual-Loop-Architektur (ADR-011 / PROJ-22) ersetzt. Die in PROJ-8 etablierte Phasen-Methodologie (intro → process_loop → walkthrough_step → slot_completion → coverage_check → wrap_up) bleibt konzeptionell bestehen, wandert aber aus dem Prompt in den Orchestrator. Spec bleibt als historischer Kontext erhalten.

## Status: Deployed (Superseded by PROJ-22)
**Created:** 2026-05-20
**Last Updated:** 2026-05-24
**Deployed:** 2026-05-24
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** —
**Bugs:** —

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — Agent-Service, System Prompt, Phasenmodell, Tool-Use
- Requires: PROJ-4 (Extraktion + Wissensbasis) — `knowledge_objects.content` mit neuem `step_ref`
- Requires: PROJ-5 (Prozessschritt-Anreicherung) — Anreicherer nutzt `step_tracker` als Hinweis
- Test-Dependency: PROJ-3 (Interview UI) — kein Code-Change geplant, E2E-Tests laufen weiter
- Test-Dependency: PROJ-6 (Use Case Identifikation) — Eval-Harness erwartet Use-Case-Generierung als End-Output

## Context

Die Meridian-Pipeline ist deterministisch: 8 Heuristik-Regeln in der Use-Case-Engine arbeiten auf 6 Attributen am `process_step` (`frequency_per_month`, `duration_minutes`, `rule_based`, `data_sources`, `error_rate_percent`, `media_breaks`). Wenn diese Attribute leer bleiben, fällt der Use Case raus, weil der Grounding-Guard im Anreicherer ohne wörtliches Zitat im Transkript nichts setzt.

Aktuelles Interview-Design ist linear (`intro → exploration → deepdive → wrap_up`), nutzt Freitext-Methodik und überlässt es dem Gesprächsverlauf, ob Pflicht-Slots adressiert werden. Folge: Coverage schwankt, Pain Points sind nicht an Prozessschritte verortet, Quantifizierungen fehlen häufig.

Ziel der Re-Architektur: Das Interview deterministisch so steuern, dass pro identifiziertem Prozessschritt die für die Use-Case-Engine kritischen Attribute mit hoher Wahrscheinlichkeit erhoben werden, ohne den Charakter eines natürlichen Gesprächs zu zerstören. Gemessen wird die Qualität an reproduzierbaren synthetischen Persona-Interviews.

Der vorherige PROJ-8 Spec (nur `buildSystemPrompt()`-Anpassung) wird inhaltlich abgelöst. Phasenmodell-Änderung war dort explizit Out-of-Scope und wird jetzt In-Scope gezogen.

## Designentscheidungen (bestätigt 2026-05-23)

1. **Slot-Strategie:** Backward-First mit Coverage-Tool. Agent trackt pro Prozessschritt welche Slots gefüllt sind und fragt gezielt nach.
2. **Phasen-Architektur:** Iterativ pro Prozessschritt. State Machine und Tools werden erweitert.
3. **Evaluation:** Synthetische Personas plus Slot-Coverage-Metrik.

## User Stories
- Als Berater möchte ich, dass jedes Interview pro Prozessschritt die Pflicht-Attribute der Use-Case-Engine zuverlässig erhebt, damit ich aus jedem Interview verwertbare Use Cases bekomme statt halb gefüllter `process_steps`.
- Als Berater möchte ich, dass identifizierte Bottlenecks am konkreten Prozessschritt verortet werden, damit ich gezielt priorisieren kann.
- Als Mitarbeiter möchte ich, dass das Interview einem natürlichen Gesprächsfluss folgt, damit ich mich gehört fühle und nicht in einen Fragebogen gepresst werde.
- Als Entwickler möchte ich die Interview-Methodik in einer Single-Source-of-Truth (`docs/agent-procedures.md`) nachlesen können, damit ich Änderungen am System Prompt begründen kann.
- Als Entwickler möchte ich ein reproduzierbares Eval-Setup mit synthetischen Personas, um Prompt-Iterationen quantitativ zu vergleichen.

## Output-Kontrakt (Pass/Fail-Schwellen pro Interview)

| Metrik | Schwelle (MVP-Ziel) |
|--------|---------------------|
| Identifizierte Prozessschritte | ≥ 3 |
| Pflicht-Slot-Coverage pro Schritt | ≥ 80 % von {`frequency_per_month`, `duration_minutes`, `rule_based`} |
| Optionale-Slot-Coverage pro Schritt | ≥ 50 % von {`data_sources`, `error_rate_percent`, `media_breaks`} |
| Bottlenecks an Prozessschritt verortet | ≥ 1 |
| Stundensatz-Validierung | bestätigt oder Workspace-Default akzeptiert |

## Slot-Inventar

Backward abgeleitet aus `src/services/useCaseEngine.ts`. Pro Slot eine Default-Frage und eine Probe-Variante.

| Slot | Typ | Default-Frage | Probe |
|------|-----|---------------|-------|
| `frequency_per_month` | int | "Wie oft kommt das vor?" | "Eher täglich, wöchentlich, oder seltener?" |
| `duration_minutes` | int | "Wie lange dauert ein Durchlauf typischerweise?" | "Wenn alles glatt läuft vs. wenn es hakt?" |
| `rule_based` | bool | "Läuft das immer gleich oder hängt es vom Fall ab?" | "Gibt es eine feste Reihenfolge oder Regel?" |
| `data_sources` | string[] | "Mit welchen Systemen arbeiten Sie dabei?" | "Wo holen Sie die Daten her, wo geben Sie sie ein?" |
| `error_rate_percent` | int | "Wie oft geht etwas schief oder muss nachgearbeitet werden?" | "Schätzen Sie: eher 1 von 100, oder 1 von 10?" |
| `media_breaks` | int | "Müssen Sie zwischen Systemen wechseln?" | "Wie oft kopieren oder übertragen Sie etwas manuell?" |
| `hourly_rate_confirmed` | bool | "Stimmt für Ihre Rolle der angenommene Stundensatz X €?" | (nur einmalig in wrap_up) |

## Phasen-Architektur (neu)

```
intro
  ↓
process_loop  (wiederholt sich für jeden identifizierten Prozessschritt)
  ├─ explore_step      narrativ, CIT/CTA, Schritt identifizieren
  ├─ quantify_step     gezieltes Slot-Filling für diesen Schritt
  └─ bottleneck_probe  pain_point mit Verortung am Schritt
  ↓
coverage_check        Agent prüft globale Coverage, holt fehlende Slots nach
  ↓
wrap_up               Zusammenfassung mit Schritten und Bottlenecks
```

## Acceptance Criteria

### Deliverable 1: State-Erweiterung (Migration)
- [ ] Neue Migration `supabase/migrations/20260524000000_proj8_step_tracker.sql`
- [ ] `interview_state.step_tracker JSONB NOT NULL DEFAULT '[]'::jsonb`
- [ ] Schema-Form: `[{ title, role?, slots: { frequency_per_month: { value, quote } | null, ... }, status: 'exploring'|'quantifying'|'done' }]`
- [ ] Constraint-Update für `interview_state.phase`: erlaubt neue Werte `intro`, `process_loop`, `coverage_check`, `wrap_up`
- [ ] Backfill: bestehende Interviews mit `exploration|deepdive → process_loop` umsetzen
- [ ] RLS-Policies erben

### Deliverable 2: Tool-Erweiterung in `interviewAgent.ts`
- [ ] `register_step(title, role?)` — legt Slot-Tracker-Eintrag im State an
- [ ] `record_slot(step_title, slot, value, evidence_quote)` — aktualisiert Slot-Tracker, persistiert `evidence_quote`
- [ ] `enter_coverage_check()` — Phasenwechsel, Agent erhält Liste leerer Pflicht-Slots aus State-Snapshot
- [ ] `link_bottleneck(step_title, description, severity)` — Pain Point mit Step verknüpft (neues Feld `step_ref` in `knowledge_objects.content`)
- [ ] `transition_phase` auf neue Phasen-Werte erweitert
- [ ] `complete_interview` unverändert

### Deliverable 3: System Prompt (neu strukturiert)
- [ ] Modularer Aufbau: Rolle+Ziel, Phasen, Methodik pro Phase, Gesprächsregeln, Quellen-Verweis
- [ ] Methodik-Block `explore_step`: CIT (konkreter Vorfall), CTA-Walkthrough
- [ ] Methodik-Block `quantify_step`: Slot-Inventar als Probe-Liste, Regel "max 2 Slots pro Turn"
- [ ] Methodik-Block `bottleneck_probe`: Trigger-Phrasen für Pain-Point-Erfassung
- [ ] Methodik-Block `coverage_check`: leere Pflicht-Slots werden zur Laufzeit eingespeist
- [ ] Gesprächsregeln: Paraphrasieren, Laddering bei einsilbiger Antwort, Halluzinations-Guard
- [ ] Kommentar verweist auf `docs/agent-procedures.md`

### Deliverable 4: Chat-Route-Anpassung
- [ ] `src/app/api/interview/[token]/chat/route.ts` speist aktuellen `step_tracker` in den Prompt-Kontext ein
- [ ] In Phase `coverage_check` wird zusätzlich eine Liste der leeren Pflicht-Slots eingespeist
- [ ] Bestehende Streaming-Logik und Persistierungs-Flow unverändert

### Deliverable 5: Methodik-Doku `docs/agent-procedures.md`
- [ ] Wissenschaftliche Grundlagen mit begründeter Methodenauswahl
- [ ] Übernommen: Critical Incident Technique (Flanagan), Cognitive Task Analysis (Crandall-Klein-Hoffman), Contextual Inquiry (Beyer-Holtzblatt), TODS Slot-Filling
- [ ] Bewertet aber nicht übernommen: Appreciative Inquiry (Stärken-Fokus verfehlt Bottleneck-Ziel), SECI (nur als Rahmen)
- [ ] Interview-Ziel und Erfolgskriterien (Verweis auf Output-Kontrakt oben)
- [ ] Phasenmodell mit Übergangsbedingungen
- [ ] Fragekatalog pro Phase mit Beispielfragen
- [ ] Umgang mit schwierigen Gesprächssituationen
- [ ] Abschnitt "Review-Ergebnis" wird nach erstem Eval-Lauf befüllt

### Deliverable 6: Eval-Harness
- [ ] Neuer Ordner `src/services/__evals__/interview/`
- [ ] Mindestens 3 Personas in `personas/`: Buchhalter-detailliert, Vertriebler-erzählend, IT-Support-wortkarg
- [ ] `runner.ts` treibt Interview gegen echten Agent-Service via Chat-Endpoint
- [ ] `metrics.ts` berechnet Slot-Coverage, # verorteter Bottlenecks, # generierter Use Cases
- [ ] `report.ts` erzeugt Markdown-Reports unter `docs/evals/interview/<datum>-<persona>.md`
- [ ] Neues NPM-Script `eval:interview` in `package.json`
- [ ] Eval ist nicht Teil der CI (LLM-Kosten), manuell vor Merge

### Deliverable 7: Unit-Tests
- [ ] Tests für neue Tool-Calls in `src/app/api/interview/[token]/chat/chat.test.ts`
- [ ] `register_step` → `step_tracker` enthält neuen Eintrag
- [ ] `record_slot` → Slot ist gefüllt mit Value und Evidence Quote
- [ ] `enter_coverage_check` → Phase wechselt, leere Slots werden zurückgegeben
- [ ] `link_bottleneck` → Pain Point hat `step_ref` im content-jsonb
- [ ] Bestehende Unit-Tests bleiben grün

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Mitarbeiter antwortet einsilbig ("Ja", "Weiß nicht") | Agent verwendet Laddering einmal, dann zur nächsten Frage, nicht endlos bohren |
| Mitarbeiter nennt nur einen Prozessschritt | Loop läuft trotzdem voll durch, `coverage_check` und `wrap_up` regulär |
| Mitarbeiter weicht vom Thema ab | Agent folgt kurz, kehrt mit Brücke zurück |
| Mitarbeiter erwähnt sensibles Thema | Agent bleibt neutral-wertschätzend, dokumentiert ohne Bewertung |
| Mitarbeiter liefert sehr ausführliche Antwort | Agent paraphrasiert komprimiert, bohrt an einem konkreten Punkt nach |
| Im `explore_step` kein konkretes Beispiel erhalten | Kein Übergang zu `quantify_step`, erneuter Konkretisierungsversuch mit anderer Formulierung |
| Slot wurde vom Modell ohne `evidence_quote` aufgerufen | `record_slot` weist ab (Validierung im Tool-Handler), Modell muss nachbessern |
| `step_tracker` enthält Duplikate (Modell ruft `register_step` zweimal) | Tool-Handler dedupliziert per `title`-Match (case-insensitive Trim) |
| Mitarbeiter verweigert Quantifizierung ("kann ich nicht sagen") | Slot bleibt null, Anreicherer-Guard verhindert Fehlbefüllung später |
| `coverage_check` zeigt 0 leere Pflicht-Slots | Agent springt direkt in `wrap_up` |
| Interview wird abgebrochen mitten in `process_loop` | `step_tracker` wird wie üblich persistiert, Reconnect setzt Loop fort |

## Technical Requirements
- Migration ist additiv (Default `[]` für `step_tracker`)
- Phase-Constraint erlaubt nach Migration ausschließlich die neuen 4 Werte plus historisch gemappte
- KI-Logik bleibt isoliert in `src/services/interviewAgent.ts` (Service-Layer-Constraint aus INDEX.md)
- Eval-Harness ist kein API-Endpoint, sondern reine Node-Skripte gegen lokale Dev-Instanz
- Eval-Lauf darf existierende Workspace-Daten nicht überschreiben (eigene Test-Workspace-ID)
- Kein UI-Change in PROJ-3 erforderlich (Phase-Namen-Mapping intern)

## Out of Scope

- Voice-TTS-Ausgabe des Agenten
- Mehrsprachige Interviews (aktuell nur Deutsch)
- Adaptive Persona-Anpassung in Echtzeit (z.B. Tonalitätswechsel je nach Antwortlänge)
- UI-Indikator für aktuelle Phase oder Slot-Coverage im Mitarbeiter-Interface
- Berater-Sicht auf laufende Interviews (Live-Coverage-Dashboard)
- Änderungen am Extraktions-Schema (PROJ-4) oder den Use-Case-Engine-Regeln (PROJ-6)
- Automatische Qualitätsbewertung einzelner Turns durch LLM-as-Judge
- CI-Integration des Eval-Harness (LLM-Kosten)

### Bewusst nicht übernommen: APQC Process Classification Framework (PCF)

Geprüft am 2026-05-23. Begründung:

- **Methodisch im Widerspruch zum Bottom-Up-Ansatz:** PCF ist Top-Down-Klassifikation. Eine PCF-Schablone im Interview würde die narrative Methodik (CIT/CTA) verwässern und Antworten in vorgegebene Schubladen drängen, statt sie aus der Mitarbeiter-Erfahrung entstehen zu lassen.
- **Skalen-Problem:** PCF endet meist auf Level 4-5 (z.B. "Receive Goods"). Mitarbeiter-Antworten liegen darunter ("Wareneingang im SAP buchen, weil Lieferschein per Mail kam"). Eindeutiges Mapping ist nicht trivial und würde Halluzinationen begünstigen.
- **KMU-Realität:** PCF ist Großkonzern-orientiert. Viele Prozesse in der Zielgruppe haben dort keinen sauberen Anker.
- **Falsche Stelle:** Klassifikation ist eine Cross-Interview-Concern (Aggregation, Benchmarking), keine Interview-Mechanik. Sie passt nachgelagert, nicht eingebettet.

PCF bleibt ein realistischer Kandidat für ein späteres eigenständiges Feature, z.B. ein `processClassification.ts`-Service, der nachgelagert auf bereits extrahierte `process_step`-Objekte einen PCF-Mapper anwendet (Embedding-basiert oder LLM-Klassifikator). Aktuell nicht als PROJ-15 vorgemerkt, wird bei Bedarf separat per `/write-spec` gezogen.

## Verifikation (Ende zu Ende)

1. Migration angewendet via `npx supabase migration up`; `interview_state.step_tracker` Spalte vorhanden, Phase-Constraint akzeptiert die neuen Werte.
2. Unit-Tests grün: `npx vitest run src` (alle bestehenden plus neue Chat-Route-Tests).
3. Eval-Harness ausführen: `npm run eval:interview`. Erwartung pro Persona: Pflicht-Slot-Coverage ≥ 80 %, mindestens 1 verorteter Bottleneck, mindestens 1 generierter Use Case.
4. E2E-Test in `tests/PROJ-3-interview-ui.spec.ts` läuft unverändert grün.
5. Manuelle Sichtung eines Eval-Reports unter `docs/evals/interview/<datum>-buchhalter.md`. Stichproben: Slot-Werte haben `evidence_quote`, der im Transkript wiederzufinden ist.
6. Dev-Smoke-Test: Lokal Interview starten, Konsole zeigt Tool-Calls in plausibler Reihenfolge, finales Interview erzeugt Use Cases mit gefüllten Pflichtfeldern.

## Reihenfolge der Implementierung

1. Migration + Datenbank-Typen
2. `interviewAgent.ts`: neue Tools, neuer System-Prompt, neues Phasen-Set
3. Chat-Route: State-Snapshot einspeisen
4. Unit-Tests
5. `docs/agent-procedures.md`
6. Eval-Harness
7. Eval-Lauf, ggf. Prompt-Iteration
8. Status-Update in INDEX.md (In Progress → In Review → Approved)

## Implementation Notes (Backend, 2026-05-23)

### Was gebaut wurde

**Deliverable 1 — Migration** `supabase/migrations/20260524000000_proj8_step_tracker.sql`
- `interview_state.step_tracker JSONB NOT NULL DEFAULT '[]'` hinzugefügt
- Phase-Constraint: `intro | exploration | deepdive | wrap_up` → `intro | process_loop | coverage_check | wrap_up`
- Backfill: `exploration | deepdive → process_loop`

**Deliverable 2 — `interviewAgent.ts` (vollständig neu strukturiert)**
- Neuer Phase-Typ: `'intro' | 'process_loop' | 'coverage_check' | 'wrap_up'`
- Neue Typen: `StepEntry`, `SlotValue`, `MissingSlot`, `SlotName`
- `computeMissingMandatorySlots()` als exportierte Utility-Funktion
- 4 neue Tools: `register_step`, `record_slot`, `enter_coverage_check`, `link_bottleneck`
- `record_slot` validiert `evidence_quote` serverseitig (min. 3 Zeichen)
- `register_step` dedupliziert per case-insensitive title-Match
- `buildTools` erhält jetzt `workspaceId` als zweiten Parameter (für `link_bottleneck`)
- System-Prompt vollständig neu strukturiert: modulare Methodik-Blöcke pro Phase

**Deliverable 3 — `chat/route.ts`**
- State-Query: `step_tracker` wird zusätzlich geladen
- `workspaceId` an `createInterviewStream` übergeben
- In Phase `coverage_check`: `computeMissingMandatorySlots` berechnet leere Pflicht-Slots, werden als `missingSlotsForCoverageCheck` in den Context eingespeist

**Deliverable 4 — `database.types.ts`**
- `interview_state.phase` auf neue Werte aktualisiert
- `step_tracker: Json` in Row/Insert/Update ergänzt

**Deliverable 5 — `docs/agent-procedures.md`** (neu erstellt)
- Wissenschaftliche Grundlagen (CIT, CTA, Contextual Inquiry, TODS)
- Phasenmodell mit Übergangsbedingungen
- Fragekatalog pro Phase
- Umgang mit schwierigen Situationen

**Deliverable 6 — Eval-Harness** `src/services/__evals__/interview/`
- 3 Personas: `buchhalter.ts`, `vertriebler.ts`, `it-support.ts`
- `runner.ts`: treibt Interview gegen localhost:3000, max 25 Turns
- `metrics.ts`: berechnet Slot-Coverage, Bottleneck-Anzahl, Use-Case-Anzahl
- `report.ts`: erzeugt Markdown-Reports unter `docs/evals/interview/<datum>-<name>.md`
- Neues NPM-Script: `eval:interview` (tsx runner.ts)

**Deliverable 7 — Unit-Tests**
- `src/services/interviewAgent.test.ts` (5 Tests): `computeMissingMandatorySlots` — alle grün
- `chat.test.ts` (2 neue Tests): step_tracker-Propagation + coverage_check-Injection — alle grün
- Alle bestehenden Tests bleiben grün

### Abweichungen vom Spec
- `reconnect/route.ts` wurde beim Erweitern von `InterviewContext` vergessen (fehlende Felder `workspaceId`, `stepTracker`). Nachträglich korrigiert (2026-05-23, Bugfix im Zuge PROJ-15-Build).
- `src/services/__evals__/interview/personas/vertriebler.ts`: Syntaxfehler (Apostroph in Single-Quoted-String). Nachträglich korrigiert (2026-05-23).
- Eval-Lauf (Deliverable 7 im Verifikationsplan) steht noch aus — erfordert laufende Dev-Instanz + Test-Workspace-Env-Vars.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Betroffene Systeme (kein UI-Change)

```
Datenbank
  └── interview_state (Supabase)
      ├── [bestehend] phase, timer_minutes, topics_covered, topics_open, extractions_log
      └── [NEU] step_tracker JSONB — Slot-Filling-Status pro Prozessschritt

Service-Layer: src/services/interviewAgent.ts
  ├── Phase-Typ (erweitert): intro | process_loop | coverage_check | wrap_up
  ├── InterviewContext (erweitert): + stepTracker Feld
  ├── buildSystemPrompt() — vollständig neu strukturiert (modulare Methodik-Blöcke)
  └── buildTools() — 4 neue Tools, bestehende unverändert oder erweitert
      ├── [bestehend] transition_phase → neue Phasen-Werte akzeptiert
      ├── [bestehend] update_topics → unverändert
      ├── [bestehend] complete_interview → unverändert
      ├── [NEU] register_step(title, role?) → legt Eintrag im step_tracker an
      ├── [NEU] record_slot(step_title, slot, value, evidence_quote) → füllt Slot mit Beleg
      ├── [NEU] enter_coverage_check() → Phasenwechsel + leere Pflicht-Slots zurückgeben
      └── [NEU] link_bottleneck(step_title, description, severity) → Pain Point mit Schritt verknüpfen

API-Route: src/app/api/interview/[token]/chat/route.ts
  ├── [ERWEITERT] State-Query: lädt zusätzlich step_tracker aus DB
  ├── [ERWEITERT] Context-Aufbau: step_tracker in Prompt eingespeist
  ├── [ERWEITERT] Bei Phase coverage_check: leere Pflicht-Slots zur Laufzeit eingespeist
  └── [bestehend] Streaming + onFinish-Flow unverändert

Eval-Harness: src/services/__evals__/interview/
  ├── personas/ (3 Personas: Buchhalter, Vertriebler, IT-Support)
  ├── runner.ts (treibt Interview gegen lokale Dev-Instanz)
  ├── metrics.ts (Slot-Coverage, Bottleneck-Anzahl, Use-Case-Anzahl)
  └── report.ts (Markdown-Report nach docs/evals/interview/)

Dokumentation: docs/agent-procedures.md
  └── Methodische Grundlagen + Phasenmodell + Fragekatalog + Edge-Cases
```

### Datenmodell

**Neues Feld `step_tracker` in `interview_state`:**

```
Array von Schritt-Objekten. Pro Eintrag:
  title:  string            — Bezeichnung des Prozessschritts
  role:   string | null     — optionale Rolle (z.B. "nur bei Rückläufern")
  status: exploring | quantifying | done

  slots (je null oder { value, quote }):
    frequency_per_month   — wie oft pro Monat?
    duration_minutes      — wie lange pro Durchlauf?
    rule_based            — immer gleich oder fallabhängig?
    data_sources          — welche Systeme/Datenquellen?
    error_rate_percent    — wie oft geht etwas schief?
    media_breaks          — wie oft manueller Systemwechsel?
```

**Erweiterung `knowledge_objects.content` (nur für Pain Points):**

```
step_ref: string | null — Titel des verknüpften Prozessschritts
```

**Phase-Constraint (Migration):**

```
Bisher:  intro | exploration | deepdive | wrap_up
Danach:  intro | process_loop | coverage_check | wrap_up
Backfill: exploration + deepdive → process_loop
```

### Tech-Entscheidungen

**JSONB statt separatem Table für `step_tracker`:** Der Tracker ist Interview-lokal. Es gibt keine cross-interview-Abfragen auf Slot-Ebene. JSONB spart eine JOIN-Query pro Turn und hält das Schema flexibel für spätere Slot-Erweiterungen.

**`record_slot` validiert `evidence_quote` serverseitig:** Wenn das Modell keinen Beleg liefert, gibt der Tool-Handler einen Fehler zurück. Der Grounding-Guard sitzt auf Tool-Ebene — robuster gegen Prompt-Drift.

**Leere Pflicht-Slots werden zur Laufzeit in die Chat-Route eingespeist:** In Phase `coverage_check` liest die Route den aktuellen `step_tracker`, berechnet fehlende Pflicht-Slots und injiziert sie als strukturierte Liste in den Prompt. Kein separater LLM-Call, keine neue API.

**`stopWhen: stepCountIs(1)` bleibt:** Mehrere Tool-Calls (z.B. `register_step` + `record_slot`) sind im gleichen Step möglich. Kein zweiter LLM-Step nach Tool-Results.

**Eval-Harness außerhalb CI:** Node-Skripte gegen lokale Dev-Instanz, eigene Test-Workspace-ID. LLM-Kosten machen CI-Integration unwirtschaftlich.

### Keine neuen Dependencies

Alle Deliverables sind mit dem bestehenden Stack umsetzbar: AI SDK (Tool Use), Zod, Supabase Admin. Einzige Änderung in `package.json`: neues Script `eval:interview`.

### Implementierungsreihenfolge

1. Migration (`step_tracker` + Phase-Constraint + Backfill)
2. `interviewAgent.ts` — neue Tools, neuer System Prompt, erweiterter Phase-Typ
3. `chat/route.ts` — State-Query + Context-Erweiterung
4. Unit-Tests (neue Tool-Calls)
5. `docs/agent-procedures.md`
6. Eval-Harness (`__evals__/interview/`)
7. Eval-Lauf + ggf. Prompt-Iteration

## QA Test Results

**QA Date:** 2026-05-23
**QA Result:** PRODUCTION-READY (no Critical or High bugs)

### Acceptance Criteria

| Deliverable | Status | Notes |
|-------------|--------|-------|
| D1: Migration (`step_tracker` + Phase-Constraint + Backfill) | PASS | Column added, backfill correct, constraint updated |
| D2: Tool-Erweiterung (`register_step`, `record_slot`, `enter_coverage_check`, `link_bottleneck`) | PASS | All 4 tools implemented, deduplication + evidence_quote validation working |
| D3: System Prompt (modulare Methodik-Blöcke) | PASS | All phases covered, slot-inventar embedded, Gesprächsregeln present |
| D4: Chat-Route-Anpassung | PASS | `step_tracker` loaded, injected; coverage_check phase computes missing slots |
| D5: `docs/agent-procedures.md` | PASS | CIT, CTA, Contextual Inquiry, TODS documented; Phasenmodell + Fragekatalog vollständig |
| D6: Eval-Harness | PASS (not run) | 3 personas, runner, metrics, report, `eval:interview` script — requires running dev server to execute |
| D7: Unit-Tests | PASS | 13 tests grün: 5 `computeMissingMandatorySlots` + 2 route-level + 6 neue Tool-Handler-Tests (BUG-1 fix) |

### Test Results

**Unit Tests (Vitest):**
- `src/services/interviewAgent.test.ts`: 5/5 passed — `computeMissingMandatorySlots` (all 3 mandatory slots missing, all filled, partial, multi-step, empty tracker)
- `src/app/api/interview/[token]/chat/chat.test.ts`: 9/9 passed — includes 2 new PROJ-8 tests: `step_tracker` propagation to context, `missingSlotsForCoverageCheck` injection in coverage_check phase

**Pre-existing failures (not PROJ-8 regressions):**
- `src/app/api/interviews/interviews.test.ts`: 4 failing — mock chain missing `.order()`. Was failing before PROJ-8 (9 failures before, 4 now). PROJ-8 reduced failure count by fixing some mock paths.

**E2E Tests (Playwright):**
- PROJ-3 regression: 8/48 passed without dev server. Pre-existing issue — tests timeout on page.fill without a running app instance.

### Bugs Found

**BUG-1 (Medium) — Missing tool handler unit tests** ✅ FIXED 2026-05-23
`buildTools` exported. `interviewAgent.test.ts` auf `vi.hoisted`-Mock umgestellt. 8 neue Tool-Handler-Tests hinzugefügt (register_step: add + dedup; record_slot: fill + grounding guard + auto-done; enter_coverage_check: missing slots + all_covered; link_bottleneck: insert + extractions_log). 13/13 grün.

**BUG-2 (Low) — Step `status` field never reaches `'done'`** ✅ FIXED 2026-05-23
`record_slot` prüft jetzt nach dem Slot-Update via `MANDATORY_SLOTS.every(...)` ob alle Pflicht-Slots gefüllt sind. Falls ja, wird `status: 'done'` im selben DB-Update gesetzt (kein zweiter Schreibvorgang).

**BUG-3 (Low) — `link_bottleneck` pain points not tracked in `extractions_log`** ✅ FIXED 2026-05-23
`link_bottleneck` liest nach dem `knowledge_objects`-Insert den aktuellen `extractions_log` aus `interview_state`, hängt einen `RawExtraction`-Eintrag (`type: 'pain_point'`, `source_quote: ''`) an und schreibt ihn zurück. System-Prompt in Folge-Turns zeigt den Bottleneck, Duplikat-Risiko beseitigt.

### Security Audit

- Token UUID regex validation before any DB lookup: OK
- Rate limiting applied: OK
- Supabase parameterized queries (no SQL injection surface): OK
- `workspaceId` sourced from DB-loaded interview row, not from model input — `link_bottleneck` cannot insert into arbitrary workspaces: OK
- `evidence_quote` validated at Zod schema level (min 3) and in execute body (redundant guard): OK
- Tool inputs (step_title, description, severity) stored in JSONB, not rendered as HTML: OK
- Admin client used server-side only, not exposed to user: OK

**Post-QA Security Fixes (2026-05-23):**
- `src/services/interviewAgent.ts`: `sanitizeForPrompt()` auf LLM-generierte Felder (`title`, `role`) in `formatStepTracker()` angewendet — verhindert Prompt-Injection via manipuliertem step_title
- `src/services/__evals__/interview/runner.ts`: UUID-Guard + aufgetrennte REST-Queries in `fetchCounts()` — ersetzt direkte String-Interpolation von `interviewId` in Supabase-URL
- `.env.local.example`: Eval-Env-Vars (`TEST_INTERVIEW_TOKEN`, `TEST_INTERVIEW_ID`, `TEST_WORKSPACE_ID`, `EVAL_BASE_URL`) als auskommentierte Vorlage ergänzt
- `next.config.ts`: `'unsafe-eval'` aus CSP `script-src` entfernt (Pre-Step für PROJ-15)

### Regression Check

PROJ-3 (Interview UI) UI unchanged — no PROJ-3 code touched. Route API backward-compatible (step_tracker defaults to `[]` for existing state rows). PROJ-4/PROJ-6 pipelines unaffected (extraction and use case engine unchanged).

### Eval Harness (Run 2026-05-24)

**Run date:** 2026-05-24
**Model used:** `google/gemini-3.1-flash-lite` (INTERVIEW_MODEL in .env.local)
**Infrastructure:** localhost:3000 (Next.js 16.1.1 Turbopack), Supabase project `ktatfdrhasohxkpiawrz`, workspace `Testing`

| Persona | Schritte | Ø Pflicht-Cov. | Ø Optional-Cov. | Bottlenecks | UCs | Pass/Fail |
|---|---|---|---|---|---|---|
| buchhalter | 1 | 67 % | 33 % | 1 | 0 | ❌ FAIL |
| vertriebler | 0 | 0 % | 0 % | 0 | 0 | ❌ FAIL |
| it-support | 3 | 33 % | 11 % | 0 | 0 | ❌ FAIL |

**Alle drei Personas verfehlen den Output-Kontrakt.** Reports unter `docs/evals/interview/2026-05-24-*.md`.

**Auffälligkeiten:**

1. **Empty-Agent-Turns**: Agent ruft Tools auf (register_step, record_slot) ohne anschließend Text zu generieren. Der streaming consumer in runner.ts konsumiert diese Turns als leere Strings, was das 25-Turn-Limit verbrennt ohne Fortschritt. Buchhalter: Turns 3, 7, 11, 14, 22-25 leer. IT-Support: Turns 14-25 alle leer (12 von 25 Turns verbraucht).

2. **Vertriebler-Default-Loop**: `responses['default']` der Vertriebler-Persona ist die Selbstvorstellung ("Hi, ich bin Sandra..."). Da die Begrüßung des Agenten kein Keyword trifft, gibt der Selector in jedem Turn `default` zurück → Agent begrüßt erneut → Selector gibt wieder `default` → perfekte Endlosschleife über alle 25 Turns.

3. **Selector-Loop bei Buchhalter**: Nachdem die Frequenz-Antwort gegeben wurde, fragt der Agent weiter nach Frequenz (umformuliert mit "Monat"/"Mal"). Selector erkennt diese Keywords und gibt erneut die Frequenz-Antwort zurück, statt zur nächsten Frage weiterzugehen. Turns 16-20: 5 identische Frequenz-Antworten in Folge.

4. **Kein wrap_up erreicht**: Alle drei Runs treffen das 25-Turn-Limit. Da `wrap_up` nie eintritt, wird der Use-Case-Generator nicht getriggert → 0 Use Cases in allen Runs.

5. **Nur 1 Schritt beim Buchhalter**: Agent blieb in Kreditorenbuchhaltung, hat Debitoren und Monatsabschluss nie exploriert, obwohl die Persona diese in Turn 1 erwähnt hat.

**Bugs aus dem Eval-Lauf:**

**BUG-4 (High) — Agent generiert keinen Text nach Tool-Calls**
Agent ruft `register_step`/`record_slot` auf und sendet danach keine Text-Antwort mehr. Runner.ts bekommt einen leeren String zurück, schickt als nächstes den `default`-Persona-Response, und der Agent befindet sich in einem inkonsistenten Zustand (hat Tool aufgerufen, wartet ggf. auf weitere Bestätigung). Fix: System-Prompt muss explizit fordern: "Nach jedem Tool-Call MUSS eine Textantwort an den Nutzer folgen." Alternativ: Konversations-Histerie prüfen ob letzter Agenten-Turn leer war, und nochmals senden. → Prompt-Tuning, kein Code-Fix.

**BUG-5 (High) — Vertriebler `default`-Response ist die Selbstvorstellung**
`personas/vertriebler.ts` hat `responses['default']` = Einleitung "Hi, ich bin Sandra...". Da der Selector keinen Keyword-Match findet, wird dieser Response immer wieder gesendet, was einen Boot-Loop erzeugt. Fix: `default`-Response aller Personas muss eine neutrale Aussage sein, die das Interview vorwärtsbewegt (z.B. ein Prozessbeschreibungs-Response). → Persona-Datei ändern.
**→ Strukturell gefixt durch PROJ-17:** Der Keyword-Selector-Mechanismus wurde vollständig ersetzt. Die neuen Persona-Dateien (`src/services/__evals__/interview/personas/`) verwenden kein `responses`-Objekt mehr — Claude Code antwortet adaptiv auf Basis des `processKnowledge`-Schemas.

**BUG-6 (Medium) — Selector hat kein Gedächtnis, ob ein Slot bereits beantwortet wurde**
Wenn der Agent eine Frage zum selben Slot erneut stellt (auch leicht umformuliert), gibt der Selector denselben Response zurück, statt zu eskalieren oder weiterzugehen. Mehrfach-Antworten auf dieselbe Frage verbrennen Turns ohne neue Information. Fix: Selector könnte einen lokalen Set "already answered" tracken und bei erneutem Match auf `default` switchen. → Runner-Code-Änderung (Rücksprache nötig per Handoff-Regeln).
**→ Strukturell gefixt durch PROJ-17:** Kein Selector mehr vorhanden. Claude Code als Persona interpretiert Fragen kontextuell und gibt keine Slot-keyed Duplikat-Antworten zurück.

**Einschätzung:**
BUG-4 und BUG-5 sind die Ursache für alle drei Fail-Verdicts. BUG-4 (Prompt-Fix) und BUG-5 (Persona-Fix) wären die prioritären Iterationen vor einem Re-Run. PROJ-8-Status bleibt "Deployed" — die Infrastruktur ist korrekt, die Qualitätsschwellen sind jedoch nicht erreicht. Empfehlung: Prompt-Tuning-Session + Persona-Fix vor Re-Run.
**Update 2026-05-25 (PROJ-17):** BUG-5 und BUG-6 sind durch die Ablösung des Keyword-Selectors strukturell gefixt. Der neue Eval-Harness-Ansatz (adaptive Claude-Code-Persona) ist in PROJ-17 dokumentiert.

## Deployment

**Date:** 2026-05-24
**Vercel deployment:** `dpl_D2oUimKCgHxjh9yb9geQxBG2vA5B` (production, region fra1, build 63s)
**Production aliases:**
- https://meridian-app-tau.vercel.app
- https://meridian-app-roly-bach.vercel.app
- https://meridian-app-git-main-roly-bach.vercel.app (branch alias)

**Inspector:** https://vercel.com/roly-bach/meridian-app/D2oUimKCgHxjh9yb9geQxBG2vA5B

### Deployed commits

```
27dce58 docs(PROJ-16):  Add Supabase Hardening + Dependency Hygiene spec
00cd348 chore(deps):    Bump Next.js to 16.2.6 + npm overrides → 0 audit issues
7a8ca6c chore(claude):  Add pre-deploy and post-migration reminder hooks
690c192 docs(PRD):      ElevenLabs Scribe v2 statt Whisper
6e40262 feat(PROJ-8):   Interview-Design Re-Architektur with slot-coverage tool-use
55a77a2 chore:          Ignore Playwright test artifacts
604b5e3 chore(PROJ-15): Revert nonce-CSP attempt, document Next.js 16.1.1 blocker
4689d8e test(PROJ-15):  QA test results for CSP Hardening (pre-existing)
753e26a test(PROJ-8):   QA test results for Interview-Design Optimierung (pre-existing)
```

### Database migration

Migration `20260524121453_proj8_step_tracker` (adds `interview_state.step_tracker JSONB`, updates phase constraint from `intro|exploration|deepdive|wrap_up` to `intro|process_loop|coverage_check|wrap_up`, backfills existing rows) applied to Supabase project `Meridian MVP` via MCP prior to the push so that the new backend never queries the old schema. Verified via `mcp__supabase__list_migrations`.

### Pre-deploy gate state

- 197 unit tests green
- `npm run lint` (tsc --noEmit) clean
- `npm audit` → 0 vulnerabilities (Next.js bump 16.1.1 → 16.2.6 + transitive overrides)
- Production build succeeded locally with the same Next.js version

### Known limitations carried into production

- **PROJ-15 CSP Hardening still Blocked.** Production CSP keeps `'unsafe-inline'` in `script-src` because Next.js 16.x silently drops custom response headers set from `proxy.ts`. `'unsafe-eval'` is gone — actual delta vs. pre-PROJ-15 is the eval removal. See [PROJ-15-csp-hardening.md](PROJ-15-csp-hardening.md) for the full debug history.
- **Supabase advisor findings deferred to PROJ-16.** 5 security WARN (no CRITICAL) and 17 performance WARN/INFO are tracked in [PROJ-16-supabase-hardening.md](PROJ-16-supabase-hardening.md) as a dedicated follow-up sprint.

### Post-deploy verification

Vercel reports `state: READY`, `readyState: READY` at 2026-05-24 ~14:42 (CET). The production aliases respond — direct anonymous `curl` returns 401 because the Vercel team has deployment protection enabled on this project; authenticated browser access works via the Vercel SSO bypass.


## ADR-009 Implementation (2026-05-27)

ADR-009 umgesetzt (D1–D6, 2026-05-27). Eval-Verifikation pending.

**D1 — READ_ONLY_STATE in `buildDynamicContext`:** In `walkthrough_step` erscheinen im Kontext nur bereits gefüllte Slots und Walkthrough-Daten. Leere Felder werden nicht eingespeist, um Observable-Goal-Pull zu vermeiden. In allen anderen Phasen bleibt der volle Schritt-Tracker sichtbar.

**D2 — Phasenblock aus `buildStaticPrompt` in `buildDynamicContext` verschoben:** `buildStaticPrompt()` ist jetzt parameterlos und invariant (nur: Persona, turn_format, silence, tools — kein `<examples>`-Block mehr). Alle 6 Phasenmethodik-Blöcke sind in der neuen Funktion `buildPhaseMethodology(phase)` und werden pro Turn in `buildDynamicContext` injiziert. Provider-Branching in `createInterviewStream` vereinheitlicht: beide Pfade nutzen static in system + dynamic im letzten User-Turn; Fallback auf system wenn messages leer.

**D3 — Tool-Beschreibung `record_slot` phasenabhängig:** Description explizit: walkthrough_step nur bei spontaner Nennung, slot_completion/coverage_check aktiv nachfragen.

**D4 — Anti-Anker-Constraint im `<silence>`-Block:** Explizites Verbot von Zahlenvorschlägen des Agenten mit Falsch/Richtig-Beispielen.

**D5 — Exception-Klassifikation in walkthrough_step-Methodik:** Explizite Regel: Ausnahmen/Sonderfälle sind friction_points auf dem aktuellen Prozess, kein register_step-Kandidat. Mit Falsch/Richtig-Beispiel.

**D6 — Few-Shot-Beispiele als `WALKTHROUGH_EXAMPLES`-Konstante:** 4 annotierte Beispiele im `<EXAMPLE phase="walkthrough_step">`-Format (ADR D6), nur in walkthrough_step am Ende des dynamischen Kontexts injiziert. EXAMPLE 1 zeigt explizit den `update_walkthrough_data`-Aufruf für Exception-Klassifikation (D5). Der alte `<examples>`-Block (Beispiele 1–6) wurde aus `buildStaticPrompt` entfernt — D2 + D6 compliant. Inhalte sind redundant mit WALKTHROUGH_EXAMPLES, `<silence>`-Antiankerpflicht und `buildPhaseMethodology`-Sektionen.

**D1 — Bewusste Abweichung (dokumentiert):** walkthrough_step zeigt gefüllte Slots via READ_ONLY_STATE statt vollständigem Ausblenden. Architect-Empfehlung (ADR-009 Alternative B), begründet durch Doppel-Frage-Risiko. ADR markiert das als offene Frage "nach Eval-Verifikation entscheiden".

## ADR-008 Follow-up (2026-05-27)

Eval-Lauf `docs/evals/interview/2026-05-26-buchhalter-2.md` hat gezeigt, dass PROJ-8 Metadaten erhebt, aber keinen Prozessablauf. ADR-008 (accepted 2026-05-27) adressiert das:

- `walkthrough_step` als neue Hauptphase ersetzt `quantify_step` — Agent führt den Mitarbeiter durch 5 Leitfragen (Einstieg, Ablauf, Reibung, Ursache, Priorität) und quantifiziert opportunistisch
- `slot_completion` als schlanke Nachphase für verbleibende Pflichtslots
- Neue `StepEntry`-Felder: `process_steps`, `friction_points`, `friction_tools`, `pain_point_primary`
- `SlotValue` um `confidence` + `qualifier` erweitert (Slot-Konfidenz für ROI-Darstellung)
- `data_sources` Pflichtslot (war optional)
- Opener-/Silence-/Lead-Constraints (D4–D7): kein "Meridian", Framing auf Arbeitserleichterung, Coverage-Check intern, Agent führt statt Erlaubnis zu fragen

Implementierungsdetails: [ADR-008](../../docs/adr/ADR-008-interview-engine-prozessablauf-slot-konfidenz-interviewer-disziplin.md)

## Post-Mortem
| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — |
| Häufigste Fehlerkategorie im Loop | — |

_ohne Backfill, vor v2-Migration deployed_