# PROJ-1: Auth + Workspace

## Status: Architected
**Created:** 2026-05-19
**Last Updated:** 2026-05-19

## Dependencies
- None — Basis für alle anderen Features

## User Stories
- Als Berater registriere ich mich per E-Mail/Passwort, damit ich eigene Workspaces und Interviews habe.
- Als registrierter Benutzer logge ich mich ein und werde zum Dashboard weitergeleitet.
- Als eingeloggter Benutzer sehe ich meinen Workspace-Namen im Sidebar-Header.
- Als eingeloggter Benutzer kann ich mich ausloggen und werde zur Login-Seite weitergeleitet.
- Als nicht-authentifizierter Benutzer werde ich bei jedem geschützten Route automatisch zu `/login` umgeleitet.
- Als Backend-API kann ich per Service-Role-Key Daten schreiben ohne RLS-Einschränkung (z.B. Extraktions-Agent).

## Acceptance Criteria

### Auth Flow
- [ ] Signup via Supabase Auth — E-Mail + Passwort + Workspace-Name
- [ ] Nach Signup: `workspaces`-Eintrag automatisch per Postgres-Trigger (`on auth.users insert`) angelegt
- [ ] `workspace_id` in `auth.users.user_metadata` gespeichert (kein Extra-Query auf Client)
- [ ] Login per E-Mail/Passwort → SSR-kompatible Session via `@supabase/ssr` (cookie-based)
- [ ] Ausloggen löscht Session, Redirect zu `/login`
- [ ] Passwort-Reset via Supabase Email (kein Custom UI im MVP)
- [ ] User A hat keinen Zugriff auf Daten von User B (RLS-Isolation per `workspace_id`)

### Schema Migration
- [ ] Neue Migration ersetzt altes Schema: `unternehmen`, `mitarbeiter`, `knowledge_chunks`, alte `interviews`-Tabelle werden gedroppt
- [ ] Neue Tabellen gemäß PRD-Schema:
  - `workspaces` (id, name, hourly_rate, user_id, created_at)
  - `interviews` (id, workspace_id, employee_name, employee_role, status, created_at)
  - `interview_state` (interview_id PK, phase, timer_minutes, topics_covered, topics_open, extractions_log, updated_at)
  - `turns` (id, interview_id, turn_number, user_input, agent_response, created_at)
  - `knowledge_objects` (id, interview_id, workspace_id, type, content jsonb, source_quote, turn_id, embedding vector(1536), created_at)
  - `process_steps` (id, interview_id, workspace_id, title, description, role, frequency_per_month, duration_minutes, data_sources text[], rule_based bool, error_rate_percent int, media_breaks int, source_quote, created_at)
  - `use_cases` (id, process_step_id, workspace_id, type, title, description, reasoning, priority, roi_hours_per_year, roi_eur_per_year, effort, score, quarter, created_at)
- [ ] pgvector Extension bleibt — IVFFlat-Index auf `knowledge_objects.embedding`
- [ ] RLS aktiviert auf allen Tabellen — Policy: `workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())`
- [ ] `updated_at`-Trigger auf `workspaces`, `interview_state`

### Supabase Client Setup
- [ ] `src/lib/supabase-server.ts` — Server-Client via `@supabase/ssr` (cookie-based, für API Routes + Server Components)
- [ ] `src/lib/supabase-admin.ts` — Service-Role-Client mit `SUPABASE_SERVICE_ROLE_KEY` (für Extraktions-Agent, nicht im Browser)
- [ ] `src/lib/supabase.ts` — Browser-Client via `@supabase/ssr` (aktuell vorhanden, auf SSR-Pattern anpassen)
- [ ] Alle drei Clients in `.env.local.example` dokumentiert

### Routing & Middleware
- [ ] Next.js Middleware (`middleware.ts`) schützt alle Routen außer `/login`, `/signup`, `/auth/callback`
- [ ] `/` redirectet zu `/dashboard` wenn Session aktiv, sonst zu `/login`
- [ ] `/auth/callback` verarbeitet Supabase-Callbacks (Email-Bestätigung, Passwort-Reset)

### UI
- [ ] `/login` — E-Mail + Passwort Input, "Anmelden"-Button, Link zu `/signup`, Error-Toast bei falschen Credentials
- [ ] `/signup` — E-Mail + Passwort + Workspace-Name Input, "Registrieren"-Button, Link zu `/login`, Error-Toast bei doppelter E-Mail
- [ ] `/dashboard` — Shell-Layout mit dunkler Sidebar (Workspace-Name oben, Logout-Button unten), leerer Content-Bereich als Platzhalter für PROJ-2+
- [ ] Loading State (Button disabled + Spinner) während Auth-Operation
- [ ] Meridian Pink `#E040FB` als primäre Button-Farbe

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Signup mit bereits verwendeter E-Mail | Error-Toast: "Diese E-Mail ist bereits registriert" |
| Login mit falschem Passwort | Error-Toast: "Ungültige Anmeldedaten" |
| Workspace-Trigger schlägt fehl | Signup schlägt fehl, Benutzer sieht generischen Fehler, kein Zombie-User in `auth.users` |
| Session abgelaufen während Nutzung | Middleware erkennt expired session, Redirect zu `/login` |
| Direktzugriff auf `/dashboard` ohne Session | Middleware redirectet zu `/login` |
| `SUPABASE_SERVICE_ROLE_KEY` fehlt in env | Fehler beim Import von `supabase-admin.ts` mit aussagekräftiger Meldung |
| User sendet fremde `workspace_id` im API-Body | RLS blockiert Query — leeres Ergebnis oder 403 |
| Workspace-Name leer beim Signup | Client-seitige Validierung, Button bleibt disabled |

## Technical Requirements
- Security: RLS auf allen Tabellen — niemals deaktivieren, auch nicht temporär
- Security: Service-Role-Key nur server-seitig (NEVER `NEXT_PUBLIC_`)
- Security: E-Mail-Verifizierung für MVP deaktiviert (Supabase Dashboard → Auth Settings)
- Performance: Login/Signup < 2s unter normalen Bedingungen
- Scope: Kein Team-Feature (mehrere User pro Workspace), kein OAuth/Social Login im MVP

## Out of Scope
- Team-Funktionalität (mehrere User pro Workspace)
- OAuth / Social Login
- E-Mail-Verifizierung vor Login
- Passwort-Änderung im Profil
- Workspace-Einstellungen UI

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
App Router (Next.js)
│
├── /login                   (öffentlich)
│   ├── LoginForm
│   │   ├── EmailInput
│   │   ├── PasswordInput
│   │   ├── SubmitButton (mit Spinner)
│   │   └── ErrorToast (Sonner)
│   └── Link → /signup
│
├── /signup                  (öffentlich)
│   ├── SignupForm
│   │   ├── WorkspaceNameInput
│   │   ├── EmailInput
│   │   ├── PasswordInput
│   │   ├── SubmitButton (mit Spinner)
│   │   └── ErrorToast (Sonner)
│   └── Link → /login
│
├── /auth/callback           (öffentlich — Supabase-Redirect-Ziel)
│   └── Route Handler
│
└── /dashboard               (geschützt)
    └── DashboardShell
        ├── Sidebar (dunkel)
        │   ├── WorkspaceName (oben)
        │   └── LogoutButton (unten)
        └── MainContent (Platzhalter für PROJ-2+)

middleware.ts                (schützt alle Routen außer /login, /signup, /auth/callback)
```

### Datenmodell

| Tabelle | Zweck | Isolation |
|---------|-------|-----------|
| `workspaces` | Ein Eintrag pro User. Enthält Workspace-Name und Stundensatz | via `user_id = auth.uid()` |
| `interviews` | Jedes Interview gehört zu einem Workspace | via `workspace_id` |
| `interview_state` | Zustand eines laufenden Interviews (Phase, Timer, Topics) | via `workspace_id` der verknüpften `interviews` |
| `turns` | Jede Frage-Antwort-Runde im Interview | via `interview_id` |
| `knowledge_objects` | Extrahiertes Wissen mit Vektor-Embedding (1536 dim) | via `workspace_id` |
| `process_steps` | Identifizierte Prozessschritte mit Metriken | via `workspace_id` |
| `use_cases` | Abgeleitete KI-Use-Cases mit ROI | via `workspace_id` |

Workspace-Anlage via Postgres-Trigger bei `auth.users` INSERT. RLS auf allen Tabellen, nicht deaktivierbar.

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auth-System | Supabase Auth | Bereits im Stack |
| Session-Handling | Cookie-based via `@supabase/ssr` | Server Components brauchen Cookies |
| Route-Schutz | Next.js Middleware | Läuft vor jedem Request, kein Client-seitiger Leak |
| Datenbankzugriff (UI) | Server-Client (SSR) | Session mitgeführt, keine Tokens im Browser |
| Datenbankzugriff (Agent) | Service-Role-Client | Schreibt ohne RLS, nur server-seitig |
| UI-Komponenten | shadcn/ui (bereits installiert) | Button, Input, Form, Toaster vorhanden |
| Validierung | react-hook-form + Zod | Bereits im Stack |

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `@supabase/ssr` | SSR-kompatible Supabase-Clients (cookie-based) |

### Datenbankmigrationen

Eine Migration: alte Tabellen droppen (`unternehmen`, `mitarbeiter`, `knowledge_chunks`, alte `interviews`), neue Tabellen anlegen mit pgvector-Index, RLS-Policies und `updated_at`-Triggern.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
