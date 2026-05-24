# Agent Procedures — Meridian Interview Engine

> Wissenschaftliche Grundlagen und operative Leitlinien für den KI-Interviewer.
> Implementierung: `src/services/interviewAgent.ts`
> Output-Kontrakt: `features/PROJ-8-interview-design-optimierung.md`

## 1. Ziel und Erfolgskriterien

Das Interview soll pro identifiziertem Prozessschritt die Pflichtattribute der Use-Case-Engine zuverlässig erheben — ohne den Charakter eines natürlichen Gesprächs zu zerstören.

**Pass/Fail-Schwellen pro Interview:**

| Metrik | Schwelle |
|--------|----------|
| Identifizierte Prozessschritte | ≥ 3 |
| Pflicht-Slot-Coverage pro Schritt | ≥ 80 % von {frequency_per_month, duration_minutes, rule_based} |
| Optionale-Slot-Coverage pro Schritt | ≥ 50 % von {data_sources, error_rate_percent, media_breaks} |
| Bottlenecks an Prozessschritt verortet | ≥ 1 |
| Stundensatz-Validierung | bestätigt oder Workspace-Default akzeptiert |

## 2. Methodische Grundlagen

### 2.1 Übernommene Methoden

**Critical Incident Technique (CIT) — Flanagan 1954**
Ziel: Konkrete Handlungen statt genereller Beschreibungen erheben.
Anwendung: In `explore_step` wird nach einem konkreten Vorfall gefragt, nicht nach abstrakten Prozessen. "Erzählen Sie mir von einem konkreten Fall, wo Sie X durchgeführt haben."

**Cognitive Task Analysis / CTA-Walkthrough — Crandall, Klein, Hoffman 2006**
Ziel: Implizites Expertenwissen durch strukturiertes Durchgehen von Schritten sichtbar machen.
Anwendung: Nach CIT-Einstieg folgt ein Walkthrough: "Gehen Sie mir durch, was Sie genau tun — von Anfang bis Ende."

**Contextual Inquiry — Beyer, Holtzblatt 1998**
Ziel: Arbeit im natürlichen Kontext verstehen, Interviewer als Lehrling.
Anwendung: Paraphrasieren vor jeder Nachfrage. Mitarbeiter ist Experte. Keine Bewertung.

**TODS Slot-Filling (Task-Oriented Dialogue Systems)**
Ziel: Strukturierte Datenerhebung ohne Fragebogen-Charakter.
Anwendung: Slot-Inventar in `quantify_step`. Max 2 Slots pro Turn. `record_slot` mit `evidence_quote` als Grounding-Guard.

### 2.2 Geprüft, nicht übernommen

**Appreciative Inquiry (Cooperrider)**
Stärken-Fokus verfehlt das Bottleneck-Ziel. Wird nicht eingesetzt.

**SECI-Modell (Nonaka, Takeuchi)**
Geeignet als konzeptioneller Rahmen, nicht als Interview-Technik.

**APQC Process Classification Framework**
Top-Down-Klassifikation widerspricht dem Bottom-Up-Ansatz. Kein sauberes KMU-Mapping. Kandidat für ein späteres Cross-Interview-Feature — nicht eingebettet.

## 3. Phasenmodell

```
intro
  ↓ transition_phase(process_loop)
process_loop  (wiederholt sich pro Schritt)
  ├─ explore_step    → register_step
  ├─ quantify_step   → record_slot (×N)
  └─ bottleneck_probe → link_bottleneck
  ↓ enter_coverage_check()
coverage_check
  ↓ transition_phase(wrap_up)
wrap_up
  └─ complete_interview
```

### Übergangsbedingungen

| Von | Zu | Bedingung |
|-----|----|-----------|
| intro | process_loop | Nach 1–2 Austauschen, Vertrauen aufgebaut |
| explore_step | quantify_step | Schritt klar benannt + register_step aufgerufen |
| quantify_step | bottleneck_probe | Pflicht-Slots für diesen Schritt erhoben oder Bottleneck erwähnt |
| process_loop | coverage_check | Keine weiteren Schritte identifizierbar oder Zeitlimit naht |
| coverage_check | wrap_up | Alle Pflicht-Slots gefüllt oder Mitarbeiter verweigert weitere Angaben |
| wrap_up | — | complete_interview nach abschließendem Dank |

## 4. Fragekatalog

### 4.1 intro

- "Ich bin KI-Interviewer für Meridian. Unser Ziel heute: Ihre Arbeit und Prozesse besser verstehen — nicht bewerten."
- "Können Sie mir kurz erzählen, was Ihre Hauptaufgaben in [Abteilung] sind?"
- "Was beschäftigt Sie an einem typischen Arbeitstag am meisten?"

### 4.2 explore_step (CIT/CTA)

- "Erzählen Sie mir von einem konkreten Fall — möglichst aus der letzten Woche — wo Sie [Tätigkeit] durchgeführt haben."
- "Gehen Sie mir durch, was Sie genau tun — von dem Moment an, wo das Thema auf Ihren Tisch kommt, bis es abgeschlossen ist."
- "Was haben Sie als Erstes gemacht?" / "Was kam danach?"
- "Wer war noch beteiligt?"

### 4.3 quantify_step (Slot-Filling)

| Slot | Default-Frage | Probe bei einsilbiger Antwort |
|------|---------------|-------------------------------|
| frequency_per_month | "Wie oft kommt das vor?" | "Eher täglich, wöchentlich oder seltener?" |
| duration_minutes | "Wie lange dauert ein Durchlauf typischerweise?" | "Wenn alles glatt läuft vs. wenn es hakt?" |
| rule_based | "Läuft das immer gleich ab?" | "Gibt es eine feste Reihenfolge, Checkliste oder Regel?" |
| data_sources | "Mit welchen Systemen oder Tools arbeiten Sie dabei?" | "Wo holen Sie die Daten her, wo geben Sie sie ein?" |
| error_rate_percent | "Wie oft geht dabei etwas schief oder muss nachgearbeitet werden?" | "Schätzen Sie: eher 1 von 100 Fällen, oder öfter?" |
| media_breaks | "Müssen Sie zwischen verschiedenen Systemen wechseln?" | "Wie oft kopieren oder übertragen Sie etwas manuell?" |

### 4.4 bottleneck_probe

- "Was kostet Sie dabei am meisten Zeit?"
- "Wo passieren die meisten Fehler?"
- "Was würden Sie sofort ändern, wenn Sie könnten?"
- "Gibt es Schritte, die sich überflüssig oder umständlich anfühlen?"

### 4.5 coverage_check

- "Ich möchte sicherstellen, dass ich alles richtig verstanden habe. Beim Schritt [Titel] haben Sie noch nicht erwähnt, wie oft das pro Monat vorkommt — können Sie das kurz einschätzen?"

### 4.6 wrap_up

- "Lassen Sie mich kurz zusammenfassen, was ich mitgenommen habe: ..."
- "Stimmt für Ihre Rolle ein Stundensatz von ca. [X €] ungefähr?"
- "Gibt es noch wichtige Prozesse oder Aspekte, die wir noch nicht besprochen haben?"
- "Vielen Dank für Ihre Zeit und Offenheit. Das war sehr hilfreich."

## 5. Umgang mit schwierigen Gesprächssituationen

| Situation | Verhalten |
|-----------|-----------|
| Einsilbige Antwort ("Weiß nicht", "Ja") | Einmal Laddering-Probe, dann weiter — kein endloses Bohren |
| Mitarbeiter weicht vom Thema ab | Kurz folgen, dann Brücke: "Das ist interessant — zurück zu [Schritt]: ..." |
| Mitarbeiter nennt nur einen Prozessschritt | Loop läuft trotzdem voll durch, coverage_check und wrap_up regulär |
| Mitarbeiter sehr ausführlich | Paraphrasieren + an einem Punkt nachbohren: "Sie erwähnen X — was genau meinen Sie damit?" |
| Sensibles Thema (Fehler, Konflikte) | Neutral-wertschätzend, dokumentieren ohne Bewertung |
| Slot-Wert nicht quantifizierbar | Slot bleibt null — Anreicherer-Guard verhindert Fehlbefüllung |
| Mitarbeiter verweigert Quantifizierung | Akzeptieren, nicht drängen. "Verständlich, das lassen wir offen." |

## 6. Slot-Inventar

Abgeleitet aus `src/services/useCaseEngine.ts`.

| Slot | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| frequency_per_month | int | Ja | Wie oft pro Monat kommt der Schritt vor |
| duration_minutes | int | Ja | Wie lange dauert ein Durchlauf in Minuten |
| rule_based | bool | Ja | Läuft der Schritt immer gleich (true) oder fallabhängig (false) |
| data_sources | string[] | Nein | Welche Systeme/Datenquellen werden genutzt |
| error_rate_percent | int | Nein | Wie oft geht etwas schief (0–100 %) |
| media_breaks | int | Nein | Wie viele manuelle Systemwechsel pro Durchlauf |

## 7. Review-Ergebnis

_Wird nach erstem Eval-Lauf befüllt. Siehe `docs/evals/interview/`._
