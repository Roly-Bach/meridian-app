---
description: Volle Agent-Pipeline mit Loop-Mechanik (Architect → Scout → Coder ↔ Reviewer ↔ Verifier). Für mittlere und große Features oder unklare Spec.
argument-hint: <feature-name oder task-beschreibung>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# /build — Volle Agent-Pipeline

Du orchestrierst die volle 5-Rollen-Pipeline für das aktuelle Feature. Aufgabe: **$ARGUMENTS**

## Workflow

### Schritt 1: Architect (Plan erstellen)
Nutze den Architect-Subagent (`.claude/agents/architect.md`) um einen Implementierungsplan zu erstellen.

- Input: Briefing aus `$ARGUMENTS`, ggf. `docs/PRD.md`, `features/INDEX.md`
- Output: Strukturierter Plan mit Files, Sequence, Trade-offs

Wenn Architect Klärungsfragen hat: stoppe und frage User.

### Schritt 2: Scout (falls vom Architect angefordert)
Wenn der Architect-Plan offene Recherche-Fragen hat, nutze den Scout-Subagent (`.claude/agents/scout.md`).

- Input: Recherche-Fragen aus Architect-Plan
- Output: Codebase- und Web-Findings

Architect aktualisiert ggf. den Plan basierend auf Scout-Output.

### Schritt 3: Coder (Implementation)
Nutze den Coder-Subagent (`.claude/agents/coder.md`) für die Implementation.

- Input: Architect-Plan + Scout-Findings
- Output: Geänderte Files + Verdict (pass | escalate)

Wenn Coder-Verdict = `escalate`: zurück zu Architect (max 1 Eskalation).

### Schritt 4: Reviewer Loop (max 3 Iterationen)

```
loop_review = 0
while loop_review < 3:
    Reviewer-Subagent aufrufen (.claude/agents/reviewer.md)
    if verdict == "pass": break
    if verdict == "escalate": jump to Architect (Plan-Problem)
    if verdict == "retry":
        Coder-Subagent erneut aufrufen mit Reviewer-Issues
        loop_review += 1
if loop_review == 3: jump to Architect (Plan-Problem)
```

### Schritt 5: Verifier Loop (max 2 Iterationen)

```
loop_build = 0
while loop_build < 2:
    Verifier-Subagent aufrufen (.claude/agents/verifier.md)
    if verdict == "pass": break
    if verdict == "escalate": jump to Architect
    if verdict == "retry":
        Coder-Subagent mit Verifier-Fehlern aufrufen
        loop_build += 1
if loop_build == 2: jump to Architect
```

### Schritt 6: User-Handoff
Reporte an User:
- Geänderte Files
- Loop-Counts pro Phase
- Branch-Name
- Vorschlag: Commit-Message und PR-Erstellung

## Eskalations-Regel

Wenn die Pipeline 3x in Architect zurückspringt: stoppe und übergib an User mit klarer Problembeschreibung. Vermutlich ist die ursprüngliche Spec unklar oder die Architektur muss grundlegend überdacht werden.

## Verdict-Schema

Jeder Subagent gibt strukturiert zurück:
```yaml
verdict: pass | retry | escalate
loop_count: <integer>
reason: <kurze Begründung>
```

## Wann NICHT `/build` nutzen

- Trivial (< 5 LOC, klares Rename, Typo) → direkt im Hauptkontext
- Klein (1 Datei, klare Spec) → besser `/quick`
- Reine Recherche → besser `/research`
- Aufräumen → besser `/cleanup`
