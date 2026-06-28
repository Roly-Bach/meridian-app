---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.1-flash-lite
analyst_thinking_budget: 2048
eval_date: 2026-06-27
persona: vertriebler
interview_id: d84a427a-0b30-489a-b223-646789f62d26
eval_run_id: 83f6147d-d34e-4256-a132-6df972014189
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/d84a427a-0b30-489a-b223-646789f62d26
run_index: 2
run_seed: 43
perturbation_seed: 43
turns_total: 30
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.89
  dedup_slot_coverage: 0.89
  slot_coverage_pre_clarification: 0.89
  dedup_slot_coverage_pre_clarification: 0.89
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  anchoring_violation_rate: 0
  tool_call_plausibility: 0.75
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0.03
  confidence_trigger_rate: n/a (keine unknown-Slots)
  talker_grounding_violations: 1
  depth_score: 1.86
  depth_p1: 0.34
  depth_p2: 0.45
  depth_p3: 0.21
trail:
  total_writes: 59
  blocked_writes: 4
  blocked_rate: 0.07
  overwrite_churn: 0.14
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.89 | maximize |
| dedup_slot_coverage | 0.89 | maximize |
| slot_coverage_pre_clarification | 0.89 | maximize |
| dedup_slot_coverage_pre_clarification | 0.89 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| anchoring_violation_rate | 0 | maximize (niedriger besser) |
| tool_call_plausibility | 0.75 | ≥ 0.70 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0.03 | < 0.01 |
| confidence_trigger_rate | n/a (keine unknown-Slots) | > 0.80 |
| talker_grounding_violations | 1 | 0 |
| depth_score | 1.86 | maximize |
| depth_p1 | 0.34 | — |
| depth_p2 | 0.45 | — |
| depth_p3 | 0.21 | — |
| blocked_rate | 0.07 | < 0.10 |
| overwrite_churn | 0.14 | < 0.20 |


## Judge-Begründung

Überwiegend natürliche Gesprächsführung mit gezielten Fragen. Text [2] ist technisch (Code), nicht dialogisch. Texte [6]-[8] wirken teilweise formuliert, aber konsistent. Du-Form durchgehend eingehalten. Vereinzelte generische Elemente ("Das ist ein wichtiger Punkt"), aber insgesamt angemessen für Interview-Kontext.


## Talker-Faktentreue-Verletzungen (KI-9)

Turn 13: "Du hast vorhin erwähnt, dass du keinen direkten Zugriff auf Konditionen hast — jetzt sprichst du von einem Wunsch nach einem direkten, digitalen Zugriff. Gab es dazu bereits ein Tooltest-Projekt, das diesen Zugriff kurzzeitig ermöglicht hat?" — Der Agent verbindet zwei unterschiedliche Aussagen fehlerhaft: (1) Der Mitarbeiter erwähnte mehrfach keinen direkten Zugriff auf Konditionen (korrekt), (2) Der Mitarbeiter erwähnte in Turn 13 ein "Tooltest-Projekt", das "das Leben erleichtert hat", aber NICHT spezifisch für Preiskonditionen in Salesforce. Der Agent suggeriert fälschlicherweise, das Tooltest-Projekt habe den Zugriff auf Konditionen ermöglicht, was der Mitarbeiter in Turn 14 explizit dementiert: "ein direktes Projekt für Preiskonditionen in Salesforce hatten wir leider noch nicht."

## Gesprächsverlauf

[Turn 1] Persona: Hauptsächlich bin ich damit beschäftigt, Kundenanfragen per Mail oder Telefon zu bearbeiten und Angebote in Salesforce zu erstellen, wobei das Volumen je nach Saison stark schwankt – mal sind es vielleicht fünf, in Messezeiten eher an die zwanzig pro Woche. Wenn ich gerade nicht an den Angeboten sitze, kämpfe ich mich meistens durch die Reisekostenabrechnungen, die leider noch komplett manuell über Excel und Papierformulare laufen, was mich jedes Mal an meine Geduldsgrenze bringt. Ach, und erinnerst du dich an den letzten Sommer? Da war es bei uns so stressig, dass ich kaum dazu kam, meine eigenen Excel-Listen für die Kunden zu pflegen, und jetzt muss ich das alles mühsam nachholen!
[Turn 1] Agent: "Wie viel Zeit beansprucht die Erstellung eines einzelnen Angebots in Salesforce im Schnitt?"

[Turn 2] Persona: Das lässt sich schwer pauschal sagen, weil ich oft noch im PDF-Produktkatalog suchen oder beim Innendienst nach den aktuellen Konditionen fragen muss, da ich darauf leider keinen direkten Zugriff habe. Wenn alles glattläuft, geht es fix, aber meistens hänge ich doch länger dran, weil ich die Stammdaten in Salesforce verifizieren muss, während nebenbei ständig das Telefon klingelt. Manchmal habe ich das Gefühl, die Zeit zerrinnt mir zwischen den Fingern, besonders wenn ich parallel noch an meine Reisekosten für die letzte Dienstreise denke, die ich noch abheften muss!
[Turn 2] Agent: "[update_walkthrough_data(
    step_title="Angebotserstellung",
    process_steps=["PDF-Produktkatalog durchsuchen", "Konditionen beim Innendienst erfragen", "Stammdaten in Salesforce verifizieren", "Angebot erstellen"],
    friction_points=["Kein direkter Zugriff auf Konditionen", "Unterbrechungen durch Telefonanrufe", "Suche in PDF-Katalogen"],
    friction_tools=["PDF-Katalog", "Salesforce", "Telefon"]
)]

Eher 15 Minuten oder eher 45 Minuten pro Angebot?"

[Turn 3] Persona: Das kommt ganz auf den Einzelfall an, aber meistens lande ich eher bei 45 Minuten, da die ständigen Rückfragen beim Innendienst wegen der fehlenden Preiskonditionen extrem aufhalten. Es ist wirklich frustrierend, weil ich währenddessen oft aus meinem Workflow gerissen werde, wenn das Telefon klingelt oder ich in unserem Altsystem für Sonderkonditionen nachschauen muss. Übrigens erinnert mich das gerade an meinen letzten Messeauftritt, wo ich zwischen den Kundengesprächen noch schnell ein Angebot tippen wollte, was bei der schlechten Internetverbindung vor Ort ewig gedauert hat – da bin ich fast wahnsinnig geworden!
[Turn 3] Agent: "Wie oft im Monat fallen diese Reisekostenabrechnungen bei dir im Schnitt an?"

[Turn 4] Persona: Diese Abrechnungen mache ich so ungefähr zweimal pro Monat, wobei ich das Papierformular jedes Mal händisch ausfüllen und meine Belege sowie die Kilometerpauschalen mühsam in meine Excel-Listen übertragen muss. Es ist wirklich mühsam, da alles physisch beim Innendienst eingereicht werden muss, und manchmal vergesse ich vor lauter Stress sogar, meine Parkquittungen sofort richtig abzuheften, was mich dann am Monatsende doppelt so viel Zeit kostet. Apropos, das erinnert mich daran, dass ich eigentlich noch mein altes Notizbuch aus dem letzten Jahr suchen wollte, in dem ich mir damals die Fahrtwege notiert hatte, aber bei unserem ganzen Archivierungswahnsinn finde ich das wahrscheinlich sowieso nie wieder!
[Turn 4] Agent: "Wie viel Zeit investierst du pro Abrechnung, und welche Unterlagen liegen dir als Input vor, bevor du mit dem Ausfüllen der Formulare beginnst?"

[Turn 5] Persona: Da ich hierfür rein manuell arbeite, sitze ich oft eine gute Weile an einer Abrechnung, wobei ich meine Belege und die gefahrenen Kilometer aus meinen eigenen Unterlagen zusammentrage. Ich übertrage dann alles händisch in meine Excel-Listen und das Papierformular, was ohne Automatisierung einfach ewig dauert. Das ist wirklich ein Zeitfresser, ähnlich wie damals, als ich mein System zur Kilometererfassung komplett umgestellt habe und wochenlang mit den alten Aufzeichnungen durcheinandergekommen bin!
[Turn 5] Agent: "Eher 30 Minuten oder eher 2 Stunden pro Abrechnung?"

[Turn 6] Persona: Da stehe ich meistens eher bei den 2 Stunden, weil das händische Übertragen der Kilometer und das Sortieren der Belege so unglaublich viel Zeit frisst. Ich finde es einfach schrecklich, dass ich am Ende alles in Papierform beim Innendienst einreichen muss, da ist man mit der ganzen Hin- und Her-Schieberei der Unterlagen schnell mal einen ganzen Nachmittag beschäftigt. Wobei, neulich habe ich beim Aufräumen meines Schreibtisches sogar noch einen alten Stapel Parktickets gefunden, die ich damals fast vergessen hätte abzurechnen – das war ein echtes Chaos!
[Turn 6] Agent: "Wie oft kommt es vor, dass deine eingereichten Reisekostenabrechnungen wegen Fehlern oder fehlenden Belegen an dich zurückgegeben werden?"

[Turn 7] Persona: Ehrlich gesagt passiert das immer wieder mal, vielleicht so bei jeder vierten oder fünften Abrechnung, weil das manuelle Ausfüllen des Papierformulars einfach extrem fehleranfällig ist. Es ist wirklich ärgerlich, wenn das Ganze dann wieder bei mir landet, nur weil ich vielleicht eine Quittung beim Übertragen übersehen habe oder eine Zahl nicht korrekt war. Das erinnert mich daran, wie ich früher immer meine Unterlagen in einer Mappe gesammelt habe, die mir dann einmal fast vom Tisch gefallen wäre – ein Glück ist heute nichts Wichtigeres verloren gegangen!
[Turn 7] Agent: "Gibt es bei der Angebotserstellung in Salesforce bestimmte Kriterien oder Regeln, nach denen du entscheidest, ob ein Angebot sofort rausgeht oder erst eine Rücksprache mit dem Innendienst nötig ist?"

[Turn 8] Persona: Im Grunde ist das meistens eine Frage der Preiskonditionen, denn wenn ich im System keine direkten Informationen finde oder Sonderpreise anfrage, muss ich zwangsläufig beim Innendienst nachhaken. Da ich keinen Zugriff auf die aktuellsten Konditionen habe, lande ich bei komplizierteren Anfragen oft in dieser Schleife, was den Prozess natürlich ordentlich in die Länge zieht. Das erinnert mich übrigens an den letzten Kunden aus München, bei dem ich wegen der Rabattstaffeln drei verschiedene E-Mails schreiben musste, bevor ich endlich das finale Angebot losschicken konnte!
[Turn 8] Agent: "Wie hoch ist der Anteil der Angebote, die aufgrund der fehlenden Konditionen oder Rückfragen fehlerhaft sind oder erst mit Verzögerung versendet werden können? Und welche Wechsel zwischen Systemen oder Papierunterlagen kosten dich bei der Angebotserstellung und der Reisekostenabrechnung am meisten Zeit?"

[Turn 9] Persona: Das betrifft ungefähr ein Drittel meiner Angebote, da die ständigen Rückfragen beim Innendienst wegen der fehlenden Preiskonditionen einfach viel Zeit schlucken. Besonders der ständige Wechsel zwischen Salesforce und dem Produktkatalog als PDF sowie das manuelle Suchen in unserer Excel-Kundenliste bremst mich extrem aus. Bei den Reisekosten ist es vor allem das händische Übertragen der Daten von den Belegen in die Excel-Tabelle und dann weiter auf das Papierformular, was mich jedes Mal wahnsinnig macht, genau wie damals, als ich mein System zur Dokumentenablage komplett neu sortieren musste.
[Turn 9] Agent: "Hängen die beiden Prozesse – also die Angebotserstellung und die Reisekostenabrechnung – in irgendeiner Weise voneinander ab, oder bearbeitest du sie komplett unabhängig voneinander?"

[Turn 10] Persona: Die beiden Aufgaben bearbeite ich in der Regel komplett unabhängig voneinander, da sie thematisch einfach nichts miteinander zu tun haben. Dennoch ziehen beide Prozesse an meiner Zeit, weil sie mich mit ihren manuellen Hürden – sei es beim lästigen Hin- und Her-Wechseln zwischen Salesforce, PDF-Katalog und Excel oder beim Ausfüllen des Papierformulars für die Reisekosten – ständig aus meinem eigentlichen Arbeitsfluss reißen. Neulich habe ich mich dabei erwischt, wie ich beim Ausfüllen einer Abrechnung gedanklich schon wieder beim Angebot für einen Kunden war, was natürlich dazu geführt hat, dass ich mich bei den Kilometern total vertan habe!
[Turn 10] Agent: "Wie überträgst du die Daten bei der Angebotserstellung konkret vom PDF-Katalog in Salesforce, und wie gelangen die Reisekostendaten von deiner Excel-Liste auf das Papierformular – tippst du alles manuell ab oder druckst du Zwischenschritte aus?"

[Turn 11] Persona: Beim Angebot tippe ich die benötigten Informationen aus dem PDF-Produktkatalog tatsächlich manuell in Salesforce ein, da es dort keine direkte Schnittstelle gibt. Für die Reisekosten verhält es sich ähnlich: Ich übertrage die gesammelten Belege und Kilometerzahlen händisch aus meinen Excel-Listen in das ausgedruckte Papierformular, das ich dann physisch an den Innendienst schicke. Früher habe ich zwischendurch mal versucht, mir Notizen auf kleinen Zetteln zu machen, aber das hat das Chaos nur noch vergrößert, weshalb ich jetzt alles penibel in Excel vorschreibe. Übrigens war ich letztens so vertieft in diese manuelle Tipparbeit, dass ich beinahe den Anruf eines wichtigen Neukunden verpasst hätte, weil ich vor lauter Listen und Tabellen einfach nicht vom Schreibtisch wegkam!
[Turn 11] Agent: "Dieser manuelle Aufwand zieht sich durch beide Prozesse. Druckst du bei der Angebotserstellung ebenfalls Unterlagen aus, die du später wieder einscannen oder abheften musst, oder beschränkt sich das auf das Reisekostenformular?"

[Turn 12] Persona: Bei der Angebotserstellung drucke ich zum Glück meistens nichts aus, sondern beschränke mich auf den digitalen Prozess innerhalb von Salesforce, wobei ich ja ohnehin oft zwischen dem PDF-Produktkatalog und dem System hin- und herwechsle. Das physische Ausdrucken und Einreichen von Papierunterlagen bleibt also glücklicherweise primär auf die Reisekostenabrechnung begrenzt, was schon schlimm genug ist. Weißt du, ich habe mal versucht, meine Angebote als PDF zusätzlich in einer eigenen Ablage zu speichern, aber das hat so viel Speicherplatz gefressen, dass ich das direkt wieder gelassen habe!
[Turn 12] Agent: "Welche Veränderungen wären für Sie entscheidend, um diese Prozesse in Zukunft effizienter zu gestalten?"

[Turn 13] Persona: Der wichtigste Schritt wäre für mich ein direkter, digitaler Zugriff auf alle aktuellen Preiskonditionen innerhalb von Salesforce, damit ich mir die ständigen Rückfragen beim Innendienst und das mühsame Suchen im PDF-Katalog endlich sparen kann. Bei den Reisekosten bräuchte ich unbedingt eine digitale Lösung, die das manuelle Ausfüllen und physische Einreichen der Papierformulare überflüssig macht, da dieser Prozess in der jetzigen Form einfach nicht mehr zeitgemäß ist. Manchmal träume ich davon, wie viel produktiver ich wäre, wenn ich mich nur auf die Kundenbetreuung konzentrieren könnte, anstatt ständig irgendwelche Belege von A nach B zu sortieren – so wie damals, als wir für einen kurzen Zeitraum ein Tooltest-Projekt hatten, das mir zumindest kurzzeitig das Leben erleichtert hat!
[Turn 13] Agent: "Du hast vorhin erwähnt, dass du keinen direkten Zugriff auf Konditionen hast — jetzt sprichst du von einem Wunsch nach einem direkten, digitalen Zugriff. Gab es dazu bereits ein Tooltest-Projekt, das diesen Zugriff kurzzeitig ermöglicht hat?"

[Turn 14] Persona: Da bringst du etwas durcheinander, denn ein direktes Projekt für Preiskonditionen in Salesforce hatten wir leider noch nicht. Wir hatten lediglich mal einen Test mit einem anderen Tool, das den Arbeitsalltag etwas erleichtern sollte, aber das ist schon ewig her und hat sich nicht wirklich durchgesetzt. Meistens schlage ich mich eben doch noch mit unserem Altsystem herum, wenn ich mal eine Sonderkondition brauche, was mich jedes Mal wieder daran erinnert, wie dringend wir hier mal eine vernünftige Lösung brauchen.
[Turn 14] Agent: "Du hast das Tool-Test-Projekt also vom direkten Salesforce-Zugriff abgegrenzt. Gibt es neben der Angebotserstellung und den Reisekosten noch weitere administrative Tätigkeiten, die du als ähnlich belastend oder ineffizient empfindest?"

[Turn 15] Persona: Ehrlich gesagt finde ich schon, dass die Pflege meiner eigenen Excel-Kundenliste eine ziemliche administrative Belastung darstellt, weil das neben Salesforce ein zusätzlicher, redundanter Aufwand ist. Da ich die Stammdaten dort händisch aktuell halten muss, verbringe ich oft wertvolle Zeit damit, statt mich voll auf meine Kunden zu konzentrieren. Das erinnert mich übrigens an den letzten Monat, als ich den ganzen Vormittag damit verbracht habe, meine Liste zu bereinigen, nur damit ich nicht völlig den Überblick über meine Kontakte verliere.
[Turn 15] Agent: "Wenn du dir eine Priorität aussuchen könntest, welche dieser beiden manuellen Hürden – die Preissuche oder die Reisekostenabrechnung – sollte zuerst angegangen werden?"

[Turn 16] Persona: Wenn ich mich entscheiden müsste, würde ich sofort die Preiskonditionen für die Angebotserstellung priorisieren, da diese mich im Tagesgeschäft mit den 5 bis 20 Anfragen pro Woche ständig blockieren. Die Reisekostenabrechnung nervt zwar tierisch, aber die mache ich ja nur zweimal im Monat, während mich die fehlenden Konditionen bei fast jedem Angebot aus dem Konzept bringen. Das ist wie damals, als ich feststellte, dass mir bei den Angeboten einfach ein roter Faden fehlte, weil ich ständig zwischen Salesforce, PDF-Katalog und dem Altsystem hin- und hergesprungen bin!
[Turn 16] Agent: "Wie häufig musst du diese Kundenliste im Monat aktualisieren, um die Stammdaten auf einem aktuellen Stand zu halten?"

[Turn 17] Persona: Das mache ich eigentlich fortlaufend nebenbei, aber so richtig gründlich setze ich mich vielleicht zwei- bis dreimal im Monat hin, um alles sauber abzugleichen. Es ist einfach mühsam, da ich die Daten ja parallel in Salesforce und in meiner eigenen Excel-Liste pflege, weil ich mich auf die automatische Synchronisation leider nicht immer verlassen kann. Weißt du, früher habe ich mir dazu noch handschriftliche Notizen gemacht, bis mir mein Schreibtisch überquoll – heute ist die Excel-Liste zwar digital, aber der Aufwand bleibt der gleiche!
[Turn 17] Agent: "Das ist ein deutlicher Mehraufwand durch die doppelte Datenhaltung. Gibt es aus deiner Sicht noch einen letzten Punkt, den du uns mit auf den Weg geben möchtest, bevor wir zum Abschluss kommen?"

[Turn 18] Persona: Am wichtigsten wäre mir wirklich, dass wir endlich die Stammdatenpflege in Salesforce so hinbekommen, dass ich mir meine private Excel-Liste komplett sparen kann. Es fühlt sich einfach falsch an, Daten doppelt zu erfassen, nur weil das System nicht zuverlässig funktioniert oder ich den Prozessen nicht vertraue. Wenn ich dann noch den direkten Zugriff auf die Preiskonditionen hätte, könnte ich mich endlich wieder voll auf den Vertrieb und meine Kunden konzentrieren, anstatt ständig irgendwelche Listen oder Formulare zu jonglieren.
[Turn 18] Agent: "Wie viel Zeit investierst du pro dieser zwei bis drei monatlichen Sitzungen in den Abgleich und die Pflege deiner Excel-Liste?"

[Turn 19] Persona: Für so eine gründliche Pflege sitze ich meistens etwa zwei Stunden an meiner Liste, damit am Ende auch wirklich alles mit Salesforce übereinstimmt. Da schleichen sich nämlich so schnell Flüchtigkeitsfehler ein, wenn ich die Datensätze von links nach rechts übertrage, und das muss ich dann mühsam korrigieren. Das erinnert mich übrigens an eine Phase im letzten Jahr, als ich bei einem Kunden die Adresse falsch eingetragen hatte und die gesamte Korrespondenz ins Leere lief – ein echtes Fiasko, das ich seitdem unbedingt vermeiden will!
[Turn 19] Agent: "Wie oft schleichen sich bei dieser manuellen Übertragung Fehler ein, die du nachträglich korrigieren musst?"

[Turn 20] Persona: Das passiert bei meiner Excel-Pflege tatsächlich gar nicht so selten, vielleicht so bei jedem fünften Abgleich, dass mir ein Zahlendreher oder ein falscher Buchstabe durchrutscht. Meistens merke ich das dann erst, wenn der Innendienst mich bei der Angebotserstellung auf eine Abweichung hinweist oder meine Unterlagen bei der Reisekostenabrechnung wieder auf dem Tisch landen. Dann ärgere ich mich natürlich schwarz über die vertane Zeit, genau wie damals, als ich eine komplette Adressliste aufgrund eines kleinen Tippfehlers bei einem wichtigen Kunden umständlich korrigieren musste.
[Turn 20] Agent: "Du hast erwähnt, dass der Innendienst dich oft auf Abweichungen hinweist — arbeitest du bei diesem Abgleich eigentlich rein digital zwischen Salesforce und Excel, oder liegen dir dabei noch andere physische Quellen vor?"

[Turn 21] Persona: Meistens arbeite ich beim Abgleich tatsächlich rein digital zwischen Salesforce und meiner Excel-Liste am Rechner, da mir die Daten dort am schnellsten vorliegen. Manchmal habe ich aber zusätzlich noch ausgedruckte Kundeninfos oder Notizen aus Gesprächen auf dem Schreibtisch liegen, die ich dann mühsam vergleiche, was das Ganze natürlich noch anfälliger für Fehler macht. Es ist wirklich ein Hin und Her, ein bisschen wie bei meinem Versuch, damals alle Visitenkarten abzutippen – eine Heidenarbeit, die mich heute noch frustriert, wenn ich daran zurückdenke!
[Turn 21] Agent: "Gibt es für dich noch einen abschließenden Gedanken, den wir für die Dokumentation festhalten sollten, bevor wir das Gespräch beenden?"

[Turn 22] Persona: Ich hoffe wirklich sehr, dass durch diese Prozessaufnahme endlich Bewegung in die Sache kommt, denn das Jonglieren mit den ganzen Tools macht den Arbeitsalltag unnötig schwer. Wenn wir es schaffen, die Stammdatenpflege zu zentralisieren und die Preiskonditionen direkt in Salesforce verfügbar zu machen, wäre mir schon extrem geholfen. Das spart mir dann hoffentlich auch diese nervige Zettelwirtschaft, die mich immer wieder aus meinem eigentlichen Vertriebsjob reißt – ein bisschen wie damals, als ich mich wochenlang mit dem alten Ablagesystem herumgeschlagen habe, bevor ich endlich alles digitalisiert hatte.
[Turn 22] Agent: "Wie genau gelangen diese ausgedruckten Kundeninfos oder Gesprächsnotizen auf deinen Schreibtisch – druckst du diese gezielt aus oder erhältst du sie in Papierform vom Innendienst?"

[Turn 23] Persona: Die Informationen landen meistens durch meine eigenen handschriftlichen Notizen aus Telefonaten oder Kundengesprächen auf meinem Schreibtisch, die ich mir manchmal aus Bequemlichkeit direkt auf einen Zettel kritzle, anstatt sie sofort in Salesforce zu tippen. Hin und wieder drucke ich mir auch wichtige Kundeninfos oder E-Mails aus, wenn ich gerade am Telefon bin und keine Lust habe, zwischen den Fenstern am Monitor hin- und herzuspringen. Das war früher bei meinen ersten Kundenbesuchen noch schlimmer, da habe ich mir die komplette Historie ausgedruckt, weil ich Angst hatte, dass mir bei einem Gespräch vor Ort die Daten fehlen – heute mache ich das zum Glück nur noch in Ausnahmefällen!
[Turn 23] Agent: "Damit haben wir alle wesentlichen Aspekte für unsere Prozessaufnahme erfasst. Vielen Dank für deine Zeit und die detaillierten Einblicke in deine Arbeitsabläufe."

[Turn 24] Persona: Das war wirklich ein hilfreiches Gespräch, auch wenn es mir erst jetzt richtig bewusst wird, wie viele manuelle Umwege ich eigentlich täglich gehe. Ich hoffe sehr, dass diese Dokumentation dazu führt, dass die Arbeit in Salesforce endlich flüssiger läuft und mir das ständige Springen zwischen den Systemen erspart bleibt. Vielen Dank für das Zuhören, das hat mir mal wieder vor Augen geführt, wie dringend wir hier an den Strukturen arbeiten müssen!
[Turn 24] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

[Turn 25] Persona: Ehrlich gesagt fällt mir da direkt das manuelle Übertragen der Kilometerabrechnungen ein, die ich immer noch zusätzlich zu meinen Belegen in Excel einpflege. Da sitze ich dann oft am Freitagabend noch dran, weil ich unter der Woche durch die ganzen Kundenanfragen einfach nicht dazu komme, das sauber zu erledigen. Das ist wie damals, als ich mich bei einer Dienstreise in Hamburg total verfahren habe und hinterher ewig brauchte, um die gefahrenen Kilometer für die Abrechnung wieder korrekt nachzuvollziehen!
[Turn 25] Agent: "Vielen Dank für diese ergänzenden Details. Wir haben damit ein vollständiges Bild deiner Arbeitsabläufe und der damit verbundenen Herausforderungen. Das Gespräch ist damit beendet — danke für deine Zeit und die Offenheit."

[Turn 26] Persona: Sehr gerne geschehen, ich danke dir ebenfalls für die Geduld, mit der du mir heute zugehört hast. Es hat mir wirklich gut getan, das alles mal offen anzusprechen, denn gerade dieses ständige Jonglieren zwischen den Programmen raubt mir im Alltag enorm viel Energie. Vielleicht passiert ja jetzt endlich etwas, das mir diese manuelle Zettelwirtschaft vom Hals schafft!
[Turn 26] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

[Turn 27] Persona: Da wäre noch meine wöchentliche Wiedervorlage, die ich mir für die offenen Kundenanfragen in Salesforce anlege, damit ich niemanden vergesse. Wenn ich die Termine nicht konsequent nachpflege, verliere ich bei den 5 bis 20 Anfragen pro Woche schnell den Überblick, besonders wenn es in einer stressigen Phase mal wieder drunter und drüber geht. Das erinnert mich an einen Kunden, bei dem ich vor ein paar Monaten fast die Frist für ein wichtiges Angebot verpasst hätte, weil ich meine Notizen einfach unter einem Stapel Unterlagen begraben hatte!
[Turn 27] Agent: "Das ist ein wichtiger Punkt für die Prozessstabilität. Wie genau legst du diese Wiedervorlage an — nutzt du dafür eine spezifische Funktion in Salesforce oder führst du das separat in einer Liste?"

[Turn 28] Persona: Ich nutze dafür tatsächlich die entsprechende Funktion direkt in Salesforce, damit ich meine Wiedervorlagen fest mit den Kundendaten verknüpft habe. Es ist aber leider trotzdem mühsam, da ich bei so vielen Anfragen pro Woche – manchmal sind es ja bis zu zwanzig – ständig diszipliniert dranbleiben muss, sonst entgleitet mir das total. Das erinnert mich übrigens an den letzten Monat, als ich bei der ganzen Hektik fast vergessen hätte, einen wichtigen Termin nachzuhalten, weil mein Bildschirm vor lauter Fenstern einfach zu unübersichtlich war!
[Turn 28] Agent: "Das ist nachvollziehbar, dass bei der hohen Anzahl an Anfragen die Übersichtlichkeit unter dem "Fenster-Chaos" leidet.

Da wir nun alle wesentlichen Abläufe – von der Angebotserstellung über die Reisekosten bis hin zur Stammdatenpflege und Wiedervorlage – detailliert erfasst haben, kommen wir zum Ende unserer Aufnahme. Vielen Dank für deine Zeit und die offenen Einblicke in deinen Arbeitsalltag."

[Turn 29] Persona: Es hat mir wirklich gut getan, diese ganzen Punkte einmal strukturiert anzusprechen, auch wenn ich zwischendurch vielleicht etwas zu weit ausgeholt habe. Ich hoffe sehr, dass durch eure Dokumentation bald einiges einfacher wird und die manuelle Arbeit ein Ende hat. Vielen Dank für deine Geduld und das offene Ohr für meinen Arbeitsalltag!
[Turn 29] Agent: "Vielen Dank für deine Offenheit und die Zeit, die du dir für dieses Gespräch genommen hast. Wir haben nun ein vollständiges Bild deiner Arbeitsabläufe. Damit ist das Interview beendet."

[Turn 30] Persona: Das freut mich wirklich sehr, denn es ist höchste Zeit, dass die vielen manuellen Hürden beim Erstellen der Angebote und bei den Reisekostenabrechnungen mal richtig angepackt werden. Ich bin schon sehr gespannt darauf, ob meine Erfahrungen dabei helfen, die Prozesse in Zukunft etwas effizienter zu gestalten. Vielen Dank, dass du dir die Zeit genommen hast, dir mein "Chaos" am Schreibtisch so geduldig anzuhören!
[Turn 30] Agent: "Alles klar, dann haben wir damit den vollen Umfang erfasst. Ich wünsche dir einen produktiveren Arbeitstag ohne das ständige Hin- und Her-Springen zwischen den Systemen. Danke für deine Zeit und die wertvollen Einblicke."

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Angebotserstellung | done | 50 ✓ | 45 ✓ | Priorisierung der Pr ✓ | Salesforce,PDF-Produ ✓ | 33 ✓ | 0 ✓ |
| Reisekostenabrechnung | done | 2 ✓ | 120 ✓ | händische Übertragen ✓ | Excel-Listen,Papierf ✓ | 22 ✓ | 1 ✓ |
| Stammdatenpflege | walkthrough | 2.5 ✓ | 120 ✓ | Abgleich digital zwi ✓ | Excel ✓ | 20 ✓ | null |
