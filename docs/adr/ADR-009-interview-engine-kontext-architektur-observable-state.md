# ADR-009: Interview-Engine — Kontext-Architektur, Observable State und Anchoring

**Status:** Accepted (2026-05-27)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Eval-Lauf `docs/evals/interview/2026-05-27-buchhalter.md` + Research-Sprint (Fragen A1–E10)
**Ergänzt:** ADR-008 (ersetzt ihn nicht)

---

## Context

ADR-008 hat `walkthrough_step` als Hauptphase eingeführt und implementiert. Der Eval-Lauf vom 2026-05-27 zeigt: `walkthrough_step` funktioniert strukturell nicht — Turn 2 ist bereits eine direkte Slot-Frage ("Wie viele Rechnungen pro Monat?"), kein narrativer Einstieg.

Ein begleitender Research-Sprint (10 Fragen, 2 parallele Agents, Quellen: arXiv 2025/2026, Anthropic, Google AI Dev Docs) hat den Root Cause identifiziert:

**Der Slot-Tracker ist ein Observable Goal.** Der dynamische Kontext enthält den Schritt-Tracker mit leeren Feldern (`frequency_per_month: fehlt`, `duration_minutes: fehlt`, ...) am Anfang jedes Turns sichtbar. Forschung (arXiv 2502.17204, arXiv 2604.09443) belegt: LLMs folgen sichtbaren Ziel-Objekten stärker als Textinstruktionen — das ist kein Gehorsams-Problem, sondern ein Kontext-Architektur-Problem. Der Agent "sieht" die leeren Felder und füllt sie direkt, weil das der stärkste Signalimpuls im Kontext ist. Die Walkthrough-Instruktionen konkurrieren dagegen und verlieren.

Drei weitere Befunde aus dem Research-Sprint ergänzen das:

**Phasen-Instruktionen im System-Prompt.** Für Gemini-Provider werden statischer und dynamischer Kontext zu einem System-Prompt kombiniert (`systemPrompt = staticPart + dynamicPart`). Best-Practice-Quellen (Google AI Dev Docs, Anthropic Prompt Engineering) empfehlen: Phasen-spezifische Anweisungen gehören in den User-Turn, nicht in den System-Prompt — sie sind dynamisch und sollten das Signal der aktuellen Phase nicht mit dem eines invarianten System-Prompts konkurrieren lassen.

**Anchoring Bias.** ArXiv 2412.06593, 2511.05766, 2505.15392 belegen: Wenn der Agent selbst einen Zahlenwert vorschlägt ("Soll ich mit 2,5 Tagen rechnen?"), bestätigt der Mitarbeiter diesen Wert mit ~70% Wahrscheinlichkeit, unabhängig von seiner eigenen Einschätzung. Das aktuelle Prompt-Beispiel (ADR-007 D6) enthält genau dieses Muster.

**Exception-Pfade als separate Prozesse.** Der Agent registriert Ausnahme-Pfade ("Rechnungsprüfung bei fehlender Bestellreferenz") als eigenständige `register_step`-Einträge statt als `friction_points` auf dem Elternprozess. Das Prompt enthält keine expliziten Klassifikations-Trigger für Ausnahme-Formulierungen.

---

## Decisions

### D1 — Slot-Tracker: Observable Goal → Read-Only Protokoll

Der Schritt-Tracker wird aus seiner aktuellen Position (Anfang des dynamischen Kontexts) an das **Ende** verschoben und mit einem expliziten Read-Only-Framing umhüllt:

```
<READ_ONLY_STATE>
Protokoll bisher erfasster Daten — zur Orientierung, nicht zur Optimierung.
Diese Felder beschreiben was bereits gesagt wurde. Leere Felder sind kein
Gesprächsziel. Nicht auf Basis leerer Felder fragen.
[Schritt-Tracker Inhalt]
</READ_ONLY_STATE>
```

Zusätzlich: In der `walkthrough_step`-Phase wird der Schritt-Tracker im dynamischen Kontext **vollständig ausgeblendet**. Er erscheint nur in `slot_completion` und `coverage_check`, wo Slot-Filling das explizite Ziel ist.

Basis: arXiv 2502.17204 (Position Bias), arXiv 2604.09443 (Many-Tier Instruction Hierarchy), Anthropic Effective Context Engineering.

### D2 — Phasenblock in dynamischen Kontext verschieben

Der phasenspezifische Methodik-Block (bisher in `buildStaticPrompt`) wird in `buildDynamicContext` verschoben.

**System-Prompt (statisch, invariant):**
Nur: Persona, Output-Format (`<turn_format>`), Silence-Constraint, Tool-Regeln.
Kein Phasenblock, keine Leitfragen, keine Methodik.

**Dynamischer Kontext (per Turn, für alle Provider in den User-Turn injiziert):**
Interview-Kontext + aktueller Phasenblock + Schritt-Tracker (am Ende, READ_ONLY) + Few-Shot-Beispiele (direkt vor User-Input).

Für Gemini-Provider bedeutet das: die bisherige Kombination `systemPrompt = staticPart + dynamicPart` entfällt. Der dynamische Kontext wird wie bei Anthropic als Textblock im letzten User-Turn injiziert.

Basis: Google AI Dev Docs (Prompting Strategies), arXiv 2511.03508 (Multi-Turn Degradation nach Turn 4–5).

### D3 — walkthrough_step: Direkte Slot-Fragen verboten

In `walkthrough_step` darf der Agent **keine direkten Fragen zu Pflicht-Slots** stellen. `record_slot` ist erlaubt, aber nur wenn der Mitarbeiter den Wert spontan nennt — nie als Ergebnis einer direkten Nachfrage.

Implementierung als explizite Anweisung in der `walkthrough_step`-Sektion:

> In dieser Phase niemals direkt fragen: "Wie viele [Einheiten] pro Monat?", "Wie lange dauert das?",
> "Läuft das immer gleich ab?". Diese Fragen gehören in `slot_completion`.
> In `walkthrough_step` gilt: Folge dem Ablauf. Wenn der Mitarbeiter einen Wert spontan nennt
> → `record_slot`. Wenn nicht → kein Nachhaken, der Wert wird in `slot_completion` erhoben.

Zusätzlich: Tool-Beschreibung von `record_slot` wird phasenabhängig ergänzt:
> "In `walkthrough_step`: Nur aufrufen wenn Mitarbeiter den Wert spontan nannte.
> In `slot_completion`: Aktiv nachfragen und erfassen."

Basis: A2-Research-Befund (Hard Constraints ~85% effektiver als Soft Constraints).

### D4 — Kein Anker-Vorschlag: Mitarbeiter nennt Zahl zuerst

Das aktuelle Span-Confirmation-Muster (ADR-007 D6) wird umgekehrt.

**Bisher:** "Soll ich mit dem Mittelwert rechnen, also etwa 2,5 Tage?"
**Neu:** "Du hast 'zwei bis drei Tage' gesagt — welcher Wert trifft es besser?"

Der Agent nennt nie selbst eine Zahl als Vorschlag. Er stellt die Frage offen oder mit der Formulierung des Mitarbeiters als Anker, nicht mit einer eigenen Zahl.

Ergänzung im Silence-Constraint:
> Falsch: "Soll ich mit 90 als Mittelwert rechnen?"
> Falsch: "Dann rechne ich mit 90 als soliden Mittelwert."
> Richtig: "Du hast '80 bis 100' genannt — welche Zahl ist repräsentativer?"

Basis: arXiv 2412.06593, 2511.05766, 2505.15392 (Anchoring Bias: 70% Acceptance Rate bei Agent-Vorschlägen).

### D5 — Exception-Klassifikation: Ausnahme-Phrasen → friction_point

Neuer Block im `walkthrough_step`-Prompt: explizite Klassifikation von Ausnahme-Formulierungen.

> Wenn der Mitarbeiter eine Ausnahme oder einen Sonderfall beschreibt — erkennbar an Phrasen wie
> "aber wenn", "nur wenn", "normalerweise schon, aber", "Sonderfall", "meistens geht das, außer" —
> ist das ein **friction_point auf dem aktuellen Prozess**, kein eigenständiger Prozess.
>
> Falsch: register_step("Rechnungsprüfung bei fehlender Bestellreferenz")
> Richtig: update_walkthrough_data(friction_points=["Bestellreferenz fehlt: ..."], friction_tools=[...])

Basis: E10-Research-Befund (SHIELDA-Framework: Exception = State Transition auf Parent, nicht neuer Step).

### D6 — Few-Shot-Beispiele in dynamischen Kontext, mit Annotation

Die Beispiele wandern aus dem statischen System-Prompt in den dynamischen Kontext, positioniert **direkt vor dem aktuellen User-Input**.

Format wird von Paaren zu annotierten Transkripten erweitert:

```xml
<EXAMPLE phase="walkthrough_step">
  USER: "Normalerweise dauert eine Rechnung 5 Minuten. Aber wenn die Bestellreferenz fehlt,
         muss ich in drei Systemen suchen — das kann eine Stunde werden."
  AGENT: "Das klingt nach einem Prozess, der bei Ausnahmen besonders aufwändig wird.
          Geh mir kurz durch, was du machst wenn die Bestellreferenz fehlt — was ist der erste Schritt?"
  // Agent registriert NICHT "Rechnungsprüfung bei fehlender Bestellreferenz" als neuen Step.
  // Agent fragt NICHT "wie lange dauert das im Schnitt?".
  // Agent folgt dem Ablauf.
</EXAMPLE>
```

4 Beispiele, jeweils für einen kritischen Constraint-Fall:
1. Exception-Phrase → friction_point (nicht neuer Step)
2. Span-Confirmation ohne Agent-Anker
3. Walkthrough-Einstieg ohne Slot-Frage
4. Spontane Slot-Nennung im Ablauf → record_slot still

Basis: C6 (4–5 Beispiele optimal), C7 (annotierte Transkripte ~88% Treffer), arXiv 2509.13196 (Few-Shot Dilemma).

---

## Consequences

**Positiv:**
- Slot-Tracker als READ_ONLY am Ende beseitigt den dokumentierten Observable-State-Pull
- Phasenblock im User-Turn erhöht Phasen-Signal-Stärke; System-Prompt bleibt kurz und stabil
- Direktes Slot-Verbot in walkthrough_step macht D3 aus ADR-008 technisch erzwingbar
- Anchoring-Fix (D4) produziert unabhängige Mitarbeiter-Zahlen statt Agent-Bestätigungen
- Exception-Klassifikation (D5) verhindert falschen step_tracker-Aufblähen

**Negativ:**
- D2 (Phasenblock in User-Turn) erfordert Code-Änderung in createInterviewStream — der Gemini-Branch muss angepasst werden
- D1 (Schritt-Tracker ausblenden in walkthrough) reduziert Agent-Awareness über bereits Erfasstes — Risiko: Doppel-Fragen zu bereits gefüllten Slots. Mitigation: Im READ_ONLY-Block stehen erfüllte Slots weiterhin, nur leere Felder sind nicht mehr visuell prominent

**Offene Fragen:**
- Genügt das READ_ONLY-Framing allein, oder muss der Tracker in walkthrough_step wirklich vollständig aus dem Kontext verschwinden? Erst nach Eval-Verifikation entscheiden.

**Folgeentscheidungen:**
- Neuer Eval-Lauf (gleiche Buchhalter-Persona) nach Implementierung

---

## Umsetzung

| # | Entscheidung | Datei(en) | Aufwand |
|---|-------------|-----------|---------|
| D1 | READ_ONLY-Wrapper + Repositionierung Schritt-Tracker ans Ende; in walkthrough_step ausblenden | `buildDynamicContext` in `interviewAgent.ts` | S |
| D2 | Phasenblock aus `buildStaticPrompt` → `buildDynamicContext`; Gemini-Branch auf User-Turn-Injektion umstellen | `buildStaticPrompt`, `buildDynamicContext`, `createInterviewStream` in `interviewAgent.ts` | M |
| D3 | Direkte Slot-Fragen in walkthrough_step verboten; Tool-Beschreibung record_slot phasenabhängig | System-Prompt walkthrough_step-Sektion, Tool-Beschreibung in `buildTools` | S |
| D4 | Span-Confirmation ohne Agent-Anker; Silence-Constraint-Erweiterung | System-Prompt (Beispiele + Silence-Block) | S |
| D5 | Exception-Klassifikations-Block mit Trigger-Phrasen | System-Prompt walkthrough_step-Sektion | S |
| D6 | Few-Shot-Beispiele in dynamischen Kontext; annotiertes Format | `buildDynamicContext` + Beispiel-Texte | M |

Empfohlene Reihenfolge: D1 + D3 + D4 + D5 zuerst (hoher Hebel, geringer Code-Aufwand), dann D2 + D6 (Kontext-Architektur, größerer Eingriff).
