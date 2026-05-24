---
description: Liest Post-Mortems der letzten N deployten Features, synthetisiert Muster, schlägt Änderungen an .claude/rules/ vor. User genehmigt einzeln.
argument-hint: <optional: N (Anzahl Features, default: alle seit letztem /retro)>
allowed-tools: Read, Edit, Glob, Grep, Bash, AskUserQuestion
---

# /retro — Post-Mortem Synthesis

Du liest die Post-Mortems deployter Features, erkennst Muster und leitest daraus konkrete Regelvorschläge ab.

## Schritt 1: Scope bestimmen

Lies `features/INDEX.md`. Filtere alle Features mit Status=Deployed.

Finde den letzten /retro-Lauf:
```bash
git log --oneline --grep="retro" -5
```

Default: alle Deployed-Features seit dem letzten /retro-Commit. Wenn kein /retro-Commit existiert: alle Deployed-Features.

Wenn `$ARGUMENTS` eine Zahl N enthält: die letzten N Deployed-Features (sortiert nach Deployment-Datum aus der Spec).

## Schritt 2: Post-Mortems lesen

Lies jede relevante Feature-Spec. Suche die `## Post-Mortem`-Sektion.

**Überspringe** Post-Mortems, bei denen alle Felder `—` sind UND ein Hinweis "ohne Backfill, vor v2-Migration deployed" steht — das sind Backfill-Skelette ohne Daten.

Wenn nach dem Filtern keine Post-Mortem-Daten übrig bleiben:
> "Noch keine Post-Mortem-Daten verfügbar. Post-Mortems werden nach jedem Deploy durch `/deploy` ausgefüllt."
→ Stop.

Sammle pro Feature:
- `Spec-Genauigkeit` (High / Medium / Low)
- `Appetite vs. tatsächlich` (geschätzt / tatsächlich)
- `Größte Überraschung`
- `Vorgeschlagene Regeländerung`
- `Build-Loop-Iterationen`
- `Häufigste Fehlerkategorie im Loop`

## Schritt 3: Muster synthetisieren

Analysiere die gesammelten Daten auf wiederkehrende Muster:

**Outcome-Muster:**
- Spec-Genauigkeit: Wie viele Low/Medium? Deutet auf systematische Spec-Lücken hin?
- Appetite-Kalibrierung: Wird konsistent über- oder unterschätzt?
- Überraschungen: Gibt es ähnliche Themen (z.B. immer Auth, immer Supabase-Edge-Cases)?

**Trajectory-Muster:**
- Build-Loop-Iterationen: Liegt der Durchschnitt deutlich über 5? Was treibt das?
- Fehlerkategorie: Dominiert eine Kategorie (TypeScript / Test / Tool-Call / Spec-Lücke)?

**Vorgeschlagene Regeländerungen aus den Post-Mortems:**
- Liste alle eingetragenen Vorschläge auf, gruppiert nach Thema.

## Schritt 4: Report ausgeben

Gib einen strukturierten Report aus:

```
## /retro Report — YYYY-MM-DD

### Analysierte Features
- PROJ-X: [Name] (Deployed YYYY-MM-DD)
- ...

### Outcome-Muster
[Befunde zu Spec-Genauigkeit, Appetite, Überraschungen]

### Trajectory-Muster
[Befunde zu Build-Loop-Iterationen, Fehlerkategorien]

### Regelvorschläge
[Nummerierte Liste. Jeder Vorschlag mit Quelle (PROJ-X) und konkreter Änderung.]
```

Wenn keine Muster erkennbar (zu wenige Daten): explizit sagen "Zu wenige Datenpunkte für statistisch belastbare Muster."

## Schritt 5: Regelvorschläge einzeln genehmigen

Für jeden Regelvorschlag: `AskUserQuestion` stellen.

Optionen pro Vorschlag:
- Annehmen → Regel in `.claude/rules/general.md` oder relevante Skill-Datei schreiben (mit Rule-Provenance-Kommentar: `<!-- source: PROJ-X (YYYY-MM-DD) — [Begründung] -->`)
- Ablehnen → überspringen, kein Eintrag
- Später → überspringen, kein Eintrag

Schreibe nur Regeln, für die der User explizit "Annehmen" gewählt hat.

## Schritt 6: Abschluss-Commit

```bash
git commit -m "docs(retro): /retro run YYYY-MM-DD — N features, M rules adopted"
```

Dieser Commit ist der Anker für den nächsten /retro-Lauf (Schritt 1).

## Wichtig

- Schlage keine Regeln vor, die bereits in `general.md` oder Skill-Dateien stehen.
- Formuliere Vorschläge konkret und umsetzbar — kein "wir sollten öfter...".
- Leere Post-Mortems (Backfill-Skelette) verfälschen Durchschnittswerte — konsequent überspringen.
- `/retro` ändert keine Specs, keinen Code, keine INDEX.md — nur `.claude/rules/`.
