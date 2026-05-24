# PROJ-17: Adaptive Eval-Harness + Start-Endpoint

## Status: Planned
**Created:** 2026-05-24
**Last Updated:** 2026-05-24
**Type:** Feature
**Domain:** Interview Engine
**Extends:** —
**Appetite:** —
**Bugs:** —

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — Erweiterung von `interviewAgent.ts` / `createInterviewStream` und neuer Backend-Route
- Requires: PROJ-3 (Interview UI) — `ChatInterface.tsx` und `useInterviewStream` müssen zwischen `/start` und `/reconnect` verzweigen
- Requires: PROJ-8 (Interview-Design Optimierung) — Personas, Runner, Reports und Eval-Skript stammen aus diesem Feature und werden inhaltlich abgelöst
- Requires: PROJ-12 (Rate Limiting) — neuer `/start`-Endpoint klinkt sich in `checkTokenEndpointLimits` ein

## Hintergrund & Motivation

Zwei zusammenhängende Probleme im Interview-Pfad:

1. **Eval-Harness ist nutzlos.** Die heutige PROJ-8-Eval-Harness liefert statische, Keyword-gematchte Persona-Antworten (`src/services/__evals__/interview/runner.ts:41-79`). Bei jeder Umformulierung der Interviewer-Frage greift der Selector ins Leere und fällt auf `responses['default']` (= Selbstvorstellung) zurück. Der Runner startet zusätzlich mit der Persona-Selbstvorstellung als erstem Turn — der Mitarbeiter eröffnet das Gespräch, obwohl der Interviewer eröffnen sollte. Folge: alle drei Personas FAIL im letzten Eval-Lauf (2026-05-24), Antworten wiederholen sich endlos, der Interview-Agent kann logisch kein Wissen extrahieren.
2. **Cold-Start nutzt Reconnect-Endpoint.** Das Frontend ruft beim Erst-Öffnen denselben `/reconnect`-Endpoint wie bei echten Reconnects (`ChatInterface.tsx:47-72`). Dadurch wird der Interview-Agent beim Cold-Start mit dem Reconnect-System-Marker (`[SYSTEM: Der Mitarbeiter hat die Verbindung wiederhergestellt...]`) initialisiert, obwohl gar kein Reconnect stattfindet. Die Begrüßung referenziert die Interview-Metadaten (Name, Rolle, Department, Fokusthemen) heute nicht aktiv.

Beide Probleme sind über denselben Code-Pfad gekoppelt (Initiation des Interviews), daher in einem Feature gebündelt.

## User Stories

- Als **Developer**, der den Interview-Agenten weiterentwickelt, will ich eine Eval-Harness, deren synthetische Personas adaptiv auf die Fragen des Agents reagieren, damit die Eval misst, wie gut der Agent Wissen extrahiert — und nicht, ob er einen Keyword-Selector trifft.
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
- [ ] Alle bisherigen `/reconnect`-Verhalten bei vorhandenen Turns bleiben unverändert (Begrüßung mit Reconnect-System-Marker, kein DB-Write).

### Frontend
- [ ] `useInterviewStream`-Hook stellt eine `start()`-Methode bereit, die `POST /api/interview/[token]/start` aufruft.
- [ ] `ChatInterface.tsx` wählt beim Auto-Greet anhand des initialen Interview-Status: `created` und keine Turns → `start()`, sonst → `reconnect()`.
- [ ] Reconnect-Banner wird weiterhin nur bei echtem Reconnect angezeigt (Verhalten unverändert).

### Eval-Harness
- [ ] Persona-Schema in `personas/types.ts` definiert: `identity`, `description`, `style`, `processKnowledge` (strukturierte Fakten, keine slot-keyed Strings).
- [ ] Drei Personas (Buchhalter, Vertriebler, IT-Support) auf neues Schema migriert.
- [ ] Neuer Service `src/services/__evals__/interview/testerAgent.ts` exportiert `generatePersonaReply(persona, history, latestAgentMessage)`.
- [ ] Tester-Agent nutzt das via `TESTER_MODEL` env konfigurierte Modell (Default: `anthropic/claude-haiku-4-5`), bewusst vom `INTERVIEW_MODEL` getrennt.
- [ ] Tester-Agent läuft mit `temperature: 0` und ohne Tools.
- [ ] Tester-Agent verweigert das Erfinden von Fakten, die nicht im `processKnowledge` stehen (im System-Prompt explizit geregelt).
- [ ] Tester-Agent eröffnet das Gespräch nicht — er antwortet nur auf Interviewer-Fragen.
- [ ] Runner holt den Opener via `POST /start` und übergibt ihn dem Tester-Agent als erste Interviewer-Nachricht.
- [ ] Runner ersetzt `selectPersonaResponse` durch `generatePersonaReply` und führt eine Conversation-History mit.
- [ ] Wenn der Interview-Agent in einem Turn keinen Text zurückgibt (Silent-Tool-Only, BUG-4), bricht der Runner mit einer Log-Zeile `[Turn N] Agent: silent — tool-only` ab. Kein Nudge.
- [ ] Eval-Report (`docs/evals/interview/YYYY-MM-DD-<persona>.md`) enthält einen Header-Block mit `interview_model`, `tester_model` und `temperature`.

### Pass-Definition für den Eval-Lauf
- [ ] Im erzeugten Transcript eröffnet die erste Zeile den Dialog als `Agent` (Interviewer), nicht als `Persona`.
- [ ] Kein Auftreten desselben Persona-Texts in zwei aufeinanderfolgenden Turns (kein Endlos-Selbstvorstellungs-Loop).
- [ ] Visuelle Review: Persona-Antworten gehen kontextuell auf die jeweilige Interviewer-Frage ein (nicht statisch / nicht aus dem Kontext gerissen).
- [ ] Alle drei Personas durchlaufen den Runner mindestens bis zum ersten `register_step`-Tool-Call des Agents — oder es liegt ein dokumentierter BUG-4-Treffer vor.

### Dokumentation
- [ ] PROJ-8-Spec (`features/PROJ-8-interview-design-optimierung.md`) verweist auf PROJ-17 und markiert BUG-5 (Vertriebler-Loop) sowie BUG-6 (Selector-Gedächtnis) als gefixt.
- [ ] `.env.local.example` dokumentiert `TESTER_MODEL`.

## Edge Cases

- **Token-Race:** Zwei Clients öffnen den Token gleichzeitig und beide rufen `/start` parallel an. Beide Anfragen erhalten 200 + Greeting-Stream; es entsteht kein DB-Inkonsistenz, weil `/start` keinen Turn schreibt. Erst der erste `/chat`-Aufruf aktiviert das Interview (`status: active`).
- **Token abgelaufen während Greeting:** `/start` prüft `token_expires_at` vor dem Stream-Start; spätere Ablauf während des Streamings wird nicht behandelt (verschwindend selten, kein DB-Write).
- **Interview ohne `employee_role` und `focus_topics`:** Greeting darf nur Name und ggf. Department referenzieren; kein Platzhalter-String im Output.
- **Persona-Wissen unvollständig (z. B. `additionalContext` fehlt):** Tester-Agent funktioniert trotzdem, ignoriert fehlende optionale Felder.
- **Interviewer fragt nach etwas, das nicht im `processKnowledge` steht:** Tester-Agent antwortet ehrlich („Da müsste ich nachsehen." oder „Das weiß ich aus dem Kopf nicht.") statt zu halluzinieren.
- **Tester-LLM-Call schlägt fehl (Netzwerk, Rate-Limit, ungültiger Key):** Runner bricht mit klarem Fehler ab; kein Silent-Skip, kein Retry. Dev sieht den Fehler im Log.
- **`/reconnect` von altem Client für Cold-Start aufgerufen** (z. B. gecachte Browser-Tab): 409-Response, Frontend sollte auf den 409 reagieren und `/start` versuchen. Frontend-Fix ist Teil dieses Features; vorhandene Clients sehen einen Fehler-Toast.
- **`/start` von Client für aktives Interview aufgerufen** (z. B. Reload nach Turn 1): 409, Frontend muss `/reconnect` nehmen.

## Technical Requirements (optional)

- **Performance:** `/start`-Endpoint Time-to-First-Token ≤ 2 s (analog `/reconnect`).
- **Security:** Token-Authentifizierung wie bestehende Interview-Routes; keine RLS-Änderungen.
- **Determinismus der Eval:** Tester-Agent mit `temperature: 0`. Modell-IDs werden im Report protokolliert (Reproduzierbarkeitsspur, motiviert durch Biderman/Schoelkopf 2024 „Lessons from the Trenches on Reproducible Evaluation").
- **Vendor-Diversität:** `TESTER_MODEL` und `INTERVIEW_MODEL` sollen unterschiedliche Anbieter benennen (default Anthropic vs. heute Google), um korrelierte blinde Flecken bei der Eval zu vermeiden.

## Out of Scope

- **Fix für BUG-4 (Silent-Tool-Only-Turns) im Interview-Agent.** Wird in PROJ-8-Folge oder eigenem Feature adressiert; PROJ-17 erkennt und protokolliert den Bug nur.
- **Multi-Run-Statistik / Streuungs-Tests des Tester-Agents.** Aktuell ein Run pro Persona reicht; falls die qualitativen Reviews Schwankungen zeigen, später eigenes Feature.
- **OpenAI als Tester-Provider.** `llm-provider.ts` müsste dafür erweitert werden, nicht in diesem Spec-Scope.
- **CI-Integration des Evals.** Bleibt manuell vor Merge (LLM-Kosten).
- **Quantitative Pass-Schwelle (≥ 80 % Slot-Coverage).** Bewusst durch qualitative Bewertung ersetzt, weil die Coverage-Werte solange unzuverlässig bleiben, wie BUG-4 nicht gefixt ist.
- **Anti-Halluzinations-Probetest mit absichtlich unbeantwortbaren Fragen.** Sinnvoll, aber separates Feature.

## Konzeptionelle Erweiterungen (Backlog für Folgeiterationen)

Diese Punkte sind **nicht** Teil der aktuellen Acceptance Criteria, sondern dokumentieren, wohin der Eval-Harness in späteren Iterationen wachsen sollte. Sie werden hier festgehalten, damit das Design-Wissen nicht verloren geht, wenn das aktuelle Spec deployt ist und der Diskussionskontext verschwindet.

### 1. pass@k-Metrik statt Single-Run-Pass

**Heute (in Scope):** Ein Run pro Persona, qualitative Bewertung im Report. Pass-Definition über vier strukturelle Kriterien (siehe AC).

**Spätere Iteration:** Übergang zu `pass@k` als Metrik, d.h. „Persona besteht, wenn mindestens k von n identischen Wiederholungen die Pass-Kriterien erfüllen." Realistischer für probabilistisches Verhalten des Interview-Agents: ein einzelner Lauf kann zufällig grün sein, während der Agent in 3 von 5 Läufen scheitert.

**Trigger für Aktivierung:** Sobald qualitative Reviews systematische Schwankungen zwischen Läufen zeigen (siehe Out of Scope „Multi-Run-Statistik"). Konkrete Schwelle: ≥2 dokumentierte Fälle, in denen derselbe Code-Stand bei zwei manuellen Eval-Läufen unterschiedliche Pass-Outcomes produziert.

**Implementierungsskizze:** Runner erhält `RUNS_PER_PERSONA` (Default 1, Eval-Mode 5). Report enthält Tabelle „Lauf 1..N: pass/fail je Kriterium" plus aggregiertes `pass@k`. Eigenes Folgefeature, weil LLM-Kosten linear mit N skalieren.

### 2. Trajectory-Metriken auf Tool-Call-Ebene

**Heute (in Scope):** Outcome-Metriken (eröffnet Agent? Loops? `register_step` erreicht?).

**Spätere Iteration:** Strukturierte Erfassung des Tool-Call-Pfads über den gesamten Interview-Lauf. Vorbild aus ADR-004 Sektion 8 (Trajectory-Felder im Post-Mortem): nicht nur ob das Outcome stimmt, sondern wie sauber der Pfad dorthin war.

**Konkrete Metriken:**
- `tool_call_count` pro Lauf (Soll vs. Ist)
- `tool_call_errors` (Tools mit Fehler-Response, z.B. ungültige Argumente)
- `tool_call_redundancy` (Aufrufe desselben Tools mit identischen Args innerhalb von 3 Turns)
- `silent_tool_only_turns` (existiert schon implizit über BUG-4-Detection, wird hier zur Metrik)

**Trigger:** Wenn /retro auf 3+ deployten Iterationen wiederholt „Tool-Call-Fehler" als häufigste Fehlerkategorie ausweist (ADR-004 Sektion 8 Trajectory-Feld). Dann ist eine systematische Erfassung im Eval-Harness gerechtfertigt.

**Implementierungsskizze:** Runner instrumentiert den Stream und zählt Tool-Call-Events. Report-Header bekommt Tool-Call-Tabelle. Keine Pass/Fail-Logik dranhängen, nur protokollieren — Pass/Fail bleibt qualitativ.

### 3. Hybride Architektur: deterministische Vor-Filterung + LLM-Judge

**Heute (in Scope):** Pass-Kriterien werden im Code geprüft (Regex/String-Checks auf Transcript), plus qualitative Review durch Dev. Kein LLM-Judge im Eval-Loop.

**Spätere Iteration:** Wenn die Anzahl der zu bewertenden Eval-Läufe stark wächst (z.B. ≥10 Personas × pass@k), wird manuelle Review zum Engpass. Hybride Architektur reduziert dann den LLM-Judge-Aufwand: deterministische Vor-Filterung (Regex, Schema-Validierung der Transcripts) entfernt offensichtlich gescheiterte Läufe **bevor** ein LLM sie bewerten muss. Nur die Grauzonen-Läufe gehen an einen LLM-Judge.

**Vorbild:** EmbedSLR-Pattern (deterministische Filterung vor semantischer Bewertung, reduziert Varianz und Kosten).

**Trigger:** Sobald die Anzahl der Eval-Läufe pro Sprint manuelle Review unrealistisch macht (Faustregel: >30 Reports/Sprint).

**Implementierungsskizze:** Pre-Filter-Layer im Runner (deterministische Checks aus aktueller Pass-Definition). LLM-Judge-Layer (eigene SKILL.md, getrennt von `testerAgent.ts`). Judge-Prompt mit Few-Shot-Beispielen aus realen Reports. Validierung des Judges gegen Dev-Urteile auf einem manuellen Sample (Methodik analog ADR-004-Diskussion: keine wissenschaftliche Statistik, aber Sichtprüfung auf ≥80% Übereinstimmung mit Dev).

### Verhältnis zu „Out of Scope"

Die obigen drei Punkte überlappen bewusst mit zwei Out-of-Scope-Einträgen:
- „Multi-Run-Statistik / Streuungs-Tests des Tester-Agents" entspricht Punkt 1.
- Eine LLM-Judge-Architektur ist heute nicht aufgeführt, gehört aber konzeptionell zur selben Familie.

Out of Scope bleibt **verbindlich für die aktuelle Implementierung**. Diese Backlog-Sektion dokumentiert nur die Erweiterungspfade, damit zukünftige /refine-Läufe auf einer kohärenten Designidee aufsetzen statt von vorn zu beginnen.

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
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
