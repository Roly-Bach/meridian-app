# PROJ-26: Getypte Abhängigkeitskanten

## Status: Planned
**Type:** Extension
**Domain:** Wissensbank
**Extends:** PROJ-20
**Appetite:** M
**Bugs:** —
**Created:** 2026-06-16
**Last Updated:** 2026-06-16

## Kontext

Auf `StepEntry` selbst gibt es heute kein Abhängigkeitsfeld. Abhängigkeiten werden nur indirekt
über die prozessweite `cluster_id` (`processClustering.ts`) und die Freitext-Referenz `step_ref`
(pain_point → Schritt, `interviewAgent.ts:1083`) angenähert. PROJ-25 ergänzt `abhaengigkeiten` als
strukturierten Placeholder `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: ... | null } | null`
(initial `null`), damit der Coverage-Scorer das Feld zählen kann. PROJ-26 schärft die Element-Typen
der beiden Arrays zu konkreten, maschinell auswertbaren Kanten und führt das `record_dependency`-Tool
ein, mit dem der Interview-Agent Abhängigkeiten während der Erhebung einträgt (O6, REQ-006).

Kanten als Daten im JSON-Dokument, keine Graph-Datenbank (ADR-T008 Entscheidung 2).
O7 (prozessübergreifende Muster) ist für den Pilot vertagt (App-ADR-012 Deferred).
Die konkrete Feldrealisierung (`depends_on`/`influences`, Kantentypen) ist ADR-T008-Designhypothese
und im Zielschema `prozessschritt-schema.json` (Definitionen `Abhaengigkeiten`/`AbhaengigkeitsKante`/
`EinflussKante`) realisiert; REQ-006 selbst ist seit dem Neutralitäts-Audit (ADR-T014, 2026-06-15)
feldneutral formuliert.

BL-Item: BL-E1.2. REQ: REQ-006. Schema: `prozessschritt-schema.json` v1.2.

## Dependencies

- Requires: PROJ-25 (Prozesswissens-Schema): führt `abhaengigkeiten` als strukturierten Placeholder
  `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: ... | null } | null` in `StepEntry`
  ein; Coverage-Scorer wertet das Feld bereits
- Requires: PROJ-27 (Schema-Bindung + verlustfreie Speicherung): stabile Schritt-IDs (S001-Format)
  müssen existieren, damit Kanten-Referenzen keine Phantom-IDs enthalten
- Enables: PROJ-28 (Extraktions-Zuverlässigkeit): kann Kanten-Felder in Grounding-Check einbeziehen

> **Build-Reihenfolge:** PROJ-25 → PROJ-27 → PROJ-26 (umgestellt 2026-06-16).
> Ursprüngliche Reihenfolge war PROJ-25 → PROJ-26 → PROJ-27; die Umstellung vermeidet
> titel-basierte Zwischenreferenzen und Migrations-Schuld.

## User Stories

- Als Interview-Agent will ich zwei Prozessschritte durch eine getypte, gerichtete Kante verbinden
  können (Typ: Voraussetzung, Ressource, Auslöser, Einfluss, Terminierung), damit O6 erfüllbar ist
  — welcher Schritt setzt welchen voraus, welche Entscheidung beeinflusst welchen späteren Schritt.

- Als KI-Berater will ich nach Interviewabschluss über den Prozessschritt-Endpunkt sehen können,
  welche Abhängigkeiten das System erfasst hat, damit ich die Vollständigkeit des Prozessmodells
  beurteilen und gezielt Lücken nacherheben kann.

- Als System (Coverage-Messung) will ich `abhaengigkeiten` als befüllt zählen, sobald mindestens
  eine Kante vorliegt oder ein Nicht-Befund-Marker gesetzt ist, damit Coverage die
  Externalisierungs-Vollständigkeit korrekt ausdrückt (REQ-007, ADR-T011).

- Als Entwickler will ich konkrete TypeScript-Typen für `AbhaengigkeitsKante` und `EinflussKante`
  statt `unknown[]`, damit der Compiler Fehler bei falschen Typen findet und der Eval-Runner
  die Typen ohne Supabase-Import verwenden kann.

- Als Interview-Agent will ich beim Erfassen eines Schritts nach relevanten Abhängigkeiten zu
  bereits bekannten Schritten fragen können, damit das System nicht nur isolierte Schritte, sondern
  den Prozessfluss abbildet.

## Acceptance Criteria

### TypeScript-Typen (`interviewSemantic.ts`)

- [ ] `AbhaengigkeitsKante` definiert:
  `{ schritt_id: string; typ: 'voraussetzung' | 'ressource' | 'ausloeser'; beschreibung: string | null }`
- [ ] `EinflussKante` definiert:
  `{ schritt_id: string; typ: 'beeinflusst' | 'terminierung'; beschreibung: string | null }`
- [ ] `Abhaengigkeiten` definiert:
  `{ depends_on: AbhaengigkeitsKante[]; influences: EinflussKante[]; nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null }`
- [ ] `StepEntry.abhaengigkeiten` ist `Abhaengigkeiten | null`; schärft den PROJ-25-Placeholder, indem die
  Element-Typen von `depends_on`/`influences` von `unknown` zu `AbhaengigkeitsKante`/`EinflussKante`
  konkretisiert werden (die Objektstruktur `{ depends_on; influences; nicht_befund_typ }` steht bereits aus PROJ-25)
- [ ] Alle drei Typen sind in `interviewSemantic.ts` definiert (side-effect-free, kein server-only-Import)
- [ ] `schritt_id` verwendet das S001-Format aus PROJ-27; kein enum — Werte sind zur Laufzeit dynamisch

### `record_dependency`-Tool (`interviewAgent.ts`)

- [ ] Neues Tool `record_dependency` mit Parametern:
  - `source_step_id: string` — Schritt, auf dem die Kante eingetragen wird
  - `target_step_id: string` — referenzierter Schritt
  - `richtung: 'depends_on' | 'influences'`
  - `typ: string` — kantenspezifischer Typ (depends_on: voraussetzung/ressource/ausloeser; influences: beeinflusst/terminierung)
  - `beschreibung: string | null`
- [ ] Typ-Validierung: `depends_on`-Kante erlaubt nur `voraussetzung | ressource | ausloeser`;
  `influences`-Kante nur `beeinflusst | terminierung` — Fehler bei Mismatch
- [ ] Schreibt in `step_tracker[source_step_id].abhaengigkeiten.depends_on` bzw. `.influences`
- [ ] Idempotent: doppeltes Eintragen derselben Kante (gleiche IDs + Typ) fügt keinen Duplikat ein
- [ ] Fehler wenn `source_step_id` nicht im `step_tracker` existiert (kein Phantom-Schritt)
- [ ] Fehler wenn `target_step_id` nicht im `step_tracker` existiert (kein Phantom-Referenz)
- [ ] Fehler wenn `source_step_id === target_step_id` (Selbstreferenz nicht erlaubt)

### Nicht-Befund-Pfad

- [ ] `abhaengigkeiten` ist **kein** `SlotName` (PROJ-25 Z. 82), daher läuft der Nicht-Befund **nicht** über
  `record_slot`, sondern über den dedizierten Schreibpfad: `record_dependency` erhält einen Nicht-Befund-Modus
  (Aufruf ohne `target_step_id`/`richtung`/`typ`, mit `nicht_befund_typ='nicht_zutreffend' | 'unbekannt' | 'verweigert'`),
  der `step_tracker[source_step_id].abhaengigkeiten.nicht_befund_typ` setzt. `/architecture` entscheidet, ob das als
  Modus von `record_dependency` oder als eigenes Markierungs-Tool realisiert wird (analog Governance-Schreibpfad, PROJ-25 Z. 98)
- [ ] `nicht_befund_typ` ohne Kanten zählt als befüllt für Coverage (REQ-007)

### Coverage-Interaktion

- [ ] Die Befüllt-Logik für `abhaengigkeiten` bleibt unverändert aus PROJ-25 (Z. 89, kanonische Heimat):
  befüllt, wenn `depends_on.length ≥ 1` ODER `influences.length ≥ 1` ODER `nicht_befund_typ != null`.
  PROJ-26 definiert die Formel nicht neu, sondern verifiziert sie gegen die jetzt getypten Kanten
- [ ] Leere Arrays `[]` bei `nicht_befund_typ: null` zählen als unbefüllt (O8-Lücke)
- [ ] `slotCoverage.test.ts` erhält Testfälle für die getypten Kanten: Kante vorhanden → befüllt; leere Arrays
  → unbefüllt; `nicht_befund_typ` gesetzt → befüllt; alter PROJ-25-Placeholder (`unknown[]`-Elemente) wird beim Lesen toleriert (kein Crash)

### Agent-Prompt

- [ ] `formatStepTracker` zeigt `abhaengigkeiten` als unbefüllt an wenn leer und kein Nicht-Befund
- [ ] Minimales Prompt-Update: Analyst kennt `record_dependency` und die Typ-Enums; volle
  Gesprächsführungs-Überarbeitung ist PROJ-29

### Regressions-Wächter

- [ ] `npm test` grün nach Typ-Schärfung (keine `unknown[]`-Typen mehr)
- [ ] Bestehende `step_tracker`-Einträge mit PROJ-25-placeholder werden lesbar toleriert
  (backward-compat Lese-Logik, kein Crash bei fehlendem `abhaengigkeiten`-Feld)
- [ ] Replay-Regressions-Korpus (App-ADR-015) grün — Coverage-Werte für `abhaengigkeiten`
  ändern sich (von Lücke zu befüllt wenn Kanten vorhanden), das ist erwartetes Verhalten

## Edge Cases

- **Selbstreferenz:** `source_step_id === target_step_id` → Tool-Fehler mit Klartext-Nachricht.
- **Phantom-Referenz:** `target_step_id` existiert nicht im `step_tracker` → Tool-Fehler; Agent
  muss zuerst den Ziel-Schritt via `register_step` anlegen.
- **Zirkuläre Abhängigkeiten:** A→B und B→A ist technisch erlaubt (modelliert gegenseitige
  Abhängigkeit); keine Zirkel-Erkennung für MVP (O7 vertagt).
- **Mehrere Kanten zum selben Ziel mit unterschiedlichem Typ:** gültig. S001 kann
  `voraussetzung` und `ressource`-Beziehung zu S002 gleichzeitig haben.
- **Kante vor PROJ-27-IDs:** verhindert durch Build-Reihenfolge (PROJ-27 vor PROJ-26).
  Falls dennoch ein Schritt ohne S-ID-Format im step_tracker landet: Tool wirft Validierungsfehler.
- **Zu viele Kanten:** kein Limit für MVP; leeres Objekt `{ depends_on: [], influences: [],
  nicht_befund_typ: null }` gilt weiterhin als unbefüllt.
- **Rückwärtskompatibilität mit altem placeholder:** Sessions aus PROJ-25-Ära haben
  `abhaengigkeiten: { depends_on: unknown[]; influences: unknown[]; ... }` — die geschärften Typen
  in TypeScript müssen beim Lesen bestehender JSONB-Einträge keinen Crash verursachen.

## Technical Requirements

- Typen in `interviewSemantic.ts` — kein server-only-Import, damit Eval-Runner importieren kann
- `record_dependency` in `interviewAgent.ts` schreibt über denselben TOCTOU-sicheren Schreibpfad wie PROJ-27
  (read-prev → check → gezieltes `jsonb_set` auf den Array-Pfad `abhaengigkeiten.depends_on`/`.influences`),
  nicht als Voll-Dokument-Read-Modify-Write. Damit unterliegt das Anhängen zweier Kanten an denselben Schritt
  nicht der Lost-Update-Klasse, die PROJ-27 (REQ-015) für Slot-Writes behebt
- Kein neuer Supabase-Migration-Bedarf: Kanten leben im bestehenden `step_tracker`-JSONB-Feld

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
