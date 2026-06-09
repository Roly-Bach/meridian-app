---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-08
persona: vertriebler
interview_id: b8a3bde6-3273-4f19-acdb-eb65ed3cb825
eval_run_id: 7f603874-6441-4ea0-8880-2f7cb89726e1
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/b8a3bde6-3273-4f19-acdb-eb65ed3cb825
turns_total: 10
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.63
  dedup_slot_coverage: 0.63
  slot_coverage_pre_clarification: 0.63
  dedup_slot_coverage_pre_clarification: 0.63
  clarification_coverage_delta: 0
  phase_progression: 0.4
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.89
  dialog_naturalness: 0.72
  completion_correctness: true
  step_registration_coverage: 1
trail:
  total_writes: 8
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.13
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.63 | maximize |
| dedup_slot_coverage | 0.63 | maximize |
| slot_coverage_pre_clarification | 0.63 | maximize |
| dedup_slot_coverage_pre_clarification | 0.63 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 0.4 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.89 | ≥ 0.80 |
| dialog_naturalness | 0.72 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.13 | < 0.20 |

## Gesprächsverlauf

[Turn 1] Persona: Hallo! Also, meine Tage bestehen meist aus einem Mix aus der Betreuung meiner Bestandskunden in Salesforce und dem Erstellen von Angeboten, was ich so fünf bis zwanzig Mal pro Woche mache – wobei das nach Messen echt explodiert. Das ist oft etwas zäh, weil ich bei Sonderkonditionen immer noch das alte System abfragen muss und die Vorlagen in Outlook meistens nicht direkt passen. Oh, wo wir gerade von Messen sprechen, da musste ich neulich auch wieder ewig lange meine Reisekosten händisch in Excel zusammenklicken, was mich echt Nerven kostet!
[Turn 1] Agent: "Danke für den guten Überblick über deine Aufgaben. 

Lass uns beim Erstellen von Angeboten einsteigen: Was ist der allererste Schritt, den du machst, wenn du ein Angebot vorbereitest?"

[Turn 2] Persona: Wenn eine Anfrage per E-Mail oder Anruf reinkommt, schaue ich mir zuerst die Daten des Bestandskunden in Salesforce an, damit ich überhaupt weiß, mit wem ich es zu tun habe. Danach geht es direkt weiter zur Angebotserstellung im CRM, wobei ich mich immer ein bisschen ärgere, dass ich für die Konditionen ständig beim Innendienst nachhaken muss. Das erinnert mich übrigens daran, wie oft ich früher in die Kundenkartei geschaut habe, bevor wir dieses digitale System überhaupt hatten, aber Salesforce ist da jetzt schon ein ganzes Stück moderner, auch wenn es manchmal etwas hakt.
[Turn 2] Agent: "Wie viel Zeit verbringst du im Durchschnitt mit der Erstellung eines einzelnen Angebots, von der ersten Recherche in Salesforce bis zum fertigen Dokument?"

[Turn 3] Persona: Das lässt sich schwer pauschal sagen, weil das so ungefähr zwischen den Kundenanfragen schwankt, aber es zieht sich oft, da ich ja die Konditionen manuell beim Innendienst erfragen muss. Wenn ich schätzen müsste, verbringe ich da schon einiges an Zeit mit, auch weil die Vorlagen meist nicht passen und ich sie erst mühsam anpassen muss. Apropos Anpassen, meine Excel-Liste für die Reisekosten ist da leider ähnlich zeitintensiv, was mich manchmal echt aus dem Konzept bringt.
[Turn 3] Agent: "Ok, das passt so. 

Du hast erwähnt, dass du für Sonderkonditionen immer noch ein altes System abfragen musst. Wie gehst du dabei Schritt für Schritt vor?"

[Turn 4] Persona: Bei den Sonderkonditionen läuft das meistens so, dass ich die Anfrage aus dem Altsystem ziehe, aber da mir der direkte Zugriff auf aktuelle Preise fehlt, muss ich zwangsläufig den Innendienst kontaktieren. Es ist wirklich mühsam, da ich ständig zwischen dem Tool und den Leuten hin- und herwechsle, um am Ende alles manuell in das oft unpassende Angebot-Template einzutragen. Wusstest du eigentlich, dass das Wetter auf den Messen immer einen riesigen Einfluss auf meine Motivation hat, diese ganzen manuellen Schritte durchzuführen?
[Turn 4] Agent: "Lassen wir das so stehen.

Folgt das Erstellen eines Angebots bei dir immer dem gleichen Schema, oder entscheidest du das von Fall zu Fall?"

[Turn 5] Persona: Eigentlich folge ich bei jeder Anfrage immer dem gleichen Schema: Ich nehme die Anfrage per E-Mail oder Anruf entgegen, prüfe die Bestandskundendaten in Salesforce und erstelle dann das Angebot im CRM. Danach setze ich mir in Outlook immer einen Nachfass-Reminder, wobei das ganze Prozedere eben stark von den manuellen Anpassungen der Vorlagen und der Abstimmung mit dem Innendienst abhängt. Ach, bei den Reisekosten ist das übrigens viel starrer, da muss ich nach jeder Reise alles in Excel händisch eintragen und das Papierformular einreichen, was mich immer an meine Zeit erinnert, als ich noch viel mehr Papierkram auf dem Schreibtisch hatte.
[Turn 5] Agent: "Verstanden — weiter im Ablauf.

Wie oft im Monat machst du diese Reisekostenabrechnung in Excel und wie viel Zeit benötigst du dafür ungefähr pro Abrechnung?"

[Turn 6] Persona: Das mache ich meistens so zwei Mal im Monat direkt nach meinen Dienstreisen, wobei das natürlich auch davon abhängt, wie viele Termine ich gerade habe. Die Arbeit in Excel und das Ausfüllen des Papierformulars kosten mich jedes Mal eine ordentliche Portion Zeit, die ich eigentlich viel lieber in die Betreuung meiner Kunden investieren würde. Das erinnert mich daran, wie ich früher als Berufseinsteigerin noch jeden einzelnen Beleg mit Klebestreifen auf A4-Blätter geklebt habe, was heute zum Glück wegfällt, auch wenn der Prozess immer noch nicht automatisiert ist.
[Turn 6] Agent: "Wie viel Zeit benötigst du denn ungefähr für eine dieser Reisekostenabrechnungen, vom Eintragen in Excel bis zum Einreichen des Papierformulars?"

[Turn 7] Persona: Das ist bei mir immer eine ziemliche Fummelei, für die ich mir meistens einen festen Block im Kalender reserviere, weil ich mich da echt reinfuchsen muss. Da die Erfassung meiner Belege und Kilometerpauschalen komplett manuell in Excel erfolgt und ich das interne Formular danach noch physisch abgeben muss, summiert sich das Ganze auf bestimmt eine Stunde oder mehr pro Reise. Früher habe ich für solche organisatorischen Dinge übrigens viel länger gebraucht, aber diese Excel-Tabellen fühlen sich für mich immer noch wie eine Zeitreise in die Vergangenheit an.
[Turn 7] Agent: "Halten wir das offen.

Gibt es neben der Angebotserstellung und der Reisekostenabrechnung noch andere administrative oder wiederkehrende Aufgaben in deinem Arbeitsalltag, die viel Zeit in Anspruch nehmen?"

[Turn 8] Persona: Ehrlich gesagt konzentriert sich mein Arbeitsalltag fast vollständig auf diese beiden Bereiche, da gerade das manuelle Hin- und Hergeschiebe bei den Angeboten und die Abrechnungen meine Kapazitäten binden. Wenn ich nicht gerade in Salesforce oder Excel unterwegs bin, kümmere ich mich um die direkte Kundenkommunikation, wobei die saisonalen Schwankungen nach Messen mein Pensum ohnehin meistens voll auslasten. Wusstest du eigentlich, dass ich früher nebenbei noch für die Büroorganisation zuständig war, was ich heute zum Glück komplett abgegeben habe, da das damals wirklich den Rahmen gesprengt hätte?
[Turn 8] Agent: "Ich nehme das so auf.

Wie oft kommt es bei der manuellen Erstellung der Angebote zu Fehlern oder Korrekturschleifen, beispielsweise wegen falscher Konditionen?"

[Turn 9] Persona: Es kommt schon mal vor, dass ich beim Übertragen der Daten vom Altsystem oder nach einer Info vom Innendienst mal daneben liege, wobei ich die Anzahl der Korrekturschleifen nur schwer schätzen kann. Da die Templates oft nicht passen und ich vieles manuell anpasse, schleichen sich da natürlich eher Fehler ein, als wenn das Ganze automatisiert wäre. Das ist so ein bisschen wie bei meinen Reisekosten, wo ich mich bei den Kilometerpauschalen in der Excel-Tabelle auch schon mal vertippt habe, was dann immer zu Rückfragen in der Buchhaltung führt.
[Turn 9] Agent: "Vielen Dank für die detaillierten Einblicke in deine Arbeitsschritte bei der Angebotserstellung und der Reisekostenabrechnung. Ich habe nun alle wichtigen Informationen strukturiert erfasst. 

Damit sind wir am Ende unseres Gesprächs angekommen. Danke für deine Zeit und deine Unterstützung!"

[Turn 10] Persona: Sehr gerne geschehen, es hat mir wirklich geholfen, diese ganzen Abläufe mal laut auszusprechen. Ich hoffe, dass wir durch die Dokumentation vielleicht bald diese manuellen Umwege bei den Angeboten und bei meinen Reisekosten loswerden, das würde mir den Alltag enorm erleichtern. Wo wir gerade vom Ende sprechen, erinnerst du dich, wie wir vor acht Jahren angefangen haben, als alles noch viel komplizierter war?
[Turn 10] Agent: "Gerne. Vielen Dank nochmals für deine Unterstützung und alles Gute für deine Arbeit!"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Angebotserstellung | walkthrough | 54 ✓ | null | null | Outlook ✓ | null | null |
| reisekostenabrechnung | walkthrough | 2 ✓ | 60 ✓ | null | Excel ✓ | null | 2 ✓ |
