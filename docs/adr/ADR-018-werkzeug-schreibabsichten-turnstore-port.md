# ADR-018: Werkzeug-Schreibabsichten + TurnStore-Port (hebt ADR-016-Vertagung auf)

**Status:** Proposed (2026-06-22)
**Author:** Lias Hemmersbach (Solo dev)
**Repository:** meridian-app
**Feature:** PROJ-34
**Bezug:** ADR-016 (Turn-Naht, vertagte den Port), ADR-015 (Slot-Write-Trail, bleibt Mess-Signal), ADR-011 (Dual-Loop, Talker bleibt werkzeugfrei)

---

## Context

PROJ-33 (ADR-016) hat die Turn-Schleife in das tiefe Modul `runInterviewTurn` konsolidiert. Route und Eval-Runner wurden dünne Adapter. ADR-016 hat dabei zwei Dinge bewusst **vertagt** (D4 dort): den TurnStore-Port und die Umstellung der Werkzeuge auf zurückgegebene Schreib-Absichten. Begründung damals: ohne einen zweiten echten Adapter wäre der Port Indirektion ohne Nutzen.

Die Schreibvorgänge des Interviews passieren heute als Seiteneffekt tief in den LLM-Werkzeugen. Acht schreibende Werkzeuge (`update_topics`, `register_step`, `record_slot`, `record_governance`, `record_dependency`, `link_bottleneck`, `update_walkthrough_data` in `buildTools`, plus `produce_briefing` im Analyst) lesen jeweils selbst aus Supabase, entscheiden über Konflikte und schreiben selbst zurück. `runInterviewTurn` sieht von diesen Schreibvorgängen nichts; sie liegen zwei Ebenen tiefer. Daraus drei konkrete Probleme:

1. **Tests brauchen zwingend eine echte Datenbank.** Ein Turn ist nicht ohne laufende Cloud-DB und realen Workspace prüfbar. Der Eval-Runner seedet eine echte `interviews`/`interview_state`-Zeile (`EVAL_WORKSPACE_ID`). Evals sind netzabhängig, langsam, an einen Workspace gebunden. Ein DB-freier Eval ist nicht möglich.
2. **Die Konfliktlogik ist verstreut und nicht isoliert prüfbar.** `canOverwrite`, Idempotenz-Prüfung und der done-Übergang leben im `record_slot`-Körper, verklebt mit den DB-Writes. „Funktioniert die Überschreib-Auflösung?" ist ohne LLM und ohne DB nicht testbar. `overwrite_churn` liegt konstant bei 0.30 bis 0.45 (Ziel < 0.20), das Signal lässt sich aber nicht herauslösen.
3. **Mess-Validität.** Solange die Schreib-Fläche nur über die echte Supabase testbar ist, evaluiert man Persistenzverhalten nur gegen die gehostete DB. Dieselbe Drift-Gefahr, die ADR-016 für die Turn-Schleife geschlossen hat, bleibt für die Werkzeug-Ebene offen.

Der entscheidende Kontext-Wechsel gegenüber ADR-016: mit dem **DB-freien Eval als erklärtem Ziel** existiert jetzt der zweite Adapter, der den Port rechtfertigt. Die Naht ist nicht mehr hypothetisch. Damit ist die ADR-016-Vertagung aufzuheben.

## Decision

Die acht schreibenden Werkzeuge geben statt eines DB-Schreibvorgangs eine **Schreib-Absicht** zurück. Persistenz wandert hinter einen **TurnStore-Port** mit zwei Adaptern. Konkret sechs Entscheidungen:

**D1: Schreibabsicht statt Seiteneffekt.** Alle acht Werkzeuge geben eine `WriteIntent` zurück (unterscheidbare Union, eine Variante pro Werkzeug). Lese- und Entscheid-Logik bleibt im Werkzeug, wo das LLM sofortiges Feedback braucht (Embedding-Dedup in `register_step`, Beleg-Auflösung in `record_slot`). Nur der Schreibvorgang wird zur Absicht. Halber Ausbau (nur `record_slot`) ist ausgeschlossen, er ließe den Port undicht.

**D2: TurnStore-Port mit zustandsbehafteter Session pro Schreib-Pass.** `openTurn(interviewId)` lädt den Snapshot (`step_tracker` + `topics` + `extractions_log`), `stage(intent)` wendet die Absicht sofort gegen den In-Memory-Snapshot an und meldet synchron `accepted | skipped | blocked`, `commit()` persistiert. Eine Session pro LLM-Pass. Der Snapshot ist während des Passes die Wahrheit; die DB ist Persistenz. Read-after-Write innerhalb des Passes ist damit garantiert statt zufällig. Die Annahme „ein Schreiber pro Turn" wird bewusst eingebacken.

**D3: `stage()` ist das tiefe Modul.** Konfliktauflösung (`canOverwrite`), Idempotenz-Prüfung und der done-Übergang wandern **unverändert** aus dem `record_slot`-Körper hinter `stage`. Das ist der Kern-Gewinn: diese Logik wird als reine Funktion auf einem `StepEntry[]`-Snapshot ohne LLM und ohne DB testbar. Die `overwrite_churn`-Pathologie wird damit erstmals isoliert prüfbar.

**D4: Zwei Adapter, ein Vertrag.** Prod = `SupabaseTurnStore`, schreibt wie heute (`patch_interview_step_field` für jsonb-Felder, gleiche Semantik). Eval = `PGliteTurnStore` gegen eine lokale PGlite-DB ohne Netz, lädt das echte Schema aus den Repo-Migrations über einen inerten Bootstrap (Stub-Rollen `authenticated`/`anon`/`service_role`, leeres `auth`-Schema, Vektor-Modul). Die Repo-Migrations bleiben die einzige Schema-Wahrheit, auch für PGlite.

**D5: Commit pro Schreib-Pass (nicht-transaktional, Prod-Parität).** `commit()` schreibt am Pass-Ende alle gestageten Writes sequenziell. Die Alternative Write-through pro `stage()` (jeder Slot sofort persistent, exakte Crash-Parität mit heute) wurde verworfen: sie verwässert das „Snapshot ist die Wahrheit"-Modell und erzeugt mehr DB-Roundtrips. Bewusster Trade-off: ein Crash mitten im Pass verliert den ganzen Pass statt einzelner Slots. Fenster ist ein LLM-Pass, für einen Solo-MVP akzeptabel, für den synthetischen Eval irrelevant. Beide Adapter nutzen dieselbe Commit-Semantik, sonst wäre der gemessene Eval-Vorteil durch eine Test-gegen-Prod-Divergenz erkauft.

**D6: Post-Completion bleibt injiziert, nicht hinter dem Port.** `runInterviewTurn` bekommt `ports = { store, onCompleted }`. Prod fährt die echte Pipeline (`createProcessStepsFromTracker`, `clusterProcessSteps`, `deduplicateKnowledgeObjects`, `extractAndEmbed`), der Eval ein No-op. Der Interview-Eval bewertet den `step_tracker`, nicht die nachgelagerte Ableitung; die Embeddings sind eine externe API, die kein DB-Adapter ersetzt.

Aufrufer-Bindung: die drei werkzeugnutzenden Aufrufer (`createInterviewStream`, `interviewAnalyst` online + catchup inkl. `produce_briefing`, `interviewQuickExtract`) öffnen je eine Session und committen. `runInterviewTurn` bekommt `ports` injiziert und ersetzt jeden eigenen `getSupabaseAdmin()`-Zugriff. Der `data_sources`-Backfill und die Orchestrierungs-Writes laufen über Store-Methoden (Backfill durch dieselbe `stage`-Konfliktlogik, Orchestrierungs-Writes als reine Store-Methoden ohne Intent). Der Talker bleibt werkzeug- und schreibfrei (ADR-011 D3). `after()` bleibt beim Prod-Aufrufer (ADR-016), das Modul importiert kein `next/server`.

**Verhaltensneutralität ist die Erfolgsbedingung.** Konfliktregeln, Idempotenz und done-Übergang wandern unverändert. Der Slot-Write-Trail (`emitSlotWrite`, ADR-015) feuert weiter pro Absicht, damit `overwrite_churn` vergleichbar bleibt. Die Churn-Reduktion ist ein eigenes Folge-Feature (Out of Scope), getrennt aus Mess-Disziplin.

## Consequences

**Positiv:**
- DB-freier Eval wird möglich: `npm run eval:interview` läuft mit `PGliteTurnStore` ohne Netz und ohne `EVAL_WORKSPACE_ID`. Schnell, hermetisch, reproduzierbar.
- Die Konfliktauflösung wird als reine Funktion testbar (Stufe 1). `overwrite_churn` lässt sich isoliert prüfen und später gezielt fixen.
- Locality: die Schreibvorgänge werden an einer Stelle angewandt statt verstreut in acht `execute()`-Körpern. Invarianten haben einen Ort.
- Mess-Validität auf der Werkzeug-Ebene, analog zu dem, was ADR-016 für die Turn-Schleife erreicht hat.

**Negativ / Trade-offs:**
- Neue Abhängigkeit `@electric-sql/pglite` (plus Vektor-Modul) für Eval-Adapter und hermetische Dev-Tests.
- Crash mitten im Schreib-Pass verliert in Prod den ganzen Pass statt einzelner Slots (D5). Bewusster Trade-off.
- Hauptrisiko: PGlite lädt eine Supabase-Migration trotz Bootstrap nicht. Mitigation: harter Setup-Fehler statt stiller Drift, plus gegateter Stufe-3-Vertrag-Test gegen echte Supabase.
- `/eval-interview` muss eine Adapter-Auswahl (Dev-Eval vs. Prod-Eval) bekommen und die Post-Run-Analyse für den DB-freien Pfad aus Runner-Artefakten statt Supabase MCP lesen. Ohne dieses `SKILL.md`-Update entsteht eine Skill-gegen-Runner-Divergenz (vgl. KI-6).

**Folgeentscheidungen:**
- Churn-Reduktion (Verschärfung der Prioritätsregel) als eigenes Feature nach PROJ-34, sobald `overwrite_churn` isoliert testbar ist.
- PROJ-37 (Static-Prompt-Drift Talker vs. Greeting/Reconnect) bleibt getrennt; PROJ-34 konvertiert den Begrüßungspfad auf Werkzeuge, konsolidiert aber die Prompts nicht.

---

> Status bleibt **Proposed** bis explizit auf **Accepted** gewechselt. Nach Accepted nicht mehr editieren. Bei Änderung neuen ADR mit `Supersedes: ADR-018` anlegen.