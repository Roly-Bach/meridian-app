# Resolutionsplan: `origin/main` (7 Commits) → `refactor/deep-modules`

**Datum:** 2026-06-21
**Branch:** `refactor/deep-modules` (HEAD `a473e27`)
**Integriert:** `origin/main` (`f281acc`), 7 Commits PROJ-27 B1–B5 / PROJ-29 / PROJ-31 vom 2026-06-18
**Merge-Base:** `1ad7990` (= lokales `main`, Fork-Punkt)
**Status:** genehmigt 2026-06-21 (Judge-Entscheidung: mains JSON übernehmen)

## Leitprinzip
Branch behält seinen einzigartigen Wert (PROJ-33 `runInterviewTurn` + PROJ-35 Zerlegung). Mains parallele Fixes werden übernommen und in die verschobenen Module portiert. Wo `main` dasselbe Problem besser gelöst hat (KI-1, KI-3, KI-5), wird die Branch-Variante superseded.

## Diagnose (Dry-Run `git merge-tree`)
6 inhaltliche Konflikte, 3 saubere Auto-Merges. Branch und `main` haben dieselben Eval-Signal-Probleme parallel gelöst:
- Slot-Encoding: PROJ-38 (Write, fix-forward) vs. main (Write konvergent + Read-Compat `parseJsonIfString`, löst KI-1).
- Judge: PROJ-39 (Text `Stufe: X` gehärtet) vs. main PROJ-31 (JSON-Kontrakt + Gate 0.65, löst KI-3 + KI-5).
- Prompts: main FLOSKEL-VERBOT / kein Re-Greet / `kein_kommentar` vs. Branch-Prompt-Refactor (PROJ-35/37).
- Route: main B2 (`opener_text`-Injektion) + B5 (Wrap-up-Analyst) vs. PROJ-33-Adapter.

## Pro Datei

### 1. `runner.ts` — auto-merge, kein Konflikt
Nichts tun. 3-Wege-Merge übernimmt mains Gate `dialogNaturalness >= 0.65` automatisch (Branch hatte die Zeile unverändert auf `0.7`). **Löst KI-5.**

### 2. `dialogNaturalness.ts` — Design-Entscheidung: mains JSON-Judge (genehmigt)
- `JUDGE_SYSTEM` + `parseJudgeResponse`: mains JSON-Variante übernehmen (theirs).
- `dialogNaturalness.test.ts`: PROJ-39 Zahlwort-Tests entfernen, mains JSON-Parser-Tests übernehmen.
- **Behalten aus PROJ-39:** `maxOutputTokens: 600` (additiv) und der SKILL.md-Doku-Fix (KI-4, kein Konflikt).
- Begründung: JSON-Objekt ist truncation-resistent, löst KI-3 robuster; main bündelt Gate-Fix.

### 3. `interviewAgent.ts` — strukturell + Fixes
- Slot-Write `p_value: <objekt>`: konvergent, einmal behalten.
- F2 NICHT-BEFUND-String-Parsing (`resolvedValue` / `resolvedNichtBefundTyp`): fehlt auf Branch → portieren.
- FLOSKEL-VERBOT (turn_format): nur in den **aktiven** Prompt-Pfad portieren (siehe PROJ-37-Drift: `interviewAgent.ts`-Kopie ggf. tot).

### 4. `talkerPrompt.ts` — Ziel der Prompt-Ports
Mains Prompt-Fixes hier einsetzen (Branch hat Prompts hierher verschoben): FLOSKEL-VERBOT (turn_format), "Breite vor Tiefe" (process_loop-Phase).

### 5. `interviewTalker.ts` — beide modifiziert, beide mergen
Mains Zusätze übernehmen: kein Re-Greet bei vorhandener assistant-History, "Ich erfasse..."-Verbot, keine erfundenen Zahl-Zitate, Quant-Slot-Einmal-Retry, `kein_kommentar`-Block, erweiterte `FILLER_PATTERNS`. In Branch-Struktur einpassen.

### 6. `interviewSemantic.ts` — KI-1-Compat übernehmen
Mains `parseJsonIfString()`-Read-Compat übernehmen (Branch hat es nicht) und mit Branch-Erweiterungen (+87) in `normalizeStepEntry` zusammenführen. **Löst KI-1** ohne Backfill.

### 7. `chat/route.ts` — B2/B5
- B2 (`opener_text` als erste assistant-Message): nach `runInterviewTurn.ts` portieren (History-Aufbau).
- B5 (Wrap-up-Analyst): Branch hat in `runInterviewTurn.ts` bereits `runAnalystOnline` + `runAnalystCatchup` auf `wrap_up` → verifizieren, nicht doppelt portieren.
- Route-Adapter behalten, `select`-Spalte `opener_text` aus mains Zeile ergänzen.

### 8. `interviewAgent.test.ts` — trivial
Main +1/-1 einarbeiten, sonst Branch behalten.

## Bookkeeping (Spec/INDEX)
- PROJ-38: bleibt Approved, Notiz "Write-Fix konvergent mit mains PROJ-27 B1; KI-1 zusätzlich durch mains Read-Compat".
- PROJ-39: Notiz "Judge-Parser superseded durch mains JSON-Judge; SKILL.md-Fix (KI-4) bleibt; KI-5 durch Gate 0.65".

## Known Issues — erst NACH dem Testlauf markieren
KI-1 / KI-3 / KI-5 erst als gelöst eintragen, wenn Gates + Eval-Lauf das bestätigen. Nicht vorab.

## Gates (neu, weil Verhalten sich ändert)
`tsc` → `npm test` → `npm run build` → E2E → frischer buchhalter-Eval-Lauf (Judge-Kontrakt geändert). Erst dann Push → Preview → Prod-Approval.

## Restrisiko
`interviewSemantic.ts` (87 Branch-Zeilen × mains Compat) und `interviewTalker.ts` (Prompt-Struktur). Beide durch Tests + Eval abgesichert.
