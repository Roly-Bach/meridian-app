---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-27
persona: buchhalter
interview_id: 4e850087-11d3-43bb-8291-447443f8fb2f
turns_total: 16
---

[Turn 1] Agent: "Ich möchte verstehen, welche Aufgaben dich in deinem Arbeitsalltag am meisten Zeit kosten und wo wir dir die Arbeit erleichtern können. Erzähl mir kurz: Was sind deine Hauptaufgaben und wie sieht ein typischer Arbeitstag bei dir aus?"
[Turn 1] tokens: in=2658 out=99 cacheRead=0 cacheCreate=null googleCached=0
[Turn 1] Persona (Andreas Meier): "Meine Hauptaufgaben liegen im Bereich der Kreditorenbuchhaltung. Der größte Teil meines Tages dreht sich um die Rechnungsprüfung — täglich kommen Rechnungen per E-Mail herein, die ich prüfe, buche und ablege. Dabei muss ich sicherstellen, dass Lieferant, Betrag und Leistungszeitraum korrekt erfasst sind. Zum Monatsende kommt der Monatsabschluss hinzu — das ist eine besonders intensive Phase, in der ich offene Posten abstimme, Rückstellungen buche und alles ans Controlling übergebe."

[Turn 2] Agent: "Die Rechnungsprüfung nimmt den größten Teil deines Tages ein, daher beginnen wir mit diesem Prozess — wie läuft die Prüfung einer Rechnung ab, wenn sie gerade bei dir eingegangen ist?"
[Turn 2] tokens: in=2763 out=108 cacheRead=0 cacheCreate=null googleCached=0
[Turn 2] Persona (Andreas Meier): "Wenn eine Rechnung per E-Mail eingeht, schaue ich mir zunächst die Grunddaten an — stimmt der Lieferant, ist der Betrag plausibel, passt der Leistungszeitraum zu dem, was wir tatsächlich bestellt haben? Anschließend buche ich die Rechnung in SAP FI, ordne ihr die richtige Kostenstelle zu und lege das Dokument in DocuWare ab. Bei Rechnungen über einem bestimmten Betrag brauche ich noch eine Zweit-Freigabe, bevor ich buchen kann — das ist intern so geregelt."

[Turn 3] Agent: "Du hast den Ablauf von der Prüfung über die Buchung bis zur Zweit-Freigabe beschrieben — wo hakt es bei diesem Prozess am häufigsten und kostet dich am meisten Zeit oder Energie?"
[Turn 3] tokens: in=4431 out=40 cacheRead=4004 cacheCreate=null googleCached=4004
[Turn 3] Persona (Andreas Meier): "Das größte Problem sind Rechnungen, bei denen keine Bestellreferenz angegeben ist. Dann muss ich manuell in mehreren Systemen nachforschen, wer intern der Auftraggeber war — das ist regelmäßig zeitaufwändig. Ein weiteres Problem sind Unstimmigkeiten: manchmal fehlt die Kostenstelle, manchmal ist der Mehrwertsteuersatz falsch oder es gibt eine Betragsdifferenz. Diese Fälle muss ich einzeln klären, was immer zusätzliche Kommunikation erfordert."

[Turn 4] Agent: "Das klingt nach einer hohen Belastung durch manuelle Recherche und Klärungsbedarf bei Unstimmigkeiten. Was macht die Kommunikation bei solchen Unstimmigkeiten so schwierig – liegt es an der Erreichbarkeit der Kollegen oder daran, dass die Informationen oft unvollständig sind?"
[Turn 4] tokens: in=4490 out=190 cacheRead=0 cacheCreate=null googleCached=0
[Turn 4] Persona (Andreas Meier): "Es ist beides. Zum einen fehlen die Informationen oft bereits auf der Rechnung selbst — wenn keine Bestellnummer oder kein Auftraggeber angegeben ist, stehe ich vor einer Recherche, die mehrere Systeme involviert. Zum anderen ist die Erreichbarkeit der zuständigen Kollegen nicht immer sofort gegeben, gerade in der Monatsendphase, wenn alle unter Druck stehen. Manchmal geht eine Rechnung dadurch mehrere Tage hin und her, bevor der Fall geklärt ist."

[Turn 5] Agent: "Das ist eine schwierige Kombination aus mangelnder Datenqualität auf den Dokumenten und Zeitdruck bei den Ansprechpartnern. Wenn du einen Punkt an diesem Prozess der Rechnungsprüfung ändern könntest, um dir den Alltag zu erleichtern – was wäre das?"
[Turn 5] tokens: in=4770 out=157 cacheRead=0 cacheCreate=null googleCached=0
[Turn 5] Persona (Andreas Meier): "Am liebsten würde ich das Problem mit den fehlenden Bestellreferenzen automatisiert lösen. Wenn das System die Rechnung automatisch mit einer Bestellung oder einem Auftrag abgleichen könnte, würde ich mir sehr viel manuelle Sucharbeit sparen. Im Moment mache ich das in SAP FI, dann in DocuWare und manchmal noch per E-Mail — das ließe sich sicher intelligenter gestalten."

[Turn 6] Agent: "Das klingt nach einer erheblichen Entlastung, wenn der Abgleich systemseitig erfolgen könnte. Da wir uns nun ein Bild von der Rechnungsprüfung gemacht haben, wie gehst du beim Monatsabschluss vor, um die offenen Posten abzustimmen und Rückstellungen zu buchen?"
[Turn 6] tokens: in=5032 out=230 cacheRead=0 cacheCreate=null googleCached=0
[Turn 6] Persona (Andreas Meier): "Der Monatsabschluss beginnt damit, dass ich alle offenen Posten in SAP FI durchgehe und prüfe, ob noch Buchungen fehlen oder ob es Unstimmigkeiten gibt. Dann buche ich die Rückstellungen — für Lieferungen, die zwar eingegangen sind, aber noch keine Rechnung haben. Abschließend bereite ich die Übergabe ans Controlling vor und stelle sicher, dass alle Konten korrekt abgestimmt sind. Die Ausnahmen, die sich nicht direkt in SAP abbilden lassen, pflege ich dabei manuell in Excel nach."

[Turn 7] Agent: "Der Monatsabschluss umfasst also die Abstimmung in SAP FI, die Buchung von Rückstellungen und die manuelle Ergänzung in Excel. An welcher Stelle dieses Prozesses entstehen für dich die meisten Reibungsverluste oder Verzögerungen?"
[Turn 7] tokens: in=5257 out=202 cacheRead=0 cacheCreate=null googleCached=0
[Turn 7] Persona (Andreas Meier): "Der größte Reibungspunkt ist der Zeitdruck am Monatsende. In dieser Phase muss alles abgestimmt und übergeben sein, aber genau dann kommen oft noch Rechnungen oder Korrekturen rein. Dazu kommt, dass manche Ausnahmen einfach nicht sauber in SAP abgebildet werden können — die landen dann in Excel, und das manuelle Nachpflegen ist fehleranfällig und kostet zusätzlich Zeit."

[Turn 8] Agent: "Das manuelle Nachpflegen von Ausnahmen in Excel während des ohnehin schon engen Zeitfensters am Monatsende ist kritisch. Welcher Aspekt dieser manuellen Excel-Tätigkeit ist dabei am fehleranfälligsten oder kostet dich die meiste Zeit?"
[Turn 8] tokens: in=5498 out=263 cacheRead=0 cacheCreate=null googleCached=0
[Turn 8] Persona (Andreas Meier): "Das Kritischste ist die fehlende Systemintegration. Wenn ich eine Ausnahme in Excel nachpflege, muss ich sicherstellen, dass sie auch korrekt im SAP-Abschluss berücksichtigt wird. Das bedeutet, ich habe am Ende zwei Datenquellen, die ich manuell abgleichen muss — da schleichen sich Fehler ein, besonders unter Zeitdruck. Einmal hatte ich einen Rückstellungsbetrag doppelt erfasst, der erst im Folgeabschluss aufgefallen ist."

[Turn 9] Agent: "Das manuelle Abgleichen der beiden Quellen Excel und SAP ist eine fehleranfällige Doppelarbeit, besonders wenn der Zeitdruck steigt. Wie gehst du konkret vor, um sicherzustellen, dass die manuell in Excel gepflegten Daten am Ende korrekt in deinen Abschluss in SAP einfließen?"
[Turn 9] tokens: in=5783 out=163 cacheRead=0 cacheCreate=null googleCached=0
[Turn 9] Persona (Andreas Meier): "Im Moment habe ich dafür keinen formalisierten Prozess — ich gehe die Excel-Tabelle am Ende manuell durch und prüfe jede Position gegen SAP. Das ist zeitaufwändig und eigentlich eine Kontrollaktivität, die ich nebenbei erledigen muss. Eine integrierte Lösung wäre deutlich effizienter, aber das haben wir bislang nicht umgesetzt."

[Turn 10] Agent: "Das manuelle Abgleichen ist also eher eine mühsame Kontrolltätigkeit am Ende, statt eines integrierten Prozesses. Da wir nun beide Prozesse – die Rechnungsprüfung und den Monatsabschluss – im Durchgang betrachtet haben: Welche der genannten Herausforderungen würdest du als die insgesamt kritischste für deinen Arbeitsalltag bezeichnen?"
[Turn 10] tokens: in=6025 out=132 cacheRead=0 cacheCreate=null googleCached=0
[Turn 10] Persona (Andreas Meier): "Das größte Problem im Alltag ist die Rechnungsprüfung bei fehlenden Bestellreferenzen. Das betrifft mich am häufigsten — nicht nur einmal im Monat wie beim Abschluss, sondern regelmäßig im laufenden Betrieb. Der Zeitaufwand summiert sich, und es unterbricht meinen Arbeitsfluss jedes Mal, wenn ich in mehreren Systemen suchen muss."

[Turn 11] Agent: "Das ist eine deutliche Belastung im operativen Tagesgeschäft. Um das einzuordnen: Wie viele Rechnungen bearbeitest du ungefähr in einem typischen Monat, und wie lange sitzt du im Durchschnitt an einer – also von der ersten Prüfung bis zur finalen Ablage, über alle Fälle hinweg betrachtet?"
[Turn 11] tokens: in=5510 out=122 cacheRead=0 cacheCreate=null googleCached=0
[Turn 11] Persona (Andreas Meier): "Es sind ungefähr 80 bis 100 Rechnungen pro Monat. Bei der Dauer ist es schwer eine Zahl zu nennen — eine Standardrechnung, bei der alles stimmt, ist in wenigen Minuten abgehakt. Aber die Fälle ohne Bestellreferenz oder mit Diskrepanzen ziehen sich deutlich länger hin, da komme ich schon mal auf eine halbe Stunde für eine einzige Rechnung."

[Turn 12] Agent: "Das ist ein deutlicher Unterschied zwischen einer Standardrechnung und den komplexen Fällen — um das einzuordnen: Wie lange sitzt du im Durchschnitt über alle Rechnungen gerechnet an einer, also wenn du die schnellen und die aufwändigen Fälle zusammennimmst? Und damit ich das Bild der Rechnungsprüfung komplett habe: Läuft dieser Prozess nach einem festen Schema oder einer Checkliste ab, und welche Systeme nutzt du dabei neben SAP FI und DocuWare?"
[Turn 12] tokens: in=5710 out=223 cacheRead=0 cacheCreate=null googleCached=0
[Turn 12] Persona (Andreas Meier): "Eine genaue Durchschnittszahl habe ich da nicht im Kopf. Was ich sagen kann: Die Sonderfälle — vor allem Rechnungen ohne Bestellreferenz — kosten mich insgesamt rund eine Stunde pro Woche zusätzlich. Zum Ablauf: Einen schriftlichen Prozess oder eine Checkliste haben wir nicht, aber ich gehe immer nach demselben Schema vor. Die Hauptsysteme sind SAP FI für die Buchung, DocuWare für die Ablage und der E-Mail-Client als Eingangskanal."

[Turn 13] Agent: "Da wir das Schema der Rechnungsprüfung nun haben, lass uns das noch kurz quantifizieren: Wie viele Minuten benötigst du im Schnitt pro Rechnung, wenn du alle Standardfälle und die komplexen Ausnahmen über den Monat hinweg zusammennimmst? Und beim Monatsabschluss: Wie viele Male im Monat führst du diesen Prozess durch und wie viel Zeit beansprucht ein solcher Abschluss insgesamt?"
[Turn 13] tokens: in=6354 out=177 cacheRead=3977 cacheCreate=null googleCached=3977
[Turn 13] Persona (Andreas Meier): "Bei der Rechnungsprüfung habe ich keine gemessene Durchschnittszahl — eine Standardrechnung vielleicht 5 bis 10 Minuten, eine Problemrechnung deutlich mehr, da bin ich schon eine halbe Stunde beschäftigt. Den Monatsabschluss führe ich einmal pro Monat durch, und der beansprucht insgesamt 2 bis 3 Tage — das ist wirklich eine intensive Phase."

[Turn 14] Agent: "Bei zwei bis drei Tagen für den Monatsabschluss ist das ein erheblicher Block in deinem Kalender. Läuft dieser Prozess dabei immer nach einem festen Schema ab und welche Systeme außer SAP und Excel nutzt du für die Abstimmung und Übergabe?"
[Turn 14] tokens: in=6186 out=279 cacheRead=0 cacheCreate=null googleCached=0
[Turn 14] Persona (Andreas Meier): "Ja, der Monatsabschluss läuft immer nach demselben Muster ab — erst offene Posten in SAP FI abstimmen, dann Rückstellungen buchen, dann alles für das Controlling aufbereiten und übergeben. Weitere spezialisierte Systeme nutze ich dafür nicht, nur SAP FI und Excel. Die Kommunikation mit dem Controlling läuft über E-Mail."

[Turn 15] Agent: "Das ist ein klarer Ablauf — folgst du dabei einer festen internen Richtlinie oder Checkliste, um sicherzustellen, dass keine Buchung vergessen wird? Und wenn du an die Systeme denkst, die du nutzt: Greifst du für die Datenbasis beim Abschluss neben SAP FI und Excel noch auf andere Quellen wie etwa E-Mail-Postfächer oder interne Verzeichnisse zu?"
[Turn 15] tokens: in=6327 out=276 cacheRead=3988 cacheCreate=null googleCached=3988
[Turn 15] Persona (Andreas Meier): "Eine formale Checkliste haben wir nicht schriftlich — ich habe den Ablauf über die Jahre verinnerlicht. Für die Datenbasis greife ich neben SAP FI und Excel hauptsächlich auf das E-Mail-Postfach zurück, um ausstehende Belege oder Rückfragen zu prüfen. Ein zentrales Verzeichnis oder Ticketsystem nutzen wir dafür nicht."

[Turn 16] Agent: "Vielen Dank für die Einblicke in deinen Arbeitsalltag, das hilft mir sehr weiter. Gibt es zum Abschluss noch etwas, das ich bei der Auswertung deiner Prozesse unbedingt berücksichtigen sollte?"
[Turn 16] tokens: in=6152 out=52 cacheRead=3973 cacheCreate=null googleCached=3973
[Turn 16] Persona (Andreas Meier): *(Interview bereits auf status=completed gesetzt — kein weiterer Turn gesendet)*

[PASS] Interview abgeschlossen in Turn 16 (status=completed). Beide Prozessschritte registriert mit allen 3 Pflicht-Slots gefüllt.

## Token-Usage-Zusammenfassung
| Turn | inputTokens | outputTokens | cacheRead | cacheCreate | googleCached |
|------|-------------|--------------|-----------|-------------|--------------|
| 1    | 2658        | 99           | 0         | null        | 0            |
| 2    | 2763        | 108          | 0         | null        | 0            |
| 3    | 4431        | 40           | 4004      | null        | 4004         |
| 4    | 4490        | 190          | 0         | null        | 0            |
| 5    | 4770        | 157          | 0         | null        | 0            |
| 6    | 5032        | 230          | 0         | null        | 0            |
| 7    | 5257        | 202          | 0         | null        | 0            |
| 8    | 5498        | 263          | 0         | null        | 0            |
| 9    | 5783        | 163          | 0         | null        | 0            |
| 10   | 6025        | 132          | 0         | null        | 0            |
| 11   | 5510        | 122          | 0         | null        | 0            |
| 12   | 5710        | 223          | 0         | null        | 0            |
| 13   | 6354        | 177          | 3977      | null        | 3977         |
| 14   | 6186        | 279          | 0         | null        | 0            |
| 15   | 6327        | 276          | 3988      | null        | 3988         |
| 16   | 6152        | 52           | 3973      | null        | 3973         |
| **Σ** | **82946** | **2713**    | **15942** | **null**    | **15942**    |

Caching-Effekt: Turn-1-inputTokens (2658) vs. Turn-3-inputTokens (4431) zeigt noch kein Caching. Gemini Implicit Caching griff unregelmäßig bei Turn 3, 13, 15, 16 (googleCachedTokens > 0). Kein konsistentes Muster — vermutlich Prompt-Länge triggert den Cache-Threshold unterschiedlich je nach Konversationsstand.

## Slot-Filling-Stand (aus interview_state.step_tracker)

| Prozess | frequency_per_month | duration_minutes | rule_based | data_sources | status |
|---------|--------------------:|----------------:|-----------|-------------|--------|
| Rechnungsprüfung | 90 (estimate) | 15 min (estimate) | true (estimate) | SAP FI, DocuWare, E-Mail-Client | done |
| Monatsabschluss | 1 (confirmed) | 1500 min / ~2,5 Tage (estimate) | true (confirmed) | SAP FI, Excel, E-Mail | done |

Pflicht-Slots (`frequency_per_month`, `duration_minutes`, `rule_based`): alle 6 Slots gefüllt (2 Prozesse × 3 Pflicht-Slots = 6/6).

## Befunde

1. **PASS**: Beide Prozessschritte vollständig via `register_step` erfasst, alle Pflicht-Slots gefüllt.
2. **PASS**: `status=completed` nach 16 Turns — sauberer Lifecycle intro → process_loop → wrap_up → complete_interview.
3. **Beobachtung — Doppelnachfrage duration_minutes**: Agent fragte Turn 11 und Turn 13 jeweils nach der Durchschnittsdauer pro Rechnung. Der Agent akzeptierte "keine genaue Zahl" nicht sofort und fragte erneut — korrekt für Slot-Filling, aber zwei Turns dafür.
4. **Beobachtung — kein Sprung zu additionalContext**: Der `additionalContext` der Persona (Mahnprozess) wurde nie angesprochen. Der Agent fragte nicht danach, und die Persona brachte es mangels Anlass nicht von sich aus. Dieser Aspekt fehlt im step_tracker.
5. **Beobachtung — Wechsel zu Monatsabschluss vor duration-Klärung**: Agent wechselte in Turn 6 zum Monatsabschluss, obwohl `duration_minutes` für Rechnungsprüfung noch nicht gesetzt war. Slot wurde erst in Turn 13 nachgeholt — möglicher Hinweis auf suboptimale Slot-Completion-Reihenfolge im Agent.
6. **Caching unregelmäßig**: googleCachedTokens griff nur bei 4 von 16 Turns. Erwartung bei stabilen System-Prompts wäre höhere Trefferquote ab Turn 2. Mögliche Ursache: variable Konversationslänge überschreitet Cache-Threshold nicht konsistent.
7. **Persona-Stil korrekt**: Narrative Einstiege ohne konkrete Zahlen, Zahlen erst auf direkte Nachfrage — Tendencies der Buchhalter-Persona sauber abgebildet.
