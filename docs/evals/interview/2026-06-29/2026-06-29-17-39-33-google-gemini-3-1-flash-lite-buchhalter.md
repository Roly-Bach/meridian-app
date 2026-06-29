---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.1-flash-lite
analyst_thinking_budget: 2048
eval_date: 2026-06-29
persona: buchhalter
interview_id: 5fd2192c-7932-4558-ad45-7079f5cae636
eval_run_id: 2c17be73-d966-4fda-86ca-8ab444344f02
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/5fd2192c-7932-4558-ad45-7079f5cae636
turns_total: 24
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.93
  dedup_slot_coverage: 0.93
  slot_coverage_pre_clarification: 0.93
  dedup_slot_coverage_pre_clarification: 0.93
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  anchoring_violation_rate: 0
  tool_call_plausibility: 0.8
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: n/a (keine unknown-Slots)
  talker_grounding_violations: 1
  depth_score: 1.93
  depth_p1: 0.17
  depth_p2: 0.73
  depth_p3: 0.1
trail:
  total_writes: 63
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.25
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.93 | maximize |
| dedup_slot_coverage | 0.93 | maximize |
| slot_coverage_pre_clarification | 0.93 | maximize |
| dedup_slot_coverage_pre_clarification | 0.93 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| anchoring_violation_rate | 0 | maximize (niedriger besser) |
| tool_call_plausibility | 0.8 | ≥ 0.70 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | n/a (keine unknown-Slots) | > 0.80 |
| talker_grounding_violations | 1 | 0 |
| depth_score | 1.93 | maximize |
| depth_p1 | 0.17 | — |
| depth_p2 | 0.73 | — |
| depth_p3 | 0.1 | — |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.25 | < 0.20 |


## Judge-Begründung

Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-Form. Gute Übergänge zwischen Themen (z.B. [4] mit Rückbezug). Vereinzelt etwas formale Wendungen ([3] 'sprachst von'), aber insgesamt angemessen für ein strukturiertes Fachinterview.


## Talker-Faktentreue-Verletzungen (KI-9)

Turn 5: "Du hast vorhin erwähnt, dass die Verbuchung zügig geht, wenn keine Unstimmigkeiten vorliegen — jetzt sagst du, dass der Aufwand bei Unstimmigkeiten stark schwankt." — Der Mitarbeiter hat in Turn 4 nicht gesagt, dass 'der Aufwand bei Unstimmigkeiten stark schwankt'. Er sagte, dass die reguläre Verbuchung 'meist zügig vonstatten' geht, wenn alle Daten korrekt sind. Die Aussage über schwankenden Aufwand bei Unstimmigkeiten wird dem Mitarbeiter fälschlicherweise zugeschrieben.

## Gesprächsverlauf

[Turn 1] Persona: Ich fange damit an, dass sich meine Tätigkeit maßgeblich um die strukturierte Bearbeitung von Eingangsrechnungen und die Durchführung der monatlichen Abschlussarbeiten dreht. Dabei achte ich stets auf die Einhaltung interner Richtlinien, insbesondere bei der Validierung von Beträgen und der korrekten Zuordnung der Buchungsdaten. Zusätzlich verwalte ich anfallende Sonderfälle in unseren Tabellenkalkulationen, um eine saubere Datenbasis für das Controlling sicherzustellen.
[Turn 1] Agent: "Lass uns mit der Bearbeitung der Eingangsrechnungen beginnen. Welcher erste Schritt ist erforderlich, sobald eine Eingangsrechnung bei dir zur Bearbeitung eingeht?"

[Turn 2] Persona: Zunächst nehme ich die eingegangenen Dokumente über unseren elektronischen Posteingang entgegen und sichte diese auf ihre inhaltliche Vollständigkeit. Dabei prüfe ich die Rechnungen grundlegend auf den zutreffenden Lieferanten, den ausgewiesenen Rechnungsbetrag sowie den angegebenen Leistungszeitraum. Im Anschluss daran erfolgt die Erfassung im Buchhaltungssystem, bevor die Unterlagen final in unser Archivsystem überführt werden.
[Turn 2] Agent: "Wie viele Eingangsrechnungen bearbeitest du durchschnittlich pro Monat?"

[Turn 3] Persona: Im Rahmen meiner monatlichen Bearbeitung gehen bei mir üblicherweise zwischen achtzig und einhundert Eingangsrechnungen ein. Diese Anzahl erfordert eine kontinuierliche Abarbeitung, um sämtliche offenen Posten fristgerecht abgleichen zu können. Bei einer Überschreitung bestimmter wertmäßiger Schwellenwerte leite ich zudem zwingend die erforderlichen zusätzlichen Freigabeschritte ein.
[Turn 3] Agent: "Wie viel Zeit beansprucht die Prüfung einer einzelnen Rechnung im Durchschnitt?"

[Turn 4] Persona: Für den Ablauf einer einzelnen Rechnung lässt sich keine pauschale Dauer angeben, da der Aufwand stark von der Vollständigkeit der Informationen abhängt. Sollte der Bestellbezug fehlen, recherchiere ich den verantwortlichen Auftraggeber manuell in drei verschiedenen Systemen, was einen nennenswerten wöchentlichen Zeitaufwand verursacht. Die reguläre Verbuchung hingegen geht meist zügig vonstatten, sofern alle Daten korrekt im SAP FI hinterlegt sind und keine Unstimmigkeiten vorliegen.
[Turn 4] Agent: "[update_walkthrough_data(
    step_title="Eingangsrechnungsbearbeitung",
    process_steps=["Recherche bei fehlendem Bestellbezug", "Reguläre Verbuchung"],
    friction_points=["Fehlender Bestellbezug erfordert manuelle Recherche in drei Systemen"],
    friction_tools=["SAP FI"]
)]

Eher 5 Minuten oder eher 15 Minuten für eine reguläre Rechnung?"

[Turn 5] Persona: Eine reguläre Rechnung lässt sich in der Regel zeitnah erfassen, da hierfür lediglich die Prüfung von Lieferant, Betrag und Zeitraum sowie die Verbuchung im SAP FI erforderlich sind. In diesen Standardfällen bewege ich mich eher im Bereich von fünf Minuten pro Vorgang. Der erhöhte Zeitaufwand entsteht erst dann, wenn durch Unstimmigkeiten oder fehlende Angaben eine manuelle Recherche notwendig wird.
[Turn 5] Agent: "Du hast vorhin erwähnt, dass die Verbuchung zügig geht, wenn keine Unstimmigkeiten vorliegen — jetzt sagst du, dass der Aufwand bei Unstimmigkeiten stark schwankt. Was ist der Unterschied in der Bearbeitung, und wie hoch ist der Anteil der Rechnungen, bei denen diese Unstimmigkeiten auftreten?"

[Turn 6] Persona: Für den Abschluss der Rechnungsprüfung bei Unstimmigkeiten müssen oft fehlende Kostenstellen ergänzt, fehlerhafte Mehrwertsteuersätze korrigiert oder Betragsdifferenzen geklärt werden, was eine deutlich intensivere manuelle Bearbeitung im SAP FI und Excel erfordert. Solche Unstimmigkeiten betreffen etwa fünf Prozent der monatlich eingegangenen Rechnungen. Diese Fälle erfordern zusätzliche Abstimmungen, da sie vom regulären Prozessablauf abweichen und eine sorgfältige manuelle Klärung notwendig machen.
[Turn 6] Agent: "Wie gestaltet sich dein Prozess bei den monatlichen Abschlussarbeiten und in welchem Umfang fallen diese zeitlich an?"

[Turn 7] Persona: Für den Abschluss bearbeite ich systematisch die offenen Posten, erfasse notwendige Rückstellungen und bereite die Daten für das Controlling auf. Da dabei auch manuelle Excel-Listen für Sonderfälle und Ausnahmen gepflegt werden müssen, erstreckt sich dieser Prozess über zwei bis drei Tage pro Monat. Aufgrund der hohen Arbeitsintensität konzentriere ich mich in dieser Zeit vollumfänglich auf die konsistente Datenbasis in unserem SAP FI.
[Turn 7] Agent: "Du hast die Arbeit mit den Excel-Listen für Sonderfälle erwähnt — nach welchen Kriterien entscheidest du, ob ein Sachverhalt direkt in SAP bleibt oder in eine separate Liste ausgelagert werden muss?"

[Turn 8] Persona: Wenn Sachverhalte nicht durch die Standardfunktionen des SAP FI abgebildet werden können oder spezifische Ausnahmefälle darstellen, erfasse ich diese eigenhändig in Excel-Listen. Diese Vorgehensweise ist notwendig, da solche Sonderfälle keine regulären Buchungsmasken nutzen können und andernfalls die Datenqualität im Hauptsystem gefährdet wäre. Ich aktualisiere diese Listen kontinuierlich, um für das Controlling eine belastbare Übersicht über sämtliche Abweichungen und laufende Klärungsprozesse zu gewährleisten.
[Turn 8] Agent: "Welche Art von Daten oder Ausnahmen werden dort typischerweise erfasst und wie häufig kommen diese Sonderfälle im Vergleich zum regulären Monatsabschluss vor?"

[Turn 9] Persona: Beim Monatsabschluss dokumentiere ich in diesen Listen primär Unstimmigkeiten wie fehlende Kostenstellen, fehlerhafte Mehrwertsteuersätze oder Differenzen bei den Rechnungsbeträgen. Diese Sonderfälle treten bei etwa fünf Prozent der monatlichen Eingangsrechnungen auf und erfordern eine separate Nachverfolgung, da sie sich nicht direkt in die regulären Buchungsabläufe einfügen. Die konsequente Pflege dieser Daten in Excel stellt sicher, dass alle Ausnahmen für den Abschluss nachvollziehbar bleiben und das Controlling eine vollständige Übersicht erhält.
[Turn 9] Agent: "Wie kommen die Daten bei der Recherche zwischen den drei Systemen zusammen, und überträgst du die Informationen aus den Excel-Listen für den Monatsabschluss manuell in das SAP FI?"

[Turn 10] Persona: Wenn ich die Zahlen sehe und den Ablauf betrachte, werden Informationen aus den drei Systemen für den Bestellbezug durch meine manuelle Recherche zusammengetragen und im SAP FI verknüpft. Bezüglich der Excel-Listen für den Monatsabschluss gilt, dass ich die dort erfassten Ausnahmen nach erfolgter Klärung gezielt und manuell in das SAP FI übernehme. Dieser Schritt ist essenziell, um die Buchungen für den Abschluss final zu korrigieren und eine konsistente Datenbasis zu gewährleisten.
[Turn 10] Agent: "Wie erfolgt die finale Übergabe oder Abstimmung der in Excel gepflegten Sonderfälle mit dem Controlling, und gibt es dabei feste Vorgaben oder Richtlinien, die du einhalten musst?"

[Turn 11] Persona: Für den Abschluss übertrage ich die aufbereiteten Daten aus den Excel-Listen in das SAP FI, damit das Controlling auf eine konsistente Datenbasis zugreifen kann. Die Übermittlung erfolgt durch die direkte Bereitstellung dieser Buchungsergebnisse, welche durch meine Abstimmung der offenen Posten und die erfassten Rückstellungen untermauert werden. Feste Richtlinien zur internen Kontrolle geben mir dabei den Rahmen vor, um die Vollständigkeit und Richtigkeit sämtlicher Buchungsvorgänge zu gewährleisten.
[Turn 11] Agent: "Die Richtlinien geben den Rahmen für den Abschluss vor. Wie oft entstehen bei der Rechnungsprüfung oder beim Monatsabschluss Medienbrüche, bei denen du Daten manuell zwischen Systemen übertragen musst?"

[Turn 12] Persona: Grundsätzlich gilt, dass Medienbrüche vor allem bei der Recherche fehlender Bestellbezüge auftreten, da hier Informationen aus drei unterschiedlichen Systemen zusammengeführt werden müssen. Zudem erfordert der Monatsabschluss die manuelle Übertragung von Informationen aus Excel-Listen in unser Buchhaltungssystem, sobald die dort erfassten Ausnahmen geklärt sind. Diese manuellen Tätigkeiten sind für den Ausgleich von Unstimmigkeiten unerlässlich, um die Datenintegrität in der Finanzbuchhaltung zu wahren.
[Turn 12] Agent: "Gibt es bei der Vorbereitung des Monatsabschlusses bestimmte Schritte, die zwingend von der vorherigen Bearbeitung der Eingangsrechnungen abhängen, oder laufen diese Prozesse völlig autark nebeneinander?"

[Turn 13] Persona: Bei der Vorbereitung des Monatsabschlusses bilden die während des Monats verbuchten Eingangsrechnungen das unverzichtbare Fundament für meine weitere Arbeit. Sämtliche offenen Posten, die ich im Laufe des Monats in SAP FI erfasst habe, fließen direkt in den Abgleich ein, welcher wiederum die Basis für die notwendigen Rückstellungen bildet. Eine autarke Abwicklung ist daher nicht möglich, da die Qualität und Vollständigkeit der Daten aus der laufenden Rechnungsprüfung unmittelbar darüber entscheiden, wie effizient ich die Abschlussarbeiten durchführen kann.
[Turn 13] Agent: "Du sprachst von internen Richtlinien, die den Rahmen für den Monatsabschluss vorgeben — wie genau wird die Einhaltung dieser Richtlinien überprüft oder dokumentiert?"

[Turn 14] Persona: Die Überprüfung der internen Richtlinien erfolgt primär durch die systematische Archivierung sämtlicher Belege in DocuWare, wodurch die Dokumentation der einzelnen Buchungsvorgänge jederzeit nachvollziehbar bleibt. Bei Überschreiten der finanziellen Grenze von 5.000 EUR ist zudem eine zwingende zusätzliche Freigabe erforderlich, welche den Prozess der Rechnungsprüfung absichert. Somit ist durch die Kombination aus systemgestützter Archivierung und verbindlichen Freigabeschritten sichergestellt, dass alle Buchungen den geltenden Vorgaben für den Monatsabschluss entsprechen.
[Turn 14] Agent: "[update_walkthrough_data(
    step_title="Monatsabschluss",
    process_steps=["Systematische Archivierung in DocuWare", "Zusätzliche Freigabe bei Beträgen > 5.000 EUR", "Abstimmung der offenen Posten", "Erfassung von Rückstellungen", "Datenübertragung aus Excel in SAP FI"],
    friction_points=["Abhängigkeit von Datenqualität aus Rechnungsprüfung", "Manuelle Übertragung von Excel-Ausnahmen in SAP FI"],
    friction_tools=["SAP FI", "Excel-Listen", "DocuWare"]
)]

Welche spezifischen Anforderungen oder Hindernisse verhindern aktuell eine stärkere Automatisierung der manuellen Recherche- und Übertragungsschritte, insbesondere im Hinblick auf die Anforderungen des Controllings?"

[Turn 15] Persona: Im Rahmen einer stärkeren Automatisierung stellt die Heterogenität der Datenquellen ein primäres Hindernis dar, da die Informationen für eine vollständige Zuordnung oft nicht in einem einheitlichen Format vorliegen. Die manuelle Recherche bei fehlenden Bestellbezügen ist derzeit notwendig, um die für das Controlling erforderliche Granularität der Daten sicherzustellen, die in unseren Systemen nicht durchgängig verknüpft ist. Zudem erfordern die individuellen Sonderfälle in unseren Excel-Listen eine spezifische buchhalterische Einschätzung, die sich nur schwer in starre automatisierte Regeln überführen lässt, ohne die geforderte hohe Datenqualität zu gefährden.
[Turn 15] Agent: "Gibt es darüber hinaus noch weitere, weniger offensichtliche Tätigkeiten oder Nebenprozesse, die im Rahmen deiner täglichen Arbeit anfallen, die wir bisher noch nicht betrachtet haben?"

[Turn 16] Persona: Hinsichtlich weiterer Tätigkeiten muss ich den monatlichen Mahnlauf anführen, welcher im Arbeitsalltag eine erhebliche zeitliche Belastung darstellt. Dieser Prozess erfordert eine hohe Aufmerksamkeit, um die Außenstände korrekt zu verwalten und den Zahlungsfluss unserer Debitoren konsequent zu verfolgen. Da wir diesen Bereich bisher nicht detailliert betrachtet haben, stellt er jedoch einen wesentlichen, arbeitsintensiven Aspekt meines Aufgabenfeldes dar.
[Turn 16] Agent: "Welche Schritte umfasst dieser Mahnlauf genau und wie viel Zeit beansprucht die Bearbeitung pro Monat?"

[Turn 17] Persona: Wenn ich den Mahnlauf betrachte, beginne ich mit der Identifikation der überfälligen Forderungen im System, um anschließend die entsprechenden Mahnstufen manuell zu prüfen und auszulösen. Dieser Prozess erfordert eine hohe Präzision, da ich bei jedem Vorgang individuell beurteilen muss, ob ein automatisierter Mahnversand bereits angebracht ist oder eine persönliche Rücksprache mit dem Debitor erfolgen sollte. Aufgrund der notwendigen Abstimmungen und der Vorbereitung der Mahnschreiben nimmt diese Tätigkeit einen nicht unerheblichen Teil meiner monatlichen Kapazitäten in Anspruch.
[Turn 17] Agent: "[update_walkthrough_data(
    step_title="Mahnlauf",
    process_steps=["Identifikation überfälliger Forderungen", "Manuelle Prüfung der Mahnstufen", "Entscheidung: Automatisierter Versand vs. persönliche Rücksprache", "Vorbereitung der Mahnschreiben"],
    friction_points=["Individuelle Beurteilung bei jedem Vorgang erforderlich"],
    friction_tools=["SAP FI"]
)]

Eher einen halben Tag oder eher zwei Tage pro Monat für diesen Prozess?"

[Turn 18] Persona: Für die Durchführung des Mahnlaufs beanspruche ich monatlich etwa einen Zeitraum, der sich eher an der Marke von zwei Tagen orientiert. Dies liegt vor allem an der notwendigen Sorgfalt bei der individuellen Einzelfallprüfung, da ich nicht jeden Debitor pauschal mahnen kann, sondern den persönlichen Kontakt als Alternative sorgfältig abwägen muss. Diese zeitliche Investition ist jedoch zwingend erforderlich, um den Zahlungsfluss aktiv zu steuern und unsere Außenstände im Blick zu behalten.
[Turn 18] Agent: "Welche Datenquellen oder Berichte nutzt du konkret für die Identifikation der überfälligen Forderungen, und gibt es dabei Medienbrüche, etwa durch den Export in externe Listen?"

[Turn 19] Persona: Für die Identifikation der überfälligen Forderungen greife ich unmittelbar auf die entsprechenden Berichte innerhalb des SAP FI zurück, die mir eine Übersicht der offenen Posten liefern. Medienbrüche treten in diesem spezifischen Prozess glücklicherweise kaum auf, da die Analyse direkt im System erfolgt, um eine durchgehende Datenkonsistenz zu wahren. Sollten jedoch komplexe Klärungsfälle vorliegen, ziehe ich bei Bedarf unterstützende Informationen aus unseren internen Dokumenten heran, um die Entscheidungsgrundlage für den weiteren Mahnverlauf zu vervollständigen.
[Turn 19] Agent: "Wie hoch ist der Anteil der Mahnungen, bei denen du nach der ersten Prüfung feststellst, dass eine persönliche Rücksprache statt eines automatisierten Versands notwendig ist?"

[Turn 20] Persona: Wenn ich die Verteilung meiner Mahnvorgänge betrachte, erfordert etwa ein Viertel der Fälle eine persönliche Klärung anstatt des automatisierten Versands. Diese Auswahl beruht auf meiner individuellen Beurteilung der jeweiligen Kundenbeziehung oder etwaiger ungelöster Rückfragen zur Rechnung. Auf diese Weise stelle ich sicher, dass wir unsere Forderungen zielgerichtet verfolgen, ohne dabei unnötige Spannungen in unserer Geschäftsbeziehung zu provozieren.
[Turn 20] Agent: "Da wir nun die drei Kernprozesse betrachtet haben: Gibt es über alle Bereiche hinweg noch spezifische Kennzahlen, wie etwa Fehlerraten oder Durchlaufzeiten, die du im Blick behältst?"

[Turn 21] Persona: Hinsichtlich der Kennzahlen liegt mein Fokus vor allem auf der Einhaltung der Termine für den Monatsabschluss, um die Daten fristgerecht an das Controlling zu übermitteln. Ich beobachte zudem kontinuierlich die Anzahl der Unstimmigkeiten bei Eingangsrechnungen, da diese direkt die Effizienz meiner täglichen Arbeit beeinflussen. Darüber hinaus achte ich im Rahmen des Mahnwesens auf die Entwicklung der Außenstände, um proaktiv auf Verzögerungen beim Zahlungsfluss reagieren zu können.
[Turn 21] Agent: "Wie oft führst du den Mahnlauf im Monat durch, und gibt es dabei spezifische Richtlinien oder Abhängigkeiten von anderen Prozessen, die du beachten musst?"

[Turn 22] Persona: In der Regel führe ich den Mahnlauf einmal monatlich durch, um den Zahlungsfluss konsistent nachzuhalten und unsere Forderungen systematisch zu überwachen. Dabei orientiere ich mich strikt an unseren internen Kreditrichtlinien, die den zeitlichen Rahmen für die Eskalation bei ausbleibenden Zahlungen festlegen. Bestehen Abhängigkeiten zu anderen Prozessen, so ist insbesondere der vorangegangene Abgleich der offenen Posten aus der Rechnungsprüfung entscheidend, damit nur tatsächlich fällige und berechtigte Forderungen gemahnt werden.
[Turn 22] Agent: "Wie viel Prozent deiner Gesamttätigkeit würdest du als strikt regelbasiert und wie viel als individuell einschätzen?"

[Turn 23] Persona: Wenn ich meine gesamte Tätigkeit reflektiere, würde ich etwa siebzig Prozent als strikt regelbasiert einordnen, da die Standardbuchungen und die routinemäßigen Archivierungsschritte klaren Vorgaben folgen. Die verbleibenden dreißig Prozent erfordern jedoch ein hohes Maß an individueller Einschätzung, insbesondere bei der Klärung von Unstimmigkeiten, der manuellen Recherche in mehreren Systemen oder der Entscheidung zwischen Mahnversand und persönlicher Rücksprache. Diese Differenzierung ist notwendig, um sowohl die Effizienz der Standardabläufe zu wahren als auch die Qualität bei komplexen Sonderfällen sicherzustellen.
[Turn 23] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

[Turn 24] Persona: Wenn ich auf meine zurückliegende Woche blicke, fällt mir die kontinuierliche Abstimmung mit den Fachabteilungen bei unklaren Rechnungsdetails auf. Oftmals entstehen hierbei Rückfragen zu bereits verbuchten oder in Prüfung befindlichen Vorgängen, die nicht direkt in den von uns skizzierten Prozessen abgebildet sind. Diese kommunikative Komponente begleitet mich regelmäßig, da ich fortlaufend Rücksprache halten muss, um die notwendige Klarheit für eine regelkonforme Buchhaltung zu schaffen.
[Turn 24] Agent: "Wie viel Zeit beansprucht diese Abstimmung mit den Fachabteilungen im Durchschnitt pro Woche?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Eingangsrechnungsbearbeitung | done | 90 ✓ | 5 ✓ | Zusätzliche Freigabe ✓ | manuelle Recherche ✓ | 5 ✓ | 3 ✓ |
| Monatsabschluss | done | 1 ✓ | 1200 ✓ | zwingende zusätzlich ✓ | DocuWare ✓ | 5 ✓ | 1 ✓ |
| Mahnlauf | done | 1 ✓ | 960 ✓ | Orientierung an inte ✓ | DocuWare,SAP FI ✓ | 25 ✓ | 0 ✓ |
