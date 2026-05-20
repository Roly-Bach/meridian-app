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

## Features

| ID | Feature | Status | Spec | Created | Priority | Depends |
|----|---------|--------|------|---------|----------|---------|
| PROJ-1 | Auth + Workspace | Approved | [spec](PROJ-1-auth-workspace.md) | 2026-05-19 | P0 | — |
| PROJ-2 | Interview Engine Backend | Deployed | [spec](PROJ-2-interview-engine-backend.md) | 2026-05-19 | P0 | PROJ-1 |
| PROJ-3 | Interview UI | Architected | [spec](PROJ-3-interview-ui.md) | 2026-05-19 | P0 | PROJ-1, PROJ-2 |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Approved | [spec](PROJ-4-extraktions-agent-wissensbasis.md) | 2026-05-19 | P0 | PROJ-1, PROJ-2 |
| PROJ-5 | Prozessschritt-Anreicherung | Approved | [spec](PROJ-5-prozessschritt-anreicherung.md) | 2026-05-19 | P0 | PROJ-1, PROJ-4 |
| PROJ-6 | Use Case Identifikation | Approved | [spec](PROJ-6-use-case-identifikation.md) | 2026-05-19 | P0 | PROJ-1, PROJ-5 |
| PROJ-7 | Voice Input (Interview) | Roadmap | — | 2026-05-20 | P1 | PROJ-3 |

<!-- Add features above this line -->

## Next Available ID: PROJ-8

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

## Architecture Notes

### Service-Layer-Constraint (gilt ab PROJ-4)

KI-Logik (LLM-Calls via Claude, Embedding-Calls, Vektor-Operationen) gehört in dedizierte Service-Dateien unter `src/services/` — nicht direkt in API Routes oder Server Components.

**Begründung:** PROJ-4 bis PROJ-6 bauen auf schweren AI-Workloads auf. Eine saubere Service-Schicht hält die Schnittstellen typisiert und ermöglicht, einzelne Services bei Bedarf auf einen externen Python/FastAPI-Dienst auszulagern, ohne dass Frontend-Code angefasst werden muss.

**Konkret für PROJ-4:** Extraktions-Logik in `src/services/extraction.ts`, Embedding-Logik in `src/services/embeddings.ts`. API Routes rufen nur diese Services auf.

Quelle: Architektur-Review 2026-05-19 gegen "Web Application Development & Tech Stacks 2026"-Leitfaden.
