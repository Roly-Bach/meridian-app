# PROJ-8: Interview-Design Optimierung

## Status: Planned
**Created:** 2026-05-20
**Last Updated:** 2026-05-21

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — Agent-Service, System Prompt, Phasenmodell
- Test-Dependency: PROJ-3 (Interview UI) — kein Code-Change, aber E2E-Tests laufen gegen das UI

## User Stories
- Als Entwickler möchte ich die Interview-Methodik in einem dedizierten Dokument (`docs/agent-procedures.md`) lesen können, damit ich Änderungen am System Prompt nachvollziehen und begründen kann.
- Als Berater möchte ich, dass der Interview-Agent wissenschaftlich fundierte Fragetechniken anwendet, damit ich qualitativ hochwertigeres Prozesswissen mit konkreten Bottlenecks extrahiere.
- Als Mitarbeiter möchte ich, dass das Interview einem natürlichen Gesprächsfluss folgt, damit ich mich gehört fühle und nicht befragt.
- Als Entwickler möchte ich ein Review-Interview mit synthetischen Eingaben durchführen können, um zu validieren, dass das neue Interview-Design die gewünschten Erkenntnisse liefert.

## Acceptance Criteria

### Deliverable 1: `docs/agent-procedures.md`

- [ ] Neue Datei `docs/agent-procedures.md` erstellt — "Single Source of Truth" für Agent-Verhalten
- [ ] Dokument enthält folgende Abschnitte:
  - Wissenschaftliche Grundlagen (begründete Methodenauswahl mit Erklärung, was übernommen wurde und was nicht)
  - Interview-Ziel und Erfolgskriterien
  - Phasenmodell (intro / exploration / deepdive / wrap_up) mit Beschreibung, Zielen und Übergangsbedingungen je Phase
  - Fragekatalog pro Phase mit konkreten Beispielfragen
  - Fragetechniken (Laddering, Paraphrasierung, Short-Answer-Handling, Halluzinations-Guard)
  - Umgang mit schwierigen Gesprächssituationen
- [ ] `buildSystemPrompt()` in `interviewAgent.ts` enthält einen Kommentar, der auf `docs/agent-procedures.md` verweist
- [ ] Folgende Methoden werden im Dokument bewertet und ihre Übernahme begründet: Critical Incident Technique (CIT), Cognitive Task Analysis (CTA), SECI-Modell, TODS, Appreciative Inquiry

### Deliverable 2: Überarbeiteter System Prompt (`buildSystemPrompt()`)

- [ ] **Fragekatalog pro Phase** im System Prompt verankert — konkrete Beispielfragen statt genereller Beschreibung
- [ ] **Konkret-Abstrakt-Prinzip**: Agent fragt zuerst nach konkreten Beispielen ("Erzählen Sie mir von einem typischen Montag..."), nicht nach abstrakten Prozessen
- [ ] **Short-Answer-Handling**: Bei einsilbigen oder ausweichenden Antworten verwendet der Agent eine Vertiefungstechnik (z.B. Laddering: "Was passiert dann?", "Warum ist das so?") bevor er zur nächsten Frage wechselt
- [ ] **Paraphrasierung**: Agent paraphrasiert Antworten vor Folgefragen um Verständnis zu signalisieren
- [ ] **Halluzinations-Guard**: Agent vermeidet Interpretationen und fragt stattdessen nach ("Habe ich das richtig verstanden, dass...")
- [ ] **Wrap-Up-Qualität**: Zusammenfassung am Ende enthält konkrete Prozessschritte und identifizierte Bottlenecks, nicht nur Themen
- [ ] **Tiefbohr-Regeln**: Bei vagen Antworten gezielt nachbohren mit Laddering-Technik

### Deliverable 3: Review-Interview

- [ ] Ein Test-Interview wurde mit synthetischen Eingaben (simulierter Mitarbeiter) vollständig durchgeführt
- [ ] Das Ergebnis wurde manuell bewertet: Enthält die Interview-Zusammenfassung konkrete Prozessschritte und mindestens einen identifizierten Bottleneck?
- [ ] Befund ist dokumentiert (kurze Notiz in `docs/agent-procedures.md` unter einem Abschnitt "Review-Ergebnis")

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Mitarbeiter antwortet einsilbig ("Ja", "Weiß nicht", "Keine Ahnung") | Agent verwendet Short-Answer-Handling: Vertiefungstechnik, kein sofortiger Themenwechsel |
| Mitarbeiter weicht vom Thema ab | Agent folgt kurz dem Faden, kehrt dann sanft mit Brücke zurück ("Das ist interessant — bezogen auf Ihren Hauptprozess...") |
| Mitarbeiter erwähnt sensibles Thema (Konflikt, Fehler, Kollegen) | Agent bleibt neutral-wertschätzend, dokumentiert ohne Bewertung, fragt sachlich weiter |
| Mitarbeiter liefert sehr ausführliche Antwort | Agent paraphrasiert komprimiert, bestätigt Verständnis, bohrt an einem konkreten Punkt nach |
| Agent hat in der Exploration-Phase noch kein konkretes Beispiel erhalten | Agent wechselt nicht in Deepdive, sondern wiederholt Konkretisierungsversuch mit anderer Formulierung |

## Technical Requirements

- Keine Datenbankschema-Änderungen
- Keine neuen API-Endpunkte
- Änderungen ausschließlich an `src/services/interviewAgent.ts` → `buildSystemPrompt()`
- Neues Dokument: `docs/agent-procedures.md`
- Überarbeiteter System Prompt muss mit bestehenden E2E-Tests in `tests/PROJ-3-interview-ui.spec.ts` kompatibel sein

## Out of Scope

- Voice-TTS Ausgabe des Agenten
- Mehrsprachige Interviews (aktuell nur Deutsch)
- Adaptive Fragestrategie via separatem ML-Modell
- Automatische Qualitätsbewertung einzelner Turns
- Änderungen am Phasenmodell (intro / exploration / deepdive / wrap_up bleibt wie in PROJ-2 definiert)
- UI-Änderungen am Interview-Interface

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
