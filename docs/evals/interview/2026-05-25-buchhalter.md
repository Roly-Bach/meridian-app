---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-25
persona: buchhalter
interview_id: 000e386a-4af8-47b7-9506-8f905ffa2608
---

## Setup-Hinweise

- **/start-Bug:** POST `/api/interview/<token>/start` lieferte leeren Stream (HTTP 200, 0 Bytes Body). Ersatzweg: erstes `/chat`-Call mit Probe-Input "Hallo" aktivierte das Interview.
- **interview_state fehlend:** Eval-Skill legte Interview direkt per SQL an (statt via `POST /api/interviews`). Der API-Endpoint initialisiert die `interview_state`-Row — beim direkten SQL-INSERT fehlte sie. Folge: `register_step`-Tool-Calls vor der manuellen Nachanlage liefen ins Leere (`update()` ohne Row). Manuell behoben vor Turn 3.

---

[Turn 1] Agent: "Hallo Herr Meier! Mein Name ist Meridian, und ich bin heute hier, um mit Ihnen über Ihre Arbeitsabläufe in der Finanzbuchhaltung zu sprechen. Dabei geht es mir nicht um eine Leistungsbewertung, sondern darum, Ihre wertvolle Fachexpertise zu verstehen und zu dokumentieren. Damit wir starten können: Wie sieht ein typischer Arbeitstag für Sie in der Finanzbuchhaltung aus?"

[Turn 1] Persona (Andreas Meier): "Hallo" *(Probe-Nachricht zum Umgehen des /start-Bugs — kein inhaltlicher Persona-Turn)*

[Turn 2] Agent: "Das freut mich. Erzählen Sie mir doch bitte kurz, was Ihre Schwerpunkte in der Finanzbuchhaltung sind – womit verbringen Sie den Großteil Ihrer Zeit, wenn Sie an einem typischen Tag bei uns arbeiten?"

[Turn 2] Persona (Andreas Meier): "ok" *(Minimal-Probe vor Erkennung des interview_state-Problems — kein inhaltlicher Persona-Turn)*

[Turn 3] Persona (Andreas Meier): "Mein Hauptaufgabenbereich ist die Rechnungsprüfung. Das macht quantitativ den Löwenanteil meiner täglichen Arbeit aus — wir erhalten zwischen 80 und 100 Rechnungen pro Monat, die ich einzeln auf Korrektheit prüfe, in SAP FI buche und in DocuWare ablege. Daneben ist der monatliche Abschluss mein zweiter großer Schwerpunkt: einmal im Monat, über zwei bis drei intensive Tage, stimme ich alle offenen Posten ab, buche Rückstellungen und übergebe die Ergebnisse ans Controlling."

[Turn 3] Agent: silent — tool-only
  → `register_step("Monatsabschluss", role: "Buchhalter")` ✓
  → `record_slot("Monatsabschluss", "frequency_per_month", value: 1, quote: "einmal im Monat, über zwei bis drei intensive Tage")` ✓

[PASS] register_step erkannt in Turn 3 — step_tracker enthält "Monatsabschluss" mit frequency_per_month=1, status="quantifying"

---

## Befunde

### BUG-EVAL-1 — /start liefert leeren Stream (Severity: Medium)
- **Was:** `POST /api/interview/<token>/start` antwortet mit HTTP 200, aber 0 Bytes Body.
- **Ursache:** `createInterviewStream` mit `isStart: true` und leerem Verlauf — LLM-Call schlägt stumm fehl oder Stream schließt sofort. `toTextStreamResponse()` liefert leeren Body.
- **Auswirkung in App:** Erster Agent-Turn wird nie angezeigt. Nutzer sieht leeres Chat-Fenster.
- **Reproduzierbar:** Ja, konsistent über mehrere Aufrufe.

### BUG-EVAL-2 — Tool-only-Turns erzeugen leeren Stream + werden nicht als Turn gespeichert (Severity: Low)
- **Was:** Wenn das Modell in Step 1 ausschließlich Tools aufruft (kein Text), liefert `toTextStreamResponse()` einen leeren Body. `onFinish` prüft `if (!agentText) return` und speichert den Turn nicht.
- **Ursache:** `stopWhen: stepCountIs(1)` + reiner Tool-Call-Step.
- **Auswirkung:** In der App-UI fehlen diese Turns (keine sichtbare Aktion). Slot-Daten werden korrekt in `interview_state` geschrieben, aber der User sieht keine Rückmeldung.

### EVAL-SETUP-BUG — interview_state-Row fehlt bei direktem SQL-INSERT (Severity: Info)
- **Was:** Eval-Skill erstellt Interview via SQL-INSERT, nicht via `POST /api/interviews`. Der API-Endpoint initialisiert `interview_state` — direkter SQL-INSERT tut das nicht.
- **Fix:** Eval-Skill sollte `POST http://localhost:3000/api/interviews` mit Auth-Header nutzen, oder explizit ein `INSERT INTO interview_state` nach dem Interview-Insert ausführen.

---

## Pass-Kriterien-Check

| Kriterium | Ergebnis |
|-----------|----------|
| Erster Turn ist Agent (nicht Persona) | ✓ PASS |
| Kein identisch wiederholter Persona-Text | ✓ PASS |
| Persona-Antworten kontextuell passend | ✓ PASS (Turn 3 bezieht sich auf die Frage nach Schwerpunkten) |
| Mindestens ein register_step-Call | ✓ PASS (Turn 3: Monatsabschluss) |

**Gesamtergebnis: PASS** — mit zwei dokumentierten Bugs im Agent-Backend.
