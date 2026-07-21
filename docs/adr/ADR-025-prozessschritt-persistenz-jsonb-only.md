# ADR-025: Prozessschritt-Persistenz — JSONB-only statt Flach-Spalten (PROJ-45)

**Status:** Proposed (2026-07-21)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** PROJ-45 (`/architecture` + `/grilling`, 2026-07-21). PROJ-25/26/27 hatten das Conversation-State-Schema (`interview_state.step_tracker`) bereits auf die einheitliche `{wert, konfidenz, nicht_befund_typ}`-Form gebracht — die Persistenz-Schicht (`process_steps`) blieb dabei auf den ursprünglichen MVP-Flach-Spalten (`rule_based`, `data_sources`, `friction_points`, …) stehen, verbunden über eine verlustbehaftete Übersetzungsschicht (`coerceRuleBased`/`coerceMediaBreaks` in `processEnrichment.ts`). PROJ-45 schließt diese Lücke und ergänzt fünf neue AI-Wert-Faktoren-Felder.
**Betrifft:** PROJ-45 (Wissensbank, Extends PROJ-25). Berührt als Downstream-Konsument PROJ-6/24 (Use Case Engine), PROJ-11 (PDF-Report), PROJ-23 (Clarification Cards) — keine Neugestaltung ihrer eigenen Logik, nur Konsum-Anpassung.
**Realisiert durch:** `/backend PROJ-45` (noch offen).

---

## Context

`interview_state.step_tracker` (JSONB, Conversation-State) und `process_steps` (Postgres-Tabelle, Persistenz für Use-Case-Engine/Dashboard/Reports) trugen bisher zwei strukturell verschiedene Formen derselben Information:

- `step_tracker`: verschachteltes Objekt mit `{wert, konfidenz, nicht_befund_typ}`-Slots (PROJ-25/26/27), inkl. Governance-Objekt, getypten Abhängigkeitskanten, Konfidenz- und Nicht-Befund-Semantik.
- `process_steps`: neun MVP-Ära-Flach-Spalten (`frequency_per_month`, `duration_minutes`, `data_sources`, `rule_based`, `error_rate_percent`, `media_breaks`, `friction_points`, `friction_tools`, `walkthrough_steps`) plus `role`. Kein Platz für Konfidenz, Nicht-Befund-Typ oder strukturierte Abhängigkeiten — `abhaengigkeiten` erreicht die Tabelle bis heute überhaupt nicht.

Die Übersetzung zwischen beiden Formen lief über verlustbehaftete Coercion-Funktionen (`coerceRuleBased`: Freitext → Bool per Blocklist-Heuristik; `coerceMediaBreaks`: Freitext → Int per Regex-Tabelle) — beide bereits als technische Schuld in PROJ-45s Spec dokumentiert. Zusätzlich: `process_steps.role` wurde aus dem jetzt entfallenden Governance-Objekt befüllt, aber empirisch nur bei 4 von ~20 echten Schritten je gesetzt.

PROJ-45 erweitert das Schema um fünf neue Felder (`aufgabentyp`, `risiko_schwere`, `ausloeser`, `standardisierungsgrad`, `informationsdichte`) und ein aktiv verfolgtes `reibungspunkte`. Eine reine Fortschreibung des Flach-Spalten-Musters hätte ~15 neue Spalten bedeutet (einige davon selbst wieder mehrteilig: wert/konfidenz/nicht_befund_typ je Feld) und die Übersetzungsschicht vergrößert statt beseitigt.

Live-DB-Prüfung (Supabase MCP, 2026-07-21) bestätigte zusätzlich: keine bestehende Downstream-Logik nutzt SQL-seitiges Filtern oder Sortieren auf den betroffenen Feldern (`processStepsAggregation.ts`/`useCaseEngine.ts` laden die Zeilen und aggregieren in JavaScript). Der einzige Nutzer von Einzelspalten-Zugriff außerhalb dieser beiden Dateien ist der manuelle PATCH-Endpoint (`process-steps/[id]/route.ts`) für UI-Inline-Edits — der in PROJ-45s ursprünglicher Downstream-Dateiliste fehlte und während der Architektur-Session nachgetragen wurde.

## Decision

### D1 — Ein JSONB-Feld (`schritt_daten`) ersetzt zehn Flach-Spalten

`process_steps` bekommt ein neues Feld `schritt_daten` (jsonb), das die exakt gleiche Objektform trägt wie ein `step_tracker`-Eintrag — keine Übersetzung, keine Zerlegung. Die zehn betroffenen Flach-Spalten (`role`, `frequency_per_month`, `duration_minutes`, `data_sources`, `rule_based`, `error_rate_percent`, `media_breaks`, `friction_points`, `friction_tools`, `walkthrough_steps`) entfallen ersatzlos. `id`, `interview_id`, `workspace_id`, `title`, `description`, `source_quote`, `step_type`, `condition_text`, `substeps`, `cluster_id`, `embedding`, `created_at` bleiben unverändert (LLM-Anreicherung, Clustering, Vektor-Suche — kein O-Feld, nicht betroffen).

`interview_state.step_tracker` und `process_steps.schritt_daten` bleiben zwei Speicherorte (Write-Model vs. Read-Model — `step_tracker` ist das unveränderte Protokoll dessen, was im Interview gesagt wurde, `schritt_daten` die eigenständig korrigierbare, cross-interview-joinbare Materialisierung), aber **eine Objektform**. Kein Übersetzungscode zwischen ihnen nötig.

### D2 — Governance entfällt, `role`-Spalte wird ersatzlos entfernt

`rolle`/`organisationseinheit` werden künftig aus `interviews.employee_role`/`department` bezogen (einmal pro Interview). Das `governance`-Objekt entfällt aus dem Schritt-Schema, `record_governance` als Tool entfällt, `process_steps.role` wird entfernt statt nur leergelassen (keine tote Spalte). Der Edge Case "eine andere Person als der Interviewte führt diesen einzelnen Schritt aus" wird ab Deploy nicht mehr unterschieden.

**Geprüft und nicht betroffen (User-Rückfrage 2026-07-21):** Freigabe-/Genehmigungspflichten durch eine externe Stelle (z.B. "Geschäftsführung muss ab 50.000 € freigeben") sind kein Governance-Fall, sondern eine Verzweigungsregel — sie liegen bereits heute in `entscheidungslogik`, nicht in `governance.rolle`. Live-DB-Beleg (2026-07-21): der einzige reale Freigabe-Fund in den Interview-Daten (`entscheidungslogik` = *"Genehmigung durch IT-Leitung und Jira-Ticket sind zwingend erforderlich."*) steht in `entscheidungslogik`; alle drei real gefüllten `governance.rolle`-Werte sind reine Ausführer-Labels ("Buchhalter", "Andreas Meier (Buchhalter)"), keine Freigabe-Angaben. Governance-Streichung verliert diesen Fall also nicht.

### D3 — `COVERAGE_FIELDS` und `O_SLOT_FIELDS` werden zu unabhängigen Konstanten

`COVERAGE_FIELDS` (9 Felder inkl. `tazite_cues`, akademische `dedup_slot_coverage`-Eval-Metrik, an das in `meridian-ma` eingefrorene Thesis-Schema v1.2 gebunden) bleibt **unverändert**. `O_SLOT_FIELDS`/`target_o_field` (Interview-Engine-Ziel-Feld-Menge, steuert was der Talker aktiv turn-für-turn verfolgt, PROJ-46) ändert sich: `−tazite_cues`, `+reibungspunkte/aufgabentyp/risiko_schwere/ausloeser` (7 → 10 Felder). Beide Listen sind im Code aktuell voneinander abgeleitet (`O_SLOT_FIELDS` = `COVERAGE_FIELDS` minus zwei Infrastrukturfelder) — das wird zu zwei unabhängigen Konstantenlisten, da sich die Mengen nach PROJ-45 nicht mehr decken. Ohne diese explizite Trennung bricht entweder die Eval-Vergleichbarkeit mit der historischen KI-18/KI-27-Befundlage, oder die neuen Felder werden vom Talker nie aktiv erfragt.

### D4 — `update_walkthrough_data` entfällt, `teilschritte` wird `record_slot`-Array-Slot

Mit `friction_tools` gestrichen, `pain_point_primary` gestrichen und `friction_points` (jetzt `reibungspunkte`) auf den `record_slot`-Pfad migriert, bleibt für `update_walkthrough_data` nur noch `teilschritte` (umbenannt von `process_steps`, Namenskollision mit der Postgres-Tabelle) übrig. `teilschritte` wird ein regulärer additiver Array-Slot in `record_slot`, wie `tazite_cues`/`ausnahmen`/`inputs`/`outputs`/`hilfsmittel` bereits additiv sind — ein Feld allein rechtfertigt keinen eigenen Tool-Adapter.

### D5 — Einheiten-Unabhängigkeit für Häufigkeit/Dauer

`SchemaSlotNumber` bekommt ein optionales `einheit`-Feld statt eines impliziten Fixwerts (`potenzial.haeufigkeit_pro_monat` z.B. `{wert: 3, einheit: 'pro_woche', …}` statt vorab auf "pro Monat" normalisiert). Umrechnung auf eine kanonische Einheit passiert deterministisch im Code zur Nutzungszeit (ROI-Berechnung, Reports), nie durch das Sprachmodell zum Erhebungszeitpunkt. Struktur-Erweiterung des bestehenden Typs, kein neuer.

### D6 — `aufgabentyp`/`risiko_schwere` aktiv erfragt, `standardisierungsgrad`/`informationsdichte` klassifiziert

`aufgabentyp` und `risiko_schwere` sind Teil des aktiven `target_o_field`-Sets (eigene Frage, eigener `SLOT_PROMPT_HINT`-Eintrag). `standardisierungsgrad` und `informationsdichte` werden vom Analyst aus bereits erhobenen `ausnahmen`/`inputs`/`hilfsmittel`-Antworten klassifiziert, ohne eigene Frage. Diese Asymmetrie wurde explizit geprüft (nicht implizit übernommen) und bestätigt: eine stille Fehlklassifikation von `aufgabentyp`/`risiko_schwere` fließt direkt in die ROI-Priorisierung ein — höhere Fehlerkosten als bei den rein deskriptiven Klassifikations-Feldern rechtfertigen die gezielte Nachfrage trotz zweier zusätzlicher Interview-Fragen.

Werteskalen: `standardisierungsgrad` ∈ {standardisiert, teilweise_standardisiert, stark_variabel}; `informationsdichte` ∈ {strukturiert, gemischt, unstrukturiert} — 3-stufig kategorial statt numerischer Skala, da vom Analyst zuverlässiger aus ein bis zwei Sätzen ableitbar.

### D7 — Bewusste Divergenz vom eingefrorenen Thesis-Schema, keine Rückwirkung

`meridian-ma/schemas/prozessschritt-schema.json` (v1.2, "Kern eingefroren") führt weiterhin `governance` und kennt die fünf neuen AI-Wert-Faktoren-Felder nicht. `toGrenzobjekt()` (die bisherige Mapping-Funktion `StepEntry` → akademisches Schema) wird ersatzlos gestrichen. Diese Divergenz ist beabsichtigt, konsistent mit der DSR-Rahmung des Projekts (App-Code ist zitierter Vorlauf, nicht die Thesis-Grundlage selbst) — keine Migration oder Anpassung in `meridian-ma` als Teil dieser Entscheidung.

## Consequences

**Positiv:**
- Eine einzige Objektform für Conversation-State, Persistenz und Export — kein Übersetzungscode, kein Sync-Risiko zwischen unterschiedlich geformten Repräsentationen derselben Information.
- Vollständige, verlustfreie Persistenz aller aktiv erhobenen O-Felder inkl. Konfidenz/Nicht-Befund-Metadaten — fehlte bei `abhaengigkeiten` bisher komplett, war bei `rule_based`/`media_breaks` verlustbehaftet.
- Zehn Spalten und zwei Tools (`record_governance`, `update_walkthrough_data`) weniger zu pflegen.
- Einheiten-Umrechnungsfehler durch das Sprachmodell (KI-18s größte dokumentierte Einzelursache, 13/39 Grounding-Verletzungen) strukturell ausgeschlossen, nicht nur prompt-seitig gemildert.
- Eval-Vergleichbarkeit bleibt erhalten: `COVERAGE_FIELDS` unverändert, obwohl sich die Interview-Engine-Zielmenge weiterentwickelt.

**Negativ:**
- Der PATCH-Endpoint für manuelle Korrektur (`process-steps/[id]/route.ts`) wird von Spalten-Update auf Read-Merge-Write über das JSONB-Feld umgestellt — für den Nutzer unsichtbar, aber ein Stück Backend-Komplexität mehr als ein einfaches `.update()`.
- Governance-Wegfall verliert den Edge Case "anderer Ausführender pro Schritt als der Interviewte" (bewusst in Kauf genommen, empirisch selten: 4/20).
- Zukünftige SQL-seitige Aggregation über einzelne O-Felder (z.B. "häufigste Reibungspunkte workspace-weit") erfordert JSONB-Pfad-Queries statt einfacher Spalten-Aggregation, falls dieser Bedarf entsteht — aktuell nicht der Fall (verifiziert), aber ein grundsätzlicher Trade-off der Entscheidung.
- App-Schema und das in `meridian-ma` eingefrorene Thesis-Schema laufen ab hier bewusst auseinander — künftige Cross-Referenzierung zwischen Code und Thesis-Dokument muss diese Abweichung explizit machen, nicht stillschweigend voraussetzen.

**Folgeentscheidungen:**
- Postgres-Migration für `process_steps` (zehn Spalten löschen, `schritt_daten jsonb` hinzufügen) — kein Backfill, Altbestand bleibt wie erfasst.
- Bei künftigem SQL-Aggregationsbedarf über O-Felder: GIN-Index auf `schritt_daten` nachrüsten (nicht Teil dieser Entscheidung, aktuell kein Bedarf).
- `/backend PROJ-45` realisiert D1–D6.

## Alternatives Considered

1. **Alle O-Felder als eigene Spalten, erweitert (~30 Spalten).** Verworfen: widerspricht der Grundidee "keine übersetzende Zwischenschicht" am stärksten — jeder Schreibpfad müsste die Objektform in Einzelspalten zerlegen, jede künftige Schema-Änderung würde wieder eine Migration plus Übersetzungscode brauchen.
2. **Hybrid: JSONB-Feld plus denormalisierte Zahlen-Spalten für `potenzial` (frequency/duration/error_rate/media_breaks).** Verworfen: zwei Quellen für denselben Wert — genau das Sync-Risiko, das die konsolidierte Repräsentation vermeiden soll. Kein aktueller SQL-Bedarf, der die Denormalisierung rechtfertigt (verifiziert).
3. **Aktivitätsgraph/"AI Opportunity Object" als neues Schema-Grundmodell** (entkoppelte Many-to-many-Aktivitäten statt Schritt innerhalb eines Prozesses). Extern vorgeschlagen (Brainstorming-Review 2026-07-21), aber bereits vor PROJ-45 per Council-Verfahren (5 Perspektiven + Peer-Review + echte Interview-/Cluster-Datenprüfung) geprüft und verworfen: die reklamierte Cross-Prozess-Aggregation existiert bereits produktiv über `process_clusters` (PROJ-24, 68 reale Cluster in der Live-DB) als nachgelagerter Analyse-Pass, nicht als Schema-Fremdschlüssel nötig.
4. **`aufgabentyp`/`risiko_schwere` als Klassifikations-Felder** (abgeleitet statt erfragt, analog `standardisierungsgrad`/`informationsdichte`). Erwogen, verworfen: höhere Fehlerkosten bei stiller Fehlklassifikation, da beide Felder direkt in die ROI-Priorisierung einfließen — eine gezielte Frage ist hier die sicherere Wahl als bei den rein deskriptiven Klassifikations-Feldern.
5. **`process_steps.role`-Spalte behalten, nur nicht mehr befüllen.** Verworfen: tote, dauerhaft-null Spalte widerspricht der Projektregel gegen halbfertige/vestigiale Artefakte.

---

**Status-Hinweis:** Dieser ADR bleibt "Proposed", bis der User explizit auf "Accepted" wechselt. Nach "Accepted" nicht mehr editieren — bei späterer Änderung neuen ADR mit `Supersedes: ADR-025` anlegen.
