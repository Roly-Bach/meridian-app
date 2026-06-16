# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production
- **Blocked** - Arbeit pausiert wegen externem Faktor (orthogonal zu Planned/Architected/In Progress)

## Features

| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
|----|---------|------|--------|---------|--------|------|----------|----------|------|
| PROJ-1 | Auth + Workspace | Epic | Platform | — | Deployed | [spec](platform/PROJ-1-auth-workspace.md) | P0 | — | — |
| PROJ-2 | Interview Engine Backend | Epic | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-2-interview-engine-backend.md) | P0 | — | — |
| PROJ-3 | Interview UI | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-3-interview-ui.md) | P0 | — | — |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Epic | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-5 | Prozessschritt-Anreicherung | Feature | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-6 | Use Case Identifikation | Epic | Use Case Engine | — | Deployed | [spec](use-case-engine/PROJ-6-use-case-identifikation.md) | P0 | — | — |
| PROJ-7 | Voice Input (Interview) | Extension | Interview Engine | PROJ-3 | Deployed | [spec](interview-engine/PROJ-7-voice-input.md) | P1 | — | — |
| PROJ-8 | Interview-Design Optimierung | Revision | Interview Engine | PROJ-2 | Deployed (superseded by PROJ-22) | [spec](interview-engine/PROJ-8-interview-design-optimierung.md) | P1 | — | — |
| PROJ-9 | LLM Provider Optimierung | Feature | Platform | — | Roadmap | [spec](platform/PROJ-9-llm-provider-optimierung.md) | P1 | — | — |
| PROJ-10 | Access Control & Shared Workspace | Feature | Platform | — | Deployed | [spec](platform/PROJ-10-access-control-shared-workspace.md) | P0 | — | — |
| PROJ-11 | Interview PDF Report | Feature | Dashboard & Output | — | Deployed | [spec](dashboard-output/PROJ-11-interview-pdf-report.md) | P1 | — | — |
| PROJ-12 | Rate Limiting | Feature | Platform | — | Deployed | [spec](platform/PROJ-12-rate-limiting.md) | P1 | — | — |
| PROJ-13 | LLM Observability & Tracing | Feature | Platform | — | Deployed | [spec](platform/PROJ-13-llm-observability-tracing.md) | P1 | M | 0:0:2 |
| PROJ-14 | Embedding-Modell Auswahl | Extension | Wissensbank | PROJ-4 | Deployed | → PROJ-20 | P1 | — | — |
| PROJ-15 | CSP Hardening | Feature | Platform | — | Blocked | [spec](platform/PROJ-15-csp-hardening.md) | P1 | — | — |
| PROJ-16 | Supabase Hardening + Dependency Hygiene | Feature | Platform | — | Planned | [spec](platform/PROJ-16-supabase-hardening.md) | P1 | — | — |
| PROJ-17 | Adaptive Eval-Harness + Start-Endpoint | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-17-adaptive-eval-harness-start-endpoint.md) | P1 | M | 0:0:2 |
| PROJ-18 | Prozessschritt-Deduplication | Feature | Wissensbank | PROJ-5 | Deployed | → PROJ-20 | P1 | M | 0:0:2 |
| PROJ-19 | Knowledge-Informed Interviewing | Extension | Interview Engine | PROJ-2 | Roadmap | — | P2 | — | — |
| PROJ-20 | Prozessableitungs-Pipeline | Epic | Wissensbank | — | Approved | [spec](wissensbank/PROJ-20-prozessableitungs-pipeline.md) | P0 | — | 0:0:1 |
| PROJ-21 | Eval-Foundation für Modell- und Architektur-Vergleich | Revision | Interview Engine | PROJ-17 | Approved | [spec](interview-engine/PROJ-21-eval-foundation-modell-architektur-vergleich.md) | P1 | M | 0:0:0 |
| PROJ-22 | Dual-Loop Interview Engine (ADR-011) | Revision | Interview Engine | PROJ-2 | Approved | [spec](interview-engine/PROJ-22-dual-loop-interview-engine.md) | P1 | L | 0:3:5 |
| PROJ-23 | Adaptive Clarification Questions | Extension | Interview Engine | PROJ-2 | Approved | [spec](interview-engine/PROJ-23-adaptive-clarification-questions.md) | P1 | M | 0:0:0 |
| PROJ-24 | Cluster-aware Use Case Generation + Detail View | Extension | Use Case Engine | PROJ-6 | Approved | [spec](use-case-engine/PROJ-24-cluster-aware-use-case-generation.md) | P1 | L | 0:0:0 |
| PROJ-25 | Prozesswissens-Schema O1–O5 | Revision | Wissensbank | PROJ-20 | Roadmap | [BL-E1.1](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-004 | P1 | L | — |
| PROJ-26 | Getypte Abhängigkeitskanten | Extension | Wissensbank | PROJ-20 | Roadmap | [BL-E1.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-006 | P1 | M | — |
| PROJ-27 | Schema-Bindung + Konformitätsrate | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E1.3](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-003 | P1 | M | — |
| PROJ-28 | Stabile IDs + JSON-Patch-Revision | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E1.4](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-005 | P1 | M | — |
| PROJ-29 | Lost-Update-Race-Fix | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E1.5](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-015 | P1 | M | — |
| PROJ-30 | Governance-Feld je Schritt | Extension | Wissensbank | PROJ-20 | Roadmap | [BL-E1.6](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-022 | P2 | S | — |
| PROJ-31 | Nicht-Befund-/Verweigerungs-Marker | Extension | Interview Engine | PROJ-22 | Roadmap | [BL-E2.1](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-013 | P1 | S | — |
| PROJ-32 | Konfidenz steuert Nachfrage | Revision | Interview Engine | PROJ-23 | Roadmap | [BL-E2.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-019 | P1 | M | — |
| PROJ-33 | Semantischer Ambiguitäts-Auslöser | Extension | Interview Engine | PROJ-23 | Roadmap | [BL-E3.1](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-016 | P1 | M | — |
| PROJ-34 | Ausnahme- + Ziel-/Kontextsteuerung | Extension | Interview Engine | PROJ-23 | Roadmap | [BL-E3.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-002/024 | P2 | M | — |
| PROJ-35 | Konzept-verankerte Nachfrage | Extension | Interview Engine | PROJ-23 | Roadmap | [BL-E3.3](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-017 | P2 | S | — |
| PROJ-36 | Laddering / Abstraktions-Vertiefung | Extension | Interview Engine | PROJ-23 | Roadmap | [BL-E3.4](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-025 | P2 | M | — |
| PROJ-37 | Maieutische Schärfung | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E3.5](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-001 | P2 | S | — |
| PROJ-38 | Profil-adaptives Framing | Extension | Interview Engine | PROJ-22 | Roadmap | [BL-E3.6](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-026 | P2 | S | — |
| PROJ-39 | Lösungssperre / Ist-Fokus | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E3.7](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-027 | P2 | S | — |
| PROJ-40 | Trennung Bewertung / Formalisierung | Revision | Interview Engine | PROJ-22 | Roadmap | [BL-E4.1](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-021/024 | P2 | M | — |
| PROJ-41 | Preparator / Vorbereitung | Extension | Interview Engine | PROJ-2 | Roadmap | [BL-E4.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-021 (offen) | P2 | — | — |
| PROJ-42 | Tiefe-/O10-Metrik | Revision | Interview Engine | PROJ-21 | Roadmap | [BL-E5.1](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-012 | P1 | L | — |
| PROJ-43 | Judge-Disziplin | Revision | Interview Engine | PROJ-21 | Roadmap | [BL-E5.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-009/010/011 | P1 | M | — |
| PROJ-44 | Persona-Perturbation | Extension | Interview Engine | PROJ-21 | Roadmap | [BL-E5.3](../../meridian-ma/requirements/build-backlog-etappe2.md) · E5 | P2 | M | — |
| PROJ-45 | Mehrfach-Läufe + Seed | Extension | Interview Engine | PROJ-21 | Roadmap | [BL-E5.4](../../meridian-ma/requirements/build-backlog-etappe2.md) · EVAL-D-11/12 | P2 | S | — |
| PROJ-46 | Paraphrasen-Robustheits-Test | Extension | Interview Engine | PROJ-21 | Roadmap | [BL-E5.5](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-014 | P2 | M | — |
| PROJ-47 | SME-in-the-loop | Feature | Interview Engine | PROJ-21 | Roadmap | [BL-E5.6](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-012 | P2 | M | — |

<!-- Add features above this line -->

## Next Available ID: PROJ-48

## Known Issues

> Bugs und technische Schulden, die kein eigenes Feature rechtfertigen. Vor dem nächsten Deploy prüfen ob noch offen.

| ID | Severity | Beschreibung | Entdeckt in | Fix-Aufwand |
|----|----------|-------------|-------------|-------------|
| — | — | Keine offenen Issues | — | — |

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

## Architecture Notes

### Service-Layer-Constraint (gilt ab PROJ-4)

KI-Logik (LLM-Calls via Claude, Embedding-Calls, Vektor-Operationen) gehört in dedizierte Service-Dateien unter `src/services/` — nicht direkt in API Routes oder Server Components.

Konkret für PROJ-4: Extraktions-Logik in `src/services/extraction.ts`, Embedding-Logik in `src/services/embeddings.ts`. API Routes rufen nur diese Services auf.

Quelle: Architektur-Review 2026-05-19 gegen "Web Application Development & Tech Stacks 2026"-Leitfaden.
