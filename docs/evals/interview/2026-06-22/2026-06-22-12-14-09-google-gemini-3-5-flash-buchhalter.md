---
interview_model: google/gemini-3.5-flash
tester_model: google/gemini-3.1-flash-lite
talker_model: google/gemini-3.5-flash
talker_thinking_budget: 512
analyst_model: google/gemini-3.5-flash
analyst_thinking_budget: 2048
eval_date: 2026-06-22
persona: buchhalter
interview_id: 522885bc-b201-4a8e-8b60-772ee372fc3a
eval_run_id: 2999827b-0807-4890-8372-cacab8927a24
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/522885bc-b201-4a8e-8b60-772ee372fc3a
turns_total: 20
status: FAIL
baseline_label: null
scores:
  slot_coverage: 0.78
  dedup_slot_coverage: 0.78
  slot_coverage_pre_clarification: 0.78
  dedup_slot_coverage_pre_clarification: 0.78
  clarification_coverage_delta: 0
  phase_progression: 1
  phase_adherence: 1
  anchoring_violations: 0
  tool_call_plausibility: 0.96
  dialog_naturalness: 0.33
  completion_correctness: true
  step_registration_coverage: 1
  schema_conformance_rate: 1
  hallucination_rate: 0
  confidence_trigger_rate: 0.6
  depth_score: 1.73
  depth_p1: 0.31
  depth_p2: 0.65
  depth_p3: 0.04
trail:
  total_writes: 50
  blocked_writes: 1
  blocked_rate: 0.02
  overwrite_churn: 0.36
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 0.78 | maximize |
| dedup_slot_coverage | 0.78 | maximize |
| slot_coverage_pre_clarification | 0.78 | maximize |
| dedup_slot_coverage_pre_clarification | 0.78 | maximize |
| clarification_coverage_delta | 0 | > 0 wenn Clarification ran |
| phase_progression | 1 | maximize |
| phase_adherence | 1 | maximize |
| anchoring_violations | 0 | 0 |
| tool_call_plausibility | 0.96 | ≥ 0.80 |
| dialog_naturalness | 0.33 | maximize |
| completion_correctness | true | true |
| step_registration_coverage | 1 | 1.0 |
| schema_conformance_rate | 1 | 1.0 |
| hallucination_rate | 0 | < 0.01 |
| confidence_trigger_rate | 0.6 | > 0.80 |
| depth_score | 1.73 | maximize |
| depth_p1 | 0.31 | — |
| depth_p2 | 0.65 | — |
| depth_p3 | 0.04 | — |
| blocked_rate | 0.02 | < 0.10 |
| overwrite_churn | 0.36 | < 0.20 |


## Judge-Begründung

Die Texte sind Interviewfragen, keine Agent-Antworten. Sie zeigen jedoch oberflächliche Merkmale: generische Übergänge ('Grob geschätzt', 'Woran erkennst du'), abrupte Themensprünge zwischen Belegen, Software, Zeitaufwand und Fehlerquoten ohne natürliche Verbindung. Fehlende Kontextualisierung und häufige Perspektivwechsel deuten auf mangelnde Gesprächskohärenz hin.

## Gesprächsverlauf

[Turn 1] Persona: Mein Arbeitsalltag ist primär durch die laufende Bearbeitung der eingehenden Belege sowie die qualitätssichernde Vorbereitung der buchhalterischen Abschlüsse geprägt. Hierbei achte ich kontinuierlich auf die korrekte Kontierung und Archivierung, wobei ich bei komplexeren Vorgängen zur Abstimmung mit anderen Fachbereichen übergehe. Zudem widme ich mich regelmäßig der Verwaltung ausstehender Zahlungen und pflege notwendige Aufstellungen, um die finanzielle Transparenz im Unternehmen sicherzustellen.
[Turn 1] Agent: "Du hast die Bearbeitung der eingehenden Belege erwähnt. Wie läuft dieser Prozess von der Erfassung eines Belegs bis zur finalen Buchung konkret ab?"

[Turn 2] Persona: Der Prozess beginnt mit dem Eingang der Dokumente, deren Angaben zu Lieferanten, Beträgen und Zeiträumen ich sorgfältig gegen die vorliegenden Unterlagen abgleiche. Anschließend überführe ich die Daten in unser System, wobei ich bei Belegen über einer festgelegten Wertgrenze sicherstelle, dass eine zusätzliche fachliche Freigabe erfolgt. Abschließend archiviere ich den gesamten Vorgang revisionssicher und leite bei fehlenden Bestellbezügen eine manuelle Recherche ein, um den zuständigen Auftraggeber ausfindig zu machen.
[Turn 2] Agent: ""

[Turn 2] Persona: Beim Monatsabschluss richte ich mein Augenmerk auf die Konsolidierung der Datenbestände, um eine korrekte Abbildung der finanziellen Lage zu gewährleisten. Hierbei identifiziere ich gezielt Unstimmigkeiten bei Kostenstellen oder steuerlichen Zuordnungen, die in einer gesonderten Übersicht dokumentiert und bereinigt werden müssen. Die größte Herausforderung liegt in der zeitlichen Verdichtung, da alle Buchungen innerhalb weniger Tage präzise abgeschlossen sein müssen, um die Daten für das Controlling vorzubereiten.
[Turn 2] Agent: "Welche Software oder Hilfsmittel nutzt du für die Überführung der Belegdaten ins System, und wie viele Belege bearbeitest du in der Regel pro Monat?"

[Turn 3] Persona: Für die Erfassung und Verbuchung nutze ich SAP FI, während die revisionssichere Ablage der Dokumente in DocuWare erfolgt. Im Rahmen meiner monatlichen Tätigkeit bearbeite ich dabei ein Volumen von 80 bis 100 Rechnungen. Bei Unstimmigkeiten greife ich zudem auf Excel zurück, um diese Sonderfälle strukturiert nachzuhalten und abzuarbeiten.
[Turn 3] Agent: "Wie viel Zeit nimmt dieser Konsolidierungs- und Bereinigungsprozess im Rahmen des Monatsabschlusses üblicherweise in Anspruch?"

[Turn 4] Persona: Für den Abschluss veranschlage ich üblicherweise zwei bis drei Tage konzentrierte Arbeit, um die Datenbestände vollständig zu bereinigen und abzustimmen. Diese Phase ist durch einen hohen Zeitdruck gekennzeichnet, da alle Sonderfälle und Unstimmigkeiten innerhalb dieses kurzen Zeitfensters gelöst werden müssen. Erst nach dieser intensiven Periode sind die Unterlagen so aufbereitet, dass sie für das Controlling bereitgestellt werden können.
[Turn 4] Agent: "Wie viel Zeit nimmst du dir im Durchschnitt für die Bearbeitung einer einzelnen Rechnung?"

[Turn 5] Persona: Grundsätzlich lässt sich die Bearbeitungszeit nicht pauschal beziffern, da sie stark von der Qualität der eingegangenen Belege abhängt. Während standardisierte Vorgänge zügig abgearbeitet werden können, erfordern Rechnungen ohne Bestellbezug eine zeitaufwendige manuelle Recherche über mehrere Systeme hinweg. Dieser zusätzliche Aufwand für die Klärung der Auftraggeber beläuft sich wöchentlich auf etwa eine Stunde, was den Prozess je nach Belegart erheblich in die Länge zieht.
[Turn 5] Agent: "Wenn wir die zeitaufwendigen Sonderfälle beiseitelassen: Wie viele Minuten benötigst du im Schnitt für die Bearbeitung eines einzelnen, standardmäßigen Belegs, und welches Ergebnis liegt danach im System vor?"

[Turn 6] Persona: Für einen standardisierten Vorgang, bei dem alle notwendigen Informationen wie Lieferant, Betrag und Leistungszeitraum korrekt vorliegen, kalkuliere ich im Durchschnitt etwa fünf Minuten Arbeitszeit ein. Nach der erfolgreichen Prüfung und Eingabe in das Buchhaltungssystem ist der Beleg dort vollständig verbucht und gleichzeitig revisionssicher in unserem Archivsystem hinterlegt. Damit ist der Vorgang für die laufende Buchhaltung abgeschlossen, sofern keine zusätzliche Freigabe aufgrund der Wertgrenzen erforderlich ist.
[Turn 6] Agent: "Wie hoch ist schätzungsweise der prozentuale Anteil der Belege, die nicht direkt durchlaufen, sondern aufgrund von Fehlern oder Unstimmigkeiten manuell nachbearbeitet werden müssen?"

[Turn 7] Persona: Wenn ich die Qualität unserer Eingangsbelege betrachte, stelle ich fest, dass etwa fünf Prozent der Rechnungen Unstimmigkeiten aufweisen. Diese Fälle erfordern eine manuelle Nachbearbeitung, da beispielsweise Kostenstellen fehlen, Mehrwertsteuersätze inkorrekt ausgewiesen sind oder die Beträge nicht mit den Erwartungen übereinstimmen. Solche Korrekturen nehme ich gewissenhaft vor, um die Konsistenz unserer Buchhaltungsdaten sicherzustellen.
[Turn 7] Agent: "Du hast anfangs auch die Verwaltung ausstehender Zahlungen erwähnt. Kannst du mir beschreiben, wie du dabei vorgehst und welche Schritte du durchläufst?"

[Turn 8] Persona: Im Rahmen des Mahnwesens konzentriere ich mich darauf, die offenen Posten systematisch abzugleichen und die entsprechenden Rückstellungen korrekt im System zu verbuchen. Da dies ein zeitintensiver Prozess ist, achte ich darauf, die notwendigen Daten anschließend strukturiert für das Controlling aufzubereiten. Zwar ist dieser Bereich bislang nicht detailliert in unseren Prozessen abgebildet, er stellt jedoch einen wesentlichen Bestandteil meiner Arbeit zur Sicherung der finanziellen Transparenz dar.
[Turn 8] Agent: "Woher genau nimmst du die Daten für den Abgleich der offenen Posten, und musst du diese Informationen manuell zwischen verschiedenen Systemen übertragen oder kopieren?"

[Turn 9] Persona: Die notwendigen Informationen beziehe ich primär direkt aus SAP FI, wo die offenen Posten für den Abgleich gelistet sind. Da diese Daten direkt in unserer Buchhaltungssoftware verwaltet werden, entfällt ein manuelles Kopieren zwischen verschiedenen Systemen weitestgehend. Die Arbeit konzentriert sich stattdessen auf den inhaltlichen Abgleich und die anschließende buchhalterische Erfassung der Rückstellungen.
[Turn 9] Agent: "Wie viel Zeit nimmt dieser Abgleich der offenen Posten und das Einbuchen der Rückstellungen insgesamt pro Monat in Anspruch?"

[Turn 10] Persona: Für die Durchführung des Mahnlaufs und die damit verbundene Arbeit bei den offenen Posten sowie Rückstellungen wende ich monatlich einen signifikanten Teil meiner Kapazitäten auf. Da dieser Prozess eine präzise Prüfung jedes einzelnen Postens erfordert, lässt sich der Zeitaufwand nicht auf wenige Minuten reduzieren. Eine exakte monatliche Stundenangabe kann ich zwar nicht pauschal nennen, doch stellt dies eine der zeitintensiven Aufgaben dar, die neben der laufenden Rechnungsprüfung meine volle Aufmerksamkeit erfordern.
[Turn 10] Agent: "Grob geschätzt für diesen monatlichen Abgleich: Sprechen wir hier eher von wenigen Stunden oder beansprucht das mehrere Tage im Monat?"

[Turn 11] Persona: Für den Prozess der offenen Posten sowie die Bildung der Rückstellungen beanspruche ich monatlich einen Zeitraum im Bereich mehrerer Tage, da eine akribische Durchsicht erforderlich ist. Da diese Tätigkeiten direkt in den Monatsabschluss integriert sind, ist der Aufwand in dieser heißen Phase besonders spürbar. Eine bloße Zeitspanne von wenigen Stunden würde der Komplexität der Abstimmungen und der notwendigen Qualitätssicherung für das Controlling keinesfalls gerecht werden.
[Turn 11] Agent: "Wie hoch ist schätzungsweise der Anteil der offenen Posten, bei denen beim Abgleich Fehler oder Unstimmigkeiten auffallen, die Du korrigieren musst?"

[Turn 12] Persona: Für den Abgleich der offenen Posten kann ich keinen spezifischen prozentualen Anteil an Unstimmigkeiten nennen, da die Fehlerhäufigkeit stark von der internen Datenpflege abhängt. Die Identifikation von Differenzen erfolgt meist punktuell bei der intensiven Durchsicht der Kontenblätter. Jede gefundene Unstimmigkeit erfordert eine manuelle Prüfung, um sicherzustellen, dass die Rückstellungen korrekt gebildet und die Salden für das Controlling valide abgebildet werden.
[Turn 12] Agent: "Ok, das passt so. Wenn du den Abgleich der offenen Posten durchführst: Gibt es dabei Medienbrüche, beispielsweise weil du Daten ausdrucken musst, oder läuft alles rein digital am Bildschirm ab?"

[Turn 13] Persona: Für den Abgleich der offenen Posten arbeite ich nahezu ausschließlich digital direkt innerhalb der Benutzeroberfläche von SAP FI. Ein Ausdrucken von Daten ist für diese spezifische Tätigkeit nicht erforderlich, da ich die notwendigen Informationen unmittelbar am Bildschirm prüfen und verarbeiten kann. Dies ermöglicht mir eine effiziente Handhabung der Datenmengen, ohne dass es zu physischen Medienbrüchen kommt.
[Turn 13] Agent: "Haben wir damit die wesentlichen Schritte und Herausforderungen deiner drei Hauptaufgaben – Belegbearbeitung, Monatsabschluss und das Mahnwesen – vollständig erfasst, oder gibt es noch einen wichtigen Aspekt, den wir bisher übersehen haben?"

[Turn 14] Persona: Neben den detailliert besprochenen Tätigkeiten stellt insbesondere die wöchentliche Recherche bei Rechnungen ohne Bestellbezug einen weiteren, bisher nur am Rande erwähnten Zeitfresser dar. Hierbei bin ich gezwungen, den jeweiligen Auftraggeber manuell über drei verschiedene Systeme hinweg zu identifizieren, was pro Woche etwa eine Stunde meiner Kapazitäten bindet. Diese systemübergreifende Suche ist ein notwendiger, aber sehr arbeitsintensiver Schritt, um eine korrekte Zuordnung und Verbuchung innerhalb der Rechnungsprüfung sicherzustellen.
[Turn 14] Agent: "Gibt es bei der Belegbearbeitung, also vom Eingang einer Rechnung bis zur Archivierung, noch Schritte, bei denen du Papierdokumente händisch bearbeiten oder einscannen musst, oder läuft auch das komplett digital ab?"

[Turn 15] Persona: Da sämtliche Rechnungen, die mein Postfach erreichen, bereits in elektronischer Form eingehen, ist eine händische Bearbeitung von Papierdokumenten oder ein zusätzlicher Scanvorgang in der Regel nicht notwendig. Ich verarbeite diese Dokumente durchgängig digital, indem ich die Informationen direkt aus dem E-Mail-Client entnehme und zur weiteren Bearbeitung in die entsprechenden Systeme überführe. Dies ermöglicht einen effizienten digitalen Workflow, bei dem die Archivierung unmittelbar nach der Verbuchung in DocuWare erfolgt.
[Turn 15] Agent: "Wie hoch ist schätzungsweise der Anteil der Datenbestände oder Buchungen, bei denen du beim Monatsabschluss tatsächlich Unstimmigkeiten korrigieren musst, und folgt diese Bereinigung einem festen Schema oder entscheidest du das von Fall zu Fall?"

[Turn 16] Persona: Für den Monatsabschluss sind etwa fünf Prozent der Rechnungen mit Unstimmigkeiten behaftet, die eine Korrektur erfordern. Die Vorgehensweise bei dieser Bereinigung folgt keinem starren Schema, da die Ursachen für die Fehler – wie etwa fehlende Kostenstellen oder steuerliche Abweichungen – sehr individuell ausfallen. Ich treffe daher für jeden Einzelfall eine eigenständige Entscheidung, wie die Daten in SAP FI am besten anzupassen sind, um die Konsistenz des Abschlusses zu gewährleisten.
[Turn 16] Agent: "Gibt es beim Monatsabschluss Schritte, bei denen du Daten ausdrucken musst oder Excel-Listen manuell abtippst, oder läuft auch hier alles rein digital am Bildschirm ab?"

[Turn 17] Persona: Bei der Durchführung des Monatsabschlusses ist es erforderlich, Sonderfälle und Ausnahmen in Excel-Listen zu erfassen, was eine manuelle Pflege und Aktualisierung dieser Dateien erfordert. Während die Datenhaltung in den Hauptsystemen digital erfolgt, bildet Excel das essenzielle Hilfsmittel, um die Unstimmigkeiten strukturiert nachzuhalten und für das Controlling aufzubereiten. Ein Ausdrucken der Daten ist dabei nicht notwendig, da ich sämtliche Bereinigungen direkt am Bildschirm vornehme und die Excel-Listen als ergänzendes Kontrollinstrument nutze.
[Turn 17] Agent: "Wie oft im Jahr führst du diesen Monatsabschluss durch – ist das ein rein monatlicher Rhythmus, also genau zwölfmal im Jahr, oder gibt es zusätzliche Quartals- oder Jahresabschlüsse, die du ebenfalls bearbeitest?"

[Turn 18] Persona: Dieser Prozess findet exakt zwölfmal im Jahr statt, da ich den Abschluss strikt in einem monatlichen Rhythmus durchführe. Die strukturellen Anforderungen für das Controlling erfordern diese kontinuierliche Disziplin, wobei die Quartals- oder Jahresabschlüsse in ihrem Ablauf weitestgehend auf diesen monatlichen Routinen aufbauen. Es handelt sich somit um eine fest terminierte, monatlich wiederkehrende Belastung für meine Arbeitskapazitäten.
[Turn 18] Agent: "Woran erkennst du bei der Belegbearbeitung oder dem Monatsabschluss durch deine Erfahrung schon auf den ersten Blick, dass ein Beleg oder eine Buchung fehlerhaft ist, ohne dass du erst tief in die Daten einsteigen musst?"

[Turn 19] Persona: Nach meiner zwölfjährigen Berufserfahrung erkenne ich Unstimmigkeiten häufig durch Unregelmäßigkeiten im Format oder bei den Stammdaten, wie etwa eine nicht plausible Kostenstellenangabe oder abweichende steuerliche Parameter. Bei der Prüfung der Rechnungen sticht mir zudem sofort ins Auge, wenn der ausgewiesene Betrag nicht mit den mir bekannten Konditionen oder den Erwartungen aus den laufenden Konten korrespondiert. Diese intuitive Einschätzung basiert auf der ständigen Wiederholung der Vorgänge, wodurch mir Abweichungen in der Struktur der Daten bereits beim ersten Sichten auffallen.
[Turn 19] Agent: "Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | entscheidungslogik | hilfsmittel | error_rate | media_breaks |
|---------|--------|-----------|----------|--------------------|-------------|------------|--------------|
| forderungsmanagement | walkthrough | 1 ✓ | 1200 ✓ | Offene Posten system ✓ | SAP FI ✓ | null ✓ | 0 ✓ |
| belegbearbeitung | walkthrough | 90 ✓ | 5 ✓ | individuelle Entsche ✓ | Excel ✓ | 5 ✓ | 0 ✓ |
| monatsabschluss | walkthrough | 1 ✓ | 1440 ✓ | individuelle Entsche ✓ | Excel ✓ | 5 ✓ | 0 ✓ |

### Vollständige O-Slot-Coverage (O2/O3 tazit + O4)

| Schritt (reihenfolge) | Status | entscheidungslogik (O2) | tazite_cues (O2) | ausnahmen (O3) | inputs (O4) | outputs (O4) | hilfsmittel (O5) |
|-----------------------|--------|-------------------------|------------------|----------------|-------------|--------------|------------------|
| forderungsmanagement (1) | walkthrough | ✓ offene Posten abgleichen, Rückstellungen verbuchen | **null** | ✓ keine Papier-/Scanbearbeitung | ✓ offene Posten | ✓ Erfassung der Rückstellungen | ✓ SAP FI |
| belegbearbeitung (2) | walkthrough | ✓ individuelle Entscheidung je Ursache | **null** | ✓ fehlende Kostenstellen, falsche MwSt, Betragsdiff. | ✓ E-Mail-Client, elektron. Rechnungen | ✓ verbuchter Beleg, Archiv-Dok. | ✓ Excel |
| monatsabschluss (3) | walkthrough | ✓ kein starres Schema, individuell | **null** | ✓ Unstimmigkeiten Kostenstellen/Steuer | ✓ Datenbestände | ✓ Controlling-Daten, Übersicht | ✓ Excel |

`tazite_cues` (O2) ist über alle drei Schritte leer, obwohl der Agent in Turn 18 explizit danach fragte (siehe Befund 4). entscheidungslogik + ausnahmen tragen die tazite Last.

## Extrahierte Wissensobjekte

> 31 Records gesamt (13 `tool`, 18 `pain_point`). Tool-Records sind dedup-pflichtig (KI-2): mehrere Records pro distinktem Werkzeug.

| Typ | Distinkte Werte / Auswahl | Anmerkung |
|-----|---------------------------|-----------|
| tool | **SAP FI ×4** (Erfassung/Verbuchung · offene Posten · Abgleich · Daten-Anpassung), **DocuWare ×2**, **Excel ×2**, **E-Mail-Client ×1** | 4 echte Tools |
| tool (Alias-Dubletten) | „Buchhaltungssystem", „Archivsystem", „Buchhaltungssoftware" | generische SAP-FI/DocuWare-Aliasse → KI-2 |
| pain_point (high) | Zeitdruck Monatsabschluss (Verdichtung); hoher Aufwand Mahnlauf/offene Posten; manuelle Prüfung jeder Unstimmigkeit | mehrfach redundant erfasst |
| pain_point (medium) | Rechnungen ohne Bestellbezug → Recherche über 3 Systeme (~1 h/Woche); Excel-Nachpflege Sonderfälle; individuelle Korrektur ohne Schema | deckt Persona-pain_points ab |

## Befunde

1. **Runner-Gate FAIL: `dialog_naturalness = 0.33` < 0.65.** Entscheidender Befund. Der Judge bewertet die Agent-Fragen als abrupt und themenspringend, ohne konversationelle Anbindung an die vorige Antwort („generische Übergänge, abrupte Themensprünge zwischen Belegen, Software, Zeitaufwand und Fehlerquoten ohne natürliche Verbindung"). **Regression gegenüber dem Lauf 2026-06-21 (gemini-3.1-flash-lite): dort 0.67 → PASS, hier 0.33 → FAIL.** Einziger geänderter Faktor ist `INTERVIEW_MODEL` (Talker+Analyst) = `gemini-3.5-flash`. Die Gesprächsführung von 3.5-flash als Talker ist hier schlechter, nicht besser.

2. **KI-6-Divergenz bestätigt (manuelle Kriterien vs. Runner-Gate).** Nach den manuellen Schritt-4-Kriterien des Skills wäre der Lauf **PASS**: status `completed`, 3 Schritte mit Status `walkthrough` (≠ exploring), tazite O-Slots (entscheidungslogik/ausnahmen) gefüllt, kein leerer DB-`agent_response`, keine Dreifachwiederholung. Das Runner-Gate sagt **FAIL** wegen `dialog_naturalness`. Genau die in INDEX.md als KI-6 getrackte Divergenz — Schritt-4-Kriterien kennen das naturalness-Gate nicht. **Quelle der Wahrheit für Regressionstracking ist das Runner-Gate → der Lauf zählt als FAIL.**

3. **Leerer Talker-Turn.** In der Live-Loop gab es einen Turn mit leerer Agent-Frage (`[Agent]: ""`, im Transcript bei „Turn 2" sichtbar) direkt nach der ersten Belegbearbeitungs-Antwort („Der Prozess beginnt mit dem Eingang der Dokumente…"). Diese Persona-Antwort wurde nicht als eigener DB-Turn persistiert; der Analyst hat ihren Inhalt jedoch in S002 (belegbearbeitung: process_steps + slots) verarbeitet. **Kein Datenverlust für die Extraktion, aber ein leerer Talker-Output ist ein Robustheits-/Regressionssignal** — vermutlich ebenfalls 3.5-flash-Talker-bezogen.

4. **`tazite_cues` (O2) durchgängig null.** Über alle drei Schritte leer. Bemerkenswert: Der Agent stellte in Turn 18 eine explizite tazite-Wissensfrage („Woran erkennst du … schon auf den ersten Blick, dass ein Beleg fehlerhaft ist") und erhielt eine reiche Antwort (Format-/Stammdaten-Unregelmäßigkeiten, Betragsplausibilität, Turn 19) — diese wurde aber **nicht** in `tazite_cues` geschrieben. Extraktionslücke des Analysten.

5. **Kein Schritt erreichte `done`.** Alle drei blieben `walkthrough`. Erfüllt das Schritt-4-Kriterium (≠ exploring), aber kein Schritt wurde formal abgeschlossen.

6. **Persona-Inkonsistenz (Tester-Artefakt, nicht Agent).** Turn 2: Die Persona antwortet über Monatsabschluss, obwohl der Agent nach Belegbearbeitung fragte — verletzt die Persona-Tendenz „beantwortet nur den tatsächlich erfragten Prozess". Tester-Modell-Quirk (gemini-3.1-flash-lite). **Trägt zur schlechten naturalness bei**, weil der Themensprung dem Agenten angelastet wird, obwohl die Persona ihn auslöste.

7. **KI-2 (KO-Tool-Duplikation) unverändert präsent.** SAP FI ×4, DocuWare ×2, Excel ×2 als separate `tool`-Records plus generische Aliasse („Buchhaltungssystem", „Archivsystem", „Buchhaltungssoftware"). Bekanntes Issue, kein Dedup auf KO-Ebene.

8. **`overwrite_churn = 0.36` (Ziel < 0.20) und `confidence_trigger_rate = 0.6` (Ziel > 0.80) off-target.** Der 3.5-flash-Analyst revidiert Slot-Werte häufiger und triggert Confidence-Nachfragen seltener als erwünscht — konsistent mit dem Bild eines Modells, das anders priorisiert als das Lite-Baseline.

9. **Inhaltlich starker, gesprächlich schwacher Lauf.** Positiv: `slot_coverage 0.78`, `schema_conformance_rate 1.0`, `hallucination_rate 0`, `step_registration_coverage 1.0`, `tool_call_plausibility 0.96`, `depth_score 1.73`, dichte potenzial-Facette (frequency/duration/error_rate/media_breaks weitgehend gefüllt). Der latente Mahnprozess wurde in Turn 7 aktiv aufgegriffen und als S001 (forderungsmanagement) registriert. **Die Schwäche liegt ausschließlich in der Gesprächsführung (naturalness), nicht in der Extraktion.**

### Gesamtfazit für den Modellvergleich (PROJ-13)

`gemini-3.5-flash` als Talker/Analyst liefert **gleichwertige bis starke Extraktions- und Schema-Qualität**, aber eine **klare Regression der Gesprächskohärenz** (dialog_naturalness 0.67 → 0.33) plus einen leeren Talker-Turn. Für den Talker bleibt `gemini-3.1-flash-lite` vorzuziehen; ein Split (Analyst 3.5-flash, Talker Lite via `INTERVIEW_TALKER_MODEL`) wäre der nächste sinnvolle Vergleichslauf. Langfuse-Spans via `eval_run_id=2999827b-0807-4890-8372-cacab8927a24` filterbar.
