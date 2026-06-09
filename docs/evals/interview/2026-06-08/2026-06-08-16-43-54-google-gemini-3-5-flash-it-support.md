---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-08
persona: it-support
interview_id: 793a9887-eabb-4f35-ac2c-a09f8d2d9ed3
eval_run_id: 940640c1-167a-4081-8361-aae27e54bbba
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/793a9887-eabb-4f35-ac2c-a09f8d2d9ed3
turns_total: 20
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.75
  dedup_slot_coverage: 0.75
  slot_coverage_pre_clarification: 0.75
  dedup_slot_coverage_pre_clarification: 0.75
  clarification_coverage_delta: 0
  phase_progression: 0.6
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.77
  dialog_naturalness: 0.72
  completion_correctness: true
  step_registration_coverage: 1
trail:
  total_writes: 6
  blocked_writes: 0
  blocked_rate: 0
  overwrite_churn: 0.17
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.75 | maximize |
| dedup_slot_coverage | 0.75 | maximize |
| slot_coverage_pre_clarification | 0.75 | maximize |
| dedup_slot_coverage_pre_clarification | 0.75 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 0.6 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.77 | ≥ 0.80 |
| dialog_naturalness | 0.72 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| blocked_rate | 0 | < 0.10 |
| overwrite_churn | 0.17 | < 0.20 |

## Gesprächsverlauf

[Turn 1] Persona: Ticket-Bearbeitung und Hardware-Tausch. Jira abarbeiten, Remote Desktop, Wiki-Recherche, Imaging von Geräten. Viel Springerei zwischen den Systemen.
[Turn 1] Agent: "Hallo Michael. Wir wollen heute dein praktisches Prozesswissen strukturiert dokumentieren, um eure täglichen Abläufe im IT-Support besser zu verstehen. Das Ganze wird natürlich vertraulich behandelt. 

Erzähl mir bitte zum Einstieg: Was sind deine Hauptaufgaben im IT-Support und wie sieht ein typischer Arbeitstag bei dir aus?"

[Turn 2] Persona: Täglich 15–20 Tickets über Jira bearbeiten. Hardware-Tausch bei Bedarf. Ständiger Wechsel zwischen Jira, Remote Desktop und Wiki.
[Turn 2] Agent: "Welcher konkrete Schritt steht am Anfang, wenn du morgens Jira öffnest und mit der Bearbeitung der 15–20 Tickets beginnst?"

[Turn 3] Persona: Ticket annehmen. Problem diagnostizieren, meist per Remote Desktop. Danach Lösungsbuch checken.
[Turn 3] Agent: "Verstanden, wir starten mit dem Schritt der Ticketannahme und der ersten Diagnose.

Wie lange dauert dieser erste Schritt der Annahme und Diagnose im Durchschnitt pro Ticket?"

[Turn 4] Persona: Kommt drauf an. Meistens schnell. Hängt stark vom Problem ab.
[Turn 4] Agent: "Notieren wir das als variabel.

Wer ist außer dir noch an diesem ersten Schritt der Annahme und Diagnose beteiligt?"

[Turn 5] Persona: Nur ich. Niemand sonst.
[Turn 5] Agent: "Welches System oder Tool nutzt du nach der Diagnose, um im Lösungsbuch nachzuschlagen?"

[Turn 6] Persona: Nutze dafür unser internes Wiki. Manchmal reicht das nicht, dann recherchiere ich selbst.
[Turn 6] Agent: "Folgt die Suche im Wiki und die anschließende Lösung immer einem festen Schema, oder entscheidest du das von Fall zu Fall?"

[Turn 7] Persona: Kommt drauf an. Entweder Wiki-Lösung nutzen oder eigene Recherche. Je nachdem, wie weit das Problem vom Standard abweicht.
[Turn 7] Agent: "Wie viel Zeit nimmt die gesamte Bearbeitung eines Tickets – von der Annahme über die Recherche bis zur Lösung – im Durchschnitt in Anspruch?"

[Turn 8] Persona: Kommt drauf an. Lässt sich schwer pauschal sagen.
[Turn 8] Agent: "Lassen wir das so stehen.

Folgt der gesamte Prozess der Ticket-Bearbeitung bei dir im IT-Support immer einem festen Schema, oder entscheidest du das von Fall zu Fall?"

[Turn 9] Persona: Meistens festes Schema. Wenn Wiki nicht hilft, dann eigene Recherche. Je nach Einzelfall.
[Turn 9] Agent: "Du hast am Anfang auch den Hardware-Tausch erwähnt. Wie läuft dieser Prozess ab, sobald ein solcher Bedarf festgestellt wird?"

[Turn 10] Persona: Gerät einsammeln, Ersatz aus dem Lager holen. Konfiguration per Imaging-Tool, danach Daten übertragen. Abschließend Nutzer einweisen.
[Turn 10] Agent: "Wie viel Zeit nimmt dieser gesamte Hardware-Tausch – vom Einsammeln des Geräts bis zur Einweisung des Nutzers – im Durchschnitt in Anspruch?"

[Turn 11] Persona: Kommt drauf an. Kann ich so nicht genau sagen.
[Turn 11] Agent: "Halten wir das offen.

Wie oft kommt es beim Hardware-Tausch oder der Ticket-Bearbeitung zu Fehlern oder Problemen, die dich aufhalten?"

[Turn 12] Persona: Passiert regelmäßig. Lagerbestand im System stimmt oft nicht mit der Realität überein. Software-Freigaben durch IT-Leitung dauern bis zu 3 Tage. Nervig bei Dringlichkeit.
[Turn 12] Agent: "Wie viel Prozent der Hardware-Tausche sind schätzungsweise von diesen Fehlern beim Lagerbestand betroffen?"

[Turn 13] Persona: Kommt drauf an. Kann ich keine genaue Prozentzahl nennen.
[Turn 13] Agent: "Ich nehme das so auf.

Gibt es beim Hardware-Tausch Schritte, bei denen du Daten manuell von einem System in ein anderes übertragen musst oder Medienbrüche entstehen – zum Beispiel, weil du Informationen auf Papier notierst?"

[Turn 14] Persona: Datenübertragung findet statt. Papier wird selten genutzt. Alles meist digital.
[Turn 14] Agent: "Wie gehst du vor, wenn du die Daten beim Hardware-Tausch überträgst, und welche Systeme nutzt du dabei?"

[Turn 15] Persona: Daten übertragen von alt auf neu. Nutze dafür Imaging-Tool und Assetsystem. Direkte Übertragung auf die neue Hardware.
[Turn 15] Agent: "Gibt es neben der Ticket-Bearbeitung und dem Hardware-Tausch noch andere Aufgaben oder Prozesse im IT-Support, die wir bisher noch nicht besprochen haben?"

[Turn 16] Persona: Nein, keine weiteren Prozesse. Nur Ticket-Bearbeitung und Hardware-Tausch. Mehr mache ich nicht.
[Turn 16] Agent: "Wie viel deiner wöchentlichen Arbeitszeit verbringst du insgesamt mit diesen beiden Aufgaben, also der Ticket-Bearbeitung und dem Hardware-Tausch?"

[Turn 17] Persona: Schwer zu sagen. Hängt vom täglichen Ticket-Aufkommen ab. Meistens fülle ich damit die komplette Arbeitszeit.
[Turn 17] Agent: "Verstanden — weiter im Ablauf.

Wie hoch schätzt du den prozentualen Anteil der Tickets oder Hardware-Tausche ein, bei denen Fehler oder Probleme auftreten, die dich im Arbeitsfluss aufhalten?"

[Turn 18] Persona: Kommt drauf an. Keine genauen Prozentwerte möglich. Schwankt je nach Einzelfall.
[Turn 18] Agent: "Ok, das passt so.

Wir haben nun alle wesentlichen Schritte und Herausforderungen deiner Arbeit erfasst. Vielen Dank für deine Zeit und die detaillierten Einblicke, Michael. Das hilft uns sehr weiter."

[Turn 19] Persona: Gerne. Kein Problem. Schön, wenn das weiterhilft.
[Turn 19] Agent: "Schönen Tag dir noch und danke für deine Unterstützung!"

[Turn 20] Persona: Ebenfalls. Danke. Tschüss.
[Turn 20] Agent: "Tschüss, Michael! Hab noch einen schönen Tag."

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| it-support | walkthrough | 350 ✓ | null | true ✓ | internes Wiki ✓ | null | 0 ✓ |
