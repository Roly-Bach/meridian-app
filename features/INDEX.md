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
| PROJ-1 | Auth + Workspace | In Progress | [spec](PROJ-1-auth-workspace.md) | 2026-05-19 | P0 | — |
| PROJ-2 | Interview Engine Backend | Roadmap | — | 2026-05-19 | P0 | PROJ-1 |
| PROJ-3 | Interview UI | Roadmap | — | 2026-05-19 | P0 | PROJ-1, PROJ-2 |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Roadmap | — | 2026-05-19 | P0 | PROJ-1, PROJ-2 |
| PROJ-5 | Prozessschritt-Anreicherung | Roadmap | — | 2026-05-19 | P0 | PROJ-1, PROJ-4 |
| PROJ-6 | Use Case Identifikation | Roadmap | — | 2026-05-19 | P0 | PROJ-1, PROJ-5 |

<!-- Add features above this line -->

## Next Available ID: PROJ-7

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6
