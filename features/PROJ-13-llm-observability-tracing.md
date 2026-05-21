# PROJ-13: LLM Observability & Tracing

## Status: Planned
**Created:** 2026-05-21
**Last Updated:** 2026-05-21

## Dependencies
- PROJ-2 (Interview Engine Backend) — interviewAgent.ts ist primäre Trace-Root
- PROJ-4 (Extraktions-Agent + Wissensbasis) — extraction.ts und embeddings.ts
- PROJ-5 (Prozessschritt-Anreicherung) — processEnrichment.ts
- PROJ-6 (Use Case Identifikation) — useCaseEngine.ts

## Overview
Langfuse-basiertes Tracing für alle 6 KI-Service-Dateien. Ziel ist vollständige Sichtbarkeit über Prompt-Inhalte, Vektor-Kontext, Token-Verbrauch, Latenz und Fehler — ausschließlich im Langfuse-Dashboard (kein In-App-Reporting).

## Scope

**Instrumentierte Services:**
- `src/services/interviewAgent.ts`
- `src/services/extraction.ts`
- `src/services/embeddings.ts`
- `src/services/processEnrichment.ts`
- `src/services/useCaseEngine.ts`
- `src/services/reportGenerator.ts`

**Trace-Struktur:**
- Eine Session-Trace pro Interview (Root: `interview_id`)
- Jeder Service-Call ist ein Kind-Span dieser Session-Trace
- Embedding-Calls nur als Kind-Span innerhalb einer Session-Trace (keine eigenständigen Traces)

**Span-Inhalt pro LLM-Call:**
- Vollständiger Prompt-Text
- Abgerufene Vektordokumente (Kontext aus pgvector)
- LLM-Output
- Token-Count (input + output)
- Latenz in ms
- Modell-Name (Platzhalter: wird via PROJ-9 befüllt)
- Fehler-Details falls vorhanden

## User Stories

- Als Developer kann ich im Langfuse-Dashboard alle LLM-Calls eines Interviews als gruppierte Session-Trace mit Eltern-Kind-Struktur sehen.
- Als Developer kann ich den vollständigen Prompt und den abgerufenen Vektor-Kontext eines Extraction-Runs aufrufen, um schlechte Outputs zu erklären.
- Als Developer kann ich Token-Verbrauch und Latenz pro Service-Call sehen, um teure oder langsame Schritte zu identifizieren.
- Als Developer kann ich Fehler mit vollständigem Trace-Kontext debuggen, statt nur den Fehlertyp zu sehen.
- Als Developer kann ich Token-Count pro Interview schätzen, um LLM-Kosten nach Provider-Wechsel (PROJ-9) zu kalkulieren.

## Acceptance Criteria

- [ ] `langfuse` SDK installiert, `src/lib/langfuse.ts` exportiert einen singleton Client
- [ ] Langfuse-Credentials (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) werden ausschließlich über Umgebungsvariablen gesetzt
- [ ] Alle 6 Services sind instrumentiert und erzeugen Spans
- [ ] Jeder Interview-Ablauf erzeugt eine Trace mit `interview_id` als Root-Trace-ID
- [ ] Jeder LLM-Call-Span enthält: Prompt, Vektor-Kontext, Output, Token-Count (input/output), Latenz, Modell-Name
- [ ] Embedding-Calls erscheinen nur als Kind-Span innerhalb einer Session-Trace
- [ ] Schlägt die Langfuse-API fehl, läuft der LLM-Call trotzdem durch (non-blocking, fire-and-forget)
- [ ] Fehler in einem Service werden als Error-Span geloggt (nicht nur als Exception)
- [ ] Tracing funktioniert mit dem zukünftigen LLM-Provider (provider-agnostisch via Langfuse SDK)

## Edge Cases

- **Langfuse nicht erreichbar:** Trace-Fehler wird in stderr geloggt, der LLM-Call wird nicht blockiert und nicht neu versucht.
- **Interview wird abgebrochen:** Session-Trace wird mit Fehler-Status abgeschlossen, nicht offen gelassen.
- **Großer Vektor-Kontext:** Kein Truncating — vollständige Dokumente werden im Span gespeichert.
- **Parallele Interviews:** Jede Session-Trace ist durch `interview_id` isoliert, kein Cross-Contamination.
- **LLM Provider-Wechsel (PROJ-9):** Modell-Name im Span ist ein Parameter, kein Hardcode — Wechsel erfordert keinen Tracing-Refactor.
- **reportGenerator ohne Interview-Kontext:** Falls ohne `interview_id` aufgerufen, erzeugt er eine eigenständige Trace statt Kind-Span.

## Technical Requirements

- Tracing ist non-blocking: async fire-and-forget, kein `await` auf Langfuse-Flush in Hot Paths
- Kein Tracing-Code in API Routes — ausschließlich in `src/services/` (Service-Layer-Constraint aus PROJ-4)
- Langfuse Cloud (Free Tier) für MVP — kein Self-Hosting
- LLM-Provider bleibt Platzhalter bis PROJ-9 abgeschlossen

## Non-Goals

- In-App Token-/Cost-Reporting (eigenes Feature, nach PROJ-13)
- Langfuse Self-Hosting
- Automated Alerting via Langfuse
- Trace-Sampling (100% Tracing)
- Tracing für nicht-KI-Calls (Datenbankabfragen, Auth)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
