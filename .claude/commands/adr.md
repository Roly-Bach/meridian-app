---
description: Erstellt einen neuen ADR (Architecture Decision Record) mit nächster Nummer. Immutable nach Status "Accepted".
argument-hint: <kurzer-titel-in-kebab-case>
allowed-tools: Read, Write, Glob, Bash
---

# /adr — ADR-Skeleton-Generator

Du erstellst einen neuen ADR (Architecture Decision Record) im Repo.

Titel aus `$ARGUMENTS`: **$ARGUMENTS**

## Workflow

1. **Nächste Nummer ermitteln:** Liste `docs/adr/` und finde die höchste existierende Nummer (`ADR-NNN-...`). Neue Nummer = höchste + 1, zero-padded auf 3 Stellen.

2. **Filename erstellen:** `docs/adr/ADR-<NNN>-<kebab-titel>.md` wobei `<kebab-titel>` aus `$ARGUMENTS` (klein, Bindestriche statt Leerzeichen, Sonderzeichen entfernt).

3. **Inhalt schreiben** mit folgendem Skeleton (User füllt Details):

```markdown
# ADR-<NNN>: <Titel aus $ARGUMENTS>

**Status:** Proposed (<DATUM YYYY-MM-DD>)
**Author:** <User-Name aus git config>
**Repository:** <Repo-Name aus git remote>

## Context

<Welcher Problem-Druck führt zur Entscheidung? Was ist die Ausgangslage?>

## Decision

<Was wird konkret entschieden?>

## Consequences

**Positiv:**
- ...

**Negativ:**
- ...

**Folgeentscheidungen:**
- ADR-<NNN+1>: ...
```

4. **User informieren:**
- Pfad zum neuen ADR
- Hinweis: Status bleibt "Proposed" bis User explizit auf "Accepted" wechselt
- Bei Accepted: nicht mehr editieren — bei Änderung neuen ADR mit `Supersedes: ADR-<NNN>`

## Konventionen

- ADRs sind nummeriert, datiert, immutable nach Accepted
- Bei Überholung: neuer ADR mit Supersedes-Link, alter ADR bekommt "Superseded by"-Header
- Templates sind in `docs/adr/ADR-001-fork-audit.md` als Referenz
