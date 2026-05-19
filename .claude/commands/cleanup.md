---
description: Janitor-Agent ausführen. Findet veraltete Memories, widersprüchliche Docs, stale TODOs, ungenutzte Files. Schlägt Vorschläge vor, ändert nichts ohne Confirm.
argument-hint: <optional: scope (memory|docs|todos|files|all)>
allowed-tools: Read, Edit, Glob, Grep, Bash, Task
---

# /cleanup — Janitor-Aufräumlauf

Du startest den Janitor-Agent (`.claude/agents/janitor.md`) für periodisches Aufräumen.

Scope (aus `$ARGUMENTS`, default `all`):
- `memory` — nur Memory-Verzeichnis auf veraltete Einträge prüfen
- `docs` — Doc-Konsistenz und Widersprüche
- `todos` — Stale TODOs in Source-Code
- `files` — Ungenutzte Files identifizieren
- `all` — alle vier Checks

## Workflow

1. Janitor-Subagent aufrufen mit Scope
2. Janitor liefert Markdown-Report mit Vorschlägen pro Kategorie
3. User reviewt jeden Vorschlag und gibt Freigabe
4. Bei Freigabe: Janitor führt aus (Memory löschen, Doc-Markierung "Superseded by", File löschen)

## Output-Datei

Janitor speichert den Report unter:
`docs/janitor-reports/<YYYY-MM-DD>.md`

Wenn das Verzeichnis nicht existiert: anlegen.

## Wichtig

- Janitor ändert **nichts** ohne explizite User-Bestätigung pro Item
- Default-Verhalten: conservative (im Zweifel flaggen statt vorschlagen)
- Cross-Vendor-Check via Aider (Gemini 3.1 Flash Lite) wird automatisch genutzt wenn `GEMINI_API_KEY` gesetzt ist
