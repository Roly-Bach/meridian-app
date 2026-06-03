---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-01
persona: buchhalter
interview_id: c017a282-79f2-4337-9fdf-d6c61c98ac82
eval_run_id: 5a26b6bf-7057-4f11-a68e-268779b8c8aa
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/c017a282-79f2-4337-9fdf-d6c61c98ac82
turns_total: 25
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.1
  phase_adherence: 0.77
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.78
  completion_correctness: false
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.1 | maximize |
| phase_adherence | 0.77 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.78 | maximize |
| completion_correctness | false | true |

## Gesprächsverlauf

[Turn 1] Persona: Mein Arbeitsalltag ist geprägt von einer sorgfältigen buchhalterischen Überwachung, die bei der systematischen Bearbeitung eingehender Rechnungen beginnt und sich über komplexe Abschlussarbeiten erstreckt. Ich achte dabei besonders darauf, dass alle Vorgaben zur Freigabe und zur korrekten Kontierung eingehalten werden, um eine saubere Finanzbuchhaltung zu gewährleisten. Ergänzend dazu verbringe ich einen Teil meiner Zeit damit, Ausnahmefälle manuell aufzubereiten oder die Abstimmung offener Posten sicherzustellen, damit die Zusammenarbeit mit dem Controlling reibungslos verläuft.
[Turn 1] Agent: "Hallo Andreas. Schön, dass du dir die Zeit nimmst. Unser Ziel heute ist es, dein praktisches Prozesswissen aus deinem Arbeitsalltag strukturiert zu dokumentieren, damit dieses wichtige Wissen gesichert ist. Unser Gespräch wird vertraulich behandelt.

Wenn wir auf deinen typischen Arbeitstag blicken: Mit welcher deiner Hauptaufgaben startest du meistens, und wie sieht dabei der grobe Ablauf aus?"

[Turn 2] Persona: Bei der Bearbeitung eingehender Rechnungen beginne ich stets damit, das Dokument digital zu empfangen und im Anschluss den Lieferanten sowie den Rechnungsbetrag und den Leistungszeitraum einer eingehenden Prüfung zu unterziehen. Nach der erfolgreichen Kontierung erfasse ich den Vorgang im System, wobei ich bei Beträgen oberhalb festgelegter Wertgrenzen die notwendige Zweit-Freigabe durch einen Vorgesetzten einhole. Abschließend lege ich den Beleg zur revisionssicheren Archivierung ab, wobei mich Unregelmäßigkeiten wie fehlende Referenznummern oder Kontierungsfehler immer wieder vor manuelle Suchaufwände stellen.
[Turn 2] Agent: "Wir starten mit dem Prozess der Bearbeitung eingehender Rechnungen. 

Über welchen Kanal oder welches System empfängst du diese Rechnungen typischerweise digital?"

[Turn 3] Persona: Im Rahmen der täglichen Routine gehen die Rechnungen primär über unser E-Mail-Postfach ein, aus dem ich die Dateien zur weiteren Bearbeitung entnehme. Sobald die Belege digital vorliegen, werden sie für die manuelle Prüfung der Rechnungsdetails bereitgestellt, bevor sie für den nächsten Schritt in unserer Systemlandschaft vorbereitet werden. Diese digitale Eingangskanalsituation stellt sicher, dass alle Dokumente zentral erfasst und für den weiteren Kontierungsprozess direkt verfügbar sind.
[Turn 3] Agent: "Das ist verstanden. 

Wie genau übertragst du die Rechnungen aus dem E-Mail-Postfach in euer System für die weitere Bearbeitung – geschieht das manuell oder automatisiert?"

[Turn 4] Persona: Der gesamte Übertragungsprozess erfolgt derzeit manuell, da ich jedes Dokument aus dem E-Mail-Eingang einzeln entnehme und zur weiteren Verarbeitung in unsere internen Buchhaltungsanwendungen überführe. Dies erfordert von mir eine direkte Interaktion mit den Systemen, um die Daten manuell für die Buchung vorzubereiten und schlussendlich die revisionssichere Ablage sicherzustellen. Eine automatisierte Schnittstelle existiert für diesen Schritt bislang nicht, weshalb jede Rechnung meine persönliche Aufmerksamkeit bei der Überführung in die Fachsysteme erfordert.
[Turn 4] Agent: "Das manuelle Übertragen ist somit der erste feste Schritt in deinem Prozess.

In welches konkrete Buchhaltungssystem lädst du die Rechnungen dabei hoch?"

[Turn 5] Persona: Für die Erfassung und Verbuchung der Rechnungsdaten nutze ich SAP FI als zentrales Buchhaltungssystem. Sobald die inhaltliche Prüfung abgeschlossen ist, werden die Daten dort verbucht, um eine ordnungsgemäße Finanzbuchhaltung sicherzustellen. Parallel dazu erfolgt die Ablage der Dokumente in DocuWare, um die revisionssichere Archivierung der Eingangsbelege zu gewährleisten.
[Turn 5] Agent: "Verstanden, die zentralen Systeme sind SAP FI und DocuWare.

Welchen ersten Schritt machst du in SAP FI, sobald du eine Rechnung dort manuell erfasst?"

[Turn 6] Persona: Beim Einstieg in die Erfassung prüfe ich zunächst, ob eine gültige Bestellreferenz vorliegt, da diese für die korrekte Zuordnung zwingend erforderlich ist. Fehlt dieser Verweis auf dem Dokument, muss ich den Auftraggeber zeitaufwendig in den verschiedenen Systemen identifizieren, bevor die eigentliche Kontierung beginnen kann. Erst nach dieser Klärung nehme ich die sachliche Prüfung hinsichtlich des Leistungszeitraums und der rechnerischen Korrektheit vor, um eine valide Buchung sicherzustellen.
[Turn 6] Agent: "Das ist ein wichtiger Zwischenschritt.

Wie viel Zeit benötigst du typischerweise für diese Prüfung pro Rechnung, wenn eine Bestellreferenz vorhanden ist?"

[Turn 7] Persona: Für die Prüfung einer regulären Rechnung, bei der die Bestellreferenz vorhanden ist, veranschlage ich keine explizite Zeitdauer, da der Aufwand stark von der Vollständigkeit und der Eindeutigkeit der vorliegenden Informationen abhängt. Die Tätigkeit umfasst dabei die Validierung des Leistungszeitraums, der korrekten Kontierung und der Übereinstimmung der Beträge. Wenn alle Angaben korrekt sind, vollziehe ich die Buchung zügig, während jede Unstimmigkeit – wie eine fehlende Kostenstelle oder Differenzen beim Steuersatz – den Prozessablauf spürbar verlängert.
[Turn 7] Agent: "Ich verstehe, dass der Aufwand je nach Vollständigkeit der Angaben variiert.

Wie viele Minuten benötigst du für diese Prüfung im Durchschnitt für einen typischen, fehlerfreien Fall?"

[Turn 8] Persona: Wenn ich einen fehlerfreien Beleg bearbeite, bei dem alle Daten vollständig vorliegen, benötige ich für die reine Erfassung und Buchung im SAP FI System erfahrungsgemäß etwa fünf Minuten. Dies setzt voraus, dass keine Rückfragen an den Fachbereich notwendig sind und die Kontierung eindeutig aus dem Dokument hervorgeht. Bei Unregelmäßigkeiten oder fehlenden Informationen steigt dieser Zeitbedarf jedoch deutlich an, da ich die notwendigen Angaben dann erst mühsam in den Systemen recherchieren muss.
[Turn 8] Agent: "Für einen fehlerfreien Fall benötigen wir also etwa 5 Minuten. 

Wie viel Zeit nimmt dieser Schritt in Anspruch, wenn die Bestellreferenz fehlt und du manuell recherchieren musst?"

[Turn 9] Persona: Wenn die notwendige Bestellreferenz auf der Rechnung fehlt, entfällt der direkte Buchungsweg und ich muss mich auf die Suche nach dem Auftraggeber begeben. Diese manuelle Recherche über unsere verschiedenen Systeme hinweg erfordert in der Summe etwa eine Stunde pro Woche für alle betroffenen Belege. Die Dauer für die einzelne Rechnung erhöht sich dadurch spürbar, da ich die Informationen mühsam zusammenführen muss, bevor die eigentliche Kontierung überhaupt erfolgen kann.
[Turn 9] Agent: "Das ist ein erheblicher Mehraufwand.

Wie viele Minuten benötigst du für die manuelle Recherche bei einer einzelnen Rechnung ohne Bestellreferenz?"

[Turn 10] Persona: Für die Identifizierung eines fehlenden Auftraggebers bei einer einzelnen Rechnung investiere ich durchschnittlich etwa zehn bis fünfzehn Minuten. In diesem Zeitrahmen navigiere ich durch die verschiedenen Systeme, um die notwendigen Referenzinformationen manuell zusammenzutragen. Erst nach dieser zeitintensiven Klärung kann ich den regulären Buchungsvorgang im SAP FI einleiten.
[Turn 10] Agent: "Du hast „zehn bis fünfzehn Minuten“ gesagt — welcher Wert trifft es besser für einen typischen Fall?"

[Turn 11] Persona: In der Regel tendiere ich eher zu den fünfzehn Minuten, da die manuelle Recherche über verschiedene Systeme hinweg erfahrungsgemäß komplexer ist, als es der erste Blick vermuten lässt. Die notwendigen Informationen müssen meist mühsam in unterschiedlichen Datenbanken verknüpft werden, um eine belastbare Zuordnung sicherzustellen. Da diese Zeitspanne den Suchaufwand für einen einzelnen Fall am besten widerspiegelt, ist dies meine fundierte Einschätzung aus der täglichen Praxis.
[Turn 11] Agent: "Wir halten 15 Minuten für die manuelle Recherche fest.

Ab welchem Rechnungsbetrag greift die von dir erwähnte Wertgrenze, ab der du eine Zweit-Freigabe durch einen Vorgesetzten einholen musst?"

[Turn 12] Persona: Für Rechnungen, deren Betrag die Schwelle von 5.000 EUR überschreitet, ist gemäß unserer internen Richtlinien zwingend eine Zweit-Freigabe einzuholen. Dieser zusätzliche Schritt stellt sicher, dass für kostenintensivere Vorgänge ein vier-Augen-Prinzip gewahrt bleibt, bevor die finale Buchung im System abgeschlossen wird. Sobald diese Autorisierung durch den zuständigen Vorgesetzten vorliegt, kann ich den Beleg in die revisionssichere Ablage überführen.
[Turn 12] Agent: "Verstanden, die Grenze liegt bei 5.000 EUR.

Wie genau holst du diese Zweit-Freigabe vom Vorgesetzten ein?"

[Turn 13] Persona: Für die Einholung der Zweit-Freigabe sende ich den entsprechenden Beleg oder den digitalen Datensatz über unseren E-Mail-Verteiler direkt an die zuständige Führungskraft. Diese prüft den Vorgang inhaltlich und gibt mir per Rückmeldung das Signal, dass die Buchung in SAP FI freigegeben werden kann. Erst nach Erhalt dieser expliziten Bestätigung führe ich die finale Verbuchung im System durch und schließe die Bearbeitung durch die Ablage in DocuWare ab.
[Turn 13] Agent: "Das bedeutet, die Freigabe erfolgt per E-Mail außerhalb von SAP. 

Wie lange dauert es im Durchschnitt, bis du diese Freigabe-E-Mail vom Vorgesetzten zurückerhältst?"

[Turn 14] Persona: Die Dauer bis zum Erhalt der Freigabe-E-Mail lässt sich schwer pauschal festlegen, da sie stark von der aktuellen Arbeitsbelastung der jeweiligen Führungskraft abhängt. Üblicherweise erhalte ich die notwendige Rückmeldung innerhalb von ein bis zwei Arbeitstagen, was den Prozess in diesen Fällen entsprechend verzögert. Diese Wartezeit erfordert von mir eine sorgfältige Wiedervorlage der betroffenen Vorgänge, damit die Buchung in SAP FI zeitnah nach Erhalt der Bestätigung abgeschlossen werden kann.
[Turn 14] Agent: "Du hast „ein bis zwei Arbeitstage“ gesagt — welcher Wert trifft es besser für einen typischen Fall?"

[Turn 15] Persona: In der Mehrzahl der Fälle pendelt sich der Zeitraum bei zwei Arbeitstagen ein, da die Führungskräfte aufgrund ihrer eigenen Aufgaben nicht immer zeitnah auf meine Anfrage reagieren können. Dieser Rhythmus spiegelt die Realität unserer internen Abstimmungsschleifen am besten wider, weshalb ich diesen Wert als repräsentativ für den typischen Ablauf betrachte. Somit ist ein Zeitrahmen von zwei Tagen die verlässlichere Größe für meine Planung der Buchungsabschlüsse.
[Turn 15] Agent: "Wir halten zwei Arbeitstage für die Freigabe fest.

Wie viele Rechnungen bearbeitest du ungefähr pro Monat in diesem Prozess?"

[Turn 16] Persona: In einem durchschnittlichen Monat bearbeite ich ein Volumen von etwa achtzig bis einhundert Rechnungen. Diese Zahl schwankt zwar leicht je nach Auftragslage, bietet jedoch eine solide Basis für meine monatliche Planung. Auf dieser Grundlage verwalte ich den gesamten Durchlauf von der digitalen Entgegennahme bis zur revisionssicheren Archivierung im System.
[Turn 16] Agent: "Du hast „achtzig bis einhundert Rechnungen“ gesagt — welcher Wert trifft es besser für einen typischen Fall?"

[Turn 17] Persona: Ein Wert von einhundert Rechnungen ist für einen typischen Monat die realistischere Größe, an der ich meine Kapazitäten ausrichte. Dieses Volumen bildet die Grundlage für meine monatliche Planung und erlaubt es mir, die anfallenden Buchungsvorgänge verlässlich zu strukturieren. Da die Schwankungen je nach Auftragslage meist nach oben tendieren, orientiere ich mich bei der zeitlichen Kalkulation lieber an dieser oberen Marke.
[Turn 17] Agent: "Wir halten 100 Rechnungen pro Monat als repräsentativen Wert fest.

Neben der Rechnungsbearbeitung hast du die Abstimmung offener Posten erwähnt. Wie genau startest du diesen Prozess und welche Schritte gehören dazu?"

[Turn 18] Persona: Für den Abschluss greife ich auf die in SAP FI vorliegenden Daten zurück, um sämtliche offenen Posten einer sorgfältigen Abstimmung zu unterziehen. Dabei identifiziere ich notwendige Rückstellungen für noch nicht verbuchte, aber bereits leistungsmäßig erbrachte Vorgänge und bereite diese für die weitere Übergabe an das Controlling vor. Ergänzend dazu müssen regelmäßig anfallende Ausnahmen, die sich nicht direkt im System abbilden lassen, in einer Excel-Liste nachgepflegt werden, um ein vollständiges Bild der finanziellen Situation zu erhalten.
[Turn 18] Agent: "Für die Abstimmung der offenen Posten nutzt du also die Daten aus SAP FI und pflegst Ausnahmen in einer Excel-Liste nach. 

Wie genau gehst du bei diesem Abgleich Schritt für Schritt vor, sobald du die Daten aus SAP FI gezogen hast?"

[Turn 19] Persona: Wenn ich die Daten aus SAP FI exportiert habe, vergleiche ich diese zunächst mit den hinterlegten Buchhaltungsbelegen, um Übereinstimmungen und Differenzen bei den offenen Posten zu identifizieren. Anschließend nehme ich die notwendigen Buchungen von Rückstellungen vor, sofern Leistungen bereits erbracht, aber noch nicht vollständig erfasst wurden. Sämtliche Abweichungen oder Sonderfälle, die das System nicht automatisch abdeckt, übertrage ich manuell in meine Excel-Liste, bevor ich das Gesamtergebnis zur weiteren Prüfung an das Controlling übergebe.
[Turn 19] Agent: "Mit welchen Formeln oder Suchkriterien filterst du die SAP-Daten, um die Abweichungen für die Excel-Liste zu identifizieren?"

[Turn 20] Persona: Für die Identifizierung der Abweichungen nutze ich in der Regel keine komplexen Formeln innerhalb von SAP selbst, sondern vergleiche die exportierten Listen über manuelle Abgleiche der Buchungsperioden und Kontenstände. Ich achte hierbei primär auf Unstimmigkeiten zwischen den erwarteten Zahlungseingängen oder Rechnungsstellungen und dem tatsächlichen Status in SAP FI. Die Differenzen, die ich auf diesem Wege isoliere, übernehme ich anschließend in meine Excel-Arbeitsmappe, in der ich diese manuellen Ausnahmen zur finalen Abstimmung für das Controlling nachpflege.
[Turn 20] Agent: "Für diesen Abgleich in Excel nutzt du also den manuellen Vergleich der Buchungsperioden und Kontenstände. 

Welche konkreten Schritte führst du in Excel aus, um diese Differenzen für das Controlling aufzubereiten?"

[Turn 21] Persona: Im Zuge der Aufbereitung in Excel erfasse ich zunächst die identifizierten Differenzen aus dem Systemabgleich in einer übersichtlichen Tabelle, wobei ich die jeweiligen Sachverhalte und die betroffenen Konten detailliert aufschlüssele. Anschließend ergänze ich diese Liste um notwendige Kommentierungen oder Erläuterungen zu den Ausnahmen, damit das Controlling die Ursachen der Abweichungen unmittelbar nachvollziehen kann. Abschließend bereite ich die Datei so auf, dass sie eine lückenlose Abstimmung zum Monatsende ermöglicht und als verlässliche Grundlage für die weitere Berichterstattung dient.
[Turn 21] Agent: "Wie viel Zeit benötigst du für diesen gesamten Abstimmungs- und Aufbereitungsprozess in Excel typischerweise pro Monat?"

[Turn 22] Persona: Für den monatlichen Abschluss wende ich mich intensiv den Abstimmungsarbeiten zu, wobei der gesamte Prozess – von der Datenaufbereitung bis hin zur finalen Übergabe an das Controlling – einen Zeitraum von zwei bis drei Tagen einnimmt. Diese Phase ist geprägt von einer sehr dichten Arbeitsweise, da ich unter hohem Termindruck sämtliche offenen Posten und notwendige Rückstellungen konsolidieren muss. Der manuelle Aufwand in Excel ist dabei ein wesentlicher Bestandteil, um die im System nicht abgebildeten Ausnahmen sauber zu dokumentieren und für die Abschlussarbeiten vollständig aufzubereiten.
[Turn 22] Agent: "Du hast „zwei bis drei Tage“ gesagt — welcher Wert trifft es besser für einen typischen Fall?"

[Turn 23] Persona: Für den Abschluss setze ich in der Regel drei volle Arbeitstage an, da die manuelle Nachpflege der Ausnahmen in Excel in Kombination mit der Abstimmung der Konten sehr zeitintensiv ist. Dieser Zeitrahmen ermöglicht es mir, die notwendige Sorgfalt walten zu lassen, um eine korrekte Übergabe an das Controlling sicherzustellen. Da der Termindruck zum Monatsende hoch ist, kalkuliere ich lieber mit dieser oberen Grenze, um bei unerwarteten Diskrepanzen nicht in zeitliche Bedrängnis zu geraten.
[Turn 23] Agent: "Das ist ein erheblicher Zeitblock im Monatsabschluss.

Wie viele Stunden reiner Arbeitszeit verbringst du innerhalb dieser drei Tage konkret mit dem Abgleich und der Aufbereitung in Excel?"

[Turn 24] Persona: Im Rahmen der drei Tage, die ich für den gesamten Monatsabschluss veranschlage, entfällt ein Großteil der Zeit auf die manuelle Datenverarbeitung und die damit verbundene Dokumentation. Da die Abstimmung der Ausnahmen in Excel eine sehr detaillierte Überprüfung erfordert, verbringe ich täglich rund sechs Stunden mit dieser spezifischen Aufgabe. Über den gesamten Zeitraum von drei Tagen summiert sich dieser Aufwand somit auf etwa achtzehn Stunden, die ich ausschließlich in die Excel-Aufbereitung und die Abstimmung der offenen Posten investiere.
[Turn 24] Agent: "Das sind also rund 18 Stunden reine Arbeitszeit in Excel für diesen Schritt.

Gibt es neben der Rechnungsbearbeitung und der Abstimmung der offenen Posten noch eine weitere Hauptaufgabe, die deinen Arbeitsalltag prägt?"

[Turn 25] Persona: Für den monatlichen Mahnprozess wende ich ebenfalls eine beträchtliche Menge meiner Arbeitszeit auf, da dieser Vorgang mit einer hohen Detailtiefe verbunden ist. Hierbei verfolge ich systematisch alle überfälligen Forderungen nach, um die Liquidität unseres Hauses sicherzustellen. Da dies eine weitere zentrale Säule meiner Tätigkeit darstellt, erfordert sie eine fortlaufende Überwachung der Zahlungseingänge und eine konsequente Kommunikation mit den entsprechenden Geschäftspartnern.
[Turn 25] Agent: "Damit haben wir mit dem Mahnprozess ein drittes wichtiges Thema identifiziert. 

Wie sieht der erste Schritt aus, wenn du mit dem Mahnprozess startest?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung und -erfassung | walkthrough | 100 ✓ | 5 ✓ | null | null | null | null |
| Rechnungsprüfung und Kontierung | walkthrough | null | null | null | null | null | null |
| Rechnungsempfang und Erfassung | exploring | null | null | null | null | null | null |
| Abstimmung offener Posten | exploring | null | null | null | null | null | null |
| Eingangsrechnungen bearbeiten | exploring | null | null | null | null | null | null |
| Offene Posten abstimmen und aufbereiten | walkthrough | null | null | null | SAP FI,Excel ✓ | null | null |
| Rechnungsdetails prüfen und kontieren | walkthrough | null | 15 ✓ | null | null | null | null |
| Freigabeprozess (Zweitfreigabe ab 5.000 EUR) | exploring | null | null | null | null | null | null |
| Zweit-Freigabe einholen | exploring | null | null | null | null | null | null |
| Rechnungen digital empfangen und prüfen | exploring | null | null | null | null | null | null |
