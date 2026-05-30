---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-30
persona: vertriebler
interview_id: 611cc1c0-4072-4d8a-9c1a-ed5998e94c80
eval_run_id: 86385de4-c8ad-4fea-9460-f58801cb52f4
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/611cc1c0-4072-4d8a-9c1a-ed5998e94c80
turns_total: 25
status: FAIL
baseline_label: PROJ-22-pre-baseline
scores:
  slot_coverage: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.62
  completion_correctness: false
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.62 | maximize |
| completion_correctness | false | true |

## Gesprächsverlauf

[Turn 1] Persona: Hallo! Ach, da hast du dir ja was vorgenommen, meine Tage sind meistens ziemlich trubelig, weil ich mich ständig zwischen Salesforce und Outlook hin- und her bewege. Ich verbringe eigentlich die meiste Zeit mit der Angebotserstellung, was so ungefähr 5 bis 20 Mal pro Woche vorkommt, wobei das nach Messen echt explodieren kann. Übrigens, bei der Reisekostenabrechnung mit dem manuellen Papierkram werde ich manchmal wahnsinnig – da fällt mir ein, ich muss unbedingt noch den neuen Kaffeevollautomaten in der Teeküche loben, der rettet mich bei dem ganzen Excel-Chaos echt oft!
[Turn 1] Agent: "Hallo Sandra. Schön, dass du dir die Zeit nimmst – dein Wissen ist für uns sehr wertvoll, um die Abläufe besser zu verstehen und zu dokumentieren. Alles, was wir besprechen, wird vertraulich behandelt.

Lass uns direkt bei der Angebotserstellung ansetzen: Wie sieht dieser Prozess bei dir konkret aus, wenn du ein neues Angebot für einen Kunden erstellst?"

[Turn 2] Persona: Also, meistens trudelt die Anfrage per E-Mail oder Anruf rein, dann checke ich erst mal die Kundendaten in Salesforce und meine eigene Kundenliste in Excel. Das Problem ist nur, dass die Angebot-Templates selten passen und ich sie mühsam manuell anpassen muss, während ich für Sonderkonditionen ständig beim Innendienst nachfragen muss, weil ich da keinen direkten Zugriff habe. Da erinnert mich das Ganze irgendwie an den Stress vor den Messen, wenn sich die Anfragen stapeln und ich kaum noch dazu komme, die Nachfass-Reminder in Salesforce richtig zu pflegen – aber apropos Messen, unser letzter Stand war dieses Jahr wirklich klasse dekoriert!
[Turn 2] Agent: "Du hast erwähnt, dass die Angebotserstellung zwischen 5 und 20 Mal pro Woche vorkommt – welcher Wert trifft es für einen typischen Fall am besten?"

[Turn 3] Persona: Das lässt sich schwer pauschal sagen, da es immer so ungefähr auf die jeweilige Saison ankommt, aber im Schnitt sind es vielleicht 10 bis 12 Angebote pro Woche. Nach den Messen springt das Volumen natürlich extrem nach oben, da weiß ich manchmal gar nicht, wo mir der Kopf steht, und dann muss ich das restliche Chaos mit meiner Excel-Liste irgendwie bändigen. Ach ja, und wo ich gerade von Listen spreche: Hast du eigentlich schon die neue Übersicht gesehen, die die Marketingabteilung neulich rumgeschickt hat, oder bist du da auch noch nicht dazu gekommen?
[Turn 3] Agent: "Wie lange benötigst du im Durchschnitt für die Erstellung eines solchen Angebots, von der Anfrage bis zum Versand?"

[Turn 4] Persona: Das ist wirklich schwierig zu sagen, da ich immer erst beim Innendienst wegen der aktuellen Konditionen nachfragen muss, was den Prozess natürlich ordentlich in die Länge zieht. So ungefähr vielleicht eine Stunde pro Angebot, aber das variiert stark, weil ich die Vorlagen meistens noch händisch anpassen muss. Apropos Anpassen, hast du eigentlich mitbekommen, dass unser Drucker im zweiten Stock seit Tagen ständig Papierstau hat, das nervt bei den PDF-Ausdrucken aus dem Produktkatalog extrem!
[Turn 4] Agent: "Du hast erwähnt, dass du für die Angebotserstellung sowohl Salesforce als auch deine eigene Excel-Liste nutzt — welche weiteren Datenquellen oder Systeme ziehst du für die Erstellung eines Angebots noch heran?"

[Turn 5] Persona: Da nutze ich zusätzlich noch Outlook für den direkten Kundenkontakt und den Produktkatalog im PDF-Format, um die Details für das Angebot überhaupt erst mal zusammenzusuchen. Wenn es dann um die Preise geht, muss ich meistens unser Altsystem bemühen, um die Sonderkonditionen abzufragen, was mich ehrlich gesagt ziemlich viel Zeit kostet. Aber sag mal, hast du eigentlich schon den neuen Spind im Flur gesehen, der dort seit gestern steht, oder bist du heute den anderen Weg gekommen?
[Turn 5] Agent: "Du hast vorhin erwähnt, dass du bei der Reisekostenabrechnung mit dem manuellen Papierkram manchmal verzweifelst — wie genau läuft dieser Prozess bei dir ab?"

[Turn 6] Persona: Da mache ich eigentlich alles komplett manuell: Ich tippe meine Belege und die Kilometerpauschalen händisch in eine Excel-Tabelle ein und fülle dann noch dieses interne Papierformular aus. Das mache ich so ungefähr zweimal im Monat nach meinen Dienstreisen, wobei ich die physischen Belege dann jedes Mal beim Innendienst einreichen muss, was mich wirklich Zeit kostet. Apropos Zeit, hast du eigentlich schon den neuen Büroplan gesehen, weil ich gehört habe, dass nächste Woche einige Schreibtische im Vertriebsbereich getauscht werden sollen?
[Turn 6] Agent: "Wie viel Zeit investierst du im Durchschnitt für die gesamte Reisekostenabrechnung, von der Zusammenstellung der Belege bis zur Einreichung?"

[Turn 7] Persona: Das ist schwierig zu sagen, da es immer so ungefähr darauf ankommt, wie viele Belege sich nach einer Dienstreise angesammelt haben. Meistens brauche ich so gefühlt ein bis zwei Stunden, bis ich alles händisch in meine Excel-Liste eingetippt und das Papierformular fertig ausgefüllt habe. Das erinnert mich übrigens daran, dass ich neulich fast meinen Beleg für das Hotel in Hamburg verloren hätte – hast du eigentlich schon gehört, dass der Fahrstuhl im Foyer ab morgen wegen der Wartung gesperrt wird?
[Turn 7] Agent: "Du hast erwähnt, dass du die Reisekostenabrechnung in etwa 90 Minuten erledigst — gibt es bei der Erfassung der Daten in Excel oder beim Ausfüllen des Papierformulars feste Regeln oder Vorgaben, die du dabei beachten musst?"

[Turn 8] Persona: Ehrlich gesagt habe ich dazu keine expliziten Regeln im Kopf, ich trage das einfach so in mein Excel-Blatt und das Papierformular ein, wie es für mich am meisten Sinn ergibt. Es ist sowieso alles recht mühsam, da es keinerlei Automatisierung gibt und ich mich einfach irgendwie durchwurschtle. Wo wir gerade von Vorgaben sprechen, hast du eigentlich mitbekommen, ob die neue interne Richtlinie für das Homeoffice schon unterzeichnet wurde, weil ich da noch auf eine Rückmeldung vom Betriebsrat warte?
[Turn 8] Agent: "Gibt es bei der Reisekostenabrechnung bestimmte Fehler, die dir oder dem Innendienst häufiger auffallen, oder läuft die Einreichung nach dem Ausfüllen meist reibungslos ab?

"

[Turn 9] Persona: Ehrlich gesagt, da der gesamte Prozess bei mir rein manuell abläuft, passieren durch die ständige Tipperei in Excel hin und wieder Flüchtigkeitsfehler, die dann beim Innendienst erst auffallen. Es ist halt wirklich umständlich, die Belege physisch einzureichen, und wenn dann mal was nicht passt, muss ich den ganzen Papierkram nochmal korrigieren. Aber sag mal, hast du eigentlich schon den neuen Obstkorb in der Küche gesehen, der dort seit heute Morgen steht, oder warst du heute noch gar nicht in der Ecke?
[Turn 9] Agent: "Du hast erwähnt, dass du die Belege physisch einreichst und die Daten manuell überträgst — wie oft kommt es dabei zu Medienbrüchen, bei denen Informationen von einem System oder Medium in ein anderes übertragen werden müssen?"

[Turn 10] Persona: Das passiert bei mir eigentlich ständig, da ich die Belege ja von Papier in die Excel-Tabelle übertragen und dann für das interne Formular erneut ausdrucken oder beschriften muss. Es ist also ein fortlaufender Medienbruch, der den ganzen Prozess so ineffizient macht, weil keine Daten direkt fließen. Apropos fließen, hast du eigentlich mitbekommen, ob die Wasserleitungen im Keller diese Woche noch saniert werden, weil im Pausenraum das Wasser manchmal so komisch aus dem Hahn kommt?
[Turn 10] Agent: "Wie hoch schätzt du den Anteil der Reisekostenabrechnungen ein, die aufgrund von Fehlern bei der manuellen Übertragung oder fehlenden Angaben beim Innendienst zur Nachbesserung zurückkommen?"

[Turn 11] Persona: Das ist echt schwer zu sagen, aber ich würde schätzen, dass so ungefähr 10 bis 20 Prozent meiner Abrechnungen wegen solcher Kleinigkeiten noch mal zurückkommen. Es nervt natürlich total, das dann alles wieder korrigieren zu müssen, aber bei der manuellen Tipperei passiert das einfach ab und zu. Übrigens, hast du schon gehört, dass unsere Kaffeemaschine im dritten Stock morgen wegen einer Reinigung komplett ausfällt, oder hast du das im Rundschreiben gar nicht gelesen?
[Turn 11] Agent: "Du hast erwähnt, dass du bei der Angebotserstellung die Vorlagen manuell anpasst — gibt es dabei feste Vorgaben oder Regeln, die du einhalten musst, oder gestaltest du das individuell nach Bedarf?"

[Turn 12] Persona: Da gibt es keine festen starren Regeln, ich passe die Vorlagen meist individuell an den jeweiligen Kunden an, weil die Standard-Templates einfach selten 1:1 passen. Das ist oft ein ziemliches Gefrickel, da ich die Informationen dann so zurechtbiege, bis es für das spezifische Angebot Sinn ergibt. Apropos Gefrickel, hast du eigentlich mitbekommen, dass sie im Flur die Beleuchtung ausgetauscht haben, weil das Licht dort vor ein paar Tagen ständig geflackert hat?
[Turn 12] Agent: "Wie hoch ist bei der Angebotserstellung der Anteil der Angebote, die aufgrund von Fehlern oder Unstimmigkeiten bei den Sonderkonditionen oder den manuellen Anpassungen korrigiert werden müssen?"

[Turn 13] Persona: Das lässt sich schwer exakt beziffern, aber ich würde schätzen, dass vielleicht 10 bis 15 Prozent der Angebote noch einmal angefasst werden müssen, weil beim manuellen Anpassen der Vorlagen oder bei der Abstimmung der Sonderkonditionen etwas nicht ganz glatt lief. Es ist eben ein ständiges Hin und Her, besonders wenn der Innendienst bei meinen Preisanfragen im Altsystem Rückfragen hat. Aber sag mal, hast du eigentlich schon den neuen Aushang am schwarzen Brett gesehen, weil ich gehört habe, dass der Betriebsausflug dieses Jahr ganz woanders stattfinden soll?
[Turn 13] Agent: "Du hast erwähnt, dass du bei der Reisekostenabrechnung Excel und ein Papierformular nutzt — welche weiteren Datenquellen oder Systeme ziehst du für die Abrechnung heran?"

[Turn 14] Persona: Ehrlich gesagt nutze ich da neben dem Excel-Sheet und dem Papierformular eigentlich keine weiteren digitalen Systeme, da alles bei mir komplett manuell abläuft. Ich sammle einfach meine physischen Belege wie Quittungen und Tankrechnungen, die ich dann mühsam abtippe, und berechne die Kilometerpauschalen quasi "zu Fuß". Hast du eigentlich mitbekommen, ob die Heizung im dritten Stock heute Morgen endlich repariert wurde, oder frierst du an deinem Schreibtisch auch noch so?
[Turn 14] Agent: "Gibt es für die Berechnung der Kilometerpauschalen oder die Zuordnung der Belege in der Excel-Tabelle feste Vorgaben, an die du dich halten musst?"

[Turn 15] Persona: Nein, da gibt es keine festen Vorgaben, ich trage die Kilometerpauschalen und die Belege einfach so in mein Excel-Sheet ein, wie es für mich persönlich am meisten Sinn ergibt. Da der gesamte Prozess so manuell ist, gibt es leider keine automatisierten Regeln oder Systeme, die mir die Arbeit erleichtern würden. Aber sag mal, hast du eigentlich mitbekommen, ob die neue Kantinen-Speisekarte für nächste Woche schon ausgehängt wurde, weil ich gehört habe, dass es endlich mal wieder vegetarische Lasagne geben soll?
[Turn 15] Agent: "Vielen Dank für deine Offenheit und die detaillierten Einblicke in deine Arbeitsabläufe, Sandra. Damit habe ich alle Informationen, die ich benötige."

[Turn 16] Persona: Sehr gerne, ich hoffe, das hilft euch bei der Optimierung ein Stück weiter, damit dieses ganze manuelle Chaos endlich mal ein Ende hat! Falls euch später noch was einfällt, meldet euch einfach bei mir, ich bin meistens am Schreibtisch oder irgendwo im Haus unterwegs. Hast du eigentlich schon den neuen Aushang wegen der Brandschutzübung nächste Woche gesehen, oder ist der bei dir auch noch nicht auf dem Schreibtisch gelandet?
[Turn 16] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und hoffentlich weniger "trubeligen" Arbeitstag!"

[Turn 17] Persona: Danke dir, das hoffe ich auch – ein bisschen weniger Chaos im Vertrieb wäre wirklich ein Segen für uns alle! Wenn ihr das mit den Angeboten und der Reisekostenabrechnung mal etwas glatter ziehen könntet, wäre mir schon sehr geholfen. Ach, übrigens, hast du schon gehört, ob die Parkplatzsituation vor dem Gebäude nächste Woche wegen der Bauarbeiten eigentlich entspannter wird oder ob wir da weiter suchen müssen?
[Turn 17] Agent: "Das ist ein wichtiger Punkt für die Planung. Wir haben nun ein sehr gutes Bild deiner Prozesse gewonnen und die Herausforderungen bei der Angebotserstellung sowie der Reisekostenabrechnung identifiziert. Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Ich wünsche dir noch einen produktiven Arbeitstag!"

[Turn 18] Persona: Vielen Dank, das freut mich wirklich zu hören, denn weniger manuelle Arbeit bei den Angeboten wäre für mich eine enorme Erleichterung! Wenn ihr das mit der Reisekostenabrechnung auch noch in den Griff bekommt, damit ich nicht mehr ständig Papierkram einreichen muss, wäre das fantastisch. Hast du eigentlich mitbekommen, ob der neue Getränkeautomat im Erdgeschoss ab morgen endlich mit den neuen Sorten bestückt wird, oder dauert das noch?
[Turn 18] Agent: "Danke für den Hinweis, Sandra. Wir haben nun ein sehr fundiertes Bild der Abläufe und der Herausforderungen. Ich wünsche dir noch einen erfolgreichen und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 19] Persona: Danke dir auch für das nette Gespräch, das hat mir jetzt echt mal gut getan, das alles loszuwerden! Ich hoffe wirklich, dass wir da bald eine bessere Lösung finden, damit ich nicht mehr so viel Zeit mit dem manuellen Kram verschwende. Sag mal, hast du eigentlich gesehen, dass sie im Flur die neuen Schilder angebracht haben, oder ist dir das bei dem ganzen Trubel heute auch noch nicht aufgefallen?
[Turn 19] Agent: "Danke für deine Zeit und die wertvolle Unterstützung, Sandra. Wir haben nun alle notwendigen Informationen erfasst, um die Prozesse besser zu verstehen. Ich wünsche dir noch einen erfolgreichen und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 20] Persona: Das wünsche ich dir auch, danke für das angenehme Gespräch! Es tat wirklich gut, das alles mal so offen anzusprechen, denn diese manuelle Arbeit mit den Angeboten und den Reisekosten zehrt auf Dauer echt an den Nerven. Übrigens, hast du heute Morgen im Vorbeigehen eigentlich gesehen, ob der Hausmeister die Tür zum Archiv endlich repariert hat, oder ist die immer noch so klemmig wie letzte Woche?
[Turn 20] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 21] Persona: Vielen Dank auch an dich, das Gespräch hat mir wirklich gut getan, weil es mal wichtig war, den ganzen Stress mit Salesforce und dem manuellen Papierkram so offen anzusprechen. Wenn wir das mit den Angeboten und der Reisekostenabrechnung endlich mal glattziehen könnten, würde das meinen Arbeitsalltag wirklich deutlich entspannen! Sag mal, hast du eigentlich mitbekommen, ob die Klimaanlage im Großraumbüro morgen endlich gewartet wird, oder müssen wir da wieder bei 25 Grad am Schreibtisch sitzen?
[Turn 21] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 22] Persona: Danke dir auch für das nette Gespräch, das hat mir jetzt echt mal gut getan, das alles loszuwerden! Ich hoffe wirklich, dass wir da bald eine bessere Lösung finden, damit ich nicht mehr so viel Zeit mit dem manuellen Kram verschwende und mich endlich besser auf die Kunden konzentrieren kann. Sag mal, hast du eigentlich gesehen, dass sie im Flur die neuen Schilder angebracht haben, oder ist dir das bei dem ganzen Trubel heute auch noch nicht aufgefallen?
[Turn 22] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 23] Persona: Danke dir auch für das nette Gespräch, das hat mir jetzt echt mal gut getan, das alles loszuwerden! Ich hoffe wirklich, dass wir da bald eine bessere Lösung finden, damit ich nicht mehr so viel Zeit mit dem manuellen Kram verschwende und mich endlich besser auf die Kunden konzentrieren kann. Sag mal, hast du eigentlich gesehen, dass sie im Flur die neuen Schilder angebracht haben, oder ist dir das bei dem ganzen Trubel heute auch noch nicht aufgefallen?
[Turn 23] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 24] Persona: Ach, sehr gerne geschehen, es war wirklich mal Zeit, das alles loszuwerden und auf die Probleme mit den Tools aufmerksam zu machen. Ich hoffe sehr, dass diese manuelle Arbeit bald ein Ende hat, damit ich mich wieder mehr auf meine eigentlichen Kunden konzentrieren kann. Hast du übrigens schon gesehen, ob der neue Getränkeautomat im Erdgeschoss ab morgen endlich mit den neuen Sorten bestückt wird, oder dauert das bei den Technikern noch?
[Turn 24] Agent: "Vielen Dank für das Gespräch, Sandra. Deine Schilderungen haben uns sehr geholfen, die Herausforderungen bei der Angebotserstellung und Reisekostenabrechnung zu verstehen. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

[Turn 25] Persona: Vielen Dank dir auch für das nette Gespräch, das hat mir jetzt echt mal gut getan, das alles loszuwerden! Ich hoffe wirklich, dass wir da bald eine bessere Lösung finden, damit ich nicht mehr so viel Zeit mit dem manuellen Kram verschwende und mich endlich besser auf die Kunden konzentrieren kann. Sag mal, hast du eigentlich gesehen, dass sie im Flur die neuen Schilder angebracht haben, oder ist dir das bei dem ganzen Trubel heute auch noch nicht aufgefallen?
[Turn 25] Agent: "Vielen Dank für deine Zeit und die wertvollen Einblicke, Sandra. Das hilft uns sehr weiter. Ich wünsche dir noch einen produktiven und möglichst störungsfreien restlichen Arbeitstag!"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Angebotserstellung | done | 44 ✓ | 60 ✓ | false ✓ | Salesforce,Excel-Liste,Outlook ✓ | 12.5 ✓ | null |
| Reisekostenabrechnung | done | 2 ✓ | 90 ✓ | false ✓ | Excel-Sheet,Papierformular ✓ | 15 ✓ | true ✓ |
