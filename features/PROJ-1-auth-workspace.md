# PROJ-1: Auth + Workspace

## Status: In Progress
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

## Implementation Notes (Backend)

**Geliefert:**
- `supabase/migrations/20260519000001_mvp_schema.sql` — komplette MVP-Migration (Drop + Create + RLS + Trigger + Indexes)
- `src/lib/supabase.ts` — Browser-Client (rewritten to `@supabase/ssr`)
- `src/lib/supabase-server.ts` — SSR-Server-Client (cookie-based, für Server Components + API Routes)
- `src/lib/supabase-admin.ts` — Service-Role-Client (lazy-init, wirft beschreibenden Fehler wenn Key fehlt)
- `middleware.ts` — Route-Schutz: nicht-auth → `/login`, auth auf public routes → `/dashboard`
- `src/app/auth/callback/route.ts` — Supabase Auth Callback (Email-Bestätigung, Passwort-Reset)
- `.env.local.example` — alle drei Env-Vars dokumentiert

**Abweichungen vom Spec:**
- `interview_state` hat keine eigene `workspace_id` Spalte — RLS-Isolation läuft über JOIN auf `interviews` (sauberer, kein denormalisiertes Feld)
- `turns` ebenfalls ohne `workspace_id` — gleicher Grund

**Frontend (via /frontend):**
- `src/app/login/page.tsx` + `actions.ts` — LoginForm (react-hook-form + Zod, Sonner Toast, window.location.href redirect)
- `src/app/signup/page.tsx` + `actions.ts` — SignupForm (Workspace-Name + E-Mail + Passwort, gleiche Pattern)
- `src/app/auth/actions.ts` — logout Server Action (signOut + redirect /login)
- `src/app/dashboard/layout.tsx` — DashboardShell: dunkle Sidebar (#0F0F11, 240px), Workspace-Name aus user_metadata, Logout-Button
- `src/app/dashboard/page.tsx` — Platzhalter für PROJ-2+
- `src/app/layout.tsx` — Root Layout: Inter Font, Sonner Toaster, Metadata "Meridian"
- `src/app/page.tsx` — Leer (Middleware übernimmt Redirect)

## QA Test Results

**Datum:** 2026-05-19
**Tester:** QA Agent (Claude Sonnet 4.6)
**Umgebung:** Chromium / localhost:3000 (npm run dev)

### Acceptance Criteria — Ergebnis

| Kriterium | Status | Anmerkung |
|---|---|---|
| Signup via Supabase Auth | ❌ FAIL | Signup bleibt auf /signup — E-Mail-Bestätigung vermutlich noch aktiviert in Supabase |
| Workspace-Trigger nach Signup | ⚠️ NICHT GETESTET | Signup schlägt fehl |
| workspace_id in user_metadata | ⚠️ NICHT GETESTET | Signup schlägt fehl |
| Login cookie-based via @supabase/ssr | ⚠️ NICHT TESTBAR | Abhängig von Signup |
| Logout → /login | ⚠️ NICHT TESTBAR | Abhängig von Login |
| Passwort-Reset via Supabase | ✅ PASS (out-of-scope UI) | Kein Custom UI — Supabase Standard |
| RLS-Isolation User A / User B | ⚠️ NICHT TESTBAR | Abhängig von Signup |
| Neue Migration ersetzt altes Schema | ✅ PASS (code review) | Migration existiert, SQL korrekt |
| Alle neuen Tabellen vorhanden | ✅ PASS (code review) | 7 Tabellen gemäß Spec |
| pgvector + IVFFlat-Index | ✅ PASS (code review) | Migration enthält Index |
| RLS auf allen Tabellen | ✅ PASS (code review) | Alle 7 Tabellen mit Policies |
| updated_at-Trigger | ✅ PASS (code review) | workspaces + interview_state |
| supabase-server.ts vorhanden | ✅ PASS | Cookie-based SSR client |
| supabase-admin.ts vorhanden | ✅ PASS | Lazy-init, beschreibende Fehlermeldung |
| supabase.ts (Browser) angepasst | ✅ PASS | @supabase/ssr browser client |
| .env.local.example dokumentiert | ✅ PASS | Alle 3 Env-Vars |
| Middleware schützt Routen | ✅ PASS (E2E) | /dashboard → /login ohne Session |
| / → /dashboard (auth) oder /login | ❌ FAIL | Unauthentifizierter Zugriff auf / bleibt auf / |
| /auth/callback vorhanden | ✅ PASS (code review + build) | Route Handler korrekt |
| /login UI | ✅ PASS (E2E) | Form, Button, Link zu /signup |
| /signup UI | ✅ PASS (E2E, partiell) | Form vorhanden, Validierung partiell |
| /dashboard Sidebar + Workspace-Name | ⚠️ NICHT TESTBAR | Abhängig von Signup |
| Loading State | ✅ PASS (code review) | Spinner + disabled Button implementiert |
| Meridian Pink Button | ✅ PASS (E2E) | rgb(224, 64, 251) = #E040FB bestätigt |

### Bugs

#### BUG-001 — CRITICAL: Signup schlägt fehl, User landet nicht auf /dashboard

**Schritte:** /signup öffnen → gültige Daten eingeben → Registrieren klicken → bleibt auf /signup

**Ursache:** `signup/actions.ts` prüft `if (!data.session)` und gibt Fehler zurück. Supabase gibt keine Session zurück wenn E-Mail-Bestätigung aktiviert ist. Spec sagt: E-Mail-Verifizierung für MVP deaktiviert.

**Fix:** Supabase Dashboard → Authentication → Providers → Email → "Confirm email" deaktivieren.

---

#### BUG-002 — MEDIUM: Zod v4 custom error messages bei .email() werden ignoriert

**Schritte:** /signup → ungültige E-Mail eingeben → Submit → kein deutscher Fehlertext sichtbar

**Ursache:** In Zod v4 änderte sich die API für custom messages. `z.string().email('text')` übergibt den String nicht als message, `.min()` funktioniert korrekt. Default-Zod-Fehlertext erscheint statt "Ungültige E-Mail-Adresse".

**Fix (Codeänderung):**
```ts
// Vorher (Zod v3 Syntax, bricht in v4):
email: z.string().email('Ungültige E-Mail-Adresse')

// Nachher (Zod v4):
email: z.string().email({ error: 'Ungültige E-Mail-Adresse' })
```
Gleiches gilt für login/page.tsx.

---

#### BUG-003 — MEDIUM: / (Root) redirectet unauthentifizierte User nicht zu /login

**Schritte:** Browser ohne Session → localhost:3000/ öffnen → URL bleibt /

**Ursache:** `page.tsx` gibt `null` zurück. Next.js behandelt dies als statischen leeren Inhalt — der Middleware-Redirect greift in dieser Konstellation nicht zuverlässig.

**Fix:** Server-seitiger Redirect als Safety-Net in page.tsx:
```tsx
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/login')
}
```
Middleware übernimmt danach den auth-basierten Redirect zu /dashboard.

---

#### BUG-004 — LOW: Fehlertext-Erkennung für doppelte E-Mail ist fragil

**Code:** `signup/actions.ts` Zeile 25: `error.message.toLowerCase().includes('already registered')`

**Ursache:** Supabase könnte interne Fehlertexte ändern → Match schlägt fehl → User sieht generischen Fehlertext statt "Diese E-Mail ist bereits registriert".

**Fix:** Supabase Error-Codes prüfen statt Freitext: `error.code === 'user_already_exists'` oder `error.status === 422`.

### Security Audit

| Prüfpunkt | Ergebnis |
|---|---|
| `getUser()` statt `getSession()` in Middleware | ✅ Korrekt — server-validiert, nicht spoofbar |
| Service-Role-Key nie als NEXT_PUBLIC_ | ✅ Korrekt |
| Lazy-init in supabase-admin.ts | ✅ Korrekt — kein Build-Fehler bei fehlendem Key |
| CSRF-Schutz auf Server Actions | ✅ Next.js App Router bietet eingebauten CSRF-Schutz |
| Input-Injection (XSS) | ✅ React escapet automatisch, keine innerHTML-Nutzung |
| SQL-Injection | ✅ Supabase parametrisierte Queries |
| RLS — cross-workspace Zugriff | ✅ Code Review bestätigt korrekte Policies |
| Tokens in Browser-Console/LocalStorage | ✅ @supabase/ssr nutzt httpOnly Cookies |
| Keine server-seitige Zod-Validierung in Actions | ⚠️ LOW — Supabase fängt ungültige Inputs auf, aber nicht unser Code |

### E2E Test-Ergebnis

**15 Tests definiert | 6 PASS | 2 FAIL | 1 SKIPPED (fixme) | 6 DID NOT RUN (serial-abhängig)**

Bestandene Tests:
- /dashboard → /login (unauthentifiziert) ✅
- Empty workspace validation ✅
- Password < 8 chars validation ✅
- Meridian Pink Button-Farbe ✅
- Login-Link auf /signup ✅
- Signup-Link auf /login ✅

### Produktionsbereitschaft

**❌ NICHT BEREIT** — BUG-001 (CRITICAL) und BUG-002/003 (MEDIUM) müssen behoben werden.

Nach Fixes: `/qa` erneut ausführen.

## Deployment
_To be added by /deploy_
