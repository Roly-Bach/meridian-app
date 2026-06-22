# PROJ-23: Adaptive Clarification Questions

## Status: Deployed
**Type:** Extension
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** M (3-5d)
**Bugs:** 0:0:0 (1 M + 2 L gefunden, alle behoben)
**Created:** 2026-05-29
**Last Updated:** 2026-06-22

## Dependencies
- **Hard Prerequisite: PROJ-22** (ADR-011 Dual-Loop Implementierung) — Analyst-Komponente, `produce_briefing`-Schema mit `clarification_cards`, `clarification`-Phase im Orchestrator müssen existieren bevor PROJ-23 gebaut werden kann
- Requires: PROJ-2 (Interview Engine Backend) — interview state, phase management, Analyst tool-call pipeline
- Requires: PROJ-3 (Interview UI) — ChatInterface, ChatInput (wird konditionell ersetzt)
- Requires: ADR-011 Amendment A (2026-05-29) — `clarification` Phase in State Machine (D4, D12, D3) — implementiert durch PROJ-22
- Enables: PROJ-6 (Use Case Engine) erhält vollständigere Slot-Daten für ROI-Berechnung

## Context

Nach dem Interview fehlen ROI-relevante Slots (`frequency_per_month`, `duration_minutes`, `rule_based`, `error_rate_percent`) häufig oder sind unvollständig — Mitarbeiter nennen Zahlen nicht spontan im Gespräch. Außerdem erwähnt der Agent manchmal Prozessschritte die nie formal registriert wurden, oder lässt potenzielle Schritte offen.

Die Clarification Phase füllt diese Lücken am Ende des Interviews strukturiert auf, ohne den Gesprächsfluss zu unterbrechen: Klickbare Cards statt Freitext, direkt nach `wrap_up`, maximal 8 Items.

## User Stories

- Als **Mitarbeiter (interviewte Person)** möchte ich am Ende des Interviews kurze Bestätigungsfragen per Klick beantworten, damit ich nicht nochmals tippen muss.
- Als **KI-Berater** möchte ich dass alle ROI-relevanten Slots für jeden Prozessschritt gefüllt sind, damit Use Cases mit echten Zahlen belegt werden.
- Als **Mitarbeiter** möchte ich bestätigen oder verneinen ob ein erwähnter aber nicht registrierter Prozessschritt tatsächlich zu meinem Workflow gehört.
- Als **KI-Berater** möchte ich sehen dass ein Interview die Clarification Phase abgeschlossen hat, damit ich die Vollständigkeit der Daten beurteilen kann.

## Acceptance Criteria

- [ ] Interview wechselt nach Abschluss von `wrap_up` in Phase `clarification`, wenn Analyst ≥1 ClarificationCard generiert hat (ADR-011 A-D4)
- [ ] Chat-Input wird ausgeblendet wenn Phase = `clarification`; stattdessen rendert `ClarificationCards`-Komponente
- [ ] Initialnachricht oben in der Clarification-View: *"Noch ein paar kurze Bestätigungen zu dem was wir besprochen haben."*
- [ ] **Slot-Cards** (fehlende Werte): zeigen Step-Titel + Frage + 2–4 klickbare Optionen + immer Option "Weiß ich nicht"
  - `frequency_per_month`: Optionen "Täglich", "Wöchentlich", "Mehrfach/Monat", "Monatlich", "Weiß ich nicht"
  - `duration_minutes`: Optionen "< 5 Min", "5–15 Min", "15–30 Min", "> 30 Min", "Weiß ich nicht"
  - `rule_based`: Optionen "Immer gleich", "Meistens gleich", "Variiert stark", "Weiß ich nicht"
  - `error_rate_percent`: Optionen "Selten Fehler", "Gelegentlich", "Häufig", "Weiß ich nicht"
- [ ] **Open-Item-Cards** (offene Punkte, fehlende Schritte): zeigen Frage + Optionen "Ja", "Nein", "Manchmal"
- [ ] "Weiter"-Button ist deaktiviert bis alle Cards beantwortet sind
- [ ] POST `/api/interview/[token]/clarification` schreibt Slot-Antworten in `knowledge_objects` (update bestehende Einträge); Open-Item "Ja"/"Manchmal" registriert fehlenden Step via bestehendem `register_step`-Flow
- [ ] Nach Submit: Orchestrator setzt `status=completed`, `extractions_pending=true`
- [ ] Hard-Stop (Timer Trigger A): Clarification Phase wird übersprungen → direkt `completed`
- [ ] Analyst generiert 0 Cards: Clarification Phase übersprungen → direkt `completed`
- [ ] Bei Seiten-Reload während Clarification: bereits beantwortete Cards bleiben erhalten (Zustand in `interview_state.clarification_answers`)
- [ ] Max. 8 Cards pro Interview (Analyst priorisiert nach Use-Case-Relevanz der fehlenden Slots)

## Edge Cases

- **Analyst noch nicht fertig wenn wrap_up abgeschlossen**: Orchestrator findet keine `clarification_cards` → fallback direkt `completed` (kein Warten, kein Blocking)
- **Alle Slots bereits gefüllt**: Analyst generiert 0 Cards → Phase wird übersprungen
- **User antwortet "Weiß ich nicht" auf alle Cards**: Submit trotzdem möglich; Slots bleiben `null`, kein Fehler
- **Open-Item "Nein"**: kein Register, kein Fehler, Card als beantwortet markiert
- **Mehr als 8 potenzielle Cards**: Analyst priorisiert — zuerst Slots mit direktem ROI-Impact (`frequency_per_month`, `duration_minutes`), dann `rule_based`, dann `error_rate_percent`, zuletzt Open Items
- **Token abgelaufen während Clarification**: API gibt 410 zurück; UI zeigt Fehler-Screen (wie bestehender `ChatErrorScreen`)
- **Interview bereits `completed` wenn Clarification-Submit kommt**: API ignoriert, gibt 409 zurück (idempotent)

## Technical Requirements

- Neue Phase `clarification` im Interview State Machine (ADR-011 Amendment A) — kein neues DB-Schema nötig, `interview_state.clarification_answers` als JSONB-Feld
- Analyst-Extension: `produce_briefing` structured output erhält optionales Feld `clarification_cards: ClarificationCard[]` (ADR-011 A-D3)
- Neuer Endpoint: `POST /api/interview/[token]/clarification` — auth via Token (wie `/chat`), Zod-Validierung
- UI-Komponente: `src/components/interview/ClarificationCards.tsx` — shadcn `Button` für klickbare Options, shadcn `Card` pro Item
- Langfuse-Span `interview.clarification` pro Submit (PROJ-13 D11 Extension)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Prerequisites met by PROJ-22 (no schema changes needed)
- `interview_state.phase = 'clarification'` — in DB schema + TypeScript Phase type
- `interview_state.clarification_answers: Json` — DB column exists
- `decideNextPhase()` — returns `'clarification'` when Analyst cards present
- `checkLifecycle()` — skips completion when cards present
- `ClarificationCardSchema` + `AnalystBriefingSchema.clarification_cards` — defined in `interviewAnalyst.ts`
- `buildDynamicContext()` — clarification Talker prompt exists (needs update, see below)

---

### Three Card Types

| Type | `slot_key` values | Options source | Answer mode | Storage |
|------|-------------------|----------------|-------------|---------|
| **SlotCard** | `frequency_per_month`, `duration_minutes`, `rule_based`, `error_rate_percent` | UI-fixed per slot (see below) | single-select | UPDATE `knowledge_objects` slot field |
| **OpenItemCard** | `open_item` | Fixed: Ja / Nein / Manchmal | single-select | INSERT `knowledge_objects` row if Ja/Manchmal |
| **QualitativeCard** | `qualitative` (catch-all) | Analyst-generated 2–4 options | multi-select | `interview_state.clarification_answers` JSON |

**QualitativeCard scope** — Analyst generates these for any process gap that improves use case derivation:
- Stakeholder/approval questions ("Wer muss das noch abstimmen?")
- Tool/system questions ("Welche Systeme nutzt du dabei?")
- Process quality gaps ("Was blockiert diesen Schritt am häufigsten?")
- Automation-potential questions ("Was wäre der größte Nutzen einer Automatisierung?")
- Any other context missing for ROI or use case classification

**Fixed options per SlotCard slot_key** (UI-defined, overrides Analyst options field):

| slot_key | Options |
|----------|---------|
| frequency_per_month | Täglich / Wöchentlich / Mehrfach/Monat / Monatlich / Weiß ich nicht |
| duration_minutes | < 5 Min / 5–15 Min / 15–30 Min / > 30 Min / Weiß ich nicht |
| rule_based | Immer gleich / Meistens gleich / Variiert stark / Weiß ich nicht |
| error_rate_percent | Selten Fehler / Gelegentlich / Häufig / Weiß ich nicht |

"Weiß ich nicht" → slot stays `null` in DB, no error.

**Answer-to-value mapping** (for SlotCard `knowledge_objects` UPDATE):

| slot_key | Answer | Value |
|----------|--------|-------|
| frequency_per_month | Täglich | 22 |
| frequency_per_month | Wöchentlich | 4 |
| frequency_per_month | Mehrfach/Monat | 8 |
| frequency_per_month | Monatlich | 1 |
| duration_minutes | < 5 Min | 3 |
| duration_minutes | 5–15 Min | 10 |
| duration_minutes | 15–30 Min | 22 |
| duration_minutes | > 30 Min | 45 |
| rule_based | Immer gleich | true |
| rule_based | Meistens gleich | true |
| rule_based | Variiert stark | false |
| error_rate_percent | Selten Fehler | 2 |
| error_rate_percent | Gelegentlich | 10 |
| error_rate_percent | Häufig | 30 |

---

### Component Tree

```
InterviewPage (page.tsx)
 ├── PageState: loading | error | completed | ready | clarification  ← NEW
 ├── [status=completed]            → ChatCompletedScreen (existing)
 ├── [phase=clarification,         → ClarificationView (NEW)
 │    status≠completed]               ├── Header (static: "Noch ein paar kurze Bestätigungen…")
 │                                    ├── ClarificationCards (NEW)
 │                                    │    ├── SlotCard × n (single-select)
 │                                    │    ├── OpenItemCard × n (single-select)
 │                                    │    └── QualitativeCard × n (multi-select)
 │                                    └── "Weiter"-Button (disabled until all answered)
 └── [phase≠clarification,         → ChatInterface (existing)
      status=active/created]
```

---

### Data Flow

**Clarification trigger — happy path:**
```
1. User sends last wrap_up message → POST /api/interview/[token]/chat
2. Orchestrator reads next_briefing (cards from previous Analyst run)
3. decideNextPhase() → 'clarification'
4. DB: interview_state.phase = 'clarification'
5. Talker streams brief handover (see Talker prompt update below)
6. Stream completes → ChatInterface.checkCompleted() calls GET /api/interview/[token]
7. GET returns: state.phase='clarification', clarificationCards=[…], clarificationAnswers={}
8. page.tsx switches PageState to 'clarification' → renders ClarificationView
9. User answers all cards → "Weiter" enables
10. POST /api/interview/[token]/clarification → writes slots, completes interview
11. UI → ChatCompletedScreen
```

**Skip (0 cards):** Analyst generates 0 cards → `checkLifecycle()` returns `shouldComplete=true` → existing farewell path, no UI change.

**Reload during clarification:**
```
GET /api/interview/[token] → phase=clarification, clarificationCards, clarificationAnswers
page.tsx renders ClarificationView with initialAnswers pre-populated
```

---

### API Changes

#### GET `/api/interview/[token]` — extend
When `state.phase = 'clarification'`: also select `interviews.next_briefing` and `interview_state.clarification_answers`. Include in response:
```
clarificationCards: ClarificationCard[] | null
clarificationAnswers: Record<string, string | string[]> | null
```

#### NEW: POST `/api/interview/[token]/clarification`
Path: `src/app/api/interview/[token]/clarification/route.ts`

Input (Zod-validated):
```
{
  answers: {
    process_step_id: string
    slot_key: string
    answer: string | string[]   // string[] for QualitativeCard multi-select
  }[]
}
```

Processing:
1. Validate token (UUID + exists + not expired), 409 if already completed (idempotent)
2. Persist `clarification_answers` → `interview_state.clarification_answers`
3. SlotCards (answer ≠ "Weiß ich nicht"): UPDATE `knowledge_objects` — map answer string → typed value per lookup table
4. OpenItemCards (answer = "Ja" or "Manchmal"): INSERT `knowledge_objects` row for the step
5. QualitativeCards: answers stored only in `clarification_answers` (no `knowledge_objects` write needed)
6. SET `interviews.status = 'completed'`, `extractions_pending = true`
7. `after()` → post-completion pipeline: `createProcessStepsFromTracker` + `clusterProcessSteps` + `deduplicateKnowledgeObjects`
8. Langfuse span `interview.clarification` (PROJ-13 extension tag)
9. Return `{ success: true }`

Error codes: 400 (validation), 404 (not found), 409 (already completed), 410 (expired).

---

### Frontend Changes

#### `ChatInterface.tsx` — minimal extension
- Add `onClarification?: (cards: ClarificationCard[], existingAnswers: Record<string, string | string[]>) => void` prop
- Extend `checkCompleted()`: also check `data.state?.phase === 'clarification'`; call `onClarification(data.clarificationCards, data.clarificationAnswers ?? {})`

#### `page.tsx` — new PageState branch
- Add: `| { status: 'clarification'; clarificationCards: ClarificationCard[]; clarificationAnswers: Record<string, string | string[]> }`
- Pass `onClarification` callback to `ChatInterface`
- Render `ClarificationView` for `status = 'clarification'`

#### NEW: `src/components/interview/ClarificationView.tsx`
Props: `token`, `cards: ClarificationCard[]`, `initialAnswers`, `onCompleted`
- Local state: `answers`, `isSubmitting`
- "Weiter" active when all cards answered
- Submit → POST `/api/interview/[token]/clarification` → `onCompleted()`
- shadcn `Card` wrapper, Meridian Pink (`#E040FB`) border on selected options

#### NEW: `src/components/interview/ClarificationCards.tsx`
Props: `cards`, `answers`, `onAnswer: (cardKey: string, answer: string | string[]) => void`
- `cardKey` = `${process_step_id}__${slot_key}`
- SlotCard: single-select buttons (fixed options from slot_key map)
- OpenItemCard: single-select "Ja / Nein / Manchmal"
- QualitativeCard: multi-select buttons from Analyst `options` field; "Weiß ich nicht" as single-select escape
- All use shadcn `Button` (variant=outline, active state: pink border + pink text)

---

### Analyst Changes

#### `interviewAnalyst.ts` — trigger expansion
Current `shouldGenerateClarificationCards()` only fires when mandatory slots are empty. PROJ-23 changes: **always offer card generation at wrap_up**. Analyst prompt instructs when to generate each card type. 0 cards generated → phase skipped as before.

Updated `shouldGenerateClarificationCards()`: remove condition check — always call `produce_briefing` with `clarification_cards` field available at wrap_up.

#### `ClarificationCardSchema` — clarify `options` description
Change `describe('last option must be "Andere"')` → `describe('last option must be "Weiß ich nicht"')`. Applies only to QualitativeCards — SlotCards use UI-fixed options, OpenItemCards use fixed Ja/Nein/Manchmal.

#### Analyst prompt update — extend card generation instructions
Add section to `buildAnalystSystemPrompt()` for wrap_up phase:
```
## Clarification Cards (nur bei Phase=wrap_up)
Generiere bis zu 8 ClarificationCards, priorisiert nach Use-Case-Relevanz:
1. SlotCards für leere ROI-Slots (frequency_per_month, duration_minutes, rule_based, error_rate_percent)
2. OpenItemCards für erwähnte aber nicht registrierte Prozessschritte
3. QualitativeCards für jeden fehlenden Prozesskontext: Beteiligte, Systeme, Blockaden, 
   Abstimmungsbedarf, Automatisierungspotenzial — alles was Use Case Ableitung verbessert.
   slot_key='qualitative', options=[2-4 spezifische Antwortoptionen], answer_type='multi'
Wenn keine Lücken: leeres Array zurückgeben.
```

#### `buildDynamicContext()` — Talker prompt for clarification phase
Replace current prompt with:
> "Sage genau einmal: 'Danke! Ich habe noch ein paar kurze Abschlussfragen für dich.' Stelle keine weiteren Fragen — die Abschlussfragen erscheinen im Interface."

---

### `ClarificationCardSchema` — add `answer_type` field
```
answer_type: z.enum(['single', 'multi']).optional().default('single')
  .describe('single for slot/open-item cards, multi for qualitative cards')
```

---

### Dependencies
No new npm packages. Uses: shadcn `Card` + `Button` (installed), `after` (next/server), `zod`, existing `_telemetry.ts` pattern.

## Implementation Notes (Backend — 2026-05-31)

### Backend additions
- `src/app/api/interview/[token]/clarification/route.ts` — POST endpoint: Zod validation, token auth (404/410/409), persists `clarification_answers` to `interviews`, updates `process_steps` for SlotCards via answer→value lookup table, inserts `knowledge_objects` for OpenItem Ja/Manchmal, sets `status=completed` + `extractions_pending=true`, fires post-completion pipeline via `after()`
- `src/app/api/interview/[token]/clarification/clarification.test.ts` — 9 integration tests: 404 (invalid token), 400 (empty answers), 404 (not found), 410 (expired), 409 (already completed), happy path, "Weiß ich nicht" skip, OpenItem Ja insert, OpenItem Nein no-insert
- `src/app/api/interview/[token]/route.ts` — GET extended: returns `clarificationCards` + `clarificationAnswers` when `state.phase=clarification`

### Test results
- All 9 clarification tests pass

## Implementation Notes (Frontend — 2026-05-31)

### Files changed
- `src/services/interviewAgent.ts` — `ClarificationCard.answer_type` field added; clarification phase Talker methodology updated (say once + no questions)
- `src/services/interviewAnalyst.ts` — `ClarificationCardSchema` with `answer_type`, options description fixed; `shouldGenerateClarificationCards()` always fires at wrap_up; clarification cards section added to analyst system prompt
- `src/app/api/interview/[token]/route.ts` — GET returns `clarificationCards` + `clarificationAnswers` when `state.phase=clarification` (reads from `interviews.next_briefing` + `interviews.clarification_answers`)
- `src/app/api/interview/[token]/clarification/route.ts` — NEW: POST endpoint; validates token, saves `clarification_answers` to `interviews`, updates `process_steps` for SlotCards, inserts `knowledge_objects` for OpenItem Ja/Manchmal, sets `status=completed`, fires post-completion pipeline via `after()`
- `src/components/interview/ClarificationCards.tsx` — NEW: SlotCard (fixed options), OpenItemCard (Ja/Nein/Manchmal), QualitativeCard (multi-select); Meridian Pink active state
- `src/components/interview/ClarificationView.tsx` — NEW: full page wrapper with header, intro text, card list, Weiter button (disabled until all answered)
- `src/components/interview/ChatInterface.tsx` — `onClarification` prop added; `checkCompleted()` detects `phase=clarification` and routes to clarification view instead of completed
- `src/app/interview/[token]/page.tsx` — `clarification` PageState added; renders `ClarificationView`; `onClarification` callback wired to `ChatInterface`

### Schema discovery
- `clarification_answers` lives on `interviews` table (not `interview_state`)
- ROI slots live on `process_steps` table (not `knowledge_objects`)
- SlotCard process_step_id can be UUID (→ match by `id`) or title string (→ match by `title`)

## QA Test Results

**QA Date:** 2026-05-31
**Tester:** QA Engineer (automated + manual)
**Status:** ✅ Approved — 0 Critical, 0 High — production-ready

### Acceptance Criteria

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| AC-1 | Interview → `clarification` phase after wrap_up when ≥1 card | ✅ PASS | Orchestrator `decideNextPhase()` returns `'clarification'` when `cards.length > 0` |
| AC-2 | Chat-Input hidden during clarification; ClarificationCards renders | ✅ PASS | `page.tsx` switches to `ClarificationView` on `phase=clarification` |
| AC-3 | Intro text: "Noch ein paar kurze Bestätigungen zu dem was wir besprochen haben." | ✅ PASS | `ClarificationView.tsx` line 80 |
| AC-4 | SlotCards with correct fixed options per slot_key | ✅ PASS | `SLOT_OPTIONS` map covers all 4 slot types |
| AC-5 | OpenItemCards with Ja/Nein/Manchmal | ✅ PASS | `OPEN_ITEM_OPTIONS` constant |
| AC-6 | "Weiter" disabled until all cards answered | ✅ PASS | `allAnswered = cards.every(isCardAnswered)` |
| AC-7 | POST /clarification writes SlotCard answers to `process_steps` | ✅ PASS | Answer→value lookup tables correct; UUID and title match both work |
| AC-8 | After Submit: `status=completed`, `extractions_pending=true` | ✅ PASS | Route sets both fields; post-completion pipeline fires via `after()` |
| AC-9 | Hard-Stop: clarification skipped → direct `completed` | ✅ PASS | `checkLifecycle()` timer check takes priority before phase decision |
| AC-10 | 0 cards: phase skipped → direct `completed` | ✅ PASS | `decideNextPhase()` returns `completed` path when no cards |
| AC-11 | Reload during clarification: partial answers preserved | ⚠️ PARTIAL | Cards & phase restored correctly; **partial answers NOT auto-saved** — `clarification_answers` only written on Submit. Reload mid-answering loses progress. |
| AC-12 | Max 8 cards (Analyst priorisiert) | ✅ PASS | `AnalystBriefingSchema.max(8)` enforced at LLM output level |

### Edge Cases

| Case | Result | Notes |
|------|--------|-------|
| "Weiß ich nicht" on SlotCard → slot stays null | ✅ PASS | Filtered before DB update |
| OpenItem "Nein" → no knowledge_object insert | ✅ PASS | Only Ja/Manchmal triggers insert |
| OpenItem "Ja" → inserts knowledge_object row | ✅ PASS | Confirmed in unit test |
| Already completed interview → 409 idempotent | ✅ PASS | Returns `{success: true}` |
| Expired token → 410 | ✅ PASS | |
| Invalid UUID format → 404 | ✅ PASS | |
| QualitativeCard multi-select: "Weiß ich nicht" clears others | ✅ PASS | Toggle logic in QualitativeCard |
| QualitativeCard stored only in clarification_answers (no process_steps write) | ✅ PASS | Filter only covers 4 slot keys |

### Security Audit

| Check | Result | Notes |
|-------|--------|-------|
| Token auth (no session required) | ✅ PASS | Employees use access_token, no Supabase session |
| Cross-interview isolation | ✅ PASS | All queries scoped to `access_token` match |
| XSS via slot answers | ✅ PASS | Stored as JSONB; never rendered as HTML |
| SQL injection | ✅ PASS | Supabase parameterized queries |
| Rate limiting | ⚠️ LOW | No rate limit on `/clarification` endpoint (unlike `/chat`). Impact low: 409 after first submit; no LLM calls triggered |

### Test Coverage

- **Unit tests (Vitest):** 9/9 pass — covers all validation, error codes, slot mapping, OpenItem insert/skip
- **E2E tests (Playwright):** 36/36 pass — covers API validation, security, cross-browser (Chromium + Mobile Safari)
- **Total tests:** 306 unit + 36 E2E all green

### Bugs Found

| ID | Severity | Description | Steps to Reproduce |
|----|----------|-------------|-------------------|
| BUG-23-1 | **Medium** ✅ Fixed | Reload during clarification loses partial answers. | Fixed: `ClarificationView` persists answers to `localStorage` keyed by token on every card interaction. Merged with `initialAnswers` on mount. Cleared on successful Submit or 409. |
| BUG-23-2 | **Low** ✅ Fixed | No rate limiting on `POST /api/interview/[token]/clarification`. | Fixed: `checkTokenEndpointLimits(token, ip)` added after token format check, same pattern as `/chat`. |
| BUG-23-3 | **Low** ✅ Fixed | `answer: []` (empty array) passes Zod validation. | Fixed: `z.array(z.string()).min(1)` — empty array now returns 400. |

**Bug Tally: 0:0:0 (H:M:L) — all bugs fixed**

### Production-Ready Decision

**✅ READY** — No Critical or High bugs. Medium bug (BUG-23-1) impacts reload-during-partial-answering edge case only; golden path (answer → submit → completed) works correctly. Low bugs are defensive gaps, not user-facing failures.

## Deployment

> **Deploy-Datum:** 2026-06-22 (Bookkeeping-Reconciliation) | **Status:** Deployed | **Production URL:** https://meridian-app.vercel.app

### Deploy-Charakter: Bookkeeping-Reconciliation

Adaptive Clarification Questions ist seit Commit `4c4fc21` (full implementation) live auf `main`, inkl. `ClarificationView`, `POST /api/interview/[token]/clarification` und der Eval-Runner-Integration (`3f62e14`, `d12bda8`). PROJ-23 blieb auf `Approved` mit leerem `Bugs:`-Feld (Hard-Rule-Verletzung) und ohne Deploy-Tag. Dieser Lauf zieht die Buchführung nach. Kein neuer Production-Push.

### Bug-Reconciliation

Alle drei QA-Bugs gefixt: `BUG-23-1` (Reload verliert Teilantworten → `localStorage`-Persistenz), `BUG-23-2` (kein Rate-Limit auf Clarification-Endpoint → `checkTokenEndpointLimits`), `BUG-23-3` (`answer: []` passiert Zod → `.min(1)`). Offen: keine. Leeres Feld `—` → `0:0:0`.

### Gate-Ergebnisse (2026-06-22)

| Gate | Ergebnis | Notiz |
|------|----------|-------|
| G1 — Static | ✅ pass | `npm run build` grün, `tsc --noEmit` exit 0 |
| G2 — Tests | ✅ pass | Vitest 622 passed / 1 skipped (623) |
| G3 — Sandbox | n/a | Code live auf `main`, keine neue Auslieferung |
| G4 — Permissions | ✅ pass | LLM/Token-Endpoint berührt: Rate-Limit (`BUG-23-2` gefixt), Zod-Input-Validation (`BUG-23-3` gefixt), Token-Validierung wie `/chat` |

## Post-Mortem

> Felder retrospektiv aus dem QA-Verlauf abgeleitet. User-Korrektur willkommen.

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High — Card-Schema und Phase-Wiring wie in PROJ-22 vorbereitet umgesetzt |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: M |
| Größte Überraschung | Reload während des Beantwortens verlor Teilantworten — `produce_briefing`-Cards waren serverseitig da, aber die UI-Auswahl nicht persistent (BUG-23-1) |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: ~3 (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | Spec-Lücke (Client-State-Persistenz bei Reload) |
