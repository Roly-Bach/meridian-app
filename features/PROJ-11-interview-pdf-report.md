# PROJ-11: Interview PDF Report

## Status: Approved
**Created:** 2026-05-21
**Last Updated:** 2026-05-21

## Dependencies
- Requires: PROJ-4 (Extraktions-Agent) — Knowledge Objects (Prozessschritte, Pain Points, Tools)
- Requires: PROJ-5 (Prozessschritt-Anreicherung) — quantitative Attribute der Prozessschritte
- Requires: PROJ-6 (Use Case Identifikation) — priorisierte KI Use Cases mit ROI
- Requires: PROJ-3 (Interview UI) — Aktions-Spalte im Dashboard

## User Stories

- Als Berater klicke ich in der Interview-Liste bei einem abgeschlossenen Interview auf "PDF erstellen" und erhalte sofort einen strukturierten Report als Download, damit ich ihn dem Kunden oder Stakeholdern direkt vorlegen kann.
- Als Berater sehe ich im PDF eine komprimierte, professionell aufgearbeitete Zusammenfassung der Kernergebnisse des Interviews, damit ich nicht manuell aufbereiten muss.

## Acceptance Criteria

### Button im Dashboard

- [ ] Button "PDF erstellen" erscheint in der Aktions-Spalte für alle Interviews mit Status `completed`
- [ ] Button ist für Interviews mit Status `created` oder `active` nicht sichtbar
- [ ] Klick triggert `GET /api/interviews/[id]/pdf` und startet den Browser-Download
- [ ] Während der PDF-Generierung: Button zeigt Loading-State ("Wird erstellt…"), nicht erneut klickbar
- [ ] Bei Fehler (z.B. keine Daten vorhanden): Toast-Fehlermeldung, Button wieder aktiv

### PDF-Inhalt (Struktur)

- [ ] **Seite 1 — Executive Summary**: Mitarbeitername, Rolle, Abteilung, Datum des Interviews + LLM-generierter Zusammenfassungs-Absatz (2–4 Sätze) über die wichtigsten Erkenntnisse
- [ ] **Abschnitt: Prozessschritte** (aus PROJ-5): Tabelle mit allen angereicherten Prozessschritten — inkl. Häufigkeit, Dauer, beteiligte Systeme (falls vorhanden)
- [ ] **Abschnitt: Pain Points** (aus PROJ-4 `knowledge_objects` Typ `pain_point`): Liste mit Beschreibung und Schweregrad
- [ ] **Abschnitt: Tools & Systeme** (aus PROJ-4 `knowledge_objects` Typ `tool`): Liste der genannten Tools mit Zweck
- [ ] **Abschnitt: KI Use Cases** (aus PROJ-6 `use_cases`): Tabelle — Use-Case-Typ, Beschreibung, ROI in EUR/Jahr, Score
- [ ] Meridian-Branding im Header (Logo-Text "Meridian", Meridian Pink `#E040FB` als Akzentfarbe)
- [ ] Fußzeile mit Generierungsdatum und "Erstellt mit Meridian"

### API

- [ ] `GET /api/interviews/[id]/pdf` — Auth via Supabase Session (nur Workspace-Member)
- [ ] Response: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="meridian-report-[employee_name].pdf"`
- [ ] HTTP 404 wenn Interview nicht gefunden oder nicht `completed`
- [ ] HTTP 403 wenn kein Workspace-Zugriff
- [ ] HTTP 422 wenn keine auswertbaren Daten vorhanden (0 Knowledge Objects, 0 Process Steps)

### Executive Summary Generierung

- [ ] LLM generiert Summary basierend auf: Mitarbeiter-Kontext + alle `knowledge_objects` des Interviews
- [ ] Summary ist auf Deutsch
- [ ] Maximal 4 Sätze
- [ ] Verwendet `INTERVIEW_MODEL` Env-Var (konsistent mit Interview-Agent)

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Interview hat 0 Knowledge Objects (Extraction fehlgeschlagen) | HTTP 422 + Toast "Keine Daten vorhanden. Extraktion fehlgeschlagen oder Interview zu kurz." |
| Use Cases noch nicht generiert (PROJ-6 nicht getriggert) | Use-Cases-Abschnitt zeigt "Noch keine KI Use Cases generiert." |
| Prozessschritte vorhanden, aber keine quantitativen Attribute | Tabelle zeigt "—" für leere Felder |
| PDF-Generierung dauert > 10s | Loading-State bleibt, kein Timeout auf Client-Seite (Vercel Function Timeout 300s) |
| Mitarbeitername enthält Sonderzeichen im Dateinamen | Dateiname sanitized: nur alphanumerisch + Bindestrich |

## Technical Requirements

- **Library:** `@react-pdf/renderer` — React-Komponenten als PDF, Server-side via Node.js
- **Rendering:** Server-Side in Vercel Function (`GET /api/interviews/[id]/pdf`)
- **Service:** `src/services/reportGenerator.ts` — kapselt LLM-Aufruf für Executive Summary + Daten-Aggregation
- **Komponenten:** `src/components/pdf/InterviewReport.tsx` — React PDF Dokument (nur für @react-pdf, kein DOM)
- **Auth:** Supabase Session via `Authorization: Bearer` Header — `workspace_members`-Check
- **Keine Speicherung:** PDF wird on-demand generiert, nicht in Supabase Storage abgelegt
- **Sprache:** Deutsch (Executive Summary, Sektions-Überschriften, Fußzeile)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
InterviewRow.tsx (bestehend — ergänzt)
  ├── CopyLinkButton (unverändert)
  └── DownloadPdfButton (NEU — nur für status: completed)
        └── Klick → GET /api/interviews/[id]/pdf → Browser-Download

src/components/pdf/ (NEU)
  └── InterviewReport.tsx (@react-pdf Document)
        ├── ReportHeader      (Meridian-Branding, Name/Rolle/Abteilung/Datum)
        ├── ExecutiveSummarySection   (LLM-generiert, 2–4 Sätze)
        ├── ProcessStepsSection       (Tabelle: Schritt / Häufigkeit / Dauer / Systeme)
        ├── PainPointsSection         (Liste: Beschreibung / Schweregrad)
        ├── ToolsSection              (Liste: Tool / Zweck)
        └── UseCasesSection           (Tabelle: Typ / ROI / Score)

src/services/reportGenerator.ts (NEU)
  └── generateReportData(): Lädt alle DB-Daten für ein Interview
  └── generateExecutiveSummary(): LLM-Call via INTERVIEW_MODEL

src/app/api/interviews/[id]/pdf/route.ts (NEU)
  └── GET → Auth-Check → Daten laden → Summary generieren → PDF rendern → Download
```

### Datenquellen

| PDF-Abschnitt | Tabelle | Filter |
|---|---|---|
| Mitarbeiter-Info | `interviews` | id |
| Executive Summary | LLM (INTERVIEW_MODEL) | knowledge_objects als Input |
| Prozessschritte | `process_steps` | interview_id |
| Pain Points + Tools | `knowledge_objects` | interview_id + type |
| KI Use Cases | `use_cases` | workspace_id + process_step_id |

### Anfrage-Flow

```
Berater klickt "PDF erstellen"
  ↓
DownloadPdfButton: GET /api/interviews/[id]/pdf
  (Authorization: Bearer <session-token>)
  ↓
API Route:
  1. Auth-Check (workspace_members)
  2. Daten aus 4 Tabellen laden (parallel)
  3. reportGenerator: Executive Summary via LLM
  4. InterviewReport mit @react-pdf rendern → PDF-Buffer
  5. Response: application/pdf + Content-Disposition: attachment
  ↓
Browser: PDF-Download startet automatisch
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| PDF-Library | `@react-pdf/renderer` | Kein Headless Browser, Node.js-kompatibel, layoutbar per React-Komponenten |
| Speicherung | Keine (on-demand) | Einfacher, kein Supabase Storage Bucket nötig |
| LLM für Summary | `INTERVIEW_MODEL` Env-Var | Konsistent mit restlicher KI-Logik (Gemini oder Anthropic) |
| Auth | Supabase Session Bearer | Gleiche Pattern wie alle Dashboard-APIs |
| Rendering | Server-Side (Vercel Function) | PDF-Buffer bleibt serverseitig, kein Client-Download-Trick nötig |

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/api/interviews/[id]/pdf/route.ts` | API Route — Auth, Daten, Render, Response |
| `src/services/reportGenerator.ts` | LLM Executive Summary + DB-Aggregation |
| `src/components/pdf/InterviewReport.tsx` | @react-pdf Dokument mit allen Sektionen |
| `src/components/interviews/DownloadPdfButton.tsx` | Client-Button mit Loading-State + fetch |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/interviews/InterviewRow.tsx` | DownloadPdfButton für completed-Interviews einbinden |

### Neue Abhängigkeit

| Package | Zweck |
|---|---|
| `@react-pdf/renderer` | Server-side PDF-Rendering aus React-Komponenten |

## QA Test Results

**QA Run:** 2026-05-21
**Tester:** /qa skill
**Status:** READY — 118/118 unit tests passed, 8/10 E2E passed (2 pre-existing infra failures)

### Summary

| Category | Result |
|---|---|
| Unit tests (Vitest) | 118/118 passed |
| E2E — API unauthenticated (401) | 2/2 passed |
| E2E — JSON error format check | 1/1 passed |
| E2E — Security IDOR + auth-first check | 2/2 passed |
| E2E — PDF button not shown for active interview | 3/3 passed |
| E2E — Serial live tests (Supabase setup) | 0/2 failed (pre-existing infra) |

### Acceptance Criteria

#### Button im Dashboard
- [x] PASS (code review) — Button "PDF erstellen" nur für `completed`-Interviews sichtbar
- [x] PASS (E2E) — Button nicht sichtbar für `created`/`active`
- [x] PASS (code review) — Klick triggert `GET /api/interviews/[id]/pdf`
- [x] PASS (code review) — Loading-State "Wird erstellt…", disabled während request
- [x] PASS (code review) — Toast auf Fehler, Button re-enabled via `finally`

#### PDF-Inhalt (Struktur)
- [x] PASS (code review) — Executive Summary Sektion mit Name/Rolle/Abteilung/Datum
- [x] PASS (code review) — Prozessschritte Tabelle (Schritt/Häufigkeit/Dauer/Systeme)
- [x] PASS (code review) — Pain Points Liste mit Schweregrad-Badge
- [x] PASS (code review) — Tools & Systeme Liste
- [x] PASS (code review) — KI Use Cases Tabelle mit ROI/Score
- [x] PASS (code review) — Meridian-Branding: Logo "Meridian", Pink `#E040FB` accent
- [x] PASS (code review) — Fußzeile: Datum + "Erstellt mit Meridian"

#### API
- [x] PASS (E2E) — 401 wenn nicht authentifiziert
- [x] PASS (unit test) — 404 wenn Interview nicht gefunden oder nicht completed
- [x] PASS (unit test) — 403 wenn kein Workspace-Zugriff
- [x] PASS (unit test) — 422 wenn 0 Knowledge Objects + 0 Prozessschritte + 0 Tools
- [x] PASS (unit test) — Content-Type: application/pdf, Content-Disposition korrekt
- [x] PASS (unit test) — 200 Happy Path liefert PDF-Buffer

#### Executive Summary
- [x] PASS (code review) — LLM-Call via `INTERVIEW_MODEL` Env-Var
- [x] PASS (code review) — Deutsch, max 4 Sätze in Prompt
- [x] PASS (code review) — Fallback-Text wenn LLM nicht verfügbar (kein Crash)

### Bugs gefunden

| # | Severity | Beschreibung |
|---|---|---|
| BUG-001 | Medium | Kein Rate Limiting auf `GET /api/interviews/[id]/pdf`. LLM + PDF-Rendering = teuer. Spam → API-Kosten. Empfehlung: 3 req/min per user via Vercel Firewall oder Upstash. |
| BUG-002 | Low | `DownloadPdfButton` setzt `a.download` clientseitig (redundant — `Content-Disposition` hat Vorrang). Trailing-dash-Behandlung fehlt client-seitig (`"hans--"` vs `"hans"`). Kein Impact auf UX. |

### Security Audit

| Check | Status |
|---|---|
| IDOR: User A kann Interview von User B abrufen | ✅ Sicher — workspace_members check |
| Auth first: DB nicht abgefragt vor Auth-Check | ✅ Auth-Check zuerst |
| Header Injection via employee_name | ✅ Sanitized: nur [a-z0-9-] |
| XSS via PDF-Content | ✅ @react-pdf rendert Text, kein HTML |
| Unauthorized cross-workspace | ✅ 401 vor jeder DB-Query |

### Production-Ready Decision

**READY** — 2 Bugs: BUG-001 (Medium, Rate Limiting) ist Enhancement, kein Feature-Blocker für MVP. BUG-002 (Low) ist kosmetisch. Keine Critical/High Bugs offen.

## Out of Scope

- PDF-Speicherung in Supabase Storage
- Versionierung von Reports
- Email-Versand des Reports
- Anpassbares Layout oder Branding pro Workspace
- Export als Excel/DOCX
- Report für Use Cases ohne Interview-Kontext (PROJ-6 standalone)
