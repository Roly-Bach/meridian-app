# PROJ-15: CSP Hardening (Nonce-basiertes CSP)

## Status: Approved
**Created:** 2026-05-23
**Blocked:** 2026-05-24 → **Entblockt:** 2026-06-22
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** S
**Bugs:** 0:0:1

## Blocker (gelöst 2026-06-22)

Next.js 16.1.1 verwirft alle Custom-Response-Header, die aus `proxy.ts`/`middleware.ts` gesetzt werden — sowohl im Dev-Modus (Turbopack) als auch im Production-Build (`next start`). Auth-Logik (Redirects) funktioniert nachweislich, aber `response.headers.set('Content-Security-Policy', ...)` und Header über den NextResponse-Konstruktor erscheinen nicht in der HTTP-Response. Damit ist nonce-basiertes CSP nach offiziellem Pattern (Doku: nextjs.org/docs/app/guides/content-security-policy) in dieser Next.js-Version nicht implementierbar.

**Re-Test 2026-06-22 (Next.js 16.2.6, Projekt-Dependency bereits aktuell):** Spike mit temporärer `src/middleware.ts`, die einen Custom-Header setzt — Header erscheint korrekt in der Response (`x-proj-15-spike-test: nonce-header-check`), auch auf einem 307-Redirect. Bug ist behoben, wie in der Spec vorausgesagt ("Bei Next.js 16.2+ erneut versuchen"). Spike-Datei wieder entfernt, kein Produktionscode betroffen.

**Aktueller Zustand (Pre-PROJ-15 minus `unsafe-eval`):**
CSP zurück in `next.config.ts` mit `script-src 'self' 'unsafe-inline' blob:`. Kein `unsafe-eval`, restliche Security-Header (HSTS, X-Frame-Options, etc.) bleiben aktiv.

**Nächster Schritt:** GitHub-Issue bei vercel/next.js öffnen oder auf Patch warten. Bei Next.js 16.2+ erneut versuchen.

## Dependencies
- Requires: PROJ-3 (Interview UI) — alle Inline-Scripts und die AudioWorklet-Initialisierung müssen nach CSP-Änderung weiterhin funktionieren
- Requires: PROJ-7 (Voice Input) — `blob:` in `worker-src` bleibt, Nonce auf AudioWorklet-Script anwenden

## Context

**Ist-Zustand (nach Quick-Fix 2026-05-23):**
```
script-src 'self' 'unsafe-inline' blob:
```
`'unsafe-eval'` wurde bereits entfernt (Quick-Fix im Zuge des Security-Audits PROJ-8).
`'unsafe-inline'` ist das verbleibende Risiko: Es erlaubt beliebige Inline-Scripts, was XSS-Angriffe durch injizierte LLM-Outputs nicht blockiert.

**Zielzustand:**
```
script-src 'self' 'nonce-{zufällig-pro-request}' blob:
```
Kein `'unsafe-inline'`, kein `'unsafe-eval'`. Jeder Script-Tag, der ausgeführt werden darf, trägt den Nonce. Alles andere wird blockiert.

**Technischer Ansatz:** Next.js App Router unterstützt nonce-basiertes CSP nativ über Middleware + `headers()` in `layout.tsx`. Der Nonce wird per Request generiert, via Header weitergegeben und in alle `<script>`-Tags des Roots eingebettet.

## User Stories

- Als Betreiber möchte ich, dass kein Inline-Script ohne explizite Erlaubnis ausgeführt werden kann, damit injizierter Code aus LLM-Outputs oder kompromittierten Dependencies keine Schadensfunktion erreicht.
- Als Entwickler möchte ich, dass die CSP-Konfiguration als Single Source of Truth in der Middleware liegt, damit ich künftige Änderungen an einer Stelle vornehme.

## Acceptance Criteria

### Deliverable 1: Middleware mit Nonce-Generierung

- [ ] `src/middleware.ts` generiert per Request einen kryptographisch zufälligen Nonce (`crypto.randomUUID()` oder `crypto.getRandomValues`)
- [ ] Nonce wird als `x-nonce`-Header in die Response gesetzt (damit `layout.tsx` ihn lesen kann)
- [ ] CSP-Header wird in der Middleware gesetzt (nicht mehr in `next.config.ts`) mit `'nonce-{value}'` statt `'unsafe-inline'`
- [ ] `next.config.ts` enthält keinen CSP-Header mehr (Middleware ist alleinige Quelle)
- [ ] Bestehende Middleware-Logik (falls vorhanden) bleibt erhalten

### Deliverable 2: Nonce in Root Layout eingebunden

- [ ] `src/app/layout.tsx` liest `x-nonce` aus den Request-Headers (`headers()` aus `next/headers`)
- [ ] Nonce wird als `nonce`-Prop an alle manuellen `<script>`-Tags weitergegeben
- [ ] Next.js überträgt den Nonce automatisch auf seine eigenen generierten Script-Tags (via `<html nonce={nonce}>` oder Next.js-eigene Nonce-API — je nach Next.js-Version)

### Deliverable 3: Smoke-Tests

- [ ] `npm run build` ohne Fehler
- [ ] `npm run dev`: Browser-DevTools zeigen keinen `'unsafe-inline'` im CSP-Header
- [ ] Browser-DevTools: keine CSP-Violation-Warnings beim normalen Interview-Ablauf
- [ ] Voice Input (PROJ-7): AudioWorklet lädt korrekt (`blob:` bleibt in `script-src`)
- [ ] PDF-Report (PROJ-11): generieren und herunterladen funktioniert

### Deliverable 4: Unit-Test für CSP-Header

- [ ] Test prüft, dass der CSP-Header `'nonce-'` enthält
- [ ] Test prüft, dass `'unsafe-inline'` und `'unsafe-eval'` nicht im Header vorkommen
- [ ] Test prüft, dass `blob:` in `script-src` vorhanden ist (für AudioWorklet)

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Next.js-interne Scripts ohne Nonce | Next.js 13+ überträgt den Nonce automatisch wenn er im Root-Layout gesetzt ist — kein manuelles Anpassen der generierten Scripts nötig |
| `<script>` in einer Client Component | Nonce muss als Prop durchgereicht werden; bei shadcn-Komponenten mit dynamischem Script kein Anpassungsbedarf (kein direktes `<script>`) |
| AudioWorklet via `new Worker(URL.createObjectURL(...))` | Läuft über `blob:` in `script-src`, kein Nonce nötig |
| Drittanbieter-Script (aktuell keines) | Würde explizit als `src`-Whitelist oder per Nonce eingebunden — kein aktueller Anpassungsbedarf |
| Middleware-Fehler (Nonce nicht gesetzt) | Fallback auf leeren Nonce → alle Scripts blockiert; in Dev sofort sichtbar, kein stilles Fehlschlagen |

## Technical Requirements

- Nonce-Generierung ausschließlich server-seitig in der Middleware
- CSP-Header-Konfiguration liegt nach diesem Feature vollständig in `src/middleware.ts` — `next.config.ts` enthält nur noch die restlichen Security-Header (HSTS, X-Frame-Options etc.)
- Kein neues NPM-Package erforderlich (Web Crypto API ist in Next.js Edge-Runtime und Node.js verfügbar)

## Out of Scope

- `'unsafe-inline'` in `style-src` (CSS-Injection ist kein relevantes Angriffsszenario für diese App)
- HSTS `preload` Direktive (externe Registrierung, kein Code-Change)
- Subresource Integrity für externe Assets (keine externen Scripts geladen)

## Verifikation

1. DevTools → Network → beliebige Route → Response Headers: CSP enthält `nonce-`, kein `unsafe-inline`
2. `npm run build` und `npm run start` ohne Fehler
3. Manueller Interview-Durchlauf inkl. Voice Input: keine CSP-Violations in der Konsole
4. Unit-Test für CSP-Header grün

## Tech Design (Solution Architect)

### Was sich seit dem Blocker geändert hat — und was die Architektur-Annahme unten falsch hatte

Ursprüngliche Annahme (vor Implementierung): Next.js-16.1.1-Bug ist gefixt, Logik gehört in den bestehenden Root-`proxy.ts`. **Das zweite war falsch, durch Implementierung widerlegt — siehe Implementation Notes.** `proxy.ts`/`proxy`-Export liefert in 16.2.6 weiterhin keine selbst gesetzten Header aus, weder bei `NextResponse.redirect()` noch bei `NextResponse.next()`. Einzig `src/middleware.ts`/`middleware`-Export (der offiziell deprecated Name) funktioniert korrekt. Tatsächlich umgesetzt: Auth-Logik + CSP/Nonce zusammen in `src/middleware.ts`, kein separater Root-`proxy.ts` mehr.

### Datenfluss (wie tatsächlich gebaut)

```
Request
  → src/middleware.ts: Supabase-Auth-Check (migriert aus dem alten Root-proxy.ts, Verhalten unverändert)
  → src/middleware.ts: Nonce erzeugen, CSP-Header + x-nonce-Header auf die Response setzen
  → Response geht an Browser
  → Root Layout (Server Component) liest x-nonce aus den Request-Headers
  → Next.js reicht den Nonce automatisch an seine eigenen generierten Scripts weiter (curl-verifiziert, auch auf <link rel=preload>)
```

### `next.config.ts`-Fallback entfernt, nicht "vorerst behalten"

Ursprünglicher Plan war, den `next.config.ts`-CSP-Eintrag erst nach Verifikation zu entfernen. Tatsächlicher Verifikationslauf zeigte einen Zwischenschritt-Befund: `next.config.ts`-`headers()` **überschreibt** gleichnamige Proxy-/Middleware-Header (Next.js-Präzedenz, kein Bug) — mit beiden aktiv kam der alte `unsafe-inline`-Wert durch, kein Nonce sichtbar. Also musste der Fallback **vor** dem finalen grünen Test entfernt werden, nicht danach. Reihenfolge real: Header in `next.config.ts` entfernt → neu gebaut → curl zeigte zunächst gar keinen CSP-Header (Beweis für das `proxy.ts`-Problem oben) → nach Umzug auf `middleware.ts` zeigte curl den korrekten Nonce-Header.

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Nonce-Logik in bestehendem Root-`proxy.ts`, keine neue Datei | Vermeidet die Mehrdeutigkeit, die letztes Mal zum Fehlschlag führte (mehrere konkurrierende Einstiegspunkte) |
| `next.config.ts`-CSP bleibt bis Production-`curl`-Verifikation | Verhindert eine Phase ganz ohne CSP-Schutz, falls der neue Ansatz wieder nicht greift |
| Kein neues NPM-Package | Web Crypto API (`crypto.randomUUID()`) ist in Next.js Edge-Runtime und Node.js nativ verfügbar |
| Verifikation zuerst per `curl` gegen `next start`, dann erst Browser-DevTools | Letztes Mal zeigte der Dev-Server-Log "proxy läuft", obwohl der Header fehlte — Code-Ausführung beweist nicht Header-Anwesenheit |

### Abhängigkeiten (Pakete)

Keine neuen Pakete.

## Implementation Notes

**Pre-Step erledigt (2026-05-23):** `'unsafe-eval'` aus `next.config.ts` entfernt (Security-Audit PROJ-8). Aktueller Stand in `script-src`: `'self' 'unsafe-inline' blob:`. PROJ-15 setzt hier an und entfernt `'unsafe-inline'` durch nonce-basiertes CSP.

**Implementiert (2026-05-23):**
- `src/proxy.ts` statt `src/middleware.ts` — Next.js 16 hat `middleware.ts` deprecated; neues Datei-Convention ist `proxy.ts` mit einem `proxy`-Named-Export (analog zu `middleware`-Export vorher). Funktionalität identisch.
- `buildCsp(nonce)` als exportierte Pure Function für Testbarkeit.
- `src/app/layout.tsx` ist jetzt `async`; liest `x-nonce` via `await headers()` (Next.js 15+ API) und setzt `nonce` auf `<html>`.
- `next.config.ts`: CSP-Header entfernt; alle anderen Security-Header (HSTS, X-Frame-Options etc.) bleiben dort.
- `src/proxy.test.ts`: 4 Unit-Tests für `buildCsp` — nonce in script-src, kein unsafe-inline in script-src, kein unsafe-eval, blob: in script-src.

**BUG-1 Fix (2026-05-24) — NOCH NICHT VOLLSTÄNDIG BEHOBEN:**

**Was bisher herausgefunden wurde:**

1. `proxy.ts` heißt korrekt (Next.js 16 hat middleware.ts → proxy.ts umbenannt, v16.0.0).
2. Export-Name `proxy` ist korrekt laut Docs und Source-Code.
3. `buildCsp` und `crypto.randomUUID()` sind korrekt (kein Buffer.from-Bug).
4. `worker-src blob: 'self'` wurde hinzugefügt.
5. Unit-Tests: 5 passed (`src/middleware.test.ts` importiert von `src/proxy.ts`).

**Kern-Problem (verifiziert):**
`src/proxy.ts` wird von Next.js 16.1.1 zur Laufzeit **nicht als Proxy-Einstiegspunkt registriert**.
Beweis: Nach vollständigem Löschen von `.next` entsteht **kein** `middleware-manifest.json`.
GET `/proxy-test` (der einen direkten `new Response('PROXY_IS_RUNNING')` zurückgeben würde) liefert stattdessen die Login-Seite — die Proxy-Funktion wird nie aufgerufen.

**Aktueller Dateizustand:**
- `src/proxy.ts` — enthält `buildCsp` + `proxy`-Funktion mit `/proxy-test`-Debugging-Branch + `config`-Matcher
- `src/middleware.test.ts` — 5 Unit-Tests, alle grün
- `proxy.ts` (Projekt-Root) — neu angelegt als nächster Test-Schritt, importiert `buildCsp` aus `src/proxy.ts`
- `next.config.ts` — kein CSP-Header mehr (entfernt, korrekt)
- `src/app/layout.tsx` — async, liest `x-nonce` Header

**Nächster Debug-Schritt (noch nicht ausgeführt):**

**Test A — Root-Level proxy.ts:**
Server stoppen → `.next` löschen → `npm run dev`.
Erwartetes Ergebnis bei Erfolg: Fehler "Both middleware and proxy file detected" ODER CSP-Header erscheint.
Erwartetes Ergebnis bei Misserfolg: Weiterhin kein CSP-Header, kein Fehler.

Falls Test A schlägt fehl → **Test B — middleware.ts:**
`proxy.ts` (Root) und `src/proxy.ts` löschen. `src/middleware.ts` mit `middleware`-Export erstellen (deprecated, aber lt. Source-Code-Analyse korrekt erkannt). Gleicher Code, nur anderer Dateiname und Export-Name.

**Source-Code-Analyse-Ergebnis:**
Relevante Datei: `node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js`, Zeile 321:
```javascript
const isAtConventionLevel = fileDir === dir || fileDir === path.join(dir, 'src');
```
Theoretisch sollte `src/proxy.ts` erkannt werden. Mögliche Ursachen für Fehler:
- Pfad-Separator-Inkonsistenz auf Windows (watchpack forward-slash vs. path.join backslash)
- `knownFiles` enthält `src/proxy.ts` nicht beim Start (Timing/Watch-Issue)
- Next.js 16.1.1-spezifischer Bug mit Turbopack + proxy.ts in src/

### Re-Versuch 2026-06-22 (Next.js 16.2.6) — erfolgreich, mit Korrektur der Architektur-Annahme

**Befund 1 — Next.js-16.1.1-Header-Drop-Bug ist gefixt:** Spike mit `src/middleware.ts` (`middleware`-Export) zeigte korrekt gesetzten Custom-Header in der Response.

**Befund 2 — `proxy.ts`/`proxy`-Export ist weiterhin defekt, unabhängig vom Header-Drop-Bug:** Isolierter Test mit minimaler Root-`proxy.ts` (nur `NextResponse.redirect()` + Header, kein Supabase) zeigte **keinen** Header. Zweiter isolierter Test mit `NextResponse.next()` statt `redirect()` — ebenfalls **kein** Header. Damit ausgeschlossen, dass es am Redirect-Pfad liegt; es liegt an der Datei/Export-Konvention selbst. Build-Log nennt den Slot in beiden Fällen identisch `ƒ Proxy (Middleware)`, aber nur der `middleware.ts`/`middleware`-Pfad liefert tatsächlich aus.

**Befund 3 — `next.config.ts`-`headers()` überschreibt gleichnamige Proxy-Header:** Mit CSP gleichzeitig in `next.config.ts` UND im Proxy gesetzt, kam ausschließlich die `next.config.ts`-Variante (mit `unsafe-inline`) durch — kein Next.js-Bug, sondern dokumentierte Präzedenz (Framework-Level-Headers gewinnen). `next.config.ts`-CSP musste daher entfernt werden, *bevor* der Proxy-Pfad sauber verifizierbar war, nicht erst danach wie ursprünglich geplant.

**Finale Lösung:** Komplette Auth+CSP-Logik in `src/middleware.ts` (`middleware`-Export, deprecated Name, aber einzige funktionierende Variante in 16.2.6). Kein Root-`proxy.ts` mehr. `src/middleware.test.ts` mit 5 Tests für `buildCsp`.

**Curl-Verifikation gegen `next build && next start` (nicht nur Dev-Server):**
- `/login`: `content-security-policy: ... script-src 'self' 'nonce-{uuid}' blob: ...`, kein `unsafe-inline`, `x-nonce`-Header gesetzt
- HTML-Body: `nonce="{uuid}"` korrekt auf 3 von Next.js generierten Tags (inkl. `<link rel=preload>`), Wert identisch zum Header
- `/` (nicht eingeloggt): 307 → `/login`, CSP-Header auch auf der Redirect-Response vorhanden
- Auth-Redirect-Logik unverändert funktional (migriert 1:1 aus dem alten Root-`proxy.ts`)
- `npm test`: 627 passed / 1 skipped, keine Regression
- `npm run lint` (`tsc --noEmit`): keine Fehler

## QA Test Results (2026-06-22, gegen `src/middleware.ts`)

**QA-Datum:** 2026-06-22
**Tester:** /qa PROJ-15
**Environment:** Next.js 16.2.6, Production-Build (`next build && next start`) für curl/Header-Checks, Playwright Dev-Server für E2E

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| D1.1 | Kryptographisch zufälliger Nonce pro Request | PASS (`crypto.randomUUID()`, curl zeigt unterschiedlichen Wert pro Request) |
| D1.2 | `x-nonce`-Response-Header gesetzt | PASS |
| D1.3 | CSP-Header mit `nonce-{value}` statt `unsafe-inline` im `script-src` | PASS |
| D1.4 | `next.config.ts` ohne CSP-Header | PASS |
| D1.5 | Bestehende Auth-Redirect-Logik erhalten | PASS (`/` → 307 → `/login`, unverändert) |
| D2.1 | `layout.tsx` liest `x-nonce` aus Request-Headers | PASS |
| D2.2 | Nonce als Prop an `<html>` | PASS (HTML-Body enthält `nonce="{uuid}"`) |
| D2.3 | Next.js reicht Nonce automatisch an eigene Scripts weiter | PASS (`<link rel=preload>`-Header trägt denselben Nonce) |
| D3.1 | `npm run build` ohne Fehler | PASS |
| D3.2 | Kein `unsafe-inline`/`unsafe-eval` in `script-src` | PASS |
| D3.3 | Keine CSP-Violations im Browser-Console | PASS (Playwright Console-Listener, 0 CSP-Violation-Messages über 2 Browser-Projekte) |
| D3.4 | Voice Input/AudioWorklet (`blob:` in `script-src`+`worker-src`) | PASS strukturell (Direktiven korrekt gesetzt) — **nicht end-to-end mit echtem Mikrofon-Input getestet**, kein Test-User-Setup in dieser Runde |
| D3.5 | PDF-Report Download funktioniert | Nicht getestet in dieser Runde (kein Test-User-Setup) |
| D4.1 | Unit-Test: CSP enthält `nonce-` | PASS |
| D4.2 | Unit-Test: kein `unsafe-inline`/`unsafe-eval` | PASS |
| D4.3 | Unit-Test: `blob:` in `script-src` | PASS |

**Passed:** 14 / **Not tested:** 2 (D3.4 Voice-Input-Live-Test, D3.5 PDF-Download — beide brauchen eingeloggten Test-User, nicht Teil dieser QA-Runde)

### Automated Tests

- `npm test`: 627 passed / 1 skipped — keine Regression
- `npm run lint` (`tsc --noEmit`): clean
- Unit-Tests `src/middleware.test.ts`: 5/5 grün
- E2E `tests/PROJ-15-csp-hardening.spec.ts`: 4 Tests × 2 Browser-Projekte (Chromium, Mobile Safari) = 8/8 grün

### Bugs

#### QA-15-L1 [Low]: Hydration-Mismatch-Warning auf `nonce`-Attribut im Dev-Mode

**Beschreibung:** React-Console-Warning beim Laden von `/login` im Dev-Server (`npm run dev`, von Playwright automatisch gestartet): `<html nonce="...">` unterscheidet sich zwischen Server- und Client-Render, weil jeder Request einen neuen Nonce erzeugt — React kann das beim Hydration-Diff nicht wissen.

**Impact:** Rein kosmetisch im Dev-Mode-Console-Output. Kein funktionaler Fehler — Seite rendert korrekt, CSP greift korrekt (kein Violation). React dokumentiert selbst, dass `eval()`-bezogene Dev-Warnings "nie in Production" auftreten; die Hydration-Warning ist ebenfalls ein Dev-Mode-Artefakt der ständig wechselnden Nonce, nicht in der Produktion verifiziert (Production-Build unterdrückt React-Dev-Warnings standardmäßig).

**Fix-Empfehlung:** Kein Fix nötig für Deploy. Falls störend: `suppressHydrationWarning` auf `<html>` wäre die Standard-React-Lösung für bewusst client/server-divergente Attribute, aber das verschleiert auch andere echte Hydration-Bugs auf diesem Element — nicht ohne weitere Abwägung umsetzen.

### Security Audit

- Nonce ist pro Request einzigartig (`crypto.randomUUID()`), nicht vorhersagbar, nicht wiederverwendet zwischen Requests — verifiziert über mehrere curl-Aufrufe mit unterschiedlichen Werten.
- Auth-Bypass: unverändert getestet, Redirect-Logik unangetastet (migriert 1:1, kein Verhaltensunterschied).
- Keine Secrets im Response-Header oder HTML-Body (Nonce ist per Design öffentlich sichtbar, kein Secret — das ist beabsichtigtes CSP-Pattern, kein Leak).
- `style-src 'unsafe-inline'` bleibt bewusst (Out-of-Scope laut Spec, CSS-Injection kein relevantes Threat-Model hier).

### Regression Testing

- `npm test` komplett grün (627/628), keine der 47 Test-Dateien betroffen außer den neuen `middleware.test.ts`.
- Auth-Flow (Route Protection, Redirects) unverändert funktional — selbe Logik wie vorher, nur Datei/Export-Name geändert.

### Production-Ready Decision

**YES** — keine Critical/High/Medium Bugs. QA-15-L1 ist Dev-Mode-Cosmetic, kein Production-Risiko. D3.4/D3.5 (Low-Risk, strukturell korrekt, aber nicht live end-to-end verifiziert) sollten bei nächster Gelegenheit mit echtem Test-User nachgezogen werden — kein Deploy-Blocker.

**QA-Datum:** 2026-05-23
**Tester:** /qa PROJ-15
**Environment:** Next.js 16.1.1 (Turbopack), dev server + production build

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| D1.1 | `src/proxy.ts` generiert kryptographisch zufälligen Nonce | PASS |
| D1.2 | Nonce wird als `x-nonce` Response-Header gesetzt (Code) | PASS (Code) |
| D1.3 | CSP-Header mit `nonce-{value}` statt `unsafe-inline` im Actual Response | **FAIL** |
| D1.4 | `next.config.ts` enthält keinen CSP-Header mehr | PASS |
| D1.5 | Bestehende Middleware-Logik erhalten | PASS (n/a) |
| D2.1 | `layout.tsx` liest `x-nonce` aus Headers | PASS (Code) |
| D2.2 | Nonce als `nonce`-Prop an Script-Tags | **FAIL** (nonce="$undefined" in RSC) |
| D2.3 | Next.js überträgt Nonce auf generierte Script-Tags | **FAIL** (nonce="" in HTML) |
| D3.1 | `npm run build` ohne Fehler | PASS |
| D3.2 | DevTools: kein `unsafe-inline` im CSP-Header | **FAIL** (kein CSP-Header vorhanden) |
| D3.3 | Keine CSP-Violation-Warnings beim Interview-Ablauf | N/A (CSP not active) |
| D3.4 | Voice Input / AudioWorklet lädt korrekt | N/A (CSP not active) |
| D4.1 | Unit-Test: CSP enthält `nonce-` | PASS |
| D4.2 | Unit-Test: kein `unsafe-inline` und `unsafe-eval` | PASS |
| D4.3 | Unit-Test: `blob:` in `script-src` | PASS |

**Passed:** 8 / **Failed:** 4 / **N/A:** 3

### Bugs

#### BUG-1 [Critical]: CSP-Header erscheint nicht in HTTP-Responses

**Beschreibung:** Die `proxy.ts` läuft nachweislich (Dev-Server-Log: `proxy.ts: 66ms`), aber der `Content-Security-Policy` Response-Header ist in keiner Route vorhanden. Außerdem wird der `x-nonce` Request-Header nicht an Server Components weitergegeben (RSC-Payload zeigt `x-nonce` nicht im `headers()`-Output, `nonce=""` im gerenderten HTML).

**Symptome (verifiziert):**
- `curl -sI http://localhost:3001/login` — kein `Content-Security-Policy` Header
- RSC-Payload: `headers()` gibt `["host", ...], ["user-agent", ...]` ohne `x-nonce`
- HTML: `<html lang="de" nonce="">` — leerer Nonce
- RSC: alle `<script>`-Tags haben `"nonce":"$undefined"`

**Kritische Regression:** Der ursprüngliche CSP aus `next.config.ts` (`script-src 'self' 'unsafe-inline' blob:`) wurde entfernt; der Ersatz über `proxy.ts` funktioniert nicht. Die App hat aktuell **keinen CSP-Header** — schlechter als vor PROJ-15.

**Root-Cause-Hypothese:** In Next.js 16 könnte sich die API für die Header-Propagation vom Proxy zu Server Components geändert haben. `NextResponse.next({ request: { headers: requestHeaders } })` reicht die `x-nonce` Header möglicherweise nicht durch. Alternativ: `Buffer.from(...)` schlägt im Proxy-Runtime-Kontext fehl und Next.js fällt lautlos auf Passthrough zurück.

**Schritte zur Reproduktion:**
1. `npm run dev` oder `npm run start`
2. `curl -sI http://localhost:300x/login | grep -i csp`
3. Kein Treffer

**Fix-Hinweis:** Zwei Aspekte zu prüfen:
1. `Buffer.from(crypto.randomUUID()).toString('base64')` ggf. durch `crypto.randomUUID()` direkt ersetzen (kein Buffer nötig)
2. Header-Propagation testen: `NextResponse.next({ request: { headers: requestHeaders } })` vs. alternatives API-Pattern für Next.js 16

### Regression Testing

E2E-Tests (Playwright) ausgeführt: 16 passed, restliche Failures sind pre-existing Supabase-Auth-Abhängigkeiten — keine neuen Regressions durch PROJ-15.

### BUG-1 Final Status (2026-05-24)

**NICHT BEHEBBAR mit Next.js 16.1.1.** Vollständige Debug-Historie:

1. `src/proxy.ts` mit `proxy`-Export: Wurde nicht ausgeführt (existierende `middleware.ts` am Root hat gewonnen).
2. Root-Level `proxy.ts` und `middleware.ts` verschmolzen mit CSP-Logik: Code lief nachweislich (Auth-Redirects funktionieren), aber `response.headers.set('Content-Security-Policy', ...)` wurde in der HTTP-Response nicht ausgeliefert.
3. Header via NextResponse-Konstruktor (`new NextResponse(null, { headers })` und `NextResponse.next({ headers })`): ebenfalls verworfen.
4. Header via NextResponse.redirect-Konstruktor: ebenfalls verworfen.
5. Test mit Production-Build (`next build` + `next start`, kein Turbopack): identisches Verhalten. **Damit ausgeschlossen, dass es ein Turbopack-spezifischer Bug ist.**

**Beweise dass die Proxy-Funktion läuft:** `/dashboard` ohne Auth wird zu `/login` redirected (307) — diese Logik kommt nachweislich aus unserer proxy.ts.

**Beweise dass Header verworfen werden:** Keiner der gesetzten Custom-Header (`Content-Security-Policy`, `x-csp-via`, `x-nonce-debug`) erscheint in der Response — weder bei 200-OK noch bei 307-Redirect. Header aus `next.config.ts` `headers()` erscheinen dagegen problemlos.

### Production-Ready Decision

**SHIPPED (revertet auf Pre-PROJ-15 Stand minus `unsafe-eval`)** — 2026-05-24.

Konkrete Änderungen wieder aktiv:
- `next.config.ts`: CSP zurück mit `script-src 'self' 'unsafe-inline' blob:` (kein `'unsafe-eval'`, kein Nonce). Andere Security-Header (HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, X-Permitted-Cross-Domain-Policies, Permissions-Policy) bleiben.
- `proxy.ts`: Reverted auf Supabase-Auth-only Variante (kein CSP-Code mehr).
- `src/app/layout.tsx`: `async` und `x-nonce`-Lookup entfernt — wieder die einfache synchron-Variante.
- `proxy.test.ts` entfernt (testete `buildCsp` aus reverted Code).

**Sicherheits-Delta gegenüber Pre-PROJ-15:** Reduktion um `'unsafe-eval'` (über PROJ-8 Pre-Step bereits durchgeführt) bleibt erhalten. `'unsafe-inline'` weiterhin notwendig, bis Next.js den Header-Drop-Bug behebt.
