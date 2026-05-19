---
description: Schlanke Pipeline (Coder → Reviewer mit max 2 Retry). Für kleine Aufgaben mit klarer Spec. Kein Verifier, kein Architect.
argument-hint: <task-beschreibung>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /quick — Schlanke Coder-Reviewer-Pipeline

Du orchestrierst eine schnelle Coder→Reviewer-Sequenz für: **$ARGUMENTS**

## Wann nutzen

- 1 Datei, klare Spec (z.B. "Füge eine Empty-State-Komponente zu MAList hinzu")
- Bekanntes Pattern, kein Architektur-Design nötig
- Kein Build/Test-Risiko (z.B. UI-Komponente ohne State-Logik)

## Wann NICHT

- Spec unklar → `/build`
- Mehrere Files → `/build`
- Neue API/DB-Schema → `/build`
- Trivial (< 5 LOC) → direkt

## Workflow

### Schritt 1: Coder (Implementation)
Nutze Coder-Subagent (`.claude/agents/coder.md`) mit der Task-Beschreibung als Input.

Wenn Coder-Verdict = `escalate` (Spec unklar): stoppe und frage User. Eskaliere NICHT zu Architect — `/quick` hat keinen Architect.

### Schritt 2: Reviewer Loop (max 2 Iterationen, weniger als bei /build)

```
loop = 0
while loop < 2:
    Reviewer-Subagent aufrufen
    if verdict == "pass": break
    if verdict == "escalate": stoppe, frage User
    if verdict == "retry":
        Coder mit Reviewer-Issues
        loop += 1
if loop == 2: stoppe, vorschlage /build
```

### Schritt 3: User-Handoff
Reporte:
- Geänderte Files
- Loop-Count
- Vorschlag: Direkt committen oder weiter manuell

## Was NICHT in /quick

- Kein Verifier-Pass (kein automatischer Build/Test-Lauf) — User entscheidet ob das vor Commit nötig ist
- Kein Architect (deshalb nicht für unklare Specs)
- Keine Eskalations-Loop nach Architect
