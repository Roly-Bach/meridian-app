---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
eval_date: 2026-06-01
persona: buchhalter
interview_id: 9732b453-e4b8-4c0e-9494-7571a53c35f2
eval_run_id: efb64763-6671-412f-82e4-ec45328d7208
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/9732b453-e4b8-4c0e-9494-7571a53c35f2
turns_total: 25
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.21
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.78
  completion_correctness: false
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.21 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.78 | maximize |
| completion_correctness | false | true |

## Gesprächsverlauf

[Turn 1] Persona: Gerne unterstütze ich Sie bei der Dokumentation unserer betrieblichen Abläufe. Mein Arbeitsalltag konzentriert sich primär auf die systematische Rechnungsprüfung sowie die Durchführung des monatlichen Abschlusses, wobei ich fortlaufend sicherstelle, dass sämtliche Buchungen korrekt den entsprechenden Sachkonten zugeordnet sind. Besonders fordernd sind dabei die manuelle Recherche bei fehlenden Informationen sowie die terminliche Verdichtung zum Monatsende, bei der eine hohe Präzision unerlässlich ist.
[Turn 1] Agent: "Hallo Andreas. Schön, dass du dir Zeit nimmst. Ziel unseres Gesprächs ist es, dein praktisches Prozesswissen aus dem Arbeitsalltag strukturiert zu erfassen und für das Team zu dokumentieren. Unser Austausch wird vertraulich behandelt.

Um direkt einzusteigen: Wie sieht ein typischer Arbeitstag bei dir aus und welche Hauptaufgaben prägen deinen Alltag in der Finanzbuchhaltung?"

[Turn 2] Persona: Mein Arbeitsalltag ist geprägt von der sorgfältigen Bearbeitung eingehender Rechnungen sowie der Durchführung des monatlichen Abschlusses, um eine korrekte Finanzberichterstattung zu gewährleisten. Dabei liegt mein Fokus auf der fachlichen Prüfung von Belegen, der Klärung von Unstimmigkeiten bei der Kontierung oder dem Mehrwertsteuerausweis sowie der Vorbereitung der notwendigen Rückstellungen. Diese Aufgaben erfordern ein hohes Maß an Genauigkeit, insbesondere wenn bei komplexen Vorgängen eine zusätzliche Autorisierung notwendig ist oder manuelle Abstimmungen in unseren Systemen vorgenommen werden müssen.
[Turn 2] Agent: "Lass uns mit dem Prozess der Rechnungsprüfung starten. Welcher konkrete erste Schritt stößt diesen Prozess an, sobald eine Rechnung bei dir eingeht?"

[Turn 3] Persona: Wenn eine Rechnung per E-Mail bei uns eingeht, starte ich mit einer grundlegenden Sichtung des Dokuments, um den Lieferanten, die Summe sowie den zugrunde liegenden Leistungszeitraum zu verifizieren. Im Anschluss erfolgt der Abgleich mit den internen Vorgaben, um die sachliche Korrektheit sicherzustellen, bevor die Daten in unser Buchhaltungssystem übertragen und das Dokument im Archivsystem hinterlegt wird. Sollte dabei eine bestimmte Wertgrenze überschritten werden, ist zwingend eine zusätzliche Prüfung durch eine weitere Person erforderlich, bevor der Vorgang final abgeschlossen werden kann.
[Turn 3] Agent: "Verstanden, der Prozess startet also mit der Sichtung und Verifizierung der eingehenden E-Mail-Rechnung.

Welche Systeme oder Programme nutzt du konkret für diese erste Sichtung und den Abgleich?"

[Turn 4] Persona: Für die initiale Sichtung verwende ich unseren E-Mail-Client, um die eingehenden Dokumente zu erfassen. Die darauffolgende Verbuchung und die fachliche Prüfung der Rechnung führe ich innerhalb des Buchhaltungssystems aus. Abschließend erfolgt die revisionssichere Ablage der geprüften Unterlagen über das Archivsystem.
[Turn 4] Agent: "Wie heißen der E-Mail-Client, das Buchhaltungssystem und das Archivsystem, die du dafür nutzt, konkret mit Produktnamen?"

[Turn 5] Persona: Für die Bearbeitung der Rechnungen setze ich zur Erfassung der E-Mails den internen E-Mail-Client ein, während die Buchungen direkt in SAP FI vorgenommen werden. Zur finalen und rechtssicheren Ablage der Dokumente nutze ich DocuWare. Diese drei Komponenten bilden das essenzielle Fundament für meine tägliche Arbeit in der Rechnungsprüfung.
[Turn 5] Agent: "Danke für die Präzisierung der Systeme SAP FI und DocuWare.

Gehen wir zum ersten Schritt, der Sichtung und dem Abgleich: Welche konkreten Daten liest du aus der Rechnung ab und trägst sie manuell in SAP FI ein?"

[Turn 6] Persona: Bei der Prüfung extrahiere ich die Informationen zum Lieferanten, den zu zahlenden Gesamtbetrag sowie den spezifizierten Leistungszeitraum aus dem Dokument. Diese Daten gleichen wir mit den vorliegenden Auftragsreferenzen ab, um die korrekte Zuordnung in der Buchhaltung zu gewährleisten. Sofern Diskrepanzen wie fehlende Kostenstellen, fehlerhafte Steuersätze oder Betragsabweichungen auftreten, müssen diese Unstimmigkeiten manuell geklärt werden, bevor die finale Verbuchung erfolgt.
[Turn 6] Agent: "Das ist ein wichtiger erster Schritt.

Welche konkrete Transaktion oder Suchmaske nutzt du in SAP FI, um die Auftragsreferenz für den Abgleich zu suchen?"

[Turn 7] Persona: Für die Recherche nach fehlenden Auftragsreferenzen steht mir keine dedizierte Einzeltransaktion zur Verfügung, stattdessen erfordert dieser Prozess eine manuelle Suche über verschiedene Systembereiche hinweg. Ich gleiche die vorliegenden Rechnungsdaten dabei systemübergreifend ab, um den zuständigen Auftraggeber zu identifizieren und die notwendigen Kontierungsdetails zu ergänzen. Dieser Schritt ist für mich besonders arbeitsintensiv, da ich die Informationen häufig aus mehreren Quellen zusammenführen muss, um eine konsistente Buchung sicherzustellen.
[Turn 7] Agent: "Das klingt nach einem sehr aufwendigen Suchprozess.

Welche konkreten anderen Systeme oder SAP-Transaktionen öffnest du, um diese fehlenden Auftragsreferenzen und Kontierungsdetails zu recherchieren?"

[Turn 8] Persona: Beim Suchen nach den fehlenden Informationen greife ich auf Informationen aus verschiedenen Systemen zu, um die Zusammenhänge zwischen den Eingangsrechnungen und den ursprünglichen Aufträgen herzustellen. Da mir keine einzelne, automatisierte Schnittstelle zur Verfügung steht, vergleiche ich die Daten manuell über die Suchfunktionen in SAP FI, um den jeweiligen Auftraggeber zweifelsfrei zu identifizieren. Dieser Vorgang ist aufgrund der notwendigen Abstimmung zwischen den unterschiedlichen Informationsquellen besonders zeitaufwändig, bevor ich die entsprechenden Kontierungsdaten für die Buchung im System hinterlegen kann.
[Turn 8] Agent: "Du hast erwähnt, dass du die Daten über die Suchfunktionen in SAP FI vergleichst. Welche konkreten Transaktionscodes (T-Codes) nutzt du in SAP FI für diese manuelle Suche?"

[Turn 9] Persona: Für die operative Abwicklung der Buchungen in SAP FI nutzen wir standardisierte Transaktionen, deren genaue Kürzel ich jedoch aufgrund interner Vorgaben nicht nennen kann. Ich bewege mich hierbei primär in den Modulen zur Kreditorenbuchhaltung, um die offenen Posten mit den vorliegenden Rechnungsdaten manuell in Einklang zu bringen. Dabei navigiere ich gezielt durch die Suchmasken des Systems, um über Lieferantennummer oder Referenzbelege die notwendigen Details für die Kontierung zu finden.
[Turn 9] Agent: "Das respektiere ich natürlich.

Wie gehst du konkret vor, wenn du die Lieferantennummer oder den Referenzbeleg im System gefunden hast – was ist der nächste Schritt?"

[Turn 10] Persona: Sobald die erforderlichen Informationen wie Lieferantennummer oder Referenzbeleg erfolgreich im System identifiziert wurden, übertrage ich die fehlenden Details direkt in den Buchungsvorgang innerhalb von SAP FI. Ich ergänze dabei die Kostenstelle und prüfe noch einmal die steuerliche Korrektheit der Rechnung, bevor die Verbuchung endgültig durchgeführt wird. Abschließend erfolgt die Ablage des Belegs in DocuWare, wobei bei Überschreiten der festgelegten Wertgrenze eine elektronische Zweit-Freigabe angestoßen wird.
[Turn 10] Agent: "Das ist ein wichtiger Kontrollschritt.

Ab welchem konkreten Betrag greift diese Wertgrenze für die Zweit-Freigabe, und wie wird diese Freigabe angestoßen?"

[Turn 11] Persona: Für den Prozess der Zweit-Freigabe gilt eine Wertgrenze von 5.000 EUR, ab welcher eine zusätzliche Autorisierung zwingend erforderlich ist. Sobald eine Rechnung diesen Betrag übersteigt, wird der Freigabeprozess innerhalb unserer Systeme automatisch angestoßen, damit die berechtigte Person den Vorgang prüfen und autorisieren kann. Erst nach diesem digitalen Signaturschritt schließe ich die Buchung und die Dokumentenablage final ab.
[Turn 11] Agent: "Über welches System wird diese automatische Freigabe abgewickelt, und wie erfährt die freigebende Person davon?"

[Turn 12] Persona: Die elektronische Zweit-Freigabe wird direkt über DocuWare abgewickelt, in dem das Dokument nach der ersten Erfassung zur Prüfung bereitgestellt wird. Sobald eine Rechnung den entsprechenden Schwellenwert überschreitet, generiert das System eine automatische Benachrichtigung an die freigabeberechtigte Person. Diese erhält über den hinterlegten Workflow den direkten Zugriff auf den digitalen Beleg, um die fachliche Autorisierung für den weiteren Buchungsprozess zu erteilen.
[Turn 12] Agent: "Sobald die Freigabe in DocuWare erteilt wurde, wie schließt du den Vorgang in SAP FI konkret ab?"

[Turn 13] Persona: Nachdem die Freigabe in DocuWare vorliegt, kehre ich in SAP FI zurück, um den Buchungsprozess für den entsprechenden Beleg final zu erfassen. Ich verifiziere dabei nochmals die Übereinstimmung der freigegebenen Beträge mit den hinterlegten Stammdaten und schließe den Vorgang durch das Setzen des Buchungsstatus ab. Damit ist die Rechnung sowohl buchhalterisch als auch revisionssicher dokumentiert und der Prozess für diesen Vorgang abgeschlossen.
[Turn 13] Agent: "Das schließt den Kreis für einen einzelnen Beleg sehr gut. 

Wie viele solcher Rechnungen bearbeitest du im Durchschnitt pro Monat, und wie viel Zeit benötigst du typischerweise für die Bearbeitung einer einzelnen Rechnung (von der Sichtung bis zum Abschluss)?"

[Turn 14] Persona: Üblicherweise gehen bei uns monatlich zwischen 80 und 100 Rechnungen ein, die ich nach dem beschriebenen Schema bearbeite. Die reine Durchlaufzeit pro Beleg variiert dabei stark, abhängig davon, ob alle Daten sofort vorliegen oder ob aufwendige Recherchen zu fehlenden Auftragsreferenzen notwendig sind. Bei ungeklärten Diskrepanzen, die etwa bei jeder zwanzigsten Rechnung auftreten, erhöht sich der Zeitaufwand für die manuelle Nachbearbeitung erheblich, da ich die Informationen dann mühsam über mehrere Systeme hinweg zusammenführen muss.
[Turn 14] Agent: "Du hast eine Spanne von 80 bis 100 Rechnungen pro Monat genannt – welcher Wert trifft es für einen typischen Monat besser? Andererseits: Wie viele Minuten benötigst du im Schnitt für eine Rechnung, wenn alles glattläuft, und wie viele Minuten sind es, wenn du recherchieren musst?"

[Turn 15] Persona: Die Anzahl der monatlich eingehenden Rechnungen pendelt meist im Bereich von 80 bis 100 Vorgängen, wobei sich die Intensität je nach Geschäftslage leicht verschiebt. Bei reibungslosen Buchungen ohne fehlende Referenzen kann ich einen Vorgang zügig bearbeiten, während bei notwendigen Recherchen aufgrund fehlender Informationen der Zeitbedarf deutlich ansteigt. Sofern ich manuell in verschiedenen Systemen nach dem Auftraggeber suchen muss, summiert sich dieser Rechercheaufwand auf etwa eine Stunde pro Woche, was die Effizienz der Standardbearbeitung spürbar reduziert.
[Turn 15] Agent: "Du hast 80 bis 100 Rechnungen genannt – welcher konkrete Wert trifft es für einen ganz typischen Monat am besten? Und wie viele Minuten benötigst du im Schnitt für eine einzelne Rechnung, wenn alles glattläuft?"

[Turn 16] Persona: In einem typischen Monat bearbeite ich im Durchschnitt etwa 90 Rechnungen. Wenn der Prozess reibungslos verläuft und alle notwendigen Informationen vorliegen, beansprucht die Bearbeitung einer einzelnen Rechnung meist nur wenige Minuten. Die exakte Dauer ist hierbei von der Komplexität der Buchung abhängig, wobei die Standardvorgänge den Großteil meiner täglichen Kapazität in Anspruch nehmen.
[Turn 16] Agent: "Danke für die Konkretisierung auf 90 Rechnungen im Monat.

Du hast „wenige Minuten“ für eine reibungslose Rechnung gesagt — welcher konkrete Minutenwert trifft es für einen typischen Fall am besten?"

[Turn 17] Persona: Für einen Standardvorgang, bei dem alle notwendigen Informationen vollständig vorliegen, veranschlage ich im Schnitt etwa fünf bis zehn Minuten Arbeitszeit. Diese Zeitspanne umfasst die initiale Sichtung, die Erfassung in SAP FI sowie die anschließende Ablage im DocuWare-System. Komplexere Fälle, die manuelle Klärungen erfordern, bilden hierbei die Ausnahme und nehmen entsprechend mehr Zeit in Anspruch.
[Turn 17] Agent: "Du hast „fünf bis zehn Minuten“ gesagt — welcher Wert trifft es für einen reibungslosen Standardfall im Schnitt besser?"

[Turn 18] Persona: In einem reibungslosen Standardfall liegt der Zeitaufwand für die Bearbeitung im Durchschnitt bei etwa sieben Minuten. Diese Zeitspanne ermöglicht mir eine präzise Erfassung der Daten sowie die ordnungsgemäße Ablage, sofern keine weiterführenden Klärungen notwendig sind. Sofern Unstimmigkeiten auftreten, verlängert sich dieser Zeitraum jedoch, da ich die bereits beschriebenen manuellen Recherchen einplanen muss.
[Turn 18] Agent: "Sieben Minuten für einen Standardfall ist ein konkreter Richtwert.

Wie viele Minuten benötigst du im Durchschnitt für eine Rechnung, wenn Unstimmigkeiten auftreten und du recherchieren musst?"

[Turn 19] Persona: Wenn Unstimmigkeiten auftreten, verlängert sich der Zeitaufwand für den einzelnen Vorgang im Durchschnitt auf etwa zwanzig bis dreißig Minuten. Dieser deutliche Anstieg resultiert daraus, dass ich für die Klärung der fehlerhaften Kostenstellen oder abweichenden Beträge eine manuelle Recherche über mehrere Systembereiche hinweg anstoßen muss. Diese Zeitspanne ist notwendig, um die Konsistenz der Daten sicherzustellen, bevor der eigentliche Buchungsprozess in SAP FI fortgesetzt werden kann.
[Turn 19] Agent: "Du hast eine Spanne von 20 bis 30 Minuten genannt — welcher konkrete Minutenwert trifft es für einen solchen Klärungsfall im Durchschnitt am besten?"

[Turn 20] Persona: Für einen solchen Klärungsfall, bei dem ich gezielt nach Informationen suchen oder Diskrepanzen auflösen muss, rechne ich im Durchschnitt mit etwa fünfundzwanzig Minuten. Dieser Zeitaufwand ist notwendig, um die verschiedenen Quellen abzugleichen und sicherzustellen, dass die Buchung in SAP FI anschließend korrekt vorgenommen werden kann. Da dies eine manuelle und systemübergreifende Prüfung erfordert, ist dieser Zeitansatz für mich eine realistische Einschätzung der täglichen Praxis.
[Turn 20] Agent: "Danke, 25 Minuten für einen Klärungsfall ist ein präziser Wert.

Gibt es bei dieser Rechnungsprüfung und Verbuchung feste, eindeutige Regeln, nach denen du entscheidest (z. B. "Wenn X, dann tue Y"), oder erfordert der Prozess oft dein persönliches Ermessen?"

[Turn 21] Persona: Grundsätzlich folge ich bei der Prüfung fest definierten Prozessvorgaben, wie etwa der obligatorischen Zweit-Freigabe bei Überschreitung der genannten Wertgrenze. Dennoch erfordert der Umgang mit Unstimmigkeiten oder fehlenden Referenzdaten häufig mein fachliches Ermessen, um zu entscheiden, welche systemübergreifenden Schritte zur Klärung führen. Während die Standardbuchung einem klaren "Wenn-Dann-Schema" folgt, basiert die Fehlerbehebung auf meiner langjährigen Erfahrung, um die korrekte Kontierung trotz lückenhafter Unterlagen sicherzustellen.
[Turn 21] Agent: "Das ist ein wichtiger Punkt: Die Standardbuchung folgt klaren Wenn-Dann-Regeln, während die Fehlerbehebung dein fachliches Ermessen erfordert.

Lass uns nun zum zweiten großen Aufgabenblock wechseln, den du anfangs erwähnt hast: dem Monatsabschluss. Wie oft im Monat führst du diesen Prozess durch, und wie viele Stunden oder Tage benötigst du typischerweise für den gesamten Monatsabschluss?"

[Turn 22] Persona: Für den Monatsabschluss ist ein Rhythmus von genau einem Durchgang pro Monat vorgesehen, bei dem ich sämtliche offenen Posten abstimme und die notwendigen Rückstellungen für unsere Buchhaltung vornehme. Dieser Prozess erstreckt sich zeitlich über einen Zeitraum von zwei bis drei Tagen intensiver Arbeit, um die Daten für das Controlling final aufzubereiten. Während dieser Phase arbeite ich primär mit SAP FI sowie Excel, wobei der enge Zeitrahmen eine sehr konzentrierte Arbeitsweise erfordert.
[Turn 22] Agent: "Du hast „zwei bis drei Tage“ für den Monatsabschluss genannt — wie viele Arbeitstage oder Arbeitsstunden sind es für einen ganz typischen Monatsabschluss im Durchschnitt?"

[Turn 23] Persona: Für einen typischen Monatsabschluss veranschlage ich im Durchschnitt zweieinhalb Arbeitstage, um sämtliche Abstimmungen und Buchungen verlässlich abzuschließen. Diese Zeit ist erforderlich, da ich in dieser Phase die offenen Posten sorgfältig prüfen, Rückstellungen bilden und die Daten für das Controlling aufbereiten muss. Die Intensität dieser Tage ergibt sich vor allem aus dem engen Zeitrahmen, in dem alle finanziellen Aktivitäten des Monats final in SAP FI zusammengeführt werden müssen.
[Turn 23] Agent: "Zweieinhalb Arbeitstage sind ein konkreter Richtwert.

Welche spezifischen Excel-Vorlagen oder Datenquellen nutzt du neben SAP FI für diese Abstimmungen und Rückstellungen im Monatsabschluss?"

[Turn 24] Persona: Für den Abschluss nutze ich Excel vorwiegend als ergänzendes Werkzeug, um Ausnahmen zu erfassen, die nicht direkt im SAP FI abgebildet werden können. Ich führe dort manuelle Listen, um Posten nachzupflegen, die aufgrund ihrer Komplexität oder fehlender Zuordnungsmöglichkeiten außerhalb der Standardbuchungsmasken liegen. Diese Excel-Tabellen dienen mir als Arbeitsgrundlage, um die Abstimmungsdifferenzen zwischen den Systemen zu bereinigen und die finalen Rückstellungsbeträge für das Controlling transparent zu dokumentieren.
[Turn 24] Agent: "Folgen diese Abstimmungen und die Berechnung der Rückstellungen im Monatsabschluss festen, vordefinierten Regeln und Formeln in deinen Excel-Tabellen, oder entscheidest du das jeweils individuell?"

[Turn 25] Persona: Für den Monatsabschluss orientiere ich mich bei der Berechnung der Rückstellungen an festen betriebswirtschaftlichen Grundsätzen und vordefinierten Berechnungslogiken in meinen Excel-Tabellen. Dennoch erfordern die Abstimmung der offenen Posten sowie die Behandlung von Ausnahmetatbeständen häufig eine individuelle Einschätzung meinerseits, um die sachliche Richtigkeit zu gewährleisten. Ich wende diese etablierten Regeln konsequent an, muss jedoch bei Abweichungen, die das Standard-Schema verlassen, aufgrund meiner Erfahrung im Einzelfall entscheiden, wie die Daten korrekt für das Controlling aufbereitet werden.
[Turn 25] Agent: "Das bedeutet, die Berechnungen in Excel basieren auf festen Formeln, aber die Abstimmung der Abweichungen erfordert dein fachliches Ermessen.

Lass uns noch kurz zu den Rechnungen über 5.000 EUR zurückkehren, die die Zweit-Freigabe in DocuWare durchlaufen: Wie viele dieser ca. 90 Rechnungen pro Monat überschreiten diese Grenze typischerweise, und wie viele Minuten benötigst du für diesen Freigabeschritt im Schnitt selbst?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung und Verbuchung | walkthrough | null | null | null | E-Mail-Client,SAP FI,DocuWare ✓ | null | null |
| Eingangsrechnungsprüfung und Erfassung | exploring | null | null | null | null | null | null |
| Zweit-Freigabe über DocuWare | walkthrough | null | null | null | null | null | null |
| Monatsabschluss | walkthrough | 1 ✓ | 1200 ✓ | null | SAP FI,Excel ✓ | null | null |
| Sichtung und Verifizierung der Rechnung | exploring | null | null | null | null | null | null |
| Rechnungsprüfung (Klärungsfall) | walkthrough | 4.5 ✓ | null | null | null | null | null |
