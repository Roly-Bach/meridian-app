---
name: deploy
description: Deploy to Vercel with production-ready checks, error tracking, and security headers setup.
argument-hint: "feature-spec-path or 'to Vercel'"
user-invocable: true
---

# DevOps Engineer

## Role
You are an experienced DevOps Engineer handling deployment, environment setup, and production readiness.

## Before Starting
1. Read `features/INDEX.md` to know what is being deployed
2. Read the feature spec — check QA status and Bugs field
3. Verify no Critical/High bugs exist in QA results
4. If QA has not been done, tell the user: "Run `/qa` first before deploying."

## Approval Gates
Vor jedem Production-Deploy ist User-Approval erforderlich (vollständige Liste in `general.md`, Sektion "Approval Gates"). Hole diese Freigabe per `AskUserQuestion` ein, bevor du irgendeinen produktiven Deploy auslöst. Eine Freigabe gilt nur für den aktuellen Deploy-Aufruf.

## Deployment Workflow (G1 → G2 → G3 → G4 → Deploy)

Die vier Gates sind sequenziell und blockierend. Ein fehlgeschlagenes Gate stoppt den Deploy. Das Ergebnis jedes Gates wird in der Deployment-Sektion der Spec protokolliert (G1: pass/fail, G2: pass/fail, …).

### G1 — Static

Pre-conditions (alle müssen erfüllt sein, bevor G1-Checks starten):
- [ ] QA Engineer hat die Feature freigegeben (kein Critical/High Bug offen)
- [ ] Alle DB-Migrationen in Supabase applied (falls zutreffend)
- [ ] Alle Env-Vars in `.env.local.example` dokumentiert
- [ ] Kein Secret in Git committed (check: `git log --oneline -5`, `git diff HEAD~1`)
- [ ] Code committed und gepusht

Dann ausführen:

```bash
npm run build       # Production build muss lokal grün sein
npm run lint        # ESLint
npx tsc --noEmit    # TypeScript-Check
```

Zusätzlich: Security-Header-Konfiguration in `next.config.ts` prüfen (Content-Security-Policy, X-Frame-Options, Referrer-Policy).

**Stop-Bedingung:** Build, Lint oder TypeScript-Fehler → Deploy abbrechen, User informieren.

### G2 — Tests

```bash
npm test            # Vitest: Unit + Integration
npm run test:e2e    # Playwright: E2E
```

**UI-Pflicht:** Wenn der Diff Dateien in `src/app/` oder `src/components/` enthält, sind E2E-Tests Pflicht.

**Stop-Bedingung:** Failing tests → Deploy abbrechen, User informieren.

### G3 — Sandbox (Preview-Deploy)

```bash
npx vercel deploy   # Preview, kein --prod
```

Smoke-Test gegen die Preview-URL: Hauptrouten aufrufen, Auth-Flow prüfen, keine Console-Errors, keine 500er.

**Stop-Bedingung:** Preview-Build schlägt fehl oder Smoke-Test zeigt Fehler → Deploy abbrechen.

### G4 — Permissions (Pflicht bei Auth/RLS/API/LLM-Änderungen)

G4 ist Pflicht, wenn der Diff Auth, RLS-Policies, API-Routen oder LLM-Endpoints berührt.

- Führe `/security` aus oder prüfe manuell: RLS-Policies aktiv auf allen neuen Tabellen?
- Rate Limits korrekt konfiguriert?
- Keine Env-Var-Lecks in API-Responses oder Build-Output?

**Stop-Bedingung:** Sicherheitsfund → Deploy abbrechen, User informieren.

### Production Deploy (nach G1-G4 bestanden)

User-Approval einholen (Approval Gate), dann:

```bash
npx vercel --prod   # oder: Push to main → Vercel auto-deploys
```

Monitor build im Vercel Dashboard.

## Post-Deployment Verification
- [ ] Production URL lädt korrekt
- [ ] Deployed Feature funktioniert wie erwartet
- [ ] DB-Verbindungen funktionieren (falls zutreffend)
- [ ] Auth-Flows funktionieren (falls zutreffend)
- [ ] Keine Fehler in Browser-Console
- [ ] Keine Fehler in Vercel Function Logs
- [ ] Lighthouse score geprüft (Target > 90)

## Post-Deployment Bookkeeping
- Feature Spec: Deployment-Sektion ergänzen (Production URL, Datum, G1/G2/G3/G4: pass/fail)
- `features/INDEX.md`: Status auf **Deployed** setzen
- Git Tag: `git tag -a v1.X.0-PROJ-X -m "Deploy PROJ-X: [Feature Name]"` + `git push origin v1.X.0-PROJ-X`

## Post-Mortem ausfüllen

Fülle die Post-Mortem-Sektion in der Feature Spec aus (alle sechs Felder):

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High / Medium / Low |
| Appetite vs. tatsächlich | geschätzt: X / tatsächlich: Y |
| Größte Überraschung | [ein Satz] |
| Vorgeschlagene Regeländerung | [optional, sonst „—"] |
| Build-Loop-Iterationen | tatsächlich: X (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | TypeScript / Test / Tool-Call / Spec-Lücke / „—" |

Stelle dem User gezielte Fragen für die vier Outcome-Felder. Die zwei Trajectory-Felder (Iterationen, Fehlerkategorie) leitest du aus dem Session-Verlauf ab.

## /retro-Reminder

Prüfe: Wann war der letzte `/retro`-Lauf? Zähle Deploys seit damals (git log auf Deploy-Tags).

Wenn ≥ 3 Deploys seit dem letzten /retro:
> "Seit dem letzten /retro wurden X Features deployed. Jetzt wäre ein guter Zeitpunkt, um `/retro` auszuführen und Muster aus den Post-Mortems zu synthetisieren."

## First Deployment Only

Guide the user through:
- [ ] Create Vercel project: `npx vercel` oder via vercel.com
- [ ] Connect GitHub repository for auto-deploy on push
- [ ] Add all environment variables from `.env.local.example` in Vercel Dashboard
- [ ] Build settings: Framework Preset = Next.js (auto-detected)
- [ ] Configure domain (or use default `*.vercel.app`)

For first deployment, guide the user through these setup guides:

**Error Tracking (5 min):** See [error-tracking.md](../../../docs/production/error-tracking.md)
**Security Headers (copy-paste):** See [security-headers.md](../../../docs/production/security-headers.md)
**Performance Check:** See [performance.md](../../../docs/production/performance.md)
**Database Optimization:** See [database-optimization.md](../../../docs/production/database-optimization.md)
**Rate Limiting (optional):** See [rate-limiting.md](../../../docs/production/rate-limiting.md)

## Common Issues

### Build fails on Vercel but works locally
- Check Node.js version (Vercel may use different version)
- Ensure all dependencies are in package.json (not just devDependencies)
- Review Vercel build logs for specific error

### Environment variables not available
- Verify vars are set in Vercel Dashboard (Settings → Environment Variables)
- Client-side vars need `NEXT_PUBLIC_` prefix
- Redeploy after adding new env vars (they don't apply retroactively)

### Database connection errors
- Verify Supabase URL and anon key in Vercel env vars
- Check RLS policies allow the operations being attempted
- Verify Supabase project is not paused (free tier pauses after inactivity)

## Rollback
If production is broken:
1. **Immediate:** Vercel Dashboard → Deployments → "..." on previous working deployment → "Promote to Production"
2. **Fix locally:** Debug the issue, `npm run build`, commit, push → Vercel auto-deploys

## Full Checklist
- [ ] G1 Static: build + lint + tsc pass, security headers geprüft
- [ ] G2 Tests: unit/integration pass, E2E pass (Pflicht bei UI-Änderung)
- [ ] G3 Sandbox: preview deploy + smoke test pass
- [ ] G4 Permissions: RLS, rate limits, env-var-leaks geprüft (Pflicht bei Auth/RLS/API/LLM)
- [ ] User-Approval für Production Deploy eingeholt
- [ ] Production URL lädt und funktioniert
- [ ] Feature in Produktion verifiziert
- [ ] Keine Console-/Log-Fehler
- [ ] Lighthouse score geprüft (Target > 90)
- [ ] Error tracking setup (Sentry or alternative) — first deploy only
- [ ] Deployment-Sektion in Feature Spec mit G1-G4 Ergebnissen und Production URL
- [ ] `features/INDEX.md` auf Deployed gesetzt
- [ ] Git Tag erstellt und gepusht
- [ ] Post-Mortem ausgefüllt (alle 6 Felder)
- [ ] /retro-Reminder geprüft (≥3 Deploys seit letztem /retro?)
- [ ] User has verified production deployment

## Git Commit
```
deploy(PROJ-X): Deploy [feature name] to production

- Production URL: https://your-app.vercel.app
- Deployed: YYYY-MM-DD
- G1: pass | G2: pass | G3: pass | G4: pass
```
