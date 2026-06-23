---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-22
persona: buchhalter
interview_id: b54e2ce5-08a0-40f8-abd1-167eac923bed
eval_run_id: 732b1eac-cfb7-446f-b0c7-616d95dbe619
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/b54e2ce5-08a0-40f8-abd1-167eac923bed
turns_total: 25
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.78
  dedup_slot_coverage: 0.78
  slot_coverage_pre_clarification: 0.78
  dedup_slot_coverage_pre_clarification: 0.78
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.92
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: 0.5
  depth_score: 1.9
  depth_p1: 0.3
  depth_p2: 0.5
  depth_p3: 0.2
trail:
  total_writes: 52
  blocked_writes: 1
  blocked_rate: 0.02
  overwrite_churn: 0.52
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.78 | maximize |
| dedup_slot_coverage | 0.78 | maximize |
| slot_coverage_pre_clarification | 0.78 | maximize |
| dedup_slot_coverage_pre_clarification | 0.78 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.92 | ≥ 0.80 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | 0.5 | > 0.80 |
| depth_score | 1.9 | maximize |
| depth_p1 | 0.3 | — |
| depth_p2 | 0.5 | — |
| depth_p3 | 0.2 | — |
| blocked_rate | 0.02 | < 0.10 |
| overwrite_churn | 0.52 | < 0.20 |


## Judge-Begründung

Überwiegend natürliche, zielgerichtete Fragen mit konsistenter Du-Form. Die Fragen sind spezifisch und kontextbezogen, ohne generische Floskeln. Kleine Schwäche: Frage [6] ist sehr lang und komplex strukturiert, wirkt leicht überladend. Abschluss [8] ist höflich, aber etwas formell. Insgesamt angemessen für ein strukturiertes Interview.

## Gesprächsverlauf

[Turn 1] Persona: Im Rahmen meiner Tätigkeit verantworte ich maßgeblich die sachgemäße Bearbeitung aller eingehenden Rechnungen sowie die Durchführung der monatlichen Abschlussarbeiten. Mein Arbeitstag beginnt üblicherweise mit der systematischen Sichtung des Posteingangs, um die Dokumente in die entsprechenden Archivierungs- und Buchungssysteme zu überführen. Besonderes Augenmerk lege ich dabei auf die Einhaltung interner Freigaberichtlinien und die Klärung von Unstimmigkeiten, um eine korrekte Verbuchung sicherzustellen.
[Turn 1] Agent: "Lass uns mit der Bearbeitung der eingehenden Rechnungen beginnen. Wie viele Rechnungen gehen durchschnittlich pro Monat bei dir ein?"

[Turn 2] Persona: Für diesen speziellen Prozess gehen monatlich etwa 80 bis 100 Rechnungen bei uns ein. Die Bearbeitung erfolgt dabei über unser E-Mail-Postfach, von wo aus ich die Dokumente zur Kontrolle an die entsprechenden Anwendungen übergebe. Erst nach der erfolgreichen Prüfung und einer gegebenenfalls notwendigen Freigabe wird der Beleg schließlich im Buchhaltungssystem erfasst und archiviert.
[Turn 2] Agent: "Wie viel Zeit nimmst du dir im Durchschnitt für die Bearbeitung einer einzelnen Rechnung vom Eingang bis zur Archivierung?"

[Turn 3] Persona: Wenn ich die Rechnungsprüfung betrachte, lässt sich keine pauschale Zeitangabe für jeden Einzelfall festlegen, da der Aufwand stark variiert. Besteht keine direkte Zuordnung zu einer Bestellung, investiere ich beispielsweise wöchentlich etwa eine Stunde in die manuelle Recherche, um den verantwortlichen Auftraggeber in verschiedenen Systemen ausfindig zu machen. Sobald alle Informationen vorliegen, erfolgt die Erfassung und Archivierung innerhalb kurzer Zeit, sofern keine zusätzlichen Freigaben erforderlich sind.
[Turn 3] Agent: "Du hast von wöchentlich einer Stunde Recherche bei fehlender Zuordnung gesprochen. Bei welchem Anteil der monatlichen Rechnungen ist dieser Klärungsbedarf notwendig und welche Hilfsmittel nutzt du neben dem E-Mail-Postfach und dem Buchhaltungssystem für die Nachverfolgung?"

[Turn 4] Persona: Grundsätzlich gilt, dass bei einem Teil der monatlichen Eingänge Unstimmigkeiten auftreten, welche eine zusätzliche manuelle Pflege in Excel-Tabellen erforderlich machen. Dabei müssen beispielsweise fehlende Kostenstellen oder inkorrekte Steuersätze identifiziert werden. Diese Ausnahmefälle erfordern eine sorgfältige manuelle Klärung, da die korrekte Kontierung ohne direkte Bestellreferenz sonst nicht in SAP FI abgeschlossen werden kann.
[Turn 4] Agent: "Du hast vorhin von der Recherche bei fehlender Zuordnung gesprochen und jetzt die Kontierung ohne Bestellreferenz erwähnt — handelt es sich dabei um denselben Prozessschritt oder sind das unterschiedliche Vorgänge? Wie lange dauert im Vergleich dazu die Bearbeitung einer Standardrechnung, bei der alle Angaben direkt vorliegen?"

[Turn 5] Persona: Diese Vorgänge sind eng miteinander verknüpft, da die manuelle Recherche den ersten Schritt darstellt, um die für eine ordnungsgemäße Kontierung in SAP FI notwendigen Informationen überhaupt erst zu ermitteln. Eine Standardrechnung, bei der sämtliche Daten wie Kostenstellen oder Bestellbezüge direkt korrekt vorliegen, lässt sich hingegen zügig direkt erfassen und in DocuWare archivieren. Liegen hingegen Unstimmigkeiten vor, verlängert sich der Prozess zwangsläufig, da die Bereinigung der Fehler sowie die zusätzliche manuelle Pflege in Excel-Listen für die korrekte Verbuchung unerlässlich sind.
[Turn 5] Agent: "Wie hoch ist der Anteil der Rechnungen, bei denen du aufgrund fehlender Daten oder Unstimmigkeiten manuell eingreifen musst, im Vergleich zum Gesamtvolumen?"

[Turn 6] Persona: Für den Abschluss meiner Erläuterungen zu diesem Sachverhalt sei erwähnt, dass etwa fünf Prozent aller monatlich eingehenden Rechnungen solche Unstimmigkeiten aufweisen. In diesen Fällen müssen abweichende Rechnungsbeträge, fehlende Kostenstellen oder fehlerhafte Mehrwertsteuersätze identifiziert und korrigiert werden. Diese manuelle Nacharbeit ist zwingend erforderlich, um eine fehlerfreie Verbuchung im System zu gewährleisten.
[Turn 6] Agent: "Du nutzt für die Bearbeitung E-Mail, Excel, SAP FI und DocuWare — wie oft musst du bei einer Standardrechnung zwischen diesen Systemen hin- und herwechseln?"

[Turn 7] Persona: Bei einer Standardrechnung ohne Unstimmigkeiten ist der Wechsel zwischen den Systemen minimal, da der Workflow direkt vom E-Mail-Client zur Erfassung in SAP FI und der abschließenden Archivierung in DocuWare führt. Die Nutzung von Excel entfällt in diesen reibungslosen Fällen vollständig, da keine manuellen Korrekturen oder Ad-hoc-Auswertungen vorgenommen werden müssen. Somit bleibt der Systemwechsel auf die drei Kernanwendungen beschränkt, die für den regulären Buchungsvorgang vorgesehen sind.
[Turn 7] Agent: "Wie viele Minuten benötigst du im Durchschnitt für die Erfassung und Archivierung einer solchen Standardrechnung, bei der alle Daten korrekt vorliegen?"

[Turn 8] Persona: Beim regulären Erfassungsprozess einer fehlerfreien Rechnung lässt sich keine exakte Minutenanzahl für den Einzelfall definieren, da dies von der Komplexität des Belegs und der Systemgeschwindigkeit abhängt. Sobald die Daten vollständig vorliegen und keine Rückfragen erforderlich sind, erfolgt die Erfassung in SAP FI sowie die anschließende Archivierung in DocuWare jedoch zeitnah. Mein Ziel ist es stets, den Workflow für diese Standardfälle so effizient wie möglich zu gestalten, um die Gesamtdauer des Durchlaufs gering zu halten.
[Turn 8] Agent: "Wie lange dauert die Erfassung und Archivierung einer solchen Standardrechnung grob — eher wenige Minuten oder eher eine Viertelstunde?"

[Turn 9] Persona: Für die Erfassung und Archivierung einer Standardrechnung ohne Klärungsbedarf veranschlage ich üblicherweise wenige Minuten pro Vorgang. Da bei diesen Belegen keine manuellen Recherchen oder Excel-Nacharbeiten anfallen, kann ich die Daten direkt in SAP FI übertragen und den Prozess in DocuWare abschließen. Diese zügige Abwicklung stellt sicher, dass ich das monatliche Volumen effizient bewältigen kann.
[Turn 9] Agent: "Lassen wir das so stehen. Gibt es bei der Erfassung und Archivierung der Rechnungen feste, klar definierte Regeln und Vorgaben, denen du immer folgst, oder triffst du dabei oft eigene Entscheidungen?"

[Turn 10] Persona: Die Bearbeitung folgt fest definierten Richtlinien, insbesondere bei der Kontrolle von Lieferant, Summe und Leistungszeitraum. Wenn der Rechnungsbetrag einen Schwellenwert von 5.000 EUR überschreitet, ist gemäß unserer Vorgaben zwingend eine zusätzliche Freigabe einzuholen. Eigene Entscheidungen treffe ich lediglich im Rahmen der manuellen Recherche und bei der Fehlerkorrektur, falls Unstimmigkeiten bei der Kontierung oder den Stammdaten auftreten.
[Turn 10] Agent: "Wie sieht der Prozess aus, wenn eine Rechnung die Grenze von 5.000 EUR überschreitet und die zusätzliche Freigabe eingeholt werden muss — welche Schritte sind dafür konkret erforderlich?"

[Turn 11] Persona: Bei einer Rechnung, deren Betrag die Grenze von 5.000 EUR überschreitet, leite ich nach der initialen Kontrolle der Stammdaten und des Leistungszeitraums den Freigabeprozess ein. Sobald dieser notwendige Prozessschritt abgeschlossen ist und die explizite Bestätigung vorliegt, erfasse ich den Beleg in SAP FI und überführe ihn zur dauerhaften Ablage in DocuWare. Dieser zusätzliche Schritt stellt sicher, dass alle hochpreisigen Eingangsrechnungen stets einer formell korrekten Prüfung unterzogen werden.
[Turn 11] Agent: "Du hast eingangs erwähnt, dass du auch für die monatlichen Abschlussarbeiten zuständig bist — welche konkreten Schritte gehören hier zu deinem Aufgabenbereich?"

[Turn 12] Persona: Für den Abschluss sind verschiedene Schritte erforderlich, bei denen ich sämtliche offenen Posten systematisch abgleiche und die notwendigen Rückstellungen im System verbuche. Im Rahmen dieser Arbeiten müssen zudem die Daten aufbereitet und an das Controlling übermittelt werden. Da Sonderfälle und Ausnahmen regelmäßig eine zusätzliche Pflege in Excel-Tabellen erfordern, nimmt dieser Prozess insgesamt etwa zwei bis drei Tage in Anspruch.
[Turn 12] Agent: "[update_walkthrough_data(
    step_title="Monatsabschluss",
    process_steps=["Offene Posten abgleichen", "Rückstellungen verbuchen", "Daten für Controlling aufbereiten", "Zusätzliche Excel-Pflege bei Sonderfällen"],
    friction_points=["Sonderfälle und Ausnahmen erfordern zusätzliche Excel-Pflege"],
    friction_tools=["Excel"]
)]

Wie oft im Monat nimmst du dir diese zwei bis drei Tage für die Abschlussarbeiten?"

[Turn 13] Persona: Die Durchführung der Abschlussarbeiten findet turnusgemäß einmal pro Monat statt, um die finanziellen Kennzahlen korrekt abzubilden. In diesem Zeitraum arbeite ich intensiv an der Bereinigung der offenen Posten und der Verbuchung der Rückstellungen. Da diese Phase mit einem hohen Zeitdruck verbunden ist, bündele ich die Aufgaben konsequent, um die Daten fristgerecht an das Controlling zu übermitteln.
[Turn 13] Agent: "Bei wie vielen der monatlichen Abschlüsse treten diese Sonderfälle auf, die eine manuelle Excel-Pflege erfordern, und wie viele verschiedene Systeme musst du dafür parallel öffnen?"

[Turn 14] Persona: Hinsichtlich der Sonderfälle ist anzumerken, dass diese in jedem monatlichen Abschluss auftreten und eine manuelle Pflege in Excel unabdingbar machen. Um diese Unstimmigkeiten zu beheben und die entsprechenden Auswertungen zu erstellen, arbeite ich parallel mit den Anwendungen SAP FI und Excel. Diese Kombination ermöglicht es mir, die erforderlichen Korrekturen außerhalb des Buchungssystems vorzunehmen, bevor die finale Datenübermittlung an das Controlling erfolgen kann.
[Turn 14] Agent: "Wie hoch schätzt du den Anteil der Datensätze ein, die bei diesen Abschlussarbeiten aufgrund der Sonderfälle manuell in Excel nachbearbeitet werden müssen, und welche Anhaltspunkte oder Signale im System führen dich zu der Entscheidung, dass hier eine manuelle Korrektur notwendig ist?"

[Turn 15] Persona: Bei der Aufarbeitung zum Monatsabschluss ist der Anteil der Datensätze, die eine manuelle Nachpflege in Excel erfordern, zwar nicht in einer festen Kennzahl definiert, jedoch ist dies ein regelmäßiger Bestandteil meiner Tätigkeit. Ausschlaggebend für die Entscheidung zur manuellen Korrektur sind systemseitige Unstimmigkeiten oder Abweichungen, die eine direkte Verbuchung in SAP FI blockieren oder eine gesonderte Aufbereitung für das Controlling notwendig machen. Ich erkenne den Bedarf für diesen zusätzlichen Schritt immer dann, wenn die Datenintegrität bei den offenen Posten oder Rückstellungen durch Sonderfälle beeinträchtigt ist.
[Turn 15] Agent: "Hängt der Abschluss von Zuarbeiten anderer Abteilungen ab, bevor du mit der Bereinigung der offenen Posten beginnen kannst, oder liegen dir alle notwendigen Daten direkt vor?"

[Turn 16] Persona: Beim Monatsabschluss bin ich auf die fristgerechte Zuarbeit verschiedener Fachabteilungen angewiesen, da mir nicht alle Informationen für die Rückstellungsbildung oder die Klärung offener Posten eigenständig vorliegen. Sollten Daten fehlen oder Unstimmigkeiten in den Kostenstellen vorliegen, muss ich aktiv auf die entsprechenden Auftraggeber zugehen, um die erforderlichen Informationen einzuholen. Erst nach Erhalt dieser Angaben kann ich die Bereinigung vornehmen und die Daten schließlich konsolidiert an das Controlling weiterleiten.
[Turn 16] Agent: "Wie oft musst du während der zwei bis drei Tage Abschlussarbeiten zwischen den Systemen und den Kommunikationskanälen zu den Fachabteilungen wechseln, um diese Informationen einzuholen?"

[Turn 17] Persona: Im Rahmen des Monatsabschlusses ist ein häufiger Wechsel zwischen SAP FI, den Excel-Tabellen und verschiedenen Kommunikationskanälen für Rückfragen bei den Fachabteilungen unvermeidlich. Die Intensität dieses Austauschs korreliert dabei direkt mit der Anzahl der Sonderfälle, da ich bei fehlenden Kostenstellen oder unklaren Buchungsgrundlagen auf die Zuarbeit angewiesen bin, um die Datenintegrität wiederherzustellen. Da ich während dieser zwei bis drei Tage unter erheblichem Zeitdruck stehe, bündele ich diese Abstimmungen zwar weitestgehend, dennoch bleibt die systemübergreifende Kommunikation ein zentraler und zeitintensiver Bestandteil meines Arbeitsprozesses.
[Turn 17] Agent: "Wie gehst du vor, wenn die Zuarbeiten der Fachabteilungen nicht rechtzeitig bei dir eintreffen, und wie wirkt sich das auf deinen Zeitplan aus?"

[Turn 18] Persona: Wenn Zuarbeiten seitens der Fachabteilungen verzögert eintreffen, gerät der straffe Zeitplan für den Monatsabschluss unter erheblichen Druck. In diesen Fällen mahne ich die benötigten Informationen zeitnah an, um die offenen Posten und Rückstellungen doch noch fristgerecht für das Controlling aufbereiten zu können. Bleiben Rückmeldungen dennoch aus, muss ich diese Sonderfälle mitunter in meine Excel-Listen übernehmen, um den Abschluss vorläufig fertigzustellen und die fehlenden Daten in einer späteren Periode zu korrigieren.
[Turn 18] Agent: "Wenn du die Daten für den Abschluss von anderen Abteilungen anforderst, über welche Kanäle erfolgt dieser Austausch und wie oft musst du bei ausbleibenden Rückmeldungen nachhaken, bevor du die Daten in Excel für den vorläufigen Abschluss aufnimmst?"

[Turn 19] Persona: Der Austausch mit den Fachabteilungen erfolgt primär über den E-Mail-Client, um eine schriftliche Dokumentation der Klärungen sicherzustellen. Sollten die Rückmeldungen ausbleiben, hake ich in der Regel ein- bis zweimal aktiv nach, bevor ich die entsprechenden Sonderfälle aufgrund des hohen Zeitdrucks in meine Excel-Listen übernehme. Dieser Zwischenschritt ist notwendig, um die laufenden Abschlussarbeiten nicht zu gefährden und die Daten fristgerecht an das Controlling weitergeben zu können.
[Turn 19] Agent: "Welche weiteren regelmäßigen Aufgaben oder Prozesse fallen neben der Rechnungsbearbeitung und den Monatsabschlussarbeiten in deinen Verantwortungsbereich?"

[Turn 20] Persona: Darüber hinaus gehört der Mahnprozess zu meinen festen Verantwortlichkeiten, welcher monatlich anfällt. Diese Aufgabe ist mit einem hohen Zeitaufwand verbunden, da hierbei säumige Zahlungen verfolgt und die entsprechenden Mahnungen initiiert werden müssen. Bisher hatten wir jedoch im Rahmen unserer Gespräche noch nicht die Gelegenheit, diesen spezifischen Prozess näher zu beleuchten.
[Turn 20] Agent: "Wie viele Mahnungen versendest du durchschnittlich pro Monat und welche Systeme nutzt du dafür?"

[Turn 21] Persona: In Bezug auf den Mahnprozess ist zu sagen, dass ich diesen Vorgang monatlich durchführe, um ausstehende Zahlungen konsequent zu verfolgen. Dabei nutze ich primär SAP FI, um die entsprechenden Zahlläufe zu prüfen und die Mahnungen aus dem System heraus zu generieren. Da ich hierbei auf eine präzise Abwicklung angewiesen bin, beansprucht dieser Prozess eine beträchtliche Menge meiner monatlichen Arbeitszeit.
[Turn 21] Agent: "Wie viele Mahnungen versendest du bei diesem monatlichen Durchlauf etwa und wie viele Stunden investierst du insgesamt in diesen Prozess?"

[Turn 22] Persona: Wenn ich den Mahnprozess betrachte, lässt sich die genaue Anzahl der versendeten Mahnungen nicht auf eine feste Zahl festlegen, da diese monatlich je nach Zahlungsverhalten unserer Geschäftspartner variiert. Dementsprechend schwankt auch der zeitliche Aufwand, den ich in die Identifizierung säumiger Posten und die manuelle Aufbereitung der Mahnschreiben investieren muss. Da diese Aufgabe den Einsatz in SAP FI erfordert, ist die Bearbeitung insgesamt ein sehr zeitintensiver Bestandteil meines Aufgabenportfolios.
[Turn 22] Agent: "Wie viele Stunden investierst du in einer durchschnittlichen Woche für diesen Mahnprozess, und wie oft musst du dabei zwischen SAP FI und anderen Anwendungen oder Kommunikationskanälen wechseln?"

[Turn 23] Persona: Für den Mahnprozess lässt sich kein wöchentlicher Zeitaufwand in Stunden beziffern, da ich diesen Vorgang als monatliche Routine abwickle. Der Fokus liegt dabei auf der Prüfung der offenen Posten in SAP FI, wobei der systemübergreifende Austausch bei Unstimmigkeiten mit den Fachabteilungen oder Kunden über den E-Mail-Client erfolgt. Da ich diese Tätigkeit je nach aktuellem Zahlungsverhalten der Partner priorisiere, schwankt die Anzahl der notwendigen Wechsel zwischen den Anwendungen signifikant.
[Turn 23] Agent: "Nach welchen Kriterien entscheidest du, ob eine Mahnung tatsächlich versendet wird, und welche Ausnahmen führen dazu, dass eine Mahnung nicht automatisch generiert werden kann?

Wie hoch ist in etwa der Anteil der Fälle, bei denen der Mahnprozess aufgrund von Unstimmigkeiten manuell unterbrochen werden muss, und wie oft wechselst du dabei während des Mahnprozesses sowie bei den Abschlussarbeiten zwischen SAP FI, Excel und dem E-Mail-Client?"

[Turn 24] Persona: Die Entscheidung zum Mahnversand basiert auf einer Prüfung der überfälligen offenen Posten direkt in SAP FI, wobei strittige Sachverhalte oder laufende Klärungen einen automatischen Versand verhindern. In einem relevanten Anteil dieser Fälle ist eine manuelle Unterbrechung notwendig, um zu vermeiden, dass Mahnungen an Geschäftspartner trotz bestehender Unstimmigkeiten versendet werden. Während der Abschlussarbeiten und des Mahnprozesses wechsle ich regelmäßig zwischen SAP FI, dem E-Mail-Client und den zur Fehleranalyse notwendigen Excel-Tabellen, um die Datenkonsistenz sicherzustellen. Die genaue Häufigkeit dieser Systemwechsel korreliert dabei unmittelbar mit der Komplexität der Einzelfälle und dem Umfang der Rücksprachen mit den Fachabteilungen.
[Turn 24] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

[Turn 25] Persona: Neben den bereits ausführlich besprochenen Aufgaben nimmt der Abgleich sämtlicher offener Posten einen festen Platz in meinem Arbeitsalltag ein. Dabei übermittle ich die aufbereiteten Daten regelmäßig an das Controlling, um eine transparente Finanzübersicht zu gewährleisten. Ergänzend dazu verbuche ich fortlaufend Rückstellungen, um die finanzielle Genauigkeit innerhalb der Buchhaltung stets aufrechtzuerhalten.
[Turn 25] Agent: "Danke für deine Zeit und die detaillierten Einblicke in deine Arbeitsabläufe. Damit habe ich alle für mich relevanten Informationen erhalten. Ich wünsche dir noch einen produktiven Tag."

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| rechnungsbearbeitung | done | 90 ✓ | 3 ✓ | Die Bearbeitung folg ✓ | E-Mail-Client,SAP FI ✓ | 5 ✓ | 3 ✓ |
| monatsabschluss | walkthrough | 1 ✓ | 1200 ✓ | sämtliche offenen Po ✓ | SAP FI,Excel,E-Mail- ✓ | 100 ✓ | null |
| mahnwesen | walkthrough | 1 ✓ | null ✓ | null | SAP FI ✓ | null | null |
