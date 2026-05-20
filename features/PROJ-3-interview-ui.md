# PROJ-3: Interview UI

## Status: Architected
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — Berater-Session, Dashboard-Layout, Supabase-Client
- Requires: PROJ-2 (Interview Engine Backend) — alle API-Endpunkte, Streaming-Format

## User Stories

- Als Berater sehe ich auf dem Dashboard eine Liste aller Interviews meines Workspaces mit Status, damit ich den Überblick behalte.
- Als Berater lege ich über einen Dialog ein neues Interview an (Name, Rolle, Abteilung, Fokusthemen), damit ich den Link vorbereiten kann.
- Als Berater kopiere ich den generierten Interview-Link direkt nach dem Anlegen oder später aus der Liste, damit ich ihn per E-Mail/Messenger an den Mitarbeiter senden kann.
- Als Mitarbeiter öffne ich den Link ohne Account und sehe sofort eine Chat-Seite, damit ich keine technischen Hürden habe.
- Als Mitarbeiter sende ich Nachrichten und sehe die Agent-Antworten wortweise gestreamt, damit das Gespräch natürlich wirkt.
- Als Mitarbeiter öffne ich den Link nach einem Verbindungsabbruch erneut und setze das Gespräch nahtlos fort, ohne etwas erneut eingeben zu müssen.
- Als Mitarbeiter lande ich auf einem klaren Abschluss-Screen sobald das Interview beendet ist, damit ich weiß, dass ich fertig bin.

## Acceptance Criteria

### Consultant Dashboard (`/dashboard`)

- [ ] Dashboard-Seite zeigt eine Tabelle aller Interviews des Workspaces (sortiert nach `created_at` desc)
- [ ] Tabellenspalten: Mitarbeitername, Rolle, Abteilung, Status-Badge, Erstellt am, Aktionen
- [ ] Status-Badge: `created` (grau), `active` (blau `#3B82F6`), `completed` (grün `#10B981`)
- [ ] Leerer Zustand (keine Interviews): Illustration oder Text mit klarem Call-to-Action "Erstes Interview anlegen"
- [ ] Ladevorgang der Liste: Skeleton-Rows während `GET /api/interviews` läuft
- [ ] "Neues Interview"-Button öffnet einen Dialog

### Interview-Erstellung (Dialog)

- [ ] Dialog enthält vier Felder: `employee_name` (required), `employee_role` (required), `department` (required), `focus_topics` (optional, Textarea)
- [ ] Alle Pflichtfelder haben Client-seitige Validierung — Submit-Button bleibt disabled bis alle Pflichtfelder gefüllt sind
- [ ] Submit schickt `POST /api/interviews`, zeigt Loading-State am Button
- [ ] Bei Erfolg: Dialog wechselt in einen "Link bereit"-Zustand — zeigt den vollständigen Interview-Link mit "Link kopieren"-Button
- [ ] "Link kopieren" schreibt den Link in die Zwischenablage und bestätigt mit Toast oder Button-State-Change ("Kopiert!")
- [ ] Dialog schließbar per X-Button oder Klick außerhalb — nach dem Schließen erscheint das neue Interview oben in der Liste
- [ ] Bei API-Fehler: Fehlermeldung im Dialog, kein Schließen

### Link kopieren (aus der Liste)

- [ ] Jede Tabellenzeile hat in der Aktions-Spalte einen "Link kopieren"-Button
- [ ] Klick schreibt `{origin}/interview/{access_token}` in die Zwischenablage
- [ ] Visuelles Feedback: Button wechselt kurz zu "Kopiert!" (1.5s), dann zurück

### Employee Chat Page (`/interview/[token]`)

- [ ] Route `/interview/[token]` existiert als eigenständige Seite — kein Dashboard-Layout, kein Sidebar
- [ ] Beim Laden: `GET /api/interview/[token]` wird aufgerufen um Interview-Daten und bisherige Turns zu laden
- [ ] Ladevorgang: Fullscreen-Spinner oder Skeleton, kein leerer Flash
- [ ] Bestehende Turns werden im Nachrichtenverlauf angezeigt bevor der Nutzer tippen kann
- [ ] Chat-Layout: Nachrichtenverlauf oben (scrollbar), Eingabebereich unten (fixed)
- [ ] Nutzer-Nachrichten rechts ausgerichtet, Agent-Nachrichten links ausgerichtet
- [ ] Agent-Antworten erscheinen wortweise (SSE-Stream via `fetch()` mit `ReadableStream`)
- [ ] Während der Agent antwortet: Text-Input und Send-Button sind disabled
- [ ] Send-Button ist disabled wenn Input leer ist
- [ ] Enter-Taste sendet die Nachricht (Shift+Enter = Zeilenumbruch)
- [ ] Beim ersten Öffnen eines neuen Interviews (keine Turns) startet der Agent automatisch die Begrüßung (Reconnect-Endpunkt NICHT aufgerufen — nur bei vorhandenen Turns)

### Reconnect-Flow

- [ ] Wenn `GET /api/interview/[token]` Turns zurückgibt und Status `active` ist: `POST /reconnect` wird automatisch aufgerufen
- [ ] Die adaptive Begrüßung des Agenten erscheint gestreamt im Chat — der Nutzer sieht keinen Hinweis oder Button
- [ ] Die Reconnect-Antwort wird nicht als eigener Turn in der Liste angezeigt (da nicht in DB gespeichert) — sie erscheint wie eine reguläre Agent-Nachricht

### Fehlerzustände (Employee Page)

- [ ] Token nicht gefunden (404): Seite zeigt "Dieser Interview-Link ist ungültig." mit Meridian-Branding, kein Chat
- [ ] Token abgelaufen (410): Seite zeigt "Dieser Interview-Link ist nicht mehr gültig." mit Meridian-Branding, kein Chat
- [ ] Interview abgeschlossen — Mitarbeiter öffnet Link erneut: Seite zeigt Abschluss-Screen "Vielen Dank! Das Interview wurde abgeschlossen." mit Meridian-Branding, kein Input-Bereich
- [ ] Streaming-Fehler (`event: error` vom SSE-Stream): Toast-Fehlermeldung, Input wird wieder aktiv — Nutzer kann die Nachricht erneut senden

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Berater öffnet Dashboard ohne Interviews | Leerer Zustand mit CTA "Erstes Interview anlegen" |
| Berater schließt Dialog während POST noch läuft | Loading-State bleibt, Dialog nicht schließbar während Submit aktiv |
| Mitarbeiter doppelklickt Send-Button | Zweiter Klick wird ignoriert (Button disabled während Streaming) |
| Mitarbeiter sendet leere Nachricht (nur Whitespace) | Client-seitige Validierung verhindert Submit |
| SSE-Verbindung bricht während Streaming ab | Toast-Fehler, Input wird wieder aktiv, Agent-Antwort bleibt ggf. unvollständig im Chat |
| Mitarbeiter öffnet Link während Status `created` | Normales Chat-Interface — erster Turn wechselt Status zu `active` (Backend-Logik) |
| Mitarbeiter scrollt während Agent antwortet | Kein Auto-Scroll-Zwang — Nutzer kann frei scrollen; neuer Content scrollt automatisch wenn der Nutzer bereits am Ende ist |
| Clipboard-API nicht verfügbar (kein HTTPS lokal) | Fallback: Link wird in einem `<input>` angezeigt das der Nutzer manuell kopieren kann |

## Technical Requirements

- Streaming: `fetch()` mit `ReadableStream` (kein AI SDK `useCompletion` — `toTextStreamResponse()` liefert plain SSE, kein AI-SDK-Datenformat)
- Auth auf `/dashboard`: Server Component prüft Session, Redirect zu `/login` wenn nicht eingeloggt
- `/interview/[token]`: keine Auth, kein Supabase-Client erforderlich — nur API-Calls
- Komponenten: shadcn/ui `Dialog`, `Table`, `Badge`, `Button`, `Input`, `Textarea`, `Skeleton`, `Sonner` (Toast)
- Design: Meridian Design System (`docs/design-system.md`) — Meridian Pink als Akzent, kein Mobile-Breakpoint
- Performance: Chat-Seite zeigt ersten Streaming-Token < 3s nach Submit (entspricht PROJ-2-Constraint)

## Out of Scope

- Voice-Input / Whisper (→ PROJ-7)
- Delete / Archivieren von Interviews
- Interview-Detail-Seite (Transkript-Ansicht für Berater)
- Read-only Transkript für abgeschlossene Interviews
- Pagination der Interview-Liste (MVP: alle laden)
- Echtzeit-Status-Updates im Dashboard (kein Polling / WebSocket)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

#### Consultant Dashboard (`/dashboard`)

```
/dashboard/page.tsx  (Server Component — Auth bereits im Layout)
  └── InterviewsClient  (Client Component — verwaltet Liste + State)
       ├── InterviewsTable
       │    ├── InterviewRow  (pro Interview)
       │    │    ├── StatusBadge  (created / active / completed)
       │    │    └── CopyLinkButton
       │    └── InterviewsSkeleton  (Ladevorgang)
       ├── EmptyState  (keine Interviews)
       └── NewInterviewDialog
            ├── Schritt 1: Formular (4 Felder)
            └── Schritt 2: Link-Anzeige + Copy-Button
```

Sidebar-Navigation in `dashboard/layout.tsx` erhält einen "Interviews"-Eintrag.

#### Employee Chat Page (`/interview/[token]`)

```
/interview/[token]/page.tsx  (Client Component — kein Auth, kein Sidebar)
  ├── ChatLoadingScreen  (während GET /api/interview/[token] läuft)
  ├── ChatErrorScreen  (404 / 410)
  ├── ChatCompletedScreen  (Interview abgeschlossen)
  └── ChatInterface  (aktives Interview)
       ├── MessageList  (scrollbarer Verlauf)
       │    └── MessageBubble  (user rechts / agent links)
       └── ChatInput
            ├── Textarea  (Shift+Enter = Umbruch, Enter = Senden)
            └── SendButton  (disabled während Streaming oder leer)
```

### Routing

`/interview/[token]` liegt außerhalb von `/dashboard` — erbt nur das Root-Layout (kein Sidebar, kein Auth-Check). Standard-Verhalten des Next.js App Routers bei separaten Route-Segmenten.

### Datenhaltung

Kein neues Datenbankschema — alle Daten kommen aus PROJ-2.

| Was | Wo | Warum |
|---|---|---|
| Interview-Liste | Client-seitiger State (useState) | Kein Echtzeit-Bedarf; nach Mutation neu laden |
| Chat-Verlauf | Client-seitiger State | Flüchtig pro Session; Persistenz in DB via PROJ-2 |
| Streaming-Text | Eigener Hook (useInterviewStream) | Akkumuliert Chunks bis Stream abgeschlossen |
| Interview-Status | Aus `GET /api/interview/[token]` | Bestimmt welcher Screen gezeigt wird |

### Seitenlade-Logik (Chat Page)

```
Seite lädt
  ↓
GET /api/interview/[token]
  ├── 404 → ErrorScreen "Link ungültig"
  ├── 410 → ErrorScreen "Link abgelaufen"
  ├── status = completed → CompletedScreen
  └── status = created / active
       ├── keine Turns → ChatInterface (leere Nachrichtenliste)
       │    Agent begrüßt in seiner ersten Antwort (intro-Phase)
       └── Turns vorhanden + active → POST /reconnect (auto)
            → adaptive Begrüßung streamt in Chat
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Dashboard-Seite | Server Component Shell + Client Component | Auth bleibt auf Server; Interaktivität braucht Client |
| Chat-Seite | Reiner Client Component | Kein Auth, kein SSR-Vorteil — Mitarbeiter hat keine Session |
| Streaming | `fetch()` + `ReadableStream` in eigenem Hook | `toTextStreamResponse()` liefert plain-text-Chunks, kein AI-SDK-Datenformat |
| State | React `useState` | Scope rein lokal pro Seite; kein seitenübergreifender Zustand |
| Neue Backend-Endpunkte | Keine | Alle API-Routen aus PROJ-2 live |
| Neue Packages | Keine | Alle benötigten shadcn/ui-Komponenten bereits installiert |

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/page.tsx` | Ersetzt Placeholder; rendert InterviewsClient |
| `src/app/interview/[token]/page.tsx` | Employee Chat Page |
| `src/components/interviews/` | Dashboard-Komponenten (Client-seitig) |
| `src/components/interview/` | Chat-Komponenten (Client-seitig) |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
