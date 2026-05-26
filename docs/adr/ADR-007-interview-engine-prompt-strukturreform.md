# ADR-007: Interview-Engine — System-Prompt Strukturreform

**Status:** Accepted (2026-05-26)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Eval-Lauf `docs/evals/interview/2026-05-26-buchhalter.md` — dritter Lauf mit identischen Regressions-Mustern trotz ADR-005 + ADR-006
**Supersedes:** Ergänzt ADR-005 + ADR-006, ersetzt sie nicht

---

## Context

ADR-005 und ADR-006 haben den System-Prompt durch Verbotslisten und abstrakte Constraints erweitert. Der dritte Eval-Lauf zeigt: die Maßnahmen wirken nicht. Verbotene Formulierungen erscheinen weiterhin in fast jedem Turn, teilweise wortidentisch mit den Negativbeispielen aus dem Prompt.

Die Ursache ist strukturell: Verbotslisten kämpfen gegen den Trainings-Prior des Modells. Das ist kein modellspezifisches Problem — der IFEval-Benchmark (25 Constraint-Typen) zeigt, dass auch fortgeschrittene Modelle wie Claude Sonnet regelmäßig an fundamentalen Constraints wie Wortlimits und Keyword-Verboten scheitern. Sprachmodelle sind Pattern-Follower, keine Rule-Follower. Ein "verboten: X" im Prompt verschiebt die Wahrscheinlichkeit, eliminiert sie nicht. Je länger die Liste, desto größer die Chance, dass das Modell im konkreten Turn einen anderen Weg zur gleichen Floskel findet.

Anthropic empfiehlt in der offiziellen Prompt-Engineering-Dokumentation explizit: Positive Beispiele für erwünschtes Verhalten sind wirksamer als negative Beispiele oder Verbotslisten. "Do it like this" (Few-Shot-Positivbeispiel) schlägt "never do X" (Prohibition) — das ist über Modell-Größen hinweg reproduzierbar.

Gleichzeitig hat der Eval-Lauf drei neue Problemkategorien aufgedeckt, die in ADR-005/006 nicht erfasst sind:

**Interne State-Leaks:** Der Agent kommuniziert interne Verarbeitungsschritte an den Mitarbeiter — technische Fehler ("Entschuldige, da habe ich mich bei der Eingabe vertan", Turn 11), Slot-Arithmetik ("1.440 Minuten, um das einheitlich zu erfassen", Turn 11) und Klassifikationsentscheidungen ("würde ich dies als regelbasiert einstufen", Turn 12). Das bricht das Interview-Framing.

**Best-Case-Bias:** Der Agent rahmt die Duration-Frage mit "Wenn alles glatt läuft" (Turn 3), obwohl die Persona sofort klarstellt, dass der reibungslose Fall die Ausnahme ist. Der Agent ignoriert diesen Hinweis und akzeptiert 5 Minuten als Slot-Wert. Das führt zu systematisch zu niedrigen duration_minutes-Werten.

**Mahnprozess-Signal zu spät erkannt:** Die Persona erwähnt den Mahnprozess in Turn 14 (coverage_check). Der Agent lehnt die Exploration aktiv ab ("Da wir uns auf die Schwerpunkte konzentrieren wollten"). ADR-006 D16 greift nur bei der expliziten Abschlussfrage, nicht bei Erwähnungen im gesamten Wrap-up.

**Paradigma-Problem:** Der Prompt sagt, was der Agent nicht tun soll. Er schreibt nicht vor, wie ein Turn strukturell aussehen muss. Das ist der Kern der Unwirksamkeit.

---

## Decisions

### D1 — Paradigmenwechsel: Strukturvorschrift + Positiv-Formulierung statt Verbotsliste

Die gesamte Gesprächsführungssektion des System-Prompts wird umgebaut. Zwei Prinzipien gelten gleichzeitig:

**Strukturvorschrift:** Jeder Agent-Turn hat exakt dieses Format:

> Ein Turn besteht aus maximal zwei Elementen in dieser Reihenfolge:
> 1. Optional: eine kurze Reaktion auf die letzte Antwort — maximal ein Satz, keine Bewertung, keine Danksagung.
> 2. Pflicht: eine direkte Frage.
>
> Mehr nicht.

**Positiv-Formulierung:** Die Strukturvorschrift selbst ist positiv formuliert — sie schreibt vor, was der Turn enthält, nicht was er nicht enthalten darf. Die Verbotslisten aus ADR-005 D7 und ADR-006 D6 bleiben als Referenz erhalten, treten aber hinter die Strukturvorschrift zurück. Ein Modell, das die Strukturvorschrift einhält, hat mechanisch keinen Platz mehr für Floskeln.

Ausnahmen von der Zwei-Element-Regel:
- Turn 1 (Opener): Kontext + Einstiegsfrage, kein Werturteil
- Abschluss-Turn nach `complete_interview`: kein weiteres Zwei-Element-Format, aber weiterhin keine Floskeln
- coverage_check mit mehreren offenen Slots (ADR-006 D4): mehrere fehlende Slots dürfen in einer Frage gesammelt werden — das Zwei-Element-Format gilt, der Frage-Teil darf dann mehrere Aspekte bündeln

### D2 — Silence-Constraint: Interne Verarbeitung erscheint nie im Text-Output

Explizite Anweisung im System-Prompt:

> Tool-Calls, Slot-Werte, Klassifikationsentscheidungen, Arithmetik und technische Fehler erscheinen nie im Text-Output. Was intern passiert, bleibt intern.
>
> Falsch: "Entschuldige, da habe ich mich bei der Eingabe vertan."
> Falsch: "gehen wir von 1.440 Minuten aus, um das einheitlich zu erfassen."
> Falsch: "würde ich dies als regelbasiert einstufen."
>
> Richtig: Wenn ein Tool-Call korrigiert wird, passiert das still. Der nächste Text-Turn setzt direkt mit der Frage fort.

Adressiert: NEU-1, NEU-2, NEU-3 (Internal-State-Leaks).

### D3 — Duration-Frage: Typischer Aufwand, nicht Best Case

Die Anweisung zur duration_minutes-Elicitation wird präzisiert:

> Frage nach dem typischen Aufwand — inklusive Ausreißer und Ausnahmen. Nie nach dem reibungslosen oder idealen Fall.
>
> Falsch: "Wenn alles glatt läuft, wie lange dauert eine Rechnung?"
> Richtig: "Wie lange sitzt du im Schnitt an einer Rechnung — also über alle Fälle gerechnet, auch die mit Rückfragen oder fehlenden Daten?"

Wenn die Persona selbst den Best Case nennt und explizit darauf hinweist, dass er die Ausnahme ist, fragt der Agent nach dem repräsentativen Wert:

> "Du sagst, das ist eher die Ausnahme. Wie lange dauert es im Durchschnitt, wenn man die aufwändigeren Fälle einrechnet?"

Adressiert: NEU-4 (Best-Case-Bias).

### D4 — Opener-Constraint: Positiv-Positivregel statt Verbotsliste

Statt "Begrüßung nur im ersten Turn" und "verbotene Startwörter" (die drei Läufe lang nicht gewirkt haben) erhält der Prompt eine Positiv-Positivregel für Turn 2+:

> Ab Turn 2 beginnt jeder Turn mit dem inhaltlichen Kern — dem ersten Wort der Reaktion oder Frage.
>
> Richtig (Turn 2): "Die Rechnungsprüfung ist ein guter Einstieg, da du sie täglich machst — wie viele Rechnungen bearbeitest du pro Monat?"
> Richtig (Turn 2): "90 Rechnungen im Schnitt — wie lange sitzt du typischerweise an einer, über alle Fälle gerechnet?"
>
> Falsch (Turn 2): "Hallo Andreas, schön dass du dir die Zeit nimmst. Das klingt nach..."

Die positiven Beispiele zeigen den Einstieg direkt. Verbotslisten für Startwörter entfallen — sie werden durch das Format-Constraint aus D1 bereits ausgeschlossen.

Adressiert: Turn-2-Opener-Wiederholung (persistierendes Problem aus ADR-005 D3 + ADR-006 D2, drei Läufe unbehoben).

### D5 — Neuer Prozess im Wrap-up: Trigger gilt für gesamte Phase, nicht nur Abschlussfrage

ADR-006 D16 beschreibt den Fall, dass der Mitarbeiter auf die explizite Abschlussfrage ("Gibt es noch Prozesse?") mit einem neuen Prozess antwortet. Turn 14 zeigt: die Erwähnung kann früher kommen — in coverage_check, bevor die Abschlussfrage gestellt wurde.

Die Anweisung wird ausgeweitet:

> Sobald der Mitarbeiter in der Wrap-up-Phase (coverage_check oder danach) einen Prozess oder eine Tätigkeit nennt, die noch nicht im step_tracker registriert ist, gilt das als Explorations-Signal — unabhängig davon, ob gerade die Abschlussfrage gestellt wurde.
>
> Reaktion: einmalig anbieten, diesen Prozess aufzunehmen. Wenn ja: zurück zu explore_step. Wenn nein: weiter.
>
> Nicht: den Hinweis ignorieren oder aktiv ablehnen ("Da wir uns auf X konzentrieren wollten...").

Adressiert: NEU-5 (Mahnprozess in Turn 14 abgelehnt, erst in Turn 18 aufgegriffen).

### D6 — Span-Confirmation: Als Pflichtschritt in Turn-Format integriert

ADR-006 D3 (Spannenangaben → Mittelwert-Bestätigung) gilt als Regel, wurde aber im Lauf ignoriert (1440 min = oberes Ende statt Mittelwert 1200 min).

Die Bestätigung wird aus den Gesprächsregeln in die Slot-Filling-Instruktion verschoben — als Pflichtschritt vor `record_slot`, nicht als optionale Gesprächsregel:

> Wenn die Persona eine Spanne nennt (z.B. "zwei bis drei Tage", "16 bis 24 Stunden"), darf `record_slot` für `duration_minutes` erst aufgerufen werden, nachdem der repräsentative Wert bestätigt wurde.
>
> Pflichtformulierung: "Soll ich mit dem Mittelwert rechnen, also [Mittelwert]?" — oder falls die Persona einen Schwerpunktwert nennt, diesen verwenden.

Adressiert: ADR-006 D3, persistierend nicht wirksam.

### D8 — Few-Shot-Positivbeispiele für gute Turns

Der System-Prompt erhält 3–5 konkrete Beispiel-Turns im Stil "Persona sagt X → Agent antwortet Y". Die Beispiele zeigen erwünschtes Format positiv — nicht als Kommentar zu Fehlern, sondern als Muster zum Reproduzieren.

Empirische Grundlage: Few-Shot-Positivbeispiele sind die wirksamste Prompting-Technik für Verhaltens-Constraints (Forschungsstand 2025/2026). Mehr als 8 Beispiele führen zu Performance-Degradation; 3–5 diverse Beispiele sind optimal.

Auswahlkriterien für die Beispiele — jedes deckt einen anderen schwierigen Fall ab:

| Beispiel | Szenario | Was wird gezeigt |
|----------|---------|-----------------|
| 1 | Persona nennt Best Case, erwähnt Ausnahmen | Agent fragt nach Durchschnitt |
| 2 | Persona nennt Spanne ("2–3 Tage") | Agent bestätigt Mittelwert vor record_slot |
| 3 | Persona gibt unsicheren Wert ("ich schätze...") | Agent übernimmt mit Bestätigung (D10/ADR-005) |
| 4 | Persona erwähnt neuen Prozess im Wrap-up | Agent bietet Aufnahme an (D5) |
| 5 | Turn-2-Situation nach Opener | Agent startet direkt inhaltlich, kein Greeting |

Die Beispiele werden in einen `<examples>`-XML-Block im System-Prompt eingebettet, getrennt vom restlichen Prompt-Text.

Adressiert: Grundsätzliche Prompt-Wirksamkeit über alle D1–D7-Constraints hinweg.

### D7 — Strukturregel für Abschluss-Sequenz

Die doppelte Abschlusssequenz (Turn 16 + Turn 17) und die confusing Turn-17-Sequenz ("Danke... Gibt es noch Prozesse?") werden durch eine klare Phasenregel verhindert:

> Die Abschlussphase besteht aus exakt dieser Sequenz:
> 1. Puffer-Satz ("Ich glaube, wir haben die wichtigsten Abläufe gut zusammen.")
> 2. Abschlussfrage ("Gibt es noch Prozesse oder Tätigkeiten, die wir nicht besprochen haben?")
> 3. Antwort abwarten.
> 4. Auswerten: Neuer Prozess → D5. Keine neuen Inhalte → `complete_interview`.
> 5. Abschluss-Turn ohne inhaltliche Fragen.
>
> Keine zweite Abschlussrunde. Kein "Danke" vor der Abschlussfrage.

---

## Consequences

**Positiv:**
- Strukturvorschrift schließt Floskeln mechanisch aus — das Modell hat schlicht keinen Platz mehr dafür.
- Positiv-Formulierung (D1, D4, D8) arbeitet mit dem Trainings-Prior des Modells statt dagegen — empirisch wirksamer als Verbotslisten.
- Few-Shot-Positivbeispiele (D8) zeigen dem Modell das gewünschte Muster direkt, ohne es durch Verbote zu erschließen.
- Silence-Constraint verhindert Internal-State-Leaks unabhängig vom Modell.
- Best-Case-Bias behoben → duration_minutes wird repräsentativer und damit die ROI-Berechnung verlässlicher.
- Span-Confirmation als Pflichtschritt in Slot-Filling verankert → kann nicht mehr durch Gesprächsdynamik übersprungen werden.
- Mahnprozess-Signal wird früher erkannt → weniger verlorene Prozessschritte.
- Regelwerk wird weniger modellabhängig — funktioniert mit Flash Lite zuverlässig, Flash ist dann optionaler Qualitätsgewinn.

**Negativ:**
- D1 (Strukturvorschrift) schränkt die Ausdrucksfreiheit des Agenten ein. Natürlich wirkende Übergänge, die mehr als zwei Sätze brauchen, sind nicht mehr möglich.
- D3 (Durchschnitt statt Best Case) kann in manchen Kontexten schwieriger zu beantworten sein — Mitarbeiter haben Durchschnittswerte seltener parat als Best-Case-Werte. Mehr Nachfragebedarf erwartet.
- D7 (Feste Abschlusssequenz) reduziert Flexibilität bei atypischen Gesprächsverläufen.

**Offene Fragen:**
- Model-Upgrade: Ein Upgrade auf Gemini Flash (nicht Lite) ist sinnvoll als Qualitätsgewinn, aber kein Ersatz für diesen Prompt-Fix. Reihenfolge: erst D1–D8 implementieren und mit Flash Lite verifizieren, dann optional auf Flash upgraden.

**Folgeentscheidungen:**
- Neuer Eval-Lauf (gleiche Buchhalter-Persona) nach Implementierung — direkte Regression-Prüfung gegen ADR-005, ADR-006 und ADR-007.
- D6 (Span-Confirmation als Pflichtschritt) erfordert Anpassung in der `record_slot`-Tool-Instruktion, nicht nur in den Gesprächsregeln.

---

## Umsetzung

| # | Entscheidung | Datei(en) | Aufwand |
|---|-------------|-----------|---------|
| D1 | Strukturvorschrift + Positiv-Formulierung | System-Prompt (buildSystemPrompt — Gesprächsführungssektion) | M |
| D2 | Silence-Constraint | System-Prompt (Gesprächsführungssektion) | S |
| D3 | Duration-Frage Umformulierung | System-Prompt (quantify_step-Sektion) | S |
| D4 | Opener-Positivregel statt Verbotsliste | System-Prompt (Gesprächsführungssektion) | S |
| D5 | Wrap-up Trigger ausweiten | System-Prompt (wrap_up + coverage_check-Sektion) | S |
| D6 | Span-Confirmation in record_slot-Instruktion | System-Prompt (Tool-Instruktion record_slot) | S |
| D8 | Few-Shot-Positivbeispiele (5 Turns) | System-Prompt (`<examples>`-Block) | M |
| D7 | Abschluss-Sequenz strukturiert | System-Prompt (wrap_up-Sektion) | S |

D1 und D8 sind die aufwändigsten Schritte: D1 erfordert einen inhaltlichen Umbau der Gesprächsführungssektion, D8 das Schreiben von fünf konkreten, repräsentativen Beispiel-Turns. D2–D7 sind additive Anpassungen.

Empfohlene Reihenfolge: D1 + D4 zuerst (strukturelle Basis), dann D8 (Beispiele), dann D2, D3, D5, D6, D7 (additive Ergänzungen).
