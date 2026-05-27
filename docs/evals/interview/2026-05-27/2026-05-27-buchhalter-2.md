---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-27
persona: buchhalter
interview_id: 00323d87-b669-40c1-9369-02d3c46e7338
turns_total: 26
---

[Turn 1] Agent: "Hallo Andreas, mein Ziel ist es, herauszufinden, wo deine täglichen Abläufe unnötig aufwändig sind, damit wir sie in Zukunft reibungsloser gestalten können. Erzähl mir kurz: Was sind deine Hauptaufgaben und wie sieht ein typischer Arbeitstag bei dir aus?"
[Turn 1] tokens: in=2561 out=111 cacheRead=null cacheCreate=null googleCached=null
[Turn 1] Persona (Andreas Meier): "Guten Tag. Meine Hauptaufgabe ist die Finanzbuchhaltung des Unternehmens. Der Kernprozess, der meine Tage hauptsächlich bestimmt, ist die Rechnungsprüfung — eingehende Rechnungen müssen geprüft, gebucht und archiviert werden. Das zieht sich kontinuierlich durch die Woche. Daneben gibt es den Monatsabschluss, der gegen Ende des Monats einen erheblichen Teil meiner Kapazität bindet. Das ist dann eine intensive Phase, in der alle offenen Posten abgestimmt und Rückstellungen gebucht werden müssen, bevor ich an das Controlling übergebe."

[Turn 2] Agent: "Die Rechnungsprüfung nimmt einen großen Teil deiner Zeit ein — erzähl mir bitte von einem typischen Fall, wie du eine Rechnung vom Eingang bis zur Archivierung bearbeitest."
[Turn 2] tokens: in=2650 out=66 cacheRead=null cacheCreate=null googleCached=null
[Turn 2] Persona (Andreas Meier): "Das läuft folgendermaßen ab: Ich fange damit an, die Rechnung per E-Mail zu empfangen. Der erste Schritt ist die Prüfung — Lieferant stimmt, der Betrag ist korrekt, der Leistungszeitraum passt. Wenn alles in Ordnung ist, buche ich die Rechnung im Buchhaltungssystem, und anschließend lege ich sie im Dokumentenmanagementsystem ab. Soweit der Standardfall. Was die Sache aufwändiger machen kann: Wenn keine Bestellreferenz auf der Rechnung steht, muss ich den Auftraggeber manuell in mehreren Systemen suchen — das ist dann deutlich zeitintensiver. Und natürlich gibt es bei manchen Rechnungen Diskrepanzen, zum Beispiel eine fehlende Kostenstelle oder ein falscher Mehrwertsteuersatz, was ebenfalls manuellen Klärungsaufwand bedeutet. Bei Beträgen über einem bestimmten Schwellenwert ist außerdem eine Zweit-Freigabe erforderlich, was den Prozess verlängert."

[Turn 3] Agent: "Das klingt nach einem Prozess mit einigen Abhängigkeiten, besonders bei fehlenden Referenzen. Wie viele Rechnungen bearbeitest du denn typischerweise in einem Monat?"
[Turn 3] tokens: in=3512 out=34 cacheRead=null cacheCreate=null googleCached=null
[Turn 3] Persona (Andreas Meier): "Im Durchschnitt sind das zwischen 80 und 100 Rechnungen pro Monat."

[Turn 4] Agent: "Du hast einen Bereich zwischen 80 und 100 Rechnungen genannt, daher rechne ich mit 90 als Orientierungswert — du hattest erwähnt, dass die manuelle Suche bei fehlender Bestellreferenz besonders zeitintensiv ist: Was ist an diesem Punkt die größte Hürde für dich?"
[Turn 4] tokens: in=4600 out=67 cacheRead=null cacheCreate=null googleCached=null
[Turn 4] Persona (Andreas Meier): "Die eigentliche Hürde ist, dass ich in drei verschiedenen Systemen suchen muss, um den Auftraggeber zu identifizieren — und diese Systeme sind nicht miteinander verknüpft. Es gibt keine einheitliche Suchmaske, ich muss jeden Schritt manuell durchführen. Das kostet Zeit, die ich lieber in die eigentliche Prüfung investieren würde. Pro Woche summiert sich das auf etwa eine Stunde, die ausschließlich für diese Sucharbeit draufgeht."

[Turn 5] Agent: "Das bedeutet, die fehlende Systemintegration zwingt dich zu einer manuellen Arbeit, die dir wertvolle Zeit raubt. Wenn du diese Sucharbeit als wichtigsten Störpunkt betrachtest, was wäre der erste Schritt, den du ändern würdest, um diesen Prozess effizienter zu gestalten?"
[Turn 5] tokens: in=4894 out=159 cacheRead=null cacheCreate=null googleCached=null
[Turn 5] Persona (Andreas Meier): "Idealerweise wäre eine automatische Zuordnung sinnvoll — also eine Lösung, die anhand von Lieferantendaten oder Betragsmerkmalen selbstständig prüft, ob es eine passende Bestellung gibt. Wie das technisch konkret aussehen würde, kann ich nicht sagen, das liegt nicht in meinem Fachbereich. Aber das Ziel wäre klar: Rechnungen ohne Bestellreferenz sollten nicht manuell eskalieren, sondern zumindest einen Vorschlag liefern, den ich nur noch bestätigen muss."

[Turn 6] Agent: "Eine automatische Zuordnung würde den manuellen Suchaufwand in den drei Systemen eliminieren und dir die Prüfung erleichtern. Damit wir den Prozess der Rechnungsprüfung vollständig erfasst haben: Gibt es abseits der fehlenden Bestellreferenz noch weitere Schritte, die dich aufhalten, etwa beim Umgang mit den Diskrepanzen, die du anfangs erwähnt hast?"
[Turn 6] tokens: in=5121 out=169 cacheRead=null cacheCreate=null googleCached=null
[Turn 6] Persona (Andreas Meier): "Ja, die Diskrepanzen sind ein eigenes Thema. Die häufigsten Fälle sind: eine fehlende Kostenstelle auf der Rechnung, ein falscher Mehrwertsteuersatz, oder eine Betragsdifferenz zwischen Rechnung und Bestellung. In solchen Fällen muss ich jeweils klären — entweder intern mit der Fachabteilung oder direkt mit dem Lieferanten. Das ist kein einheitlicher Ablauf, jede Diskrepanz erfordert eine individuelle Beurteilung. Das ist zeitaufwändig, weil es Recherche und Rückfragen erfordert, die sich schwer standardisieren lassen."

[Turn 7] Agent: "Verstanden, der Klärungsbedarf bei Diskrepanzen macht jede Rechnung zu einem individuellen Fall. Wie gehst du bei einer solchen Diskrepanz konkret vor – kontaktierst du die Fachabteilungen eher per E-Mail oder telefonisch, um die fehlenden Informationen zu erhalten?"
[Turn 7] tokens: in=5349 out=151 cacheRead=null cacheCreate=null googleCached=null
[Turn 7] Persona (Andreas Meier): "In der Regel per E-Mail — das hat den Vorteil, dass die Kommunikation dokumentiert ist und ich später nachvollziehen kann, wer was wann bestätigt hat. Telefonisch nur, wenn es schnell gehen muss oder wenn ich merke, dass die E-Mail nicht zeitnah beantwortet wird. Einen festen Standard dafür gibt es bei uns nicht — das entscheide ich von Fall zu Fall."

[Turn 8] Agent: "Die Dokumentation der Klärung per E-Mail scheint dir also bei der Nachvollziehbarkeit zu helfen. Wenn wir den Prozess der Rechnungsprüfung abschließen: Gibt es nach der Klärung noch Schritte, die aufgrund der Zweit-Freigabe für Beträge über dem Schwellenwert anfallen?"
[Turn 8] tokens: in=5580 out=101 cacheRead=null cacheCreate=null googleCached=null
[Turn 8] Persona (Andreas Meier): "Ja, ab 5.000 Euro Rechnungsbetrag ist eine zweite Freigabe notwendig. Das bedeutet: Ich leite die Rechnung nach meiner eigenen Prüfung an die zuständige Person weiter, warte auf deren Bestätigung, und erst dann buche ich und lege ab. Das verlängert den Prozess, ist aber aus Compliance-Sicht notwendig. Die Wartezeit hängt davon ab, wie schnell die Gegenseite reagiert — das ist ein Faktor, den ich nicht beeinflussen kann."

[Turn 9] Agent: "Die Zweit-Freigabe schafft eine Abhängigkeit von der Reaktionszeit Dritter, die du nicht steuern kannst. Damit haben wir die Rechnungsprüfung als Prozess durchleuchtet; gibt es im Bereich Monatsabschluss, den du anfangs erwähnt hast, ähnliche manuelle Engpässe oder Schnittstellenprobleme?"
[Turn 9] tokens: in=6799 out=78 cacheRead=null cacheCreate=null googleCached=null
[Turn 9] Persona (Andreas Meier): "Beim Monatsabschluss ist das Hauptproblem der Zeitdruck. Der Abschluss konzentriert sich auf einen eng definierten Zeitraum gegen Ende des Monats — in dieser Phase müssen alle offenen Posten abgestimmt, Rückstellungen gebucht und alles für die Übergabe an das Controlling aufbereitet werden. Was dabei besonders mühsam ist: Ausnahmen, also Buchungen, die nicht dem Standardablauf folgen, müssen manuell in einer Tabellenkalkulation nachgepflegt werden. Das Buchhaltungssystem deckt diese Fälle nicht vollständig ab, also muss ich parallel in zwei Umgebungen arbeiten. Das erhöht das Fehlerrisiko und kostet zusätzliche Zeit."

[Turn 10] Agent: "Das parallele Arbeiten im Buchhaltungssystem und in der Tabellenkalkulation klingt nach einer fehleranfälligen Notlösung. Um das Bild zu vervollständigen: Wie häufig kommen diese manuell zu pflegenden Ausnahmen beim Monatsabschluss etwa vor und wie lange dauert die Bearbeitung dieser Sondereinträge im Vergleich zum Standardprozess?"
[Turn 10] tokens: in=5426 out=85 cacheRead=null cacheCreate=null googleCached=null
[Turn 10] Persona (Andreas Meier): "Genaue Zahlen habe ich dazu nicht im Kopf — das variiert von Monat zu Monat. Was ich sagen kann: Die gesamte Abschlussphase dauert insgesamt zwei bis drei Tage, und die Ausnahmen sind ein Teil davon. Wie viel davon auf die Ausnahmen entfällt, kann ich nicht exakt beziffern. Es ist mehr ein qualitativer Faktor — die Ausnahmen erzeugen Unterbrechungen im Ablauf, weil ich zwischen den Systemen wechseln muss, und das stört die Konzentration in einer Phase, die ohnehin unter Zeitdruck steht."

[Turn 11] Agent: "Die Abschlussphase ist also intensiv gebunden, wobei die Systembrüche den Arbeitsfluss stören. Wenn du die Rechnungsprüfung betrachtest, basieren diese Schritte primär auf festen Regeln oder entscheidest du bei der Prüfung der Lieferantendaten und Beträge eher intuitiv? Und kannst du mir noch sagen, ob du dabei neben dem Buchhaltungssystem und dem DMS noch auf weitere Datenquellen zugreifst?"
[Turn 11] tokens: in=5991 out=98 cacheRead=null cacheCreate=null googleCached=null
[Turn 11] Persona (Andreas Meier): "Der Standardablauf ist klar regelbasiert — ich prüfe nach festen Kriterien: Stimmt der Lieferant? Stimmt der Betrag? Stimmt der Leistungszeitraum? Gibt es eine Bestellreferenz? Das sind definierte Prüfpunkte. Nur bei Diskrepanzen kommt Urteilsvermögen ins Spiel, weil jeder Fall anders gelagert ist. Was die weiteren Datenquellen betrifft: Ich arbeite primär mit dem Buchhaltungssystem und dem Dokumentenmanagementsystem. Für die Suche bei fehlender Bestellreferenz greife ich auf weitere interne Systeme zu, die Bestell- und Auftragsdaten enthalten — aber deren genaue Bezeichnungen würde ich nachschlagen müssen."

[Turn 12] Agent: "Du hast erwähnt, dass der Monatsabschluss gegen Ende des Monats stattfindet — wie viele Tage investierst du in Summe in einen solchen Abschluss? Und wenn du an diesen Ablauf denkst: Arbeitest du dort, abgesehen von den bereits genannten Systemen und der Tabellenkalkulation, noch mit weiteren Datenquellen, und folgen die einzelnen Schritte dort eher festen Regeln oder ist das Vorgehen stärker von der individuellen Fallprüfung geprägt?"
[Turn 12] tokens: in=5716 out=426 cacheRead=null cacheCreate=null googleCached=null
[Turn 12] Persona (Andreas Meier): "Der Abschluss dauert in der Regel zwei bis drei Tage — das habe ich vorhin bereits genannt. Was weitere Datenquellen angeht: ich arbeite beim Monatsabschluss hauptsächlich mit dem Buchhaltungssystem und mit der Tabellenkalkulation für die Ausnahmen. Weitere externe Datenquellen gibt es in dem Sinne nicht. Zum Ablauf: Der Grundrahmen ist strukturiert und regelbasiert — offene Posten abstimmen, Rückstellungen buchen, an Controlling übergeben. Aber innerhalb dieses Rahmens gibt es immer wieder Einzelfälle, die eine individuelle Beurteilung erfordern, insbesondere wenn Buchungen nicht eindeutig zuzuordnen sind."

[Turn 13] Agent: "Der Monatsabschluss findet einmal pro Monat statt, wobei du für diese Phasen insgesamt etwa 1.200 bis 1.800 Minuten aufwendest — wie würdest du den Anteil an regelbasierten Schritten im Vergleich zur individuellen Beurteilung prozentual einschätzen?"
[Turn 13] tokens: in=5945 out=49 cacheRead=null cacheCreate=null googleCached=null
[Turn 13] Persona (Andreas Meier): "Eine genaue Prozentzahl würde ich nicht nennen wollen, das wäre eine Schätzung ohne solide Grundlage. Was ich qualitativ sagen kann: Der überwiegende Teil der Schritte folgt einem festen Schema. Die Ausnahmen sind in der Zahl gering, aber sie sind zeitintensiv und unterbrechend — sie lassen sich nicht vorhersagen und erfordern jeweils eine eigene Entscheidung. Das Verhältnis kippt also nicht zahlenmäßig zugunsten der Einzelfallbeurteilung, aber der kognitive Aufwand ist auf dieser Seite deutlich höher."

[Turn 14] Agent: "Ich glaube, wir haben die wichtigsten Abläufe gut zusammen. Gibt es noch Prozesse oder Tätigkeiten, die wir nicht besprochen haben?"
[Turn 14] tokens: in=6112 out=93 cacheRead=null cacheCreate=null googleCached=null
[Turn 14] Persona (Andreas Meier): "Es gibt noch den Mahnprozess, den wir nicht angesprochen haben. Der läuft monatlich und ist ebenfalls zeitaufwändig. Wenn Rechnungen nicht fristgerecht bezahlt werden, muss ich manuell prüfen, welche Forderungen offen sind, und entsprechende Mahnungen auslösen. Das ist kein täglicher Prozess, aber er kommt regelmäßig und erfordert Aufmerksamkeit, besonders wenn Kunden wiederholt zu spät zahlen."

[Turn 15] Agent: "Erzähl mir bitte kurz, wie der Mahnprozess bei euch abläuft und wie viel Zeit du in etwa dafür pro Monat einplanst."
[Turn 15] tokens: in=6597 out=81 cacheRead=null cacheCreate=null googleCached=null
[Turn 15] Persona (Andreas Meier): "Der Ablauf ist im Grundsatz klar: Ich prüfe, welche offenen Forderungen überfällig sind, und löse dann nach Mahnstufe eine entsprechende Mahnung aus. Das läuft über das Buchhaltungssystem. Wie viel Zeit das genau pro Monat kostet, habe ich nie systematisch erfasst — das weiß ich nicht auswendig. Es ist spürbar, aber ich könnte keine verlässliche Zahl nennen."

[Turn 16] Agent: "Da du keine belastbare Zahl für den zeitlichen Aufwand des Mahnprozesses hast, können wir diesen Punkt so belassen — gibt es bei der Rechnungsprüfung oder beim Monatsabschluss eigentlich eine ungefähre Fehlerquote, die du bei den Buchungen beobachtest, oder fallen dir dabei gehäufte Medienbrüche auf, wenn Informationen zwischen Systemen übertragen werden?"
[Turn 16] tokens: in=6792 out=38 cacheRead=null cacheCreate=null googleCached=null
[Turn 16] Persona (Andreas Meier): "Bei der Rechnungsprüfung gibt es ungefähr fünf Diskrepanzen auf hundert Rechnungen — das ist eine grobe Schätzung aus der Erfahrung. Das sind die Fälle, die ich schon beschrieben habe: fehlende Kostenstelle, falscher Mehrwertsteuersatz, Betragsdifferenz. Was Medienbrüche betrifft: Ja, die gibt es. Wenn ich Informationen aus dem Buchhaltungssystem in die Tabellenkalkulation überführen muss, passiert das manuell — und da ist das Fehlerpotenzial natürlich vorhanden. Ich sehe das als strukturelles Problem, nicht als Einzelfall."

[Turn 17] Agent: "Danke für diese Einordnung. Um den Mahnprozess noch vollständig zu erfassen: Findet dieser einmal monatlich statt und welche Systeme nutzt du dabei außer dem Buchhaltungssystem?"
[Turn 17] tokens: in=7027 out=87 cacheRead=null cacheCreate=null googleCached=null
[Turn 17] Persona (Andreas Meier): "Ja, der Mahnprozess läuft monatlich. Was Systeme angeht: Primär das Buchhaltungssystem. Weitere separate Systeme nutze ich dabei nicht — die relevanten Informationen zu offenen Forderungen liegen dort direkt vor."

[Turn 18] Agent: "Der Mahnprozess läuft also ausschließlich über das Buchhaltungssystem. Wie oft genau führst du diesen Ablauf pro Monat durch und wie lange sitzt du im Schnitt an einer kompletten Mahnrunde, wenn man die Prüfung und das Auslösen der Mahnungen zusammenrechnet?"
[Turn 18] tokens: in=6915 out=291 cacheRead=null cacheCreate=null googleCached=null
[Turn 18] Persona (Andreas Meier): "Einmal pro Monat ist der Hauptlauf. Wie lange das dauert — das habe ich nie gemessen. Ich würde es nicht auf eine Zahl festlegen wollen, ohne das vorher nachgeschaut zu haben. Es ist spürbar zeitaufwändig, aber eine konkrete Stundenzahl kann ich ohne Grundlage nicht nennen."

[Turn 19] Agent: "Das ist vollkommen in Ordnung, eine Schätzung aus dem Bauch heraus reicht mir für den Moment völlig aus — wenn du den kompletten Prozess inklusive der Prüfung und des Anstoßens aller Mahnungen pro Durchgang betrachtest, liegt der Aufwand eher im Bereich von einer Stunde oder sind es eher zwei bis drei Stunden?"
[Turn 19] tokens: in=7138 out=215 cacheRead=null cacheCreate=null googleCached=null
[Turn 19] Persona (Andreas Meier): "Wenn ich eine grobe Einschätzung abgeben müsste, würde ich eher sagen zwei bis drei Stunden — aber das ist wirklich nur ein Bauchgefühl, keine belastbare Zahl."

[Turn 20] Agent: "Das hilft mir als Orientierung sehr weiter, dann notiere ich für die Dauer der Mahnrunde im Schnitt 150 Minuten. Damit wir das Bild vervollständigen können: Wenn du die Fehlerquote bei der Rechnungsprüfung mit etwa 5% einschätzt und die manuellen Übertragungen beim Monatsabschluss als strukturelles Problem der Medienbrüche ansiehst – würdest du sagen, dass diese Medienbrüche auch bei der Rechnungsprüfung an einer Stelle auftreten, an der Informationen händisch von einem System in ein anderes kopiert werden müssen?"
[Turn 20] tokens: in=7313 out=330 cacheRead=null cacheCreate=null googleCached=null
[Turn 20] Persona (Andreas Meier): "Ja, durchaus. Wenn ich eine Rechnung gebucht habe, muss ich sie manuell im Dokumentenmanagementsystem ablegen — das ist ein manueller Schritt zwischen zwei Systemen. Und bei der Suche nach dem Auftraggeber bei fehlender Bestellreferenz wechsle ich zwischen mehreren Systemen, ohne dass Daten automatisch übernommen werden. Das ist im Kern dasselbe strukturelle Problem — nur an einer anderen Stelle im Ablauf."

[Turn 21] Agent: "Das ist ein klares Bild der Medienbrüche. Um unsere Dokumentation der drei Prozesse abzuschließen: Wie hoch schätzt du – basierend auf deiner Erfahrung – die Fehlerquote bei der Rechnungsprüfung, also den Anteil der Rechnungen, bei denen aufgrund der genannten Medienbrüche oder Klärungsbedarfe eine Korrektur im Nachgang notwendig ist? Und treten bei den beiden anderen Prozessen, dem Monatsabschluss und dem Mahnprozess, ebenfalls solche konkreten Fehlerfälle auf, die du aufgrund der Systemwechsel oder manuellen Übertragungen korrigieren musst?"
[Turn 21] tokens: in=7603 out=88 cacheRead=null cacheCreate=null googleCached=null
[Turn 21] Persona (Andreas Meier): "Bei der Rechnungsprüfung habe ich die Diskrepanzquote bereits auf ungefähr 5 von 100 Rechnungen geschätzt — das ist die Zahl, die ich aus der Erfahrung kenne. Ob dabei in jedem Fall auch ein Nachkorrekturbedarf entsteht, ist von Fall zu Fall unterschiedlich. Bei Monatsabschluss und Mahnprozess erfasse ich solche Fehlerfälle nicht systematisch. Es gibt gelegentlich Korrekturen, wenn beim manuellen Übertragen in die Tabellenkalkulation ein Fehler passiert, aber eine Fehlerquote kann ich dafür nicht nennen."

[Turn 22] Agent: "Das ist nachvollziehbar, da sich solche Fehler oft nicht direkt in eine feste Quote gießen lassen. Um unsere Erfassung abzuschließen: Wie viele der monatlichen Rechnungen, die du prüfst, erfordern aufgrund der bereits besprochenen Medienbrüche (wie der Ablage im DMS oder der Suche nach der Bestellreferenz) einen manuellen Eingriff, der über den Standardprozess hinausgeht?"
[Turn 22] tokens: in=7836 out=106 cacheRead=null cacheCreate=null googleCached=null
[Turn 22] Persona (Andreas Meier): "Die DMS-Ablage ist bei jeder Rechnung dabei — das ist per se kein Ausnahmefall, sondern fester Bestandteil des Standardprozesses. Was darüber hinausgeht, sind die Rechnungen ohne Bestellreferenz und die Diskrepanzfälle. Die Diskrepanzen liegen bei ungefähr 5 von 100. Wie viele davon ohne Bestellreferenz kommen, habe ich nicht systematisch gezählt — ich weiß nur, dass der Aufwand dafür spürbar ist."

[Turn 23] Agent: "Das ist nachvollziehbar, da der Fokus stärker auf dem zeitlichen Aufwand als auf einer exakten Strichliste liegt. Um den Prozess der Rechnungsprüfung und den Mahnprozess noch vollständig abzuschließen: Wie oft würdest du sagen, treten bei der Rechnungsprüfung Medienbrüche auf, wenn man den gesamten Ablauf betrachtet – und kommen solche Medienbrüche bei deinem Mahnprozess überhaupt vor, da du diesen ja primär nur im Buchhaltungssystem abwickelst?"
[Turn 23] tokens: in=8070 out=290 cacheRead=null cacheCreate=null googleCached=null
[Turn 23] Persona (Andreas Meier): "Bei der Rechnungsprüfung tritt ein Medienbruch bei jeder Rechnung auf — das ist die Ablage im DMS nach der Buchung. Dazu kommt der manuelle Wechsel zwischen Systemen bei fehlender Bestellreferenz. Beim Mahnprozess würde ich sagen: nein, dort gibt es in dem Sinne keinen Medienbruch, weil alles im Buchhaltungssystem passiert."

[Turn 24] Agent: "Verstanden, beim Mahnprozess liegen alle Informationen zentral vor. Um die Erfassung für unsere Analyse abzurunden: Wie hoch schätzt du beim Monatsabschluss die Fehlerquote der manuellen Übertragungen ein, und würdest du bei der Rechnungsprüfung die Medienbrüche als den primären Grund für die 5-prozentige Fehlerquote ansehen oder sind es eher die inhaltlichen Diskrepanzen?"
[Turn 24] tokens: in=8108 out=108 cacheRead=null cacheCreate=null googleCached=null
[Turn 24] Persona (Andreas Meier): "Die 5 Prozent bei der Rechnungsprüfung sind inhaltliche Diskrepanzen — fehlende Kostenstelle, falscher Mehrwertsteuersatz, Betragsdifferenz. Das hat in erster Linie nichts mit den Systemwechseln zu tun, sondern mit fehlerhaften oder unvollständigen Angaben auf der Rechnung selbst. Beim Monatsabschluss habe ich keine Fehlerquote, die ich benennen könnte."

[Turn 25] Agent: "Die inhaltlichen Diskrepanzen sind also primär auf die Quelldaten der Rechnung zurückzuführen, während die Medienbrüche einen separaten, eher operativen Aufwand darstellen. Damit haben wir ein sehr gutes Verständnis deiner Arbeitsabläufe gewonnen — hast du abschließend noch einen Punkt oder eine Anmerkung, die dir besonders am Herzen liegt, wenn es um die tägliche Arbeit in der Finanzbuchhaltung geht?"
[Turn 25] tokens: in=8384 out=71 cacheRead=null cacheCreate=null googleCached=null
[Turn 25] Persona (Andreas Meier): "Was mich grundsätzlich beschäftigt: Die einzelnen Systeme sind gut in ihrem jeweiligen Bereich, aber sie sprechen nicht miteinander. Das führt zu Reibungsverlusten, die sich über die Zeit summieren — und die nicht immer sichtbar sind, weil man sich daran gewöhnt. Wenn ich einen Wunsch hätte, dann wäre es mehr Integration, damit ich mich auf die Inhalte konzentrieren kann und nicht auf die Logistik zwischen den Systemen."

[Turn 26] Agent: "Danke für deine Einschätzung, das ist ein wesentlicher Punkt, den ich so festhalte. Da wir alle Prozesse und die dazugehörigen Abläufe abgedeckt haben, bin ich mit dem Interview am Ende — vielen Dank für deine Zeit und die detaillierten Einblicke."
[Turn 26] tokens: in=8384 out=71 cacheRead=null cacheCreate=null googleCached=null

[PASS] Interview abgeschlossen — status = 'completed' nach Turn 26. Alle 3 Pflicht-Slots (frequency_per_month, duration_minutes, rule_based) für alle 3 registrierten Prozesse gefüllt.

## Token-Usage-Zusammenfassung
| Turn | inputTokens | outputTokens | cacheRead | cacheCreate | googleCached |
|------|-------------|--------------|-----------|-------------|--------------|
| 1    | 2561        | 111          | null      | null        | null         |
| 2    | 2650        | 66           | null      | null        | null         |
| 3    | 3512        | 34           | null      | null        | null         |
| 4    | 4600        | 67           | null      | null        | null         |
| 5    | 4894        | 159          | null      | null        | null         |
| 6    | 5121        | 169          | null      | null        | null         |
| 7    | 5349        | 151          | null      | null        | null         |
| 8    | 5580        | 101          | null      | null        | null         |
| 9    | 6799        | 78           | null      | null        | null         |
| 10   | 5426        | 85           | null      | null        | null         |
| 11   | 5991        | 98           | null      | null        | null         |
| 12   | 5716        | 426          | null      | null        | null         |
| 13   | 5945        | 49           | null      | null        | null         |
| 14   | 6112        | 93           | null      | null        | null         |
| 15   | 6597        | 81           | null      | null        | null         |
| 16   | 6792        | 38           | null      | null        | null         |
| 17   | 7027        | 87           | null      | null        | null         |
| 18   | 6915        | 291          | null      | null        | null         |
| 19   | 7138        | 215          | null      | null        | null         |
| 20   | 7313        | 330          | null      | null        | null         |
| 21   | 7603        | 88           | null      | null        | null         |
| 22   | 7836        | 106          | null      | null        | null         |
| 23   | 8070        | 290          | null      | null        | null         |
| 24   | 8108        | 108          | null      | null        | null         |
| 25   | 8384        | 71           | null      | null        | null         |
| 26   | 8384        | 71           | null      | null        | null         |
| **Σ** | **168,925** | **3,362** | **n/a** | **n/a** | **n/a** |

Caching-Effekt: googleCached bleibt durchgehend null — kein implizites Gemini-Caching aktiv oder nicht im Logging erfasst. Input-Token-Wachstum ist nicht monoton (Sprung auf 6799 bei Turn 9, dann Abfall auf 5426 bei Turn 10), was auf Context-Pruning im Gemini-Backend hindeutet.

## Slot-Filling-Stand (aus interview_state.step_tracker)

| Prozess | frequency_per_month | duration_minutes | rule_based | error_rate_percent | media_breaks |
|---------|---------------------|------------------|------------|-------------------|--------------|
| Rechnungsprüfung | 90 (estimate) | 60 (confirmed) | true (confirmed) | 5% (estimate) | true (confirmed) |
| Monatsabschluss | 1 (confirmed) | 1440 (confirmed) | true (estimate) | null | true (confirmed) |
| Mahnprozess | 1 (confirmed) | 150 (estimate) | true (confirmed) | null | false (confirmed) |

**Hinweis:** `duration_minutes=60` für Rechnungsprüfung entspricht der "1 Stunde pro Woche für die Sucharbeit bei fehlender Bestellreferenz" — nicht der Gesamtdauer des Prozesses. Der Agent hat einen Teilaufwand (Sucharbeit) als Prozessdauer interpretiert. Befund: Slot-Befüllungsfehler.

## Befunde

**Positiv:**
1. Vollständiger Abschluss — Interview erreicht `status=completed` in 26 Turns ohne Endlosschleife.
2. 3 Prozesse registriert — Rechnungsprüfung, Monatsabschluss und Mahnprozess alle mit `status=done`.
3. Pflicht-Slots vollständig — frequency_per_month, duration_minutes und rule_based bei allen 3 Prozessen gefüllt (vollständiger als vorheriger Eval-Lauf vom selben Tag).
4. Mahnprozess organisch erkannt — Agent fragte aktiv nach weiteren Prozessen (Turn 14); Persona brachte den im `additionalContext` hinterlegten Mahnprozess korrekt ein.
5. Frequenz sauber extrahiert — direkte Nachfrage "Wie viele Rechnungen pro Monat?" führte zu 80-100 → 90.
6. Persona hielt sich strikt an processKnowledge — bei fehlenden Werten (Mahnprozess-Dauer, Fehlerquoten anderer Prozesse) ehrlich auf fehlende Daten hingewiesen ohne Halluzination.
7. 5.000-EUR-Schwelle wurde korrekt verarbeitet — Persona nannte den Wert bei direkter Frage (Turn 8); Agent hat dies aufgenommen.

**Befunde / Bugs:**
1. **duration_minutes Rechnungsprüfung = 60 (falsch)** — Agent hat "ca. 1 Stunde pro Woche für die Sucharbeit" als Gesamtdauer des Prozesses interpretiert. Korrekt wäre gewesen: nach der Dauer einer einzelnen Rechnung oder der Gesamtdauer aller Rechnungen pro Monat zu fragen. Empfehlung: Slot-Befüllungslogik für `duration_minutes` soll zwischen Gesamtprozess-Zeit und Teil-Aufwand unterscheiden.
2. **Zirkuläre Fragen ab Turn 20** — Ab Turn 20 wiederholt der Agent Fragen zu Medienbrüchen und Fehlerquoten, die bereits beantwortet wurden. Die Phase-Transition-Logik verlässt `process_loop` nicht sauber, obwohl alle Slots gefüllt sind. Das Interview hätte spätestens nach Turn 18-19 in `wrap_up` wechseln sollen.
3. **googleCached immer null** — Implizites Gemini-Caching wurde in keinem Turn aktiviert. Erwartungswert: googleCachedTokens > 0 ab Turn 2 (System-Prompt sollte gecacht sein). Prüfen ob der Gemini-Adapter `googleCachedTokens` korrekt aus der API-Response extrahiert und in `.eval-last-usage.json` schreibt.
4. **Token-Anomalie Turn 10** — Input-Tokens fallen von 6799 (Turn 9) auf 5426 (Turn 10). Hinweis auf Context-Pruning im Gemini-Backend; kein Meridian-Fehler, aber relevant für Cost-Tracking-Genauigkeit.
5. **Verbesserung gegenüber erstem Eval-Lauf** — Im Lauf vom selben Tag (2026-05-27-buchhalter.md) waren nur 2 Prozesse registriert und kein Pflicht-Slot vollständig. Dieser Lauf hat alle 3 Prozesse mit vollständigen Pflicht-Slots. Keine Code-Änderung zwischen den Läufen — Unterschied liegt im Persona-Spielverhalten (dieser Lauf narrativer, weniger Zahlen-Push zu Beginn).
