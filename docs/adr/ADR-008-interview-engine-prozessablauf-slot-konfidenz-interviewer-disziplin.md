# ADR-008: Interview-Engine — Prozessablauf-Exploration, Slot-Konfidenz und Interviewer-Disziplin

**Status:** Accepted (2026-05-27)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Eval-Lauf `docs/evals/interview/2026-05-26-buchhalter-2.md` — Verifikationslauf nach ADR-007-Implementierung
**Ergänzt:** ADR-007 (ersetzt ihn nicht)

---

## Context

Der Verifikationslauf (buchhalter-2.md) bestätigt, dass die ADR-007-Maßnahmen die dort adressierten Regressionsmuster behoben haben. Er deckt aber eine tiefergehende Lücke auf, die in ADR-005/006/007 strukturell nicht adressiert wurde:

**Der Agent erhebt Metadaten, keinen Prozessablauf.** Frequency, duration_minutes, rule_based, data_sources sind Kennzahlen über einen Prozess — sie beschreiben nicht, wie er abläuft. Für Wissensextraktion und Use-Case-Identifikation ist aber der Ablauf selbst entscheidend: Wo beginnt der Prozess? Welche Schritte folgen aufeinander? An welchen Übergaben entsteht Reibung? Welche Tools sind für welchen Engpass verantwortlich? Was stört den Mitarbeiter am meisten? Diese Informationen fehlen vollständig im aktuellen step_tracker.

Zusätzlich hat der Verifikationslauf sieben konkrete Interviewer-Fehler gezeigt, die in ADR-007 nicht erfasst sind:

1. **Slot-Konfidenz fehlt**: `duration_minutes: 15` ohne Vermerk, dass der Wert nie gemessen wurde und Sonderfälle erheblich länger dauern. ROI-Berechnungen bauen auf unkalibriertem Input auf.
2. **data_sources keine Pflicht**: Persona nennt SAP FI und Excel für Monatsabschluss explizit — Slot bleibt null, weil keine Pflichtanweisung existiert.
3. **"Meridian" im Text-Output**: Der Agent nennt den Produktnamen im Opener. Darf nie vorkommen.
4. **Framing-Risiko im Opener**: "Prozessoptimierung" ohne Einschränkung auf Arbeitserleichterung. Ein Mitarbeiter, der befürchtet, seine Stelle zu verlieren, wird das Interview nicht offen führen.
5. **Vorab bekannte Prozesse im Opener**: Der Agent nennt in Turn 1 "Rechnungsprüfung und Monatsabschluss" — vermutlich aus dem Interview-Setup. Das wirkt instruiert, nicht explorativ.
6. **Coverage-Check sichtbar**: "lass mich kurz prüfen, ob wir alles abgedeckt haben" ist ein interner Verarbeitungsschritt, der dem Mitarbeiter kommuniziert wird. ADR-007 D2 (Silence-Constraint) gilt analog.
7. **Agent fragt um Erlaubnis**: "Sollen wir den noch kurz mit aufnehmen?" — der Interviewer leitet, entscheidet und handelt. Er fragt nicht um Erlaubnis.
8. **Interne Zwecke sichtbar**: "um das für meine Auswertung zu quantifizieren" ist ein Silence-Constraint-Verstoß analog zu ADR-007 D2.

---

## Decisions

### D1 — walkthrough_step als Hauptphase mit eingebetteter Quantifizierung

**Das ist die zentrale Entscheidung dieses ADR.**

Der aktuelle Interview-Flow hat zwei Phasen pro Prozess: `explore_step` (Prozess benennen, registrieren) → `quantify_step` (Slots füllen). Dieses Modell wird ersetzt. `quantify_step` als eigenständige Phase entfällt. An seine Stelle tritt `walkthrough_step` als Hauptphase, in der Quantifizierung opportunistisch eingebettet ist. Eine schlanke `slot_completion`-Phase schließt verbleibende Pflichtslots am Ende ab.

**Warum sequenziell nicht funktioniert:**

Ein Modell, das erst alle Kennzahlen abfragt und dann zum Ablauf wechselt, zerreißt den natürlichen Gesprächsfluss. Zahlen entstehen im Kontext von Handlungen, nicht abstrakt. Wenn der Mitarbeiter gerade erklärt, dass er in drei Systemen manuell suchen muss, ist der Moment für "wie lange dauert das?" — nicht fünf Turns vorher.

**Neuer Phasen-Flow:**

```
explore_step
  → walkthrough_step   ← Hauptphase: Ablauf führen + Slots opportunistisch füllen
      ↕ opportunistic quantify (frequency, duration, data_sources, friction-Felder
                                werden erfasst wenn sie im Ablauf natürlich auftauchen)
  → slot_completion    ← Nachphase: verbleibende Pflichtslots gezielt nachfragen
  → (nächster Prozess oder wrap_up)
```

`walkthrough_step` ist Pflicht für jeden registrierten Prozess — unabhängig von `rule_based`. Reibungspunkte und Schmerzpunkte sind bei unstrukturierten Prozessen ebenso relevant wie bei geregelten. Der Agent passt lediglich den Einstieg an.

**Ablauf von `walkthrough_step`:**

Der Agent führt den Mitarbeiter durch den Prozess entlang von fünf Leitfragen, die er über mehrere Turns entfaltet. Jede Frage ist ein eigener Turn (ADR-007 D1 gilt weiterhin: ein Turn = Reaktion + Frage). Der Agent folgt der Erzählung des Mitarbeiters — wenn dieser bei der Ablauf-Frage bereits Reibungspunkte nennt, vertieft der Agent dort direkt, ohne zurückzuspringen.

Der Einstieg variiert je nach `rule_based`:

> **Einstieg `rule_based: true`:** "Wie fängt der Prozess konkret an — was ist der erste Schritt?"
> **Einstieg `rule_based: false`:** "Wie laufen solche Situationen typischerweise ab — was passiert meistens zuerst?"

Die übrigen vier Leitfragen sind identisch:

> 2. **Ablauf:** "Was passiert als nächstes?" (wiederholt, bis der Prozess endet oder der Mitarbeiter auf Reibung hinweist)
> 3. **Reibung:** "Wo hakt es dabei am häufigsten — was kostet die meiste Zeit oder Energie?"
> 4. **Ursache:** "Was macht das an dieser Stelle schwierig — ein bestimmtes System, eine fehlende Information, eine Abhängigkeit?"
> 5. **Persönliche Priorität:** "Wenn du einen Punkt an diesem Prozess ändern könntest — was wäre das?"

**Opportunistische Quantifizierung während `walkthrough_step`:**

Der Agent trackt intern welche Pflichtslots bereits gefüllt sind. Wenn der Mitarbeiter im Ablauf Informationen liefert, die einen Slot füllen, erfasst der Agent sie direkt. Wenn der Kontext eine natürliche Gelegenheit bietet, fragt er gezielt nach:

- Mitarbeiter beschreibt einen Schritt mit impliziter Häufigkeit → Agent fragt: "Wie viele [Einheiten] kommen da pro Monat rein?"
- Mitarbeiter beschreibt einen zeitaufwändigen Schritt → Agent fragt: "Wie lange dauert das typischerweise — auch die aufwändigeren Fälle eingerechnet?"
- Mitarbeiter nennt ein System → Agent registriert es als `data_source` und kann nachfragen: "Nutzt du dabei noch weitere Tools?"

**`slot_completion`-Nachphase:**

Nach Abschluss des Walkthrough prüft der Agent intern welche Pflichtslots noch null sind. Fehlende Slots werden in maximal zwei bis drei direkten Fragen nachgeholt, bevor der Agent zum nächsten Prozess oder wrap_up wechselt. Kein sichtbarer Übergang ("jetzt noch ein paar Zahlen") — der Agent stellt die Fragen ohne Ankündigung.

**Neue Felder im step_tracker:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `process_steps` | `string[]` | Sequenz der Schritte in Mitarbeiter-Worten |
| `friction_points` | `string[]` | Explizit genannte Engpässe, Wartezeiten, Unterbrechungen |
| `friction_tools` | `string[]` | Tools oder Systemgrenzen, die als Ursache genannt werden |
| `pain_point_primary` | `string \| null` | Wichtigster Störpunkt in Mitarbeiter-Worten (Direktzitat bevorzugt) |

Diese Felder sind `null`-tolerant. Sie werden nie vom Agenten interpoliert — nur direkte Aussagen des Mitarbeiters werden hinterlegt.

### D2 — Slot-Konfidenz: quantitative Werte mit Qualifikation

`duration_minutes` und `frequency_per_month` erhalten optional zwei Begleitfelder:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `duration_confidence` | `"confirmed" \| "estimate" \| "unknown"` | Wie verlässlich ist der Wert |
| `duration_qualifier` | `string \| null` | Direkte Einschränkung der Persona (Zitat) |

**Befüllungsregel:**

- `"confirmed"`: Die Persona hat den Wert explizit akzeptiert ("ja, das trifft es", "klingt richtig")
- `"estimate"`: Die Persona hat den Wert als Orientierung bezeichnet, ihn aber nicht gemessen oder ausdrücklich bestätigt
- `"unknown"`: Die Persona konnte oder wollte keine Zahl nennen

Der Agent setzt `duration_qualifier` immer dann, wenn die Persona eine explizite Einschränkung macht ("nie gemessen", "Sonderfälle erheblich länger", "das variiert stark"). Direkte Zitate werden bevorzugt.

**Beispiel:** `duration_minutes: 15, duration_confidence: "estimate", duration_qualifier: "nie systematisch gemessen; Sonderfälle erheblich länger"`

Diese Felder fließen in die ROI-Darstellung ein: Bei `confidence: "estimate"` oder `"unknown"` wird im Report ein Hinweis angezeigt.

### D3 — data_sources als Pflicht-Slot

`data_sources` wird Pflichtslot mit derselben Verbindlichkeit wie `duration_minutes`. Der Agent erfasst genannte Systeme opportunistisch während `walkthrough_step`. Falls `data_sources` am Ende des Walkthrough noch leer ist, wird er in `slot_completion` nachgeholt:

> "Welche Systeme oder Tools nutzt du dabei?"

Wenn die Persona trotz Nachfrage keine Systeme nennt, wird `data_sources: []` (leeres Array, nicht null) gesetzt.

### D4 — Opener-Constraint: drei Regeln

**D4a — "Meridian" aus dem System-Prompt entfernen:**

Der Agent greift "Meridian" nur auf, wenn der Name im System-Prompt vorkommt. Die Maßnahme ist ein Audit des System-Prompts: jedes Vorkommen von "Meridian" wird entfernt oder durch eine neutrale Beschreibung ersetzt ("dieses Projekt", "diese Analyse", o.ä.). Ein explizites Output-Verbot ist kein Ersatz dafür.

**D4b — Framing: Arbeitserleichterung, nie Automatisierung:**

> Wenn der Agent den Zweck des Interviews erklärt, verwendet er ausschließlich Formulierungen, die auf Arbeitserleichterung für den Mitarbeiter abzielen.
>
> Richtig: "um zu verstehen, wo deine Arbeit unnötig aufwändig ist und wo wir das leichter machen können"
> Richtig: "um herauszufinden, wo Prozesse reibungsloser laufen könnten"
>
> Falsch: "um Prozesse zu optimieren" (ohne Bezug auf den Mitarbeiter)
> Falsch: "um Automatisierungspotenzial zu identifizieren"
> Falsch: jede Formulierung, die impliziert, dass die Arbeit des Mitarbeiters wegfallen könnte

**D4c — Vorab konfigurierte Prozesse:**

Wenn das Interview mit vordefinierten Prozessen initialisiert wurde (aus dem Interview-Setup), darf der Agent diese im Opener nicht beim Namen nennen. Er eröffnet offen:

> "Erzähl mir kurz: Was sind deine Hauptaufgaben und wie sieht ein typischer Arbeitstag bei dir aus?"

Die vordefinierten Prozesse dienen als Orientierung für den Agenten (er weiß, wohin er steuern soll), erscheinen aber nicht im ersten Turn. Erst wenn der Mitarbeiter einen Prozess benennt, führt der Agent ihn vertiefend weiter.

Ausnahme: Wenn das Interview explizit als Folgegespräch konfiguriert ist und der Kontext das rechtfertigt, darf der Agent einen bereits bekannten Prozess im Opener erwähnen.

### D5 — Coverage-Check: kein sichtbarer Verarbeitungsschritt

Der Coverage-Check bleibt vollständig intern. Der Agent führt ihn durch, ohne das dem Mitarbeiter zu kommunizieren.

> Falsch: "lass mich kurz prüfen, ob wir alles abgedeckt haben"
> Falsch: "ich möchte kurz sicherstellen, dass wir nichts vergessen haben"
>
> Richtig: Agent führt Check intern durch → sendet direkt den Puffer-Satz + Abschlussfrage

Adressiert: Erweiterung von ADR-007 D2 (Silence-Constraint).

### D6 — Agent führt, fragt nicht um Erlaubnis

Wenn der Mitarbeiter in der Wrap-up-Phase einen noch nicht erfassten Prozess nennt, entscheidet der Agent und handelt:

> Falsch: "Sollen wir den noch kurz mit aufnehmen?"
> Richtig: "Erzähl kurz, wie der Mahnprozess bei euch abläuft."

Einzige Ausnahme: Der Mitarbeiter signalisiert selbst, dass er die Details gerade nicht parat hat. In diesem Fall bietet der Agent einen separaten Termin an und schließt das Interview ohne diesen Prozess.

### D7 — Erweiterter Silence-Constraint: interne Zwecke

ADR-007 D2 (keine internen Verarbeitungsschritte im Text-Output) wird um interne Zweck-Kommunikation erweitert:

> Der Agent kommuniziert nie, warum er eine Frage stellt, was er mit der Antwort macht oder für wen die Information bestimmt ist.
>
> Falsch: "um das für meine Auswertung zu quantifizieren"
> Falsch: "das hilft mir, den ROI zu berechnen"
> Falsch: "das brauche ich für die Dokumentation"
>
> Richtig: Die Frage wird direkt gestellt, ohne Begründung.

---

## Consequences

**Positiv:**
- `walkthrough_step` erhebt Prozessfluss, Reibungspunkte und Primär-Schmerzpunkte — das ist die Grundlage für aussagekräftige Use-Case-Ableitung
- `pain_point_primary` als Direktzitat ist für Pitches und Berichte unmittelbar verwertbar
- Slot-Konfidenz macht den tatsächlichen Sicherheitsgrad eines Werts transparent — ROI-Zahlen mit `estimate`-Flag sind ehrlicher
- D4b (Framing) erhöht die Offenheit des Mitarbeiters und reduziert defensives Antwortverhalten
- D4c (offene Eröffnung) macht das Interview weniger instruiert und mehr explorativ
- Silence-Constraint-Erweiterungen (D5, D7) schließen die verbleibenden Leak-Muster

**Negativ:**
- `walkthrough_step` verlängert das Interview um schätzungsweise 4-6 Turns pro Prozess — bei zwei Prozessen sind das 8-12 zusätzliche Turns. Dieser Mehraufwand ist inhaltlich begründet, aber für kurze Discovery-Sessions zu beachten.
- D4c (keine Prozessnennung im Opener) kann dazu führen, dass der Mitarbeiter Prozesse nennt, die nicht im Setup stehen — der Agent muss entscheiden, ob er divertierende Prozesse exploriert oder fokussiert.
- Opportunistische Quantifizierung erhöht die kognitive Last des Agenten: er muss gleichzeitig den Ablauf führen und den Slot-Status tracken. Das erfordert klare Instruktionen und Few-Shot-Beispiele.
- Mehr Felder im step_tracker erhöhen die Komplexität des State-Schemas.

**Offene Fragen:**
- Wie viele `process_steps` sind sinnvoll zu erfassen bevor der Agent weiter geht? Gibt es ein Limit oder endet der Ablauf natürlich wenn der Mitarbeiter zum Ende kommt?

**Folgeentscheidungen:**
- Neuer Eval-Lauf nach Implementierung — direkter Vergleich gegen buchhalter-2.md
- Anpassung der ROI-Darstellung im Report: Konfidenz-Flag anzeigen wenn `confidence != "confirmed"`

---

## Umsetzung

| # | Entscheidung | Datei(en) | Aufwand |
|---|-------------|-----------|---------|
| D1 | `walkthrough_step` + `slot_completion` ersetzen `quantify_step`; neue step_tracker-Felder | System-Prompt (Phasen-Block), `interview_state`-Schema, Few-Shot-Beispiele | L |
| D2 | Slot-Konfidenz-Felder | System-Prompt (slot_completion-Instruktion), `interview_state`-Schema | M |
| D3 | data_sources Pflicht-Slot in `slot_completion` | System-Prompt (slot_completion-Instruktion) | S |
| D4 | Opener-Constraint (3 Regeln) | System-Prompt (Opener-Sektion) | S |
| D5 | Coverage-Check intern | System-Prompt (wrap_up-Sektion) | S |
| D6 | Agent führt, fragt nicht | System-Prompt (wrap_up + D5-Sektion aus ADR-007) | S |
| D7 | Silence-Constraint Zweck-Extension | System-Prompt (D2-Sektion aus ADR-007) | S |

D1 ist der aufwändigste Schritt: `quantify_step` entfällt, `walkthrough_step` + `slot_completion` ersetzen ihn mit neuem Phasen-Block, erweitertem State-Schema und Few-Shot-Beispielen für opportunistische Quantifizierung im Ablauf. Empfohlene Reihenfolge: D4 + D5 + D7 zuerst (additive Fixes, kein Schema-Change), dann D1 + D2 + D3 gemeinsam (Schema-Änderung einmalig).

---

## Implementierung (2026-05-27)

**Umgesetzt durch Build-Pipeline (Architect → Coder×2 → Reviewer×2 → Verifier).**

### Wave 1 — D4 + D5 + D7 (Prompt-only)

`src/services/interviewAgent.ts`:
- D4a: "Meridian" aus `buildStaticPrompt` entfernt
- D4b: Framing-Regeln (Arbeitserleichterung) im intro-Methodik-Block explizit gemacht
- D4c: Opener-Constraint — `focusTopics` als "NUR interne Steuerung" markiert, Pflicht-Einstiegsfrage ohne Prozess-Nennung
- D5: Coverage-Check-Methodik: kein sichtbarer Übergangskommentar mehr
- D6: Erlaubnis-Fragen aus wrap_up + coverage_check entfernt; Few-Shot-Beispiel 4 korrigiert
- D7: Silence-Constraint um interne Zwecke erweitert

### Wave 2 — D1 + D2 + D3 (Schema + Typen + Prompt)

`src/services/interviewAgent.ts`:
- `Phase`: `'walkthrough_step' | 'slot_completion'` hinzugefügt
- `StepEntry.status`: `'quantifying'` → `'walkthrough'` (dead status entfernt)
- `StepEntry`: neue Felder `process_steps`, `friction_points`, `friction_tools`, `pain_point_primary` (optional, additiv)
- `SlotValue`: `confidence?` und `qualifier?` hinzugefügt (D2)
- `MANDATORY_SLOTS`: `data_sources` aufgenommen (D3), jetzt 4 Einträge
- Neues Tool `update_walkthrough_data` mit additivem Merge
- System-Prompt: `walkthrough_step`-Sektion (5 Leitfragen, opportunistische Quantifizierung, Few-Shot-Beispiele), `slot_completion`-Sektion (Pflichtslot-Nachfrage, Konfidenz-Heuristik, D3-Fallback `data_sources: []`)
- `quantify_step`-Sektion vollständig entfernt
- `transition_phase`-Enum: alle 6 Phasen

`src/app/api/interview/[token]/chat/route.ts`:
- `slot_completion`-Phase erhält Missing-Slot-Kontext identisch wie `coverage_check`

`supabase/migrations/20260527000000_adr008_phase_walkthrough.sql` (applied 2026-05-27):
- Phase-CHECK-Constraint um `walkthrough_step` + `slot_completion` erweitert
- JSONB-Backfill: `status: 'quantifying'` → `'walkthrough'` in bestehenden `step_tracker`-Einträgen

**Tests:** 222 Unit Tests grün (vorher 218 — 4 neue Tests für `update_walkthrough_data`, `data_sources` als Pflichtslot, walkthrough-Initialisierung, slot_completion-Phase)

---

## Amendment 2026-05-27 — Eval-Befunde nach Implementierung (buchhalter-1 + buchhalter-2)

Zwei Verifikations-Eval-Läufe nach Implementierung ergaben folgende Befunde:

**buchhalter-1 (FAIL):** `register_step` wurde nie aufgerufen — alle 3 Prozesse intern im step_tracker erfasst, aber kein DB-Eintrag. Das Interview lief 21 Turns und schloss nie ab. Ursache: Die `process_loop`-Anweisung "register_step aufrufen, dann transition_phase" war als Soft Constraint formuliert. Das Modell hat `transition_phase` ohne `register_step` aufgerufen.

**buchhalter-2 (PASS):** 26 Turns, 3 Prozesse korrekt registriert, alle Pflicht-Slots gefüllt. Verbleibende Befunde:
1. **Anchoring-Bias residual** — Agent verbalisiert berechnete Werte im Text-Output ("daher rechne ich mit 90 als Orientierungswert", "notiere ich für die Dauer 150 Minuten"). ADR-009 D4 war als Silence-Constraint formuliert aber deckte diese Formulierungsmuster nicht ab.
2. **Phase-Transition-Bug** — Ab Turn 20 zirkuläre Fragen zu bereits beantworteten Themen. Root Cause: In `slot_completion`-Phase mit vollständigen Slots lieferte `buildDynamicContext` kein "all done"-Signal — die `coverageCheckSection` war für `slot_completion` mit leerer Missing-Liste leer. Kein Trigger für `enter_coverage_check`.
3. **duration_minutes Scoping** — "ca. 1 Stunde pro Woche für Sucharbeit" wurde als `duration_minutes=60` für Rechnungsprüfung eingetragen. Der Teilaufwand eines Ausnahmepfads ist keine Prozess-Gesamtdauer.

**Fixes (2026-05-27, Commit nach dieser Session):**
- Silence-Constraint: Verbalized-Anchor-Muster ("rechne ich mit", "notiere ich") als explizite Falsch-Beispiele ergänzt
- `buildDynamicContext`: `slot_completion`-all-done-Signal als dritte `coverageCheckSection`-Bedingung hinzugefügt
- `slot_completion` Methodik: VORAUSSETZUNG-Check (register_step Pflicht), Abschluss-Signal (record_slot step_complete), duration_minutes Scoping-Warnung
- `walkthrough_step` Methodik: Duration-Scoping-Regel für "pro Woche/Monat"-Angaben
- `process_loop` Methodik: register_step + transition_phase als PFLICHT-Reihenfolge explizit
- `record_slot` Tool: Gibt `step_complete: true` zurück wenn alle Pflicht-Slots eines Schritts gefüllt sind
