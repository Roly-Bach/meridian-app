---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-18
persona: buchhalter
interview_id: 4aad403c-999d-42cd-a141-8f093010a6a3
eval_run_id: 9a4c062f-d628-4a36-b71f-7c302b3c72ad
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/4aad403c-999d-42cd-a141-8f093010a6a3
turns_total: 19
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.89
  dedup_slot_coverage: 0.89
  slot_coverage_pre_clarification: 0.89
  dedup_slot_coverage_pre_clarification: 0.89
  clarification_coverage_delta: 0
  phase_progression: 0.6
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.63
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: 1
  depth_score: 2
  depth_p1: 0.15
  depth_p2: 0.7
  depth_p3: 0.15
trail:
  total_writes: 25
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.89 | maximize |
| dedup_slot_coverage | 0.89 | maximize |
| slot_coverage_pre_clarification | 0.89 | maximize |
| dedup_slot_coverage_pre_clarification | 0.89 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 0.6 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.63 | ≥ 0.80 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | 1 | > 0.80 |
| depth_score | 2 | maximize |
| depth_p1 | 0.15 | — |
| depth_p2 | 0.7 | — |
| depth_p3 | 0.15 | — |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0 | < 0.20 |


## Judge-Begründung

Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-Form. Die Fragen sind gut strukturiert und kontextbezogen (Bezug zu vorherigen Aussagen in [3], [4]). Kleine Schwächen: [2] enthält die leicht generische Phrase 'Das ist ein guter Überblick', und einige Fragen sind sehr formal-strukturiert, was dem Gesprächsfluss minimal schadet. Insgesamt aber angemessen für ein professionelles Interview ohne störende Floskeln oder Stilbrüche.

## Gesprächsverlauf

[Turn 1] Persona: Ich fange damit an, die eingehenden Rechnungen zu prüfen, bei denen ich Lieferantendaten, Beträge und Leistungszeiträume verifiziere, bevor die Verbuchung und Archivierung erfolgt. Bei größeren Beträgen achte ich zusätzlich auf die notwendige Freigabe, während ich mich bei fehlendem Bestellbezug manuell durch unsere Systeme arbeite. Im weiteren Verlauf widme ich mich regelmäßig dem Monatsabschluss, bei dem ich Unstimmigkeiten in den Abrechnungen bereinige und die entsprechenden Daten für das Controlling aufbereite.
[Turn 1] Agent: "Verstanden. Wie viele Rechnungen kommen im Durchschnitt pro Woche bei dir an?"

[Turn 2] Persona: Auf Basis meiner monatlichen Auswertungen gehen in der Abteilung üblicherweise zwischen achtzig und einhundert Rechnungen ein, was einer wöchentlichen Bearbeitung von etwa zwanzig bis fünfundzwanzig Belegen entspricht. Diese Menge variiert zwar leicht je nach Auftragslage, lässt sich jedoch durch die Standardisierung in unserem E-Mail-Client und SAP FI sowie DocuWare recht stabil bewältigen. Die manuelle Nachforschung bei fehlenden Bestellbezügen nimmt dabei pro Woche etwa eine Stunde meiner Arbeitszeit in Anspruch.
[Turn 2] Agent: "Das ist ein guter Überblick über das Volumen. Wie viel Zeit nimmst du dir im Durchschnitt für die Prüfung einer einzelnen, standardmäßigen Rechnung?"

[Turn 3] Persona: Beim Prozess der Rechnungsprüfung lege ich großen Wert auf eine präzise Kontrolle der Lieferantendaten, Beträge und Leistungszeiträume, wobei die Dauer stark von der Vollständigkeit der beigefügten Informationen abhängt. Da ich hierbei auf die Unterstützung durch unser E-Mail-System sowie die Buchungsmasken in SAP FI angewiesen bin, variiert der individuelle Zeitaufwand je nach Komplexität der vorliegenden Rechnung. Eine konkrete Zeitvorgabe pro Beleg existiert in unserer Abteilung nicht, da die gründliche Verbuchung und die anschließende Archivierung in DocuWare Vorrang vor einer rein zeitbasierten Taktung haben.
[Turn 3] Agent: "Lassen wir das so stehen. Wie viel Zeit planst du insgesamt pro Woche für die gesamte Rechnungsprüfung ein?"

[Turn 4] Persona: Für die gesamte Rechnungsprüfung inklusive der Dokumentation in DocuWare und der Verbuchung in SAP FI lässt sich kein starrer Zeitwert definieren, da die manuelle Nachforschung bei unklaren Bestellbezügen den Aufwand beeinflusst. Während der Großteil der wöchentlich eingehenden Belege standardisiert durchläuft, erfordern Abweichungen, die eine zusätzliche Freigabe bedürfen, sowie die Klärung von Rückstellungen stets eine flexible Anpassung meiner Kapazitäten. Die Summe aus der regulären Bearbeitung der genannten Menge und der wöchentlich investierten Stunde für Recherchearbeiten bildet den Kern meiner zeitlichen Planung in diesem Bereich.
[Turn 4] Agent: "Verstanden. Wer ist an der Freigabe von Rechnungen mit größeren Beträgen beteiligt?"

[Turn 5] Persona: Im Rahmen des internen Kontrollsystems ist ab einer festgelegten Summe eine zusätzliche Freigabe für Rechnungen erforderlich, um die sachliche und rechnerische Richtigkeit sicherzustellen. Hierbei fließen insbesondere die Rückmeldungen aus den Fachabteilungen ein, bevor die endgültige Verbuchung in unserem Buchhaltungssystem erfolgen kann. Die Koordination dieser Freigabeschritte ist ein essenzieller Bestandteil, um die finanzielle Integrität bei größeren Volumina zu gewährleisten.
[Turn 5] Agent: "Ab welchem Betrag ist diese zusätzliche Freigabe der Fachabteilungen erforderlich?"

[Turn 6] Persona: Für die zusätzliche Freigabe, die wir in unsere internen Abläufe integriert haben, gilt eine starre Grenze von 5.000 EUR. Sobald eine Rechnung diesen Betrag erreicht oder überschreitet, ist eine weitere Prüfung durch die zuständigen Stellen zwingend erforderlich. Dieser Prozessschritt stellt sicher, dass alle finanziellen Verpflichtungen vor der finalen Verbuchung nochmals explizit autorisiert werden.
[Turn 6] Agent: "Wie genau startet dieser Prozess bei dir – wie kommen die Rechnungen an und was ist dein allererster Schritt?"

[Turn 7] Persona: Wenn mich eine neue Rechnung per E-Mail erreicht, öffne ich zunächst den entsprechenden Client, um den Eingang zu erfassen. Mein erster fachlicher Schritt besteht darin, die grundlegenden Stammdaten des Lieferanten sowie den ausgewiesenen Betrag und den Leistungszeitraum gegen unsere internen Vorgaben abzugleichen. Erst nach dieser qualitativen Vorprüfung entscheide ich über die weitere Bearbeitung in unseren Systemen.
[Turn 7] Agent: "Ich erfasse diesen ersten Schritt als "Eingangsprüfung und Stammdatenabgleich". Wie dokumentierst du das Ergebnis dieser ersten Prüfung, bevor es zur Verbuchung in SAP FI geht?"

[Turn 8] Persona: Für den Prozess der Dokumentation nutze ich unser System für das Dokumentenmanagement, in dem die Rechnung nach der erfolgreichen Prüfung archiviert wird. Parallel dazu erfasse ich alle notwendigen Daten direkt in den Eingabemasken der Buchhaltung, wodurch der Status des Belegs im System entsprechend hinterlegt ist. Erst nach diesem digitalen Ablage- und Erfassungsvorgang ist die Prüfung abgeschlossen und der Beleg für die weiteren Buchungsschritte final freigegeben.
[Turn 8] Agent: "Ich nehme das als Abschluss des ersten Schritts auf. Was genau passiert als Nächstes, sobald die Rechnung für die Verbuchung freigegeben ist?"

[Turn 9] Persona: Nach der erfolgreichen Prüfung erfolgt die unmittelbare Erfassung des Belegs in unserem Buchhaltungssystem, wo ich alle buchungsrelevanten Informationen hinterlege. Falls die Rechnung unsere definierte Wertgrenze erreicht, leite ich den Prozess zur zusätzlichen Freigabe ein, bevor die Daten abschließend an das Controlling weitergeleitet werden. Erst mit dieser vollständigen Verbuchung und der parallelen Archivierung ist die Bearbeitung des jeweiligen Vorgangs in der Finanzbuchhaltung abgeschlossen.
[Turn 9] Agent: "Du hast eingangs erwähnt, dass du dich regelmäßig dem Monatsabschluss widmest – wie läuft dieser Prozess genau ab, sobald du mit der Bereinigung der Unstimmigkeiten in den Abrechnungen beginnst?"

[Turn 10] Persona: Für den Abschluss identifiziere ich zunächst alle Unstimmigkeiten, wie etwa falsch ausgewiesene Mehrwertsteuersätze oder fehlende Angaben zur Kostenstelle, und dokumentiere diese Sonderfälle eigenhändig in Excel-Tabellen. Da etwa 5 % der Rechnungen solche Abweichungen aufweisen, bereinige ich diese gezielt in SAP FI, um eine korrekte Datenbasis für den Monatsabschluss zu gewährleisten. Erst nach dieser intensiven Klärungsphase schließe ich die entsprechenden Buchungen ab, was eine konzentrierte Arbeitsleistung von zwei bis drei Tagen erfordert.
[Turn 10] Agent: "Du hast vorhin eine Bearbeitungszeit von 1200 Minuten erwähnt — jetzt sprichst du von 5. Was ist hier der Unterschied?"

[Turn 11] Persona: Wenn ich die Zahlen in diesem Kontext erläutere, beziehen sich die fünf Prozent lediglich auf den Anteil der Rechnungen, die Unstimmigkeiten wie falsche Mehrwertsteuersätze oder fehlende Kostenstellen aufweisen. Die zuvor erwähnte Zeitspanne beschreibt hingegen den intensiven Arbeitsaufwand, den ich über mehrere Tage hinweg für den gesamten Prozess des Monatsabschlusses in SAP FI und Excel aufbringe. Diese beiden Werte beschreiben also völlig unterschiedliche Dimensionen meiner Tätigkeit, nämlich die Fehlerquote einerseits und den zeitlichen Gesamtumfang der Abschlussarbeiten andererseits.
[Turn 11] Agent: "Verstanden, das klärt den Unterschied auf. 

Wenn du die Rechnungen prüfst und verbuchst: Musst du dabei Daten manuell von einem System in ein anderes übertragen, beispielsweise von der E-Mail in SAP, oder läuft das komplett medienbruchfrei? Und entscheidest du bei der Prüfung rein nach festen Regeln oder gibt es Fälle, in denen du nach eigenem Ermessen entscheiden musst?"

[Turn 12] Persona: Da wir in der Finanzbuchhaltung mit verschiedenen Systemen arbeiten, findet bei der Rechnungsprüfung eine manuelle Übertragung der Daten aus dem E-Mail-Client in die Buchungsmasken von SAP FI statt, da dieser Prozess noch nicht vollständig automatisiert ist. Grundsätzlich folge ich bei der Prüfung festen Vorgaben bezüglich Lieferant, Betrag und Leistungszeitraum, wobei die manuelle Suche bei Rechnungen ohne Bestellbezug einen signifikanten Teil meiner Tätigkeit einnimmt. In solchen Fällen ist mein Ermessensspielraum begrenzt, da ich mich auf die Konsolidierung der Daten aus den verschiedenen Systemen konzentrieren muss, um die fachliche Richtigkeit für die spätere Archivierung in DocuWare sicherzustellen.
[Turn 12] Agent: "Damit haben wir die Rechnungsprüfung sehr detailliert erfasst. 

Lass uns nun zum Monatsabschluss übergehen. Du hast erwähnt, dass dieser Prozess zwei bis drei Tage dauert. Wie oft im Jahr führst du diesen Abschluss durch — machst du das jeden Monat oder gibt es Abweichungen?"

[Turn 13] Persona: Für den Abschluss gilt grundsätzlich, dass ich diesen Prozess einmal monatlich durchführe, um unsere buchhalterischen Ergebnisse zeitnah zu konsolidieren. Dabei gibt es keine saisonalen Abweichungen, sodass dieser Arbeitszyklus über das gesamte Jahr hinweg regelmäßig erfolgt. Diese Routine ist für mich essenziell, um die hohen Qualitätsstandards unserer Finanzbuchhaltung einzuhalten.
[Turn 13] Agent: "Welche konkreten Daten oder Berichte benötigst du als Grundlage, um mit dem Monatsabschluss zu starten, und welche Ausgaben oder Reports erstellst du am Ende für das Controlling?"

[Turn 14] Persona: Grundlage für meine Arbeit zum Monatsabschluss sind sämtliche offenen Posten, die ich zunächst im System abgleiche, um eine bereinigte Basis für die weiteren Buchungen zu erhalten. Parallel dazu erfasse ich alle notwendigen Rückstellungen, um die finanzielle Situation periodengerecht abzubilden. Am Ende dieses Prozesses bereite ich die konsolidierten Daten auf und leite diese gezielt an das Controlling weiter, damit dort die finalen Berichte erstellt werden können.
[Turn 14] Agent: "Verstanden. Welche Hilfsmittel – wie Excel-Listen oder SAP-Transaktionen – nutzt du konkret für diesen Abgleich der offenen Posten und die Erfassung der Rückstellungen?"

[Turn 15] Persona: Beim Monatsabschluss stütze ich mich primär auf die Funktionen innerhalb von SAP FI, um sämtliche offenen Posten systematisch abzugleichen. Zur Erfassung der Rückstellungen sowie zur Dokumentation der Sonderfälle und Ausnahmen, die nicht direkt im Buchhaltungssystem abgebildet werden können, nutze ich zusätzlich Excel-Tabellen. Diese Kombination aus dem zentralen Buchungssystem und der manuellen Aufbereitung in Excel ermöglicht es mir, die erforderliche Datenbasis für die Übergabe an das Controlling sicherzustellen.
[Turn 15] Agent: "Für den Monatsabschluss nutzt du also SAP FI und Excel-Tabellen. Musst du dabei Daten manuell von SAP in deine Excel-Tabellen übertragen, oder gibt es dafür einen automatischen Export?"

[Turn 16] Persona: In der Praxis führe ich für den Monatsabschluss eine manuelle Datenübertragung aus unserem Buchhaltungssystem in die Excel-Tabellen durch, da die Dokumentation der Ausnahmen einen hohen Grad an individueller Aufbereitung erfordert. Dieser manuelle Zwischenschritt ist notwendig, um die Sonderfälle, die nicht direkt in SAP FI abgebildet werden können, sauber zu erfassen und nachzuverfolgen. Die systemübergreifende Konsistenz stelle ich dabei durch einen disziplinierten Abgleich zwischen beiden Anwendungen sicher, bevor die finalen Daten an das Controlling fließen.
[Turn 16] Agent: "Folgt der Monatsabschluss bei dir immer einem festen Schema oder entscheidest du bei der Bereinigung der Unstimmigkeiten von Fall zu Fall nach eigenem Ermessen?"

[Turn 17] Persona: Während des gesamten Monatsabschlusses befolge ich zunächst ein strukturiertes Schema, bei dem ich die offenen Posten und Rückstellungen systematisch bearbeite. Bei den Unstimmigkeiten, etwa bei fehlenden Angaben zur Kostenstelle, bewerte ich jedoch jeden Einzelfall individuell, um die buchhalterische Korrektheit sicherzustellen. Meine Erfahrung aus zwölf Jahren hilft mir dabei, die Fälle zu identifizieren, die über den Standard hinausgehen und eine manuelle Dokumentation in meinen Excel-Listen erfordern.
[Turn 17] Agent: "Gibt es beim Monatsabschluss Abhängigkeiten von anderen Abteilungen – musst du beispielsweise darauf warten, dass bestimmte Daten oder Freigaben vorliegen, bevor du mit deiner Arbeit beginnen kannst?"

[Turn 18] Persona: Im Rahmen des Monatsabschlusses bin ich auf die Zuarbeit und die korrekte Datenbasis aus den Fachabteilungen angewiesen, da unvollständige Angaben zur Kostenstelle oder fehlerhafte Rechnungsbeträge den Prozess verzögern können. Wenn diese Informationen nicht fristgerecht vorliegen, ist ein abschließender Abgleich nicht möglich, was meinen Zeitplan erheblich unter Druck setzt. Ich stehe daher in einem kontinuierlichen Austausch, um die notwendigen Daten zeitnah zu erhalten und so die termingerechte Weiterleitung an das Controlling sicherzustellen.
[Turn 18] Agent: "Gibt es für den Monatsabschluss bestimmte gesetzliche oder interne Fristen, die du zwingend einhalten musst?"

[Turn 19] Persona: Hinsichtlich der zeitlichen Planung unterliege ich internen Vorgaben, die einen rechtzeitigen Abschluss erfordern, um die Datenbasis für die Berichterstattung an das Controlling zu gewährleisten. Da der gesamte Prozess konzentrierte Arbeitsleistung über mehrere Tage hinweg beansprucht, ist die strikte Einhaltung des Zeitrahmens zum Monatsende für mich von zentraler Bedeutung. Diese internen Fristen stellen sicher, dass alle Buchungen vollständig erfasst und die Rückstellungen korrekt abgebildet sind, bevor der Berichtszeitraum final geschlossen wird.
[Turn 19] Agent: "Welche gesetzlichen oder internen Richtlinien – wie beispielsweise die GoBD oder steuerliche Aufbewahrungsfristen – musst du bei der Rechnungsbearbeitung und Archivierung in DocuWare zwingend beachten?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Rechnungsbearbeitung | done | 90 ✓ | 1200 ✓ | Regelbasierte Prüfun ✓ | E-Mail-Client,SAP FI ✓ | 5 ✓ | 1 ✓ |
| Monatsabschluss | done | 1 ✓ | 1200 ✓ | Strukturiertes Vorge ✓ | SAP FI,Excel-Tabelle ✓ | 5 ✓ | 1 ✓ |

## Extrahierte Wissensobjekte

| Typ | Content | Source Quote |
|-----|---------|--------------|
| pain_point | Manueller Aufwand bei Suche wenn Bestellbezug fehlt (severity: medium) | "während ich mich bei fehlendem Bestellbezug manuell durch unsere Systeme arbeite" |
| tool | E-Mail-Client — Standardisierung/Bearbeitung eingehender Rechnungen | "Standardisierung in unserem E-Mail-Client" |
| tool | SAP FI — Standardisierte Bearbeitung von Belegen | "SAP FI" |
| tool | DocuWare — Standardisierte Bearbeitung und Archivierung | "DocuWare" |
| pain_point | Manuelle Nachforschung bei fehlendem Bestellbezug ~1h/Woche (severity: low) | "Die manuelle Nachforschung bei fehlenden Bestellbezügen nimmt dabei pro Woche etwa eine Stunde meiner Arbeitszeit in Anspruch." |
| pain_point | Zeitaufwendige manuelle Klärungsphase 2-3 Tage vor Monatsabschluss (severity: high) | "Erst nach dieser intensiven Klärungsphase schließe ich die entsprechenden Buchungen ab, was eine konzentrierte Arbeitsleistung von zwei bis drei Tagen erfordert." |
| pain_point | ~5% Rechnungen mit Unstimmigkeiten (falsche MwSt, fehlende Kostenstelle) (severity: medium) | "fünf Prozent lediglich auf den Anteil der Rechnungen, die Unstimmigkeiten wie falsche Mehrwertsteuersätze oder fehlende Kostenstellen aufweisen" |
| pain_point | Manuelle Datenübertragung E-Mail → SAP FI nicht automatisiert (severity: medium) | "findet bei der Rechnungsprüfung eine manuelle Übertragung der Daten aus dem E-Mail-Client in die Buchungsmasken von SAP FI statt" |
| pain_point | Manuelle SAP→Excel Übertragung im Monatsabschluss nötig (severity: high) | "Dieser manuelle Zwischenschritt ist notwendig, um die Sonderfälle, die nicht direkt in SAP FI abgebildet werden können, sauber zu erfassen" |
| pain_point | Verzögerte Fachabteilungs-Zuarbeit blockiert Abschluss (severity: high) | "Wenn diese Informationen nicht fristgerecht vorliegen, ist ein abschließender Abgleich nicht möglich" |

## Befunde

### FAIL-Ursachen

**F1 — Tool call plausibility 0.63 (Ziel ≥ 0.80)**
Analyst rief `register_step` mehrfach in derselben Batch auf (sichtbar in stdout: `register_step, register_step, ...`). Re-Registrierung existierender Schritte suggeriert unklare Analyst-Logik wann ein Schritt als bereits bekannt gilt.

**F2 — Halluziniertes Zitat in Turn 10 (Anchoring-Verdacht)**
Talker sagte: *"Du hast vorhin eine Bearbeitungszeit von 1200 Minuten erwähnt"* — Andreas Meier hat die Zahl 1200 nie ausgesprochen. Der Analyst hatte diesen Wert intern berechnet (2-3 Tage × 480 min). Wert ist durch die Analyst→Talker-Grenze geflossen. Der Scorer hat `anchoring_violations: 0` und `hallucination_rate: 0` gemessen — das deutet auf eine Lücke im Judge-Prompt hin (intern berechnete Zahlen werden nicht als Halluzination gezählt).

**F3 — 2 Extraction-Fehler (SyntaxError: Unterminated string)**
Bei Turns 5 und 6 schlug JSON-Parsing fehl. Extraktion für diese Turns ausgefallen. Extraktions-Wissensobjekte daher unvollständig.

**F4 — Phase progression 0.6**
Agent blieb 9 Turns bei Rechnungsbearbeitung bevor Wechsel zum Monatsabschluss (Turn 9→10). Für 2 bekannte Prozesse zu viele Quantifizierungs-Turns ohne klaren Schluss-Trigger.

**F5 — Dialog naturalness 0.67**
Turn 2: "Das ist ein guter Überblick über das Volumen" — Floskel. Turn 7/8: Agent bestätigt eigene Registrierung ("Ich erfasse diesen ersten Schritt als...", "Ich nehme das als Abschluss auf") — wirkt künstlich.

### Positive Befunde

- **slot_coverage 0.89** — fast vollständig, beide Schritte alle Pflicht-Slots gefüllt
- **step_registration_coverage 1.0 + schema_conformance_rate 1.0** — strukturelle Korrektheit gegeben
- **completion_correctness true** — Interview korrekt als `completed` abgeschlossen
- **depth_score 2** — akzeptable Tiefe; depth_p2=0.70 zeigt Konzentration auf mittlere Tiefe
- **overwrite_churn 0, blocked_rate 0** — kein Trail-Churn, kein blocked write

### Vergleich zu Vorgänger-Lauf (2026-06-18-14-47)

Vorheriger Lauf: `analyst_thinking_budget=0`, dieser Lauf: `analyst_thinking_budget=2048`.
Tool call plausibility: 0.63 (neu) vs. vorherigem Wert (prüfen via Langfuse). Extraction-Fehler weiterhin vorhanden — unabhängig vom Thinking-Budget ein robustheitsproblem im JSON-Parser.

### Nächste Schritte

1. **F2 — Halluzinationsschutz**: Talker darf keine intern berechneten Slot-Werte als Persona-Zitate ausgeben. Analyst muss Quote-Felder vom internen `value` trennen. Judge-Prompt erweitern um "berechnete Zahlen ≠ direkt zitierte Zahlen".
2. **F3 — Extraction robustheit**: JSON-Parser muss Unterminated-String-Fehler abfangen + Retry mit bereinigtem Response.
3. **F1 — Analyst register_step-Deduplizierung**: Vor `register_step` prüfen ob Schritt-Titel bereits im Tracker → kein Neuaufruf.
