---
name: eval-interview
description: Führt einen vollständigen Eval-Lauf des Interview-Agenten mit einer synthetischen Persona durch.
argument-hint: "<persona: buchhalter | vertriebler | it-support>"
user-invocable: true
---

# Eval-Interview Skill

## Zweck
Führt einen vollständigen Eval-Lauf des Interview-Agenten mit einer synthetischen Persona durch.
Claude Code übernimmt die Persona und antwortet inline auf Agent-Turns — kein separater API-Call, kein Tester-Modell.

## Voraussetzungen
- Dev-Server läuft: `npm run dev` auf `localhost:3000`
- Supabase MCP ist verbunden (seit 2026-05-22 Standard)
- Kein `TEST_INTERVIEW_TOKEN` o.ä. nötig — der Skill legt alles selbst an

## Aufruf
```
/eval-interview <persona>
```
`<persona>` = `buchhalter` | `vertriebler` | `it-support`

---

## Schritt-für-Schritt-Ablauf

### Schritt 1: Persona lesen

Lese die Persona-Datei mit dem Read-Tool:
- `buchhalter` → `src/services/__evals__/interview/personas/buchhalter.ts`
- `vertriebler` → `src/services/__evals__/interview/personas/vertriebler.ts`
- `it-support`  → `src/services/__evals__/interview/personas/it-support.ts`

Extrahiere aus der Datei:
- `identity.name`, `identity.role`, `identity.department`
- `processKnowledge.processes[].name` (für `focus_topics`)
- `processKnowledge` vollständig (für Persona-Antworten im Loop)
- `style` (für Antwortton und Verbosity)

### Schritt 2: Interview-Record anlegen

Erstelle einen neuen Interview-Record via Supabase MCP. Nutze die `interviews`-Tabelle mit folgendem expliziten Feld-Mapping:

```sql
INSERT INTO interviews (
  workspace_id,
  employee_name,
  employee_role,
  department,
  focus_topics,
  status,
  access_token,
  token_expires_at,
  max_duration_minutes
) VALUES (
  '<workspace_id>',           -- aus der ersten Workspace-Zeile in der DB holen
  '<identity.name>',
  '<identity.role>',
  '<identity.department>',
  ARRAY['<process_1_name>', '<process_2_name>'],  -- aus processKnowledge.processes[].name
  'created',
  gen_random_uuid(),
  NOW() + INTERVAL '7 days',
  30
)
RETURNING id, access_token;
```

Hole die Workspace-ID vorher:
```sql
SELECT id FROM workspaces LIMIT 1;
```

**WICHTIG: Danach sofort die `interview_state`-Row anlegen** (der SQL-INSERT umgeht den API-Endpoint der sie normalerweise erstellt):

```sql
INSERT INTO interview_state (
  interview_id,
  phase,
  timer_minutes,
  topics_covered,
  topics_open
) VALUES (
  '<interview.id>',
  'intro',
  0,
  ARRAY[]::text[],
  ARRAY[]::text[]
);
```

Merke dir `interview.id` und `interview.access_token` (= Token) aus dem RETURNING-Ergebnis.

### Schritt 3: Interview starten

**CURL-FORMAT-REGELN (bindend für alle curl-Aufrufe in diesem Skill):**
- Flags in genau dieser Reihenfolge am Anfang: `curl -s -N --no-buffer -X POST`
- URL beginnt immer mit `http://localhost:3000/api/`
- `-H` und `-d` kommen direkt nach der URL, auf derselben Zeile, kein Backslash-Zeilenumbruch
- Kein `2>&1` und keine Shell-Redirects — das bricht das Permission-Matching

```bash
curl -s -N --no-buffer -X POST http://localhost:3000/api/interview/<token>/start -H "Content-Type: application/json" -d '{}'
```

Das ist der erste Agent-Turn (`[Turn 1] Agent`). Speichere den gesamten Response-Text als `agentText`.

Danach: Lese `.eval-last-usage.json` mit dem Read-Tool — speichere als `startUsage`.

Falls curl Connection-Refused meldet: brich ab und teile dem Nutzer mit, dass `npm run dev` gestartet werden muss.
Falls die Antwort leer ist: Protokolliere als BUG und breche ab.

### Schritt 4: Eval-Loop (max. 20 Turns)

Ziel: Das Interview vollständig durchführen — von intro über process_loop bis wrap_up und complete_interview.
**Kein vorzeitiger Abbruch bei register_step oder anderen Tool-Calls** — das Interview soll bis zum natürlichen Ende laufen.

```
Für jeden Turn N = 1..20:

  a) Generiere Persona-Antwort:
     - Lies agentText des letzten Agent-Turns
     - Beantworte als Persona basierend auf processKnowledge
     - Halte dich STRIKT an processKnowledge — erfinde keine Fakten
     - Wenn die Frage zu etwas führt, das nicht im processKnowledge steht:
       antworte ehrlich ("Da müsste ich nachsehen." / "Dazu habe ich gerade keine genauen Zahlen.")
     - Beachte style.verbosity und style.tendencies für den Antwort-Charakter
     - Eröffne das Gespräch NIE selbst — antworte nur auf Agent-Turns
     - Protokolliere: [Turn N] Persona (<name>): "<antwortText>"

  b) Sende Persona-Antwort an den Agenten (KEIN 2>&1):
     curl -s -N --no-buffer -X POST http://localhost:3000/api/interview/<token>/chat -H "Content-Type: application/json" -d '{"user_input": "<personaAntwort>"}'

     Danach: Lese `.eval-last-usage.json` mit dem Read-Tool.
     Extrahiere: inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, googleCachedTokens.
     Falls die Datei nicht existiert oder nicht lesbar: lastUsage = null.

  c) Protokolliere Agent-Antwort:
     [Turn N+1] Agent: "<agentText>"
     [Turn N+1] tokens: in=<inputTokens> out=<outputTokens> cacheRead=<cacheReadTokens> cacheCreate=<cacheCreationTokens> googleCached=<googleCachedTokens>
     (bei lastUsage = null: "[Turn N+1] tokens: n/a")

  d) Prüfe Abbruchbedingungen — NUR diese drei:
     1. Agent-Response leer (kein sichtbarer Text):
        Protokolliere: [Turn N+1] Agent: leer — möglicher BUG
        Brich den Loop ab.
     2. Agent wiederholt dieselbe Frage 3× identisch:
        Protokolliere: [FAIL] Agent in Endlosschleife bei Turn N+1
        Brich den Loop ab.
     3. interview.status = 'completed' (prüfen via SQL nach jedem Turn):
        Protokolliere: [PASS] Interview abgeschlossen in Turn N+1
        Brich den Loop ab.

  e) Prüfe interview.status nach jedem Turn via SQL:
     SELECT status FROM interviews WHERE id = '<interview.id>';
     Wenn 'completed': Abbruchbedingung 3 aus d).
```

### Schritt 5: Transcript schreiben

Stelle sicher, dass das Verzeichnis `docs/evals/interview/` existiert (anlegen falls nicht vorhanden).

Schreibe den Transcript nach `docs/evals/interview/YYYY-MM-DD-<persona>.md`:

```markdown
---
interview_model: <Wert von INTERVIEW_MODEL env, oder "default" wenn nicht gesetzt>
eval_date: YYYY-MM-DD
persona: <persona-name>
interview_id: <id>
turns_total: <N>
---

[Turn 1] Agent: "<opener>"
[Turn 1] tokens: in=<inputTokens> out=<outputTokens> cacheRead=<cacheReadTokens> cacheCreate=<cacheCreationTokens> googleCached=<googleCachedTokens>
[Turn 1] Persona (<name>): "<antwort>"
[Turn 2] Agent: "<frage>"
[Turn 2] tokens: in=<inputTokens> out=<outputTokens> cacheRead=<cacheReadTokens> cacheCreate=<cacheCreationTokens> googleCached=<googleCachedTokens>
[Turn 2] Persona (<name>): "<antwort>"
...
[PASS / FAIL] <Abschluss-Label mit Begründung>

## Token-Usage-Zusammenfassung
| Turn | inputTokens | outputTokens | cacheRead | cacheCreate | googleCached |
|------|-------------|--------------|-----------|-------------|--------------|
| 1    | <n>         | <n>          | <n/null>  | <n/null>    | <n/null>     |
| 2    | <n>         | <n>          | <n/null>  | <n/null>    | <n/null>     |
| ...  |             |              |           |             |              |
| **Σ** | **<summe>** | **<summe>** | **<summe>** | **<summe>** | **<summe>** |

Caching-Effekt: Turn-1-inputTokens vs. Turn-2-inputTokens (Δ in %, erwarteter Abfall ~60–70% bei Anthropic). Bei Gemini: googleCached > 0 zeigt implizites Caching an.

## Slot-Filling-Stand (aus interview_state.step_tracker)
<step_tracker JSON oder Tabelle>

## Befunde
<Liste aller beobachteten Auffälligkeiten, Bugs, oder positiven Verhalten>
```

### Schritt 6: Interview-Record bleibt in DB

**Kein Cleanup.** Der Record bleibt in der Datenbank, damit:
- Die personalisierte Begrüßung in der App-UI überprüft werden kann
- Extraktion, Prozessschritt-Anreicherung und Use-Case-Engine auf echten Eval-Daten getestet werden können

### Schritt 7: Abschluss-Output

Gib folgenden strukturierten Hinweis aus:

```
Eval-Lauf abgeschlossen — <PASS/FAIL>
Transcript: docs/evals/interview/YYYY-MM-DD-<persona>.md
Interview-ID: <id>

Interview in der App einsehen:
  http://localhost:3000/interview/<token>

Nächste Schritte (manuelle Pipeline-Tests):
  → Extraktion triggern:   POST http://localhost:3000/api/interviews/<id>/reextract
  → Prozessschritte prüfen: SELECT * FROM process_steps WHERE interview_id = '<id>';
  → Use Cases prüfen:       SELECT * FROM use_cases WHERE process_step_id IN (
                              SELECT id FROM process_steps WHERE interview_id = '<id>'
                            );
```

---

## Pass-Kriterien

Ein Eval-Lauf gilt als **PASS** wenn:
1. Der erste Turn im Transcript ist `[Turn 1] Agent:` — nicht `[Turn 1] Persona`
2. Kein Persona-Text wiederholt sich in zwei aufeinanderfolgenden Turns identisch
3. Persona-Antworten gehen kontextuell auf die jeweilige Agent-Frage ein (visuell prüfen)
4. Der Agent registriert mindestens 2 Prozessschritte via `register_step`
5. Für mindestens 1 Schritt sind alle 3 Pflicht-Slots gefüllt (`frequency_per_month`, `duration_minutes`, `rule_based`)
6. Das Interview erreicht `status = 'completed'` (complete_interview wird aufgerufen)

Ein Eval-Lauf gilt als **FAIL** wenn:
- Der Agent eröffnet nicht (erste Antwort leer oder fehlt)
- Der Agent wiederholt dieselbe Frage 3× hintereinander
- Turn 20 erreicht ohne `status = 'completed'`
- Kein einziger `register_step`-Call über den gesamten Lauf

**Partial PASS** (dokumentieren, kein Abbruch-Fehler):
- Weniger als 2 Schritte registriert, aber Interview abgeschlossen
- Nicht alle Pflicht-Slots gefüllt, aber Interview abgeschlossen
- Turn 20 erreicht mit mindestens 1 register_step-Call

---

## Anti-Halluzinations-Regel

Claude Code MUSS sich beim Spielen der Persona strikt an `processKnowledge` halten:
- Slot-Werte (Frequenz, Dauer, Fehlerrate) nur nennen wenn sie in `processKnowledge` stehen
- Bei unbekannten Werten: „Da habe ich gerade keine genaue Zahl" oder „Das weiß ich nicht auswendig"
- Niemals Prozesse, Tools oder Pain Points erfinden, die nicht in der Persona-Datei stehen
