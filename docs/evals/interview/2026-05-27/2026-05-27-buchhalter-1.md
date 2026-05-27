---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-27
persona: buchhalter
interview_id: 0c971f70-66c2-42d2-abbe-9cfc2ee7a7fd
turns_total: 21
---

[Turn 1] Agent: "Hallo Andreas, ich möchte mit dir gemeinsam schauen, wo deine Arbeit unnötig aufwändig ist und wo wir die Prozesse für dich reibungsloser gestalten können. Erzähl mir kurz: Was sind deine Hauptaufgaben und wie sieht ein typischer Arbeitstag bei dir aus?"
[Turn 1] tokens: in=5408 out=79 cacheRead=null cacheCreate=null googleCached=null
[Turn 1] Persona (Andreas Meier): "Guten Tag. Meine Hauptaufgaben liegen in der Finanzbuchhaltung. Ich kümmere mich vor allem um die Prüfung und Verbuchung eingehender Rechnungen sowie um den Monatsabschluss. Ein typischer Tag beginnt damit, dass ich die eingegangenen Rechnungen in meinem E-Mail-Postfach sichte und durcharbeite. Dabei prüfe ich, ob Lieferant, Betrag und Leistungszeitraum stimmen, und buche die Rechnungen dann in unser System ein. Danach lege ich die Belege digital ab. Am Monatsende kommt dann die aufwendigere Arbeit mit dem Abschluss dazu — da stimme ich offene Posten ab und kümmere mich um Rückstellungen."

[Turn 2] Agent: "Hallo Andreas, danke für den Überblick. Lass uns mit der Rechnungsprüfung beginnen, da sie einen großen Teil deiner täglichen Arbeit ausmacht — erzähl mir bitte von einem konkreten Fall, bei dem die Rechnungsprüfung besonders umständlich war."
[Turn 2] tokens: in=2450 out=111 cacheRead=null cacheCreate=null googleCached=null
[Turn 2] Persona (Andreas Meier): "Ein typisches Beispiel ist, wenn eine Rechnung ohne Bestellreferenz eingeht. Das passiert immer wieder — der Lieferant schickt die Rechnung einfach ohne die entsprechende Auftragsnummer. Dann muss ich manuell nachforschen, wer intern den Auftrag erteilt hat. Dazu schaue ich in verschiedenen Systemen nach — im E-Mail-Client, in SAP und noch an einer weiteren Stelle. Das ist recht zeitaufwändig, weil man die Zusammenhänge mühsam zusammensuchen muss."

[Turn 3] Agent: "Das klingt in der Tat nach einem unnötigen Suchaufwand. Welche der drei Stellen, in denen du suchen musst, bereitet dir bei der Klärung der Bestellreferenz die meisten Schwierigkeiten?"
[Turn 3] tokens: in=3847 out=301 cacheRead=null cacheCreate=null googleCached=null
[Turn 3] Persona (Andreas Meier): "Am schwierigsten ist eigentlich SAP. Wenn ich dort nach einem Lieferanten suche ohne die genaue Belegnummer zu kennen, dauert es, bis man zur richtigen Buchung kommt. Der E-Mail-Client ist noch relativ überschaubar — da kann man zumindest nach dem Lieferantennamen suchen. DocuWare ist eigentlich für die Ablage gedacht, nicht für die Recherche, aber manchmal hilft ein Blick in ältere Dokumente, um Zusammenhänge herzustellen."

[Turn 4] Agent: "Das ist ein interessanter Einblick in die Systemlandschaft. Wenn du sagst, dass die Suche in SAP ohne Belegnummer besonders mühsam ist – wie gehst du nach der Recherche vor, sobald du die fehlenden Informationen endlich zusammengetragen hast?"
[Turn 4] tokens: in=4197 out=183 cacheRead=null cacheCreate=null googleCached=null
[Turn 4] Persona (Andreas Meier): "Sobald ich alle Informationen beisammen habe, buche ich die Rechnung in SAP FI ein — das ist der eigentliche Buchungsschritt. Ich trage die Kostenstelle ein, prüfe den Mehrwertsteuersatz und stelle sicher, dass der Betrag korrekt ist. Danach lege ich den Beleg in DocuWare ab, damit er später auffindbar ist. Wenn der Betrag eine bestimmte Grenze überschreitet, muss außerdem noch jemand anderes gegenzeichnen, bevor die Buchung final ist."

[Turn 5] Agent: "Das klingt nach einem klaren Standardprozess nach der Klärung. Was passiert in deinem System, wenn der Betrag diese Grenze überschreitet – wird der Vorgang automatisch an die entsprechende Person weitergeleitet oder musst du diese manuell informieren?"
[Turn 5] tokens: in=4414 out=203 cacheRead=null cacheCreate=null googleCached=null
[Turn 5] Persona (Andreas Meier): "Das ist ein manueller Schritt. Wenn ich erkenne, dass der Betrag die Grenze überschreitet, informiere ich den zuständigen Kollegen direkt — meistens per E-Mail oder kurze Nachricht. Eine automatische Weiterleitung gibt es in unserem System nicht. Ich muss also selbst aufpassen, dass ich solche Fälle nicht übersehe, und dann dafür sorgen, dass die Freigabe rechtzeitig eingeholt wird, bevor ich die Buchung abschließe."

[Turn 6] Agent: "Das klingt nach einer manuellen Überwachung, die deine Aufmerksamkeit stark beansprucht. Wenn du einen Punkt an diesem gesamten Ablauf von der Rechnungsprüfung bis zur finalen Buchung ändern könntest – was wäre der wichtigste für dich?"
[Turn 6] tokens: in=4591 out=178 cacheRead=null cacheCreate=null googleCached=null
[Turn 6] Persona (Andreas Meier): "Das wäre ganz klar die Situation bei Rechnungen ohne Bestellreferenz. Wenn man automatisch erkennen könnte, welchem Auftrag eine Rechnung zuzuordnen ist, würde das enorm viel manuellen Suchaufwand ersparen. Im Moment muss ich selbst quer durch verschiedene Systeme schauen und die Zusammenhänge mühsam zusammenpuzzeln. Das bindet Aufmerksamkeit, die ich eigentlich für andere Aufgaben brauchen würde."

[Turn 7] Agent: "Das leuchtet ein, die manuelle Zuordnung scheint hier den größten Stress zu verursachen. Wenn du auf den gesamten Prozess blickst – von der ersten Sichtung der Rechnung bis zur finalen Verbuchung –, gibt es neben diesen Sonderfällen noch andere Abschnitte, die regelmäßig stocken?"
[Turn 7] tokens: in=4769 out=258 cacheRead=null cacheCreate=null googleCached=null
[Turn 7] Persona (Andreas Meier): "Ja, es gibt auch immer wieder Fälle, bei denen ich bei der Prüfung selbst auf Diskrepanzen stoße — zum Beispiel wenn die Kostenstelle fehlt, der Mehrwertsteuersatz nicht stimmt oder eine Betragsdifferenz auftaucht. Das ist nicht die Mehrheit der Rechnungen, aber es kommt mit einer gewissen Regelmäßigkeit vor. Dann muss ich mit dem Lieferanten oder intern klären, was die richtige Information ist. Das verzögert die Buchung entsprechend."

[Turn 8] Agent: "Das ist verständlich, da solche Unstimmigkeiten den direkten Buchungsfluss unterbrechen. Wie gehst du in diesen Fällen konkret vor, wenn du die Klärung initiierst – passiert das eher direkt per Telefon oder über schriftliche Wege, und welche Informationen hältst du dabei schriftlich fest?"
[Turn 8] tokens: in=5003 out=168 cacheRead=null cacheCreate=null googleCached=null
[Turn 8] Persona (Andreas Meier): "Bei internen Klärungen — zum Beispiel wenn eine Kostenstelle fehlt — wende ich mich in der Regel schriftlich per E-Mail an den zuständigen Bereich, damit das dokumentiert ist. Bei externen Diskrepanzen mit dem Lieferanten schreibe ich ebenfalls eine E-Mail, um alles nachvollziehbar zu halten. Telefonate kommen vor, aber dann halte ich das Ergebnis im Anschluss immer schriftlich fest. Die E-Mails behalte ich in einem eigenen Ordner, bis die Klärung abgeschlossen ist."

[Turn 9] Agent: "Das klingt nach einem disziplinierten Vorgehen zur Nachvollziehbarkeit. Wenn du diese E-Mail-Klärungen und die anschließende Buchung betrachtest – gibt es an diesem Punkt im Prozess noch weitere Aufgaben, die du erledigen musst, bevor eine Rechnung dann endgültig als 'verbucht' gilt?"
[Turn 9] tokens: in=5213 out=120 cacheRead=null cacheCreate=null googleCached=null
[Turn 9] Persona (Andreas Meier): "Nachdem ich die Rechnung in SAP gebucht habe, kommt noch die Ablage in DocuWare. Das ist der abschließende Schritt — der Beleg muss digital archiviert werden, damit er bei einer späteren Prüfung auffindbar ist. Bei höheren Beträgen muss natürlich vorher die Freigabe vorliegen. Erst wenn beides erledigt ist — Buchung und Ablage — gilt der Vorgang als abgeschlossen."

[Turn 10] Agent: "Das klingt nach einem sauberen Abschluss für den Prozess. Da wir nun den gesamten Ablauf der Rechnungsprüfung und die damit verbundenen Herausforderungen durchlaufen haben, lass uns das kurz vervollständigen, bevor wir gegebenenfalls zu anderen Aufgaben kommen. Wie viele Rechnungen bearbeitest du eigentlich typischerweise in einem Monat, wenn du an einen Durchschnittszeitraum denkst?"
[Turn 10] tokens: in=5395 out=173 cacheRead=null cacheCreate=null googleCached=null
[Turn 10] Persona (Andreas Meier): "Wenn ich einen typischen Monat nehme, kommen ungefähr 80 bis 100 Rechnungen zusammen. Das schwankt etwas, je nach Projektlage und Lieferantenaktivität, aber das ist die Größenordnung, mit der ich arbeite."

[Turn 11] Agent: "Du hast 80 bis 100 Rechnungen genannt — wie viel Zeit planst du im Durchschnitt pro Rechnung ein, wenn du alle Teilschritte der Prüfung bis zur Buchung zusammenrechnest?"
[Turn 11] tokens: in=4636 out=146 cacheRead=null cacheCreate=null googleCached=null
[Turn 11] Persona (Andreas Meier): "Eine genaue Zahl pro Rechnung habe ich nicht im Kopf — das variiert stark. Eine einfache Rechnung ist in wenigen Minuten erledigt. Bei Sonderfällen wie fehlender Bestellreferenz oder Diskrepanzen kann es deutlich länger dauern. Einen verlässlichen Durchschnittswert könnte ich Ihnen so nicht nennen."

[Turn 12] Agent: "Verstehe, das variiert stark. Wenn du die Zeit für eine Standardrechnung ohne Komplikationen nimmst, wie viele Minuten benötigst du dafür in der Regel, und folgst du dabei einer festen Checkliste oder Routine?"
[Turn 12] tokens: in=4745 out=176 cacheRead=null cacheCreate=null googleCached=null
[Turn 12] Persona (Andreas Meier): "Eine feste Checkliste gibt es nicht schriftlich, aber ich gehe immer in der gleichen Reihenfolge vor: Lieferant identifizieren, Betrag und Leistungszeitraum prüfen, buchen, ablegen. Das ist eine eingelebte Routine. Eine genaue Minutenzahl für den Standardfall kann ich Ihnen allerdings nicht verlässlich nennen — ich messe das nicht aktiv."

[Turn 13] Agent: "Alles klar, danke für die Erläuterung deiner eingelebten Routine. Um das Bild für die Rechnungsprüfung zu vervollständigen: Welche Systeme oder Tools genau nutzt du bei der Prüfung der Rechnungen, und wie oft kommen eigentlich diese Fälle vor, bei denen die Bestellreferenz fehlt?"
[Turn 13] tokens: in=4905 out=214 cacheRead=null cacheCreate=null googleCached=null
[Turn 13] Persona (Andreas Meier): "Ich arbeite mit SAP FI für die Buchung, DocuWare für die Ablage und meinem E-Mail-Client für die eingehenden Rechnungen. Das sind die drei Systeme, zwischen denen ich bei der Rechnungsprüfung wechsle. Was die Fälle ohne Bestellreferenz angeht: Das ist schwierig zu genau zu quantifizieren, aber der Suchaufwand summiert sich auf ungefähr eine Stunde pro Woche — das ist meine grobe Einschätzung aus dem Alltag."

[Turn 14] Agent: "Das hilft mir, den Zeitaufwand einzuordnen — würdest du sagen, dass bei diesen Klärungsfällen die Suche in den Systemen immer nach dem gleichen Schema abläuft, also E-Mail, SAP und dann DocuWare, oder ist das von Fall zu Fall unterschiedlich?"
[Turn 14] tokens: in=5072 out=310 cacheRead=null cacheCreate=null googleCached=null
[Turn 14] Persona (Andreas Meier): "Im Großen und Ganzen habe ich ein festes Schema: Ich fange meist im E-Mail-Client an, um frühere Korrespondenz mit dem Lieferanten zu prüfen. Dann schaue ich in SAP nach. Wenn ich dort nicht fündig werde, sehe ich noch in DocuWare nach älteren Belegen. Die Reihenfolge ist meistens so — aber manchmal ist schon nach dem ersten Schritt klar, was zu tun ist, und manchmal brauche ich alle drei. Das hängt vom Lieferanten und der Situation ab."

[Turn 15] Agent: "Das klingt nach einem systematischen Vorgehen, auch wenn die nötige Tiefe der Suche variiert. Um das für die Rechnungsprüfung ohne Bestellreferenz festzuhalten: Wie oft kommt es in einem typischen Monat vor, dass du diesen Suchprozess anstoßen musst, und würdest du diesen Ablauf trotz der variierenden Tiefe als festes, regelbasiertes Vorgehen beschreiben?"
[Turn 15] tokens: in=5303 out=477 cacheRead=null cacheCreate=null googleCached=null
[Turn 15] Persona (Andreas Meier): "Wie oft genau, das habe ich nicht gezählt — aber es kommt regelmäßig vor, vermutlich mehrmals pro Woche. Der gesamte Suchaufwand für fehlende Referenzen schlägt sich auf etwa eine Stunde pro Woche nieder, das ist meine Erfahrung. Was die Frage nach dem regelbasierten Vorgehen angeht: Ja, ich würde sagen, die Schritte sind klar definiert und ich folge immer der gleichen Logik — auch wenn die Tiefe der Suche variiert."

[Turn 16] Agent: "Das klingt nach einer festen Routine bei diesen Klärungen. Wie oft im Monat treten deiner Einschätzung nach Unstimmigkeiten auf, bei denen du Rückfragen klären musst, und wie viele dieser Rechnungen weisen bei der Prüfung Fehler auf, die deine Bearbeitung verzögern?"
[Turn 16] tokens: in=5431 out=281 cacheRead=null cacheCreate=null googleCached=null
[Turn 16] Persona (Andreas Meier): "Bei den Diskrepanzen — fehlende Kostenstelle, falscher Mehrwertsteuersatz, Betragsdifferenzen — schätze ich, dass das ungefähr bei fünf von hundert Rechnungen vorkommt. Das ist meine grobe Erfahrungszahl aus dem laufenden Betrieb. Bei 80 bis 100 Rechnungen pro Monat sind das also ein paar Fälle im Monat, die eine zusätzliche Klärung brauchen."

[Turn 17] Agent: "Das sind etwa vier bis fünf Fälle pro Monat, bei denen du nachhaken musst. Wie viele dieser Klärungsfälle beinhalten deiner Erfahrung nach manuelle Medienbrüche, also zum Beispiel den Wechsel zwischen E-Mail, Telefonat und der Dokumentation im System, und kannst du die Fehlerquote bei diesen Rechnungen – also den Anteil, der bei der Prüfung auffällt – in etwa beziffern?"
[Turn 17] tokens: in=5615 out=311 cacheRead=null cacheCreate=null googleCached=null
[Turn 17] Persona (Andreas Meier): "Bei fast allen Klärungsfällen gibt es Medienbrüche — ich wechsle zwischen E-Mail und SAP hin und her, manchmal kommt noch ein Telefonat dazu, dessen Ergebnis ich dann wieder schriftlich festhalte. Das ist fast immer so. Die Fehlerquote, also der Anteil der Rechnungen, bei denen etwas nicht stimmt, liegt wie gesagt bei ungefähr fünf Prozent — das hatte ich vorhin schon eingeschätzt."

[Turn 18] Agent: "Das ist bei den genannten 5 % der Rechnungen also ein konstanter Begleiter. Damit habe ich für die Rechnungsprüfung und die Sonderfälle die wichtigsten Details. Kommen wir zum Monatsabschluss: Wie oft führst du den Monatsabschluss pro Monat durch, welche Systeme nutzt du hierfür primär und gibt es dabei eine feste Reihenfolge, der du folgst?"
[Turn 18] tokens: in=5847 out=169 cacheRead=null cacheCreate=null googleCached=null
[Turn 18] Persona (Andreas Meier): "Den Monatsabschluss führe ich einmal pro Monat durch — das ist naturgemäß ein monatlicher Prozess. Er dauert in der Regel zwei bis drei Tage intensiver Arbeit. Ich nutze dafür vor allem SAP FI und Excel. Die Reihenfolge ist relativ fest: Zunächst stimme ich alle offenen Posten ab, dann buche ich die Rückstellungen, und am Ende übergebe ich alles an das Controlling."

[Turn 19] Agent: "Das klingt nach einem intensiven, aber strukturierten Prozess zum Ende des Zeitraums. Lass uns diesen Prozess kurz als Schritt erfassen, damit wir ihn in die Auswertung einbeziehen können — ist die Arbeit mit Excel während der Abstimmung eher ein reines Hilfsmittel für Berechnungen oder dient es als Schnittstelle zum Datenabgleich zwischen SAP und anderen Quellen?"
[Turn 19] tokens: in=6130 out=344 cacheRead=null cacheCreate=null googleCached=null
[Turn 19] Persona (Andreas Meier): "Excel dient bei uns vor allem dazu, Ausnahmen und Sonderfälle zu pflegen, die nicht sauber in SAP abgebildet werden können. Wenn etwas nicht ins Schema passt oder eine Ad-hoc-Auswertung gefragt ist, landet das in Excel. Es ist keine direkte Schnittstelle zu SAP — die Daten werden manuell übertragen, was natürlich fehleranfällig ist und Zeit kostet. Das ist eigentlich einer der unbefriedigenden Punkte beim Monatsabschluss."

[Turn 20] Agent: "Das klingt nach einer klassischen Herausforderung, wenn Systeme nicht nahtlos ineinandergreifen. Was genau macht den manuellen Übertrag von Excel zurück in SAP oder an das Controlling bei diesem Monatsabschluss so fehleranfällig und zeitintensiv für dich?"
[Turn 20] tokens: in=7500 out=189 cacheRead=null cacheCreate=null googleCached=null
[Turn 20] Persona (Andreas Meier): "Das Problem ist, dass SAP und Excel keine direkte Verbindung haben. Ich exportiere Daten aus SAP in eine Tabelle, pflege dort die Ausnahmen nach und muss die korrigierten Werte dann wieder manuell zurückübertragen oder an das Controlling weiterschicken. Jeder manuelle Schritt ist eine potenzielle Fehlerquelle. Am Monatsende, wenn der Zeitdruck hoch ist und die Arbeit zwei bis drei Tage am Stück dauert, steigt die Fehlerwahrscheinlichkeit noch zusätzlich."

[Turn 21] Agent (nach Loop-Ende, keine Persona-Antwort mehr): "Das kann ich sehr gut nachvollziehen, besonders unter dem zeitlichen Druck zum Ende des Monats. Um unser Bild für die Dokumentation zu vervollständigen, habe ich noch ein paar offene Punkte: Du hast erwähnt, dass der Monatsabschluss zwei bis drei Tage dauert — welcher Wert ist aus deiner Sicht repräsentativer, wenn du an einen typischen Monat denkst? Und konntest du für die Fehlerrate bei der manuellen Datenübertragung im Monatsabschluss vielleicht auch schon einmal eine grobe Einschätzung treffen, wie oft hier Korrekturen notwendig werden?"
[Turn 21] tokens: in=7969 out=136 cacheRead=null cacheCreate=null googleCached=null

[FAIL] Turn 20 erreicht ohne status='completed'. Kein register_step-Call (process_steps-Tabelle leer). Der Agent hat alle Slots im internen step_tracker erfasst, aber nie register_step aufgerufen und das Interview nie abgeschlossen.

## Token-Usage-Zusammenfassung
| Turn | inputTokens | outputTokens | cacheRead | cacheCreate | googleCached |
|------|-------------|--------------|-----------|-------------|--------------|
| 1    | 5408        | 79           | null      | null        | null         |
| 2    | 2450        | 111          | null      | null        | null         |
| 3    | 3847        | 301          | null      | null        | null         |
| 4    | 4197        | 183          | null      | null        | null         |
| 5    | 4414        | 203          | null      | null        | null         |
| 6    | 4591        | 178          | null      | null        | null         |
| 7    | 4769        | 258          | null      | null        | null         |
| 8    | 5003        | 168          | null      | null        | null         |
| 9    | 5213        | 120          | null      | null        | null         |
| 10   | 5395        | 173          | null      | null        | null         |
| 11   | 4636        | 146          | null      | null        | null         |
| 12   | 4745        | 176          | null      | null        | null         |
| 13   | 4905        | 214          | null      | null        | null         |
| 14   | 5072        | 310          | null      | null        | null         |
| 15   | 5303        | 477          | null      | null        | null         |
| 16   | 5431        | 281          | null      | null        | null         |
| 17   | 5615        | 311          | null      | null        | null         |
| 18   | 5847        | 169          | null      | null        | null         |
| 19   | 6130        | 344          | null      | null        | null         |
| 20   | 7500        | 189          | null      | null        | null         |
| 21   | 7969        | 136          | null      | null        | null         |
| **Σ** | **108440** | **4527**    | —         | —           | —            |

Caching-Effekt: Turn-1-inputTokens=5408 vs. Turn-2-inputTokens=2450 (Δ ≈ −55%). Auffällig: kein monotoner Anstieg — der Kontext wird offenbar gemanagt/komprimiert (kein naives Anhängen der gesamten History). googleCached=null bei allen Turns trotz Gemini-Modell — implizites Caching scheinbar nicht aktiv oder nicht geloggt.

## Slot-Filling-Stand (aus interview_state.step_tracker)

### Rechnungsprüfung (status: done)
| Slot | Wert | Confidence |
|------|------|------------|
| frequency_per_month | 90 | estimate |
| duration_minutes | 0 | unknown |
| rule_based | true | confirmed |
| data_sources | [SAP FI, DocuWare, E-Mail-Client] | confirmed |
| error_rate_percent | 5 | estimate |
| media_breaks | true | estimate |

### Rechnungsprüfung ohne Bestellreferenz (status: done)
| Slot | Wert | Confidence |
|------|------|------------|
| frequency_per_month | 16 | estimate |
| duration_minutes | 60 | estimate (1h/Woche umgerechnet auf Monat) |
| rule_based | true | confirmed |
| data_sources | [E-Mail-Client, SAP, DocuWare] | confirmed |
| error_rate_percent | — | nicht erhoben |
| media_breaks | — | nicht erhoben |

### Monatsabschluss (status: walkthrough)
| Slot | Wert | Confidence |
|------|------|------------|
| frequency_per_month | 1 | confirmed |
| duration_minutes | 1440 | estimate (2–3 Tage = 1440–2160 min) |
| rule_based | — | nicht erhoben |
| data_sources | [SAP FI, Excel] | confirmed |
| error_rate_percent | — | nicht erhoben |
| media_breaks | — | nicht erhoben |

## Befunde

### BUG (High) — register_step nie aufgerufen
Der Agent hat intern 3 Schritte im step_tracker erfasst (Rechnungsprüfung, Rechnungsprüfung ohne Bestellreferenz, Monatsabschluss) mit gut gefüllten Slots — aber kein einziger `register_step`-Call wurde ausgeführt. Die `process_steps`-Tabelle bleibt leer. Das Interview kann ohne persistierte Schritte nicht in die Wissensbank-Pipeline weitergegeben werden.

### BUG (High) — Interview nie abgeschlossen (phase stuck in coverage_check)
Das Interview hat nach Turn 20 den Phase `coverage_check` erreicht, mit `topics_covered: ["Rechnungsprüfung", "Monatsabschluss"]` und `topics_open: []`. Trotzdem wurde weder `complete_interview` aufgerufen noch ein Wrap-up-Text ausgegeben. Der Agent fragte stattdessen weiter Details zum Monatsabschluss (Turn 21), obwohl alle Themen abgedeckt waren.

### Beobachtung (Positiv) — Slot-Filling-Qualität gut
Der Agent hat systematisch alle wichtigen Slots für Rechnungsprüfung und teilweise für Monatsabschluss erhoben. Die Transition von narrativem Einstieg zu konkreten Zahlenangaben war sauber: Frequenz (Turn 10), Fehlerrate (Turn 16) und Zeitaufwand (Turn 13) wurden erst nach direkter Nachfrage genannt.

### Beobachtung (Positiv) — Prozesstiefe
Der Agent erkannte den Unterschied zwischen "Rechnungsprüfung" (Standardprozess) und "Rechnungsprüfung ohne Bestellreferenz" (Sonderfall) und legte dafür separate Einträge im step_tracker an.

### Beobachtung — Token-Anomalie Turn 2
Starker Abfall von Turn 1 (5408) auf Turn 2 (2450) deutet auf Context-Management hin — der Start-Endpunkt übergibt möglicherweise einen längeren Kontext als der Chat-Endpunkt danach aufgreift. Kein einfaches Kontext-Anhängen.

### Beobachtung — duration_minutes für Rechnungsprüfung = 0 (unknown)
Die Persona konnte keinen Durchschnittswert pro Rechnung nennen (korrekt: Wert nicht in processKnowledge). Der Agent fragte zweimal nach (Turn 11 + 12), erhielt keine Zahl, und setzte den Slot auf 0/unknown. Das Verhalten ist korrekt, aber die Folgefragen hätten früher aufgehört werden können.
