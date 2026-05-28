# PROJ-13: LLM Observability & Tracing

## Status: Planned
**Created:** 2026-05-21
**Last Updated:** 2026-05-28
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** M (3-5 Tage)
**Bugs:** —

## Dependencies
- PROJ-2 (Interview Engine Backend) — `interviewAgent.ts` ist primärer Trace-Producer
- PROJ-4 (Extraktions-Agent + Wissensbasis) — `extraction.ts`, `embeddings.ts`
- PROJ-5 (Prozessschritt-Anreicherung) — `processEnrichment.ts`
- PROJ-6 (Use Case Identifikation) — `useCaseEngine.ts`
- PROJ-17 (Adaptive Eval-Harness) — Eval-Runner ist zweiter Trace-Producer; Persona × Modell-Tagging entsteht hier

## Hintergrund & Motivation

PROJ-13 war ursprünglich als allgemeine Sichtbarkeit gedacht. Der konkrete Auslöser ist jetzt der **Regression-Befund vom 27.05.2026**: Gemini 3.5 Flash liefert in der Eval-Harness (PROJ-17) schlechtere Ergebnisse als Gemini 3.1 Flash Lite. Vermutung: `interviewAgent.ts` ist auf 3.1 Flash Lite + Buchhalter-Persona overfittet (System-Prompt, Few-Shots, Tool-Sequenzen).

Um den Agenten systematisch zu degeneralisieren, brauchen wir vor jedem Prompt-Refactor eine Vergleichsbasis: gleiche Persona, gleicher Turn-Verlauf, unterschiedliche Modelle — und für jedes Resultat vollständige Sichtbarkeit auf Tool-Calls, Reasoning-Tokens, Latenz und Kosten. Diese Vergleichsbasis ist heute manuell aus stdout-Logs nicht herzustellen.

PROJ-13 schafft genau diese Grundlage:
1. Tracing aller 6 KI-Services in Langfuse
2. Eval-Runs landen als gruppierte Sessions mit `persona` × `model`-Tagging im Langfuse-Dashboard
3. Claude Code liest Traces über den Langfuse-MCP-Server — keine manuelle UI-Auswertung
4. Tool-Calls und Reasoning-Tokens sind als eigenständige Span-Felder sichtbar, nicht im Prompt-Blob versteckt
5. Kosten pro Trace und Aggregation nach Modell stehen im Dashboard zur Verfügung

## User Stories

- Als **Developer** kann ich im Langfuse-Dashboard zwei Eval-Runs (Persona X, Modell A vs. Modell B) nebeneinanderlegen und Tool-Call-Sequenz, Token-Verbrauch, Kosten und Latenz vergleichen.
- Als **Developer** kann ich aus Claude Code via MCP gezielt fragen „zeig mir den letzten Eval-Run der Buchhalter-Persona mit Modell `gemini-3.5-flash`, gruppiert nach Span-Typ" — ohne die Langfuse-UI zu öffnen.
- Als **Developer** kann ich für einen einzelnen LLM-Call sehen: Full System-Prompt, User-Turn-History, Tool-Definitionen, jeden Tool-Call mit Input/Output, Reasoning-Tokens, Output-Text, Token-Counts (Input/Output/Reasoning), Modell-Name, Latenz, Kosten.
- Als **Developer** kann ich für ein Interview alle LLM-Calls als gruppierte Session-Trace mit Eltern-Kind-Struktur sehen (`interview_id` als Trace-Root).
- Als **Developer** kann ich monatliche LLM-Kosten pro Modell aggregiert im Dashboard sehen und einen Provider-Wechsel (PROJ-9) datenbasiert kalkulieren.
- Als **Developer** kann ich Fehler mit vollständigem Trace-Kontext debuggen (Error-Span statt nur Exception in stderr).

## Acceptance Criteria

### Setup & Infrastructure
- [ ] `langfuse` SDK + AI-SDK-v6-OTEL-Integration installiert (`@langfuse/otel` oder offizieller Adapter)
- [ ] `src/lib/langfuse.ts` exportiert Singleton-Client und OTEL-Init
- [ ] Credentials (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) ausschließlich via Env-Vars; Cloud EU als Default-Base-URL
- [ ] Kill-Switch: `LANGFUSE_ENABLED=false` deaktiviert Tracing vollständig (Default für lokales Dev, damit Free Tier nicht durch Hot-Reload-Spam verbraucht wird)
- [ ] Langfuse MCP-Server in `.claude/settings.local.json` registriert; Claude Code kann Traces, Sessions und Aggregationen abfragen
- [ ] README/CLAUDE.md dokumentiert: wie startet Claude Code eine Trace-Query, welche Tags existieren

### Service-Instrumentierung (alle 6 KI-Service-Dateien)
- [ ] `src/services/interviewAgent.ts` instrumentiert
- [ ] `src/services/extraction.ts` instrumentiert
- [ ] `src/services/embeddings.ts` instrumentiert
- [ ] `src/services/processEnrichment.ts` instrumentiert
- [ ] `src/services/useCaseEngine.ts` instrumentiert
- [ ] `src/services/reportGenerator.ts` instrumentiert (niedrigste Priorität)

### Trace-Struktur
- [ ] Jeder Interview-Ablauf erzeugt eine Trace mit `interview_id` als Root-Trace-ID
- [ ] Jeder Service-Call ist ein Kind-Span dieser Session-Trace
- [ ] Embedding-Calls erscheinen ausschließlich als Kind-Span innerhalb einer Session-Trace, nicht als eigenständige Traces
- [ ] Tool-Calls innerhalb eines LLM-Calls erscheinen als eigene Kind-Spans (Span-Typ `tool`), nicht im Prompt-Blob
- [ ] `reportGenerator` ohne `interview_id` erzeugt eine eigenständige Trace

### Span-Inhalt pro LLM-Call
- [ ] System-Prompt (eigenes Feld)
- [ ] User-/Assistant-Turn-History
- [ ] Verfügbare Tool-Definitionen
- [ ] Jeder Tool-Call mit Name, Input-Args, Output (eigene Kind-Spans)
- [ ] Reasoning-/Thinking-Tokens als eigenes Feld (Gemini Thinking, Claude Extended Thinking) — wenn das Modell sie liefert
- [ ] Output-Text und Streaming-Chunks rekonstruierbar
- [ ] Token-Count getrennt: `input`, `output`, `reasoning`, `cached`
- [ ] Latenz in ms (Time-To-First-Token + Total)
- [ ] Modell-Name (Parameter, kein Hardcode — provider-agnostisch)
- [ ] Fehler-Details als Error-Span falls vorhanden
- [ ] Abgerufene Vektordokumente aus pgvector (für Calls mit RAG-Kontext)

### Eval-Integration (PROJ-17 als Trace-Producer)
- [ ] `src/services/__evals__/interview/runner.ts` initialisiert Langfuse-Client und setzt vor jedem Run Tags: `persona`, `model`, `environment=eval`, `eval_run_id`
- [ ] Jeder Eval-Run erscheint im Langfuse-Dashboard als gruppierte Session mit dem Persona-Namen als Session-ID-Präfix
- [ ] `npm run eval-interview <persona>` gibt am Ende die Langfuse-Trace-URL des Runs auf stdout aus
- [ ] Dashboard-View dokumentiert: Vergleich von zwei Eval-Runs (gleiche Persona, unterschiedliches Modell) nebeneinander

### Cost-Tracking
- [ ] Langfuse berechnet Kosten pro Span automatisch (Tokens × Provider-Preisliste); Preisliste für `gemini-3.1-flash-lite`, `gemini-3.5-flash`, Anthropic-Modelle hinterlegt
- [ ] Dashboard-View zeigt: Kosten pro Modell aggregiert pro Tag/Woche
- [ ] Dashboard-View zeigt: Kosten pro Eval-Run (Persona × Modell)
- [ ] Verifikations-Run: ein Test-Interview erzeugt eine Trace, die in der Cost-Übersicht erscheint und nicht 0 € ist

### Non-Blocking & Robustness
- [ ] Tracing ist non-blocking: kein `await` auf Langfuse-Flush in Hot Paths
- [ ] Schlägt die Langfuse-API fehl, läuft der LLM-Call trotzdem durch (fire-and-forget)
- [ ] Trace-Fehler werden in stderr geloggt, der LLM-Call wird nicht neu versucht
- [ ] Tracing-Code ausschließlich in `src/services/` — keine Tracing-Aufrufe in API Routes (Service-Layer-Constraint aus PROJ-4)

## Edge Cases

- **Langfuse nicht erreichbar:** Trace-Fehler in stderr, LLM-Call läuft durch, kein Retry
- **Interview wird abgebrochen:** Session-Trace mit Fehler-Status abgeschlossen, nicht offen gelassen
- **Großer Vektor-Kontext:** Kein Truncating, vollständige Dokumente im Span
- **Parallele Interviews:** Isolation über `interview_id` als Trace-Root, kein Cross-Contamination
- **Lokales Dev mit `LANGFUSE_ENABLED=false`:** Service-Code läuft identisch ab, nur ohne Span-Emission — keine zusätzlichen if-else-Pfade
- **Modell liefert keine Reasoning-Tokens (z.B. 3.1 Flash Lite):** Span-Feld `reasoning_tokens` ist 0 oder fehlt, kein Fehler
- **Eval-Runner crasht mid-run:** offene Session-Trace bekommt Fehler-Status, lokale stdout-Logs bleiben unverändert
- **Provider-Wechsel (PROJ-9):** Modell-Name ist Span-Parameter, kein Refactor nötig
- **MCP-Server-Down:** Claude Code-Queries schlagen fehl, Dashboard bleibt nutzbar

## Technical Requirements

- Vercel AI SDK v6 OTEL-Integration (nicht: manuelle Span-Erstellung pro Service) — vermeidet 6× duplizierten Boilerplate
- Langfuse Cloud EU Free Tier (50k Observations/Monat) für MVP — kein Self-Hosting
- 100 % Sampling — keine Sampling-Logik in dieser Iteration
- Service-Layer-Constraint: Tracing-Code in `src/services/`, nicht in API Routes
- MCP-Konfiguration in `.claude/settings.local.json` (gitignored) — pro Developer eigener Read-Key

## Non-Goals

- In-App Token-/Cost-Reporting (eigenes Feature, nach PROJ-13)
- Langfuse Self-Hosting (erst bei GDPR-Verschärfung oder >50k Spans/Mo)
- Automated Alerting via Langfuse
- Trace-Sampling
- Tracing für nicht-KI-Calls (Datenbankabfragen, Auth)
- Vercel AI Gateway als zweite Cost-Quelle (erst nach PROJ-9, wenn Multi-Provider-Strategie steht)
- Production-Alerting bei Kostenanstieg

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
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
