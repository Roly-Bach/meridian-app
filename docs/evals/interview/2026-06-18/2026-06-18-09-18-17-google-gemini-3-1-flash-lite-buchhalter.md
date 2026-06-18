---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.1-flash-lite
analyst_thinking_budget: 2048
eval_date: 2026-06-18
persona: buchhalter
interview_id: 81f56b5b-fc9c-4522-8aca-31347b2049c1
eval_run_id: f578dcea-ae82-483c-a199-4ae13c116d97
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/81f56b5b-fc9c-4522-8aca-31347b2049c1
turns_total: 24
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.33
  dedup_slot_coverage: 0.33
  slot_coverage_pre_clarification: 0.33
  dedup_slot_coverage_pre_clarification: 0.33
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.51
  dialog_naturalness: 0.5
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 0
  hallucination_rate: 1
  confidence_trigger_rate: 0.06
  depth_score: 2
  depth_p1: 0
  depth_p2: 1
  depth_p3: 0
trail:
  total_writes: 61
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.54
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.33 | maximize |
| dedup_slot_coverage | 0.33 | maximize |
| slot_coverage_pre_clarification | 0.33 | maximize |
| dedup_slot_coverage_pre_clarification | 0.33 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.51 | ≥ 0.80 |
| dialog_naturalness | 0.5 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 0 | 1.0 |
| hallucination_rate | 1 | < 0.01 |
| confidence_trigger_rate | 0.06 | > 0.80 |
| depth_score | 2 | maximize |
| depth_p1 | 0 | — |
| depth_p2 | 1 | — |
| depth_p3 | 0 | — |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.54 | < 0.20 |


## Judge-Begründung

# Bewertung der Agent-Texte

## Begründung:

**Positive Aspekte:**
- Die Du-Form wird durchgehend konsequent eingehalten
- Der Eröffnungstext [1] ist gut strukturiert und erklärt transparent den Zweck des Interviews
- Die Übergänge zwischen Themen sind meist logisch und nachvollziehbar
- Die Fragen sind überwiegend konkret und zielgerichtet formuliert
- Grammatik und Satzbau sind korrekt

**Mängel und Probleme:**
- **Generische Floskeln**: "Das ist ein wichtiger Aspekt" [5], "Das ist ein wichtiger Hebel" [6], "Das ist ein sauberes Ende" [3], "Das klingt nach einem klaren Standardablauf" [2] – diese Wendungen wirken repetitiv und oberflächlich
- **Redundanz**: Die Texte [5] und [6] behandeln praktisch dieselbe Frage (Mahnprozess und Zeitaufwand), nur mit leicht unterschiedlicher Formulierung. Das wirkt wie ein Fehler oder mangelnde Kohärenz
- **Abrupte Ü

## Gesprächsverlauf

[Turn 1] Persona: Grundsätzlich umfasst mein Verantwortungsbereich in der Finanzbuchhaltung die tägliche Bearbeitung eingehender Rechnungen sowie die Durchführung des monatlichen Abschlusses. Mein Arbeitstag beginnt meist damit, die eingegangenen Belege zu sichten, die notwendigen fachlichen Kontrollen durchzuführen und diese anschließend in unsere Systeme zu überführen. Besonders bei komplexen Fällen, wie etwa Unstimmigkeiten bei Kostenstellen oder Beträgen, wende ich viel Zeit für die manuelle Klärung auf, um eine korrekte Verbuchung sicherzustellen.
[Turn 1] Agent: "Hallo Andreas. Ich möchte heute dein Wissen über die Abläufe in der Buchhaltung dokumentieren, damit wir die Prozesse besser verstehen und etwaige Hürden identifizieren können. Deine Angaben werden selbstverständlich vertraulich behandelt und dienen ausschließlich der Prozessanalyse.

Lass uns direkt einsteigen: Wenn du die tägliche Bearbeitung der eingehenden Rechnungen betrachtest, welcher konkrete Schritt steht bei dir ganz am Anfang, sobald ein Beleg auf deinem Tisch landet?"

[Turn 2] Persona: Sobald ein Beleg in unserem elektronischen Eingang eingeht, ist der erste Schritt der Abgleich zwischen dem Lieferanten, dem ausgewiesenen Rechnungsbetrag und dem zugehörigen Leistungszeitraum. Dabei muss ich prüfen, ob eine eindeutige Bestellreferenz vorliegt, da ich sonst manuell nach dem verantwortlichen Auftraggeber suchen muss. Erst nach dieser Verifizierung kann ich mit der formalen Buchung und der anschließenden digitalen Ablage fortfahren.
[Turn 2] Agent: "Das klingt nach einem klaren Standardablauf. Wie viele Rechnungen bearbeitest du im Durchschnitt pro Monat auf diese Weise?"

[Turn 3] Persona: Bei der Bearbeitung der monatlichen Eingangsrechnungen bewege ich mich in einem Volumen von etwa 80 bis 100 Vorgängen. Diese Menge bewältige ich regelmäßig im Rahmen der täglichen Aufgaben, wobei der Zeitaufwand durch die manuelle Nachforschung bei fehlenden Bestellreferenzen merklich beeinflusst wird.
[Turn 3] Agent: "Das ist eine klare Größenordnung. Wenn wir uns nun dem zweiten Teil deines Verantwortungsbereichs zuwenden: Welche konkreten Schritte durchläufst du beim monatlichen Abschluss, um die Buchhaltung für den Zeitraum zu schließen?"

[Turn 4] Persona: Beim Monatsabschluss besteht meine primäre Aufgabe darin, alle offenen Posten gewissenhaft abzustimmen und die notwendigen Rückstellungen zu buchen. Dabei ist es essenziell, Unstimmigkeiten oder Ausnahmen außerhalb der Standardbuchungen manuell zu erfassen, was die Nutzung zusätzlicher Tabellenkalkulationen erfordert. Abschließend bereite ich die Daten für die Übergabe an das Controlling auf, um eine konsistente Datenbasis für die weitere Unternehmensplanung zu gewährleisten.
[Turn 4] Agent: "Die manuelle Aufbereitung über Tabellen klingt nach einem zeitintensiven Teil des Abschlusses. Wie viele Arbeitstage beansprucht der gesamte Monatsabschluss bei dir im Schnitt?"

[Turn 5] Persona: Im Rahmen des Monatsabschlusses nimmt diese Tätigkeit einen intensiven Zeitraum von zwei bis drei Arbeitstagen in Anspruch. Da ich für die Abstimmung und die manuelle Pflege der Ausnahmen in unseren Tools verantwortlich bin, entsteht hierbei ein hoher Termindruck. Dieser Prozess erfordert höchste Sorgfalt, um eine reibungslose Übergabe an das Controlling sicherzustellen.
[Turn 5] Agent: "Das ist ein ordentlicher Zeitblock. Lass uns kurz zurück zur täglichen Rechnungsbearbeitung springen: Welche Hilfsmittel oder Programme nutzt du konkret, um die Belege aus dem elektronischen Eingang zu sichten und zu prüfen?"

[Turn 6] Persona: Für die tägliche Bearbeitung greife ich primär auf meinen E-Mail-Client zu, um die Dokumente zunächst zu empfangen und zu sichten. Nach der inhaltlichen Prüfung nehme ich die Verbuchung direkt im SAP FI vor und schließe den Vorgang durch die revisionssichere Ablage in DocuWare ab. Diese drei Systeme bilden das feste Fundament meiner täglichen Arbeit bei der Rechnungsprüfung.
[Turn 6] Agent: "Das ist ein eingespieltes Setup. Wie viel Zeit investierst du im Schnitt für die Bearbeitung einer einzelnen Rechnung, wenn die Bestellreferenz direkt vorliegt, und wie stark weicht das bei den Fällen ab, in denen du manuell nachforschen musst?"

[Turn 7] Persona: Wenn die Bestellreferenz direkt vorliegt, ist der Vorgang zügig abgeschlossen, wohingegen die manuelle Suche nach dem Auftraggeber bei fehlenden Angaben den Zeitaufwand pro Woche um etwa eine Stunde erhöht. Dieser zusätzliche Schritt in verschiedenen Systemen ist notwendig, da bei einer von zwanzig Rechnungen Diskrepanzen wie fehlende Kostenstellen oder falsche Steuersätze auftreten. Sobald Beträge eine bestimmte Grenze überschreiten, plane ich zudem stets Zeit für die erforderliche Zweit-Freigabe ein, um die korrekte Abwicklung sicherzustellen.
[Turn 7] Agent: "Das ist ein wichtiger Kontrollmechanismus. Wenn wir beim Monatsabschluss bleiben: Welche Datenquellen oder Berichte ziehst du als Input heran, um die Abstimmung der offenen Posten und die Rückstellungen überhaupt erst starten zu können?"

[Turn 8] Persona: Für den Abschluss ziehe ich primär die tagesaktuellen Saldenlisten sowie die offenen Posten aus SAP FI als zentrale Datenquelle heran. Diese Informationen gleiche ich anschließend mit den internen Rückstellungskonten ab, um festzustellen, welche Positionen noch manuell in Excel nachgepflegt werden müssen. Erst durch diese Kombination der systemgestützten Berichte und meiner manuellen Aufbereitung erhalte ich die nötige Transparenz für die finale Übergabe an das Controlling.
[Turn 8] Agent: "Das ist ein klassischer Abgleich. Wenn du diese Daten aus SAP und Excel zusammenführst: Gibt es dabei für dich einen Punkt, an dem du sagst, hier passieren am häufigsten Fehler, oder ist der Prozess durch die manuelle Aufbereitung eher stabil?"

[Turn 9] Persona: Wenn ich die Zahlen sehe und den Prozess betrachte, empfinde ich die manuelle Pflege der Ausnahmen in unseren Excel-Listen als fehleranfällig. Besonders bei hoher Arbeitsdichte am Monatsende steigt die Gefahr, dass manuelle Übertragungsfehler unterlaufen oder Positionen beim Abgleich übersehen werden. Da diese Schritte nicht vollständig in SAP FI automatisiert sind, bleibt die Datenintegrität in dieser Phase stark von meiner persönlichen Sorgfalt und konzentrierten Arbeitsweise abhängig.
[Turn 9] Agent: "Das ist ein nachvollziehbares Risiko bei der manuellen Datenpflege. Wie gelangen die Daten aus SAP FI in deine Excel-Tabellen – kopierst du diese Werte manuell oder nutzt du einen automatisierten Export?"

[Turn 10] Persona: Für die Überführung der Daten nutze ich in der Regel einen Export aus dem System, um die grundlegenden Zahlen in die Tabellen zu überführen. Diese Basisdaten müssen jedoch im Anschluss manuell um die spezifischen Ausnahmen ergänzt werden, da das System diese Sonderfälle nicht eigenständig abbildet. Somit ist der Transfer zwar technisch unterstützt, die eigentliche Aufbereitung der betroffenen Posten erfordert aber weiterhin meine manuelle Bearbeitung.
[Turn 10] Agent: "Das klingt nach einer klassischen Medienbrücke zwischen SAP und Excel. Wenn du diese Ausnahmen in Excel manuell ergänzt: Welche Kriterien oder Anhaltspunkte entscheiden für dich, ob eine Position als Ausnahme gilt und in deine Liste aufgenommen werden muss?"

[Turn 11] Persona: Für die Einstufung als Ausnahme achte ich insbesondere auf Unstimmigkeiten, die nicht den standardisierten Buchungsregeln in unserem System entsprechen. Dies betrifft beispielsweise fehlende Kostenstellen, Differenzen beim Betrag oder Abweichungen bei den hinterlegten Steuersätzen. Sobald ein Vorgang nicht unmittelbar dem Standardprozess folgt oder eine inhaltliche Klärung erfordert, wird dieser zur weiteren Bearbeitung und Überwachung in meine Excel-Liste aufgenommen.
[Turn 11] Agent: "Das ist eine klare Definition für Ausnahmen. Wenn du eine solche Unstimmigkeit – etwa eine fehlende Kostenstelle – identifizierst: Wie entscheidest du dann, welche Kostenstelle korrekt wäre, oder gibt es bestimmte Anhaltspunkte, an denen du dich bei der manuellen Klärung orientierst?"

[Turn 12] Persona: Bei der Klärung fehlender Kostenstellen wende ich mich direkt an den jeweiligen Auftraggeber oder den fachlich Verantwortlichen, um den korrekten Buchungskreis zu verifizieren. Ich nutze hierbei die vorliegenden Informationen aus dem E-Mail-Verkehr oder den ursprünglichen Bestellunterlagen als Referenzpunkt. Erst wenn die fachliche Zuordnung zweifelsfrei geklärt ist, ergänze ich die notwendigen Informationen, um die Rechnungsprüfung im SAP FI erfolgreich abzuschließen.
[Turn 12] Agent: "Das ist ein nachvollziehbarer Weg, um die fachliche Korrektheit sicherzustellen. Wenn du diese Klärung abgeschlossen hast und die Rechnungsprüfung im SAP FI beendest: Was ist das konkrete Ergebnis oder der Output dieses Schrittes, den du an die nächste Instanz übergibst?"

[Turn 13] Persona: Nach erfolgreicher Buchung im SAP FI ist der Vorgang dort als "gebucht" markiert und die digitalen Belege sind in DocuWare revisionssicher archiviert. Damit ist die Rechnung für die weitere Verarbeitung oder spätere Prüfungen in unserem System fest verankert. Die nächste Instanz greift dann auf diese transparenten und abgelegten Datensätze zu, um den Prozess final zu schließen oder die Zahlung auszulösen.
[Turn 13] Agent: "Das ist ein sauberes Ende für den Vorgang. Wenn wir zum Monatsabschluss zurückkehren: Nach welchem festen Schema entscheidest du eigentlich, ob eine Position eine Ausnahme ist, die zwingend in deine Excel-Liste muss?"

[Turn 14] Persona: Bei der Abgrenzung zwischen Standardfällen und Ausnahmen orientiere ich mich an der Konsistenz der Daten, die ich aus SAP FI ziehe. Sobald eine Position bei der Abstimmung der offenen Posten nicht eindeutig einem Rückstellungskonto zugeordnet werden kann oder zeitliche Diskrepanzen aufweist, stufe ich sie als Ausnahme ein. Diese Posten erfordern eine manuelle Überprüfung, da sie ohne eine detaillierte Aufbereitung in Excel das Risiko bergen, den Monatsabschluss zu verfälschen oder bei der Übergabe an das Controlling unklar zu bleiben.
[Turn 14] Agent: "Verstanden, die Unklarheit bei der Zuordnung ist also das Hauptkriterium für deine manuelle Liste. Bei der täglichen Rechnungsbearbeitung: Gibt es für diese Zweit-Freigabe bei hohen Beträgen eigentlich feste Wertgrenzen, ab denen du den Prozess anpassen musst, oder ist das eher fallbezogen?"

[Turn 15] Persona: Die Regel für die Zweit-Freigabe ist bei uns fest definiert und knüpft an eine Betragsgrenze von 5.000 EUR an. Sobald eine Rechnung diesen Schwellenwert erreicht oder überschreitet, reicht meine Einzelprüfung nicht mehr aus, um den Vorgang abzuschließen. In diesen Fällen ist zwingend eine zusätzliche Freigabe erforderlich, bevor der Beleg final in SAP FI verbucht und zur Zahlung freigegeben werden kann.
[Turn 15] Agent: "Das ist eine klare Grenze für die Freigabeprozesse. Wenn du die Excel-Liste mit den Ausnahmen für den Monatsabschluss fertiggestellt hast: Wie sieht das finale Ergebnis aus, das du an das Controlling weitergibst – ist das eine Datei oder ein Bericht direkt im System?"

[Turn 16] Persona: Für den Abschluss übergebe ich dem Controlling in der Regel eine zusammengeführte Excel-Datei, welche sowohl die systemgestützten Daten aus SAP FI als auch meine manuell aufbereiteten Ausnahmen enthält. Diese Datei dient als konsolidierte Übersicht für die weitere Planung, da sie alle bereinigten Sachverhalte abbildet, die das System alleine nicht korrekt darstellen könnte. Erst mit dieser finalen Aufbereitung ist die Datenbasis aus meiner Sicht ausreichend verifiziert, um eine verlässliche Entscheidungsgrundlage für das Unternehmen zu bieten.
[Turn 16] Agent: "Das ist eine wichtige Schnittstelle für das Controlling.

An welchen konkreten Anzeichen erkennst du beim Durchsehen der Saldenlisten sofort, dass eine Position eine manuelle Nachbearbeitung erfordert?"

[Turn 17] Persona: Für den Abschluss erkenne ich den Korrekturbedarf meist an Auffälligkeiten wie nicht plausiblen Salden auf den Rückstellungskonten oder ungeklärten, lang überfälligen Posten. Wenn die Summen in den Listen nicht mit den erwarteten Werten übereinstimmen oder Zeiträume nicht korrekt abgeschlossen wurden, signalisiert dies sofort einen manuellen Klärungsbedarf. Diese Abweichungen deuten für mich darauf hin, dass die Daten nicht ohne zusätzliche manuelle Aufbereitung in Excel an das Controlling übergeben werden können.
[Turn 17] Agent: "Das sind klare Indikatoren für die manuelle Prüfung. Welche Unterlagen oder Informationen sind neben der Rechnung selbst für dich als Input zwingend notwendig, um die fachliche Prüfung bei der täglichen Rechnungsbearbeitung erfolgreich abzuschließen?"

[Turn 18] Persona: Zur fachlichen Prüfung benötige ich in erster Linie die hinterlegte Bestellreferenz, um die Rechnung unmittelbar mit den Konditionen im System abgleichen zu können. Sollte diese Angabe fehlen, sind ergänzende Informationen aus der Kommunikation mit dem jeweiligen Auftraggeber oder sonstige vorliegende Dokumente zum Leistungsumfang erforderlich. Erst durch diese zusätzlichen Unterlagen kann ich die Korrektheit der Kostenstelle sowie des Leistungszeitraums verifizieren und die Prüfung erfolgreich im SAP FI zum Abschluss bringen.
[Turn 18] Agent: "Das ist ein nachvollziehbarer Input-Mix für die Prüfung. Gibt es zwischen der Verbuchung in SAP FI und der Ablage in DocuWare manuelle Schritte oder Medienbrüche, die den Prozess an dieser Stelle verlangsamen?"

[Turn 19] Persona: Grundsätzlich erfordert der Übergang zwischen der Buchung und der Ablage keine manuelle Zwischenschrittführung, da der Prozess in unserer Systemlandschaft technisch integriert ist. Eine Verlangsamung tritt lediglich auf, wenn der Beleg aufgrund von inhaltlichen Unstimmigkeiten nicht sofort verbucht werden kann und somit die Archivierung verzögert wird. Sobald jedoch alle Daten korrekt erfasst sind, lässt sich der Beleg unmittelbar in das Dokumentenmanagementsystem überführen, wodurch dieser Teil der Bearbeitung nahtlos ineinandergreift.
[Turn 19] Agent: "Das ist ein wichtiger Hinweis, dass die Systemintegration hier reibungslos funktioniert.

Gibt es beim Monatsabschluss eigentlich feste Abhängigkeiten zu anderen Abteilungen oder Personen, deren Zuarbeit du zwingend benötigst, bevor du mit deiner Abstimmung starten kannst?"

[Turn 20] Persona: Für den Abschluss bin ich auf die fristgerechte Zuarbeit aus verschiedenen Fachabteilungen angewiesen, da diese mir die nötigen Informationen zu ihren jeweiligen Kostenstellen und erbrachten Leistungen bereitstellen müssen. Diese Rückmeldungen bilden die essenzielle Grundlage für meine Abstimmung der Rückstellungskonten, ohne die ich die Vollständigkeit der Daten nicht gewährleisten kann. Erst wenn mir diese externen Informationen vollständig vorliegen, kann ich mit der eigentlichen Bereinigung der Ausnahmen in meiner Excel-Liste beginnen und den Prozess in Richtung Controlling vorantreiben.
[Turn 20] Agent: "Gibt es für diese Abstimmung der Rückstellungskonten eigentlich verbindliche interne Richtlinien oder eine Verfahrensanweisung, an die du dich bei der Einstufung der Posten halten musst?"

[Turn 22] Persona: Im Rahmen meiner laufenden Aufgaben stellt der monatliche Mahnprozess eine weitere, zeitlich bindende Tätigkeit dar, die wir bisher noch nicht explizit thematisiert haben. Dabei kontrolliere ich regelmäßig den Status der offenen Forderungen und veranlasse die entsprechenden Schritte gegenüber unseren Geschäftspartnern. Dies ist ein notwendiger Vorgang, um die Liquidität zu sichern, erfordert jedoch ebenfalls eine kontinuierliche Abstimmung mit den Daten aus unserem Finanzsystem.
[Turn 22] Agent: "Das ist ein wichtiger Aspekt für die Liquiditätssicherung. Wie oft im Monat führst du diesen Mahnprozess durch und wie viel Zeit nimmt er insgesamt in Anspruch?"

[Turn 23] Persona: Der Mahnprozess wird bei uns einmal pro Monat initiiert, um die ausstehenden Forderungen strukturiert zu bearbeiten. Da die Überprüfung der Zahlungseingänge und die anschließende Korrespondenz mit den säumigen Geschäftspartnern eine sehr sorgfältige Kontrolle erfordern, nimmt dieser Vorgang einen signifikanten Teil meiner Arbeitszeit in Anspruch. Aufgrund der notwendigen Abstimmung mit den Buchhaltungsdaten ist er als zeitintensiver Bestandteil in meinen monatlichen Arbeitszyklus integriert.
[Turn 23] Agent: "Das ist ein wichtiger Hebel für das Working Capital. Wie viele Stunden investierst du im Schnitt für diesen monatlichen Mahnprozess?"

[Turn 24] Persona: Wenn ich den zeitlichen Aufwand für den Mahnprozess betrachte, bindet dieser Vorgang monatlich einen festen Block von mehreren Arbeitsstunden. Die Dauer variiert dabei in Abhängigkeit von der Anzahl der säumigen Geschäftspartner, die im jeweiligen Monat eine direkte Korrespondenz erfordern. Da ich für die Liquiditätssicherung auf eine präzise Überprüfung der Zahlungseingänge angewiesen bin, investiere ich diese Zeit konsequent in die manuelle Aufbereitung und die gezielte Nachverfolgung der offenen Forderungen.
[Turn 24] Agent: "Notieren wir das als variabel.

Wir sind damit für heute durch. Vielen Dank für deine Zeit und die detaillierten Einblicke in deine tägliche Arbeit und die Abschlussvorgänge. Das hilft mir sehr dabei, den Prozess besser zu verstehen."

[Turn 25] Persona: Sehr gerne geschehen, ich freue mich, dass ich Ihnen einen fundierten Einblick in unsere Arbeitsabläufe in der Finanzbuchhaltung geben konnte. Es war mir wichtig, die Herausforderungen bei der manuellen Datenpflege und die Bedeutung der systemübergreifenden Abstimmungen transparent darzulegen. Falls sich bei der Auswertung Ihrer Aufzeichnungen noch weitere Rückfragen zu den genannten Prozessen ergeben, stehe ich Ihnen jederzeit für eine weiterführende Erläuterung zur Verfügung. Ich hoffe, diese Informationen unterstützen Sie bei der geplanten Prozessanalyse und tragen zu einer nachhaltigen Optimierung unserer Arbeitsweise bei.
[Turn 25] Agent: "Alles klar, Andreas. Vielen Dank für deine Zeit und die detaillierten Einblicke. Das war sehr aufschlussreich. Wir sind damit am Ende des Interviews. Einen schönen Arbeitstag noch."

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Monatsabschluss | walkthrough | undefined ✓ | undefined ✓ | null | Excel-Listen ✓ | undefined ✓ | null |
| Rechnungsbearbeitung | walkthrough | undefined ✓ | undefined ✓ | null | E-Mail-Verkehr,Beste ✓ | undefined ✓ | null |
