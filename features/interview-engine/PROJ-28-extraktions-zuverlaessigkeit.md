# PROJ-28: Extraktions-Zuverlässigkeit

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** M (3–5d)
**Bugs:** —
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Traceability
- BL-E2.1 (Nicht-Befund-Marker) · REQ-013
- BL-E2.2 (Konfidenz-Inversion) · REQ-019

## Dependencies
- Requires: PROJ-22 (Dual-Loop Interview Engine) — Analyst-Komponente schreibt Slots, Talker liest Briefing
- Requires: PROJ-25 (Prozesswissens-Schema O1–O5) — Schema-Felder müssen Nicht-Befund-Marker aufnehmen können
- Requires: PROJ-27 (Schema-Bindung + verlustfreie Speicherung) — stabiles Schritt-Schema als Schreibziel

## Context

Zwei isolierbare Defekte in der Extraktions-Pipeline:

**Defekt 1 (BL-E2.1):** Felder ohne Transkriptbeleg erhalten schlicht `null`. `null` ist maschinell nicht von „nicht gefragt" unterscheidbar. Die Engine kann dadurch nicht angeben, ob ein Feld absichtlich leer gelassen wurde (kein Beleg vorhanden) oder noch gar nicht adressiert wurde. Halluzination (Feldwert ohne Beleg) und echter Nicht-Befund sehen identisch aus.

**Defekt 2 (BL-E2.2):** Die Konfidenz pro Slot (`confirmed` / `estimate` / `unknown`) wird zwar erfasst, aber nicht als Nachfrage-Steuergröße genutzt. Schlimmer: die Slot-Completion-Methodik enthält die explizite Regel „NICHT mehr nachfragen wenn Slot bereits mit confidence=estimate erfasst ist. Nur bei echtem `null`." (`interviewAgent.ts:388`). Das ist die Inversion — ein `estimate`-Slot (unsicherer Wert) erzeugt keine Rückfrage, ein `null`-Slot (noch nicht adressiert) schon. Zusätzlich gated `computeWalkthroughSlotTarget` auf `=== null`, schließt `estimate`/`unknown` also ebenfalls aus.

Beide Defekte werden unabhängig voneinander behoben, laufen aber in derselben Bau-Einheit durch, da sie beide den Analyst/Schreibpfad und den Talker-Prompt betreffen.

## Scope

### BL-E2.1 — Expliziter Nicht-Befund-Marker

Ein Feld ohne Transkriptbeleg erhält einen dedizierten Marker, der maschinell von einem befüllten Feld (`SlotValue` mit `value`) unterscheidbar ist. Mögliche Realisierung: `{ absent: true, reason: 'no_evidence' | 'refused' }` als Sentinel-Typ neben `SlotValue | null`. Die genaue Typ-Wahl ist Architekturentscheidung (`/architecture`).

Der Marker wird gesetzt, wenn:
- Der Analyst explizit bestätigt, dass die Frage adressiert wurde, aber kein belegbares Wertangebot vorlag
- Der Befragte die Auskunft verweigert hat

Das starke Evidence-Grounding (`applyGroundingGuard`, `evidence_span`-Verbatim-Check, ADR-015) bleibt unangetastet. Der Marker ergänzt das Grounding — er greift, wenn das Grounding einen Wert ablehnt.

Out of Scope: Nicht-Befund-Marker für O1–O5-Felder (PROJ-25) — nur für bestehende quantitative Slots.

### BL-E2.2 — Konfidenz-Inversion beheben

Die Prompt-Regel in `slot_completion` wird umgekehrt:
- **Vorher:** `NICHT mehr nachfragen wenn Slot bereits mit confidence=estimate erfasst ist. Nur bei echtem null.`
- **Nachher:** Slots mit `confidence=estimate` oder `confidence=unknown` sind Nachfrage-Ziele; Slots mit `confidence=confirmed` sind abgeschlossen.

`computeWalkthroughSlotTarget` (`interviewAgent.ts:112`) wird erweitert: statt nur `=== null` werden auch `estimate`- und `unknown`-Slots als offen behandelt, mit niedrigerer Priorität als echte `null`-Slots.

Die Slot-Target-Hinweistexte im Prompt werden für `estimate`-Slots angepasst: statt „noch fehlend" heißt es „unsicher belegt — kurze Bestätigung einholen".

## User Stories

- Als **Entwickler** möchte ich Nicht-Befund-Felder maschinell von noch-nicht-adressierten Feldern unterscheiden, damit Coverage-Metriken und Eval-Scores korrekt rechnen.
- Als **KI-Berater** möchte ich dass der Agent bei unsicheren Feldwerten nachfragt statt sie als gesichert zu behandeln, damit der Erhebungsstand verlässlich ist.
- Als **Mitarbeiter (interviewte Person)** möchte ich dass der Agent nicht mit Schein-Sicherheit falsche Zahlen festhält, sondern offen nachfragt wenn er sich nicht sicher ist.
- Als **Entwickler** möchte ich im Eval messen, dass Halluzinationsrate < 1 % und konfidenzgesteuerte Rückfragen korrekt ausgelöst werden, damit beide Defekte automatisch regressionsgeprüft sind.

## Acceptance Criteria

### BL-E2.1 — Nicht-Befund-Marker

- [ ] Es existiert ein dedizierter Typ/Sentinel, der `{ absent: true }` signalisiert — maschinell von `SlotValue` (befüllt) und `null` (noch nicht adressiert) unterscheidbar
- [ ] Der Analyst setzt diesen Marker, wenn `applyGroundingGuard` einen Wert ablehnt und das Feld im aktuellen Turn aktiv adressiert wurde
- [ ] Felder mit Marker erscheinen im Slot-Tracker als „nicht belegbar" — nicht als offene Lücke für erneute Nachfrage
- [ ] Halluzinationsrate (Feldwerte ohne Verbatim-Beleg im Transkript) < 1 % gemessen im Eval (`npm run eval:interview buchhalter`)
- [ ] `applyGroundingGuard` und `evidence_span`-Check bleiben unverändert

### BL-E2.2 — Konfidenz-Inversion

- [ ] Die Prompt-Zeile `NICHT mehr nachfragen wenn Slot bereits mit confidence=estimate erfasst ist` ist entfernt oder umgekehrt
- [ ] `computeWalkthroughSlotTarget` gibt `estimate`/`unknown`-Slots als Nachfrage-Ziele zurück (nach allen `null`-Slots in der Priorität)
- [ ] Slot-Target-Hinweistexte unterscheiden zwischen fehlendem Slot und unsicher belegtem Slot
- [ ] Im Eval-Transkript: `estimate`-Slots erzeugen nachweislich eine Rückfrage in einem der Folge-Turns (automatisch prüfbar)
- [ ] Felder mit `confidence=confirmed` erzeugen keine erneute Nachfrage (Rate falsch-positiver Rückfragen bei sicheren Feldern = 0)
- [ ] Eval-Gate: Interview-Vollständigkeit ≥ Baseline PROJ-22 (keine Regression durch den Inversion-Fix)

## Edge Cases

- **Slot ist `estimate` nach 2 Nachfrage-Versuchen:** Agent setzt Marker `{ absent: true, reason: 'low_confidence_persistent' }` statt unbegrenzt weiterzufragen — verhindert Nachfrage-Loop
- **Befragter verweigert Auskunft explizit:** Agent setzt `{ absent: true, reason: 'refused' }`, fragt nicht erneut, akzeptiert keine Zahl aus dem Kontext
- **`applyGroundingGuard` lehnt Wert ab, Feld noch `null`:** Analyst schreibt keinen Wert — kein Marker, da unklar ob das Feld überhaupt adressiert wurde; Talker kann im nächsten Turn erneut fragen
- **Migration laufender Interviews:** Bestehende `null`-Felder bleiben `null` — kein Marker rückwirkend gesetzt; kein Breaking Change
- **`estimate`-Slot wird in `slot_completion` als Target gesetzt, aber Phase wechselt:** Phase-Übergang abbrechen oder Catch-up-Marker setzen — Architektur-Entscheidung
- **Eval findet Regression:** Nicht deployen; Root Cause analysieren; `computeWalkthroughSlotTarget`-Änderung separat testen

## Technical Requirements

- **Eval-Gate:** `npm run eval:interview buchhalter` vor Deployment — Halluzinationsrate-Check und Konfidenz-Trigger-Check als neue Scorer
- **Keine Schema-Migration für laufende Interviews:** `SlotValue | null` bleibt kompatibel; neuer Sentinel-Typ ist additiv
- **Langfuse:** Analyst-Spans loggen `absent_marker_set: true` wenn Marker gesetzt wird — prüfbar in Trace-Analyse
- **Unit-Tests:** `computeWalkthroughSlotTarget` mit `estimate`/`unknown`-Slots abdecken (offline, ohne LLM)

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
