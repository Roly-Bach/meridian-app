# ADR-005: Interview-Engine Gesprächsführung — Eval-Befunde 2026-05-25

**Status:** Accepted (2026-05-25)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Eval-Lauf Buchhalter-Persona, Transcript `docs/evals/interview/2026-05-25-buchhalter.md`

---

## Context

Der erste vollständige Eval-Lauf der Interview-Engine (Buchhalter-Persona, Modell: `google/gemini-3.1-flash-lite`) hat das Interview bis `status='completed'` durchgeführt und dabei mehrere strukturelle Schwächen in der Gesprächsführung aufgedeckt.

Beobachtete Probleme:

- Der Agent wiederholt Begrüßung, Selbstvorstellung und Zweckerklärung in Turn 2, obwohl der Mitarbeiter bereits geantwortet hat.
- Der Agent fragt den Mitarbeiter, welcher Prozess zuerst besprochen werden soll — gibt damit die Gesprächsführung ab.
- Die Anrede (Du/Sie) ist bislang nicht produktseitig festgelegt, das Modell wählt situativ.
- Die Agenten-Identität ("Mein Name ist der Meridian-Interviewer") ist generisch und wirkt wie eine Rollenbeschreibung statt eines Namens.
- Formulierungen sind floskelhaft: Empathie-Formeln, Meta-Kommentare zum eigenen Vorgehen, Corporate-Sprache.
- Der Wrap-up-Übergang ist mechanisch: Phase `coverage_check` wird ohne Gesprächs-Puffer getriggert.
- Die Stundensatz-Abfrage (65 €/h) erscheint im Wrap-up ohne Vorbereitung — und ist grundsätzlich fehl am Platz im Mitarbeiter-Interview.
- Die `rule_based`-Klassifikation stuft Prozesse mit Ausnahmen fälschlicherweise als nicht-regelbasiert ein.
- Die Tester-Persona (Buchhalter) antwortet zu strukturiert und liefert Zahlen sofort und ungefragt — was den Slot-Filling-Prozess nicht wirklich testet.

Diese Befunde betreffen zwei Schichten: das System-Prompt der Interview-Engine und die Persona-Definition des Tester-Agents.

---

## Decisions

### D1 — Anrede: Du als Standard

Die Interview-Engine verwendet durchgehend **Du** als Anredeform. Begründung: Du reduziert die Hemmschwelle, senkt die wahrgenommene Formalität und fördert das Erzählen von Erfahrungen und Schwierigkeiten — was für Knowledge Elicitation wichtiger ist als Distanzwahrung.

Gilt nur für die Interview-Engine. Konfigurierbarkeit pro Workspace ist als spätere Extension möglich, aber kein MVP-Scope.

### D2 — Agenten-Identität: Kein Name, direkter Einstieg

Der Agent stellt sich nicht namentlich vor. Der Opener enthält keine Selbstbezeichnung — weder "Meridian-Interviewer" noch einen fiktiven Vornamen. Das Gespräch beginnt direkt mit Kontext und erster Frage.

Begründung: Jede Namensgebung erzeugt eine Erwartungshaltung (menschlich vs. System), die das Modell nicht konsistent erfüllen kann. Kein Name ist ehrlicher als ein falscher.

### D3 — Opener: Begrüßung nur einmal

Das System-Prompt erhält eine explizite Anweisung: Begrüßung, Selbstvorstellung und Zweck-Erklärung erscheinen **ausschließlich im ersten Turn**. In allen Folge-Turns startet der Agent direkt mit der inhaltlichen Reaktion auf die letzte Antwort des Mitarbeiters.

### D4 — Prozessauswahl: Agent führt aktiv

Der Agent gibt die Reihenfolge der besprochenen Prozesse nicht an den Mitarbeiter ab. Regelung:

- Wenn die Übersichtsantwort einen klaren Frequenz- oder Komplexitäts-Anker enthält (z.B. "80–100 Rechnungen pro Monat"), wählt der Agent den Einstiegsprozess selbst und begründet kurz warum — typisch ein Satz.
- Wenn kein klarer Anker vorhanden ist, fragt der Agent nach dem Prozess, der dem Mitarbeiter die meisten Schwierigkeiten bereitet. Der exakte Wortlaut ist nicht festgelegt und soll sich natürlich aus dem Gesprächskontext ergeben. Die Frage zielt auf konkrete Erfahrungen mit Problemen oder Stolpersteinen — nicht auf abstrakte Verbesserungswünsche und nicht auf die bloße Reihenfolge-Präferenz des Mitarbeiters.

Methodische Grundlage: Critical Incident Technique (Flanagan 1954) — schwierige/kritische Situationen sind der ergiebigste Einstiegspunkt für implizites Prozesswissen.

### D5 — Wrap-up: Puffer vor Phase-Wechsel

Vor dem Übergang in `coverage_check` gibt der Agent ein kurzes Gesprächs-Signal, das den Übergang ankündigt, ohne die Phase mechanisch zu benennen. Beispiel: *"Ich glaube, wir haben die wichtigsten Abläufe gut zusammen. Lass mich kurz prüfen, ob wir alles abgedeckt haben — einen Moment."*

Das verhindert den abrupten Schnitt von letzter Sachfrage zu Zusammenfassung.

### D6 — Stundensatz: Nicht im Mitarbeiter-Interview abfragen

Der Stundensatz wird im Interview mit dem Mitarbeiter nicht erfragt. Zwei Gründe:

1. **Psychologisch:** Der Mitarbeiter soll nicht das Gefühl bekommen, durch das Interview seine eigene Automatisierung voranzutreiben. Eine Kostenabfrage ("Was kostet deine Stunde?") macht genau diesen Subtext hörbar.
2. **Sachlich:** Mitarbeiter kennen ihren internen Stundensatz in der Regel nicht. Die Angabe wäre eine Schätzung ohne verlässliche Grundlage.

Der Stundensatz für die ROI-Berechnung kommt aus der Workspace-Konfiguration (setzt der Berater/Admin vor dem Interview) oder aus einer rollenbasierten Vorschlagstabelle im System — nicht aus dem Gespräch mit dem Mitarbeiter.

Konsequenz: Das System-Prompt enthält keine Anweisung zur Stundensatz-Abfrage. Der Wrap-up endet nach der Prozess-Zusammenfassung und der offenen Frage nach vergessenen Themen.

### D7 — Formulierungsqualität: Verbotsliste im System-Prompt

Das System-Prompt erhält eine explizite Liste verbotener Formulierungsmuster:

**Verboten:**
- Empathie-Floskeln ohne Inhalt: "Das klingt nach einem sehr zeitraubenden Prozess"
- Meta-Kommentare: "Lassen Sie uns nun den nächsten Aspekt beleuchten", "Um das Bild zu vervollständigen"
- Corporate-Sprache: "Ihr wertvolles Prozesswissen strukturiert dokumentieren"
- Selbst-Ankündigungen: "Ich gehe nun zur Überprüfung der Vollständigkeit über"

**Stattdessen:** Direkte Anschluss-Fragen, kurze Bestätigungen ("Verstanden."), natürliche Übergänge.

### D8 — rule_based Klassifikation: Ausnahmen schließen Regelbasierung nicht aus

Das System-Prompt für die `register_step`-Tool-Instruktion wird präzisiert:

> `rule_based = true` wenn der Prozess einer definierten Reihenfolge oder einem Regelwerk folgt — **auch wenn es Ausnahmen gibt**. `rule_based = false` nur wenn der Prozess grundsätzlich situativ entschieden wird und kein Standardablauf existiert.

### D9 — Tester-Agent: Narrativer Einstieg, Zahlen auf Nachfrage

Die Persona-Definition erhält eine ergänzende Anweisung für alle Personas mit `verbosity: detailed`:

> Die initiale Antwort auf eine Prozessfrage ist narrativ ("Ich fange damit an, die Rechnung zu prüfen..."). Konkrete Zahlen und Slot-Werte werden erst genannt, wenn der Agent explizit danach fragt. Das testet die Elicitation-Fähigkeit des Agents, statt sie zu umgehen.

Unaufgefordertes Nennen von Informationen (die nicht direkt abgefragt wurden) bleibt erlaubt — das ist menschliches Gesprächsverhalten und soll erhalten bleiben.

### D10 — Interview-Engine: Unsichere Slot-Werte aktiv klären

Wenn ein Mitarbeiter einen Slot-Wert mit expliziter Unsicherheit nennt ("ich würde schätzen", "ungefähr", "ich weiß nicht genau"), fragt der Agent nach statt den Wert zu übernehmen oder zu ignorieren:

> *"Das ist schon eine gute Größenordnung — darf ich den Wert als grobe Schätzung für die Berechnung verwenden, oder ist er zu unsicher?"*

Ziel: Auch Schätzwerte sollen als `duration_minutes` extrahiert werden, solange der Mitarbeiter sie als verwendbar bestätigt. Kein null bei vorhandener Schätzung.

Betrifft das System-Prompt (Tool-Instruktion für `record_slot`) sowie die Gesprächsführungsregeln.

### D11 — Interview-Engine: Step-Tracker-Deduplizierung

Der step_tracker enthält in seltenen Fällen denselben Prozessschritt unter leicht abweichenden Titeln (z.B. "Rechnungsbearbeitung" und "Rechnungsprüfung"). Beim Aufruf von `register_step` prüft der Agent, ob ein semantisch gleichwertiger Schritt bereits im Tracker vorhanden ist, bevor er einen neuen Eintrag anlegt.

Umsetzung: Hinweis im System-Prompt, dass der Agent vor `register_step` den bisherigen Tracker prüft und ggf. den bestehenden Eintrag aktualisiert statt einen neuen zu erstellen.

### D12 — Interview-Engine: Leerer Stream bei Tool-only-Turns (BUG-EVAL-2, bekannt)

Wenn der Agent in einem Turn ausschließlich Tool-Calls ohne Text ausführt, liefert `toTextStreamResponse()` einen leeren Body. Der aktuelle `onFinish`-Handler speichert diesen Turn nicht, und die UI zeigt keine Rückmeldung.

Entscheidung: Der Agent soll bei internen Verarbeitungsschritten (insbesondere `coverage_check`) immer einen kurzen Text-Output liefern, bevor oder während er Tool-Calls ausführt. Das löst das Problem auf Prompt-Ebene ohne Backend-Änderung.

Beispiel: *"Ich prüfe kurz, ob wir alle Themen abgedeckt haben..."* — danach Tool-Call.

Hinweis: D5 (Wrap-up-Puffer) adressiert den Übergang, D12 adressiert das technische Leer-Stream-Problem. Beide Entscheidungen ergänzen sich.

---

## Consequences

**Positiv:**
- Gesprächsfluss wirkt natürlicher, weniger wie ein Formular-Ausfüllprozess.
- Agent übernimmt aktive Führungsrolle — konsistent mit dem Produktversprechen ("KI-geführtes Interview").
- Du-Anrede senkt Hemmschwelle und erhöht Bereitschaft, auch schwierige Themen zu nennen.
- Tester-Agent testet die Elicitation-Fähigkeit des Agents tatsächlich statt die Antworten vorweg zu liefern.
- `rule_based`-Klassifikation wird zuverlässiger → Use-Case-Engine bekommt korrektere Heuristik-Basis.

**Negativ:**
- Aktive Prozessauswahl durch den Agent setzt voraus, dass der Agent die Übersichtsantwort korrekt interpretiert — schlechte Extraktion führt zu suboptimaler Reihenfolge.
- Narrativer Tester-Agent macht Eval-Läufe etwas länger (mehr Nachfrage-Turns nötig).

**Offene Fragen:**
- Stundensatz in Workspace-Konfiguration: Muss als eigenes Feature spezifiziert werden (Berater setzt Stundensatz pro Rolle vor dem Interview).
- Du-Konfigurierbarkeit pro Workspace: Kein MVP-Scope, als Extension vorgemerkt.

**Folgeentscheidungen:**
- System-Prompt-Änderungen müssen mit einem neuen Eval-Lauf verifiziert werden (gleiche Buchhalter-Persona, direkter Vergleich).
- Persona-Datei `buchhalter.ts` erhält Kommentar-Ergänzung zur Narrativ-Regel (D9).

---

## Umsetzung

| # | Entscheidung | Datei(en) | Aufwand |
|---|-------------|-----------|---------|
| D1 | Du-Anrede | System-Prompt in Interview-Engine | S |
| D2 | Agenten-Name | System-Prompt | S |
| D3 | Opener-Regel | System-Prompt | S |
| D4 | Prozessauswahl | System-Prompt | M |
| D5 | Wrap-up-Puffer | System-Prompt | S |
| D6 | Stundensatz aus Interview entfernen | System-Prompt + Workspace-Config (separates Feature) | S / M |
| D7 | Formulierungsverbote | System-Prompt | S |
| D8 | rule_based-Präzisierung | System-Prompt (Tool-Instruktion) | S |
| D9 | Narrativer Tester-Agent | `personas/buchhalter.ts`, Eval-Skill-Doku | S |
| D10 | Unsichere Slot-Werte klären | System-Prompt (Tool-Instruktion `record_slot`) | S |
| D11 | Step-Tracker-Deduplizierung | System-Prompt | S |
| D12 | Leerer Stream bei Tool-only-Turns | System-Prompt (Gesprächsführungsregeln) | S |

Alle D1–D8 und D10–D12 sind System-Prompt-Änderungen in einer Datei. Können als ein Commit umgesetzt werden.
