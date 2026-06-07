---
interview_model: anthropic/claude-haiku-4-5
tester_model: anthropic/claude-haiku-4-5
talker_model: anthropic/claude-haiku-4-5
talker_thinking_budget: 512
analyst_model: anthropic/claude-haiku-4-5
analyst_thinking_budget: 2048
eval_date: 2026-06-04
persona: buchhalter
interview_id: d9a61acf-c0a2-48e2-89a1-2afe285a6503
eval_run_id: 5909f5f4-d6ed-4e7d-a115-642631e2a12a
langfuse_session: https://cloud.langfuse.com/cmppie8jr0401ad0jrjwau83m/cmppiehkh035jad0e7i4d9jkm/sessions/d9a61acf-c0a2-48e2-89a1-2afe285a6503
turns_total: 35
status: FAIL
baseline_label: null
scores:
  slot_coverage: 1
  dedup_slot_coverage: 1
  phase_progression: 0.4
  phase_adherence: 0.9
  anchoring_violations: 1
  tool_call_plausibility: 0.71
  dialog_naturalness: 0.5
  completion_correctness: false
  step_registration_coverage: 0.5
---

## Quality Scores

| Metrik | Score | Ziel |
|--------|-------|------|
| slot_coverage | 1 | maximize |
| dedup_slot_coverage | 1 | maximize |
| phase_progression | 0.4 | maximize |
| phase_adherence | 0.9 | maximize |
| anchoring_violations | 1 | 0 |
| tool_call_plausibility | 0.71 | ≥ 0.80 |
| dialog_naturalness | 0.5 | maximize |
| completion_correctness | false | true |
| step_registration_coverage | 0.5 | 1.0 |

## Gesprächsverlauf

[Turn 1] Persona: Guten Tag, ich freue mich auch, dass wir das heute dokumentieren. Mein Alltag dreht sich hauptsächlich um die Rechnungsprüfung — das ist die dominierende Aufgabe. Ich empfange eingehende Rechnungen per E-Mail, prüfe sie auf Vollständigkeit und Korrektheit, buche sie dann in unser Buchhaltungssystem und lege sie im Dokumentenmanagement ab. Je nach Betrag ist auch eine Freigabe durch einen Kollegen erforderlich.

Daneben kümmere ich mich um verschiedene Ad-hoc-Anfragen aus dem operativen Geschäft — Kostenstellen-Zuordnungen, Rückfragen von Lieferanten, kleinere Korrektionen. Und am Monatsende wird es intensiv: Da führe ich die Abstimmung durch, kümmere mich um Rückstellungen und bereite alles für die Übergabe an das Controlling vor. Das ist die Phase, wo ich unter Zeitdruck arbeite.
[Turn 1] Agent: "Danke für den Überblick — das hilft mir sehr. Ich sehe, dass die Rechnungsprüfung dein Kerngeschäft ist und der Monatsabschluss eine intensive Phase. 

Lass mich mit der Rechnungsprüfung starten, da das deine Hauptaufgabe ist: Wie viele Rechnungen bekommst du durchschnittlich pro Woche rein, und wie lange brauchst du typischerweise, um eine Rechnung von Empfang bis Buchung komplett zu bearbeiten?"

[Turn 2] Persona: Das variiert natürlich je nach Rechnungstyp und Komplexität. Im Schnitt bearbeite ich zwischen 20 und 25 Rechnungen pro Woche — manche sind in 10–15 Minuten erledigt, wenn alles vorliegt und korrekt ist, andere kosten mich deutlich länger. Das größte Problem sind Rechnungen ohne Bestellreferenz oder mit fehlenden Informationen: Da muss ich dann in drei verschiedenen Systemen recherchieren, um den richtigen Auftraggeber und die passende Kostenstelle zu finden — das kann schnell eine oder sogar zwei Stunden dauern, je nachdem wie verworren die Unterlagen sind. Hinzu kommen regelmäßig Diskrepanzen bei Beträgen oder Steuersätzen, die ich manuell prüfen und teilweise korrigieren muss, bevor ich buche.
[Turn 2] Agent: "Gut — das ist konkret. Also 20–25 Rechnungen pro Woche, im Schnitt 10–15 Minuten bei sauberen Daten, aber bis zu 1–2 Stunden bei fehlenden Infos.

Lass mich das präzisieren: Von deinen 20–25 Rechnungen pro Woche — wie viele davon sind typischerweise "sauber" (alles vorhanden, keine Recherche nötig), und wie viele erfordern diese längere Recherche in den drei Systemen?"

[Turn 3] Persona: Grundsätzlich gilt: Die Mehrzahl der Rechnungen kommt relativ sauber rein — ich würde sagen, etwa drei Viertel haben alle notwendigen Informationen und Referenzen. Das restliche Viertel, also ungefähr fünf bis sechs Rechnungen pro Woche, zwingt mich dann zu dieser Recherche-Odyssee durch die verschiedenen Systeme. Das klingt nach einer kleinen Quote, aber in der Summe kostet mich das deutlich mehr Zeit, als wenn alle Rechnungen standardisiert einlaufen würden.
[Turn 3] Agent: "Danke — das ist sehr hilfreich. Also etwa 75 % sauber, 25 % mit Recherche-Aufwand. Das summiert sich.

Jetzt zur Freigabe: Bei welchen Beträgen greift die Freigabe durch deinen Kollegen ein, und wie lange dauert dieser Freigabeprozess typischerweise?"

[Turn 4] Persona: Bei Rechnungen ab 5.000 EUR aufwärts ist eine Zweit-Freigabe erforderlich — das ist die formale Regel. Der Prozess selbst läuft relativ zügig ab: Ich leite die Rechnung weiter, mein Kollege prüft sie, und im Normalfall kommt die Freigabe innerhalb von ein bis zwei Tagen zurück. Das Problem tritt auf, wenn mein Kollege Fragen hat oder selbst Unstimmigkeiten feststellt — dann kann sich der Prozess hinziehen, und ich sitze mit der ungebuchten Rechnung fest, bis die Klärung erfolgt ist. Das passiert bei etwa fünf Prozent der freigabepflichtigen Rechnungen und führt dann zu unnötigen Wartezeiten.
[Turn 4] Agent: "Verstanden — ab 5.000 EUR Freigabe erforderlich, normalerweise 1–2 Tage, aber bei etwa 5 % der Fälle Verzögerungen durch Rückfragen.

Eine schnelle Frage dazu: Wie viele Rechnungen pro Woche fallen in diese Freigabe-Kategorie (also ab 5.000 EUR)?"

[Turn 5] Persona: Da muss ich ehrlich sagen: Das ist schwer pauschal zu beziffern, weil es stark von der jeweiligen Woche abhängt — manche Wochen habe ich drei bis vier solcher größeren Rechnungen, andere Wochen nur eine oder zwei. Im Durchschnitt über mehrere Monate würde ich schätzen, dass etwa 10–15 Prozent meines wöchentlichen Rechnungsvolumens in diese Freigabe-Kategorie fällt, also grob zwei bis drei Rechnungen pro Woche. Bei Großaufträgen oder zum Quartalsende kann das aber deutlich höher ausfallen.
[Turn 5] Agent: "Danke — also grob 2–3 Rechnungen pro Woche ab 5.000 EUR, mit Spitzen zum Quartalsende.

Jetzt zur Ablage im Dokumentenmanagement: Passiert das automatisch nach der Buchung, oder musst du die Rechnungen manuell hochladen und verschlagworten?"

[Turn 6] Persona: Bei der Ablage im Dokumentenmanagement bin ich auf manuelle Schritte angewiesen — das läuft nicht automatisiert ab. Nach der Buchung muss ich die Rechnung selbst hochladen und mit den relevanten Metadaten verschlagworten: Lieferantennummer, Rechnungsdatum, Betrag, Kostenstelle. Das ist zeitlich überschaubar — fünf bis zehn Minuten pro Rechnung — aber es ist ein zusätzlicher Handgriff, den ich bei jeder einzelnen Rechnung durchführen muss. Wenn die Anbindung zwischen unserem Buchhaltungssystem und dem Dokumentenmanagement besser wäre, könnte ich mir da einige Stunden pro Woche sparen.
[Turn 6] Agent: "Klar — also 5–10 Minuten manuelle Ablage pro Rechnung, weil die Systeme nicht gekoppelt sind. Das summiert sich.

Bleiben wir bei der Rechnungsprüfung: Du hast erwähnt, dass du bei fehlenden Infos in drei verschiedenen Systemen recherchierst. Welche drei Systeme sind das, und in welcher Reihenfolge fragst du sie ab?"

[Turn 7] Persona: Bei der Recherche gehe ich systematisch vor: Zuerst schaue ich in unser Beschaffungssystem nach der Bestellung und dem zugehörigen Auftraggeber, dann prüfe ich im Stammdatensystem die Lieferantendaten und die hinterlegten Kostenstellen, und falls ich dort nicht fündig werde, greife ich auf historische Buchungen in unserem Buchhaltungssystem zurück — da kann ich oft ähnliche frühere Transaktionen desselben Lieferanten finden und daraus die korrekte Zuordnung ableiten. Die Reihenfolge hat sich über die Jahre bewährt, weil die ersten beiden Systeme in etwa 80 Prozent der Fälle die Antwort liefern, und nur bei wirklich kniffligen Fällen muss ich in die Historie ausweichen.
[Turn 7] Agent: "Gut — also Beschaffungssystem → Stammdatensystem → Buchhaltungs-Historie, und in 80 % der Fälle reichen die ersten beiden aus.

Eine konkrete Frage dazu: Wenn du in diesen drei Systemen recherchierst — machst du das parallel (alle drei gleichzeitig offen), oder sequenziell (erst System 1, dann 2, dann 3)?"

[Turn 8] Persona: Ich arbeite sequenziell vor — ich öffne also erst das Beschaffungssystem, recherchiere dort, und nur wenn ich dort keine befriedigende Antwort finde, wechsle ich zum Stammdatensystem. Das hat sich pragmatisch bewährt, weil es mir hilft, den Überblick zu behalten und nicht in drei offenen Systemen gleichzeitig verloren zu gehen. Parallel alle drei zu öffnen würde mich eher verwirren, als dass es mich schneller macht. Und wie gesagt: In den meisten Fällen bin ich ja nach den ersten beiden Systemen fertig.
[Turn 8] Agent: "Perfekt — sequenziell ist klar und nachvollziehbar.

Jetzt zur Monatsabschluss-Phase, die du als intensiv beschrieben hast: Wann startet diese Phase für dich, und wie lange dauert sie insgesamt?"

[Turn 9] Persona: Beim Monatsabschluss starte ich in der Regel am letzten Arbeitstag des Monats — da laufe ich alle offenen Posten zusammen, prüfe die Abstimmung zwischen den einzelnen Konten und fahre dann parallel mit der Buchung von Rückstellungen fort. Die Phase dauert für mich insgesamt zwei bis drei Tage intensive Arbeit, je nachdem wie viele Unstimmigkeiten es gibt oder wie viele Ad-hoc-Positionen in dieser Phase noch reinkommmen. Das ist definitiv die anspruchsvollste Zeit im Monat, weil ich parallel zur laufenden Rechnungsbearbeitung auch noch diese Abschlussarbeiten durchziehe — das führt immer zu Zeitdruck.
[Turn 9] Agent: "Verstanden — also Start am letzten Arbeitstag, 2–3 Tage intensive Arbeit, und der Zeitdruck kommt durch die Parallelität zur laufenden Rechnungsbearbeitung.

Eine präzisierende Frage: Wenn du von "zwei bis drei Tagen" sprichst — sind das zwei bis drei volle Arbeitstage, oder eher zwei bis drei Tage mit jeweils einigen Stunden Abschlussarbeit neben der normalen Rechnungsbearbeitung?"

[Turn 10] Persona: Das sind tatsächlich zwei bis drei volle Arbeitstage, in denen ich praktisch nur am Abschluss sitze — die normale Rechnungsbearbeitung läuft in dieser Phase faktisch auf Eis, weil der Abschluss Vorrang hat. Am letzten Tag des Monats und dann noch ein bis zwei Tage danach bin ich vollständig mit Abstimmungen, Rückstellungsbuchungen und der Vorbereitung der Übergabe ans Controlling beschäftigt, und selbst dann landen neue Rechnungen in meinem Postfach, die ich nicht einfach ignorieren kann — was zusätzlich zu diesem Zeitdruck führt. Idealerweise würde ich diese Abschlussphase nur auf Abschlussarbeit konzentrieren können, ohne dass mir laufend neue Anforderungen dazwischenkommen.
[Turn 10] Agent: "Danke — also tatsächlich 2–3 volle Tage, wo der Abschluss Vorrang hat, aber neue Rechnungen treffen trotzdem ein und können nicht ignoriert werden. Das ist ein echter Engpass.

Lass mich das konkretisieren: In dieser Abschlussphase (2–3 Tage) — wie viele neue Rechnungen landen typischerweise in deinem Postfach, die du parallel noch bearbeiten musst?"

[Turn 11] Persona: Im Rahmen der Abschlussphase landen durchschnittlich zwischen fünf und zehn neue Rechnungen in meinem Postfach — das klingt nicht nach viel, aber bedenke: Ich bin mental vollständig im Abschluss-Modus, und diese Rechnungen unterbrechen meinen Workflow ständig. Jede Unterbrechung kostet mich Zeit beim Wechsel zwischen den Aufgaben, und manche dieser eintreffenden Rechnungen erfordern ja wieder diese aufwändige Recherche in den verschiedenen Systemen. Am Ende sind es nicht die Menge, sondern die Unterbrechungen und die kognitiven Kosten des Kontextwechsels, die diese Phase zusätzlich unter Druck setzen.
[Turn 11] Agent: "Danke — also 5–10 Rechnungen während der 2–3 Tage Abschluss, und der Schmerz ist weniger die Menge als der Kontextwechsel selbst.

Jetzt zur Abstimmung, die du erwähnt hast: Was genau prüfst du bei dieser Abstimmung zwischen den einzelnen Konten — vergleichst du Salden mit einem Vorsystem, prüfst du auf offene Posten, oder etwas anderes?"

[Turn 12] Persona: Für die Abstimmung überprüfe ich in erster Linie die offenen Posten — also alle Rechnungen, die noch nicht bezahlt sind, gegen die Buchhaltung und gegen die Lieferantenstammdaten. Ich gleiche auch die Kontosalden mit dem Vormonat ab, um sicherzustellen, dass keine Buchungen verloren gegangen sind oder doppelt gebucht wurden. Hinzu kommt die Kontrolle auf Ausnahmen: Fehlende Kostenstellen, falsche Steuersätze oder Betragsdifferenzen, die ich während des Monats notiert habe — diese dokumentiere ich in Excel und kümmere mich um die manuelle Nachpflege, bevor ich den Abschluss freigebe. Das ist der zeitintensivste Teil, weil vieles davon nicht automatisiert läuft.
[Turn 12] Agent: "Klar — also offene Posten gegen Buchhaltung und Stammdaten, Kontosalden-Vergleich zum Vormonat, und dann manuell Ausnahmen in Excel nachpflegen. Das ist nachvollziehbar.

Eine konkrete Frage dazu: Diese Ausnahmen, die du in Excel dokumentierst — wie viele sind das typischerweise pro Monatsabschluss, und wie lange brauchst du für die manuelle Nachpflege insgesamt?"

[Turn 13] Persona: Das ist eine gute Frage. Im Durchschnitt sammeln sich pro Monatsabschluss etwa 15 bis 20 solcher Ausnahmefälle an — das sind dann Positionen mit fehlenden Kostenstellen, Betragsdifferenzen oder falschen Steuerkennzeichen, die ich während des Monats notiert habe. Die manuelle Nachpflege dieser Fälle kostet mich dann insgesamt zwischen drei und fünf Stunden, je nachdem wie knifflig die einzelnen Fälle sind und ob ich wieder recherchieren muss oder ob es sich um reine Korrekturbuchungen handelt. Das ist ein erheblicher Posten in der Abschlussphase und einer der Gründe, warum diese Phase unter so großem Zeitdruck läuft.
[Turn 13] Agent: "Danke — also 15–20 Ausnahmefälle pro Monat, 3–5 Stunden Nachpflege insgesamt. Das ist tatsächlich ein großer Brocken in der Abschlussphase.

Jetzt zu den Rückstellungen, die du auch erwähnt hast: Wie viele Rückstellungen buchst du typischerweise pro Monatsabschluss, und nach welchen Kriterien entscheidest du, ob und in welcher Höhe eine Rückstellung erforderlich ist?"

[Turn 14] Persona: Für die Rückstellungen arbeite ich nach einem Katalog, den das Controlling vorgegeben hat — ich prüfe also nach festgelegten Kriterien, welche bekannten Verpflichtungen noch nicht fakturiert sind und welche Risiken oder verzögerten Lieferungen bestehen. Typischerweise buche ich pro Abschluss zwischen fünf und acht Rückstellungen, je nachdem wie viele offene Leistungen oder Verzögerungen es in diesem Monat gegeben hat. Die Höhe richtet sich meist nach den Angeboten der Lieferanten oder historischen Durchschnittswerten — bei größeren oder unklareren Positionen stimme ich mich mit dem Einkauf oder Controlling ab, bevor ich die Buchung durchführe.
[Turn 14] Agent: "Danke — also 5–8 Rückstellungen pro Monat nach Controlling-Katalog, Höhe nach Lieferantenangaben oder Historie, und bei größeren Positionen Abstimmung mit Einkauf/Controlling.

Jetzt zur Übergabe ans Controlling: Was genau übergibst du, und in welcher Form — ist das ein Report, eine Excel-Datei, oder ein strukturiertes Dokument?"

[Turn 15] Persona: Die Übergabe ans Controlling erfolgt in mehreren Komponenten: Ich stelle einen standardisierten Report aus unserem Buchhaltungssystem zusammen, der alle Salden und offenen Posten abbildet, ergänze das Ganze um eine Excel-Datei mit den Ausnahmefällen und Rückstellungen — damit die Kollegen dort genau nachvollziehen können, welche manuellen Korrektionen ich vorgenommen habe und warum — und übergebe dann noch eine kurze schriftliche Zusammenfassung mit den wichtigsten Auffälligkeiten des Monats. Das hat sich bewährt, weil es dem Controlling ermöglicht, schnell in die Daten einzusteigen und bei Rückfragen direkt auf meine Dokumentation zuzugreifen.
[Turn 15] Agent: "Gut — also drei Komponenten: Standardreport aus Buchhaltungssystem, Excel mit Ausnahmefällen und Rückstellungen, schriftliche Zusammenfassung. Das ist strukturiert.

Eine kurze Frage dazu: Wie lange brauchst du insgesamt, um diese drei Komponenten zusammenzustellen und an Controlling zu übergeben?"

[Turn 16] Persona: Für die Zusammenstellung dieser drei Komponenten brauche ich typischerweise zwischen zwei und vier Stunden — der Report selbst läuft relativ zügig, aber die Excel-Datei mit den Ausnahmefällen erfordert sorgfältige Dokumentation, und die schriftliche Zusammenfassung muss ich mir Zeit nehmen, um wirklich alle relevanten Punkte abzudecken. Bei komplexeren Monaten, wo es mehr Unstimmigkeiten gibt oder ich nochmal nachrecherchieren muss, kann es auch länger dauern — dann rutsche ich leicht in fünf bis sechs Stunden. Das ist ein beträchtlicher Aufwand am Ende einer bereits strapaziösen Phase, und hier würde ich mir ebenfalls deutlich mehr Automatisierung wünschen.
[Turn 16] Agent: "Danke — also 2–4 Stunden für die Zusammenstellung, bei komplexeren Monaten bis zu 5–6 Stunden. Das ist ein großer Block am Ende einer bereits intensiven Phase.

Jetzt zu den Ad-hoc-Anfragen aus dem operativen Geschäft, die du anfangs erwähnt hast: Wie oft pro Woche landen solche Anfragen bei dir, und welche drei Typen sind am häufigsten?"

[Turn 17] Persona: Zu den Ad-hoc-Anfragen kann ich dir sagen: Die landen durchschnittlich täglich mehrmals bei mir — hauptsächlich per E-Mail oder Telefon aus dem Einkauf, dem Controlling oder der Projektabwicklung. Die drei häufigsten Typen sind erstens Rückfragen zur Kostenstellen-Zuordnung, weil ein Projekt oder eine Abteilung wissen möchte, ob eine bestimmte Rechnung auf ihrer Kostenstelle gebucht wurde, zweitens Lieferanten-Unstimmigkeiten — da ruft jemand an und sagt, eine Rechnung ist nicht ankommen oder es gibt eine Doppelbuchung — und drittens kurzfristige Auskunftsanfragen zu historischen Transaktionen, wenn beispielsweise das Controlling ad hoc einen Jahresvergleich braucht. Diese Anfragen unterbrechen meinen Workflow ständig, und obwohl jede einzelne vielleicht nur 15–30 Minuten kostet, summiert sich das zu einem erheblichen zeitlichen Overhead, der die Konzentration bei der eigentlichen Rechnungsbearbeitung kostet.
[Turn 17] Agent: "Danke — also täglich mehrmals, hauptsächlich E-Mail und Telefon, drei Haupttypen: Kostenstellen-Zuordnung, Lieferanten-Unstimmigkeiten, historische Auskunftsanfragen. Jede einzeln 15–30 Minuten, aber der kumulative Effekt auf deine Konzentration ist erheblich.

Eine präzisierende Frage: Von diesen täglichen Ad-hoc-Anfragen — wie viele davon könnten deiner Einschätzung nach durch bessere Dokumentation oder Self-Service (z.B. ein durchsuchbares Archiv) von den Anfragern selbst beantwortet werden, statt dich zu unterbrechen?"

[Turn 18] Persona: Wenn ich mir das realistisch anschaue: Ich denke, etwa die Hälfte dieser Anfragen könnte durch eine bessere Selbstbedienung gelöst werden — besonders die Kostenstellen-Fragen und die historischen Abfragen würden sich erledigen, wenn es ein durchsuchbares, zentrales Archiv gäbe, wo Kollegen selbst nachschlagen könnten, welche Rechnungen auf welcher Kostenstelle liegen. Bei den Lieferanten-Unstimmigkeiten ist es kniffliger, weil da oft eine echte Recherche oder Klärung nötig ist, aber auch da könnte eine bessere Transparenz über den Status einer Rechnung viele Anrufe sparen. Das Problem ist nur: Solange jeder manuell in drei verschiedenen Systemen rumsuchen muss wie ich, ist auch Self-Service unrealistisch — das System muss erst mit besserer Anbindung oder Datenqualität vorbereitet sein.
[Turn 18] Agent: "Sehr realistisch — also etwa die Hälfte wäre durch Self-Service lösbar, wenn es ein durchsuchbares zentrales Archiv gäbe. Aber du hast recht: Das setzt voraus, dass die Datenqualität und Systemanbindung stimmen.

Gut — ich habe jetzt einen soliden Überblick über deine Kernaufgaben. Lass mich noch einen Punkt konkretisieren, bevor wir in die Details der einzelnen Schritte gehen: Bei der Rechnungsprüfung selbst — folgt dein Prüfprozess immer dem gleichen Schema (z.B. erst Bestellreferenz prüfen, dann Betrag, dann Steuersatz), oder entscheidest du von Fall zu Fall, in welcher Reihenfolge du was prüfst?"

[Turn 19] Persona: Bei der Prüfung selbst arbeite ich nach einem etablierten Schema, das sich über die Jahre bewährt hat: Ich starte immer damit, die Bestellreferenz und den Lieferanten zu verifizieren, dann prüfe ich den Leistungszeitraum gegen die Bestellung, danach vergleiche ich den Rechnungsbetrag mit dem erwarteten Betrag, und abschließend kontrolliere ich die Steuersätze und Kostenstellen. Diese Reihenfolge ist nicht willkürlich — sie folgt einer Logik, weil ich früh feststellen kann, ob ich überhaupt die richtige Rechnung vor mir habe, bevor ich mich in die Details verliere. Nur bei Ausnahmefällen, wo ich etwa weiß, dass ein Lieferant chronisch fehlerhafte Steuersätze liefert, passe ich die Priorisierung an und prüfe das erst — aber im Normalfall bleibt die Reihenfolge konsistent.
[Turn 19] Agent: "Perfekt — also ein etabliertes, konsistentes Schema mit logischer Reihenfolge, und nur bei bekannten Problemlieferanten Priorisierungsanpassung. Das ist sehr strukturiert.

Jetzt eine konkrete Frage zur Praxis: Bei dieser Bestellreferenz-Verifizierung am Anfang — wie oft stellst du fest, dass die Bestellreferenz auf der Rechnung fehlt oder falsch ist, und wie gehst du dann vor?"

[Turn 20] Persona: Beim Verifizieren der Bestellreferenz stelle ich fest, dass etwa jede vierte Rechnung entweder gar keine Referenz trägt oder die angegebene Referenz nicht eindeutig zuordenbar ist — das ist genau jener Punkt, wo meine Recherche-Odyssee durch die drei Systeme losgeht, die ich vorhin beschrieben habe. In solchen Fällen gehe ich dann sequenziell vor: Ich suche zunächst im Beschaffungssystem nach dem Lieferanten und dem ungefähren Leistungszeitraum, um die passende Bestellung zu identifizieren, und wenn das nicht reicht, nutze ich die Lieferantenstammdaten und schließlich die historischen Buchungen als Fallback. Das kostet mich dann die besagte Zeit, die ich sonst sparen würde.
[Turn 20] Agent: "Danke — also etwa jede vierte Rechnung hat keine oder mehrdeutige Bestellreferenz, und das triggert die Recherche-Odyssee. Das deckt sich mit deinem früheren Punkt zu den 25 % problematischen Rechnungen.

Jetzt zur nächsten Phase: Nach dieser Verifizierung prüfst du ja den Leistungszeitraum gegen die Bestellung. Wie oft stellst du dabei fest, dass der Leistungszeitraum nicht mit der Bestellung übereinstimmt — und was machst du dann?"

[Turn 21] Persona: Grundsätzlich gilt: Die meisten Rechnungen haben einen Leistungszeitraum, der mit der Bestellung übereinstimmt — das ist eher die Ausnahme als die Regel. Aber wenn ich Unstimmigkeiten feststelle — etwa dass die Rechnung Leistungen aus einem anderen Zeitraum abdeckt oder die Bestellung selbst mehrere Positionen mit unterschiedlichen Leistungszeiten enthält — dann muss ich mit dem Lieferanten oder dem internen Auftraggeber klären, ob das beabsichtigt ist oder ob wir hier eine Teilrechnung oder eine abweichende Leistung haben. In etwa fünf bis zehn Prozent der Fälle führt das zu einer Rückfrage, bevor ich die Rechnung buchen kann — das verzögert die Bearbeitung, und ich dokumentiere solche Fälle dann in meinen Ausnahmefällen.
[Turn 21] Agent: "Danke — also in 5–10 % der Fälle Unstimmigkeiten beim Leistungszeitraum, die zu Rückfragen führen und später in deine Ausnahmefälle wandern.

Jetzt zu einem praktischen Detail: Bei dieser gesamten Rechnungsprüfung — druckst du die Rechnung aus, oder arbeitest du komplett digital am Bildschirm?"

[Turn 22] Persona: Ich arbeite komplett digital — das Ausdrucken von Rechnungen würde ja nur zusätzliche Schritte bedeuten und passt nicht zu unseren digitalen Workflows. Die Rechnung kommt per E-Mail rein, ich öffne sie im PDF-Viewer und arbeite parallel mit den verschiedenen Systemen am Bildschirm: SAP FI auf einer Seite, die Rechnung auf der anderen, und bei Bedarf noch das Beschaffungssystem oder DocuWare dazu. Stift und Papier brauche ich höchstens für schnelle Notizen zu Unstimmigkeiten, die ich dann in meine Ausnahmefälle-Tabelle übernehme — aber der eigentliche Prüfprozess spielt sich vollständig digital ab.
[Turn 22] Agent: "Gut — also komplett digital, PDF-Viewer + SAP FI parallel, bei Bedarf Beschaffungssystem/DocuWare dazu, Notizen nur für Ausnahmefälle. Das ist klar.

Jetzt zur Buchung selbst: Nachdem du die Rechnung geprüft hast — wie viele Buchungssätze brauchst du typischerweise pro Rechnung, und sind das immer die gleichen Kontotypen, oder variiert das je nach Rechnungstyp?"

[Turn 23] Persona: Im Normalfall brauche ich pro Rechnung einen einzelnen Buchungssatz — Lieferantenverbindlichkeit gegen Aufwandskonto oder Bestandskonto, je nachdem ob es sich um einen laufenden Betriebsaufwand oder um Material handelt. Bei Standard-Rechnungen läuft das also sehr geradlinig ab. Komplizierter wird es bei Sammelrechnungen oder bei Positionen, die über mehrere Kostenstellen verteilt werden müssen — dann kann ich auf fünf bis sechs Buchungssätze kommen, weil ich jede Kostenstelle einzeln abbilden muss. Das ist auch der Punkt, wo ich am liebsten eine bessere Verteilungslogik im System hätte, statt manuell zu splitteln.
[Turn 23] Agent: "Danke — also normalerweise ein Buchungssatz, aber bei Sammelrechnungen oder Multi-Kostenstellen-Verteilung bis zu 5–6 Sätze, weil du manuell splitten musst. Das ist ein echter Reibungspunkt.

Eine konkrete Frage dazu: Bei diesen Sammelrechnungen mit mehreren Kostenstellen — wie oft kommt das vor, und wie lange dauert diese manuelle Aufteilung typischerweise?"

[Turn 24] Persona: Bei Sammelrechnungen mit mehreren Kostenstellen bin ich ehrlich gesagt froh, dass das nicht die Norm ist — ich würde sagen, das trifft auf etwa zehn bis 15 Prozent meiner wöchentlichen Rechnungen zu, hauptsächlich bei größeren Lieferanten, die für mehrere Abteilungen oder Projekte gleichzeitig liefern. Die manuelle Aufteilung selbst kostet mich dann zusätzliche 20 bis 30 Minuten pro Rechnung, weil ich erst recherchieren muss, wie die Positionen auf die verschiedenen Kostenstellen verteilt werden sollen — da hilft mir oft nur ein Anruf beim Auftraggeber oder ein Blick in die zugehörigen Bestellungen. Das summiert sich zu einem erheblichen Zeitverlust, den ich mir gerne sparen würde.
[Turn 24] Agent: "Danke — also 10–15 % der Rechnungen sind Sammelrechnungen mit Multi-Kostenstellen, und die kosten zusätzliche 20–30 Minuten pro Rechnung wegen der Recherche und oft auch Rückfragen beim Auftraggeber.

Jetzt zur Freigabe selbst — wenn du eine Rechnung ab 5.000 EUR zur Freigabe weiterleitest: Machst du das manuell per E-Mail, oder gibt es einen strukturierten Workflow im System dafür?"

[Turn 25] Persona: Die Freigabe läuft derzeit noch manuell ab — ich versende die freigabepflichtigen Rechnungen per E-Mail an meinen Kollegen, mit einer kurzen Zusammenfassung der wichtigsten Daten und eventuellen Auffälligkeiten. Ein strukturierter Workflow im System existiert nicht, was bedeutet, dass ich den Überblick über den Status einer freigabepflichtigen Rechnung nur manuell behalte — wenn die E-Mail im Postfach verlorengeht oder mein Kollege vergisst zu antworten, kann das leicht übersehen werden. Idealerweise hätten wir hier ein Task-Management oder einen integrierten Genehmigungsworkflow im Buchhaltungssystem selbst, der Freigaben nachverfolgbar und transparent macht.
[Turn 25] Agent: "Danke — also komplett manuell per E-Mail, keine strukturierte Workflow im System, und das führt zu Risiken wie verlorenen E-Mails oder vergessenen Antworten. Das ist ein echter Schwachpunkt.

Jetzt zur Dokumentenablage: Du hast erwähnt, dass du Rechnungen manuell hochlädst und verschlagwortest. Passiert das direkt nach der Buchung, oder sammelst du die Rechnungen und machst die Ablage in Batches?"

[Turn 26] Persona: Ich handhabe das eher pragmatisch: Ich versuche, die Ablage zeitnah nach der Buchung durchzuführen — idealerweise am selben Tag — weil ich gemerkt habe, dass das Risiko von Verwechslungen oder vergessenen Dokumenten zu groß wird, wenn ich sie sammle. Allerdings passiert es in der Praxis oft, dass sich die Ablage bis zum nächsten Tag verschiebt, wenn ich mit mehreren Rechnungen gleichzeitig jongliere oder wenn Ad-hoc-Anfragen dazwischenkommen. Batch-Processing würde effizienter sein, aber ich bevorzuge die sofortige Ablage, weil ich dann sichergehe, dass wirklich jede Rechnung archiviert ist und ich keine übersehe.
[Turn 26] Agent: "Verstanden — also Idealfall: zeitnah nach Buchung am selben Tag, aber in der Praxis oft Verschiebung auf den nächsten Tag wegen Parallelaufgaben und Ad-hoc-Anfragen. Du bevorzugst sofortige Ablage, um Verwechslungen zu vermeiden.

Jetzt eine konkrete Frage zur Ablage selbst: Wenn du eine Rechnung hochlädst und verschlagwortest — machst du das komplett manuell (Datei auswählen, Metadaten eintippen), oder gibt es Vorlagen oder automatische Vorausfüllungen, die dir helfen?"

[Turn 27] Persona: Im Rahmen der Ablage arbeite ich größtenteils manuell — ich wähle die Datei aus, navigiere zu den richtigen Metadaten-Feldern und tippe die relevanten Informationen ein: Lieferantennummer, Rechnungsdatum, Betrag, Kostenstelle. Es gibt da keine intelligenten Vorausfüllungen oder Vorlagen, die mir den Prozess vereinfachen würden — das ist einer der Punkte, wo ich mir eine stärkere Automation wünschen würde. Idealerweise könnte das System die Metadaten aus der bereits gebuchten Rechnung automatisch übernehmen und mir nur noch eine Bestätigung abnehmen, statt dass ich alles von Hand neu eingeben muss. Das würde mir die besagten fünf bis zehn Minuten pro Rechnung erheblich sparen.
[Turn 27] Agent: "Danke — also komplett manuell, keine Vorausfüllungen, und du wünschst dir automatische Übernahme der Metadaten aus der bereits gebuchten Rechnung mit Bestätigungsschritt statt Neueingabe. Das ist ein echter Reibungspunkt.

Jetzt zu einem praktischen Detail bei dieser Ablage: Wenn du die Metadaten eintippst — nutzt du dafür eine Maske im Dokumentenmanagement-System selbst, oder tippst du in separate Felder ein?"

[Turn 28] Persona: Bei der Eingabe der Metadaten arbeite ich mit einer Maske direkt im Dokumentenmanagement-System — da gibt es vorgegebene Felder für Lieferantennummer, Rechnungsdatum, Betrag und Kostenstelle, die ich ausfülle. Das ist zwar strukturiert, aber eben nicht intelligent: Das System könnte diese Daten ja aus der bereits gebuchten Rechnung in SAP FI einfach übernehmen und mich nur noch zur Bestätigung auffordern, statt dass ich sie ein zweites Mal manuell eingeben muss. Das wäre der Knackpunkt für mehr Effizienz — die Daten sind ja bereits im System vorhanden, nur eben in einem anderen Modul, und die beiden Systeme "sprechen" nicht miteinander.
[Turn 28] Agent: "Genau — also eine strukturierte Maske im DMS, aber ohne Datenübernahme aus SAP FI. Das ist die klassische Datenredundanz.

Gut — ich habe jetzt einen sehr soliden Überblick über deine Rechnungsprüfung und die Monatsabschluss-Phase. Lass mich jetzt noch einen Punkt konkretisieren, bevor wir in die Details der einzelnen Schritte gehen: Bei den Rückstellungen, die du pro Monatsabschluss buchst — sind das immer die gleichen Rückstellungstypen (z.B. immer Wareneingang ohne Rechnung), oder variiert das je nach Monat?"

[Turn 29] Persona: Bei den Rückstellungstypen gibt es durchaus ein Grund-Repertoire, das sich wiederholt — hauptsächlich Wareneingang ohne Rechnung, ausstehende Dienstleistungen und verzögerte Lieferungen mit bekannten Kosten — aber die genaue Zusammensetzung und Gewichtung variiert je nach Monat erheblich. Manche Monate sind geprägt von Großprojekten, bei denen plötzlich mehrere Positionen ausstehen, andere Monate sind eher operativ ruhig. Hinzu kommen saisonale Schwankungen — zum Beispiel am Jahresende typischerweise deutlich mehr Rückstellungen für Services, die noch nicht abgerechnet sind. Der Controlling-Katalog gibt mir die Struktur vor, aber die konkrete Füllung passt sich ständig an die Geschäftstätigkeit an.
[Turn 29] Agent: "Danke — also ein Grund-Repertoire (Wareneingang ohne Rechnung, ausstehende Dienstleistungen, verzögerte Lieferungen), aber Zusammensetzung und Gewichtung variieren je nach Geschäftstätigkeit und Saisonalität. Das ist nachvollziehbar.

Jetzt eine konkrete Frage dazu: Bei dieser Entscheidung, ob und in welcher Höhe eine Rückstellung erforderlich ist — machst du das rein nach dem Controlling-Katalog, oder gibt es auch Fälle, wo du mit deinem Bauchgefühl oder Erfahrungswerten arbeitest, weil der Katalog nicht eindeutig ist?"

[Turn 30] Persona: Bei der Entscheidung zur Rückstellungshöhe halte ich mich primär an den Controlling-Katalog und die dort vorgegebenen Kriterien — das ist die sichere Variante und sorgt für Konsistenz über die Monate hinweg. Allerdings gibt es tatsächlich Grenzfälle, wo der Katalog nicht eindeutig ist oder wo ich aus meiner langjährigen Erfahrung weiß, dass bestimmte Lieferanten chronisch verspätet liefern oder ihre Preise nachträglich anpassen — in solchen Situationen verlasse ich mich durchaus auf mein Erfahrungswissen und setze die Rückstellung etwas vorsichtiger an, als der reine Katalog vielleicht vorgeben würde. Das ist dann immer der Punkt, wo ich mit dem Controlling abstimme, bevor ich die Buchung durchführe — ich dokumentiere das transparent, damit klar ist, dass hier eine Erfahrungsentscheidung getroffen wurde und nicht nur eine Katalog-Anwendung.
[Turn 30] Agent: "Danke — also primär nach Katalog für Konsistenz, aber bei Grenzfällen nutzt du Erfahrungswissen und stimmst dich mit Controlling ab, dokumentierst das transparent. Das ist ein sehr reflektierter Ansatz.

Jetzt zu einem praktischen Detail, das ich noch klären möchte: Bei dieser gesamten Rechnungsprüfung und Buchung — wie oft wechselst du zwischen verschiedenen Systemen hin und her, und gibt es Momente, wo du etwas ausdrucken oder notieren musst, um den Überblick zu behalten?"

[Turn 31] Persona: Bei einer Standard-Rechnung ohne Komplikationen halte ich die Systemwechsel minimal — ich habe SAP FI und die PDF der Rechnung offen und arbeite relativ linear durch. Aber sobald ich bei der Bestellreferenz-Verifizierung feststelle, dass etwas fehlt oder mehrdeutig ist, beginnt das Hin- und Herwechseln: Dann öffne ich zusätzlich das Beschaffungssystem, springe zu den Lieferantenstammdaten, möglicherweise auch in die Historie von SAP FI — je nach Fall sind das fünf bis sechs System-Fenster gleichzeitig. Notizen brauche ich in solchen Fällen tatsächlich, um nicht den Überblick zu verlieren — ich halte mir schnell auf einem Zettel fest, welche Bestellung ich gefunden habe, welche Kostenstelle dazugehört, und welche Unstimmigkeiten es gibt. Diese Notizen wandern dann später in meine Ausnahmefälle-Tabelle, aber ohne diesen Zwischenschritt würde ich schnell verwirren, wenn ich zwischen drei Systemen hin- und herspringend recher
[Turn 31] Agent: "Danke — das ist sehr konkret. Also bei Standard-Rechnungen minimal Wechsel, aber bei mehrdeutigen Bestellreferenzen bis zu 5–6 Fenster gleichzeitig, und du brauchst Notizen auf Papier, um nicht den Überblick zu verlieren.

Ich sehe, dass wir schon eine gute Stunde zusammen sind und ich einen sehr soliden Überblick über deine Kernprozesse habe. Lass mich jetzt noch zwei kurze Punkte klären, dann fassen wir zusammen:

**Erste Frage:** Bei dieser Monatsabschluss-Phase mit den 15–20 Ausnahmefällen, die du nachpflegst — wie viele davon sind typischerweise "einfache" Korrekturbuchungen (z.B. nur Kostenstelle anpassen), und wie viele erfordern wieder diese Recherche-Odyssee in den Systemen?"

[Turn 32] Persona: Wenn ich mir die 15 bis 20 Ausnahmefälle pro Abschluss anschaue: Etwa zwei Drittel davon sind tatsächlich "einfache" Korrekturbuchungen — ich muss also nur eine Kostenstelle anpassen, einen falschen Steuersatz korrigieren oder eine offensichtliche Betragsdifferenz ausbügeln. Das geht relativ zügig. Aber das restliche Drittel, also fünf bis sieben Fälle pro Monat, erfordert wieder diese tiefere Recherche: Da muss ich nochmal in die Systeme gehen, um beispielsweise eine fehlerhafte Lieferantenzuordnung zu klären oder herauszufinden, warum eine Rechnung doppelt gebucht wurde. Diese Fälle sind es dann auch, die einen großen Teil jener drei bis fünf Stunden Nachpflege-Zeit verschlingen, die ich vorhin erwähnt habe.
[Turn 32] Agent: "Danke — also etwa zwei Drittel einfache Korrekturbuchungen (schnell), aber ein Drittel (5–7 Fälle/Monat) erfordert wieder tiefere Recherche und Systemnavigation. Das erklärt, warum die Nachpflege-Phase so zeitintensiv ist.

Gut — ich habe jetzt einen sehr umfassenden Überblick über deine Prozesse. Lass mich das zusammenfassen und dann noch zwei kurze Punkte klären:

**Deine Kernaufgaben im Überblick:**
- **Rechnungsprüfung:** 20–25/Woche, 75 % sauber (10–15 Min), 25 % mit Recherche (bis 2h)
- **Freigabe ab 5.000 EUR:** ~2–3/Woche, normalerweise 1–2 Tage, 5 % mit Verzögerungen
- **Dokumentenablage:** 5–10 Min/Rechnung, manuell, keine Automation
- **Monatsabschluss:** 2–3 volle Tage, 15–20 Ausnahmefälle, 3–5h Nachpflege, 2–4h Übergabe ans Controlling
- **Ad-hoc-Anfragen:** täglich mehrmals, ~50 % könnten durch Self-Service gelöst werden

**Zwei abschließende Fragen:**

1. **Zeitbudget pro Woche:** Wenn du deine wöchentliche Arbeitszeit auf diese Aufgaben aufteilst — wie viel Prozent geht in die Rechnungsprüfung, wie viel in Ad-hoc-Anfragen, und wie viel in sonstige Aufgaben?

2. **Größter Schmerz:** Wenn du eine Sache ändern könntest — was wäre es? Die Systemanbindung (DMS ↔ SAP), die Datenqualität bei Eingang, oder etwas ganz anderes?"

[Turn 33] Persona: Danke für die präzise Zusammenfassung — das trifft den Kern wirklich gut.

Zur **Zeitbudget-Frage**: Ich würde sagen, die Rechnungsprüfung — also die eigentliche Prüfung, Buchung und Ablage zusammen — nimmt etwa 60–65 Prozent meiner wöchentlichen Zeit in Anspruch. Die Ad-hoc-Anfragen und Unterbrechungen schlagen mit etwa 20–25 Prozent zu Buche, auch wenn diese Prozentangabe schwer zu messen ist, weil die Anfragen ja ständig dazwischenkommen und nicht in einem Block anfallen. Der Rest, also 10–15 Prozent, entfällt auf sonstige Aufgaben — Reporting-Anfragen, interne Schulungen, oder Abweichungen vom normalen Rhythmus.

Zum **größten Schmerz**: Das ist eigentlich eine Kombination aus zwei eng verwobenen Problemen. Die Systemanbindung zwischen DMS und SAP ist tatsächlich frustrierend — die Datenredundanz kostet mich kontinuierlich Zeit. Aber ehrlich gesagt
[Turn 33] Agent: "Danke für die klare Antwort — 60–65 % Rechnungsprüfung, 20–25 % Ad-hoc-Anfragen, 10–15 % sonstiges. Das ist sehr hilfreich.

Und zum größten Schmerz — du hast angefangen zu sagen, es ist eine Kombination. Lass mich das zu Ende denken: Ist es die Systemanbindung selbst, oder ist es eher die **Datenqualität beim Eingang** (also dass Rechnungen ohne Bestellreferenz ankommen), die das ganze Problem erst verursacht?"

[Turn 34] Persona: Sehr gute Unterscheidung — du hast da den Kern getroffen. Wenn ich ganz ehrlich bin, ist die **Datenqualität beim Eingang das Wurzelproblem**. Die fehlenden oder mehrdeutigen Bestellreferenzen, die unvollständigen Lieferantendaten — das ist es, was mich zwingt, überhaupt erst in diese Recherche-Odyssee zu gehen. Die mangelhafte Systemanbindung zwischen DMS und SAP ist dann eher ein **nachgelagertes Effizienz-Problem**: Sie kostet mir Zeit, aber wenn die Datenqualität beim Eingang stimmig wäre, könnte ich ohnehin schneller arbeiten und hätte weniger Ausnahmefälle zu dokumentieren.

Also: Wenn ich nur eine Sache ändern könnte, würde ich beim **Lieferanten ansetzen** — sicherstellen, dass jede eingehende Rechnung zwingend eine eindeutige Bestellreferenz trägt und dass die Stammdaten vollständig sind. Das würde mir sofort ein Viertel meiner wöchentlichen Recherche-Zeit sparen und würde auch die Fehlerquote
[Turn 34] Agent: "Perfekt — das ist die klare Priorisierung: **Datenqualität beim Eingang ist das Wurzelproblem**, nicht die Systemanbindung. Wenn Bestellreferenzen und Stammdaten stimmen würden, fiele ein großer Teil der Recherche weg.

Das ist sehr wertvoll für die Analyse.

---

Gut — ich habe jetzt einen sehr umfassenden Überblick über deine Prozesse und die echten Schmerzpunkte. Lass mich das noch kurz strukturieren und dann schließen wir ab:

**Was ich erfasst habe:**

✓ Rechnungsprüfung: 20–25/Woche, 75 % Standard (10–15 Min), 25 % mit Recherche (bis 2h)
✓ Freigabe ab 5.000 EUR: ~2–3/Woche, 1–2 Tage, 5 % Verzögerungen
✓ Dokumentenablage: manuell, 5–10 Min/Rechnung, keine Automation
✓ Monatsabschluss: 2–3 volle Tage, 15–20 Ausnahmefälle, 3–5h Nachpflege
✓ Ad-hoc-Anfragen: täglich mehrmals, 20–25 % deiner Zeit
✓ Zeitbudget: 60–65 % Rechnungsprüfung, 20–25 % Ad-hoc, 10–15 % sonstiges
✓ **Primärer Schmerz: Datenqualität beim Eingang** (fehlende/mehrdeutige Bestellreferenzen)

**Zwei kurze Abschlussfragen, dann sind wir durch:**

1. Gibt es noch einen Prozessschritt oder ein wiederkehrendes Problem, das ich übersehen habe?
2. Für die Dokumentation: Wie heißt du, und wie lange bist du schon in dieser Rolle?"

[Turn 35] Persona: Danke der Nachfrage — lass mich noch kurz überlegen, ob ich etwas Wichtiges vergessen habe.

Eigentlich ja: Ich habe den **Mahnprozess** bei unseren Ad-hoc-Anfragen noch nicht aktiv erwähnt, obwohl der regelmäßig anfällt. Das sind Rückfragen an Lieferanten, wenn Rechnungen zu lange ausstehen oder wenn wir Zahlungen verbuchen müssen, die nicht eindeutig zugeordnet sind — das kostet mich monatlich noch eine bis zwei Stunden zusätzliche Zeit, die ich in meiner ursprünglichen Aufzählung eher unterschätzt habe. Das sollte vielleicht noch mit in die Dokumentation, weil es ein wiederkehrendes Reibungsthema ist.

Ansonsten halte ich meine Zusammenfassung für vollständig — die drei Kernprozesse (Rechnungsprüfung, Monatsabschluss, Ad-hoc-Anfragen) und ihre Schmerzpunkte sind damit erfasst.

Zur **Dokumentation**: Mein Name ist **Andreas Meier**, und ich bin seit **
[Turn 35] Agent: "Danke, Andreas — das ist sehr hilfreich. Der **Mahnprozess** bei ausstehenden Rechnungen und mehrdeutigen Zahlungen (1–2 Stunden/Monat) ist tatsächlich ein wichtiger Punkt, den ich noch erfassen sollte.

Und danke, dass du dich Zeit genommen hast — das war ein sehr strukturiertes und präzises Interview. Ich habe jetzt einen sehr soliden Überblick über deine Kernprozesse, die Zeitbudgets und vor allem die echten Schmerzpunkte.

---

**Abschließend noch eine kurze Frage zur Vollständigkeit:**

Bei diesem **Mahnprozess** — initiierst du die Rückfragen selbst (weil du merkst, dass eine Rechnung zu lange ausstehen), oder kommen die Anfragen von außen (z.B. vom Einkauf oder Controlling)?"

## Slot-Filling-Stand

| Schritt | Status | frequency | duration | rule_based | data_sources | error_rate | media_breaks |
|---------|--------|-----------|----------|------------|--------------|------------|--------------|
| Rechnungsprüfung: Eingang, Validierung und Buchung | done | 92 ✓ | 12.5 ✓ | true ✓ | E-Mail,Buchhaltungssystem,Doku ✓ | 7.5 ✓ | null |
