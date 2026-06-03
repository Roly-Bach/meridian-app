---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-03
persona: buchhalter
interview_id: 5c8af764-b12f-473a-8ea5-f5728035141e
eval_run_id: fa437ec9-61da-47ee-a8bd-0a2efad9968b
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/5c8af764-b12f-473a-8ea5-f5728035141e
turns_total: 25
status: PASS
baseline_label: null
scores:
  slot_coverage: 0.42
  dedup_slot_coverage: 0.42
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.24
  dialog_naturalness: 0.42
  completion_correctness: true
  step_registration_coverage: 1
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.42 | maximize |
| dedup_slot_coverage | 0.42 | maximize |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.24 | ≥ 0.95 |
| dialog_naturalness | 0.42 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |

## Gesprächsverlauf

[Turn 1] Persona: Sehr gerne unterstütze ich Sie bei der Dokumentation unserer betrieblichen Abläufe, da mir die Prozesssicherheit in der Finanzbuchhaltung sehr am Herzen liegt. Meine Tätigkeit umfasst primär die sorgfältige Prüfung und Verbuchung eingehender Rechnungen sowie die Durchführung der komplexen monatlichen Abschlussarbeiten. Dabei stehen die ständige Abstimmung offener Posten und die Klärung von Unstimmigkeiten bei der Kontierung oder bei betraglichen Differenzen im Zentrum meines täglichen Wirkens.
[Turn 1] Agent: "Hallo Andreas. Schön, dass du dir Zeit nimmst. In diesem Gespräch möchten wir dein implizites Prozesswissen strukturiert dokumentieren, um die Abläufe in deiner Abteilung abzusichern. Alle deine Angaben werden vertraulich behandelt.

Du hast bereits einige deiner Aufgaben erwähnt. Lass uns ganz vorne anfangen: Wie sieht ein typischer Arbeitstag bei dir aus und mit welchem Prozess startest du meistens?"

[Turn 2] Persona: Für die Rechnungsprüfung beginne ich den Tag damit, die neu eingegangenen Belege aus den digitalen Eingangskanälen zu sichten. Ich prüfe dabei jeden Vorgang auf seine Vollständigkeit hinsichtlich des Leistungszeitraums und des Lieferanten, um ihn anschließend korrekt zuzuweisen. Sollte ein Dokument keine eindeutige Bestellreferenz aufweisen oder inhaltliche Diskrepanzen aufweisen, schließt sich eine manuelle Recherche über verschiedene interne Quellen an, bevor ich die Freigabeschritte einleite.
[Turn 2] Agent: "Das ist ein guter Startpunkt. Wie viele digitale Rechnungen sichtest und prüfst du im Durchschnitt an einem typischen Arbeitstag?"

[Turn 3] Persona: Hinsichtlich des monatlichen Volumens bearbeite ich im Regelfall eine Größenordnung von achtzig bis einhundert Rechnungen. Dies bedeutet, dass ich täglich eine entsprechende Verteilung dieser Belege vornehme, wobei sich die Intensität der Prüfung je nach Fehleranfälligkeit der Dokumente stark unterscheiden kann. Bei meiner Arbeit greife ich hierfür regelmäßig auf SAP FI, DocuWare sowie den E-Mail-Client zurück.
[Turn 3] Agent: "Du hast eine Spanne von 80 bis 100 Rechnungen im Monat genannt — welcher Wert trifft es für einen typischen Monat besser?"

[Turn 4] Persona: Da die Anzahl der Eingänge durchaus variieren kann, lässt sich kein präziser Fixwert festlegen, wenngleich ich meist eher am oberen Ende dieser Spanne operiere. Es ist wichtig zu beachten, dass insbesondere die fehlenden Referenzen bei einem Teil der Belege die Arbeitszeit signifikant erhöhen. Dieser Aufwand für die manuelle Suche ist ein konstanter Faktor, den ich bei der Planung meines täglichen Pensums stets berücksichtige.
[Turn 4] Agent: "Wir halten also rund 100 Rechnungen pro Monat fest.

Lass uns den ersten Schritt, das Sichten und Prüfen einer solchen Rechnung, genauer anschauen: Wie läuft dieser Schritt konkret ab, sobald du eine Rechnung öffnest?"

[Turn 5] Persona: Sobald ich das Dokument öffne, gleiche ich zunächst die grundlegenden Stammdaten des Lieferanten und den Leistungszeitraum mit unseren internen Vorgaben ab. Bei der Prüfung achte ich besonders darauf, ob eine korrekte Bestellreferenz vorhanden ist, da ich andernfalls eine manuelle Suche in verschiedenen Systemen anstoßen muss, um den Auftraggeber zu identifizieren. Sollte zudem der Betrag eine festgelegte Schwelle überschreiten, leite ich den Prozess für eine erforderliche Zweit-Freigabe ein, bevor ich die Buchung finalisiere und die Unterlagen in unserem Dokumentenmanagementsystem ablege.
[Turn 5] Agent: "Verstanden. Wie lange dauert diese erste Prüfung einer einzelnen Rechnung im Durchschnitt, wenn alles in Ordnung ist und eine Bestellreferenz vorliegt?"

[Turn 6] Persona: Wenn die Unterlagen vollständig sind und alle Referenzen direkt übereinstimmen, lässt sich der Vorgang zügig abwickeln, da ich die Buchung unmittelbar im System erfassen und das Dokument archivieren kann. Eine exakte zeitliche Angabe ist hier jedoch schwierig, da die Dauer stark von der Komplexität der Einzelfallprüfung abhängt. Die manuelle Nacharbeit bei Unstimmigkeiten, wie etwa bei einer fehlenden Kostenstelle oder abweichenden Mehrwertsteuersätzen, nimmt demgegenüber deutlich mehr Zeit in Anspruch als eine reguläre, fehlerfreie Buchung.
[Turn 6] Agent: "Wenn alles fehlerfrei ist und die Referenz vorliegt: Wie viele Minuten benötigst du für diese Prüfung einer einzelnen Rechnung typischerweise?"

[Turn 7] Persona: Bei einem reibungslosen Ablauf ohne notwendige manuelle Recherche oder Klärung von Differenzen lässt sich die Prüfung inklusive der Buchung und Ablage in wenigen Minuten effizient abschließen. Da sich die Dauer jedoch stark nach der spezifischen Komplexität der Einzelbelege richtet, ist eine pauschale Zeitangabe für jeden Vorgang nur schwer zu treffen. Mein Fokus liegt bei diesen fehlerfreien Dokumenten primär auf der zügigen und präzisen Erfassung in unseren Systemen.
[Turn 7] Agent: "Nenne mir bitte eine konkrete Minutenzahl, die du für die Prüfung einer solchen fehlerfreien Rechnung im Durchschnitt benötigst."

[Turn 8] Persona: Für eine vollständig validierte Rechnung, die alle notwendigen Informationen wie die Bestellreferenz enthält, kalkuliere ich im Durchschnitt etwa fünf Minuten Arbeitszeit ein. Dieser Zeitrahmen umfasst die unmittelbare Verbuchung in SAP FI sowie die abschließende Archivierung in DocuWare. Bei abweichenden Anforderungen oder notwendigen Korrekturen steigt dieser Zeitaufwand jedoch aufgrund der manuellen Klärungsschritte signifikant an.
[Turn 8] Agent: "Fünf Minuten für den fehlerfreien Fall sind ein guter Richtwert.

Wie genau gehst du vor, wenn eine Rechnung fehlerhaft ist oder die Bestellreferenz fehlt?"

[Turn 9] Persona: Bei fehlenden Informationen oder inhaltlichen Unstimmigkeiten beginne ich zunächst mit einer systematischen Suche nach dem zuständigen Auftraggeber über unsere drei primären IT-Systeme. Parallel dazu prüfe ich bei Diskrepanzen, wie etwa falschen Mehrwertsteuersätzen oder fehlenden Kostenstellen, ob eine direkte Klärung möglich ist oder eine Korrektur durch den Lieferanten angefordert werden muss. Erst nach der vollständigen Validierung dieser Datenpunkte kann ich den Beleg final in die Buchung überführen.
[Turn 9] Agent: "Wie oft kommt es im Monat vor, dass eine Rechnung fehlerhaft ist oder die Bestellreferenz fehlt?"

[Turn 10] Persona: Im Rahmen des monatlichen Rechnungseingangs treffe ich bei etwa fünf von einhundert Dokumenten auf Diskrepanzen wie fehlende Kostenstellen, falsche Mehrwertsteuersätze oder Betragsdifferenzen. Die Problematik der fehlenden Bestellreferenz tritt darüber hinaus regelmäßig auf und erfordert pro Woche jeweils etwa eine Stunde manuelle Sucharbeit in unseren Systemen. Diese Ausnahmefälle erfordern meine erhöhte Aufmerksamkeit, um die buchhalterische Korrektheit der Belege sicherzustellen.
[Turn 10] Agent: "Wir haben also etwa 5 Rechnungen mit Diskrepanzen pro Monat und zusätzlich jede Woche etwa eine Stunde Suche wegen fehlender Referenzen. 

Wie viel Zeit benötigst du für die Bearbeitung einer einzelnen fehlerhaften Rechnung im Durchschnitt?"

[Turn 11] Persona: Die Dauer für die Klärung einer fehlerhaften Rechnung lässt sich nur schwer pauschal benennen, da der Zeitbedarf stark von der Art der Unstimmigkeit abhängt. Während kleinere inhaltliche Korrekturen, wie etwa die Ergänzung einer Kostenstelle, zügig erledigt sind, erfordern Betragsdifferenzen oder fehlerhafte Mehrwertsteuersätze oft eine aufwendigere Abstimmung. Insgesamt benötige ich für solche Fälle inklusive der notwendigen Rückfragen und der abschließenden Validierung meist zwischen fünfzehn und dreißig Minuten pro Vorgang.
[Turn 11] Agent: "Du hast eine Spanne von 15 bis 30 Minuten genannt — welcher Wert trifft es für einen typischen Fall einer fehlerhaften Rechnung am besten?"

[Turn 12] Persona: Im Durchschnitt ist ein Zeitraum von etwa zwanzig Minuten realistisch, um die meisten Unstimmigkeiten durch manuelle Abstimmungen und Korrekturen erfolgreich zu bereinigen. Dieser Wert spiegelt die notwendige Sorgfalt wider, die ich aufbringen muss, um die buchhalterische Konsistenz in unseren Systemen zu gewährleisten. Da die Komplexität der Klärungsfälle stark variiert, dient dieser Wert als verlässlicher Mittelwert für meine monatliche Zeitplanung.
[Turn 12] Agent: "Alles klar, wir halten 20 Minuten für einen typischen Fehlerfall fest.

Gibt es bei dieser gesamten Rechnungsprüfung und -buchung klare, eindeutige Regeln, nach denen du entscheidest (z.B. feste Betragsgrenzen für die Zweit-Freigabe), oder erfordert der Prozess oft dein persönliches Ermessen?"

[Turn 13] Persona: Bei der Rechnungsprüfung existieren verbindliche Vorgaben, die meinen Handlungsspielraum strukturieren und für eine einheitliche Qualität der Buchungen sorgen. Insbesondere bei Beträgen, die die Grenze von 5.000 EUR überschreiten, ist eine explizite Zweit-Freigabe zwingend erforderlich, wodurch mein persönliches Ermessen in diesem Punkt durch ein festes Vier-Augen-Prinzip ersetzt wird. Grundsätzlich verlasse ich mich bei der täglichen Arbeit auf diese klaren Schwellenwerte, um eine konsequente Einhaltung unserer internen Compliance-Richtlinien sicherzustellen.
[Turn 13] Agent: "Das ist eine klare Regelung mit der 5.000-Euro-Grenze. 

Gibt es neben dieser Betragsgrenze noch andere Schritte bei der Rechnungsprüfung, bei denen du nach eigenem Ermessen entscheiden musst, oder ist der gesamte Ablauf durch feste Regeln vorgegeben?"

[Turn 14] Persona: Für die verbleibenden Arbeitsschritte folge ich strikten internen Vorgaben, um die Konsistenz unserer Buchhaltung zu gewährleisten. Auch wenn mein fachliches Urteilsvermögen bei der Zuordnung unklarer Kostenstellen oder der Identifizierung von Ansprechpartnern gefragt ist, sind die grundlegenden Prozesse für die Verbuchung und Ablage in SAP FI und DocuWare fest definiert. Mein Handlungsspielraum beschränkt sich daher eher auf die effiziente Lösung von Ausnahmen innerhalb dieses vorgegebenen Rahmens, anstatt in den strukturierten Ablauf selbst einzugreifen.
[Turn 14] Agent: "Wie viele Rechnungen bearbeitest du insgesamt in einem typischen Monat?"

[Turn 15] Persona: Wie ich bereits erläutert habe, bewegt sich das monatliche Volumen meiner zu bearbeitenden Rechnungen in einem Bereich von achtzig bis einhundert Stück. In der Regel pendelt sich die tatsächliche Anzahl dabei eher im oberen Teil dieser Spanne ein. Diese Menge bildet die Basis für meine tägliche Planung, um die rechtzeitige Verbuchung in SAP FI und die ordnungsgemäße Ablage in DocuWare sicherzustellen.
[Turn 15] Agent: "Gibt es bei der Rechnungsprüfung Medienbrüche, beispielsweise wenn Daten ausgedruckt oder von einem System in ein anderes manuell abgetippt werden müssen?"

[Turn 16] Persona: In der täglichen Arbeit zeigt sich, dass trotz der digitalen Bereitstellung der Unterlagen über den E-Mail-Client und der anschließenden Archivierung in DocuWare durchaus manuelle Übertragungsschritte bestehen bleiben. Da die Systeme nicht immer nahtlos miteinander kommunizieren, übertrage ich die validierten Daten in SAP FI, was einen gewissen manuellen Aufwand bei der Dateneingabe mit sich bringt. Diese notwendigen manuellen Schritte bilden die Schnittstelle zwischen den verschiedenen Applikationen und erfordern meine kontinuierliche Aufmerksamkeit, um Übertragungsfehler in unseren Buchhaltungssystemen konsequent zu vermeiden.
[Turn 16] Agent: "Gibt es neben der Rechnungsprüfung noch einen weiteren großen Prozess, den du regelmäßig bearbeitest – zum Beispiel den Monatsabschluss?"

[Turn 17] Persona: Beim Monatsabschluss verantworte ich die Abstimmung sämtlicher offener Posten sowie die notwendige Bildung von Rückstellungen, um die finanzielle Übersicht für das Controlling zu gewährleisten. Dieser Prozess umfasst eine intensive Phase, in der ich sämtliche Buchungsvorgänge in SAP FI konsolidiere und für die weitere Analyse aufbereite. Besondere Aufmerksamkeit widme ich dabei den Ausnahmen, die ich manuell in Excel nachpflege, da diese für den finalen Abschluss eine zentrale Rolle spielen.
[Turn 17] Agent: "Das ist ein wichtiger Bereich. Mit welchem konkreten Schritt startest du den Monatsabschluss in SAP FI?"

[Turn 18] Persona: Für den Abschluss beginne ich zunächst mit einer umfassenden Abstimmung aller offenen Posten, um eine saubere Grundlage in SAP FI zu schaffen. Im Anschluss daran leite ich die Buchung der notwendigen Rückstellungen ein, um eine korrekte Abgrenzung sicherzustellen. Erst nach diesen vorbereitenden Schritten überführe ich die aufbereiteten Daten in das Format, welches für die weitere Arbeit des Controllings erforderlich ist.
[Turn 18] Agent: "Wie genau gehst du bei dieser Abstimmung der offenen Posten in SAP FI vor und wie läuft dieser erste Schritt konkret ab?"

[Turn 19] Persona: Im Rahmen der Abstimmung prüfe ich zunächst sämtliche Konten auf nicht ausgeglichene Posten, um sicherzustellen, dass die Salden in SAP FI den tatsächlichen Gegebenheiten entsprechen. Dabei vergleiche ich die offenen Positionen mit den entsprechenden Belegen, um Differenzen frühzeitig zu identifizieren und gegebenenfalls manuelle Korrekturen oder Klärungen einzuleiten. Erst wenn diese operative Bereinigung abgeschlossen ist, betrachte ich den Prozessabschnitt für die weitere buchhalterische Verarbeitung als valide und stabil.
[Turn 19] Agent: "Wie viel Zeit benötigst du für diese Abstimmung der offenen Posten und die anschließende Rückstellungsbildung beim Monatsabschluss insgesamt?"

[Turn 20] Persona: Für den gesamten Monatsabschluss wende ich eine Arbeitszeit von zwei bis drei Tagen auf, in denen ich mich intensiv der Abstimmung und den Rückstellungen widme. Diese Phase ist durch einen hohen Zeitdruck geprägt, da alle Daten in SAP FI konsolidiert und für das Controlling aufbereitet werden müssen. Die notwendige manuelle Nachpflege von Ausnahmen in Excel nimmt dabei einen nicht unerheblichen Teil dieser Zeit in Anspruch, um eine vollständige und korrekte Übergabe an die nachfolgenden Stellen sicherzustellen.
[Turn 20] Agent: "Du hast eine Spanne von zwei bis drei Tagen genannt — welcher Wert trifft es für einen typischen Monatsabschluss am besten?"

[Turn 21] Persona: In der Regel sind die drei Tage der intensivere Zeitraum, da die manuelle Nachpflege der Ausnahmen in Excel sowie die konsistente Abstimmung sämtlicher Posten in SAP FI erfahrungsgemäß diesen Zeitaufwand erfordern. Da ich großen Wert auf eine präzise Übergabe an das Controlling lege, ist dieser Zeitrahmen für mich die verlässliche Planungsgrundlage, um die hohen Anforderungen der Abschlussarbeiten trotz des auftretenden Termindrucks zu erfüllen. Ein Abschluss in zwei Tagen ist lediglich bei einem sehr geringen Volumen an manuellen Korrekturbedarfen realisierbar.
[Turn 21] Agent: "Wir halten also drei Tage für einen typischen Monatsabschluss fest.

Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?"

[Turn 22] Persona: Im Rahmen meiner regelmäßigen Tätigkeiten spielt neben den genannten Prozessen auch der monatliche Mahnprozess eine bedeutende Rolle. Dieser Vorgang nimmt ebenfalls eine nicht zu unterschätzende Menge an Zeit in Anspruch, um säumige Zahlungen zu identifizieren und entsprechend zu verfolgen. Da wir uns in unserem bisherigen Gespräch primär auf die Rechnungsprüfung und den Monatsabschluss konzentriert haben, ist dieser Aspekt der Debitorenbuchhaltung bislang noch nicht im Detail besprochen worden.
[Turn 22] Agent: "Das ist ein wichtiger Hinweis. Lass uns diesen Mahnprozess genauer anschauen: Wie oft im Monat führst du diesen Mahnlauf durch und wie startest du ihn?"

[Turn 23] Persona: Für den Mahnprozess setze ich mich einmal monatlich an die Prüfung der überfälligen Forderungen, um eine konsistente Liquiditätssteuerung sicherzustellen. Ich gehe dabei so vor, dass ich zunächst das Mahnwesen in SAP FI initiiere, um die Liste der säumigen Geschäftspartner zu generieren. Anschließend sichte ich diese Aufstellung manuell, um sicherzustellen, dass keine bereits geklärten Differenzen oder vereinbarten Stundungen den Mahnlauf ungerechtfertigt auslösen.
[Turn 23] Agent: "Wie viel Zeit benötigst du für diesen gesamten monatlichen Mahnlauf im Durchschnitt?"

[Turn 24] Persona: Für die Durchführung des Mahnlaufs kalkuliere ich als festen Bestandteil meiner monatlichen Routinen eine Zeitspanne von etwa einem Arbeitstag ein. Dabei entfällt ein Großteil der Zeit auf die manuelle Validierung der generierten Mahnvorschlagsliste in SAP FI, um sicherzustellen, dass keine fehlerhaften Mahnungen versendet werden. Diese sorgfältige Prüfung der offenen Posten ist unerlässlich, um unsere Kundenbeziehungen nicht durch inkorrekte Forderungsstellungen zu belasten.
[Turn 24] Agent: "Vielen Dank für die detaillierten Einblicke in deine Arbeitsprozesse, Andreas. Wir haben nun alle wichtigen Schritte von der Rechnungsprüfung über den Monatsabschluss bis hin zum Mahnlauf strukturiert erfasst. Das hilft uns sehr, dieses wertvolle Wissen für die Abteilung zu sichern. Ich wünsche dir einen schönen Tag und weiterhin viel Erfolg bei deiner Arbeit!"

[Turn 25] Persona: Sehr gerne geschehen, ich freue mich, dass ich einen konstruktiven Beitrag zur Dokumentation unserer Arbeitsabläufe leisten konnte. Es ist mir ein wichtiges Anliegen, dass unsere Prozesse in der Finanzbuchhaltung transparent und nachvollziehbar dargestellt sind, um auch langfristig eine hohe Qualität in der Buchhaltung sicherzustellen. Ich danke Ihnen ebenfalls für das angenehme Gespräch und wünsche Ihnen für Ihr weiteres Vorhaben viel Erfolg.
[Turn 25] Agent: "Vielen Dank für das angenehme Gespräch und deine Unterstützung, Andreas. Ich wünsche dir ebenfalls einen schönen Tag und weiterhin viel Erfolg!"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung: Sichten und Verbuchung | done | 100 ✓ | 20 ✓ | true ✓ | SAP FI,DocuWare,E-Mail-Client ✓ | 5 ✓ | 1 ✓ |
| Monatsabschluss: Abstimmung und Rückstellungsbildung | walkthrough | null | null | null | SAP FI,Excel ✓ | null | null |
| Mahnwesen: Durchführung des Mahnlaufs | exploring | null | null | null | null | null | null |

## Vergleich mit Vorgänger-Lauf (2026-06-03-11-20-12, pre-ADR-014)

| Metrik | pre-ADR-014 | post-ADR-014 | Delta |
|--------|-------------|--------------|-------|
| slot_coverage | 0.33 | 0.42 | +0.09 ✓ |
| tool_call_plausibility | 0.16 | 0.24 | +0.08 ↑ |
| dialog_naturalness | 0.78 | 0.42 | **-0.36 ↓ REGRESSION** |
| phase_progression | 1 | 1 | = |
| phase_adherence | 1 | 1 | = |
| anchoring_violations | 0 | 0 | = |
| step_registration_coverage | 1 | 1 | = |
| completion_correctness | true | true | = |

## Befunde

### B5/B8 — BEHOBEN ✓
step_registration_coverage=1.0 stabil. data_sources für Rechnungsprüfung nun korrekt gefüllt (["SAP FI","DocuWare","E-Mail-Client"]) — Single-Schreibpfad-Regel im Analyst-Prompt wirkt.

### B6 — VERBESSERT, NICHT BEHOBEN (Medium)
tool_call_plausibility: 0.16 → 0.24. source_turn im Tool-Schema wirkt teilweise. Scorer kann bei gesetztem source_turn gegen historischen Turn prüfen. Score bleibt aber weit unter Ziel (≥0.95).

**Verbleibende Ursache:** Analyst macht weiterhin Batch-Fills mit mehreren record_slot-Calls in einem Turn. Die evidence_quotes sind paraphrasierte Zusammenfassungen, keine wörtlichen Zitate aus dem Transcript. Selbst mit korrekt gesetztem source_turn → normalizedInput.includes(normalizedQuote) schlägt fehl weil Quote nicht verbatim aus User-Input stammt.

**Root cause neu verstanden:** Problem ist nicht Turn-Attribution allein — das LLM paraphrasiert statt zu zitieren. source_turn allein reicht nicht. Fix-Richtung: Analyst-Prompt muss stärker auf verbatim-Zitat-Pflicht bestehen, alternativ fuzzy-matching im Scorer.

### B7 — VERBESSERT (Low)
computeStepBudget wirkt: Rechnungsprüfung 16 Turns (vorher 17), Monatsabschluss 8 Turns (vorher 1), Mahnwesen als 3. Bonus-Prozess wieder entdeckt. Transition zu Monatsabschluss bei Turn 17 (HL=34), Budget-Push korrekt. Rechnungsprüfung-Tiefe noch hoch aber kein Starvation mehr.

### B9 — NEU (High): dialog_naturalness Regression 0.78 → 0.42

**Beobachtung:** dialog_naturalness eingebrochen von 0.78 auf 0.42.

**Ursache (dual, aus Transcript):**
1. **Turn 14 Repetition:** Agent fragt "Wie viele Rechnungen bearbeitest du insgesamt in einem typischen Monat?" — dieser Wert (80-100, ~100) war bereits in Turn 3-4 etabliert. Persona reagiert in Turn 15 mit "Wie ich bereits erläutert habe..." — sichtbares Naturalness-Signal für den Scorer.
2. **Adaptive thinkingBudget=0:** ADR-014 Talker-Änderung setzt thinkingBudget=0 während slot_completion/coverage_check/wrap_up. Gemini Flash 3.5 verliert ohne Thinking-Budget Kohärenz bei bereits bekannten Fakten — fragt redundant nach.

**Fix-Empfehlung:**
- thinkingBudget nicht auf 0 setzen — Floor von 128-256 statt 0, auch in slot_completion. Das "Thinking=0 für Execution-Phasen"-Annahme ist falsch für Flash 3.5.
- Alternativ: Revert der adaptive-thinking Änderung komplett (war pre-ADR-014 nicht vorhanden, wurde vom Coder hinzugefügt ohne expliziten ADR-Auftrag).

### Adaptive Thinking Budget — Außer-Plan-Änderung
ADR-014 hat adaptive thinkingBudget (512 für Exploration, 0 für Execution) NICHT spezifiziert. Diese Änderung wurde vom Coder eigenständig hinzugefügt. Sie ist wahrscheinlich die Hauptursache für B9. Empfehlung: revertieren auf festes Budget=512 für alle Phasen (ursprüngliches Verhalten).
