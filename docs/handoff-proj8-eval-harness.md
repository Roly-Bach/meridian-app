# Handoff: PROJ-8 Eval Harness Run

> **Zweck dieses Dokuments:** Eine saubere Session — egal ob du selbst startest oder einen Claude-Agent darauf ansetzt — kann anhand dieses Briefings ohne Rückfragen den PROJ-8-Eval-Lauf durchführen und das Ergebnis dokumentieren. Stand 2026-05-24, nach PROJ-8 Production-Deploy `dpl_D2oUimKCgHxjh9yb9geQxBG2vA5B`.

## Ziel

Den PROJ-8-Output-Kontrakt empirisch validieren: Läuft die im Deploy vom 2026-05-24 ausgerollte Slot-Coverage-Interview-Engine in der Praxis so, dass die in der Spec definierten Pass-Schwellen erreicht werden?

**Pass-Kriterien pro Persona (aus [features/PROJ-8-interview-design-optimierung.md](../features/PROJ-8-interview-design-optimierung.md)):**

| Metrik | Schwelle |
|---|---|
| Identifizierte Prozessschritte | ≥ 3 |
| Pflicht-Slot-Coverage pro Schritt | ≥ 80 % von {frequency_per_month, duration_minutes, rule_based} |
| Optionale-Slot-Coverage pro Schritt | ≥ 50 % von {data_sources, error_rate_percent, media_breaks} |
| Bottlenecks an Prozessschritt verortet | ≥ 1 |

Drei Personas existieren: `buchhalter`, `vertriebler`, `it-support`. Sequentiell durchspielen, Reports vergleichen, Auffälligkeiten dokumentieren.

## Status der Infrastruktur

| Komponente | Pfad | Status |
|---|---|---|
| Personas | `src/services/__evals__/interview/personas/{buchhalter,vertriebler,it-support}.ts` | gebaut, deployed |
| Runner | `src/services/__evals__/interview/runner.ts` | gebaut, deployed |
| Metrics | `src/services/__evals__/interview/metrics.ts` | gebaut, deployed |
| Report-Generator | `src/services/__evals__/interview/report.ts` | gebaut, deployed |
| npm-Script | `npm run eval:interview` in `package.json` | gebaut, deployed |
| **Tatsächlicher Eval-Lauf** | — | **noch nie ausgeführt** |

Das ist der einzige offene QA-Punkt aus PROJ-8 (Deliverable 6 im QA-Report: `PASS (not run)`).

## Vor dem Start

Du brauchst:

1. **Working directory** `c:\Users\liash\Claude_Projects\meridian-app`
2. **Anthropic API Key** in `.env.local` (`ANTHROPIC_API_KEY`) — der Eval ruft den echten Agent über die lokale API
3. **Supabase Service Role Key** in `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`) — der Runner liest `step_tracker` über REST mit Service-Role
4. **Ein Test-Interview in der Supabase-DB** mit:
   - workspace, der dir gehört
   - Interview-Row mit `access_token` und `id`
   - `interview_state`-Row mit `step_tracker = '[]'::jsonb`, `phase = 'intro'`
5. **`.env.local`-Variablen für den Runner:**
   ```
   TEST_INTERVIEW_TOKEN=<access_token aus der DB>
   TEST_INTERVIEW_ID=<id des Interview-Datensatzes>
   TEST_WORKSPACE_ID=<workspace_id>
   EVAL_BASE_URL=http://localhost:3000
   ```
   Vorlage steht auskommentiert in `.env.local.example`.

## Setup-Schritte (konkret)

### Schritt 1: Dev-Server starten

```powershell
npm run dev
```

Erwartete Ausgabe: `Next.js 16.2.6 (Turbopack) … Ready in <ms>` auf `localhost:3000` (oder den nächsten freien Port — den dann in `EVAL_BASE_URL` eintragen).

### Schritt 2: Test-Interview in der Supabase-DB anlegen

Zwei Wege, gleich gut:

**Variante A — über die App (empfohlen, näher an Production):**
1. Browser → `http://localhost:3000`, Login mit deinem Account
2. Dashboard → "Neues Interview anlegen"
3. Felder ausfüllen, abschicken
4. Im Dashboard die neue Karte anklicken, in der URL den Token nach `/interview/` ablesen
5. In Supabase Studio (oder via `mcp__supabase__execute_sql`): `select id, access_token, workspace_id from interviews order by created_at desc limit 1;`
6. Werte in `.env.local` eintragen

**Variante B — direkt per SQL über Supabase MCP:**
```sql
-- Adapt workspace_id to a workspace YOU own
INSERT INTO interviews (workspace_id, employee_name, department, access_token, token_expires_at)
VALUES (
  '<your-workspace-id>',
  'Eval-Persona',
  'Eval',
  encode(gen_random_bytes(16), 'hex'),
  NOW() + INTERVAL '1 day'
)
RETURNING id, access_token, workspace_id;
```
Danach: `interview_state` wird automatisch angelegt (Trigger). Werte in `.env.local`.

### Schritt 3: `.env.local` befüllen

Die Datei ist gitignored. Im `.env.local.example` stehen alle gebrauchten Variablen als auskommentierte Vorlage — die vier Eval-Variablen sind ganz unten unter dem Kommentar `# Eval Harness (PROJ-8)`. Auskommentieren und Werte einsetzen.

Quickcheck:
```powershell
Get-Content .env.local | Select-String "TEST_INTERVIEW_TOKEN|TEST_INTERVIEW_ID|TEST_WORKSPACE_ID|EVAL_BASE_URL|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY"
```
Alle sechs Zeilen müssen vorhanden sein.

### Schritt 4: Eval ausführen

```powershell
# Erste Persona (default = buchhalter)
npm run eval:interview

# Oder explizit:
npm run eval:interview -- --persona=buchhalter
npm run eval:interview -- --persona=vertriebler
npm run eval:interview -- --persona=it-support
```

**Wichtig:** Jeder Eval-Lauf braucht ein **frisches** Test-Interview (sonst startet der Agent mitten im step_tracker). Vor jedem Persona-Lauf entweder:
- ein neues Interview via Variante A oder B anlegen, oder
- den step_tracker zurücksetzen:
  ```sql
  UPDATE interview_state
    SET step_tracker = '[]'::jsonb,
        phase = 'intro',
        topics_covered = '{}',
        topics_open = '{}',
        extractions_log = '[]'::jsonb
    WHERE interview_id = '<TEST_INTERVIEW_ID>';
  DELETE FROM turns WHERE interview_id = '<TEST_INTERVIEW_ID>';
  ```

Der Runner führt maximal 25 Turns durch (siehe `MAX_TURNS` in `runner.ts:24`) und stoppt automatisch wenn der Agent in Phase `wrap_up` einen Abschluss liefert.

## Erwartete Ausgabe

Pro Persona:

1. **Konsolen-Log** mit jedem Turn (User-Input + Agent-Response, gekürzt).
2. **Report im Terminal** mit:
   - Anzahl identifizierter Prozessschritte
   - Pflicht- und optionale Slot-Coverage pro Schritt
   - Durchschnittliche Coverage
   - Bottlenecks lokalisiert
   - Use Cases generiert (sofern der Use-Case-Generator nach Interview-Abschluss durchgelaufen ist)
   - **Pass/Fail-Verdict** gegen den Output-Kontrakt
3. **Datenbank-Persistenz:** `step_tracker`, `turns`, `knowledge_objects`, `process_steps`, `use_cases` sind nach dem Lauf in der DB einsehbar — auch für nachträgliche Inspektion via Supabase Studio.

## Ergebnis dokumentieren

Nach allen drei Personas-Läufen:

1. **Tabelle anlegen** in `features/PROJ-8-interview-design-optimierung.md` (im Abschnitt _Eval Harness (Pending)_, der dann zu _Eval Harness (Run 2026-MM-DD)_ wird):

   | Persona | Schritte | Ø Pflicht-Cov. | Ø Optional-Cov. | Bottlenecks | UCs | Pass/Fail |
   |---|---|---|---|---|---|---|
   | buchhalter | n | xx% | xx% | n | n | ✓/✗ |
   | vertriebler | n | xx% | xx% | n | n | ✓/✗ |
   | it-support | n | xx% | xx% | n | n | ✓/✗ |

2. **Auffälligkeiten** als Stichpunkte: welche Slots wurden konsistent NICHT gefüllt, hat der Agent in einer Persona besonders gut/schlecht agiert, sind die Probes (Default-Frage → Probe-Variante) korrekt eskaliert worden, etc.

3. **Falls Pass-Fail:** Bug in PROJ-8-Spec ergänzen (BUG-3, BUG-4, …) mit Reproduktion und Hinweis darauf, ob Prompt-Tuning oder Code-Fix nötig ist. Status der PROJ-8-Feature dann _möglicherweise_ wieder auf "In Review" — abhängig vom Schweregrad.

4. **Commit:**
   ```
   test(PROJ-8): Run eval harness against 3 synthetic personas

   Buchhalter: <pass/fail>, <n> steps, <xx>% mandatory coverage, …
   Vertriebler: …
   IT-Support: …

   [Auffälligkeiten in 2-3 Sätzen]
   ```

## Bekannte Gotchas

- **Persona-Response-Selector** in `runner.ts:41` ist heuristisch über `agentText.toLowerCase().includes(...)` — wenn der Agent z.B. eine umformulierte Frage stellt ("schätzen Sie mal die Frequenz"), kann der Selector daneben greifen und `responses['default']` liefern, was die Coverage drückt. Falls Slot-Coverage komisch niedrig wirkt: ein paar Turns im DB-`turns` ansehen und entscheiden ob Selector zu eng ist.
- **`MAX_TURNS = 25`** — wenn der Agent nicht in 25 Turns zum `wrap_up` kommt, wird der Lauf hart abgebrochen und Use Cases werden nicht generiert. Schwelle wäre dann **automatisch fail** — entweder Limit hochschrauben (runner.ts:24) oder als Befund werten.
- **Streaming-Response wird komplett konsumiert** — die `fetchStepTracker`-Aufrufe finden _nach_ jedem Turn statt. Wenn `extractions_log`/`step_tracker` Updates langsam sind, kann es zu Race Conditions kommen. Falls Coverage flackert: zwischen `sendMessage` und `fetchStepTracker` 200ms Sleep einbauen (nicht im aktuellen Code).
- **`SUPABASE_SERVICE_ROLE_KEY`** ist sensitiv — nicht in Logs/Commits leaken. Wenn der Eval-Runner mit `console.error('env:', process.env)` debugged wird, MUSS das danach wieder raus.
- **PROJ-15 CSP-Header** ist via `next.config.ts` und enthält `'unsafe-inline'` — das betrifft den Eval-Lauf nicht, weil der Runner ein Node-Skript ist und keinen Browser benutzt. Erwähnung nur damit du weißt: kein CSP-bezogenes Problem im Eval zu erwarten.

## Wenn du das einem Claude-Agent gibst

Pack dem Agent bitte als Briefing dazu:
- "Ich bin auf Windows 11 mit PowerShell. Nutze die `Bash` Tool für Unix-Style-Commands, `PowerShell` für native Operationen."
- "Working directory ist `c:\Users\liash\Claude_Projects\meridian-app`."
- "Lies zuerst dieses Handoff-Dokument (`docs/handoff-proj8-eval-harness.md`), dann `features/PROJ-8-interview-design-optimierung.md` (Output-Kontrakt + Slot-Inventar). Erst danach mit Setup-Schritt 1 anfangen."
- "Schreib mir nach jedem Setup-Schritt was du gemacht hast. Frag mich vor dem ersten `npm run eval:interview`, ob Variante A (Browser-Signup) oder Variante B (direkt SQL) bevorzugt wird."
- "Migration `proj8_step_tracker` ist bereits angewandt — keine DB-Schema-Änderungen mehr nötig."

## Nicht-Ziele

- **Keine** Code-Änderungen am Eval-Runner ohne Rücksprache (heuristischer Selector ist bewusst einfach; wenn er versagt, das als Erkenntnis dokumentieren statt vorschnell umzubauen).
- **Keine** Production-DB anfassen. Eval läuft strikt lokal gegen `localhost:3000` und die Supabase-Test-Workspace-Daten.
- **Keine** neuen Personas erfinden — die drei existierenden decken die Hauptpersonas-Spannbreite aus der Spec ab. Wenn der Run zeigt dass Edge-Cases fehlen, in einer separaten Session entscheiden.
- Run-Logs **nicht in Git** committen — falls man `npm run eval:interview > eval-report.txt` macht, gehört das `.txt` in `.gitignore` oder wird nach Auswertung gelöscht.

## Wenn alles passt

Nach grünem 3-Persona-Lauf:
- PROJ-8 Spec auf "_Eval Harness (Run YYYY-MM-DD)_" aktualisieren
- INDEX.md Status bleibt "Deployed"
- Commit + Push (kein neuer Tag nötig — nur Doc-Update)
- Nächster Vorschlag wäre **CI-Pipeline** oder **PROJ-13 (LLM Observability)** — siehe Empfehlung im letzten Session-Ende.
