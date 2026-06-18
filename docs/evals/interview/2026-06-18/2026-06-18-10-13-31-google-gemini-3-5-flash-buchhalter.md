---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-18
persona: buchhalter
interview_id: d582468e-eea6-4729-bea9-418eb06e7531
eval_run_id: 7058a9eb-0c7a-42c0-bc6f-d9d0c8a749a3
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/d582468e-eea6-4729-bea9-418eb06e7531
turns_total: 25
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.67
  dedup_slot_coverage: 0.67
  slot_coverage_pre_clarification: 0.67
  dedup_slot_coverage_pre_clarification: 0.67
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.58
  dialog_naturalness: 0.5
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: 0
  depth_score: 1.84
  depth_p1: 0.26
  depth_p2: 0.63
  depth_p3: 0.11
trail:
  total_writes: 25
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.08
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.67 | maximize |
| dedup_slot_coverage | 0.67 | maximize |
| slot_coverage_pre_clarification | 0.67 | maximize |
| dedup_slot_coverage_pre_clarification | 0.67 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.58 | ≥ 0.80 |
| dialog_naturalness | 0.5 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | 0 | > 0.80 |
| depth_score | 1.84 | maximize |
| depth_p1 | 0.26 | — |
| depth_p2 | 0.63 | — |
| depth_p3 | 0.11 | — |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.08 | < 0.20 |


## Judge-Begründung

**Begründung:**

**Natürlichkeit und Gesprächsfluss:**
Die Texte zeigen ein strukturiertes Interview-Format, das grundsätzlich funktional ist. Allerdings weisen mehrere Passagen eine gewisse Steifheit auf:
- [1] wirkt professionell, aber die Einleitung ist etwas formelhaft ("Schön, dass du dir die Zeit nimmst", "selbstverständlich vertraulich")
- [2]–[6] folgen einem repetitiven Muster: Kurze Übergangssätze, dann direkte Fragen. Dies wirkt mechanisch und wenig organisch
- [7]–[8] sind höflich, aber wirken abrupt und generisch ("Lassen wir das so stehen", "angenehmes Gespräch")

**Du-Form:**
Die Du-Form wird durchgehend konsequent eingehalten – das ist positiv.

**Floskeln und generische Wendungen:**
- "Schön, dass du dir die Zeit nimmst" (Standardfloskel)
- "Das ist ein klassischer manueller Übertrag" (etwas generisch)
- "Das Mahnwesen ist

## Gesprächsverlauf

[Turn 1] Persona: Gerne unterstütze ich Sie bei der Dokumentation meiner täglichen Abläufe in der Finanzbuchhaltung. Mein Arbeitsalltag ist primär durch die laufende Kontrolle und Verbuchung von Eingangsbelegen sowie die Vorbereitung und Durchführung der monatlichen Abschlussarbeiten geprägt. Dabei lege ich großen Wert auf die Einhaltung unserer internen Genehmigungsstrukturen und die sorgfältige Klärung etwaiger Unstimmigkeiten bei der Buchführung.
[Turn 1] Agent: "Hallo Andreas. Schön, dass du dir die Zeit nimmst. Unser Ziel heute ist es, dein wertvolles Prozesswissen strukturiert zu dokumentieren, um deine täglichen Abläufe besser zu verstehen. Alles, was wir besprechen, wird selbstverständlich vertraulich behandelt.

Wie sieht ein typischer Arbeitstag bei dir aus und welche Hauptaufgaben prägen deinen Tagesablauf?"

[Turn 2] Persona: Bei der Gestaltung meines Arbeitstages liegt mein Fokus auf der systematischen Bearbeitung von Eingangsbelegen sowie der sorgfältigen Durchführung unserer Abschlussarbeiten. Ich prüfe dabei eingehende Dokumente auf ihre korrekte Zuordnung und Kontierung, wobei ich stets die geltenden Genehmigungsgrenzen beachte. Ergänzend dazu widme ich mich der Klärung von Unstimmigkeiten, um eine ordnungsgemäße finanzielle Berichterstattung zu gewährleisten.
[Turn 2] Agent: "Lass uns mit der Bearbeitung der Eingangsbelege starten.

Wie genau beginnt dieser Prozess, sobald ein neuer Beleg bei dir eingeht?"

[Turn 3] Persona: Zunächst empfange ich die Unterlagen über den elektronischen Postweg und sichte diese hinsichtlich des Lieferanten, des Rechnungsbetrages sowie des Leistungszeitraums. Danach gleichen wir die Daten mit den vorhandenen Informationen ab, erfassen die Rückstellungen und leiten die relevanten Informationen an das Controlling weiter. Sollte der Rechnungsbetrag einen bestimmten Schwellenwert überschreiten, hole ich vor der abschließenden Archivierung und Verbuchung in unseren Systemen eine zusätzliche Genehmigung ein.
[Turn 3] Agent: "Wie viele dieser Eingangsbelege gehen durchschnittlich pro Monat bei dir ein?"

[Turn 4] Persona: Im Verlauf eines regulären Monats bearbeite ich ein Volumen von 80 bis 100 Eingangsrechnungen. Diese Anzahl unterliegt einer gewissen Schwankung, bildet aber das übliche Pensum ab, das ich kontinuierlich über meine Systeme verarbeite.
[Turn 4] Agent: "Das ist eine solide Basis für den Prozess. 

Wie viel Zeit benötigst du im Schnitt für die erste Sichtung und Prüfung eines einzelnen Belegs?"

[Turn 5] Persona: Beim Prozess der Rechnungsprüfung ist der Zeitaufwand maßgeblich davon abhängig, ob eine direkte Zuordnung zu einer Bestellung vorliegt. Sollte der Bestellbezug fehlen, bin ich gezwungen, den Auftraggeber manuell über drei verschiedene Systeme hinweg zu identifizieren, was pro Woche etwa eine Stunde in Anspruch nimmt. Sind hingegen alle Daten vollständig, erfolgt die Sichtung und Verbuchung in den gängigen Systemen wie SAP FI und DocuWare zügig.
[Turn 5] Agent: "Verstanden, das manuelle Suchen bei fehlendem Bestellbezug ist also ein relevanter Zusatzaufwand.

Wie lange dauert die Sichtung und Prüfung eines Belegs im Normalfall, wenn alle Daten vollständig vorhanden sind?"

[Turn 6] Persona: Bei einem vollständigen Datensatz reduziert sich mein manueller Aufwand erheblich, da ich den Beleg ohne weitere Recherchen direkt in SAP FI erfassen und anschließend in DocuWare zur Archivierung ablegen kann. Der Prozess verläuft in diesen Fällen standardisiert über die Verbuchung und die Prüfung der Genehmigungsgrenze, sofern der Betrag einen Schwellenwert übersteigt. Konkrete Zeitvorgaben für einen einzelnen Beleg lassen sich aufgrund der variierenden Komplexität der Kontierung jedoch schwer pauschal festlegen.
[Turn 6] Agent: "Ok, das passt so.

Wer ist an dieser ersten Sichtung und Prüfung der Belege noch beteiligt, oder machst du das komplett allein?"

[Turn 7] Persona: Die initiale Sichtung und die anschließende Verbuchung in SAP FI führe ich eigenständig durch, um die Konsistenz der Daten zu wahren. Sollte bei einer Rechnung jedoch die festgelegte Wertgrenze von 5.000 EUR überschritten werden, ziehe ich für die notwendige Genehmigung die zuständigen Stellen hinzu. Erst nach deren Freigabe erfolgt die finale Archivierung der Unterlagen in DocuWare.
[Turn 7] Agent: "Verstanden, du machst die Prüfung und Erfassung also im ersten Schritt allein.

Wie läuft die anschließende Verbuchung in SAP FI konkret ab, sobald der Beleg freigegeben oder unter der Freigabegrenze ist?"

[Turn 8] Persona: Für den Vorgang der Verbuchung übertrage ich die vorliegenden Rechnungsdaten in das SAP-System, wobei ich die Kontierung entsprechend der Kostenstelle oder des Sachkontos vornehme. Parallel dazu gleiche ich die offenen Posten ab und erfasse die notwendigen Rückstellungen, um die Datenbasis für das Controlling korrekt aufzubereiten. Nach dem erfolgreichen Abschluss dieser Buchungsvorgänge führe ich die Archivierung des Belegs in unserem Dokumentenmanagementsystem durch, damit dieser revisionssicher abgelegt ist.
[Turn 8] Agent: "Das ist ein sehr strukturierter Ablauf.

Wie viel Zeit benötigst du im Schnitt für die Verbuchung und anschließende Archivierung eines einzelnen Belegs?"

[Turn 9] Persona: Für den Abschluss der Verbuchung und die anschließende Archivierung lässt sich kein fester Zeitwert pro Beleg nennen, da die Dauer stark von der Komplexität der Kontierung und der Notwendigkeit einer zusätzlichen Genehmigung abhängt. Sobald die Daten vollständig sind und keine Rückfragen entstehen, erfolgt der Prozess der systemseitigen Erfassung und Ablage in unseren Anwendungen jedoch zeitnah. Ein nennenswerter Mehraufwand entsteht lediglich dann, wenn Unstimmigkeiten bei den Rechnungsdaten auftreten oder die Betragsgrenze für die Freigabe eine längere Bearbeitungskette erfordert.
[Turn 9] Agent: "Lassen wir das so stehen.

Wie genau läuft die Vorbereitung der monatlichen Abschlussarbeiten ab, sobald dieser Prozessschritt ansteht?"

[Turn 10] Persona: Für den Abschluss arbeite ich zunächst alle Sonderfälle und Unstimmigkeiten ab, die ich über den Monat hinweg in Excel-Listen erfasst habe. Ich prüfe dabei gezielt Sachverhalte wie fehlende Kostenstellen, abweichende Rechnungsbeträge oder Unstimmigkeiten bei den Mehrwertsteuersätzen, um eine saubere Datenbasis in SAP FI sicherzustellen. Dieser Prozess der Fehlerbereinigung nimmt zwei bis drei Tage in Anspruch, da ein gewisser Prozentsatz der Belege regelmäßig nachbearbeitet werden muss, bevor die endgültige Bilanzierung erfolgen kann.
[Turn 10] Agent: "Du hast die Excel-Listen zur Fehlerbereinigung erwähnt. 

Welche Dokumente oder Daten benötigst du neben diesen Listen für den Monatsabschluss, und was ist das fertige Ergebnis, das du am Ende übergibst?"

[Turn 11] Persona: Für den Abschluss greife ich primär auf die im SAP FI hinterlegten Buchungsdaten sowie auf die im Laufe des Monats in DocuWare archivierten Belege zurück. Ich validiere diese Datenbestände gegen meine manuell geführten Excel-Aufzeichnungen, um sicherzustellen, dass sämtliche Unstimmigkeiten bereinigt sind. Das Ergebnis dieser intensiven Arbeit ist ein konsolidierter Datensatz, der eine korrekte finanzielle Berichterstattung ermöglicht und dem Controlling als verlässliche Grundlage dient.
[Turn 11] Agent: "Du hast vorhin erwähnt, dass du die Rechnungsdaten manuell in SAP FI überträgst und in DocuWare archivierst. 

Wie hoch ist schätzungsweise der Anteil der Belege, bei denen beim Übertrag oder der Erfassung Fehler korrigiert werden müssen?"

[Turn 12] Persona: Bei etwa fünf Prozent der Rechnungen treten regelmäßig Unstimmigkeiten auf, die eine manuelle Nachbearbeitung erfordern. Diese Fälle umfassen beispielsweise fehlende Kostenstellen, fehlerhafte Mehrwertsteuersätze oder Diskrepanzen bei den Rechnungsbeträgen. Um diese Abweichungen zu korrigieren, greife ich auf meine Aufzeichnungen zurück, die ich zur Qualitätssicherung während des Monats führe.
[Turn 12] Agent: "Du hast vorhin erwähnt, dass du monatlich 80 bis 100 Rechnungen bearbeitest, die per E-Mail eingehen, und diese dann in SAP FI und DocuWare erfasst. 

Welche Medienbrüche oder manuellen Überträge – zum Beispiel das Abtippen von Daten aus den PDFs in die Systeme – fallen bei diesem Schritt genau an?"

[Turn 13] Persona: In meinem Arbeitsalltag stellt der manuelle Datentransfer von den per E-Mail eingehenden PDF-Dokumenten in unser Buchhaltungssystem den primären Medienbruch dar. Da die Informationen aus den digitalen Belegen nicht automatisiert ausgelesen werden, übertrage ich die relevanten Rechnungsdaten – wie beispielsweise Lieferantendaten, Beträge und Kontierungsinformationen – händisch in die entsprechenden Erfassungsmasken von SAP FI. Dieser manuelle Übertrag ist aufgrund der fehlenden Schnittstellen zwischen dem E-Mail-Posteingang und den Zielsystemen für jeden Beleg zwingend erforderlich, bevor eine Archivierung in DocuWare erfolgt.
[Turn 13] Agent: "Verstanden, das ist ein klassischer manueller Übertrag.

Wie oft führst du diese Rechnungsbearbeitung im Monat durch – bearbeitest du die Belege täglich bei Eingang oder sammelst du sie für bestimmte Tage?"

[Turn 14] Persona: Die Bearbeitung der eingegangenen Rechnungen erfolgt bei mir kontinuierlich, um eine zeitnahe Verbuchung sicherzustellen und offene Posten stets aktuell zu halten. Ich sichte den E-Mail-Eingang daher regelmäßig und arbeite die Belege fortlaufend ab, statt sie über einen längeren Zeitraum zu sammeln. Auf diese Weise vermeide ich einen unnötigen Bearbeitungsstau und gewährleiste, dass die Daten für das Controlling sowie die Genehmigungsprozesse fortlaufend auf dem neuesten Stand sind.
[Turn 14] Agent: "Du bearbeitest die Belege also fortlaufend jeden Tag. 

Worauf achtest du bei der ersten Sichtung eines Belegs besonders, um Unstimmigkeiten oder Fehler sofort zu erkennen, noch bevor du ihn in SAP erfasst?"

[Turn 15] Persona: Bei der ersten Durchsicht lege ich besonderes Augenmerk auf die Übereinstimmung der ausgewiesenen Lieferantendaten mit unseren Stammdaten, die Korrektheit des Leistungszeitraums sowie die Plausibilität der ausgewiesenen Mehrwertsteuersätze. Ich prüfe zudem unmittelbar, ob der auf der Rechnung vermerkte Betrag eine zusätzliche Genehmigung erfordert oder ob bereits ein eindeutiger Bestellbezug vorhanden ist. Sollten diese grundlegenden Angaben nicht mit den beiliegenden Dokumenten oder den betriebsinternen Anforderungen korrespondieren, identifiziere ich den Sachverhalt frühzeitig als potenzielle Fehlerquelle für meine manuelle Nachbearbeitung.
[Turn 15] Agent: "Du hast vorhin erwähnt, dass du für den Monatsabschluss Sonderfälle in Excel-Listen prüfst und diese mit SAP FI abgleichst. 

Wie oft im Monat führst du diesen Abschluss durch, und welche manuellen Überträge oder Medienbrüche fallen dabei an?"

[Turn 16] Persona: Für den Abschluss gilt, dass dieser Prozess einmal monatlich durchgeführt wird und einen Zeitraum von zwei bis drei Tagen in Anspruch nimmt. Dabei übertrage ich die Daten manuell aus den in Excel geführten Ausnahmelisten in unser Buchhaltungssystem SAP FI, da keine direkte technische Schnittstelle zwischen diesen beiden Anwendungen existiert. Dieser Medienbruch erfordert höchste Aufmerksamkeit, um eine konsistente Datenbasis für das Controlling sicherzustellen, da ich die dort erfassten Unstimmigkeiten während der Abschlussarbeiten manuell gegen die Systembuchungen validieren muss.
[Turn 16] Agent: "Wie hoch ist schätzungsweise der Anteil der Fälle beim Monatsabschluss, bei denen trotz der vorherigen monatlichen Pflege noch Fehler oder Unstimmigkeiten in den Daten auftauchen?"

[Turn 17] Persona: Für den Abschluss lässt sich festhalten, dass bei etwa fünf Prozent der Rechnungen im laufenden Betrieb Unstimmigkeiten auftreten, die ich während des Monats in meinen Listen dokumentiere. Trotz dieser kontinuierlichen Pflege der Ausnahmen ist eine finale Validierung während der Abschlussarbeiten unerlässlich, um sicherzustellen, dass sämtliche Differenzen bereinigt sind. Diese verbleibenden Posten sind in der Regel komplexer Natur und erfordern daher meine manuelle Prüfung, bevor ich den Abschluss in SAP FI finalisieren kann.
[Turn 17] Agent: "Nach welchen Kriterien entscheidest du bei diesen komplexen verbleibenden Differenzen im Monatsabschluss, wie ein Fall gelöst wird oder ob du ihn eskalieren musst?"

[Turn 18] Persona: Bei der Lösung dieser komplexen Differenzen prüfe ich zunächst, ob die Unstimmigkeit durch eine einfache Klärung der Kontierung oder eine Korrektur der Steuerparameter innerhalb meiner Zuständigkeit behebbar ist. Sollte der Sachverhalt jedoch die interne Richtlinienkonformität betreffen, etwa bei Unklarheiten über die Kostenstellenzuordnung oder bei abweichenden Rechnungsbeträgen ohne klaren Beleg, ziehe ich die betroffenen Fachabteilungen hinzu. Erst wenn diese Abstimmung zu keinem eindeutigen Ergebnis führt oder die Differenz das zulässige Maß für eigenständige Buchungen übersteigt, eskaliere ich den Vorgang an meine Vorgesetzten, um eine verbindliche Entscheidung für den Abschluss herbeizuführen.
[Turn 18] Agent: "Welche Erfahrungswerte oder impliziten Details, die in keinem Handbuch stehen, helfen dir beim Monatsabschluss, um Unstimmigkeiten schnell aufzuspüren?"

[Turn 19] Persona: Im Laufe der Jahre habe ich ein Gespür dafür entwickelt, bei welchen Lieferanten oder Kostenarten häufiger Diskrepanzen auftreten, was mir eine gezieltere Vorauswahl bei der Prüfung ermöglicht. Ich achte besonders auf subtile Muster in den Rechnungsdaten, die oft auf systemische Probleme in der Kontierung hinweisen, bevor diese im offiziellen Bericht als Fehler aufschlagen. Dieses Erfahrungswissen hilft mir, die Zusammenhänge zwischen den manuellen Excel-Listen und den Buchungen im System schneller zu verknüpfen, ohne jeden Einzelfall zeitraubend detailliert aufrollen zu müssen.
[Turn 19] Agent: "Du hast erwähnt, dass du die Rechnungen täglich bearbeitest – an wie vielen Tagen im Monat führst du diese Rechnungsbearbeitung im Schnitt durch?"

[Turn 20] Persona: Da ich die Eingangsrechnungen kontinuierlich bearbeite, um den Arbeitsfluss stabil zu halten, bin ich an jedem Arbeitstag des Monats mit diesen Tätigkeiten befasst. Das bedeutet, dass die Rechnungsprüfung an nahezu allen Werktagen eines Kalendermonats einen festen Bestandteil meiner Aufgaben darstellt. Auf diese Weise stelle ich sicher, dass keine Rückstände entstehen und die Daten für das Controlling sowie die Genehmigungsverfahren zeitnah zur Verfügung stehen.
[Turn 20] Agent: "Von welchen anderen Personen oder Abteilungen bist du bei der täglichen Rechnungsbearbeitung am meisten abhängig, um deine Arbeit zügig abschließen zu können?"

[Turn 22] Persona: In Bezug auf wiederkehrende Aufgaben in der Finanzbuchhaltung ist das monatliche Mahnwesen ein zentraler Bestandteil, der einen erheblichen Teil meiner zeitlichen Ressourcen in Anspruch nimmt. Obwohl wir diesen Bereich bisher nicht im Detail besprochen haben, ist er fest in meinen monatlichen Arbeitszyklus integriert, um die Forderungen und Verbindlichkeiten im Blick zu behalten. Der Prozess erfordert eine konsistente Nachverfolgung, um Liquiditätsengpässe zu vermeiden und die Kommunikation mit den betroffenen Geschäftspartnern stets auf einem aktuellen Stand zu halten.
[Turn 22] Agent: "Das Mahnwesen ist ein wichtiger Aspekt. 

Wie genau läuft dieser Prozess ab, sobald du mit der Bearbeitung der Mahnungen beginnst?"

[Turn 23] Persona: Für das Mahnwesen analysiere ich zunächst in regelmäßigen Abständen den Status der offenen Posten innerhalb unserer Buchhaltungssysteme. Dabei identifiziere ich diejenigen Geschäftspartner, deren Zahlungsfristen überschritten sind, und prüfe die entsprechenden Belegdaten auf Vollständigkeit. Anschließend leite ich die notwendigen Schritte ein, um die Außenstände durch gezielte Korrespondenz einzufordern und sicherzustellen, dass unser Forderungsmanagement stets eine präzise Übersicht über die aktuelle Liquiditätssituation bietet.
[Turn 23] Agent: "Verstanden — weiter im Ablauf.

Wie oft im Monat führst du diesen Mahnlauf beziehungsweise die Bearbeitung der Mahnungen durch?"

[Turn 24] Persona: Für die Durchführung des Mahnwesens ist ein fester Rhythmus etabliert, bei dem ich den Prozess üblicherweise einmal monatlich starte, um sämtliche Außenstände systematisch zu erfassen. Ich nehme mir hierfür bewusst einen definierten Zeitblock innerhalb des Monatszyklus, um die offenen Posten mit den tatsächlichen Zahlungseingängen abzugleichen. Dieser turnusmäßige Ablauf erlaubt es mir, die notwendige Korrespondenz zeitnah zu versenden und die Übersicht über unsere Liquidität auf dem aktuellen Stand zu halten.
[Turn 24] Agent: "Wie viel Zeit benötigst du im Schnitt für die Durchführung dieses monatlichen Mahnlaufs?"

[Turn 25] Persona: Für die Bearbeitung des Mahnwesens ist ein festgelegter Zeitrahmen vorgesehen, der den Abgleich der offenen Posten sowie die anschließende Kommunikation umfasst. Da ich diesen Prozess in einem definierten Zyklus durchlaufe, erfordert die systematische Erfassung der überfälligen Forderungen meine konzentrierte Aufmerksamkeit über einen Zeitraum von mehreren Stunden. Den exakten Zeitbedarf für diesen monatlichen Block kann ich jedoch nicht allgemeingültig beziffern, da er von der Anzahl der säumigen Geschäftspartner und der Komplexität der Einzelfälle abhängt.
[Turn 25] Agent: "Lassen wir das so stehen.

Vielen Dank, Andreas. Damit haben wir alle wichtigen Details zu deinen Prozessen in der Finanzbuchhaltung strukturiert erfasst. Deine Angaben helfen uns sehr weiter. Ich wünsche dir noch einen schönen Arbeitstag!"

[Turn 26] Persona: Es war mir ein Anliegen, Ihnen einen detaillierten Einblick in meine täglichen Aufgabenfelder und die damit verbundenen Herausforderungen zu geben. Ich hoffe, dass diese Informationen für Ihre weitere Arbeit und die Prozessdokumentation von großem Nutzen sind. Ich wünsche Ihnen ebenfalls einen produktiven Tag und bedanke mich für das konstruktive Gespräch.
[Turn 26] Agent: "Vielen Dank für das angenehme Gespräch und alles Gute für deine weitere Arbeit!"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| rechnungsbearbeitung | walkthrough | 21 ✓ | null ✓ | Dauer hängt von Komp ✓ | Aufzeichnungen zur Q ✓ | 5 ✓ | null |
| monatsabschluss | done | 1 ✓ | 1200 ✓ | Bei Differenzen Prüf ✓ | Excel ✓ | 5 ✓ | 1 ✓ |
| mahnwesen | walkthrough | 1 ✓ | null ✓ | null | null | null | null |
