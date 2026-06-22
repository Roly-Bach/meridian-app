---
name: eval-interview
description: Führt einen vollständigen Eval-Lauf des Interview-Agenten mit einer synthetischen Persona durch.
argument-hint: "<persona: buchhalter | vertriebler | it-support>"
user-invocable: true
---

# Eval-Interview Skill

## Zweck

Führt einen vollständigen Eval-Lauf des Interview-Agenten durch. Seit PROJ-13 (2026-05-28) läuft der Lauf vollständig automatisiert via `runner.ts` — kein manueller curl-Loop, kein Claude-as-Persona. Der Runner erstellt den Interview-Record, simuliert die Persona mit einem LLM (Tester-Modell) und schreibt alle Spans in Langfuse. Dieser Skill orchestriert den Aufruf und führt danach die Befundanalyse durch.

## Voraussetzungen

- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` in `.env.local` gesetzt
- Dev-Server NICHT nötig — der Runner läuft direkt via tsx, kein localhost

**Nur im Supabase-Backend (`--store supabase`, Default):**
- `EVAL_WORKSPACE_ID` in `.env.local` gesetzt (seit 2026-05-28 bereits gesetzt)
- Supabase MCP verbunden (für die Post-Run-Analyse)

**Im PGlite-Backend (`--store pglite`):** keine dieser beiden nötig. Die DB ist eine lokale In-Process-Instanz, die am Lauf-Ende verworfen wird — kein `EVAL_WORKSPACE_ID`, kein Supabase, keine Netzwerkverbindung (PROJ-34 / ADR-018).

## Aufruf

```
/eval-interview <persona>
```

- `<persona>` = `buchhalter` | `vertriebler` | `it-support`
- Modelle werden ausschließlich aus `.env.local` gelesen (`INTERVIEW_MODEL`, `EXTRACTION_MODEL`, `ENRICHMENT_MODEL`, `TESTER_MODEL`). Kein Modell-Argument am Skill-Aufruf.

---

## Schritt-für-Schritt-Ablauf

### Schritt 0: Modell-Konfiguration anzeigen und bestätigen

Lese `.env.local` und extrahiere alle Modell-Vars (Fallback in Klammern):

```
INTERVIEW_MODEL         = <Wert> (fallback: google/gemini-3.1-flash-lite)
INTERVIEW_TALKER_MODEL  = <Wert> (fallback: INTERVIEW_MODEL)   ← Talker: text-only
INTERVIEW_ANALYST_MODEL = <Wert> (fallback: INTERVIEW_MODEL)   ← Analyst: tool-calls
EXTRACTION_MODEL        = <Wert> (fallback: google/gemini-3.1-flash-lite)
ENRICHMENT_MODEL        = <Wert> (fallback: google/gemini-3.1-flash-lite)
TESTER_MODEL            = <Wert> (fallback: google/gemini-3.1-flash-lite)
```

Thinking-Budgets (hardcoded in Services, nicht via env — Orchestrator ist rule-based, kein LLM):
- Talker:  `TALKER_THINKING_BUDGET`  (aus `interviewTalker.ts` — aktuell 512)
- Analyst: `ANALYST_THINKING_BUDGET` (aus `interviewAnalyst.ts` — aktuell 2048)

Zeige die Liste dem Nutzer und frage via `AskUserQuestion`:
- Frage: „Passt die Modell-Konfiguration?"
- Option A: „Ja, Eval starten"
- Option B: „Nein, ich passe .env.local zuerst an"

Bei Option B: Ablauf beenden. Kein Runner-Start.

### Schritt 0b: Persistenz-Backend wählen (`--store`)

Frage via `AskUserQuestion`: „Welches Persistenz-Backend?"
- Option A (Default): „Supabase — gegen die echte DB, volle Pipeline (Extraktion, Clustering, process_steps/use_cases)". Braucht `EVAL_WORKSPACE_ID` + Supabase MCP. Der Lauf schreibt echte Records (bleiben in der DB).
- Option B: „PGlite — DB-frei, lokal in-process". Kein `EVAL_WORKSPACE_ID`, kein Netz. Extraktion/Embedding und die Post-Completion-Pipeline laufen **nicht** (No-op-Ports). Der bewertete `step_tracker` ist davon unberührt, also bleiben die Kern-Scores vergleichbar.

Merke die Wahl als `<store>` (`supabase` | `pglite`). Sie bestimmt **sowohl** das `--store`-Flag in Schritt 2 **als auch** die Datenquelle der Post-Run-Analyse in Schritt 3.

**Divergenz-Warnung (KI-6-Klasse):** Im PGlite-Lauf existiert nach Lauf-Ende keine abfragbare DB. Schritt 3 darf dann **niemals** Supabase MCP / SQL nutzen — die Analyse liest ausschließlich die vom Runner geschriebenen Artefakte. Wer die Backend-Wahl in Schritt 3 ignoriert, erzeugt genau die Skill-gegen-Runner-Divergenz, die KI-6 beschreibt.

### Schritt 1: Persona-Datei lesen

Lese die Persona-Datei um PASS-Kriterien ableiten zu können:
- `buchhalter` → `src/services/__evals__/interview/personas/buchhalter.ts`
- `vertriebler` → `src/services/__evals__/interview/personas/vertriebler.ts`
- `it-support`  → `src/services/__evals__/interview/personas/it-support.ts`

Extrahiere:
- `identity.name`, `identity.role`, `identity.department`
- `processKnowledge.processes[].name` (erwartete Schritte, für PASS-Kriterien)

### Schritt 2: Runner starten

Baue den Befehl aus Persona und Backend-Wahl (`<store>` aus Schritt 0b):

```bash
# Supabase (Default) — das Flag kann entfallen:
npm run eval:interview <persona>

# PGlite (DB-frei):
npm run eval:interview -- --personas <persona> --store pglite
```

Alternativ steuert `EVAL_STORE=pglite` in `.env.local` denselben Schalter; das `--store`-Flag hat Vorrang. Default ist `supabase`, damit der Standard-Lauf byte-genau das bisherige Verhalten zeigt (PROJ-34 / ADR-018).

Alle Modell-Env-Vars (`INTERVIEW_MODEL`, `EXTRACTION_MODEL`, `ENRICHMENT_MODEL`, `TESTER_MODEL`) werden vom Runner via dotenv aus `.env.local` geladen. Kein CLI-Prefix nötig.

`LANGFUSE_ENABLED` wird vom Runner intern auf `true` gesetzt (process.env, prozess-lokal) und kehrt nach Abschluss automatisch auf den `.env.local`-Wert zurück.

Führe den Befehl aus (timeout 10 Minuten — ein vollständiges Interview dauert 3–7 Min).

**Beide Modelle — Interview-Agent und Tester-Persona — verwenden dieselbe Google AI API** (`GOOGLE_GENERATIVE_AI_API_KEY`). Das Tester-Modell ist per Default `google/gemini-3.1-flash-lite` und kann via `TESTER_MODEL` überschrieben werden. Für Benchmarking-Läufe immer den Tester auf Flash Lite lassen, damit nur der Agent variiert.

Der Runner gibt auf stdout aus:
- `[runner] seed=<n> runs=<n> … store=<supabase|pglite>` — bestätigt das gewählte Backend
- `[eval] model=<m> persona=<p> store=<supabase|pglite> evalRunId=<uuid>` — merke `evalRunId`
- `[eval] Interview created: <uuid>` — merke `interviewId`
- Pro Turn: `[Agent]: <text>` und `[<persona.name>]: <text>`
- Am Ende: `[eval] Done.` + Langfuse-Session-URL + `eval_run_id`

Notiere `interviewId`, `evalRunId` und die Langfuse-Session-URL aus dem stdout.

Falls der Runner mit Fehler abbricht:
- `EVAL_WORKSPACE_ID not set` → Setup-Problem, `.env.local` prüfen
- Supabase-Verbindungsfehler → Supabase-Keys in `.env.local` prüfen
- LLM-API-Fehler → API-Key oder Modell-Name prüfen

### Schritt 3: Post-Run-Analyse (verzweigt nach Backend aus Schritt 0b)

**Wahl der Datenquelle:**
- `<store> = supabase` → **Variante A** (Supabase MCP / SQL).
- `<store> = pglite` → **Variante B** (Runner-Artefakte). Die DB ist nach Lauf-Ende weg; Supabase MCP ist hier verboten und würde fremde oder leere Daten liefern.

---

#### Variante A — Supabase-Backend (Supabase MCP)

**Interview-Status:**
```sql
SELECT status, created_at, updated_at FROM interviews WHERE id = '<interviewId>';
```

**Slot-Tracker:**
```sql
SELECT step_tracker FROM interview_state WHERE interview_id = '<interviewId>';
```

Lies `step_tracker` vollständig aus — enthält pro registriertem Schritt:
- `title`, `status` (`exploring` | `walkthrough` | `done`)
- `slots` (O1–O6-Coverage, PROJ-25/27-Schema): `bezeichnung` (O1, =Titel), `reihenfolge` (O1), `entscheidungslogik` (O2), `tazite_cues` (O2), `ausnahmen` (O3), `inputs` (O4), `outputs` (O4), `hilfsmittel` (O5), `abhaengigkeiten` (O6 — direkt unter `step`, nicht unter `slots`)
  - Slot-Wert: `null` oder `{ value, quote, confidence }` (arrays für Listen-Felder)
- `potenzial`-Facette (separat, nicht in Coverage gezählt): `frequency_per_month`, `duration_minutes`, `error_rate_percent`, `media_breaks` (je `null` oder `{ value, quote }`)
- `governance` (separat): `rolle`, `organisationseinheit`, `systeme`

**Turns (für Transcript-Rekonstruktion):**
```sql
SELECT turn_number, user_input, agent_response
FROM turns WHERE interview_id = '<interviewId>'
ORDER BY turn_number;
```

**Extrahierte Wissensobjekte:**
```sql
SELECT type, content, source_quote FROM knowledge_objects
WHERE interview_id = '<interviewId>'
ORDER BY created_at;
```

---

#### Variante B — PGlite-Backend (Runner-Artefakte, kein Supabase)

Der Runner schreibt nach `docs/evals/interview/<YYYY-MM-DD>/` drei Dateien (Basisname `<YYYY-MM-DD>-<HH-MM-SS>-<modelslug>-<persona>`):

| Datei | Inhalt | ersetzt welche SQL-Abfrage |
|-------|--------|---------------------------|
| `*.transcript.json` | `finalStepTracker` (voller Slot-Tracker, gleiche Form wie `step_tracker`), `scores`, `status` (Lifecycle: `completed`/`active`), `turns` (`turnNumber`, `userInput`, `agentText`, `phase`, `toolCalls`) | Interview-Status, Slot-Tracker, Turns |
| `*.md` | Report mit Frontmatter-`status:` (das automatische PASS/FAIL-Gate), Score-Tabelle, `trail:`-Block, Slot-Tabelle, Judge-Begründung | menschenlesbare Aufbereitung |
| `*.slot-trail.jsonl` | eine Zeile pro Schreibabsicht (`blocked`, `overwrite`, `source`) | Schreibpfad-Diagnose |

Lies mit dem `Read`-Tool die `*.transcript.json` (maschinell, für `finalStepTracker` + `scores`) und die `*.md` (für die fertige Slot-/Score-Tabelle). **Kein** Supabase MCP, **kein** `SELECT`.

**Wissensobjekte / process_steps gibt es im PGlite-Lauf nicht** — Extraktion und Pipeline sind No-op (DB-frei). Das ist erwartet, kein Befund. Die Treue-Aussage stützt sich auf `finalStepTracker` + `scores`, nicht auf abgeleitete Records.

### Schritt 4: PASS/FAIL bestimmen

**Maßgeblich ist das automatische Gate** aus dem Runner: das Frontmatter-`status:`-Feld im `*.md`-Report (identisch in beiden Backends, berechnet in `runner.ts` aus `completion_correctness`, `dedup_slot_coverage ≥ 0.75`, `step_registration_coverage ≥ 0.8`, `dialog_naturalness ≥ 0.65`, `blocked_rate < 0.10`). Die folgenden manuellen Kriterien sind ein menschlicher Gegencheck. Weichen sie vom Runner-Gate ab, gewinnt das Runner-Gate; die Abweichung ist als Befund zu notieren (das ist die KI-6-Schuld — Gate und manuelle Kriterien sind noch nicht deckungsgleich).

Ein Eval-Lauf gilt als **PASS** wenn:
1. `interview.status = 'completed'`
2. Mindestens 2 Prozessschritte in `step_tracker` mit `status != 'exploring'`
3. Mindestens 1 Schritt mit gefüllten taziten O-Slots: mind. ein Wert in `entscheidungslogik` (O2), `tazite_cues` (O2) oder `ausnahmen` (O3) ist nicht null
4. Kein Turn mit leerem `agent_response`
5. Kein Dreiwiederholungsmuster bei Agent-Fragen (visuell aus stdout prüfen)

Ein Eval-Lauf gilt als **FAIL** wenn:
- `interview.status != 'completed'` nach dem Runner-Ende
- Kein einziger `register_step`-Call (step_tracker leer)
- Runner beendet mit non-zero Exit-Code ohne `[eval] Done.`
- Sicherheits-Maximum 25 Turns (Runner-intern) erreicht ohne Abschluss

**Partial PASS** (dokumentieren, kein Abbruch-Fehler):
- Interview abgeschlossen, aber < 2 Schritte registriert
- Interview abgeschlossen, aber Pflicht-Slots unvollständig
- Lauf vollständig, aber Extraktion fehlgeschlagen (Langfuse zeigt Fehler-Span)

### Schritt 5: Transcript schreiben

**PFLICHT — Ordner anlegen:**
```bash
mkdir -p docs/evals/interview/YYYY-MM-DD
```

Ermittle Timestamp:
```bash
date +"%Y-%m-%d-%H-%M-%S"
```

Dateiname: `YYYY-MM-DD-HH-MM-SS-<persona>.md`
Ablage: `docs/evals/interview/YYYY-MM-DD/YYYY-MM-DD-HH-MM-SS-<persona>.md`

```markdown
---
interview_model: <INTERVIEW_MODEL-Wert>
tester_model: <TESTER_MODEL-Wert oder "google/gemini-3.1-flash-lite" (default)>
talker_model: <INTERVIEW_TALKER_MODEL ?? INTERVIEW_MODEL>
talker_thinking_budget: <TALKER_THINKING_BUDGET aus interviewTalker.ts>
analyst_model: <INTERVIEW_ANALYST_MODEL ?? INTERVIEW_MODEL>
analyst_thinking_budget: <ANALYST_THINKING_BUDGET aus interviewAnalyst.ts>
eval_date: YYYY-MM-DD
persona: <persona-name>
interview_id: <interviewId>
eval_run_id: <evalRunId>
langfuse_session: <Langfuse-Session-URL>
turns_total: <Anzahl Turns aus DB>
status: PASS | FAIL | PARTIAL PASS
---

## Gesprächsverlauf

[Turn 1] Agent: "<agent_response>"
[Turn 1] Persona (<name>): "<user_input>"
[Turn 2] Agent: "<agent_response>"
[Turn 2] Persona (<name>): "<user_input>"
...
[PASS / FAIL / PARTIAL PASS] <Abschluss-Label mit Begründung>

## Slot-Filling-Stand

| Schritt | Status | entscheidungslogik (O2) | tazite_cues (O2) | ausnahmen (O3) | inputs (O4) | outputs (O4) | hilfsmittel (O5) | frequency | duration | error_rate | media_breaks |
|---------|--------|------------------------|------------------|----------------|-------------|--------------|------------------|-----------|----------|------------|--------------|
| <title> | done   | <wert>                 | <wert>           | <wert>         | <wert>      | <wert>       | <wert>           | <wert>    | <wert>   | <wert>     | <wert>       |

## Extrahierte Wissensobjekte

| Typ | Content | Source Quote |
|-----|---------|--------------|
| <type> | <content summary> | <source_quote> |

## Befunde

<Liste aller beobachteten Auffälligkeiten, Regressionen oder positiven Verhalten>
<Verweise auf Langfuse-Spans wo relevant (via eval_run_id filter)>
```

### Schritt 6: Interview-Record bleibt in DB

Kein Cleanup. Der Record bleibt für manuelle Nachkontrolle in der App-UI und Pipeline-Tests.

### Schritt 7: Abschluss-Output

```
Eval-Lauf abgeschlossen — <PASS/FAIL/PARTIAL PASS>
Transcript:    docs/evals/interview/YYYY-MM-DD/YYYY-MM-DD-HH-MM-SS-<persona>.md
Interview-ID:  <interviewId>
eval_run_id:   <evalRunId>
Langfuse:      <Session-URL>

Langfuse MCP-Queries (Beispiele):
  "Show me the last eval run for persona <persona> with model <model>"
  "Compare tool-call sequences between two eval runs by eval_run_id"
  "What was the total token cost for interview session <interviewId>?"

Nächste Schritte (manuelle Pipeline-Tests — nur Supabase-Backend):
  → Prozessschritte prüfen: SELECT * FROM process_steps WHERE interview_id = '<id>';
  → Use Cases prüfen:       SELECT * FROM use_cases WHERE process_step_id IN (
                              SELECT id FROM process_steps WHERE interview_id = '<id>'
                            );
```

Im PGlite-Backend entfallen diese Schritte: keine persistente DB, keine Pipeline. Für den Treue-Nachweis (PROJ-34) denselben Lauf mit `--store supabase` und `--store pglite` auf gleicher Persona + gleichem `--seed` fahren und die Kern-Scores (`slot_coverage`, `dedup_slot_coverage`, `step_registration_coverage`, `dialog_naturalness`) der beiden Reports vergleichen — Gleichstand belegt Backend-Neutralität.

---

## Modell-Vergleich (primärer Use Case von PROJ-13)

Um zwei Modelle direkt zu vergleichen, setze `INTERVIEW_MODEL` in `.env.local` und führe den Skill zweimal aus:

1. `.env.local`: `INTERVIEW_MODEL=google/gemini-3.1-flash-lite` → `/eval-interview buchhalter`
2. `.env.local`: `INTERVIEW_MODEL=google/gemini-3.5-flash` → `/eval-interview buchhalter`

Dann via Langfuse MCP in Claude Code:
- `"Compare tool-call sequences between eval_run_id <A> and <B>"`
- `"Show sessions tagged persona:buchhalter, grouped by model"`