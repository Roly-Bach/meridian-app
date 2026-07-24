# PROJ-51: Übergang vor Clarification Cards (kein abrupter Sprung nach Verabschiedung)

## Status: Approved
**Type:** Extension
**Domain:** Interview Engine
**Extends:** PROJ-43
**Appetite:** S (Stunden – ½ Tag)
**Bugs:** 0:0:0 (Cycle 2 / Refinement-QA, BUG-4 gefixt und verifiziert — ersetzt den Cycle-1-Stand 0:0:2)
**Created:** 2026-07-24
**Last Updated:** 2026-07-24

## Refinement 2026-07-24 (Live-Feedback nach Deploy)

Nach dem Production-Deploy (`dpl_EK2HpeJE3mAJdFTShSnJKf3KuxZH`, siehe Deployment-Sektion) hat der Nutzer den Übergang in einem echten Live-Interview erlebt und zwei Änderungen am Design angestoßen:

1. **Kein Auto-Advance mehr.** Der automatische Übergang nach 5s fixer Wartezeit entfällt vollständig — nur noch manueller Klick auf "Weiter" löst den Übergang aus. Countdown-Anzeige entfällt damit ebenfalls.
2. **Neue Position des "Weiter"-Buttons.** Statt inline unterhalb der letzten Nachricht (als `MessageList`-Footer) ersetzt der Button die komplette `ChatInput`-Zeile (Textarea + Mikrofon + Senden-Button) an ihrer festen Footer-Position, solange ein Übergang aussteht.

Die Acceptance Criteria, Edge Cases und der Tech-Design-Abschnitt unten sind bereits auf diesen neuen Zielzustand aktualisiert. Die Abschnitte **Implementation Notes / QA Test Results / Deployment / Post-Mortem** weiter unten bleiben unverändert als historischer Nachweis des ERSTEN Baus/Deploys (Auto-Advance-Variante, 2026-07-24) stehen — sie beschreiben nicht mehr den aktuellen Zielzustand. Nach diesem Refine folgt ein neuer `/frontend` → `/qa` → `/deploy`-Zyklus für die überarbeitete Version.

## Context

Nach der letzten Talker-Nachricht (Verabschiedung, inkl. Ankündigung der Abschlussfragen — `talkerPrompt.ts:224-233`) springt die UI ohne jede Verzögerung zum nächsten Bildschirm. Ursache: `checkCompleted()` in [ChatInterface.tsx:99-119](../../src/components/interview/ChatInterface.tsx#L99-L119) prüft unmittelbar nach Streaming-Ende den Server-Status und löst bei Bedarf sofort einen harten Komponenten-Swap aus — entweder zu `ClarificationView` (Zeile 109-112, wenn `phase === 'clarification'` und Cards vorhanden sind) oder direkt zu `ChatCompletedScreen` (Zeile 113-115, wenn `status === 'completed'` ohne Cards). Beide Pfade sind vom selben strukturellen Problem betroffen: der Mitarbeiter hat keine Zeit, die letzte Nachricht des Agenten zu lesen, bevor der Bildschirm wechselt.

PROJ-51 führt einen einheitlichen, clientseitigen Übergangsmechanismus für beide Fälle ein: manueller Wechsel per "Weiter"-Button (kein automatischer Timer), mit sanfter Überblendung beim eigentlichen Wechsel. Reiner Frontend-Scope — kein Backend-Eingriff, keine neuen Felder, kein neuer State in der Turn-Loop.

## Dependencies
- **Extends: PROJ-43** (Elicitation-Reorientierung) — führte den Clarification-Card-Mechanismus und die Farewell+Card-Ankündigung in einer Nachricht ein (`talkerPrompt.ts:224-233`), auf dem dieser Übergang aufbaut.

## User Stories
- Als Mitarbeiter (interviewte Person) möchte ich die Verabschiedungsnachricht des Agenten vollständig lesen können, bevor die Abschlussfragen erscheinen, damit ich mich nicht überrumpelt fühle.
- Als Mitarbeiter möchte ich den Übergang zu den Abschlussfragen durch einen klaren, bewussten Klick selbst auslösen, damit die Seite nicht ungefragt automatisch weiterspringt, während ich noch die Nachricht lese oder nachdenke.
- Als Mitarbeiter möchte ich, dass der Bildschirmwechsel visuell sanft wirkt, damit sich das Interview als ein zusammenhängender, durchdachter Ablauf anfühlt statt als technischer Sprung.
- Als KI-Berater möchte ich, dass dieser Übergang konsistent für beide Fälle gilt (mit und ohne anschließende Cards), damit das Verhalten nicht von einer für den Mitarbeiter unsichtbaren Server-Bedingung abhängt.

## Acceptance Criteria

### AC1 — Übergang nur per manuellem Klick, Button ersetzt die Eingabeleiste
- [ ] Sobald die letzte Talker-Nachricht vollständig gestreamt ist UND der Server-Status einen Phasenwechsel meldet (`phase === 'clarification'` mit Cards ODER `status === 'completed'`), wird der Bildschirmwechsel NICHT sofort ausgeführt.
- [ ] An der festen Footer-Position, an der sonst `ChatInput` (Textarea + Mikrofon + Senden-Button) steht, erscheint sofort nach Streaming-Ende stattdessen ein "Weiter"-Button (Stil konsistent zu [ClarificationView.tsx:116-122](../../src/components/interview/ClarificationView.tsx#L116-L122)). `ChatInput` ist währenddessen nicht sichtbar (kein Overlay, echter Ersatz an derselben Stelle).
- [ ] Kein automatischer Timer, kein Countdown — der Übergang erfolgt ausschließlich durch Klick auf den Button.
- [ ] Ein Klick auf den Button löst den Übergang sofort aus.

### AC2 — Einheitlicher Mechanismus für beide Zielzustände
- [ ] Der Übergangsmechanismus (Button ersetzt `ChatInput`, Übergang per Klick) gilt identisch für beide bestehenden `checkCompleted()`-Pfade: Wechsel zu `ClarificationView` (mit Cards) und direkter Wechsel zu `ChatCompletedScreen` (ohne Cards, `status === 'completed'`).
- [ ] Kein Verhaltensunterschied zwischen den beiden Fällen aus Sicht des Mitarbeiters außer dem jeweils folgenden Zielbildschirm.

### AC3 — Sanfte Überblendung beim eigentlichen Wechsel
- [ ] Der tatsächliche Komponenten-Swap (Chat-Ansicht → Zielbildschirm) erfolgt mit einer CSS-Fade-Transition (ca. 300–400ms), nicht als harter, unmittelbarer Wechsel.
- [ ] Die Fade-Transition nutzt reines CSS/Tailwind, keine neue Animations-Library.
- [ ] Nutzer mit `prefers-reduced-motion: reduce` erhalten den Wechsel ohne Fade-Animation (sofortiger Swap nach Button-Klick).

## Edge Cases
- **Doppelklick auf "Weiter":** Button wird nach dem ersten Klick deaktiviert (sichtbar, nicht nur intern geguarded — siehe BUG-2 aus dem ersten Zyklus, hier jetzt explizite AC statt nur Edge-Case-Text), kein doppeltes Auslösen des Übergangs möglich.
- **`prefers-reduced-motion` aktiv (siehe AC3):** Kein Fade, sofortiger Swap nach Klick.
- **Mitarbeiter versucht während anstehendem Übergang etwas in die (nicht mehr sichtbare) Eingabeleiste zu tippen:** Nicht möglich, da `ChatInput` durch den Button ersetzt ist, nicht nur überlagert — kein Sonderfall, strukturell ausgeschlossen.

## Technical Requirements (optional)
- Kein neues Backend-Feld, keine neue API-Route — der bestehende `checkCompleted()`-Response-Shape (`ChatInterface.tsx:103-108`) bleibt unverändert.
- Reduced-Motion-Handling über bestehende Tailwind/CSS-Mechanismen (`motion-reduce:` Variante oder `@media (prefers-reduced-motion: reduce)`).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
Interview Page (/interview/[token])
├── ChatInterface (aktiver Interview-Bildschirm)
│   ├── MessageList (unverändert)
│   ├── ChatInput (unverändert)
│   └── TransitionPrompt (NEU) — erscheint inline unter der letzten
│       Nachricht, sobald der Server einen Phasenwechsel meldet
│       ├── "Weiter"-Button (Stil wie ClarificationView.tsx:116-122)
│       └── Fortschrittsanzeige (5s-Countdown, shadcn Progress-Komponente)
├── ClarificationView (unverändert — Zielbildschirm Fall A: mit Cards)
└── ChatCompletedScreen (unverändert — Zielbildschirm Fall B: ohne Cards)

Bildschirmwechsel-Hülle (NEU, in page.tsx):
└── Fade-Wrapper — überblendet beim eigentlichen Wechsel zwischen
    ChatInterface → ClarificationView / ChatCompletedScreen
```

### Data Model (rein clientseitig, nichts wird gespeichert)

- **„Wartender Übergang"**: merkt sich, wohin gewechselt werden soll (Abschlussfragen oder Abschluss-Bildschirm) samt den dafür nötigen Daten, sobald der Server das gemeldet hat — aber bevor der Wechsel sichtbar passiert.
- **„Verstrichene Zeit seit Nachrichtenende"**: zählt bis 5 Sekunden hoch, treibt die Fortschrittsanzeige.

Beides existiert nur im Browser-Tab, nichts wird an den Server geschickt. Bei einem Reload während der Wartezeit würde die Seite den bereits finalen Serverzustand sofort korrekt erkennen — nur eben wieder ohne die 5s-Verzögerung. Das ist ein akzeptabler Sonderfall (Edge Case, kein Datenverlust), kein Bug.

### Tech-Entscheidungen (Begründung)

1. **Übergangs-Logik lebt in `ChatInterface`, nicht in der Page.** Beide Zielzustände (mit/ohne Cards) werden bereits heute in derselben Funktion (`checkCompleted()`) erkannt. Diese Funktion hält den Übergang jetzt zurück statt ihn sofort an die Page weiterzureichen — ein gemeinsamer Ankerpunkt stellt sicher, dass beide Fälle wirklich identisch behandelt werden (AC2), statt zwei Stellen synchron halten zu müssen.
2. **Fortschrittsanzeige = bereits vorhandene shadcn `Progress`-Komponente.** Kein neuer Bestandteil, konsistent mit „shadcn/ui first".
3. **Überblendung = reine CSS-Opacity-Transition** (Tailwind), keine Animations-Bibliothek. `prefers-reduced-motion` wird über die Tailwind-Variante `motion-reduce:` abgefangen — kein zusätzlicher Mechanismus nötig.
4. **Keine Backend-Änderung.** Der Response-Shape von `/api/interview/[token]` bleibt exakt wie heute. Die Verzögerung ist reines Client-Timing auf bereits vorhandenen Daten.

### Dependencies

Keine neuen npm-Pakete. Button und Progress sind bereits im Projekt installiert (`src/components/ui/`).

### Tech Design — Update 2026-07-24 (nach Refinement, siehe oben)

Component Structure ändert sich gegenüber dem ersten Zyklus:

```
ChatInterface
├── MessageList (footer-Prop entfällt wieder — TransitionPrompt lebt nicht
│   mehr hier; footer-Prop-Erweiterung aus Zyklus 1 wird zu totem Code,
│   Kandidat für Revert in MessageList.tsx)
└── Footer-Slot (fest positioniert, wie bisher ChatInput):
    ├── ChatInput (wenn kein Übergang aussteht — unverändert)
    └── TransitionPrompt (wenn Übergang aussteht — ERSETZT ChatInput
        an derselben Stelle, kein Nebeneinander)
        └── "Weiter"-Button (kein Countdown, kein Progress-Element mehr)
```

- **`TransitionPrompt.tsx`**: Countdown-Logik (`setInterval`, `DELAY_MS`, `Progress`-Rendering) entfällt komplett. Nur noch Button + `onAdvance()`-Klick-Handler + `firedRef`-Guard (jetzt auch `disabled`-Attribut gesetzt, schließt BUG-2 aus Zyklus 1 mit). Styling wechselt von der rechtsbündigen `MessageList`-Footer-Optik auf die zentrierte `max-w-[760px] mx-auto`-Zeilenlogik von `ChatInput.tsx:67`, damit der Button optisch nahtlos an derselben Stelle sitzt.
- **`ChatInterface.tsx`**: Der feste Footer-Bereich (aktuell Zeile 193-199, `<ChatInput .../>`) wird conditional: `pendingTransition ? <TransitionPrompt onAdvance={handleAdvance} /> : <ChatInput ... />`. Der `footer`-Prop an `<MessageList>` (Zeile 190) entfällt wieder.
- **`MessageList.tsx`**: `footer`-Prop-Erweiterung aus Zyklus 1 zurücknehmen (kein Consumer mehr) — oder unangetastet lassen, falls ein künftiges Feature sie braucht; Entscheidung liegt bei `/frontend`.
- **`progress.tsx`** (`indicatorClassName`-Erweiterung aus Zyklus 1): wird ebenfalls konsumentenlos. Kein Rückbau nötig (non-breaking, optionaler Prop), aber zur Kenntnis für `/frontend`.
- Kein Einfluss auf `FadeIn.tsx`/`page.tsx` — die Fade-Überblendung beim eigentlichen Bildschirmwechsel (AC3) bleibt strukturell unverändert.

## Implementation Notes (Frontend)

- **`TransitionPrompt.tsx`** (neu, `src/components/interview/`): "Weiter"-Button + shadcn-`Progress`-Countdown (5s, 100ms-Tick). Klick oder Ablauf feuert `onAdvance()` genau einmal (Guard via `useRef`, verhindert Doppel-Trigger bei Doppelklick).
- **`FadeIn.tsx`** (neu, `src/components/interview/`): Opacity-Transition-Wrapper (`transition-opacity duration-300`). Prüft `prefers-reduced-motion` per `matchMedia` beim Mount und überspringt die Animation dann vollständig (kein Opacity-0-Startzustand, kein Flackern).
- **`ChatInterface.tsx`**: `checkCompleted()` setzt jetzt einen internen `pendingTransition`-State statt die `onClarification`/`onCompleted`-Callbacks sofort aufzurufen. `TransitionPrompt` wird als `footer` in `MessageList` gerendert (erscheint dadurch inline unterhalb der letzten Nachricht, innerhalb des Auto-Scroll-Bereichs). `ChatInput` wird zusätzlich deaktiviert solange `pendingTransition` gesetzt ist. `handleAdvance()` löst erst beim Ablauf/Klick den tatsächlichen Callback an `page.tsx` aus — identischer Pfad für beide Zielzustände (AC2).
- **`MessageList.tsx`**: neuer optionaler `footer`-Prop, gerendert nach den Message-Bubbles und vor dem Scroll-Anker — kein Verhaltensunterschied wenn ungenutzt.
- **`page.tsx`**: `ClarificationView` und `ChatCompletedScreen` sind jetzt in `<FadeIn>` gewrappt.
- **`progress.tsx`** (shadcn-Komponente, lokal erweitert): neuer optionaler `indicatorClassName`-Prop, damit die Progress-Füllung Meridian Pink (`#E040FB`) statt des shadcn-Default-`bg-primary` nutzt — konsistent mit der bestehenden Konvention (Interview-UI nutzt durchgängig Hex-Werte statt Theme-Tokens). Keine Breaking-Change, da `Progress` vorher nirgends im Projekt verwendet wurde.
- **Manuell verifiziert** (Playwright gegen echten Dev-Server, Netzwerk-Mocks nur für die Backend-Antworten, alle UI-Interaktionen real): Auto-Advance nach 5s, sofortiger Advance per Klick, beide Zielpfade (mit Cards → `ClarificationView`, ohne Cards → `ChatCompletedScreen`), `prefers-reduced-motion` (Countdown-Balken ausgeblendet, kein Fade). `npm run build` + `npm run lint` grün.

## Implementation Notes — Update 2026-07-24 (Cycle 2, nach Refinement)

Umsetzung des Refinements oben (kein Auto-Advance, Button ersetzt `ChatInput`):

- **`TransitionPrompt.tsx`**: komplett neu geschrieben. Countdown-`setInterval`/`Progress`-Rendering entfernt. Nur noch Button + `onAdvance()`-Klick-Handler, doppelt abgesichert gegen Doppel-Trigger: `firedRef` (Guard gegen zwei synchrone Klicks vor Re-Render) UND jetzt zusätzlich echtes `disabled`-Attribut über `fired`-State (schließt BUG-2 aus Zyklus 1 — vorher nur funktional, nicht visuell abgesichert). Styling auf die zentrierte `max-w-[760px] mx-auto`-Footer-Leiste von `ChatInput.tsx:67` umgestellt (`border-t border-[#E5E5E5] bg-white px-6 py-4`), damit der Button optisch nahtlos an derselben Stelle sitzt.
- **`ChatInterface.tsx`**: `MessageList` bekommt keinen `footer`-Prop mehr. Der feste Footer-Bereich rendert jetzt conditional: `{pendingTransition ? <TransitionPrompt onAdvance={handleAdvance} /> : <ChatInput ... />}` — `ChatInput` ist während eines ausstehenden Übergangs nicht mehr im DOM (vorher: sichtbar, nur `disabled`).
- **`MessageList.tsx`**: `footer`-Prop-Erweiterung aus Zyklus 1 zurückgenommen (kein Consumer mehr) — zurück auf den ursprünglichen `{ messages }`-Props-Typ.
- **`progress.tsx`** (shadcn): `indicatorClassName`-Erweiterung aus Zyklus 1 zurückgenommen (kein Consumer mehr, `Progress` wird im Interview-Flow nicht mehr verwendet) — zurück auf shadcn-Standard.
- **`FadeIn.tsx`** / **`page.tsx`**: unverändert — die Fade-Überblendung beim eigentlichen Bildschirmwechsel (AC3) ist von der Auto-Advance-Entfernung nicht betroffen.
- **Manuell verifiziert** (Playwright gegen echten Dev-Server + Screenshot): Button erscheint exakt an `ChatInput`s Position, keine Textarea/Mikrofon/Senden-Button sichtbar während `pendingTransition`, kein Countdown/Progress mehr vorhanden, Klick löst sofort aus, Button visuell disabled nach Klick, `prefers-reduced-motion` weiterhin ohne Fade. `npm run build` + `npm run lint` grün, 867/867 Unit-Tests (863 + 4 neue `TransitionPrompt.test.tsx`, keine Fake-Timer mehr nötig), 5/5 E2E-Tests (`tests/PROJ-51-...spec.ts`, Auto-Advance-Test entfernt, neuer Disabled-State-Test ergänzt).

## QA Test Results

**Datum:** 2026-07-24 · **Getestet gegen:** uncommitted Working-Tree-Diff (kein Commit-Hash, siehe `git status`)

### Automatisiert
- `npm run lint` (tsc --noEmit): clean
- `npm run build`: clean (Next.js 16, keine neuen Routen)
- `npm test`: **868/868 grün** (863 vorher + 5 neue `TransitionPrompt.test.tsx`-Unit-Tests, fake timers)
- `npm run test:e2e` (chromium, gezielt): **4/4 neue PROJ-51-Tests grün** (`tests/PROJ-51-uebergang-vor-clarification-cards.spec.ts`) + Regressionslauf `PROJ-3`/`PROJ-43` (chromium): 25 passed, 1 pre-existing Flake (`agent greeting appears automatically` — dokumentierte **PROJ-43-BUG-1** / KI-31, nicht PROJ-51-verursacht, Serial-Suite bricht danach 2 Folgetests korrekt ab)
- Mobile Safari/webkit-Projekt nicht mitgelaufen (bekanntes Environment-Problem, siehe Memory `reference_playwright_e2e_harness_hang` — nicht PROJ-51-spezifisch)

### Acceptance Criteria

**AC1 — Verzögerter Übergang nach Streaming-Ende**
- [x] Bildschirmwechsel wird nicht sofort ausgeführt (E2E)
- [x] "Weiter"-Button erscheint sofort nach Streaming-Ende unterhalb der letzten Nachricht (E2E, als `MessageList`-Footer)
- [x] Dezenter visueller Countdown-Indikator (Progress-Füllung im Button-Bereich)
- [x] Automatischer Übergang nach 5s fixer Wartezeit ohne Klick (Unit-Test mit fake timers: kein Fire bei 4.9s, Fire bei 5.1s; E2E mit realer Wartezeit)
- [x] Klick während der Wartezeit löst sofortigen Übergang aus, unabhängig von Restzeit (Unit + E2E)

**AC2 — Einheitlicher Mechanismus für beide Zielzustände**
- [x] Identischer Mechanismus für `ClarificationView`- und `ChatCompletedScreen`-Pfad (beide via `TransitionPrompt`/`pendingTransition` in `ChatInterface.tsx`, E2E deckt beide Pfade ab)
- [x] Kein Verhaltensunterschied außer Zielbildschirm

**AC3 — Sanfte Überblendung beim eigentlichen Wechsel**
- [x] CSS-Fade-Transition (~300ms) beim Komponenten-Swap (`FadeIn.tsx`, `transition-opacity duration-300`)
- [x] Reines CSS/Tailwind, keine neue Animations-Library (package.json unverändert)
- [x] `prefers-reduced-motion: reduce` → sofortiger Swap ohne Fade (Fix verifiziert, siehe **BUG-1**)

**AC4 — Verbindungsverhalten während der Wartezeit**
- [x] Verbindungsabbruch/Reconnect während der 5s-Wartezeit beeinflusst Countdown nicht (Code-Review: `TransitionPrompt`s Timer ist vollständig eigenständig — kein Reconnect-Polling ist an `pendingTransition` gekoppelt; nicht live nachgestellt, da ein Mid-Transition-Reconnect über gemockte SSE-Responses aufwendig zu simulieren ist und der Code strukturell keine Kopplung zeigt)

### Edge Cases
- [x] Doppelklick auf "Weiter" löst Übergang nur einmal aus (Unit-Test mit synchronem Doppel-`fireEvent.click`, E2E mit synchronem Doppel-Click via `el.click(); el.click()`) — siehe aber **BUG-2** (visuelle Deaktivierung fehlt)
- [x] Scroll während der Wartezeit beeinflusst Countdown/Button nicht (Code-Review: kein Coupling zwischen Scroll-Handler in `MessageList` und `TransitionPrompt`-State)
- [x] Feste 5s unabhängig von Nachrichtenlänge (Code: `DELAY_MS`-Konstante, kein längenabhängiger Wert)
- [x] Verbindungsabbruch während Wartezeit — siehe AC4
- [x] `prefers-reduced-motion` aktiv (Fix verifiziert, siehe **BUG-1**)
- [x] Tab-Wechsel im Hintergrund — kein Sonderverhalten nötig laut Spec, Timer basiert auf `Date.now()`-Delta statt Tick-Zählung, daher robust gegen Drosselung

### Regressionstests
- Bestehende `Progress`-shadcn-Komponente hat nur einen Consumer (`TransitionPrompt.tsx`) — `indicatorClassName`-Erweiterung ist non-breaking, keine anderen Stellen betroffen (grep-verifiziert)
- `MessageList`s neuer `footer`-Prop ist optional, bestehendes Scroll-Verhalten unverändert (Regressionslauf PROJ-3/PROJ-43 grün)
- Kein neues Backend/keine neue Route — Object-Ownership-Pflichtpunkt aus `.claude/rules/security.md` entfällt (keine neue `[id]`-Route)

### Bugs

**BUG-1 (Medium) — `prefers-reduced-motion: reduce` unterdrückt die Fade-Animation nicht wirklich**
`FadeIn.tsx` prüft `matchMedia('(prefers-reduced-motion: reduce)')` per JS in einem `useEffect` und setzt `visible` sofort auf `true` — aber die CSS-Klasse `transition-opacity duration-300` bleibt in beiden Fällen unverändert an der Wrapper-`div` bestehen (nicht per `motion-reduce:transition-none` abgeschaltet, wie im Tech Design als Option genannt: „Reduced-Motion-Handling über bestehende Tailwind/CSS-Mechanismen (`motion-reduce:`-Variante oder `@media`)"). Verifiziert per `getComputedStyle` unter emuliertem `reducedMotion: 'reduce'`: `transitionDuration: "0.3s"`, `transitionProperty: "opacity"` bleiben aktiv. Da `useEffect` (nicht `useLayoutEffect`) erst nach dem ersten Paint feuert, rendert der Browser zunächst `opacity-0`, dann läuft der Flip zu `opacity-100` weiterhin über die aktive 300ms-Transition — der in AC3 geforderte "sofortige Swap ohne Fade-Animation" ist für reduced-motion-Nutzer nicht gegeben. Praktische Sichtbarkeit ist gering (ein Frame + 300ms Ease), aber die AC ist nachweisbar verletzt.
→ Fix-Ansatz: `motion-reduce:transition-none` (oder `motion-reduce:duration-0`) zusätzlich zur JS-Prüfung auf den Wrapper-`div` in `FadeIn.tsx` anwenden, oder `useLayoutEffect` statt `useEffect` verwenden.
Datei: `src/components/interview/FadeIn.tsx:19`

**Fix (2026-07-24, `/frontend`):** `motion-reduce:transition-none motion-reduce:duration-0` zusätzlich zur bestehenden `transition-opacity duration-300`-Klasse auf den Wrapper-`div` angewendet (`FadeIn.tsx:19-21`). Die CSS-Media-Query-Variante wirkt unabhängig vom `useEffect`-Timing, löst damit auch das Ein-Frame-Flash-Detail. Verifiziert per neuem `getComputedStyle`-Assert in `tests/PROJ-51-uebergang-vor-clarification-cards.spec.ts` (Test „AC3: prefers-reduced-motion..."): `transitionDuration` jetzt `0s` statt `0.3s`. Regressions-Nachweis: Test schlägt reproduzierbar fehl (`Expected: "0s" / Received: "0.3s"`) gegen die vorherige `FadeIn.tsx`-Fassung ohne die `motion-reduce:`-Klassen — bestätigt, dass der Test die Lücke wirklich abdeckt. `npm run lint`, `npm run build`, `npm test` (868/868), `npx playwright test tests/PROJ-51-...` (4/4, chromium) alle grün.

**BUG-2 (Low) — "Weiter"-Button wird nach Klick nicht visuell deaktiviert**
Edge-Case-Beschreibung in der Spec: „Button wird nach dem ersten Klick deaktiviert, kein doppeltes Auslösen des Übergangs möglich." Die Doppel-Auslösung wird korrekt über einen internen `firedRef`-Guard verhindert (funktional korrekt, verifiziert), aber der Button erhält kein `disabled`-Attribut/visuelles Feedback — er bleibt bis zum (fast unmittelbaren) Unmount normal klickbar aussehend. In der Praxis kaum wahrnehmbar, da die Elternkomponente (`page.tsx`) beim Fire synchron auf den Zielbildschirm wechselt und `TransitionPrompt` dabei unmountet. Weicht aber vom wörtlichen Spec-Text ab.
Datei: `src/components/interview/TransitionPrompt.tsx:34-38`

**BUG-3 (Low) — Kein Screenreader-Hinweis vor automatischer Navigation**
Die 5s-Progress-Anzeige ist bewusst `aria-hidden="true"` (der Button ist der eigentliche Steuerungspunkt, das ist an sich sinnvoll), aber es gibt keinerlei `aria-live`-Ankündigung, dass die Seite in Kürze automatisch wechselt. Screenreader-Nutzer erfahren vom bevorstehenden automatischen Wechsel nicht vorab. Keine explizite AC hierzu, aber ein reales A11y-Gap in einem ansonsten reduced-motion-bewussten Feature.
Datei: `src/components/interview/TransitionPrompt.tsx`

### Security-Audit
Reiner Frontend-Scope, kein neuer Server-State, keine neue Route, kein User-Input-Rendering in den neuen Komponenten (`TransitionPrompt`/`FadeIn` rendern nur statischen Text bzw. Children aus bereits vertrauenswürdigen Quellen). Keine Befunde.

### Neue Tests
- `src/components/interview/TransitionPrompt.test.tsx` (5 Unit-Tests, fake timers)
- `tests/PROJ-51-uebergang-vor-clarification-cards.spec.ts` (4 E2E-Tests, chromium)

### Eval-Gate — Hinweis + User-Entscheidung
`.claude/rules/general.md` verlangt für Interview-Engine-Domain-Features grundsätzlich einen `eval:interview`-Nachweis vor Approved. PROJ-51 ändert nachweislich **keinen** Backend-/Turn-Loop-/Prompt-Code (reiner Client-Timing-Layer nach bereits finalem Server-Zustand). Der synthetische Eval-Runner steuert keine echten UI-Klicks (siehe Code-Kommentar in `tests/PROJ-43-elicitation-reorientierung.spec.ts:6-8`) und kann den Transition-Mechanismus daher nicht erreichen — ein Eval-Lauf würde ausschließlich bereits an anderer Stelle getestetes Agentenverhalten erneut prüfen, ohne PROJ-51-spezifisches Signal zu liefern.
**User-Entscheidung (2026-07-24): Eval-Gate für PROJ-51 als nicht anwendbar behandelt** (analog zur PROJ-43-Präzedenz für UI-only ACs). E2E-Suite gilt als Ersatznachweis für den Übergang zu Approved.

### Production-Ready Empfehlung
**0 Critical/High, 1 Medium, 2 Low.** Nach der Bugs-H:M:L-Regel technisch READY (kein Critical/High), aber:
**User-Entscheidung (2026-07-24): BUG-1 (Medium, AC3-Verletzung) wird vor Approved gefixt.** Status bleibt **In Review** bis der Fix vorliegt und erneut verifiziert wurde (`/frontend` → BUG-1 in `FadeIn.tsx:19`, dann `/qa` erneut für den Re-Check). BUG-2/BUG-3 (Low) bleiben dokumentiert, kein Blocker.

**Re-Check abgeschlossen (2026-07-24): 0 Critical, 0 High, 0 Medium, 2 Low.** BUG-1-Fix verifiziert (siehe oben). **READY.** Status → **Approved**.

**Fix geliefert (2026-07-24, `/frontend`):** BUG-1 behoben, siehe Fix-Notiz im Bugs-Abschnitt oben. Status bleibt bewusst **In Review** — der Re-Check per `/qa` steht laut Plan noch aus, bevor auf Approved gewechselt werden darf.

### Re-Check (2026-07-24, `/qa`)
Fix für BUG-1 verifiziert, nicht nur laut Fix-Notiz übernommen:
- `FadeIn.tsx:20` trägt jetzt `motion-reduce:transition-none motion-reduce:duration-0` zusätzlich zur bestehenden `transition-opacity duration-300`-Klasse.
- `npm test`: **868/868 grün**.
- `npx playwright test tests/PROJ-51-...spec.ts --project=chromium`: **4/4 grün**, inkl. des BUG-1-Regressionstests (`AC3: prefers-reduced-motion...`), der `getComputedStyle(...).transitionDuration === '0s'` unter `reducedMotion: 'reduce'` explizit prüft.
- `npm run lint` (tsc --noEmit): clean.
- `npm run build`: clean.

BUG-1 damit von Medium auf gelöst. BUG-2/BUG-3 (Low) bleiben offen, kein Blocker — siehe Bugs-Abschnitt oben.

## QA Test Results — Cycle 2 (2026-07-24, Refinement: kein Auto-Advance, Button ersetzt ChatInput)

**Getestet gegen:** Commit `040d814` (main, working tree sauber). Testet den überarbeiteten Zielzustand aus dem Refinement-Abschnitt oben (kein Auto-Advance, `TransitionPrompt` ersetzt `ChatInput` an derselben Footer-Position). Der QA-Abschnitt für Cycle 1 (Auto-Advance-Variante) oben bleibt als historischer Nachweis stehen und wird durch diesen Abschnitt fachlich abgelöst.

### Automatisiert
- `npm run lint` (tsc --noEmit): clean
- `npm test`: **867/867 grün** (70 Testdateien; Rückgang von 868→867 gegenüber Cycle 1 durch Ersatz der 5 alten `TransitionPrompt`-Tests durch 4 neue, siehe `TransitionPrompt.test.tsx`)
- `npx playwright test tests/PROJ-51-uebergang-vor-clarification-cards.spec.ts --project=chromium`: **5/5 grün**
- Regressionslauf `tests/PROJ-3-interview-ui.spec.ts` + `tests/PROJ-43-elicitation-reorientierung.spec.ts` (chromium): **25/26 grün, 1 vorbestehender Flake** (`Chat page: agent greeting appears automatically on first open` — identisch mit dem in Cycle 1 dokumentierten **PROJ-43-BUG-1 / KI-31**, nicht durch PROJ-51 verursacht, kein neuer Code-Pfad berührt diesen Test)
- Mobile Safari/webkit-Projekt nicht mitgelaufen (bekanntes Environment-Problem, Memory `reference_playwright_e2e_harness_hang` — nicht PROJ-51-spezifisch)

### Acceptance Criteria

**AC1 — Übergang nur per manuellem Klick, Button ersetzt die Eingabeleiste**
- [x] Kein sofortiger Bildschirmwechsel nach Streaming-Ende (E2E)
- [x] "Weiter"-Button erscheint an `ChatInput`s fester Footer-Position, Stil konsistent zu `ClarificationView.tsx` (Code-Review `TransitionPrompt.tsx:22-33` + E2E)
- [x] `ChatInput` (Textarea + Mikrofon + Senden-Button) ist währenddessen komplett aus dem DOM entfernt, kein Overlay (E2E: `expect(textarea).not.toBeVisible()`, Code-Review `ChatInterface.tsx:190-200` — echter conditional Swap, kein `disabled`)
- [x] Kein Timer, kein Countdown (Code-Review: `TransitionPrompt.tsx` enthält kein `setInterval`/`Progress` mehr; `grep` auf `indicatorClassName` im gesamten `src/` liefert keinen Treffer — Cycle-1-Erweiterung vollständig zurückgenommen)
- [x] Klick löst Übergang sofort aus (Unit + E2E)

**AC2 — Einheitlicher Mechanismus für beide Zielzustände**
- [x] Identischer `pendingTransition`-State + `TransitionPrompt` für `ClarificationView`- und `ChatCompletedScreen`-Pfad (Code-Review `ChatInterface.tsx:105-138`, beide E2E-Pfade grün)
- [x] Kein Verhaltensunterschied außer Zielbildschirm

**AC3 — Sanfte Überblendung beim eigentlichen Wechsel**
- [x] CSS-Fade-Transition (~300ms) beim Komponenten-Swap (`FadeIn.tsx`, in `page.tsx:97-99`/`105-113` um beide Zielbildschirme gewrappt)
- [x] Reines CSS/Tailwind, keine neue Library (package.json unverändert)
- [x] `prefers-reduced-motion: reduce` → sofortiger Swap ohne Fade — BUG-1 aus Cycle 1 bleibt gefixt (`FadeIn.tsx:20` trägt weiterhin `motion-reduce:transition-none motion-reduce:duration-0`), erneut per E2E verifiziert (`getComputedStyle(...).transitionDuration === '0s'`)

### Edge Cases
- [x] Doppelklick auf "Weiter" löst Übergang nur einmal aus — jetzt zusätzlich mit echtem `disabled`-Attribut nach Klick (Unit + E2E, schließt Cycle-1-**BUG-2** endgültig)
- [x] Tippen in die (nicht mehr sichtbare) Eingabeleiste strukturell unmöglich — `ChatInput` ist unmounted, nicht nur deaktiviert (Code-Review)
- [x] `prefers-reduced-motion` aktiv — siehe AC3
- [x] Verbindungsabbruch/Reconnect während anstehendem Übergang beeinflusst `TransitionPrompt` nicht (Code-Review `useInterviewStream.ts`: `reconnect()` ist ein einmaliger Request ohne Polling, keine Kopplung an `pendingTransition`-State)

### Neuer Befund (nicht in der Spec als Edge Case dokumentiert)
Bei manueller Fokus-Prüfung (Playwright `document.activeElement` nach dem Unmount von `ChatInput`): wenn der Mitarbeiter mit der Tastatur/einem Screenreader arbeitet und in der fokussierten `Textarea` `Enter` drückt, verschwindet diese beim Phasenwechsel ersatzlos aus dem DOM. Der Fokus fällt dabei auf `<body>` zurück — weder wird der Fokus programmatisch auf den neuen "Weiter"-Button gesetzt, noch gibt es eine `aria-live`-Ankündigung des Phasenwechsels. Für Screenreader-Nutzer ist damit nicht erkennbar, dass ein neues interaktives Element (der Button) erschienen ist; sie müssten die Seite erneut explorieren, um es zu finden. Siehe **BUG-4** unten.

### Bugs

**BUG-4 (Low) — Fokus geht beim `ChatInput`→`TransitionPrompt`-Wechsel verloren, keine Screenreader-Ankündigung**
Reproduktion: Textarea fokussieren, Nachricht senden (Enter), warten bis Server-Status einen Phasenwechsel meldet. `ChatInput` wird unmounted, `TransitionPrompt` gerendert. `document.activeElement` ist danach `<body>` statt des neuen "Weiter"-Buttons — verifiziert per Playwright-Check (`ACTIVE ELEMENT: BODY`). Kein `aria-live`-Bereich kündigt den Phasenwechsel an. Praktische Auswirkung: sehende Tastatur-Nutzer müssen erneut per Tab navigieren, um den Button zu erreichen; Screenreader-Nutzer erfahren nichts vom neuen interaktiven Element, bis sie die Seite erneut explorieren.
Datei: `src/components/interview/ChatInterface.tsx:190-200` (Swap-Stelle), `src/components/interview/TransitionPrompt.tsx` (fehlender Fokus/`aria-live`)
→ Fix-Ansatz: Fokus programmatisch auf den "Weiter"-Button setzen (`ref` + `.focus()`) sobald `TransitionPrompt` mountet, plus optional `aria-live="polite"`-Ankündigung des Phasenwechsels.

**Fix (2026-07-24, direkt in dieser QA-Session auf Nutzerwunsch):** `TransitionPrompt.tsx` bekommt einen `buttonRef` + `useEffect`, der den Button beim Mount fokussiert (`buttonRef.current?.focus()`), sowie einen `sr-only`-`<span role="status" aria-live="polite">`, der den Phasenwechsel textlich ankündigt ("Das Gespräch ist an dieser Stelle abgeschlossen. Klicke auf 'Weiter', um fortzufahren."). `Button` (shadcn) forwarded `ref` bereits nativ (`React.forwardRef`), keine Änderung an `button.tsx` nötig.
Verifiziert: neuer Unit-Test `TransitionPrompt.test.tsx` ("BUG-4 fix: focus moves to the button on mount…") + neuer E2E-Test `tests/PROJ-51-...spec.ts` ("BUG-4 fix: focus moves to the 'Weiter' button after ChatInput unmounts", `expect(advanceBtn).toBeFocused()`). `npm run lint` clean, `npm test`: **868/868 grün** (867 + 1 neuer Fokus-Unit-Test), `npx playwright test tests/PROJ-51-...spec.ts --project=chromium`: **6/6 grün** (5 + 1 neuer Fokus-E2E-Test).

Verwandte Cycle-1-Bugs — Status:
- **BUG-1** (Medium, reduced-motion) — weiterhin gefixt, siehe AC3 oben.
- **BUG-2** (Low, Button nicht visuell deaktiviert) — behoben (siehe Edge Cases oben, `disabled`-Attribut + Test).
- **BUG-3** (Low, kein Screenreader-Hinweis vor automatischem Wechsel) — durch die Refinement-Entscheidung "kein Auto-Advance" strukturell entfallen (es gibt keinen automatischen Wechsel mehr, vor dem gewarnt werden müsste). Abgelöst durch das neue, enger gefasste **BUG-4** oben (Fokus/Ankündigung beim manuellen Wechsel).

### Regressionstests
- `MessageList.tsx`: `footer`-Prop-Erweiterung aus Cycle 1 vollständig zurückgenommen, zurück auf ursprünglichen `{ messages }`-Typ (Code-Review, keine anderen Consumer, Regressionslauf PROJ-3/PROJ-43 grün)
- `progress.tsx`: `indicatorClassName`-Erweiterung zurückgenommen, Komponente zurück auf shadcn-Standard, keine Consumer mehr im Projekt (`grep` bestätigt)
- Kein neues Backend/keine neue Route — Object-Ownership-Pflichtpunkt entfällt weiterhin

### Security-Audit
Unverändert gegenüber Cycle 1: reiner Frontend-Scope, kein neuer Server-State, keine neue Route, kein User-Input-Rendering in `TransitionPrompt`/`FadeIn`. Keine Befunde.

### Eval-Gate — Hinweis + User-Entscheidung (fortgeführt aus Cycle 1)
PROJ-51 bleibt reiner Client-Timing-Layer, kein Backend-/Turn-Loop-/Prompt-Code betroffen — die Refinement-Änderung (kein Auto-Advance, andere Button-Position) verstärkt das eher (noch weniger Server-Interaktion als Cycle 1). Die Cycle-1-User-Entscheidung, das Eval-Gate für PROJ-51 als nicht anwendbar zu behandeln, gilt unverändert fort. E2E-Suite bleibt Ersatznachweis.

### Production-Ready Empfehlung
**0 Critical, 0 High, 0 Medium, 1 Low (BUG-4).** Nach der Bugs-H:M:L-Regel technisch **READY**.

**Re-Check abgeschlossen (2026-07-24): BUG-4 gefixt und verifiziert** (siehe Fix-Notiz oben). **0 Critical, 0 High, 0 Medium, 0 Low. READY.** Status → **Approved**.

## Deployment

**Production URL:** https://meridian-app-tau.vercel.app
**Deployed:** 2026-07-24
**Deployment ID:** `dpl_EK2HpeJE3mAJdFTShSnJKf3KuxZH` (commit `76b69b1`, target `production`, region `iad1`)

| Gate | Ergebnis |
|------|----------|
| G1 Static | pass — `npm run build` clean, `npm run lint` (tsc --noEmit) clean, Security-Header (CSP via proxy.ts/PROJ-15, X-Frame-Options DENY, Referrer-Policy) vorhanden |
| G2 Tests | pass — 868/868 Unit-Tests, 4/4 PROJ-51-E2E-Tests (chromium); Regressionslauf PROJ-3/PROJ-43: 24-25/26 (1 vorbestehender, dokumentierter Flake `agent greeting appears automatically` = PROJ-43-BUG-1/KI-31, per Doppellauf als flaky statt neu-regressiert bestätigt) |
| G3 Sandbox | n/a — GitHub-Auto-Deploy für diesen Push hat nach mehrminütigem Polling nicht reagiert; Deploy stattdessen per `npx vercel --prod --yes` (User-ausgeführt) direkt auf Produktion, danach per API verifiziert (READY, korrekter Commit) |
| G4 Permissions | n/a — PROJ-51 berührt keine Auth/RLS/API/LLM-Pfade (reiner Frontend-Timing-Layer) |

**Post-Deployment-Verifikation:**
- Production-URL lädt korrekt (Login-Seite, kein 500/Build-Fehler, per WebFetch bestätigt)
- Build-Logs sauber (`✓ Compiled successfully`, TypeScript clean, 17/17 statische Seiten)
- `get_runtime_errors`: 2 Fehlergruppen gefunden, beide jedoch `lastDeployment=dpl_HkSUrTLEfbPvqL6ELgp4NYZntaP4` (die VORHERIGE Produktion, vor PROJ-51) zugeordnet und über den Zeitraum 2026-07-14 bis 2026-07-24 verteilt — **vorbestehend, nicht PROJ-51-verursacht** (PROJ-51 ändert keinen LLM-/Guard-Code). Separates Known-Issue, siehe Hinweis unten.

**Prozess-Abweichung (dokumentiert):** Der übliche Workflow-Schritt "Code committed und gepusht" (G1-Precondition) führte hier zu einem Push auf `main`, bevor die Production-Deploy-Freigabe eingeholt wurde — in diesem Projekt löst ein Push auf `main` potenziell einen Auto-Deploy aus. User hat nachträglich per Rückfrage bestätigt weiterzumachen (kein Rollback nötig, PROJ-51 war bereits QA-approved mit 0 Critical/High/Medium). Für künftige `/deploy`-Läufe: Freigabe-Frage VOR dem Push stellen, nicht danach.

## Post-Mortem

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | Medium — Kern (Button + Countdown + Fade, einheitlicher Pfad für beide Zielzustände) passte 1:1, aber Details wie das reduced-motion-Verhalten mussten erst in der QA-Runde nachgeschärft werden (siehe BUG-1) |
| Appetite vs. tatsächlich | geschätzt: S / tatsächlich: S (reiner Frontend-Scope, ein Fix-Zyklus für BUG-1, kein Backend-Eingriff nötig) |
| Größte Überraschung | Die JS-`matchMedia`-Prüfung in `FadeIn.tsx` allein reichte nicht, um `prefers-reduced-motion` durchzusetzen — die CSS-`transition-opacity`-Klasse blieb unabhängig vom React-State aktiv und musste zusätzlich per `motion-reduce:`-Variante abgeschaltet werden (BUG-1). Lehre: JS-Feature-Detection und CSS-Media-Query-Verhalten sind zwei getrennte Mechanismen, die beide separat abgesichert werden müssen. |
| Vorgeschlagene Regeländerung | `/deploy` sollte die Production-Approval-Frage VOR dem `git push` auf `main` stellen, nicht erst vor dem expliziten `vercel --prod`-Aufruf — in diesem Projekt kann ein Push auf `main` direkt einen Auto-Deploy auslösen (bei diesem Lauf reagierte der Auto-Deploy zwar nicht, was den Fehler nicht sichtbar machte, aber das Risiko besteht strukturell). Nutzer-bestätigt, Aufnahme in `.claude/skills/deploy/SKILL.md` empfohlen. |
| Build-Loop-Iterationen | nicht ermittelbar in dieser Session — Frontend-Implementierung erfolgte in einer vorherigen Konversation, dieser Session-Verlauf beginnt erst bei `/qa` |
| Häufigste Fehlerkategorie im Loop | nicht ermittelbar (s.o.); in der QA-Runde selbst: 1 Spec-Lücke (BUG-1, reduced-motion), 2 dokumentierte Low-Abweichungen (BUG-2/3) |
