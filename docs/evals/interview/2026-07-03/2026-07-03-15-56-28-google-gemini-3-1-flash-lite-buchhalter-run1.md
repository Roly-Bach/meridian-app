---
interview_model: google/gemini-3.1-flash-lite
tester_model: anthropic/claude-sonnet-4-5
talker_model: google/gemini-3.1-flash-lite
talker_thinking_budget: 512
analyst_model: google/gemini-3.1-flash-lite
analyst_thinking_budget: 2048
eval_date: 2026-07-03
persona: buchhalter
interview_id: 3a3f95f0-0768-439d-b2c6-5538d7a47e01
eval_run_id: d77b393b-d3c9-479d-b32f-795d1db3ead2
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/3a3f95f0-0768-439d-b2c6-5538d7a47e01
run_index: 1
run_seed: 42
perturbation_seed: 42
turns_total: 24
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.89
  dedup_slot_coverage: 0.89
  slot_coverage_pre_clarification: 0.89
  dedup_slot_coverage_pre_clarification: 0.89
  clarification_coverage_delta: 0
  potenzial_coverage: 0.92
  dedup_potenzial_coverage: 0.92
  dependency_capture: 0
  slots_per_turn: 1.21
  turns_to_completion: 24
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  anchoring_violation_rate: 0
  tool_call_plausibility: 0.74
  dialog_naturalness: 0.67
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: n/a (keine unknown-Slots)
  talker_grounding_violations: 1
  depth_score: 1.93
  depth_p1: 0.29
  depth_p2: 0.5
  depth_p3: 0.21
trail:
  total_writes: 78
  blocked_writes: 3
  blocked_rate: 0.04
  overwrite_churn: 0.36
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.89 | maximize |
| dedup_slot_coverage | 0.89 | maximize |
| slot_coverage_pre_clarification | 0.89 | maximize |
| dedup_slot_coverage_pre_clarification | 0.89 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| potenzial_coverage | 0.92 | maximize (KI-Potenzial: ROI-Facetten) |
| dedup_potenzial_coverage | 0.92 | maximize (gate-Kandidat) |
| dependency_capture | 0 | maximize (KI-Potenzial: O6) |
| slots_per_turn | 1.21 | maximize (Effizienz) |
| turns_to_completion | 24 | — (Diagnose) |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| anchoring_violation_rate | 0 | maximize (niedriger besser) |
| tool_call_plausibility | 0.74 | ≥ 0.70 |
| dialog_naturalness | 0.67 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | n/a (keine unknown-Slots) | > 0.80 |
| talker_grounding_violations | 1 | 0 |
| depth_score | 1.93 | maximize |
| depth_p1 | 0.29 | — |
| depth_p2 | 0.5 | — |
| depth_p3 | 0.21 | — |
| blocked_rate | 0.04 | < 0.10 |
| overwrite_churn | 0.36 | < 0.20 |


## Judge-Begründung

Die Fragen sind überwiegend natürlich und spezifisch formuliert, zeigen gute Gesprächsstruktur und konsequente Du-Form. Sie vermeiden generische Floskeln und bauen aufeinander auf. Kleine Schwäche: Frage [4] ist etwas lang und komplex strukturiert, könnte prägnanter sein. Insgesamt angemessen für ein professionelles Interview.


## Talker-Faktentreue-Verletzungen (KI-9)

Turn 20: "Du hast bereits erwähnt, dass du bei der Rechnungsprüfung E-Mail, SAP FI und DocuWare nutzt und dabei Daten manuell überträgst." — Der Mitarbeiter hat in Turn 6 gesagt, dass er beim Monatsabschluss (nicht bei der Rechnungsprüfung) in Excel-Listen dokumentiert. Bei der Rechnungsprüfung (Turn 7) erwähnt er E-Mail, SAP FI und DocuWare, aber nicht, dass er dort Daten manuell überträgt – er sagt nur, dass er die Rechnungsdaten manuell in SAP erfasst und die PDF manuell in DocuWare speichert. Die Formulierung 'Daten manuell überträgst' bezieht sich auf den Monatsabschluss, nicht auf die Rechnungsprüfung.

## Gesprächsverlauf

[Turn 1] Persona: Guten Tag. Mein Arbeitstag ist im Wesentlichen durch zwei große Bereiche geprägt: die laufende Rechnungsprüfung und die monatlichen Abschlussarbeiten. Die Rechnungsprüfung nimmt den Großteil meiner Zeit ein – ich prüfe Eingangsrechnungen, erfasse sie in SAP FI und archiviere sie in DocuWare. Zum Monatsende kommt dann der Abschluss dazu, bei dem ich offene Posten abgleiche, Rückstellungen verbuche und die Zahlen ans Controlling übergebe.
[Turn 1] Agent: "Wie sieht der erste konkrete Arbeitsschritt aus, sobald eine Rechnung bei dir eingeht?"

[Turn 2] Persona: Sobald die Rechnung per E-Mail eingeht, öffne ich sie und prüfe zunächst die formalen Angaben – also Lieferant, Rechnungsbetrag und den Leistungszeitraum. Dann schaue ich, ob ein Bestellbezug vorliegt, denn das erleichtert die weitere Zuordnung erheblich. Falls alles vollständig ist, gehe ich zur Erfassung in SAP FI über.
[Turn 2] Agent: "Wie häufig kommt es vor, dass Rechnungen aufgrund fehlender Angaben oder Unstimmigkeiten nicht direkt erfasst werden können und eine Klärung erfordern?"

[Turn 3] Persona: Solche Unstimmigkeiten treten bei etwa fünf Prozent der Rechnungen auf. Meist handelt es sich dabei um fehlende Kostenstellen, fehlerhafte Umsatzsteuersätze oder Differenzen beim Rechnungsbetrag. In diesen Fällen muss ich die Rechnung zurückstellen und mit dem jeweiligen Lieferanten oder intern mit dem Auftraggeber Rücksprache halten, bevor ich sie erfassen kann.
[Turn 3] Agent: "Bei diesen Klärungsfällen – welche Unterlagen oder Informationen verlassen am Ende den Prozessschritt der Rechnungsprüfung, sobald die Erfassung abgeschlossen ist?"

[Turn 4] Persona: Nachdem die Klärung erfolgt ist und die Rechnung in SAP FI erfasst wurde, wird der Beleg in DocuWare archiviert – das ist die digitale Ablage für alle Rechnungsunterlagen. Die Buchungsinformationen selbst bleiben natürlich im SAP-System und fließen später in die monatlichen Auswertungen und den Abschluss ein. Bei Rechnungen über 5.000 EUR geht zusätzlich eine Genehmigungsanfrage an die zuständige Führungskraft, bevor die endgültige Freigabe erfolgt.
[Turn 4] Agent: "Wie viel Zeit investierst du pro Monat insgesamt in die Abschlussarbeiten, vom Abgleich der offenen Posten bis zur Übergabe an das Controlling?"

[Turn 5] Persona: Die Abschlussarbeiten nehmen insgesamt zwei bis drei Tage in Anspruch – das ist jedes Mal zum Monatsende ein intensiver Block. In dieser Zeit arbeite ich den Abgleich der offenen Posten ab, verbuche die Rückstellungen und bereite die Daten für das Controlling auf. Der Zeitdruck ist dabei nicht zu unterschätzen, weil alle Zahlen fristgerecht vorliegen müssen.
[Turn 5] Agent: "Arbeitest du bei den Abschlussarbeiten rein in SAP, oder gibt es dabei Medienbrüche, bei denen du Daten manuell zwischen Systemen übertragen musst? Wie hoch ist bei diesem Abschluss-Block die Fehlerquote in Prozent?"

[Turn 6] Persona: Beim Monatsabschluss arbeite ich hauptsächlich in SAP FI, aber Sonderfälle und Ausnahmen dokumentiere ich parallel in Excel-Listen – das ist definitiv ein Medienbruch, der zusätzlichen Aufwand bedeutet. Eine konkrete Fehlerquote in Prozent kann ich Ihnen allerdings nicht nennen, weil wir das nicht systematisch erfassen. Allerdings kommt es gelegentlich vor, dass bei der manuellen Übertragung oder Dokumentation kleinere Unstimmigkeiten auftreten, die dann nachträglich korrigiert werden müssen.
[Turn 6] Agent: "Du hast bei der Rechnungsprüfung E-Mail, SAP FI und DocuWare als Stationen genannt – gibt es in diesem Ablauf Medienbrüche, etwa durch manuelle Datenübertragungen, oder ist der Prozess durchgängig digital?"

[Turn 7] Persona: Der Prozess ist weitgehend digital, aber nicht vollständig durchgängig – die Rechnungsdaten aus der E-Mail erfasse ich manuell in SAP FI, das heißt ich tippe Lieferant, Betrag, Kostenstelle und so weiter von Hand ein. Anschließend speichere ich die PDF-Rechnung manuell in DocuWare ab und ordne sie dort der entsprechenden Buchung zu. Bei Rechnungen ohne Bestellbezug kommt noch hinzu, dass ich den Auftraggeber in drei verschiedenen Systemen suchen muss, was zusätzlichen Aufwand bedeutet.
[Turn 7] Agent: "Wie viele Eingangsrechnungen bearbeitest du ungefähr in einem typischen Monat?"

[Turn 8] Persona: Pro Monat bearbeite ich etwa 80 bis 100 Eingangsrechnungen – das schwankt natürlich etwas je nach Geschäftsaktivität. Die Masse davon läuft routinemäßig durch, aber wie bereits erwähnt gibt es bei rund fünf Prozent Klärungsbedarf, der dann zusätzliche Zeit beansprucht.
[Turn 8] Agent: "Die manuelle Erfassung bei 80 bis 100 Rechnungen stellt einen erheblichen Aufwand dar.

Hängt der Start der Rechnungsprüfung von bestimmten Voraussetzungen ab, etwa davon, dass Lieferantendaten bereits im System aktuell sind oder andere Abteilungen Vorarbeiten leisten müssen?"

[Turn 9] Persona: Grundsätzlich setze ich voraus, dass der Lieferant bereits in SAP FI angelegt ist – ohne gültigen Lieferantenstammsatz kann ich die Rechnung nicht buchen. Falls ein neuer Lieferant auftaucht, muss ich zunächst eine Stammdatenanlage über die Kreditorenbuchhaltung anstoßen, was den Prozess verzögert. Bei Rechnungen mit Bestellbezug hilft mir das System natürlich, weil die Bestellung bereits Kostenstelle und Budget vorgibt – ohne diesen Bezug bin ich auf Rückfragen oder die manuelle Suche in den verschiedenen Systemen angewiesen.
[Turn 9] Agent: "Gibt es beim Monatsabschluss eine formale Freigabeinstanz, die deine Aufstellungen prüft, bevor sie an das Controlling gehen?"

[Turn 10] Persona: Beim Monatsabschluss prüft meine Abteilungsleitung die Aufstellungen in einem Vier-Augen-Prinzip, bevor die Zahlen offiziell an das Controlling übergeben werden. Sie kontrolliert vor allem die Vollständigkeit der Rückstellungen und die Plausibilität der offenen Posten. Erst nach ihrer Freigabe kann ich die finale Übermittlung anstoßen.
[Turn 10] Agent: "Läuft die Rechnungsprüfung bei allen Rechnungsarten nach dem gleichen festen Schema ab, oder unterscheidet sich der Ablauf stark, wenn es sich um unterschiedliche Arten von Rechnungen handelt?"

[Turn 11] Persona: Der grundlegende Ablauf ist bei allen Rechnungen gleich – Prüfung, Erfassung in SAP FI, Archivierung in DocuWare. Allerdings gibt es zwei wesentliche Unterschiede: Rechnungen mit Bestellbezug lassen sich deutlich schneller verarbeiten, weil Kostenstelle und Budget bereits hinterlegt sind, während ich bei Rechnungen ohne Bestellbezug den Auftraggeber in drei verschiedenen Systemen suchen muss. Außerdem lösen Rechnungen über 5.000 EUR einen zusätzlichen Genehmigungsschritt aus, der bei kleineren Beträgen entfällt.
[Turn 11] Agent: "Du hast die manuelle Dateneingabe und die Suche in verschiedenen Systemen als Medienbrüche beschrieben. Gibt es darüber hinaus noch andere Abhängigkeiten, die den Prozess der Rechnungsprüfung blockieren oder verzögern könnten?"

[Turn 12] Persona: Ja, es gibt noch weitere Verzögerungsquellen: Wenn die Kostenstelle auf der Rechnung fehlt oder falsch angegeben ist, muss ich intern beim Auftraggeber nachfragen, und je nach Erreichbarkeit kann das mehrere Tage dauern. Außerdem kommt es vor, dass bei größeren Rechnungen die zuständige Führungskraft im Urlaub oder auf Dienstreise ist – dann muss ich auf deren Vertretung ausweichen, was den Genehmigungsprozess verlängert. Auch fehlende oder unvollständige Lieferscheine bei warenbezogenen Rechnungen führen dazu, dass ich die Buchung zurückstellen muss, bis die Wareneingangsbuchung im System vorliegt.
[Turn 12] Agent: "Diese Abhängigkeiten von Stammdaten, Bestellbezügen und Lieferscheinen sind klar. Wie viel Prozent deiner Arbeitszeit in der Rechnungsprüfung entfallen schätzungsweise auf die manuelle Dateneingabe und die systemübergreifende Suche bei Rechnungen ohne Bestellbezug?"

[Turn 13] Persona: Die manuelle Dateneingabe macht sicherlich den größten Teil meiner Arbeit in der Rechnungsprüfung aus – ich würde sagen, gut die Hälfte meiner Zeit geht dafür drauf. Die systemübergreifende Suche bei Rechnungen ohne Bestellbezug kostet mich wöchentlich etwa eine Stunde, auf den Monat hochgerechnet sind das dann rund vier Stunden zusätzlicher Aufwand. Das summiert sich über die 80 bis 100 Rechnungen natürlich erheblich.
[Turn 13] Agent: "Wie oft musst du im Monat Lieferantenstammdaten neu anlegen lassen, und wie viel Zeit beansprucht dieser zusätzliche Prozessschritt im Durchschnitt?"

[Turn 14] Persona: Neue Lieferanten tauchen etwa drei- bis viermal pro Monat auf, was glücklicherweise nicht allzu häufig ist. Die Stammdatenanlage selbst läuft über die Kreditorenbuchhaltung – ich fülle dafür ein Formular aus und reiche es per E-Mail ein, das dauert vielleicht zehn Minuten. Bis der Lieferant dann aber tatsächlich im System angelegt ist und ich die Rechnung buchen kann, vergehen meist ein bis zwei Arbeitstage, was den gesamten Rechnungsdurchlauf entsprechend verzögert.
[Turn 14] Agent: "Das kommt etwa drei- bis viermal im Monat vor.

Gibt es neben den bereits besprochenen manuellen Eingaben und den Abstimmungen mit der Kreditorenbuchhaltung noch einen weiteren Aspekt, der für das Verständnis deiner Arbeitsprozesse wichtig ist, den wir bisher nicht angesprochen haben?"

[Turn 15] Persona: Ja, ein wichtiger Punkt fehlt noch: Wir haben einen monatlichen Mahnlauf für überfällige Forderungen, der ebenfalls zu meinen Aufgaben gehört. Dabei prüfe ich die offenen Posten in SAP FI, gleiche sie mit Zahlungseingängen ab und erstelle die Mahnungen – das ist zeitintensiv und erfordert eine sorgfältige Einzelfallprüfung, weil ich Kulanzfälle oder Zahlungsvereinbarungen berücksichtigen muss. Dieser Prozess läuft parallel zur laufenden Rechnungsprüfung und bindet zusätzliche Kapazitäten.
[Turn 15] Agent: "Wie viel Zeit beansprucht der Mahnlauf monatlich, und wie viele Mahnungen bearbeitest du dabei im Durchschnitt?"

[Turn 16] Persona: Der Mahnlauf nimmt monatlich etwa einen halben bis ganzen Arbeitstag in Anspruch, je nachdem wie viele Fälle zu klären sind. Die Anzahl der Mahnungen schwankt stark – in einem ruhigen Monat sind es vielleicht 15 bis 20, in Spitzenzeiten können es auch 30 bis 40 werden. Besonders aufwendig sind dabei die Fälle, bei denen ich vorher telefonisch oder per E-Mail klären muss, ob eine Zahlung bereits unterwegs ist oder eine Ratenzahlungsvereinbarung getroffen wurde.
[Turn 16] Agent: "Du hast vorhin von einem Zeitaufwand von einem halben bis ganzen Arbeitstag gesprochen – wie hoch schätzt du die Fehlerquote bei der Erstellung der Mahnungen ein, wenn du diese Einzelfallprüfungen berücksichtigst?"

[Turn 17] Persona: Eine konkrete Fehlerquote in Prozent kann ich auch hier nicht beziffern, da wir das nicht systematisch messen. Allerdings passiert es gelegentlich, dass trotz sorgfältiger Prüfung eine Mahnung rausgeht, obwohl die Zahlung bereits unterwegs war oder eine Kulanzregelung greift – solche Fälle führen dann zu Rückfragen vom Kunden und müssen manuell korrigiert werden. Die Einzelfallprüfung reduziert solche Vorfälle zwar erheblich, ganz vermeiden lassen sie sich aber nicht.
[Turn 17] Agent: "Erfolgt die Prüfung der Einzelfälle wie Kulanz oder Ratenzahlungen bei diesem Mahnlauf vollständig manuell, oder gibt es hierfür Unterstützung durch das SAP-System?"

[Turn 18] Persona: Die Prüfung läuft im Wesentlichen manuell ab – SAP FI zeigt mir zwar die überfälligen Posten an, aber Informationen zu Kulanzregelungen oder Ratenzahlungsvereinbarungen muss ich selbst aus E-Mails, Telefonnotizen oder Excel-Listen zusammensuchen. Das System bietet keine zentrale Übersicht über solche Sondervereinbarungen, weshalb ich jedes Mal einzeln prüfen muss, ob für einen Kunden besondere Regelungen dokumentiert sind.
[Turn 18] Agent: "Wie sieht bei diesem Mahnlauf der Informationsfluss aus — welche Daten oder Dokumente erhältst du als Input, und was ist das konkrete Ergebnis, das den Prozessschritt abschließt?"

[Turn 19] Persona: Als Input ziehe ich mir aus SAP FI die Liste der offenen Forderungen, die das Fälligkeitsdatum überschritten haben – das System generiert mir eine Aufstellung mit Kundennummer, Rechnungsbetrag und Verzugstagen. Dann gleiche ich diese Liste manuell mit Zahlungseingängen, E-Mail-Korrespondenz und meinen Excel-Notizen zu Sondervereinbarungen ab, bevor ich die Mahnschreiben erstelle. Das Ergebnis sind die fertigen Mahnungen, die per Post oder E-Mail an die Kunden verschickt werden, sowie eine aktualisierte Dokumentation der Mahnhistorie im System.
[Turn 19] Agent: "Du hast bereits erwähnt, dass du bei der Rechnungsprüfung E-Mail, SAP FI und DocuWare nutzt und dabei Daten manuell überträgst. Gibt es über diese manuellen Schritte hinaus noch weitere Medienbrüche, die den Prozess der Rechnungsprüfung beeinflussen?"

[Turn 20] Persona: Neben den bereits genannten Systemen kommt es vor, dass ich bei fehlenden Informationen auch in unserem Warenwirtschaftssystem nachschauen muss, um Lieferungen oder Bestelldetails zu verifizieren – das ist ein weiteres System, das nicht mit SAP FI verknüpft ist. Außerdem dokumentiere ich Klärungsfälle und Rückfragen teilweise in separaten Excel-Listen, weil SAP keine Kommentarfunktion für solche Zwischenstände bietet. Diese zusätzlichen Medienbrüche erhöhen den manuellen Aufwand und das Risiko, dass Informationen verloren gehen oder inkonsistent werden.
[Turn 20] Agent: "Gibt es im Rahmen des Forderungsmanagements neben dem Mahnlauf noch andere Tätigkeiten, oder ist dieser Bereich damit vollständig abgedeckt? Und gibt es bei diesem Prozessschritt eine formale Freigabe durch Vorgesetzte, ähnlich wie beim Monatsabschluss?"

[Turn 21] Persona: Neben dem Mahnlauf führe ich auch regelmäßig Bonitätsprüfungen bei Neukunden durch und pflege die Zahlungskonditionen im System – das gehört ebenfalls zum Forderungsmanagement. Eine formale Freigabe der Mahnungen durch meine Abteilungsleitung gibt es nicht; ich entscheide eigenverantwortlich über den Versand, solange es sich um Standardfälle handelt. Nur bei größeren Forderungen oder wenn rechtliche Schritte wie ein Inkassoverfahren anstehen, hole ich vorher eine Rücksprache ein.
[Turn 21] Agent: "Eher unter 5 Prozent oder eher über 5 Prozent an korrekturpflichtigen Mahnungen?"

[Turn 22] Persona: Ich würde sagen, eher unter 5 Prozent – die meisten Mahnungen gehen korrekt raus, weil ich ja gerade durch die manuelle Einzelfallprüfung versuche, solche Fehler zu vermeiden. Wenn es zu Korrekturen kommt, dann meist bei Fällen, wo Zahlungen zeitlich knapp vor dem Mahnlauf eingegangen sind oder wo mündliche Absprachen nicht ordentlich dokumentiert wurden.
[Turn 22] Agent: "Wie sieht es bei der Bonitätsprüfung und der Pflege der Zahlungskonditionen aus – gibt es dort ebenfalls Medienbrüche oder Abhängigkeiten von anderen Abteilungen, die den Prozess verlangsamen?"

[Turn 23] Persona: Bei der Bonitätsprüfung greife ich auf externe Auskunfteien wie Creditreform zurück – die Daten muss ich manuell abrufen und dann in einer separaten Excel-Liste festhalten, weil SAP FI keine direkte Schnittstelle dazu bietet. Die Pflege der Zahlungskonditionen erfordert oft Rücksprache mit dem Vertrieb, weil die mir mitteilen müssen, welche Sonderkonditionen mit dem Kunden vereinbart wurden – je nach Erreichbarkeit der Kollegen kann das den Prozess um mehrere Tage verzögern.
[Turn 23] Agent: "Gibt es bei der Abstimmung mit dem Vertrieb oder der Arbeit mit Creditreform weitere Abhängigkeiten oder Medienbrüche, die wir bisher noch nicht betrachtet haben?"

[Turn 24] Persona: Nein, bei der Bonitätsprüfung und der Abstimmung mit dem Vertrieb habe ich die wesentlichen Punkte bereits genannt – die manuelle Datenabfrage bei Creditreform und die Excel-Dokumentation sowie die Wartezeit auf Rückmeldungen aus dem Vertrieb sind die Haupthemmnisse. Darüber hinaus gibt es in diesem Teilbereich keine zusätzlichen systemischen Brüche oder Abhängigkeiten, die den Ablauf weiter verkomplizieren würden.
[Turn 24] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| Monatsabschluss | done | 1 ✓ | 1200 ✓ | Vier-Augen-Prinzip d ✓ | SAP-System ✓ | null ✓ | 1 ✓ |
| Rechnungsprüfung | done | 100 ✓ | 240 ✓ | Rechnungen mit Beste ✓ | Excel-Listen ✓ | 5 ✓ | 2 ✓ |
| Forderungsmanagement | walkthrough | 40 ✓ | 240 ✓ | Überprüfung vereinba ✓ | SAP FI,Excel-Liste ✓ | 4 ✓ | null |

## Token-Kosten

### Interview-Engine
| Komponente | Calls | Input | Cache Read | Cache-% | Output | Kosten |
|---|---|---|---|---|---|---|
| talker | 23 | 98.803 | 3.955 | 4% | 17.301 | $0.0498 |
| grounding_guard | 23 | 96.779 | 0 | 0% | 1.589 | $0.1047 |
| analyst_online | 23 | 511.422 | 234.703 | 46% | 2.465 | $0.0787 |
| quick_extract | 22 | 52.508 | 0 | 0% | 1.285 | $0.0151 |
| analyst_catchup | 1 | 6.137 | 3.930 | 64% | 107 | $0.0008 |
| **Zwischensumme** | **92** | **765.649** | **242.588** | **32%** | **22.747** | **$0.2491** |

### Test-Engine
| Komponente | Calls | Input | Cache Read | Cache-% | Output | Kosten |
|---|---|---|---|---|---|---|
| tester | 25 | 104.107 | 0 | 0% | 3.782 | $0.3691 |
| **Zwischensumme** | **25** | **104.107** | **0** | **0%** | **3.782** | **$0.3691** |

### Eval-Engine
| Komponente | Calls | Input | Cache Read | Cache-% | Output | Kosten |
|---|---|---|---|---|---|---|
| judge_dialog_naturalness | 1 | 959 | 0 | 0% | 120 | $0.0016 |
| judge_talker_grounding | 1 | 6.111 | 0 | 0% | 245 | $0.0073 |
| judge_slot_depth | 3 | 8.816 | 0 | 0% | 4.159 | $0.0296 |
| **Zwischensumme** | **5** | **15.886** | **0** | **0%** | **4.524** | **$0.0385** |

### Gesamt: $0.6567 / Run
