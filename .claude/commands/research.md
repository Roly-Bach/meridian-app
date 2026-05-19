---
description: Scout-Agent mit Web-Fokus. Findet Library-Docs, API-Patterns, Best Practices ohne Code-Änderung.
argument-hint: <thema-oder-frage>
allowed-tools: Read, Glob, Grep, WebSearch, WebFetch, Task
---

# /research — Web-Recherche via Scout

Du startest den Scout-Agent (`.claude/agents/scout.md`) für eine fokussierte Recherche.

Thema/Frage aus `$ARGUMENTS`: **$ARGUMENTS**

## Wann nutzen

- Library-Doku-Vergleich (z.B. "Drizzle vs Prisma für unseren Stack")
- API-Pattern-Recherche (z.B. "Wie macht man Streaming mit Vercel AI SDK")
- Versions-Kompatibilität (z.B. "Funktioniert React 19 mit Next.js 16?")
- Best Practices in 2026 (z.B. "Welche Auth-Lib ist heute am etabliertesten?")

## Wann NICHT

- Code-Änderung gewünscht → `/build` oder `/quick`
- Reine Codebase-Suche → Scout direkt ohne `/research` (das ist schneller)

## Workflow

1. Scout-Subagent aufrufen mit `$ARGUMENTS`
2. Scout führt durch:
   - 1-2 Codebase-Greps (falls relevant)
   - 2-3 WebSearch-Queries
   - 2-3 WebFetch zur Tiefe
3. Output: Strukturierter Bericht mit Quellen, Codebase-Referenzen, Empfehlung

## Output-Format

Scout-Bericht wird inline geliefert. Bei größeren Recherchen optional in `docs/research/<YYYY-MM-DD>-<topic>.md` speichern (auf User-Anfrage).

## Wichtig

- Maximum 10 Tool-Calls
- Scout entscheidet nicht — gibt nur Optionen mit Trade-offs
- User entscheidet danach, ob `/build` oder `/quick` oder direkt umsetzen
