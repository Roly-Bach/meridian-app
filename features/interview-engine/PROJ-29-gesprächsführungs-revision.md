# PROJ-29: Gesprächsführungs-Revision

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-23
**Appetite:** L (1–2w)
**Bugs:** —
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Context

Die Interview-Engine führt Gespräche nach dem Walkthrough-Protokoll (ADR-008/ADR-011). Sieben Gesprächsführungs-Dimensionen sind im Ist-Stand lückenhaft oder fehlen ganz:

| BL-Item | Dimension | Verdikt |
|---------|-----------|---------|
| E3.1 | Semantischer Ambiguitäts-Auslöser | neubauen |
| E3.2 | Ausnahme-Auslöser + Ziel-/Kontextsteuerung | anpassen |
| E3.3 | Konzept-verankerte Nachfrage | anpassen |
| E3.4 | Laddering / Abstraktions-Vertiefung | anpassen |
| E3.5 | Maieutische Schärfung | anpassen |
| E3.6 | Profil-adaptives Framing | anpassen |
| E3.7 | Lösungssperre / Ist-Fokus | anpassen |

Alle Änderungen leben in `src/services/interviewAgent.ts`. Kein neues Tool, kein neuer API-Endpoint, keine DB-Änderung. Der Lücken-Auslöser (`computeMissingMandatorySlots`), die ANKER-SPERRE und `anchoringViolations`-Scorer bleiben vollständig erhalten.

Die Arbeit ist überwiegend Prompt-Revision, aber nicht ausschließlich. Die Dimensionen mit zählbaren oder stateful Garantien (E3.1 Konflikt-Erkennung, E3.2 Re-Kontextualisierungs-Cap, E3.4 Blockade-Signal und Zwei-Turn-Abbruch) folgen dem im Code bereits etablierten Hybrid-Muster: ein deterministischer Detektor oder Zähler im Code spannt eine Direktive in den Prompt, der Prompt ist der Aktuator. Das setzt die vorhandenen In-File-Helfer fort (drill-stop über `recentAssistantTurns`, refuse-detect über `lastUserTurn`, Cross-Turn-Zähler über `next_briefing`/`usedFillerPhrases`, Detektor-Pattern wie `extractNumericTokens`) und ist kein neues Tool, kein Endpoint, keine DB-Änderung. Reine Prompt-Anweisung trägt diese drei Garantien nicht verlässlich.

**Traceability:** BL-E3.1–E3.7 → REQ-001, REQ-002, REQ-016, REQ-017, REQ-024, REQ-025, REQ-026, REQ-027

## Dependencies

- **Hard Prerequisite: PROJ-25** — O1–O5-Schema muss existieren, damit der Ambiguitäts-Auslöser (E3.1) inhaltlich referenzierbare Konzepte vorfindet
- **Hard Prerequisite: PROJ-27** — stabile S001-Schritt-IDs als Anker für Konzept-Verankerung (E3.3)
- **Parallel: PROJ-28** — Konfidenz-basierter Nachfrage-Auslöser (BL-E2.2) ist PROJ-28-Scope; E3.2 überschneidet sich nicht
- **Parallel: PROJ-30/31** — metrische Schwellen-Verifikation ist PROJ-31-Scope; PROJ-29 liefert die Prompt-Basis

## User Stories

- Als **KI-Berater** möchte ich, dass die Engine widersprüchliche Aussagen des Befragten aktiv klärt, damit Prozessschritte keine inneren Inkonsistenzen enthalten.
- Als **Befragter** möchte ich, dass die Engine auf Ausnahmen und Sonderfälle eingeht, damit mein implizites Prozesswissen vollständig abgebildet wird.
- Als **KI-Berater** möchte ich, dass jede Engine-Nachfrage konkret an eine Aussage des Befragten anknüpft, damit das Interview kohärent und nicht beliebig wirkt.
- Als **Befragter** möchte ich, dass die Engine mich nicht bittet, Verbesserungslösungen vorzuschlagen, damit ich nur das tatsächliche Ist-Vorgehen beschreibe.
- Als **KI-Berater** möchte ich, dass die Engine profil-adaptiv nachfragt (Tiefe, Fachbegriffe), damit die Fragen meinen Interviewpartner nicht überfordern oder unterfordern.
- Als **Befragter** möchte ich, dass die Engine bei Blockade andere Vertiefungstechniken einsetzt, damit ich nicht stecken bleibe.
- Als **KI-Berater** möchte ich, dass die Engine bei Abschweifung das Gespräch zurück zum Interviewziel führt, damit keine wesentlichen Prozesse übersprungen werden.

## Acceptance Criteria

### BL-E3.1 — Ambiguitäts-Auslöser

- [ ] Engine erkennt konfligierende Aussagen innerhalb der aktuellen Session (z.B. "Das dauert 5 Minuten" vs. spätere Beschreibung eines mehrstündigen Vorgangs zum gleichen Schritt) und stellt eine Nachfrage, die den Widerspruch explizit benennt — nicht einen fehlenden Wert anfordert
- [ ] Ambiguitäts-Nachfrage unterscheidet sich strukturell von Lücken-Nachfrage: benennt beide konfligierenden Aussagen ("Du hast vorhin X erwähnt — jetzt beschreibst du Y. Was ist der Unterschied?")
- [ ] `computeMissingMandatorySlots` bleibt unverändert — Ambiguitäts-Auslöser ist additiv, nicht ersetzend
- [ ] Die Konflikt-Erkennung stützt sich auf eine deterministische Vergleichsfläche (neue Aussage gegen den erfassten Slot-Stand und das `recentAssistantTurns`-Fenster), nicht allein auf spontanes Bemerken durch das Modell; sonst ist die ≥80%-Klassifikation (REQ-016) prompt-seitig nicht verlässlich erreichbar

### BL-E3.2 — Ausnahme-Auslöser + Ziel-/Kontextsteuerung

- [ ] Erwähnt der Befragte eine Abweichung vom Normalfall ("manchmal", "außer wenn", "im Sonderfall", "wenn X dann Y"), vertieft die Engine explizit: eine Nachfrage zu diesem Sonderfall statt sofort weiterzugehen
- [ ] Bei Abschweifung (keine Register-Kandidaten, keine Slot-Signale, kein Walkthrough-Content in der Antwort) re-kontextualisiert die Engine in einem Satz auf das Interviewziel und einen offenen Punkt, bevor sie weiterfragt
- [ ] Re-Kontextualisierung tritt nicht öfter als einmal in drei aufeinanderfolgenden Turns auf; der Abstand wird über einen deterministischen Cross-Turn-Zähler im `next_briefing` geführt (analog `usedFillerPhrases`), nicht über Prompt-internes Turn-Zählen
- [ ] Slot-Coverage-Lücken werden weiterhin von der bestehenden `coverage_check`-Phase nachgefüllt — BL-E3.2 fügt keinen neuen Mechanismus dafür ein

### BL-E3.3 — Konzept-verankerte Nachfrage

- [ ] Jede Nachfrage der Engine enthält einen expliziten Rückbezug auf ein Konzept, eine Aussage oder einen Schritt aus den letzten vier Befragten-Turns (Vorkontext-Fenster per REQ-017)
- [ ] Ein Konzept das der Befragte verneint hat ("nutzen wir KEIN Excel", "passiert bei uns NIE") wird nicht als positiver Anker einer Folgefrage verwendet
- [ ] Die bisherige Negativ-Formulierung ("keine noch nicht genannten Daten") im Prompt wird durch eine positive Anker-Regel ersetzt

### BL-E3.4 — Laddering

- [ ] Bei Blockade-Signal — Antwort mit weniger als ca. 10 Wörtern ODER Formulierungen wie "weiß ich nicht", "keine Ahnung", "ist halt so", "immer schon so" — wechselt die Engine die Frametechnik: Perspektivwechsel, Beispiel-Einladung ("Kannst du ein konkretes Beispiel nennen?") oder vereinfachende Reformulierung
- [ ] Engine stellt bei Blockade keine strukturell identische Folgefrage (kein Wiederholungs-Retry des gleichen Turns)
- [ ] Hält die Blockade nach zwei Laddering-Turns an, lässt die Engine das Thema fallen und geht zum nächsten Aspekt über
- [ ] Das Blockade-Signal (Wortzahl-Schwelle plus Phrasen-Treffer auf `lastUserTurn`) wird deterministisch erkannt, analog dem bestehenden refuse-detect (F1b); der Zwei-Turn-Abbruch läuft über einen deterministischen Laddering-Zähler im `next_briefing`, nicht über Prompt-Zählen

### BL-E3.5 — Maieutische Schärfung

- [ ] Engine-Nachfragen führen den Befragten durch offene Fragen zur Eigen-Artikulation: keine Antwortinhalte vorwegnehmen, kein "wäre das so wie X?"
- [ ] ANKER-SPERRE und `extractNumericTokens`-Prüfung bleiben unverändert; Zahlenprimat-Rate im bestehenden Eval-Harness sinkt nachweislich gegenüber der Baseline (Verifikation in PROJ-31)
- [ ] Engine-Nachfragen enthalten keine inhaltlichen Eigenvorschläge ("Was wäre, wenn du Tool X hättest?", "Könntest du das automatisieren?")

### BL-E3.6 — Profil-adaptives Framing

- [ ] Engine passt Sprachtiefe und Fachbegriff-Wahl an `employeeRole` und `department` an, die bereits im Kontext injiziert sind
- [ ] Fachfremde Rollen (z.B. "Sachbearbeitung", "Verwaltung") bekommen alltagsnahe Formulierungen; Fach- und IT-Rollen bekommen Domänen-Terminologie gespiegelt
- [ ] Fehlende Profilfelder (`employeeRole=null`): Engine verhält sich wie bisher — keine Fehler, kein Fallback-Branching

### BL-E3.7 — Lösungssperre / Ist-Fokus

- [ ] Engine stellt keine Fragen die den Befragten zur Formulierung von Verbesserungsideen oder Zukünftigen Wünsche einladen ("Was würdest du ändern?", "Wenn du X optimieren könntest...")
- [ ] Die milde To-be-Einladung im aktuellen `wrap_up`-Prompt ("Wenn du einen Punkt ändern könntest") wird entfernt oder durch eine Ist-orientierte Alternative ersetzt
- [ ] Beschreibt der Befragte spontan eine Verbesserungsidee, nimmt die Engine sie zur Kenntnis und vertieft das zugrundeliegende Ist-Problem — fordert aber keine weiteren Lösungsideen an

## Edge Cases

- **Ambiguität + Lücke im gleichen Turn**: Engine priorisiert Ambiguitäts-Klärung — eine Frage pro Turn, Lücken-Nachfrage im Folgeturn
- **Ausnahme ist selbst ein eigenständiger Prozessschritt**: Engine stellt 1–2 Vertiefungsfragen, übergibt dann an `process_loop` → `register_step` (bestehender Weg)
- **Negations-Aussage als Teil einer Ambiguität**: "Wir nutzen kein SAP" + späteres "natürlich prüfe ich in SAP nach" — Engine benennt beide Aussagen im Klärungsturn
- **Profil-Kontext fehlt vollständig** (`employeeRole`, `department` beide null): keine Verhaltensänderung, kein Fehler; Framing bleibt neutral
- **Laddering ohne Fortschritt nach zwei Versuchen**: Engine lässt das Thema fallen und geht zum nächsten Schritt/Slot über — kein Loop
- **Befragter beschreibt To-be spontan**: Engine nimmt die Ist-Perspektive dahinter auf ("Was ist heute der Engpass, der das nötig macht?") statt weiter To-be zu vertiefen
- **Re-Kontextualisierung zu häufig**: Mechanismus greift nicht in zwei direkt aufeinanderfolgenden Turns — Mindestabstand drei Turns
- **Ambiguitäts-Auslöser bei echter Unsicherheit des Befragten**: "Ich glaube es sind 5 Minuten — oder vielleicht 10" ist keine Ambiguität (Unsicherheit), sondern ein Lücken-Kandidat; Engine unterscheidet anhand ob zwei faktisch unterschiedliche Aussagen vorliegen

## Out of Scope

- Neue Eval-Judges oder Eval-Metriken (PROJ-31 Scope)
- Agenten-Trennung / Preparator-Architektur (PROJ-32, vertagt auf TF3)
- Konfidenz-basierter Nachfrage-Auslöser aus BL-E2.2 (PROJ-28 Scope)
- Extraktion, `knowledge_objects`- oder `process_steps`-Writes (PROJ-28 Scope)
- Neue DB-Tabellen, DB-Spalten oder API-Endpoints
- Neue npm-Pakete

## Technical Requirements

- Alle Änderungen in `src/services/interviewAgent.ts`
- Primär betroffene Funktionen: `buildPhaseMethodology()`, `buildDynamicContext()`
- Deterministische Stütz-Schicht (kein neues Tool, kein Endpoint, keine DB): die zählbaren und stateful Haken (E3.1 Konflikt-Vergleich, E3.2 Re-Kontext-Cap, E3.4 Blockade-Erkennung und Zwei-Turn-Abbruch) werden über kleine In-File-Helfer plus vorhandene Kontextfelder getragen, die dem etablierten Muster folgen: `recentAssistantTurns` (4-Turn-Fenster, deckt zugleich REQ-017), `lastUserTurn` (refuse-detect F1b), Cross-Turn-Zähler im `next_briefing`/`usedFillerPhrases`, Detektor-Pattern wie `extractNumericTokens`. Der Prompt bleibt der Aktuator
- Bestehende Invarianten bleiben erhalten: ANKER-SPERRE, `computeMissingMandatorySlots`, `coverage_check`-Phase, `anchoringViolations`-Scorer, `extractNumericTokens`, drill-stop (`recentAssistantTurns`), refuse-detect (`lastUserTurn`)
- Nach Implementierung: einen `/eval:interview`-Lauf mit einer repräsentativen Persona (Empfehlung: `buchhalter`) durchführen, um Regression zu überprüfen
- Metrische Schwellen (REQ-016 ≥80 %, REQ-017 ≥85 %, REQ-025 Cue-Ausbeute, REQ-026/027 Rater-Werte) werden in PROJ-31 mit verfeinerten Judges verifiziert; PROJ-29 liefert die Prompt-Basis

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht

PROJ-29 ist eine reine In-File-Revision von `src/services/interviewAgent.ts`. Keine neue Datenbank-Tabelle, kein neuer API-Endpoint, kein neues npm-Paket. Die sieben Gesprächsführungs-Dimensionen verteilen sich auf zwei Implementierungsschichten.

---

### Schicht A — Reine Prompt-Revisionen (`buildPhaseMethodology`)

Vier Dimensionen haben keine stateful Garantie — sie werden als Direktiven im phasenspezifischen Methodologie-Block formuliert. Kein neuer Helfer, kein Zähler.

| Dimension | Phase(n) | Änderung |
|-----------|----------|----------|
| **E3.3 Konzept-verankerung** | walkthrough_step, slot_completion, coverage_check | Bestehende Negativformulierung ("keine noch nicht genannten Daten") wird durch eine positive Anker-Pflicht ersetzt: jede Nachfrage muss ein Konzept, eine Aussage oder einen Schritt aus den letzten vier Befragten-Turns explizit referenzieren. Negations-Aussagen ("nutzen wir kein SAP") werden als explizite Anti-Anker gelistet. |
| **E3.5 Maieutische Schärfung** | alle aktiven Phasen | Neue Regel im Methodologie-Text: keine inhaltlichen Eigenvorschläge in Fragen ("Was wäre, wenn du Tool X hättest?"), keine Leading-Questions ("Wäre das wie...?"). ANKER-SPERRE und `extractNumericTokens`-Prüfung bleiben unverändert. |
| **E3.6 Profil-adaptives Framing** | alle aktiven Phasen | `buildPhaseMethodology` wird um `employeeRole` und `department` als Parameter erweitert. Fachfremde Rollen (Verwaltung, Sachbearbeitung) erhalten die Direktive für alltagsnahe Sprache; Fach-/IT-Rollen bekommen Domänen-Terminologie gespiegelt. Fehlende Profil-Felder → kein Fallback-Branching, neutrales Framing wie bisher. |
| **E3.7 Lösungssperre / Ist-Fokus** | wrap_up + alle aktiven Phasen | To-be-Einladung ("Wenn du einen Punkt ändern könntest") aus `wrap_up`-Prompt entfernen. Neue Ist-Fokus-Direktive in `walkthrough_step` und `slot_completion`: keine Fragen die Verbesserungsideen einladen; spontane To-be-Nennungen → Ist-Problem dahinter vertiefen. |

---

### Schicht B — Detektor → Direktive (`buildDynamicContext` + drei neue private Helfer)

Drei Dimensionen brauchen deterministische Detektion oder Cross-Turn-Zähler, weil reine Prompt-Anweisung die Garantien aus den REQs nicht trägt. Das Muster folgt exakt dem etablierten drill-stop / ANKER-SPERRE Hybrid: ein Helfer analysiert den Turn-Zustand, `buildDynamicContext` injiziert eine zwingend markierte Direktive (`⚠️` / `⛔`) wenn der Helfer feuert.

#### E3.1 — Ambiguität-Detektor

```
detectAmbiguity(lastUserTurn, stepTracker, recentAssistantTurns)
  → { conflict: true, phraseA: string, phraseB: string } | null
```

**Was es tut:** Vergleicht den aktuellen `lastUserTurn` gegen bereits erfasste Slot-Werte im `stepTracker` und gegen das `recentAssistantTurns`-Fenster (4 Turns). Konflikt = zwei faktisch unterschiedliche Aussagen zum gleichen Sachverhalt.

**Detektion (deterministisch):**
- Numerische Konflikte: `extractNumericTokens` auf `lastUserTurn` + zugehörige Slot-Werte → Größenordnungsvergleich (≥ Faktor 3 = Konflikt-Kandidat)
- Terminologische Widersprüche: Pattern-Match auf "aber eigentlich", "oder doch", "obwohl vorhin" im `lastUserTurn`
- Unsicherheit ("ich glaube", "vielleicht", "ungefähr") = kein Konflikt, nur Lücken-Kandidat

**Inject:** `## ⚠️ AMBIGUITÄT-KLÄRUNG` Block mit phraseA und phraseB — Talker benennt beide Aussagen explizit. Lücken-Nachfrage (`computeMissingMandatorySlots`) bleibt erhalten — additiv, nicht ersetzend. Priorität: Ambiguität geht vor Lücke in diesem Turn.

---

#### E3.2 — Ausnahme-Detektor + Re-Kontextualisierungs-Cap

**Ausnahme-Detektion (stateless, per-Turn):**

```
detectException(lastUserTurn) → boolean
```

Regex auf Ausnahme-Signale: `manchmal`, `außer wenn`, `im Sonderfall`, `wenn .* dann`, `aber nicht immer`. Bei Treffer injiziert `buildDynamicContext` eine "Ausnahme vertiefen"-Direktive.

**Re-Kontextualisierungs-Cap (stateful):**

Der Mindestabstand von drei Turns zwischen Re-Kontextualisierungen wird über einen neuen Cross-Turn-Zähler `recontextStreak` im `AnalystBriefing` / `InterviewContext` getragen — identisches Bridge-Muster wie `usedFillerPhrases`:

```
AnalystBriefing  →  (next_briefing JSON)  →  InterviewContext
  recontextStreak?: number                    recontextStreak?: number
```

- `recontextStreak` = 0 → soeben re-kontextualisiert, Cap aktiv
- `recontextStreak` ≥ 3 → Re-Kontextualisierung erlaubt
- `buildDynamicContext` injiziert Re-Kontext-Direktive nur wenn `recontextStreak` ≥ 3 (oder undefined)
- Der Analyst inkrementiert/resetzt den Zähler als Teil des normalen `AnalystBriefing`-Writes (kein neues Tool)

---

#### E3.4 — Blockade-Detektor + Laddering-Zähler

```
detectBlockade(lastUserTurn) → boolean
```

Feuert wenn:
- Wortanzahl `lastUserTurn` < 10 (Schwelle analog `detectPersonaRefuse`)
- ODER Phrase-Match: "weiß ich nicht", "keine Ahnung", "ist halt so", "immer schon so", "weiß nicht genau"

**Laddering-Direktive:** Bei Blockade injiziert `buildDynamicContext` `## ⚠️ LADDERING` Direktive: Frametechnik wechseln — Perspektivwechsel, Beispiel-Einladung oder vereinfachende Reformulierung. Keine strukturell identische Folgefrage.

**Zwei-Turn-Abbruch:** Cross-Turn-Zähler `ladderiungStreak` (Bridge analog E3.2):

```
AnalystBriefing  →  InterviewContext
  ladderiungStreak?: number
```

- Nach 2 Laddering-Turns: `buildDynamicContext` injiziert `⛔ LADDERING-ABBRUCH`: Thema fallen lassen, nächsten Aspekt/Schritt adressieren

---

### Neue Interface-Felder

Zwei neue optionale Felder folgen dem `usedFillerPhrases`-Muster — Bridge von `AnalystBriefing` → `InterviewContext` → `buildDynamicContext`:

```
AnalystBriefing:
  + recontextStreak?: number    // 0 = soeben rekontext., ≥3 = erlaubt, undefined = noch nie
  + ladderiungStreak?: number   // 0 = kein Blockade-Turn, 1 = erster, 2+ → Abbruch

InterviewContext:
  + recontextStreak?: number
  + ladderiungStreak?: number
```

Alle Felder optional — keine Breaking Changes an bestehenden Aufrufen.

---

### Was unverändert bleibt

| Invariante | Warum |
|------------|-------|
| `computeMissingMandatorySlots` | E3.1 ist additiv — Lücken-Nachfrage bleibt eigenständig |
| ANKER-SPERRE + `extractNumericTokens` | E3.5 erweitert nur Prompt-Direktiven |
| `anchoringViolations`-Scorer | liegt in Analyst-Scope |
| `detectDrillStops` / drill-stop | E3.4 Blockade-Detektor ist komplementär |
| `detectPersonaRefuse` / refuse-detect | E3.4 erweitert Phrasen-Liste nicht destruktiv |
| `coverage_check`-Phase-Logik | kein PROJ-29-Scope |
| DB-Schema, API-Routes, npm-Pakete | keine Änderungen |

---

### Betroffene Dateien

| Datei | Änderungstyp |
|-------|-------------|
| `src/services/interviewAgent.ts` | alle Änderungen (Schicht A + B) |
| Keine anderen Dateien | — |

---

### Verifikation nach Implementierung

Einen `/eval:interview`-Lauf mit Persona `buchhalter` durchführen. Metrische Schwellen (REQ-016 ≥80%, REQ-017 ≥85%) werden in PROJ-31 verifiziert — PROJ-29 liefert die Prompt-Basis.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
