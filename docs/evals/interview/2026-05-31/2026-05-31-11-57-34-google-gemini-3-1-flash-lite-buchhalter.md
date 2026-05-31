---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-31
persona: buchhalter
interview_id: 2cee941e-400c-442f-9bdb-8ab5604e5ee3
eval_run_id: d3ad0b3e-d2ab-4ef0-8812-a257c03e5afe
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/2cee941e-400c-442f-9bdb-8ab5604e5ee3
turns_total: 25
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.39
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.72
  completion_correctness: false
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.39 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.72 | maximize |
| completion_correctness | false | true |

## Gesprächsverlauf

[Turn 1] Persona: Guten Tag, ich freue mich ebenfalls, dass wir gemeinsam eine Bestandsaufnahme meiner Tätigkeiten vornehmen. Meine Aufgaben konzentrieren sich primär auf die sorgfältige Bearbeitung und Verbuchung eingehender Eingangsrechnungen sowie die Durchführung der notwendigen Schritte zum jeweiligen Monatsabschluss. Ein typischer Arbeitstag erfordert dabei ein hohes Maß an Genauigkeit, um die finanzielle Korrektheit unserer Daten sicherzustellen und bei Unstimmigkeiten frühzeitig gegenzusteuern.
[Turn 1] Agent: "Hallo Andreas, danke für die Einblicke. Lass uns direkt in die Details gehen: Wie sieht der Ablauf bei der Prüfung einer Eingangsrechnung bei dir konkret aus, wenn sie auf deinem Tisch landet?"

[Turn 2] Persona: Ich fange damit an, die Rechnung zu prüfen, indem ich den Lieferanten, den Rechnungsbetrag sowie den Leistungszeitraum verifiziere, bevor ich die Buchung im System vornehme und das Dokument anschließend zur rechtssicheren Archivierung ablege. Sollte der Rechnungsbetrag einen festgelegten Schwellenwert überschreiten, leite ich den Vorgang zusätzlich für eine notwendige Zweit-Freigabe weiter. Gelegentlich stößt man dabei auf Unregelmäßigkeiten, etwa wenn eine Kostenstelle fehlt, der Mehrwertsteuersatz nicht korrekt ist oder Differenzen im Rechnungsbetrag vorliegen, die eine manuelle Klärung erfordern. Besonders zeitintensiv gestaltet sich zudem die Recherche bei Rechnungen, denen keine Bestellreferenz beigefügt ist, da ich hierbei in verschiedenen Systemen nach dem zuständigen Auftraggeber suchen muss.
[Turn 2] Agent: "Wie viele Eingangsrechnungen bearbeitest du im Durchschnitt pro Monat?"

[Turn 3] Persona: In der Regel bearbeite ich monatlich zwischen 80 und 100 Rechnungen, die über meinen E-Mail-Posteingang eingehen. Diese Menge erfordert eine strukturierte Arbeitsweise, um die verschiedenen Schritte bis zur finalen Ablage in DocuWare effizient abzuarbeiten. Abhängig vom Aufkommen der Belege ohne Bestellreferenz variiert dabei der zeitliche Aufwand für die notwendigen Recherchen im SAP FI.
[Turn 3] Agent: "Wie lange benötigst du im Schnitt für die Bearbeitung einer einzelnen Rechnung, vom Eingang bis zur Archivierung?"

[Turn 4] Persona: Die Zeitspanne für die vollständige Bearbeitung variiert stark und hängt maßgeblich von der Vollständigkeit der Unterlagen ab. Während standardisierte Vorgänge zügig im SAP FI gebucht und in DocuWare abgelegt sind, binden mich insbesondere Recherchen bei fehlenden Bestellreferenzen erheblich länger. Rechnet man diesen Rechercheaufwand über den Monat hinweg auf, investiere ich etwa eine Stunde pro Woche, nur um die zuständigen Auftraggeber in den verschiedenen Systemen ausfindig zu machen.
[Turn 4] Agent: "Du hast erwähnt, dass du für die Recherche bei fehlenden Bestellreferenzen etwa eine Stunde pro Woche benötigst — wie genau sieht dieser Rechercheprozess in den verschiedenen Systemen aus, wenn du keinen direkten Ansprechpartner auf der Rechnung findest?"

[Turn 5] Persona: Wenn eine Bestellreferenz fehlt, beginne ich damit, die vorliegenden Informationen systematisch abzugleichen, um den internen Auftraggeber zu identifizieren. Hierfür durchsuche ich nacheinander das E-Mail-Postfach, die Stammdaten im SAP FI sowie die Unterlagen in DocuWare, um Rückschlüsse auf den Leistungsempfänger zu ziehen. Dieser Prozess ist leider manuell sehr aufwendig, da ich die Informationen aus verschiedenen Quellen zusammenführen muss, um eine ordnungsgemäße Zuordnung für die Buchung zu gewährleisten.
[Turn 5] Agent: "Das klingt nach einem mühsamen Abgleich. Gibt es für diese Recherche bei fehlenden Bestellreferenzen eine feste interne Richtlinie, ab wann du den Vorgang beispielsweise an den Fachbereich zurückgibst, statt selbst weiterzusuchen?"

[Turn 6] Persona: Eine explizite, schriftlich fixierte Richtlinie für die Rückgabe an Fachbereiche existiert in dieser Form leider nicht. Ich wäge daher bei jeder Unstimmigkeit individuell ab, ob ich den Auftraggeber zeitnah selbst ermitteln kann oder ob ich den Beleg zur Klärung an die zuständigen Kollegen weiterleite. Da bei etwa fünf Prozent der Rechnungen Diskrepanzen auftreten, versuche ich zunächst aus Effizienzgründen eine interne Lösung, bevor ich den Prozess durch Rückfragen verlangsame.
[Turn 6] Agent: "Verstehe, du entscheidest das also situativ. Um ein vollständigeres Bild zu bekommen: Gibt es bei der Zweit-Freigabe, die du bei hohen Beträgen einleitest, einen festen Schwellenwert, ab dem dieser Schritt zwingend ausgelöst wird?"

[Turn 7] Persona: Die interne Richtlinie sieht vor, dass für alle Eingangsrechnungen mit einem Betrag von mehr als 5.000 EUR zwingend eine Zweit-Freigabe einzuholen ist. Dieser Prozess ist fest in unsere Prüfschritte integriert, um die finanzielle Kontrolle bei höheren Ausgabensummen zu gewährleisten. Ich leite den Beleg hierfür nach der ersten inhaltlichen Prüfung direkt an die zuständige Instanz weiter, bevor die abschließende Buchung im SAP FI erfolgt.
[Turn 7] Agent: "Danke für die Präzisierung. Wie oft kommt es im Monat vor, dass du eine solche Zweit-Freigabe bei Beträgen über 5.000 EUR anstoßen musst?"

[Turn 8] Persona: Diese spezifische Information zur monatlichen Häufigkeit der Zweit-Freigaben liegt mir in dieser detaillierten statistischen Auswertung aktuell nicht vor. Mein Fokus liegt bei diesen Vorgängen primär auf der korrekten Einhaltung der Freigaberichtlinie bei Überschreitung des Schwellenwertes, um die finanzielle Integrität sicherzustellen. Gerne kann ich bei Gelegenheit prüfen, ob ich diese Zahlen im Rahmen der kommenden Monatsabschlüsse genauer erfassen kann.
[Turn 8] Agent: "Das ist absolut verständlich, eine Schätzung reicht mir für den Moment völlig aus – wie oft kommt das in einem typischen Monat etwa vor, eher fünfmal oder eher zwanzigmal?"

[Turn 9] Persona: Da ich keine detaillierte Strichliste über die exakte Anzahl der Freigabevorgänge führe, möchte ich mich auf keine spezifische Zahl festlegen, um die Genauigkeit meiner Aussage nicht zu gefährden. Der Umfang schwankt monatlich stark, da er direkt von unserem aktuellen Projektgeschäft und den damit verbundenen Investitionsvolumina abhängt. Dennoch lässt sich sagen, dass ein mittlerer einstelliger Bereich eine realistischere Einschätzung darstellt als ein Wert im zweistelligen Bereich.
[Turn 9] Agent: "Verstehe, dann halten wir für die Zweit-Freigaben bei Beträgen über 5.000 EUR einen Wert von etwa 5 Fällen pro Monat als Schätzung fest.

Um den Prozess der Rechnungsprüfung noch besser einordnen zu können: Wie viele Minuten benötigst du im Schnitt für die Prüfung und Verbuchung einer einzelnen, unproblematischen Rechnung, wenn alle Daten vollständig vorliegen?"

[Turn 10] Persona: Wenn alle Informationen auf der Rechnung vollständig vorhanden sind und keine Unstimmigkeiten vorliegen, nimmt die Prüfung und anschließende Verbuchung in SAP FI inklusive der Archivierung in DocuWare erfahrungsgemäß etwa fünf Minuten in Anspruch. Dieser Zeitwert setzt sich aus der inhaltlichen Plausibilitätsprüfung des Leistungszeitraums und Betrags sowie der manuellen Eingabe in das Buchhaltungssystem zusammen. Da dieser Standardprozess keine weiteren Recherchen erfordert, ist er sehr effizient in meinen Arbeitsalltag integriert.
[Turn 10] Agent: "Das ist ein klarer Wert für den Standardfall. Nutzt du bei dieser Prüfung eigentlich eine schriftliche Prüfliste oder eine Checkliste im System, um sicherzugehen, dass alle Pflichtfelder wie Lieferant, Betrag und Leistungszeitraum korrekt erfasst sind?"

[Turn 11] Persona: Ich nutze für diese Prüfung keine formelle, schriftliche Checkliste, sondern verlasse mich bei den täglichen Abläufen auf meine langjährige Erfahrung sowie die entsprechenden Eingabemasken des Systems. Die Validierung der Pflichtfelder wie Lieferant, Rechnungsbetrag und Leistungszeitraum ist dabei fest in meine gewohnte Arbeitsroutine integriert, die ich bei jeder Rechnung konsequent durchlaufe. Sollte ein Feld nicht belegt sein oder eine Unstimmigkeit auftreten, wird der Buchungsvorgang durch das System unterbrochen, was mich zur manuellen Prüfung der vorliegenden Belege zwingt.
[Turn 11] Agent: "Verstehe, das System fungiert hier also als automatischer Filter.

Wenn du die verschiedenen Quellen wie E-Mail, SAP FI und DocuWare bei einer Recherche durchgehst, wie oft pro Monat kommt es im Schnitt vor, dass du diesen manuellen Aufwand bei fehlenden Bestellreferenzen betreiben musst?"

[Turn 12] Persona: Da ich bei den 80 bis 100 monatlich eingehenden Rechnungen keine exakte statistische Erfassung der Fälle ohne Bestellreferenz führe, lässt sich dies nur schwer in einer absoluten Zahl ausdrücken. Meine Erfahrung zeigt jedoch, dass diese Recherchen einen wiederkehrenden Anteil meiner Arbeit ausmachen, der mich über die Woche verteilt etwa eine Stunde kostet. Da dies ein manueller Suchprozess über das E-Mail-Postfach, das SAP FI und DocuWare hinweg ist, variiert die Häufigkeit dieser aufwendigen Klärungsfälle stark in Abhängigkeit von der Qualität der eingereichten Lieferantendokumente.
[Turn 12] Agent: "Das ist nachvollziehbar, bei 90 Rechnungen im Monat schwankt das sicher. Wenn wir bei diesen Recherchen bleiben: Wie viele dieser 90 Rechnungen benötigen pro Monat im Schnitt eine solche manuelle Klärung, sind das eher 5 oder eher 15 Fälle?"

[Turn 13] Persona: Auf Basis meiner langjährigen Erfahrung in der Abteilung lässt sich sagen, dass ein Bereich zwischen 5 und 15 Fällen eine durchaus realistische Größenordnung darstellt, die den Aufwand für die Klärung fehlender Bestellreferenzen widerspiegelt. Die genaue Anzahl schwankt dabei stark je nach Qualität der eingereichten Lieferantendokumente im jeweiligen Monat. Ich fange bei diesen Unstimmigkeiten in der Regel direkt mit der manuellen Suche in den Systemen an, um den Prozess für alle Beteiligten möglichst zügig voranzutreiben.
[Turn 13] Agent: "Alles klar, dann nehmen wir für die monatliche Häufigkeit der Klärungsfälle bei fehlenden Bestellreferenzen einen Wert von 10 Fällen an.

Wenn du diese Fälle bearbeitest, wie viel Zeit investierst du im Durchschnitt pro Einzelfall, bis die Zuordnung geklärt ist?"

[Turn 14] Persona: Wenn ich mich an einen solchen Klärungsfall mache, beansprucht die Recherche in den verschiedenen Systemen im Durchschnitt etwa sechs Minuten pro Vorgang. Da ich den gesamten Prozess, also die manuelle Suche im E-Mail-Client, im SAP FI und in DocuWare, in meine tägliche Routine integriert habe, ist dies eine realistische Einschätzung für den Zeitaufwand, bis die Zuordnung final geklärt ist. Sollten die Informationen in diesen Systemen nicht unmittelbar zur Identifizierung des Auftraggebers führen, kann sich diese Zeitspanne bei komplexen Einzelfällen jedoch auch deutlich verlängern.
[Turn 14] Agent: "Das ist ein hilfreicher Anhaltspunkt. Wenn du diese Recherchen durchführst, nutzt du dabei neben SAP FI, E-Mail und DocuWare noch weitere Datenquellen oder Tools, um den Auftraggeber zu identifizieren?"

[Turn 15] Persona: Nein, weitere Werkzeuge oder zusätzliche Datenquellen neben den bereits genannten Systemen ziehe ich für diese Recherche nicht heran. Ich konzentriere mich ausschließlich auf die Informationen aus dem E-Mail-Client, die Stammdaten und Buchungshistorien im SAP FI sowie die bereits archivierten Dokumente in DocuWare. Diese drei Quellen bilden den festen Rahmen meiner Suche, da sie alle relevanten Korrespondenzen und Vorgangsdaten enthalten, die ich für eine zweifelsfreie Zuordnung des Auftraggebers benötige.
[Turn 15] Agent: "Alles klar, das ist deutlich. Um das Bild abzurunden: Wie viel Zeit nimmst du dir im Schnitt für die Archivierung eines Dokuments in DocuWare, wenn die Buchung im SAP FI bereits abgeschlossen ist?"

[Turn 16] Persona: Der Prozess der Archivierung in DocuWare ist direkt mit der vorangegangenen Buchung im SAP FI verzahnt und nimmt nach Abschluss der Dateneingabe nur noch wenig zusätzliche Zeit in Anspruch. Ich benötige für diesen Schritt in der Regel etwa eine Minute, da die wesentlichen Informationen aus der Buchung übernommen werden können und lediglich die systemseitige Ablage finalisiert wird. Da dies ein eingespielter Handgriff am Ende der Rechnungsprüfung ist, erfolgt die Archivierung bei mir fast unmittelbar im Anschluss an die Verbuchung.
[Turn 16] Agent: "Das ist ein effizienter Abschluss. Gibt es für diese Archivierung in DocuWare eigentlich eine explizite Regel, wie die Dokumente benannt oder verschlagwortet werden müssen, damit sie später wiedergefunden werden können?"

[Turn 17] Persona: Für die Archivierung in DocuWare folge ich einer bewährten Struktur, die sicherstellt, dass die Dokumente auch nach längerer Zeit präzise wiedergefunden werden können. Ich verwende dabei ein festes Schema zur Verschlagwortung, bei dem wichtige Metadaten wie der Lieferantenname, das Belegdatum und die Rechnungsnummer direkt mit dem Dokument verknüpft werden. Diese Vorgehensweise ist für mich eine essenzielle Routine, da sie den administrativen Aufwand bei späteren Nachfragen oder einer Betriebsprüfung erheblich reduziert.
[Turn 17] Agent: "Das klingt nach einem sehr strukturierten Vorgehen. Um die Prozessschritte noch besser zu greifen: Wenn du eine Rechnung mit einem Betrag über 5.000 EUR zur Zweit-Freigabe weiterleitest, wie viel Zeit investierst du im Schnitt für diesen zusätzlichen Abstimmungsschritt, bis der Vorgang wieder bei dir zur Buchung landet?"

[Turn 18] Persona: Wenn ich den Vorgang zur Zweit-Freigabe weiterleite, liegt der zeitliche Aufwand für die Kommunikation und die Überwachung des Status bei etwa zehn Minuten pro Rechnung. Ich muss den Beleg im System bereitstellen, die entsprechende Instanz informieren und den Rücklauf abwarten, um die Buchung finalisieren zu können. Da dieser Prozessschritt stark von der Verfügbarkeit des Freigabeberechtigten abhängt, variiert die Durchlaufzeit zwischen dem Anstoßen der Freigabe und der Rückmeldung in der Praxis jedoch teils erheblich.
[Turn 18] Agent: "Das ist ein nachvollziehbarer Aufwand für die Koordination. Um die Datenquellen für diesen Schritt zu vervollständigen: Nutzt du für die Kommunikation der Zweit-Freigabe primär E-Mail oder erfolgt das direkt über eine Funktion innerhalb von SAP FI oder DocuWare?"

[Turn 19] Persona: Die Kommunikation für die Zweit-Freigabe erfolgt bei mir primär über den E-Mail-Client, da dies der direkteste Weg ist, um die verantwortliche Person zeitnah über den anstehenden Vorgang zu informieren. Ich nutze den E-Mail-Verkehr, um die notwendigen Unterlagen bereitzustellen und den Status der Freigabe gezielt zu verfolgen, bis ich die finale Rückmeldung erhalte. Weder das SAP FI noch DocuWare verfügen in unserer aktuellen Konfiguration über einen automatisierten Freigabe-Workflow, weshalb ich den Abstimmungsprozess manuell über den E-Mail-Versand steuere.
[Turn 19] Agent: "Alles klar, die Kommunikation läuft also rein über E-Mail, da kein automatisierter Workflow im System hinterlegt ist.

Um das Bild zu vervollständigen: Gibt es bei der inhaltlichen Prüfung der Rechnungen – also dem Abgleich von Lieferant, Betrag und Zeitraum – eigentlich eine schriftlich fixierte Arbeitsanweisung, an die du dich hältst, oder basiert dies rein auf deiner langjährigen Erfahrung?"

[Turn 20] Persona: Für die inhaltliche Prüfung der Rechnungen existiert keine schriftlich fixierte Arbeitsanweisung, die mir als formelle Vorgabe dient. Mein Vorgehen basiert vielmehr auf meiner zwölfjährigen Erfahrung in der Finanzbuchhaltung sowie den eingespielten Routinen, die ich im Laufe der Zeit in der Abteilung entwickelt habe. Ich verlasse mich bei der Validierung des Lieferanten, des Betrags und des Leistungszeitraums daher primär auf mein fachliches Urteilsvermögen und die im System hinterlegten Prüflogiken.
[Turn 20] Agent: "Verstehe, das ist also gelebtes Erfahrungswissen ohne schriftliche Vorgabe.

Um das Bild zu vervollständigen: Wenn du bei der inhaltlichen Prüfung (Lieferant, Betrag, Zeitraum) oder der Archivierung Daten aus den Systemen abgleichst, welche Quellen ziehst du dafür konkret heran – ist das neben dem SAP FI und DocuWare auch noch der E-Mail-Posteingang?"

[Turn 21] Persona: Ich fange damit an, die Rechnung zu prüfen, indem ich den Lieferanten, den Rechnungsbetrag sowie den Leistungszeitraum verifiziere, wofür der E-Mail-Posteingang die primäre Eingangsquelle für das Dokument darstellt. Für den anschließenden Abgleich und die Buchung ziehe ich ergänzend die Stammdaten aus dem SAP FI heran, während DocuWare als zentrale Ablage für die bereits archivierten Unterlagen dient. Diese drei Quellen bilden den festen Rahmen meiner täglichen Routine, da sie sämtliche notwendigen Informationen für eine konsistente Prüfung und Archivierung enthalten.
[Turn 21] Agent: "Danke für die Klärung. Wenn du die Zweit-Freigabe für Rechnungen über 5.000 EUR anstößt, nutzt du dafür neben dem E-Mail-Client zur Kommunikation auch noch Daten aus SAP FI oder DocuWare als Informationsquelle?"

[Turn 22] Persona: Für die Vorbereitung der Zweit-Freigabe ziehe ich selbstverständlich die Informationen aus dem SAP FI sowie die hinterlegten Belege in DocuWare heran, um eine fundierte Entscheidungsgrundlage für die freigebende Person zu schaffen. Ich stelle sicher, dass alle relevanten Buchungsdaten und das Rechnungsdokument vollständig vorliegen, bevor ich diese via E-Mail weiterleite. Auf diese Weise kann der Empfänger den Sachverhalt unmittelbar nachvollziehen, ohne dass ein Systemwechsel zwingend erforderlich ist.
[Turn 22] Agent: "Danke für die Erläuterung. Wenn du die Zweit-Freigabe für Rechnungen über 5.000 EUR anstößt, ist das für dich ein Prozess, der auf einer festen internen Regel basiert, oder entscheidest du dies je nach Einzelfall?"

[Turn 23] Persona: Dies ist eine fest implementierte interne Vorgabe, an die ich mich strikt halte, sobald der Schwellenwert von 5.000 EUR erreicht oder überschritten wird. Ich entscheide hierbei nicht nach Einzelfall, sondern folge dieser verbindlichen Regel zur Sicherstellung unserer finanziellen Kontrolle. Mein Prozess sieht daher zwingend vor, den Vorgang nach der ersten inhaltlichen Prüfung in den Abstimmungsmodus zur Zweit-Freigabe zu versetzen.
[Turn 23] Agent: "Alles klar, das ist eine klare Regelung. Abschließend zu diesem Bereich: Wie viel Zeit investierst du insgesamt für die gesamte Bearbeitung einer Rechnung, wenn sie zur Zweit-Freigabe muss – also inklusive der zehn Minuten für die Koordination und der Zeit für die erste Prüfung und spätere Buchung?"

[Turn 24] Persona: In diesem Fall setzt sich die Gesamtarbeitszeit aus der initialen inhaltlichen Prüfung von etwa fünf Minuten, dem zusätzlichen Koordinationsaufwand für die Zweit-Freigabe von zehn Minuten sowie der finalen Buchung und Archivierung zusammen. Da die Archivierung ebenfalls mit etwa einer Minute veranschlagt wird, summiert sich der Aufwand für einen solchen Vorgang auf insgesamt rund 16 Minuten, sofern keine weiteren Klärungsbedarfe oder Komplikationen auftreten. Diese Zeitspanne verdeutlicht den erhöhten manuellen Aufwand, der bei größeren Beträgen aufgrund der erforderlichen Abstimmungswege über den E-Mail-Client anfällt.
[Turn 24] Agent: "Danke für die Aufschlüsselung, damit ist der Prozess der Zweit-Freigabe nun sehr transparent.

Zum Abschluss: Wie hoch schätzt du den Anteil der Rechnungen ein, bei denen aufgrund von Fehlern oder Unstimmigkeiten – etwa bei der Kostenstelle oder dem Mehrwertsteuersatz – eine manuelle Korrektur notwendig wird, bezogen auf deine monatlichen 90 Rechnungen?"

[Turn 25] Persona: Auf Basis meiner langjährigen Erfahrung in der Finanzbuchhaltung stelle ich fest, dass bei etwa 5 von 100 Rechnungen Unstimmigkeiten auftreten, die ein manuelles Eingreifen meinerseits erforderlich machen. Ich fange dann damit an, die fehlerhaften Angaben – wie etwa eine fehlende Kostenstelle oder einen abweichenden Mehrwertsteuersatz – im SAP FI zu identifizieren und entsprechend zu korrigieren. Dies ist ein notwendiger Schritt, um die Datenintegrität zu wahren, bevor ich die Rechnung final verbuchen und zur Archivierung an DocuWare übergeben kann.
[Turn 25] Agent: "Danke für diese Einschätzung. Wenn wir bei diesen 5 % Unstimmigkeiten bleiben: Wie viel Zeit investierst du im Schnitt zusätzlich für die manuelle Korrektur einer solchen Rechnung, bis sie buchungsfähig ist?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung und Verbuchung | done | 90 ✓ | 5 ✓ | Erfahrung und systemseitige Pr ✓ | E-Mail-Posteingang,SAP FI,Docu ✓ | null | null |
| Eingangsrechnungsbearbeitung | walkthrough | 90 ✓ | null | null | null | null | null |
| Recherche bei fehlenden Bestellreferenzen | done | 10 ✓ | 240 ✓ | Individuelle Abwägung, ob inte ✓ | E-Mail-Postfach,SAP FI Stammda ✓ | null | null |
| Archivierung in DocuWare | done | 90 ✓ | 1 ✓ | Festes Schema zur Verschlagwor ✓ | E-Mail-Client,SAP FI,DocuWare ✓ | null | null |
| Zweit-Freigabe bei Schwellenwertüberschreitung | done | 5 ✓ | 16 ✓ | Betrag > 5.000 EUR ✓ | SAP FI,DocuWare ✓ | null | null |
| Zweit-Freigabe bei Rechnungen | exploring | null | null | null | null | null | null |
| Zweit-Freigabe für Rechnungen > 5.000 EUR | exploring | null | null | null | null | null | null |
| Zweit-Freigabe bei Beträgen > 5.000 EUR | exploring | null | null | null | null | null | null |
| Zweit-Freigabe (Rechnungen > 5.000 EUR) | exploring | null | null | null | null | null | null |
| Klärung bei fehlenden Bestellreferenzen | exploring | null | null | null | null | null | null |
| Zweit-Freigabe einleiten und verarbeiten | exploring | null | null | null | null | null | null |
