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

Der kanonische Nicht-Befund-Mechanismus ist `nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null` (Schema `prozessschritt-schema.json`, in jedem Slot-Typ; PROJ-25 für die taziten Slots). PROJ-28 erfindet **keinen** parallelen Marker, sondern realisiert REQ-013 für die quantitativen Slots über dasselbe Feld:

- Die App-interne `SlotValue` (`interviewSemantic.ts`) wird um `nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null` erweitert. PROJ-25 belässt die quantitativen `potenzial`-Slots als `SlotValue` ohne dieses Feld; PROJ-28 zieht es nach, deckungsgleich mit der Schema-`SlotNumber`.
- Drei maschinell unterscheidbare Zustände, exakt die Schema-Semantik: `value != null` (befüllt); `value == null && nicht_befund_typ == null` (noch nicht adressiert, O8-Lücke); `value == null && nicht_befund_typ != null` (Nicht-Befund).

Der Analyst setzt `nicht_befund_typ`, wenn:
- die Frage adressiert wurde, aber kein belegbares Wertangebot vorlag → `unbekannt`
- der Befragte die Auskunft verweigert hat → `verweigert`
- das Feld explizit nicht anwendbar ist → `nicht_zutreffend`

Das starke Evidence-Grounding (`applyGroundingGuard`, `evidence_span`-Verbatim-Check, ADR-015) bleibt unangetastet. Der Marker ergänzt das Grounding: er greift, wenn das Grounding einen Wert ablehnt.

**Scope-Abgrenzung zu PROJ-25.** Die `nicht_befund_typ`-Felddefinition auf den taziten O2–O5-Slots (`TaziteSlot`) sowie auf Governance/`abhaengigkeiten` gehört zu PROJ-25/26. PROJ-28 ergänzt das Feld auf der quantitativen `SlotValue` und liefert die aktive Setz-Logik im Analyst. Diese Setz-Logik ist slot-typ-agnostisch: lehnt `applyGroundingGuard` einen Wert für einen gerade erfassten Slot ab, setzt der Analyst dessen `nicht_befund_typ` (das Feld existiert dann auf allen Slot-Typen). Die quantitativen Slots zählen nicht in den O1–O6-Coverage-Nenner; ihr Marker speist die separate Potenzial-/Halluzinations-Messung, nicht die Coverage.

### BL-E2.2 — Konfidenz-Inversion beheben

Die Prompt-Regel in `slot_completion` wird umgekehrt:
- **Vorher:** `NICHT mehr nachfragen wenn Slot bereits mit confidence=estimate erfasst ist. Nur bei echtem null.`
- **Nachher:** Slots mit `confidence=estimate` oder `confidence=unknown` sind Nachfrage-Ziele; Slots mit `confidence=confirmed` sind abgeschlossen.

`computeWalkthroughSlotTarget` (`interviewAgent.ts:112`) wird erweitert: statt nur `=== null` werden auch `estimate`- und `unknown`-Slots als offen behandelt, mit niedrigerer Priorität als echte `null`-Slots.

Die Slot-Target-Hinweistexte im Prompt werden für `estimate`-Slots angepasst: statt „noch fehlend" heißt es „unsicher belegt, kurze Bestätigung einholen".

**Build-Reihenfolge-Kopplung.** PROJ-28 baut nach PROJ-25/27. Die Zeilennummern (`interviewAgent.ts:388`, `:112`) und die Slot-Menge sind IST vor PROJ-25; nach PROJ-25 liegen die quantitativen Slots in `potenzial`, die Pflicht-Coverage-Felder sind die taziten O2–O5, und `computeWalkthroughSlotTarget`/der `slot_completion`-Prompt operieren auf der umstrukturierten Slot-Menge. Der Inversions-Fix (Konfidenz statt `=== null`) und die Konfidenz-Steuerung gelten unabhängig vom Slot-Ort und über alle Slot-Typen mit `confidence`-Feld (quantitativ wie tazit).

## User Stories

- Als **Entwickler** möchte ich Nicht-Befund-Felder maschinell von noch-nicht-adressierten Feldern unterscheiden, damit Coverage-Metriken und Eval-Scores korrekt rechnen.
- Als **KI-Berater** möchte ich dass der Agent bei unsicheren Feldwerten nachfragt statt sie als gesichert zu behandeln, damit der Erhebungsstand verlässlich ist.
- Als **Mitarbeiter (interviewte Person)** möchte ich dass der Agent nicht mit Schein-Sicherheit falsche Zahlen festhält, sondern offen nachfragt wenn er sich nicht sicher ist.
- Als **Entwickler** möchte ich im Eval messen, dass Halluzinationsrate < 1 % und konfidenzgesteuerte Rückfragen korrekt ausgelöst werden, damit beide Defekte automatisch regressionsgeprüft sind.

## Acceptance Criteria

### BL-E2.1 — Nicht-Befund-Marker

- [ ] `SlotValue` (`interviewSemantic.ts`) trägt `nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null` (kanonischer Enum, deckungsgleich mit Schema `SlotNumber`/`SlotString` und PROJ-25 `TaziteSlot`); kein neuer `absent`-Sentinel
- [ ] Drei Zustände maschinell unterscheidbar: befüllt (`value != null`), Lücke (`value == null && nicht_befund_typ == null`), Nicht-Befund (`value == null && nicht_befund_typ != null`)
- [ ] Der Analyst setzt `nicht_befund_typ`, wenn `applyGroundingGuard` einen Wert ablehnt und das Feld im aktuellen Turn aktiv adressiert wurde (kein Beleg → `unbekannt`, Verweigerung → `verweigert`, nicht anwendbar → `nicht_zutreffend`)
- [ ] Felder mit gesetztem `nicht_befund_typ` erscheinen im Slot-Tracker als „nicht belegbar", nicht als offene Lücke für erneute Nachfrage
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

- **Slot ist `estimate` nach 2 Nachfrage-Versuchen:** Der Wert existiert (unsicher belegt), das ist **kein** Nicht-Befund. `nicht_befund_typ` wird nicht gesetzt; stattdessen stoppt die konfidenzgesteuerte Nachfrage nach dem Limit (BL-E2.2, Nachfrage-Loop-Schutz), der `estimate`-Wert bleibt mit seiner Konfidenz stehen
- **Befragter verweigert Auskunft explizit:** Agent setzt `nicht_befund_typ='verweigert'`, fragt nicht erneut, akzeptiert keine Zahl aus dem Kontext
- **`applyGroundingGuard` lehnt Wert ab, Feld noch nicht adressiert:** Analyst schreibt keinen Wert und setzt **keinen** `nicht_befund_typ` (Zustand bleibt Lücke, `value == null && nicht_befund_typ == null`), da unklar ist, ob das Feld überhaupt adressiert wurde; Talker kann im nächsten Turn erneut fragen
- **Migration laufender Interviews:** Bestehende `null`-Felder bleiben `null` — kein Marker rückwirkend gesetzt; kein Breaking Change
- **`estimate`-Slot wird in `slot_completion` als Target gesetzt, aber Phase wechselt:** Phase-Übergang abbrechen oder Catch-up-Marker setzen — Architektur-Entscheidung
- **Eval findet Regression:** Nicht deployen; Root Cause analysieren; `computeWalkthroughSlotTarget`-Änderung separat testen

## Technical Requirements

- **Eval-Gate:** `npm run eval:interview buchhalter` vor Deployment — Halluzinationsrate-Check und Konfidenz-Trigger-Check als neue Scorer
- **Keine Schema-Migration für laufende Interviews:** das additive optionale Feld `nicht_befund_typ` auf `SlotValue` ist abwärtskompatibel (Alt-Einträge ohne das Feld werden als `null` = Lücke gelesen); `SlotValue | null` bleibt kompatibel
- **Langfuse:** Analyst-Spans loggen das gesetzte `nicht_befund_typ` (Wert plus betroffener Slot), wenn ein Nicht-Befund markiert wird, prüfbar in der Trace-Analyse
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
