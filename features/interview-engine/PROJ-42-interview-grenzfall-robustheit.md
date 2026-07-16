# PROJ-42: Interview-Grenzfall-Robustheit (Wrap-up + Rollen-Guard)

## Status: In Progress
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** M (½–1 Tag)
**Bugs:** —
**Created:** 2026-07-15
**Last Updated:** 2026-07-16

## Context

Ein realer Interviewdurchlauf ("Tim", Supabase-Interview `09c2052c-ad69-40fc-bb38-d934ece47fc6`, 2026-07-14, IT/Developer, 17 Turns, Config 10 min) deckte zwei Schwächen auf, die das synthetische Eval-Gate nie ausgelöst hat: synthetische Personas testen keine echten Grenzfälle (Unsinn, Rückfragen, Off-Topic-Verhalten).

**KI-23 — Wrap-up erreicht nie `completed`:** Tim steht bis heute auf `status='active'`, Phase `wrap_up`, nach vier Verabschiedungen. Doppelursache: Completion ist an `semanticAllStepsDone` gekoppelt (verlangt alle Potenzial-Slots inkl. optionaler → praktisch nie true) plus ein brittles `FAREWELL_MARKERS`-String-Matching (verfehlte Tims "wünsche **ich** dir" ≠ Marker "wünsche dir"). Tiefer liegt ein content-blinder, turn-count-getriebener Trigger (`computeTurnBudget`), der bei einer 10-Minuten-Config schon nach ~9 Turns mit nur einem erfassten Prozess eskaliert.

**KI-24 — Rollenverletzung:** Der Interviewer beantwortet fachfremde Rückfragen der interviewten Person. Tim Turns 15–17: "Kann ich dir auch eine Frage stellen?" → "Schieß los" → VW-Golf-Preis (28.000 €) → Flugpreise (100–300 €), beide beantwortet. Es existiert kein Guard gegen Rückfragen; die Interviewer-Rolle ist im `STATIC_PROMPT` eine einzelne funktionale Zeile ohne Durchsetzungsmechanismus. Enabling-Bedingung war KI-23 — das steckengebliebene Wrap-up gab Tim die zusätzlichen Turns zum adversarialen Testen.

PROJ-42 bündelt die beiden Ströme, die den identifizierten Grenzfall direkt adressieren: **Strom 1** (content-getriebenes Phasen-/Completion-Modell, Phasen-Kollaps 6→3) und **Strom 2** (Hybrid-Rollen-Guard). Ein dritter, eng verwandter Strom (Elicitation-Reorientierung — Treiber/WHY-Fragen statt Metriken, exakte Zahlen → Clarification Cards) ist bewusst als eigene Spec **PROJ-43** ausgegliedert, weil er eine andere Schicht betrifft (Gesprächsinhalt statt Lebenszyklus/Rollen) und unabhängig verifizierbar ist.

**Abgrenzung zu PROJ-43 (wichtig für den quantitativen Slot-Pfad):** PROJ-42 ändert nicht, *was* der Talker in Explore erfragt — die heutige Forced-Choice-Logik für Zahlen-Slots (Frequenz, Dauer, Fehlerquote) in `STATIC_PROMPT` bleibt unverändert bestehen. PROJ-42 ändert nur, *wie* die Fortschritts-/Completion-Entscheidung getroffen wird: der Wegfall der separaten `slot_completion`-Phase bedeutet, dass am Ende von Explore verbliebene, ungefüllte quantitative Slots über den bereits bestehenden Analyst-Clarification-Cards-Mechanismus (PROJ-23, unverändert) in die Closing-Sequenz einfließen, statt eine eigene Phase zu blockieren. Die inhaltliche Umlenkung des Gesprächs weg vom aktiven Zahlen-Chasing hin zu Treiber-/WHY-Fragen ist PROJ-43-Scope.

## Dependencies

- **Requires: PROJ-22** (Dual-Loop Interview Engine) — Talker/Analyst-Split und `next_briefing`-Bridge-Mechanismus sind die Grundlage, auf der sowohl das neue Advance-Signal als auch der Rollen-Guard aufsetzen
- **Requires: PROJ-33** (Turn-Loop-Konsolidierung) — `runInterviewTurn.ts` ist die Naht, an der Lifecycle-Entscheidung und Guard-Hook greifen
- **Berührt, aber kein Blocker: PROJ-23** (Adaptive Clarification Questions) — die bestehende `clarification`-Phase und Card-Mechanik bleiben strukturell erhalten, ändern sich nur in der Aufruf-Reihenfolge (Closing-Sequenz)
- **Nachfolgend, kein Blocker: PROJ-43** (Elicitation-Reorientierung) teilt die gleiche Closing-Sequenz-Oberfläche, wird aber separat spezifiziert und gebaut

## User Stories

- Als **KI-Berater** möchte ich, dass ein Interview zuverlässig `status='completed'` erreicht, damit ausgewertete Interviews nicht endlos in `wrap_up` hängen bleiben.
- Als **Befragter** möchte ich, dass das Interview nach meiner Verabschiedung tatsächlich endet, damit ich nicht wiederholt zum Weitersprechen gedrängt werde.
- Als **Befragter** möchte ich, dass der Interviewer fachfremde Rückfragen (z.B. Produktpreise, private Themen) nicht beantwortet, damit klar bleibt, dass es sich um ein Prozess-Interview handelt und nicht um einen Allzweck-Chat.
- Als **Befragter** möchte ich, dass Meta-Rückfragen zum Interview selbst ("und die wäre?", "wie meinst du das?") weiterhin normal beantwortet werden, damit der Redirect-Mechanismus nicht übergreift und das Gespräch nicht künstlich wirkt.
- Als **KI-Berater** möchte ich, dass ein spät im Gespräch entdeckter Prozess vollwertig exploriert wird statt nur einen eingeschränkten Clarification-Pfad zu bekommen, damit auch späte Funde nicht unterrepräsentiert im Wissensbestand landen.

## Acceptance Criteria

### Strom 1 — Content-getriebenes Phasen-/Completion-Modell

- [ ] Phasen-Modell auf drei Phasen kollabiert: `intro → Explore → Closing` (ersetzt `intro / process_loop / walkthrough_step / slot_completion / coverage_check / wrap_up`)
- [ ] Explore deckt zwei fortlaufend nebeneinander laufende Aktivitäten ab, nicht zwei sequenzielle Blöcke: **Prozess-Entdeckung** (gibt es noch einen wiederkehrenden Vorgang, der noch nicht registriert ist?) und **Prozess-Vertiefung** (Ablauf, Treiber, tazite Details für den gerade aktiven Prozess). Das bereits bestehende "Breite vor Tiefe"-Prinzip (aktiv nach weiteren Aufgaben fragen sobald ein Schritt ausreichend erfasst ist, statt das erst am Ende zu tun) bleibt erhalten
- [ ] Die Prozess-Entdeckung stützt sich weiterhin auf den bestehenden Fokusthemen-Mechanismus: `focusTopics` bleibt unverändert Teil des Kontexts für Analyst und Talker; der bestehende `topics_open`/`topics_covered`-Tracking-Mechanismus (vom Analyst gepflegt) entscheidet mit, ob Explore noch offene Themen hat, bevor nach Closing gewechselt wird — nicht nur der organisch im Gespräch entdeckte `stepTracker`-Stand
- [ ] Explore-Fortschritt primär über ein **Analyst-Advance-Signal** (neues Briefing-Feld: "Prozess erschöpft / genug Treiber erhoben") — die bisherige `computeTurnBudget`-Eskalationsleiter (Turn-Count-Schwellen bei 40/56/64/80 % des Budgets) entfällt als primärer Treiber
- [ ] Ein deterministischer **No-New-Extraction-Zähler** (Startwert K=3, eval-tunbar) greift nur als Sicherheitsschranke, wenn das Advance-Signal über mehrere Turns ausbleibt — verhindert Steckenbleiben ohne den turn-count-blinden Charakter des Ist-Zustands zu reproduzieren
- [ ] Ein **Wall-Clock-Soft-Anker** bei ca. 80 % von `maxDurationMinutes` stößt den Wechsel in die Closing-Sequenz an, unabhängig vom Advance-Signal-Status — "was zuerst eintritt" (Prozesse abgedeckt ODER Soft-Anker) entscheidet. Der Anker ist bewusst blind gegenüber Inhaltsqualität (dafür ist der No-New-Extraction-Zähler zuständig, siehe oben) — er schützt das vereinbarte Zeitbudget der Person, nicht die Gesprächsgüte
- [ ] Feuert der Soft-Anker, während ein Schritt gerade aktiv exploriert wird (frisch begonnen, `status='exploring'`/`'walkthrough'` mit noch unfertigem Inhalt), wird die Closing-Sequenz **nicht** mitten im Thema mit einer unpassenden, themenfremden Nachricht erzwungen. Der laufende Schritt bekommt eine gedeckelte, kurze Kulanzfrist, um einen natürlichen Abschluss zu erreichen, bevor die Catch-all-Sonde folgt — trägt konzeptionell die heutige Rückstellungslogik weiter (Ist-Zustand: `wrap_up` wird nicht erzwungen solange ein Schritt `walkthrough` ist), nur jetzt an den Soft-Anker statt an die Turn-Count-Leiter gekoppelt
- [ ] Der harte Timer-Stop bei 100 % `maxDurationMinutes` bleibt als allerletzte Instanz erhalten (adversarialer Fall, keine Kulanzfrist mehr) — er ist **hart im Auslöser** (unbedingt, wartet auf nichts), aber **nicht abrupt in der Wirkung**: die Verabschiedung wird weiterhin über eine kohärente, LLM-formulierte Nachricht ausgegeben, nie über einen rohen Abbruch oder eine Systemmeldung. Das ist keine neue Erwartung, sondern bereits heute so implementiert (`runInterviewTurn.ts`: `isCompletionFarewell`-Pfad generiert bei `hard_stop` einen echten Farewell-Turn über den Talker) — PROJ-42 übernimmt dieses Muster unverändert für den neuen 3-Phasen-Fall
- [ ] Kein Phasenübergang im neuen Modell — weder Soft-Anker noch harter Timer-Stop — erzeugt eine rohe, abgebrochene oder thematisch unpassende Nachricht; jede Beendigung läuft über eine formulierte, kohärente Verabschiedung
- [ ] Das Vollständigkeits-Gate (`semanticAllStepsDone` als Completion-Blocker) ist entfernt — deckt sich mit der PRD-Priorisierung ("Vollständigkeit auf Gesamt-Prozessebene nachrangig")
- [ ] Das `FAREWELL_MARKERS`-String-Matching ist entfernt
- [ ] Die Closing-Sequenz läuft in fester Reihenfolge: Catch-all-Sonde (Nachfolger von `WRAP_UP_QUESTION_TEXT`) → Talker-Verabschiedung → Clarification-Cards (falls vom Analyst erzeugt) → `status='completed'`. Ohne Cards: Verabschiedung → direkt `completed`
- [ ] Terminierung ist im **Zustand** deterministisch: der Verabschiedungstext ist LLM-formuliert, aber der Übergang zu `status='completed'` wird vom Orchestrator deterministisch gesetzt — nicht vom Modell "erraten" oder über Text-Heuristik erkannt
- [ ] Ein während der Closing-Sequenz neu entdeckter Prozess wird **erstklassig** zurück nach Explore geführt (löst den heutigen 2-Turn-Clarification-Cap für spät entdeckte Schritte ab)
- [ ] Ein Regressionstest reproduziert Tims reale Turn-Sequenz (Supabase-Interview `09c2052c-ad69-40fc-bb38-d934ece47fc6`) und verifiziert deterministisch `status='completed'` — kein Steckenbleiben

### Strom 2 — Hybrid-Rollen-Guard

- [ ] Ein **Prefilter** (kein LLM-Call, rein deterministisch) klassifiziert jeden User-Turn: feuert bei `?` ODER einem Fragewort/einer Bitte **am Satzanfang** (Wie/Was/Warum/Wann/Wo/Wer/Welche/Kannst du/Weißt du/Kann ich/Sag mir/Erzähl mir)
- [ ] Eingebettete Fragewörter mitten in einer Aussage lösen den Prefilter NICHT aus (z.B. "ich weiß nicht **wie** oft das auftritt" — kein `?`, Satzanfang "ich" → kein Trigger)
- [ ] Feuert der Prefilter nicht, läuft der Turn ohne zusätzlichen Guard-Call durch — kein Kosten-/Latenz-Overhead für den Normalfall (die meisten Turns sind Aussagen)
- [ ] Feuert der Prefilter, klassifiziert ein **Judge-Call** den Turn in genau zwei Klassen: (b) interview-relevante Meta-Klärung vs. (c) fachfremde Wissensfrage/Off-Topic
- [ ] Klasse (c) löst einen festen, deterministischen **Redirect** aus (kein Talker-Call nötig): re-verankert kurz auf die Interviewer-Rolle und kehrt zur zuletzt offenen Frage zurück
- [ ] Klasse (b) läuft normal über den Talker — keine Verhaltensänderung, kein Redirect
- [ ] Der Guard sitzt als eigener, vorgeschalteter Schritt **vor** der gesamten übrigen Turn-Verarbeitung — vor der schnellen Zahlen-Vorerfassung, vor dem Talker-Aufruf und vor dem Anstoßen der Hintergrund-Analyse. Bei Klasse (c) läuft keiner dieser drei Schritte für den betroffenen Turn; der gespeicherte Interview-Zustand (Phase, Prozesse, offene Themen) bleibt unverändert. Das gilt unabhängig davon, ob der Analyst heute im Hintergrund nach dem Talker läuft oder (nach PROJ-44) synchron davor — der Guard ist von dieser Reihenfolge unabhängig
- [ ] Die `STATIC_PROMPT`-Rollendefinition bleibt knapp (eine kurze Interviewer-only-Zeile) — die Durchsetzung liegt beim Guard-Mechanismus, nicht bei zusätzlicher Prompt-Dichte (bewusste Vermeidung des KI-18-Regressionsmusters: Prompt-Verdichtung korrelierte historisch mit `dialog_naturalness`-Einbrüchen beim lite-Modell)
- [ ] Tims Turns 15–17 (VW-Golf-Preis, Flugpreise) sind als Test-Fixtures reproduziert und lösen Klasse (c) + Redirect aus
- [ ] Tims Turn 11 ("und die wäre?") ist als Test-Fixture reproduziert und löst **keinen** Redirect aus (Klasse b — False-Positive-Schutz)

## Edge Cases

- **Judge-Call schlägt fehl** (Netzwerkfehler, Rate-Limit) → analog zum bestehenden `talkerGroundingGuard`-Retry-Muster (KI-18, sechster Fix-Versuch): ein Retry, danach fail-safe zu Klasse (b) durchlassen mit sichtbarem `console.error` statt lautlosem Silent-Fail-Open — kein blockierter Turn, keine hängende Antwort
- **Disengagierte/unproduktive Antworten** (kaum neuer Inhalt pro Turn) → das ist Aufgabe des No-New-Extraction-Zählers, der content-basiert und unabhängig von der Uhrzeit feuern kann, auch weit vor 80 % des Zeitbudgets. Der Wall-Clock-Anker ist für diesen Fall nicht zuständig — Zuständigkeiten sind bewusst getrennt (Inhalt vs. Zeitbudget)
- **Wall-Clock-Soft-Anker feuert mitten in einer aktiven, unfertigen Schritt-Exploration** → keine abrupte, themenfremde Pivot-Nachricht; der Schritt bekommt eine gedeckelte Kulanzfrist für einen natürlichen Abschluss, bevor die Catch-all-Sonde beginnt (siehe AC)
- **Wall-Clock-Soft-Anker feuert, obwohl das Advance-Signal weiterhin hohen Gesprächswert anzeigt** (voller Flow) → Closing beginnt trotzdem, weil das Zeitbudget der Person Vorrang hat — aber das ist kein Abbruch: Catch-all-Sonde und erstklassige Re-Entry bleiben offen für neue Substanz. Nur der harte 100 %-Timer ist die unbedingte letzte Instanz, und selbst der bleibt in der Formulierung graziel (siehe AC)
- **Harter Timer-Stop (100 %) erreicht, während ein Schritt noch aktiv exploriert wird** → keine Kulanzfrist mehr (adversarialer Fall), aber weiterhin eine kohärente, LLM-formulierte Verabschiedung statt einer rohen Abbruch- oder Systemmeldung — Wiederverwendung des bestehenden `isCompletionFarewell`-Mechanismus
- **User stellt eine Gegenfrage statt die Catch-all-Sonde zu beantworten** → Guard-Logik gilt phasenunabhängig, greift auch während der Closing-Sequenz
- **Off-Topic-Frage bereits im ersten Turn** (vor jeder Prozesserhebung) → Guard greift ab `intro`, keine Phasen-Ausnahme
- **Zwei Off-Topic-Fragen in Folge** → jede wird einzeln redirected, kein eskalierender Sonderzustand, kein zusätzlicher Zähler nötig
- **Clarification-Cards-Submit während bereits `status='completed'` gesetzt ist** (Race durch Doppel-Request) → der bestehende Chat-409-Guard bleibt die Absicherung; PROJ-42 ändert daran nichts

## Out of Scope

- **Strom 3** (Elicitation-Reorientierung: Treiber/WHY-Fragen, exakte Zahlen → Clarification Cards, AI-Wert-Faktoren) — eigene Spec **PROJ-43**
- **Strom 4** (Schema-Erweiterung fehlende AI-Wert-Faktoren, v.a. unstrukturierte Daten/Textverarbeitung) — **PROJ-45**, deferred bis nach der Pilot-Demo
- **Strom 5** (Analyst synchron vor Talker, Quick-Extract-Pfad entfernen) — **PROJ-44**
- **Strom 6** (Legacy-Pfad `interviewAgent.ts`/`createInterviewStream` von start/reconnect lösen) — **PROJ-44**
- Neue Eval-Judges oder -Metriken über die in den Acceptance Criteria genannten Regressionstests hinaus (PROJ-31-Scope)
- Änderungen an der Forced-Choice-Anchoring-Mechanik (KI-21) — bewusste, bereits dokumentierte Design-Entscheidung, kein PROJ-42-Scope
- Voice-Input-spezifische Anpassungen (PROJ-7) — der Guard arbeitet textbasiert auf dem User-Turn, unabhängig vom Eingabekanal; keine Voice-spezifische Sonderbehandlung
- Neue DB-Tabellen oder neue API-Endpoints (die Phase-Constraint-Migration ist eine Änderung, keine neue Tabelle)

## Technical Requirements

- Betroffene Kern-Datei: `src/services/interviewOrchestrator.ts` (Phasen-Modell, `decideNextPhase`, `checkLifecycle` — größter Eingriff dieser Revision)
- Phase-Type-Änderung in `src/services/interviewSemantic.ts` (`export type Phase`) — Breaking Change, propagiert in `interviewTypes.ts`, `talkerPrompt.ts`, `interviewAnalyst.ts`/dessen Prompt, `runInterviewTurn.ts`, Eval-Harness (`src/services/__evals__/interview/`)
- **DB-Migration erforderlich:** `interview_state_phase_check`-Constraint muss die neuen Phase-Werte zulassen (aktuell `intro, process_loop, walkthrough_step, slot_completion, coverage_check, wrap_up, clarification` — siehe `supabase/migrations/20260630000000_add_clarification_phase.sql`). Migration unterliegt dem Supabase-Schema-Approval-Gate aus `.claude/rules/general.md`
- Neues Analyst-Briefing-Feld (Advance-Signal) folgt dem etablierten Bridge-Muster `AnalystBriefing → next_briefing (JSON) → InterviewContext` (analog `usedFillerPhrases`, `recontextStreak`)
- Rollen-Guard als neuer, dedizierter Service-Baustein nach dem etablierten `talkerGroundingGuard.ts`-Muster (deterministischer Prefilter im Code, Judge als separater, schlanker LLM-Call), gehookt in `runInterviewTurn.ts` vor dem Talker-Call
- `STATIC_PROMPT` (`src/services/talkerPrompt.ts`) und die parallele Kopie in `interviewAgent.ts`/`buildStaticPrompt()` (PROJ-37-Drift-Risiko, bereits bekannt) müssen synchron aktualisiert werden — Phasenmodell-Zeile und Rollen-Zeile
- Bestehende Invarianten bleiben erhalten: ANKER-SPERRE, `extractNumericTokens`, drill-stop (`recentAssistantTurns`), refuse-detect (`lastUserTurn`), Clarification-Card-Mechanik (`clarification`-Phase, Chat-409-Guard, `ClarificationView`-Frontend-Pfad), `focusTopics`-Injektion in Talker- und Analyst-Kontext, `topics_open`/`topics_covered` + das `update_topics`-Tool des Analysten
- Rollen-Guard-Platzierung: als frühester Gate direkt nach dem Laden des Zustands in `runInterviewTurn.ts`, strukturell analog zum bereits bestehenden `lifecycle.shouldComplete`-Early-Return — nicht erst unmittelbar vor dem Talker-Aufruf. Bei Klasse (c) werden `runQuickExtract`, `createTalkerStream` und die Hintergrund-Analyst-Planung für diesen Turn komplett übersprungen
- **Explizit unverändert:** die heutige Ist-Anordnung "Analyst läuft nach/parallel zum Talker" (Kommentar `interviewAnalyst.ts`: "Analyst runs in `after()` parallel to Talker") sowie der Quick-Extract-Pfad (`interviewQuickExtract.ts`) bleiben unangetastet — die Umstellung auf synchronen Analyst-Lauf vor dem Talker ist PROJ-44 (Strom 5), nicht PROJ-42
- Der bestehende Graceful-Farewell-Mechanismus (`runInterviewTurn.ts`: `isCompletionFarewell: true` + `createTalkerStream`-Aufruf mit Briefing "Verabschiede dich kurz und herzlich" statt Systemabbruch) wird für den harten Timer-Stop unverändert wiederverwendet, nicht neu gebaut — bereits heute der Mechanismus hinter jedem `hard_stop`
- Die heutige Rückstellungslogik im `wrap_up`-Case ("nicht erzwingen solange ein Schritt `walkthrough` ist", `interviewOrchestrator.ts` Zeilen ~294–310) wird konzeptionell in die neue, an den Wall-Clock-Soft-Anker gekoppelte Kulanzfrist überführt — kein ersatzloses Streichen dieser Schutzlogik beim Phasen-Kollaps
- Nach Implementierung: `/eval:interview`-Lauf (Pflicht-Gate für Interview-Engine-Features laut `.claude/rules/general.md`) plus der Tim-Regressionstest aus den Acceptance Criteria
- Zusätzlich zum automatisierten Regressionstest: ein manueller adversarialer Interview-Durchlauf (Nutzer-getrieben, analog Tims Verhalten — Off-Topic-Rückfragen, Verabschiedungsversuche) vor Status-Übergang zu Approved. Automatisierte Tests allein sind für diesen Fix kein ausreichender Nachweis, da genau das Fehlen realer Grenzfall-Abdeckung der Auslöser für PROJ-42 war
- Bestehende Eval-Transkripte und Scorer, die auf die alten Phase-Namen referenzieren, müssen auf das neue Phase-Vokabular geprüft werden — kein automatischer Doppel-Support alter Namen vorgesehen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Ablauf-Struktur (kein neues UI — reiner Entscheidungsfluss)

PROJ-42 fügt keine neue Bildschirmfläche hinzu. Die Änderung liegt vollständig im Entscheidungsfluss, den jeder eingehende Chat-Turn durchläuft:

```
Eingehender User-Turn
│
├─ 1. Zustand laden (unverändert wie heute)
│
├─ 2. Rollen-Guard-Prefilter (kein LLM, läuft sofort, kostet nichts)
│   ├─ Kein Frage-Signal → weiter zu Schritt 3 (Normalfall, die meisten Turns)
│   └─ Frage-Signal erkannt → Guard-Judge (ein zusätzlicher, schneller LLM-Aufruf)
│       ├─ Klasse "interview-relevante Meta-Frage" → weiter zu Schritt 3, unverändert
│       └─ Klasse "fachfremd/Off-Topic" → fester Redirect-Text wird sofort gespeichert.
│             Turn endet hier — weder die schnelle Zahlen-Vorerfassung noch der
│             Talker noch die ausführliche Hintergrund-Auswertung laufen für diesen
│             Turn, es gibt inhaltlich nichts zu verarbeiten. Zustand (Phase,
│             erfasste Prozesse, offene Themen) bleibt unverändert.
│
├─ 3. Orchestrator: Phasen-/Abschluss-Entscheidung (auf Basis des Zustands vom Vorturn)
│   ├─ Phase "intro" → nach der Begrüßung weiter zu "Explore"
│   ├─ Phase "Explore" — zwei Aktivitäten laufen fortlaufend nebeneinander, nicht
│   │   │   nacheinander:
│   │   ├─ Prozess-Entdeckung: gibt es noch einen wiederkehrenden Vorgang, der
│   │   │     noch nicht registriert ist? Speist sich sowohl aus dem organischen
│   │   │     Gesprächsverlauf als auch aus den bei der Interview-Anlage
│   │   │     hinterlegten Fokusthemen (weiterhin als offen/erledigt mitverfolgt)
│   │   ├─ Prozess-Vertiefung: für den gerade aktiven Prozess Ablauf, Treiber
│   │   │     und tazite Details erheben
│   │   ├─ Advance-Signal für den aktiven Prozess UND keine offenen Themen/Funde
│   │   │     mehr → weiter zu "Closing"; Advance-Signal allein → aktiv nach dem
│   │   │     nächsten wiederkehrenden Thema fragen (Breite vor Tiefe, bestehendes
│   │   │     Prinzip bleibt erhalten)
│   │   ├─ Mehrere Turns ohne neuen Inhalt (Sicherheitsnetz) → weiter zu "Closing"
│   │   └─ ~80 % des Zeitbudgets erreicht → weiter zu "Closing"
│   │       (läuft gerade ein Schritt aktiv, wird er erst kurz zu Ende geführt,
│   │        kein abrupter Themensprung)
│   └─ Phase "Closing"
│       ├─ Abschlussfrage gestellt + beantwortet, nichts Neues mehr →
│       │     Verabschiedung → (Karten für offene Zahlen, falls nötig) → Abschluss
│       ├─ Neuer Fund in der Antwort → zurück zu "Explore", vollwertig
│       └─ 100 % Zeitbudget erreicht, ohne dass obiges konvergiert ist →
│             sofortiger, aber weiterhin sprachlich stimmiger Abschluss
│             (kein rohes Abbrechen — nutzt denselben Mechanismus, der heute
│             schon eine echte Verabschiedung erzeugt)
│
├─ 4. Talker formuliert die eigentliche Antwort (unverändert wie heute, inkl. der
│      heutigen schnellen Zahlen-Vorerfassung)
│
└─ 5. Im Hintergrund, parallel/danach: der Analyst wertet den Turn vollständig aus
       und aktualisiert den Zustand für den nächsten Turn (Prozesse, Slots, offene
       Themen). Das ist die heutige Ist-Anordnung (Analyst läuft nach/parallel zum
       Talker, nicht davor) — PROJ-42 ändert daran nichts. Eine Umstellung auf
       synchronen Analyst-Lauf vor dem Talker inkl. Entfernen der schnellen
       Zahlen-Vorerfassung ist separat als PROJ-44 (Strom 5) vorgemerkt.
```

Das ersetzt die heutige Kette von sechs Einzelphasen (`intro → process_loop → walkthrough_step → slot_completion → coverage_check → wrap_up`) durch drei gröbere Zustände. Die feingranulare Steuerung, die bisher über Phasenwechsel lief, wandert in die beiden neuen Signale (Analyst-Fortschrittsmeldung + Sicherheitszähler) innerhalb von "Explore". Der Rollen-Guard ist ein komplett neuer, vorgeschalteter Schritt (2), strukturell analog zum bereits bestehenden Completion-Early-Return in `runInterviewTurn.ts` — er hängt nicht davon ab, ob der Analyst vor oder nach dem Talker läuft.

### B) Datenmodell (in einfacher Sprache)

- Die bestehende Spalte, die den Interview-Fortschritt speichert (`interview_state.phase`), bekommt weniger erlaubte Werte: statt sechs nur noch drei Kernwerte (`intro`, `explore`, `closing`) — der bestehende Zwischenwert für die Karten-Rückfragen (`clarification`) bleibt zusätzlich erhalten, unverändert in seiner heutigen Funktion.
- **Alle 13 bestehenden Interviews mit alten Phasenwerten** (u.a. Tim, zwei substanzielle Michael-Braun-Durchläufe) werden beim Deploy automatisch auf die neuen Werte umgemappt (`process_loop`/`walkthrough_step`/`slot_completion`/`coverage_check` → `explore`, `wrap_up` → `closing`, `intro` bleibt `intro`) — das folgt exakt dem Muster, das schon für frühere Phasen-Änderungen in diesem Projekt verwendet wurde. Keine Zeile wird gelöscht oder verliert Inhalt.
- Ein neues, kleines Signal wird dem bestehenden internen Zwischenergebnis des Analysten hinzugefügt (kein neues Datenbankfeld, sondern Teil des schon vorhandenen JSON-Übergabeobjekts): ein Ja/Nein-Signal "ist der aktuelle Prozessschritt für jetzt ausreichend erhoben".
- Der Rollen-Guard braucht kein eigenes Datenfeld — er bewertet ausschließlich den gerade eingehenden Turn-Text, ohne zusätzlichen Zustand zu speichern.

### C) Tech-Entscheidungen (Begründung)

1. **Drei Phasen statt sechs:** Die bisherige Feingranularität hat den eigentlichen Bug verursacht (KI-23) — je mehr benannte Phasen, desto mehr einzelne Übergangsbedingungen, die alle gleichzeitig stimmen müssen, um zum Abschluss zu kommen. Weniger, gröbere Zustände mit einem inhaltlichen statt zählbasierten Fortschritts-Signal sind robuster gegen genau diese Klasse von Fehlern.
2. **Hybrides Fortschritts-Signal (Analyst-Meldung + Sicherheitszähler + Zeit-Anker), nicht reine Turn-Zählung:** Reine Turn-Zählung war die Wurzel des Tim-Bugs (eskalierte nach ~9 Turns unabhängig vom tatsächlichen Gesprächsinhalt). Ein inhaltsbasiertes Signal mit einem deterministischen Sicherheitsnetz kombiniert beide Vorteile: reagiert auf echten Gesprächsverlauf, kann aber nicht endlos hängen bleiben.
3. **Zwei-stufiger Zeit-Mechanismus (weicher Anker bei ~80 %, harter Stop bei 100 %):** Ein einzelner harter Schnitt würde gute, wertvolle Gespräche genauso abrupt beenden wie schlechte. Ein einzelner weicher Mechanismus ohne Rückfallebene hätte dagegen das Risiko, bei einem hartnäckigen Gesprächspartner (wie Tim) nie zu konvergieren. Die Kombination behält beide Eigenschaften: der weiche Anker bleibt empfänglich für wertvolle Inhalte, der harte Stop garantiert trotzdem ein Ende — und zwar über denselben Mechanismus, der heute schon eine echte, formulierte Verabschiedung erzeugt statt eines rohen Abbruchs.
4. **Rollen-Guard als zweistufiger Filter (günstige Vorprüfung + teure Prüfung nur im Zweifel), nicht "jeden Turn per LLM prüfen":** Die meisten Gesprächsbeiträge sind Aussagen, keine Fragen — eine LLM-Prüfung bei jedem einzelnen Turn wäre unnötiger Kosten- und Zeitaufwand. Die günstige Vorprüfung filtert zuverlässig auf die kleine Minderheit der Turns, die überhaupt eine Frage enthalten könnten.
5. **Guard-Prüfmodell muss aus einer anderen Modell-Familie stammen als das Gesprächsmodell:** folgt einer bereits etablierten, bewährten Regel dieses Projekts (verhindert, dass ein Modell seine eigene Anfälligkeit für Off-Topic-Antworten selbst bewertet — dieselbe Regel gilt schon für die bestehende Prüfung auf erfundene Zahlenangaben).
6. **Migration per Umschlüsselung statt Neuanlage:** bestehende Interviews (inkl. der drei mit dokumentiertem Erkenntniswert) bleiben vollständig erhalten und funktionsfähig, keine Datenverluste, kein Parallelbetrieb zweier Vokabulare im Code nötig.

### D) Abhängigkeiten

- **Keine neuen npm-Pakete.** Der zusätzliche Guard-Prüfungsaufruf nutzt dieselbe bereits vorhandene Anbindung an die Sprachmodelle, die auch der restliche Interview-Agent verwendet.
- **Eine Datenbank-Änderung** (Anpassung der erlaubten Werte für den Interview-Fortschritt + Umschlüsselung bestehender Zeilen). Das ist laut Projekt-Regeln freigabepflichtig — die genaue Änderung wird zur Freigabe vorgelegt, bevor sie angewendet wird, nicht im Rahmen dieses Architektur-Schritts.

## Implementation Notes (Backend, 2026-07-16)

**DB-Migration angewendet** (`supabase/migrations/20260716000000_proj42_collapse_phase_model.sql`, freigegeben durch Nutzer vor Ausführung): `interview_state_phase_check`-Constraint auf `intro | explore | closing | clarification` verengt; alle 13 bestehenden Zeilen umgeschlüsselt (`process_loop/walkthrough_step/slot_completion/coverage_check` → `explore`, `wrap_up` → `closing`). Verifiziert nach Anwendung: 6× `intro`, 9× `explore`, 41× `closing`, keine Zeile verloren. `src/lib/database.types.ts` (handgepflegt, kein Codegen-Diff) entsprechend angepasst.

**Phasen-Kollaps** (`interviewSemantic.ts`, `interviewOrchestrator.ts`): `Phase` auf `'intro' | 'explore' | 'closing' | 'clarification'` reduziert. `decideNextPhase`/`checkLifecycle` komplett neu geschrieben — turn-count-Eskalationsleiter (`computeTurnBudget`) und regex-basierte `FAREWELL_MARKERS`-Erkennung vollständig entfernt (kein Fallback, kein Doppel-Support). Neue Signale:
- **Advance-Signal** (`AnalystBriefing.step_advance_ready`, LLM-authored, snake_case passend zum Zod-Tool-Schema): Analyst-Urteil "aktiver Schritt jetzt ausreichend erhoben".
- **No-New-Extraction-Zähler** (`AnalystBriefing.noNewExtractionStreak`, camelCase, deterministisch code-berechnet — NIE vom Modell gesetzt): in `interviewAnalyst.ts` per `computeNextBriefing()` (pure, eigenständig unit-getestet) aus den tatsächlichen Tool-Calls des Passes abgeleitet, threaded über den next_briefing-JSON-Bridge (analog `usedFillerPhrases`). Default-Limit K=3, override via `NO_NEW_EXTRACTION_LIMIT` env var.
- **Wall-Clock-Soft-Anker** bei 80 % von `maxDurationMinutes`, mit gedeckelter Kulanzfrist (`min(3 Min, Restzeit bis 100 %)`) für einen gerade aktiv explorierten Schritt — Kulanzfrist ist durch den harten 100 %-Stop natürlich begrenzt.
- Closing-Sequenz: `CLOSING_PROBE_TEXT`/`shouldInjectClosingProbe`/`closingProbeAnswerReceived` (Nachfolger von `WRAP_UP_QUESTION_TEXT` u.a., wortgleicher Text). Neu entdeckter Prozess während Closing → erstklassig zurück zu `explore` (kein 2-Turn-Clarification-Cap mehr).

**Rollen-Guard** (`src/services/roleGuard.ts`, neu): deterministischer Prefilter (`?` oder Fragewort/Bitte am Satzanfang) + Judge-Call (Cross-Vendor via bestehendem `resolveGuardJudgeModel`/`assertGuardFamilyDiffersFromTalker` aus `talkerGroundingGuard.ts`, wiederverwendet statt dupliziert) klassifiziert `meta` vs. `off_topic`. Klasse `off_topic` → fester, deterministischer Redirect-Text (kein Talker-Call), verankert auf die letzte Assistant-Nachricht. Gehookt in `runInterviewTurn.ts` als frühester Gate direkt nach Turn-Historie-Aufbau, vor Quick-Extract/Talker/Analyst. Judge-Fail-Safe: 1 Retry, danach Passthrough zu `meta` mit `console.error` (analog KI-18 sechster Fix-Versuch).

**Prompt-Updates:** `talkerPrompt.ts` STATIC_PROMPT-Phasenzeile + `buildPhaseMethodology` auf 3 Phasen konsolidiert (`explore` bündelt vormals `process_loop`+`walkthrough_step`+`slot_completion` in einem kompakteren Block, bewusst nicht additiv verlängert — KI-18-Prompt-Dichte-Risiko im Blick). `interviewAnalyst.ts` System-Prompt STUFE 0-5 aktualisiert inkl. neuer STUFE 4 (Advance-Signal-Anweisung).

**Abweichung von der Tech-Design-Beschreibung:** Die Tech-Design-Sektion B erwähnt nur EIN neues Signal ("Ja/Nein-Signal"); der No-New-Extraction-Zähler wurde zusätzlich über denselben next_briefing-Bridge-Mechanismus geführt (kein neues DB-Feld, konsistent mit der Vorgabe "kein neues Datenbankfeld"), da eine rein LLM-gesteuerte Zählung dem Determinismus-Anspruch der AC widersprochen hätte.

**Tests:** 898/899 Unit-Tests grün (1 Skip vorbestehend), `tsc --noEmit` sauber. Neue/aktualisierte Dateien: `interviewOrchestrator.test.ts` (komplett neu geschrieben), `interviewOrchestrator.tim-regression.test.ts` (neu — reproduziert Tims reale Turn-Sequenz aus Supabase-Interview `09c2052c-ad69-40fc-bb38-d934ece47fc6` inkl. echter Zeitstempel/Timer-Werte/finalem step_tracker, verifiziert deterministisches `shouldComplete=true`), `roleGuard.test.ts` (neu — inkl. Tims Turns 11/16/17 als Fixtures), `runInterviewTurn.test.ts`, `talkerPrompt.test.ts`, `interviewAnalyst.test.ts`, `phaseAdherence.ts`-Scorer, `runner.ts` (Eval-Harness) aktualisiert.

**Noch offen (nicht Backend-Scope, siehe general.md Interview-Engine-Eval-Gate):** `/eval:interview`-Lauf + manueller adversarialer Interview-Durchlauf vor Status-Übergang zu Approved — beides Aufgabe von `/qa`.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
