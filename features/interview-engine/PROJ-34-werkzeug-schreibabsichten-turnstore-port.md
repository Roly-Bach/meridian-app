# PROJ-34: Werkzeug-Schreibabsichten + TurnStore-Port (DB-freie Evals)

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-33
**Appetite:** L (1–2w)
**Bugs:** —
**Created:** 2026-06-22
**Last Updated:** 2026-06-22
**Architecture:** ADR-016 (Vertagungsnotiz) — ein eigener ADR folgt in `/architecture`

## Dependencies
- Requires: PROJ-33 (Turn-Loop-Konsolidierung) — `runInterviewTurn` ist das tiefe Modul, das den injizierten `ports`-Parameter bekommt; heute lädt und persistiert es selbst via `getSupabaseAdmin()`.
- Requires: PROJ-22 (Dual-Loop Interview Engine) — Analyst, Quick-Extract und der Begrüßungspfad sind die werkzeugnutzenden Aufrufer, deren Schreibvorgänge umgestellt werden.
- Related: ADR-016 (Vertagung von TurnStore-Port + Schreibabsichten), ADR-015 (Slot-Write-Trail — bleibt das Mess-Signal), PROJ-27/BL-E1.5 (`patch_interview_step_field`, atomarer jsonb-Write), PROJ-38 (jsonb-Encoding-Bug — Treue-Motivation für PGlite statt In-Memory-Fake).

## Context

Die Slot-Schreibvorgänge des Interviews passieren heute **als Seiteneffekt in den LLM-Werkzeugen**, nicht im sichtbaren Kontrollfluss. Wenn die KI `record_slot` aufruft, liest das Werkzeug tief in seinem `execute()`-Körper den aktuellen Stand aus Supabase, prüft Idempotenz und Konfliktauflösung (`canOverwrite`), schreibt via `patch_interview_step_field` und meldet dem Modell synchron „ok" oder „STOPP, schon gefüllt" zurück — alles an einer Stelle, fest mit Supabase verschweißt. `runInterviewTurn` (PROJ-33) sieht von diesen Schreibvorgängen nichts; sie liegen zwei Ebenen tiefer (`runAnalystOnline` → `buildTools` → `record_slot.execute` → eigener Supabase-Aufruf).

Code-verifizierte Schreib-Fläche:
- **8 schreibende Werkzeuge** (Grep über alle `tool({` in `src/`, ohne Tests): `update_topics`, `register_step`, `record_slot`, `record_governance`, `record_dependency`, `link_bottleneck`, `update_walkthrough_data` (7 in `buildTools`, `interviewAgent.ts`) plus `produce_briefing` (`interviewAnalyst.ts:454`, schreibt `interviews.next_briefing` + `analyst_status`).
- **Vier Persistenz-Ziele:** `interview_state.step_tracker` (5 Werkzeuge, zwei Mechaniken: Ganz-Array-Update vs. atomarer jsonb_set), `interview_state.topics_*`, `interview_state.extractions_log` + `knowledge_objects` (`link_bottleneck`), `interviews` (`analyst_status`, `next_briefing`).
- **Schreibvorgänge an den Werkzeugen vorbei:** der deterministische `data_sources`-Backfill (`interviewAnalyst.ts:344`, `WriteSource='backfill'`) und die Orchestrierungs-Writes in `runInterviewTurn` (`turns`-Insert, `interview_state`-Update, `analyst_status='processing'`).

Daraus drei Probleme:

1. **Tests brauchen zwingend eine echte Datenbank.** Weil das Schreiben fest an Supabase hängt, kann ein Turn nicht ohne laufende Cloud-DB und realen Workspace geprüft werden. Der Eval-Runner seedet heute eine echte `interviews`/`interview_state`-Zeile (`EVAL_WORKSPACE_ID`) und delegiert pro Turn an `runInterviewTurn`, das intern `getSupabaseAdmin()` nutzt. Evals sind dadurch netzabhängig, langsam und an einen Workspace gebunden. Ein DB-freier Eval ist nicht möglich.
2. **Die Konfliktlogik ist verstreut und nicht prüfbar.** `canOverwrite`, die Idempotenz-Prüfung und der done-Übergang leben im `record_slot`-`execute`-Körper, verklebt mit den DB-Writes. „Funktioniert die Überschreib-Auflösung korrekt?" ist ohne LLM und ohne DB nicht isoliert testbar. Die Evals zeigen `overwrite_churn` konstant bei 0.30–0.45 (Ziel < 0.20, getrackt aber nicht gegated), das Signal lässt sich aber nicht herauslösen.
3. **Mess-Validität (im Geist von ADR-016).** Solange die Schreib-Fläche nur über die echte Supabase testbar ist, evaluiert man Persistenzverhalten nur gegen die gehostete DB — dieselbe Drift-Gefahr, die PROJ-33 für die Turn-Schleife geschlossen hat, bleibt für die Werkzeug-Ebene offen.

Im Vokabular der tiefen Module: die Werkzeuge mischen Lese-/Entscheid-Logik mit einem Schreib-**Seiteneffekt**. Wird der Schreibvorgang zu einer **zurückgegebenen Absicht** (`WriteIntent`) und an einer Stelle angewendet, entsteht der Seam, an dem ein zweiter Adapter (DB-freier Eval) andocken kann. ADR-016 D4 hat genau das vertagt, weil es ohne diesen zweiten Adapter eine hypothetische Naht gewesen wäre. Mit dem DB-freien Eval als erklärtem Ziel ist die Naht jetzt real.

## Scope

### A — Werkzeuge geben Schreibabsichten zurück
Alle **8** schreibenden Werkzeuge geben statt eines DB-Schreibvorgangs eine `WriteIntent` zurück (diskriminierte Union, ein Variant pro Werkzeug). Lese- und Entscheid-Logik bleibt im Werkzeug, wo das LLM sie als sofortiges Feedback braucht (z.B. die Embedding-basierte Schritt-Dedup in `register_step`, die Evidence-Auflösung in `record_slot`); nur der **Write** wird zur Absicht. Ein halber Ausbau (nur `record_slot`) ist ausgeschlossen — er ließe den Port undicht.

### B — TurnStore-Port als zustandsbehafteter Per-Turn-Store
Persistenz wandert hinter einen `TurnStore`-Port. Eine Sitzung pro Schreib-Pass: `openTurn(interviewId)` lädt den Snapshot (`step_tracker` + `topics` + `extractions_log`), `stage(intent)` wendet die Absicht sofort gegen den In-Memory-Snapshot an und meldet synchron `accepted | skipped | blocked` zurück, `commit()` persistiert. **Konfliktauflösung, Idempotenz und der done-Übergang liegen hinter `stage`** — das ist das tiefe Modul, das ohne LLM und ohne DB testbar wird. Der Snapshot ist während des Passes die Wahrheit; die DB ist Persistenz. Der Port-Surface umfasst auch die `interviews`-Writes (`analyst_status`, `next_briefing`) und die Orchestrierungs-Writes (`turns`, `interview_state`).

### C — Aufrufer öffnen und committen Sessions
`buildTools` bekommt die Session als Parameter. Jeder der **drei werkzeugnutzenden Aufrufer** öffnet eine Session um seinen `streamText`-Aufruf und committet danach: `createInterviewStream` (Begrüßung/Reconnect — die Tool-Konversion ist hier in Scope, die Prompt-Drift NICHT, das ist PROJ-37), `interviewAnalyst` (online + catchup, inkl. `produce_briefing`), `interviewQuickExtract`. `runInterviewTurn` bekommt `ports` injiziert (`{ store, onCompleted }`) und ersetzt jeden eigenen `getSupabaseAdmin()`-Zugriff. Der Talker bleibt **unberührt** (werkzeugfrei, ADR-011 D3). Der Backfill und die Orchestrierungs-Writes laufen direkt über Store-Methoden (kein Tool, daher kein Intent), gehen aber für vollständige Konfliktauflösung durch dieselbe `stage`-Logik.

### D — Zwei Adapter
- **Prod:** `SupabaseTurnStore` — schreibt wie heute (`patch_interview_step_field` für jsonb-Felder, gleiche Semantik), nicht-transaktionaler Commit (Prod-Parität).
- **Eval:** `PGliteTurnStore` — gegen eine lokale PGlite-DB, ohne Netz. Lädt das echte Schema aus den Repo-Migrations (`supabase/migrations/`), inkl. `patch_interview_step_field`, mit einem inerten Bootstrap (Stub-Rollen `authenticated`/`anon`/`service_role` + leeres `auth`-Schema + Vektor-Modul), damit die Supabase-spezifischen `GRANT`/`CREATE POLICY`-Zeilen laden, ohne dass die Tests Auth berühren. Gleiche Commit-Semantik wie der Prod-Adapter.

### E — Post-Completion bleibt draußen
`runInterviewTurn` bekommt die Post-Completion-Pipeline (`createProcessStepsFromTracker`, `clusterProcessSteps`, `deduplicateKnowledgeObjects`, `extractAndEmbed`) als injizierte `ports.onCompleted`. Prod = echte Pipeline, Eval = No-op. Begründung: Der Interview-Eval scort den `step_tracker`, nicht die nachgelagerte Ableitung; die Embeddings sind eine externe API, die kein DB-Adapter wegnimmt.

### F — Drei Test-Stufen
1. **Reine Logik, keine DB:** Konfliktauflösung/Applier als reine Funktion auf einem `StepEntry[]`-Snapshot. Hier die Masse der Tests (canOverwrite, Idempotenz, done-Übergang).
2. **Dev-Test (PGlite, hermetisch):** Persistenz-Rundreise — erzeugt `stage`+`commit` die richtigen Zeilen, überlebt der jsonb-Wert die Funktion (PROJ-38-Klasse). Hier läuft der DB-freie Eval.
3. **Prod-Test (echte Supabase, gegated):** dieselben Persistenz-Behauptungen gegen die gehostete DB, nightly/vor Deploy — der Treue-Anker gegen Schema-Drift.

### G — Verhaltensneutral
Die komponierte Schreib-Wirkung (was im `step_tracker` und den übrigen Zielen landet) bleibt identisch. Konfliktregeln, Idempotenz und done-Übergang wandern **unverändert**. Der Slot-Write-Trail (`emitSlotWrite`) feuert weiter pro Absicht, damit `overwrite_churn` vergleichbar bleibt. Die Churn-Reduktion ist explizit ein eigenes Folge-Feature.

## User Stories

- Als **KI-Berater / Eval-Nutzer** möchte ich einen Interview-Eval ohne Cloud-DB und ohne Workspace-Bindung fahren, damit Modellvergleiche schnell, hermetisch und reproduzierbar laufen.
- Als **Entwickler** möchte ich die Slot-Konfliktauflösung (Überschreiben, Idempotenz, done-Übergang) ohne LLM und ohne DB testen, damit ich die `overwrite_churn`-Pathologie isoliert prüfen und später gezielt fixen kann.
- Als **Entwickler** möchte ich die Schreibvorgänge der Werkzeuge an einer Stelle anwenden statt verstreut in 8 `execute()`-Körpern, damit Invarianten und Konfliktregeln Lokalität haben.
- Als **Eval-Nutzer** möchte ich, dass der DB-freie Eval beweisbar dasselbe Persistenzverhalten zeigt wie Prod, damit der gemessene Vorteil nicht durch eine Test-gegen-Prod-Divergenz erkauft ist.

## Acceptance Criteria

- [ ] Ein `WriteIntent`-Typ (diskriminierte Union) deckt **alle 8** schreibenden Werkzeuge ab; jedes der 8 `execute()` gibt eine Absicht zurück und enthält **keinen** direkten `supabase`/`getSupabaseAdmin()`-Schreibvorgang mehr.
- [ ] Ein `TurnStore`-Port existiert mit `openTurn(interviewId)` → `{ snapshot(), stage(intent), commit() }`; `stage` gibt synchron `accepted | skipped | blocked` zurück.
- [ ] Konfliktauflösung (`canOverwrite`), Idempotenz-Prüfung und done-Übergang liegen hinter `stage` und sind in reinen Logik-Tests (Stufe 1) ohne DB und ohne LLM abgedeckt.
- [ ] `runInterviewTurn` nimmt `ports = { store, onCompleted }`; im Turn-Pfad gibt es **keinen** direkten `getSupabaseAdmin()`-Zugriff mehr (Loads, `turns`-Insert, `interview_state`- und `interviews`-Updates laufen über den Store).
- [ ] Die drei werkzeugnutzenden Aufrufer (`createInterviewStream`, `interviewAnalyst` online+catchup inkl. `produce_briefing`, `interviewQuickExtract`) öffnen je eine Session und committen; der Talker bleibt werkzeug- und schreibfrei.
- [ ] Der `data_sources`-Backfill und die Orchestrierungs-Writes laufen über Store-Methoden / dieselbe `stage`-Konfliktlogik, nicht an ihr vorbei.
- [ ] `SupabaseTurnStore` (Prod) und `PGliteTurnStore` (Eval) erfüllen denselben Port; der PGlite-Adapter lädt das echte Migrations-Schema inkl. `patch_interview_step_field` über einen inerten Bootstrap (Stub-Rollen + `auth`-Schema + Vektor-Modul).
- [ ] Der Eval-Runner läuft mit `PGliteTurnStore` **ohne** Netz und ohne `EVAL_WORKSPACE_ID`-Supabase-Zugriff für Seed, Turn-Writes und Ergebnis-Reads.
- [ ] `ports.onCompleted` ist injiziert: Prod fährt die Post-Completion-Pipeline, der Eval ein No-op.
- [ ] Der Slot-Write-Trail feuert weiter pro Absicht; `overwrite_churn` bleibt berechenbar.
- [ ] **Treue-Nachweis:** DB-freier Eval (PGlite, Stufe 2) und DB-gestützter Eval (echte Supabase, Stufe 3) liefern auf derselben Persona und demselben Seed identische Scores.
- [ ] **Verhaltensneutral:** `npm run eval:interview buchhalter` nach PROJ-34 zeigt dieselben Kern-Scores wie davor (slot_coverage, depth, `overwrite_churn` ≈ 0.38) — jede Abweichung ist ein Regress-Alarm, kein Erfolg.
- [ ] Ein Zwei-Adapter-Vertrag-Test prüft dieselben Persistenz-Behauptungen gegen PGlite (jeder Lauf) und gegen echte Supabase (gegated).
- [ ] `npm run lint` und `npm test` grün; neue Dependency `@electric-sql/pglite` ist installiert.
- [ ] Eval-Gate (Domain Interview Engine): ein erfolgreicher `eval:interview`-Lauf ist vor Status=Approved nachgewiesen.

## Edge Cases

- **Intra-Stream-Read-after-Write:** Ruft derselbe Stream `register_step` und danach `record_slot` auf, muss `record_slot` den neuen Schritt sehen. `stage` wendet sofort gegen den lebenden Snapshot an, also bleibt das Read-after-Write innerhalb des Passes intakt — anders als bei einem Applier, der erst am Pass-Ende schreibt.
- **Blockierte Absicht:** `stage` gibt `blocked` zurück (z.B. niedrigere Priorität bei besetztem Slot); das Werkzeug mappt das auf dieselbe LLM-Fehlermeldung wie heute (`is_correction=true`-Hinweis), damit das Modell nicht weiter retryt. Der Trail emittiert das Blocked-Event wie bisher.
- **Doppelter `produce_briefing`-Call:** Heute soll das Werkzeug nach dem ersten Aufruf die Sequenz beenden; als Intent bleibt die „genau einmal pro Turn"-Regel erhalten — ein zweiter Intent wird beim `stage` als `skipped` zurückgegeben.
- **`link_bottleneck` schreibt zwei Ziele:** ein `knowledge_objects`-Insert **und** ein `extractions_log`-Append. Die Absicht trägt beide; der Commit wendet beide an. Im PGlite-Adapter müssen `knowledge_objects` (mit nullbarer Embedding-Spalte) vorhanden sein, damit der Insert nicht bricht.
- **Crash mitten im Turn:** Heute ist jeder jsonb_set sofort persistent; im Snapshot-Modell hängt das vom Commit-Zeitpunkt ab. Für den synthetischen Eval irrelevant; für Prod ein bewusster Trade-off (Commit-Granularität wird in `/architecture` festgelegt, Default: pro Pass committen, also Sofort-Persistenz pro Schreib-Pass beibehalten).
- **Gleichzeitiger Fremd-Write auf dasselbe Interview:** Der Snapshot sieht ihn nicht. In der Praxis ist ein Turn eine Anfrage mit einem Schreiber; die Annahme „ein Schreiber pro Turn" wird bewusst eingebacken.
- **PGlite lädt eine Supabase-Migration nicht:** Bricht eine Migration trotz Bootstrap (unbekanntes Konstrukt), schlägt der Adapter-Setup-Test hart fehl statt still zu driften — der Stufe-3-Vertrag-Test ist die zweite Verteidigungslinie.
- **Schema-Drift Repo-Migrations ↔ gehostete DB:** Der gegatete Stufe-3-Test gegen die echte Supabase fängt eine Migration, die nur in der Cloud angewendet wurde.

## Technical Requirements

- **Service-Layer-Constraint:** Port, Adapter und Applier-Logik liegen in `src/services/`.
- **Kein `next/server`-Import im Modul:** `after()` bleibt beim Prod-Aufrufer (wie PROJ-33), damit der `tsx`-Eval-Pfad lädt.
- **Verhaltensneutral:** keine Änderung an Konfliktregeln, Idempotenz, done-Übergang oder Commit-Semantik (nicht-transaktional, Prod-Parität). Churn-Fix ist Out of Scope.
- **Neue Dependency:** `@electric-sql/pglite` (+ Vektor-Modul) — keine Major-Upgrades bestehender Pakete.
- **Keine DB-Migration, kein Schema-Change in Prod:** der Port ändert die Persistenz-Wege, nicht das Schema. Die Repo-Migrations bleiben die einzige Schema-Wahrheit (auch für PGlite).
- **Eval-Gate vor Approved:** `npm run eval:interview buchhalter`, plus der Treue-Nachweis (PGlite-Scores == Real-DB-Scores).

## Out of Scope

- **Churn-Reduktion.** PROJ-34 macht `overwrite_churn` erstmals isoliert testbar; die eigentliche Verschärfung der Prioritätsregel (z.B. `analyst` darf `analyst` nicht mehr frei überschreiben) ist ein eigenes Folge-Feature, getrennt aus Mess-Disziplin.
- **Begrüßungs-Prompt-Drift (→ PROJ-37).** Die Tool-Konversion des Begrüßungspfads (`createInterviewStream`) ist in Scope; die inhaltliche Konsolidierung von `buildStaticPrompt()` vs. `STATIC_PROMPT` ist es nicht.
- **Post-Completion-Pipeline + Embeddings hinter den Port.** Bleibt injiziert (`ports.onCompleted`), im Eval No-op; die Embeddings sind eine externe API.
- **Konsolidierung von Start/Reconnect/Clarification zu einem Turn.** Eigene Endpunkte, nicht Teil eines Chat-Turns (wie PROJ-33).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |