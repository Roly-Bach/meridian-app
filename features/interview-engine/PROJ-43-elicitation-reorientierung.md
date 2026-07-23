# PROJ-43: Elicitation-Reorientierung (AI-Treiber, Zahlen→Cards)

## Status: Architected
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-29
**Appetite:** XL (>3 Tage)
**Bugs:** —
**Created:** 2026-07-22
**Last Updated:** 2026-07-23

## Context

PROJ-43 ist Strom 3 der Refactoring-Grundsatzentscheidung vom 2026-07-15 (realer "Tim"-Interviewdurchlauf, siehe PROJ-42). Kern-Befund: das Forced-Choice-Pattern ("Eher 5 Minuten oder eher 20 Minuten?", eingeführt in PROJ-29/BL-E3.4 nach einem Eval-Fund 2026-06-23) ist ein Anchoring-Risiko (KI-21) und reagiert blind auf Unsinn/Nicht-Antworten (KI-25). Gleichzeitig zeigte PROJ-46s QA-Runde 3 (H-1b): selbst mit bindendem Fokus-Lock waren 33% der Interview-Fragen reine Metrik-Nachfragen (frequency/duration/Forced-Choice) statt AI-Wert-Faktoren — das ist die dokumentierte Wurzel des "flachen Abschlusses", den PROJ-46s Completion-Mechanismus korrekt, aber inhaltlich zu früh auslöst.

Gleichzeitig ist Quantifizierung nicht verzichtbar: die PRD-Erfolgsmetrik verlangt `ROI = frequency × duration × hourly_rate × reduction_rate`, und `useCaseEngine.ts` nutzt heute harte Zahlen-Schwellenwerte (`frequency >= 20`, `error_rate_percent >= 10`, `media_breaks >= 3`, `duration >= 30`) für die Use-Case-Heuristiken; `roi_eur_per_year` wird `null`, sobald `frequency` oder `duration` fehlt. Das ist der aktuelle Ist-Zustand des nachgelagerten Konsumenten, keine für PROJ-43 fixierte Vorgabe — `useCaseEngine.ts` gehört zur Use-Case-Engine-Domain und wird vermutlich unabhängig überarbeitet; PROJ-43 stellt nur sicher, dass die Interview-Engine-seitige Erhebung nicht strukturell auf eine ROI-Lücke hinausläuft, unabhängig davon wie `useCaseEngine.ts` die Zahlen später verwendet.

PROJ-43 verschiebt daher nicht das OB der Quantifizierung, sondern Kanal und Priorität — und zwar unterschiedlich, je nachdem WELCHER AI-Wert-Faktor betroffen ist. Alle vier Potenzial-Felder (`frequency`/`duration`/`error_rate_percent`/`media_breaks`) sind selbst AI-Wert-Faktoren, keine "bloßen Metriken" im Gegensatz dazu — aber für sie zählt im LIVE-Gespräch nur die grobe Richtung (ein Priorisierungssignal: welcher Schritt verdient Tiefe), nicht der exakte Zahlenwert; die Präzisierung passiert strukturiert über Clarification Cards nach dem Gespräch, mit einem harten Completion-Gate. Bei den qualitativen AI-Wert-Faktoren (`aufgabentyp`/`risiko_schwere`/`reibungspunkte`/`ausloeser`) dagegen gibt es keine Zahl, die man aufschieben könnte — hier IST die qualitative Tiefe der Ertrag, den das Gespräch über Treiber-/WHY-Fragen liefern muss. Beide Verschiebungen zusammen sollen die in PROJ-46s H-1b-Befund dokumentierte 33%-Metrik-Nagging-Zeit (buchhalter, 4 Läufe, 58 Fragen: 59% O-Feld / 33% Potenzial-Metrik / 9% Discovery) zugunsten der AI-Wert-Faktor-Fragen verschieben.

PROJ-43 bündelt außerdem zwei bereits als PROJ-43-Straddle dokumentierte Nebenbefunde: M-4 (Clarification Cards feuern in der Praxis fast nie, `clarification_coverage_delta` 0 in 4/4 Eval-Läufen über PROJ-44/46) und M-1 aus der PROJ-45-QA (Dauer wird manchmal als Monats-Aggregat statt Pro-Vorgang genannt und dann als Pro-Vorgang-Wert fehlinterpretiert — ROI-Überzählung).

## Dependencies

- **Requires: PROJ-45** (Schema-Konsolidierung + AI-Wert-Faktoren) — Deployed. Liefert `aufgabentyp`/`risiko_schwere`/`reibungspunkte`/`ausloeser` als Zielfelder für AC6 sowie die `einheit`-Pflicht, auf der die Dauer-Disambiguierung (AC7) aufbaut.
- **Requires: PROJ-46** (Talker-Briefing-Konsolidierung) — In Review. Liefert den bindenden Fokus-Lock (`target_o_field`) und `resolveTurnLifecycle`, auf denen AC2 (Richtungssignal→Fokus) und AC4 (Completion-Gate) aufbauen. PROJ-42/44/46 bleiben gemeinsam In Review bis zum Joint-Gate nach PROJ-43.
- **Extends: PROJ-29** (Gesprächsführungs-Revision) — revidiert das dort eingeführte Forced-Choice-Pattern (BL-E3.4) direkt.
- **Touches: PROJ-44** (Pipeline-Simplifikation) — Completion-Gate (AC4) erweitert die dort bereits Cards-aware gemachte Trigger-A-Logik in `resolveTurnLifecycle` um eine aktive Erzwingung statt nur Respektierung bestehender Cards.
- **Spinnt ab: PROJ-47** (Clarification-Card-Generierung entkoppeln, LLM-Teil) — bewusst ausgeklammerte Folgearbeit aus dieser Architektur-Runde (2026-07-23), siehe Tech Design Abschnitt F.

## User Stories

- Als Mitarbeiter (interviewte Person) möchte ich nicht wiederholt zu exakten Zahlen gedrängt werden, wenn ich sie nicht kenne, damit das Gespräch natürlich bleibt und ich nicht das Gefühl habe, geprüft zu werden.
- Als Mitarbeiter möchte ich stattdessen die Möglichkeit haben, grob eine Richtung anzugeben (oft/selten, lange/kurz), damit meine Unsicherheit nicht dazu führt, dass die Information ganz verloren geht.
- Als Mitarbeiter möchte ich am Ende des Interviews die Möglichkeit haben, präzise Zahlen nachzutragen — entweder als genaue Zahl/Spanne oder als grobe Kategorie —, damit ich in Ruhe nachdenken kann statt live unter Druck zu antworten.
- Als KI-Berater möchte ich, dass das Gespräch mehr Zeit auf die qualitativen AI-Wert-Faktoren (Aufgabentyp, Risiko, Reibungspunkte, Auslöser) verwendet und weniger auf das Nachfragen exakter Zahlenwerte (die ohnehin in die Cards wandern), damit die Use-Case-Ableitung auf reichhaltigeren Daten basiert.
- Als KI-Berater möchte ich, dass jedes Interview vor Abschluss verlässlich eine Card-Runde für fehlende quantitative Pflichtangaben durchläuft, damit die ROI-Berechnung nicht strukturell auf null fällt.
- Als Head of Operations möchte ich, dass die erhobene Dauer korrekt zwischen Pro-Vorgang und Zeitraum-Aggregat unterscheidet, damit die ROI-Hochrechnung nicht systematisch verzerrt wird.

## Acceptance Criteria

### AC1 — Forced-Choice-Pattern entfernt, neue Live-Turn-Sequenz für quantitative Slots
- [ ] Für `frequency`, `duration`, `error_rate_percent`: Talker stellt zunächst eine offene Frage ohne vorgeschlagene Zahlen.
- [ ] Weicht der Mitarbeiter aus (keine extrahierbare Zahl — egal ob explizite Verweigerung oder qualitative Umschreibung, auch bei kategorischer Ablehnung exakter Zahlen wie "Ich nenne grundsätzlich keine Zahlen") — stellt der Talker eine Richtungsfrage ohne vom Talker vorgeschlagene Zahlen (z.B. "Ist das eher etwas, das oft vorkommt, oder eher selten?"). Zahlen-Verweigerung ist keine Richtungs-Verweigerung — die Richtungsfrage wird immer versucht.
- [ ] Weicht der Mitarbeiter auch bei der Richtungsfrage aus, akzeptiert der Talker sofort und geht weiter — kein dritter Versuch, kein Forced-Choice an irgendeiner Stelle im Ablauf.
- [ ] Das bestehende Forced-Choice-Pattern ("Eher 5 Minuten oder eher 20 Minuten?") ist vollständig aus `talkerPrompt.ts` entfernt (KI-21/KI-25 strukturell behoben, nicht nur dokumentiert).
- [ ] Der bestehende Akzeptanz-Phrasen-Pool bleibt erhalten, greift aber erst nach dem finalen Ausweich-Schritt (Richtungsfrage), nicht mehr direkt nach der ersten offenen Frage.

### AC2 — Richtungssignal steuert Fokus und Card-Zuschnitt
- [ ] Eine in Schritt 2 (Richtungsfrage) erfasste Tendenz (z.B. "eher selten", "zieht sich lange") fließt in die Fokus-/Tiefensteuerung ein — Schritte mit erkennbar hoher Bedeutung (oft/lange/fehleranfällig) werden nicht schwächer priorisiert als unauffällige Schritte, nur weil keine exakte Zahl vorliegt.
- [ ] Wird später (Closing-Phase) eine Clarification Card für denselben Slot generiert, spiegeln deren Bucket-Optionen die erfasste Richtung wider (z.B. bei "eher selten" feinere Buckets im niedrigen Bereich statt der pauschalen Buckets).
- [ ] Ohne erfasstes Richtungssignal (Mitarbeiter wich schon bei der Richtungsfrage komplett aus) zeigt die Card die bisherigen generischen Buckets.

### AC3 — Zwei-Wege-Eingabe in Clarification Cards
- [ ] Jede SlotCard für `frequency`/`duration`/`error_rate_percent` bietet dem Mitarbeiter zwei gleichwertige Eingabewege: (a) eine freie Zahlen- oder Spannen-Eingabe, (b) eine Bucket-Auswahl (richtungs-zugeschnitten laut AC2 oder generisch).
- [ ] Der Mitarbeiter wählt frei, welchen Weg er nutzt — kein erzwungener Vorrang eines Wegs.
- [ ] Bestehende Spannen-Erfassung im Live-Gespräch ("80 bis 100") bleibt unverändert (Mittelwert + `qualifier`, PROJ-45-Verhalten).

### AC4 — Hartes Completion-Gate für Card-Runde
- [ ] Ein Interview erreicht `completed` nicht, solange mindestens ein registrierter Prozessschritt einen leeren Pflicht-Slot (`frequency`/`duration`/`error_rate_percent`) hat, ohne dass für diesen Schritt eine Clarification-Card-Runde erzeugt UND durchlaufen wurde.
- [ ] Eine durchlaufene Card-Runde erfüllt das Gate unabhängig vom Ergebnis — auch wenn der Mitarbeiter dort "Weiß ich nicht" wählt oder ein Feld leer lässt (wird als `nicht_befund_typ='unbekannt'` gewertet). Keine Wiederholungsschleife, kein KI-23-artiges Non-Termination-Risiko.
- [ ] Der bestehende Hard-Timer/Wall-Clock-Anker (PROJ-42) betrifft ausschließlich das aktive Gespräch (die Turn-Loop vor Closing) — die Card-Runde selbst hat kein eigenes Zeitlimit, wird immer vollständig angezeigt sobald sie ausgelöst wurde, und ist ein unbefristeter, selbstbestimmter UI-Schritt (unverändert gegenüber heute).
- [ ] Late-Discovery-Schritte (kurz vor oder während Closing entdeckt) werden von der Card-Suche vollständig erfasst — kein Schritt wird durch Timing der Entdeckung vom Gate ausgenommen.
- [ ] Priorisierung bei Erreichen der Card-Obergrenze (max. 8, unverändert): gate-blockierende numerische Slots (`frequency`/`duration`/`error_rate_percent`) gehen deterministisch vor generischen QualitativeCards; unter den numerischen Slots entscheidet das Richtungssignal aus AC2 (Schritte mit erfasster hoher Ausprägung zuerst) statt der heutigen, nicht weiter spezifizierten "Use-Case-Relevanz"-Formulierung im Analyst-Prompt.

### AC5 — Card-Generierung zuverlässig (M-4)
- [ ] Clarification Cards werden zuverlässig generiert, sobald Phase `closing` erreicht ist und mindestens ein Pflicht-Slot eines registrierten Schritts leer ist — verifiziert über mehrere `/eval:interview`-Läufe (`clarification_coverage_delta` > 0 wo Pflicht-Slots fehlen), nicht nur über einen Einzellauf.
- [ ] Root-Cause der heutigen Nicht-Auslösung wird im Rahmen von `/backend` diagnostiziert (diese Spec macht keine Vorgabe zum Mechanismus).

### AC6 — Treiber-/WHY-Framing für AI-Wert-Faktoren
- [ ] Zielt der Fokus-Lock auf ein AI-Wert-Feld (`reibungspunkte`, `ausloeser`, oder ein Feld das die `aufgabentyp`/`risiko_schwere`-Klassifikation speist), formuliert der Talker eine Ursachen-/Treiberfrage statt einer reinen Beschreibungsfrage — indirekt formuliert ("Woran liegt es, dass...", "Was macht das an dieser Stelle..."), nie als direktes "Warum...?", das im Deutschen leicht vorwurfsvoll wirkt.
- [ ] Signalisiert die Richtungsfrage (AC2) bei `duration`/`error_rate_percent` eine hohe Ausprägung ("zieht sich lange", "passiert oft Fehler"), löst das gezielt eine Treiberfrage zu `reibungspunkte` für denselben Schritt aus (z.B. "Woran liegt es, dass sich das zieht?") — die Richtung selbst bleibt ein reines Priorisierungssignal (AC2), die Ursachen-Frage liefert den eigentlichen qualitativen Ertrag.
- [ ] Diese Umstellung ist eine Talker-Methodik-Regel, kein neuer Slot und keine neue Analyst-Klassifikationslogik.

### AC7 — Dauer-Erhebung unterscheidet Pro-Vorgang vs. Aggregat (M-1)
- [ ] Die offene Frage nach `duration` klärt explizit, ob die genannte Zeit pro einzelnem Vorgang oder als Aggregat über einen Zeitraum gemeint ist (z.B. "15 Std/Monat" vs. "10 Minuten pro Rechnung").
- [ ] Bleibt das nach einer gezielten Nachfrage weiterhin uneindeutig, wird **nicht geraten oder umgerechnet** — der Slot bleibt `null` und geht als Pflicht-Slot in die Closing-Card, die den Kontext ("pro Vorgang" vs. "insgesamt") explizit klarstellt.

### AC8 — Gesprächszeit verschiebt sich messbar weg von Metrik-Nachfragen
- [ ] Der Anteil an Talker-Fragen, die auf einen quantitativen Slot (`frequency`/`duration`/`error_rate_percent`) zielen, sinkt gegenüber der PROJ-46-H-1b-Baseline (33% von 58 Fragen, buchhalter) messbar zugunsten von AI-Wert-Faktor-Fragen (`aufgabentyp`/`risiko_schwere`/`reibungspunkte`/`ausloeser`) und Discovery-Fragen.
- [ ] Verifiziert per Transkript-Klassifikation der Pflicht-Eval-Läufe (gleiche manuelle Frage-Kategorisierung wie im H-1b-Befund), nicht nur per Aggregat-Score — dies ist die zusammenfassende, funktionsübergreifende Messgröße für AC1+AC6 zusammen.

## Edge Cases

- **Kategorische Zahlen-Verweigerung**: Richtungsfrage wird trotzdem gestellt (AC1) — Verweigerung exakter Zahlen ist keine Verweigerung einer Richtung.
- **Ambiguität jeder Art** (Pro-Vorgang/Aggregat, Richtung unklar): nie raten oder umrechnen — immer an die Card weiterreichen (AC7, gilt analog für jede andere im Live-Gespräch auftretende Ambiguität).
- **Mehrere leere Pflicht-Slots im selben Schritt oder mehr als 8 Card-Kandidaten insgesamt**: siehe AC4-Priorisierungsregel (numerisch vor generisch, Richtungssignal als Tie-Breaker).
- **Spontane Zahlennennung ohne Nachfrage**: wird wie bisher direkt übernommen, keine Richtungsfrage/Card nötig.
- **Späte Prozess-Entdeckung nahe Closing**: Card-Suche erfasst den Schritt vollständig (AC4), unabhängig vom Entdeckungszeitpunkt.
- **Mitarbeiter bricht die Card-Runde ab / schließt Browser**: bestehende Persistenz-/Reconnect-Mechanik (PROJ-22/46) bleibt unverändert zuständig — kein neues Verhalten in dieser Spec.
- **Historische Interviews (vor PROJ-43)**: reine Verhaltens-/Prompt-Änderung ohne neues Pflichtfeld — bestehende `normalizeStepEntry`-Rückwärtskompatibilität deckt alte `step_tracker`-Daten weiterhin ab.

## Out of Scope

- `media_breaks` und `abhaengigkeiten` bleiben rein abgeleitet (nicht live erfragt) — unverändert seit der ursprünglichen Strom-3-Entscheidung. Begründung erneut geprüft (2026-07-22): "Medienbruch" ist Fachjargon, den ein Mitarbeiter nicht zuverlässig selbst beziffert, die Rohdaten (welche Systeme, welche Reihenfolge) kommen bereits über `hilfsmittel`; `abhaengigkeiten` ist strukturell Cross-Step-Reasoning (PROJ-26-Territorium), keine natürliche Einzelfrage. Escape-Hatch: erweist sich die Ableitung bei `/qa` als unzuverlässig, fängt die bestehende generische QualitativeCard das opportunistisch auf — keine neue Live-Frage, kein neuer dedizierter Card-Typ dafür in dieser Spec.
- Dedizierte Card-Typen (eigene `SLOT_OPTIONS`-Buckets) für die neuen PROJ-45-Felder (`reibungspunkte`/`ausloeser`/`aufgabentyp`/`risiko_schwere`) — heute hat nur `frequency`/`duration`/`entscheidungslogik`/`error_rate_percent` eine feste Bucket-Form ([ClarificationCards.tsx:9-14](../../src/components/interview/ClarificationCards.tsx#L9)). Diese Felder sollen laut AC6 primär live gefüllt werden; die bestehende generische QualitativeCard bleibt unverändert als Auffangmechanismus, kein neuer dedizierter Card-Typ in dieser Spec.
- M-3-Rest (Themen-Ping-Pong über den Fokus-Lock hinaus) — laut PROJ-46-QA-Runde-3 bereits transkript-verifiziert behoben (M-6). Kein eigenes AC hier, wird bei `/qa PROJ-43` neu gemessen statt vorab eingeplant.
- Bucket-zu-Zahl-Konvertierung für Heuristik-Schwellenwerte in `useCaseEngine.ts` (falls die Card-Antwort ein Bucket statt einer Zahl ist) — nachgelagertes Use-Case-Engine-Thema, nicht Interview-Engine-Scope dieser Spec.
- `outputs` (O4) und `abhaengigkeiten` (O6) — laut PROJ-46-Caveat wird die Elicitations-Tiefe hier durch PROJ-43 NICHT vollständig gelöst. Konkret: `outputs` braucht eine beschreibende Frage ("Was kommt am Ende raus?"), keine Ursachen-/WHY-Frage — AC6s Treiber-Framing hilft hier strukturell nicht. `abhaengigkeiten` ist Cross-Step-Reasoning (welcher Schritt hängt von welchem ab), keine natürliche Frage an eine Einzelperson, PROJ-26-Scope. Beide bleiben nach PROJ-43 voraussichtlich weiterhin dünn — das ist bei `/qa` erwartetes Verhalten, kein Regressionsbefund.
- Neue DB-Spalten oder Migrationen — das Richtungssignal aus AC2 lebt ausschließlich im Gesprächsverlauf und im bestehenden `next_briefing`-JSON-Feld (bereits heute für z.B. `usedFillerPhrases` genutzt) — kein neues Persistenzfeld, keine Migration, kein Approval-Gate nach general.md nötig.
- Eval-Instrument-Fragen (Nenner-Effekt von `dedup_slot_coverage`, ob Cards/`dependency_capture` überhaupt ins Gate gehören) — PROJ-40-Scope.
- Neue Eval-Judges/Eval-Metriken — bestehende Scorer werden verwendet, keine neuen.

## Komplexitätsreduktion (Löschkandidaten)

PROJ-43 hat wie PROJ-44/45/46 explizit auch das Ziel, Mechanik abzubauen, die durch die neue Live-Sequenz überflüssig wird — nicht nur neue Mechanik hinzuzufügen. `/backend`/`/codebase-design` prüft mindestens:

- **`usedFillerPhrases`/`detectFillerPhrases`** ([interviewTalker.ts:89](../../src/services/interviewTalker.ts#L89), `talkerPrompt.ts`, `interviewTypes.ts`): der Akzeptanz-Phrasen-Pool wird laut AC1 künftig erst nach der Richtungsfrage ausgelöst, nicht mehr direkt nach der ersten offenen Frage — PROJ-46 markierte dieses Tracking bereits explizit als an den "Forced-Choice-/Akzeptanz-Phrasen-Pool (PROJ-43)" gekoppelten Löschkandidaten. Hier verifizieren, ob die Wiederholungs-Vermeidung nach dem Umbau noch in dieser Form gebraucht wird oder vereinfacht werden kann.
- **`conversationSignals.ts`s `question-stem`-Detektor** (`repeatedQuestionStem`, KI-15): ebenfalls von PROJ-46 als Löschkandidat markiert ("verify by eval that question repetition doesn't return before deleting this module outright"). Die neue, auf maximal zwei Versuche gedeckelte Live-Sequenz (AC1) sollte das ursprüngliche Wiederholungsmuster ("Wie oft"/"Wie lange" zweimal hintereinander) strukturell reduzieren — hier per Eval verifizieren, ob `conversationSignals.ts` danach komplett entfällt.
- **Bestehender Forced-Choice-/Ausweich-Textblock in `STATIC_PROMPT`** ([talkerPrompt.ts:19-30](../../src/services/talkerPrompt.ts#L19)): wird durch AC1 ohnehin ersetzt — im selben Zug auf die neue, kürzere Zwei-Schritt-Logik eindampfen statt nur Forced-Choice-Sätze zu streichen und den Rest stehen zu lassen (deckt sich mit dem in PROJ-46 etablierten Deslop-Prinzip).

## Technical Requirements

- Betroffene Dateien (laut bisherigem Design-Stand, endgültige Aufteilung folgt `/architecture`): `talkerPrompt.ts` (Live-Sequenz, WHY-Framing, Forced-Choice-Entfernung), `interviewAnalyst.ts` (Card-Generierungslogik, M-1-Disambiguierung), `interviewOrchestrator.ts`/`resolveTurnLifecycle` (Completion-Gate), `ClarificationCards.tsx`/`SLOT_OPTIONS` (Zwei-Wege-UI).
- **`AnalystBriefing` muss geprüft werden**, ob es ein neues ephemeres Feld braucht, um das in einem Live-Turn erfasste Richtungssignal bis zur Card-Generierung in der Closing-Phase zu tragen (analog dem bestehenden `next_briefing`-Bridge-Muster wie `usedFillerPhrases`/O-Drought) — ohne dieses Threading kann AC2s Card-Zuschnitt nicht zuverlässig auf ein Signal zugreifen, das ggf. viele Turns zuvor gefallen ist. Exakte Form ist `/architecture`-Entscheidung, nicht hier vorgegeben.
- Card-Generierung + Completion-Gate-Logik sind über `/eval:interview` verifizierbar (der Clarification-Completion-Pfad in `runner.ts` ist code-identisch zur Produktionsroute `/api/interview/[token]/clarification/route.ts`).
- Die Zwei-Wege-Card-UI selbst (AC3) ist **nicht** eval-testbar (der synthetische Antwort-Generator im Eval-Runner ersetzt keinen echten Klick-Durchlauf) — zusätzlich zum Pflicht-Eval-Gate (general.md) ist ein manueller UI-Durchlauf vor `Approved` erforderlich.
- Nach Implementierung: mindestens ein `/eval:interview`-Lauf je Persona (buchhalter, it-support) zur Regressionsprüfung von `dialog_naturalness` (KI-18-Dichte-Risiko bei Prompt-Änderungen) und `talker_grounding_violations`.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

PROJ-43 ist überwiegend eine **Verhaltens-Revision** (Gesprächsmethodik im Talker-Prompt) plus eine **strukturelle Zuverlässigkeits-Korrektur** (Clarification Cards und Completion-Gate). Es gibt keinen neuen Nutzerfluss und keine neue Seite. Die bestehenden drei Bausteine (Talker, Analyst, Clarification-UI) werden angepasst, keiner wird neu gebaut.

**Zentrale Entscheidung dieser Spec:** AC3, AC4 und AC5 betreffen ausschließlich die drei Zahlen-Felder Häufigkeit, Dauer und Fehlerquote. Für genau diese drei wird ein neuer, vollständig deterministischer Mechanismus gebaut. Weder die Entscheidung, ob eine Karte entsteht, noch ihr Inhalt hängen danach vom LLM ab (Details Abschnitt B, Begründung Abschnitt D). Der bestehende LLM-basierte Mechanismus für offene Prozess-Bestätigungen und qualitative Zusatzkarten wird in dieser Runde bewusst nicht angefasst, Status und Begründung in Abschnitt F „Offene Baustelle".

---

### A) Gesprächsfluss: Live-Sequenz für Zahlen-Slots (AC1, AC6, AC7)

Ersetzt die heutige Forced-Choice-Eskalation. Gilt für `frequency`, `duration`, `error_rate_percent`.

```
Talker fragt offen (keine Zahlen im Fragetext)
        │
        ▼
   Zahl genannt? ──Ja──► Slot erfasst, weiter im Gespräch
        │
        Nein (Ausweichen, egal ob Verweigerung
        oder qualitative Umschreibung)
        │
        ▼
Talker fragt Richtung, ohne Zahlen zu nennen
("Ist das eher etwas, das oft vorkommt, oder eher selten?")
        │
        ▼
   Richtung genannt? ──Ja──► Richtungssignal erfasst (kein Zahlenwert),
        │                     Gespräch geht weiter
        Nein (auch hier Ausweichen)
        │
        ▼
Talker akzeptiert sofort (Akzeptanz-Phrasen-Pool, wie heute),
kein dritter Versuch, kein Forced-Choice
```

Zusatzregel (AC6, Treiber-Framing): Signalisiert die Richtungsfrage bei `duration` oder `error_rate_percent` eine hohe Ausprägung ("zieht sich lange", "passiert oft"), stellt der Talker im nächsten passenden Moment eine indirekte Ursachenfrage zu `reibungspunkte` für denselben Schritt. Kein neuer Slot, nur eine Priorisierungsregel für das ohnehin bestehende Ziel-O-Feld.

Zusatzregel (AC7, Dauer-Disambiguierung): Die offene Frage nach `duration` klärt aktiv, ob eine genannte Zeit pro Vorgang oder als Zeitraum-Aggregat gemeint ist. Bleibt das unklar, wird **nichts umgerechnet**. Der Slot bleibt leer und landet im Card-Mechanismus (Abschnitt B), wo die Frage im Wortlaut eindeutig gemacht wird ("Meintest du pro Rechnung oder insgesamt pro Monat?"). Reine Gesprächs- und Formulierungs-Disziplin, kein neues Datenfeld nötig (siehe Tech-Entscheidungen).

Betroffen: nur der Talker-Prompt (Methodik-Text) + eine kleine Erweiterung der Analyst-Extraktionsregel für `duration` (Aggregat-Fall erkennen und NICHT als `duration` fehlinterpretieren, stattdessen offenlassen).

---

### B) Datenmodell (Klartext, keine Migration nötig)

Alle Prozessschritt-Daten liegen bereits (seit PROJ-45) in einem flexiblen Datenfeld pro Schritt (`schritt_daten`), keine starren Datenbankspalten mehr. Neue Attribute darin sind eine reine Erweiterung, keine Schema-Änderung.

**Neu: „Richtung" je Zahlen-Feld.** Jedes der drei Zahlen-Felder (Häufigkeit, Dauer, Fehlerquote) bekommt neben dem eigentlichen Wert ein optionales Attribut „Richtung" mit den Werten niedrig, hoch oder leer. Gesetzt wird es, wenn der Mitarbeiter bei der Richtungsfrage eine Tendenz genannt hat, aber keine Zahl. Es lebt direkt am Feld selbst, genau wie die bereits bestehende „Einheit"-Angabe (z.B. „pro Woche"), nicht in einem separaten, nur-für-diesen-Turn gültigen Zwischenspeicher. Damit übersteht es beliebig viele Turns bis zur Abschlussphase automatisch, ohne eigenen Transportmechanismus. Das beantwortet die in der Ausgangs-Spec offen gelassene Frage nach einem Zwischenspeicher-Feld: keins nötig.

**Kein neues Feld für „pro Vorgang vs. Aggregat" (AC7).** Wird die Zeitangabe nicht eindeutig, bleibt der Wert leer (bestehender Mechanismus: „nicht erfasst, Grund unbekannt") und die Klärung passiert über die Abschluss-Card mit eindeutigerem Wortlaut. Kein neues Attribut.

**Card-Mechanismus für Häufigkeit, Dauer, Fehlerquote (AC3, AC4, AC5): ein neuer, vollständig deterministischer Baustein.**

So funktioniert er, Schritt für Schritt:

1. Genau in dem Moment, in dem das Interview enden würde (Zeit abgelaufen, oder das System urteilt „Gespräch wirkt inhaltlich fertig"), prüft der Code direkt im aktuellen Prozessschritt-Datenstand: fehlt bei irgendeinem Schritt Häufigkeit, Dauer oder Fehlerquote?
2. Fehlt nichts: Interview endet wie bisher.
3. Fehlt etwas: für jede Lücke wird eine Karte gebaut. Der Fragetext ist ein fester Satz pro Feldtyp (z.B. immer dieselbe Formulierung für Häufigkeit, nur der Schritt-Titel wird eingesetzt). Die Buttons kommen aus einer festen, an die erfasste „Richtung" angepassten Auswahl (Begründung Abschnitt D, Punkt 5).
4. Bis zu 8 dieser Karten werden angezeigt, priorisiert nach „Richtung" (Details Abschnitt D, Punkt 6).

Diese Prüfung läuft ausschließlich an diesem einen Entscheidungspunkt, nicht bei jedem Turn ab der Abschlussphase. Kein LLM-Aufruf ist beteiligt, weder für die Auswahl noch für den Karteninhalt. Der feste Fragetext ist bewusst der einfache Startpunkt für diese Spec-Runde, siehe Abschnitt F für die mögliche spätere Verfeinerung.

**Completion-Gate (AC4):** keine neue Tabelle, kein neues Statusfeld nötig. Die Prüfung aus Schritt 1 oben ist bereits das gesamte Gate: findet sie eine Lücke, wird nicht abgeschlossen, sondern zur Card-Runde geleitet. Sie ist automatisch korrekt für spät entdeckte Schritte (AC4, Edge Case „Späte Prozess-Entdeckung"), weil sie immer den aktuellen Stand liest, nie einen gespeicherten Verlauf. Das bereits bestehende Verhalten „eine durchlaufene Card-Runde zählt immer, auch bei 'Weiß ich nicht'" (Interview wird nach Einreichen der Card-Antworten unbedingt abgeschlossen) bleibt unverändert und erfüllt AC4s Anti-Wiederholungs-Anforderung bereits heute strukturell.

---

### C) Komponentenstruktur (UI)

Nur eine bestehende Komponente wird erweitert, keine neue Seite:

```
ClarificationView (unverändert)
└── ClarificationCards (unverändert als Container)
    └── SlotCard (erweitert, AC3)
        ├── Bucket-Auswahl (wie heute, Buttons)
        │   └── NEU: Buckets passen sich der erfassten "Richtung" an
        │        (z.B. bei Richtung=niedrig feinere Abstufungen im
        │        unteren Bereich statt der heutigen Pauschal-Buckets)
        └── NEU: freie Zahlen-/Spannen-Eingabe (Textfeld),
             gleichwertig zur Bucket-Auswahl, Mitarbeiter nutzt
             frei, welchen Weg er will
```

`OpenItemCard` und `QualitativeCard` bleiben unverändert (AC3 betrifft nur die drei Zahlen-Kartentypen).

---

### D) Tech-Entscheidungen (begründet)

**1. Forced-Choice raus, Zwei-Schritt-Sequenz rein.** Reine Prompt-Textänderung im Talker. Kein Architektur-Risiko.

**2. Richtungssignal wird am Prozessschritt-Feld gespeichert, nicht in einem turn-übergreifenden Zwischenspeicher.** Robuster (siehe Abschnitt B), folgt demselben Muster wie die bestehende „Einheit"-Angabe, keine neue Synchronisations-Fehlerquelle.

**3. Der Card-Mechanismus für Häufigkeit, Dauer, Fehlerquote wird vollständig deterministisch, Auswahl und Inhalt.** Heute entscheidet ausschließlich das Analyst-LLM, ob und welche Karten es vorschlägt, in einem Turn mit vielen anderen Aufgaben gleichzeitig. Das ist der dokumentierte Grund, warum Karten in der Praxis fast nie ausgelöst werden (M-4-Befund: 0 in 4 von 4 Testläufen). Diese Codebase hat mit reinen Prompt-Verschärfungen bei ähnlichen Zuverlässigkeitsproblemen wiederholt schlechte Erfahrungen gemacht (dokumentiert bei KI-18, wo zwei Prompt-only-Fixversuche scheiterten und erst ein architektonischer Fix half). Derselbe Ansatz gilt hier: die Prüfung, welcher Schritt welche Lücke hat, ist eine reine Ja/Nein-Frage an die Daten, kein Urteilsvermögen nötig, und wird deshalb vollständig im Code erledigt, inklusive Fragetext. Das macht AC4 (hartes Gate) und AC5 (zuverlässige Generierung) strukturell garantiert statt „wahrscheinlich, wenn das Prompt befolgt wird".

**4. Die Prüfung läuft nur einmal, genau am Entscheidungspunkt, nicht bei jedem Turn.** Sowohl der Zeit-Timeout-Pfad als auch der „Gespräch wirkt erschöpft"-Pfad (beide bereits bestehende Abschluss-Auslöser) laufen vor der endgültigen Abschluss-Entscheidung durch dieselbe deterministische Lücken-Prüfung. Nur wenn sie nichts findet, schließt das Interview tatsächlich ab, sonst wird zur Card-Runde geleitet, mit frisch berechneten Karten. Ein wiederholtes Scannen bei jedem Turn ab der Abschlussphase, wie es der heutige LLM-Mechanismus versucht (Abschnitt F), ist nicht nötig, weil ohnehin nur der eine Moment zählt, an dem das Interview tatsächlich enden würde.

**5. Bucket-Optionen bleiben Code, nicht LLM.** Die Buttons sind keine Prosa, sondern werden über eine feste Wörterbuch-Zuordnung (Label-Text zu Zahlenwert, z.B. „Wöchentlich" zu 4) in echte Werte übersetzt. Frei formulierte LLM-Label würden entweder eine robustere Zuordnung (Positions- statt Text-Matching) erfordern oder ein stilles Verlustrisiko schaffen, falls ein Label zu keinem Wörterbucheintrag passt. Das widerspricht der seit KI-18 etablierten Projektregel, Zahlenumrechnung immer deterministisch im Code zu halten statt sie dem LLM zu überlassen.

**6. Karten-Priorisierung bei Obergrenze 8 (AC4).** Zahlen-Karten für Häufigkeit, Dauer, Fehlerquote gehen immer zuerst, sortiert nach erfasster „Richtung" (hohe Ausprägung zuerst). Danach werden die restlichen Plätze mit dem aufgefüllt, was der bestehende LLM-Mechanismus (offene und qualitative Karten, Abschnitt F) zu diesem Zeitpunkt bereits vorgeschlagen hat, in dessen eigener Reihenfolge, bis zur Obergrenze von 8.

**7. Treiber-Framing (AC6) und Dauer-Disambiguierung (AC7).** Reine Methodik- und Formulierungsregeln, kein neuer Slot, keine neue Analyst-Klassifikationslogik, wie in der Spec vorgegeben.

**8. Löschkandidaten** (`usedFillerPhrases`, `conversationSignals.ts` question-stem, alter Forced-Choice-Textblock). Prüfreihenfolge wie in der Spec: nach Umbau der Live-Sequenz per Eval verifizieren, ob das ursprüngliche Wiederholungsmuster noch auftritt, dann erst löschen. Architektur trifft hier keine Vorwegentscheidung, das ist `/backend`-Verifikationsarbeit.

---

### E) Dependencies

Keine neuen Pakete. Alles mit bestehenden Bausteinen umsetzbar (Zod-Schema-Erweiterung, bestehende AI-SDK-Nutzung, bestehende shadcn-Komponenten für das Textfeld).

---

### F) Offene Baustelle, bewusst nicht Teil dieser Runde

Der bestehende LLM-basierte Mechanismus für offene Prozess-Bestätigungen (`OpenItemCards`) und qualitative Zusatzkarten (`QualitativeCards`, inklusive der heutigen `entscheidungslogik`-Karte) wird in dieser Spec-Runde nicht verändert. Begründung: keines der acht Akzeptanzkriterien verlangt eine Verbesserung dieser Kartentypen, sie blockieren den Abschluss nicht, und die Priorität liegt auf dem strukturell zuverlässigen Mechanismus für die drei gate-kritischen Zahlen-Felder. Festgehalten als eigenes Feature: **PROJ-47** (Roadmap).

Damit bleiben zwei bekannte Schwächen bestehen, hier dokumentiert für eine spätere Runde:

- Der Analyst wird weiterhin bei jedem Turn ab der Abschlussphase angewiesen, nach Kandidaten für diese Kartentypen zu suchen, obwohl nur der eine Entscheidungspunkt zählt, dieselbe Erkenntnis, die für den neuen deterministischen Teil bereits umgesetzt wird (Abschnitt D, Punkt 4). Eine Umstellung auf einen einzigen Aufruf am Entscheidungspunkt wäre eine naheliegende, aber eigenständige Vereinfachung.
- Die Zuverlässigkeit dieses Mechanismus bleibt unverändert die von heute. Er kann weiterhin Kandidaten übersehen oder in manchen Interviews gar nichts vorschlagen. Kein neuer Regressionspunkt durch PROJ-43, aber auch keine Verbesserung.

Beide Punkte sind Kandidaten für ein eigenes Folge-Item nach PROJ-43, nicht Teil des aktuellen Baus. → **PROJ-47**.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: XL / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
