---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-25
persona: buchhalter
persona_name_override: "Andy Meyer" (original: "Andreas Meier")
interview_id: 564c5943-b337-4d30-9a74-299d801560d8
turns_total: 14
---

[Turn 1] Agent: "Hallo Andy! Schön, dass du dir die Zeit nimmst. Mein Ziel ist es, deine tägliche Arbeit in der Finanzbuchhaltung besser zu verstehen, um mögliche Optimierungspotenziale zu identifizieren – dabei geht es rein um die Abläufe, nicht um eine Bewertung deiner Leistung. Erzähl mir doch mal: Wie sieht ein typischer Arbeitstag bei dir aus und was sind dabei deine zentralen Aufgaben?"

[Turn 1] Persona (Andy Meyer): "Mein Arbeitstag dreht sich hauptsächlich um zwei Dinge: zum einen die laufende Rechnungsprüfung und -buchung, die täglich anfällt, und zum anderen die vorbereitenden Arbeiten für den Monatsabschluss, die gegen Ende des Monats intensiver werden. Morgens schaue ich zuerst, welche neuen Rechnungen per E-Mail eingegangen sind, prüfe diese und buche sie in SAP FI. Parallel dazu kommt immer wieder etwas rein – Rückfragen, Ausnahmen, Beträge die eine Zweit-Freigabe brauchen. Den Rest des Tages fülle ich mit Abstimmungsarbeiten und dem Nachpflegen von Ausnahmen, die sich nicht sauber automatisch verarbeiten lassen."

[Turn 2] Agent: "Hallo Andy. Schön, dass du dir die Zeit nimmst. Das klingt nach einem abwechslungsreichen Arbeitsalltag. Um hier ein besseres Bild zu bekommen, lass uns direkt mit der Rechnungsprüfung starten: Erzähl mir doch bitte von einem typischen Ablauf, wie du eine solche neue Rechnung, die per E-Mail reinkommt, von Anfang bis Ende bearbeitest."

[Turn 2] Persona (Andy Meyer): "Ich fange damit an, die eingegangene Rechnung im E-Mail-Postfach zu öffnen und die Basisdaten zu prüfen: stimmt der Lieferant, ist der Betrag plausibel, passt der Leistungszeitraum zu dem, was wir bestellt haben. Wenn alles passt, buche ich die Rechnung in SAP FI und lege das Dokument anschließend in DocuWare ab. Wenn der Betrag über 5.000 Euro liegt, kann ich nicht selbst freigeben – da brauche ich eine Zweit-Freigabe von meinem Vorgesetzten, bevor die Buchung erfolgt. In solchen Fällen bleibt die Rechnung erst mal in einem Wartestatus, bis die Freigabe eingeht."

[Turn 3] Agent: "Das ist ein klarer Ablauf. Wenn du sagst, die Rechnungen kommen täglich rein: Wie viele Rechnungen bearbeitest du denn im Schnitt in einem Monat?"

[Turn 3] Persona (Andy Meyer): "Das schwankt ein bisschen, aber im Schnitt sind es so 80 bis 100 Rechnungen pro Monat."

[Turn 4] Agent: "Verstanden, 90 Rechnungen sind ein guter Anhaltspunkt. Wenn alles glatt läuft, wie lange sitzt du ungefähr an einer Rechnung, bis sie komplett in SAP FI gebucht und in DocuWare archiviert ist?"

[Turn 4] Persona (Andy Meyer): "Das habe ich so nie gezielt gestoppt. Eine unkomplizierte Rechnung, bei der alle Angaben stimmen, ist schnell durch – ein paar Minuten. Schwierig wird es, wenn die Bestellreferenz fehlt oder Unstimmigkeiten auftauchen, dann muss ich in mehreren Systemen nachsuchen, und das frisst deutlich mehr Zeit."

[Turn 5] Agent: "Wenn du schätzt, wie viel Zeit eine unkomplizierte Buchung in Anspruch nimmt – würdest du sagen, etwa 10 Minuten sind ein realistischer Wert für einen Durchlauf?"

[Turn 5] Persona (Andy Meyer): "Ja, 10 Minuten klingt realistisch für einen normalen Fall. Vielleicht eher etwas weniger, wenn ich gut im Flow bin, aber das ist ein guter Richtwert."

[Turn 6] Agent: "Alles klar, dann haben wir für den Standardfall 10 Minuten als Basiswert. Wenn du diesen Prozess der Rechnungsprüfung betrachtest: Gibt es dafür eine feste Checkliste oder einen definierten Ablauf, an den du dich hältst, oder entscheidest du von Fall zu Fall unterschiedlich?"

[Turn 6] Persona (Andy Meyer): "Es gibt keinen offiziellen Leitfaden, den jemand aufgeschrieben hat, aber ich gehe immer gleich vor: Lieferant prüfen, Betrag und Leistungszeitraum kontrollieren, dann SAP FI, dann DocuWare. Das ist so verinnerlicht, dass ich keine Liste brauche. Die einzige harte Regel, die ich nicht vergessen darf, ist die Zweit-Freigabe-Schwelle ab 5.000 Euro – das ist prozessual vorgegeben und ich halte das konsequent ein."

[Turn 7] Agent: "Das ist nachvollziehbar – ein fester Ablauf trotz fehlender schriftlicher Anweisung. Wenn du von den Fällen sprichst, bei denen Bestellreferenzen fehlen oder Unstimmigkeiten auftreten: Wie gehst du in so einer Situation konkret vor, welche Systeme ziehst du zur Recherche heran?"

[Turn 7] Persona (Andy Meyer): "Wenn die Bestellreferenz fehlt, muss ich manuell suchen, wer intern der Auftraggeber für diese Lieferung war. Dafür schaue ich zuerst in SAP FI, ob es eine passende Bestellung gibt, dann in DocuWare, ob dort ein älteres Dokument hinterlegt ist, und zuletzt in meinem E-Mail-Client, ob es eine Korrespondenz mit dem Lieferanten gibt. Meistens findet sich dann irgendwo etwas. Das klingt nach wenig, aber es summiert sich – so eine Suche durch drei Systeme dauert leicht 20 bis 30 Minuten pro Rechnung. Bei den Diskrepanzen – falscher Mehrwertsteuersatz, Betragsdifferenz oder fehlende Kostenstelle – muss ich dann noch den Lieferanten oder die Fachabteilung kontaktieren, bevor ich buchen kann."

[Turn 8] Agent: "Das klingt in der Tat sehr zeitintensiv, wenn man bedenkt, dass dies zusätzlich zum Tagesgeschäft anfällt. Wenn du diese Recherchen und die damit verbundenen Abstimmungen mit Fachabteilungen oder Lieferanten betrachtest, wie oft musst du diese manuellen Suchen im Monat in etwa durchführen?"

[Turn 8] Persona (Andy Meyer): "Bei den Rechnungen ohne Bestellreferenz kommen mir die häufiger vor als ich das gerne hätte – das ist sicher ein paar Mal pro Woche. Ich schätze, insgesamt kostet mich das pro Woche etwa eine Stunde, hochgerechnet im Monat also vier Stunden nur für diese Suchen. Dazu kommen dann noch die Rechnungen mit konkreten Fehlern – falsche Kostenstelle, falscher Steuersatz, Betragsdifferenz – das trifft ungefähr bei 5 von 100 Rechnungen zu. Die brauchen noch mehr Aufwand, weil da eine externe Klärung notwendig ist."

[Turn 9] Agent: "Das klingt so, als würdest du einen erheblichen Teil deiner Zeit mit der manuellen Klärung dieser 5 % Fehlerquote verbringen. Lass uns den Fokus kurz auf den zweiten Bereich verschieben, den du anfangs nanntest: die vorbereitenden Arbeiten für den Monatsabschluss. Was genau verstehst du unter diesen vorbereitenden Arbeiten und welcher Schritt nimmt dort die meiste Zeit in Anspruch?"

[Turn 9] Persona (Andy Meyer): "Beim Monatsabschluss geht es zunächst darum, alle offenen Posten abzustimmen – also zu prüfen, ob alle eingegangenen Rechnungen korrekt gebucht sind und keine Differenzen mehr offen sind. Dann buche ich die Rückstellungen, das heißt ich berücksichtige Aufwände, die im Monat angefallen sind, aber noch keine Rechnung haben. Zum Schluss übergebe ich die aufbereiteten Zahlen an das Controlling. Was am meisten Zeit frisst, ist ehrlich gesagt die Ausnahmenbehandlung: Buchungen, die sich nicht sauber über SAP abbilden lassen, pflege ich manuell in Excel nach. Das ist fehleranfällig und kostet am Monatsende besonders viel Zeit."

[Turn 10] Agent: "Das ist verständlich, manuelle Excel-Tabellen sind oft eine Fehlerquelle. Lass uns für die 'Vorbereitenden Arbeiten für den Monatsabschluss' noch kurz den zeitlichen Rahmen abstecken: Wie oft im Monat führst du diese Arbeiten durch und wie viele Stunden investierst du schätzungsweise insgesamt in diesen Prozessbereich?"

[Turn 10] Persona (Andy Meyer): "Der Monatsabschluss ist einmal pro Monat, das ist klar. Aber die vorbereitenden Arbeiten ziehen sich nicht auf einen Tag zusammen – die letzten 2 bis 3 Arbeitstage im Monat sind wirklich intensiv. In dieser Zeit bin ich fast ausschließlich damit beschäftigt. Das sind also pro Monat etwa 2 bis 3 Tage, an denen das mein Hauptthema ist."

[Turn 11] Agent: "Das sind also etwa 16 bis 24 Stunden, die da jeden Monat für die Vorbereitungen zusammenkommen. Ich glaube, wir haben die wichtigsten Abläufe – von der täglichen Rechnungsprüfung bis hin zum Monatsabschluss – in ihren Grundzügen gut erfasst. Lass mich kurz prüfen, ob wir damit alles Wichtige abgedeckt haben."

[Turn 11] Persona (Andy Meyer): "Ja, das klingt gut."

[Turn 12] Agent: "Andy, lass uns noch kurz die letzten Details komplettieren, damit wir ein vollständiges Bild haben. Bei der Recherche bei Unstimmigkeiten: Läuft das für dich immer nach einem festen Muster ab, also würdest du den Prozess als regelbasiert bezeichnen? Und wie viele solcher Recherche-Fälle würdest du schätzungsweise pro Monat als Summe angeben?"

[Turn 12] Persona (Andy Meyer): "Das Grundprinzip ist immer dasselbe: erst SAP FI, dann DocuWare, dann E-Mail. In dem Sinne ja, es ist regelbasiert – ich habe eine feste Reihenfolge. Ob ich dann wirklich fündig werde, hängt vom Einzelfall ab, aber das Vorgehen selbst ist strukturiert. Zur Zahl: ich schätze, insgesamt habe ich pro Monat so 10 bis 15 Fälle, die mehr Aufwand machen als eine normale Rechnung."

[Turn 13] Agent: "Danke für die Details. Eine letzte Frage noch: Bei den vorbereitenden Arbeiten für den Monatsabschluss, wie viele Stunden investierst du dort insgesamt pro Monat genau, wenn du die 2 bis 3 Tage zusammenrechnest, und folgst du dabei auch einem festen Ablauf oder einem Regelwerk?"

[Turn 13] Persona (Andy Meyer): "Wenn ich 2 bis 3 Tage rechne, dann sind das ungefähr 16 bis 24 Stunden im Monat – an intensiven Tagen eher am oberen Ende. Und ja, der Ablauf ist klar strukturiert: offene Posten abstimmen, Rückstellungen buchen, dann Übergabe an das Controlling. Die Reihenfolge ist immer dieselbe, das ist definitiv regelbasiert. Nur die Ausnahmen, die ich in Excel nachpflegen muss, sprengen dieses Schema ein bisschen – da gibt es kein festes Regelwerk mehr, da ist Urteilsvermögen gefragt."

[Turn 14] Agent: Gibt strukturierte Zusammenfassung beider Prozesse (Rechnungsprüfung + Monatsabschluss) und fragt nach weiteren Prozessen. Interview wird intern als completed markiert.

[Turn 14] Persona (Andy Meyer): "Die Zusammenfassung trifft es gut. Was ich noch kurz erwähnen wollte: Es gibt auch noch den monatlichen Mahnprozess. Der fällt ebenfalls regelmäßig an und ist nicht unerheblich im Aufwand – aber wenn das für Sie nicht mehr im Scope des heutigen Gesprächs ist, können wir das auch weglassen." *(API bereits geschlossen, Antwort nicht mehr empfangen — status bereits 'completed')*

[PASS] Interview abgeschlossen in Turn 14 — status='completed', complete_interview aufgerufen.

---

## Slot-Filling-Stand (aus interview_state.step_tracker)

| Prozessschritt | frequency_per_month | duration_minutes | rule_based | data_sources | error_rate_percent | status |
|---------------|---------------------|-----------------|------------|--------------|-------------------|--------|
| Rechnungsprüfung und -buchung | 90 | 10 | true | — | — | done |
| Recherche bei Unstimmigkeiten | 15 | 25 | true | SAP FI, DocuWare, E-Mail-Client | 5 % | done |
| Vorbereitende Arbeiten für den Monatsabschluss | 1 | 1440 | true | SAP, Excel | — | done |

Alle 3 Pflicht-Slots (`frequency_per_month`, `duration_minutes`, `rule_based`) für alle Schritte gefüllt.

Auffälligkeit: `duration_minutes = 1440` für Monatsabschluss entspricht 24 Stunden — das obere Ende der genannten Spanne 16–24 h. Korrekt, aber Mittelwert (1200 min) wäre repräsentativer.

---

## Befunde

### FINDING-1 — Greeting korrekt personalisiert (Positiv)
Der Agent begrüßte Andy Meyer mit "Hallo Andy!" — Name aus dem Interview-Record wurde korrekt geladen. Du-Form durchgehend konsistent.

### FINDING-2 — duration_minutes Monatsabschluss: oberes Ende der Spanne gewählt (Severity: Low)
- **Was:** Agent extrahierte 1440 Minuten (= 24 h) statt z.B. 1200 min (= 20 h Mittelwert) aus "16 bis 24 Stunden".
- **Auswirkung:** ROI-Berechnung tendiert leicht zu hoch; kein Fehler, aber kein Mittelwert.

### FINDING-3 — role-Feld in step 3 null (Severity: Low)
- **Was:** `step_tracker[2].role = null` für "Vorbereitende Arbeiten für den Monatsabschluss". Steps 1 und 2 haben `role = "Buchhalter"`.
- **Ursache:** Unklar — möglicherweise fehlte der Bezug zur Rolle im Slot-Filling-Call für Schritt 3.
- **Auswirkung:** Gering, da die Rolle aus dem Interview-Record ableitbar ist.

### FINDING-4 — Mahnprozess nicht im scope (AdditionalContext)
- **Was:** Der Mahnprozess wurde vom Agenten nicht proaktiv angesprochen (erwartet, da er nicht in focus_topics ist). Die Persona erwähnte ihn am Ende selbst — der Agent hatte das Interview aber bereits intern abgeschlossen, die letzte Persona-Antwort wurde nicht mehr empfangen.
- **Auswirkung:** Mahnprozess nicht in step_tracker. Entspricht dem erwarteten Verhalten laut additionalContext.

### FINDING-5 — Gesprächsfluss kürzer als vorheriger Lauf (Beobachtung)
- Dieser Lauf: 14 Turns, 3 Steps, du-Form (informell), kein Mahnprozess.
- Vorheriger Lauf (Andreas Meier): 14 Turns, 3 Steps (inkl. Mahnprozess), Sie-Form (formell).
- Hypothese: Du-Form (Vorname) erzeugt kürzere, direktere Antworten des Agenten.

---

## Pass-Kriterien-Check

| Kriterium | Ergebnis |
|-----------|----------|
| Erster Turn ist Agent (nicht Persona) | PASS |
| Kein identisch wiederholter Persona-Text in aufeinanderfolgenden Turns | PASS |
| Persona-Antworten kontextuell passend | PASS |
| Agent registriert >= 2 Prozessschritte via register_step | PASS (3 Schritte) |
| >= 1 Schritt mit allen 3 Pflicht-Slots gefüllt | PASS (alle 3 Schritte vollständig) |
| Interview erreicht status='completed' | PASS |

**Gesamtergebnis: PASS**
