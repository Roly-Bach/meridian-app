# ADR-004: Feature Tracking System v2

**Status:** Accepted (2026-05-24)
**Author:** Lias Hemmersbach
**Repository:** Roly-Bach/meridian-app
**Supersedes:** Feature-Tracking-Abschnitt aus ADR-001. Übrige ADR-001-Entscheidungen bleiben gültig.
**Related:** —

## Context

Das in ADR-001 etablierte Feature-Tracking (flache PROJ-X-Liste, Status-Progression, Feature-Specs) funktioniert bis etwa 15 Features. Mit wachsendem Scope zeigen sich strukturelle Lücken:

1. **Keine Hierarchie**: PROJ-7 (Voice Input) und PROJ-8 (Interview Design) sind Erweiterungen bestehender Features, werden aber identisch zu neuen Features angelegt.
2. **Keine Domänen-Gruppierung**: Bei 30+ Features wird INDEX.md unlesbar. Thematisch verwandte Features sind nur über die `Depends`-Spalte implizit verknüpft.
3. **Kein Lernmechanismus**: Bugs, Spec-Abweichungen und Überraschungen sterben in Feature-Specs. Es gibt keinen Weg, daraus systematisch Regeln abzuleiten.
4. **Agents raten statt zu recherchieren**: /qa und Debugging-Agents suchen Root Causes durch Ausprobieren statt durch gezieltes Recherchieren mit Scout.
5. **Veralteter Ballast**: `features/README.md` ist inkonsistent mit dem realen Status-Modell und wird von keinem Agent referenziert.

## Decision

Die Entscheidung besteht aus 11 normativen Sektionen. Sektion 5 (Bookkeeping) und Sektion 11 (Migration bestehender Specs) sind ausdrücklich darauf ausgelegt, dass der Workflow `/write-spec → /architecture → /frontend → /backend → /qa → /deploy` nach der Migration mindestens so robust läuft wie heute.

### 1. Domänen (5)

Features werden einer von 5 Domains zugeordnet:

| Domain | Beschreibung | Aktuelle Features |
|--------|-------------|-------------------|
| **Platform** | Auth, Workspace, Infrastruktur, LLM-Konfiguration, Observability, Security | PROJ-1, PROJ-9, PROJ-10, PROJ-12, PROJ-13, PROJ-15, PROJ-16 |
| **Interview Engine** | Interview-Führung: Agent-Backend, UI, Voice, Design, Eval | PROJ-2, PROJ-3, PROJ-7, PROJ-8, PROJ-17 |
| **Wissensbank** | Extraktion, Strukturierung und Speicherung von Prozesswissen | PROJ-4, PROJ-5, PROJ-14 |
| **Use Case Engine** | Ableitung, Priorisierung und ROI-Berechnung von Use Cases | PROJ-6 |
| **Dashboard & Output** | Admin-Übersicht, Reports, Exports | PROJ-11 |

**Grenze Wissensbank / Use Case Engine:** Wissensbank speichert *was ist* (Prozesse, Schritte, Tools). Use Case Engine leitet *was tun wir damit* ab (KI-Use-Cases, ROI). PROJ-5 (Prozessschritt-Anreicherung) bleibt Wissensbank, weil es die Beschreibung des Ist-Prozesses verfeinert.

### 2. Feature-Typen (4)

Jedes Feature bekommt einen Typ:

| Typ | Definition | Beispiel |
|-----|-----------|---------|
| **Epic** | Foundational, eigene DB-Tabellen + Service, andere bauen darauf auf | PROJ-2 (Interview Engine Backend) |
| **Feature** | Neue nutzersichtbare Fähigkeit innerhalb einer Domain | PROJ-3 (Interview UI) |
| **Extension** | Ergänzt ein bestehendes Feature ohne dessen Verhalten zu ersetzen | PROJ-7 (Voice Input → PROJ-3) |
| **Revision** | Überarbeitet/ersetzt Verhalten eines bestehenden Features | PROJ-8 (Interview Design → PROJ-2) |

**`Extends` ist immer genau ein PROJ-X.** Cross-Cutting-Features (Observability, Rate Limiting, Security), die mehrere bestehende Features betreffen, bekommen Type=Feature und Extends=—. Die Beziehung wird in der Spec-Sektion "Dependencies" dokumentiert. Begründung: ein-zu-eins-Beziehung in `Extends` erlaubt eindeutige Reverse-Lookups (Welche Extensions gibt es zu PROJ-X?). Mehrere Extends-Einträge wären ambig.

### 3. Status-Modell

Lifecycle-Status (linear):

```
Roadmap → Planned → Architected → In Progress → In Review → Approved → Deployed
```

| Status | Erreicht durch |
|--------|---------------|
| Roadmap | /init (Feature identifiziert, kein Spec-File) |
| Planned | /write-spec |
| Architected | /architecture |
| In Progress | /frontend oder /backend startet |
| In Review | /qa startet |
| Approved | /qa passt (keine Critical/High Bugs) |
| Deployed | /deploy |

**Blocked** ist ein orthogonaler Zustand, der von Planned/Architected/In Progress aus erreicht werden kann. Bedeutet: Arbeit pausiert wegen externem Faktor (Framework-Bug, fehlender Vendor-Support, blockende Abhängigkeit). Spec dokumentiert: *was* blockt und *wann* erneut prüfen. Resolution geht zurück zum vorherigen Status oder weiter zu Deployed.

Aktuelles Beispiel: PROJ-15 (CSP Hardening) ist Blocked wegen Next.js 16.1.1 Header-Verhalten, Re-Test bei 16.2+.

### 4. Neues INDEX.md-Format (10 Spalten)

```
| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
```

| Neu | Definition |
|-----|-----------|
| `Type` | Epic / Feature / Extension / Revision (Sektion 2) |
| `Domain` | eine der 5 Domains (Sektion 1) |
| `Extends` | PROJ-X bei Extension/Revision, sonst `—` |
| `Appetite` | S (1-2d) / M (3-5d) / L (1-2w) / XL (>2w), Schätzung vor Implementierung |
| `Bugs` | H:M:L nach QA (z.B. `0:2:1`), vor QA `—` |

**Entfernt:**
- `Created` → steht im Spec-Header
- `Depends` → steht in Spec-Sektion "Dependencies"

**Behalten:** `Spec` (Link bleibt operational hilfreich beim Navigieren).

### 5. Bookkeeping-Regeln (bullet proof)

Jedes Feld in INDEX.md und Spec-Header hat genau einen Lifecycle-Event, der es setzt, und genau eine Skill, die dafür zuständig ist. Ein "—" ist nur erlaubt, solange das Lifecycle-Event noch nicht erreicht wurde.

| Feld | Erstmals gesetzt durch | Zuständige Skill | Wert bei v2-Migration alter Features |
|------|----------------------|------------------|--------------------------------------|
| ID | INDEX.md "Next Available ID" | jede schreibende Skill | bereits vorhanden |
| Feature | /write-spec | write-spec | bereits vorhanden |
| Type | /write-spec | write-spec | gemäß Migrations-Mapping (Sektion 6) |
| Domain | /write-spec | write-spec | gemäß Migrations-Mapping (Sektion 6) |
| Extends | /write-spec | write-spec | gemäß Migrations-Mapping (Sektion 6) |
| Status | jeder Lifecycle-Event | jeweilige Skill | bereits vorhanden |
| Spec | Filename-Konvention | write-spec | bereits vorhanden |
| Priority | /init oder /write-spec | init / write-spec | bereits vorhanden |
| Appetite | /write-spec | write-spec | `—` bei Deployed-Features |
| Bugs | /qa (am Ende, H:M:L) | qa | `—` bei Deployed-Features ohne strukturierte Bug-History |

**Hard Rules** (in `general.md` verankert):

1. `Appetite` muss spätestens beim Übergang zu Status=Architected gefüllt sein.
2. `Bugs` muss spätestens beim Übergang zu Status=Approved gefüllt sein.
3. `Type`, `Domain`, `Extends` müssen ab Status=Planned gefüllt sein.
4. Eine Skill, die einen Status-Übergang vollzieht, muss vorher prüfen, ob alle Hard Rules erfüllt sind. Wenn nicht: abbrechen und User informieren.
5. Eine Skill, die ein Feld setzt, muss das Write-Then-Verify-Muster aus `general.md` befolgen (Read → Edit → Re-read).

### 6. Migrations-Mapping (alle 17 bestehenden Features)

| ID | Feature | Type | Domain | Extends |
|----|---------|------|--------|---------|
| PROJ-1 | Auth + Workspace | Epic | Platform | — |
| PROJ-2 | Interview Engine Backend | Epic | Interview Engine | — |
| PROJ-3 | Interview UI | Feature | Interview Engine | — |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Epic | Wissensbank | — |
| PROJ-5 | Prozessschritt-Anreicherung | Feature | Wissensbank | — |
| PROJ-6 | Use Case Identifikation | Epic | Use Case Engine | — |
| PROJ-7 | Voice Input (Interview) | Extension | Interview Engine | PROJ-3 |
| PROJ-8 | Interview-Design Optimierung | Revision | Interview Engine | PROJ-2 |
| PROJ-9 | LLM Provider Optimierung | Feature | Platform | — |
| PROJ-10 | Access Control & Shared Workspace | Feature | Platform | — |
| PROJ-11 | Interview PDF Report | Feature | Dashboard & Output | — |
| PROJ-12 | Rate Limiting | Feature | Platform | — |
| PROJ-13 | LLM Observability & Tracing | Feature | Platform | — |
| PROJ-14 | Embedding-Modell Auswahl | Extension | Wissensbank | PROJ-4 |
| PROJ-15 | CSP Hardening | Feature | Platform | — |
| PROJ-16 | Supabase Hardening + Dependency Hygiene | Feature | Platform | — |
| PROJ-17 | Adaptive Eval-Harness + Start-Endpoint | Feature | Interview Engine | — |

**Anmerkungen:**
- **PROJ-6** wird zu Epic hochgestuft (Use Case Engine bekommt eigene Sub-Features).
- **PROJ-13** war im ursprünglichen Entwurf als Extension mit drei Extends markiert. Korrigiert zu Feature (Sektion 2 erlaubt nur ein Extends; Cross-Cutting bleibt Feature).
- **PROJ-15** Status bleibt Blocked (Sektion 3).
- **PROJ-17** ist argumentativ auch eine Extension von PROJ-8 denkbar. Entscheidung: eigenständiges Feature, weil Eval-Harness wiederverwendbare Infrastruktur ist, nicht nur Interview-Design erweitert.

### 7. Entscheidungsregel: Was braucht ein neues PROJ-X?

```
Kleiner Fix (kein PROJ-X):
  → Bugfix, Prompt-Tweaking, Parameter-Änderung, Dependency-Update
  → Vorgehen: Implementation Notes in bestehender Spec ergänzen
  → Faustregel: "Würde ich das separat rückgängig machen wollen?" — Nein → kein PROJ-X

Extension (neues PROJ-X, Extends=PROJ-Y):
  → Neue nutzersichtbare Fähigkeit, die ein bestehendes Feature ergänzt ohne es zu ersetzen
  → Braucht eigene Acceptance Criteria + QA + Deployment
  → Beispiel: Voice Input ergänzt Interview UI

Revision (neues PROJ-X, Extends=PROJ-Y):
  → Umfangreiche Überarbeitung, die bestehendes Verhalten ändert oder ersetzt
  → Bestehende Spec bekommt Vermerk: "Kernverhalten überarbeitet durch PROJ-X"
  → Beispiel: PROJ-8 überarbeitet PROJ-2

New Feature / Epic (kein Extends):
  → Neue Capability, die nicht als Erweiterung einordbar ist
  → Oder: erstes Feature einer neuen Domain
  → Oder: Cross-Cutting (Observability, Rate Limiting, Security)
```

### 8. Lernmechanismus: Post-Mortem + /retro

**Post-Mortem-Sektion in jeder Feature-Spec** (Template-Skeleton, /deploy füllt aus):

```markdown
## Post-Mortem
| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High / Medium / Low |
| Appetite vs. tatsächlich | geschätzt: X / tatsächlich: Y |
| Größte Überraschung | [ein Satz] |
| Vorgeschlagene Regeländerung | [optional, sonst „—"] |
| Build-Loop-Iterationen | tatsächlich: X (geplant: ≤Y) |
| Häufigste Fehlerkategorie im Loop | TypeScript / Test / Tool-Call / Spec-Lücke / „—" |
```

**Begründung für die zwei Trajectory-Felder:** Die ersten vier Aspekte sind Outcome-Metriken (Was kam raus?). Die letzten zwei sind Trajectory-Metriken (Wie sah der Weg dorthin aus?). Ein Feature kann ein gutes Outcome haben und trotzdem einen unsauberen Pfad, der für /retro lehrreich ist (z.B. 12 Build-Loop-Iterationen wegen wiederholter Tool-Call-Fehler signalisiert ein Skill- oder Definitionsproblem, das ohne Trajectory-Erfassung unsichtbar bleibt).

**Rule Provenance** (Konvention für `.claude/rules/`):

```markdown
<!-- source: PROJ-7 (2026-05-20) — ElevenLabs-Token-Auth nicht in Spec abgedeckt, BUG-04 -->
```

Bestehende Regeln ohne Provenance-Kommentar werden ergänzt, wenn /retro sie als relevant identifiziert.

**`/retro` Command** (neue Datei `.claude/commands/retro.md`):
Liest Post-Mortems der letzten N deployten Features, synthetisiert Muster (recurring Bug-Kategorien, Spec-Abweichungen), schlägt Änderungen an `.claude/rules/` vor, User genehmigt einzeln.

**/retro-Reminder in /deploy** (Disziplin-Sicherung):
`/deploy` prüft am Ende: "Wann war der letzte /retro-Lauf? Wenn ≥3 Deploys seitdem: User reminden, /retro auszuführen." Schwellwert 3 als Default, später anpassbar.

### 9. Scout-First für Debugging und QA (konkretisierte Trigger)

Konkrete Trigger für Scout-Spawn (jeder einzelne reicht):

- **2 erfolglose Fix-Versuche** am selben Symptom: der dritte Versuch startet zwingend mit Scout-Recherche.
- **Stack Trace mit Fehler in externem Modul** (node_modules, Supabase-Client, AI SDK): Scout sucht bekannte Issues und Doku.
- **Fehler an System-Schnittstelle** (API-Route, WebSocket, Supabase RPC, Third-Party-Webhook), wenn der im Branch angefasste Code das nicht erklärt: Scout vor weiteren Fix-Versuchen.
- **Verhalten unterscheidet sich zwischen lokal und Produktion** ohne erkennbaren Code-Unterschied.

Trigger werden in `general.md` (allgemein) und `qa/SKILL.md` (Bug-Reproduktions-Phase) verankert.

### 10. Agent-Awareness: Single Source of Truth in general.md

Folgende Definitionen kommen in `general.md` unter "Feature Tracking" bzw. "Approval Gates". Da alle Skills `general.md` lesen, ist keine Änderung an jedem einzelnen Skill-File für die Definitions-Kenntnis nötig:

- Felddefinitionen Domain, Type, Extends, Appetite, Bugs, Status inklusive Blocked
- Bookkeeping-Regeln und Hard Rules aus Sektion 5
- Approval-Gates-Liste aus Sektion 11

Konkrete Skill-Änderungen sind trotzdem nötig für aktive Felder und Gates:

- **`write-spec/SKILL.md`**: fragt Domain/Type/Extends/Appetite explizit beim Spec-Schreiben ab.
- **`write-spec/template.md`**: vollständige Überarbeitung (nicht "minimaler Zusatz"). Header mit allen v2-Feldern, Post-Mortem-Skeleton inklusive der zwei Trajectory-Felder aus Sektion 8.
- **`qa/SKILL.md`**: Scout-First-Trigger aus Sektion 9, H:M:L-Bug-Tally am QA-Ende.
- **`deploy/SKILL.md`**: Post-Mortem ausfüllen, /retro-Reminder, Ablauf strukturiert nach G1-G4 aus Sektion 12.
- **`backend/SKILL.md`** und **`deploy/SKILL.md`**: Verweis auf Approval-Gates-Liste (Sektion 11), Pflicht bei Operationen aus der Liste.

### 11. Approval Gates (Human-in-the-Loop)

CLAUDE.md formuliert HITL bisher nur generisch ("All workflows have user approval checkpoints"). In der Praxis ist unklar, welche Operationen explizit User-Approval erfordern. Das führt dazu, dass Skills mal nachfragen, mal nicht.

**Explizite Liste der Operationen, die zwingend User-Approval vor Ausführung erfordern:**

| Operation | Begründung |
|-----------|-----------|
| Supabase Schema-Änderung (`apply_migration`, direkte SQL-Writes über Service Role) | Unumkehrbar oder nur mit Datenmigration rollbackbar |
| Production-Deploy (Vercel `--prod`, Domain-Promote) | Unmittelbar nutzersichtbar, Rollback mit Latenz |
| Löschen oder Umbenennen von Dateien in `features/`, `docs/`, `.claude/`, `src/` | Risiko von Datenverlust und Workflow-Bruch |
| `git push --force`, Branch-Delete, `git reset --hard` mit lokalen Änderungen | Datenverlust |
| API-Key-Rotation, Änderung von Environment-Variablen in Produktion (`vercel env`) | Auswirkung auf Live-System |
| Dependency-Major-Upgrade in `package.json` | Breaking-Change-Risiko |
| Skip von Pre-Commit-Hooks (`--no-verify`) | Umgeht Qualitäts-Gates |

**Hard Rule:** Eine Skill, die eine dieser Operationen ausführen will, muss vorher per Tool (z.B. `AskUserQuestion` oder explizite Bestätigungsabfrage) eine Freigabe einholen. Eine einmalige Freigabe für eine Operation gilt nur für deren aktuellen Aufruf, nicht für nachfolgende gleichartige Aufrufe.

**Verankerung:** Liste in `general.md` unter neuer Sektion "Approval Gates". Da alle Skills general.md lesen, ist keine Änderung pro Skill nötig. Skills, die heute schon Risikoaktionen ausführen (`/deploy`, `/backend`), erhalten in ihrer SKILL.md einen Verweis auf die Liste.

### 12. Pre-Deploy Verification Gates (G1-G4)

`/deploy` führt heute eine implizite Checkliste aus (Lint, Build, Tests). Die Reihenfolge ist nicht festgeschrieben, einzelne Schritte können bei Erfolg übersprungen werden. Risiko: Deploys, bei denen eine Stufe geräuschlos übersprungen wurde.

**Vier explizite Gates, sequenziell, jedes muss grün sein bevor das nächste startet:**

| Gate | Inhalt | Tools |
|------|--------|-------|
| **G1 Static** | Lint, TypeScript-Check, Security-Header-Konfiguration prüfen | `npm run lint`, `tsc --noEmit`, Header-Check |
| **G2 Tests** | Unit- und Integrationstests; E2E-Tests bei UI-Änderung | `npm test`, `npm run test:e2e` |
| **G3 Sandbox** | Vercel Preview-Deploy plus Smoke-Test gegen Preview-URL | `vercel deploy` (preview), HTTP-Check auf Hauptrouten |
| **G4 Permissions** | Security-Audit: RLS-Policies, Rate Limits, Env-Var-Lecks | `/security` Skill, RLS-Check via Supabase MCP |

**Hard Rules:**
1. Ein fehlgeschlagenes Gate stoppt den Deploy. Kein Überspringen, kein "ignorieren und weiter".
2. Bei UI-Änderung (Heuristik: Diff in `src/app/` oder `src/components/`) ist G2 inklusive E2E-Tests Pflicht.
3. G4 ist Pflicht bei Änderungen an Auth, RLS-Policies, API-Routen oder LLM-Endpoints.
4. Das Ergebnis jedes Gates wird in der Deployment-Sektion der Spec protokolliert (G1: pass/fail, G2: pass/fail, …).

**Verankerung:** `deploy/SKILL.md` strukturiert seinen Ablauf explizit nach G1-G4. Die Hard Rules stehen dort als Pre-Conditions.

### 13. Migration bestehender Specs

**Header-Backfill für alle 14 Deployed-Specs**: Type, Domain, Extends laut Sektion 6 ergänzen. Aufwand etwa 30 Minuten einmalig.

**Post-Mortem-Backfill: nicht erforderlich**. Post-Mortem-Sektion bleibt mit Skeleton vorhanden, alle Felder "—" und ein Hinweis "ohne Backfill, vor v2-Migration deployed". Begründung: Rückwirkende Post-Mortems würden Spekulation produzieren. /retro ignoriert leere Post-Mortems.

**Appetite und Bugs für Deployed-Features bleiben "—"**. Werte werden erst ab dem nächsten neuen Feature (PROJ-18) gepflegt.

## Consequences

**Positiv:**
- Klare Unterscheidung zwischen Erweiterung und Neuentwicklung reduziert Fehlklassifizierungen.
- Domain-Gruppierung macht INDEX.md bei 30+ Features lesbar.
- Bookkeeping-Tabelle (Sektion 5) macht für jeden Agent eindeutig, welches Feld wann zu setzen ist. Reduziert Confusion.
- Post-Mortem plus /retro plus /deploy-Reminder schließt den Lernkreislauf systematisch und sichert Disziplin.
- Trajectory-Felder im Post-Mortem (Sektion 8) machen Pfad-Qualität messbar, nicht nur Outcome.
- Scout-First mit konkreten Triggern reduziert "Raten" bei Debugging und QA.
- Approval-Gates-Liste (Sektion 11) macht HITL-Pflicht eindeutig, statt diffus.
- G1-G4-Gates im Deploy (Sektion 12) verhindern stillschweigendes Überspringen von Verifikationsschritten.
- Bloat-Reduktion: `features/README.md` wird gelöscht.

**Negativ:**
- Header-Backfill von 14 bestehenden Specs ist einmaliger Aufwand (etwa 30 Minuten).
- Post-Mortem-Pflicht erhöht Aufwand nach jedem Deploy (geschätzt 5 Minuten).
- INDEX.md mit 10 Spalten wird breit. Bei Bedarf später visuell trennen (aktive Features oben, Deployed-Archiv unten).
- Approval-Gates-Liste muss aktiv gepflegt werden, wenn neue Risikoaktionen dazukommen (z.B. neue MCP-Tools).

**Netto-Bilanz der Implementierung:**
- **+1 neue Datei**: `.claude/commands/retro.md`
- **-1 Datei**: `features/README.md`
- **8 modifizierte Dateien**: `.claude/rules/general.md`, `features/INDEX.md`, `.claude/skills/write-spec/template.md`, `.claude/skills/write-spec/SKILL.md`, `.claude/skills/qa/SKILL.md`, `.claude/skills/deploy/SKILL.md`, `.claude/skills/backend/SKILL.md` (nur Approval-Gates-Verweis), plus Header-Backfill in den 14 Deployed-Specs.
- **Gegen ursprünglichen Entwurf gestrichen**: `features/DOMAINS.md` (redundant zu general.md), `docs/CHANGELOG.md` (Zweck unklar).

**Folgeentscheidungen:**
- Nach etwa 5 deployten Features ab v2: erster /retro-Lauf, Muster evaluieren.
- Bei neuer Domain (z.B. Integrations): `general.md` updaten, kein neues ADR nötig.
- Wenn Appetite-Schätzungen systematisch falsch liegen: Kalibrierung diskutieren (ADR-005?).

---

## Appendix A: Migrations-Plan (informativ, nicht-normativ)

> Dieser Plan ist Teil des ADR zur Übersicht. Er ist **keine normative Entscheidung** und kann während der Umsetzung angepasst werden, ohne den ADR-Status zu berühren. Nach Abschluss aller Phasen wird hier "ABGESCHLOSSEN am YYYY-MM-DD" vermerkt.

**Reihenfolge ist zwingend.** Jeder spätere Schritt setzt die Definitionen des vorherigen voraus. Ein vorgezogenes Phase 4 würde z.B. Felder abfragen, die noch nirgends definiert sind.

### Phase 0: ADR finalisieren
- ADR-Inhalt überarbeiten, Status auf "Accepted" setzen.
- **Commit:** `docs(adr): ADR-004 Feature Tracking v2 (finalized)`
- **Validierung:** Datei existiert, Status=Accepted, alle 13 Sektionen vorhanden.

### Phase 1: Definitionen in general.md (Single Source of Truth)
- Sektion "Feature Tracking" in `.claude/rules/general.md` ergänzen:
  - 5 Domains (Sektion 1)
  - 4 Typen (Sektion 2)
  - Status-Modell inklusive Blocked (Sektion 3)
  - Bookkeeping-Regeln und Hard Rules (Sektion 5)
- Neue Sektion "Approval Gates" in `.claude/rules/general.md` ergänzen mit der Liste aus Sektion 11 (7 Operationen + Hard Rule).
- `features/README.md` löschen.
- **Commit:** `docs(tracking): v2 definitions + approval gates in general.md, remove stale README`
- **Validierung:** `grep -A 5 "Domain" .claude/rules/general.md` liefert die 5 Domain-Namen. `grep "Approval Gates" .claude/rules/general.md` liefert die Sektion. `features/README.md` existiert nicht mehr.

### Phase 2: INDEX.md migrieren
- Spalten umstellen auf die 10 aus Sektion 4.
- Alle 17 Features klassifizieren laut Migrations-Mapping (Sektion 6).
- Appetite und Bugs für Deployed-Features auf "—".
- **Commit:** `docs(tracking): migrate INDEX.md to v2 schema`
- **Validierung:** `head -3 features/INDEX.md` zeigt 10 Spalten. Zeilen-Count = 17 Features + Header. Jede Zeile hat Type und Domain gesetzt.

### Phase 3: Spec-Header-Backfill (14 Deployed-Specs)
- Jede Deployed-Spec (PROJ-1 bis 14 außer PROJ-9 und PROJ-13 die Planned/Roadmap sind): Header um Type/Domain/Extends/Appetite="—"/Bugs="—" ergänzen.
- Post-Mortem-Sektion am Ende: leerer Skeleton mit Hinweis "ohne Backfill, vor v2-Migration deployed".
- **Commit:** `docs(tracking): backfill v2 headers in deployed specs`
- **Validierung:** Alle Deployed-Specs enthalten `Type:` im Header und `## Post-Mortem` im Body.

### Phase 4: Template + Skill-Updates
- `.claude/skills/write-spec/template.md`: vollständig neu schreiben mit allen v2-Feldern im Header und Post-Mortem-Skeleton inklusive der zwei Trajectory-Felder (Sektion 8).
- `.claude/skills/write-spec/SKILL.md`: Domain/Type/Extends/Appetite explizit abfragen.
- `.claude/skills/qa/SKILL.md`: Scout-First-Trigger (Sektion 9), H:M:L-Bug-Tally.
- `.claude/skills/deploy/SKILL.md`: Post-Mortem ausfüllen (inkl. Trajectory-Felder), /retro-Reminder ab 3 Deploys, Ablauf strukturiert nach G1-G4 (Sektion 12) mit Hard Rules, Verweis auf Approval Gates (Sektion 11).
- `.claude/skills/backend/SKILL.md`: Verweis auf Approval Gates (Sektion 11) bei DB-Schema-Änderungen, Env-Var-Änderungen, Dependency-Upgrades.
- **Commit:** `feat(tracking): wire v2 schema + gates into write-spec/qa/deploy/backend`
- **Validierung:**
  - Mit einer Test-Spec (Dummy-Feature, danach löschen) /write-spec durchspielen. Alle neuen Felder werden abgefragt.
  - `grep -E "G1|G2|G3|G4" .claude/skills/deploy/SKILL.md` zeigt die vier Gates.
  - `grep "Approval Gates" .claude/skills/backend/SKILL.md .claude/skills/deploy/SKILL.md` liefert je einen Treffer.

### Phase 5: /retro Command
- `.claude/commands/retro.md` erstellen.
- Erster Test-Lauf gegen Deployed-Features. Erwartete Ausgabe: "noch keine Post-Mortem-Daten verfügbar".
- **Commit:** `feat(tracking): add /retro command`
- **Validierung:** /retro existiert als Slash-Command und liefert sinnvolle Leeranzeige.

### Phase 6: Closure
- Appendix A unten ergänzen: "ABGESCHLOSSEN am YYYY-MM-DD".
- **Commit:** `docs(adr): mark ADR-004 migration complete`

### Rollback-Strategie

| Phase | Rollback |
|-------|----------|
| 0-2 | `git revert` des jeweiligen Commits, isoliert möglich |
| 3 | `git revert`, betrifft nur Spec-Dateien |
| 4 | `git revert`, aber wenn Phase 5 schon passiert ist, /retro vorher zurückrollen |
| 5 | `git revert`, löscht nur die Command-Datei |

### Bullet-Proof-Garantien für den Workflow

Diese Punkte sind explizit so gewählt, dass der Workflow nach der Migration mindestens so gut läuft wie vorher:

1. **Phase 1 vor Phase 4**: Definitionen existieren in general.md, bevor Skills sie abfragen. Kein Agent landet in einem "Frage nach undefiniertem Feld"-Zustand. Approval-Gates-Liste existiert ebenfalls vor allen Skill-Verweisen darauf.
2. **Hard Rules in Sektion 5**: Status-Übergänge sind nur erlaubt, wenn die zugehörigen Felder gefüllt sind. Skills brechen ab statt halbleere States zu produzieren.
3. **"—" als gültiger Wert** für noch nicht gesetzte Felder: keine Skill schlägt fehl, weil ein Feld leer ist, solange das Lifecycle-Event noch nicht erreicht wurde.
4. **Backfill nur für Header, nicht Post-Mortem**: keine erfundenen Daten. /retro funktioniert auch mit leeren Post-Mortems (ignoriert sie).
5. **Phase 4 mit Test-Spec validiert**: bevor produktiv genutzt, einmal mit Wegwerf-Feature durchgespielt.
6. **Phase 5 mit Leerlauf-Test**: /retro wird auch dann nicht crashen, wenn keine Post-Mortems vorhanden sind.
7. **Approval Gates sind eine Liste, kein Bauchgefühl**: Sektion 11 enumeriert die Risikoaktionen. Skills haben eine eindeutige Pflicht-Prüfung statt diffuser "approval checkpoints".
8. **G1-G4 sind sequenziell und blockierend**: ein fehlgeschlagenes Gate stoppt /deploy. Kein Überspringen möglich, das Ergebnis jedes Gates wird protokolliert (Audit-Spur in der Spec).
9. **Trajectory- und Outcome-Felder im Post-Mortem getrennt**: schlechte Pfade mit gutem Outcome werden für /retro sichtbar, statt unterzugehen.

---

**Migrations-Status:** In Arbeit (Stand 2026-05-24).

| Phase | Status | Commit |
|-------|--------|--------|
| 0 — ADR finalisieren | ✅ Abgeschlossen | `docs(adr): ADR-004 Feature Tracking v2 (finalized)` |
| 1 — Definitionen in general.md | ✅ Abgeschlossen | `d833974` — 5 Domains, 4 Typen, Bookkeeping-Regeln, Approval Gates; README archiviert |
| 2 — INDEX.md migrieren | ✅ Abgeschlossen | `c9fcfed` — 10 Spalten, alle 17 Features klassifiziert |
| 3 — Spec-Header-Backfill | ✅ Abgeschlossen | `d607080` — Type/Domain/Extends/Appetite/Bugs + Post-Mortem-Skeleton in allen 17 Specs |
| 4 — Template + Skill-Updates | 🔲 Offen | write-spec/template.md, write-spec/SKILL.md, qa/SKILL.md, deploy/SKILL.md, backend/SKILL.md |
| 5 — /retro Command | 🔲 Offen | .claude/commands/retro.md erstellen |
| 6 — Closure | 🔲 Offen | Appendix A "ABGESCHLOSSEN"-Vermerk |

**Nächster Schritt:** Phase 4 — Template + Skill-Updates.
