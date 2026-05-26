---
interview_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-25
persona: buchhalter
interview_id: cf5fc1bc-29d7-4a53-9d62-fff25c9c4e36
turns_total: 14
---

[Turn 1] Agent: "Guten Tag, Herr Meier! Mein Name ist der Meridian-Interviewer. Ich unterstütze Sie heute dabei, Ihre Arbeitsabläufe in der Finanzbuchhaltung besser zu verstehen – es geht dabei nicht um eine Bewertung Ihrer Leistung, sondern darum, die Prozesse selbst zu dokumentieren, um sie vielleicht langfristig einfacher zu gestalten. Damit ich ein Gefühl für Ihren Arbeitsalltag bekomme: Welche Rolle füllen Sie genau in der Finanzbuchhaltung aus und wie sieht ein typischer Arbeitstag bei Ihnen aus?"

[Turn 1] Persona (Andreas Meier): "Guten Tag. Ich bin seit zwölf Jahren in der Finanzbuchhaltung tätig und bin hier hauptsächlich für die Kreditoren-Buchhaltung zuständig. Ein typischer Arbeitstag beginnt damit, dass ich eingehende Rechnungen per E-Mail sichte, prüfe und in SAP FI erfasse. Dazu kommen laufende Abstimmungen und gegen Monatsende der Abschluss, der in der Regel zwei bis drei Tage intensiver Arbeit bedeutet."

[Turn 2] Agent: "Guten Tag, Herr Meier. Schön, dass Sie sich Zeit für dieses Gespräch nehmen. Mein Name ist Ihr KI-Interviewer von Meridian und mein Ziel ist es, Ihr wertvolles Prozesswissen strukturiert zu dokumentieren, damit wir Verbesserungspotenziale in der Finanzbuchhaltung besser verstehen können – es geht dabei ausdrücklich nicht um eine Bewertung Ihrer Arbeit. Wenn ich Sie richtig verstehe, bildet die Sichtung und Erfassung eingehender Rechnungen in SAP FI den Kern Ihres Tagesgeschäfts, ergänzt durch die intensiven Monatsabschlussarbeiten. Welchen dieser Schritte, also die Rechnungsprüfung oder den Monatsabschluss, sollten wir uns als Erstes einmal im Detail ansehen?"

[Turn 2] Persona (Andreas Meier): "Fangen wir mit der Rechnungsprüfung an — das ist das tägliche Brot. Der Monatsabschluss baut darauf auf."

[Turn 3] Agent: "Das ist ein guter Startpunkt, die Rechnungsprüfung ist ja tatsächlich das Fundament. Könnten Sie mich einmal durch einen ganz konkreten Fall der Rechnungsprüfung führen – von dem Moment an, in dem die E-Mail mit der Rechnung bei Ihnen eintrifft, bis zu dem Punkt, an dem die Erfassung im SAP FI abgeschlossen ist?"

[Turn 3] Persona (Andreas Meier): "Sehr gerne. Die Rechnung kommt per E-Mail auf ein gemeinsames Postfach. Schritt eins: Ich prüfe, ob Lieferant, Betrag und Leistungszeitraum plausibel sind und ob eine Bestellreferenz vorhanden ist. Schritt zwei: Ich erfasse die Rechnung in SAP FI — Buchungskreis, Kostenstelle, Mehrwertsteuerschlüssel. Schritt drei: Die Rechnung wird in DocuWare abgelegt und verknüpft. Bei Beträgen über 5.000 Euro ist zusätzlich eine Zweit-Freigabe durch meine Teamleiterin erforderlich, bevor die Buchung final gesetzt wird. Insgesamt verarbeite ich so zwischen 80 und 100 Rechnungen pro Monat."

[Turn 4] Agent: "Das ist ein sehr klarer Ablauf, danke für die detaillierte Beschreibung. Wenn wir uns diesen Prozess ansehen, stellt sich mir die Frage: Wie viel Zeit nimmt die Prüfung und Erfassung einer solchen Rechnung im Durchschnitt in Anspruch, wenn alles reibungslos verläuft?"

[Turn 4] Persona (Andreas Meier): "Eine exakte Zeitmessung haben wir nie durchgeführt. Ich würde grob schätzen: Bei einer unkomplizierten Rechnung mit vorhandener Bestellreferenz sind es vielleicht 10 bis 15 Minuten. Problematisch wird es, wenn die Bestellreferenz fehlt — dann suche ich manuell in drei verschiedenen Systemen nach dem Auftraggeber, das kostet mich schätzungsweise eine Stunde pro Woche insgesamt."

[Turn 5] Agent: "Das klingt nach einem sehr zeitraubenden Prozess, besonders wenn die Bestellreferenz fehlt und Sie diese manuell über mehrere Systeme hinweg suchen müssen. Wenn wir bei der Rechnungsprüfung bleiben: Läuft die Prüfung und Erfassung immer nach einer festen Checkliste oder einem bestimmten Regelwerk ab, oder hängt das stark vom jeweiligen Lieferanten ab?"

[Turn 5] Persona (Andreas Meier): "Im Grundsatz ist der Ablauf immer gleich und klar definiert: Lieferant, Betrag, Leistungszeitraum prüfen, in SAP FI buchen, in DocuWare ablegen. Das ist eine feste Reihenfolge. Die Ausnahme ist die fehlende Bestellreferenz — da gibt es keinen strukturierten Prozess, das handhabe ich dann situativ. Und bei Beträgen über 5.000 Euro greift die Zweit-Freigabepflicht, das ist ebenfalls fest geregelt."

[Turn 6] Agent: "Das ist sehr hilfreich, danke für die Einordnung dieser strukturierten Abläufe und der Ausnahme bei den Bestellreferenzen. Wenn Sie nun an die Erfassung in SAP FI denken, aus welchen Systemen oder Dokumenten ziehen Sie dabei eigentlich die notwendigen Daten?"

[Turn 6] Persona (Andreas Meier): "Die Hauptquelle ist die Rechnung selbst, die per E-Mail-Client empfangen wird. Daneben prüfe ich in SAP FI selbst, ob die Kostenstelle und der Buchungskreis korrekt sind — das ergibt sich aus dem Lieferanten-Stammdatensatz. DocuWare nutze ich für die Ablage und als Archivierungsnachweis. In Ausnahmefällen, wenn keine Bestellreferenz vorhanden ist, muss ich zusätzlich im E-Mail-Archiv und in SAP MM nach der ursprünglichen Bestellung recherchieren."

[Turn 7] Agent: "Vielen Dank, das ist sehr aufschlussreich. Sie nutzen also eine Kombination aus E-Mail-Systemen und SAP-Modulen, um die Daten zusammenzuführen, wobei besonders die manuelle Suche bei fehlenden Referenzen den Prozess verlangsamt. Lassen Sie uns nun den zweiten Aspekt beleuchten, den Sie eingangs erwähnt haben: den Monatsabschluss. Erzählen Sie mir doch bitte, wie ein typischer Monatsabschluss bei Ihnen abläuft und welche Schritte dort für Sie die größte Herausforderung darstellen?"

[Turn 7] Persona (Andreas Meier): "Der Monatsabschluss beginnt typischerweise am letzten Arbeitstag des Monats und zieht sich über zwei bis drei Tage. Ich stimme zunächst alle offenen Posten in SAP FI ab — das heißt, ich prüfe, ob alle Rechnungen gebucht und ob Konten korrekt saldiert sind. Dann buche ich die Rückstellungen für Leistungen, die eingegangen sind aber noch keine Rechnung haben. Abschließend erstelle ich eine Übergabe-Datei für das Controlling. Die größte Herausforderung ist der Zeitdruck — und die Tatsache, dass Ausnahmen, die nicht sauber in SAP abgebildet werden können, manuell in Excel nachgepflegt werden müssen. Das ist fehleranfällig."

[Turn 8] Agent: "Das ist verständlich, besonders wenn manuelle Excel-Tabellen zum Flaschenhals werden. Wenn wir den Prozess des Monatsabschlusses genauer betrachten: Wie viele dieser Abschlüsse führen Sie pro Jahr durch – sind es zwölf, oder gibt es noch unterjährige Anpassungen, die Sie als ähnliche Zyklen einplanen müssen?"

[Turn 8] Persona (Andreas Meier): "Es sind regulär zwölf Monatsabschlüsse pro Jahr. Dazu kommt noch der Jahresabschluss, der deutlich aufwändiger ist und externe Prüfer einbezieht — aber den betreue ich nur unterstützend. Quartalsweise gibt es zusätzliche Abstimmungen für das Management-Reporting, die aber weniger formal sind."

[Turn 9] Agent: "Vielen Dank für diese Klarstellung, es sind also klassischerweise zwölf Monatsabschlüsse pro Jahr. Um das Bild für den Monatsabschluss noch weiter zu vervollständigen: Wenn Sie von diesen zwei bis drei Tagen intensiver Arbeit für einen Monatsabschluss sprechen, wie viele Stunden reiner Arbeitszeit würden Sie insgesamt dafür veranschlagen?"

[Turn 9] Persona (Andreas Meier): "Ich würde sagen, zwei bis drei Tage intensive Arbeit bedeutet in der Praxis 16 bis 24 Stunden, wenn ich es in Stunden ausdrücke. Zwischendurch kommen immer noch Rechnungen rein — aber der Hauptteil der Energie fließt in den Abschluss. Ich würde realistisch mit 20 Stunden pro Monat kalkulieren."

[Turn 10] Agent: "Vielen Dank, Herr Meier. Damit haben wir nun alle wesentlichen Informationen zu den von Ihnen genannten Schritten zusammengetragen. Wir haben heute die Rechnungsprüfung und den Monatsabschluss als zentrale Tätigkeiten identifiziert. Bevor wir zum Abschluss kommen: Gibt es aus Ihrer Sicht noch etwas Wichtiges, das in unserer Prozessaufnahme bisher nicht zur Sprache kam, oder haben wir die wesentlichen Herausforderungen Ihres Arbeitsalltags damit abgedeckt?"

[Turn 10] Persona (Andreas Meier): "Es gibt noch den monatlichen Mahnprozess — den haben wir heute noch nicht besprochen. Der ist ebenfalls zeitaufwändig: Ich prüfe offene Forderungen, versende Mahnungen in mehreren Stufen und dokumentiere die Korrespondenz. Das läuft parallel zum normalen Tagesgeschäft und bringt besonders am Monatsende zusätzlichen Druck."

[Turn 11] Agent: "Das ist ein sehr wertvoller Hinweis, Herr Meier, da der Mahnprozess die Belastung am Monatsende offensichtlich noch einmal deutlich erhöht. Lassen Sie uns diesen Schritt kurz strukturiert erfassen, bevor wir abschließen. Wie oft führen Sie diesen Mahnprozess im Monat durch und wie lange dauert ein vollständiger Durchlauf in etwa?"

[Turn 11] Persona (Andreas Meier): "Der Mahnprozess läuft einmal pro Monat, meist in der ersten Woche des Folgemonats. Eine genaue Stundenangabe habe ich dazu nicht parat — ich würde schätzen, ein bis zwei Tage pro Monat, aber das variiert stark je nach Mahnstufe und wie kooperativ die Schuldner sind. Zu den genauen Zahlen müsste ich in meinen Unterlagen nachschauen."

[Turn 12] Agent: "Vielen Dank für diese Einschätzung. Um das Bild für den Mahnprozess noch vollständig zu machen: Läuft dieser Prozess bei Ihnen ebenfalls nach einem festen Schema, wie etwa einer festgelegten Abfolge von Mahnstufen und Prüfschritten, ab?"

[Turn 12] Persona (Andreas Meier): "Ja, das ist klar geregelt: Erste Mahnstufe nach 14 Tagen Zahlungsverzug, zweite Mahnstufe nach weiteren 14 Tagen, danach übergebe ich an die Rechtsabteilung. Die Mahnstufen und Texte sind in SAP FI vordefiniert — das ist standardisiert. Was manuell bleibt, ist die Dokumentation der Telefonate und Sonderfälle."

[Turn 13] Agent: "Da wir nun alle wichtigen Prozesse erfasst haben, gehe ich zur Überprüfung der Vollständigkeit über." *(Agent wechselt in Phase coverage_check — leerer Text-Output, interne Tool-Calls)*

[Turn 13] Persona (Andreas Meier): "Ja, das klingt vollständig." *(Nudge nach zwei leeren Antworten des Agenten)*

[Turn 14] Agent: "Vielen Dank für Ihre Zeit und die offenen Einblicke, Herr Meier. Wir haben heute drei zentrale Prozesse analysiert: (1) Die Rechnungsprüfung, bei der fehlende Bestellreferenzen und die damit verbundene manuelle Suche ein spürbares Hindernis darstellen. (2) Den Monatsabschluss, bei dem insbesondere der Zeitdruck durch die notwendige manuelle Nachpflege in Excel als herausfordernd wahrgenommen wird. (3) Den Mahnprozess, der durch die manuelle Dokumentation von Sonderfällen und Telefonaten ebenfalls einen signifikanten Zeitaufwand am Monatsende verursacht. Für die Rolle eines erfahrenen Buchhalters in der Finanzbuchhaltung kalkulieren wir üblicherweise mit einem internen Stundensatz von 65,00 €. Passt dieser Wert für eine grobe Einschätzung Ihrer Tätigkeit für Sie ungefähr?"

[Turn 14] Persona (Andreas Meier): "Die Zusammenfassung ist korrekt und vollständig. Der Stundensatz von 65 Euro ist eine plausible Schätzung — im externen Vergleich liegt ein Buchhalter mit meiner Erfahrung eher zwischen 55 und 70 Euro, also passt das gut. Weitere Punkte habe ich im Moment keine."

[PASS] Interview abgeschlossen in Turn 14 — status='completed', complete_interview aufgerufen.

---

## Slot-Filling-Stand (aus process_steps)

| Prozessschritt | frequency_per_month | duration_minutes | rule_based | data_sources |
|---------------|---------------------|-----------------|------------|--------------|
| Standard Rechnungsprüfung und Erfassung | 90 | 13 | true | E-Mail, SAP FI, DocuWare |
| Monatsabschluss-Bearbeitung | 1 | 1200 | **false** ⚠️ | SAP FI, Excel |
| Mahnprozess | 1 | **null** ⚠️ | true | SAP FI |

Alle 3 Pflicht-Slots für Rechnungsprüfung gefüllt. Monatsabschluss und Mahnprozess haben je einen fehlerhaften oder fehlenden Slot.

---

## Befunde

### FINDING-1 — Monatsabschluss: rule_based fälschlicherweise false (Severity: Medium)
- **Was:** `process_steps.rule_based = false` für Monatsabschluss, obwohl die Persona einen klar strukturierten, immer gleich ablaufenden Prozess beschrieb.
- **Ursache:** Der Agent gewichtete die Aussage zu manuellen Excel-Ausnahmen stärker als die Beschreibung des Regelablaufs. Klassifikationsfehler des LLM.
- **Auswirkung:** Falsche Heuristik-Basis für Use-Case-Engine (Automatisierbarkeit wird unterschätzt).

### FINDING-2 — Mahnprozess: duration_minutes nicht extrahiert (Severity: Low)
- **Was:** `duration_minutes = null` für Mahnprozess, obwohl die Persona "ein bis zwei Tage" als Schätzung nannte.
- **Ursache:** Persona formulierte unsicher ("ich würde schätzen"), Agent interpretierte es nicht als extrahierbaren Slot-Wert.
- **Auswirkung:** ROI-Berechnung für Mahnprozess nicht möglich.

### FINDING-3 — Doppelter Step im step_tracker (Severity: Low)
- **Was:** step_tracker enthielt "Rechnungsbearbeitung" und "Rechnungsprüfung" als separate Einträge mit identischen Slot-Werten. In process_steps nur eine Row persistiert.
- **Ursache:** Agent hat den Schritt unter zwei leicht unterschiedlichen Titeln erfasst und dann konsolidiert, aber der Tracker zeigt beide.

### FINDING-4 — Leere Antworten in Phase coverage_check (Severity: Low, bekannt)
- **Was:** Zwei aufeinanderfolgende leere curl-Responses beim Übergang zu coverage_check (Turns 13).
- **Ursache:** Agent verarbeitet intern Tool-Calls (register_step) ohne Text-Output. Bereits als BUG-EVAL-2 aus 2026-05-24 bekannt.
- **Auswirkung:** UI zeigt leere Nachricht, Nutzer erhält keine Rückmeldung während interner Verarbeitung.

### POSITIV — Additionalcontext-Trigger funktioniert
- **Was:** Der Agent hat den Mahnprozess nicht proaktiv angesprochen (wie in additionalContext beschrieben). Die Persona hat ihn am Ende selbst erwähnt — und der Agent hat ihn korrekt aufgegriffen und strukturiert erfasst. Das Verhalten entspricht dem Erwarteten.

---

## Pass-Kriterien-Check

| Kriterium | Ergebnis |
|-----------|----------|
| Erster Turn ist Agent (nicht Persona) | PASS |
| Kein identisch wiederholter Persona-Text in aufeinanderfolgenden Turns | PASS |
| Persona-Antworten kontextuell passend | PASS |
| Agent registriert >= 2 Prozessschritte via register_step | PASS (3 Schritte) |
| >= 1 Schritt mit allen 3 Pflicht-Slots gefüllt | PASS (Rechnungsprüfung: frequency=90, duration=13, rule_based=true) |
| Interview erreicht status='completed' | PASS |

**Gesamtergebnis: PASS** — mit 2 Medium/Low-Befunden und 1 bekanntem UI-Bug.
