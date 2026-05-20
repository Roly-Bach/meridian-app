# PROJ-10: Access Control & Shared Workspace

## Status: Roadmap
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — Auth-Flow, RLS-Policies, Workspace-Schema

## Kontext

### Aktuelles Verhalten

Jeder Nutzer kann sich frei registrieren. Jeder Nutzer erhält beim Signup einen eigenen Workspace. Daten sind vollständig workspace-isoliert: Lias sieht nicht, was Bendewar erstellt hat — und umgekehrt.

### Gewünschtes Verhalten

1. **Invite-only**: Registrierung nur für explizit freigegebene E-Mail-Adressen möglich. Kein offener Signup.
2. **Shared Workspace**: Lias und Bendewar teilen sich einen gemeinsamen Workspace — alle Interviews, Prozessschritte und Use Cases sind für beide sichtbar.
3. **Admin-Erweiterung**: Bei Bedarf können weitere "Admins" (z.B. Abteilungsleiter bei Kundenprojekten) zum Workspace eingeladen werden.
4. **Gleichberechtigter Zugriff**: Keine hierarchische Rollen-Trennung im MVP — alle Mitglieder sehen und können alles im Workspace.

## User Stories

- Als Lias möchte ich verhindern, dass sich Fremde registrieren können, damit die App nicht öffentlich nutzbar ist.
- Als Lias möchte ich die Interviews sehen, die Bendewar erstellt hat, damit wir gemeinsam an Projekten arbeiten können.
- Als Bendewar möchte ich die Interviews sehen, die Lias erstellt hat, damit ich den aktuellen Stand kenne.
- Als Lias möchte ich bei Bedarf einen weiteren Nutzer (z.B. einen Abteilungsleiter beim Kunden) einladen können, ohne eine komplexe Rollenverwaltung zu benötigen.

## Acceptance Criteria

### Invite-Only Signup

- [ ] `/signup` prüft vor dem Anlegen des Accounts, ob die E-Mail in einer Allowlist (`allowed_emails`-Tabelle oder Env-Variable) steht
- [ ] Nicht erlaubte E-Mail → Fehlermeldung "Registrierung ist nur auf Einladung möglich." — kein Account wird angelegt
- [ ] Allowlist initial: `lias.hemmersbach@gmail.com` + Bendewars E-Mail-Adresse (in Env-Variable oder DB-Eintrag)
- [ ] Neuen Nutzer hinzufügen: entweder via Supabase-Dashboard-Eintrag oder via App-Funktion (optional für MVP)

### Shared Workspace

**Architektur-Entscheidung:** Neues Schema `workspace_members` — ein Workspace kann mehrere User haben.

- [ ] Neue Tabelle `workspace_members` (workspace_id, user_id, joined_at) mit Unique Constraint auf (workspace_id, user_id)
- [ ] RLS-Policies auf allen Tabellen geändert: statt `workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())` → `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`
- [ ] Beim Signup: neuer Nutzer wird automatisch dem "Haupt-Workspace" hinzugefügt (kein eigener neuer Workspace)
- [ ] **Alternativvariante (einfacher):** Beide Accounts teilen dasselbe Passwort und dieselbe E-Mail — ABGELEHNT (kein echtes Multi-User)

**Migration-Strategie:**

- [ ] Bestehende Workspaces (falls vorhanden): für jeden existierenden Workspace wird ein `workspace_members`-Eintrag mit dem aktuellen `user_id` angelegt
- [ ] `workspaces.user_id` bleibt erhalten als "Ersteller" — wird aber nicht mehr für RLS verwendet

### Admin-Einladung (optional, MVP-Light)

- [ ] Einfachste Umsetzung: Neuen Nutzer manuell in `allowed_emails` eintragen + in `workspace_members` hinzufügen (via Supabase Dashboard oder SQL)
- [ ] Kein Einladungs-Email-Flow im MVP
- [ ] Keine Rollen-Unterscheidung im MVP (alle Workspace-Mitglieder sind gleichberechtigt)

### UI-Anpassungen

- [ ] `/signup`-Seite zeigt nach Fehler "Nur auf Einladung" eine klare, nicht-technische Fehlermeldung
- [ ] Dashboard-Sidebar zeigt Workspace-Name (bleibt unverändert)
- [ ] Kein separates "Team"-Menü im MVP

## Migrations-Plan

```sql
-- 1. Tabelle erstellen
CREATE TABLE workspace_members (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- 2. RLS aktivieren
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mitglieder sehen ihre Workspaces" ON workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- 3. Bestehende Nutzer migrieren
INSERT INTO workspace_members (workspace_id, user_id)
SELECT id, user_id FROM workspaces;

-- 4. RLS-Policies auf allen abhängigen Tabellen anpassen
-- (interviews, knowledge_objects, process_steps, use_cases)
```

## Allowlist-Implementierung

**Option A: Env-Variable** (einfacher, kein DB-Eintrag nötig)
```
ALLOWED_EMAILS=lias.hemmersbach@gmail.com,bendewar@example.com
```
Check in `signup/actions.ts` vor `supabase.auth.signUp()`.

**Option B: DB-Tabelle** `allowed_emails` (flexibler, kein Re-Deploy bei neuem Nutzer)
```sql
CREATE TABLE allowed_emails (email text PRIMARY KEY, added_at timestamptz DEFAULT now());
INSERT INTO allowed_emails VALUES ('lias.hemmersbach@gmail.com'), ('bendewar@example.com');
```

**Empfehlung:** Option A für MVP (zwei feste Nutzer, kein Overhead). Option B wenn Kundenprojekte starten und Abteilungsleiter eingeladen werden.

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Fremder versucht Signup | "Nur auf Einladung"-Fehler, kein Account angelegt |
| Lias löscht ein Interview | Bendewar sieht es nicht mehr |
| Beide erstellen Interview gleichzeitig | Kein Konflikt — jede Row hat eigene ID |
| Nutzer wird aus workspace_members entfernt | Zugriff sofort weg (RLS greift bei jedem Request) |

## Technical Requirements

- DB-Migration: neue Tabelle + geänderte RLS-Policies
- Keine Frontend-Änderungen außer Signup-Fehlermeldung
- `signup/actions.ts`: Allowlist-Check vor `signUp()`
- Workspace-Signup-Trigger anpassen: kein neuer Workspace mehr, stattdessen `workspace_members`-Eintrag in bestehendem Workspace
- `.env.local.example`: `ALLOWED_EMAILS` dokumentieren

## Out of Scope

- Rollenkonzept (Admin vs. Member) — gleichberechtigter Zugriff für alle im MVP
- Einladungs-E-Mail-Flow
- Nutzer aus Workspace entfernen (UI)
- Mehrere Workspaces pro Nutzer
- SSO / OAuth Login
