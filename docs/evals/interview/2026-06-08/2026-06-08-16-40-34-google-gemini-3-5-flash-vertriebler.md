---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-08
persona: vertriebler
interview_id: 61628098-4555-4668-96ec-2a3cf46a3c0c
eval_run_id: daeef5de-b1e3-4e0d-a255-ba04809b0086
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/61628098-4555-4668-96ec-2a3cf46a3c0c
turns_total: 14
status: PASS
baseline_label: null
scores:
  slot_coverage: 1
  dedup_slot_coverage: 1
  slot_coverage_pre_clarification: 1
  dedup_slot_coverage_pre_clarification: 1
  clarification_coverage_delta: 0
  phase_progression: 0.4
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.86
  dialog_naturalness: 0.72
  completion_correctness: true
  step_registration_coverage: 1
trail:
  total_writes: 19
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.05
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 1 | maximize |
| dedup_slot_coverage | 1 | maximize |
| slot_coverage_pre_clarification | 1 | maximize |
| dedup_slot_coverage_pre_clarification | 1 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 0.4 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.86 | ≥ 0.80 |
| dialog_naturalness | 0.72 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.05 | < 0.20 |

## Gesprächsverlauf

[Turn 1] Persona: Mein Alltag dreht sich meistens darum, die Kundenwünsche unter einen Hut zu bringen, wobei ich mich vor allem um die Angebotserstellung kümmere und zwischendurch meine Reisekosten zusammenstelle. Ehrlich gesagt verbringe ich so ungefähr die Hälfte meiner Zeit damit, in Salesforce Daten zu wälzen oder in Excel-Listen meine Kunden zu pflegen, was mich manchmal echt nervt, weil man den Überblick verliert. Ach ja, die Reisekosten sind auch so ein Thema, da ich die Belege immer noch manuell auf Papier einreiche, was mich bei meinen zwei Reisen im Monat schon einiges an Nerven kostet – apropos, hast du eigentlich auch schon mal so eine nervige Abrechnung gemacht?
[Turn 1] Agent: "Hallo Sandra. In diesem Gespräch erfassen wir dein Prozesswissen strukturiert, um die Abläufe in deiner täglichen Arbeit zu dokumentieren. Das Ganze wird vertraulich behandelt. 

Lass uns direkt einsteigen: Welchen deiner Arbeitsabläufe möchtest du heute als Erstes mit mir Schritt für Schritt durchgehen?"

[Turn 2] Persona: Am besten schauen wir uns direkt die Angebotserstellung an, da ich davon je nach Saison so ungefähr 5 bis 20 Stück pro Woche bearbeite und das meistens am meisten Zeit frisst. Es ist schon ein ziemliches Hin und Her, weil die Vorlagen in unseren Tools fast nie direkt passen und ich für jede Sonderkondition erst jemanden im Innendienst anfunken muss. Wo wir gerade beim Thema „Sonderkonditionen“ sind: Hast du eigentlich schon mal unsere neuen Kataloge gesehen, die wirken dieses Jahr irgendwie ganz anders, oder?
[Turn 2] Agent: "Lass uns direkt mit der Angebotserstellung starten. Wie sieht der allererste Schritt aus, wenn du ein neues Angebot erstellst?"

[Turn 3] Persona: Zuerst nehme ich die Anfrage des Kunden entweder per E-Mail oder über einen Anruf entgegen, was eigentlich immer der Startpunkt ist. Danach prüfe ich in Salesforce, ob der Kunde schon bei uns gelistet ist, wobei ich parallel oft in meiner eigenen Excel-Liste nachschaue, weil mir das manchmal einfach schneller geht. Das erinnert mich übrigens total an mein erstes Jahr hier, als das System ständig abgestürzt ist – hast du vielleicht auch schon mal so eine technische Krise bei der Arbeit erlebt?
[Turn 3] Agent: "Das prüfen wir genauer. Wie lange dauert dieser erste Schritt, also das Entgegennehmen der Anfrage und die Prüfung in Salesforce und Excel, im Durchschnitt pro Vorgang?"

[Turn 4] Persona: Puh, das ist gar nicht so einfach zu sagen, weil das so ungefähr zwischen den ganzen anderen Aufgaben hin und her schwankt. Ich würde schätzen, dass ich für diesen ersten Check vielleicht 15 bis 30 Minuten brauche, aber das kommt natürlich auch auf die Saison an, besonders wenn auf den Messen extrem viel los ist. Das erinnert mich daran, wie ich neulich auf der Messe in München fast meinen Koffer im Taxi vergessen hätte, zum Glück war der Fahrer super aufmerksam!
[Turn 4] Agent: "Ok, das passt so. 

Was genau passiert als Nächstes, nachdem du die Kundendaten in Salesforce und Excel geprüft hast?"

[Turn 5] Persona: Nachdem der Check erledigt ist, erstelle ich das Angebot direkt im CRM, wobei ich die dortigen Vorlagen meistens manuell anpassen muss, da sie selten 1:1 zu den Anforderungen passen. Wenn es um spezielle Konditionen geht, muss ich leider immer erst im Innendienst nachfragen, was mich oft ausbremst, weil ich darauf angewiesen bin, dass die Kollegen schnell antworten. Wo wir gerade von Warten sprechen, neulich habe ich im Wartezimmer beim Arzt ewig gesessen – hast du eigentlich auch schon mal so eine Wartezeit mit Arbeit überbrückt?
[Turn 5] Agent: "Wie lange dauert dieser Schritt, also das Anpassen der Vorlage im CRM und das Abklären der Sonderkonditionen mit dem Innendienst, im Durchschnitt pro Angebot?"

[Turn 6] Persona: Das ist schwer zu beziffern, da ich für die Klärung der Sonderkonditionen im Altsystem meistens noch auf eine Rückmeldung vom Innendienst warten muss, was die Dauer so ungefähr auf 45 bis 60 Minuten streckt. Manchmal geht es schneller, aber oft zieht sich dieser Prozess einfach, weil das manuelle Anpassen der Vorlagen so viel Zeit frisst. Übrigens, bei unserem letzten Meeting im Konferenzraum hat der Kaffee auch so ewig auf sich warten lassen, weißt du noch, wie schlecht die Maschine da lief?
[Turn 6] Agent: "Lassen wir das so stehen.

Folgt das Anpassen der Vorlagen und das Festlegen der Sonderkonditionen festen Regeln, oder hast du dabei eigenen Gestaltungsspielraum?"

[Turn 7] Persona: Ich habe da ehrlich gesagt wenig Spielraum, da ich für die Preise meistens auf die Informationen aus dem Altsystem angewiesen bin und die Vorlagen eben nicht flexibel genug sind. Ich halte mich da strikt an die Vorgaben, auch wenn das ständige Anpassen der Dokumente für mich eher nach Arbeit nach dem Gießkannenprinzip aussieht. Das ist wie mit meiner Gartenarbeit am Wochenende, da muss ich auch immer alles akribisch zurechtschneiden, sonst wuchert mir alles über den Kopf – hast du eigentlich auch einen grünen Daumen oder bist du eher der Typ für den Balkon?
[Turn 7] Agent: "Verstanden — weiter im Ablauf.

Kommen wir zu deiner Reisekostenabrechnung, die du manuell auf Papier einreichst. Wie lange brauchst du dafür im Durchschnitt pro Abrechnung, und welche Unterlagen oder Datenquellen nutzt du dafür?"

[Turn 8] Persona: Für die Reisekosten nutze ich mein Excel-Dokument, in das ich alles eintrage, bevor ich die physischen Belege zusammen mit dem Papierformular beim Innendienst einreiche. Das ist alles komplett manuell und zieht sich daher bei meinen etwa zwei Reisen pro Monat schon über eine knappe Stunde hin, wenn man das Suchen und Aufkleben der Quittungen mitzählt. Das erinnert mich an meine Steuererklärung letztes Jahr, bei der ich am Ende auch fast im Papierkram versunken wäre – bist du eigentlich auch jemand, der Belege lieber sofort sortiert oder sammelst du die auch monatelang in einer Schublade?
[Turn 8] Agent: "Folgt das Ausfüllen und Einreichen dieser Reisekostenabrechnung immer festen Regeln, oder gibt es dabei für dich Gestaltungsspielraum?"

[Turn 9] Persona: Da gibt es eigentlich so gut wie gar keinen Spielraum, da ich mich strikt an das interne Abrechnungsformular in Papierform halten muss, um meine Kilometerpauschalen und Belege geltend zu machen. Ich trage alles in meine Excel-Tabelle ein, drucke das Formular aus und reiche es dann so ein, wie es das Unternehmen eben vorgibt. Das ist ein starres Prozedere, das mir manchmal vorkommt wie die bürokratischen Hürden beim Hausbau, bei dem man ja auch jeden Stempel für die Behörden braucht – hast du eigentlich schon mal Erfahrungen mit solchen Ämtern gesammelt?
[Turn 9] Agent: "Gibt es bei der Angebotserstellung Schritte, bei denen du Dokumente ausdruckst oder Daten manuell von einem System in ein anderes übertragen musst?"

[Turn 10] Persona: Da ich die Angebote im CRM erstelle und die Vorlagen dort so oft nicht passen, muss ich tatsächlich Daten zwischen verschiedenen Systemen und dem Produktkatalog, der ja nur als PDF vorliegt, manuell hin- und herschieben. Es ist oft mühsam, die Informationen aus dem PDF-Katalog zu kopieren und sie dann mühsam in das Angebot-Template zu übertragen, damit am Ende auch alles korrekt aussieht. Das ist so ähnlich, wie wenn ich Rezepte aus verschiedenen Kochbüchern in mein eigenes Notizbuch übertrage – hast du eigentlich auch so eine chaotische Zettelsammlung für deine Lieblingsgerichte zu Hause?
[Turn 10] Agent: "Ich nehme das so auf.

Wir haben nun fast alle Details zusammen. Für die Reisekostenabrechnung fehlt mir nur noch ein Wert: Wie viele Minuten benötigst du für eine solche Abrechnung im Durchschnitt?"

[Turn 11] Persona: Für die Reisekostenabrechnung kalkuliere ich so ungefähr 60 Minuten pro Vorgang ein, da das manuelle Sortieren und Aufkleben der Belege sowie das Ausfüllen des Papierformulars einfach Zeit fressen. Das ist alles in allem ein ziemlich mühsamer Prozess, der mich jedes Mal an das sortieren alter Urlaubsfotos erinnert, bei denen ich auch nie weiß, wo ich anfangen soll – hast du eigentlich auch noch echte Fotoalben zu Hause oder machst du das alles nur noch digital?
[Turn 11] Agent: "Wie oft kommt es bei der Angebotserstellung vor, dass sich Fehler einschleichen oder Daten korrigiert werden müssen – hast du da einen groben Prozentsatz für mich?"

[Turn 12] Persona: Da ich die Daten meist händisch aus dem Produktkatalog in das CRM übertrage und die Vorlagen bei fast jedem zweiten Angebot anpassen muss, schleichen sich da schon mal Fehler ein, vielleicht so in 10 bis 20 Prozent der Fälle. Es kommt natürlich immer darauf an, wie stressig es gerade ist, aber wenn ich abends müde bin, passiert mir schneller ein Zahlendreher, als mir lieb ist. Das ist wie beim Stricken, wenn man zwischendurch kurz abgelenkt wird und die Masche verliert – strickst du eigentlich auch, oder ist das eher was für meine Generation?
[Turn 12] Agent: "Das ist so erfasst.

Gibt es bei der Reisekostenabrechnung ebenfalls eine Fehlerquote oder kommt es vor, dass Abrechnungen korrigiert werden müssen?"

[Turn 13] Persona: Da ich die Belege und Kilometerpauschalen händisch in meine Excel-Liste übertrage und die Formulare auf Papier ausfülle, passiert es schon ab und zu, dass mir beim Übertrag ein Fehler unterläuft, schätzungsweise bei jeder zehnten Abrechnung. Der Innendienst gibt mir dann kurz Bescheid, damit ich das korrigiere, was mich natürlich noch einmal Zeit kostet. Das ist ein bisschen wie mit den Kontoauszügen, bei denen man sich auch manchmal verliest – kontrollierst du deine Bankunterlagen eigentlich immer sofort oder lässt du die auch erst mal liegen?
[Turn 13] Agent: "Ich nehme das so auf. Damit haben wir alle wichtigen Details zu deinen Abläufen bei der Angebotserstellung und der Reisekostenabrechnung strukturiert erfasst. Vielen Dank für deine Unterstützung und deine Zeit!"

[Turn 14] Persona: Sehr gerne geschehen, ich hoffe, meine Ausführungen helfen euch dabei, die Abläufe hier etwas runder zu gestalten! Es war auf jeden Fall mal ganz erfrischend, über diese ganzen kleinen Hürden im Alltag zu sprechen, über die man sich sonst eher nur mit den Kollegen in der Kaffeeküche auslässt. Jetzt wo wir fertig sind, muss ich mich auch direkt wieder an meine eigentliche Arbeit machen, denn es sind gerade wieder ein paar neue Anfragen reingekommen, die auf mein Angebot warten. Hoffentlich ist der Rest deines Tages weniger bürokratisch als mein Bericht über das manuelle Formular-Ausfüllen – hast du eigentlich schon Feierabend oder musst du auch noch weiterkämpfen?
[Turn 14] Agent: "Ich danke dir ebenfalls für die Einblicke und wünsche dir noch einen erfolgreichen Arbeitstag mit möglichst wenig Bürokratie. Auf Wiedersehen!"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| vertrieb | done | 54 ✓ | 53 ✓ | true ✓ | Altsystem ✓ | 15 ✓ | 1 ✓ |
| verwaltung | done | 2 ✓ | 60 ✓ | true ✓ | Excel-Dokument ✓ | 10 ✓ | 1 ✓ |
