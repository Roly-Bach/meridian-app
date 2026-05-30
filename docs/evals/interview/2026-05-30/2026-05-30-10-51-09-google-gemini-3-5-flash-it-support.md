---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
eval_date: 2026-05-30
persona: it-support
interview_id: c76f1229-bd01-4d29-8921-504fab8ce862
eval_run_id: b2184107-8c7a-47d2-8512-8be45f3c33fe
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/c76f1229-bd01-4d29-8921-504fab8ce862
turns_total: 25
status: FAIL
baseline_label: PROJ-22-pre-baseline
scores:
  slot_coverage: 0.5
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 1
  dialog_naturalness: 0.78
  completion_correctness: false
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.5 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 1 | ≥ 0.95 |
| dialog_naturalness | 0.78 | maximize |
| completion_correctness | false | true |

## Gesprächsverlauf

[Turn 1] Persona: Ticket-Bearbeitung und Hardware-Tausch. Jira checken, Remote-Zugriffe oder Vor-Ort-Support, Lagerbestände prüfen. Alles im Wechsel. Läuft.
[Turn 1] Agent: "Hallo Michael. Schön, dass du dir Zeit nimmst. Unser Ziel heute ist es, deine täglichen Abläufe im IT-Support genauer zu verstehen und dein wertvolles Praxiswissen zu dokumentieren. Das Ganze wird vertraulich behandelt. 

Du hast ja gerade schon ein paar Aufgaben genannt. Kannst du mir beschreiben, wie ein ganz typischer Arbeitstag bei dir beginnt und welche Aufgaben dabei die meiste Zeit einnehmen?"

[Turn 2] Persona: Jira checken. Ticket-Bearbeitung frisst die meiste Zeit. Wechsel zwischen Jira, Remote Desktop und Wiki. Kommt drauf an.
[Turn 2] Agent: "Das klingt nach einem zentralen Ablauf in deinem Alltag. Wie genau sieht der erste Schritt aus, wenn du Jira öffnest, um ein Ticket zu bearbeiten?"

[Turn 3] Persona: Ticket annehmen. Diagnostizieren via Remote Desktop oder vor Ort. Lösung im Wiki suchen oder selbst erarbeiten.
[Turn 3] Agent: "Verstanden, du nimmst also das Ticket an und startest die Diagnose. Welcher Schritt folgt genau, nachdem du das Ticket in Jira angenommen hast?"

[Turn 4] Persona: Problem diagnostizieren. Entweder Remote Desktop oder vor Ort. Danach Wiki-Check oder eigene Recherche. Dann Behebung und Dokumentation im Ticket.
[Turn 4] Agent: "Wenn du ein Ticket annimmst: Welche Informationen aus dem Ticket sind für dich am wichtigsten, um mit der Diagnose zu starten?"

[Turn 5] Persona: Fehlermeldung. Gerätetyp. Symptome. Kommt drauf an.
[Turn 5] Agent: "Wenn diese Informationen im Ticket unvollständig sind, wie gehst du dann vor?"

[Turn 6] Persona: Nutzer kontaktieren. Nachhaken. Manchmal vor Ort klären. Kommt drauf an.
[Turn 6] Agent: "Wie viele dieser Tickets bearbeitest du ungefähr im Monat?"

[Turn 7] Persona: Etwa 300 bis 400 Tickets. Kommt drauf an.
[Turn 7] Agent: "Das ist eine beachtliche Menge. Du hast „300 bis 400“ gesagt — welcher Wert trifft es besser für einen typischen Monat?"

[Turn 8] Persona: 15 bis 20 Tickets pro Tag. Rechne selbst. Kommt drauf an.
[Turn 8] Agent: "Wenn wir von einem typischen Monat ausgehen: Welcher Wert liegt näher an der Realität – eher 300 oder eher 400 Tickets?"

[Turn 9] Persona: Kommt drauf an. Bleibt bei 15 bis 20 täglich. Schwankt je nach Monat.
[Turn 9] Agent: "Du hast „15 bis 20“ gesagt — welcher Wert trifft es besser für einen typischen Tag?"

[Turn 10] Persona: Kommt drauf an. Bleibt bei 15 bis 20. Schwankt.
[Turn 10] Agent: "Alles klar, wir halten das als Richtwert fest. Wie viele Minuten verbringst du im Durchschnitt mit der Bearbeitung eines einzelnen Tickets, von der Annahme bis zur Dokumentation?"

[Turn 11] Persona: Kommt drauf an. Hängt vom Problem ab. Meistens Wechsel zwischen Jira, Remote Desktop und Wiki.
[Turn 11] Agent: "Wenn du an ein ganz normales, durchschnittliches Ticket denkst: Wie viele Minuten brauchst du dafür ungefähr?"

[Turn 12] Persona: Kommt drauf an. Hängt vom Problem ab. Zwischen Jira, Remote Desktop und Wiki 3x Wechsel nötig.
[Turn 12] Agent: ""

[Turn 13] Persona: Kommt drauf an. Hängt vom Problem ab. Zwischen Jira, Remote Desktop und Wiki 3x Wechsel.
[Turn 13] Agent: "Welche Zeitspanne in Minuten beschreibt die Bearbeitung eines typischen Tickets am besten?"

[Turn 14] Persona: Kommt drauf an. Hängt vom Problem ab. Keine feste Zeit.
[Turn 14] Agent: "Verstehe, die Zeit variiert stark je nach Fall. Folgt die Lösung der Tickets meistens festen, vorgegebenen Schritten, oder musst du fast immer individuell entscheiden?"

[Turn 15] Persona: Wiki-Lösungsbuch oft hilfreich. Manchmal weichen Probleme ab. Eigene Recherche nötig. Kommt drauf an.
[Turn 15] Agent: "Wie oft kommt es vor, dass ein gelöstes Ticket noch einmal geöffnet werden muss oder die Lösung beim ersten Mal nicht funktioniert?"

[Turn 16] Persona: Kommt drauf an. Passiert. Manchmal weichen Probleme vom Lösungsbuch ab. Eigene Recherche nötig.
[Turn 16] Agent: "Wenn du schätzen müsstest: Bei wie vielen von 100 Tickets funktioniert die Lösung beim ersten Mal nicht oder das Ticket muss wieder geöffnet werden?"

[Turn 17] Persona: Kommt drauf an. Keine feste Zahl. Manchmal weichen Probleme vom Wiki ab. Eigene Recherche nötig.
[Turn 17] Agent: "Passiert das eher selten, zum Beispiel bei weniger als 5 von 100 Tickets, oder kommt das häufiger vor?"

[Turn 18] Persona: Kommt drauf an. Keine feste Zahl. Manchmal weichen Probleme vom Lösungsbuch ab. Eigene Recherche nötig.
[Turn 18] Agent: "Du hast am Anfang auch den Hardware-Tausch erwähnt. Wie läuft dieser Prozess ab, sobald feststeht, dass ein Gerät getauscht werden muss?"

[Turn 19] Persona: Defektes Gerät einsammeln. Ersatzgerät aus Lager holen, konfigurieren via Imaging-Tool, Daten übertragen. Nutzer einweisen. Fertig.
[Turn 19] Agent: "Welches Imaging-Tool nutzt du für die Konfiguration und läuft dieser Schritt immer reibungslos ab?"

[Turn 20] Persona: Imaging-Tool. Lagerverwaltung ungenau. Teile oft nicht auffindbar. Kommt drauf an.
[Turn 20] Agent: "Das mit der ungenauen Lagerverwaltung klingt nach einem echten Hindernis. Wie oft im Monat führst du so einen Hardware-Tausch ungefähr durch?"

[Turn 21] Persona: 3 bis 5 Hardware-Tausch-Vorgänge pro Woche. Kannst du hochrechnen. Kommt drauf an.
[Turn 21] Agent: "Du hast „3 bis 5“ Hardware-Tausche pro Woche gesagt — welcher Wert trifft es für eine typische Woche am besten?"

[Turn 22] Persona: Kommt drauf an. Bleibt bei 3 bis 5 pro Woche. Schwankt je nach Ausfällen.
[Turn 22] Agent: "Wenn wir im Schnitt von 4 Vorgängen pro Woche ausgehen, wären das etwa 16 im Monat. Passt diese Zahl für einen typischen Monat?"

[Turn 23] Persona: Kommt drauf an. Bleibt bei 3 bis 5 pro Woche. Schwankt je nach Ausfällen.
[Turn 23] Agent: "Wie lange dauert so ein Hardware-Tausch im Durchschnitt von Anfang bis Ende, also vom Einsammeln des defekten Geräts bis zur Einweisung des Nutzers?"

[Turn 24] Persona: Kommt drauf an. Hängt vom Gerät und Datenaufwand ab. Keine feste Zeit.
[Turn 24] Agent: "Wenn alles normal läuft: Liegt die Dauer für einen Hardware-Tausch eher bei einer Stunde oder eher bei drei Stunden?"

[Turn 25] Persona: Kommt drauf an. Hängt vom Gerät und Datenaufwand ab. Keine feste Zeit.
[Turn 25] Agent: "Wenn du an ein Standard-Notebook denkst: Dauert der gesamte Tausch inklusive Konfiguration und Datenübertragung im Schnitt eher 2 Stunden oder eher 4 Stunden?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Ticket-Bearbeitung | walkthrough | 350 ✓ | null | false ✓ | Jira,Remote Desktop,Wiki ✓ | null | 3 ✓ |
| Hardware-Tausch | walkthrough | 16 ✓ | null | null | null | null | null |
