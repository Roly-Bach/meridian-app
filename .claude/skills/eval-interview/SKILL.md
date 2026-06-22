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

- `EVAL_WORKSPACE_ID` in `.env.local` gesetzt (seit 2026-05-28 bereits gesetzt)
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` in `.env.local` gesetzt
- Supabase MCP verbunden (für Post-Run-Analyse)
- Dev-Server NICHT nötig — der Runner läuft direkt via tsx, kein localhost

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

### Schritt 1: Persona-Datei lesen

Lese die Persona-Datei um PASS-Kriterien ableiten zu können:
- `buchhalter` → `src/services/__evals__/interview/personas/buchhalter.ts`
- `vertriebler` → `src/services/__evals__/interview/personas/vertriebler.ts`
- `it-support`  → `src/services/__evals__/interview/personas/it-support.ts`

Extrahiere:
- `identity.name`, `identity.role`, `identity.department`
- `processKnowledge.processes[].name` (erwartete Schritte, für PASS-Kriterien)

### Schritt 2: Runner starten

Baue den Befehl aus den Argumenten:

```bash
npm run eval:interview <persona>
```

Alle Modell-Env-Vars (`INTERVIEW_MODEL`, `EXTRACTION_MODEL`, `ENRICHMENT_MODEL`, `TESTER_MODEL`) werden vom Runner via dotenv aus `.env.local` geladen. Kein CLI-Prefix nötig.

`LANGFUSE_ENABLED` wird vom Runner intern auf `true` gesetzt (process.env, prozess-lokal) und kehrt nach Abschluss automatisch auf den `.env.local`-Wert zurück.

Führe den Befehl aus (timeout 10 Minuten — ein vollständiges Interview dauert 3–7 Min).

**Beide Modelle — Interview-Agent und Tester-Persona — verwenden dieselbe Google AI API** (`GOOGLE_GENERATIVE_AI_API_KEY`). Das Tester-Modell ist per Default `google/gemini-3.1-flash-lite` und kann via `TESTER_MODEL` überschrieben werden. Für Benchmarking-Läufe immer den Tester auf Flash Lite lassen, damit nur der Agent variiert.

Der Runner gibt auf stdout aus:
- `[eval] persona=<p> model=<m> evalRunId=<uuid>` — merke `evalRunId`
- `[eval] Interview created: <uuid>` — merke `interviewId`
- Pro Turn: `[Agent]: <text>` und `[<persona.name>]: <text>`
- Am Ende: `[eval] Done.` + Langfuse-Session-URL + `eval_run_id`

Notiere `interviewId`, `evalRunId` und die Langfuse-Session-URL aus dem stdout.

Falls der Runner mit Fehler abbricht:
- `EVAL_WORKSPACE_ID not set` → Setup-Problem, `.env.local` prüfen
- Supabase-Verbindungsfehler → Supabase-Keys in `.env.local` prüfen
- LLM-API-Fehler → API-Key oder Modell-Name prüfen

### Schritt 3: Post-Run-Analyse (Supabase MCP)

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

### Schritt 4: PASS/FAIL bestimmen

<!-- source: KI-6 (/retro 2026-06-22) — diese Kriterien divergierten vom automatischen Runner-Gate (runner.ts), dadurch konnte ein Lauf hier PASS, im Runner-Gate aber FAIL sein -->

**Der Runner bestimmt PASS/FAIL bereits automatisch** — `status:` im Transcript-Frontmatter (Schritt 5) kommt direkt aus `runner.ts`. Diesen Status übernehmen, nicht manuell neu bewerten. Stand `runner.ts` (Zeile ~440), aktueller Gate:

```
passed =
  scores.completionCorrectness === true &&
  scores.dedupSlotCoverage >= 0.75 &&
  scores.stepRegistrationCoverage >= 0.8 &&
  scores.dialogNaturalness >= 0.65 &&
  (trailMetrics.blockedRate ?? 0) < 0.1
```

Bei jedem `runner.ts`-Schwellenwert-Change (wie 2026-06-18: `dialogNaturalness` 0.70 → 0.65) diesen Block hier nachziehen — sonst driftet die Doku wieder vom tatsächlichen Gate weg.

**Zusätzlich qualitativ prüfen** (nicht Teil des automatischen Gates, aber Red-Flag für PARTIAL/Nachprüfung):
- Mindestens 1 Schritt mit gefüllten taziten O-Slots: mind. ein Wert in `entscheidungslogik` (O2), `tazite_cues` (O2) oder `ausnahmen` (O3) ist nicht null
- Kein Turn mit leerem `agent_response`
- Kein Dreiwiederholungsmuster bei Agent-Fragen (visuell aus stdout prüfen)

Ein Eval-Lauf gilt als **FAIL** außerdem (unabhängig vom Score-Gate) wenn:
- Runner beendet mit non-zero Exit-Code ohne `[eval] Done.`
- Sicherheits-Maximum 25 Turns (Runner-intern) erreicht ohne Abschluss

**Partial PASS** (dokumentieren, kein Abbruch-Fehler):
- Score-Gate FAIL, aber nur knapp an einer Schwelle (z.B. `dedupSlotCoverage` 0.70 statt 0.75) und qualitative Prüfung unauffällig
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

Nächste Schritte (manuelle Pipeline-Tests):
  → Prozessschritte prüfen: SELECT * FROM process_steps WHERE interview_id = '<id>';
  → Use Cases prüfen:       SELECT * FROM use_cases WHERE process_step_id IN (
                              SELECT id FROM process_steps WHERE interview_id = '<id>'
                            );
```

---

## Modell-Vergleich (primärer Use Case von PROJ-13)

Um zwei Modelle direkt zu vergleichen, setze `INTERVIEW_MODEL` in `.env.local` und führe den Skill zweimal aus:

1. `.env.local`: `INTERVIEW_MODEL=google/gemini-3.1-flash-lite` → `/eval-interview buchhalter`
2. `.env.local`: `INTERVIEW_MODEL=google/gemini-3.5-flash` → `/eval-interview buchhalter`

Dann via Langfuse MCP in Claude Code:
- `"Compare tool-call sequences between eval_run_id <A> and <B>"`
- `"Show sessions tagged persona:buchhalter, grouped by model"`