# PROJ-11: Interview PDF Report

## Status: Planned
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

## Out of Scope

- PDF-Speicherung in Supabase Storage
- Versionierung von Reports
- Email-Versand des Reports
- Anpassbares Layout oder Branding pro Workspace
- Export als Excel/DOCX
- Report für Use Cases ohne Interview-Kontext (PROJ-6 standalone)
