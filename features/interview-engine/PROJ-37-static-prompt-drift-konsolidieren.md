# PROJ-37: Static-Prompt-Drift konsolidieren (Talker vs. Greeting/Reconnect)

## Status: Architected
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** S (Stunden–½ Tag)
**Bugs:** —
**Created:** 2026-06-25
**Last Updated:** 2026-06-25

## Dependencies
- Requires: PROJ-22 (Dual-Loop Interview Engine), PROJ-35 (interviewAgent.ts entkernen) — `talkerPrompt.ts` (Talker-STATIC_PROMPT) und `interviewAgent.ts` (`buildStaticPrompt`, Greeting/Reconnect) existieren als getrennte Module seit PROJ-35
- Related: PROJ-29 (Gesprächsführungs-Revision) — die meisten der hier fehlenden Regeln (Ausweichen-Eskalation, Akzeptanz-Phrasen-Pool, `<no_repeat>`, `<kein_kommentar>`) wurden dort für den Talker eingeführt, aber nie auf den Agent-Pfad übertragen

## Context

`src/services/talkerPrompt.ts` (`STATIC_PROMPT`, Talker — laufende Turns) und `src/services/interviewAgent.ts` (`buildStaticPrompt()`, Greeting/Reconnect — `createInterviewStream`) sind seit PROJ-35 getrennte Konstanten mit identischem Ursprung (Iteration 1, ADR-011 D7). Sie sind seither inhaltlich auseinandergelaufen, weil Verhaltens-Fixes (PROJ-29 u.a.) nur in `talkerPrompt.ts` nachgezogen wurden:

**Fehlt komplett in `buildStaticPrompt()`:**
- `<verboten>` — Themenblock gegen SAP-Transaktionscodes, Excel-Formeln, Systemdetails
- `<no_repeat>` — harte Regel gegen erneutes Erfragen bereits erfasster Werte
- `<kein_kommentar>` — Verbot von Werturteilen und Phasenwechsel-Ankündigungen
- Die gesamte Ausweichen-Eskalationslogik (Forced-Choice nach erstem Ausweichen, Akzeptanz-Phrasen-Pool mit Einmal-Nutzung)

**Direkter Widerspruch:**
- Talker: „Spannen NICHT mehr konkretisieren wenn Wert bereits erfasst ist (✓ im Tracker)."
- Agent: „Spannen konkretisieren vor dem Erfassen: ‚Du hast […] gesagt — welcher Wert trifft es besser…'"

Effekt: Auf dem Start- und Reconnect-Turn (einzige Aufrufer von `createInterviewStream`/`buildStaticPrompt`) gelten andere, teils gegensätzliche Konversationsregeln als auf jedem weiteren Talker-Turn. Erkannt 2026-06-19 beim PROJ-35-Grilling, bewusst out of scope gelassen (reine Verschiebung, keine Konsolidierung). Im PROJ-35-Post-Mortem als „größte Überraschung" markiert: ein Merge mit `origin/main` musste Talker-Prompt-Fixes händisch nach `talkerPrompt.ts` portieren, weil `buildStaticPrompt()` in `interviewAgent.ts` eine „tote Kopie" ohne diese Fixes ist — genau das Risiko, das hier behoben wird.

## Scope

`buildStaticPrompt()` in `interviewAgent.ts` importiert `STATIC_PROMPT` aus `talkerPrompt.ts` als Single Source of Truth für alle Konversationsregeln (Turn-Format, Ausweichen, Verboten-Themen, No-Repeat, Kein-Kommentar). Der bestehende `<tools>`-Block (Tool-Call-Anweisungen: stiller Hintergrund-Ablauf, `evidence_quote`, `record_governance`, `update_topics`, Pflicht-Textantwort nach Tool-Calls) bleibt als **agent-spezifisches Addendum** — der Talker ruft keine Live-Tools auf (das macht der Analyst im Dual-Loop), braucht diesen Block also nicht.

`buildStaticPrompt()` wird:
```
STATIC_PROMPT (aus talkerPrompt.ts) + <tools>-Block (agent-eigen)
```

Keine Änderung an `talkerPrompt.ts` selbst. Keine Änderung an der Dynamic-Context-Logik (`buildDynamicContext` wird von beiden Pfaden bereits gemeinsam genutzt, das ist nicht der hier behobene Drift).

## User Stories
- Als **Entwickler** möchte ich Konversationsregeln (Ausweichen, Verboten-Themen, No-Repeat) an einer Stelle ändern und automatisch auf Start-, Reconnect- und laufende Turns wirken sehen — kein Risiko mehr, eine „tote Kopie" zu vergessen.
- Als **Mitarbeiter (interviewte Person)** möchte ich auf dem allerersten Turn (Begrüßung) dieselben Regeln erleben wie auf jedem weiteren Turn — keine SAP-Detailfragen direkt nach dem Start, kein erneutes Nachfragen bei Reconnect zu bereits beantworteten Werten.
- Als **KI-Berater / Eval-Nutzer** möchte ich, dass ein Eval-Lauf nach der Konsolidierung zeigt: kein Regress auf bestehende Metriken (insbesondere `dialog_naturalness`, `overwrite_churn`), da Start/Reconnect jetzt strengeren, nicht laxeren Regeln folgen.

## Acceptance Criteria
- [ ] `interviewAgent.ts` exportiert/definiert `buildStaticPrompt()` durch Import von `STATIC_PROMPT` aus `talkerPrompt.ts` — keine eigene, abweichende Kopie des Konversationsregel-Texts mehr.
- [ ] Der `<tools>`-Block (Tool-Call-Anweisungen) bleibt vollständig erhalten und wird an `STATIC_PROMPT` angehängt — Wortlaut unverändert.
- [ ] `buildStaticPrompt()`-Output enthält nachweislich (per Test/Grep) `<verboten>`, `<no_repeat>`, `<kein_kommentar>` und die Ausweichen-Eskalationslogik — vorher nicht vorhanden.
- [ ] Der Widerspruch „Spannen konkretisieren" vs. „Spannen NICHT mehr konkretisieren" ist aufgelöst — nur noch die Talker-Regel (Akzeptanz nach erstem Ausweichen) gilt.
- [ ] **Gate:** `npm run lint` (`tsc --noEmit`) und `npm test` grün.
- [ ] **Eval-Gate (Pflicht, Interview-Engine-Domain):** mindestens ein `eval:interview`-Lauf nach der Umstellung, dokumentiert im QA-Abschnitt. Kein Regress auf `dialog_naturalness`, `overwrite_churn`, `slot_coverage` gegenüber der letzten dokumentierten Baseline.

## Edge Cases
- **Reconnect mit bereits erfassten Werten:** Der jetzt geerbte `<no_repeat>`-Block muss verhindern, dass der Agent nach einem Reconnect Werte erneut erfragt, die laut Tracker schon ✓ sind — das war vor dieser Änderung möglich (Lücke), muss danach blockiert sein.
- **Erster Turn (Start), keine History:** `STATIC_PROMPT`s Turn-1-Opener-Regel („NUR wenn history keine assistant-Nachricht enthält") muss für den Start-Pfad weiterhin korrekt greifen — Talker-Text war ursprünglich für laufende Turns geschrieben, Verhalten für Turn 1 separat verifizieren.
- **`<tools>`-Block-Reihenfolge:** Block muss nach dem importierten `STATIC_PROMPT` angehängt werden, nicht davor — Talker-Regeln sollen nicht durch nachfolgenden Tool-Kontext überschrieben/relativiert wirken.
- **Import-Zyklus:** `interviewAgent.ts` importiert bereits `buildDynamicContext` aus `talkerPrompt.ts` (seit PROJ-35) — zusätzlicher Import von `STATIC_PROMPT` aus demselben Modul ist verhalten-neutral bezüglich Zyklen (gleicher Importpfad, kein neuer).

## Technical Requirements
- **Keine DB-Migration, keine neue API-Route, kein Schema-Change.**
- **Verhaltens-Risiko bewusst akzeptiert:** Start/Reconnect-Turns werden durch diese Änderung strenger (mehr Regeln), nicht laxer — Risiko ist gering, aber Eval-Lauf ist Pflicht-Nachweis (general.md: Interview-Engine-Eval-Gate vor Approved).
- **Service-Layer-Constraint:** Änderung bleibt in `src/services/interviewAgent.ts` und nutzt bestehenden Export aus `src/services/talkerPrompt.ts`.

## Out of Scope
- Inhaltliche Überarbeitung der Konversationsregeln selbst (das ist PROJ-29-Territorium, hier nur Konsolidierung der Quelle).
- `buildDynamicContext`-Logik — bereits gemeinsam genutzt, kein Drift dort.
- Weitere Prompt-Bausteine außerhalb von Static-Prompt (z.B. Tool-Beschreibungen in `buildTools`) — nicht Teil des hier behobenen Drifts.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur (kein UI — reine Backend-Logik)

```
Interview-Start / Reconnect (Server-Route)
+-- createInterviewStream (interviewAgent.ts)
    +-- Verhaltens-Prompt          ← NEU: kommt von einer einzigen Quelle (talkerPrompt.ts)
    +-- Tool-Anweisungen           ← bleibt agent-eigen (nur hier, nicht beim Talker)
    +-- Dynamischer Kontext        ← unverändert, schon gemeinsam genutzt

Laufender Interview-Turn (Server-Route)
+-- createTalkerStream (interviewTalker.ts)
    +-- Verhaltens-Prompt          ← dieselbe Quelle wie oben
    +-- Dynamischer Kontext        ← unverändert
```

Vorher gab es zwei separate, von Hand gepflegte Verhaltens-Prompts (einen für den allerersten Turn/Reconnect, einen für alle weiteren Turns). Nachher gibt es nur noch einen — der zweite Pfad bekommt seine Tool-Anweisungen einfach dazu-gehängt.

### Daten-Modell

Keine Datenbank-Änderung, kein neues Feld. Es ändert sich nur, **woher** der Anweisungstext für die KI kommt — nicht was gespeichert wird oder wie Mitarbeiterdaten verarbeitet werden.

### Tech-Entscheidung: Warum eine einzige Quelle statt zwei synchron gehaltene?

Die zwei Prompts sind aus einem gemeinsamen Ursprung entstanden und sollten identisches Gesprächsverhalten erzeugen — nur einer von beiden bekommt seither Verhaltens-Korrekturen (z.B. "nicht zweimal nach demselben Wert fragen"), der andere nicht. Das hat in der Vergangenheit schon dazu geführt, dass ein Korrektur-Merge von einem Mitentwickler an der falschen Stelle ankam, weil zwei Kopien existierten.

**Mit einer Quelle:** jede zukünftige Verhaltens-Korrektur wirkt automatisch auf beide Einstiegspunkte (erster Turn, Reconnect, laufender Turn). Kein "wo muss ich das auch noch ändern"-Risiko mehr.

**Nutzer-Effekt:** Mitarbeiter erleben auf dem allerersten Turn und nach einem Verbindungsabbruch dieselben Gesprächsregeln wie auf jedem weiteren Turn — z.B. wird nicht erneut nach einem Wert gefragt, den sie schon genannt haben, und es werden keine irrelevanten technischen Detailfragen (SAP-Codes, Excel-Formeln) gestellt.

### Risiko & Absicherung

Die Verhaltens-Regeln für Start/Reconnect werden dadurch **strenger** (mehr Regeln gelten), nicht lockerer — geringes Risiko für neues Fehlverhalten. Trotzdem Pflicht: ein Eval-Lauf nach der Umstellung (Interview-Engine-Domain-Regel), der prüft, dass sich die Gesprächsqualität nicht verschlechtert.

### Dependencies
- Keine neuen Packages.

### Out of Scope (bestätigt aus Spec)
- Inhaltliche Überarbeitung der Regeln selbst — nur Zusammenführung der Quelle.
- Tool-Beschreibungen und dynamischer Kontext — unverändert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
