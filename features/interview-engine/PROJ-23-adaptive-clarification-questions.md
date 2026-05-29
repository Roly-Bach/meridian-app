# PROJ-23: Adaptive Clarification Questions

## Status: Planned
**Type:** Extension
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** M (3-5d)
**Bugs:** —
**Created:** 2026-05-29
**Last Updated:** 2026-05-29

## Dependencies
- **Hard Prerequisite: PROJ-22** (ADR-011 Dual-Loop Implementierung) — Analyst-Komponente, `produce_briefing`-Schema mit `clarification_cards`, `clarification`-Phase im Orchestrator müssen existieren bevor PROJ-23 gebaut werden kann
- Requires: PROJ-2 (Interview Engine Backend) — interview state, phase management, Analyst tool-call pipeline
- Requires: PROJ-3 (Interview UI) — ChatInterface, ChatInput (wird konditionell ersetzt)
- Requires: ADR-011 Amendment A (2026-05-29) — `clarification` Phase in State Machine (D4, D12, D3) — implementiert durch PROJ-22
- Enables: PROJ-6 (Use Case Engine) erhält vollständigere Slot-Daten für ROI-Berechnung

## Context

Nach dem Interview fehlen ROI-relevante Slots (`frequency_per_month`, `duration_minutes`, `rule_based`, `error_rate_percent`) häufig oder sind unvollständig — Mitarbeiter nennen Zahlen nicht spontan im Gespräch. Außerdem erwähnt der Agent manchmal Prozessschritte die nie formal registriert wurden, oder lässt potenzielle Schritte offen.

Die Clarification Phase füllt diese Lücken am Ende des Interviews strukturiert auf, ohne den Gesprächsfluss zu unterbrechen: Klickbare Cards statt Freitext, direkt nach `wrap_up`, maximal 8 Items.

## User Stories

- Als **Mitarbeiter (interviewte Person)** möchte ich am Ende des Interviews kurze Bestätigungsfragen per Klick beantworten, damit ich nicht nochmals tippen muss.
- Als **KI-Berater** möchte ich dass alle ROI-relevanten Slots für jeden Prozessschritt gefüllt sind, damit Use Cases mit echten Zahlen belegt werden.
- Als **Mitarbeiter** möchte ich bestätigen oder verneinen ob ein erwähnter aber nicht registrierter Prozessschritt tatsächlich zu meinem Workflow gehört.
- Als **KI-Berater** möchte ich sehen dass ein Interview die Clarification Phase abgeschlossen hat, damit ich die Vollständigkeit der Daten beurteilen kann.

## Acceptance Criteria

- [ ] Interview wechselt nach Abschluss von `wrap_up` in Phase `clarification`, wenn Analyst ≥1 ClarificationCard generiert hat (ADR-011 A-D4)
- [ ] Chat-Input wird ausgeblendet wenn Phase = `clarification`; stattdessen rendert `ClarificationCards`-Komponente
- [ ] Initialnachricht oben in der Clarification-View: *"Noch ein paar kurze Bestätigungen zu dem was wir besprochen haben."*
- [ ] **Slot-Cards** (fehlende Werte): zeigen Step-Titel + Frage + 2–4 klickbare Optionen + immer Option "Weiß ich nicht"
  - `frequency_per_month`: Optionen "Täglich", "Wöchentlich", "Mehrfach/Monat", "Monatlich", "Weiß ich nicht"
  - `duration_minutes`: Optionen "< 5 Min", "5–15 Min", "15–30 Min", "> 30 Min", "Weiß ich nicht"
  - `rule_based`: Optionen "Immer gleich", "Meistens gleich", "Variiert stark", "Weiß ich nicht"
  - `error_rate_percent`: Optionen "Selten Fehler", "Gelegentlich", "Häufig", "Weiß ich nicht"
- [ ] **Open-Item-Cards** (offene Punkte, fehlende Schritte): zeigen Frage + Optionen "Ja", "Nein", "Manchmal"
- [ ] "Weiter"-Button ist deaktiviert bis alle Cards beantwortet sind
- [ ] POST `/api/interview/[token]/clarification` schreibt Slot-Antworten in `knowledge_objects` (update bestehende Einträge); Open-Item "Ja"/"Manchmal" registriert fehlenden Step via bestehendem `register_step`-Flow
- [ ] Nach Submit: Orchestrator setzt `status=completed`, `extractions_pending=true`
- [ ] Hard-Stop (Timer Trigger A): Clarification Phase wird übersprungen → direkt `completed`
- [ ] Analyst generiert 0 Cards: Clarification Phase übersprungen → direkt `completed`
- [ ] Bei Seiten-Reload während Clarification: bereits beantwortete Cards bleiben erhalten (Zustand in `interview_state.clarification_answers`)
- [ ] Max. 8 Cards pro Interview (Analyst priorisiert nach Use-Case-Relevanz der fehlenden Slots)

## Edge Cases

- **Analyst noch nicht fertig wenn wrap_up abgeschlossen**: Orchestrator findet keine `clarification_cards` → fallback direkt `completed` (kein Warten, kein Blocking)
- **Alle Slots bereits gefüllt**: Analyst generiert 0 Cards → Phase wird übersprungen
- **User antwortet "Weiß ich nicht" auf alle Cards**: Submit trotzdem möglich; Slots bleiben `null`, kein Fehler
- **Open-Item "Nein"**: kein Register, kein Fehler, Card als beantwortet markiert
- **Mehr als 8 potenzielle Cards**: Analyst priorisiert — zuerst Slots mit direktem ROI-Impact (`frequency_per_month`, `duration_minutes`), dann `rule_based`, dann `error_rate_percent`, zuletzt Open Items
- **Token abgelaufen während Clarification**: API gibt 410 zurück; UI zeigt Fehler-Screen (wie bestehender `ChatErrorScreen`)
- **Interview bereits `completed` wenn Clarification-Submit kommt**: API ignoriert, gibt 409 zurück (idempotent)

## Technical Requirements

- Neue Phase `clarification` im Interview State Machine (ADR-011 Amendment A) — kein neues DB-Schema nötig, `interview_state.clarification_answers` als JSONB-Feld
- Analyst-Extension: `produce_briefing` structured output erhält optionales Feld `clarification_cards: ClarificationCard[]` (ADR-011 A-D3)
- Neuer Endpoint: `POST /api/interview/[token]/clarification` — auth via Token (wie `/chat`), Zod-Validierung
- UI-Komponente: `src/components/interview/ClarificationCards.tsx` — shadcn `Button` für klickbare Options, shadcn `Card` pro Item
- Langfuse-Span `interview.clarification` pro Submit (PROJ-13 D11 Extension)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

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
