# PROJ-16: Supabase Hardening + Dependency Hygiene

## Status: Planned
**Created:** 2026-05-24

## Dependencies
- Touches: PROJ-1 (Auth + Workspace), PROJ-10 (Access Control & Shared Workspace) — `handle_new_user`, `workspaces`-Policies, `workspace_members`-Policies
- Touches: PROJ-2 (Interview Engine Backend), PROJ-4–6 — RLS-Policies aller geschäftslogischen Tabellen
- No direct functional change for users — pure operational/security improvements

## Context

Zwei separate Themen, gleicher Reviewzyklus:

**(a) Supabase Advisor-Findings:** Beim Pre-Deploy-Audit zu PROJ-8 (2026-05-24) hat `mcp__supabase__get_advisors` 5 Security-WARN und 17 Performance-Hints gemeldet. Keiner blockiert das aktuelle Deploy, aber die Anhäufung verschlechtert Operability und Skalierungsverhalten der RLS-Schicht.

**(b) Dependency-Override-Hygiene:** Im selben Pre-Deploy-Cycle wurden 7 npm-Vulns (4 high, 3 moderate) mit einer Mischung aus direktem Bump (`next 16.2.6`, `postcss 8.5.10`) und `overrides` für transitive Deps geschlossen. `npm audit` zeigt 0 — aber die Overrides sind pragmatische Pflaster: Parent-Packages (`@typescript-eslint`, `@vitejs/plugin-react`, `eslint`, …) wurden nicht mitgebumpt und ziehen weiterhin offiziell die alten Versionen. Stale-Risk bei jedem zukünftigen Major-Upgrade.

PROJ-16 räumt beides systematisch auf, sodass keine versteckte technische Schuld in Operability oder Security-Posture verbleibt.

## User Stories

- Als Betreiber möchte ich, dass keine SECURITY DEFINER Function ohne expliziten Grund über `/rest/v1/rpc` erreichbar ist, damit Angreifer keinen unsignierten Pfad zur Eskalation haben.
- Als Betreiber möchte ich, dass Passwort-Checks gegen HaveIBeenPwned aktiv sind, damit gestohlene Anmeldedaten beim Signup geblockt werden.
- Als Entwickler möchte ich, dass alle RLS-Policies `auth.uid()` in einem `(select …)`-Subquery wrappen, damit die Initplan-Optimierung greift und Queries skalieren.
- Als Entwickler möchte ich keine überlappenden Permissive-Policies auf derselben Tabelle/Action haben, damit Postgres jede Row nur einmal evaluiert.
- Als Entwickler möchte ich verstehen, warum jeder npm-Override existiert, und ihn entfernen können, sobald sein Parent das Problem aufgelöst hat.

## Acceptance Criteria

### Deliverable 1: Supabase Security-Findings beheben

- [ ] `public.handle_new_user()`: `REVOKE EXECUTE ... FROM anon, authenticated` — sie ist als Trigger gedacht, nicht als RPC. Migration mit kurzem Kommentar warum.
- [ ] `public.update_updated_at()`: `ALTER FUNCTION ... SET search_path = public, pg_temp` zur Verhinderung des Mutable-Search-Path-Vektors.
- [ ] Supabase Dashboard → Auth → Password Security: "Leaked password protection" aktivieren (per Hand, kein Code-Change).
- [ ] `vector`-Extension in public schema: **als bewusste Entscheidung in der Spec dokumentieren** (Verschiebung wäre invasiv für alle bestehenden pgvector-Referenzen in PROJ-4; Restrisiko vergleichsweise gering). Keine Code-Änderung nötig, nur in Out-of-Scope.

### Deliverable 2: RLS-Performance fix (auth_rls_initplan)

Alle Policies, die `auth.uid()` oder `current_setting()` direkt aufrufen, in `(select auth.uid())` wrappen. Betroffen laut Advisor:

- [ ] `workspace_members.Members see own memberships`
- [ ] `workspaces.Members can view workspace`
- [ ] `workspaces.Creator can manage workspace`
- [ ] `interviews.Workspace members can manage interviews`
- [ ] `knowledge_objects.Workspace members can manage knowledge_objects`
- [ ] `process_steps.Workspace members can manage process_steps`
- [ ] `use_cases.Workspace members can manage use_cases`
- [ ] `interview_state.Workspace members can manage interview_state`
- [ ] `turns.Workspace members can manage turns`

Eine einzige Migration pro Tabelle (`DROP POLICY ... CREATE POLICY ...`), keine Verhaltens-Änderung — reine Performance.

### Deliverable 3: Multiple Permissive Policies konsolidieren

- [ ] `workspaces`: "Creator can manage workspace" und "Members can view workspace" überlappen bei SELECT. Entweder zu einer Policy mergen (`USING (created_by = (select auth.uid()) OR EXISTS workspace_members …)`) oder die Creator-Policy auf INSERT/UPDATE/DELETE einschränken.

### Deliverable 4: Foreign-Key-Index nachziehen

- [ ] `knowledge_objects.turn_id_fkey`: covering index hinzufügen (`CREATE INDEX idx_knowledge_objects_turn ON knowledge_objects(turn_id)`).

### Deliverable 5: Unused Indexes entscheiden

Vier Indexes sind seit Schema-Anlage nie benutzt worden — sie ballasten Schreibpfade ohne Nutzen:

- [ ] `idx_interviews_workspace`
- [ ] `idx_turns_interview`
- [ ] `idx_turns_order`
- [ ] `idx_interviews_extractions`
- [ ] `idx_knowledge_objects_embedding`

Pro Index: **entweder droppen oder begründen warum er bleibt**. Default: droppen — bei MVP-Datenmenge gibt es Re-Index in <1s falls sich ein Query-Pattern ändert.

### Deliverable 6: npm-Override-Hygiene

- [ ] Pro Override in `package.json` ein Kommentar (entweder als `// reason:` direkt im JSON oder als Liste in einem `docs/dependency-overrides.md`): welches CVE, welcher Parent zieht die alte Version, ab welchem Parent-Bump ist der Override entbehrlich.
- [ ] Parent-Bumps prüfen, die mehrere Overrides obsolet machen würden:
  - `@typescript-eslint/*` neuere Version (zieht moderneres `minimatch`?)
  - `@vitejs/plugin-react` neuere Version (zieht direkt `vite 8.0.14`?)
  - Wenn ein Parent gefahrlos bumpbar ist, ihn bumpen und den Override entfernen.
- [ ] Sicherstellen, dass `npm audit` nach allen Bumps + Override-Trimming weiterhin 0 zeigt.
- [ ] Kalender-/Routine-Anker setzen: quartalsweise `npm audit` + Override-Review (z.B. als `/schedule`-Routine oder TODO in `docs/agent-procedures.md`).

### Deliverable 7: Verifikation

- [ ] `mcp__supabase__get_advisors security` nach Deliverable 1+3: keine Security-WARN außer dem dokumentierten `extension_in_public/vector`.
- [ ] `mcp__supabase__get_advisors performance` nach Deliverable 2+3+4+5: keine `auth_rls_initplan`-WARN mehr, keine `multiple_permissive_policies`-WARN auf `workspaces`, kein unindexed FK auf `knowledge_objects.turn_id`.
- [ ] `npm audit` = 0 vulnerabilities.
- [ ] Alle 197 Unit-Tests grün, Production-Build erfolgreich.
- [ ] E2E-Tests (Playwright) für Auth-Flow + Interview-Erstellung grün — RLS-Refactor darf keine Permission-Regression einführen.

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| RLS-Policy-Refactor während aktive Sessions laufen | Alte Sessions bleiben funktional, weil `DROP POLICY ... CREATE POLICY` atomar in derselben Transaktion läuft. Keine Window mit fehlender Policy. |
| Override entfernt, aber Parent zieht doch noch alte Version | `npm audit` würde sofort wieder anschlagen — also vor dem Entfernen jedes Overrides explizit per `npm ls <pkg>` prüfen, welche Version installiert würde. |
| `handle_new_user` REVOKE bricht Signup-Trigger | Trigger sind unabhängig von RPC-Permissions. `SECURITY DEFINER` Funktion in einem Trigger läuft auf Trigger-Aufruf, nicht über die `anon`/`authenticated`-Rolle. Risiko low, aber E2E-Signup-Test deckt es ab. |
| Leaked Password Protection blockt einen Test-Account | Falls vorhandene Test-Accounts schwache Passwörter haben, blockt der Toggle nur Neuanmeldungen, nicht existierende Logins. Vor Aktivierung Test-Workspace-Konten checken. |

## Technical Requirements

- Alle DB-Änderungen via Supabase MCP `apply_migration` mit beschreibendem Namen (`proj16_*`).
- TypeScript-Types nach jeder Migration regenerieren (Hook im `.claude/settings.json` mahnt das automatisch an seit Commit `7a8ca6c`).
- Keine produktiven Daten anfassen — alle Changes sind Strukturänderungen (Functions, Policies, Indexes) ohne Datenmanipulation.

## Out of Scope

- **`vector`-Extension aus `public`-Schema verschieben:** Architektonisch sauberer, aber alle PROJ-4-Embeddings-Calls referenzieren das Schema implizit. Migration wäre invasiv, Risiko hoch, Nutzen niedrig (Restrisiko des Vectors selbst ist gering — wenn ein Angreifer schon DB-Schema-Zugriff hat, ist die Extension-Position nachrangig).
- **Komplettes Eslint-/Vite-Toolchain-Upgrade:** Größerer Aufwand, eigener Ticket-Scope. PROJ-16 begnügt sich mit dem minimal nötigen Parent-Bump pro Override-Reduktion.
- **Automatisierte Audit-Pipeline (CI-Check):** Wäre wertvoll, aber separater Scope — PROJ-16 setzt nur den manuellen Anker.

## Verifikation

1. `mcp__supabase__list_migrations` listet die neuen `proj16_*`-Migrations.
2. `mcp__supabase__get_advisors security` und `… performance` nach Deploy → erwarteter Restzustand wie in Deliverable 7.
3. `npm audit` → 0.
4. `npm ls minimatch picomatch vite postcss brace-expansion ajv` → zeigt für jedes Package nur noch eine (gepatchte) Version, keine Duplikate.
5. Smoke-Test: Signup-Flow funktioniert (Trigger), Login funktioniert (RLS), Interview-Liste lädt im Dashboard (RLS workspace_members).

## Implementation Notes

_To be filled during /backend phase. Expected order:_

1. Migration 1: REVOKE `handle_new_user` + `update_updated_at` search_path fix
2. Migrations 2–10: RLS-Policy-Wrapping (eine pro Tabelle)
3. Migration 11: `workspaces`-Policy-Konsolidierung
4. Migration 12: FK-Index + Unused-Index-Drops
5. Manuell: Leaked Password Protection im Supabase Dashboard
6. `package.json`: Overrides kommentieren + Parent-Bump-Prüfung
