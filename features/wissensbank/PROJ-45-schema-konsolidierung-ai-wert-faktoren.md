# PROJ-45: Schema-Konsolidierung + AI-Wert-Faktoren

## Status: In Review
**Type:** Revision
**Domain:** Wissensbank
**Extends:** PROJ-25
**Appetite:** XL
**Bugs:** 0:1:0
**Created:** 2026-07-20
**Last Updated:** 2026-07-22

## Dependencies
- Requires: PROJ-25 (Prozesswissens-Schema) — PROJ-45 überarbeitet dessen Schema direkt.
- Requires: PROJ-26 (Getypte Abhängigkeitskanten) — `abhaengigkeiten` wird unverändert übernommen, keine Konfidenz pro Kante in dieser Spec.
- Requires: PROJ-27 (Schema-Bindung + verlustfreie Speicherung) — `Schritt`/`SchemaSlot*` (bisher nur Export-Mapping für `schemaConformanceRate`) werden zur einzigen Repräsentation für Conversation-State, Persistenz und Export.
- Berührt als Downstream-Konsument (keine Neugestaltung ihrer eigenen Logik): PROJ-6/24 (Use Case Engine — ROI-Heuristiken lesen die neuen Felder), PROJ-11 (Interview PDF Report), PROJ-23 (Clarification Cards).

## Kontext / Warum diese Spec vor PROJ-43 kommt

PROJ-43 (Elicitation-Reorientierung) sollte ursprünglich zuerst gebaut werden. Vorrecherche ergab: ein Großteil der O2-O6-Tiefe, die im Interview erhoben wird, erreicht die persistente `process_steps`-Tabelle nie (nur `title/role/rule_based/data_sources/frequency_per_month/duration_minutes/error_rate_percent/media_breaks/friction_points/friction_tools/walkthrough_steps` werden geschrieben, `createProcessStepsFromTracker` in `processEnrichment.ts` lässt `tazite_cues/ausnahmen/inputs/outputs/abhaengigkeiten` fallen). Tiefere Elicitation (PROJ-43s Ziel) wäre bis zur Behebung dieser Lücke für Use-Case-Engine/Dashboard unsichtbar. Ein per Council-Verfahren (5 unabhängige Advisor-Perspektiven + anonymisiertes Peer-Review + Chairman-Synthese, ergänzt um empirische Prüfung realer Interview-/Cluster-Daten) geprüfter Vorschlag, stattdessen zu einem entkoppelten "Aktivität"-Datenmodell (many-to-many über Prozesse) zu wechseln, wurde verworfen: die dafür reklamierte Cross-Prozess-Aggregation existiert bereits produktiv über `clusterProcessSteps`/`process_clusters` (PROJ-24), nur als nachgelagerter Analyse-Pass statt als Schema-Fremdschlüssel. Schritt/Prozessschritt bleibt daher die atomare Einheit.

## User Stories
- Als Entwickler (Solo-Founder) will ich ein einziges, eindeutig benanntes Schema für Prozessschritte, damit ich nicht zwischen mehreren Slot-Formen (`SlotValue`/`TaziteSlot`/`TaziteSlotArray`/`GovernanceSlot`) und Namenskonventionen (Deutsch/Englisch, `StepEntry` vs. `Schritt`) übersetzen muss.
- Als KI-Berater will ich, dass alle im Interview erhobenen Prozessdetails (Ausnahmen, Reibungspunkte, Abhängigkeiten, Aufgabentyp, Risiko) tatsächlich im Use-Case-Report ankommen, damit meine Empfehlungen auf der vollen erhobenen Tiefe basieren statt auf vier Kennzahlen.
- Als Interview-Agent (System) will ich klar voneinander abgegrenzte, eindeutig definierte Zielfelder, damit ich dieselbe Information nicht doppelt in zwei Feldern erfasse (z.B. vormals Governance/Hilfsmittel, Pain-Point-Primary/Reibungspunkte).
- Als Use-Case-Engine (System) will ich ein strukturiertes Aufgabentyp- und Risiko-Signal pro Schritt, damit ich präzisere ROI-Heuristiken anwenden kann als der bisherige binäre `rule_based`-Flag.
- Als Eval/QA will ich, dass Häufigkeit/Dauer wörtlich in der vom Mitarbeiter genannten Einheit gespeichert werden, damit Umrechnungsfehler durch das Sprachmodell selbst (KI-18) architektonisch ausgeschlossen sind, nicht nur prompt-seitig gemildert.

## Acceptance Criteria

**Schema-Konsolidierung**
- [ ] `Schritt`/`SchemaSlot*` wird die einzige Repräsentation für Conversation-State, Persistenz und Export; `StepEntry`s vier verschiedene Slot-Typen entfallen zugunsten der einheitlichen `{wert, konfidenz, nicht_befund_typ}`-Form für alle Skalar-/Array-Felder (Ausnahme: `abhaengigkeiten` bleibt strukturierter Container aus getypten Kanten, kein Skalar-Wrapper).
- [ ] `governance`-Objekt (rolle/organisationseinheit/systeme) wird komplett aus dem Schritt-Schema entfernt. `rolle`/`organisationseinheit` werden aus `interviews.employee_role`/`department` bezogen (einmal pro Interview, nicht mehr pro Schritt dupliziert erhoben — empirisch verifiziert: bisher nur 4 von ~20 echten Schritten gefüllt, redundant mit der Interview-Verwaltung). `systeme` entfällt ersatzlos (empirisch als Teilmenge von `hilfsmittel` verifiziert).
- [ ] `friction_tools` wird gestrichen (empirisch als Teilmenge/Duplikat von `hilfsmittel` verifiziert, jeder reale Datenpunkt bestätigt).
- [ ] `friction_points` wird zu einem vollwertigen, aktiv verfolgten O-Feld `reibungspunkte` befördert (Teil von `target_o_field`/Coverage-Nenner statt bisherigem Legacy-Seitenkanal).
- [ ] `pain_point_primary` wird gestrichen (empirisch fast nie gefüllt — 1 von ~20 Schritten — und dort redundant mit `reibungspunkte`). Die severity-getaggte Pain-Point-Erfassung (`link_bottleneck` → `knowledge_objects.pain_point`, aktiv genutzt von Use-Case-Engine/Report/PDF, 112 reale Einträge) bleibt unverändert bestehen — eigener, funktionierender Wissensbank-Extraktionspfad, außerhalb dieser Spec.
- [ ] `StepEntry.process_steps` (Teilschritt-Array) wird zu `teilschritte` umbenannt (löst Namenskollision mit der Postgres-Tabelle `process_steps`).
- [ ] Tote Exports werden entfernt: `MANDATORY_SLOTS`, `OPTIONAL_SLOTS`, `SlotName`.
- [ ] `normalizeStepEntry`s Legacy-Lesezweig und `LegacyStepEntry`-Typ werden entfernt (verifiziert: 0 reale Datensätze im alten Format über alle 6 echten Interviews).
- [ ] Verwaister `scoreGovernanceCoverage`-Scorer wird entfernt (gegenstandslos, da Governance-Objekt entfällt).
- [ ] Prompt-Drift-Bug in `interviewAnalyst.ts` (Prüfschema-Text referenziert noch das nicht mehr existierende Feld `rule_based`) wird korrigiert.
- [ ] `toGrenzobjekt()` (`interviewSemantic.ts:536-598`) wird entfernt — wird zur Identitätsfunktion, sobald `StepEntry` bereits `Schritt`-förmig ist (Deletion-Test: die Mapping-Komplexität verschwindet vollständig, taucht nirgends wieder auf).
- [ ] `coerceRuleBased`/`coerceMediaBreaks`/`MEDIA_BREAKS_TEXT_MAP` (`processEnrichment.ts:9-42`) werden entfernt — existieren nur wegen der jetzt entfallenden Übersetzungsschicht zwischen Live-Schema und flacher Legacy-Persistenz.
- [ ] `record_governance`-Tool (`interviewTools.ts:398-443`) wird entfernt (gegenstandslos durch Governance-Streichung).
- [ ] `update_walkthrough_data` (`interviewTools.ts:520-544`) wird überprüft: nach Streichung von `friction_tools`/`pain_point_primary` und Migration von `friction_points`→`reibungspunkte` auf den `record_slot`-Pfad bleibt nur noch `teilschritte` übrig. Entscheidung an `/architecture`: eigenes Tool behalten (append-only/geordnete Sondersemantik rechtfertigt eigenen Adapter) oder in `record_slot` aufgehen lassen (nur noch ein Feld, ein Adapter ist noch kein Seam).
- [ ] `tazite_cues` bleibt im Schema definiert, wird aber aus `target_o_field`/Coverage-Nenner entfernt (opportunistisch wie Potenzial-Felder) — passend zur PRD-Priorisierung auf Aspekt (ii), da Tazite Cues laut Quell-Operationenliste Aspekt (i) (Wissensverlust-Sicherung) zugeordnet ist.
- [ ] Jedes Feld erhält eine dokumentierte Definition inklusive Abgrenzung zu benachbarten Feldern — an **beiden** Stellen, die Feld-Wissen brauchen, nicht nur einer: dem Analyst-Systemprompt (entscheidet welches Feld dran ist, extrahiert/klassifiziert aus dem Gesagten) UND `SLOT_PROMPT_HINT` in `talkerPrompt.ts:85-99` (steuert wie der Talker danach fragt — bestehender Mechanismus, jedes neue aktiv verfolgte Feld braucht dort einen eigenen Eintrag: `aufgabentyp`, `risiko_schwere`, `ausloeser`, `reibungspunkte`). `standardisierungsgrad`/`informationsdichte` brauchen KEINEN eigenen `SLOT_PROMPT_HINT`-Eintrag, da sie nie direktes `target_o_field` sind (s.u.).
  - `inputs`/`outputs` beschreiben ausschließlich Dateninhalt, niemals Systemnamen (die gehören in `hilfsmittel`).
  - `entscheidungslogik` = reguläre, wiederkehrende Verzweigungsregel; `ausnahmen` = seltene Abweichungen vom Normalablauf.
  - `ausloeser` (Freitext) nur für externe Trigger; ein Trigger, der ein anderer registrierter Schritt ist, gehört ausschließlich in `abhaengigkeiten` (Kantentyp `ausloeser`), nicht zusätzlich ins Freitextfeld.
  - Die bestehenden `SLOT_PROMPT_HINT`-Einträge für `ausnahmen` und `inputs`/`hilfsmittel` werden so erweitert, dass dieselbe Frage nebenbei auch das Klassifikations-Signal für `standardisierungsgrad` bzw. `informationsdichte` liefert (z.B. `ausnahmen`-Hint ergänzt um "— und ob der Normalfall sonst immer gleich abläuft oder stark variiert"; `inputs`/`hilfsmittel`-Hint ergänzt um "— achte auf Hinweise ob die Dokumente/Daten einheitlich strukturiert oder frei sind"), statt eine zusätzliche Frage zu benötigen. Für die reine Ableitung "Anzahl Systeme" ist keine Formulierungs-Steuerung nötig — ein Zählwert ist unabhängig davon, wie die Hilfsmittel-Frage gestellt wurde.

**Neue Felder**
- [ ] `aufgabentyp` (neu): Mehrfachauswahl-Enum `{Entscheidung, Informationsübertragung, Zusammenfassung, Suche, Klassifikation, Generierung}`, aktiv verfolgt (Teil von `target_o_field`). Koexistiert mit `entscheidungslogik` (bleibt Freitext-Beschreibung der tatsächlichen Regel).
- [ ] `risiko_schwere` (neu): Mehrfachauswahl-Enum `{leicht korrigierbar, teuer, rechtlich kritisch, Kundenkontakt-relevant}`, aktiv verfolgt (Konsequenzen sind nicht gegenseitig exklusiv).
- [ ] `ausloeser` (neu): Freitext-Feld, aktiv verfolgt, für externe Auslöser einer Tätigkeit.
- [ ] `standardisierungsgrad` (neu): strukturiertes Feld, gefüllt als Klassifikation des bereits erhobenen `ausnahmen`-Inhalts durch den Analyst (kein eigenes `target_o_field`-Ziel, keine zusätzliche Interview-Frage — vermeidet redundante Doppel-Erhebung derselben zugrundeliegenden Information).
- [ ] `informationsdichte` (neu): strukturiertes Feld, gefüllt als Klassifikation des bereits erhobenen inputs-/hilfsmittel-Inhalts durch den Analyst (gleiches Prinzip wie Standardisierungsgrad — keine separate Frage).
- [ ] "Anzahl Systeme"/Kontextwechsel-Signal wird als reine Ableitung (Anzahl distinkter Einträge in `hilfsmittel`) bereitgestellt, kein Feld.
- [ ] Häufigkeit und Dauer werden einheiten-unabhängig gespeichert: Wert + vom Mitarbeiter genannte Einheit (z.B. pro Tag/Woche/Monat für Häufigkeit; Minuten/Stunden/Tage für Dauer). Umrechnung auf eine kanonische Einheit erfolgt ausschließlich deterministisch im Code zum Zeitpunkt der Nutzung (ROI-Berechnung, Reports), niemals durch das Sprachmodell zum Zeitpunkt der Erhebung. Adressiert direkt KI-18s größte dokumentierte Einzelursache (13 von 39 gefundenen Grounding-Verletzungen, u.a. mathematisch falsche LLM-Umrechnungen wie "2-3 Tage"→"1200 Minuten").

**Persistenz (WAS, nicht WIE — Umsetzungsdetails an `/architecture`)**
- [ ] Alle aktiv erhobenen O-Felder (inkl. `reibungspunkte`, `aufgabentyp`, `risiko_schwere`, `ausloeser`, `standardisierungsgrad`, `informationsdichte`, `abhaengigkeiten`) müssen verlustfrei bis in Use-Case-Engine und Dashboard/Reports persistiert werden.
- [ ] Keine übersetzende Zwischenschicht zwischen Live-Schema und Persistenz mehr nötig (die bisherige `rule_based`/`data_sources`-Brücke in `processEnrichment.ts`, inkl. `coerceRuleBased`/`coerceMediaBreaks`, entfällt durch einheitliche Benennung/Struktur zwischen Conversation-State und Persistenz).

## Edge Cases
- Bereits abgeschlossene reale Interviews (6 Stück): `interview_state.step_tracker` ist bei allen bereits PROJ-25-konform (keine Migration nötig), aber die daraus abgeleiteten `process_steps`-Zeilen tragen die neuen Felder nicht rückwirkend. Kein Backfill vorgesehen — neue Felder gelten ab Deploy, Altbestand bleibt wie erfasst.
- `standardisierungsgrad`/`informationsdichte` sollen klassifiziert werden, aber die Quellfelder (`ausnahmen`/`inputs`/`hilfsmittel`) sind noch leer: Ergebnis ist `nicht_befund_typ`/null, kein Rateversuch ohne Grundlage.
- Widersprüchliche `aufgabentyp`-Mehrfachauswahl über mehrere Turns (z.B. Turn 3 "Entscheidung", Turn 7 zusätzlich "Suche"): additive Ergänzung, kein Überschreiben — wie andere Array-Felder.
- Genannter Trigger ist mehrdeutig (externes Ereignis vs. impliziter anderer Schritt): im Zweifel als `ausloeser`-Freitext erfassen; erst bei explizitem Schritt-Bezug auf eine `abhaengigkeiten`-Kante upgraden.
- Bereits gespeicherte Häufigkeit/Dauer-Werte der 6 realen Interviews (vor der Einheiten-Unabhängigkeit): als implizite Einheit Monat/Minuten interpretieren (bisheriger fester Default), keine Neuerhebung.

## Technical Requirements (optional)
- Postgres-Migration für `process_steps` (neue Spalten/Struktur für die zusätzlichen O-Felder) — Ausgestaltung an `/architecture`.
- Migration/Umbenennung der `rule_based`/`data_sources`-Spalten — Ausgestaltung an `/architecture`.
- Downstream-Anpassungen (Konsum der neuen Feldnamen/-formen, keine Neugestaltung der eigenen Logik) in: `useCaseEngine.ts`, `ProcessStepsTable.tsx`, `reportGenerator.ts`, `processStepsAggregation.ts`, `processClustering.ts`, `UseCaseSheet.tsx`, `InterviewReport.tsx`, `interview/[token]/clarification/route.ts`, `ClarificationCards.tsx`.
- Analyst-Systemprompt-Überarbeitung UND `SLOT_PROMPT_HINT` (`talkerPrompt.ts`) -Überarbeitung: klare Definition + Abgrenzung jedes aktiven Feldes an beiden Stellen (siehe Acceptance Criteria).
- Niedrig-konfidente Beobachtung, zu prüfen statt vorzuentscheiden: `interviewSemantic.ts` bündelt Typdefinitionen, Migrations-/Normalisierungslogik, String-Ähnlichkeits-Dedup-Utilities (`tokenJaccard` u.a.) und Knowledge-Extraction-Typen in einer Datei — evtl. mehr als eine zusammenhängende Verantwortung, aber der bestehende Datei-Kommentar begründet die Bündelung bewusst (gemeinsamer Import-Punkt für Off-Next.js-Konsumenten). Keine Empfehlung, nur ein Prüfpunkt.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Ergebnis aus `/architecture` + `/grilling` (2026-07-21). Alle Entscheidungen unten mit dem User durchgegangen (grilling-Runde, je Frage mit Empfehlung, User hat in allen Fällen der Empfehlung zugestimmt). ADR folgt danach (Entscheidung: ja, siehe Handoff).

### A) Betroffene Komponenten (Überblick)

```
Interview-Engine (Erhebung)
├── interviewSemantic.ts       — EIN Schritt-Typ ersetzt den StepEntry-Slot-Zoo
│                                 (SlotValue/TaziteSlot/TaziteSlotArray/GovernanceSlot → SchemaSlot*)
├── interviewTools.ts          — record_slot (erweitert um reibungspunkte/aufgabentyp/
│                                 risiko_schwere/ausloeser/teilschritte), record_dependency
│                                 unverändert. record_governance UND update_walkthrough_data
│                                 entfallen (Tools-Anzahl 6 → 4 aktive Schreib-Tools + link_bottleneck)
├── talkerPrompt.ts            — SLOT_PROMPT_HINT: 4 neue Einträge, tazite_cues-Eintrag entfällt
│                                 (kein target_o_field mehr, bleibt aber schreibbarer Slot)
└── interviewAnalyst.ts        — Prüfschema-Text-Fix (toter rule_based-Verweis), target_o_field-
                                  Enum erweitert, Klassifikationslogik für standardisierungsgrad/
                                  informationsdichte (aus bereits erhobenen Antworten, keine
                                  eigene Frage)

Persistenz (Übergabe an Wissensbank)
├── interview_state.step_tracker (JSONB)  — Format unverändert, ist jetzt direkt der Schritt-Typ
└── process_steps (Postgres-Tabelle)
    ├── NEU:      schritt_daten (jsonb)  — 1:1 Kopie des Schritt-Objekts aus step_tracker
    ├── ENTFÄLLT: role, frequency_per_month, duration_minutes, data_sources, rule_based,
    │             error_rate_percent, media_breaks, friction_points, friction_tools,
    │             walkthrough_steps  (10 Spalten)
    └── UNVERÄNDERT: id, interview_id, workspace_id, title, description, source_quote,
                  step_type, condition_text, substeps, cluster_id, embedding, created_at
                  (LLM-generierte Anreicherung + Cluster/Embedding — kein O-Feld, nicht betroffen)

Downstream-Konsumenten (lesen künftig aus schritt_daten statt Flach-Spalten; Konsum-Anpassung,
keine Neugestaltung eigener Logik — wie in der Spec vorgegeben)
├── useCaseEngine.ts             — ROI-Berechnung: potenzial.*.wert (+ Einheiten-Umrechnung, s.u.)
├── processStepsAggregation.ts   — Cluster-Aggregation über schritt_daten
├── processClustering.ts         — Cluster-Bildung, Lese-Pfad ändert sich, Logik nicht
├── reportGenerator.ts           — PDF-Report-Datengenerierung
├── ProcessStepsTable.tsx        — Tabellenansicht + Inline-Edit (PATCH-Aufrufer)
├── UseCaseSheet.tsx             — Detail-Sheet
├── InterviewReport.tsx          — PDF-Komponente
├── ClarificationCards.tsx       — Abschlussfragen-UI
├── interview/[token]/clarification/route.ts — Card-Generierung
└── process-steps/[id]/route.ts  — PATCH-Endpoint (Ergänzung zum Spec-Scope — nutzt heute
                                    dieselben 7 wegfallenden Flach-Spalten für manuelle Edits,
                                    im ursprünglichen Downstream-Dateien-Abschnitt der Spec fehlend)
```

### B) Datenmodell (Klartext)

**Ein Schritt-Objekt, drei Verwendungsorte (Conversation-State, Persistenz, Export) — dieselbe Form.**

*Stammdaten (unwrapped, kein Slot):* `id` (stabile Form "S001"), `bezeichnung` (Titel), `reihenfolge`.
Begründung für "kein Slot": beide sind ab `register_step` immer gesetzt und nie im Sinne von
Konfidenz/Nicht-Befund revidierbar — Slot-Overhead ohne Zustandsvarianz. Konsistent mit der
Thesis-Schema-Spec selbst, die `reihenfolge` bereits explizit als "immer befüllt, kein Slot" führt.

*Aktiv verfolgte O-Felder (target_o_field-fähig — der Talker fragt gezielt danach, solange offen):*

| Feld | Form | Status |
|------|------|--------|
| `entscheidungslogik` | SchemaSlotString | unverändert |
| `ausnahmen` | SchemaSlotStringArray | unverändert |
| `inputs` | SchemaSlotStringArray | unverändert |
| `outputs` | SchemaSlotStringArray | unverändert |
| `hilfsmittel` | SchemaSlotStringArray | unverändert |
| `abhaengigkeiten` | strukturierte Kanten (depends_on/influences) | unverändert (PROJ-26) |
| `reibungspunkte` | SchemaSlotStringArray | NEU aktiv (vorher `friction_points`, Legacy-Nebenkanal) |
| `aufgabentyp` | Mehrfachauswahl-Enum: Entscheidung / Informationsübertragung / Zusammenfassung / Suche / Klassifikation / Generierung | NEU |
| `risiko_schwere` | Mehrfachauswahl-Enum: leicht_korrigierbar / teuer / rechtlich_kritisch / kundenkontakt_relevant | NEU |
| `ausloeser` | SchemaSlotString (Freitext) | NEU |

*Opportunistisch erfasst (schreibbar, aber kein target_o_field — Talker fragt nie gezielt danach):*

| Feld | Form | Status |
|------|------|--------|
| `tazite_cues` | SchemaSlotStringArray | bleibt im Schema, fällt aus dem Ziel-Set (Aspekt-i-Zuordnung) |
| `teilschritte` | string[], additiv | umbenannt von `process_steps` (Namenskollision mit Postgres-Tabelle), jetzt record_slot-Array-Slot statt eigenes Tool |
| `potenzial` (4 Felder: `haeufigkeit_pro_monat`, `dauer_minuten`, `fehlerquote_prozent`, `medienbrueche`) | SchemaSlotNumber, jetzt mit optionalem `einheit`-Feld | s. Einheiten-Unabhängigkeit unten |

*Klassifikations-Felder (vom Analyst aus bereits erhobenen Antworten abgeleitet — keine eigene Frage, kein SLOT_PROMPT_HINT-Eintrag):*

| Feld | Werte | Abgeleitet aus |
|------|-------|-----------------|
| `standardisierungsgrad` | standardisiert / teilweise_standardisiert / stark_variabel | `ausnahmen`-Antwort |
| `informationsdichte` | strukturiert / gemischt / unstrukturiert | `inputs`/`hilfsmittel`-Antwort |

"Anzahl Systeme"/Kontextwechsel-Signal: reine Ableitung aus `hilfsmittel.wert?.length`, kein eigenes
Feld, keine Spalte — nur zur Anzeige-/ROI-Zeit berechnet.

*Entfällt vollständig:* `governance` (rolle/organisationseinheit/systeme — ersetzt durch
`interviews.employee_role`/`department`, einmal pro Interview statt pro Schritt), `friction_tools`,
`pain_point_primary` (Begründung je Feld: siehe Acceptance Criteria der Spec).

**Einheiten-Unabhängigkeit (Häufigkeit/Dauer):** `SchemaSlotNumber` bekommt ein optionales
`einheit`-Feld statt eines impliziten Fixwerts — z.B. `potenzial.haeufigkeit_pro_monat` wird zu
`{wert: 3, einheit: 'pro_woche', konfidenz, nicht_befund_typ}` statt eines auf "pro Monat"
vorab-normalisierten Werts. Umrechnung auf eine kanonische Einheit passiert deterministisch im
Code zur Nutzungszeit (ROI-Berechnung, Reports), nie durch das Sprachmodell zum Erhebungszeitpunkt.
Adressiert KI-18s größte dokumentierte Einzelursache (13 von 39 Grounding-Verletzungen) strukturell,
nicht nur im Prompt.

### C) Tech-Entscheidungen (Begründung)

1. **JSONB-only Persistenz, keine Flach-Spalten für O-Felder** (grilling-Entscheidung). Ein neues
   Feld `schritt_daten` auf `process_steps` trägt das komplette Schritt-Objekt 1:1 — dieselbe Form
   wie in `step_tracker`. Begründung: einzige Quelle der Wahrheit, kein Sync-Risiko zwischen
   Conversation-State und Persistenz (erfüllt die AC "einzige Repräsentation" wörtlich). Verifiziert:
   aktuell nutzt keine Downstream-Logik SQL-seitiges Filtern/Sortieren auf den betroffenen Feldern
   (`processStepsAggregation.ts`/`useCaseEngine.ts` aggregieren in JS nach dem Laden) — kein
   Funktionsverlust durch den Wegfall der Flach-Spalten. Manuelle Korrektur im UI
   (`process-steps/[id]/route.ts`) wird Read-Merge-Write auf dem JSONB-Feld statt Spalten-Update —
   für den Nutzer unsichtbar, nur der Backend-Mechanismus ändert sich. Kein GIN-Index auf
   `schritt_daten` vorgesehen (keine Query filtert aktuell auf JSONB-Inhalt) — bei Bedarf später
   nachrüstbar.
2. **Governance-Streichung, Bezug auf `interviews.employee_role`/`department`** (grilling-Entscheidung:
   `role`-Spalte auf `process_steps` wird ersatzlos entfernt, nicht nur leergelassen). Empirisch nur
   4/20 Schritte je gefüllt, strukturell redundant mit der Interview-Verwaltung. Der Edge Case "ein
   anderer Ausführender pro Schritt als der Interviewte" wird bewusst nicht mehr unterschieden.
3. **Zwei Coverage-Konzepte bleiben unabhängig — kein Merge.** `COVERAGE_FIELDS` (9-Felder-Metrik,
   `dedup_slot_coverage`-Eval-Scorer, an das eingefrorene Thesis-Schema gebunden) bleibt
   **unverändert**, inkl. `tazite_cues`. `O_SLOT_FIELDS` (Interview-Engine-Ziel-Feld-Menge,
   `target_o_field`-Enum) ändert sich: −`tazite_cues`, +`reibungspunkte`/`aufgabentyp`/
   `risiko_schwere`/`ausloeser` (7 → 10 Felder). Aktuell ist `O_SLOT_FIELDS` codeseitig ein reiner
   Filter auf `COVERAGE_FIELDS` — das wird jetzt zu zwei unabhängigen Konstantenlisten, da sich die
   Mengen nicht mehr decken. Diese Trennung muss im Code explizit werden; ohne sie bricht die
   Vergleichbarkeit mit der historischen KI-18/KI-27-Eval-Befundlage.
4. **`update_walkthrough_data` → `record_slot`** (grilling-Entscheidung): `teilschritte` wird ein
   regulärer additiver Array-Slot, wie `tazite_cues`/`ausnahmen`/`inputs`/`outputs`/`hilfsmittel`
   bereits additiv sind. Ein Feld allein rechtfertigt keinen eigenen Tool-Adapter mehr.
5. **Einheiten-Unabhängigkeit für Häufigkeit/Dauer** — s. Datenmodell oben. Struktur-Erweiterung von
   `SchemaSlotNumber` (optionales `einheit`-Feld), kein neuer Typ.

**Hinweis (informativ, keine Entscheidung nötig):** `toGrenzobjekt()` mappt `StepEntry` aktuell auf
die im Thesis-Repo (`meridian-ma`) als "eingefroren" (v1.2) geführte `Schritt`-Form. PROJ-45 entfernt
`governance` und führt 5 neue, dort nicht vorhandene Felder ein (`aufgabentyp`, `risiko_schwere`,
`ausloeser`, `standardisierungsgrad`, `informationsdichte`) — die App-Implementierung divergiert damit
bewusst vom akademischen Schema. Konsistent mit der DSR-Rahmung (Code ist zitierter Vorlauf, nicht die
Thesis-Grundlage selbst) und mit der Spec-eigenen AC, `toGrenzobjekt()` ersatzlos zu streichen. Keine
Rückwirkung auf `meridian-ma` in dieser Spec.

### D) Dependencies

Keine neuen npm-Pakete — reine Schema-/Code-Konsolidierung. Eine neue Postgres-Migration
(`process_steps`: 10 Spalten löschen, `schritt_daten jsonb` hinzufügen). Kein Backfill (Edge Case
bereits in der Spec dokumentiert: Altbestand bleibt wie erfasst, neue Felder gelten ab Deploy).

## Backend Implementation Notes (`/backend`, 2026-07-21, Sonnet 5)

**Migration angewendet** (Supabase MCP, `proj45_schritt_daten_jsonb`): `process_steps.schritt_daten jsonb` hinzugefügt,
10 Legacy-Spalten (`role, frequency_per_month, duration_minutes, data_sources, rule_based, error_rate_percent,
media_breaks, friction_points, friction_tools, walkthrough_steps`) gelöscht. Kein Backfill (17 Altzeilen verlieren
diese Werte — wie in der Spec/ADR akzeptiert). `database.types.ts` manuell nachgeführt (Projekt nutzt Interface-Format,
kein `supabase gen types`-Rohdump).

**Bewusste Abweichung vom Tech-Design-Wortlaut (dokumentiert, nicht stillschweigend):** Tech Design Abschnitt B)
skizziert `bezeichnung`/`konfidenz`/`wert` als Feldnamen (in Anlehnung an das vorbestehende `Schritt`/`SchemaPotenzial`,
das nur für `toGrenzobjekt()` existierte). Umgesetzt wurde stattdessen: **ein** generischer `SchemaSlotBase<T>`-Typ
ersetzt die vier alten Slot-Typen (`SlotValue`/`TaziteSlot`/`TaziteSlotArray`/`GovernanceSlot` entfallen), aber mit
den BESTEHENDEN Feldnamen (`value`, `quote`, `confidence`, `nicht_befund_typ`) statt der deutschen Variante, und
`StepEntry.title`/`potenzial.frequency_per_month` etc. bleiben unrenamed. Begründung: die Kernanforderung der AC
("StepEntry's vier verschiedene Slot-Typen entfallen zugunsten einer einheitlichen Form") ist damit vollständig
erfüllt — vier Typen wurden zu einem generischen Typ — ohne einen zusätzlichen, rein kosmetischen Rename mit
großer Blast-Radius (91 `.title`-Vorkommen, alle Eval-Scorer/Personas, alle Tool-Schemas) einzugehen, der keinen
weiteren funktionalen Nutzen gehabt hätte. `toGrenzobjekt()`/`Schritt`/`SchemaGovernance`/altes `SchemaPotenzial`
wurden trotzdem vollständig entfernt (AC-Vorgabe), inkl. des darauf aufbauenden `schemaValidator.ts` +
`schemaConformanceRate`-Eval-Scorers (beide gelöscht — messen Konformität zu einem Schema, von dem sich die App
laut ADR-025 D7 bewusst entfernt; ein Scorer der garantiert bei 0 landet ist kein sinnvolles Signal mehr).

**Umgesetzt (entspricht AC/ADR-025 wörtlich):**
- `process_steps` → `teilschritte` (Namenskollision mit der Postgres-Tabelle behoben)
- `friction_points` → `reibungspunkte`, vollwertiges `SchemaSlotStringArray`-O-Feld, jetzt in `target_o_field`
- `governance`, `friction_tools`, `pain_point_primary` ersatzlos entfernt (inkl. `record_governance`-Tool)
- `update_walkthrough_data`-Tool entfernt, `teilschritte` ist jetzt ein regulärer `record_slot`-Array-Slot
- Neue Felder: `aufgabentyp`, `risiko_schwere` (aktiv erfragt, Enum-Mehrfachauswahl), `ausloeser` (Freitext, aktiv),
  `standardisierungsgrad`, `informationsdichte` (Analyst-Klassifikation aus `ausnahmen`/`inputs`/`hilfsmittel`,
  keine eigene Frage, kein `SLOT_PROMPT_HINT`-Eintrag)
- `COVERAGE_FIELDS` (9 Felder, `dedup_slot_coverage`-Eval-Metrik) unverändert; `O_SLOT_FIELDS` jetzt unabhängige
  Konstante (10 Felder: −`tazite_cues`, +`reibungspunkte`/`aufgabentyp`/`risiko_schwere`/`ausloeser`) —
  `isCoverageFieldFilled`/`isOFieldFilled` als zwei dünne Wrapper um denselben internen Check
- Einheiten-Unabhängigkeit: `SchemaSlotNumber.einheit?` (z.B. `pro_woche`, `stunden`), deterministische Umrechnung
  über `resolveHaeufigkeitProMonat`/`resolveDauerMinuten` (interviewSemantic.ts) — nie durch das Sprachmodell
- `coerceRuleBased`/`coerceMediaBreaks`/`MEDIA_BREAKS_TEXT_MAP`/`MANDATORY_SLOTS`/`OPTIONAL_SLOTS`/`SlotName`/
  `LegacyStepEntry`-Zweig in `normalizeStepEntry` entfernt
- `rule_based`-Prompt-Drift in `interviewAnalyst.ts` korrigiert (Prüfschema + `ClarificationCardSchema.slot_key`
  referenzieren jetzt `entscheidungslogik`)
- JSONB-only-Persistenz: `processEnrichment.ts` schreibt `schritt_daten` 1:1 aus dem `StepEntry`, keine
  Übersetzungsschicht mehr
- Neuer `src/lib/schrittDatenView.ts`: `deriveProcessStepDisplayFieldsFromRaw` (Read-Adapter für
  `useCaseEngine.ts`/`processStepsAggregation.ts`/`ProcessStepsTable.tsx`/`UseCaseSheet.tsx`/`InterviewReport.tsx` —
  deren EIGENE Logik unverändert bleibt, nur der Lesepfad von `schritt_daten` aus) + `mergeManualCorrection`
  (Read-Merge-Write-Helper für die beiden Nicht-LLM-Schreibpfade: `process-steps/[id]/route.ts` PATCH und die
  SlotCard-Antworten in `interview/[token]/clarification/route.ts` + `evalStore.ts`)
- Alle Downstream-Dateien aus der Spec-Liste angepasst (Konsum, keine Logik-Neugestaltung), plus die beim
  Grilling nachgetragene `process-steps/[id]/route.ts` und die dort zusätzlich gefundene
  `process-steps/[id]/substeps/route.ts`

**Zwei echte Bugs beim Umbau gefunden und mitgefixt** (nicht Teil der Spec, aber durch die Typ-Vereinheitlichung
aufgedeckt): `interviewOrchestrator.ts::computeTargetOFieldFallback` rief `isCoverageFieldFilled` mit einem
`OSlotField`-Wert auf (falsche Funktion für die falsche Feld-Menge, seit der D3-Trennung ein Typfehler) — jetzt
`isOFieldFilled`. `slotDepth.ts`s `FilledSlot.quote` war `string` (non-null) getypt, obwohl `quote` im Slot-Typ
schon vorher `string | null` war — jetzt korrekt mit `?? ''` abgefangen.

**Test-Fixture-Reparatur abgeschlossen und verifiziert** (2026-07-21): ~19 `*.test.ts`-Dateien (Subagent-Batch:
`slots`-Objektliterale um die 6 neuen Keys ergänzt, `governance`-Properties entfernt, Typ-Import-Renames
`SlotValue`/`TaziteSlot`/`TaziteSlotArray`→`SchemaSlotNumber`/`SchemaSlotString`/`SchemaSlotStringArray`,
`toGrenzobjekt`/`record_governance`/`update_walkthrough_data`/`scoreGovernanceCoverage`-Testblöcke gelöscht) plus
3 Testdateien, die eigene `schritt_daten`-Umstellungen dieser Session betrafen und deshalb selbst gefixt wurden
(nicht mechanisch, sondern echte Assertion-Anpassungen auf die neue JSONB-Form): `processEnrichment.test.ts`
(Assertions von Flach-Spalten auf `arg.schritt_daten.potenzial.*`/`slots.*` umgestellt), `clarification.test.ts`
(Mock-Query-Kette für das neue Read-Merge-Write erweitert, OpenItem-Insert-Assertion auf `schritt_daten: null`),
`use-cases/[id]/id.test.ts` (Cluster-Sub-Use-Case-Fixtures tragen jetzt `schritt_daten` statt Flach-Felder).

**Endstand (verifiziert 2026-07-21):** `npx tsc --noEmit` sauber (exit 0, gesamtes Repo). `npm test`: **66/66
Testdateien, 807 Tests grün, 1 Skip (vorbestehend)** — 0 Failures.

**Ausstehend / nächste Schritte:**
- **Pflicht-Gate laut general.md**: mindestens ein `eval:interview`-Lauf vor `Approved` (Interview-Engine-Domain-Regel)
  — hier zusätzlich relevant, da die Talker-/Analyst-Prompt-Texte für die neuen Felder erstmals live verifiziert
  werden müssen (Prompt-Text ist geschrieben, aber nicht live getestet).
- Manuelle Verifikation der neuen `record_slot`-Slots (`reibungspunkte`/`aufgabentyp`/`risiko_schwere`/`ausloeser`/
  `teilschritte`/`standardisierungsgrad`/`informationsdichte`) im realen Interview-Turn — Unit-Tests decken die
  Typ-Korrektheit ab, nicht das tatsächliche LLM-Verhalten.
- `docs/architecture/`-Diagramme (falls vorhanden) referenzieren evtl. noch die alten `process_steps`-Flach-Spalten.
- `src/lib/supabase-types.ts` (unbenutzte Alt-Datei, kein Importer gefunden) enthält noch das alte Schema — nicht
  angefasst, da tot; ggf. Kandidat für `/cleanup`.
- Nächster Schritt: `/qa PROJ-45`.

## QA Test Results

> `/qa` 2026-07-21 (Opus 4.8). Fokus laut Auftrag: kritische Prüfung, ob Tests wirklich grün sind und ob der Cleanup vollständig ausgeführt wurde (Backend-Summary in Zweifel gezogen).

### Statische Verifikation (bestanden)

| Check | Ergebnis |
|-------|----------|
| `npx tsc --noEmit` | **exit 0**, sauber (gesamtes Repo) |
| `npm test` (vitest) | **66/66 Testdateien, 807 Tests grün, 1 Skip (vorbestehend), 0 Failures** — Backend-Behauptung bestätigt, entgegen der Auftrags-Vermutung „manche Tests nicht bestanden". Auf dem aktuellen Working Tree gibt es keinen fehlschlagenden Test. |
| Code-Cleanup entfernter Symbole | `record_governance`/`scoreGovernanceCoverage`/`schemaConformanceRate`/`toGrenzobjekt`/`SchemaGovernance`/`coerceMediaBreaks`/`MANDATORY_SLOTS`/`OPTIONAL_SLOTS`/`SlotName`/`LegacyStepEntry`: **0 echte Code-Referenzen** in `src/`. Verbliebene Treffer für `update_walkthrough_data`/`friction_tools`/`pain_point_primary`/`coerceRuleBased` sind ausschließlich erklärende Kommentare (dokumentieren das Entfernte). |
| Gelöschte Dateien | `schemaValidator.ts`, `schemaConformanceRate.ts` + `.test.ts` real via git gelöscht (D-Status). |
| `LegacyStepEntry`-Legacy-Zweig | entfernt. `RawStepEntry` ist ein neuer, davon verschiedener Backward-Compat-Read-Shape für post-PROJ-25/pre-PROJ-45-JSONB (nötig für die 6 realen Alt-Interviews, Spec-Edge-Case) — AC-konform. |
| Live-DB-Migration (`proj45_schritt_daten_jsonb`, `20260721113650`) | **angewendet.** `process_steps` trägt `schritt_daten jsonb`, alle 10 Legacy-Flach-Spalten entfernt, RLS aktiv. Persistenz-AC erfüllt. |
| NULL-`schritt_daten` bei 17 Altzeilen (kein Backfill) | `deriveProcessStepDisplayFields`/`parseSchrittDaten`/`mergeManualCorrection` behandeln `null` sauber (Optional-Chaining + `EMPTY_STEP_ENTRY`-Fallback) — kein Crash, Altzeilen rendern leer. Dokumentierte No-Backfill-Entscheidung, kein Bug. |
| `database.types.ts` | 10 Flach-Spalten von `process_steps` entfernt, `schritt_daten` ergänzt (3 `duration_minutes`-Treffer = `max_duration_minutes` einer anderen Tabelle). |
| Prompt-Vollständigkeit | `SLOT_PROMPT_HINT` hat die 4 neuen aktiven Felder (`reibungspunkte`/`aufgabentyp`/`risiko_schwere`/`ausloeser`); Analyst-Prompt beschreibt alle neuen Felder inkl. Klassifikations-Slots + `ausloeser`→`record_dependency`-Abgrenzung. |
| `O_SLOT_FIELDS` (10) vs. `COVERAGE_FIELDS` (9) | als zwei unabhängige Konstanten getrennt (ADR-025 D3), `isCoverageFieldFilled`/`isOFieldFilled` als getrennte Wrapper. |
| Security: Object-Ownership `process-steps/[id]` PATCH | Auth + `workspace_members`-Ownership-Guard (Z. 65-74) vorhanden; Read-Merge-Write korrekt. Ownership-Logik unverändert ggü. Pre-PROJ-45, keine neue Angriffsfläche. |

### Befunde

- **L-1 (Low):** `src/lib/supabase-types.ts` (18 KB) enthält noch das alte Schema, 0 Importer. Vorbestehende tote Datei, nicht von PROJ-45 eingeführt, vom Backend als `/cleanup`-Kandidat markiert. Kein Funktionsrisiko, aber stale.

### Blockierendes Gate (nicht erfüllt)

- **Eval-Gate offen (general.md + QA §8b):** PROJ-45 verändert Interview-Conversation-Logic (neue `record_slot`-Slots, `SLOT_PROMPT_HINT`, `target_o_field`-Enum, Analyst-Klassifikation). 807 grüne Unit-Tests prüfen Typ-/Pfad-Korrektheit, NICHT das reale LLM-Verhalten der neuen Felder. Kein `eval:interview`-Lauf vorhanden (neuestes Artefakt 2026-07-19). **Ohne mindestens einen erfolgreichen Eval-Lauf kein `Approved`.**

### Eval-Gate (2026-07-21, `google/gemini-3.1-flash-lite`, Supabase-Store)

Judge-Preflight (general.md): echter Anthropic-Messages-Call gegen `claude-haiku-4-5` → HTTP 200 (Key valide + Guthaben). Zwei Läufe je 1×.

| Metrik | buchhalter (`feb6d603`) | it-support (`33e94583`) | Gate |
|--------|-------------------------|-------------------------|------|
| status (Runner-Gate) | **FAIL** | **FAIL** | — |
| dedup_slot_coverage | 0.56 | 0.72 | ≥0.75 ✗ (beide) |
| completion_correctness | true | true | =true ✓ |
| step_registration_coverage | 1.0 | 1.0 | ≥0.8 ✓ |
| dialog_naturalness | **1.0** | 0.67 | ≥0.65 ✓ |
| blocked_rate | 0.05 | — | <0.1 ✓ |
| talker_grounding_violations | **0** | **0** | — ✓ |
| hallucination_rate | 0 | 0 | — ✓ |

**Beide FAIL nur wegen `dedup_slot_coverage` <0.75 — kein PROJ-45-Regress.** Der Scorer hängt an den unveränderten 9 `COVERAGE_FIELDS` (nicht an den neuen Feldern); 0.56/0.72 decken sich mit der etablierten Baseline (PROJ-44 R3 / PROJ-46 = 0.56 buchhalter). Es ist die bekannte Tiefe-Lücke → PROJ-43-Remit, nicht durch PROJ-45 verursacht.

**PROJ-45-eigene Ziele — erreicht:**
- Alle 6 neuen Felder werden live gefüllt UND verlustfrei nach `process_steps.schritt_daten` persistiert (Live-DB verifiziert, alle 6 Schritte `has_schritt_daten=true`): `aufgabentyp` `["entscheidung","klassifikation"]`, `risiko_schwere` `["teuer","rechtlich_kritisch"]`, `reibungspunkte` `["E-Mails und Anrufe unterbrechen…"]`, `ausloeser` `"Ablauf der monatlichen Zahlungsfristen"`, `informationsdichte` `"gemischt"/"unstrukturiert"`, `standardisierungsgrad` `"stark_variabel"` (Analyst-Klassifikation funktioniert). Enum-Normalisierung korrekt.
- `dialog_naturalness` gehalten/verbessert (1.0 buchhalter, 0.67 it-support) — keine KI-18-Prompt-Dichte-Regression trotz erweiterter Prompts.
- `talker_grounding_violations = 0` in beiden Läufen.
- Extraktion end-to-end: 20 + 26 knowledge_objects, Interviews `completed`.

### Befunde (Eval)

- **H-1 (High) — Einheiten-Unabhängigkeit wird vom LLM umgangen (Headline-AC verletzt).** Die AC „Umrechnung … erfolgt ausschließlich deterministisch im Code … niemals durch das Sprachmodell" wird in 3 von 4 nicht-kanonischen Häufigkeits-/Dauer-Fällen NICHT eingehalten. Quote-belegt aus der Live-DB: Persona „15 bis 20 Tickets **pro Tag**" → gespeichert `frequency_per_month.value=400, einheit MISSING`; „3 bis 5 **pro Woche**" → `value=16, einheit MISSING`. Das LLM rechnet selbst Tag/Woche→Monat um (genau KI-18s dokumentiertes „15-20/Tag"→„350/Monat"-Muster) und lässt `einheit` weg. Der Mechanismus funktioniert, WENN das LLM ihn nutzt (`1 [monatlich]`, `2 [tage]` korrekt), aber der Prompt erzwingt die Nutzung nicht. Der Rohwert bleibt im `quote` erhalten (Mitigation), aber `value` ist LLM-umgerechnet → der deterministische Converter ist ein No-op und vertraut der LLM-Zahl. `talker_grounding_violations=0`, weil die Umrechnung im stillen `record_slot`-Write des Analyst passiert, nicht in einer Talker-Rückfrage — der Guard sieht sie nicht. **Fix-Richtung (an `/backend`):** `einheit` im `record_slot`-Schema für Potenzial-Slots verpflichtend machen + Analyst-Prompt „nenne Zahl UND Einheit exakt wie gesagt, rechne nie selbst um". Blockiert Approved.
- **M-1 (Medium) — Dauer als Monats-Aggregat statt pro Vorgang (ROI-Überzählung).** Rechnungsprüfung: `duration_minutes.value=900` aus quote „15 **Stunden pro Monat** für die Prüfung dieser 80-100 Rechnungen". 900 min ist der Monatsgesamtwert, nicht die Dauer pro Rechnung. ROI = `frequency × duration` würde massiv überzählen (80 × 900). Straddle PROJ-43 (Elicitation fragt nicht sauber „pro Vorgang") / PROJ-45 (Einheiten-Semantik). Betrifft ROI-Korrektheit.
- **Nicht auto-getestet:** Use-Case-Generierung (`use_cases=0`, separater Trigger) — der ROI-Read-Adapter (`deriveProcessStepDisplayFieldsFromRaw`) ist unit-getestet + JSONB-Form live wohlgeformt, aber der Live-ROI-Pfad wurde nicht end-to-end ausgeführt.

Artefakte: `docs/evals/interview/2026-07-21/2026-07-21-15-48-52-*-buchhalter.{md,transcript.json}`, `…-15-54-22-*-it-support.md`.

### Cleanup-Nachtrag (nach Nutzer-Freigabe umgesetzt)

- `src/lib/supabase-types.ts` gelöscht (0 Repo-Referenzen, veralteter Duplikat-`Database`-Typ). tsc grün nach Löschung.
- Substanzloser key-gated Test (`dialogNaturalness.test.ts` „Positions-Swap Integration") entfernt: `generateObject` top-level gemockt → die „Invarianz"-Assertion war trivial wahr, `it.skipIf(!hasApiKey)` sorgte für Dauerskip in jedem CI-Lauf. Zugehörige tote `hasApiKey`-Konstante mit entfernt. Skip-Count jetzt 0 (vorher 1). 807→ Tests weiterhin grün (Skip weg).

### Cleanup-Umfang (quantifiziert)

3 Dateien gelöscht (`schemaValidator.ts`, `schemaConformanceRate.ts`+`.test.ts`) + 1 neue (`schrittDatenView.ts`, 125 Z.). Entfernte Konzepte: 4 Slot-Typen → 1 generischer `SchemaSlotBase<T>`, 2 Tools (`record_governance`, `update_walkthrough_data`), Governance-Objekt. Netto Production-Code **−191 Z.** (brutto ~316 Z. Alt-Logik raus, 125 Adapter zurück), Test-Code **−139 Z.**, Gesamt-Diff netto **−190 Z.** bei mehr Funktionalität.

### Endurteil

**NOT READY (In Review).** Statik + Persistenz + Schema-Konsolidierung solide, alle neuen Felder live gefüllt und persistiert, keine KI-18-Prompt-Regression. **Blocker: H-1** — die Einheiten-Unabhängigkeit (eine Headline-AC + der beworbene strukturelle KI-18-Fix) wird vom LLM umgangen; braucht einen Prompt/Schema-Fix in `/backend`, danach Re-Eval. Die `dedup_slot_coverage`-FAILs sind kein PROJ-45-Regress (PROJ-43-Tiefe-Lücke).

**Bugs: 1 High : 1 Medium : 0 Low**

## Remediation-Handoff (`/backend PROJ-45`, nächste Sonnet-Session)

> Erstellt am Ende der `/qa`-Session 2026-07-21 (Opus 4.8). Nutzer-Entscheidung: H-1-Fix + Prompt-Deslop in einer **frischen Sonnet-Session** ausführen. Diese Session hat NICHTS davon umgesetzt — nur QA + zwei Cleanups (s.o.). Naming-Entscheidung (Nutzer): **`frequency` / `duration`**.

### Auftrag: drei Stufen, in einem `/backend`-Durchlauf, danach Re-Eval

**Stufe 1 — Rename (H-1-Wurzel: der Feldname erzeugt den Umrechnungs-Widerspruch)**
- `frequency_per_month` → `frequency`, `duration_minutes` → `duration`. **Nur diese zwei.** `error_rate_percent` (% = natürliche Einheit) und `media_breaks` (Zählwert) bleiben unverändert.
- Blast-Radius: `frequency_per_month` 237 Treffer / 58 Dateien, `duration_minutes` 205 / 67. **Fast alles Code + Tests + Fixtures, nicht Prompt.** Kein DDL (alles im `schritt_daten`-JSONB).
- Ausgangspunkt: `POTENZIAL_SLOT_NAMES` + `SchemaSlotNumber`-Typ + `resolveHaeufigkeitProMonat`/`resolveDauerMinuten` in [interviewSemantic.ts](../../src/services/interviewSemantic.ts). Von dort dem Compiler folgen (`tsc --noEmit` treibt die ~440 Stellen auf).
- **Back-compat PFLICHT** in `normalizeStepEntry` ([interviewSemantic.ts](../../src/services/interviewSemantic.ts)): alte JSONB-Keys `potenzial.frequency_per_month`/`duration_minutes` weiterlesen (analog zum bestehenden `teilschritte ?? process_steps`-Fallback). Betrifft die 6 realen Alt-Interviews UND die 6 process_steps-Zeilen, die die Eval-Läufe dieser Session gerade in Supabase geschrieben haben (Interviews `feb6d603…`, `33e94583…`).

**Stufe 2 — `einheit` verpflichtend machen (schließt die Lücke strukturell)**
- Im `record_slot`-Tool-Schema ([interviewTools.ts](../../src/services/interviewTools.ts)) für `frequency`/`duration`: `einheit` bei gesetztem `value` erzwingen (Tool-`.describe()`: „bei Häufigkeit/Dauer immer Wert UND genannte Einheit").
- Die drei `NIEMALS selbst umrechnen`/`Default pro_monat|minuten`-Sätze im Analyst-Prompt ([interviewAnalyst.ts:296-297](../../src/services/interviewAnalyst.ts#L296-L297)) **ersatzlos löschen** — sie sind das Pflaster, das mit dem neutralen Namen + Pflicht-`einheit` überflüssig wird. Neu z.B.: `- frequency: Wert + einheit genau wie genannt (z.B. "3× pro Woche" → value=3, einheit="pro_woche").`

**Stufe 3 — Prompt-Deslop BEIDER Dateien (Nutzer-Auftrag ausdrücklich: nicht nur Talker!)**
Zwei Ebenen — die erste ist risikoarm, die zweite eval-pflichtig:
- *(a) Tracking-IDs aus den gesendeten Prompt-Strings entfernen (risikoarm, nur Zeichen, keine Instruktion):*
  - [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts): `PROJ-45` (Z. 245, 296, 297), `PROJ-46/ADR-024` (Z. 268), `PROJ-28/BL-E2.1` (Z. 288) — alle im Template-Literal, gehen ans LLM.
  - [talkerPrompt.ts](../../src/services/talkerPrompt.ts): `E3.3, PROJ-46` (Z. 206), `E3.5` (Z. 207), `E3.7` (Z. 208, 255) — in den `buildPhaseMethodology`-Rückgabe-Strings. `STATIC_PROMPT` (Z. 29-82) ist bereits sauber. Die `// PROJ-xx`-**Codekommentare** bleiben (nie ans LLM gesendet).
- *(b) Umfassende inhaltliche Überarbeitung (der eigentliche „Deslop" den der Nutzer will):* Redundanz kürzen, Widersprüche auflösen, nur Nötiges + Eindeutiges. **Eval-pflichtig** — die KI-18-Historie zeigt wiederholt `dialog_naturalness`-Regressionen auf flash-lite durch genau solche Prompt-Dichte-Änderungen. Vorher/Nachher-`dialog_naturalness`-Median vergleichen, nicht blind umschreiben.

> **⛔ HARTE REGEL für die `/backend`-Session (Nutzer, 2026-07-21): Prompt-Wording NICHT eigenmächtig ändern.** Jede inhaltliche Änderung am Prompt-Text (Stufe 3b, und darüber hinaus JEDE Umformulierung, die über den mechanischen Rename + reines ID-Strippen hinausgeht) wird VORHER mit dem Nutzer durchgesprochen — z.B. in einem eigenen `/grilling`. Sonnet schlägt die konkreten Prompt-Änderungen vor und wartet auf Freigabe; es entscheidet die Formulierung NICHT selbst. Nur unbedenklich ohne Rücksprache: der Feld-Rename dort wo `frequency_per_month`/`duration_minutes` wörtlich im Prompt vorkommt, das Löschen der dadurch gegenstandslosen `NIEMALS umrechnen`-Sätze, und das reine Entfernen der Tracking-IDs (Stufe 3a). Alles andere: erst besprechen, dann editieren.

### Verifikation (Pflicht vor Approved)
- `eval:interview it-support` (die Persona mit Nicht-Monats-Einheiten — „15-20/Tag", „3-5/Woche"). **Erfolgskriterium H-1:** `frequency`/`duration` werden mit `einheit` in der ROH genannten Einheit gespeichert (`pro_tag`/`pro_woche`/`stunden`), NICHT vom LLM auf Monat/Minuten vorab-umgerechnet. Live-DB gegenchecken (`schritt_daten->potenzial->frequency->>einheit`).
- `dialog_naturalness ≥ 0.65` halten (beweist, dass der Prompt-Deslop die Natürlichkeit nicht gebrochen hat).
- Judge-Preflight zuerst (general.md): echter Anthropic-`claude-haiku-4-5`-Mini-Call (in dieser Session HTTP 200 verifiziert, aber pro Lauf neu prüfen).
- M-1 (Dauer als Monats-Aggregat) mitbeobachten — straddle PROJ-43, kein Approved-Blocker für PROJ-45, aber im Transkript-Review vermerken.

### Zustand am Ende dieser QA-Session (Working Tree, NICHT committet)
- Ganzer PROJ-45-Backend-Diff (62 Dateien) aus der vorherigen `/backend`-Session — uncommittet.
- Diese QA-Session zusätzlich: QA-Ergebnisse in diese Spec + INDEX Bugs `1:1:0` (Status In Review); **zwei Cleanups umgesetzt** — `src/lib/supabase-types.ts` gelöscht, substanzloser key-gated Test in [dialogNaturalness.test.ts](../../src/services/__evals__/interview/scorers/dialogNaturalness.test.ts) entfernt (+ tote `hasApiKey`-Konstante). Suite danach 66 Dateien / 807 grün / 0 Skip, `tsc` sauber.
- Eval-Artefakte in `docs/evals/interview/2026-07-21/` (buchhalter + it-support, je `.md`/`.transcript.json`/`.slot-trail.jsonl`).
- Nichts committet (kein Auftrag dazu). Vorschlag für die nächste Session: QA + Cleanups als `test(PROJ-45): …` committen, dann Stufe 1-3 als `fix(PROJ-45): einheiten-neutrale Feldnamen + Prompt-Deslop`.

## Remediation umgesetzt (`/backend`, 2026-07-22, Sonnet 5)

> Umsetzung des Remediation-Handoffs oben, in einer frischen Sonnet-Session wie vom Nutzer vorgegeben.

**Stufe 1 — Rename (H-1-Wurzel).** `frequency_per_month`→`frequency`, `duration_minutes`→`duration` mechanisch über 65 Dateien (Code, Tests, JSON-Fixtures) per wortgrenzen-sicherem Rename ersetzt (`\bduration_minutes\b` trifft NICHT auf `max_duration_minutes` — geprüft). Back-compat in `normalizeStepEntry` ([interviewSemantic.ts](../../src/services/interviewSemantic.ts)): `RawStepEntry.potenzial` liest weiterhin die alten Schlüssel `frequency_per_month`/`duration_minutes` als Fallback, falls `frequency`/`duration` fehlen — sichert die 6 realen Alt-Interviews UND die beiden `schritt_daten`-Zeilen aus den QA-Eval-Läufen dieser Spec (`feb6d603…`, `33e94583…`) ohne Migration.

**Stufe 3a — Tracking-ID-Strip (risikoarm, vor Stufe 2 ausgeführt).** In den ans LLM gesendeten Prompt-Strings entfernt: `PROJ-45`/`PROJ-46/ADR-024`/`PROJ-28/BL-E2.1` in [interviewAnalyst.ts](../../src/services/interviewAnalyst.ts), `E3.3, PROJ-46`/`E3.5`/`E3.7` in [talkerPrompt.ts](../../src/services/talkerPrompt.ts). Nur Zeichen entfernt, keine Instruktion verändert. Code-Kommentare (nie ans LLM gesendet) unverändert gelassen.

**Stufe 2 — `einheit` verpflichtend (Nutzer-Freigabe eingeholt vor Umsetzung, siehe unten).** Nutzer bestätigte den vorgeschlagenen Wortlaut mit einem Zusatzhinweis: die „Default pro_monat"/„Default minuten"-Formulierung ist gestrichen — es gibt keinen Default mehr, der Mitarbeiter nennt immer die Einheit. Umgesetzt:
- `record_slot`-Tool-Schema ([interviewTools.ts](../../src/services/interviewTools.ts)): `einheit`-Feld-`.describe()` von „Nur für frequency/duration: … (Default pro_monat)/(Default minuten)" auf „PFLICHT bei frequency/duration sobald value gesetzt ist: … " geändert, keine Default-Erwähnung mehr.
- Neue Laufzeit-Validierung in `record_slot.execute()`: `slot ∈ {frequency, duration}` + `value` gesetzt (kein `nicht_befund_typ`) + `einheit` fehlt/leer → harter `success:false`-Reject mit Fehlermeldung, die die erlaubten Einheiten nennt und explizit vor Selbst-Umrechnung warnt.
- Analyst-Prompt ([interviewAnalyst.ts:296-297](../../src/services/interviewAnalyst.ts#L296-L297)): „Ohne genannte Einheit: einheit weglassen (Default pro_monat/minuten)" ersatzlos gestrichen (widersprach der jetzt harten Pflicht); neuer Wortlaut verlangt Wert + Einheit „GENAU wie genannt" ohne Default-Fallback-Option.
- Test-Fallout gefixt: `interviewTools.test.ts` — ein Test rief `record_slot(slot=frequency, value=20)` ohne `einheit` auf (fing jetzt korrekt den neuen Hard-Reject ab), auf `einheit: 'pro_monat'` ergänzt; zweiter betroffener Call ebenso ergänzt; neuer Test `rejects frequency/duration value without einheit (H-1 remediation)` deckt den neuen Reject-Pfad explizit ab.

**Stufe 3b (Prompt-Deslop) — auf Nutzer-Wunsch zurückgestellt.** Nutzer entschied sich für „jetzt erst H-1 verifizieren, Stufe 3b danach separat" — kein Umfang-Rewrite in dieser Session, bleibt offener Punkt für eine eigene `/grilling`-Runde.

**Verifikation:** `tsc --noEmit` sauber, **66/66 Testdateien, 808/808 Tests grün** (807 + 1 neuer Reject-Test) nach jeder Stufe erneut geprüft.

## Re-Eval (2026-07-22, `google/gemini-3.1-flash-lite` it-support, Supabase-Store, `--seed` random=27831)

Judge-Preflight (general.md): echter Anthropic-Messages-Call gegen `claude-haiku-4-5` → HTTP 200 (Key valide, Guthaben verbraucht — nicht nur `/v1/models`).

**H-1 verifiziert BEHOBEN** — Live-DB-Check (`process_steps.schritt_daten->potenzial`, interview_id `e5a704b3-c4c3-42cb-819d-36099b45f984`):

| Schritt | Quote | value | einheit |
|---------|-------|-------|---------|
| hardware-tausch | „3 bis 5 Hardware-Tausch-Vorgänge pro Woche." | 3 | **pro_woche** |
| it-support | „Im Schnitt 75 bis 100 Tickets pro Woche." | 75 | **pro_woche** |
| software-installationen | „Dauert oft bis zu drei Arbeitstage." | 3 | **tage** |

Kein einziger Fall von LLM-Selbstumrechnung (das dokumentierte „15-20/Tag"→„350/Monat"-Muster trat NICHT auf) — beide Häufigkeits-Werte blieben in der roh genannten Einheit `pro_woche`, nicht auf Monat vorab-normalisiert. `blocked_writes: 0` im Trail — der neue Hard-Reject musste in diesem Lauf nie greifen, das Modell lieferte `einheit` von sich aus korrekt.

| Metrik | Wert | Gate |
|--------|------|------|
| status (Runner-Gate) | **FAIL** | — |
| dedup_slot_coverage | 0.67 | ≥0.75 ✗ |
| completion_correctness | true | =true ✓ |
| step_registration_coverage | 1.0 | ≥0.8 ✓ |
| dialog_naturalness | 0.67 | ≥0.65 ✓ (keine Regression durch Stufe 2/3a) |
| blocked_rate | 0 | <0.1 ✓ |
| talker_grounding_violations | 0 | — ✓ |
| hallucination_rate | 0 | — ✓ |

**FAIL weiterhin ausschließlich wegen `dedup_slot_coverage` 0.67 <0.75** — deckungsgleich mit der bereits dokumentierten PROJ-43-Tiefe-Lücke (Baseline 0.56–0.72 über mehrere Features hinweg), kein PROJ-45-Regress, keine neue Ursache. `dialog_naturalness` hielt exakt den Wert des vorigen it-support-Laufs (0.67) — die Stufe-3a-ID-Strips + Stufe-2-Wording-Änderungen (isoliert von der größeren Stufe-3b-Umschreibung) haben keine KI-18-artige Regression ausgelöst.

**M-1 (Dauer als Monats-/SLA-Aggregat)** bleibt offen, unverändert dokumentiert — betrifft `software-installationen`: „bis zu drei Arbeitstage" ist eine Genehmigungs-Wartezeit (SLA), nicht die reine Bearbeitungsdauer; straddle PROJ-43, kein PROJ-45-Blocker.

Artefakt: `docs/evals/interview/2026-07-22/2026-07-22-08-40-14-google-gemini-3-1-flash-lite-it-support.md`

**Bugs: 0 High : 1 Medium : 0 Low** (H-1 behoben, M-1 bleibt offen/dokumentiert wie oben).

**Nicht committet** — Working Tree enthält den vollständigen Stufe-1/2/3a-Diff (65 Dateien) + diese Spec-/INDEX-Updates. Nächster Schritt laut Nutzer-Entscheidung: `/qa PROJ-45` für finales Sign-off (Status-Übergang zu Approved ist QA-Zuständigkeit, nicht Backend), danach optional Stufe 3b in eigener `/grilling`-Runde.

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: XL / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
