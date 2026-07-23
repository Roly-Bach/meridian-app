# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production
- **Blocked** - Arbeit pausiert wegen externem Faktor (orthogonal zu Planned/Architected/In Progress)
- **Zurückgestellt** - Strategisch deprioritisiert, kein Bau-Termin; taucht in keiner Build Order auf

## Features

| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
|----|---------|------|--------|---------|--------|------|----------|----------|------|
| PROJ-1 | Auth + Workspace | Epic | Platform | — | Deployed | [spec](platform/PROJ-1-auth-workspace.md) | P0 | — | — |
| PROJ-2 | Interview Engine Backend | Epic | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-2-interview-engine-backend.md) | P0 | — | — |
| PROJ-3 | Interview UI | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-3-interview-ui.md) | P0 | — | — |
| PROJ-4 | Extraktions-Agent + Wissensbasis | Epic | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-5 | Prozessschritt-Anreicherung | Feature | Wissensbank | — | Deployed | → PROJ-20 | P0 | — | — |
| PROJ-6 | Use Case Identifikation | Epic | Use Case Engine | — | Deployed | [spec](use-case-engine/PROJ-6-use-case-identifikation.md) | P0 | — | — |
| PROJ-7 | Voice Input (Interview) | Extension | Interview Engine | PROJ-3 | Deployed | [spec](interview-engine/PROJ-7-voice-input.md) | P1 | — | — |
| PROJ-8 | Interview-Design Optimierung | Revision | Interview Engine | PROJ-2 | Deployed (superseded by PROJ-22) | [spec](interview-engine/PROJ-8-interview-design-optimierung.md) | P1 | — | — |
| PROJ-9 | LLM Provider Optimierung | Feature | Platform | — | In Progress | [spec](platform/PROJ-9-llm-provider-optimierung.md) | P1 | M | — |
| PROJ-10 | Access Control & Shared Workspace | Feature | Platform | — | Deployed | [spec](platform/PROJ-10-access-control-shared-workspace.md) | P0 | — | — |
| PROJ-11 | Interview PDF Report | Feature | Dashboard & Output | — | Deployed | [spec](dashboard-output/PROJ-11-interview-pdf-report.md) | P1 | — | — |
| PROJ-12 | Rate Limiting | Feature | Platform | — | Deployed | [spec](platform/PROJ-12-rate-limiting.md) | P1 | — | — |
| PROJ-13 | LLM Observability & Tracing | Feature | Platform | — | Deployed | [spec](platform/PROJ-13-llm-observability-tracing.md) | P1 | M | 0:0:2 |
| PROJ-14 | Embedding-Modell Auswahl | Extension | Wissensbank | PROJ-4 | Deployed | → PROJ-20 | P1 | — | — |
| PROJ-15 | CSP Hardening | Feature | Platform | — | Deployed | [spec](platform/PROJ-15-csp-hardening.md) | P1 | S | 0:0:1 |
| PROJ-16 | Supabase Hardening + Dependency Hygiene | Feature | Platform | — | Deployed | [spec](platform/PROJ-16-supabase-hardening.md) | P1 | M | 0:0:0 |
| PROJ-17 | Adaptive Eval-Harness + Start-Endpoint | Feature | Interview Engine | — | Deployed | [spec](interview-engine/PROJ-17-adaptive-eval-harness-start-endpoint.md) | P1 | M | 0:0:2 |
| PROJ-18 | Prozessschritt-Deduplication | Feature | Wissensbank | PROJ-5 | Deployed | → PROJ-20 | P1 | M | 0:0:2 |
| PROJ-19 | Knowledge-Informed Interviewing | Extension | Interview Engine | PROJ-2 | Zurückgestellt | — | P2 | — | — |
| PROJ-20 | Prozessableitungs-Pipeline | Epic | Wissensbank | — | Deployed | [spec](wissensbank/PROJ-20-prozessableitungs-pipeline.md) | P0 | — | 0:0:0 |
| PROJ-21 | Eval-Foundation für Modell- und Architektur-Vergleich | Revision | Interview Engine | PROJ-17 | Deployed | [spec](interview-engine/PROJ-21-eval-foundation-modell-architektur-vergleich.md) | P1 | M | 0:0:0 |
| PROJ-22 | Dual-Loop Interview Engine (ADR-011) | Revision | Interview Engine | PROJ-2 | Deployed | [spec](interview-engine/PROJ-22-dual-loop-interview-engine.md) | P1 | L | 0:0:5 |
| PROJ-23 | Adaptive Clarification Questions | Extension | Interview Engine | PROJ-2 | Deployed | [spec](interview-engine/PROJ-23-adaptive-clarification-questions.md) | P1 | M | 0:0:0 |
| PROJ-24 | Cluster-aware Use Case Generation + Detail View | Extension | Use Case Engine | PROJ-6 | Deployed | [spec](use-case-engine/PROJ-24-cluster-aware-use-case-generation.md) | P1 | L | 0:0:0 |
| PROJ-25 | Prozesswissens-Schema (O1–O5 + Governance) | Revision | Wissensbank | PROJ-20 | Deployed | [spec](wissensbank/PROJ-25-prozesswissens-schema.md) | P1 | L | 0:0:0 |
| PROJ-26 | Getypte Abhängigkeitskanten | Extension | Wissensbank | PROJ-20 | Deployed | [spec](wissensbank/PROJ-26-getypte-abhaengigkeitskanten.md) | P1 | M | 0:0:0 |
| PROJ-27 | Schema-Bindung + verlustfreie Speicherung | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-27-schema-bindung-verlustfreie-speicherung.md) | P1 | L | 0:0:0 |
| PROJ-28 | Extraktions-Zuverlässigkeit | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-28-extraktions-zuverlaessigkeit.md) | P1 | M | 0:0:0 |
| PROJ-29 | Gesprächsführungs-Revision | Revision | Interview Engine | PROJ-23 | Deployed | [spec](interview-engine/PROJ-29-gesprächsführungs-revision.md) | P1 | L | 0:0:1 |
| PROJ-30 | Tiefe-/O10-Metrik | Revision | Interview Engine | PROJ-21 | Deployed | [spec](interview-engine/PROJ-30-tiefe-o10-metrik.md) | P1 | L | 0:0:1 |
| PROJ-31 | Eval-Schärfung (Judge, Perturbation, Robustheit) | Revision | Interview Engine | PROJ-21 | Deployed | [spec](interview-engine/PROJ-31-eval-schaerfung.md) | P1 | L | 0:0:0 |
| PROJ-32 | Agenten-Architektur (Trennung, Preparator; vertagt) | Revision | Interview Engine | PROJ-22 | Zurückgestellt | [BL-E4.1+E4.2](../../meridian-ma/requirements/build-backlog-etappe2.md) · REQ-021/024 | P2 | M | — |
| PROJ-33 | Turn-Loop-Konsolidierung (runInterviewTurn) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-33-turn-loop-konsolidierung.md) | P1 | M | 0:0:0 |
| PROJ-34 | Werkzeug-Schreibabsichten + TurnStore-Port (DB-freie Evals) | Revision | Interview Engine | PROJ-33 | Deployed | [spec](interview-engine/PROJ-34-werkzeug-schreibabsichten-turnstore-port.md) | P2 | L | 0:0:1 |
| PROJ-35 | interviewAgent.ts entkernen (Conversation-Signals + server-only-Naht) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-35-interviewagent-entkernen.md) | P2 | M | 0:0:0 |
| PROJ-36 | ProcessStepsTable — Cluster-Aggregation als reines Modul | Revision | Dashboard & Output | PROJ-20 | Deployed | [spec](dashboard-output/PROJ-36-process-steps-table-cluster-aggregation.md) | P2 | S | 0:0:0 |
| PROJ-37 | Static-Prompt-Drift konsolidieren (Talker vs. Greeting/Reconnect) | Revision | Interview Engine | PROJ-22 | Deployed | [spec](interview-engine/PROJ-37-static-prompt-drift-konsolidieren.md) | P2 | S | 0:0:0 |
| PROJ-38 | Slot-Write-Encoding-Fix (Eval-Signal wiederherstellen) | Revision | Interview Engine | PROJ-27 | Deployed | [spec](interview-engine/PROJ-38-slot-write-encoding-eval-signal.md) | P1 | S | 0:0:0 |
| PROJ-39 | Eval-Judge-Parsing-Härtung (dialog_naturalness + slotDepth) | Revision | Interview Engine | PROJ-31 | Deployed | [spec](interview-engine/PROJ-39-eval-judge-parsing-haertung.md) | P1 | S | 0:0:1 |
| PROJ-40 | Eval-Instrument-Validierung + Versuchsplan | Revision | Interview Engine | PROJ-31 | Approved | [spec](interview-engine/PROJ-40-eval-instrument-validierung-versuchsplan.md) | P1 | L | 0:0:0 |
| PROJ-41 | Interview-Modell-Auswahl (OSS-Screening + EU-Prod-Route) | Revision | Platform | PROJ-9 | Blocked | [spec](platform/PROJ-41-interview-modell-auswahl.md) | P1 | L | — |
| PROJ-42 | Interview-Grenzfall-Robustheit (Wrap-up + Rollen-Guard) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-42-interview-grenzfall-robustheit.md) | P0 | M | 0:1:1 |
| PROJ-43 | Elicitation-Reorientierung (AI-Treiber, Zahlen→Cards) | Revision | Interview Engine | PROJ-29 | Approved | [spec](interview-engine/PROJ-43-elicitation-reorientierung.md) | P1 | XL | 0:1:2 |
| PROJ-44 | Pipeline-Simplifikation (Analyst-vor-Talker + Legacy-Pfad) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-44-pipeline-simplifikation.md) | P1 | XL | 0:2:0 |
| PROJ-45 | Schema-Konsolidierung + AI-Wert-Faktoren | Revision | Wissensbank | PROJ-25 | Deployed | [spec](wissensbank/PROJ-45-schema-konsolidierung-ai-wert-faktoren.md) | P1 | XL | 0:1:0 |
| PROJ-46 | Talker-Briefing-Konsolidierung (Judgment-Signale → Analyst) | Revision | Interview Engine | PROJ-22 | Approved | [spec](interview-engine/PROJ-46-talker-briefing-konsolidierung.md) | P1 | XL | 0:0:1 |
| PROJ-47 | Clarification-Card-Generierung entkoppeln (LLM-Teil: OpenItem/Qualitative) | Revision | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-48 | Fokus-Lock-Härtung (Bootstrap, Discovery-Exhausted-Guard, Talker-Zieltreue) | Revision | Interview Engine | PROJ-44 | Approved | [spec](interview-engine/PROJ-48-fokus-lock-haertung.md) | P1 | L | 0:0:1 |
| PROJ-49 | Prozess-Priorisierungsmechanik (KI-Relevanz-Bewertung entdeckter Prozesse) | Epic | Use Case Engine | — | Roadmap | — | P2 | — | — |
| PROJ-50 | Opener-Frage-Überarbeitung (Hauptaufgaben/Arbeitstag mischt zwei Antworten) | Revision | Interview Engine | PROJ-2 | Roadmap | — | P2 | — | — |
| PROJ-51 | Übergang vor Clarification Cards (kein abrupter Sprung nach Verabschiedung) | Extension | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-52 | Clarification-Card-Plausibilität (Schritt-Titel-Mehrdeutigkeit, Bucket-Passung) | Revision | Interview Engine | PROJ-43 | Roadmap | — | P2 | — | — |
| PROJ-53 | Analyst/Talker-Prompt-Audit (Inhalt/Struktur/Prägnanz/Konsistenz/Redundanz) | Revision | Interview Engine | PROJ-46 | Roadmap | — | P2 | — | — |

<!-- Add features above this line -->

## Next Available ID: PROJ-54

## Known Issues

> Bugs und technische Schulden, die kein eigenes Feature rechtfertigen. Vor dem nächsten Deploy prüfen ob noch offen.
>
> **Vollständig gelöste KIs (KI-1..17, 19, 20, 22, 23, 24, 27, 29, 30, 21, 25) sind verlustfrei nach [docs/known-issues-history.md](../docs/known-issues-history.md) archiviert** (2026-07-15, erweitert 2026-07-22 — KI-23/24/27; erweitert 2026-07-24 — KI-29/30 via PROJ-48, KI-21/25 via PROJ-43, im Joint-Gate PROJ-40/42/43/44/46/48 geschlossen, siehe Historie). Die lange KI-18-Fix-Historie (6 Versuche) ist ebenfalls 2026-07-24 in die Historie ausgelagert; KI-18 selbst bleibt offen (kondensierter Eintrag unten). Hier stehen nur offene KIs (KI-18, KI-26, KI-28, KI-31).

| ID | Severity | Beschreibung | Entdeckt in | Fix-Aufwand |
|----|----------|-------------|-------------|-------------|
| KI-26 | 🟡 Open | Rollen-Guard-Falschpositiv — eine normale (wenn ausweichende) Mitarbeiter-Antwort wird als `off_topic` klassifiziert. PROJ-44-QA-Eval it-support Turn 2: "15 bis 20 Tickets pro Tag. Zeitaufwand? Kommt drauf an." → statischer Redirect ("Dazu kann ich als Interviewer leider nichts beitragen — bleiben wir beim Prozessgespräch.") + **wortgleiche** Wiederholung der Turn-1-Frage. Da `off_topic` den synchronen Analyst kurzschließt (PROJ-44-Reihenfolge, [runInterviewTurn.ts:216](../src/services/runInterviewTurn.ts#L216)), wird der genannte Wert "15–20/Tag" in diesem Turn **nicht** extrahiert (erst Turn 3 nachgeholt). Ursache: Prefilter/Judge-Präzision in [roleGuard.ts](../src/services/roleGuard.ts) (PROJ-42, von PROJ-44 unverändert). → **PROJ-42** (Rollen-Guard-Präzision). | PROJ-44-QA-Eval 2026-07-17 | → PROJ-42 |
| KI-28 | 🟡 Open | Eval-Scorer fällt bei Judge-Call-Fehler still auf einen plausiblen Fallback-Score zurück, statt hart zu scheitern — Verstoß gegen die general.md-Regel „Eval-Preflight: Judge-API-Key validieren" ("Kein stiller Fallback-Score bei ungültigem Key"). Real aufgetreten während PROJ-44-QA-Runde 3 (2026-07-17): dem Anthropic-Account ging während eines laufenden `/eval:interview`-Laufs (buchhalter) das Guthaben aus, exakt beim Post-Run-`dialog_naturalness`-Judge-Call. `scoreDialogNaturalness` ([dialogNaturalness.ts:121](../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L121)) fing den `AI_RetryError` ab und gab still `0.5` zurück (`[scorer:dialog_naturalness] judge call failed, returning 0.5`), statt den Lauf als invalide zu markieren — der generierte Report sah oberflächlich plausibel aus (Wert im gültigen Bereich). Der Standard-Preflight-Check dieser Runde (GET `/v1/models`) hatte 200 zurückgegeben, da dieser Endpunkt keine Kreditprüfung auslöst; ein `generateText`-artiger Call mit echtem Guthabenverbrauch ist der schärfere Test. Die eigentlichen Interview-Turns (inkl. `talkerGroundingGuard.ts`, das bereits nach KI-18s sechstem Fix-Versuch hart eskaliert statt still zu degradieren) waren zu diesem Zeitpunkt bereits vollständig und korrekt abgerechnet durchgelaufen — betroffen war ausschließlich der nachgelagerte Scorer. Kein PROJ-44-Code-Bug (Scorer-Infrastruktur), aber ein reales, während dieser QA beobachtetes Instrument-Risiko: ein künftiger Lauf mit ungültigem/leerem Judge-Key könnte einen falschen PASS erzeugen, ohne dass es auffällt. Empfehlung: `scoreDialogNaturalness` (und Geschwister-Scorer, die einen LLM-Judge nutzen) auf das bereits etablierte `talkerGroundingGuard.ts`-Muster härten (`console.error` + Lauf explizit als invalide markieren statt eines stillen Fallback-Werts). | PROJ-44-QA-Eval Runde 3, 2026-07-17 | — (kein Fix geplant, nur dokumentiert; Härtung wäre eigenes kleines Item) |
| KI-18 | 🟡 Open | **`talker_grounding_violations` nicht durchgehend 0** — Talker schreibt der Persona gelegentlich einen abgeleiteten/erfundenen Wert als Zitat zu (Fabrikation / Cross-Context-Konfusion / Einheiten-Umrechnung). Diffuses Muster unter der früheren Anker-Pflicht (E3.3), nicht ein eng umreißbarer Bug. **Vollständige Fix-Historie (6 Versuche 2026-06-27..07-11, Modell-Klärung, 142-Transkript-Bestandsaufnahme, Architektur-Doku-Fund) verlustfrei in [docs/known-issues-history.md](../docs/known-issues-history.md#ki-18--grounding-violations-fix-historie-archiviert-2026-07-24-ki-18-bleibt-offen) archiviert (2026-07-24).** Primäre Absicherung ist der Live-`talkerGroundingGuard.ts` (Cross-Vendor-Judge + Repair, Buffer-then-stream). **Bewertung 2026-07-24 (Joint-Gate):** über alle Eval-Läufe seit 2026-07-22 Median 0, nur 3 von ~19 Läufen mit genau 1 Violation — PROJ-46s Anker-Pflicht-Relaxierung (ADR-023) hat den Druck gesenkt, das Restmuster aber nicht eliminiert. Der Guard ist weiter **lasttragend** (fing im frischen it-support-Lauf 1 echte Violation ab und reparierte sie). → **KI-18 bleibt offen; Guard NICHT löschen** (Löschung bräuchte einen Guard-off-Vergleichslauf, den die aktuellen Daten nicht decken). Guard-Kosten-Trade-off (Judge-Call/Turn + kein Live-Streaming) vs. seltene Violation ist eine legitime spätere Produktentscheidung. | Eval 2026-06-27; Bewertung Joint-Gate 2026-07-24 | offen (Guard = Absicherung) |
| KI-31 | 🔴 Open (blockt E2E-Gate) | **E2E-Test-Harness kann keinen Supabase-Test-User anlegen** — `createTestUser` ([tests/helpers/createTestUser.ts:45](../tests/helpers/createTestUser.ts#L45)) scheitert am `admin.auth.admin.updateUserById`-Metadata-Update mit `invalid JWT: ... unrecognized JWT kid <nil> for algorithm ES256`. `createUser` (POST) gelingt mit demselben `sb_secret_`-Key, nur der `updateUserById`-Pfad (PUT `/admin/users/{id}`) scheitert — via Supabase-Auth-Logs bestätigt. Ursache: das Projekt „Meridian MVP" nutzt asymmetrische ES256-JWT-Signing-Keys (neue Key-Ära, `sb_publishable_`/`sb_secret_`), der Admin-Pfad bekommt einen Legacy-Token ohne `kid`. **Kein App-Code-Bug und reines Test-Harness-Problem** (diese Session machte 0 `src/`-Änderungen; würde auf main identisch failen). **Prod nicht betroffen — code-verifiziert: `src/` nutzt `auth.admin`/`updateUserById` nirgends** (grep leer), der Admin-User-Management-Pfad existiert ausschließlich in `createTestUser`. Effekt: 31 E2E-Failures + 51 „did not run" (alle Auth-abhängig), 132 passed. Zwei Fix-Wege: (a) **harness-seitig im Code** — den scheiternden `updateUserById`-Metadata-Call in `createTestUser` umgehen (E2E grün ohne Dashboard-Eingriff); (b) Supabase-Dashboard → Authentication → JWT Signing Keys (Infra, Approval-pflichtig). Blockt die general.md-Regel „100% grüne Tests inkl. E2E vor Deploy". Entdeckt im Joint-Gate-E2E-Lauf 2026-07-24. | Joint-Gate E2E-Lauf 2026-07-24 | (a) Test-Harness-Code oder (b) Infra/Dashboard |


> KI-3 (dialog_naturalness-Parsing) ✅ gelöst durch mains JSON-Judge (kein `Stufe: X`-Truncation mehr; Lauf 2026-06-21 echter 0.67-Score, kein Fallback). KI-4 (Skill-Doc) bleibt via PROJ-39 (SKILL.md-Fix). Beide waren als PROJ-39 getrackt; der Parser-Teil ist durch den Merge mit mains JSON-Variante supersediert.

## Build Order
PROJ-1 → PROJ-2 → PROJ-3 & PROJ-4 (parallel) → PROJ-5 → PROJ-6

- **Etappe 2** (Schema-Fundament, ab 2026-06-16): PROJ-25 → PROJ-27 → PROJ-26 → PROJ-28/29, laufend mitmessend PROJ-30/31.
- **Etappe 3** (Deepening, ab 2026-06-18): PROJ-33 → PROJ-34/35/36/37.
- **Etappe 4** (Grenzfall-Robustheit, ab 2026-07-15): PROJ-42 + PROJ-44 (Timing-Flip, vor PROJ-43) → PROJ-46.
- **Etappe 5** (Schema-Konsolidierung + Elicitation, ab 2026-07-21): PROJ-45 → PROJ-43 → PROJ-48.

> **Joint-Gate 2026-07-24:** Etappe 2–5 abgeschlossen; PROJ-42/43/44/46/48 Approved, PROJ-45 Deployed, PROJ-40 Approved. Die vollständigen Etappen-Narrative (In-Progress-Build-Logs, ADR-Referenzen ADR-016..026, Schnitt-Entscheidungen) sind verlustfrei nach [docs/build-order-history.md](../docs/build-order-history.md) ausgelagert. Kanonischer Feature-Stand je Spec + ADR.

## Architecture Notes

### Service-Layer-Constraint (gilt ab PROJ-4)

KI-Logik (LLM-Calls via Claude, Embedding-Calls, Vektor-Operationen) gehört in dedizierte Service-Dateien unter `src/services/` — nicht direkt in API Routes oder Server Components.

Konkret für PROJ-4: Extraktions-Logik in `src/services/extraction.ts`, Embedding-Logik in `src/services/embeddings.ts`. API Routes rufen nur diese Services auf.

Quelle: Architektur-Review 2026-05-19 gegen "Web Application Development & Tech Stacks 2026"-Leitfaden.
