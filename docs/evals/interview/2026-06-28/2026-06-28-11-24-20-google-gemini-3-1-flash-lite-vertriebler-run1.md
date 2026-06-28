---
interview_model: google/gemini-3.1-flash-lite
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.1-flash-lite
analyst_thinking_budget: 2048
eval_date: 2026-06-28
persona: vertriebler
interview_id: 6e75ad9c-3db8-4f25-a398-f5b9c6672a4a
eval_run_id: bb07be99-f80f-42f5-90fd-a471e199516b
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/6e75ad9c-3db8-4f25-a398-f5b9c6672a4a
run_index: 1
run_seed: 42
perturbation_seed: 42
turns_total: 31
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.93
  dedup_slot_coverage: 0.93
  slot_coverage_pre_clarification: 0.93
  dedup_slot_coverage_pre_clarification: 0.93
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  anchoring_violation_rate: 0
  tool_call_plausibility: 0.78
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0.07
  confidence_trigger_rate: n/a (keine unknown-Slots)
  talker_grounding_violations: 2
  depth_score: 1.6
  depth_p1: 0.4
  depth_p2: 0.6
  depth_p3: 0
trail:
  total_writes: 71
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.27
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.93 | maximize |
| dedup_slot_coverage | 0.93 | maximize |
| slot_coverage_pre_clarification | 0.93 | maximize |
| dedup_slot_coverage_pre_clarification | 0.93 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| anchoring_violation_rate | 0 | maximize (niedriger besser) |
| tool_call_plausibility | 0.78 | ≥ 0.70 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0.07 | < 0.01 |
| confidence_trigger_rate | n/a (keine unknown-Slots) | > 0.80 |
| talker_grounding_violations | 2 | 0 |
| depth_score | 1.6 | maximize |
| depth_p1 | 0.4 | — |
| depth_p2 | 0.6 | — |
| depth_p3 | 0 | — |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.27 | < 0.20 |


## Judge-Begründung

Überwiegend natürliche Sprache mit konsistenter Du-Form. Die Fragen [1-3] sind präzise und kontextbezogen. Abschlüsse [4-8] wirken teilweise formelhaft ('Vielen Dank', 'Auf Wiedersehen'), aber nicht generisch. Kleine Stilbrüche zwischen den Segmenten, insgesamt aber angemessen für ein Interview.


## Talker-Faktentreue-Verletzungen (KI-9)

Turn 13: "Du hast vorhin von zwei Reisekostenabrechnungen pro Monat gesprochen" — Der Mitarbeiter hat in Turn 4 gesagt 'Ich mache das so etwa zwei Mal im Monat', was sich auf das Ausfüllen von Papierformularen bezieht. Der Agent interpretiert dies korrekt als zwei Reisekostenabrechnungen pro Monat. Dies ist keine falsche Prämisse, sondern eine korrekte Referenz. Allerdings wird die Aussage im Kontext der Frage nach der Fehlerquote bei Angeboten (30%) vermischt, was verwirrend wirkt, aber keine faktische Falschzuschreibung darstellt.
Turn 20: "Du hast die handschriftlichen Notizen und Klebezettel als Medienbruch bei der Erfassung von Anfragen genannt" — Der Mitarbeiter hat in Turn 20 über handschriftliche Notizen und Klebezettel bei kurzfristigen Messeterminen gesprochen, aber nicht explizit als 'Medienbruch bei der Erfassung von Anfragen' bezeichnet. In Turn 18 hat der Mitarbeiter gesagt, es gebe 'neben dem manuellen Abgleich zwischen meiner Excel-Liste und dem PDF-Produktkatalog...keine weiteren großen Medienbrüche'. Die Klebezettel bei Messen wurden als Ausnahmesituation beschrieben, nicht als genereller Medienbruch bei der Erfassung.

## Gesprächsverlauf

[Turn 1] Persona: Eigentlich verbringe ich den Großteil meiner Zeit damit, Kundenanfragen zu bearbeiten, wofür ich meistens Salesforce und unseren Produktkatalog nutze, wobei ich leider oft wegen der Preisbedingungen im Innendienst anrufen muss. Wenn gerade Messezeit ist, bearbeite ich locker mal bis zu zwanzig Angebote pro Woche, was mich manchmal echt an meine Grenzen bringt, weil unsere Vorlagen nie so richtig passen. Ach ja, und bei den Reisekosten bin ich immer noch mit diesen nervigen Papierformularen beschäftigt, was mich an meine Anfangszeit erinnert, als wir noch alles mit der Hand ausfüllten – irgendwie hat sich da in den acht Jahren wenig getan.
[Turn 1] Agent: "Du hast von bis zu 20 Angeboten pro Woche während der Messezeit gesprochen. Wie viel Zeit investierst du im Durchschnitt in die Erstellung eines einzelnen Angebots, inklusive der Rücksprache mit dem Innendienst?"

[Turn 2] Persona: Das ist gar nicht so einfach zu sagen, weil das immer total darauf ankommt, wie komplex die Anfrage ist und wie schnell die Kollegen im Innendienst bei meinen Rückfragen zu den Sonderkonditionen antworten. Ich würde schätzen, dass ich pro Angebot so ungefähr eine bis zwei Stunden einplane, aber während der Hochsaison auf Messen verschwimmt das alles, weil dann auch ständig das Telefon klingelt und man zwischendurch immer wieder unterbrochen wird. Überhaupt, wenn ich an die Messen denke – da haben wir früher immer diese kleinen Stände gehabt, weißt du noch, wo man kaum Platz für seinen Laptop hatte, um die Salesforce-Daten abzugleichen?
[Turn 2] Agent: "Wie oft kommt es vor, dass Angebote aufgrund von Rückfragen oder Unklarheiten in den Sonderkonditionen nachträglich korrigiert werden müssen?"

[Turn 3] Persona: Das passiert schon häufiger, wobei ich keine exakte Quote nennen kann, da ich mir das nicht jedes Mal notiere. Weil ich in Salesforce oft nicht direkt sehe, was geht, muss ich eben oft beim Innendienst nachhaken und das Angebot dann im CRM manuell anpassen, was mich eigentlich genauso nervt wie meine Excel-Listen für die Reisekosten. Apropos, neulich habe ich beim Sortieren meiner alten Unterlagen wieder dieses verstaubte Abrechnungsformular in der Hand gehabt, das wir immer noch in Papierform abgeben müssen – das ist wirklich nicht mehr zeitgemäß.
[Turn 3] Agent: "Wie viel Zeit benötigst du im Durchschnitt für das Ausfüllen eines solchen Papierformulars für die Reisekosten?"

[Turn 4] Persona: Das Ausfüllen von diesen Papierformularen ist echt mühsam, da sitze ich bestimmt so ungefähr eine halbe Stunde pro Reise dran, weil ich auch die Belege alle manuell zusammensuchen und in Excel übertragen muss. Ich mache das so etwa zwei Mal im Monat, meistens direkt wenn ich wieder im Büro bin, auch wenn ich mich dann lieber direkt um die Kundenanfragen kümmern würde. Wusstest du eigentlich, dass ich damals, als ich hier angefangen habe, noch alles per Post an die Buchhaltung geschickt habe? Da bin ich heute fast schon froh über den internen Hauspostweg, obwohl das natürlich auch nicht schneller geht.
[Turn 4] Agent: "Welche Unterlagen oder Informationen musst du konkret zusammentragen, bevor du mit dem Ausfüllen des Papierformulars beginnst, und was genau gibst du am Ende als fertiges Dokument an die Buchhaltung weiter?"

[Turn 5] Persona: Für die Abrechnung sammle ich alle Belege zusammen und übertrage diese sowie meine Fahrtkosten manuell in Excel-Tabellen, bevor ich alles in das Papierformular eintrage. Am Ende reiche ich dieses Formular zusammen mit den physischen Belegen als fertiges Paket beim Innendienst ein. Da erinnerst du mich daran, wie ich früher bei Dienstreisen immer penibel darauf geachtet habe, jede Quittung sofort zu lochen, damit sie bloß nicht in meiner Tasche zerknittert – heute habe ich da ein bisschen mehr Routine, auch wenn das System dahinter leider genauso altbacken geblieben ist.
[Turn 5] Agent: "Was genau erhältst du vom Kunden, wenn eine Anfrage bei dir eingeht, und welche Informationen fehlen dir dabei typischerweise?"

[Turn 6] Persona: Meistens trudeln die Kundenanfragen ganz klassisch per E-Mail oder über einen kurzen Anruf bei mir ein, wobei ich dann direkt meine Stammdaten in Salesforce abgleiche. Oft fehlen mir aber genau die entscheidenden Details zu den Preisbedingungen, was mich jedes Mal dazu zwingt, den Innendienst zu kontaktieren, weil ich die aktuellen Sonderkonditionen in meinem System einfach nicht einsehen kann. Das ist manchmal echt frustrierend, weil ich mich eigentlich lieber direkt auf die eigentliche Angebotserstellung konzentrieren würde, aber so hänge ich dann in der Warteschleife fest – kennst du das, wenn man eigentlich nur schnell etwas erledigen will, aber die Technik oder die Prozesse einfach nicht mitspielen wollen?
[Turn 6] Agent: "Wenn du die Rückmeldung vom Innendienst erhalten hast, in welcher Form versendest du das Angebot final an den Kunden und wie oft kommt es vor, dass du aufgrund der manuellen Zwischenschritte später noch Korrekturen am Dokument vornehmen musst?"

[Turn 7] Persona: Nachdem ich die Infos vom Innendienst habe, erstelle ich das Angebot direkt in unserem CRM und schicke es dann meistens per E-Mail an den Kunden raus. Da unsere Vorlagen selten perfekt passen, muss ich leider ziemlich oft manuell nachbessern, wobei ich keine genaue Prozentzahl nennen kann, da es sich um eine ständige manuelle Anpassung handelt. Weißt du, früher habe ich mir bei solchen Korrekturen immer noch handschriftliche Notizen gemacht, damit ich beim nächsten Mal nicht wieder alles neu erfragen muss – heute versuche ich das in Salesforce zu lösen, aber ganz reibungslos klappt das bei den vielen Kundenanfragen eben selten.
[Turn 7] Agent: "Wenn du die Vorlagen manuell anpasst, woran machst du fest, welche Änderungen im Einzelfall notwendig sind?"

[Turn 8] Persona: Die Anpassungen mache ich meistens davon abhängig, welche spezifischen Produkte oder Mengen der Kunde anfragt, da die Standardvorlage eben oft nicht auf den Einzelfall zugeschnitten ist. Ich schaue mir das dann in Salesforce an und vergleiche es mit meinem Produktkatalog als PDF, um das Dokument manuell auf das aktuelle Kundenprojekt zu biegen. Das ist schon ein ziemliches Gefummel, fast so wie damals, als ich noch versucht habe, meine Excel-Kundenlisten mit den Systemdaten abzugleichen, ohne dabei den Überblick über die Preise zu verlieren.
[Turn 8] Agent: "Wie oft erreichen dich im Monat im Schnitt diese Kundenanfragen, und wie viel Zeit wendest du insgesamt für die Bearbeitung dieser allgemeinen Anfragen auf, bevor die eigentliche Angebotserstellung beginnt?"

[Turn 9] Persona: Das variiert stark je nach Saison, aber ich lande so ungefähr bei 20 bis 80 Anfragen pro Monat, wenn man die Messezeiten mit einberechnet. Für die Bearbeitung der Anfragen und den Abgleich der Stammdaten in Salesforce sowie die nötigen Vorbereitungen brauche ich meistens noch einmal etwa 15 bis 30 Minuten, bevor ich überhaupt mit dem eigentlichen Schreiben des Angebots anfangen kann. Manchmal verbringe ich die Zeit auch damit, meine eigene Excel-Kundenliste aktuell zu halten, damit ich bei der nächsten Anfrage direkt weiß, welche Ansprechpartner eigentlich hinter den Anfragen stecken, was früher bei den alten Karteikarten auch nicht einfacher war.
[Turn 9] Agent: "Du hast vorhin von bis zu 20 Angeboten pro Woche gesprochen, jetzt nennst du 20 bis 80 Anfragen pro Monat. Bezieht sich die höhere Zahl auf alle eingehenden Anfragen, von denen nur ein Teil zu einem Angebot führt?

Wie oft musst du bei der Angebotserstellung zwischen Salesforce und dem PDF-Produktkatalog hin- und herwechseln?"

[Turn 10] Persona: Genau, die 20 bis 80 Anfragen beziehen sich auf alle eingehenden Kontakte, von denen natürlich nicht jede sofort in ein konkretes Angebot mündet, da oft noch Klärungsbedarf besteht. Was den Wechsel zwischen Salesforce und dem PDF-Produktkatalog angeht, mache ich das eigentlich ständig während der Erstellung, vielleicht so bei jedem zweiten oder dritten Arbeitsschritt, um die Daten abzugleichen. Manchmal wünschte ich mir echt, die Informationen wären direkt an einer zentralen Stelle verknüpft, das würde mir das Hin- und Her-Geklicke ersparen, das mich an meine alten Tage erinnert, als ich ständig zwischen physischen Katalogen und dem Computer hin- und herrennen musste.
[Turn 10] Agent: "Das klärt die Diskrepanz bei den Anfragen-Zahlen. Wie oft kommen bei deinen Reisekostenabrechnungen Rückfragen vom Innendienst oder Korrekturbedarf vor, weil Belege fehlen oder das Formular nicht vollständig ausgefüllt wurde?"

[Turn 11] Persona: Das kommt tatsächlich öfter vor, als mir lieb ist, wobei ich da keine genaue Statistik führe, weil ich die Rückfragen meist einfach schnell korrigiere. Ich würde sagen, bei jeder dritten oder vierten Abrechnung meldet sich der Innendienst bei mir, sei es wegen einer fehlenden Quittung oder einer Unklarheit bei den Fahrtkosten. Das ist dann immer besonders ärgerlich, weil ich das Papierformular dann erneut anfassen muss – eigentlich habe ich mich damals schon in meiner ersten Woche bei der Firma über dieses umständliche Procedere gewundert, aber es hat sich bis heute leider kaum etwas an der Kommunikation mit der Buchhaltung geändert.
[Turn 11] Agent: "Wie erfolgt die Kommunikation mit dem Innendienst, wenn Rückfragen zu deinen Reisekostenabrechnungen auftreten – läuft das primär über E-Mail, Telefon oder kommen die Kollegen persönlich auf dich zu?"

[Turn 12] Persona: Die Klärung bei Reisekosten läuft meistens ganz informell über E-Mail oder einen kurzen Anruf, wobei die Kollegen aus dem Innendienst mich auch schon mal direkt am Schreibtisch ansprechen, wenn sie gerade wegen etwas anderem vorbeikommen. Es passiert so ungefähr bei einem Viertel meiner Abrechnungen, dass da noch mal nachgehakt wird, und dann schaue ich halt schnell in meine Unterlagen, um das zu korrigieren. Früher im alten Bürogebäude hatten wir eine richtige Zentrale für sowas, da musste man sogar noch persönlich den Gang hinuntergehen, um die Zettel abzugeben – heute ist das zwar digitaler per E-Mail, aber das Papierformular bleibt trotzdem unser treuer Begleiter.
[Turn 12] Agent: "Wenn du die Angebote erstellst: Musst du bei eher 10 % oder eher bei 30 % der Angebote nach dem ersten Versand noch einmal manuell korrigieren? Und welche anderen Programme oder Unterlagen neben Salesforce und dem PDF-Katalog hast du währenddessen noch parallel geöffnet?"

[Turn 13] Persona: Ich würde sagen, der Wert liegt eher bei 30 %, da die Vorlagen eben nicht immer perfekt passen und oft noch kleine Details angepasst werden müssen. Neben Salesforce und dem PDF-Produktkatalog habe ich meistens noch Outlook für die Kommunikation und meine Excel-Kundenliste offen, damit ich alle Informationen an einem Ort habe. Es ist ein ziemliches Hin-und-Her-Geklicke, das mich manchmal fast so stresst wie damals, als ich noch mit richtigen Aktenordnern jongliert habe, obwohl wir heute wenigstens schon Salesforce haben.
[Turn 13] Agent: "Du hast vorhin von zwei Reisekostenabrechnungen pro Monat gesprochen, jetzt erwähnst du 30 % als Fehlerquote bei den Angeboten — lass uns kurz sicherstellen, dass wir hier nichts vermischen: Wie viele Reisekostenabrechnungen reichst du tatsächlich im Durchschnitt pro Monat ein?

Und wenn du die Angebote erstellst: Wie oft musst du dabei zwischen den Anwendungen hin- und herwechseln, um die Informationen aus Outlook, Excel und dem PDF-Katalog zusammenzuführen?"

[Turn 14] Persona: Wie ich eingangs schon erwähnte, reiche ich im Schnitt etwa zweimal im Monat meine Reisekostenabrechnungen ein, das ist mittlerweile schon fest in meinem Rhythmus verankert. Beim Erstellen der Angebote wechsle ich eigentlich ununterbrochen zwischen Outlook, meiner Excel-Liste, dem PDF-Produktkatalog und Salesforce hin und her, um alles zusammenzubekommen – das ist ein ständiges Klicken, bestimmt bei fast jedem Handgriff. Manchmal verliere ich bei diesem ganzen Jonglieren zwischen den Fenstern fast den Faden, was mich an meine Anfangszeit erinnert, in der ich noch zwischen verschiedenen Aktenordnern und dem Telefon hin- und hergehetzt bin.
[Turn 14] Agent: "Wenn du die Angebote final fertigstellst: In welcher Form verlässt das Dokument dein Haus — also druckst du es physisch aus, oder versendest du es ausschließlich digital als PDF-Anhang?

Und wenn wir auf den gesamten Prozess der Angebotserstellung schauen: Gibt es dabei einen Schritt, der zwingend auf eine Rückmeldung vom Innendienst wartet, bevor du überhaupt weitermachen kannst?"

[Turn 15] Persona: Ich verschicke die Angebote mittlerweile eigentlich fast nur noch digital als PDF-Anhang per E-Mail, was deutlich effizienter ist als früher, als wir alles per Post versendet haben. Der absolute Flaschenhals ist jedoch die Preisabfrage bei Sonderkonditionen, da ich hier zwingend auf die Rückmeldung aus dem Innendienst warten muss, bevor ich das Angebot in Salesforce finalisieren kann. Das ist wirklich ein kritischer Punkt, denn ohne diese Info steht mein ganzer Prozess still – das ist fast wie in meiner Anfangszeit, als man ohne Freigabe des Vorgesetzten gar nichts machen durfte.
[Turn 15] Agent: "Gibt es bei den Reisekosten neben dem Papierformular noch weitere Medienbrüche, etwa beim Scannen oder der digitalen Ablage der Belege?

Und wie dokumentierst du in Salesforce, wenn eine Kundenanfrage eingeht, aber aufgrund der fehlenden Preisinfos noch kein Angebot erstellt werden kann – gibt es dafür einen festen Status oder ein anderes Ergebnis, das du festhältst?"

[Turn 16] Persona: Bei der Reisekostenabrechnung gibt es tatsächlich gar keine digitale Ablage, ich reiche die Belege einfach gesammelt in Papierform zusammen mit dem Formular ein. In Salesforce lege ich für die Anfrage zwar einen Datensatz an, aber da es keinen festen Status für „warte auf Preisinfo“ gibt, muss ich mir das meistens über eine manuelle Wiedervorlage notieren. Das ist ehrlich gesagt auch ein ziemliches Chaos, weil man schnell den Überblick verliert, wenn gerade viel los ist – früher haben wir das wenigstens in ein dickes Notizbuch geschrieben, das war zumindest übersichtlicher als dieses digitale Suchen.
[Turn 16] Agent: "Das manuelle Notieren der Wiedervorlage erzeugt zusätzliche Arbeit. Wie oft passieren dir bei der initialen Erfassung der Kundenanfragen in Salesforce Fehler, und was genau ist das Ergebnis, das du aus dieser Phase an die Angebotserstellung übergibst?"

[Turn 17] Persona: Da ich bei der Erfassung in Salesforce alles manuell eingebe, passieren mir schon mal Flüchtigkeitsfehler, etwa bei einem Zahlendreher in der Kundennummer oder einer falschen E-Mail-Adresse, wobei ich das auf vielleicht fünf Prozent der Anfragen schätze. Am Ende dieser Phase habe ich einen angelegten Datensatz im CRM, der allerdings meist noch unvollständig ist, weil mir die finalen Preisdaten für das Angebot fehlen. Früher habe ich solche Infos auf Klebezettel geschrieben und an meinen Monitor geheftet, was heute in Salesforce zwar ordentlicher aussieht, aber inhaltlich leider genauso lückenhaft bleibt, bis der Innendienst mir die nötigen Informationen liefert.
[Turn 17] Agent: "Gibt es bei der Erfassung der Kundenanfragen oder bei der Angebotserstellung außer den bereits genannten Punkten noch weitere Medienbrüche, bei denen du Informationen von Papier oder aus anderen Quellen manuell in das System übertragen musst?

Und woran erkennst du bei einer neuen Anfrage sofort, ob diese besonders dringlich ist oder eine höhere Priorität bei der Bearbeitung erfordert?"

[Turn 18] Persona: Neben dem manuellen Abgleich zwischen meiner Excel-Liste und dem PDF-Produktkatalog gibt es tatsächlich keine weiteren großen Medienbrüche, aber das ständige manuelle Abtippen der Informationen reicht mir schon vollkommen. Ob eine Anfrage eilt, erkenne ich meistens an der Art der E-Mail oder weil der Kunde direkt anruft und Druck macht, denn ein offizielles Priorisierungssystem gibt es in Salesforce leider nicht. Das läuft dann alles über mein eigenes Bauchgefühl, was mich ein wenig an meine Anfangszeit erinnert, als ich die wichtigsten Kundenanfragen mit farbigen Klebezetteln markiert habe, damit sie in dem ganzen Stapel auf meinem Schreibtisch nicht untergehen.
[Turn 18] Agent: "Gibt es neben der Priorisierung noch andere Situationen oder Anfragen, die sich nicht an deinen Standardprozess halten – also echte Ausnahmen, bei denen du Salesforce gar nicht wie gewohnt nutzen kannst?"

[Turn 19] Persona: Eigentlich folge ich bei fast allen Kundenanfragen meinem Standardprozess, weil ich alles zentral in Salesforce erfasse, auch wenn es manchmal etwas mühsam ist. Es gibt zwar keine echten Ausnahmen, bei denen ich Salesforce komplett umgehe, aber bei sehr kurzfristigen Messeterminen kommt es manchmal vor, dass ich vorab nur telefonische Absprachen treffe und das CRM erst nachträglich pflege, was das Risiko für Fehler natürlich erhöht. Das erinnert mich ein bisschen an meine Anfangsjahre, als wir bei Sonderwünschen von Stammkunden öfter mal improvisieren mussten, weil das damalige System einfach nicht flexibel genug war.
[Turn 19] Agent: "Wenn du bei diesen kurzfristigen Messeterminen erst im Nachgang in Salesforce pflegst, welche Unterlagen oder Notizen nutzt du in der Zwischenzeit, um den Überblick über die getroffenen Absprachen zu behalten?"

[Turn 20] Persona: In solchen Fällen verlasse ich mich meistens auf meine handschriftlichen Notizen in einem Block oder klebe mir Zettel an den Monitor, damit ich während der Messe nichts vergesse. Sobald ich dann zurück im Büro bin, übertrage ich diese Informationen so schnell wie möglich in meine Excel-Liste und natürlich in Salesforce. Manchmal habe ich das Gefühl, dass ich ein zweites Gehirn bräuchte, um all diese Zwischenschritte sauber zu dokumentieren – früher habe ich das alles einfach in einem großen Kalender notiert, der war zwar auch nicht sonderlich strukturiert, aber immerhin hatte ich da alles auf einen Blick.
[Turn 20] Agent: "Du hast die handschriftlichen Notizen und Klebezettel als Medienbruch bei der Erfassung von Anfragen genannt. Gibt es bei der eigentlichen Angebotserstellung neben dem Abgleich mit dem PDF-Katalog und deiner Excel-Liste noch weitere Stellen, an denen du Informationen von Papier oder anderen analogen Quellen in das System übertragen musst?"

[Turn 21] Persona: Nein, bei der eigentlichen Angebotserstellung kommen dann zum Glück keine weiteren Zettel mehr dazu, weil ich mich dann voll auf Salesforce und meine digitalen Listen konzentriere. Der größte Medienbruch bleibt da wirklich die Abhängigkeit vom PDF-Katalog, den ich ständig nebenbei offen habe, um die Produktdaten manuell abzugleichen. Manchmal wünsche ich mir, diese Informationen wären fest im System hinterlegt, statt dass ich da ständig zwischen meinen Fenstern hin- und herwechsle – früher mussten wir da noch in dicken Papierkatalogen blättern, das war sicher noch langsamer als heute.
[Turn 21] Agent: "Wenn du dir eine ideale digitale Lösung für die Zusammenarbeit mit dem Innendienst vorstellen könntest, welche Informationen oder Funktionen würden dir das Hin- und Her-Geklicke am meisten erleichtern?"

[Turn 22] Persona: Mir würde es enorm helfen, wenn die aktuellen Preisbedingungen und Sonderkonditionen direkt und transparent in Salesforce hinterlegt wären, sodass ich nicht mehr für jede Rückfrage beim Innendienst anrufen oder warten muss. Ein Tool, das die Produktkatalog-Daten automatisch mit meinen Angeboten verknüpft, würde mir dieses ständige Hin- und Her-Geklicke zwischen den verschiedenen Fenstern endlich ersparen. Wenn ich dann noch eine automatisierte Wiedervorlage hätte, statt mir alles mühsam notieren zu müssen, wäre ich schon richtig glücklich – das fühlt sich heute an wie der Sprung vom manuellen Karteikasten in die Moderne, von dem ich schon so lange träume.
[Turn 22] Agent: "Welche Informationen aus dem PDF-Produktkatalog fehlen dir in Salesforce am meisten, um den ständigen Wechsel zwischen den Fenstern zu vermeiden?

Damit habe ich ein sehr vollständiges Bild deiner Prozesse gewonnen. Vielen Dank für deine Zeit und die detaillierten Einblicke."

[Turn 23] Persona: Am meisten fehlen mir in Salesforce die aktuellen, dynamischen Preisbedingungen, da ich im PDF-Katalog immer mühsam nach den spezifischen Staffelpreisen und möglichen Sonderkonditionen suchen muss. Es ist wirklich zäh, weil diese Informationen dort eben nicht mit meinen Kundendaten verknüpft sind, was mich bei der Angebotserstellung ständig aus dem Rhythmus bringt. Schön, dass wir das alles einmal durchgehen konnten – das hat mir selbst auch mal wieder verdeutlicht, wie viel Zeit ich eigentlich mit diesem Suchen und Klicken verbringe.
[Turn 23] Agent: "Gibt es abschließend noch einen Punkt oder eine Anmerkung, die dir besonders am Herzen liegt, bevor wir das Gespräch beenden?"

[Turn 24] Persona: Eigentlich würde ich mir nur wünschen, dass wir bei den Reisekosten endlich weg von diesem Papierkram kommen, denn das ist wirklich der letzte Prozessschritt, der sich so gar nicht modern anfühlt. Es wäre toll, wenn wir das alles irgendwie digital lösen könnten, so wie ich es mir für die Salesforce-Angebote auch wünsche – dann müsste ich mich nicht mehr mit dem Zusammentragen und Lochen der Belege aufhalten. Aber mal sehen, vielleicht passiert da ja bald mal etwas, das würde mir auf jeden Fall einiges an Zeit sparen und meine Arbeit deutlich angenehmer machen.
[Turn 24] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

[Turn 25] Persona: Ehrlich gesagt gibt es da eine Sache, die mich jede Woche aufs Neue beschäftigt, nämlich die ständige Kontrolle meiner eigenen Excel-Kundenliste, um sicherzugehen, dass ich bei der Stammdatenpflege in Salesforce nichts übersehen habe. Ich verbringe bestimmt so zwei bis drei Stunden pro Woche damit, diese Liste manuell abzugleichen, weil ich mich auf die Daten im CRM allein noch nicht zu hundert Prozent verlassen kann. Es ist ein bisschen wie in alten Zeiten, als ich meine Kontakte noch in diesen kleinen schwarzen Adressbüchern gepflegt habe – man hat immer Angst, dass eine wichtige Information verloren geht, wenn man sie nicht doppelt und dreifach notiert hat.
[Turn 25] Agent: "Das klingt nach einem manuellen Aufwand, um die Datenqualität sicherzustellen. Wie genau führst du diesen Abgleich zwischen deiner Excel-Liste und den Salesforce-Stammdaten durch und welche spezifischen Informationen prüfst du dabei primär?"

[Turn 26] Persona: Dafür nehme ich meine Excel-Tabelle und gehe Zeile für Zeile meine Kunden durch, um sie manuell mit den Einträgen in Salesforce abzugleichen. Dabei prüfe ich primär die Kontaktdaten der Ansprechpartner und die hinterlegten Firmenadressen, weil sich da über die Zeit immer wieder mal etwas ändert. Das ist echt eine mühsame Arbeit, die mich oft an meine Anfangszeit erinnert, als wir solche Änderungen noch komplett handschriftlich in unseren Karteikarten nachpflegen mussten.
[Turn 26] Agent: "Damit sind alle Punkte geklärt und wir haben ein vollständiges Bild der Prozesse. Das Gespräch ist beendet."

[Turn 27] Persona: Das freut mich wirklich sehr, dass wir das alles so ausführlich durchgehen konnten, denn das hilft mir hoffentlich auch ein Stück weit dabei, den Stress im Alltag ein bisschen besser in den Griff zu bekommen. Es ist schon ein komisches Gefühl, nach acht Jahren hier im Vertrieb plötzlich so schwarz auf weiß zu sehen, wie viel Zeit man eigentlich mit Dingen verbringt, die heute eigentlich automatisch gehen sollten. Dann mache ich mich jetzt mal wieder an meine Anfragen – hoffentlich ist der Innendienst heute schnell, damit ich nicht wieder so lange warten muss!
[Turn 27] Agent: "Vielen Dank für deine Offenheit und die Zeit, die du dir genommen hast. Ich wünsche dir einen erfolgreichen Arbeitstag."

[Turn 28] Persona: Das gebe ich gerne zurück, vielen Dank für das nette Gespräch! Es tat wirklich gut, diese ganzen Abläufe mal laut auszusprechen, anstatt sie nur in meinem Kopf oder auf meinen Zetteln herumzuschleppen. Jetzt widme ich mich erst mal wieder meiner Kundenliste, in der Hoffnung, dass heute nicht allzu viele Rückfragen beim Innendienst auf mich warten.
[Turn 28] Agent: "Alles klar, dann wünsche ich dir viel Erfolg bei der Arbeit und einen möglichst reibungslosen Ablauf mit dem Innendienst heute."

[Turn 29] Persona: Danke dir, das hoffe ich auch sehr, denn nach acht Jahren hier wünsche ich mir einfach nur, dass ich mich mal wieder voll auf meine eigentlichen Vertriebsaufgaben konzentrieren kann. Vielleicht habe ich ja heute Glück und die Preisabfragen klappen ausnahmsweise mal zügig, damit ich nicht wieder ewig in der Warteschleife hänge. Wir hören uns bestimmt bald wieder, wenn wir vielleicht an einem der Punkte mal etwas verändern können!
[Turn 29] Agent: "Das ist ein nachvollziehbarer Wunsch. Ich habe alle Informationen für meine Auswertung zusammen. Vielen Dank für deine Zeit und die detaillierten Einblicke."

[Turn 30] Persona: Gerne geschehen, das war wirklich ein interessanter Austausch und hat mir nochmal vor Augen geführt, an welchen Stellen ich im Alltag am meisten Zeit verliere. Wenn wir bei der Modernisierung der Prozesse irgendwann Fortschritte machen, wäre ich die Erste, die sich über weniger Papierkram und ein reibungsloseres System freut. Ich wünsche dir jedenfalls viel Erfolg bei deiner Auswertung und hoffe, dass meine Erfahrungen bei der Verbesserung unserer Abläufe helfen!
[Turn 30] Agent: "Deine Schilderungen fließen direkt in die Prozessanalyse ein. Auf Wiedersehen."

[Turn 31] Persona: Auf Wiedersehen, das hat wirklich gut getan, die ganzen Punkte einmal so offen anzusprechen! Hoffentlich führt das bald dazu, dass ich nicht mehr ständig zwischen meinen Excel-Listen und dem CRM hin- und herwechseln muss. Ich mache mich jetzt auch direkt wieder an die Arbeit und hoffe, dass ich heute mal ohne allzu viele Rückfragen beim Innendienst durch den Tag komme.
[Turn 31] Agent: "Alles klar, dann wünsche ich dir einen produktiven Tag und einen reibungslosen Ablauf bei deinen Aufgaben. Auf Wiedersehen."

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Reisekostenabrechnung | done | 2 ✓ | 30 ✓ | Klärung erfolgt info ✓ | Excel,Papierformular ✓ | 25 ✓ | 1 ✓ |
| Vertrieb | walkthrough | 50 ✓ | 22 ✓ | Kundenanfragen (Sond ✓ | Excel-Tabelle,Salesf ✓ | 5 ✓ | null |
| Angebotserstellung | done | 80 ✓ | 90 ✓ | Manuelles Abgleichen ✓ | PDF-Produktkatalog,S ✓ | 30 ✓ | 1 ✓ |
