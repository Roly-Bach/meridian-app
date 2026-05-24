# ADR-003: GitHub Actions CI with Branch Protection on `main`

**Status:** Proposed (2026-05-24)
**Author:** Lias Hemmersbach
**Repository:** Roly-Bach/meridian-app
**Supersedes:** Keine
**Related:** ADR-002 (Hybrid-Backend EU)

## Context

Bis heute (2026-05-24) hat das Repo keine automatisierten Quality Gates. `npm test`, `npm run lint`, `npm audit`, `npm run build` werden ausschließlich von der Person/Agent ausgeführt, die gerade committet. Direkter Push nach `main` ist erlaubt, Vercel deployt jeden grünen `main`-Push automatisch in Production.

**Konkreter Druck, der zur Entscheidung führt:**

1. **Beobachtete Lücke heute (PROJ-8 Deploy-Cycle):** `@react-pdf/renderer` war in `package.json` deklariert, aber nicht in `node_modules`. Erkannt nur durch manuelles `npm test` direkt vor dem Commit. Ohne diese Disziplin wäre der Commit mit kaputtem PDF-Endpunkt in Production gelandet. Risiko: jeder Drift zwischen `package.json` und `node_modules` (z.B. nach `git pull`, Branch-Wechsel, vergessenes `npm install`) bleibt unentdeckt, bis ein konkreter Code-Pfad sie trifft.

2. **Zweiter Contributor:** Vercel-Deployment-Historie zeigt Commits von `Bendewar10` (z.B. `feat(PROJ-6): Qualitative use case track`, `feat(PROJ-8): extractions_log feedback loop`). Sobald jemand außer dem Repo-Owner pusht, ist die „Disziplin vor Push" Annahme nicht mehr global durchsetzbar.

3. **Agentic-Engineering-Setup:** Per Memory `project_agentic_engineering_setup.md` ist eine 6-Agent-Pipeline (Architect/Scout/Coder/Reviewer/Verifier/Janitor) geplant. KI-Agents können nach langem Kontext überzeugend behaupten, Tests seien grün, ohne sie tatsächlich gelaufen zu haben. Eine externe Außenseiter-Instanz, die wirklich Tests ausführt und unbestechlich grün/rot meldet, ist das einzige robuste Korrektiv.

4. **`npm audit` Drift-Schutz:** Stand jetzt (Commit `00cd348`) sind wir auf 0 Vulnerabilities. Die Mischung aus direktem Next.js-Bump und transitiven Overrides ist brüchig (siehe PROJ-16 Deliverable 6). Eine periodische `npm audit`-Ausführung außerhalb des Commit-Workflows fängt neu auftretende CVEs ein, bevor sie bei einem Deploy auffallen.

5. **PROJ-15 Lehre:** Die Header-Drop-Bug-Debugging-Schleife verbrannte mehrere Stunden mit Hypothesen-basiertem Debuggen. Ein automatischer Smoke-Test (z.B. `curl /login | grep Content-Security-Policy`) in CI hätte das Regress-Risiko bei künftigen Refactorings reduziert — Header-Verluste in CI-Output sichtbar statt erst in Production verifiziert.

## Decision

**Wir führen GitHub Actions CI ein, mit Branch Protection auf `main`.**

### Pipeline-Architektur

| Trigger | Pipeline | Was läuft | Blockiert Merge? |
|---|---|---|---|
| Push auf `main` | `quality.yml` | `npm ci`, `npm run lint`, `npm test`, `npm audit --audit-level=moderate` | Branch Protection blockt direkten Push falls rot |
| Push auf Feature-Branch | `quality.yml` | dasselbe | Nein direkter Block, aber roter Status sichtbar am PR |
| Opened/synced PR auf `main` | `quality.yml` | dasselbe | Ja (required check via Branch Protection) |
| Nightly Cron (03:00 UTC) | `audit.yml` | `npm ci`, `npm audit` (alle Severities), Report als Issue wenn HIGH/CRITICAL | Nein — informativ, öffnet GitHub-Issue |

### Was NICHT in CI läuft (bewusst)

- **`npm run build`** — Vercel macht den Build sowieso bei jedem Push; doppelte Ausführung ist Verschwendung. Wenn der Build kaputt ist, sieht man's in Vercel.
- **Playwright E2E-Tests** — brauchen lokales Supabase + Dev-Server, derzeit nicht in CI reproduzierbar ohne signifikanten Setup-Aufwand. Wenn dieser Aufwand sich in der Zukunft lohnt, eigene ADR.
- **Vercel-Deployment** — bleibt bei Vercel-GitHub-Integration. CI ist Pre-Merge-Gate, Vercel ist Deploy-Gate.
- **Coverage-Reports** — solange das Repo Solo-2-Personen ist und Coverage stabil über Unit-Tests gehalten wird, ist die Tooling-Investition (Codecov etc.) nicht gerechtfertigt.

### Konkrete Konfiguration

```yaml
# .github/workflows/quality.yml (Skizze, finale Form in chore(ci)-Commit)
name: Quality Gates
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24      # matches local + Vercel runtime
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm audit --audit-level=moderate
```

```yaml
# .github/workflows/audit.yml (Skizze)
name: Nightly Audit
on:
  schedule:
    - cron: '0 3 * * *'        # 03:00 UTC daily
  workflow_dispatch:           # allow manual trigger
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - name: Run audit
        run: npm audit --json > audit.json || true
      - name: Open issue on high findings
        # gh CLI step, creates issue if HIGH/CRITICAL found and no open audit-issue exists
```

### Branch Protection auf `main`

Setting in GitHub Repo → Settings → Branches:
- ✓ Require status checks to pass before merging
- ✓ Required check: `quality / quality`
- ✓ Require branches to be up to date before merging
- ✗ Require pull request reviews (Solo-Dev-Realität — bei mehr Contributors später aktivieren)
- ✗ Restrict who can push to matching branches (Bypass bleibt möglich für Hotfixes — bewusst nicht zu)

### Secrets

Keine sensitiven Secrets in CI nötig — die Pipeline läuft kein E2E gegen Supabase, kein Build gegen API-Keys, kein Deploy. `npm test` nutzt jsdom + Mocks (`vi.mock`), kein echter Netzwerk-/DB-Zugriff. **Wenn** in einer späteren ADR E2E in CI eingeführt werden: separate Secret-Strategie.

### Reaktion auf rote Builds

| Rot bei | Default-Reaktion |
|---|---|
| `npm test` auf PR | Autor fixt vor Merge. Kein Override. |
| `npm test` auf direkter `main`-Push | Sofort-Revert oder Hotfix-Commit. Notfall-Bypass möglich über GitHub Admin („Allow specified actors to bypass required pull requests"). |
| `npm audit` HIGH/CRITICAL (Quality-Pipeline) | PR blockt. Autor entscheidet: Override (Override-Commit dokumentiert _warum_ es OK ist), Upgrade, oder Issue für PROJ-16-artige Folge-Arbeit. |
| Nightly Audit findet neue CVE | Auto-erstelltes Issue. Wird im normalen Backlog priorisiert. |

## Consequences

**Positiv:**

- Lücken wie das `@react-pdf/renderer`-Beispiel werden vor Production erkannt.
- Zweiter Contributor (Bendewar) bekommt automatischen Tripwire ohne Konvention-Pflege.
- KI-Agents haben einen unbestechlichen Gegen-Indikator zu ihrer eigenen „Tests grün"-Behauptung.
- npm-Audit-Drift wird täglich beobachtet, nicht erst vor dem nächsten Deploy.
- Sehr niedriger Setup-Aufwand: ~1h Implementierung, zwei kleine YAML-Files.
- Kostenlos: Repo ist public (per Vercel-Metadata `githubRepoVisibility: public`), GitHub Actions Free-Tier reicht weit.

**Negativ:**

- Zusätzliche ~30-60s Latenz pro Push, bevor Vercel sicher deployt. Akzeptabel — Vercel deployt parallel, die CI-Latenz fügt sich nur in den Merge-Workflow ein, nicht in den Deploy-Pfad.
- Branch Protection erfordert Disziplin: Direct-Push nach `main` wird unbequemer, ist aber bewusster Trade-off.
- Flaky Tests werden unangenehmer — sie sind aktuell unproblematisch (197/197 grün, Vitest deterministisch), aber wenn der zukünftige Eval-Harness (PROJ-17) in CI eingebunden wird, könnte das wackeliger werden. Dann muss flaky-test-handling als eigenes Thema her.
- Nightly Audit erzeugt potenziell Issue-Spam wenn upstream-CVEs in seltenen Deps auftauchen. Mitigations-Strategie: Issue-Template mit „has open audit issue" Check, sodass nicht jeden Tag dasselbe Issue neu geöffnet wird.

**Folgeentscheidungen:**

- **ADR-004 (potenziell):** E2E-Tests in CI — erst sobald Playwright-Specs stabil gegen ein lokales Supabase-Test-DB-Setup laufen können (Supabase Branching oder Docker-Compose-Setup). Aktuell nicht angegangen.
- **ADR-005 (potenziell):** Preview-Deploy-Quality-Gates — wenn das Team auf >2 Contributor wächst und Preview-URLs systematisch getestet werden sollen.
- **PROJ-16 Deliverable 7 (`npm audit` muss 0 zeigen)** wird durch die Quality-Pipeline laufend verifiziert statt nur einmalig.
- **CLAUDE.md** bekommt eine Zeile: „CI runs on every push and PR — keep `npm test` and `npm run lint` green locally before pushing; rotes CI blockt Merge auf main."

## Implementierungsplan

Diese ADR steuert nur die Entscheidung. Die eigentliche Implementation:

1. Einzelner `chore(ci): Add GitHub Actions workflows` Commit mit:
   - `.github/workflows/quality.yml`
   - `.github/workflows/audit.yml`
   - Zeile in `CLAUDE.md`
   - README-Badge (optional)
2. **Manuell in GitHub-UI**: Branch Protection auf `main` einschalten mit `quality / quality` als Required Check.
3. Verifikation: Test-PR (z.B. trivialer Typo-Fix) durchlaufen lassen, sehen ob CI grün läuft und Merge-Block funktioniert.

Kein PROJ-X-Spec, kein /qa, kein Deploy-Bookkeeping — die Arbeit ist klein und einmalig.
