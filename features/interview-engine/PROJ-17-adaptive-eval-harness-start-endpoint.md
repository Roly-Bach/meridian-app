# PROJ-17: Adaptive Eval-Harness + Start-Endpoint

## Status: Approved
**Created:** 2026-05-24
**Last Updated:** 2026-05-25
**Type:** Feature
**Domain:** Interview Engine
**Extends:** —
**Appetite:** M (3-5 Tage)
**Bugs:** 0:0:2

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — Erweiterung von `interviewAgent.ts` und neuer Backend-Route
- Requires: PROJ-3 (Interview UI) — `ChatInterface.tsx` und `useInterviewStream` müssen zwischen `/start` und `/reconnect` verzweigen
- Requires: PROJ-8 (Interview-Design Optimierung) — Personas, Runner, Reports und Eval-Skript stammen aus diesem Feature und werden inhaltlich abgelöst
- Requires: PROJ-12 (Rate Limiting) — neuer `/start`-Endpoint klinkt sich in `checkTokenEndpointLimits` ein

## Hintergrund & Motivation

Zwei zusammenhängende Probleme im Interview-Pfad:

1. **Eval-Harness ist nutzlos.** Die heutige PROJ-8-Eval-Harness liefert statische, Keyword-gematchte Persona-Antworten (`src/services/__evals__/interview/runner.ts:41-79`). Bei jeder Umformulierung der Interviewer-Frage greift der Selector ins Leere und fällt auf `responses['default']` (= Selbstvorstellung) zurück. Der Runner startet zusätzlich mit der Persona-Selbstvorstellung als erstem Turn — der Mitarbeiter eröffnet das Gespräch, obwohl der Interviewer eröffnen sollte. Folge: alle drei Personas FAIL im letzten Eval-Lauf (2026-05-24), Antworten wiederholen sich endlos, der Interview-Agent kann logisch kein Wissen extrahieren.
2. **Cold-Start nutzt Reconnect-Endpoint.** Das Frontend ruft beim Erst-Öffnen denselben `/reconnect`-Endpoint wie bei echten Reconnects (`ChatInterface.tsx:47-72`). Dadurch wird der Interview-Agent beim Cold-Start mit dem Reconnect-System-Marker (`[SYSTEM: Der Mitarbeiter hat die Verbindung wiederhergestellt...]`) initialisiert, obwohl gar kein Reconnect stattfindet. Die Begrüßung referenziert die Interview-Metadaten (Name, Rolle, Department, Fokusthemen) heute nicht aktiv.

Beide Probleme sind über denselben Code-Pfad gekoppelt (Initiation des Interviews), daher in einem Feature gebündelt.

## User Stories

- Als **Developer**, der den Interview-Agenten weiterentwickelt, will ich eine Eval-Harness, bei der synthetische Personas adaptiv auf die Fragen des Agents reagieren, damit die Eval misst, wie gut der Agent Wissen extrahiert — und nicht, ob er einen Keyword-Selector trifft.
- Als **Developer** will ich die Eval per `/eval-interview <persona>` direkt aus VS Code starten und danach den vollständigen Gesprächsverlauf als Markdown-Datei einsehen können.
- Als **Developer** will ich, dass die Eval-Harness denselben Initiations-Pfad verwendet wie das Frontend (Interviewer eröffnet), damit die Eval das echte Verhalten reproduziert.
- Als **interviewter Mitarbeiter** will ich beim ersten Öffnen des Interview-Links mit meinem Namen begrüßt werden und einen kurzen Kontextbezug zu meiner Rolle hören, damit ich verstehe, dass das Interview für mich vorbereitet wurde.
- Als **interviewter Mitarbeiter** will ich nach einer Unterbrechung am bisherigen Gespräch anknüpfen können, ohne dass der Agent das Gespräch von vorn beginnt.
- Als **Berater**, der ein Interview anlegt, will ich, dass die hinterlegten Metadaten (Mitarbeitername, Rolle, Department, Fokusthemen) in der Begrüßung wahrnehmbar einfließen, damit das Interview für den Mitarbeiter glaubwürdig vorbereitet wirkt.

## Acceptance Criteria

### Backend: neuer `/start`-Endpoint
- [ ] `POST /api/interview/[token]/start` existiert und akzeptiert Token-Authentifizierung wie `/reconnect`.
- [ ] Endpoint validiert Token, Token-Expiry (410 bei abgelaufen), Status (409 bei `completed`).
- [ ] Endpoint klinkt sich in `checkTokenEndpointLimits` ein und gibt bei Überlauf 429 zurück.
- [ ] Wenn bereits Turns für das Interview existieren: 409 mit Hinweis, dass `/reconnect` zu nutzen ist.
- [ ] Endpoint streamt die initiale Begrüßung als Text-Stream (analog `/reconnect`, kein DB-Write).
- [ ] Begrüßung enthält den `employee_name` wörtlich.
- [ ] Wenn `employee_role` gesetzt ist: Begrüßung referenziert die Rolle.
- [ ] Wenn `focus_topics` gesetzt ist: Begrüßung referenziert das/die Thema/Themen.
- [ ] Wenn `employee_role` oder `focus_topics` null sind: Begrüßung degradiert geräuschlos — keine Strings wie `null`, `undefined` oder Platzhalter im Output.

### Backend: `/reconnect`-Endpoint
- [ ] `/reconnect` gibt 409 zurück, wenn keine Turns für das Interview existieren (Cold-Start gehört zu `/start`).
- [ ] Alle bisherigen `/reconnect`-Verhalten bei vorhandenen Turns bleiben unverändert.

### Frontend
- [ ] `useInterviewStream`-Hook stellt eine `start()`-Methode bereit, die `POST /api/interview/[token]/start` aufruft.
- [ ] `ChatInterface.tsx` wählt beim Auto-Greet anhand des initialen Interview-Status: `created` und keine Turns → `start()`, sonst → `reconnect()`.
- [ ] Reconnect-Banner wird weiterhin nur bei echtem Reconnect angezeigt (Verhalten unverändert).

### Eval-Harness: Persona-Schema
- [ ] `personas/types.ts` definiert das neue Schema: `identity`, `description`, `style`, `processKnowledge` (strukturierte Fakten, keine slot-keyed Strings).
- [ ] Drei Personas (Buchhalter, Vertriebler, IT-Support) auf neues Schema migriert.
- [ ] Bestehende Dateien `runner.ts`, `report.ts`, `metrics.ts` werden gelöscht — die Logik übernimmt der Skill.

### Eval-Harness: Claude Code Skill
- [ ] Skill-Datei `.claude/skills/eval-interview.md` existiert und beschreibt den vollständigen Eval-Loop für Claude Code.
- [ ] Skill liest die Persona-Datei aus `src/services/__evals__/interview/personas/` (TypeScript-Datei, lesbar via Read-Tool).
- [ ] Skill erstellt Interview-Record direkt via Supabase MCP mit folgendem expliziten Feld-Mapping aus der Persona: `employee_name` = persona.identity.name, `employee_role` = persona.identity.role, `department` = persona.identity.department, `focus_topics` = persona.processKnowledge.processes[].name als Array (null wenn keine Prozesse definiert). Token aus der DB-Response.
- [ ] Skill ruft `POST /api/interview/[token]/start` via HTTP (Bash/curl gegen `localhost:3000`) und empfängt den Interviewer-Opener.
- [ ] Claude Code übernimmt die Persona und antwortet inline auf Interviewer-Fragen — kein separater API-Call, kein TESTER_MODEL.
- [ ] Claude Code verweigert das Erfinden von Fakten, die nicht im `processKnowledge` stehen (Skill-Anweisung).
- [ ] Claude Code eröffnet das Gespräch nie — es antwortet nur auf Agent-Turns.
- [ ] Skill führt Conversation-History mit und übergibt jeden Agent-Turn als nächste Eingabe.
- [ ] Silent-Tool-Only-Turns (BUG-4): Skill protokolliert `[Turn N] Agent: silent — tool-only` und bricht den Loop ab. Kein Nudge.
- [ ] Skill schreibt Transcript nach `docs/evals/interview/YYYY-MM-DD-<persona>.md`.
- [ ] Der erstellte Interview-Record bleibt nach dem Eval-Lauf in der DB — kein Cleanup. Ermöglicht Überprüfung der Begrüßung online und Test der nachgelagerten Pipeline (Extraktion, Anreicherung, Use Cases) auf realen Eval-Daten.
- [ ] Skill gibt am Ende des Eval-Laufs einen strukturierten Hinweis auf mögliche nächste Schritte aus: Interview in der App-UI einsehen (URL mit Token), Extraktions-Agent manuell triggern (`POST /api/extract`), Prozessschritt-Anreicherung prüfen, Use-Case-Identifikation prüfen.

### Eval-Report
- [ ] Report enthält Header-Block mit `interview_model`, Datum und Persona-Name.
- [ ] Transcript zeigt jeden Turn mit Sprecher-Label: `[Agent]` und `[Persona: <Name>]`.

### Pass-Definition für den Eval-Lauf
- [ ] Im erzeugten Transcript eröffnet die erste Zeile den Dialog als `[Agent]`, nicht als `[Persona]`.
- [ ] Kein Auftreten desselben Persona-Texts in zwei aufeinanderfolgenden Turns.
- [ ] Visuelle Review: Persona-Antworten gehen kontextuell auf die jeweilige Interviewer-Frage ein.
- [ ] Alle drei Personas durchlaufen den Loop mindestens bis zum ersten `register_step`-Tool-Call des Agents — oder es liegt ein dokumentierter BUG-4-Treffer vor.

### Dokumentation
- [ ] PROJ-8-Spec (`features/interview-engine/PROJ-8-interview-design-optimierung.md`) verweist auf PROJ-17 und markiert BUG-5 (Vertriebler-Loop) sowie BUG-6 (Selector-Gedächtnis) als gefixt.

## Edge Cases

- **Token-Race:** Zwei Clients öffnen den Token gleichzeitig und beide rufen `/start` parallel an. Beide Anfragen erhalten 200 + Greeting-Stream; keine DB-Inkonsistenz, weil `/start` keinen Turn schreibt.
- **Token abgelaufen während Greeting:** `/start` prüft `token_expires_at` vor dem Stream-Start; späterer Ablauf während des Streamings wird nicht behandelt.
- **Interview ohne `employee_role` und `focus_topics`:** Greeting darf nur Name und ggf. Department referenzieren; kein Platzhalter-String im Output.
- **Persona-Wissen unvollständig (z.B. `additionalContext` fehlt):** Claude Code ignoriert fehlende optionale Felder und läuft trotzdem.
- **Claude Code wird nach etwas gefragt, das nicht im `processKnowledge` steht:** Skill-Anweisung: ehrlich antworten („Da müsste ich nachsehen.") statt zu halluzinieren.
- **Dev-Server nicht gestartet:** curl-Aufruf schlägt mit Connection-Refused fehl. Skill bricht mit klarem Fehler ab.
- **Supabase MCP nicht verfügbar:** Interview-Record kann nicht erstellt werden. Skill bricht ab und informiert Dev.
- **`/reconnect` von gecachtem Client für Cold-Start aufgerufen:** 409-Response, Frontend fällt auf `/start` zurück. Vorhandene Clients sehen einen Fehler-Toast.
- **`/start` von Client für aktives Interview aufgerufen** (Reload nach Turn 1): 409, Frontend nimmt `/reconnect`.

## Technical Requirements

- **Performance:** `/start`-Endpoint Time-to-First-Token ≤ 2 s (analog `/reconnect`).
- **Security:** Token-Authentifizierung wie bestehende Interview-Routes; keine RLS-Änderungen.
- **Eval-Voraussetzung:** Dev-Server muss bei Eval-Läufen laufen (`npm run dev`). Supabase MCP muss verbunden sein.

## Out of Scope

- **Fix für BUG-4 (Silent-Tool-Only-Turns) im Interview-Agent.** PROJ-17 erkennt und protokolliert nur.
- **Multi-Run-Statistik.** Ein Lauf pro Persona reicht für qualitative Review.
- **CI-Integration des Evals.** Bleibt manuell vor Merge.
- **Quantitative Pass-Schwelle.** Bewusst durch qualitative Bewertung ersetzt, solange BUG-4 nicht gefixt ist.
- **Anti-Halluzinations-Probetest mit absichtlich unbeantwortbaren Fragen.** Separates Feature.
- **Deterministischer Tester-Agent (temperature: 0, TESTER_MODEL).** Claude Code als Persona ist für qualitative Review ausreichend. Wird im Backlog aktiviert wenn pass@k-Metrik benötigt wird.

## Konzeptionelle Erweiterungen (Backlog für Folgeiterationen)

### 1. pass@k-Metrik

**Heute:** Ein Lauf pro Persona, qualitative Bewertung. Pass-Definition über vier strukturelle Kriterien.

**Spätere Iteration:** `/eval-interview buchhalter --runs 5` — Skill führt k Läufe durch, Report zeigt aggregiertes pass@k. Trigger: ≥2 dokumentierte Fälle, in denen derselbe Code-Stand bei zwei Eval-Läufen unterschiedliche Pass-Outcomes produziert.

### 2. Trajectory-Metriken auf Tool-Call-Ebene

**Heute:** Outcome-Metriken (eröffnet Agent? Loops? `register_step` erreicht?).

**Spätere Iteration:** Strukturierte Erfassung des Tool-Call-Pfads: `tool_call_count`, `tool_call_errors`, `tool_call_redundancy`, `silent_tool_only_turns`. Trigger: /retro weist auf 3+ Iterationen wiederholt „Tool-Call-Fehler" als häufigste Fehlerkategorie aus.

### 3. Deterministischer Tester-Agent (falls nötig)

**Heute:** Claude Code als Persona — kein temperature-Control, für qualitative Reviews ausreichend.

**Spätere Iteration:** Wenn systematische Nicht-Reproduzierbarkeit zwischen Eval-Läufen beobachtet wird (≥2 dokumentierte Fälle), separater `testerAgent.ts`-Service mit `temperature: 0` und eigenem Modell (z.B. Haiku). Erst dann wird TESTER_MODEL relevant.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Zwei getrennte Lieferpakete mit gemeinsamem Auslöser (falscher Initiations-Pfad):

**Paket 1:** Neuer `/start`-Endpoint + Frontend-Routing-Fix — behebt den Cold-Start-Bug in Produktion.  
**Paket 2:** Adaptive Eval-Harness als Claude Code Skill — ersetzt den kaputten Keyword-Runner ohne zusätzliche API-Kosten.

---

### Teil 1: `/start`-Endpoint + Frontend-Routing

#### Komponentenstruktur

```
API-Schicht
+-- POST /api/interview/[token]/start   (NEU)
|   +-- Token-Validierung (shared, wie /reconnect)
|   +-- Keine Turns vorhanden? → Stream personalisierte Begrüßung
|   +-- Turns vorhanden? → 409 (→ /reconnect nutzen)
|   +-- Rate-Limit-Hook (checkTokenEndpointLimits)
+-- POST /api/interview/[token]/reconnect   (GEÄNDERT)
    +-- Keine Turns? → 409 (Cold-Start-Schutz, neu)
    +-- Turns vorhanden → bisheriges Verhalten unverändert

Service-Schicht
+-- interviewAgent.ts   (GEÄNDERT)
    +-- Begrüßungs-Prompt nutzt employee_name, role, focus_topics
    +-- Graceful Degradation: null-Felder werden weggelassen

Frontend
+-- useInterviewStream.ts   (GEÄNDERT)
|   +-- Neue Methode: start() → POST /start
|   +-- reconnect() unverändert
+-- ChatInterface.tsx   (GEÄNDERT)
    +-- Auto-Greet: status='created' + keine Turns → start()
    +-- Sonst → reconnect()
    +-- 409 von /reconnect → Fallback auf start()
```

#### Routing-Entscheidungsmatrix

| Situation | Endpoint | Ergebnis |
|-----------|----------|---------|
| Erst-Öffnen (keine Turns) | `/start` | Personalisierte Begrüßung |
| Reconnect (Turns vorhanden) | `/reconnect` | Bisheriges Verhalten |
| `/reconnect` bei Cold-Start | `/reconnect` → 409 | Frontend fällt auf `/start` zurück |
| `/start` bei aktivem Interview | `/start` → 409 | Frontend nimmt `/reconnect` |

#### Tech-Entscheidungen

- **Kein Turn-Write in `/start`**: konsistent mit `/reconnect`. Erster echter Turn entsteht bei `/chat`.
- **409 von `/reconnect` bei Cold-Start**: gecachte Browser-Tabs bekommen einen klaren Fehler statt falscher Initialisierung. Frontend-Fallback macht das transparent.

---

### Teil 2: Eval-Harness als Claude Code Skill

#### Komponentenstruktur

```
.claude/skills/
+-- eval-interview.md                          (NEU — Skill-Datei)

src/services/__evals__/interview/
+-- personas/
|   +-- types.ts                               (NEU — PersonaSchema als TypeScript-Typen)
|   +-- buchhalter.ts                          (MIGRIERT auf neues Schema)
|   +-- vertriebler.ts                         (MIGRIERT auf neues Schema)
|   +-- it-support.ts                          (MIGRIERT auf neues Schema)
+-- runner.ts                                  (GELÖSCHT)
+-- report.ts                                  (GELÖSCHT)
+-- metrics.ts                                 (GELÖSCHT)

docs/evals/interview/
+-- YYYY-MM-DD-<persona>.md                    (OUTPUT — Transcript je Eval-Lauf)
```

#### Skill-Ablauf

```
Dev: /eval-interview buchhalter

Claude Code:
  1. Liest personas/buchhalter.ts (Read-Tool) → kennt identity + processKnowledge
  2. Erstellt Interview-Record via Supabase MCP mit explizitem Mapping:
       employee_name  = identity.name
       employee_role  = identity.role
       department     = identity.department
       focus_topics   = processKnowledge.processes[].name (Array, null wenn leer)
     → erhält Token aus DB-Response
  3. curl POST /api/interview/[token]/start → Interviewer-Opener (erster Agent-Turn)
  4. Schleife (max. 20 Turns):
     a. Claude Code generiert Persona-Antwort (inline, kein API-Call)
     b. curl POST /api/interview/[token]/chat → Agent-Antwort
     c. Silent-Tool-Only? → "[Turn N] Agent: silent — tool-only", Loop-Ende
     d. register_step-Tool-Call erkannt? → "[PASS] register_step in Turn N", Loop-Ende
  5. Schreibt Transcript nach docs/evals/interview/YYYY-MM-DD-buchhalter.md
  6. Record bleibt in DB — kein Cleanup.
  7. Gibt strukturierten Abschluss-Output aus:
       Interview-URL:    http://localhost:3000/interview/<token>
       Nächste Schritte:
         → Extraktion triggern:  POST /api/extract (Interview-ID: <id>)
         → Prozessschritte:      Supabase process_steps für interview_id=<id> prüfen
         → Use Cases:            Supabase use_cases für interview_id=<id> prüfen
```

#### Persona-Schema (Datenmodell)

```
PersonaIdentity
  name: string
  role: string
  department: string
  yearsExperience: number

PersonaStyle
  verbosity: 'concise' | 'detailed'
  tone: 'formal' | 'informal'
  tendencies: string[]    (z.B. "nennt konkrete Zahlen", "weicht aus wenn unsicher")

PersonaProcessKnowledge
  processes[]:
    name, description, tools[], pain_points[], frequency
  tools[]:
    name, purpose, satisfaction
  additionalContext: string (optional)

Persona
  identity: PersonaIdentity
  description: string
  style: PersonaStyle
  processKnowledge: PersonaProcessKnowledge
```

#### Report-Format

```
---
interview_model: <Wert aus INTERVIEW_MODEL env>
eval_date: YYYY-MM-DD
persona: buchhalter
---

[Turn 1] Agent: "Guten Tag, Herr Müller. Ich freue mich..."
[Turn 2] Persona (Hans Müller): "Hallo, ja ich arbeite seit..."
[Turn 3] Agent: "Welche Tools nutzen Sie täglich für...?"
...
[PASS] register_step erreicht in Turn 8.
```

#### Tech-Entscheidungen

- **Claude Code als Persona statt separater API-Call:** Kein TESTER_MODEL, kein Haiku-API-Key. Claude Code liest das `processKnowledge` und antwortet im Persona-Charakter. Für qualitative Review ausreichend.
- **Persona-Dateien als TypeScript (nicht Markdown):** Typsicherheit bei Schema-Migration; Claude Code kann TypeScript-Dateien lesen. Kein Build-Step nötig.
- **Supabase MCP für Interview-Record-Erstellung:** Kein manuelles Anlegen, kein separater Setup-Endpoint. MCP ist im Dev-Setup bereits verbunden (seit 2026-05-22).
- **Dev-Server-Pflicht:** `/start` und `/chat` sind Next.js-API-Routes und laufen nur bei aktivem `npm run dev`. Gilt auch für den alten runner.ts — keine neue Einschränkung.
- **Kein Determinismus-Anforderung:** Ohne `temperature: 0` schwanken Persona-Antworten zwischen Läufen leicht. Für qualitative Review kein Problem. Wird erst relevant bei pass@k (Backlog 1).

---

### Abhängigkeiten / Packages

Keine neuen npm-Packages erforderlich. Supabase MCP muss verbunden sein (ist es seit 2026-05-22).

### Appetite

**M** (3-5 Tage) — 1 neuer Endpoint, 1 modifizierter Endpoint, 1 neuer Skill, 1 neuer Typen-File, 3 migrierte Persona-Files, 3 gelöschte Service-Files, 2 modifizierte Frontend-Dateien.

## QA Test Results

**QA Date:** 2026-05-25
**Tester:** /qa skill (Claude Code)
**Test run:** `npm test` → 207 tests passed, 23 test files

### Acceptance Criteria

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | `POST /api/interview/[token]/start` existiert | PASS | route.ts vorhanden |
| 2 | Token-UUID-Validierung (404) | PASS | unit-tested |
| 3 | Token-Expiry → 410 | PASS | unit-tested |
| 4 | Status `completed` → 409 | PASS | unit-tested |
| 5 | Rate-Limit via `checkTokenEndpointLimits` → 429 | PASS | unit-tested |
| 6 | Turns vorhanden → 409 mit /reconnect-Hinweis | PASS | unit-tested |
| 7 | Streams Greeting mit `isStart: true` | PASS | unit-tested |
| 8 | Greeting enthält `employee_name` wörtlich | MANUAL | LLM-Verhalten; system prompt enthält Name. Requires manual eval run. |
| 9 | Greeting referenziert `employee_role` wenn gesetzt | MANUAL | LLM-Verhalten; system prompt enthält Rolle. |
| 10 | Greeting referenziert `focus_topics` wenn gesetzt | MANUAL | LLM-Verhalten; system prompt enthält Fokusthemen. |
| 11 | Null-Felder → keine "null"/"undefined"-Strings | PASS | System prompt conditional (`${role ? ... : ''}`, `focusLine`); unit-tested |
| 12 | `/reconnect` → 409 wenn keine Turns | PASS | unit-tested + code |
| 13 | `/reconnect` Bestandsverhalten unverändert | PASS | unit-tested |
| 14 | `useInterviewStream` exposes `start()` | PASS | unit-tested |
| 15 | ChatInterface: `created` + keine Turns → `start()` | PASS | code review |
| 16 | Reconnect-Banner nur bei echtem Reconnect | PASS | `showReconnectBanner` init on `existingTurns.length > 0` |
| 17 | `personas/types.ts` mit korrektem Schema | PASS | file reviewed |
| 18 | Drei Personas auf neues Schema migriert | PASS | buchhalter, vertriebler, it-support geprüft |
| 19 | runner.ts, report.ts, metrics.ts gelöscht | PASS | nur `personas/` Verzeichnis übrig |
| 20 | Skill-Datei `eval-interview.md` existiert | PASS | vollständig gelesen |
| 21 | Skill liest Persona-Datei via Read-Tool | PASS | Schritt 1 dokumentiert |
| 22 | Skill legt Interview-Record via Supabase MCP an | PASS | Schritt 2 mit SQL + Feld-Mapping |
| 23 | Skill ruft `/start` via curl auf | PASS | Schritt 3 dokumentiert |
| 24 | Claude Code übernimmt Persona inline | PASS | Anti-Halluzinations-Regel + Skill-Ablauf |
| 25 | Claude Code eröffnet Gespräch nie | PASS | explizite Skill-Anweisung |
| 26 | Silent-tool-only → protokolliert + Loop-Abbruch | PASS | Schritt 4d dokumentiert |
| 27 | Transcript nach `docs/evals/interview/YYYY-MM-DD-<persona>.md` | PASS | Schritt 5 |
| 28 | Record bleibt in DB | PASS | Schritt 6, kein Cleanup |
| 29 | Strukturierter Abschluss-Output mit Nächste-Schritte | PASS | Schritt 7 mit URL + SQL |
| 30 | Report-Header mit interview_model, Datum, Persona-Name | PASS | Schritt 5 Format |
| 31 | Transcript mit `[Agent]` und `[Persona: <Name>]` Labels | PASS | Schritt 5 Format |
| 32 | **Dokumentations-AC**: PROJ-8-Spec verweist auf PROJ-17, BUG-5/BUG-6 als gefixt markiert | FAIL | Nicht vorhanden → BUG-L1 |

### Bugs

**BUG-L1 (Low) — PROJ-8-Spec referenziert PROJ-17 nicht**
AC: "PROJ-8-Spec verweist auf PROJ-17 und markiert BUG-5 (Vertriebler-Loop) sowie BUG-6 (Selector-Gedächtnis) als gefixt."
Ist-Zustand: `features/interview-engine/PROJ-8-interview-design-optimierung.md` beschreibt BUG-5 und BUG-6 noch als offen. Kein PROJ-17-Verweis.
Fix: Abschnitt in PROJ-8-Spec ergänzen: BUG-5 und BUG-6 betreffen den Keyword-Selector, der durch PROJ-17 vollständig ersetzt wurde. Bugs sind damit strukturell gefixt.

**BUG-L2 (Low) — `/reconnect` gibt 409 zurück wenn Turns-DB-Query fehlschlägt**
Wenn die Supabase-`turns`-Query in `/reconnect` fehlschlägt (`{ data: null, error: ... }`), ist `existingTurns = []` und die neue 409-Guard feuert. Der Client erhält "Cold-Start verwenden", obwohl ein DB-Fehler vorliegt. Korrekt wäre ein 500.
Steps: Supabase-DB unerreichbar → `POST /reconnect` mit gültigem Token → 409 statt 500.
Wahrscheinlichkeit: sehr gering (Supabase-Ausfall nötig).
Fix: Error-Feld aus Promise.all destructuren und bei Turns-Query-Fehler 500 zurückgeben.

### Security Audit

- Token-Authentifizierung: identisch mit `/reconnect`, kein neues Auth-Surface ✓
- Rate Limiting: `checkTokenEndpointLimits` in `/start` eingebunden ✓
- Input-Validierung: UUID-Regex-Check auf Token ✓
- Parameterized Queries via Supabase ✓
- Keine RLS-Änderungen ✓
- Keine Secrets in Responses ✓
- Eval-Skill: schreibt via MCP in Dev-DB, kein Production-Security-Risk ✓

### Regression

Alle 207 Tests (23 Dateien) bestehen. Kein Regressionsbefund in bestehenden Interview-Routes oder Frontend-Hooks.

### Tally: 0 High / 0 Medium / 2 Low

**Production-ready: YES**

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
