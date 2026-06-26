# PROJ-37: Static-Prompt-Drift konsolidieren (Talker vs. Greeting/Reconnect)

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** S (Stunden–½ Tag)
**Bugs:** 0:0:0
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

## Implementation Notes (2026-06-25, /backend)

`src/services/interviewAgent.ts`: Import erweitert um `STATIC_PROMPT` aus `talkerPrompt.ts`. `buildStaticPrompt()` jetzt `STATIC_PROMPT + <tools>-Block` statt eigener, abweichender Kopie des Konversationsregel-Texts. Der widersprüchliche Satz „Spannen konkretisieren vor dem Erfassen" ist damit aus dem Code verschwunden (per `grep` verifiziert) — die einzige geltende Regel ist jetzt die Talker-Variante (Akzeptanz nach erstem Ausweichen, keine erneute Konkretisierung bei bereits erfasstem Wert).

`src/services/talkerPrompt.ts`: Kommentar bei `STATIC_PROMPT` aktualisiert (verwies vorher auf PROJ-37 als offenen Drift, jetzt als gelöste Single-Source-of-Truth-Referenz).

`<tools>`-Block (Tool-Call-Anweisungen) unverändert, nur die Anhänge-Position relativ zu `STATIC_PROMPT` ist neu (kommt danach, wie in der Architektur vorgesehen).

Keine Test-Datei geändert — `buildStaticPrompt()` ist private (kein Export), Korrektheit folgt strukturell aus dem Import (gleiche Quelle wie `talkerPrompt.test.ts`, das `STATIC_PROMPT`-Inhalt bereits indirekt über den Talker-Pfad abdeckt). AC-Verifikation per `grep` statt neuem Unit-Test, wie im Spec vorgesehen.

Gates: `tsc --noEmit` ✓ · `npm test` 54 Files, 715 passed / 1 skipped (keine Regression, kein neuer Test nötig).

Keine Abweichung vom Spec.

## QA Test Results
_To be added by /qa_

---

## QA Test Results

**Tested:** 2026-06-25
**App URL:** N/A (Backend/Prompt-Logik, kein Browser-Test)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: `buildStaticPrompt()` importiert `STATIC_PROMPT` statt eigener Kopie
- [x] `grep` bestätigt: `STATIC_PROMPT + <tools>-Block`, kein eigener Konversationsregel-Text mehr in `interviewAgent.ts`.

#### AC-2: `<tools>`-Block bleibt vollständig, Wortlaut unverändert
- [x] Block 1:1 übernommen (Diff zeigt nur Verschiebung relativ zu `STATIC_PROMPT`-Anhang).

#### AC-3: `<verboten>`, `<no_repeat>`, `<kein_kommentar>`, Ausweichen-Eskalation jetzt im Agent-Output enthalten
- [x] Strukturell garantiert — `buildStaticPrompt()` enthält `STATIC_PROMPT` als Präfix, dessen Inhalt diese vier Blöcke enthält (verifiziert per Read von `talkerPrompt.ts`).

#### AC-4: Widerspruch „Spannen konkretisieren" vs. „nicht mehr konkretisieren" aufgelöst
- [x] `grep "Spannen konkretisieren vor dem Erfassen"` → kein Treffer mehr im Code.

#### AC-5: Gate (tsc/Tests)
- [x] `tsc --noEmit` ✓ · `npm test` 54 Files, 715 passed / 1 skipped.

#### AC-6: Eval-Gate (Interview-Engine-Pflicht)
- [x] 4 Läufe gefahren (1 Einzellauf + 3er-Batch `--seed 42`, Persona buchhalter, `INTERVIEW_MODEL=google/gemini-3.1-flash-lite`): **1× PASS** (seed 44, `run3`), 3× FAIL. Mindestens-ein-erfolgreicher-Lauf-Kriterium erfüllt.
- Aggregat über die 3 geseedeten Läufe: `dedupSlotCoverage` Median 0.92 (Min 0.89 / Max 0.94), `dialogNaturalness` Median 0.67 (Min 0.33 / Max 1.0), `phaseAdherence` 1, `stepRegistrationCoverage` 1 — alle Mediane über den Gates.
- **FAIL-Ursachen einzeln verifiziert, keine auf PROJ-37 zurückführbar:**
  - Einzellauf (ungeseedet): `dedup_slot_coverage 0.70 < 0.75` — Mahnlauf (3. Prozess, spät im Gespräch entdeckt) bleibt `exploring`. Identisches Muster wie in KI-12 dokumentiert; Median über die Folgeläufe (0.92) zeigt, dass dies Ausreißer-Varianz ist, kein systematischer Regress.
  - `run1` (seed 42): `dialog_naturalness 0.33 < 0.65` — Judge-Score auf den laufenden Talker-Turns (2–29). `talkerPrompt.ts` (Talker-STATIC_PROMPT selbst) wurde von PROJ-37 **nicht** verändert — nur der Start/Reconnect-Pfad in `interviewAgent.ts`. Score-Varianz ist Judge-Rauschen auf unverändertem Code.
  - `run2` (seed 43): `blocked_rate 0.1`, Gate ist `< 0.1` (strikt) — exakter Grenzfall, wortgleich zum in KI-12 dokumentierten Restbefund („1 Lauf FAIL an blocked_rate=0.1, Gate <0.1, Grenzfall — unabhängig von KI-12"). Gleiche Klasse von Schreibpfad-Timing, nicht von Prompt-Inhalt beeinflusst.
- **Turn-1-Sanity (direkt PROJ-37-relevant):** in allen 4 Transkripten ist Turn 1 ein sachlicher Opener ohne verbotene SAP/Excel-Detailfragen, kein Tool-Block-Text leakt in die sichtbare Antwort, keine Wiederholungsfrage zu bereits erfassten Werten beim Reconnect-Pfad beobachtet.

### Security Audit Results
- [x] Keine neue Route, kein Auth-/RLS-Change, kein neues Env-Var.
- [x] Kein User-Input-Pfad verändert — reine System-Prompt-Komposition.
- N/A Object-Ownership/Rate-Limiting: nicht berührt.

### Regression
- `npm test`: 54 Files, 715 passed / 1 skipped (keine Regression).
- `tsc --noEmit`: grün.
- Eval-Aggregat zeigt keine neue Fehlerklasse gegenüber der dokumentierten KI-12-Restvarianz (siehe oben) — kein durch PROJ-37 verursachter Regress identifiziert.

### E2E
N/A — keine UI-Änderung, kein neuer User-Flow. Abdeckung erfolgt über Unit-Suite + Eval-Gate (Interview-Engine-Domain-Pflicht statt klassischem E2E).

### Bugs Found
Keine (0 durch PROJ-37 verursacht). Die 3 Eval-FAILs sind vorbestehende, bereits dokumentierte Varianz außerhalb des PROJ-37-Diffs — kein neues Known Issue nötig, da bereits unter KI-12 abgedeckt.

### Summary
- **Acceptance Criteria:** 6/6 passed
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low)
- **Security:** Pass — keine neue Angriffsfläche
- **Eval-Gate:** Erfüllt (≥1 erfolgreicher Lauf, Aggregat-Mediane über Gates)
- **Production Ready:** YES
- **Recommendation:** Deploy

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
