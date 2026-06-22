# PROJ-39: Eval-Judge-Parsing-Härtung (dialog_naturalness + slotDepth)

## Status: Deployed
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-31
**Appetite:** S (1-2d)
**Bugs:** 0:0:1
**Created:** 2026-06-20
**Last Updated:** 2026-06-21

## Dependencies
- **Revidiert:** PROJ-31 (Eval-Schärfung: Judge, Perturbation, Robustheit). Genau die Judge-Robustheit ist hier verletzt.
- **Related:** PROJ-30 (Tiefe-/O10-Metrik) besitzt den `slotDepth`-Judge; PROJ-13 (Observability).
- **Related:** PROJ-38 (Slot-Write-Encoding). Selbe Eval-Welle (~2026-06-18). PROJ-38 hat die eine Ursache des Eval-Signalverlusts behoben (Encoding); PROJ-39 behebt die zweite (Judge-Parsing).
- **Absorbiert:** Known Issues KI-3 (dialog_naturalness-Parsing) und KI-4 (Skill-Doc stale Slot-Namen).

## Context

Nach PROJ-38 scheitert das Eval-Gate ([runner.ts:435-441](../../src/services/__evals__/interview/runner.ts#L435-L441)) an genau einer Bedingung: `dialogNaturalness >= 0.7`. Alle anderen Bedingungen passen. Der Wert ist konstant 0.5, der Fallback aus [dialogNaturalness.ts:48-51](../../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L48-L51): `parseJudgeResponse` sucht einen `Stufe: X`-Marker (Regex), findet ihn nicht und fällt auf 0.5. Mit `maxOutputTokens: 300` und einer langen Begründung wird der finale Marker plausibel abgeschnitten (im Lauf 19-43 war die Begründung lang, der Score trotzdem 0.5). Folge: jeder Lauf scheitert am Gate, unabhängig von der echten Gesprächsqualität. Das ist der jetzt alleinige Blocker für ein grünes Eval-Label (KI-3, in INDEX als High eingestuft).

`slotDepth` ([slotDepth.ts:117-130](../../src/services/__evals__/interview/scorers/slotDepth.ts#L117-L130)) hat dieselbe Fragilitätsklasse: `JSON.parse(cleaned)` in `try/catch`, das bei einem nicht exakt geformten Judge-Output still `null` zurückgibt. Im 19-43-Lauf hat es funktioniert, aber ein einzelner Judge darf nicht stillschweigend eine Metrik (oder das Label) kippen.

KI-4: die `/eval-interview`-Skill-Doku beschreibt in Schritt 3/4 noch die alten Slot-Namen (`frequency_per_month` als `slots.*`, `rule_based`, `data_sources`) statt des aktuellen PROJ-25/27-Schemas (O-Slots + `potenzial`-Facette).

## User Stories

- Als **Eval-Nutzer / KI-Berater** möchte ich, dass `dialog_naturalness` einen echten geparsten Score liefert statt des 0.5-Fallbacks, damit das Gate ein wahres PASS/FAIL emittiert.
- Als **Entwickler** möchte ich, dass die LLM-Judge-Parser robust gegen erwartbare Formatvarianten und Truncation sind, damit ein einzelner Judge nicht still das gesamte Eval-Label kippt.
- Als **Entwickler** möchte ich, dass `slotDepth` bei einem wiederherstellbaren Judge-Output nicht still `null` zurückgibt.
- Als **Eval-Nutzer** möchte ich, dass die `/eval-interview`-Skill-Doku das aktuelle Schema (O-Slots + `potenzial`) beschreibt, damit die PASS-Kriterien nicht an nicht existierenden Slot-Namen prüfen.

## Acceptance Criteria

- [ ] Ein normaler buchhalter-Lauf (flash) erzeugt einen geparsten `dialog_naturalness`-Score (Stufe 1/2/3 → 0.33/0.67/1.0), **nicht** den 0.5-Fallback. Die Warnung `[dialogNaturalness] unexpected format, fallback 0.5` erscheint im Lauf nicht.
- [ ] Bei einem tatsächlich guten Gespräch erreicht der Lauf die Gate-Bedingung `dialogNaturalness >= 0.7`, sodass das Gesamt-Label PASS sein **kann** (Encoding ist via PROJ-38 bereits gefixt).
- [ ] `parseJudgeResponse` ist gegen die zuvor fehlschlagende Variante abgesichert (zuverlässig vorhandener + parsbarer Marker, z.B. via Output-Kontrakt/Token-Budget/tolerantes Parsing). Ein Unit-Test in `dialogNaturalness.test.ts` deckt genau diese Variante ab und schlägt vor dem Fix fehl.
- [ ] `slotDepth`-Judge-Parsing: ein wiederherstellbarer Output (z.B. Markdown-Fence-Varianten oder Zusatztext um das JSON-Array) wird geparst statt still `null`. Ein Unit-Test in `slotDepth.test.ts` deckt es ab.
- [ ] Die `/eval-interview`-Skill-Doku (Schritt 3 Slot-Beschreibung, Schritt 4 PASS-Kriterien, Schritt-0-Hinweis zu `ANALYST_THINKING_BUDGET`) beschreibt das aktuelle PROJ-25/27-Schema (`inputs`/`outputs`/`ausnahmen`/`hilfsmittel`/`tazite_cues`/`entscheidungslogik` + `potenzial`-Facette) statt der alten Slot-Namen.
- [ ] **Gate:** `tsc --noEmit` und `npm test` grün; `dialogNaturalness.test.ts` und `slotDepth.test.ts` erweitert.
- [ ] Ein frischer buchhalter-Lauf ist dokumentiert; `dialog_naturalness` ist ein echter Score und das Gesamt-Label spiegelt die reale Qualität (kein durch Parsing erzwungener FAIL mehr).

## Edge Cases

- **Echter Judge-Call-Fehler (API):** Der 0.5-Fallback bei einem fehlgeschlagenen `generateText`-Call ([dialogNaturalness.ts:100-103](../../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L100-L103)) bleibt legitim. Parsing-Fallback und Call-Fail-Fallback müssen unterscheidbar bleiben (nur der Parsing-Fall wird behoben).
- **Mehrere `Stufe: X` im Output:** Der letzte zählt (bestehendes Verhalten beibehalten).
- **Leeres Gespräch (`agentTexts` leer):** 0.5 bleibt korrekt (kein Material), kein Parsing-Bug.
- **slotDepth-Judge gibt echtes Nicht-Array/leer zurück:** `null` bleibt für echte Fehler; nur wiederherstellbare Formate werden zusätzlich geparst.

## Technical Requirements

- **Keine Änderung der Metrik-Definitionen.** Das Stufe→Score-Mapping (0.33/0.67/1.0) und die Rubriken bleiben; nur Robustheit des Parsings bzw. des Judge-Output-Kontrakts wird verbessert.
- **Keine DB-/Schema-Änderung.** Reine Eval-Service- und Doku-Änderung.

## Out of Scope

- **KI-1 (Backfill der string-kodierten Bestandsdaten):** Daten-Migration mit Approval-Gate, anderer Arbeitstyp. Bleibt eigenes Known Issue.
- **KI-2 (Knowledge-Object-Tool-Dedup):** anderes Subsystem (Extraktion). Bleibt eigenes Known Issue.
- **`confidence_trigger_rate`:** nicht im Gate, wirkt wie reale Modell-/Gesprächsqualität (PROJ-28/29), kein Parsing-Bug.
- **Echte Verbesserung der Gesprächs-Natürlichkeit des Agenten:** das ist Modellqualität, nicht Judge-Parsing.

---

## Implementation Notes (/quick, 2026-06-20)

Coder→Reviewer-Pipeline (kein Architect/Verifier). Status Planned → In Progress.

**dialogNaturalness.ts**
- `maxOutputTokens` 300 → 600 an beiden Call-Sites (Haupt-Judge + isolated-criteria-Loop) — behebt die Truncation des finalen `Stufe: X`-Markers (Root Cause des 0.5-Fallbacks).
- `JUDGE_SYSTEM` verschärft: Begründung max. 4 Sätze, allerletzte Zeile muss exakt `Stufe: X` lauten. Marker bleibt am Ende (Edge Case "letztes Vorkommen zählt" bleibt gültig).
- `ISOLATED_CRITERIA`: derselbe Abschlusskontrakt (max. 2 Sätze + garantierte letzte Zeile) an alle 5 Prompts, damit der nicht-default `isolatedCriteria=true`-Pfad dieselbe Robustheit hat (Reviewer-Befund, latente Inkonsistenz geschlossen).
- `parseJudgeResponse`: zusätzlich deutsche Zahlwörter `eins`/`zwei`/`drei` (case-insensitive) → 1/2/3. Tolerantes Parsing als zweite Absicherung. API-Call-Fehler-Fallback (0.5) und Parsing-Fallback (0.5 + warn) bleiben unterscheidbar.

**slotDepth.ts**
- `callJudge`: zweistufiges Parsing. Erst Fence-Strip + `JSON.parse`; bei Fehler Substring vom ersten `[` bis zum letzten `]` parsen. Echtes Nicht-Array / echter Parse-Fehler bleibt `null`.

**Tests** — 4 neue in `dialogNaturalness.test.ts` (Zahlwort-Toleranz), 3 neue in `slotDepth.test.ts` (Prosa-Einbettung exerziert den Second-Pass, Uppercase-Fence via First-Pass, echtes Nicht-JSON → null). Gate grün: `tsc --noEmit` sauber, `npm test` 620 passed / 1 skipped (API-key-gated Integration-Test).

**SKILL.md (KI-4)** — Schritt 3/4/5 auf PROJ-25/27-Schema umgestellt (O1–O6 Coverage-Felder + `potenzial`-Facette), alte Slot-Namen `rule_based`/`data_sources` entfernt. `ANALYST_THINKING_BUDGET` von "aktuell 0" auf realen Code-Wert 2048 korrigiert.

**Verifikations-Lauf (2026-06-20, `/eval-interview buchhalter`, flash):** [Report](../../docs/evals/interview/2026-06-20/2026-06-20-10-39-13-google-gemini-3-5-flash-buchhalter.md) · interview_id `e6c6b568-1a58-48c7-8438-a1f482c98c05` · eval_run_id `66459985-7dd0-4704-b666-a0a0b73891d8`.
- ✅ `dialog_naturalness = 0.67` — **echter geparster Stufe-2-Score**, nicht der 0.5-Fallback. Fallback-Warnung trat 0× auf (AC[1], AC[3]).
- ✅ `depth_score = 1.81` (nicht null) — slotDepth-Parsing robust.
- ✅ AC[7] erfüllt: das Label spiegelt reale Qualität, kein parsing-erzwungener FAIL mehr.
- ⚠️ Runner-Gate trotzdem **FAIL** — einziger Treiber `dialog_naturalness 0.67 < 0.70`. Der Judge gab Stufe 2 wegen der formellen Eröffnungsfloskel („Schön, dass du dir die Zeit nimmst"), eine echte Stufe-2-Beobachtung. AC[2] ("PASS sein **kann**") ist mechanisch erfüllt (Stufe 3 → 1.0 würde passieren), aber dieser Lauf demonstriert kein grünes Label, weil das Gespräch real Stufe 2 war.
- 🆕 **Neuer Befund (out of scope):** Mapping {0.33/0.67/1.0} + Gate ≥ 0.70 ⇒ nur Stufe 3 passiert; gutes-aber-formelles Stufe-2-Gespräch scheitert um 0.03. Gate-Schwelle vs. Mapping ist eine Eval-Design-Frage (PROJ-39 ändert beides bewusst nicht). Kandidat für ein eigenes Known Issue / Folge-PROJ. Echte Agent-Natürlichkeit (Floskel-Eröffnung) ist ebenfalls explizit Out of Scope.

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results (2026-06-21, /qa PROJ-39)

**Verdict: PRODUCTION-READY** — 0 Critical / 0 High / 0 Medium / 1 Low (`0:0:1`). Der eine Low-Befund ist eine latente Parser-Toleranz-Kante, kein Blocker.

### Gates (unabhängig nachgefahren)
| Gate | Ergebnis |
|------|----------|
| `npm run lint` (`tsc --noEmit`) | ✓ keine Fehler |
| `npm test` (Vitest) | ✓ 46 Files, 620 passed / 1 skipped (key-gated Integration) |
| `dialogNaturalness.test.ts` + `slotDepth.test.ts` isoliert | ✓ 28 passed / 1 skipped |

### Acceptance Criteria — 7/7 PASS
| AC | Status | Evidenz |
|----|--------|---------|
| [1] geparster `dialog_naturalness` statt 0.5-Fallback, keine Fallback-Warnung | PASS | Verifikationslauf: `dialog_naturalness = 0.67` (echte Stufe 2). 0.5 ist der einzige Fallback-Wert; 0.67 ist beweisend für geparsten Score. |
| [2] Gate `dialogNaturalness >= 0.7` erreichbar (Label kann PASS sein) | PASS | Gate-Logik [runner.ts:435-441](../../src/services/__evals__/interview/runner.ts#L435-L441): Stufe 3 → 1.0 passiert das Gate. Mechanisch erfüllt; dieser Lauf war real Stufe 2. |
| [3] `parseJudgeResponse` gegen vorher fehlschlagende Variante abgesichert; Unit-Test schlägt vor Fix fehl | PASS | `maxOutputTokens` 300→600 (beide Call-Sites), Output-Kontrakt verschärft (letzte Zeile exakt `Stufe: X`), Zahlwort-Toleranz. Pre-Fix-Regex war nur `([123])` → die 4 Zahlwort-Tests ("Stufe: zwei" usw.) schlagen pre-fix fehl. |
| [4] `slotDepth` parst wiederherstellbaren Output statt still `null`; Unit-Test | PASS | Zweistufiges Parsing (Fence-Strip + `JSON.parse`, dann Substring `[`…`]`). Tests: Prosa-Einbettung (Second-Pass, pre-fix `null`), Uppercase-Fence (First-Pass), echtes Nicht-JSON → `null`. |
| [5] SKILL.md beschreibt PROJ-25/27-Schema (O-Slots + potenzial) | PASS | Schritt 3/4/5 auf O1–O6 + `potenzial`-Facette umgestellt, `rule_based`/`data_sources` entfernt. `ANALYST_THINKING_BUDGET`-Doku auf `2048` korrigiert — verifiziert gegen [interviewAnalyst.ts:34](../../src/services/interviewAnalyst.ts#L34) (`= 2048`). |
| [6] Gate: tsc + npm test grün; beide Test-Files erweitert | PASS | siehe Gates-Tabelle. |
| [7] frischer buchhalter-Lauf dokumentiert; echter Score, Label spiegelt reale Qualität | PASS | [Report 2026-06-20-10-39-13](../../docs/evals/interview/2026-06-20/2026-06-20-10-39-13-google-gemini-3-5-flash-buchhalter.md), interview_id `e6c6b568…`. FAIL allein durch `dialog_naturalness 0.67 < 0.70` (KI-5), kein parsing-erzwungener FAIL mehr. |

### Gate-FAIL ist real, kein PROJ-39-Bug
Der Verifikationslauf trägt `status: FAIL`. Nachgefahrene Gate-Bedingungen gegen die Report-Scores:
`completion_correctness=true` ✓ · `dedup_slot_coverage 0.89 ≥ 0.75` ✓ · `step_registration_coverage 1 ≥ 0.8` ✓ · `blocked_rate 0.02 < 0.1` ✓ · `dialog_naturalness 0.67 ≥ 0.70` ✗. Einziger Treiber ist KI-5 (diskretes Mapping {0.33/0.67/1.0} vs. Gate ≥ 0.70 → nur Stufe 3 passiert). Out of Scope, als Known Issue getrackt.

### Edge Cases (Spec) — geprüft
- **Echter Judge-Call-Fehler (API) bleibt 0.5:** unterscheidbar — Call-Fail im `catch` (`[scorer:dialog_naturalness] judge call failed`), Parsing-Fallback separat (`[dialogNaturalness] unexpected format`). Unit-Tests decken beide ab.
- **Mehrere `Stufe: X`:** Regex-Loop nimmt den letzten Match — Test `letztes Vorkommen` grün.
- **Leeres Gespräch (`agentTexts` leer):** früher Return `{ score: 0.5 }`, kein Parsing — unverändert.
- **slotDepth echtes Nicht-Array/leer → `null`:** Test `echtes Nicht-JSON gibt null zurück` grün; Second-Pass scheitert graceful.

### Bugs
- **L1 (Low) — Zahlwort-Alternation kann Substrings matchen.** Regex `/\*{0,2}Stufe\s*[:\s]\s*([123]|eins|zwei|drei)\*{0,2}/gi`: bei einem Prosatext wie `…Stufe zweimal pro Tag` oder `Stufe dreißig` matcht `zwei`/`drei`. Nur relevant, wenn diese Phrase das **letzte** `Stufe`-Vorkommen ist UND kein sauberer Endmarker folgt — dann liefert der Parser einen Score statt des 0.5-Parsing-Fallbacks, was eine echte Format-Verfehlung maskieren kann. Risiko praktisch sehr niedrig: der verschärfte Prompt + `temperature: 0` erzwingen `Stufe: X` als letzte Zeile, und die Ziffer ist der Primärpfad. Akzeptabel as-is; optionaler Härtungs-Kandidat (Wortgrenze `\b(eins|zwei|drei)\b`). Kein Blocker.

### Security Audit (Red-Team)
Keine neue Angriffsfläche. Reine Eval-Service-/Doku-Änderung: keine neuen API-Routes, kein User-Input, kein Auth-/RLS-/DB-Schema-Change, keine Secrets. Geparst wird ausschließlich Judge-LLM-Output über fixe Regex-Alternativen bzw. `JSON.parse` in `try/catch` (kein `eval`, keine dynamische Ausführung). Beide Parser sind bounded und failen graceful (0.5 bzw. `null`). Token-Budget-Erhöhung 300→600 betrifft nur Judge-Calls (Kostenrahmen marginal, kein Sicherheitsbezug).

### Regression
Volle Unit-/Integrations-Suite grün (620 passed / 1 skipped), inkl. der vorbestehenden slotDepth-Tests (Monotonie, Adversarial, Order-Swap, Reproduzierbarkeit) und dialogNaturalness-Parser-Tests (Markdown-Toleranz, letztes Vorkommen, Rationale-Extraktion). Keine Metrik-Definition geändert (Stufe→Score-Mapping unverändert), daher kein Score-Drift zu erwarten; bestätigt durch den Verifikationslauf (Scores plausibel, depth_score 1.81 mit verteiltem p1/p2/p3).

### E2E
N/A — Eval-Service- und Doku-Härtung ohne nutzersichtbares UI-Verhalten. Regressionsabdeckung liefert die Unit-Suite + der buchhalter-Verifikationslauf (End-to-End durch die echte Judge-Pipeline).

## Merge-Integration (2026-06-21)

Beim Merge von `origin/main` (PROJ-27/29/31, 2026-06-18) in den Deep-Modules-Branch zeigte sich, dass `main` dasselbe Judge-Parsing-Problem parallel gelöst hat — über einen **JSON-Judge-Kontrakt** (`{"stufe": X, "begruendung": "..."}`) statt PROJ-39s gehärtetem Text-Marker. Entscheidung (genehmigt 2026-06-21): mains JSON-Variante übernommen, PROJ-39s Text-Parser + Zahlwort-Tests durch JSON-Parser-Tests ersetzt. `maxOutputTokens: 600` behalten.

- **KI-3** (Parser-Fallback) gelöst durch den JSON-Judge (kein `Stufe: X`-Truncation mehr). Lauf 2026-06-21: `dialog_naturalness 0.67` echt, kein Fallback.
- **KI-5** (Gate-Schwelle) gelöst durch mains Gate-Senkung auf `≥ 0.65` (auto-merge in `runner.ts`). Lauf 2026-06-21: `0.67 ≥ 0.65` → Gesamt-Label **PASS**.
- **KI-4** (SKILL.md-Doku) bleibt der eigenständige PROJ-39-Beitrag (kein Konflikt).

Der PROJ-39-Parser-Code ist damit supersediert; der Doku-Fix und die Erkenntnis (Truncation-Root-Cause) bleiben gültig. Verifikation: [Lauf 2026-06-21](../../docs/evals/interview/2026-06-21/2026-06-21-18-51-07-google-gemini-3-5-flash-buchhalter.md), `status: PASS`.

## Deployment (2026-06-21, /deploy)

- Production: https://meridian-app-roly-bach.vercel.app (Vercel, fra1) — `main` @ 601d9d9, deploy READY
- Deployed: 2026-06-21 (Batch PROJ-33/35/38/39 via main fast-forward, Tag `v1.1.0-deep-modules`)
- G1 (tsc/build/Header) pass · G2 (npm test 622 + API-E2E) pass · G2 (Browser-E2E) env-blockiert (Playwright-Install) · G4 (Permissions) pass · Eval: status PASS

## Post-Mortem (2026-06-21, /deploy)

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | Medium |
| Appetite vs. tatsächlich | geschätzt: S / tatsächlich: S |
| Größte Überraschung | main löste dieselbe Judge-Fragilität über einen JSON-Kontrakt + gesenktes Gate (0.65); PROJ-39s Text-Parser wurde beim Merge verworfen, nur der SKILL.md-Doku-Fix (KI-4) blieb unique. |
| Vorgeschlagene Regeländerung | origin/main vor parallelen Eval-Fixes synchronisieren; bei Single-Cause-Eval-Gates (KI-5) die Gate-Schwelle gleich mitdenken statt separat. |
| Build-Loop-Iterationen | tatsächlich: ≤2 (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
