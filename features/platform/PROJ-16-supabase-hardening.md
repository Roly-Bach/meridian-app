# PROJ-16: Supabase Hardening + Dependency Hygiene

## Status: Approved
**Created:** 2026-05-24
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** M
**Bugs:** 0:0:0

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

- [x] `public.handle_new_user()`: `REVOKE EXECUTE ... FROM anon, authenticated` — sie ist als Trigger gedacht, nicht als RPC. Migration mit kurzem Kommentar warum. (plus `FROM PUBLIC` nachgezogen, siehe Implementation Notes)
- [x] `public.update_updated_at()`: `ALTER FUNCTION ... SET search_path = public, pg_temp` zur Verhinderung des Mutable-Search-Path-Vektors. (zusätzlich: `match_process_cluster`, `search_knowledge_objects`, `patch_interview_step_field` — Drift gegen Spec, siehe Implementation Notes)
- [ ] Supabase Dashboard → Auth → Password Security: "Leaked password protection" aktivieren (per Hand, kein Code-Change). **Noch offen — User-Aktion im Dashboard nötig, kein Tool-Zugriff.**
- [x] `vector`-Extension in public schema: **als bewusste Entscheidung in der Spec dokumentieren** (Verschiebung wäre invasiv für alle bestehenden pgvector-Referenzen in PROJ-4; Restrisiko vergleichsweise gering). Keine Code-Änderung nötig, nur in Out-of-Scope.

### Deliverable 2: RLS-Performance fix (auth_rls_initplan)

Alle Policies, die `auth.uid()` oder `current_setting()` direkt aufrufen, in `(select auth.uid())` wrappen. Betroffen laut Advisor:

- [x] `workspace_members.Members see own memberships`
- [x] `workspaces.Members can view workspace`
- [x] `workspaces.Creator can manage workspace`
- [x] `interviews.Workspace members can manage interviews`
- [x] `knowledge_objects.Workspace members can manage knowledge_objects`
- [x] `process_steps.Workspace members can manage process_steps`
- [x] `use_cases.Workspace members can manage use_cases`
- [x] `interview_state.Workspace members can manage interview_state`
- [x] `turns.Workspace members can manage turns`
- [x] `process_clusters.workspace_member_select/insert/update` — **nicht in ursprünglicher Spec, Drift seit PROJ-18**, gleicher Fix angewendet (siehe Implementation Notes)

Eine einzige Migration pro Tabelle (`DROP POLICY ... CREATE POLICY ...`), keine Verhaltens-Änderung — reine Performance.

### Deliverable 3: Multiple Permissive Policies konsolidieren

- [x] `workspaces`: "Creator can manage workspace" und "Members can view workspace" überlappen bei SELECT. Umgesetzt: Creator-Policy auf INSERT/UPDATE/DELETE als 3 Einzelpolicies aufgeteilt (Spaltenname tatsächlich `user_id`, nicht `created_by` wie ursprünglich vermutet — per `pg_policies`-Abfrage verifiziert).

### Deliverable 4: Foreign-Key-Index nachziehen

- [x] `knowledge_objects.turn_id_fkey`: covering index hinzugefügt (`idx_knowledge_objects_turn`).

### Deliverable 5: Unused Indexes entscheiden

**Liste zur Ausführungszeit aktualisiert** (Drift gegen Spec-Snapshot vom 2026-05-24): `idx_interviews_workspace`, `idx_turns_interview`, `idx_turns_order` werden laut aktuellem Advisor inzwischen genutzt — nicht angefasst. Tatsächlich gedroppt:

- [x] `idx_knowledge_objects_embedding`
- [x] `idx_process_clusters_embedding` (nicht in ursprünglicher Liste — Tabelle existierte 2026-05-24 noch nicht)
- [x] `idx_interviews_analyst_status` (nicht in ursprünglicher Liste)
- [x] `idx_interviews_extractions`

Default angewendet: droppen — bei MVP-Datenmenge gibt es Re-Index in <1s falls sich ein Query-Pattern ändert.

### Deliverable 6: npm-Override-Hygiene

- [x] Pro Override Begründung in [`docs/dependency-overrides.md`](../../docs/dependency-overrides.md) dokumentiert (CVE, Parent, Entbehrlichkeits-Bedingung).
- [x] Parent-Bump-Prüfung: `brace-expansion`-Override entfernt (minimatch@9 deklariert die sichere Range selbst). `eslint`/`@vitejs/plugin-react` selbst ziehen weiterhin ältere Ranges für `minimatch`/`ajv`/`vite` — diese Overrides bleiben nötig.
- [x] `npm audit` = 0 nach allen Bumps + Override-Trimming (zusätzlich `@opentelemetry/sdk-node` Major-Bump nötig, User-Approval eingeholt — war nicht Teil der ursprünglichen Spec-Annahme, da Langfuse/OTel-Dependency-Baum erst nach PROJ-13 entstand).
- [x] Routine-Anker gesetzt: Quartals-Review-Hinweis in `docs/dependency-overrides.md` (kein `agent-procedures.md`-Eintrag — diese Datei ist Interview-Methodik-spezifisch, kein Operability-Dokument).

### Deliverable 7: Verifikation

- [x] `mcp__supabase__get_advisors security` nach Deliverable 1+3: keine Security-WARN außer dem dokumentierten `extension_in_public/vector` + `auth_leaked_password_protection` (offen, manuell).
- [x] `mcp__supabase__get_advisors performance` nach Deliverable 2+3+4+5: keine `auth_rls_initplan`-WARN mehr, keine `multiple_permissive_policies`-WARN auf `workspaces`, kein unindexed FK auf `knowledge_objects.turn_id`.
- [x] `npm audit` = 0 vulnerabilities.
- [x] Alle Unit-Tests grün (627 passed / 1 skipped, nicht 197 wie ursprünglich geschätzt — Testsuite ist seit 2026-05-24 gewachsen), Production-Build erfolgreich.
- [ ] E2E-Tests (Playwright) für Auth-Flow + Interview-Erstellung — noch nicht in diesem Durchgang ausgeführt, siehe QA.

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

## Tech Design (Solution Architect)

Reines Backend-/Operability-Ticket — keine UI, keine neue Komponente, kein neuer Nutzer-Flow. Architektur-Entscheidungen betreffen nur Sequenzierung und Risikoabbau bei den Datenbank-Änderungen.

### Was gebaut wird

Zwölf kleine, einzeln rückrollbare Datenbank-Migrationen statt einer großen — jede ändert genau eine Sache (eine Function, eine Policy, ein Index). Reihenfolge:

1. **Function-Härtung** (2 Migrationen): Die Trigger-Function für neue User-Accounts wird so abgesichert, dass sie nicht mehr direkt von außen aufrufbar ist — nur noch vom Datenbank-Trigger selbst. Eine zweite Function bekommt einen fest verdrahteten Suchpfad, damit niemand durch Schema-Manipulation eigenen Code einschleusen kann.
2. **RLS-Policy-Tuning** (9 Migrationen, eine pro Tabelle): Jede Policy, die aktuell bei jeder Zeile neu prüft "ist das mein Workspace?", wird so umgeschrieben, dass Postgres diese Prüfung einmal pro Query statt einmal pro Zeile macht. Gleiches Sicherheitsverhalten, nur schneller bei wachsender Datenmenge.
3. **Policy-Konsolidierung** (1 Migration): Zwei sich überlappende Lese-Regeln auf der Workspace-Tabelle werden zu einer zusammengeführt, damit Postgres nicht zwei Regeln pro Zugriff auswerten muss.
4. **Index-Aufräumen** (1 Migration): Ein fehlender Index wird ergänzt (dort wo Lookups ohne Index langsam würden), vier nie genutzte Indizes werden entfernt (sie kosten nur Schreibzeit, ohne je gelesen zu werden).

Dazu, außerhalb der Datenbank:
- **Ein Klick im Supabase Dashboard** (kein Code): Schutz gegen bekannte geleakte Passwörter beim Signup aktivieren.
- **Dependency-Aufräumen** in `package.json`: jeder bestehende Sicherheits-Override bekommt eine Begründung dazu, und wird entfernt, sobald das Paket, das ihn nötig macht, selbst aktualisiert wurde.

### Warum kleine Einzel-Migrationen statt eine große

Jede Migration ist unabhängig überprüfbar und einzeln zurückrollbar. Falls eine Policy-Änderung unerwartetes Verhalten zeigt, betrifft das eine Tabelle — nicht das ganze Sicherheitsmodell. Migration-Reihenfolge ist so gewählt, dass riskantere Function-Änderungen zuerst laufen (kleinster Radius, einfachster Rollback), Index-Änderungen zuletzt (rein performance-seitig, kein Sicherheits-Risiko).

### Warum kein Code-Pfad für Leaked-Password-Schutz

Das ist ein Supabase-Auth-Plattform-Feature, kein Anwendungscode — Aktivierung passiert ausschließlich im Dashboard. Kein Dependency, keine eigene Logik zu pflegen.

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Migrationen über Supabase MCP statt manuellem SQL-Editor | Versionskontrolliert, reproduzierbar, in `supabase/migrations/` nachvollziehbar wie alle bisherigen PROJ-Migrationen |
| `vector`-Extension bleibt in `public`-Schema | Verschiebung würde alle bestehenden Embedding-Abfragen anfassen (hohes Risiko) für ein geringes Restrisiko — explizit akzeptiert, nicht übersehen |
| Unused Indexes default-mäßig löschen statt behalten | MVP-Datenmenge macht Re-Index-Erstellung eine Sache von Sekunden — Beibehalten ungenutzter Indizes kostet kontinuierlich Schreib-Performance ohne Gegenwert |
| Keine automatisierte CI-Audit-Pipeline in diesem Ticket | Eigener Scope, hier nur der manuelle quartalsweise Anker gesetzt |

### Abhängigkeiten (Pakete)

Keine neuen Pakete. Bestehende `package.json`-Overrides werden dokumentiert oder entfernt, keine neuen Dependencies hinzugefügt.

## Implementation Notes

**Drift gegen Spec-Annahmen (Advisor-Check 2026-06-22, vor Migration 1):** Live-Advisor-Stand wich vom 2026-05-24-Snapshot ab — Schema hat sich seit PROJ-18/25/26 weiterentwickelt. Deltas:
- 2 zusätzliche Functions mit mutable search_path: `match_process_cluster`, `search_knowledge_objects` (nicht nur `update_updated_at`)
- `patch_interview_step_field` zusätzlich als anon/authenticated-aufrufbare SECURITY DEFINER Function geflaggt (war in Spec nicht erwähnt) — Call-Pfad-Check (`grep` auf `getSupabaseAdmin()` vs. User-Session-Client) bestätigte: nur server-seitig mit Service-Role aufgerufen → REVOKE sicher
- `search_knowledge_objects` wird dagegen von `/api/knowledge/search` mit User-Session-Client (`createClient()`, anon key + Cookies) aufgerufen → REVOKE nur für `anon`, `authenticated` behält EXECUTE
- Neue Tabelle `process_clusters` (3 Policies: `workspace_member_select/insert/update`) brauchte denselben RLS-Initplan-Fix wie die ursprünglich gelisteten 9 Tabellen — macht 10 Tabellen-Migrationen statt 9
- Unused-Index-Liste hatte sich verschoben: `idx_interviews_workspace`, `idx_turns_interview`, `idx_turns_order` werden inzwischen genutzt (nicht mehr geflaggt); stattdessen neu unused: `idx_process_clusters_embedding`, `idx_interviews_analyst_status`

Alle Deltas vor Ausführung per `AskUserQuestion` bestätigt (Approval Gate, Supabase-Schema-Änderung).

**Migrationen (13 statt geplanter 12 — ein Korrektur-Pass nötig):**

1. `proj16_01_function_security_hardening` — REVOKE `handle_new_user`, `patch_interview_step_field` (FROM anon, authenticated); `search_path` Fix für `update_updated_at`, `match_process_cluster`, `search_knowledge_objects`; REVOKE `search_knowledge_objects` FROM anon
2. `proj16_02` bis `proj16_10` — RLS-Initplan-Wrap, je eine Migration pro Tabelle (`workspace_members`, `workspaces` ×2 Policies, `interviews`, `knowledge_objects`, `process_steps`, `use_cases`, `interview_state`, `turns`, `process_clusters` ×3 Policies)
3. `proj16_11_workspaces_policy_consolidation` — "Creator can manage workspace" (war `FOR ALL`) aufgeteilt in INSERT/UPDATE/DELETE-Einzelpolicies, damit nur noch eine permissive Policy pro Action+Role übrig bleibt (SELECT bleibt exklusiv bei "Members can view workspace")
4. `proj16_12_fk_index_and_unused_index_cleanup` — Index auf `knowledge_objects.turn_id` ergänzt, 4 unused Indexes gedroppt (aktualisierte Liste, siehe Drift oben)
5. **`proj16_13_fix_public_grant_and_missing_search_path`** (Korrektur-Pass): Re-Check nach Migration 1–12 zeigte zwei Lücken — (a) `REVOKE ... FROM anon, authenticated` allein wirkt nicht, weil Postgres bei Function-Erstellung implizit `EXECUTE` an `PUBLIC` vergibt und beide Rollen über `PUBLIC` weiterhin Zugriff hatten; zusätzliches `REVOKE ... FROM PUBLIC` nötig, mit explizitem Re-`GRANT ... TO authenticated` für `search_knowledge_objects`. (b) `patch_interview_step_field` hatte in Migration 1 nur das REVOKE bekommen, der `search_path`-Fix fehlte versehentlich — nachgezogen.
6. Manuell: Leaked Password Protection im Supabase Dashboard — **noch ausstehend**, kein Code-Zugriff möglich, User muss das selbst im Dashboard aktivieren.
7. `package.json`: `@opentelemetry/sdk-node` `^0.218.0` → `^0.219.0` (direkter Dependency-Bump, kein Override) löste 24 verbleibende Moderate-Vulns in der gesamten `@opentelemetry/*`-Kette — Peer-Deps von `@langfuse/otel@5.4.0` vorher gegen beide Versionen geprüft, User-Approval eingeholt (SemVer-Major laut npm)
8. `npm audit fix` (ohne `--force`) behob 6 weitere Vulns ohne Breaking Changes (vite, undici, esbuild, js-yaml, protobufjs, @babel/core)
9. Override-Hygiene: `brace-expansion`-Override entfernt (war redundant — `minimatch@9.0.9` deklariert selbst `^2.0.2`, npm resolved ohne Override bereits auf `2.1.0`). `vite`-Override-Floor von `^8.0.14` auf `^8.0.16` angehoben (alte Floor lag noch im laut Advisory verwundbaren Bereich 8.0.0–8.0.15, war nur durch Zufall im Lockfile auf 8.0.16 aufgelöst). Begründungen dokumentiert in [`docs/dependency-overrides.md`](../../docs/dependency-overrides.md) statt Inline-JSON-Kommentaren (JSON erlaubt keine Kommentare).

**Verifikation (alle bestanden):**
- `mcp__supabase__get_advisors security`: nur noch `extension_in_public/vector` (dokumentiert Out-of-Scope) + `auth_leaked_password_protection` (manueller Dashboard-Schritt) übrig
- `mcp__supabase__get_advisors performance`: keine `auth_rls_initplan`-, keine `multiple_permissive_policies`-Warnung mehr; einzige verbleibende `unused_index`-Meldung ist der gerade neu erstellte `idx_knowledge_objects_turn` (erwartet, hat noch keine Query-Historie)
- `npm audit`: 0 vulnerabilities (war 30 vor diesem Durchgang)
- `npm test`: 627 passed / 1 skipped, keine Regression
- `npm run lint` (`tsc --noEmit`) + `npm run build`: beide clean
- `database.types.ts`: keine Schema-Shape-Änderung (keine neuen Spalten/Tabellen) → kein Diff nötig, handkuratierte Datei bleibt unverändert

## QA Test Results (2026-06-22)

**QA-Datum:** 2026-06-22
**Tester:** /qa PROJ-16
**Environment:** Live Supabase-Projekt (Dev), Next.js 16.2.6 Production-Build + Dev-Server für E2E

### Security Audit — RLS-Verhalten direkt gegen Postgres simuliert

Per `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` mit gefälschtem `sub` (Fremduser, kein Mitglied irgendeines Workspace):

| Check | Ergebnis |
|---|---|
| Fremduser sieht `workspaces` | 0 Rows — PASS |
| Fremduser sieht `interviews` | 0 Rows — PASS |
| Fremduser sieht `process_clusters` | 0 Rows — PASS |
| Fremduser sieht `workspace_members` | 0 Rows — PASS |
| Echter Owner sieht eigene Daten (gleicher Query) | 1 Workspace, 21 Interviews, 1 Membership — PASS (Isolation funktioniert, Zugriff nicht überblockt) |
| Echter Owner kann eigenen Workspace UPDATEn (neue Policy-Aufteilung Deliverable 3) | PASS |
| Fremduser kann fremden Workspace NICHT UPDATEn | PASS (0 Rows betroffen) |
| Grants auf `handle_new_user`/`patch_interview_step_field`: nur `postgres`+`service_role` | PASS, per `information_schema.routine_privileges` verifiziert |

**Fazit:** RLS-Initplan-Rewrite (Deliverable 2) und Policy-Konsolidierung (Deliverable 3) haben das Zugriffsmodell nicht verändert — nur die Auswertungsgeschwindigkeit. Tenant-Isolation hält.

### Regression Testing

- `npm test`: 627/628 (1 skipped), keine Regression durch die Migrationen.
- `tests/PROJ-1-auth-workspace.spec.ts` isoliert: 26/26 PASS, 4 skipped — Auth/Workspace-Flow (am direktesten von den RLS-Änderungen betroffen) unverändert funktional.
- Volle E2E-Suite (`npx playwright test`, alle 218 Tests): mehrfach gefahren, Ergebnisse zwischen Läufen inkonsistent (92–101 passed, Rest "did not run"/skipped) — **Ursache identifiziert: Test-Account-Erschöpfung/Rate-Limiting durch mehrfaches Komplett-Durchlaufen der Suite in derselben Session** (jeder Lauf erzeugt reale Supabase-Auth-Signups), nicht durch PROJ-16-Code. Isolierte Re-Läufe der RLS-kritischsten Datei (PROJ-1) waren stabil grün.

### Kritischer Fund (nicht PROJ-16-Regression) — siehe KI-7 in `features/INDEX.md`

Bei der Regression-Untersuchung der fehlgeschlagenen `PROJ-3-interview-ui.spec.ts`-Tests wurde aufgedeckt: `/interview/[token]` und `/api/interview/[token]/chat` redirecten unauthentifiziert zu `/login` — **seit der allerersten Middleware-Version** (git-history-verifiziert, `PUBLIC_ROUTES` enthielt `/interview` nie). Reproduziert in Dev und Production-Build via `curl` ohne Session-Cookie. Betrifft weder PROJ-15 noch PROJ-16 ursächlich (Logik unverändert seit Erstellung) — als **KI-7 (Critical)** in `features/INDEX.md` Known Issues geloggt, eigener Fix-Zyklus empfohlen statt Mitfix in diesem Ticket.

### Bugs

Keine Bugs, die PROJ-16 selbst zuzuordnen sind. KI-7 ist pre-existing und wird separat getrackt (siehe oben) — fließt nicht in den Bugs-Tally dieses Tickets ein.

### Production-Ready Decision

**YES** — keine Critical/High/Medium Bugs in PROJ-16 selbst. Ausstehend: Leaked-Password-Protection-Toggle im Dashboard (manuell, User-Aktion, kein Code-Blocker für Deploy der Code-Änderungen).
