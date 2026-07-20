# PROJ-45: Schema-Konsolidierung + AI-Wert-Faktoren

## Status: Planned
**Type:** Revision
**Domain:** Wissensbank
**Extends:** PROJ-25
**Appetite:** XL
**Bugs:** —
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

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
| Appetite vs. tatsächlich | geschätzt: XL / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
