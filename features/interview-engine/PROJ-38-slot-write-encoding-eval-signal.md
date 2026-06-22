# PROJ-38: Slot-Write-Encoding-Fix (Eval-Signal wiederherstellen)

## Status: Deployed
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-27
**Appetite:** S (1-2d)
**Bugs:** 0:0:0
**Created:** 2026-06-19
**Last Updated:** 2026-06-20 (QA passed via /qa PROJ-38 — production-ready, 0:0:0)

## Dependencies
- **Revidiert:** PROJ-27 (Schema-Bindung + verlustfreie Speicherung). Dessen Vertrag, Slot-Payloads verlustfrei als Objekt zu persistieren, ist verletzt.
- **Related:** PROJ-33 (ADR-016, atomarer Schreibpfad mit Priority-Conflict-Check). Wahrscheinlicher Einführungsort des Defekts.
- **Related:** PROJ-25 (O1–O5-Schema, `potenzial`-Facette) und PROJ-21/PROJ-31 (Eval-Foundation/Schärfung). Liefern das Schema bzw. die betroffenen Scorer.
- **Verwandt, NICHT enthalten:** PROJ-34 (Werkzeug-Schreibabsichten + TurnStore-Port). Der größere Umbau desselben Schreibpfads. PROJ-38 nimmt nur den punktuellen Korrektheits-Fix.

## Context

Seit ~2026-06-18 ist jeder buchhalter-Eval-Lauf FAIL (vorher überwiegend PASS, z.B. 2026-06-08 `slot_coverage: 0.88`). Das reale Agent-Verhalten ist gut: am Lauf vom 2026-06-19 (`interview_id 1b3a04c1-8730-4820-8752-95c678cdc348`) sind 2 Schritte registriert, 33 Wissensobjekte extrahiert und die quantitativen Werte korrekt erfasst (`frequency_per_month: 90`, `duration_minutes: 7.5`, `error_rate_percent: 5`, alle `confirmed` mit Quote). Die Eval-Suite hat ihren Signalwert verloren.

Root-Cause (im Code lokalisiert, ein einziger Defekt): `step_tracker` wird über zwei Pfade geschrieben.

1. Direktes `.update({ step_tracker: current })` (register_step, [interviewAgent.ts:350](src/services/interviewAgent.ts#L350)) speichert das Objekt korrekt als jsonb-Objekt. Deshalb ist `hilfsmittel` (in diesem Pfad gesetzt) sauber.
2. Der atomare RPC-Pfad mit `p_value: JSON.stringify(...)` ([interviewAgent.ts:548-625](src/services/interviewAgent.ts#L548-L625), 717) legt den Wert als jsonb-**String** ab statt als Objekt. Das betrifft `record_slot`-Werte, Status-Writes und `potenzial`-Writes.

Folge: `slots.*` und `potenzial.*` enthalten verschachtelte JSON-Strings, jeder `.value`-Zugriff liefert `undefined`. Außerdem entsteht der doppelt quotierte Status `"\"walkthrough\""` (aus `JSON.stringify('walkthrough')`).

Die Eval-Scorer lesen bereits den korrekten Pfad `step.potenzial.*` ([slotDepth.ts:48](src/services/__evals__/interview/scorers/slotDepth.ts#L48), [hallucinationRate.ts:25](src/services/__evals__/interview/scorers/hallucinationRate.ts#L25)). Es gibt kein Metrik-Pfad-Problem. Sobald die Werte wieder Objekte sind, schlagen `slot_coverage`, `schema_conformance_rate`, `hallucination_rate` und `slotDepth` automatisch wieder an.

## User Stories

- Als **KI-Berater / Eval-Nutzer** möchte ich, dass die Eval-Metriken den tatsächlichen Interview-Zustand messen, damit ich Modelle und Architektur-Änderungen wieder valide vergleichen kann.
- Als **Entwickler** möchte ich, dass `record_slot`-, Status- und `potenzial`-Writes ihren Payload verlustfrei als Objekt persistieren, damit nachgelagerte Konsumenten `.value` lesen können statt `undefined`.
- Als **Entwickler** möchte ich einen automatisierten Regressions-Test am Schreibpfad, damit dieses Encoding-Problem nicht erneut unbemerkt einzieht.
- Als **KI-Berater** möchte ich eine frische, korrekte buchhalter-Baseline, damit künftige Läufe einen validen Vergleichspunkt haben.
- Als **Process-Owner** möchte ich, dass neue Interviews verwertbares Prozesswissen liefern, damit Use-Case-Engine und PDF-Report korrekte Werte statt `undefined` anzeigen.

## Acceptance Criteria

- [ ] Ein frischer buchhalter-Eval-Lauf speichert in `interview_state.step_tracker` alle `slots.*`- und `potenzial.*`-Payloads als jsonb-Objekte (`jsonb_typeof = 'object'`), nicht als String. Verifiziert per SQL gegen die neue `interview_id`.
- [ ] `step.status` ist ein reiner String (z.B. `walkthrough`), nicht doppelt quotiert (`"\"walkthrough\""`).
- [ ] `schema_conformance_rate = 1.0` und `hallucination_rate ≈ 0` (kein false-positive) auf dem frischen buchhalter-Lauf.
- [ ] `slot_coverage` und `slotDepth`/`depth_score` werten die `potenzial`-Objekte wieder aus (`slot_coverage > 0`, nicht durch das Encoding auf ~0.3 gedeckelt). Coverage wird NICHT auf eine feste Schwelle gepinnt (das ist Modellqualität, PROJ-28/29/30).
- [ ] Das Gesamt-Status-Label des Laufs wird nicht mehr durch das Encoding-Artefakt (`schema_conformance_rate=0`/`hallucination_rate=1`) auf FAIL gezogen.
- [ ] Ein automatisierter Test (unit/integration) fixiert: nach einem `record_slot`-Write enthält der Tracker ein Objekt mit lesbarem `.value` (kein String). Läuft in `npm test` grün.
- [ ] Beide Schreibpfade erzeugen identische Kodierung (Objekt): `hilfsmittel` bleibt Objekt, die übrigen O-Slots und `potenzial` werden ebenfalls Objekte.
- [ ] **Gate:** `tsc --noEmit` und `npm test` grün, `npm run build` ✓.
- [ ] Eine frische buchhalter-Baseline (flash) ist unter `docs/evals/interview/<datum>/` dokumentiert und als neuer Referenzpunkt vermerkt.

## Edge Cases

- **Bestandsdaten:** PROJ-38 repariert bereits string-kodierte Records NICHT (fix-forward). Konsumenten, die Altdaten lesen, sehen weiter `undefined`. Als Known Issue notiert.
- **Concurrent Writes / Priority-Conflict (ADR-016):** Der `canOverwrite`/`writeSource`-Mechanismus muss nach dem Encoding-Fix weiter funktionieren. `isOverwrite`-Vergleiche dürfen nicht auf die String-Form des Slots angewiesen sein.
- **`nicht_befund_typ`-Slots (PROJ-28):** Ein `potenzial`-Slot ohne `value` aber mit `nicht_befund_typ` muss ebenfalls als Objekt persistiert werden.
- **Status-Übergänge:** Alle drei via RPC-Pfad geschriebenen Status-Werte (`exploring`/`walkthrough`/`done`) sind nach dem Fix reine Strings.
- **`is_correction` / Overwrite:** Ein korrigierter Slot überschreibt den vorherigen Objektwert sauber, ohne verschachtelte Stringifizierung.

## Technical Requirements

- **Keine Bestandsdaten-Migration** (fix-forward). Falls der Fix die Supabase-RPC-Funktion selbst ändert, gilt das Approval-Gate (`apply_migration`); der Appetite kann dann auf M steigen.
- **Verhaltensneutralität abseits der Persistenz:** keine Änderung an Detektoren, Prompts, Slot-Namen oder Scorer-Logik. Nur die Persistenz-Kodierung wird korrigiert.
- **Re-Baseline:** ein frischer buchhalter-Lauf (flash) wird als neue Baseline dokumentiert.

## Out of Scope

- **Bestandsdaten-Backfill** der string-kodierten Records (→ Known Issue in INDEX).
- **Begleitbefunde derselben Eval-Welle** (separat, nicht in PROJ-38): Knowledge-Object-Tool-Duplikation, `dialog_naturalness` Judge-Parsing-Robustheit, veraltete PASS-Kriterien in der `/eval-interview`-Skill-Doku.
- **PROJ-34** (Werkzeug-Schreibabsichten + TurnStore-Port), der größere Umbau desselben Schreibpfads.
- **Modellqualität / Coverage-Verbesserung** (PROJ-28/29/30).

## Implementation Notes (2026-06-19, /quick PROJ-38)

Fix umgesetzt: an allen 9 `patch_interview_step_field`-Call-Sites in `src/services/interviewAgent.ts` `p_value: JSON.stringify(X)` → `p_value: X`. Der RPC-Parameter ist jsonb-typisiert (`jsonb_set`), supabase-js serialisiert das Objekt korrekt. Keine Migration, kein Backfill (fix-forward). Read-Seite geprüft: keine kompensierende `JSON.parse`-Stelle (das einzige `JSON.parse` in `slotDepth.ts` parst die LLM-Judge-Antwort, nicht den Slot-Read-Back). ADR-016-Priority-Conflict reaktiviert sich erwartungsgemäß (liest jetzt Objekte mit `writeSource`).

Tests: bestehende Assertion, die das Bug-Verhalten kodierte (`p_value === JSON.stringify('done')`), auf `=== 'done'` korrigiert; positiven Test zum Regressions-Guard verschärft (`p_value: expect.objectContaining({ value: 20 })`). Gate grün: `tsc` + `npm test` (613 passed / 1 skipped) + `npm run build`.

Hinweis: Coder-Subagent wurde vom Session-Limit unterbrochen (Call-Sites gemacht); Tests + Gate inline abgeschlossen. Cross-Vendor-Review nicht aufrufbar, Review inline (PASS).

**Verifikation (frischer buchhalter-Lauf, interview_id `bef075a3-f801-47e0-bf30-cb2115ca66d5`, 2026-06-19):** Score-Flip gegen Pre-Fix-Lauf 19-43-02 bei identischer Config: `schema_conformance_rate` 0→1, `hallucination_rate` 1→0, `slot_coverage` 0.33→0.89, beide Schritte `done`, Slot-Renderer zeigt echte Werte. Alle encoding-bezogenen Acceptance Criteria erfüllt. Report: `docs/evals/interview/2026-06-19/2026-06-19-23-55-41-google-gemini-3-5-flash-buchhalter.md`. DB-Direktabfrage (`jsonb_typeof='object'`) stand wegen Supabase-MCP-Token-Ablauf aus; durch `schema_conformance_rate=1.0` transitiv belegt.

**Residualer FAIL ist nicht PROJ-38:** Das Gesamt-Label bleibt FAIL, aber allein wegen `dialog_naturalness: 0.5 < 0.7` (Gate-Schwelle), getrieben durch KI-3 (Judge-Parsing-Fallback). Das Encoding-Artefakt ist nicht mehr Teil des Gates. KI-3 ist als High eingestuft (alleiniger verbleibender Eval-Blocker), out of scope für PROJ-38.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results (2026-06-20, /qa PROJ-38)

**Verdict: PRODUCTION-READY** — 0 Critical / 0 High / 0 Medium / 0 Low (`0:0:0`).

### Gates (unabhängig nachgefahren)
| Gate | Ergebnis |
|------|----------|
| `npm run lint` (`tsc --noEmit`) | ✓ keine Fehler |
| `npm test` (Vitest) | ✓ 46 Files, 613 passed / 1 skipped |
| `npm run build` | ✓ Compiled successfully |

### Acceptance Criteria — 9/9 PASS
| AC | Status | Evidenz |
|----|--------|---------|
| slots.*/potenzial.* als jsonb-Objekte | PASS | `schema_conformance_rate=1.0` (Scorer liest Objekte) + Unit-Test (`p_value` ist Objekt). Direkt-SQL deferred (Supabase-MCP disconnected). |
| status reiner String (nicht doppelt quotiert) | PASS | Unit-Test `p_value === 'done'`; Eval-Report: beide Schritte `done`. |
| `schema_conformance_rate=1.0`, `hallucination_rate≈0` | PASS | Verifikationslauf: 1 bzw. 0 (Pre-Fix: 0 bzw. 1). |
| `slot_coverage`/`depth_score` werten potenzial aus, nicht gedeckelt | PASS | `slot_coverage 0.89` (Pre-Fix 0.33), `depth_score 1.94` mit verteiltem p1/p2/p3. |
| Label nicht durch Encoding-Artefakt FAIL | PASS | Gate nutzt `dedupSlotCoverage 0.89` (passt); Encoding-Metriken nicht im Gate; residualer FAIL = KI-3. |
| Regressions-Test (Objekt-Encoding) | PASS | `interviewAgent.test.ts`: `p_value: expect.objectContaining({ value: 20 })` + Status-String-Assertion. |
| Beide Schreibpfade Objekt-Encoding | PASS | Eval-Slot-Tabelle rendert echte Werte (90/5/1200…) statt `undefined`. |
| Gate tsc+test+build grün | PASS | siehe oben. |
| Frische Baseline dokumentiert | PASS | `docs/evals/interview/2026-06-19/2026-06-19-23-55-41-...md`. |

### Edge Cases
- **Bestandsdaten (fix-forward):** verifiziert, kein Backfill ausgeführt — konsistent mit Scope (→ KI-1).
- **Concurrent/Priority-Conflict (ADR-016):** Logik wird durch den Fix scharf (las vorher String → `writeSource` undefined → faktisch tot). Im Verifikationslauf `blocked_writes=0`, kein legitimer Write blockiert. Intendiertes Verhalten, kein Bug.
- **`nicht_befund_typ`-Slots / Status-Übergänge / is_correction:** durch denselben Schreibpfad abgedeckt; Tests grün.

### Security Audit (Red-Team)
Keine neue Angriffsfläche. `JSON.stringify(X)` → `X` an parametrisierten jsonb-RPC-Calls; `patch_interview_step_field` (SECURITY DEFINER, Grants unverändert) nicht angefasst. Keine neuen Routes/Inputs/Secrets, kein Auth-/RLS-/DB-Schema-Change. Slot-Werte gehen als jsonb-Parameter in `jsonb_set` (keine Injection).

### Regression
Volle Unit-/Integrations-Suite grün (inkl. der angepassten `interviewAgent.test.ts`). End-to-End durch den frischen buchhalter-Lauf bestätigt (Score-Flip, beide Schritte `done`). PROJ-27 (verlustfreie Speicherung) Vertrag wiederhergestellt; PROJ-33 (atomarer Schreibpfad) bleibt funktionsfähig.

### E2E
N/A — Service-Layer-Bugfix ohne neues nutzersichtbares Verhalten. Regressionsabdeckung liefert die Unit-Suite + der Eval-Verifikationslauf.

### Beobachtung / Folgehinweis (kein PROJ-38-Bug)
Der Eval-Lauf trägt weiterhin `FAIL`, aber allein wegen KI-3 (`dialog_naturalness 0.5 < Gate 0.7`, Judge-Parsing-Fallback). KI-3 ist in INDEX auf High eingestuft und der jetzt alleinige Blocker für ein grünes Eval-Label. Nächster empfohlener Schritt nach PROJ-38.

## Merge-Integration (2026-06-21)

Beim Merge von `origin/main` (PROJ-27/29/31) zeigte sich, dass `main` denselben Write-Side-Encoding-Fix (`p_value` als jsonb-Objekt statt `JSON.stringify`) parallel hat — **konvergent**, im Merge einmal behalten. Zusätzlich bringt `main` eine **Read-Side-Compat** (`parseJsonIfString` in [interviewSemantic.ts](../../src/services/interviewSemantic.ts)), die string-kodierte Altdaten beim Lesen parst und damit **KI-1** ohne Backfill löst (war als PROJ-38-Folge-Issue offen). Lauf 2026-06-21: `slot_coverage 1.0`, `schema_conformance_rate 1`.

## Deployment (2026-06-21, /deploy)

- Production: https://meridian-app-roly-bach.vercel.app (Vercel, fra1) — `main` @ 601d9d9, deploy READY
- Deployed: 2026-06-21 (Batch PROJ-33/35/38/39 via main fast-forward, Tag `v1.1.0-deep-modules`)
- G1 (tsc/build/Header) pass · G2 (npm test 622 + API-E2E) pass · G2 (Browser-E2E) env-blockiert (Playwright-Install) · G4 (Permissions) pass · Eval: status PASS

## Post-Mortem (2026-06-21, /deploy)

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High |
| Appetite vs. tatsächlich | geschätzt: S / tatsächlich: S |
| Größte Überraschung | origin/main hatte denselben Write-Fix unabhängig — plus eine überlegene Read-Compat (`parseJsonIfString`), die zusätzlich KI-1 ohne Backfill löst. PROJ-38 im Write-Teil konvergent, im Read-Teil subsumiert. |
| Vorgeschlagene Regeländerung | Vor dem Bau von Eval-Signal-Fixes origin/main auf parallele Arbeit prüfen (Convergent-Work vermeiden). |
| Build-Loop-Iterationen | tatsächlich: ≤2 (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
