---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
eval_date: 2026-06-01
persona: buchhalter
interview_id: ed1bbc47-2ee6-4aac-8c6e-2b2ae70e36d8
eval_run_id: 38a40391-6d8c-4bb7-8551-87e7ec836d54
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/ed1bbc47-2ee6-4aac-8c6e-2b2ae70e36d8
turns_total: 23
status: PASS
baseline_label: null
scores:
  slot_coverage: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.78
  completion_correctness: true
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.78 | maximize |
| completion_correctness | true | true |

## Gesprächsverlauf

[Turn 1] Persona: Es freut mich sehr, dass wir heute gemeinsam einen Blick auf meine täglichen Abläufe werfen. In meinem Arbeitsalltag liegt der Fokus vor allem auf der sorgfältigen Prüfung eingehender Rechnungen sowie der Durchführung des monatlichen Abschlusses, um eine korrekte Finanzberichterstattung zu gewährleisten. Dabei sorge ich für die notwendige Ordnung in unseren Systemen, indem ich Belege verifiziere, Buchungen vornehme und bei Unstimmigkeiten die erforderlichen Klärungen einleite.
[Turn 1] Agent: "Hallo Andreas, schön, dass du dir die Zeit nimmst. Unser Ziel heute ist es, deine täglichen Arbeitsabläufe genau zu verstehen und zu dokumentieren, damit dein wertvolles Praxiswissen festgehalten wird. Alles, was wir besprechen, wird vertraulich behandelt.

Um direkt einzusteigen: Wie sieht ein typischer Arbeitstag bei dir aus und mit welchen Aufgaben verbringst du die meiste Zeit?"

[Turn 2] Persona: Im Rahmen des operativen Tagesgeschäfts widme ich mich vorrangig der laufenden Rechnungsprüfung, bei der ich eingegangene Belege verifiziere, in unseren Systemen erfasse und die notwendige Archivierung sicherstelle. Wenn es auf das Ende eines Zeitraums zugeht, verlagert sich mein Schwerpunkt intensiv auf den Monatsabschluss, bei dem ich sämtliche Konten abstimme und notwendige Rückstellungen für die Übergabe an das Controlling bilde. Diese Aufgaben erfordern neben der eigentlichen Buchungstätigkeit auch ein hohes Maß an Sorgfalt bei der Klärung von Diskrepanzen oder fehlenden Informationen.
[Turn 2] Agent: "Lass uns mit der Rechnungsprüfung starten. Wie sieht hier der allererste Schritt aus, sobald eine neue Rechnung bei dir eingeht?"

[Turn 3] Persona: Wenn eine neue Rechnung bei mir elektronisch eintrifft, beginnt der Prozess mit der strukturierten Sichtung und einer ersten inhaltlichen Prüfung auf Vollständigkeit. Dabei gleiche ich die vorliegenden Informationen mit den Lieferantendaten sowie den vereinbarten Leistungszeiträumen ab, um die formale Korrektheit für die weitere Bearbeitung sicherzustellen. Erst nach dieser qualitativen Einordnung erfolgt die eigentliche Erfassung, wobei ich bei hohen Beträgen zwingend auf die Einhaltung der internen Freigaberegeln achte.
[Turn 3] Agent: "Du hast die strukturierte Sichtung und erste inhaltliche Prüfung beschrieben. Welche Systeme oder Programme nutzt du für diese Sichtung und den Abgleich, und wie gehst du dabei genau vor?"

[Turn 4] Persona: Für die Bearbeitung greife ich auf ein System für die Dokumentenablage zurück, um die Rechnung einzusehen, während ich gleichzeitig das Buchhaltungssystem für den Abgleich und die finale Verbuchung nutze. Mein E-Mail-Programm dient mir dabei als primäre Eingangsquelle für die Belege. Sollten mir bei der Prüfung Informationen fehlen, wie etwa eine Bestellreferenz oder eine korrekte Kostenstelle, ziehe ich weitere interne Systeme zur Recherche hinzu, um die Unstimmigkeiten zu klären.
[Turn 4] Agent: "Nachdem die Rechnung gesichtet und abgeglichen wurde, hast du die "eigentliche Erfassung" erwähnt. Wie läuft diese Erfassung im Buchhaltungssystem genau ab?"

[Turn 5] Persona: Die Erfassung erfolgt direkt in unserer Buchhaltungssoftware, in die ich die validierten Daten wie Beträge und Leistungszeiträume übertrage. Sobald der Vorgang systemseitig erfasst ist, verknüpfe ich den Beleg mit der entsprechenden Ablage, um eine lückenlose Dokumentation zu gewährleisten. Bei hohen Beträgen schließt sich an diesen Schritt zwingend eine Zweit-Freigabe an, bevor der Prozess für diese Rechnung vollständig abgeschlossen ist.
[Turn 5] Agent: ""

[Turn 6] Persona: Beim Monatsabschluss beginne ich mit der systematischen Abstimmung sämtlicher offener Posten, um eine saubere Datenbasis für die weiteren Schritte zu schaffen. Im Anschluss daran verbuche ich notwendige Rückstellungen, wobei ich auftretende Ausnahmen oftmals in eine separate Liste übertragen muss, da diese sich nicht direkt im Hauptsystem abbilden lassen. Abschließend bereite ich die Daten für die Übergabe an das Controlling auf, wobei der enge Zeitrahmen eine sehr konzentrierte Arbeitsweise erfordert.
[Turn 6] Agent: ""

[Turn 7] Persona: Für den monatlichen Mahnprozess ist es notwendig, regelmäßig die ausstehenden Forderungen zu sichten und die entsprechenden Mahnläufe anzustoßen. Dabei prüfe ich jeden Fall individuell, um sicherzustellen, dass nur berechtigte Mahnungen versendet werden, was einen nicht unerheblichen Zeitaufwand pro Monat bedeutet. Diese Tätigkeit ist ein fester Bestandteil meiner Aufgaben, um die Liquidität unseres Unternehmens kontinuierlich zu sichern.
[Turn 7] Agent: "Wie viele Rechnungen sichtest und prüfst du ungefähr pro Monat, und wie viel Zeit nimmt diese erste Sichtung und inhaltliche Prüfung pro Rechnung im Schnitt in Anspruch?"

[Turn 8] Persona: Grundsätzlich bearbeite ich in einem regulären Monat zwischen 80 und 100 Rechnungen. Die Dauer der ersten Sichtung und Prüfung variiert dabei stark, da insbesondere fehlende Bestellreferenzen, die eine manuelle Suche in drei verschiedenen Systemen erfordern, pro Woche etwa eine Stunde meiner Zeit in Anspruch nehmen. Die meisten Rechnungen lassen sich zügig validieren, doch bei den auftretenden Unstimmigkeiten, etwa durch falsche Steuersätze oder Betragsdifferenzen, steigt der Zeitaufwand für die notwendige Klärung entsprechend an.
[Turn 8] Agent: "Du hast „zwischen 80 und 100 Rechnungen“ gesagt — welcher Wert trifft es besser für einen typischen Monat? Und wie viele Minuten nimmst du dir im Durchschnitt für die Sichtung und inhaltliche Prüfung einer einzelnen, fehlerfreien Rechnung?"

[Turn 9] Persona: In der Praxis pendelt sich das monatliche Volumen eher am oberen Ende des genannten Bereichs ein, da unser Geschäft einen stetigen Zufluss an Belegen aufweist. Die Sichtung einer standardmäßigen, fehlerfreien Rechnung nimmt im Durchschnitt etwa fünf Minuten in Anspruch, sofern alle notwendigen Informationen sofort zur Verfügung stehen. Sollte es jedoch zu Unstimmigkeiten bei den Details kommen, verlängert sich diese Bearbeitungszeit aufgrund der erforderlichen Klärungsschritte entsprechend.
[Turn 9] Agent: "Gibt es bei dieser Sichtung und inhaltlichen Prüfung feste Regeln, nach denen du entscheidest, ob eine Rechnung korrekt ist, oder erfordert das oft deine persönliche Einschätzung?"

[Turn 10] Persona: Bei der Rechnungsprüfung folge ich klaren internen Richtlinien, die sowohl die formale Vollständigkeit als auch die inhaltliche Übereinstimmung mit unseren Lieferantendaten und Leistungszeiträumen definieren. Dennoch erfordert meine langjährige Erfahrung häufig eine persönliche Einschätzung, insbesondere wenn Unstimmigkeiten wie fehlende Kostenstellen oder abweichende Beträge auftreten, die eine manuelle Klärung notwendig machen. Die strikte Einhaltung der Freigabegrenzen bei höheren Beträgen stellt dabei einen festen, nicht verhandelbaren Rahmen dar, der meine Entscheidungsgrundlage ergänzt.
[Turn 10] Agent: "Das hilft mir sehr, danke. Kommen wir zum nächsten Schritt, der Erfassung und Verbuchung im Buchhaltungssystem. 

Wie viele Minuten benötigst du im Schnitt für die reine Erfassung und Verbuchung einer Rechnung, und läuft dieser Schritt komplett regelbasiert ab?"

[Turn 11] Persona: Bei der Erfassung und Verbuchung im SAP FI wende ich im Durchschnitt etwa zehn Minuten für den eigentlichen Vorgang auf, sofern die Daten vollständig vorliegen. Der Prozess folgt zwar strikten buchhalterischen Regeln, erfordert jedoch aufgrund der eingangs erwähnten Diskrepanzen, die bei etwa fünf Prozent der Belege auftreten, immer wieder eine manuelle Intervention. Diese Ausnahmen, wie etwa die Zuweisung korrekter Kostenstellen, können den Zeitaufwand pro Rechnung deutlich erhöhen, da hier die bloße Systemlogik nicht ausreicht.
[Turn 11] Agent: ""

[Turn 12] Persona: In Bezug auf den Monatsabschluss nimmt dieser Prozess insgesamt zwei bis drei Tage intensiver Arbeit in Anspruch, da ich sämtliche Konten abstimmen und Rückstellungen bilden muss. Da sich bestimmte Ausnahmen nicht direkt im SAP FI abbilden lassen, bin ich darauf angewiesen, diese manuell in Excel nachzupflegen. Diese Kombination aus der Arbeit im Buchhaltungssystem und der ergänzenden Tabellenkalkulation ist für mich der übliche Weg, um den Abschluss fristgerecht an das Controlling zu übergeben.
[Turn 12] Agent: ""

[Turn 13] Persona: Angesichts des monatlichen Mahnprozesses lässt sich festhalten, dass ich regelmäßig Zeit für die Identifikation überfälliger Forderungen einplane. Da ich hierbei jeden Einzelfall individuell bewerte, variiert der monatliche Zeitaufwand je nach Anzahl der säumigen Zahler deutlich. Diese Aufgabe erfordert eine präzise Abstimmung mit den Daten aus unserem Buchhaltungssystem, um sicherzustellen, dass unser Mahnwesen stets den aktuellen Stand der Liquidität widerspiegelt.
[Turn 13] Agent: "Du hast erwähnt, dass der Monatsabschluss insgesamt zwei bis drei Tage dauert. Wie viel Zeit entfällt davon konkret auf die „Abstimmung offener Posten“, und welche Datenquellen nutzt du dafür?"

[Turn 14] Persona: Während dieser zwei bis drei Tage nimmt die Abstimmung der offenen Posten in SAP FI einen signifikanten Anteil der Zeit in Anspruch, da sie das Fundament für alle weiteren Buchungsschritte bildet. Als Datenquellen ziehe ich primär die entsprechenden Auswertungen aus unserem Buchhaltungssystem heran, um Soll- und Haben-Stände detailliert abzugleichen. Gegebenenfalls ergänze ich diese Informationen um die vorliegenden Rückstellungslisten in Excel, um eine vollständige Übereinstimmung der Konten vor der Übergabe an das Controlling zu gewährleisten.
[Turn 14] Agent: "Du hast erwähnt, dass diese Abstimmung einen signifikanten Teil der zwei bis drei Tage einnimmt. Wie viele Stunden oder Tage verbringst du typischerweise konkret mit der Abstimmung der offenen Posten, und wie oft im Monat führst du diesen Schritt durch?"

[Turn 15] Persona: Die Abstimmung der offenen Posten nimmt innerhalb des gesamten monatlichen Abschlusses etwa eineinhalb bis zwei Tage in Anspruch. Diesen Prozess durchlaufe ich einmal pro Monat, wobei ich mich für die erforderliche Präzision intensiv auf die Daten aus SAP FI konzentriere. Die verbleibende Zeit des Abschlusszeitraums nutze ich dann für die Bildung von Rückstellungen und die manuelle Nachpflege der Excel-Listen, bevor die Daten an das Controlling übergeben werden.
[Turn 15] Agent: "Du hast "eineinhalb bis zwei Tage" für die Abstimmung der offenen Posten genannt — welcher Wert trifft es für einen typischen Monat besser, und wie viele Arbeitsstunden entspricht das bei dir? Und läuft dieser Abgleich komplett nach festen Regeln ab?"

[Turn 16] Persona: Üblicherweise nähere ich mich eher den zwei vollen Arbeitstagen an, was bei meiner üblichen Arbeitszeit etwa 16 Stunden entspricht, um die nötige Gründlichkeit zu gewährleisten. Während der Abgleich an sich durch feste buchhalterische Regeln und Soll-Haben-Vorgaben geprägt ist, erfordern die auftretenden Ausnahmen meine persönliche Einschätzung und manuelle Korrekturen. Da sich nicht jede Unstimmigkeit unmittelbar in SAP FI auflösen lässt, bin ich gezwungen, diese Abweichungen in Excel nachzuhalten, was den Prozess über das reine Regelwerk hinaus erweitert.
[Turn 16] Agent: "Nach der Abstimmung der offenen Posten folgt die Buchung von Rückstellungen. Wie viel Zeit benötigst du dafür typischerweise pro Monat, und welche Datenquellen nutzt du, um diese Rückstellungen zu berechnen?"

[Turn 17] Persona: Für die Bildung und Verbuchung der Rückstellungen veranschlage ich im Regelfall etwa einen halben Arbeitstag, also ungefähr vier Stunden. Als primäre Datenquellen dienen mir dabei die vorliegenden Verträge und Leistungsnachweise, welche ich mit den Informationen aus SAP FI abgleiche, um die Höhe der notwendigen Rückstellungen präzise zu ermitteln. Da diese Berechnungen oftmals komplexe Sachverhalte betreffen, ergänze ich die Daten bei Bedarf durch Berechnungen in Excel, um die Beträge konsistent für den Monatsabschluss aufzubereiten.
[Turn 17] Agent: "Wie läuft die Datenübergabe an das Controlling genau ab? Wie viel Zeit benötigst du dafür monatlich, und welche Datenquellen nutzt du, um die Daten aufzubereiten?"

[Turn 18] Persona: Nach der finalen Abstimmung und den durchgeführten Rückstellungsbuchungen bereite ich die Daten auf, was mich monatlich etwa zwei bis vier Stunden an Arbeitszeit kostet. Ich exportiere hierfür die notwendigen Berichte aus SAP FI und führe diese mit meinen manuell geführten Excel-Auswertungen zusammen, um dem Controlling eine konsistente Übersicht zu liefern. Dieser Abschlussbericht dient als Grundlage für die weitere Analyse durch die Controlling-Abteilung und stellt sicher, dass sämtliche Geschäftsvorfälle des vergangenen Monats korrekt abgebildet sind.
[Turn 18] Agent: "Du hast „zwei bis vier Stunden“ für die Datenübergabe an das Controlling genannt — welcher Wert trifft es für einen typischen Monat besser, und läuft dieser Schritt komplett nach festen Regeln ab?"

[Turn 19] Persona: In einem typischen Monat sind es eher die vier Stunden, da die Zusammenführung der unterschiedlichen Datenquellen aufgrund der manuellen Excel-Bestände stets eine gewisse Sorgfalt erfordert. Zwar gibt es für die Aufbereitung der Berichte definierte Vorgaben, jedoch ist der Schritt keineswegs rein mechanisch, da die Plausibilisierung der Daten vor der Übergabe an das Controlling meine explizite Prüfung erfordert. Diese finale Konsolidierung ist entscheidend, um sicherzustellen, dass die manuell nachgepflegten Ausnahmen korrekt in das Gesamtbild einfließen.
[Turn 19] Agent: "Danke für die Präzisierung. 

Kommen wir zum Mahnprozess: Wie oft im Monat stößt du diese Mahnläufe an, und wie viel Zeit benötigst du dafür insgesamt pro Monat? Welche Systeme oder Datenquellen nutzt du dafür?"

[Turn 20] Persona: Hinsichtlich des Mahnwesens führe ich die Mahnläufe einmal monatlich durch, um unsere offenen Forderungen strukturiert zu bearbeiten. Hierfür investiere ich im Schnitt etwa vier bis sechs Stunden, wobei ich zur Identifikation der säumigen Zahler direkt auf die entsprechenden Berichte in SAP FI zurückgreife. Die abschließende Prüfung der einzelnen Mahnungen erfolgt dann durch mich individuell, um sicherzustellen, dass keine unberechtigten Mahnschreiben versendet werden.
[Turn 20] Agent: "Du hast „vier bis sechs Stunden“ gesagt — welcher Wert trifft es besser für einen typischen Monat?"

[Turn 21] Persona: In einem typischen Monat verbringe ich eher sechs Stunden mit dem Mahnwesen, da eine sorgfältige manuelle Sichtung jeder einzelnen Forderung notwendig ist, um Fehlmahnungen konsequent auszuschließen. Diese Zeit investiere ich, um den Status der offenen Posten in SAP FI präzise zu prüfen und die berechtigten Fälle für den Versand aufzubereiten. Eine gründliche Prüfung ist mir hierbei wichtiger als eine rein automatisierte Abarbeitung, um unsere Kundenbeziehungen nicht durch ungerechtfertigte Schreiben zu belasten.
[Turn 21] Agent: "Gibt es neben der Rechnungsprüfung, dem Monatsabschluss und dem Mahnprozess noch weitere Aufgaben, die regelmäßig anfallen, oder haben wir damit deinen gesamten Arbeitsbereich abgedeckt?"

[Turn 22] Persona: Mit den genannten Themen haben wir die wesentlichen Säulen meiner Tätigkeit in der Finanzbuchhaltung bereits sehr umfassend abgedeckt. Darüber hinaus fallen natürlich gelegentlich Ad-hoc-Auswertungen oder kurzfristige Anfragen an, die sich aus dem laufenden Geschäft ergeben und meine Aufmerksamkeit erfordern. Diese Aufgaben treten jedoch sporadisch auf und ordnen sich dem festen Rhythmus der periodischen Arbeiten unter. Insofern bilden die drei von uns besprochenen Prozesse den Kern meines Arbeitsalltags und beanspruchen den Großteil meiner zeitlichen Kapazitäten.
[Turn 22] Agent: "Vielen Dank, Andreas. Damit haben wir alle deine Kernprozesse sehr detailliert und strukturiert erfasst. Deine Angaben helfen uns enorm dabei, dein wertvolles Praxiswissen zu sichern. 

Ich wünsche dir noch einen erfolgreichen Arbeitstag!"

[Turn 23] Persona: Es war mir eine Freude, Ihnen diese Einblicke in meine tägliche Arbeit zu geben und die Abläufe gemeinsam transparent zu machen. Ich schätze es sehr, dass der Fokus auf einer fundierten Prozessanalyse liegt, um unsere täglichen Herausforderungen in der Finanzbuchhaltung besser adressieren zu können. Ich stehe Ihnen bei weiteren Rückfragen zu diesen oder anderen fachlichen Themen sehr gerne wieder zur Verfügung. Auch Ihnen wünsche ich einen produktiven und erfolgreichen Verlauf Ihres weiteren Tages.
[Turn 23] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung: Sichtung und inhaltliche Prüfung | done | 100 ✓ | 5 ✓ | false ✓ | E-Mail-Programm,Dokumentenabla ✓ | null | null |
| Rechnungsprüfung: Erfassung und Verbuchung | done | 100 ✓ | 10 ✓ | false ✓ | SAP FI ✓ | 5 ✓ | null |
| Monatsabschluss: Abstimmung offener Posten | done | 1 ✓ | 960 ✓ | false ✓ | SAP FI,Excel ✓ | null | null |
| Monatsabschluss: Datenübergabe an Controlling | done | 1 ✓ | 240 ✓ | false ✓ | SAP FI,Excel ✓ | null | null |
| Monatsabschluss: Buchung von Rückstellungen | done | 1 ✓ | 240 ✓ | false ✓ | Verträge,Leistungsnachweise,SA ✓ | null | null |
| Mahnprozess: Mahnläufe anstoßen | done | 1 ✓ | 360 ✓ | false ✓ | SAP FI ✓ | null | null |
