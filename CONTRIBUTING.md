# Contributing — meridian-app

Wie wir gemeinsam an Meridian arbeiten. Verbindlich für alle Founders und späteren Contributors.

## Grundprinzipien

1. **Wer Code schreibt, prüft ihn nicht selbst.** Reviewer-Subagent (Multi-Vendor via Aider+Gemini) ist Pflicht für nicht-triviale Änderungen.
2. **Architektur-Entscheidungen werden als ADR dokumentiert** unter `docs/adr/`. Immutable nach Status "Accepted".
3. **main ist immer deploybar.** Keine direkten Pushes, alles über PRs mit grünem CI und 1 Approval.
4. **DSGVO und EU-Datenresidenz** sind nicht verhandelbar (siehe ADR-002).

## Branch-Strategie

- `main` — produktionsfähig, geschützt, nur via PR mergebar
- `feature/<topic>` — neue Funktionen (z.B. `feature/interview-engine`)
- `fix/<topic>` — Bugfixes
- `chore/<topic>` — Dependencies, Refactoring, Doku-Änderungen
- `docs/<topic>` — reine Dokumentations-Änderungen

Branch-Namen klein, Bindestriche statt Unterstriche, kurz und beschreibend.

## Pull-Request-Workflow

1. Branch von aktuellem `main` erstellen
2. Änderungen lokal entwickeln und committen
3. Lokal `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` durchlaufen
4. Auf eigenen Branch pushen
5. PR via `gh pr create` oder GitHub-UI erstellen
6. Mindestens 1 Review vom anderen Founder anfordern
7. CI muss grün sein (sobald GitHub Actions eingerichtet)
8. Squash-Merge auf main (Default)

### PR-Body-Template

```markdown
## Was

Kurze Beschreibung der Änderung in 1-2 Sätzen.

## Warum

Welches Problem wird gelöst, welcher User-Wert entsteht.

## Test-Plan

- [ ] Lokal `npm run build` grün
- [ ] Lokal `npm run typecheck` grün
- [ ] Lokal `npm run test` grün
- [ ] Manuelle Browser-Verifikation auf `localhost:3000`
- [ ] Wenn Migration: SQL in Supabase Studio getestet

## Referenzen

- ADR: <falls relevant>
- Memory/Spec: <falls relevant>
```

## Commit-Konventionen

[Conventional Commits](https://www.conventionalcommits.org/) als Standard:

```
feat: <neue Funktion>
fix: <Bugfix>
docs: <Dokumentation>
refactor: <Refactoring ohne Funktionsänderung>
chore: <Dependencies, Build, Tooling>
test: <Tests>
perf: <Performance-Optimierung>
```

Mit optionalem Scope:

```
feat(interview-engine): add audio upload
fix(auth): handle expired session token
docs(adr): add ADR-003 auth pattern
```

Commit-Message-Body optional, aber empfohlen für nicht-triviale Änderungen. Begründung in `Why:`-Zeile.

## Agent-Pipeline-Nutzung

| Aufgaben-Typ | Slash-Command | Wann |
|---|---|---|
| Typo, Rename, < 5 LOC | direkt im Hauptkontext | trivial |
| 1 Datei, klare Spec | `/quick` | bekanntes Pattern |
| Mehrere Files, Spec da | `/build` | mittleres Feature |
| Unklare Spec, neue Architektur | `/build` | großes Feature |
| Web-Recherche, Library-Vergleich | `/research` | vor Architektur-Entscheidung |
| Aufräumen | `/cleanup` | monatlich oder bei Bedarf |
| Neue Architektur-Entscheidung | `/adr <titel>` | dokumentieren |

## ADR-Pflicht

Eine Entscheidung wird zum ADR wenn:
- Sie betrifft mehr als 3 Files
- Sie führt eine neue Library oder externen Service ein
- Sie kann später nur mit signifikantem Aufwand revidiert werden
- Sie ist datenschutz- oder sicherheits-relevant

ADRs werden nicht editiert nach Status "Accepted". Bei Überholung: neuer ADR mit `Supersedes: ADR-NNN`, alter ADR bekommt Header-Update `Superseded by: ADR-NNN`.

Generieren via Slash-Command: `/adr <kebab-titel>`.

## Code-Style

Verbindliche Regeln in `.claude/rules/`:
- `general.md` — Projektweite Konventionen ("Always read, never guess")
- `frontend.md` — React, Next.js, Tailwind, shadcn/ui
- `backend.md` — Supabase, RLS, Zod-Validation
- `security.md` — Security-Audit-Kriterien

Tooling-Standards:
- TypeScript strict, keine `any` ohne Begründungs-Kommentar
- Tailwind CSS only (keine inline styles, keine CSS-Module)
- shadcn/ui zuerst prüfen vor Custom-Komponenten
- Zod für alle API-Inputs

## Datenschutz

- Niemals API-Keys, Secrets, Customer-Data oder Interview-Inhalte committen
- `.env.local` ist gitignored und bleibt das so
- Audio-Aufnahmen und Transkripte: nur in Supabase Storage EU
- Mitarbeiter-Daten ohne dokumentierte Einwilligung niemals verarbeiten
- AVV-Status pro Anbieter pflegen (siehe ADR-002)

## Reviewer-Subagent (Multi-Vendor-Diversität)

Der Reviewer nutzt Gemini 2.5 Flash via Aider, nicht das gleiche Anthropic-Modell wie der Coder. Begründung: Andere Trainings-Verteilung, andere blinde Flecken. Diese Diversität wird beibehalten.

Bei größeren Diffs (> 500 LOC) optional Upgrade auf `gemini-2.5-pro` mit aktiviertem Paid-Tier.

## Wann eskalieren

Eine Eskalation an den anderen Founder ist angemessen bei:
- ADR-Vorschlag mit grundsätzlicher Architektur-Änderung
- Security-Issue (sofort, nicht warten)
- Performance-Regression > 30%
- Failed Deploy auf main
- Unklare Spec wo Pipeline 3x in Architect zurückspringt (siehe Loop-Mechanik)

## Verwandte Dokumente

- [ONBOARDING.md](./ONBOARDING.md) — Setup für neue Contributors
- [README.md](./README.md) — Projekt-Übersicht
- [docs/adr/](./docs/adr/) — alle Architecture Decision Records
- [.claude/rules/](./.claude/rules/) — verbindliche Code-Regeln
- [CLAUDE.md](./CLAUDE.md) — Claude-Code-spezifische Anweisungen
